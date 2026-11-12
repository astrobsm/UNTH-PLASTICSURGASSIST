/**
 * One NEWS2, one renal-dosing resolver, one interaction checker.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { news2 } from '../services/clinicianAssistant/calculators';
import { calculateEWS } from '../services/trendAnalytics';
import { news2Of } from '../clinical/templates/common';
import { renalDoseGuidance, drugKey } from '../data/renalDosing';
import { medicationDosingService } from '../services/medicationDosingService';
import { findInteractions } from '../data/drugInteractions';

describe('NEWS2 — one implementation', () => {
  it('scores RCP NEWS2 and lists what was not recorded', () => {
    const r = news2({ respiratoryRate: 24, spo2: 93, onOxygen: false, systolicBP: 100, heartRate: 115, temperature: 38.5, alteredConsciousness: false });
    expect(r.total).toBe(2 + 2 + 0 + 2 + 2 + 0 + 1);
    expect(r.complete).toBe(true);
    expect(r.risk).toBe('high'); // 9 ≥ 7
    const partial = news2({ respiratoryRate: 8 });
    expect(partial.anyThree).toBe(true);
    expect(partial.risk).toBe('low-medium');
    expect(partial.missing).toContain('consciousness (ACVPU)');
  });
  it('the templates and the vitals trend use it', () => {
    expect(news2Of({ obs: { rr: 24, spo2: 93, o2: 'No', sbp: 100, hr: 115, temp: 38.5, avpu: 'Alert' } })?.total).toBe(9);
    expect(news2Of({ obs: { rr: 24 } })).toBeNull();
    const ews = calculateEWS({ date: '2026-11-12', respiratory_rate: 7, spo2: 97, bp_systolic: 120, pulse: 80, temperature: 37 });
    // A single parameter scoring 3 is urgent (low–medium), not routine.
    expect(ews.totalScore).toBe(3);
    expect(ews.category).toBe('medium');
    expect(ews.recommendation).toMatch(/Not recorded: supplemental oxygen, consciousness/);
    expect(ews.components.respiratory_rate).toEqual({ value: 7, score: 3 });
  });
});

describe('renal dosing — one resolver, reference first', () => {
  it('amoxicillin: BNF database is primary; the disagreeing tables are shown, not used', () => {
    const g = renalDoseGuidance('Amoxicillin', 40);
    expect(g.primary?.source).toBe('BNF database (reference)');
    expect(g.verified).toBe(true);
    expect(g.multipleSources).toBe(true);
    expect(g.summary).toMatch(/sources differ — confirm/);
  });
  it('a drug only in a secondary table is labelled for pharmacist verification', () => {
    const g = renalDoseGuidance('Gabapentin', 20);
    expect(g.verified).toBe(false);
    expect(g.primary?.source).toMatch(/secondary/);
    expect(g.summary).toMatch(/pharmacist to verify/);
  });
  it('unknown drug and unknown CrCl are handled', () => {
    expect(renalDoseGuidance('Notadrug', 30).primary).toBeNull();
    expect(renalDoseGuidance('Amoxicillin', null).band).toBe('CrCl unknown');
  });
  it('the dosing service never auto-fills a secondary-table number over the reference', () => {
    const rec = medicationDosingService.getDosingRecommendation('Amoxicillin', 40, '500mg', 'TDS');
    expect(rec.adjustedDose).toBe('500mg'); // standard dose kept; BNF note shown
    expect(rec.notes).toMatch(/BNF database \(reference\)/);
    const gaba = medicationDosingService.getDosingRecommendation('Gabapentin', 20);
    expect(gaba.notes).toMatch(/pharmacist to verify/);
  });
  it('metformin is flagged contraindicated at very low clearance', () => {
    expect(renalDoseGuidance('Metformin', 10).contraindicated).toBe(true);
  });
  it('drug keys separate combinations from single agents', () => {
    expect(drugKey('Amoxicillin')).not.toBe(drugKey('Amoxicillin/Clavulanic acid (Co-amoxiclav)'));
    expect(drugKey('Morphine sulphate')).toBe(drugKey('Morphine'));
  });
});

describe('interactions — one checker', () => {
  it('class rules with mechanism and management, most severe first', () => {
    const r = findInteractions(['Warfarin', 'Aspirin', 'Tramadol', 'Sertraline', 'Omeprazole']);
    expect(r[0].severity).toMatch(/major|contraindicated/);
    expect(r.some(x => [x.a, x.b].includes('Warfarin') && [x.a, x.b].includes('Aspirin') && x.severity === 'major' && /bleeding/i.test(x.mechanism))).toBe(true);
    expect(r.some(x => [x.a, x.b].includes('Tramadol') && [x.a, x.b].includes('Sertraline') && /serotonergic/i.test(x.mechanism))).toBe(true);
  });
  it('duplicates and empty input', () => {
    expect(findInteractions(['Omeprazole', 'Pantoprazole']).some(x => /Duplicate/.test(x.mechanism))).toBe(true);
    expect(findInteractions(['Paracetamol', 'paracetamol'])[0].mechanism).toMatch(/listed twice/);
    expect(findInteractions([])).toEqual([]);
    expect(findInteractions(['', 'Warfarin'])).toEqual([]);
  });
});
