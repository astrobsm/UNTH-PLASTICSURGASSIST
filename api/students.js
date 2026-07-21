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
    // The ONLY place student tokens are accepted — see api/_lib/auth.js.
    const auth = authenticateRequest(req, { allowStudents: true });
    if (!auth.authenticated) {
      return res.status(auth.status || 401).json({ error: auth.error });
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
      // Training participation (CME / CBT / self-assessment) + sign-out summary
      if (method === 'POST' && action === 'training') return await recordStudentTraining(auth.user.id, req.body, res);
      if (method === 'GET'  && action === 'training-summary') return await getStudentTrainingSummary(auth.user.id, res);
    }

    // ── Admin endpoints ──
    const adminRoles = ['admin', 'consultant', 'senior_registrar'];
    if (adminRoles.includes(auth.user.role)) {
      if (method === 'GET' && !action) return await listStudents(url.searchParams, res);
      if (method === 'GET' && action === 'overview') return await getStudentsOverview(res);
      if (method === 'PUT' && action === 'approve') return await approveStudent(req.body, res);
      if (method === 'POST' && action === 'bulk-approve') return await bulkApproveStudents(res);
      if (method === 'POST' && action === 'auto-assign-all') return await autoAssignAllStudents(res);
      if (method === 'PUT' && action === 'deactivate') return await deactivateStudent(req.body, res);
      if (method === 'PUT' && action === 'evaluate') return await evaluateClerking(auth.user, req.body, res);
      if (method === 'POST' && action === 'assign-patients') return await adminAssignPatients(req.body, res);
      if (method === 'POST' && action === 'assign-patient') return await adminAssignSinglePatient(req.body, res);
      if (method === 'PUT' && action === 'unassign-patient') return await adminUnassignPatient(req.body, res);
      if (method === 'GET' && action === 'available-patients') return await getAvailablePatients(url.searchParams, res);
      // ── Group management (5 clinical-posting groups) ──
      if (method === 'GET'  && action === 'groups') return await getStudentGroups(res);
      if (method === 'POST' && action === 'assign-groups') return await assignStudentGroups(req.body, res);
      if (method === 'POST' && action === 'assign-group-patients') return await assignGroupPatients(req.body, res);
      if (method === 'POST' && action === 'group-activity') return await logGroupActivity(auth.user, req.body, res);
      if (method === 'PUT'  && action === 'group-topic') return await setGroupTopic(req.body, res);
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
let _schemaReady = false;
async function ensureTables() {
  if (_schemaReady) return; // cache across warm invocations
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
      UNIQUE(student_id, patient_id)
    )
  `);

  // Migrate old constraint if it exists (UNIQUE(patient_id,is_active) → UNIQUE(student_id,patient_id))
  try {
    await query(`ALTER TABLE student_patient_assignments DROP CONSTRAINT IF EXISTS student_patient_assignments_patient_id_is_active_key`);
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'student_patient_assignments_student_id_patient_id_key'
        ) THEN
          ALTER TABLE student_patient_assignments ADD CONSTRAINT student_patient_assignments_student_id_patient_id_key UNIQUE (student_id, patient_id);
        END IF;
      END $$
    `);
  } catch (e) {
    // Constraint migration is best-effort
    console.warn('Constraint migration (non-fatal):', e.message);
  }

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
  _schemaReady = true;
}

