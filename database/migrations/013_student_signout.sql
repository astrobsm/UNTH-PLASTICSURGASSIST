-- ============================================================================
-- 013: signing a student out of their posting
--
-- Deactivating a student and signing one out are different facts. Deactivation
-- says the account is closed — it is also what happens to someone who left, was
-- removed, or registered by mistake. Signing out says the posting was completed
-- and records what they achieved, on what date, decided by whom.
--
-- Keeping them apart matters at the end of a posting, when a student asks for
-- evidence they completed it: `is_active = false` cannot answer that question
-- and these columns can.
--
-- Safe to re-run.
-- ============================================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS signed_out_at    TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS signed_out_by    INTEGER REFERENCES users(id);
-- The score at the moment of sign-out, kept because the underlying activity
-- keeps accruing and a figure recomputed next term would not be the one the
-- decision was made on.
ALTER TABLE students ADD COLUMN IF NOT EXISTS sign_out_score   NUMERIC(5,2);
ALTER TABLE students ADD COLUMN IF NOT EXISTS sign_out_notes   TEXT;
-- 'completed' when the requirements were met, 'override' when an administrator
-- signed them out regardless. Never collapsed into one: a posting passed and a
-- posting waved through are not the same record.
ALTER TABLE students ADD COLUMN IF NOT EXISTS sign_out_outcome VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_students_signed_out ON students(signed_out_at) WHERE signed_out_at IS NOT NULL;
