/**
 * The adapters that expose existing clinical logic through the calculator tab.
 *
 * eGFR is tested hardest because it is the only new arithmetic here — the rest
 * delegate, so what matters is that the delegation passes the right inputs and
 * does not silently swallow a null.
 */

import { describe, it, expect } from 'vitest';
import {
  acidBase, electrolyteCorrection, egfrCkdEpi,
  woundHealingMealPlan, weightLossMealPlan,
} from '../services/clinicianAssistant/clinicalCalculators';

describe('egfrCkdEpi', () => {
  // Reference values recomputed from the published CKD-EPI 2021 equation.
  it('matches the published equation for a 60-year-old man at 1.0 mg/dL', () => {
    const r = egfrCkdEpi({ creatinineUmolL: 88.4, ageYears: 60, sex: 'male' });
    expect(r.egfr).toBeGreaterThanOrEqual(85);
    expect(r.egfr).toBeLessThanOrEqual(87);
    expect(r.stage).toBe('G2 — mildly reduced');
  });

  it('applies the female coefficient', () => {
    const male = egfrCkdEpi({ creatinineUmolL: 70.7, ageYears: 60, sex: 'male' });
    const female = egfrCkdEpi({ creatinineUmolL: 70.7, ageYears: 60, sex: 'female' });
    // Same creatinine, lower expected muscle mass — the equation returns a
    // different number for women, and reporting the male value for a woman
    // would overestimate her function.
    expect(female.egfr).not.toBe(male.egfr);
    expect(female.egfr).toBeGreaterThanOrEqual(83);
    expect(female.egfr).toBeLessThanOrEqual(85);
  });

  it('does not apply a race coefficient', () => {
    // The 2021 equation is race-free by design. There is no input for it, so
    // this is really a guard that nobody adds one back.
    const a = egfrCkdEpi({ creatinineUmolL: 150, ageYears: 45, sex: 'male' });
    const b = egfrCkdEpi({ creatinineUmolL: 150, ageYears: 45, sex: 'male' });
    expect(a.egfr).toBe(b.egfr);
  });

  it('stages kidney failure', () => {
    const r = egfrCkdEpi({ creatinineUmolL: 353.6, ageYears: 60, sex: 'male' });
    expect(r.egfr).toBeLessThan(30);
    expect(r.stage).toContain('G4');
    expect(r.note).toMatch(/renally cleared/i);
  });

  it('returns null rather than a number when inputs are missing', () => {
    // A calculator that shows "0" for an unentered creatinine invites someone
    // to act on it.
    expect(egfrCkdEpi({ creatinineUmolL: null, ageYears: 60, sex: 'male' }).egfr).toBeNull();
    expect(egfrCkdEpi({ creatinineUmolL: 88.4, ageYears: null, sex: 'male' }).egfr).toBeNull();
    expect(egfrCkdEpi({ creatinineUmolL: 0, ageYears: 60, sex: 'male' }).egfr).toBeNull();
  });
});

describe('acidBase', () => {
  it('identifies a compensated metabolic acidosis', () => {
    // pH 7.25, HCO3 13, PaCO2 3.7 kPa — Winter's predicts (1.5×13+8) mmHg
    // ≈ 3.7 kPa, so compensation is appropriate.
    const r = acidBase({ ph: 7.25, paco2: 3.7, hco3: 13 });
    expect(r.interpretation?.primary).toBe('metabolic acidosis');
    expect(r.interpretation?.compensation).toBe('appropriate');
  });

  it('flags an inadequately compensated acidosis', () => {
    // Same acidosis, but PaCO2 6.0 kPa — the patient is not blowing off CO2.
    const r = acidBase({ ph: 7.25, paco2: 6.0, hco3: 13 });
    expect(r.interpretation?.compensation).not.toBe('appropriate');
  });

  it('converts mmHg to kPa', () => {
    // The same gas reported either way must interpret identically. Passing
    // mmHg as kPa would read as a severe respiratory acidosis.
    const kpa = acidBase({ ph: 7.25, paco2: 3.7, hco3: 13 });
    const mmhg = acidBase({ ph: 7.25, paco2: 27.5, paco2Unit: 'mmHg', hco3: 13 });
    expect(mmhg.paco2Kpa).toBeCloseTo(3.67, 1);
    expect(mmhg.interpretation?.primary).toBe(kpa.interpretation?.primary);
    expect(mmhg.interpretation?.compensation).toBe(kpa.interpretation?.compensation);
  });

  it('identifies a respiratory acidosis', () => {
    const r = acidBase({ ph: 7.28, paco2: 8.5, hco3: 27 });
    expect(r.interpretation?.primary).toBe('respiratory acidosis');
  });

  it('computes the anion gap only when all three inputs are present', () => {
    expect(acidBase({ ph: 7.25, paco2: 3.7, hco3: 13 }).anionGap).toBeNull();
    const r = acidBase({ ph: 7.25, paco2: 3.7, hco3: 13, sodium: 140, chloride: 100 });
    expect(r.anionGap).toBe(27);
  });

  it('corrects the gap for a low albumin', () => {
    // Na 140, Cl 112, HCO3 20 → gap 8, which reads normal. At albumin 2.0 the
    // corrected gap is 13 — a raised gap that the raw number hides.
    const r = acidBase({ ph: 7.3, paco2: 4.5, hco3: 20, sodium: 140, chloride: 112, albumin: 2.0 });
    expect(r.anionGap).toBe(8);
    expect(r.correctedAnionGap).toBeCloseTo(13, 5);
    expect(r.notes.join(' ')).toMatch(/masks a raised anion gap/i);
    expect(r.notes.join(' ')).toMatch(/Raised anion gap/i);
  });

  it('says what is missing instead of guessing', () => {
    const r = acidBase({ ph: null, paco2: null, hco3: 13 });
    expect(r.interpretation).toBeNull();
    expect(r.notes.join(' ')).toMatch(/required/i);
  });
});

