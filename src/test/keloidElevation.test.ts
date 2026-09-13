/**
 * Elevation and volume from a calibrated profile view.
 *
 * Checked against shapes whose height and volume are known from geometry, and
 * against the failure modes that would otherwise produce a confident wrong
 * number: a tilted camera, a baseline drawn backwards, and a lesion too small
 * to occupy enough pixels to measure.
 */

import { describe, it, expect } from 'vitest';
import {
  elevationAbove, measureProfile, estimateVolume, profileQuality,
// Plain ES module, shared with the serverless functions.
} from '../../api/_lib/keloidElevation.js';

const P = (x: number, y: number) => ({ x, y });

/** A symmetric triangular profile: width w, peak height h, apex centred. */
const triangle = (w: number, h: number, n = 21) =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * w;
    const height = t <= w / 2 ? (2 * h * t) / w : 2 * h * (1 - t / w);
    return P(t, -height);   // negative y is "up" in image coordinates
  });

describe('elevationAbove', () => {
  it('measures perpendicular distance from a horizontal baseline', () => {
    expect(Math.abs(elevationAbove(P(5, -10), P(0, 0), P(10, 0))!)).toBeCloseTo(10, 6);
  });

  it('measures perpendicular to a TILTED baseline, not vertically', () => {
    // The point of the method: an earlobe is photographed at whatever angle the
    // patient's head is held. A 45° baseline with a point 10 units
    // perpendicular from it must read 10, not 10/cos(45°).
    const a = P(0, 0);
    const b = P(10, 10);           // 45 degrees
    const perp = P(-Math.SQRT1_2 * 10, Math.SQRT1_2 * 10);  // 10 units perpendicular
    expect(Math.abs(elevationAbove(perp, a, b)!)).toBeCloseTo(10, 6);
  });

  it('returns null when the baseline has no direction', () => {
    expect(elevationAbove(P(1, 1), P(5, 5), P(5, 5))).toBeNull();
  });
});

describe('measureProfile', () => {
  const baseline = [P(0, 0), P(20, 0)];
  const PPC = 40;   // 40 px per cm

  it('measures the peak height of a known triangle', () => {
    // 8 px peak at 40 px/cm is 0.2 cm.
    const r = measureProfile(triangle(20, 8), baseline, PPC);
    expect(r.ok).toBe(true);
    expect(r.maxElevationCm).toBeCloseTo(0.2, 3);
  });

  it('gives a triangle a mean height of about half its peak', () => {
    const r = measureProfile(triangle(20, 8), baseline, PPC);
    expect(r.meanElevationCm).toBeCloseTo(0.1, 2);
  });

  it('measures the footprint width', () => {
    const r = measureProfile(triangle(20, 8), baseline, PPC);
    expect(r.profileWidthCm).toBeCloseTo(0.5, 2);   // 20 px / 40
  });

  it('gives the same height whichever way the baseline was drawn', () => {
    // The clinician should not have to draw left-to-right for the number to
    // come out positive.
    const forward = measureProfile(triangle(20, 8), [P(0, 0), P(20, 0)], PPC);
    const backward = measureProfile(triangle(20, 8), [P(20, 0), P(0, 0)], PPC);
    expect(backward.maxElevationCm).toBeCloseTo(forward.maxElevationCm, 6);
  });

  it('is unaffected by the camera being tilted', () => {
    // Rotate the whole scene by 30 degrees; the measurement must not move.
    const rot = (p: { x: number; y: number }, deg: number) => {
      const r = (deg * Math.PI) / 180;
      return P(p.x * Math.cos(r) - p.y * Math.sin(r), p.x * Math.sin(r) + p.y * Math.cos(r));
    };
    const flat = measureProfile(triangle(20, 8), baseline, PPC);
    const tilted = measureProfile(
      triangle(20, 8).map((p) => rot(p, 30)),
      baseline.map((p) => rot(p, 30)),
      PPC,
    );
    expect(tilted.maxElevationCm).toBeCloseTo(flat.maxElevationCm, 5);
    expect(tilted.meanElevationCm).toBeCloseTo(flat.meanElevationCm, 5);
  });

  it('is not biased by tracing one part of the profile more densely', () => {
    // Extra points crowded near the apex must not raise the mean height: the
    // mean is taken along the footprint, not over the traced points.
    const even = triangle(20, 8, 21);
    const crowded = [...even, ...triangle(20, 8, 41).filter((p) => p.x > 8 && p.x < 12)];
    const a = measureProfile(even, baseline, PPC);
    const b = measureProfile(crowded, baseline, PPC);
    expect(b.meanElevationCm).toBeCloseTo(a.meanElevationCm, 2);
  });

  it('refuses a profile of two or three taps', () => {
    expect(measureProfile([P(0, 0), P(5, -5)], baseline, PPC).ok).toBe(false);
  });

  it('refuses without a scale', () => {
    const r = measureProfile(triangle(20, 8), baseline, 0);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Calibrate/);
  });

  it('refuses without a baseline', () => {
    expect(measureProfile(triangle(20, 8), [P(0, 0)], PPC).ok).toBe(false);
  });

  it('refuses a profile that never rises above the skin line', () => {
    const flat = Array.from({ length: 10 }, (_, i) => P(i * 2, 0));
    const r = measureProfile(flat, baseline, PPC);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/does not rise above the baseline/);
  });
});

