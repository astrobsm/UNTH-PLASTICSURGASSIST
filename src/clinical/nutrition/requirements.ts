/**
 * Requirements: energy (every applicable equation, one recommended, the
 * clinician picks), protein, the rate-controlled weight goal, refeeding risk
 * with its stepped schedule, fluid, micronutrient priorities and nitrogen
 * balance. Plus the out-of-scope gate.
 */
import type { NutritionConfig } from './config/nutrition.v1';
import type { Calc, Goal, NutritionInputs } from './types';

const r0 = (x: number) => Math.round(x);
const r1 = (x: number) => Math.round(x * 10) / 10;
const pos = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** Body context the requirement formulas need, resolved by the assessment. */
export interface Body { kg: number | null; heightCm: number | null; bmi: number | null; ibw: number | null; adjbw: number | null }

// ── Scope ───────────────────────────────────────────────────────────────────
export function scopeOf(i: NutritionInputs): { inScope: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (i.ageYears != null && i.ageYears < 18) reasons.push('Patient under 18 years');
  if (i.pregnant) reasons.push('Pregnancy');
  if (i.lactating) reasons.push('Lactation');
  if (i.dialysis) reasons.push('Dialysis-dependent renal failure');
  if (i.parenteral) reasons.push('Parenteral nutrition');
  return { inScope: reasons.length === 0, reasons };
}
export const OUT_OF_SCOPE_NOTICE = 'Specialist dietitian/physician input required';

// ── Catabolic state ─────────────────────────────────────────────────────────
export function catabolicReasons(i: NutritionInputs, cfg: NutritionConfig): string[] {
  const r: string[] = [];
  if ((i.tbsaPct ?? 0) > 0 && (i.daysSinceInjury == null || i.daysSinceInjury <= cfg.catabolicBurnDays.value)) r.push(`Burn ${i.tbsaPct}% TBSA`);
  if (i.sepsis) r.push('Sepsis');
  if (i.icu || i.ventilated) r.push('Critical illness');
  if ((i.woundAreaCm2 ?? 0) >= cfg.largeWoundCm2.value || i.exudate === 'high') r.push('Large or heavily exuding wound');
  return r;
}

/** An open wound that is healing (any size) — wound-specific energy and protein apply. */
export const openWound = (i: NutritionInputs) => (i.woundAreaCm2 ?? 0) > 0 || (i.exudate != null && i.exudate !== 'none');

// ── Energy ──────────────────────────────────────────────────────────────────
export interface EnergyOption extends Calc {
  id: string;
  label: string;
  low?: number;
  high?: number;
  warnings: string[];
}

function mifflin(kg: number, h: number, age: number, sex: 'male' | 'female', cfg: NutritionConfig) {
  const k = cfg.mifflin.value;
  return k.w * kg + k.h * h + k.a * age + (sex === 'male' ? k.male : k.female);
}
function harrisBenedict(kg: number, h: number, age: number, sex: 'male' | 'female', cfg: NutritionConfig) {
  const k = cfg.harrisBenedict[sex].value;
  return k.k + k.w * kg + k.h * h + k.a * age;
}

