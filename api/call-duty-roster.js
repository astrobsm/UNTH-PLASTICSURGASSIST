// Call-Duty Roster API — server-authoritative persistence so the roster and the
// on-call team are consistent across ALL devices (previously reads were local-only,
// so a device that didn't generate saw nothing). Actions via ?action= on the base
// route (no subpath rewrite needed):
//   GET  ?action=on-call&date=YYYY-MM-DD   -> the shift covering that date (auto-
//                                             generates a rolling roster if none)
//   GET  ?action=range&start=&end=         -> shifts within a range (+ month_key)
//   GET  ?action=keys                      -> saved roster keys
//   GET  ?action=unit-config               -> the unit call-pattern configuration
//   POST ?action=generate  {start,end}     -> generate + persist (admin), returns shifts
//   PUT  ?action=shift     {id, ...fields} -> edit one shift (admin)
//   PUT  ?action=unit-config {anchor_date, units} -> save the unit configuration (admin)
//   DELETE ?action=unit-config             -> back to the 48-hour rotation (admin)
//   DELETE ?action=roster&key=             -> delete a roster
//
// Generation, persistence and the on-call lookup live in _lib/callRoster.js,
// which the consults module shares to route each consult to the team on call.
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { coverRosterVacancies, applyUnitMembershipIfChanged, applyUnitMembership, alignRecentAdmissions } from './_lib/teamAssignment.js';
import { ensureMorningSnapshot } from './_lib/morningRounds.js';
import {
  ensureRosterColumns, rosterKey, generateShifts, persistRoster, hydrateShifts, findShiftAt,
  getUnitConfig, saveUnitConfig, clearUnitConfig, EDITABLE_SHIFT_COLS,
} from './_lib/callRoster.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || (req.body && req.body.action);

  // Roster writes were completely ungated: any authenticated user could
  // regenerate the roster — whose first statement is a DELETE of the whole
  // month_key — or wipe it outright, which also misroutes every subsequent
  // auto-admitted consult, since teamAssignment.js reads this table to pick
  // the on-call team.
  //
  // Restricted to senior clinical staff rather than strictly admin: CallDutyPage
  // exposes Generate and Edit to every user with no UI role check, so an
  // admin-only rule would start 403-ing consultants and senior registrars who
  // manage the roster today. This still keeps it out of reach of house officers
  // and self-registered student accounts.
  //
  // NOTE: GET is intentionally left open — the roster auto-generates on the
  // read path (?action=on-call), and gating that would break on-call lookup
  // for everyone.
  const ROSTER_WRITE_ROLES = ['admin', 'super_admin', 'consultant', 'senior_registrar'];
  const isAdmin = ROSTER_WRITE_ROLES.includes(auth.user.role);
  const denyNonAdmin = () =>
    res.status(403).json({ error: 'Only consultants, senior registrars or administrators may modify the call-duty roster' });

  try {
    await ensureRosterColumns();
    switch (req.method) {
      case 'GET':
        if (action === 'on-call') return await getOnCall(url.searchParams, res);
        if (action === 'keys') return await getKeys(res);
        if (action === 'unit-config') return res.status(200).json({ config: await getUnitConfig() });
        return await getRange(url.searchParams, res); // default: range
      case 'POST':
        if (!isAdmin) return denyNonAdmin();
        if (action === 'generate') return await generate(req.body, auth.user, res);
        if (action === 'apply-units') return res.status(200).json({ applied: await applyUnitMembership() });
        return res.status(400).json({ error: 'Unknown action' });
      case 'PUT':
        if (!isAdmin) return denyNonAdmin();
        if (action === 'unit-config') return await putUnitConfig(req.body, auth.user, res);
        return await updateShift(req.body, res);
      case 'DELETE':
        if (!isAdmin) return denyNonAdmin();
        if (action === 'unit-config') {
          await clearUnitConfig();
          return res.status(200).json({ config: null });
        }
        return await deleteRoster(url.searchParams, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('call-duty-roster error:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}

// ── Handlers ────────────────────────────────────────────────────────────────
async function generate(body, user, res) {
  const b = typeof body === 'string' ? JSON.parse(body) : (body || {});
  if (!b.start || !b.end) return res.status(400).json({ error: 'start and end are required' });
  const start = new Date(b.start), end = new Date(b.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
    return res.status(400).json({ error: 'Invalid start/end range' });
  }
  const key = rosterKey(start, end);
  const shifts = await generateShifts(start, end);
  if (shifts.length === 0) return res.status(400).json({ error: 'No shifts generated for range' });
  // An explicit generation is authoritative for its period: it replaces any
  // other roster's shifts there instead of overlapping them.
  await persistRoster(shifts, key, user?.id, { supersede: true });
  const saved = await query(`SELECT * FROM call_duty_roster WHERE month_key = $1 ORDER BY shift_number`, [key]);
  return res.status(200).json({ month_key: key, shifts: await hydrateShifts(saved.rows) });
}

async function putUnitConfig(body, user, res) {
  const b = typeof body === 'string' ? JSON.parse(body) : (body || {});
  const result = await saveUnitConfig(b, user?.id);
  if (result.error) return res.status(400).json({ error: result.error });
  // Units run their own patients: hand any patient whose junior is no longer
  // in the patient's unit to that unit's doctor of the same grade.
  const applied = await applyUnitMembershipIfChanged();
  return res.status(200).json({ config: result.config, applied });
}

async function getRange(params, res) {
  const start = params.get('start'), end = params.get('end');
  if (start && end) {
    const key = rosterKey(new Date(start), new Date(end));
    const r = await query(`SELECT * FROM call_duty_roster WHERE month_key = $1 ORDER BY shift_number`, [key]);
    if (r.rows.length) return res.status(200).json({ month_key: key, shifts: await hydrateShifts(r.rows) });
    // No exact-key roster: fall back to any shifts overlapping the range.
    const noonStart = `${start.slice(0, 10)}T12:00:00.000Z`;
    const noonEnd = `${end.slice(0, 10)}T12:00:00.000Z`;
    const ov = await query(
      `SELECT * FROM call_duty_roster WHERE end_date > $1 AND start_date < $2 ORDER BY start_date, shift_number`,
      [noonStart, noonEnd]
    );
    return res.status(200).json({ month_key: key, shifts: await hydrateShifts(ov.rows) });
  }
  return res.status(400).json({ error: 'start and end are required' });
}

async function getOnCall(params, res) {
  const date = params.get('date') || new Date().toISOString().slice(0, 10);
  const noon = `${date.slice(0, 10)}T12:00:00.000Z`;
  // Auto-generates a rolling roster covering the date (month start → +60 days)
  // when none exists.
  let shift = await findShiftAt(noon);

  // Rotation dates pass without anyone saving anything, and there is no
  // scheduler — every open dashboard polls this, so it is the daily heartbeat
  // that moves patients to the incoming unit doctors after a rotation.
  if (shouldRunMembership()) {
    try { await applyUnitMembershipIfChanged(); }
    catch (e) { console.warn('getOnCall: unit membership skipped:', e.message); }
    // New admissions join their admitting unit's team.
    try { await alignRecentAdmissions(); }
    catch (e) { console.warn('getOnCall: admission alignment skipped:', e.message); }
    // Then freeze today's morning-round list (after any rotation, so it names
    // the incoming house officers).
    try { await ensureMorningSnapshot(); }
    catch (e) { console.warn('getOnCall: morning snapshot skipped:', e.message); }
  }

  // Self-heal vacant duties. Historical deactivations left slots empty (and the
  // fix that clears a departing person's slot leaves one too when nobody covers
  // it yet), which showed up as "Reassign — staff deactivated" on the on-call
  // card. Cover them with an active colleague of the same grade the first time
  // anyone reads the roster. Fill-only: an active person's shift is never moved,
  // so a generated roster is otherwise stable until an admin regenerates it.
  if (shift && hasVacancy(shift) && shouldRunCover()) {
    try {
      const cover = await coverRosterVacancies();
      if (cover.shiftsTouched > 0) shift = await findShiftAt(noon, { autoGenerate: false });
    } catch (e) {
      console.warn('getOnCall: roster cover skipped:', e.message);
    }
  }
  return res.status(200).json({ shift: shift || null, date });
}

const VACANCY_FLAGS = [
  'consultant_inactive', 'senior_registrar_inactive', 'registrar_inactive',
  'ho_ward_inactive', 'ho_emergency_inactive',
];
function hasVacancy(shift) {
  // ho_off is deliberately excluded — nobody being off duty is not a vacancy.
  return VACANCY_FLAGS.some(f => shift[f]);
}

// Every client polls the on-call card, so throttle the cover pass per instance:
// once the vacancies are filled the flags clear and it stops running anyway, but
// a vacancy no active colleague can fill must not re-scan on every poll.
let lastMembershipAt = 0;
function shouldRunMembership() {
  const now = Date.now();
  if (now - lastMembershipAt < 5 * 60_000) return false;
  lastMembershipAt = now;
  return true;
}

let lastCoverAt = 0;
const COVER_MIN_INTERVAL_MS = 60_000;
function shouldRunCover() {
  const now = Date.now();
  if (now - lastCoverAt < COVER_MIN_INTERVAL_MS) return false;
  lastCoverAt = now;
  return true;
}

async function getKeys(res) {
  const r = await query(`SELECT DISTINCT month_key FROM call_duty_roster ORDER BY month_key`);
  return res.status(200).json({ keys: r.rows.map(x => x.month_key) });
}

async function updateShift(body, res) {
  const b = typeof body === 'string' ? JSON.parse(body) : (body || {});
  if (!b.id) return res.status(400).json({ error: 'shift id is required' });
  const editable = EDITABLE_SHIFT_COLS;
  const sets = [], vals = [];
  for (const c of editable) {
    if (b[c] !== undefined) { vals.push(b[c]); sets.push(`${c} = $${vals.length}`); }
  }
  if (sets.length === 0) return res.status(400).json({ error: 'No editable fields provided' });
  vals.push(b.id);
  const r = await query(
    `UPDATE call_duty_roster SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${vals.length} RETURNING *`, vals
  );
  if (r.rows.length === 0) return res.status(404).json({ error: 'Shift not found' });
  const [shift] = await hydrateShifts(r.rows);
  return res.status(200).json({ shift });
}

async function deleteRoster(params, res) {
  const key = params.get('key');
  if (!key) return res.status(400).json({ error: 'key is required' });
  await query(`DELETE FROM call_duty_roster WHERE month_key = $1`, [key]);
  return res.status(200).json({ success: true });
}
