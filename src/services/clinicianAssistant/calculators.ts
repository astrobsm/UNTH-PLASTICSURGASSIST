/**
 * Bedside calculators ported from Critical Care Calculator.
 *
 * ONLY the four with no existing equivalent in this app. The other eleven were
 * deliberately not ported:
 *   Acid-base            → engine/modules/abg.ts (fuller: Winter's compensation)
 *   Potassium, Sodium    → engine/replacement.ts (K, Na, Mg, Ca, phosphate)
 *   Wound-healing meals  → data/nigerianFoods.ts generateMealPlan()
 *   Burns, DVT, Pressure sore, Nutrition, BNF, GFR → existing modules
 * A second implementation of the same clinical arithmetic drifts from the first
 * at the first edit, and the two then disagree at the bedside.
 *
 * Pure functions returning data, not JSX. The originals mixed calculation into
 * React components, which made the arithmetic untestable and unreusable — the
 * numbers here are what matter and they are now verifiable.
 */

export type Sex = 'male' | 'female' | 'unspecified';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very-active';

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  'very-active': 1.9,
};

// ─────────────────────────────────────────────────────────────────────────
// Energy requirement — shared by both weight calculators
// ─────────────────────────────────────────────────────────────────────────

/**
 * Basal metabolic rate, Harris-Benedict (original 1919 equations, as used by
 * the source calculator). Sex-specific; an unspecified sex uses the male
 * equation, which is the more conservative of the two for a deficit plan.
 */
export function basalMetabolicRate(weightKg: number, heightCm: number, ageYears: number, sex: Sex): number {
  if (!(weightKg > 0) || !(heightCm > 0) || !(ageYears > 0)) return 0;
  return sex === 'female'
    ? 655 + 9.6 * weightKg + 1.8 * heightCm - 4.7 * ageYears
    : 66 + 13.7 * weightKg + 5 * heightCm - 6.8 * ageYears;
}

/** Total daily energy expenditure = BMR × activity factor. */
export function totalDailyEnergy(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * (ACTIVITY_MULTIPLIER[activity] ?? 1.2));
}

export interface MacroTargets {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  /** Positive for a surplus, negative for a deficit. */
  calorieDelta: number;
  notes: string[];
}

export interface WeightPlanInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activity: ActivityLevel;
  /** Target weight change in kg; used to project a timeline. */
  targetChangeKg?: number;
  weeks?: number;
}

/**
 * Weight GAIN plan: 500 kcal surplus, protein at 2.0 g/kg for muscle accrual.
 */
export function weightGainPlan(input: WeightPlanInput): MacroTargets {
  const bmr = basalMetabolicRate(input.weightKg, input.heightCm, input.ageYears, input.sex);
  const tdee = totalDailyEnergy(bmr, input.activity);
  const targetCalories = Math.round(tdee + 500);
  const proteinG = Math.round(input.weightKg * 2.0);
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbG = Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4);

  const notes: string[] = [];
  if (input.targetChangeKg && input.weeks && input.weeks > 0) {
    const weekly = input.targetChangeKg / input.weeks;
    notes.push(`Projected ${input.targetChangeKg.toFixed(1)} kg over ${input.weeks} weeks (${weekly.toFixed(2)} kg/week).`);
    // Above roughly 0.5 kg/week, gain is disproportionately fat rather than
    // lean mass, so the rate is flagged rather than silently accepted.
    if (weekly > 0.5) notes.push('Above 0.5 kg/week the excess is largely fat rather than lean mass — consider a longer timeline.');
  }
  if (carbG < 0) notes.push('Protein and fat targets alone exceed the calorie target; reduce protein or raise calories.');

  return { bmr: Math.round(bmr), tdee, targetCalories, proteinG, fatG, carbG, calorieDelta: 500, notes };
}

/**
 * Weight REDUCTION plan: 500 kcal deficit, protein at 1.6 g/kg to preserve
 * lean mass, with a hard floor on intake.
 */
