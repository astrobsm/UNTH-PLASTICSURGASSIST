/**
 * Screening and diagnosis: MUST, NRS-2002, SGA, GLIM, (m)NUTRIC.
 * Each returns null when its minimum inputs are missing, so the caller can
 * show "not enough data" rather than a falsely reassuring zero.
 */
import type { NutritionConfig } from './config/nutrition.v1';
import type { Calc, NutritionInputs } from './types';

export type Risk = 'low' | 'medium' | 'high';

export interface Anthro { bmi: number | null; muacBand: 'lt20' | 'gt30' | 'indeterminate' | null; lossPct: number | null }

export function mustOf(i: NutritionInputs, a: Anthro, cfg: NutritionConfig): (Calc & { risk: Risk; parts: { bmi: number; loss: number; acute: number } }) | null {
  const k = cfg.must.value;
  const assumptions: string[] = [];
  let bmiPts: number | null = null;
  if (a.bmi !== null) bmiPts = a.bmi < k.bmi2 ? 2 : a.bmi < k.bmi1 ? 1 : 0;
  else if (a.muacBand) {
    bmiPts = a.muacBand === 'lt20' ? 1 : 0;
    assumptions.push(a.muacBand === 'lt20' ? 'BMI from MUAC: likely < 20 — scored 1 (may be 2 if BMI < 18.5)' : 'BMI from MUAC: no low-BMI points');
  }
  if (bmiPts === null) return null;
  let lossPts = 0;
  if (a.lossPct === null) assumptions.push('Weight loss unknown — scored 0; ask about loose clothing/rings');
  else lossPts = a.lossPct > k.loss2 ? 2 : a.lossPct >= k.loss1 ? 1 : 0;
  const acutePts = i.acutelyIllNoIntake5d ? k.acute : 0;
  const s = bmiPts + lossPts + acutePts;
  return {
    value: s, risk: s >= 2 ? 'high' : s === 1 ? 'medium' : 'low', parts: { bmi: bmiPts, loss: lossPts, acute: acutePts },
    method: 'MUST (BAPEN)', inputs: { bmi: a.bmi, muacBand: a.muacBand, lossPct: a.lossPct, acute: !!i.acutelyIllNoIntake5d },
    assumptions, source: cfg.must.source,
  };
}

export function nrs2002Of(i: NutritionInputs, a: Anthro, cfg: NutritionConfig): (Calc & { atRisk: boolean }) | null {
  if (i.nrsSeverity === undefined) return null;
  const intake = i.intakePctOfNeeds;
  const loss = a.lossPct;
  const impaired = !!(i.mobility && i.mobility !== 'ambulatory') || !!i.sepsis || !!i.icu;
  let status = 0;
  // Weight-loss time frame is approximated from the 3–6 month figure.
  if ((loss !== null && loss > 15) || (a.bmi !== null && a.bmi < 18.5 && impaired) || (intake != null && intake <= 25)) status = 3;
  else if ((a.bmi !== null && a.bmi < 20.5 && impaired) || (intake != null && intake <= 60)) status = 2;
  else if ((loss !== null && loss > 5) || (intake != null && intake <= 75)) status = 1;
  const ageAdj = (i.ageYears ?? 0) >= cfg.nrs2002.value.ageAdjustFrom ? 1 : 0;
  const total = status + i.nrsSeverity + ageAdj;
  return {
    value: total, atRisk: total >= cfg.nrs2002.value.atRisk, method: 'NRS-2002 (nutritional status + severity + age)',
    inputs: { status, severity: i.nrsSeverity, ageAdj, lossPct: loss, intakePct: intake ?? null, bmi: a.bmi },
    assumptions: ['Weight-loss time window approximated from the 3–6 month figure', 'Impaired general condition inferred from mobility, sepsis or ICU'],
    source: cfg.nrs2002.source,
  };
}

/** SGA: the clinician's rating stands; a rule-based suggestion is offered alongside. */
export function sgaOf(i: NutritionInputs): (Calc<'A' | 'B' | 'C'> & { suggested: 'A' | 'B' | 'C'; clinicianRated: boolean }) | null {
  const s = i.sga;
  if (!s || Object.keys(s).length === 0) return null;
  const severe = [s.weightChange === 'loss_gt10', s.intake === 'starvation', s.muscleWasting === 'severe', s.fatLoss === 'severe'].filter(Boolean).length;
  const moderate = [s.weightChange === 'loss_5_10', s.intake === 'suboptimal', s.giSymptoms === 'daily_gt2wk',
    s.function === 'bedridden', s.muscleWasting === 'mild' || s.muscleWasting === 'moderate', s.fatLoss === 'mild' || s.fatLoss === 'moderate'].filter(Boolean).length;
  const suggested = severe >= 2 ? 'C' : severe >= 1 || moderate >= 2 ? 'B' : 'A';
  return {
    value: s.rating ?? suggested, suggested, clinicianRated: !!s.rating,
    method: s.rating ? 'SGA — clinician global rating' : 'SGA — rule-based suggestion (needs clinician rating)',
    inputs: { ...s } as Calc['inputs'], assumptions: s.rating ? [] : ['SGA is a clinical judgement; the suggestion is not a diagnosis'],
    source: 'Detsky AS et al. JPEN 1987;11:8–13',
  };
}

