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
import { rolesForGrade } from './roles.js';

const ROLE_COLUMN = {
  consultant: 'consultant_id',
  senior_registrar: 'senior_registrar_id',
  registrar: 'registrar_id',
  house_officer: 'house_officer_id',
};
// Fallback role keys per grade. The live mapping comes from the staff_roles
// registry (so a unit-defined role like 'medical_officer' that rosters as a
// registrar joins the registrar pool automatically); this literal is only used
// if that lookup fails, so assignment never stops working.
const FALLBACK_ROLE_USERS = {
  consultant: ['consultant'],
  senior_registrar: ['senior_registrar'],
  registrar: ['registrar', 'junior_registrar'],
  house_officer: ['house_officer'],
};
async function roleKeysFor(grade) {
  try {
    const keys = await rolesForGrade(grade);
    if (keys && keys.length) return keys;
  } catch (e) {
    console.warn(`roleKeysFor(${grade}) falling back:`, e.message);
  }
  return FALLBACK_ROLE_USERS[grade] || [];
}
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

/**
 * Staff currently on leave / outside posting. Excluded from every assignment
 * pool: handing a new patient to someone who is away is the whole failure mode
 * the absence feature exists to prevent.
 *
 * Imported lazily to avoid a circular import — staffAbsence.js imports this
 * module for pickLeastLoadedByRole. Failures are swallowed so that assignment
 * keeps working exactly as before if the absence tables are not present yet.
 */
async function absentUserIds() {
  try {
    const { getAbsentUserIds } = await import('./staffAbsence.js');
    return await getAbsentUserIds();
  } catch {
    return [];
  }
}

/**
 * Least-loaded active+approved staff id (string) for a role, or null.
 * `excludeUserId` accepts a single id or an array of ids.
 */
