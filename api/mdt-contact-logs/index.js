// MDT Contact Logs sync endpoint
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  if (req.method === 'GET') {
    try {
      const result = await query(
        `SELECT * FROM mdt_contact_logs 
         ORDER BY contact_date DESC, updated_at DESC 
         LIMIT 500`
      );
      return res.status(200).json(result.rows);
    } catch (error) {
      console.error('Error fetching MDT contact logs:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
