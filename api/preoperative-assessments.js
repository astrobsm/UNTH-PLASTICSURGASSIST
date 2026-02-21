// Preoperative Assessments API endpoint for Vercel serverless
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

function parseJson(val) {
  if (!val) return val;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return val; }
}

function transformAssessment(row) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    surgery_booking_id: row.surgery_id,
    hospital_number: row.hospital_number,
    patient_name: row.patient_name,
    current_medications: parseJson(row.current_medications) || [],
    bleeding_risk: parseJson(row.hematologic) || null,
    dvt_risk: parseJson(row.dvt_risk) || null,
    cardiovascular_risk: parseJson(row.cardiovascular) || null,
    pressure_sore_risk: parseJson(row.pressure_sore_risk) || null,
    comorbidities_medications: parseJson(row.comorbidities_medications) || [],
    consent_document: row.consent_obtained ? 'obtained' : null,
    payment_evidence: row.payment_evidence || null,
    insurance_covered: row.insurance_covered || false,
    comprehensive_summary: row.comprehensive_summary || row.notes || null,
    preop_instructions: row.preop_instructions || row.anesthesia_plan || null,
    assessed_by: row.assessed_by,
    assessed_at: row.assessment_date || row.created_at,
    updated_at: row.updated_at,
    // Additional raw fields
    asa_class: row.asa_class,
    mallampati_score: row.mallampati_score,
    airway_assessment: parseJson(row.airway_assessment),
    allergies: row.allergies,
    fasting_status: row.fasting_status,
    blood_available: row.blood_available,
    icu_bed_reserved: row.icu_bed_reserved,
    fitness_for_surgery: row.fitness_for_surgery,
  };
}

async function getAllAssessments(req, res) {
  const { patientId, since } = req.query;
  
  let sql = `SELECT pa.*, p.first_name, p.last_name, p.hospital_number AS p_hospital_number 
             FROM preoperative_assessments pa 
             LEFT JOIN patients p ON pa.patient_id = p.id`;
  const params = [];
  const conditions = [];
  
  if (patientId) {
    conditions.push(`pa.patient_id = $${params.length + 1}`);
    params.push(patientId);
  }
  if (since) {
    conditions.push(`pa.updated_at > $${params.length + 1}`);
    params.push(since);
  }
  
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY pa.created_at DESC';
  
  const result = await query(sql, params);
  const assessments = result.rows.map(transformAssessment);
  return res.status(200).json({ assessments });
}

