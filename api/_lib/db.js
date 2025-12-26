// Shared database connection for Vercel serverless functions
// Supports: Supabase (recommended), Neon PostgreSQL, or any PostgreSQL-compatible database

import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Detect if using Supabase (connection pooler uses port 6543)
    const isSupabase = connectionString.includes('supabase') || connectionString.includes(':6543');
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      // Optimized settings for serverless (Vercel)
      max: isSupabase ? 5 : 10,  // Supabase free tier has connection limits
      idleTimeoutMillis: 20000,  // Close idle connections faster for serverless
      connectionTimeoutMillis: 10000,
    });

    // Handle pool errors gracefully
    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Test database connection
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    return { 
      success: true, 
      message: 'Database connected', 
      time: result.rows[0].current_time 
    };
  } catch (error) {
    return { 
      success: false, 
      message: error.message 
    };
  }
}

export default { getPool, query, testConnection };
