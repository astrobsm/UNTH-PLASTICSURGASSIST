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
import { onCallTeamAt, getUnitConfig, saveUnitConfig } from './callRoster.js';

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

// ── Units ───────────────────────────────────────────────────────────────────
// With the unit call pattern configured, each unit runs its own patients, and
// the patient's senior registrar, registrar and house officer are drawn from
// that unit's doctors as they stand today. When juniors rotate, the patients
// stay with the unit and pass to the incoming doctors.
//
// A patient's unit is the ADMITTING UNIT on their open admission
// (admissions.assigned_unit — 'PS-UNIT-1' / 'PS-UNIT-2', the first and second
// configured unit). It is chosen at admission, and set automatically from the
// call-duty roster for a patient admitted through a consult. An admission
// without one (patients admitted before units existed) falls back to the unit
// of the patient's consultant, and is stamped with it so it stays put.

/** Admitting-unit ids stored on admissions, by configured unit position. */
export const UNIT_IDS = ['PS-UNIT-1', 'PS-UNIT-2'];

/**
 * Unit position (0/1) for whatever identifies a unit — 'PS-UNIT-1', 'unit1',
 * a configured key or name — or undefined.
 */
export function unitIndexFromId(value, units = null) {
  const v = String(value ?? '').trim();
  if (!v) return undefined;
  if (units) {
    const i = units.findIndex(u => u.key === v || String(u.name || '').toLowerCase() === v.toLowerCase());
    if (i >= 0) return i;
  }
  const m = /unit[\s_-]*([12])\b/i.exec(v);
  return m ? Number(m[1]) - 1 : undefined;
}

const UNIT_GRADE_KEY = {
  senior_registrar: 'senior_registrar_ids',
  registrar: 'registrar_ids',
  house_officer: 'house_officer_ids',
};
const JUNIOR_GRADES = Object.keys(UNIT_GRADE_KEY);

/** Today's unit membership, or null when units are not configured. */
export async function currentUnitMembership() {
  let cfg = null;
  try { cfg = await getUnitConfig(); } catch { cfg = null; }
  if (!cfg || !Array.isArray(cfg.current_units) || cfg.current_units.length !== 2) return null;
  const units = cfg.current_units;
  const unitOfConsultant = new Map();
  units.forEach((u, i) => (u.consultant_ids || []).forEach(id => unitOfConsultant.set(String(id), i)));
  return { units, unitOfConsultant };
}

/** Admitting unit of each patient with an open admission: Map<patientId, unitIndex>. */
async function admittingUnits(units) {
  const out = new Map();
  try {
    const r = await query(
      `SELECT patient_id::text AS pid, assigned_unit FROM admissions
        WHERE status IN ('active','admitted') AND patient_id IS NOT NULL`
    );
    for (const row of r.rows) {
      const ui = unitIndexFromId(row.assigned_unit, units);
      if (ui !== undefined) out.set(row.pid, ui);
    }
  } catch (e) {
    console.warn('admittingUnits:', e.message);
  }
  return out;
}

/** A patient's unit: their admitting unit, else their consultant's unit. */
async function unitIndexForPatient(patientId, consultantId, m) {
  if (!m) return undefined;
  try {
    const r = await query(
      `SELECT assigned_unit FROM admissions
        WHERE patient_id::text = $1 AND status IN ('active','admitted')
        ORDER BY admission_date DESC NULLS LAST LIMIT 1`,
      [String(patientId)]
    );
    const ui = unitIndexFromId(r.rows[0]?.assigned_unit, m.units);
    if (ui !== undefined) return ui;
  } catch { /* no admissions table — fall through */ }
  return consultantId == null ? undefined : m.unitOfConsultant.get(String(consultantId));
}

/**
 * Stamp the admitting unit on a patient's open admission when it has none.
 * Never overwrites a unit someone chose.
 */
