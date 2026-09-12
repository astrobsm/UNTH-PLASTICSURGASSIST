/**
 * The longitudinal and multimodal engine.
 *
 * The behaviour that matters most here is refusal: not computing a percentage
 * off a near-zero baseline, not computing acceleration from three points, not
 * resolving a discordance, and not predicting without enough data.
 */

import { describe, it, expect } from 'vitest';
import {
  changeBetween, rateOfChange, growthAcceleration, classifyDomainTrend,
  multimodalAssessment, predictionEligibility, methodConsistency,
// Plain ES module, shared with the serverless functions.
} from '../../api/_lib/scarLongitudinal.js';

const at = (pairs: [number, number][]) => pairs.map(([day, value]) => ({ day, value }));

describe('changeBetween', () => {
  it('reports absolute and percentage change', () => {
    // The brief's worked example: 12.4 -> 10.1 is -2.3 and -18.5%.
    const c = changeBetween(12.4, 10.1);
    expect(c.absolute).toBeCloseTo(-2.3, 2);
    expect(c.percent).toBeCloseTo(-18.55, 1);
  });

  it('withholds the percentage when the baseline is near zero', () => {
    // 0.05 -> 0.15 is "200%" and a tenth of a square centimetre.
    const c = changeBetween(0.05, 0.15);
    expect(c.absolute).toBeCloseTo(0.1, 3);
    expect(c.percent).toBeNull();
    expect(c.percentWithheld).toBe(true);
    expect(c.percentWithheldReason).toMatch(/too close to zero/);
  });

  it('never divides by zero', () => {
    const c = changeBetween(0, 4);
    expect(c.ok).toBe(true);
    expect(c.percent).toBeNull();
    expect(Number.isFinite(c.absolute)).toBe(true);
  });

  it('refuses when either value is missing', () => {
    expect(changeBetween(null as never, 3).ok).toBe(false);
    expect(changeBetween(3, undefined as never).ok).toBe(false);
  });

  it('handles an increase as readily as a decrease', () => {
    expect(changeBetween(10, 15).percent).toBeCloseTo(50, 5);
  });
});

describe('rateOfChange', () => {
  it('converts a daily slope into a monthly rate', () => {
    // +1 unit every 30.44 days is +1 a month.
    const r = rateOfChange(at([[0, 0], [30.44, 1]]));
    expect(r.perMonth).toBeCloseTo(1, 2);
  });

  it('fits across the whole series, not just the endpoints', () => {
    const r = rateOfChange(at([[0, 10], [30, 12], [60, 14], [90, 16]]));
    expect(r.perMonth).toBeCloseTo(2.03, 1);
    expect(r.r2).toBeCloseTo(1, 3);
    expect(r.n).toBe(4);
  });

  it('refuses a rate from one observation', () => {
    expect(rateOfChange(at([[0, 5]])).ok).toBe(false);
  });

  it('labels the unit when given one', () => {
    expect(rateOfChange(at([[0, 1], [30, 2]]), { unit: 'cm²' }).unit).toBe('cm²/month');
  });
});

describe('growthAcceleration', () => {
  it('detects an accelerating keloid', () => {
    // Gaps widening: 0.4, then 0.8, then 1.5 a period.
    const a = growthAcceleration(at([[0, 10], [30, 10.4], [60, 11.2], [90, 12.7]]));
    expect(a.ok).toBe(true);
    expect(a.accelerating).toBe(true);
    expect(a.latePerMonth).toBeGreaterThan(a.earlyPerMonth);
    expect(a.meaningful).toBe(true);
  });

  it('detects a decelerating one', () => {
    const a = growthAcceleration(at([[0, 10], [30, 11.5], [60, 12.3], [90, 12.5]]));
    expect(a.accelerating).toBe(false);
  });

  it('refuses on three observations, as the brief requires', () => {
    const a = growthAcceleration(at([[0, 1], [30, 2], [60, 4]]));
    expect(a.ok).toBe(false);
    expect(a.reason).toMatch(/at least four/);
  });

  it('calls a steady line unaccelerated and not meaningful', () => {
    const a = growthAcceleration(at([[0, 0], [30, 1], [60, 2], [90, 3]]));
    expect(a.ok).toBe(true);
    expect(a.meaningful).toBe(false);
  });
});

describe('classifyDomainTrend', () => {
  it('calls a growing area worsening', () => {
    expect(classifyDomainTrend(at([[0, 10], [60, 14]]), { worseIsHigher: true }).trend)
      .toBe('worsening');
  });

  it('calls a shrinking area improving', () => {
    expect(classifyDomainTrend(at([[0, 14], [60, 10]]), { worseIsHigher: true }).trend)
      .toBe('improving');
  });

  it('respects a domain where lower is worse', () => {
    // Range of motion: falling is worsening.
    expect(classifyDomainTrend(at([[0, 90], [60, 60]]), { worseIsHigher: false }).trend)
      .toBe('worsening');
  });

  it('calls a small change stable rather than a trend', () => {
    expect(classifyDomainTrend(at([[0, 10], [60, 10.4]]), { worseIsHigher: true }).trend)
      .toBe('stable');
  });

  it('calls a swinging series fluctuating, not stable', () => {
    // Hiding this as "stable" would conceal exactly the instability that
    // matters clinically.
    const t = classifyDomainTrend(at([[0, 10], [30, 18], [60, 9], [90, 17]]), { worseIsHigher: true });
    expect(t.trend).toBe('fluctuating');
  });

  it('is indeterminate on a single observation', () => {
    expect(classifyDomainTrend(at([[0, 10]])).trend).toBe('indeterminate');
  });
});