export function energyOptions(i: NutritionInputs, b: Body, cfg: NutritionConfig): EnergyOption[] {
  const out: EnergyOption[] = [];
  const { kg, heightCm: h, bmi, ibw } = b;
  const age = i.ageYears, sex = i.sex;
  const basic = pos(kg) && pos(h) && pos(age) && !!sex;

  if (pos(i.indirectCalorimetryKcal)) {
    out.push({ id: 'ic', label: 'Indirect calorimetry', value: r0(i.indirectCalorimetryKcal), method: 'Measured energy expenditure',
      inputs: { measuredKcal: i.indirectCalorimetryKcal }, assumptions: [], warnings: [], source: 'ESPEN ICU 2019 — preferred when available' });
  }

  if (basic) {
    const ree = mifflin(kg!, h!, age!, sex!, cfg);
    out.push({ id: 'mifflin', label: 'Mifflin–St Jeor (resting)', value: r0(ree), method: `${sex === 'male' ? '10W + 6.25H − 5A + 5' : '10W + 6.25H − 5A − 161'}`,
      inputs: { weightKg: kg, heightCm: h, ageYears: age!, sex: sex! }, assumptions: ['Resting expenditure — add activity and stress for total'], warnings: [], source: cfg.mifflin.source });
    const act = cfg.activityFactor.value[i.mobility ?? 'chair'];
    const st = cfg.stressFactor.value[i.stress ?? 'none'];
    out.push({ id: 'mifflin_total', label: 'Mifflin–St Jeor × activity × stress', value: r0(ree * act * st),
      method: `Mifflin × ${act} (activity) × ${st} (stress)`, inputs: { ree: r0(ree), activity: act, stress: st, mobility: i.mobility ?? 'chair', stressKind: i.stress ?? 'none' },
      assumptions: [...(i.mobility ? [] : ['Mobility not stated — chair-bound factor used']), ...(i.stress ? [] : ['No stress factor stated'])], warnings: [],
      source: `${cfg.activityFactor.source}; ${cfg.stressFactor.source}` });
    const hb = harrisBenedict(kg!, h!, age!, sex!, cfg);
    out.push({ id: 'hb_total', label: 'Harris–Benedict × activity × stress', value: r0(hb * act * st), method: `Harris–Benedict ${r0(hb)} × ${act} × ${st}`,
      inputs: { hbRee: r0(hb), activity: act, stress: st }, assumptions: [], warnings: bmi && bmi >= 30 ? ['Harris–Benedict overestimates in obesity'] : [], source: cfg.harrisBenedict[sex!].source });

    if (i.ventilated && pos(i.minuteVentilationL) && pos(i.tMaxC)) {
      const old = age! >= cfg.pennState2010When.value.ageFrom && (bmi ?? 0) >= cfg.pennState2010When.value.bmiFrom;
      const k = old ? cfg.pennState2010.value : cfg.pennState2003b.value;
      const v = k.mifflin * ree + k.ve * i.minuteVentilationL + k.tmax * i.tMaxC + k.k;
      out.push({ id: 'penn_state', label: old ? 'Penn State 2010 (modified)' : 'Penn State 2003b', value: r0(v),
        method: `${k.mifflin} × Mifflin + ${k.ve} × VE + ${k.tmax} × Tmax ${k.k}`, inputs: { mifflin: r0(ree), veLmin: i.minuteVentilationL, tMaxC: i.tMaxC },
        assumptions: [], warnings: [], source: old ? cfg.pennState2010.source : cfg.pennState2003b.source });
    }

    if ((i.tbsaPct ?? 0) > 0 && pos(i.tMaxC) && i.previousDayKcal != null && i.daysSinceInjury != null) {
      const k = cfg.toronto.value;
      const v = k.k + k.tbsa * i.tbsaPct! + k.intake * i.previousDayKcal + k.hbRee * hb + k.temp * i.tMaxC + k.day * i.daysSinceInjury;
      out.push({ id: 'toronto', label: 'Toronto (burns)', value: r0(v),
        method: '−4343 + 10.5×TBSA + 0.23×kcal(prev 24 h) + 0.84×HB + 114×T − 4.5×day', inputs: { tbsaPct: i.tbsaPct!, previousDayKcal: i.previousDayKcal, hbRee: r0(hb), tMaxC: i.tMaxC, day: i.daysSinceInjury },
        assumptions: [], warnings: [], source: cfg.toronto.source });
    }
  }

  if ((i.tbsaPct ?? 0) > 0 && pos(kg)) {
    const k = cfg.curreri.value;
    const t = Math.min(i.tbsaPct!, k.tbsaCap);
    out.push({ id: 'curreri', label: 'Curreri (burns)', value: r0(k.perKg * kg + k.perTbsa * t), method: `25 × W + 40 × TBSA (TBSA capped at ${k.tbsaCap}%)`,
      inputs: { weightKg: kg, tbsaPct: i.tbsaPct!, tbsaUsed: t }, assumptions: [], warnings: ['Curreri overestimates — prefer Toronto or calorimetry'], source: cfg.curreri.source });
  }

  if ((i.icu || i.ventilated) && pos(kg)) {
    if (bmi !== null && bmi >= cfg.obeseBmi.value) {
      const o = cfg.obeseIcu.value;
      const band = bmi > 50 ? o.bmiOver50 : o.bmi30to50;
      const basisKg = band.basis === 'ibw' ? ibw : kg;
      if (pos(basisKg)) out.push({ id: 'icu_obese', label: `ICU obesity (ASPEN, BMI ${bmi > 50 ? '> 50' : '30–50'})`, value: r0((band.low + band.high) / 2 * basisKg),
        low: r0(band.low * basisKg), high: r0(band.high * basisKg), method: `${band.low}–${band.high} kcal/kg ${band.basis === 'ibw' ? 'ideal' : 'actual'} weight`,
        inputs: { bmi, basisKg }, assumptions: ['Hypocaloric, high-protein strategy'], warnings: [], source: cfg.obeseIcu.source });
    } else {
      const k = cfg.icuKcalPerKg.value;
      const early = i.daysSinceInjury == null || i.daysSinceInjury <= k.earlyDays;
      const lo = early ? k.earlyLow : k.lateLow, hi = early ? k.earlyHigh : k.lateHigh;
      out.push({ id: 'icu_kcal_kg', label: `ICU ${early ? 'early phase' : 'recovery phase'} (ESPEN)`, value: r0((lo + hi) / 2 * kg), low: r0(lo * kg), high: r0(hi * kg),
        method: `${lo}–${hi} kcal/kg/day`, inputs: { weightKg: kg, early }, assumptions: i.daysSinceInjury == null ? ['ICU day unknown — early-phase range used'] : [], warnings: [], source: cfg.icuKcalPerKg.source });
    }
  }

  if (pos(kg) && !(i.icu || i.ventilated)) {
    const obese = bmi !== null && bmi >= cfg.obeseBmi.value;
    const basisKg = obese && pos(b.adjbw) ? b.adjbw : kg;
    const basisText = `${obese && pos(b.adjbw) ? 'adjusted' : 'actual'} weight`;
    const assumptions = obese && pos(b.adjbw) ? ['Obese — adjusted body weight used'] : [];
    if (openWound(i) && !((i.tbsaPct ?? 0) > 0)) {
      // EPUAP/NPIAP: 30 kcal/kg for a healing wound, 35 when large, heavily exuding or underweight.
      const k = cfg.woundKcalPerKg.value;
      const high = (i.woundAreaCm2 ?? 0) >= cfg.largeWoundCm2.value || i.exudate === 'high' || (bmi !== null && bmi < 18.5);
      const per = high ? k.high : k.low;
      out.push({ id: 'kcal_kg', label: 'Wound healing kcal/kg', value: r0(per * basisKg), low: r0(k.low * basisKg), high: r0(k.high * basisKg),
        method: `${per} kcal/kg/day on ${basisText} (range ${k.low}–${k.high}${high ? '; large/exuding wound or underweight' : ''})`, inputs: { basisKg, woundAreaCm2: i.woundAreaCm2 ?? null, exudate: i.exudate ?? null },
        assumptions, warnings: [], source: cfg.woundKcalPerKg.source });
    } else {
      const k = cfg.kcalPerKgWard.value;
      out.push({ id: 'kcal_kg', label: 'Ward kcal/kg', value: r0((k.low + k.high) / 2 * basisKg), low: r0(k.low * basisKg), high: r0(k.high * basisKg),
        method: `${k.low}–${k.high} kcal/kg/day on ${basisText}`, inputs: { basisKg }, assumptions, warnings: [], source: cfg.kcalPerKgWard.source });
    }
  }
  return out;
}

