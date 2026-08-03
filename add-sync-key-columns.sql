-- Durable sync identity — sync_key.
--
-- The duplication that filled treatment_plans with 6,000 rows came from the
-- push path having no reliable way to recognise a record it had already seen.
-- It tried the primary key (skipped for SERIAL tables, because a client's local
-- id and a server SERIAL id are different number spaces) and then a per-table
-- date column (a hand-maintained map that any new table silently falls out of).
--
-- sync_key replaces both with one rule: the CLIENT generates a stable, unique
-- key when it first creates a record and sends the same key on every push
-- thereafter. The server upserts on it. A repeated push then updates rather
-- than inserts, no matter how many times it happens, and a table added to sync
-- later inherits the behaviour without anyone remembering to register it.
--
-- The unique index is PARTIAL — `WHERE sync_key IS NOT NULL`. Existing rows
-- have no key and must not collide with each other, so they keep working
-- untouched while new writes get the guarantee.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'treatment_plans', 'progress_notes', 'ward_rounds', 'prescriptions',
    'lab_orders', 'admissions', 'surgeries', 'wound_care_records',
    'discharge_summaries', 'vital_signs', 'patients'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS sync_key VARCHAR(120)', t);
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (sync_key) WHERE sync_key IS NOT NULL',
        'ux_' || t || '_sync_key', t
      );
    END IF;
  END LOOP;
END $$;
