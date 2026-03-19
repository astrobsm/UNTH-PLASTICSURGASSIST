// Pressure Sore Management Protocol API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/pressure-sore-protocol', '').split('/').filter(Boolean);
  const resource = pathParts[0];
  const resourceId = pathParts[1];

  try {
    switch (resource) {
      case 'wounds':
        return await handleWounds(method, resourceId, req, auth, url, res);
      case 'treatment-plans':
        return await handleTreatmentPlans(method, resourceId, req, auth, url, res);
      case 'progress':
        return await handleProgress(method, resourceId, req, auth, url, res);
      case 'braden':
        return await handleBraden(method, resourceId, req, auth, url, res);
      case 'orders':
        return await handleOrders(method, resourceId, req, auth, url, res);
      case 'cme':
        return await handleCME(method, resourceId, req, auth, url, res);
      default:
        if (method === 'GET') {
          return await handleWounds('GET', null, req, auth, url, res);
        }
        return res.status(404).json({ error: 'Resource not found. Use: wounds, treatment-plans, progress, braden, orders, cme' });
    }
  } catch (error) {
    console.error('Pressure Sore Protocol API error:', error);
    // If tables don't exist yet, return empty results for GET requests
    if (error.message && error.message.includes('does not exist') && method === 'GET') {
      return res.status(200).json({ wounds: [], treatmentPlans: [], progress: [], orders: [] });
    }
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ============================================
// WOUNDS
// ============================================
async function handleWounds(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET':
      if (id) return await getWound(id, res);
      return await getAllWounds(url.searchParams, res);
    case 'POST':
      return await createWound(req.body, auth.user, res);
    case 'PUT':
    case 'PATCH':
      if (!id) return res.status(400).json({ error: 'Wound ID required' });
      return await updateWound(id, req.body, res);
    case 'DELETE':
      if (!id) return res.status(400).json({ error: 'Wound ID required' });
      return await deleteWound(id, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function getAllWounds(searchParams, res) {
  const patientId = searchParams.get('patientId');
  const stage = searchParams.get('stage');
  const status = searchParams.get('status');

  let q = `
    SELECT psw.*, p.first_name, p.last_name, p.hospital_number as p_hospital_number
    FROM pressure_sore_wounds psw
    LEFT JOIN patients p ON psw.patient_id = p.id
    WHERE 1=1
  `;
  const params = [];
  let pc = 1;

  if (patientId) { q += ` AND psw.patient_id = $${pc}`; params.push(patientId); pc++; }
  if (stage) { q += ` AND psw.current_stage = $${pc}`; params.push(stage); pc++; }
  if (status) { q += ` AND psw.status = $${pc}`; params.push(status); pc++; }

  q += ` ORDER BY psw.created_at DESC`;
  const result = await query(q, params);
  res.status(200).json({ wounds: result.rows });
}

async function getWound(id, res) {
  const result = await query(
    `SELECT psw.*, p.first_name, p.last_name, p.hospital_number as p_hospital_number
     FROM pressure_sore_wounds psw
     LEFT JOIN patients p ON psw.patient_id = p.id
     WHERE psw.id = $1`, [id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Wound not found' });

  const plans = await query('SELECT * FROM pressure_sore_treatment_plans WHERE wound_id = $1 ORDER BY created_at DESC', [id]);
  const progress = await query('SELECT * FROM pressure_sore_progress WHERE wound_id = $1 ORDER BY assessment_date DESC', [id]);
  const orders = await query(
    "SELECT * FROM protocol_orders WHERE treatment_plan_id IN (SELECT id FROM pressure_sore_treatment_plans WHERE wound_id = $1) AND module = 'pressure_sore' ORDER BY created_at DESC",
    [id]
  );

  res.status(200).json({
    wound: result.rows[0],
    treatmentPlans: plans.rows,
    progress: progress.rows,
    orders: orders.rows
  });
}

async function createWound(data, user, res) {
  const {
    patientId, hospitalNumber, patientName, assessmentId, location, laterality,
    currentStage, initialStage, woundLength, woundWidth, woundDepth,
    undermining, underminingDetails, tunneling, tunnelingDetails,
    woundBedTissue, granulationPercent, sloughPercent, eschарPercent,
    exudateType, exudateAmount, woundEdges, periWoundSkin,
    infectionSigns, probeToBone, odor, painLevel,
    bradenScore, bradenRisk, photos, notes
  } = data;

  // Fix the escharPercent handling
  const escharPercent = data.escharPercent || data['eschарPercent'] || 0;

  if (!patientId || !location || !currentStage) {
    return res.status(400).json({ error: 'Patient ID, location, and current stage are required' });
  }

  const result = await query(
    `INSERT INTO pressure_sore_wounds (
      patient_id, hospital_number, patient_name, assessment_id, location, laterality,
      current_stage, initial_stage, wound_length, wound_width, wound_depth,
      undermining, undermining_details, tunneling, tunneling_details,
      wound_bed_tissue, granulation_percent, slough_percent, eschar_percent,
      exudate_type, exudate_amount, wound_edges, peri_wound_skin,
      infection_signs, probe_to_bone, odor, pain_level,
      braden_score, braden_risk, photos, notes, assessed_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32)
    RETURNING *`,
    [
      patientId, hospitalNumber, patientName, assessmentId, location, laterality,
      currentStage, initialStage || currentStage,
      woundLength, woundWidth, woundDepth,
      undermining || false, underminingDetails,
      tunneling || false, tunnelingDetails,
      JSON.stringify(woundBedTissue || {}),
      granulationPercent || 0, sloughPercent || 0, escharPercent,
      exudateType, exudateAmount, woundEdges, periWoundSkin,
      JSON.stringify(infectionSigns || []), probeToBone || false, odor || false, painLevel,
      bradenScore, bradenRisk,
      JSON.stringify(photos || []), notes, user.id
    ]
  );

  // Audit log
  try {
    await query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, new_values)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'CREATE', 'pressure_sore_wound', result.rows[0].id,
       JSON.stringify({ location, currentStage, patientId })]
    );
  } catch (e) { console.error('Audit log error:', e); }

  res.status(201).json({ wound: result.rows[0] });
}

async function updateWound(id, data, res) {
  const fields = [];
  const values = [];
  let pc = 1;

  const fieldMap = {
    currentStage: 'current_stage', location: 'location', laterality: 'laterality',
    woundLength: 'wound_length', woundWidth: 'wound_width', woundDepth: 'wound_depth',
    undermining: 'undermining', underminingDetails: 'undermining_details',
    tunneling: 'tunneling', tunnelingDetails: 'tunneling_details',
    woundBedTissue: 'wound_bed_tissue', granulationPercent: 'granulation_percent',
    sloughPercent: 'slough_percent', escharPercent: 'eschar_percent',
    exudateType: 'exudate_type', exudateAmount: 'exudate_amount',
    woundEdges: 'wound_edges', periWoundSkin: 'peri_wound_skin',
    infectionSigns: 'infection_signs', probeToBone: 'probe_to_bone',
    odor: 'odor', painLevel: 'pain_level',
    bradenScore: 'braden_score', bradenRisk: 'braden_risk',
    photos: 'photos', notes: 'notes', status: 'status'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      const val = typeof data[key] === 'object' && data[key] !== null ? JSON.stringify(data[key]) : data[key];
      fields.push(`${dbField} = $${pc}`);
      values.push(val);
      pc++;
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE pressure_sore_wounds SET ${fields.join(', ')} WHERE id = $${pc} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Wound not found' });
  res.status(200).json({ wound: result.rows[0] });
}

async function deleteWound(id, res) {
  const result = await query('DELETE FROM pressure_sore_wounds WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Wound not found' });
  res.status(200).json({ message: 'Wound deleted successfully' });
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
  const woundId = searchParams.get('woundId');
  let q = 'SELECT * FROM pressure_sore_treatment_plans WHERE 1=1';
  const p = [];
  let pc = 1;
  if (patientId) { q += ` AND patient_id = $${pc}`; p.push(patientId); pc++; }
  if (woundId) { q += ` AND wound_id = $${pc}`; p.push(woundId); pc++; }
  q += ' ORDER BY created_at DESC';
  const result = await query(q, p);
  res.status(200).json({ treatmentPlans: result.rows });
}

async function getTreatmentPlan(id, res) {
  const result = await query('SELECT * FROM pressure_sore_treatment_plans WHERE id = $1', [id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Treatment plan not found' });

  const orders = await query(
    "SELECT * FROM protocol_orders WHERE treatment_plan_id = $1 AND module = 'pressure_sore' ORDER BY created_at DESC",
    [id]
  );
  res.status(200).json({ treatmentPlan: result.rows[0], orders: orders.rows });
}

async function createTreatmentPlan(data, user, res) {
  const {
    woundId, patientId, hospitalNumber, patientName, stage,
    woundCareProtocol, dressingType, dressingFrequency,
    debridementMethod, offloadingDevice, repositioningSchedule,
    nutritionPlan, supplements, antibiotics,
    surgicalPlan, flapOption, consultations,
    goals, reviewDate, notes
  } = data;

  if (!patientId || !woundId) {
    return res.status(400).json({ error: 'Patient ID and wound ID are required' });
  }

  const result = await query(
    `INSERT INTO pressure_sore_treatment_plans (
      wound_id, patient_id, hospital_number, patient_name, stage,
      wound_care_protocol, dressing_type, dressing_frequency,
      debridement_method, offloading_device, repositioning_schedule,
      nutrition_plan, supplements, antibiotics,
      surgical_plan, flap_option, consultations,
      goals, review_date, notes, created_by, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'active')
    RETURNING *`,
    [
      woundId, patientId, hospitalNumber, patientName, stage,
      JSON.stringify(woundCareProtocol || {}), dressingType, dressingFrequency,
      debridementMethod, offloadingDevice, repositioningSchedule,
      JSON.stringify(nutritionPlan || {}), JSON.stringify(supplements || []),
      JSON.stringify(antibiotics || []),
      JSON.stringify(surgicalPlan || {}), flapOption, JSON.stringify(consultations || []),
      JSON.stringify(goals || []), reviewDate, notes, user.id
    ]
  );

  res.status(201).json({ treatmentPlan: result.rows[0] });
}

async function updateTreatmentPlan(id, data, user, res) {
  const fields = [];
  const values = [];
  let pc = 1;

  const fieldMap = {
    woundCareProtocol: 'wound_care_protocol', dressingType: 'dressing_type',
    dressingFrequency: 'dressing_frequency', debridementMethod: 'debridement_method',
    offloadingDevice: 'offloading_device', repositioningSchedule: 'repositioning_schedule',
    nutritionPlan: 'nutrition_plan', supplements: 'supplements',
    antibiotics: 'antibiotics', surgicalPlan: 'surgical_plan',
    flapOption: 'flap_option', consultations: 'consultations',
    goals: 'goals', reviewDate: 'review_date', notes: 'notes', status: 'status'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      const val = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
      fields.push(`${dbField} = $${pc}`);
      values.push(val);
      pc++;
    }
  }

  // Handle approval
  if (data.autoOrdersApproved) {
    fields.push(`auto_orders_approved = $${pc}`); values.push(true); pc++;
    fields.push(`approved_by = $${pc}`); values.push(user.id); pc++;
    fields.push(`approved_at = NOW()`);
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE pressure_sore_treatment_plans SET ${fields.join(', ')} WHERE id = $${pc} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Treatment plan not found' });

  // Auto-generate orders if approved
  if (data.autoOrdersApproved && result.rows[0]) {
    await generatePressureSoreOrders(result.rows[0], user);
  }

  res.status(200).json({ treatmentPlan: result.rows[0] });
}

// ============================================
// PROGRESS NOTES
// ============================================
async function handleProgress(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET':
      if (id) {
        const result = await query('SELECT * FROM pressure_sore_progress WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Progress note not found' });
        return res.status(200).json({ progress: result.rows[0] });
      }
      const woundId = url.searchParams.get('woundId');
      const patientId = url.searchParams.get('patientId');
      let q = 'SELECT * FROM pressure_sore_progress WHERE 1=1';
      const p = [];
      let pc = 1;
      if (woundId) { q += ` AND wound_id = $${pc}`; p.push(woundId); pc++; }
      if (patientId) { q += ` AND patient_id = $${pc}`; p.push(patientId); pc++; }
      q += ' ORDER BY assessment_date DESC';
      const r = await query(q, p);
      return res.status(200).json({ progress: r.rows });

    case 'POST':
      return await createProgress(req.body, auth.user, res);
    case 'PUT':
    case 'PATCH':
      if (!id) return res.status(400).json({ error: 'Progress note ID required' });
      return await updateProgress(id, req.body, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function createProgress(data, user, res) {
  const {
    woundId, patientId, hospitalNumber, patientName,
    woundLength, woundWidth, woundDepth, surfaceArea,
    granulationPercent, sloughPercent, escharPercent,
    exudateType, exudateAmount, woundBedTissue,
    infectionSigns, periWoundStatus,
    healingTrend, healingRate, currentStage,
    repositioningCompliance, nutritionCompliance,
    dressingUsed, painLevel, photos, notes
  } = data;

  if (!woundId || !patientId) {
    return res.status(400).json({ error: 'Wound ID and patient ID are required' });
  }

  // Calculate healing rate if previous measurements exist
  let calculatedHealingRate = healingRate;
  if (!calculatedHealingRate && woundLength && woundWidth) {
    const previous = await query(
      'SELECT wound_length, wound_width, assessment_date FROM pressure_sore_progress WHERE wound_id = $1 ORDER BY assessment_date DESC LIMIT 1',
      [woundId]
    );
    if (previous.rows.length > 0) {
      const prev = previous.rows[0];
      const prevArea = (prev.wound_length || 0) * (prev.wound_width || 0);
      const currArea = (woundLength || 0) * (woundWidth || 0);
      if (prevArea > 0) {
        const daysDiff = Math.max(1, (Date.now() - new Date(prev.assessment_date).getTime()) / (1000 * 60 * 60 * 24));
        calculatedHealingRate = ((prevArea - currArea) / prevArea * 100) / daysDiff * 7; // % per week
      }
    }
  }

  const result = await query(
    `INSERT INTO pressure_sore_progress (
      wound_id, patient_id, hospital_number, patient_name,
      wound_length, wound_width, wound_depth, surface_area,
      granulation_percent, slough_percent, eschar_percent,
      exudate_type, exudate_amount, wound_bed_tissue,
      infection_signs, peri_wound_status,
      healing_trend, healing_rate, current_stage,
      repositioning_compliance, nutrition_compliance,
      dressing_used, pain_level, photos, notes, assessed_by
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
    RETURNING *`,
    [
      woundId, patientId, hospitalNumber, patientName,
      woundLength, woundWidth, woundDepth,
      surfaceArea || (woundLength && woundWidth ? woundLength * woundWidth : null),
      granulationPercent || 0, sloughPercent || 0, escharPercent || 0,
      exudateType, exudateAmount, JSON.stringify(woundBedTissue || {}),
      JSON.stringify(infectionSigns || []), periWoundStatus,
      healingTrend || 'stable', calculatedHealingRate, currentStage,
      repositioningCompliance, nutritionCompliance,
      dressingUsed, painLevel, JSON.stringify(photos || []), notes, user.id
    ]
  );

  // Update wound record with latest measurements
  try {
    await query(
      `UPDATE pressure_sore_wounds SET
        wound_length = $1, wound_width = $2, wound_depth = $3,
        granulation_percent = $4, slough_percent = $5, eschar_percent = $6,
        current_stage = COALESCE($7, current_stage),
        updated_at = NOW()
      WHERE id = $8`,
      [woundLength, woundWidth, woundDepth, granulationPercent, sloughPercent, escharPercent, currentStage, woundId]
    );
  } catch (e) { console.error('Error updating wound from progress:', e); }

  res.status(201).json({ progress: result.rows[0] });
}

async function updateProgress(id, data, res) {
  const fields = [];
  const values = [];
  let pc = 1;

  const fieldMap = {
    woundLength: 'wound_length', woundWidth: 'wound_width', woundDepth: 'wound_depth',
    surfaceArea: 'surface_area', granulationPercent: 'granulation_percent',
    sloughPercent: 'slough_percent', escharPercent: 'eschar_percent',
    exudateType: 'exudate_type', exudateAmount: 'exudate_amount',
    woundBedTissue: 'wound_bed_tissue', infectionSigns: 'infection_signs',
    periWoundStatus: 'peri_wound_status', healingTrend: 'healing_trend',
    healingRate: 'healing_rate', currentStage: 'current_stage',
    repositioningCompliance: 'repositioning_compliance',
    nutritionCompliance: 'nutrition_compliance',
    dressingUsed: 'dressing_used', painLevel: 'pain_level',
    photos: 'photos', notes: 'notes'
  };

  for (const [key, dbField] of Object.entries(fieldMap)) {
    if (data[key] !== undefined) {
      const val = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
      fields.push(`${dbField} = $${pc}`);
      values.push(val);
      pc++;
    }
  }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE pressure_sore_progress SET ${fields.join(', ')} WHERE id = $${pc} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Progress note not found' });
  res.status(200).json({ progress: result.rows[0] });
}

// ============================================
// BRADEN SCALE ASSESSMENTS
// ============================================
async function handleBraden(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET': {
      const patientId = url.searchParams.get('patientId');
      let q = 'SELECT * FROM pressure_sore_assessments WHERE 1=1';
      const p = [];
      let pc = 1;
      if (patientId) { q += ` AND patient_id = $${pc}`; p.push(patientId); pc++; }
      if (id) { q += ` AND id = $${pc}`; p.push(id); pc++; }
      q += ' ORDER BY assessment_date DESC';
      const result = await query(q, p);
      if (id && result.rows.length === 0) return res.status(404).json({ error: 'Braden assessment not found' });
      return res.status(200).json(id ? { assessment: result.rows[0] } : { assessments: result.rows });
    }
    case 'POST': {
      const {
        patientId, hospitalNumber, patientName,
        sensoryPerception, moisture, activity, mobility, nutrition, frictionShear,
        totalScore, riskLevel, interventionPlan, notes
      } = req.body;

      if (!patientId) return res.status(400).json({ error: 'Patient ID required' });

      const calcTotal = (sensoryPerception || 0) + (moisture || 0) + (activity || 0) +
                        (mobility || 0) + (nutrition || 0) + (frictionShear || 0);
      const calcRisk = calcTotal <= 9 ? 'very_high' : calcTotal <= 12 ? 'high' :
                       calcTotal <= 14 ? 'moderate' : calcTotal <= 18 ? 'mild' : 'no_risk';

      const result = await query(
        `INSERT INTO pressure_sore_assessments (
          patient_id, hospital_number, patient_name,
          sensory_perception, moisture, activity, mobility, nutrition, friction_shear,
          total_score, risk_level, intervention_plan, notes, assessed_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [
          patientId, hospitalNumber, patientName,
          sensoryPerception, moisture, activity, mobility, nutrition, frictionShear,
          totalScore || calcTotal, riskLevel || calcRisk,
          JSON.stringify(interventionPlan || []), notes, auth.user.id
        ]
      );
      return res.status(201).json({ assessment: result.rows[0] });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============================================
// ORDERS
// ============================================
async function handleOrders(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET': {
      const patientId = url.searchParams.get('patientId');
      const status = url.searchParams.get('status');
      let q = "SELECT * FROM protocol_orders WHERE module = 'pressure_sore'";
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
      return await updatePSOrder(id, req.body, auth.user, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function updatePSOrder(id, data, user, res) {
  const fields = [];
  const values = [];
  let pc = 1;

  if (data.status) {
    fields.push(`status = $${pc}`); values.push(data.status); pc++;
    if (data.status === 'approved') {
      fields.push(`approved_by = $${pc}`); values.push(user.id); pc++;
      fields.push(`approved_at = NOW()`);
      
      const orderResult = await query('SELECT * FROM protocol_orders WHERE id = $1', [id]);
      if (orderResult.rows.length > 0) {
        await executePSOrder(orderResult.rows[0], user);
      }
    }
    if (data.status === 'completed') { fields.push(`completed_at = NOW()`); }
  }
  if (data.trackingStatus) { fields.push(`tracking_status = $${pc}`); values.push(data.trackingStatus); pc++; }
  if (data.trackingNotes) { fields.push(`tracking_notes = $${pc}`); values.push(data.trackingNotes); pc++; }
  if (data.result) { fields.push(`result = $${pc}`); values.push(data.result); pc++; }

  if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query(
    `UPDATE protocol_orders SET ${fields.join(', ')} WHERE id = $${pc} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
  res.status(200).json({ order: result.rows[0] });
}

// ============================================
// CME
// ============================================
async function handleCME(method, id, req, auth, url, res) {
  switch (method) {
    case 'GET': {
      const userId = url.searchParams.get('userId') || auth.user.id;
      const result = await query(
        "SELECT * FROM protocol_cme_completions WHERE user_id = $1 AND module = 'pressure_sore' ORDER BY completed_at DESC",
        [userId]
      );
      return res.status(200).json({ completions: result.rows });
    }
    case 'POST': {
      const { articleId, score, totalQuestions, correctAnswers, answers, passed, creditsEarned } = req.body;
      const result = await query(
        `INSERT INTO protocol_cme_completions (
          user_id, module, article_id, score, total_questions, correct_answers,
          answers, passed, credits_earned
        ) VALUES ($1,'pressure_sore',$2,$3,$4,$5,$6,$7,$8)
        RETURNING *`,
        [auth.user.id, articleId, score, totalQuestions, correctAnswers,
         JSON.stringify(answers || []), passed || false, creditsEarned || 0]
      );
      return res.status(201).json({ completion: result.rows[0] });
    }
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

// ============================================
// AUTO-ORDER GENERATION FOR PRESSURE SORES
// ============================================
async function generatePressureSoreOrders(treatmentPlan, user) {
  const tp = treatmentPlan;
  const orders = [];

  // Dressing orders
  if (tp.dressing_type) {
    orders.push({
      treatment_plan_id: tp.id, patient_id: tp.patient_id,
      hospital_number: tp.hospital_number, patient_name: tp.patient_name,
      module: 'pressure_sore', order_type: 'procedure', order_category: 'wound_care',
      order_details: JSON.stringify({
        procedure: 'Wound dressing change',
        dressingType: tp.dressing_type,
        frequency: tp.dressing_frequency || 'As per protocol'
      }),
      priority: 'routine', status: 'approved',
      approved_by: user.id, created_by: user.id
    });
  }

  // Nutrition supplements
  const supplements = typeof tp.supplements === 'string' ? JSON.parse(tp.supplements) : (tp.supplements || []);
  for (const supp of supplements) {
    orders.push({
      treatment_plan_id: tp.id, patient_id: tp.patient_id,
      hospital_number: tp.hospital_number, patient_name: tp.patient_name,
      module: 'pressure_sore', order_type: 'prescription', order_category: 'nutrition',
      order_details: JSON.stringify(supp),
      priority: 'routine', status: 'approved',
      approved_by: user.id, created_by: user.id
    });
  }

  // Antibiotics
  const antibiotics = typeof tp.antibiotics === 'string' ? JSON.parse(tp.antibiotics) : (tp.antibiotics || []);
  for (const abx of antibiotics) {
    orders.push({
      treatment_plan_id: tp.id, patient_id: tp.patient_id,
      hospital_number: tp.hospital_number, patient_name: tp.patient_name,
      module: 'pressure_sore', order_type: 'prescription', order_category: 'antibiotic',
      order_details: JSON.stringify(abx),
      priority: 'urgent', status: 'approved',
      approved_by: user.id, created_by: user.id
    });
  }

  // Surgical plan
  const surgicalPlan = typeof tp.surgical_plan === 'string' ? JSON.parse(tp.surgical_plan) : (tp.surgical_plan || {});
  if (surgicalPlan.procedure || surgicalPlan.flapType) {
    orders.push({
      treatment_plan_id: tp.id, patient_id: tp.patient_id,
      hospital_number: tp.hospital_number, patient_name: tp.patient_name,
      module: 'pressure_sore', order_type: 'procedure', order_category: 'surgical',
      order_details: JSON.stringify(surgicalPlan),
      priority: 'urgent', status: 'pending_approval',
      created_by: user.id
    });
  }

  // Lab orders (standard for pressure sore monitoring)
  const standardLabs = ['CBC with differential', 'Serum Albumin', 'Prealbumin', 'CRP'];
  for (const lab of standardLabs) {
    orders.push({
      treatment_plan_id: tp.id, patient_id: tp.patient_id,
      hospital_number: tp.hospital_number, patient_name: tp.patient_name,
      module: 'pressure_sore', order_type: 'lab', order_category: 'monitoring',
      order_details: JSON.stringify({ test: lab, frequency: 'Weekly' }),
      priority: 'routine', status: 'approved',
      approved_by: user.id, created_by: user.id
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
        [order.treatment_plan_id, order.patient_id, order.hospital_number, order.patient_name,
         order.module, order.order_type, order.order_category, order.order_details,
         order.priority, order.status, order.approved_by || null, order.created_by]
      );
    } catch (e) {
      console.error('Error creating PS protocol order:', e);
    }
  }

  // Auto-execute approved orders
  for (const order of orders) {
    if (order.status === 'approved') {
      try {
        await executePSOrder(order, user);
      } catch (e) {
        console.error('Error auto-executing PS order:', e);
      }
    }
  }
}

async function executePSOrder(order, user) {
  const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details;

  try {
    if (order.order_type === 'prescription') {
      const result = await query(
        `INSERT INTO prescriptions (
          patient_id, medication_name, dosage, frequency, duration, route, instructions, status, prescribed_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8) RETURNING id`,
        [
          order.patient_id,
          details.name || details.drug || details.supplement || 'Unknown',
          details.dose || details.dosage || '',
          details.frequency || 'Daily',
          details.duration || '',
          details.route || 'Oral',
          `Pressure Sore Protocol - ${details.indication || details.rationale || ''}`,
          user.id
        ]
      );
      if (order.id) {
        await query('UPDATE protocol_orders SET linked_prescription_id = $1, executed_at = NOW(), executed_by = $2 WHERE id = $3',
          [result.rows[0].id, user.id, order.id]);
      }
    }

    if (order.order_type === 'lab') {
      const result = await query(
        `INSERT INTO lab_orders (
          patient_id, test_type, test_name, priority, clinical_indication, status, ordered_by
        ) VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING id`,
        [
          order.patient_id,
          'pressure_sore_monitoring',
          details.test || 'Protocol Lab',
          order.priority || 'routine',
          'Pressure Sore Protocol Monitoring',
          user.id
        ]
      );
      if (order.id) {
        await query('UPDATE protocol_orders SET linked_lab_order_id = $1, executed_at = NOW(), executed_by = $2 WHERE id = $3',
          [result.rows[0].id, user.id, order.id]);
      }
    }
  } catch (e) {
    console.error('Error executing PS protocol order:', e);
  }
}
