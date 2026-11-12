/**
 * Rule-based critical-care analysis: the structured case → the full review
 * report (every key of the specification, always present).
 *
 * Built on the existing engines, not beside them:
 *  - lab names/units → canonical SI analytes and plausibility rejection:
 *    clinicianAssistant/analyteMapping.toAnalyte;
 *  - findings, grading and electrolyte replacement plans: engine.analyse();
 *  - eGFR (CKD-EPI 2021), Cockcroft–Gault, CKD/AKI creatinine staging,
 *    acid–base compensation, total body water: engine modules;
 *  - anion gap, osmolar gap, corrected calcium, P/F, A–a gradient: the
 *    engine's derived values;
 *  - qSOFA/SIRS and MAP: clinicianAssistant/calculators; NEWS2: templates;
 *    Parkland: burnCareService; adult maintenance fluid: calculators.
 * New here: critical alerts, dosing weight, Schwartz, urine-output AKI
 * staging with duration, FENa/FEUrea, delta ratio, bicarbonate deficit,
 * Adrogué–Madias, DKA/HHS, shock index, S/F, SOFA, CURB-65, Child–Pugh,
 * MELD-Na, Holliday–Segar, trends, the medication review and the plan.
 */
import { toAnalyte } from '../../services/clinicianAssistant/analyteMapping';
import { analyse as engineAnalyse } from '../../services/clinicianAssistant/engine/analyse';
import { emptyExtraction } from '../../services/clinicianAssistant/engine/context';
import { emptyPatient, type Analyte, type Finding, type PatientContext } from '../../services/clinicianAssistant/engine/types';
import { akiStage, ckdEpi2021, ckdStage, cockcroftGault } from '../../services/clinicianAssistant/engine/modules/renal';
import { interpretAcidBase } from '../../services/clinicianAssistant/engine/modules/abg';
import { totalBodyWater } from '../../services/clinicianAssistant/engine/modules/electrolytes';
import { assessSepsis, maintenanceFluidMlPerHour, meanArterialPressure } from '../../services/clinicianAssistant/calculators';
import { news2Of } from '../templates/common';
import { burnCareService } from '../../services/burnCareService';
import {
  adrogueMadias, akiUrineStage, bicarbonateDeficit, childPugh, curb65, deltaRatio, deltaRatioMeaning, dosingWeight, effectiveOsmolality,
  fena, feurea, hollidaySegar, hyperglycaemicCrisis, INFUSATES, meldNa, r, schwartz, sfRatio, shockIndex, sofa,
} from './calculations';
import { classesOf, reviewMedications } from './medications';
import { emptyReport, type CcAlert, type CcCalculation, type CcElectrolyteCorrection, type CcInput, type CcReport, type CcVitals } from './types';

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const KPA = 7.50062; // mmHg per kPa
const lc = (s: unknown) => String(s ?? '').toLowerCase();
const firstNum = (s?: string) => { const m = /-?\d+(\.\d+)?/.exec(s || ''); return m ? Number(m[0]) : null; };
const numAfter = (s: string | undefined, word: string) => { const m = new RegExp(`${word}\\s*(-?\\d+(?:\\.\\d+)?)`).exec(s || ''); return m ? Number(m[1]) : null; };

/** Tests the engine dictionary does not hold, with their SI conversions. */
const EXTRA: { key: string; re: RegExp; unit: string; conv?: (v: number, u: string) => number; plausible: [number, number] }[] = [
  { key: 'ica', re: /ionis/i, unit: 'mmol/L', conv: (v, u) => (/mg/i.test(u) ? v / 4.008 : v), plausible: [0.2, 3] },
  { key: 'ketones', re: /blood ketone|beta.?hydroxy|bohb/i, unit: 'mmol/L', plausible: [0, 15] },
  { key: 'u_na', re: /urine (na|sodium)/i, unit: 'mmol/L', plausible: [1, 400] },
  { key: 'u_k', re: /urine (k|potassium)/i, unit: 'mmol/L', plausible: [1, 300] },
  { key: 'u_cl', re: /urine (cl|chloride)/i, unit: 'mmol/L', plausible: [1, 400] },
  { key: 'u_cr', re: /urine creat/i, unit: 'µmol/L', conv: (v, u) => (/mmol/i.test(u) ? v * 1000 : /mg/i.test(u) ? v * 88.4 : v), plausible: [100, 50000] },
  { key: 'u_urea', re: /urine urea/i, unit: 'mmol/L', plausible: [5, 1500] },
  { key: 'u_osm', re: /urine osm/i, unit: 'mOsm/kg', plausible: [30, 1500] },
  { key: 'base_excess', re: /base excess|^be$/i, unit: 'mmol/L', plausible: [-40, 40] },
];

interface Lab { key: string; value: number; unit: string; time: string; label: string }

function readLabs(input: CcInput) {
  const latest = new Map<string, Lab>();
  const series = new Map<string, Lab[]>();
  const analytes = new Map<string, Analyte>();
  const implausible: string[] = [];
  const text: Record<string, string> = {};
  for (const l of input.labs || []) {
    const raw = typeof l.value === 'number' ? l.value : parseFloat(String(l.value).replace(/[^0-9.+-]/g, ''));
    const time = l.time || '';
    if (!Number.isFinite(raw)) { if (String(l.value).trim()) text[lc(l.test)] = String(l.value); continue; }
    let key: string | null = null, value = raw, unit = l.unit || '';
    if (/fio2/i.test(l.test)) { key = 'fio2'; value = raw <= 1 ? raw * 100 : raw; unit = '%'; }
    const m = key ? null : toAnalyte(l.test, raw, l.unit || '');
    if (m?.analyte) {
      key = m.analyte.key; value = m.analyte.value; unit = m.analyte.unit;
      const a = { ...m.analyte, ...(ok(l.ref_low) ? { printedRefLow: l.ref_low, refSource: 'report' as const } : {}), ...(ok(l.ref_high) ? { printedRefHigh: l.ref_high, refSource: 'report' as const } : {}) };
      const prev = latest.get(key);
      if (!prev || time >= prev.time) analytes.set(key, a);
    } else if (m?.reason === 'implausible') {
      implausible.push(`${l.test} ${l.value} ${l.unit || ''} — outside the physiological range; check for a unit or entry error. Not used in calculations until confirmed.`.replace(/\s+/g, ' '));
      continue;
    } else if (!key) {
      const x = EXTRA.find(e => e.re.test(l.test));
      if (!x) { if (/fio2/i.test(l.test) === false) text[lc(l.test)] = `${l.value} ${l.unit || ''}`.trim(); continue; }
      value = x.conv ? x.conv(raw, l.unit || '') : raw; key = x.key; unit = x.unit;
      if (value < x.plausible[0] || value > x.plausible[1]) { implausible.push(`${l.test} ${l.value} ${l.unit || ''} — implausible; not used until confirmed.`); continue; }
    }
    if (key === 'fio2') analytes.set('fio2', { key: 'fio2', label: 'FiO₂', value, unit: '%', rawText: String(l.value), confidence: 1, edited: false, manual: true });
    const lab = { key: key!, value, unit, time, label: l.test };
    const prev = latest.get(key!);
    if (!prev || time >= prev.time) latest.set(key!, lab);
    series.set(key!, [...(series.get(key!) || []), lab].sort((a, b) => a.time.localeCompare(b.time)));
  }
  return { latest, series, analytes, implausible, text };
}

const ECG_HYPERK = /peaked|tented|wide qrs|broad qrs|sine|absent p|loss of p|bradycard|heart block/i;

