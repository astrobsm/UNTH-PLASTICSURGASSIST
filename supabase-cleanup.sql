-- =============================================
-- CLEAN UP DEMO DATA SCRIPT
-- Run this in Supabase SQL Editor to remove all demo/seed data
-- =============================================

-- CAUTION: This will DELETE ALL DATA in these tables
-- Only run this if you want to start fresh

-- First, disable foreign key checks temporarily by deleting in correct order

-- Delete dependent records first
DELETE FROM ward_rounds;
DELETE FROM wound_care_records;
DELETE FROM prescriptions;
DELETE FROM lab_orders;
DELETE FROM discharge_summaries;
DELETE FROM treatment_plan_modifications;
DELETE FROM treatment_plans;
DELETE FROM surgeries;
DELETE FROM admissions;
DELETE FROM cme_records;
DELETE FROM cbt_attempts;
DELETE FROM cbt_tests;
DELETE FROM duty_assignments;
DELETE FROM trainee_rotations;
DELETE FROM performance_snapshots;
DELETE FROM activity_logs;
DELETE FROM audit_log;
DELETE FROM sync_queue;
DELETE FROM push_subscriptions;

-- Finally delete patients (after all dependent records are gone)
DELETE FROM patients;

-- Keep users but remove demo users (keep only real admins)
-- Uncomment below if you want to remove demo users
-- DELETE FROM users WHERE email LIKE '%@example.com' OR email LIKE '%demo%';

-- Reset sequences (auto-increment counters)
-- This makes new IDs start from 1 again
ALTER SEQUENCE IF EXISTS patients_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS treatment_plans_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS surgeries_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS admissions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS prescriptions_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS lab_orders_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS wound_care_records_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS ward_rounds_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS discharge_summaries_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS cme_records_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS activity_logs_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS audit_log_id_seq RESTART WITH 1;

-- Verify cleanup
SELECT 'patients' as table_name, COUNT(*) as remaining_rows FROM patients
UNION ALL SELECT 'treatment_plans', COUNT(*) FROM treatment_plans
UNION ALL SELECT 'surgeries', COUNT(*) FROM surgeries
UNION ALL SELECT 'admissions', COUNT(*) FROM admissions
UNION ALL SELECT 'users', COUNT(*) FROM users;
