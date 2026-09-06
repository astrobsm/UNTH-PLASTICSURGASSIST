/**
 * A wound measurement must not claim more than it knows.
 *
 * Two things were being asserted that were not true:
 *
 *   the scale   with no reference in the frame the pipeline assumed every
 *               photograph was twenty centimetres across, and reported the
 *               resulting area to two decimal places
 *   the trace   the outline that produced the area was never shown, so an
 *               outline that had followed a shadow or a dressing edge looked
 *               exactly like one that had followed the wound
 *
 * These cover both, because both are ways of presenting a guess as a measurement.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const engine = read('src/services/aiWoundMeasurement.ts');
const badge = read('src/components/wound/CalibrationEvidenceBadge.tsx');
const overlay = read('src/services/woundOverlayRenderer.ts');
const monitor = read('src/pages/WoundProgressMonitorPage.tsx');

describe('no scale is ever invented', () => {
  it('does not assume a photograph is twenty centimetres across', () => {
    // `Math.max(w, h) / 20` was the whole basis of the fabricated scale.
    expect(engine).not.toMatch(/Math\.max\(w,\s*h\)\s*\/\s*20/);
  });

  it('reports an absent reference as absent', () => {
    expect(engine).toContain("type: 'none'");
    expect(engine).toContain("detectionMethod: 'none'");
  });

  it('does not label an undetected scale "manual"', () => {
    // The fallback claimed to be manual and automatic at once; neither was true.
    expect(engine).not.toMatch(/type:\s*'manual',\s*knownSizeCm:\s*1,\s*pixelSize:\s*estimated/);
  });

  it('produces no centimetres without a scale', () => {
    // Dividing by a pxPerCm of zero yields Infinity, which would reach the chart.
    expect(engine).toContain('const hasScale = pxPerCm > 0;');
    expect(engine).toContain('const areaCm2 = hasScale ? pixelArea / (pxPerCm * pxPerCm) : 0;');
  });

  it('states on the result whether centimetres mean anything', () => {
    expect(engine).toContain('calibrated: boolean;');
    expect(engine).toContain("calibrated: calibration.type !== 'none' && pxPerCm > 0");
  });

  it('says plainly that nothing was measured, rather than "approximate"', () => {
    expect(engine).toContain('No scale reference found in this photograph');
    expect(engine).toContain('No measurement in centimetres has been made');
  });
});

describe('the scale carries its proof', () => {
  it('records what was found, its size, and the pixels it spanned', () => {
    expect(engine).toContain('export interface CalibrationEvidence');
    for (const field of ['reference', 'knownSizeCm', 'measuredPixels', 'pixelsPerCm', 'confirmedByPerson']) {
      expect(engine, field).toContain(`${field}:`);
    }
  });

  it('reports the marker size that was actually detected, not a fixed 1 cm', () => {
    // The detector distinguishes a 1, 5 and 10 cm bar by aspect ratio; the
    // scale used that and the evidence must report the same thing.
    expect(engine).toContain('const knownCm = green.knownCm ?? 1;');
    expect(engine).toContain('reference: `${knownCm} cm printed marker`');
  });

  it('distinguishes a scale a person set from one detected', () => {
    expect(engine).toContain('confirmedByPerson: true');
    expect(engine).toContain('confirmedByPerson: false');
  });

  it('shows the arithmetic rather than a tick', () => {
    expect(badge).toContain('Known size');
    expect(badge).toContain('Spanned');
    expect(badge).toContain('px/cm');
  });

  it('separates "no reference" from "weak reference"', () => {
    // They are different situations and only one of them yields a number.
    expect(badge).toContain('Not calibrated — no measurement in centimetres.');
    expect(badge).toContain('Calibrated, but weakly');
  });

  it('does not present a scale with no evidence as proven', () => {
    expect(badge).toContain('carries no record of what it');
  });
});

describe('the trace is shown as evidence', () => {
  it('draws the detected margin on the photograph it came from', () => {
    expect(overlay).toContain('export async function renderContourOverlay');
    expect(overlay).toContain('function drawMargin');
  });

  it('draws the margin twice so it is visible on any tissue colour', () => {
    // A single-colour line vanishes against a wound of the same tone, and a
    // line that cannot be seen is not evidence.
    expect(overlay).toContain('MARGIN_SHADOW');
    expect(overlay).toContain('MARGIN_COLOUR');
  });

  it('puts a scale bar in the image when there is a scale', () => {
    expect(overlay).toContain('function drawScaleBar');
    expect(overlay).toContain('options.calibrated && options.pixelsPerCm');
  });

  it('writes the uncalibrated state onto the image itself', () => {
    // The image outlives the screen that explained it.
    expect(overlay).toContain("lines.push('Traced, but not calibrated')");
  });

  it('says so when no margin was found at all', () => {
    expect(overlay).toContain("lines.push('No wound margin was detected')");
  });

  it('does not stall a phone on a long contour', () => {
    // Furthest-pair is quadratic; a traced margin runs to thousands of points.
    expect(overlay).toContain('const MAX_POINTS = 200;');
  });

  it('never costs the clinician the measurement when it fails', () => {
    expect(overlay).toContain('return null;');
    expect(monitor).toContain('could not render the margin overlay');
  });
});

describe('the evidence is kept, not just shown', () => {
  it('stores the overlay as its own image', () => {
    // The kind existed and was displayed, but nothing ever produced one.
    expect(monitor).toContain("kind: 'overlay'");
  });

  it('attaches both the original and the overlay to the assessment', () => {
    expect(monitor).toContain('const refs = [imageRef, overlayRefRef.current].filter(Boolean)');
  });

  it('shows the trace before the clinician saves', () => {
    expect(monitor).toContain('Check it follows the wound edge before saving');
  });

  it('releases the preview it created', () => {
    expect(monitor).toContain('URL.revokeObjectURL(overlayUrl)');
  });
});
