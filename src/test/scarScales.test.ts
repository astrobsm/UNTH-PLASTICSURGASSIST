/**
 * The validated scales, and the colour maths.
 *
 * The scales are checked against their published item counts, ranges and
 * totals — the properties that make a score comparable with anybody else's.
 * The colour maths is checked against CIELAB values that are known
 * independently of this code.
 */

import { describe, it, expect } from 'vitest';
import {
  SCALES, VSS_ITEMS, POSAS_OBSERVER_ITEMS, POSAS_PATIENT_ITEMS, DKS_ITEMS,
  VSS_MAX, DKS_MAX, scoreScale, scaleRequirements, scoreChange,
// Plain ES module, shared with the serverless functions.
} from '../../api/_lib/scarScales.js';
import {
  rgbToLab, deltaE76, sampleRegion, analyseScarColour, describeColour,
  JND_DELTA_E, MIN_SAMPLE_PIXELS,
} from '../services/scarColourAnalysis';

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------

describe('scale definitions', () => {
  it('VSS has its four items and a maximum of 14', () => {
    expect(VSS_ITEMS.map((i: { key: string }) => i.key))
      .toEqual(['vascularity', 'pigmentation', 'pliability', 'height']);
    // 3 + 3 + 5 + 3
    expect(VSS_MAX).toBe(14);
  });

  it('keeps pliability an examination item', () => {
    // Photography cannot palpate. The brief is explicit about this.
    const pliability = VSS_ITEMS.find((i: { key: string }) => i.key === 'pliability')!;
    expect(pliability.source).toBe('exam');
    expect(pliability.max).toBe(5);
  });

  it('POSAS has six observer and six patient items, each 1 to 10', () => {
    expect(POSAS_OBSERVER_ITEMS).toHaveLength(6);
    expect(POSAS_PATIENT_ITEMS).toHaveLength(6);
    for (const i of [...POSAS_OBSERVER_ITEMS, ...POSAS_PATIENT_ITEMS]) {
      expect(i.min).toBe(1);
      expect(i.max).toBe(10);
    }
  });

  it('routes POSAS items to the right person rather than calling it photographic', () => {
    const src = Object.fromEntries(
      POSAS_OBSERVER_ITEMS.map((i: { key: string; source: string }) => [i.key, i.source]));
    expect(src.pliability).toBe('exam');
    expect(src.thickness).toBe('exam');
    expect(src.vascularity).toBe('image');
    for (const i of POSAS_PATIENT_ITEMS) expect(i.source).toBe('patient');
  });

  it('DKS has four domains and a maximum of 12', () => {
    expect(DKS_ITEMS).toHaveLength(4);
    expect(DKS_MAX).toBe(12);
  });

  it('every item has one anchor per scorable point, or a pair for a 1-10 scale', () => {
    for (const scale of Object.values(SCALES) as { items: { min: number; max: number; anchors: string[] }[] }[]) {
      for (const i of scale.items) {
        const points = i.max - i.min + 1;
        expect(i.anchors.length === points || i.anchors.length === 2).toBe(true);
      }
    }
  });

  it('keeps the four scales separate', () => {
    expect(Object.keys(SCALES).sort())
      .toEqual(['dks', 'posas_observer', 'posas_patient', 'vss']);
  });
});

