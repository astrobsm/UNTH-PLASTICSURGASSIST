// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CONFIG,
  SURGERY_CHECKLIST_ITEMS,
  defaultSurgeryChecklist,
  deriveQueueStatus,
  normalizeConfig,
  dayConfigFor,
  isHoliday,
  generateTimeSlots,
  fmt12,
  scheduleLabelFor,
  getUpcomingClinicDates,
} from '../../api/_lib/clinicScheduling.js';

describe('clinicScheduling — surgery queue', () => {
  it('defaultSurgeryChecklist starts all-false for every item', () => {
    const c = defaultSurgeryChecklist();
    expect(Object.keys(c).sort()).toEqual([...SURGERY_CHECKLIST_ITEMS].sort());
    expect(Object.values(c).every(v => v === false)).toBe(true);
  });

  it('deriveQueueStatus = pending when nothing done', () => {
    expect(deriveQueueStatus(defaultSurgeryChecklist())).toBe('pending');
    expect(deriveQueueStatus({})).toBe('pending');
    expect(deriveQueueStatus(null)).toBe('pending');
  });

  it('deriveQueueStatus = in_progress when some done', () => {
    expect(deriveQueueStatus({ consent: true })).toBe('in_progress');
    expect(deriveQueueStatus({ preop_checklist: true, consent: true })).toBe('in_progress');
  });

  it('deriveQueueStatus = ready when all done', () => {
    const all = {};
    SURGERY_CHECKLIST_ITEMS.forEach(k => { all[k] = true; });
    expect(deriveQueueStatus(all)).toBe('ready');
  });
});

describe('clinicScheduling — config normalisation', () => {
  it('fills missing days from defaults and coerces types', () => {
    const cfg = normalizeConfig({ days: { '2': { enabled: true, stations: '3', doctors: ['A'], sessions: [] } } });
    expect(cfg.slotMinutes).toBe(20);
    expect(Object.keys(cfg.days)).toHaveLength(7);
    expect(cfg.days['2'].stations).toBe(3); // string -> number
    expect(Array.isArray(cfg.days['0'].sessions)).toBe(true);
  });

  it('derives station count from doctors when stations omitted', () => {
    const cfg = normalizeConfig({ days: { '1': { enabled: true, doctors: ['A', 'B'], sessions: [] } } });
    expect(cfg.days['1'].stations).toBe(2);
  });

  it('preserves a holidays array', () => {
    const cfg = normalizeConfig({ holidays: ['2026-12-25'], days: {} });
    expect(cfg.holidays).toEqual(['2026-12-25']);
  });

  it('dayConfigFor falls back to default for unknown day', () => {
    expect(dayConfigFor(DEFAULT_CONFIG, 2).enabled).toBe(true);
    expect(dayConfigFor({ days: {} }, 2)).toEqual(DEFAULT_CONFIG.days['2']);
  });

  it('isHoliday matches exact date strings', () => {
    const cfg = { holidays: ['2026-06-30'] };
    expect(isHoliday(cfg, '2026-06-30')).toBe(true);
    expect(isHoliday(cfg, '2026-07-01')).toBe(false);
    expect(isHoliday({}, '2026-06-30')).toBe(false);
  });
});

describe('clinicScheduling — slot generation', () => {
  it('generates 20-minute slots across both Tuesday sessions', () => {
    const slots = generateTimeSlots(DEFAULT_CONFIG, 2);
    // 09:00-13:30 = 4.5h = 13 slots; 14:00-16:00 = 2h = 6 slots => 19
    expect(slots).toHaveLength(19);
    expect(slots[0]).toBe('09:00-09:20');
    expect(slots[slots.length - 1]).toBe('15:40-16:00');
  });

  it('does not exceed the session end time', () => {
    const cfg = normalizeConfig({ slotMinutes: 25, days: { '1': { enabled: true, doctors: ['A'], sessions: [{ start: '09:00', end: '10:00' }] } } });
    const slots = generateTimeSlots(cfg, 1);
    // 60 / 25 = 2 full slots (09:00-09:25, 09:25-09:50)
    expect(slots).toEqual(['09:00-09:25', '09:25-09:50']);
  });

  it('returns no slots for a disabled day', () => {
    expect(generateTimeSlots(DEFAULT_CONFIG, 0)).toEqual([]);
  });

  it('honours a per-day slotMinutes override', () => {
    const cfg = normalizeConfig({ slotMinutes: 20, days: { '4': { enabled: true, doctors: ['A'], sessions: [{ start: '09:00', end: '10:00' }], slotMinutes: 30 } } });
    expect(generateTimeSlots(cfg, 4)).toEqual(['09:00-09:30', '09:30-10:00']);
  });
});

describe('clinicScheduling — formatting', () => {
  it('fmt12 converts 24h to 12h with meridiem', () => {
    expect(fmt12('09:00')).toBe('9:00 AM');
    expect(fmt12('13:30')).toBe('1:30 PM');
    expect(fmt12('00:05')).toBe('12:05 AM');
    expect(fmt12('12:00')).toBe('12:00 PM');
  });

  it('scheduleLabelFor joins sessions', () => {
    const label = scheduleLabelFor(DEFAULT_CONFIG.days['3']);
    expect(label).toBe('10:00 AM – 4:00 PM');
  });
});

describe('clinicScheduling — upcoming dates', () => {
  it('lists only enabled, non-holiday clinic days within 4 weeks', () => {
    // Monday 2026-06-29 08:00 -> first clinic day is Tue 2026-06-30
    const dates = getUpcomingClinicDates(DEFAULT_CONFIG, new Date('2026-06-29T08:00:00'));
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every(d => d.dayOfWeek === 2 || d.dayOfWeek === 3)).toBe(true);
    expect(dates[0].date).toBe('2026-06-30');
  });

  it('excludes a configured holiday', () => {
    const cfg = { ...DEFAULT_CONFIG, holidays: ['2026-06-30'] };
    const dates = getUpcomingClinicDates(cfg, new Date('2026-06-29T08:00:00'));
    expect(dates.find(d => d.date === '2026-06-30')).toBeUndefined();
  });
});
