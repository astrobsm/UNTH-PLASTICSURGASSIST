/**
 * Multimodality oncology management plan builder.
 *
 * Turns a StageResult plus case context into a structured, sequenced plan
 * across surgery, radiation, systemic therapy, diagnostics and supportive care.
 *
 * CLINICAL GOVERNANCE — this produces a DRAFT for the tumour board to ratify,
 * never an autonomous treatment decision. Every recommendation carries its
 * guideline provenance so the board can check the reasoning rather than trust
 * the output. Recommendations are graded:
 *   'recommend' — standard of care for this stage in current guidelines
 *   'consider'  — reasonable option requiring board/patient discussion
 *   'required'  — a step that must happen before treatment can be planned
 *
 * Sources encoded here (verified July 2026):
 *  - NCCN Clinical Practice Guidelines: Melanoma: Cutaneous; Squamous Cell Skin
 *    Cancer; Basal Cell Skin Cancer; Merkel Cell Carcinoma; Soft Tissue Sarcoma
 *  - ESMO Clinical Practice Guidelines for the same sites
 *  - NADINA (NEJM 2024) and SWOG S1801: neoadjuvant immunotherapy is now
 *    preferred over upfront dissection for macroscopic stage III melanoma
 *  - MSLT-II / DeCOG-SLT: nodal ultrasound surveillance rather than completion
 *    lymph node dissection after a positive sentinel node
 *  - KEYNOTE-716 / CheckMate 76K: adjuvant anti-PD-1 in resected stage IIB/IIC
 *  - STRASS: preoperative radiotherapy in retroperitoneal sarcoma
 */

import type { StageResult, TumorFamily, SarcomaSite, SarcomaGrade } from './stagingEngine';
import { isMetastatic, isNodePositive } from './stagingEngine';

export type Modality =
  | 'diagnostics'
  | 'surgery'
  | 'radiation_oncology'
  | 'systemic_therapy'
  | 'molecular_pathology'
  | 'reconstruction'
  | 'supportive_care'
  | 'clinical_trial';

export type Strength = 'required' | 'recommend' | 'consider';

export type TreatmentIntent = 'curative' | 'palliative' | 'diagnostic' | 'undetermined';

export interface PlanItem {
  modality: Modality;
  strength: Strength;
  /** Short imperative title, e.g. "Wide local excision with 2 cm margins". */
  title: string;
  detail: string;
  /** Where in the sequence this sits — lower runs first. */
  sequence: number;
  /** Guideline or trial this rests on. */
  basis: string;
  /** Which specialty owns this item — drives referral letter generation. */
  owner: Specialty;
}

export type Specialty =
  | 'plastic_reconstructive_surgery'
  | 'surgical_oncology'
  | 'radiation_oncology'
  | 'medical_oncology'
  | 'histopathology'
  | 'radiology'
  | 'nuclear_medicine'
  | 'dermatology'
  | 'palliative_care'
  | 'clinical_genetics'
  | 'psycho_oncology'
  | 'nutrition_dietetics'
  | 'physiotherapy_rehabilitation'
  | 'specialist_nursing';

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  plastic_reconstructive_surgery: 'Plastic & Reconstructive Surgery',
  surgical_oncology: 'Surgical Oncology',
  radiation_oncology: 'Radiation Oncology',
  medical_oncology: 'Medical Oncology',
  histopathology: 'Histopathology',
  radiology: 'Radiology',
  nuclear_medicine: 'Nuclear Medicine',
  dermatology: 'Dermatology',
  palliative_care: 'Palliative Care',
  clinical_genetics: 'Clinical Genetics',
  psycho_oncology: 'Psycho-oncology',
  nutrition_dietetics: 'Nutrition & Dietetics',
  physiotherapy_rehabilitation: 'Physiotherapy & Rehabilitation',
  specialist_nursing: 'Specialist Cancer Nursing',
};

