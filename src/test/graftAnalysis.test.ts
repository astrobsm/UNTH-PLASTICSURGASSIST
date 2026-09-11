/**
 * The graft arithmetic, against cases whose answers are known independently of
 * the code — closed-form geometry, hand-computed regressions, and the clinical
 * situations the formulae exist to catch.
 */

import { describe, it, expect } from 'vitest';
import {
  meshExpansionFactor, planGraft, closureFromBaseline, postoperativeDay,
  fitTrajectory, healingRate, classifyTrend, predictCompletion,
  assessComparability, deriveAlerts, overdueFollowUp,
// Plain ES module, shared with the serverless functions.
} from '../../api/_lib/graftAnalysis.js';

describe('meshExpansionFactor', () => {
  it('reads the ratios actually written on an operation note', () => {
    expect(meshExpansionFactor('1:1')).toBe(1);
    expect(meshExpansionFactor('1:1.5')).toBe(1.5);
    expect(meshExpansionFactor('1:3')).toBe(3);
    expect(meshExpansionFactor(' 1 : 2 ')).toBe(2);
  });

  it('falls back to unmeshed rather than guessing an expansion', () => {
    // Planning a harvest on a guessed expansion is how a patient ends up with
    // too little graft on the table.
    expect(meshExpansionFactor('')).toBe(1);
    expect(meshExpansionFactor('mesh')).toBe(1);
    expect(meshExpansionFactor('3:1')).toBe(1);
    expect(meshExpansionFactor(null)).toBe(1);
    expect(meshExpansionFactor('1:0')).toBe(1);
  });
});

describe('planGraft', () => {
  it('matches the worked example in the brief', () => {
    // 42.7 cm² defect, ~5% margin -> 44.8, meshed 1:1.5 -> 29.9 harvested.
    const p = planGraft({ defectAreaCm2: 42.7, coverageMarginPct: 5, meshRatio: '1:1.5' });
    expect(p.ok).toBe(true);
    expect(p.plannedCoverageCm2).toBeCloseTo(44.84, 1);
    expect(p.plannedHarvestCm2).toBeCloseTo(29.89, 1);
    expect(p.expansionFactor).toBe(1.5);
  });

  it('harvests the covered area exactly when unmeshed', () => {
    const p = planGraft({ defectAreaCm2: 40, coverageMarginPct: 0, meshRatio: '1:1' });
    expect(p.plannedCoverageCm2).toBe(40);
    expect(p.plannedHarvestCm2).toBe(40);
  });

  it('refuses to plan from no measurement', () => {
    expect(planGraft({ defectAreaCm2: 0 }).ok).toBe(false);
    expect(planGraft({ defectAreaCm2: NaN }).ok).toBe(false);
    expect(planGraft({}).ok).toBe(false);
  });

  it('always says it is an estimate', () => {
    expect(planGraft({ defectAreaCm2: 10 }).isEstimate).toBe(true);
  });
});

describe('closureFromBaseline', () => {
  it('computes take from the preserved baseline, not the current area', () => {
    // 50 cm² grafted, 4.4 cm² still open -> 91.2% take, the brief's figure.
    const r = closureFromBaseline(50.2, 4.4);
    expect(r.ok).toBe(true);
    expect(r.closurePct).toBeCloseTo(91.24, 1);
    expect(r.closedAreaCm2).toBeCloseTo(45.8, 1);
  });

  it('reports a donor site part-way through healing', () => {
    // 36.5 cm² donor, 7.1 cm² still raw -> 80.5%, the brief's figure.
    const r = closureFromBaseline(36.5, 7.1);
    expect(r.closurePct).toBeCloseTo(80.55, 1);
  });

  it('flags breakdown beyond the original margin instead of hiding it', () => {
    const r = closureFromBaseline(30, 34);
    expect(r.exceededBaseline).toBe(true);
    // Floors at zero rather than going negative, but the flag preserves the fact.
    expect(r.closurePct).toBe(0);
  });

  it('refuses without a locked baseline', () => {
    expect(closureFromBaseline(0, 5).ok).toBe(false);
    expect(closureFromBaseline(null as never, 5).ok).toBe(false);
    expect(closureFromBaseline(30, null as never).ok).toBe(false);
  });

  it('reads a fully closed site as 100%', () => {
    expect(closureFromBaseline(30, 0).closurePct).toBe(100);
  });
});

describe('postoperativeDay', () => {
  it('counts whole days from the operation', () => {
    expect(postoperativeDay('2026-01-01', '2026-01-08')).toBe(7);
    expect(postoperativeDay('2026-01-01', '2026-01-01')).toBe(0);
  });

  it('refuses a photograph dated before the operation', () => {
    expect(postoperativeDay('2026-01-10', '2026-01-01')).toBeNull();
  });

  it('is not fooled by times of day', () => {
    expect(postoperativeDay('2026-01-01T23:00:00Z', '2026-01-02T01:00:00Z')).toBe(1);
  });
});

