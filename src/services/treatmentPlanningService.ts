import { db } from '../db/database';
import { format, addDays, differenceInDays, isBefore, isAfter } from 'date-fns';
import toast from 'react-hot-toast';
import { notificationService } from './notificationService';

// Enhanced Treatment Planning Interfaces

// Medical Team Assignment
export interface MedicalTeamAssignment {
  senior_registrar: string;
  registrar: string;
  house_officer: string;
  assigned_date: Date;
}

// Medication with comprehensive details
export interface PlannedMedication {
  id: string;
  medication_name: string;
  dosage: string;
  route: 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'rectal' | 'sublingual' | 'other';
  frequency: string; // e.g., "TDS", "BD", "OD", "Q6H", "PRN"
  duration: string; // e.g., "7 days", "2 weeks", "Until discharge"
  start_date: Date;
  end_date?: Date;
  status: 'active' | 'completed' | 'discontinued';
  notes?: string;
}

// Investigation with repeat frequency and targets
export interface PlannedInvestigation {
  id: string;
  investigation_name: string;
  investigation_type: 'lab' | 'imaging' | 'other';
  frequency: 'once' | 'daily' | 'alternate_days' | 'twice_weekly' | 'weekly' | 'biweekly' | 'as_needed';
  repeat_count?: number; // How many times to repeat
  target_value?: string; // Expected/target result
  target_range?: string; // Normal range
  ordered_date: Date;
  scheduled_dates: Date[];
  results?: Array<{
    date: Date;
    result: string;
    value?: string;
    unit?: string;
    status: 'normal' | 'abnormal' | 'critical';
    notes?: string;
  }>;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  notes?: string;
}

// Procedure with frequency support
export interface PlannedProcedureEnhanced {
  id: string;
  procedure_name: string;
  procedure_type: 'minor' | 'major' | 'diagnostic' | 'therapeutic';
  proposed_date: Date;
  proposed_time?: string;
  frequency?: 'once' | 'daily' | 'alternate_days' | 'weekly' | 'as_needed'; // For repeated procedures like dressing changes
  repeat_count?: number; // If frequency is set
  actual_dates?: Date[]; // For procedures done multiple times
  status: 'planned' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  surgeon?: string;
  location?: string;
  notes?: string;
}

// Planned Reviews with day-of-week tracking
export interface PlannedReview {
  id: string;
  review_type: 'daily' | 'alternate_days' | 'weekly' | 'biweekly' | 'custom';
  days_of_week: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  start_date: Date;
  end_date?: Date;
  assigned_to: 'senior_registrar' | 'registrar' | 'house_officer';
  assigned_person_name: string;
  completed_reviews: Array<{
    date: Date;
    completed_by: string;
    findings: string;
    actions_taken: string;
    next_steps?: string;
    completed_at: Date;
  }>;
  missed_reviews: Array<{
    scheduled_date: Date;
    reason?: string;
  }>;
  status: 'active' | 'completed' | 'paused';
}

// Team Activity Tracking
export interface TeamActivityLog {
  id: string;
  date: Date;
  team_member: string;
  role: 'senior_registrar' | 'registrar' | 'house_officer';
  activity_type: 'review' | 'procedure' | 'medication_order' | 'investigation_order' | 'note' | 'other';
  description: string;
  patient_satisfaction: 'satisfactory' | 'needs_attention' | 'critical';
  notes?: string;
  created_at: Date;
}

// Discharge Planning with Extensions
export interface DischargePlanning {
  id: string;
  initial_discharge_date: Date;
  current_discharge_date: Date;
  extensions: Array<{
    extended_date: Date;
    extension_days: number;
    reason: string;
    targets_not_met: string[];
    extended_by: string;
    extended_at: Date;
  }>;
  discharge_criteria: string[];
  criteria_met: string[];
  criteria_pending: string[];
  status: 'on_track' | 'extended' | 'ready' | 'discharged';
}

export interface TreatmentPlanReview {
  id: string;
  plan_id: string;
  review_date: Date;
  scheduled_date: Date;
  assigned_to: string; // House Officer name
  assigned_house_officer: string; // Alias for assigned_to for compatibility
  assigned_role: 'house_officer';
  status: 'pending' | 'completed' | 'overdue';
  findings?: string;
  actions_taken?: string;
  next_review_date?: Date;
  completed_by?: string;
  completed_at?: Date;
  delay_reason?: string; // If completed late
  notes?: string; // Review notes
  created_at: Date;
  updated_at: Date;
}

