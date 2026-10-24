// ============================================================================
// Residents rotate between the two units every six months.
//
// A house officer's posting is one fixed period. A resident's is not: their
// residency runs on, alternating PS Unit 1 ↔ PS Unit 2 in six-month blocks.
// Treating it as one 180-day posting locked a senior registrar out of the app
// once those 180 days had passed ("That end date has already passed").
//
// A resident onboards ONCE: the date their residency in the unit started and
// the unit they started in. From that, block k runs from start + 6k months to
// the day before start + 6(k+1) months, in the starting unit when k is even
// and the other unit when k is odd. When a block ends, advanceResidents()
// closes it, opens the next block's rotation, and moves the resident to the
// other unit on the call roster — no new onboarding, no sign-out gate.
//
// Keep blockAt() in step with src/utils/residentBlocks.ts (a test checks).
// ============================================================================

import { query } from './db.js';
import { getUnitConfig, saveUnitConfig } from './callRoster.js';
import { GRADE_LIST_KEY } from './unitCallPattern.js';

export const RESIDENT_GRADES = ['registrar', 'senior_registrar'];
export const BLOCK_MONTHS = 6;
const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d || '').slice(0, 10));

/** Calendar months later, the day clamped to the month's end (31 Aug + 6 → 28/29 Feb). */
export function addMonths(date, months) {
  const [y, m, d] = ymd(date).split('-').map(Number);
  const total = (y * 12 + (m - 1)) + months;
  const ny = Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}
const minusDay = (date) => new Date(Date.parse(`${date}T00:00:00Z`) - DAY).toISOString().slice(0, 10);

/**
 * The block containing `today`: its index (0 = first), dates and unit.
 * `units` is the two-unit list [{key, name}]; the unit alternates from
 * `initialUnitKey`. Before the residency starts, block 0 is returned.
 */
export function blockAt({ residencyStart, initialUnitKey, units, today }) {
  const start = ymd(residencyStart);
  const keys = units.map((u) => u.key);
  const first = keys.includes(initialUnitKey) ? initialUnitKey : keys[0];
  const other = keys.find((k) => k !== first) || first;
  let index = 0;
  if (today > start) {
    const [sy, sm] = start.split('-').map(Number);
    const [ty, tm] = today.split('-').map(Number);
    index = Math.max(0, Math.floor(((ty * 12 + tm) - (sy * 12 + sm)) / BLOCK_MONTHS));
    // Months counted by calendar month can overshoot by one block near the boundary.
    while (index > 0 && addMonths(start, index * BLOCK_MONTHS) > today) index--;
    while (addMonths(start, (index + 1) * BLOCK_MONTHS) <= today) index++;
  }
  const unitKey = index % 2 === 0 ? first : other;
  const nextKey = unitKey === first ? other : first;
  const name = (k) => units.find((u) => u.key === k)?.name || k;
  const blockStart = addMonths(start, index * BLOCK_MONTHS);
  const nextStart = addMonths(start, (index + 1) * BLOCK_MONTHS);
  return {
    index, start: blockStart, end: minusDay(nextStart),
    unitKey, unitName: name(unitKey), nextUnitKey: nextKey, nextUnitName: name(nextKey), nextStart,
  };
}

let columnsEnsured = false;
export async function ensureResidentColumns() {
  if (columnsEnsured) return;
  for (const sql of [
    `ALTER TABLE posting_onboarding ADD COLUMN IF NOT EXISTS cycle TEXT`,
    `ALTER TABLE posting_onboarding ADD COLUMN IF NOT EXISTS residency_start DATE`,
    `ALTER TABLE posting_onboarding ADD COLUMN IF NOT EXISTS initial_unit_key TEXT`,
    `ALTER TABLE posting_onboarding ADD COLUMN IF NOT EXISTS block_index INTEGER`,
  ]) {
    try { await query(sql); } catch (e) { console.warn('ensureResidentColumns:', e.message); }
  }
  columnsEnsured = true;
}

export async function unitList() {
  const cfg = await getUnitConfig().catch(() => null);
  const list = cfg?.units?.length === 2 ? cfg.units.map((u) => ({ key: u.key, name: u.name }))
    : [{ key: 'unit1', name: 'PS Unit 1' }, { key: 'unit2', name: 'PS Unit 2' }];
  return { cfg, list };
}

/** Put a resident in one unit's list on the call roster (and out of the other). */
export async function moveInRoster(cfg, userId, grade, toUnitKey, byUserId) {
  if (!cfg) return { changed: false, note: 'No call roster configured' };
  const listKey = GRADE_LIST_KEY[grade];
  if (!listKey) return { changed: false };
  const id = String(userId);
  const units = (cfg.current_units || cfg.units).map((u) => ({ ...u }));
  let changed = false;
  for (const u of units) {
    const ids = (u[listKey] || []).map(String);
    const has = ids.includes(id);
    if (u.key === toUnitKey && !has) { u[listKey] = [...ids, id]; changed = true; }
    if (u.key !== toUnitKey && has) { u[listKey] = ids.filter((x) => x !== id); changed = true; }
  }
  if (!changed) return { changed: false };
  const r = await saveUnitConfig({ anchor_date: cfg.anchor_date, rotation: cfg.rotation, units }, byUserId ?? null);
  return r?.error ? { changed: false, note: r.error } : { changed: true };
}

