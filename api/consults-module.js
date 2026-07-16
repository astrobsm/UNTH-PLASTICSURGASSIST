// ============================================================================
// Native Consults Module — Vercel serverless API
// Path-dispatched router under /api/consults-module/*
//
// Public (no auth):
//   GET  /public/link/:token              -> verify link + return unit label
//   POST /public/submit/:token            -> submit a consult through a shared link
//
// Authenticated (PSA staff):
//   GET    /links                         -> list shareable links
//   POST   /links                         -> create link
//   PATCH  /links/:id                     -> { is_active }
//
//   GET    /received                      -> list (filters: status, urgency, search, page, per_page)
//   POST   /received                      -> staff-entered consult
//   GET    /received/:id                  -> detail (+ attachments, history, charts, feedback)
//   PATCH  /received/:id/status           -> { to_status, notes, ...form_fields }
//   POST   /received/:id/attachments      -> add attachment
//   DELETE /received/:id/attachments/:aid -> remove attachment
//   POST   /received/:id/charts           -> save digital chart series
//   POST   /received/:id/feedback         -> send SMS feedback to referring unit
//
//   GET    /delivered                     -> list (filters)
//   POST   /delivered                     -> create (with OCR'd handwritten consult)
//   GET    /delivered/:id                 -> detail
//   PATCH  /delivered/:id/status          -> { to_status, response_text }
//   POST   /delivered/:id/attachments     -> add attachment
// ============================================================================

import crypto from 'crypto';
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { autoAdmitFromConsult } from './_lib/teamAssignment.js';

// Status workflow definitions
const RECEIVED_STATUSES   = ['received', 'acknowledged', 'reviewed', 'plan_approved', 'plan_implemented', 'closed', 'cancelled'];
const DELIVERED_STATUSES  = ['delivered', 'acknowledged', 'responded', 'closed'];
const URGENCIES           = ['emergency', 'urgent', 'routine'];

