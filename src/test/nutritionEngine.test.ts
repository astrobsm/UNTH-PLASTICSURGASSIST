/**
 * Nutrition engine — worked examples. Expected values are calculated by hand
 * from the formulas in config/nutrition.v1.ts so a change of coefficient shows
 * up here as a deliberate test change.
 */
import { describe, expect, it } from 'vitest';
import {
  assessNutrition, diffAssessments, heightOf, intakeTotals, monitoringAlerts, nitrogenBalance, NUTRITION_CONFIG as cfg, weightChanges, weightOf,
} from '../clinical/nutrition';

const opt = (a: ReturnType<typeof assessNutrition>, id: string) => a.energy.options.find(o => o.id === id);

describe('nutrition engine — worked examples', () => {
  it('obese ventilated ICU patient: ASPEN hypocaloric, high protein on IBW, mNUTRIC', () => {
    const a = assessNutrition({
      ageYears: 55, sex: 'male', heightCm: 180, weightKg: 130, weightMethod: 'bed_scale',
      icu: true, ventilated: true, minuteVentilationL: 10, tMaxC: 38, sepsis: true,
      apache2: 22, sofa: 8, comorbidityCount: 2, daysHospitalToIcu: 0,
    });
    expect(a.bmi?.value).toBe(40.1);
    expect(a.ibw?.value).toBe(75);
    expect(a.adjbw?.value).toBe(97);
    expect(opt(a, 'mifflin')?.value).toBe(2155);
    expect(opt(a, 'penn_state')?.value).toBe(2513); // 0.96×2155 + 31×10 + 167×38 − 6212
    expect(a.energy.selected?.id).toBe('icu_obese');
    expect(a.targets.kcal).toBe(1625); // 12.5 kcal/kg × 130 kg
    expect(a.protein?.value).toBe(188); // 2.5 g/kg × 75 kg IBW
    expect(a.protein?.basis).toBe('ideal body weight');
    expect(a.screening.nutric?.value).toBe(5);
    expect(a.screening.nutric?.high).toBe(true);
    expect(a.level).toBe('high');
    expect(a.fluid?.flags.some(f => /Fever/.test(f))).toBe(true);
    expect(a.configVersion).toBe(cfg.version);
  });

  it('cachectic patient at high refeeding risk: stepped schedule, electrolyte alerts', () => {
    const a = assessNutrition({
      ageYears: 40, sex: 'female', heightCm: 160, weightKg: 38, weightLossPct3to6m: 18, daysLittleOrNoIntake: 12,
      mobility: 'bedbound', goal: 'gain', labs: { kMmolL: 3.2, po4MmolL: 0.6, mgMmolL: 0.8 },
    });
    expect(a.bmi?.value).toBe(14.8);
    expect(a.screening.must?.value).toBe(4);
    expect(a.screening.glim.value).toBe('severe');
    expect(a.refeeding.risk).toBe('high');
    expect(a.refeeding.major.length).toBeGreaterThanOrEqual(3);
    expect(opt(a, 'mifflin_total')?.value).toBe(1121); // 1019 × 1.1
    expect(a.goal?.targetKcal).toBe(1421); // + 300 kcal surplus (floor of the gain range)
    expect(a.refeeding.schedule.map(d => d.kcal)).toEqual([380, 640, 901, 1161, 1421]);
    expect(a.refeeding.alerts.some(t => /phosphate, potassium and magnesium/.test(t))).toBe(true);
    expect(a.refeeding.alerts.some(t => /thiamine/i.test(t))).toBe(true);
    expect(a.level).toBe('refeeding');
    expect(a.protein?.value).toBe(46);
  });

  it('extreme refeeding risk starts at 5 kcal/kg over 7 days', () => {
    const a = assessNutrition({ ageYears: 30, sex: 'male', heightCm: 170, weightKg: 39, daysLittleOrNoIntake: 20 });
    expect(a.refeeding.risk).toBe('extreme');
    expect(a.refeeding.schedule).toHaveLength(7);
    expect(a.refeeding.schedule[0].kcalPerKg).toBe(5);
  });

  it('30% TBSA burn: Toronto preferred, Curreri flagged, burns protein, no weight loss', () => {
    const a = assessNutrition({
      ageYears: 30, sex: 'male', heightCm: 175, weightKg: 70, tbsaPct: 30, daysSinceInjury: 5, tMaxC: 38.5,
      previousDayKcal: 1500, mobility: 'bedbound', stress: 'burns', goal: 'lose',
    });
    expect(opt(a, 'toronto')?.value).toBe(2113);
    expect(opt(a, 'curreri')?.value).toBe(2950);
    expect(opt(a, 'curreri')?.warnings[0]).toMatch(/overestimates/);
    expect(a.energy.selected?.id).toBe('toronto');
    expect(a.protein?.value).toBe(126); // 1.8 × 70
    expect(a.goal?.goal).toBe('maintain');
    expect(a.goal?.blocked[0]).toMatch(/catabolic/);
    expect(a.micronutrients.map(m => m.nutrient)).toEqual(expect.arrayContaining(['Zinc', 'Vitamin C', 'Copper and selenium']));
    const nb = nitrogenBalance(126, 18, a.inputs, cfg);
    expect(nb?.value).toBe(-1.8);
    expect(nb?.warnings[0]).toMatch(/underestimates/);
  });

  it('diabetic outpatient on a weight-loss plan: deficit, floor, protein on adjusted weight, carb cap', () => {
    const a = assessNutrition({ ageYears: 50, sex: 'female', heightCm: 165, weightKg: 98, diabetes: true, mobility: 'ambulatory', goal: 'lose', targetRateKgWk: 0.5 });
    expect(a.bmi?.value).toBe(36);
    expect(opt(a, 'mifflin_total')?.value).toBe(2080);
    expect(a.targets.kcal).toBe(1530); // 550 kcal deficit
    expect(a.goal?.rateKgWk).toBe(0.5);
    expect(a.adjbw?.value).toBe(73.3);
    expect(a.protein?.value).toBe(88); // 1.2 × 73.3
    expect(a.targets.carbG).toBe(172); // 45% of 1530 ÷ 4
    expect(a.targets.restrictions[0]).toMatch(/Carbohydrate control/);

    const small = assessNutrition({ ageYears: 60, sex: 'female', heightCm: 150, weightKg: 85, mobility: 'bedbound', goal: 'lose', targetRateKgWk: 1.0 });
    expect(small.targets.kcal).toBe(1200);
    expect(small.goal?.notes.some(n => /safety floor/.test(n))).toBe(true);
    const over = assessNutrition({ ageYears: 60, sex: 'female', heightCm: 150, weightKg: 85, mobility: 'bedbound', goal: 'lose', targetRateKgWk: 1.0, override: { belowFloor: 'Supervised VLCD' } });
    expect(over.targets.kcal).toBeLessThan(1200);
  });

  it('patient with no measurable weight or height: knee height + MUAC estimates, flagged', () => {
    const a = assessNutrition({ ageYears: 70, sex: 'male', kneeHeightCm: 52, muacCm: 22, weightMethod: 'unavailable' });
    expect(a.height?.value).toBe(166.1);
    expect(a.weight?.value).toBe(46.6);
    expect(a.weight?.estimated).toBe(true);
    expect(a.weight?.assumptions[0]).toMatch(/not for drug dosing/);
    expect(a.bmi?.value).toBe(16.9);
    expect(a.screening.must?.parts.bmi).toBe(2);

    const band = assessNutrition({ ageYears: 45, sex: 'male', muacCm: 22 });
    expect(band.bmi).toBeNull();
    expect(band.muacBand?.value).toBe('lt20');
    expect(band.screening.must?.value).toBe(1);
    expect(band.warnings.some(w => /No weight/.test(w))).toBe(true);
  });
});