describe('estimateVolume', () => {
  const profile = measureProfile(triangle(20, 8), [P(0, 0), P(20, 0)], 40);

  it('brackets the volume between two shape models', () => {
    const v = estimateVolume(2.0, profile);
    expect(v.ok).toBe(true);
    expect(v.rangeCm3[0]).toBeLessThan(v.rangeCm3[1]);
    expect(v.volumeCm3).toBeGreaterThanOrEqual(v.rangeCm3[0]);
    expect(v.volumeCm3).toBeLessThanOrEqual(v.rangeCm3[1]);
  });

  it('uses area times mean height by default, the least-assuming model', () => {
    const v = estimateVolume(2.0, profile);
    expect(v.volumeCm3).toBeCloseTo(2.0 * profile.meanElevationCm, 3);
    expect(v.model).toMatch(/assumes least about shape/);
  });

  it('uses two-thirds area times peak for a domed nodule', () => {
    const v = estimateVolume(2.0, profile, { shape: 'dome' });
    expect(v.volumeCm3).toBeCloseTo((2 / 3) * 2.0 * profile.maxElevationCm, 3);
    expect(v.model).toMatch(/hemi-ellipsoid/);
  });

  it('always says the figure is an estimate, not a reconstruction', () => {
    expect(estimateVolume(2.0, profile).uncertaintyNote)
      .toMatch(/estimate, not a reconstruction/);
  });

  it('refuses without an en-face area', () => {
    expect(estimateVolume(0, profile).ok).toBe(false);
    expect(estimateVolume(null as never, profile).ok).toBe(false);
  });

  it('refuses without a usable profile, and passes the reason through', () => {
    const bad = measureProfile([P(0, 0)], [P(0, 0), P(10, 0)], 40);
    const v = estimateVolume(2.0, bad);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/at least/i);
  });
});

describe('profileQuality', () => {
  it('grades a tall, well-traced lesion high', () => {
    // 40 px of height, 21 points.
    const p = measureProfile(triangle(60, 40), [P(0, 0), P(60, 0)], 40);
    expect(profileQuality(p).grade).toBe('high');
  });

  it('grades a lesion only a few pixels tall as low, and says why', () => {
    // 6 px of height: a two-pixel tracing error is a third of the answer.
    const p = measureProfile(triangle(20, 6), [P(0, 0), P(20, 0)], 40);
    const q = profileQuality(p);
    expect(q.grade).toBe('low');
    expect(q.reason).toMatch(/pixels above the baseline/);
    expect(q.reason).toMatch(/closer/);
  });

  it('grades a sparsely traced profile moderate', () => {
    const p = measureProfile(triangle(60, 40, 5), [P(0, 0), P(60, 0)], 40);
    expect(profileQuality(p).grade).toBe('moderate');
  });

  it('reports failure when nothing was traced', () => {
    expect(profileQuality({ ok: false, reason: 'nope' }).grade).toBe('failed');
  });
});
