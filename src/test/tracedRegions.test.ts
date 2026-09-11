/**
 * Traced-area arithmetic, against shapes whose area is known from geometry.
 */

import { describe, it, expect } from 'vitest';
import {
  polygonAreaPx, polygonPerimeterPx, pxAreaToCm2, calibrationFromLine,
  pointInPolygon, measureTrace, validateTrace, centroid, simplify,
  measureLayeredTrace, validateLayeredTrace,
  type TracedRegion,
} from '../services/tracedRegions';

const rect = (x: number, y: number, w: number, h: number, id = 'r'): TracedRegion => ({
  id,
  points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
});

/** A regular n-gon, whose area is known in closed form. */
const ngon = (cx: number, cy: number, r: number, n: number): { x: number; y: number }[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (2 * Math.PI * i) / n;
    return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) };
  });

describe('polygonAreaPx', () => {
  it('measures a rectangle by its sides', () => {
    expect(polygonAreaPx(rect(0, 0, 40, 25).points)).toBeCloseTo(1000, 6);
  });

  it('is unsigned, so winding direction does not make a negative area', () => {
    const cw = rect(0, 0, 40, 25).points.slice().reverse();
    expect(polygonAreaPx(cw)).toBeCloseTo(1000, 6);
  });

  it('matches the closed form for a regular polygon', () => {
    // (1/2) n r² sin(2π/n)
    const n = 24; const r = 50;
    const expected = 0.5 * n * r * r * Math.sin((2 * Math.PI) / n);
    expect(polygonAreaPx(ngon(0, 0, r, n))).toBeCloseTo(expected, 6);
  });

  it('is zero for anything that is not a polygon', () => {
    expect(polygonAreaPx([])).toBe(0);
    expect(polygonAreaPx([{ x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(0);
  });
});

describe('polygonPerimeterPx', () => {
  it('sums the closed boundary, including the closing edge', () => {
    expect(polygonPerimeterPx(rect(0, 0, 40, 25).points)).toBeCloseTo(130, 6);
  });
});

describe('pxAreaToCm2', () => {
  it('scales area by the SQUARE of the linear scale', () => {
    // 400 px² at 20 px/cm is 1 cm², not 20.
    expect(pxAreaToCm2(400, 20)).toBeCloseTo(1, 6);
    expect(pxAreaToCm2(1600, 20)).toBeCloseTo(4, 6);
  });

  it('refuses a nonsensical scale rather than dividing by zero', () => {
    expect(pxAreaToCm2(400, 0)).toBe(0);
    expect(pxAreaToCm2(400, -3)).toBe(0);
  });
});

describe('calibrationFromLine', () => {
  it('turns a line drawn along a 5 cm marker into pixels per cm', () => {
    expect(calibrationFromLine({ x: 0, y: 0 }, { x: 191, y: 0 }, 5)).toBeCloseTo(38.2, 6);
  });

  it('measures the line diagonally as well as squarely', () => {
    // 3-4-5 triangle: 5 px across a 1 cm marker.
    expect(calibrationFromLine({ x: 0, y: 0 }, { x: 3, y: 4 }, 1)).toBeCloseTo(5, 6);
  });

  it('refuses a zero-length drag or an absurd known length', () => {
    expect(calibrationFromLine({ x: 4, y: 4 }, { x: 4, y: 4 }, 5)).toBeNull();
    expect(calibrationFromLine({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toBeNull();
  });
});

describe('pointInPolygon', () => {
  const sq = rect(0, 0, 10, 10).points;
  it('finds a point inside and rejects one outside', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false);
  });
});

describe('measureTrace', () => {
  it('computes re-epithelialization from the two outlines alone', () => {
    // 200x200 px total at 20 px/cm = 100 cm². Raw 100x100 = 25 cm².
    // So 75 cm² healed, 75%.
    const m = measureTrace([rect(0, 0, 200, 200)], [rect(20, 20, 100, 100, 'raw')], 20)!;
    expect(m.totalAreaCm2).toBeCloseTo(100, 2);
    expect(m.rawAreaCm2).toBeCloseTo(25, 2);
    expect(m.healedAreaCm2).toBeCloseTo(75, 2);
    expect(m.healedPct).toBeCloseTo(75, 2);
    expect(m.rawExceedsTotal).toBe(false);
  });

  it('sums several raw patches, as a graft failing in three places', () => {
    const m = measureTrace(
      [rect(0, 0, 100, 100)],
      [rect(0, 0, 10, 10, 'a'), rect(20, 20, 10, 10, 'b'), rect(40, 40, 10, 10, 'c')],
      10,
    )!;
    // 10000 px² total, 300 px² raw -> 97%.
    expect(m.healedPct).toBeCloseTo(97, 2);
    expect(m.regionCount.raw).toBe(3);
  });

  it('sums several total outlines, as a donor site taken as two strips', () => {
    const m = measureTrace([rect(0, 0, 100, 50, 'a'), rect(0, 60, 100, 50, 'b')], [], 10)!;
    expect(m.totalAreaCm2).toBeCloseTo(100, 2);   // 10000 px² at 10 px/cm
    expect(m.healedPct).toBe(100);
  });

  it('reads a fully closed site as 100% and a wholly raw one as 0%', () => {
    expect(measureTrace([rect(0, 0, 50, 50)], [], 10)!.healedPct).toBe(100);
    expect(measureTrace([rect(0, 0, 50, 50)], [rect(0, 0, 50, 50, 'raw')], 10)!.healedPct).toBe(0);
  });

  it('reports overlapping raw outlines rather than clamping them away', () => {
    // Two raw patches drawn over each other sum to more than the total.
    const m = measureTrace(
      [rect(0, 0, 100, 100)],
      [rect(0, 0, 90, 90, 'a'), rect(5, 5, 90, 90, 'b')],
      10,
    )!;
    expect(m.rawExceedsTotal).toBe(true);
    // The percentage floors rather than going negative, but the flag survives.
    expect(m.healedPct).toBe(0);
  });

  it('refuses without a scale or without a total outline', () => {
    expect(measureTrace([rect(0, 0, 10, 10)], [], 0)).toBeNull();
    expect(measureTrace([], [rect(0, 0, 10, 10)], 10)).toBeNull();
  });
});

describe('validateTrace', () => {
  it('accepts a well-formed tracing', () => {
    const v = validateTrace([rect(0, 0, 100, 100)], [rect(10, 10, 20, 20, 'raw')], 20);
    expect(v.ok).toBe(true);
    expect(v.problems).toEqual([]);
  });

  it('insists on a scale before anything is measured', () => {
    const v = validateTrace([rect(0, 0, 100, 100)], [], null);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/No scale/);
  });

  it('insists on the site outline before the raw areas mean anything', () => {
    const v = validateTrace([], [rect(0, 0, 10, 10, 'raw')], 20);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/whole site/);
  });

  it('catches a raw patch tapped outside the site', () => {
    const v = validateTrace([rect(0, 0, 100, 100)], [rect(500, 500, 20, 20, 'stray')], 20);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/outside the site outline/);
  });

  it('catches overlapping raw patches', () => {
    const v = validateTrace(
      [rect(0, 0, 100, 100)],
      [rect(0, 0, 90, 90, 'a'), rect(5, 5, 90, 90, 'b')],
      20,
    );
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/overlapping/);
  });

  it('ignores an unfinished outline of one or two taps', () => {
    const v = validateTrace(
      [rect(0, 0, 100, 100)],
      [{ id: 'x', points: [{ x: 5, y: 5 }, { x: 6, y: 6 }] }],
      20,
    );
    expect(v.ok).toBe(true);
  });
});

describe('centroid', () => {
  it('finds the centre of a rectangle', () => {
    const c = centroid(rect(0, 0, 40, 20).points);
    expect(c.x).toBeCloseTo(20, 6);
    expect(c.y).toBeCloseTo(10, 6);
  });

  it('is not dragged by a dense run of points along one edge', () => {
    // The same square, but with twenty extra points along the bottom edge.
    const dense = [
      { x: 0, y: 0 },
      ...Array.from({ length: 20 }, (_, i) => ({ x: (i + 1) * (10 / 21), y: 0 })),
      { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const c = centroid(dense);
    expect(c.x).toBeCloseTo(5, 3);
    expect(c.y).toBeCloseTo(5, 3);
  });
});

describe('simplify', () => {
  it('drops redundant points without moving the boundary', () => {
    // A square whose edges carry 50 collinear points each.
    const dense: { x: number; y: number }[] = [];
    for (let i = 0; i < 50; i++) dense.push({ x: (i / 49) * 100, y: 0 });
    for (let i = 0; i < 50; i++) dense.push({ x: 100, y: (i / 49) * 100 });
    for (let i = 0; i < 50; i++) dense.push({ x: 100 - (i / 49) * 100, y: 100 });
    for (let i = 0; i < 50; i++) dense.push({ x: 0, y: 100 - (i / 49) * 100 });

    const simple = simplify(dense, 2);
    expect(simple.length).toBeLessThan(12);
    // The area must survive: this is the whole point.
    expect(polygonAreaPx(simple)).toBeCloseTo(polygonAreaPx(dense), 0);
  });

  it('leaves a short outline alone', () => {
    const t = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 8 }];
    expect(simplify(t)).toHaveLength(3);
  });

  it('keeps the corners of a real shape', () => {
    const star = ngon(0, 0, 60, 10);
    const simple = simplify(star, 1);
    expect(polygonAreaPx(simple)).toBeCloseTo(polygonAreaPx(star), 0);
  });
});

// ---------------------------------------------------------------------------
// Layered tracing: a wound surface is not raw-or-healed.
// ---------------------------------------------------------------------------

describe('measureLayeredTrace', () => {
  // A 200x200 px site at 20 px/cm is 100 cm². Every patch below is sized so
  // its area in cm² is a round number.
  const site = [rect(0, 0, 200, 200)];
  const PPC = 20;

  it('infers healed from the open patches, the usual donor-site flow', () => {
    // 60x60 granulation (9 cm²) + 40x40 slough (4 cm²) = 13 cm² open of 100.
    const m = measureLayeredTrace(site, {
      granulation: [rect(10, 10, 60, 60, 'g')],
      slough: [rect(100, 10, 40, 40, 's')],
    }, PPC)!;
    expect(m.totalAreaCm2).toBeCloseTo(100, 2);
    expect(m.openAreaCm2).toBeCloseTo(13, 2);
    expect(m.healedAreaCm2).toBeCloseTo(87, 2);
    expect(m.healedPct).toBeCloseTo(87, 2);
    expect(m.basis).toBe('inferred-from-open');
    expect(m.unclassifiedPct).toBe(0);
  });

  it('adds several patches on one layer, as slough in three places', () => {
    const m = measureLayeredTrace(site, {
      slough: [rect(0, 0, 20, 20, 'a'), rect(40, 0, 20, 20, 'b'), rect(80, 0, 20, 20, 'c')],
    }, PPC)!;
    // Three 400 px² patches = 1200 px² = 3 cm².
    expect(m.openAreaCm2).toBeCloseTo(3, 2);
    expect(m.healedPct).toBeCloseTo(97, 2);
    const slough = m.layers.find((l) => l.key === 'slough')!;
    expect(slough.regions).toBe(3);
    expect(slough.areaCm2).toBeCloseTo(3, 2);
  });

  it('infers open from the healed islands, the early donor-site flow', () => {
    // Two 40x40 epithelial islands = 3200 px² = 8 cm² healed of 100.
    const m = measureLayeredTrace(site, {
      epithelial: [rect(10, 10, 40, 40, 'e1'), rect(100, 100, 40, 40, 'e2')],
    }, PPC)!;
    expect(m.healedAreaCm2).toBeCloseTo(8, 2);
    expect(m.openAreaCm2).toBeCloseTo(92, 2);
    expect(m.healedPct).toBeCloseTo(8, 2);
    expect(m.basis).toBe('inferred-from-healed');
  });

  it('infers nothing when both sides are drawn, and reports the remainder', () => {
    // 40 cm² open, 40 cm² healed, 20 cm² neither: unclassified, not assigned.
    const m = measureLayeredTrace(site, {
      granulation: [rect(0, 0, 200, 80, 'g')],     // 16000 px² = 40 cm²
      epithelial: [rect(0, 80, 200, 80, 'e')],     // 16000 px² = 40 cm²
    }, PPC)!;
    expect(m.basis).toBe('traced-both');
    expect(m.openAreaCm2).toBeCloseTo(40, 2);
    expect(m.healedAreaCm2).toBeCloseTo(40, 2);
    expect(m.unclassifiedAreaCm2).toBeCloseTo(20, 2);
    expect(m.unclassifiedPct).toBeCloseTo(20, 2);
    // The unclassified fifth is not quietly credited to healing.
    expect(m.healedPct).toBeCloseTo(40, 2);
  });

  it('counts slough and eschar as open, however different they look', () => {
    const m = measureLayeredTrace(site, {
      slough: [rect(0, 0, 100, 100, 's')],        // 25 cm²
      necrotic: [rect(100, 100, 100, 100, 'n')],  // 25 cm²
    }, PPC)!;
    expect(m.openAreaCm2).toBeCloseTo(50, 2);
    expect(m.healedPct).toBeCloseTo(50, 2);
  });

  it('refuses to read an unmarked site as healed', () => {
    // The outline is drawn and nothing inside it marked. Calling that 100%
    // take would turn an unfinished tracing into a clinical claim.
    const m = measureLayeredTrace(site, {}, PPC)!;
    expect(m.basis).toBe('none');
    expect(m.healedPct).toBe(0);
    expect(m.openPct).toBe(0);
  });

  it('reports patches that overrun the site rather than clamping them', () => {
    const m = measureLayeredTrace(site, {
      granulation: [rect(0, 0, 190, 190, 'a')],
      slough: [rect(10, 10, 190, 190, 'b')],
    }, PPC)!;
    expect(m.exceedsTotal).toBe(true);
  });

  it('gives a full composition of the surface', () => {
    const m = measureLayeredTrace(site, {
      granulation: [rect(0, 0, 100, 100, 'g')],   // 25 cm²
      slough: [rect(100, 0, 100, 100, 's')],      // 25 cm²
    }, PPC)!;
    const by = Object.fromEntries(m.layers.map((l) => [l.key, l.pct]));
    expect(by.granulation).toBeCloseTo(25, 2);
    expect(by.slough).toBeCloseTo(25, 2);
    expect(by.necrotic).toBe(0);
    expect(by.epithelial).toBe(0);
  });

  it('ignores an unfinished patch of one or two taps', () => {
    const m = measureLayeredTrace(site, {
      granulation: [rect(0, 0, 100, 100, 'g'), { id: 'tap', points: [{ x: 5, y: 5 }] }],
    }, PPC)!;
    expect(m.openAreaCm2).toBeCloseTo(25, 2);
    expect(m.layers.find((l) => l.key === 'granulation')!.regions).toBe(1);
  });

  it('refuses without a scale or a site outline', () => {
    expect(measureLayeredTrace(site, { granulation: [rect(0, 0, 10, 10)] }, 0)).toBeNull();
    expect(measureLayeredTrace([], { granulation: [rect(0, 0, 10, 10)] }, PPC)).toBeNull();
  });

  it('agrees with the two-layer measurement it replaced', () => {
    const raw = [rect(20, 20, 100, 100, 'raw')];
    const two = measureTrace(site, raw, PPC)!;
    const layered = measureLayeredTrace(site, { granulation: raw }, PPC)!;
    expect(layered.healedPct).toBeCloseTo(two.healedPct, 6);
    expect(layered.openAreaCm2).toBeCloseTo(two.rawAreaCm2, 6);
  });
});

describe('validateLayeredTrace', () => {
  const site = [rect(0, 0, 200, 200)];

  it('accepts a well-formed layered tracing', () => {
    const v = validateLayeredTrace(site, { granulation: [rect(10, 10, 50, 50, 'g')] }, 20);
    expect(v.ok).toBe(true);
  });

  it('names the layer a stray patch was drawn on', () => {
    const v = validateLayeredTrace(site, { slough: [rect(900, 900, 20, 20, 'x')] }, 20);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/slough/i);
    expect(v.problems.join(' ')).toMatch(/outside the site outline/);
  });

  it('asks for at least one patch before recording a percentage', () => {
    const v = validateLayeredTrace(site, {}, 20);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/Mark at least one patch/);
  });

  it('still insists on a scale and a site outline', () => {
    expect(validateLayeredTrace(site, { granulation: [rect(1, 1, 5, 5)] }, null).ok).toBe(false);
    expect(validateLayeredTrace([], { granulation: [rect(1, 1, 5, 5)] }, 20).ok).toBe(false);
  });

  it('catches overlapping patches across different layers', () => {
    const v = validateLayeredTrace(site, {
      granulation: [rect(0, 0, 190, 190, 'a')],
      slough: [rect(10, 10, 190, 190, 'b')],
    }, 20);
    expect(v.ok).toBe(false);
    expect(v.problems.join(' ')).toMatch(/more than the whole site/);
  });
});
