-- 023: structured clinical encounters (initial clerking, follow-up) and the
-- problem list / plan items fed by the clinician's accepted suggestions.
-- api/_lib/clinicalEncounters.js applies the same statements on first use.

CREATE TABLE IF NOT EXISTS clinical_encounters (
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
);
CREATE INDEX IF NOT EXISTS idx_clinical_encounters_patient ON clinical_encounters (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS clinical_problems (
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
);
CREATE INDEX IF NOT EXISTS idx_clinical_problems_patient ON clinical_problems (patient_id);

CREATE TABLE IF NOT EXISTS clinical_plan_items (
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
);
CREATE INDEX IF NOT EXISTS idx_clinical_plan_items_patient ON clinical_plan_items (patient_id);
