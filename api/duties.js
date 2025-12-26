// Duty Assignments API endpoints
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
      case 'DELETE':
        return await handleDelete(req, res, userId, userRole);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Duties API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, dutyId, status, targetUserId, startDate, endDate } = req.query;
  
  // Allow supervisors to view other users' duties
  const effectiveUserId = (userRole === 'consultant' || userRole === 'super_admin') && targetUserId 
    ? targetUserId 
    : userId;

  switch (action) {
    case 'detail':
      if (!dutyId) {
        return res.status(400).json({ error: 'Duty ID required' });
      }
      const detailResult = await query(
        `SELECT d.*, u.full_name as assigned_to_name, 
                c.full_name as assigned_by_name
         FROM duty_assignments d
         LEFT JOIN users u ON d.user_id = u.id
         LEFT JOIN users c ON d.assigned_by = c.id
         WHERE d.id = $1`,
        [dutyId]
      );
      if (detailResult.rows.length === 0) {
        return res.status(404).json({ error: 'Duty not found' });
      }
      return res.status(200).json({ duty: detailResult.rows[0] });

    case 'pending':
      // Get pending duties for user
      const pendingResult = await query(
        `SELECT * FROM duty_assignments 
         WHERE user_id = $1 AND status IN ('pending', 'in_progress')
         ORDER BY priority DESC, due_at ASC`,
        [effectiveUserId]
      );
      return res.status(200).json({ duties: pendingResult.rows });

    case 'all':
      // Get all duties (for supervisors)
      if (userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      let allQuery = `
        SELECT d.*, u.full_name as assigned_to_name, u.training_level
        FROM duty_assignments d
        LEFT JOIN users u ON d.user_id = u.id
        WHERE 1=1
      `;
      const allParams = [];
      
      if (status) {
        allParams.push(status);
        allQuery += ` AND d.status = $${allParams.length}`;
      }
      if (startDate) {
        allParams.push(startDate);
        allQuery += ` AND d.due_at >= $${allParams.length}::date`;
      }
      if (endDate) {
        allParams.push(endDate);
        allQuery += ` AND d.due_at < ($${allParams.length}::date + INTERVAL '1 day')`;
      }
      
      allQuery += ` ORDER BY d.created_at DESC LIMIT 100`;
      
      const allResult = await query(allQuery, allParams);
      return res.status(200).json({ duties: allResult.rows });

    case 'summary':
      // Get duty completion summary
      const summaryResult = await query(
        `SELECT 
           status,
           COUNT(*) as count,
           AVG(promptness_score) as avg_promptness
         FROM duty_assignments 
         WHERE user_id = $1
         GROUP BY status`,
        [effectiveUserId]
      );
      return res.status(200).json({ summary: summaryResult.rows });

    case 'history':
      // Get completed duties history
      const historyResult = await query(
        `SELECT * FROM duty_assignments 
         WHERE user_id = $1 AND status = 'completed'
         ORDER BY completed_at DESC
         LIMIT 50`,
        [effectiveUserId]
      );
      return res.status(200).json({ duties: historyResult.rows });

    default:
      // Get user's duties with optional status filter
      let listQuery = `
        SELECT * FROM duty_assignments 
        WHERE user_id = $1
      `;
      const listParams = [effectiveUserId];
      
      if (status) {
        listParams.push(status);
        listQuery += ` AND status = $${listParams.length}`;
      }
      
      listQuery += ` ORDER BY due_at ASC, priority DESC`;
      
      const listResult = await query(listQuery, listParams);
      return res.status(200).json({ duties: listResult.rows });
  }
}

