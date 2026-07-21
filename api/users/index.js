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
    const medicalRoles = ['consultant', 'senior_registrar', 'registrar', 'junior_registrar', 'house_officer'];
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
      'junior_registrar': 'registrar_id',
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

// Map a user role to a rotation level + expected duration (days).
// Only trainee roles get a rotation; non-trainees (admin/consultant) return null.
function rotationPlanForRole(role) {
  switch (role) {
    case 'house_officer':
    case 'intern':
      return { level: 'house_officer', durationDays: 30 };
    case 'junior_registrar':
    case 'registrar':
      return { level: 'junior_resident', durationDays: 90 };
    case 'senior_registrar':
      return { level: 'senior_resident', durationDays: 180 };
    default:
      return null; // consultant, admin, super_admin, student — no auto rotation
  }
}

// Ensure the trainee_rotations table exists (self-healing, idempotent).
async function ensureTraineeRotationsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS trainee_rotations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        level VARCHAR(50) NOT NULL,
        department VARCHAR(255) DEFAULT 'Plastic Surgery',
        start_date DATE NOT NULL,
        expected_end_date DATE NOT NULL,
        actual_end_date DATE,
        status VARCHAR(50) DEFAULT 'active',
        extension_count INTEGER DEFAULT 0,
        extension_reasons JSONB DEFAULT '[]',
        sign_out_approved BOOLEAN DEFAULT FALSE,
        sign_out_approved_by INTEGER,
        sign_out_approved_at TIMESTAMP,
        sign_out_comments TEXT,
        self_assessment JSONB,
        supervisor_feedback JSONB,
        final_score DECIMAL(5,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    console.warn('ensureTraineeRotationsTable:', e.message);
  }
}

/**
 * Auto-start a rotation for a newly created/approved trainee so their CBT,
 * duties, CME and patient-care metrics are captured from day one. Idempotent:
 * skips if the user is not a trainee role or already has an active rotation.
 */