export async function setAdmittingUnitIfMissing(patientId, unitIndex) {
  if (unitIndex === undefined || unitIndex === null || !UNIT_IDS[unitIndex]) return;
  try {
    await query(
      `UPDATE admissions SET assigned_unit = $2
        WHERE patient_id::text = $1 AND status IN ('active','admitted')
          AND (assigned_unit IS NULL OR TRIM(assigned_unit) = '')`,
      [String(patientId), UNIT_IDS[unitIndex]]
    );
  } catch (e) {
    console.warn('setAdmittingUnitIfMissing:', e.message);
  }
}

/**
 * Keep the patients already admitted in the units they are in: give every
 * open admission without an admitting unit the unit of its patient's
 * consultant. Patients whose consultant is in no unit are left without one.
 */
export async function backfillAdmittingUnits(membership = null) {
  const m = membership || await currentUnitMembership();
  if (!m) return 0;
  let stamped = 0;
  try {
    const rows = (await query(
      `SELECT a.id, pa.consultant_id::text AS consultant_id
         FROM admissions a
         JOIN patient_assignments pa ON pa.patient_id::text = a.patient_id::text AND pa.is_active = TRUE
        WHERE a.status IN ('active','admitted') AND (a.assigned_unit IS NULL OR TRIM(a.assigned_unit) = '')`
    )).rows;
    for (const r of rows) {
      const ui = r.consultant_id ? m.unitOfConsultant.get(r.consultant_id) : undefined;
      if (ui === undefined) continue;
      await query(`UPDATE admissions SET assigned_unit = $1 WHERE id = $2`, [UNIT_IDS[ui], r.id]);
      stamped++;
    }
  } catch (e) {
    console.warn('backfillAdmittingUnits:', e.message);
  }
  return stamped;
}

/** Least-loaded active, present member among `ids` for a grade, or null. */
async function pickLeastLoadedAmong(roleKey, ids) {
  const col = ROLE_COLUMN[roleKey];
  if (!col || !ids || ids.length === 0) return null;
  const absent = new Set((await absentUserIds()).map(String));
  const present = ids.map(String).filter(id => !absent.has(id));
  const cand = present.length ? present : ids.map(String); // all away → still keep it in the unit
  const r = await query(
    `SELECT u.id
       FROM users u
       LEFT JOIN (
         SELECT ${col} AS uid, COUNT(*) AS c
           FROM patient_assignments
          WHERE is_active = TRUE AND ${col} IS NOT NULL
          GROUP BY ${col}
       ) pa ON pa.uid = u.id::text
      WHERE u.id::text = ANY($1::text[]) AND u.is_active = TRUE AND u.is_approved = TRUE
      ORDER BY COALESCE(pa.c, 0) ASC, RANDOM()
      LIMIT 1`,
    [cand]
  );
  return r.rows[0] ? String(r.rows[0].id) : null;
}

const UNIT_LIST_KEY = { consultant: 'consultant_ids', ...UNIT_GRADE_KEY };

/**
 * Someone of `roleKey` for a patient of unit `unitIndex`: the least-loaded of
 * that unit's members, or (no unit, or nobody of the grade in it) the
 * least-loaded of the grade overall.
 */
export async function pickForUnit(roleKey, unitIndex, membership) {
  if (membership && unitIndex !== undefined && unitIndex !== null && UNIT_LIST_KEY[roleKey]) {
    const id = await pickLeastLoadedAmong(roleKey, membership.units[unitIndex]?.[UNIT_LIST_KEY[roleKey]] || []);
    if (id) return id;
  }
  return pickLeastLoadedByRole(roleKey);
}

/**
 * Bring every active patient's junior team into line with today's units: any
 * senior registrar, registrar or house officer who is no longer in the
 * patient's unit (rotated out, moved by an administrator) is replaced by the
 * least-loaded doctor of that grade in the unit. Patients whose consultant is
 * not in a unit, and grades a unit has nobody for, are left as they are.
 *
 * Decided in memory from one read, then only changed rows are written, so a
 * full ward fits in one request.
 *
 * @returns {{checked:number, reassigned:number, byGrade:Record<string,number>}}
 */
