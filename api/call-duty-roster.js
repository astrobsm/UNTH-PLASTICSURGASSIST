// Call-Duty Roster API — server-authoritative persistence so the roster and the
// on-call team are consistent across ALL devices (previously reads were local-only,
// so a device that didn't generate saw nothing). Actions via ?action= on the base
// route (no subpath rewrite needed):
//   GET  ?action=on-call&date=YYYY-MM-DD   -> the shift covering that date (auto-
//                                             generates a rolling roster if none)
//   GET  ?action=range&start=&end=         -> shifts within a range (+ month_key)
//   GET  ?action=keys                      -> saved roster keys
//   POST ?action=generate  {start,end}     -> generate + persist (admin), returns shifts
//   PUT  ?action=shift     {id, ...fields} -> edit one shift (admin)
//   DELETE ?action=roster&key=             -> delete a roster
import { query } from './_lib/db.js';
import { cors, authenticateRequest } from './_lib/auth.js';
import { coverRosterVacancies } from './_lib/teamAssignment.js';
import { rolesForGrade } from './_lib/roles.js';

// Fallback only — the live role→grade mapping comes from the staff_roles
// registry, so a unit-defined role that rosters as a registrar is picked up here
// without a code change.
const FALLBACK_ROLE_POOLS = {
  consultant: ['consultant'],
  senior_registrar: ['senior_registrar'],
  registrar: ['registrar', 'junior_registrar'],
  house_officer: ['house_officer'],
};