/** Residents whose unit rotates automatically (so other sweeps leave their blocks alone). */
export async function residentUserIds() {
  try {
    const r = await query(`SELECT DISTINCT user_id FROM posting_onboarding WHERE residency_start IS NOT NULL`);
    return new Set(r.rows.map((x) => Number(x.user_id)));
  } catch { return new Set(); }
}

/**
 * Residents who onboarded before the six-month cycle existed recorded one
 * fixed posting. Their posting start becomes their residency start and their
 * unit the unit they started in, so they are not asked to onboard again —
 * advanceResidents then rolls them forward to the block they are in now.
 */
export async function adoptLegacyResidents(userId = null) {
  try {
    await query(
      `UPDATE posting_onboarding o
          SET cycle = 'resident', residency_start = o.posting_start, initial_unit_key = o.unit_key, block_index = 0
        WHERE o.residency_start IS NULL
          AND o.grade = ANY($1::text[])
          AND ($2::int IS NULL OR o.user_id = $2)
          AND o.id = (SELECT x.id FROM posting_onboarding x WHERE x.user_id = o.user_id ORDER BY x.created_at DESC LIMIT 1)
          AND NOT EXISTS (SELECT 1 FROM posting_onboarding y WHERE y.user_id = o.user_id AND y.residency_start IS NOT NULL)`,
      [RESIDENT_GRADES, userId]);
  } catch (e) { console.warn('adoptLegacyResidents:', e.message); }
}

let lastSweep = 0;
/**
 * Move every resident whose six-month block has ended into the next block:
 * close the finished rotation, open the next, move them on the call roster,
 * and record the new block (so the posting stays onboarded). Idempotent;
 * cheap when nothing is due. `userId` limits it to one resident.
 */
export async function advanceResidents({ userId = null, today, force = false } = {}) {
  if (!userId && !force && Date.now() - lastSweep < 30 * 60 * 1000) return { advanced: [] };
  if (!userId) lastSweep = Date.now();
  await ensureResidentColumns();
  await adoptLegacyResidents(userId);
  const day = today || new Date(Date.now() + 3600000).toISOString().slice(0, 10); // West Africa Time
  let rows;
  try {
    rows = (await query(
      `SELECT DISTINCT ON (o.user_id) o.*, u.is_active
         FROM posting_onboarding o JOIN users u ON u.id = o.user_id
        WHERE o.residency_start IS NOT NULL AND ($1::int IS NULL OR o.user_id = $1)
        ORDER BY o.user_id, o.created_at DESC`, [userId])).rows;
  } catch { return { advanced: [] }; }
  if (!rows.length) return { advanced: [] };

  const { cfg, list } = await unitList();
  const advanced = [];
  for (const rec of rows) {
    if (rec.is_active === false) continue;
    const b = blockAt({ residencyStart: rec.residency_start, initialUnitKey: rec.initial_unit_key, units: list, today: day });
    if (rec.block_index != null && Number(rec.block_index) >= b.index) continue;

    // Close the finished block.
    await query(
      `UPDATE trainee_rotations
          SET status = 'completed', actual_end_date = LEAST(CURRENT_DATE, $2::date),
              sign_out_comments = TRIM(BOTH ' |' FROM COALESCE(sign_out_comments, '') || ' | ' || $3),
              updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND status IN ('active', 'extended', 'pending_signout')`,
      [rec.user_id, b.start < day ? minusDay(b.start) : day,
       `Six-month unit block completed; rotated automatically to ${b.unitName}`]).catch((e) => console.warn('advanceResidents close:', e.message));

    // Open the current block.
    const level = rec.level || (rec.grade === 'senior_registrar' ? 'senior_registrar' : 'registrar');
    const rot = await query(
      `INSERT INTO trainee_rotations (user_id, level, department, start_date, expected_end_date, status)
       VALUES ($1, $2, 'Plastic Surgery', $3::date, $4::date, 'active') RETURNING id`,
      [rec.user_id, level, b.start, b.end]).catch((e) => { console.warn('advanceResidents open:', e.message); return { rows: [] }; });

    let note = null;
    try { note = (await moveInRoster(cfg, rec.user_id, rec.grade, b.unitKey, null)).note || null; }
    catch (e) { note = `Could not move on the call roster: ${e.message}`; }

    await query(
      `INSERT INTO posting_onboarding (user_id, rotation_id, role, grade, level, unit_key, unit_name, posting_start, posting_end,
         rules_version, days_late, catch_up_articles, catch_up_cbt, catch_up_due, unit_note,
         cycle, residency_start, initial_unit_key, block_index)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,0,NULL,$11,'resident',$12,$13,$14)`,
      [rec.user_id, rot.rows[0]?.id ?? null, rec.role, rec.grade, rec.level, b.unitKey, b.unitName, b.start, b.end,
       rec.rules_version, note, ymd(rec.residency_start), rec.initial_unit_key, b.index]);
    try {
      await query(
        `INSERT INTO activity_logs (user_id, activity_type, description, metadata) VALUES ($1, 'unit_rotation', $2, $3)`,
        [rec.user_id, `Rotated to ${b.unitName} for ${b.start} – ${b.end}`, JSON.stringify({ block: b.index, unit: b.unitKey })]);
    } catch { /* best-effort */ }
    advanced.push({ userId: rec.user_id, unit: b.unitKey, block: b.index });
  }
  return { advanced };
}