let tablesEnsured = false;
async function ensureTables() {
  if (tablesEnsured) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS consult_submission_links (
       id SERIAL PRIMARY KEY, token VARCHAR(64) UNIQUE NOT NULL,
       unit_label VARCHAR(120) NOT NULL, description TEXT,
       is_active BOOLEAN DEFAULT TRUE, submission_count INTEGER DEFAULT 0,
       created_by INTEGER, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       last_used_at TIMESTAMPTZ
     )`,
    `CREATE TABLE IF NOT EXISTS received_consults (
       id SERIAL PRIMARY KEY, consult_ref VARCHAR(40) UNIQUE NOT NULL,
       submission_token VARCHAR(64), source VARCHAR(20) DEFAULT 'public_form',
       patient_name VARCHAR(255) NOT NULL, hospital_number VARCHAR(60),
       age INTEGER, sex VARCHAR(10), ward VARCHAR(120), bed_number VARCHAR(40),
       referring_unit VARCHAR(180) NOT NULL, referring_consultant VARCHAR(180),
       referring_doctor_name VARCHAR(180) NOT NULL, referring_doctor_role VARCHAR(80),
       referring_phone VARCHAR(40) NOT NULL, referring_alt_phone VARCHAR(40),
       primary_diagnosis TEXT, presenting_complaint TEXT, history_summary TEXT,
       examination_summary TEXT, investigations_summary TEXT,
       indication TEXT NOT NULL, urgency VARCHAR(20) DEFAULT 'routine',
       requested_input TEXT,
       status VARCHAR(30) DEFAULT 'received',
       acknowledged_by INTEGER, acknowledged_at TIMESTAMPTZ,
       reviewed_by INTEGER, reviewed_at TIMESTAMPTZ,
       plan_approved_by INTEGER, plan_approved_at TIMESTAMPTZ,
       plan_implemented_by INTEGER, plan_implemented_at TIMESTAMPTZ,
       closed_at TIMESTAMPTZ,
       review_notes TEXT, proposed_plan TEXT, plan_approval_notes TEXT, implementation_notes TEXT,
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       last_feedback_sent_at TIMESTAMPTZ
     )`,
    `CREATE TABLE IF NOT EXISTS delivered_consults (
       id SERIAL PRIMARY KEY, consult_ref VARCHAR(40) UNIQUE NOT NULL,
       patient_name VARCHAR(255) NOT NULL, hospital_number VARCHAR(60),
       receiving_unit VARCHAR(180) NOT NULL, receiving_consultant VARCHAR(180),
       receiver_name VARCHAR(180) NOT NULL, receiver_phone VARCHAR(40) NOT NULL,
       receiver_role VARCHAR(80),
       written_by_user_id INTEGER, written_by_name VARCHAR(180),
       handwritten_image_url TEXT, ocr_raw_text TEXT, ocr_structured JSONB,
       consult_summary TEXT, delivered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       status VARCHAR(30) DEFAULT 'delivered',
       acknowledged_at TIMESTAMPTZ, response_received_at TIMESTAMPTZ, response_text TEXT,
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS consult_status_history (
       id SERIAL PRIMARY KEY, consult_kind VARCHAR(20) NOT NULL,
       consult_id INTEGER NOT NULL, from_status VARCHAR(30), to_status VARCHAR(30) NOT NULL,
       notes TEXT, actor_user_id INTEGER, actor_name VARCHAR(180),
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS consult_attachments (
       id SERIAL PRIMARY KEY, consult_kind VARCHAR(20) NOT NULL, consult_id INTEGER NOT NULL,
       kind VARCHAR(30) NOT NULL, file_name VARCHAR(255), mime_type VARCHAR(80),
       data_url TEXT, remote_url TEXT, ocr_text TEXT, ocr_structured JSONB, metadata JSONB,
       uploaded_by INTEGER, uploaded_by_name VARCHAR(180),
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS consult_digital_charts (
       id SERIAL PRIMARY KEY, consult_kind VARCHAR(20) NOT NULL, consult_id INTEGER NOT NULL,
       chart_type VARCHAR(40) NOT NULL, title VARCHAR(180), series JSONB NOT NULL,
       source_attachment_id INTEGER, notes TEXT,
       created_by INTEGER, created_by_name VARCHAR(180),
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS consult_feedback_log (
       id SERIAL PRIMARY KEY, consult_kind VARCHAR(20) NOT NULL, consult_id INTEGER NOT NULL,
       channel VARCHAR(20) DEFAULT 'sms', to_phone VARCHAR(40), to_name VARCHAR(180),
       message TEXT NOT NULL, status VARCHAR(20) DEFAULT 'queued',
       provider VARCHAR(40), provider_id VARCHAR(120), error_message TEXT,
       sent_by INTEGER, sent_by_name VARCHAR(180),
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMPTZ
     )`,
  ];
  for (const s of stmts) {
    // Best-effort per statement: a pre-existing table with drifted schema
    // must not 500 the whole module. CREATE TABLE IF NOT EXISTS is a no-op
    // when the table already exists, so swallowing here is safe.
    try { await query(s); } catch (e) { console.warn('consults ensureTables stmt skipped:', e.message); }
  }
  // Indices (best-effort)
  const idx = [
    `CREATE INDEX IF NOT EXISTS idx_consult_links_token ON consult_submission_links(token) WHERE is_active = TRUE`,
    `CREATE INDEX IF NOT EXISTS idx_received_consults_status  ON received_consults(status)`,
    `CREATE INDEX IF NOT EXISTS idx_received_consults_created ON received_consults(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_delivered_consults_status ON delivered_consults(status)`,
    `CREATE INDEX IF NOT EXISTS idx_consult_status_hx ON consult_status_history(consult_kind, consult_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consult_attach    ON consult_attachments(consult_kind, consult_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_consult_charts    ON consult_digital_charts(consult_kind, consult_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consult_feedback  ON consult_feedback_log(consult_kind, consult_id, created_at DESC)`,
  ];
  for (const s of idx) { try { await query(s); } catch {} }

  // Addendum v2.1 — referring clinical-team + referral-metadata columns.
  // ADD COLUMN IF NOT EXISTS is a no-op when the column already exists, so
  // this self-migrates existing deployments on the first request.
  const alters = [
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_hospital                VARCHAR(200)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_department              VARCHAR(180)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_consultant_id           INTEGER`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_consultant_phone        VARCHAR(60)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_senior_registrar_name   VARCHAR(180)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_senior_registrar_phone  VARCHAR(60)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_registrar_name          VARCHAR(180)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_registrar_phone         VARCHAR(60)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_house_officer_name      VARCHAR(180)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_house_officer_phone     VARCHAR(60)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_medical_officer_name    VARCHAR(180)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_medical_officer_phone   VARCHAR(60)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referral_priority                 VARCHAR(20)`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS reason_for_referral               TEXT`,
    `ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referral_datetime                 TIMESTAMPTZ`,
    `CREATE INDEX IF NOT EXISTS idx_received_consults_department ON received_consults(referring_department)`,
    `CREATE INDEX IF NOT EXISTS idx_received_consults_ref_unit   ON received_consults(referring_unit)`,
    `CREATE INDEX IF NOT EXISTS idx_received_consults_priority   ON received_consults(referral_priority)`,
  ];
  for (const s of alters) { try { await query(s); } catch (e) { console.warn('consults ensureTables alter skipped:', e.message); } }

  tablesEnsured = true;
}

// Shared column list + value builder for the referring clinical-team fields.
// Used by both the public-submit and staff-entry INSERTs so they stay in sync.
const REFERRING_TEAM_COLUMNS = [
  'referring_hospital', 'referring_department', 'referring_consultant_id', 'referring_consultant_phone',
  'referring_senior_registrar_name', 'referring_senior_registrar_phone',
  'referring_registrar_name', 'referring_registrar_phone',
  'referring_house_officer_name', 'referring_house_officer_phone',
  'referring_medical_officer_name', 'referring_medical_officer_phone',
  'referral_priority', 'reason_for_referral', 'referral_datetime',
];
function referringTeamValues(body, urgency) {
  const dt = body.referral_datetime ? new Date(body.referral_datetime) : new Date();
  return [
    body.referring_hospital || null,
    body.referring_department || null,
    body.referring_consultant_id ? parseInt(body.referring_consultant_id, 10) : null,
    body.referring_consultant_phone || null,
    body.referring_senior_registrar_name || null,
    body.referring_senior_registrar_phone || null,
    body.referring_registrar_name || null,
    body.referring_registrar_phone || null,
    body.referring_house_officer_name || null,
    body.referring_house_officer_phone || null,
    body.referring_medical_officer_name || null,
    body.referring_medical_officer_phone || null,
    body.referral_priority || urgency,       // priority mirrors urgency when unset
    body.reason_for_referral || body.indication || null,
    dt,
  ];
}

// ── Helpers ───────────────────────────────────────────────────────────────
function generateRef(prefix) {
  const yr = new Date().getFullYear();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${yr}-${rand}`;
}
function generateToken() {
  // Short, URL-friendly base62 token (10 chars ≈ 8.4×10^17 keyspace).
  // Cryptographically random — rejection-sampled so each char is uniformly
  // distributed over the 62-char alphabet (no modulo bias).
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const TOKEN_LEN = 10;
  const out = [];
  while (out.length < TOKEN_LEN) {
    const buf = crypto.randomBytes(TOKEN_LEN * 2);
    for (let i = 0; i < buf.length && out.length < TOKEN_LEN; i++) {
      const b = buf[i];
      if (b < 248) out.push(alphabet[b % 62]); // 248 = 62*4, uniform sampling
    }
  }
  return out.join('');
}
function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}
function notFound(res) { return bad(res, 'Not found', 404); }

async function recordHistory(kind, id, fromStatus, toStatus, notes, user) {
  await query(
    `INSERT INTO consult_status_history (consult_kind, consult_id, from_status, to_status, notes, actor_user_id, actor_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [kind, id, fromStatus || null, toStatus, notes || null, user?.id || null, user?.full_name || user?.name || null]
  );
}

// SMS provider stub. Replace with Termii/Twilio/etc. by reading envs and calling provider HTTP API.
// Always logs the message to consult_feedback_log so the workflow is observable.
async function sendSms({ toPhone, toName, message }) {
  const provider = process.env.SMS_PROVIDER || 'console';
  if (provider === 'console') {
    console.log(`[CONSULT-SMS:console] -> ${toPhone} (${toName || 'unit'}): ${message}`);
    return { provider: 'console', providerId: null, ok: true };
  }
  // TODO: integrate Termii / Twilio here using process.env.SMS_API_KEY etc.
  return { provider, providerId: null, ok: false, error: `Provider ${provider} not implemented` };
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (cors(req, res)) return;
  try {
    await ensureTables();
  } catch (err) {
    console.error('ensureTables failed:', err);
    return res.status(500).json({ error: 'DB init failed', message: err.message });
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const path = parsedUrl.pathname.replace(/^\/api\/consults-module/, '').replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  const method = req.method;

  try {
    // ── PUBLIC ROUTES ───────────────────────────────────────────────────
    if (parts[0] === 'public') {
      if (parts[1] === 'link' && parts[2] && method === 'GET') {
        const r = await query(
          `SELECT token, unit_label, description, is_active FROM consult_submission_links WHERE token=$1`,
          [parts[2]]
        );
        if (!r.rows[0] || !r.rows[0].is_active) return bad(res, 'Link not found or inactive', 404);
        return res.status(200).json(r.rows[0]);
      }
      if (parts[1] === 'submit' && parts[2] && method === 'POST') {
        return submitPublicConsult(parts[2], req.body || {}, res);
      }
      return notFound(res);
    }

    // ── AUTH GATE for everything else ───────────────────────────────────
    const auth = authenticateRequest(req);
    if (!auth.authenticated) return res.status(401).json({ error: auth.error });
    const user = auth.user;

    // /links
    if (parts[0] === 'links') {
      if (parts.length === 1 && method === 'GET') {
        const r = await query(`SELECT * FROM consult_submission_links ORDER BY created_at DESC LIMIT 200`);
        return res.status(200).json({ links: r.rows });
      }
      if (parts.length === 1 && method === 'POST') {
        const { unit_label, description } = req.body || {};
        if (!unit_label) return bad(res, 'unit_label required');
        // Retry on the (vanishingly rare) chance of a token collision against
        // the UNIQUE index — PG error code 23505.
        let r, lastErr;
        for (let attempt = 0; attempt < 5; attempt++) {
          const token = generateToken();
          try {
            r = await query(
              `INSERT INTO consult_submission_links (token, unit_label, description, created_by)
               VALUES ($1,$2,$3,$4) RETURNING *`,
              [token, unit_label, description || null, user.id || null]
            );
            break;
          } catch (e) {
            lastErr = e;
            if (e && e.code === '23505') continue; // unique-violation → retry
            throw e;
          }
        }
        if (!r) throw lastErr || new Error('Failed to allocate a unique token');
        return res.status(201).json(r.rows[0]);
      }
      if (parts.length === 2 && method === 'PATCH') {
        const id = parseInt(parts[1], 10);
        const { is_active } = req.body || {};
        const r = await query(
          `UPDATE consult_submission_links SET is_active=$1 WHERE id=$2 RETURNING *`,
          [!!is_active, id]
        );
        if (!r.rows[0]) return notFound(res);
        return res.status(200).json(r.rows[0]);
      }
      if (parts.length === 2 && method === 'DELETE') {
        const id = parseInt(parts[1], 10);
        await query(`DELETE FROM consult_submission_links WHERE id=$1`, [id]);
        return res.status(204).end();
      }
      return notFound(res);
    }

    // /received
    if (parts[0] === 'received') {
      // /received
      if (parts.length === 1 && method === 'GET')  return listReceived(req, res);
      if (parts.length === 1 && method === 'POST') return createReceivedByStaff(req.body || {}, user, res);
      // /received/analytics — referral reporting aggregates (must precede the :id parse)
      if (parts.length === 2 && parts[1] === 'analytics' && method === 'GET') return receivedAnalytics(req, res);
      // /received/:id
      const id = parseInt(parts[1], 10);
      if (!id) return notFound(res);
      if (parts.length === 2 && method === 'GET') return getReceivedDetail(id, res);
      // /received/:id/status
      if (parts.length === 3 && parts[2] === 'status' && method === 'PATCH')
        return updateReceivedStatus(id, req.body || {}, user, res);
      // /received/:id/attachments
      if (parts.length === 3 && parts[2] === 'attachments' && method === 'POST')
        return addAttachment('received', id, req.body || {}, user, res);
      if (parts.length === 4 && parts[2] === 'attachments' && method === 'DELETE')
        return deleteAttachment(parseInt(parts[3], 10), res);
      // /received/:id/charts
      if (parts.length === 3 && parts[2] === 'charts' && method === 'POST')
        return saveDigitalChart('received', id, req.body || {}, user, res);
      // /received/:id/feedback
      if (parts.length === 3 && parts[2] === 'feedback' && method === 'POST')
        return sendFeedback('received', id, req.body || {}, user, res);
      return notFound(res);
    }

    // /delivered
    if (parts[0] === 'delivered') {
      if (parts.length === 1 && method === 'GET')  return listDelivered(req, res);
      if (parts.length === 1 && method === 'POST') return createDelivered(req.body || {}, user, res);
      const id = parseInt(parts[1], 10);
      if (!id) return notFound(res);
      if (parts.length === 2 && method === 'GET') return getDeliveredDetail(id, res);
      if (parts.length === 3 && parts[2] === 'status' && method === 'PATCH')
        return updateDeliveredStatus(id, req.body || {}, user, res);
      if (parts.length === 3 && parts[2] === 'attachments' && method === 'POST')
        return addAttachment('delivered', id, req.body || {}, user, res);
      return notFound(res);
    }

    return notFound(res);
  } catch (err) {
    console.error('consults-module error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

// ── Public submission ────────────────────────────────────────────────────
async function submitPublicConsult(token, body, res) {
  const link = (await query(`SELECT * FROM consult_submission_links WHERE token=$1 AND is_active=TRUE`, [token])).rows[0];
  if (!link) return bad(res, 'Invalid or inactive link', 404);

  const required = ['patient_name', 'referring_unit', 'referring_doctor_name', 'referring_phone', 'indication'];
  for (const f of required) if (!body[f] || String(body[f]).trim() === '') return bad(res, `${f} is required`);

  const urgency = URGENCIES.includes(body.urgency) ? body.urgency : 'routine';
  const ref = generateRef('RC');
  const baseCols = [
    'consult_ref', 'submission_token', 'source',
    'patient_name', 'hospital_number', 'age', 'sex', 'ward', 'bed_number',
    'referring_unit', 'referring_consultant', 'referring_doctor_name', 'referring_doctor_role',
    'referring_phone', 'referring_alt_phone',
    'primary_diagnosis', 'presenting_complaint', 'history_summary', 'examination_summary', 'investigations_summary',
    'indication', 'urgency', 'requested_input',
  ];
  const baseVals = [
    ref, token, 'public_form',
    body.patient_name, body.hospital_number || null, body.age || null, body.sex || null, body.ward || null, body.bed_number || null,
    body.referring_unit, body.referring_consultant || null, body.referring_doctor_name, body.referring_doctor_role || null,
    body.referring_phone, body.referring_alt_phone || null,
    body.primary_diagnosis || null, body.presenting_complaint || null, body.history_summary || null,
    body.examination_summary || null, body.investigations_summary || null,
    body.indication, urgency, body.requested_input || null,
  ];
  const cols = [...baseCols, ...REFERRING_TEAM_COLUMNS];
  const vals = [...baseVals, ...referringTeamValues(body, urgency)];
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
  const r = await query(
    `INSERT INTO received_consults (${cols.join(',')}) VALUES (${placeholders})
     RETURNING *`,
    vals
  );
  await query(`UPDATE consult_submission_links SET submission_count = submission_count + 1, last_used_at = CURRENT_TIMESTAMP WHERE id=$1`, [link.id]);
  await recordHistory('received', r.rows[0].id, null, 'received', `Submitted via public link (${link.unit_label})`, null);
  // Auto-admit + assign a full team for every received consult, on receipt.
  try { await autoAdmitFromConsult(r.rows[0], null); }
  catch (e) { console.error('auto-admit (public submit) failed:', e.message); }
  return res.status(201).json({
    success: true,
    consult_ref: r.rows[0].consult_ref,
    created_at: r.rows[0].created_at,
    message: 'Consult submitted to plastic surgery unit. You will receive feedback at the phone number provided.',
  });
}

// ── Received: list/create/detail/status ──────────────────────────────────
async function listReceived(req, res) {
  const {
    status, urgency, search, page = '1', per_page = '20',
    referring_department, referring_unit, referring_consultant, ward, priority, date_from, date_to,
  } = req.query;
  const where = []; const args = [];
  if (status)   { args.push(status);   where.push(`status=$${args.length}`); }
  if (urgency)  { args.push(urgency);  where.push(`urgency=$${args.length}`); }
  if (priority) { args.push(priority); where.push(`COALESCE(referral_priority, urgency)=$${args.length}`); }
  if (referring_department) { args.push(referring_department); where.push(`referring_department=$${args.length}`); }
  if (referring_unit)       { args.push(referring_unit);       where.push(`referring_unit=$${args.length}`); }
  if (referring_consultant) { args.push(referring_consultant); where.push(`referring_consultant=$${args.length}`); }
  if (ward)                 { args.push(ward);                 where.push(`ward=$${args.length}`); }
  if (date_from) { args.push(date_from); where.push(`COALESCE(referral_datetime, created_at) >= $${args.length}`); }
  if (date_to)   { args.push(date_to);   where.push(`COALESCE(referral_datetime, created_at) <= $${args.length}`); }
  if (search) {
    args.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(patient_name) LIKE $${args.length} OR LOWER(hospital_number) LIKE $${args.length} OR LOWER(referring_unit) LIKE $${args.length} OR LOWER(consult_ref) LIKE $${args.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(parseInt(per_page, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
  const total = parseInt((await query(`SELECT COUNT(*)::int AS c FROM received_consults ${whereSql}`, args)).rows[0].c, 10);
  args.push(limit); args.push(offset);
  const rows = (await query(
    `SELECT * FROM received_consults ${whereSql}
     ORDER BY CASE urgency WHEN 'emergency' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
              created_at DESC
     LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args
  )).rows;
  return res.status(200).json({ total, page: parseInt(page, 10) || 1, per_page: limit, consults: rows });
}

// ── Referral analytics (Addendum v2.1 §8) ─────────────────────────────────
// Aggregates for the referral reporting dashboard. Optional date_from/date_to
// window (applied to referral_datetime, falling back to created_at).
async function receivedAnalytics(req, res) {
  const { date_from, date_to } = req.query;
  const where = []; const args = [];
  if (date_from) { args.push(date_from); where.push(`COALESCE(referral_datetime, created_at) >= $${args.length}`); }
  if (date_to)   { args.push(date_to);   where.push(`COALESCE(referral_datetime, created_at) <= $${args.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const groupCount = async (col) => (await query(
    `SELECT COALESCE(NULLIF(TRIM(${col}), ''), 'Unspecified') AS label, COUNT(*)::int AS count
       FROM received_consults ${whereSql}
       GROUP BY 1 ORDER BY count DESC, label ASC`, args
  )).rows;

  // Run sequentially (not Promise.all) so a single report request never holds
  // more than one pooled DB connection at a time — the Supabase pooler caps
  // concurrent clients, and parallel fan-out here was needlessly connection-hungry.
  const byDepartment = await groupCount('referring_department');
  const byUnit = await groupCount('referring_unit');
  const byConsultant = await groupCount('referring_consultant');
  const byWard = await groupCount('ward');
  const byPriority = (await query(
    `SELECT COALESCE(NULLIF(TRIM(referral_priority), ''), urgency, 'routine') AS label, COUNT(*)::int AS count
       FROM received_consults ${whereSql} GROUP BY 1 ORDER BY count DESC`, args
  )).rows;

  // Avg response time (first acknowledgement) in hours, overall and per unit.
  const respArgs = args.slice();
  const respWhere = where.slice();
  respWhere.push('acknowledged_at IS NOT NULL');
  const respWhereSql = `WHERE ${respWhere.join(' AND ')}`;
  const avgResponseByUnit = (await query(
    `SELECT COALESCE(NULLIF(TRIM(referring_unit), ''), 'Unspecified') AS label,
            ROUND(AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 3600.0)::numeric, 1)::float AS avg_hours,
            COUNT(*)::int AS count
       FROM received_consults ${respWhereSql}
       GROUP BY 1 ORDER BY avg_hours ASC NULLS LAST`, respArgs
  )).rows;
  const overall = (await query(
    `SELECT COUNT(*)::int AS total,
            ROUND(AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 3600.0)::numeric, 1)::float AS avg_response_hours
       FROM received_consults ${respWhereSql}`, respArgs
  )).rows[0];
  const totalAll = (await query(`SELECT COUNT(*)::int AS c FROM received_consults ${whereSql}`, args)).rows[0].c;

  // Trend over time — daily referral counts.
  const trend = (await query(
    `SELECT TO_CHAR(DATE_TRUNC('day', COALESCE(referral_datetime, created_at)), 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS count
       FROM received_consults ${whereSql}
       GROUP BY 1 ORDER BY 1 ASC`, args
  )).rows;

  return res.status(200).json({
    total: totalAll,
    acknowledged: overall.total,
    avg_response_hours: overall.avg_response_hours,
    by_department: byDepartment,
    by_unit: byUnit,
    by_consultant: byConsultant,
    by_ward: byWard,
    by_priority: byPriority,
    avg_response_by_unit: avgResponseByUnit,
    trend,
  });
}

async function createReceivedByStaff(body, user, res) {
  const required = ['patient_name', 'referring_unit', 'referring_doctor_name', 'referring_phone', 'indication'];
  for (const f of required) if (!body[f]) return bad(res, `${f} is required`);
  const ref = generateRef('RC');
  const urgency = URGENCIES.includes(body.urgency) ? body.urgency : 'routine';
  const baseCols = [
    'consult_ref', 'source', 'patient_name', 'hospital_number', 'age', 'sex', 'ward', 'bed_number',
    'referring_unit', 'referring_consultant', 'referring_doctor_name', 'referring_doctor_role',
    'referring_phone', 'referring_alt_phone',
    'primary_diagnosis', 'presenting_complaint', 'history_summary', 'examination_summary', 'investigations_summary',
    'indication', 'urgency', 'requested_input',
  ];
  const baseVals = [
    ref, 'staff_entry', body.patient_name, body.hospital_number || null, body.age || null, body.sex || null, body.ward || null, body.bed_number || null,
    body.referring_unit, body.referring_consultant || null, body.referring_doctor_name, body.referring_doctor_role || null,
    body.referring_phone, body.referring_alt_phone || null,
    body.primary_diagnosis || null, body.presenting_complaint || null, body.history_summary || null,
    body.examination_summary || null, body.investigations_summary || null,
    body.indication, urgency, body.requested_input || null,
  ];
  const cols = [...baseCols, ...REFERRING_TEAM_COLUMNS];
  const vals = [...baseVals, ...referringTeamValues(body, urgency)];
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(',');
  const r = await query(
    `INSERT INTO received_consults (${cols.join(',')}) VALUES (${placeholders}) RETURNING *`,
    vals
  );
  await recordHistory('received', r.rows[0].id, null, 'received', body.notes || 'Created by staff', user);
  // Staff-entered consults are trusted → auto-admit + assign a full team immediately.
  try { await autoAdmitFromConsult(r.rows[0], user); }
  catch (e) { console.error('auto-admit (staff entry) failed:', e.message); }
  return res.status(201).json(r.rows[0]);
}

async function getReceivedDetail(id, res) {
  const c = (await query(`SELECT * FROM received_consults WHERE id=$1`, [id])).rows[0];
  if (!c) return notFound(res);
  const [attachments, history, charts, feedback] = await Promise.all([
    query(`SELECT id, kind, file_name, mime_type, ocr_text, ocr_structured, metadata, uploaded_by_name, created_at,
                  (data_url IS NOT NULL) AS has_data_url, remote_url
             FROM consult_attachments WHERE consult_kind='received' AND consult_id=$1 ORDER BY created_at DESC`, [id]),
    query(`SELECT * FROM consult_status_history WHERE consult_kind='received' AND consult_id=$1 ORDER BY created_at ASC`, [id]),
    query(`SELECT * FROM consult_digital_charts WHERE consult_kind='received' AND consult_id=$1 ORDER BY created_at DESC`, [id]),
    query(`SELECT id, channel, to_phone, to_name, message, status, provider, sent_by_name, created_at, sent_at, error_message
             FROM consult_feedback_log WHERE consult_kind='received' AND consult_id=$1 ORDER BY created_at DESC`, [id]),
  ]);
  return res.status(200).json({
    consult: c,
    attachments: attachments.rows,
    history: history.rows,
    charts: charts.rows,
    feedback: feedback.rows,
  });
}

async function updateReceivedStatus(id, body, user, res) {
  const c = (await query(`SELECT * FROM received_consults WHERE id=$1`, [id])).rows[0];
  if (!c) return notFound(res);
  const to = body.to_status;
  if (!RECEIVED_STATUSES.includes(to)) return bad(res, `Invalid to_status. Allowed: ${RECEIVED_STATUSES.join(', ')}`);

  // Map status -> timestamp + actor columns + form field columns
  const sets = ['status=$1', 'updated_at=CURRENT_TIMESTAMP']; const args = [to];
  const stamp = (col) => { args.push(new Date()); sets.push(`${col}=$${args.length}`); };
  const actor = (col) => { args.push(user.id || null); sets.push(`${col}=$${args.length}`); };
  const setText = (col, val) => { if (val === undefined) return; args.push(val || null); sets.push(`${col}=$${args.length}`); };

  if (to === 'acknowledged')      { stamp('acknowledged_at');      actor('acknowledged_by'); }
  if (to === 'reviewed')          { stamp('reviewed_at');          actor('reviewed_by');          setText('review_notes', body.review_notes); }
  if (to === 'plan_approved')     { stamp('plan_approved_at');     actor('plan_approved_by');     setText('proposed_plan', body.proposed_plan); setText('plan_approval_notes', body.plan_approval_notes); }
  if (to === 'plan_implemented')  { stamp('plan_implemented_at');  actor('plan_implemented_by');  setText('implementation_notes', body.implementation_notes); }
  if (to === 'closed')            { stamp('closed_at'); }

  args.push(id);
  const r = await query(`UPDATE received_consults SET ${sets.join(', ')} WHERE id=$${args.length} RETURNING *`, args);
  await recordHistory('received', id, c.status, to, body.notes, user);
  // On acknowledgement, auto-admit the patient + assign a full team (covers
  // public-link consults, which are not admitted at submission time).
  if (to === 'acknowledged') {
    try { await autoAdmitFromConsult(r.rows[0], user); }
    catch (e) { console.error('auto-admit (acknowledge) failed:', e.message); }
  }
  return res.status(200).json(r.rows[0]);
}

// ── Attachments ───────────────────────────────────────────────────────────
async function addAttachment(kind, consultId, body, user, res) {
  if (!['received', 'delivered'].includes(kind)) return bad(res, 'Invalid kind');
  const allowed = ['clinical_photo', 'investigation_ocr', 'chart_ocr', 'digital_chart', 'document'];
  if (!allowed.includes(body.kind)) return bad(res, `Invalid attachment kind. Allowed: ${allowed.join(', ')}`);
  // Limit inline data_url size (~6 MB cap)
  if (body.data_url && body.data_url.length > 6 * 1024 * 1024) {
    return bad(res, 'Attachment too large; please re-scan or upload to remote storage.');
  }
  const r = await query(
    `INSERT INTO consult_attachments
       (consult_kind, consult_id, kind, file_name, mime_type, data_url, remote_url, ocr_text, ocr_structured, metadata, uploaded_by, uploaded_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, kind, file_name, mime_type, ocr_text, ocr_structured, metadata, uploaded_by_name, created_at,
               (data_url IS NOT NULL) AS has_data_url, remote_url`,
    [
      kind, consultId, body.kind,
      body.file_name || null, body.mime_type || null,
      body.data_url || null, body.remote_url || null,
      body.ocr_text || null,
      body.ocr_structured ? JSON.stringify(body.ocr_structured) : null,
      body.metadata ? JSON.stringify(body.metadata) : null,
      user?.id || null, user?.full_name || user?.name || null,
    ]
  );
  return res.status(201).json(r.rows[0]);
}

async function deleteAttachment(attId, res) {
  if (!attId) return bad(res, 'invalid id');
  await query(`DELETE FROM consult_attachments WHERE id=$1`, [attId]);
  return res.status(204).end();
}

// ── Digital chart ─────────────────────────────────────────────────────────
async function saveDigitalChart(kind, consultId, body, user, res) {
  if (!body.chart_type || !body.series) return bad(res, 'chart_type and series required');
  const r = await query(
    `INSERT INTO consult_digital_charts (consult_kind, consult_id, chart_type, title, series, source_attachment_id, notes, created_by, created_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      kind, consultId, body.chart_type, body.title || null,
      JSON.stringify(body.series),
      body.source_attachment_id || null, body.notes || null,
      user?.id || null, user?.full_name || user?.name || null,
    ]
  );
  return res.status(201).json(r.rows[0]);
}

// ── SMS feedback ──────────────────────────────────────────────────────────
async function sendFeedback(kind, consultId, body, user, res) {
  if (!body.message) return bad(res, 'message required');
  const c = (await query(`SELECT * FROM ${kind === 'received' ? 'received_consults' : 'delivered_consults'} WHERE id=$1`, [consultId])).rows[0];
  if (!c) return notFound(res);
  const toPhone = body.to_phone || (kind === 'received' ? c.referring_phone : c.receiver_phone);
  const toName  = body.to_name  || (kind === 'received' ? c.referring_doctor_name : c.receiver_name);
  if (!toPhone) return bad(res, 'No phone number on file');

  const log = (await query(
    `INSERT INTO consult_feedback_log (consult_kind, consult_id, channel, to_phone, to_name, message, sent_by, sent_by_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [kind, consultId, body.channel || 'sms', toPhone, toName, body.message, user.id || null, user.full_name || user.name || null]
  )).rows[0];

  const send = await sendSms({ toPhone, toName, message: body.message });
  await query(
    `UPDATE consult_feedback_log SET status=$1, provider=$2, provider_id=$3, error_message=$4, sent_at=CURRENT_TIMESTAMP WHERE id=$5`,
    [send.ok ? 'sent' : 'failed', send.provider, send.providerId || null, send.error || null, log.id]
  );
  if (kind === 'received') {
    await query(`UPDATE received_consults SET last_feedback_sent_at=CURRENT_TIMESTAMP WHERE id=$1`, [consultId]);
  }
  return res.status(send.ok ? 200 : 502).json({ ...log, status: send.ok ? 'sent' : 'failed', provider: send.provider, error_message: send.error || null });
}

// ── Delivered: list/create/detail/status ─────────────────────────────────
async function listDelivered(req, res) {
  const { status, search, page = '1', per_page = '20' } = req.query;
  const where = []; const args = [];
  if (status) { args.push(status); where.push(`status=$${args.length}`); }
  if (search) {
    args.push(`%${search.toLowerCase()}%`);
    where.push(`(LOWER(patient_name) LIKE $${args.length} OR LOWER(hospital_number) LIKE $${args.length} OR LOWER(receiving_unit) LIKE $${args.length} OR LOWER(consult_ref) LIKE $${args.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(parseInt(per_page, 10) || 20, 100);
  const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * limit;
  const total = parseInt((await query(`SELECT COUNT(*)::int AS c FROM delivered_consults ${whereSql}`, args)).rows[0].c, 10);
  args.push(limit); args.push(offset);
  const rows = (await query(
    `SELECT id, consult_ref, patient_name, hospital_number, receiving_unit, receiving_consultant, receiver_name, receiver_phone,
            written_by_name, status, delivered_at, response_received_at, created_at
       FROM delivered_consults ${whereSql} ORDER BY created_at DESC
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args
  )).rows;
  return res.status(200).json({ total, page: parseInt(page, 10) || 1, per_page: limit, consults: rows });
}

async function createDelivered(body, user, res) {
  const required = ['patient_name', 'receiving_unit', 'receiver_name', 'receiver_phone'];
  for (const f of required) if (!body[f] || String(body[f]).trim() === '') return bad(res, `${f} is required`);
  const ref = generateRef('DC');
  const r = await query(
    `INSERT INTO delivered_consults
       (consult_ref, patient_name, hospital_number, receiving_unit, receiving_consultant,
        receiver_name, receiver_phone, receiver_role,
        written_by_user_id, written_by_name,
        handwritten_image_url, ocr_raw_text, ocr_structured, consult_summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      ref, body.patient_name, body.hospital_number || null,
      body.receiving_unit, body.receiving_consultant || null,
      body.receiver_name, body.receiver_phone, body.receiver_role || null,
      user.id || null, user.full_name || user.name || null,
      body.handwritten_image_url || null,
      body.ocr_raw_text || null,
      body.ocr_structured ? JSON.stringify(body.ocr_structured) : null,
      body.consult_summary || null,
    ]
  );
  await recordHistory('delivered', r.rows[0].id, null, 'delivered', body.notes || 'Delivered consult logged', user);
  return res.status(201).json(r.rows[0]);
}

async function getDeliveredDetail(id, res) {
  const c = (await query(`SELECT * FROM delivered_consults WHERE id=$1`, [id])).rows[0];
  if (!c) return notFound(res);
  const [attachments, history, feedback] = await Promise.all([
    query(`SELECT id, kind, file_name, mime_type, ocr_text, ocr_structured, metadata, uploaded_by_name, created_at,
                  (data_url IS NOT NULL) AS has_data_url, remote_url
             FROM consult_attachments WHERE consult_kind='delivered' AND consult_id=$1 ORDER BY created_at DESC`, [id]),
    query(`SELECT * FROM consult_status_history WHERE consult_kind='delivered' AND consult_id=$1 ORDER BY created_at ASC`, [id]),
    query(`SELECT id, channel, to_phone, to_name, message, status, provider, sent_by_name, created_at, sent_at, error_message
             FROM consult_feedback_log WHERE consult_kind='delivered' AND consult_id=$1 ORDER BY created_at DESC`, [id]),
  ]);
  return res.status(200).json({ consult: c, attachments: attachments.rows, history: history.rows, feedback: feedback.rows });
}

async function updateDeliveredStatus(id, body, user, res) {
  const c = (await query(`SELECT * FROM delivered_consults WHERE id=$1`, [id])).rows[0];
  if (!c) return notFound(res);
  const to = body.to_status;
  if (!DELIVERED_STATUSES.includes(to)) return bad(res, `Invalid to_status. Allowed: ${DELIVERED_STATUSES.join(', ')}`);
  const sets = ['status=$1', 'updated_at=CURRENT_TIMESTAMP']; const args = [to];
  if (to === 'acknowledged') { args.push(new Date()); sets.push(`acknowledged_at=$${args.length}`); }
  if (to === 'responded')    { args.push(new Date()); sets.push(`response_received_at=$${args.length}`); if (body.response_text !== undefined) { args.push(body.response_text || null); sets.push(`response_text=$${args.length}`); } }
  args.push(id);
  const r = await query(`UPDATE delivered_consults SET ${sets.join(', ')} WHERE id=$${args.length} RETURNING *`, args);
  await recordHistory('delivered', id, c.status, to, body.notes, user);
  return res.status(200).json(r.rows[0]);
}
