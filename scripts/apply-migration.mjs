#!/usr/bin/env node
/**
 * apply-migration.mjs — apply the repo's add-*.sql migrations, tracked.
 *
 *   node scripts/apply-migration.mjs add-tumor-board-tables.sql
 *   node scripts/apply-migration.mjs --all         # every add-*.sql, in name order
 *   node scripts/apply-migration.mjs --status      # what is applied, what is pending
 *   node scripts/apply-migration.mjs <file> --force  # re-apply an already-applied file
 *
 * Run from the repo root: db-env.mjs resolves .env.local relative to cwd.
 *
 * Applied files are recorded in `schema_migrations` with a checksum, so
 * re-running is a no-op and an edited-after-apply file is reported loudly rather
 * than silently diverging from the database.
 *
 * The migrations themselves are written with CREATE TABLE IF NOT EXISTS, so they
 * are independently safe to re-run — the tracking table exists to tell you what
 * state the database is actually in, which the SQL alone cannot.
 *
 * POOLER NOTE: DATABASE_URL points at the Supabase TRANSACTION pooler (port
 * 6543). Two consequences, both handled below:
 *   - node-postgres must not leave the pool open or the script hangs instead of
 *     exiting; pool.end() runs in a finally.
 *   - Multi-statement SQL is sent via the simple query protocol (query text with
 *     no parameters), which the transaction pooler handles. Do not add bind
 *     parameters to the migration body.
 */

import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireDatabaseUrl } from '../db-env.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { Pool } = pg;

const args = process.argv.slice(2);
const force = args.includes('--force');
const applyAll = args.includes('--all');
const statusOnly = args.includes('--status');
const named = args.filter(a => !a.startsWith('--'));

const checksum = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

const discover = () =>
  readdirSync(ROOT)
    .filter(f => f.startsWith('add-') && f.endsWith('.sql'))
    .sort();

async function ensureTracking(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(200) PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      applied_by VARCHAR(120)
    );
  `);
}

async function appliedMap(client) {
  const res = await client.query(`SELECT filename, checksum, applied_at FROM schema_migrations`);
  return new Map(res.rows.map(r => [r.filename, r]));
}

async function main() {
  const DATABASE_URL = requireDatabaseUrl();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    max: 1,
  });

  let client;
  let failures = 0;

  try {
    client = await pool.connect();
    const host = DATABASE_URL.replace(/:[^:@]*@/, ':***@').replace(/^.*@/, '');
    console.log(`Connected: ${host}\n`);

    await ensureTracking(client);
    const already = await appliedMap(client);

    const files = applyAll ? discover() : named;

    if (statusOnly || (!files.length && !applyAll)) {
      console.log('Migration status\n');
      for (const f of discover()) {
        const rec = already.get(f);
        const sum = checksum(readFileSync(path.join(ROOT, f), 'utf8'));
        if (!rec) console.log(`  PENDING  ${f}`);
        else if (rec.checksum !== sum) console.log(`  CHANGED  ${f}  (applied ${rec.applied_at.toISOString().slice(0, 10)}, file edited since)`);
        else console.log(`  applied  ${f}  (${rec.applied_at.toISOString().slice(0, 10)})`);
      }
      if (!statusOnly) {
        console.log('\nNothing to do. Pass a filename, or --all.');
      }
      return;
    }

    for (const file of files) {
      const full = path.join(ROOT, file);
      if (!existsSync(full)) {
        console.error(`  MISSING  ${file} — no such file`);
        failures++;
        continue;
      }

      const sql = readFileSync(full, 'utf8');
      const sum = checksum(sql);
      const rec = already.get(file);

      if (rec && !force) {
        if (rec.checksum !== sum) {
          // Loud, but not fatal: the operator has to decide whether the edit is
          // additive (safe to re-apply) or a rewrite of history (not).
          console.warn(`  CHANGED  ${file} — applied ${rec.applied_at.toISOString().slice(0, 10)} but the file has been edited since.`);
          console.warn(`           Re-apply with --force if the change is additive, or write a new migration.`);
        } else {
          console.log(`  skipped  ${file} (already applied)`);
        }
        continue;
      }

      process.stdout.write(`  applying ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (filename, checksum, applied_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = NOW()`,
          [file, sum, process.env.USER || process.env.USERNAME || 'script']
        );
        await client.query('COMMIT');
        console.log('ok');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.log('FAILED');
        console.error(`           ${err.message}`);
        failures++;
      }
    }
  } catch (err) {
    console.error(`\nMigration run failed: ${err.message}`);
    failures++;
  } finally {
    // Must release and drain, or the transaction pooler keeps the process alive.
    try { client?.release(); } catch { /* already gone */ }
    await pool.end().catch(() => {});
  }

  process.exit(failures ? 1 : 0);
}

main();
