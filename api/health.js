// Health check endpoint with database connectivity test
import { testConnection } from './_lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Quick health check (no DB test)
  if (req.query.quick === 'true') {
    return res.status(200).json({ 
      status: 'ok', 
      message: 'API is running',
      timestamp: new Date().toISOString()
    });
  }

  // Full health check with database test
  try {
    const dbStatus = await testConnection();
    
    res.status(200).json({ 
      status: dbStatus.success ? 'healthy' : 'degraded',
      message: 'Plastic Surgeon Assistant API',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbStatus.success,
        message: dbStatus.message,
        serverTime: dbStatus.time
      },
      version: '1.0.0'
    });
  } catch (error) {
    res.status(200).json({ 
      status: 'degraded',
      message: 'API running but database check failed',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: false,
        error: error.message
      }
    });
  }
}
