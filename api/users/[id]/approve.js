// User approval endpoint
import { query } from '../../_lib/db.js';
import { cors, authenticateRequest } from '../../_lib/auth.js';

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    if (req.method !== 'PATCH' && req.method !== 'POST' && req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Only admin and consultant can approve users
    if (!['admin', 'consultant'].includes(auth.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user ID from URL path
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const result = await query(
      `UPDATE users SET is_approved = true WHERE id = $1
       RETURNING id, username, email, full_name, role, is_approved, is_active`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: result.rows[0], message: 'User approved successfully' });
  } catch (error) {
    console.error('User approval error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