export function weightReductionPlan(input: WeightPlanInput): MacroTargets {
  const bmr = basalMetabolicRate(input.weightKg, input.heightCm, input.ageYears, input.sex);
  const tdee = totalDailyEnergy(bmr, input.activity);

  // The floor matters clinically: below it a diet cannot reliably meet
  // micronutrient requirements and needs supervision, so the deficit is capped
  // rather than the intake driven arbitrarily low.
  const floor = input.sex === 'female' ? 1200 : 1500;
  const uncapped = Math.round(tdee - 500);
  const targetCalories = Math.max(uncapped, floor);

  const proteinG = Math.round(input.weightKg * 1.6);
  const fatG = Math.round((targetCalories * 0.25) / 9);
  const carbG = Math.round((targetCalories - proteinG * 4 - fatG * 9) / 4);

  const notes: string[] = [];
  if (targetCalories > uncapped) {
    notes.push(`Intake floored at ${floor} kcal/day; a full 500 kcal deficit would fall below the level at which micronutrient requirements can be met unsupervised.`);
  }
  if (input.targetChangeKg && input.weeks && input.weeks > 0) {
    const weekly = input.targetChangeKg / input.weeks;
    notes.push(`Projected ${input.targetChangeKg.toFixed(1)} kg over ${input.weeks} weeks (${weekly.toFixed(2)} kg/week).`);
    if (weekly > 1.0) notes.push('Above 1 kg/week is rarely sustainable and risks lean mass loss.');
  }
  if (carbG < 0) notes.push('Protein and fat targets alone exceed the calorie target; reduce protein or raise calories.');

  return { bmr: Math.round(bmr), tdee, targetCalories, proteinG, fatG, carbG, calorieDelta: targetCalories - tdee, notes };
}

// ─────────────────────────────────────────────────────────────────────────
// Emergency resuscitation
// ─────────────────────────────────────────────────────────────────────────

export interface ResuscitationVitals {
  systolicBP?: number | null;
  diastolicBP?: number | null;
  heartRate?: number | null;
  respiratoryRate?: number | null;
  temperature?: number | null;
  gcs?: number | null;
  /** Alert / Voice / Pain / Unresponsive. */
  avpu?: 'A' | 'V' | 'P' | 'U';
}

export interface ResuscitationLabs {
  wbc?: number | null;
  lactate?: number | null;
}

export interface SepsisAssessment {
  map: number | null;
  qSOFA: number;
  sirs: number;
  sepsisSuspected: boolean;
  septicShock: boolean;
  /** Each component that scored, so the number can be checked not just trusted. */
  qSOFAComponents: string[];
  sirsComponents: string[];
}

/** Mean arterial pressure = diastolic + (pulse pressure / 3). */
export function meanArterialPressure(systolic?: number | null, diastolic?: number | null): number | null {
  if (!(Number(systolic) > 0) || !(Number(diastolic) > 0)) return null;
  return Math.round(Number(diastolic) + (Number(systolic) - Number(diastolic)) / 3);
}

/**
 * qSOFA and SIRS, with septic shock flagged on MAP or lactate.
 *
 * Components are returned alongside the score. A bedside score that cannot be
 * checked against its inputs invites being trusted when a value was missing.
 */
export function assessSepsis(vitals: ResuscitationVitals, labs: ResuscitationLabs = {}): SepsisAssessment {
  const qSOFAComponents: string[] = [];
  const sirsComponents: string[] = [];

  const rr = Number(vitals.respiratoryRate) || 0;
  const sbp = Number(vitals.systolicBP) || 0;
  const hr = Number(vitals.heartRate) || 0;
  const temp = Number(vitals.temperature) || 0;
  const wbc = Number(labs.wbc) || 0;
  const gcs = vitals.gcs == null ? null : Number(vitals.gcs);

  if (rr >= 22) qSOFAComponents.push('Respiratory rate ≥ 22');
  if (sbp > 0 && sbp <= 100) qSOFAComponents.push('Systolic BP ≤ 100 mmHg');
  if ((vitals.avpu && vitals.avpu !== 'A') || (gcs != null && gcs < 15)) {
    qSOFAComponents.push('Altered mentation');
  }

  if (temp > 0 && (temp > 38 || temp < 36)) sirsComponents.push('Temperature > 38 °C or < 36 °C');
  if (hr > 90) sirsComponents.push('Heart rate > 90');
  if (rr > 20) sirsComponents.push('Respiratory rate > 20');
  if (wbc > 0 && (wbc > 12 || wbc < 4)) sirsComponents.push('White cell count > 12 or < 4 ×10⁹/L');

  const qSOFA = qSOFAComponents.length;
  const sirs = sirsComponents.length;
  const map = meanArterialPressure(vitals.systolicBP, vitals.diastolicBP);
  const lactate = Number(labs.lactate) || 0;

  const sepsisSuspected = qSOFA >= 2 || sirs >= 2;
  const septicShock = sepsisSuspected && ((map != null && map < 65) || lactate > 2);

  return { map, qSOFA, sirs, sepsisSuspected, septicShock, qSOFAComponents, sirsComponents };
}

export type DehydrationSeverity = 'mild' | 'moderate' | 'severe';

