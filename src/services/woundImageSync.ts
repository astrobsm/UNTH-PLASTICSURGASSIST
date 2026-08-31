/**
 * Moves wound photographs between this device and the server.
 *
 * THE PROBLEM THIS SOLVES
 * woundImageStore writes every photograph to IndexedDB and leaves rows without
 * a `remote_path` as an upload queue. Nothing ever drained that queue, and
 * nothing ever read a photograph back, so `listPendingUploads`, `markUploaded`
 * and `getImagesForAssessment` had no callers at all. The consequences were the
 * ones clinicians reported: a wound photographed on one phone was invisible on
 * every other phone, and invisible on the same phone once its browser storage
 * was cleared. The assessment row recorded `image_url = "local:<ref>"`, which
 * only the capturing device could ever resolve.
 *
 * DIRECTION OF TRAVEL
 * Up: drain the queue whenever there is a network, never during capture.
 * Down: fetch a ref this device has never held, then keep it, so the second
 * viewing works offline like any photograph taken here.
 *
 * Uploading is deliberately not part of saving an assessment. A clinician on a
 * ward with no signal must still be able to complete the record.
 */

import { apiClient } from './apiClient';
import {
  listPendingUploads,
  markUploaded,
  markUploadFailed,
  cacheRemoteImage,
  getImageUrl,
  hasLocalBlob,
  type WoundImageKind,
} from './woundImageStore';
import { logger } from '../utils/logger';

/** Give up on a photograph the server keeps rejecting, rather than loop on it. */
const MAX_ATTEMPTS = 5;

/** Longest edge kept when uploading. Full-resolution phone photographs are far
 *  larger than wound assessment needs and push the request past the serverless
 *  body limit; 1600px preserves the detail the measurement work relies on. */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export interface WoundImageMeta {
  ref: string;
  kind: WoundImageKind;
  mime_type: string;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  assessment_id: number | null;
  wound_id: number | null;
  patient_id: number | null;
  remote_path: string;
}

/**
 * Shrink a photograph for transport, keeping the original on the device.
 *
 * Returns the input untouched when it is already small enough, so a photograph
 * that needs no re-encoding does not lose a generation of JPEG quality.
 */
export async function downscaleForUpload(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return blob;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return blob; // Not decodable here; let the server size limit judge it.
  }
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= MAX_EDGE) return blob;

    const scale = MAX_EDGE / longest;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return blob;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const out = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    return out && out.size < blob.size ? out : blob;
  } finally {
    bitmap.close?.();
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image'));
    reader.onload = () => {
      const result = String(reader.result || '');
      // data:<mime>;base64,<payload> — the server wants only the payload.
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

let draining = false;

/**
 * Push everything this device is still holding alone.
 *
 * Safe to call often — it is a no-op offline, and a second concurrent call
 * returns immediately rather than uploading the same rows twice.
 */
export async function syncPendingWoundImages(limit = 25): Promise<{ uploaded: number; failed: number }> {
  if (draining) return { uploaded: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { uploaded: 0, failed: 0 };
  }

  draining = true;
  let uploaded = 0;
  let failed = 0;
  try {
    const pending = await listPendingUploads(limit);
    for (const row of pending) {
      if ((row.attempts || 0) >= MAX_ATTEMPTS) continue;
      try {
        const body = await downscaleForUpload(row.blob);
        const saved = await apiClient.post<{ ref: string; remote_path: string }>(
          '/wound-images',
          {
            ref: row.ref,
            kind: row.kind,
            mime_type: body.type || 'image/jpeg',
            width: row.width,
            height: row.height,
            captured_at: row.captured_at,
            assessment_id: row.assessment_id ?? null,
            wound_id: row.wound_id ?? null,
            patient_id: row.patient_id ?? null,
            data_base64: await blobToBase64(body),
          }
        );
        await markUploaded(row.ref, saved.remote_path || `/wound-images?ref=${row.ref}`);
        uploaded++;
      } catch (err: any) {
        await markUploadFailed(row.ref, err?.message || 'Upload failed');
        failed++;
      }
    }
  } finally {
    draining = false;
  }

  if (uploaded || failed) {
    logger.log(`Wound images: ${uploaded} uploaded, ${failed} failed`);
  }
  return { uploaded, failed };
}

/** What the server holds for an assessment — including photographs this device never took. */
export async function listRemoteImages(params: {
  assessmentId?: number | null;
  woundId?: number | null;
  patientId?: number | null;
}): Promise<WoundImageMeta[]> {
  const qs = new URLSearchParams();
  if (params.assessmentId != null) qs.set('assessment_id', String(params.assessmentId));
  if (params.woundId != null) qs.set('wound_id', String(params.woundId));
  if (params.patientId != null) qs.set('patient_id', String(params.patientId));
  if (![...qs.keys()].length) return [];

  const data = await apiClient.get<{ images: WoundImageMeta[] }>(`/wound-images?${qs.toString()}`);
  return data?.images || [];
}

/**
 * A displayable URL for a ref, wherever the bytes happen to be.
 *
 * Local first, because that is instant and works with no signal. Otherwise pull
 * it once and keep it, so this is the only time the network is needed.
 */
export async function resolveWoundImageUrl(
  ref: string,
  hint?: Partial<WoundImageMeta>
): Promise<string | null> {
  if (await hasLocalBlob(ref)) return getImageUrl(ref);

  try {
    const row = await apiClient.get<WoundImageMeta & { data_base64: string }>(
      `/wound-images?ref=${encodeURIComponent(ref)}`
    );
    if (!row?.data_base64) return null;

    const blob = base64ToBlob(row.data_base64, row.mime_type || 'image/jpeg');
    await cacheRemoteImage({
      ref,
      blob,
      kind: (row.kind || hint?.kind || 'original') as WoundImageKind,
      width: row.width ?? hint?.width ?? null,
      height: row.height ?? hint?.height ?? null,
      assessmentId: row.assessment_id ?? hint?.assessment_id ?? null,
      woundId: row.wound_id ?? hint?.wound_id ?? null,
      patientId: row.patient_id ?? hint?.patient_id ?? null,
      capturedAt: row.captured_at ?? hint?.captured_at ?? null,
      remotePath: row.remote_path || `/wound-images?ref=${ref}`,
    });
    return URL.createObjectURL(blob);
  } catch (err) {
    logger.warn(`Wound image ${ref} could not be fetched`, err);
    return null;
  }
}

/**
 * Turn whatever an assessment recorded into a ref.
 *
 * Rows written before photographs were uploadable carry "local:<ref>", which
 * resolves on exactly one device. The ref inside it is still the right one, so
 * those rows start working as soon as that device drains its queue.
 */
export function refFromImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('local:')) return imageUrl.slice('local:'.length);
  const m = /[?&]ref=([^&]+)/.exec(imageUrl);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * Drain the queue when the app starts and whenever the network returns.
 *
 * Registered once from App, so a photograph taken on a ward with no signal
 * leaves the device as soon as there is one — without the clinician having to
 * remember to reopen the assessment.
 */
export function startWoundImageSync(): () => void {
  const drain = () => { void syncPendingWoundImages(); };
  drain();
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('online', drain);
  return () => window.removeEventListener('online', drain);
}
