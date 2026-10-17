/**
 * Client for /api/clinical-encounters — structured initial clerking,
 * follow-up encounters and the problem list / plan they feed.
 *
 * Saves are never queued for later replay (they are versioned); the forms keep
 * an autosaved copy on the device instead, so nothing is lost offline.
 */
import { apiClient } from './apiClient';
import type { Suggestion } from '../clinical/clerking/types';

export type EncounterStatus = 'draft' | 'pending_review' | 'signed' | 'entered_in_error';

export interface ClinicalEncounter {
  id: number;
  patient_id: string;
  admission_id?: string | null;
  encounter_type: 'initial' | 'follow_up';
  parent_encounter_id?: number | null;
  status: EncounterStatus;
  data: any;
  suggestions: Suggestion[];
  summary: any;
  narrative?: string | null;
  version: number;
  created_by?: number | null;
  created_by_name?: string | null;
  created_by_role?: string | null;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  signed_by_name?: string | null;
  signed_at?: string | null;
  error_reason?: string | null;
}

export interface TrackedProblem {
  id: number; patient_id: string; encounter_id: number; suggestion_id: string; label: string;
  reasons: string[]; dangerous: boolean; source?: string; status: string;
  last_review?: { status?: string; note?: string; at?: string; by?: string } | null;
  created_at: string; updated_at: string;
}

export interface TrackedPlanItem {
  id: number; patient_id: string; encounter_id: number; suggestion_id: string; kind: 'investigation' | 'treatment';
  text: string; reason?: string; priority?: string; source?: string; status: string;
  last_review?: { status?: string; note?: string; at?: string; by?: string } | null;
  created_at: string; updated_at: string;
}

export interface PatientEncounters {
  encounters: ClinicalEncounter[];
  problems: TrackedProblem[];
  plan_items: TrackedPlanItem[];
  can_sign: boolean;
}

const BASE = '/clinical-encounters';

export const clinicalEncounterService = {
  async list(patientId: string): Promise<PatientEncounters> {
    const r = await apiClient.get<PatientEncounters>(`${BASE}?patient_id=${encodeURIComponent(patientId)}`, { freshRead: true });
    return {
      encounters: Array.isArray((r as any)?.encounters) ? r.encounters : [],
      problems: Array.isArray((r as any)?.problems) ? r.problems : [],
      plan_items: Array.isArray((r as any)?.plan_items) ? r.plan_items : [],
      can_sign: !!(r as any)?.can_sign,
    };
  },

  async save(payload: {
    id?: number; version?: number; patient_id: string; admission_id?: string | null;
    encounter_type: 'initial' | 'follow_up'; parent_encounter_id?: number | null;
    data: any; suggestions: Suggestion[]; summary: any; narrative: string;
  }): Promise<ClinicalEncounter> {
    const r = await apiClient.post<{ encounter: ClinicalEncounter }>(`${BASE}?action=save`, payload);
    return r.encounter;
  },

  async submit(id: number, version: number, sign = false): Promise<{ encounter: ClinicalEncounter } & PatientEncounters> {
    return apiClient.post(`${BASE}?action=${sign ? 'sign' : 'submit'}&id=${id}`, { version });
  },

  async markInError(id: number, reason: string): Promise<ClinicalEncounter> {
    const r = await apiClient.post<{ encounter: ClinicalEncounter }>(`${BASE}?action=error&id=${id}`, { reason });
    return r.encounter;
  },

  async updateProblem(id: number, status: string, note?: string) {
    return apiClient.post(`${BASE}?action=problem&id=${id}`, { status, note });
  },

  async updatePlanItem(id: number, status: string, note?: string) {
    return apiClient.post(`${BASE}?action=plan_item&id=${id}`, { status, note });
  },

  async aiSuggest(patientId: string, payload: any): Promise<{ suggestions: Suggestion[]; missing: string[] }> {
    const r = await apiClient.post<{ suggestions: Suggestion[]; missing: string[] }>(`${BASE}?action=suggest`, { patient_id: patientId, payload });
    return { suggestions: Array.isArray(r?.suggestions) ? r.suggestions : [], missing: Array.isArray(r?.missing) ? r.missing : [] };
  },
};

/** Autosaved drafts on this device, per patient and encounter type. */
export const localDraft = {
  key: (patientId: string, type: string) => `clerking-draft:${patientId}:${type}`,
  load<T>(patientId: string, type: string): T | null {
    try { const raw = localStorage.getItem(this.key(patientId, type)); return raw ? JSON.parse(raw) : null; } catch { return null; }
  },
  save(patientId: string, type: string, value: unknown) {
    try { localStorage.setItem(this.key(patientId, type), JSON.stringify({ ...(value as any), savedAt: new Date().toISOString() })); } catch { /* storage full / blocked */ }
  },
  clear(patientId: string, type: string) {
    try { localStorage.removeItem(this.key(patientId, type)); } catch { /* ignore */ }
  },
};
