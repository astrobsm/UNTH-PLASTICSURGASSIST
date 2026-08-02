/**
 * Staff absence service — leave and outside postings.
 *
 * Thin client over /api/staff-absences. All the redistribution logic is
 * server-side in api/_lib/staffAbsence.js, which is correct: moving patients
 * between clinicians must happen once, transactionally, against the source of
 * truth — not per-device where two tabs could each do it.
 */

import { apiClient } from './apiClient';

export type AbsenceType =
  | 'annual_leave'
  | 'sick_leave'
  | 'conference'
  | 'outside_posting'
  | 'study_leave'
  | 'other';

export type AbsenceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  annual_leave: 'Annual leave',
  sick_leave: 'Sick leave',
  conference: 'Conference / course',
  outside_posting: 'Outside posting',
  study_leave: 'Study leave',
  other: 'Other',
};

export interface StaffAbsence {
  id: number;
  user_id: string;
  user_name?: string;
  user_role?: string;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  status: AbsenceStatus;
  reason?: string;
  notes?: string;
  patients_reassigned: number;
  call_duties_reassigned: number;
  clinic_duties_reassigned: number;
  patients_restored: number;
  activated_at?: string;
  completed_at?: string;
  created_at?: string;
}

export interface AbsenceReassignment {
  id: number;
  absence_id: number;
  entity_type: 'patient_assignment' | 'call_duty' | 'clinic_duty';
  entity_id: string;
  role_column?: string;
  from_user_id?: string;
  to_user_id?: string;
  from_name?: string;
  to_name?: string;
  restored: boolean;
  restored_at?: string;
}

const BASE = '/staff-absences';

export async function listAbsences(userId?: string | number): Promise<StaffAbsence[]> {
  const qs = userId ? `?userId=${encodeURIComponent(String(userId))}` : '';
  const res: any = await apiClient.get(`${BASE}${qs}`);
  return res?.absences || [];
}

/** Who is away right now, plus the raw id list for quick membership checks. */
export async function getActiveAbsences(): Promise<{ absences: StaffAbsence[]; absentUserIds: string[] }> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=active`);
    return { absences: res?.absences || [], absentUserIds: res?.absentUserIds || [] };
  } catch {
    // Offline: absence status is unknown rather than false. Callers show the
    // badge only when we positively know someone is away.
    return { absences: [], absentUserIds: [] };
  }
}

/**
 * Who will be away on a specific date.
 *
 * Rosters are drawn up in advance, so a clinic or call list for a future date
 * must count absences that are still `scheduled` as well as active ones —
 * asking only "who is away right now" is what put a clinician on leave onto a
 * future clinic day.
 *
 * Returns an empty list when offline or on error. That is a deliberate
 * fail-open: showing a full roster is a smaller harm than hiding staff who are
 * actually available because the check could not be made.
 */
export async function getAbsentUserIdsOn(dateISO: string): Promise<{ ids: string[]; absences: StaffAbsence[] }> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=absent-on&date=${encodeURIComponent(dateISO)}`);
    return { ids: (res?.absentUserIds || []).map(String), absences: res?.absences || [] };
  } catch {
    return { ids: [], absences: [] };
  }
}

export async function getAbsenceDetail(
  id: number
): Promise<{ absence: StaffAbsence; reassignments: AbsenceReassignment[] } | null> {
  try {
    const res: any = await apiClient.get(`${BASE}?action=detail&id=${id}`);
    return res?.absence ? res : null;
  } catch {
    return null;
  }
}

export interface CreateAbsenceInput {
  user_id: string | number;
  absence_type: AbsenceType;
  start_date: string;
  end_date: string;
  reason?: string;
  notes?: string;
}

export async function createAbsence(input: CreateAbsenceInput): Promise<{ absence: StaffAbsence; effect: any }> {
  const res: any = await apiClient.post(BASE, input);
  return { absence: res?.absence, effect: res?.effect || null };
}

export async function updateAbsence(id: number, patch: Partial<CreateAbsenceInput>): Promise<StaffAbsence> {
  const res: any = await apiClient.put(`${BASE}?id=${id}`, patch);
  return res?.absence;
}

/** Start a scheduled absence before its start date. */
export async function startAbsenceNow(id: number): Promise<{ absence: StaffAbsence; effect: any }> {
  const res: any = await apiClient.put(`${BASE}?action=start&id=${id}`, {});
  return { absence: res?.absence, effect: res?.effect };
}

/** End an active absence early — the staff member is back. */
export async function endAbsenceNow(id: number): Promise<{ absence: StaffAbsence; effect: any }> {
  const res: any = await apiClient.put(`${BASE}?action=end&id=${id}`, {});
  return { absence: res?.absence, effect: res?.effect };
}

export async function cancelAbsence(id: number): Promise<void> {
  await apiClient.delete(`${BASE}?id=${id}`);
}

/** Human summary of what an absence moved, for toasts and the table. */
export function describeEffect(effect: any): string {
  if (!effect) return '';
  if (effect.alreadyActive) return 'Already active';
  const parts: string[] = [];
  if (effect.patients) parts.push(`${effect.patients} patient${effect.patients === 1 ? '' : 's'}`);
  if (effect.callDuties) parts.push(`${effect.callDuties} call dut${effect.callDuties === 1 ? 'y' : 'ies'}`);
  if (effect.clinicDuties) parts.push(`${effect.clinicDuties} clinic dut${effect.clinicDuties === 1 ? 'y' : 'ies'}`);
  if (effect.restored !== undefined) {
    const back = `${effect.restored} patient${effect.restored === 1 ? '' : 's'} returned`;
    return effect.levelled ? `${back}, ${effect.levelled} levelled` : back;
  }
  return parts.length ? `Reassigned ${parts.join(', ')}` : 'Nothing needed reassigning';
}
