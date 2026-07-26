// Forced sign-out support.
//
// Sessions are stateless JWTs with a 30-day life (see _lib/auth.js — deliberate,
// because ward staff work offline for long stretches). That means deactivating an
// account did NOT end a session that was already running: the token stayed valid
// on that phone until it expired. `users.sessions_invalid_before` is the missing
// piece — a cutoff timestamp. Any token issued before it is dead, so an admin can
// officially sign someone out of every device they are logged in on.
import { query } from './db.js';

let ensured = false;

/** Add the session-cutoff column if it isn't there yet (idempotent, cached). */
export async function ensureSessionColumn() {
  if (ensured) return;
  try {
    await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_invalid_before TIMESTAMPTZ`);
    ensured = true;
  } catch (e) {
    // Non-fatal: callers treat a missing cutoff as "no forced sign-out".
    console.warn('ensureSessionColumn skipped:', e.message);
  }
}

/**
 * True when this token predates the account's forced sign-out and must be
 * rejected. `decoded` is the verified JWT payload; `cutoff` is the stored
 * sessions_invalid_before value (null when the user was never signed out).
 */
export function isSessionRevoked(decoded, cutoff) {
  if (!cutoff) return false;
  const cutoffMs = new Date(cutoff).getTime();
  if (Number.isNaN(cutoffMs)) return false;
  // A token with no issued-at cannot be dated against the cutoff. Those predate
  // signToken's current payload, so fail closed rather than letting them live on.
  if (typeof decoded?.iat !== 'number') return true;
  // 1s tolerance for clock skew between the API node and Postgres — only revoke
  // tokens clearly issued before the cutoff.
  return decoded.iat * 1000 < cutoffMs - 1000;
}

export default { ensureSessionColumn, isSessionRevoked };
