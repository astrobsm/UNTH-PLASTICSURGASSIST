// Minimal test endpoint
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  if (!['admin', 'consultant'].includes(auth.user.role)) {
    return res.status(403).json({ error: 'Access denied', yourRole: auth.user.role });
  }

  try {
    const result = await query('SELECT id, username, email, full_name, role FROM users ORDER BY id DESC LIMIT 10');
    return res.status(200).json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
