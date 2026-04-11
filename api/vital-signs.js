// Vital Signs API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS vital_signs (
      id SERIAL PRIMARY KEY,
      patient_id VARCHAR(100) NOT NULL,
      hospital_number VARCHAR(100),
      temperature DECIMAL(4,1),
      pulse INTEGER,
      bp_systolic INTEGER,
      bp_diastolic INTEGER,
      respiratory_rate INTEGER,
      spo2 INTEGER,
      weight DECIMAL(5,1),
      recorded_by VARCHAR(255),
      date TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    await ensureTable();

    if (req.method === 'GET') {
      const patientId = req.query.patientId;
      if (!patientId) return res.status(400).json({ error: 'patientId is required' });

      const result = await query(
        'SELECT * FROM vital_signs WHERE patient_id = $1 ORDER BY date ASC',
        [patientId]
      );
      return res.status(200).json({ vitals: result.rows });
    }

    if (req.method === 'POST') {
      const { patient_id, hospital_number, temperature, pulse, bp_systolic, bp_diastolic, respiratory_rate, spo2, weight, recorded_by, date } = req.body;

      if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

      const result = await query(
        `INSERT INTO vital_signs (patient_id, hospital_number, temperature, pulse, bp_systolic, bp_diastolic, respiratory_rate, spo2, weight, recorded_by, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [patient_id, hospital_number || null, temperature || null, pulse || null, bp_systolic || null, bp_diastolic || null, respiratory_rate || null, spo2 || null, weight || null, recorded_by || null, date || new Date().toISOString()]
      );
      return res.status(201).json({ vital: result.rows[0] });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Vital signs API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
