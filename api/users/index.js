// Users/Admin API endpoint for Vercel serverless
import bcrypt from 'bcryptjs';
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

// Ensure phone column exists on users table
async function ensurePhoneColumn() {
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`);
  } catch (e) {
    // Column may already exist or table not yet created — ignore
  }
}

// Generate a random password with at least one of each type
function generatePassword(length = 12) {
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

/**
 * Auto-assign patients to a newly created/approved medical staff member
 * Distributes patients evenly by assigning unassigned or least-loaded patients
 */
async function assignPatientsToNewUser(userId, userRole, userName) {
  try {
    // Only assign patients to medical staff roles
    const medicalRoles = ['consultant', 'senior_registrar', 'registrar', 'house_officer'];
    if (!medicalRoles.includes(userRole)) {
      console.log(`User role ${userRole} does not require patient assignment`);
      return { assigned: 0, message: 'Not a medical staff role' };
    }

    // Get all active patients
    const patientsResult = await query(
      `SELECT id, hospital_number, first_name, last_name 
       FROM patients 
       WHERE deleted IS NOT TRUE 
       ORDER BY created_at DESC 
       LIMIT 100`
    );

    if (patientsResult.rows.length === 0) {
      console.log('No patients available for assignment');
      return { assigned: 0, message: 'No patients available' };
    }

    // Create patient_assignments table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS patient_assignments (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(255) NOT NULL,
        hospital_number VARCHAR(100),
        consultant_id VARCHAR(50),
        senior_registrar_id VARCHAR(50),
        registrar_id VARCHAR(50),
        house_officer_id VARCHAR(50),
        admission_type VARCHAR(50),
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(patient_id)
      )
    `);

    let assignedCount = 0;
    const roleColumnMap = {
      'consultant': 'consultant_id',
      'senior_registrar': 'senior_registrar_id',
      'registrar': 'registrar_id',
      'house_officer': 'house_officer_id'
    };

    const roleColumn = roleColumnMap[userRole];
    if (!roleColumn) {
      console.log(`Unknown role: ${userRole}`);
      return { assigned: 0, message: 'Unknown role' };
    }

    // Get all active staff of the same role
    const staffResult = await query(
      `SELECT id FROM users 
       WHERE role = $1 AND is_active = TRUE AND is_approved = TRUE`,
      [userRole]
    );

    const totalStaff = staffResult.rows.length;
    if (totalStaff === 0) {
      console.log(`No active staff found for role ${userRole}`);
      return { assigned: 0, message: 'No active staff' };
    }

    // Calculate how many patients this new user should get
    // Distribute evenly among all staff (including the new one)
    const targetPatientsPerStaff = Math.ceil(patientsResult.rows.length / totalStaff);

    for (const patient of patientsResult.rows) {
      if (assignedCount >= targetPatientsPerStaff) {
        break; // Stop when we've assigned enough patients to this user
      }

      try {
        // Use ON CONFLICT to atomically assign — avoids race conditions
        const result = await query(
          `INSERT INTO patient_assignments (patient_id, hospital_number, ${roleColumn}, is_active) 
           VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (patient_id) DO UPDATE 
           SET ${roleColumn} = COALESCE(patient_assignments.${roleColumn}, EXCLUDED.${roleColumn})
           RETURNING (xmax = 0) AS inserted, ${roleColumn}`,
          [patient.id, patient.hospital_number, userId]
        );
        
        if (result.rows.length > 0) {
          const row = result.rows[0];
          // Count if we actually assigned (new row or previously null role)
          if (row.inserted || row[roleColumn] === userId) {
            assignedCount++;
            console.log(`✅ Assigned patient ${patient.hospital_number} to ${userName} (${userRole})`);
          }
        }
      } catch (error) {
        console.error(`Failed to assign patient ${patient.id}:`, error);
        continue;
      }
    }

    console.log(`📊 Assigned ${assignedCount} patients to ${userName} (${userRole})`);
    return { assigned: assignedCount, message: `Successfully assigned ${assignedCount} patients` };
  } catch (error) {
    console.error('Error in assignPatientsToNewUser:', error);
    return { assigned: 0, error: error.message };
  }
}

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    await ensurePhoneColumn();

    const { method } = req;
    
    // Safe URL parsing
    const urlPath = (req.url || '').split('?')[0];
    const pathParts = urlPath.replace('/api/users', '').split('/').filter(Boolean);
    
    const userId = pathParts[0];
    const action = pathParts[1];

    switch (method) {
      case 'GET':
        if (userId) {
          return await getUser(userId, res);
        }
        return await getAllUsers(auth.user, res, req);
      case 'POST':
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
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message
    });
  }
}

