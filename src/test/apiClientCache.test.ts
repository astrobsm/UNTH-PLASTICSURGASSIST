/**
 * The shared data layer (batch 2 of the module audit):
 *   - a cached read older than a minute waits for the server (it used to be
 *     shown instantly, so screens were one visit behind, and after a save
 *     showed the pre-save data);
 *   - a write drops the module's cached reads;
 *   - responses are merged into entity tables, never clear()ed (unsynced
 *     notices were deleted) and filtered responses never touch them
 *     (tumour-board assessments overwrote cases);
 *   - offline, a read returns the server's own response shape;
 *   - chat and conferencing are never cached.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { db } from '../db/database';
import { apiClient } from '../services/apiClient';

const ok = (body: any) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await db.api_cache.clear();
  await (db as any).notice_board.clear();
  await (db as any).tumor_board_cases.clear();
  localStorage.setItem('auth_token', 'test-token');
  apiClient.setToken('test-token');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
});
afterEach(() => { vi.unstubAllGlobals(); });

const settle = () => new Promise(r => setTimeout(r, 30));

describe('reads', () => {
  it('a copy older than a minute waits for the server', async () => {
    await db.api_cache.put({ endpoint: '/notice-board', data: { notices: [{ id: 'old' }] }, updated_at: new Date(Date.now() - 5 * 60_000) });
    fetchMock.mockReturnValueOnce(ok({ notices: [{ id: 'new' }] }));
    const r: any = await apiClient.get('/notice-board');
    expect(r.notices[0].id).toBe('new');
  });

  it('a copy under a minute old is shown instantly', async () => {
    await db.api_cache.put({ endpoint: '/notice-board', data: { notices: [{ id: 'recent' }] }, updated_at: new Date() });
    fetchMock.mockImplementation(() => ok({ notices: [{ id: 'new' }] }));
    const r: any = await apiClient.get('/notice-board');
    expect(r.notices[0].id).toBe('recent');
  });

  it('offline, returns the stored response in its real shape', async () => {
    await db.api_cache.put({ endpoint: '/notice-board', data: { notices: [{ id: 'n1' }] }, updated_at: new Date(Date.now() - 3600_000) });
    await (db as any).notice_board.put({ id: 'n1', title: 't' });
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const r: any = await apiClient.get('/notice-board');
    expect(Array.isArray(r.notices)).toBe(true);
  });
});

describe('writes and the cache', () => {
  it('a successful write drops cached reads of the same module', async () => {
    await db.api_cache.bulkPut([
      { endpoint: '/tumor-board?action=board', data: {}, updated_at: new Date() },
      { endpoint: '/tumor-board?action=detail&id=1', data: {}, updated_at: new Date() },
      { endpoint: '/notice-board', data: {}, updated_at: new Date() },
    ]);
    fetchMock.mockReturnValueOnce(ok({ case: { id: 1 } }));
    await apiClient.post('/tumor-board?action=plan', { x: 1 });
    await settle();
    const left = (await db.api_cache.toArray()).map(r => r.endpoint);
    expect(left).toEqual(['/notice-board']);
  });

  it('merges a list into its table without deleting unsynced local rows', async () => {
    await (db as any).notice_board.put({ id: 'local-unsynced', title: 'draft', synced: false });
    fetchMock.mockReturnValueOnce(ok({ notices: [{ id: 'server-1', title: 's' }] }));
    await apiClient.get('/notice-board', { freshRead: true });
    await settle();
    const ids = (await (db as any).notice_board.toArray()).map((r: any) => r.id).sort();
    expect(ids).toEqual(['local-unsynced', 'server-1']);
  });

  it('a filtered / action response never writes into the entity table', async () => {
    await (db as any).tumor_board_cases.put({ id: 1, patient_id: 9, site: 'cheek' });
    fetchMock.mockReturnValueOnce(ok({ case: { id: 1 }, assessments: [{ id: 1, stage: 'II' }] }));
    await apiClient.get('/tumor-board?action=detail&id=1', { freshRead: true });
    await settle();
    const row = await (db as any).tumor_board_cases.get(1);
    expect(row.site).toBe('cheek');
  });

  it('chat and conferencing are never stored on the device', async () => {
    fetchMock.mockImplementation(() => ok({ rooms: [{ id: 'r1' }] }));
    await apiClient.get('/chat/rooms');
    await apiClient.get('/conference-config');
    await settle();
    expect(await db.api_cache.get('/chat/rooms')).toBeUndefined();
    expect(await db.api_cache.get('/conference-config')).toBeUndefined();
  });
});
