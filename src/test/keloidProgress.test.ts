/**
 * Keloid progress, and the ways it must differ from wound healing.
 *
 * The first group is the point of the whole file: a keloid is never described
 * with healing language, never given a closure date, and never reported as
 * "0% area reduction" when what is meant is "growing".
 */

import { describe, it, expect } from 'vitest';
import {
  growthProfile, growthAcceleration, activityAssessment, keloidStatus,
  treatmentResponse, KELOID_THRESHOLDS,
// Plain ES module, shared with the serverless functions.
} from '../../api/_lib/keloidProgress.js';

const at = (pairs: [number, number][]) => pairs.map(([day, value]) => ({ day, value }));

describe('keloid semantics differ from wound healing', () => {
  const growing = at([[0, 4], [30, 4.6], [60, 5.4], [90, 6.3]]);

  it('describes a keloid as growing, never as failing to heal', () => {
    const g = growthProfile(growing);
    expect(g.direction).toBe('growing');
    // Growth is per month; cm²/week is noise at a keloid's timescale.
    expect(g.perMonthCm2).toBeGreaterThan(0);
    expect(Object.keys(g)).not.toContain('healingVelocity');
    expect(Object.keys(g)).not.toContain('projectedClosure');
  });

  it('never produces a closure date or a healing verdict', () => {
    const s = keloidStatus({ growth: growthProfile(growing), activity: activityAssessment({}) });
    expect(JSON.stringify(s)).not.toMatch(/closure|closed|heal(ed|ing)?\b/i);
    expect(['progressive', 'regressing', 'stable', 'stable_active', 'quiescent',
            'possible_recurrence', 'insufficient']).toContain(s.status);
  });

  it('reports growth as a fraction of current size, not just absolute', () => {
    // 0.4 cm²/month means something different on a 2 cm² earlobe than on a
    // 40 cm² chest plaque.
    const small = growthProfile(at([[0, 2], [60, 2.8]]));
    const large = growthProfile(at([[0, 40], [60, 40.8]]));
    expect(small.perMonthCm2).toBeCloseTo(large.perMonthCm2, 1);
    expect(small.fractionPerMonth).toBeGreaterThan(large.fractionPerMonth * 5);
  });
});

describe('growthProfile', () => {
  it('calls a shrinking keloid regressing', () => {
    expect(growthProfile(at([[0, 10], [30, 8.5], [60, 7]])).direction).toBe('regressing');
  });

  it('calls a steady keloid static rather than stable-and-fine', () => {
    const g = growthProfile(at([[0, 6], [60, 6.05]]));
    expect(g.direction).toBe('static');
  });

  it('refuses with a single measurement', () => {
    expect(growthProfile(at([[0, 5]])).ok).toBe(false);
  });

  it('ignores a zero or negative area rather than dividing by it', () => {
    const g = growthProfile([{ day: 0, value: 0 }, { day: 30, value: 4 }, { day: 60, value: 5 }]);
    expect(g.ok).toBe(true);
    expect(Number.isFinite(g.fractionPerMonth)).toBe(true);
  });

  it('reports the total change alongside the rate', () => {
    const g = growthProfile(at([[0, 4], [90, 6.3]]));
    expect(g.totalChangeCm2).toBeCloseTo(2.3, 2);
    expect(g.totalChangePct).toBeCloseTo(57.5, 1);
  });
});

describe('growthAcceleration', () => {
  it('detects a keloid whose growth is speeding up', () => {
    const a = growthAcceleration(at([[0, 4], [30, 4.3], [60, 5.0], [90, 6.4]]));
    expect(a.ok).toBe(true);
    expect(a.accelerating).toBe(true);
    expect(a.meaningful).toBe(true);
  });

  it('needs four measurements', () => {
    expect(growthAcceleration(at([[0, 4], [30, 5], [60, 6]])).ok).toBe(false);
  });
});

