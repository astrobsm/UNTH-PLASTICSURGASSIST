// Temporary debug endpoint - remove after diagnosing training metrics issue
import { query } from './_lib/db.js';
import { cors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Allow ?mode=metrics to run the same getTraineeMetrics logic inline
  const mode = req.query?.mode || 'raw';

  try {
    const debug = { version: 'v5-metrics', mode };

    // Get trainees
    const trainees = await query(`
      SELECT id, username, full_name, role FROM users
      WHERE role IN ('intern', 'registrar', 'senior_registrar', 'house_officer', 'junior_resident', 'senior_resident')
        AND is_active = true
    `);
    debug.trainees = trainees.rows;

    for (const t of trainees.rows) {
      const uid = String(t.id);
      const c = {};
      
      // Clinical tables — created_by
      try { const r = await query(`SELECT COUNT(*) as cnt FROM patients WHERE created_by = $1`, [t.id]); c.patients_created_by = parseInt(r.rows[0].cnt); } catch(e) { c.patients_created_by = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM treatment_plans WHERE created_by = $1`, [t.id]); c.tx_plans = parseInt(r.rows[0].cnt); } catch(e) { c.tx_plans = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM admissions WHERE created_by = $1`, [t.id]); c.admissions = parseInt(r.rows[0].cnt); } catch(e) { c.admissions = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM surgeries WHERE created_by = $1`, [t.id]); c.surgeries = parseInt(r.rows[0].cnt); } catch(e) { c.surgeries = 'ERR:' + e.message.substring(0,60); }

      // audit_logs — by user_id string, by user_name, and combined
      try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = $1`, [uid]); c.audit_by_id = parseInt(r.rows[0].cnt); } catch(e) { c.audit_by_id = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE LOWER(user_name) = LOWER($1)`, [t.full_name]); c.audit_by_name = parseInt(r.rows[0].cnt); } catch(e) { c.audit_by_name = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = $1 OR LOWER(user_name) = LOWER($2)`, [uid, t.full_name]); c.audit_combined = parseInt(r.rows[0].cnt); } catch(e) { c.audit_combined = 'ERR:' + e.message.substring(0,60); }

      // activity_logs
      try { const r = await query(`SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = $1`, [t.id]); c.activity_logs = parseInt(r.rows[0].cnt); } catch(e) { c.activity_logs = 'ERR:' + e.message.substring(0,60); }

      // cbt_attempts — integer and string
      try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts WHERE user_id = $1`, [t.id]); c.cbt_int = parseInt(r.rows[0].cnt); } catch(e) { c.cbt_int = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts WHERE user_id::text = $1`, [uid]); c.cbt_str = parseInt(r.rows[0].cnt); } catch(e) { c.cbt_str = 'ERR:' + e.message.substring(0,60); }

      // training_progress, cme_progress, cme_reading_progress
      try { const r = await query(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1`, [t.id]); c.train_prog = parseInt(r.rows[0].cnt); } catch(e) { c.train_prog = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_progress WHERE user_id = $1`, [uid]); c.cme_prog = parseInt(r.rows[0].cnt); } catch(e) { c.cme_prog = 'ERR:' + e.message.substring(0,60); }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_reading_progress WHERE user_id = $1`, [uid]); c.cme_reading = parseInt(r.rows[0].cnt); } catch(e) { c.cme_reading = 'ERR:' + e.message.substring(0,60); }

      debug[`${t.full_name}_id${t.id}`] = c;
    }

    // Global totals and sample values
    const g = {};
    try { const r = await query(`SELECT COUNT(*) as cnt FROM patients`); g.patients = parseInt(r.rows[0].cnt); } catch(e) {}
    try { const r = await query(`SELECT COUNT(*) as cnt FROM treatment_plans`); g.tx_plans = parseInt(r.rows[0].cnt); } catch(e) {}
    try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs`); g.audit_logs = parseInt(r.rows[0].cnt); } catch(e) {}
    try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts`); g.cbt = parseInt(r.rows[0].cnt); } catch(e) {}
    try { const r = await query(`SELECT COUNT(*) as cnt FROM activity_logs`); g.activity_logs = parseInt(r.rows[0].cnt); } catch(e) {}
    try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_reading_progress`); g.cme_reading = parseInt(r.rows[0].cnt); } catch(e) { g.cme_reading = 'ERR:' + e.message.substring(0,60); }
    try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_progress`); g.cme_prog = parseInt(r.rows[0].cnt); } catch(e) { g.cme_prog = 'ERR:' + e.message.substring(0,60); }
    
    // Distinct values
    try { const r = await query(`SELECT DISTINCT created_by FROM patients WHERE created_by IS NOT NULL LIMIT 10`); g.patient_created_by_vals = r.rows.map(x => x.created_by); } catch(e) { g.patient_created_by_vals = []; }
    try { const r = await query(`SELECT DISTINCT user_id, user_name FROM audit_logs LIMIT 10`); g.audit_users = r.rows; } catch(e) { g.audit_users = 'ERR:' + e.message.substring(0,60); }
    try { const r = await query(`SELECT DISTINCT user_id FROM cbt_attempts LIMIT 10`); g.cbt_user_ids = r.rows.map(x => x.user_id); } catch(e) { g.cbt_user_ids = []; }
    try { const r = await query(`SELECT DISTINCT user_id FROM cme_reading_progress LIMIT 10`); g.cme_reading_user_ids = r.rows.map(x => x.user_id); } catch(e) { g.cme_reading_user_ids = []; }
    try { const r = await query(`SELECT DISTINCT user_id FROM training_progress LIMIT 10`); g.training_user_ids = r.rows.map(x => x.user_id); } catch(e) { g.training_user_ids = []; }

    // Column type info
    try { 
      const r = await query(`SELECT table_name, column_name, data_type FROM information_schema.columns 
        WHERE (table_name = 'audit_logs' AND column_name = 'user_id')
           OR (table_name = 'patients' AND column_name = 'created_by')
           OR (table_name = 'cbt_attempts' AND column_name = 'user_id')
           OR (table_name = 'cme_reading_progress' AND column_name = 'user_id')
           OR (table_name = 'activity_logs' AND column_name = 'user_id')`);
      g.column_types = r.rows;
    } catch(e) {}
    
    debug.globals = g;

    // ── If mode=metrics, also run the exact getTraineeMetrics logic for each trainee ──
    if (mode === 'metrics') {
      const metricsResults = [];
      for (const t of trainees.rows) {
        const userId = t.id;
        const level = t.role || 'house_officer';
        const fullName = t.full_name;
        const username = t.username;
        const m = { id: userId, name: fullName, level, errors: [] };

        const uidInt = parseInt(userId);
        const uid = String(userId);

        async function safeCount(sql, params) {
          try { const r = await query(sql, params); return parseInt(r.rows[0].cnt) || 0; }
          catch (e) { m.errors.push(e.message.substring(0, 80)); return 0; }
        }

        // CBT
        let cbtCompleted = 0, cbtAvgScore = 0;
        try {
          const cbt = await query(
            `SELECT COUNT(*) as completed, COALESCE(AVG(
              CASE WHEN percentage IS NOT NULL AND percentage > 0 THEN percentage
                   WHEN score IS NOT NULL AND total_marks > 0 THEN (score::numeric / total_marks) * 100
                   ELSE 0 END
            ), 0) as avg_score
             FROM cbt_attempts WHERE user_id = $1 AND (completed = true OR passed = true)`, [uidInt]
          );
          cbtCompleted = parseInt(cbt.rows[0].completed) || 0;
          cbtAvgScore = parseFloat(cbt.rows[0].avg_score) || 0;
        } catch (e) { m.errors.push('cbt1:' + e.message.substring(0, 60)); }

        if (cbtCompleted === 0) {
          try {
            const cbt2 = await query(
              `SELECT COUNT(*) as completed, COALESCE(AVG(
                CASE WHEN percentage IS NOT NULL AND percentage > 0 THEN percentage
                     WHEN score IS NOT NULL AND total_marks > 0 THEN (score::numeric / total_marks) * 100
                     ELSE 0 END
              ), 0) as avg_score
               FROM cbt_attempts WHERE user_id::text = $1 AND (completed = true OR passed = true)`, [uid]
            );
            cbtCompleted = parseInt(cbt2.rows[0].completed) || 0;
            cbtAvgScore = parseFloat(cbt2.rows[0].avg_score) || 0;
          } catch (e) { m.errors.push('cbt2:' + e.message.substring(0, 60)); }
        }
        m.cbtCompleted = cbtCompleted;
        m.cbtAvgScore = cbtAvgScore;

        // Patient care
        let patientCount = 0;
        const clinicalTables = ['patients', 'treatment_plans', 'admissions', 'prescriptions', 'ward_rounds', 'lab_orders', 'surgeries'];
        for (const tbl of clinicalTables) {
          const c = await safeCount(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE created_by = $1`, [uidInt]);
          m['clinical_' + tbl] = c;
          patientCount += c;
        }

        const auditUserClause = fullName
          ? `(user_id = $1 OR LOWER(user_name) = LOWER($2))`
          : `user_id = $1`;
        const auditUserParams = fullName ? [uid, fullName] : [uid];

        const auditPatient = await safeCount(
          `SELECT COUNT(*) as cnt FROM audit_logs
           WHERE ${auditUserClause} AND UPPER(action) IN ('CREATE', 'UPDATE')
           AND UPPER(resource_type) IN ('PATIENT', 'TREATMENT_PLAN', 'ADMISSION', 'PRESCRIPTION', 'WARD_ROUND', 'LAB_ORDER', 'PROCEDURE', 'DISCHARGE', 'LAB')`,
          auditUserParams
        );
        m.auditPatientCount = auditPatient;
        patientCount += auditPatient;

        const actPatient = await safeCount(
          `SELECT COUNT(*) as cnt FROM activity_logs
           WHERE user_id = $1 AND activity_type IN (
             'patient_entry', 'patient_update', 'treatment_plan', 'prescription',
             'ward_round', 'surgery_booking', 'surgery_completed', 'wound_care',
             'discharge_summary', 'risk_assessment', 'admission', 'lab_order'
           )`, [uidInt]
        );
        m.activityPatientCount = actPatient;
        patientCount += actPatient;
        m.totalPatientCount = patientCount;

        // Duties
        let dutiesCount = 0;
        dutiesCount += await safeCount(
          `SELECT COUNT(*) as cnt FROM duty_assignments WHERE user_id = $1 AND status = 'completed'`, [uidInt]
        );
        const auditDuty = await safeCount(
          `SELECT COUNT(*) as cnt FROM audit_logs WHERE ${auditUserClause} AND UPPER(action) IN ('CREATE', 'UPDATE', 'COMPLETE', 'VIEW', 'EXPORT')`,
          auditUserParams
        );
        dutiesCount += auditDuty;
        m.dutiesCount = dutiesCount;

        // Login days
        let loginDays = 0;
        loginDays = Math.max(loginDays, await safeCount(
          `SELECT COUNT(DISTINCT DATE(created_at)) as cnt FROM activity_logs WHERE user_id = $1 AND activity_type = 'login'`, [uidInt]
        ));
        loginDays = Math.max(loginDays, await safeCount(
          `SELECT COUNT(DISTINCT DATE(timestamp)) as cnt FROM audit_logs WHERE ${auditUserClause}`,
          auditUserParams
        ));
        m.loginDays = loginDays;

        // CME
        let cmeTopics = 0;
        cmeTopics = await safeCount(`SELECT COUNT(*) as cnt FROM cme_reading_progress WHERE user_id = $1`, [uid]);
        if (cmeTopics === 0) {
          cmeTopics = await safeCount(`SELECT COUNT(*) as cnt FROM cme_progress WHERE user_id = $1`, [uid]);
        }
        if (cmeTopics === 0) {
          cmeTopics = await safeCount(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1`, [uidInt]);
        }
        if (cmeTopics === 0) {
          cmeTopics = await safeCount(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id::text = $1`, [uid]);
        }
        m.cmeTopics = cmeTopics;

        // Score calculation
        const requirements = {
          house_officer: { cbt: 4, patients: 30, duties: 20, loginDays: 25, cme: 50 },
          junior_resident: { cbt: 6, patients: 50, duties: 30, loginDays: 40, cme: 70 },
          senior_resident: { cbt: 8, patients: 80, duties: 50, loginDays: 60, cme: 100 },
          intern: { cbt: 4, patients: 30, duties: 20, loginDays: 25, cme: 50 },
          registrar: { cbt: 6, patients: 50, duties: 30, loginDays: 40, cme: 70 },
          senior_registrar: { cbt: 8, patients: 80, duties: 50, loginDays: 60, cme: 100 },
        };
        const req = requirements[level] || requirements.house_officer;
        const cbtScore = Math.min((cbtCompleted / req.cbt) * 100, 100);
        const patientScore = Math.min((patientCount / req.patients) * 100, 100);
        const dutyScore = Math.min((dutiesCount / req.duties) * 100, 100);
        const attendanceScore = Math.min((loginDays / req.loginDays) * 100, 100);
        const overallScore = (cbtAvgScore * 0.30) + (patientScore * 0.35) + (dutyScore * 0.25) + (attendanceScore * 0.10);

        m.cbtScore = cbtScore;
        m.patientScore = patientScore;
        m.dutyScore = dutyScore;
        m.attendanceScore = attendanceScore;
        m.overallScore = overallScore;
        m.req = req;

        metricsResults.push(m);
      }
      debug.metricsResults = metricsResults;
    }

    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack?.substring(0, 500) });
  }
}
