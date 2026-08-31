/**
 * Where wound photographs are kept on the server.
 *
 * THE PROBLEM THIS SOLVES
 * Photographs were written to the capturing phone's IndexedDB and nowhere else.
 * The assessment row was given `image_url = "local:<ref>"` — a reference that
 * means something only on the device that minted it. Every other device, and
 * the same device after its browser storage was cleared, resolved that to
 * nothing, so a clinician could not see the photographs of a wound they had
 * documented themselves.
 *
 * TWO DRIVERS, ONE INTERFACE
 * `postgres` (default) keeps the bytes in the wound_images table. It needs no
 * credentials beyond DATABASE_URL, so cross-device viewing works on an existing
 * deployment the moment this ships.
 *
 * `supabase` keeps the bytes in an object storage bucket and the row becomes
 * metadata plus a path. It activates on its own once SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY are both set. Object storage is the better home for
 * this at volume — a ward's photographs will outgrow a database whose backups
 * are taken whole, and Supabase's free database tier is 500 MB against roughly
 * 300 KB a photograph.
 *
 * Rows record which driver wrote them, so a deployment that switches keeps
 * serving everything captured before the switch.
 *
 * NOT A THIRD-PARTY DISCLOSURE. This stores the photograph on the institution's
 * own systems, which is ordinary record-keeping. Sending a photograph to an
 * outside AI vendor is a different act governed by src/services/woundCloudConsent.ts
 * and is untouched by anything here.
 */

import { query } from './db.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_WOUND_BUCKET || 'wound-images';

/** Which driver new uploads will use. Existing rows are read by their own. */
export function activeDriver() {
  return SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? 'supabase' : 'postgres';
}

let tablesReady = false;

export async function ensureImageTable() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS wound_images (
      id SERIAL PRIMARY KEY,
      ref VARCHAR(64) UNIQUE NOT NULL,
      assessment_id INTEGER,
      wound_id INTEGER,
      patient_id INTEGER,
      kind VARCHAR(16) NOT NULL DEFAULT 'original',
      mime_type VARCHAR(60) NOT NULL DEFAULT 'image/jpeg',
      bytes INTEGER NOT NULL DEFAULT 0,
      width INTEGER,
      height INTEGER,
      captured_at TIMESTAMPTZ,
      uploaded_by INTEGER,
      storage_driver VARCHAR(16) NOT NULL DEFAULT 'postgres',
      storage_path TEXT,
      data BYTEA,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_wound_images_assessment ON wound_images(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_wound_images_wound ON wound_images(wound_id);
    CREATE INDEX IF NOT EXISTS idx_wound_images_patient ON wound_images(patient_id);
  `);
  tablesReady = true;
}

function supabaseObjectUrl(path) {
  return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/${BUCKET}/${path}`;
}

/**
 * Store one photograph and return the row's public descriptor.
 *
 * Idempotent on `ref`: a client retrying an upload it never saw acknowledged
 * must not create a second copy. The ref is minted at capture, so a retry
 * carries the same one.
 */
export async function putImage(meta, buffer) {
  await ensureImageTable();
  const driver = activeDriver();
  let storagePath = null;
  let data = null;

  if (driver === 'supabase') {
    storagePath = `${meta.patient_id || 'unassigned'}/${meta.ref}`;
    const res = await fetch(supabaseObjectUrl(storagePath), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': meta.mime_type || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buffer,
    });
    if (!res.ok) {
      throw new Error(`Supabase storage upload failed: ${res.status} ${await res.text()}`);
    }
  } else {
    data = buffer;
  }

  const r = await query(
    `INSERT INTO wound_images
       (ref, assessment_id, wound_id, patient_id, kind, mime_type, bytes,
        width, height, captured_at, uploaded_by, storage_driver, storage_path, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (ref) DO UPDATE SET
       assessment_id = COALESCE(EXCLUDED.assessment_id, wound_images.assessment_id),
       wound_id      = COALESCE(EXCLUDED.wound_id,      wound_images.wound_id),
       patient_id    = COALESCE(EXCLUDED.patient_id,    wound_images.patient_id)
     RETURNING id, ref, kind, mime_type, bytes, width, height, captured_at,
               assessment_id, wound_id, patient_id, storage_driver`,
    [
      meta.ref,
      meta.assessment_id ?? null,
      meta.wound_id ?? null,
      meta.patient_id ?? null,
      meta.kind || 'original',
      meta.mime_type || 'image/jpeg',
      buffer.length,
      meta.width ?? null,
      meta.height ?? null,
      meta.captured_at ?? null,
      meta.uploaded_by ?? null,
      driver,
      storagePath,
      data,
    ]
  );
  return r.rows[0];
}

/** Metadata for an assessment's photographs, without the bytes. */
export async function listImages({ assessment_id, wound_id, patient_id }) {
  await ensureImageTable();
  const where = [];
  const args = [];
  for (const [col, val] of [
    ['assessment_id', assessment_id],
    ['wound_id', wound_id],
    ['patient_id', patient_id],
  ]) {
    if (val != null && val !== '') {
      args.push(Number(val));
      where.push(`${col} = $${args.length}`);
    }
  }
  if (!where.length) return [];
  const r = await query(
    `SELECT ref, kind, mime_type, bytes, width, height, captured_at,
            assessment_id, wound_id, patient_id, storage_driver
       FROM wound_images
      WHERE ${where.join(' AND ')}
      ORDER BY captured_at DESC NULLS LAST, id DESC`,
    args
  );
  return r.rows;
}

/** One photograph's bytes, read through whichever driver wrote it. */
export async function getImage(ref) {
  await ensureImageTable();
  const r = await query(
    `SELECT ref, kind, mime_type, bytes, width, height, captured_at,
            assessment_id, wound_id, patient_id, storage_driver, storage_path, data
       FROM wound_images WHERE ref = $1`,
    [ref]
  );
  const row = r.rows[0];
  if (!row) return null;

  if (row.storage_driver === 'supabase') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Row is in Supabase storage but Supabase is not configured');
    }
    const res = await fetch(supabaseObjectUrl(row.storage_path), {
      headers: { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase storage read failed: ${res.status}`);
    row.data = Buffer.from(await res.arrayBuffer());
  }
  return row;
}
