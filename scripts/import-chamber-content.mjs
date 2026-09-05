#!/usr/bin/env node
/**
 * Import the CHAMBER question bank and CME article library into this database.
 *
 *   node scripts/import-chamber-content.mjs [--seeds <dir>] [--dry-run] [--force]
 *
 * Applies database/migrations/010_chamber_content.sql first, then replays every
 * seed file from CHAMBER in dependency order. Each file is recorded in
 * content_migrations once it lands, so a second run imports nothing.
 *
 * Three adjustments are made to the seed SQL on the way through:
 *
 *   - 100_cme_schema_update.sql is skipped. It is the only DDL-bearing seed,
 *     and 010_chamber_content.sql already carries its tables with the column
 *     types this database needs (INTEGER people, UUID content).
 *
 *   - `INSERT INTO rotations` becomes `INSERT INTO content_rotations`.
 *     CHAMBER's `rotations` holds cohort date windows; this app already has a
 *     `rotations` concept of its own, so the imported one is renamed rather
 *     than colliding.
 *
 *   - Statements run one at a time and a unique violation is counted, not
 *     fatal. Most seed INSERTs carry no ON CONFLICT clause, and several files
 *     re-declare the same category or topic.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { splitStatements } from './lib/sqlSeedParser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DRY_RUN = flag('dry-run');
const FORCE = flag('force');

const DEFAULT_SEED_DIRS = [
  process.env.CHAMBER_SEEDS_DIR,
  path.resolve(ROOT, '../CHAMBER/packages/backend/database/seeds'),
  path.resolve(ROOT, '../../GitHub/CHAMBER/packages/backend/database/seeds'),
  'C:/Users/HomePC/Documents/GitHub/CHAMBER/packages/backend/database/seeds',
].filter(Boolean);

const SEEDS_DIR = opt('seeds', DEFAULT_SEED_DIRS.find((d) => fs.existsSync(d)));

/** Seeds that define schema rather than content. 010_chamber_content.sql wins. */
const SKIP_FILES = new Set(['100_cme_schema_update.sql']);

/**
 * Default curriculum: which surgery categories each level is expected to read.
 * Admins change this from Training Admin; it is only the starting point.
 */
const DEFAULT_CURRICULUM = {
  student_surgery_1: ['SURG1'],
  student_surgery_2: ['SURG2'],
  student_surgery_3: ['SURG3'],
  student_surgery_4: ['SURG4'],
  house_officer: ['SURG1', 'SURG2'],
  junior_registrar: ['SURG2', 'SURG3'],
  registrar: ['SURG3'],
  senior_registrar: ['SURG3', 'SURG4'],
};

/** Rewrites CHAMBER table names that collide with this app's own. */
function rewrite(sql) {
  return sql.replace(/INSERT\s+INTO\s+rotations\b/gi, 'INSERT INTO content_rotations');
}

/** 01 < 02 < 10 < 100 < 200 < 200b < 201. Leading number first, then text. */
function seedOrder(a, b) {
  const num = (f) => {
    const m = f.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };
  return num(a) - num(b) || a.localeCompare(b);
}

// ---------------------------------------------------------------------------

