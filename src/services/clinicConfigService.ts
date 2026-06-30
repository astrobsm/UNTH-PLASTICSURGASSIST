// Clinic configuration & queue service — Phase 1 appointment redesign.
// Wraps the /clinic-appointments endpoints for configurable stations,
// patient categories, doctor unavailability, and queue analytics.
import { apiClient } from './apiClient';

export interface ClinicDayConfig {
  enabled: boolean;
  stations: number;
  doctors: string[];
  sessions: { label?: string; start: string; end: string }[];
  slotMinutes?: number;
}

export interface ClinicConfig {
  slotMinutes: number;
  holidays: string[];
  days: Record<string, ClinicDayConfig>; // key = day-of-week '0'..'6'
}

export interface ClinicCategory {
  id?: number;
  name: string;
  duration_minutes: number;
  priority: number; // 1 = highest
  color: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface DoctorUnavailability {
  id: number;
  doctor_name: string;
  unavailable_date: string;
  reason?: string;
}

export interface StationQueue {
  station: number;
  doctor: string;
  total: number;
  waiting: number;
  inProgress: number;
  completed: number;
  noShow: number;
}

export interface QueueStats {
  date: string;
  dayName: string;
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  avgWaitMinutes: number | null;
  stations: StationQueue[];
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

class ClinicConfigService {
  async getConfig(): Promise<ClinicConfig> {
    const data = await apiClient.request('/clinic-appointments/config');
    return data.config;
  }

  async saveConfig(config: ClinicConfig): Promise<ClinicConfig> {
    const data = await apiClient.request('/clinic-appointments/config', {
      method: 'POST',
      body: JSON.stringify({ config }),
    });
    return data.config;
  }

  async getCategories(): Promise<ClinicCategory[]> {
    const data = await apiClient.request('/clinic-appointments/categories');
    return data.categories || [];
  }

  async saveCategory(cat: ClinicCategory): Promise<ClinicCategory> {
    const method = cat.id ? 'PATCH' : 'POST';
    const data = await apiClient.request('/clinic-appointments/categories', {
      method,
      body: JSON.stringify(cat),
    });
    return data.category;
  }

  async deleteCategory(id: number): Promise<void> {
    await apiClient.request(`/clinic-appointments/categories?id=${id}`, { method: 'DELETE' });
  }

  async getUnavailability(from?: string, to?: string): Promise<DoctorUnavailability[]> {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const data = await apiClient.request(`/clinic-appointments/unavailability${qs ? `?${qs}` : ''}`);
    return data.unavailability || [];
  }

  async addUnavailability(doctor_name: string, unavailable_date: string, reason?: string): Promise<DoctorUnavailability> {
    const data = await apiClient.request('/clinic-appointments/unavailability', {
      method: 'POST',
      body: JSON.stringify({ doctor_name, unavailable_date, reason }),
    });
    return data.unavailability;
  }

  async removeUnavailability(id: number): Promise<void> {
    await apiClient.request(`/clinic-appointments/unavailability?id=${id}`, { method: 'DELETE' });
  }

  async getQueueStats(date: string): Promise<QueueStats> {
    const data = await apiClient.request(`/clinic-appointments/queue-stats?date=${date}`);
    return data;
  }
}

export const clinicConfigService = new ClinicConfigService();