/** The method the engine recommends, in order of preference. */
export function recommendedEnergy(opts: EnergyOption[], i: NutritionInputs): EnergyOption | null {
  const by = (id: string) => opts.find(o => o.id === id);
  const order = ['ic'];
  // Obese critically ill: ASPEN hypocaloric feeding outranks any REE equation.
  if (i.icu || i.ventilated) order.push('icu_obese');
  if (i.ventilated) order.push('penn_state');
  if ((i.tbsaPct ?? 0) > 0) order.push('toronto');
  if (i.icu || i.ventilated) order.push('icu_kcal_kg');
  if ((i.tbsaPct ?? 0) > 0) order.push('curreri');
  // A healing wound on the ward: the guideline kcal/kg band outranks a REE equation.
  if (openWound(i) && !(i.icu || i.ventilated) && !((i.tbsaPct ?? 0) > 0)) order.push('kcal_kg');
  order.push('mifflin_total', 'kcal_kg', 'hb_total');
  for (const id of order) { const o = by(id); if (o) return o; }
  return null;
}

// ── Protein ─────────────────────────────────────────────────────────────────
export function proteinOf(i: NutritionInputs, b: Body, cfg: NutritionConfig): (Calc & { low: number; high: number; perKg: number; basis: string; warnings: string[] }) | null {
  const p = cfg.protein.value;
  const obese = b.bmi !== null && b.bmi >= cfg.obeseBmi.value;
  const critical = !!(i.icu || i.ventilated);
  const catabolic = catabolicReasons(i, cfg).length > 0;
  let band: { low: number; high: number; target: number }, label: string, basisKg = b.kg, basis = 'actual weight';
  const warnings: string[] = [];
  if (critical && obese && pos(b.ibw)) {
    band = b.bmi! >= 40 ? p.obeseIcuFrom40 : p.obeseIcu30to40; label = `Obese critically ill (BMI ${b.bmi! >= 40 ? '≥ 40' : '30–40'})`; basisKg = b.ibw; basis = 'ideal body weight';
  } else if (i.ckd && !critical && (catabolic || openWound(i))) {
    // Healing or catabolic CKD on the ward: neither the stable-CKD restriction nor the full wound band.
    const h = p.ckdHealingWound;
    band = { low: h.low, high: h.high, target: catabolic ? h.high : h.target };
    label = catabolic ? 'CKD (not on dialysis) with catabolic illness' : 'CKD (not on dialysis) with a healing wound';
    warnings.push(`Healing and renal protection conflict — ${band.target} g/kg is a compromise; agree the target with nephrology and monitor urea`);
  } else if (i.ckd && !critical) {
    band = p.ckdNonDialysis; label = 'CKD, non-dialysis, metabolically stable';
    warnings.push('Reduced protein for stable CKD (KDOQI 2020) — physician / nephrology to confirm');
  } else if ((i.tbsaPct ?? 0) > 0 || catabolicReasons(i, cfg).some(r => /wound/i.test(r))) {
    band = p.woundsBurns; label = 'Burns / large wounds';
  } else if (critical) {
    band = p.icu; label = 'Critical illness';
  } else if (openWound(i)) {
    band = p.woundHealing; label = 'Healing wound (EPUAP/NPIAP 2019)';
  } else {
    band = p.ward; label = 'General ward';
  }
  if (obese && !critical && pos(b.adjbw) && cfg.obeseWardProteinBasis.value === 'adjusted') { basisKg = b.adjbw; basis = 'adjusted body weight'; }
  if (i.ckd && critical) warnings.push('CKD in critical illness — protein is not restricted (ESPEN ICU); monitor urea, nephrology to confirm');
  if (!pos(basisKg)) return null;
  return {
    value: r0(band.target * basisKg), low: r0(band.low * basisKg), high: r0(band.high * basisKg), perKg: band.target, basis,
    method: `${label}: ${band.low}–${band.high} g/kg (target ${band.target}) on ${basis}`, inputs: { basisKg, bmi: b.bmi },
    assumptions: [], warnings, source: cfg.protein.source,
  };
}

