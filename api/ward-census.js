// ============================================================================
// Ward census — a shareable link that lets the doctors covering the wards
// mark which "admitted" patients are no longer on admission, so the list (and
// the ward count) can be brought back to the patients actually in the beds.
//
//   POST /api/ward-census?action=create                 new census link (supervisors)
//   GET  /api/ward-census?list=1                        census links and their counts
//   GET  /api/ward-census?round=ID                      the form: patients on admission
//   POST /api/ward-census?action=submit&round=ID        a doctor's report
//   GET  /api/ward-census?review=ID                     flagged patients, with who flagged them
//   POST /api/ward-census?action=discharge&round=ID     bulk discharge (supervisors)
//   POST /api/ward-census?action=keep&round=ID          keep on admission (supervisors)
//   POST /api/ward-census?action=close&round=ID         stop accepting reports
//
// The link opens inside the app, so only signed-in staff see patient names.
// A report never discharges anyone by itself: it is a flag, and a supervisor
// reviews the flags and discharges in bulk. Every report and decision keeps
// who, when and why.
// ============================================================================

import crypto from 'crypto';
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { deactivateAssignmentsForPatients } from './_lib/teamAssignment.js';

export const REVIEWER_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];
const REPORTER_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar', 'registrar', 'junior_registrar', 'house_officer', 'nurse'];
export const ON_ADMISSION = ['active', 'admitted'];
export const REASONS = ['discharged', 'transferred', 'died', 'lama', 'absconded', 'never_admitted', 'other'];

const nameOf = (u) => u?.name || u?.fullName || u?.full_name || null;