export interface LabWork {
  id: string;
  plan_id: string;
  patient_id: string;
  test_type: string;
  frequency: 'once' | 'daily' | 'twice_daily' | 'weekly' | 'biweekly' | 'monthly';
  timeline_start: Date;
  timeline_end?: Date;
  scheduled_dates: Date[];
  completed_dates: Date[];
  results?: Array<{
    date: Date;
    result: string;
    value?: string;
    status: 'normal' | 'abnormal' | 'critical';
    notes?: string;
  }>;
  status: 'active' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface PlannedProcedure {
  id: string;
  plan_id: string;
  patient_id: string;
  procedure_name: string;
  procedure_type: 'minor' | 'major' | 'diagnostic';
  proposed_date: Date;
  proposed_time?: string;
  actual_date?: Date;
  actual_time?: string;
  status: 'planned' | 'scheduled' | 'completed' | 'cancelled' | 'postponed';
  surgeon?: string;
  location?: string;
  delay_reason?: string;
  delay_days?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface MedicationAdministration {
  id: string;
  plan_id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  route: 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'other';
  frequency: string;
  timeline_start: Date;
  timeline_end?: Date;
  scheduled_times: Array<{
    date: Date;
    time: string;
    scheduled: Date;
  }>;
  administration_records: Array<{
    scheduled_datetime: Date;
    actual_datetime?: Date;
    administered_by?: string;
    status: 'pending' | 'given' | 'missed' | 'refused';
    delay_minutes?: number;
    delay_reason?: string;
    notes?: string;
  }>;
  status: 'active' | 'completed' | 'discontinued';
  created_at: Date;
  updated_at: Date;
}

export interface DischargeTimeline {
  id: string;
  plan_id: string;
  patient_id: string;
  proposed_discharge_date: Date;
  proposed_discharge_time?: string;
  actual_discharge_date?: Date;
  actual_discharge_time?: string;
  discharge_type: 'home' | 'transfer' | 'ama' | 'death';
  discharge_destination?: string;
  delay_days?: number;
  delay_reasons?: Array<{
    reason: string;
    documented_by: string;
    documented_at: Date;
  }>;
  status: 'planned' | 'ready' | 'discharged' | 'extended';
  discharge_summary_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EnhancedTreatmentPlan {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  title: string;
  diagnosis: string;
  admission_date: Date;
  status: 'draft' | 'active' | 'completed' | 'archived';
  
  // Medical Team Assignment
  medical_team?: MedicalTeamAssignment;
  
  // Enhanced fields
  planned_medications?: PlannedMedication[];
  planned_investigations?: PlannedInvestigation[];
  planned_procedures?: PlannedProcedureEnhanced[];
  planned_reviews?: PlannedReview[];
  team_activities?: TeamActivityLog[];
  discharge_plan?: DischargePlanning;
  
  // Legacy fields (keep for backward compatibility)
  reviews: TreatmentPlanReview[];
  lab_works: LabWork[];
  procedures: PlannedProcedure[];
  medications: MedicationAdministration[];
  discharge_timeline?: DischargeTimeline;
  
  notes?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

class TreatmentPlanningService {
  // Create new treatment plan
  async createTreatmentPlan(data: Omit<EnhancedTreatmentPlan, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const plan: EnhancedTreatmentPlan = {
      ...data,
      id: `plan_${Date.now()}`,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.treatment_plans.add(plan as any);
    return plan.id;
  }

  // Add review to plan
  async addReview(planId: string, reviewData: Omit<TreatmentPlanReview, 'id' | 'plan_id' | 'created_at' | 'updated_at' | 'status' | 'scheduled_date' | 'assigned_role'>): Promise<string> {
    const review: TreatmentPlanReview = {
      id: `review_${Date.now()}`,
      plan_id: planId,
      review_date: reviewData.review_date,
      scheduled_date: reviewData.review_date, // Same as review_date initially
      assigned_to: (reviewData as any).assigned_house_officer || reviewData.assigned_to || '',
      assigned_house_officer: (reviewData as any).assigned_house_officer || reviewData.assigned_to || '',
      assigned_role: 'house_officer',
      status: 'pending',
      notes: reviewData.notes,
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan) {
      const reviews = [...(plan.reviews || []), review];
      await db.treatment_plans.update(planId as any, { reviews, updated_at: new Date() });
    }

    return review.id;
  }

  // Complete review and check for delays
  async completeReview(planId: string, reviewId: string, findings: string, actionsTaken: string): Promise<void> {
    const plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan && plan.reviews) {
      const reviewIndex = plan.reviews.findIndex((r: any) => r.id === reviewId);
      if (reviewIndex !== -1) {
        const review = plan.reviews[reviewIndex];
        const now = new Date();
        const delayDays = differenceInDays(now, review.scheduled_date);
        
        plan.reviews[reviewIndex] = {
          ...review,
          status: 'completed',
          findings,
          actions_taken: actionsTaken,
          completed_at: now,
          delay_reason: delayDays > 0 ? 'Review completed late' : undefined,
          updated_at: now
        };

        await db.treatment_plans.update(planId as any, { reviews: plan.reviews, updated_at: now });
      }
    }
  }

  // Add lab work
  async addLabWork(planId: string, labData: Omit<LabWork, 'id' | 'plan_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const lab: LabWork = {
      ...labData,
      id: `lab_${Date.now()}`,
      plan_id: planId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan) {
      const labWorks = [...(plan.lab_works || []), lab];
      await db.treatment_plans.update(planId as any, { lab_works: labWorks, updated_at: new Date() });
    }

    return lab.id;
  }

  // Add procedure
  async addProcedure(planId: string, procedureData: Omit<PlannedProcedure, 'id' | 'plan_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const procedure: PlannedProcedure = {
      ...procedureData,
      id: `proc_${Date.now()}`,
      plan_id: planId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan) {
      const procedures = [...(plan.procedures || []), procedure];
      await db.treatment_plans.update(planId as any, { procedures, updated_at: new Date() });
    }

    return procedure.id;
  }

  // Complete procedure and track delays
  async completeProcedure(planId: string, procedureId: string, actualDate: Date, actualTime: string): Promise<void> {
    const plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan && plan.procedures) {
      const procIndex = plan.procedures.findIndex((p: any) => p.id === procedureId);
      if (procIndex !== -1) {
        const procedure = plan.procedures[procIndex];
        const delayDays = differenceInDays(actualDate, procedure.proposed_date);
        
        plan.procedures[procIndex] = {
          ...procedure,
          actual_date: actualDate,
          actual_time: actualTime,
          status: 'completed',
          delay_days: delayDays > 0 ? delayDays : 0,
          updated_at: new Date()
        };

        await db.treatment_plans.update(planId as any, { procedures: plan.procedures, updated_at: new Date() });
      }
    }
  }

  // Add medication
  async addMedication(planId: string, medicationData: Omit<MedicationAdministration, 'id' | 'plan_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const medication: MedicationAdministration = {
      ...medicationData,
      id: `med_${Date.now()}`,
      plan_id: planId,
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan) {
      const medications = [...(plan.medications || []), medication];
      await db.treatment_plans.update(planId as any, { medications, updated_at: new Date() });
    }

    return medication.id;
  }

