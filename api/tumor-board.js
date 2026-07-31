// Tumor Board API.
//
// Owns the oncology case record: the case identity, its APPEND-ONLY staging
// timeline, the ratified management plans, generated referral letters and the
// surveillance schedule.
//
// Staging, plan generation, letters and counselling are all computed CLIENT-side
// in src/services/oncology/* (pure, unit-tested functions). This endpoint
// persists their output and serves the board aggregate. Keeping the clinical
// logic client-side is deliberate: it works offline, which is the whole point on
// a ward, and it stays unit-testable without a database.
//
// Routes (single file, query-dispatched like api/wounds.js):
//   GET  /api/tumor-board?patientId=123        → cases for a patient
//   GET  /api/tumor-board?action=board         → board worklist aggregate
//   GET  /api/tumor-board?action=detail&id=    → case + assessments + plans + referrals + surveillance
//   GET  /api/tumor-board?action=surveillance  → due/overdue surveillance across all cases
//   POST /api/tumor-board                      → create a case
//   POST /api/tumor-board?action=assess        → append a staging assessment
//   POST /api/tumor-board?action=plan          → save a management plan
//   POST /api/tumor-board?action=referrals     → save generated referral letters
//   POST /api/tumor-board?action=surveillance  → save a surveillance schedule
//   PATCH /api/tumor-board?id=                 → update case
//   PATCH /api/tumor-board?action=referral&id= → update referral status
//   PATCH /api/tumor-board?action=survitem&id= → complete a surveillance item
//   DELETE /api/tumor-board?id=                → close a case
//
// Student tokens are rejected centrally in api/_lib/auth.js.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const CLINICAL_WRITE_ROLES = [
  'admin', 'super_admin', 'consultant', 'senior_registrar',
  'registrar', 'junior_registrar', 'house_officer',
  'intern', 'junior_resident', 'senior_resident',
];

// Ratifying a board decision is a consultant-level act — a house officer may
// draft a plan but must not mark it as the agreed decision of the board.
const RATIFY_ROLES = ['admin', 'super_admin', 'consultant'];

