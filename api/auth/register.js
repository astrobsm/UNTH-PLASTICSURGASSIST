// Register endpoint for Vercel serverless
import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';
import { cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    return await handleRegister(req, res);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleRegister(req, res) {
  // Support both naming conventions from different clients
  const {
    password,
    email,
    fullName,
    full_name,
    role = 'house_officer',
    department,
    specialization,
    license_number,
    phone
  } = req.body || {};

  // Use full_name or fullName (frontend sends full_name)
  const finalFullName = full_name || fullName;

  if (!password || !email || !finalFullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  // Check if email exists within this app (tolerate missing app_id column)
  let existing;
  try {
    existing = await query(
      "SELECT id FROM users WHERE email = $1 AND (app_id = 'psa' OR app_id IS NULL)",
      [email]
    );
  } catch {
    existing = await query("SELECT id FROM users WHERE email = $1", [email]);
  }
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // ── Build INSERT dynamically against the actual users-table schema ──
  // The production DB uses `password_hash`; the legacy local schema uses
  // `password`. Optional columns (department/phone/etc.) may or may not
  // exist depending on which migrations have been run. Discover the real
  // columns first so we never reference a non-existent one.
  let columnSet = new Set();
  try {
    const colRes = await query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    );
    columnSet = new Set(colRes.rows.map(r => r.column_name));
  } catch (introspectErr) {
    console.warn('Could not introspect users columns, falling back to minimal insert:', introspectErr.message);
  }

  const cols = ['email'];
  const vals = [email];

  if (columnSet.has('password_hash')) {
    cols.push('password_hash'); vals.push(passwordHash);
  } else if (columnSet.has('password')) {
    cols.push('password'); vals.push(passwordHash);
  } else {
    // No introspection succeeded — try password_hash first, error path retries with password
    cols.push('password_hash'); vals.push(passwordHash);
  }

  cols.push('full_name'); vals.push(finalFullName);
  cols.push('role'); vals.push(role);

  if ((!columnSet.size || columnSet.has('phone')) && phone) {
    cols.push('phone'); vals.push(phone);
  }
  if ((!columnSet.size || columnSet.has('department')) && department) {
    cols.push('department'); vals.push(department);
  }
  if ((!columnSet.size || columnSet.has('specialization')) && specialization) {
    cols.push('specialization'); vals.push(specialization);
  }
  if ((!columnSet.size || columnSet.has('license_number')) && license_number) {
    cols.push('license_number'); vals.push(license_number);
  }
  if (!columnSet.size || columnSet.has('is_approved')) {
    cols.push('is_approved'); vals.push(false);
  }
  if (!columnSet.size || columnSet.has('is_active')) {
    cols.push('is_active'); vals.push(true);
  }
  if (!columnSet.size || columnSet.has('app_id')) {
    cols.push('app_id'); vals.push('psa');
  }

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO users (${cols.join(', ')})
               VALUES (${placeholders})
               RETURNING id, email, full_name, role, COALESCE(is_approved, false) as is_approved`;

  let result;
  try {
    result = await query(sql, vals);
  } catch (insertErr) {
    // Fallback: retry with the minimal universally-present column set.
    // This covers cases where introspection misled us (e.g. permissions).
    console.warn('Primary register INSERT failed, retrying minimal:', insertErr.message);
    const fbCols = ['email', 'password_hash', 'full_name', 'role'];
    const fbVals = [email, passwordHash, finalFullName, role];
    const fbPh = fbVals.map((_, i) => `$${i + 1}`).join(', ');
    try {
      result = await query(
        `INSERT INTO users (${fbCols.join(', ')}) VALUES (${fbPh})
         RETURNING id, email, full_name, role`,
        fbVals
      );
    } catch (fb1Err) {
      // Last resort: legacy schema with `password` column
      console.warn('Minimal register INSERT failed, retrying with legacy `password` column:', fb1Err.message);
      result = await query(
        `INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4)
         RETURNING id, email, full_name, role`,
        [email, passwordHash, finalFullName, role]
      );
    }
  }

  res.status(201).json({
    message: 'Registration successful. Awaiting admin approval.',
    user: result.rows[0]
  });
}
