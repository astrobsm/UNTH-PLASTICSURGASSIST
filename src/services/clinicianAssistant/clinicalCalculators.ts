/**
 * The calculators that already had an implementation somewhere in this app,
 * exposed through the Clinician Assistant.
 *
 * NONE OF THIS REIMPLEMENTS ANYTHING. Each function is a thin adapter over
 * logic that already exists and is already tested:
 *
 *   acid-base            → engine/modules/abg.ts   interpretAcidBase()
 *   potassium, sodium    → engine/replacement.ts   correctionPlan()
 *   meal plans           → data/nigerianFoods.ts   generateMealPlan()
 *
 * The alternative — writing a second acid-base interpreter for a calculator
 * screen — is how two parts of one app come to disagree at the bedside. What is
 * added here is the input shaping and nothing else.
 *
 * eGFR is the exception: it is computed here because the app had no shared
 * implementation to call, only inline uses.
 */

import { interpretAcidBase } from './engine/modules/abg';
import { correctionPlan, type CorrectionPlan } from './engine/replacement';
import { generateMealPlan, type DayPlan } from '../../data/nigerianFoods';
import { emptyPatient, type PatientContext, type Sex } from './engine/types';

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
      correctedAnionGap = anionGap + 2.5 * (4 - input.albumin);
      if (correctedAnionGap - anionGap >= 2) {
        notes.push(
          `Albumin ${input.albumin} g/dL: the measured gap of ${anionGap.toFixed(1)} corrects to ` +
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

  // The equation is defined in mg/dL.
  const scr = creatinineUmolL / 88.4;
  const female = sex === 'female';
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const ratio = scr / kappa;

  let egfr =
    142 *
    Math.pow(Math.min(ratio, 1), alpha) *
    Math.pow(Math.max(ratio, 1), -1.2) *
    Math.pow(0.9938, ageYears);
  if (female) egfr *= 1.012;

  egfr = Math.round(egfr);

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
  days: DayPlan[];
  rationale: string[];
}

export type WoundSeverity = 'mild' | 'moderate' | 'severe';

export interface WoundMealPlanInput {
  weightKg: number;
  severity?: WoundSeverity;
  /** g/dL. Below 3.0 indicates depletion and raises the protein target. */
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
 * Wound-healing meal plan.
 *
 * Protein at 1.5 g/kg and 30-35 kcal/kg are the usual targets for a healing
 * surgical wound: tissue synthesis raises requirement well above maintenance,
 * and a deficit shows up as dehiscence and delayed closure rather than as
 * weight loss.
 *
 * CKD is the one comorbidity that changes the number rather than the advice.
 * A damaged kidney cannot clear the nitrogen load of 1.5-1.8 g/kg, so the
 * target is capped at 1.0 g/kg here and the conflict is stated outright. The
 * calculator this replaces printed "0.8-1.0 g/kg (consult nephrologist)" as a
 * note while leaving the headline target at 1.8 — the two disagreed on the
 * same screen, and the headline is the number people act on.
 */
export function woundHealingMealPlan(input: WoundMealPlanInput | number, legacy?: { largeWound?: boolean }): WoundMealPlanOutput {
  // Accept a bare weight so the simple call site stays readable.
  const opts: WoundMealPlanInput = typeof input === 'number'
    ? { weightKg: input, severity: legacy?.largeWound ? 'severe' : 'mild' }
    : input;

  const { weightKg, severity = 'mild', albuminGdL = null, diabetes, ckd, liverDisease } = opts;

  let proteinPerKg = 1.5;
  let kcalPerKg = 30;
  let fluidPerKg = 30;

  if (severity === 'severe') {
    proteinPerKg = 2.0; kcalPerKg = 35; fluidPerKg = 35;
  } else if (severity === 'moderate') {
    proteinPerKg = 1.5; kcalPerKg = 32;
  }

  const cautions: string[] = [];
  const modifications: string[] = [];

  // Depletion raises requirement above the severity-based figure.
  if (albuminGdL != null && albuminGdL < 3.0) {
    proteinPerKg = Math.max(proteinPerKg, 1.8);
    kcalPerKg = Math.max(kcalPerKg, 35);
    cautions.push(
      `Albumin ${albuminGdL} g/dL indicates depletion — protein raised to ${proteinPerKg} g/kg. ` +
      'Albumin is also a negative acute-phase reactant, so a low value in sepsis is not nutrition alone.'
    );
  }

  // CKD overrides everything above: the kidney sets the ceiling.
  if (ckd) {
    const uncapped = proteinPerKg;
    proteinPerKg = 1.0;
    cautions.push(
      `Chronic kidney disease caps protein at 1.0 g/kg, below the ${uncapped} g/kg this wound would ` +
      'otherwise need. Healing and renal protection genuinely conflict here — agree the target with ' +
      'nephrology rather than treating this figure as settled. A patient on dialysis is not capped.'
    );
    modifications.push('Restrict potassium (bananas, oranges, tomatoes) and phosphate (dairy, nuts, beans).');
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

  const targetKcal = Math.round(weightKg * kcalPerKg);
  const targetProtein = Math.round(weightKg * proteinPerKg);

  return {
    targetKcal,
    targetProtein,
    proteinPerKg,
    kcalPerKg,
    fluidMl: Math.round(weightKg * fluidPerKg),
    days: generateMealPlan(targetKcal, targetProtein),
    modifications,
    cautions,
    rationale: [
      `${kcalPerKg} kcal/kg and ${proteinPerKg} g/kg protein.`,
      severity === 'severe'
        ? 'Raised targets for an extensive wound, where losses through the surface are substantial.'
        : 'Targets for a healing surgical or traumatic wound.',
      'Vitamin C and zinc support collagen synthesis; check for deficiency where healing is delayed.',
      'A protein deficit presents as wound breakdown before it presents as weight loss.',
    ],
  };
}

/** Weight-reduction meal plan built against an already-calculated target. */
export function weightLossMealPlan(targetKcal: number, weightKg: number): MealPlanOutput {
  // 1.6 g/kg preserves lean mass through a deficit; the same figure the weight
  // reduction calculator uses, so the two cannot disagree.
  const targetProtein = Math.round(weightKg * 1.6);
  return {
    targetKcal,
    targetProtein,
    days: generateMealPlan(targetKcal, targetProtein),
    rationale: [
      `${targetKcal} kcal/day with ${targetProtein} g protein.`,
      'Protein held at 1.6 g/kg so the deficit comes off fat rather than muscle.',
      'Plans use locally available foods with practical household quantities.',
    ],
  };
}
