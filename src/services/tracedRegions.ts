/**
 * Areas from outlines the clinician draws, in real units.
 *
 * WHY THIS EXISTS
 *
 * Graft take and donor re-epithelialization need a wound divided into what has
 * healed and what has not. A trained classifier would do that, and none exists
 * that can honestly be deployed here — see docs/TISSUE_MODEL_EVIDENCE.md.
 *
 * The clinician can do it, and better: they are looking at the patient, not at
 * a photograph. So they trace two outlines — the whole site, and the raw area
 * still open within it — and the app measures both against the calibration
 * marker. The proportion follows by division.
 *
 * This is not a return to manual measurement. Nobody types a length, a width
 * or a percentage; nobody multiplies anything. The clinician marks *where* the
 * boundaries are, which is a judgement only they can make, and the app does
 * every measurement and every calculation. Capture, review, confirm.
 *
 * It is also better than measuring the open area against a locked baseline,
 * because both outlines come from the same photograph: a baseline recorded
 * wrongly, or a donor site that was never photographed on day zero, no longer
 * ruins the series.
 *
 * Everything here is pure and works in pixels plus a scale, so it is testable
 * against shapes whose area is known from geometry.
 */

export interface Point { x: number; y: number }

/** One closed outline the clinician drew, in image pixels. */
export interface TracedRegion {
  id: string;
  points: Point[];
}

export interface TraceMeasurement {
  totalAreaCm2: number;
  rawAreaCm2: number;
  healedAreaCm2: number;
  /** Healed as a percentage of total — take, or re-epithelialization. */
  healedPct: number;
  /** True when the raw outlines sum to more than the total outline. */
  rawExceedsTotal: boolean;
  regionCount: { total: number; raw: number };
}

/** Shoelace, unsigned: a clockwise trace is not a negative wound. */
export function polygonAreaPx(points: Point[]): number {
  if (!points || points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeterPx(points: Point[]): number {
  if (!points || points.length < 2) return 0;
  let d = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    d += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return d;
}

/**
 * Pixels to square centimetres.
 *
 * Area scales with the square of a length, which is the one place this
 * conversion is easy to get wrong by a factor of the scale itself.
 */
export function pxAreaToCm2(areaPx: number, pixelsPerCm: number): number {
  if (!(pixelsPerCm > 0)) return 0;
  return areaPx / (pixelsPerCm * pixelsPerCm);
}

/**
 * The scale, from a line drawn along something of known length.
 *
 * The guided fallback for when the marker was not detected automatically: the
 * clinician drags across the 5 cm marker in the photograph and the app works
 * out how many pixels a centimetre is.
 */
export function calibrationFromLine(a: Point, b: Point, knownCm: number): number | null {
  if (!(knownCm > 0)) return null;
  const px = Math.hypot(b.x - a.x, b.y - a.y);
  if (!(px > 0)) return null;
  return px / knownCm;
}

/** True when the point is inside the polygon, by the even-odd rule. */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y)
        && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * What the two sets of outlines measure.
 *
 * Several outlines are allowed on each side — a donor site can be photographed
 * as two strips, and a graft can fail in three separate patches — and each
 * side is summed. Overlapping raw outlines would be double-counted, so raw
 * exceeding total is reported rather than silently clamped: it means the
 * tracing needs correcting, and hiding it would turn a drawing error into a
 * confident clinical number.
 */
export function measureTrace(
  totalRegions: TracedRegion[],
  rawRegions: TracedRegion[],
  pixelsPerCm: number,
): TraceMeasurement | null {
  if (!(pixelsPerCm > 0)) return null;

  const totalPx = (totalRegions || []).reduce((s, r) => s + polygonAreaPx(r.points), 0);
  if (!(totalPx > 0)) return null;

  const rawPx = (rawRegions || []).reduce((s, r) => s + polygonAreaPx(r.points), 0);

  const totalAreaCm2 = pxAreaToCm2(totalPx, pixelsPerCm);
  const rawAreaCm2 = pxAreaToCm2(rawPx, pixelsPerCm);
  const rawExceedsTotal = rawPx > totalPx;

  const healedPx = Math.max(0, totalPx - rawPx);

  return {
    totalAreaCm2: round2(totalAreaCm2),
    rawAreaCm2: round2(rawAreaCm2),
    healedAreaCm2: round2(pxAreaToCm2(healedPx, pixelsPerCm)),
    healedPct: round2((healedPx / totalPx) * 100),
    rawExceedsTotal,
    regionCount: { total: (totalRegions || []).length, raw: (rawRegions || []).length },
  };
}

/**
 * Whether the tracing is fit to record, and what is wrong if not.
 *
 * Checked before saving rather than after, because a percentage derived from
 * an outline of four stray taps is indistinguishable, once stored, from one
 * traced carefully.
 */
export function validateTrace(
  totalRegions: TracedRegion[],
  rawRegions: TracedRegion[],
  pixelsPerCm: number | null,
): { ok: boolean; problems: string[] } {
  const problems: string[] = [];

  if (!pixelsPerCm || pixelsPerCm <= 0) {
    problems.push('No scale: detect the calibration marker or draw along it before tracing.');
  }

  const usableTotal = (totalRegions || []).filter((r) => r.points.length >= 3);
  if (!usableTotal.length) {
    problems.push('Trace the outline of the whole site first.');
  }

  for (const r of rawRegions || []) {
    if (r.points.length < 3) continue;
    // A raw patch whose centroid falls outside every total outline is almost
    // always a mis-tap, and would otherwise inflate the open area.
    const c = centroid(r.points);
    if (usableTotal.length && !usableTotal.some((t) => pointInPolygon(c, t.points))) {
      problems.push('One of the raw areas lies outside the site outline. Remove or redraw it.');
      break;
    }
  }

  const m = usableTotal.length && pixelsPerCm
    ? measureTrace(usableTotal, rawRegions || [], pixelsPerCm)
    : null;
  if (m?.rawExceedsTotal) {
    problems.push('The raw areas add up to more than the whole site — they may be overlapping.');
  }

  return { ok: problems.length === 0, problems };
}

export function centroid(points: Point[]): Point {
  if (!points.length) return { x: 0, y: 0 };
  // Area-weighted where the polygon is non-degenerate, so a dense run of
  // points along one edge does not drag the centre towards it.
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const q = points[(i + 1) % points.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < 1e-9) {
    return {
      x: points.reduce((s, p) => s + p.x, 0) / points.length,
      y: points.reduce((s, p) => s + p.y, 0) / points.length,
    };
  }
  a *= 0.5;
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/**
 * Thins a freehand stroke without moving its boundary appreciably.
 *
 * A finger dragged round a wound leaves hundreds of points a pixel apart.
 * Ramer–Douglas–Peucker keeps the corners and drops the redundancy, so the
 * stored outline is small enough to keep in a JSONB column and to redraw, and
 * the area is unchanged to well under a square millimetre.
 */
export function simplify(points: Point[], epsilonPx = 2): Point[] {
  if (points.length <= 3) return points.slice();

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (idx !== -1 && maxD > epsilonPx) {
      keep[idx] = 1;
      stack.push([first, idx], [idx, last]);
    }
  }

  const out: Point[] = [];
  for (let i = 0; i < points.length; i++) if (keep[i]) out.push(points[i]);
  return out;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
