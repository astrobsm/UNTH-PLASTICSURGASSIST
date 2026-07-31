/**
 * Oncology staging engine — AJCC 8th edition.
 *
 * Pure functions, no I/O, so the whole thing is unit-testable without a DB or a
 * browser. Every other Tumor Board output (management plan, referral letters,
 * surveillance schedule, counselling) is derived from the StageResult this
 * module produces, so correctness here is load-bearing.
 *
 * EDITION NOTE — checked July 2026: AJCC Version 9 has rolled out for brain and
 * spinal cord, cervix uteri, neuroendocrine tumours, lung, thymus and several
 * head & neck sites. Cutaneous melanoma, cutaneous carcinoma, Merkel cell
 * carcinoma and soft tissue sarcoma are ALL still staged by the 8th edition.
 * Callers must persist `stagingSystem` alongside the result so that a case
 * staged today remains interpretable after a future edition lands, and so the
 * migration can be done site-by-site rather than in one breaking change.
 * https://www.facs.org/quality-programs/cancer-programs/american-joint-committee-on-cancer/version-9/
 *
 * SCOPE — this computes stage. It does not decide treatment. The plan builder
 * consumes these results and always presents its output as a draft for the
 * tumour board to ratify.
 */

export const STAGING_SYSTEM = 'AJCC 8th edition (2018)';

// ── Tumour families this module can stage ────────────────────────────────
export type TumorFamily =
  | 'cutaneous_melanoma'
  | 'cutaneous_scc'
  | 'cutaneous_bcc'
  | 'merkel_cell'
  | 'soft_tissue_sarcoma';

export type StagingBasis = 'clinical' | 'pathological' | 'post_neoadjuvant' | 'restaging';

export type SarcomaSite = 'trunk_extremity' | 'retroperitoneal' | 'head_neck' | 'viscera';

/** FNCLCC grade — the grading system AJCC uses for soft tissue sarcoma. */
export type SarcomaGrade = 'G1' | 'G2' | 'G3' | 'GX';

export interface StageResult {
  /** e.g. "T2b", "N1a", "M1c(1)" */
  T: string;
  N: string;
  M: string;
  /** e.g. "IIIB", "IV", or 'Not assignable' where AJCC publishes no grouping. */
  stageGroup: string;
  stageDescription: string;
  stagingSystem: string;
  basis: StagingBasis;
  /** Prefix convention: c = clinical, p = pathological, yp = post-neoadjuvant. */
  prefix: 'c' | 'p' | 'yp';
  /** Full formatted stage, e.g. "pT3b pN2a cM0 — Stage IIIC". */
  formatted: string;
  /** Anything that materially limits the result — shown prominently in the UI. */
  caveats: string[];
}

// ─────────────────────────────────────────────────────────────────────────
// Shared input
// ─────────────────────────────────────────────────────────────────────────

export interface StagingInput {
  family: TumorFamily;
  basis: StagingBasis;

  // ── Primary tumour ──
  /** Greatest clinical/radiological dimension in cm. */
  sizeCm?: number | null;
  /** Melanoma: Breslow thickness in mm. */
  breslowMm?: number | null;
  /** Melanoma / cSCC: ulceration present. */
  ulceration?: boolean;
  /** cSCC: depth of invasion > 6 mm or beyond subcutaneous fat. */
  deepInvasion?: boolean;
  /** cSCC / any: perineural invasion. */
  perineuralInvasion?: boolean;
  /** In-situ / non-invasive disease only. */
  inSitu?: boolean;
  /** No evidence of primary (e.g. regressed melanoma, unknown primary). */
  noPrimary?: boolean;

  // ── Local extension ──
  boneErosionMinor?: boolean;
  boneInvasionCortical?: boolean;
  skullBaseInvasion?: boolean;
  /** Sarcoma T4b-equivalent structures / MCC fascia-muscle-cartilage-bone. */
  invadesDeepStructures?: boolean;

  // ── Regional nodes ──
  nodesInvolved?: number;
  /** Detected by sentinel node biopsy / occult on imaging and examination. */
  nodesClinicallyOccult?: boolean;
  /** Clinically or radiologically detected (macroscopic) nodal disease. */
  nodesClinicallyDetected?: boolean;
  mattedNodes?: boolean;
  /** Extranodal extension — drives N3b in cutaneous carcinoma. */
  extranodalExtension?: boolean;
  largestNodeCm?: number | null;
  contralateralOrBilateralNodes?: boolean;
  /** Melanoma / MCC: microsatellite, satellite or in-transit metastases. */
  inTransitOrSatellite?: boolean;

