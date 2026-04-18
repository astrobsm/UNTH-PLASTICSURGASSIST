// Surgery Planning API endpoint for Vercel serverless
// Stores pre-operative planning data for surgery booking register
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS surgery_planning (
      id SERIAL PRIMARY KEY,
      patient_id VARCHAR(100) NOT NULL,
      planning_data JSONB NOT NULL DEFAULT '{}',
      assessed_by VARCHAR(255),
      assessed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  try {
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_surgery_planning_patient ON surgery_planning(patient_id)');
  } catch (e) { /* index may already exist */ }
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    await ensureTable();
    const { method } = req;
    const url = new URL(req.url, `http://${req.headers.host}`);

    switch (method) {
      case 'GET': {
        const patientId = url.searchParams.get('patientId');
        const since = url.searchParams.get('since');

        if (!patientId) {
          return res.status(400).json({ error: 'patientId is required' });
        }

        const result = await query(
          'SELECT * FROM surgery_planning WHERE patient_id = $1',
          [patientId]
        );

        if (result.rows.length === 0) {
          return res.status(200).json({ planning: null });
        }

        const row = result.rows[0];
        let data = row.planning_data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { data = {}; }
        }

        return res.status(200).json({
          planning: {
            id: row.id,
            patient_id: row.patient_id,
            ...data,
            assessed_by: row.assessed_by,
            assessed_at: row.assessed_at,
            created_at: row.created_at,
            updated_at: row.updated_at
          }
        });
      }

      case 'POST':
      case 'PUT': {
        const { patient_id, assessed_by, ...planningFields } = req.body;

        if (!patient_id) {
          return res.status(400).json({ error: 'patient_id is required' });
        }

        // Remove non-data fields before storing in JSONB
        const planningData = { ...planningFields };
        delete planningData.id;
        delete planningData.created_at;
        delete planningData.updated_at;
        delete planningData.assessed_at;

        // Upsert: insert or update on conflict
        const result = await query(
          `INSERT INTO surgery_planning (patient_id, planning_data, assessed_by, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (patient_id) 
           DO UPDATE SET planning_data = $2, assessed_by = COALESCE($3, surgery_planning.assessed_by), updated_at = NOW()
           RETURNING *`,
          [patient_id, JSON.stringify(planningData), assessed_by || auth.user?.name || null]
        );

        const row = result.rows[0];
        let data = row.planning_data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { data = {}; }
        }

        return res.status(200).json({
          planning: {
            id: row.id,
            patient_id: row.patient_id,
            ...data,
            assessed_by: row.assessed_by,
            assessed_at: row.assessed_at,
            created_at: row.created_at,
            updated_at: row.updated_at
          }
        });
      }

      case 'DELETE': {
        const patientId = url.searchParams.get('patientId');
        if (!patientId) {
          return res.status(400).json({ error: 'patientId is required' });
        }
        await query('DELETE FROM surgery_planning WHERE patient_id = $1', [patientId]);
        return res.status(200).json({ message: 'Planning data deleted' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Surgery planning API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
