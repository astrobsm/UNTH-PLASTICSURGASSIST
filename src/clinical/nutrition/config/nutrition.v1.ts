/**
 * Nutrition coefficients and thresholds — version 1.
 *
 * Every number the nutrition engine uses lives here, with its source. Nothing
 * clinical is hard-coded in the formulas. The whole set is marked
 * "pending_clinical_validation" until a dietitian or consultant signs it off;
 * the engine stamps CONFIG.version on every result so a plan can always be
 * traced to the coefficients that produced it.
 *
 * To change a value: copy this file to nutrition.v2.ts, edit, bump `version`,
 * point `src/clinical/nutrition/config/index.ts` at it. Never edit a version
 * that has produced approved plans — those plans cite it.
 */

export type Population = 'black' | 'white';
export type Sex = 'male' | 'female';

export interface Coef<T> { value: T; source: string; note?: string }

const c = <T,>(value: T, source: string, note?: string): Coef<T> => ({ value, source, ...(note ? { note } : {}) });

export const NUTRITION_CONFIG_V1 = {
  version: '1.0.0',
  status: 'pending_clinical_validation' as 'pending_clinical_validation' | 'validated',
  defaultPopulation: c<Population>('black', 'UNTH default — South-East Nigerian population; selectable per patient'),

  // ── Height when it cannot be measured ────────────────────────────────────
  /** Stature (cm) = a + b × knee height (cm) + c × age (y). */
  kneeHeight: {
    adult: {
      black: { male: c({ a: 73.42, b: 1.79, c: 0 }, 'Chumlea WC, Guo SS, Steinbaugh ML. J Am Diet Assoc 1994;94:1385–8 (NHANES III, 18–60 y)'),
        female: c({ a: 68.10, b: 1.86, c: -0.06 }, 'Chumlea 1994, as above') },
      white: { male: c({ a: 71.85, b: 1.88, c: 0 }, 'Chumlea 1994, as above'),
        female: c({ a: 70.25, b: 1.87, c: -0.06 }, 'Chumlea 1994, as above') },
    },
    older: { // > 60 y
      black: { male: c({ a: 79.69, b: 1.85, c: -0.14 }, 'Chumlea WC et al. J Am Diet Assoc 1998;98:137–42 (NHANES III, ≥ 60 y)'),
        female: c({ a: 89.58, b: 1.61, c: -0.17 }, 'Chumlea 1998, as above') },
      white: { male: c({ a: 78.31, b: 1.94, c: -0.14 }, 'Chumlea 1998, as above'),
        female: c({ a: 82.21, b: 1.85, c: -0.21 }, 'Chumlea 1998, as above') },
    },
    olderFromAge: c(60, 'Chumlea 1994/1998 age bands'),
  },
  /** Stature (cm) = a + b × ulna length (cm). Linear fit of the BAPEN MUST table. */
  ulna: {
    male: { under65: c({ a: 79.2, b: 3.60 }, 'BAPEN MUST explanatory booklet (2003), ulna-length table — linear fit'),
      from65: c({ a: 86.3, b: 3.15 }, 'BAPEN MUST, as above') },
    female: { under65: c({ a: 95.6, b: 2.77 }, 'BAPEN MUST, as above'),
      from65: c({ a: 80.4, b: 3.25 }, 'BAPEN MUST, as above') },
    note: 'Derived from a predominantly white UK population; no validated Nigerian ulna equation was found.',
  },

  // ── Weight when it cannot be measured ────────────────────────────────────
  /** Weight (kg) = a × knee height (cm) + b × MUAC (cm) + k. */
  weightFromKneeMuac: {
    adult: {
      black: { male: c({ a: 1.09, b: 3.14, k: -83.72 }, 'Chumlea WC et al. 1988, Ross Laboratories equations (18–60 y)'),
        female: c({ a: 1.24, b: 2.97, k: -82.48 }, 'Chumlea 1988, as above') },
      white: { male: c({ a: 1.19, b: 3.21, k: -86.82 }, 'Chumlea 1988, as above'),
        female: c({ a: 1.01, b: 2.81, k: -66.04 }, 'Chumlea 1988, as above') },
    },
    older: {
      black: { male: c({ a: 0.44, b: 2.86, k: -39.21 }, 'Chumlea 1988, as above (60–80 y)'),
        female: c({ a: 1.50, b: 2.58, k: -84.22 }, 'Chumlea 1988, as above') },
      white: { male: c({ a: 1.10, b: 3.07, k: -75.81 }, 'Chumlea 1988, as above'),
        female: c({ a: 1.09, b: 2.68, k: -65.51 }, 'Chumlea 1988, as above') },
    },
    olderFromAge: c(60, 'Chumlea 1988 age bands'),
    accuracy: c(8, 'Reported SEE ≈ ±8 kg — use for estimates only, never for drug dosing'),
  },
  muacBmi: {
    lowCm: c(23.5, 'BAPEN MUST: MUAC < 23.5 cm → BMI likely < 20 kg/m²'),
    highCm: c(32.0, 'BAPEN MUST: MUAC > 32.0 cm → BMI likely > 30 kg/m²'),
  },
  /** Fraction of whole-body weight by segment. */
  amputation: c({
    hand: 0.007, forearm_and_hand: 0.023, whole_arm: 0.050,
    foot: 0.015, below_knee: 0.059, whole_leg: 0.160,
  }, 'Osterkamp LK. J Am Diet Assoc 1995;95:215–8'),

  // ── Body-weight standards ─────────────────────────────────────────────────
  ibwDevine: {
    male: c({ base: 50, perCmOver152_4: 0.9055 }, 'Devine BJ. Drug Intell Clin Pharm 1974;8:650 (50 kg + 2.3 kg per inch over 5 ft)'),
    female: c({ base: 45.5, perCmOver152_4: 0.9055 }, 'Devine 1974 (45.5 kg + 2.3 kg per inch over 5 ft)'),
  },
  adjustedBwFactor: c(0.4, 'AdjBW = IBW + 0.4 × (actual − IBW) — Krenitsky / ASPEN convention'),
  obeseBmi: c(30, 'WHO obesity threshold'),

  // ── Muscle function ───────────────────────────────────────────────────────
  gripLowKg: {
    male: c(27, 'EWGSOP2 (Cruz-Jentoft 2019), derived from Dodds et al. 2014 normative data'),
    female: c(16, 'EWGSOP2, as above'),
    note: 'UK-derived cut-offs; no Nigerian reference values identified. Pending local validation.',
  },
  calfLowCm: {
    male: c(33, 'GLIM muscle-mass guidance (Barazzoni 2022) — non-Asian provisional cut-off'),
    female: c(32, 'GLIM 2022, as above'),
  },

  // ── Screening tools ───────────────────────────────────────────────────────
  must: c({ bmi1: 20, bmi2: 18.5, loss1: 5, loss2: 10, acute: 2 }, 'BAPEN MUST (2003)'),
  nrs2002: c({ ageAdjustFrom: 70, atRisk: 3 }, 'Kondrup J et al. Clin Nutr 2003;22:321–36'),
  glim: c({
    lossModerateWithin6m: 5, lossSevereWithin6m: 10, lossModerateBeyond6m: 10, lossSevereBeyond6m: 20,
    bmiModerateUnder70: 20, bmiSevereUnder70: 18.5, bmiModerateFrom70: 22, bmiSevereFrom70: 20,
  }, 'Cederholm T et al. GLIM criteria. Clin Nutr 2019;38:1–9'),
  nutric: c({ highWithIl6: 6, highWithoutIl6: 5 }, 'Heyland DK et al. Crit Care 2011;15:R268; Rahman A et al. Clin Nutr 2016 (mNUTRIC)'),

  // ── Energy ────────────────────────────────────────────────────────────────
  harrisBenedict: {
    male: c({ k: 66.5, w: 13.75, h: 5.003, a: -6.755 }, 'Harris JA, Benedict FG 1919'),
    female: c({ k: 655.1, w: 9.563, h: 1.850, a: -4.676 }, 'Harris & Benedict 1919'),
  },
  activityFactor: c({ bedbound: 1.1, chair: 1.2, ambulatory: 1.3 }, 'BAPEN/PENG pocket guide — physical activity level'),
  stressFactor: c({
    none: 1.0, minor_surgery: 1.1, major_surgery: 1.2, infection: 1.2, sepsis: 1.3, multiple_trauma: 1.4, burns: 1.5,
  }, 'Long CL et al. JPEN 1979; PENG 2011 stress factors'),
  mifflin: c({ w: 10, h: 6.25, a: -5, male: 5, female: -161 }, 'Mifflin MD et al. Am J Clin Nutr 1990;51:241–7'),
  pennState2003b: c({ mifflin: 0.96, ve: 31, tmax: 167, k: -6212 }, 'Frankenfield D et al. JPEN 2004; Penn State 2003b'),
  pennState2010: c({ mifflin: 0.71, ve: 64, tmax: 85, k: -3085 }, 'Frankenfield D. JPEN 2011 (age ≥ 60 with BMI ≥ 30)'),
  pennState2010When: c({ ageFrom: 60, bmiFrom: 30 }, 'Frankenfield 2011'),
  toronto: c({ k: -4343, tbsa: 10.5, intake: 0.23, hbRee: 0.84, temp: 114, day: -4.5 }, 'Allard JP et al. JPEN 1990;14:115–8 (Toronto formula)'),
  curreri: c({ perKg: 25, perTbsa: 40, tbsaCap: 50 }, 'Curreri PW et al. J Am Diet Assoc 1974;65:415 — known to overestimate'),
  icuKcalPerKg: c({ earlyLow: 20, earlyHigh: 25, lateLow: 25, lateHigh: 30, earlyDays: 3 }, 'ESPEN ICU guideline (Singer 2019/2023): hypocaloric ≤ 70% in the first 3 days'),
  obeseIcu: c({ bmi30to50: { low: 11, high: 14, basis: 'actual' }, bmiOver50: { low: 22, high: 25, basis: 'ibw' } }, 'ASPEN/SCCM critical care guideline (McClave 2016; Compher 2022)'),
  kcalPerKgWard: c({ low: 25, high: 30 }, 'ESPEN 2017 surgery / NICE CG32 maintenance range'),

  // ── Protein (g/kg/day) ────────────────────────────────────────────────────
  protein: c({
    ward: { low: 1.0, high: 1.5, target: 1.2 },
    icu: { low: 1.3, high: 1.5, target: 1.3 },
    woundsBurns: { low: 1.5, high: 2.0, target: 1.8 },
    obeseIcu30to40: { low: 2.0, high: 2.0, target: 2.0 },
    obeseIcuFrom40: { low: 2.5, high: 2.5, target: 2.5 },
    ckdNonDialysis: { low: 0.6, high: 0.8, target: 0.8 },
  }, 'ESPEN surgery 2017, ESPEN ICU 2019, ASPEN/SCCM 2016, KDIGO 2020 (CKD — physician to confirm). Targets within each band are UNTH defaults.'),
  obeseWardProteinBasis: c<'adjusted'>('adjusted', 'UNTH default — obese ward patients: protein on adjusted body weight'),
  catabolicBurnDays: c(60, 'UNTH default — a burn is treated as catabolic until 60 days post-injury or wound closure'),
  largeWoundCm2: c(25, 'UNTH default — open wound area above which protein moves to the wounds/burns band'),

  // ── Weight change ─────────────────────────────────────────────────────────
  kcalPerKgFat: c(7700, 'Hall KD. Int J Obes 2008 — planning constant ~7,700 kcal per kg'),
  lossRateKgWk: c({ low: 0.5, high: 1.0 }, 'NICE CG189 obesity'),
  lossDeficit: c({ low: 500, high: 1000 }, 'NICE CG189'),
  gainRateKgWk: c({ low: 0.25, high: 0.5 }, 'BAPEN/PENG'),
  gainSurplus: c({ low: 300, high: 500 }, 'BAPEN/PENG'),
  kcalFloor: c({ female: 1200, male: 1500 }, 'Brief §3.6 safety floor — override only with clinician reason'),
  rateTooFastFactor: c(1.5, 'UNTH default — alert if observed rate > 1.5 × planned over ≥ 2 weeks'),

  // ── Refeeding (NICE CG32) ─────────────────────────────────────────────────
  refeeding: c({
    major: { bmi: 16, lossPct: 15, nilDays: 10 },
    minor: { bmi: 18.5, lossPct: 10, nilDays: 5 },
    extreme: { bmi: 14, nilDays: 15 },
    lowK: 3.5, lowPO4: 0.8, lowMg: 0.7,
    startKcalPerKg: { high: 10, extreme: 5 },
    advanceDays: { high: 5, extreme: 7 },
    thiamine: 'Oral thiamine 200–300 mg daily, vitamin B co strong 1–2 tablets tds and a balanced multivitamin, starting before feeding and for the first 10 days — per local protocol',
  }, 'NICE CG32 Nutrition support for adults (2006, updated 2017)'),

  // ── Fluid ─────────────────────────────────────────────────────────────────
  fluidMlPerKg: c({ low: 30, high: 35 }, 'NICE CG174 / BAPEN — maintenance 30–35 mL/kg/day'),
  feverExtraPctPerDegree: c(10, 'Common practice — ~10% extra fluid per °C above 37; flagged for clinician review'),

  // ── Biochemistry ─────────────────────────────────────────────────────────
  nitrogen: c({ proteinToN: 6.25, insensibleG: 4 }, 'Standard nitrogen balance; +4 g covers skin/stool, not burn/wound exudate'),
  prealbuminFallPct: c(20, 'UNTH default — "falling" = ≥ 20% drop from the previous value'),

  // ── Monitoring ────────────────────────────────────────────────────────────
  alerts: c({
    lowIntakePct: 60, lowIntakeDays: 3,
    muacCalfDropPct: 5,
    negativeNBalanceRuns: 2,
  }, 'Brief §4; UNTH defaults'),
  schedule: c({
    low: { intake: 'Weekly spot check', weight: 'Weekly', muacCalf: 'Monthly', grip: 'Monthly', labs: 'As clinically indicated', rescreen: 'Weekly (MUST)' },
    medium: { intake: 'Daily food chart', weight: 'Twice weekly', muacCalf: 'Weekly', grip: 'Fortnightly', labs: 'Prealbumin + CRP fortnightly', rescreen: 'Weekly' },
    high: { intake: 'Daily food chart', weight: 'Twice weekly (whenever possible)', muacCalf: 'Twice weekly', grip: 'Weekly', labs: 'Prealbumin + CRP weekly; U&E, PO4, Mg twice weekly', rescreen: 'Twice weekly' },
    refeeding: { intake: 'Daily food chart', weight: 'Daily', muacCalf: 'Twice weekly', grip: 'Weekly', labs: 'K, PO4, Mg before feeding then daily for at least 3 days', rescreen: 'Daily until on full feed' },
  }, 'Brief §4; NICE CG32 monitoring table'),

  // ── Meal plan defaults ────────────────────────────────────────────────────
  macroSplit: c({ carbPct: 50, proteinPct: 20, fatPct: 30 }, 'UNTH default, within WHO/FAO acceptable ranges'),
  diabetesCarbMaxPct: c(45, 'UNTH default for diabetic carbohydrate control (ADA 2019 consensus allows individualisation)'),
  sodiumRestrictedMg: c(2000, 'WHO 2012 sodium guideline (< 2 g/day)'),
  energyTolerancePct: c(5, 'Brief §6.3 — daily energy within ±5%'),
  mealSplit: c({ breakfast: 0.25, lunch: 0.30, dinner: 0.30, snacks: 0.15 }, 'Brief §6.2 default'),
} as const;

export type NutritionConfig = typeof NUTRITION_CONFIG_V1;
