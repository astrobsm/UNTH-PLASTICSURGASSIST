#!/usr/bin/env node
/**
 * Compare IndexedDB tables (frontend) with PostgreSQL tables (backend)
 */

import pg from 'pg';

const { Pool } = pg;

import { requireDatabaseUrl } from './db-env.mjs';
const DATABASE_URL = requireDatabaseUrl();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

// IndexedDB tables from database.ts
const indexedDBTables = [
  'patients',
  'treatment_plans',
  'plan_steps',
  'sync_queue',
  'cmeTopics',
  'testSessions',
  'cmeProgress',
  'cmeCertificates',
  'ward_rounds',
  'clinic_sessions',
  'surgery_bookings',
  'lab_investigations',
  'lab_results',
  'gfr_calculations',
  'dvt_assessments',
  'pressure_sore_assessments',
  'nutritional_assessments',
  'clinical_topics',
  'generated_mcqs',
  'mcq_test_schedules',
  'mcq_test_sessions',
  'study_materials',
  'notification_schedules',
  'educational_topics',
  'weekly_contents',
  'topic_schedules',
  'user_progress',
  'users',
  'pending_users',
  'approved_users',
  'patient_summaries',
  'paperwork_documents',
  'mdt_patient_teams',
  'mdt_meetings',
  'mdt_contact_logs',
  'admissions',
  'discharges',
  'cme_articles',
  'cme_reading_progress',
  'preoperative_assessments',
  'blood_transfusions',
  'transfusion_vitals',
  'transfusion_complications',
  'ward_rounds_clinical',
  'user_activities',
  'prescriptions',
  'wound_care',
  'diabetic_foot_assessments',
  'burn_patients',
  'cbt_tests',
  'cbt_attempts',
  'cbt_progress',
  'performance_metrics',
  'activity_logs',
  'duty_assignments',
  'rotation_records',
  'chat_messages',
  'chat_rooms',
  'video_conferences',
  'who_safety_checklists',
  'procedures',
  'system_settings',
  'system_logs',
  'backup_records',
  'patient_assignments',
  'pushSubscriptions',
  'audit_logs'
];

async function compareSchemas() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  SCHEMA COMPARISON: IndexedDB (Frontend) ↔ PostgreSQL (Cloud) ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    const client = await pool.connect();
    
    // Get all PostgreSQL tables
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const pgTables = result.rows.map(r => r.table_name);
    
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ SYNC-CRITICAL TABLES (must exist in both)                       │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    // Tables that MUST sync
    const criticalSyncTables = [
      'patients', 'treatment_plans', 'prescriptions', 'lab_investigations',
      'surgery_bookings', 'ward_rounds', 'admissions', 'discharge_summaries',
      'blood_transfusions', 'burn_patients', 'preoperative_assessments',
      'wound_care', 'users', 'audit_logs', 'mdt_meetings'
    ];
    
    let allCriticalPresent = true;
    for (const table of criticalSyncTables) {
      // Check PostgreSQL (some tables have different names)
      const pgName = table === 'discharges' ? 'discharge_summaries' : 
                     table === 'wound_care' ? 'wound_care' : table;
      const inPG = pgTables.includes(pgName) || pgTables.includes(table);
      const inIndexedDB = indexedDBTables.includes(table);
      
      let status = '';
      if (inPG && inIndexedDB) {
        status = '✅ Both';
      } else if (inPG && !inIndexedDB) {
        status = '☁️  Cloud Only';
      } else if (!inPG && inIndexedDB) {
        status = '📱 Local Only';
        allCriticalPresent = false;
      } else {
        status = '❌ Missing';
        allCriticalPresent = false;
      }
      
      console.log(`│ ${status.padEnd(14)} ${table.padEnd(45)}│`);
    }
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ CLOUD DATABASE SUMMARY                                          │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    console.log(`│ Total PostgreSQL tables: ${String(pgTables.length).padEnd(38)}│`);
    console.log(`│ Total IndexedDB tables:  ${String(indexedDBTables.length).padEnd(38)}│`);
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // Summary
    if (allCriticalPresent) {
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ ALL CRITICAL SYNC TABLES PRESENT IN CLOUD DATABASE        ║');
      console.log('║  ✅ 2-WAY SYNC READY: Frontend ↔ Backend                      ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
    } else {
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║  ⚠️  SOME CRITICAL TABLES MISSING - RUN MIGRATIONS            ║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
    }
    console.log('');
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

compareSchemas();
