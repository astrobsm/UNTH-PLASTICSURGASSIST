// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  basalMetabolicRate, totalDailyEnergy, weightGainPlan, weightReductionPlan,
  meanArterialPressure, assessSepsis, fluidDeficitMl, maintenanceFluidMlPerHour,
  sickleCrisisPlan,
} from '../services/clinicianAssistant/calculators';

/**
 * The four calculators with no existing equivalent, ported as pure functions.
 * The originals mixed this arithmetic into React components, where it could not
 * be tested; these are the numbers a clinician would act on.
 */

describe('energy requirement', () => {
  it('applies the sex-specific Harris-Benedict equation', () => {
    // Male: 66 + 13.7(70) + 5(175) - 6.8(40) = 66 + 959 + 875 - 272
    expect(basalMetabolicRate(70, 175, 40, 'male')).toBeCloseTo(1628, 0);
    // Female: 655 + 9.6(60) + 1.8(165) - 4.7(40) = 655 + 576 + 297 - 188
    expect(basalMetabolicRate(60, 165, 40, 'female')).toBeCloseTo(1340, 0);
  });

  it('returns zero rather than a nonsense figure on missing measurements', () => {
    expect(basalMetabolicRate(0, 175, 40, 'male')).toBe(0);
    expect(basalMetabolicRate(70, 0, 40, 'male')).toBe(0);
    expect(basalMetabolicRate(70, 175, 0, 'male')).toBe(0);
  });

  it('scales by activity level', () => {
    expect(totalDailyEnergy(1600, 'sedentary')).toBe(1920);
    expect(totalDailyEnergy(1600, 'moderate')).toBe(2480);
    expect(totalDailyEnergy(1600, 'very-active')).toBe(3040);
  });
});

describe('weight gain plan', () => {
  const base = { weightKg: 60, heightCm: 170, ageYears: 30, sex: 'male' as const, activity: 'moderate' as const };

  it('sets a 500 kcal surplus above maintenance', () => {
    const p = weightGainPlan(base);
    expect(p.targetCalories).toBe(p.tdee + 500);
    expect(p.calorieDelta).toBe(500);
  });

  it('targets 2.0 g/kg protein for lean mass accrual', () => {
    expect(weightGainPlan(base).proteinG).toBe(120);
  });

  it('flags a gain rate that would be mostly fat', () => {
    const fast = weightGainPlan({ ...base, targetChangeKg: 10, weeks: 8 }); // 1.25 kg/week
    expect(fast.notes.join(' ')).toMatch(/largely fat/i);

    const steady = weightGainPlan({ ...base, targetChangeKg: 4, weeks: 10 }); // 0.4 kg/week
    expect(steady.notes.join(' ')).not.toMatch(/largely fat/i);
  });

  it('macros account for the calorie target', () => {
    const p = weightGainPlan(base);
    const fromMacros = p.proteinG * 4 + p.fatG * 9 + p.carbG * 4;
    expect(Math.abs(fromMacros - p.targetCalories)).toBeLessThan(10);
  });
});

describe('weight reduction plan', () => {
  const base = { weightKg: 90, heightCm: 170, ageYears: 40, sex: 'female' as const, activity: 'sedentary' as const };

  it('applies a 500 kcal deficit where that stays above the floor', () => {
    const p = weightReductionPlan({ ...base, weightKg: 110 });
    expect(p.targetCalories).toBe(p.tdee - 500);
  });

  it('floors intake rather than driving it arbitrarily low', () => {
    // A small, sedentary woman: a full 500 kcal deficit would fall below the
    // level at which micronutrient needs can be met unsupervised.
    const p = weightReductionPlan({ weightKg: 45, heightCm: 150, ageYears: 65, sex: 'female', activity: 'sedentary' });
    expect(p.targetCalories).toBe(1200);
    expect(p.notes.join(' ')).toMatch(/floored/i);
  });

  it('uses a higher floor for men', () => {
    const p = weightReductionPlan({ weightKg: 50, heightCm: 160, ageYears: 70, sex: 'male', activity: 'sedentary' });
    expect(p.targetCalories).toBeGreaterThanOrEqual(1500);
  });

  it('targets 1.6 g/kg protein to preserve lean mass', () => {
    expect(weightReductionPlan(base).proteinG).toBe(144);
  });

  it('flags an unsustainable loss rate', () => {
    const p = weightReductionPlan({ ...base, targetChangeKg: 20, weeks: 10 }); // 2 kg/week
    expect(p.notes.join(' ')).toMatch(/rarely sustainable/i);
  });
});

describe('mean arterial pressure', () => {
  it('computes diastolic plus a third of the pulse pressure', () => {
    expect(meanArterialPressure(120, 80)).toBe(93);
    expect(meanArterialPressure(90, 60)).toBe(70);
  });

  it('returns null rather than 0 when a reading is missing', () => {
    // Zero would read as a real, catastrophic MAP.
    expect(meanArterialPressure(null, 80)).toBeNull();
    expect(meanArterialPressure(120, null)).toBeNull();
  });
});

