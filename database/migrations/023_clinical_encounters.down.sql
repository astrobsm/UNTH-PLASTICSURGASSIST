-- 023 down. Non-destructive by design: encounters, problems and plan items
-- are clinical records. Rolling back the code is enough. Drop only after
-- exporting the tables and with the clinical lead's agreement:
--   DROP TABLE clinical_plan_items;
--   DROP TABLE clinical_problems;
--   DROP TABLE clinical_encounters;
SELECT 1;
