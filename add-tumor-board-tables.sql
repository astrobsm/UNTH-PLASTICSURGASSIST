-- Tumor Board module — schema.
--
-- Mirrors the self-healing DDL in api/tumor-board.js; run this to provision the
-- tables ahead of first use rather than relying on lazy creation.
--
-- Design note on versioning: `tumor_board_assessments` is APPEND-ONLY. A case
-- is typically staged clinically before histology, re-staged when the pathology
-- report lands, and re-staged again after neoadjuvant therapy. Overwriting a
-- row would destroy the record of what was known when a decision was taken,
-- which is exactly what a tumour board record exists to preserve. Each
-- assessment carries its own staging_system so a future AJCC edition can be
-- adopted per-case without invalidating historical staging.

CREATE TABLE IF NOT EXISTS tumor_board_cases (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  hospital_number VARCHAR(100),
  tumor_family VARCHAR(60) NOT NULL,          -- cutaneous_melanoma | cutaneous_scc | cutaneous_bcc | merkel_cell | soft_tissue_sarcoma
  diagnosis VARCHAR(300),
  primary_site VARCHAR(200),
  laterality VARCHAR(20),
  sarcoma_site VARCHAR(40),                   -- trunk_extremity | retroperitoneal | head_neck | viscera
  date_of_diagnosis DATE,
  date_first_presented DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'active',   -- active | in_treatment | surveillance | closed
  treatment_intent VARCHAR(30),               -- curative | palliative | diagnostic | undetermined
  performance_status VARCHAR(60),
  comorbidities TEXT,
  immunosuppressed BOOLEAN DEFAULT FALSE,
  high_risk_site BOOLEAN DEFAULT FALSE,
  recurrent_disease BOOLEAN DEFAULT FALSE,
  fit_for_radical_therapy BOOLEAN,
  braf_mutated BOOLEAN,
  histology_available BOOLEAN DEFAULT FALSE,
  histologic_type VARCHAR(300),
  current_stage_group VARCHAR(30),
  current_stage_formatted VARCHAR(160),
  assessment_count INTEGER NOT NULL DEFAULT 0,
  last_board_date DATE,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tb_cases_patient ON tumor_board_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_tb_cases_status ON tumor_board_cases(status);
CREATE INDEX IF NOT EXISTS idx_tb_cases_updated ON tumor_board_cases(updated_at);

-- Append-only staging timeline. NEVER UPDATE a row here; add a new version.
CREATE TABLE IF NOT EXISTS tumor_board_assessments (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  basis VARCHAR(30) NOT NULL,                 -- clinical | pathological | post_neoadjuvant | restaging
  staging_system VARCHAR(80) NOT NULL,
  assessed_by INTEGER,
  assessed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Raw inputs, kept so an assessment can be recomputed or audited later.
  inputs JSONB NOT NULL DEFAULT '{}',

  -- Derived staging result.
  t_category VARCHAR(20),
  n_category VARCHAR(20),
  m_category VARCHAR(20),
  stage_group VARCHAR(30),
  stage_formatted VARCHAR(160),
  stage_description TEXT,
  caveats JSONB DEFAULT '[]',

  -- Spread detail captured explicitly for reporting.
  local_spread TEXT,
  regional_spread TEXT,
  metastatic_spread TEXT,
  histologic_type VARCHAR(300),
  histologic_grade VARCHAR(20),
  margins VARCHAR(120),
  lymphovascular_invasion BOOLEAN,
  perineural_invasion BOOLEAN,
  molecular_findings TEXT,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tb_assessments_case ON tumor_board_assessments(case_id);
CREATE INDEX IF NOT EXISTS idx_tb_assessments_patient ON tumor_board_assessments(patient_id);
CREATE INDEX IF NOT EXISTS idx_tb_assessments_date ON tumor_board_assessments(assessed_at);

CREATE TABLE IF NOT EXISTS tumor_board_plans (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  assessment_id INTEGER,                      -- the staging version this plan was built from
  version INTEGER NOT NULL DEFAULT 1,
  intent VARCHAR(30),
  summary TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  specialties JSONB NOT NULL DEFAULT '[]',
  caveats JSONB DEFAULT '[]',
  board_date DATE,
  board_members TEXT,
  ratified BOOLEAN DEFAULT FALSE,
  ratified_by INTEGER,
  ratified_at TIMESTAMPTZ,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tb_plans_case ON tumor_board_plans(case_id);
CREATE INDEX IF NOT EXISTS idx_tb_plans_patient ON tumor_board_plans(patient_id);

CREATE TABLE IF NOT EXISTS tumor_board_referrals (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  plan_id INTEGER,
  specialty VARCHAR(60) NOT NULL,
  specialty_label VARCHAR(120),
  subject VARCHAR(300),
  body TEXT,
  urgency VARCHAR(20) DEFAULT 'routine',
  status VARCHAR(30) DEFAULT 'draft',         -- draft | sent | acknowledged | completed
  sent_at TIMESTAMPTZ,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tb_referrals_case ON tumor_board_referrals(case_id);
CREATE INDEX IF NOT EXISTS idx_tb_referrals_status ON tumor_board_referrals(status);

CREATE TABLE IF NOT EXISTS tumor_board_surveillance (
  id SERIAL PRIMARY KEY,
  case_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  category VARCHAR(60),
  title VARCHAR(300),
  detail TEXT,
  due_date DATE,
  due_month INTEGER,
  phase VARCHAR(40),
  basis VARCHAR(200),
  status VARCHAR(30) DEFAULT 'scheduled',     -- scheduled | completed | missed | cancelled
  completed_at TIMESTAMPTZ,
  completed_by INTEGER,
  findings TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tb_surv_case ON tumor_board_surveillance(case_id);
CREATE INDEX IF NOT EXISTS idx_tb_surv_due ON tumor_board_surveillance(due_date);
CREATE INDEX IF NOT EXISTS idx_tb_surv_status ON tumor_board_surveillance(status);
