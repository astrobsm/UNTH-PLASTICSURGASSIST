// Prescriptions API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/prescriptions', '').split('/').filter(Boolean);
  const prescriptionId = pathParts[0];

  try {
    switch (method) {
      case 'GET':
        if (prescriptionId) {
          return await getPrescription(prescriptionId, res);
        }
        return await getAllPrescriptions(url.searchParams, res);
      case 'POST':
        return await createPrescription(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!prescriptionId) {
          return res.status(400).json({ error: 'Prescription ID required' });
        }
        return await updatePrescription(prescriptionId, req.body, res);
      case 'DELETE':
        if (!prescriptionId) {
          return res.status(400).json({ error: 'Prescription ID required' });
        }
        return await deletePrescription(prescriptionId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Prescriptions API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function getAllPrescriptions(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  // SECURITY: patientId is REQUIRED to prevent cross-patient data leakage
  if (!patientId) {
    return res.status(400).json({ error: 'patientId is required' });
  }

  let queryStr = `
    SELECT pr.*, p.first_name, p.last_name, p.hospital_number
    FROM prescriptions pr
    LEFT JOIN patients p ON pr.patient_id = p.id
    WHERE pr.patient_id = $1
  `;
  const params = [patientId];
  let paramCount = 2;

  if (status) {
    queryStr += ` AND pr.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  queryStr += ` ORDER BY pr.prescribed_at DESC`;

  const result = await query(queryStr, params);

  res.status(200).json({ prescriptions: result.rows });
}

async function getPrescription(id, res) {
  const result = await query(
    `SELECT pr.*, p.first_name, p.last_name, p.hospital_number
     FROM prescriptions pr
     LEFT JOIN patients p ON pr.patient_id = p.id
     WHERE pr.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Prescription not found' });
  }

  res.status(200).json({ prescription: result.rows[0] });
}

async function createPrescription(data, user, res) {
  // Support both formats:
  // 1. New format: { patient_id, prescriptions: [{medication, dosage, ...}] }
  // 2. Legacy format: { patientId, medicationName, dosage, ... }
  
  // Normalize patient ID (support both snake_case and camelCase)
  const patientId = data.patientId || data.patient_id;
  
  if (!patientId) {
    return res.status(400).json({ error: 'Patient ID is required' });
  }
  
  // Check if using new array format
  if (data.prescriptions && Array.isArray(data.prescriptions)) {
    // Batch insert multiple prescriptions
    const prescriptions = data.prescriptions;
    const prescriber = data.prescriber || user.name;
    const prescriberRole = data.prescriber_role || data.prescriberRole || user.role;
    
    if (prescriptions.length === 0) {
      return res.status(400).json({ error: 'At least one prescription is required' });
    }
    
    const results = [];
    for (const p of prescriptions) {
      const medicationName = p.medicationName || p.medication;
      if (!medicationName) {
        return res.status(400).json({ error: 'Medication name is required for all prescriptions' });
      }
      
      const result = await query(
        `INSERT INTO prescriptions (
          patient_id, medication_name, dosage, frequency,
          duration, route, instructions, status, prescribed_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          patientId, 
          medicationName, 
          p.dosage || '', 
          p.frequency || '', 
          p.duration || '', 
          p.route || 'oral', 
          p.instructions || p.indication || '', 
          p.status || 'active', 
          user.id
        ]
      );
      results.push(result.rows[0]);
    }
    
    return res.status(201).json({ 
      prescription: results[0], 
      prescriptions: results,
      id: results[0]?.id 
    });
  }
  
  // Legacy single prescription format
  const {
    medicationName, dosage, frequency,
    duration, route, instructions, status = 'active'
  } = data;

  if (!medicationName) {
    return res.status(400).json({ error: 'Medication name is required' });
  }

  const result = await query(
    `INSERT INTO prescriptions (
      patient_id, medication_name, dosage, frequency,
      duration, route, instructions, status, prescribed_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [patientId, medicationName, dosage, frequency, duration, route, instructions, status, user.id]
  );

  res.status(201).json({ prescription: result.rows[0], id: result.rows[0].id });
}

async function updatePrescription(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    medicationName: 'medication_name',
    dosage: 'dosage',
    frequency: 'frequency',
    duration: 'duration',
    route: 'route',
    instructions: 'instructions',
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
    `UPDATE prescriptions SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Prescription not found' });
  }

  res.status(200).json({ prescription: result.rows[0] });
}

async function deletePrescription(id, res) {
  const result = await query('DELETE FROM prescriptions WHERE id = $1 RETURNING id', [id]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Prescription not found' });
  }

  res.status(200).json({ message: 'Prescription deleted successfully' });
}
