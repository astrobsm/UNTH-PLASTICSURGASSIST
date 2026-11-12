// ============================================================================
// Duty chase & commendation.
//
// For each house officer, registrar and senior registrar, over a period:
// what was expected, what is recorded, and what is missing — then a WhatsApp
// message that either chases the misses or commends a clean record.
//
// Built only from records the app already keeps (no new tracking):
//   Monday/Friday written review  — every admitted patient a doctor holds
//       (patient_assignments) needs a ward-round note by that doctor on each
//       Monday and Friday; the expectation the weekly duty reminder states.
//   HO morning round 07:00–09:00  — morningRounds.morningCompliance.
//   Clinic duties                 — clinic_duty_logs marked missed/completed.
//   Assigned duties               — duty_assignments past due and not done.
//   Ward-round notes, call shifts — counted for the commendation.
// Leave (staff_absences) days are neither expected nor missed. Patients are
// taken from today's assignments, counted from their care start date.
//
// Nothing is sent from the server: the app opens WhatsApp (wa.me) with the
// message and records who sent what, as the duty reminders do.
// ============================================================================
import { query } from './db.js';
import { ensureRecordStatus, notInError } from './clinicalRecords.js';
import { loadAdmittedAssignments, loadCareStaff, unitToday } from './dutyReminder.js';
import { absenceRanges, morningCompliance } from './morningRounds.js';
import { dayNumberFromYmd, ymdFromDayNumber } from './unitCallPattern.js';
import { whatsAppLink } from './messaging.js';

