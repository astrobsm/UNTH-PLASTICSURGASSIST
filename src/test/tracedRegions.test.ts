/**
 * Traced-area arithmetic, against shapes whose area is known from geometry.
 */

import { describe, it, expect } from 'vitest';
import {
  polygonAreaPx, polygonPerimeterPx, pxAreaToCm2, calibrationFromLine,
  pointInPolygon, measureTrace, validateTrace, centroid, simplify,
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
