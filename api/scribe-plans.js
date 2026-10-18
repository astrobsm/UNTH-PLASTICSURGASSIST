// ============================================================================
// Scribe treatment plans — drafted by the medical scribe, approved by a
// consultant.
//
//   GET  /api/scribe-plans?patient_id=…           latest + history
//   POST /api/scribe-plans?action=submit           draft → pending approval
//   POST /api/scribe-plans?action=approve&id=…     consultant / admin only
//   POST /api/scribe-plans?action=reject&id=…      consultant / admin only
//
// A draft is never an order. On approval (with any edits the consultant
// made) it becomes the patient's active treatment plan in treatment_plans,
// and the previous scribe plan is superseded. Every decision keeps who and
// when.
// ============================================================================

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export const APPROVER_ROLES = ['consultant', 'admin', 'super_admin'];
const CLINICAL_ROLES = ['consultant', 'senior_registrar', 'registrar', 'junior_registrar', 'house_officer', 'admin', 'super_admin', 'nurse'];

let ready = false;
async function ensureTable() {
  if (ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS scribe_treatment_plans (
      id SERIAL PRIMARY KEY,
      patient_id TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
      plan JSONB NOT NULL,
      findings JSONB DEFAULT '[]',
      basis JSONB DEFAULT '[]',
      generated_by INTEGER,
      generated_by_name TEXT,
      generated_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_by INTEGER,
      reviewed_by_name TEXT,
      reviewed_at TIMESTAMPTZ,
      review_note TEXT,
      approved_plan JSONB,
      treatment_plan_id INTEGER
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scribe_plans_patient ON scribe_treatment_plans (patient_id, version DESC)`);
  ready = true;
}

const nameOf = (u) => u?.name || u?.fullName || u?.full_name || null;
const lines = (arr) => (Array.isArray(arr) ? arr : []).map((l) => (typeof l === 'string' ? l : l?.text)).filter(Boolean);

/** The approved plan in the shape the treatment-plans module stores. */
export function toTreatmentPlan(plan) {
  const problems = Array.isArray(plan?.problems) ? plan.problems : [];
  const diagnosis = problems.map((p) => `${p.problem}${p.code ? ` (${p.code})` : ''}`).join('; ') || 'See plan';
  return {
    diagnosis,
    objectives: problems.flatMap((p) => lines(p.goals)),
    procedures: problems.flatMap((p) => lines(p.treatment).map((t) => ({ name: t, status: 'planned' }))),
    investigations: [...problems.flatMap((p) => lines(p.investigations)), ...lines(plan?.carriedOver)],
    medications: (plan?.general || []).filter((g) => /VTE|Analgesia/i.test(g.heading)).flatMap((g) => lines(g.items)),
    follow_up_schedule: lines(plan?.followUp),
    discharge_plan: { criteria: lines(plan?.dischargeCriteria) },
    description: [
      ...problems.map((p) => `• ${p.problem}: ${lines(p.treatment).slice(0, 3).join('; ')}`),
      ...(plan?.comorbidities || []).map((c) => `• ${c.condition}: ${lines(c.actions).join('; ')}`),
    ].join('\n'),
  };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  const user = auth.user;

  try {
    await ensureTable();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    const id = parseInt(url.searchParams.get('id'), 10);

    if (req.method === 'GET') {
      const pid = url.searchParams.get('patient_id');
      if (pid) {
        const r = await query(
          `SELECT * FROM scribe_treatment_plans WHERE patient_id = $1 ORDER BY version DESC LIMIT 20`, [String(pid)]);
        return res.status(200).json({ plans: r.rows, can_approve: APPROVER_ROLES.includes(user.role) });
      }
      // The consultant's queue: every plan awaiting approval.
      if (url.searchParams.get('pending') !== null) {
        const r = await query(
          `SELECT s.*, p.first_name, p.last_name, p.hospital_number
             FROM scribe_treatment_plans s
             LEFT JOIN patients p ON p.id::text = s.patient_id
            WHERE s.status = 'pending_approval' ORDER BY s.generated_at ASC LIMIT 100`);
        return res.status(200).json({ plans: r.rows, can_approve: APPROVER_ROLES.includes(user.role) });
      }
      return res.status(400).json({ error: 'patient_id or pending is required' });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};

    if (action === 'submit') {
      if (!CLINICAL_ROLES.includes(user.role)) return res.status(403).json({ error: 'Not permitted' });
      if (!b.patient_id || !b.plan || !Array.isArray(b.plan.problems)) {
        return res.status(400).json({ error: 'patient_id and plan are required' });
      }
      // A newer draft replaces one still waiting; approved plans stay until superseded by approval.
      await query(
        `UPDATE scribe_treatment_plans SET status = 'superseded'
          WHERE patient_id = $1 AND status = 'pending_approval'`, [String(b.patient_id)]);
      const v = (await query(
        `SELECT COALESCE(MAX(version), 0) + 1 AS v FROM scribe_treatment_plans WHERE patient_id = $1`,
        [String(b.patient_id)])).rows[0].v;
      const r = await query(
        `INSERT INTO scribe_treatment_plans (patient_id, version, status, plan, findings, basis, generated_by, generated_by_name)
         VALUES ($1, $2, 'pending_approval', $3, $4, $5, $6, $7) RETURNING *`,
        [String(b.patient_id), v, JSON.stringify(b.plan), JSON.stringify(b.findings || []),
         JSON.stringify(b.basis || b.plan.basis || []), user.id || null, nameOf(user)]);
      return res.status(201).json({ plan: r.rows[0] });
    }

    if (action === 'approve' || action === 'reject') {
      if (!APPROVER_ROLES.includes(user.role)) {
        return res.status(403).json({ error: 'Only a consultant can approve or reject a treatment plan' });
      }
      if (Number.isNaN(id)) return res.status(400).json({ error: 'id is required' });
      const row = (await query(`SELECT * FROM scribe_treatment_plans WHERE id = $1`, [id])).rows[0];
      if (!row) return res.status(404).json({ error: 'Plan not found' });
      if (row.status !== 'pending_approval') return res.status(409).json({ error: `This plan is already ${row.status.replace(/_/g, ' ')}` });

      if (action === 'reject') {
        if (!String(b.note || '').trim()) return res.status(400).json({ error: 'Give the reason for rejecting the plan' });
        const r = await query(
          `UPDATE scribe_treatment_plans SET status = 'rejected', reviewed_by = $2, reviewed_by_name = $3,
                  reviewed_at = NOW(), review_note = $4 WHERE id = $1 RETURNING *`,
          [id, user.id || null, nameOf(user), String(b.note).trim()]);
        return res.status(200).json({ plan: r.rows[0] });
      }

      // Approve — with the consultant's edits if any.
      const finalPlan = b.plan && Array.isArray(b.plan.problems) ? b.plan : row.plan;
      const tp = toTreatmentPlan(finalPlan);
      let treatmentPlanId = null;
      const pidInt = parseInt(row.patient_id, 10);
      if (!Number.isNaN(pidInt)) {
        try {
          const ins = await query(
            `INSERT INTO treatment_plans (patient_id, diagnosis, treatment_type, description, objectives, procedures,
                                          medications, investigations, follow_up_schedule, discharge_plan, notes, status, created_by)
             VALUES ($1, $2, 'scribe_plan', $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11) RETURNING id`,
            [pidInt, tp.diagnosis, tp.description, JSON.stringify(tp.objectives), JSON.stringify(tp.procedures),
             JSON.stringify(tp.medications), JSON.stringify(tp.investigations), JSON.stringify(tp.follow_up_schedule),
             JSON.stringify(tp.discharge_plan),
             `Scribe plan v${row.version}, approved by ${nameOf(user) || 'consultant'}${b.note ? ` — ${String(b.note).trim()}` : ''}`,
             user.id || null]);
          treatmentPlanId = ins.rows[0].id;
        } catch (e) {
          console.warn('scribe-plans: treatment_plans insert failed:', e.message);
        }
      }
      await query(
        `UPDATE scribe_treatment_plans SET status = 'superseded'
          WHERE patient_id = $1 AND status = 'approved' AND id <> $2`, [row.patient_id, id]);
      const r = await query(
        `UPDATE scribe_treatment_plans SET status = 'approved', reviewed_by = $2, reviewed_by_name = $3,
                reviewed_at = NOW(), review_note = $4, approved_plan = $5, treatment_plan_id = $6
          WHERE id = $1 RETURNING *`,
        [id, user.id || null, nameOf(user), b.note ? String(b.note).trim() : null, JSON.stringify(finalPlan), treatmentPlanId]);
      try {
        await query(
          `INSERT INTO audit_logs (user_id, user_name, user_role, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, 'scribe_plan_approved', 'patient', $4, $5)`,
          [String(user.id ?? ''), nameOf(user), user.role, row.patient_id,
           JSON.stringify({ scribe_plan_id: id, version: row.version, treatment_plan_id: treatmentPlanId, edited: !!b.plan })]);
      } catch { /* audit is best-effort */ }
      return res.status(200).json({ plan: r.rows[0], treatment_plan_id: treatmentPlanId });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('scribe-plans error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
