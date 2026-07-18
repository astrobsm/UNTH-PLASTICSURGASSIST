import { apiClient } from './apiClient';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { userManagementService } from './userManagementService';

// ─── Types ──────────────────────────────────────────────────────────────────

export type HOAssignment = 'ward' | 'emergency' | 'ward_and_emergency' | 'off';

export interface CallDutyShift {
  id?: number;
  /** ISO date string for shift start (e.g. "2026-03-01T08:00:00") */
  start_date: string;
  /** ISO date string for shift end (48 h later) */
  end_date: string;
  /** User ID of the consultant on call (round-robin per shift) */
  consultant_id?: string;
  consultant_name?: string;
  consultant_phone?: string;
  /** User ID of the senior registrar on call */
  senior_registrar_id: string;
  senior_registrar_name: string;
  senior_registrar_phone?: string;
  /** User ID of the registrar on call */
  registrar_id: string;
  registrar_name: string;
  registrar_phone?: string;

  // ── House Officer assignments ──
  /** Legacy single HO field (kept for compat) — same as ho_ward_id */
  house_officer_id: string;
  house_officer_name: string;
  /** HO assigned to Ward duty */
  ho_ward_id: string;
  ho_ward_name: string;
  ho_ward_phone: string;
  /** HO assigned to Emergency duty (same as ward when only 2 HOs) */
  ho_emergency_id: string;
  ho_emergency_name: string;
  ho_emergency_phone: string;
  /** HO who is Off this shift */
  ho_off_id: string;
  ho_off_name: string;
  ho_off_phone: string;
  /** Number of house officers in the pool when roster was generated */
  ho_count: number;

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
  phone: string;
}

// ─── Handover Notes ─────────────────────────────────────────────────────────

export interface HandoverTask {
  id: string;
  text: string;
  status: 'outstanding' | 'completed';
  completed_by_id?: string;
  completed_by_name?: string;
  completed_at?: string;
}

