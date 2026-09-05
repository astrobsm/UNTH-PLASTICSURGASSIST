// Trainee Rotations API endpoints
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { scoreTrainee } from './_lib/traineeScoring.js';
import { gatherTraineeCounts } from './_lib/traineeCounts.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Verify authentication
  const authResult = authenticateRequest(req);
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
    console.error('Rotations API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, rotationId, targetUserId, level, status } = req.query;
  
  // Allow supervisors to view other users' rotations
  const effectiveUserId = (userRole === 'consultant' || userRole === 'admin') && targetUserId 
    ? targetUserId 
    : userId;

  switch (action) {
    case 'current':
      // Get current active rotation
      const currentResult = await query(
        `SELECT r.*, u.full_name as user_name, u.training_level
         FROM trainee_rotations r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.user_id = $1 AND r.status IN ('active', 'extended', 'pending_signout')
         ORDER BY r.created_at DESC LIMIT 1`,
        [effectiveUserId]
      );
      return res.status(200).json({ rotation: currentResult.rows[0] || null });

    case 'detail':
      if (!rotationId) {
        return res.status(400).json({ error: 'Rotation ID required' });
      }
      const detailResult = await query(
        `SELECT r.*, u.full_name as user_name, u.training_level,
                approver.full_name as approved_by_name
         FROM trainee_rotations r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN users approver ON r.sign_out_approved_by = approver.id
         WHERE r.id = $1`,
        [rotationId]
      );
      if (detailResult.rows.length === 0) {
        return res.status(404).json({ error: 'Rotation not found' });
      }
      return res.status(200).json({ rotation: detailResult.rows[0] });

    case 'history':
      // Get rotation history for user
      const historyResult = await query(
        `SELECT * FROM trainee_rotations 
         WHERE user_id = $1 
         ORDER BY created_at DESC`,
        [effectiveUserId]
      );
      return res.status(200).json({ rotations: historyResult.rows });

    case 'all':
      // Get all rotations (for supervisors)
      if (userRole !== 'consultant' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      let allQuery = `
        SELECT r.*, u.full_name as user_name, u.training_level
        FROM trainee_rotations r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE 1=1
      `;
      const allParams = [];
      
      if (status) {
        allParams.push(status);
        allQuery += ` AND r.status = $${allParams.length}`;
      }
      if (level) {
        allParams.push(level);
        allQuery += ` AND r.level = $${allParams.length}`;
      }
      
      allQuery += ` ORDER BY r.created_at DESC`;
      
      const allResult = await query(allQuery, allParams);
      return res.status(200).json({ rotations: allResult.rows });

    case 'pending-signouts':
      // Get pending sign-out requests (for supervisors)
      if (userRole !== 'consultant' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const pendingResult = await query(
        `SELECT r.*, u.full_name as user_name, u.training_level
         FROM trainee_rotations r
         LEFT JOIN users u ON r.user_id = u.id
         WHERE r.status = 'pending_signout'
         ORDER BY r.updated_at ASC`
      );
      return res.status(200).json({ rotations: pendingResult.rows });

    case 'statistics':
      // Get rotation statistics (for supervisors)
      if (userRole !== 'consultant' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const statsResult = await query(
        `SELECT 
           level,
           status,
           COUNT(*) as count,
           AVG(extension_count) as avg_extensions,
           AVG(final_score) as avg_final_score
         FROM trainee_rotations
         GROUP BY level, status
         ORDER BY level, status`
      );
      return res.status(200).json({ statistics: statsResult.rows });

    default:
      // Get user's rotations
      const defaultResult = await query(
        `SELECT * FROM trainee_rotations WHERE user_id = $1 ORDER BY created_at DESC`,
        [effectiveUserId]
      );
      return res.status(200).json({ rotations: defaultResult.rows });
  }
}

async function handlePost(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'start':
      // Start a new rotation
      const { level, department = 'Plastic Surgery' } = body;
      
      // Check if there's already an active rotation
      const existingRotation = await query(
        `SELECT id FROM trainee_rotations 
         WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')`,
        [userId]
      );
      
      if (existingRotation.rows.length > 0) {
        return res.status(400).json({ error: 'You already have an active rotation' });
      }
      
      // Calculate rotation duration based on level
      const durations = {
        'house_officer': 30,
        'junior_resident': 90,
        'senior_resident': 180
      };
      const durationDays = durations[level] || 30;
      
      const newRotation = await query(
        `INSERT INTO trainee_rotations 
         (user_id, level, department, start_date, expected_end_date, status)
         VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4 || ' days')::INTERVAL, 'active')
         RETURNING *`,
        [userId, level, department, String(durationDays)]
      );
      
      // Update user's training level
      await query(
        `UPDATE users SET training_level = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [level, userId]
      );
      
      // Log activity
      await logActivity(userId, 'rotation_started', `Started ${level} rotation in ${department}`);
      
      return res.status(201).json({ rotation: newRotation.rows[0] });

    case 'request-signout':
      // Request rotation sign-out
      const { rotationId, selfAssessment, comments } = body;
      
      // Verify ownership
      const rotationCheck = await query(
        `SELECT * FROM trainee_rotations WHERE id = $1 AND user_id = $2`,
        [rotationId, userId]
      );
      
      if (rotationCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Rotation not found or access denied' });
      }
      
      const rotation = rotationCheck.rows[0];
      if (rotation.status !== 'active' && rotation.status !== 'extended') {
        return res.status(400).json({ error: 'Rotation is not in an active state' });
      }
      
      // Check eligibility
      const eligibility = await checkSignOutEligibility(userId, rotation.level);
      
      await query(
        `UPDATE trainee_rotations 
         SET status = 'pending_signout',
             sign_out_comments = $1,
             self_assessment = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [comments, JSON.stringify(selfAssessment), rotationId]
      );
      
      // Log activity
      await logActivity(userId, 'signout_requested', 'Requested rotation sign-out', { rotationId, eligibility });
      
      return res.status(200).json({ 
        success: true, 
        message: 'Sign-out request submitted',
        eligibility 
      });

    case 'create-for-user':
      // Create rotation for another user (supervisors only)
      if (userRole !== 'consultant' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { userId: targetUser, level: targetLevel, startDate, department: dept = 'Plastic Surgery' } = body;
      
      // Check if user exists
      const userCheck = await query(`SELECT id FROM users WHERE id = $1`, [targetUser]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Calculate end date
      const durationMap = {
        'house_officer': 30,
        'junior_resident': 90,
        'senior_resident': 180
      };
      const days = durationMap[targetLevel] || 30;
      
      const createdRotation = await query(
        `INSERT INTO trainee_rotations 
         (user_id, level, department, start_date, expected_end_date, status)
         VALUES ($1, $2, $3, $4::date, $4::date + INTERVAL '${days} days', 'active')
         RETURNING *`,
        [targetUser, targetLevel, dept, startDate || new Date().toISOString().split('T')[0]]
      );
      
      return res.status(201).json({ rotation: createdRotation.rows[0] });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'extend':
      // Extend a rotation (supervisors only)
      if (userRole !== 'consultant' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Only supervisors can extend rotations' });
      }
      
      const { rotationId, reason, extensionDays = 7 } = body;
      
      const extendResult = await query(
        `UPDATE trainee_rotations 
         SET expected_end_date = expected_end_date + INTERVAL '${parseInt(extensionDays)} days',
             extension_count = extension_count + 1,
             extension_reasons = COALESCE(extension_reasons, '[]'::jsonb) || $1::jsonb,
             status = 'extended',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify([{ reason, days: extensionDays, date: new Date().toISOString(), by: userId }]), rotationId]
      );
      
      if (extendResult.rows.length === 0) {
        return res.status(404).json({ error: 'Rotation not found' });
      }
      
      // Notify trainee
      await logActivity(extendResult.rows[0].user_id, 'rotation_extended', `Rotation extended by ${extensionDays} days: ${reason}`);
      
      return res.status(200).json({ rotation: extendResult.rows[0] });

    case 'approve-signout':
      // Approve or reject sign-out (supervisors only)
      if (userRole !== 'consultant' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Only supervisors can approve sign-outs' });
      }
      
      const { rotationId: approveRotationId, approved, comments: approvalComments, finalScore, feedback } = body;
      
      const rotationToApprove = await query(
        `SELECT * FROM trainee_rotations WHERE id = $1 AND status = 'pending_signout'`,
        [approveRotationId]
      );
      
      if (rotationToApprove.rows.length === 0) {
        return res.status(404).json({ error: 'Rotation not found or not pending sign-out' });
      }
      
      if (approved) {
        await query(
          `UPDATE trainee_rotations 
           SET status = 'signed_out',
               actual_end_date = CURRENT_DATE,
               sign_out_approved = true,
               sign_out_approved_by = $1,
               sign_out_approved_at = CURRENT_TIMESTAMP,
               final_score = $2,
               supervisor_feedback = $3,
               sign_out_comments = COALESCE(sign_out_comments, '') || ' | Approved: ' || $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [userId, finalScore, JSON.stringify(feedback), approvalComments || 'Approved', approveRotationId]
        );
        
        // Log activity
        await logActivity(rotationToApprove.rows[0].user_id, 'signout_approved', 'Rotation sign-out approved', { rotationId: approveRotationId, finalScore });
      } else {
        await query(
          `UPDATE trainee_rotations 
           SET status = 'active',
               sign_out_comments = COALESCE(sign_out_comments, '') || ' | Rejected: ' || $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [approvalComments || 'Requirements not met', approveRotationId]
        );
        
        // Log activity
        await logActivity(rotationToApprove.rows[0].user_id, 'signout_rejected', `Sign-out rejected: ${approvalComments}`);
      }
      
      return res.status(200).json({ success: true, approved });

    case 'update-notes':
      // Update rotation notes
      const { rotationId: noteRotationId, notes } = body;
      
      // Verify ownership or supervisor
      const noteCheck = await query(
        `SELECT user_id FROM trainee_rotations WHERE id = $1`,
        [noteRotationId]
      );
      
      if (noteCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Rotation not found' });
      }
      
      const canEdit = noteCheck.rows[0].user_id === userId || 
                      userRole === 'consultant' || 
                      userRole === 'admin';
      
      if (!canEdit) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      await query(
        `UPDATE trainee_rotations 
         SET sign_out_comments = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [notes, noteRotationId]
      );
      
      return res.status(200).json({ success: true });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Sign-out eligibility for a trainee's rotation.
 *
 * Delegates to the shared scorer. This function used to carry a fifth copy of
 * the per-level requirements, and gated sign-out on the CBT average alone
 * reaching 70 -- so a trainee could be cleared here while Training Admin,
 * which weighs six components, still showed them well short.
 */
async function checkSignOutEligibility(userId, level) {
  const counts = await gatherTraineeCounts(userId);
  const scored = scoreTrainee({ level, counts });
  const need = scored.requirements;

  return {
    eligible: scored.eligibility.eligible,
    level: scored.level,
    overallScore: scored.overall,
    threshold: scored.passThreshold,
    components: scored.components,
    weights: scored.weights,
    met: scored.eligibility.met,
    notMet: scored.eligibility.notMet,
    requirements: {
      cbtTests:      { current: counts.cbtTests,        required: need.cbtTests },
      patientEntries:{ current: counts.patients,        required: need.patients },
      duties:        { current: counts.duties,          required: need.duties },
      loginDays:     { current: counts.loginDays,       required: need.loginDays },
      cmeArticles:   { current: counts.cmeArticles,     required: need.cmeArticles },
      selfAssessments:{ current: counts.selfAssessments, required: need.selfAssessments },
      cbtAverage:    counts.cbtAverage,
    },
  };
}

async function logActivity(userId, activityType, description, metadata = {}) {
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
     VALUES ($1, $2, $3, 0, $4)`,
    [userId, activityType, description, JSON.stringify(metadata)]
  );
}
