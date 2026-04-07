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
    return res.status(200).json(debug);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
