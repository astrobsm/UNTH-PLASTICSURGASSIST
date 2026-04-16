#!/usr/bin/env node
/**
 * ⚠️ DEPRECATED: This script runs the old UUID-based schema.sql.
 * The production schema is managed by api/init-db.js (single source of truth).
 * Do NOT run this file on production. Kept for historical reference only.
 *
 * Database Migration Script for Supabase
 * Runs schema.sql and seed.sql to set up the database
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres.mgblgewvpzcaimqaeqcp:VMBaD8okNXl2K9pV@aws-1-eu-central-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  // Force IPv4
  connectionTimeoutMillis: 30000,
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...\n');
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Connected to database successfully!\n');
    
    // Read and execute schema.sql
    console.log('📋 Running schema.sql...');
    const schemaPath = path.join(__dirname, 'server', 'db', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const schemaStatements = schemaSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of schemaStatements) {
      try {
        await client.query(statement);
        successCount++;
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate key') ||
            err.message.includes('relation') && err.message.includes('already exists')) {
          console.log(`  ⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          errorCount++;
        }
      }
    }
    
    console.log(`✅ Schema completed: ${successCount} statements executed, ${errorCount} errors\n`);
    
    // Read and execute seed.sql
    console.log('🌱 Running seed.sql...');
    const seedPath = path.join(__dirname, 'server', 'db', 'seed.sql');
    const seedSQL = fs.readFileSync(seedPath, 'utf8');
    
    const seedStatements = seedSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    successCount = 0;
    errorCount = 0;
    
    for (const statement of seedStatements) {
      try {
        await client.query(statement);
        successCount++;
        console.log(`  ✅ Inserted: ${statement.substring(0, 50)}...`);
      } catch (err) {
        if (err.message.includes('duplicate key') || 
            err.message.includes('already exists') ||
            err.message.includes('violates unique constraint')) {
          console.log(`  ⏭️  Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`  ❌ Error: ${err.message}`);
          errorCount++;
        }
      }
    }
    
    console.log(`✅ Seed completed: ${successCount} statements executed, ${errorCount} errors\n`);
    
    // Verify tables
    console.log('🔍 Verifying created tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Tables in database:');
    console.log('─'.repeat(40));
    tablesResult.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.table_name}`);
    });
    console.log('─'.repeat(40));
    console.log(`Total: ${tablesResult.rows.length} tables\n`);
    
    // Check for users
    const usersResult = await client.query('SELECT id, email, role, is_approved FROM users LIMIT 5');
    console.log('👥 Users in database:');
    console.log('─'.repeat(60));
    usersResult.rows.forEach(row => {
      console.log(`  ${row.email} | ${row.role} | Approved: ${row.is_approved}`);
    });
    console.log('─'.repeat(60));
    
    client.release();
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update DATABASE_URL in Vercel environment variables');
    console.log('  2. Push changes to GitHub to trigger deployment');
    console.log('  3. Test the app at https://plasticsurgassisstant.vercel.app');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