async function ensureTraineeRotation(userId, role) {
  try {
    const plan = rotationPlanForRole(role);
    if (!plan) return { started: false, reason: 'Not a trainee role' };

    await ensureTraineeRotationsTable();

    const existing = await query(
      `SELECT id FROM trainee_rotations
       WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')`,
      [userId]
    );
    if (existing.rows.length > 0) {
      return { started: false, reason: 'Active rotation already exists' };
    }

    const inserted = await query(
      `INSERT INTO trainee_rotations (user_id, level, start_date, expected_end_date, status)
       VALUES ($1, $2, CURRENT_DATE, CURRENT_DATE + ($3::int * INTERVAL '1 day'), 'active')
       RETURNING id, level, start_date, expected_end_date, status`,
      [userId, plan.level, plan.durationDays]
    );
    return { started: true, rotation: inserted.rows[0] };
  } catch (error) {
    console.error('ensureTraineeRotation error:', error.message);
    return { started: false, error: error.message };
  }
}

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    // ── PUBLIC: self-service password reset request (no auth — user is locked out) ──
    {
      const p = (req.url || '').split('?')[0].replace('/api/users', '').split('/').filter(Boolean);
      if (req.method === 'POST' && p[0] === 'reset-request') {
        return await createResetRequest(req.body, res);
      }
    }

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
        if (userId === 'reset-requests') {
          return await getResetRequests(auth.user, res);
        }
        if (userId) {
          return await getUser(userId, res);
        }
        return await getAllUsers(auth.user, res, req);
      case 'POST':
        if (userId === 'bulk-import') {
          return await bulkImportUsers(req.body, auth.user, res);
        }
        if (userId === 'distribute-patients') {
          return await distributePatientsToHOs(req.body, auth.user, res);
        }
        if (action === 'reset-password') {
          return await adminResetPassword(userId, auth.user, res);
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

/**
 * Distribute currently-admitted patients evenly across the active house officers
 * (round-robin), setting patient_assignments.house_officer_id. Optionally include
 * all patients (not just admitted) via body.scope === 'all'. Admin only.
 */
async function distributePatientsToHOs(body, currentUser, res) {
  if (!['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const scope = (body && body.scope) || 'admitted'; // 'admitted' | 'all'

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

  const hos = await query(
    `SELECT id, full_name FROM users
     WHERE role IN ('house_officer', 'intern') AND is_active = TRUE AND is_approved = TRUE
     ORDER BY full_name`
  );
  if (hos.rows.length === 0) {
    return res.status(400).json({ error: 'No active house officers to assign to.' });
  }

  let patients;
  if (scope === 'all') {
    patients = await query(`SELECT id, hospital_number FROM patients ORDER BY created_at DESC`);
  } else {
    patients = await query(
      `SELECT DISTINCT p.id, p.hospital_number
       FROM admissions a JOIN patients p ON p.id::text = a.patient_id::text
       WHERE a.status IN ('active', 'admitted')
       ORDER BY p.id`
    );
  }
  if (patients.rows.length === 0) {
    return res.status(200).json({ assigned: 0, message: 'No matching patients to distribute.' });
  }

  let assigned = 0;
  const perHO = {};
  for (let i = 0; i < patients.rows.length; i++) {
    const p = patients.rows[i];
    const ho = hos.rows[i % hos.rows.length];
    try {
      await query(
        `INSERT INTO patient_assignments (patient_id, hospital_number, house_officer_id, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (patient_id) DO UPDATE
           SET house_officer_id = EXCLUDED.house_officer_id, is_active = TRUE, assigned_at = CURRENT_TIMESTAMP`,
        [String(p.id), p.hospital_number, String(ho.id)]
      );
      assigned++;
      perHO[ho.full_name] = (perHO[ho.full_name] || 0) + 1;
    } catch (e) {
      console.warn('distribute assign skip:', e.message);
    }
  }

  return res.status(200).json({
    assigned,
    scope,
    houseOfficers: hos.rows.length,
    breakdown: perHO,
    message: `Distributed ${assigned} ${scope} patient(s) across ${hos.rows.length} active house officer(s).`,
  });
}

// ── Password reset ──────────────────────────────────────────────────────────
async function ensureResetRequestsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        user_id INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(180)
      )
    `);
  } catch (e) { console.warn('ensureResetRequestsTable:', e.message); }
}

// PUBLIC: a locked-out user requests a password reset. Always returns a generic
// success so we never reveal whether an email is registered.
async function createResetRequest(body, res) {
  const email = (body?.email || '').trim().toLowerCase();
  const generic = { message: 'If that account exists, a reset request has been sent to the administrators.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(200).json(generic);
  }
  try {
    await ensureResetRequestsTable();
    const u = await query(
      "SELECT id FROM users WHERE LOWER(email) = $1 AND (app_id = 'psa' OR app_id IS NULL)", [email]
    );
    const userId = u.rows[0]?.id || null;
    const existing = await query(
      "SELECT id FROM password_reset_requests WHERE LOWER(email) = $1 AND status = 'pending'", [email]
    );
    if (existing.rows.length === 0) {
      await query(
        "INSERT INTO password_reset_requests (email, user_id, status) VALUES ($1, $2, 'pending')",
        [email, userId]
      );
    }
  } catch (e) { console.warn('createResetRequest:', e.message); }
  return res.status(200).json(generic);
}

// ADMIN: list pending reset requests (enriched with the user's name/role).
async function getResetRequests(currentUser, res) {
  if (!['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  await ensureResetRequestsTable();
  const r = await query(`
    SELECT prr.id, prr.email, prr.user_id, prr.status, prr.requested_at,
           u.full_name, u.username, u.role
    FROM password_reset_requests prr
    LEFT JOIN users u ON u.id = prr.user_id
    WHERE prr.status = 'pending'
    ORDER BY prr.requested_at DESC
  `);
  return res.status(200).json({ requests: r.rows });
}

// ADMIN: reset a user's password to a fresh temporary one (forces change on next
// login) and resolve any pending reset requests for them.
async function adminResetPassword(id, currentUser, res) {
  if (!['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const userRes = await query(
    "SELECT id, username, email, full_name, role FROM users WHERE id = $1 AND (app_id = 'psa' OR app_id IS NULL)",
    [id]
  );
  if (userRes.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  const target = userRes.rows[0];
  const tempPassword = generatePassword(12);
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await query(
    'UPDATE users SET password_hash = $1, must_change_password = TRUE, is_active = TRUE WHERE id = $2',
    [passwordHash, id]
  );
  try {
    await ensureResetRequestsTable();
    await query(
      "UPDATE password_reset_requests SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = $2 WHERE (user_id = $1 OR LOWER(email) = LOWER($3)) AND status = 'pending'",
      [id, currentUser.fullName || currentUser.email || 'admin', target.email]
    );
  } catch { /* non-fatal */ }

  return res.status(200).json({
    message: `Password reset for ${target.full_name}. Share the temporary password; they must change it on first login.`,
    user: { id: target.id, username: target.username, email: target.email, fullName: target.full_name, role: target.role },
    temporaryPassword: tempPassword,
  });
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

  // Auto-start a rotation so trainee performance is tracked from day one
  const rotationResult = await ensureTraineeRotation(createdUser.id, createdUser.role);

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
    rotation: rotationResult,
    message: mustChangePassword 
      ? `User created successfully. ${assignmentResult.assigned} patients assigned.${rotationResult.started ? ' Rotation started.' : ''} Share the temporary password with the user. They must change it on first login.`
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
  // Privilege fields are never self-editable. Without the isSelfEdit guard a
  // consultant editing their OWN record passed the ownership check above and
  // then landed in this branch, so `PUT /api/users/<own id> {"role":"admin"}`
  // was a straight self-escalation to admin.
  const isSelfEdit = parseInt(id, 10) === currentUser.id;
  if (!isSelfEdit && ['admin', 'super_admin', 'consultant'].includes(currentUser.role)) {
    allowedFields.push('role', 'is_active', 'is_approved');
  }

  // Only administrators may set a role at all, and only to a known value.
  // Unvalidated roles ("wizard") silently drop the user out of every
  // `role IN (...)` staff query — they vanish from rosters and assignment.
  const VALID_ROLES = [
    'admin', 'super_admin', 'consultant', 'senior_registrar',
    'registrar', 'junior_registrar', 'house_officer',
  ];
  if (data.role !== undefined) {
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Only administrators may change a user\'s role' });
    }
    if (!VALID_ROLES.includes(data.role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }
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

  // Auto-start a rotation so trainee performance is tracked from approval
  const rotationResult = await ensureTraineeRotation(approvedUser.id, approvedUser.role);

  return res.status(200).json({ 
    user: approvedUser, 
    patientAssignment: assignmentResult,
    rotation: rotationResult,
    message: `User approved successfully. ${assignmentResult.assigned} patients assigned.${rotationResult.started ? ' Rotation started.' : ''}`
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

      // Auto-start a rotation so trainee performance is tracked from day one
      const rotationResult = await ensureTraineeRotation(createdUser.id, createdUser.role);
      
      results.success.push({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
        fullName: createdUser.full_name,
        role: createdUser.role,
        patientsAssigned: assignmentResult.assigned,
        rotationStarted: !!rotationResult.started
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
