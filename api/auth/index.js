// Login endpoint for Vercel serverless (POST /api/auth; /api/auth/login re-exports this)
import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';
import { signToken, cors } from '../_lib/auth.js';
import { normaliseLoginId, verifyPassword, isBcryptHash } from '../_lib/passwordCheck.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return await handleLogin(req, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleLogin(req, res) {
  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const { username, email, password } = body;
  const loginId = normaliseLoginId(username || email); // Accept either username or email

  if (!loginId || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  // Every account the identifier could mean — not just the first. The users
  // table has held duplicate rows for one email (an old import plus a
  // re-registration); with LIMIT 1 the password was checked against whichever
  // row the database returned, so a correct temporary password set on the
  // other row was refused as "Invalid credentials". TRIM because some imported
  // emails carry stray spaces. Optional columns are read through to_jsonb so a
  // database without them still signs people in. Filtered by app_id to
  // isolate this app from others sharing the database.
  const result = await query(
    `SELECT id, email, password_hash AS password_value, role, full_name,
            COALESCE(is_approved, true) AS is_approved,
            COALESCE(is_active, true) AS is_active,
            COALESCE((to_jsonb(users) ->> 'must_change_password')::boolean, false) AS must_change_password
       FROM users
      WHERE (LOWER(TRIM(email)) = LOWER($1) OR LOWER(TRIM(username)) = LOWER($1))
        AND (app_id = 'psa' OR app_id IS NULL)
      -- Exact email match first, then usable accounts, then the most recently changed.
      ORDER BY (LOWER(TRIM(email)) = LOWER($1)) DESC,
               COALESCE(is_active, true) DESC,
               (to_jsonb(users) ->> 'updated_at') DESC NULLS LAST
      LIMIT 5`,
    [loginId]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // The account whose password matches. Disabled / unapproved state is only
  // reported once the password is right, so the reply reveals nothing to
  // someone guessing.
  let user = null;
  let matched = null;
  for (const row of result.rows) {
    const check = await verifyPassword(password, row.password_value);
    if (check.ok) { user = row; matched = check.matched; break; }
  }

  if (!user) {
    if (result.rows.every(r => !r.password_value)) {
      return res.status(401).json({ error: 'Password not set. Please reset your password.' });
    }
    if (result.rows.length > 1) {
      console.warn(`Login refused: ${result.rows.length} accounts share one identifier and none matched (ids ${result.rows.map(r => r.id).join(', ')})`);
    }
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is disabled' });
  }

  if (!user.is_approved) {
    return res.status(403).json({ error: 'Account pending approval' });
  }

  // Legacy plaintext password: hash it now that it is confirmed.
  if (!isBcryptHash(user.password_value)) {
    try {
      const hashedPassword = await bcrypt.hash(matched, 12);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashedPassword, user.id]);
      console.log('Auto-hashed plaintext password for a user during login');
    } catch (hashErr) {
      console.error('Failed to auto-hash password:', hashErr.message);
    }
  }

  // Record the sign-in. This only touched updated_at, so users.last_login —
  // what the Admin page shows — was never set and almost everyone read "Never".
  try {
    await query('UPDATE users SET last_login = NOW(), last_seen_at = NOW() WHERE id = $1', [user.id]);
  } catch (e) {
    try { await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]); }
    catch (e2) { console.warn('Could not record last_login:', e2.message); }
  }

  // Build full name from available fields
  const fullName = user.full_name || user.email;

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: fullName
  });

  console.log('Login success for:', user.email, 'id:', user.id, 'role:', user.role);

  res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: fullName,
      // After an admin reset the temporary password must be replaced; the app
      // shows its change-password screen when this is true. It was never sent,
      // so that screen never appeared.
      mustChangePassword: !!user.must_change_password,
    }
  });
}
