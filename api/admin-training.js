// Admin Training Management API
// Provides admin oversight of all trainees, progress tracking, and warning notifications
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
// Reuse the unified metrics function so the admin table view shows the SAME
// numbers as the HO Tracking card view (single source of truth).
import { getHOFullMetrics } from './ho-tracking.js';

const ADMIN_ROLES = ['consultant', 'super_admin', 'admin'];
let tablesEnsured = false;

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const authResult = authenticateRequest(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const userRole = authResult.user.role;
  if (!ADMIN_ROLES.includes(userRole)) {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  try {
    if (!tablesEnsured) {
      await ensureTables();
      tablesEnsured = true;
    }
    const { method } = req;
    switch (method) {
      case 'GET': return await handleGet(req, res, authResult.user);
      case 'POST': return await handlePost(req, res, authResult.user);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Admin Training API error:', error);
    return res.status(500).json({ error: `Server error: ${error.message}`, message: error.message, hint: error.detail || error.code || '' });
  }
}

async function ensureTables() {
  // Ensure phone column on users
  await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`).catch(() => {});
  // Add created_by to clinical tables that are missing it
  const tablesNeedingCreatedBy = ['prescriptions', 'ward_rounds', 'lab_orders'];
  for (const tbl of tablesNeedingCreatedBy) {
    await query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS created_by INTEGER`).catch(() => {});
  }

  await query(`
    CREATE TABLE IF NOT EXISTS training_warnings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      sent_by INTEGER NOT NULL,
      warning_type VARCHAR(50) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      severity VARCHAR(20) DEFAULT 'warning',
      read BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS trainee_rotations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      level VARCHAR(50) NOT NULL,
      start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expected_end_date TIMESTAMP,
      actual_end_date TIMESTAMP,
      status VARCHAR(30) DEFAULT 'active',
      extension_count INTEGER DEFAULT 0,
      extension_reasons JSONB DEFAULT '[]',
      sign_out_approved BOOLEAN DEFAULT false,
      sign_out_approved_by INTEGER,
      sign_out_approved_at TIMESTAMP,
      sign_out_comments TEXT,
      final_score NUMERIC,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      activity_type VARCHAR(50) NOT NULL,
      description TEXT,
      points INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS duty_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      assigned_by INTEGER,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      due_at TIMESTAMP,
      responded_at TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(30) DEFAULT 'pending',
      priority VARCHAR(20) DEFAULT 'medium',
      promptness_score INTEGER,
      completion_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function handleGet(req, res, adminUser) {
  const { action, userId, level } = req.query;

  switch (action) {
    case 'all-trainees': {
      // Comprehensive trainee list with live metrics
      const trainees = await query(`
        SELECT u.id, u.username, u.full_name, u.role, u.email, u.phone,
               u.created_at as registered_at
        FROM users u
        WHERE u.role IN ('intern', 'registrar', 'junior_registrar', 'senior_registrar', 'house_officer', 'junior_resident', 'senior_resident')
          AND u.is_active = true
        ORDER BY u.role, u.full_name
      `);

      const enriched = [];
      for (const t of trainees.rows) {
        const traineeLevel = roleToLevel(t.role);
        const metrics = await getTraineeMetrics(t.id, traineeLevel, t.full_name, t.username);
        let rotation = await getActiveRotation(t.id);
        // Backfill: ensure every active trainee has a rotation so their metrics
        // are always tracked. Start from their onboarding date so no historical
        // activity is lost when the rotation is created retroactively.
        if (!rotation) {
          rotation = await backfillRotation(t.id, traineeLevel, t.registered_at);
        }
        const reqs = getRequirements(traineeLevel);
        const eligibility = computeEligibility(metrics, reqs);
        const warningCount = await query(
          `SELECT COUNT(*) as cnt FROM training_warnings WHERE user_id = $1 AND read = false`, [t.id]
        );

        enriched.push({
          ...t,
          level: traineeLevel,
          metrics,
          rotation: rotation || null,
          requirements: reqs,
          eligibility,
          unreadWarnings: parseInt(warningCount.rows[0].cnt),
        });
      }

      return res.status(200).json({ trainees: enriched });
    }

    case 'trainee-detail': {
      if (!userId) return res.status(400).json({ error: 'userId required' });
      const user = await query(`SELECT id, username, full_name, role, email, created_at FROM users WHERE id = $1`, [userId]);
      if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const t = user.rows[0];
      const traineeLevel = level || roleToLevel(t.role);
      const metrics = await getTraineeMetrics(t.id, traineeLevel, t.full_name, t.username);
      const rotation = await getActiveRotation(t.id);
      const reqs = getRequirements(traineeLevel);
      const eligibility = computeEligibility(metrics, reqs);

      // Activities
      const activities = await query(
        `SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`, [userId]
      );

      // CBT attempts
      const cbtAttempts = await query(
        `SELECT * FROM cbt_attempts WHERE user_id = $1 ORDER BY created_at DESC`, [userId]
      );

      // Warnings
      const warnings = await query(
        `SELECT tw.*, u.full_name as sent_by_name FROM training_warnings tw
         LEFT JOIN users u ON tw.sent_by = u.id
         WHERE tw.user_id = $1 ORDER BY tw.created_at DESC`, [userId]
      );

      // Duties
      const duties = await query(
        `SELECT * FROM duty_assignments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]
      );

      // Training progress
      const topicProgress = await query(
        `SELECT * FROM training_progress WHERE user_id = $1 ORDER BY completed_at DESC`, [userId]
      );

      return res.status(200).json({
        trainee: {
          ...t,
          level: traineeLevel,
          metrics,
          rotation: rotation || null,
          requirements: reqs,
          eligibility,
        },
        activities: activities.rows,
        cbtAttempts: cbtAttempts.rows,
        warnings: warnings.rows,
        duties: duties.rows,
        topicProgress: topicProgress.rows,
      });
    }

    case 'warnings': {
      const targetId = userId || null;
      let warningsQuery;
      if (targetId) {
        warningsQuery = await query(
          `SELECT tw.*, u.full_name as sent_by_name, u2.full_name as recipient_name
           FROM training_warnings tw
           LEFT JOIN users u ON tw.sent_by = u.id
           LEFT JOIN users u2 ON tw.user_id = u2.id
           WHERE tw.user_id = $1 ORDER BY tw.created_at DESC`, [targetId]
        );
      } else {
        warningsQuery = await query(
          `SELECT tw.*, u.full_name as sent_by_name, u2.full_name as recipient_name
           FROM training_warnings tw
           LEFT JOIN users u ON tw.sent_by = u.id
           LEFT JOIN users u2 ON tw.user_id = u2.id
           ORDER BY tw.created_at DESC LIMIT 100`
        );
      }
      return res.status(200).json({ warnings: warningsQuery.rows });
    }

    case 'debug-metrics': {
      // Debug endpoint to diagnose training metrics issues
      const trainees = await query(`
        SELECT id, username, full_name, role FROM users
        WHERE role IN ('intern', 'registrar', 'junior_registrar', 'senior_registrar', 'house_officer', 'junior_resident', 'senior_resident')
          AND is_active = true
      `);
      
      const debug = {};
      for (const t of trainees.rows) {
        const uid = String(t.id);
        const checks = {};
        
        // Clinical tables with created_by (INTEGER)
        try { const r = await query(`SELECT COUNT(*) as cnt FROM patients WHERE created_by = $1`, [t.id]); checks.patients_created_by = parseInt(r.rows[0].cnt); } catch(e) { checks.patients_created_by = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM treatment_plans WHERE created_by = $1`, [t.id]); checks.treatment_plans_created_by = parseInt(r.rows[0].cnt); } catch(e) { checks.treatment_plans_created_by = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM admissions WHERE created_by = $1`, [t.id]); checks.admissions_created_by = parseInt(r.rows[0].cnt); } catch(e) { checks.admissions_created_by = `ERR: ${e.message}`; }

        // Audit logs with user_id VARCHAR - try both ID and name matching
        try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = $1`, [uid]); checks.audit_logs_by_id = parseInt(r.rows[0].cnt); } catch(e) { checks.audit_logs_by_id = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE LOWER(user_name) = LOWER($1)`, [t.full_name]); checks.audit_logs_by_name = parseInt(r.rows[0].cnt); } catch(e) { checks.audit_logs_by_name = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = $1 OR LOWER(user_name) = LOWER($2)`, [uid, t.full_name]); checks.audit_logs_combined = parseInt(r.rows[0].cnt); } catch(e) { checks.audit_logs_combined = `ERR: ${e.message}`; }

        // Activity logs (user_id INTEGER)
        try { const r = await query(`SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = $1`, [t.id]); checks.activity_logs = parseInt(r.rows[0].cnt); } catch(e) { checks.activity_logs = `ERR: ${e.message}`; }

        // CBT, training, CME
        try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts WHERE user_id = $1`, [t.id]); checks.cbt_attempts_int = parseInt(r.rows[0].cnt); } catch(e) { checks.cbt_attempts_int = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts WHERE user_id::text = $1`, [uid]); checks.cbt_attempts_str = parseInt(r.rows[0].cnt); } catch(e) { checks.cbt_attempts_str = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1`, [t.id]); checks.training_progress_int = parseInt(r.rows[0].cnt); } catch(e) { checks.training_progress_int = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id::text = $1`, [uid]); checks.training_progress_str = parseInt(r.rows[0].cnt); } catch(e) { checks.training_progress_str = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_progress WHERE user_id = $1`, [uid]); checks.cme_progress = parseInt(r.rows[0].cnt); } catch(e) { checks.cme_progress = `ERR: ${e.message}`; }
        try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_reading_progress WHERE user_id = $1`, [uid]); checks.cme_reading_progress = parseInt(r.rows[0].cnt); } catch(e) { checks.cme_reading_progress = `ERR: ${e.message}`; }

        // Distinct values in key tables
        try { 
          const r = await query(`SELECT DISTINCT created_by FROM patients WHERE created_by IS NOT NULL LIMIT 10`); 
          checks.patients_created_by_values = r.rows.map(r => r.created_by);
        } catch(e) { checks.patients_created_by_values = `ERR: ${e.message}`; }
        try { 
          const r = await query(`SELECT DISTINCT user_id, user_name FROM audit_logs LIMIT 10`); 
          checks.audit_logs_users = r.rows.map(r => `id=${r.user_id},name=${r.user_name}`);
        } catch(e) { checks.audit_logs_users = `ERR: ${e.message}`; }

        // Global totals
        try { const r = await query(`SELECT COUNT(*) as cnt FROM patients`); checks.total_patients = parseInt(r.rows[0].cnt); } catch(e) {}
        try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs`); checks.total_audit_logs = parseInt(r.rows[0].cnt); } catch(e) {}
        try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts`); checks.total_cbt_attempts = parseInt(r.rows[0].cnt); } catch(e) {}
        
        // Computed metrics
        const traineeLevel = roleToLevel(t.role);
        const metrics = await getTraineeMetrics(t.id, traineeLevel, t.full_name, t.username);
        checks.computed_metrics = metrics;
        
        debug[`${t.full_name} (id=${t.id}, role=${t.role})`] = checks;
      }
      
      return res.status(200).json({ debug });
    }

    default:
      return res.status(400).json({ error: 'Invalid action. Use: all-trainees, trainee-detail, warnings, debug-metrics' });
  }
}

async function handlePost(req, res, adminUser) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'send-warning': {
      const { userId: targetUserId, warningType, subject, message, severity } = body;
      if (!targetUserId || !subject || !message) {
        return res.status(400).json({ error: 'userId, subject, and message are required' });
      }

      const result = await query(
        `INSERT INTO training_warnings (user_id, sent_by, warning_type, subject, message, severity)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [targetUserId, adminUser.id, warningType || 'general', subject, message, severity || 'warning']
      );

      return res.status(201).json({ warning: result.rows[0], message: 'Warning notification sent' });
    }

    case 'assign-duty': {
      const { userId: targetUserId, title, description, priority, dueAt } = body;
      if (!targetUserId || !title) {
        return res.status(400).json({ error: 'userId and title are required' });
      }

      const result = await query(
        `INSERT INTO duty_assignments (user_id, title, description, assigned_by, priority, due_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [targetUserId, title, description || '', adminUser.id, priority || 'medium', dueAt || null]
      );

      return res.status(201).json({ duty: result.rows[0] });
    }

    case 'start-rotation': {
      const { userId: targetUserId, level: rotLevel } = body;
      if (!targetUserId || !rotLevel) {
        return res.status(400).json({ error: 'userId and level are required' });
      }

      const existing = await query(
        `SELECT id FROM trainee_rotations WHERE user_id = $1 AND status IN ('active', 'extended')`, [targetUserId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Active rotation already exists for this user' });
      }

      const durations = { house_officer: 30, junior_resident: 90, senior_resident: 180 };
      const days = durations[rotLevel] || 30;

      const result = await query(
        `INSERT INTO trainee_rotations (user_id, level, start_date, expected_end_date, status)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 day' * $3, 'active')
         RETURNING *`,
        [targetUserId, rotLevel, days]
      );

      return res.status(201).json({ rotation: result.rows[0] });
    }

    case 'extend-rotation': {
      const { rotationId, reason, days } = body;
      if (!rotationId) return res.status(400).json({ error: 'rotationId is required' });

      const extDays = days || 7;
      await query(
        `UPDATE trainee_rotations
         SET expected_end_date = expected_end_date + INTERVAL '1 day' * $1,
             extension_count = extension_count + 1,
             extension_reasons = extension_reasons || $2::jsonb,
             status = 'extended',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [extDays, JSON.stringify([reason || 'Admin extension']), rotationId]
      );

      return res.status(200).json({ message: `Rotation extended by ${extDays} days` });
    }

    case 'approve-signout': {
      const { rotationId, approved, comments, finalScore } = body;
      if (!rotationId) return res.status(400).json({ error: 'rotationId is required' });

      if (approved) {
        await query(
          `UPDATE trainee_rotations
           SET status = 'signed_out', actual_end_date = CURRENT_TIMESTAMP,
               sign_out_approved = true, sign_out_approved_by = $1,
               sign_out_approved_at = CURRENT_TIMESTAMP,
               sign_out_comments = COALESCE(sign_out_comments, '') || ' | Approved: ' || $2,
               final_score = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [adminUser.id, comments || 'Approved', finalScore || 0, rotationId]
        );
      } else {
        await query(
          `UPDATE trainee_rotations
           SET status = 'active',
               sign_out_comments = COALESCE(sign_out_comments, '') || ' | Rejected: ' || $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [comments || 'Requirements not met', rotationId]
        );
      }

      return res.status(200).json({ success: true, approved });
    }

    case 'update-phone': {
      const { userId: targetUserId, phone } = body;
      if (!targetUserId || !phone) {
        return res.status(400).json({ error: 'userId and phone are required' });
      }
      // Ensure phone column exists
      await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50)`).catch(() => {});
      await query(
        'UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2',
        [phone.trim(), targetUserId]
      );
      return res.status(200).json({ message: 'Phone number updated' });
    }

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

// ── Helpers ──

function roleToLevel(role) {
  const map = {
    intern: 'house_officer',
    house_officer: 'house_officer',
    registrar: 'junior_resident',
    junior_registrar: 'junior_resident',
    junior_resident: 'junior_resident',
    senior_registrar: 'senior_resident',
    senior_resident: 'senior_resident',
  };
  return map[role] || 'house_officer';
}

function getRequirements(level) {
  const reqs = {
    house_officer:   { cbtTests: 4, patientEntries: 30, duties: 20, loginDays: 25, cmeTopics: 50, overallScore: 70 },
    junior_resident: { cbtTests: 12, patientEntries: 100, duties: 60, loginDays: 75, cmeTopics: 50, overallScore: 70 },
    senior_resident: { cbtTests: 24, patientEntries: 200, duties: 120, loginDays: 150, cmeTopics: 50, overallScore: 70 },
  };
  return reqs[level] || reqs.house_officer;
}

async function getTraineeMetrics(userId, level, fullName, username) {
  const lvl = level || 'house_officer';
  const reqs = getRequirements(lvl);

  // Delegate raw counts to the unified HO metrics function (same logic as the
  // HO Tracking page, so both views stay perfectly in sync). It returns counts
  // scored against house-officer thresholds; we re-score below using the
  // requirements appropriate to this trainee's level (HO / JR / SR).
  let hoResult;
  try {
    hoResult = await getHOFullMetrics(userId, fullName, username);
  } catch (e) {
    console.error('[admin-training] getHOFullMetrics failed:', e?.message || e);
    return {
      cbtTestsCompleted: 0,
      cbtAvgScore: 0,
      patientEntries: 0,
      patientScore: 0,
      dutiesCompleted: 0,
      dutyScore: 0,
      loginDays: 0,
      attendanceScore: 0,
      cmeTopicsCompleted: 0,
      overallScore: 0,
    };
  }

  const m = hoResult.metrics || {};
  const cbtCompleted = m.cbtTestsCompleted || 0;
  const cbtAvgScore = m.cbtAvgScore || 0;
  const patientCount = m.patientEntries || 0;     // distinct patients served
  const dutiesCount = m.dutiesCompleted || 0;
  const loginDays = m.loginDays || 0;
  const cmeCount = m.cmeTopicsCompleted || 0;

  // Re-score using level-specific requirements
  const patientScore = Math.min(100, (patientCount / reqs.patientEntries) * 100);
  const dutyScore = Math.min(100, (dutiesCount / reqs.duties) * 100);
  const attendanceScore = Math.min(100, (loginDays / reqs.loginDays) * 100);
  const overallScore = (cbtAvgScore * 0.30) + (patientScore * 0.35) + (dutyScore * 0.25) + (attendanceScore * 0.10);

  return {
    cbtTestsCompleted: cbtCompleted,
    cbtAvgScore: Math.round(cbtAvgScore * 10) / 10,
    patientEntries: patientCount,
    patientScore: Math.round(patientScore * 10) / 10,
    dutiesCompleted: dutiesCount,
    dutyScore: Math.round(dutyScore * 10) / 10,
    loginDays,
    attendanceScore: Math.round(attendanceScore * 10) / 10,
    cmeTopicsCompleted: cmeCount,
    overallScore: Math.round(overallScore * 10) / 10,
  };
}

// Legacy local metrics implementation retained for reference (not used).
// Replaced by delegation to getHOFullMetrics above.
async function _legacyGetTraineeMetrics(userId, level, fullName, username) {
  const lvl = level || 'house_officer';
  const uid = String(userId);       // For VARCHAR user_id columns (audit_logs, cme_progress, cme_reading_progress)
  const uidInt = parseInt(userId);   // For INTEGER user_id columns (cbt_attempts, training_progress, activity_logs)

  // Helper: safely run a query, returns default on error
  async function safeQuery(sql, params, defaultVal) {
    try {
      const r = await query(sql, params);
      return r.rows[0] || defaultVal;
    } catch (e) { return defaultVal; }
  }

  // ── 1. CBT Tests (1 query) ──
  const cbtRow = await safeQuery(
    `SELECT COUNT(*) as completed, COALESCE(AVG(
      CASE WHEN percentage IS NOT NULL AND percentage > 0 THEN percentage
           WHEN score IS NOT NULL AND total_marks > 0 THEN (score::numeric / total_marks) * 100
           ELSE 0 END
    ), 0) as avg_score
     FROM cbt_attempts WHERE (user_id = $1 OR user_id::text = $2) AND (completed = true OR passed = true)`,
    [uidInt, uid], { completed: 0, avg_score: 0 }
  );
  const cbtCompleted = parseInt(cbtRow.completed) || 0;
  const cbtAvgScore = parseFloat(cbtRow.avg_score) || 0;

  // ── User matching clause for VARCHAR user columns (audit_logs, etc.) ──
  const auditUserClause = fullName
    ? `(user_id = $1 OR LOWER(user_name) = LOWER($2))`
    : `user_id = $1`;
  const auditUserParams = fullName ? [uid, fullName] : [uid];

  // Name-match clause for tables that store user as VARCHAR name string
  // Match by full_name, username, or stringified user id
  const nameMatchValues = [uid]; // $1 = user id as string
  let nameMatchClause = `($COL = $1`;
  let nameParamIdx = 1;
  if (fullName) {
    nameParamIdx++;
    nameMatchValues.push(fullName);
    nameMatchClause += ` OR LOWER($COL) = LOWER($${nameParamIdx})`;
  }
  if (username) {
    nameParamIdx++;
    nameMatchValues.push(username);
    nameMatchClause += ` OR LOWER($COL) = LOWER($${nameParamIdx})`;
  }
  nameMatchClause += `)`;

  // ── 2. Patient Care Entries — count from ALL clinical tables ──
  let patientCount = 0;

  // 2a. Tables with created_by INTEGER
  for (const tbl of ['patients', 'treatment_plans', 'admissions', 'surgeries']) {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE created_by = $1`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2a2. prescriptions uses prescribed_by (not created_by)
  {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM prescriptions WHERE prescribed_by = $1`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2a3. ward_rounds uses user_id or created_by
  {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ward_rounds WHERE user_id = $1 OR created_by = $1`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2a4. lab_orders uses ordered_by (not created_by)
  {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM lab_orders WHERE ordered_by = $1`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2a5. discharge_summaries uses prepared_by (not created_by)
  {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM discharge_summaries WHERE prepared_by = $1`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2b. Tables with recorded_by INTEGER (wound_care_records)
  const woundRow = await safeQuery(`SELECT COUNT(*) as cnt FROM wound_care_records WHERE recorded_by = $1`, [uidInt], { cnt: 0 });
  patientCount += parseInt(woundRow.cnt) || 0;

  // 2c. Tables with recorded_by VARCHAR — match by name/id
  for (const tbl of ['vital_signs', 'fluid_balance']) {
    const clause = nameMatchClause.replace(/\$COL/g, 'recorded_by');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE ${clause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2d. progress_notes — author VARCHAR
  {
    const clause = nameMatchClause.replace(/\$COL/g, 'author');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM progress_notes WHERE ${clause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2e. Assessment tables with assessed_by VARCHAR
  for (const tbl of ['dvt_assessments', 'pressure_sore_assessments', 'nutritional_assessments', 'diabetic_foot_assessments', 'preoperative_assessments']) {
    const clause = nameMatchClause.replace(/\$COL/g, 'assessed_by');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE ${clause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 2f. blood_transfusions — administered_by VARCHAR
  {
    const clause = nameMatchClause.replace(/\$COL/g, 'administered_by');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM blood_transfusions WHERE ${clause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // ── 3. Duties — formal assignments + clinic duty logs + call duty roster ──
  let dutiesCount = 0;

  // 3a. Formal duty assignments completed
  const formalDutyRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM duty_assignments WHERE user_id = $1 AND status = 'completed'`,
    [uidInt], { cnt: 0 }
  );
  dutiesCount += parseInt(formalDutyRow.cnt) || 0;

  // 3b. Clinic duty logs (user_id TEXT)
  {
    const clause = nameMatchClause.replace(/\$COL/g, 'user_id');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM clinic_duty_logs WHERE ${clause}`, nameMatchValues, { cnt: 0 });
    dutiesCount += parseInt(r.cnt) || 0;
  }

  // 3c. Call duty roster entries where this user was assigned
  {
    let callClause = `(senior_registrar_id = $1 OR registrar_id = $1 OR house_officer_id = $1`;
    const callParams = [uid];
    let pIdx = 1;
    if (fullName) {
      pIdx++;
      callParams.push(fullName);
      callClause += ` OR LOWER(senior_registrar_name) = LOWER($${pIdx}) OR LOWER(registrar_name) = LOWER($${pIdx}) OR LOWER(house_officer_name) = LOWER($${pIdx})`;
    }
    callClause += `)`;
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM call_duty_roster WHERE ${callClause}`, callParams, { cnt: 0 });
    dutiesCount += parseInt(r.cnt) || 0;
  }

  // 3d. Clinical entries as duties (each entry in a patient section = a duty performed)
  // This counts distinct clinical actions across all patient-facing tables
  const clinicalDutyRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM audit_logs WHERE ${auditUserClause} AND UPPER(action) IN ('CREATE', 'UPDATE', 'COMPLETE')
     AND UPPER(resource_type) IN ('PATIENT', 'TREATMENT_PLAN', 'ADMISSION', 'PRESCRIPTION', 'WARD_ROUND', 'LAB_ORDER', 'PROCEDURE', 'DISCHARGE', 'VITAL_SIGNS', 'WOUND_CARE', 'PROGRESS_NOTE', 'FLUID_BALANCE', 'SURGERY', 'ASSESSMENT', 'BLOOD_TRANSFUSION', 'MDT')`,
    auditUserParams, { cnt: 0 }
  );
  dutiesCount += parseInt(clinicalDutyRow.cnt) || 0;

  // ── 4. Login / Attendance Days (1 query from audit_logs) ──
  const loginRow = await safeQuery(
    `SELECT COUNT(DISTINCT DATE(timestamp)) as cnt FROM audit_logs WHERE ${auditUserClause}`,
    auditUserParams, { cnt: 0 }
  );
  let loginDays = parseInt(loginRow.cnt) || 0;

  // Also check activity_logs login events
  const actLoginRow = await safeQuery(
    `SELECT COUNT(DISTINCT DATE(created_at)) as cnt FROM activity_logs WHERE user_id = $1 AND activity_type = 'login'`,
    [uidInt], { cnt: 0 }
  );
  loginDays = Math.max(loginDays, parseInt(actLoginRow.cnt) || 0);

  // ── 5. CME / Education Topics (1 combined query + fallbacks) ──
  let cmeCount = 0;
  const tpRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1 OR user_id::text = $2`,
    [uidInt, uid], { cnt: 0 }
  );
  cmeCount += parseInt(tpRow.cnt) || 0;

  const cmeReadRow = await safeQuery(
    `SELECT COUNT(DISTINCT article_id) as cnt FROM cme_reading_progress WHERE user_id = $1`, [uid], { cnt: 0 }
  );
  cmeCount += parseInt(cmeReadRow.cnt) || 0;

  const cmeProgRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM cme_progress WHERE user_id = $1 AND completed = true`, [uid], { cnt: 0 }
  );
  cmeCount += parseInt(cmeProgRow.cnt) || 0;

  // ── Calculate Scores ──
  const reqs = getRequirements(lvl);
  const patientScore = Math.min(100, (patientCount / reqs.patientEntries) * 100);
  const dutyScore = Math.min(100, (dutiesCount / reqs.duties) * 100);
  const attendanceScore = Math.min(100, (loginDays / reqs.loginDays) * 100);
  const overallScore = (cbtAvgScore * 0.30) + (patientScore * 0.35) + (dutyScore * 0.25) + (attendanceScore * 0.10);

  return {
    cbtTestsCompleted: cbtCompleted,
    cbtAvgScore: Math.round(cbtAvgScore * 10) / 10,
    patientEntries: patientCount,
    patientScore: Math.round(patientScore * 10) / 10,
    dutiesCompleted: dutiesCount,
    dutyScore: Math.round(dutyScore * 10) / 10,
    loginDays,
    attendanceScore: Math.round(attendanceScore * 10) / 10,
    cmeTopicsCompleted: cmeCount,
    overallScore: Math.round(overallScore * 10) / 10,
  };
}

async function getActiveRotation(userId) {
  const result = await query(
    `SELECT * FROM trainee_rotations
     WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')
     ORDER BY created_at DESC LIMIT 1`, [userId]
  );
  return result.rows[0] || null;
}

// Create a rotation for an existing trainee who has none. Starts from the given
// onboarding date (falls back to today) so historical activity is captured.
async function backfillRotation(userId, level, startDate) {
  try {
    const durations = { house_officer: 30, junior_resident: 90, senior_resident: 180 };
    const days = durations[level] || 30;
    const start = startDate ? new Date(startDate).toISOString().slice(0, 10) : null;
    const r = await query(
      `INSERT INTO trainee_rotations (user_id, level, start_date, expected_end_date, status)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE),
               COALESCE($3::date, CURRENT_DATE) + ($4::int * INTERVAL '1 day'), 'active')
       RETURNING *`,
      [userId, level, start, days]
    );
    return r.rows[0] || null;
  } catch (e) {
    console.warn('backfillRotation:', e.message);
    return null;
  }
}

function computeEligibility(metrics, reqs) {
  const met = [];
  const notMet = [];

  if (metrics.cbtTestsCompleted >= reqs.cbtTests) met.push(`CBT: ${metrics.cbtTestsCompleted}/${reqs.cbtTests}`);
  else notMet.push(`CBT: ${metrics.cbtTestsCompleted}/${reqs.cbtTests}`);

  if (metrics.patientEntries >= reqs.patientEntries) met.push(`Patients: ${metrics.patientEntries}/${reqs.patientEntries}`);
  else notMet.push(`Patients: ${metrics.patientEntries}/${reqs.patientEntries}`);

  if (metrics.dutiesCompleted >= reqs.duties) met.push(`Duties: ${metrics.dutiesCompleted}/${reqs.duties}`);
  else notMet.push(`Duties: ${metrics.dutiesCompleted}/${reqs.duties}`);

  if (metrics.loginDays >= reqs.loginDays) met.push(`Attendance: ${metrics.loginDays}/${reqs.loginDays}`);
  else notMet.push(`Attendance: ${metrics.loginDays}/${reqs.loginDays}`);

  if (metrics.overallScore >= reqs.overallScore) met.push(`Overall: ${metrics.overallScore}%`);
  else notMet.push(`Overall: ${metrics.overallScore}% (need ${reqs.overallScore}%)`);

  return { eligible: notMet.length === 0, met, notMet };
}