// ── Goal ────────────────────────────────────────────────────────────────────
export interface GoalPlan {
  goal: Goal;
  baseKcal: number;
  targetKcal: number;
  adjustmentKcal: number;
  rateKgWk: number;
  blocked: string[];
  notes: string[];
  method: string;
}

export function goalPlan(i: NutritionInputs, baseKcal: number, b: Body, cfg: NutritionConfig): GoalPlan {
  const goal = i.goal ?? 'maintain';
  const notes: string[] = [], blocked: string[] = [];
  const K = cfg.kcalPerKgFat.value;
  if (goal === 'maintain') return { goal, baseKcal, targetKcal: baseKcal, adjustmentKcal: 0, rateKgWk: 0, blocked, notes, method: 'Maintenance' };

  if (goal === 'lose') {
    const cat = catabolicReasons(i, cfg);
    if (cat.length && !i.override?.lossWhileCatabolic) {
      blocked.push(`Weight loss not planned while catabolic (${cat.join(', ')}) — meet energy and protein needs first. Clinician override required.`);
      return { goal: 'maintain', baseKcal, targetKcal: baseKcal, adjustmentKcal: 0, rateKgWk: 0, blocked, notes, method: 'Maintenance (loss blocked)' };
    }
    const lr = cfg.lossRateKgWk.value, ld = cfg.lossDeficit.value;
    const rate = Math.min(Math.max(i.targetRateKgWk ?? lr.low, lr.low), lr.high);
    if (i.targetRateKgWk != null && rate !== i.targetRateKgWk) notes.push(`Requested ${i.targetRateKgWk} kg/week limited to ${rate} kg/week`);
    const deficit = Math.min(Math.max(r0(rate * K / 7), ld.low), ld.high);
    let target = baseKcal - deficit;
    const floor = i.sex ? cfg.kcalFloor.value[i.sex] : cfg.kcalFloor.value.male;
    if (target < floor && !i.override?.belowFloor) {
      notes.push(`Raised to the ${floor} kcal safety floor${i.sex ? '' : ' (sex unknown — higher floor used)'}; override needs a clinician reason`);
      target = floor;
    }
    notes.push('Protein is held at the full target during weight loss');
    if (i.diabetes) notes.push('Diabetes: review hypoglycaemic drugs as intake falls');
    return { goal, baseKcal, targetKcal: r0(target), adjustmentKcal: r0(target - baseKcal), rateKgWk: r1((baseKcal - target) * 7 / K), blocked, notes,
      method: `${rate} kg/week × ${K} kcal/kg ÷ 7 = ${deficit} kcal/day deficit` };
  }

  const gr = cfg.gainRateKgWk.value, gs = cfg.gainSurplus.value;
  const rate = Math.min(Math.max(i.targetRateKgWk ?? gr.low, gr.low), gr.high);
  const surplus = Math.min(Math.max(r0(rate * K / 7), gs.low), gs.high);
  if (b.bmi !== null && b.bmi >= cfg.obeseBmi.value) notes.push('Weight gain requested in an obese patient — confirm the goal');
  return { goal, baseKcal, targetKcal: r0(baseKcal + surplus), adjustmentKcal: surplus, rateKgWk: r1(surplus * 7 / K), blocked, notes,
    method: `${rate} kg/week × ${K} kcal/kg ÷ 7 → ${surplus} kcal/day surplus (limited to ${gs.low}–${gs.high})` };
}

