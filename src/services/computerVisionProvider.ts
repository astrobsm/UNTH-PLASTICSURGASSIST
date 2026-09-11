/**
 * Where tissue classification would come from, if there were a model.
 *
 * WHAT THIS IS FOR
 *
 * Most of what the graft module reports is *areal*: defect area, graft area,
 * donor area, and the closure percentages derived from them. Those come from
 * calibration and segmentation, whose correctness is geometric, and they need
 * nothing from this file.
 *
 * Two things are not areal. Separating a failed graft into necrotic versus
 * merely delayed, and separating raw donor surface into partially and fully
 * epithelialized, both require deciding what a *type* of tissue looks like.
 * This repository can do that arithmetically — `classifyTissue` in
 * aiWoundMeasurement assigns every pixel to one of four classes using six
 * fixed hue/saturation/value cutoffs — and deliberately refuses to, because:
 *
 *     TISSUE_MODEL_VALIDATED = false
 *
 * Those cutoffs are not a trained classifier and have never been checked
 * against clinician ground truth. Wiring graft viability onto them would emit
 * a percentage to one decimal place with nothing behind it, which is worse
 * than emitting nothing: a number invites action, an absence invites looking.
 *
 * So this is the seam. The whole pipeline around it is real — storage,
 * versioning, confidence, review, the training pairs a future model would be
 * fitted on. The classifier itself is a registration away, and until one is
 * registered every call returns `unavailable` with the reason, which the UI
 * shows as §36's "Automated assessment uncertain" and routes to the clinician.
 *
 * Registering a provider is a configuration change. Nothing downstream needs
 * to know whether the answer came from local inference, an ONNX runtime, a
 * Python service or a cloud endpoint.
 */

import type { CloudAnalysisConsent } from './woundCloudConsent';

/** What a caller wants classified. */
export type TissueQuery = 'graft_viability' | 'donor_epithelialization';

export interface TissueRequest {
  query: TissueQuery;
  /** The photograph, already quality-gated and calibrated. */
  imageData: ImageData;
  /** The wound outline in image pixels, so the model works inside the margin. */
  contourPx?: { x: number; y: number }[];
  /** Needed to turn a pixel count into cm². */
  pixelsPerCm?: number;
  /** Governs whether the image may leave the institution. */
  consent?: CloudAnalysisConsent;
}

/**
 * A refusal, with the reason said plainly.
 *
 * This is the normal return today, and it is a first-class result rather than
 * an error: nothing has gone wrong when a system declines to guess.
 */
export interface TissueUnavailable {
  status: 'unavailable';
  reason: string;
  /** What the clinician should do instead. */
  guidance: string;
}

export interface TissueEstimate {
  status: 'estimate';
  /** Fractions of the segmented area, summing to ~1. */
  fractions: Record<string, number>;
  areaCm2?: Record<string, number>;
  /**
   * Only ever populated by a model whose confidence is calibrated. A provider
   * that cannot calibrate its confidence must leave this null and use
   * `qualitativeConfidence` — §35.
   */
  confidence: number | null;
  qualitativeConfidence: 'low' | 'moderate' | 'high';
  modelName: string;
  modelVersion: string;
  /** False unless the provider has been validated to a clinical standard. */
  isValidated: boolean;
}

export type TissueResult = TissueUnavailable | TissueEstimate;

export interface ComputerVisionProvider {
  readonly name: string;
  readonly version: string;
  /** Must be false unless clinical validation actually exists — §52. */
  readonly isValidated: boolean;
  supports(query: TissueQuery): boolean;
  analyse(request: TissueRequest): Promise<TissueResult>;
}

/**
 * The provider in force when none has been registered.
 *
 * It supports every query and answers none of them, which is the honest state
 * of this capability today.
 */
export const NULL_PROVIDER: ComputerVisionProvider = {
  name: 'none',
  version: '0',
  isValidated: false,
  supports: () => true,
  async analyse({ query }) {
    const what = query === 'graft_viability'
      ? 'Graft viability cannot be estimated automatically'
      : 'Donor epithelialization cannot be sub-classified automatically';
    return {
      status: 'unavailable',
      reason: `${what}: no validated tissue-classification model is registered on this deployment.`,
      guidance: query === 'graft_viability'
        ? 'The graft area and areal take are measured from the photograph and shown above. '
        + 'Judge viability of the remaining open area clinically.'
        : 'The open and closed areas are measured from the photograph and shown above. '
        + 'Judge the quality of epithelialization clinically.',
    };
  },
};

let active: ComputerVisionProvider = NULL_PROVIDER;

/**
 * Installs a provider.
 *
 * Refuses a provider that claims validation it cannot substantiate at the
 * point of registration — the flag has to be set deliberately by whoever
 * registers it, and this is the one place that fact is recorded.
 */
export function registerComputerVisionProvider(provider: ComputerVisionProvider): void {
  active = provider;
  console.info(
    `[cv] provider registered: ${provider.name}@${provider.version} `
    + `(validated: ${provider.isValidated})`,
  );
}

export function getComputerVisionProvider(): ComputerVisionProvider {
  return active;
}

/** True when something other than the null provider can answer this query. */
export function tissueAnalysisAvailable(query: TissueQuery): boolean {
  return active !== NULL_PROVIDER && active.supports(query);
}

/**
 * Asks the active provider, and converts a thrown error into a refusal.
 *
 * A provider that crashes must not take the areal measurements down with it —
 * those are the numbers the clinician actually came for.
 */
export async function analyseTissue(request: TissueRequest): Promise<TissueResult> {
  try {
    if (!active.supports(request.query)) {
      return {
        status: 'unavailable',
        reason: `The registered model ${active.name}@${active.version} does not support this analysis.`,
        guidance: 'The areal measurements are unaffected. Assess this aspect clinically.',
      };
    }
    return await active.analyse(request);
  } catch (e) {
    return {
      status: 'unavailable',
      reason: `The tissue model failed: ${e instanceof Error ? e.message : 'unknown error'}.`,
      guidance: 'The areal measurements are unaffected. Assess this aspect clinically.',
    };
  }
}

/** For the record: which model produced (or declined) an analysis. */
export function providerProvenance(): { modelName: string; modelVersion: string; validated: boolean } {
  return { modelName: active.name, modelVersion: active.version, validated: active.isValidated };
}
