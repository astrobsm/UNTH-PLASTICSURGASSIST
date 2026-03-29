// MDT Documentation API endpoint - Co-managing team notes
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS mdt_documentation (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      team_name VARCHAR(255) NOT NULL,
      documenter_name VARCHAR(255),
      documenter_role VARCHAR(100),
      documentation_type VARCHAR(50) DEFAULT 'text',
      content TEXT NOT NULL,
      input_method VARCHAR(50) DEFAULT 'typed',
      created_by VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  await ensureTable();

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const params = url.searchParams;

  try {
    if (method === 'GET') {
      const patientId = params.get('patientId');
      if (!patientId) {
        return res.status(400).json({ error: 'patientId is required' });
      }

      const result = await query(
        `SELECT * FROM mdt_documentation 
         WHERE patient_id = $1 
         ORDER BY created_at DESC`,
        [parseInt(patientId, 10)]
      );
      return res.status(200).json({ documentation: result.rows });
    }

    if (method === 'POST') {
      const { patient_id, hospital_number, patient_name, team_name, documenter_name, documenter_role, documentation_type, content, input_method, created_by } = req.body;

      if (!patient_id || !team_name || !content) {
        return res.status(400).json({ error: 'patient_id, team_name, and content are required' });
      }

      const result = await query(
        `INSERT INTO mdt_documentation 
         (patient_id, hospital_number, patient_name, team_name, documenter_name, documenter_role, documentation_type, content, input_method, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          parseInt(patient_id, 10),
          hospital_number || '',
          patient_name || '',
          team_name,
          documenter_name || created_by || '',
          documenter_role || '',
          documentation_type || 'clinical_note',
          content,
          input_method || 'typed',
          created_by || auth.userId || ''
        ]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (method === 'DELETE') {
      const docId = params.get('id');
      if (!docId) {
        return res.status(400).json({ error: 'id is required' });
      }
      await query('DELETE FROM mdt_documentation WHERE id = $1', [parseInt(docId, 10)]);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('MDT Documentation API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