export async function pickLeastLoadedByRole(roleKey, excludeUserId = null) {
  const col = ROLE_COLUMN[roleKey];
  if (!col) return null;
  const roles = await roleKeysFor(roleKey);
  if (!roles.length) return null;

  const explicit = excludeUserId == null
    ? []
    : (Array.isArray(excludeUserId) ? excludeUserId : [excludeUserId]).map(String);
  const excludeIds = [...new Set([...explicit, ...(await absentUserIds())])];

  const params = [roles];
  let exclude = '';
  if (excludeIds.length) {
    params.push(excludeIds);
    exclude = `AND NOT (u.id::text = ANY($${params.length}::text[]))`;
  }
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

/**
 * The senior registrar / registrar / house officer ON CALL for a given date,
 * from the call_duty_roster shift whose [start_date, end_date] covers it.
 * Returns null ids when no roster covers the date.
 */
export async function getOnCallTeam(dateISO) {
  try {
    const r = await query(
      `SELECT consultant_id, senior_registrar_id, registrar_id, house_officer_id, ho_ward_id
         FROM call_duty_roster
        WHERE $1 BETWEEN start_date AND end_date
        ORDER BY updated_at DESC NULLS LAST, id DESC
        LIMIT 1`,
      [dateISO]
    );
    const row = r.rows[0] || {};
    const blank = (v) => (v === '' ? null : v);
    return {
      consultant_id: blank(row.consultant_id) || null,
      senior_registrar_id: blank(row.senior_registrar_id) || null,
      registrar_id: blank(row.registrar_id) || null,
      house_officer_id: blank(row.house_officer_id) || blank(row.ho_ward_id) || null,
    };
  } catch (e) {
    console.warn('getOnCallTeam failed:', e.message);
    return { consultant_id: null, senior_registrar_id: null, registrar_id: null, house_officer_id: null };
  }
}

/**
 * Assign a consult patient to the team ON CALL for that day: the on-call
 * consultant, SR, registrar and house officer from the call-duty roster.
 * Consultants now rotate on the roster (round-robin per shift), so a new
 * admission goes to the consultant on call that day. Falls back to the
 * least-loaded staff for any role the roster doesn't cover.
 */
export async function assignOnCallTeamFromConsult(patientId, hospitalNumber) {
  const today = new Date().toISOString().slice(0, 10);
  const onCall = await getOnCallTeam(today);
  const consultant = onCall.consultant_id || await pickLeastLoadedByRole('consultant');
  const sr = onCall.senior_registrar_id || await pickLeastLoadedByRole('senior_registrar');
  const reg = onCall.registrar_id || await pickLeastLoadedByRole('registrar');
  const ho = onCall.house_officer_id || await pickLeastLoadedByRole('house_officer');
  await query(
    `INSERT INTO patient_assignments
       (patient_id, hospital_number, consultant_id, senior_registrar_id, registrar_id, house_officer_id, assigned_at, is_active, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, CURRENT_TIMESTAMP, TRUE, CURRENT_TIMESTAMP)
     ON CONFLICT (patient_id) DO UPDATE SET
       hospital_number     = COALESCE(EXCLUDED.hospital_number, patient_assignments.hospital_number),
       consultant_id       = COALESCE(EXCLUDED.consultant_id, patient_assignments.consultant_id),
       senior_registrar_id = COALESCE(EXCLUDED.senior_registrar_id, patient_assignments.senior_registrar_id),
       registrar_id        = COALESCE(EXCLUDED.registrar_id, patient_assignments.registrar_id),
       house_officer_id    = COALESCE(EXCLUDED.house_officer_id, patient_assignments.house_officer_id),
       is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
    [String(patientId), hospitalNumber || null, consultant ? String(consultant) : null,
     sr ? String(sr) : null, reg ? String(reg) : null, ho ? String(ho) : null]
  );
  return { consultant, senior_registrar: sr, registrar: reg, house_officer: ho, source: 'on_call' };
}

/** Full pipeline: patient → admission → on-call team. Best-effort; throws only on hard DB errors. */
export async function autoAdmitFromConsult(consult, user) {
  await ensureColumns();
  const patientId = await findOrCreatePatient(consult);
  await ensureActiveAdmission(patientId, consult, user?.id || null);
  // Consult patients go to the team ON CALL for that day (SR/registrar/HO from
  // the call-duty roster) + a consultant.
  const team = await assignOnCallTeamFromConsult(patientId, consult.hospital_number);
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
 * Rebalance EVERY admitted patient's junior team evenly (round-robin) across the
 * current active+approved staff — SENIOR REGISTRAR, REGISTRAR and HOUSE OFFICER
 * only. Each patient's CONSULTANT is deliberately left untouched (consultant
 * relationships are stable and managed separately). Roles with no active staff
 * are left empty. Use after adding/removing junior staff to spread load fresh.
 */
const REBALANCE_ROLES = ['senior_registrar', 'registrar', 'house_officer'];
export async function rebalanceAllTeams() {
  await ensureColumns();
  const adms = (await query(
    `SELECT DISTINCT patient_id FROM admissions
      WHERE status IN ('active','admitted') AND patient_id IS NOT NULL
      ORDER BY patient_id`
  )).rows;
  const pool = {};
  for (const roleKey of REBALANCE_ROLES) {
    pool[roleKey] = (await query(
      `SELECT id FROM users WHERE role = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE ORDER BY id`,
      [await roleKeysFor(roleKey)]
    )).rows.map(r => String(r.id));
  }
  const idx = { senior_registrar: 0, registrar: 0, house_officer: 0 };
  const pick = (roleKey) => {
    const arr = pool[roleKey];
    if (!arr.length) return null;
    const v = arr[idx[roleKey] % arr.length];
    idx[roleKey]++;
    return v;
  };
  let processed = 0;
  for (const a of adms) {
    const sr = pick('senior_registrar');
    const reg = pick('registrar');
    const ho = pick('house_officer');
    // Update only the three junior roles; consultant_id is preserved (not in SET).
    await query(
      `INSERT INTO patient_assignments
         (patient_id, senior_registrar_id, registrar_id, house_officer_id, is_active, assigned_at, updated_at)
       VALUES ($1,$2,$3,$4,TRUE,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT (patient_id) DO UPDATE SET
         senior_registrar_id = $2, registrar_id = $3, house_officer_id = $4,
         is_active = TRUE, updated_at = CURRENT_TIMESTAMP`,
      [String(a.patient_id), sr, reg, ho]
    );
    processed++;
  }
  return { processed, pools: Object.fromEntries(REBALANCE_ROLES.map(r => [r, pool[r].length])) };
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

// ── Call-duty roster cover ──────────────────────────────────────────────────
// Roster slot -> the staff grade that fills it. house_officer_id is the legacy
// mirror of ho_ward_id and is kept in step with it rather than filled separately.
const ROSTER_SLOTS = [
  { id: 'consultant_id', name: 'consultant_name', phone: 'consultant_phone', grade: 'consultant' },
  { id: 'senior_registrar_id', name: 'senior_registrar_name', phone: 'senior_registrar_phone', grade: 'senior_registrar' },
  { id: 'registrar_id', name: 'registrar_name', phone: 'registrar_phone', grade: 'registrar' },
  { id: 'ho_ward_id', name: 'ho_ward_name', phone: 'ho_ward_phone', grade: 'house_officer' },
  { id: 'ho_emergency_id', name: 'ho_emergency_name', phone: 'ho_emergency_phone', grade: 'house_officer' },
  // "Off" is the HO who is NOT on duty — a vacancy here needs no cover, only
  // clearing if the person named in it has been deactivated.
  { id: 'ho_off_id', name: 'ho_off_name', phone: 'ho_off_phone', grade: 'house_officer', neverFill: true },
];

/**
 * Keep CURRENT and FUTURE call-duty shifts (end_date >= now) staffed by people
 * who are actually active, WITHOUT disturbing anyone else's duties.
 *
 * A slot is only touched when the person in it is gone — deactivated, removed,
 * or the slot was already empty. Everyone still active keeps the exact shifts
 * they were given, so a generated roster stays put until an admin regenerates
 * or edits it. Vacated slots are covered by the least-loaded active colleague of
 * the same grade (counting shifts across this same window, so cover spreads
 * evenly instead of piling onto one person), and are cleared only when nobody of
 * that grade is left. Past shifts are left as historical record.
 *
 * Idempotent by design: it writes only columns whose value actually changes, so
 * an unfillable vacancy costs nothing on subsequent runs.
 *
 * @param {{replacing?: string|number}} opts `replacing` treats that user as gone
 *        even if the pool query hasn't caught up with their deactivation yet.
 * @returns {{covered: number, cleared: number, shiftsTouched: number}}
 */
export async function coverRosterVacancies({ replacing = null } = {}) {
  const uid = replacing == null ? null : String(replacing);
  const nowIso = new Date().toISOString();
  const result = { covered: 0, cleared: 0, shiftsTouched: 0 };

  const pools = {};
  for (const grade of ['consultant', 'senior_registrar', 'registrar', 'house_officer']) {
    try {
      const r = await query(
        `SELECT id::text AS id, full_name, phone FROM users
          WHERE role = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE
          ORDER BY id`,
        [await roleKeysFor(grade)]
      );
      pools[grade] = r.rows.filter(u => u.id !== uid);
    } catch (e) {
      console.warn(`coverRosterVacancies pool ${grade}:`, e.message);
      pools[grade] = [];
    }
  }

  let shifts;
  try {
    shifts = (await query(
      `SELECT * FROM call_duty_roster WHERE end_date >= $1 ORDER BY start_date, shift_number`,
      [nowIso]
    )).rows;
  } catch (e) {
    console.warn('coverRosterVacancies: roster read failed:', e.message);
    return result;
  }
  if (shifts.length === 0) return result;

  // Existing load per person over the window being edited.
  const load = new Map();
  const bump = (id) => { if (id) load.set(id, (load.get(id) || 0) + 1); };
  for (const s of shifts) {
    for (const slot of ROSTER_SLOTS) {
      const v = s[slot.id] ? String(s[slot.id]).trim() : '';
      if (v && v !== uid) bump(v);
    }
  }

  for (const shift of shifts) {
    const updates = {};
    // Who is already on this shift for each grade — so one person isn't handed
    // two slots of the same grade while a colleague sits idle.
    const used = {};
    const noteUsed = (grade, id) => { (used[grade] = used[grade] || new Set()).add(id); };
    for (const slot of ROSTER_SLOTS) {
      const cur = shift[slot.id] ? String(shift[slot.id]).trim() : '';
      if (cur && cur !== uid && pools[slot.grade].some(u => u.id === cur)) noteUsed(slot.grade, cur);
    }

    for (const slot of ROSTER_SLOTS) {
      const cur = shift[slot.id] ? String(shift[slot.id]).trim() : '';
      const storedName = String(shift[slot.name] ?? '').trim();
      const stillActive = !!cur && cur !== uid && pools[slot.grade].some(u => u.id === cur);
      if (stillActive) continue; // ← stability: an active person's duty is never moved

      let pick = null;
      if (!slot.neverFill) {
        const pool = pools[slot.grade];
        const taken = used[slot.grade] || new Set();
        const free = pool.filter(u => !taken.has(u.id));
        const from = free.length ? free : pool; // duplicate only if the grade is that thin
        if (from.length) {
          pick = from.reduce((best, u) => ((load.get(u.id) || 0) < (load.get(best.id) || 0) ? u : best), from[0]);
        }
      }

      if (pick) {
        updates[slot.id] = pick.id;
        updates[slot.name] = pick.full_name || 'TBD';
        if (slot.phone) updates[slot.phone] = pick.phone || '';
        bump(pick.id);
        noteUsed(slot.grade, pick.id);
        result.covered++;
      } else if (cur || (storedName && !['TBD', 'Off'].includes(storedName))) {
        // Nobody of that grade left (or an Off slot): clear it, so a deactivated
        // person can never be shown as on call.
        updates[slot.id] = '';
        updates[slot.name] = slot.id === 'ho_off_id' ? 'Off' : 'TBD';
        if (slot.phone) updates[slot.phone] = '';
        result.cleared++;
      }
    }

    // Legacy single-HO mirror follows the ward HO.
    const wardId = 'ho_ward_id' in updates ? updates.ho_ward_id : String(shift.ho_ward_id || '');
    const wardName = 'ho_ward_name' in updates ? updates.ho_ward_name : String(shift.ho_ward_name || '');
    if (String(shift.house_officer_id || '') !== String(wardId)) {
      updates.house_officer_id = wardId;
      updates.house_officer_name = wardName;
    }

    const changed = Object.keys(updates).filter(c => String(shift[c] ?? '') !== String(updates[c] ?? ''));
    if (changed.length === 0) continue;
    const vals = changed.map(c => updates[c]);
    const sets = changed.map((c, i) => `${c} = $${i + 1}`);
    vals.push(shift.id);
    try {
      await query(
        `UPDATE call_duty_roster SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${vals.length}`,
        vals
      );
      result.shiftsTouched++;
    } catch (e) {
      console.warn(`coverRosterVacancies: shift ${shift.id} update failed:`, e.message);
    }
  }

  return result;
}

/**
 * End the team assignment of every patient who no longer has an open admission.
 *
 * A care team means "these people are looking after this admitted patient", so a
 * discharged patient must not sit on anyone's list. Discharge already ends the
 * assignment (see api/admissions.js), but rows drift out of step when a patient
 * is discharged by another route or the discharge hook failed, and those rows
 * then show up on duty reminders. Idempotent: returns 0 once clean.
 */
export async function deactivateAssignmentsWithoutOpenAdmission() {
  await ensureColumns();
  const r = await query(
    `UPDATE patient_assignments pa
        SET is_active = FALSE,
            reassigned_reason = COALESCE(pa.reassigned_reason, 'Ended: patient no longer admitted'),
            updated_at = CURRENT_TIMESTAMP
      WHERE pa.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM admissions a
           WHERE a.patient_id::text = pa.patient_id::text
             AND a.status IN ('active', 'admitted')
        )`
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
