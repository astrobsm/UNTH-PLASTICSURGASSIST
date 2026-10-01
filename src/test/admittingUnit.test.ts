/**
 * Admitting units are stored on admissions as 'PS-UNIT-1' / 'PS-UNIT-2' and
 * parsed on both sides — the server decides the patient's team from it and the
 * dashboard groups patients by it, so the two must read every spelling alike.
 */
import { describe, it, expect } from 'vitest';
import { unitIndexFromId, UNIT_IDS } from '../../api/_lib/teamAssignment.js';
import { admittingUnitIndex, ADMITTING_UNIT_IDS, admittingUnitOptions } from '../services/callDutyService';

const unit = (key: string, name: string, c: string[]) =>
  ({ key, name, consultant_ids: c, senior_registrar_ids: [], registrar_ids: [], house_officer_ids: [] });
const cfg: any = { anchor_date: '2026-09-28', units: [unit('unit1', 'PS Unit 1', ['C1']), unit('unit2', 'Hand Unit', ['C2'])] };

describe('admitting unit ids', () => {
  it('server and app agree on every spelling in use', () => {
    expect([...ADMITTING_UNIT_IDS]).toEqual(UNIT_IDS);
    const cases: Array<[string, number | undefined]> = [
      ['PS-UNIT-1', 0], ['PS-UNIT-2', 1], ['PS-UNIT 2', 1], ['unit1', 0], ['Hand Unit', 1], ['', undefined], ['Burns', undefined],
    ];
    for (const [v, want] of cases) {
      expect(unitIndexFromId(v, cfg.units)).toBe(want);
      expect(admittingUnitIndex(v, cfg)).toBe(want);
    }
  });

  it('offers the configured units as admitting units, first = PS-UNIT-1', () => {
    expect(admittingUnitOptions(cfg).map(u => [u.id, u.name])).toEqual([['PS-UNIT-1', 'PS Unit 1'], ['PS-UNIT-2', 'Hand Unit']]);
    expect(admittingUnitOptions(null)).toEqual([]);
  });
});
