/**
 * Geometry behind a corrected wound outline.
 *
 * Every expectation here comes from the shape's known mathematics — a 4x3
 * rectangle has an area of 12 because that is what a rectangle is, not because
 * the function said so. Tests written the other way round only confirm that the
 * code still does what it did.
 */

import { describe, it, expect } from 'vitest';
import {
  polygonArea, polygonPerimeter, polygonCentroid, maxCaliper,
  measureContour, correctionMagnitude, type Point,
} from '../services/woundContourGeometry';

const rect = (w: number, h: number): Point[] => [
  { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h },
];

/** Regular polygon approximating a circle of radius r. */
const circle = (r: number, n = 720): Point[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    return { x: r * Math.cos(t), y: r * Math.sin(t) };
  });

describe('polygonArea', () => {
  it('measures a rectangle', () => {
    expect(polygonArea(rect(4, 3))).toBe(12);
  });

  it('measures a right triangle', () => {
    expect(polygonArea([{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 0, y: 4 }])).toBe(12);
  });

  it('approaches pi r squared for a circle', () => {
    expect(polygonArea(circle(5))).toBeCloseTo(Math.PI * 25, 1);
  });

  it('is unaffected by winding direction', () => {
    // Sign encodes which way the boundary was traced. A wound outlined
    // clockwise is not a negative wound.
    const cw = rect(4, 3);
    const ccw = [...cw].reverse();
    expect(polygonArea(ccw)).toBe(polygonArea(cw));
  });

  it('is zero for a degenerate outline', () => {
    expect(polygonArea([])).toBe(0);
    expect(polygonArea([{ x: 1, y: 1 }])).toBe(0);
    expect(polygonArea([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe(0);
  });
});

describe('polygonPerimeter', () => {
  it('measures a rectangle', () => {
    expect(polygonPerimeter(rect(4, 3))).toBe(14);
  });

  it('closes the boundary rather than leaving it open', () => {
    // 3-4-5 triangle: the closing edge is the hypotenuse.
    const tri = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }];
    expect(polygonPerimeter(tri)).toBe(12);
  });

  it('approaches 2 pi r for a circle', () => {
    expect(polygonPerimeter(circle(5))).toBeCloseTo(2 * Math.PI * 5, 1);
  });
});

describe('polygonCentroid', () => {
  it('finds the centre of a rectangle', () => {
    const c = polygonCentroid(rect(4, 3));
    expect(c.x).toBeCloseTo(2, 6);
    expect(c.y).toBeCloseTo(1.5, 6);
  });

  it('does not drift toward densely sampled edges', () => {
    // The failure this guards: a vertex mean would be pulled toward whichever
    // edge the clinician clicked most. Serial outlines are aligned on the
    // centroid, so that would make a stable wound appear to wander.
    const sparse = rect(10, 10);
    const dense: Point[] = [
      { x: 0, y: 0 },
      ...Array.from({ length: 20 }, (_, i) => ({ x: (i + 1) * (10 / 21), y: 0 })),
      { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 },
    ];
    const a = polygonCentroid(sparse);
    const b = polygonCentroid(dense);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it('falls back to the vertex mean for a collinear outline', () => {
    const c = polygonCentroid([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }]);
    expect(c.x).toBeCloseTo(2, 6);
    expect(Number.isNaN(c.x)).toBe(false);
  });
});

describe('maxCaliper', () => {
  it('finds the long axis of a rectangle and its width', () => {
    // Longest separation in a 4x3 rectangle is the diagonal, 5.
    const { length, width } = maxCaliper(rect(4, 3));
    expect(length).toBeCloseTo(5, 6);
    expect(width).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(5);
  });

  it('gives a circle equal length and width', () => {
    const { length, width } = maxCaliper(circle(4, 360));
    expect(length).toBeCloseTo(8, 1);
    expect(width).toBeCloseTo(8, 1);
  });

  it('is invariant to rotation', () => {
    // A wound is not longer because the patient was photographed at an angle.
    // An axis-aligned bounding box would fail this.
    const shape = rect(8, 2);
    const t = 0.7;
    const rotated = shape.map(p => ({
      x: p.x * Math.cos(t) - p.y * Math.sin(t),
      y: p.x * Math.sin(t) + p.y * Math.cos(t),
    }));
    const a = maxCaliper(shape);
    const b = maxCaliper(rotated);
    expect(b.length).toBeCloseTo(a.length, 6);
    expect(b.width).toBeCloseTo(a.width, 6);
  });

  it('handles a degenerate outline', () => {
    expect(maxCaliper([])).toEqual({ length: 0, width: 0 });
    expect(maxCaliper([{ x: 1, y: 1 }, { x: 1, y: 1 }])).toEqual({ length: 0, width: 0 });
  });
});

describe('measureContour', () => {
  it('returns every measurement for one outline, rounded', () => {
    const m = measureContour(rect(4, 3));
    expect(m.area).toBe(12);
    expect(m.perimeter).toBe(14);
    expect(m.length).toBe(5);
    expect(m.centroid.x).toBeCloseTo(2, 6);
  });
});

describe('correctionMagnitude', () => {
  it('is zero when the outline was not changed', () => {
    expect(correctionMagnitude(rect(4, 3), rect(4, 3))).toBe(0);
  });

  it('reports the fractional area change', () => {
    // 12 -> 24 is a doubling.
    expect(correctionMagnitude(rect(4, 3), rect(8, 3))).toBeCloseTo(1, 6);
    // 12 -> 6 is half, reported as a magnitude regardless of direction.
    expect(correctionMagnitude(rect(4, 3), rect(2, 3))).toBeCloseTo(0.5, 6);
  });

  it('treats a correction to an empty original as total', () => {
    expect(correctionMagnitude([], rect(4, 3))).toBe(1);
    expect(correctionMagnitude([], [])).toBe(0);
  });
});
