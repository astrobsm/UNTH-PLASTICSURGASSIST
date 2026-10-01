// ============================================================================
// Unit call pattern — pure scheduling logic (no database access).
//
// The two plastic-surgery units take call in alternating blocks:
//
//   week A:  Mon–Tue  unit 1   |  Wed–Thu  unit 2   |  Fri–Sun  unit 1
//   week B:  Mon–Tue  unit 2   |  Wed–Thu  unit 1   |  Fri–Sun  unit 2
//
// and then the fortnight repeats, so over every two weeks each unit holds
// exactly seven call days.
//
// Within a unit's block the consultants share the days: on a two-day weekday
// block one consultant takes the first day and the other the second; a weekend
// is held by ONE consultant for all three days, and the unit's next weekend
// goes to the other consultant. Senior registrars and registrars follow the
// same rule as the consultants. House officers rotate day by day (a 72-hour
// stretch is not a house-officer shift).
//
// Every call day runs 08:00 → 08:00 West Africa Time. WAT is UTC+1 all year
// (Nigeria has no daylight saving), so the fixed offset below is exact.
// Calendar dates are always taken in WAT: the server runs in UTC, and reading
// a date with getDate() there put shifts a day early for anything submitted
// between midnight and 01:00 local time.
// ============================================================================

const DAY_MS = 86400000;
export const WAT_OFFSET_MS = 3600000;
export const CALL_START_HOUR_WAT = 8;

export const CALL_BLOCKS = Object.freeze(['mon_tue', 'wed_thu', 'weekend']);
export const CALL_BLOCK_LABELS = Object.freeze({
  mon_tue: 'Mon–Tue',
  wed_thu: 'Wed–Thu',
  weekend: 'Weekend (Fri–Sun)',
});

/** Non-negative modulo — rotation indices go negative before the anchor date. */
export function mod(n, m) {
  return ((n % m) + m) % m;
}

/** Days since 1970-01-01 for the WAT calendar date containing `date`. */
export function watDayNumber(date) {
  const d = date instanceof Date ? date : new Date(date);
  return Math.floor((d.getTime() + WAT_OFFSET_MS) / DAY_MS);
}

/** Day number for a "YYYY-MM-DD" string (a calendar date, no time zone). */
export function dayNumberFromYmd(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
}

