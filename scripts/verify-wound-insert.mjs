#!/usr/bin/env node
/**
 * Proves the wound_assessments INSERT actually executes against the real
 * schema, with the real column list and the real parameter count.
 *
 * Static counting of $-placeholders against array entries is fragile — prose in
 * the surrounding comments contains commas, and a miscount there is
 * indistinguishable from a genuine arity bug. The database is the authority, so
 * ask it.
 *
 * Everything happens inside a transaction that is ALWAYS rolled back, so this
 * is safe to run against production and leaves nothing behind.
 */

import pg from 'pg';
import { requireDatabaseUrl } from '../db-env.mjs';

const { Pool } = pg;

const COLUMNS = `
  wound_id, patient_id, assessed_by, assessed_at, length_cm, width_cm, depth_cm,
  area_cm2, perimeter_cm, granulation_pct, slough_pct, necrotic_pct, epithelial_pct,
  exudate_amount, exudate_type, edges, periwound_skin, signs_of_infection, pain_score,
  healing_stage, push_score, bwat_score, clinical_description, ai_confidence,
  ai_raw_response, calibration_type, scale_reliable, contour_cm, image_url, overlay_url,
  approved_by, approved_at, notes,
  ai_contour_cm, clinician_contour_cm, correction_reason,
  model_name, model_version, model_checksum, preprocessing_version,
  image_quality_score, image_quality_flags, tissue_source,
  epithelialised_pct, residual_raw_pct, no_wound_detected`;

const VALUES = `$1,$2,$3,COALESCE($4, NOW()),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
  $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
  $34,$35,$36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46`;

const params = [
  1, 1, null, null, 3.0, 2.0, null, 6.0, 10.0, null, null, null, null,
  null, null, null, null, JSON.stringify([]), null,
  null, null, null, 'arity probe', 0.5,
  JSON.stringify({}), 'green_marker', true, JSON.stringify([]), null, null,
  null, null, null,
  JSON.stringify([{ x: 0, y: 0 }]), null, null,
  'on-device-cv', '2026.08-cv1', null, '2026.08-cv1',
  0.87, JSON.stringify(['glare']), 'clinician',
  null, null, false,
];

const columnCount = COLUMNS.split(',').filter(c => c.trim()).length;
console.log(`columns: ${columnCount}  parameters: ${params.length}`);

const pool = new Pool({ connectionString: requireDatabaseUrl(), ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const { rows } = await client.query(
    `INSERT INTO wound_assessments (${COLUMNS}) VALUES (${VALUES}) RETURNING id, tissue_source, image_quality_score, model_version, ai_contour_cm, no_wound_detected`,
    params
  );
  const r = rows[0];
  console.log('INSERT executed against the real schema — OK');
  console.log(`  tissue_source       ${r.tissue_source}`);
  console.log(`  image_quality_score ${r.image_quality_score}`);
  console.log(`  model_version       ${r.model_version}`);
  console.log(`  ai_contour_cm       ${JSON.stringify(r.ai_contour_cm)}`);
  console.log(`  no_wound_detected   ${r.no_wound_detected}`);
} catch (e) {
  console.error('INSERT FAILED:', e.message);
  process.exitCode = 1;
} finally {
  // Always. This probe must never leave a row behind.
  await client.query('ROLLBACK').catch(() => {});
  client.release();
  await pool.end();
  console.log('rolled back — nothing written');
}
