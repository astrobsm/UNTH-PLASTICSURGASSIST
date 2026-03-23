// Training Warnings API - for trainees to view/acknowledge their warnings
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const authResult = authenticateRequest(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = authResult.user.id;
  const { method } = req;

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS training_warnings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        sent_by INTEGER NOT NULL,
        warning_type VARCHAR(50) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'warning',
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (method === 'GET') {
      const warnings = await query(
        `SELECT tw.*, u.full_name as sent_by_name
         FROM training_warnings tw
         LEFT JOIN users u ON tw.sent_by = u.id
         WHERE tw.user_id = $1
         ORDER BY tw.created_at DESC LIMIT 50`,
        [userId]
      );
      const unreadCount = warnings.rows.filter(w => !w.read).length;
      return res.status(200).json({ warnings: warnings.rows, unreadCount });
    }

    if (method === 'PUT') {
      const { warningId } = req.body;
      if (!warningId) return res.status(400).json({ error: 'warningId required' });

      await query(
        `UPDATE training_warnings SET read = true WHERE id = $1 AND user_id = $2`,
        [warningId, userId]
      );
      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'PUT']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Training Warnings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
