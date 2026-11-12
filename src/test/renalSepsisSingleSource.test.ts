/**
 * One eGFR, one creatinine clearance, one qSOFA and one MAP. Labs, the
 * Clinician Assistant, diabetic foot, burns, soft-tissue infection and
 * prescribing all delegate to the engine / shared calculators.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { ckdEpi2021, cockcroftGault } from '../services/clinicianAssistant/engine/modules/renal';
import { assessSepsis, meanArterialPressure } from '../services/clinicianAssistant/calculators';
import { egfrCkdEpi } from '../services/clinicianAssistant/clinicalCalculators';
import { labService } from '../services/labService';
import { burnCareService } from '../services/burnCareService';
import { diabeticFootService } from '../services/diabeticFootService';

const ls = labService as any;

describe('eGFR is CKD-EPI 2021 everywhere', () => {
  it('Labs uses the race-free 2021 equation (no race argument)', () => {
    // 54-year-old man, creatinine 250 µmol/L: hand-calculated 25.7 → 26.
    expect(ls.calculateCKDEPI(250 / 88.4, 54, 'male')).toBe(26);
    expect(ls.calculateCKDEPI(250 / 88.4, 54, 'male')).toBe(ckdEpi2021(250, 54, 'male'));
    // The 2009 race-based equation would have given 33 for a Black patient.
    expect(ls.calculateCKDEPI.length).toBe(4);
  });
  it('Labs gives children the bedside Schwartz eGFR and asks for height without it', () => {
    expect(ls.calculateCKDEPI(60 / 88.4, 8, 'female', 125)).toBe(76); // 36.5 × 125 / 60
    expect(() => ls.calculateCKDEPI(60 / 88.4, 8, 'female')).toThrow(/height/);
  });
  it('MDRD no longer applies a race coefficient', () => {
    const v = ls.calculateMDRD(1.5, 60, 'male');
    expect(Math.round(v)).toBe(Math.round(175 * Math.pow(1.5, -1.154) * Math.pow(60, -0.203)));
  });
  it('Clinician Assistant adapter equals the engine and refuses children', () => {
    expect(egfrCkdEpi({ creatinineUmolL: 250, ageYears: 54, sex: 'male' }).egfr).toBe(ckdEpi2021(250, 54, 'male'));
    expect(egfrCkdEpi({ creatinineUmolL: 80, ageYears: 40, sex: 'female' }).egfr).toBe(ckdEpi2021(80, 40, 'female'));
    const child = egfrCkdEpi({ creatinineUmolL: 60, ageYears: 8, sex: 'female' });
    expect(child.egfr).toBeNull();
    expect(child.note).toMatch(/Schwartz/);
  });
});

describe('creatinine clearance is the engine Cockcroft–Gault', () => {
  it('Labs CG equals the engine (mg/dL input converted)', () => {
    expect(ls.calculateCockcroftGault(250 / 88.4, 54, 'male', 70)).toBe(cockcroftGault(250, 54, 70, 'male'));
    expect(ls.calculateCockcroftGault(90 / 88.4, 70, 'female', 60)).toBe(cockcroftGault(90, 70, 60, 'female'));
  });
});

describe('qSOFA and MAP come from the shared sepsis calculator', () => {
  it('burns', () => {
    expect(burnCareService.calculateQSOFA(22, 100, false).score).toBe(2);
    expect(burnCareService.calculateQSOFA(18, 120, true).score).toBe(1);
    expect(burnCareService.calculateMAP(120, 80)).toBe(meanArterialPressure(120, 80));
  });
  it('diabetic foot counts SBP of exactly 100 (qSOFA is ≤ 100)', () => {
    const r = diabeticFootService.calculateSepsisScore({
      temperature: 38.5, heartRate: 110, respiratoryRate: 24, wbc: 15, systolicBP: 100, alteredMentation: false,
      crepitus: false, foulSmell: false, purulentDischarge: false, lymphangitis: false, localCellulitis: false, crp: 10,
    } as any);
    expect(r.qsofaScore).toBe(2);
    expect(r.sirsScore).toBe(4);
    const same = assessSepsis({ temperature: 38.5, heartRate: 110, respiratoryRate: 24, systolicBP: 100, avpu: 'A' }, { wbc: 15 });
    expect([r.sirsScore, r.qsofaScore]).toEqual([same.sirs, same.qSOFA]);
  });
});
