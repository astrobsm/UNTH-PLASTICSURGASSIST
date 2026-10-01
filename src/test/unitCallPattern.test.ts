// @vitest-environment node
/**
 * Unit call pattern: units alternate Mon–Tue / Wed–Thu / Fri–Sun, the next
 * week starting with the other unit; consultants split weekday blocks a day
 * each and take whole weekends in turn. Call days run 08:00 → 08:00 WAT.
 */

import { describe, it, expect } from 'vitest';
import {
  callSlotForDay, rotationIndex, pickFrom, houseOfficerDuties, dayNumberFromYmd, ymdFromDayNumber,
  callDayWindow, callDayNumberAt, watDayNumber, normaliseUnitConfig, mondayOnOrBefore,
} from '../../api/_lib/unitCallPattern.js';

// 2026-09-28 is a Monday.
const ANCHOR = dayNumberFromYmd('2026-09-28')!;
const day = (ymd: string) => dayNumberFromYmd(ymd)!;
const unitOn = (ymd: string) => callSlotForDay(day(ymd), ANCHOR).unitIndex;
const consultantOn = (ymd: string, list = ['A', 'B']) => {
  const slot = callSlotForDay(day(ymd), ANCHOR);
  return pickFrom(list, rotationIndex(slot, 'consultant'));
};

describe('unit alternation', () => {
  it('week 1: unit 1 Mon–Tue, unit 2 Wed–Thu, unit 1 Fri–Sun', () => {
    expect(['2026-09-28', '2026-09-29'].map(unitOn)).toEqual([0, 0]);
    expect(['2026-09-30', '2026-10-01'].map(unitOn)).toEqual([1, 1]);
    expect(['2026-10-02', '2026-10-03', '2026-10-04'].map(unitOn)).toEqual([0, 0, 0]);
  });

  it('week 2 starts with the other unit', () => {
    expect(['2026-10-05', '2026-10-06'].map(unitOn)).toEqual([1, 1]);
    expect(['2026-10-07', '2026-10-08'].map(unitOn)).toEqual([0, 0]);
    expect(['2026-10-09', '2026-10-10', '2026-10-11'].map(unitOn)).toEqual([1, 1, 1]);
  });

  it('gives each unit 7 call days a fortnight, and the cycle repeats', () => {
    const counts = [0, 0];
    for (let d = ANCHOR; d < ANCHOR + 14; d++) counts[callSlotForDay(d, ANCHOR).unitIndex]++;
    expect(counts).toEqual([7, 7]);
    for (let d = ANCHOR; d < ANCHOR + 14; d++) {
      expect(callSlotForDay(d + 14, ANCHOR).unitIndex).toBe(callSlotForDay(d, ANCHOR).unitIndex);
    }
  });

  it('works before the anchor date too', () => {
    // The week before the anchor is the "other" week.
    expect(unitOn('2026-09-21')).toBe(1);
    expect(unitOn('2026-09-26')).toBe(1); // Saturday
  });
});

describe('consultant distribution', () => {
  it('splits a weekday block one day each', () => {
    expect(consultantOn('2026-09-28')).toBe('A'); // unit 1 Monday
    expect(consultantOn('2026-09-29')).toBe('B'); // unit 1 Tuesday
    expect(consultantOn('2026-09-30')).toBe('A'); // unit 2 Wednesday
    expect(consultantOn('2026-10-01')).toBe('B'); // unit 2 Thursday
  });

  it('gives one consultant the whole weekend and alternates the unit\'s next weekend', () => {
    const w1 = ['2026-10-02', '2026-10-03', '2026-10-04'].map(d => consultantOn(d)); // unit 1
    const w3 = ['2026-10-16', '2026-10-17', '2026-10-18'].map(d => consultantOn(d)); // unit 1 again
    expect(new Set(w1).size).toBe(1);
    expect(new Set(w3).size).toBe(1);
    expect(w1[0]).not.toBe(w3[0]);
    // Unit 2's consecutive weekends alternate as well.
    expect(consultantOn('2026-10-09')).not.toBe(consultantOn('2026-10-23'));
  });

  it('a single consultant covers every day of the unit', () => {
    for (const d of ['2026-09-28', '2026-09-29', '2026-10-02', '2026-10-04']) {
      expect(consultantOn(d, ['Solo'])).toBe('Solo');
    }
  });

  it('skips someone on leave and takes the colleague', () => {
    const slot = callSlotForDay(day('2026-09-28'), ANCHOR);
    expect(pickFrom(['A', 'B'], rotationIndex(slot, 'consultant'), (p: string) => p !== 'A')).toBe('B');
    expect(pickFrom(['A'], 0, () => false)).toBeNull();
  });

  it('house officers rotate daily through a weekend', () => {
    const hos = ['H1', 'H2', 'H3'];
    const wards = ['2026-10-02', '2026-10-03', '2026-10-04'].map(d =>
      houseOfficerDuties(hos, rotationIndex(callSlotForDay(day(d), ANCHOR), 'house_officer')).ward);
    expect(new Set(wards).size).toBe(3);
  });
});

describe('call-day boundaries (WAT, 08:00 → 08:00)', () => {
  it('a call day starts at 08:00 WAT = 07:00 UTC', () => {
    const { start, end } = callDayWindow(day('2026-10-01'));
    expect(start.toISOString()).toBe('2026-10-01T07:00:00.000Z');
    expect(end.toISOString()).toBe('2026-10-02T07:00:00.000Z');
  });

  it('a consult at 03:00 belongs to the previous day\'s call', () => {
    // 03:00 WAT on Thursday 1 Oct = 02:00 UTC → Wednesday's call.
    expect(ymdFromDayNumber(callDayNumberAt('2026-10-01T02:00:00Z'))).toBe('2026-09-30');
    // 08:30 WAT → Thursday's call.
    expect(ymdFromDayNumber(callDayNumberAt('2026-10-01T07:30:00Z'))).toBe('2026-10-01');
  });

  it('reads calendar dates in WAT, not the server\'s UTC', () => {
    // Local midnight in Lagos, as a browser sends it, is 23:00 UTC the day before.
    expect(ymdFromDayNumber(watDayNumber(new Date('2026-09-30T23:00:00Z')))).toBe('2026-10-01');
  });
});

describe('configuration', () => {
  it('snaps the anchor to its Monday and requires two units with consultants', () => {
    const ok = normaliseUnitConfig({
      anchor_date: '2026-10-01',
      units: [{ name: 'U1', consultant_ids: [1, '2', '2'] }, { name: 'U2', consultant_ids: ['3'] }],
    });
    expect(ok.config?.anchor_date).toBe('2026-09-28');
    expect(ok.config?.units[0].consultant_ids).toEqual(['1', '2']);
    expect(normaliseUnitConfig({ anchor_date: '2026-10-01', units: [{ consultant_ids: ['1'] }] }).error).toBeTruthy();
    expect(normaliseUnitConfig({ anchor_date: '2026-10-01', units: [{ consultant_ids: ['1'] }, { consultant_ids: [] }] }).error).toBeTruthy();
    expect(mondayOnOrBefore(day('2026-10-04'))).toBe(ANCHOR);
  });
});
