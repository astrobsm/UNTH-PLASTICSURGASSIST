// @vitest-environment node
/**
 * The wound-care sync payload must match what api/wound-care.js destructures.
 *
 * It did not. The page wrote `patient_id` / `location` / `photos`; the handler
 * reads `patientId` / `woundLocation` / `images` and returns 400 without the
 * first two. Every wound assessment therefore failed to sync, kept
 * `synced: false`, and stayed on the single device that recorded it — which is
 * why clinicians could not see their own wound documentation elsewhere.
 *
 * These assertions are written against the handler's field names deliberately:
 * if either side is renamed, this fails rather than the sync going quiet again.
 */

import { describe, it, expect } from 'vitest';
import { toWoundCarePayload } from '../db/woundCarePayload';

/** The shape WoundCarePage actually writes to IndexedDB. */
const localAssessment = {
  id: 'wound_1730000000000_abc123',
  patient_id: '412',
  patient_name: 'A. Patient',
  location: 'Left lateral malleolus',
  wound_type: 'Venous Ulcer',
  length: 4.5,
  width: 3,
  depth: 0.5,
  area: 13.5,
  healing_phase: 'transition',
  notes: 'Granulating well, no odour.',
  dressing_protocol: [
    { step: 1, action: 'Cleanse with saline' },
    { step: 2, action: 'Apply primary dressing', product: 'Hydrofibre' },
    { step: 3, action: 'Secure', product: 'Retention bandage' },
  ],
  photos: [
    { id: 'photo_1', dataUrl: 'data:image/jpeg;base64,AAAA', ref: 'wi_abc' },
    { id: 'photo_2', dataUrl: 'data:image/jpeg;base64,BBBB', ref: 'wi_def' },
  ],
};

describe('wound care sync payload', () => {
  it('supplies the two fields the handler rejects the request without', () => {
    const p = toWoundCarePayload(localAssessment);
    expect(p.patientId).toBe('412');
    expect(p.woundLocation).toBe('Left lateral malleolus');
  });

  it('maps the rest of the handler contract', () => {
    const p = toWoundCarePayload(localAssessment);
    expect(p.woundType).toBe('Venous Ulcer');
    expect(p.woundStage).toBe('transition');
    expect(p.observations).toBe('Granulating well, no odour.');
    expect(p.woundSize).toBe('4.5cm x 3cm x 0.5cm');
    expect(p.dressingUsed).toBe('Hydrofibre, Retention bandage');
    expect(p.treatmentProvided).toContain('Cleanse with saline');
    expect(p.treatmentProvided).toContain('Hydrofibre');
  });

  it('sends photograph refs and never the dataUrls', () => {
    // A dataUrl here would be megabytes of base64 in a JSONB column that no
    // other device could resolve, alongside the real upload.
    const p = toWoundCarePayload(localAssessment);
    expect(p.images).toEqual(['wi_abc', 'wi_def']);
    expect(JSON.stringify(p)).not.toContain('data:image');
  });

  it('omits photographs that have not been stored yet', () => {
    // A photograph mid-capture has no ref; sending a null would write a hole
    // into the images array that the gallery would later try to resolve.
    const p = toWoundCarePayload({
      ...localAssessment,
      photos: [{ id: 'photo_1', dataUrl: 'data:image/jpeg;base64,AAAA' }],
    });
    expect(p.images).toEqual([]);
  });

  it('falls back to area when no linear dimensions were recorded', () => {
    const p = toWoundCarePayload({ ...localAssessment, length: 0, width: 0, depth: 0 });
    expect(p.woundSize).toBe('13.5 cm2');
  });

  it('survives a record with nothing in it', () => {
    const p = toWoundCarePayload({});
    expect(p.patientId).toBeNull();
    expect(p.images).toEqual([]);
    expect(p.woundSize).toBeNull();
  });

  it('accepts a record already written in the handler\'s own names', () => {
    const p = toWoundCarePayload({ patientId: 9, woundLocation: 'Sacrum', photos: [] });
    expect(p.patientId).toBe(9);
    expect(p.woundLocation).toBe('Sacrum');
  });
});
