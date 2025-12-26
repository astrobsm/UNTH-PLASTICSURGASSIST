// Performance Tracking API endpoints
import { query } from './_lib/db.js';
import { cors, verifyToken } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Verify authentication
  const authResult = await verifyToken(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const { method } = req;
  const userId = authResult.user.id;
  const userRole = authResult.user.role;

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId, userRole);
      case 'POST':
        return await handlePost(req, res, userId, userRole);
      case 'PUT':
        return await handlePut(req, res, userId, userRole);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Performance API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, targetUserId, level } = req.query;
  
  // Allow supervisors to view other users' performance
  const effectiveUserId = (userRole === 'consultant' || userRole === 'super_admin') && targetUserId 
    ? targetUserId 
    : userId;

  switch (action) {
    case 'metrics':
      // Get current performance metrics
      const metrics = await calculatePerformanceMetrics(effectiveUserId, level);
      return res.status(200).json({ metrics });

    case 'rotation':
      // Get current rotation
      const rotationResult = await query(
        `SELECT * FROM trainee_rotations 
         WHERE user_id = $1 AND (status = 'active' OR status = 'extended')
         ORDER BY created_at DESC LIMIT 1`,
        [effectiveUserId]
      );
      return res.status(200).json({ rotation: rotationResult.rows[0] || null });

    case 'rotations':
      // Get all rotations
      const rotationsResult = await query(
        `SELECT * FROM trainee_rotations WHERE user_id = $1 ORDER BY created_at DESC`,
        [effectiveUserId]
      );
      return res.status(200).json({ rotations: rotationsResult.rows });

    case 'snapshots':
      // Get performance snapshots
      const snapshotsResult = await query(
        `SELECT * FROM performance_snapshots 
         WHERE user_id = $1 
         ORDER BY snapshot_date DESC 
         LIMIT 20`,
        [effectiveUserId]
      );
      return res.status(200).json({ snapshots: snapshotsResult.rows });

    case 'eligibility':
      // Check sign-out eligibility
      const eligibility = await checkSignOutEligibility(effectiveUserId, level);
      return res.status(200).json(eligibility);

    case 'all-trainees':
      // Get all trainees (for supervisors)
      if (userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const traineesResult = await query(
        `SELECT u.id, u.username, u.full_name, u.training_level, u.role,
                tr.status as rotation_status, tr.start_date, tr.expected_end_date,
                tr.extension_count
         FROM users u
         LEFT JOIN trainee_rotations tr ON u.id = tr.user_id AND (tr.status = 'active' OR tr.status = 'extended')
         WHERE u.role IN ('intern', 'registrar', 'senior_registrar')
         AND u.is_active = true
         ORDER BY u.training_level, u.full_name`
      );
      return res.status(200).json({ trainees: traineesResult.rows });

    default:
      // Get summary dashboard data
      const summary = await getPerformanceSummary(effectiveUserId, level);
      return res.status(200).json(summary);
  }
}

