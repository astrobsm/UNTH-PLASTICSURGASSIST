import { apiClient } from './apiClient';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { userManagementService } from './userManagementService';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CallDutyShift {
  id?: number;
  /** ISO date string for shift start (e.g. "2026-03-01T08:00:00") */
  start_date: string;
  /** ISO date string for shift end (48 h later) */
  end_date: string;
  /** User ID of the senior registrar on call */
  senior_registrar_id: string;
  senior_registrar_name: string;
  /** User ID of the registrar (junior registrar) on call */
  registrar_id: string;
  registrar_name: string;
  /** User ID of the house officer on call */
  house_officer_id: string;
  house_officer_name: string;
  /**
   * Roster key stored in the month_key column.
   * Legacy: "YYYY-MM" for monthly rosters.
   * Custom range: "YYYY-MM-DD_YYYY-MM-DD" for custom duration rosters.
   */
  month_key: string;
  /** Shift number within the roster (1-based) */
  shift_number: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StaffMember {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

/** Duration presets for roster generation */
export type DurationPreset = '2weeks' | '1month' | '6weeks' | '2months' | '3months' | 'custom';

export interface DurationOption {
  key: DurationPreset;
  label: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  { key: '2weeks',  label: '2 Weeks'  },
  { key: '1month',  label: '1 Month'  },
  { key: '6weeks',  label: '6 Weeks'  },
  { key: '2months', label: '2 Months' },
  { key: '3months', label: '3 Months' },
  { key: 'custom',  label: 'Custom Range' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a month key like "2026-03" from year & month (0-indexed). */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Format a Date to "YYYY-MM-DD" */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Build a roster key from a date range: "YYYY-MM-DD_YYYY-MM-DD" */
export function rosterKey(startDate: Date, endDate: Date): string {
  return `${fmtDate(startDate)}_${fmtDate(endDate)}`;
}

/** Parse a roster key back to {start, end} Date objects. Returns null for legacy month keys. */
export function parseRosterKey(key: string): { start: Date; end: Date } | null {
  const parts = key.split('_');
  if (parts.length !== 2) return null;
  const start = new Date(parts[0] + 'T00:00:00');
  const end = new Date(parts[1] + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return { start, end };
}

/** Calculate end date from a start date and duration preset */
export function calcEndDate(startDate: Date, preset: DurationPreset): Date {
  const d = new Date(startDate);
  switch (preset) {
    case '2weeks':
      d.setDate(d.getDate() + 14);
      return d;
    case '1month':
      d.setMonth(d.getMonth() + 1);
      return d;
    case '6weeks':
      d.setDate(d.getDate() + 42);
      return d;
    case '2months':
      d.setMonth(d.getMonth() + 2);
      return d;
    case '3months':
      d.setMonth(d.getMonth() + 3);
      return d;
    case 'custom':
    default:
      return d; // caller must supply explicit end date
  }
}

/** Format a roster key for display (human-readable label). */
export function formatRosterLabel(key: string): string {
  const parsed = parseRosterKey(key);
  if (parsed) {
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
    return `${parsed.start.toLocaleDateString('en-GB', opts)} — ${parsed.end.toLocaleDateString('en-GB', opts)}`;
  }
  // Legacy month key "YYYY-MM"
  const [yStr, mStr] = key.split('-');
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${MONTHS[parseInt(mStr, 10) - 1] || mStr} ${yStr}`;
}

/**
 * Round-robin picker: given an index and a list, returns the element at
 * index % list.length – effectively cycling through the list evenly.
 */
function pick<T>(list: T[], index: number): T {
  return list[index % list.length];
}

// ─── Service ────────────────────────────────────────────────────────────────

class CallDutyService {
  // ── Fetch staff by role ──────────────────────────────────────────────
  async getStaffByRole(role: string): Promise<StaffMember[]> {
    try {
      const allUsers = await userManagementService.getAllApprovedUsers();
      return allUsers
        .filter(u => u.role === role && u.is_active)
        .map(u => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          role: u.role,
        }));
    } catch (err) {
      console.error(`Error fetching ${role} users:`, err);
      return [];
    }
  }

  // ── Generate roster for any date range ──────────────────────────────
  /**
   * Auto-generates a duty roster between startDate and endDate (inclusive of start, exclusive of end).
   * Each shift is 48 hours, starting at 08:00.
   * Staff are assigned round-robin so everyone gets roughly equal shifts.
   */
  async generateRoster(
    startDate: Date,
    endDate: Date,
    createdBy?: string
  ): Promise<CallDutyShift[]> {
    // Fetch staff pools
    const [seniorRegs, registrars, houseOfficers] = await Promise.all([
      this.getStaffByRole('senior_registrar'),
      this.getStaffByRole('junior_registrar'),
      this.getStaffByRole('house_officer'),
    ]);

    if (seniorRegs.length === 0 && registrars.length === 0 && houseOfficers.length === 0) {
      throw new Error('No staff found. Ensure there are approved users with roles: senior_registrar, junior_registrar, house_officer.');
    }

    const rKey = rosterKey(startDate, endDate);
    const shifts: CallDutyShift[] = [];

    let shiftNumber = 1;
    let srIdx = 0;
    let rIdx = 0;
    let hoIdx = 0;

    // Walk through the date range in 2-day (48-hour) increments
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 8, 0, 0);
    const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 8, 0, 0);

    while (cursor < rangeEnd) {
      const shiftStart = new Date(cursor);
      const shiftEnd = new Date(shiftStart.getTime() + 48 * 60 * 60 * 1000);

      const sr = seniorRegs.length > 0 ? pick(seniorRegs, srIdx) : null;
      const r = registrars.length > 0 ? pick(registrars, rIdx) : null;
      const ho = houseOfficers.length > 0 ? pick(houseOfficers, hoIdx) : null;

      shifts.push({
        start_date: shiftStart.toISOString(),
        end_date: shiftEnd.toISOString(),
        senior_registrar_id: sr?.id || '',
        senior_registrar_name: sr?.full_name || 'TBD',
        registrar_id: r?.id || '',
        registrar_name: r?.full_name || 'TBD',
        house_officer_id: ho?.id || '',
        house_officer_name: ho?.full_name || 'TBD',
        month_key: rKey,
        shift_number: shiftNumber,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      srIdx++;
      rIdx++;
      hoIdx++;
      shiftNumber++;
      cursor.setDate(cursor.getDate() + 2);
    }

    return shifts;
  }

  // ── Legacy: Generate a monthly roster ───────────────────────────────
  async generateMonthlyRoster(
    year: number,
    month: number,
    createdBy?: string
  ): Promise<CallDutyShift[]> {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // last day of month
    return this.generateRoster(startDate, endDate, createdBy);
  }

  // ── Persist roster (IndexedDB) ──────────────────────────────────────
  async saveRoster(shifts: CallDutyShift[]): Promise<void> {
    if (shifts.length === 0) return;
    const mKey = shifts[0].month_key;

    // Remove existing roster with the same key first
    const existing = await (db as any).call_duty_roster
      .where('month_key')
      .equals(mKey)
      .toArray();

    if (existing.length > 0) {
      await (db as any).call_duty_roster.bulkDelete(existing.map((s: any) => s.id));
    }

    await (db as any).call_duty_roster.bulkAdd(shifts);

    // Queue each shift for cloud sync
    for (const shift of shifts) {
      const savedShift = await (db as any).call_duty_roster
        .where('month_key').equals(mKey)
        .and((s: any) => s.shift_number === shift.shift_number)
        .first();
      if (savedShift?.id) {
        syncService.queueAction('create', 'call_duty_roster', savedShift.id, savedShift);
      }
    }
  }

  // ── Fetch saved roster by roster key ────────────────────────────────
  async getRosterByKey(rKey: string): Promise<CallDutyShift[]> {
    try {
      const shifts = await (db as any).call_duty_roster
        .where('month_key')
        .equals(rKey)
        .toArray();
      return shifts.sort((a: CallDutyShift, b: CallDutyShift) => a.shift_number - b.shift_number);
    } catch {
      return [];
    }
  }

  // ── Legacy: Fetch saved roster by year/month ────────────────────────
  async getRoster(year: number, month: number): Promise<CallDutyShift[]> {
    return this.getRosterByKey(monthKey(year, month));
  }

  // ── Get roster by date range ────────────────────────────────────────
  async getRosterByRange(startDate: Date, endDate: Date): Promise<CallDutyShift[]> {
    return this.getRosterByKey(rosterKey(startDate, endDate));
  }

  // ── Delete roster by key ────────────────────────────────────────────
  async deleteRosterByKey(rKey: string): Promise<void> {
    const existing = await (db as any).call_duty_roster
      .where('month_key')
      .equals(rKey)
      .toArray();
    if (existing.length > 0) {
      await (db as any).call_duty_roster.bulkDelete(existing.map((s: any) => s.id));
    }
  }

  // ── Legacy: Delete roster ───────────────────────────────────────────
  async deleteRoster(year: number, month: number): Promise<void> {
    return this.deleteRosterByKey(monthKey(year, month));
  }

  // ── List all saved roster keys ──────────────────────────────────────
  async listRosterKeys(): Promise<string[]> {
    try {
      const allShifts = await (db as any).call_duty_roster.toArray();
      const keys = new Set<string>(allShifts.map((s: any) => s.month_key));
      return Array.from(keys).sort();
    } catch {
      return [];
    }
  }

  // ── Update a single shift ──────────────────────────────────────────
  async updateShift(shiftId: number, updates: Partial<CallDutyShift>): Promise<void> {
    await (db as any).call_duty_roster.update(shiftId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  // ── Staff summary (shift counts) ──────────────────────────────────
  getStaffSummary(shifts: CallDutyShift[]): Record<string, { name: string; role: string; count: number }> {
    const summary: Record<string, { name: string; role: string; count: number }> = {};
    for (const s of shifts) {
      if (s.senior_registrar_id) {
        if (!summary[s.senior_registrar_id]) summary[s.senior_registrar_id] = { name: s.senior_registrar_name, role: 'Senior Registrar', count: 0 };
        summary[s.senior_registrar_id].count++;
      }
      if (s.registrar_id) {
        if (!summary[s.registrar_id]) summary[s.registrar_id] = { name: s.registrar_name, role: 'Registrar', count: 0 };
        summary[s.registrar_id].count++;
      }
      if (s.house_officer_id) {
        if (!summary[s.house_officer_id]) summary[s.house_officer_id] = { name: s.house_officer_name, role: 'House Officer', count: 0 };
        summary[s.house_officer_id].count++;
      }
    }
    return summary;
  }
}

export const callDutyService = new CallDutyService();
