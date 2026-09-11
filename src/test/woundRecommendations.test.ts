/**
 * The recommendation rules.
 *
 * Two kinds of test: that the right advice fires on the right measurements,
 * and — more important for a clinical tool — that it never oversteps. Nothing
 * here may diagnose, prescribe a drug or a dose, or declare a graft lost.
 */

import { describe, it, expect } from 'vitest';
import {
  recommendationsFor, GENERAL_HEALING_MEASURES, RECOMMENDATION_THRESHOLDS,
// Plain ES module, shared with the serverless functions.
} from '../../api/_lib/woundRecommendations.js';

type Rec = { priority: string; code: string; text: string; basis: string };
const codes = (r: Rec[]) => r.map((x) => x.code);

describe('urgent findings', () => {
  it('raises breakdown beyond the baseline', () => {
    const r = recommendationsFor({ siteRole: 'donor', exceededBaseline: true });
    const rec = r.find((x: Rec) => x.code === 'breakdown_beyond_baseline')!;
    expect(rec.priority).toBe('urgent');
    expect(rec.text).toMatch(/Clinical assessment is recommended/);
  });

  it('raises a deteriorating trend and repeats the reason', () => {
    const r = recommendationsFor({
      siteRole: 'recipient',
      trend: { trend: 'deteriorating', reason: 'Losing about 5% of take a day.' },
    });
    const rec = r.find((x: Rec) => x.code === 'deteriorating')!;
    expect(rec.priority).toBe('urgent');
    expect(rec.basis).toMatch(/5%/);
  });

  it('raises necrotic tissue once it passes the threshold', () => {
    const below = recommendationsFor({ composition: { necrotic: 5 } });
    const above = recommendationsFor({ composition: { necrotic: 25 } });
    expect(codes(below)).not.toContain('necrotic_tissue');
    expect(codes(above)).toContain('necrotic_tissue');
  });

  it('puts urgent advice first', () => {
    const r = recommendationsFor({
      siteRole: 'donor', exceededBaseline: true,
      daysSinceLastPhotograph: 20, postoperativeDay: 3,
    });
    expect(r[0].priority).toBe('urgent');
  });
});

describe('wound bed', () => {
  it('advises on slough only once it is a real burden', () => {
    expect(codes(recommendationsFor({ composition: { slough: 10 } }))).not.toContain('slough_burden');
    const r = recommendationsFor({ composition: { slough: 35 } });
    expect(codes(r)).toContain('slough_burden');
    expect(r.find((x: Rec) => x.code === 'slough_burden')!.text)
      .toMatch(/Epithelium does not advance across slough/);
  });

  it('says so when the bed is healthy, rather than only ever warning', () => {
    const r = recommendationsFor({ composition: { granulation: 85, slough: 5, necrotic: 0 } });
    expect(codes(r)).toContain('healthy_bed');
  });

  it('does not call a bed healthy while it is loaded with slough', () => {
    const r = recommendationsFor({ composition: { granulation: 65, slough: 30, necrotic: 0 } });
    expect(codes(r)).not.toContain('healthy_bed');
    expect(codes(r)).toContain('slough_burden');
  });
});

describe('trajectory', () => {
  it('flags a stalled donor site', () => {
    const r = recommendationsFor({
      siteRole: 'donor', closurePct: 40,
      rate: { ok: true, pctPerDay: 0.3, basis: '4 photographs, POD 5–19' },
    });
    expect(codes(r)).toContain('stalled_donor');
    expect(r.find((x: Rec) => x.code === 'stalled_donor')!.basis).toMatch(/POD 5–19/);
  });

  it('does not call a nearly-healed donor site stalled', () => {
    // Slowing down at 95% is what closing looks like, not a problem.
    const r = recommendationsFor({
      siteRole: 'donor', closurePct: 95, rate: { ok: true, pctPerDay: 0.4 },
    });
    expect(codes(r)).not.toContain('stalled_donor');
  });

  it('flags a donor site still open well past the expected day', () => {
    const r = recommendationsFor({
      siteRole: 'donor', postoperativeDay: 30, closurePct: 60,
    });
    expect(codes(r)).toContain('donor_overdue');
  });

  it('does not flag a donor site that is simply young', () => {
    const r = recommendationsFor({ siteRole: 'donor', postoperativeDay: 7, closurePct: 45 });
    expect(codes(r)).not.toContain('donor_overdue');
  });

  it('flags poor take, and names the four things that lift a graft', () => {
    const r = recommendationsFor({
      siteRole: 'recipient', postoperativeDay: 7, closurePct: 55,
    });
    const rec = r.find((x: Rec) => x.code === 'poor_take')!;
    expect(rec.text).toMatch(/haematoma/i);
    expect(rec.text).toMatch(/shear/i);
  });

  it('does not judge take before the first dressing', () => {
    const r = recommendationsFor({ siteRole: 'recipient', postoperativeDay: 2, closurePct: 55 });
    expect(codes(r)).not.toContain('poor_take');
    // It gives early graft care instead.
    expect(codes(r)).toContain('early_graft_care');
  });

  it('asks about systemic factors it cannot measure, and says so', () => {
    const r = recommendationsFor({
      siteRole: 'donor', closurePct: 40, trend: { trend: 'delayed', reason: 'slow' },
    });
    const rec = r.find((x: Rec) => x.code === 'systemic_review')!;
    expect(rec.text).toMatch(/This app measures none of these/);
  });
});

