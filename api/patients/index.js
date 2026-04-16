// Patients API endpoint for Vercel serverless
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';

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
  const page = Math.max(1, parseInt(searchParams.get('page')) || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit')) || 50), 500);
  const search = searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  // Try with all columns first, fallback if columns missing
  const fullColumns = `id, hospital_number, first_name, last_name, date_of_birth, gender, 
           phone, email, address, blood_group, allergies, medical_history,
           primary_diagnosis, secondary_diagnoses, ward, bed_number,
           emergency_contact_name, emergency_contact_phone,
           created_at, updated_at`;
  
  const basicColumns = `id, hospital_number, first_name, last_name, date_of_birth, gender, 
           phone, email, address, blood_group, allergies, medical_history,
           emergency_contact_name, emergency_contact_phone,
           created_at, updated_at`;

  let queryStr = `SELECT ${fullColumns} FROM patients`;
  const params = [];

  if (search) {
    queryStr += ` WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR hospital_number ILIKE $1`;
    params.push(`%${search}%`);
  }

  queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  let result;
  try {
    result = await query(queryStr, params);
  } catch (err) {
    // Fallback to basic columns if new columns don't exist
    if (err.message && (err.message.includes('column') || err.message.includes('does not exist'))) {
      console.log('Some columns missing, using basic query');
      let basicQuery = `SELECT ${basicColumns} FROM patients`;
      const basicParams = [];
      if (search) {
        basicQuery += ` WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR hospital_number ILIKE $1`;
        basicParams.push(`%${search}%`);
      }
      basicQuery += ` ORDER BY created_at DESC LIMIT $${basicParams.length + 1} OFFSET $${basicParams.length + 2}`;
      basicParams.push(limit, offset);
      result = await query(basicQuery, basicParams);
    } else {
      throw err;
    }
  }

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
    hospitalNumber, hospital_number,
    firstName, first_name,
    lastName, last_name,
    dateOfBirth, date_of_birth,
    gender, sex,
    phone,
    email,
    address,
    bloodGroup, blood_group,
    allergies,
    medicalHistory, medical_history, chronic_conditions,
    emergencyContactName, emergency_contact_name,
    emergencyContactPhone, emergency_contact_phone,
    primary_diagnosis, primaryDiagnosis, diagnosis,
    secondary_diagnoses, secondaryDiagnoses
  } = data;

  // Handle both camelCase and snake_case
  const patientData = {
    hospital_number: hospitalNumber || hospital_number,
    first_name: firstName || first_name,
    last_name: lastName || last_name,
    date_of_birth: dateOfBirth || date_of_birth,
    gender: gender || sex,
    phone: phone || '',
    email: email || '',
    address: address || '',
    blood_group: bloodGroup || blood_group || '',
    allergies: Array.isArray(allergies) ? allergies.join(', ') : (allergies || ''),
    medical_history: Array.isArray(medicalHistory || medical_history || chronic_conditions) 
      ? (medicalHistory || medical_history || chronic_conditions).join(', ') 
      : (medicalHistory || medical_history || chronic_conditions || ''),
    primary_diagnosis: primary_diagnosis || primaryDiagnosis || diagnosis || '',
    secondary_diagnoses: secondary_diagnoses || secondaryDiagnoses || [],
    emergency_contact_name: emergencyContactName || emergency_contact_name || '',
    emergency_contact_phone: emergencyContactPhone || emergency_contact_phone || ''
  };

  if (!patientData.first_name || !patientData.last_name) {
    return res.status(400).json({ 
      error: 'First name and last name are required',
      received: data 
    });
  }

  // Generate hospital number if not provided
  if (!patientData.hospital_number) {
    const timestamp = Date.now().toString().slice(-8);
    patientData.hospital_number = `PS${timestamp}`;
  }

  // Try with all columns first, then fallback progressively
  const insertStrategies = [
    // Strategy 1: Full insert with all columns
    {
      sql: `INSERT INTO patients (
        hospital_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, blood_group, allergies, medical_history,
        primary_diagnosis, secondary_diagnoses,
        emergency_contact_name, emergency_contact_phone, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      params: [
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
        JSON.stringify(patientData.secondary_diagnoses),
        patientData.emergency_contact_name,
        patientData.emergency_contact_phone,
        user?.id || null
      ]
    },
    // Strategy 2: Without secondary_diagnoses
    {
      sql: `INSERT INTO patients (
        hospital_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, blood_group, allergies, medical_history,
        primary_diagnosis, emergency_contact_name, emergency_contact_phone, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *`,
      params: [
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
        user?.id || null
      ]
    },
    // Strategy 3: Without created_by
    {
      sql: `INSERT INTO patients (
        hospital_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, blood_group, allergies, medical_history,
        primary_diagnosis, emergency_contact_name, emergency_contact_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      params: [
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
        patientData.emergency_contact_phone
      ]
    },
    // Strategy 4: Minimal columns
    {
      sql: `INSERT INTO patients (
        hospital_number, first_name, last_name, date_of_birth, gender,
        phone, email, address, blood_group, allergies, medical_history,
        emergency_contact_name, emergency_contact_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      params: [
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
        patientData.emergency_contact_phone
      ]
    }
  ];

  let lastError = null;
  for (const strategy of insertStrategies) {
    try {
      const result = await query(strategy.sql, strategy.params);
      return res.status(201).json({ patient: result.rows[0] });
    } catch (err) {
      lastError = err;
      console.log(`Insert strategy failed: ${err.message}`);
      // If it's a column not found error, try next strategy
      if (err.message && (err.message.includes('column') || err.message.includes('does not exist'))) {
        continue;
      }
      // If it's a duplicate key error, return appropriate response
      if (err.message && (err.message.includes('duplicate') || err.message.includes('unique'))) {
        return res.status(409).json({ error: 'Patient with this hospital number already exists' });
      }
      // For other errors, throw
      throw err;
    }
  }
  
  throw lastError || new Error('All insert strategies failed');
}

async function updatePatient(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    hospitalNumber: 'hospital_number',
    hospital_number: 'hospital_number',
    firstName: 'first_name',
    first_name: 'first_name',
    lastName: 'last_name',
    last_name: 'last_name',
    dateOfBirth: 'date_of_birth',
    date_of_birth: 'date_of_birth',
    gender: 'gender',
    sex: 'gender',
    phone: 'phone',
    email: 'email',
    address: 'address',
    bloodGroup: 'blood_group',
    blood_group: 'blood_group',
    allergies: 'allergies',
    medicalHistory: 'medical_history',
    medical_history: 'medical_history',
    chronic_conditions: 'medical_history',
    emergencyContactName: 'emergency_contact_name',
    emergency_contact_name: 'emergency_contact_name',
    emergencyContactPhone: 'emergency_contact_phone',
    emergency_contact_phone: 'emergency_contact_phone'
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
