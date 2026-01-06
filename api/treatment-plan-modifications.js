// Treatment Plan Modifications API - Approval Workflow
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
  const pathParts = url.pathname.replace('/api/treatment-plan-modifications', '').split('/').filter(Boolean);
  const modificationId = pathParts[0];
  const action = pathParts[1];

  try {
    switch (method) {
      case 'GET':
        if (modificationId) {
          return await getModification(modificationId, res);
        }
        return await getAllModifications(url.searchParams, auth.user, res);
      case 'POST':
        return await createModification(req.body, auth.user, res);
      case 'PUT':
      case 'PATCH':
        if (!modificationId) {
          return res.status(400).json({ error: 'Modification ID required' });
        }
        if (action === 'approve') {
          return await approveModification(modificationId, req.body, auth.user, res);
        }
        if (action === 'reject') {
          return await rejectModification(modificationId, req.body, auth.user, res);
        }
        return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Treatment Plan Modifications API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

// Check if user can approve modifications
function canApprove(role) {
  return ['admin', 'consultant'].includes(role);
}

// Check if user can request modifications
function canRequest(role) {
  return ['admin', 'consultant', 'senior_registrar', 'junior_registrar', 'house_officer'].includes(role);
}

async function getAllModifications(searchParams, user, res) {
  const status = searchParams.get('status') || 'pending';
  const planId = searchParams.get('planId');
  const patientId = searchParams.get('patientId');

  let queryStr = `
    SELECT tpm.*, 
           p.first_name, p.last_name, p.hospital_number,
           tp.diagnosis, tp.title as plan_title
    FROM treatment_plan_modifications tpm
    LEFT JOIN patients p ON tpm.patient_id = p.id
    LEFT JOIN treatment_plans tp ON tpm.plan_id = tp.id
    WHERE tpm.status = $1
  `;
  const params = [status];
  let paramCount = 2;

  if (planId) {
    queryStr += ` AND tpm.plan_id = $${paramCount}`;
    params.push(planId);
    paramCount++;
  }

  if (patientId) {
    queryStr += ` AND tpm.patient_id = $${paramCount}`;
    params.push(patientId);
    paramCount++;
  }

  // Order by priority (emergency first) and then by date
  queryStr += ` ORDER BY 
    CASE tpm.priority 
      WHEN 'emergency' THEN 1 
      WHEN 'urgent' THEN 2 
      ELSE 3 
    END,
    tpm.created_at ASC`;

  const result = await query(queryStr, params);

  res.status(200).json({ modifications: result.rows });
}

async function getModification(id, res) {
  const result = await query(
    `SELECT tpm.*, 
            p.first_name, p.last_name, p.hospital_number,
            tp.diagnosis, tp.title as plan_title
     FROM treatment_plan_modifications tpm
     LEFT JOIN patients p ON tpm.patient_id = p.id
     LEFT JOIN treatment_plans tp ON tpm.plan_id = tp.id
     WHERE tpm.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Modification not found' });
  }

  res.status(200).json({ modification: result.rows[0] });
}

async function createModification(data, user, res) {
  if (!canRequest(user.role)) {
    return res.status(403).json({ error: 'You do not have permission to request modifications' });
  }

  const {
    planId,
    patientId,
    patientName,
    source,
    wardRoundId,
    mdtSessionId,
    specialtyInput,
    modificationType,
    modificationAction,
    originalValue,
    proposedValue,
    reason,
    clinicalJustification,
    priority = 'routine'
  } = data;

  if (!planId || !modificationType || !modificationAction || !proposedValue || !reason) {
    return res.status(400).json({ 
      error: 'Required fields: planId, modificationType, modificationAction, proposedValue, reason' 
    });
  }

  // Consultants get auto-approved
  const status = canApprove(user.role) ? 'auto_approved' : 'pending';

  const result = await query(
    `INSERT INTO treatment_plan_modifications (
      plan_id, patient_id, patient_name,
      requested_by, requested_by_role, requested_at,
      source, ward_round_id, mdt_session_id, specialty_input,
      modification_type, modification_action,
      original_value, proposed_value,
      reason, clinical_justification,
      status, priority,
      reviewed_by, reviewed_by_role, reviewed_at
    ) VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
    RETURNING *`,
    [
      planId, patientId, patientName,
      user.full_name || user.username, user.role, 
      source || 'direct_edit', wardRoundId, mdtSessionId, specialtyInput,
      modificationType, modificationAction,
      JSON.stringify(originalValue), JSON.stringify(proposedValue),
      reason, clinicalJustification,
      status, priority,
      status === 'auto_approved' ? user.full_name || user.username : null,
      status === 'auto_approved' ? user.role : null,
      status === 'auto_approved' ? new Date() : null
    ]
  );

  const modification = result.rows[0];

  // If auto-approved (consultant), apply the modification immediately
  if (status === 'auto_approved') {
    await applyModificationToTreatmentPlan(planId, modificationType, modificationAction, proposedValue, originalValue);
  }

  res.status(201).json({ 
    modification,
    message: status === 'auto_approved' 
      ? 'Modification applied successfully' 
      : 'Modification submitted for consultant approval'
  });
}

async function approveModification(id, data, user, res) {
  if (!canApprove(user.role)) {
    return res.status(403).json({ error: 'Only consultants can approve modifications' });
  }

  const { comments } = data;

  // Get the modification
  const modResult = await query('SELECT * FROM treatment_plan_modifications WHERE id = $1', [id]);
  if (modResult.rows.length === 0) {
    return res.status(404).json({ error: 'Modification not found' });
  }

  const modification = modResult.rows[0];

  if (modification.status !== 'pending') {
    return res.status(400).json({ error: 'This modification has already been processed' });
  }

  // Apply the modification to the treatment plan
  await applyModificationToTreatmentPlan(
    modification.plan_id,
    modification.modification_type,
    modification.modification_action,
    JSON.parse(modification.proposed_value),
    modification.original_value ? JSON.parse(modification.original_value) : null
  );

  // Update modification status
  const result = await query(
    `UPDATE treatment_plan_modifications 
     SET status = 'approved',
         reviewed_by = $1,
         reviewed_by_role = $2,
         reviewed_at = NOW(),
         review_comments = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [user.full_name || user.username, user.role, comments, id]
  );

  res.status(200).json({ 
    modification: result.rows[0],
    message: 'Modification approved and applied to treatment plan'
  });
}

async function rejectModification(id, data, user, res) {
  if (!canApprove(user.role)) {
    return res.status(403).json({ error: 'Only consultants can reject modifications' });
  }

  const { comments } = data;

  if (!comments) {
    return res.status(400).json({ error: 'Comments are required when rejecting a modification' });
  }

  // Get the modification
  const modResult = await query('SELECT * FROM treatment_plan_modifications WHERE id = $1', [id]);
  if (modResult.rows.length === 0) {
    return res.status(404).json({ error: 'Modification not found' });
  }

  const modification = modResult.rows[0];

  if (modification.status !== 'pending') {
    return res.status(400).json({ error: 'This modification has already been processed' });
  }

  // Update modification status
  const result = await query(
    `UPDATE treatment_plan_modifications 
     SET status = 'rejected',
         reviewed_by = $1,
         reviewed_by_role = $2,
         reviewed_at = NOW(),
         review_comments = $3,
         updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [user.full_name || user.username, user.role, comments, id]
  );

  res.status(200).json({ 
    modification: result.rows[0],
    message: 'Modification rejected'
  });
}

// Apply modification to the actual treatment plan
async function applyModificationToTreatmentPlan(planId, modificationType, modificationAction, proposedValue, originalValue) {
  // Get current plan
  const planResult = await query('SELECT * FROM treatment_plans WHERE id = $1', [planId]);
  if (planResult.rows.length === 0) return;

  const plan = planResult.rows[0];
  const updates = {};

  switch (modificationType) {
    case 'medication':
      let meds = plan.medications ? JSON.parse(plan.medications) : [];
      if (modificationAction === 'add') {
        meds.push({ ...proposedValue, id: `med_${Date.now()}` });
      } else if (modificationAction === 'update' && originalValue?.id) {
        const idx = meds.findIndex(m => m.id === originalValue.id);
        if (idx !== -1) meds[idx] = { ...meds[idx], ...proposedValue };
      } else if (modificationAction === 'remove' && originalValue?.id) {
        meds = meds.filter(m => m.id !== originalValue.id);
      }
      updates.medications = JSON.stringify(meds);
      break;

    case 'investigation':
      let invs = plan.investigations ? JSON.parse(plan.investigations) : [];
      if (modificationAction === 'add') {
        invs.push({ ...proposedValue, id: `inv_${Date.now()}` });
      } else if (modificationAction === 'update' && originalValue?.id) {
        const idx = invs.findIndex(i => i.id === originalValue.id);
        if (idx !== -1) invs[idx] = { ...invs[idx], ...proposedValue };
      } else if (modificationAction === 'remove' && originalValue?.id) {
        invs = invs.filter(i => i.id !== originalValue.id);
      }
      updates.investigations = JSON.stringify(invs);
      break;

    case 'procedure':
      let procs = plan.procedures ? JSON.parse(plan.procedures) : [];
      if (modificationAction === 'add') {
        procs.push({ ...proposedValue, id: `proc_${Date.now()}` });
      } else if (modificationAction === 'update' && originalValue?.id) {
        const idx = procs.findIndex(p => p.id === originalValue.id);
        if (idx !== -1) procs[idx] = { ...procs[idx], ...proposedValue };
      } else if (modificationAction === 'remove' && originalValue?.id) {
        procs = procs.filter(p => p.id !== originalValue.id);
      }
      updates.procedures = JSON.stringify(procs);
      break;

    case 'diagnosis':
      updates.diagnosis = proposedValue;
      break;

    case 'discharge':
      updates.follow_up_schedule = JSON.stringify(proposedValue);
      break;

    case 'general':
      Object.assign(updates, proposedValue);
      break;
  }

  if (Object.keys(updates).length > 0) {
    const setClauses = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`).join(', ');
    const values = [...Object.values(updates), planId];
    
    await query(
      `UPDATE treatment_plans SET ${setClauses}, updated_at = NOW() WHERE id = $${values.length}`,
      values
    );
  }
}
