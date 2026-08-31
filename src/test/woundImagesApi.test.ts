// @vitest-environment node
/**
 * The wound photograph endpoint and its storage adapter.
 *
 * This is the code that answers the complaint that started it: a photograph
 * taken on one phone was invisible on every other. It has never run against a
 * database, so the contract is pinned here — what it accepts, what it refuses,
 * and, most importantly, that a row written by one storage driver is still
 * readable after the deployment switches to the other.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * A JSON value crossing the handler boundary.
 *
 * Deliberately loose, and named so it is loose in one declared place rather
 * than fourteen scattered ones: these tests drive an untyped JS handler with a
 * fake req/res and assert a different body shape in every case. Typing that
 * precisely would mean restating the whole API surface in the test file.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

const query = vi.fn();
const authenticateRequest = vi.fn();

vi.mock('../../api/_lib/db.js', () => ({ query: (...a: Json[]) => query(...a) }));
vi.mock('../../api/_lib/auth.js', () => ({
  cors: () => false,
  authenticateRequest: (...a: Json[]) => authenticateRequest(...a),
}));

import handler from '../../api/wound-images.js';
import { activeDriver, getImage } from '../../api/_lib/imageStorage.js';

const USER = { id: 7, role: 'registrar', fullName: 'Dr Okafor' };
const PIXEL_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
const ONE_PIXEL = PIXEL_BYTES.toString('base64');

function call(method: string, url: string, body?: Json) {
  const res: Json = { statusCode: 0, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: Json) => { res.body = b; return res; };
  res.setHeader = () => res;
  return handler({ method, url, headers: { host: 'x.test' }, body }, res).then(() => res);
}

/**
 * Answer by matching the SQL rather than by call order.
 *
 * ensureImageTable() issues its CREATE once per module, not once per test, so a
 * positional queue lines up for whichever test runs first and is off by one for
 * every test after it.
 */
function respond(...pairs: [RegExp, Json[]][]) {
  query.mockReset();
  query.mockImplementation((sql: string) => {
    for (const [pattern, rows] of pairs) {
      if (pattern.test(String(sql))) return Promise.resolve({ rows });
    }
    return Promise.resolve({ rows: [] });
  });
}

const INSERT = /INSERT INTO wound_images/i;
const SELECT_ONE = /storage_driver, storage_path, data/i;
const SELECT_LIST = /FROM wound_images\s+WHERE/i;

beforeEach(() => {
  vi.clearAllMocks();
  authenticateRequest.mockReturnValue({ authenticated: true, user: USER });
  respond();
});

describe('access', () => {
  it('refuses an unauthenticated request', async () => {
    authenticateRequest.mockReturnValue({ authenticated: false, error: 'No token provided' });
    const res = await call('GET', '/api/wound-images?ref=wi_a');
    expect(res.statusCode).toBe(401);
  });

  it('refuses a method it does not serve', async () => {
    const res = await call('DELETE', '/api/wound-images?ref=wi_a');
    expect(res.statusCode).toBe(405);
  });
});

