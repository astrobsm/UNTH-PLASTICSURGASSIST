// Discharge Summaries API endpoints
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
    console.error('Discharge Summaries API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function handleGet(req, res, userId, userRole) {
  const { action, summaryId, patientId, admissionId, startDate, endDate, status } = req.query;

  switch (action) {
    case 'detail':
      if (!summaryId) {
        return res.status(400).json({ error: 'Summary ID required' });
      }
      const detailResult = await query(
        `SELECT ds.*, p.full_name as patient_name, p.hospital_number,
                p.date_of_birth, p.phone, p.address,
                u.full_name as prepared_by_name,
                approver.full_name as approved_by_name
         FROM discharge_summaries ds
         LEFT JOIN patients p ON ds.patient_id = p.id
         LEFT JOIN users u ON ds.prepared_by = u.id
         LEFT JOIN users approver ON ds.approved_by = approver.id
         WHERE ds.id = $1`,
        [summaryId]
      );
      if (detailResult.rows.length === 0) {
        return res.status(404).json({ error: 'Discharge summary not found' });
      }
      return res.status(200).json({ summary: detailResult.rows[0] });

    case 'by-patient':
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }
      const patientSummaries = await query(
        `SELECT ds.*, u.full_name as prepared_by_name
         FROM discharge_summaries ds
         LEFT JOIN users u ON ds.prepared_by = u.id
         WHERE ds.patient_id = $1
         ORDER BY ds.discharge_date DESC`,
        [patientId]
      );
      return res.status(200).json({ summaries: patientSummaries.rows });

    case 'by-admission':
      if (!admissionId) {
        return res.status(400).json({ error: 'Admission ID required' });
      }
      const admissionSummary = await query(
        `SELECT ds.*, p.full_name as patient_name, p.hospital_number,
                u.full_name as prepared_by_name
         FROM discharge_summaries ds
         LEFT JOIN patients p ON ds.patient_id = p.id
         LEFT JOIN users u ON ds.prepared_by = u.id
         WHERE ds.admission_id = $1`,
        [admissionId]
      );
      return res.status(200).json({ summary: admissionSummary.rows[0] || null });

    case 'pending-approval':
      // Get summaries pending consultant approval
      const pendingResult = await query(
        `SELECT ds.*, p.full_name as patient_name, p.hospital_number,
                u.full_name as prepared_by_name
         FROM discharge_summaries ds
         LEFT JOIN patients p ON ds.patient_id = p.id
         LEFT JOIN users u ON ds.prepared_by = u.id
         WHERE ds.status = 'pending_approval'
         ORDER BY ds.discharge_date DESC`
      );
      return res.status(200).json({ summaries: pendingResult.rows });

    case 'my-summaries':
      // Get summaries prepared by current user
      const myResult = await query(
        `SELECT ds.*, p.full_name as patient_name, p.hospital_number
         FROM discharge_summaries ds
         LEFT JOIN patients p ON ds.patient_id = p.id
         WHERE ds.prepared_by = $1
         ORDER BY ds.created_at DESC
         LIMIT 50`,
        [userId]
      );
      return res.status(200).json({ summaries: myResult.rows });

    case 'statistics':
      // Get discharge summary statistics
      const statsResult = await query(
        `SELECT 
           COUNT(*) as total_summaries,
           COUNT(*) FILTER (WHERE status = 'approved') as approved,
           COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
           COUNT(*) FILTER (WHERE status = 'draft') as drafts,
           COUNT(DISTINCT patient_id) as unique_patients
         FROM discharge_summaries 
         WHERE prepared_by = $1 
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );
      return res.status(200).json({ statistics: statsResult.rows[0] });

    case 'recent':
    default:
      // Get recent discharge summaries
      let listQuery = `
        SELECT ds.*, p.full_name as patient_name, p.hospital_number,
               u.full_name as prepared_by_name
        FROM discharge_summaries ds
        LEFT JOIN patients p ON ds.patient_id = p.id
        LEFT JOIN users u ON ds.prepared_by = u.id
        WHERE 1=1
      `;
      const listParams = [];
      
      if (status) {
        listParams.push(status);
        listQuery += ` AND ds.status = $${listParams.length}`;
      }
      if (startDate) {
        listParams.push(startDate);
        listQuery += ` AND ds.discharge_date >= $${listParams.length}::date`;
      }
      if (endDate) {
        listParams.push(endDate);
        listQuery += ` AND ds.discharge_date <= $${listParams.length}::date`;
      }
      
      listQuery += ` ORDER BY ds.discharge_date DESC, ds.created_at DESC LIMIT 100`;
      
      const listResult = await query(listQuery, listParams);
      return res.status(200).json({ summaries: listResult.rows });
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
        dischargeDate,
        primaryDiagnosis,
        secondaryDiagnoses,
        admissionDate,
        hospitalCourse,
        procedures,
        investigations,
        dischargeMedications,
        followUpInstructions,
        followUpDate,
        followUpClinic,
        dietaryAdvice,
        activityRestrictions,
        woundCareInstructions,
        warningSymptoms,
        emergencyContact,
        referrals,
        conditionOnDischarge,
        dischargeType,
        notes,
        status: summaryStatus = 'draft'
      } = body;
      
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }
      
      // Check if summary already exists for this admission
      if (admissionId) {
        const existingCheck = await query(
          `SELECT id FROM discharge_summaries WHERE admission_id = $1`,
          [admissionId]
        );
        if (existingCheck.rows.length > 0) {
          return res.status(400).json({ 
            error: 'Discharge summary already exists for this admission',
            existingSummaryId: existingCheck.rows[0].id
          });
        }
      }
      
      const newSummary = await query(
        `INSERT INTO discharge_summaries 
         (patient_id, admission_id, prepared_by, discharge_date, admission_date,
          primary_diagnosis, secondary_diagnoses, hospital_course, procedures,
          investigations, discharge_medications, follow_up_instructions,
          follow_up_date, follow_up_clinic, dietary_advice, activity_restrictions,
          wound_care_instructions, warning_symptoms, emergency_contact,
          referrals, condition_on_discharge, discharge_type, notes, status)
         VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12,
                 $13::date, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
         RETURNING *`,
        [
          patientId, admissionId, userId,
          dischargeDate || new Date().toISOString().split('T')[0],
          admissionDate, primaryDiagnosis,
          JSON.stringify(secondaryDiagnoses || []),
          hospitalCourse,
          JSON.stringify(procedures || []),
          JSON.stringify(investigations || []),
          JSON.stringify(dischargeMedications || []),
          followUpInstructions, followUpDate, followUpClinic,
          dietaryAdvice, activityRestrictions, woundCareInstructions,
          JSON.stringify(warningSymptoms || []),
          emergencyContact,
          JSON.stringify(referrals || []),
          conditionOnDischarge, dischargeType || 'routine', notes,
          summaryStatus
        ]
      );
      
      // Log activity
      await logActivity(userId, 'discharge_summary', `Created discharge summary for patient`, { 
        patientId, 
        summaryId: newSummary.rows[0].id 
      });
      
      return res.status(201).json({ summary: newSummary.rows[0] });

    case 'submit-for-approval':
      const { summaryId } = body;
      
      // Verify ownership
      const ownerCheck = await query(
        `SELECT prepared_by FROM discharge_summaries WHERE id = $1`,
        [summaryId]
      );
      
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Summary not found' });
      }
      
      if (ownerCheck.rows[0].prepared_by !== userId && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only the preparer can submit for approval' });
      }
      
      await query(
        `UPDATE discharge_summaries 
         SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [summaryId]
      );
      
      return res.status(200).json({ success: true, message: 'Submitted for approval' });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handlePut(req, res, userId, userRole) {
  const { action } = req.query;
  const body = req.body;

  switch (action) {
    case 'update':
      const { summaryId, ...updateData } = body;
      
      if (!summaryId) {
        return res.status(400).json({ error: 'Summary ID required' });
      }
      
      // Check ownership and status
      const summaryCheck = await query(
        `SELECT prepared_by, status FROM discharge_summaries WHERE id = $1`,
        [summaryId]
      );
      
      if (summaryCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Summary not found' });
      }
      
      const canEdit = summaryCheck.rows[0].prepared_by === userId ||
                      userRole === 'consultant' ||
                      userRole === 'super_admin';
      
      if (!canEdit) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Don't allow editing approved summaries (except by super_admin)
      if (summaryCheck.rows[0].status === 'approved' && userRole !== 'super_admin') {
        return res.status(400).json({ error: 'Cannot edit approved summaries' });
      }
      
      const updateResult = await query(
        `UPDATE discharge_summaries 
         SET primary_diagnosis = COALESCE($1, primary_diagnosis),
             secondary_diagnoses = COALESCE($2, secondary_diagnoses),
             hospital_course = COALESCE($3, hospital_course),
             procedures = COALESCE($4, procedures),
             discharge_medications = COALESCE($5, discharge_medications),
             follow_up_instructions = COALESCE($6, follow_up_instructions),
             follow_up_date = COALESCE($7, follow_up_date),
             dietary_advice = COALESCE($8, dietary_advice),
             activity_restrictions = COALESCE($9, activity_restrictions),
             wound_care_instructions = COALESCE($10, wound_care_instructions),
             warning_symptoms = COALESCE($11, warning_symptoms),
             condition_on_discharge = COALESCE($12, condition_on_discharge),
             notes = COALESCE($13, notes),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $14
         RETURNING *`,
        [
          updateData.primaryDiagnosis,
          updateData.secondaryDiagnoses ? JSON.stringify(updateData.secondaryDiagnoses) : null,
          updateData.hospitalCourse,
          updateData.procedures ? JSON.stringify(updateData.procedures) : null,
          updateData.dischargeMedications ? JSON.stringify(updateData.dischargeMedications) : null,
          updateData.followUpInstructions,
          updateData.followUpDate,
          updateData.dietaryAdvice,
          updateData.activityRestrictions,
          updateData.woundCareInstructions,
          updateData.warningSymptoms ? JSON.stringify(updateData.warningSymptoms) : null,
          updateData.conditionOnDischarge,
          updateData.notes,
          summaryId
        ]
      );
      
      return res.status(200).json({ summary: updateResult.rows[0] });

    case 'approve':
      // Approve discharge summary (consultants only)
      if (userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only consultants can approve discharge summaries' });
      }
      
      const { summaryId: approvalSummaryId, feedback, amendments } = body;
      
      await query(
        `UPDATE discharge_summaries 
         SET status = 'approved',
             approved_by = $1,
             approved_at = CURRENT_TIMESTAMP,
             approval_feedback = $2,
             amendments = COALESCE(amendments, '[]'::jsonb) || $3::jsonb,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [userId, feedback, JSON.stringify(amendments || []), approvalSummaryId]
      );
      
      // Update the admission status if linked
      await query(
        `UPDATE admissions SET status = 'discharged', discharge_date = CURRENT_TIMESTAMP
         WHERE id = (SELECT admission_id FROM discharge_summaries WHERE id = $1)`,
        [approvalSummaryId]
      );
      
      return res.status(200).json({ success: true, message: 'Discharge summary approved' });

    case 'reject':
      // Reject/request changes (consultants only)
      if (userRole !== 'consultant' && userRole !== 'super_admin') {
        return res.status(403).json({ error: 'Only consultants can reject discharge summaries' });
      }
      
      const { summaryId: rejectSummaryId, reason, requiredChanges } = body;
      
      await query(
        `UPDATE discharge_summaries 
         SET status = 'draft',
             approval_feedback = $1,
             required_changes = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [reason, JSON.stringify(requiredChanges || []), rejectSummaryId]
      );
      
      return res.status(200).json({ success: true, message: 'Changes requested' });

    case 'finalize':
      // Mark as final and print-ready
      const { summaryId: finalizeSummaryId } = body;
      
      const finalizeCheck = await query(
        `SELECT status FROM discharge_summaries WHERE id = $1`,
        [finalizeSummaryId]
      );
      
      if (finalizeCheck.rows[0]?.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved summaries can be finalized' });
      }
      
      await query(
        `UPDATE discharge_summaries 
         SET status = 'finalized', 
             finalized_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [finalizeSummaryId]
      );
      
      return res.status(200).json({ success: true, message: 'Summary finalized' });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

async function handleDelete(req, res, userId, userRole) {
  const { summaryId } = req.query;
  
  if (!summaryId) {
    return res.status(400).json({ error: 'Summary ID required' });
  }
  
  // Check ownership and status
  const summaryCheck = await query(
    `SELECT prepared_by, status FROM discharge_summaries WHERE id = $1`,
    [summaryId]
  );
  
  if (summaryCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Summary not found' });
  }
  
  // Only allow deletion of drafts by owner or super_admin
  const canDelete = 
    (summaryCheck.rows[0].prepared_by === userId && summaryCheck.rows[0].status === 'draft') ||
    userRole === 'super_admin';
  
  if (!canDelete) {
    return res.status(403).json({ error: 'Only draft summaries can be deleted' });
  }
  
  await query(`DELETE FROM discharge_summaries WHERE id = $1`, [summaryId]);
  
  return res.status(200).json({ success: true, message: 'Discharge summary deleted' });
}

async function logActivity(userId, activityType, description, metadata = {}) {
  const points = {
    'discharge_summary': 15
  };
  
  await query(
    `INSERT INTO activity_logs (user_id, activity_type, description, points, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, activityType, description, points[activityType] || 0, JSON.stringify(metadata)]
  );
}
