// Surgeries/Booking API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/surgeries', '').split('/').filter(Boolean);
  const surgeryId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (surgeryId) {
          return await getSurgery(surgeryId, res);
        }
        return await getAllSurgeries(url.searchParams, res);
      case 'POST':
        return await createSurgery(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!surgeryId) {
          return res.status(400).json({ error: 'Surgery ID required' });
        }
        return await updateSurgery(surgeryId, req.body, res);
      case 'DELETE':
        if (!surgeryId) {
          return res.status(400).json({ error: 'Surgery ID required' });
        }
        return await deleteSurgery(surgeryId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Surgeries API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllSurgeries(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');
  const date = searchParams.get('date');

  let queryStr = `
    SELECT s.*, p.first_name, p.last_name, p.hospital_number
    FROM surgeries s
    LEFT JOIN patients p ON s.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND s.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  if (status) {
    queryStr += ` AND s.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  if (date) {
    queryStr += ` AND DATE(s.scheduled_date) = $${paramCount}`;
    params.push(date);
    paramCount++;
  }

  queryStr += ` ORDER BY s.scheduled_date DESC`;

  const result = await query(queryStr, params);

  res.status(200).json({ surgeries: result.rows });
}

async function getSurgery(id, res) {
  const result = await query(
    `SELECT s.*, p.first_name, p.last_name, p.hospital_number
     FROM surgeries s
     LEFT JOIN patients p ON s.patient_id = p.id
     WHERE s.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Surgery not found' });
  }

  res.status(200).json({ surgery: result.rows[0] });
}

async function createSurgery(data, user, res) {
  const {
    patientId, procedureName, procedureType, scheduledDate, estimatedDuration,
    surgeonId, anesthesiaType, operatingRoom, preOpNotes, requiredEquipment,
    status = 'scheduled'
  } = data;

  if (!patientId || !procedureName || !scheduledDate) {
    return res.status(400).json({ error: 'Patient ID, procedure name, and scheduled date are required' });
  }

  const result = await query(
    `INSERT INTO surgeries (
      patient_id, procedure_name, procedure_type, scheduled_date, estimated_duration,
      surgeon_id, anesthesia_type, operating_room, pre_op_notes, required_equipment,
      status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *`,
    [
      patientId, procedureName, procedureType, scheduledDate, estimatedDuration,
      surgeonId, anesthesiaType, operatingRoom, preOpNotes,
      JSON.stringify(requiredEquipment || []),
      status, user.id
    ]
  );

  res.status(201).json({ surgery: result.rows[0] });
}

async function updateSurgery(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    procedureName: 'procedure_name',
    procedureType: 'procedure_type',
    scheduledDate: 'scheduled_date',
    estimatedDuration: 'estimated_duration',
    surgeonId: 'surgeon_id',
    anesthesiaType: 'anesthesia_type',
    operatingRoom: 'operating_room',
    preOpNotes: 'pre_op_notes',
    postOpNotes: 'post_op_notes',
    requiredEquipment: 'required_equipment',
    status: 'status',
    actualStartTime: 'actual_start_time',
    actualEndTime: 'actual_end_time'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(key === 'requiredEquipment' ? JSON.stringify(data[key]) : data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE surgeries SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Surgery not found' });
  }

  res.status(200).json({ surgery: result.rows[0] });
}

async function deleteSurgery(id, res) {
  const result = await query('DELETE FROM surgeries WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Surgery not found' });
  }

  res.status(200).json({ message: 'Surgery deleted successfully' });
}
