// Individual patient endpoint for Vercel serverless
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  const { id } = req.query;
  const { method } = req;

  if (!id) {
    return res.status(400).json({ error: 'Patient ID required' });
  }

  try {
    switch (method) {
      case 'GET':
        return await getPatient(id, res);
      case 'PUT':
      case 'PATCH':
        return await updatePatient(id, req.body, res);
      case 'DELETE':
        return await deletePatient(id, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Patient API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getPatient(id, res) {
  const result = await query('SELECT * FROM patients WHERE id = $1', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  res.status(200).json({ patient: result.rows[0] });
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