describe('scoreScale', () => {
  const fullVss = { vascularity: 2, pigmentation: 1, pliability: 3, height: 2 };

  it('totals a complete VSS', () => {
    const r = scoreScale('vss', fullVss);
    expect(r.ok).toBe(true);
    expect(r.total).toBe(8);
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('refuses to total a partly-answered scale', () => {
    // A VSS of 6 from three items is not a VSS of 6, and must not be compared
    // with one.
    const r = scoreScale('vss', { vascularity: 2, pigmentation: 1, height: 3 });
    expect(r.ok).toBe(true);
    expect(r.total).toBeNull();
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(['pliability']);
    // The running sum is still available, clearly labelled as partial.
    expect(r.partialTotal).toBe(6);
  });

  it('rejects a value outside an item range', () => {
    expect(scoreScale('vss', { ...fullVss, vascularity: 9 }).ok).toBe(false);
    expect(scoreScale('vss', { ...fullVss, pliability: -1 }).ok).toBe(false);
  });

  it('accepts the extremes of every item', () => {
    const min = Object.fromEntries(VSS_ITEMS.map((i: { key: string; min: number }) => [i.key, i.min]));
    const max = Object.fromEntries(VSS_ITEMS.map((i: { key: string; max: number }) => [i.key, i.max]));
    expect(scoreScale('vss', min).total).toBe(0);
    expect(scoreScale('vss', max).total).toBe(VSS_MAX);
  });

  it('totals POSAS to its 6-60 range', () => {
    const all = (v: number) => Object.fromEntries(
      POSAS_OBSERVER_ITEMS.map((i: { key: string }) => [i.key, v]));
    expect(scoreScale('posas_observer', all(1)).total).toBe(6);
    expect(scoreScale('posas_observer', all(10)).total).toBe(60);
  });

  it('keeps the POSAS overall opinion out of the total', () => {
    const answers = Object.fromEntries(
      POSAS_OBSERVER_ITEMS.map((i: { key: string }) => [i.key, 5]));
    const r = scoreScale('posas_observer', { ...answers, overall: 9 });
    expect(r.total).toBe(30);        // 6 x 5, not 39
    expect(r.overall).toBe(9);
  });

  it('rejects an out-of-range overall opinion', () => {
    const answers = Object.fromEntries(
      POSAS_OBSERVER_ITEMS.map((i: { key: string }) => [i.key, 5]));
    expect(scoreScale('posas_observer', { ...answers, overall: 11 }).ok).toBe(false);
  });

  it('rejects an unknown scale rather than inventing one', () => {
    expect(scoreScale('made_up_scale', {}).ok).toBe(false);
  });

  it('treats empty string and null as unanswered, not zero', () => {
    // Zero is a real VSS answer meaning "normal"; absence is not.
    const r = scoreScale('vss', { vascularity: '', pigmentation: null, pliability: 0, height: 0 });
    expect(r.complete).toBe(false);
    expect(r.missing).toContain('vascularity');
    expect(r.missing).toContain('pigmentation');
  });
});

describe('scaleRequirements', () => {
  it('says who has to supply each part', () => {
    const r = scaleRequirements('vss')!;
    expect(r.bySource.exam).toContain('Pliability');
    expect(r.bySource.image.length).toBeGreaterThan(0);
  });

  it('shows POSAS patient items are entirely patient-reported', () => {
    const r = scaleRequirements('posas_patient')!;
    expect(r.bySource.patient).toHaveLength(6);
    expect(r.bySource.image).toHaveLength(0);
  });
});

describe('scoreChange', () => {
  it('reads a falling score as improvement on a worse-is-higher scale', () => {
    const c = scoreChange('vss', 10, 6)!;
    expect(c.delta).toBe(-4);
    expect(c.direction).toBe('improved');
  });

  it('reads a rising score as worsening', () => {
    expect(scoreChange('dks', 4, 9)!.direction).toBe('worsened');
  });

  it('reports change as a proportion of the usable range', () => {
    // 3 points of DKS (range 12) is a quarter; 3 of POSAS (range 54) is not.
    expect(scoreChange('dks', 6, 9)!.proportionOfRange).toBeCloseTo(25, 1);
    expect(scoreChange('posas_observer', 20, 23)!.proportionOfRange).toBeCloseTo(5.6, 1);
  });

  it('refuses to compare when either score is incomplete', () => {
    expect(scoreChange('vss', null as never, 6)!.ok).toBe(false);
  });

  it('calls an unchanged score unchanged', () => {
    expect(scoreChange('vss', 7, 7)!.direction).toBe('unchanged');
  });
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

describe('rgbToLab', () => {
  it('maps pure white to L*100, a*0, b*0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.L).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('maps black to L*0', () => {
    expect(rgbToLab({ r: 0, g: 0, b: 0 }).L).toBeCloseTo(0, 2);
  });

  it('matches published CIELAB for sRGB red', () => {
    // sRGB #FF0000 under D65 is about L 53.24, a 80.09, b 67.20.
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(53.24, 1);
    expect(lab.a).toBeCloseTo(80.09, 1);
    expect(lab.b).toBeCloseTo(67.20, 1);
  });

  it('matches published CIELAB for sRGB blue', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 255 });
    expect(lab.L).toBeCloseTo(32.30, 1);
    expect(lab.b).toBeCloseTo(-107.86, 1);
  });

  it('puts mid grey on the neutral axis', () => {
    const lab = rgbToLab({ r: 128, g: 128, b: 128 });
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });
});

describe('deltaE76', () => {
  it('is zero for identical colours', () => {
    const lab = rgbToLab({ r: 120, g: 90, b: 80 });
    expect(deltaE76(lab, lab)).toBe(0);
  });

  it('is symmetric', () => {
    const p = rgbToLab({ r: 200, g: 150, b: 140 });
    const q = rgbToLab({ r: 160, g: 120, b: 110 });
    expect(deltaE76(p, q)).toBeCloseTo(deltaE76(q, p), 9);
  });
});

/** Builds an RGBA buffer of n pixels, all the same colour. */
const solid = (n: number, r: number, g: number, b: number) => {
  const d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
  }
  return d;
};

describe('sampleRegion', () => {
  it('returns the exact colour of a uniform region', () => {
    const s = sampleRegion(solid(100, 180, 120, 110), Uint8Array.from({ length: 100 }, () => 1))!;
    expect(s.pixels).toBe(100);
    expect(s.sd.L).toBeCloseTo(0, 6);
    expect(s.mean.L).toBeCloseTo(rgbToLab({ r: 180, g: 120, b: 110 }).L, 6);
  });

  it('counts only the masked pixels', () => {
    const mask = Uint8Array.from({ length: 100 }, (_, i) => (i < 30 ? 1 : 0));
    expect(sampleRegion(solid(100, 10, 20, 30), mask)!.pixels).toBe(30);
  });

  it('skips fully transparent pixels', () => {
    const d = solid(10, 200, 100, 100);
    for (let i = 0; i < 5; i++) d[i * 4 + 3] = 0;
    expect(sampleRegion(d, Uint8Array.from({ length: 10 }, () => 1))!.pixels).toBe(5);
  });

  it('returns null when the mask selects nothing', () => {
    expect(sampleRegion(solid(10, 1, 2, 3), new Uint8Array(10))).toBeNull();
  });
});