// Senior registrars hold call in BLOCKS rather than swapping every shift: 4
// consecutive 48-hour shifts = 8 days, so a block never splits a shift between
// two senior registrars. Everyone else still rotates shift by shift.
const SR_SHIFTS_PER_BLOCK = 4;

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
    await ensureColumns();
    switch (req.method) {
      case 'GET':
        if (action === 'on-call') return await getOnCall(url.searchParams, res);
        if (action === 'keys') return await getKeys(res);
        return await getRange(url.searchParams, res); // default: range
      case 'POST':
        if (!isAdmin) return denyNonAdmin();
        if (action === 'generate') return await generate(req.body, auth.user, res);
        return res.status(400).json({ error: 'Unknown action' });
      case 'PUT':
        if (!isAdmin) return denyNonAdmin();
        return await updateShift(req.body, res);
      case 'DELETE':
        if (!isAdmin) return denyNonAdmin();
        return await deleteRoster(url.searchParams, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (e) {
    console.error('call-duty-roster error:', e);
    return res.status(500).json({ error: 'Internal server error', message: e.message });
  }
}

let columnsEnsured = false;
async function ensureColumns() {
  if (columnsEnsured) return;
  const stmts = [
    `consultant_id TEXT`, `consultant_name TEXT`, `consultant_phone TEXT`,
    `senior_registrar_phone TEXT`, `registrar_phone TEXT`,
    `ho_ward_id TEXT`, `ho_ward_name TEXT`, `ho_ward_phone TEXT`,
    `ho_emergency_id TEXT`, `ho_emergency_name TEXT`, `ho_emergency_phone TEXT`,
    `ho_off_id TEXT`, `ho_off_name TEXT`, `ho_off_phone TEXT`,
    `ho_count INTEGER DEFAULT 0`, `status VARCHAR(50) DEFAULT 'active'`,
  ];
  for (const s of stmts) {
    const col = s.split(' ')[0];
    try { await query(`ALTER TABLE call_duty_roster ADD COLUMN IF NOT EXISTS ${col} ${s.slice(col.length + 1)}`); }
    catch (e) { console.warn('ensureColumns skip', col, e.message); }
  }
  columnsEnsured = true;
}

// ── Staff pools ─────────────────────────────────────────────────────────────
async function pool(roleKey) {
  let roles = FALLBACK_ROLE_POOLS[roleKey];
  try {
    const fromRegistry = await rolesForGrade(roleKey);
    if (fromRegistry && fromRegistry.length) roles = fromRegistry;
  } catch (e) {
    console.warn(`pool(${roleKey}) using fallback roles:`, e.message);
  }
  const r = await query(
    `SELECT id::text AS id, full_name, phone
       FROM users
      WHERE role = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE
      ORDER BY id`,
    [roles]
  );
  return r.rows.map(u => ({ id: u.id, full_name: u.full_name || 'TBD', phone: u.phone || '' }));
}

// ── Live staff resolution ───────────────────────────────────────────────────
// A roster row is a SNAPSHOT of who was on call when it was generated. Names and
// phones stored there go stale: deactivate a house officer and, until the roster
// is regenerated, the row still carries their name/phone. Clients cannot be
// relied on to filter this out — they need the full staff directory loaded to do
// it, and when that fetch fails (offline, slow mobile) they fall back to showing
// the stored name. So every read resolves the stored ids against the users table
// here: active staff get their CURRENT name/phone, and anyone deactivated,
// unapproved or deleted is blanked and flagged `<slot>_inactive` for the UI.
const SHIFT_SLOTS = [
  { id: 'consultant_id', name: 'consultant_name', phone: 'consultant_phone', flag: 'consultant_inactive' },
  { id: 'senior_registrar_id', name: 'senior_registrar_name', phone: 'senior_registrar_phone', flag: 'senior_registrar_inactive' },
  { id: 'registrar_id', name: 'registrar_name', phone: 'registrar_phone', flag: 'registrar_inactive' },
  { id: 'house_officer_id', name: 'house_officer_name', phone: null, flag: 'house_officer_inactive' },
  { id: 'ho_ward_id', name: 'ho_ward_name', phone: 'ho_ward_phone', flag: 'ho_ward_inactive' },
  { id: 'ho_emergency_id', name: 'ho_emergency_name', phone: 'ho_emergency_phone', flag: 'ho_emergency_inactive' },
  { id: 'ho_off_id', name: 'ho_off_name', phone: 'ho_off_phone', flag: 'ho_off_inactive' },
];

// Placeholders that mean "nobody assigned" rather than a stale real person.
const PLACEHOLDER_NAMES = new Set(['', 'tbd', 'off', 'none', 'n/a', '-']);

async function hydrateShifts(rows) {
  if (!rows || rows.length === 0) return rows || [];
  const ids = new Set();
  for (const row of rows) {
    for (const slot of SHIFT_SLOTS) {
      const v = row[slot.id];
      if (v !== null && v !== undefined && String(v).trim() !== '') ids.add(String(v).trim());
    }
  }
  // Compare as text: the roster stores ids in TEXT columns, so matching on
  // id::text works whatever type users.id happens to be and cannot blow up on a
  // malformed value the way a numeric cast would (which would silently mark the
  // whole team deactivated). The users table is small, so the seq scan is fine.
  const live = new Map();
  const lookup = [...ids];
  if (lookup.length) {
    const r = await query(
      `SELECT id::text AS id, full_name, phone
         FROM users
        WHERE id::text = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE`,
      [lookup]
    );
    for (const u of r.rows) live.set(String(u.id), u);
  }

  return rows.map(row => {
    const out = { ...row };
    for (const slot of SHIFT_SLOTS) {
      const rawId = row[slot.id] === null || row[slot.id] === undefined ? '' : String(row[slot.id]).trim();
      const storedName = (row[slot.name] || '').trim();
      const isOffSlot = slot.id === 'ho_off_id';
      if (rawId) {
        const u = live.get(rawId);
        if (u) {
          // Still active — refresh from the directory so renames and new phone
          // numbers show without regenerating the roster.
          out[slot.name] = u.full_name || 'TBD';
          if (slot.phone) out[slot.phone] = u.phone || '';
        } else {
          out[slot.id] = '';
          out[slot.name] = isOffSlot ? 'Off' : 'TBD';
          if (slot.phone) out[slot.phone] = '';
          out[slot.flag] = true;
        }
      } else if (storedName && !PLACEHOLDER_NAMES.has(storedName.toLowerCase())) {
        // Id already cleared (deactivation) but the name/phone were left behind
        // by an older blanking pass — scrub them and flag the vacant slot.
        out[slot.name] = isOffSlot ? 'Off' : 'TBD';
        if (slot.phone) out[slot.phone] = '';
        out[slot.flag] = true;
      }
    }
    return out;
  });
}

// ── Roster generation (round-robin per 48h shift) ───────────────────────────
function rosterKey(start, end) {
  const d = (x) => new Date(x).toISOString().slice(0, 10);
  return `${d(start)}_${d(end)}`;
}

/** Absence windows overlapping a date range, as Date objects for comparison. */
async function absencesOverlapping(startDate, endDate) {
  try {
    const r = await query(
      `SELECT user_id, start_date, end_date FROM staff_absences
       WHERE status IN ('scheduled','active') AND start_date <= $2 AND end_date >= $1`,
      [startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10)]
    );
    return r.rows.map(a => ({
      user_id: String(a.user_id),
      start: new Date(a.start_date),
      // An absence covers its whole end day, so extend to that day's last moment.
      end: new Date(new Date(a.end_date).getTime() + 86399999),
    }));
  } catch {
    // No absence table yet — roster generation must not stop.
    return [];
  }
}

