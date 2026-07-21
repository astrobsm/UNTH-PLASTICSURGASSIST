import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { apiClient } from './apiClient';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DutyCategory = 'house_officer' | 'registrar' | 'senior_registrar';

export type DutyType =
  // House Officer duties
  | 'weekly_patient_report'        // Weekly reports on admitted patients 8:30-9 AM
  | 'surgery_scheduling'           // Surgery scheduling and booking
  | 'wound_inspection'             // Wound inspection
  | 'consultant_documentation'     // Documentation for the consultant
  // Registrar duties
  | 'clerking_presentation'        // Clerking and presentation of all new patients
  // Senior Registrar duties
  | 'bedside_debridement'          // Bedside debridements
  | 'intralesional_injection'      // Intralesional triamcinolone injection
  | 'wound_inspection_sr'          // Wound inspections (SR level)
  | 'follow_up_review'             // Review of follow-up patients
  // Generic
  | 'other';

export interface ClinicDutyLog {
  id?: number;
  user_id: string;
  user_name: string;
  user_role: DutyCategory;
  duty_type: DutyType;
  duty_category: DutyCategory;
  patient_id?: string;
  patient_name?: string;
  hospital_number?: string;
  description: string;
  notes?: string;
  status: 'assigned' | 'in_progress' | 'completed' | 'missed' | 'deferred';
  assigned_date: string;      // ISO date
  completed_date?: string;    // ISO date
  duration_minutes?: number;
  week_number: number;
  year: number;
  created_at: string;
}

export interface DutyDefinition {
  type: DutyType;
  label: string;
  description: string;
  category: DutyCategory;
  recurrence: 'daily' | 'weekly' | 'as_needed';
  time_slot?: string;         // e.g. "08:30-09:00"
}

// ─── Duty Definitions ───────────────────────────────────────────────────────

