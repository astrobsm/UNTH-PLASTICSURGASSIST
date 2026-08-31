/**
 * Departmental chat.
 *
 * WHAT WAS HERE BEFORE
 * Nothing. ChatRooms was a fully built interface over a service whose entire
 * transport was a WebSocket, and WebSockets do not exist on this platform —
 * chatService disables the socket on Vercel by design. So `sendMessage`,
 * `createRoom` and `joinRoom` all wrote into a socket that was never open, and
 * the three GET endpoints the service polled had no handler at all. The service
 * latches itself off after the first failure, which turned a broken feature
 * into an empty one: rooms that never appeared and messages that vanished.
 *
 * WHY HTTP RATHER THAN A SOCKET
 * Serverless functions cannot hold a connection open, so there is no socket to
 * be had here. Chat is therefore request/response, and the client polls while a
 * room is open. That is a worse fit for typing indicators and presence, and a
 * perfectly good one for what this is actually used for — a ward passing
 * messages about patients, where a few seconds of latency costs nothing.
 *
 * ROUTES (vercel.json sends every /api/chat/* subpath here)
 *   GET  /chat/rooms                     rooms this user belongs to
 *   POST /chat/rooms                     create a room
 *   GET  /chat/rooms/:id/messages        history, newest last
 *   POST /chat/rooms/:id/messages        send
 *   POST /chat/rooms/:id/read            mark read up to now
 *   GET  /chat/messages/search           search this user's rooms
 *   GET  /chat/attachments/:id           one attachment's bytes
 *
 * The client's types are camelCase and apiClient returns the body unchanged, so
 * every row is mapped explicitly on the way out. Returning snake_case here
 * would leave the interface rendering blank names and "Invalid Date" — the
 * failure this codebase has already had more than once.
 */

import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

/** Attachments are base64 on the wire; keep one message inside the body limit. */
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;
const MAX_CONTENT_CHARS = 8000;
const DEFAULT_PAGE = 50;
const MAX_PAGE = 200;

let ready = false;

