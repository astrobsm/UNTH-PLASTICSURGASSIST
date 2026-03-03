import { apiClient } from './apiClient';
import { db } from '../db/database';
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
  /** Month key e.g. "2026-03" */
  month_key: string;
  /** Shift number within the month (1-based) */
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

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a month key like "2026-03" from year & month (0-indexed). */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Return the number of days in a month (1-indexed month). */
function daysInMonth(year: number, monthOneBased: number): number {
  return new Date(year, monthOneBased, 0).getDate();
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

  // ── Generate a monthly roster ────────────────────────────────────────
  /**
   * Auto-generates a duty roster for the given month/year.
   * Each shift is 48 hours, starting at 08:00 on the first day.
   * Staff are assigned round-robin so everyone gets roughly equal shifts.
   */
  async generateMonthlyRoster(
    year: number,
    /** 0-indexed month (0=Jan … 11=Dec) */
    month: number,
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

    const days = daysInMonth(year, month + 1);
    const mKey = monthKey(year, month);
    const shifts: CallDutyShift[] = [];

    let shiftNumber = 1;
    let dayPointer = 1; // Day of month

    // Round-robin indices (separate for each role so the cycling is independent)
    let srIdx = 0;
    let rIdx = 0;
    let hoIdx = 0;

    while (dayPointer <= days) {
      const start = new Date(year, month, dayPointer, 8, 0, 0);
      // 48-hour shift
      const end = new Date(start.getTime() + 48 * 60 * 60 * 1000);

      const sr = seniorRegs.length > 0 ? pick(seniorRegs, srIdx) : null;
      const r = registrars.length > 0 ? pick(registrars, rIdx) : null;
      const ho = houseOfficers.length > 0 ? pick(houseOfficers, hoIdx) : null;

      shifts.push({
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        senior_registrar_id: sr?.id || '',
        senior_registrar_name: sr?.full_name || 'TBD',
        registrar_id: r?.id || '',
        registrar_name: r?.full_name || 'TBD',
        house_officer_id: ho?.id || '',
        house_officer_name: ho?.full_name || 'TBD',
        month_key: mKey,
        shift_number: shiftNumber,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      srIdx++;
      rIdx++;
      hoIdx++;
      shiftNumber++;
      dayPointer += 2; // move 2 days for the 48-hour block
    }

    return shifts;
  }

  // ── Persist roster (IndexedDB) ──────────────────────────────────────
  async saveRoster(shifts: CallDutyShift[]): Promise<void> {
    if (shifts.length === 0) return;
    const mKey = shifts[0].month_key;

    // Remove existing roster for the month first
    const existing = await (db as any).call_duty_roster
      .where('month_key')
      .equals(mKey)
      .toArray();

    if (existing.length > 0) {
      await (db as any).call_duty_roster.bulkDelete(existing.map((s: any) => s.id));
    }

    await (db as any).call_duty_roster.bulkAdd(shifts);
  }

  // ── Fetch saved roster ──────────────────────────────────────────────
  async getRoster(year: number, month: number): Promise<CallDutyShift[]> {
    const mKey = monthKey(year, month);
    try {
      const shifts = await (db as any).call_duty_roster
        .where('month_key')
        .equals(mKey)
        .toArray();
      return shifts.sort((a: CallDutyShift, b: CallDutyShift) => a.shift_number - b.shift_number);
    } catch {
      return [];
    }
  }

  // ── Delete roster ───────────────────────────────────────────────────
  async deleteRoster(year: number, month: number): Promise<void> {
    const mKey = monthKey(year, month);
    const existing = await (db as any).call_duty_roster
      .where('month_key')
      .equals(mKey)
      .toArray();
    if (existing.length > 0) {
      await (db as any).call_duty_roster.bulkDelete(existing.map((s: any) => s.id));
    }
  }

  // ── Update a single shift ──────────────────────────────────────────
  async updateShift(shiftId: number, updates: Partial<CallDutyShift>): Promise<void> {
    await (db as any).call_duty_roster.update(shiftId, {
      ...updates,
      updated_at: new Date().toISOString(),
    });
  }

  // ── Staff summary (shift counts per person for a month) ────────────
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
