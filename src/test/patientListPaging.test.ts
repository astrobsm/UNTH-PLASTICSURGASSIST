/**
 * The full patient list must include patients past the first sync page, and a
 * search must find a patient whichever order their names are typed in.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn() }));
vi.mock('../services/apiClient', () => ({ apiClient: {} }));
vi.mock('../db/database', () => ({ db: {} }));
import { fetchAllPatientPages } from '../services/patientService';
import { patientSearchWhere } from '../../api/patients/index.js';

const rows = Array.from({ length: 1205 }, (_, i) => ({ id: i + 1, updated_at: new Date(Date.UTC(2026, 0, 1) + Math.floor(i / 3) * 1000).toISOString() }));
const server = (size: number) => async (since?: string) => {
  const from = since ? rows.filter(r => r.updated_at > since) : rows;
  return from.slice(0, size);
};

describe('patient list paging', () => {
  it('returns every patient, not only the first 500', async () => {
    const all = await fetchAllPatientPages(server(500));
    expect(all).toHaveLength(1205);
    expect(new Set(all.map((p: any) => p.id)).size).toBe(1205);
  });
  it('a single short page is returned as is; a non-array answer is passed through', async () => {
    expect(await fetchAllPatientPages(async () => [{ id: 1, updated_at: '2026-01-01T00:00:00Z' }])).toHaveLength(1);
    expect(await fetchAllPatientPages(async () => ({ error: 'x' }))).toEqual({ error: 'x' });
  });
  it('stops when a page brings nothing new (many rows on one timestamp)', async () => {
    const same = Array.from({ length: 600 }, (_, i) => ({ id: i, updated_at: '2026-01-01T00:00:00.000Z' }));
    const get = vi.fn(async (since?: string) => (since ? same.filter(r => r.updated_at > since) : same).slice(0, 500));
    const all = await fetchAllPatientPages(get);
    expect(get.mock.calls.length).toBeLessThan(5);
    expect(all.length).toBe(500);
  });
});

describe('patient search', () => {
  it('every word must match, in any order', () => {
    const w = patientSearchWhere('  Ugwu   Onovo ');
    expect(w.params).toEqual(['%Ugwu%', '%Onovo%']);
    expect(w.sql).toContain('$1');
    expect(w.sql).toContain(') AND (');
    expect(patientSearchWhere('').sql).toBe('');
  });
});
