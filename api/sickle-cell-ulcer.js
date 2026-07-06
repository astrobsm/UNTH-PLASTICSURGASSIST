// Sickle Cell Ulcer Care API — Vercel serverless.
// Stores optimization assessments (hydration, nutrition, haematologic, wound bed,
// etc.) with a computed readiness score and a wound-care plan per patient.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

let tableEnsured = false;
async function ensureTable() {
  if (tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS sickle_cell_ulcer_assessments (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(255) NOT NULL,
        patient_name VARCHAR(255),
        hospital_number VARCHAR(100),
        scores JSONB NOT NULL DEFAULT '{}',
        total_score INTEGER DEFAULT 0,
        max_score INTEGER DEFAULT 0,
        readiness VARCHAR(30),
        wound_bed VARCHAR(60),
        wound_agents JSONB DEFAULT '[]',
        recommendations JSONB DEFAULT '[]',
        notes TEXT,
        assessed_by VARCHAR(180),
        assessed_by_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_scu_patient ON sickle_cell_ulcer_assessments(patient_id, created_at DESC)`);
  } catch (e) { console.warn('ensureTable scu:', e.message); }
  tableEnsured = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });

  await ensureTable();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const patientId = url.searchParams.get('patientId');

  try {
    if (req.method === 'GET') {
      if (!patientId) return res.status(400).json({ error: 'patientId is required' });
      const r = await query(
        `SELECT * FROM sickle_cell_ulcer_assessments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`,
        [String(patientId)]
      );
      return res.status(200).json({ assessments: r.rows });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.patient_id) return res.status(400).json({ error: 'patient_id is required' });
      const r = await query(
        `INSERT INTO sickle_cell_ulcer_assessments
           (patient_id, patient_name, hospital_number, scores, total_score, max_score,
            readiness, wound_bed, wound_agents, recommendations, notes, assessed_by, assessed_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING *`,
        [
          String(b.patient_id), b.patient_name || null, b.hospital_number || null,
          JSON.stringify(b.scores || {}), b.total_score || 0, b.max_score || 0,
          b.readiness || null, b.wound_bed || null,
          JSON.stringify(b.wound_agents || []), JSON.stringify(b.recommendations || []),
          b.notes || null,
          auth.user?.id != null ? String(auth.user.id) : null,
          auth.user?.fullName || auth.user?.email || null,
        ]
      );
      return res.status(201).json({ assessment: r.rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = url.searchParams.get('id');
      if (!id) return res.status(400).json({ error: 'id is required' });
      await query(`DELETE FROM sickle_cell_ulcer_assessments WHERE id = $1`, [parseInt(id, 10)]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('sickle-cell-ulcer error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
