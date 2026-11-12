/**
 * Critical-care formulas the app did not yet have. Everything else (CKD-EPI,
 * Cockcroft–Gault, KDIGO creatinine staging, acid–base compensation, anion
 * gap, osmolality, total body water, replacement plans, qSOFA, NEWS2, MAP,
 * Parkland) is reused from the existing engines — see analyse.ts.
 *
 * All functions are pure and return null when an input is missing.
 */
import { NUTRITION_CONFIG } from '../nutrition/config';
import { adjustedBwOf, ibwOf } from '../nutrition/anthropometry';

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const pos = (x: unknown): x is number => ok(x) && x > 0;
export const r = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Dosing weight: IBW if actual ≥ IBW; actual if below IBW; adjusted if actual > 120% of IBW. */
export function dosingWeight(actualKg: number | null | undefined, heightCm: number | null | undefined, sex: 'male' | 'female' | null) {
  if (!pos(actualKg)) return null;
  const ibw = ibwOf(pos(heightCm) ? heightCm : null, sex, NUTRITION_CONFIG)?.value ?? null;
  if (!ibw) return { kg: actualKg, used: 'actual' as const, ibw: null, adj: null, note: 'Height or sex missing — actual weight used' };
  if (actualKg < ibw) return { kg: actualKg, used: 'actual' as const, ibw, adj: null, note: 'Actual weight is below ideal — actual used' };
  if (actualKg > 1.2 * ibw) {
    const adj = adjustedBwOf(actualKg, ibw, NUTRITION_CONFIG)!.value;
    return { kg: adj, used: 'adjusted' as const, ibw, adj, note: 'Actual weight > 120% of ideal — adjusted body weight used' };
  }
  return { kg: ibw, used: 'ideal' as const, ibw, adj: null, note: 'Ideal body weight used' };
}

/** Bedside Schwartz eGFR for children (mL/min/1.73 m²). */
export const schwartz = (heightCm: number | null | undefined, creatUmol: number | null | undefined) =>
  pos(heightCm) && pos(creatUmol) ? r((36.5 * heightCm) / creatUmol, 0) : null;

/** KDIGO urine-output stage from hourly volumes (latest last), with the consecutive duration behind it. */
export function akiUrineStage(hourlyMl: number[] | undefined, weightKg: number | null | undefined) {
  if (!hourlyMl?.length || !pos(weightKg)) return null;
  const rates = hourlyMl.filter(ok).map(v => v / weightKg);
  const run = (pred: (x: number) => boolean) => { let n = 0; for (let k = rates.length - 1; k >= 0 && pred(rates[k]); k--) n++; return n; };
  const lt05 = run(x => x < 0.5), lt03 = run(x => x < 0.3), anuria = run(x => x === 0);
  let stage: 0 | 1 | 2 | 3 = 0;
  if (lt03 >= 24 || anuria >= 12) stage = 3;
  else if (lt05 >= 12) stage = 2;
  else if (lt05 >= 6) stage = 1;
  const latest = rates[rates.length - 1];
  return { stage, hoursBelow05: lt05, hoursBelow03: lt03, hoursAnuric: anuria, latestMlKgH: r(latest, 2), hoursRecorded: rates.length };
}

export const fena = (uNa?: number | null, pCr?: number | null, pNa?: number | null, uCr?: number | null) =>
  pos(uNa) && pos(pCr) && pos(pNa) && pos(uCr) ? r(((uNa * pCr) / (pNa * uCr)) * 100, 2) : null;
export const feurea = (uUrea?: number | null, pCr?: number | null, pUrea?: number | null, uCr?: number | null) =>
  pos(uUrea) && pos(pCr) && pos(pUrea) && pos(uCr) ? r(((uUrea * pCr) / (pUrea * uCr)) * 100, 1) : null;

/** Delta ratio (AG − 12) ÷ (24 − HCO3); null when HCO3 ≥ 24 (not meaningful). */
export const deltaRatio = (ag?: number | null, hco3?: number | null) => (ok(ag) && ok(hco3) && hco3 < 24 ? r((ag - 12) / (24 - hco3), 2) : null);

export function deltaRatioMeaning(d: number) {
  return d < 0.4 ? 'normal-anion-gap acidosis' : d < 0.8 ? 'mixed high- and normal-anion-gap acidosis' : d <= 2 ? 'pure high-anion-gap acidosis' : 'high-anion-gap acidosis with coexisting metabolic alkalosis (or pre-existing high HCO3)';
}

export const bicarbonateDeficit = (weightKg?: number | null, target?: number, hco3?: number | null) =>
  pos(weightKg) && ok(target) && ok(hco3) && target > hco3 ? r(0.5 * weightKg * (target - hco3), 0) : null;

