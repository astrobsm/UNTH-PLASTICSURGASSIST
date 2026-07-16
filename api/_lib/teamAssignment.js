// ============================================================================
// Server-side team assignment & auto-admit (shared).
//
// - autoAdmitFromConsult(consult, user): find-or-create the patient, ensure an
//   active admission, and evenly assign a full plastic-surgery team
//   (consultant + senior registrar + registrar + house officer).
// - reassignDeactivatedUser(userId): when a staff member is deactivated,
//   move their patients to the least-loaded remaining active staff of that
//   role (leaving the slot empty if no replacement exists).
//
// "Evenly" = each new assignment picks the least-loaded active+approved staff
// for the role, which balances load over time. All writes go to Postgres
// (source of truth); clients pick them up through the generic /api/sync pull.
// ============================================================================

import { query } from './db.js';

const ROLE_COLUMN = {
  consultant: 'consultant_id',
  senior_registrar: 'senior_registrar_id',
  registrar: 'registrar_id',
  house_officer: 'house_officer_id',
};
// The DB role enum uses 'junior_registrar'; UI/columns call it 'registrar' —
// accept both as one pool (matches api/medical-team behaviour).
const ROLE_USERS = {
  consultant: ['consultant'],
  senior_registrar: ['senior_registrar'],
  registrar: ['registrar', 'junior_registrar'],
  house_officer: ['house_officer'],
};
const ROLES = ['consultant', 'senior_registrar', 'registrar', 'house_officer'];

let ensured = false;
async function ensureColumns() {
  if (ensured) return;
  const stmts = [
    `ALTER TABLE patient_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE patient_assignments ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP`,
    `ALTER TABLE patient_assignments ADD COLUMN IF NOT EXISTS reassigned_reason TEXT`,
    `ALTER TABLE admissions ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255)`,
    `ALTER TABLE admissions ADD COLUMN IF NOT EXISTS hospital_number VARCHAR(100)`,
  ];
  for (const s of stmts) { try { await query(s); } catch (e) { console.warn('teamAssignment ensure skipped:', e.message); } }
  ensured = true;
}

/** Least-loaded active+approved staff id (string) for a role, or null. */
export async function pickLeastLoadedByRole(roleKey, excludeUserId = null) {
  const col = ROLE_COLUMN[roleKey];
  const roles = ROLE_USERS[roleKey];
  if (!col || !roles) return null;
  const params = [roles];
  let exclude = '';
  if (excludeUserId != null) { params.push(String(excludeUserId)); exclude = `AND u.id::text <> $${params.length}`; }
  const r = await query(
    `SELECT u.id
       FROM users u
       LEFT JOIN (
         SELECT ${col} AS uid, COUNT(*) AS c
           FROM patient_assignments
          WHERE is_active = TRUE AND ${col} IS NOT NULL
          GROUP BY ${col}
       ) pa ON pa.uid = u.id::text
      WHERE u.role = ANY($1::text[]) AND u.is_active = TRUE AND u.is_approved = TRUE ${exclude}
      ORDER BY COALESCE(pa.c, 0) ASC, RANDOM()
      LIMIT 1`,
    params
  );
  return r.rows[0] ? String(r.rows[0].id) : null;
}

