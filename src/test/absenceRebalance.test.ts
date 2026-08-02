// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { planRebalance } from '../../api/_lib/loadBalance.js';

/**
 * The levelling arithmetic shared by the consultant rebalance script and the
 * absence engine's levelGrade(). Pure and worth pinning down: an off-by-one
 * here silently gives one clinician a permanently heavier list.
 *
 * Imported from api/_lib/loadBalance.js, NOT from the CLI script — importing
 * the script pulled a database connection and an `import.meta` guard into the
 * test run, which Vitest could not parse.
 */

const counts = (...ns: number[]) => ns.map((n, i) => ({ id: String(i + 1), name: `S${i + 1}`, count: n }));

describe('planRebalance', () => {
  it('levels an uneven load towards the mean', () => {
    const { targets } = planRebalance(counts(21, 19, 15, 0));
    const values = [...targets.values()].sort((a, b) => b - a);
    expect(values).toEqual([14, 14, 14, 13]);
    expect(values.reduce((s, n) => s + n, 0)).toBe(55);
  });

  it('gives the remainder to those already carrying most', () => {
    // Otherwise the busiest person is levelled BELOW a colleague, which reads
    // as arbitrary to the people involved.
    const { targets } = planRebalance(counts(10, 5, 4));
    expect(targets.get('1')).toBe(7); // was highest, keeps the extra
    expect(targets.get('2')).toBe(6);
    expect(targets.get('3')).toBe(6);
  });

  it('identifies donors and receivers correctly', () => {
    const { donors, receivers } = planRebalance(counts(21, 19, 15, 0));
    expect(donors.map(d => d.name).sort()).toEqual(['S1', 'S2', 'S3']);
    expect(receivers.map(r => r.name)).toEqual(['S4']);
    expect(donors.reduce((s, d) => s + d.give, 0)).toBe(receivers.reduce((s, r) => s + r.take, 0));
  });

  it('is a no-op when already balanced', () => {
    const { donors, receivers } = planRebalance(counts(5, 5, 5));
    expect(donors).toHaveLength(0);
    expect(receivers).toHaveLength(0);
  });

  it('handles a single person and an empty list without dividing by zero', () => {
    expect(planRebalance(counts(7)).donors).toHaveLength(0);
    expect(planRebalance([]).moves).toEqual([]);
  });

  it('handles everyone at zero', () => {
    const { targets } = planRebalance(counts(0, 0, 0));
    expect([...targets.values()]).toEqual([0, 0, 0]);
  });

  it('conserves the total across any distribution', () => {
    for (const dist of [[3, 1], [9, 0, 0], [7, 7, 1, 1], [100, 1]]) {
      const input = counts(...dist);
      const total = dist.reduce((s, n) => s + n, 0);
      const { targets } = planRebalance(input);
      expect([...targets.values()].reduce((s, n) => s + n, 0)).toBe(total);
    }
  });

  it('never leaves a spread wider than one patient', () => {
    for (const dist of [[21, 19, 15, 0], [30, 2, 2], [11, 5, 5, 5, 1]]) {
      const { targets } = planRebalance(counts(...dist));
      const values = [...targets.values()];
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    }
  });
});