export async function applyUnitMembership(membership = null, { patientIds = null } = {}) {
  await ensureColumns();
  const m = membership || await currentUnitMembership();
  const result = { checked: 0, reassigned: 0, byGrade: { senior_registrar: 0, registrar: 0, house_officer: 0 } };
  if (!m) return result;
  await backfillAdmittingUnits(m);

  const allRows = (await query(
    `SELECT id, patient_id, consultant_id, senior_registrar_id, registrar_id, house_officer_id
       FROM patient_assignments WHERE is_active = TRUE`
  )).rows;
  // Load is counted over everyone; only the requested patients are changed.
  const only = patientIds ? new Set(patientIds.map(String)) : null;

  const unitOf = await admittingUnits(m.units);
  const absent = new Set((await absentUserIds()).map(String));
  const load = new Map(); // `${grade}:${id}` -> active patient count
  const bump = (grade, id, by = 1) => { const k = `${grade}:${id}`; load.set(k, (load.get(k) || 0) + by); };
  for (const r of allRows) for (const g of JUNIOR_GRADES) if (r[ROLE_COLUMN[g]]) bump(g, String(r[ROLE_COLUMN[g]]));

  for (const r of allRows) {
    if (only && !only.has(String(r.patient_id))) continue;
    const ui = unitOf.has(String(r.patient_id))
      ? unitOf.get(String(r.patient_id))
      : (r.consultant_id == null ? undefined : m.unitOfConsultant.get(String(r.consultant_id)));
    if (ui === undefined) continue;
    result.checked++;
    const updates = {};
    for (const g of JUNIOR_GRADES) {
      const members = (m.units[ui][UNIT_GRADE_KEY[g]] || []).map(String);
      if (members.length === 0) continue;
      const cur = r[ROLE_COLUMN[g]] == null ? '' : String(r[ROLE_COLUMN[g]]);
      if (cur && members.includes(cur)) continue;
      const present = members.filter(id => !absent.has(id));
      const pool = present.length ? present : members;
      const pick = pool.reduce((best, id) => ((load.get(`${g}:${id}`) || 0) < (load.get(`${g}:${best}`) || 0) ? id : best), pool[0]);
      if (cur) bump(g, cur, -1);
      bump(g, pick);
      updates[ROLE_COLUMN[g]] = pick;
      result.byGrade[g]++;
    }
    const cols = Object.keys(updates);
    if (cols.length === 0) continue;
    const vals = cols.map(c => updates[c]);
    vals.push('Unit rotation: handed to the doctor now in the patient\'s unit', r.id);
    await query(
      `UPDATE patient_assignments
          SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')},
              reassigned_at = CURRENT_TIMESTAMP, reassigned_reason = $${cols.length + 1}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${cols.length + 2}`,
      vals
    );
    result.reassigned++;
  }
  return result;
}

/**
 * Bring NEW admissions (the last 24 hours) into their admitting unit: any
 * junior on them who is not in the unit is replaced by the unit's
 * least-loaded doctor of that grade. Admission screens can still assign a team
 * from the whole department after the admission is saved, so this runs right
 * after an admission and again on the heartbeat. Older admissions — the
 * patients already in the units — are not touched here.
 */
export async function alignRecentAdmissions(patientIds = null) {
  const m = await currentUnitMembership();
  if (!m) return null;
  let ids = patientIds;
  if (!ids) {
    try {
      ids = (await query(
        `SELECT DISTINCT patient_id::text AS pid FROM admissions
          WHERE status IN ('active','admitted') AND assigned_unit IS NOT NULL
            AND created_at >= NOW() - INTERVAL '1 day'`
      )).rows.map(r => r.pid);
    } catch { ids = []; }
  }
  if (!ids.length) { await backfillAdmittingUnits(m); return null; }
  return applyUnitMembership(m, { patientIds: ids });
}

