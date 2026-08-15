/**
 * Where wound photographs live.
 *
 * THE PROBLEM THIS SOLVES
 * They were not being stored at all. Both wound pages held an object URL in
 * memory while the modal was open, `image_url` was written by no code path, and
 * every photograph was discarded when the dialog closed. Two consequences:
 * serial photo comparison could never work, and — worse — the clinician-corrected
 * outlines being collected had no image attached. A contour on its own cannot
 * train a segmentation model, so the correction loop was producing half of each
 * training example and throwing the other half away.
 *
 * DESIGN
 * The blob is written to IndexedDB first, always. That is what makes capture
 * work on a ward with no signal, and it means the photograph is safe before any
 * network operation is attempted. Rows without a `remote_path` are the upload
 * queue; uploading is a later, retryable step that never blocks the clinician.
 *
 * `ref` is a stable identifier minted at capture and carried on the assessment,
 * so a photograph can be found again whether it is still local, already
 * uploaded, or both.
 */

import { db } from '../db/database';

export type WoundImageKind = 'original' | 'overlay';

export interface WoundImageRecord {
  id?: number;
  /** Stable id minted at capture; survives upload. */
  ref: string;
  /** Null until the assessment it belongs to has been saved. */
  assessment_id?: number | null;
  wound_id?: number | null;
  patient_id?: number | null;
  kind: WoundImageKind;
  blob: Blob;
  /**
   * Size in bytes, recorded at capture.
   *
   * Kept alongside the blob rather than read back from it, so quota accounting
   * never has to load every photograph into memory to add up their sizes — on a
   * device holding a ward round's worth, that is the difference between a cheap
   * number and a stall.
   */
  bytes: number;
  width: number;
  height: number;
  captured_at: string;
  /** Set once the file is in object storage. Null means "still only local". */
  remote_path?: string | null;
  uploaded_at?: string | null;
  /** Number of failed upload attempts, so a poison row can be spotted. */
  attempts?: number;
  last_error?: string | null;
}

function mintRef(): string {
  // crypto.randomUUID is not available in every embedded browser this runs in.
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `wi_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * Persist a photograph locally and return its ref.
 *
 * Deliberately does not attempt an upload. Capture must never wait on the
 * network, and a clinician photographing a wound should not be able to tell
 * whether the ward has signal.
 */
export async function putLocalImage(params: {
  blob: Blob;
  kind: WoundImageKind;
  width: number;
  height: number;
  woundId?: number | null;
  patientId?: number | null;
}): Promise<string> {
  const ref = mintRef();
  const record: WoundImageRecord = {
    ref,
    kind: params.kind,
    blob: params.blob,
    bytes: params.blob.size,
    width: params.width,
    height: params.height,
    wound_id: params.woundId ?? null,
    patient_id: params.patientId ?? null,
    assessment_id: null,
    captured_at: new Date().toISOString(),
    remote_path: null,
    uploaded_at: null,
    attempts: 0,
    last_error: null,
  };
  await db.table('wound_images').add(record);
  return ref;
}

/**
 * Attach saved images to the assessment they belong to.
 *
 * Called after the assessment row exists, because until then there is no id to
 * point at. Without this the photographs would be orphaned and the pairing with
 * the corrected contour — the thing that makes them worth keeping — would be
 * lost.
 */
export async function attachToAssessment(refs: string[], assessmentId: number, woundId?: number): Promise<void> {
  if (!refs.length) return;
  const table = db.table('wound_images');
  for (const ref of refs) {
    const row = await table.where('ref').equals(ref).first();
    if (!row) continue;
    await table.update(row.id!, {
      assessment_id: assessmentId,
      ...(woundId != null ? { wound_id: woundId } : {}),
    });
  }
}

/** A displayable URL for a stored photograph, preferring the local copy. */
export async function getImageUrl(ref: string): Promise<string | null> {
  const row = await db.table('wound_images').where('ref').equals(ref).first();
  if (!row) return null;
  // The local blob is instant and works offline; the remote path is only needed
  // on a device that never held the original.
  if (row.blob) return URL.createObjectURL(row.blob);
  return row.remote_path || null;
}

/** Every photograph belonging to an assessment, newest first. */
export async function getImagesForAssessment(assessmentId: number): Promise<WoundImageRecord[]> {
  return db.table('wound_images')
    .where('assessment_id').equals(assessmentId)
    .reverse()
    .toArray();
}

/** Photographs still only on this device. */
export async function listPendingUploads(limit = 25): Promise<WoundImageRecord[]> {
  const rows: WoundImageRecord[] = await db.table('wound_images').toArray();
  return rows
    .filter(r => !r.remote_path)
    .sort((a, b) => a.captured_at.localeCompare(b.captured_at))
    .slice(0, limit);
}

export async function markUploaded(ref: string, remotePath: string): Promise<void> {
  const table = db.table('wound_images');
  const row = await table.where('ref').equals(ref).first();
  if (!row) return;
  await table.update(row.id!, { remote_path: remotePath, uploaded_at: new Date().toISOString(), last_error: null });
}

export async function markUploadFailed(ref: string, message: string): Promise<void> {
  const table = db.table('wound_images');
  const row = await table.where('ref').equals(ref).first();
  if (!row) return;
  await table.update(row.id!, { attempts: (row.attempts || 0) + 1, last_error: message });
}

/**
 * How much is waiting to go, so the interface can be honest about it.
 *
 * A clinician who has photographed twenty wounds on a round with no signal
 * should be able to see that none of them have left the device yet.
 */
export async function pendingUploadCount(): Promise<number> {
  const rows: WoundImageRecord[] = await db.table('wound_images').toArray();
  return rows.filter(r => !r.remote_path).length;
}

/**
 * Local storage used by wound photographs, in bytes.
 *
 * IndexedDB quotas are finite and a ward round of full-resolution photographs
 * fills them quickly. Surfacing the figure is better than discovering the limit
 * when a capture silently fails.
 */
export async function localBytesUsed(): Promise<number> {
  const rows: WoundImageRecord[] = await db.table('wound_images').toArray();
  return rows.reduce((sum, r) => sum + (r.bytes || 0), 0);
}
