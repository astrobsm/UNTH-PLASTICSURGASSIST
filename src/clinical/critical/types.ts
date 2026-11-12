/**
 * Critical-care decision support — input and output contracts.
 *
 * The input is the structured case the clinician builds (or the app prefills
 * from the record). The output has exactly the keys the consultant-level
 * review specification defines, so the rule-based analysis and the optional
 * AI review are interchangeable and mergeable. Every key is always present.
 */

export interface CcPatient {
  age_years?: number | null;
  sex?: 'male' | 'female' | '' | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  pregnant?: boolean;
  breastfeeding?: boolean;
  location?: string;
}
export interface CcSymptom { category: string; item: string; duration?: string; severity?: string }
export interface CcSign { category: string; item: string; value?: string }
export interface CcVitals {
  time?: string;
  hr?: number | null; sbp?: number | null; dbp?: number | null; rr?: number | null;
  temp_c?: number | null; spo2?: number | null; fio2?: number | null; gcs?: number | null;
}
export interface CcLab { panel?: string; test: string; value: number | string; unit?: string; time?: string; ref_low?: number | null; ref_high?: number | null }
export interface CcMedication {
  name: string; class?: string; dose?: number | string | null; unit?: string; route?: string; frequency?: string;
  start_date?: string; duration_days?: number | null; stop_date?: string; indication?: string;
  loading_dose?: boolean; infusion_rate?: string;
}
export interface CcInput {
  patient: CcPatient;
  presenting_complaint?: string;
  comorbidities?: string[];
  allergies?: { agent: string; reaction?: string }[];
  symptoms?: CcSymptom[];
  signs?: CcSign[];
  vitals?: CcVitals[];
  fluid_balance?: { intake_ml_24h?: number | null; output_ml_24h?: number | null; urine_ml_per_hour?: number[] };
  labs?: CcLab[];
  baseline_creatinine_umol_l?: number | null;
  imaging_ecg?: { type: string; finding: string }[];
  ventilation?: { mode?: string; fio2?: number | null; peep?: number | null };
  medications?: CcMedication[];
  app_calculations?: Record<string, number | null>;
  clinician_question?: string;
  /** Burn size, when relevant (Parkland). */
  burn_tbsa_pct?: number | null;
}

// ── Output (the specification's JSON, every key always present) ────────────
export interface CcAlert { finding: string; severity: 'critical' | 'high'; action: string; timeframe: string }
export interface CcCalculation {
  name: string; inputs: Record<string, unknown>; formula: string; result: number | string | null; unit: string;
  interpretation: string; app_value_agrees: boolean | null; caveats: string;
}
export interface CcInteraction { with: string; severity: 'contraindicated' | 'major' | 'moderate' | 'minor'; mechanism: string; management: string; source?: 'class rules' | 'BNF database' | 'BNF medications table (secondary)' }
export interface CcMedReview {
  drug: string; class: string; mechanism: string; indication_ok: boolean | null; dose_assessment: string;
  renal_adjustment: string; hepatic_adjustment: string; adverse_effects_in_this_patient: string[];
  duration_assessment: string; interactions: CcInteraction[]; tdm: string;
  recommendation: 'continue' | 'adjust' | 'hold' | 'stop' | 'substitute'; details: string;
}
export interface CcElectrolyteCorrection {
  abnormality: string; current_value: string; severity: string; target: string; calculation: string;
  prescription: string; rate_ml_per_h: number | null; duration_h: number | null; max_safe_rate: string; recheck: string; stop_when: string;
}
export interface CcReport {
  critical_alerts: CcAlert[];
  data_quality: { missing_essential: string[]; implausible_values: string[]; assumptions: string[] };
  clinical_summary: string;
  calculations: CcCalculation[];
  renal_function: {
    creatinine_umol_l: number | null; egfr_ckd_epi_2021: number | null; crcl_cockcroft_gault: number | null;
    weight_used: 'actual' | 'ideal' | 'adjusted' | ''; ckd_stage: string; aki_stage: string; steady_state: boolean | null;
    dosing_band: string; interpretation: string; dialysis_indications: string[];
  };
  acid_base: {
    primary_disorder: string; compensation: string; anion_gap: number | null; corrected_anion_gap: number | null;
    delta_ratio: number | null; osmolar_gap: number | null; interpretation: string;
  };
  organ_systems: { system: string; status: 'stable' | 'at risk' | 'failing'; findings: string[] }[];
  scores: { name: string; value: string; complete: boolean; missing: string[]; interpretation: string }[];
  medication_review: CcMedReview[];
  missing_indicated_therapy: { therapy: string; reason: string }[];
  differential_diagnosis: { rank: number; diagnosis: string; likelihood: 'high' | 'moderate' | 'low'; cant_miss: boolean; supporting: string[]; against: string[]; next_test: string }[];
  plan: {
    immediate: string[];
    investigations: { test: string; priority: 'urgent' | 'today' | 'routine'; rationale: string }[];
    medications: { action: 'start' | 'stop' | 'adjust' | 'hold'; drug: string; dose: string; route: string; frequency: string; duration: string; calculation: string; rationale: string }[];
    electrolyte_corrections: CcElectrolyteCorrection[];
    fluids: { assessment: string; prescription: string; rate_ml_per_h: number | null; reassess: string };
    monitoring: { parameter: string; frequency: string; target: string }[];
    escalation: string[];
    resource_limited_alternatives: string[];
  };
  confidence: { overall: 'high' | 'moderate' | 'low'; limitations: string[] };
  disclaimer: string;
}

export const DISCLAIMER = 'Decision support only. A qualified clinician must verify all calculations, doses and orders before acting.';

export function emptyReport(): CcReport {
  return {
    critical_alerts: [], data_quality: { missing_essential: [], implausible_values: [], assumptions: [] }, clinical_summary: '',
    calculations: [],
    renal_function: { creatinine_umol_l: null, egfr_ckd_epi_2021: null, crcl_cockcroft_gault: null, weight_used: '', ckd_stage: '', aki_stage: '', steady_state: null, dosing_band: '', interpretation: '', dialysis_indications: [] },
    acid_base: { primary_disorder: '', compensation: '', anion_gap: null, corrected_anion_gap: null, delta_ratio: null, osmolar_gap: null, interpretation: '' },
    organ_systems: [], scores: [], medication_review: [], missing_indicated_therapy: [], differential_diagnosis: [],
    plan: { immediate: [], investigations: [], medications: [], electrolyte_corrections: [], fluids: { assessment: '', prescription: '', rate_ml_per_h: null, reassess: '' }, monitoring: [], escalation: [], resource_limited_alternatives: [] },
    confidence: { overall: 'low', limitations: [] }, disclaimer: DISCLAIMER,
  };
}