export const CHASE_GRADES = ['senior_registrar', 'registrar', 'house_officer'];
const GRADE_LABEL = { senior_registrar: 'Senior Registrar', registrar: 'Registrar', house_officer: 'House Officer' };
const GRADE_COL = { senior_registrar: 'senior_registrar_id', registrar: 'registrar_id', house_officer: 'house_officer_id' };
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const pretty = (ymd) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${ymd}T00:00:00Z`));
const toYmd = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Default period: the last 7 completed days (yesterday back six days). */
export function defaultPeriod(now = new Date()) {
  const today = dayNumberFromYmd(unitToday(now));
  return { from: ymdFromDayNumber(today - 7), to: ymdFromDayNumber(today - 1) };
}

export function validPeriod(from, to, now = new Date()) {
  if (!YMD.test(String(from || '')) || !YMD.test(String(to || ''))) return defaultPeriod(now);
  const a = dayNumberFromYmd(from), b = dayNumberFromYmd(to);
  const today = dayNumberFromYmd(unitToday(now));
  const end = Math.min(b, today - 1); // today is still in progress
  if (end < a || a < today - 62) return defaultPeriod(now);
  return { from: ymdFromDayNumber(a), to: ymdFromDayNumber(end) };
}

/** Mondays and Fridays (as YYYY-MM-DD) within the period. */
export function reviewDays(from, to) {
  const out = [];
  for (let d = dayNumberFromYmd(from); d <= dayNumberFromYmd(to); d++) {
    const wd = new Date(d * 86_400_000).getUTCDay();
    if (wd === 1 || wd === 5) out.push(ymdFromDayNumber(d));
  }
  return out;
}

/**
 * Per-person record. Pure given its inputs, so it is testable without a DB.
 * @param person   {id, full_name, grade, phone}
 * @param ctx      {from, to, assignments, roundsSet, absences, morning, clinic, overdue, completedDuties, notes, calls}
 */
export function assessPerson(person, ctx) {
  const col = GRADE_COL[person.grade];
  const id = String(person.id);
  const held = ctx.assignments.filter(a => String(a[col] ?? '') === id);
  const absentDay = (ymd) => (ctx.absences || []).some(r => { const n = dayNumberFromYmd(ymd); return n >= r.from && n <= r.to; });

  const reviewMisses = [];
  let reviewsExpected = 0, reviewsDone = 0;
  for (const day of reviewDays(ctx.from, ctx.to)) {
    if (absentDay(day)) continue;
    for (const a of held) {
      const start = a.care_start_date ? toYmd(a.care_start_date) : null;
      if (start && start > day) continue;
      reviewsExpected++;
      if (ctx.roundsSet.has(`${id}|${a.patient_id}|${day}`)) reviewsDone++;
      else reviewMisses.push({ day, patient: `${String(a.hospital_number || '').trim() || 'patient'}${a.ward_location ? ` (${a.ward_location}${a.bed_number ? `, bed ${a.bed_number}` : ''})` : ''}` });
    }
  }

  const m = ctx.morning || { expected: 0, done: 0, days: [] };
  const mDays = (m.days || []).filter(d => d.day >= ctx.from && d.day <= ctx.to);
  const morning = mDays.reduce((s, d) => ({ expected: s.expected + d.expected, done: s.done + d.done, missed: s.missed + d.missed, late: s.late + d.late, no_folder: s.no_folder + d.no_folder }),
    { expected: 0, done: 0, missed: 0, late: 0, no_folder: 0 });
  const morningBadDays = mDays.filter(d => d.missed || d.late || d.no_folder).map(d => d.day);

  const clinicMissed = (ctx.clinic || []).filter(c => c.status === 'missed');
  const clinicDone = (ctx.clinic || []).filter(c => c.status === 'completed' || c.status === 'done').length;
  const overdue = ctx.overdue || [];

  const misses = reviewMisses.length + morning.missed + morning.late + morning.no_folder + clinicMissed.length + overdue.length;
  const activity = reviewsDone + morning.done + clinicDone + (ctx.completedDuties || 0) + (ctx.notes || 0) + (ctx.calls || 0);
  const verdict = misses > 0 ? 'chase' : activity > 0 ? 'commend' : 'no_record';

  return {
    id, name: person.full_name, grade: person.grade, gradeLabel: GRADE_LABEL[person.grade], phone: person.phone || null,
    patientsHeld: held.length, verdict,
    reviews: { expected: reviewsExpected, done: reviewsDone, missed: reviewMisses },
    morning: person.grade === 'house_officer' ? { ...morning, badDays: morningBadDays } : null,
    clinic: { missed: clinicMissed.map(c => ({ duty: c.duty_type || 'Clinic duty', day: toYmd(c.assigned_date) })), done: clinicDone },
    overdue: overdue.map(o => ({ title: o.title, due: toYmd(o.due_at) })),
    completedDuties: ctx.completedDuties || 0, notes: ctx.notes || 0, calls: ctx.calls || 0,
  };
}

/** WhatsApp text for one person. */
export function composeChaseMessage(r, { from, to, senderName }) {
  const period = `${pretty(from)} – ${pretty(to)}`;
  const good = [
    r.reviews.done && `${plural(r.reviews.done, 'Monday/Friday review')} documented`,
    r.morning?.done && `${r.morning.done}/${r.morning.expected} morning-round reviews on time`,
    r.notes && `${plural(r.notes, 'ward-round note')}`,
    r.clinic.done && `${plural(r.clinic.done, 'clinic duty', 'clinic duties')} completed`,
    r.completedDuties && `${plural(r.completedDuties, 'assigned duty', 'assigned duties')} completed`,
    r.calls && `${plural(r.calls, 'call shift')}`,
  ].filter(Boolean);
  const sign = senderName ? `\n\n— ${senderName}` : '';
  const head = `Dear Dr ${String(r.name || '').trim()},\n`;

  if (r.verdict === 'commend') {
    return `${head}Well done — your duties for ${period} are fully recorded in the Plastic Surgery app.\n\n${good.map(g => `✅ ${g}`).join('\n')}\n\nThank you for keeping the patients' records complete and on time. Keep it up!${sign}`;
  }
  const lines = [];
  if (r.reviews.missed.length) {
    const byDay = {};
    for (const x of r.reviews.missed) (byDay[x.day] ||= []).push(x.patient);
    lines.push(`• Monday/Friday written review not documented (${r.reviews.missed.length} of ${r.reviews.expected}):\n${Object.entries(byDay).map(([d, ps]) => `   ${pretty(d)}: ${ps.slice(0, 8).join('; ')}${ps.length > 8 ? ` and ${ps.length - 8} more` : ''}`).join('\n')}`);
  }
  if (r.morning && (r.morning.missed || r.morning.late || r.morning.no_folder)) {
    lines.push(`• Morning round (07:00–09:00): ${[r.morning.missed && `${r.morning.missed} missed`, r.morning.late && `${r.morning.late} late`, r.morning.no_folder && `${r.morning.no_folder} without folder update`].filter(Boolean).join(', ')} — on ${r.morning.badDays.map(pretty).join(', ')}`);
  }
  if (r.clinic.missed.length) lines.push(`• Clinic duties marked missed: ${r.clinic.missed.map(c => `${c.duty} (${pretty(c.day)})`).join('; ')}`);
  if (r.overdue.length) lines.push(`• Assigned duties overdue: ${r.overdue.map(o => `${o.title} (due ${pretty(o.due)})`).join('; ')}`);
  return `${head}Duty reminder — Plastic Surgery, ${period}. The following are not recorded in the app:\n\n${lines.join('\n')}\n\nPlease complete and document these today. If a record is wrong, let your senior know so it can be corrected.${good.length ? `\n\nThank you for what is recorded: ${good.join(', ')}.` : ''}${sign}`;
}

