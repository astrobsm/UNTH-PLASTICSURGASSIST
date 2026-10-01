// ============================================================================
// Call-duty roster — generation, persistence and on-call lookup (shared).
//
// Lives here rather than in api/call-duty-roster.js because the consults module
// needs the same on-call lookup: a consult is routed to whoever is on call at
// the moment it arrives, and both must read the roster the same way.
//
// Two generators:
//   - Unit call pattern (api/_lib/unitCallPattern.js): daily 08:00 → 08:00
//     shifts, the two units alternating Mon–Tue / Wed–Thu / Fri–Sun. Used
//     whenever a unit configuration has been saved.
//   - Legacy 48-hour round-robin across all staff. Used until the units are
//     configured, so an existing deployment keeps a roster on day one.
// ============================================================================

import { query } from './db.js';
import { rolesForGrade } from './roles.js';
import {
  watDayNumber, ymdFromDayNumber, dayNumberFromYmd, callDayWindow, callDayNumberAt,
  callSlotForDay, rotationIndex, pickFrom, houseOfficerDuties, normaliseUnitConfig,
  effectiveUnits, nextRotationDay, ROTATING_GRADES,
} from './unitCallPattern.js';

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
// (Legacy 48-hour roster only.)
export const SR_SHIFTS_PER_BLOCK = 4;

