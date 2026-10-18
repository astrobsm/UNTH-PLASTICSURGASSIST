// ============================================================================
// Scribe treatment plans — drafted by the medical scribe, approved by a
// consultant.
//
//   GET  /api/scribe-plans?patient_id=…           latest + history
//   POST /api/scribe-plans?action=submit           draft → pending approval
//   POST /api/scribe-plans?action=approve&id=…     consultant / admin only
//   POST /api/scribe-plans?action=reject&id=…      consultant / admin only
//   POST /api/scribe-plans?action=log&id=…         log implementation of one item
//   GET  /api/scribe-plans?attachment=…            a result file (photo / scan / PDF)
//
// Implementation logs carry the SERVER time (not the device clock), the user
// from the token (not a typed name) and the location the device reported, so
// who did what, when and where cannot be edited after the fact.
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
  await query(`
    CREATE TABLE IF NOT EXISTS scribe_plan_actions (
      id SERIAL PRIMARY KEY,
      scribe_plan_id INTEGER NOT NULL,
      patient_id TEXT NOT NULL,
      item_key TEXT NOT NULL,
      item_text TEXT,
      item_kind VARCHAR(20),
      status VARCHAR(30) NOT NULL,
      note TEXT,
      prescription JSONB,
      investigation JSONB,
      result JSONB,
      latitude DOUBLE PRECISION,
      longitude DOUBLE PRECISION,
      accuracy_m DOUBLE PRECISION,
      location_label TEXT,
      location_status VARCHAR(20),
      user_id INTEGER,
      user_name TEXT,
      user_role TEXT,
      client_time TIMESTAMPTZ,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scribe_actions_plan ON scribe_plan_actions (scribe_plan_id, item_key, logged_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_scribe_actions_patient ON scribe_plan_actions (patient_id, logged_at DESC)`);
  await query(`
    CREATE TABLE IF NOT EXISTS scribe_plan_attachments (
      id SERIAL PRIMARY KEY,
      action_id INTEGER NOT NULL,
      patient_id TEXT NOT NULL,
      name TEXT,
      mime TEXT,
      size_bytes INTEGER,
      data TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
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
      const att = url.searchParams.get('attachment');
      if (att) {
        const a = (await query(`SELECT id, name, mime, data FROM scribe_plan_attachments WHERE id = $1`, [parseInt(att, 10)])).rows[0];
        if (!a) return res.status(404).json({ error: 'Attachment not found' });
        return res.status(200).json({ attachment: a });
      }
      const pid = url.searchParams.get('patient_id');
      if (pid) {
        const r = await query(
          `SELECT * FROM scribe_treatment_plans WHERE patient_id = $1 ORDER BY version DESC LIMIT 20`, [String(pid)]);
        // Implementation log of the plans shown, newest first, with attachment
        // metadata (the files themselves are fetched one at a time).
        const ids = r.rows.map((x) => x.id);
        const actions = ids.length ? (await query(
          `SELECT a.*, COALESCE(json_agg(json_build_object('id', f.id, 'name', f.name, 'mime', f.mime, 'size', f.size_bytes))
                    FILTER (WHERE f.id IS NOT NULL), '[]') AS attachments
             FROM scribe_plan_actions a
             LEFT JOIN scribe_plan_attachments f ON f.action_id = a.id
            WHERE a.scribe_plan_id = ANY($1::int[])
            GROUP BY a.id ORDER BY a.logged_at DESC`, [ids])).rows : [];
        return res.status(200).json({
          plans: r.rows, actions,
          can_approve: APPROVER_ROLES.includes(user.role),
          can_log: CLINICAL_ROLES.includes(user.role),
        });
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

    if (action === 'log') {
      if (!CLINICAL_ROLES.includes(user.role)) return res.status(403).json({ error: 'Not permitted' });
      if (Number.isNaN(id)) return res.status(400).json({ error: 'id is required' });
      const plan = (await query(`SELECT id, patient_id, status FROM scribe_treatment_plans WHERE id = $1`, [id])).rows[0];
      if (!plan) return res.status(404).json({ error: 'Plan not found' });
      // Only an approved plan is carried out.
      if (plan.status !== 'approved') return res.status(409).json({ error: 'Only an approved plan can be implemented' });
      if (!b.item_key || !b.status) return res.status(400).json({ error: 'item_key and status are required' });
      const allowed = ['done', 'partial', 'not_done', 'ordered', 'prescribed', 'result_entered', 'cancelled'];
      if (!allowed.includes(b.status)) return res.status(400).json({ error: `status must be one of ${allowed.join(', ')}` });
      if (['not_done', 'partial', 'cancelled'].includes(b.status) && !String(b.note || '').trim()) {
        return res.status(400).json({ error: 'Say why it was not (fully) done' });
      }
      const loc = b.location || {};
      const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
      const attachments = Array.isArray(b.attachments) ? b.attachments : [];
      for (const f of attachments) {
        if (!/^data:[\w.+-]+\/[\w.+-]+;base64,/.test(String(f?.data || ''))) return res.status(400).json({ error: 'Attachments must be data URLs' });
      }
      // Vercel refuses request bodies over ~4.5 MB; photos are compressed on the device first.
      if (attachments.reduce((n, f) => n + String(f.data).length, 0) > 4_000_000) {
        return res.status(413).json({ error: 'The files are too large together (max ~3 MB per save) — attach fewer, or save them in two steps.' });
      }
      const r = await query(
        `INSERT INTO scribe_plan_actions
           (scribe_plan_id, patient_id, item_key, item_text, item_kind, status, note, prescription, investigation, result,
            latitude, longitude, accuracy_m, location_label, location_status, user_id, user_name, user_role, client_time)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
        [id, plan.patient_id, String(b.item_key), b.item_text || null, b.item_kind || null, b.status,
         b.note ? String(b.note).trim() : null,
         b.prescription ? JSON.stringify(b.prescription) : null,
         b.investigation ? JSON.stringify(b.investigation) : null,
         b.result ? JSON.stringify(b.result) : null,
         num(loc.latitude), num(loc.longitude), num(loc.accuracy), loc.label ? String(loc.label).slice(0, 200) : null,
         loc.status ? String(loc.status).slice(0, 20) : null,
         user.id || null, nameOf(user), user.role || null,
         b.client_time && !Number.isNaN(Date.parse(b.client_time)) ? b.client_time : null]);
      const action = r.rows[0];
      const saved = [];
      for (const f of attachments) {
        const a = await query(
          `INSERT INTO scribe_plan_attachments (action_id, patient_id, name, mime, size_bytes, data)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, name, mime, size_bytes AS size`,
          [action.id, plan.patient_id, f.name || 'result', /^data:([^;]+)/.exec(f.data)[1],
           Math.round(String(f.data).length * 0.75), f.data]);
        saved.push(a.rows[0]);
      }
      return res.status(201).json({ action: { ...action, attachments: saved } });
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
