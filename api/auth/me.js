// Get current user endpoint for Vercel serverless.
// Also the session gate: this is where a forced sign-out or a deactivation
// actually terminates a running session (tokens are stateless and long-lived, so
// nothing else can). The client calls it at startup, on focus, on reconnect and
// on a timer, and logs out when it 401s.
import { query } from '../_lib/db.js';
import { authenticateRequest, cors } from '../_lib/auth.js';
import { ensureSessionColumn, isSessionRevoked } from '../_lib/session.js';

export default async function handler(req, res) {
  // Handle CORS
  if (cors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    await ensureSessionColumn();

    const result = await query(
      `SELECT id, email, full_name, role, is_approved, is_active, sessions_invalid_before, created_at, updated_at
       FROM users WHERE id = $1`,
      [auth.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // The word "invalid" is load-bearing: the client's auth layers (apiClient,
    // fetchHelper, offlineFetch) match on it to clear the token and raise
    // 'auth:expired', which is what drops the user back to the login screen.
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Session invalid — this account has been deactivated by an administrator',
        signedOut: true,
      });
    }
    if (isSessionRevoked(auth.user, user.sessions_invalid_before)) {
      return res.status(401).json({
        error: 'Session invalid — you have been signed out by an administrator',
        signedOut: true,
      });
    }

    delete user.sessions_invalid_before;
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
