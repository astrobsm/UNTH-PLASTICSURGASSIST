// Consultant Comments API endpoint for Vercel serverless.
// Lets clinicians attach comments to an entity (investigation, encounter,
// clinical_image, vital_signs, ward_round). The client (src/utils/clinicalUtils.ts)
// POSTs a comment and GETs by ?entityType=&entityId=, with a localStorage fallback.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        return await listComments(url.searchParams, res);
      case 'POST':
        return await createComment(req.body, auth.user, res);
      case 'DELETE': {
        const id = url.searchParams.get('id');
        if (!id) return res.status(400).json({ error: 'id is required' });
        return await deleteComment(id, res);
      }
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Consultant Comments API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS consultant_comments (
      id VARCHAR(100) PRIMARY KEY,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(100) NOT NULL,
      comment TEXT NOT NULL,
      author_name VARCHAR(255),
      author_role VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_consultant_comments_entity ON consultant_comments(entity_type, entity_id);
  `);
  tableEnsured = true;
}

async function listComments(searchParams, res) {
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  if (!entityType || !entityId) {
    return res.status(400).json({ error: 'entityType and entityId are required' });
  }
  const result = await query(
    `SELECT id, entity_type, entity_id, comment, author_name, author_role, created_at
       FROM consultant_comments
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at DESC
      LIMIT 500`,
    [entityType, String(entityId)]
  );
  return res.status(200).json({ comments: result.rows });
}

async function createComment(body, user, res) {
  const b = typeof body === 'string' ? safeParse(body) : (body || {});
  const entity_type = b.entity_type || b.entityType;
  const entity_id = b.entity_id || b.entityId;
  const comment = (b.comment || '').trim();
  if (!entity_type || !entity_id || !comment) {
    return res.status(400).json({ error: 'entity_type, entity_id and comment are required' });
  }
  const id = b.id || `cc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const created_at = b.created_at || new Date().toISOString();
  const author_name = b.author_name || user?.full_name || user?.name || 'Unknown';
  const author_role = b.author_role || user?.role || '';

  const result = await query(
    `INSERT INTO consultant_comments (id, entity_type, entity_id, comment, author_name, author_role, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (id) DO UPDATE SET comment = EXCLUDED.comment
     RETURNING id, entity_type, entity_id, comment, author_name, author_role, created_at`,
    [id, entity_type, String(entity_id), comment, author_name, author_role, created_at]
  );
  return res.status(201).json(result.rows[0]);
}

async function deleteComment(id, res) {
  await query(`DELETE FROM consultant_comments WHERE id = $1`, [id]);
  return res.status(200).json({ success: true });
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