async function generateShifts(startDate, endDate) {
  const [consultants, srs, regs, hos, absences] = await Promise.all([
    pool('consultant'), pool('senior_registrar'), pool('registrar'), pool('house_officer'),
    absencesOverlapping(startDate, endDate),
  ]);

  // Someone on leave must not be rostered for a shift that falls inside their
  // absence — the pool is drawn once for the whole range, so without this the
  // rotation happily lands on them weeks ahead. Checked per shift rather than
  // per range: a fortnight's leave should only remove them from the shifts it
  // actually covers.
  const availableDuring = (list, shiftStart, shiftEnd) =>
    list.filter(p => !absences.some(a =>
      String(a.user_id) === String(p.id) && a.start <= shiftEnd && a.end >= shiftStart
    ));

  const pick = (list, i) => (list.length ? list[i % list.length] : null);
  const shifts = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 8, 0, 0);
  const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 8, 0, 0);
  let n = 1, ci = 0, ri = 0, hi = 0;
  while (cursor < rangeEnd) {
    const shiftStart = new Date(cursor);
    const shiftEnd = new Date(shiftStart.getTime() + 48 * 3600 * 1000);
    // Senior registrars change every SR_SHIFTS_PER_BLOCK shifts (a weekly block
    // aligned to shift boundaries); the other grades rotate every shift.
    const si = Math.floor((n - 1) / SR_SHIFTS_PER_BLOCK);
    const availC = availableDuring(consultants, shiftStart, shiftEnd);
    const availSr = availableDuring(srs, shiftStart, shiftEnd);
    const availReg = availableDuring(regs, shiftStart, shiftEnd);
    const hosAvail = availableDuring(hos, shiftStart, shiftEnd);
    const hoCount = hosAvail.length;
    const hos_ = hosAvail;
    const c = pick(availC, ci), sr = pick(availSr, si), r = pick(availReg, ri);
    let hoW = null, hoE = null, hoO = null;
    if (hoCount >= 3) { hoW = hos_[hi % hoCount]; hoE = hos_[(hi + 1) % hoCount]; hoO = hos_[(hi + 2) % hoCount]; }
    else if (hoCount === 2) { hoW = hos_[hi % 2]; hoE = hos_[hi % 2]; hoO = hos_[(hi + 1) % 2]; }
    else if (hoCount === 1) { hoW = hos_[0]; hoE = hos_[0]; hoO = null; }
    shifts.push({
      start_date: shiftStart.toISOString(), end_date: shiftEnd.toISOString(),
      consultant_id: c?.id || '', consultant_name: c?.full_name || 'TBD', consultant_phone: c?.phone || '',
      senior_registrar_id: sr?.id || '', senior_registrar_name: sr?.full_name || 'TBD', senior_registrar_phone: sr?.phone || '',
      registrar_id: r?.id || '', registrar_name: r?.full_name || 'TBD', registrar_phone: r?.phone || '',
      house_officer_id: hoW?.id || '', house_officer_name: hoW?.full_name || 'TBD',
      ho_ward_id: hoW?.id || '', ho_ward_name: hoW?.full_name || 'TBD', ho_ward_phone: hoW?.phone || '',
      ho_emergency_id: hoE?.id || '', ho_emergency_name: hoE?.full_name || 'TBD', ho_emergency_phone: hoE?.phone || '',
      ho_off_id: hoO?.id || '', ho_off_name: hoO?.full_name || 'Off', ho_off_phone: hoO?.phone || '',
      ho_count: hoCount, shift_number: n,
    });
    ci++; ri++; hi++; n++;
    cursor.setDate(cursor.getDate() + 2);
  }
  return shifts;
}

