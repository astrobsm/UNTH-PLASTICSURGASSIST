// Student Module API endpoint for Vercel serverless
import bcrypt from 'bcryptjs';
import { query } from './_lib/db.js';
import { cors, authenticateRequest, signToken } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const { method } = req;
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathParts = url.pathname.replace('/api/students', '').split('/').filter(Boolean);
  const action = pathParts[0]; // e.g. 'register', 'login', 'clerking', 'treatment-plans', ':id'

  try {
    // ── Public endpoints (no auth required) ──
    if (method === 'POST' && action === 'register') {
      return await registerStudent(req.body, res);
    }
    if (method === 'POST' && action === 'login') {
      return await loginStudent(req.body, res);
    }

    // ── Auth required for all other endpoints ──
    const auth = authenticateRequest(req);
    if (!auth.authenticated) {
      return res.status(401).json({ error: auth.error });
    }

    // ── Student endpoints ──
    if (auth.user.role === 'student') {
      if (method === 'GET' && action === 'dashboard') return await getStudentDashboard(auth.user.id, res);
      if (method === 'GET' && action === 'my-patients') return await getStudentPatients(auth.user.id, res);
      if (method === 'GET' && action === 'clerkings') return await getStudentClerkings(auth.user.id, res);
      if (method === 'POST' && action === 'clerkings') return await createClerking(auth.user.id, req.body, res);
      if (method === 'PUT' && action === 'clerkings') return await updateClerking(auth.user.id, pathParts[1], req.body, res);
      if (method === 'GET' && action === 'treatment-plans') return await getStudentTreatmentPlans(auth.user.id, res);
      if (method === 'POST' && action === 'treatment-plans') return await createStudentTreatmentPlan(auth.user.id, req.body, res);
      if (method === 'PUT' && action === 'treatment-plans') return await updateStudentTreatmentPlan(auth.user.id, pathParts[1], req.body, res);
    }

    // ── Admin endpoints ──
    const adminRoles = ['admin', 'consultant', 'senior_registrar'];
    if (adminRoles.includes(auth.user.role)) {
      if (method === 'GET' && !action) return await listStudents(url.searchParams, res);
      if (method === 'GET' && action === 'overview') return await getStudentsOverview(res);
      if (method === 'PUT' && action === 'approve') return await approveStudent(req.body, res);
      if (method === 'PUT' && action === 'deactivate') return await deactivateStudent(req.body, res);
      if (method === 'PUT' && action === 'evaluate') return await evaluateClerking(auth.user, req.body, res);
      if (method === 'GET' && action && action !== 'register' && action !== 'login') {
        return await getStudentDetail(action, res);
      }
    }

    return res.status(403).json({ error: 'Forbidden' });
  } catch (error) {
    console.error('Students API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA INIT
// ═══════════════════════════════════════════════════════════════════════════
async function ensureTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS students (
      id SERIAL PRIMARY KEY,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      university VARCHAR(255),
      matric_number VARCHAR(100),
      posting_start DATE NOT NULL,
      posting_end DATE NOT NULL,
      is_approved BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      max_patients INTEGER DEFAULT 5,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_patient_assignments (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id),
      patient_id VARCHAR(255) NOT NULL,
      hospital_number VARCHAR(100),
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      UNIQUE(patient_id, is_active)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_clerkings (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id),
      patient_id VARCHAR(255) NOT NULL,
      hospital_number VARCHAR(100),
      chief_complaint TEXT,
      history_of_present_illness TEXT,
      past_medical_history TEXT,
      past_surgical_history TEXT,
      family_history TEXT,
      social_history TEXT,
      drug_history TEXT,
      allergies TEXT,
      review_of_systems JSONB DEFAULT '{}',
      physical_examination JSONB DEFAULT '{}',
      vital_signs JSONB DEFAULT '{}',
      provisional_diagnosis TEXT,
      differential_diagnoses JSONB DEFAULT '[]',
      investigations_requested JSONB DEFAULT '[]',
      plan TEXT,
      evaluation_score INTEGER,
      evaluation_feedback TEXT,
      evaluated_by VARCHAR(255),
      evaluated_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS student_treatment_plans (
      id SERIAL PRIMARY KEY,
      student_id INTEGER NOT NULL REFERENCES students(id),
      patient_id VARCHAR(255) NOT NULL,
      hospital_number VARCHAR(100),
      diagnosis TEXT,
      treatment_goals JSONB DEFAULT '[]',
      medications JSONB DEFAULT '[]',
      investigations JSONB DEFAULT '[]',
      procedures JSONB DEFAULT '[]',
      nursing_care TEXT,
      diet TEXT,
      follow_up_plan TEXT,
      discharge_criteria TEXT,
      evaluation_score INTEGER,
      evaluation_feedback TEXT,
      evaluated_by VARCHAR(255),
      evaluated_at TIMESTAMP WITH TIME ZONE,
      status VARCHAR(50) DEFAULT 'draft',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC: REGISTRATION & LOGIN
// ═══════════════════════════════════════════════════════════════════════════
async function registerStudent(body, res) {
  await ensureTables();
  const { full_name, email, password, university, matric_number, posting_start, posting_end } = body;

  if (!full_name || !email || !password || !posting_start || !posting_end) {
    return res.status(400).json({ error: 'Full name, email, password, posting start and end dates are required' });
  }

  // Email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Password strength
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const existing = await query('SELECT id FROM students WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `INSERT INTO students (full_name, email, password_hash, university, matric_number, posting_start, posting_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, full_name, email, university, posting_start, posting_end, is_approved`,
    [full_name, email, passwordHash, university || null, matric_number || null, posting_start, posting_end]
  );

  res.status(201).json({
    message: 'Registration successful. Awaiting admin approval.',
    student: result.rows[0]
  });
}

async function loginStudent(body, res) {
  await ensureTables();
  const { email, password } = body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const result = await query(
    'SELECT id, full_name, email, password_hash, is_approved, is_active, posting_start, posting_end FROM students WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const student = result.rows[0];
  const validPassword = await bcrypt.compare(password, student.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!student.is_active) {
    return res.status(403).json({ error: 'Your account has been deactivated' });
  }

  if (!student.is_approved) {
    return res.status(403).json({ error: 'Your account is pending admin approval' });
  }

  // Check posting dates
  const now = new Date();
  const postingEnd = new Date(student.posting_end);
  if (now > postingEnd) {
    return res.status(403).json({ error: 'Your posting period has ended. Contact admin to extend.' });
  }

  const token = signToken({
    id: student.id,
    name: student.full_name,
    email: student.email,
    role: 'student'
  });

  // Auto-assign patients if none yet
  await autoAssignPatients(student.id);

  res.json({
    token,
    user: {
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      role: 'student',
      postingStart: student.posting_start,
      postingEnd: student.posting_end
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-ASSIGN PATIENTS (max 5, exclusive)
// ═══════════════════════════════════════════════════════════════════════════
async function autoAssignPatients(studentId) {
  // Count current assignments
  const countResult = await query(
    'SELECT COUNT(*) as cnt FROM student_patient_assignments WHERE student_id = $1 AND is_active = true',
    [studentId]
  );
  const currentCount = parseInt(countResult.rows[0].cnt);
  if (currentCount >= 5) return { assigned: 0 };

  const needed = 5 - currentCount;

  // Find patients NOT assigned to any active student
  const available = await query(`
    SELECT p.id, p.hospital_number 
    FROM patients p
    WHERE p.deleted IS NOT TRUE
      AND p.id::text NOT IN (
        SELECT spa.patient_id FROM student_patient_assignments spa WHERE spa.is_active = true
      )
    ORDER BY p.created_at DESC
    LIMIT $1
  `, [needed]);

  let assigned = 0;
  for (const patient of available.rows) {
    try {
      await query(
        `INSERT INTO student_patient_assignments (student_id, patient_id, hospital_number, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (patient_id, is_active) DO NOTHING`,
        [studentId, String(patient.id), patient.hospital_number]
      );
      assigned++;
    } catch (e) {
      // Skip duplicates
    }
  }

  return { assigned };
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT: DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
async function getStudentDashboard(studentId, res) {
  const student = await query(
    'SELECT id, full_name, email, university, matric_number, posting_start, posting_end FROM students WHERE id = $1',
    [studentId]
  );

  if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

  const patients = await query(`
    SELECT spa.patient_id, spa.hospital_number, spa.assigned_at,
           p.first_name, p.last_name, p.ward_id, p.bed_number, p.sex, p.dob
    FROM student_patient_assignments spa
    LEFT JOIN patients p ON p.id::text = spa.patient_id
    WHERE spa.student_id = $1 AND spa.is_active = true
    ORDER BY spa.assigned_at DESC
  `, [studentId]);

  const clerkings = await query(
    'SELECT id, patient_id, status, evaluation_score, created_at FROM student_clerkings WHERE student_id = $1 ORDER BY created_at DESC',
    [studentId]
  );

  const plans = await query(
    'SELECT id, patient_id, status, evaluation_score, created_at FROM student_treatment_plans WHERE student_id = $1 ORDER BY created_at DESC',
    [studentId]
  );

  const daysLeft = Math.max(0, Math.ceil((new Date(student.rows[0].posting_end) - new Date()) / (1000 * 60 * 60 * 24)));

  res.json({
    student: student.rows[0],
    patients: patients.rows,
    clerkings: clerkings.rows,
    treatmentPlans: plans.rows,
    stats: {
      assignedPatients: patients.rows.length,
      totalClerkings: clerkings.rows.length,
      evaluatedClerkings: clerkings.rows.filter(c => c.evaluation_score != null).length,
      totalPlans: plans.rows.length,
      evaluatedPlans: plans.rows.filter(p => p.evaluation_score != null).length,
      daysLeft,
      averageScore: (() => {
        const scored = [...clerkings.rows, ...plans.rows].filter(x => x.evaluation_score != null);
        return scored.length ? Math.round(scored.reduce((s, x) => s + x.evaluation_score, 0) / scored.length) : null;
      })()
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT: PATIENTS
// ═══════════════════════════════════════════════════════════════════════════
async function getStudentPatients(studentId, res) {
  const result = await query(`
    SELECT spa.patient_id, spa.hospital_number, spa.assigned_at,
           p.first_name, p.last_name, p.full_name, p.ward_id, p.bed_number, p.sex, p.dob,
           p.consultant_in_charge, p.patient_type
    FROM student_patient_assignments spa
    LEFT JOIN patients p ON p.id::text = spa.patient_id
    WHERE spa.student_id = $1 AND spa.is_active = true
    ORDER BY spa.assigned_at DESC
  `, [studentId]);

  res.json(result.rows);
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT: CLERKINGS
// ═══════════════════════════════════════════════════════════════════════════
async function getStudentClerkings(studentId, res) {
  const result = await query(`
    SELECT sc.*, p.first_name, p.last_name, p.hospital_number as p_hospital_number
    FROM student_clerkings sc
    LEFT JOIN patients p ON p.id::text = sc.patient_id
    WHERE sc.student_id = $1
    ORDER BY sc.created_at DESC
  `, [studentId]);

  res.json(result.rows);
}

async function createClerking(studentId, body, res) {
  // Verify patient is assigned to this student
  const assignment = await query(
    'SELECT id FROM student_patient_assignments WHERE student_id = $1 AND patient_id = $2 AND is_active = true',
    [studentId, body.patient_id]
  );
  if (assignment.rows.length === 0) {
    return res.status(403).json({ error: 'This patient is not assigned to you' });
  }

  const result = await query(`
    INSERT INTO student_clerkings (
      student_id, patient_id, hospital_number,
      chief_complaint, history_of_present_illness, past_medical_history,
      past_surgical_history, family_history, social_history, drug_history, allergies,
      review_of_systems, physical_examination, vital_signs,
      provisional_diagnosis, differential_diagnoses, investigations_requested, plan, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *
  `, [
    studentId, body.patient_id, body.hospital_number,
    body.chief_complaint, body.history_of_present_illness, body.past_medical_history,
    body.past_surgical_history, body.family_history, body.social_history, body.drug_history, body.allergies,
    JSON.stringify(body.review_of_systems || {}), JSON.stringify(body.physical_examination || {}),
    JSON.stringify(body.vital_signs || {}),
    body.provisional_diagnosis, JSON.stringify(body.differential_diagnoses || []),
    JSON.stringify(body.investigations_requested || []), body.plan, body.status || 'submitted'
  ]);

  res.status(201).json(result.rows[0]);
}

async function updateClerking(studentId, clerkingId, body, res) {
  if (!clerkingId) return res.status(400).json({ error: 'Clerking ID required' });

  const result = await query(`
    UPDATE student_clerkings SET
      chief_complaint = COALESCE($3, chief_complaint),
      history_of_present_illness = COALESCE($4, history_of_present_illness),
      past_medical_history = COALESCE($5, past_medical_history),
      past_surgical_history = COALESCE($6, past_surgical_history),
      family_history = COALESCE($7, family_history),
      social_history = COALESCE($8, social_history),
      drug_history = COALESCE($9, drug_history),
      allergies = COALESCE($10, allergies),
      review_of_systems = COALESCE($11, review_of_systems),
      physical_examination = COALESCE($12, physical_examination),
      vital_signs = COALESCE($13, vital_signs),
      provisional_diagnosis = COALESCE($14, provisional_diagnosis),
      differential_diagnoses = COALESCE($15, differential_diagnoses),
      investigations_requested = COALESCE($16, investigations_requested),
      plan = COALESCE($17, plan),
      status = COALESCE($18, status),
      updated_at = NOW()
    WHERE id = $1 AND student_id = $2
    RETURNING *
  `, [
    clerkingId, studentId,
    body.chief_complaint, body.history_of_present_illness, body.past_medical_history,
    body.past_surgical_history, body.family_history, body.social_history, body.drug_history, body.allergies,
    body.review_of_systems ? JSON.stringify(body.review_of_systems) : null,
    body.physical_examination ? JSON.stringify(body.physical_examination) : null,
    body.vital_signs ? JSON.stringify(body.vital_signs) : null,
    body.provisional_diagnosis, body.differential_diagnoses ? JSON.stringify(body.differential_diagnoses) : null,
    body.investigations_requested ? JSON.stringify(body.investigations_requested) : null,
    body.plan, body.status
  ]);

  if (result.rows.length === 0) return res.status(404).json({ error: 'Clerking not found' });
  res.json(result.rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT: TREATMENT PLANS
// ═══════════════════════════════════════════════════════════════════════════
async function getStudentTreatmentPlans(studentId, res) {
  const result = await query(`
    SELECT stp.*, p.first_name, p.last_name, p.hospital_number as p_hospital_number
    FROM student_treatment_plans stp
    LEFT JOIN patients p ON p.id::text = stp.patient_id
    WHERE stp.student_id = $1
    ORDER BY stp.created_at DESC
  `, [studentId]);
  res.json(result.rows);
}

async function createStudentTreatmentPlan(studentId, body, res) {
  const assignment = await query(
    'SELECT id FROM student_patient_assignments WHERE student_id = $1 AND patient_id = $2 AND is_active = true',
    [studentId, body.patient_id]
  );
  if (assignment.rows.length === 0) {
    return res.status(403).json({ error: 'This patient is not assigned to you' });
  }

  const result = await query(`
    INSERT INTO student_treatment_plans (
      student_id, patient_id, hospital_number, diagnosis,
      treatment_goals, medications, investigations, procedures,
      nursing_care, diet, follow_up_plan, discharge_criteria, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
  `, [
    studentId, body.patient_id, body.hospital_number, body.diagnosis,
    JSON.stringify(body.treatment_goals || []), JSON.stringify(body.medications || []),
    JSON.stringify(body.investigations || []), JSON.stringify(body.procedures || []),
    body.nursing_care, body.diet, body.follow_up_plan, body.discharge_criteria,
    body.status || 'submitted'
  ]);

  res.status(201).json(result.rows[0]);
}

async function updateStudentTreatmentPlan(studentId, planId, body, res) {
  if (!planId) return res.status(400).json({ error: 'Plan ID required' });

  const result = await query(`
    UPDATE student_treatment_plans SET
      diagnosis = COALESCE($3, diagnosis),
      treatment_goals = COALESCE($4, treatment_goals),
      medications = COALESCE($5, medications),
      investigations = COALESCE($6, investigations),
      procedures = COALESCE($7, procedures),
      nursing_care = COALESCE($8, nursing_care),
      diet = COALESCE($9, diet),
      follow_up_plan = COALESCE($10, follow_up_plan),
      discharge_criteria = COALESCE($11, discharge_criteria),
      status = COALESCE($12, status),
      updated_at = NOW()
    WHERE id = $1 AND student_id = $2
    RETURNING *
  `, [
    planId, studentId,
    body.diagnosis, body.treatment_goals ? JSON.stringify(body.treatment_goals) : null,
    body.medications ? JSON.stringify(body.medications) : null,
    body.investigations ? JSON.stringify(body.investigations) : null,
    body.procedures ? JSON.stringify(body.procedures) : null,
    body.nursing_care, body.diet, body.follow_up_plan, body.discharge_criteria, body.status
  ]);

  if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });
  res.json(result.rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: LIST / OVERVIEW / APPROVE / DEACTIVATE / EVALUATE
// ═══════════════════════════════════════════════════════════════════════════
async function listStudents(params, res) {
  await ensureTables();
  const result = await query(`
    SELECT s.*, 
      (SELECT COUNT(*) FROM student_patient_assignments spa WHERE spa.student_id = s.id AND spa.is_active = true) as assigned_patients,
      (SELECT COUNT(*) FROM student_clerkings sc WHERE sc.student_id = s.id) as total_clerkings,
      (SELECT COUNT(*) FROM student_clerkings sc WHERE sc.student_id = s.id AND sc.evaluation_score IS NOT NULL) as evaluated_clerkings,
      (SELECT COUNT(*) FROM student_treatment_plans stp WHERE stp.student_id = s.id) as total_plans,
      (SELECT AVG(sc.evaluation_score) FROM student_clerkings sc WHERE sc.student_id = s.id AND sc.evaluation_score IS NOT NULL) as avg_clerking_score,
      (SELECT AVG(stp.evaluation_score) FROM student_treatment_plans stp WHERE stp.student_id = s.id AND stp.evaluation_score IS NOT NULL) as avg_plan_score
    FROM students s
    ORDER BY s.created_at DESC
  `);
  res.json(result.rows);
}

async function getStudentsOverview(res) {
  await ensureTables();
  const stats = await query(`
    SELECT 
      COUNT(*) as total_students,
      COUNT(*) FILTER (WHERE is_active AND is_approved) as active_students,
      COUNT(*) FILTER (WHERE NOT is_approved) as pending_approval,
      COUNT(*) FILTER (WHERE posting_end < NOW()) as expired_postings
    FROM students
  `);

  const recentClerkings = await query(`
    SELECT sc.id, sc.patient_id, sc.provisional_diagnosis, sc.status, sc.evaluation_score, sc.created_at,
           s.full_name as student_name, p.first_name, p.last_name
    FROM student_clerkings sc
    JOIN students s ON s.id = sc.student_id
    LEFT JOIN patients p ON p.id::text = sc.patient_id
    ORDER BY sc.created_at DESC LIMIT 10
  `);

  res.json({ stats: stats.rows[0], recentClerkings: recentClerkings.rows });
}

async function getStudentDetail(studentId, res) {
  try {
    await ensureTables();
  } catch (e) {
    console.warn('ensureTables failed (non-fatal):', e.message);
  }

  const student = await query('SELECT * FROM students WHERE id = $1', [studentId]);
  if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

  // Safe query helper — returns empty array if table/column is missing
  const safeRows = async (sql, params) => {
    try { return (await query(sql, params)).rows; } catch (e) { console.warn('student detail query failed:', e.message); return []; }
  };

  const patients = await safeRows(`
    SELECT spa.*, p.first_name, p.last_name, p.ward_id, p.bed_number
    FROM student_patient_assignments spa
    LEFT JOIN patients p ON p.id::text = spa.patient_id
    WHERE spa.student_id = $1 AND spa.is_active = true
  `, [studentId]);

  const clerkings = await safeRows(`
    SELECT sc.*, p.first_name, p.last_name
    FROM student_clerkings sc
    LEFT JOIN patients p ON p.id::text = sc.patient_id
    WHERE sc.student_id = $1
    ORDER BY sc.created_at DESC
  `, [studentId]);

  const plans = await safeRows(`
    SELECT stp.*, p.first_name, p.last_name
    FROM student_treatment_plans stp
    LEFT JOIN patients p ON p.id::text = stp.patient_id
    WHERE stp.student_id = $1
    ORDER BY stp.created_at DESC
  `, [studentId]);

  res.json({
    student: student.rows[0],
    patients,
    clerkings,
    treatmentPlans: plans
  });
}

async function approveStudent(body, res) {
  const { studentId, approved } = body;
  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  await query('UPDATE students SET is_approved = $2, updated_at = NOW() WHERE id = $1', [studentId, approved !== false]);

  // Auto-assign patients on approval
  if (approved !== false) {
    await autoAssignPatients(studentId);
  }

  res.json({ message: approved !== false ? 'Student approved & patients assigned' : 'Student approval revoked' });
}

async function deactivateStudent(body, res) {
  const { studentId, active } = body;
  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  await query('UPDATE students SET is_active = $2, updated_at = NOW() WHERE id = $1', [studentId, active === true]);

  // Release patient assignments when deactivating
  if (active !== true) {
    await query('UPDATE student_patient_assignments SET is_active = false WHERE student_id = $1', [studentId]);
  }

  res.json({ message: active === true ? 'Student reactivated' : 'Student deactivated & patients released' });
}

async function evaluateClerking(evaluator, body, res) {
  const { clerkingId, treatmentPlanId, score, feedback } = body;

  if (score == null || score < 0 || score > 100) {
    return res.status(400).json({ error: 'Score must be between 0 and 100' });
  }

  if (clerkingId) {
    await query(`
      UPDATE student_clerkings SET evaluation_score = $2, evaluation_feedback = $3, 
             evaluated_by = $4, evaluated_at = NOW(), status = 'evaluated'
      WHERE id = $1
    `, [clerkingId, score, feedback, evaluator.name || evaluator.email]);
    return res.json({ message: 'Clerking evaluated' });
  }

  if (treatmentPlanId) {
    await query(`
      UPDATE student_treatment_plans SET evaluation_score = $2, evaluation_feedback = $3,
             evaluated_by = $4, evaluated_at = NOW(), status = 'evaluated'
      WHERE id = $1
    `, [treatmentPlanId, score, feedback, evaluator.name || evaluator.email]);
    return res.json({ message: 'Treatment plan evaluated' });
  }

  res.status(400).json({ error: 'clerkingId or treatmentPlanId required' });
}