  // Set discharge timeline
  async setDischargeTimeline(planId: string, dischargeData: Omit<DischargeTimeline, 'id' | 'plan_id' | 'created_at' | 'updated_at'>): Promise<string> {
    const discharge: DischargeTimeline = {
      ...dischargeData,
      id: `discharge_${Date.now()}`,
      plan_id: planId,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.treatment_plans.update(planId as any, { discharge_timeline: discharge, updated_at: new Date() });
    return discharge.id;
  }

  // Get overdue items for a plan
  async getOverdueItems(planId: string): Promise<{
    reviews: TreatmentPlanReview[];
    procedures: PlannedProcedure[];
    medications: any[];
  }> {
    const plan = await db.treatment_plans.get({ id: planId } as any);
    const now = new Date();

    if (!plan) {
      return { reviews: [], procedures: [], medications: [] };
    }

    const overdueReviews = (plan.reviews || []).filter((r: TreatmentPlanReview) => 
      r.status === 'pending' && isBefore(r.scheduled_date, now)
    );

    const overdueProcedures = (plan.procedures || []).filter((p: PlannedProcedure) => 
      p.status === 'planned' && isBefore(p.proposed_date, now)
    );

    const overdueMedications = (plan.medications || []).flatMap((m: MedicationAdministration) =>
      m.administration_records.filter(r => r.status === 'pending' && isBefore(r.scheduled_datetime, now))
    );

    return {
      reviews: overdueReviews,
      procedures: overdueProcedures,
      medications: overdueMedications
    };
  }

  // Get treatment plan by ID
  async getTreatmentPlan(planId: string): Promise<EnhancedTreatmentPlan | undefined> {
    return await db.treatment_plans.get({ id: planId } as any);
  }

  // Get all treatment plans for a patient
  async getPatientTreatmentPlans(patientId: string): Promise<EnhancedTreatmentPlan[]> {
    const patientIdNum = parseInt(patientId);
    const plans = await db.treatment_plans.where('patient_id').equals(patientIdNum).toArray();
    return plans.map(plan => ({
      ...plan,
      id: plan.id?.toString() || '',
      patient_id: plan.patient_id.toString(),
      patient_name: plan.patient_name || '',
      hospital_number: plan.hospital_number || '',
      admission_date: plan.admission_date || new Date()
    })) as EnhancedTreatmentPlan[];
  }

  // Get active treatment plans
  async getActiveTreatmentPlans(): Promise<EnhancedTreatmentPlan[]> {
    const plans = await db.treatment_plans.where('status').equals('active').toArray();
    return plans.map(plan => ({
      ...plan,
      id: plan.id?.toString() || '',
      patient_id: plan.patient_id.toString(),
      patient_name: plan.patient_name || '',
      hospital_number: plan.hospital_number || '',
      admission_date: plan.admission_date || new Date()
    })) as EnhancedTreatmentPlan[];
  }

  // Real-time notifications
  async notifyTreatmentPlanCreated(plan: EnhancedTreatmentPlan, patientName: string): Promise<void> {
    toast.success(`Treatment plan created for ${patientName}`);
    
    // Schedule notification for reviews
    if (plan.reviews && plan.reviews.length > 0) {
      const firstReview = plan.reviews[0];
      if (firstReview.scheduled_date) {
        try {
          await notificationService.scheduleLocalNotification({
            title: 'Upcoming Review',
            message: `Review scheduled for ${patientName} on ${format(new Date(firstReview.scheduled_date), 'MMM dd, yyyy')}`,
            type: 'reminder',
            scheduledFor: new Date(firstReview.scheduled_date),
            url: `/treatment-planning?planId=${plan.id}`
          });
        } catch (error) {
          // Silent fail if notifications not supported
        }
      }
    }
  }

  async notifyReviewScheduled(patientName: string, reviewDate: Date, assignedTo: string): Promise<void> {
    toast.success(`Review scheduled for ${patientName} on ${format(reviewDate, 'MMM dd, yyyy')}`);
    
    try {
      await notificationService.scheduleLocalNotification({
        title: 'Review Reminder',
        message: `Patient review due for ${patientName}`,
        type: 'reminder',
        scheduledFor: reviewDate,
        url: '/treatment-planning'
      });
    } catch (error) {
      // Silent fail if notifications not supported
    }
  }

  async notifyProcedureScheduled(patientName: string, procedureName: string, procedureDate: Date): Promise<void> {
    toast.success(`${procedureName} scheduled for ${patientName}`);
    
    // Schedule reminder notification 1 day before
    const reminderDate = addDays(procedureDate, -1);
    if (isAfter(reminderDate, new Date())) {
      try {
        await notificationService.scheduleLocalNotification({
          title: 'Procedure Tomorrow',
          message: `${procedureName} scheduled for ${patientName} tomorrow`,
          type: 'alert',
          scheduledFor: reminderDate,
          url: '/treatment-planning'
        });
      } catch (error) {
        // Silent fail if notifications not supported
      }
    }
  }

  async notifyOverdueItems(overdueCount: number, patientName: string): Promise<void> {
    if (overdueCount > 0) {
      toast.error(`${overdueCount} overdue item(s) for ${patientName}`, {
        duration: 5000,
        icon: '⚠️'
      });
    }
  }

  async notifyMedicationDue(patientName: string, medicationName: string, scheduledTime: Date): Promise<void> {
    try {
      await notificationService.scheduleLocalNotification({
        title: 'Medication Due',
        message: `${medicationName} due for ${patientName}`,
        type: 'urgent',
        scheduledFor: scheduledTime,
        url: '/treatment-planning'
      });
    } catch (error) {
      // Silent fail if notifications not supported
    }
  }

  async notifyLabResultCritical(patientName: string, testName: string, result: string): Promise<void> {
    toast.error(`Critical lab result: ${testName} for ${patientName}: ${result}`, {
      duration: 10000,
      icon: '🚨'
    });
    
    try {
      await notificationService.showLocalNotification({
        title: 'CRITICAL Lab Result',
        message: `${testName} for ${patientName}: ${result}`,
        type: 'urgent',
        url: '/treatment-planning'
      });
    } catch (error) {
      // Silent fail if notifications not supported
    }
  }

  // Check for overdue items periodically and notify
  async checkAndNotifyOverdueItems(): Promise<void> {
    try {
      const activePlans = await this.getActiveTreatmentPlans();
      
      for (const plan of activePlans) {
        const overdue = this.getOverdueItems(plan);
        const totalOverdue = overdue.reviews.length + overdue.procedures.length + overdue.medications.length;
        
        if (totalOverdue > 0) {
          await this.notifyOverdueItems(totalOverdue, plan.patient_name || 'Unknown Patient');
        }
      }
    } catch (error) {
      console.error('Error checking overdue items:', error);
    }
  }
}

export const treatmentPlanningService = new TreatmentPlanningService();
