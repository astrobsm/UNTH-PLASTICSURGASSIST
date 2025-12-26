// Ward Rounds API endpoints
import { query } from './_lib/db.js';
import { cors, verifyToken } from './_lib/auth.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Verify authentication
  const authResult = await verifyToken(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const { method } = req;
  const userId = authResult.user.id;
  const userRole = authResult.user.role;

  try {
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId, userRole);
      case 'POST':
        return await handlePost(req, res, userId, userRole);
      case 'PUT':
        return await handlePut(req, res, userId, userRole);
      case 'DELETE':
        return await handleDelete(req, res, userId, userRole);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ error: `Method ${method} not allowed` });
    }
  } catch (error) {
    console.error('Ward Rounds API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, roundId, patientId, admissionId, date, startDate, endDate } = req.query;

  switch (action) {
    case 'detail':
      if (!roundId) {
        return res.status(400).json({ error: 'Round ID required' });
      }
      const detailResult = await query(
        `SELECT wr.*, p.full_name as patient_name, p.hospital_number,
                u.full_name as documented_by_name
         FROM ward_rounds wr
         LEFT JOIN patients p ON wr.patient_id = p.id
         LEFT JOIN users u ON wr.user_id = u.id
         WHERE wr.id = $1`,
        [roundId]
      );
      if (detailResult.rows.length === 0) {
        return res.status(404).json({ error: 'Ward round not found' });
      }
      return res.status(200).json({ wardRound: detailResult.rows[0] });

    case 'by-patient':
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }
      const patientRounds = await query(
        `SELECT wr.*, u.full_name as documented_by_name
         FROM ward_rounds wr
         LEFT JOIN users u ON wr.user_id = u.id
         WHERE wr.patient_id = $1
         ORDER BY wr.round_date DESC, wr.created_at DESC`,
        [patientId]
      );
      return res.status(200).json({ wardRounds: patientRounds.rows });

    case 'by-admission':
      if (!admissionId) {
        return res.status(400).json({ error: 'Admission ID required' });
      }
      const admissionRounds = await query(
        `SELECT wr.*, p.full_name as patient_name, u.full_name as documented_by_name
         FROM ward_rounds wr
         LEFT JOIN patients p ON wr.patient_id = p.id
         LEFT JOIN users u ON wr.user_id = u.id
         WHERE wr.admission_id = $1
         ORDER BY wr.round_date DESC, wr.created_at DESC`,
        [admissionId]
      );
      return res.status(200).json({ wardRounds: admissionRounds.rows });

    case 'by-date':
      const targetDate = date || new Date().toISOString().split('T')[0];
      const dateRounds = await query(
        `SELECT wr.*, p.full_name as patient_name, p.hospital_number, p.ward,
                u.full_name as documented_by_name
         FROM ward_rounds wr
         LEFT JOIN patients p ON wr.patient_id = p.id
         LEFT JOIN users u ON wr.user_id = u.id
         WHERE wr.round_date = $1::date
         ORDER BY p.ward, p.bed_number, wr.created_at`,
        [targetDate]
      );
      return res.status(200).json({ wardRounds: dateRounds.rows, date: targetDate });

    case 'my-rounds':
      // Get rounds documented by current user
      const myRoundsResult = await query(
        `SELECT wr.*, p.full_name as patient_name, p.hospital_number
         FROM ward_rounds wr
         LEFT JOIN patients p ON wr.patient_id = p.id
         WHERE wr.user_id = $1
         ORDER BY wr.round_date DESC, wr.created_at DESC
         LIMIT 50`,
        [userId]
      );
      return res.status(200).json({ wardRounds: myRoundsResult.rows });

    case 'pending-review':
      // Get rounds pending consultant review
      const pendingResult = await query(
        `SELECT wr.*, p.full_name as patient_name, p.hospital_number, p.ward,
                u.full_name as documented_by_name
         FROM ward_rounds wr
         LEFT JOIN patients p ON wr.patient_id = p.id
         LEFT JOIN users u ON wr.user_id = u.id
         WHERE wr.consultant_reviewed = false
         ORDER BY wr.round_date DESC, wr.created_at DESC`
      );
      return res.status(200).json({ wardRounds: pendingResult.rows });

    case 'statistics':
      // Get ward round statistics for user
      const statsResult = await query(
        `SELECT 
           COUNT(*) as total_rounds,
           COUNT(DISTINCT patient_id) as unique_patients,
           COUNT(DISTINCT round_date) as days_with_rounds,
           COUNT(*) FILTER (WHERE consultant_reviewed = true) as reviewed_rounds
         FROM ward_rounds 
         WHERE user_id = $1 
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );
      return res.status(200).json({ statistics: statsResult.rows[0] });

    default:
      // Get recent ward rounds
      let listQuery = `
        SELECT wr.*, p.full_name as patient_name, p.hospital_number, p.ward,
               u.full_name as documented_by_name
        FROM ward_rounds wr
        LEFT JOIN patients p ON wr.patient_id = p.id
        LEFT JOIN users u ON wr.user_id = u.id
        WHERE 1=1
      `;
      const listParams = [];
      
      if (startDate) {
        listParams.push(startDate);
        listQuery += ` AND wr.round_date >= $${listParams.length}::date`;
      }
      if (endDate) {
        listParams.push(endDate);
        listQuery += ` AND wr.round_date <= $${listParams.length}::date`;
      }
      
      listQuery += ` ORDER BY wr.round_date DESC, wr.created_at DESC LIMIT 100`;
      
      const listResult = await query(listQuery, listParams);
      return res.status(200).json({ wardRounds: listResult.rows });
  }
}

async function handlePost(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'create':
      const {
        patientId,
        admissionId,
        roundDate,
        roundType = 'routine',
        findings,
        vitalSigns,
        currentMedications,
        newOrders,
        consultantInstructions,
        plan,
        issues,
        nursingNotes
      } = body;
      
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }
      
      const newRound = await query(
        `INSERT INTO ward_rounds 
         (patient_id, admission_id, user_id, round_date, round_type, findings,
          vital_signs, current_medications, new_orders, consultant_instructions,
          plan, issues, nursing_notes)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          patientId, admissionId, userId, 
          roundDate || new Date().toISOString().split('T')[0],
          roundType, findings,
          JSON.stringify(vitalSigns || {}),
          JSON.stringify(currentMedications || []),
          JSON.stringify(newOrders || []),
          consultantInstructions,
          plan, 
          JSON.stringify(issues || []),
          nursingNotes
        ]
      );
      
      // Log activity
      await logActivity(userId, 'ward_round', `Documented ward round for patient`, { patientId, roundId: newRound.rows[0].id });
      
      return res.status(201).json({ wardRound: newRound.rows[0] });

    case 'bulk-create':
      // Create multiple ward rounds at once
      const { rounds } = body;
      
      if (!Array.isArray(rounds)) {
        return res.status(400).json({ error: 'Rounds must be an array' });
      }
      
      const createdRounds = [];
      for (const round of rounds) {
        const result = await query(
          `INSERT INTO ward_rounds 
           (patient_id, admission_id, user_id, round_date, round_type, findings,
            vital_signs, plan)
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)
           RETURNING *`,
          [
            round.patientId, round.admissionId, userId,
            round.roundDate || new Date().toISOString().split('T')[0],
            round.roundType || 'routine', round.findings,
            JSON.stringify(round.vitalSigns || {}),
            round.plan
          ]
        );
        createdRounds.push(result.rows[0]);
      }
      
      // Log activity
      await logActivity(userId, 'ward_round', `Documented ${createdRounds.length} ward rounds`);
      
      return res.status(201).json({ wardRounds: createdRounds, count: createdRounds.length });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'update':
      const { roundId, ...updateData } = body;
      
      if (!roundId) {
        return res.status(400).json({ error: 'Round ID required' });
      }
      
      // Check ownership
      const ownerCheck = await query(
        `SELECT user_id FROM ward_rounds WHERE id = $1`,
        [roundId]
      );
      
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Ward round not found' });
      }
      
      const canEdit = ownerCheck.rows[0].user_id === userId ||
                      userRole === 'consultant' ||
                      userRole === 'super_admin';
      
      if (!canEdit) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const updateResult = await query(
        `UPDATE ward_rounds 
         SET findings = COALESCE($1, findings),
             vital_signs = COALESCE($2, vital_signs),
             plan = COALESCE($3, plan),
             issues = COALESCE($4, issues),
             consultant_instructions = COALESCE($5, consultant_instructions),
             new_orders = COALESCE($6, new_orders),
             nursing_notes = COALESCE($7, nursing_notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING *`,
        [
          updateData.findings,
          updateData.vitalSigns ? JSON.stringify(updateData.vitalSigns) : null,
          updateData.plan,
          updateData.issues ? JSON.stringify(updateData.issues) : null,
          updateData.consultantInstructions,
          updateData.newOrders ? JSON.stringify(updateData.newOrders) : null,
          updateData.nursingNotes,
          roundId
        ]
      );
      
      return res.status(200).json({ wardRound: updateResult.rows[0] });

    case 'consultant-review':
      // Mark as reviewed by consultant
      if (userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only consultants can review ward rounds' });
      }
      
      const { roundId: reviewRoundId, feedback, approved } = body;
      
      await query(
        `UPDATE ward_rounds 
         SET consultant_reviewed = true,
             consultant_reviewed_by = $1,
             consultant_reviewed_at = CURRENT_TIMESTAMP,
             consultant_feedback = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [userId, feedback, reviewRoundId]
      );
      
      return res.status(200).json({ success: true, message: 'Ward round reviewed' });

    case 'add-addendum':
      // Add addendum to ward round
      const { roundId: addendumRoundId, addendum } = body;
      
      await query(
        `UPDATE ward_rounds 
         SET addendum = COALESCE(addendum, '') || E'\n\n[' || $1 || ' - ' || NOW()::text || ']\n' || $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [userRole, addendum, addendumRoundId]
      );
      
      return res.status(200).json({ success: true });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handleDelete(req, res, userId, userRole) {
  const { roundId } = req.query;
  
  if (!roundId) {
    return res.status(400).json({ error: 'Round ID required' });
  }
  
  // Check ownership
  const ownerCheck = await query(
    `SELECT user_id, created_at FROM ward_rounds WHERE id = $1`,
    [roundId]
  );
  
  if (ownerCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Ward round not found' });
  }
  
  // Only allow deletion within 24 hours by owner, or by super_admin
  const createdAt = new Date(ownerCheck.rows[0].created_at);
  const hoursSinceCreation = (Date.now() - createdAt) / (1000 * 60 * 60);
  
  const canDelete = 
    (ownerCheck.rows[0].user_id === userId && hoursSinceCreation < 24) ||
    userRole === 'super_admin';
  
  if (!canDelete) {
    return res.status(403).json({ error: 'Ward rounds can only be deleted within 24 hours of creation' });
  }
  
  await query(`DELETE FROM ward_rounds WHERE id = $1`, [roundId]);
  
  return res.status(200).json({ success: true, message: 'Ward round deleted' });
}

async function logActivity(userId, activityType, description, metadata = {}) {
  const points = {
    'ward_round': 10
  };
  
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, activityType, description, points[activityType] || 0, JSON.stringify(metadata)]
  );
}
