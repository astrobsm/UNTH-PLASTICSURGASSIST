/**
 * Scar colour, measured against the patient's own skin.
 *
 * WHY NOT RGB, AND WHY NOT ABSOLUTE
 *
 * Two problems make naive colour analysis useless in a real ward.
 *
 * The first is that RGB distances do not correspond to perceived difference: a
 * given step in RGB is a large change in one part of the space and invisible in
 * another. CIELAB was constructed so that Euclidean distance approximates
 * perceptual difference, which is what ΔE means and why it is used here.
 *
 * The second is more important. An absolute L* of 45 says nothing about whether
 * a scar is hypopigmented — it depends entirely on the patient. A rule tuned on
 * light skin will read normally-pigmented dark skin as pathological, which is
 * exactly the failure §61 warns about. So **every index here is a difference
 * against adjacent normal skin traced on the same photograph, under the same
 * light, on the same camera**. The reference is the patient's own skin a
 * centimetre away.
 *
 * That also cancels most of the device and lighting variation the brief worries
 * about in §62, because both samples pass through the identical pipeline.
 *
 * WHAT THIS IS NOT
 *
 * This is a photographic index. It is not spectrophotometry, and it does not
 * measure blood flow. Erythema here is "how much redder than neighbouring skin
 * this looks in this photograph" — reported as such, never as vascularity (§16).
 *
 * Pure functions over pixel arrays, so they are testable without a browser.
 */

export interface Lab { L: number; a: number; b: number }
export interface Rgb { r: number; g: number; b: number }

export interface ColourSample {
  /** Mean CIELAB of the sampled pixels. */
  mean: Lab;
  /** Standard deviation per channel — the heterogeneity of the region. */
  sd: Lab;
  pixels: number;
}

export interface ScarColourResult {
  scar: ColourSample;
  reference: ColourSample;
  /** Perceptual distance between scar and adjacent normal skin. */
  deltaE: number;
  /** Positive = scar is redder than the reference. */
  erythemaIndex: number;
  /** Negative = scar is darker (hyperpigmented); positive = lighter. */
  lightnessDelta: number;
  /** Positive = scar is more yellow; part of the pigmentation picture. */
  yellownessDelta: number;
  pigmentation: 'hyperpigmented' | 'hypopigmented' | 'comparable';
  /** Spread of colour within the scar relative to the reference. */
  heterogeneityRatio: number;
  /** How far this can be trusted, given the sample sizes. */
  reliability: 'good' | 'limited' | 'insufficient';
  reliabilityReason?: string;
}

/** Below this many sampled pixels a mean is noise. */
export const MIN_SAMPLE_PIXELS = 200;

/**
 * A perceptible difference. Around 2.3 is the classic just-noticeable
 * difference; below it, a colour change is not something an eye would see and
 * should not be reported as a finding.
 */
export const JND_DELTA_E = 2.3;

/** Difference in a* beyond which a scar reads as genuinely redder. */
export const ERYTHEMA_THRESHOLD = 3;
/** Difference in L* beyond which pigmentation differs meaningfully. */
export const PIGMENT_THRESHOLD = 4;

// ---------------------------------------------------------------------------
// Colour space
// ---------------------------------------------------------------------------

