/**
 * CIWA-Ar and COWS: published item counts, maxima, scoring values and
 * severity bands; COWS pulse from heart rate; escalation from score and vitals.
 */
import { describe, it, expect } from 'vitest';
import { CIWA_AR_ITEMS, COWS_ITEMS, SCALE_MAX, scoreItems, interpretScale, cowsPulseScore, vitalRedFlags } from '../services/withdrawalScales';

const maxOf = (items: typeof COWS_ITEMS) => items.reduce((n, i) => n + Math.max(...i.options.map(o => o.score)), 0);

describe('scale structure', () => {
  it('CIWA-Ar has 10 items, max 67 (nine 0–7 items and orientation 0–4)', () => {
    expect(CIWA_AR_ITEMS).toHaveLength(10);
    expect(maxOf(CIWA_AR_ITEMS)).toBe(67);
    expect(SCALE_MAX['CIWA-Ar']).toBe(67);
  });
  it('COWS has 11 items, max 48, with its non-linear item scores', () => {
    expect(COWS_ITEMS).toHaveLength(11);
    expect(maxOf(COWS_ITEMS)).toBe(48);
    expect(COWS_ITEMS.find(i => i.id === 'pulse')!.options.map(o => o.score)).toEqual([0, 1, 2, 4]);
    expect(COWS_ITEMS.find(i => i.id === 'gooseflesh')!.options.map(o => o.score)).toEqual([0, 3, 5]);
  });
});

describe('bands', () => {
  it('CIWA-Ar: <10 minimal, 10–15 moderate, >15 severe with escalation', () => {
    expect(interpretScale('CIWA-Ar', 9).severity).toBe('mild');
    expect(interpretScale('CIWA-Ar', 12).band).toMatch(/Moderate/);
    expect(interpretScale('CIWA-Ar', 16).escalate).toBe(true);
    expect(interpretScale('CIWA-Ar', 25).band).toMatch(/Very severe/);
  });
  it('COWS: 5–12 mild, 13–24 moderate, 25–36 moderately severe, >36 severe', () => {
    expect(interpretScale('COWS', 4).band).toMatch(/No active/);
    expect(interpretScale('COWS', 12).band).toMatch(/Mild/);
    expect(interpretScale('COWS', 13).band).toMatch(/Moderate/);
    expect(interpretScale('COWS', 25).escalate).toBe(true);
    expect(interpretScale('COWS', 37).band).toMatch(/Severe withdrawal/);
  });
});

describe('scoring', () => {
  it('an unscored item makes the scale incomplete, not zero', () => {
    const r = scoreItems('COWS', { pulse: 2, sweating: 1 });
    expect(r.complete).toBe(false);
    expect(r.total).toBe(3);
  });
  it('a complete CIWA-Ar is totalled', () => {
    const all = Object.fromEntries(CIWA_AR_ITEMS.map(i => [i.id, 2]));
    const r = scoreItems('CIWA-Ar', all);
    expect(r.complete).toBe(true);
    expect(r.total).toBe(20);
    expect(r.escalate).toBe(true);
  });
  it('COWS pulse follows heart rate', () => {
    expect([80, 81, 101, 121].map(cowsPulseScore)).toEqual([0, 1, 2, 4]);
    expect(cowsPulseScore(undefined)).toBeNull();
  });
  it('vital-sign red flags propose escalation', () => {
    expect(vitalRedFlags({ heartRate: 130, oxygenSaturation: 90 })).toHaveLength(2);
    expect(vitalRedFlags({ heartRate: 90, temperature: 37 })).toHaveLength(0);
  });
});
