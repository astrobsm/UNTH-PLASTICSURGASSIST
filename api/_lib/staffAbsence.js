// ============================================================================
// Staff absence engine — leave, outside posting, and the cover arrangements.
//
// When an absence starts, everything the person holds is moved to the
// least-loaded active colleague of the same grade: patients (each of the four
// role slots separately), call duty shifts overlapping the window, and clinic
// duties falling inside it. When it ends, their patients come back and the
// group is levelled.
//
// TWO DESIGN POINTS WORTH KNOWING
//
// 1. THE LEDGER. Every individual move is written to absence_reassignments.
//    Restoring on return is otherwise impossible — the live tables only show
//    the current holder, not who held it before. The ledger also means the
//    whole operation is auditable and reversible without a database restore.
//
// 2. NO CRON. This repo removed a Vercel cron once already because it broke the
//    deploy (commit 03693a5, "Keep duty reminders manual"). So absences are
//    processed LAZILY: processDueAbsences() runs on API access, throttled per
//    warm serverless instance. It is idempotent and cheap — two indexed
//    queries when nothing is due — so calling it on a hot path is safe.
//    The trade-off is honest: an absence activates on the first API call on or
//    after its start date, not at midnight precisely. For cover arrangements
//    that is immaterial; for anything needing exact timing it would not be.
// ============================================================================

import { query } from './db.js';
import { pickLeastLoadedByRole } from './teamAssignment.js';

const ROLE_COLUMN = {
  consultant: 'consultant_id',
  senior_registrar: 'senior_registrar_id',
  registrar: 'registrar_id',
  house_officer: 'house_officer_id',
};
const ROLES = Object.keys(ROLE_COLUMN);

// Call duty slots that hold a user id, with the denormalised name/phone columns
// that must move with them or the printed roster shows the wrong person.
const CALL_DUTY_SLOTS = [
  { id: 'consultant_id', name: 'consultant_name', phone: 'consultant_phone', grade: 'consultant' },
  { id: 'senior_registrar_id', name: 'senior_registrar_name', phone: 'senior_registrar_phone', grade: 'senior_registrar' },
  { id: 'registrar_id', name: 'registrar_name', phone: 'registrar_phone', grade: 'registrar' },
  { id: 'house_officer_id', name: 'house_officer_name', phone: null, grade: 'house_officer' },
  { id: 'ho_ward_id', name: 'ho_ward_name', phone: 'ho_ward_phone', grade: 'house_officer' },
  { id: 'ho_emergency_id', name: 'ho_emergency_name', phone: 'ho_emergency_phone', grade: 'house_officer' },
  { id: 'ho_off_id', name: 'ho_off_name', phone: 'ho_off_phone', grade: 'house_officer' },
];

export const ABSENCE_TYPES = [
  'annual_leave', 'sick_leave', 'conference', 'outside_posting', 'study_leave', 'other',
];