describe('fitTrajectory', () => {
  it('recovers a line laid down exactly', () => {
    // pct = 10 + 6*day, by construction.
    const pts = [0, 2, 4, 6].map((d) => ({ day: d, pct: 10 + 6 * d }));
    const f = fitTrajectory(pts);
    expect(f.ok).toBe(true);
    expect(f.slope).toBeCloseTo(6, 6);
    expect(f.intercept).toBeCloseTo(10, 6);
    expect(f.r2).toBeCloseTo(1, 6);
  });

  it('will not fit a trajectory to one day', () => {
    expect(fitTrajectory([{ day: 3, pct: 40 }]).ok).toBe(false);
    expect(fitTrajectory([{ day: 3, pct: 40 }, { day: 3, pct: 45 }]).ok).toBe(false);
  });

  it('reports no residual spread when the fit is exact by arithmetic', () => {
    // Two points always lie on their own line; claiming zero spread would read
    // as a perfectly certain prediction.
    const f = fitTrajectory([{ day: 2, pct: 20 }, { day: 6, pct: 60 }]);
    expect(f.df).toBe(0);
    expect(f.residualSe).toBeNull();
  });
});

describe('healingRate', () => {
  it('converts percentage-per-day into area-per-day against the baseline', () => {
    const pts = [{ day: 0, pct: 0 }, { day: 10, pct: 50 }];
    const r = healingRate(pts, 40);
    expect(r.pctPerDay).toBeCloseTo(5, 6);
    expect(r.cm2PerDay).toBeCloseTo(2, 6);   // 5% of 40 cm²
  });

  it('gives no area rate when there is no baseline to scale by', () => {
    const r = healingRate([{ day: 0, pct: 0 }, { day: 10, pct: 50 }], null as never);
    expect(r.cm2PerDay).toBeNull();
  });
});

describe('classifyTrend', () => {
  it('reads the brief\'s donor series as healing as expected', () => {
    // POD 4 22%, 7 49%, 10 73%, 14 94% — about 7 points a day.
    const pts = [{ day: 4, pct: 22 }, { day: 7, pct: 49 }, { day: 10, pct: 73 }, { day: 14, pct: 94 }];
    expect(classifyTrend(pts, { kind: 'donor' }).trend).toBe('accelerated');
  });

  it('calls a stalled donor site delayed', () => {
    const pts = [{ day: 4, pct: 30 }, { day: 8, pct: 31 }, { day: 12, pct: 32 }];
    expect(classifyTrend(pts, { kind: 'donor' }).trend).toBe('delayed');
  });

  it('calls a holding graft stable, not delayed', () => {
    // The brief's graft series: 96, 93, 90, 90 — a graft is expected to hold.
    const pts = [{ day: 3, pct: 96 }, { day: 5, pct: 93 }, { day: 7, pct: 90 }, { day: 14, pct: 90 }];
    expect(classifyTrend(pts, { kind: 'recipient' }).trend).toBe('stable');
  });

  it('calls a failing graft deteriorating', () => {
    const pts = [{ day: 3, pct: 95 }, { day: 5, pct: 80 }, { day: 7, pct: 60 }];
    expect(classifyTrend(pts, { kind: 'recipient' }).trend).toBe('deteriorating');
  });

  it('says uncertain rather than guessing from one photograph', () => {
    expect(classifyTrend([{ day: 3, pct: 90 }]).trend).toBe('uncertain');
  });

  it('says uncertain when the points do not follow a line', () => {
    const pts = [{ day: 1, pct: 10 }, { day: 2, pct: 80 }, { day: 3, pct: 20 }, { day: 4, pct: 70 }];
    expect(classifyTrend(pts, { kind: 'donor' }).trend).toBe('uncertain');
  });
});

