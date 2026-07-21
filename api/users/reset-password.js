// ADMIN: reset a user's password to a fresh temporary one (forces change on next
// login) and resolve any pending reset requests. Reachable at
// POST /api/users/reset-password with body { userId }.
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

// Temporary passwords are generated with a CSPRNG.
//
// This previously used Math.random() for both the character picks AND the
// final shuffle. Math.random() is not cryptographically secure and its output
// is predictable from observed values, so an attacker able to trigger or
// observe resets could narrow down the temporary password issued to somebody
// else — one that grants a full session on a clinical record system.
function generatePassword(length = 12) {
  const upper = 'ABCDEFGHIJKLMNPQRSTUVWXYZ';   // no O
  const lower = 'abcdefghijkmnpqrstuvwxyz';    // no l
  const digits = '23456789';                   // no 0/1
  const symbols = '!@#$%';
  const charset = upper + lower + digits + symbols;

  const pick = (set) => set[crypto.randomInt(0, set.length)];

  // Guarantee one of each class, then fill.
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(charset));

  // Fisher-Yates with crypto randomness so position is not predictable either.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });
  if (!['admin', 'super_admin', 'consultant'].includes(auth.user.role)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const userId = req.body?.userId || req.query?.userId;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const userRes = await query(
      "SELECT id, username, email, full_name, role FROM users WHERE id = $1 AND (app_id = 'psa' OR app_id IS NULL)",
      [userId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const target = userRes.rows[0];

    const tempPassword = generatePassword(12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    await query(
      'UPDATE users SET password_hash = $1, must_change_password = TRUE, is_active = TRUE WHERE id = $2',
      [passwordHash, userId]
    );

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS password_reset_requests (
          id SERIAL PRIMARY KEY, email VARCHAR(255) NOT NULL, user_id INTEGER,
          status VARCHAR(20) DEFAULT 'pending', requested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMPTZ, resolved_by VARCHAR(180)
        )`);
      await query(
        "UPDATE password_reset_requests SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = $2 WHERE (user_id = $1 OR LOWER(email) = LOWER($3)) AND status = 'pending'",
        [userId, auth.user.fullName || auth.user.email || 'admin', target.email]
      );
    } catch { /* non-fatal */ }

    return res.status(200).json({
      message: `Password reset for ${target.full_name}. Share the temporary password; they must change it on first login.`,
      user: { id: target.id, username: target.username, email: target.email, fullName: target.full_name, role: target.role },
      temporaryPassword: tempPassword,
    });
  } catch (error) {
    console.error('reset-password error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
