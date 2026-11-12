/**
 * Duty chase: what counts as missed, and the message each person gets.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
import { assessPerson, composeChaseMessage, reviewDays, validPeriod } from '../../api/_lib/dutyChase.js';
import { presetRange } from '../components/DutyChasePanel';

const reg = { id: 7, full_name: 'Ada Obi', grade: 'registrar', phone: '08030000000' };
const pts = [
  { patient_id: 'p1', hospital_number: 'UN123', ward_location: 'Ward 5', bed_number: '3', registrar_id: 7, care_start_date: '2026-11-01' },
  { patient_id: 'p2', hospital_number: 'UN456', ward_location: 'Ward 5', bed_number: '4', registrar_id: 7, care_start_date: '2026-11-07' },
  { patient_id: 'p3', hospital_number: 'UN789', registrar_id: 99, care_start_date: '2026-11-01' },
];
// 2–8 Nov 2026: Monday 2nd, Friday 6th.
const base = { from: '2026-11-02', to: '2026-11-08', assignments: pts, absences: [], clinic: [], overdue: [] };

describe('duty chase rules', () => {
  it('finds the Mondays and Fridays of a period', () => {
    expect(reviewDays('2026-11-02', '2026-11-08')).toEqual(['2026-11-02', '2026-11-06']);
  });
  it('a review is expected only for patients held on that day, and leave is excluded', () => {
    const r = assessPerson(reg, { ...base, roundsSet: new Set(['7|p1|2026-11-02']) });
    expect(r.reviews.expected).toBe(2); // p1 Mon + Fri; p2 started after; p3 belongs to someone else
    expect(r.reviews.done).toBe(1);
    expect(r.reviews.missed).toEqual([{ day: '2026-11-06', patient: 'UN123 (Ward 5, bed 3)' }]);
    expect(r.verdict).toBe('chase');
    const onLeave = assessPerson(reg, { ...base, roundsSet: new Set(['7|p1|2026-11-02']), absences: [{ from: Date.UTC(2026, 10, 6) / 86400000, to: Date.UTC(2026, 10, 6) / 86400000 }] });
    expect(onLeave.reviews.missed).toEqual([]);
    expect(onLeave.verdict).toBe('commend');
  });
  it('commends a clean record, no_record when nothing happened', () => {
    const all = new Set(['7|p1|2026-11-02', '7|p1|2026-11-06']);
    expect(assessPerson(reg, { ...base, roundsSet: all }).verdict).toBe('commend');
    expect(assessPerson({ ...reg, id: 50 }, { ...base, roundsSet: new Set() }).verdict).toBe('no_record');
  });
  it('clinic misses and overdue duties are chased', () => {
    const r = assessPerson({ ...reg, id: 50 }, { ...base, roundsSet: new Set(), clinic: [{ status: 'missed', duty_type: 'Dressing clinic', assigned_date: '2026-11-04' }], overdue: [{ title: 'Audit slides', due_at: '2026-11-05T10:00:00Z' }] });
    expect(r.verdict).toBe('chase');
    const msg = composeChaseMessage(r, { from: base.from, to: base.to, senderName: 'Dr Senior' });
    expect(msg).toMatch(/Dressing clinic/);
    expect(msg).toMatch(/Audit slides/);
    expect(msg).toMatch(/— Dr Senior$/);
  });
  it('messages name patients by hospital number only, and commend positively', () => {
    const r = assessPerson(reg, { ...base, roundsSet: new Set(['7|p1|2026-11-02']), notes: 3 });
    const msg = composeChaseMessage(r, base);
    expect(msg).toMatch(/UN123 \(Ward 5, bed 3\)/);
    expect(msg).toMatch(/Thank you for what is recorded/);
    const good = composeChaseMessage(assessPerson(reg, { ...base, roundsSet: new Set(['7|p1|2026-11-02', '7|p1|2026-11-06']) }), base);
    expect(good).toMatch(/^Dear Dr Ada Obi,\nWell done/);
  });
  it('house-officer morning rounds count', () => {
    const ho = { id: 3, full_name: 'Tunde', grade: 'house_officer', phone: null };
    const r = assessPerson(ho, { ...base, roundsSet: new Set(), morning: { expected: 2, done: 1, days: [
      { day: '2026-11-03', expected: 1, done: 1, missed: 0, late: 0, no_folder: 0 },
      { day: '2026-11-04', expected: 1, done: 0, missed: 1, late: 0, no_folder: 0 },
      { day: '2026-10-20', expected: 5, done: 0, missed: 5, late: 0, no_folder: 0 }, // outside the period
    ] } });
    expect(r.morning).toMatchObject({ expected: 2, done: 1, missed: 1, badDays: ['2026-11-04'] });
    expect(composeChaseMessage(r, base)).toMatch(/Morning round \(07:00–09:00\): 1 missed — on Wed,? 4 Nov/);
  });
  it('periods never include today and fall back when invalid', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    expect(validPeriod('2026-11-09', '2026-11-20', now)).toEqual({ from: '2026-11-09', to: '2026-11-11' });
    expect(validPeriod('junk', '', now)).toEqual({ from: '2026-11-05', to: '2026-11-11' });
    expect(presetRange('lastWeek', '2026-11-12')).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(presetRange('thisWeek', '2026-11-12')).toEqual({ from: '2026-11-09', to: '2026-11-11' });
  });
});