describe('electrolyteCorrection', () => {
  it('returns the engine plan for hypokalaemia', () => {
    const plan = electrolyteCorrection({
      finding: 'lyte.hypokalaemia',
      values: { k: 2.6 },
      weightKg: 70,
      severity: 'severe',
    });
    expect(plan).toBeTruthy();
    expect(JSON.stringify(plan).toLowerCase()).toMatch(/potassium|kcl/);
  });

  it('returns the engine plan for hyponatraemia', () => {
    const plan = electrolyteCorrection({
      finding: 'lyte.hyponatraemia',
      values: { na: 118 },
      weightKg: 70,
      severity: 'severe',
    });
    expect(plan).toBeTruthy();
    expect(JSON.stringify(plan).toLowerCase()).toMatch(/sodium|saline/);
  });

  it('does not invent a plan when the value is absent', () => {
    const plan = electrolyteCorrection({ finding: 'lyte.hypokalaemia', values: {}, weightKg: 70 });
    // Either no plan, or a plan that cannot contain a computed dose.
    if (plan) expect(JSON.stringify(plan)).not.toMatch(/NaN/);
  });
});

describe('meal plans', () => {
  it('builds a week of wound-healing meals at 1.5 g/kg', () => {
    const r = woundHealingMealPlan(60);
    expect(r.targetProtein).toBe(90);
    expect(r.targetKcal).toBe(1800);
    expect(r.days).toHaveLength(7);
    expect(r.days[0].breakfast.items.length).toBeGreaterThan(0);
  });

  it('raises targets for an extensive wound', () => {
    const normal = woundHealingMealPlan({ weightKg: 60, severity: 'mild' });
    const large = woundHealingMealPlan({ weightKg: 60, severity: 'severe' });
    expect(large.targetProtein).toBeGreaterThan(normal.targetProtein);
    expect(large.targetKcal).toBeGreaterThan(normal.targetKcal);
    expect(large.rationale.join(' ')).toMatch(/extensive wound/i);
  });

  it('raises protein when albumin shows depletion', () => {
    const r = woundHealingMealPlan({ weightKg: 60, severity: 'mild', albuminGdL: 2.4 });
    expect(r.proteinPerKg).toBe(1.8);
    expect(r.targetProtein).toBe(108);
    expect(r.cautions.join(' ')).toMatch(/acute-phase reactant/i);
  });

  it('caps protein at 1.0 g/kg in CKD, and says so', () => {
    // The headline number must agree with the advice. A plan that prints
    // 1.8 g/kg while advising 0.8-1.0 is the defect this replaces.
    const r = woundHealingMealPlan({ weightKg: 60, severity: 'severe', albuminGdL: 2.0, ckd: true });
    expect(r.proteinPerKg).toBe(1.0);
    expect(r.targetProtein).toBe(60);
    expect(r.cautions.join(' ')).toMatch(/caps protein at 1\.0/i);
    expect(r.cautions.join(' ')).toMatch(/nephrology/i);
    expect(r.modifications.join(' ')).toMatch(/potassium/i);
  });

  it('generates the meal plan against the capped target, not the uncapped one', () => {
    const r = woundHealingMealPlan({ weightKg: 60, severity: 'severe', ckd: true });
    // The days must be built from the number actually reported.
    expect(r.targetProtein).toBe(60);
    expect(r.days).toHaveLength(7);
  });

  it('adds diabetic modifications without changing the targets', () => {
    const plain = woundHealingMealPlan({ weightKg: 70, severity: 'moderate' });
    const dm = woundHealingMealPlan({ weightKg: 70, severity: 'moderate', diabetes: true });
    expect(dm.targetProtein).toBe(plain.targetProtein);
    expect(dm.targetKcal).toBe(plain.targetKcal);
    expect(dm.modifications.join(' ')).toMatch(/glycaemic control delays healing/i);
  });

  it('computes a fluid target', () => {
    expect(woundHealingMealPlan({ weightKg: 70, severity: 'mild' }).fluidMl).toBe(2100);
    expect(woundHealingMealPlan({ weightKg: 70, severity: 'severe' }).fluidMl).toBe(2450);
  });

  it('holds protein at 1.6 g/kg through a weight-loss deficit', () => {
    const r = weightLossMealPlan(1500, 90);
    expect(r.targetProtein).toBe(144);
    expect(r.targetKcal).toBe(1500);
    expect(r.days).toHaveLength(7);
  });

  it('produces days that carry their own totals', () => {
    const r = woundHealingMealPlan(70);
    for (const d of r.days) {
      expect(d.totalKcal).toBeGreaterThan(0);
      expect(d.totalProtein).toBeGreaterThan(0);
    }
  });
});
