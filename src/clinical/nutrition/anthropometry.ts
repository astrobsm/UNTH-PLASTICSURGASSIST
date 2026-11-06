/**
 * Anthropometry: height and weight when they cannot be measured, body-weight
 * standards, and the derived indices (BMI, weight change, MAMC, grip).
 */
import type { NutritionConfig } from './config/nutrition.v1';
import type { Calc, NutritionInputs, WeightPoint } from './types';

const r1 = (x: number) => Math.round(x * 10) / 10;
const pos = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

export function heightOf(i: NutritionInputs, cfg: NutritionConfig): Calc | null {
  const pop = i.population ?? cfg.defaultPopulation.value;
  if (pos(i.heightCm) && i.heightMeasured !== false) {
    return { value: r1(i.heightCm), method: 'Measured', inputs: { heightCm: i.heightCm }, assumptions: [] };
  }
  if (pos(i.kneeHeightCm) && i.sex && pos(i.ageYears)) {
    const older = i.ageYears > cfg.kneeHeight.olderFromAge.value;
    const k = (older ? cfg.kneeHeight.older : cfg.kneeHeight.adult)[pop][i.sex];
    const h = k.value.a + k.value.b * i.kneeHeightCm + k.value.c * i.ageYears;
    return {
      value: r1(h), method: `Knee height (Chumlea, ${pop}, ${older ? '> 60 y' : '18–60 y'})`,
      inputs: { kneeHeightCm: i.kneeHeightCm, ageYears: i.ageYears, sex: i.sex, population: pop },
      assumptions: ['Estimated stature — SEE about ±4 cm'], source: k.source,
    };
  }
  if (pos(i.ulnaCm) && i.sex) {
    const from65 = pos(i.ageYears) && i.ageYears >= 65;
    const k = cfg.ulna[i.sex][from65 ? 'from65' : 'under65'];
    return {
      value: r1(k.value.a + k.value.b * i.ulnaCm), method: `Ulna length (BAPEN, ${from65 ? '≥ 65' : '< 65'} y)`,
      inputs: { ulnaCm: i.ulnaCm, sex: i.sex, ageYears: i.ageYears ?? null },
      assumptions: [cfg.ulna.note, ...(pos(i.ageYears) ? [] : ['Age unknown — under-65 equation used'])], source: k.source,
    };
  }
  if (pos(i.heightCm)) {
    return { value: r1(i.heightCm), method: 'Reported', inputs: { heightCm: i.heightCm }, assumptions: ['Self- or family-reported height'] };
  }
  return null;
}

export function amputationFraction(i: NutritionInputs, cfg: NutritionConfig): number {
  return (i.amputations || []).reduce((s, a) => s + (cfg.amputation.value[a] ?? 0), 0);
}

/**
 * Working weight: measured/reported minus dressings, else estimated from knee
 * height + MUAC. `wholeBodyKg` adds back amputated segments for BMI and IBW
 * comparisons; `kg` is the weight the patient actually carries (used for kcal/kg).
 */
export function weightOf(i: NutritionInputs, cfg: NutritionConfig): (Calc & { wholeBodyKg: number; estimated: boolean }) | null {
  const amp = amputationFraction(i, cfg);
  const assumptions: string[] = [];
  let kg: number | null = null, method = '', estimated = false, source: string | undefined;
  const inputs: Calc['inputs'] = {};

  if (pos(i.weightKg) && i.weightMethod !== 'unavailable') {
    kg = i.weightKg; inputs.weightKg = i.weightKg; inputs.weightMethod = i.weightMethod ?? 'measured';
    method = i.weightMethod === 'reported' ? 'Reported weight' : `Weighed (${(i.weightMethod ?? 'measured').replace('_', ' ')})`;
    if (i.weightMethod === 'reported') assumptions.push('Reported weight — confirm by weighing when possible');
    if (pos(i.dressingKg)) { kg -= i.dressingKg; inputs.dressingKg = i.dressingKg; assumptions.push(`${i.dressingKg} kg of dressing/cast subtracted`); }
  } else if (pos(i.kneeHeightCm) && pos(i.muacCm) && i.sex && pos(i.ageYears)) {
    const pop = i.population ?? cfg.defaultPopulation.value;
    const older = i.ageYears > cfg.weightFromKneeMuac.olderFromAge.value;
    const k = (older ? cfg.weightFromKneeMuac.older : cfg.weightFromKneeMuac.adult)[pop][i.sex];
    kg = k.value.a * i.kneeHeightCm + k.value.b * i.muacCm + k.value.k;
    Object.assign(inputs, { kneeHeightCm: i.kneeHeightCm, muacCm: i.muacCm, sex: i.sex, ageYears: i.ageYears, population: pop });
    method = `Estimated from knee height + MUAC (Chumlea, ${pop})`; estimated = true; source = k.source;
    assumptions.push(`Estimated weight — accuracy about ±${cfg.weightFromKneeMuac.accuracy.value} kg; not for drug dosing`);
  }
  if (kg === null || kg <= 0) return null;
  if (i.oedema && i.oedema !== 'none' || i.ascites && i.ascites !== 'none') assumptions.push('Oedema/ascites present — weight overstates lean tissue; trend MUAC and calf instead');
  let wholeBodyKg = kg;
  if (amp > 0) {
    wholeBodyKg = kg / (1 - amp);
    inputs.amputationFraction = r1(amp * 100) / 100;
    assumptions.push(`Amputation: ${Math.round(amp * 1000) / 10}% of body weight added back for BMI (Osterkamp 1995)`);
  }
  return { value: r1(kg), wholeBodyKg: r1(wholeBodyKg), estimated, method, inputs, assumptions, source };
}

