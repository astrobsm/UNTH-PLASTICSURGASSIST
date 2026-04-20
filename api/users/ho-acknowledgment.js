// HO Responsibilities Acknowledgment API
import { query } from '../_lib/db.js';
import { authenticateRequest, cors } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    // Ensure the column exists (idempotent migration)
    await query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'ho_responsibilities_acknowledged_at'
        ) THEN
          ALTER TABLE users ADD COLUMN ho_responsibilities_acknowledged_at TIMESTAMP;
        END IF;
      END $$;
    `);

    if (req.method === 'GET') {
      const userId = req.query.userId || auth.user.id;
      const result = await query(
        'SELECT ho_responsibilities_acknowledged_at FROM users WHERE id = $1',
        [userId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(200).json({
        acknowledged: !!result.rows[0].ho_responsibilities_acknowledged_at,
        acknowledgedAt: result.rows[0].ho_responsibilities_acknowledged_at,
      });
    }

    if (req.method === 'POST') {
      const userId = req.body?.userId || auth.user.id;
      // Only allow users to acknowledge for themselves (or admins for anyone)
      if (String(userId) !== String(auth.user.id) && auth.user.role !== 'admin') {
        return res.status(403).json({ error: 'Cannot acknowledge for another user' });
      }
      await query(
        'UPDATE users SET ho_responsibilities_acknowledged_at = NOW() WHERE id = $1',
        [userId]
      );
      return res.status(200).json({ success: true, acknowledgedAt: new Date().toISOString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('HO acknowledgment error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
