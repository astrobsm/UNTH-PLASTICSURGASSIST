// Minimal users endpoint for testing
import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  try {
    // CORS handling
    if (cors(req, res)) return;

    // Auth
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    // Only handle GET for now
    if (req.method === 'GET') {
      // Role check
      if (!['admin', 'consultant'].includes(auth.user.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await query(
        'SELECT id, username, email, full_name, role, is_approved, is_active, created_at FROM users ORDER BY id DESC'
      );
      return res.status(200).json({ users: result.rows });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
}
