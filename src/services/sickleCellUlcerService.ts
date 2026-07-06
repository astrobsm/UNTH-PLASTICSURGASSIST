import { apiClient } from './apiClient';

export interface SickleCellUlcerAssessment {
  id?: number;
  patient_id: string;
  patient_name?: string;
  hospital_number?: string;
  scores: Record<string, number>;
  total_score: number;
  max_score: number;
  readiness: string;
  wound_bed?: string;
  wound_agents?: string[];
  recommendations?: string[];
  notes?: string;
  assessed_by_name?: string;
  created_at?: string;
}

class SickleCellUlcerService {
  async getAssessments(patientId: string | number): Promise<SickleCellUlcerAssessment[]> {
    try {
      const data = await apiClient.request(`/sickle-cell-ulcer?patientId=${patientId}`);
      return data.assessments || [];
    } catch (e) {
      console.error('getAssessments (sickle cell ulcer):', e);
      return [];
    }
  }

  async saveAssessment(payload: SickleCellUlcerAssessment): Promise<SickleCellUlcerAssessment | null> {
    const data = await apiClient.request('/sickle-cell-ulcer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.assessment || null;
  }

  async deleteAssessment(id: number): Promise<void> {
    await apiClient.request(`/sickle-cell-ulcer?id=${id}`, { method: 'DELETE' });
  }
}

export const sickleCellUlcerService = new SickleCellUlcerService();
