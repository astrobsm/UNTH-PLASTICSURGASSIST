-- 021 down. Deliberately NON-destructive: rows marked entered-in-error are
-- clinical history and are kept, and the audit table is kept. Rolling back the
-- application code is enough — the old code ignores these columns. Drop them
-- only after exporting the audit table and confirming with the clinical lead:
--
--   ALTER TABLE ward_rounds    DROP COLUMN record_status, DROP COLUMN entered_in_error_at,
--                              DROP COLUMN entered_in_error_by, DROP COLUMN entered_in_error_reason;
--   (same for progress_notes, vital_signs, prescriptions)
--   DROP TABLE clinical_audit_events;
SELECT 1;
