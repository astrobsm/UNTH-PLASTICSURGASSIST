-- ============================================================================
-- 014: which surgery posting a student is on
--
-- The CME articles, self-assessments and CBT questions imported from CHAMBER
-- are all scoped to a rotation category — Surgery 1 through Surgery 4 — and
-- level_curriculum already says which categories a level should cover. What was
-- missing is the other half of that join: nothing recorded which level a
-- student is actually on, so nothing could decide what to show them.
--
-- Deliberately nullable. A student who has not said yet is a real state, and
-- the app asks them rather than guessing: a guess would quietly hand a Surgery 1
-- student the Surgery 4 curriculum, and they would have no way of knowing.
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS surgery_level VARCHAR(20);
-- When they last confirmed it. A posting changes; being asked again at the
-- start of a new one is the point, not an annoyance to be suppressed forever.
ALTER TABLE students ADD COLUMN IF NOT EXISTS surgery_level_set_at TIMESTAMPTZ;

ALTER TABLE students
  DROP CONSTRAINT IF EXISTS students_surgery_level_check;
ALTER TABLE students
  ADD CONSTRAINT students_surgery_level_check
  CHECK (surgery_level IS NULL OR surgery_level IN ('surgery_1','surgery_2','surgery_3','surgery_4'));

CREATE INDEX IF NOT EXISTS idx_students_surgery_level ON students(surgery_level)
  WHERE surgery_level IS NOT NULL;

-- The rotation a student is placed on when their profile is approved. Mirrors
-- trainee_rotations, which serves the doctors, rather than overloading it: a
-- student's posting and a registrar's rotation have different requirements and
-- different sign-out rules, and one table pretending to hold both is how those
-- rules end up applied to the wrong person.
CREATE TABLE IF NOT EXISTS student_rotations (
  id            SERIAL PRIMARY KEY,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  surgery_level VARCHAR(20) NOT NULL,
  category_id   UUID REFERENCES rotation_categories(id),
  group_number  INTEGER,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  -- One open posting at a time; a student on two at once has no single
  -- curriculum and no answerable sign-out.
  CONSTRAINT student_rotations_one_open UNIQUE (student_id, status, surgery_level)
);

CREATE INDEX IF NOT EXISTS idx_student_rotations_student ON student_rotations(student_id, status);
