/**
 * Consent gate for sending wound photographs off the institution's systems.
 *
 * WHY THIS EXISTS
 * The GPT-4o vision path uploads a clinical photograph of an identifiable
 * patient's wound to a third party. That was happening automatically whenever
 * the device had connectivity — no prompt, no record, and no way for a clinician
 * to know it had occurred. A wound photograph is protected clinical information,
 * and "we had a network connection" is not a lawful basis for disclosing it.
 *
 * The rule this enforces: on-device analysis is the norm, and the photograph
 * leaves UNTH only when a clinician deliberately asks for it, for a named
 * patient, having been told what that means.
 *
 * Two independent conditions must both hold:
 *
 *   1. Cloud analysis is enabled for the deployment at all. Off unless an
 *      administrator turns it on, so a site that has not agreed a data-processing
 *      position with its third party cannot use it by accident.
 *   2. The clinician granted consent for this specific analysis. Not a
 *      remembered preference and not a session-wide switch — consent that
 *      persists silently is the thing being fixed.
 */

const ENABLED_KEY = 'wound.cloudAnalysis.enabled';

/**
 * Whether this deployment permits cloud analysis at all.
 *
 * Defaults to FALSE. An unset value must never read as permission — that is the
 * failure mode that let photographs leave in the first place.
 */
export function isCloudAnalysisEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    // No storage access (private mode, hardened browser). Fail closed.
    return false;
  }
}

export function setCloudAnalysisEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
  } catch {
    /* Nothing sensible to do; the getter fails closed anyway. */
  }
}

/**
 * A clinician's decision to send one specific photograph.
 *
 * Deliberately not a boolean. A bare `true` travelling through call sites is too
 * easy to default, forward or forget; a token has to be constructed on purpose
 * and names who consented and for whom.
 */
export interface CloudAnalysisConsent {
  readonly grantedBy: string | number;
  readonly patientId: string | number;
  readonly grantedAtISO: string;
}

export function grantCloudAnalysisConsent(
  grantedBy: string | number,
  patientId: string | number,
): CloudAnalysisConsent {
  return { grantedBy, patientId, grantedAtISO: new Date().toISOString() };
}

/**
 * Whether a photograph of this patient may be sent, given this token.
 *
 * The patient check matters: a token minted for one patient must not authorise
 * an upload for the next patient on the ward round, which is exactly what a
 * cached "yes" would do.
 */
export function maySendToCloud(
  consent: CloudAnalysisConsent | undefined,
  patientId: string | number,
): { allowed: boolean; reason?: string } {
  if (!isCloudAnalysisEnabled()) {
    return { allowed: false, reason: 'Cloud analysis is disabled for this deployment.' };
  }
  if (!consent) {
    return { allowed: false, reason: 'No consent was given to send this photograph off-site.' };
  }
  if (String(consent.patientId) !== String(patientId)) {
    return { allowed: false, reason: 'Consent was granted for a different patient.' };
  }
  return { allowed: true };
}

/** Wording shown to the clinician before the photograph is sent. */
export const CLOUD_CONSENT_PROMPT =
  'This sends the wound photograph to an external AI service outside the hospital. ' +
  'It is an identifiable clinical image. Measurements do not require this — they are ' +
  'calculated on this device. Send it only if a second opinion on the wound bed is ' +
  'clinically useful and the patient has agreed. Continue?';
