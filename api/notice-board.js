// Notice Board API endpoints for cross-device sync
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

// Who may post, edit and remove notices — enforced here, not only by the page
// hiding its buttons (any signed-in user could previously overwrite or remove
// any notice, and set its author).
export const NOTICE_ROLES = ['admin', 'super_admin', 'consultant'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const authResult = authenticateRequest(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const { method } = req;
  const userId = authResult.user.id;
  const userRole = authResult.user.role;
  if (method !== 'GET' && !NOTICE_ROLES.includes(userRole)) {
    return res.status(403).json({ error: 'Only administrators and consultants can post or change notices' });
  }

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId);
      case 'POST':
        req.authUserName = authResult.user.fullName || '';
        return await handlePost(req, res, userId, userRole);
      case 'PUT':
        return await handlePut(req, res, userId, userRole);
      case 'DELETE':
        return await handleDelete(req, res, userId, userRole);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Notice Board API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId) {
  // Ensure table exists
  await ensureTable();

  const { category, since } = req.query;
  let sql = `SELECT * FROM notice_board WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())`;
  const params = [];

  if (category && category !== 'all') {
    params.push(category);
    sql += ` AND category = $${params.length}`;
  }

  if (since) {
    params.push(since);
    sql += ` AND updated_at > $${params.length}`;
  }

  sql += ` ORDER BY is_pinned DESC, created_at DESC`;

  const result = await query(sql, params);
  return res.status(200).json({ notices: result.rows });
}

async function handlePost(req, res, userId, userRole) {
  await ensureTable();

  const { id, title, category, content, is_pinned, expires_at } = req.body || {};
  // The author is whoever is signed in — never what the request says.
  const author = { id: String(userId), name: req.authUserName || '', role: userRole };

  if (!title || !content || !category) {
    return res.status(400).json({ error: 'Title, content and category are required' });
  }

  const result = await query(
    `INSERT INTO notice_board (id, title, category, content, posted_by, posted_by_name, posted_by_role, is_pinned, is_active, created_at, updated_at, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, NOW(), NOW(), $9)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       category = EXCLUDED.category,
       content = EXCLUDED.content,
       is_pinned = EXCLUDED.is_pinned,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()
     RETURNING *`,
    [id || crypto.randomUUID(), title, category, content, author.id, author.name, author.role, is_pinned || false, expires_at || null]
  );

  return res.status(201).json({ notice: result.rows[0] });
}

async function handlePut(req, res, userId, userRole) {
  await ensureTable();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Notice ID required' });

  const { title, category, content, is_pinned } = req.body;

  const result = await query(
    `UPDATE notice_board SET
       title = COALESCE($2, title),
       category = COALESCE($3, category),
       content = COALESCE($4, content),
       is_pinned = COALESCE($5, is_pinned),
       updated_at = NOW()
     WHERE id = $1 AND is_active = true
     RETURNING *`,
    [id, title, category, content, is_pinned]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Notice not found' });
  }

  return res.status(200).json({ notice: result.rows[0] });
}

async function handleDelete(req, res, userId, userRole) {
  await ensureTable();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Notice ID required' });

  await query(
    `UPDATE notice_board SET is_active = false, updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return res.status(200).json({ success: true });
}

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS notice_board (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      posted_by TEXT,
      posted_by_name TEXT,
      posted_by_role TEXT,
      is_pinned BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )
  `);
  try { await query(`ALTER TABLE notice_board ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`); } catch { /* exists */ }
}
