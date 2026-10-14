// ============================================================================
// Versioned clinical content: postoperative monitoring profiles now, and later
// early-warning rules and risk tools (clinical_rulesets in
// docs/clinical/CLINICAL_DATA_MODEL_PROPOSAL.md §6).
//
// Every edit creates a new version. A version is 'draft' until someone allowed
// by decision D1 approves it; approving a version retires the previously
// approved one. Approved content is identified by a SHA-256 of its definition,
// so any later change is visible. Nothing here raises alerts — content is
// stored, shown and approved; execution comes later and will read only
// approved versions.
// ============================================================================

import crypto from 'crypto';
import { query } from './db.js';
import { MONITORING_PROFILE_DRAFTS } from './monitoringProfileDrafts.js';

export const RULESET_KINDS = ['monitoring_profile'];
export const APPROVAL_STATES = ['draft', 'approved', 'retired'];

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS clinical_rulesets (
    id TEXT NOT NULL,
    version INTEGER NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    definition JSONB NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]',
    approval_status TEXT NOT NULL DEFAULT 'draft',
    change_note TEXT,
    content_hash TEXT NOT NULL,
    created_by INTEGER, created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    approved_by INTEGER, approved_by_name TEXT, approved_at TIMESTAMPTZ,
    PRIMARY KEY (id, version)
  )`);
  ensured = true;
}

export function contentHash(definition, sources) {
  return crypto.createHash('sha256').update(JSON.stringify({ definition, sources })).digest('hex');
}

/** Load the starting drafts the first time profiles are read. */
async function seedIfEmpty() {
  const r = await query(`SELECT 1 FROM clinical_rulesets WHERE kind = 'monitoring_profile' LIMIT 1`);
  if (r.rows.length) return;
  for (const d of MONITORING_PROFILE_DRAFTS) {
    await query(
      `INSERT INTO clinical_rulesets (id, version, kind, title, definition, sources, approval_status, change_note, content_hash, created_by_name)
       VALUES ($1, 1, 'monitoring_profile', $2, $3, $4, 'draft', $5, $6, 'System draft')
       ON CONFLICT (id, version) DO NOTHING`,
      [d.id, d.title, JSON.stringify(d.definition), JSON.stringify(d.sources),
       'Starting draft from published guidance and common practice — edit and approve before use.',
       contentHash(d.definition, d.sources)]
    );
  }
}

const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
const shape = (row) => row && ({ ...row, definition: parse(row.definition), sources: parse(row.sources) });

/**
 * Each profile's latest version, plus its approved version when that differs
 * (the approved one stays in force while a newer draft is being edited).
 */
export async function listProfiles() {
  await ensureTable();
  await seedIfEmpty();
  const latest = (await query(
    `SELECT DISTINCT ON (id) * FROM clinical_rulesets WHERE kind = 'monitoring_profile' ORDER BY id, version DESC`
  )).rows.map(shape);
  const approved = (await query(
    `SELECT id, version, approved_at, approved_by_name FROM clinical_rulesets
      WHERE kind = 'monitoring_profile' AND approval_status = 'approved'`
  )).rows;
  const approvedById = new Map(approved.map(a => [a.id, a]));
  return latest.map(p => ({ ...p, approved_version: approvedById.get(p.id) || null }));
}

export async function getProfileVersions(id) {
  await ensureTable();
  return (await query(
    `SELECT * FROM clinical_rulesets WHERE id = $1 ORDER BY version DESC`, [id]
  )).rows.map(shape);
}

/** Validate an edited profile. Returns { definition, sources } or { error }. */
export function normaliseProfile(body) {
  const d = body?.definition;
  if (!d || typeof d !== 'object') return { error: 'definition is required' };
  const text = (v, max = 2000) => String(v ?? '').slice(0, max);
  const list = (v) => (Array.isArray(v) ? v : []).map(x => text(x, 500)).filter(s => s.trim());
  const phases = (Array.isArray(d.phases) ? d.phases : []).slice(0, 8).map(p => ({
    label: text(p?.label, 60) || 'Phase',
    from_hours: Number.isFinite(Number(p?.from_hours)) ? Number(p.from_hours) : null,
    to_hours: p?.to_hours === null || p?.to_hours === '' || p?.to_hours === undefined ? null
      : (Number.isFinite(Number(p.to_hours)) ? Number(p.to_hours) : null),
  }));
  if (!phases.length) return { error: 'At least one time phase is required' };
  const parameters = (Array.isArray(d.parameters) ? d.parameters : []).slice(0, 40).map((p, i) => ({
    key: text(p?.key, 60) || `param_${i + 1}`,
    label: text(p?.label, 300),
    method: text(p?.method, 200),
    frequency: phases.map((_, j) => text(Array.isArray(p?.frequency) ? p.frequency[j] : '', 120)),
    notes: text(p?.notes, 500),
  })).filter(p => p.label.trim());
  if (!parameters.length) return { error: 'At least one monitored parameter is required' };
  const sources = (Array.isArray(body.sources) ? body.sources : []).slice(0, 20).map(s => ({
    citation: text(s?.citation, 500), note: text(s?.note, 500), verified: !!s?.verified,
  })).filter(s => s.citation.trim());
  return {
    title: text(body.title, 120).trim() || null,
    definition: {
      summary: text(d.summary, 1000),
      applies_to: text(d.applies_to, 300),
      phases, parameters,
      expected_progress: list(d.expected_progress),
      amber_triggers: list(d.amber_triggers),
      red_triggers: list(d.red_triggers),
      escalation: list(d.escalation),
    },
    sources,
  };
}

/** Save an edit as a new draft version. */
export async function saveProfileVersion(id, body, user) {
  await ensureTable();
  const n = normaliseProfile(body);
  if (n.error) return { error: n.error };
  const prev = (await query(`SELECT * FROM clinical_rulesets WHERE id = $1 ORDER BY version DESC LIMIT 1`, [id])).rows[0];
  if (!prev && !/^postop\.[a-z0-9_]{2,60}$/.test(id)) return { error: 'New profile ids look like postop.my_profile' };
  // Optimistic concurrency: the editor says which version it started from.
  if (prev && body.base_version !== undefined && Number(body.base_version) !== Number(prev.version)) {
    return { conflict: true, error: `This profile was changed by someone else (now version ${prev.version}). Reload and re-apply your edit.` };
  }
  const version = prev ? prev.version + 1 : 1;
  const title = n.title || prev?.title || id;
  await query(
    `INSERT INTO clinical_rulesets (id, version, kind, title, definition, sources, approval_status, change_note, content_hash, created_by, created_by_name)
     VALUES ($1, $2, 'monitoring_profile', $3, $4, $5, 'draft', $6, $7, $8, $9)`,
    [id, version, title, JSON.stringify(n.definition), JSON.stringify(n.sources),
     String(body.change_note || '').slice(0, 500) || null, contentHash(n.definition, n.sources),
     user?.id ?? null, user?.full_name || user?.name || null]
  );
  return { profile: shape((await query(`SELECT * FROM clinical_rulesets WHERE id = $1 AND version = $2`, [id, version])).rows[0]) };
}

/** Approve a version; the previously approved version of the profile is retired. */
export async function approveProfileVersion(id, version, user) {
  await ensureTable();
  const row = (await query(`SELECT * FROM clinical_rulesets WHERE id = $1 AND version = $2`, [id, version])).rows[0];
  if (!row) return { error: 'Version not found' };
  if (row.approval_status === 'approved') return { profile: shape(row) };
  const unverified = (parse(row.sources) || []).filter(s => !s.verified);
  await query(
    `UPDATE clinical_rulesets SET approval_status = 'retired' WHERE id = $1 AND approval_status = 'approved'`, [id]
  );
  await query(
    `UPDATE clinical_rulesets SET approval_status = 'approved', approved_by = $3, approved_by_name = $4, approved_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND version = $2`,
    [id, version, user?.id ?? null, user?.full_name || user?.name || null]
  );
  return {
    profile: shape((await query(`SELECT * FROM clinical_rulesets WHERE id = $1 AND version = $2`, [id, version])).rows[0]),
    unverified_sources: unverified.length,
  };
}

/** Withdraw approval (back to no approved version in force). */
export async function retireProfileVersion(id, version) {
  await ensureTable();
  await query(`UPDATE clinical_rulesets SET approval_status = 'retired' WHERE id = $1 AND version = $2`, [id, version]);
  return { ok: true };
}
