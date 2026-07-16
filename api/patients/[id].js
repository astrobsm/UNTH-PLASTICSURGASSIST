// Individual patient endpoint for Vercel serverless
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import { propagatePatientDenormalized } from '../_lib/patientPropagation.js';

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
  try {
    const result = await query('SELECT * FROM patients WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Patient not found', id });
    }

    res.status(200).json({ patient: result.rows[0] });
  } catch (error) {
    console.error('Error fetching patient:', error);
    throw error;
  }
}

async function updatePatient(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  // Each DB column accepts several possible payload keys (snake_case from the
  // app, camelCase legacy, plus dob/sex aliases). full_name is a generated
  // column and is never set directly — first_name/last_name drive it.
  const columns = [
    ['hospital_number', ['hospital_number', 'hospitalNumber']],
    ['first_name', ['first_name', 'firstName']],
    ['last_name', ['last_name', 'lastName']],
    ['date_of_birth', ['date_of_birth', 'dateOfBirth', 'dob']],
    ['gender', ['gender', 'sex']],
    ['phone', ['phone']],
    ['email', ['email']],
    ['address', ['address']],
    ['blood_group', ['blood_group', 'bloodGroup']],
    ['allergies', ['allergies']],
    ['medical_history', ['medical_history', 'medicalHistory']],
    ['primary_diagnosis', ['primary_diagnosis', 'primaryDiagnosis']],
    ['ward', ['ward', 'ward_id']],
    ['bed_number', ['bed_number', 'bedNumber']],
    ['emergency_contact_name', ['emergency_contact_name', 'emergencyContactName']],
    ['emergency_contact_phone', ['emergency_contact_phone', 'emergencyContactPhone']],
  ];

  for (const [dbField, keys] of columns) {
    const key = keys.find(k => data[k] !== undefined);
    if (key !== undefined) {
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

  // Propagate the (possibly changed) name + hospital number to every table that
  // stores a denormalized copy, so the edit reflects everywhere it's referenced.
  try { await propagatePatientDenormalized(id); }
  catch (e) { console.warn('propagatePatientDenormalized failed:', e.message); }

  res.status(200).json({ patient: result.rows[0] });
}

async function deletePatient(id, res) {
  const result = await query('DELETE FROM patients WHERE id = $1 RETURNING id', [id]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  res.status(200).json({ message: 'Patient deleted successfully' });
}
