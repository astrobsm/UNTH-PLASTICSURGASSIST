/**
 * Provenance and local clinical-review status for the Clinician Assistant.
 *
 * WHY THIS FILE EXISTS
 * This module asserts things a clinician acts on: that a patient meets sepsis
 * criteria, how fast to replace potassium, what an ECG shows, whether an
 * acid-base picture is compensated. Every one of those is derived from
 * published guidance, but "derived from published guidance" is not "reviewed
 * by a consultant at this institution". Until a named clinician has read the
 * logic and signed it off, users are entitled to know that — and a commit
 * message reaches nobody who uses the module.
 *
 * TO RECORD SIGN-OFF
 *   1. A consultant reviews the logic covered by the digest (run
 *      `node scripts/clinicalContentHash.mjs` to list the exact files).
 *   2. Set `status: 'ratified'`, the reviewer's name and the date.
 *   3. Set `ratifiedContentHash` to the digest that script prints.
 *
 * The hash is what makes the attestation honest over time. If anyone later
 * edits the clinical logic, the digest stops matching, the module reverts to
 * the "not yet reviewed" banner, and `npm run clinical:check` fails. A review
 * cannot silently come to cover code the reviewer never saw.
 *
 * Kept in source rather than the database so the attestation is versioned with
 * the logic it attests to.
 */

export interface EvidenceSource {
  name: string;
  scope: string;
}

export const EVIDENCE_BASIS = {
  /** When the thresholds and logic were last checked against source. */
  lastCheckedISO: '2026-08-09',
  sources: [
    { name: 'Surviving Sepsis Campaign 2021', scope: 'Sepsis and septic shock recognition, the one-hour bundle' },
    { name: 'Sepsis-3 (JAMA 2016)', scope: 'qSOFA and SOFA definitions' },
    { name: 'KDIGO 2012 AKI; KDIGO 2024 CKD', scope: 'Acute kidney injury staging and CKD classification' },
    { name: 'CKD-EPI 2021 (NEJM)', scope: 'Race-free eGFR estimation' },
    { name: 'UK Renal Association / NICE NG29', scope: 'Hyponatraemia and intravenous fluid therapy' },
    { name: 'Joint British Diabetes Societies', scope: 'Diabetic ketoacidosis and hyperosmolar hyperglycaemic state' },
    { name: 'AHA/ACC/HRS ECG standardisation', scope: 'Interval measurement, axis, chamber enlargement, ischaemia criteria' },
    { name: 'BSH guidelines', scope: 'Sickle cell crisis management, transfusion and exchange thresholds' },
    { name: 'ESPEN / ASPEN', scope: 'Nutrition targets in surgical and critically ill patients' },
    { name: 'BAPEN MUST; Braden; Caprini', scope: 'Malnutrition, pressure injury and VTE risk scoring' },
  ] as EvidenceSource[],
} as const;

export type ReviewStatus = 'pending_local_review' | 'ratified';

export interface LocalReview {
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedOnISO?: string;
  /**
   * Digest of the clinical logic reviewed, from scripts/clinicalContentHash.mjs.
   * A ratification without one, or with one that no longer matches, is treated
   * as pending.
   */
  ratifiedContentHash?: string;
  /** Anything the reviewer wants users to know — local formulary limits, etc. */
  note?: string;
}

/**
 * Local clinical review status.
 *
 * Currently PENDING: the logic reflects the sources above but has not been
 * signed off by a consultant at this institution.
 */
export const localReview: LocalReview = {
  status: 'pending_local_review',
  ratifiedContentHash: '',
};

export const isAwaitingClinicalReview = (): boolean =>
  localReview.status !== 'ratified' || !localReview.ratifiedContentHash;

/** One-line summary for banners and PDF footers. */
export function provenanceLine(): string {
  const base = `Decision support. Evidence base last checked ${EVIDENCE_BASIS.lastCheckedISO}.`;
  if (!isAwaitingClinicalReview()) {
    return `${base} Locally ratified${localReview.reviewedBy ? ` by ${localReview.reviewedBy}` : ''}${
      localReview.reviewedOnISO ? ` on ${localReview.reviewedOnISO}` : ''
    }.`;
  }
  return `${base} NOT YET reviewed by a consultant at this institution.`;
}
