-- ============================================================================
-- 015 — Tests taken against the imported question bank.
--
-- The bank holds 8,963 questions scoped by rotation category, and until now
-- nothing could be sat against it: cbt_tests holds fixed, hand-authored papers
-- keyed to (level, test_number), and an attempt row there requires a paper to
-- point at. A test drawn at random from a level's pool has no paper, so it had
-- nowhere to be recorded and the whole bank was unassessable.
--
-- Keyed on (learner_kind, learner_id) like learner_article_progress, for the
-- same reason: doctors on rotation are ('user', id) and clinical students are
-- ('student', id), and both sit the same kind of test against different
-- curricula. One table means one place for the scorer to read from.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS learner_test_attempts (
  -- gen_random_uuid() rather than uuid_generate_v4(): the latter lives in the
  -- extensions schema, so it resolves only when search_path happens to include
  -- it. This one is in pg_catalog and always does.
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_kind     VARCHAR(10) NOT NULL CHECK (learner_kind IN ('user', 'student')),
  learner_id       INTEGER NOT NULL,
  -- The curriculum level the questions were drawn from, recorded as text
  -- because it spans two enums: a student's posting and a doctor's grade.
  level            VARCHAR(40),
  question_count   INTEGER NOT NULL CHECK (question_count > 0),
  correct_count    INTEGER NOT NULL CHECK (correct_count >= 0),
  score            NUMERIC(5,2) NOT NULL,
  passed           BOOLEAN NOT NULL DEFAULT FALSE,
  duration_seconds INTEGER,
  started_at       TIMESTAMPTZ,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The answers themselves, so a candidate can review what they got wrong and a
-- supervisor can see the same thing. Also what makes per-question statistics
-- possible later — questions.times_used and times_correct are maintained from
-- these on submission.
CREATE TABLE IF NOT EXISTS learner_test_answers (
  attempt_id      UUID NOT NULL REFERENCES learner_test_attempts(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id),
  selected_option CHAR(1),
  is_correct      BOOLEAN NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_lta_learner
  ON learner_test_attempts (learner_kind, learner_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_lta_level
  ON learner_test_attempts (level, submitted_at DESC);

COMMIT;