  // ── Distant disease ──
  distantMets?: boolean;
  metSites?: Array<'skin_soft_tissue_nodal' | 'lung' | 'visceral_non_cns' | 'cns' | 'bone'>;
  /** Melanoma M-suffix: elevated LDH. */
  ldhElevated?: boolean | null;

  // ── Sarcoma-specific ──
  sarcomaSite?: SarcomaSite;
  grade?: SarcomaGrade;

  /** Histology is often pending at first presentation — see caveat handling. */
  histologyAvailable?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const prefixFor = (basis: StagingBasis): 'c' | 'p' | 'yp' => {
  if (basis === 'pathological') return 'p';
  if (basis === 'post_neoadjuvant') return 'yp';
  return 'c';
};

function buildM(input: StagingInput, family: TumorFamily): string {
  if (!input.distantMets) return 'M0';
  const sites = input.metSites || [];

  if (family === 'cutaneous_melanoma') {
    let m = 'M1a';
    if (sites.includes('cns')) m = 'M1d';
    else if (sites.includes('visceral_non_cns') || sites.includes('bone')) m = 'M1c';
    else if (sites.includes('lung')) m = 'M1b';
    // LDH suffix: (0) not elevated, (1) elevated. Omitted when LDH unknown —
    // recording a false (0) would understate risk.
    if (input.ldhElevated === true) return `${m}(1)`;
    if (input.ldhElevated === false) return `${m}(0)`;
    return m;
  }

  if (family === 'merkel_cell') {
    if (sites.includes('lung')) return 'M1b';
    if (sites.includes('visceral_non_cns') || sites.includes('cns') || sites.includes('bone')) return 'M1c';
    return 'M1a';
  }

  return 'M1';
}

// ─────────────────────────────────────────────────────────────────────────
// Cutaneous melanoma — AJCC 8th, Chapter 47
// ─────────────────────────────────────────────────────────────────────────

export function stageMelanomaT(input: StagingInput): string {
  if (input.noPrimary) return 'T0';
  if (input.inSitu) return 'Tis';

  const b = input.breslowMm;
  if (b === null || b === undefined || Number.isNaN(b)) return 'TX';

  const ulc = !!input.ulceration;

  if (b <= 1.0) {
    // T1a is the ONLY sub-1mm category that requires both <0.8mm AND no
    // ulceration. 0.8-1.0mm is T1b regardless of ulceration — a distinction that
    // decides whether sentinel node biopsy is discussed at all.
    if (b < 0.8 && !ulc) return 'T1a';
    return 'T1b';
  }
  if (b <= 2.0) return ulc ? 'T2b' : 'T2a';
  if (b <= 4.0) return ulc ? 'T3b' : 'T3a';
  return ulc ? 'T4b' : 'T4a';
}

export function stageMelanomaN(input: StagingInput): string {
  const n = input.nodesInvolved ?? 0;
  const inTransit = !!input.inTransitOrSatellite;
  const detected = !!input.nodesClinicallyDetected;
  const matted = !!input.mattedNodes;

  if (n === 0 && !inTransit) return 'N0';
  // N1c/N2c/N3c encode in-transit, satellite or microsatellite disease, graded
  // by how many nodes accompany it.
  if (n === 0 && inTransit) return 'N1c';

  if (n === 1) {
    if (inTransit) return 'N2c';
    return detected ? 'N1b' : 'N1a';
  }
  if (n <= 3) {
    if (inTransit) return 'N3c';
    return detected ? 'N2b' : 'N2a';
  }
  // >= 4 nodes, or matted
  if (inTransit) return 'N3c';
  return detected || matted ? 'N3b' : 'N3a';
}

/** AJCC 8th pathological stage groups for cutaneous melanoma. */
function melanomaStageGroup(T: string, N: string, M: string, basis: StagingBasis): string {
  if (M !== 'M0') return 'IV';
  if (T === 'Tis') return '0';
  if (T === 'TX') return 'Not assignable';

  const nodeNeg = N === 'N0';

  if (nodeNeg) {
    // Clinical and pathological groupings diverge at T1b: clinically T1b N0 is
    // Stage IB, pathologically it is Stage IA.
    if (T === 'T1a') return 'IA';
    if (T === 'T1b') return basis === 'clinical' ? 'IB' : 'IA';
    if (T === 'T2a') return 'IB';
    if (T === 'T2b' || T === 'T3a') return 'IIA';
    if (T === 'T3b' || T === 'T4a') return 'IIB';
    if (T === 'T4b') return 'IIC';
    return 'Not assignable';
  }

  // Node-positive. Clinical staging does not subdivide stage III.
  if (basis === 'clinical') return 'III';

  const tLow = ['T0', 'T1a', 'T1b', 'T2a'].includes(T);
  const tMid = ['T2b', 'T3a'].includes(T);
  const tHigh = ['T3b', 'T4a'].includes(T);
  const t4b = T === 'T4b';

  if (t4b) return ['N3a', 'N3b', 'N3c'].includes(N) ? 'IIID' : 'IIIC';
  if (tHigh) return 'IIIC';

  if (tLow) {
    if (['N1a', 'N2a'].includes(N)) return T === 'T0' ? 'IIIB' : 'IIIA';
    if (['N1b', 'N1c', 'N2b'].includes(N)) return 'IIIB';
    return 'IIIC'; // N2c, N3a/b/c
  }

  if (tMid) {
    if (['N1a', 'N1b', 'N1c', 'N2a', 'N2b'].includes(N)) return 'IIIB';
    return 'IIIC';
  }

  return 'IIIC';
}

// ─────────────────────────────────────────────────────────────────────────
// Cutaneous carcinoma (SCC / BCC) — AJCC 8th, Chapter 15
//
// NOTE: AJCC's cutaneous carcinoma chapter is validated for HEAD AND NECK
// primaries. Trunk and extremity cutaneous carcinoma has no AJCC staging
// system; those are risk-stratified (NCCN low/high/very-high) instead. This is
// surfaced as a caveat rather than silently producing a stage that does not
// exist.
// ─────────────────────────────────────────────────────────────────────────

export function stageCutaneousCarcinomaT(input: StagingInput): string {
  if (input.inSitu) return 'Tis';
  if (input.skullBaseInvasion) return 'T4b';
  if (input.boneInvasionCortical) return 'T4a';

  const size = input.sizeCm;
  // T3 is reached by size OR by any one of these adverse local features, so a
  // small tumour with perineural invasion is still T3.
  const t3Feature = !!input.deepInvasion || !!input.perineuralInvasion || !!input.boneErosionMinor;

  if (size === null || size === undefined || Number.isNaN(size)) {
    return t3Feature ? 'T3' : 'TX';
  }
  if (size >= 4 || t3Feature) return 'T3';
  if (size >= 2) return 'T2';
  return 'T1';
}

export function stageCutaneousCarcinomaN(input: StagingInput): string {
  const n = input.nodesInvolved ?? 0;
  if (n === 0) return 'N0';

  // Extranodal extension overrides size and number — it is N3b however small.
  if (input.extranodalExtension) return 'N3b';

  const size = input.largestNodeCm ?? 0;
  if (size > 6) return 'N3a';
  if (input.contralateralOrBilateralNodes) return 'N2c';
  if (n > 1) return 'N2b';
  if (size > 3) return 'N2a';
  return 'N1';
}

function cutaneousCarcinomaStageGroup(T: string, N: string, M: string): string {
  if (M !== 'M0') return 'IVC';
  if (T === 'Tis') return '0';
  if (T === 'TX') return 'Not assignable';

  if (T === 'T4b' || N === 'N3a' || N === 'N3b') return 'IVB';

  const t123 = ['T1', 'T2', 'T3'].includes(T);
  if (N === 'N2a' || N === 'N2b' || N === 'N2c') return 'IVA';
  if (T === 'T4a') return 'IVA';
  if (N === 'N1') return t123 ? 'III' : 'IVA';

  // N0
  if (T === 'T1') return 'I';
  if (T === 'T2') return 'II';
  if (T === 'T3') return 'III';
  return 'Not assignable';
}

// ─────────────────────────────────────────────────────────────────────────
// Merkel cell carcinoma — AJCC 8th, Chapter 46
// ─────────────────────────────────────────────────────────────────────────

export function stageMerkelT(input: StagingInput): string {
  if (input.noPrimary) return 'T0';
  if (input.inSitu) return 'Tis';
  if (input.invadesDeepStructures) return 'T4';

  const size = input.sizeCm;
  if (size === null || size === undefined || Number.isNaN(size)) return 'TX';
  if (size > 5) return 'T3';
  if (size > 2) return 'T2';
  return 'T1';
}

export function stageMerkelN(input: StagingInput): string {
  const n = input.nodesInvolved ?? 0;
  const inTransit = !!input.inTransitOrSatellite;

  if (inTransit) return n > 0 ? 'N3' : 'N2';
  if (n === 0) return 'N0';
  if (input.nodesClinicallyDetected) return 'N1b';
  return 'N1a';
}

function merkelStageGroup(T: string, N: string, M: string): string {
  if (M !== 'M0') return 'IV';
  if (T === 'Tis') return '0';
  if (T === 'TX') return 'Not assignable';

  if (N === 'N0') {
    if (T === 'T1') return 'I';
    if (T === 'T2' || T === 'T3') return 'IIA';
    if (T === 'T4') return 'IIB';
    return 'Not assignable';
  }

  // Occult nodal disease carries a materially better prognosis than macroscopic
  // disease, which is why IIIA and IIIB split on how the node was found.
  if (N === 'N1a') return T === 'T0' ? 'IIIA' : 'IIIA';
  if (N === 'N1b' && T === 'T0') return 'IIIA';
  return 'IIIB';
}

// ─────────────────────────────────────────────────────────────────────────
// Soft tissue sarcoma — AJCC 8th, Chapters 39-41
// ─────────────────────────────────────────────────────────────────────────

export function stageSarcomaT(input: StagingInput): string {
  const size = input.sizeCm;
  const site = input.sarcomaSite || 'trunk_extremity';

  if (site === 'head_neck') {
    if (input.skullBaseInvasion) return 'T4b';
    if (input.invadesDeepStructures) return 'T4a';
    if (size === null || size === undefined || Number.isNaN(size)) return 'TX';
    if (size > 4) return 'T3';
    if (size > 2) return 'T2';
    return 'T1';
  }

  // Trunk/extremity and retroperitoneal share size-only T categories.
  if (size === null || size === undefined || Number.isNaN(size)) return 'TX';
  if (size > 15) return 'T4';
  if (size > 10) return 'T3';
  if (size > 5) return 'T2';
  return 'T1';
}

export function stageSarcomaN(input: StagingInput): string {
  return (input.nodesInvolved ?? 0) > 0 ? 'N1' : 'N0';
}

function sarcomaStageGroup(T: string, N: string, M: string, grade: SarcomaGrade, site: SarcomaSite): string {
  // AJCC publishes no stage grouping for head & neck or visceral sarcoma.
  if (site === 'head_neck' || site === 'viscera') return 'Not assignable';

  if (M !== 'M0') return 'IV';
  // Regional nodal disease in extremity/trunk and retroperitoneal sarcoma is
  // Stage IV in the 8th edition even without distant metastases — a frequent
  // source of under-staging.
  if (N === 'N1') return 'IV';
  if (T === 'TX') return 'Not assignable';

  const lowGrade = grade === 'G1' || grade === 'GX';
  if (lowGrade) return T === 'T1' ? 'IA' : 'IB';

  if (T === 'T1') return 'II';
  if (T === 'T2') return 'IIIA';
  return 'IIIB'; // T3, T4
}

// ─────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────

const STAGE_DESCRIPTIONS: Record<string, string> = {
  '0': 'In situ disease — no invasion beyond the epidermis/basement membrane.',
  IA: 'Early localised disease with the most favourable prognosis.',
  IB: 'Early localised disease with one adverse feature.',
  II: 'Localised disease with intermediate-risk features.',
  IIA: 'Localised disease, intermediate risk.',
  IIB: 'Localised disease, high risk despite node-negative status.',
  IIC: 'Localised disease with the highest node-negative risk.',
  III: 'Regional disease — spread to regional lymph nodes and/or in-transit sites.',
  IIIA: 'Regional disease with low-volume, clinically occult nodal involvement.',
  IIIB: 'Regional disease with clinically detected or multi-site nodal involvement.',
  IIIC: 'Extensive regional disease.',
  IIID: 'Most advanced regional disease with a thick ulcerated primary.',
  IVA: 'Advanced locoregional disease.',
  IVB: 'Very advanced locoregional disease.',
  IVC: 'Distant metastatic disease.',
  IV: 'Distant metastatic disease.',
  'Not assignable': 'AJCC does not publish a stage grouping for this combination.',
};

export function computeStage(input: StagingInput): StageResult {
  const caveats: string[] = [];
  const basis = input.basis;
  const prefix = prefixFor(basis);

  let T = 'TX';
  let N = 'NX';
  let stageGroup = 'Not assignable';
  const M = buildM(input, input.family);

  switch (input.family) {
    case 'cutaneous_melanoma': {
      T = stageMelanomaT(input);
      N = stageMelanomaN(input);
      stageGroup = melanomaStageGroup(T, N, M, basis);
      if (T === 'TX') caveats.push('Breslow thickness not recorded — T category cannot be assigned.');
      if (basis === 'clinical' && stageGroup === 'III') {
        caveats.push('Clinical staging does not subdivide Stage III; sub-stage requires pathological nodal data.');
      }
      if (input.distantMets && input.ldhElevated === null) {
        caveats.push('Serum LDH not recorded — the M-category suffix is required for full AJCC M staging.');
      }
      break;
    }
    case 'cutaneous_scc':
    case 'cutaneous_bcc': {
      T = stageCutaneousCarcinomaT(input);
      N = stageCutaneousCarcinomaN(input);
      stageGroup = cutaneousCarcinomaStageGroup(T, N, M);
      caveats.push(
        'AJCC cutaneous carcinoma staging is validated for HEAD AND NECK primaries. ' +
          'For trunk or extremity primaries, use NCCN low/high/very-high risk stratification instead of this stage group.'
      );
      if (input.family === 'cutaneous_bcc') {
        caveats.push(
          'Basal cell carcinoma is managed primarily by NCCN risk stratification, not TNM. ' +
            'The stage group is shown for completeness in advanced/destructive disease only.'
        );
      }
      break;
    }
    case 'merkel_cell': {
      T = stageMerkelT(input);
      N = stageMerkelN(input);
      stageGroup = merkelStageGroup(T, N, M);
      if (N === 'N0' && !input.nodesClinicallyOccult && basis === 'clinical') {
        caveats.push(
          'Merkel cell carcinoma has a high occult nodal rate — sentinel lymph node biopsy is recommended ' +
            'in all clinically node-negative patients before accepting N0.'
        );
      }
      break;
    }
    case 'soft_tissue_sarcoma': {
      const site = input.sarcomaSite || 'trunk_extremity';
      const grade = input.grade || 'GX';
      T = stageSarcomaT(input);
      N = stageSarcomaN(input);
      stageGroup = sarcomaStageGroup(T, N, M, grade, site);
      if (grade === 'GX') {
        caveats.push('FNCLCC grade not available — stage assumes low grade; re-stage when grading is reported.');
      }
      if (site === 'head_neck' || site === 'viscera') {
        caveats.push(`AJCC 8th edition publishes no stage grouping for ${site.replace('_', ' & ')} sarcoma.`);
      }
      if (N === 'N1' && M === 'M0') {
        caveats.push('Regional nodal involvement in soft tissue sarcoma is classified Stage IV in AJCC 8th edition.');
      }
      break;
    }
  }

  if (input.histologyAvailable === false) {
    caveats.push(
      'Histology pending — this is a provisional stage. Re-stage and re-record once the pathology report is available.'
    );
  }

  const formatted = `${prefix}${T} ${prefix}${N} ${M} — Stage ${stageGroup}`;

  return {
    T,
    N,
    M,
    stageGroup,
    stageDescription: STAGE_DESCRIPTIONS[stageGroup] || '',
    stagingSystem: STAGING_SYSTEM,
    basis,
    prefix,
    formatted,
    caveats,
  };
}

/** Convenience predicates used by the plan and surveillance builders. */
export const isNodePositive = (r: StageResult): boolean => r.N !== 'N0' && r.N !== 'NX';
export const isMetastatic = (r: StageResult): boolean => r.M !== 'M0';
export const isInSitu = (r: StageResult): boolean => r.T === 'Tis';