export function bmiCalc(weightWholeKg: number | null, heightCm: number | null): Calc | null {
  if (!pos(weightWholeKg) || !pos(heightCm)) return null;
  return { value: r1(weightWholeKg / (heightCm / 100) ** 2), method: 'Weight ÷ height²', inputs: { weightKg: weightWholeKg, heightCm }, assumptions: [] };
}

/** BMI band from MUAC when no BMI can be calculated (BAPEN). */
export function muacBmiBand(i: NutritionInputs, cfg: NutritionConfig): Calc<'lt20' | 'gt30' | 'indeterminate'> | null {
  if (!pos(i.muacCm)) return null;
  const v = i.muacCm < cfg.muacBmi.lowCm.value ? 'lt20' : i.muacCm > cfg.muacBmi.highCm.value ? 'gt30' : 'indeterminate';
  return { value: v, method: 'MUAC → BMI band (BAPEN)', inputs: { muacCm: i.muacCm }, assumptions: ['Band only — not a BMI value'], source: cfg.muacBmi.lowCm.source };
}

export function ibwOf(heightCm: number | null, sex: NutritionInputs['sex'], cfg: NutritionConfig): Calc | null {
  if (!pos(heightCm) || !sex) return null;
  const k = cfg.ibwDevine[sex].value;
  const v = k.base + k.perCmOver152_4 * (heightCm - 152.4);
  return {
    value: r1(Math.max(v, sex === 'male' ? 40 : 35)), method: 'Devine ideal body weight', inputs: { heightCm, sex },
    assumptions: heightCm < 152.4 ? ['Height below 152 cm — Devine extrapolated; interpret with care'] : [], source: cfg.ibwDevine[sex].source,
  };
}

export function adjustedBwOf(actualKg: number | null, ibw: number | null, cfg: NutritionConfig): Calc | null {
  if (!pos(actualKg) || !pos(ibw)) return null;
  const f = cfg.adjustedBwFactor.value;
  return { value: r1(ibw + f * (actualKg - ibw)), method: `IBW + ${f} × (actual − IBW)`, inputs: { actualKg, ibwKg: ibw }, assumptions: [], source: cfg.adjustedBwFactor.source };
}

const DAY = 86_400_000;

/** % change from the closest weight at or before each look-back window. Negative = loss. */
export function weightChanges(history: WeightPoint[] = [], now = new Date()): { week1: number | null; month1: number | null; months3to6: number | null; latestKg: number | null } {
  const pts = history.filter(p => pos(p.kg) && !Number.isNaN(Date.parse(p.date))).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (pts.length < 2) return { week1: null, month1: null, months3to6: null, latestKg: pts[0]?.kg ?? null };
  const latest = pts[pts.length - 1];
  const t = Math.min(Date.parse(latest.date), now.getTime());
  const pct = (minDays: number, maxDays: number) => {
    const cands = pts.filter(p => p !== latest && (t - Date.parse(p.date)) / DAY >= minDays && (t - Date.parse(p.date)) / DAY <= maxDays);
    if (!cands.length) return null;
    const base = cands[cands.length - 1];
    return r1(((latest.kg - base.kg) / base.kg) * 100);
  };
  return { week1: pct(5, 10), month1: pct(21, 45), months3to6: pct(80, 190), latestKg: latest.kg };
}

/** Unplanned weight loss % over 3–6 months (positive number = loss), from history or the stated figure. */
export function lossPct3to6m(i: NutritionInputs): Calc | null {
  const ch = weightChanges(i.weightHistory);
  if (ch.months3to6 !== null) return { value: Math.max(0, -ch.months3to6), method: 'Weight history (3–6 months)', inputs: { changePct: ch.months3to6 }, assumptions: [] };
  if (typeof i.weightLossPct3to6m === 'number') return { value: Math.max(0, i.weightLossPct3to6m), method: 'Stated by patient/family', inputs: { weightLossPct3to6m: i.weightLossPct3to6m }, assumptions: ['Recalled weight loss'] };
  return null;
}

export function mamcOf(i: NutritionInputs): Calc | null {
  if (!pos(i.muacCm) || !pos(i.tsfMm)) return null;
  return { value: r1(i.muacCm - Math.PI * (i.tsfMm / 10)), method: 'MAMC = MUAC − π × TSF', inputs: { muacCm: i.muacCm, tsfMm: i.tsfMm }, assumptions: ['TSF converted mm → cm'] };
}

export function gripOf(i: NutritionInputs, cfg: NutritionConfig): Calc<'low' | 'normal'> & { kg: number } | null {
  if (!pos(i.gripKg) || !i.sex) return null;
  const cut = cfg.gripLowKg[i.sex];
  return {
    value: i.gripKg < cut.value ? 'low' : 'normal', kg: i.gripKg, method: `Grip vs EWGSOP2 cut-off (${cut.value} kg)`,
    inputs: { gripKg: i.gripKg, sex: i.sex }, assumptions: [cfg.gripLowKg.note], source: cut.source,
  };
}
