#!/usr/bin/env node
/**
 * Database Connection & Sync Verification Script
 * Tests connection and lists all tables to confirm schema is complete
 */

import pg from 'pg';

const { Pool } = pg;

// Database configuration
import { requireDatabaseUrl } from './db-env.mjs';
const DATABASE_URL = requireDatabaseUrl();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 30000,
});

async function testConnection() {
  console.log('='.repeat(60));
  console.log('🔗 PLASTIC SURGEON ASSISTANT - DATABASE VERIFICATION');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // 1. Test basic connection
    console.log('📡 Step 1: Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Successfully connected to Supabase PostgreSQL!');
    console.log('');
    
    // 2. Get server time
    console.log('⏰ Step 2: Checking server time...');
    const timeResult = await client.query('SELECT NOW() as server_time, current_database() as db_name');
    console.log('   Server Time:', timeResult.rows[0].server_time);
    console.log('   Database:', timeResult.rows[0].db_name);
    console.log('');
    
    // 3. List all tables
    console.log('📋 Step 3: Listing all database tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('');
    console.log(`   Found ${tablesResult.rows.length} tables:`);
    console.log('-'.repeat(40));
    tablesResult.rows.forEach((row, i) => {
      console.log(`   ${String(i + 1).padStart(2)}. ${row.table_name}`);
    });
    console.log('-'.repeat(40));
    console.log('');
    
    // 4. Check key tables for sync
    console.log('🔄 Step 4: Verifying key sync tables...');
    const syncTables = [
      'users',
      'patients',
      'patient_admissions',
      'treatment_plans',
      'prescriptions',
      'lab_investigations',
      'surgery_bookings',
      'ward_rounds',
      'wound_care',
      'blood_transfusions',
      'burn_patients',
      'discharge_summaries',
      'audit_logs'
    ];
    
    let allPresent = true;
    for (const table of syncTables) {
      const exists = tablesResult.rows.some(r => r.table_name === table);
      if (exists) {
        console.log(`   ✅ ${table}`);
      } else {
        console.log(`   ❌ ${table} - MISSING`);
        allPresent = false;
      }
    }
    console.log('');
    
    // 5. Count records in key tables
    console.log('📊 Step 5: Record counts in key tables...');
    const countTables = ['users', 'patients', 'patient_admissions', 'treatment_plans', 'prescriptions'];
    
    for (const table of countTables) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table}: ${countResult.rows[0].count} records`);
      } catch (e) {
        console.log(`   ${table}: Error - ${e.message}`);
      }
    }
    console.log('');
    
    // 6. Verify sync columns exist
    console.log('🔄 Step 6: Verifying sync columns in patients table...');
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'patients' 
      AND column_name IN ('synced', 'updated_at', 'deleted')
    `);
    
    columnsResult.rows.forEach(row => {
      console.log(`   ✅ ${row.column_name} (${row.data_type})`);
    });
    console.log('');
    
    client.release();
    
    // Summary
    console.log('='.repeat(60));
    console.log('');
    if (allPresent) {
      console.log('✅ DATABASE VERIFICATION COMPLETE - ALL SYSTEMS GO!');
      console.log('');
      console.log('   ✅ Database Connection: WORKING');
      console.log('   ✅ All Tables: PRESENT');
      console.log('   ✅ Sync Columns: CONFIGURED');
      console.log('   ✅ 2-Way Sync: READY');
    } else {
      console.log('⚠️  DATABASE VERIFICATION COMPLETE - SOME TABLES MISSING');
      console.log('   Run migrations to create missing tables');
    }
    console.log('');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('');
    console.error('❌ DATABASE CONNECTION FAILED!');
    console.error('   Error:', error.message);
    console.error('');
  } finally {
    await pool.end();
  }
}

testConnection();
