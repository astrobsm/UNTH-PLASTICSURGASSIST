// @vitest-environment node
/**
 * Junior doctors rotate between the units on a cycle (patients stay with the
 * unit), and house officers' 07:00–09:00 rounds are scored for house officers.
 */
import { describe, it, expect } from 'vitest';
import {
  effectiveUnits, rebaseUnits, nextRotationDay, normaliseUnitConfig, dayNumberFromYmd, ymdFromDayNumber,
} from '../../api/_lib/unitCallPattern.js';
import { roundWindow, patientRoundStatus, windowState } from '../../api/_lib/morningRounds.js';
import {
  scoreTrainee, computeOverall, SCORE_WEIGHTS, HO_SCORE_WEIGHTS, morningRoundsComponent,
} from '../../api/_lib/traineeScoring.js';

const day = (ymd: string) => dayNumberFromYmd(ymd)!;
const unit = (key: string, c: string[], sr: string[], reg: string[], ho: string[]) =>
  ({ key, name: key, consultant_ids: c, senior_registrar_ids: sr, registrar_ids: reg, house_officer_ids: ho });

const rotation = { enabled: true, start_date: '2026-10-05', weeks: { senior_registrar: 0, registrar: 6, house_officer: 2 } };
const base = [unit('u1', ['C1'], ['S1'], ['R1'], ['H1', 'H2']), unit('u2', ['C2'], ['S2'], ['R2'], ['H3'])];
const config = { anchor_date: '2026-09-28', rotation, units: base };

describe('unit rotation', () => {
  it('keeps everyone in place during the first block', () => {
    const [u1] = effectiveUnits(config, day('2026-10-10'));
    expect(u1.house_officer_ids).toEqual(['H1', 'H2']);
    expect(u1.registrar_ids).toEqual(['R1']);
  });

  it('swaps house officers after 2 weeks and registrars after 6; consultants and fixed SRs stay', () => {
    const [u1, u2] = effectiveUnits(config, day('2026-10-19'));
    expect(u1.house_officer_ids).toEqual(['H3']);
    expect(u2.house_officer_ids).toEqual(['H1', 'H2']);
    expect(u1.registrar_ids).toEqual(['R1']);
    expect(u1.consultant_ids).toEqual(['C1']);
    expect(u1.senior_registrar_ids).toEqual(['S1']);
    const [later] = effectiveUnits(config, day('2026-11-16'));
    expect(later.registrar_ids).toEqual(['R2']);
    // After 4 weeks the house officers are back.
    expect(effectiveUnits(config, day('2026-11-02'))[0].house_officer_ids).toEqual(['H1', 'H2']);
  });

  it('a manual edit made mid-cycle is stored so today reads exactly as edited', () => {
    const today = day('2026-10-20'); // HOs swapped this block
    const edited = [unit('u1', ['C1'], ['S1'], ['R1'], ['H3', 'H2']), unit('u2', ['C2'], ['S2'], ['R2'], ['H1'])];
    const stored = rebaseUnits(edited, rotation, today);
    expect(effectiveUnits({ ...config, units: stored }, today).map(u => u.house_officer_ids)).toEqual([['H3', 'H2'], ['H1']]);
    expect(normaliseUnitConfig({ ...config, units: edited }, today).config!.units).toEqual(stored);
  });

  it('reports the next rotation date, or none for a fixed grade', () => {
    expect(ymdFromDayNumber(nextRotationDay(rotation, 'house_officer', day('2026-10-10')))).toBe('2026-10-19');
    expect(nextRotationDay(rotation, 'senior_registrar', day('2026-10-10'))).toBeNull();
  });

  it('does not rotate when rotation is off or absent', () => {
    expect(effectiveUnits({ ...config, rotation: { ...rotation, enabled: false } }, day('2026-10-19'))[0].house_officer_ids).toEqual(['H1', 'H2']);
    expect(effectiveUnits({ anchor_date: '2026-09-28', units: base }, day('2026-10-19'))[0].house_officer_ids).toEqual(['H1', 'H2']);
  });

  it('rejects a doctor listed in both units', () => {
    const r = normaliseUnitConfig({ ...config, units: [unit('u1', ['C1'], [], [], ['H1']), unit('u2', ['C2'], [], [], ['H1'])] });
    expect(r.error).toMatch(/both units/);
  });
});

describe('morning round status', () => {
  const d = day('2026-10-01');
  const at = (iso: string, folder = true) => ({ at: new Date(iso), folder });

  it('the window is 07:00–09:00 WAT (06:00–08:00 UTC)', () => {
    const w = roundWindow(d);
    expect(w.start.toISOString()).toBe('2026-10-01T06:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-10-01T08:00:00.000Z');
    expect(windowState(d, new Date('2026-10-01T05:59:00Z'))).toBe('before');
    expect(windowState(d, new Date('2026-10-01T07:30:00Z'))).toBe('open');
    expect(windowState(d, new Date('2026-10-01T08:00:00Z'))).toBe('closed');
  });

  it('classifies done / no folder / late / missed / pending', () => {
    const after = new Date('2026-10-01T12:00:00Z');
    expect(patientRoundStatus([at('2026-10-01T06:30:00Z')], d, after)).toBe('done');
    expect(patientRoundStatus([at('2026-10-01T06:30:00Z', false)], d, after)).toBe('no_folder');
    expect(patientRoundStatus([at('2026-10-01T10:00:00Z')], d, after)).toBe('late');
    expect(patientRoundStatus([], d, after)).toBe('missed');
    expect(patientRoundStatus([], d, new Date('2026-10-01T07:00:00Z'))).toBe('pending');
  });
});

describe('morning rounds in scoring', () => {
  it('HO weights sum to 1 and differ from the standard ones only by moving 15% from patient care', () => {
    const sum = Object.values(HO_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(HO_SCORE_WEIGHTS.clinical + HO_SCORE_WEIGHTS.morningRounds).toBeCloseTo(SCORE_WEIGHTS.clinical, 10);
  });

  it('applies only to house officers with tracked mornings', () => {
    const counts = { morningRoundsExpected: 10, morningRoundsDone: 8 };
    expect(morningRoundsComponent(counts, 'house_officer')).toBe(80);
    expect(morningRoundsComponent(counts, 'senior_registrar')).toBeNull();
    expect(morningRoundsComponent({ morningRoundsExpected: 0 }, 'house_officer')).toBeNull();
  });

  it('leaves everyone else\'s score unchanged', () => {
    const counts = { cmeArticles: 25, cbtAverage: 60, patients: 50, duties: 30, loginDays: 40, selfAssessmentAverage: 50 };
    const sr = scoreTrainee({ level: 'senior_registrar', counts });
    expect(sr.weights).toBe(SCORE_WEIGHTS);
    const hoUntracked = scoreTrainee({ level: 'house_officer', counts });
    expect(hoUntracked.components.morningRounds).toBeUndefined();
    expect(hoUntracked.weights).toBe(SCORE_WEIGHTS);
  });

  it('a house officer who misses every morning round loses the 15%', () => {
    const full = { cme: 100, cbt: 100, selfAssessment: 100, clinical: 100, duties: 100, attendance: 100 };
    expect(computeOverall(full)).toBe(100);
    expect(computeOverall({ ...full, morningRounds: 0 })).toBe(85);
    expect(computeOverall({ ...full, morningRounds: 100 })).toBe(100);
  });
});
