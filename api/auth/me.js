// Get current user endpoint for Vercel serverless
import { query } from '../_lib/db.js';
import { authenticateRequest, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    const result = await query(
      `SELECT id, email, full_name, role, is_approved, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [auth.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