// ── Refeeding ───────────────────────────────────────────────────────────────
export interface Refeeding {
  risk: 'low' | 'high' | 'extreme';
  major: string[];
  minor: string[];
  schedule: { day: number; kcal: number; kcalPerKg: number }[];
  alerts: string[];
  method: string;
  source: string;
}

export function refeedingOf(i: NutritionInputs, b: Body, lossPct: number | null, fullKcal: number | null, cfg: NutritionConfig): Refeeding {
  const R = cfg.refeeding.value;
  const nil = i.daysLittleOrNoIntake ?? 0;
  const L = i.labs || {};
  const major: string[] = [], minor: string[] = [];
  if (b.bmi !== null && b.bmi < R.major.bmi) major.push(`BMI ${b.bmi} < ${R.major.bmi}`);
  if (lossPct !== null && lossPct > R.major.lossPct) major.push(`Weight loss ${lossPct}% > ${R.major.lossPct}% in 3–6 months`);
  if (nil > R.major.nilDays) major.push(`Little or no intake for ${nil} days`);
  const lows = [L.kMmolL != null && L.kMmolL < R.lowK && `K ${L.kMmolL}`, L.po4MmolL != null && L.po4MmolL < R.lowPO4 && `PO₄ ${L.po4MmolL}`, L.mgMmolL != null && L.mgMmolL < R.lowMg && `Mg ${L.mgMmolL}`].filter(Boolean) as string[];
  if (lows.length) major.push(`Low before feeding: ${lows.join(', ')}`);
  if (b.bmi !== null && b.bmi < R.minor.bmi && !(b.bmi < R.major.bmi)) minor.push(`BMI ${b.bmi} < ${R.minor.bmi}`);
  if (lossPct !== null && lossPct > R.minor.lossPct && !(lossPct > R.major.lossPct)) minor.push(`Weight loss ${lossPct}% > ${R.minor.lossPct}%`);
  if (nil > R.minor.nilDays && !(nil > R.major.nilDays)) minor.push(`Little or no intake for ${nil} days`);
  if (i.alcoholMisuse) minor.push('Alcohol misuse');
  if (i.refeedingDrugs) minor.push('Insulin, chemotherapy, antacids or diuretics');

  const extreme = (b.bmi !== null && b.bmi < R.extreme.bmi) || nil > R.extreme.nilDays;
  const high = major.length >= 1 || minor.length >= 2;
  const risk: Refeeding['risk'] = extreme ? 'extreme' : high ? 'high' : 'low';
  const schedule: Refeeding['schedule'] = [];
  const alerts: string[] = [];
  if (risk !== 'low') {
    alerts.push('Check phosphate, potassium and magnesium before feeding, then daily for at least the first 3 days');
    alerts.push(R.thiamine);
    alerts.push('Correct electrolytes alongside feeding; do not delay feeding to correct them first');
    if (pos(b.kg)) {
      const start = R.startKcalPerKg[risk];
      const days = R.advanceDays[risk];
      const full = fullKcal ?? start * b.kg;
      for (let d = 1; d <= days; d++) {
        const kcal = d === days ? full : start * b.kg + ((full - start * b.kg) * (d - 1)) / (days - 1);
        schedule.push({ day: d, kcal: r0(kcal), kcalPerKg: r1(kcal / b.kg) });
      }
    }
  }
  return { risk, major, minor, schedule, alerts, method: 'NICE CG32: ≥ 1 major or ≥ 2 minor criteria = high risk; BMI < 14 or nil intake > 15 days = extreme', source: cfg.refeeding.source };
}

