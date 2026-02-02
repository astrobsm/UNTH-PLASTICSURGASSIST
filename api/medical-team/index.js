// Medical Team API endpoint for Vercel serverless
// Provides medical staff list by role with workload for auto-assignment
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    const { method } = req;
    const urlPath = (req.url || '').split('?')[0];
    const pathParts = urlPath.replace('/api/medical-team', '').split('/').filter(Boolean);

    switch (method) {
      case 'GET':
        if (pathParts[0] === 'by-role') {
          return await getStaffByRole(req, res);
        }
        if (pathParts[0] === 'workload') {
          return await getTeamWorkload(res);
        }
        if (pathParts[0] === 'suggest-assignment') {
          return await suggestTeamAssignment(res);
        }
        if (pathParts[0] === 'activities') {
          return await getTeamActivities(req, res);
        }
        if (pathParts[0] === 'analytics') {
          return await getTeamAnalytics(req, res);
        }
        return await getAllMedicalStaff(res);
      case 'POST':
        if (pathParts[0] === 'log-activity') {
          return await logTeamActivity(req.body, auth.user, res);
        }
        return res.status(400).json({ error: 'Invalid endpoint' });
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Medical Team API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message
    });
  }
}

/**
 * Get all active medical staff organized by role
 */
async function getAllMedicalStaff(res) {
  const result = await query(
    `SELECT id, username, email, full_name, role, is_active, created_at
     FROM users 
     WHERE role IN ('consultant', 'senior_registrar', 'registrar', 'house_officer')
       AND is_approved = TRUE 
       AND is_active = TRUE
     ORDER BY role, full_name`
  );

  // Organize by role
  const byRole = {
    consultant: [],
    senior_registrar: [],
    registrar: [],
    house_officer: []
  };

  for (const user of result.rows) {
    if (byRole[user.role]) {
      byRole[user.role].push(user);
    }
  }

  return res.status(200).json({ 
    staff: result.rows,
    byRole 
  });
}

/**
 * Get staff filtered by role with workload count
 */
async function getStaffByRole(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');

  if (!role) {
    return res.status(400).json({ error: 'Role parameter required' });
  }

  const roleColumnMap = {
    'consultant': 'consultant_id',
    'senior_registrar': 'senior_registrar_id',
    'registrar': 'registrar_id',
    'house_officer': 'house_officer_id'
  };

  const roleColumn = roleColumnMap[role];
  if (!roleColumn) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    // Ensure patient_assignments table exists
    await ensurePatientAssignmentsTable();

    // Get staff with their current patient count
    const staffResult = await query(
      `SELECT u.id, u.full_name, u.email, u.role,
              COALESCE(pa.patient_count, 0) as current_patients
       FROM users u
       LEFT JOIN (
         SELECT ${roleColumn}::text as user_id, COUNT(*) as patient_count
         FROM patient_assignments
         WHERE is_active = TRUE AND ${roleColumn} IS NOT NULL
         GROUP BY ${roleColumn}
       ) pa ON u.id::text = pa.user_id
       WHERE u.role = $1 
         AND u.is_approved = TRUE 
         AND u.is_active = TRUE
       ORDER BY COALESCE(pa.patient_count, 0) ASC, u.full_name`,
      [role]
    );

    return res.status(200).json({ 
      staff: staffResult.rows,
      role
    });
  } catch (error) {
    console.error('getStaffByRole error:', error);
    // Fallback: just return users with that role without workload
    try {
      const fallbackResult = await query(
        `SELECT id, full_name, email, role, 0 as current_patients
         FROM users
         WHERE role = $1 AND is_approved = TRUE AND is_active = TRUE
         ORDER BY full_name`,
        [role]
      );
      return res.status(200).json({ 
        staff: fallbackResult.rows,
        role
      });
    } catch (fallbackError) {
      console.error('getStaffByRole fallback error:', fallbackError);
      return res.status(500).json({ 
        error: 'Failed to fetch staff', 
        message: error.message 
      });
    }
  }
}

/**
 * Get full team workload statistics
 */
