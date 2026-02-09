// Login endpoint for Vercel serverless (explicit /api/auth/login route)
import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';
import { signToken, cors } from '../_lib/auth.js';

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
  const { username, email, password } = req.body;
  const loginId = username || email; // Accept either username or email

  if (!loginId || !password) {
    return res.status(400).json({ error: 'Username/email and password are required' });
  }

  // Try to find user by email - filter by app_id='psa' to isolate from other apps sharing this DB
  // Use password_hash only (password column may not exist in all DB schemas)
  const result = await query(
    `SELECT id, email, password_hash as password_value, 
            role, full_name, 
            COALESCE(is_approved, true) as is_approved, 
            COALESCE(is_active, true) as is_active
     FROM users WHERE email = $1 AND (app_id = 'psa' OR app_id IS NULL)`,
    [loginId]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = result.rows[0];

  if (!user.is_active) {
    return res.status(403).json({ error: 'Account is disabled' });
  }

  if (!user.is_approved) {
    return res.status(403).json({ error: 'Account pending approval' });
  }

  // Check password
  if (!user.password_value) {
    return res.status(401).json({ error: 'Password not set. Please reset your password.' });
  }

  let validPassword = false;
  const isBcryptHash = user.password_value && (user.password_value.startsWith('$2a$') || user.password_value.startsWith('$2b$'));

  if (isBcryptHash) {
    // Password is hashed — compare with bcrypt
    validPassword = await bcrypt.compare(password, user.password_value);
  } else if (user.password_value) {
    // Password is stored as plaintext — direct comparison
    validPassword = (password === user.password_value);

    // Auto-hash the plaintext password for security
    if (validPassword) {
      try {
        const hashedPassword = await bcrypt.hash(password, 12);
        await query(
          'UPDATE users SET password_hash = $1 WHERE id = $2',
          [hashedPassword, user.id]
        );
        console.log(`Auto-hashed plaintext password for user ${user.email}`);
      } catch (hashErr) {
        console.error('Failed to auto-hash password:', hashErr.message);
      }
    }
  }

  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  try {
    await query('UPDATE users SET updated_at = NOW() WHERE id = $1', [user.id]);
  } catch (e) {
    // Ignore
  }

  // Build full name from available fields
  const fullName = user.full_name || user.email;

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: fullName
  });

  res.status(200).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: fullName
    }
  });
}