let schemaReady = false;
async function ensureTumorBoardTables() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS tumor_board_cases (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      hospital_number VARCHAR(100),
      tumor_family VARCHAR(60) NOT NULL,
      diagnosis VARCHAR(300),
      primary_site VARCHAR(200),
      laterality VARCHAR(20),
      sarcoma_site VARCHAR(40),
      date_of_diagnosis DATE,
      date_first_presented DATE,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      treatment_intent VARCHAR(30),
      performance_status VARCHAR(60),
      comorbidities TEXT,
      immunosuppressed BOOLEAN DEFAULT FALSE,
      high_risk_site BOOLEAN DEFAULT FALSE,
      recurrent_disease BOOLEAN DEFAULT FALSE,
      fit_for_radical_therapy BOOLEAN,
      braf_mutated BOOLEAN,
      histology_available BOOLEAN DEFAULT FALSE,
      histologic_type VARCHAR(300),
      current_stage_group VARCHAR(30),
      current_stage_formatted VARCHAR(160),
      assessment_count INTEGER NOT NULL DEFAULT 0,
      last_board_date DATE,
      created_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tb_cases_patient ON tumor_board_cases(patient_id);
    CREATE INDEX IF NOT EXISTS idx_tb_cases_status ON tumor_board_cases(status);
    CREATE INDEX IF NOT EXISTS idx_tb_cases_updated ON tumor_board_cases(updated_at);

    CREATE TABLE IF NOT EXISTS tumor_board_assessments (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      basis VARCHAR(30) NOT NULL,
      staging_system VARCHAR(80) NOT NULL,
      assessed_by INTEGER,
      assessed_at TIMESTAMPTZ DEFAULT NOW(),
      inputs JSONB NOT NULL DEFAULT '{}',
      t_category VARCHAR(20), n_category VARCHAR(20), m_category VARCHAR(20),
      stage_group VARCHAR(30), stage_formatted VARCHAR(160), stage_description TEXT,
      caveats JSONB DEFAULT '[]',
      local_spread TEXT, regional_spread TEXT, metastatic_spread TEXT,
      histologic_type VARCHAR(300), histologic_grade VARCHAR(20),
      margins VARCHAR(120), lymphovascular_invasion BOOLEAN, perineural_invasion BOOLEAN,
      molecular_findings TEXT, notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tb_assessments_case ON tumor_board_assessments(case_id);
    CREATE INDEX IF NOT EXISTS idx_tb_assessments_patient ON tumor_board_assessments(patient_id);
    CREATE INDEX IF NOT EXISTS idx_tb_assessments_date ON tumor_board_assessments(assessed_at);

    CREATE TABLE IF NOT EXISTS tumor_board_plans (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL, patient_id INTEGER NOT NULL,
      assessment_id INTEGER, version INTEGER NOT NULL DEFAULT 1,
      intent VARCHAR(30), summary TEXT,
      items JSONB NOT NULL DEFAULT '[]', specialties JSONB NOT NULL DEFAULT '[]',
      caveats JSONB DEFAULT '[]', board_date DATE, board_members TEXT,
      ratified BOOLEAN DEFAULT FALSE, ratified_by INTEGER, ratified_at TIMESTAMPTZ,
      created_by INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tb_plans_case ON tumor_board_plans(case_id);
    CREATE INDEX IF NOT EXISTS idx_tb_plans_patient ON tumor_board_plans(patient_id);

    CREATE TABLE IF NOT EXISTS tumor_board_referrals (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL, patient_id INTEGER NOT NULL, plan_id INTEGER,
      specialty VARCHAR(60) NOT NULL, specialty_label VARCHAR(120),
      subject VARCHAR(300), body TEXT, urgency VARCHAR(20) DEFAULT 'routine',
      status VARCHAR(30) DEFAULT 'draft', sent_at TIMESTAMPTZ,
      created_by INTEGER, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tb_referrals_case ON tumor_board_referrals(case_id);
    CREATE INDEX IF NOT EXISTS idx_tb_referrals_status ON tumor_board_referrals(status);

    CREATE TABLE IF NOT EXISTS tumor_board_surveillance (
      id SERIAL PRIMARY KEY,
      case_id INTEGER NOT NULL, patient_id INTEGER NOT NULL,
      category VARCHAR(60), title VARCHAR(300), detail TEXT,
      due_date DATE, due_month INTEGER, phase VARCHAR(40), basis VARCHAR(200),
      status VARCHAR(30) DEFAULT 'scheduled', completed_at TIMESTAMPTZ,
      completed_by INTEGER, findings TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tb_surv_case ON tumor_board_surveillance(case_id);
    CREATE INDEX IF NOT EXISTS idx_tb_surv_due ON tumor_board_surveillance(due_date);
    CREATE INDEX IF NOT EXISTS idx_tb_surv_status ON tumor_board_surveillance(status);
  `);
  schemaReady = true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  try {
    await ensureTumorBoardTables();
  } catch (e) {
    console.error('ensureTumorBoardTables failed:', e.message);
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    switch (req.method) {
      case 'GET':
        if (action === 'board') return await getBoard(res);
        if (action === 'detail') return await getCaseDetail(url.searchParams, res);
        if (action === 'surveillance') return await getDueSurveillance(url.searchParams, res);
        return await listCases(url.searchParams, res);

      case 'POST':
        if (!CLINICAL_WRITE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        if (action === 'assess') return await addAssessment(req.body, auth.user, res);
        if (action === 'plan') return await savePlan(req.body, auth.user, res);
        if (action === 'referrals') return await saveReferrals(req.body, auth.user, res);
        if (action === 'surveillance') return await saveSurveillance(req.body, res);
        return await createCase(req.body, auth.user, res);

      case 'PUT':
      case 'PATCH':
        if (!CLINICAL_WRITE_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        if (action === 'referral') return await updateReferral(url.searchParams, req.body, res);
        if (action === 'survitem') return await completeSurveillanceItem(url.searchParams, req.body, auth.user, res);
        if (action === 'ratify') {
          if (!RATIFY_ROLES.includes(auth.user.role)) {
            return res.status(403).json({ error: 'Only a consultant may ratify a tumour board decision' });
          }
          return await ratifyPlan(url.searchParams, auth.user, res);
        }
        return await updateCase(url.searchParams, req.body, res);

      case 'DELETE':
        if (!RATIFY_ROLES.includes(auth.user.role)) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
        return await closeCase(url.searchParams, res);

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('tumor-board API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ── Reads ────────────────────────────────────────────────────────────────

async function listCases(searchParams, res) {
  const patientId = searchParams.get('patientId');
  if (!patientId) return res.status(400).json({ error: 'patientId is required' });
  const pid = parseInt(patientId, 10);
  if (Number.isNaN(pid)) return res.status(400).json({ error: 'Invalid patientId' });

  const result = await query(
    `SELECT * FROM tumor_board_cases WHERE patient_id = $1
     ORDER BY status = 'active' DESC, updated_at DESC`,
    [pid]
  );
  return res.status(200).json({ cases: result.rows });
}

async function getBoard(res) {
  const cases = await query(
    `SELECT c.*, p.first_name, p.last_name, p.hospital_number AS patient_hospital_number
     FROM tumor_board_cases c
     LEFT JOIN patients p ON p.id = c.patient_id
     WHERE c.status <> 'closed'
     ORDER BY
       CASE c.status WHEN 'active' THEN 0 WHEN 'in_treatment' THEN 1 ELSE 2 END,
       c.updated_at DESC
     LIMIT 500`
  );

  // Cases awaiting histology are the ones the board most needs surfaced — the
  // plan is provisional until the report lands.
  const awaitingHistology = cases.rows.filter(c => !c.histology_available).length;

  const overdue = await query(
    `SELECT COUNT(*)::int AS n FROM tumor_board_surveillance
     WHERE status = 'scheduled' AND due_date < CURRENT_DATE`
  );

  return res.status(200).json({
    cases: cases.rows,
    summary: {
      total: cases.rows.length,
      awaitingHistology,
      overdueSurveillance: overdue.rows[0]?.n || 0,
    },
  });
}

async function getCaseDetail(searchParams, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Valid case id is required' });

  const [caseRow, assessments, plans, referrals, surveillance] = await Promise.all([
    query(
      `SELECT c.*, p.first_name, p.last_name, p.hospital_number AS patient_hospital_number,
              p.date_of_birth, p.gender
       FROM tumor_board_cases c
       LEFT JOIN patients p ON p.id = c.patient_id
       WHERE c.id = $1`,
      [id]
    ),
    // Newest first: the current stage is the most recent assessment, but the
    // whole history stays visible.
    query(`SELECT * FROM tumor_board_assessments WHERE case_id = $1 ORDER BY version DESC, assessed_at DESC`, [id]),
    query(`SELECT * FROM tumor_board_plans WHERE case_id = $1 ORDER BY version DESC`, [id]),
    query(`SELECT * FROM tumor_board_referrals WHERE case_id = $1 ORDER BY created_at DESC`, [id]),
    query(`SELECT * FROM tumor_board_surveillance WHERE case_id = $1 ORDER BY due_date ASC`, [id]),
  ]);

  if (!caseRow.rows.length) return res.status(404).json({ error: 'Case not found' });

  return res.status(200).json({
    case: caseRow.rows[0],
    assessments: assessments.rows,
    plans: plans.rows,
    referrals: referrals.rows,
    surveillance: surveillance.rows,
  });
}

async function getDueSurveillance(searchParams, res) {
  const days = parseInt(searchParams.get('withinDays') || '30', 10);
  const result = await query(
    `SELECT s.*, c.diagnosis, c.tumor_family, p.first_name, p.last_name, p.hospital_number
     FROM tumor_board_surveillance s
     JOIN tumor_board_cases c ON c.id = s.case_id
     LEFT JOIN patients p ON p.id = s.patient_id
     WHERE s.status = 'scheduled'
       AND s.due_date <= CURRENT_DATE + ($1 || ' days')::interval
     ORDER BY s.due_date ASC
     LIMIT 500`,
    [String(Number.isNaN(days) ? 30 : days)]
  );
  return res.status(200).json({ surveillance: result.rows });
}

// ── Writes ───────────────────────────────────────────────────────────────

async function createCase(body, user, res) {
  const b = body || {};
  if (!b.patient_id) return res.status(400).json({ error: 'patient_id is required' });
  if (!b.tumor_family) return res.status(400).json({ error: 'tumor_family is required' });

  const result = await query(
    `INSERT INTO tumor_board_cases
      (patient_id, hospital_number, tumor_family, diagnosis, primary_site, laterality,
       sarcoma_site, date_of_diagnosis, date_first_presented, status, performance_status,
       comorbidities, immunosuppressed, high_risk_site, recurrent_disease,
       fit_for_radical_therapy, braf_mutated, histology_available, histologic_type, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
     RETURNING *`,
    [
      b.patient_id, b.hospital_number || null, b.tumor_family, b.diagnosis || null,
      b.primary_site || null, b.laterality || null, b.sarcoma_site || null,
      b.date_of_diagnosis || null, b.date_first_presented || null, b.status || 'active',
      b.performance_status || null, b.comorbidities || null,
      b.immunosuppressed ?? false, b.high_risk_site ?? false, b.recurrent_disease ?? false,
      b.fit_for_radical_therapy ?? null, b.braf_mutated ?? null,
      b.histology_available ?? false, b.histologic_type || null, user.id || null,
    ]
  );
  return res.status(201).json({ case: result.rows[0] });
}

async function addAssessment(body, user, res) {
  const b = body || {};
  if (!b.case_id) return res.status(400).json({ error: 'case_id is required' });

  // Version is derived server-side, not trusted from the client: two clinicians
  // assessing the same case offline would otherwise both send version 2 and one
  // would silently overwrite the other's place in the timeline.
  const prev = await query(
    `SELECT COALESCE(MAX(version), 0) AS v FROM tumor_board_assessments WHERE case_id = $1`,
    [b.case_id]
  );
  const version = (prev.rows[0]?.v || 0) + 1;

  const result = await query(
    `INSERT INTO tumor_board_assessments
      (case_id, patient_id, version, basis, staging_system, assessed_by, inputs,
       t_category, n_category, m_category, stage_group, stage_formatted, stage_description,
       caveats, local_spread, regional_spread, metastatic_spread, histologic_type,
       histologic_grade, margins, lymphovascular_invasion, perineural_invasion,
       molecular_findings, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
     RETURNING *`,
    [
      b.case_id, b.patient_id, version, b.basis || 'clinical',
      b.staging_system || 'AJCC 8th edition (2018)', user.id || null,
      JSON.stringify(b.inputs || {}),
      b.t_category || null, b.n_category || null, b.m_category || null,
      b.stage_group || null, b.stage_formatted || null, b.stage_description || null,
      JSON.stringify(b.caveats || []),
      b.local_spread || null, b.regional_spread || null, b.metastatic_spread || null,
      b.histologic_type || null, b.histologic_grade || null, b.margins || null,
      b.lymphovascular_invasion ?? null, b.perineural_invasion ?? null,
      b.molecular_findings || null, b.notes || null,
    ]
  );

  // Denormalise the newest stage onto the case so board lists need no join.
  await query(
    `UPDATE tumor_board_cases
     SET current_stage_group = $1, current_stage_formatted = $2,
         assessment_count = $3,
         histologic_type = COALESCE($4, histologic_type),
         histology_available = CASE WHEN $5 THEN TRUE ELSE histology_available END,
         updated_at = NOW()
     WHERE id = $6`,
    [
      b.stage_group || null, b.stage_formatted || null, version,
      b.histologic_type || null,
      b.basis === 'pathological' || !!b.histologic_type,
      b.case_id,
    ]
  );

  return res.status(201).json({ assessment: result.rows[0], version });
}

async function savePlan(body, user, res) {
  const b = body || {};
  if (!b.case_id) return res.status(400).json({ error: 'case_id is required' });

  const prev = await query(
    `SELECT COALESCE(MAX(version), 0) AS v FROM tumor_board_plans WHERE case_id = $1`,
    [b.case_id]
  );
  const version = (prev.rows[0]?.v || 0) + 1;

  const result = await query(
    `INSERT INTO tumor_board_plans
      (case_id, patient_id, assessment_id, version, intent, summary, items, specialties,
       caveats, board_date, board_members, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      b.case_id, b.patient_id, b.assessment_id || null, version,
      b.intent || null, b.summary || null,
      JSON.stringify(b.items || []), JSON.stringify(b.specialties || []),
      JSON.stringify(b.caveats || []), b.board_date || null, b.board_members || null,
      user.id || null,
    ]
  );

  await query(
    `UPDATE tumor_board_cases SET treatment_intent = $1, last_board_date = COALESCE($2, last_board_date), updated_at = NOW() WHERE id = $3`,
    [b.intent || null, b.board_date || null, b.case_id]
  );

  return res.status(201).json({ plan: result.rows[0], version });
}

async function ratifyPlan(searchParams, user, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Valid plan id is required' });

  const result = await query(
    `UPDATE tumor_board_plans SET ratified = TRUE, ratified_by = $1, ratified_at = NOW(), updated_at = NOW()
     WHERE id = $2 RETURNING *`,
    [user.id || null, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Plan not found' });
  return res.status(200).json({ plan: result.rows[0] });
}

async function saveReferrals(body, user, res) {
  const b = body || {};
  if (!b.case_id || !Array.isArray(b.referrals)) {
    return res.status(400).json({ error: 'case_id and referrals[] are required' });
  }

  const saved = [];
  for (const r of b.referrals) {
    const result = await query(
      `INSERT INTO tumor_board_referrals
        (case_id, patient_id, plan_id, specialty, specialty_label, subject, body, urgency, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        b.case_id, b.patient_id, b.plan_id || null, r.specialty,
        r.specialtyLabel || r.specialty_label || null, r.subject || null,
        r.body || null, r.urgency || 'routine', r.status || 'draft', user.id || null,
      ]
    );
    saved.push(result.rows[0]);
  }
  return res.status(201).json({ referrals: saved });
}

async function updateReferral(searchParams, body, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Valid referral id is required' });
  const b = body || {};

  const result = await query(
    `UPDATE tumor_board_referrals
     SET status = COALESCE($1, status),
         sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END,
         body = COALESCE($2, body),
         updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [b.status || null, b.body || null, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Referral not found' });
  return res.status(200).json({ referral: result.rows[0] });
}

async function saveSurveillance(body, res) {
  const b = body || {};
  if (!b.case_id || !Array.isArray(b.items)) {
    return res.status(400).json({ error: 'case_id and items[] are required' });
  }

  // Replacing the schedule wholesale is correct: regenerating it after a stage
  // change must not leave the old, now-wrong appointments behind. Completed
  // items are preserved — they are a record of what actually happened.
  await query(`DELETE FROM tumor_board_surveillance WHERE case_id = $1 AND status = 'scheduled'`, [b.case_id]);

  const saved = [];
  for (const item of b.items) {
    const result = await query(
      `INSERT INTO tumor_board_surveillance
        (case_id, patient_id, category, title, detail, due_date, due_month, phase, basis)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        b.case_id, b.patient_id, item.category || null, item.title || null,
        item.detail || null, item.dueDate || item.due_date || null,
        item.dueMonth ?? item.due_month ?? null, item.phase || null, item.basis || null,
      ]
    );
    saved.push(result.rows[0]);
  }
  return res.status(201).json({ surveillance: saved });
}

async function completeSurveillanceItem(searchParams, body, user, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Valid surveillance item id is required' });
  const b = body || {};

  const result = await query(
    `UPDATE tumor_board_surveillance
     SET status = COALESCE($1, 'completed'),
         completed_at = NOW(), completed_by = $2,
         findings = COALESCE($3, findings), updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [b.status || 'completed', user.id || null, b.findings || null, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Surveillance item not found' });
  return res.status(200).json({ item: result.rows[0] });
}

async function updateCase(searchParams, body, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Valid case id is required' });
  const b = body || {};

  const allowed = [
    'diagnosis', 'primary_site', 'laterality', 'sarcoma_site', 'status', 'treatment_intent',
    'performance_status', 'comorbidities', 'immunosuppressed', 'high_risk_site',
    'recurrent_disease', 'fit_for_radical_therapy', 'braf_mutated', 'histology_available',
    'histologic_type', 'last_board_date',
  ];
  const sets = [];
  const values = [];
  let n = 1;
  for (const key of allowed) {
    if (b[key] !== undefined) {
      sets.push(`${key} = $${n++}`);
      values.push(b[key]);
    }
  }
  if (!sets.length) return res.status(400).json({ error: 'No updatable fields supplied' });

  values.push(id);
  const result = await query(
    `UPDATE tumor_board_cases SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${n} RETURNING *`,
    values
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Case not found' });
  return res.status(200).json({ case: result.rows[0] });
}

async function closeCase(searchParams, res) {
  const id = parseInt(searchParams.get('id'), 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Valid case id is required' });

  // Close, never delete: the staging timeline and board decisions are a
  // medico-legal record.
  const result = await query(
    `UPDATE tumor_board_cases SET status = 'closed', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Case not found' });
  return res.status(200).json({ case: result.rows[0] });
}
