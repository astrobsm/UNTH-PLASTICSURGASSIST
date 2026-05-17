-- ============================================================================
-- Migration: Blood Glucose Monitoring
-- Adds the blood_glucose table for serial capillary FBG / RBG readings.
-- Idempotent: safe to run multiple times.
-- ----------------------------------------------------------------------------
-- Frontend:  src/components/BloodGlucoseTab.tsx
-- Backend:   api/blood-glucose.js
-- Wired in:  src/pages/PatientProfile.tsx  (tab id: 'blood-glucose')
-- Also baked into: api/init-db.js (so fresh deploys auto-create the table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS blood_glucose (
    id              SERIAL PRIMARY KEY,
    patient_id      INTEGER NOT NULL,
    hospital_number VARCHAR(50),
    reading_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    reading_time    TIME NOT NULL DEFAULT CURRENT_TIME,
    fbg_mmol        DECIMAL(5,2),  -- Fasting blood glucose (mmol/L)
    rbg_mmol        DECIMAL(5,2),  -- Random  blood glucose (mmol/L)
    unit            VARCHAR(10) DEFAULT 'mmol/L',
    notes           TEXT,
    recorded_by     VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT blood_glucose_at_least_one_reading
        CHECK (fbg_mmol IS NOT NULL OR rbg_mmol IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_blood_glucose_patient
    ON blood_glucose(patient_id);

CREATE INDEX IF NOT EXISTS idx_blood_glucose_patient_date
    ON blood_glucose(patient_id, reading_date DESC, reading_time DESC);

-- Verify
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'blood_glucose'
--  ORDER BY ordinal_position;
