// SJS/TEN Assessments API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/sjs-assessments', '').split('/').filter(Boolean);
  const assessmentId = pathParts[0];

  try {
    await ensureTable();

    switch (method) {
      case 'GET':
        if (assessmentId) {
          return await getAssessment(assessmentId, res);
        }
        return await getAllAssessments(url.searchParams, res);
      case 'POST':
        return await createAssessment(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!assessmentId) {
          return res.status(400).json({ error: 'Assessment ID required' });
        }
        return await updateAssessment(assessmentId, req.body, res);
      case 'DELETE':
        if (!assessmentId) {
          return res.status(400).json({ error: 'Assessment ID required' });
        }
        return await deleteAssessment(assessmentId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('SJS Assessments API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  await query(`
    CREATE TABLE IF NOT EXISTS sjs_assessments (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER,
      hospital_number VARCHAR(100),
      patient_name VARCHAR(255),
      age INTEGER,
      sex VARCHAR(10),
      weight DECIMAL(5,2),
      date_of_onset DATE,
      date_of_assessment DATE,
      causative_drug VARCHAR(255),
      other_drug VARCHAR(255),
      days_since_drug_start INTEGER,
      classification VARCHAR(50),
      bsa_detached DECIMAL(5,2),
      organ_involvement JSONB DEFAULT '{}',
      organ_notes JSONB DEFAULT '{}',
      heart_rate INTEGER,
      has_malignancy BOOLEAN DEFAULT FALSE,
      serum_urea DECIMAL(8,2),
      serum_bicarbonate DECIMAL(8,2),
      serum_glucose DECIMAL(8,2),
      nikolsky_sign BOOLEAN DEFAULT FALSE,
      fever_on_admission BOOLEAN DEFAULT FALSE,
      temperature DECIMAL(4,1),
      pain_score INTEGER,
      scorten_score INTEGER,
      scorten_mortality VARCHAR(50),
      patient_aware BOOLEAN DEFAULT FALSE,
      family_counselled BOOLEAN DEFAULT FALSE,
      counselling_notes TEXT,
      assessed_by VARCHAR(255),
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_sjs_assessments_patient ON sjs_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sjs_assessments_date ON sjs_assessments(date_of_assessment);
  `);
  tableEnsured = true;
}

async function getAllAssessments(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  let queryStr = `SELECT * FROM sjs_assessments WHERE 1=1`;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND patient_id = $${paramCount++}`;
    params.push(parseInt(patientId, 10));
  }
  if (status) {
    queryStr += ` AND status = $${paramCount++}`;
    params.push(status);
  }

  queryStr += ` ORDER BY date_of_assessment DESC, created_at DESC LIMIT 500`;

  const result = await query(queryStr, params);
  res.status(200).json({ assessments: result.rows });
}

async function getAssessment(id, res) {
  const result = await query('SELECT * FROM sjs_assessments WHERE id = $1', [parseInt(id, 10)]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  res.status(200).json({ assessment: result.rows[0] });
}

async function createAssessment(body, user, res) {
  const {
    patient_id, hospital_number, patient_name, age, sex, weight,
    date_of_onset, date_of_assessment, causative_drug, other_drug,
    days_since_drug_start, classification, bsa_detached,
    organ_involvement, organ_notes,
    heart_rate, has_malignancy, serum_urea, serum_bicarbonate, serum_glucose,
    nikolsky_sign, fever_on_admission, temperature, pain_score,
    scorten_score, scorten_mortality,
    patient_aware, family_counselled, counselling_notes
  } = body;

  const result = await query(
    `INSERT INTO sjs_assessments 
     (patient_id, hospital_number, patient_name, age, sex, weight,
      date_of_onset, date_of_assessment, causative_drug, other_drug,
      days_since_drug_start, classification, bsa_detached,
      organ_involvement, organ_notes,
      heart_rate, has_malignancy, serum_urea, serum_bicarbonate, serum_glucose,
      nikolsky_sign, fever_on_admission, temperature, pain_score,
      scorten_score, scorten_mortality,
      patient_aware, family_counselled, counselling_notes, assessed_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
     RETURNING *`,
    [
      patient_id ? parseInt(patient_id, 10) : null,
      hospital_number || null,
      patient_name || null,
      age ? parseInt(age, 10) : null,
      sex || null,
      weight ? parseFloat(weight) : null,
      date_of_onset || null,
      date_of_assessment || new Date().toISOString().split('T')[0],
      causative_drug || null,
      other_drug || null,
      days_since_drug_start ? parseInt(days_since_drug_start, 10) : null,
      classification || null,
      bsa_detached ? parseFloat(bsa_detached) : null,
      JSON.stringify(organ_involvement || {}),
      JSON.stringify(organ_notes || {}),
      heart_rate ? parseInt(heart_rate, 10) : null,
      has_malignancy || false,
      serum_urea ? parseFloat(serum_urea) : null,
      serum_bicarbonate ? parseFloat(serum_bicarbonate) : null,
      serum_glucose ? parseFloat(serum_glucose) : null,
      nikolsky_sign || false,
      fever_on_admission || false,
      temperature ? parseFloat(temperature) : null,
      pain_score ? parseInt(pain_score, 10) : null,
      scorten_score ? parseInt(scorten_score, 10) : null,
      scorten_mortality || null,
      patient_aware || false,
      family_counselled || false,
      counselling_notes || null,
      user.full_name || 'Unknown'
    ]
  );

  console.log(`✅ SJS assessment created for patient ${patient_name || patient_id}`);
  res.status(201).json({ assessment: result.rows[0] });
}

async function updateAssessment(id, body, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const allowedFields = [
    'patient_name', 'hospital_number', 'age', 'sex', 'weight',
    'date_of_onset', 'date_of_assessment', 'causative_drug', 'other_drug',
    'days_since_drug_start', 'classification', 'bsa_detached',
    'organ_involvement', 'organ_notes',
    'heart_rate', 'has_malignancy', 'serum_urea', 'serum_bicarbonate', 'serum_glucose',
    'nikolsky_sign', 'fever_on_admission', 'temperature', 'pain_score',
    'scorten_score', 'scorten_mortality',
    'patient_aware', 'family_counselled', 'counselling_notes', 'status'
  ];

  const jsonFields = ['organ_involvement', 'organ_notes'];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = $${paramCount++}`);
      values.push(jsonFields.includes(field) ? JSON.stringify(body[field]) : body[field]);
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(parseInt(id, 10));

  const result = await query(
    `UPDATE sjs_assessments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  res.status(200).json({ assessment: result.rows[0] });
}

async function deleteAssessment(id, res) {
  const result = await query(
    `UPDATE sjs_assessments SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [parseInt(id, 10)]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Assessment not found' });
  }
  res.status(200).json({ message: 'Assessment deleted', assessment: result.rows[0] });
}