describe('uploading', () => {
  it('stores the photograph and returns a path any device can follow', async () => {
    // "local:<ref>" was the old value and only the capturing phone could
    // resolve it. What comes back must work from anywhere.
    respond([INSERT, [{ ref: 'wi_a', kind: 'original', mime_type: 'image/jpeg', bytes: 4 }]]);

    const res = await call('POST', '/api/wound-images', {
      ref: 'wi_a', kind: 'original', mime_type: 'image/jpeg',
      patient_id: 412, data_base64: ONE_PIXEL,
    });

    expect(res.statusCode).toBe(201);
    expect(res.body.remote_path).toBe('/wound-images?ref=wi_a');
  });

  it('records who uploaded it from the token, not the body', async () => {
    respond([INSERT, [{ ref: 'wi_a' }]]);
    await call('POST', '/api/wound-images', { ref: 'wi_a', data_base64: ONE_PIXEL, uploaded_by: 999 });

    const insert = query.mock.calls.find(c => INSERT.test(String(c[0])));
    expect(insert[1]).toContain(USER.id);
    expect(insert[1]).not.toContain(999);
  });

  it('is idempotent on the ref so a retried upload makes one row', async () => {
    // The ref is minted at capture and the queue retries, so without this a
    // flaky ward connection would multiply every photograph.
    respond([INSERT, [{ ref: 'wi_a' }]]);
    await call('POST', '/api/wound-images', { ref: 'wi_a', data_base64: ONE_PIXEL });

    const insert = query.mock.calls.find(c => INSERT.test(String(c[0])));
    expect(insert[0]).toMatch(/ON CONFLICT \(ref\) DO UPDATE/i);
  });

  it('refuses an upload with no ref or no bytes', async () => {
    expect((await call('POST', '/api/wound-images', { data_base64: ONE_PIXEL })).statusCode).toBe(400);
    expect((await call('POST', '/api/wound-images', { ref: 'wi_a' })).statusCode).toBe(400);
    expect((await call('POST', '/api/wound-images', { ref: 'wi_a', data_base64: '' })).statusCode).toBe(400);
  });

  it('refuses a photograph beyond the size limit', async () => {
    const huge = Buffer.alloc(9 * 1024 * 1024).toString('base64');
    const res = await call('POST', '/api/wound-images', { ref: 'wi_a', data_base64: huge });
    expect(res.statusCode).toBe(413);
  });
});

describe('reading', () => {
  it('returns the bytes for a ref, without leaking where they are kept', async () => {
    respond([SELECT_ONE, [{
      ref: 'wi_a', kind: 'original', mime_type: 'image/jpeg', bytes: 4,
      width: 800, height: 600, captured_at: '2026-08-30T09:00:00Z',
      assessment_id: 3, wound_id: 2, patient_id: 412,
      storage_driver: 'postgres', storage_path: '/secret/bucket/path',
      data: PIXEL_BYTES,
    }]]);

    const res = await call('GET', '/api/wound-images?ref=wi_a');

    expect(res.body.data_base64).toBe(ONE_PIXEL);
    expect(res.body.remote_path).toBe('/wound-images?ref=wi_a');
    // The internal object path is not the caller's business.
    expect(res.body.storage_path).toBeUndefined();
  });

  it('404s for a ref that is not there', async () => {
    respond();
    const res = await call('GET', '/api/wound-images?ref=missing');
    expect(res.statusCode).toBe(404);
  });

  it('lists an assessment\'s photographs without their bytes', async () => {
    // The gallery asks what exists, then fetches each one lazily. Returning
    // every photograph here would make opening a wound download all of them.
    respond([SELECT_LIST, [{ ref: 'wi_a', kind: 'original', mime_type: 'image/jpeg', assessment_id: 3 }]]);

    const res = await call('GET', '/api/wound-images?assessment_id=3');

    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0].remote_path).toBe('/wound-images?ref=wi_a');
    expect(res.body.images[0].data_base64).toBeUndefined();
  });

  it('returns nothing rather than everything when asked for no one', async () => {
    // A listing with no filter would be every wound photograph in the hospital,
    // so the adapter refuses to build a WHERE-less query at all.
    respond([SELECT_LIST, [{ ref: 'should-never-be-reached' }]]);
    const res = await call('GET', '/api/wound-images');
    expect(res.body.images).toEqual([]);
  });
});

describe('the storage adapter', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('uses Postgres when no object store is configured', () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(activeDriver()).toBe('postgres');
  });

  it('keeps serving a Postgres row after the deployment moves to Supabase', async () => {
    // The row records the driver that wrote it. Reading by the *current* driver
    // instead would make every photograph taken before the switch unreadable —
    // silently, and only for the older ones.
    respond([SELECT_ONE, [{
      ref: 'wi_old', storage_driver: 'postgres', storage_path: null,
      data: Buffer.from([1, 2, 3]), mime_type: 'image/jpeg',
    }]]);

    const row = await getImage('wi_old');

    expect(row.storage_driver).toBe('postgres');
    expect(Buffer.from(row.data)).toEqual(Buffer.from([1, 2, 3]));
  });
});