let ready = false;
async function ensureTables() {
  if (ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ward_census_rounds (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      ward_filter TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_by INTEGER,
      created_by_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS ward_census_submissions (
      id SERIAL PRIMARY KEY,
      round_id TEXT NOT NULL,
      submitted_by INTEGER,
      submitted_by_name TEXT,
      submitted_by_role TEXT,
      ward TEXT,
      flagged_count INTEGER DEFAULT 0,
      shown_count INTEGER DEFAULT 0,
      note TEXT,
      submitted_at TIMESTAMPTZ DEFAULT NOW()
    )`);
  await query(`
    CREATE TABLE IF NOT EXISTS ward_census_reports (
      id SERIAL PRIMARY KEY,
      round_id TEXT NOT NULL,
      submission_id INTEGER,
      admission_id INTEGER NOT NULL,
      patient_id INTEGER,
      reason VARCHAR(30) NOT NULL,
      left_date DATE,
      note TEXT,
      reported_by INTEGER,
      reported_by_name TEXT,
      reported_by_role TEXT,
      reported_at TIMESTAMPTZ DEFAULT NOW(),
      decision VARCHAR(20) NOT NULL DEFAULT 'pending',
      decided_by INTEGER,
      decided_by_name TEXT,
      decided_at TIMESTAMPTZ
    )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_census_reports_round ON ward_census_reports (round_id, admission_id)`);
  // What the patient left as — recorded on the admission when discharged here.
  await query(`ALTER TABLE admissions ADD COLUMN IF NOT EXISTS discharge_disposition VARCHAR(30)`).catch(() => {});
  ready = true;
}

async function loadRound(id) {
  if (!id) return null;
  return (await query(`SELECT * FROM ward_census_rounds WHERE id = $1`, [id])).rows[0] || null;
}
const isOpen = (r) => r && r.status === 'open' && (!r.expires_at || new Date(r.expires_at) > new Date());

/** Patients on admission (optionally one ward), as the form lists them. */
async function onAdmission(wardFilter) {
  const params = [ON_ADMISSION];
  let wardSql = '';
  if (wardFilter) { params.push(wardFilter); wardSql = ` AND LOWER(COALESCE(a.ward, '')) = LOWER($2)`; }
  const r = await query(
    `SELECT a.id AS admission_id, a.patient_id, a.ward, a.bed_number, a.admission_date, a.status,
            a.admitting_diagnosis, a.primary_diagnosis AS adm_primary_diagnosis,
            COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), a.patient_name) AS patient_name,
            COALESCE(p.hospital_number, a.hospital_number) AS hospital_number, p.gender, p.date_of_birth
       FROM admissions a
       LEFT JOIN patients p ON p.id = a.patient_id
      WHERE a.status = ANY($1::text[])${wardSql}
      ORDER BY LOWER(COALESCE(a.ward, 'zzz')), a.bed_number NULLS LAST, a.admission_date`,
    params).catch(async (e) => {
      // Older schemas without primary_diagnosis / patient_name on admissions.
      if (!/column/.test(e.message || '')) throw e;
      return query(
        `SELECT a.id AS admission_id, a.patient_id, a.ward, a.bed_number, a.admission_date, a.status,
                a.admitting_diagnosis,
                TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS patient_name, p.hospital_number, p.gender, p.date_of_birth
           FROM admissions a LEFT JOIN patients p ON p.id = a.patient_id
          WHERE a.status = ANY($1::text[])${wardSql}
          ORDER BY LOWER(COALESCE(a.ward, 'zzz')), a.bed_number NULLS LAST, a.admission_date`, params);
    });
  return r.rows.filter((x) => (x.patient_name && x.patient_name.trim()) || x.hospital_number);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error || 'Sign in to open the ward census' });
  const user = auth.user;

  try {
    await ensureTables();
    const url = new URL(req.url, `http://${req.headers.host}`);
    const action = url.searchParams.get('action');
    const roundId = url.searchParams.get('round') || url.searchParams.get('review');
    const canReview = REVIEWER_ROLES.includes(user.role);

    if (req.method === 'GET') {
      if (url.searchParams.get('list') !== null) {
        if (!canReview) return res.status(403).json({ error: 'Not permitted' });
        const r = await query(
          `SELECT r.*,
                  (SELECT COUNT(*)::int FROM ward_census_submissions s WHERE s.round_id = r.id) AS submissions,
                  (SELECT COUNT(DISTINCT admission_id)::int FROM ward_census_reports x WHERE x.round_id = r.id AND x.decision = 'pending') AS pending,
                  (SELECT COUNT(DISTINCT admission_id)::int FROM ward_census_reports x WHERE x.round_id = r.id AND x.decision = 'discharged') AS discharged
             FROM ward_census_rounds r ORDER BY r.created_at DESC LIMIT 50`);
        return res.status(200).json({ rounds: r.rows });
      }

      const round = await loadRound(roundId);
      if (!round) return res.status(404).json({ error: 'This census link does not exist' });

      if (url.searchParams.get('review')) {
        if (!canReview) return res.status(403).json({ error: 'Only a consultant, senior registrar or administrator can review the census' });
        const patients = await onAdmission(round.ward_filter);
        const reports = (await query(
          `SELECT x.*, a.status AS admission_status, a.ward, a.bed_number, a.admission_date,
                  COALESCE(NULLIF(TRIM(CONCAT(p.first_name, ' ', p.last_name)), ''), '') AS patient_name, p.hospital_number
             FROM ward_census_reports x
             JOIN admissions a ON a.id = x.admission_id
             LEFT JOIN patients p ON p.id = a.patient_id
            WHERE x.round_id = $1 ORDER BY x.reported_at DESC`, [round.id])).rows;
        const submissions = (await query(
          `SELECT * FROM ward_census_submissions WHERE round_id = $1 ORDER BY submitted_at DESC`, [round.id])).rows;
        return res.status(200).json({ round, on_admission: patients.length, patients, reports, submissions, open: isOpen(round) });
      }

      // The form.
      if (!REPORTER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Not permitted' });
      if (!isOpen(round)) return res.status(410).json({ error: 'This census has closed. Ask for a new link.', round });
      const patients = await onAdmission(round.ward_filter);
      const flagged = (await query(
        `SELECT admission_id, reason, reported_by_name, reported_at FROM ward_census_reports
          WHERE round_id = $1 AND decision = 'pending' ORDER BY reported_at DESC`, [round.id])).rows;
      return res.status(200).json({ round, patients, flagged, reasons: REASONS });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const b = req.body || {};

    if (action === 'create') {
      if (!canReview) return res.status(403).json({ error: 'Only a consultant, senior registrar or administrator can start a census' });
      const days = Math.min(Math.max(parseInt(b.days_valid, 10) || 3, 1), 30);
      const id = crypto.randomBytes(12).toString('base64url');
      const title = String(b.title || '').trim() || `Ward census ${new Date().toISOString().slice(0, 10)}`;
      const r = await query(
        `INSERT INTO ward_census_rounds (id, title, ward_filter, created_by, created_by_name, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' days')::interval) RETURNING *`,
        [id, title.slice(0, 200), b.ward ? String(b.ward).trim() : null, user.id || null, nameOf(user), String(days)]);
      return res.status(201).json({ round: r.rows[0] });
    }

    const round = await loadRound(roundId);
    if (!round) return res.status(404).json({ error: 'This census link does not exist' });

    if (action === 'submit') {
      if (!REPORTER_ROLES.includes(user.role)) return res.status(403).json({ error: 'Not permitted' });
      if (!isOpen(round)) return res.status(410).json({ error: 'This census has closed' });
      const items = Array.isArray(b.items) ? b.items : [];
      for (const it of items) {
        if (!Number.isInteger(Number(it.admission_id))) return res.status(400).json({ error: 'Each item needs an admission_id' });
        if (!REASONS.includes(it.reason)) return res.status(400).json({ error: `reason must be one of ${REASONS.join(', ')}` });
        if (it.reason === 'other' && !String(it.note || '').trim()) return res.status(400).json({ error: 'Say what "other" means' });
        if (it.left_date && (Number.isNaN(Date.parse(it.left_date)) || new Date(it.left_date) > new Date(Date.now() + 86400000))) {
          return res.status(400).json({ error: 'The date left cannot be in the future' });
        }
      }
      // Only admissions that are on admission now can be flagged.
      const ids = items.map((it) => Number(it.admission_id));
      const live = ids.length ? new Map((await query(
        `SELECT id, patient_id FROM admissions WHERE id = ANY($1::int[]) AND status = ANY($2::text[])`,
        [ids, ON_ADMISSION])).rows.map((r) => [Number(r.id), r.patient_id])) : new Map();
      const sub = (await query(
        `INSERT INTO ward_census_submissions (round_id, submitted_by, submitted_by_name, submitted_by_role, ward, flagged_count, shown_count, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [round.id, user.id || null, nameOf(user), user.role || null, b.ward || round.ward_filter || null,
         [...live.keys()].length, Number(b.shown_count) || null, b.note ? String(b.note).trim() : null])).rows[0];
      for (const it of items) {
        const aid = Number(it.admission_id);
        if (!live.has(aid)) continue;
        await query(
          `INSERT INTO ward_census_reports (round_id, submission_id, admission_id, patient_id, reason, left_date, note,
                                            reported_by, reported_by_name, reported_by_role)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [round.id, sub.id, aid, live.get(aid) ?? null, it.reason, it.left_date || null,
           it.note ? String(it.note).trim() : null, user.id || null, nameOf(user), user.role || null]);
      }
      return res.status(201).json({ submission: sub, flagged: live.size, ignored: ids.length - live.size });
    }

    if (!canReview) return res.status(403).json({ error: 'Only a consultant, senior registrar or administrator can do that' });

    if (action === 'close') {
      const r = await query(`UPDATE ward_census_rounds SET status = 'closed' WHERE id = $1 RETURNING *`, [round.id]);
      return res.status(200).json({ round: r.rows[0] });
    }

    if (action === 'discharge' || action === 'keep') {
      const ids = (Array.isArray(b.admission_ids) ? b.admission_ids : []).map(Number).filter(Number.isInteger);
      if (!ids.length) return res.status(400).json({ error: 'Choose at least one patient' });

      if (action === 'keep') {
        const r = await query(
          `UPDATE ward_census_reports SET decision = 'kept', decided_by = $3, decided_by_name = $4, decided_at = NOW()
            WHERE round_id = $1 AND admission_id = ANY($2::int[]) AND decision = 'pending' RETURNING admission_id`,
          [round.id, ids, user.id || null, nameOf(user)]);
        return res.status(200).json({ kept: new Set(r.rows.map((x) => x.admission_id)).size });
      }

      // Discharge: the date and reason come from the earliest report of each
      // patient (when they actually left), not from today.
      const firsts = (await query(
        `SELECT DISTINCT ON (admission_id) admission_id, reason, left_date
           FROM ward_census_reports WHERE round_id = $1 AND admission_id = ANY($2::int[])
          ORDER BY admission_id, COALESCE(left_date, reported_at::date) ASC`, [round.id, ids])).rows;
      const byId = new Map(firsts.map((f) => [Number(f.admission_id), f]));
      const discharged = [];
      const patientIds = [];
      for (const aid of ids) {
        const f = byId.get(aid);
        const r = await query(
          `UPDATE admissions SET status = 'discharged',
                  discharge_date = COALESCE($2::date, CURRENT_DATE),
                  discharge_disposition = $3,
                  updated_at = NOW()
            WHERE id = $1 AND status = ANY($4::text[]) RETURNING id, patient_id`,
          [aid, f?.left_date || null, f?.reason || 'discharged', ON_ADMISSION]);
        if (r.rows[0]) { discharged.push(aid); patientIds.push(r.rows[0].patient_id); }
      }
      await query(
        `UPDATE ward_census_reports SET decision = 'discharged', decided_by = $3, decided_by_name = $4, decided_at = NOW()
          WHERE round_id = $1 AND admission_id = ANY($2::int[]) AND decision = 'pending'`,
        [round.id, ids, user.id || null, nameOf(user)]);
      try { if (patientIds.length) await deactivateAssignmentsForPatients(patientIds); }
      catch (e) { console.warn('ward-census: deactivate assignments failed:', e.message); }
      try {
        await query(
          `INSERT INTO audit_logs (user_id, user_name, user_role, action, resource_type, resource_id, details)
           VALUES ($1, $2, $3, 'ward_census_bulk_discharge', 'admission', $4, $5)`,
          [String(user.id ?? ''), nameOf(user), user.role, round.id,
           JSON.stringify({ round: round.id, discharged, requested: ids.length })]);
      } catch { /* audit is best-effort */ }
      const remaining = (await onAdmission(round.ward_filter)).length;
      return res.status(200).json({ discharged: discharged.length, skipped: ids.length - discharged.length, on_admission: remaining });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('ward-census error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
