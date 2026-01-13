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
    // Extract patient ID from URL path if present
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathParts = url.pathname.replace('/api/sync/patients', '').split('/').filter(Boolean);
    const patientId = pathParts[0];

    if (req.method === 'GET') {
      return await getPatients(res);
    }
    
    if (req.method === 'POST') {
      return await createPatient(req.body, auth.user, res);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required for update' });
      }
      return await updatePatient(patientId, req.body, res);
    }

    if (req.method === 'DELETE') {
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required for delete' });
      }
      return await deletePatient(patientId, res);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync patients error:', error);
    res.status(500).json({ error: 'Operation failed', message: error.message });
  }
}

async function getPatients(res) {
  // Try with all columns first, fallback to basic columns if any are missing
  try {
    const result = await query(
      `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, 
              phone, email, address, blood_group, allergies, medical_history,
              primary_diagnosis, secondary_diagnoses, ward, bed_number,
              emergency_contact_name, emergency_contact_phone,
              created_at, updated_at
       FROM patients 
       ORDER BY updated_at DESC 
       LIMIT 500`
    );
    
    return res.status(200).json({ 
      patients: result.rows,
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    // If column doesn't exist, try without the new columns
    if (err.message && (err.message.includes('primary_diagnosis') || 
        err.message.includes('secondary_diagnoses') || 
        err.message.includes('column') ||
        err.message.includes('does not exist'))) {
      console.log('Some columns missing, using basic query');
      const result = await query(
        `SELECT id, hospital_number, first_name, last_name, date_of_birth, gender, 
                phone, email, address, blood_group, allergies, medical_history,
                emergency_contact_name, emergency_contact_phone,
                created_at, updated_at
         FROM patients 
         ORDER BY updated_at DESC 
         LIMIT 500`
      );
      
      return res.status(200).json({ 
        patients: result.rows,
        serverTime: new Date().toISOString()
      });
    }
    throw err;
  }
}

async function createPatient(data, user, res) {
  const {
    hospital_number, hospitalNumber,
    first_name, firstName,
    last_name, lastName,
    date_of_birth, dateOfBirth,
    gender, sex,
    phone,
    email,
    address,
    blood_group, bloodGroup,
    allergies,
    medical_history, medicalHistory, chronic_conditions,
    emergency_contact_name, emergencyContactName,
    emergency_contact_phone, emergencyContactPhone,
    primary_diagnosis, primaryDiagnosis, diagnosis
  } = data;

  // Handle both snake_case and camelCase
  const patientData = {
    hospital_number: hospital_number || hospitalNumber,
    first_name: first_name || firstName,
    last_name: last_name || lastName,
    date_of_birth: date_of_birth || dateOfBirth,
    gender: gender || sex,
    phone: phone || '',
    email: email || '',
    address: address || '',
    blood_group: blood_group || bloodGroup || '',
    allergies: Array.isArray(allergies) ? allergies.join(', ') : (allergies || ''),
    medical_history: Array.isArray(medical_history || medicalHistory || chronic_conditions) 
      ? (medical_history || medicalHistory || chronic_conditions).join(', ') 
      : (medical_history || medicalHistory || chronic_conditions || ''),
    primary_diagnosis: primary_diagnosis || primaryDiagnosis || diagnosis || '',
    emergency_contact_name: emergency_contact_name || emergencyContactName || '',
    emergency_contact_phone: emergency_contact_phone || emergencyContactPhone || ''
  };

  // Validate required fields
  if (!patientData.first_name || !patientData.last_name) {
    return res.status(400).json({ 
      error: 'First name and last name are required',
      received: data 
    });
  }

  // Try with primary_diagnosis first, fallback to without if column doesn't exist
  try {
    const result = await query(
      `INSERT INTO patients (
        hospital_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, blood_group, allergies, medical_history,
        primary_diagnosis, emergency_contact_name, emergency_contact_phone, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
        patientData.primary_diagnosis,
        patientData.emergency_contact_name,
        patientData.emergency_contact_phone,
        user.id
      ]
    );
    return res.status(201).json({ patient: result.rows[0] });
  } catch (err) {
    // Fallback: column might not exist yet
    if (err.message && err.message.includes('primary_diagnosis')) {
      console.log('primary_diagnosis column not found, inserting without it');
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
      return res.status(201).json({ patient: result.rows[0] });
    }
    throw err;
  }
}

async function updatePatient(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    hospital_number: 'hospital_number',
    hospitalNumber: 'hospital_number',
    first_name: 'first_name',
    firstName: 'first_name',
    last_name: 'last_name',
    lastName: 'last_name',
    date_of_birth: 'date_of_birth',
    dateOfBirth: 'date_of_birth',
    gender: 'gender',
    sex: 'gender',
    phone: 'phone',
    email: 'email',
    address: 'address',
    blood_group: 'blood_group',
    bloodGroup: 'blood_group',
    allergies: 'allergies',
    medical_history: 'medical_history',
    medicalHistory: 'medical_history',
    chronic_conditions: 'medical_history',
    emergency_contact_name: 'emergency_contact_name',
    emergencyContactName: 'emergency_contact_name',
    emergency_contact_phone: 'emergency_contact_phone',
    emergencyContactPhone: 'emergency_contact_phone'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      // Only add if not already added (avoid duplicates from both formats)
      if (!fields.some(f => f.startsWith(dbField))) {
        fields.push(`${dbField} = $${paramCount}`);
        let value = data[key];
        
        // Handle arrays
        if (Array.isArray(value)) {
          value = value.join(', ');
        }
        
        values.push(value);
        paramCount++;
      }
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
