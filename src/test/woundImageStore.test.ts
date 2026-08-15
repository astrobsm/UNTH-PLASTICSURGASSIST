/**
 * Local persistence of wound photographs.
 *
 * The bug being fixed: photographs were held in memory only and discarded when
 * the modal closed. That broke serial comparison, and it meant every
 * clinician-corrected outline was stored without the image it described — half
 * a training example, which is no training example.
 */

// jsdom has no IndexedDB, so Dexie cannot open a database under test without a
// shim. Imported before the database module so the global is in place when
// Dexie initialises.
import 'fake-indexeddb/auto';

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db/database';
import {
  putLocalImage, attachToAssessment, getImagesForAssessment,
  listPendingUploads, markUploaded, markUploadFailed,
  pendingUploadCount, localBytesUsed,
} from '../services/woundImageStore';

const blob = (bytes = 32) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });

const put = (over: Partial<Parameters<typeof putLocalImage>[0]> = {}) =>
  putLocalImage({
    blob: blob(), kind: 'original', width: 640, height: 480,
    woundId: 1, patientId: 7, ...over,
  });

beforeEach(async () => {
  await db.table('wound_images').clear();
});

describe('putLocalImage', () => {
  it('stores the photograph and returns a ref', async () => {
    const ref = await put();
    expect(ref).toBeTruthy();
    const rows = await db.table('wound_images').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].ref).toBe(ref);
    expect(rows[0].bytes).toBe(32);
  });

  it('mints a distinct ref per photograph', async () => {
    const refs = await Promise.all([put(), put(), put()]);
    expect(new Set(refs).size).toBe(3);
  });

  it('starts unlinked and unuploaded', async () => {
    // The row is the upload queue entry as well as the stored image, so both
    // of these must begin empty.
    await put();
    const row = (await db.table('wound_images').toArray())[0];
    expect(row.assessment_id).toBeNull();
    expect(row.remote_path).toBeNull();
    expect(row.attempts).toBe(0);
  });
});

describe('attachToAssessment', () => {
  it('links photographs to the assessment once it exists', async () => {
    // The assessment id does not exist at capture time, so linking is a second
    // step. Without it the image is orphaned and the pairing with the corrected
    // contour is lost.
    const ref = await put();
    await attachToAssessment([ref], 99, 5);
    const images = await getImagesForAssessment(99);
    expect(images).toHaveLength(1);
    expect(images[0].ref).toBe(ref);
    expect(images[0].wound_id).toBe(5);
  });

  it('ignores refs that do not exist rather than throwing', async () => {
    await expect(attachToAssessment(['no-such-ref'], 99)).resolves.toBeUndefined();
  });

  it('does nothing when given no refs', async () => {
    await attachToAssessment([], 99);
    expect(await getImagesForAssessment(99)).toHaveLength(0);
  });

  it('leaves other assessments alone', async () => {
    const a = await put();
    const b = await put();
    await attachToAssessment([a], 1);
    await attachToAssessment([b], 2);
    expect(await getImagesForAssessment(1)).toHaveLength(1);
    expect(await getImagesForAssessment(2)).toHaveLength(1);
  });
});

describe('upload queue', () => {
  it('lists everything not yet uploaded, oldest first', async () => {
    await put();
    await put();
    const pending = await listPendingUploads();
    expect(pending).toHaveLength(2);
    expect(pending[0].captured_at <= pending[1].captured_at).toBe(true);
  });

  it('drops a photograph from the queue once uploaded', async () => {
    const ref = await put();
    expect(await pendingUploadCount()).toBe(1);
    await markUploaded(ref, 'wounds/2026/abc.jpg');
    expect(await pendingUploadCount()).toBe(0);
    const row = (await db.table('wound_images').toArray())[0];
    expect(row.remote_path).toBe('wounds/2026/abc.jpg');
    expect(row.uploaded_at).toBeTruthy();
  });

  it('counts failures without losing the photograph', async () => {
    // A failed upload must never discard the only copy.
    const ref = await put();
    await markUploadFailed(ref, 'network down');
    await markUploadFailed(ref, 'network down');
    const row = (await db.table('wound_images').toArray())[0];
    expect(row.attempts).toBe(2);
    expect(row.last_error).toBe('network down');
    expect(row.bytes).toBe(32);
    expect(await pendingUploadCount()).toBe(1);
  });

  it('respects the limit so a huge backlog does not load at once', async () => {
    for (let i = 0; i < 5; i++) await put();
    expect(await listPendingUploads(3)).toHaveLength(3);
  });
});

describe('localBytesUsed', () => {
  it('totals the stored blobs', async () => {
    // IndexedDB quotas are finite and a ward round fills them quickly; the
    // figure is worth surfacing before a capture silently fails.
    await put({ blob: blob(100) });
    await put({ blob: blob(250) });
    expect(await localBytesUsed()).toBe(350);
  });

  it('is zero when nothing is stored', async () => {
    expect(await localBytesUsed()).toBe(0);
  });
});
