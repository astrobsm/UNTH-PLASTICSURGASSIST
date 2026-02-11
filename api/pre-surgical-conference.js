// Pre-Surgical Conference API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/pre-surgical-conference', '').split('/').filter(Boolean);
  const action = pathParts[0]; // could be 'scheduled-patients' or a patientId

  try {
    switch (method) {
      case 'GET':
        if (action === 'scheduled-patients') {
          return await getScheduledPatients(url.searchParams, res);
        }
        if (action) {
          const subAction = pathParts[1];
          if (subAction === 'comorbidities') return await getComorbidities(action, res);
          if (subAction === 'photographs') return await getClinicalPhotographs(action, res);
          if (subAction === 'lab-results') return await getLabResults(action, res);
          if (subAction === 'medications') return await getMedications(action, res);
          if (subAction === 'anaesthetist-comments') return await getAnaesthetistComments(action, res);
          if (subAction === 'planned-procedures') return await getPlannedProcedures(action, res);
          if (subAction === 'shopping-list-status') return await getShoppingListStatus(action, res);
          if (subAction === 'preparing-team') return await getPreparingTeam(action, res);
          // Full conference data bundle
          return await getFullConferenceData(action, res);
        }
        return res.status(400).json({ error: 'Patient ID or action required' });

      case 'POST':
        if (action && pathParts[1] === 'notes') {
          return await saveConferenceNotes(action, req.body, auth.user, res);
        }
        return res.status(400).json({ error: 'Invalid action' });

      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Pre-Surgical Conference API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Get patients with scheduled/upcoming surgeries
async function getScheduledPatients(searchParams, res) {
  const ward = searchParams.get('ward');
  const date = searchParams.get('date');

  let queryStr = `
    SELECT DISTINCT p.id, p.hospital_number, p.first_name, p.last_name, p.full_name,
           p.date_of_birth, p.gender, p.blood_group, p.allergies, p.medical_history,
           p.primary_diagnosis, p.secondary_diagnoses, p.ward, p.bed_number,
           s.procedure_name, s.scheduled_date, s.status as surgery_status
    FROM patients p
    INNER JOIN surgeries s ON s.patient_id = p.id
    WHERE s.status IN ('scheduled', 'pending', 'confirmed')
  `;
  const params = [];
  let paramCount = 1;

  if (ward) {
    queryStr += ` AND p.ward = $${paramCount}`;
    params.push(ward);
    paramCount++;
  }

  if (date) {
    queryStr += ` AND DATE(s.scheduled_date) = $${paramCount}`;
    params.push(date);
    paramCount++;
  }

  queryStr += ` ORDER BY s.scheduled_date ASC`;

  const result = await query(queryStr, params);
  res.status(200).json({ patients: result.rows });
}

// Get full conference data bundle for a patient
async function getFullConferenceData(patientId, res) {
  // Get patient info
  const patientResult = await query(
    `SELECT id, hospital_number, first_name, last_name, full_name, date_of_birth, 
            gender, blood_group, allergies, medical_history, primary_diagnosis, 
            secondary_diagnoses, ward, bed_number
     FROM patients WHERE id = $1`, [patientId]
  );

  if (patientResult.rows.length === 0) {
    return res.status(404).json({ error: 'Patient not found' });
  }

  const patient = patientResult.rows[0];

  // Fetch all data in parallel
  const [
    labResults,
    medications, 
    surgeries,
    preOpAssessments,
    wardRounds,
    shoppingListItems
  ] = await Promise.all([
    query(`SELECT id, test_type, test_name, results, status, ordered_at, completed_at,
           (SELECT name FROM users WHERE id = lo.ordered_by) as ordered_by_name
           FROM lab_orders lo WHERE patient_id = $1 ORDER BY ordered_at DESC`, [patientId]),
    query(`SELECT id, medication_name, dosage, frequency, duration, route, instructions, 
           status, prescribed_at,
           (SELECT name FROM users WHERE id = pr.prescribed_by) as prescribed_by_name
           FROM prescriptions pr WHERE patient_id = $1 AND status = 'active' 
           ORDER BY prescribed_at DESC`, [patientId]),
    query(`SELECT id, procedure_name, procedure_type, scheduled_date, estimated_duration,
           anesthesia_type, operating_room, pre_op_notes, required_equipment, status,
           (SELECT name FROM users WHERE id = s.surgeon_id) as surgeon_name
           FROM surgeries s WHERE patient_id = $1 AND status IN ('scheduled', 'pending', 'confirmed')
           ORDER BY scheduled_date ASC`, [patientId]),
    query(`SELECT id, assessment_date, asa_class, mallampati_score, airway_assessment,
           cardiovascular, respiratory, current_medications, allergies, fasting_status,
           consent_obtained, blood_available, icu_bed_reserved, fitness_for_surgery,
           anesthesia_plan, assessed_by, notes
           FROM preoperative_assessments WHERE patient_id = $1 ORDER BY assessment_date DESC`, [patientId]),
    query(`SELECT id, round_date, findings, plan, vital_signs, current_medications,
           new_orders, consultant_instructions, nursing_notes,
           (SELECT name FROM users WHERE id = wr.user_id) as round_by_name,
           (SELECT role FROM users WHERE id = wr.user_id) as round_by_role
           FROM ward_rounds wr WHERE patient_id = $1 ORDER BY round_date DESC`, [patientId]),
    query(`SELECT * FROM shopping_lists WHERE patient_id = $1`, [patientId]).catch(() => ({ rows: [] }))
  ]);

  // Extract comorbidities from medical history
  const comorbidities = extractComorbidities(patient);

  // Extract clinical photographs from ward rounds
  const clinicalPhotographs = extractClinicalPhotographs(wardRounds.rows, patientId);

  // Extract anaesthetist comments from preop assessments
  const anaesthetistComments = extractAnaesthetistComments(preOpAssessments.rows);

  // Process shopping list status
  const shoppingListStatus = processShoppingListStatus(shoppingListItems.rows);

  // Extract preparing team from ward rounds and preop assessments
  const preparingTeam = extractPreparingTeam(wardRounds.rows, preOpAssessments.rows);

  res.status(200).json({
    patient,
    comorbidities,
    clinicalPhotographs,
    labResults: labResults.rows,
    medications: medications.rows,
    anaesthetistComments,
    plannedProcedures: surgeries.rows,
    shoppingListStatus,
    preparingTeam
  });
}

// Extract comorbidities from patient medical history and secondary diagnoses
function extractComorbidities(patient) {
  const comorbidities = [];

  // Parse medical history for common comorbidities
  const history = (patient.medical_history || '').toLowerCase();
  const comorbidityPatterns = [
    { pattern: /diabet(es|ic)/i, name: 'Diabetes Mellitus', severity: 'moderate' },
    { pattern: /hypertens(ion|ive)/i, name: 'Hypertension', severity: 'moderate' },
    { pattern: /asthma/i, name: 'Asthma', severity: 'mild' },
    { pattern: /heart\s*(disease|failure)/i, name: 'Heart Disease', severity: 'severe' },
    { pattern: /renal\s*(disease|failure|insufficiency)/i, name: 'Renal Disease', severity: 'severe' },
    { pattern: /liver\s*(disease|cirrhosis)/i, name: 'Liver Disease', severity: 'severe' },
    { pattern: /hiv|aids/i, name: 'HIV/AIDS', severity: 'moderate' },
    { pattern: /hepatitis/i, name: 'Hepatitis', severity: 'moderate' },
    { pattern: /sickle\s*cell/i, name: 'Sickle Cell Disease', severity: 'moderate' },
    { pattern: /epilepsy|seizure/i, name: 'Epilepsy', severity: 'moderate' },
    { pattern: /tuberculosis|tb/i, name: 'Tuberculosis', severity: 'moderate' },
    { pattern: /obesity|obese/i, name: 'Obesity', severity: 'mild' },
    { pattern: /anemia|anaemia/i, name: 'Anaemia', severity: 'mild' },
    { pattern: /copd/i, name: 'COPD', severity: 'moderate' },
    { pattern: /stroke|cva/i, name: 'Previous Stroke/CVA', severity: 'severe' },
    { pattern: /deep\s*vein|dvt/i, name: 'DVT History', severity: 'moderate' },
    { pattern: /pulmonary\s*embolism|pe/i, name: 'Pulmonary Embolism History', severity: 'severe' },
  ];

  comorbidityPatterns.forEach(({ pattern, name, severity }) => {
    if (pattern.test(patient.medical_history || '')) {
      comorbidities.push({ name, severity, notes: '' });
    }
  });

  // Add secondary diagnoses
  if (Array.isArray(patient.secondary_diagnoses)) {
    patient.secondary_diagnoses.forEach(diagnosis => {
      if (typeof diagnosis === 'string') {
        comorbidities.push({ name: diagnosis, severity: 'unspecified', notes: '' });
      } else if (diagnosis && diagnosis.name) {
        comorbidities.push({
          name: diagnosis.name,
          severity: diagnosis.severity || 'unspecified',
          notes: diagnosis.notes || ''
        });
      }
    });
  }

  // If medical history text exists but no patterns matched, add as general
  if (comorbidities.length === 0 && patient.medical_history) {
    comorbidities.push({
      name: patient.medical_history,
      severity: 'unspecified',
      notes: 'Extracted from medical history'
    });
  }

  return comorbidities;
}

// Extract clinical photographs from ward rounds (stored as clinical_images in JSONB)
function extractClinicalPhotographs(wardRounds, patientId) {
  const photos = [];
  wardRounds.forEach(round => {
    // Ward rounds may have clinical_images JSONB or other photo fields
    try {
      const images = typeof round.clinical_images === 'string'
        ? JSON.parse(round.clinical_images) 
        : (round.clinical_images || []);
      
      if (Array.isArray(images)) {
        images.forEach((img, idx) => {
          photos.push({
            id: `wr-${round.id}-${idx}`,
            url: img.url || img.dataUrl || img.src || img,
            caption: img.caption || img.description || `Ward round image - ${round.round_date}`,
            date: round.round_date,
            type: img.type || 'ward_round'
          });
        });
      }
    } catch (e) {
      // ignore parse errors
    }
  });
  return photos;
}

// Extract anaesthetist comments from preoperative assessments
function extractAnaesthetistComments(preOpAssessments) {
  return preOpAssessments.map(assessment => ({
    id: assessment.id,
    comment: assessment.notes || '',
    anaesthetist_name: assessment.assessed_by || 'Unknown',
    asa_grade: assessment.asa_class ? `ASA ${assessment.asa_class}` : null,
    airway_assessment: assessment.mallampati_score 
      ? `Mallampati ${assessment.mallampati_score}` 
      : (typeof assessment.airway_assessment === 'object' 
        ? JSON.stringify(assessment.airway_assessment) 
        : assessment.airway_assessment),
    anesthesia_plan: assessment.anesthesia_plan || '',
    created_at: assessment.assessment_date
  }));
}

// Process shopping list status
function processShoppingListStatus(shoppingListRows) {
  if (!shoppingListRows || shoppingListRows.length === 0) {
    return {
      is_complete: false,
      total_items: 0,
      procured_items: 0,
      pending_items: 0,
      items: []
    };
  }

  const items = [];
  let procured = 0;
  let total = 0;

  shoppingListRows.forEach(row => {
    const rowItems = typeof row.items === 'string' ? JSON.parse(row.items) : (row.items || []);
    if (Array.isArray(rowItems)) {
      rowItems.forEach(item => {
        total++;
        const status = item.status || item.procured ? 'procured' : 'pending';
        if (status === 'procured') procured++;
        items.push({
          name: item.name || item.item_name || 'Unknown Item',
          quantity: item.quantity || 1,
          status,
          category: item.category || 'General'
        });
      });
    }
    // Also check if row-level fields exist
    if (row.item_name) {
      total++;
      const status = row.status === 'procured' || row.is_procured ? 'procured' : 'pending';
      if (status === 'procured') procured++;
      items.push({
        name: row.item_name,
        quantity: row.quantity || 1,
        status,
        category: row.category || 'General'
      });
    }
  });

  return {
    is_complete: total > 0 && procured === total,
    total_items: total,
    procured_items: procured,
    pending_items: total - procured,
    items
  };
}

// Extract preparing team members from ward rounds and preop assessments
function extractPreparingTeam(wardRounds, preOpAssessments) {
  const teamMap = new Map();

  // From ward rounds (house officers and registrars documenting rounds)
  wardRounds.forEach(round => {
    const name = round.round_by_name;
    const role = round.round_by_role || 'house_officer';
    if (name && (role === 'house_officer' || role === 'junior_registrar' || role === 'senior_registrar')) {
      if (!teamMap.has(name)) {
        teamMap.set(name, {
          id: round.id,
          name,
          role: role.replace('_', ' '),
          tasks_completed: [],
          preparation_date: round.round_date
        });
      }
      const member = teamMap.get(name);
      member.tasks_completed.push(`Ward round - ${round.round_date}`);
    }
  });

  // From preoperative assessments
  preOpAssessments.forEach(assessment => {
    const name = assessment.assessed_by;
    if (name) {
      if (!teamMap.has(name)) {
        teamMap.set(name, {
          id: assessment.id,
          name,
          role: 'Anaesthetist/Assessor',
          tasks_completed: [],
          preparation_date: assessment.assessment_date
        });
      }
      const member = teamMap.get(name);
      member.tasks_completed.push(`Pre-op assessment - ${assessment.assessment_date}`);
    }
  });

  return Array.from(teamMap.values());
}

// Save conference notes / decision
async function saveConferenceNotes(patientId, body, user, res) {
  const { additional_comments, conference_decision, cleared_for_surgery } = body;

  // Check if conference_notes table exists, if not create a simple audit entry
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS conference_notes (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        additional_comments TEXT,
        conference_decision TEXT,
        cleared_for_surgery BOOLEAN DEFAULT FALSE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await query(
      `INSERT INTO conference_notes (patient_id, additional_comments, conference_decision, cleared_for_surgery, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [patientId, additional_comments, conference_decision, cleared_for_surgery, user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error saving conference notes:', error);
    res.status(500).json({ error: 'Failed to save conference notes' });
  }
}

// Get individual data endpoints
async function getComorbidities(patientId, res) {
  const result = await query(
    `SELECT medical_history, secondary_diagnoses FROM patients WHERE id = $1`, [patientId]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });
  res.status(200).json({ comorbidities: extractComorbidities(result.rows[0]) });
}

async function getClinicalPhotographs(patientId, res) {
  const wardRounds = await query(
    `SELECT id, round_date FROM ward_rounds WHERE patient_id = $1 ORDER BY round_date DESC`, [patientId]
  );
  res.status(200).json({ photographs: extractClinicalPhotographs(wardRounds.rows, patientId) });
}

async function getLabResults(patientId, res) {
  const result = await query(
    `SELECT id, test_type, test_name, results, status, ordered_at, completed_at,
     (SELECT name FROM users WHERE id = lo.ordered_by) as ordered_by_name
     FROM lab_orders lo WHERE patient_id = $1 ORDER BY ordered_at DESC`, [patientId]
  );
  res.status(200).json({ labResults: result.rows });
}

async function getMedications(patientId, res) {
  const result = await query(
    `SELECT id, medication_name, dosage, frequency, duration, route, instructions,
     status, prescribed_at,
     (SELECT name FROM users WHERE id = pr.prescribed_by) as prescribed_by_name
     FROM prescriptions pr WHERE patient_id = $1 AND status = 'active'
     ORDER BY prescribed_at DESC`, [patientId]
  );
  res.status(200).json({ medications: result.rows });
}

async function getAnaesthetistComments(patientId, res) {
  const result = await query(
    `SELECT * FROM preoperative_assessments WHERE patient_id = $1 ORDER BY assessment_date DESC`, [patientId]
  );
  res.status(200).json({ comments: extractAnaesthetistComments(result.rows) });
}

async function getPlannedProcedures(patientId, res) {
  const result = await query(
    `SELECT id, procedure_name, procedure_type, scheduled_date, estimated_duration,
     anesthesia_type, operating_room, pre_op_notes, required_equipment, status,
     (SELECT name FROM users WHERE id = s.surgeon_id) as surgeon_name
     FROM surgeries s WHERE patient_id = $1 AND status IN ('scheduled', 'pending', 'confirmed')
     ORDER BY scheduled_date ASC`, [patientId]
  );
  res.status(200).json({ procedures: result.rows });
}

async function getShoppingListStatus(patientId, res) {
  const result = await query(`SELECT * FROM shopping_lists WHERE patient_id = $1`, [patientId]).catch(() => ({ rows: [] }));
  res.status(200).json({ shoppingListStatus: processShoppingListStatus(result.rows) });
}

async function getPreparingTeam(patientId, res) {
  const [wardRounds, preOps] = await Promise.all([
    query(`SELECT id, round_date, (SELECT name FROM users WHERE id = wr.user_id) as round_by_name,
           (SELECT role FROM users WHERE id = wr.user_id) as round_by_role
           FROM ward_rounds wr WHERE patient_id = $1 ORDER BY round_date DESC`, [patientId]),
    query(`SELECT id, assessment_date, assessed_by FROM preoperative_assessments WHERE patient_id = $1`, [patientId])
  ]);
  res.status(200).json({ team: extractPreparingTeam(wardRounds.rows, preOps.rows) });
}
