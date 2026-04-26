// Lightweight idempotency-key middleware for serverless mutation endpoints.
//
// The PWA stamps a stable UUID on every queued mutation (see src/db/syncService.ts)
// and forwards it as `X-Idempotency-Key` on every replay attempt. On flaky
// hospital networks a request may succeed server-side but the response never
// reaches the client; the client then retries, which without protection would
// create duplicate admissions, prescriptions, etc. This middleware caches the
// first response for 24h keyed by (user_id, key) and returns it on retries.
//
// Storage is a tiny Postgres table created lazily; cache lookups are O(1) on
// the unique index. Scope per-user prevents cross-tenant key collisions.

import { query } from './db.js';

let _tableEnsured = false;

async function ensureTable() {
  if (_tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS idempotency_cache (
        key VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        method VARCHAR(8) NOT NULL,
        path VARCHAR(255) NOT NULL,
        status_code INTEGER NOT NULL,
        response_body JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, key)
      )
    `);
    // Best-effort cleanup of entries older than 24h on each cold start.
    await query(`DELETE FROM idempotency_cache WHERE created_at < NOW() - INTERVAL '24 hours'`);
    _tableEnsured = true;
  } catch (e) {
    // Don't crash the request path if the table can't be created — just skip caching.
    console.warn('idempotency: ensureTable failed (caching disabled for this request):', e.message);
  }
}

function getKey(req) {
  const k = req.headers['x-idempotency-key'] || req.headers['X-Idempotency-Key'];
  if (!k || typeof k !== 'string') return null;
  // Reject pathological keys; UUIDs are <=36 chars.
  if (k.length > 64) return null;
  return k;
}

/**
 * Wrap a handler so it dedupes on X-Idempotency-Key. Pass the authenticated
 * user object so cache entries are scoped per-user.
 *
 *   if (await idempotent(req, res, auth.user)) return; // cached reply already sent
 *   const result = await doWork();
 *   await rememberResponse(req, res, auth.user, 200, result);
 *   return res.status(200).json(result);
 *
 * Returns true if a cached response was sent and the caller should bail out.
 */
export async function idempotent(req, res, user) {
  if (!user) return false;
  const key = getKey(req);
  if (!key) return false;
  await ensureTable();
  if (!_tableEnsured) return false;
  try {
    const userId = String(user.id || user.userId || user.sub || '');
    if (!userId) return false;
    const result = await query(
      `SELECT status_code, response_body FROM idempotency_cache
        WHERE user_id = $1 AND key = $2 AND created_at > NOW() - INTERVAL '24 hours'
        LIMIT 1`,
      [userId, key]
    );
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`idempotency: replay hit for user=${userId} key=${key} -> ${row.status_code}`);
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(row.status_code).json(row.response_body);
      return true;
    }
  } catch (e) {
    console.warn('idempotency: lookup failed:', e.message);
  }
  return false;
}

/** Persist a successful response so subsequent retries with the same key replay it. */
export async function rememberResponse(req, user, statusCode, body) {
  if (!user) return;
  const key = getKey(req);
  if (!key) return;
  if (!_tableEnsured) return;
  try {
    const userId = String(user.id || user.userId || user.sub || '');
    if (!userId) return;
    const path = (req.url || '').split('?')[0].slice(0, 255);
    await query(
      `INSERT INTO idempotency_cache (key, user_id, method, path, status_code, response_body)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, key) DO NOTHING`,
      [key, userId, req.method || 'POST', path, statusCode, body]
    );
  } catch (e) {
    console.warn('idempotency: remember failed:', e.message);
  }
}
