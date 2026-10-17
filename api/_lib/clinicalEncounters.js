// ============================================================================
// Structured clinical encounters (initial clerking and follow-up) and the
// problem list / plan items they feed.
//
//   clinical_encounters  one row per clerking or follow-up; the structured
//                        answers live in `data` (JSONB), the clinician's
//                        decisions on suggestions in `suggestions`.
//   clinical_problems    diagnoses the clinician ACCEPTED — tracked until
//                        resolved or ruled out.
//   clinical_plan_items  investigations / treatment the clinician ACCEPTED —
//                        tracked until done or stopped.
//
// Tracking rows are synced from the encounter's accepted suggestions on every
// submit, keyed by (encounter_id, suggestion_id), so resubmitting never
// duplicates and an un-accepted suggestion is withdrawn rather than deleted.
// Status flow: draft → pending_review (house officer) → signed; a signer may
// submit straight to signed. Concurrency: every update carries `version`.
// ============================================================================

import { query, getPool } from './db.js';
import { getGovernance } from './governance.js';

let ensured = false;
export async function ensureEncounterTables() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS clinical_encounters (
    id SERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL,
    admission_id TEXT,
    encounter_type TEXT NOT NULL DEFAULT 'initial',
    parent_encounter_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    data JSONB NOT NULL DEFAULT '{}',
    suggestions JSONB NOT NULL DEFAULT '[]',
    summary JSONB NOT NULL DEFAULT '{}',
    narrative TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER, created_by_name TEXT, created_by_role TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    signed_by INTEGER, signed_by_name TEXT, signed_at TIMESTAMPTZ,
    error_reason TEXT
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinical_encounters_patient ON clinical_encounters (patient_id, created_at DESC)`);
  await query(`CREATE TABLE IF NOT EXISTS clinical_problems (
    id SERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL,
    encounter_id INTEGER NOT NULL,
    suggestion_id TEXT NOT NULL,
    label TEXT NOT NULL,
    reasons JSONB NOT NULL DEFAULT '[]',
    dangerous BOOLEAN DEFAULT FALSE,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    last_review JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (encounter_id, suggestion_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinical_problems_patient ON clinical_problems (patient_id)`);
  await query(`CREATE TABLE IF NOT EXISTS clinical_plan_items (
    id SERIAL PRIMARY KEY,
    patient_id TEXT NOT NULL,
    encounter_id INTEGER NOT NULL,
    suggestion_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL,
    reason TEXT,
    priority TEXT,
    source TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    last_review JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (encounter_id, suggestion_id)
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinical_plan_items_patient ON clinical_plan_items (patient_id)`);
  ensured = true;
}

export const ENCOUNTER_TYPES = ['initial', 'follow_up'];
export const PROBLEM_STATUSES = ['active', 'improving', 'worsening', 'resolved', 'ruled_out', 'withdrawn'];
export const PLAN_STATUSES = ['pending', 'in_progress', 'done', 'not_done', 'stopped', 'withdrawn'];

// Follow-up review vocabulary → tracked status.
const PROBLEM_REVIEW_MAP = { improved: 'improving', unchanged: 'active', worse: 'worsening', resolved: 'resolved', ruled_out: 'ruled_out' };
const PLAN_REVIEW_MAP = { done: 'done', in_progress: 'in_progress', not_done: 'not_done', stopped: 'stopped' };

const MAX_DATA_BYTES = 512 * 1024;

const nameOf = (u) => u?.full_name || u?.name || u?.username || null;

export async function canSign(user) {
  const g = await getGovernance();
  return (g.d6_sign_roles || []).includes(user?.role) || ['admin', 'super_admin'].includes(user?.role);
}

function clean(body) {
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const suggestions = Array.isArray(body.suggestions) ? body.suggestions.slice(0, 200) : [];
  const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
  const narrative = typeof body.narrative === 'string' ? body.narrative.slice(0, 100000) : null;
  const size = JSON.stringify({ data, suggestions, summary }).length;
  if (size > MAX_DATA_BYTES) return { error: 'Encounter is too large to save' };
  return { data, suggestions, summary, narrative };
}

export async function listForPatient(patientId) {
  await ensureEncounterTables();
  const [enc, problems, plan] = await Promise.all([
    query(`SELECT * FROM clinical_encounters WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 100`, [String(patientId)]),
    query(`SELECT * FROM clinical_problems WHERE patient_id = $1 AND status <> 'withdrawn' ORDER BY created_at`, [String(patientId)]),
    query(`SELECT * FROM clinical_plan_items WHERE patient_id = $1 AND status <> 'withdrawn' ORDER BY created_at`, [String(patientId)]),
  ]);
  return { encounters: enc.rows, problems: problems.rows, plan_items: plan.rows };
}

export async function getEncounter(id) {
  await ensureEncounterTables();
  const r = await query(`SELECT * FROM clinical_encounters WHERE id = $1`, [Number(id)]);
  return r.rows[0] || null;
}

/** Create (no id) or update a draft / pending encounter. */
export async function saveEncounter(body, user) {
  await ensureEncounterTables();
  const c = clean(body);
  if (c.error) return { status: 400, error: c.error };
  if (!body.id) {
    if (!body.patient_id) return { status: 400, error: 'patient_id is required' };
    const type = ENCOUNTER_TYPES.includes(body.encounter_type) ? body.encounter_type : 'initial';
    const r = await query(
      `INSERT INTO clinical_encounters (patient_id, admission_id, encounter_type, parent_encounter_id, data, suggestions, summary, narrative,
         created_by, created_by_name, created_by_role)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [String(body.patient_id), body.admission_id ? String(body.admission_id) : null, type, body.parent_encounter_id ? Number(body.parent_encounter_id) : null,
       JSON.stringify(c.data), JSON.stringify(c.suggestions), JSON.stringify(c.summary), c.narrative,
       user?.id ?? null, nameOf(user), user?.role || null]
    );
    return { status: 201, encounter: r.rows[0] };
  }
  const existing = await getEncounter(body.id);
  if (!existing) return { status: 404, error: 'Encounter not found' };
  if (!['draft', 'pending_review'].includes(existing.status)) return { status: 409, error: 'This encounter is signed. Add a follow-up encounter instead.' };
  const signer = await canSign(user);
  if (String(existing.created_by) !== String(user?.id) && !signer) return { status: 403, error: 'Only the author or a registrar / consultant can edit this encounter' };
  const r = await query(
    `UPDATE clinical_encounters SET data = $1, suggestions = $2, summary = $3, narrative = $4, version = version + 1, updated_at = NOW()
     WHERE id = $5 AND version = $6 RETURNING *`,
    [JSON.stringify(c.data), JSON.stringify(c.suggestions), JSON.stringify(c.summary), c.narrative, Number(body.id), Number(body.version)]
  );
  if (!r.rows[0]) return { status: 409, error: 'Someone else saved this encounter after you opened it. Reload to see their changes.', current: await getEncounter(body.id) };
  return { status: 200, encounter: r.rows[0] };
}

/**
 * Bring the problem list and plan items in line with the encounter's accepted
 * suggestions, and apply a follow-up's reviews of earlier problems / items.
 */
async function syncTracking(client, enc) {
  const sugg = Array.isArray(enc.suggestions) ? enc.suggestions : [];
  const accepted = sugg.filter(s => s && s.decision === 'accepted');
  const keepIds = accepted.map(s => String(s.id));
  for (const s of accepted) {
    const text = String(s.edited || s.text || '').slice(0, 500);
    if (!text) continue;
    if (s.kind === 'differential') {
      await client.query(
        `INSERT INTO clinical_problems (patient_id, encounter_id, suggestion_id, label, reasons, dangerous, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (encounter_id, suggestion_id) DO UPDATE SET label = EXCLUDED.label, reasons = EXCLUDED.reasons,
           status = CASE WHEN clinical_problems.status = 'withdrawn' THEN 'active' ELSE clinical_problems.status END, updated_at = NOW()`,
        [enc.patient_id, enc.id, String(s.id), text, JSON.stringify(s.reasons || []), !!s.dangerous, s.source || null]
      );
    } else if (s.kind === 'investigation' || s.kind === 'treatment') {
      await client.query(
        `INSERT INTO clinical_plan_items (patient_id, encounter_id, suggestion_id, kind, text, reason, priority, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (encounter_id, suggestion_id) DO UPDATE SET text = EXCLUDED.text, priority = EXCLUDED.priority,
           status = CASE WHEN clinical_plan_items.status = 'withdrawn' THEN 'pending' ELSE clinical_plan_items.status END, updated_at = NOW()`,
        [enc.patient_id, enc.id, String(s.id), s.kind, text, (s.reasons || []).join('; ').slice(0, 500), s.priority || null, s.source || null]
      );
    }
  }
  await client.query(`UPDATE clinical_problems SET status = 'withdrawn', updated_at = NOW() WHERE encounter_id = $1 AND NOT (suggestion_id = ANY($2::text[]))`, [enc.id, keepIds]);
  await client.query(`UPDATE clinical_plan_items SET status = 'withdrawn', updated_at = NOW() WHERE encounter_id = $1 AND NOT (suggestion_id = ANY($2::text[]))`, [enc.id, keepIds]);

  if (enc.encounter_type === 'follow_up') {
    const review = { encounter_id: enc.id, at: new Date().toISOString() };
    for (const p of enc.data?.problems || []) {
      const status = PROBLEM_REVIEW_MAP[p.status];
      if (!status) continue;
      await client.query(
        `UPDATE clinical_problems SET status = $1, last_review = $2, updated_at = NOW() WHERE id = $3 AND patient_id = $4`,
        [status, JSON.stringify({ ...review, status: p.status, note: p.note || null }), Number(p.problemId), enc.patient_id]
      );
    }
    for (const i of enc.data?.plan || []) {
      const status = PLAN_REVIEW_MAP[i.status];
      if (!status) continue;
      await client.query(
        `UPDATE clinical_plan_items SET status = $1, last_review = $2, updated_at = NOW() WHERE id = $3 AND patient_id = $4`,
        [status, JSON.stringify({ ...review, status: i.status, note: i.note || null }), Number(i.itemId), enc.patient_id]
      );
    }
  }
}

/** Submit for review, or sign (when the user may sign). */
export async function submitEncounter(id, version, user, { sign = false } = {}) {
  await ensureEncounterTables();
  const enc = await getEncounter(id);
  if (!enc) return { status: 404, error: 'Encounter not found' };
  if (enc.status === 'signed') return { status: 409, error: 'Already signed' };
  if (enc.status === 'entered_in_error') return { status: 409, error: 'This encounter was marked entered in error' };
  if (version != null && Number(version) !== enc.version) return { status: 409, error: 'The encounter changed since you opened it. Reload first.' };
  const signer = await canSign(user);
  if (sign && !signer) return { status: 403, error: 'Your role cannot sign clinical encounters (Clinical Governance, D6). Submit it for review instead.' };
  if (String(enc.created_by) !== String(user?.id) && !signer) return { status: 403, error: 'Only the author or a registrar / consultant can submit this encounter' };
  const newStatus = signer ? 'signed' : 'pending_review';

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE clinical_encounters SET status = $1, submitted_at = COALESCE(submitted_at, NOW()),
         signed_by = $2, signed_by_name = $3, signed_at = $4, version = version + 1, updated_at = NOW()
       WHERE id = $5 AND version = $6 RETURNING *`,
      [newStatus, signer ? user?.id ?? null : null, signer ? nameOf(user) : null, signer ? new Date() : null, enc.id, enc.version]
    );
    if (!r.rows[0]) { await client.query('ROLLBACK'); return { status: 409, error: 'The encounter changed since you opened it. Reload first.' }; }
    await syncTracking(client, r.rows[0]);
    await client.query('COMMIT');
    return { status: 200, encounter: r.rows[0] };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Mark a whole encounter entered in error; its tracking rows are withdrawn. */
export async function markEncounterInError(id, user, reason) {
  await ensureEncounterTables();
  const enc = await getEncounter(id);
  if (!enc) return { status: 404, error: 'Encounter not found' };
  const g = await getGovernance();
  const isAuthorDraft = String(enc.created_by) === String(user?.id) && enc.status !== 'signed';
  if (!isAuthorDraft && !(g.d6_amend_roles || []).includes(user?.role)) {
    return { status: 403, error: 'Only the author (before signing) or an amending role (D6) can mark this entered in error' };
  }
  if (!reason || String(reason).trim().length < 3) return { status: 400, error: 'A reason is required' };
  await query(`UPDATE clinical_encounters SET status = 'entered_in_error', error_reason = $1, version = version + 1, updated_at = NOW() WHERE id = $2`, [String(reason).slice(0, 500), enc.id]);
  await query(`UPDATE clinical_problems SET status = 'withdrawn', updated_at = NOW() WHERE encounter_id = $1`, [enc.id]);
  await query(`UPDATE clinical_plan_items SET status = 'withdrawn', updated_at = NOW() WHERE encounter_id = $1`, [enc.id]);
  return { status: 200, encounter: await getEncounter(enc.id) };
}

/** Quick status change on a tracked problem or plan item (outside a follow-up). */
export async function updateTracked(kind, id, status, note, user) {
  await ensureEncounterTables();
  const table = kind === 'problem' ? 'clinical_problems' : 'clinical_plan_items';
  const allowed = kind === 'problem' ? PROBLEM_STATUSES : PLAN_STATUSES;
  if (!allowed.includes(status) || status === 'withdrawn') return { status: 400, error: `status must be one of ${allowed.filter(s => s !== 'withdrawn').join(', ')}` };
  const r = await query(
    `UPDATE ${table} SET status = $1, last_review = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
    [status, JSON.stringify({ status, note: note || null, by: nameOf(user), at: new Date().toISOString() }), Number(id)]
  );
  if (!r.rows[0]) return { status: 404, error: 'Not found' };
  return { status: 200, item: r.rows[0] };
}

