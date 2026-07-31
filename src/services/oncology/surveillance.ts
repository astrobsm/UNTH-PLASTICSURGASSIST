/**
 * Treatment monitoring and post-treatment surveillance scheduling.
 *
 * Produces concrete, dated follow-up items rather than prose, so the schedule
 * can be persisted, tracked to completion, and surfaced as overdue.
 *
 * Intervals follow NCCN follow-up tables for each site (verified July 2026) and
 * ESMO equivalents. Where guidelines give a range (for example "every 3-6
 * months"), the shorter interval is used for higher-stage disease.
 */

import type { StageResult, TumorFamily } from './stagingEngine';
import { isMetastatic, isNodePositive } from './stagingEngine';

export type SurveillanceCategory =
  | 'clinical_review'
  | 'skin_examination'
  | 'nodal_ultrasound'
  | 'cross_sectional_imaging'
  | 'chest_imaging'
  | 'primary_site_imaging'
  | 'bloods'
  | 'toxicity_review';

export interface SurveillanceItem {
  category: SurveillanceCategory;
  title: string;
  detail: string;
  /** Months from the index date at which this is due. */
  dueMonth: number;
  dueDate: string;
  /** Phase label for grouping in the UI, e.g. "Year 1-2". */
  phase: string;
  basis: string;
}

export interface SurveillancePlan {
  items: SurveillanceItem[];
  narrative: string;
  durationYears: number;
  basis: string;
}

const addMonths = (from: Date, months: number): string => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};

const phaseFor = (month: number): string => {
  if (month <= 24) return 'Year 1-2';
  if (month <= 60) return 'Year 3-5';
  return 'Year 5+';
};

/** Expand an interval into due months across a window. */
function series(startMonth: number, endMonth: number, intervalMonths: number): number[] {
  const out: number[] = [];
  for (let m = startMonth; m <= endMonth; m += intervalMonths) out.push(m);
  return out;
}

interface SurveillanceContext {
  family: TumorFamily;
  stage: StageResult;
  /** Date treatment completed (or diagnosis date if not yet treated). */
  indexDate?: string;
  sentinelNodeDone?: boolean;
  grade?: string;
}

