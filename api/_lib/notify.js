/**
 * Send a push notification to specific users.
 *
 * The same twenty lines — look up the user's subscriptions, send, deactivate
 * anything the push service reports as gone — were written out separately in
 * process-incoming.js, broadcast.js and elsewhere. The 410 handling in
 * particular is easy to leave out, and a dead subscription that is never
 * deactivated is retried on every send for the life of the row.
 *
 * Never throws. A notification is a courtesy on top of a clinical write that
 * has already happened; failing the request because a phone was unreachable
 * would discard the real work.
 */

import webpush from 'web-push';
import { query } from './db.js';

let configured = false;

function ensureVapid() {
  if (configured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  try {
    webpush.setVapidDetails('mailto:admin@plasticsurgeryassistant.com', publicKey, privateKey);
    configured = true;
  } catch {
    return false;
  }
  return true;
}

/**
 * @param {number[]} userIds  who to tell
 * @param {{title: string, body: string, url?: string, tag?: string, data?: object}} notification
 * @returns {Promise<{sent: number, failed: number}>}
 */
export async function notifyUsers(userIds, notification) {
  const ids = [...new Set((userIds || []).map(Number).filter(Number.isFinite))];
  if (!ids.length || !ensureVapid()) return { sent: 0, failed: 0 };

  let subscriptions = [];
  try {
    const r = await query(
      `SELECT id, endpoint, keys FROM push_subscriptions
        WHERE user_id = ANY($1::int[]) AND COALESCE(is_active, true)`,
      [ids]
    );
    subscriptions = r.rows;
  } catch {
    return { sent: 0, failed: 0 };
  }

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: notification.tag,
    data: { url: notification.url || '/', ...(notification.data || {}) },
  });

  let sent = 0;
  let failed = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: typeof sub.keys === 'string' ? JSON.parse(sub.keys) : sub.keys },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      // 410 Gone / 404 mean the browser discarded the subscription. Left
      // active, it is retried forever.
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        try {
          await query('UPDATE push_subscriptions SET is_active = false WHERE id = $1', [sub.id]);
        } catch { /* the send already failed; nothing further to do */ }
      }
    }
  }
  return { sent, failed };
}

export default { notifyUsers };
