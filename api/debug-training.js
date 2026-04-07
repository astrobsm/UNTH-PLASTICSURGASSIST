// Temporary debug endpoint - remove after diagnosing training metrics issue
import { query } from './_lib/db.js';
import { cors } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const debug = {};

    // Get trainees
    const trainees = await query(`
      SELECT id, username, full_name, role FROM users
      WHERE role IN ('intern', 'registrar', 'senior_registrar', 'house_officer', 'junior_resident', 'senior_resident')
        AND is_active = true
    `);
    debug.trainees = trainees.rows;

    // Check each trainee's data
    for (const t of trainees.rows) {
      const uid = String(t.id);
      const checks = {};
      
      try { const r = await query(`SELECT COUNT(*) as cnt FROM patients WHERE created_by = $1`, [t.id]); checks.patients_by_id = parseInt(r.rows[0].cnt); } catch(e) { checks.patients_by_id = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM patients WHERE created_by = $1`, [uid]); checks.patients_by_str = parseInt(r.rows[0].cnt); } catch(e) { checks.patients_by_str = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM treatment_plans WHERE created_by = $1`, [t.id]); checks.tx_plans_by_id = parseInt(r.rows[0].cnt); } catch(e) { checks.tx_plans_by_id = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM treatment_plans WHERE created_by = $1`, [uid]); checks.tx_plans_by_str = parseInt(r.rows[0].cnt); } catch(e) { checks.tx_plans_by_str = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM admissions WHERE created_by = $1`, [t.id]); checks.admissions = parseInt(r.rows[0].cnt); } catch(e) { checks.admissions = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM prescriptions WHERE created_by = $1`, [t.id]); checks.prescriptions = parseInt(r.rows[0].cnt); } catch(e) { checks.prescriptions = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM ward_rounds WHERE created_by = $1`, [t.id]); checks.ward_rounds = parseInt(r.rows[0].cnt); } catch(e) { checks.ward_rounds = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM lab_orders WHERE created_by = $1`, [t.id]); checks.lab_orders = parseInt(r.rows[0].cnt); } catch(e) { checks.lab_orders = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = $1`, [t.id]); checks.activity_logs_int = parseInt(r.rows[0].cnt); } catch(e) { checks.activity_logs_int = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = $1`, [uid]); checks.activity_logs_str = parseInt(r.rows[0].cnt); } catch(e) { checks.activity_logs_str = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = $1`, [uid]); checks.audit_logs_str = parseInt(r.rows[0].cnt); } catch(e) { checks.audit_logs_str = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs WHERE user_id = $1`, [t.id]); checks.audit_logs_int = parseInt(r.rows[0].cnt); } catch(e) { checks.audit_logs_int = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts WHERE user_id = $1`, [t.id]); checks.cbt_attempts = parseInt(r.rows[0].cnt); } catch(e) { checks.cbt_attempts = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1`, [t.id]); checks.training_progress = parseInt(r.rows[0].cnt); } catch(e) { checks.training_progress = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM cme_progress WHERE user_id = $1`, [uid]); checks.cme_progress = parseInt(r.rows[0].cnt); } catch(e) { checks.cme_progress = `ERR: ${e.message}`; }
      try { const r = await query(`SELECT COUNT(*) as cnt FROM duty_assignments WHERE user_id = $1`, [t.id]); checks.duty_assignments = parseInt(r.rows[0].cnt); } catch(e) { checks.duty_assignments = `ERR: ${e.message}`; }
      
      debug[`${t.full_name}_id${t.id}`] = checks;
    }

    // Global counts
    const globals = {};
    try { const r = await query(`SELECT COUNT(*) as cnt FROM patients`); globals.total_patients = parseInt(r.rows[0].cnt); } catch(e) { globals.total_patients = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT COUNT(*) as cnt FROM treatment_plans`); globals.total_treatment_plans = parseInt(r.rows[0].cnt); } catch(e) { globals.total_treatment_plans = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT COUNT(*) as cnt FROM audit_logs`); globals.total_audit_logs = parseInt(r.rows[0].cnt); } catch(e) { globals.total_audit_logs = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT COUNT(*) as cnt FROM cbt_attempts`); globals.total_cbt_attempts = parseInt(r.rows[0].cnt); } catch(e) { globals.total_cbt_attempts = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT COUNT(*) as cnt FROM activity_logs`); globals.total_activity_logs = parseInt(r.rows[0].cnt); } catch(e) { globals.total_activity_logs = `ERR: ${e.message}`; }
    
    // Sample created_by values
    try { const r = await query(`SELECT DISTINCT created_by FROM patients WHERE created_by IS NOT NULL LIMIT 15`); globals.patients_created_by_values = r.rows.map(r => r.created_by); } catch(e) { globals.patients_created_by_values = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT DISTINCT created_by FROM treatment_plans WHERE created_by IS NOT NULL LIMIT 15`); globals.tx_plans_created_by_values = r.rows.map(r => r.created_by); } catch(e) { globals.tx_plans_created_by_values = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT DISTINCT user_id FROM audit_logs LIMIT 15`); globals.audit_log_user_ids = r.rows.map(r => r.user_id); } catch(e) { globals.audit_log_user_ids = `ERR: ${e.message}`; }
    try { const r = await query(`SELECT DISTINCT user_id FROM cbt_attempts LIMIT 15`); globals.cbt_user_ids = r.rows.map(r => r.user_id); } catch(e) { globals.cbt_user_ids = `ERR: ${e.message}`; }
    
    // Column types for created_by
    try { 
      const r = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'created_by'`);
      globals.patients_created_by_type = r.rows[0];
    } catch(e) {}
    try { 
      const r = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id'`);
      globals.audit_logs_userid_type = r.rows[0];
    } catch(e) {}
    
    debug.globals = globals;
    
    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({ error: error.message, stack: error.stack });
  }
}