export function buildSurveillancePlan(ctx: SurveillanceContext): SurveillancePlan {
  const index = ctx.indexDate ? new Date(ctx.indexDate) : new Date();
  const items: SurveillanceItem[] = [];
  const nodePos = isNodePositive(ctx.stage);
  const metastatic = isMetastatic(ctx.stage);
  const stage = ctx.stage.stageGroup;

  const push = (
    category: SurveillanceCategory,
    title: string,
    detail: string,
    months: number[],
    basis: string
  ) => {
    for (const m of months) {
      items.push({
        category,
        title,
        detail,
        dueMonth: m,
        dueDate: addMonths(index, m),
        phase: phaseFor(m),
        basis,
      });
    }
  };

  let narrative = '';
  let durationYears = 5;
  let basis = '';

  switch (ctx.family) {
    case 'cutaneous_melanoma': {
      basis = 'NCCN Melanoma: Cutaneous — follow-up; ESMO';
      const highRisk = metastatic || nodePos || ['IIB', 'IIC'].includes(stage);

      if (stage === '0') {
        durationYears = 10;
        push('skin_examination', 'Annual full skin examination', 'Lifelong annual skin surveillance for a second primary melanoma.', series(12, 120, 12), basis);
        narrative = 'Melanoma in situ: annual skin examination for life. No imaging surveillance required.';
        break;
      }

      if (highRisk) {
        durationYears = 5;
        push('clinical_review', 'Clinical review with full skin and nodal examination', 'History, examination of the scar and in-transit pathway, and palpation of all nodal basins.', series(3, 24, 3), basis);
        push('clinical_review', 'Clinical review with full skin and nodal examination', 'Interval extended after two disease-free years.', series(30, 60, 6), basis);
        push('cross_sectional_imaging', 'CT or PET-CT surveillance imaging', 'Cross-sectional imaging to detect asymptomatic recurrence while it remains treatable.', series(6, 24, 6), basis);
        push('cross_sectional_imaging', 'CT or PET-CT surveillance imaging', 'Reduced frequency in years 3-5.', series(36, 60, 12), basis);
        if (nodePos && !ctx.sentinelNodeDone) {
          push('nodal_ultrasound', 'Nodal basin ultrasound', 'Structured ultrasound surveillance of the involved basin in place of completion dissection.', series(4, 24, 4), basis);
        }
        narrative =
          `Stage ${stage} melanoma: clinical review every 3 months for 2 years then 6-monthly to 5 years, with ` +
          `cross-sectional imaging 6-monthly for 2 years then annually. Annual skin examination continues for life.`;
      } else {
        durationYears = 5;
        push('clinical_review', 'Clinical review with skin and nodal examination', 'History, examination of the scar and nodal basins.', series(6, 60, 6), basis);
        narrative =
          `Stage ${stage} melanoma: clinical review every 6 months for 5 years. Routine imaging is not indicated for ` +
          `asymptomatic early-stage disease. Annual skin examination continues for life.`;
      }
      push('skin_examination', 'Annual full skin examination', 'Lifelong — the risk of a second primary melanoma persists indefinitely.', series(12, 120, 12), basis);
      break;
    }

    case 'cutaneous_scc': {
      basis = 'NCCN Squamous Cell Skin Cancer — follow-up';
      if (nodePos || metastatic) {
        push('clinical_review', 'Clinical review with nodal examination', 'Close review including the treated basin.', series(2, 12, 2), basis);
        push('clinical_review', 'Clinical review with nodal examination', 'Interval extended in year 2.', series(15, 24, 3), basis);
        push('clinical_review', 'Clinical review with nodal examination', 'Years 3-5.', series(30, 60, 6), basis);
        push('cross_sectional_imaging', 'Cross-sectional imaging of the primary site and draining basin', 'Baseline and interval imaging for regionally advanced disease.', series(6, 24, 6), basis);
        narrative = 'Regionally advanced cutaneous SCC: 2-monthly review in year 1, then progressively lengthening intervals to 5 years, with interval imaging.';
      } else {
        push('clinical_review', 'Clinical review with full skin examination', 'Inspect the scar, surrounding field and regional nodes.', series(3, 24, 3), basis);
        push('clinical_review', 'Clinical review with full skin examination', 'Years 3-5.', series(30, 60, 6), basis);
        narrative = 'Localised cutaneous SCC: 3-monthly review for 2 years, then 6-monthly to 5 years, then annually for life.';
      }
      push('skin_examination', 'Annual full skin examination', 'Lifelong field surveillance — a further keratinocyte cancer is likely.', series(12, 120, 12), basis);
      durationYears = 5;
      break;
    }

    case 'cutaneous_bcc': {
      basis = 'NCCN Basal Cell Skin Cancer — follow-up';
      push('clinical_review', 'Clinical review with full skin examination', 'Inspect the treated site for recurrence and the wider field for new primaries.', series(6, 60, 6), basis);
      push('skin_examination', 'Annual full skin examination', 'Lifelong — around half of patients develop a further basal cell carcinoma within 5 years.', series(12, 120, 12), basis);
      narrative = 'Basal cell carcinoma: 6-monthly review for 5 years, then lifelong annual skin examination.';
      durationYears = 5;
      break;
    }

    case 'merkel_cell': {
      basis = 'NCCN Merkel Cell Carcinoma — follow-up';
      push('clinical_review', 'Clinical review with skin and nodal examination', 'Merkel cell carcinoma recurs early — most recurrences occur within 2 years.', series(3, 36, 3), basis);
      push('clinical_review', 'Clinical review with skin and nodal examination', 'Years 4-5.', series(42, 60, 6), basis);
      push('cross_sectional_imaging', 'Surveillance imaging (PET-CT or CT)', 'Higher-intensity imaging is justified by the high early recurrence rate.', series(6, 36, 6), basis);
      push('bloods', 'AMERK / Merkel cell polyomavirus oncoprotein antibody titre', 'Where available, a rising titre can precede clinically detectable recurrence in seropositive patients.', series(3, 36, 3), basis);
      narrative = 'Merkel cell carcinoma: 3-monthly clinical review and 6-monthly imaging for 3 years, reflecting a high early recurrence rate, then 6-monthly to 5 years.';
      durationYears = 5;
      break;
    }

    case 'soft_tissue_sarcoma': {
      basis = 'NCCN Soft Tissue Sarcoma — follow-up; ESMO-EURACAN';
      const highGrade = ctx.grade === 'G2' || ctx.grade === 'G3';
      if (highGrade || metastatic) {
        push('clinical_review', 'Clinical review with examination of the operative site', 'Assess for local recurrence, function and lymphoedema.', series(3, 36, 3), basis);
        push('clinical_review', 'Clinical review with examination of the operative site', 'Years 4-5.', series(42, 60, 6), basis);
        push('chest_imaging', 'CT chest', 'The lung is the dominant metastatic site in soft tissue sarcoma; chest surveillance is the priority investigation.', series(3, 36, 3), basis);
        push('chest_imaging', 'CT chest', 'Years 4-5.', series(42, 60, 6), basis);
        push('primary_site_imaging', 'MRI or ultrasound of the primary site', 'Detect local recurrence, particularly where margins were close.', series(6, 36, 6), basis);
        narrative =
          'High-grade soft tissue sarcoma: 3-monthly clinical review and CT chest for 3 years, then 6-monthly to 5 years, ' +
          'with 6-monthly imaging of the primary site. Surveillance continues to 10 years at annual intervals.';
        durationYears = 10;
      } else {
        push('clinical_review', 'Clinical review with examination of the operative site', 'Assess for local recurrence and function.', series(6, 24, 6), basis);
        push('clinical_review', 'Clinical review with examination of the operative site', 'Years 3-5.', series(36, 60, 12), basis);
        push('chest_imaging', 'Chest imaging', 'Annual chest imaging is sufficient for low-grade disease.', series(12, 60, 12), basis);
        push('primary_site_imaging', 'MRI or ultrasound of the primary site', 'Annual local surveillance.', series(12, 60, 12), basis);
        narrative =
          'Low-grade soft tissue sarcoma: 6-monthly review for 2 years then annually to 5 years, with annual chest and ' +
          'primary-site imaging. Late recurrence is recognised, so surveillance extends to 10 years.';
        durationYears = 10;
      }
      break;
    }
  }

  // Anyone on systemic therapy needs structured toxicity review independent of
  // the cancer-surveillance schedule.
  if (metastatic || nodePos || ['IIB', 'IIC'].includes(stage)) {
    push(
      'toxicity_review',
      'Immunotherapy / systemic therapy toxicity review',
      'Assess for immune-related adverse events including thyroid, hepatic, colonic, cutaneous, pituitary and ' +
        'pneumonitis toxicity. Check thyroid function, liver and renal profile at each cycle.',
      series(1, 12, 1),
      'NCCN Management of Immunotherapy-Related Toxicities'
    );
  }

  items.sort((a, b) => a.dueMonth - b.dueMonth);

  return { items, narrative, durationYears, basis };
}
