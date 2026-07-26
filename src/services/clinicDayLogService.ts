import { apiClient } from './apiClient';
import { dutyLabel } from '../config/clinicDuties';

/**
 * Clinic Day Log — what each member of the unit actually did on a given day.
 * Server-backed (Postgres) so the day's log is the same on every device; there
 * is deliberately no local-only write path, because a duty record that exists on
 * one phone and nowhere else is worse than no record.
 */

export interface ClinicDayLog {
  id?: number;
  log_date: string;            // YYYY-MM-DD
  user_id: string;
  user_name?: string;
  user_role?: string;
  duty_type: string;
  duty_label?: string;
  quantity: number;
  patient_id?: string | null;
  hospital_number?: string | null;
  patient_name?: string | null;
  location?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DayLogSummary {
  start: string;
  end: string;
  byUser: Array<{ user_id: string; user_name: string; user_role: string; total: number; days_logged: number }>;
  byDuty: Array<{ duty_type: string; duty_label: string; total: number }>;
  byUserDuty: Array<{ user_id: string; user_name: string; duty_type: string; duty_label: string; total: number }>;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

class ClinicDayLogService {
  /** Entries for one day (default today), optionally for a single person. */
  async getForDate(date: string = todayISO(), userId?: string): Promise<ClinicDayLog[]> {
    const qs = new URLSearchParams({ date });
    if (userId) qs.set('user_id', userId);
    const data: any = await apiClient.get(`/clinic-day-logs?${qs.toString()}`, { freshRead: true } as any);
    return (data?.logs || []) as ClinicDayLog[];
  }

  /** Entries across a date range. */
  async getForRange(start: string, end: string, userId?: string): Promise<ClinicDayLog[]> {
    const qs = new URLSearchParams({ start, end });
    if (userId) qs.set('user_id', userId);
    const data: any = await apiClient.get(`/clinic-day-logs?${qs.toString()}`, { freshRead: true } as any);
    return (data?.logs || []) as ClinicDayLog[];
  }

  async getSummary(start: string, end: string): Promise<DayLogSummary> {
    const qs = new URLSearchParams({ action: 'summary', start, end });
    return await apiClient.get(`/clinic-day-logs?${qs.toString()}`, { freshRead: true } as any);
  }

  async add(entry: Omit<ClinicDayLog, 'id' | 'user_id'> & { user_id?: string }): Promise<ClinicDayLog> {
    const data: any = await apiClient.post('/clinic-day-logs', {
      ...entry,
      duty_label: entry.duty_label || dutyLabel(entry.duty_type),
    });
    return data.log as ClinicDayLog;
  }

  async update(id: number, changes: Partial<ClinicDayLog>): Promise<ClinicDayLog> {
    const data: any = await apiClient.put('/clinic-day-logs', { id, ...changes });
    return data.log as ClinicDayLog;
  }

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/clinic-day-logs?id=${encodeURIComponent(String(id))}`);
  }
}

export const clinicDayLogService = new ClinicDayLogService();
