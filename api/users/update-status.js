// User status (activate/deactivate) endpoint
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import { reassignDeactivatedUser, coverRosterVacancies } from '../_lib/teamAssignment.js';

export default async function handler(req, res) {
  try {
    if (cors(req, res)) return;

    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    if (req.method !== 'PATCH' && req.method !== 'PUT') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Only admin can change user status
    if (!['admin'].includes(auth.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get user ID from body or query
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active boolean is required' });
    }

    // Prevent deactivating own account
    if (auth.user.id === parseInt(userId) && !is_active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const result = await query(
      `UPDATE users SET is_active = $1 WHERE id = $2
       RETURNING id, username, email, full_name, role, is_approved, is_active`,
      [is_active, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // On deactivation, reassign this staff member's patients to the least-loaded
    // remaining active staff of their role (leaving the slot empty if none exist).
    let reassignment = null;
    let rosterSlotsBlanked = 0;
    let rosterCover = null;
    if (!is_active) {
      try {
        reassignment = await reassignDeactivatedUser(userId);
        console.log(`Reassigned patients for deactivated user ${userId}:`, reassignment);
      } catch (e) {
        console.error('reassignDeactivatedUser failed:', e.message);
      }
      // Also take them off current/future call-duty shifts, handing each duty to
      // an active colleague of the same grade so the on-call roster keeps working
      // (slots are only cleared when nobody of that grade is left). Everyone
      // else's shifts are untouched.
      try {
        rosterCover = await coverRosterVacancies({ replacing: userId });
        rosterSlotsBlanked = rosterCover.covered + rosterCover.cleared;
        console.log(`Roster cover for deactivated user ${userId}:`, rosterCover);
      } catch (e) {
        console.error('coverRosterVacancies failed:', e.message);
      }
    }

    return res.status(200).json({
      user: result.rows[0],
      reassignment,
      rosterSlotsBlanked,
      rosterCover,
      message: is_active ? 'User activated successfully' : 'User deactivated successfully'
    });
  } catch (error) {
    console.error('User status update error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}