/** sRGB (0–255) to linear light. */
function linearise(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** D65 white point, the one sRGB is defined against. */
const WHITE = { X: 95.047, Y: 100.0, Z: 108.883 };

function f(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** sRGB to CIELAB, via CIEXYZ under D65. */
export function rgbToLab({ r, g, b }: Rgb): Lab {
  const R = linearise(r);
  const G = linearise(g);
  const B = linearise(b);

  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) * 100;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722) * 100;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) * 100;

  const fx = f(X / WHITE.X);
  const fy = f(Y / WHITE.Y);
  const fz = f(Z / WHITE.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIE76 ΔE.
 *
 * The simplest of the ΔE formulae and adequate here: the later CIEDE2000 was
 * developed for small differences in industrial colour matching, and the
 * differences between a scar and neighbouring skin are not small. Using the
 * simple form keeps the number interpretable.
 */
export function deltaE76(p: Lab, q: Lab): number {
  return Math.sqrt((p.L - q.L) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2);
}

// ---------------------------------------------------------------------------
// Sampling
// ---------------------------------------------------------------------------

/**
 * Mean and spread of the pixels a mask selects.
 *
 * `mask` is one byte per pixel, non-zero meaning "inside". Fully transparent
 * pixels are skipped — a photograph composited over transparency would
 * otherwise drag the mean towards black.
 */
export function sampleRegion(
  data: Uint8ClampedArray,
  mask: Uint8Array,
): ColourSample | null {
  let n = 0;
  let sumL = 0;
  let sumA = 0;
  let sumB = 0;
  const labs: Lab[] = [];

  for (let i = 0, p = 0; p < mask.length; i += 4, p++) {
    if (!mask[p]) continue;
    if (data[i + 3] === 0) continue;
    const lab = rgbToLab({ r: data[i], g: data[i + 1], b: data[i + 2] });
    labs.push(lab);
    sumL += lab.L; sumA += lab.a; sumB += lab.b;
    n++;
  }
  if (n === 0) return null;

  const mean = { L: sumL / n, a: sumA / n, b: sumB / n };
  let vL = 0; let vA = 0; let vB = 0;
  for (const l of labs) {
    vL += (l.L - mean.L) ** 2;
    vA += (l.a - mean.a) ** 2;
    vB += (l.b - mean.b) ** 2;
  }
  return {
    mean,
    sd: { L: Math.sqrt(vL / n), a: Math.sqrt(vA / n), b: Math.sqrt(vB / n) },
    pixels: n,
  };
}

/**
 * The scar's colour relative to adjacent normal skin.
 *
 * Both masks must come from the same photograph. Comparing a scar in one
 * photograph against reference skin in another reintroduces every lighting and
 * device difference this design exists to cancel, so the caller is responsible
 * for that and the reliability flag cannot detect it.
 */
export function analyseScarColour(
  data: Uint8ClampedArray,
  scarMask: Uint8Array,
  referenceMask: Uint8Array,
): ScarColourResult | null {
  const scar = sampleRegion(data, scarMask);
  const reference = sampleRegion(data, referenceMask);
  if (!scar || !reference) return null;

  const deltaE = deltaE76(scar.mean, reference.mean);
  const erythemaIndex = scar.mean.a - reference.mean.a;
  const lightnessDelta = scar.mean.L - reference.mean.L;
  const yellownessDelta = scar.mean.b - reference.mean.b;

  let pigmentation: ScarColourResult['pigmentation'] = 'comparable';
  if (lightnessDelta <= -PIGMENT_THRESHOLD) pigmentation = 'hyperpigmented';
  else if (lightnessDelta >= PIGMENT_THRESHOLD) pigmentation = 'hypopigmented';

  // Heterogeneity as a ratio, because a mottled scar on uniformly mottled skin
  // is not a finding. Guarded against a reference with no variation at all.
  const scarSpread = Math.sqrt(scar.sd.L ** 2 + scar.sd.a ** 2 + scar.sd.b ** 2);
  const refSpread = Math.sqrt(reference.sd.L ** 2 + reference.sd.a ** 2 + reference.sd.b ** 2);
  const heterogeneityRatio = refSpread > 0.5
    ? Math.round((scarSpread / refSpread) * 100) / 100
    : 1;

  let reliability: ScarColourResult['reliability'] = 'good';
  let reliabilityReason: string | undefined;
  const smallest = Math.min(scar.pixels, reference.pixels);
  if (smallest < MIN_SAMPLE_PIXELS / 4) {
    reliability = 'insufficient';
    reliabilityReason = `Only ${smallest} pixels in the smaller region; too few for a colour mean.`;
  } else if (smallest < MIN_SAMPLE_PIXELS) {
    reliability = 'limited';
    reliabilityReason = `${smallest} pixels in the smaller region; the mean is noisy.`;
  }

  return {
    scar,
    reference,
    deltaE: round2(deltaE),
    erythemaIndex: round2(erythemaIndex),
    lightnessDelta: round2(lightnessDelta),
    yellownessDelta: round2(yellownessDelta),
    pigmentation,
    heterogeneityRatio,
    reliability,
    reliabilityReason,
  };
}

/**
 * Says in words what the numbers mean, and says nothing when they mean nothing.
 *
 * A ΔE below the just-noticeable difference is not a subtle finding — it is
 * the absence of one, and describing it as "mild erythema" would be inventing
 * a result from measurement noise.
 */
export function describeColour(r: ScarColourResult): string[] {
  const out: string[] = [];

  if (r.reliability === 'insufficient') {
    return ['Regions too small to measure colour reliably. Trace a larger area of scar and of adjacent normal skin.'];
  }

  if (r.deltaE < JND_DELTA_E) {
    out.push('Scar colour is within the just-noticeable difference of adjacent normal skin.');
    return out;
  }

  out.push(`Overall colour difference from adjacent skin: ΔE ${r.deltaE.toFixed(1)}.`);

  if (r.erythemaIndex >= ERYTHEMA_THRESHOLD) {
    out.push(`Photographic erythema index +${r.erythemaIndex.toFixed(1)} — the scar reads redder than neighbouring skin.`);
  } else if (r.erythemaIndex <= -ERYTHEMA_THRESHOLD) {
    out.push(`Photographic erythema index ${r.erythemaIndex.toFixed(1)} — the scar reads less red than neighbouring skin.`);
  }

  if (r.pigmentation === 'hyperpigmented') {
    out.push(`Darker than adjacent skin by ${Math.abs(r.lightnessDelta).toFixed(1)} L* units.`);
  } else if (r.pigmentation === 'hypopigmented') {
    out.push(`Lighter than adjacent skin by ${r.lightnessDelta.toFixed(1)} L* units.`);
  }

  if (r.heterogeneityRatio >= 1.5) {
    out.push(`Colour within the scar is ${r.heterogeneityRatio.toFixed(1)}× as variable as the reference skin.`);
  }

  if (r.reliability === 'limited' && r.reliabilityReason) {
    out.push(`Interpret with caution: ${r.reliabilityReason}`);
  }

  return out;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