async function handlePost(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'start-rotation':
      // Start a new rotation
      const { level: rotationLevel } = body;
      
      // Check if there's already an active rotation
      const existingRotation = await query(
        `SELECT id FROM trainee_rotations 
         WHERE user_id = $1 AND (status = 'active' OR status = 'extended')`,
        [userId]
      );
      
      if (existingRotation.rows.length > 0) {
        return res.status(400).json({ error: 'Active rotation already exists' });
      }
      
      // Calculate rotation duration
      const durations = {
        'house_officer': 30,
        'junior_resident': 90,
        'senior_resident': 180
      };
      const durationDays = durations[rotationLevel] || 30;
      
      const newRotation = await query(
        `INSERT INTO trainee_rotations 
         (user_id, level, start_date, expected_end_date, status)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '${durationDays} days', 'active')
         RETURNING *`,
        [userId, rotationLevel]
      );
      
      // Log activity
      await logActivity(userId, 'rotation_started', `Started ${rotationLevel} rotation`);
      
      return res.status(201).json({ rotation: newRotation.rows[0] });

    case 'snapshot':
      // Record performance snapshot
      const { rotationId, weekNumber, metrics } = body;
      
      const snapshot = await query(
        `INSERT INTO performance_snapshots 
         (user_id, rotation_id, week_number, cbt_score, patient_care_score, 
          duty_promptness_score, attendance_score, overall_score, snapshot_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_DATE)
         RETURNING *`,
        [
          userId, rotationId, weekNumber, 
          metrics.cbtScore, metrics.patientCareScore,
          metrics.dutyPromptnessScore, metrics.attendanceScore,
          metrics.overallScore
        ]
      );
      
      return res.status(201).json({ snapshot: snapshot.rows[0] });

    case 'request-signout':
      // Request sign-out approval
      const { rotationId: signoutRotationId, comments } = body;
      
      // Verify eligibility
      const eligibility = await checkSignOutEligibility(userId);
      if (!eligibility.eligible) {
        return res.status(400).json({ 
          error: 'Not eligible for sign-out', 
          requirements: eligibility.requirements 
        });
      }
      
      // Update rotation status
      await query(
        `UPDATE trainee_rotations 
         SET status = 'pending_signout', 
             sign_out_comments = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3`,
        [comments, signoutRotationId, userId]
      );
      
      // Log activity
      await logActivity(userId, 'signout_requested', 'Requested rotation sign-out');
      
      return res.status(200).json({ success: true, message: 'Sign-out request submitted' });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  // Only supervisors can perform these actions
  if (userRole !== 'consultant' && userRole !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied' });
  }

  switch (action) {
    case 'extend-rotation':
      const { rotationId, reason } = body;
      
      await query(
        `UPDATE trainee_rotations 
         SET expected_end_date = expected_end_date + INTERVAL '7 days',
             extension_count = extension_count + 1,
             extension_reasons = extension_reasons || $1::jsonb,
             status = 'extended',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify([reason]), rotationId]
      );
      
      return res.status(200).json({ success: true, message: 'Rotation extended by 1 week' });

    case 'approve-signout':
      const { rotationId: approveRotationId, approved, comments: approvalComments, finalScore } = body;
      
      if (approved) {
        await query(
          `UPDATE trainee_rotations 
           SET status = 'signed_out',
               actual_end_date = CURRENT_TIMESTAMP,
               sign_out_approved = true,
               sign_out_approved_by = $1,
               sign_out_approved_at = CURRENT_TIMESTAMP,
               sign_out_comments = COALESCE(sign_out_comments, '') || ' | Approval: ' || $2,
               final_score = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [userId, approvalComments || 'Approved', finalScore, approveRotationId]
        );
      } else {
        await query(
          `UPDATE trainee_rotations 
           SET status = 'active',
               sign_out_comments = COALESCE(sign_out_comments, '') || ' | Rejected: ' || $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [approvalComments || 'Requirements not met', approveRotationId]
        );
      }
      
      return res.status(200).json({ success: true, approved });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

// Helper functions
async function calculatePerformanceMetrics(userId, level) {
  const userLevel = level || 'house_officer';
  
  // CBT Score - average of completed tests
  const cbtResult = await query(
    `SELECT COALESCE(AVG(percentage), 0) as score 
     FROM cbt_attempts 
     WHERE user_id = $1 AND completed = true`,
    [userId]
  );
  
  // Patient Care Score - based on activity points
  const activityResult = await query(
    `SELECT COALESCE(SUM(points), 0) as total_points
     FROM activity_logs 
     WHERE user_id = $1 
     AND activity_type IN ('patient_entry', 'patient_update', 'treatment_plan', 
                           'prescription', 'wound_care', 'surgery_booking', 
                           'lab_order', 'discharge_summary', 'ward_round')`,
    [userId]
  );
  
  // Expected points based on level
  const expectedPoints = {
    'house_officer': 300,    // 30 entries * 10 points avg
    'junior_resident': 1000, // 100 entries * 10 points avg
    'senior_resident': 2000  // 200 entries * 10 points avg
  };
  const patientCareScore = Math.min(100, (activityResult.rows[0].total_points / expectedPoints[userLevel]) * 100);
  
  // Duty Promptness Score
  const dutyResult = await query(
    `SELECT COALESCE(AVG(promptness_score), 0) as score
     FROM duty_assignments 
     WHERE user_id = $1 AND status = 'completed' AND promptness_score IS NOT NULL`,
    [userId]
  );
  
  // Attendance Score - based on login days
  const loginDays = {
    'house_officer': 25,
    'junior_resident': 75,
    'senior_resident': 150
  };
  const attendanceResult = await query(
    `SELECT COUNT(DISTINCT DATE(created_at)) as login_days
     FROM activity_logs 
     WHERE user_id = $1 AND activity_type = 'login'`,
    [userId]
  );
  const attendanceScore = Math.min(100, (attendanceResult.rows[0].login_days / loginDays[userLevel]) * 100);
  
  // Calculate weighted overall score
  const cbtScore = parseFloat(cbtResult.rows[0].score) || 0;
  const dutyScore = parseFloat(dutyResult.rows[0].score) || 0;
  
  const overallScore = 
    (cbtScore * 0.30) +
    (patientCareScore * 0.35) +
    (dutyScore * 0.25) +
    (attendanceScore * 0.10);
  
  return {
    cbtScore: Math.round(cbtScore * 10) / 10,
    patientCareScore: Math.round(patientCareScore * 10) / 10,
    dutyPromptnessScore: Math.round(dutyScore * 10) / 10,
    attendanceScore: Math.round(attendanceScore * 10) / 10,
    overallScore: Math.round(overallScore * 10) / 10
  };
}

async function checkSignOutEligibility(userId, level) {
  const userLevel = level || 'house_officer';
  const metrics = await calculatePerformanceMetrics(userId, userLevel);
  
  const requirements = {
    'house_officer': { cbtTests: 4, patientEntries: 30, duties: 20, loginDays: 25 },
    'junior_resident': { cbtTests: 12, patientEntries: 100, duties: 60, loginDays: 75 },
    'senior_resident': { cbtTests: 24, patientEntries: 200, duties: 120, loginDays: 150 }
  };
  const reqs = requirements[userLevel];
  
  // Check CBT tests
  const cbtCount = await query(
    `SELECT COUNT(*) as count FROM cbt_attempts WHERE user_id = $1 AND completed = true`,
    [userId]
  );
  
  // Check patient entries
  const patientCount = await query(
    `SELECT COUNT(*) as count FROM activity_logs 
     WHERE user_id = $1 AND activity_type = 'patient_entry'`,
    [userId]
  );
  
  // Check duties
  const dutyCount = await query(
    `SELECT COUNT(*) as count FROM duty_assignments 
     WHERE user_id = $1 AND status = 'completed'`,
    [userId]
  );
  
  // Check login days
  const loginCount = await query(
    `SELECT COUNT(DISTINCT DATE(created_at)) as count 
     FROM activity_logs WHERE user_id = $1 AND activity_type = 'login'`,
    [userId]
  );
  
  // Get rotation info
  const rotation = await query(
    `SELECT * FROM trainee_rotations 
     WHERE user_id = $1 AND (status = 'active' OR status = 'extended')
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  
  const met = [];
  const notMet = [];
  
  // Check each requirement
  if (parseInt(cbtCount.rows[0].count) >= reqs.cbtTests) {
    met.push(`CBT tests: ${cbtCount.rows[0].count}/${reqs.cbtTests}`);
  } else {
    notMet.push(`CBT tests: ${cbtCount.rows[0].count}/${reqs.cbtTests}`);
  }
  
  if (parseInt(patientCount.rows[0].count) >= reqs.patientEntries) {
    met.push(`Patient entries: ${patientCount.rows[0].count}/${reqs.patientEntries}`);
  } else {
    notMet.push(`Patient entries: ${patientCount.rows[0].count}/${reqs.patientEntries}`);
  }
  
  if (parseInt(dutyCount.rows[0].count) >= reqs.duties) {
    met.push(`Duties: ${dutyCount.rows[0].count}/${reqs.duties}`);
  } else {
    notMet.push(`Duties: ${dutyCount.rows[0].count}/${reqs.duties}`);
  }
  
  if (parseInt(loginCount.rows[0].count) >= reqs.loginDays) {
    met.push(`Login days: ${loginCount.rows[0].count}/${reqs.loginDays}`);
  } else {
    notMet.push(`Login days: ${loginCount.rows[0].count}/${reqs.loginDays}`);
  }
  
  if (metrics.overallScore >= 70) {
    met.push(`Overall score: ${metrics.overallScore}% (≥70%)`);
  } else {
    notMet.push(`Overall score: ${metrics.overallScore}% (need 70%)`);
  }
  
  // Calculate days remaining
  let daysRemaining = 0;
  if (rotation.rows[0]) {
    const endDate = new Date(rotation.rows[0].expected_end_date);
    daysRemaining = Math.max(0, Math.ceil((endDate - new Date()) / (24 * 60 * 60 * 1000)));
  }
  
  const eligible = notMet.length === 0;
  
  return {
    eligible,
    metrics,
    requirements: { met, notMet },
    daysRemaining,
    rotation: rotation.rows[0] || null
  };
}

async function getPerformanceSummary(userId, level) {
  const metrics = await calculatePerformanceMetrics(userId, level);
  const eligibility = await checkSignOutEligibility(userId, level);
  
  // Get recent activities
  const activities = await query(
    `SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [userId]
  );
  
  // Get pending duties
  const duties = await query(
    `SELECT * FROM duty_assignments 
     WHERE user_id = $1 AND status IN ('pending', 'in_progress')
     ORDER BY due_at ASC`,
    [userId]
  );
  
  return {
    metrics,
    eligibility,
    recentActivities: activities.rows,
    pendingDuties: duties.rows
  };
}

async function logActivity(userId, activityType, description, metadata = {}) {
  const points = {
    'login': 1,
    'patient_entry': 10,
    'patient_update': 5,
    'treatment_plan': 15,
    'prescription': 8,
    'wound_care': 12,
    'surgery_booking': 20,
    'lab_order': 6,
    'discharge_summary': 15,
    'ward_round': 10,
    'duty_response': 5,
    'cbt_completed': 25,
    'cme_completed': 20,
    'rotation_started': 0,
    'signout_requested': 0
  };
  
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, activityType, description, points[activityType] || 0, JSON.stringify(metadata)]
  );
}
