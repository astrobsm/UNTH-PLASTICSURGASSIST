/**
 * The scoring formula must have exactly one definition.
 *
 * Six surfaces show a trainee's score — Medical Training, its participation
 * tracker, Training Admin, HO Tracking, the rotations endpoint and the student
 * dashboard — and each once carried its own weights. A trainee's Medical
 * Training page said one thing and their Training Admin row said another, and
 * a tracker could read "CBT 0%" beside "3/4 completed".
 *
 * These tests fail if a second definition reappears.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  SCORE_WEIGHTS,
  PASS_THRESHOLD,
  getRequirements,
  normalizeLevel,
  computeOverall,
  scoreTrainee,
} from '../../api/_lib/traineeScoring.js';
import {
  PERFORMANCE_WEIGHTS,
  SIGN_OUT_THRESHOLD,
  MINIMUM_REQUIREMENTS,
} from '../services/performanceService';

const ROOT = path.resolve(__dirname, '../..');

describe('scoring weights', () => {
  it('sum to exactly 1', () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it('are the same numbers the frontend renders', () => {
    expect(PERFORMANCE_WEIGHTS.cbt).toBe(SCORE_WEIGHTS.cbt);
    expect(PERFORMANCE_WEIGHTS.patientCare).toBe(SCORE_WEIGHTS.clinical);
    expect(PERFORMANCE_WEIGHTS.dutyPromptness).toBe(SCORE_WEIGHTS.duties);
    expect(PERFORMANCE_WEIGHTS.attendance).toBe(SCORE_WEIGHTS.attendance);
    expect(SIGN_OUT_THRESHOLD).toBe(PASS_THRESHOLD);
  });

  it('carry the frontend requirements straight through', () => {
    for (const level of ['house_officer', 'junior_resident', 'senior_resident'] as const) {
      const shared = getRequirements(level);
      const frontend = MINIMUM_REQUIREMENTS[level];
      expect(frontend.cbtTests).toBe(shared.cbtTests);
      expect(frontend.patientEntries).toBe(shared.patients);
      expect(frontend.dutiesCompleted).toBe(shared.duties);
      expect(frontend.loginDays).toBe(shared.loginDays);
    }
  });
});

describe('no second copy of the formula', () => {
  /** Every server endpoint, so a new one cannot quietly reintroduce weights. */
  const apiFiles = fs
    .readdirSync(path.join(ROOT, 'api'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(ROOT, 'api', f));

  it('no endpoint hard-codes a weighted-sum formula', () => {
    const offenders: string[] = [];
    for (const file of apiFiles) {
      const src = fs.readFileSync(file, 'utf8');
      // A weighted sum looks like `x * 0.30) + (y * 0.35`.
      if (/\*\s*0\.\d+\s*\)\s*\+\s*\(/.test(src)) offenders.push(path.basename(file));
    }
    expect(offenders).toEqual([]);
  });

  it('no endpoint declares its own per-level requirements table', () => {
    const offenders: string[] = [];
    for (const file of apiFiles) {
      const src = fs.readFileSync(file, 'utf8');
      if (/cbtTests:\s*\d+/.test(src)) offenders.push(path.basename(file));
    }
    expect(offenders).toEqual([]);
  });
});

describe('level names used across the app resolve to a requirement set', () => {
  // The roles this database actually stores. `junior_registrar` and
  // `house_officer` were both missing from an endpoint's role filter, and
  // `registrar` fell through a lookup keyed on training-stage names, so the
  // requirement came back undefined and every score built on it was NaN.
  const roles = [
    'house_officer', 'junior_registrar', 'registrar', 'senior_registrar',
    'HOUSE_OFFICER', 'Senior Registrar', 'intern', 'ho',
  ];

  it.each(roles)('%s resolves to real requirements', (role) => {
    const reqs = getRequirements(role);
    expect(reqs).toBeDefined();
    for (const [key, value] of Object.entries(reqs)) {
      expect(Number.isFinite(value), `${role}.${key}`).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
  });

  it('distinguishes senior registrar from registrar', () => {
    expect(normalizeLevel('senior_registrar')).toBe('senior_resident');
    expect(normalizeLevel('junior_registrar')).toBe('junior_resident');
    expect(normalizeLevel('registrar')).toBe('junior_resident');
    expect(normalizeLevel('house_officer')).toBe('house_officer');
  });

  it('maps clinical students onto their posting', () => {
    expect(normalizeLevel('student_surgery_3')).toBe('student_surgery_3');
    expect(normalizeLevel('surgery_2')).toBe('student_surgery_2');
    expect(normalizeLevel('student')).toBe('student_surgery_1');
  });
});

describe('scoreTrainee', () => {
  it('never returns NaN, whatever the counts', () => {
    for (const counts of [
      {},
      { cbtTests: 3, cbtAverage: 80, patients: 12, duties: 5, loginDays: 9 },
      { cbtTests: 999, cbtAverage: 500, patients: -4, duties: NaN, loginDays: undefined },
    ]) {
      const r = scoreTrainee({ level: 'registrar', counts: counts as never });
      expect(Number.isFinite(r.overall)).toBe(true);
      for (const v of Object.values(r.components)) expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('clamps every component to 0-100', () => {
    const r = scoreTrainee({
      level: 'house_officer',
      counts: { cbtAverage: 250, patients: 10_000, duties: 10_000, loginDays: 10_000, cmeArticles: 10_000 },
    });
    for (const v of Object.values(r.components)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
    expect(r.overall).toBeLessThanOrEqual(100);
  });

  it('a perfect record clears the threshold and an empty one does not', () => {
    const reqs = getRequirements('house_officer');
    const perfect = scoreTrainee({
      level: 'house_officer',
      counts: {
        cmeArticles: reqs.cmeArticles, cbtTests: reqs.cbtTests, cbtAverage: 100,
        selfAssessments: reqs.selfAssessments, selfAssessmentAverage: 100,
        patients: reqs.patients, duties: reqs.duties, loginDays: reqs.loginDays,
      },
    });
    expect(perfect.overall).toBe(100);
    expect(perfect.eligibility.eligible).toBe(true);
    expect(perfect.eligibility.notMet).toEqual([]);

    const empty = scoreTrainee({ level: 'house_officer', counts: {} });
    expect(empty.overall).toBe(0);
    expect(empty.eligibility.eligible).toBe(false);
  });

  it('weighs CME and self-assessment, which the old formulas ignored entirely', () => {
    const base = { cbtAverage: 0, patients: 0, duties: 0, loginDays: 0 };
    const withReading = scoreTrainee({
      level: 'house_officer',
      counts: { ...base, cmeArticles: getRequirements('house_officer').cmeArticles },
    });
    expect(withReading.overall).toBeCloseTo(SCORE_WEIGHTS.cme * 100, 5);

    const withAssessment = scoreTrainee({
      level: 'house_officer',
      counts: { ...base, selfAssessmentAverage: 100 },
    });
    expect(withAssessment.overall).toBeCloseTo(SCORE_WEIGHTS.selfAssessment * 100, 5);
  });

  it('computeOverall agrees with scoreTrainee', () => {
    const counts = { cmeArticles: 25, cbtTests: 2, cbtAverage: 64, selfAssessments: 8,
      selfAssessmentAverage: 71, patients: 15, duties: 10, loginDays: 12 };
    const r = scoreTrainee({ level: 'house_officer', counts });
    expect(computeOverall(r.components)).toBe(r.overall);
  });
});
