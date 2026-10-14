// Ward Rounds API endpoints
import { query } from './_lib/db.js';
import { ensureRecordStatus, markEnteredInError, notInError, reasonFrom, auditClinical } from './_lib/clinicalRecords.js';

import { cors, authenticateRequest } from './_lib/auth.js';
import { idempotent, rememberResponse } from './_lib/idempotency.js';
import { ensureMorningSnapshot, morningChecklist, morningCompliance } from './_lib/morningRounds.js';
import { currentUnitMembership } from './_lib/teamAssignment.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;

  // Verify authentication
  const authResult = authenticateRequest(req);
  if (!authResult.authenticated) {
    return res.status(401).json({ error: 'Unauthorized', message: authResult.error });
  }

  const { method } = req;
  const userId = authResult.user.id;
  const userRole = authResult.user.role;

  try {
    // Ensure required columns exist
    await ensureWardRoundColumns();
    switch (method) {
      case 'GET':
        return await handleGet(req, res, userId, userRole);
      case 'POST':
        if (await idempotent(req, res, authResult.user)) return;
        return await handlePost(req, res, userId, userRole, authResult.user);
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
    // ── House officers' morning round (07:00–09:00) ──
    // ?action=morning-checklist[&hoId=][&date=YYYY-MM-DD] — one HO's patients and status
    case 'morning-checklist': {
      const hoId = req.query.hoId || userId;
      if (String(hoId) !== String(userId) && !MORNING_VIEW_ROLES.includes(userRole)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(200).json(await morningChecklist(hoId, req.query.date || null));
    }
    // ?action=morning-compliance[&hoId=][&since=YYYY-MM-DD] — on-time + folder rate
    case 'morning-compliance': {
      const hoId = req.query.hoId || userId;
      if (String(hoId) !== String(userId) && !MORNING_VIEW_ROLES.includes(userRole)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(200).json(await morningCompliance(hoId, { since: req.query.since || null }));
    }
    // ?action=morning-units[&date=] — every unit's house officers and today's tally,
    // for the consultants and residents supervising them.
    case 'morning-units': {
      if (!MORNING_VIEW_ROLES.includes(userRole)) return res.status(403).json({ error: 'Access denied' });
      const membership = await currentUnitMembership();
      const units = membership ? membership.units : [];
      const hoIds = new Set(units.flatMap(u => u.house_officer_ids || []).map(String));
      // House officers with patients but outside any unit still need supervising.
      const assigned = (await query(
        `SELECT DISTINCT house_officer_id::text AS id FROM patient_assignments
          WHERE is_active = TRUE AND house_officer_id IS NOT NULL AND house_officer_id::text <> ''`
      )).rows.map(r => r.id);
      assigned.forEach(id => hoIds.add(id));
      const names = new Map((await query(
        `SELECT id::text AS id, full_name FROM users WHERE id::text = ANY($1::text[])`, [[...hoIds]]
      )).rows.map(r => [r.id, r.full_name]));
      const out = [];
      for (const id of hoIds) {
        const c = await morningChecklist(id, req.query.date || null);
        const unit = units.find(u => (u.house_officer_ids || []).map(String).includes(id));
        out.push({ ho_id: id, name: names.get(id) || `User ${id}`, unit_key: unit?.key || null, unit_name: unit?.name || null, window: c.window, summary: c.summary });
      }
      return res.status(200).json({ house_officers: out });
    }

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
         WHERE wr.patient_id = $1 AND ${notInError('wr')}
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
         WHERE wr.admission_id = $1 AND ${notInError('wr')}
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
         WHERE wr.round_date = $1::date AND ${notInError('wr')}
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
         WHERE wr.user_id = $1 AND ${notInError('wr')}
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
         WHERE wr.consultant_reviewed = false AND ${notInError('wr')}
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
         WHERE user_id = $1 AND ${notInError()} 
         AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      );
      return res.status(200).json({ statistics: statsResult.rows[0] });

    default:
      // Get recent ward rounds
      let listQuery = `
        SELECT wr.*, 
               COALESCE(p.full_name, p.first_name || ' ' || p.last_name) as patient_name, 
               p.hospital_number,
               COALESCE(u.full_name, u.username) as documented_by_name
        FROM ward_rounds wr
        LEFT JOIN patients p ON wr.patient_id = p.id
        LEFT JOIN users u ON wr.user_id = u.id
        WHERE ${notInError('wr')}
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

async function handlePost(req, res, userId, userRole, authUser) {
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
        nursingNotes,
        documentedAt,
        folderUpdated
      } = body;
      
      if (!patientId) {
        return res.status(400).json({ error: 'Patient ID required' });
      }
      
      const newRound = await query(
        `INSERT INTO ward_rounds 
         (patient_id, admission_id, user_id, round_date, round_type, findings,
          vital_signs, current_medications, new_orders, consultant_instructions,
          plan, issues, nursing_notes, documented_at, folder_updated)
         VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
          nursingNotes,
          // When the round was written, stamped by the app at save time — the
          // morning round is judged on this, not on when an offline round
          // reached the server. Never later than now, never more than two days
          // before it.
          clampDocumentedAt(documentedAt),
          folderUpdated === true
        ]
      );
      if (roundType === 'house_officers_round') {
        try { await ensureMorningSnapshot(); } catch (e) { console.warn('morning snapshot:', e.message); }
      }
      
      // Log activity
      await logActivity(userId, 'ward_round', `Documented ward round for patient`, { patientId, roundId: newRound.rows[0].id });
      
      {
        const responseBody = { wardRound: newRound.rows[0] };
        await auditClinical(authUser || { id: userId, role: userRole }, {
          action: 'create', entity: 'ward_rounds', entityId: newRound.rows[0].id, patientId,
          detail: { round_type: roundType },
        });
        await rememberResponse(req, authUser || { id: userId }, 201, responseBody);
        return res.status(201).json(responseBody);
      }

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
      
      {
        const responseBody = { wardRounds: createdRounds, count: createdRounds.length };
        for (const r of createdRounds) {
          await auditClinical(authUser || { id: userId, role: userRole }, {
            action: 'create', entity: 'ward_rounds', entityId: r.id, patientId: r.patient_id,
          });
        }
        await rememberResponse(req, authUser || { id: userId }, 201, responseBody);
        return res.status(201).json(responseBody);
      }

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
             folder_updated = COALESCE($9, folder_updated),
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
          roundId,
          typeof updateData.folderUpdated === 'boolean' ? updateData.folderUpdated : null
        ]
      );
      
      if (updateResult.rows[0]) {
        await auditClinical({ id: userId, role: userRole }, {
          action: 'update', entity: 'ward_rounds', entityId: roundId, patientId: updateResult.rows[0].patient_id,
          detail: { folderUpdated: typeof updateData.folderUpdated === 'boolean' ? updateData.folderUpdated : undefined },
        });
      }
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
  
  // Marked entered-in-error, not deleted: the record and who wrote it stay.
  await markEnteredInError('ward_rounds', roundId, { id: userId, role: userRole }, reasonFrom(req));

  return res.status(200).json({ success: true, message: 'Ward round marked as entered in error' });
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