let columnsEnsured = false;
export async function ensureRosterColumns() {
  if (columnsEnsured) return;
  const stmts = [
    `consultant_id TEXT`, `consultant_name TEXT`, `consultant_phone TEXT`,
    `senior_registrar_phone TEXT`, `registrar_phone TEXT`,
    `ho_ward_id TEXT`, `ho_ward_name TEXT`, `ho_ward_phone TEXT`,
    `ho_emergency_id TEXT`, `ho_emergency_name TEXT`, `ho_emergency_phone TEXT`,
    `ho_off_id TEXT`, `ho_off_name TEXT`, `ho_off_phone TEXT`,
    `ho_count INTEGER DEFAULT 0`, `status VARCHAR(50) DEFAULT 'active'`,
    `unit_key TEXT`, `unit_name TEXT`, `call_block TEXT`,
  ];
  for (const s of stmts) {
    const col = s.split(' ')[0];
    try { await query(`ALTER TABLE call_duty_roster ADD COLUMN IF NOT EXISTS ${col} ${s.slice(col.length + 1)}`); }
    catch (e) { console.warn('ensureRosterColumns skip', col, e.message); }
  }
  try {
    await query(`CREATE TABLE IF NOT EXISTS call_duty_unit_config (
      id SERIAL PRIMARY KEY,
      config JSONB NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      updated_by TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) { console.warn('ensureRosterColumns unit config table:', e.message); }
  columnsEnsured = true;
}

// ── Unit configuration ──────────────────────────────────────────────────────

/**
 * The active unit-call configuration, or null when none has been saved.
 *
 * `units` are the stored base lists (see rebaseUnits); `current_units` is who
 * is in each unit today after rotation, and `next_rotation` the date each
 * rotating grade next changes units. Screens show and edit `current_units`.
 */
export async function getUnitConfig() {
  const cfg = await readUnitConfig();
  if (!cfg) return null;
  const today = watDayNumber(new Date());
  const next = {};
  for (const g of ROTATING_GRADES) {
    const d = nextRotationDay(cfg.rotation, g, today);
    next[g] = d === null ? null : ymdFromDayNumber(d);
  }
  return { ...cfg, current_units: effectiveUnits(cfg, today), next_rotation: next };
}

async function readUnitConfig() {
  await ensureRosterColumns();
  try {
    const r = await query(
      `SELECT config, updated_by, created_at FROM call_duty_unit_config
        WHERE is_active = TRUE ORDER BY id DESC LIMIT 1`
    );
    if (!r.rows[0]) return null;
    const cfg = typeof r.rows[0].config === 'string' ? JSON.parse(r.rows[0].config) : r.rows[0].config;
    return { ...cfg, updated_by: r.rows[0].updated_by, updated_at: r.rows[0].created_at };
  } catch (e) {
    console.warn('getUnitConfig failed:', e.message);
    return null;
  }
}

/** Save a new unit configuration (older versions are kept, inactive). */
export async function saveUnitConfig(raw, userId) {
  await ensureRosterColumns();
  // The lists arrive as they stand today; store them rebased onto the cycle.
  const { config, error } = normaliseUnitConfig(raw, watDayNumber(new Date()));
  if (error) return { error };
  await query(`UPDATE call_duty_unit_config SET is_active = FALSE WHERE is_active = TRUE`);
  await query(
    `INSERT INTO call_duty_unit_config (config, is_active, updated_by) VALUES ($1, TRUE, $2)`,
    [JSON.stringify(config), userId == null ? null : String(userId)]
  );
  return { config: await getUnitConfig() };
}

/** Switch back to the legacy 48-hour rotation. */
export async function clearUnitConfig() {
  await ensureRosterColumns();
  await query(`UPDATE call_duty_unit_config SET is_active = FALSE WHERE is_active = TRUE`);
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

export async function hydrateShifts(rows) {
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

// ── Roster generation ───────────────────────────────────────────────────────

/**
 * Roster key from the WAT calendar dates of the range. The client builds the
 * same key from its local dates; taking the server's UTC date instead made the
 * two disagree by a day for any range starting at local midnight.
 */
export function rosterKey(start, end) {
  return `${ymdFromDayNumber(watDayNumber(new Date(start)))}_${ymdFromDayNumber(watDayNumber(new Date(end)))}`;
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

async function generateLegacyShifts(startDate, endDate) {
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
    shifts.push(shiftRow({ shiftStart, shiftEnd, c, sr, r, hoW, hoE, hoO, hoCount, n }));
    ci++; ri++; hi++; n++;
    cursor.setDate(cursor.getDate() + 2);
  }
  return shifts;
}

function shiftRow({ shiftStart, shiftEnd, c, sr, r, hoW, hoE, hoO, hoCount, n, unit = null, block = null }) {
  return {
    start_date: shiftStart.toISOString(), end_date: shiftEnd.toISOString(),
    consultant_id: c?.id || '', consultant_name: c?.full_name || 'TBD', consultant_phone: c?.phone || '',
    senior_registrar_id: sr?.id || '', senior_registrar_name: sr?.full_name || 'TBD', senior_registrar_phone: sr?.phone || '',
    registrar_id: r?.id || '', registrar_name: r?.full_name || 'TBD', registrar_phone: r?.phone || '',
    house_officer_id: hoW?.id || '', house_officer_name: hoW?.full_name || 'TBD',
    ho_ward_id: hoW?.id || '', ho_ward_name: hoW?.full_name || 'TBD', ho_ward_phone: hoW?.phone || '',
    ho_emergency_id: hoE?.id || '', ho_emergency_name: hoE?.full_name || 'TBD', ho_emergency_phone: hoE?.phone || '',
    ho_off_id: hoO?.id || '', ho_off_name: hoO?.full_name || 'Off', ho_off_phone: hoO?.phone || '',
    ho_count: hoCount, shift_number: n,
    unit_key: unit?.key || null, unit_name: unit?.name || null, call_block: block,
  };
}

/**
 * Daily shifts following the unit call pattern. Each grade is drawn from the
 * on-call unit's own list first; if nobody in that unit is available (leave,
 * deactivated, or the grade simply not configured for the unit) the other
 * unit's list covers, then the whole grade — a call day is never left empty
 * while someone of that grade is free.
 */
async function generateUnitShifts(startDate, endDate, config) {
  const [consultants, srs, regs, hos, absences] = await Promise.all([
    pool('consultant'), pool('senior_registrar'), pool('registrar'), pool('house_officer'),
    absencesOverlapping(startDate, endDate),
  ]);
  const asMap = (list) => new Map(list.map(p => [String(p.id), p]));
  const pools = {
    consultant: { key: 'consultant_ids', all: consultants, byId: asMap(consultants) },
    senior_registrar: { key: 'senior_registrar_ids', all: srs, byId: asMap(srs) },
    registrar: { key: 'registrar_ids', all: regs, byId: asMap(regs) },
    house_officer: { key: 'house_officer_ids', all: hos, byId: asMap(hos) },
  };
  // Active members of a unit for a grade, in the configured order. Anyone
  // deactivated since the configuration was saved simply drops out.
  const members = (unit, grade) =>
    (unit[pools[grade].key] || []).map(id => pools[grade].byId.get(String(id))).filter(Boolean);

  const anchor = dayNumberFromYmd(config.anchor_date);
  const firstDay = watDayNumber(startDate);
  const lastDay = watDayNumber(endDate); // exclusive, matching the legacy range
  const shifts = [];
  let n = 1;
  for (let day = firstDay; day < lastDay; day++, n++) {
    const { start, end } = callDayWindow(day);
    const slot = callSlotForDay(day, anchor);
    // Membership on THIS day — juniors may have rotated within the range.
    const units = effectiveUnits(config, day);
    const unit = units[slot.unitIndex];
    const other = units[1 - slot.unitIndex];
    const free = (p) => !absences.some(a => a.user_id === String(p.id) && a.start <= end && a.end >= start);

    const choose = (grade) => {
      const idx = rotationIndex(slot, grade);
      return pickFrom(members(unit, grade), idx, free)
        || pickFrom(members(other, grade), idx, free)
        || pickFrom(pools[grade].all, day, free);
    };

    let hoList = members(unit, 'house_officer').filter(free);
    if (hoList.length === 0) hoList = members(other, 'house_officer').filter(free);
    if (hoList.length === 0) hoList = hos.filter(free);
    const duty = houseOfficerDuties(hoList, rotationIndex(slot, 'house_officer'));

    shifts.push(shiftRow({
      shiftStart: start, shiftEnd: end,
      c: choose('consultant'), sr: choose('senior_registrar'), r: choose('registrar'),
      hoW: duty.ward, hoE: duty.emergency, hoO: duty.off, hoCount: hoList.length, n,
      unit, block: slot.block,
    }));
  }
  return shifts;
}

/** Shifts for a range using whichever pattern is configured. */
export async function generateShifts(startDate, endDate) {
  const config = await getUnitConfig();
  if (config && config.units && config.units.length === 2) {
    return generateUnitShifts(startDate, endDate, config);
  }
  return generateLegacyShifts(startDate, endDate);
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
  'unit_key', 'unit_name', 'call_block',
];
export const EDITABLE_SHIFT_COLS = SHIFT_COLS.filter(c => c !== 'month_key' && c !== 'shift_number' && c !== 'created_by');

/**
 * Store a roster under `key`, replacing any earlier roster with the same key.
 *
 * With `supersede`, the new roster also becomes the only one covering its
 * period: other rosters' shifts inside it are removed, and shifts straddling
 * either edge are trimmed to it. Without that, switching to the unit pattern
 * left the old 48-hour shifts overlapping the new daily ones and the on-call
 * lookup could answer with either. Auto-generation must NOT supersede — it only
 * ever fills a gap, and must never trim a roster an administrator made.
 */
export async function persistRoster(shifts, key, createdBy, { supersede = false } = {}) {
  await query(`DELETE FROM call_duty_roster WHERE month_key = $1`, [key]);
  if (supersede && shifts.length) {
    const first = shifts[0].start_date;
    const last = shifts[shifts.length - 1].end_date;
    await query(
      `UPDATE call_duty_roster SET end_date = $2, updated_at = CURRENT_TIMESTAMP
        WHERE month_key <> $1 AND start_date < $2 AND end_date > $2`,
      [key, first]
    );
    await query(
      `UPDATE call_duty_roster SET start_date = $3, updated_at = CURRENT_TIMESTAMP
        WHERE month_key <> $1 AND start_date >= $2 AND start_date < $3 AND end_date > $3`,
      [key, first, last]
    );
    await query(
      `DELETE FROM call_duty_roster WHERE month_key <> $1 AND start_date >= $2 AND end_date <= $3`,
      [key, first, last]
    );
  }
  for (const s of shifts) {
    const row = { ...s, month_key: key, created_by: createdBy || null, status: 'active' };
    const vals = SHIFT_COLS.map(c => row[c] ?? null);
    const ph = SHIFT_COLS.map((_, i) => `$${i + 1}`).join(', ');
    await query(`INSERT INTO call_duty_roster (${SHIFT_COLS.join(', ')}) VALUES (${ph})`, vals);
  }
}

/** Generate a rolling roster (WAT month start → +60 days) if none exists yet. */
export async function autoGenerate(dateObj) {
  await ensureRosterColumns();
  const ymd = ymdFromDayNumber(watDayNumber(dateObj));
  const firstDay = dayNumberFromYmd(`${ymd.slice(0, 8)}01`);
  const start = callDayWindow(firstDay).start;
  const end = callDayWindow(firstDay + 60).start;
  const key = rosterKey(start, end);
  const existing = await query(`SELECT 1 FROM call_duty_roster WHERE month_key = $1 LIMIT 1`, [key]);
  if (existing.rows.length) return;
  const shifts = await generateShifts(start, end);
  if (shifts.length) await persistRoster(shifts, key, null);
}

/**
 * The shift covering an instant, hydrated against live staff. With
 * `autoGenerate`, a roster is generated first when none covers it.
 */
export async function findShiftAt(at, { autoGenerate: auto = true } = {}) {
  await ensureRosterColumns();
  const iso = new Date(at).toISOString();
  const select = () => query(
    `SELECT * FROM call_duty_roster WHERE $1 >= start_date AND $1 < end_date
      ORDER BY updated_at DESC NULLS LAST, id DESC LIMIT 1`, [iso]
  );
  let r = await select();
  if (r.rows.length === 0 && auto) {
    await autoGenerate(new Date(iso));
    r = await select();
  }
  const [shift] = await hydrateShifts(r.rows);
  return shift || null;
}

/**
 * The team responsible for something arriving at `at` (a consult): who was on
 * call for that call day. Returns null when no roster covers it.
 *
 * The house officer is the EMERGENCY house officer — consults from other units
 * are emergency-room work — falling back to the ward house officer when one
 * person covers both or no emergency HO is rostered.
 */
export async function onCallTeamAt(at, opts = {}) {
  const shift = await findShiftAt(at, opts);
  if (!shift) return null;
  const blank = (v) => (v === null || v === undefined || String(v).trim() === '' ? null : String(v));
  const hoId = blank(shift.ho_emergency_id) || blank(shift.ho_ward_id) || blank(shift.house_officer_id);
  const hoIsEmergency = !!blank(shift.ho_emergency_id);
  return {
    shift_id: shift.id,
    call_day: ymdFromDayNumber(callDayNumberAt(at)),
    shift_start: shift.start_date,
    shift_end: shift.end_date,
    unit_key: shift.unit_key || null,
    unit_name: shift.unit_name || null,
    call_block: shift.call_block || null,
    consultant: { id: blank(shift.consultant_id), name: blank(shift.consultant_id) ? shift.consultant_name : null, phone: shift.consultant_phone || '' },
    senior_registrar: { id: blank(shift.senior_registrar_id), name: blank(shift.senior_registrar_id) ? shift.senior_registrar_name : null, phone: shift.senior_registrar_phone || '' },
    registrar: { id: blank(shift.registrar_id), name: blank(shift.registrar_id) ? shift.registrar_name : null, phone: shift.registrar_phone || '' },
    house_officer: {
      id: hoId,
      name: hoId ? (hoIsEmergency ? shift.ho_emergency_name : shift.ho_ward_name) : null,
      phone: (hoIsEmergency ? shift.ho_emergency_phone : shift.ho_ward_phone) || '',
    },
    ho_ward: { id: blank(shift.ho_ward_id), name: blank(shift.ho_ward_id) ? shift.ho_ward_name : null, phone: shift.ho_ward_phone || '' },
  };
}
