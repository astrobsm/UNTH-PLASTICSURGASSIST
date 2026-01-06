// Login endpoint for Vercel serverless
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

  // Try to find user by username OR email (include must_change_password)
  const result = await query(
    `SELECT id, username, password_hash, role, full_name, email, is_approved, is_active, COALESCE(must_change_password, FALSE) as must_change_password 
     FROM users WHERE username = $1 OR email = $1`,
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

  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Update last login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const token = signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.full_name
  });

  res.status(200).json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.full_name,
      email: user.email,
      mustChangePassword: user.must_change_password
    }
  });
}
