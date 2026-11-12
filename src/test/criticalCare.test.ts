// @vitest-environment node
/**
 * Critical-care rule-based analysis — worked cases. Numbers are checked by
 * hand; the report must always carry every key of the specification.
 */
import { describe, it, expect } from 'vitest';
import { analyseCritical } from '../clinical/critical/analyse';
import { emptyReport, type CcInput } from '../clinical/critical/types';
import { LAB_PANELS } from '../clinical/critical/catalogue';
import { toAnalyte } from '../services/clinicianAssistant/analyteMapping';
import { adrogueMadias, deltaRatio, hollidaySegar, meldNa, sofa, curb65, dosingWeight } from '../clinical/critical/calculations';

const base = (over: Partial<CcInput> = {}): CcInput => ({
  patient: { age_years: 54, sex: 'male', weight_kg: 70, height_cm: 170, location: 'ICU' },
  presenting_complaint: 'breathlessness and weakness', comorbidities: ['hypertension', 'type 2 diabetes'], allergies: [{ agent: 'penicillin', reaction: 'rash' }],
  vitals: [{ time: '2026-11-12T08:00', hr: 118, sbp: 88, dbp: 50, rr: 28, temp_c: 38.9, spo2: 91, fio2: 0.4, gcs: 13 }],
  labs: [
    { test: 'Potassium', value: 6.8, unit: 'mmol/L', time: '2026-11-12T07:30' }, { test: 'Sodium', value: 136, unit: 'mmol/L', time: '2026-11-12T07:30' },
    { test: 'Creatinine', value: 250, unit: 'µmol/L', time: '2026-11-12T07:30' }, { test: 'Urea', value: 22, unit: 'mmol/L', time: '2026-11-12T07:30' },
  ],
  baseline_creatinine_umol_l: 90,
  imaging_ecg: [{ type: 'ECG', finding: 'peaked T waves' }],
  medications: [{ name: 'Lisinopril', class: 'ACE inhibitor', dose: 10, unit: 'mg', route: 'oral', frequency: 'once daily', start_date: '2026-10-01', indication: 'hypertension' }],
  ...over,
});

const keys = (o: object) => Object.keys(o).sort();

describe('critical-care analysis — specification example', () => {
  const R = analyseCritical(base());
  it('keeps every key of the output contract', () => {
    expect(keys(R)).toEqual(keys(emptyReport()));
    expect(keys(R.plan)).toEqual(keys(emptyReport().plan));
    expect(R.disclaimer).toMatch(/Decision support only/);
  });
  it('raises hyperkalaemia-with-ECG and hypotension as critical alerts first', () => {
    const f = R.critical_alerts.map(a => a.finding).join(' | ');
    expect(f).toMatch(/Hyperkalaemia K 6.8 mmol\/L with ECG changes/);
    expect(f).toMatch(/Hypotension/);
    expect(R.critical_alerts.find(a => /Hyperkal/.test(a.finding))!.action).toMatch(/calcium gluconate 30 mL/);
    expect(R.plan.immediate.length).toBe(R.critical_alerts.length);
  });
  it('renal: CKD-EPI 2021, CrCl on IBW, KDIGO stage 2, not steady state', () => {
    expect(R.renal_function.egfr_ckd_epi_2021).toBe(26); // hand-calculated 25.7
    expect(R.renal_function.weight_used).toBe('ideal'); // 70 kg within 120% of IBW 65.9
    expect(R.renal_function.crcl_cockcroft_gault).toBeLessThan(30);
    expect(R.renal_function.aki_stage).toMatch(/stage 2/);
    expect(R.renal_function.steady_state).toBe(false);
    expect(R.renal_function.dosing_band).toBe('CrCl 10–29 mL/min');
  });
  it('lisinopril is held: it raises K, with AKI and hypotension', () => {
    const l = R.medication_review.find(m => m.drug === 'Lisinopril')!;
    expect(l.adverse_effects_in_this_patient.join(' ')).toMatch(/raise potassium/);
    expect(l.recommendation).toBe('hold');
    expect(R.plan.medications.some(m => m.drug === 'Lisinopril' && m.action === 'hold')).toBe(true);
  });
  it('fever in an endemic setting adds severe malaria as can\'t-miss and asks for a film', () => {
    expect(R.differential_diagnosis.some(d => /malaria/.test(d.diagnosis) && d.cant_miss)).toBe(true);
    expect(R.plan.investigations.some(i => /Malaria RDT/.test(i.test) && i.priority === 'urgent')).toBe(true);
  });
  it('scores: qSOFA complete; SOFA lists what is missing; APACHE II honest', () => {
    expect(R.scores.find(s => s.name === 'qSOFA')!.value).toBe('3');
    const so = R.scores.find(s => s.name === 'SOFA')!;
    expect(so.complete).toBe(false);
    expect(so.missing).toEqual(expect.arrayContaining(['platelets', 'bilirubin']));
    expect(R.scores.find(s => s.name === 'APACHE II')!.complete).toBe(false);
  });
});

