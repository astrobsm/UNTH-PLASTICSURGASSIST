// Simple test endpoint for users list
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  console.log('users-test handler called');
  
  try {
    // Handle CORS
    if (cors(req, res)) return;
    
    // Authenticate
    const auth = authenticateRequest(req);
    console.log('Auth:', auth.authenticated, auth.user?.role);
    
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }
    
    // Check role
    if (!['admin', 'consultant'].includes(auth.user.role)) {
      return res.status(403).json({ 
        error: 'Access denied', 
        yourRole: auth.user.role 
      });
    }
    
    // Query database
    const result = await query(
      `SELECT id, username, email, full_name, role, is_active, created_at, last_login
       FROM users ORDER BY created_at DESC LIMIT 10`
    );
    
    return res.status(200).json({ 
      success: true,
      count: result.rows.length,
      users: result.rows 
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: 'Server error', 
      message: error.message,
      stack: error.stack
    });
  }
}
