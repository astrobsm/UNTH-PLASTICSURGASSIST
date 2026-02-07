#!/usr/bin/env node
/**
 * Create user douglas@unth.ng with password blackvelvet
 */

import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres.mgblgewvpzcaimqaeqcp:VMBaD8okNXl2K9pV@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function createUser() {
  console.log('🔧 Creating user douglas@unth.ng...\n');

  try {
    const client = await pool.connect();
    
    const email = 'douglas@unth.ng';
    const password = 'blackvelvet';
    const fullName = 'Douglas Nnadi';
    const role = 'super_admin';
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Check if user exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existing.rows.length > 0) {
      console.log('⚠️  User already exists. Updating password and approval status...');
      await client.query(
        `UPDATE users SET password_hash = $1, is_approved = true, is_active = true, full_name = $2 WHERE email = $3`,
        [passwordHash, fullName, email]
      );
      console.log('✅ User updated successfully!');
    } else {
      // Create new user
      const result = await client.query(
        `INSERT INTO users (id, email, password_hash, full_name, role, is_approved, is_active, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, true, NOW(), NOW())
         RETURNING id, email, full_name, role`,
        [email, passwordHash, fullName, role]
      );
      console.log('✅ User created successfully!');
      console.log('   ID:', result.rows[0].id);
    }
    
    console.log('\n📋 User Details:');
    console.log('   Email:', email);
    console.log('   Password:', password);
    console.log('   Role:', role);
    console.log('   Approved: Yes');
    console.log('   Active: Yes');
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createUser();
