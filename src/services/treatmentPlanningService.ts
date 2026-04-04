import { db } from '../db/database';
import { format, addDays, differenceInDays, isBefore, isAfter } from 'date-fns';
import toast from 'react-hot-toast';
import { notificationService } from './notificationService';
import { apiClient } from './apiClient';
import { syncService } from '../db/syncService';

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
  status: 'on_track' | 'extended' | 'ready' | 'discharged' | 'planned' | 'planning';
  planned_date?: Date;
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
  planned_date?: Date;
  proposed_time?: string;
  actual_date?: Date;
  actual_time?: string;
  status: 'planned' | 'scheduled' | 'completed' | 'cancelled' | 'postponed' | 'overdue';
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
  start_date?: Date;
  end_date?: Date;
  prescribing_doctor?: string;
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
  status: 'active' | 'completed' | 'discontinued' | 'overdue';
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
  planned_date?: Date;
  criteria_met?: string[];
  pending_requirements?: string[];
  status: 'planned' | 'ready' | 'discharged' | 'extended' | 'overdue';
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
  investigations?: any[];
  activity_restrictions?: string[];
  created_by: string;
  created_at: Date;
  updated_at: Date;
  
  // Approval workflow fields
  pending_modifications?: TreatmentPlanModification[];
  modification_history?: TreatmentPlanModification[];
}

// Treatment Plan Modification Request (for approval workflow)
export interface TreatmentPlanModification {
  id: string;
  plan_id: string;
  patient_id: string;
  patient_name: string;
  
  // Who requested the modification
  requested_by: string;
  requested_by_role: 'senior_registrar' | 'junior_registrar' | 'house_officer';
  requested_at: Date;
  
  // Source of modification
  source: 'ward_round' | 'mdt_review' | 'direct_edit';
  ward_round_id?: string;
  mdt_session_id?: string;
  specialty_input?: string; // For MDT: which specialty suggested this
  
  // What's being modified
  modification_type: 'medication' | 'investigation' | 'procedure' | 'review' | 'discharge' | 'diagnosis' | 'general';
  modification_action: 'add' | 'update' | 'remove' | 'reschedule';
  
  // The actual changes
  original_value?: any;
  proposed_value: any;
  reason: string;
  clinical_justification?: string;
  
  // Approval status
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  
  // Approval details
  reviewed_by?: string;
  reviewed_by_role?: 'consultant' | 'senior_registrar';
  reviewed_at?: Date;
  review_comments?: string;
  
  // Priority
  priority: 'routine' | 'urgent' | 'emergency';
  
  created_at: Date;
  updated_at: Date;
}

// MDT Specialty Input for treatment plan modifications
export interface MDTSpecialtyInput {
  id: string;
  plan_id: string;
  patient_id: string;
  mdt_session_id: string;
  
  // Specialty details
  specialty: string;
  specialist_name: string;
  specialist_role: string;
  
  // Recommendations
  recommendations: string;
  suggested_medications?: Array<{
    action: 'add' | 'modify' | 'discontinue';
    medication_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    reason: string;
  }>;
  suggested_investigations?: Array<{
    action: 'add' | 'cancel';
    investigation_name: string;
    urgency: 'routine' | 'urgent' | 'stat';
    reason: string;
  }>;
  suggested_procedures?: Array<{
    action: 'add' | 'modify' | 'cancel';
    procedure_name: string;
    timing?: string;
    reason: string;
  }>;
  
  // Follow-up
  follow_up_required: boolean;
  follow_up_details?: string;
  
  // Approval
  status: 'pending' | 'approved' | 'rejected' | 'partially_approved';
  approved_by?: string;
  approved_at?: Date;
  approval_notes?: string;
  
  created_at: Date;
  updated_at: Date;
}

class TreatmentPlanningService {
  // Helper to find a plan in Dexie by string or numeric ID
  private async findPlanLocal(planId: string): Promise<any> {
    // Try direct get with the key
    let plan = await db.treatment_plans.get(planId as any);
    if (plan) return plan;
    // Try as integer
    const numId = parseInt(planId);
    if (!isNaN(numId)) {
      plan = await db.treatment_plans.get(numId);
      if (plan) return plan;
    }
    // Try object key match
    plan = await db.treatment_plans.get({ id: planId } as any);
    if (plan) return plan;
    if (!isNaN(numId)) {
      plan = await db.treatment_plans.get({ id: numId } as any);
    }
    return plan || null;
  }

  // Helper to update a plan in Dexie by string or numeric ID  
  private async updatePlanLocal(planId: string, updates: any): Promise<void> {
    const numId = parseInt(planId);
    // Try numeric first (most common from Dexie ++id)
    if (!isNaN(numId)) {
      const count = await db.treatment_plans.update(numId, updates);
      if (count > 0) return;
    }
    // Try string
    await db.treatment_plans.update(planId as any, updates);
  }

