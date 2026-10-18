/** Client for /api/scribe-plans — the scribe's draft plans and their consultant approval. */
import { apiClient } from '../apiClient';
import type { ScribePlan, ScribeFinding } from './scribePlan';
import type { LoggedAction } from './planItems';

export type ScribePlanStatus = 'pending_approval' | 'approved' | 'rejected' | 'superseded';

export interface StoredScribePlan {
  id: number;
  patient_id: string;
  version: number;
  status: ScribePlanStatus;
  plan: ScribePlan;
  approved_plan?: ScribePlan | null;
  findings: ScribeFinding[];
  generated_by_name?: string | null;
  generated_at: string;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  treatment_plan_id?: number | null;
  first_name?: string; last_name?: string; hospital_number?: string;
}

const BASE = '/scribe-plans';

export const scribePlanService = {
  async forPatient(patientId: string): Promise<{ plans: StoredScribePlan[]; actions: LoggedAction[]; can_approve: boolean; can_log: boolean }> {
    const r: any = await apiClient.get(`${BASE}?patient_id=${encodeURIComponent(patientId)}`, { freshRead: true } as any);
    return {
      plans: Array.isArray(r?.plans) ? r.plans : [],
      actions: Array.isArray(r?.actions) ? r.actions : [],
      can_approve: !!r?.can_approve, can_log: r?.can_log !== false,
    };
  },
  async pending(): Promise<{ plans: StoredScribePlan[]; can_approve: boolean }> {
    const r: any = await apiClient.get(`${BASE}?pending=1`, { freshRead: true } as any);
    return { plans: Array.isArray(r?.plans) ? r.plans : [], can_approve: !!r?.can_approve };
  },
  async submit(patientId: string, plan: ScribePlan, findings: ScribeFinding[]): Promise<StoredScribePlan> {
    const r: any = await apiClient.post(`${BASE}?action=submit`, { patient_id: patientId, plan, findings, basis: plan.basis });
    return r.plan;
  },
  async approve(id: number, plan?: ScribePlan, note?: string): Promise<{ plan: StoredScribePlan; treatment_plan_id: number | null }> {
    return apiClient.post(`${BASE}?action=approve&id=${id}`, { plan, note });
  },
  async reject(id: number, note: string): Promise<{ plan: StoredScribePlan }> {
    return apiClient.post(`${BASE}?action=reject&id=${id}`, { note });
  },
};
