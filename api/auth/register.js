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
  const { username, password, email, fullName, role = 'house_officer' } = req.body;

  if (!username || !password || !email || !fullName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if username exists
  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  // Check if email exists
  const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingEmail.rows.length > 0) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active)
     VALUES ($1, $2, $3, $4, $5, false, true)
     RETURNING id, username, email, full_name, role`,
    [username, passwordHash, email, fullName, role]
  );

  res.status(201).json({
    message: 'Registration successful. Awaiting admin approval.',
    user: result.rows[0]
  });
}
