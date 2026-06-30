-- ============================================================================
-- Phase 1 — Appointment Module Redesign
-- Configurable consulting stations per day, patient categories, scheduling
-- engine support (doctor unavailability, holidays, waiting-time tracking).
--
-- Safe to run multiple times (idempotent). The API self-heals these tables on
-- cold start, but this file is the canonical migration for manual runs.
-- ============================================================================

-- 1. Single-row JSON clinic configuration (stations per weekday, slot length,
--    sessions, holidays). id is pinned to 1 so there is always one config row.
CREATE TABLE IF NOT EXISTS clinic_config (
  id          INTEGER PRIMARY KEY DEFAULT 1,
  config      JSONB NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_by  VARCHAR(180),
  CONSTRAINT clinic_config_single_row CHECK (id = 1)
);

-- 2. Patient categories with per-category duration, priority, and colour.
CREATE TABLE IF NOT EXISTS clinic_categories (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(80) UNIQUE NOT NULL,
  duration_minutes INTEGER DEFAULT 20,
  priority         INTEGER DEFAULT 3,            -- 1 = highest priority
  color            VARCHAR(20) DEFAULT '#0E9F6E',
  is_active        BOOLEAN DEFAULT TRUE,
  sort_order       INTEGER DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Doctor unavailability (leave / off days) used by the scheduling engine.
CREATE TABLE IF NOT EXISTS doctor_unavailability (
  id                SERIAL PRIMARY KEY,
  doctor_name       VARCHAR(120) NOT NULL,
  unavailable_date  DATE NOT NULL,
  reason            VARCHAR(200),
  created_by        VARCHAR(180),
  created_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(doctor_name, unavailable_date)
);
CREATE INDEX IF NOT EXISTS idx_doctor_unavail_date ON doctor_unavailability(unavailable_date);

-- 4. Extend clinic_appointments for stations, categories, priority, and the
--    waiting-time lifecycle timestamps.
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS station_number INTEGER;
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS category VARCHAR(80);
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 3;
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE clinic_appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clinic_appt_station ON clinic_appointments(appointment_date, station_number);
CREATE INDEX IF NOT EXISTS idx_clinic_appt_category ON clinic_appointments(category);

-- 5. Seed default patient categories (only if the table is empty).
INSERT INTO clinic_categories (name, duration_minutes, priority, color, sort_order)
SELECT * FROM (VALUES
  ('New Patient',              30, 2, '#2563EB', 1),
  ('Wound Care Follow-up',     20, 1, '#DC2626', 2),
  ('Non-Wound Consultation',   20, 3, '#0E9F6E', 3),
  ('Post-operative Follow-up', 20, 2, '#7C3AED', 4),
  ('Surgery Scheduling',       30, 1, '#EA580C', 5)
) AS v(name, duration_minutes, priority, color, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM clinic_categories);

-- 6. Seed default clinic configuration (only if no config row exists).
--    Tuesday (dow=2): 3 stations. Wednesday (dow=3): 1 station. Slots: 20 min.
INSERT INTO clinic_config (id, config)
SELECT 1, '{
  "slotMinutes": 20,
  "holidays": [],
  "days": {
    "2": { "enabled": true,  "stations": 3, "doctors": ["Dr. Nnadi", "Dr. Onyia", "Dr. Okwesili"], "sessions": [{"label": "Morning Session", "start": "09:00", "end": "13:30"}, {"label": "Afternoon Session", "start": "14:00", "end": "16:00"}] },
    "3": { "enabled": true,  "stations": 1, "doctors": ["Dr. Eze"], "sessions": [{"label": "Clinic Session", "start": "10:00", "end": "16:00"}] },
    "0": { "enabled": false, "stations": 0, "doctors": [], "sessions": [] },
    "1": { "enabled": false, "stations": 0, "doctors": [], "sessions": [] },
    "4": { "enabled": false, "stations": 0, "doctors": [], "sessions": [] },
    "5": { "enabled": false, "stations": 0, "doctors": [], "sessions": [] },
    "6": { "enabled": false, "stations": 0, "doctors": [], "sessions": [] }
  }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM clinic_config WHERE id = 1);
