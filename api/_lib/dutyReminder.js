// ============================================================================
// Duty reminder composition.
//
// One place builds the message, server-side, so what a cron sends on Monday
// morning is exactly what an admin sees when they preview it in the app.
//
// Two kinds:
//   weekly — Monday and Friday, to everyone caring for admitted patients:
//            review each patient and upload the update.
//   daily  — to house officers: update every patient's status today.
// Both carry the person's admitted patients with ward, diagnosis and how long
// the patient has been under our care, and both repeat the consult-module
// expectation, because that is the thing most often missed.
// ============================================================================
import { query } from './db.js';
import { consultStartJoin, careStartColumns } from './careDuration.js';
import { rolesForGrade } from './roles.js';

export const CONSULT_CHECKS_PER_DAY = 3;
const APP_TIMEZONE = 'Africa/Lagos';

/** Local calendar date (YYYY-MM-DD) for the unit, not the server's zone. */
export function unitToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

/** Day-of-week in the unit's zone: 0=Sun … 5=Fri. */
export function unitWeekday(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(now);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

const prettyDate = (d) => new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
}).format(d);

/** Day 1 on the start date — the ward counts the arrival day as day one. */
function dayNumber(careStartDate, today = unitToday()) {
  if (!careStartDate) return null;
  // Accept both the 'YYYY-MM-DD' the API returns and a raw Date, since pg hands
  // back DATE columns as Date objects when a query doesn't cast them.
  const start = careStartDate instanceof Date
    ? `${careStartDate.getFullYear()}-${String(careStartDate.getMonth() + 1).padStart(2, '0')}-${String(careStartDate.getDate()).padStart(2, '0')}`
    : String(careStartDate).slice(0, 10);
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.floor(ms / 86_400_000)) + 1;
}

/**
 * Everyone's admitted patients in one query — the same resolution the dashboard
 * and the reminder preview use, so the three can never disagree.
 */
export async function loadAdmittedAssignments() {
  const r = await query(
    `SELECT pa.patient_id,
            COALESCE(NULLIF(pa.hospital_number, ''), p.hospital_number, adm.hospital_number) AS hospital_number,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), adm.patient_name) AS patient_name,
            pa.consultant_id, pa.senior_registrar_id, pa.registrar_id, pa.house_officer_id,
            adm.id AS admission_id,
            adm.ward AS ward_location,
            adm.bed_number,
            COALESCE(NULLIF(adm.provisional_diagnosis, ''), NULLIF(adm.admitting_diagnosis, ''),
                     NULLIF(adm.reasons_for_admission, '')) AS diagnosis,
            ${careStartColumns('adm')}
       FROM patient_assignments pa
       LEFT JOIN patients p ON p.id::text = pa.patient_id::text
       LEFT JOIN LATERAL (
         SELECT a.* FROM admissions a
          WHERE a.patient_id::text = pa.patient_id::text
            AND a.status IN ('active', 'admitted')
          ORDER BY a.admission_date DESC NULLS LAST, a.id DESC
          LIMIT 1
       ) adm ON TRUE
       ${consultStartJoin('p', 'adm')}
      WHERE pa.is_active = TRUE`
  );
  return r.rows.filter(row => !!row.admission_id);
}

/** Active staff who can hold patients, with the grade they roster as. */
export async function loadCareStaff() {
  const grades = ['consultant', 'senior_registrar', 'registrar', 'house_officer'];
  const byRole = {};
  for (const g of grades) {
    for (const key of await rolesForGrade(g)) byRole[key] = g;
  }
  const keys = Object.keys(byRole);
  if (keys.length === 0) return [];
  const r = await query(
    `SELECT id::text AS id, full_name, role, phone
       FROM users
      WHERE role = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE
        AND (app_id = 'psa' OR app_id IS NULL)
      ORDER BY full_name`,
    [keys]
  );
  return r.rows.map(u => ({ ...u, grade: byRole[u.role] }));
}

const ROLE_LABEL = {
  consultant_id: 'Consultant',
  senior_registrar_id: 'Senior Registrar',
  registrar_id: 'Registrar',
  house_officer_id: 'House Officer',
};