// ── AI suggestions ─────────────────────────────────────────────────────────

export const AI_SYSTEM_PROMPT = `You are a senior consultant plastic and reconstructive surgeon and wound-care specialist supporting a resident doctor's clerking at a Nigerian teaching hospital.
You receive a de-identified, structured clerking as JSON. Missing fields mean "not documented" — never assume they are normal.
Return ONLY a JSON object:
{
  "differentials": [{"diagnosis": string, "icd10": string|null, "reasons": [string], "against": [string], "dangerous": boolean}],
  "investigations": [{"test": string, "reason": string, "urgent": boolean}],
  "treatment": [{"action": string, "reason": string, "urgent": boolean}],
  "missing_information": [string]
}
Rules:
- Up to 6 differentials, most likely first. Every reason must cite a documented finding from the input; do not invent findings.
- Always include relevant can't-miss diagnoses (malignancy in chronic wounds, necrotising infection, compartment syndrome, sepsis, airway burn) marked dangerous when the presentation allows them.
- Investigations and treatment must follow international guidance (e.g. WHO, NICE, IWGDF, ATLS, ISBI) and be practical in a resource-limited setting.
- Do not give patient-specific drug doses; say "per local guideline" where a drug is needed. Respect the listed allergies.
- "missing_information": the most important history or examination items still needed to narrow the diagnosis.
- These are suggestions for a clinician who will accept, edit or reject each one.`;