// Membership changes on rotation dates without anyone touching the
// configuration, and there is no scheduler. So the on-call read path (polled by
// every open dashboard) calls this: it applies the units once whenever today's
// membership differs from the last one applied, and is a cheap no-op otherwise.
let lastSignatureSeen = null;
export async function applyUnitMembershipIfChanged() {
  const m = await currentUnitMembership();
  if (!m) return null;
  const signature = JSON.stringify(m.units.map(u => [u.consultant_ids, ...JUNIOR_GRADES.map(g => u[UNIT_GRADE_KEY[g]])]));
  if (signature === lastSignatureSeen) return null;
  try {
    await query(`CREATE TABLE IF NOT EXISTS unit_membership_state (
      id INTEGER PRIMARY KEY, signature TEXT, applied_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)`);
    const r = await query(`SELECT signature FROM unit_membership_state WHERE id = 1`);
    if (r.rows[0]?.signature === signature) { lastSignatureSeen = signature; return null; }
    // Patients already admitted keep their unit (stamped from their
    // consultant's unit) and, the first time units are applied, keep their
    // team too: that first pass only records the baseline. Handover happens on
    // later changes — a rotation date, or someone moved between units.
    const stamped = await backfillAdmittingUnits(m);
    const res = r.rows[0]
      ? { ...(await applyUnitMembership(m)), stamped }
      : { checked: 0, reassigned: 0, byGrade: { senior_registrar: 0, registrar: 0, house_officer: 0 }, stamped, baseline: true };
    await query(
      `INSERT INTO unit_membership_state (id, signature, applied_at) VALUES (1, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET signature = EXCLUDED.signature, applied_at = CURRENT_TIMESTAMP`,
      [signature]
    );
    lastSignatureSeen = signature;
    return res;
  } catch (e) {
    console.warn('applyUnitMembershipIfChanged:', e.message);
    return null;
  }
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
  // A consult is admitted under the unit that was on call when it arrived.
  const unit = await consultUnitIndex(consult);
  const existing = await query(
    `SELECT id FROM admissions WHERE patient_id=$1 AND status IN ('active','admitted') LIMIT 1`, [patientId]
  );
  if (existing.rows[0]) {
    await setAdmittingUnitIfMissing(patientId, unit);
    return existing.rows[0].id;
  }
  try { await query(`ALTER TABLE admissions ADD COLUMN IF NOT EXISTS assigned_unit VARCHAR(50)`); } catch { /* exists */ }
  const r = await query(
    `INSERT INTO admissions (patient_id, admission_date, ward, bed_number, admitting_diagnosis, status, notes, created_by, patient_name, hospital_number, assigned_unit)
     VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, 'active', $5, $6, $7, $8, $9) RETURNING id`,
    [patientId, consult.ward || null, consult.bed_number || null,
     consult.primary_diagnosis || consult.indication || null,
     `Auto-admitted from consult ${consult.consult_ref}`, createdBy || null,
     consult.patient_name || null, consult.hospital_number || null,
     unit === undefined ? null : UNIT_IDS[unit]]
  );
  return r.rows[0].id;
}

/** Unit position of the unit on call when a consult arrived, or undefined. */
export async function consultUnitIndex(consult) {
  let team = consult?.oncall_team;
  if (typeof team === 'string') { try { team = JSON.parse(team); } catch { team = null; } }
  const m = await currentUnitMembership();
  if (!m) return undefined;
  const fromKey = unitIndexFromId(team?.unit_key, m.units);
  if (fromKey !== undefined) return fromKey;
  const cons = team?.consultant?.id || consult?.oncall_consultant_id;
  return cons ? m.unitOfConsultant.get(String(cons)) : undefined;
}

