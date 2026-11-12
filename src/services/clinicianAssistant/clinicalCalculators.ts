/**
 * The calculators that already had an implementation somewhere in this app,
 * exposed through the Clinician Assistant.
 *
 * NONE OF THIS REIMPLEMENTS ANYTHING. Each function is a thin adapter over
 * logic that already exists and is already tested:
 *
 *   acid-base            → engine/modules/abg.ts   interpretAcidBase()
 *   potassium, sodium    → engine/replacement.ts   correctionPlan()
 *   meal plans           → clinical/nutrition/planner.ts (WAFCT 2019, constrained solver)
 *
 * The alternative — writing a second acid-base interpreter for a calculator
 * screen — is how two parts of one app come to disagree at the bedside. What is
 * added here is the input shaping and nothing else.
 *
 * eGFR is the exception: it is computed here because the app had no shared
 * implementation to call, only inline uses.
 */

import { assessNutrition } from '../../clinical/nutrition/assess';
import { interpretAcidBase } from './engine/modules/abg';
import { correctionPlan, type CorrectionPlan } from './engine/replacement';
import { emptyPatient, type PatientContext, type Sex } from './engine/types';

import { ckdEpi2021 } from './engine/modules/renal';
// ── Acid-base ────────────────────────────────────────────────────────────

export const KPA_PER_MMHG = 0.1333;

export interface AcidBaseInput {
  ph: number | null;
  paco2: number | null;
  /**
   * Which unit paco2 is given in. The engine works in kPa throughout; a value
   * in mmHg passed as kPa reads as a catastrophic respiratory acidosis and the
   * interpretation comes back confidently wrong, so the unit is explicit rather
   * than assumed.
   */
  paco2Unit?: 'kPa' | 'mmHg';
  hco3: number | null;
  sodium?: number | null;
  chloride?: number | null;
  albumin?: number | null;
}

export interface AcidBaseOutput {
  interpretation: ReturnType<typeof interpretAcidBase>;
  anionGap: number | null;
  /** Corrected for albumin — a low albumin masks a raised gap. */
  correctedAnionGap: number | null;
  /** PaCO₂ in kPa, whatever unit it was entered in. */
  paco2Kpa: number | null;
  notes: string[];
}

export function acidBase(input: AcidBaseInput): AcidBaseOutput {
  const paco2Kpa = input.paco2 == null
    ? null
    : input.paco2Unit === 'mmHg' ? input.paco2 * KPA_PER_MMHG : input.paco2;

  // The engine's own interpreter: primary disorder, whether compensation is
  // appropriate (Winter's formula and the rest), and mixed-disorder detection.
  const interpretation = interpretAcidBase(input.ph ?? null, paco2Kpa, input.hco3 ?? null);

  const notes: string[] = [];
  let anionGap: number | null = null;
  let correctedAnionGap: number | null = null;

  if (input.sodium != null && input.chloride != null && input.hco3 != null) {
    anionGap = input.sodium - (input.chloride + input.hco3);

    // Each 1 g/dL of albumin below 4 hides roughly 2.5 mmol/L of anion gap. In
    // a hypoalbuminaemic surgical patient an uncorrected gap reads normal while
    // a real lactic acidosis is present.
    if (input.albumin != null && input.albumin > 0) {
      // Nigerian labs usually report albumin in g/L (e.g. 35); the correction
      // is in g/dL. A value above 10 can only be g/L, and used as g/dL it gave
      // a corrected gap of about −77.
      const albGdL = input.albumin > 10 ? input.albumin / 10 : input.albumin;
      correctedAnionGap = anionGap + 2.5 * (4 - albGdL);
      if (correctedAnionGap - anionGap >= 2) {
        notes.push(
          `Albumin ${albGdL.toFixed(1)} g/dL: the measured gap of ${anionGap.toFixed(1)} corrects to ` +
          `${correctedAnionGap.toFixed(1)}. A low albumin masks a raised anion gap.`
        );
      }
    }

    const gap = correctedAnionGap ?? anionGap;
    if (gap > 12) {
      notes.push('Raised anion gap — consider lactate, ketones, renal failure, or toxic ingestion.');
    }
  } else if (input.hco3 != null) {
    notes.push('Enter sodium and chloride to calculate the anion gap.');
  }

  if (!interpretation) notes.push('pH, PaCO₂ and bicarbonate are all required to interpret the disorder.');

  return { interpretation, anionGap, correctedAnionGap, paco2Kpa, notes };
}

// ── Electrolyte replacement ──────────────────────────────────────────────