export function glimOf(i: NutritionInputs, a: Anthro, cfg: NutritionConfig): (Calc<'none' | 'moderate' | 'severe' | 'insufficient'> & { phenotypic: string[]; etiologic: string[] }) {
  const k = cfg.glim.value;
  const old = (i.ageYears ?? 0) >= 70;
  const phenotypic: string[] = [];
  let severe = false;
  const loss = a.lossPct;
  if (loss !== null && loss > k.lossModerateWithin6m) { phenotypic.push(`Weight loss ${loss}%`); if (loss > k.lossSevereWithin6m) severe = true; }
  if (a.bmi !== null) {
    const mod = old ? k.bmiModerateFrom70 : k.bmiModerateUnder70, sev = old ? k.bmiSevereFrom70 : k.bmiSevereUnder70;
    if (a.bmi < mod) { phenotypic.push(`Low BMI ${a.bmi}`); if (a.bmi < sev) severe = true; }
  }
  let muscle = i.muscleMass;
  const calfAssumption: string[] = [];
  if (!muscle && i.calfCm && i.sex && !(i.oedema && i.oedema !== 'none')) {
    if (i.calfCm < cfg.calfLowCm[i.sex].value) { muscle = 'mild_moderate'; calfAssumption.push(`Reduced muscle mass inferred from calf ${i.calfCm} cm`); }
  }
  if (muscle && muscle !== 'normal') { phenotypic.push(muscle === 'severe' ? 'Severe muscle deficit' : 'Reduced muscle mass'); if (muscle === 'severe') severe = true; }

  const etiologic: string[] = [];
  if ((i.intakePctOfNeeds != null && i.intakePctOfNeeds <= 50) || (i.daysLittleOrNoIntake ?? 0) > 7) etiologic.push('Reduced intake');
  if (i.malabsorption || i.giDysfunction) etiologic.push('Reduced assimilation');
  const crp = i.labs?.crpMgL;
  if (i.sepsis || (i.tbsaPct ?? 0) > 0 || (crp != null && crp > 10) || (i.woundAreaCm2 ?? 0) > 0) etiologic.push('Inflammation / disease burden');

  const inputs = { bmi: a.bmi, lossPct: loss, muscleMass: muscle ?? null, crpMgL: crp ?? null, ageYears: i.ageYears ?? null };
  const haveData = a.bmi !== null || loss !== null || !!muscle;
  const value = !haveData ? 'insufficient' : phenotypic.length && etiologic.length ? (severe ? 'severe' : 'moderate') : 'none';
  return {
    value, phenotypic, etiologic, method: 'GLIM: ≥ 1 phenotypic + ≥ 1 etiologic criterion', inputs,
    assumptions: [...calfAssumption, ...(value === 'insufficient' ? ['No BMI, weight-loss or muscle-mass data'] : [])], source: cfg.glim.source,
  };
}

export function nutricOf(i: NutritionInputs, cfg: NutritionConfig): (Calc & { high: boolean; withIl6: boolean }) | null {
  if (!i.icu || i.apache2 == null || i.sofa == null || i.ageYears == null) return null;
  const age = i.ageYears < 50 ? 0 : i.ageYears < 75 ? 1 : 2;
  const ap = i.apache2 < 15 ? 0 : i.apache2 < 20 ? 1 : i.apache2 < 28 ? 2 : 3;
  const so = i.sofa < 6 ? 0 : i.sofa < 10 ? 1 : 2;
  const co = (i.comorbidityCount ?? 0) >= 2 ? 1 : 0;
  const days = (i.daysHospitalToIcu ?? 0) >= 1 ? 1 : 0;
  const withIl6 = i.il6 != null;
  const il6 = withIl6 ? (i.il6! >= 400 ? 1 : 0) : 0;
  const total = age + ap + so + co + days + il6;
  const cut = withIl6 ? cfg.nutric.value.highWithIl6 : cfg.nutric.value.highWithoutIl6;
  return {
    value: total, high: total >= cut, withIl6, method: withIl6 ? 'NUTRIC (with IL-6)' : 'Modified NUTRIC (no IL-6)',
    inputs: { age, apache2: ap, sofa: so, comorbidities: co, daysToIcu: days, il6 },
    assumptions: [...(i.comorbidityCount == null ? ['Comorbidity count not given — scored 0'] : []), ...(i.daysHospitalToIcu == null ? ['Days hospital → ICU not given — scored 0'] : [])],
    source: cfg.nutric.source,
  };
}
