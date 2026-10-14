// ============================================================================
// Clinical governance decisions (D1–D7 in docs/clinical/CLINICAL_IMPLEMENTATION_PLAN.md).
//
// The unit makes these decisions; the software only stores and enforces them.
// Each save is a new row (who, when, what), so the history of every decision
// is kept. The latest row is in force. Edited on Admin > Clinical Governance.
// ============================================================================

import { query } from './db.js';

/** Who may change governance decisions. */
export const GOVERNANCE_EDIT_ROLES = ['admin', 'super_admin', 'consultant'];

export const GOVERNANCE_OPTIONS = Object.freeze({
  d2_early_warning: ['undecided', 'news2_standard', 'news2_local_modified', 'none'],
  d4_terminology: ['local_only', 'local_icd10_loinc', 'snomed_licensed'],
  d5_external_ai: ['disabled', 'enabled_deidentified'],
  d6_sign_roles: ['house_officer', 'registrar', 'junior_registrar', 'senior_registrar', 'consultant', 'admin', 'super_admin'],
});

export const GOVERNANCE_DEFAULTS = Object.freeze({
  // D1: who approves clinical content (templates, rules, monitoring profiles).
  d1_content_approver_ids: [],
  // D2: early-warning score. Rules stay in shadow mode until this is decided.
  d2_early_warning: 'undecided',
  // D3: postoperative monitoring protocols live in clinical_rulesets and are
  // approved one by one; this records whether unapproved drafts may be shown
  // to staff as drafts.
  d3_show_draft_profiles: true,
  // D4: terminology coding.
  d4_terminology: 'local_icd10_loinc',
  // D5: external AI (OpenAI). Enabled by the unit 2026-10-14; identifiers are
  // removed before any text leaves the server.
  d5_external_ai: 'enabled_deidentified',
  // D6: who may sign / countersign / amend clinical documents.
  d6_sign_roles: ['registrar', 'junior_registrar', 'senior_registrar', 'consultant'],
  d6_countersign_roles: ['senior_registrar', 'consultant'],
  d6_amend_roles: ['senior_registrar', 'consultant', 'admin', 'super_admin'],
  // D7: research exports.
  d7_research_approver_ids: [],
  d7_ethics_reference: '',
});

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS clinical_governance_settings (
    id SERIAL PRIMARY KEY,
    settings JSONB NOT NULL,
    updated_by INTEGER,
    updated_by_name TEXT,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
  )`);
  ensured = true;
}

let cache = { at: 0, value: null };

/** Decisions in force (defaults merged under the latest saved row). */
export async function getGovernance({ fresh = false } = {}) {
  if (!fresh && cache.value && Date.now() - cache.at < 60_000) return cache.value;
  let saved = {};
  let meta = null;
  try {
    await ensureTable();
    const r = await query(
      `SELECT settings, updated_by, updated_by_name, note, created_at FROM clinical_governance_settings ORDER BY id DESC LIMIT 1`
    );
    if (r.rows[0]) {
      saved = typeof r.rows[0].settings === 'string' ? JSON.parse(r.rows[0].settings) : r.rows[0].settings;
      meta = { updated_by: r.rows[0].updated_by, updated_by_name: r.rows[0].updated_by_name, note: r.rows[0].note, updated_at: r.rows[0].created_at };
    }
  } catch (e) {
    console.warn('getGovernance: using defaults:', e.message);
  }
  const value = { ...GOVERNANCE_DEFAULTS, ...saved, _meta: meta };
  cache = { at: Date.now(), value };
  return value;
}

/** Validate a proposed set of decisions; returns { settings } or { error }. */
export function normaliseGovernance(raw) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  const ids = (v) => (Array.isArray(v) ? v : []).map(x => String(x).trim()).filter(Boolean)
    .filter((x, i, a) => a.indexOf(x) === i);
  const roles = (v) => (Array.isArray(v) ? v : []).filter(r => GOVERNANCE_OPTIONS.d6_sign_roles.includes(r));
  const pick = (key) => {
    if (b[key] === undefined) return;
    if (!GOVERNANCE_OPTIONS[key].includes(b[key])) throw new Error(`${key} must be one of ${GOVERNANCE_OPTIONS[key].join(', ')}`);
    out[key] = b[key];
  };
  try {
    if (b.d1_content_approver_ids !== undefined) out.d1_content_approver_ids = ids(b.d1_content_approver_ids);
    pick('d2_early_warning');
    if (b.d3_show_draft_profiles !== undefined) out.d3_show_draft_profiles = !!b.d3_show_draft_profiles;
    pick('d4_terminology');
    pick('d5_external_ai');
    if (b.d6_sign_roles !== undefined) out.d6_sign_roles = roles(b.d6_sign_roles);
    if (b.d6_countersign_roles !== undefined) out.d6_countersign_roles = roles(b.d6_countersign_roles);
    if (b.d6_amend_roles !== undefined) out.d6_amend_roles = roles(b.d6_amend_roles);
    if (b.d7_research_approver_ids !== undefined) out.d7_research_approver_ids = ids(b.d7_research_approver_ids);
    if (b.d7_ethics_reference !== undefined) out.d7_ethics_reference = String(b.d7_ethics_reference || '').slice(0, 200);
  } catch (e) {
    return { error: e.message };
  }
  return { settings: out };
}

/** Save decisions (merged over those in force) as a new row. */
export async function saveGovernance(raw, user, note = null) {
  const { settings, error } = normaliseGovernance(raw);
  if (error) return { error };
  const current = await getGovernance({ fresh: true });
  const { _meta, ...inForce } = current;
  const merged = { ...inForce, ...settings };
  await ensureTable();
  await query(
    `INSERT INTO clinical_governance_settings (settings, updated_by, updated_by_name, note) VALUES ($1, $2, $3, $4)`,
    [JSON.stringify(merged), user?.id ?? null, user?.full_name || user?.name || null, note ? String(note).slice(0, 500) : null]
  );
  cache = { at: 0, value: null };
  return { settings: await getGovernance({ fresh: true }) };
}

/** Previous decisions, newest first. */
export async function governanceHistory(limit = 50) {
  await ensureTable();
  const r = await query(
    `SELECT id, settings, updated_by_name, note, created_at FROM clinical_governance_settings ORDER BY id DESC LIMIT $1`,
    [Math.min(Number(limit) || 50, 200)]
  );
  return r.rows;
}

/** True when content approval is restricted and this user is not an approver. */
export async function canApproveClinicalContent(user) {
  const g = await getGovernance();
  if (!user) return false;
  if (g.d1_content_approver_ids.length) return g.d1_content_approver_ids.includes(String(user.id));
  // No approver named yet: consultants and administrators may approve.
  return ['consultant', 'admin', 'super_admin'].includes(user.role);
}

export async function externalAiAllowed() {
  const g = await getGovernance();
  return g.d5_external_ai === 'enabled_deidentified';
}
