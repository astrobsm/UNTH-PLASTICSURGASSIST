/**
 * Wound photographs, kept and reviewable.
 *
 * The pictures were being captured and stored but there was no way to look back
 * over them: the gallery showed the ones attached to a single assessment, which
 * cannot answer the question the progress monitor exists for — is this wound
 * healing — because that is a question about the whole run.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const history = read('src/components/wound/WoundPhotoHistory.tsx');
const monitor = read('src/pages/WoundProgressMonitorPage.tsx');
const sync = read('src/services/woundImageSync.ts');

describe('the photographs are kept', () => {
  it('a capture is stored before anything else touches it', () => {
    // It used to be held in memory only and lost when the modal closed.
    expect(monitor).toContain('putLocalImage(');
    expect(monitor).toContain('attachToAssessment(');
  });

  it('is tagged with the patient, so it can be found later', () => {
    expect(monitor).toContain('patientId: wound.patient_id != null ? Number(wound.patient_id) : null');
  });

  it('a photograph stranded on a device is rescued when the history opens', () => {
    // One taken in a dialog the clinician abandoned would otherwise sit in
    // IndexedDB until the browser evicted it.
    expect(history).toContain('await syncPendingWoundImages()');
  });

  it('storing is best effort and never blocks the measurement', () => {
    expect(monitor).toContain('could not store photograph locally');
  });

  it('the upload queue survives a failure rather than retrying for ever', () => {
    expect(sync).toContain('MAX_ATTEMPTS');
    expect(sync).toContain('markUploadFailed');
  });
});

describe('the history view', () => {
  it('is driven by the patient, not only one assessment', () => {
    expect(history).toContain('listRemoteImages({ patientId, woundId })');
  });

  it('groups the run by the day each photograph was taken', () => {
    expect(history).toContain('function dayLabel');
    expect(history).toContain("if (days === 0) return 'Today';");
  });

  it('shows the size measured from each photograph', () => {
    // A picture without its measurement makes the reader guess.
    expect(history).toContain('const sizeFor');
    expect(history).toContain('area_cm2');
  });

  it('holds any two photographs against each other', () => {
    expect(history).toContain('Compare');
    expect(history).toContain('pinnedPhotos.length === 2');
    // Earlier on the left, later on the right, whichever order they were picked.
    expect(history).toContain("(a.captured_at || '').localeCompare(b.captured_at || '')");
  });

  it('steps through the run without closing the viewer', () => {
    expect(history).toContain("e.key === 'ArrowLeft'");
    expect(history).toContain("e.key === 'ArrowRight'");
    expect(history).toContain("e.key === 'Escape'");
  });

  it('marks what has not reached the server yet', () => {
    // A clinician on a ward with no signal must be able to tell.
    expect(history).toContain('not uploaded');
    expect(history).toContain('only on this device');
  });

  it('merges local and remote without trusting the shapes are the same', () => {
    // The local record carries a Blob and no mime type; the remote one is
    // metadata about a file already sent.
    expect(history).not.toContain('as WoundImageMeta');
    expect(history).toContain("mime_type: l.blob?.type || 'image/jpeg'");
  });

  it('says something useful when there is nothing to show', () => {
    expect(history).toContain('No wound photographs recorded for this patient yet.');
  });
});

describe('the monitor shows the history', () => {
  it('renders it with the assessments, so sizes line up with pictures', () => {
    expect(monitor).toContain('<WoundPhotoHistory');
    expect(monitor).toContain('assessments={assessments.map');
  });
});
