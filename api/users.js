// Users/Admin API endpoint for Vercel serverless
import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/users', '').split('/').filter(Boolean);
  const userId = pathParts[0];
  const action = pathParts[1];

  try {
    switch (method) {
      case 'GET':
        if (userId) {
          return await getUser(userId, res);
        }
        return await getAllUsers(url.searchParams, auth.user, res);
      case 'POST':
        return await createUser(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!userId) {
          return res.status(400).json({ error: 'User ID required' });
        }
        if (action === 'approve') {
          return await approveUser(userId, auth.user, res);
        }
        if (action === 'password') {
          return await changePassword(userId, req.body, auth.user, res);
        }
        return await updateUser(userId, req.body, auth.user, res);
      case 'DELETE':
        if (!userId) {
          return res.status(400).json({ error: 'User ID required' });
        }
        return await deleteUser(userId, auth.user, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Users API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllUsers(searchParams, currentUser, res) {
  // Only admins can list all users
  if (!['super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await query(
    `SELECT id, username, email, full_name, role, is_approved, is_active, created_at, last_login
     FROM users ORDER BY created_at DESC`
  );

  res.status(200).json({ users: result.rows });
}

async function getUser(id, res) {
  const result = await query(
    `SELECT id, username, email, full_name, role, is_approved, is_active, created_at, last_login
     FROM users WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ user: result.rows[0] });
}

async function createUser(data, currentUser, res) {
  if (!['super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { username, password, email, fullName, role = 'intern' } = data;

  if (!username || !password || !email || !fullName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Username already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active)
     VALUES ($1, $2, $3, $4, $5, true, true)
     RETURNING id, username, email, full_name, role, is_approved, is_active`,
    [username, passwordHash, email, fullName, role]
  );

  res.status(201).json({ user: result.rows[0] });
}

async function updateUser(id, data, currentUser, res) {
  // Users can update themselves, admins can update anyone
  if (currentUser.id !== parseInt(id) && !['super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = ['email', 'full_name'];
  if (['super_admin', 'consultant'].includes(currentUser.role)) {
    allowedFields.push('role', 'is_active', 'is_approved');
  }

  const fieldMap = {
    email: 'email',
    fullName: 'full_name',
    role: 'role',
    isActive: 'is_active',
    isApproved: 'is_approved'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined && allowedFields.includes(dbField)) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);

  const result = await query(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}
     RETURNING id, username, email, full_name, role, is_approved, is_active`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ user: result.rows[0] });
}

async function approveUser(id, currentUser, res) {
  if (!['super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const result = await query(
    `UPDATE users SET is_approved = true WHERE id = $1
     RETURNING id, username, email, full_name, role, is_approved, is_active`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ user: result.rows[0], message: 'User approved successfully' });
}

async function changePassword(id, data, currentUser, res) {
  // Users can change their own password, admins can change anyone's
  if (currentUser.id !== parseInt(id) && !['super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { newPassword, currentPassword } = data;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  // If changing own password, verify current password
  if (currentUser.id === parseInt(id)) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }

    const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);

  res.status(200).json({ message: 'Password changed successfully' });
}

async function deleteUser(id, currentUser, res) {
  if (!['super_admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Prevent self-deletion
  if (currentUser.id === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({ message: 'User deleted successfully' });
}
