/**
 * Guideline provenance and local clinical-review status for the Tumour Board.
 *
 * WHY THIS FILE EXISTS
 * The module's treatment logic is derived from published guidance, but "derived
 * from published guidance" is not the same as "reviewed by an oncologist at this
 * institution". Until a named clinician has read it and signed it off, users are
 * entitled to know that. Recording it in a commit message reaches no one who
 * actually uses the module; a banner sourced from this file reaches everyone.
 *
 * TO RECORD SIGN-OFF
 *   1. An oncologist reviews the logic covered by the digest (run
 *      `node scripts/clinicalContentHash.mjs` to list the exact files).
 *   2. Set `status: 'ratified'`, the reviewer's name and the date.
 *   3. Set `ratifiedContentHash` to the digest that script prints.
 *
 * The banner disappears automatically. Kept in source, not the database, so the
 * attestation is versioned with the logic it attests to — a review is only
 * meaningful against the exact content that was reviewed.
 *
 * The hash is what keeps that true over time. If anyone later edits the staging
 * or treatment logic, the digest stops matching, the module reverts to the "not
 * yet reviewed" banner, and `npm run clinical:check` fails. A sign-off cannot
 * silently come to cover code the reviewer never saw.
 */

export interface GuidelineSource {
  name: string;
  scope: string;
}

/** Editions the staging and planning logic currently implements. */
export const GUIDELINE_BASIS = {
  stagingSystem: 'AJCC 8th edition (2018)',
  /** When the edition currency and treatment logic were last checked against source. */
  lastCheckedISO: '2026-07-31',
  sources: [
    { name: 'AJCC Cancer Staging Manual, 8th edition', scope: 'Ch. 15 cutaneous carcinoma, Ch. 39-41 soft tissue sarcoma, Ch. 46 Merkel cell, Ch. 47 cutaneous melanoma' },
    { name: 'NCCN Clinical Practice Guidelines', scope: 'Melanoma: Cutaneous; Squamous Cell Skin Cancer; Basal Cell Skin Cancer; Merkel Cell Carcinoma; Soft Tissue Sarcoma' },
    { name: 'ESMO Clinical Practice Guidelines', scope: 'Cutaneous melanoma, cSCC, Merkel cell; ESMO-EURACAN for sarcoma' },
    { name: 'WHO Classification of Soft Tissue and Bone Tumours, 5th ed', scope: 'Sarcoma subtyping and FNCLCC grading' },
    { name: 'NADINA (NEJM 2024); SWOG S1801', scope: 'Neoadjuvant immunotherapy before dissection in macroscopic stage III melanoma' },
    { name: 'MSLT-II; DeCOG-SLT', scope: 'Nodal ultrasound surveillance in place of completion lymph node dissection' },
    { name: 'KEYNOTE-716; CheckMate 76K', scope: 'Adjuvant anti-PD-1 in resected stage IIB/IIC melanoma' },
    { name: 'STRASS', scope: 'Preoperative radiotherapy in retroperitoneal sarcoma' },
  ] as GuidelineSource[],
} as const;

export type ReviewStatus = 'pending_local_review' | 'ratified';

export interface LocalReview {
  status: ReviewStatus;
  /** Named clinician who reviewed the treatment logic. */
  reviewedBy?: string;
  reviewedOnISO?: string;
  /**
   * Digest of the clinical logic reviewed, from scripts/clinicalContentHash.mjs.
   * A ratification without one, or with one that no longer matches, is treated
   * as pending.
   */
  ratifiedContentHash?: string;
  /** Anything the reviewer wants users to know (local formulary limits, etc.). */
  note?: string;
}

/**
 * Local clinical review status.
 *
 * Currently PENDING: the logic reflects the sources above but has not been
 * signed off by an oncologist at this institution.
 */
export const localReview: LocalReview = {
  status: 'pending_local_review',
  ratifiedContentHash: '',
};

// A ratification with no digest cannot be verified against anything, so it does
// not count as reviewed. The staleness check itself lives in the test suite,
// which can read the source tree; the browser cannot.
export const isAwaitingClinicalReview = (): boolean =>
  localReview.status !== 'ratified' || !localReview.ratifiedContentHash;

/** One-line summary for banners and PDF footers. */
export function provenanceLine(): string {
  const base = `Staging: ${GUIDELINE_BASIS.stagingSystem}. Guidance last checked ${GUIDELINE_BASIS.lastCheckedISO}.`;
  if (!isAwaitingClinicalReview()) {
    return `${base} Locally ratified${localReview.reviewedBy ? ` by ${localReview.reviewedBy}` : ''}${
      localReview.reviewedOnISO ? ` on ${localReview.reviewedOnISO}` : ''
    }.`;
  }
  return `${base} NOT YET reviewed by an oncologist at this institution.`;
}
