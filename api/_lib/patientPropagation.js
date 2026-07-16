// ============================================================================
// Propagate a patient's canonical name + hospital number to every table that
// stores a denormalized copy, so an admin edit reflects everywhere the patient
// is referenced (admissions board, MDT, ward rounds, prescriptions, etc.).
//
// Tables are discovered from information_schema (any table that has BOTH a
// patient_id column and a patient_name/hospital_number column), so new tables
// are covered automatically. Best-effort per table — one failure never blocks
// the others. Table names come from the catalog, never user input.
// ============================================================================

import { query } from './db.js';

// Cache the discovered table lists per warm lambda (schema rarely changes).
let _nameTables = null;
let _hnTables = null;

async function discover() {
  if (_nameTables && _hnTables) return;
  _nameTables = (await query(
    `SELECT c.table_name
       FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'patient_name'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns c2
           WHERE c2.table_schema = 'public' AND c2.table_name = c.table_name AND c2.column_name = 'patient_id')`
  )).rows.map(r => r.table_name);
  _hnTables = (await query(
    `SELECT c.table_name
       FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.column_name = 'hospital_number'
        AND c.table_name <> 'patients'
        AND EXISTS (
          SELECT 1 FROM information_schema.columns c2
           WHERE c2.table_schema = 'public' AND c2.table_name = c.table_name AND c2.column_name = 'patient_id')`
  )).rows.map(r => r.table_name);
}

export async function propagatePatientDenormalized(patientId) {
  const p = (await query(
    `SELECT id, first_name, last_name, full_name, hospital_number FROM patients WHERE id = $1`,
    [patientId]
  )).rows[0];
  if (!p) return { updated: 0 };

  const fullName = (p.full_name || `${p.first_name || ''} ${p.last_name || ''}`).trim();
  const hn = p.hospital_number || null;
  const pidStr = String(patientId);

  await discover();
  let updated = 0;

  // patient_id column types vary (INTEGER vs VARCHAR) — compare as text.
  for (const t of _nameTables) {
    try {
      await query(`UPDATE ${t} SET patient_name = $1 WHERE patient_id::text = $2`, [fullName, pidStr]);
      updated++;
    } catch (e) { console.warn(`propagate patient_name -> ${t} skipped:`, e.message); }
  }
  if (hn) {
    for (const t of _hnTables) {
      try {
        await query(`UPDATE ${t} SET hospital_number = $1 WHERE patient_id::text = $2`, [hn, pidStr]);
      } catch (e) { console.warn(`propagate hospital_number -> ${t} skipped:`, e.message); }
    }
  }
  return { updated, name_tables: _nameTables.length, hn_tables: _hnTables.length };
}
