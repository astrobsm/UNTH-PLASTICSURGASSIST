/**
 * Measurements derived from a wound outline, in centimetres.
 *
 * WHY THIS IS SEPARATE
 * When a clinician corrects the boundary the automated pipeline drew, the
 * numbers have to follow. A corrected outline sitting beside the original
 * machine-derived area would be worse than no correction at all: the record
 * would show an outline the clinician endorsed next to an area they did not.
 *
 * These operate on the cm-space contour the pipeline already produces
 * (`contourCm`, centred on the wound centroid), so they need no calibration
 * factor and no image. That makes them pure, and pure means testable against
 * shapes whose true area is known from geometry rather than from the code.
 */

export interface Point { x: number; y: number }

export interface ContourMeasurements {
  /** cm², by the shoelace formula. */
  area: number;
  /** cm, summed along the closed boundary. */
  perimeter: number;
  /** Greatest distance between any two boundary points, cm. */
  length: number;
  /** Greatest extent perpendicular to the length axis, cm. */
  width: number;
  centroid: Point;
}

/**
 * Signed area by the shoelace formula, halved.
 *
 * The absolute value is taken because the sign only encodes winding direction,
 * and a contour traced clockwise is not a negative wound.
 */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Closed-boundary length. */
export function polygonPerimeter(points: Point[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

/**
 * Area-weighted centroid.
 *
 * Not the mean of the vertices: that pulls toward wherever points happen to be
 * dense, so a boundary traced with more clicks along one edge would shift the
 * centre. The healing map aligns serial outlines on this point, so a centroid
 * that moves with sampling would make a stable wound look like it was drifting.
 */
export function polygonCentroid(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length < 3) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }
  let cx = 0, cy = 0, signedArea = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.y - b.x * a.y;
    signedArea += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  signedArea /= 2;
  // Degenerate (collinear) contour: fall back to the vertex mean rather than
  // dividing by zero.
  if (Math.abs(signedArea) < 1e-9) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }
  return { x: cx / (6 * signedArea), y: cy / (6 * signedArea) };
}

/**
 * Greatest separation between any two boundary points, and the greatest extent
 * at right angles to it.
 *
 * This is what a clinician means by "length and width": the longest axis of the
 * wound and its widest span across that axis, not the width of an
 * axis-aligned box, which changes when the patient is photographed at a
 * different rotation.
 *
 * O(n²), which is nothing for the ~64-point contours in use.
 */
export function maxCaliper(points: Point[]): { length: number; width: number } {
  if (points.length < 2) return { length: 0, width: 0 };

  let best = 0, ai = 0, bi = 1;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
      if (d > best) { best = d; ai = i; bi = j; }
    }
  }
  if (best === 0) return { length: 0, width: 0 };

  // Unit vector along the long axis; width is the spread of the projections
  // onto its normal.
  const ux = (points[bi].x - points[ai].x) / best;
  const uy = (points[bi].y - points[ai].y) / best;
  let minPerp = Infinity, maxPerp = -Infinity;
  for (const p of points) {
    const perp = -uy * p.x + ux * p.y;
    if (perp < minPerp) minPerp = perp;
    if (perp > maxPerp) maxPerp = perp;
  }

  return { length: best, width: maxPerp - minPerp };
}

/** Every derived measurement for one outline. */
export function measureContour(points: Point[]): ContourMeasurements {
  const { length, width } = maxCaliper(points);
  return {
    area: round2(polygonArea(points)),
    perimeter: round2(polygonPerimeter(points)),
    length: round2(length),
    width: round2(width),
    centroid: polygonCentroid(points),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * How far a corrected outline departs from the one it replaced, as a fraction
 * of the original area.
 *
 * Shown to the clinician before they commit, because a correction that changes
 * the area by 60% is usually a redrawn wound rather than a nudged edge, and is
 * worth a second look. It is also the number that makes the paired
 * (attempt, correction) data useful later: it says how wrong the pipeline was.
 */
export function correctionMagnitude(original: Point[], corrected: Point[]): number {
  const a = polygonArea(original);
  const b = polygonArea(corrected);
  if (a <= 0) return b > 0 ? 1 : 0;
  return Math.abs(b - a) / a;
}
