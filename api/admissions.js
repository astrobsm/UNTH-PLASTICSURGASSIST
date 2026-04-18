// Admissions API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

// Transform database row to frontend format
function transformAdmission(row) {
  // Parse JSONB fields safely
  const parseJson = (val) => {
    if (!val) return val;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return val; }
  };

  return {
    id: row.id,
    patient_id: row.patient_id,
    // Prefer stored patient_name, fall back to JOIN
    patient_name: row.patient_name 
      || (row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null),
    hospital_number: row.hospital_number 
      || (row.p_hospital_number || null),
    age: row.age,
    gender: row.gender,
    admission_date: row.admission_date,
    admission_time: row.admission_time,
    ward_location: row.ward,
    bed_number: row.bed_number,
    route_of_admission: row.route_of_admission || 'clinic',
    referring_specialty: row.referring_specialty,
    referring_doctor: row.referring_doctor,
    reasons_for_admission: row.reasons_for_admission || row.admitting_diagnosis,
    presenting_complaint: row.presenting_complaint || row.notes,
    provisional_diagnosis: row.provisional_diagnosis || row.admitting_diagnosis,
    admitting_doctor: row.admitting_doctor,
    admitting_consultant: row.admitting_consultant,
    vital_signs: parseJson(row.vital_signs),
    allergies: row.allergies,
    current_medications: row.current_medications,
    past_medical_history: row.past_medical_history,
    past_surgical_history: row.past_surgical_history,
    social_history: row.social_history,
    family_history: row.family_history,
    comorbidities: parseJson(row.comorbidities),
    examination_findings: row.examination_findings,
    initial_management_plan: row.initial_management_plan,
    status: row.status,
    discharge_date: row.discharge_date,
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
        // Check for bulk force discharge actions
        if (req.body && req.body.action === 'force-discharge-all') {
          return await forceDischargeAll(auth.user, res);
        }
        if (req.body && req.body.action === 'force-discharge-selected') {
          return await forceDischargeSelected(req.body.patient_ids, auth.user, res);
        }
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
    SELECT a.*, p.first_name, p.last_name, p.hospital_number AS p_hospital_number
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

  // Transform all rows to frontend format, filtering out ghost admissions with no patient data
  const transformedAdmissions = result.rows
    .map(transformAdmission)
    .filter(a => {
      // Skip admissions that have no identifiable patient info at all
      const hasName = a.patient_name && a.patient_name.trim();
      const hasHospNum = a.hospital_number && a.hospital_number.trim();
      return hasName || hasHospNum;
    });

  res.status(200).json({ admissions: transformedAdmissions });
}

