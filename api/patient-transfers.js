// Patient Transfers API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        return await getTransfers(req, res);
      case 'POST':
        return await createTransfer(req.body, auth.user, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Patient Transfers API error:', error);
    if (error.message && error.message.includes('does not exist')) {
      return res.status(200).json({ transfers: [] });
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS patient_transfers (
      id SERIAL PRIMARY KEY,
      patient_id VARCHAR(255),
      from_ward VARCHAR(255),
      to_ward VARCHAR(255),
      from_bed VARCHAR(100),
      to_bed VARCHAR(100),
      transfer_type VARCHAR(100),
      reason TEXT,
      authorized_by VARCHAR(255),
      receiving_team VARCHAR(255),
      status VARCHAR(50) DEFAULT 'completed',
      transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_patient_transfers_patient ON patient_transfers(patient_id);
    CREATE INDEX IF NOT EXISTS idx_patient_transfers_date ON patient_transfers(transfer_date DESC);
  `);
  tableEnsured = true;
}

async function getTransfers(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const patientId = url.searchParams.get('patientId');

  let queryStr = 'SELECT * FROM patient_transfers WHERE 1=1';
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND patient_id = $${paramCount++}`;
    params.push(patientId);
  }

  queryStr += ' ORDER BY transfer_date DESC LIMIT 200';

  const result = await query(queryStr, params);
  res.status(200).json({ transfers: result.rows });
}

async function createTransfer(data, user, res) {
  const result = await query(
    `INSERT INTO patient_transfers 
      (patient_id, from_ward, to_ward, from_bed, to_bed, transfer_type, reason, authorized_by, receiving_team, status, transfer_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      data.patient_id,
      data.from_ward || null,
      data.to_ward || null,
      data.from_bed || null,
      data.to_bed || null,
      data.transfer_type || 'ward_transfer',
      data.reason || null,
      data.authorized_by || user?.name || null,
      data.receiving_team || null,
      data.status || 'completed',
      data.transfer_date || new Date()
    ]
  );

  res.status(201).json({ transfer: result.rows[0] });
}
