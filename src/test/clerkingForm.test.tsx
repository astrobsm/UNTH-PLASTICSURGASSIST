/**
 * Smoke test: the Initial Patient Encounter form renders, finds a complaint
 * as the user types, shows its dynamic questions and reaches the assessment
 * step with rule-based suggestions — without the server or AI.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../services/clinicalEncounterService', () => ({
  clinicalEncounterService: { aiSuggest: vi.fn().mockRejectedValue(new Error('offline')), save: vi.fn(), submit: vi.fn() },
  localDraft: { load: () => null, save: () => {}, clear: () => {} },
}));

import { InitialEncounterForm } from '../components/clinical/clerking/InitialEncounterForm';
import { FollowUpEncounterForm } from '../components/clinical/clerking/FollowUpEncounterForm';

describe('InitialEncounterForm', () => {
  it('adds a complaint by typing and walks to the assessment', () => {
    render(<InitialEncounterForm patientId="p1" patientLabel="Test Patient" ctx={{ ageYears: 34, sex: 'Female' }} userName="Dr Test"
      canSign={false} onClose={() => {}} onSaved={() => {}} />);

    const input = screen.getByPlaceholderText(/Type a presenting complaint/);
    fireEvent.change(input, { target: { value: 'bed sore' } });
    fireEvent.click(screen.getByText('Pressure sore / bed sore'));
    expect(screen.getByText('Wound / ulcer')).toBeTruthy();       // complaint module appeared
    expect(screen.getByText('Symptom analysis')).toBeTruthy();

    fireEvent.click(screen.getByText(/2\. History/));
    expect(screen.getByText(/Gynaecological and obstetric history/)).toBeTruthy(); // woman of reproductive age
    fireEvent.click(screen.getByText('No known drug allergies'));

    fireEvent.click(screen.getByText(/3\. Examination/));
    expect(screen.getByText('Pressure areas')).toBeTruthy();       // focused exam for the complaint

    fireEvent.click(screen.getByText(/4\. Assessment/));
    expect(screen.getByText('Differential diagnoses')).toBeTruthy();
    expect(screen.getAllByText(/Pressure ulcer|Necrotising|Osteomyelitis|Infected wound/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Submit for review/)).toBeTruthy();
  });
});

describe('FollowUpEncounterForm', () => {
  it('lists open problems and plan items for review and accepts new complaints', () => {
    const now = new Date().toISOString();
    render(<FollowUpEncounterForm patientId="p1" patientLabel="Test Patient" ctx={{ ageYears: 60, sex: 'Male' }} userName="Dr Test" canSign
      problems={[
        { id: 1, patient_id: 'p1', encounter_id: 9, suggestion_id: 'rules:dx:venous_ulcer', label: 'Venous leg ulcer', reasons: [], dangerous: false, status: 'active', created_at: now, updated_at: now },
        { id: 2, patient_id: 'p1', encounter_id: 9, suggestion_id: 'x', label: 'Old resolved thing', reasons: [], dangerous: false, status: 'resolved', created_at: now, updated_at: now },
      ]}
      planItems={[{ id: 5, patient_id: 'p1', encounter_id: 9, suggestion_id: 'y', kind: 'investigation', text: 'ABPI before compression', status: 'pending', created_at: now, updated_at: now }]}
      onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText('Venous leg ulcer')).toBeTruthy();
    expect(screen.queryByText('Old resolved thing')).toBeNull();
    expect(screen.getByText('ABPI before compression')).toBeTruthy();
    expect(screen.getByText('2 item(s) not reviewed')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Improved')[0]);
    fireEvent.click(screen.getByText('Done'));
    expect(screen.getByText(/All items reviewed/)).toBeTruthy();
    fireEvent.click(screen.getByText('Yes'));
    expect(screen.getByPlaceholderText(/Type the new complaint/)).toBeTruthy();
    expect(screen.getByText('Sign follow-up')).toBeTruthy();
  });
});
