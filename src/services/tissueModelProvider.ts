/**
 * A real inference adapter for tissue segmentation, against TensorFlow.js.
 *
 * WHY IT SHIPS INERT
 *
 * September 2026: there is no trained model for graft viability or donor-site
 * epithelialization that can honestly be deployed here. The search and its
 * evidence are in docs/TISSUE_MODEL_EVIDENCE.md. In summary — the two research
 * repositories with relevant weights carry no licence at all; the two
 * MIT-licensed Hugging Face uploads have four and ten downloads between them,
 * no model card, no stated dataset and no metrics; MONAI's zoo has no wound
 * bundle; and the best figure in the literature for tissue *proportion* is a
 * mean absolute error of about 14 percentage points, which cannot separate 85%
 * graft take from 99%.
 *
 * So this file is the machinery, complete and tested, with nothing plugged
 * into it. With no model configured it does not register, and the null
 * provider's honest refusal stands. Registering one is configuration — see the
 * environment variables below — not a code change.
 *
 * WHAT A REGISTERED MODEL MUST DECLARE
 *
 * Its name, version, output classes, and whether it has been clinically
 * validated. Undeclared means unvalidated, and unvalidated output is labelled
 * as an AI estimate and given qualitative confidence only, because a softmax
 * peak from an uncalibrated model is not a probability.
 */

import * as tf from '@tensorflow/tfjs';
import type {
  ComputerVisionProvider, TissueRequest, TissueResult, TissueQuery, TissueEstimate,
} from './computerVisionProvider';
import { registerComputerVisionProvider } from './computerVisionProvider';

export interface TissueModelConfig {
  url: string;
  name: string;
  version: string;
  /** Output channel order. Index 0 is conventionally background. */
  classes: string[];
  /** Square edge the model expects. */
  inputSize: number;
  /** A clinical claim. Only true where local validation exists. */
  validated: boolean;
  /** Measured mean absolute error on proportion, in percentage points. */
  maePercentagePoints: number | null;
  /** Which questions this model can answer. */
  supports: TissueQuery[];
}

/**
 * Above this error a proportion cannot support the distinction a clinician is
 * making — 85% take against 99% take — so confidence is reported low however
 * peaked the model's output is.
 */
export const USEFUL_MAE_CEILING_PP = 8;

// ---------------------------------------------------------------------------
// Pure parts, so the arithmetic is testable without a model or a browser.
// ---------------------------------------------------------------------------

/**
 * Per-class pixel fractions from an argmax mask.
 *
 * Restricted to the wound: `inside` marks the pixels within the traced
 * contour. Fractions are of the wound area, not of the photograph, because a
 * graft occupying a tenth of the frame would otherwise read as 90% background.
 * Background is excluded from the denominator for the same reason.
 */
export function maskToFractions(
  mask: Uint8Array | number[],
  classes: string[],
  inside?: Uint8Array,
): Record<string, number> {
  const counts = new Array(classes.length).fill(0);
  let total = 0;
  for (let i = 0; i < mask.length; i++) {
    if (inside && !inside[i]) continue;
    const c = mask[i];
    if (c < 0 || c >= classes.length) continue;
    // Index 0 is background by convention and is not part of the wound.
    if (c === 0) continue;
    counts[c] += 1;
    total += 1;
  }
  const out: Record<string, number> = {};
  for (let c = 1; c < classes.length; c++) {
    out[classes[c]] = total > 0 ? counts[c] / total : 0;
  }
  return out;
}

/** Fractions to cm², given the measured area they are fractions of. */
export function fractionsToAreas(
  fractions: Record<string, number>,
  woundAreaCm2: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(fractions)) {
    out[k] = Math.round(v * woundAreaCm2 * 100) / 100;
  }
  return out;
}

/**
 * How much to trust the number, said in words.
 *
 * Driven by the model's declared error rather than by its softmax, because an
 * uncalibrated network is confidently wrong as readily as confidently right.
 * A model that has not declared an error is treated as unknown, which is low.
 */
export function qualitativeConfidence(
  cfg: Pick<TissueModelConfig, 'validated' | 'maePercentagePoints'>,
): 'low' | 'moderate' | 'high' {
  const mae = cfg.maePercentagePoints;
  if (mae == null) return 'low';
  if (!cfg.validated) return mae <= USEFUL_MAE_CEILING_PP ? 'moderate' : 'low';
  return mae <= USEFUL_MAE_CEILING_PP ? 'high' : 'moderate';
}

