/** Ward census link: doctors tick who has left; nothing is discharged until review. */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const form = vi.fn();
const submit = vi.fn(async () => ({ flagged: 1 }));
vi.mock('../services/wardCensusService', async (orig) => {
  const real: any = await orig();
  return { ...real, wardCensusService: { ...real.wardCensusService, form: (...a: any[]) => (form as any)(...a), submit: (...a: any[]) => (submit as any)(...a) } };
});
import WardCensusFormPage from '../pages/WardCensusFormPage';

const patients = [
  { admission_id: 1, patient_id: 1, patient_name: 'Comfort Anike', hospital_number: 'PT-556269', ward: 'Ward 10', bed_number: '16', status: 'active' },
  { admission_id: 2, patient_id: 2, patient_name: 'Ada Obi', hospital_number: 'PT-1', ward: 'Ward 10', bed_number: '3', status: 'admitted' },
  { admission_id: 3, patient_id: 3, patient_name: 'Ben Eze', hospital_number: 'PT-2', ward: 'Ward 4', bed_number: '1', status: 'active' },
];

const open = () => render(
  <MemoryRouter initialEntries={['/ward-census/abc']}>
    <Routes><Route path="/ward-census/:roundId" element={<WardCensusFormPage />} /></Routes>
  </MemoryRouter>);

describe('WardCensusFormPage', () => {
  it('lists patients by ward and submits the ticked ones with reason and date', async () => {
    form.mockResolvedValue({ round: { id: 'abc', title: 'Friday census', status: 'open', created_at: 'x' }, patients, flagged: [] });
    open();
    expect(await screen.findByText('Friday census')).toBeTruthy();
    expect(screen.getByText(/Ward 10/, { selector: 'p' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Ada Obi is no longer on admission'));
    fireEvent.change(screen.getByLabelText('How they left'), { target: { value: 'lama' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    await waitFor(() => expect(submit).toHaveBeenCalled());
    const [id, body] = submit.mock.calls[0] as any;
    expect(id).toBe('abc');
    expect(body.items).toEqual([expect.objectContaining({ admission_id: 2, reason: 'lama' })]);
    expect(body.items[0].left_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.shown_count).toBe(3);
    expect(await screen.findByText(/census submitted/i)).toBeTruthy();
  });
  it('"Other" needs a note', async () => {
    submit.mockClear();
    form.mockResolvedValue({ round: { id: 'abc', title: 'C', status: 'open', created_at: 'x' }, patients, flagged: [] });
    open();
    fireEvent.click(await screen.findByLabelText('Ben Eze is no longer on admission'));
    fireEvent.change(screen.getByLabelText('How they left'), { target: { value: 'other' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit/ }));
    expect(await screen.findByText(/say what happened/i)).toBeTruthy();
    expect(submit).not.toHaveBeenCalled();
  });
  it('a closed link says so', async () => {
    form.mockRejectedValue(new Error('[HTTP 410] This census has closed. Ask for a new link.'));
    open();
    expect(await screen.findByText('This census has closed. Ask for a new link.')).toBeTruthy();
  });
});
