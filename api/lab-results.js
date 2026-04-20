// Lab Results API endpoint for Vercel serverless
// Returns completed lab results (lab orders with results attached)
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    if (req.method === 'GET') {
      const patientId = req.query.patientId;
      const since = req.query.since;

      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
      }

      // Lab results are stored as completed lab orders
      // Check if lab_orders table exists first
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'lab_orders'
        )
      `);

      if (!tableCheck.rows[0].exists) {
        return res.status(200).json({ results: [] });
      }

      let sql = `
        SELECT * FROM lab_orders 
        WHERE patient_id = $1 AND (status = 'completed' OR results IS NOT NULL)
      `;
      const params = [patientId];
      let paramCount = 2;

      if (since) {
        sql += ` AND updated_at > $${paramCount}`;
        params.push(since);
        paramCount++;
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return res.status(200).json({ results: result.rows });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Lab results API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
