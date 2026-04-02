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
          ...(await getHOFullMetrics(ho.id)),
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
      const metrics = await getHOFullMetrics(ho.id);

      // Documentation logs — ward rounds by this HO
      const wardRounds = await query(`
        SELECT wr.id, wr.patient_id, wr.round_date, wr.round_type, wr.clinical_notes,
               wr.progress_status, wr.treatment_plan_updated, wr.medications_changed,
               wr.wound_assessment_done, wr.created_at,
               p.first_name, p.last_name, p.hospital_number
        FROM ward_rounds wr
        LEFT JOIN patients p ON wr.patient_id::text = p.id::text
        WHERE wr.created_by = $1 OR wr.reviewing_doctor ILIKE $2
        ORDER BY wr.created_at DESC LIMIT 50
      `, [targetId, `%${ho.full_name}%`]);

      // Prescriptions written
      const prescriptions = await query(`
        SELECT pr.id, pr.patient_id, pr.medication_name, pr.dosage, pr.created_at,
               p.first_name, p.last_name, p.hospital_number
        FROM prescriptions pr
        LEFT JOIN patients p ON pr.patient_id::text = p.id::text
        WHERE pr.created_by = $1
        ORDER BY pr.created_at DESC LIMIT 50
      `, [targetId]);

      // Lab orders placed
      const labOrders = await query(`
        SELECT lo.id, lo.patient_id, lo.test_name, lo.urgency, lo.status, lo.created_at,
               p.first_name, p.last_name, p.hospital_number
        FROM lab_orders lo
        LEFT JOIN patients p ON lo.patient_id::text = p.id::text
        WHERE lo.ordered_by = $1 OR lo.created_by = $1
        ORDER BY lo.created_at DESC LIMIT 50
      `, [targetId]);

      // Progress notes / activity logs
      const activityLogs = await query(`
        SELECT * FROM activity_logs
        WHERE user_id = $1
        ORDER BY created_at DESC LIMIT 100
      `, [targetId]);

      // CBT attempts
      const cbtAttempts = await query(`
        SELECT * FROM cbt_attempts
        WHERE user_id = $1 AND completed = true
        ORDER BY created_at DESC
      `, [targetId]);

      // Training/CME progress
      const cmeProgress = await query(`
        SELECT * FROM training_progress
        WHERE user_id = $1
        ORDER BY completed_at DESC
      `, [targetId]);

      // Assigned patients
      const assignedPatients = await query(`
        SELECT pa.*, p.first_name, p.last_name, p.hospital_number,
               a.ward_location, a.bed_number, a.status as admission_status
        FROM patient_assignments pa
        LEFT JOIN patients p ON pa.patient_id = p.id
        LEFT JOIN admissions a ON a.patient_id = pa.patient_id AND a.status = 'active'
        WHERE pa.house_officer_id = $1 AND pa.is_active = true
        ORDER BY pa.assigned_at DESC
      `, [targetId]);

      // Rotation
      const rotation = await query(`
        SELECT * FROM trainee_rotations
        WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')
        ORDER BY created_at DESC LIMIT 1
      `, [targetId]);

      return res.status(200).json({
        houseOfficer: { ...ho, ...metrics },
        wardRounds: wardRounds.rows,
        prescriptions: prescriptions.rows,
        labOrders: labOrders.rows,
        activityLogs: activityLogs.rows,
        cbtAttempts: cbtAttempts.rows,
        cmeProgress: cmeProgress.rows,
        assignedPatients: assignedPatients.rows,
        rotation: rotation.rows[0] || null,
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
           WHERE (created_by = $1 OR reviewing_doctor ILIKE $2)
             AND created_at BETWEEN $3 AND $4`,
          [ho.id, `%${ho.full_name}%`, fromDate, toDate]
        );
        const rx = await query(
          `SELECT COUNT(*) as cnt FROM prescriptions WHERE created_by = $1 AND created_at BETWEEN $2 AND $3`,
          [ho.id, fromDate, toDate]
        );
        const labs = await query(
          `SELECT COUNT(*) as cnt FROM lab_orders WHERE (ordered_by = $1 OR created_by = $1) AND created_at BETWEEN $2 AND $3`,
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

async function getHOFullMetrics(userId) {
  // CBT metrics
  const cbt = await query(
    `SELECT COUNT(*) as completed, COALESCE(AVG(percentage), 0) as avg_score,
            MAX(percentage) as best_score, MIN(percentage) as worst_score
     FROM cbt_attempts WHERE user_id = $1 AND completed = true`, [userId]
  );

  // CME / training progress
  const cme = await query(`SELECT COUNT(*) as cnt FROM training_progress WHERE user_id = $1`, [userId]);

  // Documentation counts
  const wardRoundCount = await query(
    `SELECT COUNT(*) as cnt FROM ward_rounds WHERE created_by = $1`, [userId]
  );
  const prescriptionCount = await query(
    `SELECT COUNT(*) as cnt FROM prescriptions WHERE created_by = $1`, [userId]
  );
  const labOrderCount = await query(
    `SELECT COUNT(*) as cnt FROM lab_orders WHERE ordered_by = $1 OR created_by = $1`, [userId]
  );
  const patientEntries = await query(
    `SELECT COUNT(*) as cnt FROM activity_logs WHERE user_id = $1 AND activity_type = 'patient_entry'`, [userId]
  );

  // Duties
  const duties = await query(
    `SELECT COUNT(*) as total,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
     FROM duty_assignments WHERE user_id = $1`, [userId]
  );

  // Attendance (login days)
  const logins = await query(
    `SELECT COUNT(DISTINCT DATE(created_at)) as days FROM activity_logs WHERE user_id = $1 AND activity_type = 'login'`, [userId]
  );

  // Assigned patients count
  const assignedCount = await query(
    `SELECT COUNT(*) as cnt FROM patient_assignments WHERE house_officer_id = $1 AND is_active = true`, [userId]
  );

  // Overall score
  const reqs = { cbtTests: 4, patientEntries: 30, duties: 20, loginDays: 25, overallScore: 70 };
  const cbtScore = parseFloat(cbt.rows[0].avg_score) || 0;
  const patientScore = Math.min(100, (parseInt(patientEntries.rows[0].cnt) / reqs.patientEntries) * 100);
  const dutyScore = Math.min(100, (parseInt(duties.rows[0].completed) / reqs.duties) * 100);
  const attendanceScore = Math.min(100, (parseInt(logins.rows[0].days) / reqs.loginDays) * 100);
  const overallScore = (cbtScore * 0.30) + (patientScore * 0.35) + (dutyScore * 0.25) + (attendanceScore * 0.10);

  // Eligibility
  const met = [];
  const notMet = [];
  if (parseInt(cbt.rows[0].completed) >= reqs.cbtTests) met.push(`CBT: ${cbt.rows[0].completed}/${reqs.cbtTests}`);
  else notMet.push(`CBT: ${cbt.rows[0].completed}/${reqs.cbtTests}`);
  if (parseInt(patientEntries.rows[0].cnt) >= reqs.patientEntries) met.push(`Patient entries: ${patientEntries.rows[0].cnt}/${reqs.patientEntries}`);
  else notMet.push(`Patient entries: ${patientEntries.rows[0].cnt}/${reqs.patientEntries}`);
  if (parseInt(duties.rows[0].completed) >= reqs.duties) met.push(`Duties: ${duties.rows[0].completed}/${reqs.duties}`);
  else notMet.push(`Duties: ${duties.rows[0].completed}/${reqs.duties}`);
  if (parseInt(logins.rows[0].days) >= reqs.loginDays) met.push(`Attendance: ${logins.rows[0].days}/${reqs.loginDays}`);
  else notMet.push(`Attendance: ${logins.rows[0].days}/${reqs.loginDays}`);
  if (overallScore >= reqs.overallScore) met.push(`Overall: ${Math.round(overallScore)}%`);
  else notMet.push(`Overall: ${Math.round(overallScore)}% (need ${reqs.overallScore}%)`);

  return {
    metrics: {
      cbtTestsCompleted: parseInt(cbt.rows[0].completed),
      cbtAvgScore: Math.round(parseFloat(cbt.rows[0].avg_score) * 10) / 10,
      cbtBestScore: Math.round(parseFloat(cbt.rows[0].best_score || 0) * 10) / 10,
      cbtWorstScore: Math.round(parseFloat(cbt.rows[0].worst_score || 0) * 10) / 10,
      cmeTopicsCompleted: parseInt(cme.rows[0].cnt),
      wardRoundsDocumented: parseInt(wardRoundCount.rows[0].cnt),
      prescriptionsWritten: parseInt(prescriptionCount.rows[0].cnt),
      labOrdersPlaced: parseInt(labOrderCount.rows[0].cnt),
      patientEntries: parseInt(patientEntries.rows[0].cnt),
      dutiesTotal: parseInt(duties.rows[0].total),
      dutiesCompleted: parseInt(duties.rows[0].completed),
      loginDays: parseInt(logins.rows[0].days),
      assignedPatients: parseInt(assignedCount.rows[0].cnt),
      overallScore: Math.round(overallScore * 10) / 10,
    },
    eligibility: {
      eligible: notMet.length === 0,
      met,
      notMet,
    },
    requirements: reqs,
  };
}
