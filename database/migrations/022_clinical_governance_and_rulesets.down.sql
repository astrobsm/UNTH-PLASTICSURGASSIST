-- 022 down. Non-destructive by design: governance decisions and approved
-- protocol versions are clinical governance records. Rolling back the code is
-- enough. Drop only after exporting both tables and with the clinical lead's
-- agreement:
--   DROP TABLE clinical_rulesets;
--   DROP TABLE clinical_governance_settings;
SELECT 1;