export type ElectrolyteFinding =
  | 'lyte.hypokalaemia' | 'lyte.hyperkalaemia'
  | 'lyte.hyponatraemia' | 'lyte.hypernatraemia'
  | 'lyte.hypomagnesaemia' | 'lyte.hypocalcaemia'
  | 'lyte.hypercalcaemia' | 'lyte.hypophosphataemia';

export interface ElectrolyteInput {
  finding: ElectrolyteFinding;
  /** Canonical analyte keys → value, e.g. { k: 2.8, na: 128 }. */
  values: Record<string, number | null>;
  weightKg?: number | null;
  ageYears?: number | null;
  sex?: Sex;
  severity?: 'mild' | 'moderate' | 'severe' | 'critical';
}

/**
 * Ask the engine for its correction plan. The engine already knows the safe
 * infusion rates, the peripheral-versus-central limits and the monitoring each
 * correction needs; this only assembles the context it reads from.
 */
export function electrolyteCorrection(input: ElectrolyteInput): CorrectionPlan | null {
  const patient: PatientContext = {
    ...emptyPatient(),
    weightKg: input.weightKg ?? null,
    age: input.ageYears ?? null,
    sex: input.sex ?? 'unspecified',
  };

  return correctionPlan(input.finding, {
    patient,
    value: (key: string) => input.values[key] ?? null,
    severity: (input.severity ?? 'moderate') as any,
  });
}

// ── eGFR ─────────────────────────────────────────────────────────────────

export interface GfrInput {
  creatinineUmolL: number | null;
  ageYears: number | null;
  sex: Sex;
}

export interface GfrOutput {
  egfr: number | null;
  stage: string;
  note: string;
}

/**
 * CKD-EPI 2021, the race-free equation. The 2009 version applied a coefficient
 * for Black patients that has since been withdrawn as scientifically
 * unfounded; using it here would overestimate function in exactly the patients
 * whose access to care is already worst.
 */
export function egfrCkdEpi(input: GfrInput): GfrOutput {
  const { creatinineUmolL, ageYears, sex } = input;
  if (!creatinineUmolL || !ageYears || creatinineUmolL <= 0 || ageYears <= 0) {
    return { egfr: null, stage: '—', note: 'Creatinine, age and sex are required.' };
  }

  // The engine's CKD-EPI 2021 — the one implementation in the app.
  const computed = ckdEpi2021(creatinineUmolL, ageYears, sex === 'female' ? 'female' : sex === 'male' ? 'male' : 'unspecified');
  if (computed == null) {
    return { egfr: null, stage: '—', note: 'CKD-EPI applies from age 18 — for a child use the bedside Schwartz equation (36.5 × height cm ÷ creatinine µmol/L).' };
  }
  const egfr = computed;

  const stage =
    egfr >= 90 ? 'G1 — normal or high'
    : egfr >= 60 ? 'G2 — mildly reduced'
    : egfr >= 45 ? 'G3a — mild to moderate'
    : egfr >= 30 ? 'G3b — moderate to severe'
    : egfr >= 15 ? 'G4 — severely reduced'
    : 'G5 — kidney failure';

  const note = egfr < 60
    ? 'Review renally cleared drugs and contrast exposure. An eGFR alone does not distinguish acute from chronic — compare with a baseline.'
    : 'A single creatinine cannot exclude acute kidney injury; compare with the patient\'s baseline.';

  return { egfr, stage, note };
}

// ── Meal plans ───────────────────────────────────────────────────────────

export interface MealPlanOutput {
  targetKcal: number;
  targetProtein: number;
  rationale: string[];
}

export type WoundSeverity = 'mild' | 'moderate' | 'severe';

export interface WoundMealPlanInput {
  weightKg: number;
  severity?: WoundSeverity;
  /** g/dL or g/L. Reported as a caution only — albumin does not set the protein target. */
  albuminGdL?: number | null;
  diabetes?: boolean;
  ckd?: boolean;
  liverDisease?: boolean;
}

export interface WoundMealPlanOutput extends MealPlanOutput {
  fluidMl: number;
  proteinPerKg: number;
  kcalPerKg: number;
  /** Dietary modifications the comorbidities require. */
  modifications: string[];
  cautions: string[];
}

/**
 * Wound-healing targets — the bedside view of the clinical nutrition engine
 * (src/clinical/nutrition). The numbers are the engine's, so this calculator
 * and the patient's nutrition record can never disagree:
 *  - healing wound: 1.25–1.5 g/kg protein, 30 kcal/kg (EPUAP/NPIAP 2019);
 *  - extensive / heavily exuding wound: 1.5–2.0 g/kg, 35 kcal/kg;
 *  - CKD not on dialysis with a wound: 1.0 g/kg (1.3 if catabolic), agreed
 *    with nephrology — the stable-CKD restriction does not apply to a
 *    healing wound;
 *  - albumin is reported, never used to set protein (it falls with
 *    inflammation, not intake).
 */