export function analyseCritical(input: CcInput, now = new Date()): CcReport {
  const R = emptyReport();
  const P = input.patient || {};
  const sex = P.sex === 'male' || P.sex === 'female' ? P.sex : null;
  const age = ok(P.age_years) ? P.age_years : null;
  const child = age != null && age < 18;
  const weight = ok(P.weight_kg) && P.weight_kg > 0 ? P.weight_kg : null;
  const height = ok(P.height_cm) && P.height_cm > 0 ? P.height_cm : null;
  const comorb = (input.comorbidities || []).map(lc).join(' | ');
  const symText = (input.symptoms || []).map(s => lc(`${s.category} ${s.item} ${s.severity || ''}`)).join(' | ');
  const signText = (input.signs || []).map(s => lc(`${s.category} ${s.item} ${s.value || ''}`)).join(' | ');
  const ecgText = (input.imaging_ecg || []).map(e => lc(`${e.type} ${e.finding}`)).join(' | ');
  const symptom = (re: RegExp) => re.test(symText) || re.test(lc(input.presenting_complaint));
  const sign = (re: RegExp) => re.test(signText);
  const meds = input.medications || [];
  const medClasses = meds.map(m => classesOf(m));
  const onAnticoag = medClasses.some(c => c.has('heparin') || c.has('warfarin') || c.has('doac'));
  const onVasopressor = medClasses.some(c => c.has('vasopressor'));
  const calc = (c: CcCalculation) => R.calculations.push(c);
  const alert = (finding: string, action: string, timeframe = 'Now', severity: CcAlert['severity'] = 'critical') => R.critical_alerts.push({ finding, severity, action, timeframe });

  // ── Vitals ────────────────────────────────────────────────────────────────
  const vitals: CcVitals[] = [...(input.vitals || [])].sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  const v: CcVitals = vitals[vitals.length - 1] || {};
  const fio2Frac = ok(v.fio2) ? (v.fio2 > 1 ? v.fio2 / 100 : v.fio2) : ok(input.ventilation?.fio2) ? (input.ventilation!.fio2! > 1 ? input.ventilation!.fio2! / 100 : input.ventilation!.fio2!) : null;
  const ventilated = !!(input.ventilation?.mode && input.ventilation.mode.trim()) || ok(input.ventilation?.peep);
  for (const [k, lo, hi] of [['hr', 15, 300], ['sbp', 30, 300], ['dbp', 10, 200], ['rr', 2, 80], ['temp_c', 25, 45], ['spo2', 30, 100], ['gcs', 3, 15]] as const) {
    const x = (v as any)[k];
    if (ok(x) && (x < lo || x > hi)) { R.data_quality.implausible_values.push(`${k} ${x} — implausible; not used`); (v as any)[k] = null; }
  }

  // ── Labs ──────────────────────────────────────────────────────────────────
  const L = readLabs(input);
  R.data_quality.implausible_values.push(...L.implausible);
  const lab = (k: string) => L.latest.get(k)?.value ?? null;
  const na = lab('na'), k = lab('k'), cl = lab('cl'), hco3 = lab('hco3'), urea = lab('urea'), cr = lab('creatinine'), glu = lab('glucose');
  const alb = lab('albumin'), ca = lab('calcium'), ica = lab('ica'), mg = lab('magnesium'), po4 = lab('phosphate'), ph = lab('ph');
  const paco2Kpa = lab('paco2'), pao2Kpa = lab('pao2'), lactate = lab('lactate'), hb = lab('hb'), plt = lab('plt'), inr = lab('inr');
  const bili = lab('bilirubinTotal'), alt = lab('alt'), wbc = lab('wbc'), osmMeasured = lab('osmolality'), ketones = lab('ketones');

  // ── Engine run (findings, grading, replacement plans, derived values) ─────
  const ext = emptyExtraction();
  ext.analytes = [...L.analytes.values()];
  if (fio2Frac != null && !L.analytes.has('fio2')) ext.analytes.push({ key: 'fio2', label: 'FiO₂', value: r(fio2Frac * 100, 0), unit: '%', rawText: String(fio2Frac), confidence: 1, edited: false, manual: true });
  const crSeries = L.series.get('creatinine') || [];
  let baseline = ok(input.baseline_creatinine_umol_l) ? input.baseline_creatinine_umol_l : null;
  if (baseline == null && crSeries.length > 1) {
    baseline = Math.min(...crSeries.map(x => x.value));
    R.data_quality.assumptions.push(`No baseline creatinine given — the lowest value in the record (${baseline} µmol/L) is used as a provisional baseline`);
  } else if (baseline == null && cr != null) R.data_quality.missing_essential.push('Baseline creatinine (AKI cannot be staged by creatinine without it)');
  const patient: PatientContext = {
    ...emptyPatient(), age, sex: sex ?? 'unspecified', weightKg: weight, heightCm: height, ward: P.location || '',
    diagnosis: input.presenting_complaint || '', clinicalDetails: [input.presenting_complaint, ...(input.comorbidities || [])].filter(Boolean).join('; '),
    fever: (ok(v.temp_c) && v.temp_c >= 38) || symptom(/fever|rigor/), pregnant: !!P.pregnant, knownCKD: /ckd|chronic kidney|renal failure|esrd|dialysis/.test(comorb),
    onAnticoagulant: onAnticoag, anticoagulantName: meds.find((_, i) => medClasses[i].has('heparin') || medClasses[i].has('warfarin') || medClasses[i].has('doac'))?.name || '',
    allergies: (input.allergies || []).map(a => a.agent), baselineCreatinine: baseline, collectedAt: now.toISOString(),
  };
  const engine = engineAnalyse(patient, ext, []);
  const derived = (key: string) => engine.modules.map(m => m.derived[key]).find(Boolean);
  const findings: Finding[] = engine.modules.flatMap(m => m.findings);

  // ── Missing essentials / special populations ─────────────────────────────
  if (weight == null) R.data_quality.missing_essential.push('Weight (needed for CrCl, doses, fluids and electrolyte deficits)');
  if (height == null) R.data_quality.missing_essential.push('Height (ideal/adjusted body weight)');
  if (age == null) R.data_quality.missing_essential.push('Age (eGFR, doses)');
  if (!sex) R.data_quality.missing_essential.push('Sex (eGFR, IBW, total body water)');
  if (!vitals.length) R.data_quality.missing_essential.push('Vital signs');
  if (!(input.labs || []).length) R.data_quality.missing_essential.push('Laboratory results');
  if (!meds.length) R.data_quality.assumptions.push('No medications listed — the medication review is empty; confirm the patient is on nothing');
  if (P.pregnant) R.data_quality.assumptions.push('Pregnant — check every drug for pregnancy safety; physiological ranges (creatinine, PaCO2) differ');
  if (P.breastfeeding) R.data_quality.assumptions.push('Breastfeeding — check drug transfer to breast milk');
  if (child) R.data_quality.assumptions.push('Child — paediatric formulas (Schwartz, Holliday–Segar) and paediatric doses apply');
  if (age != null && age >= 75) R.data_quality.assumptions.push('Elderly — creatinine-based estimates overestimate function with low muscle mass');
  if (weight != null && weight < 45) R.data_quality.assumptions.push('Low body weight — reduce weight-based doses; creatinine estimates unreliable');
  if (!(input.allergies || []).length) R.data_quality.assumptions.push('No allergies recorded — confirm "no known drug allergies"');

  // ── Body weight ──────────────────────────────────────────────────────────
  const dw = dosingWeight(weight, height, sex);
  if (weight != null) {
    calc({ name: 'Body weights', inputs: { weight_kg: weight, height_cm: height, sex }, formula: 'IBW (Devine) = 50/45.5 + 0.91 × (height − 152.4); AdjBW = IBW + 0.4 × (actual − IBW)', result: dw?.kg ?? weight, unit: 'kg',
      interpretation: `${dw?.note}. BMI ${height ? r(weight / (height / 100) ** 2) : '—'} kg/m²; IBW ${dw?.ibw ?? '—'} kg${dw?.adj ? `; AdjBW ${dw.adj} kg` : ''}`, app_value_agrees: null,
      caveats: 'Lipophilic drugs and loading doses may use actual weight; aminoglycosides use adjusted weight in obesity — check the drug.' });
  }

  // ── Renal ────────────────────────────────────────────────────────────────
  const egfr = cr != null && age != null && sex && !child ? ckdEpi2021(cr, age, sex) : null;
  const crcl = cr != null && age != null && dw ? cockcroftGault(cr, age, dw.kg, sex ?? 'unspecified') : null;
  const sch = child ? schwartz(height, cr) : null;
  const uo = akiUrineStage(input.fluid_balance?.urine_ml_per_hour, weight);
  const akiCr = cr != null ? akiStage(cr, baseline, null) : null;
  const rising = crSeries.length >= 2 && crSeries[crSeries.length - 1].value > crSeries[crSeries.length - 2].value * 1.1;
  const aki = Math.max(akiCr?.stage ?? 0, uo?.stage ?? 0) as 0 | 1 | 2 | 3;
  const steady = !(aki > 0 || rising);
  if (cr != null) {
    if (egfr != null) calc({ name: 'eGFR (CKD-EPI 2021, race-free)', inputs: { creatinine_umol_l: cr, age, sex }, formula: '142 × min(Scr/κ,1)^α × max(Scr/κ,1)^−1.200 × 0.9938^age × 1.012 (female), Scr mg/dL = µmol/L ÷ 88.4', result: egfr, unit: 'mL/min/1.73 m²',
      interpretation: `${ckdStage(egfr).stage} — ${ckdStage(egfr).description}`, app_value_agrees: agrees(input.app_calculations?.egfr_ckd_epi_2021, egfr, 0.05), caveats: steady ? '' : 'Not at steady state — unreliable; overestimates function while creatinine is rising' });
    if (crcl != null) calc({ name: 'Creatinine clearance (Cockcroft–Gault)', inputs: { creatinine_umol_l: cr, age, weight_kg: dw?.kg, weight_used: dw?.used, sex }, formula: '[(140 − age) × weight × 1.23 (male) / 1.04 (female)] ÷ Scr µmol/L', result: crcl, unit: 'mL/min',
      interpretation: `Drug-dosing band ${band(crcl)}`, app_value_agrees: agrees(input.app_calculations?.crcl_cockcroft_gault, crcl, 0.05), caveats: steady ? 'Assumes steady state' : 'AKI — CrCl overestimates function; give full loading doses and adjust maintenance as function changes' });
    if (sch != null) calc({ name: 'eGFR (bedside Schwartz)', inputs: { height_cm: height, creatinine_umol_l: cr }, formula: '36.5 × height cm ÷ Scr µmol/L', result: sch, unit: 'mL/min/1.73 m²', interpretation: `${ckdStage(sch).stage}`, app_value_agrees: null, caveats: '' });
  }
  if (uo) calc({ name: 'Urine output', inputs: { hourly_ml: input.fluid_balance?.urine_ml_per_hour, weight_kg: weight }, formula: 'mL/h ÷ kg; KDIGO duration criteria', result: uo.latestMlKgH, unit: 'mL/kg/h',
    interpretation: `< 0.5 mL/kg/h for ${uo.hoursBelow05} h; < 0.3 for ${uo.hoursBelow03} h; anuric ${uo.hoursAnuric} h → KDIGO urine-output stage ${uo.stage || 'none'}`, app_value_agrees: null, caveats: uo.hoursRecorded < 6 ? `Only ${uo.hoursRecorded} h recorded` : '' });
  const fe = fena(lab('u_na'), cr, na, lab('u_cr'));
  const onDiuretic = medClasses.some(c => c.has('loop') || c.has('thiazide'));
  const feu = feurea(lab('u_urea'), cr, urea, lab('u_cr'));
  if (fe != null && !onDiuretic) calc({ name: 'FENa', inputs: { urine_na: lab('u_na'), plasma_cr: cr, plasma_na: na, urine_cr: lab('u_cr') }, formula: '(UNa × PCr) ÷ (PNa × UCr) × 100', result: fe, unit: '%', interpretation: fe < 1 ? 'Suggests a prerenal state' : 'Suggests intrinsic renal injury (ATN) or other cause', app_value_agrees: null, caveats: 'Unreliable on diuretics, in CKD and with contrast' });
  if (feu != null) calc({ name: 'FEUrea', inputs: { urine_urea: lab('u_urea'), plasma_cr: cr, plasma_urea: urea, urine_cr: lab('u_cr') }, formula: '(UUrea × PCr) ÷ (PUrea × UCr) × 100', result: feu, unit: '%', interpretation: feu < 35 ? 'Suggests a prerenal state' : 'Suggests intrinsic renal injury', app_value_agrees: null, caveats: onDiuretic ? 'Preferred over FENa on diuretics' : '' });
  const dial: string[] = [];
  if ((k ?? 0) >= 6.5 && aki >= 2) dial.push('Hyperkalaemia with oliguric AKI — dialysis if refractory to medical treatment');
  if (ph != null && ph < 7.15 && aki >= 2) dial.push('Severe acidosis with AKI — dialysis if refractory');
  if ((sign(/crackles|fluid overload|oedema|raised jvp/) || symptom(/orthopn|pnd/)) && aki >= 2) dial.push('Fluid overload / pulmonary oedema with AKI — dialysis if diuretic-refractory');
  if ((urea ?? 0) > 35 || (sign(/pericardial rub/) && aki > 0) || (symptom(/confusion|drowsiness|seizure/) && (urea ?? 0) > 30)) dial.push('Uraemic complications (encephalopathy, pericarditis, bleeding) — urgent dialysis');
  if (symptom(/overdose|poison/) || /lithium|salicylate|methanol|ethylene/.test(lc(JSON.stringify(input.labs || [])))) dial.push('Possible dialysable poison (lithium, salicylate, toxic alcohols, metformin) — discuss with toxicology');
  R.renal_function = {
    creatinine_umol_l: cr, egfr_ckd_epi_2021: egfr ?? sch, crcl_cockcroft_gault: crcl, weight_used: dw?.used ?? '',
    ckd_stage: egfr != null ? ckdStage(egfr).stage + (steady ? '' : ' (not steady state — do not stage CKD on this value)') : '',
    aki_stage: aki ? `KDIGO stage ${aki}${akiCr?.basis ? ` — ${akiCr.basis}` : ''}${uo?.stage ? `; urine output stage ${uo.stage}` : ''}` : cr != null ? 'No AKI by available criteria' : '',
    steady_state: cr != null ? steady : null, dosing_band: crcl != null ? band(crcl) : '',
    interpretation: cr == null ? 'No creatinine — renal function not assessable' : `${egfr != null ? `eGFR ${egfr}` : ''}${crcl != null ? `, CrCl ${crcl} mL/min on ${dw?.used} weight` : ''}. ${aki ? `AKI stage ${aki}. ` : ''}${steady ? '' : 'Estimates assume steady state and are unreliable now. '}${/cirrho|liver/.test(comorb) ? 'Cirrhosis: creatinine overestimates GFR. ' : ''}`.trim(),
    dialysis_indications: dial,
  };

  // ── Acid–base ────────────────────────────────────────────────────────────
  const ab = interpretAcidBase(ph, paco2Kpa, hco3);
  const agD = derived('anionGap') || derived('anionGapAbg');
  const ag = firstNum(agD?.value), agc = numAfter(agD?.value, 'albumin-corrected') ?? ag;
  const osmD = derived('calculatedOsmolality');
  const osmGap = numAfter(osmD?.note, 'osmolar gap');
  const dr = agc != null && agc > 12 ? deltaRatio(agc, hco3) : null;
  const effOsm = effectiveOsmolality(na, glu);
  if (ab || ag != null) {
    R.acid_base = {
      primary_disorder: ab?.primary || '', compensation: ab?.compensation || '', anion_gap: ag, corrected_anion_gap: agc, delta_ratio: dr, osmolar_gap: osmGap,
      interpretation: [ab?.narrative, ag != null ? `Anion gap ${ag}${agc !== ag ? ` (albumin-corrected ${agc})` : ''} mmol/L — ${(agc ?? 0) > 12 ? 'raised (normal 8–12 unless the lab states otherwise)' : 'not raised'}` : '',
        dr != null ? `Delta ratio ${dr}: ${deltaRatioMeaning(dr)}` : '', osmGap != null ? `Osmolar gap ${osmGap}${osmGap > 10 ? ' — suggests toxic alcohols, mannitol or other unmeasured osmoles' : ''}` : ''].filter(Boolean).join('. '),
    };
    if (ab) calc({ name: 'Acid–base', inputs: { ph, paco2_mmhg: paco2Kpa != null ? r(paco2Kpa * KPA) : null, hco3 }, formula: "Winter's: expected PaCO2 = 1.5 × HCO3 + 8 ± 2 mmHg; alkalosis 0.7 × HCO3 + 21 ± 2", result: ab.primary, unit: '', interpretation: ab.narrative, app_value_agrees: null, caveats: paco2Kpa != null ? `PaCO2 ${paco2Kpa} kPa = ${r(paco2Kpa * KPA)} mmHg` : '' });
    if (ag != null) calc({ name: 'Anion gap', inputs: { na, cl, hco3, albumin_g_l: alb }, formula: 'Na − (Cl + HCO3); corrected = AG + 0.25 × (40 − albumin)', result: agc, unit: 'mmol/L', interpretation: R.acid_base.interpretation.split('. ').find(s => s.startsWith('Anion')) || '', app_value_agrees: agrees(input.app_calculations?.anion_gap, ag, 0.1), caveats: '' });
    if (dr != null) calc({ name: 'Delta ratio', inputs: { anion_gap: agc, hco3 }, formula: '(AG − 12) ÷ (24 − HCO3)', result: dr, unit: '', interpretation: deltaRatioMeaning(dr), app_value_agrees: null, caveats: '' });
  }
  if (osmD) calc({ name: 'Calculated osmolality', inputs: { na, glucose: glu, urea, measured: osmMeasured }, formula: '2 × Na + glucose + urea', result: firstNum(osmD.value), unit: 'mOsm/kg', interpretation: osmD.note || '', app_value_agrees: null, caveats: '' });
  if (effOsm != null) calc({ name: 'Effective osmolality (tonicity)', inputs: { na, glucose: glu }, formula: '2 × Na + glucose', result: effOsm, unit: 'mOsm/kg', interpretation: effOsm > 320 ? 'Hyperosmolar (> 320) — consider HHS' : effOsm < 275 ? 'Hypotonic' : 'Normal range', app_value_agrees: null, caveats: '' });
  const crisis = hyperglycaemicCrisis({ glucose: glu, ketones, urineKetones: L.text['urine ketones'] || null, ph, hco3, effOsm, knownDiabetes: /diabet/.test(comorb) });
  if (crisis.dka) alert(`Diabetic ketoacidosis criteria met (glucose ${glu ?? '—'}, ketones ${ketones ?? L.text['urine ketones'] ?? '—'}, pH ${ph ?? '—'}, HCO3 ${hco3 ?? '—'})`, 'Start DKA protocol: IV fluids, fixed-rate insulin 0.1 units/kg/h after K is known, potassium per protocol, hourly glucose and ketones', 'Within 1 hour');
  if (crisis.hhs) alert(`Hyperosmolar hyperglycaemic state criteria met (glucose ${glu}, effective osmolality ${effOsm})`, 'Fluids first; aim glucose fall 4–6 mmol/L/h and Na fall ≤ 10 mmol/L per 24 h; insulin 0.05 units/kg/h only once glucose stops falling with fluids or if ketotic', 'Within 1 hour');
  if (ph != null && ph < 7.1 && hco3 != null && weight != null) {
    const def = bicarbonateDeficit(weight, 15, hco3);
    if (def) calc({ name: 'Bicarbonate deficit', inputs: { weight_kg: weight, target_hco3: 15, hco3 }, formula: '0.5 × weight × (target − measured)', result: def, unit: 'mmol',
      interpretation: `About half (${Math.round(def / 2)} mmol = ${Math.round(def / 2)} mL of 8.4% NaHCO3) then recheck the gas — ONLY if an indication exists (normal-AG acidosis or AKI with pH < 7.1, severe hyperkalaemia with acidosis, TCA/salicylate toxicity)`, app_value_agrees: null,
      caveats: 'Not routine. Risks: sodium and volume load, hypokalaemia, low ionised calcium, rising CO2 if ventilation is fixed' });
  }

  // ── Electrolytes (Adrogué–Madias, corrections from the engine) ───────────
  const tbw = weight != null ? totalBodyWater(weight, sex ?? 'male', age) : null;
  if (na != null && tbw != null && (na < 135 || na > 145)) {
    const rows = INFUSATES.map(f => `${f.name}: ${r(adrogueMadias(f.na, f.k, na, tbw), 1)} mmol/L per litre`);
    calc({ name: 'Adrogué–Madias (predicted change in Na per litre)', inputs: { serum_na: na, tbw_l: r(tbw), weight_kg: weight, sex, age }, formula: 'ΔNa = (infusate Na + infusate K − serum Na) ÷ (TBW + 1)', result: rows.join('; '), unit: '',
      interpretation: na < 135 ? 'Limit the rise to ≤ 10 mmol/L in 24 h (≤ 8 if high risk of osmotic demyelination)' : 'Limit the fall to ≤ 10 mmol/L in 24 h (about 0.5 mmol/L/h) unless acute < 48 h', app_value_agrees: null,
      caveats: 'Does not account for ongoing losses or aquaresis — recalculate after every sodium result' });
  }
  const glucoseCorrNa = derived('correctedSodium');
  if (glucoseCorrNa) calc({ name: 'Glucose-corrected sodium', inputs: { na, glucose: glu }, formula: 'Na + 0.4 × (glucose − 5.5)', result: firstNum(glucoseCorrNa.value), unit: 'mmol/L', interpretation: glucoseCorrNa.note || '', app_value_agrees: null, caveats: 'Some use 0.3 at modest hyperglycaemia' });
  const corrCaD = derived('correctedCalcium');
  const corrCa = firstNum(corrCaD?.value);
  if (corrCaD) calc({ name: 'Albumin-corrected calcium', inputs: { calcium: ca, albumin_g_l: alb }, formula: 'Ca + 0.02 × (40 − albumin)', result: corrCa, unit: 'mmol/L', interpretation: corrCaD.note || '', app_value_agrees: null, caveats: 'Prefer ionised calcium in critical illness' });

  for (const f of findings.filter(x => x.correction)) {
    const c = f.correction!;
    const sodium = /natr/.test(f.id);
    let rate: number | null = null, dur: number | null = null, extra = '';
    if (sodium && na != null && tbw != null) {
      if (na < 135) {
        const severe = symptom(/seizure|coma|drows|confus/) || (ok(v.gcs) && v.gcs < 15);
        const per = adrogueMadias(513, 0, na, tbw);
        if (severe) extra = ` Severe symptoms: 3% NaCl 150 mL IV over 20 min${child && weight ? ` (child 2 mL/kg = ${Math.min(150, Math.round(2 * weight))} mL)` : ''}; recheck Na at 20 min, repeat up to twice until symptoms improve or Na up 5 mmol/L.`;
        else { const target = 6; const vol = Math.round((target / per) * 1000); rate = Math.round(vol / 24); dur = 24; extra = ` If hypertonic saline is chosen for a 6 mmol/L rise over 24 h: ${vol} mL 3% NaCl ≈ ${rate} mL/h (ΔNa ${r(per)} per L).`; }
      } else if (na > 145) {
        const per = adrogueMadias(0, 0, na, tbw);
        const vol = Math.round((10 / Math.abs(per)) * 1000);
        rate = Math.round(vol / 24); dur = 24;
        extra = ` 5% dextrose for a 10 mmol/L fall over 24 h: ${vol} mL ≈ ${rate} mL/h plus ongoing losses (insensible ~800–1000 mL/day; more with fever). Enteral water if the gut works.`;
      }
    }
    R.plan.electrolyte_corrections.push({
      abnormality: c.title, current_value: c.measured, severity: f.severity, target: c.target,
      calculation: c.deficit ? `${c.deficit.label}: ${c.deficit.value}. ${c.deficit.note}` : '',
      prescription: [...(c.prerequisites || []).map(p => `First: ${p}`), ...c.steps.map(s => `${s.indication}: ${s.preparation} — ${s.dose}; ${s.administration}${s.access ? ` (${s.access})` : ''}`)].join(' | ') + extra,
      rate_ml_per_h: rate, duration_h: dur, max_safe_rate: c.hardLimits.join('; '), recheck: c.monitoring.join('; '),
      stop_when: `Target reached (${c.target}) or adverse effect`,
    } as CcElectrolyteCorrection);
  }

  // ── Haemodynamics, oxygenation ───────────────────────────────────────────
  const map = meanArterialPressure(v.sbp, v.dbp);
  const si = shockIndex(v.hr, v.sbp);
  const pfMmHg = pao2Kpa != null && fio2Frac ? r((pao2Kpa * KPA) / fio2Frac, 0) : null;
  const sf = pfMmHg == null ? sfRatio(v.spo2, fio2Frac ?? 0.21) : null;
  if (map != null) calc({ name: 'MAP', inputs: { sbp: v.sbp, dbp: v.dbp }, formula: '(SBP + 2 × DBP) ÷ 3', result: map, unit: 'mmHg', interpretation: map < 65 ? 'Below 65 — hypoperfusion' : 'Adequate', app_value_agrees: null, caveats: '' });
  if (si != null) calc({ name: 'Shock index', inputs: { hr: v.hr, sbp: v.sbp }, formula: 'HR ÷ SBP', result: si, unit: '', interpretation: si > 1 ? 'Abnormal (> 1.0)' : 'Normal', app_value_agrees: null, caveats: '' });
  if (pfMmHg != null) calc({ name: 'P/F ratio', inputs: { pao2_mmhg: r((pao2Kpa ?? 0) * KPA), fio2: fio2Frac }, formula: 'PaO2 (mmHg) ÷ FiO2', result: pfMmHg, unit: 'mmHg',
    interpretation: (input.ventilation?.peep ?? 0) >= 5 && pfMmHg <= 300 ? `ARDS range (Berlin): ${pfMmHg <= 100 ? 'severe' : pfMmHg <= 200 ? 'moderate' : 'mild'} — if bilateral opacities not explained by cardiac failure` : pfMmHg < 300 ? 'Impaired oxygenation' : 'Normal', app_value_agrees: null, caveats: 'Berlin ARDS needs PEEP ≥ 5' });
  else if (sf != null) calc({ name: 'S/F ratio (surrogate)', inputs: { spo2: v.spo2, fio2: fio2Frac ?? 0.21 }, formula: 'SpO2 ÷ FiO2', result: sf, unit: '', interpretation: sf < 315 ? 'Corresponds roughly to P/F < 300 — impaired oxygenation' : 'Not suggestive of significant impairment', app_value_agrees: null, caveats: 'Surrogate only (no blood gas); invalid above SpO2 97%' });
  const aa = derived('aaGradient');
  if (aa) calc({ name: 'A–a gradient', inputs: { fio2: fio2Frac, paco2: paco2Kpa, pao2: pao2Kpa }, formula: '[FiO2 × 713 − PaCO2/0.8] − PaO2 (sea level)', result: `${aa.value} (${r((firstNum(aa.value) ?? 0) * KPA, 0)} mmHg)`, unit: '', interpretation: aa.note || '', app_value_agrees: null, caveats: '' });

  // ── Critical alerts (specification rule 3) ───────────────────────────────
  const hyperKEcg = ECG_HYPERK.test(ecgText);
  if (k != null && (k >= 6.5 || (k > 5.5 && hyperKEcg))) alert(`Hyperkalaemia K ${k} mmol/L${hyperKEcg ? ' with ECG changes' : ''}`, '10% calcium gluconate 30 mL IV over 5–10 min with ECG monitoring; insulin 10 units + 25 g glucose IV; stop K-raising drugs; recheck K at 1 h; consider dialysis if refractory', 'Immediately');
  if (k != null && k < 2.5) alert(`Severe hypokalaemia K ${k} mmol/L`, 'Continuous ECG; IV potassium via central line up to 20 mmol/h (peripheral ≤ 10 mmol/h, ≤ 40 mmol/L); correct magnesium; avoid glucose carriers', 'Immediately');
  const naSymptoms = symptom(/seizure|coma|drows|confus/) || (ok(v.gcs) && v.gcs < 13);
  if (na != null && (na < 120 || na > 160 || ((na < 135 || na > 145) && naSymptoms))) alert(`Sodium ${na} mmol/L${naSymptoms ? ' with neurological symptoms' : ''}`, na < 135 && naSymptoms ? '3% NaCl 150 mL IV over 20 min; recheck at 20 min; max rise 10 mmol/L in 24 h' : 'Senior review; correct within safe limits (≤ 10 mmol/L per 24 h); 2-hourly sodium', 'Within 1 hour');
  if (glu != null && glu < 4) alert(`Hypoglycaemia ${glu} mmol/L`, '10% glucose 150–200 mL IV over 15 min (child 2 mL/kg), or 15–20 g oral carbohydrate if able to swallow; recheck in 10–15 min; find the cause (insulin, sulfonylurea, quinine, malaria, sepsis, liver failure)', 'Immediately');
  if (ph != null && (ph < 7.15 || ph > 7.6)) alert(`pH ${ph}`, 'Identify the primary disorder; treat the cause; senior/ICU review', 'Within 1 hour');
  if (lactate != null && lactate >= 4) alert(`Lactate ${lactate} mmol/L`, 'Treat as tissue hypoperfusion until proven otherwise: sepsis bundle, fluids with reassessment, cultures and antimicrobials within 1 h if infection is suspected; repeat lactate in 2 h', 'Within 1 hour');
  if ((map != null && map < 65) || (ok(v.sbp) && v.sbp < 90)) alert(`Hypotension (SBP ${v.sbp ?? '—'}, MAP ${map ?? '—'} mmHg)`, 'Assess fluid responsiveness; 250–500 mL balanced crystalloid bolus with reassessment; noradrenaline for MAP ≥ 65 if fluid-unresponsive', 'Immediately');
  if (ok(v.spo2) && v.spo2 < 90 && (fio2Frac ?? 0.21) > 0.21) alert(`SpO2 ${v.spo2}% on FiO2 ${fio2Frac}`, 'Airway and breathing assessment; increase oxygen / NIV / intubation per senior review; blood gas', 'Immediately');
  const gcsSeries = vitals.map(x => x.gcs).filter(ok);
  const gcsFall = gcsSeries.length >= 2 ? Math.max(...gcsSeries.slice(0, -1)) - gcsSeries[gcsSeries.length - 1] : 0;
  if ((ok(v.gcs) && v.gcs <= 8) || gcsFall >= 2) alert(`GCS ${v.gcs ?? '—'}${gcsFall >= 2 ? ` (fall of ${gcsFall})` : ''}`, 'Protect the airway (GCS ≤ 8: anaesthetic review for intubation); check glucose, gas, sodium; CT head if indicated', 'Immediately');
  const bleeding = symptom(/bleed|haematemesis|melaena|haemoptysis/) || sign(/bleeding sites|purpura/);
  if (hb != null && hb < 70 && bleeding) alert(`Hb ${hb} g/L with active bleeding`, 'Activate major haemorrhage protocol as appropriate; cross-match; transfuse to clinical need; find and control the source', 'Immediately');
  if (plt != null && plt < 20) alert(`Platelets ${plt} ×10⁹/L`, 'Bleeding precautions; platelet transfusion if bleeding or before procedures; consider DIC, HIT, sepsis, Lassa fever, malaria', 'Within 1 hour');
  if ((inr != null && inr > 5) || (bleeding && onAnticoag)) alert(`${inr != null && inr > 5 ? `INR ${inr}` : ''}${bleeding && onAnticoag ? ' bleeding on anticoagulation' : ''}`.trim(), 'Hold anticoagulant; vitamin K IV for warfarin with bleeding; FFP/prothrombin complex for major bleeding; specific reversal for DOAC if available', 'Within 1 hour');
  if (uo && (uo.hoursBelow03 >= 6 || uo.hoursAnuric >= 1)) alert(`Urine output < 0.3 mL/kg/h for ${uo.hoursBelow03} h${uo.hoursAnuric ? ` (anuric ${uo.hoursAnuric} h)` : ''}`, 'Check the catheter; assess volume status; stop nephrotoxins; urgent renal review; assess dialysis indications', 'Within 1 hour');
  if ((ica != null && ica < 0.9) || (corrCa != null && corrCa > 3.5)) alert(ica != null && ica < 0.9 ? `Ionised calcium ${ica} mmol/L` : `Corrected calcium ${corrCa} mmol/L`, ica != null && ica < 0.9 ? '10% calcium gluconate 10–20 mL in 50–100 mL over 10 min with ECG monitoring; correct magnesium' : 'IV 0.9% NaCl rehydration; then bisphosphonate (renally adjusted); ECG', 'Within 1 hour');
  if (mg != null && mg < 0.4) alert(`Magnesium ${mg} mmol/L`, 'Magnesium sulfate 2 g (8 mmol) IV over 10–15 min (over 1–2 min for torsades); halve dose if CrCl < 30', 'Within 1 hour');

  // ── Scores ───────────────────────────────────────────────────────────────
  const confusion = ok(v.gcs) ? v.gcs < 15 : symptom(/confus|drows|agitat/) ? true : null;
  const sep = assessSepsis({ systolicBP: v.sbp, diastolicBP: v.dbp, heartRate: v.hr, respiratoryRate: v.rr, temperature: v.temp_c, gcs: v.gcs }, { wbc, lactate });
  const qMissing = [!ok(v.rr) && 'RR', !ok(v.sbp) && 'SBP', !ok(v.gcs) && 'GCS'].filter(Boolean) as string[];
  R.scores.push({ name: 'qSOFA', value: String(sep.qSOFA), complete: !qMissing.length, missing: qMissing, interpretation: sep.qSOFA >= 2 ? '≥ 2 — high risk of poor outcome if infection is present' : '< 2' });
  const news = news2Of({ obs: { rr: v.rr, spo2: v.spo2, sbp: v.sbp, hr: v.hr, temp: v.temp_c, avpu: ok(v.gcs) ? (v.gcs === 15 ? 'Alert' : 'Not alert') : undefined, o2: fio2Frac != null ? (fio2Frac > 0.21 ? 'Yes' : 'No') : undefined } } as any);
  const nMissing = [!ok(v.rr) && 'RR', !ok(v.spo2) && 'SpO2', !ok(v.sbp) && 'SBP', !ok(v.hr) && 'HR', !ok(v.temp_c) && 'temperature', !ok(v.gcs) && 'consciousness (GCS/AVPU)'].filter(Boolean) as string[];
  R.scores.push({ name: 'NEWS2', value: news ? String(news.total) : '', complete: !!news && fio2Frac != null, missing: [...nMissing, ...(fio2Frac == null ? ['supplemental oxygen (scored as air)'] : [])],
    interpretation: news ? (news.total >= 7 ? 'High — emergency response' : news.total >= 5 || news.anyThree ? 'Medium — urgent review' : 'Low') : 'Not calculable' });
  const vasoLevel = onVasopressor ? (meds.some(m => /adrenaline|epinephrine/.test(lc(m.name)) && !/nor/.test(lc(m.name))) || meds.filter(m => classesOf(m).has('vasopressor')).length > 1 ? 'high' : 'low') : 'none';
  const so = sofa({ pfMmHg, sfRatio: sf, ventilated, plt, bilirubinUmol: bili, map, vasopressor: vasoLevel as any, gcs: v.gcs, creatUmol: cr, uoMlDay: input.fluid_balance?.output_ml_24h ?? null });
  R.scores.push({ name: 'SOFA', value: so.value != null ? String(so.value) : '', complete: so.complete, missing: so.missing,
    interpretation: `${so.value ?? '—'} (${Object.entries(so.parts).map(([k2, x]) => `${k2} ${x}`).join(', ')})${so.surrogateResp ? '; respiratory from S/F surrogate' : ''}${onVasopressor ? '; cardiovascular from vasopressor presence — dose not structured' : ''}. Sepsis-3: suspected infection with acute SOFA rise ≥ 2 = sepsis.` });
  const curb = curb65({ confusion, ureaMmol: urea, rr: v.rr, sbp: v.sbp, dbp: v.dbp, age });
  if (symptom(/cough|sputum|breath|pleuritic/) || /pneumon/.test(lc(input.presenting_complaint))) R.scores.push({ name: 'CURB-65', value: curb.value != null ? String(curb.value) : '', complete: curb.complete, missing: curb.missing, interpretation: curb.value == null ? '' : curb.value >= 3 ? 'Severe pneumonia — consider ICU' : curb.value === 2 ? 'Moderate — hospital treatment' : 'Low severity' });
  const liver = /cirrho|liver|hepat/.test(comorb) || (bili ?? 0) > 34;
  if (liver) {
    const asc = sign(/ascites/) ? 'mild' : null;
    const enc = sign(/asterixis/) || symptom(/confus/) ? 'grade1-2' : null;
    const cp = childPugh({ bilirubinUmol: bili, albuminGL: alb, inr, ascites: asc as any, encephalopathy: enc as any });
    R.scores.push({ name: 'Child–Pugh', value: cp.value != null ? `${cp.value}${cp.klass ? ` (class ${cp.klass})` : ''}` : '', complete: cp.complete, missing: cp.missing, interpretation: cp.klass ? `Class ${cp.klass} — use for hepatic dose adjustment` : 'Incomplete — grade ascites and encephalopathy clinically' });
    const md = meldNa({ bilirubinUmol: bili, inr, creatUmol: cr, na });
    R.scores.push({ name: 'MELD-Na', value: md.meldNa != null ? String(md.meldNa) : md.meld != null ? `MELD ${md.meld}` : '', complete: !md.missing.length, missing: md.missing, interpretation: md.meldNa != null ? (md.meldNa >= 20 ? 'High short-term mortality' : 'Lower short-term mortality') : '' });
  }
  R.scores.push({ name: 'GCS', value: ok(v.gcs) ? String(v.gcs) : '', complete: ok(v.gcs), missing: ok(v.gcs) ? [] : ['GCS'], interpretation: ok(v.gcs) ? (v.gcs <= 8 ? 'Severe — airway at risk' : v.gcs <= 12 ? 'Moderate' : v.gcs < 15 ? 'Mild impairment' : 'Normal') : '' });
  R.scores.push({ name: 'APACHE II', value: '', complete: false, missing: ['worst 24-h values of 12 physiological variables', 'chronic health points'], interpretation: 'Not calculated from the structured case — needs worst values in the first 24 h' });

  // ── Trends ───────────────────────────────────────────────────────────────
  for (const key of ['creatinine', 'k', 'na', 'lactate', 'hb', 'plt', 'glucose']) {
    const s = L.series.get(key) || [];
    if (s.length < 2) continue;
    const a = s[0], b = s[s.length - 1];
    const pct = a.value ? r(((b.value - a.value) / a.value) * 100, 0) : 0;
    calc({ name: `Trend: ${b.label}`, inputs: { first: `${a.value} (${a.time || '—'})`, latest: `${b.value} (${b.time || '—'})`, n: s.length }, formula: 'latest vs first', result: r(b.value - a.value, 2), unit: b.unit, interpretation: `${pct > 0 ? 'Rising' : pct < 0 ? 'Falling' : 'Stable'} (${pct > 0 ? '+' : ''}${pct}%)`, app_value_agrees: null, caveats: '' });
  }
  if (vitals.length >= 2) {
    const a = vitals[0];
    const trend = (x: keyof CcVitals) => (ok(a[x]) && ok(v[x]) ? `${String(x)} ${a[x]}→${v[x]}` : null);
    const t = ['hr', 'sbp', 'map', 'rr', 'spo2', 'temp_c', 'gcs'].map(x => trend(x as keyof CcVitals)).filter(Boolean);
    if (t.length) calc({ name: 'Trend: vital signs', inputs: { from: a.time, to: v.time }, formula: 'first vs latest', result: t.join('; '), unit: '', interpretation: 'Review the direction of change, not only the latest value', app_value_agrees: null, caveats: '' });
  }

  // ── Medication review ────────────────────────────────────────────────────
  const hypovolaemic = sign(/dehydration|cold peripheries|capillary refill/) || (map != null && map < 65) || ((input.fluid_balance?.intake_ml_24h ?? 0) > 0 && (input.fluid_balance?.output_ml_24h ?? 0) > (input.fluid_balance?.intake_ml_24h ?? 0) + 1000);
  const mr = reviewMedications(meds, {
    k, na, glucose: glu, plt, inr, hr: v.hr, lactate, alt, bilirubin: bili, mg, egfr, crcl, aki: aki > 0, activeBleeding: bleeding, giBleed: symptom(/haematemesis|melaena/),
    qtProlonged: /qt/.test(ecgText) && /prolong|long/.test(ecgText), asthma: /asthma/.test(comorb) || symptom(/wheeze/), liverDisease: /cirrho|liver/.test(comorb), hypovolaemic,
    allergies: input.allergies || [], ventilated,
  });
  R.medication_review = mr.reviews;
  R.missing_indicated_therapy = [...mr.missing];
  if (/alcohol|malnutri|wernicke/.test(comorb + symText)) if (!meds.some(m => /thiamine|vitamin b/i.test(m.name))) R.missing_indicated_therapy.push({ therapy: 'Thiamine', reason: 'Alcohol misuse or malnutrition — give before glucose/feeding' });
  const malariaPos = /positive|seen|\+/.test(lc(L.text['malaria rdt'] || L.text['malaria parasites'] || ''));
  if (malariaPos && !medClasses.some(c => c.has('artemisinin') || c.has('quinine'))) R.missing_indicated_therapy.push({ therapy: 'Antimalarial', reason: 'Malaria confirmed — IV artesunate for severe malaria (quinine if unavailable)' });
  if (/diabet/.test(comorb) && glu != null && glu > 10 && !medClasses.some(c => c.has('insulin'))) R.missing_indicated_therapy.push({ therapy: 'Glycaemic control', reason: `Glucose ${glu} mmol/L — ICU target 7.8–10.0; start insulin if persistently > 10` });

  // ── Organ systems ────────────────────────────────────────────────────────
  const sys = (system: string, failing: boolean, atRisk: boolean, f: (string | false | null | undefined)[]) =>
    R.organ_systems.push({ system, status: failing ? 'failing' : atRisk ? 'at risk' : 'stable', findings: f.filter(Boolean) as string[] });
  sys('Airway and breathing', (ok(v.spo2) && v.spo2 < 90) || (pfMmHg != null && pfMmHg < 200) || ventilated, (ok(v.rr) && (v.rr > 24 || v.rr < 10)) || (ok(v.spo2) && v.spo2 < 94) || sign(/accessory|crackles|wheeze|reduced air/),
    [ok(v.rr) && `RR ${v.rr}`, ok(v.spo2) && `SpO2 ${v.spo2}%${fio2Frac ? ` on FiO2 ${fio2Frac}` : ''}`, pfMmHg != null && `P/F ${pfMmHg}`, ventilated && `Ventilated (${input.ventilation?.mode || 'mode not given'}, PEEP ${input.ventilation?.peep ?? '—'})`]);
  sys('Circulation', (map != null && map < 65) || onVasopressor || (lactate ?? 0) >= 4, (si ?? 0) > 1 || (lactate ?? 0) > 2 || (ok(v.hr) && v.hr > 110), [map != null && `MAP ${map}`, si != null && `shock index ${si}`, lactate != null && `lactate ${lactate}`, onVasopressor && 'on vasopressor']);
  sys('Neurology', ok(v.gcs) && v.gcs <= 8, (ok(v.gcs) && v.gcs < 15) || symptom(/confus|seizure|drows/), [ok(v.gcs) && `GCS ${v.gcs}`, gcsFall >= 2 && `GCS fall ${gcsFall}`, symptom(/seizure/) && 'seizures']);
  sys('Renal', aki >= 2 || (k ?? 0) >= 6.5, aki === 1 || (egfr ?? 99) < 60 || (uo?.hoursBelow05 ?? 0) >= 6, [cr != null && `creatinine ${cr}`, aki > 0 && `AKI stage ${aki}`, uo && `UO ${uo.latestMlKgH} mL/kg/h`]);
  sys('Hepatic', (bili ?? 0) > 102 || (inr ?? 0) > 2.5 && liver, (bili ?? 0) > 34 || (alt ?? 0) > 120, [bili != null && `bilirubin ${bili}`, alt != null && `ALT ${alt}`, inr != null && `INR ${inr}`]);
  sys('Haematology and coagulation', (plt ?? 999) < 20 || (inr ?? 0) > 5 || (hb != null && hb < 70 && bleeding), (plt ?? 999) < 100 || (hb ?? 999) < 80 || (inr ?? 0) > 1.5, [hb != null && `Hb ${hb}`, plt != null && `platelets ${plt}`, inr != null && `INR ${inr}`, bleeding && 'bleeding']);
  sys('Gastrointestinal', symptom(/haematemesis|melaena/), symptom(/vomit|diarr|abdominal pain|distension/) || sign(/guarding|tender/), [symptom(/haematemesis|melaena/) && 'GI bleeding', sign(/guarding/) && 'guarding']);
  sys('Endocrine and metabolic', crisis.dka || crisis.hhs || (glu ?? 99) < 4, (glu ?? 0) > 10 || (na ?? 140) < 130 || (na ?? 140) > 150 || (k ?? 4) < 3 || (k ?? 4) > 6, [glu != null && `glucose ${glu}`, na != null && `Na ${na}`, k != null && `K ${k}`, crisis.dka && 'DKA', crisis.hhs && 'HHS']);
  const infection = patient.fever || (wbc ?? 0) > 12 || (wbc ?? 99) < 4 || /culture|positive/.test(lc(Object.values(L.text).join(' ')));
  sys('Infection', sep.septicShock, infection || sep.sepsisSuspected, [patient.fever && 'fever', wbc != null && `WBC ${wbc}`, sep.qSOFA >= 2 && `qSOFA ${sep.qSOFA}`, malariaPos && 'malaria positive']);
  sys('Skin and wounds', sign(/purpura|petechiae/) && (plt ?? 999) < 50, sign(/burn|pressure injury|wound infection|rash/) || symptom(/burn|wound/), [sign(/burn/) && 'burns', ok(input.burn_tbsa_pct) && `${input.burn_tbsa_pct}% TBSA`, sign(/pressure injury/) && 'pressure injury']);

  // ── Differential (rule-based patterns; ranked) ───────────────────────────
  type Dx = CcReport['differential_diagnosis'][number];
  const dx: Omit<Dx, 'rank'>[] = [];
  if (sep.septicShock || (infection && (sep.qSOFA >= 2 || (lactate ?? 0) > 2 || (map ?? 99) < 65))) dx.push({ diagnosis: sep.septicShock ? 'Septic shock (Sepsis-3)' : 'Sepsis', likelihood: 'high', cant_miss: true, supporting: [patient.fever && 'fever', `qSOFA ${sep.qSOFA}`, lactate != null && `lactate ${lactate}`, map != null && `MAP ${map}`].filter(Boolean) as string[], against: [], next_test: 'Blood cultures before antimicrobials; source imaging; repeat lactate' });
  if (patient.fever) dx.push({ diagnosis: 'Severe malaria', likelihood: malariaPos ? 'high' : 'moderate', cant_miss: true, supporting: ['fever in an endemic setting', ...(malariaPos ? ['malaria test positive'] : []), (glu ?? 9) < 4 && 'hypoglycaemia', (plt ?? 999) < 100 && 'thrombocytopenia', (bili ?? 0) > 50 && 'jaundice/raised bilirubin'].filter(Boolean) as string[], against: L.text['malaria rdt'] && !malariaPos ? ['negative RDT recorded'] : [], next_test: 'Thick and thin blood film with parasite count, plus malaria RDT' });
  if (patient.fever && (bleeding || sign(/petechiae|purpura|bleeding/)) ) dx.push({ diagnosis: 'Lassa fever / viral haemorrhagic fever', likelihood: 'moderate', cant_miss: true, supporting: ['fever with bleeding'], against: [], next_test: 'Isolate; Lassa fever PCR via the public health laboratory; inform infection prevention' });
  if (patient.fever && (symptom(/abdominal pain/) || sign(/guarding|tender/))) dx.push({ diagnosis: 'Typhoid fever ± perforation', likelihood: 'moderate', cant_miss: sign(/guarding/), supporting: ['fever with abdominal symptoms'], against: [], next_test: 'Blood culture (not Widal); erect chest X-ray / abdominal imaging if guarding' });
  if (crisis.dka) dx.push({ diagnosis: 'Diabetic ketoacidosis', likelihood: 'high', cant_miss: true, supporting: ['glucose, ketones and acidosis criteria met'], against: [], next_test: 'Hourly capillary ketones and glucose; venous gas 2-hourly' });
  if (crisis.hhs) dx.push({ diagnosis: 'Hyperosmolar hyperglycaemic state', likelihood: 'high', cant_miss: true, supporting: [`glucose ${glu}`, `effective osmolality ${effOsm}`], against: [], next_test: 'Measured osmolality; hourly glucose and 2-hourly sodium' });
  if (aki > 0) dx.push({ diagnosis: `Acute kidney injury (stage ${aki})${hypovolaemic ? ' — prerenal component likely' : ''}`, likelihood: 'high', cant_miss: false, supporting: [akiCr?.basis, uo?.stage ? `urine output stage ${uo.stage}` : null, mr.tripleWhammy ? 'triple whammy drugs' : null].filter(Boolean) as string[], against: [], next_test: 'Urine dipstick, urine Na and creatinine (FENa/FEUrea), renal ultrasound; CK if muscle injury' });
  if (/sickle|scd|hbss/.test(comorb) && symptom(/pain|bone pain|chest pain|breath/)) dx.push({ diagnosis: 'Sickle cell crisis (vaso-occlusive / acute chest syndrome)', likelihood: 'high', cant_miss: symptom(/chest pain|breath/), supporting: ['sickle cell disease with pain'], against: [], next_test: 'FBC with reticulocytes, chest X-ray, SpO2/gas' });
  if (sign(/trismus|spasm/)) dx.push({ diagnosis: 'Tetanus', likelihood: 'moderate', cant_miss: true, supporting: ['trismus/spasms'], against: [], next_test: 'Clinical diagnosis — wound search; airway plan' });
  if (symptom(/organophosphate|insecticide/)) dx.push({ diagnosis: 'Organophosphate poisoning', likelihood: 'high', cant_miss: true, supporting: ['exposure reported'], against: [], next_test: 'Clinical cholinergic signs; plasma cholinesterase if available' });
  if (symptom(/snakebite/)) dx.push({ diagnosis: 'Snakebite envenomation', likelihood: 'high', cant_miss: true, supporting: ['snakebite reported'], against: [], next_test: '20-minute whole blood clotting test; repeat 6-hourly' });
  if (P.pregnant && (symptom(/seizure|headache with visual/) || (ok(v.sbp) && v.sbp >= 160))) dx.push({ diagnosis: 'Pre-eclampsia / eclampsia', likelihood: 'high', cant_miss: true, supporting: ['pregnancy with seizures/headache or severe hypertension'], against: [], next_test: 'Urine protein, platelets, LFT; magnesium sulfate per obstetric protocol' });
  for (const rv of R.medication_review) if (rv.adverse_effects_in_this_patient.length) dx.push({ diagnosis: `Drug effect: ${rv.drug} (${rv.adverse_effects_in_this_patient[0]})`, likelihood: 'moderate', cant_miss: false, supporting: rv.adverse_effects_in_this_patient, against: [], next_test: 'Hold/adjust and recheck the abnormal value' });
  const order = { high: 0, moderate: 1, low: 2 } as const;
  R.differential_diagnosis = dx.sort((a, b) => order[a.likelihood] - order[b.likelihood] || Number(b.cant_miss) - Number(a.cant_miss)).map((d, i) => ({ rank: i + 1, ...d }));

  // ── Plan ─────────────────────────────────────────────────────────────────
  R.plan.immediate = R.critical_alerts.map(a => `${a.finding}: ${a.action}`);
  const inv = (test: string, priority: 'urgent' | 'today' | 'routine', rationale: string) => { if (!R.plan.investigations.some(x => x.test === test)) R.plan.investigations.push({ test, priority, rationale }); };
  if (k != null && (k > 6 || k < 3) && !ecgText) inv('12-lead ECG', 'urgent', 'Potassium disorder — ECG changes decide emergency treatment');
  if ((lactate ?? 0) > 2 || (map ?? 99) < 65 || (ok(v.spo2) && v.spo2 < 92)) if (ph == null) inv('Arterial (or venous) blood gas with lactate', 'urgent', 'Shock or hypoxaemia without a gas');
  if (patient.fever && !L.text['malaria rdt'] && !L.text['malaria parasites']) inv('Malaria RDT and blood film', 'urgent', 'Fever in an endemic setting — severe malaria is a can\'t-miss diagnosis');
  if (infection) inv('Blood cultures (before antimicrobials)', 'urgent', 'Suspected infection');
  if (aki > 0 && lab('u_na') == null) inv('Urine Na, creatinine and urea; urinalysis; renal ultrasound', 'today', 'Classify AKI (prerenal vs intrinsic vs obstructive)');
  if (aki > 0 && symptom(/muscle pain|weakness/)) inv('CK', 'urgent', 'Rhabdomyolysis');
  if (glu != null && glu > 11 && ketones == null && !L.text['urine ketones']) inv('Blood ketones', 'urgent', 'Exclude DKA');
  if (bleeding) inv('Group and cross-match; FBC; PT/INR, APTT, fibrinogen', 'urgent', 'Active bleeding');
  if (patient.fever && bleeding) inv('Lassa fever PCR (isolate first)', 'urgent', 'Fever with bleeding');
  if (k != null && k < 3.5 && mg == null) inv('Magnesium', 'urgent', 'Hypokalaemia will not correct while Mg is low');
  if (na != null && na < 130 && osmMeasured == null) inv('Serum and urine osmolality, urine Na; TSH; cortisol', 'today', 'Classify hyponatraemia');
  if (R.medication_review.some(m => m.tdm)) for (const m of R.medication_review.filter(x => x.tdm)) inv(`${m.drug} level`, 'today', m.tdm);
  for (const m of R.medication_review.filter(x => x.recommendation !== 'continue')) {
    R.plan.medications.push({ action: (m.recommendation === 'substitute' ? 'stop' : m.recommendation) as 'stop' | 'adjust' | 'hold', drug: m.drug, dose: m.recommendation === 'adjust' ? 'Recalculate with the formulary for the stated CrCl band / weight' : '', route: '', frequency: '', duration: '', calculation: m.renal_adjustment, rationale: m.details });
  }
  // Fluids.
  const overload = sign(/crackles|fluid overload|oedema|raised jvp/) || symptom(/orthopn|pnd/);
  const shocked = (map != null && map < 65) || (ok(v.sbp) && v.sbp < 90) || (lactate ?? 0) >= 4;
  const caution = [/heart failure|ccf|chf/.test(comorb) && 'heart failure', /esrd|dialysis|end.?stage/.test(comorb) && 'end-stage kidney disease', /malnutri/.test(comorb) && 'severe malnutrition', (hb ?? 999) < 70 && 'severe anaemia (consider transfusion instead)', malariaPos && 'severe malaria', child && patient.fever && !shocked && 'febrile child who is not shocked', symptom(/head injury/) && 'raised ICP (avoid hypotonic fluids)'].filter(Boolean) as string[];
  const maint = weight != null ? (child ? hollidaySegar(weight) : Math.round(maintenanceFluidMlPerHour(weight) * 24)) : null;
  let fluidRx = '', fluidRate: number | null = null;
  if (shocked && !overload) {
    const bolus = weight != null && child ? Math.round(10 * weight) : 500;
    fluidRx = `Balanced crystalloid (Ringer's lactate) ${child ? `${bolus} mL (10 mL/kg)` : '250–500 mL'} over 15 min, reassess after each bolus${infection ? `; in sepsis up to 30 mL/kg (${weight ? Math.round(30 * weight) : '—'} mL) in the first 3 h with frequent reassessment` : ''}; stop at signs of overload; noradrenaline for MAP ≥ 65 if fluid-unresponsive`;
    fluidRate = null;
  } else if (overload) fluidRx = 'Signs of fluid overload — no fluid bolus; consider diuretic if passing urine; dialysis if refractory with AKI';
  else if (maint) { fluidRx = `${child ? 'Holliday–Segar' : '25–30 mL/kg/day'} maintenance ≈ ${maint} mL/day of isotonic fluid${child ? '' : ' with ~1 mmol/kg/day each of Na, K and Cl and 50–100 g/day glucose'}; count drug infusions and feeds`; fluidRate = Math.round(maint / 24); }
  if (ok(input.burn_tbsa_pct) && input.burn_tbsa_pct > 0 && weight != null) {
    const pk = burnCareService.calculateParklandFormula(weight, input.burn_tbsa_pct, now, now, age ?? undefined);
    calc({ name: 'Parkland formula', inputs: { weight_kg: weight, tbsa_pct: input.burn_tbsa_pct }, formula: '4 mL × weight × %TBSA of Ringer\'s lactate over 24 h, half in the first 8 h from the time of the burn', result: pk.totalVolume24h, unit: 'mL', interpretation: `${pk.firstHalfVolume} mL in the first 8 h from the burn, ${pk.secondHalfVolume} mL over the next 16 h; titrate to urine output ${child ? '1' : '0.5'} mL/kg/h`, app_value_agrees: null, caveats: 'Rates assume the burn time is now — recalculate from the actual time of burn' });
    fluidRx = `Burns: Parkland ${pk.totalVolume24h} mL Ringer's lactate over 24 h from the time of burn${child ? ' plus maintenance with glucose' : ''}. ${fluidRx}`;
  }
  R.plan.fluids = {
    assessment: [shocked && 'Hypoperfused', overload && 'Signs of fluid overload', hypovolaemic && !overload && 'Clinically dry/hypovolaemic', input.fluid_balance?.intake_ml_24h != null && input.fluid_balance?.output_ml_24h != null && `24-h balance ${input.fluid_balance.intake_ml_24h! - input.fluid_balance.output_ml_24h!} mL`, caution.length && `Caution: ${caution.join(', ')}`].filter(Boolean).join('. ') || 'Volume status not determinable from the data — assess CRT, JVP, lungs, UO, passive leg raise, ultrasound',
    prescription: fluidRx || 'Assess before prescribing', rate_ml_per_h: fluidRate, reassess: 'After every bolus; hourly UO, lactate trend, signs of overload',
  };
  // Monitoring.
  const mon = (parameter: string, frequency: string, target: string) => R.plan.monitoring.push({ parameter, frequency, target });
  mon('Vital signs + NEWS2', shocked || (news?.total ?? 0) >= 5 ? 'Continuous / hourly' : '4-hourly', 'MAP ≥ 65 mmHg, SpO2 94–98% (88–92% if CO2 retainer)');
  if (aki > 0 || shocked) mon('Urine output (catheter)', 'Hourly', '≥ 0.5 mL/kg/h');
  if (k != null && (k > 5.5 || k < 3.5)) mon('Potassium', k >= 6.5 || k < 2.5 ? '1, 2, 4, 6 and 24 h after treatment' : '4–6-hourly', '4.0–5.0 mmol/L');
  if (na != null && (na < 130 || na > 150)) mon('Sodium', na < 125 || na > 155 ? '2-hourly (1–2-hourly on hypertonic saline)' : '4–6-hourly', 'Change ≤ 10 mmol/L per 24 h');
  if (glu != null && (glu > 10 || glu < 4) || crisis.dka) mon('Capillary glucose', crisis.dka || crisis.hhs ? 'Hourly' : '1–4-hourly', '7.8–10.0 mmol/L (ICU)');
  if (crisis.dka) mon('Blood ketones / venous gas', 'Hourly / 2-hourly', 'Ketones fall ≥ 0.5 mmol/L/h; HCO3 rise ~3 mmol/L/h');
  if (lactate != null && lactate > 2) mon('Lactate', '2-hourly until falling', '< 2 mmol/L');
  // Escalation and alternatives.
  if (R.critical_alerts.length || so.value != null && so.value >= 2 || (news?.total ?? 0) >= 7) R.plan.escalation.push('ICU/HDU review now: critical alert, NEWS2 ≥ 7 or organ dysfunction');
  if (ok(v.gcs) && v.gcs <= 8 || (ok(v.spo2) && v.spo2 < 90 && (fio2Frac ?? 0) >= 0.6)) R.plan.escalation.push('Anaesthetic review for airway / ventilation');
  if (shocked) R.plan.escalation.push('Vasopressors if MAP < 65 after adequate fluid (noradrenaline first-line)');
  if (dial.length) R.plan.escalation.push('Nephrology for dialysis: ' + dial.join('; '));
  if (sign(/guarding/) || symptom(/haematemesis|melaena/)) R.plan.escalation.push('Surgical / endoscopy review');
  const alts = R.plan.resource_limited_alternatives;
  if (dial.length) alts.push('If CRRT is unavailable: intermittent haemodialysis or acute peritoneal dialysis — less haemodynamic stability than CRRT');
  if (ica == null && (ca != null)) alts.push('No ionised calcium: use albumin-corrected calcium — less reliable in acid–base disturbance and critical illness');
  if (ph == null) alts.push('No blood gas: venous gas for pH/HCO3/lactate and SpO2/FiO2 as the oxygenation surrogate — no PaO2 or A–a gradient');
  if ((k ?? 0) >= 6) alts.push('No modern potassium binder: calcium polystyrene sulfonate (slow onset); repeat insulin–glucose with glucose monitoring');
  if (shocked) alts.push('No noradrenaline: adrenaline infusion (more tachycardia, lactate rise) or dopamine — via a large vein with close monitoring');

  // ── Summary and confidence ───────────────────────────────────────────────
  const top = R.critical_alerts.slice(0, 3).map(a => a.finding);
  const failing = R.organ_systems.filter(o => o.status === 'failing').map(o => o.system);
  R.clinical_summary = [
    `${age ?? '?'}-year-old ${sex || 'patient'}${P.location ? ` in ${P.location}` : ''}${input.presenting_complaint ? ` presenting with ${input.presenting_complaint}` : ''}.`,
    top.length ? `Critical: ${top.join('; ')}.` : 'No critical-alert threshold met in the data supplied.',
    failing.length ? `Failing organ systems: ${failing.join(', ')}.` : '',
    R.differential_diagnosis.length ? `Leading rule-based considerations: ${R.differential_diagnosis.slice(0, 3).map(d => d.diagnosis).join('; ')}.` : '',
    input.clinician_question ? `Clinician question: "${input.clinician_question}" — the rule-based analysis cannot answer free questions; request the consultant AI review.` : '',
  ].filter(Boolean).join(' ');
  const essentials = R.data_quality.missing_essential.length;
  R.confidence = {
    overall: essentials >= 3 || R.data_quality.implausible_values.length ? 'low' : essentials ? 'moderate' : 'high',
    limitations: ['Rule-based analysis: calculations are deterministic; the differential lists patterns, not a clinical judgement', ...R.data_quality.missing_essential.map(m => `Missing: ${m}`), ...(steady ? [] : ['Renal function not at steady state'])],
  };
  return R;
}

function band(crcl: number) { return crcl > 50 ? 'CrCl > 50 mL/min' : crcl >= 30 ? 'CrCl 30–50 mL/min' : crcl >= 10 ? 'CrCl 10–29 mL/min' : 'CrCl < 10 mL/min'; }
function agrees(app: number | null | undefined, mine: number | null, tol: number): boolean | null {
  if (app == null || app === 0 || mine == null) return null;
  return Math.abs(app - mine) <= Math.max(1, Math.abs(mine) * tol);
}