/** The patients a person holds, in ward order. */
export function patientsFor(userId, assignments) {
  const id = String(userId);
  const rows = [];
  for (const a of assignments) {
    const roles = Object.keys(ROLE_LABEL).filter(col => String(a[col] ?? '') === id).map(col => ROLE_LABEL[col]);
    if (roles.length === 0) continue;
    rows.push({
      hospitalNumber: String(a.hospital_number || '').trim() || '—',
      name: String(a.patient_name || '').trim() || 'Unknown',
      location: [a.ward_location, a.bed_number ? `Bed ${a.bed_number}` : ''].filter(Boolean).join(', ')
        || 'Ward not recorded',
      diagnosis: String(a.diagnosis || '').trim() || 'Diagnosis not recorded',
      careStart: a.care_start_date,
      careSource: a.care_start_source,
      roles,
    });
  }
  rows.sort((x, y) => x.location.localeCompare(y.location) || x.name.localeCompare(y.name));
  return rows;
}

/**
 * Compose one person's reminder.
 * @param kind 'weekly' (Mon/Fri review) or 'daily' (house-officer status update)
 */
export function buildMessage({ staff, patients, kind = 'weekly', now = new Date() }) {
  const isHouseOfficer = staff.grade === 'house_officer';
  const lines = [];
  lines.push('*Plastic Surgery Unit — Duty Reminder*');
  lines.push(`${staff.full_name} (${String(staff.role || '').replace(/_/g, ' ')}) — ${prettyDate(now)}`);
  lines.push('');

  if (patients.length === 0) {
    lines.push('You have *no admitted patients* assigned at the moment.');
  } else {
    lines.push(`*Your admitted patients (${patients.length}):*`);
    patients.forEach((p, i) => {
      lines.push(`${i + 1}. ${p.name} (${p.hospitalNumber})`);
      lines.push(`    Location: ${p.location}`);
      lines.push(`    Diagnosis: ${p.diagnosis}`);
      const d = dayNumber(p.careStart, unitToday(now));
      if (d) {
        const because = p.careSource === 'consult' ? 'referred' : 'admitted';
        lines.push(`    Day ${d} under our care — ${because} ${String(p.careStart).slice(0, 10)}`);
      }
    });
  }

  lines.push('');
  lines.push('*What is expected:*');
  if (kind === 'daily') {
    lines.push('• Update every patient\'s status on the app *today*.');
    lines.push('• Full review and upload is due *every Monday and Friday*.');
  } else {
    lines.push('• Review each of the patients above and upload their updates to the app *today* (Monday and Friday).');
    if (isHouseOfficer) {
      lines.push('• As house officer, update every patient\'s status on the app *daily*.');
    } else {
      lines.push('• House officers on your team must update patient status daily — please confirm they have.');
    }
  }
  lines.push(`• Check the *Consults module at least ${CONSULT_CHECKS_PER_DAY} times a day*: acknowledge new consults, review them, and upload your findings and plan.`);
  lines.push('');
  lines.push('Please record what you do in the Clinic Day Log.');
  return lines.join('\n');
}

/**
 * Build every reminder due for this run.
 * weekly → everyone holding admitted patients; daily → house officers only.
 * People with no admitted patients are skipped: an empty list every morning
 * teaches people to ignore the message.
 */
export async function buildRun({ kind = 'weekly', now = new Date() } = {}) {
  const [assignments, staff] = await Promise.all([loadAdmittedAssignments(), loadCareStaff()]);
  const audience = kind === 'daily' ? staff.filter(s => s.grade === 'house_officer') : staff;
  const out = [];
  for (const s of audience) {
    const patients = patientsFor(s.id, assignments);
    if (patients.length === 0) continue;
    out.push({
      staff: s,
      patientCount: patients.length,
      message: buildMessage({ staff: s, patients, kind, now }),
    });
  }
  return out;
}

export default { buildRun, buildMessage, patientsFor, loadAdmittedAssignments, loadCareStaff, unitToday, unitWeekday };
