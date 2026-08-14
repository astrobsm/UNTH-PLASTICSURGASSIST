/**
 * Photograph quality assessment, run before a wound is measured.
 *
 * WHY THIS EXISTS
 * The measurement pipeline is happy to segment a blurred, dark or blown-out
 * photograph and return an area to two decimal places. The number carries no
 * indication that the image it came from was unusable, and a serial chart built
 * from such numbers shows a wound changing size when what actually changed was
 * the lighting.
 *
 * So quality is judged first, recorded alongside the measurement, and — where
 * the image is genuinely unusable — allowed to stop the measurement happening
 * at all.
 *
 * ON THE THRESHOLDS
 * They are heuristic. They were chosen to catch photographs a clinician would
 * themselves call unusable, not calibrated against annotated data, and they are
 * reported openly so a rejection can be argued with rather than merely obeyed.
 * Only severe defects block; everything else warns and still measures, because
 * a clinician who can see the wound is a better judge than these numbers are.
 *
 * All functions here are pure and operate on raw RGBA, so they are testable
 * without a browser or a camera.
 */

export type QualityFlag =
  | 'blurred'
  | 'too_dark'
  | 'overexposed'
  | 'glare'
  | 'low_contrast'
  | 'low_resolution';

export type QualitySeverity = 'blocking' | 'warning';

export interface QualityFinding {
  flag: QualityFlag;
  severity: QualitySeverity;
  /** What the clinician should do about it. */
  message: string;
  /** The measured value behind the finding, so the judgement is inspectable. */
  value: number;
}

export interface ImageQualityReport {
  /** 0-1. 1 is a clean photograph; each finding subtracts from it. */
  score: number;
  findings: QualityFinding[];
  flags: QualityFlag[];
  /** False when a blocking defect was found — do not measure. */
  usable: boolean;
  metrics: {
    sharpness: number;      // variance of the Laplacian, normalised
    meanLuma: number;       // 0-255
    clippedHighFraction: number;
    clippedLowFraction: number;
    lumaSpread: number;     // 5th-95th percentile spread, 0-255
    pixels: number;
  };
}

/**
 * Thresholds, gathered so they can be reviewed in one place and replaced with
 * measured values once local data exists.
 */
export const QUALITY_THRESHOLDS = {
  /** Laplacian variance below this is unusably soft. */
  sharpnessBlocking: 40,
  sharpnessWarning: 120,
  /** Mean luma outside these bounds is too dark / too bright to judge tissue. */
  darkBlocking: 35,
  darkWarning: 60,
  brightWarning: 205,
  /** Fraction of pixels at the top of the range — specular highlights. */
  glareWarning: 0.06,
  glareBlocking: 0.2,
  /** 5th-95th percentile luma spread below this is a flat, contrastless image. */
  contrastWarning: 45,
  /** Below this many pixels there is not enough detail to measure against. */
  minPixels: 240 * 240,
} as const;