/** Find a patient by hospital number, else create a lightweight record. Returns patients.id. */
export async function findOrCreatePatient(consult) {
  const hn = (consult.hospital_number || '').trim();
  if (hn) {
    const found = await query(`SELECT id FROM patients WHERE hospital_number=$1 LIMIT 1`, [hn]);
    if (found.rows[0]) return found.rows[0].id;
  }
  const parts = String(consult.patient_name || 'Unknown Patient').trim().split(/\s+/);
  const first = parts.shift() || 'Unknown';
  const last = parts.join(' ') || first;
  const hospNo = hn || `CONSULT-${consult.consult_ref}`;
  try {
    const r = await query(
      `INSERT INTO patients (hospital_number, first_name, last_name, gender, ward, bed_number, primary_diagnosis, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [hospNo, first, last, consult.sex || null, consult.ward || null, consult.bed_number || null,
       consult.primary_diagnosis || consult.indication || null, consult.acknowledged_by || null]
    );
    return r.rows[0].id;
  } catch (e) {
    if (e.code === '23505') { // unique hospital_number race — fetch existing
      const again = await query(`SELECT id FROM patients WHERE hospital_number=$1 LIMIT 1`, [hospNo]);
      if (again.rows[0]) return again.rows[0].id;
    }
    throw e;
  }
}

/** Create an active admission for the patient if none exists. Returns admissions.id. */
export async function ensureActiveAdmission(patientId, consult, createdBy) {
  const existing = await query(
    `SELECT id FROM admissions WHERE patient_id=$1 AND status IN ('active','admitted') LIMIT 1`, [patientId]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const r = await query(
    `INSERT INTO admissions (patient_id, admission_date, ward, bed_number, admitting_diagnosis, status, notes, created_by, patient_name, hospital_number)
     VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, 'active', $5, $6, $7, $8) RETURNING id`,
    [patientId, consult.ward || null, consult.bed_number || null,
     consult.primary_diagnosis || consult.indication || null,
     `Auto-admitted from consult ${consult.consult_ref}`, createdBy || null,
     consult.patient_name || null, consult.hospital_number || null]
  );
  return r.rows[0].id;
}

/** Evenly assign a full team; only fills role slots that are currently empty. */
export async function assignFullTeam(patientId, hospitalNumber) {
  const consultant = await pickLeastLoadedByRole('consultant');
  const sr = await pickLeastLoadedByRole('senior_registrar');
  const reg = await pickLeastLoadedByRole('registrar');
  const ho = await pickLeastLoadedByRole('house_officer');
  await query(
    `INSERT INTO patient_assignments
       (patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, assigned_at, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, CURRENT_TIMESTAMP, TRUE, CURRENT_TIMESTAMP)
     ON CONFLICT (patient_id) DO UPDATE SET
       hospital_number     = COALESCE(patient_assignments.hospital_number, EXCLUDED.hospital_number),
       consultant_id       = COALESCE(patient_assignments.consultant_id, EXCLUDED.consultant_id),
       senior_registrar_id = COALESCE(patient_assignments.senior_registrar_id, EXCLUDED.senior_registrar_id),
       registrar_id        = COALESCE(patient_assignments.registrar_id, EXCLUDED.registrar_id),
       house_officer_id    = COALESCE(patient_assignments.house_officer_id, EXCLUDED.house_officer_id),
       is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
    [String(patientId), hospitalNumber || null, consultant, sr, reg, ho]
  );
  return { consultant, senior_registrar: sr, registrar: reg, house_officer: ho };
}

/** Full pipeline: patient → admission → team. Best-effort; throws only on hard DB errors. */
export async function autoAdmitFromConsult(consult, user) {
  await ensureColumns();
  const patientId = await findOrCreatePatient(consult);
  await ensureActiveAdmission(patientId, consult, user?.id || null);
  const team = await assignFullTeam(patientId, consult.hospital_number);
  return { patientId, team };
}

/**
 * Ensure every currently-admitted patient has a full team, filling only the
 * empty role slots (least-loaded staff). Skips patients already complete, so
 * it's cheap to run repeatedly (e.g. on dashboard load).
 */
export async function backfillActiveAdmissions() {
  await ensureColumns();
  const adms = (await query(
    `SELECT DISTINCT patient_id FROM admissions
      WHERE status IN ('active','admitted') AND patient_id IS NOT NULL`
  )).rows;
  const existing = (await query(
    `SELECT patient_id, consultant_id, senior_registrar_id, registrar_id, house_officer_id
       FROM patient_assignments WHERE is_active = TRUE`
  )).rows;
  const byPid = new Map(existing.map(r => [String(r.patient_id), r]));
  let processed = 0;
  for (const a of adms) {
    const pid = String(a.patient_id);
    const e = byPid.get(pid);
    const complete = e && e.consultant_id && e.senior_registrar_id && e.registrar_id && e.house_officer_id;
    if (complete) continue;
    await assignFullTeam(pid, null); // COALESCE fills only the empty slots
    processed++;
  }
  return { total: adms.length, processed };
}

