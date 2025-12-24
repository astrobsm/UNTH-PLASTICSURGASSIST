// Treatment Plans API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/treatment-plans', '').split('/').filter(Boolean);
  const planId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (planId) {
          return await getPlan(planId, res);
        }
        return await getAllPlans(url.searchParams, res);
      case 'POST':
        return await createPlan(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!planId) {
          return res.status(400).json({ error: 'Plan ID required' });
        }
        return await updatePlan(planId, req.body, res);
      case 'DELETE':
        if (!planId) {
          return res.status(400).json({ error: 'Plan ID required' });
        }
        return await deletePlan(planId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Treatment Plans API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllPlans(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  let queryStr = `
    SELECT tp.*, p.first_name, p.last_name, p.hospital_number
    FROM treatment_plans tp
    LEFT JOIN patients p ON tp.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND tp.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  if (status) {
    queryStr += ` AND tp.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  queryStr += ` ORDER BY tp.created_at DESC`;

  const result = await query(queryStr, params);

  res.status(200).json({ treatmentPlans: result.rows });
}

async function getPlan(id, res) {
  const result = await query(
    `SELECT tp.*, p.first_name, p.last_name, p.hospital_number
     FROM treatment_plans tp
     LEFT JOIN patients p ON tp.patient_id = p.id
     WHERE tp.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Treatment plan not found' });
  }

  res.status(200).json({ treatmentPlan: result.rows[0] });
}

async function createPlan(data, user, res) {
  const {
    patientId, diagnosis, treatmentType, description, objectives,
    procedures, medications, followUpSchedule, notes, status = 'draft'
  } = data;

  if (!patientId || !diagnosis) {
    return res.status(400).json({ error: 'Patient ID and diagnosis are required' });
  }

  const result = await query(
    `INSERT INTO treatment_plans (
      patient_id, diagnosis, treatment_type, description, objectives,
      procedures, medications, follow_up_schedule, notes, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      patientId, diagnosis, treatmentType, description, 
      JSON.stringify(objectives || []),
      JSON.stringify(procedures || []),
      JSON.stringify(medications || []),
      JSON.stringify(followUpSchedule || []),
      notes, status, user.id
    ]
  );

  res.status(201).json({ treatmentPlan: result.rows[0] });
}

async function updatePlan(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    diagnosis: 'diagnosis',
    treatmentType: 'treatment_type',
    description: 'description',
    objectives: 'objectives',
    procedures: 'procedures',
    medications: 'medications',
    followUpSchedule: 'follow_up_schedule',
    notes: 'notes',
    status: 'status'
  };

  const jsonFields = ['objectives', 'procedures', 'medications', 'followUpSchedule'];

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(jsonFields.includes(key) ? JSON.stringify(data[key]) : data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE treatment_plans SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Treatment plan not found' });
  }

  res.status(200).json({ treatmentPlan: result.rows[0] });
}

async function deletePlan(id, res) {
  const result = await query('DELETE FROM treatment_plans WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Treatment plan not found' });
  }

  res.status(200).json({ message: 'Treatment plan deleted successfully' });
}
