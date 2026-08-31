/**
 * Wound photographs must leave the device that took them.
 *
 * woundImageStore wrote every photograph to IndexedDB and treated rows without
 * a `remote_path` as an upload queue — but nothing drained that queue and
 * nothing read a photograph back, so `listPendingUploads`, `markUploaded` and
 * `getImagesForAssessment` had no callers anywhere in the app. A wound
 * photographed on one phone was invisible on every other phone, and invisible
 * on the same phone once its browser storage was cleared.
 *
 * These cover the two directions and the legacy reference form, because a
 * silent failure here looks exactly like "this wound has no photographs".
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
const get = vi.fn();

vi.mock('../services/apiClient', () => ({
  apiClient: {
    post: (...a: any[]) => post(...a),
    get: (...a: any[]) => get(...a),
  },
}));

const listPendingUploads = vi.fn();
const markUploaded = vi.fn();
const markUploadFailed = vi.fn();
const cacheRemoteImage = vi.fn();
const hasLocalBlob = vi.fn();
const getImageUrl = vi.fn();

vi.mock('../services/woundImageStore', () => ({
  listPendingUploads: (...a: any[]) => listPendingUploads(...a),
  markUploaded: (...a: any[]) => markUploaded(...a),
  markUploadFailed: (...a: any[]) => markUploadFailed(...a),
  cacheRemoteImage: (...a: any[]) => cacheRemoteImage(...a),
  hasLocalBlob: (...a: any[]) => hasLocalBlob(...a),
  getImageUrl: (...a: any[]) => getImageUrl(...a),
}));

import {
  syncPendingWoundImages,
  resolveWoundImageUrl,
  refFromImageUrl,
} from '../services/woundImageSync';

function pendingRow(over: Record<string, any> = {}) {
  return {
    ref: 'wi_abc',
    kind: 'original',
    blob: new Blob(['bytes'], { type: 'image/jpeg' }),
    bytes: 5,
    width: 800,
    height: 600,
    captured_at: '2026-08-30T09:00:00.000Z',
    assessment_id: 7,
    wound_id: 3,
    patient_id: 412,
    attempts: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:fake') as any;
});

describe('draining the upload queue', () => {
  it('uploads a queued photograph and records where it went', async () => {
    listPendingUploads.mockResolvedValue([pendingRow()]);
    post.mockResolvedValue({ ref: 'wi_abc', remote_path: '/wound-images?ref=wi_abc' });

    const result = await syncPendingWoundImages();

    expect(result.uploaded).toBe(1);
    const [endpoint, body] = post.mock.calls[0];
    expect(endpoint).toBe('/wound-images');
    expect(body.ref).toBe('wi_abc');
    expect(body.patient_id).toBe(412);
    expect(body.data_base64).toBeTruthy();
    expect(markUploaded).toHaveBeenCalledWith('wi_abc', '/wound-images?ref=wi_abc');
  });

  it('records a failure instead of losing the photograph', async () => {
    // The row must stay in the queue. Marking it uploaded on a failed request
    // would drop the only copy that exists off the queue silently.
    listPendingUploads.mockResolvedValue([pendingRow()]);
    post.mockRejectedValue(new Error('503 Service Unavailable'));

    const result = await syncPendingWoundImages();

    expect(result.failed).toBe(1);
    expect(markUploaded).not.toHaveBeenCalled();
    expect(markUploadFailed).toHaveBeenCalledWith('wi_abc', '503 Service Unavailable');
  });

  it('gives up on a photograph the server keeps rejecting', async () => {
    listPendingUploads.mockResolvedValue([pendingRow({ attempts: 5 })]);
    const result = await syncPendingWoundImages();
    expect(post).not.toHaveBeenCalled();
    expect(result.uploaded).toBe(0);
  });

  it('does not attempt to upload while offline', async () => {
    const spy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    listPendingUploads.mockResolvedValue([pendingRow()]);

    const result = await syncPendingWoundImages();

    expect(post).not.toHaveBeenCalled();
    expect(result).toEqual({ uploaded: 0, failed: 0 });
    spy.mockRestore();
  });
});

describe('reading a photograph this device never took', () => {
  it('fetches it once and keeps it', async () => {
    hasLocalBlob.mockResolvedValue(false);
    get.mockResolvedValue({
      ref: 'wi_xyz',
      kind: 'original',
      mime_type: 'image/jpeg',
      width: 800,
      height: 600,
      captured_at: '2026-08-30T09:00:00.000Z',
      assessment_id: 7,
      wound_id: 3,
      patient_id: 412,
      remote_path: '/wound-images?ref=wi_xyz',
      data_base64: btoa('bytes'),
    });

    const url = await resolveWoundImageUrl('wi_xyz');

    expect(url).toBe('blob:fake');
    // Cached, so the ward round after this one does not need a network.
    expect(cacheRemoteImage).toHaveBeenCalledWith(
      expect.objectContaining({ ref: 'wi_xyz', patientId: 412, remotePath: '/wound-images?ref=wi_xyz' })
    );
  });

  it('uses the local copy without asking the server', async () => {
    hasLocalBlob.mockResolvedValue(true);
    getImageUrl.mockResolvedValue('blob:local');

    expect(await resolveWoundImageUrl('wi_abc')).toBe('blob:local');
    expect(get).not.toHaveBeenCalled();
  });

  it('returns null rather than throwing when the photograph cannot be had', async () => {
    // The gallery renders a placeholder for this; an exception would take the
    // whole assessment view down with it.
    hasLocalBlob.mockResolvedValue(false);
    get.mockRejectedValue(new Error('offline'));

    expect(await resolveWoundImageUrl('wi_missing')).toBeNull();
  });
});

describe('references recorded on older assessments', () => {
  it('recovers the ref from a device-local URL', () => {
    // Assessments saved before this worked carry "local:<ref>", which resolved
    // on exactly one phone. The ref inside it is still the right one.
    expect(refFromImageUrl('local:wi_abc')).toBe('wi_abc');
  });

  it('recovers the ref from the portable form', () => {
    expect(refFromImageUrl('/wound-images?ref=wi_abc')).toBe('wi_abc');
  });

  it('has nothing to recover from an empty value', () => {
    expect(refFromImageUrl(null)).toBeNull();
    expect(refFromImageUrl('')).toBeNull();
  });
});
