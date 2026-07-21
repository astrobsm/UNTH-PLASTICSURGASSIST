// ADMIN: list password-reset requests raised by locked-out users.
//
// Reachable at GET /api/users/reset-requests.
//
// api/users/reset-request.js (singular, public) writes a row here when a user
// uses "Forgot password" on the login screen, and tells them "a reset request
// has been sent to the administrators". Nothing ever read that table — the only
// SELECTs anywhere were dedup checks — so no administrator could see the
// request and the promise made to the user was never kept. This closes the loop.
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

const ADMIN_ROLES = ['admin', 'super_admin', 'consultant'];

async function ensureResetRequestsTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS password_reset_requests (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        user_id INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(180)
      )
    `);
  } catch (e) {
    console.warn('ensureResetRequestsTable:', e.message);
  }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }
  if (!ADMIN_ROLES.includes(auth.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await ensureResetRequestsTable();

    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const includeResolved = url.searchParams.get('includeResolved') === 'true';

      // LEFT JOIN so a request for an unknown/typo'd email still shows up —
      // an admin needs to see those to spot someone locked out under the
      // wrong address, rather than have them silently vanish.
      const result = await query(
        `SELECT r.id, r.email, r.user_id, r.status, r.requested_at,
                r.resolved_at, r.resolved_by,
                u.full_name, u.username, u.role, u.is_active
         FROM password_reset_requests r
         LEFT JOIN users u ON u.id = r.user_id
         ${includeResolved ? '' : "WHERE r.status = 'pending'"}
         ORDER BY r.requested_at DESC
         LIMIT 200`
      );

      const pendingCount = result.rows.filter(r => r.status === 'pending').length;
      return res.status(200).json({ requests: result.rows, pendingCount });
    }

    if (req.method === 'DELETE' || req.method === 'PATCH') {
      // Dismiss a request without resetting (e.g. the user got back in, or it
      // was not a genuine request). Kept distinct from 'resolved', which
      // api/users/reset-password.js sets when a password was actually issued.
      const id = req.body?.id || new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
      if (!id) return res.status(400).json({ error: 'id is required' });

      const result = await query(
        `UPDATE password_reset_requests
         SET status = 'dismissed', resolved_at = CURRENT_TIMESTAMP, resolved_by = $2
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [id, auth.user.fullName || auth.user.email || 'admin']
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Request not found or already handled' });
      }
      return res.status(200).json({ message: 'Request dismissed', id: result.rows[0].id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('reset-requests error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
