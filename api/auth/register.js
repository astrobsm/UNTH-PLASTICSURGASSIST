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
    username, 
    password, 
    email, 
    fullName, 
    full_name,
    role = 'house_officer',
    department,
    specialization,
    license_number,
    phone
  } = req.body;

  // Use full_name or fullName (frontend sends full_name)
  const finalFullName = full_name || fullName;

  if (!password || !email || !finalFullName) {
    return res.status(400).json({ error: 'Email, password, and full name are required' });
  }

  // Check if email exists
  const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (email, password, full_name, role, department, specialization, license_number, phone, is_approved, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true)
     RETURNING id, email, full_name, role, department, license_number, phone, is_approved`,
    [email, passwordHash, finalFullName, role, department || null, specialization || null, license_number || null, phone || null]
  );

  res.status(201).json({
    message: 'Registration successful. Awaiting admin approval.',
    user: result.rows[0]
  });
}
