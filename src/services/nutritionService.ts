/**
 * Client for /api/nutrition. Assessments and plans are versioned: a save that
 * races another clinician's edit is refused with the current record rather
 * than silently overwriting it.
 */
import { apiClient } from './apiClient';
import type { StoredMeasurement } from '../clinical/nutrition/fromRecord';

export type RecordStatus = 'draft' | 'pending_review' | 'approved' | 'superseded' | 'entered_in_error';

interface Versioned {
  id: number;
  patient_id: string;
  status: RecordStatus;
  config_version: string;
  version: number;
  created_by_name?: string | null;
  created_by_role?: string | null;
  created_at: string;
  updated_at: string;
  approved_by_name?: string | null;
  approved_by_role?: string | null;
  approved_at?: string | null;
  error_reason?: string | null;
}
export interface NutritionAssessmentRecord extends Versioned { inputs: any; result: any; summary: any }
export interface MealPlanRecord extends Versioned { assessment_id?: number | null; targets: any; plan: any; solver: any; food_data_version?: string | null }
export interface IntakeRecord {
  id: number; patient_id: string; intake_date: string; meal: string; plan_id?: number | null; items: any[];
  kcal: number; protein_g: number; target_kcal?: number | null; target_protein_g?: number | null; note?: string | null; recorded_by_name?: string | null;
}
export interface Permissions { can_approve: boolean; can_draft: boolean; can_admin_foods: boolean }
export interface PatientNutrition extends Permissions {
  measurements: StoredMeasurement[];
  assessments: NutritionAssessmentRecord[];
  meal_plans: MealPlanRecord[];
  intake: IntakeRecord[];
}

const BASE = '/nutrition';
const arr = <T,>(x: any): T[] => (Array.isArray(x) ? x : []);

export const nutritionService = {
  async patient(patientId: string): Promise<PatientNutrition> {
    const r: any = await apiClient.get(`${BASE}?patient_id=${encodeURIComponent(patientId)}`, { freshRead: true });
    return {
      measurements: arr<StoredMeasurement>(r?.measurements).map(m => ({ ...m, value: Number(m.value) })),
      assessments: arr(r?.assessments), meal_plans: arr(r?.meal_plans),
      intake: arr<IntakeRecord>(r?.intake).map(x => ({ ...x, kcal: Number(x.kcal), protein_g: Number(x.protein_g) })),
      can_approve: !!r?.can_approve, can_draft: !!r?.can_draft, can_admin_foods: !!r?.can_admin_foods,
    };
  },
  async worklist() { return apiClient.get<any>(`${BASE}?resource=worklist`, { freshRead: true }); },

  async addMeasurement(m: { patient_id: string; kind: string; value: number; method?: string; measured_at?: string; note?: string }) {
    return (await apiClient.post<any>(`${BASE}?action=measurement`, m)).measurement as StoredMeasurement;
  },
  async measurementInError(id: number, reason: string) { return apiClient.post(`${BASE}?action=measurement_error&id=${id}`, { reason }); },
  async saveIntake(x: Omit<IntakeRecord, 'id' | 'recorded_by_name'>) { return (await apiClient.post<any>(`${BASE}?action=intake`, x)).intake as IntakeRecord; },

  async saveAssessment(x: { id?: number; version?: number; patient_id: string; config_version: string; inputs: any; result: any; summary: any }) {
    return (await apiClient.post<any>(`${BASE}?action=save&kind=assessment`, x)).record as NutritionAssessmentRecord;
  },
  async savePlan(x: { id?: number; version?: number; patient_id: string; assessment_id?: number | null; config_version: string; food_data_version?: string; targets: any; plan: any; solver: any }) {
    return (await apiClient.post<any>(`${BASE}?action=save&kind=plan`, x)).record as MealPlanRecord;
  },
  async submit(kind: 'assessment' | 'plan', id: number, version: number) { return (await apiClient.post<any>(`${BASE}?action=submit&kind=${kind}&id=${id}`, { version })).record; },
  async approve(kind: 'assessment' | 'plan', id: number, version: number) { return (await apiClient.post<any>(`${BASE}?action=approve&kind=${kind}&id=${id}`, { version })).record; },
  async markInError(kind: 'assessment' | 'plan', id: number, reason: string) { return (await apiClient.post<any>(`${BASE}?action=error&kind=${kind}&id=${id}`, { reason })).record; },

  async foods(q = '', limit = 50) { return arr<any>((await apiClient.get<any>(`${BASE}?resource=foods&q=${encodeURIComponent(q)}&limit=${limit}`))?.foods); },
  async recipes() { return arr<any>((await apiClient.get<any>(`${BASE}?resource=recipes`))?.recipes); },
  async measures() { return arr<any>((await apiClient.get<any>(`${BASE}?resource=measures`))?.measures); },
  async sources(): Promise<{ sources: any[]; missing_local: string[]; seed_version?: string } & Permissions> {
    const r: any = await apiClient.get(`${BASE}?resource=sources`, { freshRead: true });
    return { sources: arr(r?.sources), missing_local: arr(r?.missing_local), seed_version: r?.seed_version, can_approve: !!r?.can_approve, can_draft: !!r?.can_draft, can_admin_foods: !!r?.can_admin_foods };
  },
  async seedWafct() { return apiClient.post<{ imported: number; rejected: any[] }>(`${BASE}?action=seed_wafct`, {}); },
  async seedEnugu() { return apiClient.post<{ recipes: number; measures: number; missing: string[] }>(`${BASE}?action=seed_enugu`, {}); },
  async signoffs() { return arr<any>((await apiClient.get<any>(`${BASE}?resource=signoffs`))?.signoffs); },
  async importFoods(source: { code: string; name: string; version?: string; licence?: string; url?: string }, rows: any[]) {
    return apiClient.post<{ imported: number; rejected: any[] }>(`${BASE}?action=import_foods`, { source, rows });
  },
  async updateFood(id: number, fields: any) { return apiClient.post(`${BASE}?action=food&id=${id}`, fields); },
  async saveRecipe(r: any) { return apiClient.post(`${BASE}?action=recipe`, r); },
  async verifyRecipe(id: number) { return apiClient.post(`${BASE}?action=recipe_verify&id=${id}`, {}); },
  async saveMeasure(m: any) { return apiClient.post(`${BASE}?action=measure`, m); },
  async signConfig(version: string, note?: string) { return apiClient.post(`${BASE}?action=sign_config`, { version, note }); },
};