/**
 * Rebalance EVERY admitted patient's team evenly (round-robin) across the
 * current active+approved staff for each role. Overwrites existing assignments,
 * so use it after adding/removing staff to spread load fresh. Roles with no
 * active staff are left empty.
 */
export async function rebalanceAllTeams() {
  await ensureColumns();
  const adms = (await query(
    `SELECT DISTINCT patient_id FROM admissions
      WHERE status IN ('active','admitted') AND patient_id IS NOT NULL
      ORDER BY patient_id`
  )).rows;
  const pool = {};
  for (const roleKey of ROLES) {
    pool[roleKey] = (await query(
      `SELECT id FROM users WHERE role = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE ORDER BY id`,
      [ROLE_USERS[roleKey]]
    )).rows.map(r => String(r.id));
  }
  const idx = { consultant: 0, senior_registrar: 0, registrar: 0, house_officer: 0 };
  const pick = (roleKey) => {
    const arr = pool[roleKey];
    if (!arr.length) return null;
    const v = arr[idx[roleKey] % arr.length];
    idx[roleKey]++;
    return v;
  };
  let processed = 0;
  for (const a of adms) {
    await setAssignment(String(a.patient_id), {
      consultant_id: pick('consultant'),
      senior_registrar_id: pick('senior_registrar'),
      registrar_id: pick('registrar'),
      house_officer_id: pick('house_officer'),
    });
    processed++;
  }
  return { processed, pools: Object.fromEntries(ROLES.map(r => [r, pool[r].length])) };
}

/**
 * Admin edit: set a patient's team explicitly. Unlike assignFullTeam this
 * OVERWRITES each role (null clears it), so an admin can reassign or unassign.
 */
export async function setAssignment(patientId, roles) {
  await ensureColumns();
  const norm = (v) => (v === undefined || v === null || v === '') ? null : String(v);
  await query(
    `INSERT INTO patient_assignments
       (patient_id, consultant_id, senior_registrar_id, registrar_id, house_officer_id, is_active, assigned_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT (patient_id) DO UPDATE SET
       consultant_id = $2, senior_registrar_id = $3, registrar_id = $4, house_officer_id = $5,
       is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
    [String(patientId), norm(roles.consultant_id), norm(roles.senior_registrar_id), norm(roles.registrar_id), norm(roles.house_officer_id)]
  );
  return true;
}

/**
 * End team assignments when patients are discharged — deactivate their rows so
 * they drop off staff load and no longer appear in the staff patient lookup.
 */
export async function deactivateAssignmentsForPatients(patientIds) {
  if (!patientIds || patientIds.length === 0) return 0;
  await ensureColumns();
  const ids = patientIds.map(String);
  const r = await query(
    `UPDATE patient_assignments SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE patient_id = ANY($1::text[]) AND is_active = TRUE`,
    [ids]
  );
  return r.rowCount || 0;
}

/**
 * Reassign every active patient held by a now-deactivated user to the
 * least-loaded remaining active staff of that role. If none exists, the role
 * slot is cleared (left empty) and recorded for follow-up.
 */
export async function reassignDeactivatedUser(userId) {
  await ensureColumns();
  const uid = String(userId);
  let reassigned = 0, cleared = 0;
  for (const roleKey of ROLES) {
    const col = ROLE_COLUMN[roleKey];
    const rows = (await query(
      `SELECT id FROM patient_assignments WHERE is_active = TRUE AND ${col} = $1`, [uid]
    )).rows;
    for (const row of rows) {
      const replacement = await pickLeastLoadedByRole(roleKey, uid);
      await query(
        `UPDATE patient_assignments
            SET ${col} = $1, reassigned_at = CURRENT_TIMESTAMP,
                reassigned_reason = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3`,
        [replacement, `Auto-reassigned: ${roleKey} deactivated (user ${uid})`, row.id]
      );
      if (replacement) reassigned++; else cleared++;
    }
  }
  return { reassigned, cleared };
}
