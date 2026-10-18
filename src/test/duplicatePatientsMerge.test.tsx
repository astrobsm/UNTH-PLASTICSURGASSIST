/** Admin → Duplicate patients: suggests the fuller record, merges the rest into it. */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const get = vi.fn();
const post = vi.fn();
vi.mock('../services/apiClient', () => ({ apiClient: { get: (...a: any[]) => get(...a), post: (...a: any[]) => post(...a) } }));
vi.mock('../store/authStore', () => ({ useAuthStore: () => ({ user: { role: 'admin' } }) }));

import DuplicatePatientsMerge from '../components/admin/DuplicatePatientsMerge';

const GROUP = {
  key: 'PT777',
  patients: [
    { id: 1, hospital_number: 'pt-777', name: 'Ada Obi', created_at: '2026-01-01', records: { total: 2, tables: { admissions: 2 } } },
    { id: 2, hospital_number: 'PT 777', name: 'Ada Obi', created_at: '2026-02-01', records: { total: 9, tables: { ward_rounds: 6, admissions: 3 } } },
  ],
};

beforeEach(() => { get.mockReset(); post.mockReset(); });

describe('DuplicatePatientsMerge', () => {
  it('lists a group and suggests keeping the record with more on it', async () => {
    get.mockResolvedValue({ duplicates: [GROUP] });
    render(<DuplicatePatientsMerge />);
    await screen.findByText(/2 registrations/);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios[1].checked).toBe(true); // 9 records beats 2
    expect(screen.getByText('KEEP')).toBeTruthy();
  });

  it('merges the other record into the kept one after confirmation', async () => {
    get.mockResolvedValue({ duplicates: [GROUP] });
    post.mockResolvedValue({ movedTotal: 2, moved: { admissions: 2 }, notMoved: [] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<DuplicatePatientsMerge />);
    fireEvent.click(await screen.findByRole('button', { name: /Merge into the kept record/ }));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/patients?action=merge', { keepId: '2', dropId: 1 }));
    expect(await screen.findByText(/2 records moved/)).toBeTruthy();
  });

  it('says so when there are no duplicates', async () => {
    get.mockResolvedValue({ duplicates: [] });
    render(<DuplicatePatientsMerge />);
    expect(await screen.findByText(/Every patient is registered once/)).toBeTruthy();
  });
});
