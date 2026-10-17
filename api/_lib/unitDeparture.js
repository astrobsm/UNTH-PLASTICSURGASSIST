// ============================================================================
// A doctor leaves the unit: take them off EVERYTHING, so no duty, patient,
// roster slot or morning-round expectation is left in their name and nothing
// of theirs is credited to — or blamed on — anyone else.
//
//   units            removed from both units' lists (call-roster config)
//   patients         handed to the least-loaded doctor of the same grade in
//                    each patient's own unit
//   call roster      current and future shifts covered by colleagues
//   PS unit roster   removed from the dashboard's unit roster (stored by name)
//   duties           pending duty assignments, responsibilities, clinic
//                    duties and reminders cancelled (completed ones kept)
//   morning round    today's and later expectations dropped
//   rotation         open training rotation closed as signed out
//
// Everything they documented stays attributed to them. Each step is
// best-effort and reported, so one failure never leaves the account active.
// ============================================================================

import { query } from './db.js';
import { reassignDeactivatedUser, coverRosterVacancies, removeFromUnits } from './teamAssignment.js';
import { signOutRotation, scoreFor } from './rotationLifecycle.js';

const PS_ROSTER_LISTS = ['senior_registrars', 'junior_registrars', 'house_officers', 'consultants_unit1', 'consultants_unit2'];

async function step(report, name, fn) {
  try { report[name] = await fn(); }
  catch (e) { report[name] = { error: e.message }; console.warn(`unitDeparture ${name}:`, e.message); }
}

const count = async (sql, params) => (await query(sql, params)).rowCount || 0;

/** Remove a person (matched by full name) from the active PS unit roster lists. */
export async function removeFromPsUnitRoster(fullName) {
  const name = String(fullName || '').trim().toLowerCase();
  if (!name) return { removed: 0 };
  const r = await query(`SELECT * FROM ps_unit_rosters WHERE is_active = TRUE`);
  let removed = 0;
  for (const row of r.rows) {
    const updates = {};
    for (const key of PS_ROSTER_LISTS) {
      if (!(key in row)) continue;
      let list = row[key];
      if (typeof list === 'string') { try { list = JSON.parse(list); } catch { continue; } }
      if (!Array.isArray(list)) continue;
      const kept = list.filter(x => String(typeof x === 'object' && x ? (x.name || x.full_name || '') : x).trim().toLowerCase() !== name);
      if (kept.length !== list.length) { updates[key] = kept; removed += list.length - kept.length; }
    }
    const cols = Object.keys(updates);
    if (!cols.length) continue;
    await query(
      `UPDATE ps_unit_rosters SET ${cols.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${cols.length + 1}`,
      [...cols.map(c => JSON.stringify(updates[c])), row.id]
    );
  }
  return { removed };
}

/**
 * Heartbeat clean-up: names of deactivated staff come off the PS unit roster
 * (which stores names, not ids). A name shared with an active account is left.
 */
export async function pruneInactiveFromPsUnitRoster() {
  const r = await query(`SELECT * FROM ps_unit_rosters WHERE is_active = TRUE`);
  const names = new Set();
  for (const row of r.rows) {
    for (const key of PS_ROSTER_LISTS) {
      let list = row[key];
      if (typeof list === 'string') { try { list = JSON.parse(list); } catch { continue; } }
      if (Array.isArray(list)) list.forEach(x => names.add(String(typeof x === 'object' && x ? (x.name || x.full_name || '') : x).trim().toLowerCase()));
    }
  }
  names.delete('');
  if (!names.size) return { removed: 0 };
  const gone = (await query(
    `SELECT LOWER(TRIM(full_name)) AS n FROM users WHERE LOWER(TRIM(full_name)) = ANY($1::text[])
      GROUP BY LOWER(TRIM(full_name)) HAVING BOOL_AND(NOT COALESCE(is_active, TRUE))`,
    [[...names]]
  )).rows.map(x => x.n);
  let removed = 0;
  for (const n of gone) removed += (await removeFromPsUnitRoster(n)).removed;
  return { removed };
}

export async function releaseFromUnit({ userId, byUser = null, reason = '' }) {
  const uid = String(userId);
  const report = {};
  const user = (await query(`SELECT id, full_name, role FROM users WHERE id::text = $1`, [uid])).rows[0] || {};
  const today = new Date(Date.now() + 3600000).toISOString().slice(0, 10); // WAT

  // Units first, so patients are handed to the doctors still in each unit.
  await step(report, 'units', () => removeFromUnits(uid, byUser?.id ?? null));
  await step(report, 'patients', () => reassignDeactivatedUser(uid));
  await step(report, 'callRoster', () => coverRosterVacancies({ replacing: uid }));
  await step(report, 'psUnitRoster', () => removeFromPsUnitRoster(user.full_name));
  await step(report, 'duties', async () => ({
    dutyAssignments: await count(
      `UPDATE duty_assignments SET status = 'cancelled', completion_notes = COALESCE(completion_notes || ' | ', '') || 'Cancelled: left the unit'
        WHERE user_id::text = $1 AND status NOT IN ('completed', 'cancelled')`, [uid]).catch(() => 0),
    responsibilities: await count(
      `UPDATE assigned_responsibilities SET status = 'cancelled', completion_notes = COALESCE(completion_notes || ' | ', '') || 'Cancelled: left the unit'
        WHERE user_id::text = $1 AND status NOT IN ('completed', 'cancelled')`, [uid]).catch(() => 0),
    clinicDuties: await count(
      `UPDATE clinic_duty_logs SET status = 'cancelled'
        WHERE user_id::text = $1 AND status = 'assigned' AND COALESCE(assigned_date, '') >= $2`, [uid, today]).catch(() => 0),
    reminders: await count(
      `UPDATE duty_reminders SET status = 'cancelled' WHERE user_id::text = $1 AND status = 'pending'`, [uid]).catch(() => 0),
  }));
  await step(report, 'morningRound', async () => ({
    daysDropped: await count(`DELETE FROM ho_morning_round_days WHERE ho_id = $1 AND day >= $2::date`, [uid, today]).catch(() => 0),
  }));
  await step(report, 'rotation', async () => {
    const open = (await query(
      `SELECT id, level FROM trainee_rotations WHERE user_id::text = $1 AND status IN ('active', 'extended', 'pending_signout')`, [uid]
    ).catch(() => ({ rows: [] }))).rows;
    const closed = [];
    for (const r of open) {
      let finalScore = null;
      try { finalScore = (await scoreFor(Number(uid), r.level))?.overall ?? null; } catch { /* score optional */ }
      const out = await signOutRotation({
        rotationId: r.id, mode: 'approved', byUserId: byUser?.id ?? null, finalScore,
        reason: `Left the unit${reason ? `: ${reason}` : ''}`,
      });
      if (out.ok) closed.push(r.id);
    }
    return { closed };
  });
  return report;
}
