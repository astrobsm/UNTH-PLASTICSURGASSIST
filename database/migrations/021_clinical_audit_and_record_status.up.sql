-- 021: corrections instead of deletion, and server-written clinical audit.
-- Phase 0 (S5, S6) of docs/clinical/CLINICAL_IMPLEMENTATION_PLAN.md.
-- api/_lib/clinicalRecords.js applies the same statements on first use, so this
-- file is safe to run before or after a deployment.

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['ward_rounds', 'progress_notes', 'vital_signs', 'prescriptions'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS record_status VARCHAR(30) DEFAULT ''current''', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS entered_in_error_at TIMESTAMPTZ', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS entered_in_error_by INTEGER', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS entered_in_error_reason TEXT', t);
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP', t);
    END IF;
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS clinical_audit_events (
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
);
CREATE INDEX IF NOT EXISTS idx_clinical_audit_patient ON clinical_audit_events (patient_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_audit_entity ON clinical_audit_events (entity, entity_id);