export interface PlanContext {
  family: TumorFamily;
  stage: StageResult;
  /** Breslow thickness in mm — drives melanoma excision margins. */
  breslowMm?: number | null;
  sizeCm?: number | null;
  sarcomaSite?: SarcomaSite;
  grade?: SarcomaGrade;
  histologyAvailable?: boolean;
  histologicType?: string | null;
  /** High-risk site (mask area of face, ear, lip, genitalia) for skin cancer. */
  highRiskSite?: boolean;
  immunosuppressed?: boolean;
  brafMutated?: boolean | null;
  recurrentDisease?: boolean;
  perineuralInvasion?: boolean;
  marginsPositive?: boolean;
  /** Patient is fit for radical treatment (performance status 0-2, no absolute contraindication). */
  fitForRadicalTherapy?: boolean;
  patientAge?: number | null;
}

export interface ManagementPlan {
  intent: TreatmentIntent;
  summary: string;
  items: PlanItem[];
  /** Specialties that need a referral letter, derived from the plan items. */
  specialtiesInvolved: Specialty[];
  caveats: string[];
  generatedFrom: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Melanoma
// ─────────────────────────────────────────────────────────────────────────

/** NCCN/ESMO wide local excision margins, keyed on Breslow thickness. */
export function melanomaExcisionMargin(breslowMm: number | null | undefined, inSitu: boolean): string {
  if (inSitu) return '0.5-1.0 cm';
  if (breslowMm === null || breslowMm === undefined) return 'to be determined by Breslow thickness';
  if (breslowMm <= 1.0) return '1 cm';
  if (breslowMm <= 2.0) return '1-2 cm';
  return '2 cm';
}

function melanomaPlan(ctx: PlanContext, items: PlanItem[]): void {
  const { stage } = ctx;
  const inSitu = stage.T === 'Tis';
  const margin = melanomaExcisionMargin(ctx.breslowMm, inSitu);
  const metastatic = isMetastatic(stage);
  const nodePos = isNodePositive(stage);
  const macroscopicNodal = stage.N === 'N1b' || stage.N === 'N2b' || stage.N === 'N3b' || stage.N === 'N2c' || stage.N === 'N3c';

  if (!metastatic) {
    items.push({
      modality: 'surgery',
      strength: 'recommend',
      title: `Wide local excision with ${margin} clinical margins`,
      detail:
        `Excise to deep fascia. Margins are measured from the edge of the primary lesion or biopsy scar. ` +
        `Orient and mark the specimen for the pathologist so any positive margin can be re-excised accurately.`,
      sequence: 20,
      basis: 'NCCN Melanoma: Cutaneous; ESMO cutaneous melanoma guideline',
      owner: 'plastic_reconstructive_surgery',
    });
  }

  // Sentinel node biopsy — the T1b threshold is the decision point.
  if (!nodePos && !metastatic && !inSitu) {
    const b = ctx.breslowMm ?? 0;
    if (stage.T === 'T1a' && b < 0.8) {
      items.push({
        modality: 'surgery',
        strength: 'consider',
        title: 'Sentinel lymph node biopsy not routinely indicated',
        detail:
          'Nodal positivity rate below 5% for T1a melanoma. Consider SLNB only where additional adverse ' +
          'features are present (high mitotic rate, lymphovascular invasion, young age, or positive deep margin).',
        sequence: 25,
        basis: 'NCCN Melanoma: Cutaneous',
        owner: 'plastic_reconstructive_surgery',
      });
    } else {
      items.push({
        modality: 'surgery',
        strength: 'recommend',
        title: 'Discuss and offer sentinel lymph node biopsy',
        detail:
          `Stage ${stage.stageGroup} (${stage.T}) carries a sentinel node positivity rate that justifies SLNB ` +
          `for staging and to guide adjuvant therapy. Perform at the same sitting as wide local excision where possible — ` +
          `lymphatic mapping is less reliable after the primary has been widely excised.`,
        sequence: 15,
        basis: 'NCCN Melanoma: Cutaneous; ESMO',
        owner: 'plastic_reconstructive_surgery',
      });
      items.push({
        modality: 'diagnostics',
        strength: 'required',
        title: 'Pre-operative lymphoscintigraphy',
        detail: 'Map the draining basin(s) before sentinel node biopsy. Ambiguous or multi-basin drainage should be discussed with the operating surgeon.',
        sequence: 14,
        basis: 'Standard SLNB protocol',
        owner: 'nuclear_medicine',
      });
    }
  }

  // Macroscopic stage III — the NADINA reversal.
  if (macroscopicNodal && !metastatic) {
    items.push({
      modality: 'systemic_therapy',
      strength: 'recommend',
      title: 'Neoadjuvant ipilimumab + nivolumab BEFORE lymph node dissection',
      detail:
        'For macroscopic (clinically or radiologically detected) stage III melanoma, neoadjuvant combination ' +
        'immunotherapy followed by response-adapted surgery has superseded upfront dissection. NADINA reported ' +
        'event-free survival of 83.7% vs 57.2% for upfront dissection with adjuvant nivolumab. Patients achieving a ' +
        'major pathological response may omit adjuvant therapy altogether. Refer to medical oncology BEFORE ' +
        'scheduling dissection.',
      sequence: 10,
      basis: 'NADINA phase III (NEJM 2024); SWOG S1801; NCCN Melanoma',
      owner: 'medical_oncology',
    });
    items.push({
      modality: 'surgery',
      strength: 'recommend',
      title: 'Therapeutic lymph node dissection after neoadjuvant therapy',
      detail: 'Timing and extent guided by response to neoadjuvant immunotherapy and re-staging imaging.',
      sequence: 30,
      basis: 'NADINA; NCCN Melanoma',
      owner: 'surgical_oncology',
    });
  } else if (nodePos && !metastatic) {
    // Occult (sentinel-detected) nodal disease.
    items.push({
      modality: 'surgery',
      strength: 'recommend',
      title: 'Nodal basin ultrasound surveillance rather than completion lymph node dissection',
      detail:
        'After a positive sentinel node, completion dissection does not improve melanoma-specific survival and ' +
        'carries substantial lymphoedema morbidity. Structured ultrasound surveillance of the basin is preferred.',
      sequence: 30,
      basis: 'MSLT-II; DeCOG-SLT; NCCN Melanoma',
      owner: 'plastic_reconstructive_surgery',
    });
  }

  // Adjuvant systemic therapy.
  const highRiskNodeNeg = ['IIB', 'IIC'].includes(stage.stageGroup);
  if ((nodePos || highRiskNodeNeg) && !metastatic) {
    items.push({
      modality: 'systemic_therapy',
      strength: 'recommend',
      title: 'Adjuvant anti-PD-1 immunotherapy',
      detail:
        `Stage ${stage.stageGroup} resected melanoma. Pembrolizumab or nivolumab for 12 months reduces recurrence risk. ` +
        (highRiskNodeNeg
          ? 'Benefit in resected stage IIB/IIC is established by KEYNOTE-716 and CheckMate 76K. '
          : '') +
        (ctx.brafMutated
          ? 'BRAF V600 mutation present — adjuvant dabrafenib + trametinib is an alternative; discuss toxicity profiles with the patient.'
          : 'Await BRAF status to complete adjuvant options counselling.'),
      sequence: 40,
      basis: 'NCCN Melanoma; KEYNOTE-716; CheckMate 76K; COMBI-AD',
      owner: 'medical_oncology',
    });
  }

  if (metastatic) {
    items.push({
      modality: 'systemic_therapy',
      strength: 'recommend',
      title: 'First-line systemic therapy for metastatic melanoma',
      detail:
        'Options: nivolumab + relatlimab, or nivolumab + ipilimumab, or single-agent anti-PD-1, selected on disease ' +
        'burden, LDH, presence of brain metastases and comorbidity. ' +
        (ctx.brafMutated
          ? 'BRAF V600 mutant — BRAF/MEK inhibition is an option, generally reserved for rapidly progressive disease needing fast response.'
          : 'BRAF testing is required before finalising the systemic plan.'),
      sequence: 20,
      basis: 'NCCN Melanoma; ESMO metastatic melanoma guideline; RELATIVITY-047; CheckMate 067',
      owner: 'medical_oncology',
    });
    if ((ctx.stage.M || '').startsWith('M1d')) {
      items.push({
        modality: 'radiation_oncology',
        strength: 'recommend',
        title: 'Stereotactic radiosurgery for CNS metastases',
        detail:
          'Discuss SRS for limited brain metastases alongside systemic therapy. Combination immunotherapy has ' +
          'meaningful intracranial activity; sequencing should be agreed jointly with medical oncology.',
        sequence: 25,
        basis: 'NCCN Central Nervous System Cancers; NCCN Melanoma',
        owner: 'radiation_oncology',
      });
    }
  }

  items.push({
    modality: 'molecular_pathology',
    strength: nodePos || metastatic ? 'required' : 'consider',
    title: 'BRAF V600 mutation testing',
    detail:
      'Required for stage III and IV disease to determine eligibility for targeted therapy. ' +
      'Consider extended NGS panel (NRAS, KIT) where available, particularly for acral and mucosal primaries.',
    sequence: 12,
    basis: 'NCCN Melanoma; ESMO',
    owner: 'histopathology',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Cutaneous SCC and BCC
// ─────────────────────────────────────────────────────────────────────────

function keratinocyteCarcinomaPlan(ctx: PlanContext, items: PlanItem[]): void {
  const { stage, family } = ctx;
  const isBcc = family === 'cutaneous_bcc';
  const metastatic = isMetastatic(stage);
  const nodePos = isNodePositive(stage);

  const highRisk =
    !!ctx.highRiskSite ||
    !!ctx.perineuralInvasion ||
    !!ctx.recurrentDisease ||
    !!ctx.immunosuppressed ||
    ['T3', 'T4a', 'T4b'].includes(stage.T);

  if (!metastatic) {
    if (highRisk) {
      items.push({
        modality: 'surgery',
        strength: 'recommend',
        title: 'Mohs micrographic surgery or excision with complete circumferential margin assessment',
        detail:
          'High-risk features present' +
          (ctx.perineuralInvasion ? ' (perineural invasion)' : '') +
          (ctx.highRiskSite ? ' (high-risk anatomical site)' : '') +
          (ctx.recurrentDisease ? ' (recurrent disease)' : '') +
          (ctx.immunosuppressed ? ' (immunosuppression)' : '') +
          '. Complete margin assessment gives the highest cure rate and spares tissue in functionally ' +
          'and cosmetically sensitive areas. Delay definitive reconstruction until margins are confirmed clear.',
        sequence: 20,
        basis: isBcc ? 'NCCN Basal Cell Skin Cancer' : 'NCCN Squamous Cell Skin Cancer',
        owner: 'plastic_reconstructive_surgery',
      });
    } else {
      items.push({
        modality: 'surgery',
        strength: 'recommend',
        title: `Standard surgical excision with ${isBcc ? '4 mm' : '4-6 mm'} clinical margins`,
        detail:
          'Low-risk lesion. Excise with the stated peripheral margin to the level of subcutaneous fat, with ' +
          'histological margin confirmation.',
        sequence: 20,
        basis: isBcc ? 'NCCN Basal Cell Skin Cancer' : 'NCCN Squamous Cell Skin Cancer',
        owner: 'plastic_reconstructive_surgery',
      });
    }
  }

  if (nodePos) {
    items.push({
      modality: 'surgery',
      strength: 'recommend',
      title: 'Therapeutic regional lymphadenectomy',
      detail: `Nodal category ${stage.N}. Extent guided by basin and imaging; parotidectomy considered for facial primaries draining to intraparotid nodes.`,
      sequence: 25,
      basis: 'NCCN Squamous Cell Skin Cancer',
      owner: 'surgical_oncology',
    });
  }

  const adjuvantRtIndicated = ctx.perineuralInvasion || ctx.marginsPositive || nodePos || stage.T === 'T4a' || stage.T === 'T4b';
  if (adjuvantRtIndicated && !metastatic) {
    items.push({
      modality: 'radiation_oncology',
      strength: 'recommend',
      title: 'Adjuvant radiotherapy',
      detail:
        'Indicated for' +
        [
          ctx.perineuralInvasion ? ' large-calibre or extensive perineural invasion' : '',
          ctx.marginsPositive ? ' positive or close surgical margins where re-excision is not feasible' : '',
          nodePos ? ' nodal involvement, particularly with extranodal extension' : '',
          ['T4a', 'T4b'].includes(stage.T) ? ' bone or skull base invasion' : '',
        ]
          .filter(Boolean)
          .join(',') +
        '. Refer for planning within 6 weeks of surgery.',
      sequence: 40,
      basis: 'NCCN Squamous Cell Skin Cancer; ESMO cSCC guideline',
      owner: 'radiation_oncology',
    });
  }

  if (metastatic || stage.T === 'T4b') {
    if (isBcc) {
      items.push({
        modality: 'systemic_therapy',
        strength: 'recommend',
        title: 'Hedgehog pathway inhibitor',
        detail:
          'Vismodegib or sonidegib for locally advanced or metastatic basal cell carcinoma not amenable to surgery ' +
          'or radiotherapy. Counsel specifically on muscle cramps, dysgeusia, alopecia and teratogenicity. ' +
          'Cemiplimab is an option after hedgehog inhibitor failure or intolerance.',
        sequence: 30,
        basis: 'NCCN Basal Cell Skin Cancer; ESMO',
        owner: 'medical_oncology',
      });
    } else {
      items.push({
        modality: 'systemic_therapy',
        strength: 'recommend',
        title: 'Anti-PD-1 immunotherapy (cemiplimab)',
        detail:
          'For locally advanced or metastatic cutaneous SCC not curable by surgery or radiotherapy. ' +
          (ctx.immunosuppressed
            ? 'CAUTION: in solid organ transplant recipients, checkpoint inhibition carries a real risk of graft rejection — ' +
              'this must be discussed jointly with the transplant team before starting.'
            : 'Pembrolizumab is an alternative.'),
        sequence: 30,
        basis: 'NCCN Squamous Cell Skin Cancer; EMPOWER-CSCC-1',
        owner: 'medical_oncology',
      });
    }
  }

  if (ctx.immunosuppressed) {
    items.push({
      modality: 'supportive_care',
      strength: 'recommend',
      title: 'Review immunosuppression with the prescribing team',
      detail:
        'Reduction or modification of immunosuppression (for example switching to an mTOR inhibitor in transplant ' +
        'recipients) reduces new keratinocyte cancer formation. Must be agreed with the transplant or rheumatology team.',
      sequence: 45,
      basis: 'NCCN Squamous Cell Skin Cancer',
      owner: 'dermatology',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Merkel cell carcinoma
// ─────────────────────────────────────────────────────────────────────────

function merkelPlan(ctx: PlanContext, items: PlanItem[]): void {
  const { stage } = ctx;
  const metastatic = isMetastatic(stage);
  const nodePos = isNodePositive(stage);

  items.push({
    modality: 'diagnostics',
    strength: 'required',
    title: 'Baseline whole-body imaging',
    detail:
      'FDG PET-CT is preferred for Merkel cell carcinoma; CT chest/abdomen/pelvis where PET is unavailable. ' +
      'Occult metastatic disease is common enough at presentation to change management.',
    sequence: 5,
    basis: 'NCCN Merkel Cell Carcinoma',
    owner: 'radiology',
  });

  if (!metastatic) {
    items.push({
      modality: 'surgery',
      strength: 'recommend',
      title: 'Wide local excision with 1-2 cm margins',
      detail: 'Margins balanced against the need to avoid delaying adjuvant radiotherapy. Do not compromise reconstruction timing.',
      sequence: 20,
      basis: 'NCCN Merkel Cell Carcinoma',
      owner: 'plastic_reconstructive_surgery',
    });

    if (!nodePos) {
      items.push({
        modality: 'surgery',
        strength: 'recommend',
        title: 'Sentinel lymph node biopsy',
        detail:
          'Recommended in ALL clinically node-negative Merkel cell carcinoma regardless of primary size — ' +
          'approximately one third harbour occult nodal disease.',
        sequence: 15,
        basis: 'NCCN Merkel Cell Carcinoma',
        owner: 'plastic_reconstructive_surgery',
      });
    }

    items.push({
      modality: 'radiation_oncology',
      strength: 'recommend',
      title: 'Adjuvant radiotherapy to the primary site',
      detail:
        'Merkel cell carcinoma is radiosensitive and locoregional recurrence is common. Adjuvant radiotherapy to the ' +
        'primary bed is standard for most cases' +
        (nodePos ? ', with nodal basin irradiation given the nodal involvement' : '') +
        '. Refer at the time of surgical planning so radiotherapy is not delayed.',
      sequence: 35,
      basis: 'NCCN Merkel Cell Carcinoma; ESMO',
      owner: 'radiation_oncology',
    });
  } else {
    items.push({
      modality: 'systemic_therapy',
      strength: 'recommend',
      title: 'First-line anti-PD-(L)1 immunotherapy',
      detail:
        'Avelumab, pembrolizumab or retifanlimab for metastatic Merkel cell carcinoma. Response rates are high and ' +
        'durable relative to chemotherapy, which is now reserved for immunotherapy-refractory disease.',
      sequence: 20,
      basis: 'NCCN Merkel Cell Carcinoma; JAVELIN Merkel 200',
      owner: 'medical_oncology',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Soft tissue sarcoma
// ─────────────────────────────────────────────────────────────────────────

function sarcomaPlan(ctx: PlanContext, items: PlanItem[]): void {
  const { stage } = ctx;
  const site = ctx.sarcomaSite || 'trunk_extremity';
  const grade = ctx.grade || 'GX';
  const metastatic = isMetastatic(stage);
  const highGrade = grade === 'G2' || grade === 'G3';
  const large = (ctx.sizeCm ?? 0) > 5;

  // The single most important item in the whole module — an unplanned excision
  // materially worsens outcome and is the commonest avoidable error.
  items.push({
    modality: 'diagnostics',
    strength: 'required',
    title: 'Refer to a specialist sarcoma centre BEFORE any biopsy or excision',
    detail:
      'Any soft tissue mass that is deep to fascia, larger than 5 cm, or enlarging should be referred before it is ' +
      'touched. Unplanned ("whoops") excision compromises limb salvage, necessitates wider re-resection and worsens ' +
      'local control. If a biopsy is performed locally, it must be a core needle biopsy sited ALONG the axis of the ' +
      'future resection incision and planned with the operating surgeon, so the tract can be excised en bloc.',
    sequence: 1,
    basis: 'NCCN Soft Tissue Sarcoma; ESMO-EURACAN sarcoma guideline',
    owner: 'surgical_oncology',
  });

  items.push({
    modality: 'diagnostics',
    strength: 'required',
    title: 'MRI of the primary with contrast, plus CT chest for staging',
    detail:
      'MRI defines the compartment, neurovascular relations and resectability. CT chest is required because the lung ' +
      'is the dominant site of metastasis. ' +
      (site === 'retroperitoneal'
        ? 'For retroperitoneal disease, CT abdomen and pelvis with contrast is the primary modality. '
        : '') +
      'For myxoid liposarcoma, add whole-spine MRI and CT abdomen — this histology metastasises to extrapulmonary sites.',
    sequence: 5,
    basis: 'NCCN Soft Tissue Sarcoma; ESMO-EURACAN',
    owner: 'radiology',
  });

  items.push({
    modality: 'molecular_pathology',
    strength: 'required',
    title: 'Expert sarcoma pathology review with ancillary molecular testing',
    detail:
      'Subtype-specific diagnosis changes treatment substantially. Request specialist review with immunohistochemistry ' +
      'and, where indicated, FISH or NGS for diagnostic fusions (for example DDIT3 in myxoid liposarcoma, SS18 in ' +
      'synovial sarcoma, MDM2/CDK4 amplification in well-differentiated and dedifferentiated liposarcoma). ' +
      'FNCLCC grading requires assessment of differentiation, mitotic count and necrosis.',
    sequence: 8,
    basis: 'WHO Classification of Soft Tissue and Bone Tumours (5th ed); ESMO-EURACAN',
    owner: 'histopathology',
  });

  if (!metastatic) {
    items.push({
      modality: 'surgery',
      strength: 'recommend',
      title: 'Wide local excision with negative margins, preserving function',
      detail:
        'Aim for an intact cuff of normal tissue in all planes. Limb-sparing surgery combined with radiotherapy gives ' +
        'local control equivalent to amputation for most extremity sarcoma. Mark the specimen and clip the tumour bed ' +
        'to guide radiotherapy planning.' +
        (site === 'retroperitoneal'
          ? ' For retroperitoneal sarcoma, en bloc resection of adherent organs is usually required to achieve a complete resection.'
          : ''),
      sequence: 25,
      basis: 'NCCN Soft Tissue Sarcoma; ESMO-EURACAN',
      owner: 'surgical_oncology',
    });

    items.push({
      modality: 'reconstruction',
      strength: 'consider',
      title: 'Plan reconstruction in the same operative episode',
      detail:
        'Soft tissue coverage, flap reconstruction or vascular reconstruction should be planned pre-operatively so ' +
        'oncological clearance is never compromised by concern about closure.',
      sequence: 26,
      basis: 'ESMO-EURACAN; local plastic surgery practice',
      owner: 'plastic_reconstructive_surgery',
    });

    if (highGrade && large) {
      items.push({
        modality: 'radiation_oncology',
        strength: 'recommend',
        title: 'Radiotherapy — preoperative preferred',
        detail:
          'For high-grade, deep tumours larger than 5 cm, radiotherapy improves local control. Preoperative treatment ' +
          'uses a smaller field and lower dose at the cost of higher wound complication rates; postoperative treatment ' +
          'reverses that trade-off. ' +
          (site === 'retroperitoneal'
            ? 'In retroperitoneal sarcoma, STRASS did not show an abdominal recurrence-free survival benefit for routine ' +
              'preoperative radiotherapy — reserve it for selected histologies after board discussion.'
            : 'The decision should be made jointly before surgery, not after.'),
        sequence: 15,
        basis: 'NCCN Soft Tissue Sarcoma; STRASS (retroperitoneal)',
        owner: 'radiation_oncology',
      });
    }

    if (highGrade && large) {
      items.push({
        modality: 'systemic_therapy',
        strength: 'consider',
        title: 'Neoadjuvant or adjuvant anthracycline-based chemotherapy',
        detail:
          'Doxorubicin with ifosfamide may be considered for high-grade, large, deep tumours in fit patients, and for ' +
          'chemosensitive histologies. The absolute survival benefit is modest and must be weighed explicitly against ' +
          'toxicity with the patient.',
        sequence: 18,
        basis: 'NCCN Soft Tissue Sarcoma; ESMO-EURACAN',
        owner: 'medical_oncology',
      });
    }
  } else {
    items.push({
      modality: 'systemic_therapy',
      strength: 'recommend',
      title: 'Histology-directed systemic therapy',
      detail:
        'Doxorubicin-based therapy is the usual first line. Subtype-directed alternatives should be considered: ' +
        'trabectedin or eribulin in liposarcoma and leiomyosarcoma, gemcitabine-docetaxel in leiomyosarcoma and ' +
        'undifferentiated pleomorphic sarcoma, imatinib where the diagnosis is dermatofibrosarcoma protuberans. ' +
        'Metastasectomy may be appropriate for resectable oligometastatic pulmonary disease.',
      sequence: 20,
      basis: 'NCCN Soft Tissue Sarcoma; ESMO-EURACAN',
      owner: 'medical_oncology',
    });
  }

  items.push({
    modality: 'clinical_trial',
    strength: 'consider',
    title: 'Clinical trial screening',
    detail:
      'Sarcoma is rare and heterogeneous; trial enrolment is actively encouraged in guidelines, particularly for ' +
      'advanced or rare-subtype disease.',
    sequence: 50,
    basis: 'ESMO-EURACAN; NCCN Soft Tissue Sarcoma',
    owner: 'medical_oncology',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Cross-cutting items
// ─────────────────────────────────────────────────────────────────────────

function addUniversalItems(ctx: PlanContext, items: PlanItem[]): void {
  const metastatic = isMetastatic(ctx.stage);

  if (ctx.histologyAvailable === false) {
    items.push({
      modality: 'diagnostics',
      strength: 'required',
      title: 'Obtain and review definitive histology before committing to treatment',
      detail:
        'This plan is provisional. Re-present the case to the board once the pathology report is available; ' +
        'the assessment is versioned so the pre-histology and post-histology plans remain side by side in the record.',
      sequence: 2,
      basis: 'Tumour board governance',
      owner: 'histopathology',
    });
  }

  items.push({
    modality: 'supportive_care',
    strength: 'recommend',
    title: 'Specialist cancer nurse allocation and structured counselling',
    detail:
      'Assign a key worker at diagnosis. Provide written information, ensure the patient and their chosen relatives ' +
      'understand the diagnosis, intent of treatment and expected trajectory, and document that discussion.',
    sequence: 60,
    basis: 'International cancer MDT standards',
    owner: 'specialist_nursing',
  });

  if (metastatic) {
    items.push({
      modality: 'supportive_care',
      strength: 'recommend',
      title: 'Early palliative care referral alongside active treatment',
      detail:
        'Early integration of palliative care with active oncological treatment improves quality of life and, in ' +
        'several tumour types, survival. This is not a substitute for anticancer therapy and should be framed to the ' +
        'patient as additional support, not a withdrawal of treatment.',
      sequence: 55,
      basis: 'ASCO / ESMO integrated palliative care recommendations',
      owner: 'palliative_care',
    });
  }

  items.push({
    modality: 'supportive_care',
    strength: 'consider',
    title: 'Psycho-oncology and nutritional assessment',
    detail: 'Screen for distress at diagnosis and at transitions of care. Nutritional assessment where weight loss or major surgery is anticipated.',
    sequence: 62,
    basis: 'International cancer MDT standards',
    owner: 'psycho_oncology',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────

function determineIntent(ctx: PlanContext): TreatmentIntent {
  if (ctx.histologyAvailable === false && ctx.stage.T === 'TX') return 'diagnostic';
  if (isMetastatic(ctx.stage)) {
    // Metastatic melanoma and Merkel cell can achieve durable remission with
    // immunotherapy, so "palliative" is the wrong word to put in front of a
    // patient in those settings.
    if (ctx.family === 'cutaneous_melanoma' || ctx.family === 'merkel_cell') return 'undetermined';
    return 'palliative';
  }
  if (ctx.fitForRadicalTherapy === false) return 'palliative';
  return 'curative';
}

export function buildManagementPlan(ctx: PlanContext): ManagementPlan {
  const items: PlanItem[] = [];

  switch (ctx.family) {
    case 'cutaneous_melanoma':
      melanomaPlan(ctx, items);
      break;
    case 'cutaneous_scc':
    case 'cutaneous_bcc':
      keratinocyteCarcinomaPlan(ctx, items);
      break;
    case 'merkel_cell':
      merkelPlan(ctx, items);
      break;
    case 'soft_tissue_sarcoma':
      sarcomaPlan(ctx, items);
      break;
  }

  addUniversalItems(ctx, items);
  items.sort((a, b) => a.sequence - b.sequence);

  const intent = determineIntent(ctx);
  const specialtiesInvolved = Array.from(new Set(items.map(i => i.owner)));

  const caveats = [...ctx.stage.caveats];
  caveats.push(
    'This plan is a decision-support draft generated from staging inputs. It must be reviewed and ratified by the ' +
      'multidisciplinary tumour board before any element is acted on.'
  );
  if (ctx.fitForRadicalTherapy === false) {
    caveats.push('Patient recorded as not fit for radical therapy — treatment intent set to palliative.');
  }

  const summary =
    `${ctx.stage.formatted}. ` +
    (ctx.histologicType ? `Histology: ${ctx.histologicType}. ` : '') +
    `Treatment intent: ${intent}. ` +
    `${items.length} planned items across ${specialtiesInvolved.length} specialties.`;

  return {
    intent,
    summary,
    items,
    specialtiesInvolved,
    caveats,
    generatedFrom: ctx.stage.stagingSystem,
  };
}