async function main() {
  if (!SEEDS_DIR || !fs.existsSync(SEEDS_DIR)) {
    console.error('Could not find the CHAMBER seeds directory.');
    console.error('Pass --seeds <dir> or set CHAMBER_SEEDS_DIR. Looked in:');
    DEFAULT_SEED_DIRS.forEach((d) => console.error(`  ${d}`));
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Export it before running this import.');
    process.exit(1);
  }

  const files = fs
    .readdirSync(SEEDS_DIR)
    .filter((f) => f.endsWith('.sql') && !SKIP_FILES.has(f))
    .sort(seedOrder);

  console.log(`Seeds:    ${SEEDS_DIR}`);
  console.log(`Files:    ${files.length} (${SKIP_FILES.size} skipped as schema)`);
  if (DRY_RUN) console.log('Mode:     dry run -- nothing will be written\n');

  const pool = new pg.Pool({
    // `sslmode=` in the URL makes pg build its own TLS config, which then wins
    // over the ssl option below and rejects DigitalOcean's certificate chain
    // ("self-signed certificate in certificate chain"). Strip it and be explicit.
    connectionString: process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/i, ''),
    ssl: { rejectUnauthorized: false },
    max: 4,
    connectionTimeoutMillis: 20000,
  });
  const client = await pool.connect();

  const summary = { applied: 0, skipped: 0, failed: 0, inserted: 0, duplicates: 0 };
  const failures = [];

  try {
    // 1. Schema.
    const migration = path.join(ROOT, 'database/migrations/010_chamber_content.sql');
    if (DRY_RUN) {
      console.log('would apply database/migrations/010_chamber_content.sql\n');
    } else {
      process.stdout.write('Applying 010_chamber_content.sql ... ');
      await client.query(fs.readFileSync(migration, 'utf8'));
      console.log('ok\n');
    }

    // 2. Seeds.
    const done = DRY_RUN
      ? new Map()
      : new Map(
          (await client.query('SELECT filename, checksum FROM content_migrations')).rows.map(
            (r) => [r.filename, r.checksum],
          ),
        );

    for (const file of files) {
      const raw = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(raw).digest('hex');

      if (!FORCE && done.get(file) === checksum) {
        summary.skipped += 1;
        continue;
      }

      const statements = splitStatements(rewrite(raw));
      if (DRY_RUN) {
        console.log(`would apply ${file} (${statements.length} statements)`);
        summary.applied += 1;
        continue;
      }

      const started = Date.now();
      let inserted = 0;
      let duplicates = 0;

      try {
        await client.query('BEGIN');
        for (const stmt of statements) {
          try {
            const r = await client.query(stmt);
            inserted += r.rowCount || 0;
          } catch (err) {
            // 23505 unique_violation: this row is already here. The seeds
            // re-declare shared categories and topics across files, and most
            // carry no ON CONFLICT clause of their own.
            if (err.code === '23505') {
              duplicates += 1;
              await client.query('ROLLBACK');
              await client.query('BEGIN');
              continue;
            }
            throw err;
          }
        }
        await client.query(
          `INSERT INTO content_migrations (filename, checksum, statements, duration_ms)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (filename) DO UPDATE
             SET checksum = EXCLUDED.checksum,
                 statements = EXCLUDED.statements,
                 duration_ms = EXCLUDED.duration_ms,
                 applied_at = CURRENT_TIMESTAMP`,
          [file, checksum, statements.length, Date.now() - started],
        );
        await client.query('COMMIT');

        summary.applied += 1;
        summary.inserted += inserted;
        summary.duplicates += duplicates;
        const note = duplicates ? ` (${duplicates} already present)` : '';
        console.log(`  ${file.padEnd(52)} ${String(inserted).padStart(5)} rows${note}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        summary.failed += 1;
        failures.push({ file, message: err.message });
        console.log(`  ${file.padEnd(52)} FAILED  ${err.message.split('\n')[0]}`);
      }
    }

    // 3. Quality fixes, applied to the imported content.
    if (DRY_RUN) {
      console.log('\nwould apply database/migrations/011_content_quality_fixes.sql');
    } else {
      process.stdout.write('\nApplying 011_content_quality_fixes.sql ... ');
      const before = (await client.query('SELECT COUNT(*)::int AS n FROM questions')).rows[0].n;
      await client.query(
        fs.readFileSync(path.join(ROOT, 'database/migrations/011_content_quality_fixes.sql'), 'utf8'),
      );
      const after = (await client.query('SELECT COUNT(*)::int AS n FROM questions')).rows[0].n;
      console.log(`ok (${before - after} duplicate questions removed)`);
    }

    // 4. Default curriculum mapping.
    if (!DRY_RUN) {
      for (const [level, codes] of Object.entries(DEFAULT_CURRICULUM)) {
        for (const code of codes) {
          await client.query(
            `INSERT INTO level_curriculum (training_level, category_id)
             SELECT $1, id FROM rotation_categories WHERE code = $2
             ON CONFLICT (training_level, category_id) DO NOTHING`,
            [level, code],
          );
        }
      }
    }

    // 5. What actually landed.
    if (!DRY_RUN) {
      const counts = await client.query(`
        SELECT
          (SELECT COUNT(*) FROM rotation_categories)      AS categories,
          (SELECT COUNT(*) FROM topics)                   AS topics,
          (SELECT COUNT(*) FROM questions)                AS questions,
          (SELECT COUNT(*) FROM cme_articles)             AS articles,
          (SELECT COUNT(*) FROM article_sections)         AS sections,
          (SELECT COUNT(*) FROM article_self_assessments) AS self_assessments,
          (SELECT COUNT(*) FROM article_references)       AS refs,
          (SELECT COUNT(*) FROM level_curriculum)         AS curriculum
      `);
      const c = counts.rows[0];
      console.log('\nIn the database now');
      console.log(`  categories        ${c.categories}`);
      console.log(`  topics            ${c.topics}`);
      console.log(`  questions         ${c.questions}`);
      console.log(`  CME articles      ${c.articles}`);
      console.log(`  article sections  ${c.sections}`);
      console.log(`  self-assessments  ${c.self_assessments}`);
      console.log(`  references        ${c.refs}`);
      console.log(`  curriculum rows   ${c.curriculum}`);
    }

    console.log(
      `\nFiles: ${summary.applied} applied, ${summary.skipped} already current, ${summary.failed} failed`,
    );
    if (failures.length) {
      console.log('\nFailures');
      failures.forEach((f) => console.log(`  ${f.file}\n    ${f.message}`));
    }
    process.exitCode = summary.failed ? 1 : 0;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
