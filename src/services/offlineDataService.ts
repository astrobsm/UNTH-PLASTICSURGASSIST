import { db, Patient, TreatmentPlan, PlanStep } from '../db/database';
import { syncService } from '../db/syncService';
import toast from 'react-hot-toast';

export interface CreatePatientData {
  hospital_number: string;
  first_name: string;
  last_name: string;
  dob: string;
  sex: 'male' | 'female' | 'other';
  phone?: string;
  address?: string;
  allergies?: string[];
  comorbidities?: string[];
}

export interface CreateTreatmentPlanData {
  patient_id: number;
  title: string;
  diagnosis: string;
  start_date: Date;
  planned_end_date?: Date;
  description?: string;
}

export interface CreatePlanStepData {
  plan_id: number;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: Date;
  duration?: number;
}

class OfflineDataService {
  // Patient operations
  async createPatient(data: CreatePatientData): Promise<number> {
    try {
      const patientId = await db.patients.add({
        ...data,
        created_at: new Date(),
        updated_at: new Date(),
        synced: false
      });

      // Queue for sync
      await syncService.queueAction('create', 'patients', patientId, data);
      
      toast.success(`Patient ${data.first_name} ${data.last_name} created ${navigator.onLine ? '' : '(offline)'}`);
      return patientId;
    } catch (error) {
      toast.error('Failed to create patient');
      throw error;
    }
  }

  async getPatients(): Promise<Patient[]> {
    return db.patients
      .where('deleted')
      .notEqual(true)
      .toArray();
  }

  async getPatient(id: number): Promise<Patient | undefined> {
    return db.patients.get(id);
  }

  async updatePatient(id: number, data: Partial<Patient>): Promise<void> {
    try {
      await db.patients.update(id, {
        ...data,
        updated_at: new Date(),
        synced: false
      });

      await syncService.queueAction('update', 'patients', id, data);
      toast.success('Patient updated');
    } catch (error) {
      toast.error('Failed to update patient');
      throw error;
    }
  }

  // Treatment Plan operations
  async createTreatmentPlan(data: CreateTreatmentPlanData): Promise<number> {
    try {
      const planId = await db.treatment_plans.add({
        ...data,
        status: 'draft',
        created_by: 'current_user', // Replace with actual user ID
        created_at: new Date(),
        updated_at: new Date(),
        synced: false
      });

      await syncService.queueAction('create', 'treatment_plans', planId, data);
      
      toast.success(`Treatment plan "${data.title}" created ${navigator.onLine ? '' : '(offline)'}`);
      return planId;
    } catch (error) {
      toast.error('Failed to create treatment plan');
      throw error;
    }
  }

  async getTreatmentPlans(patientId?: number): Promise<TreatmentPlan[]> {
    let query = db.treatment_plans.where('deleted').notEqual(true);
    
    if (patientId) {
      query = query.and(plan => plan.patient_id === patientId);
    }
    
    return query.toArray();
  }

  async getTreatmentPlan(id: number): Promise<TreatmentPlan | undefined> {
    return db.treatment_plans.get(id);
  }

  async updateTreatmentPlan(id: number, data: Partial<TreatmentPlan>): Promise<void> {
    try {
      await db.treatment_plans.update(id, {
        ...data,
        updated_at: new Date(),
        synced: false
      });

      await syncService.queueAction('update', 'treatment_plans', id, data);
      toast.success('Treatment plan updated');
    } catch (error) {
      toast.error('Failed to update treatment plan');
      throw error;
    }
  }

