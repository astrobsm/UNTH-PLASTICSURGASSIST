#!/usr/bin/env node
/**
 * Move everything CHAMBER holds into this app's database, so the CHAMBER
 * database can be retired.
 *
 *   SOURCE_DATABASE_URL=...  DATABASE_URL=...  node scripts/migrate-chamber-database.mjs [--dry-run] [--force]
 *
 * SOURCE_DATABASE_URL  the CHAMBER cluster. Its data lives in the `crp` schema.
 * DATABASE_URL         this app's database. Receives everything.
 *
 * Two destinations, because the two halves are used differently:
 *
 *   content    rotation_categories, topics, questions, cme_articles,
 *              article_sections, article_references, article_self_assessments
 *              -> the app's own schema, into the tables 010_chamber_content.sql
 *              creates. This is what the training module reads every day.
 *
 *   records    students, assessors, rotations, attendance, participation,
 *              tests, competency and the rest -- everything else CHAMBER had
 *              -> a `chamber_legacy` schema, structure and ids preserved
 *              exactly. Nothing is reshaped and nothing is dropped, so the old
 *              database can be closed without losing history, and identities
 *              can be reconciled with this app's own students later against
 *              a record that still exists.
 *
 * Exact duplicate rows are dropped on the way in -- CHAMBER's live bank holds
 * each question about five times over, the residue of seed files replayed
 * against tables with no ON CONFLICT clause. Questions differing only in their
 * options are NOT collapsed; see 011_content_quality_fixes.sql.
 *
 * Re-runnable. Content upserts on its natural key; legacy tables are replaced
 * wholesale under --force, and skipped if already populated otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const FORCE = argv.includes('--force');

const LEGACY_SCHEMA = 'chamber_legacy';

/** Copied into the app's own content tables, parents before children. */
const CONTENT_TABLES = [
  'rotation_categories',
  'topics',
  'cme_articles',
  'article_sections',
  'article_references',
  'article_self_assessments',
  'questions',
];

/**
 * The signature that decides whether two content rows are the same row.
 * Exact content, so genuine variants survive and re-imports do not.
 */
const CONTENT_KEY = {
  rotation_categories: ['code'],
  topics: ['id'],
  cme_articles: ['id'],
  article_sections: ['article_id', 'section_type', 'section_order'],
  article_references: ['article_id', 'reference_number'],
  article_self_assessments: ['article_id', 'question_number'],
  questions: [
    'topic_id', 'category_id', 'question_text', 'option_a', 'option_b',
    'option_c', 'option_d', 'option_e', 'correct_option', 'explanation',
  ],
};

/**
 * `sslmode=` in a URL makes pg build its own TLS config, which then wins over
 * the ssl option and rejects DigitalOcean's chain.
 */
const connect = (url) => new pg.Pool({
  connectionString: url.replace(/[?&]sslmode=[^&]*/i, ''),
  ssl: { rejectUnauthorized: false },
  max: 4,
  connectionTimeoutMillis: 30000,
});

const scalar = async (client, sql, params = []) => {
  const r = await client.query(sql, params);
  return r.rows[0] ? Number(Object.values(r.rows[0])[0]) : 0;
};

/** Column names of a table, in order. */
async function columnsOf(client, schema, table) {
  const r = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
    [schema, table],
  );
  return r.rows.map((x) => x.column_name);
}

async function tablesIn(client, schema) {
  const r = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE' ORDER BY table_name`,
    [schema],
  );
  return r.rows.map((x) => x.table_name);
}

// ---------------------------------------------------------------------------

/**
 * Copies one content table across, deduplicating on its natural key.
 *
 * Rows move in batches through a multi-row INSERT ... ON CONFLICT DO NOTHING,
 * which is what makes a second run a no-op rather than a second copy.
 */