export function normaliseAiSuggestions(raw) {
  const arr = (v) => (Array.isArray(v) ? v : []);
  const s = (v, n = 300) => String(v ?? '').trim().slice(0, n);
  const slug = (t) => s(t, 80).toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const out = [];
  for (const d of arr(raw?.differentials).slice(0, 8)) {
    if (!s(d?.diagnosis)) continue;
    out.push({ id: `ai:dx:${slug(d.diagnosis)}`, kind: 'differential', text: s(d.diagnosis) + (d.icd10 ? ` (${s(d.icd10, 12)})` : ''),
      reasons: arr(d.reasons).map(x => s(x)).filter(Boolean).slice(0, 6), against: arr(d.against).map(x => s(x)).filter(Boolean).slice(0, 4),
      source: 'ai', dangerous: !!d.dangerous, priority: d.dangerous ? 'urgent' : 'routine', decision: 'pending' });
  }
  for (const i of arr(raw?.investigations).slice(0, 12)) {
    if (!s(i?.test)) continue;
    out.push({ id: `ai:inv:${slug(i.test)}`, kind: 'investigation', text: s(i.test), reasons: i.reason ? [s(i.reason)] : [], source: 'ai', priority: i.urgent ? 'urgent' : 'routine', decision: 'pending' });
  }
  for (const t of arr(raw?.treatment).slice(0, 12)) {
    if (!s(t?.action)) continue;
    out.push({ id: `ai:tx:${slug(t.action)}`, kind: 'treatment', text: s(t.action), reasons: t.reason ? [s(t.reason)] : [], source: 'ai', priority: t.urgent ? 'urgent' : 'routine', decision: 'pending' });
  }
  return { suggestions: out, missing: arr(raw?.missing_information).map(x => s(x, 200)).filter(Boolean).slice(0, 10) };
}
