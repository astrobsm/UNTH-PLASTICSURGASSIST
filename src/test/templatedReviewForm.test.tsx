/**
 * The templated review form: pick a review and a procedure, answer, see the
 * scores and the integrated plan update, and save with the plan's actionable
 * items as accepted suggestions under the new encounter type.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const save = vi.fn().mockImplementation(async (p: any) => ({ ...p, id: 9, version: 1, status: 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
vi.mock('../services/clinicalEncounterService', () => ({
  clinicalEncounterService: { save: (p: any) => save(p), submit: vi.fn() },
  localDraft: { load: () => null, save: () => {}, clear: () => {} },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { TemplatedReviewForm } from '../components/clinical/templates/TemplatedReviewForm';

describe('TemplatedReviewForm', () => {
  it('picks a pre-op template, builds the plan from the answers and saves it', async () => {
    render(<TemplatedReviewForm patientId="p1" patientLabel="Test Patient · PT-1" ctx={{ ageYears: 60, sex: 'Male' }} userName="Dr Test"
      canSign={false} encounters={[]} onClose={() => {}} onSaved={() => {}} />);

    fireEvent.click(screen.getByText(/Pre-operative review/));
    fireEvent.change(screen.getByPlaceholderText(/Search procedure/), { target: { value: 'diabetic' } });
    fireEvent.click(screen.getByText(/Diabetic foot debridement/));

    expect(screen.getByText(/Procedure-specific assessment — Diabetic foot/)).toBeTruthy();
    expect(screen.getByText(/Nutritional assessment \(MUST\)/)).toBeTruthy();
    expect(screen.getByText(/Psychological and social status/)).toBeTruthy();
    expect(screen.getByText(/Counselling and consent/)).toBeTruthy();
    expect(screen.getByText('Integrated treatment plan')).toBeTruthy();

    // Diabetic foot standard work-up appears in the plan straight away.
    expect(screen.getByDisplayValue(/Foot X-ray, ESR \/ CRP/)).toBeTruthy();

    fireEvent.click(screen.getByText('Save draft'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const payload = save.mock.calls[0][0];
    expect(payload.encounter_type).toBe('preop_review');
    expect(payload.data.templateId).toBe('preop_review:diabetic_foot');
    expect(payload.suggestions.some((s: any) => s.kind === 'investigation' && s.decision === 'accepted')).toBe(true);
    expect(payload.summary.title).toMatch(/Pre-operative review/);
    expect(payload.narrative).toMatch(/INTEGRATED TREATMENT PLAN/);
  });

  it('opens the wound care review directly', () => {
    render(<TemplatedReviewForm patientId="p1" patientLabel="Test Patient" ctx={{ ageYears: 40, sex: 'Female' }} userName="Dr Test"
      canSign onClose={() => {}} onSaved={() => {}} encounters={[]} initialKind="wound_review" />);
    fireEvent.click(screen.getByText(/Wound care review/));
    expect(screen.getByText(/Tissue, moisture and edge/)).toBeTruthy();
    expect(screen.getByText(/Approve & sign/)).toBeTruthy();
  });
});
