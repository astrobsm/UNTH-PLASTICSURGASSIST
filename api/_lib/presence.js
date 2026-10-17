// "Last active" for staff accounts.
//
// users.last_login records password sign-ins only, and on this app those are
// rare: tokens last 30 days and the client can sign in offline, so most staff
// showed "Never" on the Admin page while using the app daily. last_seen_at is
// the time of the person's most recent authenticated request to the server.
//
// Written at most once per user per 10 minutes per server instance, and never
// awaited: a presence stamp must not slow or fail a clinical request.
import { query } from './db.js';

const INTERVAL_MS = 10 * 60 * 1000;
const lastWritten = new Map();
let columnReady = null;

export function ensurePresenceColumn() {
  if (!columnReady) {
    columnReady = query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ')
      .catch((e) => { columnReady = null; console.warn('ensurePresenceColumn:', e.message); });
  }
  return columnReady;
}

/** Record that this staff user is active now (throttled, fire-and-forget). */
export function touchLastSeen(userId) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return;
  const now = Date.now();
  if (now - (lastWritten.get(id) || 0) < INTERVAL_MS) return;
  lastWritten.set(id, now);
  Promise.resolve(ensurePresenceColumn())
    .then(() => query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [id]))
    .catch(() => { lastWritten.delete(id); });
}