describe('nutrition engine — components', () => {
  it('ulna height, dressing and amputation adjustments', () => {
    expect(heightOf({ sex: 'female', ageYears: 40, ulnaCm: 25 }, cfg)?.value).toBe(164.9);
    const w = weightOf({ weightKg: 66, dressingKg: 1, amputations: ['below_knee'] }, cfg)!;
    expect(w.value).toBe(65);
    expect(w.wholeBodyKg).toBe(69.1); // 65 ÷ (1 − 0.059)
  });

  it('out-of-scope patients get no targets and the specialist notice', () => {
    for (const x of [{ ageYears: 16 }, { pregnant: true }, { dialysis: true }, { parenteral: true }]) {
      const a = assessNutrition({ sex: 'female', ageYears: 30, heightCm: 160, weightKg: 60, ...x });
      expect(a.scope.inScope).toBe(false);
      expect(a.scope.notice).toBe('Specialist dietitian/physician input required');
      expect(a.targets.kcal).toBeNull();
      expect(a.targets.proteinG).toBeNull();
    }
  });

  it('empty input never throws and asks for measurements', () => {
    const a = assessNutrition({});
    expect(a.targets.kcal).toBeNull();
    expect(a.level).toBe('medium');
    expect(a.warnings.length).toBeGreaterThan(1);
  });

  it('CKD non-dialysis reduces protein and flags it; catabolic CKD does not', () => {
    const a = assessNutrition({ ageYears: 60, sex: 'male', heightCm: 170, weightKg: 70, ckd: true });
    expect(a.protein?.value).toBe(56);
    expect(a.protein?.warnings[0]).toMatch(/nephrology to confirm/);
    const b = assessNutrition({ ageYears: 60, sex: 'male', heightCm: 170, weightKg: 70, ckd: true, sepsis: true });
    expect(b.protein!.value).toBe(91); // catabolic CKD on the ward: 1.3 g/kg
  });

  it('wound healing: EPUAP protein and energy; CKD compromise; ICU CKD not restricted; albumin never sets protein', () => {
    const small = assessNutrition({ weightKg: 60, woundAreaCm2: 10 });
    expect(small.protein?.value).toBe(90); // 1.5 g/kg
    expect(small.energy.selected?.id).toBe('kcal_kg');
    expect(small.targets.kcal).toBe(1800); // 30 kcal/kg
    const large = assessNutrition({ weightKg: 60, woundAreaCm2: 40, exudate: 'high' });
    expect(large.protein?.value).toBe(108); // 1.8 g/kg (large wound band)
    expect(large.targets.kcal).toBe(2100); // 35 kcal/kg
    expect(assessNutrition({ weightKg: 60, woundAreaCm2: 10, ckd: true }).protein?.value).toBe(60); // 1.0
    expect(assessNutrition({ weightKg: 60, woundAreaCm2: 40, ckd: true }).protein?.value).toBe(78); // 1.3 catabolic
    const icu = assessNutrition({ weightKg: 60, ckd: true, icu: true });
    expect(icu.protein?.perKg).toBe(1.3);
    expect(icu.protein?.warnings.join(' ')).toMatch(/not restricted/);
    const alb = assessNutrition({ weightKg: 60, woundAreaCm2: 10, labs: { albuminGL: 24, crpMgL: 80 } });
    expect(alb.protein?.value).toBe(90);
    expect(alb.warnings.some(w => /does not change the protein target/.test(w) && /CRP is raised/.test(w))).toBe(true);
    // A healing wound with full data still uses the guideline band, not Mifflin.
    expect(assessNutrition({ ageYears: 40, sex: 'female', heightCm: 160, weightKg: 60, woundAreaCm2: 10 }).energy.selected?.id).toBe('kcal_kg');
  });

  it('weight change windows', () => {
    const ch = weightChanges([{ date: '2026-06-01', kg: 70 }, { date: '2026-10-01', kg: 63 }, { date: '2026-10-25', kg: 62 }, { date: '2026-11-01', kg: 61 }], new Date('2026-11-02'));
    expect(ch.week1).toBe(-1.6);
    expect(ch.months3to6).toBe(-12.9);
  });

  it('intake conversion', () => {
    const t = intakeTotals({
      items: [{ planned: { kcal: 400, proteinG: 20 }, eaten: 0.5 }, { planned: { kcal: 200, proteinG: 10 }, eaten: 1 }],
      supplements: [{ kcal: 300, proteinG: 12, servings: 2 }],
      enteral: { ml: 500, kcalPerMl: 1, proteinGPerL: 40 },
    });
    expect(t).toEqual({ kcal: 1500, proteinG: 64 }); // 10 + 10 + 24 + 20
  });

  it('monitoring alerts fire on their thresholds', () => {
    const d = (n: number) => `2026-11-${String(n).padStart(2, '0')}`;
    const alerts = monitoringAlerts({
      intakePct: [{ date: d(1), value: 80 }, { date: d(2), value: 50 }, { date: d(3), value: 55 }, { date: d(4), value: 40 }],
      muac: [{ date: d(1), value: 24 }, { date: d(10), value: 22.6 }],
      prealbumin: [{ date: d(1), value: 0.2 }, { date: d(8), value: 0.15 }],
      crp: [{ date: d(1), value: 60 }, { date: d(8), value: 40 }],
      nBalance: [{ date: d(2), value: -3 }, { date: d(5), value: -1 }],
      refeedingRisk: 'high', latestLabs: { po4MmolL: 0.5 },
      weight: [{ date: d(1), value: 100 }, { date: d(22), value: 94 }], plannedRateKgWk: -0.5,
    }, cfg);
    expect(alerts.map(a => a.id).sort()).toEqual(['low_intake', 'muac_drop', 'negative_n', 'prealbumin_fall', 'rate_too_fast', 'refeeding_labs']);
    expect(alerts.find(a => a.id === 'refeeding_labs')?.severity).toBe('urgent');
    expect(monitoringAlerts({ intakePct: [{ date: d(1), value: 50 }, { date: d(2), value: 70 }] }, cfg)).toEqual([]);
  });

  it('recalculation reports what changed and why', () => {
    const base = { ageYears: 50, sex: 'male' as const, heightCm: 175, weightKg: 80, mobility: 'chair' as const };
    const changes = diffAssessments(assessNutrition(base), assessNutrition({ ...base, weightKg: 72 }));
    const kcal = changes.find(c => c.what.startsWith('Energy target'));
    expect(kcal?.why).toContain('weightKg changed');
    expect(changes.some(c => c.what === 'BMI')).toBe(true);
  });

  it('every coefficient carries a source and the set is pending validation', () => {
    expect(cfg.status).toBe('pending_clinical_validation');
    const walk = (o: any, path: string): void => {
      if (o && typeof o === 'object') {
        if ('value' in o && !('source' in o)) throw new Error(`${path} has no source`);
        for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
      }
    };
    walk(cfg, 'cfg');
  });
});
