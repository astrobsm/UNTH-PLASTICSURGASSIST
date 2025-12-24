import { db } from '../db/database';
import { apiClient } from './apiClient';

// Helper for authenticated fetch requests
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = apiClient.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
};

export interface UserActivity {
  id?: string;
  user_id: string;
  user_name: string;
  user_role: 'consultant' | 'registrar' | 'house_officer';
  activity_type: 'ward_round' | 'patient_registration' | 'treatment_plan' | 'surgery_booking' | 'lab_request' | 'prescription' | 'discharge' | 'admission' | 'blood_transfusion' | 'preop_assessment';
  activity_subtype?: string;
  patient_id?: string;
  patient_name?: string;
  hospital_number?: string;
  timestamp: Date;
  duration_minutes?: number; // Time spent on activity
  quality_score?: number; // 0-100
  completeness_score?: number; // 0-100
  notes?: string;
}

export interface UserPerformanceMetrics {
  user_id: string;
  user_name: string;
  user_role: string;
  period: 'day' | 'week' | 'month' | 'year';
  start_date: Date;
  end_date: Date;
  total_activities: number;
  activities_by_type: Record<string, number>;
  patients_seen: number;
  ward_rounds_completed: number;
  treatment_plans_created: number;
  prescriptions_written: number;
  surgeries_assisted: number;
  average_quality_score: number;
  average_completeness_score: number;
  average_response_time_minutes: number;
  compliance_score: number; // Percentage of required activities completed
}

export interface DepartmentMetrics {
  period: 'day' | 'week' | 'month' | 'year';
  start_date: Date;
  end_date: Date;
  total_patients: number;
  new_admissions: number;
  discharges: number;
  active_patients: number;
  ward_rounds_total: number;
  surgeries_performed: number;
  consultations: number;
  average_los_days: number; // Length of stay
  user_performance: UserPerformanceMetrics[];
}

class AnalyticsService {
  /**
   * Log a user activity
   */
  async logActivity(activity: Omit<UserActivity, 'id' | 'timestamp'>): Promise<string> {
    const activityRecord: UserActivity = {
      ...activity,
      timestamp: new Date()
    };

    // Store in IndexedDB
    const id = await db.transaction('rw', db.ward_rounds_clinical, async () => {
      // We'll use a separate activities table, but for now store in ward_rounds_clinical
      // You might want to create a dedicated user_activities table
      return crypto.randomUUID();
    });

    // Also send to backend for permanent storage
    try {
      await authenticatedFetch('/api/analytics/activities', {
        method: 'POST',
        body: JSON.stringify(activityRecord)
      });
    } catch (error) {
      console.error('Failed to sync activity to backend:', error);
    }

    return id;
  }

  /**
   * Get user performance metrics for a specific period
   */
  async getUserPerformance(
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'week'
  ): Promise<UserPerformanceMetrics | null> {
    try {
      const response = await authenticatedFetch(
        `/api/analytics/user-performance?userId=${userId}&period=${period}`
      );

      if (!response.ok) throw new Error('Failed to fetch user performance');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user performance:', error);
      return null;
    }
  }

  /**
   * Get all users' performance metrics
   */
  async getAllUsersPerformance(
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<UserPerformanceMetrics[]> {
    try {
      const response = await authenticatedFetch(
        `/api/analytics/all-users-performance?period=${period}`
      );

      if (!response.ok) throw new Error('Failed to fetch all users performance');
      return await response.json();
    } catch (error) {
      console.error('Error fetching all users performance:', error);
      return [];
    }
  }

  /**
   * Get department-wide metrics
   */
  async getDepartmentMetrics(
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<DepartmentMetrics | null> {
    try {
      const response = await authenticatedFetch(
        `/api/analytics/department-metrics?period=${period}`
      );

      if (!response.ok) throw new Error('Failed to fetch department metrics');
      return await response.json();
    } catch (error) {
      console.error('Error fetching department metrics:', error);
      return null;
    }
  }

  /**
   * Get activities for a specific user
   */
  async getUserActivities(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<UserActivity[]> {
    try {
      const params = new URLSearchParams({ userId });
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const response = await authenticatedFetch(
        `/api/analytics/user-activities?${params.toString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch user activities');
      return await response.json();
    } catch (error) {
      console.error('Error fetching user activities:', error);
      return [];
    }
  }

  /**
   * Get comparative performance (house officers vs registrars)
   */
  async getComparativePerformance(
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<{ houseOfficers: UserPerformanceMetrics[], registrars: UserPerformanceMetrics[] }> {
    try {
      const response = await authenticatedFetch(
        `/api/analytics/comparative-performance?period=${period}`
      );

      if (!response.ok) throw new Error('Failed to fetch comparative performance');
      return await response.json();
    } catch (error) {
      console.error('Error fetching comparative performance:', error);
      return { houseOfficers: [], registrars: [] };
    }
  }

  /**
   * Get activity trends over time
   */
  async getActivityTrends(
    userId?: string,
    days: number = 30
  ): Promise<Array<{ date: string; count: number; type: string }>> {
    try {
      const params = new URLSearchParams({ days: days.toString() });
      if (userId) params.append('userId', userId);

      const response = await authenticatedFetch(
        `/api/analytics/activity-trends?${params.toString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch activity trends');
      return await response.json();
    } catch (error) {
      console.error('Error fetching activity trends:', error);
      return [];
    }
  }

  /**
   * Calculate quality score based on completeness and timeliness
   */
  calculateQualityScore(
    completeness: number,
    timelinessMinutes: number,
    expectedMinutes: number
  ): number {
    const completenessWeight = 0.7;
    const timelinessWeight = 0.3;

    const timelinessScore = Math.max(
      0,
      100 - ((timelinessMinutes - expectedMinutes) / expectedMinutes) * 50
    );

    return Math.round(
      completeness * completenessWeight + timelinessScore * timelinessWeight
    );
  }

  /**
   * Get leaderboard for gamification
   */
  async getLeaderboard(
    period: 'week' | 'month' | 'year' = 'month',
    role?: 'house_officer' | 'registrar'
  ): Promise<Array<{
    rank: number;
    user_id: string;
    user_name: string;
    user_role: string;
    score: number;
    activities: number;
    quality_avg: number;
  }>> {
    try {
      const params = new URLSearchParams({ period });
      if (role) params.append('role', role);

      const response = await authenticatedFetch(
        `/api/analytics/leaderboard?${params.toString()}`
      );

      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      return await response.json();
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }
}

export const analyticsService = new AnalyticsService();
