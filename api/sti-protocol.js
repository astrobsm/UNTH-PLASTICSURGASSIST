// Soft Tissue Infection / NEC Protocol API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/sti-protocol', '').split('/').filter(Boolean);
  const resource = pathParts[0]; // assessments, treatment-plans, debridements, orders, cme
  const resourceId = pathParts[1];

  try {
    switch (resource) {
      case 'assessments':
        return await handleAssessments(method, resourceId, req, auth, url, res);
      case 'treatment-plans':
        return await handleTreatmentPlans(method, resourceId, req, auth, url, res);
      case 'debridements':
        return await handleDebridements(method, resourceId, req, auth, url, res);
      case 'orders':
        return await handleOrders(method, resourceId, req, auth, url, res);
      case 'cme':
        return await handleCME(method, resourceId, req, auth, url, res);
      default:
        // No sub-resource: list assessments by default
        if (method === 'GET') {
          return await handleAssessments('GET', null, req, auth, url, res);
        }
        return res.status(404).json({ error: 'Resource not found. Use: assessments, treatment-plans, debridements, orders, cme' });
    }
  } catch (error) {
    console.error('STI Protocol API error:', error);
    if (error.message && error.message.includes('does not exist') && method === 'GET') {
      return res.status(200).json({ assessments: [], treatmentPlans: [], debridements: [], orders: [] });
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ============================================
// ASSESSMENTS
// ============================================
async function handleAssessments(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET':
      if (id) return await getAssessment(id, res);
      return await getAllAssessments(url.searchParams, res);
    case 'POST':
      return await createAssessment(req.body, auth.user, res);
    case 'PUT':
    case 'PATCH':
      if (!id) return res.status(400).json({ error: 'Assessment ID required' });
      return await updateAssessment(id, req.body, res);
    case 'DELETE':
      if (!id) return res.status(400).json({ error: 'Assessment ID required' });
      return await deleteAssessment(id, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getAllAssessments(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');
  const classification = searchParams.get('classification');

  let queryStr = `
    SELECT sa.*, p.first_name, p.last_name, p.hospital_number as p_hospital_number
    FROM sti_assessments sa
    LEFT JOIN patients p ON sa.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND sa.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }
  if (status) {
    queryStr += ` AND sa.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }
  if (classification) {
    queryStr += ` AND sa.classification = $${paramCount}`;
    params.push(classification);
    paramCount++;
  }

  queryStr += ` ORDER BY sa.assessment_date DESC`;
  const result = await query(queryStr, params);
  res.status(200).json({ assessments: result.rows });
}

async function getAssessment(id, res) {
  const result = await query(
    `SELECT sa.*, p.first_name, p.last_name, p.hospital_number as p_hospital_number
     FROM sti_assessments sa
     LEFT JOIN patients p ON sa.patient_id = p.id
     WHERE sa.id = $1`, [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
  
  // Also get related treatment plans
  const plans = await query('SELECT * FROM sti_treatment_plans WHERE assessment_id = $1 ORDER BY created_at DESC', [id]);
  // And debridements
  const debridements = await query('SELECT * FROM sti_debridements WHERE assessment_id = $1 ORDER BY debridement_date DESC', [id]);
  // And orders
  const orders = await query("SELECT * FROM protocol_orders WHERE treatment_plan_id IN (SELECT id FROM sti_treatment_plans WHERE assessment_id = $1) AND module = 'sti' ORDER BY created_at DESC", [id]);

  res.status(200).json({ 
    assessment: result.rows[0],
    treatmentPlans: plans.rows,
    debridements: debridements.rows,
    orders: orders.rows
  });
}

async function createAssessment(data, user, res) {
  const {
    patientId, hospitalNumber, patientName, classification, severity, location,
    onsetDate, durationHours, clinicalFeatures, systemicSigns, vitalSigns,
    painScore, painDisproportionate, crepitus, skinNecrosis, hemorrhagicBullae,
    lrinecScore, lrinecRisk, lrinecDetails, qsofaScore, qsofaDetails,
    comorbidities, diabetes, diabetesHba1c, renalImpairment, creatinine,
    jaundice, bilirubin, immunosuppressed, imagingOrdered, imagingFindings,
    woundPhotos, treatmentStage, disposition, notes
  } = data;

  if (!patientId || !classification || !severity) {
    return res.status(400).json({ error: 'Patient ID, classification, and severity are required' });
  }

  const result = await query(
    `INSERT INTO sti_assessments (
      patient_id, hospital_number, patient_name, classification, severity, location,
      onset_date, duration_hours, clinical_features, systemic_signs, vital_signs,
      pain_score, pain_disproportionate, crepitus, skin_necrosis, hemorrhagic_bullae,
      lrinec_score, lrinec_risk, lrinec_details, qsofa_score, qsofa_details,
      comorbidities, diabetes, diabetes_hba1c, renal_impairment, creatinine,
      jaundice, bilirubin, immunosuppressed, imaging_ordered, imaging_findings,
      wound_photos, treatment_stage, disposition,
      assessed_by, assessed_by_name, notes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37)
    RETURNING *`,
    [
      patientId, hospitalNumber, patientName, classification, severity, location,
      onsetDate, durationHours,
      JSON.stringify(clinicalFeatures || []), JSON.stringify(systemicSigns || []),
      JSON.stringify(vitalSigns || {}),
      painScore, painDisproportionate || false, crepitus || false, skinNecrosis || false, hemorrhagicBullae || false,
      lrinecScore, lrinecRisk, JSON.stringify(lrinecDetails || {}),
      qsofaScore, JSON.stringify(qsofaDetails || {}),
      JSON.stringify(comorbidities || []),
      diabetes || false, diabetesHba1c, renalImpairment || false, creatinine,
      jaundice || false, bilirubin, immunosuppressed || false,
      JSON.stringify(imagingOrdered || []), imagingFindings,
      JSON.stringify(woundPhotos || []), treatmentStage, disposition,
      user.id, user.name || user.full_name, notes
    ]
  );

  // Log audit
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'CREATE', 'sti_assessment', result.rows[0].id, JSON.stringify({ classification, severity, patientId })]
    );
  } catch (e) { console.error('Audit log error:', e); }

  res.status(201).json({ assessment: result.rows[0] });
}

async function updateAssessment(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    classification: 'classification', severity: 'severity', location: 'location',
    onsetDate: 'onset_date', durationHours: 'duration_hours',
    clinicalFeatures: 'clinical_features', systemicSigns: 'systemic_signs',
    vitalSigns: 'vital_signs', painScore: 'pain_score',
    painDisproportionate: 'pain_disproportionate', crepitus: 'crepitus',
    skinNecrosis: 'skin_necrosis', hemorrhagicBullae: 'hemorrhagic_bullae',
    lrinecScore: 'lrinec_score', lrinecRisk: 'lrinec_risk', lrinecDetails: 'lrinec_details',
    qsofaScore: 'qsofa_score', qsofaDetails: 'qsofa_details',
    comorbidities: 'comorbidities', diabetes: 'diabetes', diabetesHba1c: 'diabetes_hba1c',
    renalImpairment: 'renal_impairment', creatinine: 'creatinine',
    jaundice: 'jaundice', bilirubin: 'bilirubin', immunosuppressed: 'immunosuppressed',
    imagingOrdered: 'imaging_ordered', imagingFindings: 'imaging_findings',
    woundPhotos: 'wound_photos', treatmentStage: 'treatment_stage',
    disposition: 'disposition', status: 'status', notes: 'notes'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      const val = typeof data[key] === 'object' && data[key] !== null ? JSON.stringify(data[key]) : data[key];
      fields.push(`${dbField} = $${paramCount}`);
      values.push(val);
      paramCount++;
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE sti_assessments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
  res.status(200).json({ assessment: result.rows[0] });
}

async function deleteAssessment(id, res) {
  const result = await query('DELETE FROM sti_assessments WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' });
  res.status(200).json({ message: 'Assessment deleted successfully' });
}

// ============================================
// TREATMENT PLANS
// ============================================
async function handleTreatmentPlans(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET':
      if (id) return await getTreatmentPlan(id, res);
      return await getAllTreatmentPlans(url.searchParams, res);
    case 'POST':
      return await createTreatmentPlan(req.body, auth.user, res);
    case 'PUT':
    case 'PATCH':
      if (!id) return res.status(400).json({ error: 'Treatment plan ID required' });
      return await updateTreatmentPlan(id, req.body, auth.user, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getAllTreatmentPlans(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const assessmentId = searchParams.get('assessmentId');
  let queryStr = `SELECT * FROM sti_treatment_plans WHERE 1=1`;
  const params = [];
  let pc = 1;
  if (patientId) { queryStr += ` AND patient_id = $${pc}`; params.push(patientId); pc++; }
  if (assessmentId) { queryStr += ` AND assessment_id = $${pc}`; params.push(assessmentId); pc++; }
  queryStr += ` ORDER BY created_at DESC`;
  const result = await query(queryStr, params);
  res.status(200).json({ treatmentPlans: result.rows });
}

async function getTreatmentPlan(id, res) {
  const result = await query('SELECT * FROM sti_treatment_plans WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Treatment plan not found' });
  
  const orders = await query("SELECT * FROM protocol_orders WHERE treatment_plan_id = $1 AND module = 'sti' ORDER BY created_at DESC", [id]);
  res.status(200).json({ treatmentPlan: result.rows[0], orders: orders.rows });
}

async function createTreatmentPlan(data, user, res) {
  const {
    assessmentId, patientId, hospitalNumber, patientName, protocolId, stage, severity,
    antibiotics, surgicalInterventions, supportiveCare, monitoringPlan,
    comorbidityModifications, nutritionPlan, escalationCriteria, notes
  } = data;

  if (!patientId || !protocolId) {
    return res.status(400).json({ error: 'Patient ID and protocol ID required' });
  }

  const result = await query(
    `INSERT INTO sti_treatment_plans (
      assessment_id, patient_id, hospital_number, patient_name, protocol_id, stage, severity,
      antibiotics, surgical_interventions, supportive_care, monitoring_plan,
      comorbidity_modifications, nutrition_plan, escalation_criteria,
      created_by, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'active')
    RETURNING *`,
    [
      assessmentId, patientId, hospitalNumber, patientName, protocolId, stage, severity,
      JSON.stringify(antibiotics || []), JSON.stringify(surgicalInterventions || []),
      JSON.stringify(supportiveCare || []), JSON.stringify(monitoringPlan || []),
      JSON.stringify(comorbidityModifications || []), JSON.stringify(nutritionPlan || {}),
      JSON.stringify(escalationCriteria || []),
      user.id
    ]
  );

  res.status(201).json({ treatmentPlan: result.rows[0] });
}

async function updateTreatmentPlan(id, data, user, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    antibiotics: 'antibiotics', surgicalInterventions: 'surgical_interventions',
    supportiveCare: 'supportive_care', monitoringPlan: 'monitoring_plan',
    comorbidityModifications: 'comorbidity_modifications', nutritionPlan: 'nutrition_plan',
    escalationCriteria: 'escalation_criteria', status: 'status'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      const val = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
      fields.push(`${dbField} = $${paramCount}`);
      values.push(val);
      paramCount++;
    }
  }

  // Handle approval
  if (data.autoOrdersApproved) {
    fields.push(`auto_orders_approved = $${paramCount}`);
    values.push(true);
    paramCount++;
    fields.push(`approved_by = $${paramCount}`);
    values.push(user.id);
    paramCount++;
    fields.push(`approved_at = NOW()`);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE sti_treatment_plans SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Treatment plan not found' });

  // If approved, generate protocol orders
  if (data.autoOrdersApproved && result.rows[0]) {
    await generateProtocolOrders(result.rows[0], user, 'sti');
  }

  res.status(200).json({ treatmentPlan: result.rows[0] });
}

// ============================================
// DEBRIDEMENTS
// ============================================
async function handleDebridements(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET':
      if (id) {
        const result = await query('SELECT * FROM sti_debridements WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Debridement not found' });
        return res.status(200).json({ debridement: result.rows[0] });
      }
      const patientId = url.searchParams.get('patientId');
      const assessmentId = url.searchParams.get('assessmentId');
      let q = 'SELECT * FROM sti_debridements WHERE 1=1';
      const p = [];
      let pc = 1;
      if (patientId) { q += ` AND patient_id = $${pc}`; p.push(patientId); pc++; }
      if (assessmentId) { q += ` AND assessment_id = $${pc}`; p.push(assessmentId); pc++; }
      q += ' ORDER BY debridement_date DESC';
      const r = await query(q, p);
      return res.status(200).json({ debridements: r.rows });

    case 'POST':
      return await createDebridement(req.body, auth.user, res);
    case 'PUT':
    case 'PATCH':
      if (!id) return res.status(400).json({ error: 'Debridement ID required' });
      return await updateDebridement(id, req.body, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createDebridement(data, user, res) {
  const {
    assessmentId, patientId, hospitalNumber, patientName, debridementNumber,
    surgeon, assistant, anesthesiaType, findings, tissueDebrided,
    woundDimensions, woundBedStatus, marginsViable, culturesSent,
    estimatedBloodLoss, dressingApplied, vacApplied, vacSettings,
    nextPlannedDebridement, photos, complications, notes
  } = data;

  const result = await query(
    `INSERT INTO sti_debridements (
      assessment_id, patient_id, hospital_number, patient_name, debridement_number,
      surgeon, assistant, anesthesia_type, findings, tissue_debrided,
      wound_dimensions, wound_bed_status, margins_viable, cultures_sent,
      estimated_blood_loss, dressing_applied, vac_applied, vac_settings,
      next_planned_debridement, photos, complications, notes, created_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
    RETURNING *`,
    [
      assessmentId, patientId, hospitalNumber, patientName, debridementNumber || 1,
      surgeon, assistant, anesthesiaType, findings, tissueDebrided,
      JSON.stringify(woundDimensions || {}), woundBedStatus, marginsViable, culturesSent || false,
      estimatedBloodLoss, dressingApplied, vacApplied || false, JSON.stringify(vacSettings || {}),
      nextPlannedDebridement, JSON.stringify(photos || []), complications, notes, user.id
    ]
  );

  res.status(201).json({ debridement: result.rows[0] });
}

async function updateDebridement(id, data, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  const fieldMap = {
    findings: 'findings', tissueDebrided: 'tissue_debrided',
    woundDimensions: 'wound_dimensions', woundBedStatus: 'wound_bed_status',
    marginsViable: 'margins_viable', culturesSent: 'cultures_sent',
    estimatedBloodLoss: 'estimated_blood_loss', dressingApplied: 'dressing_applied',
    vacApplied: 'vac_applied', vacSettings: 'vac_settings',
    nextPlannedDebridement: 'next_planned_debridement', photos: 'photos',
    complications: 'complications', notes: 'notes'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      const val = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
      fields.push(`${dbField} = $${paramCount}`);
      values.push(val);
      paramCount++;
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE sti_debridements SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Debridement not found' });
  res.status(200).json({ debridement: result.rows[0] });
}

// ============================================
// ORDERS (Auto-generated from protocol)
// ============================================
async function handleOrders(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET': {
      const patientId = url.searchParams.get('patientId');
      const status = url.searchParams.get('status');
      let q = "SELECT * FROM protocol_orders WHERE module = 'sti'";
      const p = [];
      let pc = 1;
      if (patientId) { q += ` AND patient_id = $${pc}`; p.push(patientId); pc++; }
      if (status) { q += ` AND status = $${pc}`; p.push(status); pc++; }
      q += ' ORDER BY created_at DESC';
      const r = await query(q, p);
      return res.status(200).json({ orders: r.rows });
    }
    case 'PUT':
    case 'PATCH':
      if (!id) return res.status(400).json({ error: 'Order ID required' });
      return await updateOrder(id, req.body, auth.user, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function updateOrder(id, data, user, res) {
  const fields = [];
  const values = [];
  let paramCount = 1;

  if (data.status) {
    fields.push(`status = $${paramCount}`); values.push(data.status); paramCount++;
    
    if (data.status === 'approved') {
      fields.push(`approved_by = $${paramCount}`); values.push(user.id); paramCount++;
      fields.push(`approved_at = NOW()`);
      
      // Auto-create the actual prescription/lab order
      const orderResult = await query('SELECT * FROM protocol_orders WHERE id = $1', [id]);
      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];
        await executeProtocolOrder(order, user);
      }
    }
    if (data.status === 'completed') {
      fields.push(`completed_at = NOW()`);
    }
  }

  if (data.trackingStatus) {
    fields.push(`tracking_status = $${paramCount}`); values.push(data.trackingStatus); paramCount++;
  }
  if (data.trackingNotes) {
    fields.push(`tracking_notes = $${paramCount}`); values.push(data.trackingNotes); paramCount++;
  }
  if (data.result) {
    fields.push(`result = $${paramCount}`); values.push(data.result); paramCount++;
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE protocol_orders SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.status(200).json({ order: result.rows[0] });
}

// ============================================
// CME COMPLETION
// ============================================
async function handleCME(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET': {
      const userId = url.searchParams.get('userId') || auth.user.id;
      const result = await query(
        "SELECT * FROM protocol_cme_completions WHERE user_id = $1 AND module = 'sti' ORDER BY completed_at DESC",
        [userId]
      );
      return res.status(200).json({ completions: result.rows });
    }
    case 'POST':
      return await recordCMECompletion(req.body, auth.user, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function recordCMECompletion(data, user, res) {
  const { articleId, score, totalQuestions, correctAnswers, answers, passed, creditsEarned } = data;

  const result = await query(
    `INSERT INTO protocol_cme_completions (
      user_id, module, article_id, score, total_questions, correct_answers,
      answers, passed, credits_earned
    ) VALUES ($1,'sti',$2,$3,$4,$5,$6,$7,$8)
    RETURNING *`,
    [user.id, articleId, score, totalQuestions, correctAnswers, JSON.stringify(answers || []), passed || false, creditsEarned || 0]
  );

  res.status(201).json({ completion: result.rows[0] });
}

// ============================================
// AUTO-ORDER GENERATION
// ============================================
async function generateProtocolOrders(treatmentPlan, user, module) {
  const orders = [];
  const tp = treatmentPlan;

  // Generate prescription orders from antibiotics
  const antibiotics = typeof tp.antibiotics === 'string' ? JSON.parse(tp.antibiotics) : (tp.antibiotics || []);
  for (const abx of antibiotics) {
    orders.push({
      treatment_plan_id: tp.id,
      patient_id: tp.patient_id,
      hospital_number: tp.hospital_number,
      patient_name: tp.patient_name,
      module,
      order_type: 'prescription',
      order_category: 'antibiotic',
      order_details: JSON.stringify(abx),
      priority: tp.severity === 'critical' || tp.severity === 'severe' ? 'stat' : 'urgent',
      status: 'approved',
      approved_by: user.id,
      created_by: user.id
    });
  }

  // Generate lab orders from monitoring plan
  const monitoring = typeof tp.monitoring_plan === 'string' ? JSON.parse(tp.monitoring_plan) : (tp.monitoring_plan || []);
  for (const item of monitoring) {
    if (typeof item === 'string' && (item.toLowerCase().includes('blood') || item.toLowerCase().includes('lab') || item.toLowerCase().includes('cbc') || item.toLowerCase().includes('crp'))) {
      orders.push({
        treatment_plan_id: tp.id,
        patient_id: tp.patient_id,
        hospital_number: tp.hospital_number,
        patient_name: tp.patient_name,
        module,
        order_type: 'lab',
        order_category: 'monitoring',
        order_details: JSON.stringify({ test: item, frequency: 'as per protocol' }),
        priority: 'routine',
        status: 'approved',
        approved_by: user.id,
        created_by: user.id
      });
    }
  }

  // Generate surgical procedure orders
  const surgicals = typeof tp.surgical_interventions === 'string' ? JSON.parse(tp.surgical_interventions) : (tp.surgical_interventions || []);
  for (const surg of surgicals) {
    orders.push({
      treatment_plan_id: tp.id,
      patient_id: tp.patient_id,
      hospital_number: tp.hospital_number,
      patient_name: tp.patient_name,
      module,
      order_type: 'procedure',
      order_category: 'surgical',
      order_details: JSON.stringify(surg),
      priority: tp.severity === 'critical' || tp.severity === 'severe' ? 'stat' : 'urgent',
      status: 'pending_approval',
      created_by: user.id
    });
  }

  // Insert all orders
  for (const order of orders) {
    try {
      await query(
        `INSERT INTO protocol_orders (
          treatment_plan_id, patient_id, hospital_number, patient_name,
          module, order_type, order_category, order_details, priority,
          status, approved_by, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          order.treatment_plan_id, order.patient_id, order.hospital_number, order.patient_name,
          order.module, order.order_type, order.order_category, order.order_details,
          order.priority, order.status, order.approved_by || null, order.created_by
        ]
      );
    } catch (e) {
      console.error('Error creating protocol order:', e);
    }
  }

  // Auto-execute approved prescription orders
  for (const order of orders) {
    if (order.status === 'approved' && order.order_type === 'prescription') {
      try {
        const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details;
        await query(
          `INSERT INTO prescriptions (
            patient_id, medication_name, dosage, frequency, duration, route, instructions, status, prescribed_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8)`,
          [
            order.patient_id,
            details.drug || details.medication || 'Unknown',
            details.dose || details.dosage || '',
            details.frequency || '',
            details.duration || '',
            details.route || 'Oral',
            `Protocol: ${module.toUpperCase()} - ${details.indication || ''}`,
            user.id
          ]
        );
      } catch (e) {
        console.error('Error auto-creating prescription:', e);
      }
    }
    
    if (order.status === 'approved' && order.order_type === 'lab') {
      try {
        const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details;
        await query(
          `INSERT INTO lab_orders (
            patient_id, test_type, test_name, priority, clinical_indication, status, ordered_by
          ) VALUES ($1,$2,$3,$4,$5,'pending',$6)`,
          [
            order.patient_id,
            'protocol_monitoring',
            details.test || 'Protocol Lab',
            order.priority || 'routine',
            `${module.toUpperCase()} Protocol Monitoring`,
            user.id
          ]
        );
      } catch (e) {
        console.error('Error auto-creating lab order:', e);
      }
    }
  }
}

async function executeProtocolOrder(order, user) {
  const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details;
  
  try {
    if (order.order_type === 'prescription') {
      const result = await query(
        `INSERT INTO prescriptions (
          patient_id, medication_name, dosage, frequency, duration, route, instructions, status, prescribed_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING id`,
        [
          order.patient_id,
          details.drug || details.medication || 'Unknown',
          details.dose || details.dosage || '',
          details.frequency || '',
          details.duration || '',
          details.route || 'Oral',
          `Protocol: ${order.module.toUpperCase()} - ${details.indication || ''}`,
          user.id
        ]
      );
      await query('UPDATE protocol_orders SET linked_prescription_id = $1, executed_at = NOW(), executed_by = $2 WHERE id = $3',
        [result.rows[0].id, user.id, order.id]);
    }
    
    if (order.order_type === 'lab') {
      const result = await query(
        `INSERT INTO lab_orders (
          patient_id, test_type, test_name, priority, clinical_indication, status, ordered_by
        ) VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id`,
        [
          order.patient_id,
          details.category || 'protocol',
          details.test || details.testName || 'Protocol Lab',
          order.priority || 'routine',
          `${order.module.toUpperCase()} Protocol - ${details.rationale || ''}`,
          user.id
        ]
      );
      await query('UPDATE protocol_orders SET linked_lab_order_id = $1, executed_at = NOW(), executed_by = $2 WHERE id = $3',
        [result.rows[0].id, user.id, order.id]);
    }
  } catch (e) {
    console.error('Error executing protocol order:', e);
  }
}
