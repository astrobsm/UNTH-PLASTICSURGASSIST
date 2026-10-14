// ============================================================================
// Clinical records are corrected, never erased.
//
// Ward rounds, progress notes, vital signs and prescriptions used to be removed
// with DELETE: the entry, who wrote it and what it said were gone, with no trace
// that it had ever existed. A record that was wrong is now marked
// "entered in error" — kept, with who marked it, when and why — and left out of
// every list the clinical screens read.
//
// Every create, edit and correction is also written to clinical_audit_events by
// the server, attributed to the signed-in user from the verified session (never
// to a name the client sends).
//
// Schema: database/migrations/021_clinical_audit_and_record_status.up.sql. The
// ensure* helpers below apply the same statements on first use, so a deployment
// that has not run the migration yet keeps working.
// ============================================================================

import { query } from './db.js';

export const CORRECTABLE_TABLES = Object.freeze(['ward_rounds', 'progress_notes', 'vital_signs', 'prescriptions']);

/** SQL condition: the row is not marked entered-in-error. */
export function notInError(alias = '') {
  const a = alias ? `${alias}.` : '';
  return `COALESCE(${a}record_status, 'current') <> 'entered_in_error'`;
}

const ensured = new Set();
export async function ensureRecordStatus(table) {
  if (!CORRECTABLE_TABLES.includes(table)) throw new Error(`Not a correctable table: ${table}`);
  if (ensured.has(table)) return;
  for (const s of [
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS record_status VARCHAR(30) DEFAULT 'current'`,
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS entered_in_error_at TIMESTAMPTZ`,
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS entered_in_error_by INTEGER`,
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS entered_in_error_reason TEXT`,
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP`,
  ]) {
    try { await query(s); } catch (e) { console.warn(`ensureRecordStatus(${table}):`, e.message); }
  }
  ensured.add(table);
}

/**
 * Mark a record entered-in-error. Returns the row's { id, patient_id }, or null
 * if there is no such current record.
 */
export async function markEnteredInError(table, id, user, reason) {
  await ensureRecordStatus(table);
  const r = await query(
    `UPDATE ${table}
        SET record_status = 'entered_in_error', entered_in_error_at = CURRENT_TIMESTAMP,
            entered_in_error_by = $2, entered_in_error_reason = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id::text = $1 AND ${notInError()}
      RETURNING id, patient_id`,
    [String(id), user?.id ?? null, (reason && String(reason).trim()) || 'No reason given']
  );
  const row = r.rows[0] || null;
  if (row) {
    await auditClinical(user, {
      action: 'mark_entered_in_error', entity: table, entityId: row.id, patientId: row.patient_id,
      detail: { reason: (reason && String(reason).trim()) || null },
    });
  }
  return row;
}

/** The correction reason from a DELETE request (body or ?reason=). */
export function reasonFrom(req) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const fromQuery = (() => {
    try { return new URL(req.url, 'http://x').searchParams.get('reason'); } catch { return null; }
  })();
  return (body && body.reason) || fromQuery || null;
}

let auditEnsured = false;
async function ensureAuditTable() {
  if (auditEnsured) return;
  await query(`CREATE TABLE IF NOT EXISTS clinical_audit_events (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id INTEGER,
    actor_name TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    patient_id TEXT,
    detail JSONB
  )`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinical_audit_patient ON clinical_audit_events (patient_id, occurred_at DESC)`);
  await query(`CREATE INDEX IF NOT EXISTS idx_clinical_audit_entity ON clinical_audit_events (entity, entity_id)`);
  auditEnsured = true;
}

/**
 * Record a clinical change, attributed to the verified session user. Never
 * throws: the clinical write has already happened, and losing the audit row is
 * logged rather than failing the clinician's save.
 */
export async function auditClinical(user, { action, entity, entityId = null, patientId = null, detail = null }) {
  try {
    await ensureAuditTable();
    await query(
      `INSERT INTO clinical_audit_events (actor_id, actor_name, actor_role, action, entity, entity_id, patient_id, detail)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user?.id ?? null,
        user?.full_name || user?.name || user?.username || null,
        user?.role || null,
        action, entity,
        entityId == null ? null : String(entityId),
        patientId == null ? null : String(patientId),
        detail ? JSON.stringify(detail) : null,
      ]
    );
  } catch (e) {
    console.error('auditClinical failed:', action, entity, entityId, e.message);
  }
}
