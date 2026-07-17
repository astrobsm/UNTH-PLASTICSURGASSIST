// Rotation Configuration API
// Manages admin rotation settings, responsibilities, and analytics
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { getRequirements as sharedRequirements, pctOf, computeOverall, computeEligibility } from './_lib/traineeScoring.js';
import { getHOFullMetrics } from './ho-tracking.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

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
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Rotation Config API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, level, configId, targetUserId } = req.query;

  switch (action) {
    case 'configs': {
      // Get rotation configs (active or all)
      let sql = `SELECT * FROM rotation_configs WHERE 1=1`;
      const params = [];
      if (level) {
        params.push(level);
        sql += ` AND level = $${params.length}`;
      }
      sql += ` ORDER BY created_at DESC`;
      const result = await query(sql, params);
      return res.status(200).json({ configs: result.rows });
    }

    case 'active-configs': {
      const result = await query(
        `SELECT * FROM rotation_configs WHERE is_active = true ORDER BY level`
      );
      return res.status(200).json({ configs: result.rows });
    }

    case 'responsibilities': {
      const effectiveUserId = (userRole === 'consultant' || userRole === 'admin' || userRole === 'super_admin') && targetUserId
        ? targetUserId : userId;
      const result = await query(
        `SELECT r.*, u.full_name as user_name, a.full_name as assigned_by_name
         FROM assigned_responsibilities r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN users a ON r.assigned_by = a.id
         WHERE r.user_id = $1
         ORDER BY r.assigned_at DESC`,
        [effectiveUserId]
      );
      return res.status(200).json({ responsibilities: result.rows });
    }

    case 'all-responsibilities': {
      if (userRole !== 'consultant' && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const result = await query(
        `SELECT r.*, u.full_name as user_name, a.full_name as assigned_by_name
         FROM assigned_responsibilities r
         LEFT JOIN users u ON r.user_id = u.id
         LEFT JOIN users a ON r.assigned_by = a.id
         ORDER BY r.assigned_at DESC
         LIMIT 200`
      );
      return res.status(200).json({ responsibilities: result.rows });
    }

    case 'all-analytics': {
      if (userRole !== 'consultant' && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const analytics = await computeAllTraineeAnalytics();
      return res.status(200).json({ analytics });
    }

    case 'trainee-analytics': {
      const tUserId = targetUserId || userId;
      const analytics = await computeTraineeAnalytics(tUserId);
      return res.status(200).json({ analytics });
    }

    default:
      return res.status(200).json({ message: 'Rotation Config API' });
  }
}

async function handlePost(req, res, userId, userRole) {
  const { action } = req.query || {};
  const bodyAction = req.body?.action || action;

  switch (bodyAction) {
    case 'save': {
      if (userRole !== 'consultant' && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only admins can manage rotation configs' });
      }
      const { config } = req.body;
      if (!config) return res.status(400).json({ error: 'Config required' });

      // Ensure table exists
      await ensureTablesExist();

      // Deactivate existing active configs for this level if setting new active one
      if (config.is_active) {
        await query(
          `UPDATE rotation_configs SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE level = $1 AND is_active = true`,
          [config.level]
        );
      }

      const result = await query(
        `INSERT INTO rotation_configs (level, commencement_date, end_date, department, is_active, notes, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [config.level, config.commencement_date, config.end_date, config.department || 'Plastic Surgery', 
         config.is_active !== false, config.notes || '', userId]
      );

      return res.status(201).json({ config: result.rows[0] });
    }

    case 'deactivate': {
      if (userRole !== 'consultant' && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const { configId } = req.body;
      await query(
        `UPDATE rotation_configs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [configId]
      );
      return res.status(200).json({ success: true });
    }

    case 'assign-responsibility': {
      if (userRole !== 'consultant' && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only supervisors can assign responsibilities' });
      }
      await ensureTablesExist();
      const { responsibility } = req.body;
      if (!responsibility) return res.status(400).json({ error: 'Responsibility data required' });

      const result = await query(
        `INSERT INTO assigned_responsibilities 
         (user_id, title, description, assigned_by, due_date, status, priority, assigned_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
         RETURNING *`,
        [responsibility.user_id, responsibility.title, responsibility.description || '',
         userId, responsibility.due_date || null, 'pending', responsibility.priority || 'medium']
      );

      return res.status(201).json({ responsibility: result.rows[0] });
    }

    case 'update-responsibility': {
      const { respId, status, notes } = req.body;
      let sql = `UPDATE assigned_responsibilities SET status = $1, updated_at = CURRENT_TIMESTAMP`;
      const params = [status];
      
      if (status === 'completed') {
        params.push(new Date().toISOString());
        sql += `, completed_at = $${params.length}`;
        if (notes) {
          params.push(notes);
          sql += `, completion_notes = $${params.length}`;
        }
      }
      
      params.push(respId);
      sql += ` WHERE id = $${params.length} RETURNING *`;
      
      const result = await query(sql, params);
      return res.status(200).json({ responsibility: result.rows[0] });
    }

    case 'bulk-assign-rotations': {
      if (userRole !== 'consultant' && userRole !== 'admin' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Access denied' });
      }
      const { level: rotLevel, commencementDate, endDate } = req.body;
      
      // Get all active users at this level
      const usersResult = await query(
        `SELECT id FROM users WHERE is_active = true AND 
         (training_level = $1 OR role = $1)`,
        [rotLevel]
      );

      let created = 0;
      for (const user of usersResult.rows) {
        // Check if already has active rotation
        const existing = await query(
          `SELECT id FROM trainee_rotations 
           WHERE user_id = $1 AND status IN ('active', 'extended')`,
          [user.id]
        );
        
        if (existing.rows.length === 0) {
          await query(
            `INSERT INTO trainee_rotations 
             (user_id, level, start_date, expected_end_date, status, department)
             VALUES ($1, $2, $3, $4, 'active', 'Plastic Surgery')`,
            [user.id, rotLevel, commencementDate, endDate]
          );
          created++;
        }
      }

      return res.status(201).json({ success: true, rotationsCreated: created });
    }

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function ensureTablesExist() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS rotation_configs (
        id SERIAL PRIMARY KEY,
        level VARCHAR(50) NOT NULL,
        commencement_date DATE NOT NULL,
        end_date DATE NOT NULL,
        department VARCHAR(100) DEFAULT 'Plastic Surgery',
        is_active BOOLEAN DEFAULT true,
        notes TEXT DEFAULT '',
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS assigned_responsibilities (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        assigned_by VARCHAR(100) NOT NULL,
        due_date DATE,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(20) DEFAULT 'medium',
        completion_notes TEXT,
        completed_at TIMESTAMP,
        score INTEGER,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.log('Tables may already exist:', error.message);
  }
}

async function computeAllTraineeAnalytics() {
  const analytics = [];
  
  try {
    // Get all active trainees
    const users = await query(
      `SELECT u.id, u.full_name, u.training_level, u.role, u.is_active
       FROM users u
       WHERE u.is_active = true 
       AND u.role IN ('intern', 'registrar', 'senior_registrar', 'house_officer', 'junior_registrar', 'senior_registrar')
       ORDER BY u.training_level, u.full_name`
    );

    for (const user of users.rows) {
      try {
        const a = await computeTraineeAnalytics(user.id);
        if (a) analytics.push(a);
      } catch (err) {
        console.warn(`Failed to compute analytics for user ${user.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('Error computing all trainee analytics:', error);
  }
  
  return analytics;
}

async function computeTraineeAnalytics(userId) {
  try {
    // Get user info
    const userResult = await query(
      `SELECT id, full_name, training_level, role FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) return null;
    const user = userResult.rows[0];
    
    const level = user.training_level || mapRoleToLevel(user.role);
    
    // Requirements by level — single source of truth (comprehensive scoring).
    const reqs = sharedRequirements(level);
    
    // Get rotation info
    const rotationResult = await query(
      `SELECT * FROM trainee_rotations 
       WHERE user_id = $1 AND status IN ('active', 'extended')
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const rotation = rotationResult.rows[0];
    
    // Get rotation config
    let rotConfig = null;
    try {
      const configResult = await query(
        `SELECT * FROM rotation_configs WHERE level = $1 AND is_active = true LIMIT 1`,
        [level]
      );
      rotConfig = configResult.rows[0];
    } catch (e) { /* table may not exist */ }
    
    // Use rotation config dates if available, otherwise rotation dates
    const startDate = rotConfig?.commencement_date || rotation?.start_date || null;
    const endDate = rotConfig?.end_date || rotation?.expected_end_date || null;
    
    const now = new Date();
    let daysRemaining = 0, daysElapsed = 0, totalDays = 0, progressPercent = 0;
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      totalDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
      daysElapsed = Math.max(0, Math.ceil((now - start) / (24 * 60 * 60 * 1000)));
      daysRemaining = Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
      progressPercent = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;
    }
    
    // Pull the SAME unified metrics the HO Tracking + Training Admin views use,
    // so the trainee's own score matches exactly. Then re-score with this
    // trainee's level requirements via the shared comprehensive formula.
    let hoMetrics = {};
    try {
      const hoResult = await getHOFullMetrics(userId, user.full_name, user.username);
      hoMetrics = hoResult.metrics || {};
    } catch (e) { console.warn('[rotation-config] getHOFullMetrics failed:', e?.message || e); }

    const cbtTestsCompleted = hoMetrics.cbtTestsCompleted || 0;
    const cbtScore = hoMetrics.cbtAvgScore || 0;
    const selfAssessmentsCompleted = hoMetrics.selfAssessmentsCompleted || 0;
    const selfAssessmentScore = hoMetrics.selfAssessmentAvgScore || 0;
    const patientEntries = hoMetrics.patientEntries || 0;   // distinct patients served
    const dutiesCompleted = hoMetrics.dutiesCompleted || 0;
    const loginDays = hoMetrics.loginDays || 0;
    const cmeTopicsCompleted = hoMetrics.cmeTopicsCompleted || 0;
    const loginDaysRequired = reqs.loginDays;

    // Component scores (0–100) for this trainee's level.
    const cmeScoreComp = pctOf(cmeTopicsCompleted, reqs.cmeTopics);
    const patientCareScore = pctOf(patientEntries, reqs.patients);
    const dutyPromptnessScore = pctOf(dutiesCompleted, reqs.duties);
    const attendanceScore = pctOf(loginDays, reqs.loginDays);
    const components = {
      cme: cmeScoreComp, cbt: cbtScore, selfAssessment: selfAssessmentScore,
      clinical: patientCareScore, duties: dutyPromptnessScore, attendance: attendanceScore,
    };
    const overallScore = Math.round(computeOverall(components));

    // Responsibilities
    let assignedResponsibilities = 0, completedResponsibilities = 0, pendingResponsibilities = 0;
    try {
      const respResult = await query(
        `SELECT status, COUNT(*) as count FROM assigned_responsibilities 
         WHERE user_id = $1 GROUP BY status`,
        [userId]
      );
      for (const row of respResult.rows) {
        const cnt = parseInt(row.count);
        assignedResponsibilities += cnt;
        if (row.status === 'completed') completedResponsibilities += cnt;
        if (row.status === 'pending' || row.status === 'in_progress') pendingResponsibilities += cnt;
      }
    } catch (e) { /* table may not exist */ }
    
    // CME progress
    const topicsCompleted = cmeTopicsCompleted;
    const totalTopics = reqs.cmeTopics;
    const cmeProgress = totalTopics > 0 ? Math.min(100, Math.round((topicsCompleted / totalTopics) * 100)) : 0;

    // Sign-out eligibility — comprehensive shared formula (CME + CBT +
    // self-assessment + clinical + duties + attendance, with section minimums).
    const counts = {
      cmeTopics: topicsCompleted,
      cbtTests: cbtTestsCompleted,
      selfAssessments: selfAssessmentsCompleted,
      patients: patientEntries,
      duties: dutiesCompleted,
      loginDays,
    };
    const eligibility = computeEligibility(counts, components, reqs, overallScore);
    const requirementsMet = eligibility.met;
    const requirementsNotMet = eligibility.notMet;
    const signOutEligible = eligibility.eligible;

    return {
      userId: user.id,
      userName: user.full_name || 'Unknown',
      level,
      role: user.role,
      rotationStatus: rotation?.status || 'none',
      rotationStart: startDate ? new Date(startDate).toISOString().split('T')[0] : null,
      rotationEnd: endDate ? new Date(endDate).toISOString().split('T')[0] : null,
      daysRemaining,
      daysElapsed,
      totalDays,
      progressPercent,
      cbtScore: Math.round(cbtScore),
      cbtTestsCompleted,
      cbtTestsRequired: reqs.cbtTests,
      selfAssessmentScore: Math.round(selfAssessmentScore),
      selfAssessmentsCompleted,
      selfAssessmentsRequired: reqs.selfAssessments,
      patientCareScore: Math.round(patientCareScore),
      patientEntries,
      patientEntriesRequired: reqs.patients,
      dutyPromptnessScore: Math.round(dutyPromptnessScore),
      dutiesCompleted,
      dutiesRequired: reqs.duties,
      attendanceScore: Math.round(attendanceScore),
      loginDays,
      loginDaysRequired: reqs.loginDays,
      overallScore,
      assignedResponsibilities,
      completedResponsibilities,
      pendingResponsibilities,
      topicsCompleted,
      totalTopics,
      cmeProgress,
      signOutEligible,
      requirementsMet,
      requirementsNotMet
    };
  } catch (error) {
    console.error(`Error computing analytics for ${userId}:`, error);
    return null;
  }
}

function mapRoleToLevel(role) {
  switch (role) {
    case 'intern':
    case 'house_officer':
      return 'house_officer';
    case 'registrar':
    case 'junior_registrar':
      return 'junior_resident';
    case 'senior_registrar':
      return 'senior_resident';
    default:
      return 'house_officer';
  }
}
