// @vitest-environment node
/**
 * Module audit, batch 1: CORS open to any origin (bearer tokens only), push
 * notifications reach the people they are meant for, training sign-out rules
 * are the same everywhere, and settings do what they say.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const calls: Array<{ sql: string; params: any[] }> = [];
vi.mock('../../api/_lib/db.js', () => ({
  query: vi.fn(async (sql: string, params: any[] = []) => { calls.push({ sql, params }); return { rows: [], rowCount: 0 }; }),
}));
vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

import { cors } from '../../api/_lib/auth.js';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
const res = () => {
  const headers: Record<string, string> = {};
  return { headers, statusCode: 200, setHeader(k: string, v: string) { headers[k] = v; }, status(c: number) { this.statusCode = c; return this; }, end() { return this; } } as any;
};
beforeEach(() => { calls.length = 0; });

describe('CORS', () => {
  it('allows any origin, without credentials, and answers preflight', () => {
    const r = res();
    expect(cors({ method: 'OPTIONS', headers: { origin: 'https://any.example' } } as any, r)).toBe(true);
    expect(r.statusCode).toBe(204);
    expect(r.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(r.headers['Access-Control-Allow-Credentials']).toBeUndefined();
    expect(r.headers['Access-Control-Allow-Headers']).toMatch(/Authorization/);
    expect(r.headers['Access-Control-Allow-Headers']).toMatch(/X-Idempotency-Key/);
    const g = res();
    expect(cors({ method: 'GET', headers: {} } as any, g)).toBe(false);
    expect(g.headers['Access-Control-Allow-Origin']).toBe('*');
  });
  it('vercel.json sends the same headers, and no client asks for credentials', () => {
    const v = read('vercel.json');
    expect(v).toMatch(/X-Idempotency-Key, x-init-secret/);
    for (const f of ['src/services/fetchHelper.ts', 'src/services/offlineFetch.ts', 'src/db/syncService.ts']) {
      expect(read(f), f).not.toMatch(/credentials: 'include'/);
    }
  });
});

describe('push notifications', () => {
  it('targeted sends compare user ids as text (the TEXT column), so they actually send', async () => {
    process.env.VAPID_PUBLIC_KEY = 'pub'; process.env.VAPID_PRIVATE_KEY = 'priv';
    const { notifyUsers } = await import('../../api/_lib/notify.js');
    await notifyUsers([12, '13'], { title: 't', body: 'b' });
    const q = calls.find(c => /FROM push_subscriptions/.test(c.sql))!;
    expect(q.sql).toMatch(/user_id::text = ANY\(\$1::text\[\]\)/);
    expect(q.params[0]).toEqual(['12', '13']);
  });
  it('no demo VAPID key anywhere; the app uses the server key and resubscribes on mismatch', () => {
    expect(read('api/notifications/broadcast.js')).not.toMatch(/BEl62iUY/);
    expect(read('src/services/pushNotificationService.ts')).not.toMatch(/BEl62iUY/);
    expect(read('src/services/notificationService.ts')).not.toMatch(/BL7ELnb/);
    expect(read('src/services/pushNotificationService.ts')).toMatch(/action=vapid-key/);
    expect(read('src/services/pushNotificationService.ts')).toMatch(/sameKey\(subscription, key\)/);
  });
  it('a user can list and remove only their own devices', () => {
    const src = read('api/push-subscriptions.js');
    expect(src).toMatch(/getOwnSubscriptions\(auth\.user, res\)/);
    expect(src).toMatch(/case 'DELETE'/);
    expect(read('src/store/authStore.ts')).toMatch(/pushNotificationService\.unsubscribe\(\)/);
  });
});

describe('training sign-out', () => {
  it('senior registrars can run Training Admin; no backfilled rotations; one start-rotation path', () => {
    const src = read('api/admin-training.js');
    expect(src).toMatch(/const ADMIN_ROLES = ROTATION_ADMIN_ROLES;/);
    expect(src).not.toMatch(/rotation = await backfillRotation/);
    expect(src).toMatch(/await startRotation\(\{/);
    expect(src).toMatch(/patientEntries: r\.patients/);
  });
  it('cancelling the approval prompt does not approve; HO tracking uses the shared sign-out', () => {
    expect(read('src/pages/AdminTrainingPage.tsx')).toMatch(/if \(comments === null\) return;/);
    expect(read('src/pages/HOTrackingPage.tsx')).toMatch(/if \(comments === null\) return;/);
    expect(read('api/ho-tracking.js')).toMatch(/signOutRotation\(\{ rotationId, mode: 'approved'/);
    expect(read('src/pages/HOTrackingPage.tsx')).toMatch(/'admin', 'super_admin', 'consultant', 'senior_registrar'/);
  });
});

describe('settings', () => {
  it('auto-sync is honoured, update check is not stale, clearing refuses with unsynced work', () => {
    expect(read('src/services/dataSyncService.ts')).toMatch(/localStorage\.getItem\('auto_sync_enabled'\) !== 'false'/);
    const s = read('src/pages/Settings.tsx');
    expect(s).toMatch(/if \(!found\) \{/);
    expect(s).toMatch(/have not synced yet\. Sync first/);
    expect(read('src/components/Layout.tsx')).toMatch(/to="\/notifications"/);
  });
});