describe('sepsis assessment', () => {
  it('scores qSOFA on its three components', () => {
    const a = assessSepsis({ respiratoryRate: 24, systolicBP: 95, gcs: 13, diastolicBP: 60 });
    expect(a.qSOFA).toBe(3);
    expect(a.qSOFAComponents).toHaveLength(3);
  });

  it('scores SIRS on temperature, rate, respiration and white count', () => {
    const a = assessSepsis({ temperature: 38.5, heartRate: 110, respiratoryRate: 24 }, { wbc: 15 });
    expect(a.sirs).toBe(4);
  });

  it('suspects sepsis at qSOFA 2 or SIRS 2', () => {
    expect(assessSepsis({ respiratoryRate: 24, systolicBP: 95 }).sepsisSuspected).toBe(true);
    expect(assessSepsis({ heartRate: 110, respiratoryRate: 24 }).sepsisSuspected).toBe(true);
    expect(assessSepsis({ heartRate: 80, respiratoryRate: 14 }).sepsisSuspected).toBe(false);
  });

  it('flags septic shock on MAP below 65 or lactate above 2', () => {
    const byMap = assessSepsis({ respiratoryRate: 24, systolicBP: 80, diastolicBP: 50 });
    expect(byMap.map).toBeLessThan(65);
    expect(byMap.septicShock).toBe(true);

    // Lactate qualifies only once sepsis is suspected: a raised lactate with a
    // normal blood pressure and no other criteria has many causes and is not
    // septic shock.
    const byLactate = assessSepsis(
      { respiratoryRate: 24, heartRate: 110, systolicBP: 130, diastolicBP: 85 },
      { lactate: 4 }
    );
    expect(byLactate.sepsisSuspected).toBe(true);
    expect(byLactate.septicShock).toBe(true);

    const lactateAlone = assessSepsis({ systolicBP: 130, diastolicBP: 85 }, { lactate: 4 });
    expect(lactateAlone.sepsisSuspected).toBe(false);
    expect(lactateAlone.septicShock).toBe(false);
  });

  it('does not score a component whose value was never recorded', () => {
    // A missing temperature must not count as normal or abnormal.
    const a = assessSepsis({ heartRate: 80, respiratoryRate: 14 });
    expect(a.sirsComponents).toHaveLength(0);
    expect(a.sirs).toBe(0);
  });

  it('returns the components behind each score', () => {
    const a = assessSepsis({ respiratoryRate: 30, systolicBP: 90, diastolicBP: 60 });
    expect(a.qSOFAComponents.join(' ')).toMatch(/Respiratory rate/);
    expect(a.qSOFAComponents.join(' ')).toMatch(/Systolic BP/);
  });
});

describe('fluid calculations', () => {
  it('estimates deficit at 3/6/9 percent of body weight', () => {
    expect(fluidDeficitMl(70, 'mild')).toBe(2100);
    expect(fluidDeficitMl(70, 'moderate')).toBe(4200);
    expect(fluidDeficitMl(70, 'severe')).toBe(6300);
  });

  it('derives maintenance from 30 mL/kg/day', () => {
    expect(maintenanceFluidMlPerHour(72)).toBe(90);
  });

  it('returns zero on a missing weight rather than guessing', () => {
    expect(fluidDeficitMl(0, 'severe')).toBe(0);
    expect(maintenanceFluidMlPerHour(0)).toBe(0);
  });
});

describe('sickle cell crisis plan', () => {
  const base = { weightKg: 60, painScore: 8 };

  it('grades pain and escalates analgesia accordingly', () => {
    expect(sickleCrisisPlan({ weightKg: 60, painScore: 2 }).painSeverity).toBe('mild');
    expect(sickleCrisisPlan({ weightKg: 60, painScore: 5 }).painSeverity).toBe('moderate');
    expect(sickleCrisisPlan(base).painSeverity).toBe('severe');
  });

  it('gives a strong opioid without delay for severe pain', () => {
    const p = sickleCrisisPlan(base);
    expect(p.analgesia.join(' ')).toMatch(/morphine/i);
    expect(p.analgesia.join(' ')).toMatch(/without delay/i);
  });

  it('states that analgesia is not withheld pending investigations', () => {
    // The commonest failing in sickle crisis care.
    expect(sickleCrisisPlan(base).analgesia.join(' ')).toMatch(/Do not withhold analgesia/i);
  });

  it('targets 1.5 times maintenance fluid', () => {
    expect(sickleCrisisPlan(base).fluidMlPerHour).toBe(Math.round(maintenanceFluidMlPerHour(60) * 1.5));
  });

  it('flags hypoxia and chest symptoms as acute chest syndrome', () => {
    const p = sickleCrisisPlan({ ...base, spo2: 91, chestSymptoms: true });
    expect(p.redFlags.join(' ')).toMatch(/acute chest syndrome/i);
    expect(p.exchangeConsidered).toBe(true);
  });

  it('flags fever, because these patients are functionally asplenic', () => {
    const p = sickleCrisisPlan({ ...base, temperatureC: 38.4 });
    expect(p.redFlags.join(' ')).toMatch(/asplenic/i);
  });

  it('considers transfusion on a fall of more than 2 g/dL from baseline', () => {
    expect(sickleCrisisPlan({ ...base, haemoglobinGdL: 5.5, baselineHbGdL: 8.5 }).transfusionConsidered).toBe(true);
    expect(sickleCrisisPlan({ ...base, haemoglobinGdL: 8.0, baselineHbGdL: 8.5 }).transfusionConsidered).toBe(false);
  });

  it('considers exchange rather than simple transfusion after stroke', () => {
    expect(sickleCrisisPlan({ ...base, priorStroke: true }).exchangeConsidered).toBe(true);
  });
});
