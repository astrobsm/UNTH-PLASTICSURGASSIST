/**
 * Approved-plan implementation: items are classified (medication /
 * investigation / procedure / care), prescribing goes category → drug, and a
 * log carries the place; the server adds who and when.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const post = vi.fn(async () => ({}));
const createPrescription = vi.fn(async () => ({ id: 55 }));
const createLabInvestigation = vi.fn(async () => ({ id: 77 }));
vi.mock('../services/apiClient', () => ({
  apiClient: {
    post: (...a: any[]) => (post as any)(...a),
    createPrescription: (...a: any[]) => (createPrescription as any)(...a),
    createLabInvestigation: (...a: any[]) => (createLabInvestigation as any)(...a),
    updateLabInvestigation: vi.fn(async () => ({})),
    get: vi.fn(async () => ({})),
  },
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import { classifyLine, flattenPlan, itemState } from '../services/scribe/planItems';
import { buildClinicalFacts } from '../services/scribe/clinicalFacts';
import { buildScribePlan } from '../services/scribe/scribePlan';
import { ImplementationDialog } from '../components/scribe/ImplementationDialog';

beforeEach(() => { post.mockClear(); createPrescription.mockClear(); createLabInvestigation.mockClear(); });

describe('classifying plan items', () => {
  it('investigations, procedures, medications and care', () => {
    expect(classifyLine('FBC, CRP / ESR, U&E', 'investigations')).toBe('investigation');
    expect(classifyLine('Sharp surgical debridement of necrotic tissue', 'treatment')).toBe('procedure');
    expect(classifyLine('Enoxaparin 40 mg SC once daily + mechanical prophylaxis', 'general', 'VTE prophylaxis')).toBe('medication');
    expect(classifyLine('Regular paracetamol; add opioid for dressing changes', 'general', 'Analgesia')).toBe('medication');
    expect(classifyLine('Swallow screen before oral intake', 'comorbidity')).toBe('care');
  });
  it('flattens a real plan with stable keys; goals are not tasks', () => {
    const plan = buildScribePlan(buildClinicalFacts({ patient: { date_of_birth: '1962-01-24' }, clinical: { problems: [{ label: 'Pressure ulcer (L89)', status: 'active' }] } }));
    const items = flattenPlan(plan);
    expect(items.find(i => i.key === 'p0.goals|0')?.actionable).toBe(false);
    expect(items.find(i => i.key === 'p0.investigations|0')?.kind).toBe('investigation');
    expect(items.some(i => i.kind === 'medication')).toBe(true);
  });
  it('state follows the latest log', () => {
    expect(itemState([]).label).toBe('Not started');
    expect(itemState([{ id: 2, item_key: 'k', status: 'ordered', logged_at: 'x' } as any]).label).toMatch(/awaiting result/);
    expect(itemState([{ id: 3, item_key: 'k', status: 'result_entered', logged_at: 'x' } as any]).tone).toBe('done');
  });
});

describe('ImplementationDialog', () => {
  const vte = { key: 'g0|0', text: 'Enoxaparin 40 mg SC once daily (weight-adjusted)', group: 'VTE prophylaxis', section: 'general', kind: 'medication' as const, actionable: true };
  it('prescribes from category → drug and logs it with the place', async () => {
    const onSaved = vi.fn();
    render(<ImplementationDialog planId={9} patientId="42" item={vte} actions={[]} defaultPlace="Ward 10" onSaved={onSaved} onClose={() => {}} />);
    // The drug named in the plan line is pre-selected, with its category.
    await waitFor(() => expect((screen.getByLabelText(/Medication category/i) as HTMLSelectElement).value).not.toBe(''));
    expect((screen.getByLabelText(/^Drug/i) as HTMLSelectElement).selectedOptions[0].textContent).toMatch(/enoxaparin/i);
    fireEvent.change(screen.getByLabelText(/^Dose/i), { target: { value: '40 mg' } });
    fireEvent.change(screen.getByLabelText(/^Frequency/i), { target: { value: 'od' } });
    fireEvent.click(screen.getByRole('button', { name: /Prescribe and log/i }));
    await waitFor(() => expect(createPrescription).toHaveBeenCalled());
    const rx = (createPrescription.mock.calls[0] as any)[0];
    expect(rx.patient_id).toBe('42');
    expect(rx.prescriptions[0]).toMatchObject({ dosage: '40 mg', frequency: 'od' });
    expect(rx.prescriptions[0].medication).toMatch(/enoxaparin/i);
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [url, body] = post.mock.calls[0] as any;
    expect(url).toBe('/scribe-plans?action=log&id=9');
    expect(body).toMatchObject({ item_key: 'g0|0', status: 'prescribed', location: { label: 'Ward 10' } });
    expect(body.prescription.prescription_id).toBe(55);
    expect(onSaved).toHaveBeenCalled();
  });
  it('requests an investigation chosen by category → test', async () => {
    const fbc = { key: 'p0.investigations|2', text: 'FBC, CRP / ESR, U&E', group: 'Pressure ulcer', section: 'investigations', kind: 'investigation' as const, actionable: true, priority: 'urgent' as const };
    render(<ImplementationDialog planId={9} patientId="42" item={fbc} actions={[]} onSaved={() => {}} onClose={() => {}} />);
    const cat = screen.getByLabelText(/^Category/i) as HTMLSelectElement;
    fireEvent.change(cat, { target: { value: 'Haematology' } });
    const test = screen.getByLabelText(/^Investigation/i) as HTMLSelectElement;
    fireEvent.change(test, { target: { value: test.options[1].value } });
    fireEvent.click(screen.getByRole('button', { name: /Request and log/i }));
    await waitFor(() => expect(createLabInvestigation).toHaveBeenCalled());
    expect((createLabInvestigation.mock.calls[0] as any)[0]).toMatchObject({ patient_id: '42', test_type: 'Haematology', priority: 'urgent' });
    await waitFor(() => expect((post.mock.calls[0] as any)[1]).toMatchObject({ status: 'ordered', investigation: { lab_order_id: 77 } }));
  });
  it('a "not done" needs a reason', async () => {
    const care = { key: 'c0|0', text: 'Swallow screen before oral intake', group: 'Previous stroke', section: 'comorbidity', kind: 'care' as const, actionable: true };
    render(<ImplementationDialog planId={9} patientId="42" item={care} actions={[]} onSaved={() => {}} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await new Promise(r => setTimeout(r, 50));
    expect(post).not.toHaveBeenCalled();
  });
});