function luma(r: number, g: number, b: number): number {
  // Rec. 601 luma. The wound-relevant signal is mostly in the red channel, but
  // sharpness and exposure are judged on perceived brightness.
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Variance of the Laplacian — the standard cheap sharpness estimate.
 *
 * A sharp image has strong second derivatives at edges, so the Laplacian
 * response varies a lot. A blurred one is smooth everywhere and its variance
 * collapses. Computed on a luma plane with a 4-neighbour kernel.
 */
export function laplacianVariance(gray: Float32Array, w: number, h: number): number {
  if (w < 3 || h < 3) return 0;
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap =
        gray[i - 1] + gray[i + 1] + gray[i - w] + gray[i + w] - 4 * gray[i];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** Value at a percentile of a 256-bin histogram. */
function percentile(hist: Uint32Array, total: number, p: number): number {
  if (total === 0) return 0;
  const target = total * p;
  let cum = 0;
  for (let v = 0; v < 256; v++) {
    cum += hist[v];
    if (cum >= target) return v;
  }
  return 255;
}

export function assessImageQuality(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): ImageQualityReport {
  const pixels = width * height;
  const gray = new Float32Array(pixels);
  const hist = new Uint32Array(256);

  let lumaSum = 0;
  let clippedHigh = 0;
  let clippedLow = 0;

  for (let i = 0; i < pixels; i++) {
    const idx = i * 4;
    const l = luma(data[idx], data[idx + 1], data[idx + 2]);
    gray[i] = l;
    lumaSum += l;
    hist[Math.min(255, Math.max(0, Math.round(l)))]++;
    // Clipped pixels carry no recoverable detail — blown highlights are the
    // usual result of a flash on wet tissue.
    if (l >= 250) clippedHigh++;
    if (l <= 8) clippedLow++;
  }

  const meanLuma = pixels ? lumaSum / pixels : 0;
  const sharpness = laplacianVariance(gray, width, height);
  const clippedHighFraction = pixels ? clippedHigh / pixels : 0;
  const clippedLowFraction = pixels ? clippedLow / pixels : 0;
  const lumaSpread = percentile(hist, pixels, 0.95) - percentile(hist, pixels, 0.05);

  const findings: QualityFinding[] = [];
  const T = QUALITY_THRESHOLDS;

  if (pixels < T.minPixels) {
    findings.push({
      flag: 'low_resolution', severity: 'blocking', value: pixels,
      message: 'The photograph is too small to measure from. Capture at a higher resolution.',
    });
  }

  if (sharpness < T.sharpnessBlocking) {
    findings.push({
      flag: 'blurred', severity: 'blocking', value: sharpness,
      message: 'The photograph is out of focus. Hold steady, let the camera focus on the wound, and retake it.',
    });
  } else if (sharpness < T.sharpnessWarning) {
    findings.push({
      flag: 'blurred', severity: 'warning', value: sharpness,
      message: 'The photograph is soft. The wound edge may not be located accurately.',
    });
  }

  if (meanLuma < T.darkBlocking) {
    findings.push({
      flag: 'too_dark', severity: 'blocking', value: meanLuma,
      message: 'The photograph is too dark to assess. Add light and retake it.',
    });
  } else if (meanLuma < T.darkWarning) {
    findings.push({
      flag: 'too_dark', severity: 'warning', value: meanLuma,
      message: 'The photograph is underexposed. Wound edges may be lost in shadow.',
    });
  } else if (meanLuma > T.brightWarning) {
    findings.push({
      flag: 'overexposed', severity: 'warning', value: meanLuma,
      message: 'The photograph is very bright. Tissue colour may be washed out.',
    });
  }

  if (clippedHighFraction > T.glareBlocking) {
    findings.push({
      flag: 'glare', severity: 'blocking', value: clippedHighFraction,
      message: 'Much of the photograph is blown out by glare. Move the light source off-axis, or turn the flash off, and retake it.',
    });
  } else if (clippedHighFraction > T.glareWarning) {
    findings.push({
      flag: 'glare', severity: 'warning', value: clippedHighFraction,
      message: 'There is specular glare on the wound. Detail under the highlights is lost.',
    });
  }

  if (lumaSpread < T.contrastWarning) {
    findings.push({
      flag: 'low_contrast', severity: 'warning', value: lumaSpread,
      message: 'The photograph has little contrast. Wound margins may be hard to separate from skin.',
    });
  }

  // Score is indicative, for trend and triage rather than arithmetic. A blocking
  // finding costs much more than a warning so the two never look comparable.
  let score = 1;
  for (const f of findings) score -= f.severity === 'blocking' ? 0.5 : 0.15;
  score = Math.max(0, Math.min(1, score));

  return {
    score: Math.round(score * 1000) / 1000,
    findings,
    flags: [...new Set(findings.map(f => f.flag))],
    usable: !findings.some(f => f.severity === 'blocking'),
    metrics: {
      sharpness: Math.round(sharpness * 100) / 100,
      meanLuma: Math.round(meanLuma * 10) / 10,
      clippedHighFraction: Math.round(clippedHighFraction * 10000) / 10000,
      clippedLowFraction: Math.round(clippedLowFraction * 10000) / 10000,
      lumaSpread,
      pixels,
    },
  };
}

/** One line summarising a report, for a warning list or a toast. */
export function qualitySummary(report: ImageQualityReport): string {
  if (report.usable && report.findings.length === 0) return 'Photograph quality is adequate.';
  if (!report.usable) {
    const blocking = report.findings.filter(f => f.severity === 'blocking');
    return blocking.map(f => f.message).join(' ');
  }
  return report.findings.map(f => f.message).join(' ');
}
