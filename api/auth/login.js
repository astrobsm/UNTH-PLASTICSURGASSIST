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

  // Try to find user by email - check both password columns, handle NULL is_approved
  const result = await query(
    `SELECT id, email, COALESCE(password_hash, password) as password_value, 
            role, full_name, first_name, last_name, 
            COALESCE(is_approved, true) as is_approved, 
            COALESCE(is_active, true) as is_active
     FROM users WHERE email = $1`,
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

  const validPassword = await bcrypt.compare(password, user.password_value);
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
  const fullName = user.full_name || 
    (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : user.email);

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