async function getTeamWorkload(res) {
  // Ensure patient_assignments table exists
  await ensurePatientAssignmentsTable();

  const workloadQuery = `
    WITH assignment_counts AS (
      SELECT 
        'consultant' as role,
        consultant_id::text as user_id,
        COUNT(*) as patient_count
      FROM patient_assignments 
      WHERE is_active = TRUE AND consultant_id IS NOT NULL
      GROUP BY consultant_id
      
      UNION ALL
      
      SELECT 
        'senior_registrar' as role,
        senior_registrar_id::text as user_id,
        COUNT(*) as patient_count
      FROM patient_assignments 
      WHERE is_active = TRUE AND senior_registrar_id IS NOT NULL
      GROUP BY senior_registrar_id
      
      UNION ALL
      
      SELECT 
        'registrar' as role,
        registrar_id::text as user_id,
        COUNT(*) as patient_count
      FROM patient_assignments 
      WHERE is_active = TRUE AND registrar_id IS NOT NULL
      GROUP BY registrar_id
      
      UNION ALL
      
      SELECT 
        'house_officer' as role,
        house_officer_id::text as user_id,
        COUNT(*) as patient_count
      FROM patient_assignments 
      WHERE is_active = TRUE AND house_officer_id IS NOT NULL
      GROUP BY house_officer_id
    )
    SELECT 
      u.id, u.full_name, u.email, u.role,
      COALESCE(ac.patient_count, 0) as current_patients
    FROM users u
    LEFT JOIN assignment_counts ac ON u.id::text = ac.user_id AND u.role = ac.role
    WHERE u.role IN ('consultant', 'senior_registrar', 'registrar', 'house_officer')
      AND u.is_approved = TRUE 
      AND u.is_active = TRUE
    ORDER BY u.role, COALESCE(ac.patient_count, 0) ASC
  `;

  const result = await query(workloadQuery);

  // Organize by role with statistics
  const workload = {
    consultant: { staff: [], totalPatients: 0, avgPatients: 0 },
    senior_registrar: { staff: [], totalPatients: 0, avgPatients: 0 },
    registrar: { staff: [], totalPatients: 0, avgPatients: 0 },
    house_officer: { staff: [], totalPatients: 0, avgPatients: 0 }
  };

  for (const user of result.rows) {
    if (workload[user.role]) {
      workload[user.role].staff.push(user);
      workload[user.role].totalPatients += parseInt(user.current_patients) || 0;
    }
  }

  // Calculate averages
  for (const role of Object.keys(workload)) {
    const roleData = workload[role];
    roleData.avgPatients = roleData.staff.length > 0 
      ? Math.round(roleData.totalPatients / roleData.staff.length * 10) / 10 
      : 0;
  }

  return res.status(200).json({ workload });
}

/**
 * Suggest the best team assignment for a new admission
 * Selects staff with the lowest current workload for even distribution
 */
async function suggestTeamAssignment(res) {
  await ensurePatientAssignmentsTable();

  const suggestions = {};
  const roles = ['senior_registrar', 'registrar', 'house_officer'];

  for (const role of roles) {
    const roleColumnMap = {
      'senior_registrar': 'senior_registrar_id',
      'registrar': 'registrar_id',
      'house_officer': 'house_officer_id'
    };
    const roleColumn = roleColumnMap[role];

    // Get staff with lowest patient count
    const staffResult = await query(
      `SELECT u.id, u.full_name, u.email, u.role,
              COALESCE(pa.patient_count, 0) as current_patients
       FROM users u
       LEFT JOIN (
         SELECT ${roleColumn}::text as user_id, COUNT(*) as patient_count
         FROM patient_assignments
         WHERE is_active = TRUE AND ${roleColumn} IS NOT NULL
         GROUP BY ${roleColumn}
       ) pa ON u.id::text = pa.user_id
       WHERE u.role = $1 
         AND u.is_approved = TRUE 
         AND u.is_active = TRUE
       ORDER BY COALESCE(pa.patient_count, 0) ASC, RANDOM()
       LIMIT 1`,
      [role]
    );

    if (staffResult.rows.length > 0) {
      suggestions[role] = staffResult.rows[0];
    } else {
      suggestions[role] = null;
    }
  }

  return res.status(200).json({ 
    suggestions,
    timestamp: new Date().toISOString()
  });
}

/**
 * Log a team activity (ward round, procedure, prescription, etc.)
 */
