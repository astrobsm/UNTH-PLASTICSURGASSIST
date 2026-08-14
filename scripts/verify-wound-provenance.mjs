#!/usr/bin/env node
/**
 * Confirms the wound provenance migration actually landed in the database.
 *
 * Run from the repo root, like apply-migration.mjs — db-env.mjs resolves
 * .env.local relative to cwd, and the pool is closed in a finally because
 * DATABASE_URL points at the Supabase transaction pooler.
 */

import pg from 'pg';
import { requireDatabaseUrl } from '../db-env.mjs';

const { Pool } = pg;

const EXPECTED = [
  'ai_contour_cm', 'clinician_contour_cm', 'correction_reason',
  'model_name', 'model_version', 'model_checksum', 'preprocessing_version',
  'image_quality_score', 'image_quality_flags', 'tissue_source',
  'epithelialised_pct', 'residual_raw_pct', 'no_wound_detected',
];

const pool = new Pool({
  connectionString: requireDatabaseUrl(),
  ssl: { rejectUnauthorized: false },
});
try {
  const { rows } = await pool.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_name = 'wound_assessments'`
  );
  const present = new Set(rows.map(r => r.column_name));
  const missing = EXPECTED.filter(c => !present.has(c));

  console.log(`wound_assessments columns: ${present.size}`);
  console.log(`provenance columns present: ${EXPECTED.length - missing.length}/${EXPECTED.length}`);
  if (missing.length) console.log(`MISSING: ${missing.join(', ')}`);

  const total = await pool.query('SELECT COUNT(*)::int AS n FROM wound_assessments');
  console.log(`assessments on file: ${total.rows[0].n}`);

  if (present.has('tissue_source')) {
    const dist = await pool.query(
      `SELECT COALESCE(tissue_source, '(null)') AS src, COUNT(*)::int AS n
         FROM wound_assessments GROUP BY 1 ORDER BY 2 DESC`
    );
    console.log('tissue_source:', dist.rows.map(r => `${r.src}=${r.n}`).join(', ') || '(no rows)');

    const nulls = await pool.query(
      `SELECT COUNT(*)::int AS n FROM wound_assessments WHERE tissue_source IS NULL`
    );
    console.log(`rows still NULL after backfill: ${nulls.rows[0].n}`);
  }

  process.exitCode = missing.length ? 1 : 0;
} finally {
  await pool.end();
}