  /**
   * Update an existing treatment plan (full replacement).
   * Syncs to server then updates local DB.
   */
  async updateTreatmentPlan(planId: string, data: any): Promise<string> {
    const updates: any = {
      ...data,
      updated_at: new Date()
    };
    // Remove fields that shouldn't overwrite existing metadata
    delete updates.created_at;

    console.log('📝 Updating treatment plan:', planId, updates);

    // Try to sync to server first
    try {
      if (navigator.onLine) {
        await apiClient.updateTreatmentPlan(planId, updates);
        console.log('✅ Treatment plan update synced to server');
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync treatment plan update to server:', error);
    }

    // Update locally
    await this.updatePlanLocal(planId, { ...updates, synced: navigator.onLine });
    toast.success('Treatment plan updated successfully');
    return planId;
  }

  // Create new treatment plan
  async createTreatmentPlan(data: any): Promise<string> {
    // Ensure all required array fields have defaults
    const plan: any = {
      ...data,
      patient_id: data.patient_id,
      patient_name: data.patient_name || '',
      hospital_number: data.hospital_number || '',
      title: data.title || data.diagnosis || 'Treatment Plan',
      diagnosis: data.diagnosis || '',
      admission_date: data.admission_date || new Date(),
      planned_discharge_date: data.planned_discharge_date || null,
      primary_consultant: data.primary_consultant || '',
      status: data.status || 'active',
      reviews: data.reviews || [],
      lab_works: data.lab_works || [],
      procedures: data.procedures || [],
      medications: data.medications || [],
      planned_reviews: data.planned_reviews || [],
      planned_investigations: data.planned_investigations || [],
      planned_procedures: data.planned_procedures || [],
      planned_medications: data.planned_medications || [],
      discharge_plan: data.discharge_plan || null,
      discharge_timeline: data.discharge_timeline || null,
      notes: data.notes || '',
      created_by: data.created_by || 'unknown',
      created_at: new Date(),
      updated_at: new Date()
    };

    console.log('📋 Creating treatment plan:', plan);

    // Try to sync to server first
    try {
      const saved = await apiClient.createTreatmentPlan(plan);
      console.log('✅ Treatment plan synced to server:', saved);
      const savedId = saved?.id || saved?.plan_id;
      // For server saves, use the server's integer ID
      const localRecord = { ...plan, synced: true };
      if (savedId) {
        localRecord.id = savedId;
        localRecord.serverId = String(savedId);
      }
      // Remove id if undefined so Dexie auto-generates
      if (!localRecord.id) delete localRecord.id;
      const localId = await db.treatment_plans.add(localRecord as any);
      toast.success('Treatment plan created successfully');
      return String(savedId || localId);
    } catch (error: any) {
      console.warn('⚠️ Failed to sync treatment plan to server, saving locally', error);
      
      // Save locally - let Dexie auto-generate the integer ID
      const localRecord = { ...plan, synced: false };
      delete localRecord.id; // Remove so Dexie auto-generates integer ID
      const localId = await db.treatment_plans.add(localRecord as any);
      await syncService.queueAction('create', 'treatment_plans', localId as any, plan);
      console.log('📱 Treatment plan saved locally, will sync when online:', localId);
      toast.success('Treatment plan saved locally, will sync when online');
      return String(localId);
    }
  }

  // Add review to plan
  async addReview(planId: string, reviewData: any): Promise<string> {
    // Support both field naming conventions from different callers
    const houseOfficer = reviewData.house_officer || reviewData.assigned_house_officer || reviewData.assigned_to || '';
    const reviewNotes = reviewData.review_notes || reviewData.notes || '';
    const reviewDate = reviewData.review_date || new Date();
    
    const review: any = {
      id: `review_${Date.now()}`,
      plan_id: planId,
      review_date: reviewDate,
      scheduled_date: reviewDate,
      house_officer: houseOfficer,
      assigned_to: houseOfficer,
      assigned_house_officer: houseOfficer,
      assigned_role: 'house_officer',
      status: 'pending',
      notes: reviewNotes,
      review_notes: reviewNotes,
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await this.findPlanLocal(planId);
    if (plan) {
      const reviews = [...(plan.reviews || []), review];
      await this.updatePlanLocal(planId, { reviews, updated_at: new Date() });

      // Sync reviews to server as follow_up_schedule
      try {
        const serverId = plan.serverId || plan.id;
        if (serverId && navigator.onLine) {
          await apiClient.updateTreatmentPlan(String(serverId), {
            followUpSchedule: reviews
          });
        }
      } catch (e) {
        console.warn('Could not sync reviews to server:', e);
      }
    }

    return review.id;
  }

  // Complete review and check for delays
  // Accepts: (planId, reviewId, completedBy, notes, delayReason?)
  async completeReview(planId: string, reviewId: string, completedBy: string, notes: string, delayReason?: string): Promise<void> {
    let plan = await this.findPlanLocal(planId);
    if (plan && plan.reviews) {
      const reviewIndex = plan.reviews.findIndex((r: any) => r.id === reviewId);
      if (reviewIndex !== -1) {
        const review = plan.reviews[reviewIndex];
        const now = new Date();
        const scheduledDate = review.scheduled_date ? new Date(review.scheduled_date) : new Date(review.review_date);
        const delayDays = differenceInDays(now, scheduledDate);
        
        plan.reviews[reviewIndex] = {
          ...review,
          status: 'completed',
          findings: notes,
          actions_taken: notes,
          notes: notes,
          review_notes: notes,
          completed_by: completedBy,
          completed_at: now,
          delay_days: delayDays > 0 ? delayDays : 0,
          delay_reason: delayReason || (delayDays > 0 ? 'Review completed late' : undefined),
          updated_at: now
        };

        await this.updatePlanLocal(planId, { reviews: plan.reviews, updated_at: now });
      }
    }
  }

  // Add lab work
  async addLabWork(planId: string, labData: any): Promise<string> {
    const lab: any = {
      ...labData,
      id: `lab_${Date.now()}`,
      plan_id: planId,
      status: labData.status || 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await this.findPlanLocal(planId);
    if (plan) {
      const labWorks = [...(plan.lab_works || []), lab];
      await this.updatePlanLocal(planId, { lab_works: labWorks, updated_at: new Date() });
    }

    return lab.id;
  }

  // Add procedure
  async addProcedure(planId: string, procedureData: any): Promise<string> {
    const procedure: any = {
      ...procedureData,
      id: `proc_${Date.now()}`,
      plan_id: planId,
      status: procedureData.status || 'planned',
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await this.findPlanLocal(planId);
    if (plan) {
      const procedures = [...(plan.procedures || []), procedure];
      await this.updatePlanLocal(planId, { procedures, updated_at: new Date() });
    }

    return procedure.id;
  }

  // Complete procedure and track delays
  async completeProcedure(planId: string, procedureId: string, actualDate: Date, delayReason?: string): Promise<void> {
    const plan = await this.findPlanLocal(planId);
    if (plan && plan.procedures) {
      const procIndex = plan.procedures.findIndex((p: any) => p.id === procedureId);
      if (procIndex !== -1) {
        const procedure = plan.procedures[procIndex];
        const proposedDate = procedure.proposed_date || procedure.planned_date;
        const delayDays = proposedDate ? differenceInDays(actualDate, new Date(proposedDate)) : 0;
        
        plan.procedures[procIndex] = {
          ...procedure,
          actual_date: actualDate,
          status: 'completed',
          delay_days: delayDays > 0 ? delayDays : 0,
          delay_reason: delayReason || (delayDays > 0 ? 'Procedure delayed' : undefined),
          updated_at: new Date()
        };

        await this.updatePlanLocal(planId, { procedures: plan.procedures, updated_at: new Date() });
      }
    }
  }

  // Add medication
  async addMedication(planId: string, medicationData: any): Promise<string> {
    const medication: any = {
      ...medicationData,
      id: `med_${Date.now()}`,
      plan_id: planId,
      status: medicationData.status || 'active',
      created_at: new Date(),
      updated_at: new Date()
    };

    const plan = await this.findPlanLocal(planId);
    if (plan) {
      const medications = [...(plan.medications || []), medication];
      await this.updatePlanLocal(planId, { medications, updated_at: new Date() });
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

    await this.updatePlanLocal(planId, { discharge_timeline: discharge, updated_at: new Date() });
    return discharge.id;
  }

  // Get overdue items for a plan (synchronous version - takes plan object directly)
  getOverdueItems(plan: EnhancedTreatmentPlan | null | undefined): {
    reviews: any[];
    procedures: any[];
    medications: any[];
  } {
    if (!plan) {
      return { reviews: [], procedures: [], medications: [] };
    }

    const now = new Date();

    const overdueReviews = (plan.reviews || []).filter((r: any) => {
      const scheduledDate = r.scheduled_date || r.review_date;
      return r.status === 'pending' && scheduledDate && isBefore(new Date(scheduledDate), now);
    });

    const overdueProcedures = (plan.procedures || []).filter((p: any) => {
      const proposedDate = p.proposed_date || p.planned_date;
      return (p.status === 'planned' || p.status === 'pending') && proposedDate && isBefore(new Date(proposedDate), now);
    });

    const overdueMedications = (plan.medications || []).filter((m: any) => {
      if (m.administration_records) {
        return m.administration_records.some((r: any) => r.status === 'pending' && r.scheduled_datetime && isBefore(new Date(r.scheduled_datetime), now));
      }
      return false;
    });

    return {
      reviews: overdueReviews,
      procedures: overdueProcedures,
      medications: overdueMedications
    };
  }

  // Get overdue items for a plan by ID (async version)
  async getOverdueItemsById(planId: string): Promise<{
    reviews: any[];
    procedures: any[];
    medications: any[];
  }> {
    const plan = await this.findPlanLocal(planId);
    return this.getOverdueItems(plan as EnhancedTreatmentPlan);
  }

  // Get treatment plan by ID
  async getTreatmentPlan(planId: string): Promise<EnhancedTreatmentPlan | undefined> {
    // Always get local data first to preserve local-only fields (lab_works, reviews, etc.)
    const localPlan = await this.findPlanLocal(planId);

    // Try server for latest base data
    if (navigator.onLine) {
      try {
        const plans = await apiClient.getTreatmentPlans();
        if (Array.isArray(plans)) {
          const serverMatch = plans.find((p: any) => String(p.id) === String(planId));
          if (serverMatch) {
            // Parse server JSONB fields
            const serverReviews = Array.isArray(serverMatch.follow_up_schedule)
              ? serverMatch.follow_up_schedule
              : (typeof serverMatch.follow_up_schedule === 'string' ? JSON.parse(serverMatch.follow_up_schedule || '[]') : []);
            const serverProcedures = Array.isArray(serverMatch.procedures)
              ? serverMatch.procedures
              : (typeof serverMatch.procedures === 'string' ? JSON.parse(serverMatch.procedures || '[]') : []);
            const serverMedications = Array.isArray(serverMatch.medications)
              ? serverMatch.medications
              : (typeof serverMatch.medications === 'string' ? JSON.parse(serverMatch.medications || '[]') : []);

            // Merge: preserve local-only fields, use server for shared fields
            const merged = {
              ...serverMatch,
              synced: true,
              reviews: (localPlan?.reviews && localPlan.reviews.length > 0) ? localPlan.reviews : serverReviews,
              lab_works: (localPlan?.lab_works && localPlan.lab_works.length > 0) ? localPlan.lab_works : (serverMatch.lab_works || []),
              procedures: (localPlan?.procedures && localPlan.procedures.length > 0) ? localPlan.procedures : serverProcedures,
              medications: (localPlan?.medications && localPlan.medications.length > 0) ? localPlan.medications : serverMedications,
              discharge_timeline: localPlan?.discharge_timeline || serverMatch.discharge_timeline || null,
              planned_discharge_date: localPlan?.planned_discharge_date || serverMatch.planned_discharge_date || null,
              primary_consultant: localPlan?.primary_consultant || serverMatch.primary_consultant || '',
              patient_name: localPlan?.patient_name || serverMatch.patient_name || [serverMatch.first_name, serverMatch.last_name].filter(Boolean).join(' ') || '',
              hospital_number: localPlan?.hospital_number || serverMatch.hospital_number || '',
              title: localPlan?.title || serverMatch.title || serverMatch.diagnosis || serverMatch.description || 'Treatment Plan',
              id: serverMatch.id?.toString() || planId,
              patient_id: serverMatch.patient_id?.toString() || localPlan?.patient_id?.toString() || '',
              diagnosis: serverMatch.diagnosis || serverMatch.description || localPlan?.diagnosis || '',
              admission_date: serverMatch.admission_date || localPlan?.admission_date || new Date(),
              status: serverMatch.status || localPlan?.status || 'active'
            };
            // Save merged back to local DB
            try { await db.treatment_plans.put(merged as any); } catch { /* ignore */ }
            return merged as EnhancedTreatmentPlan;
          }
        }
      } catch (e) {
        console.warn('Could not fetch treatment plan from server:', e);
      }
    }
    return localPlan as EnhancedTreatmentPlan | undefined;
  }

  // Get all treatment plans for a patient
  async getPatientTreatmentPlans(patientId: string): Promise<EnhancedTreatmentPlan[]> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverPlans = await apiClient.getTreatmentPlans(patientId);
        if (Array.isArray(serverPlans) && serverPlans.length > 0) {
          // Merge server data with existing local data to preserve local-only fields (reviews, lab_works, etc.)
          const mergedPlans: any[] = [];
          for (const plan of serverPlans) {
            try {
              // Find existing local record to preserve local-only fields
              const planId = plan.id;
              let existing: any = null;
              try {
                existing = await db.treatment_plans.get(planId);
                if (!existing) {
                  const numId = parseInt(String(planId));
                  if (!isNaN(numId)) existing = await db.treatment_plans.get(numId);
                }
              } catch { /* ignore */ }

              // Parse server JSONB fields
              const serverReviews = Array.isArray(plan.follow_up_schedule)
                ? plan.follow_up_schedule
                : (typeof plan.follow_up_schedule === 'string' ? JSON.parse(plan.follow_up_schedule || '[]') : []);
              const serverProcedures = Array.isArray(plan.procedures)
                ? plan.procedures
                : (typeof plan.procedures === 'string' ? JSON.parse(plan.procedures || '[]') : []);
              const serverMedications = Array.isArray(plan.medications)
                ? plan.medications
                : (typeof plan.medications === 'string' ? JSON.parse(plan.medications || '[]') : []);

              const merged = {
                ...plan,
                synced: true,
                // Preserve local-only fields if they have data, otherwise use server data
                reviews: (existing?.reviews && existing.reviews.length > 0) ? existing.reviews : serverReviews,
                lab_works: (existing?.lab_works && existing.lab_works.length > 0) ? existing.lab_works : (plan.lab_works || []),
                procedures: (existing?.procedures && existing.procedures.length > 0) ? existing.procedures : serverProcedures,
                medications: (existing?.medications && existing.medications.length > 0) ? existing.medications : serverMedications,
                discharge_timeline: existing?.discharge_timeline || plan.discharge_timeline || null,
                // Preserve local fields that server doesn't have
                planned_discharge_date: existing?.planned_discharge_date || plan.planned_discharge_date || null,
                primary_consultant: existing?.primary_consultant || plan.primary_consultant || '',
                patient_name: existing?.patient_name || plan.patient_name || [plan.first_name, plan.last_name].filter(Boolean).join(' ') || '',
                hospital_number: existing?.hospital_number || plan.hospital_number || '',
                title: existing?.title || plan.title || plan.diagnosis || plan.description || 'Treatment Plan'
              };
              await db.treatment_plans.put(merged as any);
              mergedPlans.push(merged);
            } catch { mergedPlans.push(plan); }
          }
          return mergedPlans.map((plan: any) => ({
            ...plan,
            id: plan.id?.toString() || '',
            patient_id: plan.patient_id?.toString() || patientId,
            patient_name: plan.patient_name || [plan.first_name, plan.last_name].filter(Boolean).join(' ') || '',
            hospital_number: plan.hospital_number || '',
            title: plan.title || plan.diagnosis || plan.description || 'Treatment Plan',
            diagnosis: plan.diagnosis || plan.description || '',
            admission_date: plan.admission_date || plan.created_at || new Date(),
            planned_discharge_date: plan.planned_discharge_date || null,
            primary_consultant: plan.primary_consultant || '',
            status: plan.status || 'active',
            reviews: plan.reviews || [],
            lab_works: plan.lab_works || [],
            procedures: plan.procedures || [],
            medications: plan.medications || [],
            discharge_timeline: plan.discharge_timeline || null,
            notes: plan.notes || ''
          })) as EnhancedTreatmentPlan[];
        }
      } catch (e) {
        console.warn('Could not fetch treatment plans from server:', e);
      }
    }
    // Fallback to local - try both string and number for patient_id
    const patientIdNum = parseInt(patientId);
    let plans = await db.treatment_plans.where('patient_id').equals(patientIdNum).toArray();
    if (plans.length === 0) {
      plans = await db.treatment_plans.where('patient_id').equals(patientId).toArray();
    }
    return plans.map(plan => ({
      ...plan,
      id: plan.id?.toString() || '',
      patient_id: plan.patient_id?.toString() || patientId,
      patient_name: plan.patient_name || '',
      hospital_number: plan.hospital_number || '',
      title: plan.title || (plan as any).diagnosis || 'Treatment Plan',
      diagnosis: (plan as any).diagnosis || '',
      admission_date: plan.admission_date || new Date(),
      status: plan.status || 'active',
      reviews: plan.reviews || [],
      lab_works: plan.lab_works || [],
      procedures: plan.procedures || [],
      medications: plan.medications || [],
      discharge_timeline: plan.discharge_timeline || null
    })) as EnhancedTreatmentPlan[];
  }

  // Get active treatment plans
  async getActiveTreatmentPlans(): Promise<EnhancedTreatmentPlan[]> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverPlans = await apiClient.getTreatmentPlans();
        if (Array.isArray(serverPlans) && serverPlans.length > 0) {
          // Merge server with local data to preserve local-only fields
          const mergedAll: any[] = [];
          for (const plan of serverPlans) {
            try {
              let existing: any = null;
              try {
                existing = await db.treatment_plans.get(plan.id);
                if (!existing) {
                  const numId = parseInt(String(plan.id));
                  if (!isNaN(numId)) existing = await db.treatment_plans.get(numId);
                }
              } catch { /* ignore */ }

              const rawServerReviews = Array.isArray(plan.follow_up_schedule)
                ? plan.follow_up_schedule
                : (typeof plan.follow_up_schedule === 'string' ? JSON.parse(plan.follow_up_schedule || '[]') : []);
              // Normalize server reviews to have expected UI fields
              const serverReviews = rawServerReviews.map((r: any) => ({
                ...r,
                id: r.id || `review_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                review_date: r.review_date || r.start_date || r.scheduled_date || new Date(),
                scheduled_date: r.scheduled_date || r.start_date || r.review_date || new Date(),
                assigned_house_officer: r.assigned_house_officer || r.assigned_person_name || r.assigned_to || r.house_officer || '',
                status: r.status === 'active' ? 'pending' : r.status || 'pending',
                notes: r.notes || (r.review_type ? `${r.review_type} review` : ''),
              }));
              const serverProcedures = Array.isArray(plan.procedures)
                ? plan.procedures
                : (typeof plan.procedures === 'string' ? JSON.parse(plan.procedures || '[]') : []);
              const serverMedications = Array.isArray(plan.medications)
                ? plan.medications
                : (typeof plan.medications === 'string' ? JSON.parse(plan.medications || '[]') : []);
              const serverInvestigations = Array.isArray(plan.investigations)
                ? plan.investigations
                : (typeof plan.investigations === 'string' ? JSON.parse(plan.investigations || '[]') : []);
              const serverMedicalTeam = plan.medical_team
                ? (typeof plan.medical_team === 'string' ? JSON.parse(plan.medical_team) : plan.medical_team)
                : null;
              const serverDischargePlan = plan.discharge_plan
                ? (typeof plan.discharge_plan === 'string' ? JSON.parse(plan.discharge_plan) : plan.discharge_plan)
                : null;

              const merged = {
                ...plan,
                synced: true,
                reviews: (existing?.reviews && existing.reviews.length > 0) ? existing.reviews : serverReviews,
                lab_works: (existing?.lab_works && existing.lab_works.length > 0) ? existing.lab_works : (plan.lab_works || []),
                planned_investigations: (existing?.planned_investigations && existing.planned_investigations.length > 0) ? existing.planned_investigations : serverInvestigations,
                planned_reviews: existing?.planned_reviews || plan.planned_reviews || [],
                planned_procedures: existing?.planned_procedures || plan.planned_procedures || [],
                planned_medications: existing?.planned_medications || plan.planned_medications || [],
                procedures: (existing?.procedures && existing.procedures.length > 0) ? existing.procedures : serverProcedures,
                medications: (existing?.medications && existing.medications.length > 0) ? existing.medications : serverMedications,
                medical_team: existing?.medical_team || serverMedicalTeam,
                discharge_plan: existing?.discharge_plan || serverDischargePlan,
                discharge_timeline: existing?.discharge_timeline || plan.discharge_timeline || null,
                planned_discharge_date: existing?.planned_discharge_date || plan.planned_discharge_date || null,
                primary_consultant: existing?.primary_consultant || plan.primary_consultant || '',
                patient_name: existing?.patient_name || plan.patient_name || [plan.first_name, plan.last_name].filter(Boolean).join(' ') || '',
                hospital_number: existing?.hospital_number || plan.hospital_number || '',
                title: existing?.title || plan.title || plan.diagnosis || plan.description || 'Treatment Plan'
              };
              await db.treatment_plans.put(merged as any);
              mergedAll.push(merged);
            } catch {
              mergedAll.push(plan);
            }
          }
          const activePlans = mergedAll.filter((p: any) => p.status === 'active');
          return activePlans.map((plan: any) => ({
            ...plan,
            id: plan.id?.toString() || '',
            patient_id: plan.patient_id?.toString() || '',
            patient_name: plan.patient_name || '',
            hospital_number: plan.hospital_number || '',
            admission_date: plan.admission_date || new Date(),
            reviews: plan.reviews || [],
            lab_works: plan.lab_works || [],
            procedures: plan.procedures || [],
            medications: plan.medications || [],
            discharge_timeline: plan.discharge_timeline || null
          })) as EnhancedTreatmentPlan[];
        }
      } catch (e) {
        console.warn('Could not fetch treatment plans from server:', e);
      }
    }
    // Fallback to local
    const plans = await db.treatment_plans.where('status').equals('active').toArray();
    return plans.map(plan => ({
      ...plan,
      id: plan.id?.toString() || '',
      patient_id: plan.patient_id.toString(),
      patient_name: plan.patient_name || '',
      hospital_number: plan.hospital_number || '',
      admission_date: plan.admission_date || new Date(),
      reviews: plan.reviews || [],
      lab_works: plan.lab_works || [],
      procedures: plan.procedures || [],
      medications: plan.medications || [],
      discharge_timeline: plan.discharge_timeline || null
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

  // ==================== MODIFICATION & APPROVAL WORKFLOW ====================

  // Check if user can directly modify (consultants) or needs approval
  canDirectlyModify(userRole: string): boolean {
    return userRole === 'consultant' || userRole === 'admin';
  }

  // Check if user can approve modifications
  canApproveModifications(userRole: string): boolean {
    return userRole === 'consultant' || userRole === 'admin';
  }

  // Check if user can request modifications
  canRequestModifications(userRole: string): boolean {
    return ['consultant', 'senior_registrar', 'junior_registrar', 'house_officer'].includes(userRole);
  }

  // Create a modification request (for non-consultants)
  async createModificationRequest(
    planId: string,
    modification: Omit<TreatmentPlanModification, 'id' | 'created_at' | 'updated_at' | 'status'>
  ): Promise<string> {
    const plan = await this.getTreatmentPlan(planId);
    if (!plan) throw new Error('Treatment plan not found');

    const modificationId = `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const modificationRequest: TreatmentPlanModification = {
      ...modification,
      id: modificationId,
      plan_id: planId,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Add to plan's pending modifications
    const pendingMods = plan.pending_modifications || [];
    pendingMods.push(modificationRequest);

    await this.updatePlanLocal(planId, {
      pending_modifications: pendingMods,
      updated_at: new Date()
    });

    // Notify consultants about pending modification
    toast.success('Modification request submitted for consultant approval', {
      icon: '📝'
    });

    return modificationId;
  }

  // Get all pending modifications for a plan
  async getPendingModifications(planId: string): Promise<TreatmentPlanModification[]> {
    const plan = await this.getTreatmentPlan(planId);
    return plan?.pending_modifications || [];
  }

  // Get all pending modifications across all plans (for consultant dashboard)
  async getAllPendingModifications(): Promise<TreatmentPlanModification[]> {
    const plans = await this.getActiveTreatmentPlans();
    const allPending: TreatmentPlanModification[] = [];
    
    for (const plan of plans) {
      if (plan.pending_modifications && plan.pending_modifications.length > 0) {
        allPending.push(...plan.pending_modifications);
      }
    }
    
    return allPending.sort((a, b) => {
      // Sort by priority first (emergency > urgent > routine)
      const priorityOrder = { emergency: 0, urgent: 1, routine: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by date (oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }

  // Approve a modification (consultant only)
  async approveModification(
    planId: string,
    modificationId: string,
    approverName: string,
    approverRole: string,
    comments?: string
  ): Promise<void> {
    if (!this.canApproveModifications(approverRole)) {
      throw new Error('You do not have permission to approve modifications');
    }

    const plan = await this.getTreatmentPlan(planId);
    if (!plan) throw new Error('Treatment plan not found');

    const pendingMods = plan.pending_modifications || [];
    const modIndex = pendingMods.findIndex(m => m.id === modificationId);
    
    if (modIndex === -1) throw new Error('Modification request not found');

    const modification = pendingMods[modIndex];
    
    // Apply the modification to the plan
    await this.applyModification(plan, modification);

    // Update modification status
    modification.status = 'approved';
    modification.reviewed_by = approverName;
    modification.reviewed_by_role = approverRole as 'consultant' | 'senior_registrar';
    modification.reviewed_at = new Date();
    modification.review_comments = comments;
    modification.updated_at = new Date();

    // Move from pending to history
    pendingMods.splice(modIndex, 1);
    const history = plan.modification_history || [];
    history.push(modification);

    await this.updatePlanLocal(planId, {
      pending_modifications: pendingMods,
      modification_history: history,
      updated_at: new Date()
    });

    toast.success('Modification approved and applied', { icon: '✅' });
  }

  // Reject a modification (consultant only)
  async rejectModification(
    planId: string,
    modificationId: string,
    approverName: string,
    approverRole: string,
    comments: string
  ): Promise<void> {
    if (!this.canApproveModifications(approverRole)) {
      throw new Error('You do not have permission to reject modifications');
    }

    const plan = await this.getTreatmentPlan(planId);
    if (!plan) throw new Error('Treatment plan not found');

    const pendingMods = plan.pending_modifications || [];
    const modIndex = pendingMods.findIndex(m => m.id === modificationId);
    
    if (modIndex === -1) throw new Error('Modification request not found');

    const modification = pendingMods[modIndex];
    
    // Update modification status
    modification.status = 'rejected';
    modification.reviewed_by = approverName;
    modification.reviewed_by_role = approverRole as 'consultant' | 'senior_registrar';
    modification.reviewed_at = new Date();
    modification.review_comments = comments;
    modification.updated_at = new Date();

    // Move from pending to history
    pendingMods.splice(modIndex, 1);
    const history = plan.modification_history || [];
    history.push(modification);

    await this.updatePlanLocal(planId, {
      pending_modifications: pendingMods,
      modification_history: history,
      updated_at: new Date()
    });

    toast.error('Modification rejected', { icon: '❌' });
  }

  // Apply a modification to a treatment plan
  private async applyModification(plan: EnhancedTreatmentPlan, modification: TreatmentPlanModification): Promise<void> {
    const updates: Partial<EnhancedTreatmentPlan> = {};

    switch (modification.modification_type) {
      case 'medication':
        const meds = plan.planned_medications || [];
        if (modification.modification_action === 'add') {
          meds.push({ ...modification.proposed_value, id: `med_${Date.now()}` });
        } else if (modification.modification_action === 'update') {
          const idx = meds.findIndex(m => m.id === modification.original_value?.id);
          if (idx !== -1) meds[idx] = { ...meds[idx], ...modification.proposed_value };
        } else if (modification.modification_action === 'remove') {
          const rmIdx = meds.findIndex(m => m.id === modification.original_value?.id);
          if (rmIdx !== -1) meds.splice(rmIdx, 1);
        }
        updates.planned_medications = meds;
        break;

      case 'investigation':
        const invs = plan.planned_investigations || [];
        if (modification.modification_action === 'add') {
          invs.push({ ...modification.proposed_value, id: `inv_${Date.now()}`, scheduled_dates: [], results: [] });
        } else if (modification.modification_action === 'update') {
          const idx = invs.findIndex(i => i.id === modification.original_value?.id);
          if (idx !== -1) invs[idx] = { ...invs[idx], ...modification.proposed_value };
        } else if (modification.modification_action === 'remove') {
          const rmIdx = invs.findIndex(i => i.id === modification.original_value?.id);
          if (rmIdx !== -1) invs.splice(rmIdx, 1);
        }
        updates.planned_investigations = invs;
        break;

      case 'procedure':
        const procs = plan.planned_procedures || [];
        if (modification.modification_action === 'add') {
          procs.push({ ...modification.proposed_value, id: `proc_${Date.now()}`, actual_dates: [] });
        } else if (modification.modification_action === 'update') {
          const idx = procs.findIndex(p => p.id === modification.original_value?.id);
          if (idx !== -1) procs[idx] = { ...procs[idx], ...modification.proposed_value };
        } else if (modification.modification_action === 'remove') {
          const rmIdx = procs.findIndex(p => p.id === modification.original_value?.id);
          if (rmIdx !== -1) procs.splice(rmIdx, 1);
        }
        updates.planned_procedures = procs;
        break;

      case 'diagnosis':
        updates.diagnosis = modification.proposed_value;
        break;

      case 'discharge':
        updates.discharge_plan = {
          ...(plan.discharge_plan || {}),
          ...modification.proposed_value
        };
        break;

      case 'general':
        Object.assign(updates, modification.proposed_value);
        break;
    }

    await this.updatePlanLocal(plan.id!, {
      ...updates,
      updated_at: new Date()
    });
  }

  // Create modification from ward round (by registrars)
  async createWardRoundModification(
    planId: string,
    wardRoundId: string,
    modificationType: TreatmentPlanModification['modification_type'],
    modificationAction: TreatmentPlanModification['modification_action'],
    proposedValue: any,
    reason: string,
    requestedBy: string,
    requestedByRole: 'senior_registrar' | 'junior_registrar' | 'house_officer',
    priority: 'routine' | 'urgent' | 'emergency' = 'routine',
    originalValue?: any
  ): Promise<string> {
    const plan = await this.getTreatmentPlan(planId);
    if (!plan) throw new Error('Treatment plan not found');

    return await this.createModificationRequest(planId, {
      plan_id: planId,
      patient_id: plan.patient_id,
      patient_name: plan.patient_name,
      requested_by: requestedBy,
      requested_by_role: requestedByRole,
      requested_at: new Date(),
      source: 'ward_round',
      ward_round_id: wardRoundId,
      modification_type: modificationType,
      modification_action: modificationAction,
      original_value: originalValue,
      proposed_value: proposedValue,
      reason: reason,
      priority: priority
    });
  }

  // Create modification from MDT specialty input
  async createMDTModification(
    planId: string,
    mdtSessionId: string,
    specialty: string,
    modificationType: TreatmentPlanModification['modification_type'],
    modificationAction: TreatmentPlanModification['modification_action'],
    proposedValue: any,
    reason: string,
    requestedBy: string,
    requestedByRole: 'senior_registrar' | 'junior_registrar',
    priority: 'routine' | 'urgent' | 'emergency' = 'routine',
    originalValue?: any
  ): Promise<string> {
    const plan = await this.getTreatmentPlan(planId);
    if (!plan) throw new Error('Treatment plan not found');

    return await this.createModificationRequest(planId, {
      plan_id: planId,
      patient_id: plan.patient_id,
      patient_name: plan.patient_name,
      requested_by: requestedBy,
      requested_by_role: requestedByRole,
      requested_at: new Date(),
      source: 'mdt_review',
      mdt_session_id: mdtSessionId,
      specialty_input: specialty,
      modification_type: modificationType,
      modification_action: modificationAction,
      original_value: originalValue,
      proposed_value: proposedValue,
      reason: reason,
      clinical_justification: `MDT recommendation from ${specialty}`,
      priority: priority
    });
  }

  // Direct modification by consultant (no approval needed)
  async directModification(
    planId: string,
    modificationType: TreatmentPlanModification['modification_type'],
    modificationAction: TreatmentPlanModification['modification_action'],
    proposedValue: any,
    reason: string,
    modifiedBy: string,
    modifiedByRole: string,
    originalValue?: any
  ): Promise<void> {
    if (!this.canDirectlyModify(modifiedByRole)) {
      throw new Error('You must submit a modification request for approval');
    }

    const plan = await this.getTreatmentPlan(planId);
    if (!plan) throw new Error('Treatment plan not found');

    // Create a modification record for history
    const modification: TreatmentPlanModification = {
      id: `mod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      plan_id: planId,
      patient_id: plan.patient_id,
      patient_name: plan.patient_name,
      requested_by: modifiedBy,
      requested_by_role: modifiedByRole as any,
      requested_at: new Date(),
      source: 'direct_edit',
      modification_type: modificationType,
      modification_action: modificationAction,
      original_value: originalValue,
      proposed_value: proposedValue,
      reason: reason,
      status: 'auto_approved',
      reviewed_by: modifiedBy,
      reviewed_by_role: 'consultant',
      reviewed_at: new Date(),
      priority: 'routine',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Apply the modification
    await this.applyModification(plan, modification);

    // Add to history
    const history = plan.modification_history || [];
    history.push(modification);

    await this.updatePlanLocal(planId, {
      modification_history: history,
      updated_at: new Date()
    });

    toast.success('Treatment plan updated', { icon: '✅' });
  }
}

export const treatmentPlanningService = new TreatmentPlanningService();