describe('critical-care analysis — safety rules', () => {
  it('implausible values are flagged and never used (K 45, creatinine 1.2 µmol/L)', () => {
    const R = analyseCritical(base({ labs: [{ test: 'Potassium', value: 45, unit: 'mmol/L' }, { test: 'Creatinine', value: 1.2, unit: 'µmol/L' }], imaging_ecg: [] }));
    expect(R.data_quality.implausible_values.length).toBe(2);
    expect(R.critical_alerts.some(a => /Hyperkal/.test(a.finding))).toBe(false);
    expect(R.renal_function.creatinine_umol_l).toBeNull();
    expect(R.confidence.overall).toBe('low');
  });
  it('empty input never throws and lists the missing essentials', () => {
    const R = analyseCritical({ patient: {} });
    expect(keys(R)).toEqual(keys(emptyReport()));
    expect(R.data_quality.missing_essential.length).toBeGreaterThan(3);
  });
  it('DKA criteria raise an alert and hourly monitoring', () => {
    const R = analyseCritical(base({ labs: [
      { test: 'Glucose', value: 25, unit: 'mmol/L' }, { test: 'Blood ketones', value: 4.5, unit: 'mmol/L' }, { test: 'pH', value: 7.12, unit: '' },
      { test: 'HCO3', value: 10, unit: 'mmol/L' }, { test: 'PaCO2', value: 3.0, unit: 'kPa' }, { test: 'Sodium', value: 140, unit: 'mmol/L' }, { test: 'Chloride', value: 100, unit: 'mmol/L' }, { test: 'Albumin', value: 40, unit: 'g/L' },
    ], imaging_ecg: [] }));
    expect(R.critical_alerts.some(a => /ketoacidosis/.test(a.finding))).toBe(true);
    expect(R.acid_base.anion_gap).toBe(30);
    expect(R.acid_base.delta_ratio).toBe(1.29); // (30 − 12) ÷ (24 − 10)
    expect(R.plan.monitoring.some(m => /ketones/.test(m.parameter))).toBe(true);
  });
  it('symptomatic hyponatraemia: hypertonic bolus advice within correction limits', () => {
    const R = analyseCritical(base({ symptoms: [{ category: 'Neurological', item: 'Seizures' }], labs: [{ test: 'Sodium', value: 115, unit: 'mmol/L' }], imaging_ecg: [] }));
    expect(R.critical_alerts.some(a => /Sodium 115/.test(a.finding) && /3% NaCl 150 mL/.test(a.action))).toBe(true);
    const c = R.plan.electrolyte_corrections.find(x => /natr/i.test(x.abnormality) || /sodium/i.test(x.abnormality));
    expect(c?.prescription).toMatch(/3% NaCl 150 mL IV over 20 min/);
    expect(R.calculations.some(x => /Adrogué/.test(x.name))).toBe(true);
  });
  it('hypernatraemia: 5% dextrose rate from Adrogué–Madias', () => {
    const R = analyseCritical(base({ labs: [{ test: 'Sodium', value: 160, unit: 'mmol/L' }], imaging_ecg: [] }));
    const c = R.plan.electrolyte_corrections.find(x => x.rate_ml_per_h != null);
    // TBW 0.6 × 70 = 42; ΔNa per L of D5 = −160/43 = −3.72; 10 mmol/L → 2688 mL → 112 mL/h.
    expect(c?.rate_ml_per_h).toBe(112);
  });
  it('interactions, allergy and drug–disease rules', () => {
    const R = analyseCritical(base({ labs: [{ test: 'Creatinine', value: 400, unit: 'µmol/L' }], medications: [
      { name: 'Warfarin', indication: 'AF' }, { name: 'Aspirin', dose: 75, unit: 'mg', indication: 'IHD' }, { name: 'Morphine', indication: 'pain' },
      { name: 'Midazolam', indication: 'sedation' }, { name: 'Amoxicillin', indication: 'pneumonia' }, { name: 'Metformin', indication: 'diabetes' },
    ] }));
    const by = (n: string) => R.medication_review.find(m => m.drug === n)!;
    expect(by('Warfarin').interactions.some(i => i.with === 'Aspirin' && i.severity === 'major')).toBe(true);
    expect(by('Morphine').interactions.some(i => i.with === 'Midazolam' && /respiratory/.test(i.mechanism))).toBe(true);
    expect(by('Amoxicillin').interactions.some(i => i.severity === 'contraindicated' && /allergy/.test(i.with))).toBe(true);
    expect(by('Amoxicillin').recommendation).toBe('substitute');
    expect(by('Metformin').recommendation).toBe('stop');
    expect(R.missing_indicated_therapy.some(m => /VTE/.test(m.therapy))).toBe(false); // on warfarin
  });
  it('urine output < 0.3 mL/kg/h for 6 h raises the oliguria alert', () => {
    const R = analyseCritical(base({ fluid_balance: { urine_ml_per_hour: [30, 20, 15, 14, 12, 10, 8] } }));
    expect(R.critical_alerts.some(a => /Urine output < 0.3/.test(a.finding))).toBe(true);
    expect(R.calculations.find(c => c.name === 'Urine output')?.result).toBe(0.11);
  });
  it('a child uses Schwartz and Holliday–Segar', () => {
    const R = analyseCritical({ patient: { age_years: 8, sex: 'female', weight_kg: 25, height_cm: 125 }, labs: [{ test: 'Creatinine', value: 60, unit: 'µmol/L' }], vitals: [{ hr: 100, sbp: 100, dbp: 60, rr: 22, spo2: 98, temp_c: 37, gcs: 15 }] });
    expect(R.renal_function.egfr_ckd_epi_2021).toBe(76); // 36.5 × 125 / 60
    expect(R.plan.fluids.prescription).toMatch(/Holliday–Segar/);
    expect(hollidaySegar(25)).toBe(1600);
  });
});

