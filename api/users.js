// Users/Admin API endpoint for Vercel serverless
import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

// Generate a random password
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

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
        // Check for bulk import action
        if (userId === 'bulk-import') {
          return await bulkImportUsers(req.body, auth.user, res);
        }
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
        if (action === 'force-password-change') {
          return await forcePasswordChange(userId, req.body, auth.user, res);
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
  // Debug logging
  console.log('getAllUsers called by user:', JSON.stringify(currentUser));
  
  // Only admins and consultants can list all users
  if (!['admin', 'consultant'].includes(currentUser.role)) {
    console.log('Access denied for role:', currentUser.role);
    return res.status(403).json({ error: 'Access denied', userRole: currentUser.role });
  }

  try {
    const result = await query(
      `SELECT id, username, email, full_name, role, is_approved, is_active, created_at, last_login
       FROM users ORDER BY created_at DESC`
    );

    res.status(200).json({ users: result.rows });
  } catch (dbError) {
    console.error('Database error in getAllUsers:', dbError);
    return res.status(500).json({ error: 'Database error', message: dbError.message });
  }
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
  if (!['admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { email, fullName, role = 'house_officer' } = data;

  // Only email and fullName are required now - password is auto-generated
  if (!email || !fullName) {
    return res.status(400).json({ error: 'Email and full name are required' });
  }

  // Check if email already exists
  const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existingEmail.rows.length > 0) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  // Generate username from email (part before @)
  let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Check if username already exists, append random numbers if so
  const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
  if (existingUsername.rows.length > 0) {
    username = `${username}${Math.floor(Math.random() * 1000)}`;
  }

  // Auto-generate a temporary password
  const tempPassword = generatePassword(12);
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  // Admin users don't need to change password, all others must
  const mustChangePassword = role !== 'admin';

  const result = await query(
    `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, $5, true, true, $6)
     RETURNING id, username, email, full_name, role, is_approved, is_active`,
    [username, passwordHash, email, fullName, role, mustChangePassword]
  );

  const createdUser = result.rows[0];

  // Return the user with temporary credentials for admin to distribute
  res.status(201).json({ 
    user: createdUser,
    credentials: {
      username: username,
      email: email,
      temporaryPassword: tempPassword,
      fullName: fullName,
      role: role,
      mustChangePassword: mustChangePassword
    },
    message: mustChangePassword 
      ? 'User created successfully. Share the temporary password with the user. They must change it on first login.'
      : 'Admin user created successfully.'
  });
}

async function updateUser(id, data, currentUser, res) {
  // Users can update themselves, admins can update anyone
  if (currentUser.id !== parseInt(id) && !['admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = ['email', 'full_name'];
  if (['admin', 'consultant'].includes(currentUser.role)) {
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
  if (!['admin', 'consultant'].includes(currentUser.role)) {
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
  if (currentUser.id !== parseInt(id) && !['admin', 'consultant'].includes(currentUser.role)) {
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

  // Also clear the must_change_password flag when user changes password
  await query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [passwordHash, id]);

  res.status(200).json({ message: 'Password changed successfully' });
}

async function deleteUser(id, currentUser, res) {
  if (!['admin'].includes(currentUser.role)) {
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

// Generate a random password
function generatePassword(length = 10) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let password = '';
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%'[Math.floor(Math.random() * 5)];
  
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Bulk import users with auto-generated credentials
async function bulkImportUsers(data, currentUser, res) {
  // Only admin can bulk import users
  if (!['admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators can bulk import users.' });
  }

  const { users: usersToImport } = data;

  if (!usersToImport || !Array.isArray(usersToImport) || usersToImport.length === 0) {
    return res.status(400).json({ error: 'No users provided for import. Expected array of users with fullName, email, and role.' });
  }

  const results = {
    success: [],
    failed: [],
    credentials: []
  };

  for (const userData of usersToImport) {
    try {
      const { fullName, email, role = 'house_officer', department = '' } = userData;

      if (!fullName || !email) {
        results.failed.push({
          email: email || 'N/A',
          fullName: fullName || 'N/A',
          error: 'Missing required fields: fullName and email are required'
        });
        continue;
      }

      // Generate username from email (part before @)
      let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      // Check if username already exists
      const existingUsername = await query('SELECT id FROM users WHERE username = $1', [username]);
      if (existingUsername.rows.length > 0) {
        // Append random numbers to make unique
        username = `${username}${Math.floor(Math.random() * 1000)}`;
      }

      // Check if email already exists
      const existingEmail = await query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingEmail.rows.length > 0) {
        results.failed.push({
          email,
          fullName,
          error: 'Email already exists'
        });
        continue;
      }

      // Generate a temporary password
      const tempPassword = generatePassword(12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      // Determine if user should be required to change password
      // Admin users do NOT need to change password on first login
      const mustChangePassword = role !== 'admin';

      const result = await query(
        `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, $5, true, true, $6)
         RETURNING id, username, email, full_name, role, is_approved, is_active`,
        [username, passwordHash, email, fullName, role, mustChangePassword]
      );

      const createdUser = result.rows[0];
      
      results.success.push({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        fullName: createdUser.full_name,
        role: createdUser.role
      });

      // Store credentials for download (only for admin to distribute)
      results.credentials.push({
        fullName,
        email,
        username,
        tempPassword,
        role,
        mustChangePassword
      });

    } catch (error) {
      results.failed.push({
        email: userData.email || 'N/A',
        fullName: userData.fullName || 'N/A',
        error: error.message
      });
    }
  }

  res.status(200).json({
    message: `Bulk import completed. ${results.success.length} users created, ${results.failed.length} failed.`,
    success: results.success,
    failed: results.failed,
    credentials: results.credentials
  });
}

// Force password change - used when user logs in with must_change_password flag
async function forcePasswordChange(id, data, currentUser, res) {
  // User can only change their own password via this endpoint
  if (currentUser.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { newPassword, currentPassword } = data;

  if (!newPassword || !currentPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  // Verify current password
  const userResult = await query('SELECT password_hash, must_change_password FROM users WHERE id = $1', [id]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  // Hash new password and clear the must_change_password flag
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [passwordHash, id]);

  res.status(200).json({ message: 'Password changed successfully. You can now continue using the application.' });
}
