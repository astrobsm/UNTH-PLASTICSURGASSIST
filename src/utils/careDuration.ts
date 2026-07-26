/**
 * How long a patient has been under the unit's care.
 *
 * The clock starts the day the consult was sent for our review (a referred
 * patient) or the day we admitted them (our own patient) — the server decides
 * which and returns `care_start_date` with `care_start_source`. This module only
 * turns that date into what the ward actually says out loud: "Day 6".
 *
 * Counted in whole calendar days in local time, and inclusive of the first day,
 * because on a ward the day someone arrives is Day 1 — not Day 0.
 */

export type CareStartSource = 'consult' | 'admission' | null | undefined;

export interface CareDuration {
  /** Day 1 on the start date, Day 2 the next day, and so on. */
  dayNumber: number;
  /** Whole days elapsed since the start date (Day 1 = 0 nights). */
  daysElapsed: number;
  /** Short badge text, e.g. "Day 6". */
  label: string;
  /** Full sentence for a tooltip, e.g. "Day 6 under our care — referred 20 Jul 2026". */
  detail: string;
  startDate: Date;
}

const MS_PER_DAY = 86_400_000;

/** Midnight local time, so a patient admitted at 23:00 is Day 2 the next morning. */
function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * The API returns care_start_date as a calendar date (YYYY-MM-DD) because the
 * requirement is about DAYS, not instants. `new Date('2026-07-06')` would parse
 * that as UTC midnight and shift the day backwards for anyone west of UTC, so
 * date-only strings are built as a local date instead.
 */
function parseCareStart(value: string | Date): Date {
  if (value instanceof Date) return value;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(value);
}

const shortDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * @param careStart ISO date string from the API (`care_start_date`)
 * @param source    which event started the clock (`care_start_source`)
 * @param now       injectable for tests
 */
export function careDuration(
  careStart?: string | Date | null,
  source: CareStartSource = null,
  now: Date = new Date(),
): CareDuration | null {
  if (!careStart) return null;
  const start = parseCareStart(careStart);
  if (Number.isNaN(start.getTime())) return null;

  // A future start date (clock skew, or a referral dated tomorrow) is still Day 1
  // rather than a negative day count.
  const daysElapsed = Math.max(0, Math.floor((startOfLocalDay(now) - startOfLocalDay(start)) / MS_PER_DAY));
  const dayNumber = daysElapsed + 1;

  const because = source === 'consult'
    ? `referred to us ${shortDate(start)}`
    : `admitted ${shortDate(start)}`;

  return {
    dayNumber,
    daysElapsed,
    label: `Day ${dayNumber}`,
    detail: `Day ${dayNumber} under our care — ${because}`,
    startDate: start,
  };
}

/**
 * Colour band for the badge. Long stays are the ones worth noticing on a ward
 * round, so they get a warmer colour — nothing here means "overdue", only
 * "look at this one".
 */
export function careDurationTone(dayNumber: number): 'fresh' | 'settled' | 'long' | 'very-long' {
  if (dayNumber <= 3) return 'fresh';
  if (dayNumber <= 14) return 'settled';
  if (dayNumber <= 30) return 'long';
  return 'very-long';
}

/** Tailwind classes per tone, kept next to the bands so they can't drift apart. */
export const CARE_TONE_CLASSES: Record<ReturnType<typeof careDurationTone>, string> = {
  fresh: 'bg-blue-50 text-blue-700 border-blue-200',
  settled: 'bg-green-50 text-green-700 border-green-200',
  long: 'bg-amber-50 text-amber-800 border-amber-200',
  'very-long': 'bg-rose-50 text-rose-700 border-rose-200',
};
