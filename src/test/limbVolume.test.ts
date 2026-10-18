/**
 * Limb volume (frustum over real segment heights) and lymphoedema staging:
 * ISL 2020 stage is clinical, severity comes from excess volume, Campisi maps
 * from the clinical stage.
 */
import { describe, it, expect } from 'vitest';
import { calculateLimbVolume, positionOf, islStage, islSeverity, campisiStage, type LimbMeasurement } from '../services/limbVolume';

const row = (location: string, a: number, c: number): LimbMeasurement => ({ location, affected_cm: a, contralateral_cm: c, difference_cm: 0, difference_pct: 0 });

describe('positions', () => {
  it('wrist/ankle is 0, proximal rows carry their distance, hand/foot is excluded', () => {
    expect(positionOf('Wrist / Ankle')).toBe(0);
    expect(positionOf('12cm proximal')).toBe(12);
    expect(positionOf('36cm proximal (thigh / upper arm)')).toBe(36);
    expect(positionOf('Hand / Foot (metatarsals)')).toBeNull();
  });
});

describe('volume', () => {
  it('a single 4 cm frustum matches the formula', () => {
    const r = calculateLimbVolume([row('Wrist / Ankle', 22, 20), row('4cm proximal', 24, 22)]);
    expect(r.affected).toBe(168);        // 4 × (22² + 22·24 + 24²) / 12π
    expect(r.contralateral).toBe(140);
    expect(r.difference_pct).toBeCloseTo(19.9, 1);
    expect(r.segmentsUsed).toBe(1);
  });
  it('the hand/foot row and blank rows add nothing', () => {
    const base = [row('Wrist / Ankle', 22, 20), row('4cm proximal', 24, 22), row('8cm proximal', 0, 0)];
    const withHand = [row('Hand / Foot (metatarsals)', 30, 25), ...base];
    expect(calculateLimbVolume(withHand).affected).toBe(calculateLimbVolume(base).affected);
    expect(calculateLimbVolume(base).segmentsUsed).toBe(1);
  });
  it('a level measured on one limb only is excluded from both and warned about', () => {
    const r = calculateLimbVolume([row('Wrist / Ankle', 22, 20), row('4cm proximal', 24, 22), row('8cm proximal', 26, 0)]);
    expect(r.segmentsUsed).toBe(1);
    expect(r.warnings.some(w => /only one limb/.test(w))).toBe(true);
  });
  it('millimetre entries are flagged', () => {
    expect(calculateLimbVolume([row('Wrist / Ankle', 220, 200)]).warnings.some(w => /units/.test(w))).toBe(true);
  });
});

describe('staging', () => {
  const base = { pitting: 'none', fibrosis: 'none', elevation_reduces: true, papillomatosis: false, swellingPresent: true };
  it('ISL stage follows clinical signs, not volume', () => {
    expect(islStage({ ...base, swellingPresent: false })).toBe(0);
    expect(islStage(base)).toBe(1);
    expect(islStage({ ...base, elevation_reduces: false, pitting: 'moderate' })).toBe(2);
    expect(islStage({ ...base, elevation_reduces: false, fibrosis: 'moderate' })).toBe('2late');
    expect(islStage({ ...base, papillomatosis: true })).toBe(3);
  });
  it('severity bands: <20 minimal, 20–40 moderate, >40 severe', () => {
    expect(islSeverity(10)).toBe('minimal');
    expect(islSeverity(20)).toBe('moderate');
    expect(islSeverity(40)).toBe('moderate');
    expect(islSeverity(41)).toBe('severe');
    expect(islSeverity(-2)).toBe('none');
    expect(islSeverity(undefined)).toBeNull();
  });
  it('Campisi maps from the clinical stage', () => {
    expect(campisiStage(0, false)).toBe('IA');
    expect(campisiStage(1, false)).toBe('IB');
    expect(campisiStage(2, false)).toBe('II');
    expect(campisiStage(2, true)).toBe('III');
    expect(campisiStage('2late', false, true)).toBe('IV');
    expect(campisiStage(3, false)).toBe('V');
  });
});
