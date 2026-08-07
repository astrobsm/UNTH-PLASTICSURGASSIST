import { describe, it, expect } from 'vitest';
import {
  computeHealingAnalytics,
  areaVelocityCm2PerWeek,
  healingAlerts,
  type WoundAssessment,
} from '../services/woundMonitorService';

/**
 * Tests for the WoundProgress Monitor healing analytics.
 *
 * These are the correctness-critical core: they classify a wound as improving,
 * stalled or worsening and project closure, which drives the dashboard triage
 * and the clinician-facing alerts. The same maths is mirrored server-side in
 * api/wounds.js recomputeWound.
 */

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Build a timeline: areas spaced one week apart, oldest first. */
function series(areas: number[], opts: { reliable?: boolean } = {}): WoundAssessment[] {
  const base = Date.UTC(2026, 0, 1);
  return areas.map((area, i) => ({
    wound_id: 1,
    patient_id: 1,
    area_cm2: area,
    assessed_at: new Date(base + i * WEEK).toISOString(),
    scale_reliable: opts.reliable !== false,
  }));
}

/**
 * The shape the SERVER actually returns.
 *
 * area_cm2 is a Postgres DECIMAL, and node-postgres returns those as strings to
 * preserve precision. Every test above builds fixtures with JavaScript numbers,
 * which is why a `typeof area_cm2 === 'number'` check passed the whole suite
 * while discarding every real assessment in production — a wound with recorded
 * measurements displayed "0 assessments" and no current area.
 */
function serverSeries(areas: string[]): WoundAssessment[] {
  const base = Date.UTC(2026, 0, 1);
  return areas.map((area, i) => ({
    wound_id: 3,
    patient_id: 821,
    area_cm2: area as unknown as number,
    assessed_at: new Date(base + i * WEEK).toISOString(),
  }));
}

describe('decimal values arriving as strings from Postgres', () => {
  it('counts a single server-returned assessment', () => {
    // The exact row from the wound that surfaced this: area "81.20".
    const result = computeHealingAnalytics(serverSeries(['81.20']));
    expect(result.assessmentCount).toBe(1);
  });

  it('computes reduction and velocity across string areas', () => {
    const result = computeHealingAnalytics(serverSeries(['100.00', '80.00', '60.00']));
    expect(result.assessmentCount).toBe(3);
    expect(result.percentAreaReduction).toBeCloseTo(40, 1);
    expect(result.velocityCm2PerWeek).toBeCloseTo(-20, 1);
  });

  it('treats a null area as missing, not as zero', () => {
    // Coercion must not turn an absent measurement into a real 0 cm² wound,
    // which would read as complete healing.
    const mixed = serverSeries(['50.00', '40.00']);
    (mixed[1] as any).area_cm2 = null;
    expect(computeHealingAnalytics(mixed).assessmentCount).toBe(1);
  });

  it('ignores a non-numeric string rather than counting it as zero', () => {
    const bad = serverSeries(['50.00']);
    (bad[0] as any).area_cm2 = 'not measured';
    expect(computeHealingAnalytics(bad).assessmentCount).toBe(0);
  });

  it('agrees with the numeric fixtures it is meant to mirror', () => {
    const asStrings = computeHealingAnalytics(serverSeries(['90.00', '45.00']));
    const asNumbers = computeHealingAnalytics(series([90, 45]));
    expect(asStrings.assessmentCount).toBe(asNumbers.assessmentCount);
    expect(asStrings.percentAreaReduction).toBeCloseTo(asNumbers.percentAreaReduction, 3);
    expect(asStrings.velocityCm2PerWeek).toBeCloseTo(asNumbers.velocityCm2PerWeek, 3);
  });
});

describe('areaVelocityCm2PerWeek', () => {
  it('is negative when the wound is shrinking', () => {
    const v = areaVelocityCm2PerWeek(series([10, 8, 6, 4]));
    expect(v).toBeCloseTo(-2, 5);
  });

  it('is positive when the wound is growing', () => {
    const v = areaVelocityCm2PerWeek(series([4, 6, 8]));
    expect(v).toBeCloseTo(2, 5);
  });

  it('is zero for a single assessment (no spread to regress over)', () => {
    expect(areaVelocityCm2PerWeek(series([10]))).toBe(0);
  });
});

describe('computeHealingAnalytics', () => {
  it('reports insufficient_data with no assessments', () => {
    const a = computeHealingAnalytics([]);
    expect(a.status).toBe('insufficient_data');
    expect(a.assessmentCount).toBe(0);
  });

  it('classifies a steadily shrinking wound as improving', () => {
    const a = computeHealingAnalytics(series([12, 9, 6, 3]));
    expect(a.status).toBe('improving');
    expect(a.percentAreaReduction).toBeCloseTo(75, 5);
    expect(a.velocityCm2PerWeek).toBeLessThan(0);
    expect(a.projectedDaysToClosure).toBeGreaterThan(0);
  });

  it('classifies a growing wound as worsening', () => {
    const a = computeHealingAnalytics(series([4, 6, 9, 12]));
    expect(a.status).toBe('worsening');
    expect(a.projectedDaysToClosure).toBeNull();
  });

  it('classifies an unchanging wound as stagnant', () => {
    const a = computeHealingAnalytics(series([8, 8, 8, 8]));
    expect(a.status).toBe('stagnant');
  });

  it('marks a wound as healed when the latest area is zero', () => {
    const a = computeHealingAnalytics(series([6, 3, 0]));
    expect(a.status).toBe('healed');
  });

  it('does not project closure for a wound that is not shrinking', () => {
    const a = computeHealingAnalytics(series([5, 5, 5]));
    expect(a.projectedDaysToClosure).toBeNull();
  });

  it('flags unreliable scale when any measurement lacked calibration', () => {
    const rows = series([10, 8, 6]);
    rows[1].scale_reliable = false;
    const a = computeHealingAnalytics(rows);
    expect(a.hasUnreliableScale).toBe(true);
  });

  it('ignores assessments with no usable area', () => {
    const rows: WoundAssessment[] = [
      ...series([10, 5]),
      { wound_id: 1, patient_id: 1, area_cm2: null, assessed_at: new Date().toISOString() },
    ];
    const a = computeHealingAnalytics(rows);
    expect(a.assessmentCount).toBe(2);
  });
});

describe('healingAlerts', () => {
  it('raises a review alert for a worsening wound', () => {
    const alerts = healingAlerts(computeHealingAnalytics(series([4, 6, 9, 12])));
    expect(alerts.some(a => /increasing|review/i.test(a))).toBe(true);
  });

  it('raises a stalled alert for a stagnant wound', () => {
    const alerts = healingAlerts(computeHealingAnalytics(series([8, 8, 8, 8])));
    expect(alerts.some(a => /stall/i.test(a))).toBe(true);
  });

  it('warns about approximate sizing when calibration was unreliable', () => {
    const rows = series([10, 8]);
    rows[0].scale_reliable = false;
    const alerts = healingAlerts(computeHealingAnalytics(rows));
    expect(alerts.some(a => /calibration|approximate/i.test(a))).toBe(true);
  });

  it('is empty for a cleanly improving, calibrated wound', () => {
    const alerts = healingAlerts(computeHealingAnalytics(series([12, 8, 4])));
    expect(alerts).toHaveLength(0);
  });
});
