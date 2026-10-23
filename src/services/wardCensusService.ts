/** Client for /api/ward-census — the shareable "who is still on admission" check. */
import { apiClient } from './apiClient';

export const CENSUS_REASONS: { value: string; label: string }[] = [
  { value: 'discharged', label: 'Discharged home' },
  { value: 'transferred', label: 'Transferred out' },
  { value: 'died', label: 'Died' },
  { value: 'lama', label: 'Left against medical advice' },
  { value: 'absconded', label: 'Absconded' },
  { value: 'never_admitted', label: 'Never actually admitted' },
  { value: 'other', label: 'Other (say what)' },
];
export const reasonLabel = (v: string) => CENSUS_REASONS.find(r => r.value === v)?.label || v;

export interface CensusRound {
  id: string; title: string; ward_filter?: string | null; status: string;
  created_by_name?: string | null; created_at: string; expires_at?: string | null;
  submissions?: number; pending?: number; discharged?: number;
}
export interface CensusPatient {
  admission_id: number; patient_id: number | null; patient_name: string; hospital_number?: string | null;
  ward?: string | null; bed_number?: string | null; admission_date?: string | null; status: string;
  admitting_diagnosis?: string | null; adm_primary_diagnosis?: string | null; gender?: string | null;
}
export interface CensusReport {
  id: number; admission_id: number; reason: string; left_date?: string | null; note?: string | null;
  reported_by_name?: string | null; reported_by_role?: string | null; reported_at: string;
  decision: 'pending' | 'discharged' | 'kept'; decided_by_name?: string | null; decided_at?: string | null;
  admission_status: string; ward?: string | null; bed_number?: string | null; admission_date?: string | null;
  patient_name: string; hospital_number?: string | null;
}

const BASE = '/ward-census';
const fresh = { freshRead: true } as any;

export const wardCensusService = {
  link: (id: string) => `${window.location.origin}/ward-census/${id}`,
  list: (): Promise<{ rounds: CensusRound[] }> => apiClient.get(`${BASE}?list=1`, fresh),
  create: (b: { title?: string; ward?: string; days_valid?: number }): Promise<{ round: CensusRound }> =>
    apiClient.post(`${BASE}?action=create`, b),
  form: (id: string): Promise<{ round: CensusRound; patients: CensusPatient[]; flagged: { admission_id: number; reason: string; reported_by_name: string; reported_at: string }[] }> =>
    apiClient.get(`${BASE}?round=${encodeURIComponent(id)}`, fresh),
  submit: (id: string, b: { items: { admission_id: number; reason: string; left_date?: string; note?: string }[]; shown_count: number; note?: string; ward?: string }) =>
    apiClient.post(`${BASE}?action=submit&round=${encodeURIComponent(id)}`, b),
  review: (id: string): Promise<{ round: CensusRound; on_admission: number; patients: CensusPatient[]; reports: CensusReport[]; submissions: any[]; open: boolean }> =>
    apiClient.get(`${BASE}?review=${encodeURIComponent(id)}`, fresh),
  discharge: (id: string, admission_ids: number[]): Promise<{ discharged: number; skipped: number; on_admission: number }> =>
    apiClient.post(`${BASE}?action=discharge&round=${encodeURIComponent(id)}`, { admission_ids }),
  keep: (id: string, admission_ids: number[]): Promise<{ kept: number }> =>
    apiClient.post(`${BASE}?action=keep&round=${encodeURIComponent(id)}`, { admission_ids }),
  close: (id: string) => apiClient.post(`${BASE}?action=close&round=${encodeURIComponent(id)}`, {}),
};