// ── Fluid ───────────────────────────────────────────────────────────────────
export function fluidOf(i: NutritionInputs, b: Body, cfg: NutritionConfig): (Calc & { low: number; high: number; flags: string[] }) | null {
  if (!pos(b.kg)) return null;
  const k = cfg.fluidMlPerKg.value;
  const obese = b.bmi !== null && b.bmi >= cfg.obeseBmi.value && pos(b.adjbw);
  const basis = obese ? b.adjbw! : b.kg;
  let low = k.low * basis, high = k.high * basis;
  const flags: string[] = [];
  if (pos(i.tMaxC) && i.tMaxC > 37) {
    const f = 1 + ((i.tMaxC - 37) * cfg.feverExtraPctPerDegree.value) / 100;
    low *= f; high *= f; flags.push(`Fever ${i.tMaxC} °C — about ${Math.round((f - 1) * 100)}% added; clinician to review`);
  }
  if ((i.tbsaPct ?? 0) > 0) flags.push('Burns: resuscitation and evaporative losses follow the burns protocol — this is maintenance only');
  if (i.exudate === 'high') flags.push('Heavy wound exudate — add measured losses');
  if (i.heartFailure || i.ckd || i.liverDisease) flags.push('Heart failure / CKD / liver disease — fluid restriction per physician');
  return { value: r0((low + high) / 2), low: r0(low), high: r0(high), flags, method: `${k.low}–${k.high} mL/kg/day on ${obese ? 'adjusted' : 'actual'} weight`,
    inputs: { basisKg: basis, tMaxC: i.tMaxC ?? null }, assumptions: [], source: cfg.fluidMlPerKg.source };
}