async function getAssessment(req, res, id) {
  const result = await query(
    `SELECT pa.*, p.first_name, p.last_name, p.hospital_number AS p_hospital_number 
     FROM preoperative_assessments pa 
     LEFT JOIN patients p ON pa.patient_id = p.id
     WHERE pa.id = $1`, [id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  return res.status(200).json({ assessment: transformAssessment(result.rows[0]) });
}

async function createAssessment(req, res) {
  const body = req.body;
  
  const patientId = body.patient_id;
  const surgeryId = body.surgery_booking_id || body.surgery_id || null;
  const hospitalNumber = body.hospital_number || null;
  const patientName = body.patient_name || null;
  const assessmentDate = body.assessed_at || body.assessment_date || new Date().toISOString();
  const asaClass = body.asa_class || null;
  const mallampatiScore = body.mallampati_score || null;
  const airwayAssessment = body.airway_assessment ? JSON.stringify(body.airway_assessment) : '{}';
  const cardiovascular = body.cardiovascular_risk ? JSON.stringify(body.cardiovascular_risk) : (body.cardiovascular ? JSON.stringify(body.cardiovascular) : '{}');
  const respiratory = body.respiratory ? JSON.stringify(body.respiratory) : '{}';
  const renal = body.renal ? JSON.stringify(body.renal) : '{}';
  const hepatic = body.hepatic ? JSON.stringify(body.hepatic) : '{}';
  const endocrine = body.endocrine ? JSON.stringify(body.endocrine) : '{}';
  const hematologic = body.bleeding_risk ? JSON.stringify(body.bleeding_risk) : (body.hematologic ? JSON.stringify(body.hematologic) : '{}');
  const currentMedications = body.current_medications ? JSON.stringify(body.current_medications) : '[]';
  const allergies = Array.isArray(body.allergies) ? body.allergies.join(', ') : (body.allergies || null);
  const fastingStatus = body.fasting_status || null;
  const consentObtained = body.consent_document ? true : (body.consent_obtained || false);
  const bloodAvailable = body.blood_available || false;
  const icuBedReserved = body.icu_bed_reserved || false;
  const fitnessForSurgery = body.fitness_for_surgery || null;
  const anesthesiaPlan = body.preop_instructions || body.anesthesia_plan || null;
  const assessedBy = body.assessed_by || null;
  const notes = body.comprehensive_summary || body.notes || null;

  // Additional JSONB for extended risk data
  const dvtRisk = body.dvt_risk ? JSON.stringify(body.dvt_risk) : null;
  const pressureSoreRisk = body.pressure_sore_risk ? JSON.stringify(body.pressure_sore_risk) : null;
  const comorbiditiesMedications = body.comorbidities_medications ? JSON.stringify(body.comorbidities_medications) : null;
  const comprehensiveSummary = body.comprehensive_summary || null;
  const preopInstructions = body.preop_instructions || null;
  const paymentEvidence = body.payment_evidence || null;
  const insuranceCovered = body.insurance_covered || false;

  // First, ensure the extra columns exist (idempotent)
  const extraColumns = [
    { name: 'dvt_risk', type: 'JSONB' },
    { name: 'pressure_sore_risk', type: 'JSONB' },
    { name: 'comorbidities_medications', type: 'JSONB' },
    { name: 'comprehensive_summary', type: 'TEXT' },
    { name: 'preop_instructions', type: 'TEXT' },
    { name: 'payment_evidence', type: 'TEXT' },
    { name: 'insurance_covered', type: 'BOOLEAN DEFAULT FALSE' },
  ];
  for (const col of extraColumns) {
    try {
      await query(`ALTER TABLE preoperative_assessments ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
    } catch (e) {
      // Column might already exist
    }
  }

  const result = await query(
    `INSERT INTO preoperative_assessments 
      (patient_id, surgery_id, hospital_number, patient_name, assessment_date, 
       asa_class, mallampati_score, airway_assessment, cardiovascular, respiratory,
       renal, hepatic, endocrine, hematologic, current_medications, allergies,
       fasting_status, consent_obtained, blood_available, icu_bed_reserved,
       fitness_for_surgery, anesthesia_plan, assessed_by, notes,
       dvt_risk, pressure_sore_risk, comorbidities_medications,
       comprehensive_summary, preop_instructions, payment_evidence, insurance_covered)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
             $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
     RETURNING *`,
    [patientId, surgeryId, hospitalNumber, patientName, assessmentDate,
     asaClass, mallampatiScore, airwayAssessment, cardiovascular, respiratory,
     renal, hepatic, endocrine, hematologic, currentMedications, allergies,
     fastingStatus, consentObtained, bloodAvailable, icuBedReserved,
     fitnessForSurgery, anesthesiaPlan, assessedBy, notes,
     dvtRisk, pressureSoreRisk, comorbiditiesMedications,
     comprehensiveSummary, preopInstructions, paymentEvidence, insuranceCovered]
  );

  return res.status(201).json({ assessment: transformAssessment(result.rows[0]) });
}

async function updateAssessment(req, res, id) {
  const body = req.body;
  const fieldMap = {
    patient_id: 'patient_id',
    surgery_id: 'surgery_id',
    surgery_booking_id: 'surgery_id',
    hospital_number: 'hospital_number',
    patient_name: 'patient_name',
    asa_class: 'asa_class',
    mallampati_score: 'mallampati_score',
    assessed_by: 'assessed_by',
    fasting_status: 'fasting_status',
    fitness_for_surgery: 'fitness_for_surgery',
    consent_obtained: 'consent_obtained',
    blood_available: 'blood_available',
    icu_bed_reserved: 'icu_bed_reserved',
    allergies: 'allergies',
    notes: 'notes',
    comprehensive_summary: 'comprehensive_summary',
    preop_instructions: 'preop_instructions',
    payment_evidence: 'payment_evidence',
    insurance_covered: 'insurance_covered',
  };
  
  const jsonbFields = ['airway_assessment', 'cardiovascular', 'cardiovascular_risk', 'respiratory', 
                        'renal', 'hepatic', 'endocrine', 'hematologic', 'bleeding_risk',
                        'current_medications', 'dvt_risk', 'pressure_sore_risk', 'comorbidities_medications'];

  const updates = [];
  const values = [];
  let paramCount = 0;

  for (const [key, col] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      paramCount++;
      updates.push(`${col} = $${paramCount}`);
      values.push(body[key]);
    }
  }

  for (const field of jsonbFields) {
    if (body[field] !== undefined) {
      paramCount++;
      // Map frontend field names to DB columns
      let dbCol = field;
      if (field === 'cardiovascular_risk') dbCol = 'cardiovascular';
      if (field === 'bleeding_risk') dbCol = 'hematologic';
      updates.push(`${dbCol} = $${paramCount}`);
      values.push(typeof body[field] === 'string' ? body[field] : JSON.stringify(body[field]));
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  paramCount++;
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await query(
    `UPDATE preoperative_assessments SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Assessment not found' });
  }

  return res.status(200).json({ assessment: transformAssessment(result.rows[0]) });
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const user = authenticateRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Check for ID in query
    const { id } = req.query;

    if (req.method === 'GET') {
      if (id) return getAssessment(req, res, id);
      return getAllAssessments(req, res);
    }

    if (req.method === 'POST') {
      return createAssessment(req, res);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!id) return res.status(400).json({ error: 'Assessment ID required for update' });
      return updateAssessment(req, res, id);
    }

    if (req.method === 'DELETE') {
      if (!id) return res.status(400).json({ error: 'Assessment ID required' });
      await query('DELETE FROM preoperative_assessments WHERE id = $1', [id]);
      return res.status(200).json({ message: 'Assessment deleted' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Preoperative assessments API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