async function ensureTables() {
  if (ready) return;
  await query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id            VARCHAR(64) PRIMARY KEY,
      name          VARCHAR(200) NOT NULL,
      type          VARCHAR(20)  NOT NULL DEFAULT 'group',
      patient_id    INTEGER,
      created_by    INTEGER,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS chat_participants (
      room_id       VARCHAR(64) NOT NULL,
      user_id       INTEGER NOT NULL,
      joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_read_at  TIMESTAMPTZ,
      PRIMARY KEY (room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id            VARCHAR(64) PRIMARY KEY,
      room_id       VARCHAR(64) NOT NULL,
      sender_id     INTEGER,
      sender_name   VARCHAR(160),
      sender_role   VARCHAR(60),
      content       TEXT,
      type          VARCHAR(20) NOT NULL DEFAULT 'text',
      attachment_id INTEGER,
      file_name     VARCHAR(255),
      file_size     INTEGER,
      reply_to      VARCHAR(64),
      reactions     JSONB NOT NULL DEFAULT '{}',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      edited_at     TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS chat_attachments (
      id            SERIAL PRIMARY KEY,
      room_id       VARCHAR(64) NOT NULL,
      mime_type     VARCHAR(120) NOT NULL DEFAULT 'application/octet-stream',
      bytes         INTEGER NOT NULL DEFAULT 0,
      data          BYTEA,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);
  `);
  ready = true;
}

// ── Row → the client's camelCase shapes ─────────────────────────────────────

function toMessage(r) {
  return {
    id: r.id,
    roomId: r.room_id,
    senderId: r.sender_id == null ? '' : String(r.sender_id),
    senderName: r.sender_name || 'Unknown',
    senderRole: r.sender_role || '',
    content: r.content || '',
    type: r.type || 'text',
    fileUrl: r.attachment_id ? `/chat/attachments/${r.attachment_id}` : undefined,
    fileName: r.file_name || undefined,
    fileSize: r.file_size || undefined,
    replyTo: r.reply_to || undefined,
    reactions: r.reactions || {},
    timestamp: r.created_at,
    isRead: Boolean(r.is_read),
    isEdited: Boolean(r.edited_at),
    editedAt: r.edited_at || undefined,
  };
}

function toRoom(r, participants, lastMessage) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    participants,
    lastMessage,
    unreadCount: Number(r.unread_count || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patientId: r.patient_id == null ? undefined : String(r.patient_id),
    isActive: r.is_active !== false,
  };
}

/** Membership is the authorisation boundary — every room route goes through it. */
async function isMember(roomId, userId) {
  const r = await query(
    'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  return r.rows.length > 0;
}

// ── Handlers ────────────────────────────────────────────────────────────────

async function listRooms(userId, res) {
  const rooms = await query(
    `SELECT r.*,
            (SELECT COUNT(*) FROM chat_messages m
              WHERE m.room_id = r.id
                AND m.sender_id <> $1
                AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
            ) AS unread_count
       FROM chat_rooms r
       JOIN chat_participants p ON p.room_id = r.id AND p.user_id = $1
      WHERE r.is_active
      ORDER BY r.updated_at DESC`,
    [userId]
  );
  if (!rooms.rows.length) return res.status(200).json([]);

  const ids = rooms.rows.map(r => r.id);

  const people = await query(
    `SELECT p.room_id, u.id, u.full_name, u.role
       FROM chat_participants p
       JOIN users u ON u.id = p.user_id
      WHERE p.room_id = ANY($1::varchar[])`,
    [ids]
  );
  const byRoom = new Map();
  for (const p of people.rows) {
    if (!byRoom.has(p.room_id)) byRoom.set(p.room_id, []);
    byRoom.get(p.room_id).push({
      id: String(p.id),
      name: p.full_name || 'Unknown',
      role: p.role || '',
      // Presence needs a live connection, which serverless cannot hold. Saying
      // "offline" is honest; inventing a green dot would not be.
      isOnline: false,
      isTyping: false,
    });
  }

  const latest = await query(
    `SELECT DISTINCT ON (room_id) *
       FROM chat_messages
      WHERE room_id = ANY($1::varchar[])
      ORDER BY room_id, created_at DESC`,
    [ids]
  );
  const lastByRoom = new Map(latest.rows.map(m => [m.room_id, toMessage(m)]));

  return res.status(200).json(
    rooms.rows.map(r => toRoom(r, byRoom.get(r.id) || [], lastByRoom.get(r.id)))
  );
}

async function createRoom(body, user, res) {
  const name = String(body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const type = ['direct', 'group', 'conference', 'patient'].includes(body?.type)
    ? body.type
    : 'group';

  const id = String(body?.id || '').trim() ||
    `chat-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  await query(
    `INSERT INTO chat_rooms (id, name, type, patient_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, type, body?.patientId ? Number(body.patientId) : null, user.id]
  );

  // The creator is always a participant; without that they could create a room
  // and immediately not see it.
  const participantIds = Array.isArray(body?.participantIds) ? body.participantIds : [];
  const members = [...new Set([user.id, ...participantIds.map(Number)])]
    .filter(n => Number.isFinite(n));

  for (const uid of members) {
    await query(
      `INSERT INTO chat_participants (room_id, user_id) VALUES ($1, $2)
       ON CONFLICT (room_id, user_id) DO NOTHING`,
      [id, uid]
    );
  }

  const r = await query('SELECT * FROM chat_rooms WHERE id = $1', [id]);
  return res.status(201).json(toRoom(r.rows[0], [], undefined));
}

async function listMessages(roomId, url, userId, res) {
  if (!(await isMember(roomId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this room' });
  }

  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get('limit') || String(DEFAULT_PAGE), 10) || DEFAULT_PAGE, 1),
    MAX_PAGE
  );
  const before = url.searchParams.get('before');

  const args = [roomId, userId];
  const P_ROOM = 1;
  const P_USER = 2;

  let cursor = '';
  if (before) {
    args.push(before);
    cursor = ` AND m.created_at < (SELECT created_at FROM chat_messages WHERE id = $${args.length})`;
  }
  args.push(limit);
  const P_LIMIT = args.length;

  // Newest first so the limit takes the most recent page, then reversed — a
  // transcript read bottom-up is not a transcript.
  const r = await query(
    `SELECT m.*, (p.last_read_at IS NOT NULL AND m.created_at <= p.last_read_at) AS is_read
       FROM chat_messages m
       LEFT JOIN chat_participants p ON p.room_id = m.room_id AND p.user_id = $${P_USER}
      WHERE m.room_id = $${P_ROOM}${cursor}
      ORDER BY m.created_at DESC
      LIMIT $${P_LIMIT}`,
    args
  );
  return res.status(200).json(r.rows.reverse().map(toMessage));
}

async function postMessage(roomId, body, user, res) {
  if (!(await isMember(roomId, user.id))) {
    return res.status(403).json({ error: 'Not a participant in this room' });
  }

  const type = ['text', 'file', 'image', 'system', 'reaction'].includes(body?.type)
    ? body.type
    : 'text';

  let content = typeof body?.content === 'string' ? body.content : '';
  let attachmentId = null;

  // A file arrives as a data URL in `content`. Storing megabytes of base64 in
  // the messages table would make every history read carry them, so the bytes
  // go to their own table and the message keeps a reference.
  if (type === 'file' || type === 'image') {
    const m = /^data:([^;]+);base64,(.*)$/s.exec(content);
    if (!m) return res.status(400).json({ error: 'File messages need a data URL in content' });
    const buffer = Buffer.from(m[2], 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'Attachment decoded to no bytes' });
    if (buffer.length > MAX_ATTACHMENT_BYTES) {
      return res.status(413).json({ error: `Attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes` });
    }
    const a = await query(
      `INSERT INTO chat_attachments (room_id, mime_type, bytes, data)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [roomId, m[1], buffer.length, buffer]
    );
    attachmentId = a.rows[0].id;
    content = '';
  } else {
    if (!content.trim()) return res.status(400).json({ error: 'content is required' });
    if (content.length > MAX_CONTENT_CHARS) content = content.slice(0, MAX_CONTENT_CHARS);
  }

  const id = String(body?.id || '').trim() ||
    `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  // ON CONFLICT DO NOTHING: the client mints the id, so a retry after a dropped
  // response must not post the message twice.
  await query(
    `INSERT INTO chat_messages
       (id, room_id, sender_id, sender_name, sender_role, content, type,
        attachment_id, file_name, file_size, reply_to)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO NOTHING`,
    [
      // The JWT carries `fullName`; the users table spells it `full_name`.
      // Both are accepted so a token issued by either shape still names its
      // sender rather than leaving the message attributed to "Unknown".
      id, roomId, user.id, user.fullName || user.full_name || null, user.role || null,
      content, type, attachmentId,
      body?.fileName || null, body?.fileSize || null, body?.replyTo || null,
    ]
  );
  await query('UPDATE chat_rooms SET updated_at = NOW() WHERE id = $1', [roomId]);

  const r = await query('SELECT * FROM chat_messages WHERE id = $1', [id]);
  return res.status(201).json(toMessage(r.rows[0]));
}

async function markRead(roomId, userId, res) {
  if (!(await isMember(roomId, userId))) {
    return res.status(403).json({ error: 'Not a participant in this room' });
  }
  await query(
    'UPDATE chat_participants SET last_read_at = NOW() WHERE room_id = $1 AND user_id = $2',
    [roomId, userId]
  );
  return res.status(200).json({ ok: true });
}

async function searchMessages(url, userId, res) {
  const q = (url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
  if (!q) return res.status(200).json([]);

  const roomId = url.searchParams.get('roomId');
  const args = [userId, `%${q}%`];
  let scope = '';
  if (roomId) {
    args.push(roomId);
    scope = ` AND m.room_id = $${args.length}`;
  }

  // Joined against this user's memberships, so a search can never reach a room
  // they are not in.
  const r = await query(
    `SELECT m.*
       FROM chat_messages m
       JOIN chat_participants p ON p.room_id = m.room_id AND p.user_id = $1
      WHERE m.content ILIKE $2${scope}
      ORDER BY m.created_at DESC
      LIMIT 100`,
    args
  );
  return res.status(200).json(r.rows.map(toMessage));
}

async function getAttachment(attachmentId, userId, res) {
  const r = await query(
    `SELECT a.*
       FROM chat_attachments a
       JOIN chat_participants p ON p.room_id = a.room_id AND p.user_id = $2
      WHERE a.id = $1`,
    [Number(attachmentId), userId]
  );
  const row = r.rows[0];
  if (!row) return res.status(404).json({ error: 'No such attachment' });
  return res.status(200).json({
    id: row.id,
    mimeType: row.mime_type,
    bytes: row.bytes,
    dataBase64: Buffer.from(row.data).toString('base64'),
  });
}

// ── Dispatch ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });

  try {
    await ensureTables();

    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.replace(/^\/api\/chat/, '').split('/').filter(Boolean);
    const userId = auth.user.id;

    // /rooms …
    if (parts[0] === 'rooms') {
      if (parts.length === 1) {
        if (req.method === 'GET') return await listRooms(userId, res);
        if (req.method === 'POST') return await createRoom(req.body, auth.user, res);
        return res.status(405).json({ error: 'Method not allowed' });
      }

      const roomId = parts[1];
      if (parts[2] === 'messages') {
        if (req.method === 'GET') return await listMessages(roomId, url, userId, res);
        if (req.method === 'POST') return await postMessage(roomId, req.body, auth.user, res);
        return res.status(405).json({ error: 'Method not allowed' });
      }
      if (parts[2] === 'read' && req.method === 'POST') {
        return await markRead(roomId, userId, res);
      }
    }

    if (parts[0] === 'messages' && parts[1] === 'search' && req.method === 'GET') {
      return await searchMessages(url, userId, res);
    }

    if (parts[0] === 'attachments' && parts[1] && req.method === 'GET') {
      return await getAttachment(parts[1], userId, res);
    }

    return res.status(404).json({ error: 'No such chat route' });
  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