describe('predictCompletion', () => {
  it('projects the brief\'s donor site to about POD 15', () => {
    // 22% at POD 4 rising to 73% at POD 10 reaches 100% in the mid-teens.
    const pts = [{ day: 4, pct: 22 }, { day: 7, pct: 49 }, { day: 10, pct: 73 }];
    const p = predictCompletion(pts);
    expect(p.ok).toBe(true);
    expect(p.predictedDay).toBeGreaterThanOrEqual(13);
    expect(p.predictedDay).toBeLessThanOrEqual(17);
    expect(p.predictedRange![0]).toBeLessThanOrEqual(p.predictedDay);
    expect(p.predictedRange![1]).toBeGreaterThanOrEqual(p.predictedDay);
  });

  it('never claims to be a validated model', () => {
    const p = predictCompletion([{ day: 2, pct: 20 }, { day: 4, pct: 40 }, { day: 6, pct: 60 }]);
    expect(p.method).toBe('linear-extrapolation');
    expect(p.isValidatedModel).toBe(false);
  });

  it('refuses to project a site that is not closing', () => {
    const p = predictCompletion([{ day: 4, pct: 30 }, { day: 8, pct: 30 }, { day: 12, pct: 29 }]);
    expect(p.ok).toBe(false);
    expect(p.reason).toMatch(/not currently closing/);
  });

  it('refuses a projection beyond the useful horizon', () => {
    // 0.1% a day would take a thousand days.
    const p = predictCompletion([{ day: 0, pct: 10 }, { day: 10, pct: 11 }]);
    expect(p.ok).toBe(false);
  });

  it('reports an already-closed site rather than projecting backwards', () => {
    const p = predictCompletion([{ day: 10, pct: 80 }, { day: 14, pct: 100 }]);
    expect(p.ok).toBe(true);
    expect(p.alreadyComplete).toBe(true);
  });

  it('offers no interval when two points make the fit exact', () => {
    const p = predictCompletion([{ day: 0, pct: 0 }, { day: 10, pct: 50 }]);
    expect(p.ok).toBe(true);
    expect(p.predictedRange).toBeNull();
    expect(p.intervalBasis).toMatch(/too few/);
  });

  it('widens the interval when the points are scattered', () => {
    const tight = predictCompletion([
      { day: 0, pct: 0 }, { day: 5, pct: 25 }, { day: 10, pct: 50 }, { day: 15, pct: 75 }]);
    const loose = predictCompletion([
      { day: 0, pct: 0 }, { day: 5, pct: 40 }, { day: 10, pct: 35 }, { day: 15, pct: 75 }]);
    const width = (p: any) => p.predictedRange[1] - p.predictedRange[0];
    expect(width(loose)).toBeGreaterThan(width(tight));
  });
});

describe('assessComparability', () => {
  const good = { scaleReliable: true, pixelsPerCm: 38, imageQualityScore: 0.9 };

  it('accepts the first photograph of a site', () => {
    expect(assessComparability(good, null).comparable).toBe(true);
  });

  it('refuses when either photograph lacks a reliable scale', () => {
    expect(assessComparability({ ...good, scaleReliable: false }, good).comparable).toBe(false);
    expect(assessComparability(good, { ...good, scaleReliable: false }).comparable).toBe(false);
  });

  it('refuses two photographs taken at very different distances', () => {
    const far = { ...good, pixelsPerCm: 12 };
    const r = assessComparability(good, far);
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/different distances/);
  });

  it('accepts a modest difference in distance', () => {
    expect(assessComparability(good, { ...good, pixelsPerCm: 30 }).comparable).toBe(true);
  });

  it('refuses a photograph too poor to compare', () => {
    expect(assessComparability({ ...good, imageQualityScore: 0.2 }, good).comparable).toBe(false);
  });
});

describe('deriveAlerts', () => {
  it('raises an urgent alert when a graft loses ground', () => {
    const a = deriveAlerts({
      siteRole: 'recipient',
      analysis: { closurePct: 70, day: 7 },
      previousAnalysis: { closurePct: 92, day: 5 },
    });
    const urgent = a.find((x: any) => x.code === 'closure_regression');
    expect(urgent).toBeDefined();
    expect(urgent.severity).toBe('urgent');
    expect(urgent.message).toMatch(/Clinical assessment recommended/);
  });

  it('stays quiet about a change within noise', () => {
    const a = deriveAlerts({
      siteRole: 'recipient',
      analysis: { closurePct: 91, day: 7 },
      previousAnalysis: { closurePct: 92, day: 5 },
    });
    expect(a.filter((x: any) => x.code.startsWith('closure_regression'))).toHaveLength(0);
  });

  it('raises breakdown beyond the baseline', () => {
    const a = deriveAlerts({
      siteRole: 'donor',
      analysis: { closurePct: 0, day: 9, exceededBaseline: true },
    });
    expect(a.some((x: any) => x.code === 'exceeds_baseline' && x.severity === 'urgent')).toBe(true);
  });

  it('phrases everything as an observation, never as a diagnosis', () => {
    const a = deriveAlerts({
      siteRole: 'donor',
      analysis: { closurePct: 20, day: 12, exceededBaseline: true },
      previousAnalysis: { closurePct: 40, day: 9 },
      trend: { trend: 'deteriorating', reason: 'Open area is increasing.' },
      quality: { blocking: true },
    });
    for (const alert of a) {
      expect(alert.message).not.toMatch(/\b(infected|infection is|is necrotic|has failed)\b/i);
    }
    expect(a.length).toBeGreaterThan(0);
  });

  it('reports an unusable photograph rather than measuring it', () => {
    const a = deriveAlerts({ siteRole: 'donor', quality: { blocking: true } });
    expect(a.some((x: any) => x.code === 'image_quality')).toBe(true);
  });
});

describe('overdueFollowUp', () => {
  it('is quiet inside the expected interval', () => {
    expect(overdueFollowUp('2026-01-01', '2026-01-06', 7)).toBeNull();
  });

  it('warns when a photograph is long overdue', () => {
    const o = overdueFollowUp('2026-01-01', '2026-01-20', 7);
    expect(o).not.toBeNull();
    expect(o!.severity).toBe('warning');
    expect(o!.days).toBe(19);
  });
});
