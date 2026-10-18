/**
 * Scar alerts are derived from the case analysis: recurrence, progression,
 * acceleration, contracture, severe symptoms, discordant or mixed measures.
 */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn() }));
import { deriveScarAlerts } from '../../api/_lib/scarAlerts.js';

const codes = (x: any) => deriveScarAlerts(x).map((a: any) => a.code);

describe('deriveScarAlerts', () => {
  it('raises nothing for a quiet, quiescent scar', () => {
    expect(codes({ keloid: { status: { status: 'quiescent' } }, latest: { pain_0_10: 1 } })).toEqual([]);
  });
  it('recurrence is critical; progression is a warning', () => {
    const r = deriveScarAlerts({ keloid: { status: { status: 'possible_recurrence', summary: 's' } }, latest: {} });
    expect(r[0]).toMatchObject({ code: 'possible_recurrence', severity: 'critical' });
    expect(codes({ keloid: { status: { status: 'progressive', summary: 's' } }, latest: {} })).toEqual(['progressive_growth']);
  });
  it('acceleration only when meaningful', () => {
    expect(codes({ keloid: { acceleration: { ok: true, accelerating: true, meaningful: false } }, latest: {} })).toEqual([]);
    expect(codes({ keloid: { acceleration: { ok: true, accelerating: true, meaningful: true, deltaPerMonth: 0.4 } }, latest: {} })).toEqual(['growth_accelerating']);
  });
  it('contracture severity follows the ROM deficit; severe symptoms at 7/10', () => {
    const r = deriveScarAlerts({ keloid: {}, latest: { contracture_present: true, rom_deficit_degrees: '35', itch_0_10: '7' } });
    expect(r.map((a: any) => [a.code, a.severity])).toEqual([['contracture', 'warning'], ['severe_symptoms', 'warning']]);
  });
  it('discordant modalities and mixed methods are informational', () => {
    expect(codes({ keloid: {}, latest: {}, multimodal: { verdict: 'discordant', summary: 'x' }, methodConsistency: { consistent: false, warning: 'w' } }))
      .toEqual(['discordant_measures', 'mixed_methods']);
  });
});
