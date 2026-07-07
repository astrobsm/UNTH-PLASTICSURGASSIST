// PUBLIC: self-service password reset request (user is locked out, no auth).
// Reachable at POST /api/users/reset-request. Always returns a generic response
// so it never reveals whether an email is registered.
import { query } from '../_lib/db.js';
import { cors } from '../_lib/auth.js';

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
  } catch (e) { console.warn('ensureResetRequestsTable:', e.message); }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = (req.body?.email || '').trim().toLowerCase();
  const generic = { message: 'If that account exists, a reset request has been sent to the administrators.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(200).json(generic);
  }
  try {
    await ensureResetRequestsTable();
    const u = await query(
      "SELECT id FROM users WHERE LOWER(email) = $1 AND (app_id = 'psa' OR app_id IS NULL)", [email]
    );
    const userId = u.rows[0]?.id || null;
    const existing = await query(
      "SELECT id FROM password_reset_requests WHERE LOWER(email) = $1 AND status = 'pending'", [email]
    );
    if (existing.rows.length === 0) {
      await query(
        "INSERT INTO password_reset_requests (email, user_id, status) VALUES ($1, $2, 'pending')",
        [email, userId]
      );
    }
  } catch (e) { console.warn('reset-request:', e.message); }
  return res.status(200).json(generic);
}