export function ymdFromDayNumber(dayNum) {
  return new Date(dayNum * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday. 1970-01-01 was a Thursday. */
export function weekdayOf(dayNum) {
  return mod(dayNum + 4, 7);
}

/** The Monday on or before a day. */
export function mondayOnOrBefore(dayNum) {
  return dayNum - mod(weekdayOf(dayNum) - 1, 7);
}

/** Start and end of the call day (08:00 WAT → 08:00 WAT next day), as Dates. */
export function callDayWindow(dayNum) {
  const start = new Date(dayNum * DAY_MS + (CALL_START_HOUR_WAT * 3600000) - WAT_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/**
 * The call day an instant belongs to. Call days begin at 08:00, so a consult
 * sent at 03:00 on Tuesday is Monday's call.
 */
export function callDayNumberAt(date) {
  const d = date instanceof Date ? date : new Date(date);
  return watDayNumber(new Date(d.getTime() - CALL_START_HOUR_WAT * 3600000));
}

/**
 * Where a call day sits in the pattern.
 *
 * @param {number} dayNum       day number of the call day
 * @param {number} anchorDayNum a day in the week where unit index 0 takes Mon–Tue
 * @returns {{week:number, block:string, blockIndex:number, dayInBlock:number, unitIndex:number}}
 */
export function callSlotForDay(dayNum, anchorDayNum) {
  const anchorMonday = mondayOnOrBefore(anchorDayNum);
  const daysSince = dayNum - anchorMonday;
  const week = Math.floor(daysSince / 7);
  const dow = mod(daysSince, 7); // 0 = Monday … 6 = Sunday
  let blockIndex;
  let dayInBlock;
  if (dow <= 1) { blockIndex = 0; dayInBlock = dow; }
  else if (dow <= 3) { blockIndex = 1; dayInBlock = dow - 2; }
  else { blockIndex = 2; dayInBlock = dow - 4; }
  // Blocks alternate units, and the week after starts with the other unit.
  const unitIndex = mod(week + blockIndex, 2);
  return { week, block: CALL_BLOCKS[blockIndex], blockIndex, dayInBlock, unitIndex };
}

/**
 * Rotation index for a grade on a call day — which member of the unit's list
 * is on. Weekday blocks: one per unit per week, two days each, so the index
 * advances per day. Weekends: one per unit every second week, held whole by a
 * single consultant / senior registrar / registrar; house officers still
 * rotate per day.
 */
export function rotationIndex(slot, grade) {
  if (slot.block !== 'weekend') return slot.week * 2 + slot.dayInBlock;
  const weekendSerial = Math.floor(slot.week / 2);
  if (grade === 'house_officer') return weekendSerial * 3 + slot.dayInBlock;
  return weekendSerial;
}

/**
 * First available person in `list` starting at rotation index `idx`, wrapping.
 * `isAvailable(person)` lets the caller skip anyone on leave.
 */
export function pickFrom(list, idx, isAvailable = () => true) {
  if (!list || list.length === 0) return null;
  for (let k = 0; k < list.length; k++) {
    const p = list[mod(idx + k, list.length)];
    if (p && isAvailable(p)) return p;
  }
  return null;
}

/**
 * House-officer duties for a day from the on-call HOs (already filtered to
 * those available). Same rule as the 48-hour roster:
 *   3+ → ward / emergency / off rotate;  2 → one covers both, one off;
 *   1  → covers both, nobody off.
 */
export function houseOfficerDuties(hos, idx) {
  const n = hos.length;
  if (n >= 3) return { ward: hos[mod(idx, n)], emergency: hos[mod(idx + 1, n)], off: hos[mod(idx + 2, n)] };
  if (n === 2) return { ward: hos[mod(idx, 2)], emergency: hos[mod(idx, 2)], off: hos[mod(idx + 1, 2)] };
  if (n === 1) return { ward: hos[0], emergency: hos[0], off: null };
  return { ward: null, emergency: null, off: null };
}

// ── Rotation ────────────────────────────────────────────────────────────────
// Consultants are fixed to their unit. The other grades can rotate: every
// `weeks[grade]` weeks the two units exchange that grade's doctors, counted
// from `rotation.start_date` (0 weeks = that grade does not rotate).
//
// The configuration stores each unit's lists as they stood in the FIRST block
// of the cycle (the "base"). Who is in a unit on any date follows from that,
// so the roster for next month already knows who will have rotated by then.
// An administrator always edits the lists as they stand TODAY; rebaseUnits()
// turns those back into the base, so a manual move is just an override that
// the automatic cycle carries on from.

export const ROTATING_GRADES = Object.freeze(['senior_registrar', 'registrar', 'house_officer']);
export const GRADE_LIST_KEY = Object.freeze({
  consultant: 'consultant_ids',
  senior_registrar: 'senior_registrar_ids',
  registrar: 'registrar_ids',
  house_officer: 'house_officer_ids',
});
export const DEFAULT_ROTATION_WEEKS = Object.freeze({ senior_registrar: 0, registrar: 6, house_officer: 2 });

/** Rotation block (0, 1, 2 …) a day falls in for a grade, or null if it does not rotate. */
export function rotationBlock(rotation, grade, dayNum) {
  if (!rotation || !rotation.enabled) return null;
  const weeks = Number(rotation.weeks?.[grade]) || 0;
  const start = dayNumberFromYmd(rotation.start_date);
  if (weeks <= 0 || start === null) return null;
  return Math.floor((dayNum - start) / (weeks * 7));
}

/** Whether the two units' lists for a grade are exchanged on a day. */
function swappedOn(rotation, grade, dayNum) {
  const b = rotationBlock(rotation, grade, dayNum);
  return b !== null && mod(b, 2) === 1;
}

/** Each unit's members ON a day, after rotation. */
export function effectiveUnits(config, dayNum) {
  const units = config.units;
  return units.map((u, i) => {
    const other = units[1 - i];
    const out = { ...u };
    for (const grade of ROTATING_GRADES) {
      const key = GRADE_LIST_KEY[grade];
      out[key] = [...(swappedOn(config.rotation, grade, dayNum) ? other[key] : u[key])];
    }
    return out;
  });
}

/** Turn lists as they stand on `dayNum` back into the stored base lists. */
export function rebaseUnits(currentUnits, rotation, dayNum) {
  return currentUnits.map((u, i) => {
    const other = currentUnits[1 - i];
    const out = { ...u };
    for (const grade of ROTATING_GRADES) {
      const key = GRADE_LIST_KEY[grade];
      out[key] = [...(swappedOn(rotation, grade, dayNum) ? other[key] : u[key])];
    }
    return out;
  });
}

/** The next day a grade changes units on or after `dayNum`, or null. */
export function nextRotationDay(rotation, grade, dayNum) {
  const b = rotationBlock(rotation, grade, dayNum);
  if (b === null) return null;
  const weeks = Number(rotation.weeks[grade]);
  return dayNumberFromYmd(rotation.start_date) + (b + 1) * weeks * 7;
}

function normaliseRotation(raw, fallbackStart) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const weeks = {};
  for (const g of ROTATING_GRADES) {
    const w = r.weeks && r.weeks[g] !== undefined ? Number(r.weeks[g]) : DEFAULT_ROTATION_WEEKS[g];
    weeks[g] = Number.isFinite(w) && w > 0 ? Math.min(Math.round(w), 52) : 0;
  }
  const start = dayNumberFromYmd(r.start_date);
  return {
    enabled: r.enabled !== false,
    start_date: start === null ? fallbackStart : ymdFromDayNumber(start),
    weeks,
  };
}

/**
 * Validate and normalise a unit-call configuration.
 *
 * `units` are the lists as they stand on `asOfDay` (today when saving); they
 * are rebased onto the rotation cycle before storing. Returns { config } or
 * { error }.
 */
export function normaliseUnitConfig(raw, asOfDay = null) {
  const b = raw && typeof raw === 'object' ? raw : {};
  const anchor = dayNumberFromYmd(b.anchor_date);
  if (anchor === null) return { error: 'anchor_date (YYYY-MM-DD) is required' };
  const units = Array.isArray(b.units) ? b.units : [];
  if (units.length !== 2) return { error: 'Exactly two units are required for the alternating call pattern' };
  const ids = (v) => (Array.isArray(v) ? v : [])
    .map(x => (x === null || x === undefined ? '' : String(x).trim()))
    .filter(Boolean)
    .filter((x, i, arr) => arr.indexOf(x) === i);
  const out = units.map((u, i) => ({
    key: String(u?.key || `unit${i + 1}`),
    name: String(u?.name || `PS Unit ${i + 1}`).trim() || `PS Unit ${i + 1}`,
    consultant_ids: ids(u?.consultant_ids),
    senior_registrar_ids: ids(u?.senior_registrar_ids),
    registrar_ids: ids(u?.registrar_ids),
    house_officer_ids: ids(u?.house_officer_ids),
  }));
  if (out[0].key === out[1].key) out[1].key = `${out[1].key}_2`;
  if (out.some(u => u.consultant_ids.length === 0)) {
    return { error: 'Each unit needs at least one consultant' };
  }
  // A doctor belongs to one unit at a time.
  for (const key of Object.values(GRADE_LIST_KEY)) {
    const clash = out[0][key].find(id => out[1][key].includes(id));
    if (clash) return { error: `User ${clash} is listed in both units` };
  }
  const anchorMonday = ymdFromDayNumber(mondayOnOrBefore(anchor));
  const today = asOfDay === null ? null : asOfDay;
  const rotation = normaliseRotation(b.rotation, ymdFromDayNumber(today ?? mondayOnOrBefore(anchor)));
  const base = today === null ? out : rebaseUnits(out, rotation, today);
  // Store the Monday itself, so the saved anchor reads unambiguously.
  return { config: { anchor_date: anchorMonday, rotation, units: base } };
}
