// @vitest-environment node
/**
 * The chat handler, exercised directly.
 *
 * This is new server code that has never run against a database, and it is the
 * only thing standing between one ward's conversation and another's. The
 * database is mocked — the point is not to test Postgres but to hold the
 * handler to its contract: who it lets in, what shape it answers with, and what
 * it refuses.
 *
 * The wire shape is asserted in camelCase on purpose. apiClient hands the body
 * to the page untouched, so a handler that answered with raw rows would render
 * blank names and "Invalid Date" rather than failing — which is exactly how the
 * wound-care and surgery sync bugs stayed hidden.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  query: undefined,
  cors: () => false,
  authenticateRequest: (...a: Json[]) => authenticateRequest(...a),
}));

import handler from '../../api/chat.js';

const USER = { id: 7, role: 'registrar', fullName: 'Dr Okafor' };

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
 * ensureTables() issues its CREATE once per module, not once per test, so a
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

const IS_MEMBER = /SELECT 1 FROM chat_participants/i;
const LIST_ROOMS = /FROM chat_rooms r/i;
const PARTICIPANTS = /JOIN users u ON u\.id = p\.user_id/i;
const LATEST = /SELECT DISTINCT ON \(room_id\)/i;
const HISTORY = /FROM chat_messages m/i;
const ONE_MESSAGE = /SELECT \* FROM chat_messages WHERE id/i;
const ONE_ROOM = /SELECT \* FROM chat_rooms WHERE id/i;

/** Shorthand for "the caller is in this room". */
const member: [RegExp, Json[]] = [IS_MEMBER, [{ ok: 1 }]];

beforeEach(() => {
  vi.clearAllMocks();
  authenticateRequest.mockReturnValue({ authenticated: true, user: USER });
  respond();
});

describe('who may reach it', () => {
  it('refuses an unauthenticated request', async () => {
    authenticateRequest.mockReturnValue({ authenticated: false, error: 'No token provided' });
    const res = await call('GET', '/api/chat/rooms');
    expect(res.statusCode).toBe(401);
  });

  it('refuses to read a room the caller is not in', async () => {
    // The membership check is the whole authorisation boundary. Every room
    // route goes through it, and this is a clinical conversation about a named
    // patient — reading someone else's is a disclosure, not a glitch.
    respond(); // isMember -> no rows
    const res = await call('GET', '/api/chat/rooms/r-other/messages');
    expect(res.statusCode).toBe(403);
  });

  it('refuses to post into a room the caller is not in', async () => {
    respond();
    const res = await call('POST', '/api/chat/rooms/r-other/messages', { content: 'hello' });
    expect(res.statusCode).toBe(403);
  });

  it('scopes a search to the caller\'s own rooms', async () => {
    respond();
    await call('GET', '/api/chat/messages/search?q=graft');
    const [sql, args] = query.mock.calls[0];
    expect(sql).toMatch(/JOIN chat_participants/i);
    expect(args[0]).toBe(USER.id);
  });
});

describe('the shape it answers with', () => {
  it('returns rooms as a bare camelCase array', async () => {
    respond(
      [LIST_ROOMS, [{ id: 'r1', name: 'Ward 4', type: 'group', unread_count: '3', is_active: true,
         created_at: '2026-08-30T09:00:00Z', updated_at: '2026-08-30T10:00:00Z', patient_id: 412 }]],
      [PARTICIPANTS, [{ room_id: 'r1', id: 9, full_name: 'Dr Eze', role: 'consultant' }]],
      [LATEST, [{ id: 'm1', room_id: 'r1', sender_id: 9, sender_name: 'Dr Eze', content: 'Seen',
         type: 'text', created_at: '2026-08-30T10:00:00Z', reactions: {} }]],
    );

    const res = await call('GET', '/api/chat/rooms');

    expect(Array.isArray(res.body)).toBe(true);
    const room = res.body[0];
    expect(room.unreadCount).toBe(3);
    expect(room.patientId).toBe('412');
    expect(room.participants[0].name).toBe('Dr Eze');
    expect(room.lastMessage.senderName).toBe('Dr Eze');
    // Presence needs a live connection this platform cannot hold; claiming
    // someone is online would be a green dot with nothing behind it.
    expect(room.participants[0].isOnline).toBe(false);
  });

  it('returns a room history oldest-first', async () => {
    // The query takes the newest page, so the handler has to reverse it. A
    // transcript in reverse is not a transcript.
    respond(
      member,
      [HISTORY, [
        { id: 'm3', room_id: 'r1', content: 'third', created_at: '2026-08-30T12:00:00Z', type: 'text', reactions: {} },
        { id: 'm2', room_id: 'r1', content: 'second', created_at: '2026-08-30T11:00:00Z', type: 'text', reactions: {} },
        { id: 'm1', room_id: 'r1', content: 'first', created_at: '2026-08-30T10:00:00Z', type: 'text', reactions: {} },
      ]],
    );

    const res = await call('GET', '/api/chat/rooms/r1/messages');
    expect(res.body.map((m: Json) => m.content)).toEqual(['first', 'second', 'third']);
  });

  it('points a file message at its attachment rather than inlining it', async () => {
    respond(
      member,
      [HISTORY, [{ id: 'm1', room_id: 'r1', type: 'image', attachment_id: 42, file_name: 'wound.jpg',
         content: '', created_at: '2026-08-30T10:00:00Z', reactions: {} }]],
    );

    const res = await call('GET', '/api/chat/rooms/r1/messages');
    expect(res.body[0].fileUrl).toBe('/chat/attachments/42');
    // The bytes must not ride along with the history — a room's photographs
    // would then be re-downloaded on every poll.
    expect(res.body[0].content).toBe('');
  });
});