/** Everyone's record for the period. */
export async function buildDutyChase({ from, to, senderName = '', now = new Date() } = {}) {
  const period = validPeriod(from, to, now);
  const staff = (await loadCareStaff()).filter(s => CHASE_GRADES.includes(s.grade));
  const assignments = await loadAdmittedAssignments();
  await ensureRecordStatus('ward_rounds').catch(() => {});
  const rounds = (await query(
    `SELECT user_id::text AS uid, patient_id::text AS pid, TO_CHAR(round_date, 'YYYY-MM-DD') AS day
       FROM ward_rounds WHERE round_date BETWEEN $1::date AND $2::date AND ${notInError()}`,
    [period.from, period.to])).rows;
  const roundsSet = new Set(rounds.map(x => `${x.uid}|${x.pid}|${x.day}`));
  const notesBy = {};
  for (const x of rounds) notesBy[x.uid] = (notesBy[x.uid] ?? 0) + 1;

  const ids = staff.map(s => String(s.id));
  const safe = async (sql, params) => { try { return (await query(sql, params)).rows; } catch { return []; } };
  const clinic = await safe(`SELECT user_id::text AS uid, duty_type, status, assigned_date FROM clinic_duty_logs
     WHERE user_id::text = ANY($1::text[]) AND assigned_date >= $2 AND assigned_date <= $3`, [ids, period.from, `${period.to}T23:59:59`]);
  const overdue = await safe(`SELECT user_id::text AS uid, title, due_at FROM duty_assignments
     WHERE user_id::text = ANY($1::text[]) AND due_at < NOW() AND due_at::date >= $2::date AND COALESCE(status, 'pending') NOT IN ('completed', 'cancelled')`, [ids, period.from]);
  const completed = await safe(`SELECT user_id::text AS uid, COUNT(*)::int AS n FROM duty_assignments
     WHERE user_id::text = ANY($1::text[]) AND status = 'completed' AND COALESCE(completed_at, due_at)::date BETWEEN $2::date AND $3::date GROUP BY 1`, [ids, period.from, period.to]);
  const calls = await safe(`SELECT x.uid, COUNT(*)::int AS n FROM (
       SELECT senior_registrar_id::text AS uid FROM call_duty_roster WHERE start_date >= $1 AND start_date <= $2
       UNION ALL SELECT registrar_id::text FROM call_duty_roster WHERE start_date >= $1 AND start_date <= $2
       UNION ALL SELECT house_officer_id::text FROM call_duty_roster WHERE start_date >= $1 AND start_date <= $2) x
     WHERE x.uid IS NOT NULL GROUP BY x.uid`, [period.from, `${period.to}T23:59:59`]);
  const countOf = (rows, uid) => rows.find(r => r.uid === uid)?.n ?? 0;

  const people = [];
  for (const s of staff) {
    const sid = String(s.id);
    const morning = s.grade === 'house_officer' ? await morningCompliance(s.id, { since: period.from, now }).catch(() => null) : null;
    const r = assessPerson(s, {
      from: period.from, to: period.to, assignments, roundsSet, absences: await absenceRanges(s.id), morning,
      clinic: clinic.filter(c => c.uid === sid), overdue: overdue.filter(o => o.uid === sid),
      completedDuties: countOf(completed, sid), notes: notesBy[sid] ?? 0, calls: countOf(calls, sid),
    });
    const message = r.verdict === 'no_record' ? '' : composeChaseMessage(r, { ...period, senderName });
    people.push({ ...r, message, whatsappLink: message && r.phone ? whatsAppLink(r.phone, message) : null });
  }
  const order = { chase: 0, commend: 1, no_record: 2 };
  people.sort((a, b) => order[a.verdict] - order[b.verdict] || CHASE_GRADES.indexOf(a.grade) - CHASE_GRADES.indexOf(b.grade) || String(a.name).localeCompare(String(b.name)));
  return { ...period, reviewDays: reviewDays(period.from, period.to), people };
}