export interface HandoverNote {
  id?: number;
  shift_id: number;
  roster_key: string;
  /** Which assignment the author had during this shift */
  assignment: HOAssignment;
  author_id: string;
  author_name: string;
  /** Free-text handover summary */
  content: string;
  /** Individual tasks / outstanding items */
  tasks: HandoverTask[];
  created_at: string;
  updated_at: string;
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
          phone: u.phone || '',
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
   *
   * House Officer rotation:
   * - 3+ HOs: Ward / Emergency / Off — rotating each shift cycle
   * - 2 HOs:  Ward+Emergency / Off — alternating each shift
   * - 1 HO:   Always on duty (ward + emergency), never off
   */
  async generateRoster(
    startDate: Date,
    endDate: Date,
    createdBy?: string
  ): Promise<CallDutyShift[]> {
    // Fetch staff pools (consultants rotate on call round-robin per 48h shift too)
    const [consultants, seniorRegs, registrars, houseOfficers] = await Promise.all([
      this.getStaffByRole('consultant'),
      this.getStaffByRole('senior_registrar'),
      this.getStaffByRole('junior_registrar'),
      this.getStaffByRole('house_officer'),
    ]);

    if (consultants.length === 0 && seniorRegs.length === 0 && registrars.length === 0 && houseOfficers.length === 0) {
      throw new Error('No staff found. Ensure there are approved users with roles: consultant, senior_registrar, junior_registrar, house_officer.');
    }

    const rKey = rosterKey(startDate, endDate);
    const shifts: CallDutyShift[] = [];
    const hoCount = houseOfficers.length;

    let shiftNumber = 1;
    let consIdx = 0;
    let srIdx = 0;
    let rIdx = 0;
    let hoRotationIdx = 0;

    // Walk through the date range in 2-day (48-hour) increments
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 8, 0, 0);
    const rangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 8, 0, 0);

    while (cursor < rangeEnd) {
      const shiftStart = new Date(cursor);
      const shiftEnd = new Date(shiftStart.getTime() + 48 * 60 * 60 * 1000);

      const consultant = consultants.length > 0 ? pick(consultants, consIdx) : null;
      const sr = seniorRegs.length > 0 ? pick(seniorRegs, srIdx) : null;
      const r = registrars.length > 0 ? pick(registrars, rIdx) : null;

      // ── House Officer rotation ─────────────────────────────────
      let hoWard: StaffMember | null = null;
      let hoEmergency: StaffMember | null = null;
      let hoOff: StaffMember | null = null;

      if (hoCount >= 3) {
        // 3+ HOs:  idx+0 → Ward,  idx+1 → Emergency,  idx+2 → Off
        // The rotation cycles through all HOs evenly.
        hoWard     = houseOfficers[hoRotationIdx % hoCount];
        hoEmergency = houseOfficers[(hoRotationIdx + 1) % hoCount];
        hoOff      = houseOfficers[(hoRotationIdx + 2) % hoCount];
      } else if (hoCount === 2) {
        // 2 HOs:  even shifts → HO[0] on duty, HO[1] off; odd → swap
        const onDutyIdx = hoRotationIdx % 2;
        const offIdx    = (hoRotationIdx + 1) % 2;
        hoWard     = houseOfficers[onDutyIdx];
        hoEmergency = houseOfficers[onDutyIdx]; // same person covers both
        hoOff      = houseOfficers[offIdx];
      } else if (hoCount === 1) {
        // 1 HO:  always on, never off
        hoWard     = houseOfficers[0];
        hoEmergency = houseOfficers[0];
        hoOff      = null;
      }

      shifts.push({
        start_date: shiftStart.toISOString(),
        end_date: shiftEnd.toISOString(),
        consultant_id: consultant?.id || '',
        consultant_name: consultant?.full_name || 'TBD',
        consultant_phone: consultant?.phone || '',
        senior_registrar_id: sr?.id || '',
        senior_registrar_name: sr?.full_name || 'TBD',
        senior_registrar_phone: sr?.phone || '',
        registrar_id: r?.id || '',
        registrar_name: r?.full_name || 'TBD',
        registrar_phone: r?.phone || '',
        // Legacy compat — primary HO is the ward HO
        house_officer_id: hoWard?.id || '',
        house_officer_name: hoWard?.full_name || 'TBD',
        // New granular HO assignments
        ho_ward_id: hoWard?.id || '',
        ho_ward_name: hoWard?.full_name || 'TBD',
        ho_ward_phone: hoWard?.phone || '',
        ho_emergency_id: hoEmergency?.id || '',
        ho_emergency_name: hoEmergency?.full_name || 'TBD',
        ho_emergency_phone: hoEmergency?.phone || '',
        ho_off_id: hoOff?.id || '',
        ho_off_name: hoOff?.full_name || 'Off',
        ho_off_phone: hoOff?.phone || '',
        ho_count: hoCount,
        month_key: rKey,
        shift_number: shiftNumber,
        created_by: createdBy,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      consIdx++;
      srIdx++;
      rIdx++;
      hoRotationIdx++;
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

  // ── Find the shift covering a given date (across ALL saved rosters) ──
  /**
   * Returns the call-duty shift whose [start_date, end_date) window covers the
   * given date, searching every saved roster. Used by the on-call team display
   * (date selector) and the dashboard "who's on call" panel. Null if none covers it.
   */
  async getShiftForDate(date: Date): Promise<CallDutyShift | null> {
    try {
      const all: CallDutyShift[] = await (db as any).call_duty_roster.toArray();
      const t = date.getTime();
      const covering = all.filter(s => {
        const start = new Date(s.start_date).getTime();
        const end = new Date(s.end_date).getTime();
        return t >= start && t < end;
      });
      if (covering.length === 0) return null;
      // Prefer the most recently updated when overlapping rosters exist.
      covering.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      return covering[0];
    } catch {
      return null;
    }
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

  // ── Staff summary (shift counts) — now includes HO assignment breakdown ──
  getStaffSummary(shifts: CallDutyShift[]): Record<string, { name: string; role: string; count: number; ward?: number; emergency?: number; off?: number }> {
    const summary: Record<string, { name: string; role: string; count: number; ward?: number; emergency?: number; off?: number }> = {};
    for (const s of shifts) {
      if (s.senior_registrar_id) {
        if (!summary[s.senior_registrar_id]) summary[s.senior_registrar_id] = { name: s.senior_registrar_name, role: 'Senior Registrar', count: 0 };
        summary[s.senior_registrar_id].count++;
      }
      if (s.registrar_id) {
        if (!summary[s.registrar_id]) summary[s.registrar_id] = { name: s.registrar_name, role: 'Registrar', count: 0 };
        summary[s.registrar_id].count++;
      }
      // HO Ward
      if (s.ho_ward_id) {
        if (!summary[s.ho_ward_id]) summary[s.ho_ward_id] = { name: s.ho_ward_name, role: 'House Officer', count: 0, ward: 0, emergency: 0, off: 0 };
        summary[s.ho_ward_id].count++;
        summary[s.ho_ward_id].ward = (summary[s.ho_ward_id].ward || 0) + 1;
      }
      // HO Emergency (skip if same as ward — already counted)
      if (s.ho_emergency_id && s.ho_emergency_id !== s.ho_ward_id) {
        if (!summary[s.ho_emergency_id]) summary[s.ho_emergency_id] = { name: s.ho_emergency_name, role: 'House Officer', count: 0, ward: 0, emergency: 0, off: 0 };
        summary[s.ho_emergency_id].count++;
        summary[s.ho_emergency_id].emergency = (summary[s.ho_emergency_id].emergency || 0) + 1;
      } else if (s.ho_emergency_id && s.ho_emergency_id === s.ho_ward_id) {
        // Same person covers both — count as emergency too (already counted in count)
        if (summary[s.ho_emergency_id]) summary[s.ho_emergency_id].emergency = (summary[s.ho_emergency_id].emergency || 0) + 1;
      }
      // HO Off
      if (s.ho_off_id) {
        if (!summary[s.ho_off_id]) summary[s.ho_off_id] = { name: s.ho_off_name, role: 'House Officer', count: 0, ward: 0, emergency: 0, off: 0 };
        summary[s.ho_off_id].off = (summary[s.ho_off_id].off || 0) + 1;
      }
      // Fallback for legacy shifts without new HO fields
      if (!s.ho_ward_id && s.house_officer_id) {
        if (!summary[s.house_officer_id]) summary[s.house_officer_id] = { name: s.house_officer_name, role: 'House Officer', count: 0 };
        summary[s.house_officer_id].count++;
      }
    }
    return summary;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ── Handover Notes ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  /** Create or update a handover note for a shift */
  async saveHandoverNote(note: HandoverNote): Promise<number> {
    const now = new Date().toISOString();
    if (note.id) {
      await (db as any).call_duty_handover_notes.update(note.id, { ...note, updated_at: now });
      return note.id;
    }
    const id = await (db as any).call_duty_handover_notes.add({ ...note, created_at: now, updated_at: now });
    syncService.queueAction('create', 'call_duty_handover_notes' as any, id, { ...note, id });
    return id;
  }

  /** Get all handover notes for a specific shift */
  async getHandoverNotesByShift(shiftId: number): Promise<HandoverNote[]> {
    try {
      return await (db as any).call_duty_handover_notes
        .where('shift_id')
        .equals(shiftId)
        .toArray();
    } catch { return []; }
  }

  /** Get all handover notes for a roster */
  async getHandoverNotesByRoster(rKey: string): Promise<HandoverNote[]> {
    try {
      return await (db as any).call_duty_handover_notes
        .where('roster_key')
        .equals(rKey)
        .toArray();
    } catch { return []; }
  }

  /** Get outstanding tasks from all handover notes for a roster (tasks not yet completed) */
  getOutstandingTasks(notes: HandoverNote[]): Array<HandoverTask & { note_id: number; shift_id: number; author_name: string; assignment: HOAssignment }> {
    const outstanding: Array<HandoverTask & { note_id: number; shift_id: number; author_name: string; assignment: HOAssignment }> = [];
    for (const note of notes) {
      for (const task of (note.tasks || [])) {
        if (task.status === 'outstanding') {
          outstanding.push({
            ...task,
            note_id: note.id!,
            shift_id: note.shift_id,
            author_name: note.author_name,
            assignment: note.assignment,
          });
        }
      }
    }
    return outstanding;
  }

  /** Mark a handover task as completed */
  async completeTask(noteId: number, taskId: string, completedById: string, completedByName: string): Promise<void> {
    const note: HandoverNote = await (db as any).call_duty_handover_notes.get(noteId);
    if (!note) return;
    const now = new Date().toISOString();
    const updatedTasks = note.tasks.map(t =>
      t.id === taskId
        ? { ...t, status: 'completed' as const, completed_by_id: completedById, completed_by_name: completedByName, completed_at: now }
        : t
    );
    await (db as any).call_duty_handover_notes.update(noteId, { tasks: updatedTasks, updated_at: now });
  }

  /** Reopen a completed task */
  async reopenTask(noteId: number, taskId: string): Promise<void> {
    const note: HandoverNote = await (db as any).call_duty_handover_notes.get(noteId);
    if (!note) return;
    const updatedTasks = note.tasks.map(t =>
      t.id === taskId
        ? { ...t, status: 'outstanding' as const, completed_by_id: undefined, completed_by_name: undefined, completed_at: undefined }
        : t
    );
    await (db as any).call_duty_handover_notes.update(noteId, { tasks: updatedTasks, updated_at: new Date().toISOString() });
  }

  /** Find the current active shift for a given user (shift that contains now) */
  async getCurrentShiftForUser(userId: string): Promise<CallDutyShift | null> {
    try {
      const now = new Date().toISOString();
      const allShifts = await (db as any).call_duty_roster.toArray();
      return allShifts.find((s: CallDutyShift) =>
        s.start_date <= now && s.end_date > now &&
        (s.ho_ward_id === userId || s.ho_emergency_id === userId || s.house_officer_id === userId)
      ) || null;
    } catch { return null; }
  }
}
export const callDutyService = new CallDutyService();