/** Estimated fluid deficit in mL: 3 / 6 / 9 % of body weight. */
export function fluidDeficitMl(weightKg: number, severity: DehydrationSeverity): number {
  const fraction = { mild: 0.03, moderate: 0.06, severe: 0.09 }[severity];
  if (!(weightKg > 0) || fraction == null) return 0;
  return Math.round(weightKg * fraction * 1000);
}

/** Adult maintenance fluid in mL/hour, from 30 mL/kg/day. */
export function maintenanceFluidMlPerHour(weightKg: number): number {
  if (!(weightKg > 0)) return 0;
  return Math.round((30 * weightKg) / 24);
}

// ─────────────────────────────────────────────────────────────────────────
// Sickle cell crisis
//
// Distinct from sickleCellUlcerService, which covers chronic leg ulceration.
// This is acute crisis management: analgesia, hydration, and the thresholds at
// which transfusion or exchange is considered.
// ─────────────────────────────────────────────────────────────────────────

export type PainSeverity = 'mild' | 'moderate' | 'severe';

export interface SickleCrisisInput {
  weightKg: number;
  painScore: number;
  haemoglobinGdL?: number | null;
  /** Baseline steady-state haemoglobin, if known. */
  baselineHbGdL?: number | null;
  spo2?: number | null;
  temperatureC?: number | null;
  chestSymptoms?: boolean;
  priorStroke?: boolean;
}

export interface SickleCrisisPlan {
  painSeverity: PainSeverity;
  /** mL/hour — 1.5 × maintenance, the usual crisis target. */
  fluidMlPerHour: number;
  analgesia: string[];
  investigations: string[];
  redFlags: string[];
  transfusionConsidered: boolean;
  exchangeConsidered: boolean;
}

export function sickleCrisisPlan(input: SickleCrisisInput): SickleCrisisPlan {
  const wt = Number(input.weightKg) || 0;
  const pain = Number(input.painScore) || 0;
  const painSeverity: PainSeverity = pain >= 7 ? 'severe' : pain >= 4 ? 'moderate' : 'mild';

  // Crisis hydration is conventionally 1.5 × maintenance; over-hydration
  // precipitates acute chest syndrome, so this is a target not a licence.
  const fluidMlPerHour = Math.round(maintenanceFluidMlPerHour(wt) * 1.5);

  const analgesia: string[] = [];
  if (painSeverity === 'mild') {
    analgesia.push('Paracetamol 1 g 6-hourly', 'NSAID if renal function permits and no contraindication');
  } else if (painSeverity === 'moderate') {
    analgesia.push('Paracetamol plus NSAID', 'Add a weak opioid (codeine or tramadol) if not controlled within 30 minutes');
  } else {
    analgesia.push(
      'Strong opioid without delay — morphine 0.1 mg/kg IV, titrated to effect',
      'Reassess pain within 30 minutes and re-dose rather than waiting for the next scheduled time',
      'Prescribe regular laxative and antiemetic alongside the opioid',
    );
  }
  analgesia.push('Do not withhold analgesia pending investigations — pain is the presenting problem, not a sign to be observed.');

  const investigations = [
    'Full blood count with reticulocytes',
    'Renal and liver profile',
    'Group and save',
    'Blood cultures if febrile',
    'Chest radiograph if any respiratory symptom or hypoxia',
  ];

  const redFlags: string[] = [];
  const hb = Number(input.haemoglobinGdL) || 0;
  const baseline = Number(input.baselineHbGdL) || 0;
  const spo2 = Number(input.spo2) || 0;
  const temp = Number(input.temperatureC) || 0;

  if (spo2 > 0 && spo2 < 94) redFlags.push('Hypoxia — exclude acute chest syndrome urgently');
  if (input.chestSymptoms) redFlags.push('Chest symptoms — acute chest syndrome until proven otherwise');
  if (temp >= 38) redFlags.push('Fever — culture and start empirical antibiotics; these patients are functionally asplenic');
  if (hb > 0 && baseline > 0 && hb < baseline - 2) redFlags.push(`Haemoglobin ${hb} g/dL is more than 2 g/dL below the stated baseline of ${baseline}`);
  if (hb > 0 && hb < 5) redFlags.push('Severe anaemia');

  // Simple transfusion is for symptomatic anaemia; exchange is for the
  // situations where reducing the sickled fraction quickly is what matters.
  const transfusionConsidered = (hb > 0 && hb < 5) || (hb > 0 && baseline > 0 && hb < baseline - 2);
  const exchangeConsidered = Boolean(input.chestSymptoms) || Boolean(input.priorStroke) || (spo2 > 0 && spo2 < 90);

  return {
    painSeverity,
    fluidMlPerHour,
    analgesia,
    investigations,
    redFlags,
    transfusionConsidered,
    exchangeConsidered,
  };
}
