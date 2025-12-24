// Patients API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/patients', '').split('/').filter(Boolean);
  const patientId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (patientId) {
          return await getPatient(patientId, res);
        }
        return await getAllPatients(url.searchParams, res);
      case 'POST':
        return await createPatient(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!patientId) {
          return res.status(400).json({ error: 'Patient ID required' });
        }
        return await updatePatient(patientId, req.body, res);
      case 'DELETE':
        if (!patientId) {
          return res.status(400).json({ error: 'Patient ID required' });
        }
        return await deletePatient(patientId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Patients API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllPatients(searchParams, res) {
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 50;
  const search = searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  let queryStr = `
    SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, 
           phone, email, address, blood_group, allergies, medical_history,
           emergency_contact_name, emergency_contact_phone,
           created_at, updated_at
    FROM patients
  `;
  const params = [];

  if (search) {
    queryStr += ` WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR hospital_number ILIKE $1`;
    params.push(`%${search}%`);
  }

  queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const result = await query(queryStr, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) FROM patients';
  let countParams = [];
  if (search) {
    countQuery += ` WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR hospital_number ILIKE $1`;
    countParams.push(`%${search}%`);
  }
  const countResult = await query(countQuery, countParams);
  const total = parseInt(countResult.rows[0].count);

  res.status(200).json({
    patients: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}

async function getPatient(id, res) {
  const result = await query('SELECT * FROM patients WHERE id = $1', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  res.status(200).json({ patient: result.rows[0] });
}

async function createPatient(data, user, res) {
  const {
    hospitalNumber, firstName, lastName, dateOfBirth, gender,
    phone, email, address, bloodGroup, allergies, medicalHistory,
    emergencyContactName, emergencyContactPhone
  } = data;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'First name and last name are required' });
  }

  const result = await query(
    `INSERT INTO patients (
      hospital_number, first_name, last_name, date_of_birth, gender,
      phone, email, address, blood_group, allergies, medical_history,
      emergency_contact_name, emergency_contact_phone, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      hospitalNumber, firstName, lastName, dateOfBirth, gender,
      phone, email, address, bloodGroup, allergies, medicalHistory,
      emergencyContactName, emergencyContactPhone, user.id
    ]
  );

  res.status(201).json({ patient: result.rows[0] });
}

async function updatePatient(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    hospitalNumber: 'hospital_number',
    firstName: 'first_name',
    lastName: 'last_name',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    phone: 'phone',
    email: 'email',
    address: 'address',
    bloodGroup: 'blood_group',
    allergies: 'allergies',
    medicalHistory: 'medical_history',
    emergencyContactName: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone'
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
    `UPDATE patients SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  res.status(200).json({ patient: result.rows[0] });
}

async function deletePatient(id, res) {
  const result = await query('DELETE FROM patients WHERE id = $1 RETURNING id', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  res.status(200).json({ message: 'Patient deleted successfully' });
}