let schemaReady = false;
export async function ensureAbsenceTables() {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS staff_absences (
      id SERIAL PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      user_name VARCHAR(200), user_role VARCHAR(60),
      absence_type VARCHAR(40) NOT NULL DEFAULT 'annual_leave',
      start_date DATE NOT NULL, end_date DATE NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      reason TEXT, notes TEXT,
      patients_reassigned INTEGER NOT NULL DEFAULT 0,
      call_duties_reassigned INTEGER NOT NULL DEFAULT 0,
      clinic_duties_reassigned INTEGER NOT NULL DEFAULT 0,
      patients_restored INTEGER NOT NULL DEFAULT 0,
      activated_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      created_by VARCHAR(64),
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_absence_user ON staff_absences(user_id);
    CREATE INDEX IF NOT EXISTS idx_absence_status ON staff_absences(status);
    CREATE INDEX IF NOT EXISTS idx_absence_window ON staff_absences(start_date, end_date);

    CREATE TABLE IF NOT EXISTS absence_reassignments (
      id SERIAL PRIMARY KEY,
      absence_id INTEGER NOT NULL,
      entity_type VARCHAR(30) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      role_column VARCHAR(40),
      from_user_id VARCHAR(64), to_user_id VARCHAR(64),
      restored BOOLEAN NOT NULL DEFAULT FALSE, restored_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_absence_reassign_absence ON absence_reassignments(absence_id);
    CREATE INDEX IF NOT EXISTS idx_absence_reassign_restored ON absence_reassignments(restored);
  `);
  schemaReady = true;
}

// ── Absence lookups ────────────────────────────────────────────────────────

/** User ids currently on an active absence. Used to exclude them from pools. */
export async function getAbsentUserIds() {
  try {
    const r = await query(
      `SELECT DISTINCT user_id FROM staff_absences
       WHERE status = 'active' AND CURRENT_DATE BETWEEN start_date AND end_date`
    );
    return r.rows.map(x => String(x.user_id));
  } catch {
    // Table may not exist yet on a cold database — absence is then simply
    // unknown, and assignment behaves exactly as it did before this feature.
    return [];
  }
}

export async function isUserAbsent(userId) {
  const ids = await getAbsentUserIds();
  return ids.includes(String(userId));
}

/**
 * Least-loaded colleague of the same grade, excluding the person going away
 * AND anyone else currently absent — covering one absence with someone who is
 * themselves on leave is the obvious failure mode here.
 */
async function pickCover(grade, excludeIds) {
  // pickLeastLoadedByRole already excludes everyone currently absent, so the
  // only extra exclusion needed is the person going away — whose own absence
  // row is marked active before any of this runs.
  const cover = await pickLeastLoadedByRole(grade, excludeIds.map(String));
  return cover ? String(cover) : null;
}

function gradeRoleKeys(grade) {
  const map = {
    consultant: ['consultant'],
    senior_registrar: ['senior_registrar'],
    registrar: ['registrar', 'junior_registrar'],
    house_officer: ['house_officer'],
  };
  return map[grade] || [grade];
}

// ── Activation: move everything away ───────────────────────────────────────

async function ledger(absenceId, entityType, entityId, roleColumn, fromId, toId) {
  await query(
    `INSERT INTO absence_reassignments (absence_id, entity_type, entity_id, role_column, from_user_id, to_user_id)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [absenceId, entityType, String(entityId), roleColumn || null, String(fromId), toId ? String(toId) : null]
  );
}

async function reassignPatients(absence) {
  const uid = String(absence.user_id);
  let moved = 0;

  for (const grade of ROLES) {
    const col = ROLE_COLUMN[grade];
    const rows = (await query(
      `SELECT id FROM patient_assignments WHERE is_active = TRUE AND ${col} = $1`, [uid]
    )).rows;

    for (const row of rows) {
      // Recomputed per patient, so the load spreads evenly across the cover
      // group rather than dumping the whole list on one person.
      const cover = await pickCover(grade, [uid]);
      await query(
        `UPDATE patient_assignments
         SET ${col} = $1, reassigned_at = NOW(), reassigned_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [cover, `Cover during ${absence.absence_type} (absence #${absence.id})`, row.id]
      );
      await ledger(absence.id, 'patient_assignment', row.id, col, uid, cover);
      moved++;
    }
  }
  return moved;
}

async function reassignCallDuties(absence) {
  const uid = String(absence.user_id);
  let moved = 0;

  for (const slot of CALL_DUTY_SLOTS) {
    // Only shifts that overlap the absence window — a shift after they return
    // is theirs to keep.
    const rows = (await query(
      `SELECT id, ${slot.id} AS holder FROM call_duty_roster
       WHERE ${slot.id} = $1 AND start_date <= $3 AND end_date >= $2`,
      [uid, absence.start_date, absence.end_date]
    )).rows;

    for (const row of rows) {
      const cover = await pickCover(slot.grade, [uid]);
      if (!cover) continue;

      const person = (await query(
        `SELECT full_name, phone_number FROM users WHERE id::text = $1 LIMIT 1`, [cover]
      )).rows[0] || {};

      const sets = [`${slot.id} = $1`];
      const params = [cover];
      if (slot.name) { params.push(person.full_name || null); sets.push(`${slot.name} = $${params.length}`); }
      if (slot.phone) { params.push(person.phone_number || null); sets.push(`${slot.phone} = $${params.length}`); }
      params.push(row.id);

      await query(
        `UPDATE call_duty_roster SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params
      );
      await ledger(absence.id, 'call_duty', row.id, slot.id, uid, cover);
      moved++;
    }
  }
  return moved;
}

async function reassignClinicDuties(absence) {
  const uid = String(absence.user_id);
  let moved = 0;

  // Completed duties are a record of what happened and are left alone.
  const rows = (await query(
    `SELECT id, user_role FROM clinic_duty_logs
     WHERE user_id = $1 AND status <> 'completed'
       AND assigned_date BETWEEN $2 AND $3`,
    [uid, absence.start_date, absence.end_date]
  )).rows;

  for (const row of rows) {
    const grade = normaliseGrade(row.user_role || absence.user_role);
    const cover = await pickCover(grade, [uid]);
    if (!cover) continue;

    const person = (await query(
      `SELECT full_name FROM users WHERE id::text = $1 LIMIT 1`, [cover]
    )).rows[0] || {};

    await query(
      `UPDATE clinic_duty_logs SET user_id = $1, user_name = $2, updated_at = NOW() WHERE id = $3`,
      [cover, person.full_name || null, row.id]
    );
    await ledger(absence.id, 'clinic_duty', row.id, 'user_id', uid, cover);
    moved++;
  }
  return moved;
}

function normaliseGrade(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('consultant')) return 'consultant';
  if (r.includes('senior')) return 'senior_registrar';
  if (r.includes('registrar')) return 'registrar';
  return 'house_officer';
}

/** Start an absence: move patients and duties to cover. Idempotent. */
export async function activateAbsence(absenceId) {
  await ensureAbsenceTables();
  const absence = (await query(`SELECT * FROM staff_absences WHERE id = $1`, [absenceId])).rows[0];
  if (!absence) throw new Error(`Absence ${absenceId} not found`);
  if (absence.status === 'active') return { alreadyActive: true };
  if (absence.status !== 'scheduled') throw new Error(`Absence ${absenceId} is ${absence.status}`);

  // Mark active BEFORE moving anything: pickCover consults the same flag to
  // avoid handing this person's work straight back to them.
  await query(
    `UPDATE staff_absences SET status = 'active', activated_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [absenceId]
  );
  const live = { ...absence, status: 'active' };

  const patients = await reassignPatients(live);
  const callDuties = await reassignCallDuties(live);
  const clinicDuties = await reassignClinicDuties(live);

  await query(
    `UPDATE staff_absences
     SET patients_reassigned = $1, call_duties_reassigned = $2, clinic_duties_reassigned = $3, updated_at = NOW()
     WHERE id = $4`,
    [patients, callDuties, clinicDuties, absenceId]
  );

  return { patients, callDuties, clinicDuties };
}

// ── Completion: give the work back, then level up ──────────────────────────

/**
 * End an absence. Patients that were moved away come back where the patient is
 * still admitted; duties are NOT clawed back, because a colleague who has
 * already covered a shift should not have it silently removed from their record.
 */
export async function completeAbsence(absenceId, { levelUp = true } = {}) {
  await ensureAbsenceTables();
  const absence = (await query(`SELECT * FROM staff_absences WHERE id = $1`, [absenceId])).rows[0];
  if (!absence) throw new Error(`Absence ${absenceId} not found`);
  if (absence.status === 'completed') return { alreadyCompleted: true };

  const uid = String(absence.user_id);
  const moves = (await query(
    `SELECT * FROM absence_reassignments
     WHERE absence_id = $1 AND restored = FALSE AND entity_type = 'patient_assignment'`,
    [absenceId]
  )).rows;

  let restored = 0;
  for (const m of moves) {
    // Only restore where the cover is still the holder. If the patient has since
    // been reassigned again — discharged and readmitted, another absence — that
    // later decision is more current than this one and must not be overwritten.
    const row = (await query(
      `SELECT id, ${m.role_column} AS holder, is_active FROM patient_assignments WHERE id = $1`,
      [m.entity_id]
    )).rows[0];

    if (row && row.is_active && String(row.holder) === String(m.to_user_id)) {
      await query(
        `UPDATE patient_assignments
         SET ${m.role_column} = $1, reassigned_at = NOW(), reassigned_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [uid, `Returned from ${absence.absence_type} (absence #${absenceId})`, m.entity_id]
      );
      restored++;
    }
    await query(
      `UPDATE absence_reassignments SET restored = TRUE, restored_at = NOW() WHERE id = $1`, [m.id]
    );
  }

  await query(
    `UPDATE staff_absences
     SET status = 'completed', completed_at = NOW(), patients_restored = $1, updated_at = NOW()
     WHERE id = $2`,
    [restored, absenceId]
  );

  // Admissions that arrived during the absence went to colleagues, so the
  // returning person can still be light. Level the grade back out.
  let levelled = 0;
  if (levelUp) levelled = await levelGrade(normaliseGrade(absence.user_role));

  return { restored, levelled };
}

/**
 * Even out one grade's patient load across all active, non-absent staff.
 * Moves from the most-loaded to the least-loaded until no one is more than one
 * patient above target.
 */
export async function levelGrade(grade) {
  const col = ROLE_COLUMN[grade];
  if (!col) return 0;

  const absent = await getAbsentUserIds();
  const staff = (await query(
    `SELECT u.id::text AS id FROM users u
     WHERE u.is_active = TRUE AND u.is_approved = TRUE AND u.role = ANY($1::text[])`,
    [gradeRoleKeys(grade)]
  )).rows.map(r => r.id).filter(id => !absent.includes(id));

  if (staff.length < 2) return 0;

  const loadRows = (await query(
    `SELECT ${col}::text AS id, COUNT(*)::int AS n
     FROM patient_assignments WHERE is_active = TRUE AND ${col} IS NOT NULL
     GROUP BY ${col}`
  )).rows;
  const load = new Map(staff.map(id => [id, 0]));
  for (const r of loadRows) if (load.has(r.id)) load.set(r.id, r.n);

  const total = [...load.values()].reduce((s, n) => s + n, 0);
  const base = Math.floor(total / staff.length);
  let remainder = total % staff.length;

  const sorted = [...load.entries()].sort((a, b) => b[1] - a[1]);
  const target = new Map();
  sorted.forEach(([id]) => { target.set(id, base + (remainder-- > 0 ? 1 : 0)); });

  let moved = 0;
  const receivers = sorted.filter(([id, n]) => n < target.get(id))
    .flatMap(([id, n]) => Array.from({ length: target.get(id) - n }, () => id));
  let ri = 0;

  for (const [id, n] of sorted) {
    const give = n - target.get(id);
    if (give <= 0) continue;
    const rows = (await query(
      `SELECT id FROM patient_assignments
       WHERE is_active = TRUE AND ${col} = $1
       ORDER BY assigned_at DESC NULLS LAST, id DESC LIMIT $2`,
      [id, give]
    )).rows;
    for (const row of rows) {
      const to = receivers[ri++];
      if (!to) break;
      await query(
        `UPDATE patient_assignments SET ${col} = $1, reassigned_at = NOW(),
         reassigned_reason = 'Levelled after absence', updated_at = NOW() WHERE id = $2`,
        [to, row.id]
      );
      moved++;
    }
  }
  return moved;
}

// ── Lazy scheduler ─────────────────────────────────────────────────────────

let lastRun = 0;
const THROTTLE_MS = 60_000;

/**
 * Activate absences that have started and complete those that have ended.
 *
 * Called from API handlers rather than a cron (see the header note). Throttled
 * per warm instance and safe to call concurrently: activateAbsence and
 * completeAbsence both re-read status and no-op if another request got there
 * first. Never throws — absence processing must not take an endpoint down.
 */
export async function processDueAbsences({ force = false } = {}) {
  if (!force && Date.now() - lastRun < THROTTLE_MS) return { skipped: true };
  lastRun = Date.now();

  const result = { activated: 0, completed: 0, errors: [] };
  try {
    await ensureAbsenceTables();

    const toStart = (await query(
      `SELECT id FROM staff_absences
       WHERE status = 'scheduled' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE`
    )).rows;
    for (const a of toStart) {
      try { await activateAbsence(a.id); result.activated++; }
      catch (e) { result.errors.push(`activate ${a.id}: ${e.message}`); }
    }

    const toEnd = (await query(
      `SELECT id FROM staff_absences WHERE status = 'active' AND end_date < CURRENT_DATE`
    )).rows;
    for (const a of toEnd) {
      try { await completeAbsence(a.id); result.completed++; }
      catch (e) { result.errors.push(`complete ${a.id}: ${e.message}`); }
    }

    // A scheduled absence whose window passed entirely without ever activating
    // (nobody hit the API during it) would otherwise sit scheduled forever.
    await query(
      `UPDATE staff_absences SET status = 'completed', completed_at = NOW(), updated_at = NOW()
       WHERE status = 'scheduled' AND end_date < CURRENT_DATE`
    );
  } catch (e) {
    result.errors.push(e.message);
  }
  return result;
}