async function logTeamActivity(data, currentUser, res) {
  const { 
    patient_id, 
    activity_type, 
    description, 
    assigned_staff_id, 
    notes 
  } = data;

  if (!patient_id || !activity_type) {
    return res.status(400).json({ error: 'Patient ID and activity type required' });
  }

  // Ensure team_activities table exists
  await query(`
    CREATE TABLE IF NOT EXISTS team_activities (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      assigned_staff_id INTEGER,
      activity_type VARCHAR(100) NOT NULL,
      description TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const result = await query(
    `INSERT INTO team_activities (patient_id, user_id, assigned_staff_id, activity_type, description, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [patient_id, currentUser.id, assigned_staff_id || currentUser.id, activity_type, description, notes]
  );

  return res.status(201).json({ 
    activity: result.rows[0],
    message: 'Activity logged successfully'
  });
}

/**
 * Get team activities with optional filters
 */
async function getTeamActivities(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const staffId = url.searchParams.get('staff_id');
  const patientId = url.searchParams.get('patient_id');
  const activityType = url.searchParams.get('type');
  const limit = parseInt(url.searchParams.get('limit')) || 100;

  let queryStr = `
    SELECT ta.*, u.full_name as performed_by, u.role as performer_role,
           s.full_name as assigned_to, s.role as assigned_role,
           p.first_name, p.last_name, p.hospital_number
    FROM team_activities ta
    JOIN users u ON ta.user_id = u.id
    LEFT JOIN users s ON ta.assigned_staff_id = s.id
    LEFT JOIN patients p ON ta.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramIndex = 1;

  if (staffId) {
    queryStr += ` AND (ta.user_id = $${paramIndex} OR ta.assigned_staff_id = $${paramIndex})`;
    params.push(staffId);
    paramIndex++;
  }

  if (patientId) {
    queryStr += ` AND ta.patient_id = $${paramIndex}`;
    params.push(patientId);
    paramIndex++;
  }

  if (activityType) {
    queryStr += ` AND ta.activity_type = $${paramIndex}`;
    params.push(activityType);
    paramIndex++;
  }

  queryStr += ` ORDER BY ta.created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  try {
    const result = await query(queryStr, params);
    return res.status(200).json({ activities: result.rows });
  } catch (error) {
    // Table might not exist yet
    if (error.message.includes('does not exist')) {
      return res.status(200).json({ activities: [] });
    }
    throw error;
  }
}

/**
 * Get comprehensive team analytics
 */
async function getTeamAnalytics(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const staffId = url.searchParams.get('staff_id');
  const period = url.searchParams.get('period') || '30'; // days

  await ensurePatientAssignmentsTable();

  let analytics = {
    summary: {},
    byStaff: [],
    activityBreakdown: []
  };

  // Get activity counts by staff
  try {
    const activityQuery = `
      SELECT 
        u.id, u.full_name, u.role,
        COUNT(ta.id) as total_activities,
        COUNT(CASE WHEN ta.activity_type = 'ward_round' THEN 1 END) as ward_rounds,
        COUNT(CASE WHEN ta.activity_type = 'procedure' THEN 1 END) as procedures,
        COUNT(CASE WHEN ta.activity_type = 'prescription' THEN 1 END) as prescriptions,
        COUNT(CASE WHEN ta.activity_type = 'consultation' THEN 1 END) as consultations,
        COUNT(CASE WHEN ta.activity_type = 'documentation' THEN 1 END) as documentation
      FROM users u
      LEFT JOIN team_activities ta ON (u.id = ta.user_id OR u.id = ta.assigned_staff_id)
        AND ta.created_at >= NOW() - INTERVAL '${parseInt(period)} days'
      WHERE u.role IN ('consultant', 'senior_registrar', 'registrar', 'house_officer')
        AND u.is_approved = TRUE AND u.is_active = TRUE
      ${staffId ? `AND u.id = ${parseInt(staffId)}` : ''}
      GROUP BY u.id, u.full_name, u.role
      ORDER BY total_activities DESC
    `;

    const activityResult = await query(activityQuery);
    analytics.byStaff = activityResult.rows;
  } catch (error) {
    // Table might not exist
    analytics.byStaff = [];
  }

  // Get workload distribution
  try {
    const workloadQuery = `
      SELECT 
        role,
        COUNT(DISTINCT id) as staff_count,
        SUM(current_patients) as total_patients,
        ROUND(AVG(current_patients), 1) as avg_patients,
        MAX(current_patients) as max_patients,
        MIN(current_patients) as min_patients
      FROM (
        SELECT u.id, u.role,
               COALESCE(
                 CASE 
                   WHEN u.role = 'senior_registrar' THEN (SELECT COUNT(*) FROM patient_assignments WHERE senior_registrar_id::text = u.id::text AND is_active = TRUE)
                   WHEN u.role = 'registrar' THEN (SELECT COUNT(*) FROM patient_assignments WHERE registrar_id::text = u.id::text AND is_active = TRUE)
                   WHEN u.role = 'house_officer' THEN (SELECT COUNT(*) FROM patient_assignments WHERE house_officer_id::text = u.id::text AND is_active = TRUE)
                   WHEN u.role = 'consultant' THEN (SELECT COUNT(*) FROM patient_assignments WHERE consultant_id::text = u.id::text AND is_active = TRUE)
                   ELSE 0
                 END, 0
               ) as current_patients
        FROM users u
        WHERE u.role IN ('consultant', 'senior_registrar', 'registrar', 'house_officer')
          AND u.is_approved = TRUE AND u.is_active = TRUE
      ) subq
      GROUP BY role
      ORDER BY role
    `;

    const workloadResult = await query(workloadQuery);
    analytics.summary = {
      workloadDistribution: workloadResult.rows
    };
  } catch (error) {
    analytics.summary = { workloadDistribution: [] };
  }

  return res.status(200).json({ analytics });
}

/**
 * Ensure patient_assignments table exists
 */
async function ensurePatientAssignmentsTable() {
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
}
