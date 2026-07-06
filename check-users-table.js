#!/usr/bin/env node
/**
 * Check users table schema and data
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

async function checkUsersTable() {
  console.log('🔍 Checking users table schema and data...\n');

  try {
    const client = await pool.connect();
    
    // Get columns
    console.log('📋 USERS TABLE COLUMNS:');
    console.log('─'.repeat(50));
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    columns.rows.forEach(col => {
      console.log(`  ${col.column_name.padEnd(25)} ${col.data_type}`);
    });
    
    console.log('\n📊 ALL USERS:');
    console.log('─'.repeat(50));
    const users = await client.query(`SELECT * FROM users`);
    
    if (users.rows.length === 0) {
      console.log('  No users found in database!');
    } else {
      users.rows.forEach(user => {
        console.log(`  ID: ${user.id}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Full Name: ${user.full_name}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Is Approved: ${user.is_approved}`);
        console.log(`  Is Active: ${user.is_active}`);
        console.log(`  Has Password: ${!!user.password}`);
        console.log('  ---');
      });
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsersTable();
