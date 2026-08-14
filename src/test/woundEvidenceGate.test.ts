/**
 * The gate that lets the wound pipeline answer "there is nothing to measure".
 *
 * Before this existed, the segmenter normalised its redness score between each
 * image's own min and max and then kept the largest connected component, so it
 * returned a confident outline from any photograph at all — a bare arm, a
 * bedsheet, a ceiling. A measurement tool that cannot decline to measure will
 * eventually put a fabricated area into a patient's record.
 */

import { describe, it, expect } from 'vitest';
import { assessWoundEvidence, TISSUE_MODEL_VALIDATED } from '../services/aiWoundMeasurement';

const W = 40, H = 40, N = W * H;

/** Builds an RGBA buffer with a uniform background and an optional patch. */
function makeImage(
  bg: [number, number, number],
  patch?: { colour: [number, number, number]; x0: number; y0: number; x1: number; y1: number },
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const inPatch = patch && x >= patch.x0 && x < patch.x1 && y >= patch.y0 && y < patch.y1;
      const c = inPatch ? patch!.colour : bg;
      data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 255;
    }
  }
  return data;
}

function maskRect(x0: number, y0: number, x1: number, y1: number): Uint8Array {
  const m = new Uint8Array(N);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 255;
  return m;
}

describe('assessWoundEvidence', () => {
  it('accepts a red wound patch against skin', () => {
    // Deep red wound bed on mid-brown skin — the case that must keep working.
    const data = makeImage([170, 120, 95], { colour: [165, 35, 30], x0: 12, y0: 12, x1: 28, y1: 28 });
    const r = assessWoundEvidence(data, maskRect(12, 12, 28, 28), N);
    expect(r.plausible).toBe(true);
    expect(r.strictFraction).toBeGreaterThan(0.45);
    expect(r.contrast).toBeGreaterThan(0.04);
  });

  it('rejects uniform skin with no wound', () => {
    // The failure that motivated this gate: an arm with nothing on it. The
    // region is skin-coloured and identical to its surroundings, so contrast
    // collapses even though "redness" is high everywhere.
    const data = makeImage([170, 120, 95]);
    const r = assessWoundEvidence(data, maskRect(12, 12, 28, 28), N);
    expect(r.plausible).toBe(false);
    expect(r.reason).toMatch(/does not stand out/i);
  });

  it('rejects a region that is not wound-coloured', () => {
    // Blue surgical drape or glove.
    const data = makeImage([200, 200, 205], { colour: [40, 70, 190], x0: 10, y0: 10, x1: 30, y1: 30 });
    const r = assessWoundEvidence(data, maskRect(10, 10, 30, 30), N);
    expect(r.plausible).toBe(false);
    expect(r.reason).toMatch(/wound-like colour/i);
  });

  it('rejects a segmentation covering almost the whole frame', () => {
    const data = makeImage([165, 35, 30]);
    const r = assessWoundEvidence(data, maskRect(0, 0, W, H), N);
    expect(r.plausible).toBe(false);
    expect(r.reason).toMatch(/entire image/i);
    expect(r.coverage).toBeGreaterThan(0.9);
  });

  it('reports the measures it judged on, so a rejection can be argued with', () => {
    const data = makeImage([170, 120, 95]);
    const r = assessWoundEvidence(data, maskRect(12, 12, 28, 28), N);
    expect(Number.isFinite(r.strictFraction)).toBe(true);
    expect(Number.isFinite(r.contrast)).toBe(true);
    expect(Number.isFinite(r.coverage)).toBe(true);
  });

  it('handles an empty mask without dividing by zero', () => {
    const data = makeImage([170, 120, 95]);
    const r = assessWoundEvidence(data, new Uint8Array(N), N);
    expect(r.plausible).toBe(false);
    expect(Number.isNaN(r.strictFraction)).toBe(false);
    expect(Number.isNaN(r.contrast)).toBe(false);
  });
});

describe('tissue classifier gating', () => {
  it('is switched off', () => {
    // This must stay false until a model is trained AND validated against two
    // independent annotators. Flipping it without that is the whole failure
    // this work exists to prevent, so the flag is asserted rather than trusted.
    expect(TISSUE_MODEL_VALIDATED).toBe(false);
  });
});
