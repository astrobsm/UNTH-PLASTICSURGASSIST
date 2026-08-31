/**
 * Wound photograph upload and retrieval.
 *
 * Photographs are captured to the device's IndexedDB first, so that a ward with
 * no signal never blocks a clinician. This endpoint is the second half of that:
 * the queued copy is pushed here, and any device that did not take the
 * photograph pulls it back by the same `ref`.
 *
 *   POST /api/wound-images                  upload one photograph
 *   GET  /api/wound-images?ref=…            one photograph, bytes included
 *   GET  /api/wound-images?assessment_id=…  metadata for a set, no bytes
 *
 * Bytes travel as base64 in JSON rather than as multipart. The client already
 * speaks JSON with a bearer token through apiClient, an <img src> cannot carry
 * that token, and the browser must put the blob in IndexedDB anyway so the
 * photograph is there next time the ward has no signal. Fetch-then-cache is
 * what that design wants; a raw image route would bypass both the auth header
 * and the cache.
 *
 * The client downscales before sending (see woundImageSync.ts) to stay well
 * inside the serverless body limit.
 */

import { cors, authenticateRequest } from './_lib/auth.js';
import { putImage, getImage, listImages } from './_lib/imageStorage.js';

// Base64 inflates by 4/3; this bounds the decoded image, not the payload.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(401).json({ error: auth.error });
  }

  try {
    if (req.method === 'POST') {
      const b = req.body || {};
      if (!b.ref) return res.status(400).json({ error: 'ref is required' });
      if (!b.data_base64) return res.status(400).json({ error: 'data_base64 is required' });

      const buffer = Buffer.from(String(b.data_base64), 'base64');
      if (!buffer.length) return res.status(400).json({ error: 'data_base64 did not decode to any bytes' });
      if (buffer.length > MAX_IMAGE_BYTES) {
        return res.status(413).json({ error: `Image exceeds ${MAX_IMAGE_BYTES} bytes` });
      }

      const row = await putImage(
        {
          ref: b.ref,
          assessment_id: b.assessment_id ?? null,
          wound_id: b.wound_id ?? null,
          patient_id: b.patient_id ?? null,
          kind: b.kind || 'original',
          mime_type: b.mime_type || 'image/jpeg',
          width: b.width ?? null,
          height: b.height ?? null,
          captured_at: b.captured_at ?? null,
          uploaded_by: auth.user?.id ?? null,
        },
        buffer
      );

      // The path the assessment row should carry from now on. Any device can
      // resolve it; "local:<ref>" could only ever be resolved by one.
      return res.status(201).json({ ...row, remote_path: `/wound-images?ref=${row.ref}` });
    }

    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const ref = url.searchParams.get('ref');

      if (ref) {
        const row = await getImage(ref);
        if (!row) return res.status(404).json({ error: 'No such image' });
        const { data, storage_path, ...meta } = row;
        return res.status(200).json({
          ...meta,
          remote_path: `/wound-images?ref=${row.ref}`,
          data_base64: Buffer.from(data).toString('base64'),
        });
      }

      const rows = await listImages({
        assessment_id: url.searchParams.get('assessment_id'),
        wound_id: url.searchParams.get('wound_id'),
        patient_id: url.searchParams.get('patient_id'),
      });
      return res.status(200).json({
        images: rows.map(r => ({ ...r, remote_path: `/wound-images?ref=${r.ref}` })),
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Wound images API error:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
