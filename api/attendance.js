// Attendance API endpoints
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

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

  // Parse sub-path for action
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/attendance', '').split('/').filter(Boolean);
  const action = pathParts[0] || req.query.action || '';

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId, userRole, action);
      case 'POST':
        return await handlePost(req, res, userId, userRole, action);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Attendance API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole, action) {
  switch (action) {
    case 'my-records': {
      // Get the current user's attendance records (login activity by day)
      const { startDate, endDate, limit = 90 } = req.query;

      let sql = `
        SELECT 
          DATE(created_at) as date,
          MIN(created_at) as first_login,
          MAX(created_at) as last_activity,
          COUNT(*) as activity_count
        FROM activity_logs
        WHERE user_id = $1 AND activity_type = 'login'
      `;
      const params = [userId];

      if (startDate) {
        params.push(startDate);
        sql += ` AND created_at >= $${params.length}::date`;
      }
      if (endDate) {
        params.push(endDate);
        sql += ` AND created_at < ($${params.length}::date + INTERVAL '1 day')`;
      }

      sql += ` GROUP BY DATE(created_at) ORDER BY date DESC LIMIT ${parseInt(limit)}`;

      const result = await query(sql, params);

      return res.status(200).json({
        records: result.rows,
        total: result.rows.length
      });
    }

    case 'summary': {
      // Get attendance summary for the authenticated user
      const totalDaysResult = await query(
        `SELECT COUNT(DISTINCT DATE(created_at)) as total_days
         FROM activity_logs
         WHERE user_id = $1 AND activity_type = 'login'`,
        [userId]
      );
      const totalDays = parseInt(totalDaysResult.rows[0].total_days) || 0;

      // Days in current month
      const currentMonthResult = await query(
        `SELECT COUNT(DISTINCT DATE(created_at)) as days
         FROM activity_logs
         WHERE user_id = $1 AND activity_type = 'login'
           AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
        [userId]
      );
      const currentMonthDays = parseInt(currentMonthResult.rows[0].days) || 0;

      // Days in last 30 days
      const last30Result = await query(
        `SELECT COUNT(DISTINCT DATE(created_at)) as days
         FROM activity_logs
         WHERE user_id = $1 AND activity_type = 'login'
           AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );
      const last30Days = parseInt(last30Result.rows[0].days) || 0;

      // Current streak (consecutive days ending today or yesterday)
      const streakResult = await query(
        `WITH login_dates AS (
           SELECT DISTINCT DATE(created_at) as login_date
           FROM activity_logs
           WHERE user_id = $1 AND activity_type = 'login'
           ORDER BY login_date DESC
         ),
         streak AS (
           SELECT login_date,
                  login_date - (ROW_NUMBER() OVER (ORDER BY login_date DESC))::int AS grp
           FROM login_dates
           WHERE login_date >= CURRENT_DATE - INTERVAL '365 days'
         )
         SELECT COUNT(*) as streak_length
         FROM streak
         WHERE grp = (
           SELECT grp FROM streak
           WHERE login_date IN (CURRENT_DATE, CURRENT_DATE - INTERVAL '1 day')
           LIMIT 1
         )`,
        [userId]
      );
      const currentStreak = parseInt(streakResult.rows[0]?.streak_length) || 0;

      // First login date
      const firstLoginResult = await query(
        `SELECT MIN(created_at) as first_login
         FROM activity_logs
         WHERE user_id = $1 AND activity_type = 'login'`,
        [userId]
      );

      // Get user's training level to calculate attendance score
      const userResult = await query(
        `SELECT training_level FROM users WHERE id = $1`,
        [userId]
      );
      const level = userResult.rows[0]?.training_level || 'house_officer';
      const loginDaysRequired = {
        house_officer: 25,
        junior_resident: 75,
        senior_resident: 150
      }[level] || 25;
      const attendanceScore = Math.min(100, Math.round((totalDays / loginDaysRequired) * 100 * 10) / 10);

      return res.status(200).json({
        totalDays,
        currentMonthDays,
        last30Days,
        currentStreak,
        firstLogin: firstLoginResult.rows[0]?.first_login || null,
        attendanceScore,
        loginDaysRequired,
        level
      });
    }

    case 'team': {
      // Admin/consultant: get team attendance overview
      if (!['admin', 'consultant', 'senior_registrar'].includes(userRole)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const teamResult = await query(
        `SELECT 
           u.id, u.full_name, u.role, u.training_level,
           COUNT(DISTINCT DATE(al.created_at)) as total_login_days,
           MAX(al.created_at) as last_login
         FROM users u
         LEFT JOIN activity_logs al ON u.id = al.user_id AND al.activity_type = 'login'
         WHERE u.is_active = true
         GROUP BY u.id, u.full_name, u.role, u.training_level
         ORDER BY total_login_days DESC`
      );

      return res.status(200).json({ team: teamResult.rows });
    }

    default:
      return res.status(400).json({ error: 'Invalid action. Use: my-records, summary, or team' });
  }
}

async function handlePost(req, res, userId, userRole, action) {
  switch (action) {
    case 'check-in': {
      // Record a manual check-in / attendance log
      const result = await query(
        `INSERT INTO activity_logs (user_id, activity_type, description, metadata)
         VALUES ($1, 'login', 'Manual attendance check-in', $2)
         RETURNING *`,
        [userId, JSON.stringify({ source: 'manual_checkin', timestamp: new Date().toISOString() })]
      );
      return res.status(201).json({ record: result.rows[0] });
    }

    default:
      return res.status(400).json({ error: 'Invalid action. Use: check-in' });
  }
}