async function getAdmission(id, res) {
  const result = await query(
    `SELECT a.*, p.first_name, p.last_name, p.hospital_number AS p_hospital_number
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
    admittingDiagnosis, notes, status = 'active',
    // New comprehensive fields
    admissionTime, patientName, hospitalNumber, age, gender,
    routeOfAdmission, referringSpecialty, referringDoctor,
    reasonsForAdmission, presentingComplaint, provisionalDiagnosis,
    admittingDoctor, admittingConsultant,
    vitalSigns, allergies, currentMedications,
    pastMedicalHistory, pastSurgicalHistory, socialHistory, familyHistory,
    comorbidities, examinationFindings, initialManagementPlan,
    // Also accept snake_case from frontend direct mapping
    patient_id, admission_date, ward_location, bed_number,
    admission_time, patient_name, hospital_number,
    route_of_admission, referring_specialty, referring_doctor,
    reasons_for_admission, presenting_complaint, provisional_diagnosis,
    admitting_doctor, admitting_consultant,
    vital_signs, current_medications, past_medical_history,
    past_surgical_history, social_history, family_history,
    examination_findings, initial_management_plan
  } = data;

  // Resolve values: prefer camelCase, fall back to snake_case
  const resolvedPatientId = patientId || patient_id;
  const resolvedAdmissionDate = admissionDate || admission_date;
  const resolvedWard = ward || ward_location;
  const resolvedBedNumber = bedNumber || bed_number;
  const resolvedStatus = status || 'active';

  if (!resolvedPatientId || !resolvedAdmissionDate) {
    return res.status(400).json({ error: 'Patient ID and admission date are required' });
  }

  // Resolve each field, preferring camelCase payload, falling back to snake_case
  const resolvedVitalSigns = vitalSigns || vital_signs;
  const resolvedComorbidities = comorbidities;

  const result = await query(
    `INSERT INTO admissions (
      patient_id, admission_date, admission_time, ward, bed_number,
      admitting_diagnosis, notes, status, created_by,
      patient_name, hospital_number, age, gender,
      route_of_admission, referring_specialty, referring_doctor,
      reasons_for_admission, presenting_complaint, provisional_diagnosis,
      admitting_doctor, admitting_consultant,
      vital_signs, allergies, current_medications,
      past_medical_history, past_surgical_history, social_history, family_history,
      comorbidities, examination_findings, initial_management_plan
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
    RETURNING *`,
    [
      resolvedPatientId,
      resolvedAdmissionDate,
      admissionTime || admission_time || null,
      resolvedWard,
      resolvedBedNumber || null,
      admittingDiagnosis || provisionalDiagnosis || provisional_diagnosis || null,
      notes || presentingComplaint || presenting_complaint || null,
      resolvedStatus,
      user.id,
      patientName || patient_name || null,
      hospitalNumber || hospital_number || null,
      age || null,
      gender || null,
      routeOfAdmission || route_of_admission || 'clinic',
      referringSpecialty || referring_specialty || null,
      referringDoctor || referring_doctor || null,
      reasonsForAdmission || reasons_for_admission || admittingDiagnosis || null,
      presentingComplaint || presenting_complaint || notes || null,
      provisionalDiagnosis || provisional_diagnosis || admittingDiagnosis || null,
      admittingDoctor || admitting_doctor || null,
      admittingConsultant || admitting_consultant || null,
      resolvedVitalSigns ? JSON.stringify(resolvedVitalSigns) : null,
      allergies || null,
      currentMedications || current_medications || null,
      pastMedicalHistory || past_medical_history || null,
      pastSurgicalHistory || past_surgical_history || null,
      socialHistory || social_history || null,
      familyHistory || family_history || null,
      resolvedComorbidities ? JSON.stringify(resolvedComorbidities) : null,
      examinationFindings || examination_findings || null,
      initialManagementPlan || initial_management_plan || null
    ]
  );

  // Get patient info for name fallback
  const patientResult = await query(
    'SELECT first_name, last_name, hospital_number FROM patients WHERE id = $1',
    [resolvedPatientId]
  );

  const admissionWithPatient = {
    ...result.rows[0],
    first_name: patientResult.rows[0]?.first_name,
    last_name: patientResult.rows[0]?.last_name,
    p_hospital_number: patientResult.rows[0]?.hospital_number
  };

  const transformedAdmission = transformAdmission(admissionWithPatient);
  res.status(201).json({ admission: transformedAdmission });
}

async function updateAdmission(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    ward: 'ward',
    ward_location: 'ward',
    bedNumber: 'bed_number',
    bed_number: 'bed_number',
    admittingDiagnosis: 'admitting_diagnosis',
    dischargeDiagnosis: 'discharge_diagnosis',
    dischargeDate: 'discharge_date',
    discharge_date: 'discharge_date',
    notes: 'notes',
    status: 'status',
    admissionTime: 'admission_time',
    admission_time: 'admission_time',
    patientName: 'patient_name',
    patient_name: 'patient_name',
    hospitalNumber: 'hospital_number',
    hospital_number: 'hospital_number',
    age: 'age',
    gender: 'gender',
    routeOfAdmission: 'route_of_admission',
    route_of_admission: 'route_of_admission',
    referringSpecialty: 'referring_specialty',
    referring_specialty: 'referring_specialty',
    referringDoctor: 'referring_doctor',
    referring_doctor: 'referring_doctor',
    reasonsForAdmission: 'reasons_for_admission',
    reasons_for_admission: 'reasons_for_admission',
    presentingComplaint: 'presenting_complaint',
    presenting_complaint: 'presenting_complaint',
    provisionalDiagnosis: 'provisional_diagnosis',
    provisional_diagnosis: 'provisional_diagnosis',
    admittingDoctor: 'admitting_doctor',
    admitting_doctor: 'admitting_doctor',
    admittingConsultant: 'admitting_consultant',
    admitting_consultant: 'admitting_consultant',
    allergies: 'allergies',
    currentMedications: 'current_medications',
    current_medications: 'current_medications',
    pastMedicalHistory: 'past_medical_history',
    past_medical_history: 'past_medical_history',
    pastSurgicalHistory: 'past_surgical_history',
    past_surgical_history: 'past_surgical_history',
    socialHistory: 'social_history',
    social_history: 'social_history',
    familyHistory: 'family_history',
    family_history: 'family_history',
    examinationFindings: 'examination_findings',
    examination_findings: 'examination_findings',
    initialManagementPlan: 'initial_management_plan',
    initial_management_plan: 'initial_management_plan',
  };

  // Handle JSONB fields separately
  const jsonbFields = {
    vitalSigns: 'vital_signs',
    vital_signs: 'vital_signs',
    comorbidities: 'comorbidities',
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(data[key]);
      paramCount++;
    }
  }

  for (const [key, dbField] of Object.entries(jsonbFields)) {
    if (data[key] !== undefined) {
      fields.push(`${dbField} = $${paramCount}`);
      values.push(data[key] ? JSON.stringify(data[key]) : null);
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
    p_hospital_number: patientResult.rows[0]?.hospital_number
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

async function forceDischargeAll(user, res) {
  // Only allow admins
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can force discharge all patients' });
  }

  const now = new Date().toISOString();
  const result = await query(
    `UPDATE admissions 
     SET status = 'discharged', 
         discharge_date = $1,
         updated_at = NOW()
     WHERE status = 'active'
     RETURNING id, patient_id`,
    [now.split('T')[0]]
  );

  const count = result.rows.length;
  console.log(`Force discharged ${count} admissions by admin ${user.name || user.id}`);

  res.status(200).json({ 
    message: `Successfully force-discharged ${count} active admissions`,
    count,
    discharged_ids: result.rows.map(r => r.id)
  });
}

async function forceDischargeSelected(patientIds, user, res) {
  // Only allow admins
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can force discharge patients' });
  }

  if (!Array.isArray(patientIds) || patientIds.length === 0) {
    return res.status(400).json({ error: 'patient_ids array is required' });
  }

  // Sanitize: ensure all IDs are integers
  const sanitizedIds = patientIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  if (sanitizedIds.length === 0) {
    return res.status(400).json({ error: 'No valid patient IDs provided' });
  }

  const now = new Date().toISOString().split('T')[0];
  const placeholders = sanitizedIds.map((_, i) => `$${i + 2}`).join(', ');
  const result = await query(
    `UPDATE admissions 
     SET status = 'discharged', 
         discharge_date = $1,
         updated_at = NOW()
     WHERE status = 'active' AND patient_id IN (${placeholders})
     RETURNING id, patient_id`,
    [now, ...sanitizedIds]
  );

  const count = result.rows.length;
  console.log(`Force discharged ${count} admissions (${sanitizedIds.length} patients selected) by admin ${user.name || user.id}`);

  res.status(200).json({ 
    message: `Successfully force-discharged ${count} admissions for ${sanitizedIds.length} patients`,
    count,
    discharged_ids: result.rows.map(r => r.id)
  });
}
