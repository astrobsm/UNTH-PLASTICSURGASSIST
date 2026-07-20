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

const ROLE_POOLS = {
  consultant: ['consultant'],
  senior_registrar: ['senior_registrar'],
  registrar: ['registrar', 'junior_registrar'],
  house_officer: ['house_officer'],
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const auth = authenticateRequest(req);
  if (!auth.authenticated) return res.status(401).json({ error: auth.error });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action') || (req.body && req.body.action);

  try {
    await ensureColumns();
    switch (req.method) {
      case 'GET':
        if (action === 'on-call') return await getOnCall(url.searchParams, res);
        if (action === 'keys') return await getKeys(res);
        return await getRange(url.searchParams, res); // default: range
      case 'POST':
        if (action === 'generate') return await generate(req.body, auth.user, res);
        return res.status(400).json({ error: 'Unknown action' });
      case 'PUT':
        return await updateShift(req.body, res);
      case 'DELETE':
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
  const roles = ROLE_POOLS[roleKey];
  const r = await query(
    `SELECT id::text AS id, full_name, phone
       FROM users
      WHERE role = ANY($1::text[]) AND is_active = TRUE AND is_approved = TRUE
      ORDER BY id`,
    [roles]
  );
  return r.rows.map(u => ({ id: u.id, full_name: u.full_name || 'TBD', phone: u.phone || '' }));
}

// ── Roster generation (round-robin per 48h shift) ───────────────────────────
function rosterKey(start, end) {
  const d = (x) => new Date(x).toISOString().slice(0, 10);
  return `${d(start)}_${d(end)}`;
}

async function generateShifts(startDate, endDate) {
  const [consultants, srs, regs, hos] = await Promise.all([
    pool('consultant'), pool('senior_registrar'), pool('registrar'), pool('house_officer'),
  ]);
  const pick = (list, i) => (list.length ? list[i % list.length] : null);
  const hoCount = hos.length;
  const shifts = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 8, 0, 0);
  const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 8, 0, 0);
  let n = 1, ci = 0, si = 0, ri = 0, hi = 0;
  while (cursor < rangeEnd) {
    const shiftStart = new Date(cursor);
    const shiftEnd = new Date(shiftStart.getTime() + 48 * 3600 * 1000);
    const c = pick(consultants, ci), sr = pick(srs, si), r = pick(regs, ri);
    let hoW = null, hoE = null, hoO = null;
    if (hoCount >= 3) { hoW = hos[hi % hoCount]; hoE = hos[(hi + 1) % hoCount]; hoO = hos[(hi + 2) % hoCount]; }
    else if (hoCount === 2) { hoW = hos[hi % 2]; hoE = hos[hi % 2]; hoO = hos[(hi + 1) % 2]; }
    else if (hoCount === 1) { hoW = hos[0]; hoE = hos[0]; hoO = null; }
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
    ci++; si++; ri++; hi++; n++;
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
  return res.status(200).json({ month_key: key, shifts: saved.rows });
}

async function getRange(params, res) {
  const start = params.get('start'), end = params.get('end');
  if (start && end) {
    const key = rosterKey(new Date(start), new Date(end));
    const r = await query(`SELECT * FROM call_duty_roster WHERE month_key = $1 ORDER BY shift_number`, [key]);
    if (r.rows.length) return res.status(200).json({ month_key: key, shifts: r.rows });
    // No exact-key roster: fall back to any shifts overlapping the range.
    const noonStart = `${start.slice(0, 10)}T12:00:00.000Z`;
    const noonEnd = `${end.slice(0, 10)}T12:00:00.000Z`;
    const ov = await query(
      `SELECT * FROM call_duty_roster WHERE end_date > $1 AND start_date < $2 ORDER BY start_date, shift_number`,
      [noonStart, noonEnd]
    );
    return res.status(200).json({ month_key: key, shifts: ov.rows });
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
  return res.status(200).json({ shift: r.rows[0] || null, date });
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
  return res.status(200).json({ shift: r.rows[0] });
}

async function deleteRoster(params, res) {
  const key = params.get('key');
  if (!key) return res.status(400).json({ error: 'key is required' });
  await query(`DELETE FROM call_duty_roster WHERE month_key = $1`, [key]);
  return res.status(200).json({ success: true });
}
