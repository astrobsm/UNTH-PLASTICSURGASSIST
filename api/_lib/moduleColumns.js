// ============================================================================
// Columns the app writes that the original tables never had.
//
// /sync/push keeps only real columns, so every field missing here was dropped
// silently. Each registered table gains its columns (and a sync_key with a
// unique index, so a re-pushed record updates its row instead of duplicating
// it) before the sync reads the column list. Idempotent; never throws.
// ============================================================================

import { query } from './db.js';

const J = "JSONB DEFAULT '{}'";
const JA = "JSONB DEFAULT '[]'";

export const MODULE_COLUMNS = {
  procedures: {
    sync_key: 'VARCHAR(120)',
    booking_id: 'VARCHAR(120)',
    scheduled_date: 'DATE',
    scheduled_time: 'VARCHAR(20)',
    operating_room: 'VARCHAR(60)',
    ps_unit: 'VARCHAR(40)',
    estimated_duration: 'VARCHAR(40)',
    urgency: 'VARCHAR(30)',
    surgical_fitness: J,
    bleeding_risk: J,
    dvt_risk: J,
    comorbidities: JA,
    comorbidity_details: 'TEXT',
    interfering_medications: JA,
    preop_investigations: JA,
    created_by: 'VARCHAR(255)',
    intraoperative_findings: J,
    reschedule_history: J,
    cancellation_details: J,
    postoperative_plan: J,
    postoperative_note: J,
  },
};

const done = new Set();

export async function ensureModuleColumns(table) {
  const cols = MODULE_COLUMNS[table];
  if (!cols || done.has(table)) return;
  for (const [c, t] of Object.entries(cols)) {
    try { await query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${c} ${t}`); }
    catch (e) { console.warn(`ensureModuleColumns ${table}.${c}:`, e.message); }
  }
  if (cols.sync_key) {
    try {
      await query(`CREATE UNIQUE INDEX IF NOT EXISTS ux_${table}_sync_key ON ${table} (sync_key) WHERE sync_key IS NOT NULL`);
    } catch (e) { console.warn(`ensureModuleColumns ${table} index:`, e.message); }
  }
  done.add(table);
}
