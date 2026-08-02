// Pure load-levelling arithmetic, shared by the consultant rebalance script and
// the absence engine.
//
// Kept in its own module with no imports so it can be unit-tested directly. The
// tests previously imported scripts/rebalance-consultants.mjs for this function,
// which dragged a CLI entry point (and a database connection) into the test run.

/**
 * Decide each person's target load when levelling a group towards the mean.
 *
 * The remainder goes to those already carrying the most. Handing it to the
 * least-loaded instead would level a busy person BELOW a colleague, which reads
 * as arbitrary to the people involved.
 *
 * @param {Array<{id: string, name?: string, count: number}>} counts
 * @returns {{targets: Map<string, number>, donors: Array, receivers: Array, total: number, moves: Array}}
 */
export function planRebalance(counts) {
  const list = Array.isArray(counts) ? counts : [];
  const total = list.reduce((sum, c) => sum + (c.count || 0), 0);
  const n = list.length;

  if (!n) return { moves: [], targets: new Map(), donors: [], receivers: [], total: 0 };

  const base = Math.floor(total / n);
  let remainder = total % n;

  const sorted = [...list].sort((a, b) => b.count - a.count);
  const targets = new Map();
  for (const c of sorted) {
    targets.set(c.id, base + (remainder-- > 0 ? 1 : 0));
  }

  const donors = sorted
    .filter(c => c.count > targets.get(c.id))
    .map(c => ({ ...c, give: c.count - targets.get(c.id) }));

  const receivers = sorted
    .filter(c => c.count < targets.get(c.id))
    .map(c => ({ ...c, take: targets.get(c.id) - c.count }));

  return { targets, donors, receivers, total, base, moves: [] };
}