describe('posting', () => {
  it('records the sender from the token, not from the body', async () => {
    // Otherwise a caller could sign a clinical instruction as somebody else.
    respond(member, [ONE_MESSAGE, [{ id: 'm1', room_id: 'r1', sender_id: 7, sender_name: 'Dr Okafor',
      content: 'Nil by mouth', type: 'text', created_at: '2026-08-30T10:00:00Z', reactions: {} }]]);

    await call('POST', '/api/chat/rooms/r1/messages', {
      content: 'Nil by mouth', senderName: 'Someone Else', sender_id: 999,
    });

    const insert = query.mock.calls.find(c => /INSERT INTO chat_messages/i.test(c[0]));
    expect(insert[1]).toContain(USER.id);
    expect(insert[1]).toContain('Dr Okafor');
    expect(insert[1]).not.toContain(999);
  });

  it('upserts on the client-minted id so a retry cannot double-post', async () => {
    respond(member, [ONE_MESSAGE, [{ id: 'given-id', room_id: 'r1', content: 'x', type: 'text',
      created_at: '2026-08-30T10:00:00Z', reactions: {} }]]);

    await call('POST', '/api/chat/rooms/r1/messages', { id: 'given-id', content: 'x' });

    const insert = query.mock.calls.find(c => /INSERT INTO chat_messages/i.test(c[0]));
    expect(insert[0]).toMatch(/ON CONFLICT \(id\) DO NOTHING/i);
    expect(insert[1][0]).toBe('given-id');
  });

  it('rejects an empty message', async () => {
    respond(member);
    const res = await call('POST', '/api/chat/rooms/r1/messages', { content: '   ' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a file message that is not a data URL', async () => {
    respond(member);
    const res = await call('POST', '/api/chat/rooms/r1/messages', { type: 'image', content: 'not-a-data-url' });
    expect(res.statusCode).toBe(400);
  });

  it('refuses an attachment beyond the size limit', async () => {
    // Serverless bodies are capped; a request over the limit fails in a way the
    // clinician cannot interpret, so it is refused with a reason instead.
    respond(member);
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(5 * 1024 * 1024);
    const res = await call('POST', '/api/chat/rooms/r1/messages', { type: 'image', content: huge });
    expect(res.statusCode).toBe(413);
  });
});

describe('creating a room', () => {
  it('always adds the creator as a participant', async () => {
    // A room its creator is not in would be invisible to them the moment the
    // page reloaded, and would reject every message they posted into it.
    respond([ONE_ROOM, [{ id: 'r-new', name: 'Burns MDT', type: 'group', is_active: true,
      created_at: 'x', updated_at: 'x' }]]);

    await call('POST', '/api/chat/rooms', { name: 'Burns MDT', type: 'group', participantIds: [9] });

    const inserts = query.mock.calls.filter(c => /INSERT INTO chat_participants/i.test(c[0]));
    const users = inserts.map(c => c[1][1]);
    expect(users).toContain(USER.id);
    expect(users).toContain(9);
  });

  it('requires a name', async () => {
    const res = await call('POST', '/api/chat/rooms', { type: 'group' });
    expect(res.statusCode).toBe(400);
  });
});

describe('unknown routes', () => {
  it('404s rather than falling through to something else', async () => {
    const res = await call('GET', '/api/chat/nonsense');
    expect(res.statusCode).toBe(404);
  });
});
