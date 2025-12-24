import { db } from '../db/database';
import { differenceInDays, differenceInHours, differenceInMinutes, format } from 'date-fns';
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

export interface AdmissionTracking {
  id?: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  admission_date: Date;
  expected_discharge_date?: Date;
  actual_discharge_date?: Date;
  ward_location: string;
  admission_diagnosis: string;
  status: 'active' | 'pending_discharge' | 'discharged';
  length_of_stay_days: number;
  length_of_stay_hours: number;
  updated_at: Date;
  created_at: Date;
}

export interface TreatmentPlanExecution {
  id?: string;
  patient_id: string;
  treatment_plan_id: string;
  plan_title: string;
  total_steps: number;
  completed_steps: number;
  pending_steps: number;
  overdue_steps: number;
  completion_percentage: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  start_date: Date;
  planned_end_date?: Date;
  actual_end_date?: Date;
  days_elapsed: number;
  days_remaining?: number;
  is_on_schedule: boolean;
  last_updated: Date;
}

export interface PatientAdmissionStatus {
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  admission: AdmissionTracking | null;
  treatment_plans: TreatmentPlanExecution[];
  current_status: 'admitted' | 'not_admitted';
  overall_progress: number;
  alerts: Array<{
    type: 'overdue_step' | 'long_stay' | 'delayed_plan' | 'pending_discharge';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }>;
}

class AdmissionTrackingService {
  /**
   * Calculate length of stay in days and hours
   */
  calculateLengthOfStay(admissionDate: Date, dischargeDate?: Date): {
    days: number;
    hours: number;
    minutes: number;
    formatted: string;
  } {
    const endDate = dischargeDate || new Date();
    const days = differenceInDays(endDate, admissionDate);
    const hours = differenceInHours(endDate, admissionDate);
    const minutes = differenceInMinutes(endDate, admissionDate);

    let formatted = '';
    if (days > 0) {
      formatted = `${days} day${days !== 1 ? 's' : ''}`;
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        formatted += ` ${remainingHours} hr${remainingHours !== 1 ? 's' : ''}`;
      }
    } else if (hours > 0) {
      formatted = `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else {
      formatted = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    return { days, hours, minutes, formatted };
  }

  /**
   * Get admission tracking for a patient
   */
  async getPatientAdmission(patientId: string): Promise<AdmissionTracking | null> {
    try {
      const response = await authenticatedFetch(`/api/admissions/tracking/${patientId}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch admission tracking');
      }

      const admission = await response.json();
      
      // Calculate real-time length of stay
      if (admission) {
        const los = this.calculateLengthOfStay(
          new Date(admission.admission_date),
          admission.actual_discharge_date ? new Date(admission.actual_discharge_date) : undefined
        );
        admission.length_of_stay_days = los.days;
        admission.length_of_stay_hours = los.hours;
      }