async function copyContentTable(src, dst, table, report) {
  const srcCols = await columnsOf(src, 'crp', table);
  const dstCols = await columnsOf(dst, 'public', table);
  if (!dstCols.length) {
    report.push(`  ${table.padEnd(28)} SKIPPED — not in the target; run 010_chamber_content.sql first`);
    return;
  }

  // Only columns both sides have. CHAMBER's created_by is a UUID pointing at
  // its own users; this app's is an INTEGER pointing at its own, so it is left
  // behind rather than carried across meaning nothing.
  const shared = srcCols.filter((c) => dstCols.includes(c) && c !== 'created_by' && c !== 'reviewed_by');
  const key = (CONTENT_KEY[table] || ['id']).filter((c) => shared.includes(c));

  const total = await scalar(src, `SELECT COUNT(*) FROM crp."${table}"`);
  const distinct = key.length
    ? await scalar(src, `SELECT COUNT(*) FROM (SELECT DISTINCT ${key.map((c) => `"${c}"`).join(', ')} FROM crp."${table}") x`)
    : total;

  if (DRY_RUN) {
    report.push(`  ${table.padEnd(28)} ${String(total).padStart(6)} rows -> ${String(distinct).padStart(6)} after dedupe`);
    return;
  }

  const cols = shared.map((c) => `"${c}"`).join(', ');
  // DISTINCT ON keeps the first row of each key group; ordering by the key then
  // created_at makes "first" mean "earliest", not "whichever the planner found".
  const orderCol = srcCols.includes('created_at') ? ', created_at' : '';
  const sourceQuery = key.length
    ? `SELECT DISTINCT ON (${key.map((c) => `"${c}"`).join(', ')}) ${cols}
       FROM crp."${table}" ORDER BY ${key.map((c) => `"${c}"`).join(', ')}${orderCol}`
    : `SELECT ${cols} FROM crp."${table}"`;

  const rows = (await src.query(sourceQuery)).rows;
  let inserted = 0;
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = slice.map((row) => {
      const placeholders = shared.map((c) => {
        params.push(row[c]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const conflict = key.length ? `(${key.map((c) => `"${c}"`).join(', ')})` : '';
    const sql = `INSERT INTO "${table}" (${cols}) VALUES ${tuples.join(', ')}`
      + (conflict ? ` ON CONFLICT ${conflict} DO NOTHING` : ' ON CONFLICT DO NOTHING');
    const r = await dst.query(sql, params);
    inserted += r.rowCount || 0;
  }

  report.push(`  ${table.padEnd(28)} ${String(total).padStart(6)} source -> ${String(inserted).padStart(6)} inserted`
    + (total !== distinct ? `  (${total - distinct} duplicates dropped)` : ''));
}

/**
 * Copies a CHAMBER table verbatim into chamber_legacy, creating it from the
 * source's own definition. Structure and ids are preserved exactly.
 */
async function copyLegacyTable(src, dst, table, report) {
  const cols = await src.query(
    `SELECT column_name, data_type, udt_name, character_maximum_length,
            numeric_precision, numeric_scale, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'crp' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  );
  if (!cols.rows.length) return;

  const total = await scalar(src, `SELECT COUNT(*) FROM crp."${table}"`);
  if (DRY_RUN) {
    report.push(`  ${table.padEnd(30)} ${String(total).padStart(6)} rows`);
    return;
  }

  // Enum and other user-defined types do not exist in the target; text keeps
  // the value readable without dragging CHAMBER's type system across.
  const ddl = cols.rows.map((c) => {
    let type = c.data_type;
    if (type === 'USER-DEFINED') type = 'text';
    else if (type === 'character varying') type = c.character_maximum_length ? `varchar(${c.character_maximum_length})` : 'text';
    else if (type === 'numeric' && c.numeric_precision) type = `numeric(${c.numeric_precision},${c.numeric_scale})`;
    else if (type === 'ARRAY') type = 'text[]';
    return `  "${c.column_name}" ${type}`;
  }).join(',\n');

  await dst.query(`CREATE TABLE IF NOT EXISTS ${LEGACY_SCHEMA}."${table}" (\n${ddl}\n)`);

  const existing = await scalar(dst, `SELECT COUNT(*) FROM ${LEGACY_SCHEMA}."${table}"`);
  if (existing > 0 && !FORCE) {
    report.push(`  ${table.padEnd(30)} skipped — ${existing} rows already there (use --force to replace)`);
    return;
  }
  if (existing > 0) await dst.query(`TRUNCATE ${LEGACY_SCHEMA}."${table}"`);

  if (total === 0) {
    report.push(`  ${table.padEnd(30)} ${String(0).padStart(6)} rows (empty)`);
    return;
  }

  const names = cols.rows.map((c) => `"${c.column_name}"`).join(', ');
  const rows = (await src.query(`SELECT ${names} FROM crp."${table}"`)).rows;
  const colNames = cols.rows.map((c) => c.column_name);
  let inserted = 0;
  const BATCH = 500;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const params = [];
    const tuples = slice.map((row) => {
      const ph = colNames.map((c) => {
        const v = row[c];
        params.push(v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v)
          ? JSON.stringify(v) : v);
        return `$${params.length}`;
      });
      return `(${ph.join(', ')})`;
    });
    const r = await dst.query(`INSERT INTO ${LEGACY_SCHEMA}."${table}" (${names}) VALUES ${tuples.join(', ')}`, params);
    inserted += r.rowCount || 0;
  }
  report.push(`  ${table.padEnd(30)} ${String(inserted).padStart(6)} rows`);
}

// ---------------------------------------------------------------------------

async function main() {
  const SOURCE = process.env.SOURCE_DATABASE_URL;
  const TARGET = process.env.DATABASE_URL;
  if (!SOURCE || !TARGET) {
    console.error('Set both SOURCE_DATABASE_URL (CHAMBER) and DATABASE_URL (this app).');
    process.exit(1);
  }
  if (SOURCE.replace(/[?&]sslmode=[^&]*/i, '') === TARGET.replace(/[?&]sslmode=[^&]*/i, '')) {
    console.error('Source and target are the same database. Refusing to run.');
    process.exit(1);
  }

  const srcPool = connect(SOURCE);
  const dstPool = connect(TARGET);
  const src = await srcPool.connect();
  const dst = await dstPool.connect();

  try {
    const [{ current_database: srcName }] = (await src.query('SELECT current_database()')).rows;
    const [{ current_database: dstName }] = (await dst.query('SELECT current_database()')).rows;
    console.log(`Source: ${srcName} (crp schema)`);
    console.log(`Target: ${dstName}`);
    if (DRY_RUN) console.log('Mode:   dry run — nothing will be written\n');
    else console.log('');

    // 1. Content tables must exist in the target.
    if (!DRY_RUN) {
      process.stdout.write('Applying 010_chamber_content.sql to the target ... ');
      await dst.query(fs.readFileSync(path.join(ROOT, 'database/migrations/010_chamber_content.sql'), 'utf8'));
      console.log('ok');
      await dst.query(`CREATE SCHEMA IF NOT EXISTS ${LEGACY_SCHEMA}`);
    }

    // 2. Content.
    console.log('\nContent');
    const contentReport = [];
    for (const t of CONTENT_TABLES) await copyContentTable(src, dst, t, contentReport);
    contentReport.forEach((l) => console.log(l));

    // 3. Everything else, verbatim.
    console.log(`\nRecords -> ${LEGACY_SCHEMA}`);
    const all = await tablesIn(src, 'crp');
    const rest = all.filter((t) => !CONTENT_TABLES.includes(t));
    const legacyReport = [];
    for (const t of rest) await copyLegacyTable(src, dst, t, legacyReport);
    legacyReport.forEach((l) => console.log(l));

    // 4. Quality fixes, then what landed.
    if (!DRY_RUN) {
      process.stdout.write('\nApplying 011_content_quality_fixes.sql ... ');
      await dst.query(fs.readFileSync(path.join(ROOT, 'database/migrations/011_content_quality_fixes.sql'), 'utf8'));
      console.log('ok');

      const c = (await dst.query(`
        SELECT (SELECT COUNT(*) FROM rotation_categories)      AS categories,
               (SELECT COUNT(*) FROM topics)                   AS topics,
               (SELECT COUNT(*) FROM questions)                AS questions,
               (SELECT COUNT(*) FROM cme_articles)             AS articles,
               (SELECT COUNT(*) FROM article_sections)         AS sections,
               (SELECT COUNT(*) FROM article_self_assessments) AS self_assessments`)).rows[0];
      console.log('\nIn the target now');
      Object.entries(c).forEach(([k, v]) => console.log(`  ${k.padEnd(18)} ${v}`));
    }

    console.log(DRY_RUN ? '\nDry run complete — nothing was written.' : '\nMigration complete.');
  } finally {
    src.release(); dst.release();
    await srcPool.end(); await dstPool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