// Activity log for accurate, timestamped record of everything a student does
// during their posting (logins, clerkings, treatment plans, evaluations).
async function ensureStudentActivityTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS student_activity_logs (
        id SERIAL PRIMARY KEY,
        student_id INTEGER NOT NULL,
        activity_type VARCHAR(60) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_student_activity_student ON student_activity_logs(student_id, created_at)`);
  } catch (e) {
    console.warn('ensureStudentActivityTable:', e.message);
  }
}

// Record a student activity (best-effort — never throws into the request path).
async function logStudentActivity(studentId, activityType, description = '', metadata = {}) {
  try {
    await ensureStudentActivityTable();
    await query(
      `INSERT INTO student_activity_logs (student_id, activity_type, description, metadata)
       VALUES ($1, $2, $3, $4)`,
      [studentId, activityType, description, JSON.stringify(metadata || {})]
    );
  } catch (e) {
    console.warn('logStudentActivity:', e.message);
  }
}

// Compute a comprehensive, rotation-scoped performance record for a student.
async function computeStudentMetrics(studentId, studentRow) {
  await ensureStudentActivityTable();
  const safe = async (sql, params, fallback) => {
    try { return (await query(sql, params)).rows; } catch (e) { console.warn('computeStudentMetrics:', e.message); return fallback; }
  };

  const start = studentRow?.posting_start ? new Date(studentRow.posting_start) : null;
  const end = studentRow?.posting_end ? new Date(studentRow.posting_end) : null;
  const now = new Date();
  const DAY = 1000 * 60 * 60 * 24;
  const totalDays = start && end ? Math.max(1, Math.round((end - start) / DAY)) : null;
  const elapsedDays = start ? Math.max(0, Math.min(totalDays ?? Infinity, Math.round((now - start) / DAY))) : null;
  const remainingDays = end ? Math.max(0, Math.ceil((end - now) / DAY)) : null;
  const percentComplete = totalDays ? Math.min(100, Math.round(((elapsedDays ?? 0) / totalDays) * 100)) : null;
  const postingStatus = !start ? 'unknown' : now < start ? 'not_started' : (end && now > end) ? 'ended' : 'active';

  // Clerkings breakdown
  const cRows = await safe(
    `SELECT status, evaluation_score FROM student_clerkings WHERE student_id = $1`, [studentId], []);
  const clerkTotal = cRows.length;
  const clerkSubmitted = cRows.filter(r => r.status && r.status !== 'draft').length;
  const clerkDraft = cRows.filter(r => r.status === 'draft').length;
  const clerkScored = cRows.filter(r => r.evaluation_score != null);
  const clerkAvg = clerkScored.length ? Math.round(clerkScored.reduce((s, r) => s + Number(r.evaluation_score), 0) / clerkScored.length) : null;

  // Treatment plans breakdown
  const pRows = await safe(
    `SELECT status, evaluation_score FROM student_treatment_plans WHERE student_id = $1`, [studentId], []);
  const planTotal = pRows.length;
  const planSubmitted = pRows.filter(r => r.status && r.status !== 'draft').length;
  const planDraft = pRows.filter(r => r.status === 'draft').length;
  const planScored = pRows.filter(r => r.evaluation_score != null);
  const planAvg = planScored.length ? Math.round(planScored.reduce((s, r) => s + Number(r.evaluation_score), 0) / planScored.length) : null;

  // Patients
  const patRows = await safe(
    `SELECT COUNT(*) FILTER (WHERE is_active) AS assigned FROM student_patient_assignments WHERE student_id = $1`, [studentId], [{ assigned: 0 }]);
  const assignedPatients = parseInt(patRows[0]?.assigned || 0, 10);
  const distinctClerkedRows = await safe(
    `SELECT COUNT(DISTINCT patient_id) AS c FROM student_clerkings WHERE student_id = $1`, [studentId], [{ c: 0 }]);
  const distinctClerked = parseInt(distinctClerkedRows[0]?.c || 0, 10);

  // Attendance / engagement from activity log (distinct active days)
  const actRows = await safe(
    `SELECT COUNT(DISTINCT DATE(created_at)) AS active_days, COUNT(*) AS total_activities, MAX(created_at) AS last_active
     FROM student_activity_logs WHERE student_id = $1`, [studentId], [{ active_days: 0, total_activities: 0, last_active: null }]);
  const activeDays = parseInt(actRows[0]?.active_days || 0, 10);
  const totalActivities = parseInt(actRows[0]?.total_activities || 0, 10);
  const lastActive = actRows[0]?.last_active || null;
  // Expected attendance = weekdays elapsed so far (Mon–Fri), capped to posting end
  let expectedDays = 0;
  if (start) {
    const cur = new Date(start);
    const cap = end && now > end ? end : now;
    while (cur <= cap) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) expectedDays++;
      cur.setDate(cur.getDate() + 1);
    }
  }
  const attendancePct = expectedDays > 0 ? Math.min(100, Math.round((activeDays / expectedDays) * 100)) : null;

  // Requirements & eligibility (posting completion criteria)
  const requirements = { clerkings: 10, plans: 5, avgScore: 50, attendancePct: 70 };
  const eligMet = [];
  const eligNotMet = [];
  (clerkTotal >= requirements.clerkings ? eligMet : eligNotMet).push(`Clerkings: ${clerkTotal}/${requirements.clerkings}`);
  (planTotal >= requirements.plans ? eligMet : eligNotMet).push(`Plans: ${planTotal}/${requirements.plans}`);
  const combinedScored = [...clerkScored, ...planScored];
  const combinedAvg = combinedScored.length ? Math.round(combinedScored.reduce((s, r) => s + Number(r.evaluation_score), 0) / combinedScored.length) : null;
  ((combinedAvg ?? 0) >= requirements.avgScore ? eligMet : eligNotMet).push(`Avg score: ${combinedAvg ?? 0}/${requirements.avgScore}`);
  ((attendancePct ?? 0) >= requirements.attendancePct ? eligMet : eligNotMet).push(`Attendance: ${attendancePct ?? 0}%/${requirements.attendancePct}%`);

  // Overall score: clinical quality 60% + volume 20% + attendance 20%
  const qualityScore = combinedAvg ?? 0;
  const volumeScore = Math.min(100, Math.round(((clerkTotal / requirements.clerkings) * 0.5 + (planTotal / requirements.plans) * 0.5) * 100));
  const overallScore = Math.round(qualityScore * 0.6 + volumeScore * 0.2 + (attendancePct ?? 0) * 0.2);

  // Weekly activity breakdown across the posting
  let weekly = [];
  if (start) {
    const weeks = Math.min(24, Math.max(1, Math.ceil((totalDays ?? 7) / 7)));
    const buckets = Array.from({ length: weeks }, () => ({ clerkings: 0, plans: 0 }));
    const bucketOf = (dateStr) => {
      const idx = Math.floor((new Date(dateStr) - start) / (7 * DAY));
      return idx >= 0 && idx < weeks ? idx : null;
    };
    const cDates = await safe(`SELECT created_at FROM student_clerkings WHERE student_id = $1`, [studentId], []);
    const pDates = await safe(`SELECT created_at FROM student_treatment_plans WHERE student_id = $1`, [studentId], []);
    cDates.forEach(r => { const b = bucketOf(r.created_at); if (b != null) buckets[b].clerkings++; });
    pDates.forEach(r => { const b = bucketOf(r.created_at); if (b != null) buckets[b].plans++; });
    weekly = buckets.map((b, i) => ({ week: i + 1, ...b }));
  }

  return {
    posting: { start: studentRow?.posting_start || null, end: studentRow?.posting_end || null, totalDays, elapsedDays, remainingDays, percentComplete, status: postingStatus },
    clerkings: { total: clerkTotal, draft: clerkDraft, submitted: clerkSubmitted, evaluated: clerkScored.length, avgScore: clerkAvg },
    plans: { total: planTotal, draft: planDraft, submitted: planSubmitted, evaluated: planScored.length, avgScore: planAvg },
    patients: { assigned: assignedPatients, distinctClerked },
    attendance: { activeDays, expectedDays, attendancePct },
    engagement: { totalActivities, lastActive },
    combinedAvg,
    overallScore,
    requirements,
    eligibility: { eligible: eligNotMet.length === 0, met: eligMet, notMet: eligNotMet },
    weekly,
  };
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
    `INSERT INTO students (full_name, email, password_hash, university, matric_number, posting_start, posting_end, is_approved)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true)
     RETURNING id, full_name, email, university, posting_start, posting_end, is_approved`,
    [full_name, email, passwordHash, university || null, matric_number || null, posting_start, posting_end]
  );

  // Auto-assign patients immediately on registration
  let assignResult = { assigned: 0 };
  try {
    assignResult = await autoAssignPatients(result.rows[0].id);
  } catch (e) { console.warn('Auto-assign on register (non-fatal):', e.message); }

  res.status(201).json({
    message: `Registration successful. Auto-approved with ${assignResult.assigned} patients assigned.`,
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

  // Auto-approve if not yet approved
  if (!student.is_approved) {
    await query('UPDATE students SET is_approved = true, updated_at = NOW() WHERE id = $1', [student.id]);
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
    role: 'student',
    // Marks the id as belonging to the `students` sequence, not `users`.
    // The two are independent SERIALs, so without this a student id can
    // collide with a staff user id in ownership checks like updateUser's.
    sub_type: 'student'
  });

  // Auto-assign patients if none yet
  await autoAssignPatients(student.id);

  // Record attendance/engagement for this login day
  await logStudentActivity(student.id, 'login', 'Student logged in');

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
  await ensureTables();
  // Count current active assignments for THIS student
  const countResult = await query(
    'SELECT COUNT(*) as cnt FROM student_patient_assignments WHERE student_id = $1 AND is_active = true',
    [studentId]
  );
  const currentCount = parseInt(countResult.rows[0].cnt);
  if (currentCount >= 5) return { assigned: 0, message: 'Already at max (5)' };

  const needed = 5 - currentCount;

  // Find patients NOT yet assigned to THIS student (allow shared patients across students)
  // NOTE: patients.deleted column may not exist in this schema, so we don't filter by it.
  let available;
  try {
    available = await query(`
      SELECT p.id, p.hospital_number 
      FROM patients p
      WHERE p.id::text NOT IN (
          SELECT spa.patient_id FROM student_patient_assignments spa 
          WHERE spa.student_id = $1 AND spa.is_active = true
        )
      ORDER BY p.created_at DESC
      LIMIT $2
    `, [studentId, needed]);
  } catch (e) {
    console.warn('autoAssignPatients: pool query failed:', e.message);
    return { assigned: 0, total: currentCount, error: e.message };
  }

  let assigned = 0;
  for (const patient of available.rows) {
    try {
      await query(
        `INSERT INTO student_patient_assignments (student_id, patient_id, hospital_number, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (student_id, patient_id) DO UPDATE SET is_active = true, assigned_at = NOW()`,
        [studentId, String(patient.id), patient.hospital_number]
      );
      assigned++;
    } catch (e) {
      console.warn('Auto-assign skip:', e.message);
    }
  }

  return { assigned, total: currentCount + assigned };
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

  const metrics = await computeStudentMetrics(studentId, student.rows[0]);

  res.json({
    student: student.rows[0],
    patients: patients.rows,
    clerkings: clerkings.rows,
    treatmentPlans: plans.rows,
    metrics,
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

  await logStudentActivity(studentId, (body.status === 'draft' ? 'clerking_draft' : 'clerking_submitted'),
    `Clerking ${body.status === 'draft' ? 'saved as draft' : 'submitted'}`,
    { clerkingId: result.rows[0].id, patient_id: body.patient_id });

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
  if (body.status && body.status !== 'draft') {
    await logStudentActivity(studentId, 'clerking_submitted', 'Clerking submitted', { clerkingId });
  }
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

  await logStudentActivity(studentId, (body.status === 'draft' ? 'plan_draft' : 'plan_submitted'),
    `Treatment plan ${body.status === 'draft' ? 'saved as draft' : 'submitted'}`,
    { planId: result.rows[0].id, patient_id: body.patient_id });

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
  if (body.status && body.status !== 'draft') {
    await logStudentActivity(studentId, 'plan_submitted', 'Treatment plan submitted', { planId });
  }
  res.json(result.rows[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: LIST / OVERVIEW / APPROVE / DEACTIVATE / EVALUATE
// ═══════════════════════════════════════════════════════════════════════════
async function listStudents(params, res) {
  await ensureTables();

  // Auto-approve pending students with active postings
  try {
    const pendingActive = await query(`
      SELECT id FROM students
      WHERE is_approved = false AND is_active = true AND posting_end >= NOW()
    `);
    for (const s of pendingActive.rows) {
      await query('UPDATE students SET is_approved = true, updated_at = NOW() WHERE id = $1', [s.id]);
    }
  } catch (e) { console.warn('Auto-approve on list (non-fatal):', e.message); }

  // Auto-assign patients for all approved+active students who have < 5 patients
  try {
    const needAssign = await query(`
      SELECT s.id FROM students s
      WHERE s.is_approved = true AND s.is_active = true
        AND s.posting_end >= NOW()
        AND (SELECT COUNT(*) FROM student_patient_assignments spa WHERE spa.student_id = s.id AND spa.is_active = true) < 5
    `);
    for (const s of needAssign.rows) {
      await autoAssignPatients(s.id);
    }
  } catch (e) { console.warn('Auto-assign on list (non-fatal):', e.message); }

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

  // Attach a comprehensive, rotation-scoped performance record to each student
  const withMetrics = [];
  for (const s of result.rows) {
    let metrics = null;
    try { metrics = await computeStudentMetrics(s.id, s); } catch (e) { console.warn('listStudents metrics:', e.message); }
    withMetrics.push({ ...s, metrics });
  }
  res.json(withMetrics);
}

async function getStudentsOverview(res) {
  try {
    await ensureTables();
  } catch (e) {
    console.warn('overview ensureTables failed (non-fatal):', e.message);
  }

  // Each query is independent so a single failure shouldn't 500 the whole route.
  const safe = async (sql, fallback) => {
    try { return (await query(sql)).rows; }
    catch (e) { console.warn('overview query failed:', e.message); return fallback; }
  };

  const statsRows = await safe(`
    SELECT 
      COUNT(*) as total_students,
      COUNT(*) FILTER (WHERE is_active AND is_approved) as active_students,
      COUNT(*) FILTER (WHERE NOT is_approved) as pending_approval,
      COUNT(*) FILTER (WHERE posting_end < NOW()) as expired_postings
    FROM students
  `, [{ total_students: 0, active_students: 0, pending_approval: 0, expired_postings: 0 }]);

  const recentClerkings = await safe(`
    SELECT sc.id, sc.patient_id, sc.provisional_diagnosis, sc.status, sc.evaluation_score, sc.created_at,
           s.full_name as student_name, p.first_name, p.last_name
    FROM student_clerkings sc
    JOIN students s ON s.id = sc.student_id
    LEFT JOIN patients p ON p.id::text = sc.patient_id
    ORDER BY sc.created_at DESC LIMIT 10
  `, []);

  res.json({ stats: statsRows[0] || {}, recentClerkings });
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

  const activities = await safeRows(`
    SELECT activity_type, description, metadata, created_at
    FROM student_activity_logs
    WHERE student_id = $1
    ORDER BY created_at DESC LIMIT 100
  `, [studentId]);

  const metrics = await computeStudentMetrics(studentId, student.rows[0]);

  res.json({
    student: student.rows[0],
    patients,
    clerkings,
    treatmentPlans: plans,
    activities,
    metrics
  });
}

async function approveStudent(body, res) {
  await ensureTables();
  const { studentId, approved } = body;
  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  await query('UPDATE students SET is_approved = $2, updated_at = NOW() WHERE id = $1', [studentId, approved !== false]);

  // Auto-assign patients on approval
  let assignResult = { assigned: 0 };
  if (approved !== false) {
    assignResult = await autoAssignPatients(studentId);
  }

  res.json({ 
    message: approved !== false 
      ? `Student approved & ${assignResult.assigned} patients assigned` 
      : 'Student approval revoked',
    ...assignResult
  });
}

async function bulkApproveStudents(res) {
  await ensureTables();
  // Approve all pending, active students whose posting hasn't expired
  const pending = await query(`
    SELECT id FROM students WHERE is_approved = false AND is_active = true AND posting_end >= NOW()
  `);

  let approved = 0;
  let totalAssigned = 0;
  for (const s of pending.rows) {
    await query('UPDATE students SET is_approved = true, updated_at = NOW() WHERE id = $1', [s.id]);
    approved++;
    const result = await autoAssignPatients(s.id);
    totalAssigned += result.assigned || 0;
  }

  // Also approve expired-posting students (just approve, no patient assignment)
  const pendingExpired = await query(`
    SELECT id FROM students WHERE is_approved = false AND is_active = true AND posting_end < NOW()
  `);
  for (const s of pendingExpired.rows) {
    await query('UPDATE students SET is_approved = true, updated_at = NOW() WHERE id = $1', [s.id]);
    approved++;
  }

  res.json({ message: `${approved} students approved, ${totalAssigned} patients assigned across active students` });
}

async function autoAssignAllStudents(res) {
  try {
    await ensureTables();
  } catch (e) {
    console.warn('auto-assign-all ensureTables failed (non-fatal):', e.message);
  }

  let active;
  try {
    active = await query(`
      SELECT id FROM students WHERE is_approved = true AND is_active = true AND posting_end >= NOW()
    `);
  } catch (e) {
    console.warn('auto-assign-all: list query failed:', e.message);
    return res.json({ message: '0 patients assigned (no eligible students)', assigned: 0, students: 0, error: e.message });
  }

  let totalAssigned = 0;
  let failures = 0;
  for (const s of active.rows) {
    try {
      const result = await autoAssignPatients(s.id);
      totalAssigned += result.assigned || 0;
    } catch (e) {
      failures++;
      console.warn('auto-assign-all: student', s.id, 'failed:', e.message);
    }
  }

  res.json({
    message: `${totalAssigned} patients assigned across ${active.rows.length} active students` + (failures ? ` (${failures} failures)` : ''),
    assigned: totalAssigned,
    students: active.rows.length,
    failures,
  });
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

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: PATIENT ASSIGNMENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Trigger auto-assign for a specific student
async function adminAssignPatients(body, res) {
  await ensureTables();
  const { studentId } = body;
  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  const student = await query('SELECT id, is_approved, is_active FROM students WHERE id = $1', [studentId]);
  if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });
  if (!student.rows[0].is_approved) return res.status(400).json({ error: 'Student must be approved first' });
  if (!student.rows[0].is_active) return res.status(400).json({ error: 'Student is deactivated' });

  const result = await autoAssignPatients(studentId);
  res.json({ message: `${result.assigned} patients assigned (total: ${result.total}/5)`, ...result });
}

// Manually assign a specific patient to a student
async function adminAssignSinglePatient(body, res) {
  await ensureTables();
  const { studentId, patientId } = body;
  if (!studentId || !patientId) return res.status(400).json({ error: 'studentId and patientId required' });

  // Verify student exists and is active
  const student = await query('SELECT id, is_approved, is_active FROM students WHERE id = $1', [studentId]);
  if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

  // Check current count
  const countResult = await query(
    'SELECT COUNT(*) as cnt FROM student_patient_assignments WHERE student_id = $1 AND is_active = true',
    [studentId]
  );
  if (parseInt(countResult.rows[0].cnt) >= 5) {
    return res.status(400).json({ error: 'Student already has maximum 5 patients' });
  }

  // Verify patient exists
  const patient = await query('SELECT id, hospital_number FROM patients WHERE id = $1', [patientId]);
  if (patient.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

  await query(
    `INSERT INTO student_patient_assignments (student_id, patient_id, hospital_number, is_active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (student_id, patient_id) DO UPDATE SET is_active = true, assigned_at = NOW()`,
    [studentId, String(patientId), patient.rows[0].hospital_number]
  );

  res.json({ message: 'Patient assigned to student' });
}

// Remove a patient assignment
async function adminUnassignPatient(body, res) {
  const { studentId, patientId } = body;
  if (!studentId || !patientId) return res.status(400).json({ error: 'studentId and patientId required' });

  await query(
    'UPDATE student_patient_assignments SET is_active = false WHERE student_id = $1 AND patient_id = $2',
    [studentId, String(patientId)]
  );

  res.json({ message: 'Patient unassigned' });
}

// Get available patients for assignment
async function getAvailablePatients(params, res) {
  await ensureTables();
  const studentId = params.get('studentId');
  const search = params.get('search') || '';

  let sql = `
    SELECT p.id, p.hospital_number, p.first_name, p.last_name, p.full_name, 
           p.ward_id, p.bed_number, p.sex
    FROM patients p
    WHERE p.deleted IS NOT TRUE
  `;
  const values = [];
  let paramIndex = 1;

  // Exclude patients already assigned to this student
  if (studentId) {
    sql += ` AND p.id::text NOT IN (
      SELECT spa.patient_id FROM student_patient_assignments spa 
      WHERE spa.student_id = $${paramIndex} AND spa.is_active = true
    )`;
    values.push(studentId);
    paramIndex++;
  }

  // Search filter
  if (search) {
    sql += ` AND (p.hospital_number ILIKE $${paramIndex} OR p.first_name ILIKE $${paramIndex} OR p.last_name ILIKE $${paramIndex} OR p.full_name ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }

  sql += ' ORDER BY p.created_at DESC LIMIT 20';

  const result = await query(sql, values);
  res.json(result.rows);
}

// ═══════════════════════════════════════════════════════════════════════════
// CLINICAL POSTING GROUPS (5 even groups) + activities + sign-out eligibility
// ═══════════════════════════════════════════════════════════════════════════
const NUM_GROUPS = 5;
// Sign-out requirements per student = group activities + individual training.
const STUDENT_REQ = {
  topicPresentation: 1,   // group presents a topic
  clerkings: 2,           // group clerks & presents >= 2 admitted patients
  woundDressing: 1,       // group participates in wound-dressing clinic
  woundInspection: 1,     // group does Tuesday wound inspection
  cbt: 1,                 // individual: at least one CBT
  cme: 3,                 // individual: CME articles read
  selfAssessment: 3,      // individual: self-assessment tests
};
const GROUP_ACTIVITY_TYPES = ['topic_presentation', 'patient_clerking', 'wound_dressing', 'wound_inspection'];

let _groupSchemaReady = false;
async function ensureGroupTables() {
  if (_groupSchemaReady) return;
  await ensureTables();
  const stmts = [
    `ALTER TABLE students ADD COLUMN IF NOT EXISTS group_number INTEGER`,
    `CREATE TABLE IF NOT EXISTS student_groups (
       group_number INTEGER PRIMARY KEY,
       topic_title TEXT,
       topic_presented BOOLEAN DEFAULT FALSE,
       topic_presented_at TIMESTAMPTZ,
       notes TEXT,
       updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS student_group_patients (
       id SERIAL PRIMARY KEY,
       group_number INTEGER NOT NULL,
       patient_id VARCHAR(255) NOT NULL,
       hospital_number VARCHAR(100),
       patient_name VARCHAR(255),
       assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       is_active BOOLEAN DEFAULT TRUE,
       UNIQUE(group_number, patient_id)
     )`,
    `CREATE TABLE IF NOT EXISTS student_group_activities (
       id SERIAL PRIMARY KEY,
       group_number INTEGER NOT NULL,
       activity_type VARCHAR(40) NOT NULL,
       title TEXT,
       patient_id VARCHAR(255),
       hospital_number VARCHAR(100),
       activity_date DATE DEFAULT CURRENT_DATE,
       recorded_by VARCHAR(255),
       notes TEXT,
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
     )`,
    `CREATE TABLE IF NOT EXISTS student_training_progress (
       id SERIAL PRIMARY KEY,
       student_id INTEGER NOT NULL,
       kind VARCHAR(30) NOT NULL,          -- 'cme' | 'cbt' | 'self_assessment'
       ref_id VARCHAR(255),                -- topic/test id
       title TEXT,
       score NUMERIC(5,2),
       total INTEGER,
       created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
       UNIQUE(student_id, kind, ref_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_sgp_group ON student_group_patients(group_number)`,
    `CREATE INDEX IF NOT EXISTS idx_sga_group ON student_group_activities(group_number, activity_type)`,
    `CREATE INDEX IF NOT EXISTS idx_stp_student ON student_training_progress(student_id, kind)`,
  ];
  for (const s of stmts) { try { await query(s); } catch (e) { console.warn('ensureGroupTables skipped:', e.message); } }
  // Seed the five group rows.
  for (let g = 1; g <= NUM_GROUPS; g++) {
    try { await query(`INSERT INTO student_groups (group_number) VALUES ($1) ON CONFLICT (group_number) DO NOTHING`, [g]); } catch (_) {}
  }
  _groupSchemaReady = true;
}

// Evenly distribute all approved+active students into the 5 groups (round-robin).
async function assignStudentGroups(body, res) {
  await ensureGroupTables();
  const students = (await query(
    `SELECT id FROM students WHERE is_approved = TRUE AND is_active = TRUE ORDER BY id`
  )).rows;
  const counts = Array(NUM_GROUPS + 1).fill(0);
  for (let i = 0; i < students.length; i++) {
    const g = (i % NUM_GROUPS) + 1;
    await query(`UPDATE students SET group_number = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [g, students[i].id]);
    counts[g]++;
  }
  const groups = [];
  for (let g = 1; g <= NUM_GROUPS; g++) groups.push({ group: g, members: counts[g] });
  return res.status(200).json({ ok: true, total: students.length, groups });
}

// Evenly assign active admitted patients across the 5 groups (round-robin), and
// link each group's patients to every student in that group so the patients show
// up on the students' own dashboards.
async function assignGroupPatients(body, res) {
  await ensureGroupTables();

  // Active admissions with patient identity. Try the richest query, then degrade
  // gracefully so an unexpected column never yields "0 assigned".
  let patients = [];
  const attempts = [
    `SELECT a.patient_id::text AS patient_id,
            COALESCE(a.hospital_number, p.hospital_number) AS hospital_number,
            COALESCE(a.patient_name, NULLIF(TRIM(COALESCE(p.first_name,'') || ' ' || COALESCE(p.last_name,'')), '')) AS patient_name
       FROM admissions a
       LEFT JOIN patients p ON p.id = a.patient_id
      WHERE a.status IN ('active','admitted') AND a.patient_id IS NOT NULL
      ORDER BY a.admission_date DESC NULLS LAST, a.id DESC`,
    `SELECT id::text AS patient_id, hospital_number,
            NULLIF(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,'')), '') AS patient_name
       FROM patients ORDER BY created_at DESC`, // fallback: all patients if no admissions table/data
  ];
  for (const sql of attempts) {
    try {
      const r = await query(sql);
      if (r.rows.length) { patients = r.rows; break; }
      patients = r.rows; // keep (possibly empty) result from the primary query
      if (sql === attempts[0]) continue; // if admissions returned 0, try the fallback
    } catch (e) { console.warn('assignGroupPatients source query failed, trying fallback:', e.message); }
  }

  // Students per group (so group patients also land on each student's list).
  const studentsByGroup = new Map();
  const srows = (await query(
    `SELECT id, group_number FROM students WHERE is_approved = TRUE AND is_active = TRUE AND group_number IS NOT NULL`
  )).rows;
  for (const s of srows) {
    if (!studentsByGroup.has(s.group_number)) studentsByGroup.set(s.group_number, []);
    studentsByGroup.get(s.group_number).push(s.id);
  }

  let assigned = 0, linked = 0;
  const perGroup = Array(NUM_GROUPS + 1).fill(0);
  for (let i = 0; i < patients.length; i++) {
    const g = (i % NUM_GROUPS) + 1;
    const pid = patients[i].patient_id;
    try {
      await query(
        `INSERT INTO student_group_patients (group_number, patient_id, hospital_number, patient_name)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (group_number, patient_id) DO UPDATE SET is_active = TRUE, hospital_number = EXCLUDED.hospital_number, patient_name = EXCLUDED.patient_name`,
        [g, pid, patients[i].hospital_number || null, patients[i].patient_name || null]
      );
      perGroup[g]++; assigned++;
      // Link this patient to every student in the group.
      for (const sid of (studentsByGroup.get(g) || [])) {
        try {
          await query(
            `INSERT INTO student_patient_assignments (student_id, patient_id, hospital_number, is_active)
             VALUES ($1,$2,$3,TRUE)
             ON CONFLICT (student_id, patient_id) DO UPDATE SET is_active = TRUE, assigned_at = NOW()`,
            [sid, pid, patients[i].hospital_number || null]
          );
          linked++;
        } catch (e) { console.warn('link student_patient_assignment skipped:', e.message); }
      }
    } catch (e) { console.warn('assignGroupPatients insert skipped:', e.message); }
  }
  const groups = [];
  for (let g = 1; g <= NUM_GROUPS; g++) groups.push({ group: g, patients: perGroup[g], students: (studentsByGroup.get(g) || []).length });
  return res.status(200).json({ ok: true, totalPatients: patients.length, assigned, studentLinks: linked, groups });
}

async function setGroupTopic(body, res) {
  await ensureGroupTables();
  const { groupNumber, topicTitle } = body || {};
  if (!groupNumber) return res.status(400).json({ error: 'groupNumber required' });
  await query(
    `INSERT INTO student_groups (group_number, topic_title, updated_at)
     VALUES ($1,$2,CURRENT_TIMESTAMP)
     ON CONFLICT (group_number) DO UPDATE SET topic_title = EXCLUDED.topic_title, updated_at = CURRENT_TIMESTAMP`,
    [groupNumber, topicTitle || null]
  );
  return res.status(200).json({ ok: true });
}

async function logGroupActivity(user, body, res) {
  await ensureGroupTables();
  const { groupNumber, activityType, title, patientId, hospitalNumber, activityDate, notes } = body || {};
  if (!groupNumber || !GROUP_ACTIVITY_TYPES.includes(activityType)) {
    return res.status(400).json({ error: `groupNumber and valid activityType (${GROUP_ACTIVITY_TYPES.join(', ')}) required` });
  }
  await query(
    `INSERT INTO student_group_activities (group_number, activity_type, title, patient_id, hospital_number, activity_date, recorded_by, notes)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8)`,
    [groupNumber, activityType, title || null, patientId || null, hospitalNumber || null, activityDate || null,
     user?.full_name || user?.name || null, notes || null]
  );
  if (activityType === 'topic_presentation') {
    await query(
      `UPDATE student_groups SET topic_presented = TRUE, topic_presented_at = CURRENT_TIMESTAMP,
              topic_title = COALESCE(topic_title, $2), updated_at = CURRENT_TIMESTAMP WHERE group_number = $1`,
      [groupNumber, title || null]
    );
  }
  return res.status(201).json({ ok: true });
}

// Group requirements met from activity counts.
function groupEligibility(activityCounts) {
  const met = [], notMet = [];
  const chk = (label, actual, need) => { (actual >= need ? met : notMet).push(`${label}: ${actual}/${need}`); };
  chk('Topic presentation', activityCounts.topic_presentation || 0, STUDENT_REQ.topicPresentation);
  chk('Patients clerked & presented', activityCounts.patient_clerking || 0, STUDENT_REQ.clerkings);
  chk('Wound-dressing clinic', activityCounts.wound_dressing || 0, STUDENT_REQ.woundDressing);
  chk('Wound inspection (Tue)', activityCounts.wound_inspection || 0, STUDENT_REQ.woundInspection);
  return { eligible: notMet.length === 0, met, notMet };
}

// Full group overview with members, patients, activities, individual training,
// and combined sign-out eligibility (group activities + each member's CBT/CME/self-assessment).
async function getStudentGroups(res) {
  await ensureGroupTables();

  const members = (await query(
    `SELECT id, full_name, email, matric_number, group_number
       FROM students WHERE is_approved = TRUE AND is_active = TRUE AND group_number IS NOT NULL
      ORDER BY group_number, full_name`
  )).rows;
  const groupsMeta = (await query(`SELECT * FROM student_groups ORDER BY group_number`)).rows;
  const patients = (await query(`SELECT * FROM student_group_patients WHERE is_active = TRUE ORDER BY group_number, assigned_at DESC`)).rows;
  const activities = (await query(
    `SELECT group_number, activity_type, COUNT(*)::int AS cnt FROM student_group_activities GROUP BY group_number, activity_type`
  )).rows;
  const training = (await query(
    `SELECT student_id, kind, COUNT(*)::int AS cnt, COALESCE(AVG(score),0)::float AS avg_score
       FROM student_training_progress GROUP BY student_id, kind`
  )).rows;

  const trainingByStudent = new Map();
  for (const t of training) {
    if (!trainingByStudent.has(t.student_id)) trainingByStudent.set(t.student_id, {});
    trainingByStudent.get(t.student_id)[t.kind] = { count: t.cnt, avg: Math.round(t.avg_score * 10) / 10 };
  }

  const groups = [];
  for (let g = 1; g <= NUM_GROUPS; g++) {
    const meta = groupsMeta.find(m => m.group_number === g) || { group_number: g };
    const gmembers = members.filter(m => m.group_number === g);
    const gpatients = patients.filter(p => p.group_number === g);
    const acts = {};
    for (const a of activities.filter(a => a.group_number === g)) acts[a.activity_type] = a.cnt;
    const grpElig = groupEligibility(acts);

    const memberRows = gmembers.map(m => {
      const tr = trainingByStudent.get(m.id) || {};
      const cbt = tr.cbt?.count || 0, cme = tr.cme?.count || 0, sa = tr.self_assessment?.count || 0;
      const indMet = cbt >= STUDENT_REQ.cbt && cme >= STUDENT_REQ.cme && sa >= STUDENT_REQ.selfAssessment;
      return {
        id: m.id, full_name: m.full_name, matric_number: m.matric_number,
        cbtCount: cbt, cbtAvg: tr.cbt?.avg || 0,
        cmeCount: cme, selfAssessmentCount: sa, selfAssessmentAvg: tr.self_assessment?.avg || 0,
        individualEligible: indMet,
        signOutEligible: indMet && grpElig.eligible,
      };
    });

    groups.push({
      groupNumber: g,
      topicTitle: meta.topic_title || null,
      topicPresented: !!meta.topic_presented,
      members: memberRows,
      memberCount: gmembers.length,
      patients: gpatients,
      patientCount: gpatients.length,
      activityCounts: acts,
      groupEligibility: grpElig,
      requirements: STUDENT_REQ,
    });
  }
  return res.status(200).json({ groups, numGroups: NUM_GROUPS, requirements: STUDENT_REQ });
}

// Student self-service: record CME read / CBT / self-assessment participation.
async function recordStudentTraining(studentId, body, res) {
  await ensureGroupTables();
  const { kind, refId, title, score, total } = body || {};
  if (!['cme', 'cbt', 'self_assessment'].includes(kind)) {
    return res.status(400).json({ error: "kind must be 'cme' | 'cbt' | 'self_assessment'" });
  }
  await query(
    `INSERT INTO student_training_progress (student_id, kind, ref_id, title, score, total)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (student_id, kind, ref_id) DO UPDATE SET
       score = GREATEST(COALESCE(student_training_progress.score,0), COALESCE(EXCLUDED.score,0)),
       title = EXCLUDED.title, created_at = CURRENT_TIMESTAMP`,
    [studentId, kind, refId || `${kind}-${Date.now()}`, title || null, score ?? null, total ?? null]
  );
  return res.status(201).json({ ok: true });
}

// Student's own training + group + eligibility summary.
async function getStudentTrainingSummary(studentId, res) {
  await ensureGroupTables();
  const student = (await query(`SELECT id, full_name, group_number FROM students WHERE id = $1`, [studentId])).rows[0];
  if (!student) return res.status(404).json({ error: 'Student not found' });
  const g = student.group_number;
  const tr = (await query(
    `SELECT kind, COUNT(*)::int AS cnt, COALESCE(AVG(score),0)::float AS avg FROM student_training_progress WHERE student_id = $1 GROUP BY kind`,
    [studentId]
  )).rows;
  const t = {}; for (const r of tr) t[r.kind] = { count: r.cnt, avg: Math.round(r.avg * 10) / 10 };
  let grpElig = { eligible: false, met: [], notMet: ['Not assigned to a group'] };
  if (g) {
    const acts = {};
    for (const a of (await query(`SELECT activity_type, COUNT(*)::int AS cnt FROM student_group_activities WHERE group_number = $1 GROUP BY activity_type`, [g])).rows) acts[a.activity_type] = a.cnt;
    grpElig = groupEligibility(acts);
  }
  const cbt = t.cbt?.count || 0, cme = t.cme?.count || 0, sa = t.self_assessment?.count || 0;
  const indMet = [];
  const indNotMet = [];
  (cbt >= STUDENT_REQ.cbt ? indMet : indNotMet).push(`CBT: ${cbt}/${STUDENT_REQ.cbt}`);
  (cme >= STUDENT_REQ.cme ? indMet : indNotMet).push(`CME articles: ${cme}/${STUDENT_REQ.cme}`);
  (sa >= STUDENT_REQ.selfAssessment ? indMet : indNotMet).push(`Self-assessment: ${sa}/${STUDENT_REQ.selfAssessment}`);
  const eligible = grpElig.eligible && indNotMet.length === 0;
  return res.status(200).json({
    groupNumber: g,
    training: { cbt: cbt, cme: cme, selfAssessment: sa, cbtAvg: t.cbt?.avg || 0, selfAssessmentAvg: t.self_assessment?.avg || 0 },
    groupEligibility: grpElig,
    individual: { met: indMet, notMet: indNotMet },
    signOutEligible: eligible,
    requirements: STUDENT_REQ,
  });
}