export const DUTY_DEFINITIONS: DutyDefinition[] = [
  // House Officer Duties
  {
    type: 'weekly_patient_report',
    label: 'Weekly Patient Report',
    description: 'Present reports on admitted patients (all house officers, 8:30-9:00 AM)',
    category: 'house_officer',
    recurrence: 'weekly',
    time_slot: '08:30-09:00',
  },
  {
    type: 'surgery_scheduling',
    label: 'Surgery Scheduling & Booking',
    description: 'Schedule and book surgical cases',
    category: 'house_officer',
    recurrence: 'as_needed',
  },
  {
    type: 'wound_inspection',
    label: 'Wound Inspection',
    description: 'Perform wound inspections on assigned patients',
    category: 'house_officer',
    recurrence: 'daily',
  },
  {
    type: 'consultant_documentation',
    label: 'Consultant Documentation',
    description: 'Prepare and complete documentation for the consultant',
    category: 'house_officer',
    recurrence: 'daily',
  },
  // Registrar Duties
  {
    type: 'clerking_presentation',
    label: 'Clerking & Presentation of New Patients',
    description: 'Clerk and present all new patients admitted to the unit',
    category: 'registrar',
    recurrence: 'daily',
  },
  // Senior Registrar Duties
  {
    type: 'bedside_debridement',
    label: 'Bedside Debridement',
    description: 'Perform bedside wound debridements',
    category: 'senior_registrar',
    recurrence: 'as_needed',
  },
  {
    type: 'intralesional_injection',
    label: 'Intralesional Triamcinolone Injection',
    description: 'Administer intralesional triamcinolone injections for keloids / scars',
    category: 'senior_registrar',
    recurrence: 'as_needed',
  },
  {
    type: 'wound_inspection_sr',
    label: 'Wound Inspection (SR)',
    description: 'Supervise and perform wound inspections',
    category: 'senior_registrar',
    recurrence: 'daily',
  },
  {
    type: 'follow_up_review',
    label: 'Follow-up Patient Review',
    description: 'Review follow-up clinic patients',
    category: 'senior_registrar',
    recurrence: 'as_needed',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export function getDutyDefinitionsForRole(role: DutyCategory): DutyDefinition[] {
  return DUTY_DEFINITIONS.filter(d => d.category === role);
}

export function getDutyLabel(type: DutyType): string {
  return DUTY_DEFINITIONS.find(d => d.type === type)?.label || type.replace(/_/g, ' ');
}

// ─── Service ────────────────────────────────────────────────────────────────

class ClinicDutyService {

  // ── Log a duty (create) ────────────────────────────────────────────────

  async logDuty(log: Omit<ClinicDutyLog, 'id' | 'created_at' | 'week_number' | 'year'>): Promise<number> {
    const assignedDate = new Date(log.assigned_date);
    const entry: ClinicDutyLog = {
      ...log,
      week_number: getISOWeek(assignedDate),
      year: assignedDate.getFullYear(),
      created_at: new Date().toISOString(),
    };
    const id = await db.clinic_duty_logs.add(entry as any) as number;
    // Queue for cloud sync
    syncService.queueAction('create', 'clinic_duty_logs', id, { ...entry, id });
    return id;
  }

  // ── Update a duty log ──────────────────────────────────────────────────

  async updateDutyLog(id: number, updates: Partial<ClinicDutyLog>): Promise<void> {
    await db.clinic_duty_logs.update(id, updates as any);
    const updated = await db.clinic_duty_logs.get(id);
    if (updated) syncService.queueAction('update', 'clinic_duty_logs', id, updated);
  }

  // ── Mark as completed ──────────────────────────────────────────────────

  async completeDuty(id: number, notes?: string): Promise<void> {
    await db.clinic_duty_logs.update(id, {
      status: 'completed',
      completed_date: new Date().toISOString(),
      notes: notes || undefined,
    } as any);
    const updated = await db.clinic_duty_logs.get(id);
    if (updated) syncService.queueAction('update', 'clinic_duty_logs', id, updated);
  }

  // ── Get logs filtered ──────────────────────────────────────────────────

  async getLogs(filters?: {
    user_id?: string;
    user_role?: DutyCategory;
    duty_type?: DutyType;
    status?: string;
    week_number?: number;
    year?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<ClinicDutyLog[]> {
    let all = await db.clinic_duty_logs.toArray();

    if (filters) {
      if (filters.user_id) all = all.filter((l: any) => l.user_id === filters.user_id);
      if (filters.user_role) all = all.filter((l: any) => l.user_role === filters.user_role || l.duty_category === filters.user_role);
      if (filters.duty_type) all = all.filter((l: any) => l.duty_type === filters.duty_type);
      if (filters.status) all = all.filter((l: any) => l.status === filters.status);
      if (filters.week_number && filters.year) {
        all = all.filter((l: any) => l.week_number === filters.week_number && l.year === filters.year);
      }
      if (filters.from_date) all = all.filter((l: any) => l.assigned_date >= filters.from_date!);
      if (filters.to_date) all = all.filter((l: any) => l.assigned_date <= filters.to_date!);
    }

    return all.sort((a: any, b: any) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime());
  }

  // ── Weekly summary per user ────────────────────────────────────────────

  async getWeeklySummary(weekNumber: number, year: number): Promise<{
    role: DutyCategory;
    user_name: string;
    user_id: string;
    total: number;
    completed: number;
    missed: number;
    pending: number;
    duties: ClinicDutyLog[];
  }[]> {
    const logs = await this.getLogs({ week_number: weekNumber, year });
    const userMap = new Map<string, ClinicDutyLog[]>();

    for (const log of logs) {
      const key = (log as any).user_id;
      if (!userMap.has(key)) userMap.set(key, []);
      userMap.get(key)!.push(log);
    }

    return Array.from(userMap.entries()).map(([userId, duties]) => {
      const first = duties[0] as any;
      return {
        role: first.user_role || first.duty_category,
        user_name: first.user_name,
        user_id: userId,
        total: duties.length,
        completed: duties.filter((d: any) => d.status === 'completed').length,
        missed: duties.filter((d: any) => d.status === 'missed').length,
        pending: duties.filter((d: any) => d.status === 'assigned' || d.status === 'in_progress').length,
        duties,
      };
    }).sort((a, b) => {
      const roleOrder: Record<string, number> = { senior_registrar: 0, registrar: 1, house_officer: 2 };
      return (roleOrder[a.role] ?? 3) - (roleOrder[b.role] ?? 3) || a.user_name.localeCompare(b.user_name);
    });
  }

  // ── Delete a log entry ─────────────────────────────────────────────────

  async deleteLog(id: number): Promise<void> {
    await db.clinic_duty_logs.delete(id);
  }

  // ── Get staff from API ─────────────────────────────────────────────────

  async getStaffByRole(role: string): Promise<{ id: string; full_name: string; role: string; email?: string }[]> {
    // Handle 'registrar' / 'junior_registrar' equivalence
    const matchRole = (userRole: string) => {
      if (role === 'junior_registrar' || role === 'registrar') {
        return userRole === 'junior_registrar' || userRole === 'registrar';
      }
      return userRole === role;
    };

    try {
      const all = await apiClient.getUsers();
      if (!Array.isArray(all)) return [];
      // Keep the offline mirror warm. Without this write nothing ever populates
      // approved_users, so the catch below always returned [] — a failed fetch
      // rendered as a confident "0 staff, duties redistributed".
      try {
        await db.approved_users.bulkPut(all.map((u: any) => ({
          ...u,
          id: String(u.id),
          full_name: u.full_name || u.name || u.username || 'Unknown',
        })) as any);
      } catch (cacheErr) {
        console.warn('Could not cache staff list for offline use (non-fatal):', cacheErr);
      }
      return all
        .filter((u: any) => matchRole(u.role) && u.is_approved === true && u.is_active === true)
        .map((u: any) => ({
          id: String(u.id),
          full_name: u.full_name || u.name || u.username || 'Unknown',
          role: role === 'junior_registrar' || role === 'registrar' ? 'junior_registrar' : u.role,
          email: u.email,
        }));
    } catch (err) {
      const local = await db.approved_users.filter((u: any) => matchRole(u.role) && u.is_active === true).toArray();
      // An empty mirror means we know nothing about the roster, not that the
      // roster is empty. Propagate so the caller shows "couldn't load" rather
      // than asserting there are no registrars on duty.
      if (local.length === 0) throw err;
      return local.map((u: any) => ({
        id: String(u.id),
        full_name: u.full_name || u.name || 'Unknown',
        role: role === 'junior_registrar' || role === 'registrar' ? 'junior_registrar' : u.role,
        email: u.email,
      }));
    }
  }

  // ── Get current ISO week ───────────────────────────────────────────────
  
  getCurrentWeek(): { week: number; year: number } {
    const now = new Date();
    return { week: getISOWeek(now), year: now.getFullYear() };
  }
}

export const clinicDutyService = new ClinicDutyService();