// ── Micronutrients (recommendations for the clinician, never prescriptions) ──
export function micronutrientPriorities(i: NutritionInputs): { nutrient: string; why: string }[] {
  const out: { nutrient: string; why: string }[] = [];
  const add = (nutrient: string, why: string) => { if (!out.some(o => o.nutrient === nutrient)) out.push({ nutrient, why }); };
  const wound = (i.woundAreaCm2 ?? 0) > 0 || (i.tbsaPct ?? 0) > 0;
  if (wound) { add('Zinc', 'Wound healing — replace if deficient or losses are high'); add('Vitamin C', 'Collagen synthesis'); add('Vitamin A', 'Epithelialisation; counters steroid-impaired healing'); }
  if ((i.tbsaPct ?? 0) >= 20) { add('Copper and selenium', 'Large burn exudate losses (ESPBI)'); add('Vitamin D', 'Burns cause early deficiency'); }
  if ((i.labs?.hbGL ?? 999) < 120) add('Iron, folate, B12', 'Anaemia — investigate the cause before replacing');
  if (i.alcoholMisuse) add('Thiamine and folate', 'Alcohol misuse');
  if (i.malabsorption) add('Fat-soluble vitamins (A, D, E, K)', 'Malabsorption');
  if (i.ckd) add('Potassium and phosphate', 'CKD — dietary restriction may be needed; physician to set limits');
  return out;
}

// ── Nitrogen balance ────────────────────────────────────────────────────────
export function nitrogenBalance(proteinIntakeG: number | null | undefined, uunG: number | null | undefined, i: NutritionInputs, cfg: NutritionConfig, woundLossG = 0): (Calc & { warnings: string[] }) | null {
  if (proteinIntakeG == null || uunG == null) return null;
  const k = cfg.nitrogen.value;
  const v = proteinIntakeG / k.proteinToN - (uunG + k.insensibleG + (woundLossG || 0));
  const warnings: string[] = [];
  if (((i.tbsaPct ?? 0) > 0 || i.exudate === 'high' || i.exudate === 'moderate') && !woundLossG) warnings.push('Burns/exuding wound: the +4 g factor underestimates losses — add a wound nitrogen-loss estimate');
  return { value: r1(v), method: `(protein ÷ ${k.proteinToN}) − (UUN + ${k.insensibleG}${woundLossG ? ` + ${woundLossG} wound` : ''})`, inputs: { proteinIntakeG, uunG, woundLossG },
    assumptions: [], warnings, source: cfg.nitrogen.source };
}