let columnsEnsured = false;
async function ensureWardRoundColumns() {
  if (columnsEnsured) return;
  try {
    // Ensure the table exists first
    await query(`
      CREATE TABLE IF NOT EXISTS ward_rounds (
        id SERIAL PRIMARY KEY,
        patient_id VARCHAR(100),
        date DATE DEFAULT CURRENT_DATE,
        ward_name VARCHAR(255),
        consultant VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS round_date DATE DEFAULT CURRENT_DATE`).catch(() => {});
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS round_type VARCHAR(50) DEFAULT 'routine'`).catch(() => {});
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS consultant_reviewed BOOLEAN DEFAULT false`).catch(() => {});
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS user_id INTEGER`).catch(() => {});
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS admission_id INTEGER`).catch(() => {});
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS created_by INTEGER`).catch(() => {});
    await ensureRecordStatus('ward_rounds');
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS documented_at TIMESTAMPTZ`).catch(() => {});
    await query(`ALTER TABLE ward_rounds ADD COLUMN IF NOT EXISTS folder_updated BOOLEAN DEFAULT FALSE`).catch(() => {});
    columnsEnsured = true;
  } catch (e) {
    console.error('ensureWardRoundColumns error:', e.message);
  }
}

// Who may see another house officer's morning round.
const MORNING_VIEW_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar', 'registrar', 'junior_registrar'];

function clampDocumentedAt(v) {
  const now = Date.now();
  const t = v ? new Date(v).getTime() : NaN;
  if (!Number.isFinite(t) || t > now + 5 * 60000 || t < now - 2 * 86400000) return new Date(now);
  return new Date(t);
}
