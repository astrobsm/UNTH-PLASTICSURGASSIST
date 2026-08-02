-- Staff absence (leave / outside posting) — schema.
--
-- Mirrors the self-healing DDL in api/_lib/staffAbsence.js.
--
-- Two tables, and the second is the important one. `staff_absences` records the
-- intent; `absence_reassignments` is a LEDGER of every individual move made
-- when the absence started. Without that ledger, "give them their patients back
-- on return" is unanswerable — you would only know the current state, not who
-- held what before. It also makes the whole operation auditable and reversible
-- without a database restore.

CREATE TABLE IF NOT EXISTS staff_absences (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(200),
  user_role VARCHAR(60),
  absence_type VARCHAR(40) NOT NULL DEFAULT 'annual_leave',
    -- annual_leave | sick_leave | conference | outside_posting | study_leave | other
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    -- scheduled | active | completed | cancelled
  reason TEXT,
  notes TEXT,
  -- Counters filled in when the absence activates / completes, for the UI.
  patients_reassigned INTEGER NOT NULL DEFAULT 0,
  call_duties_reassigned INTEGER NOT NULL DEFAULT 0,
  clinic_duties_reassigned INTEGER NOT NULL DEFAULT 0,
  patients_restored INTEGER NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT staff_absences_dates CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_absence_user ON staff_absences(user_id);
CREATE INDEX IF NOT EXISTS idx_absence_status ON staff_absences(status);
CREATE INDEX IF NOT EXISTS idx_absence_window ON staff_absences(start_date, end_date);

-- One row per individual thing moved, so the return can put it back.
CREATE TABLE IF NOT EXISTS absence_reassignments (
  id SERIAL PRIMARY KEY,
  absence_id INTEGER NOT NULL,
  entity_type VARCHAR(30) NOT NULL,     -- patient_assignment | call_duty | clinic_duty
  entity_id VARCHAR(64) NOT NULL,
  role_column VARCHAR(40),              -- which slot on the row was changed
  from_user_id VARCHAR(64),
  to_user_id VARCHAR(64),
  restored BOOLEAN NOT NULL DEFAULT FALSE,
  restored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_absence_reassign_absence ON absence_reassignments(absence_id);
CREATE INDEX IF NOT EXISTS idx_absence_reassign_restored ON absence_reassignments(restored);
