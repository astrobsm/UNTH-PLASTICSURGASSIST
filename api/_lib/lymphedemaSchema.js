// ============================================================================
// lymphedema_assessments: the columns the app writes.
//
// The table (init-db.js) was created with a handful of columns, so /sync/push
// (which keeps only real columns) dropped the aetiology, every limb
// measurement, the volumes, the clinical signs and the plan. The missing
// columns are added here before the column list is read, plus a sync_key
// with a unique index so a re-pushed assessment updates its row instead of
// inserting a duplicate. Idempotent; never throws.
// ============================================================================

import { query } from './db.js';

export const LYMPHEDEMA_TABLES = new Set(['lymphedema_assessments']);

const COLUMNS = {
  sync_key: 'VARCHAR(100)',
  etiology: 'VARCHAR(50)',
  onset_date: 'VARCHAR(30)',
  duration_months: 'INTEGER',
  prior_treatments: "JSONB DEFAULT '[]'",
  comorbidities: "JSONB DEFAULT '[]'",
  cancer_history: 'TEXT',
  radiation_history: 'BOOLEAN DEFAULT FALSE',
  lymph_node_dissection: 'BOOLEAN DEFAULT FALSE',
  recurrent_cellulitis_episodes: 'INTEGER DEFAULT 0',
  limb_measurements: "JSONB DEFAULT '[]'",
  volume_affected_ml: 'NUMERIC',
  volume_contralateral_ml: 'NUMERIC',
  volume_difference_pct: 'NUMERIC',
  volume_excess_ml: 'NUMERIC',
  volume_segments_used: 'INTEGER',
  isl_severity: 'VARCHAR(20)',
  skin_changes: "JSONB DEFAULT '[]'",
  stemmer_sign: 'BOOLEAN DEFAULT FALSE',
  pitting: 'VARCHAR(20)',
  fibrosis: 'VARCHAR(20)',
  papillomatosis: 'BOOLEAN DEFAULT FALSE',
  lymphorrhea: 'BOOLEAN DEFAULT FALSE',
  fungal_infection: 'BOOLEAN DEFAULT FALSE',
  wounds_present: 'BOOLEAN DEFAULT FALSE',
  lefs_score: 'NUMERIC',
  dash_score: 'NUMERIC',
  quality_of_life_score: 'NUMERIC',
  cdt_phase: 'VARCHAR(30)',
  current_timeline_phase: 'VARCHAR(40)',
  surgical_candidate: 'BOOLEAN DEFAULT FALSE',
  surgical_criteria_met: "JSONB DEFAULT '[]'",
  surgical_criteria_not_met: "JSONB DEFAULT '[]'",
  timeline_events: "JSONB DEFAULT '[]'",
  follow_up_records: "JSONB DEFAULT '[]'",
  tracking_entries: "JSONB DEFAULT '[]'",
  reminders: "JSONB DEFAULT '[]'",
  consent_filename: 'VARCHAR(255)',
  consent_uploaded_at: 'TIMESTAMP',
};

let done = false;
export async function ensureLymphedemaColumns() {
  if (done) return;
  const stmts = Object.entries(COLUMNS).map(([c, t]) => `ALTER TABLE lymphedema_assessments ADD COLUMN IF NOT EXISTS ${c} ${t}`);
  // The plan is an object; a TEXT column would hand it back as a string.
  stmts.push(`DO $$ BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'lymphedema_assessments' AND column_name = 'treatment_plan') = 'text' THEN
      ALTER TABLE lymphedema_assessments ALTER COLUMN treatment_plan TYPE JSONB
        USING CASE WHEN treatment_plan IS NULL THEN NULL
                   WHEN treatment_plan ~ '^\s*[{\[]' THEN treatment_plan::jsonb
                   ELSE to_jsonb(treatment_plan) END;
    END IF;
  END $$`);
  stmts.push(`CREATE UNIQUE INDEX IF NOT EXISTS ux_lymphedema_assessments_sync_key
    ON lymphedema_assessments (sync_key) WHERE sync_key IS NOT NULL`);
  for (const s of stmts) {
    try { await query(s); } catch (e) { console.warn('ensureLymphedemaColumns:', e.message); }
  }
  done = true;
}