/** Evenly assign a full team; only fills role slots that are currently empty. */
export async function assignFullTeam(patientId, hospitalNumber, membershipIn = undefined) {
  // Juniors come from the unit of the patient's consultant — the one already
  // assigned if there is one (the COALESCE below keeps it), else the new pick.
  const existing = (await query(
    `SELECT consultant_id FROM patient_assignments WHERE patient_id = $1`, [String(patientId)]
  )).rows[0];
  // Callers looping over many patients pass the membership in, so the unit
  // configuration is read once rather than once per patient.
  const membership = membershipIn === undefined ? await currentUnitMembership() : membershipIn;
  // The admitting unit decides the team; a patient with none takes the unit of
  // their consultant (and keeps it).
  let unit = await unitIndexForPatient(patientId, existing?.consultant_id, membership);
  const consultant = existing?.consultant_id ? String(existing.consultant_id) : await pickForUnit('consultant', unit, membership);
  if (unit === undefined && membership && consultant) unit = membership.unitOfConsultant.get(String(consultant));
  await setAdmittingUnitIfMissing(patientId, unit);
  const sr = await pickForUnit('senior_registrar', unit, membership);
  const reg = await pickForUnit('registrar', unit, membership);
  const ho = await pickForUnit('house_officer', unit, membership);
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
 * The consultant / senior registrar / registrar / house officer ON CALL at an
 * instant, from the call_duty_roster shift covering it. Null ids when no roster
 * covers it.
 *
 * This used to take a bare "YYYY-MM-DD" and test it with BETWEEN against the
 * roster's ISO timestamps. As text, "2026-10-01" sorts before
 * "2026-10-01T07:00:00Z", so it matched the shift that ENDED that morning — a
 * day early once shifts became daily.
 */
export async function getOnCallTeam(at = new Date()) {
  try {
    const team = await onCallTeamAt(at);
    return {
      consultant_id: team?.consultant.id || null,
      senior_registrar_id: team?.senior_registrar.id || null,
      registrar_id: team?.registrar.id || null,
      // Admitted patients belong to the WARD house officer.
      house_officer_id: team?.ho_ward.id || team?.house_officer.id || null,
    };
  } catch (e) {
    console.warn('getOnCallTeam failed:', e.message);
    return { consultant_id: null, senior_registrar_id: null, registrar_id: null, house_officer_id: null };
  }
}

/**
 * Assign a consult patient to the team that was ON CALL when the consult
 * arrived. The consult records that team when it is created (see
 * consults-module.js), so the patient lands with the same consultant the
 * referring doctor was told about, even if the patient is only admitted later,
 * at acknowledgement, after the call day has changed. Falls back to the roster
 * at `at`, then to the least-loaded staff for any role nobody covers.
 */
export async function assignOnCallTeamFromConsult(patientId, hospitalNumber, consult = null, at = new Date()) {
  const recorded = consult && consult.oncall_assigned_at ? {
    consultant_id: consult.oncall_consultant_id || null,
    senior_registrar_id: consult.oncall_senior_registrar_id || null,
    registrar_id: consult.oncall_registrar_id || null,
    house_officer_id: consult.oncall_ho_ward_id || consult.oncall_house_officer_id || null,
  } : null;
  const onCall = recorded || await getOnCallTeam(at);
  const membership = await currentUnitMembership();
  // The unit on call when the consult arrived is the admitting unit; gaps in
  // the on-call team are filled from that unit.
  const unit = await unitIndexForPatient(patientId, onCall.consultant_id, membership);
  const consultant = onCall.consultant_id || await pickForUnit('consultant', unit, membership);
  const sr = onCall.senior_registrar_id || await pickForUnit('senior_registrar', unit, membership);
  const reg = onCall.registrar_id || await pickForUnit('registrar', unit, membership);
  const ho = onCall.house_officer_id || await pickForUnit('house_officer', unit, membership);
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
  return { consultant, senior_registrar: sr, registrar: reg, house_officer: ho, source: recorded ? 'consult_on_call' : 'on_call' };
}

/** Full pipeline: patient → admission → on-call team. Best-effort; throws only on hard DB errors. */
export async function autoAdmitFromConsult(consult, user) {
  await ensureColumns();
  const patientId = await findOrCreatePatient(consult);
  await ensureActiveAdmission(patientId, consult, user?.id || null);
  // Consult patients go to the team that was ON CALL when the consult arrived.
  const team = await assignOnCallTeamFromConsult(patientId, consult.hospital_number, consult);
  return { patientId, team };
}

/**
 * Ensure every currently-admitted patient has a full team, filling only the
 * empty role slots (least-loaded staff). Skips patients already complete, so
 * it's cheap to run repeatedly (e.g. on dashboard load).
 */
export async function backfillActiveAdmissions({ budgetMs = 8000 } = {}) {
  await ensureColumns();
  const started = Date.now();
  const adms = (await query(
    `SELECT DISTINCT patient_id FROM admissions
      WHERE status IN ('active','admitted') AND patient_id IS NOT NULL`
  )).rows;
  const existing = (await query(
    `SELECT patient_id, consultant_id, senior_registrar_id, registrar_id, house_officer_id
       FROM patient_assignments WHERE is_active = TRUE`
  )).rows;
  const byPid = new Map(existing.map(r => [String(r.patient_id), r]));
  const incomplete = adms.map(a => String(a.patient_id)).filter(pid => {
    const e = byPid.get(pid);
    return !(e && e.consultant_id && e.senior_registrar_id && e.registrar_id && e.house_officer_id);
  });
  // Unit configuration once for the whole run (it was read per patient), and
  // a time budget: the dashboard calls this on load, and a run over a long
  // list used to exceed the client's 15 s timeout — the request was then
  // queued as an "offline change" and replayed again and again. Whatever is
  // left is picked up by the next call; it is idempotent.
  const membership = await currentUnitMembership();
  let processed = 0;
  for (const pid of incomplete) {
    if (Date.now() - started > budgetMs) break;
    await assignFullTeam(pid, null, membership); // COALESCE fills only the empty slots
    processed++;
  }
  return { total: adms.length, processed, remaining: incomplete.length - processed };
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
  // With units configured, spread each unit's patients over that unit's own
  // doctors; only patients outside any unit use the department-wide pools.
  const membership = await currentUnitMembership();
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
  const consultantOf = new Map();
  const admittedUnit = membership ? await admittingUnits(membership.units) : new Map();
  if (membership) {
    const rows = (await query(`SELECT patient_id, consultant_id FROM patient_assignments WHERE is_active = TRUE`)).rows;
    for (const r of rows) consultantOf.set(String(r.patient_id), r.consultant_id == null ? null : String(r.consultant_id));
  }
  const unitIdx = {}; // `${unit}:${grade}` -> round-robin cursor
  const pickInUnit = (ui, roleKey) => {
    const arr = (membership.units[ui][UNIT_GRADE_KEY[roleKey]] || []).map(String);
    if (!arr.length) return pick(roleKey);
    const k = `${ui}:${roleKey}`;
    const v = arr[(unitIdx[k] || 0) % arr.length];
    unitIdx[k] = (unitIdx[k] || 0) + 1;
    return v;
  };
  let processed = 0;
  for (const a of adms) {
    const cons = consultantOf.get(String(a.patient_id));
    const ui = admittedUnit.has(String(a.patient_id))
      ? admittedUnit.get(String(a.patient_id))
      : (membership && cons ? membership.unitOfConsultant.get(cons) : undefined);
    const choose = (roleKey) => (ui === undefined ? pick(roleKey) : pickInUnit(ui, roleKey));
    const sr = choose('senior_registrar');
    const reg = choose('registrar');
    const ho = choose('house_officer');
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
 * Reassign every active patient held by a now-deactivated user. Each patient
 * goes to the least-loaded doctor of the same grade IN THE PATIENT'S UNIT
 * (admitting unit, else the consultant's unit); only when the unit has nobody
 * of that grade does it fall back to the least-loaded of the grade overall,
 * and that is counted as `outsideUnit`. With nobody at all the slot is
 * cleared and counted as `cleared`.
 *
 * This used to pick from the whole department, so a Unit 1 patient could be
 * handed to a Unit 2 house officer.
 */
export async function reassignDeactivatedUser(userId) {
  await ensureColumns();
  const uid = String(userId);
  const m = await currentUnitMembership();
  const unitOf = m ? await admittingUnits(m.units) : new Map();
  let reassigned = 0, cleared = 0, outsideUnit = 0;
  for (const roleKey of ROLES) {
    const col = ROLE_COLUMN[roleKey];
    const rows = (await query(
      `SELECT id, patient_id, consultant_id FROM patient_assignments WHERE is_active = TRUE AND ${col} = $1`, [uid]
    )).rows;
    for (const row of rows) {
      const ui = unitOf.has(String(row.patient_id))
        ? unitOf.get(String(row.patient_id))
        : (m && row.consultant_id != null && roleKey !== 'consultant' ? m.unitOfConsultant.get(String(row.consultant_id)) : undefined);
      let replacement = null;
      if (m && ui !== undefined && UNIT_LIST_KEY[roleKey]) {
        const members = (m.units[ui]?.[UNIT_LIST_KEY[roleKey]] || []).map(String).filter(id => id !== uid);
        replacement = await pickLeastLoadedAmong(roleKey, members);
      }
      if (!replacement) {
        replacement = await pickLeastLoadedByRole(roleKey, uid);
        if (replacement && ui !== undefined) outsideUnit++;
      }
      await query(
        `UPDATE patient_assignments
            SET ${col} = $1, reassigned_at = CURRENT_TIMESTAMP,
                reassigned_reason = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3`,
        [replacement, `Auto-reassigned: ${roleKey} left the unit (user ${uid})`, row.id]
      );
      if (replacement) reassigned++; else cleared++;
    }
  }
  return { reassigned, cleared, outsideUnit };
}

/**
 * Take users out of every unit's lists on the call-roster configuration, so
 * no future roster, rotation or unit placement uses them.
 */
export async function removeFromUnits(userIds, byUserId = null) {
  const ids = new Set((Array.isArray(userIds) ? userIds : [userIds]).map(String));
  let cfg = null;
  try { cfg = await getUnitConfig(); } catch { cfg = null; }
  if (!cfg || !Array.isArray(cfg.current_units) || cfg.current_units.length !== 2) return { removed: 0 };
  let removed = 0;
  const units = cfg.current_units.map(u => {
    const out = { ...u };
    for (const key of Object.values(UNIT_LIST_KEY)) {
      const before = (u[key] || []).map(String);
      out[key] = before.filter(id => !ids.has(id));
      removed += before.length - out[key].length;
    }
    return out;
  });
  if (!removed) return { removed: 0 };
  const r = await saveUnitConfig({ anchor_date: cfg.anchor_date, rotation: cfg.rotation, units }, byUserId);
  return r.error ? { removed: 0, error: r.error } : { removed };
}

/**
 * Self-healing, run on the dashboard heartbeat: anyone whose account is no
 * longer active is taken out of the units and off every patient they still
 * hold — whether they were signed out properly, deactivated by hand, or left
 * before this check existed.
 */
export async function reconcileInactiveStaff() {
  await ensureColumns();
  const cols = ROLES.map(r => ROLE_COLUMN[r]);
  const holders = (await query(
    `SELECT DISTINCT u.id::text AS id FROM users u
       JOIN patient_assignments pa ON pa.is_active = TRUE AND (${cols.map(c => `pa.${c}::text = u.id::text`).join(' OR ')})
      WHERE u.is_active = FALSE`
  )).rows.map(r => r.id);

  let inUnits = [];
  try {
    const cfg = await getUnitConfig();
    const listed = [...new Set((cfg?.current_units || []).flatMap(u => Object.values(UNIT_LIST_KEY).flatMap(k => u[k] || [])).map(String))];
    if (listed.length) {
      inUnits = (await query(
        `SELECT id::text AS id FROM users WHERE id::text = ANY($1::text[]) AND is_active = FALSE`, [listed]
      )).rows.map(r => r.id);
    }
  } catch { /* units not configured */ }

  const units = inUnits.length ? await removeFromUnits(inUnits) : { removed: 0 };
  let reassigned = 0;
  for (const id of holders) reassigned += (await reassignDeactivatedUser(id)).reassigned;
  return { usersReleased: new Set([...holders, ...inUnits]).size, unitSlotsRemoved: units.removed, patientsReassigned: reassigned };
}
