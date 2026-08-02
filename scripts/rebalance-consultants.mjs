#!/usr/bin/env node
/**
 * rebalance-consultants.mjs — even out the consultant patient load.
 *
 *   node scripts/rebalance-consultants.mjs                 # dry run (default)
 *   node scripts/rebalance-consultants.mjs --apply         # write the changes
 *   node scripts/rebalance-consultants.mjs --to "Ogbuishi" # target a consultant
 *
 * Written for the case where a consultant joins a unit and needs a share of the
 * existing load, but it rebalances generally: it levels every active consultant
 * towards the mean, moving patients from the most-loaded to the least-loaded.
 *
 * SCOPE — only rows that represent live clinical responsibility are touched:
 * `patient_assignments.is_active = true` AND the patient has a current
 * admission. Historical rows are a record of who managed a patient at the time
 * and must not be rewritten.
 *
 * SELECTION — most recently assigned patients move first. The newest clinical
 * relationships are the least disruptive to break; long-stay patients keep the
 * consultant who has been managing them.
 *
 * AUDIT — every moved row records reassigned_at and reassigned_reason, so the
 * change is traceable and reversible from the audit trail rather than only from
 * a database backup.
 *
 * Dry run is the DEFAULT. Nothing is written without --apply.
 */

import pg from 'pg';
import { requireDatabaseUrl } from '../db-env.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const toIndex = args.indexOf('--to');
const targetHint = toIndex >= 0 ? args[toIndex + 1] : null;

const REASON = 'Load rebalance on consultant joining unit';

/**
 * Decide how many patients each consultant gives up or receives.
 * Levels towards the mean: everyone above target sheds, everyone below receives.
 */
export function planRebalance(counts) {
  const total = counts.reduce((s, c) => s + c.count, 0);
  const n = counts.length;
  if (!n) return { moves: [], targets: new Map() };

  const base = Math.floor(total / n);
  const remainder = total % n;

  // Consultants with the largest existing load absorb the remainder, so the
  // people already carrying the most are not levelled below their peers.
  const sorted = [...counts].sort((a, b) => b.count - a.count);
  const targets = new Map();
  sorted.forEach((c, i) => targets.set(c.id, base + (i < remainder ? 1 : 0)));

  const donors = sorted
    .filter(c => c.count > targets.get(c.id))
    .map(c => ({ ...c, give: c.count - targets.get(c.id) }));
  const receivers = sorted
    .filter(c => c.count < targets.get(c.id))
    .map(c => ({ ...c, take: targets.get(c.id) - c.count }));

  return { targets, donors, receivers, total, base, remainder };
}

async function main() {
  const pool = new pg.Pool({
    connectionString: requireDatabaseUrl(),
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 60000,
  });

  let client;
  try {
    client = await pool.connect();

    const consultants = (await client.query(
      `SELECT id::text AS id, full_name FROM users
       WHERE role = 'consultant' AND is_active = true AND is_approved = true
       ORDER BY full_name`
    )).rows;

    const loadRows = (await client.query(
      `SELECT pa.consultant_id::text AS id, COUNT(*)::int AS count
       FROM patient_assignments pa
       JOIN admissions a ON a.patient_id::text = pa.patient_id::text AND a.status = 'active'
       WHERE pa.is_active = true
       GROUP BY pa.consultant_id`
    )).rows;

    const loadById = new Map(loadRows.map(r => [r.id, r.count]));
    const counts = consultants.map(c => ({ id: c.id, name: c.full_name, count: loadById.get(c.id) || 0 }));

    console.log('CURRENT LOAD (active assignment + current admission)');
    counts.forEach(c => console.log(`  ${c.name.padEnd(30)} ${c.count}`));
    const total = counts.reduce((s, c) => s + c.count, 0);
    console.log(`  ${'TOTAL'.padEnd(30)} ${total}  across ${counts.length} consultants (mean ${(total / counts.length).toFixed(2)})\n`);

    const { targets, donors, receivers } = planRebalance(counts);

    console.log('TARGET AFTER REBALANCE');
    counts.forEach(c => console.log(`  ${c.name.padEnd(30)} ${c.count} -> ${targets.get(c.id)}`));
    console.log();

    if (!donors.length || !receivers.length) {
      console.log('Already balanced. Nothing to do.');
      return;
    }
    if (targetHint) {
      const named = receivers.find(r => r.name.toLowerCase().includes(targetHint.toLowerCase()));
      if (!named) {
        console.error(`--to "${targetHint}" does not match any consultant who is under target. Aborting.`);
        process.exitCode = 1;
        return;
      }
    }

    // Build the concrete move list: newest assignments from each donor.
    const moves = [];
    const queue = receivers.flatMap(r => Array.from({ length: r.take }, () => r));
    let qi = 0;

    for (const donor of donors) {
      const rows = (await client.query(
        `SELECT pa.id, pa.patient_id, pa.hospital_number, pa.assigned_at
         FROM patient_assignments pa
         JOIN admissions a ON a.patient_id::text = pa.patient_id::text AND a.status = 'active'
         WHERE pa.is_active = true AND pa.consultant_id::text = $1
         ORDER BY pa.assigned_at DESC NULLS LAST, pa.id DESC
         LIMIT $2`,
        [donor.id, donor.give]
      )).rows;

      for (const row of rows) {
        const receiver = queue[qi++];
        if (!receiver) break;
        moves.push({ row, from: donor, to: receiver });
      }
    }

    console.log(`MOVES (${moves.length})`);
    for (const m of moves) {
      const when = m.row.assigned_at ? new Date(m.row.assigned_at).toISOString().slice(0, 10) : 'unknown';
      console.log(`  ${(m.row.hospital_number || m.row.patient_id).padEnd(16)} ${m.from.name.padEnd(22)} -> ${m.to.name.padEnd(22)} (assigned ${when})`);
    }
    console.log();

    if (!apply) {
      console.log('DRY RUN — nothing written. Re-run with --apply to commit.');
      return;
    }

    await client.query('BEGIN');
    for (const m of moves) {
      await client.query(
        `UPDATE patient_assignments
         SET consultant_id = $1, reassigned_at = NOW(), reassigned_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [m.to.id, REASON, m.row.id]
      );
    }
    await client.query('COMMIT');
    console.log(`Applied ${moves.length} reassignments.`);

    const after = (await client.query(
      `SELECT u.full_name, COUNT(*)::int n
       FROM patient_assignments pa
       JOIN users u ON u.id::text = pa.consultant_id::text
       JOIN admissions a ON a.patient_id::text = pa.patient_id::text AND a.status = 'active'
       WHERE pa.is_active = true
       GROUP BY u.full_name ORDER BY n DESC`
    )).rows;
    console.log('\nVERIFIED LOAD AFTER');
    after.forEach(r => console.log(`  ${r.full_name.padEnd(30)} ${r.n}`));
  } catch (err) {
    await client?.query('ROLLBACK').catch(() => {});
    console.error(`\nRebalance failed, no changes committed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try { client?.release(); } catch { /* already gone */ }
    await pool.end().catch(() => {});
  }
}

main();