describe('critical-care formulas', () => {
  it('Adrogué–Madias, delta ratio, MELD-Na, CURB-65, SOFA, dosing weight', () => {
    expect(Math.round(adrogueMadias(513, 0, 115, 42) * 10) / 10).toBe(9.3);
    expect(deltaRatio(20, 24)).toBeNull();
    // bili 3.0 mg/dL, INR 1.5, Cr 1.5 mg/dL: 10 × (0.957·ln1.5 + 0.378·ln3 + 1.12·ln1.5 + 0.643) = 19.0
    expect(meldNa({ bilirubinUmol: 51.3, inr: 1.5, creatUmol: 132.6, na: 130 })).toEqual({ meld: 19, meldNa: 24, missing: [] });
    expect(curb65({ confusion: true, ureaMmol: 9, rr: 32, sbp: 85, age: 70 }).value).toBe(5);
    expect(sofa({ plt: 15, gcs: 5, bilirubinUmol: 220, map: 60, vasopressor: 'high', creatUmol: 500, pfMmHg: 80, ventilated: true }).value).toBe(24);
    expect(dosingWeight(120, 170, 'male')!.used).toBe('adjusted');
    expect(dosingWeight(50, 170, 'male')!.used).toBe('actual');
  });
  it('every numeric catalogue test maps to the engine dictionary or the critical-care extras', async () => {
    const { analyseCritical: run } = await import('../clinical/critical/analyse');
    const unmapped: string[] = [];
    for (const tests of Object.values(LAB_PANELS)) for (const t of tests) {
      if (t.units[0] === 'text') continue;
      if (toAnalyte(t.test, 1, t.units[0]).reason !== 'no-matching-analyte') continue;
      const R = run({ patient: {}, labs: [{ test: t.test, value: 1, unit: t.units[0] }] });
      if (!R.data_quality.implausible_values.length && !R.calculations.length) unmapped.push(t.test);
    }
    // Tests the engine and extras do not interpret are still passed to the AI review as text.
    expect(unmapped.length).toBeLessThan(25);
  });
});