/** Adrogué–Madias predicted change in serum Na per litre of infusate. */
export const adrogueMadias = (infusateNa: number, infusateK: number, serumNa: number, tbwL: number) => (infusateNa + infusateK - serumNa) / (tbwL + 1);
export const INFUSATES: { name: string; na: number; k: number }[] = [
  { name: '3% NaCl', na: 513, k: 0 }, { name: '0.9% NaCl', na: 154, k: 0 }, { name: "Ringer's lactate", na: 130, k: 4 },
  { name: '0.45% NaCl', na: 77, k: 0 }, { name: '4% dextrose/0.18% NaCl', na: 31, k: 0 }, { name: '5% dextrose', na: 0, k: 0 },
];

export const effectiveOsmolality = (na?: number | null, glucose?: number | null) => (ok(na) && ok(glucose) ? r(2 * na + glucose, 0) : null);
export const shockIndex = (hr?: number | null, sbp?: number | null) => (pos(hr) && pos(sbp) ? r(hr / sbp, 2) : null);
/** SpO2/FiO2 — only valid for SpO2 ≤ 97% (the curve flattens above). */
export const sfRatio = (spo2?: number | null, fio2?: number | null) => (pos(spo2) && pos(fio2) && spo2 <= 97 ? r(spo2 / (fio2 > 1 ? fio2 / 100 : fio2), 0) : null);

/** Holliday–Segar maintenance (mL/day) for children. */
export function hollidaySegar(weightKg?: number | null) {
  if (!pos(weightKg)) return null;
  const a = Math.min(weightKg, 10) * 100, b = Math.min(Math.max(weightKg - 10, 0), 10) * 50, c = Math.max(weightKg - 20, 0) * 20;
  return r(a + b + c, 0);
}

export interface Scored { value: number | null; complete: boolean; missing: string[]; parts: Record<string, number> }

/** SOFA (each organ 0–4). Missing organs are listed and scored nothing — never assumed normal. */
export function sofa(x: {
  pfMmHg?: number | null; sfRatio?: number | null; ventilated?: boolean; plt?: number | null; bilirubinUmol?: number | null;
  map?: number | null; vasopressor?: 'none' | 'low' | 'high' | null; gcs?: number | null; creatUmol?: number | null; uoMlDay?: number | null;
}): Scored & { surrogateResp: boolean } {
  const parts: Record<string, number> = {}; const missing: string[] = [];
  let surrogateResp = false;
  const pf = ok(x.pfMmHg) ? x.pfMmHg : ok(x.sfRatio) ? (surrogateResp = true, (x.sfRatio - 64) / 0.84) : null; // Rice 2007 S/F→P/F
  if (pf == null) missing.push('PaO₂/FiO₂ (or SpO₂/FiO₂)');
  else parts.respiration = pf < 100 && x.ventilated ? 4 : pf < 200 && x.ventilated ? 3 : pf < 300 ? 2 : pf < 400 ? 1 : 0;
  if (!ok(x.plt)) missing.push('platelets'); else parts.coagulation = x.plt < 20 ? 4 : x.plt < 50 ? 3 : x.plt < 100 ? 2 : x.plt < 150 ? 1 : 0;
  if (!ok(x.bilirubinUmol)) missing.push('bilirubin'); else parts.liver = x.bilirubinUmol >= 204 ? 4 : x.bilirubinUmol >= 102 ? 3 : x.bilirubinUmol >= 33 ? 2 : x.bilirubinUmol >= 20 ? 1 : 0;
  if (x.vasopressor === 'high') parts.cardiovascular = 4;
  else if (x.vasopressor === 'low') parts.cardiovascular = 3;
  else if (ok(x.map)) parts.cardiovascular = x.map < 70 ? 1 : 0;
  else missing.push('MAP / vasopressors');
  if (!ok(x.gcs)) missing.push('GCS'); else parts.cns = x.gcs < 6 ? 4 : x.gcs < 10 ? 3 : x.gcs < 13 ? 2 : x.gcs < 15 ? 1 : 0;
  if (!ok(x.creatUmol) && !ok(x.uoMlDay)) missing.push('creatinine or urine output');
  else {
    const c = ok(x.creatUmol) ? (x.creatUmol >= 440 ? 4 : x.creatUmol >= 300 ? 3 : x.creatUmol >= 171 ? 2 : x.creatUmol >= 110 ? 1 : 0) : 0;
    const u = ok(x.uoMlDay) ? (x.uoMlDay < 200 ? 4 : x.uoMlDay < 500 ? 3 : 0) : 0;
    parts.renal = Math.max(c, u);
  }
  const vals = Object.values(parts);
  return { value: vals.length ? vals.reduce((a, b) => a + b, 0) : null, complete: missing.length === 0, missing, parts, surrogateResp };
}

