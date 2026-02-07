#!/usr/bin/env node
/**
 * Check user authentication status
 */

import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = 'postgresql://postgres.mgblgewvpzcaimqaeqcp:VMBaD8okNXl2K9pV@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000,
});

async function checkUser() {
  console.log('🔍 Checking user: douglas@unth.ng\n');
  
  try {
    const client = await pool.connect();
    
    // Check if user exists
    const result = await client.query(`
      SELECT id, email, full_name, role, is_approved, is_active, password_hash, username, must_change_password
      FROM users 
      WHERE email = 'douglas@unth.ng' OR username = 'douglas@unth.ng'
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ User NOT FOUND in database!');
      console.log('\nListing all users:');
      const allUsers = await client.query(`SELECT id, email, full_name, role, is_approved, is_active FROM users`);
      console.table(allUsers.rows);
    } else {
      const user = result.rows[0];
      console.log('✅ User FOUND:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   Username:', user.username);
      console.log('   Full Name:', user.full_name);
      console.log('   Role:', user.role);
      console.log('   Is Approved:', user.is_approved);
      console.log('   Is Active:', user.is_active);
      console.log('   Has Password:', !!user.password_hash);
      console.log('   Must Change Password:', user.must_change_password);
      
      if (!user.is_approved) {
        console.log('\n⚠️  USER IS NOT APPROVED! Approving now...');
        await client.query(`UPDATE users SET is_approved = true WHERE id = $1`, [user.id]);
        console.log('✅ User approved!');
      }
      
      if (!user.is_active) {
        console.log('\n⚠️  USER IS NOT ACTIVE! Activating now...');
        await client.query(`UPDATE users SET is_active = true WHERE id = $1`, [user.id]);
        console.log('✅ User activated!');
      }
      
      if (!user.password_hash) {
        console.log('\n⚠️  USER HAS NO PASSWORD! This needs to be set.');
      }
    }
    
    client.release();
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUser();
