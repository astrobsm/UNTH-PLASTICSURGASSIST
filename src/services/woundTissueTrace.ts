/**
 * Measurements from a clinician's tracing: the wound margin and the tissue
 * regions inside it (granulation, slough, necrotic / eschar, epithelial).
 *
 * The wound margin gives area, perimeter, length and width exactly (polygon
 * geometry, scaled by the calibration). Tissue composition is computed by
 * sampling the wound on a fine grid: each sample inside the margin takes the
 * tissue whose traced region contains it. Where traced regions overlap, the
 * more serious tissue wins (necrotic > slough > granulation > epithelial), and
 * anything traced outside the margin is ignored. Samples no region covers are
 * the "remainder", which the clinician assigns to one tissue or leaves
 * unassigned — that is the part the app "calculates for you".
 */
import { measureContour, polygonCentroid, type ContourMeasurements, type Point } from './woundContourGeometry';

export const TISSUES = ['granulation', 'slough', 'necrotic', 'epithelial'] as const;
export type Tissue = typeof TISSUES[number];
export type Remainder = Tissue | 'unassigned';

/** Overlaps resolve to the most serious tissue. */
const PRIORITY: Tissue[] = ['necrotic', 'slough', 'granulation', 'epithelial'];

export const TISSUE_STYLE: Record<Tissue | 'wound', { label: string; stroke: string; fill: string }> = {
  wound:       { label: 'Wound margin',      stroke: '#111827', fill: 'rgba(17,24,39,0.08)' },
  granulation: { label: 'Granulation',       stroke: '#dc2626', fill: 'rgba(220,38,38,0.35)' },
  slough:      { label: 'Slough',            stroke: '#ca8a04', fill: 'rgba(234,179,8,0.45)' },
  necrotic:    { label: 'Necrotic / eschar', stroke: '#1f2937', fill: 'rgba(31,41,55,0.55)' },
  epithelial:  { label: 'Epithelial',        stroke: '#db2777', fill: 'rgba(244,114,182,0.40)' },
};

/** Even–odd ray casting. */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Integers that sum to `total`, by largest remainder. */
export function roundToTotal(values: number[], total = 100): number[] {
  const sum = values.reduce((s, v) => s + v, 0);
  if (sum <= 0) return values.map(() => 0);
  const scaled = values.map(v => (v / sum) * total);
  const floors = scaled.map(Math.floor);
  let left = total - floors.reduce((s, v) => s + v, 0);
  const order = scaled.map((v, i) => [v - floors[i], i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; floors[i]++; left--; }
  return floors;
}

export interface TraceResult {
  measurements: ContourMeasurements;           // cm
  contourCm: Point[];                          // wound margin, cm relative to its centroid
  centroidPx: Point;
  tissueAreaCm2: Record<Tissue, number>;
  /** Percent of the wound area; sums to 100 unless part is left unassigned. */
  tissuePct: Record<Tissue, number>;
  unassignedPct: number;
  tracedOutsideMargin: boolean;
}

export function computeTrace(input: {
  woundPx: Point[];
  regions: Partial<Record<Tissue, Point[][]>>;
  pixelsPerCm: number;
  remainder: Remainder;
  /** Approximate number of grid samples across the wound's bounding box. */
  samples?: number;
}): TraceResult | null {
  const { woundPx, regions, pixelsPerCm, remainder } = input;
  if (woundPx.length < 3 || !(pixelsPerCm > 0)) return null;

  const centroidPx = polygonCentroid(woundPx);
  const contourCm = woundPx.map(p => ({ x: (p.x - centroidPx.x) / pixelsPerCm, y: (p.y - centroidPx.y) / pixelsPerCm }));
  const measurements = measureContour(contourCm);

  const xs = woundPx.map(p => p.x), ys = woundPx.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX, h = maxY - minY;
  const target = input.samples ?? 40000;
  const step = Math.max(Math.sqrt((w * h) / target), 0.5);

  const polys = PRIORITY.map(t => [t, (regions[t] || []).filter(p => p.length >= 3)] as const);
  const counts: Record<Tissue, number> = { granulation: 0, slough: 0, necrotic: 0, epithelial: 0 };
  let inWound = 0, unlabelled = 0;

  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      const p = { x, y };
      if (!pointInPolygon(p, woundPx)) continue;
      inWound++;
      let label: Tissue | null = null;
      for (const [t, list] of polys) {
        if (list.some(poly => pointInPolygon(p, poly))) { label = t; break; }
      }
      if (label) counts[label]++; else unlabelled++;
    }
  }

  // Any traced point clearly outside the margin is worth a warning.
  const tracedOutsideMargin = polys.some(([, list]) => list.some(poly => {
    const outside = poly.filter(q => !pointInPolygon(q, woundPx)).length;
    return outside / poly.length > 0.25;
  }));

  if (inWound === 0) {
    return {
      measurements, contourCm, centroidPx, tracedOutsideMargin,
      tissueAreaCm2: { granulation: 0, slough: 0, necrotic: 0, epithelial: 0 },
      tissuePct: { granulation: 0, slough: 0, necrotic: 0, epithelial: 0 }, unassignedPct: 100,
    };
  }

  if (remainder !== 'unassigned') { counts[remainder] += unlabelled; unlabelled = 0; }

  const order: Tissue[] = [...TISSUES];
  const rounded = roundToTotal([...order.map(t => counts[t]), unlabelled]);
  const tissuePct = Object.fromEntries(order.map((t, i) => [t, rounded[i]])) as Record<Tissue, number>;
  const tissueAreaCm2 = Object.fromEntries(order.map(t => [t, Math.round((counts[t] / inWound) * measurements.area * 100) / 100])) as Record<Tissue, number>;

  return { measurements, contourCm, centroidPx, tissueAreaCm2, tissuePct, unassignedPct: rounded[order.length], tracedOutsideMargin };
}
