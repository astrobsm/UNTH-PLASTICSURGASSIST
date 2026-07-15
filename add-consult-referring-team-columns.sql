-- ============================================================================
-- Addendum v2.1 — MDT Referral Source & Inviting Unit Enhancement
--
-- Adds the full referring clinical-team + referral-metadata columns to the
-- received_consults table, and a `referral` JSONB column to mdt_patient_teams
-- so referring-team details propagate to the MDT.
--
-- Safe to run repeatedly (ADD COLUMN IF NOT EXISTS). The serverless API also
-- self-applies these in api/consults-module.js ensureTables() and
-- api/init-db.js, so this file is primarily for manual/CI migrations.
-- ============================================================================

-- ── received_consults: referring team & referral metadata ──────────────────
-- (referring_unit, referring_consultant, referring_doctor_name,
--  referring_phone, ward, bed_number already exist and are reused.)
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_hospital                VARCHAR(200);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_department              VARCHAR(180);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_consultant_id           INTEGER;
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_consultant_phone        VARCHAR(60);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_senior_registrar_name   VARCHAR(180);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_senior_registrar_phone  VARCHAR(60);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_registrar_name          VARCHAR(180);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_registrar_phone         VARCHAR(60);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_house_officer_name      VARCHAR(180);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_house_officer_phone     VARCHAR(60);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_medical_officer_name    VARCHAR(180);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referring_medical_officer_phone   VARCHAR(60);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referral_priority                 VARCHAR(20);
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS reason_for_referral               TEXT;
ALTER TABLE received_consults ADD COLUMN IF NOT EXISTS referral_datetime                 TIMESTAMPTZ;

-- Backfill referral_priority from the existing urgency value for old rows.
UPDATE received_consults SET referral_priority = urgency WHERE referral_priority IS NULL;
UPDATE received_consults SET referral_datetime = created_at WHERE referral_datetime IS NULL;

CREATE INDEX IF NOT EXISTS idx_received_consults_department ON received_consults(referring_department);
CREATE INDEX IF NOT EXISTS idx_received_consults_ref_unit   ON received_consults(referring_unit);
CREATE INDEX IF NOT EXISTS idx_received_consults_priority   ON received_consults(referral_priority);

-- ── mdt_patient_teams: carry referring-team details into the MDT ────────────
ALTER TABLE mdt_patient_teams ADD COLUMN IF NOT EXISTS referral JSONB DEFAULT '{}'::jsonb;