describe('photography and measurement quality', () => {
  it('notes an overdue photograph', () => {
    const r = recommendationsFor({ daysSinceLastPhotograph: 14 });
    expect(codes(r)).toContain('overdue_photograph');
  });

  it('is quiet inside the expected interval', () => {
    const r = recommendationsFor({ daysSinceLastPhotograph: 4 });
    expect(codes(r)).not.toContain('overdue_photograph');
  });

  it('prefers the calibration problem over the quality one', () => {
    // Both are true, but an uncalibrated photograph cannot be measured at all.
    const r = recommendationsFor({ scaleReliable: false, imageQualityScore: 0.3 });
    expect(codes(r)).toContain('no_calibration');
    expect(codes(r)).not.toContain('image_quality');
  });

  it('mentions quality when the scale was fine', () => {
    const r = recommendationsFor({ scaleReliable: true, imageQualityScore: 0.4 });
    expect(codes(r)).toContain('image_quality');
  });
});

describe('projection', () => {
  it('reports the projected date and refuses to dress it up', () => {
    const r = recommendationsFor({
      siteRole: 'donor',
      prediction: {
        ok: true, predictedDay: 16, predictedRange: [14, 18],
        basis: '4 photographs, POD 4–14',
      },
    });
    const rec = r.find((x: Rec) => x.code === 'projection')!;
    expect(rec.text).toMatch(/about day 16/);
    expect(rec.text).toMatch(/14–18/);
    expect(rec.text).toMatch(/not a validated prediction/);
  });

  it('says nothing when no projection was possible', () => {
    expect(codes(recommendationsFor({ prediction: { ok: false, reason: 'not closing' } })))
      .not.toContain('projection');
  });

  it('says nothing about a site already closed', () => {
    const r = recommendationsFor({ prediction: { ok: true, alreadyComplete: true, predictedDay: 3 } });
    expect(codes(r)).not.toContain('projection');
  });
});

describe('clinical safety', () => {
  // Every combination that produces advice, checked against the things a
  // decision-support tool must not do.
  const scenarios = [
    { siteRole: 'donor', exceededBaseline: true, composition: { necrotic: 40, slough: 40 } },
    { siteRole: 'recipient', postoperativeDay: 10, closurePct: 30,
      trend: { trend: 'deteriorating', reason: 'x' }, rate: { ok: true, pctPerDay: -2 } },
    { siteRole: 'donor', postoperativeDay: 40, closurePct: 20,
      rate: { ok: true, pctPerDay: 0.1 }, scaleReliable: false, daysSinceLastPhotograph: 30 },
    { siteRole: 'donor', composition: { granulation: 90, slough: 2, necrotic: 0 },
      prediction: { ok: true, predictedDay: 12, predictedRange: [10, 14] } },
  ];

  it('never prescribes a drug or a dose', () => {
    for (const s of scenarios) {
      for (const rec of recommendationsFor(s) as Rec[]) {
        expect(rec.text).not.toMatch(/\b\d+\s?(mg|g|ml|mcg|units)\b/i);
        expect(rec.text).not.toMatch(/\b(prescribe|commence|start)\s+(antibiotic|flucloxacillin|amoxicillin|metronidazole)/i);
      }
    }
  });

  it('never states a diagnosis as fact', () => {
    for (const s of scenarios) {
      for (const rec of recommendationsFor(s) as Rec[]) {
        expect(rec.text).not.toMatch(/\b(is infected|has osteomyelitis|the graft has failed|is necrotic tissue caused by)\b/i);
      }
    }
  });

  it('never declares a graft lost or orders a procedure outright', () => {
    for (const s of scenarios) {
      for (const rec of recommendationsFor(s) as Rec[]) {
        expect(rec.text).not.toMatch(/\b(graft is lost|must be regrafted|debride immediately|take to theatre)\b/i);
      }
    }
  });

  it('always carries the measurement behind the advice', () => {
    for (const s of scenarios) {
      for (const rec of recommendationsFor(s) as Rec[]) {
        expect(rec.basis).toBeTruthy();
        expect(rec.basis.length).toBeGreaterThan(5);
      }
    }
  });

  it('gives nothing at all when nothing was measured', () => {
    // No photograph, no composition, no trend: silence, not generic advice
    // dressed as a finding.
    expect(recommendationsFor({})).toEqual([]);
  });
});

describe('general measures', () => {
  it('covers the systemic determinants of healing', () => {
    const areas = GENERAL_HEALING_MEASURES.map((m: { area: string }) => m.area);
    for (const a of ['Nutrition', 'Glycaemic control', 'Perfusion', 'Pressure and shear',
                     'Moisture balance', 'Infection', 'Smoking']) {
      expect(areas).toContain(a);
    }
  });

  it('has a thresholds table that can be reviewed in one place', () => {
    expect(RECOMMENDATION_THRESHOLDS.sloughPct).toBeGreaterThan(0);
    expect(RECOMMENDATION_THRESHOLDS.donorExpectedHealedByPod).toBeGreaterThan(7);
  });
});
