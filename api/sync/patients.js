// Sync patients endpoint - GET all patients, POST to create
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    if (req.method === 'GET') {
      return await getPatients(res);
    }
    
    if (req.method === 'POST') {
      return await createPatient(req.body, auth.user, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync patients error:', error);
    res.status(500).json({ error: 'Operation failed', message: error.message });
  }
}

async function getPatients(res) {
  const result = await query(
    `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, 
            phone, email, address, blood_group, allergies, medical_history,
            emergency_contact_name, emergency_contact_phone,
            created_at, updated_at
     FROM patients 
     ORDER BY updated_at DESC 
     LIMIT 500`
  );
  
  // Return as { patients: [...] } for frontend compatibility
  res.status(200).json({ 
    patients: result.rows,
    serverTime: new Date().toISOString()
  });
}

async function createPatient(data, user, res) {
  const {
    hospital_number, hospitalNumber,
    first_name, firstName,
    last_name, lastName,
    date_of_birth, dateOfBirth,
    gender,
    phone,
    email,
    address,
    blood_group, bloodGroup,
    allergies,
    medical_history, medicalHistory,
    emergency_contact_name, emergencyContactName,
    emergency_contact_phone, emergencyContactPhone
  } = data;

  // Handle both snake_case and camelCase
  const patientData = {
    hospital_number: hospital_number || hospitalNumber,
    first_name: first_name || firstName,
    last_name: last_name || lastName,
    date_of_birth: date_of_birth || dateOfBirth,
    gender,
    phone,
    email,
    address,
    blood_group: blood_group || bloodGroup,
    allergies: Array.isArray(allergies) ? allergies.join(', ') : allergies,
    medical_history: Array.isArray(medical_history || medicalHistory) 
      ? (medical_history || medicalHistory).join(', ') 
      : (medical_history || medicalHistory),
    emergency_contact_name: emergency_contact_name || emergencyContactName,
    emergency_contact_phone: emergency_contact_phone || emergencyContactPhone
  };

  const result = await query(
    `INSERT INTO patients (
      hospital_number, first_name, last_name, date_of_birth, gender,
      phone, email, address, blood_group, allergies, medical_history,
      emergency_contact_name, emergency_contact_phone, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      patientData.hospital_number,
      patientData.first_name,
      patientData.last_name,
      patientData.date_of_birth || null,
      patientData.gender,
      patientData.phone,
      patientData.email,
      patientData.address,
      patientData.blood_group,
      patientData.allergies,
      patientData.medical_history,
      patientData.emergency_contact_name,
      patientData.emergency_contact_phone,
      user.id
    ]
  );

  res.status(201).json({ patient: result.rows[0] });
}