      return admission;
    } catch (error) {
      console.error('Error fetching admission tracking:', error);
      return null;
    }
  }

  /**
   * Get treatment plan execution status
   */
  async getTreatmentPlanExecution(treatmentPlanId: string): Promise<TreatmentPlanExecution | null> {
    try {
      const response = await authenticatedFetch(`/api/treatment-plans/execution/${treatmentPlanId}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error('Failed to fetch treatment plan execution');
      }

      const execution = await response.json();
      
      // Calculate real-time metrics
      if (execution) {
        const now = new Date();
        execution.days_elapsed = differenceInDays(now, new Date(execution.start_date));
        
        if (execution.planned_end_date) {
          execution.days_remaining = differenceInDays(new Date(execution.planned_end_date), now);
          execution.is_on_schedule = execution.completion_percentage >= 
            (execution.days_elapsed / differenceInDays(new Date(execution.planned_end_date), new Date(execution.start_date))) * 100;
        }
      }

      return execution;
    } catch (error) {
      console.error('Error fetching treatment plan execution:', error);
      return null;
    }
  }

  /**
   * Get all treatment plans for a patient
   */
  async getPatientTreatmentPlans(patientId: string): Promise<TreatmentPlanExecution[]> {
    try {
      const response = await authenticatedFetch(`/api/treatment-plans/execution/patient/${patientId}`);

      if (!response.ok) throw new Error('Failed to fetch patient treatment plans');

      const plans = await response.json();
      
      // Calculate real-time metrics for each plan
      return plans.map((plan: TreatmentPlanExecution) => {
        const now = new Date();
        plan.days_elapsed = differenceInDays(now, new Date(plan.start_date));
        
        if (plan.planned_end_date) {
          plan.days_remaining = differenceInDays(new Date(plan.planned_end_date), now);
          const totalDays = differenceInDays(new Date(plan.planned_end_date), new Date(plan.start_date));
          const expectedProgress = (plan.days_elapsed / totalDays) * 100;
          plan.is_on_schedule = plan.completion_percentage >= expectedProgress;
        }

        return plan;
      });
    } catch (error) {
      console.error('Error fetching patient treatment plans:', error);
      return [];
    }
  }

  /**
   * Get comprehensive patient admission status
   */
  async getPatientAdmissionStatus(patientId: string): Promise<PatientAdmissionStatus | null> {
    try {
      const [admission, treatmentPlans] = await Promise.all([
        this.getPatientAdmission(patientId),
        this.getPatientTreatmentPlans(patientId)
      ]);

      const alerts: PatientAdmissionStatus['alerts'] = [];

      // Check for long stay
      if (admission && admission.length_of_stay_days > 14) {
        alerts.push({
          type: 'long_stay',
          severity: admission.length_of_stay_days > 30 ? 'critical' : 'high',
          message: `Patient has been admitted for ${admission.length_of_stay_days} days`
        });
      }

      // Check for overdue treatment steps
      const totalOverdueSteps = treatmentPlans.reduce((sum, plan) => sum + plan.overdue_steps, 0);
      if (totalOverdueSteps > 0) {
        alerts.push({
          type: 'overdue_step',
          severity: totalOverdueSteps > 5 ? 'high' : 'medium',
          message: `${totalOverdueSteps} treatment step${totalOverdueSteps !== 1 ? 's' : ''} overdue`
        });
      }

      // Check for delayed plans
      const delayedPlans = treatmentPlans.filter(plan => !plan.is_on_schedule);
      if (delayedPlans.length > 0) {
        alerts.push({
          type: 'delayed_plan',
          severity: 'medium',
          message: `${delayedPlans.length} treatment plan${delayedPlans.length !== 1 ? 's' : ''} behind schedule`
        });
      }

      // Check for pending discharge
      if (admission && admission.status === 'pending_discharge') {
        alerts.push({
          type: 'pending_discharge',
          severity: 'low',
          message: 'Discharge pending - complete remaining tasks'
        });
      }

      // Calculate overall progress
      const totalSteps = treatmentPlans.reduce((sum, plan) => sum + plan.total_steps, 0);
      const completedSteps = treatmentPlans.reduce((sum, plan) => sum + plan.completed_steps, 0);
      const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      // Get patient data
      const patient = await db.patients.get(patientId);

      return {
        patient_id: patientId,
        patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown',
        hospital_number: patient?.hospital_number || '',
        admission,
        treatment_plans: treatmentPlans,
        current_status: admission && admission.status === 'active' ? 'admitted' : 'not_admitted',
        overall_progress: overallProgress,
        alerts: alerts.sort((a, b) => {
          const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
      };
    } catch (error) {
      console.error('Error fetching patient admission status:', error);
      return null;
    }
  }

  /**
   * Get all active admissions with real-time tracking
   */
  async getAllActiveAdmissions(): Promise<AdmissionTracking[]> {
    try {
      const response = await authenticatedFetch('/api/admissions/active');

      if (!response.ok) throw new Error('Failed to fetch active admissions');

      const admissions = await response.json();
      
      // Calculate real-time length of stay for each admission
      return admissions.map((admission: AdmissionTracking) => {
        const los = this.calculateLengthOfStay(
          new Date(admission.admission_date),
          admission.actual_discharge_date ? new Date(admission.actual_discharge_date) : undefined
        );
        return {
          ...admission,
          length_of_stay_days: los.days,
          length_of_stay_hours: los.hours
        };
      });
    } catch (error) {
      console.error('Error fetching active admissions:', error);
      return [];
    }
  }

  /**
   * Update treatment plan progress
   */
  async updateTreatmentPlanProgress(
    treatmentPlanId: string,
    completedSteps: number
  ): Promise<boolean> {
    try {
      const response = await authenticatedFetch(`/api/treatment-plans/execution/${treatmentPlanId}/progress`, {
        method: 'PUT',
        body: JSON.stringify({ completedSteps })
      });

      return response.ok;
    } catch (error) {
      console.error('Error updating treatment plan progress:', error);
      return false;
    }
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(): Promise<{
    total_active_admissions: number;
    average_los_days: number;
    long_stay_patients: number;
    pending_discharges: number;
    treatment_plans_on_track: number;
    treatment_plans_delayed: number;
    overall_completion_rate: number;
  }> {
    try {
      const response = await authenticatedFetch('/api/admissions/dashboard-summary');

      if (!response.ok) throw new Error('Failed to fetch dashboard summary');

      return await response.json();
    } catch (error) {
      console.error('Error fetching dashboard summary:', error);
      return {
        total_active_admissions: 0,
        average_los_days: 0,
        long_stay_patients: 0,
        pending_discharges: 0,
        treatment_plans_on_track: 0,
        treatment_plans_delayed: 0,
        overall_completion_rate: 0
      };
    }
  }

  /**
   * Format duration for display
   */
  formatDuration(days: number, hours?: number): string {
    if (days === 0 && hours) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    let result = `${days} day${days !== 1 ? 's' : ''}`;
    
    if (hours && hours > 0) {
      const remainingHours = hours % 24;
      if (remainingHours > 0) {
        result += `, ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
      }
    }
    
    return result;
  }

  /**
   * Get treatment plan status color
   */
  getStatusColor(status: TreatmentPlanExecution['status']): string {
    switch (status) {
      case 'not_started': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'delayed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Get alert severity color
   */
  getAlertColor(severity: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (severity) {
      case 'low': return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'medium': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'high': return 'bg-orange-50 border-orange-200 text-orange-800';
      case 'critical': return 'bg-red-50 border-red-200 text-red-800';
      default: return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  }
}

export const admissionTrackingService = new AdmissionTrackingService();
