/**
 * Clinical nutrition — shared types. The engine is pure: inputs in, traceable
 * results out. Every parameter is optional; each result states the method it
 * used, the inputs it read and the assumptions it made.
 */
import type { Population, Sex } from './config/nutrition.v1';

export type { Population, Sex };

/** One traceable calculation. */
export interface Calc<T = number> {
  value: T;
  method: string;
  inputs: Record<string, number | string | boolean | null>;
  assumptions: string[];
  source?: string;
}

export type WeightMethod = 'measured' | 'bed_scale' | 'hoist' | 'reported' | 'unavailable';
export type AmputationSite = 'hand' | 'forearm_and_hand' | 'whole_arm' | 'foot' | 'below_knee' | 'whole_leg';
export type Mobility = 'bedbound' | 'chair' | 'ambulatory';
export type Stress = 'none' | 'minor_surgery' | 'major_surgery' | 'infection' | 'sepsis' | 'multiple_trauma' | 'burns';
export type Goal = 'maintain' | 'gain' | 'lose';
export type Grade = 'none' | 'mild' | 'moderate' | 'severe';

export interface WeightPoint { date: string; kg: number }

export interface NutritionLabs {
  albuminGL?: number | null;
  prealbuminGL?: number | null;
  crpMgL?: number | null;
  hbGL?: number | null;
  lymphocytes109L?: number | null;
  glucoseMmolL?: number | null;
  hba1cPct?: number | null;
  ureaMmolL?: number | null;
  creatinineUmolL?: number | null;
  naMmolL?: number | null;
  kMmolL?: number | null;
  po4MmolL?: number | null;
  mgMmolL?: number | null;
  /** 24-hour urinary urea nitrogen, g/day. */
  uunG?: number | null;
}

export interface SgaInput {
  weightChange?: 'none' | 'loss_lt5' | 'loss_5_10' | 'loss_gt10';
  intake?: 'normal' | 'suboptimal' | 'starvation';
  giSymptoms?: 'none' | 'intermittent' | 'daily_gt2wk';
  function?: 'full' | 'reduced' | 'bedridden';
  fatLoss?: Grade;
  muscleWasting?: Grade;
  oedema?: Grade;
  /** The clinician's own global rating — always wins over the suggestion. */
  rating?: 'A' | 'B' | 'C';
}

export interface NutritionInputs {
  ageYears?: number | null;
  sex?: Sex | null;
  population?: Population;
  ward?: string;
  diagnosis?: string;
  pregnant?: boolean;
  lactating?: boolean;
  dialysis?: boolean;
  parenteral?: boolean;

  // Anthropometry
  weightKg?: number | null;
  weightMethod?: WeightMethod;
  dressingKg?: number | null;
  weightHistory?: WeightPoint[];
  /** Used when there is no weight history: % unplanned loss in 3–6 months. */
  weightLossPct3to6m?: number | null;
  heightCm?: number | null;
  heightMeasured?: boolean;
  kneeHeightCm?: number | null;
  ulnaCm?: number | null;
  muacCm?: number | null;
  tsfMm?: number | null;
  calfCm?: number | null;
  gripKg?: number | null;
  amputations?: AmputationSite[];
  oedema?: Grade;
  ascites?: Grade;
  phaseAngle?: number | null;
  quadricepsMm?: number | null;

  // Clinical
  tbsaPct?: number | null;
  daysSinceInjury?: number | null;
  woundAreaCm2?: number | null;
  exudate?: 'none' | 'low' | 'moderate' | 'high';
  icu?: boolean;
  ventilated?: boolean;
  minuteVentilationL?: number | null;
  tMaxC?: number | null;
  sepsis?: boolean;
  diabetes?: boolean;
  ckd?: boolean;
  liverDisease?: boolean;
  heartFailure?: boolean;
  giDysfunction?: boolean;
  malabsorption?: boolean;
  mobility?: Mobility;
  stress?: Stress;
  /** ICU severity for NUTRIC. */
  apache2?: number | null;
  sofa?: number | null;
  comorbidityCount?: number | null;
  daysHospitalToIcu?: number | null;
  il6?: number | null;
  /** NRS-2002 disease severity (0–3), if the clinician has graded it. */
  nrsSeverity?: 0 | 1 | 2 | 3;

  // Intake
  intakePctOfNeeds?: number | null;
  daysLittleOrNoIntake?: number | null;
  acutelyIllNoIntake5d?: boolean;
  previousDayKcal?: number | null;
  alcoholMisuse?: boolean;
  /** Insulin, chemotherapy, antacids or diuretics (NICE CG32 minor criterion). */
  refeedingDrugs?: boolean;

  labs?: NutritionLabs;
  dietary?: {
    texture?: 'normal' | 'soft' | 'minced_moist' | 'pureed' | 'liquid';
    allergies?: string[];
    religious?: string[];
    preferences?: string[];
    budget?: 'low' | 'medium' | 'high';
    mealsBy?: 'hospital' | 'family';
    route?: 'oral' | 'oral_ons' | 'enteral';
  };
  sga?: SgaInput;
  muscleMass?: 'normal' | 'mild_moderate' | 'severe';

  // Requirements
  indirectCalorimetryKcal?: number | null;
  goal?: Goal;
  targetRateKgWk?: number | null;
  /** Clinician reason that allows a plan below the kcal floor or weight loss while catabolic. */
  override?: { belowFloor?: string; lossWhileCatabolic?: string };
  energyMethod?: string;
}
