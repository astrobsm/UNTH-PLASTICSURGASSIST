/**
 * The critical-care review screen: the rule-based report renders live from
 * the case, the AI review is requested on demand and differences shown, and
 * the review saves to the patient's encounters as critical_care_review.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { emptyReport } from '../clinical/critical/types';

const save = vi.fn(async (...a: any[]) => ({ patient: a[0], id: 5, version: 1 }));
const aiReview = vi.fn(async () => ({ review: { ...emptyReport(), clinical_summary: 'AI consultant synthesis' }, model: 'gpt-4o', prompt_version: 'cc-1.0.0', deidentified: true, discrepancies: ['eGFR: app 26, AI 40'] }));
vi.mock('../services/criticalCareService', () => ({
  criticalCareService: { aiReview: () => aiReview(), save: (...a: any[]) => save(...a), prefillFromRecord: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { CriticalCareReview } from '../components/critical/CriticalCareReview';

const input = {
  patient: { age_years: 54, sex: 'male' as const, weight_kg: 70, height_cm: 170 },
  vitals: [{ hr: 118, sbp: 85, dbp: 50, rr: 28, spo2: 95, temp_c: 37, gcs: 15 }],
  labs: [{ test: 'Potassium', value: 6.9, unit: 'mmol/L' }], medications: [{ name: 'Spironolactone', indication: 'heart failure' }],
};

describe('CriticalCareReview', () => {
  it('shows the live rule-based report, requests the AI review and saves', async () => {
    render(<CriticalCareReview patientId="7" initial={{ id: 0, version: 0, data: { input } } as any} />);
    expect(screen.getAllByText(/Hyperkalaemia K 6.9 mmol\/L/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Spironolactone/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText('Request consultant AI review'));
    await waitFor(() => expect(screen.getByText('AI consultant synthesis')).toBeTruthy());
    expect(screen.getByText(/eGFR: app 26, AI 40/)).toBeTruthy();
    fireEvent.click(screen.getByText('Save to record'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const [pid, savedInput, rule, ai] = save.mock.calls[0];
    expect(pid).toBe('7');
    expect(savedInput.labs[0].test).toBe('Potassium');
    expect(rule.critical_alerts.length).toBeGreaterThan(0);
    expect(ai.model).toBe('gpt-4o');
  });
});
