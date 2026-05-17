// Blood Glucose Monitoring API endpoint for Vercel serverless
// Stores fasting (FBG) and random (RBG) blood glucose readings per patient.
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
  const pathParts = url.pathname.replace('/api/blood-glucose', '').split('/').filter(Boolean);
  const entryId = pathParts[0];

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        if (entryId) return await getEntry(entryId, res);
        return await getAllEntries(url.searchParams, res);
      case 'POST':
        return await createEntry(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });
        return await updateEntry(entryId, req.body, res);
      case 'DELETE':
        if (!entryId) return res.status(400).json({ error: 'Entry ID required' });
        return await deleteEntry(entryId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Blood Glucose API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS blood_glucose (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL,
        hospital_number VARCHAR(50),
        reading_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reading_time TIME NOT NULL DEFAULT CURRENT_TIME,
        fbg_mmol DECIMAL(5,2),
        rbg_mmol DECIMAL(5,2),
        unit VARCHAR(10) DEFAULT 'mmol/L',
        notes TEXT,
        recorded_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_blood_glucose_patient ON blood_glucose(patient_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_blood_glucose_patient_date ON blood_glucose(patient_id, reading_date DESC, reading_time DESC)`);
  } catch (err) {
    if (!err.message?.includes('already exists')) throw err;
  }
  tableEnsured = true;
}

async function getAllEntries(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const since = searchParams.get('since');
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  let queryStr = `SELECT * FROM blood_glucose WHERE 1=1`;
  const params = [];
  let p = 1;

  if (patientId) { queryStr += ` AND patient_id = $${p++}`; params.push(parseInt(patientId, 10)); }
  if (fromDate)  { queryStr += ` AND reading_date >= $${p++}`; params.push(fromDate); }
  if (toDate)    { queryStr += ` AND reading_date <= $${p++}`; params.push(toDate); }
  if (since)     { queryStr += ` AND updated_at > $${p++}`; params.push(new Date(since)); }

  queryStr += ` ORDER BY reading_date DESC, reading_time DESC LIMIT 500`;
  const result = await query(queryStr, params);
  res.status(200).json({ entries: result.rows });
}

async function getEntry(id, res) {
  const result = await query('SELECT * FROM blood_glucose WHERE id = $1', [parseInt(id, 10)]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(200).json({ entry: result.rows[0] });
}

async function createEntry(body, user, res) {
  const {
    patient_id, hospital_number, reading_date, reading_time,
    fbg_mmol, rbg_mmol, unit, notes, recorded_by
  } = body;

  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });
  if (fbg_mmol == null && rbg_mmol == null) {
    return res.status(400).json({ error: 'At least one of fbg_mmol or rbg_mmol is required' });
  }

  const authorName = recorded_by || (user && user.full_name) || 'Unknown';
  const result = await query(
    `INSERT INTO blood_glucose
       (patient_id, hospital_number, reading_date, reading_time, fbg_mmol, rbg_mmol, unit, notes, recorded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      parseInt(patient_id, 10),
      hospital_number || null,
      reading_date || new Date().toISOString().split('T')[0],
      reading_time || new Date().toTimeString().slice(0, 8),
      fbg_mmol != null && fbg_mmol !== '' ? parseFloat(fbg_mmol) : null,
      rbg_mmol != null && rbg_mmol !== '' ? parseFloat(rbg_mmol) : null,
      unit || 'mmol/L',
      notes || null,
      authorName
    ]
  );
  res.status(201).json({ entry: result.rows[0] });
}

async function updateEntry(id, body, res) {
  const { reading_date, reading_time, fbg_mmol, rbg_mmol, unit, notes } = body;
  const result = await query(
    `UPDATE blood_glucose SET
       reading_date = COALESCE($1, reading_date),
       reading_time = COALESCE($2, reading_time),
       fbg_mmol     = COALESCE($3, fbg_mmol),
       rbg_mmol     = COALESCE($4, rbg_mmol),
       unit         = COALESCE($5, unit),
       notes        = COALESCE($6, notes),
       updated_at   = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING *`,
    [
      reading_date || null,
      reading_time || null,
      fbg_mmol != null && fbg_mmol !== '' ? parseFloat(fbg_mmol) : null,
      rbg_mmol != null && rbg_mmol !== '' ? parseFloat(rbg_mmol) : null,
      unit || null,
      notes || null,
      parseInt(id, 10)
    ]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(200).json({ entry: result.rows[0] });
}

async function deleteEntry(id, res) {
  const result = await query('DELETE FROM blood_glucose WHERE id = $1 RETURNING id', [parseInt(id, 10)]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });
  res.status(200).json({ message: 'Entry deleted', id: result.rows[0].id });
}