const SHIFT_COLS = [
  'start_date', 'end_date', 'consultant_id', 'consultant_name', 'consultant_phone',
  'senior_registrar_id', 'senior_registrar_name', 'senior_registrar_phone',
  'registrar_id', 'registrar_name', 'registrar_phone',
  'house_officer_id', 'house_officer_name',
  'ho_ward_id', 'ho_ward_name', 'ho_ward_phone',
  'ho_emergency_id', 'ho_emergency_name', 'ho_emergency_phone',
  'ho_off_id', 'ho_off_name', 'ho_off_phone',
  'ho_count', 'month_key', 'shift_number', 'created_by', 'status',
];

async function persistRoster(shifts, key, createdBy) {
  await query(`DELETE FROM call_duty_roster WHERE month_key = $1`, [key]);
  for (const s of shifts) {
    const row = { ...s, month_key: key, created_by: createdBy || null, status: 'active' };
    const vals = SHIFT_COLS.map(c => row[c] ?? null);
    const ph = SHIFT_COLS.map((_, i) => `$${i + 1}`).join(', ');
    await query(`INSERT INTO call_duty_roster (${SHIFT_COLS.join(', ')}) VALUES (${ph})`, vals);
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
  await persistRoster(shifts, key, user?.id);
  const saved = await query(`SELECT * FROM call_duty_roster WHERE month_key = $1 ORDER BY shift_number`, [key]);
  return res.status(200).json({ month_key: key, shifts: await hydrateShifts(saved.rows) });
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
  let r = await query(
    `SELECT * FROM call_duty_roster WHERE $1 >= start_date AND $1 < end_date
      ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`, [noon]
  );
  if (r.rows.length === 0) {
    // Auto-generate a rolling roster covering the date (month start → +60 days).
    await autoGenerate(new Date(noon));
    r = await query(
      `SELECT * FROM call_duty_roster WHERE $1 >= start_date AND $1 < end_date
        ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`, [noon]
    );
  }
  let [shift] = await hydrateShifts(r.rows);

  // Self-heal vacant duties. Historical deactivations left slots empty (and the
  // fix that clears a departing person's slot leaves one too when nobody covers
  // it yet), which showed up as "Reassign — staff deactivated" on the on-call
  // card. Cover them with an active colleague of the same grade the first time
  // anyone reads the roster. Fill-only: an active person's shift is never moved,
  // so a generated roster is otherwise stable until an admin regenerates it.
  if (shift && hasVacancy(shift) && shouldRunCover()) {
    try {
      const cover = await coverRosterVacancies();
      if (cover.shiftsTouched > 0) {
        const again = await query(
          `SELECT * FROM call_duty_roster WHERE $1 >= start_date AND $1 < end_date
            ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`, [noon]
        );
        [shift] = await hydrateShifts(again.rows);
      }
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
let lastCoverAt = 0;
const COVER_MIN_INTERVAL_MS = 60_000;
function shouldRunCover() {
  const now = Date.now();
  if (now - lastCoverAt < COVER_MIN_INTERVAL_MS) return false;
  lastCoverAt = now;
  return true;
}

async function autoGenerate(dateObj) {
  const start = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 60);
  const key = rosterKey(start, end);
  const existing = await query(`SELECT 1 FROM call_duty_roster WHERE month_key = $1 LIMIT 1`, [key]);
  if (existing.rows.length) return;
  const shifts = await generateShifts(start, end);
  if (shifts.length) await persistRoster(shifts, key, null);
}

async function getKeys(res) {
  const r = await query(`SELECT DISTINCT month_key FROM call_duty_roster ORDER BY month_key`);
  return res.status(200).json({ keys: r.rows.map(x => x.month_key) });
}

async function updateShift(body, res) {
  const b = typeof body === 'string' ? JSON.parse(body) : (body || {});
  if (!b.id) return res.status(400).json({ error: 'shift id is required' });
  const editable = SHIFT_COLS.filter(c => c !== 'month_key' && c !== 'shift_number' && c !== 'created_by');
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
