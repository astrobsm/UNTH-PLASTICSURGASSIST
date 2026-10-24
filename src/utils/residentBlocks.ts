/**
 * Residents rotate PS Unit 1 ↔ PS Unit 2 every six months, counted from the
 * date their residency in the unit started. Mirrors blockAt() in
 * api/_lib/residentRotation.js — a test checks they agree.
 */
export const BLOCK_MONTHS = 6;
const DAY = 86400000;
const pad = (n: number) => String(n).padStart(2, '0');

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12), nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`;
}
const minusDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - DAY).toISOString().slice(0, 10);

export interface Block {
  index: number; start: string; end: string;
  unitKey: string; unitName: string; nextUnitKey: string; nextUnitName: string; nextStart: string;
}

export function blockAt({ residencyStart, initialUnitKey, units, today }: {
  residencyStart: string; initialUnitKey: string; units: { key: string; name: string }[]; today: string;
}): Block {
  const start = residencyStart.slice(0, 10);
  const keys = units.map(u => u.key);
  const first = keys.includes(initialUnitKey) ? initialUnitKey : keys[0];
  const other = keys.find(k => k !== first) || first;
  let index = 0;
  if (today > start) {
    const [sy, sm] = start.split('-').map(Number);
    const [ty, tm] = today.split('-').map(Number);
    index = Math.max(0, Math.floor(((ty * 12 + tm) - (sy * 12 + sm)) / BLOCK_MONTHS));
    while (index > 0 && addMonths(start, index * BLOCK_MONTHS) > today) index--;
    while (addMonths(start, (index + 1) * BLOCK_MONTHS) <= today) index++;
  }
  const unitKey = index % 2 === 0 ? first : other;
  const nextKey = unitKey === first ? other : first;
  const name = (k: string) => units.find(u => u.key === k)?.name || k;
  const nextStart = addMonths(start, (index + 1) * BLOCK_MONTHS);
  return {
    index, start: addMonths(start, index * BLOCK_MONTHS), end: minusDay(nextStart),
    unitKey, unitName: name(unitKey), nextUnitKey: nextKey, nextUnitName: name(nextKey), nextStart,
  };
}

/** Every block from the start to the current one, for the schedule preview. */
export function blocksUntil(args: Parameters<typeof blockAt>[0]): Block[] {
  const current = blockAt(args);
  const out: Block[] = [];
  for (let i = 0; i <= current.index; i++) {
    out.push(blockAt({ ...args, today: addMonths(args.residencyStart.slice(0, 10), i * BLOCK_MONTHS) }));
  }
  return out;
}
