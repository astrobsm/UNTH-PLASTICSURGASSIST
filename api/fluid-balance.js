// Fluid Balance API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/fluid-balance', '').split('/').filter(Boolean);
  const entryId = pathParts[0];

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        if (entryId) {
          return await getEntry(entryId, res);
        }
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
    console.error('Fluid Balance API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS fluid_balance (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      hospital_number VARCHAR(50),
      chart_date DATE NOT NULL DEFAULT CURRENT_DATE,
      recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('input', 'output')),
      fluid_type VARCHAR(100) NOT NULL,
      volume_ml INTEGER NOT NULL DEFAULT 0,
      route VARCHAR(50),
      notes TEXT,
      recorded_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_fluid_balance_patient ON fluid_balance(patient_id);
    CREATE INDEX IF NOT EXISTS idx_fluid_balance_date ON fluid_balance(chart_date DESC);
    CREATE INDEX IF NOT EXISTS idx_fluid_balance_patient_date ON fluid_balance(patient_id, chart_date);
  `);
  tableEnsured = true;
}

async function getAllEntries(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const chartDate = searchParams.get('chartDate');
  const since = searchParams.get('since');

  let queryStr = `SELECT * FROM fluid_balance WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND patient_id = $${paramCount++}`;
    params.push(parseInt(patientId, 10));
  }
  if (chartDate) {
    queryStr += ` AND chart_date = $${paramCount++}`;
    params.push(chartDate);
  }
  if (since) {
    queryStr += ` AND updated_at > $${paramCount++}`;
    params.push(new Date(since));
  }

  queryStr += ` ORDER BY chart_date DESC, recorded_at ASC LIMIT 500`;

  const result = await query(queryStr, params);
  res.status(200).json({ entries: result.rows });
}

async function getEntry(id, res) {
  const result = await query('SELECT * FROM fluid_balance WHERE id = $1', [parseInt(id, 10)]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Fluid balance entry not found' });
  }
  res.status(200).json({ entry: result.rows[0] });
}

async function createEntry(body, user, res) {
  const {
    patient_id, hospital_number, chart_date, recorded_at,
    entry_type, fluid_type, volume_ml, route, notes, recorded_by
  } = body;

  if (!patient_id || !entry_type || !fluid_type) {
    return res.status(400).json({ error: 'patient_id, entry_type, and fluid_type are required' });
  }

  if (!['input', 'output'].includes(entry_type)) {
    return res.status(400).json({ error: 'entry_type must be "input" or "output"' });
  }

  const authorName = recorded_by || (user && user.full_name) || 'Unknown';

  const result = await query(
    `INSERT INTO fluid_balance 
     (patient_id, hospital_number, chart_date, recorded_at, entry_type, fluid_type, volume_ml, route, notes, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      parseInt(patient_id, 10),
      hospital_number || null,
      chart_date || new Date().toISOString().split('T')[0],
      recorded_at ? new Date(recorded_at) : new Date(),
      entry_type,
      fluid_type,
      parseInt(volume_ml, 10) || 0,
      route || null,
      notes || null,
      authorName
    ]
  );

  res.status(201).json({ entry: result.rows[0] });
}

async function updateEntry(id, body, res) {
  const { entry_type, fluid_type, volume_ml, route, notes } = body;

  const result = await query(
    `UPDATE fluid_balance 
     SET entry_type = COALESCE($1, entry_type),
         fluid_type = COALESCE($2, fluid_type),
         volume_ml = COALESCE($3, volume_ml),
         route = COALESCE($4, route),
         notes = COALESCE($5, notes),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $6
     RETURNING *`,
    [
      entry_type || null,
      fluid_type || null,
      volume_ml != null ? parseInt(volume_ml, 10) : null,
      route || null,
      notes || null,
      parseInt(id, 10)
    ]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Fluid balance entry not found' });
  }
  res.status(200).json({ entry: result.rows[0] });
}

async function deleteEntry(id, res) {
  const result = await query('DELETE FROM fluid_balance WHERE id = $1 RETURNING id', [parseInt(id, 10)]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  res.status(200).json({ message: 'Entry deleted', id: result.rows[0].id });
}
