// Keloid Care Planning API endpoint for Vercel serverless
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
  const pathParts = url.pathname.replace('/api/keloid-care', '').split('/').filter(Boolean);
  const planId = pathParts[0];
  const subResource = pathParts[1]; // e.g., 'injections', 'tests', 'radiotherapy'

  try {
    switch (method) {
      case 'GET':
        if (planId && subResource === 'injections') {
          return await getInjections(planId, res);
        }
        if (planId && subResource === 'tests') {
          return await getPreTreatmentTests(planId, res);
        }
        if (planId) {
          return await getPlan(planId, res);
        }
        return await getAllPlans(url.searchParams, res);
      case 'POST':
        if (planId && subResource === 'injections') {
          return await addInjection(planId, req.body, auth.user, res);
        }
        if (planId && subResource === 'tests') {
          return await addTest(planId, req.body, auth.user, res);
        }
        return await createPlan(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!planId) {
          return res.status(400).json({ error: 'Plan ID required' });
        }
        if (subResource === 'injections') {
          const injectionId = pathParts[2];
          return await updateInjection(injectionId, req.body, res);
        }
        if (subResource === 'tests') {
          const testId = pathParts[2];
          return await updateTest(testId, req.body, res);
        }
        return await updatePlan(planId, req.body, res);
      case 'DELETE':
        if (!planId) {
          return res.status(400).json({ error: 'Plan ID required' });
        }
        return await deletePlan(planId, res);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Keloid Care API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Create keloid care tables if they don't exist
async function ensureTables() {
  // Main keloid care plans table
  await query(`
    CREATE TABLE IF NOT EXISTS keloid_care_plans (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      clinical_summary TEXT NOT NULL,
      keloid_locations TEXT[] DEFAULT '{}',
      problems_concerns TEXT[] DEFAULT '{}',
      comorbidities TEXT[] DEFAULT '{}',
      has_no_comorbidities BOOLEAN DEFAULT FALSE,
      risk_factors TEXT[] DEFAULT '{}',
      
      -- Pre-op treatment
      preop_triamcinolone_count INTEGER DEFAULT 0,
      preop_injection_interval_weeks INTEGER DEFAULT 3,
      
      -- Surgery details
      surgery_planned BOOLEAN DEFAULT FALSE,
      surgery_date DATE,
      surgery_technique TEXT,
      surgery_notes TEXT,
      
      -- Post-op treatment
      postop_triamcinolone_count INTEGER DEFAULT 0,
      postop_injection_interval_weeks INTEGER DEFAULT 3,
      
      -- Adjunct therapy
      silicone_sheet_start_date DATE,
      silicone_sheet_duration_months INTEGER,
      compression_therapy_start_date DATE,
      compression_therapy_duration_months INTEGER,
      
      -- Radiotherapy
      radiotherapy_indicated BOOLEAN DEFAULT FALSE,
      radiotherapy_indications TEXT[] DEFAULT '{}',
      radiotherapy_timing TEXT,
      radiotherapy_dose TEXT,
      radiotherapy_fractions INTEGER,
      radiotherapy_side_effects TEXT[] DEFAULT '{}',
      radiotherapy_management TEXT,
      
      -- Status tracking
      status VARCHAR(50) DEFAULT 'active',
      phase VARCHAR(50) DEFAULT 'pre_treatment',
      compliance_notes TEXT,
      
      -- Audit fields
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pre-treatment tests table
  await query(`
    CREATE TABLE IF NOT EXISTS keloid_pretreatment_tests (
      id SERIAL PRIMARY KEY,
      keloid_plan_id INTEGER NOT NULL REFERENCES keloid_care_plans(id) ON DELETE CASCADE,
      test_type VARCHAR(100) NOT NULL,
      test_name VARCHAR(255) NOT NULL,
      ordered_date DATE NOT NULL,
      result_date DATE,
      result_value TEXT,
      result_status VARCHAR(50) DEFAULT 'pending',
      is_within_normal BOOLEAN,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Triamcinolone injection tracking table
  await query(`
    CREATE TABLE IF NOT EXISTS keloid_injections (
      id SERIAL PRIMARY KEY,
      keloid_plan_id INTEGER NOT NULL REFERENCES keloid_care_plans(id) ON DELETE CASCADE,
      injection_number INTEGER NOT NULL,
      injection_phase VARCHAR(20) NOT NULL, -- 'preop' or 'postop'
      scheduled_date DATE NOT NULL,
      actual_date DATE,
      dose_mg DECIMAL(10,2),
      concentration VARCHAR(50),
      volume_ml DECIMAL(10,2),
      injection_site TEXT,
      response_notes TEXT,
      adverse_effects TEXT,
      administered_by INTEGER REFERENCES users(id),
      status VARCHAR(50) DEFAULT 'scheduled',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getAllPlans(searchParams, res) {
  await ensureTables();
  
  const patientId = searchParams.get('patientId');
  const status = searchParams.get('status');

  let queryStr = `
    SELECT kcp.*, 
           p.first_name, p.last_name, p.hospital_number, p.date_of_birth, p.gender,
           u.full_name as created_by_name
    FROM keloid_care_plans kcp
    LEFT JOIN patients p ON kcp.patient_id = p.id
    LEFT JOIN users u ON kcp.created_by = u.id
    WHERE 1=1
  `;
  const params = [];
  let paramCount = 1;

  if (patientId) {
    queryStr += ` AND kcp.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  if (status) {
    queryStr += ` AND kcp.status = $${paramCount}`;
    params.push(status);
    paramCount++;
  }

  queryStr += ` ORDER BY kcp.created_at DESC`;

  const result = await query(queryStr, params);

  // Get injection counts for each plan
  for (const plan of result.rows) {
    const injectionsResult = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE injection_phase = 'preop' AND status = 'completed') as preop_completed,
        COUNT(*) FILTER (WHERE injection_phase = 'postop' AND status = 'completed') as postop_completed,
        COUNT(*) FILTER (WHERE status = 'scheduled') as scheduled_count
       FROM keloid_injections WHERE keloid_plan_id = $1`,
      [plan.id]
    );
    plan.injection_stats = injectionsResult.rows[0] || {};
  }

  res.status(200).json({ keloidPlans: result.rows });
}

async function getPlan(id, res) {
  await ensureTables();
  
  const result = await query(
    `SELECT kcp.*, 
            p.first_name, p.last_name, p.hospital_number, p.date_of_birth, p.gender,
            u.full_name as created_by_name
     FROM keloid_care_plans kcp
     LEFT JOIN patients p ON kcp.patient_id = p.id
     LEFT JOIN users u ON kcp.created_by = u.id
     WHERE kcp.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Keloid care plan not found' });
  }

  const plan = result.rows[0];

  // Get all injections for this plan
  const injectionsResult = await query(
    `SELECT ki.*, u.full_name as administered_by_name
     FROM keloid_injections ki
     LEFT JOIN users u ON ki.administered_by = u.id
     WHERE ki.keloid_plan_id = $1
     ORDER BY ki.injection_phase, ki.injection_number`,
    [id]
  );
  plan.injections = injectionsResult.rows;

  // Get all pre-treatment tests
  const testsResult = await query(
    `SELECT * FROM keloid_pretreatment_tests WHERE keloid_plan_id = $1 ORDER BY ordered_date`,
    [id]
  );
  plan.pretreatment_tests = testsResult.rows;

  res.status(200).json({ keloidPlan: plan });
}

async function createPlan(data, user, res) {
  await ensureTables();
  
  const {
    patientId,
    clinicalSummary,
    keloidLocations,
    problemsConcerns,
    comorbidities,
    hasNoComorbidities,
    riskFactors,
    preopTriamcinoloneCount,
    preopInjectionIntervalWeeks,
    surgeryPlanned,
    surgeryDate,
    surgeryTechnique,
    surgeryNotes,
    postopTriamcinoloneCount,
    postopInjectionIntervalWeeks,
    siliconeSheetStartDate,
    siliconeSheetDurationMonths,
    compressionTherapyStartDate,
    compressionTherapyDurationMonths,
    radiotherapyIndicated,
    radiotherapyIndications,
    radiotherapyTiming,
    radiotherapyDose,
    radiotherapyFractions,
    radiotherapySideEffects,
    radiotherapyManagement,
    complianceNotes
  } = data;

  const result = await query(
    `INSERT INTO keloid_care_plans (
      patient_id, clinical_summary, keloid_locations, problems_concerns,
      comorbidities, has_no_comorbidities, risk_factors,
      preop_triamcinolone_count, preop_injection_interval_weeks,
      surgery_planned, surgery_date, surgery_technique, surgery_notes,
      postop_triamcinolone_count, postop_injection_interval_weeks,
      silicone_sheet_start_date, silicone_sheet_duration_months,
      compression_therapy_start_date, compression_therapy_duration_months,
      radiotherapy_indicated, radiotherapy_indications, radiotherapy_timing,
      radiotherapy_dose, radiotherapy_fractions, radiotherapy_side_effects,
      radiotherapy_management, compliance_notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28)
    RETURNING *`,
    [
      patientId, clinicalSummary, keloidLocations || [], problemsConcerns || [],
      comorbidities || [], hasNoComorbidities || false, riskFactors || [],
      preopTriamcinoloneCount || 0, preopInjectionIntervalWeeks || 3,
      surgeryPlanned || false, surgeryDate || null, surgeryTechnique || null, surgeryNotes || null,
      postopTriamcinoloneCount || 0, postopInjectionIntervalWeeks || 3,
      siliconeSheetStartDate || null, siliconeSheetDurationMonths || null,
      compressionTherapyStartDate || null, compressionTherapyDurationMonths || null,
      radiotherapyIndicated || false, radiotherapyIndications || [], radiotherapyTiming || null,
      radiotherapyDose || null, radiotherapyFractions || null, radiotherapySideEffects || [],
      radiotherapyManagement || null, complianceNotes || null, user.id
    ]
  );

  const newPlan = result.rows[0];

  // Create scheduled injections for pre-op
  if (preopTriamcinoloneCount > 0) {
    const startDate = new Date();
    for (let i = 0; i < preopTriamcinoloneCount; i++) {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + (i * (preopInjectionIntervalWeeks || 3) * 7));
      
      await query(
        `INSERT INTO keloid_injections (keloid_plan_id, injection_number, injection_phase, scheduled_date)
         VALUES ($1, $2, 'preop', $3)`,
        [newPlan.id, i + 1, scheduledDate.toISOString().split('T')[0]]
      );
    }
  }

  // Create scheduled injections for post-op (starting from surgery date)
  if (postopTriamcinoloneCount > 0 && surgeryPlanned && surgeryDate) {
    const startDate = new Date(surgeryDate);
    for (let i = 0; i < postopTriamcinoloneCount; i++) {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + ((i + 1) * (postopInjectionIntervalWeeks || 3) * 7));
      
      await query(
        `INSERT INTO keloid_injections (keloid_plan_id, injection_number, injection_phase, scheduled_date)
         VALUES ($1, $2, 'postop', $3)`,
        [newPlan.id, i + 1, scheduledDate.toISOString().split('T')[0]]
      );
    }
  }

  res.status(201).json({ keloidPlan: newPlan, message: 'Keloid care plan created successfully' });
}

async function updatePlan(id, data, res) {
  const updateFields = [];
  const params = [];
  let paramCount = 1;

  const fieldMappings = {
    clinicalSummary: 'clinical_summary',
    keloidLocations: 'keloid_locations',
    problemsConcerns: 'problems_concerns',
    comorbidities: 'comorbidities',
    hasNoComorbidities: 'has_no_comorbidities',
    riskFactors: 'risk_factors',
    preopTriamcinoloneCount: 'preop_triamcinolone_count',
    preopInjectionIntervalWeeks: 'preop_injection_interval_weeks',
    surgeryPlanned: 'surgery_planned',
    surgeryDate: 'surgery_date',
    surgeryTechnique: 'surgery_technique',
    surgeryNotes: 'surgery_notes',
    postopTriamcinoloneCount: 'postop_triamcinolone_count',
    postopInjectionIntervalWeeks: 'postop_injection_interval_weeks',
    siliconeSheetStartDate: 'silicone_sheet_start_date',
    siliconeSheetDurationMonths: 'silicone_sheet_duration_months',
    compressionTherapyStartDate: 'compression_therapy_start_date',
    compressionTherapyDurationMonths: 'compression_therapy_duration_months',
    radiotherapyIndicated: 'radiotherapy_indicated',
    radiotherapyIndications: 'radiotherapy_indications',
    radiotherapyTiming: 'radiotherapy_timing',
    radiotherapyDose: 'radiotherapy_dose',
    radiotherapyFractions: 'radiotherapy_fractions',
    radiotherapySideEffects: 'radiotherapy_side_effects',
    radiotherapyManagement: 'radiotherapy_management',
    status: 'status',
    phase: 'phase',
    complianceNotes: 'compliance_notes'
  };

  for (const [camelCase, snakeCase] of Object.entries(fieldMappings)) {
    if (data[camelCase] !== undefined) {
      updateFields.push(`${snakeCase} = $${paramCount}`);
      params.push(data[camelCase]);
      paramCount++;
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const result = await query(
    `UPDATE keloid_care_plans SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Keloid care plan not found' });
  }

  res.status(200).json({ keloidPlan: result.rows[0], message: 'Plan updated successfully' });
}

async function deletePlan(id, res) {
  const result = await query(
    'DELETE FROM keloid_care_plans WHERE id = $1 RETURNING id',
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Keloid care plan not found' });
  }

  res.status(200).json({ message: 'Keloid care plan deleted successfully' });
}

// Injection management
async function getInjections(planId, res) {
  const result = await query(
    `SELECT ki.*, u.full_name as administered_by_name
     FROM keloid_injections ki
     LEFT JOIN users u ON ki.administered_by = u.id
     WHERE ki.keloid_plan_id = $1
     ORDER BY ki.injection_phase, ki.injection_number`,
    [planId]
  );
  res.status(200).json({ injections: result.rows });
}

async function addInjection(planId, data, user, res) {
  const {
    injectionNumber,
    injectionPhase,
    scheduledDate,
    actualDate,
    doseMg,
    concentration,
    volumeMl,
    injectionSite,
    responseNotes,
    adverseEffects,
    status
  } = data;

  const result = await query(
    `INSERT INTO keloid_injections (
      keloid_plan_id, injection_number, injection_phase, scheduled_date,
      actual_date, dose_mg, concentration, volume_ml, injection_site,
      response_notes, adverse_effects, administered_by, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      planId, injectionNumber, injectionPhase, scheduledDate,
      actualDate || null, doseMg || null, concentration || null, volumeMl || null,
      injectionSite || null, responseNotes || null, adverseEffects || null,
      actualDate ? user.id : null, status || 'scheduled'
    ]
  );

  res.status(201).json({ injection: result.rows[0] });
}

async function updateInjection(id, data, res) {
  const updateFields = [];
  const params = [];
  let paramCount = 1;

  const fields = ['actual_date', 'dose_mg', 'concentration', 'volume_ml', 
                  'injection_site', 'response_notes', 'adverse_effects', 
                  'administered_by', 'status'];
  
  const dataFields = ['actualDate', 'doseMg', 'concentration', 'volumeMl',
                      'injectionSite', 'responseNotes', 'adverseEffects',
                      'administeredBy', 'status'];

  for (let i = 0; i < fields.length; i++) {
    if (data[dataFields[i]] !== undefined) {
      updateFields.push(`${fields[i]} = $${paramCount}`);
      params.push(data[dataFields[i]]);
      paramCount++;
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const result = await query(
    `UPDATE keloid_injections SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Injection record not found' });
  }

  res.status(200).json({ injection: result.rows[0] });
}

// Pre-treatment tests management
async function getPreTreatmentTests(planId, res) {
  const result = await query(
    `SELECT * FROM keloid_pretreatment_tests WHERE keloid_plan_id = $1 ORDER BY ordered_date`,
    [planId]
  );
  res.status(200).json({ tests: result.rows });
}

async function addTest(planId, data, user, res) {
  const { testType, testName, orderedDate, resultDate, resultValue, resultStatus, isWithinNormal, notes } = data;

  const result = await query(
    `INSERT INTO keloid_pretreatment_tests (
      keloid_plan_id, test_type, test_name, ordered_date, result_date,
      result_value, result_status, is_within_normal, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [planId, testType, testName, orderedDate, resultDate || null, resultValue || null,
     resultStatus || 'pending', isWithinNormal || null, notes || null, user.id]
  );

  res.status(201).json({ test: result.rows[0] });
}

async function updateTest(id, data, res) {
  const updateFields = [];
  const params = [];
  let paramCount = 1;

  const fields = ['result_date', 'result_value', 'result_status', 'is_within_normal', 'notes'];
  const dataFields = ['resultDate', 'resultValue', 'resultStatus', 'isWithinNormal', 'notes'];

  for (let i = 0; i < fields.length; i++) {
    if (data[dataFields[i]] !== undefined) {
      updateFields.push(`${fields[i]} = $${paramCount}`);
      params.push(data[dataFields[i]]);
      paramCount++;
    }
  }

  if (updateFields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(id);

  const result = await query(
    `UPDATE keloid_pretreatment_tests SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    params
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Test record not found' });
  }

  res.status(200).json({ test: result.rows[0] });
}
