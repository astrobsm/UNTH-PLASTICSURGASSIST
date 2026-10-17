/**
 * Posting onboarding: late registration produces proportionate catch-up, the
 * posting dates are validated, the rules carry the live sign-out numbers, and
 * the form cannot be submitted until every required rule is ticked.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { previewCatchUp, signOutRules } from '../data/postingRules';

vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn(async () => ({ rows: [] })), getPool: vi.fn() }));
import { computeCatchUp, validatePosting } from '../../api/_lib/postingOnboarding.js';

const HO = { cmeArticles: 50, cbtTests: 4, selfAssessments: 20, patients: 30, duties: 20, loginDays: 25 };

describe('catch-up for late registration', () => {
  it('none when registering on or before the start date', () => {
    expect(computeCatchUp({ start: '2026-10-17', end: '2027-01-15', today: '2026-10-17', level: 'house_officer' }).daysLate).toBe(0);
    expect(previewCatchUp('2026-10-20', '2027-01-15', '2026-10-17', HO)).toBeNull();
  });
  it('is proportionate to the days missed, with a 7–14 day deadline', () => {
    // 90-day HO posting, 30 days late -> a third of 50 articles, a third of 4 CBTs (floor)
    const c = computeCatchUp({ start: '2026-09-17', end: '2026-12-16', today: '2026-10-17', level: 'house_officer' });
    expect(c.daysLate).toBe(30);
    expect(c.articles).toBe(17);
    expect(c.cbt).toBe(1);
    expect(c.due).toBe('2026-10-31');
    expect(previewCatchUp('2026-09-17', '2026-12-16', '2026-10-17', HO)).toMatchObject({ daysLate: 30, articles: 17, cbt: 1, dueInDays: 14 });
  });
  it('a few days late still owes at least one article and gets a week', () => {
    const c = computeCatchUp({ start: '2026-10-15', end: '2027-04-13', today: '2026-10-17', level: 'registrar' });
    expect(c.articles).toBeGreaterThanOrEqual(1);
    expect(c.due).toBe('2026-10-24');
  });
});

describe('posting validation', () => {
  const today = '2026-10-17';
  it.each([
    [{ start: '', end: '2027-01-01' }, /required/],
    [{ start: '2026-10-17', end: '2026-10-20' }, /at least a week/],
    [{ start: '2027-02-01', end: '2027-05-01' }, /60 days away/],
    [{ start: '2026-01-01', end: '2026-03-01' }, /already ended/],
  ])('%o is rejected', (p, msg) => {
    expect(validatePosting({ ...p, today })).toMatch(msg);
  });
  it('accepts a normal posting', () => {
    expect(validatePosting({ start: '2026-10-01', end: '2026-12-31', today })).toBeNull();
  });
});

describe('sign-out rules', () => {
  it('use the live thresholds and requirements, and add catch-up and HO rounds when relevant', () => {
    const rules = signOutRules({ grade: 'house_officer', req: HO, passThreshold: 70, minSectionScore: 40, cmeAvailable: 63, late: true });
    const text = rules.map(r => r.text).join('\n');
    expect(text).toMatch(/at least 70%/);
    expect(text).toMatch(/below 40%/);
    expect(text).toMatch(/ALL the CME articles assigned to your role \(63 currently available\)/);
    expect(text).toMatch(/4 tests/);
    expect(rules.some(r => r.id === 'rounds')).toBe(true);
    expect(rules.some(r => r.id === 'catchup' && r.mustTick)).toBe(true);
    const sr = signOutRules({ grade: 'senior_registrar', req: HO, passThreshold: 70, minSectionScore: 40, cmeAvailable: null, late: false });
    expect(sr.some(r => r.id === 'rounds' || r.id === 'catchup')).toBe(false);
  });
});

vi.mock('../services/postingOnboardingService', () => ({
  postingOnboardingService: { submit: vi.fn(async () => ({ applicable: true, required: false, catchUp: null })) },
}));
import PostingOnboarding from '../components/onboarding/PostingOnboarding';

describe('PostingOnboarding form', () => {
  it('needs a unit, the expectations read and every required rule ticked', () => {
    render(<PostingOnboarding userName="Ada Obi" onLogout={() => {}} onDone={() => {}} status={{
      applicable: true, required: true, grade: 'registrar', today: '2026-10-17',
      units: [{ key: 'unit1', name: 'PS Unit 1' }, { key: 'unit2', name: 'PS Unit 2' }],
      defaults: { start: '2026-10-10', end: '2027-04-08' },
      requirements: { cmeArticles: 50, cbtTests: 12, selfAssessments: 30, patients: 100, duties: 60, loginDays: 75 },
      signOut: { passThreshold: 70, minSectionScore: 40 }, cmeAvailable: 40,
    }} />);
    expect(screen.getByText(/registering 7 days after your posting started/)).toBeTruthy();
    expect(screen.getByText('Select the unit you are posted to')).toBeTruthy();
    fireEvent.click(screen.getByText('PS Unit 2'));
    fireEvent.click(screen.getByText('Continue'));
    expect(screen.getByText('Patient care')).toBeTruthy();
    fireEvent.click(screen.getByText(/I have read what is expected/));
    fireEvent.click(screen.getByText('Continue'));
    const submit = screen.getByText('Accept and start my rotation') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const acceptBox = screen.getByText(/I accept these expectations/).closest('label')!.querySelector('input') as HTMLInputElement;
    expect(acceptBox.disabled).toBe(true);
    // tick every required rule
    for (const box of screen.getAllByRole('checkbox')) if (box !== acceptBox && !(box as HTMLInputElement).checked) fireEvent.click(box);
    expect(acceptBox.disabled).toBe(false);
    fireEvent.click(screen.getByText(/I accept these expectations/));
    expect(submit.disabled).toBe(false);
  });
});

describe('wiring', () => {
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', '..', p), 'utf8');
  it('is gated in the app and never queued offline', () => {
    expect(read('src/App.tsx')).toMatch(/<PostingOnboarding/);
    expect(read('src/services/apiClient.ts')).toMatch(/'\/posting-onboarding'/);
    expect(read('src/sw.ts')).toMatch(/'\/api\/posting-onboarding'/);
  });
});