describe('analyseScarColour', () => {
  const N = 1000;
  const half = (first: boolean) =>
    Uint8Array.from({ length: N * 2 }, (_, i) => ((i < N) === first ? 1 : 0));

  /** Two regions in one buffer: pixels 0..N-1 scar, N..2N-1 reference. */
  const twoRegions = (scar: [number, number, number], ref: [number, number, number]) => {
    const d = new Uint8ClampedArray(N * 2 * 4);
    for (let i = 0; i < N * 2; i++) {
      const c = i < N ? scar : ref;
      d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255;
    }
    return d;
  };

  it('reports no meaningful difference when scar matches surrounding skin', () => {
    const d = twoRegions([150, 110, 95], [150, 110, 95]);
    const r = analyseScarColour(d, half(true), half(false))!;
    expect(r.deltaE).toBeCloseTo(0, 5);
    expect(r.pigmentation).toBe('comparable');
    expect(describeColour(r)[0]).toMatch(/within the just-noticeable difference/);
  });

  it('detects a redder scar as erythema, not as pigmentation', () => {
    // Same lightness family, markedly more red.
    const r = analyseScarColour(twoRegions([190, 100, 95], [150, 110, 95]), half(true), half(false))!;
    expect(r.erythemaIndex).toBeGreaterThan(3);
    expect(r.deltaE).toBeGreaterThan(JND_DELTA_E);
    expect(describeColour(r).join(' ')).toMatch(/erythema index/);
  });

  it('calls a darker scar hyperpigmented', () => {
    const r = analyseScarColour(twoRegions([70, 50, 45], [150, 110, 95]), half(true), half(false))!;
    expect(r.pigmentation).toBe('hyperpigmented');
    expect(r.lightnessDelta).toBeLessThan(0);
  });

  it('calls a lighter scar hypopigmented', () => {
    const r = analyseScarColour(twoRegions([210, 185, 175], [150, 110, 95]), half(true), half(false))!;
    expect(r.pigmentation).toBe('hypopigmented');
    expect(r.lightnessDelta).toBeGreaterThan(0);
  });

  it('is referenced to the patient, so the same scar-to-skin step reads alike on dark and light skin', () => {
    // The point of §61. Two patients, very different absolute skin colour,
    // the scar equally redder than their own skin in each.
    const light = analyseScarColour(twoRegions([215, 160, 150], [195, 170, 155]), half(true), half(false))!;
    const dark = analyseScarColour(twoRegions([110, 62, 55], [90, 72, 60]), half(true), half(false))!;
    // Both flagged as redder; neither patient's normal skin read as disease.
    expect(light.erythemaIndex).toBeGreaterThan(3);
    expect(dark.erythemaIndex).toBeGreaterThan(3);
    expect(light.pigmentation).toBe('comparable');
    expect(dark.pigmentation).toBe('comparable');
  });

  it('flags too small a sample rather than reporting a noisy mean', () => {
    const n = 10;
    const d = new Uint8ClampedArray(n * 2 * 4).fill(200);
    const m1 = Uint8Array.from({ length: n * 2 }, (_, i) => (i < n ? 1 : 0));
    const m2 = Uint8Array.from({ length: n * 2 }, (_, i) => (i >= n ? 1 : 0));
    const r = analyseScarColour(d, m1, m2)!;
    expect(r.reliability).toBe('insufficient');
    expect(describeColour(r)[0]).toMatch(/too small/i);
  });

  it('warns when the sample is usable but thin', () => {
    const n = Math.floor(MIN_SAMPLE_PIXELS / 2);
    const d = new Uint8ClampedArray(n * 2 * 4).fill(180);
    for (let i = 0; i < n * 2; i++) d[i * 4 + 3] = 255;
    const m1 = Uint8Array.from({ length: n * 2 }, (_, i) => (i < n ? 1 : 0));
    const m2 = Uint8Array.from({ length: n * 2 }, (_, i) => (i >= n ? 1 : 0));
    expect(analyseScarColour(d, m1, m2)!.reliability).toBe('limited');
  });

  it('returns null when either region was never traced', () => {
    const d = twoRegions([1, 2, 3], [4, 5, 6]);
    expect(analyseScarColour(d, new Uint8Array(N * 2), half(false))).toBeNull();
  });

  it('never describes a sub-threshold difference as a finding', () => {
    const r = analyseScarColour(twoRegions([151, 111, 96], [150, 110, 95]), half(true), half(false))!;
    const text = describeColour(r).join(' ');
    expect(text).not.toMatch(/erythema index/);
    expect(text).toMatch(/just-noticeable/);
  });
});
