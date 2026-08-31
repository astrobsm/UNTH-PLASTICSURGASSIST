/**
 * The chat API and the chat client must agree.
 *
 * Chat was a fully built interface over an API nobody had written: every write
 * went into a WebSocket that this platform never opens, and the three GETs the
 * service polled had no handler. api/chat.js now serves it over HTTP.
 *
 * Two things are worth holding still. First the wire shape — apiClient returns
 * the body untouched and the client's types are camelCase, so a handler that
 * answered with database rows would render blank names and "Invalid Date"
 * rather than failing outright. That is the mistake this repository has already
 * made in wound-care and surgery sync. Second the send path, which must not
 * report success it did not get.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const get = vi.fn();
const post = vi.fn();

vi.mock('../services/apiClient', () => ({
  apiClient: {
    get: (...a: any[]) => get(...a),
    post: (...a: any[]) => post(...a),
    getToken: () => 'test-token',
  },
}));

vi.mock('../db/database', () => ({ db: {} }));

import chatService from '../services/chatService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reading', () => {
  it('asks for the room list and passes it through', async () => {
    get.mockResolvedValue([
      { id: 'r1', name: 'Ward 4', type: 'group', participants: [], unreadCount: 2 },
    ]);
    const rooms = await chatService.getRooms();
    expect(get).toHaveBeenCalledWith('/chat/rooms');
    expect(rooms[0].name).toBe('Ward 4');
    expect(rooms[0].unreadCount).toBe(2);
  });

  it('requests a room history with a limit', async () => {
    get.mockResolvedValue([]);
    await chatService.getMessages('r1', 25);
    expect(get.mock.calls[0][0]).toBe('/chat/rooms/r1/messages?limit=25');
  });

  it('returns an empty list instead of throwing when the request fails', async () => {
    // The page renders this straight into a list; an exception would take the
    // whole chat view down over one dropped request.
    get.mockRejectedValue(new Error('offline'));
    expect(await chatService.getRooms()).toEqual([]);
    expect(await chatService.getMessages('r1')).toEqual([]);
    expect(await chatService.searchMessages('graft')).toEqual([]);
  });

  it('does not retry a failed call into a permanent outage', async () => {
    // getRooms used to latch chat off for the rest of the session after one
    // failure — correct when the API did not exist, wrong now that it does.
    get.mockRejectedValueOnce(new Error('flaky wifi'));
    expect(await chatService.getRooms()).toEqual([]);

    get.mockResolvedValueOnce([{ id: 'r1', name: 'Ward 4', type: 'group', participants: [], unreadCount: 0 }]);
    const rooms = await chatService.getRooms();
    expect(rooms).toHaveLength(1);
  });

  it('does not search on an empty query', async () => {
    expect(await chatService.searchMessages('   ')).toEqual([]);
    expect(get).not.toHaveBeenCalled();
  });
});

describe('sending', () => {
  it('posts the message and returns it immediately for optimistic display', () => {
    post.mockResolvedValue({});
    chatService.initialize('7', 'Dr Okafor', 'registrar');

    const msg = chatService.sendMessage('r1', 'Graft take good', 'text');

    // Returned synchronously — the compose box must not wait on the ward's
    // connection before showing what was typed.
    expect(msg.content).toBe('Graft take good');
    expect(msg.roomId).toBe('r1');
    expect(msg.senderName).toBe('Dr Okafor');
  });

  it('sends the client-minted id so a retry cannot double-post', async () => {
    post.mockResolvedValue({});
    chatService.initialize('7', 'Dr Okafor', 'registrar');

    const msg = chatService.sendMessage('r1', 'Review at 4pm', 'text');
    await Promise.resolve();
    await Promise.resolve();

    const [endpoint, body] = post.mock.calls.find(c => String(c[0]).includes('/messages')) || [];
    expect(endpoint).toBe('/chat/rooms/r1/messages');
    expect(body.id).toBe(msg.id);
    expect(body.content).toBe('Review at 4pm');
  });

  it('raises an error rather than letting a failed send look delivered', async () => {
    // The message is already on screen. Staying silent would leave a clinician
    // believing an instruction was passed on when nothing was stored.
    const seen: any[] = [];
    const off = chatService.on('error', (e: any) => seen.push(e));

    post.mockRejectedValue(new Error('500 Internal Server Error'));
    chatService.initialize('7', 'Dr Okafor', 'registrar');
    chatService.sendMessage('r1', 'Nil by mouth from midnight', 'text');

    await new Promise(r => setTimeout(r, 0));
    expect(seen.some(e => e.scope === 'send')).toBe(true);
    off();
  });
});

describe('creating a room', () => {
  it('waits for the server before handing the room back', async () => {
    // The caller navigates into what this returns. A room that exists only on
    // this client shows an empty history and rejects every message posted to it.
    post.mockResolvedValue({ id: 'server-id', name: 'Burns MDT', type: 'group', participants: [], unreadCount: 0 });

    const room = await chatService.createRoom('Burns MDT', 'group', ['3', '9']);

    const [endpoint, body] = post.mock.calls[0];
    expect(endpoint).toBe('/chat/rooms');
    expect(body.name).toBe('Burns MDT');
    expect(body.participantIds).toEqual(['3', '9']);
    expect(room?.id).toBe('server-id');
  });

  it('returns null when the room could not be created', async () => {
    post.mockRejectedValue(new Error('403'));
    expect(await chatService.createRoom('Burns MDT', 'group', [])).toBeNull();
  });
});