async function getAllUsers(currentUser, res, req) {
  // All authenticated users can view the staff directory (read-only)
  // Write operations (create, update, delete) have their own admin checks

  // Support ?active_only=true to exclude deactivated users
  const url = new URL(req.url || '', `http://${req.headers?.host || 'localhost'}`);
  const activeOnly = url.searchParams.get('active_only') === 'true';

  const sqlQuery = activeOnly
    ? `SELECT id, username, email, full_name, role, phone, is_approved, is_active, created_at, last_login
       FROM users WHERE (app_id = 'psa' OR app_id IS NULL) AND is_active = true AND is_approved = true ORDER BY created_at DESC`
    : `SELECT id, username, email, full_name, role, phone, is_approved, is_active, created_at, last_login
       FROM users WHERE (app_id = 'psa' OR app_id IS NULL) ORDER BY created_at DESC`;

  const result = await query(sqlQuery);

  return res.status(200).json({ users: result.rows });
}

async function getUser(id, res) {
  const result = await query(
    `SELECT id, username, email, full_name, role, phone, is_approved, is_active, created_at, last_login
     FROM users WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user: result.rows[0] });
}

async function createUser(data, currentUser, res) {
  if (!['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { email, fullName, role = 'house_officer', phone } = data;

  if (!email || !fullName) {
    return res.status(400).json({ error: 'Email and full name are required' });
  }

  // Check if email already exists within this app
  const existingEmail = await query("SELECT id FROM users WHERE email = $1 AND (app_id = 'psa' OR app_id IS NULL)", [email]);
  if (existingEmail.rows.length > 0) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  // Generate username from email
  let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Check if username already exists
  const existingUsername = await query("SELECT id FROM users WHERE username = $1 AND (app_id = 'psa' OR app_id IS NULL)", [username]);
  if (existingUsername.rows.length > 0) {
    username = `${username}${Math.floor(Math.random() * 1000)}`;
  }

  // Auto-generate a temporary password
  const tempPassword = generatePassword(12);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const mustChangePassword = role !== 'admin';

  const result = await query(
    `INSERT INTO users (username, password_hash, email, full_name, role, phone, is_approved, is_active, must_change_password, app_id)
     VALUES ($1, $2, $3, $4, $5, $6, true, true, $7, 'psa')
     RETURNING id, username, email, full_name, role, phone, is_approved, is_active`,
    [username, passwordHash, email, fullName, role, phone || null, mustChangePassword]
  );

  const createdUser = result.rows[0];

  // Auto-assign patients to the new medical staff member
  const assignmentResult = await assignPatientsToNewUser(
    createdUser.id.toString(),
    createdUser.role,
    createdUser.full_name
  );

  return res.status(201).json({ 
    user: createdUser,
    credentials: {
      username: username,
      email: email,
      temporaryPassword: tempPassword,
      fullName: fullName,
      role: role,
      mustChangePassword: mustChangePassword
    },
    patientAssignment: assignmentResult,
    message: mustChangePassword 
      ? `User created successfully. ${assignmentResult.assigned} patients assigned. Share the temporary password with the user. They must change it on first login.`
      : `Admin user created successfully. ${assignmentResult.assigned} patients assigned.`
  });
}

async function updateUser(id, data, currentUser, res) {
  if (currentUser.id !== parseInt(id) && !['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = ['email', 'full_name', 'phone'];
  if (['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    allowedFields.push('role', 'is_active', 'is_approved');
  }

  const fieldMap = {
    email: 'email',
    fullName: 'full_name',
    phone: 'phone',
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
     RETURNING id, username, email, full_name, role, phone, is_approved, is_active`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user: result.rows[0] });
}

