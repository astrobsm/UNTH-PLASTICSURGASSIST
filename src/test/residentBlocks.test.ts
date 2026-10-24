/** Residents alternate PS Unit 1 ↔ 2 every six months from their residency start. */
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../api/_lib/db.js', () => ({ query: vi.fn(async () => ({ rows: [] })) }));
import { blockAt, blocksUntil, addMonths } from '../utils/residentBlocks';
import * as server from '../../api/_lib/residentRotation.js';

const units = [{ key: 'unit1', name: 'PS-UNIT 1' }, { key: 'unit2', name: 'PS-UNIT 2' }];

describe('resident blocks', () => {
  it('the senior registrar who started 11 Feb 2026 in Unit 1 is in Unit 2 now, moving back on 11 Feb 2027', () => {
    const b = blockAt({ residencyStart: '2026-02-11', initialUnitKey: 'unit1', units, today: '2026-10-24' });
    expect(b).toMatchObject({ index: 1, start: '2026-08-11', end: '2027-02-10', unitName: 'PS-UNIT 2', nextUnitName: 'PS-UNIT 1', nextStart: '2027-02-11' });
  });
  it('boundaries and month ends', () => {
    expect(blockAt({ residencyStart: '2026-02-11', initialUnitKey: 'unit1', units, today: '2026-08-10' }).index).toBe(0);
    expect(blockAt({ residencyStart: '2026-02-11', initialUnitKey: 'unit1', units, today: '2026-08-11' }).index).toBe(1);
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29');
    expect(blockAt({ residencyStart: '2026-12-01', initialUnitKey: 'unit2', units, today: '2026-10-24' })).toMatchObject({ index: 0, unitKey: 'unit2' });
  });
  it('history lists every block to now', () => {
    const h = blocksUntil({ residencyStart: '2025-02-11', initialUnitKey: 'unit2', units, today: '2026-10-24' });
    expect(h.map(b => b.unitKey)).toEqual(['unit2', 'unit1', 'unit2', 'unit1']);
  });
  it('client and server agree', () => {
    for (const start of ['2024-01-31', '2025-02-11', '2026-02-11', '2026-08-31'])
      for (const today of ['2026-02-10', '2026-08-11', '2026-10-24', '2027-03-01', '2029-12-31'])
        for (const u of ['unit1', 'unit2']) {
          const a = { residencyStart: start, initialUnitKey: u, units, today };
          expect(blockAt(a)).toEqual(server.blockAt(a));
        }
  });
});
