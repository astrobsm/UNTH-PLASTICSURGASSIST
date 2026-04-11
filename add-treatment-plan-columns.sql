-- Migration: Add missing JSONB columns to treatment_plans table
-- Required by: TreatmentPlanCreator, TreatmentPlanManager, API /api/treatment-plans
-- Run this on the production PostgreSQL database

-- Core JSONB arrays for treatment plan data
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS objectives JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS procedures JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS medications JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS investigations JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS follow_up_schedule JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS medical_team JSONB;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS discharge_plan JSONB;

-- New treatment planning fields (risk assessments, meal plans, discharge criteria)
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS risk_assessments JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS meal_plan JSONB;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS ward_round_schedule JSONB;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS discharge_criteria JSONB DEFAULT '[]';
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS treatment_type VARCHAR(100);
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS created_by VARCHAR(255);

-- Patient assignments table (team assignment tracking)
CREATE TABLE IF NOT EXISTS patient_assignments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  hospital_number VARCHAR(100),
  consultant_id INTEGER,
  senior_registrar_id INTEGER,
  registrar_id INTEGER,
  house_officer_id INTEGER,
  assigned_date TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  created_by VARCHAR(255),
  deleted BOOLEAN DEFAULT FALSE,
  synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_assignments_patient ON patient_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_assignments_active ON patient_assignments(is_active) WHERE is_active = TRUE;

-- Investigation uploads table (for OCR scanned documents)
CREATE TABLE IF NOT EXISTS investigation_uploads (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL,
  investigation_id INTEGER,
  treatment_plan_id INTEGER,
  document_type VARCHAR(100),
  file_url TEXT,
  ocr_text TEXT,
  extracted_fields JSONB,
  uploaded_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investigation_uploads_patient ON investigation_uploads(patient_id);
