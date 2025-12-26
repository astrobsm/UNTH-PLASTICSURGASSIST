// Activity Logging API endpoints
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
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Activities API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, targetUserId, startDate, endDate, activityType, limit = 50 } = req.query;
  
  // Allow supervisors to view other users' activities
  const effectiveUserId = (userRole === 'consultant' || userRole === 'super_admin') && targetUserId 
    ? targetUserId 
    : userId;

  switch (action) {
    case 'list':
      let listQuery = `
        SELECT al.*, u.full_name as user_name, u.training_level
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      const listParams = [];
      
      // Filter by user (if not supervisor viewing all)
      if (!targetUserId || targetUserId !== 'all') {
        listParams.push(effectiveUserId);
        listQuery += ` AND al.user_id = $${listParams.length}`;
      }
      
      // Filter by activity type
      if (activityType) {
        listParams.push(activityType);
        listQuery += ` AND al.activity_type = $${listParams.length}`;
      }
      
      // Filter by date range
      if (startDate) {
        listParams.push(startDate);
        listQuery += ` AND al.created_at >= $${listParams.length}::date`;
      }
      if (endDate) {
        listParams.push(endDate);
        listQuery += ` AND al.created_at < ($${listParams.length}::date + INTERVAL '1 day')`;
      }
      
      listQuery += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit)}`;
      
      const listResult = await query(listQuery, listParams);
      return res.status(200).json({ activities: listResult.rows });

    case 'summary':
      // Get activity summary/statistics
      const summaryResult = await query(
        `SELECT 
           activity_type,
           COUNT(*) as count,
           SUM(points) as total_points
         FROM activity_logs 
         WHERE user_id = $1
         GROUP BY activity_type
         ORDER BY total_points DESC`,
        [effectiveUserId]
      );
      
      const totalPoints = await query(
        `SELECT SUM(points) as total FROM activity_logs WHERE user_id = $1`,
        [effectiveUserId]
      );
      
      return res.status(200).json({ 
        summary: summaryResult.rows,
        totalPoints: parseInt(totalPoints.rows[0].total) || 0
      });

    case 'daily':
      // Get daily activity breakdown
      const dailyResult = await query(
        `SELECT 
           DATE(created_at) as date,
           COUNT(*) as count,
           SUM(points) as total_points
         FROM activity_logs 
         WHERE user_id = $1 
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
        [effectiveUserId]
      );
      return res.status(200).json({ dailyActivities: dailyResult.rows });

    case 'leaderboard':
      // Get leaderboard for current period
      const leaderboardResult = await query(
        `SELECT 
           u.id, u.full_name, u.training_level,
           COUNT(al.id) as activity_count,
           COALESCE(SUM(al.points), 0) as total_points
         FROM users u
         LEFT JOIN activity_logs al ON u.id = al.user_id 
           AND al.created_at >= CURRENT_DATE - INTERVAL '30 days'
         WHERE u.is_active = true 
           AND u.role IN ('intern', 'registrar', 'senior_registrar')
         GROUP BY u.id, u.full_name, u.training_level
         ORDER BY total_points DESC
         LIMIT 20`,
        []
      );
      return res.status(200).json({ leaderboard: leaderboardResult.rows });

    case 'recent':
    default:
      // Get recent activities
      const recentResult = await query(
        `SELECT * FROM activity_logs 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [effectiveUserId, parseInt(limit)]
      );
      return res.status(200).json({ activities: recentResult.rows });
  }
}

async function handlePost(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'log':
      // Log a new activity
      const { activityType, description, metadata = {}, referenceId, referenceType } = body;
      
      // Calculate points based on activity type
      const points = getActivityPoints(activityType);
      
      const newActivity = await query(
        `INSERT INTO activity_logs 
         (user_id, activity_type, description, points, metadata, reference_id, reference_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [userId, activityType, description, points, JSON.stringify(metadata), referenceId, referenceType]
      );
      
      return res.status(201).json({ activity: newActivity.rows[0] });

    case 'batch':
      // Log multiple activities at once (for offline sync)
      const { activities } = body;
      
      if (!Array.isArray(activities)) {
        return res.status(400).json({ error: 'Activities must be an array' });
      }
      
      const insertedActivities = [];
      for (const activity of activities) {
        const pts = getActivityPoints(activity.activityType);
        const result = await query(
          `INSERT INTO activity_logs 
           (user_id, activity_type, description, points, metadata, reference_id, reference_type, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT DO NOTHING
           RETURNING *`,
          [
            userId, 
            activity.activityType, 
            activity.description, 
            pts, 
            JSON.stringify(activity.metadata || {}),
            activity.referenceId,
            activity.referenceType,
            activity.createdAt || new Date().toISOString()
          ]
        );
        if (result.rows[0]) {
          insertedActivities.push(result.rows[0]);
        }
      }
      
      return res.status(201).json({ 
        success: true, 
        inserted: insertedActivities.length,
        activities: insertedActivities 
      });

    case 'login':
      // Log login activity
      await query(
        `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
         VALUES ($1, 'login', 'User logged in', 1, $2)`,
        [userId, JSON.stringify({ userAgent: req.headers['user-agent'], ip: req.headers['x-forwarded-for'] || 'unknown' })]
      );
      return res.status(200).json({ success: true });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

function getActivityPoints(activityType) {
  const pointsMap = {
    // Login & Attendance
    'login': 1,
    'logout': 0,
    
    // Patient Management
    'patient_entry': 10,
    'patient_update': 5,
    'patient_view': 1,
    
    // Clinical Documentation
    'treatment_plan': 15,
    'treatment_plan_update': 8,
    'prescription': 8,
    'wound_care': 12,
    'wound_care_update': 6,
    'ward_round': 10,
    'discharge_summary': 15,
    
    // Surgical
    'surgery_booking': 20,
    'surgery_completed': 30,
    'surgery_note': 15,
    
    // Laboratory
    'lab_order': 6,
    'lab_result_review': 4,
    
    // Education
    'cbt_started': 5,
    'cbt_completed': 25,
    'cme_completed': 20,
    'cme_article_read': 10,
    
    // Administrative
    'duty_response': 5,
    'duty_completed': 10,
    'admission': 12,
    'discharge': 8,
    
    // Rotation
    'rotation_started': 0,
    'signout_requested': 0,
    'signout_approved': 0
  };
  
  return pointsMap[activityType] || 0;
}
