// Temporary diagnostic endpoint - returns error from admin-training logic
import { query } from './_lib/db.js';
import { cors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  
  try {
    // Test ensureTables logic
    const errors = [];
    
    // Test ALTER TABLE for missing created_by columns
    const tablesNeedingCreatedBy = ['prescriptions', 'ward_rounds', 'lab_orders'];
    for (const tbl of tablesNeedingCreatedBy) {
      try {
        await query(`ALTER TABLE ${tbl} ADD COLUMN IF NOT EXISTS created_by INTEGER`);
      } catch (e) {
        errors.push(`ALTER ${tbl}: ${e.message}`);
      }
    }

    // Test CREATE TABLE IF NOT EXISTS for training tables
    try {
      await query(`CREATE TABLE IF NOT EXISTS training_warnings (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, sent_by INTEGER NOT NULL,
        warning_type VARCHAR(50) NOT NULL, subject VARCHAR(255) NOT NULL, message TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'warning', read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) { errors.push(`training_warnings: ${e.message}`); }

    try {
      await query(`CREATE TABLE IF NOT EXISTS trainee_rotations (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, level VARCHAR(50) NOT NULL,
        start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, expected_end_date TIMESTAMP,
        actual_end_date TIMESTAMP, status VARCHAR(30) DEFAULT 'active',
        extension_count INTEGER DEFAULT 0, extension_reasons JSONB DEFAULT '[]',
        sign_out_approved BOOLEAN DEFAULT false, sign_out_approved_by INTEGER,
        sign_out_approved_at TIMESTAMP, sign_out_comments TEXT,
        final_score NUMERIC, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) { errors.push(`trainee_rotations: ${e.message}`); }

    try {
      await query(`CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, activity_type VARCHAR(50) NOT NULL,
        description TEXT, points INTEGER DEFAULT 0, metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) { errors.push(`activity_logs: ${e.message}`); }

    try {
      await query(`CREATE TABLE IF NOT EXISTS duty_assignments (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, title VARCHAR(255) NOT NULL,
        description TEXT, assigned_by INTEGER, assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        due_at TIMESTAMP, responded_at TIMESTAMP, completed_at TIMESTAMP,
        status VARCHAR(30) DEFAULT 'pending', priority VARCHAR(20) DEFAULT 'medium',
        promptness_score INTEGER, completion_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch (e) { errors.push(`duty_assignments: ${e.message}`); }

    // Test the trainee query
    let trainees = [];
    try {
      const result = await query(`
        SELECT u.id, u.username, u.full_name, u.role, u.email,
               u.created_at as registered_at
        FROM users u
        WHERE u.role IN ('intern', 'registrar', 'senior_registrar', 'house_officer', 'junior_resident', 'senior_resident')
          AND u.is_active = true
        ORDER BY u.role, u.full_name
      `);
      trainees = result.rows;
    } catch (e) { errors.push(`trainees query: ${e.message}`); }

    // Test getTraineeMetrics for first trainee only
    let metricsError = null;
    let metricsResult = null;
    if (trainees.length > 0) {
      const t = trainees[0];
      try {
        const uid = String(t.id);
        const uidInt = parseInt(t.id);
        
        // Test each query that getTraineeMetrics runs
        const steps = {};
        
        // CBT
        try {
          const r = await query(`SELECT COUNT(*) as completed, COALESCE(AVG(
            CASE WHEN percentage IS NOT NULL AND percentage > 0 THEN percentage
                 WHEN score IS NOT NULL AND total_marks > 0 THEN (score::numeric / total_marks) * 100
                 ELSE 0 END
          ), 0) as avg_score FROM cbt_attempts WHERE user_id = $1 AND (completed = true OR passed = true)`, [uidInt]);
          steps.cbt = { completed: r.rows[0].completed, avg_score: r.rows[0].avg_score };
        } catch (e) { steps.cbt = `ERR: ${e.message}`; }

        // Patients
        try {
          const r = await query(`SELECT COUNT(*) as cnt FROM patients WHERE created_by = $1`, [uidInt]);
          steps.patients = parseInt(r.rows[0].cnt);
        } catch (e) { steps.patients = `ERR: ${e.message}`; }

        // Audit logs
        try {
          const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE (user_id = $1 OR LOWER(user_name) = LOWER($2)) AND UPPER(action) IN ('CREATE', 'UPDATE') AND UPPER(resource_type) IN ('PATIENT', 'TREATMENT_PLAN', 'ADMISSION', 'PRESCRIPTION', 'WARD_ROUND', 'LAB_ORDER', 'PROCEDURE', 'DISCHARGE', 'LAB')`, [uid, t.full_name]);
          steps.auditPatient = parseInt(r.rows[0].cnt);
        } catch (e) { steps.auditPatient = `ERR: ${e.message}`; }

        // Duties from audit
        try {
          const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE (user_id = $1 OR LOWER(user_name) = LOWER($2)) AND UPPER(action) IN ('CREATE', 'UPDATE', 'COMPLETE', 'VIEW', 'EXPORT')`, [uid, t.full_name]);
          steps.auditDuties = parseInt(r.rows[0].cnt);
        } catch (e) { steps.auditDuties = `ERR: ${e.message}`; }

        // Login days
        try {
          const r = await query(`SELECT COUNT(DISTINCT DATE(timestamp)) as cnt FROM audit_logs WHERE (user_id = $1 OR LOWER(user_name) = LOWER($2))`, [uid, t.full_name]);
          steps.loginDays = parseInt(r.rows[0].cnt);
        } catch (e) { steps.loginDays = `ERR: ${e.message}`; }

        // Training progress 
        try {
          const r = await query(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1`, [uidInt]);
          steps.trainingProgress = parseInt(r.rows[0].cnt);
        } catch (e) { steps.trainingProgress = `ERR: ${e.message}`; }

        // training_warnings count
        try {
          const r = await query(`SELECT COUNT(*) as cnt FROM training_warnings WHERE user_id = $1 AND read = false`, [t.id]);
          steps.unreadWarnings = parseInt(r.rows[0].cnt);
        } catch (e) { steps.unreadWarnings = `ERR: ${e.message}`; }

        // trainee_rotations
        try {
          const r = await query(`SELECT * FROM trainee_rotations WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout') ORDER BY created_at DESC LIMIT 1`, [t.id]);
          steps.rotation = r.rows[0] || null;
        } catch (e) { steps.rotation = `ERR: ${e.message}`; }

        metricsResult = { trainee: `${t.full_name} (id=${t.id})`, steps };
      } catch (e) {
        metricsError = e.message;
      }
    }

    return res.status(200).json({
      ensureTableErrors: errors,
      traineeCount: trainees.length,
      trainees: trainees.map(t => ({ id: t.id, name: t.full_name, role: t.role })),
      metricsTest: metricsResult,
      metricsError,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack?.substring(0, 500) });
  }
}
