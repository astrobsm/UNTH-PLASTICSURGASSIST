// Risk Assessments API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS risk_assessments (
      id SERIAL PRIMARY KEY,
      patient_id VARCHAR(100) NOT NULL,
      assessment_type VARCHAR(50) NOT NULL,
      assessment_data JSONB NOT NULL DEFAULT '{}',
      total_score INTEGER,
      risk_level VARCHAR(30),
      recommendations TEXT,
      assessed_by VARCHAR(255),
      assessed_at TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Index for fast patient lookup
  try {
    await query('CREATE INDEX IF NOT EXISTS idx_risk_assessments_patient ON risk_assessments(patient_id)');
  } catch (e) { /* index may already exist */ }
}

function transformAssessment(row) {
  let data = row.assessment_data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  return {
    id: row.id,
    patient_id: row.patient_id,
    assessment_type: row.assessment_type,
    assessment_data: data,
    total_score: row.total_score,
    risk_level: row.risk_level,
    recommendations: row.recommendations,
    assessed_by: row.assessed_by,
    assessed_at: row.assessed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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
    const pathParts = url.pathname.replace('/api/risk-assessments', '').split('/').filter(Boolean);
    const assessmentId = pathParts[0];

    switch (method) {
      case 'GET': {
        const patientId = url.searchParams.get('patientId');
        const type = url.searchParams.get('type');
        const since = url.searchParams.get('since');

        if (assessmentId) {
          const result = await query('SELECT * FROM risk_assessments WHERE id = $1', [assessmentId]);
          if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Assessment not found' });
          }
          return res.status(200).json({ assessment: transformAssessment(result.rows[0]) });
        }

        let sql = 'SELECT * FROM risk_assessments WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (patientId) {
          sql += ` AND patient_id = $${paramCount}`;
          params.push(patientId);
          paramCount++;
        }
        if (type) {
          sql += ` AND assessment_type = $${paramCount}`;
          params.push(type);
          paramCount++;
        }
        if (since) {
          sql += ` AND updated_at > $${paramCount}`;
          params.push(since);
          paramCount++;
        }
        sql += ' ORDER BY created_at DESC';

        const result = await query(sql, params);
        return res.status(200).json({ assessments: result.rows.map(transformAssessment) });
      }

      case 'POST': {
        const { patient_id, assessment_type, assessment_data, total_score, risk_level, recommendations, assessed_by } = req.body;

        if (!patient_id || !assessment_type) {
          return res.status(400).json({ error: 'patient_id and assessment_type are required' });
        }

        // Upsert: replace existing assessment of same type for same patient
        const existing = await query(
          'SELECT id FROM risk_assessments WHERE patient_id = $1 AND assessment_type = $2',
          [patient_id, assessment_type]
        );

        let result;
        if (existing.rows.length > 0) {
          result = await query(
            `UPDATE risk_assessments SET 
              assessment_data = $1, total_score = $2, risk_level = $3, 
              recommendations = $4, assessed_by = $5, updated_at = NOW()
             WHERE patient_id = $6 AND assessment_type = $7
             RETURNING *`,
            [
              JSON.stringify(assessment_data || {}),
              total_score || null,
              risk_level || null,
              recommendations || null,
              assessed_by || auth.user.name || null,
              patient_id,
              assessment_type
            ]
          );
        } else {
          result = await query(
            `INSERT INTO risk_assessments (patient_id, assessment_type, assessment_data, total_score, risk_level, recommendations, assessed_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
              patient_id,
              assessment_type,
              JSON.stringify(assessment_data || {}),
              total_score || null,
              risk_level || null,
              recommendations || null,
              assessed_by || auth.user.name || null
            ]
          );
        }

        return res.status(201).json({ assessment: transformAssessment(result.rows[0]) });
      }

      case 'PUT':
      case 'PATCH': {
        if (!assessmentId) {
          return res.status(400).json({ error: 'Assessment ID required' });
        }
        const body = req.body;
        const fields = [];
        const values = [];
        let pc = 1;

        const updatableFields = ['assessment_data', 'total_score', 'risk_level', 'recommendations', 'assessed_by'];
        for (const f of updatableFields) {
          if (body[f] !== undefined) {
            fields.push(`${f} = $${pc}`);
            values.push(f === 'assessment_data' ? JSON.stringify(body[f]) : body[f]);
            pc++;
          }
        }

        if (fields.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        fields.push('updated_at = NOW()');
        values.push(assessmentId);

        const result = await query(
          `UPDATE risk_assessments SET ${fields.join(', ')} WHERE id = $${pc} RETURNING *`,
          values
        );

        if (result.rows.length === 0) {
          return res.status(404).json({ error: 'Assessment not found' });
        }
        return res.status(200).json({ assessment: transformAssessment(result.rows[0]) });
      }

      case 'DELETE': {
        if (!assessmentId) {
          return res.status(400).json({ error: 'Assessment ID required' });
        }
        await query('DELETE FROM risk_assessments WHERE id = $1', [assessmentId]);
        return res.status(200).json({ message: 'Assessment deleted' });
      }

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Risk assessments API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
