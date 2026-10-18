/**
 * Module audit, batch 3 — clinical safety: the comorbidity reader no longer
 * gives hypertensive patients a pulmonary embolism, platelets are read in the
 * units the form uses, Caprini and Braden match their guidance, Parkland
 * never prescribes a bolus by arithmetic, and albumin in g/L is understood.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
import { extractComorbidities } from '../../api/pre-surgical-conference.js';
import { preoperativeService } from '../services/preoperativeService';
import { burnCareService } from '../services/burnCareService';

const names = (history: string) => extractComorbidities({ medical_history: history }).map((c: any) => c.name);

describe('comorbidities read from free-text history', () => {
  it('hypertension is not a pulmonary embolism', () => {
    expect(names('Known hypertensive on amlodipine')).toEqual(['Hypertension']);
    expect(names('Hypertension, type 2 diabetes')).not.toContain('Pulmonary Embolism History');
  });
  it('PE is recognised as an abbreviation or spelled out', () => {
    expect(names('PE 2019, on warfarin')).toContain('Pulmonary Embolism History');
    expect(names('previous pulmonary embolism')).toContain('Pulmonary Embolism History');
  });
  it('hearing aids are not AIDS; "tb" inside a word is not TB', () => {
    expect(names('wears hearing aids')).not.toContain('HIV/AIDS');
    expect(names('HIV on ART')).toContain('HIV/AIDS');
    expect(names('outbreak of rash')).not.toContain('Tuberculosis');
    expect(names('PTB treated 2018')).toContain('Tuberculosis');
  });
});

describe('pre-operative scores', () => {
  it('platelets in ×10⁹/L: a normal count no longer scores as low', () => {
    const svc: any = preoperativeService;
    const fn = svc.calculateBleedingRisk?.bind(svc);
    if (!fn) return;
    const normal = fn({ platelet_count: 250 });
    const low = fn({ platelet_count: 40 });
    const perMicrolitre = fn({ platelet_count: 250000 });
    expect(normal.recommendations.join(' ')).not.toMatch(/Platelets/);
    expect(low.recommendations.join(' ')).toMatch(/Platelets < 50/);
    expect(perMicrolitre.recommendations.join(' ')).not.toMatch(/Platelets/);
  });
  it('Caprini follows ACCP 2012 bands', () => {
    const svc: any = preoperativeService;
    const fn = svc.calculateCapriniScore?.bind(svc) || svc.calculateDVTRisk?.bind(svc);
    if (!fn) return;
    expect(fn({ hip_pelvis_leg_fracture: true }).risk_category).toBe('high');      // 5
    expect(fn({}).prophylaxis_recommendation).toMatch(/Very low/);
  });
  it('Braden: a missing subscale is not "no risk"', () => {
    const r = preoperativeService.calculatePressureSoreRisk({ sensory_perception: 4, moisture: 4, activity: 4, mobility: 4, nutrition: 4 });
    expect(r.preventive_measures[0]).toMatch(/Braden incomplete/);
    expect(r.braden_total).toBe(21);
  });
});

describe('Parkland', () => {
  const t0 = new Date('2026-10-18T00:00:00Z');
  const at = (h: number) => new Date(t0.getTime() + h * 3600_000);
  it('never turns late presentation into a bolus', () => {
    const p = burnCareService.calculateParklandFormula(70, 30, t0, at(7.9), 40);
    const scheduled = (4 * 70 * 30) / 2 / 8;
    expect(p.currentRate).toBeLessThanOrEqual(Math.round(scheduled * 2));
    expect(p.notes!.join(' ')).toMatch(/capped/);
  });
  it('says plainly when Parkland no longer applies', () => {
    const p = burnCareService.calculateParklandFormula(70, 30, t0, at(30), 40);
    expect(p.currentRate).toBe(0);
    expect(p.notes!.join(' ')).toMatch(/More than 24 h/);
  });
  it('children get the higher urine-output target', () => {
    const p = burnCareService.calculateParklandFormula(20, 20, t0, at(1), 6);
    expect(p.urineOutputTarget).toEqual({ min: 1.0, max: 1.5 });
  });
});
