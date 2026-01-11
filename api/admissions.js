// Admissions API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

// Transform database row to frontend format
function transformAdmission(row) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    patient_name: row.first_name && row.last_name 
      ? `${row.first_name} ${row.last_name}` 
      : null,
    hospital_number: row.hospital_number,
    admission_date: row.admission_date,
    ward_location: row.ward,
    bed_number: row.bed_number,
    provisional_diagnosis: row.admitting_diagnosis,
    presenting_complaint: row.notes,
    reasons_for_admission: row.admitting_diagnosis,
    status: row.status,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/admissions', '').split('/').filter(Boolean);
  const admissionId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (admissionId) {
          return await getAdmission(admissionId, res);
        }
        return await getAllAdmissions(url.searchParams, res);
      case 'POST':
        return await createAdmission(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!admissionId) {
          return res.status(400).json({ error: 'Admission ID required' });
        }
        return await updateAdmission(admissionId, req.body, res);
      case 'DELETE':
        if (!admissionId) {
          return res.status(400).json({ error: 'Admission ID required' });
        }
        return await deleteAdmission(admissionId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Admissions API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllAdmissions(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  let queryStr = `
    SELECT a.*, p.first_name, p.last_name, p.hospital_number
    FROM admissions a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND a.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  if (status) {
    queryStr += ` AND a.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  queryStr += ` ORDER BY a.admission_date DESC`;

  const result = await query(queryStr, params);

  // Transform all rows to frontend format
  const transformedAdmissions = result.rows.map(transformAdmission);

  res.status(200).json({ admissions: transformedAdmissions });
}

async function getAdmission(id, res) {
  const result = await query(
    `SELECT a.*, p.first_name, p.last_name, p.hospital_number
     FROM admissions a
     LEFT JOIN patients p ON a.patient_id = p.id
     WHERE a.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Admission not found' });
  }

  // Transform to frontend format
  const transformedAdmission = transformAdmission(result.rows[0]);

  res.status(200).json({ admission: transformedAdmission });
}

async function createAdmission(data, user, res) {
  const {
    patientId, admissionDate, ward, bedNumber,
    admittingDiagnosis, notes, status = 'active'
  } = data;

  if (!patientId || !admissionDate) {
    return res.status(400).json({ error: 'Patient ID and admission date are required' });
  }

  const result = await query(
    `INSERT INTO admissions (
      patient_id, admission_date, ward, bed_number,
      admitting_diagnosis, notes, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [patientId, admissionDate, ward, bedNumber, admittingDiagnosis, notes, status, user.id]
  );

  // Get patient info for transformation
  const patientResult = await query(
    'SELECT first_name, last_name, hospital_number FROM patients WHERE id = $1',
    [patientId]
  );

  const admissionWithPatient = {
    ...result.rows[0],
    first_name: patientResult.rows[0]?.first_name,
    last_name: patientResult.rows[0]?.last_name,
    hospital_number: patientResult.rows[0]?.hospital_number
  };

  // Transform to frontend format
  const transformedAdmission = transformAdmission(admissionWithPatient);

  res.status(201).json({ admission: transformedAdmission });
}

async function updateAdmission(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    ward: 'ward',
    bedNumber: 'bed_number',
    admittingDiagnosis: 'admitting_diagnosis',
    dischargeDiagnosis: 'discharge_diagnosis',
    dischargeDate: 'discharge_date',
    notes: 'notes',
    status: 'status'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(data[key]);
      paramCount++;
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE admissions SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Admission not found' });
  }

  // Get patient info for transformation
  const patientResult = await query(
    `SELECT first_name, last_name, hospital_number FROM patients WHERE id = (
      SELECT patient_id FROM admissions WHERE id = $1
    )`,
    [id]
  );

  const admissionWithPatient = {
    ...result.rows[0],
    first_name: patientResult.rows[0]?.first_name,
    last_name: patientResult.rows[0]?.last_name,
    hospital_number: patientResult.rows[0]?.hospital_number
  };

  // Transform to frontend format
  const transformedAdmission = transformAdmission(admissionWithPatient);

  res.status(200).json({ admission: transformedAdmission });
}

async function deleteAdmission(id, res) {
  const result = await query('DELETE FROM admissions WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Admission not found' });
  }

  res.status(200).json({ message: 'Admission deleted successfully' });
}