async function handlePost(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'create':
      // Create a new duty assignment (supervisors only or self-assign)
      const { assignedTo, title, description, priority = 'medium', dueAt, category } = body;
      
      // Only supervisors can assign to others
      const targetUser = assignedTo || userId;
      if (targetUser !== userId && userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only supervisors can assign duties to others' });
      }
      
      const newDuty = await query(
        `INSERT INTO duty_assignments 
         (user_id, assigned_by, title, description, priority, due_at, category, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *`,
        [targetUser, userId, title, description, priority, dueAt, category]
      );
      
      // Log activity
      await logActivity(targetUser, 'duty_assigned', `New duty assigned: ${title}`);
      
      return res.status(201).json({ duty: newDuty.rows[0] });

    case 'respond':
      // Respond to a duty (start working on it)
      const { dutyId } = body;
      
      // Verify ownership
      const dutyCheck = await query(
        `SELECT * FROM duty_assignments WHERE id = $1 AND user_id = $2`,
        [dutyId, userId]
      );
      if (dutyCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Duty not found or access denied' });
      }
      
      const duty = dutyCheck.rows[0];
      
      // Calculate response time
      const responseTime = new Date() - new Date(duty.created_at);
      const responseMinutes = responseTime / (1000 * 60);
      
      // Calculate promptness score based on priority
      let promptnessScore = 100;
      const thresholds = { high: 30, medium: 60, low: 120 }; // minutes
      const threshold = thresholds[duty.priority] || 60;
      
      if (responseMinutes > threshold) {
        promptnessScore = Math.max(0, 100 - ((responseMinutes - threshold) / threshold) * 50);
      }
      
      const updateResult = await query(
        `UPDATE duty_assignments 
         SET status = 'in_progress', 
             responded_at = CURRENT_TIMESTAMP,
             promptness_score = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [Math.round(promptnessScore), dutyId]
      );
      
      // Log activity
      await logActivity(userId, 'duty_response', `Responded to duty: ${duty.title}`);
      
      return res.status(200).json({ duty: updateResult.rows[0] });

    case 'bulk-assign':
      // Bulk assign duties (supervisors only)
      if (userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const { duties: dutiesToAssign } = body;
      const createdDuties = [];
      
      for (const d of dutiesToAssign) {
        const result = await query(
          `INSERT INTO duty_assignments 
           (user_id, assigned_by, title, description, priority, due_at, category, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
           RETURNING *`,
          [d.assignedTo, userId, d.title, d.description, d.priority || 'medium', d.dueAt, d.category]
        );
        createdDuties.push(result.rows[0]);
      }
      
      return res.status(201).json({ duties: createdDuties, count: createdDuties.length });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'complete':
      // Mark duty as complete
      const { dutyId, notes, outcome } = body;
      
      // Verify ownership
      const dutyCheck = await query(
        `SELECT * FROM duty_assignments WHERE id = $1 AND user_id = $2`,
        [dutyId, userId]
      );
      if (dutyCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Duty not found or access denied' });
      }
      
      const updateResult = await query(
        `UPDATE duty_assignments 
         SET status = 'completed', 
             completed_at = CURRENT_TIMESTAMP,
             completion_notes = $1,
             outcome = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [notes, outcome, dutyId]
      );
      
      // Log activity
      await logActivity(userId, 'duty_completed', `Completed duty: ${dutyCheck.rows[0].title}`);
      
      return res.status(200).json({ duty: updateResult.rows[0] });

    case 'update':
      // Update duty details (owner or supervisor)
      const { dutyId: updateDutyId, title: newTitle, description: newDesc, priority: newPriority, dueAt: newDueAt } = body;
      
      // Check permissions
      const dutyOwner = await query(
        `SELECT user_id, assigned_by FROM duty_assignments WHERE id = $1`,
        [updateDutyId]
      );
      
      if (dutyOwner.rows.length === 0) {
        return res.status(404).json({ error: 'Duty not found' });
      }
      
      const canEdit = 
        dutyOwner.rows[0].user_id === userId || 
        dutyOwner.rows[0].assigned_by === userId ||
        userRole === 'consultant' || 
        userRole === 'super_admin';
      
      if (!canEdit) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const editResult = await query(
        `UPDATE duty_assignments 
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             priority = COALESCE($3, priority),
             due_at = COALESCE($4, due_at),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5
         RETURNING *`,
        [newTitle, newDesc, newPriority, newDueAt, updateDutyId]
      );
      
      return res.status(200).json({ duty: editResult.rows[0] });

    case 'cancel':
      // Cancel a duty (supervisor only or assigner)
      const { dutyId: cancelId, reason } = body;
      
      const cancelCheck = await query(
        `SELECT assigned_by FROM duty_assignments WHERE id = $1`,
        [cancelId]
      );
      
      if (cancelCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Duty not found' });
      }
      
      const canCancel = 
        cancelCheck.rows[0].assigned_by === userId ||
        userRole === 'consultant' || 
        userRole === 'super_admin';
      
      if (!canCancel) {
        return res.status(403).json({ error: 'Only the assigner or supervisors can cancel duties' });
      }
      
      await query(
        `UPDATE duty_assignments 
         SET status = 'cancelled',
             completion_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reason || 'Cancelled', cancelId]
      );
      
      return res.status(200).json({ success: true, message: 'Duty cancelled' });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handleDelete(req, res, userId, userRole) {
  // Only super_admin can delete duties permanently
  if (userRole !== 'super_admin') {
    return res.status(403).json({ error: 'Only super admin can delete duties' });
  }
  
  const { dutyId } = req.query;
  
  if (!dutyId) {
    return res.status(400).json({ error: 'Duty ID required' });
  }
  
  await query(`DELETE FROM duty_assignments WHERE id = $1`, [dutyId]);
  
  return res.status(200).json({ success: true, message: 'Duty deleted' });
}

async function logActivity(userId, activityType, description, metadata = {}) {
  const points = {
    'duty_assigned': 0,
    'duty_response': 5,
    'duty_completed': 10
  };
  
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, activityType, description, points[activityType] || 0, JSON.stringify(metadata)]
  );
}