/** Reads the deployment's declaration. Returns null when none is configured. */
export function configFromEnv(env: Record<string, string | undefined>): TissueModelConfig | null {
  const url = (env.VITE_TISSUE_MODEL_URL || '').trim();
  if (!url) return null;

  const classes = (env.VITE_TISSUE_MODEL_CLASSES || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (classes.length < 2) {
    console.warn('[tissue] VITE_TISSUE_MODEL_URL is set but VITE_TISSUE_MODEL_CLASSES '
      + 'does not list at least a background and one tissue class; not registering.');
    return null;
  }

  const mae = Number(env.VITE_TISSUE_MODEL_MAE_PP);
  const supports = (env.VITE_TISSUE_MODEL_SUPPORTS || 'graft_viability,donor_epithelialization')
    .split(',').map((s) => s.trim()).filter(Boolean) as TissueQuery[];

  return {
    url,
    name: env.VITE_TISSUE_MODEL_NAME || 'unnamed-tissue-model',
    version: env.VITE_TISSUE_MODEL_VERSION || '0',
    classes,
    inputSize: Number(env.VITE_TISSUE_MODEL_INPUT) || 512,
    // Anything but an explicit 'true' is unvalidated. Validation is a claim
    // that has to be made deliberately.
    validated: String(env.VITE_TISSUE_MODEL_VALIDATED || '').toLowerCase() === 'true',
    maePercentagePoints: Number.isFinite(mae) ? mae : null,
    supports,
  };
}

// ---------------------------------------------------------------------------
// The provider
// ---------------------------------------------------------------------------

export class TfjsTissueProvider implements ComputerVisionProvider {
  readonly name: string;
  readonly version: string;
  readonly isValidated: boolean;

  private cfg: TissueModelConfig;
  private model: tf.GraphModel | tf.LayersModel | null = null;
  private loading: Promise<void> | null = null;

  constructor(cfg: TissueModelConfig) {
    this.cfg = cfg;
    this.name = cfg.name;
    this.version = cfg.version;
    this.isValidated = cfg.validated;
  }

  supports(query: TissueQuery): boolean {
    return this.cfg.supports.includes(query);
  }

  /** Graph model first, layers model second — either export is accepted. */
  private async load(): Promise<void> {
    if (this.model) return;
    if (!this.loading) {
      this.loading = (async () => {
        try {
          this.model = await tf.loadGraphModel(this.cfg.url);
        } catch {
          this.model = await tf.loadLayersModel(this.cfg.url);
        }
      })();
    }
    await this.loading;
  }

  async analyse(request: TissueRequest): Promise<TissueResult> {
    const { imageData, contourPx, pixelsPerCm } = request;
    await this.load();
    if (!this.model) {
      return {
        status: 'unavailable',
        reason: `The tissue model ${this.name}@${this.version} could not be loaded.`,
        guidance: 'The areal measurements are unaffected. Assess this aspect clinically.',
      };
    }

    const size = this.cfg.inputSize;

    // Inference, with every intermediate tensor disposed. A leak here would
    // accumulate across a ward round until the tab was killed.
    const argmax = tf.tidy(() => {
      const input = tf.browser.fromPixels(imageData)
        .resizeBilinear([size, size])
        .toFloat()
        .div(255)
        .expandDims(0);
      const out = this.model instanceof tf.GraphModel
        ? this.model.predict(input) as tf.Tensor
        : (this.model as tf.LayersModel).predict(input) as tf.Tensor;
      // [1,h,w,c] -> [h,w]
      return out.squeeze([0]).argMax(-1) as tf.Tensor2D;
    });

    let mask: Uint8Array;
    try {
      mask = Uint8Array.from(await argmax.data());
    } finally {
      argmax.dispose();
    }

    // Restrict to the traced wound, so surrounding skin cannot dilute the
    // proportion. Without a contour the whole frame is used and the caller is
    // told, because that is a materially weaker answer.
    const inside = contourPx?.length
      ? rasterisePolygon(contourPx, imageData.width, imageData.height, size)
      : undefined;

    const fractions = maskToFractions(mask, this.cfg.classes, inside);

    const woundAreaCm2 = contourPx?.length && pixelsPerCm
      ? polygonAreaPx(contourPx) / (pixelsPerCm * pixelsPerCm)
      : null;

    const estimate: TissueEstimate = {
      status: 'estimate',
      fractions,
      areaCm2: woundAreaCm2 != null ? fractionsToAreas(fractions, woundAreaCm2) : undefined,
      // Only a model that has been calibrated may publish a number here; an
      // uncalibrated softmax peak is not a probability. See §35.
      confidence: null,
      qualitativeConfidence: qualitativeConfidence(this.cfg),
      modelName: this.name,
      modelVersion: this.version,
      isValidated: this.cfg.validated,
    };
    return estimate;
  }
}

// ---------------------------------------------------------------------------

/** Even-odd fill of the contour, at the model's resolution. */
export function rasterisePolygon(
  contourPx: { x: number; y: number }[],
  imageWidth: number,
  imageHeight: number,
  size: number,
): Uint8Array {
  const out = new Uint8Array(size * size);
  if (contourPx.length < 3) return out;
  const sx = size / imageWidth;
  const sy = size / imageHeight;
  const pts = contourPx.map((p) => ({ x: p.x * sx, y: p.y * sy }));

  for (let y = 0; y < size; y++) {
    const cy = y + 0.5;
    const xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if ((a.y > cy) !== (b.y > cy)) {
        xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.max(0, Math.ceil(xs[k] - 0.5));
      const to = Math.min(size - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = from; x <= to; x++) out[y * size + x] = 1;
    }
  }
  return out;
}

/** Shoelace, in pixels. */
export function polygonAreaPx(pts: { x: number; y: number }[]): number {
  if (pts.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Registers a model if the deployment has declared one.
 *
 * Called once at start-up. With nothing configured it does nothing at all, and
 * the null provider continues to refuse — which is the correct behaviour today
 * and the reason this returns a boolean rather than throwing.
 */
export function initTissueModelFromEnv(
  env: Record<string, string | undefined> = (import.meta as unknown as {
    env: Record<string, string | undefined>;
  }).env,
): boolean {
  const cfg = configFromEnv(env || {});
  if (!cfg) return false;

  registerComputerVisionProvider(new TfjsTissueProvider(cfg));
  if (!cfg.validated) {
    console.warn(
      `[tissue] ${cfg.name}@${cfg.version} is registered but NOT declared clinically `
      + 'validated. Its output will be labelled an AI estimate throughout.',
    );
  }
  if (cfg.maePercentagePoints != null && cfg.maePercentagePoints > USEFUL_MAE_CEILING_PP) {
    console.warn(
      `[tissue] declared error is ±${cfg.maePercentagePoints} percentage points, above the `
      + `${USEFUL_MAE_CEILING_PP}pp at which a proportion stops being clinically decisive.`,
    );
  }
  return true;
}

export default TfjsTissueProvider;
