// Progress Notes API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { idempotent, rememberResponse } from './_lib/idempotency.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/progress-notes', '').split('/').filter(Boolean);
  const noteId = pathParts[0];

  try {
    // Ensure table exists
    await ensureTable();

    switch (method) {
      case 'GET':
        if (noteId) {
          return await getProgressNote(noteId, res);
        }
        return await getAllProgressNotes(url.searchParams, res);
      case 'POST':
        if (await idempotent(req, res, auth.user)) return;
        return await createProgressNote(req.body, auth.user, req, res);
      case 'PUT':
      case 'PATCH':
        if (!noteId) {
          return res.status(400).json({ error: 'Note ID required' });
        }
        return await updateProgressNote(noteId, req.body, res);
      case 'DELETE':
        if (!noteId) {
          return res.status(400).json({ error: 'Note ID required' });
        }
        return await deleteProgressNote(noteId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Progress Notes API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS progress_notes (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER,
      patient_name VARCHAR(255),
      author VARCHAR(255),
      author_role VARCHAR(100),
      date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      vital_signs JSONB DEFAULT '{}',
      lmp VARCHAR(100),
      soap JSONB DEFAULT '{}',
      clinical_images JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'active',
      geolocation JSONB DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_progress_notes_patient ON progress_notes(patient_id);
    CREATE INDEX IF NOT EXISTS idx_progress_notes_date ON progress_notes(date DESC);
    CREATE INDEX IF NOT EXISTS idx_progress_notes_author ON progress_notes(author);
  `);
  // Add columns if table already existed without them
  try {
    await query(`ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS clinical_images JSONB DEFAULT '[]'`);
  } catch(e) { /* column may already exist */ }
  try {
    await query(`ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS geolocation JSONB DEFAULT NULL`);
  } catch(e) { /* column may already exist */ }
  try {
    await query(`ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'progress_note'`);
  } catch(e) { /* column may already exist */ }
  // Backfill type from soap JSON for existing records
  try {
    await query(`UPDATE progress_notes SET type = soap->>'type' WHERE type IS NULL AND soap->>'type' IS NOT NULL`);
  } catch(e) { /* ok */ }
  tableEnsured = true;
}

async function getAllProgressNotes(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const since = searchParams.get('since');

  let queryStr = `SELECT * FROM progress_notes WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND patient_id = $${paramCount++}`;
    params.push(parseInt(patientId, 10));
  }

  if (since) {
    queryStr += ` AND updated_at > $${paramCount++}`;
    params.push(new Date(since));
  }

  queryStr += ` ORDER BY date DESC LIMIT 500`;

  const result = await query(queryStr, params);
  res.status(200).json({ notes: result.rows });
}

async function getProgressNote(id, res) {
  const result = await query('SELECT * FROM progress_notes WHERE id = $1', [parseInt(id, 10)]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Progress note not found' });
  }
  res.status(200).json({ note: result.rows[0] });
}

async function createProgressNote(body, user, req, res) {
  const {
    patient_id, patient_name, author, author_role,
    date, vital_signs, lmp, soap, clinical_images, geolocation,
    created_by, content, type
  } = body;

  if (!patient_id) {
    return res.status(400).json({ error: 'patient_id is required' });
  }

  // Support both field naming conventions
  const authorName = author || created_by || (user && user.full_name) || 'Unknown';
  // Resolve encounter type
  const noteType = type || (soap && soap.type) || 'progress_note';
  // If content/type provided but soap not, build soap from them
  let soapData = soap || {};
  if (content && !soap) {
    soapData = { note: content, type: noteType };
  }

  const result = await query(
    `INSERT INTO progress_notes 
     (patient_id, patient_name, author, author_role, date, vital_signs, lmp, soap, clinical_images, geolocation, type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      parseInt(patient_id, 10),
      patient_name || null,
      authorName,
      author_role || (user && user.role) || 'Unknown',
      date ? new Date(date) : new Date(),
      JSON.stringify(vital_signs || {}),
      lmp || null,
      JSON.stringify(soapData),
      JSON.stringify(clinical_images || []),
      geolocation ? JSON.stringify(geolocation) : null,
      noteType
    ]
  );

  console.log(`Progress note created for patient ${patient_id} by ${authorName}`);
  const responseBody = { note: result.rows[0] };
  await rememberResponse(req, user, 201, responseBody);
  res.status(201).json(responseBody);
}

async function updateProgressNote(id, body, res) {
  const { vital_signs, lmp, soap, status } = body;

  const result = await query(
    `UPDATE progress_notes 
     SET vital_signs = COALESCE($1, vital_signs),
         lmp = COALESCE($2, lmp),
         soap = COALESCE($3, soap),
         status = COALESCE($4, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING *`,
    [
      vital_signs ? JSON.stringify(vital_signs) : null,
      lmp || null,
      soap ? JSON.stringify(soap) : null,
      status || null,
      parseInt(id, 10)
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Progress note not found' });
  }

  res.status(200).json({ note: result.rows[0] });
}

async function deleteProgressNote(id, res) {
  const result = await query('DELETE FROM progress_notes WHERE id = $1 RETURNING id', [parseInt(id, 10)]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Progress note not found' });
  }
  res.status(200).json({ success: true, id: result.rows[0].id });
}
