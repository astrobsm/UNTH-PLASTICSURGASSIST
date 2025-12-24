// Wound Care Records API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/wound-care', '').split('/').filter(Boolean);
  const recordId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (recordId) {
          return await getWoundCareRecord(recordId, res);
        }
        return await getAllWoundCareRecords(url.searchParams, res);
      case 'POST':
        return await createWoundCareRecord(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!recordId) {
          return res.status(400).json({ error: 'Record ID required' });
        }
        return await updateWoundCareRecord(recordId, req.body, res);
      case 'DELETE':
        if (!recordId) {
          return res.status(400).json({ error: 'Record ID required' });
        }
        return await deleteWoundCareRecord(recordId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Wound Care API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllWoundCareRecords(searchParams, res) {
  const patientId = searchParams.get('patientId');

  let queryStr = `
    SELECT wcr.*, p.first_name, p.last_name, p.hospital_number
    FROM wound_care_records wcr
    LEFT JOIN patients p ON wcr.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND wcr.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  queryStr += ` ORDER BY wcr.recorded_at DESC`;

  const result = await query(queryStr, params);

  res.status(200).json({ woundCareRecords: result.rows });
}

async function getWoundCareRecord(id, res) {
  const result = await query(
    `SELECT wcr.*, p.first_name, p.last_name, p.hospital_number
     FROM wound_care_records wcr
     LEFT JOIN patients p ON wcr.patient_id = p.id
     WHERE wcr.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Wound care record not found' });
  }

  res.status(200).json({ woundCareRecord: result.rows[0] });
}

async function createWoundCareRecord(data, user, res) {
  const {
    patientId, woundLocation, woundType, woundSize, woundStage,
    treatmentProvided, dressingUsed, observations, nextDressingDate, images
  } = data;

  if (!patientId || !woundLocation) {
    return res.status(400).json({ error: 'Patient ID and wound location are required' });
  }

  const result = await query(
    `INSERT INTO wound_care_records (
      patient_id, wound_location, wound_type, wound_size, wound_stage,
      treatment_provided, dressing_used, observations, next_dressing_date,
      images, recorded_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      patientId, woundLocation, woundType, woundSize, woundStage,
      treatmentProvided, dressingUsed, observations, nextDressingDate,
      JSON.stringify(images || []), user.id
    ]
  );

  res.status(201).json({ woundCareRecord: result.rows[0] });
}

async function updateWoundCareRecord(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    woundLocation: 'wound_location',
    woundType: 'wound_type',
    woundSize: 'wound_size',
    woundStage: 'wound_stage',
    treatmentProvided: 'treatment_provided',
    dressingUsed: 'dressing_used',
    observations: 'observations',
    nextDressingDate: 'next_dressing_date',
    images: 'images'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(key === 'images' ? JSON.stringify(data[key]) : data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE wound_care_records SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Wound care record not found' });
  }

  res.status(200).json({ woundCareRecord: result.rows[0] });
}

async function deleteWoundCareRecord(id, res) {
  const result = await query('DELETE FROM wound_care_records WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Wound care record not found' });
  }

  res.status(200).json({ message: 'Wound care record deleted successfully' });
}
