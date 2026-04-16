-- ⚠️ DEPRECATED: These columns are already in api/init-db.js (single source of truth).
-- Do NOT run on production. Kept for historical reference only.
--
-- Add diagnosis columns to patients table
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/your-project/sql/new)

-- Add primary_diagnosis column
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS primary_diagnosis TEXT;

-- Add secondary_diagnoses column (JSONB array)
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS secondary_diagnoses JSONB DEFAULT '[]';

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'patients' 
AND column_name IN ('primary_diagnosis', 'secondary_diagnoses');
