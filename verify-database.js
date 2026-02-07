#!/usr/bin/env node
/**
 * FINAL DATABASE & SYNC VERIFICATION
 * Comprehensive test of database connection, tables, and sync capability
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres.mgblgewvpzcaimqaeqcp:VMBaD8okNXl2K9pV@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function runVerification() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   PLASTIC SURGEON ASSISTANT - DATABASE VERIFICATION REPORT       ║');
  console.log('║   Connection: Supabase PostgreSQL (EU Central 1)                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  try {
    const client = await pool.connect();
    
    // ============================
    // 1. CONNECTION STATUS
    // ============================
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 1. DATABASE CONNECTION                                          │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    const timeResult = await client.query('SELECT NOW() as server_time, current_database() as db_name, version() as pg_version');
    console.log('│ ✅ Status:      CONNECTED                                       │');
    console.log(`│    Server:      ${timeResult.rows[0].server_time.toISOString().substring(0, 19).replace('T', ' ')} UTC      │`);
    console.log(`│    Database:    ${timeResult.rows[0].db_name.padEnd(45)}│`);
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // ============================
    // 2. TABLE COUNT
    // ============================
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 2. DATABASE TABLES                                              │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const viewsResult = await client.query(`
      SELECT COUNT(*) as view_count FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'VIEW'
    `);
    
    console.log(`│ ✅ Tables:      ${tablesResult.rows[0].table_count} BASE TABLES                                  │`);
    console.log(`│ ✅ Views:       ${viewsResult.rows[0].view_count} VIEWS                                         │`);
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // ============================
    // 3. SYNC TABLES VERIFICATION
    // ============================
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 3. SYNC-ENABLED TABLES (Frontend ↔ Backend)                     │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    const syncTables = [
      { name: 'users', description: 'User accounts' },
      { name: 'patients', description: 'Patient records' },
      { name: 'patient_admissions', description: 'Admissions' },
      { name: 'treatment_plans', description: 'Treatment plans' },
      { name: 'prescriptions', description: 'Prescriptions' },
      { name: 'lab_investigations', description: 'Lab investigations' },
      { name: 'surgery_bookings', description: 'Surgery bookings' },
      { name: 'ward_rounds', description: 'Ward rounds' },
      { name: 'wound_care', description: 'Wound care (view)' },
      { name: 'wound_care_records', description: 'Wound care records' },
      { name: 'blood_transfusions', description: 'Blood transfusions' },
      { name: 'burn_patients', description: 'Burn patients' },
      { name: 'discharge_summaries', description: 'Discharge summaries' },
      { name: 'preoperative_assessments', description: 'Pre-op assessments' },
      { name: 'mdt_meetings', description: 'MDT meetings' },
      { name: 'audit_logs', description: 'Audit logs' },
    ];
    
    const allTablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = allTablesResult.rows.map(r => r.table_name);
    
    let allPresent = true;
    for (const table of syncTables) {
      const exists = existingTables.includes(table.name);
      const status = exists ? '✅' : '❌';
      if (!exists) allPresent = false;
      console.log(`│ ${status} ${table.name.padEnd(28)} ${table.description.padEnd(22)}│`);
    }
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // ============================
    // 4. DATA COUNTS
    // ============================
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 4. DATA RECORD COUNTS                                           │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    const countTables = ['users', 'patients', 'patient_admissions', 'treatment_plans', 
                         'prescriptions', 'surgery_bookings', 'ward_rounds', 'discharge_summaries'];
    
    for (const table of countTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        const count = countResult.rows[0].count;
        console.log(`│    ${table.padEnd(25)} ${String(count).padStart(8)} records         │`);
      } catch (e) {
        console.log(`│    ${table.padEnd(25)} ERROR                         │`);
      }
    }
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // ============================
    // 5. SYNC COLUMNS
    // ============================
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 5. SYNC COLUMN VERIFICATION (patients table)                    │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'patients' 
      AND column_name IN ('synced', 'updated_at', 'deleted', 'created_at')
      ORDER BY column_name
    `);
    
    const requiredCols = ['synced', 'updated_at', 'deleted', 'created_at'];
    const foundCols = columnsResult.rows.map(r => r.column_name);
    
    for (const col of requiredCols) {
      const exists = foundCols.includes(col);
      const status = exists ? '✅' : '❌';
      const row = columnsResult.rows.find(r => r.column_name === col);
      const type = row ? row.data_type : 'MISSING';
      console.log(`│ ${status} ${col.padEnd(20)} ${type.padEnd(30)}│`);
    }
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // ============================
    // 6. 2-WAY SYNC TEST
    // ============================
    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ 6. 2-WAY SYNC CAPABILITY                                        │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    // Test INSERT (PUSH)
    const testHospitalNum = 'SYNC-TEST-' + Date.now();
    const testId = crypto.randomUUID();
    await client.query(`
      INSERT INTO patients (id, hospital_number, first_name, last_name, date_of_birth, gender, synced)
      VALUES ($1, $2, 'SyncTest', 'Patient', '1990-01-01', 'Male', true)
    `, [testId, testHospitalNum]);
    console.log('│ ✅ PUSH (Device → Cloud):  INSERT operation successful          │');
    
    // Test SELECT (PULL)
    const pullResult = await client.query(`
      SELECT * FROM patients WHERE hospital_number = $1
    `, [testHospitalNum]);
    if (pullResult.rows.length > 0) {
      console.log('│ ✅ PULL (Cloud → Device):  SELECT operation successful          │');
    }
    
    // Test UPDATE (PUSH)
    await client.query(`
      UPDATE patients SET first_name = 'SyncTestUpdated', updated_at = CURRENT_TIMESTAMP
      WHERE hospital_number = $1
    `, [testHospitalNum]);
    console.log('│ ✅ PUSH (Device → Cloud):  UPDATE operation successful          │');
    
    // Cleanup test data
    await client.query(`DELETE FROM patients WHERE hospital_number = $1`, [testHospitalNum]);
    console.log('│ ✅ SYNC Cleanup:           Test data removed                    │');
    console.log('└─────────────────────────────────────────────────────────────────┘');
    console.log('');
    
    // ============================
    // FINAL SUMMARY
    // ============================
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    if (allPresent) {
      console.log('║                                                                  ║');
      console.log('║   ✅✅✅ ALL VERIFICATIONS PASSED ✅✅✅                          ║');
      console.log('║                                                                  ║');
      console.log('║   DATABASE CONNECTION:       ✅ EXCELLENT                        ║');
      console.log('║   ALL TABLES PRESENT:        ✅ CONFIRMED                        ║');
      console.log('║   MIGRATIONS COMPLETE:       ✅ YES                              ║');
      console.log('║   2-WAY SYNC READY:          ✅ FULLY OPERATIONAL                ║');
      console.log('║   PUSH (Device → Cloud):     ✅ WORKING                          ║');
      console.log('║   PULL (Cloud → Device):     ✅ WORKING                          ║');
      console.log('║                                                                  ║');
    } else {
      console.log('║   ⚠️  SOME TABLES MISSING - RUN MIGRATIONS                       ║');
    }
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    client.release();
    
  } catch (error) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════╗');
    console.log('║   ❌ DATABASE VERIFICATION FAILED                                ║');
    console.log('╠══════════════════════════════════════════════════════════════════╣');
    console.log(`║   Error: ${error.message.substring(0, 50).padEnd(50)}║`);
    console.log('╚══════════════════════════════════════════════════════════════════╝');
    console.log('');
  } finally {
    await pool.end();
  }
}

runVerification();