async function approveUser(id, currentUser, res) {
  if (!['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
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

  const approvedUser = result.rows[0];

  // Auto-assign patients to the newly approved medical staff member
  const assignmentResult = await assignPatientsToNewUser(
    approvedUser.id.toString(),
    approvedUser.role,
    approvedUser.full_name
  );

  return res.status(200).json({ 
    user: approvedUser, 
    patientAssignment: assignmentResult,
    message: `User approved successfully. ${assignmentResult.assigned} patients assigned.`
  });
}

async function changePassword(id, data, currentUser, res) {
  if (currentUser.id !== parseInt(id) && !['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
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
  await query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [passwordHash, id]);

  return res.status(200).json({ message: 'Password changed successfully' });
}

async function deleteUser(id, currentUser, res) {
  if (!['admin', 'super_admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (currentUser.id === parseInt(id)) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ message: 'User deleted successfully' });
}

async function bulkImportUsers(data, currentUser, res) {
  if (!['admin', 'super_admin'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied. Only administrators can bulk import users.' });
  }

  const { users: usersToImport } = data;

  if (!usersToImport || !Array.isArray(usersToImport) || usersToImport.length === 0) {
    return res.status(400).json({ error: 'No users provided for import.' });
  }

  const results = {
    success: [],
    failed: [],
    credentials: []
  };

  for (const userData of usersToImport) {
    try {
      const { fullName, email, role = 'house_officer' } = userData;

      if (!fullName || !email) {
        results.failed.push({ email: email || 'N/A', fullName: fullName || 'N/A', error: 'Missing required fields' });
        continue;
      }

      let username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const existingUsername = await query("SELECT id FROM users WHERE username = $1 AND (app_id = 'psa' OR app_id IS NULL)", [username]);
      if (existingUsername.rows.length > 0) {
        username = `${username}${Math.floor(Math.random() * 1000)}`;
      }

      const existingEmail = await query("SELECT id FROM users WHERE email = $1 AND (app_id = 'psa' OR app_id IS NULL)", [email]);
      if (existingEmail.rows.length > 0) {
        results.failed.push({ email, fullName, error: 'Email already exists' });
        continue;
      }

      const tempPassword = generatePassword(12);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const mustChangePassword = role !== 'admin';

      const result = await query(
        `INSERT INTO users (username, password_hash, email, full_name, role, is_approved, is_active, must_change_password, app_id)
         VALUES ($1, $2, $3, $4, $5, true, true, $6, 'psa')
         RETURNING id, username, email, full_name, role`,
        [username, passwordHash, email, fullName, role, mustChangePassword]
      );

      const createdUser = result.rows[0];
      
      // Auto-assign patients to the new medical staff member
      const assignmentResult = await assignPatientsToNewUser(
        createdUser.id.toString(),
        createdUser.role,
        createdUser.full_name
      );
      
      results.success.push({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        fullName: createdUser.full_name,
        role: createdUser.role,
        patientsAssigned: assignmentResult.assigned
      });

      results.credentials.push({
        fullName, email, username, tempPassword, role, mustChangePassword
      });

    } catch (error) {
      results.failed.push({ email: userData.email || 'N/A', fullName: userData.fullName || 'N/A', error: error.message });
    }
  }

  return res.status(200).json({
    message: `Bulk import completed. ${results.success.length} users created, ${results.failed.length} failed.`,
    success: results.success,
    failed: results.failed,
    credentials: results.credentials
  });
}

async function forcePasswordChange(id, data, currentUser, res) {
  if (currentUser.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { newPassword, currentPassword } = data;

  if (!newPassword || !currentPassword) {
    return res.status(400).json({ error: 'Current password and new password are required' });
  }

  const userResult = await query('SELECT password_hash FROM users WHERE id = $1', [id]);
  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  const validPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2', [passwordHash, id]);

  return res.status(200).json({ message: 'Password changed successfully.' });
}
