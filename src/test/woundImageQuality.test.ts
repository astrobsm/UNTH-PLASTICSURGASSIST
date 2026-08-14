/**
 * Photograph quality gate.
 *
 * The failure being prevented: a blurred or blown-out photograph segments
 * perfectly happily and returns an area to two decimal places. Built into a
 * serial chart, a change in the ward lighting then reads as a change in the
 * wound.
 *
 * Images here are synthesised with one known defect each, so a failure points
 * at the specific check that broke rather than at "quality".
 */

import { describe, it, expect } from 'vitest';
import {
  assessImageQuality, laplacianVariance, qualitySummary, QUALITY_THRESHOLDS,
} from '../services/woundImageQuality';

const W = 300, H = 300;   // above the minimum-resolution floor

/** Sharp image: fine checkerboard over a mid-tone, strong local detail. */
function sharpImage(w = W, h = H, base = 128, amp = 60): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = base + ((x + y) % 2 ? amp : -amp);
      d[i] = v; d[i + 1] = v * 0.7; d[i + 2] = v * 0.6; d[i + 3] = 255;
    }
  }
  return d;
}

/** Flat image: every pixel identical. No detail at all. */
function flatImage(level: number, w = W, h = H): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    d[j] = level; d[j + 1] = level; d[j + 2] = level; d[j + 3] = 255;
  }
  return d;
}

/** Mostly-blown-out image with a small amount of detail. */
function glaringImage(clippedFraction: number, w = W, h = H): Uint8ClampedArray {
  const d = sharpImage(w, h, 128, 60);
  const clip = Math.floor(w * h * clippedFraction);
  for (let i = 0; i < clip; i++) {
    const j = i * 4;
    d[j] = 255; d[j + 1] = 255; d[j + 2] = 255;
  }
  return d;
}

describe('laplacianVariance', () => {
  it('is high for a detailed image and near zero for a flat one', () => {
    const sharp = laplacianVariance(Float32Array.from({ length: W * H }, (_, i) => ((i % 2) ? 200 : 60)), W, H);
    const flat = laplacianVariance(new Float32Array(W * H).fill(128), W, H);
    expect(sharp).toBeGreaterThan(flat);
    expect(flat).toBeCloseTo(0, 5);
  });

  it('returns zero rather than throwing on a degenerate size', () => {
    expect(laplacianVariance(new Float32Array(4), 2, 2)).toBe(0);
  });
});

describe('assessImageQuality', () => {
  it('passes a sharp, well-exposed photograph', () => {
    const r = assessImageQuality(sharpImage(), W, H);
    expect(r.usable).toBe(true);
    expect(r.flags).not.toContain('blurred');
    expect(r.flags).not.toContain('too_dark');
    expect(r.score).toBeGreaterThan(0.8);
  });

  it('blocks an out-of-focus photograph', () => {
    // A flat mid-tone has no second-derivative response anywhere — the limiting
    // case of blur.
    const r = assessImageQuality(flatImage(128), W, H);
    expect(r.usable).toBe(false);
    expect(r.flags).toContain('blurred');
    expect(r.findings.some(f => f.flag === 'blurred' && f.severity === 'blocking')).toBe(true);
  });

  it('blocks a photograph too dark to assess', () => {
    const r = assessImageQuality(flatImage(10), W, H);
    expect(r.usable).toBe(false);
    expect(r.flags).toContain('too_dark');
  });

  it('blocks a photograph mostly lost to glare', () => {
    const r = assessImageQuality(glaringImage(0.5), W, H);
    expect(r.usable).toBe(false);
    expect(r.flags).toContain('glare');
    expect(r.metrics.clippedHighFraction).toBeGreaterThan(QUALITY_THRESHOLDS.glareBlocking);
  });

  it('warns about mild glare without blocking', () => {
    const r = assessImageQuality(glaringImage(0.1), W, H);
    expect(r.flags).toContain('glare');
    expect(r.findings.find(f => f.flag === 'glare')?.severity).toBe('warning');
    expect(r.usable).toBe(true);
  });

  it('blocks an image too small to measure from', () => {
    const r = assessImageQuality(sharpImage(100, 100), 100, 100);
    expect(r.usable).toBe(false);
    expect(r.flags).toContain('low_resolution');
  });

  it('flags a flat, contrastless image', () => {
    const r = assessImageQuality(flatImage(128), W, H);
    expect(r.flags).toContain('low_contrast');
    expect(r.metrics.lumaSpread).toBeLessThan(QUALITY_THRESHOLDS.contrastWarning);
  });

  it('reports the measurements behind every judgement', () => {
    // A rejection a clinician cannot interrogate is one they will learn to
    // ignore, so each finding carries the value it was made on.
    const r = assessImageQuality(flatImage(10), W, H);
    expect(r.findings.length).toBeGreaterThan(0);
    for (const f of r.findings) {
      expect(Number.isFinite(f.value)).toBe(true);
      expect(f.message.length).toBeGreaterThan(10);
    }
    expect(r.metrics.pixels).toBe(W * H);
  });

  it('keeps the score inside 0..1 however many defects stack up', () => {
    const r = assessImageQuality(flatImage(2, 80, 80), 80, 80);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it('scores a blocking defect well below a warning', () => {
    const blocked = assessImageQuality(flatImage(128), W, H);
    const warned = assessImageQuality(glaringImage(0.1), W, H);
    expect(blocked.score).toBeLessThan(warned.score);
  });
});

describe('qualitySummary', () => {
  it('confirms an adequate photograph', () => {
    expect(qualitySummary(assessImageQuality(sharpImage(), W, H))).toMatch(/adequate/i);
  });

  it('reports only the blocking reasons when unusable', () => {
    const r = assessImageQuality(flatImage(10), W, H);
    const s = qualitySummary(r);
    expect(s).toMatch(/too dark|out of focus/i);
  });
});
