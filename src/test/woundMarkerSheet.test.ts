// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  computeTileLayout, MARKER_5CM, MARKER_10CM, MARKER_RGB,
} from '../services/woundMarkerPdfService';

/**
 * The marker sheet carries a known physical length, so its geometry is the
 * whole point. These tests pin the two things that would silently ruin it: a
 * tile block that overflows the page, and marker proportions that the
 * detector would read as the wrong size.
 */

const A4 = { width: 210, height: 297 };
const PAGE_MARGIN = 8;
const HEADER = 16;

describe('tile layout', () => {
  it('fits the 5 cm markers several to a row', () => {
    const l = computeTileLayout(MARKER_5CM);
    expect(l.columns).toBeGreaterThanOrEqual(3);
    expect(l.rows).toBeGreaterThanOrEqual(10);
    expect(l.total).toBeGreaterThanOrEqual(30);
  });

  it('fits the 10 cm markers down the page', () => {
    const l = computeTileLayout(MARKER_10CM);
    expect(l.columns).toBeGreaterThanOrEqual(1);
    expect(l.rows).toBeGreaterThanOrEqual(10);
  });

  it('never overflows the printable width', () => {
    for (const spec of [MARKER_5CM, MARKER_10CM]) {
      const l = computeTileLayout(spec);
      const right = l.offsetX + l.columns * l.cellWidth;
      expect(right).toBeLessThanOrEqual(A4.width - PAGE_MARGIN + 0.001);
      expect(l.offsetX).toBeGreaterThanOrEqual(PAGE_MARGIN - 0.001);
    }
  });

  it('never overflows the printable height', () => {
    for (const spec of [MARKER_5CM, MARKER_10CM]) {
      const l = computeTileLayout(spec);
      const bottom = PAGE_MARGIN + HEADER + l.rows * l.cellHeight;
      expect(bottom).toBeLessThanOrEqual(A4.height - PAGE_MARGIN + 0.001);
    }
  });

  it('leaves a cutting margin around every marker', () => {
    for (const spec of [MARKER_5CM, MARKER_10CM]) {
      const l = computeTileLayout(spec);
      expect(l.cellWidth).toBeGreaterThan(spec.widthMm);
      expect(l.cellHeight).toBeGreaterThan(spec.heightMm);
    }
  });

  it('centres the block horizontally', () => {
    const l = computeTileLayout(MARKER_5CM);
    const leftGap = l.offsetX;
    const rightGap = A4.width - (l.offsetX + l.columns * l.cellWidth);
    expect(Math.abs(leftGap - rightGap)).toBeLessThan(0.01);
  });
});

describe('marker geometry matches what the detector reads', () => {
  // detectGreenMarkers: aspect > 8 -> 10 cm, aspect > 3 -> 5 cm, else 1 cm.
  const bucket = (aspect: number) => (aspect > 8 ? 10 : aspect > 3 ? 5 : 1);

  it('the 5 cm marker is read as 5 cm', () => {
    const aspect = MARKER_5CM.widthMm / MARKER_5CM.heightMm;
    expect(aspect).toBe(5);
    expect(bucket(aspect)).toBe(MARKER_5CM.cm);
  });

  it('the 10 cm marker is read as 10 cm', () => {
    const aspect = MARKER_10CM.widthMm / MARKER_10CM.heightMm;
    expect(aspect).toBe(10);
    expect(bucket(aspect)).toBe(MARKER_10CM.cm);
  });

  it('keeps both clear of the bucket boundaries', () => {
    // An oblique photograph foreshortens one axis. Sitting at 5 and 10 rather
    // than at 3.5 or 8.5 means a modest angle cannot flip the reading.
    const a5 = MARKER_5CM.widthMm / MARKER_5CM.heightMm;
    const a10 = MARKER_10CM.widthMm / MARKER_10CM.heightMm;
    expect(a5 - 3).toBeGreaterThanOrEqual(1.5);
    expect(8 - a5).toBeGreaterThanOrEqual(1.5);
    expect(a10 - 8).toBeGreaterThanOrEqual(1.5);
  });
});

describe('marker colour sits inside the detector window', () => {
  // detectGreenMarkers accepts hue 80-160, saturation > 30, value > 25.
  const { r, g, b } = MARKER_RGB;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const hue = delta === 0 ? 0
    : max === g ? 60 * (2 + (b - r) / delta)
    : max === r ? 60 * (((g - b) / delta) % 6)
    : 60 * (4 + (r - g) / delta);
  const sat = max === 0 ? 0 : (delta / max) * 100;
  const val = (max / 255) * 100;

  it('is green at hue 120', () => {
    expect(hue).toBeCloseTo(120, 1);
  });

  it('is well inside the accepted hue range, not near an edge', () => {
    // Room for print variation and camera white balance to move it.
    expect(hue - 80).toBeGreaterThan(30);
    expect(160 - hue).toBeGreaterThan(30);
  });

  it('clears the saturation and value thresholds', () => {
    expect(sat).toBeGreaterThan(30);
    expect(val).toBeGreaterThan(25);
  });
});
