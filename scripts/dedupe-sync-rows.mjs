#!/usr/bin/env node
/**
 * dedupe-sync-rows.mjs — clean up records duplicated by the sync push bug.
 *
 *   node scripts/dedupe-sync-rows.mjs                    # dry run, all tables
 *   node scripts/dedupe-sync-rows.mjs --table treatment_plans
 *   node scripts/dedupe-sync-rows.mjs --apply            # actually delete
 *
 * BACKGROUND
 * api/sync/index.js skipped its id lookup for SERIAL-key tables and fell back
 * to a per-table date field for identity. Tables missing from that map — most
 * importantly treatment_plans — matched nothing and were INSERTed on every
 * push, so the same record accumulated indefinitely.
 *
 * WHAT COUNTS AS A DUPLICATE
 * Identical CONTENT for the same patient — not the same timestamp. Each push
 * stamped a fresh created_at, so the copies differ by seconds while every
 * clinical field, including client-generated ids like "proc_1771706657979_0",
 * is byte-identical. Content is therefore the only stable identity available,
 * and matching on it is safe: a clinician does not write two plans with the
 * same diagnosis, procedures and medications by accident.
 *
 * The OLDEST row in each group is kept — it is the original, and anything
 * referencing this record by id is most likely pointing at it.
 *
 * Rows with a NULL patient_id are reported separately. They are unreachable
 * from any patient record and cannot be deduplicated meaningfully, so they are
 * only removed with --purge-orphans, which is deliberately a separate flag.
 *
 * Orphans are COPIED TO sync_orphan_archive BEFORE deletion. They may hold
 * clinical text a clinician actually wrote that simply failed to attach to a
 * patient; that is recoverable from the archive and unrecoverable from a
 * DELETE. The archive keeps the whole row as JSONB, so nothing is lost even if
 * the source table later changes shape.
 *
 * DRY RUN IS THE DEFAULT. Nothing is deleted without --apply.
 */

import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { requireDatabaseUrl } from '../db-env.mjs';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const purgeOrphans = args.includes('--purge-orphans');
const tableArg = args.indexOf('--table');
const onlyTable = tableArg >= 0 ? args[tableArg + 1] : null;

// Tables the faulty push path could duplicate, with the column that identifies
// when the record was made.
// `content` lists the columns that together identify the record. Anything
// assigned per-push (id, created_at, updated_at) is deliberately excluded.
const TABLES = [
  { name: 'treatment_plans', content: ['diagnosis', 'treatment_type', 'description', 'procedures', 'medications'] },
  { name: 'progress_notes', content: ['note', 'note_type'] },
  { name: 'ward_rounds', content: ['round_date', 'findings', 'plan'] },
  { name: 'prescriptions', content: ['medication_name', 'dosage', 'frequency'] },
  { name: 'lab_orders', content: ['test_name', 'ordered_at'] },
];

async function columnsOf(client, table) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]
  );
  return new Set(r.rows.map(x => x.column_name));
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
    let totalDup = 0;
    let totalOrphan = 0;

    for (const t of TABLES) {
      if (onlyTable && t.name !== onlyTable) continue;

      const cols = await columnsOf(client, t.name);
      if (!cols.size) { console.log(`${t.name}: no such table, skipping`); continue; }
      if (!cols.has('patient_id')) { console.log(`${t.name}: no patient_id, skipping`); continue; }

      const present = t.content.filter(c => cols.has(c));
      if (!present.length) { console.log(`${t.name}: no content columns present, skipping`); continue; }

      // Cast every column to text so JSONB and arrays compare by value.
      const keyList = ['patient_id', ...present].map(c => `"${c}"::text`).join(', ');

      const total = (await client.query(`SELECT COUNT(*)::int n FROM ${t.name}`)).rows[0].n;
      const orphans = (await client.query(
        `SELECT COUNT(*)::int n FROM ${t.name} WHERE patient_id IS NULL`
      )).rows[0].n;

      // Everything except the lowest id in each duplicate group.
      const dupRows = (await client.query(
        `SELECT COUNT(*)::int n FROM (
           SELECT id, ROW_NUMBER() OVER (PARTITION BY ${keyList} ORDER BY id ASC) rn
           FROM ${t.name} WHERE patient_id IS NOT NULL
         ) x WHERE x.rn > 1`
      )).rows[0].n;

      console.log(`${t.name}: ${total} rows | ${dupRows} duplicates | ${orphans} with NULL patient_id`);
      totalDup += dupRows;
      totalOrphan += orphans;

      if (apply && dupRows > 0) {
        const res = await client.query(
          `DELETE FROM ${t.name} WHERE id IN (
             SELECT id FROM (
               SELECT id, ROW_NUMBER() OVER (PARTITION BY ${keyList} ORDER BY id ASC) rn
               FROM ${t.name} WHERE patient_id IS NOT NULL
             ) x WHERE x.rn > 1
           )`
        );
        console.log(`  deleted ${res.rowCount} duplicate rows`);
      }

      if (apply && purgeOrphans && orphans > 0) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS sync_orphan_archive (
            id SERIAL PRIMARY KEY,
            source_table VARCHAR(100) NOT NULL,
            source_id INTEGER,
            row_data JSONB NOT NULL,
            archived_at TIMESTAMPTZ DEFAULT NOW(),
            reason TEXT
          )`);
        const copied = await client.query(
          `INSERT INTO sync_orphan_archive (source_table, source_id, row_data, reason)
           SELECT $1, id, to_jsonb(t), 'NULL patient_id — unreachable after sync push bug'
           FROM ${t.name} t WHERE patient_id IS NULL`,
          [t.name]
        );
        const res = await client.query(`DELETE FROM ${t.name} WHERE patient_id IS NULL`);
        console.log(`  archived ${copied.rowCount} then deleted ${res.rowCount} orphan rows`);
      }
    }

    console.log(`\nTOTAL: ${totalDup} duplicates, ${totalOrphan} orphans`);
    if (!apply) {
      console.log('DRY RUN — nothing deleted. Re-run with --apply.');
      console.log('Orphan rows also need --purge-orphans, which is separate on purpose.');
    }
  } catch (err) {
    console.error(`\nFailed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    try { client?.release(); } catch { /* already gone */ }
    await pool.end().catch(() => {});
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
