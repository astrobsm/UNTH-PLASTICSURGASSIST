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
        if (pathParts[0] === 'patient') {
          return await getPatientMedicalTeam(req, res);
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
 * Computes from real clinical data (ward rounds, admissions, prescriptions)
 */
async function getTeamWorkload(res) {
  // Get all active clinical staff
  const staffResult = await query(`
    SELECT id, full_name, email, role
    FROM users
    WHERE role IN ('consultant', 'senior_registrar', 'registrar', 'house_officer')
      AND is_approved = TRUE AND is_active = TRUE
    ORDER BY role, full_name
  `);

  // Collect distinct patient IDs per user from multiple clinical sources
  const userPatients = {}; // user_id -> Set of patient_ids

  // Ward rounds in last 14 days = actively managing patients
  try {
    const wrResult = await query(`
      SELECT user_id, patient_id FROM ward_rounds
      WHERE round_date >= CURRENT_DATE - INTERVAL '14 days'
        AND user_id IS NOT NULL AND patient_id IS NOT NULL
    `);
    for (const row of wrResult.rows) {
      if (!userPatients[row.user_id]) userPatients[row.user_id] = new Set();
      userPatients[row.user_id].add(row.patient_id);
    }
  } catch (e) { console.log('ward_rounds table not available for workload'); }

  // Active admissions created by the user
  try {
    const admResult = await query(`
      SELECT created_by, patient_id FROM admissions
      WHERE status = 'admitted' AND created_by IS NOT NULL AND patient_id IS NOT NULL
    `);
    for (const row of admResult.rows) {
      if (!userPatients[row.created_by]) userPatients[row.created_by] = new Set();
      userPatients[row.created_by].add(row.patient_id);
    }
  } catch (e) { console.log('admissions table not available for workload'); }

  // Recent prescriptions (last 14 days)
  try {
    const rxResult = await query(`
      SELECT prescribed_by, patient_id FROM prescriptions
      WHERE prescribed_at >= NOW() - INTERVAL '14 days'
        AND prescribed_by IS NOT NULL AND patient_id IS NOT NULL
    `);
    for (const row of rxResult.rows) {
      if (!userPatients[row.prescribed_by]) userPatients[row.prescribed_by] = new Set();
      userPatients[row.prescribed_by].add(row.patient_id);
    }
  } catch (e) { console.log('prescriptions table not available for workload'); }

  // Also try patient_assignments if populated
  try {
    const paResult = await query(`
      SELECT consultant_id, senior_registrar_id, registrar_id, house_officer_id, patient_id
      FROM patient_assignments WHERE is_active = TRUE
    `);
    for (const row of paResult.rows) {
      const roles = ['consultant_id', 'senior_registrar_id', 'registrar_id', 'house_officer_id'];
      for (const col of roles) {
        if (row[col] && row.patient_id) {
          const uid = parseInt(row[col]);
          if (!userPatients[uid]) userPatients[uid] = new Set();
          userPatients[uid].add(row.patient_id);
        }
      }
    }
  } catch (e) { /* patient_assignments may not exist */ }

  // Build workload response
  const workload = {
    consultant: { staff: [], totalPatients: 0, avgPatients: 0 },
    senior_registrar: { staff: [], totalPatients: 0, avgPatients: 0 },
    registrar: { staff: [], totalPatients: 0, avgPatients: 0 },
    house_officer: { staff: [], totalPatients: 0, avgPatients: 0 }
  };

  for (const user of staffResult.rows) {
    const patientSet = userPatients[user.id] || new Set();
    const patientCount = patientSet.size;
    if (workload[user.role]) {
      workload[user.role].staff.push({
        ...user,
        current_patients: patientCount
      });
      workload[user.role].totalPatients += patientCount;
    }
  }

  // Calculate averages and sort staff by workload
  for (const role of Object.keys(workload)) {
    const roleData = workload[role];
    roleData.staff.sort((a, b) => a.current_patients - b.current_patients);
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
 * Computes activity counts from actual clinical data tables
 */
async function getTeamAnalytics(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const staffId = url.searchParams.get('staff_id');
  const period = parseInt(url.searchParams.get('period')) || 30;

  // Get all active clinical staff
  let staffQuery = `
    SELECT id, full_name, role
    FROM users
    WHERE role IN ('consultant', 'senior_registrar', 'registrar', 'house_officer')
      AND is_approved = TRUE AND is_active = TRUE
  `;
  const staffParams = [];
  if (staffId) {
    staffQuery += ` AND id = $1`;
    staffParams.push(parseInt(staffId));
  }
  staffQuery += ' ORDER BY role, full_name';

  const staffResult = await query(staffQuery, staffParams);

  // Count activities from actual clinical data tables
  const wardRoundCounts = {};
  const procedureCounts = {};
  const prescriptionCounts = {};
  const consultationCounts = {};

  // Ward rounds — check both user_id (original) and created_by (added later)
  try {
    const result = await query(`
      SELECT COALESCE(user_id, created_by) as uid, COUNT(*) as cnt FROM ward_rounds
      WHERE round_date >= CURRENT_DATE - INTERVAL '${period} days'
        AND (user_id IS NOT NULL OR created_by IS NOT NULL)
      GROUP BY COALESCE(user_id, created_by)
    `);
    for (const row of result.rows) {
      wardRoundCounts[row.uid] = parseInt(row.cnt);
    }
  } catch (e) { console.log('ward_rounds not available for analytics'); }

  // Procedures/Surgeries (using surgeries table with surgeon_id foreign key)
  try {
    const result = await query(`
      SELECT surgeon_id as user_id, COUNT(*) as cnt FROM surgeries
      WHERE scheduled_date >= NOW() - INTERVAL '${period} days'
        AND surgeon_id IS NOT NULL
      GROUP BY surgeon_id
    `);
    for (const row of result.rows) {
      procedureCounts[row.user_id] = parseInt(row.cnt);
    }
  } catch (e) { console.log('surgeries not available for analytics'); }

  // Also check procedures table (created_by if available, otherwise try matching by surgeon name)
  try {
    const result = await query(`
      SELECT u.id as user_id, COUNT(p.id) as cnt 
      FROM procedures p
      JOIN users u ON LOWER(u.full_name) = LOWER(p.surgeon)
      WHERE p.procedure_date >= CURRENT_DATE - INTERVAL '${period} days'
        AND p.surgeon IS NOT NULL
      GROUP BY u.id
    `);
    for (const row of result.rows) {
      procedureCounts[row.user_id] = (procedureCounts[row.user_id] || 0) + parseInt(row.cnt);
    }
  } catch (e) { /* procedures table may not exist or surgeon matching failed */ }

  // Prescriptions
  try {
    const result = await query(`
      SELECT prescribed_by as user_id, COUNT(*) as cnt FROM prescriptions
      WHERE prescribed_at >= NOW() - INTERVAL '${period} days'
        AND prescribed_by IS NOT NULL
      GROUP BY prescribed_by
    `);
    for (const row of result.rows) {
      prescriptionCounts[row.user_id] = parseInt(row.cnt);
    }
  } catch (e) { console.log('prescriptions not available for analytics'); }

  // Consultations (lab orders as proxy - ordering investigations is a key consultation activity)
  try {
    const result = await query(`
      SELECT ordered_by as user_id, COUNT(*) as cnt FROM lab_orders
      WHERE ordered_at >= NOW() - INTERVAL '${period} days'
        AND ordered_by IS NOT NULL
      GROUP BY ordered_by
    `);
    for (const row of result.rows) {
      consultationCounts[row.user_id] = parseInt(row.cnt);
    }
  } catch (e) { console.log('lab_orders not available for analytics'); }

  // Also count from team_activities table if it has data (legacy/explicit logs)
  try {
    const result = await query(`
      SELECT 
        COALESCE(ta.user_id, ta.assigned_staff_id) as user_id,
        ta.activity_type,
        COUNT(*) as cnt
      FROM team_activities ta
      WHERE ta.created_at >= NOW() - INTERVAL '${period} days'
      GROUP BY COALESCE(ta.user_id, ta.assigned_staff_id), ta.activity_type
    `);
    for (const row of result.rows) {
      const uid = row.user_id;
      const cnt = parseInt(row.cnt);
      switch (row.activity_type) {
        case 'ward_round':
          wardRoundCounts[uid] = (wardRoundCounts[uid] || 0) + cnt;
          break;
        case 'procedure':
          procedureCounts[uid] = (procedureCounts[uid] || 0) + cnt;
          break;
        case 'prescription':
          prescriptionCounts[uid] = (prescriptionCounts[uid] || 0) + cnt;
          break;
        case 'consultation':
          consultationCounts[uid] = (consultationCounts[uid] || 0) + cnt;
          break;
      }
    }
  } catch (e) { /* team_activities table may not exist */ }

  // Build byStaff analytics array
  const byStaff = staffResult.rows.map(user => {
    const wr = wardRoundCounts[user.id] || 0;
    const proc = procedureCounts[user.id] || 0;
    const pres = prescriptionCounts[user.id] || 0;
    const cons = consultationCounts[user.id] || 0;
    return {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      ward_rounds: wr,
      procedures: proc,
      prescriptions: pres,
      consultations: cons,
      documentation: 0,
      total_activities: wr + proc + pres + cons
    };
  });

  // Sort by total activities desc
  byStaff.sort((a, b) => b.total_activities - a.total_activities);

  // Compute workload summary by role from clinical data
  const workloadByRole = {};
  const userPatients = {};

  try {
    const wrResult = await query(`
      SELECT COALESCE(user_id, created_by) as uid, COUNT(DISTINCT patient_id) as patient_count FROM ward_rounds
      WHERE round_date >= CURRENT_DATE - INTERVAL '14 days'
        AND (user_id IS NOT NULL OR created_by IS NOT NULL)
      GROUP BY COALESCE(user_id, created_by)
    `);
    for (const row of wrResult.rows) {
      userPatients[row.uid] = parseInt(row.patient_count);
    }
  } catch (e) { }

  try {
    const admResult = await query(`
      SELECT created_by, COUNT(DISTINCT patient_id) as patient_count FROM admissions
      WHERE status = 'admitted' AND created_by IS NOT NULL
      GROUP BY created_by
    `);
    for (const row of admResult.rows) {
      if (!userPatients[row.created_by]) {
        userPatients[row.created_by] = parseInt(row.patient_count);
      }
    }
  } catch (e) { }

  // Also count patients from prescriptions (prescribed_by) and lab_orders (ordered_by)
  try {
    const presResult = await query(`
      SELECT prescribed_by as uid, COUNT(DISTINCT patient_id) as patient_count FROM prescriptions
      WHERE prescribed_at >= CURRENT_DATE - INTERVAL '14 days'
        AND prescribed_by IS NOT NULL
      GROUP BY prescribed_by
    `);
    for (const row of presResult.rows) {
      userPatients[row.uid] = Math.max(userPatients[row.uid] || 0, parseInt(row.patient_count));
    }
  } catch (e) { }

  try {
    const labResult = await query(`
      SELECT ordered_by as uid, COUNT(DISTINCT patient_id) as patient_count FROM lab_orders
      WHERE ordered_at >= CURRENT_DATE - INTERVAL '14 days'
        AND ordered_by IS NOT NULL
      GROUP BY ordered_by
    `);
    for (const row of labResult.rows) {
      userPatients[row.uid] = Math.max(userPatients[row.uid] || 0, parseInt(row.patient_count));
    }
  } catch (e) { }

  // Group by role for summary
  for (const user of staffResult.rows) {
    const role = user.role;
    if (!workloadByRole[role]) {
      workloadByRole[role] = { role, staff_count: 0, total_patients: 0, patientCounts: [] };
    }
    const pc = userPatients[user.id] || 0;
    workloadByRole[role].staff_count++;
    workloadByRole[role].total_patients += pc;
    workloadByRole[role].patientCounts.push(pc);
  }

  const workloadDistribution = Object.values(workloadByRole).map((item) => ({
    role: item.role,
    staff_count: item.staff_count,
    total_patients: item.total_patients,
    avg_patients: item.staff_count > 0 ? Math.round(item.total_patients / item.staff_count * 10) / 10 : 0,
    max_patients: item.patientCounts.length > 0 ? Math.max(...item.patientCounts) : 0,
    min_patients: item.patientCounts.length > 0 ? Math.min(...item.patientCounts) : 0
  }));

  return res.status(200).json({
    analytics: {
      byStaff,
      summary: { workloadDistribution }
    }
  });
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

/**
 * Get medical team assigned to a specific patient
 */
async function getPatientMedicalTeam(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const patientId = url.searchParams.get('patient_id');

  if (!patientId) {
    return res.status(400).json({ error: 'patient_id is required' });
  }

  await ensurePatientAssignmentsTable();

  // Get the patient assignment
  const assignmentResult = await query(
    `SELECT * FROM patient_assignments WHERE patient_id = $1 AND is_active = TRUE`,
    [patientId]
  );

  if (assignmentResult.rows.length === 0) {
    return res.status(200).json({ team: [], message: 'No team assigned' });
  }

  const assignment = assignmentResult.rows[0];
  const team = [];

  // Role configuration
  const roleConfig = {
    consultant: { label: 'Consultant', color: 'bg-purple-600', priority: 1 },
    senior_registrar: { label: 'Senior Registrar', color: 'bg-blue-600', priority: 2 },
    registrar: { label: 'Registrar', color: 'bg-green-600', priority: 3 },
    house_officer: { label: 'House Officer', color: 'bg-amber-600', priority: 4 }
  };

  // Get user details for each assigned role
  const roleColumns = [
    { column: 'consultant_id', role: 'consultant' },
    { column: 'senior_registrar_id', role: 'senior_registrar' },
    { column: 'registrar_id', role: 'registrar' },
    { column: 'house_officer_id', role: 'house_officer' }
  ];

  for (const { column, role } of roleColumns) {
    if (assignment[column]) {
      try {
        const userResult = await query(
          `SELECT id, full_name, username, email, role, phone FROM users WHERE id::text = $1`,
          [assignment[column]]
        );
        
        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          team.push({
            id: user.id,
            name: user.full_name || user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
            roleLabel: roleConfig[role].label,
            color: roleConfig[role].color,
            priority: roleConfig[role].priority
          });
        }
      } catch (err) {
        console.error(`Error fetching ${role}:`, err);
      }
    }
  }

  // Sort by priority
  team.sort((a, b) => a.priority - b.priority);

  return res.status(200).json({ 
    team,
    assignment: {
      id: assignment.id,
      patient_id: assignment.patient_id,
      assigned_at: assignment.assigned_at
    }
  });
}