export function curb65(x: { confusion?: boolean | null; ureaMmol?: number | null; rr?: number | null; sbp?: number | null; dbp?: number | null; age?: number | null }): Scored {
  const missing: string[] = []; const parts: Record<string, number> = {};
  if (x.confusion == null) missing.push('confusion'); else parts.confusion = x.confusion ? 1 : 0;
  if (!ok(x.ureaMmol)) missing.push('urea'); else parts.urea = x.ureaMmol > 7 ? 1 : 0;
  if (!ok(x.rr)) missing.push('respiratory rate'); else parts.rr = x.rr >= 30 ? 1 : 0;
  if (!ok(x.sbp) && !ok(x.dbp)) missing.push('blood pressure'); else parts.bp = (ok(x.sbp) && x.sbp < 90) || (ok(x.dbp) && x.dbp <= 60) ? 1 : 0;
  if (!ok(x.age)) missing.push('age'); else parts.age = x.age >= 65 ? 1 : 0;
  const v = Object.values(parts);
  return { value: v.length ? v.reduce((a, b) => a + b, 0) : null, complete: !missing.length, missing, parts };
}

export function childPugh(x: { bilirubinUmol?: number | null; albuminGL?: number | null; inr?: number | null; ascites?: 'none' | 'mild' | 'severe' | null; encephalopathy?: 'none' | 'grade1-2' | 'grade3-4' | null }): Scored & { klass: 'A' | 'B' | 'C' | null } {
  const missing: string[] = []; const parts: Record<string, number> = {};
  if (!ok(x.bilirubinUmol)) missing.push('bilirubin'); else parts.bilirubin = x.bilirubinUmol < 34 ? 1 : x.bilirubinUmol <= 50 ? 2 : 3;
  if (!ok(x.albuminGL)) missing.push('albumin'); else parts.albumin = x.albuminGL > 35 ? 1 : x.albuminGL >= 28 ? 2 : 3;
  if (!ok(x.inr)) missing.push('INR'); else parts.inr = x.inr < 1.7 ? 1 : x.inr <= 2.3 ? 2 : 3;
  if (!x.ascites) missing.push('ascites grade'); else parts.ascites = x.ascites === 'none' ? 1 : x.ascites === 'mild' ? 2 : 3;
  if (!x.encephalopathy) missing.push('encephalopathy grade'); else parts.encephalopathy = x.encephalopathy === 'none' ? 1 : x.encephalopathy === 'grade1-2' ? 2 : 3;
  const v = Object.values(parts); const total = v.reduce((a, b) => a + b, 0);
  const complete = !missing.length;
  return { value: v.length ? total : null, complete, missing, parts, klass: complete ? (total <= 6 ? 'A' : total <= 9 ? 'B' : 'C') : null };
}

/** MELD (UNOS) and MELD-Na. Lab values below 1 are set to 1; creatinine capped at 4 mg/dL (4 if on dialysis). */
export function meldNa(x: { bilirubinUmol?: number | null; inr?: number | null; creatUmol?: number | null; na?: number | null; dialysis?: boolean }): { meld: number | null; meldNa: number | null; missing: string[] } {
  const missing = [!ok(x.bilirubinUmol) && 'bilirubin', !ok(x.inr) && 'INR', !ok(x.creatUmol) && !x.dialysis && 'creatinine'].filter(Boolean) as string[];
  if (missing.length) return { meld: null, meldNa: null, missing: [...missing, ...(ok(x.na) ? [] : ['sodium'])] };
  const bili = Math.max(1, x.bilirubinUmol! / 17.1), inr = Math.max(1, x.inr!);
  const cr = x.dialysis ? 4 : Math.min(4, Math.max(1, x.creatUmol! / 88.4));
  const meld = Math.round(10 * (0.957 * Math.log(cr) + 0.378 * Math.log(bili) + 1.12 * Math.log(inr) + 0.643));
  if (!ok(x.na)) return { meld, meldNa: null, missing: ['sodium'] };
  const na = Math.min(137, Math.max(125, x.na));
  const mna = meld > 11 ? Math.round(meld + 1.32 * (137 - na) - 0.033 * meld * (137 - na)) : meld;
  return { meld, meldNa: mna, missing: [] };
}

/** DKA and HHS by the criteria in the specification. */
export function hyperglycaemicCrisis(x: { glucose?: number | null; ketones?: number | null; urineKetones?: string | null; ph?: number | null; hco3?: number | null; effOsm?: number | null; knownDiabetes?: boolean }) {
  const ketosis = (ok(x.ketones) && x.ketones >= 3) || /2\+|3\+|4\+|\+\+/.test(String(x.urineKetones || ''));
  const acid = (ok(x.ph) && x.ph < 7.3) || (ok(x.hco3) && x.hco3 < 15);
  const dka = ((ok(x.glucose) && x.glucose > 11) || !!x.knownDiabetes) && ketosis && acid;
  const hhs = ok(x.glucose) && x.glucose >= 30 && ok(x.effOsm) && x.effOsm > 320 && !(ok(x.ketones) && x.ketones >= 3);
  const missing = [!ok(x.glucose) && 'glucose', !ok(x.ketones) && !x.urineKetones && 'ketones', !ok(x.ph) && !ok(x.hco3) && 'pH or HCO3'].filter(Boolean) as string[];
  return { dka, hhs, missing };
}