export function woundHealingMealPlan(input: WoundMealPlanInput | number, legacy?: { largeWound?: boolean }): WoundMealPlanOutput {
  // Accept a bare weight so the simple call site stays readable.
  const opts: WoundMealPlanInput = typeof input === 'number'
    ? { weightKg: input, severity: legacy?.largeWound ? 'severe' : 'mild' }
    : input;
  const { weightKg, severity = 'mild', diabetes, ckd, liverDisease } = opts;
  // Accept g/dL or g/L (a value above 10 cannot be g/dL); the engine works in g/L.
  const albuminGL = opts.albuminGdL == null || !Number.isFinite(opts.albuminGdL) ? null : opts.albuminGdL > 10 ? opts.albuminGdL : opts.albuminGdL * 10;
  const wound = WOUND_BY_SEVERITY[severity] ?? WOUND_BY_SEVERITY.mild;

  const a = assessNutrition({
    weightKg: Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null,
    woundAreaCm2: wound.areaCm2, exudate: wound.exudate, diabetes, ckd, liverDisease,
    labs: albuminGL != null ? { albuminGL } : undefined,
  });
  const targetKcal = a.targets.kcal ?? 0;
  const targetProtein = a.targets.proteinG ?? 0;

  const cautions = [...(a.protein?.warnings || []), ...a.warnings.filter(w => /^Albumin/.test(w))];
  const modifications: string[] = [];
  if (ckd) {
    modifications.push('Restrict potassium (bananas, oranges, tomatoes) and phosphate (dairy, nuts, beans) as advised by nephrology.');
    modifications.push('Low sodium; fluid restriction if one has been set.');
  }
  if (diabetes) {
    modifications.push('Whole grains over refined; pair carbohydrate with protein to blunt the glucose rise.');
    modifications.push('Avoid added sugars and sweetened drinks. Poor glycaemic control delays healing directly.');
  }
  if (liverDisease) {
    modifications.push('Small frequent meals with a late evening snack to limit overnight catabolism.');
    cautions.push('In decompensated liver disease protein is not restricted routinely — restriction worsens sarcopenia.');
  }
  for (const f of a.fluid?.flags || []) cautions.push(f);

  return {
    targetKcal,
    targetProtein,
    proteinPerKg: a.protein?.perKg ?? 0,
    kcalPerKg: weightKg > 0 ? Math.round(targetKcal / weightKg) : 0,
    fluidMl: a.fluid?.value ?? 0,
    modifications,
    cautions,
    rationale: [
      a.energy.selected ? `Energy: ${a.energy.selected.method}.` : 'Energy: enter a weight.',
      a.protein ? `Protein: ${a.protein.method}.` : 'Protein: enter a weight.',
      severity === 'severe'
        ? 'Raised targets for an extensive wound, where losses through the surface are substantial.'
        : 'Targets for a healing surgical or traumatic wound.',
      'Vitamin C and zinc support collagen synthesis; check for deficiency where healing is delayed.',
      'A protein deficit presents as wound breakdown before it presents as weight loss.',
      `Coefficients ${a.configVersion} (pending clinical validation). For a patient, use their Clinical Nutrition record.`,
    ],
  };
}

/** Bedside severity → the wound description the engine reasons from. */
const WOUND_BY_SEVERITY: Record<WoundSeverity, { areaCm2: number; exudate: 'low' | 'moderate' | 'high' }> = {
  mild: { areaCm2: 5, exudate: 'low' },
  moderate: { areaCm2: 15, exudate: 'moderate' },
  severe: { areaCm2: 40, exudate: 'high' },
};

/** Weight-reduction meal plan built against an already-calculated target. */
export function weightLossMealPlan(targetKcal: number, weightKg: number): MealPlanOutput {
  // 1.6 g/kg preserves lean mass through a deficit; the same figure the weight
  // reduction calculator uses, so the two cannot disagree.
  const targetProtein = Math.round(weightKg * 1.6);
  return {
    targetKcal,
    targetProtein,
    rationale: [
      `${targetKcal} kcal/day with ${targetProtein} g protein.`,
      'Protein held at 1.6 g/kg so the deficit comes off fat rather than muscle.',
      'Plans use locally available foods with practical household quantities.',
    ],
  };
}
