-- Clinician Assistant — saved diagnostic analyses.
--
-- Mirrors the self-healing DDL in api/clinician-assistant.js.
--
-- An analysis is a SNAPSHOT, not a live view. The interpretation depends on the
-- values as they stood, the reference intervals in force, and the engine
-- version that produced it — so the inputs are stored alongside the output.
-- Re-deriving an old impression from today's data would silently rewrite what
-- the clinician actually saw when they made a decision.

CREATE TABLE IF NOT EXISTS clinician_analyses (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER,
  hospital_number VARCHAR(100),

  -- Where the values came from: 'record' (pulled from Postgres), 'scan' (OCR),
  -- or 'manual' (typed in). Mixed sources are recorded as 'mixed'.
  source VARCHAR(20) NOT NULL DEFAULT 'record',

  -- The engine's own output.
  overall_severity VARCHAR(30),
  impression JSONB DEFAULT '[]',
  next_steps JSONB DEFAULT '[]',
  modules JSONB DEFAULT '[]',
  correlations JSONB DEFAULT '[]',

  -- The inputs, kept so the analysis can be re-read exactly as generated.
  patient_context JSONB DEFAULT '{}',
  extraction JSONB DEFAULT '{}',
  -- Results the engine could not map — surfaced, never discarded.
  unmapped JSONB DEFAULT '[]',

  -- Provenance. Without the engine version, an impression cannot be
  -- interpreted after the rules change.
  engine_version VARCHAR(40),
  analysed_by INTEGER,
  analysed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  sync_key VARCHAR(120),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clin_analyses_patient ON clinician_analyses(patient_id);
CREATE INDEX IF NOT EXISTS idx_clin_analyses_date ON clinician_analyses(analysed_at);
CREATE INDEX IF NOT EXISTS idx_clin_analyses_severity ON clinician_analyses(overall_severity);
CREATE UNIQUE INDEX IF NOT EXISTS ux_clinician_analyses_sync_key
  ON clinician_analyses(sync_key) WHERE sync_key IS NOT NULL;
