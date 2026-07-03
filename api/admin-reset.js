// Admin data-reset endpoint (DESTRUCTIVE) — Vercel serverless.
// Permanently wipes ALL patients and every patient-dependent clinical record so
// the app can start from a clean slate. Also supports discharging all active
// admissions without deleting. Restricted to top-level admins and guarded by an
// exact typed confirmation phrase.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const SUPER_ADMIN_ROLES = ['admin', 'super_admin'];
const CONFIRM_PHRASE = 'DELETE ALL PATIENTS';

// Child/related tables cleared before the patients table. CASCADE would remove
// FK children automatically, but we clear explicitly so loose-ref and
// hospital_number-linked tables (no FK) are also wiped. Order = children first.
// Each delete is isolated so a missing table never aborts the whole reset.
const PATIENT_DATA_TABLES = [
  // Loose patient_id refs (no cascade)
  'progress_notes', 'vital_signs', 'fluid_balance', 'blood_glucose',
  'investigation_uploads', 'substance_use_assessments', 'detox_monitoring_records',
  'detox_follow_ups',
  // Student clinical data referencing (test) patients — student accounts are kept
  'student_clerkings', 'student_treatment_plans', 'student_patient_assignments',
  // Appointments / queues / assignments / consults
  'surgery_scheduling_queue', 'clinic_appointments', 'patient_assignments',
  'received_consults', 'delivered_consults',
  // Assessments & care plans
  'preoperative_assessments', 'dvt_assessments', 'pressure_sore_assessments',
  'nutritional_assessments', 'pressure_sore_progress', 'pressure_sore_treatment_plans',
  'pressure_sore_wounds', 'burn_patients', 'diabetic_foot_assessments', 'sjs_assessments',
  'sti_debridements', 'sti_treatment_plans', 'sti_assessments', 'protocol_orders',
  'lymphedema_assessments', 'gfr_calculations', 'blood_glucose',
  'keloid_injections', 'keloid_pretreatment_tests', 'keloid_care_plans',
  // MDT
  'mdt_contact_logs', 'mdt_meetings', 'mdt_documentation', 'mdt_patient_teams',
  // Core clinical records
  'who_safety_checklists', 'procedures', 'blood_transfusions',
  'ward_rounds_clinical', 'ward_rounds', 'wound_care_records',
  'prescriptions', 'lab_results', 'lab_orders',
  'plan_steps', 'treatment_plan_modifications', 'treatment_plans',
  'surgeries', 'discharge_summaries', 'patient_transfers',
  'admissions',
];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }
  if (!SUPER_ADMIN_ROLES.includes(auth.user.role)) {
    return res.status(403).json({ error: 'Only a system administrator can perform a data reset.' });
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, confirm } = req.body || {};

  try {
    if (action === 'discharge-all') {
      const r = await query(
        `UPDATE admissions SET status = 'discharged', discharge_date = COALESCE(discharge_date, CURRENT_DATE), updated_at = CURRENT_TIMESTAMP
         WHERE status IN ('active', 'admitted')`
      );
      return res.status(200).json({ success: true, dischargedCount: r.rowCount || 0 });
    }

    if (action === 'wipe-patients') {
      if (confirm !== CONFIRM_PHRASE) {
        return res.status(400).json({ error: `Confirmation phrase mismatch. Type exactly: ${CONFIRM_PHRASE}` });
      }

      // Count patients before wipe (best-effort)
      let patientsBefore = 0;
      try { patientsBefore = parseInt((await query('SELECT COUNT(*) AS c FROM patients')).rows[0].c, 10); } catch { /* ignore */ }

      const cleared = [];
      const skipped = [];
      for (const table of PATIENT_DATA_TABLES) {
        try {
          const r = await query(`DELETE FROM ${table}`);
          cleared.push({ table, deleted: r.rowCount || 0 });
        } catch (e) {
          skipped.push({ table, reason: e.message });
        }
      }

      // Finally delete the patients themselves and reset the id sequence
      let patientsDeleted = 0;
      try {
        const r = await query('DELETE FROM patients');
        patientsDeleted = r.rowCount || 0;
      } catch (e) {
        return res.status(500).json({ error: 'Failed to delete patients', message: e.message, cleared, skipped });
      }
      try { await query('ALTER SEQUENCE patients_id_seq RESTART WITH 1'); } catch { /* non-fatal */ }

      // Audit log (best-effort)
      try {
        await query(
          `INSERT INTO audit_logs (user_id, user_name, action, resource_type, resource_id, details)
           VALUES ($1, $2, 'wipe_all_patients', 'patients', 'all', $3)`,
          [String(auth.user.id), auth.user.fullName || auth.user.email || 'admin',
           JSON.stringify({ patientsBefore, patientsDeleted, tablesCleared: cleared.length })]
        );
      } catch { /* audit table shape may differ — non-fatal */ }

      return res.status(200).json({
        success: true,
        patientsDeleted,
        patientsBefore,
        tablesCleared: cleared,
        tablesSkipped: skipped,
        message: `Permanently deleted ${patientsDeleted} patients and cleared ${cleared.length} related tables.`,
      });
    }

    return res.status(400).json({ error: "Invalid action. Use 'wipe-patients' or 'discharge-all'." });
  } catch (error) {
    console.error('admin-reset error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