describe('activityAssessment', () => {
  it('calls a red, itchy, firm keloid active', () => {
    const a = activityAssessment({ erythemaIndex: 8, pain: 5, itch: 6, pliability: 'firm' });
    expect(a.status).toBe('active');
    expect(a.summary).toMatch(/erythema/);
  });

  it('calls a pale, asymptomatic, supple keloid quiescent', () => {
    const a = activityAssessment({ erythemaIndex: 1, pain: 0, itch: 0, pliability: 'supple' });
    expect(a.status).toBe('quiescent');
  });

  it('distinguishes "not active" from "not assessed"', () => {
    // The distinction that matters: an unrecorded keloid is not a quiet one.
    const a = activityAssessment({});
    expect(a.status).toBe('not_assessed');
    expect(a.summary).toMatch(/has not been assessed/);
    expect(a.absent.length).toBeGreaterThan(0);
  });

  it('reports partial activity when only some signals are raised', () => {
    const a = activityAssessment({ erythemaIndex: 8, pain: 0, itch: 0, pliability: 'supple' });
    expect(a.status).toBe('partially_active');
  });

  it('names which signals were missing', () => {
    const a = activityAssessment({ erythemaIndex: 6 });
    expect(a.absent).toContain('pain');
    expect(a.absent).toContain('firmness');
  });
});

describe('keloidStatus', () => {
  const growing = growthProfile(at([[0, 4], [30, 4.6], [60, 5.4], [90, 6.3]]));
  const shrinking = growthProfile(at([[0, 10], [60, 7]]));
  const flat = growthProfile(at([[0, 6], [60, 6.05]]));

  it('calls a growing keloid progressive', () => {
    expect(keloidStatus({ growth: growing, activity: activityAssessment({}) }).status)
      .toBe('progressive');
  });

  it('calls a shrinking keloid regressing', () => {
    expect(keloidStatus({ growth: shrinking, activity: activityAssessment({}) }).status)
      .toBe('regressing');
  });

  it('separates stable-but-active from quiescent', () => {
    const active = keloidStatus({
      growth: flat,
      activity: activityAssessment({ erythemaIndex: 8, pain: 5, itch: 6, pliability: 'firm' }),
    });
    expect(active.status).toBe('stable_active');
    expect(active.summary).toMatch(/responds to intralesional/);

    const quiet = keloidStatus({
      growth: flat,
      activity: activityAssessment({ erythemaIndex: 1, pain: 0, itch: 0, pliability: 'supple' }),
    });
    expect(quiet.status).toBe('quiescent');
  });

  it('will not claim maturity when activity was never assessed', () => {
    const s = keloidStatus({ growth: flat, activity: activityAssessment({}) });
    expect(s.status).toBe('stable');
    expect(s.summary).toMatch(/cannot be confirmed/);
  });

  it('calls post-excision growth a possible recurrence, not merely progression', () => {
    const s = keloidStatus({
      growth: growing, activity: activityAssessment({}),
      excisionDayOffset: 10, currentDay: 90,
    });
    expect(s.status).toBe('possible_recurrence');
    expect(s.summary).toMatch(/compatible with recurrence/);
    expect(s.summary).toMatch(/clinical assessment recommended/i);
  });

  it('does not call growth long after excision a recurrence', () => {
    const s = keloidStatus({
      growth: growing, activity: activityAssessment({}),
      excisionDayOffset: 0,
      currentDay: (KELOID_THRESHOLDS.recurrenceWindowMonths + 6) * 30.44,
    });
    expect(s.status).toBe('progressive');
  });

  it('says so when there is not enough data', () => {
    const s = keloidStatus({ growth: growthProfile(at([[0, 4]])), activity: activityAssessment({}) });
    expect(s.status).toBe('insufficient');
  });
});

describe('treatmentResponse', () => {
  // 8.2 cm² before the first injection, 4.1 after three of them.
  const series = at([[0, 8.2], [30, 7.1], [60, 5.4], [90, 4.1]]);

  it('measures the change across the treatment interval', () => {
    const r = treatmentResponse(series, [0, 21, 42]);
    expect(r.ok).toBe(true);
    expect(r.changePct).toBeCloseTo(-50, 1);
    expect(r.response).toBe('marked_reduction');
    expect(r.injectionsInInterval).toBe(3);
  });

  it('refuses to claim causation', () => {
    const r = treatmentResponse(series, [0, 21, 42]);
    expect(r.caveat).toMatch(/rather than what caused it/);
  });

  it('flags enlargement despite treatment', () => {
    const r = treatmentResponse(at([[0, 5], [90, 7]]), [10, 40]);
    expect(r.response).toBe('enlargement_despite_treatment');
  });

  it('calls a small move no significant change', () => {
    expect(treatmentResponse(at([[0, 5], [90, 5.2]]), [10]).response).toBe('no_significant_change');
  });

  it('needs a measurement after treatment started', () => {
    const r = treatmentResponse(at([[0, 5], [10, 5.1]]), [50]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/since treatment began/);
  });

  it('refuses when no treatment is recorded', () => {
    expect(treatmentResponse(series, []).ok).toBe(false);
  });
});
