/**
 * The registration nutrition screen goes into the Clinical Nutrition record:
 * weight and height as measurements, an engine MUST assessment submitted for
 * approval. MUST follows BAPEN (exactly 10% loss scores 1, not 2), and a
 * failure never throws into registration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: any[] = [];
let failSave = false;
vi.mock('../services/nutritionService', () => ({
  nutritionService: {
    addMeasurement: vi.fn(async (m: any) => { calls.push(['measurement', m]); return m; }),
    saveAssessment: vi.fn(async (x: any) => { if (failSave) throw new Error('offline'); calls.push(['assessment', x]); return { id: 3, version: 1 }; }),
    submit: vi.fn(async (...a: any[]) => { calls.push(['submit', a]); return {}; }),
  },
}));

import { recordRegistrationScreen, comorbidityFlags } from '../services/nutritionRegistration';
import { mustOf } from '../clinical/nutrition/screening';
import { NUTRITION_CONFIG } from '../clinical/nutrition/config';

beforeEach(() => { calls.length = 0; failSave = false; });

describe('registration nutrition screen', () => {
  it('MUST boundaries follow BAPEN', () => {
    const m = (lossPct: number) => mustOf({}, { bmi: 22, muacBand: null, lossPct }, NUTRITION_CONFIG)!.value;
    expect(m(4.9)).toBe(0);
    expect(m(5)).toBe(1);
    expect(m(10)).toBe(1);
    expect(m(10.5)).toBe(2);
  });

  it('saves measurements and a submitted engine assessment', async () => {
    const r = await recordRegistrationScreen('42', { weightKg: 45, heightCm: 165, weightLossPct: 12, comorbidities: ['type_2_diabetes', 'chronic_kidney_disease'] }, { ageYears: 50, sex: 'female' });
    expect(r).toEqual({ saved: true, must: 4 }); // BMI 16.5 → 2, loss > 10% → 2
    expect(calls.filter(c => c[0] === 'measurement').map(c => c[1].kind)).toEqual(['weight', 'height']);
    const a = calls.find(c => c[0] === 'assessment')![1];
    expect(a.patient_id).toBe('42');
    expect(a.config_version).toBe(NUTRITION_CONFIG.version);
    expect(a.inputs.source).toBe('registration');
    expect(a.inputs.answers.diabetes).toBe(true);
    expect(a.summary.must).toBe(4);
    expect(calls.some(c => c[0] === 'submit')).toBe(true);
  });

  it('never throws, and skips an empty screen', async () => {
    failSave = true;
    const r = await recordRegistrationScreen('42', { weightKg: 60, heightCm: 170 }, {});
    expect(r.saved).toBe(false);
    expect(r.error).toMatch(/offline/);
    failSave = false;
    expect((await recordRegistrationScreen('42', {}, {})).saved).toBe(false);
  });

  it('maps comorbidity text to engine flags', () => {
    expect(comorbidityFlags(['Heart failure', 'Liver cirrhosis', 'CKD stage 3'])).toEqual({ diabetes: false, ckd: true, liverDisease: true, heartFailure: true });
  });
});
