// House Officer Tracking API
// Provides detailed HO documentation logs, patient care metrics, and sign-out eligibility
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';

const ADMIN_ROLES = ['consultant', 'super_admin', 'admin', 'senior_registrar'];

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const authResult = authenticateRequest(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  try {
    const { method } = req;
    switch (method) {
      case 'GET': return await handleGet(req, res, authResult.user);
      case 'POST': return await handlePost(req, res, authResult.user);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('HO Tracking API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, currentUser) {
  const { action, userId } = req.query;

  switch (action) {
    case 'all-house-officers': {
      // Only admin/consultant/senior registrar can view all HOs
      if (!ADMIN_ROLES.includes(currentUser.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const hos = await query(`
        SELECT u.id, u.username, u.full_name, u.email, u.role, u.is_active,
               u.created_at as registered_at
        FROM users u
        WHERE u.role IN ('house_officer', 'intern')
          AND u.is_active = true
        ORDER BY u.full_name
      `);

      const enriched = [];
      for (const ho of hos.rows) {
        enriched.push({
          ...ho,
          ...(await getHOFullMetrics(ho.id, ho.full_name, ho.username)),
        });
      }

      return res.status(200).json({ houseOfficers: enriched });
    }

    case 'ho-detail': {
      const targetId = userId || currentUser.id;
      // HOs can view their own; admins can view any
      if (String(targetId) !== String(currentUser.id) && !ADMIN_ROLES.includes(currentUser.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const user = await query(`SELECT id, username, full_name, role, email, created_at FROM users WHERE id = $1`, [targetId]);
      if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

      const ho = user.rows[0];
      const metrics = await getHOFullMetrics(ho.id, ho.full_name, ho.username);

      // Helper: safe query that returns empty rows on failure (missing tables, etc.)
      const safeDetailQuery = async (sql, params) => {
        try { return (await query(sql, params)).rows; } catch (e) { console.warn('ho-detail query failed:', e.message); return []; }
      };

      // Documentation logs — ward rounds by this HO
      const wardRounds = await safeDetailQuery(`
        SELECT wr.id, wr.patient_id, wr.round_date, wr.round_type, wr.clinical_notes,
               wr.progress_status, wr.treatment_plan_updated, wr.medications_changed,
               wr.wound_assessment_done, wr.created_at,
               p.first_name, p.last_name, p.hospital_number
        FROM ward_rounds wr
        LEFT JOIN patients p ON wr.patient_id::text = p.id::text
        WHERE wr.user_id = $1
        ORDER BY wr.created_at DESC LIMIT 50
      `, [targetId]);

      // Prescriptions written
      const prescriptions = await safeDetailQuery(`
        SELECT pr.id, pr.patient_id, pr.medication_name, pr.dosage, pr.created_at,
               p.first_name, p.last_name, p.hospital_number
        FROM prescriptions pr
        LEFT JOIN patients p ON pr.patient_id::text = p.id::text
        WHERE pr.prescribed_by = $1
        ORDER BY pr.created_at DESC LIMIT 50
      `, [targetId]);

      // Lab orders placed
      const labOrders = await safeDetailQuery(`
        SELECT lo.id, lo.patient_id, lo.test_name, lo.urgency, lo.status, lo.created_at,
               p.first_name, p.last_name, p.hospital_number
        FROM lab_orders lo
        LEFT JOIN patients p ON lo.patient_id::text = p.id::text
        WHERE lo.ordered_by = $1
        ORDER BY lo.created_at DESC LIMIT 50
      `, [targetId]);

      // Progress notes / activity logs
      const activityLogs = await safeDetailQuery(`
        SELECT * FROM activity_logs
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 100
      `, [targetId]);

      // CBT attempts
      const cbtAttempts = await safeDetailQuery(`
        SELECT * FROM cbt_attempts
        WHERE user_id = $1 AND completed = true
        ORDER BY created_at DESC
      `, [targetId]);

      // Training/CME progress
      const cmeProgress = await safeDetailQuery(`
        SELECT * FROM training_progress
        WHERE user_id = $1
        ORDER BY completed_at DESC
      `, [targetId]);

      // Assigned patients
      const assignedPatients = await safeDetailQuery(`
        SELECT pa.*, p.first_name, p.last_name, p.hospital_number,
               a.ward_location, a.bed_number, a.status as admission_status
        FROM patient_assignments pa
        LEFT JOIN patients p ON pa.patient_id = p.id
        LEFT JOIN admissions a ON a.patient_id = pa.patient_id AND a.status = 'active'
        WHERE pa.house_officer_id = $1 AND pa.is_active = true
        ORDER BY pa.assigned_at DESC
      `, [targetId]);

      // Rotation
      const rotationRows = await safeDetailQuery(`
        SELECT * FROM trainee_rotations
        WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')
        ORDER BY created_at DESC LIMIT 1
      `, [targetId]);

      return res.status(200).json({
        houseOfficer: { ...ho, ...metrics },
        wardRounds,
        prescriptions,
        labOrders,
        activityLogs,
        cbtAttempts,
        cmeProgress,
        assignedPatients,
        rotation: rotationRows[0] || null,
      });
    }

    case 'documentation-summary': {
      // Summary of documentation per HO for a date range
      if (!ADMIN_ROLES.includes(currentUser.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { from, to } = req.query;
      const fromDate = from || new Date(Date.now() - 30 * 86400000).toISOString();
      const toDate = to || new Date().toISOString();

      const hoUsers = await query(`
        SELECT id, full_name FROM users
        WHERE role IN ('house_officer', 'intern') AND is_active = true
        ORDER BY full_name
      `);

      const summary = [];
      for (const ho of hoUsers.rows) {
        const wr = await query(
          `SELECT COUNT(*) as cnt FROM ward_rounds
           WHERE user_id = $1
             AND created_at BETWEEN $2 AND $3`,
          [ho.id, fromDate, toDate]
        );
        const rx = await query(
          `SELECT COUNT(*) as cnt FROM prescriptions WHERE prescribed_by = $1 AND created_at BETWEEN $2 AND $3`,
          [ho.id, fromDate, toDate]
        );
        const labs = await query(
          `SELECT COUNT(*) as cnt FROM lab_orders WHERE ordered_by = $1 AND created_at BETWEEN $2 AND $3`,
          [ho.id, fromDate, toDate]
        );
        const notes = await query(
          `SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = $1 AND activity_type = 'patient_entry' AND created_at BETWEEN $2 AND $3`,
          [ho.id, fromDate, toDate]
        );

        summary.push({
          id: ho.id,
          name: ho.full_name,
          wardRounds: parseInt(wr.rows[0].cnt),
          prescriptions: parseInt(rx.rows[0].cnt),
          labOrders: parseInt(labs.rows[0].cnt),
          patientNotes: parseInt(notes.rows[0].cnt),
          totalDocumentation: parseInt(wr.rows[0].cnt) + parseInt(rx.rows[0].cnt) + parseInt(labs.rows[0].cnt) + parseInt(notes.rows[0].cnt),
        });
      }

      return res.status(200).json({ summary, from: fromDate, to: toDate });
    }

    default:
      return res.status(400).json({ error: 'Invalid action. Use: all-house-officers, ho-detail, documentation-summary' });
  }
}

async function handlePost(req, res, currentUser) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'request-signout': {
      // HO can request sign-out for their rotation
      const rotation = await query(
        `SELECT * FROM trainee_rotations WHERE user_id = $1 AND status IN ('active', 'extended') ORDER BY created_at DESC LIMIT 1`,
        [currentUser.id]
      );
      if (rotation.rows.length === 0) {
        return res.status(400).json({ error: 'No active rotation found' });
      }

      await query(
        `UPDATE trainee_rotations SET status = 'pending_signout', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [rotation.rows[0].id]
      );

      // Log the activity
      await query(
        `INSERT INTO activity_logs (user_id, activity_type, description, metadata)
         VALUES ($1, 'signout_requested', $2, $3)`,
        [currentUser.id, `Sign-out requested for rotation #${rotation.rows[0].id}`,
         JSON.stringify({ rotation_id: rotation.rows[0].id })]
      );

      return res.status(200).json({ message: 'Sign-out request submitted', rotationId: rotation.rows[0].id });
    }

    case 'approve-signout': {
      if (!ADMIN_ROLES.includes(currentUser.role)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const { rotationId, approved, comments, finalScore } = body;
      if (!rotationId) return res.status(400).json({ error: 'rotationId required' });

      if (approved) {
        await query(
          `UPDATE trainee_rotations
           SET status = 'signed_out', actual_end_date = CURRENT_TIMESTAMP,
               sign_out_approved = true, sign_out_approved_by = $1,
               sign_out_approved_at = CURRENT_TIMESTAMP,
               sign_out_comments = $2, final_score = $3, updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [currentUser.id, comments || 'Approved', finalScore || 0, rotationId]
        );

        await query(
          `INSERT INTO activity_logs (user_id, activity_type, description, metadata)
           VALUES ((SELECT user_id FROM trainee_rotations WHERE id = $1), 'signout_approved', $2, $3)`,
          [rotationId, `Sign-out approved by ${currentUser.full_name || currentUser.username}`,
           JSON.stringify({ rotation_id: rotationId, approved_by: currentUser.id })]
        );
      } else {
        await query(
          `UPDATE trainee_rotations SET status = 'active',
           sign_out_comments = COALESCE(sign_out_comments, '') || ' | Rejected: ' || $1,
           updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [comments || 'Requirements not met', rotationId]
        );

        await query(
          `INSERT INTO activity_logs (user_id, activity_type, description, metadata)
           VALUES ((SELECT user_id FROM trainee_rotations WHERE id = $1), 'signout_rejected', $2, $3)`,
          [rotationId, `Sign-out rejected: ${comments || 'Requirements not met'}`,
           JSON.stringify({ rotation_id: rotationId, rejected_by: currentUser.id })]
        );
      }

      return res.status(200).json({ success: true, approved });
    }

    case 'log-documentation': {
      // Log an HO documentation activity
      const { patientId, documentationType, description, metadata } = body;
      if (!documentationType) return res.status(400).json({ error: 'documentationType required' });

      await query(
        `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [currentUser.id, documentationType, description || '',
         getDocumentationPoints(documentationType),
         JSON.stringify({ patient_id: patientId, ...metadata })]
      );

      return res.status(201).json({ message: 'Documentation logged' });
    }

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

// ── Helpers ──

function getDocumentationPoints(type) {
  const points = {
    ward_round: 5,
    prescription: 3,
    lab_order: 3,
    patient_entry: 4,
    progress_note: 4,
    discharge_summary: 8,
    admission_note: 6,
    procedure_note: 7,
    consultation: 5,
  };
  return points[type] || 2;
}

async function getHOFullMetrics(userId, fullName, username) {
  const uid = String(userId);       // For VARCHAR columns
  const uidInt = parseInt(userId);   // For INTEGER columns

  // Helper: safely run a query, returns default on error
  async function safeQuery(sql, params, defaultVal) {
    try {
      const r = await query(sql, params);
      return r.rows[0] || defaultVal;
    } catch (e) { return defaultVal; }
  }

  // ── 0. Rotation date scope — only count activity within the active rotation ──
  let rotationDateClause = '';      // e.g. " AND created_at >= '2026-03-01'"
  let rotationDateClauseTs = '';    // for columns named "timestamp"
  let rotationStart = null;
  const rotRow = await safeQuery(
    `SELECT start_date FROM trainee_rotations
     WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')
     ORDER BY created_at DESC LIMIT 1`,
    [uidInt], null
  );
  if (rotRow && rotRow.start_date) {
    rotationStart = rotRow.start_date;
    // Use parameterised dates where possible; for the loop-based queries we
    // append a safe literal (ISO date) so we don't have to renumber all $N placeholders.
    const iso = new Date(rotRow.start_date).toISOString();
    rotationDateClause = ` AND created_at >= '${iso}'`;
    rotationDateClauseTs = ` AND timestamp >= '${iso}'`;
  }

  // ── 1. CBT Tests ──
  const cbt = await safeQuery(
    `SELECT COUNT(*) as completed,
            COALESCE(AVG(
              CASE WHEN percentage IS NOT NULL AND percentage > 0 THEN percentage
                   WHEN score IS NOT NULL AND total_marks > 0 THEN (score::numeric / total_marks) * 100
                   ELSE 0 END
            ), 0) as avg_score,
            COALESCE(MAX(percentage), 0) as best_score,
            COALESCE(MIN(NULLIF(percentage, 0)), 0) as worst_score
     FROM cbt_attempts WHERE (user_id = $1 OR user_id::text = $2) AND (completed = true OR passed = true)${rotationDateClause}`,
    [uidInt, uid], { completed: 0, avg_score: 0, best_score: 0, worst_score: 0 }
  );
  const cbtCompleted = parseInt(cbt.completed) || 0;
  const cbtAvgScore = parseFloat(cbt.avg_score) || 0;

  // ── Name matching for VARCHAR columns ──
  const auditUserClause = fullName
    ? `(user_id = $1 OR LOWER(user_name) = LOWER($2))`
    : `user_id = $1`;
  const auditUserParams = fullName ? [uid, fullName] : [uid];

  const nameMatchValues = [uid];
  let nameMatchClause = `($COL = $1`;
  let nameParamIdx = 1;
  if (fullName) {
    nameParamIdx++;
    nameMatchValues.push(fullName);
    nameMatchClause += ` OR LOWER($COL) = LOWER($${nameParamIdx})`;
  }
  if (username) {
    nameParamIdx++;
    nameMatchValues.push(username);
    nameMatchClause += ` OR LOWER($COL) = LOWER($${nameParamIdx})`;
  }
  nameMatchClause += `)`;

  // ── 2. Documentation Counts ──

  // ward_rounds: match by user_id (the only populated author column)
  {
    const wardRoundRow = await safeQuery(
      `SELECT COUNT(*) as cnt FROM ward_rounds WHERE user_id = $1${rotationDateClause}`, [uidInt], { cnt: 0 }
    );
    var wardRoundsDocumented = parseInt(wardRoundRow.cnt) || 0;
  }

  // prescriptions: match by prescribed_by (the only author column)
  {
    const prescriptionRow = await safeQuery(
      `SELECT COUNT(*) as cnt FROM prescriptions WHERE prescribed_by = $1${rotationDateClause}`, [uidInt], { cnt: 0 }
    );
    var prescriptionsWritten = parseInt(prescriptionRow.cnt) || 0;
  }

  // lab_orders: match by ordered_by (the only author column)
  {
    const labOrderRow = await safeQuery(
      `SELECT COUNT(*) as cnt FROM lab_orders WHERE ordered_by = $1${rotationDateClause}`, [uidInt], { cnt: 0 }
    );
    var labOrdersPlaced = parseInt(labOrderRow.cnt) || 0;
  }

  // ── 3. Patient Entries — count DISTINCT patient interactions across clinical tables ──
  //    Each table contributes unique patient-touching records by this HO.
  //    Ward rounds, prescriptions, and lab orders already counted above are NOT double-counted
  //    in patientCount — we sum ALL clinical documentation as "patient entries".
  let patientCount = 0;

  // 3a. Tables with created_by INTEGER
  for (const tbl of ['patients', 'treatment_plans', 'admissions', 'surgeries']) {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE created_by = $1${rotationDateClause}`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 3a2. prescriptions — already counted individually above, add to patient entries total too
  patientCount += prescriptionsWritten;

  // 3a3. ward_rounds — already counted individually above
  patientCount += wardRoundsDocumented;

  // 3a4. lab_orders — already counted individually above
  patientCount += labOrdersPlaced;

  // 3a5. discharge_summaries uses prepared_by
  {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM discharge_summaries WHERE prepared_by = $1${rotationDateClause}`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 3b. wound_care_records — recorded_by INTEGER
  {
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM wound_care_records WHERE recorded_by = $1${rotationDateClause}`, [uidInt], { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 3c. Tables with recorded_by VARCHAR — match by name/id
  for (const tbl of ['vital_signs', 'fluid_balance']) {
    const clause = nameMatchClause.replace(/\$COL/g, 'recorded_by');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE ${clause}${rotationDateClause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 3d. progress_notes — author VARCHAR
  {
    const clause = nameMatchClause.replace(/\$COL/g, 'author');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM progress_notes WHERE ${clause}${rotationDateClause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 3e. Assessment tables with assessed_by VARCHAR
  for (const tbl of ['dvt_assessments', 'pressure_sore_assessments', 'nutritional_assessments', 'diabetic_foot_assessments', 'preoperative_assessments']) {
    const clause = nameMatchClause.replace(/\$COL/g, 'assessed_by');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE ${clause}${rotationDateClause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // 3f. blood_transfusions — administered_by VARCHAR
  {
    const clause = nameMatchClause.replace(/\$COL/g, 'administered_by');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM blood_transfusions WHERE ${clause}${rotationDateClause}`, nameMatchValues, { cnt: 0 });
    patientCount += parseInt(r.cnt) || 0;
  }

  // ── 4. Duties — formal assignments + clinic/call duties (NO audit_log double-count) ──
  let dutiesCompleted = 0;

  // 4a. Formal duty assignments completed
  const formalDutyRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM duty_assignments WHERE user_id = $1 AND status = 'completed'${rotationDateClause}`,
    [uidInt], { cnt: 0 }
  );
  dutiesCompleted += parseInt(formalDutyRow.cnt) || 0;

  // 4b. Clinic duty logs
  {
    const clause = nameMatchClause.replace(/\$COL/g, 'user_id');
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM clinic_duty_logs WHERE ${clause}${rotationDateClause}`, nameMatchValues, { cnt: 0 });
    dutiesCompleted += parseInt(r.cnt) || 0;
  }

  // 4c. Call duty roster entries
  {
    let callClause = `(senior_registrar_id = $1 OR registrar_id = $1 OR house_officer_id = $1`;
    const callParams = [uid];
    let pIdx = 1;
    if (fullName) {
      pIdx++;
      callParams.push(fullName);
      callClause += ` OR LOWER(senior_registrar_name) = LOWER($${pIdx}) OR LOWER(registrar_name) = LOWER($${pIdx}) OR LOWER(house_officer_name) = LOWER($${pIdx})`;
    }
    callClause += `)`;
    const r = await safeQuery(`SELECT COUNT(*) as cnt FROM call_duty_roster WHERE ${callClause}${rotationDateClause}`, callParams, { cnt: 0 });
    dutiesCompleted += parseInt(r.cnt) || 0;
  }

  // NOTE: Removed audit_log clinical-action counting (section 4d) — those actions are already
  // captured in patient entries and should not be double-counted as duties.

  // Total duty assignments (for display)
  const dutiesTotal = await safeQuery(`SELECT COUNT(*) as cnt FROM duty_assignments WHERE user_id = $1${rotationDateClause}`, [uidInt], { cnt: 0 });

  // ── 5. Attendance / Login Days — UNION both sources for accurate count ──
  const loginRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM (
       SELECT DISTINCT DATE(timestamp) as d FROM audit_logs WHERE ${auditUserClause}${rotationDateClauseTs}
       UNION
       SELECT DISTINCT DATE(created_at) as d FROM activity_logs WHERE user_id = $${auditUserParams.length + 1} AND activity_type = 'login'${rotationDateClause}
     ) combined_logins`,
    [...auditUserParams, uidInt], { cnt: 0 }
  );
  let loginDays = parseInt(loginRow.cnt) || 0;

  // ── 6. CME / Education Topics ──
  let cmeCount = 0;
  const tpRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1 OR user_id::text = $2`,
    [uidInt, uid], { cnt: 0 }
  );
  cmeCount += parseInt(tpRow.cnt) || 0;

  const cmeReadRow = await safeQuery(
    `SELECT COUNT(DISTINCT article_id) as cnt FROM cme_reading_progress WHERE user_id = $1`, [uid], { cnt: 0 }
  );
  cmeCount += parseInt(cmeReadRow.cnt) || 0;

  const cmeProgRow = await safeQuery(
    `SELECT COUNT(*) as cnt FROM cme_progress WHERE user_id = $1 AND completed = true`, [uid], { cnt: 0 }
  );
  cmeCount += parseInt(cmeProgRow.cnt) || 0;

  // ── 7. Assigned patients (house_officer_id is VARCHAR, so cast uidInt to text) ──
  const assignedCount = await safeQuery(
    `SELECT COUNT(*) as cnt FROM patient_assignments WHERE (house_officer_id = $1::text OR house_officer_id = $2) AND is_active = true`, [uidInt, uid], { cnt: 0 }
  );

  // ── Calculate Scores ──
  const reqs = { cbtTests: 4, patientEntries: 30, duties: 20, loginDays: 25, overallScore: 70 };
  const patientScore = Math.min(100, (patientCount / reqs.patientEntries) * 100);
  const dutyScore = Math.min(100, (dutiesCompleted / reqs.duties) * 100);
  const attendanceScore = Math.min(100, (loginDays / reqs.loginDays) * 100);
  const overallScore = (cbtAvgScore * 0.30) + (patientScore * 0.35) + (dutyScore * 0.25) + (attendanceScore * 0.10);

  // Eligibility
  const met = [];
  const notMet = [];
  if (cbtCompleted >= reqs.cbtTests) met.push(`CBT: ${cbtCompleted}/${reqs.cbtTests}`);
  else notMet.push(`CBT: ${cbtCompleted}/${reqs.cbtTests}`);
  if (patientCount >= reqs.patientEntries) met.push(`Patient entries: ${patientCount}/${reqs.patientEntries}`);
  else notMet.push(`Patient entries: ${patientCount}/${reqs.patientEntries}`);
  if (dutiesCompleted >= reqs.duties) met.push(`Duties: ${dutiesCompleted}/${reqs.duties}`);
  else notMet.push(`Duties: ${dutiesCompleted}/${reqs.duties}`);
  if (loginDays >= reqs.loginDays) met.push(`Attendance: ${loginDays}/${reqs.loginDays}`);
  else notMet.push(`Attendance: ${loginDays}/${reqs.loginDays}`);
  if (overallScore >= reqs.overallScore) met.push(`Overall: ${Math.round(overallScore)}%`);
  else notMet.push(`Overall: ${Math.round(overallScore)}% (need ${reqs.overallScore}%)`);

  return {
    metrics: {
      cbtTestsCompleted: cbtCompleted,
      cbtAvgScore: Math.round(cbtAvgScore * 10) / 10,
      cbtBestScore: Math.round(parseFloat(cbt.best_score || 0) * 10) / 10,
      cbtWorstScore: Math.round(parseFloat(cbt.worst_score || 0) * 10) / 10,
      cmeTopicsCompleted: cmeCount,
      wardRoundsDocumented,
      prescriptionsWritten,
      labOrdersPlaced,
      patientEntries: patientCount,
      dutiesTotal: parseInt(dutiesTotal.cnt) || 0,
      dutiesCompleted,
      loginDays,
      assignedPatients: parseInt(assignedCount.cnt) || 0,
      overallScore: Math.round(overallScore * 10) / 10,
      // Score breakdown for transparency
      scoreBreakdown: {
        cbt: { score: Math.round(cbtAvgScore * 10) / 10, weight: 0.30, contribution: Math.round(cbtAvgScore * 0.30 * 10) / 10 },
        patientCare: { score: Math.round(patientScore * 10) / 10, weight: 0.35, contribution: Math.round(patientScore * 0.35 * 10) / 10 },
        duties: { score: Math.round(dutyScore * 10) / 10, weight: 0.25, contribution: Math.round(dutyScore * 0.25 * 10) / 10 },
        attendance: { score: Math.round(attendanceScore * 10) / 10, weight: 0.10, contribution: Math.round(attendanceScore * 0.10 * 10) / 10 },
      },
      rotationStart: rotationStart || null,
    },
    eligibility: {
      eligible: notMet.length === 0,
      met,
      notMet,
    },
    requirements: reqs,
  };
}
