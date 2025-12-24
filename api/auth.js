// Authentication endpoints for Vercel serverless
import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { signToken, cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  const { method } = req;
  const path = req.url.split('?')[0].replace('/api/auth', '');

  try {
    switch (method) {
      case 'POST':
        if (path === '/login' || path === '') {
          return await handleLogin(req, res);
        } else if (path === '/register') {
          return await handleRegister(req, res);
        } else if (path === '/verify') {
          return await handleVerify(req, res);
        }
        break;
      case 'GET':
        if (path === '/me') {
          return await handleGetMe(req, res);
        }
        break;
    }

    res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleLogin(req, res) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await query(
    `SELECT id, username, password_hash, role, full_name, email, is_approved, is_active 
     FROM users WHERE username = $1`,
    [username]
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
      email: user.email
    }
  });
}

async function handleRegister(req, res) {
  const { username, password, email, fullName, role = 'intern' } = req.body;

  if (!username || !password || !email || !fullName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if username exists
  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Username already exists' });
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

async function handleVerify(req, res) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }
  
  res.status(200).json({ valid: true, user: auth.user });
}

async function handleGetMe(req, res) {
  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const result = await query(
    `SELECT id, username, email, full_name, role, is_approved, is_active, created_at, last_login
     FROM users WHERE id = $1`,
    [auth.user.id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ user: result.rows[0] });
}