describe('multimodalAssessment', () => {
  const d = (label: string, modality: string, trend: string) =>
    ({ domain: label, label, modality, trend });

  it('reports consistent progression when several modalities worsen together', () => {
    const m = multimodalAssessment([
      d('Area', 'image', 'worsening'),
      d('Volume', '3d', 'worsening'),
      d('Firmness', 'exam', 'worsening'),
      d('Itch', 'patient', 'worsening'),
    ]);
    expect(m.verdict).toBe('consistent_progression');
    expect(m.summary).toMatch(/possible progression/);
    expect(m.modalities.length).toBe(4);
  });

  it('reports consistent response when they improve together', () => {
    const m = multimodalAssessment([
      d('Area', 'image', 'improving'),
      d('DKS', 'score', 'improving'),
      d('Pain', 'patient', 'improving'),
    ]);
    expect(m.verdict).toBe('consistent_response');
    expect(m.summary).toMatch(/treatment response/);
  });

  it('declares discordance and refuses to resolve it', () => {
    const m = multimodalAssessment([
      d('Area', 'image', 'stable'),
      d('Volume', '3d', 'worsening'),
      d('Firmness', 'exam', 'improving'),
    ]);
    expect(m.verdict).toBe('discordant');
    expect(m.summary).toMatch(/Clinical interpretation required/);
    // It names both sides rather than picking one.
    expect(m.summary).toMatch(/Firmness/);
    expect(m.summary).toMatch(/Volume/);
    expect(m.disagreeing).toHaveLength(2);
  });

  it('needs at least two measured domains', () => {
    expect(multimodalAssessment([d('Area', 'image', 'worsening')]).verdict).toBe('insufficient');
    expect(multimodalAssessment([]).verdict).toBe('insufficient');
  });

  it('ignores indeterminate domains rather than counting them as agreement', () => {
    const m = multimodalAssessment([
      d('Area', 'image', 'worsening'),
      d('Volume', '3d', 'indeterminate'),
      d('Pain', 'patient', 'indeterminate'),
    ]);
    expect(m.verdict).toBe('insufficient');
  });

  it('reports fluctuation when nothing has a direction', () => {
    const m = multimodalAssessment([
      d('Area', 'image', 'fluctuating'),
      d('Itch', 'patient', 'fluctuating'),
    ]);
    expect(m.verdict).toBe('fluctuating');
  });
});

describe('predictionEligibility', () => {
  const good = [
    { day: 0, imageQualityScore: 0.9, scaleReliable: true },
    { day: 30, imageQualityScore: 0.85, scaleReliable: true },
    { day: 60, imageQualityScore: 0.9, scaleReliable: true },
  ];

  it('passes a well-followed scar', () => {
    const e = predictionEligibility(good);
    expect(e.eligible).toBe(true);
    expect(e.blockers).toEqual([]);
  });

  it('blocks on too few assessments and says how many are needed', () => {
    const e = predictionEligibility(good.slice(0, 2));
    expect(e.eligible).toBe(false);
    expect(e.message).toMatch(/2 of 3 required assessments/);
  });

  it('blocks on too short a follow-up', () => {
    const e = predictionEligibility([
      { day: 0, scaleReliable: true }, { day: 5, scaleReliable: true }, { day: 10, scaleReliable: true },
    ]);
    expect(e.eligible).toBe(false);
    expect(e.message).toMatch(/spans 10 days/);
  });

  it('blocks when most photographs are poor', () => {
    const e = predictionEligibility(good.map((o) => ({ ...o, imageQualityScore: 0.2 })));
    expect(e.eligible).toBe(false);
    expect(e.message).toMatch(/quality floor/);
  });

  it('blocks when any assessment lacks a scale', () => {
    const e = predictionEligibility([...good.slice(0, 2), { day: 60, scaleReliable: false }]);
    expect(e.eligible).toBe(false);
    expect(e.message).toMatch(/no reliable scale/);
  });

  it('always explains what is missing rather than returning a bare false', () => {
    const e = predictionEligibility([]);
    expect(e.message).toMatch(/Prediction unavailable due to insufficient reliable longitudinal data/);
    expect(e.blockers.length).toBeGreaterThan(0);
  });

  it('lets the rules be configured', () => {
    expect(predictionEligibility(good.slice(0, 2), { minObservations: 2, minSpanDays: 20 }).eligible)
      .toBe(true);
  });
});

describe('methodConsistency', () => {
  it('is quiet when one method was used throughout', () => {
    const m = methodConsistency([{ method: 'clinician_traced' }, { method: 'clinician_traced' }]);
    expect(m.consistent).toBe(true);
    expect(m.warning).toBeNull();
  });

  it('warns when the method changed mid-series', () => {
    const m = methodConsistency([
      { method: 'clinician_traced' }, { method: 'ai_segmentation' },
    ]);
    expect(m.consistent).toBe(false);
    expect(m.warning).toMatch(/interpret longitudinal change with caution/);
    expect(m.methods).toHaveLength(2);
  });

  it('ignores assessments with no recorded method', () => {
    expect(methodConsistency([{ method: 'clinician_traced' }, {}]).consistent).toBe(true);
  });
});
