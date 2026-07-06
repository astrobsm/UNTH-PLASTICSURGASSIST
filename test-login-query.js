#!/usr/bin/env node
/**
 * Test the exact login query
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

import { requireDatabaseUrl } from './db-env.mjs';
const DATABASE_URL = requireDatabaseUrl();

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function testLogin() {
  console.log('🔍 Testing login query for douglas@unth.ng...\n');

  try {
    const client = await pool.connect();
    
    const loginId = 'douglas@unth.ng';
    
    // Test the exact query from the login handler
    console.log('Running query...');
    const result = await client.query(
      `SELECT id, email, COALESCE(password_hash, password) as password_value, 
              role, full_name, first_name, last_name, 
              COALESCE(is_approved, true) as is_approved, 
              COALESCE(is_active, true) as is_active
       FROM users WHERE email = $1`,
      [loginId]
    );
    
    console.log('Query successful!');
    console.log('Rows found:', result.rows.length);
    
    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log('\n📋 User data:');
      console.log('  ID:', user.id);
      console.log('  Email:', user.email);
      console.log('  Role:', user.role);
      console.log('  Full Name:', user.full_name);
      console.log('  Is Approved:', user.is_approved);
      console.log('  Is Active:', user.is_active);
      console.log('  Has Password:', !!user.password_value);
      
      if (user.password_value) {
        // Test password
        const testPassword = 'blackvelvet';
        const valid = await bcrypt.compare(testPassword, user.password_value);
        console.log('\n🔐 Password test (blackvelvet):', valid ? '✅ VALID' : '❌ INVALID');
      }
    } else {
      console.log('❌ User not found!');
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Query Error:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

testLogin();
