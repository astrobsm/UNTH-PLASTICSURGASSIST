/**
 * Placing a scanned consult review into the workflow's fields.
 */
import { describe, it, expect } from 'vitest';
import { fieldsFromScan } from '../components/ConsultReviewForm';

describe('fieldsFromScan', () => {
  const structured = {
    review_notes: 'O/E: necrotic ulcer anterior abdominal wall, 6x4cm',
    proposed_plan: '1. Wound biopsy\n2. Daily dressing',
    plan_approval_notes: null,
    implementation_notes: 'Biopsy done under LA',
    diagnosis: 'Suspected marjolin ulcer',
    reviewer: 'Dr Okeke (SR)',
  };

  it('fills only the fields of the current step', () => {
    const out = fieldsFromScan(structured, 'raw', ['review_notes', 'proposed_plan', 'notes']);
    expect(out.review_notes).toContain('necrotic ulcer');
    expect(out.review_notes).toContain('Impression: Suspected marjolin ulcer');
    expect(out.proposed_plan).toBe('1. Wound biopsy\n2. Daily dressing');
    expect(out.notes).toContain('Dr Okeke (SR)');
    expect(out).not.toHaveProperty('implementation_notes');
  });

  it('does not repeat a diagnosis already in the findings', () => {
    const out = fieldsFromScan({ review_notes: 'Impression: burn contracture', diagnosis: 'Burn contracture' }, '', ['review_notes']);
    expect(out.review_notes).toBe('Impression: burn contracture');
  });

  it('puts the whole transcription into the main field when nothing was structured', () => {
    const out = fieldsFromScan(null, 'Seen. Plan: debride tomorrow', ['implementation_notes', 'notes']);
    expect(out.implementation_notes).toBe('Seen. Plan: debride tomorrow');
  });

  it('returns nothing for an empty page', () => {
    expect(fieldsFromScan(null, '   ', ['review_notes'])).toEqual({});
  });
});
