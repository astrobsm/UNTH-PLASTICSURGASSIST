/**
 * Order admitted patients by where they lie: ward (natural order, so "Ward 2"
 * comes before "Ward 10"), then bed (numerically), then name. Patients with no
 * ward recorded go last so the gap is visible.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export interface WardSortable { ward?: string | null; bed?: string | null; name?: string | null }

export function compareByWard(a: WardSortable, b: WardSortable): number {
  const wa = String(a.ward || '').trim(), wb = String(b.ward || '').trim();
  if (!wa !== !wb) return wa ? -1 : 1;
  return collator.compare(wa, wb)
    || (() => {
      const ba = String(a.bed || '').trim(), bb = String(b.bed || '').trim();
      if (!ba !== !bb) return ba ? -1 : 1;
      return collator.compare(ba, bb);
    })()
    || collator.compare(String(a.name || ''), String(b.name || ''));
}

export function sortByWard<T extends WardSortable>(list: T[]): T[] {
  return list.slice().sort(compareByWard);
}

/** Label for a ward group heading. */
export const wardLabel = (ward?: string | null) => String(ward || '').trim() || 'Ward not recorded';
