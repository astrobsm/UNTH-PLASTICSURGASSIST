/**
 * The outcome of a pre-surgical brief: what was decided, and who has to do it.
 *
 * The conference module presents a patient. This is the half that survives the
 * meeting — the pre-op, intra-op, contingency and post-op plans, the clearance
 * decision, and the tasks that come out of it, each assigned to a named person
 * and tracked to completion.
 */

import { apiClient } from './apiClient';

export type BriefPhase = 'preop' | 'intraop' | 'postop';
export type BriefTaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export const BRIEF_PHASES: { value: BriefPhase; label: string }[] = [
  { value: 'preop', label: 'Pre-operative' },
  { value: 'intraop', label: 'Intra-operative' },
  { value: 'postop', label: 'Post-operative' },
];

export const BRIEF_TASK_STATUSES: { value: BriefTaskStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

export interface BriefOutcome {
  id: number;
  patient_id: number;
  surgery_id: number | null;
  preop_plan: string | null;
  intraop_plan: string | null;
  contingency_plan: string | null;
  postop_plan: string | null;
  additional_comments: string | null;
  /** null until a consultant has recorded a decision either way. */
  cleared_for_surgery: boolean | null;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BriefTask {
  id: number;
  brief_id: number;
  patient_id: number | null;
  phase: BriefPhase;
  description: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  due_at: string | null;
  status: BriefTaskStatus;
  completed_at: string | null;
  completed_by_name: string | null;
  created_at: string;
}

export interface BriefBundle {
  brief: BriefOutcome | null;
  tasks: BriefTask[];
}

const base = '/pre-surgical-brief';

class PreSurgicalBriefService {
  /** The brief and its tasks. A patient with no brief yet returns nulls, not an error. */
  async get(patientId: string | number): Promise<BriefBundle> {
    const data = await apiClient.get<BriefBundle>(`${base}/${patientId}`);
    return { brief: data?.brief ?? null, tasks: Array.isArray(data?.tasks) ? data.tasks : [] };
  }

  /**
   * Write the agreed plans.
   *
   * Only the fields passed are sent, so two people editing different sections
   * of the same brief do not overwrite each other with blanks.
   */
  async savePlans(
    patientId: string | number,
    plans: Partial<Pick<BriefOutcome,
      'preop_plan' | 'intraop_plan' | 'contingency_plan' | 'postop_plan' | 'additional_comments'>>
  ): Promise<BriefBundle> {
    return apiClient.post<BriefBundle>(`${base}/${patientId}`, plans);
  }

  /** Record the clearance decision. The server refuses this for non-consultants. */
  async approve(patientId: string | number, clearedForSurgery: boolean): Promise<BriefBundle> {
    return apiClient.post<BriefBundle>(`${base}/${patientId}/approve`, {
      cleared_for_surgery: clearedForSurgery,
    });
  }

  async addTask(
    patientId: string | number,
    task: { description: string; phase: BriefPhase; assigned_to?: number | null; due_at?: string | null }
  ): Promise<{ task: BriefTask }> {
    return apiClient.post<{ task: BriefTask }>(`${base}/${patientId}/tasks`, task);
  }

  async updateTask(
    patientId: string | number,
    taskId: number,
    changes: Partial<Pick<BriefTask, 'status' | 'description' | 'phase' | 'assigned_to' | 'due_at'>>
  ): Promise<{ task: BriefTask | null; tasks: BriefTask[] }> {
    return apiClient.request<{ task: BriefTask | null; tasks: BriefTask[] }>(
      `${base}/${patientId}/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(changes) }
    );
  }
}

export const preSurgicalBriefService = new PreSurgicalBriefService();
export default preSurgicalBriefService;
