// Diagnostic endpoint to check environment and connectivity
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
