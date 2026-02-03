// Diagnostic endpoint to check environment and connectivity
import { query } from './_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check for record count action using req.query (Vercel standard)
  const action = req.query?.action;

  if (action === 'counts') {
    return await getRecordCounts(res);
  }

  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'not set',
    vercel: !!process.env.VERCEL,
    
    // Check environment variables (without revealing values)
    envVars: {
      DATABASE_URL: !!process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      JWT_SECRET: !!process.env.JWT_SECRET ? '✅ Set' : '❌ Missing (using fallback)',
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY ? '✅ Set' : '⚠️ Not set (AI features disabled)',
      INIT_ADMIN_SECRET: !!process.env.INIT_ADMIN_SECRET ? '✅ Set' : '⚠️ Not set'
    },
    
    database: {
      connected: false,
      error: null
    },
    
    instructions: null
  };

  // Test database connection
  if (process.env.DATABASE_URL) {
    try {
      const { testConnection } = await import('./_lib/db.js');
      const dbStatus = await testConnection();
      diagnostics.database.connected = dbStatus.success;
      diagnostics.database.serverTime = dbStatus.time;
      if (!dbStatus.success) {
        diagnostics.database.error = dbStatus.message;
      }
    } catch (error) {
      diagnostics.database.error = error.message;
    }
  } else {
    diagnostics.database.error = 'DATABASE_URL not configured';
    diagnostics.instructions = {
      step1: 'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
      step2: 'Add DATABASE_URL with your PostgreSQL connection string',
      step3: 'Add JWT_SECRET with a secure random string',
      step4: 'Redeploy the application',
      format: 'postgresql://user:password@host:port/database?sslmode=require',
      example: 'postgresql://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
    };
  }

  // Determine overall status
  const hasDb = diagnostics.database.connected;
  const hasJwt = !!process.env.JWT_SECRET;
  
  if (hasDb && hasJwt) {
    diagnostics.status = '✅ Healthy - All systems operational';
  } else if (hasDb) {
    diagnostics.status = '⚠️ Degraded - JWT_SECRET not configured';
  } else if (!process.env.DATABASE_URL) {
    diagnostics.status = '❌ Critical - DATABASE_URL not configured';
  } else {
    diagnostics.status = '❌ Critical - Database connection failed';
  }

  res.status(200).json(diagnostics);
}

// Get record counts from all main tables
async function getRecordCounts(res) {
  try {
    const countQuery = `
      SELECT 
        (SELECT COUNT(*) FROM patients) as patients,
        (SELECT COUNT(*) FROM treatment_plans) as treatment_plans,
        (SELECT COUNT(*) FROM admissions) as admissions,
        (SELECT COUNT(*) FROM lab_orders) as lab_orders,
        (SELECT COUNT(*) FROM prescriptions) as prescriptions,
        (SELECT COUNT(*) FROM wound_care_records) as wound_care_records,
        (SELECT COUNT(*) FROM ward_rounds) as ward_rounds,
        (SELECT COUNT(*) FROM surgeries) as surgeries,
        (SELECT COUNT(*) FROM discharge_summaries) as discharge_summaries,
        (SELECT COUNT(*) FROM users) as users
    `;
    
    const result = await query(countQuery);
    
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      counts: result.rows[0],
      tableMapping: {
        lab_orders: 'Server table (maps to lab_investigations in IndexedDB)',
        surgeries: 'Server table (maps to surgery_bookings in IndexedDB)',
        wound_care_records: 'Server table (maps to wound_care in IndexedDB)'
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