  // Plan Step operations
  async createPlanStep(data: CreatePlanStepData): Promise<number> {
    try {
      // Get the highest step number for this plan
      const existingSteps = await db.plan_steps
        .where('plan_id')
        .equals(data.plan_id)
        .and(step => !step.deleted)
        .toArray();
      
      const stepNumber = Math.max(0, ...existingSteps.map(s => s.step_number)) + 1;

      const stepId = await db.plan_steps.add({
        ...data,
        step_number: stepNumber,
        status: 'pending',
        created_at: new Date(),
        updated_at: new Date(),
        synced: false
      });

      await syncService.queueAction('create', 'plan_steps', stepId, data);
      
      toast.success(`Step "${data.title}" added ${navigator.onLine ? '' : '(offline)'}`);
      return stepId;
    } catch (error) {
      toast.error('Failed to create plan step');
      throw error;
    }
  }

  async getPlanSteps(planId: number): Promise<PlanStep[]> {
    return db.plan_steps
      .where('plan_id')
      .equals(planId)
      .and(step => !step.deleted)
      .sortBy('step_number');
  }

  async updatePlanStep(id: number, data: Partial<PlanStep>): Promise<void> {
    try {
      await db.plan_steps.update(id, {
        ...data,
        updated_at: new Date(),
        synced: false
      });

      await syncService.queueAction('update', 'plan_steps', id, data);
      toast.success('Step updated');
    } catch (error) {
      toast.error('Failed to update step');
      throw error;
    }
  }

  async completePlanStep(id: number, notes?: string): Promise<void> {
    try {
      await db.plan_steps.update(id, {
        status: 'completed',
        completed_at: new Date(),
        notes,
        updated_at: new Date(),
        synced: false
      });

      await syncService.queueAction('update', 'plan_steps', id, {
        status: 'completed',
        completed_at: new Date(),
        notes
      });

      toast.success('Step marked as completed');
    } catch (error) {
      toast.error('Failed to complete step');
      throw error;
    }
  }

  // Get full treatment plan with steps and patient info
  async getFullTreatmentPlan(planId: number) {
    const plan = await this.getTreatmentPlan(planId);
    if (!plan) return null;

    const patient = await this.getPatient(plan.patient_id);
    const steps = await this.getPlanSteps(planId);

    return {
      plan,
      patient,
      steps
    };
  }

  // Demo data creation
  async createDemoData(): Promise<void> {
    try {
      // Create demo patient
      const patientId = await this.createPatient({
        hospital_number: 'PSA-2025-001',
        first_name: 'Jane',
        last_name: 'Doe',
        dob: '1985-03-15',
        sex: 'female',
        phone: '+234-800-123-4567',
        address: '123 Hospital Road, Lagos',
        allergies: ['Penicillin', 'Latex'],
        comorbidities: ['Hypertension']
      });

      // Create demo treatment plan
      const planId = await this.createTreatmentPlan({
        patient_id: patientId,
        title: 'Left Leg Skin Graft Treatment',
        diagnosis: 'Chronic wound - left lower limb',
        start_date: new Date(),
        planned_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        description: 'Split-thickness skin graft for chronic wound management'
      });

      // Create demo steps
      await this.createPlanStep({
        plan_id: planId,
        title: 'Pre-operative Assessment',
        description: 'Complete medical history, physical exam, and lab work',
        due_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
        duration: 60
      });

      await this.createPlanStep({
        plan_id: planId,
        title: 'Laboratory Tests',
        description: 'CBC, electrolytes, clotting profile, blood grouping',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        duration: 30
      });

      await this.createPlanStep({
        plan_id: planId,
        title: 'Anesthesia Consultation',
        description: 'Anesthetic assessment and clearance',
        due_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        duration: 45
      });

      await this.createPlanStep({
        plan_id: planId,
        title: 'Surgery - Skin Graft',
        description: 'Split-thickness skin graft procedure',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Week
        duration: 120
      });

      toast.success('Demo data created successfully!');
      
    } catch (error) {
      toast.error('Failed to create demo data');
      throw error;
    }
  }

  // Get sync status
  async getSyncStatus() {
    return syncService.getSyncStatus();
  }

  // Force sync
  async forceSync() {
    return syncService.forceSync();
  }
}

export const offlineDataService = new OfflineDataService();