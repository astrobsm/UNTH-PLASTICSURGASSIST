// Official sign-out — POST /api/users/sign-out  { userId, reason? }
//
// One auditable admin action for "this person has left the unit": it ends every
// session they have open (on every device), deactivates the account so they
// cannot log back in, hands their patients to the least-loaded remaining staff of
// the same role, and clears them out of current/future call-duty shifts.
//
// Deactivating alone was not enough to sign someone out: tokens are stateless
// JWTs with a 30-day life, so an already-running session kept working until it
// expired. Stamping users.sessions_invalid_before is what actually kills it —
// /api/auth/me rejects any token issued before that moment, and the client turns
// that rejection into a logout.
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import { ensureSessionColumn } from '../_lib/session.js';
import { reassignDeactivatedUser, coverRosterVacancies } from '../_lib/teamAssignment.js';

const ALLOWED_ROLES = ['admin', 'super_admin'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  try {
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(auth.status || 401).json({ error: auth.error });
    }

    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!ALLOWED_ROLES.includes(auth.user.role)) {
      return res.status(403).json({ error: 'Only administrators can sign a user out' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const userId = body.userId || req.query?.userId;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : '';

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Signing yourself out here would deactivate the account you are working in
    // and leave the unit without the admin who was mid-task. Use plain logout.
    if (String(auth.user.id) === String(userId)) {
      return res.status(400).json({ error: 'You cannot sign out your own account — use Logout instead' });
    }

    await ensureSessionColumn();

    const result = await query(
      `UPDATE users
          SET is_active = FALSE,
              sessions_invalid_before = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND (app_id = 'psa' OR app_id IS NULL)
        RETURNING id, username, email, full_name, role, is_approved, is_active, sessions_invalid_before`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = result.rows[0];

    // Hand over their work. Both are best-effort: the sign-out itself has already
    // committed, and a failure here must not report the account as still active.
    let reassignment = null;
    let rosterCover = { covered: 0, cleared: 0, shiftsTouched: 0 };
    try {
      reassignment = await reassignDeactivatedUser(userId);
    } catch (e) {
      console.error('sign-out: reassignDeactivatedUser failed:', e.message);
    }
    try {
      // Their call duties pass to active colleagues of the same grade; nobody
      // else's shifts move.
      rosterCover = await coverRosterVacancies({ replacing: userId });
    } catch (e) {
      console.error('sign-out: coverRosterVacancies failed:', e.message);
    }
    const rosterSlotsBlanked = rosterCover.covered + rosterCover.cleared;

    try {
      await query(
        `INSERT INTO audit_logs (user_id, user_name, user_role, action, resource_type, resource_id, resource_identifier, details, ip_address)
         VALUES ($1, $2, $3, 'force_sign_out', 'user', $4, $5, $6, $7)`,
        [
          String(auth.user.id),
          auth.user.fullName || auth.user.full_name || auth.user.email || 'admin',
          auth.user.role,
          String(userId),
          user.full_name || user.email || String(userId),
          JSON.stringify({
            reason: reason || null,
            signedOutAt: user.sessions_invalid_before,
            deactivated: true,
            patientsReassigned: reassignment?.reassigned ?? 0,
            patientsLeftUnassigned: reassignment?.cleared ?? 0,
            rosterSlotsCovered: rosterCover.covered,
            rosterSlotsCleared: rosterCover.cleared,
          }),
          req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null,
        ]
      );
    } catch (e) {
      // Audit table shape may differ across deployments — never block the action.
      console.warn('sign-out: audit log write skipped:', e.message);
    }

    return res.status(200).json({
      success: true,
      user,
      signedOutAt: user.sessions_invalid_before,
      reassignment,
      rosterSlotsBlanked,
      rosterCover,
      message: `${user.full_name || user.email} has been signed out of all devices and deactivated`,
    });
  } catch (error) {
    console.error('Force sign-out error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
