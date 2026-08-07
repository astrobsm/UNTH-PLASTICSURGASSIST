import { db } from '../db/database';
import { apiClient } from './apiClient';
import { syncService } from '../db/syncService';
// pushNotificationService is loaded dynamically (see notifyAdmission helper below)
// to avoid pulling web-push dependencies into the main bundle.
import { logger } from '../utils/logger';
import { format } from 'date-fns';
import {
  createPDF,
  addPDFHeader,
  addSectionHeader,
  addBodyText,
  addBulletList,
  addWarningBox,
  addSeparator,
  addFooter,
  addLabeledField,
  sanitizeTextForPDF,
  formatDateForPDF,
  PDF_MARGINS,
  PDF_COLORS,
  PDF_FONT_SIZES
} from '../utils/pdfUtils';

// ============= INTERFACES =============

export interface VitalSigns {
  temperature?: number;
  blood_pressure?: string;
  pulse?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  pain_score?: number;
}

export interface Admission {
  id?: number;
  patient_id: number;
  patient_name: string;
  hospital_number: string;
  age?: number;
  gender?: string;
  admission_date: string;
  admission_time: string;
  ward_location: string;
  bed_number?: string;
  route_of_admission: 'clinic' | 'emergency' | 'consult_transfer';
  referring_specialty?: string;
  referring_doctor?: string;
  reasons_for_admission: string;
  presenting_complaint: string;
  provisional_diagnosis: string;
  admitting_doctor: string;
  admitting_consultant?: string;
  admitting_unit?: string;
  vital_signs?: VitalSigns;
  allergies?: string;
  current_medications?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  social_history?: string;
  family_history?: string;
  comorbidities?: string[];
  examination_findings?: string;
  initial_management_plan?: string;
  status: 'active' | 'discharged' | 'transferred' | 'deceased';
  discharge_date?: string;
  // When the unit became responsible for this patient: the day the consult was
  // sent for our review if they were referred, otherwise the admission date.
  // Resolved server-side — see api/_lib/careDuration.js.
  care_start_date?: string | null;
  care_start_source?: 'consult' | 'admission' | null;
  care_consult_ref?: string | null;
  // Persistent house officer assignment (set on admission, kept until discharge or HO finishes both rotations)
  assigned_house_officer?: string;
  assigned_house_officer_id?: string | number;
  assigned_unit?: string;
  // Geo-stamp captured at admission for accountability / location verification
  admission_lat?: number | null;
  admission_lng?: number | null;
  admission_accuracy_m?: number | null;
  admission_address?: string | null;
  admission_geofence?: string | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// WHO Discharge Readiness Score based on WHO guidelines for safe discharge
export interface WHODischargeScore {
  id?: number;
  admission_id: number;
  patient_id: number;
  assessment_date: string;
  assessed_by: string;
  
  // Clinical Stability (0-3 points each)
  vital_signs_stable: number; // 0=Unstable, 1=Borderline, 2=Stable 24h, 3=Stable 48h+
  pain_controlled: number; // 0=Severe, 1=Moderate, 2=Mild, 3=Minimal/None
  oral_intake_adequate: number; // 0=NPO, 1=Liquids only, 2=Soft diet, 3=Regular diet
  mobility_status: number; // 0=Bedbound, 1=Needs assistance, 2=Walks with aid, 3=Independent
  wound_healing_status: number; // 0=Infected, 1=Concerning, 2=Healing, 3=Well-healed
  
  // Functional Readiness (0-3 points each)
  self_care_ability: number; // 0=Dependent, 1=Needs help, 2=Minimal help, 3=Independent
  medication_understanding: number; // 0=None, 1=Poor, 2=Moderate, 3=Good
  follow_up_arranged: number; // 0=No, 1=Pending, 2=Partially, 3=Complete
  
  // Social Support (0-3 points each)
  caregiver_available: number; // 0=None, 1=Occasionally, 2=Most times, 3=Always
  transport_arranged: number; // 0=No, 1=Uncertain, 2=Planned, 3=Confirmed
  home_environment_safe: number; // 0=Unsafe, 1=Concerns, 2=Acceptable, 3=Safe
  
  // Additional Risk Factors (negative points)
  high_readmission_risk: boolean; // -2 points
  complex_medical_needs: boolean; // -2 points
  language_barrier: boolean; // -1 point
  
  total_score: number; // Max 33, minus risk factors
  recommendation: 'fit_for_discharge' | 'discharge_on_request' | 'against_medical_advice' | 'not_ready';
  notes?: string;
  created_at: Date;
}

export interface DischargeMedication {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  route: string;
  instructions?: string;
  prescribing_specialty?: string; // For MDT harmonization
  is_mdt_harmonized?: boolean;
}

export interface MDTMedicationReview {
  id?: number;
  admission_id: number;
  patient_id: number;
  review_date: string;
  reviewed_by: string;
  specialties_involved: string[];
  medications: DischargeMedication[];
  drug_interactions_checked: boolean;
  duplicate_therapy_resolved: boolean;
  dosage_adjustments_made: string[];
  discontinued_medications: string[];
  rationale: string;
  final_medication_list: DischargeMedication[];
  approved_by_consultant: boolean;
  consultant_name?: string;
  created_at: Date;
}

export interface Discharge {
  id?: number;
  admission_id: number;
  patient_id: number;
  patient_name: string;
  hospital_number: string;
  age?: number;
  gender?: string;
  admission_date: string;
  discharge_date: string;
  discharge_time: string;
  length_of_stay_days: number;
  
  // Diagnosis
  admitting_diagnosis: string;
  final_diagnosis: string;
  secondary_diagnoses?: string[];
  procedures_performed?: string[];
  
  // WHO Discharge Assessment
  who_discharge_score_id?: number;
  discharge_readiness_score: number;
  
  // Discharge Classification
  discharge_type: 'normal' | 'on_request' | 'against_medical_advice' | 'transfer' | 'deceased';
  discharge_destination: 'home' | 'another_facility' | 'rehabilitation' | 'nursing_home' | 'mortuary' | 'other';
  
  // Discharge Summary
  hospital_course_summary: string;
  condition_at_discharge: string;
  
  // Medications (MDT Harmonized)
  medications_on_discharge: DischargeMedication[];
  mdt_medication_review_id?: number;
  
  // Instructions
  dietary_recommendations?: string;
  meal_plan_7_day?: MealPlan;
  lifestyle_modifications?: string[];
  activity_restrictions?: string[];
  wound_care_instructions?: string;
  warning_signs?: string[];
  
  // Follow-up
  follow_up_appointments?: FollowUpAppointment[];
  
  // Certificates & Reports
  fitness_for_discharge_report?: string;
  medical_certificate?: string;
  
  // AI-Generated Content
  ai_generated_summary?: string;
  ai_generated_instructions?: string;
  
  // Sign-off
  discharging_doctor: string;
  discharging_consultant?: string;
  patient_acknowledged: boolean;
  relative_acknowledged: boolean;
  acknowledgement_signature?: string;
  
  created_by: string;
  created_at: Date;
  updated_at: Date;

  // Alternate field names used in some components
  discharge_instructions?: string;
  medications?: DischargeMedication[];
}

export interface FollowUpAppointment {
  date: string;
  time?: string;
  clinic: string;
  doctor?: string;
  purpose: string;
  special_instructions?: string;
}

export interface MealPlan {
  day1: DayMeals;
  day2: DayMeals;
  day3: DayMeals;
  day4: DayMeals;
  day5: DayMeals;
  day6: DayMeals;
  day7: DayMeals;
  special_considerations: string[];
  foods_to_avoid: string[];
  hydration_goals: string;
}

export interface DayMeals {
  breakfast: string;
  mid_morning_snack: string;
  lunch: string;
  afternoon_snack: string;
  dinner: string;
  notes?: string;
}

export interface AdmissionStatistics {
  total_admissions: number;
  active_admissions: number;
  admissions_this_month: number;
  discharges_this_month: number;
  average_length_of_stay: number;
  by_route: {
    clinic: number;
    emergency: number;
    consult_transfer: number;
  };
  by_ward: Record<string, number>;
  by_discharge_type: {
    normal: number;
    on_request: number;
    against_medical_advice: number;
    transfer: number;
    deceased: number;
  };
}

// ============= SERVICE CLASS =============

class AdmissionDischargeService {
  
  // ============= ADMISSION METHODS =============
  
  async createAdmission(admissionData: Omit<Admission, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const now = new Date();
    const admission: Omit<Admission, 'id'> = {
      ...admissionData,
      created_at: now,
      updated_at: now
    };

    try {
      // Try to save to API first
      const savedAdmission = await apiClient.createAdmission(admission);
      
      if (savedAdmission && savedAdmission.id) {
        // Save to local DB with server ID
        await db.admissions.add({
          ...admission,
          id: savedAdmission.id,
          synced: true
        } as any);
        logger.log('✅ Admission synced to server:', savedAdmission.id);
        
        // Send notification to all users with voice announcement (lazy-loaded)
        try {
          const { pushNotificationService } = await import('./pushNotificationService');
          await pushNotificationService.notifyPatientAdmitted(
            admissionData.patient_name,
            admissionData.hospital_number,
            admissionData.ward_location
          );
        } catch (e) { logger.warn('Push notification failed (non-fatal):', e); }
        
        return savedAdmission.id;
      }
    } catch (error) {
      logger.warn('⚠️ Failed to sync admission to server, saving locally:', error);
    }

    // Fallback: save locally only
    const localId = await db.admissions.add({ ...admission, synced: false } as any);
    logger.log('📱 Admission saved locally, will sync when online:', localId);
    
    // Queue for sync
    await syncService.queueAction('create', 'admissions', localId as number, admission);
    
    // Send notification even for local-only save (lazy-loaded)
    try {
      const { pushNotificationService } = await import('./pushNotificationService');
      await pushNotificationService.notifyPatientAdmitted(
        admissionData.patient_name,
        admissionData.hospital_number,
        admissionData.ward_location
      );
    } catch (e) { logger.warn('Push notification failed (non-fatal):', e); }
    
    return localId as number;
  }

  async getAdmission(id: number): Promise<Admission | undefined> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverAdmission = await apiClient.getAdmission(String(id));
        if (serverAdmission) {
          await db.admissions.put({ ...serverAdmission, synced: true });
          return serverAdmission;
        }
      } catch (e) {
        console.warn('Could not fetch admission from server:', e);
      }
    }
    return await db.admissions.get(id);
  }

  // Deduplication: reuse in-flight request and cache briefly
  private _admInflight: Promise<Admission[]> | null = null;
  private _admCache: Admission[] | null = null;
  private _admCacheTime = 0;
  private static ADM_CACHE_TTL = 30_000; // 30 seconds

  /** Drop the in-memory admissions cache (call after a patient edit so the
   *  admissions board picks up the new patient name/number immediately). */
  clearCache(): void {
    this._admCache = null;
    this._admCacheTime = 0;
  }

  async getActiveAdmissions(): Promise<Admission[]> {
    if (this._admCache && Date.now() - this._admCacheTime < AdmissionDischargeService.ADM_CACHE_TTL) {
      return this._admCache;
    }
    if (this._admInflight) {
      return this._admInflight;
    }
    this._admInflight = this._fetchActiveAdmissions().finally(() => { this._admInflight = null; });
    return this._admInflight;
  }

  private async _fetchActiveAdmissions(): Promise<Admission[]> {
    let serverSuccess = false;
    try {
      const serverAdmissions = await apiClient.getAdmissions();
      if (serverAdmissions && Array.isArray(serverAdmissions)) {
        serverSuccess = true;
        // Clear old synced admissions and replace with fresh server data
        const existingAdmissions = await db.admissions.toArray();
        const syncedIds = existingAdmissions.filter(a => a.synced).map(a => a.id);
        if (syncedIds.length > 0) {
          await db.admissions.bulkDelete(syncedIds);
        }
        for (const admission of serverAdmissions) {
          await db.admissions.put({ ...admission, synced: true });
        }
      }
    } catch (error) {
      console.warn('Could not fetch admissions from server, using local data');
    }

    const admissions = await db.admissions.toArray();
    const activeAdmissions = admissions
      .filter(a => a.status === 'active')
      // Filter out ghost admissions with no patient data
      .filter(a => (a.patient_name && a.patient_name.trim()) || (a.hospital_number && a.hospital_number.trim()))
      .sort((a, b) => new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime());

    this._admCache = activeAdmissions;
    this._admCacheTime = Date.now();
    return activeAdmissions;
  }

  async getPatientAdmissions(patientId: number): Promise<Admission[]> {
    try {
      // Try to fetch latest from server
      const serverAdmissions = await apiClient.getAdmissions();
      if (serverAdmissions && Array.isArray(serverAdmissions)) {
        for (const admission of serverAdmissions) {
          await db.admissions.put({ ...admission, synced: true });
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch patient admissions from server');
    }

    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.patient_id === patientId)
      .sort((a, b) => new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime());
  }

  async updateAdmission(id: number, updates: Partial<Admission>): Promise<void> {
    await db.admissions.update(id, {
      ...updates,
      updated_at: new Date()
    });
    // Sync to server
    if (navigator.onLine) {
      try {
        await apiClient.updateAdmission(String(id), updates);
      } catch (e) {
        console.warn('Could not update admission on server:', e);
      }
    }
  }

  async markAsDischargedAdmission(admissionId: number): Promise<void> {
    await db.admissions.update(admissionId, {
      status: 'discharged',
      discharge_date: new Date().toISOString().split('T')[0],
      updated_at: new Date()
    });
  }

  async getAdmissionsByWard(ward: string): Promise<Admission[]> {
    // Fetch from server first
    if (navigator.onLine) {
      try {
        const serverAdmissions = await apiClient.getAdmissions();
        if (Array.isArray(serverAdmissions)) {
          for (const admission of serverAdmissions) {
            await db.admissions.put({ ...admission, synced: true });
          }
        }
      } catch (e) {
        console.warn('Could not fetch admissions from server:', e);
      }
    }
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.ward_location === ward && a.status === 'active')
      .sort((a, b) => new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime());
  }

  // ============= SYNC METHODS =============

  async syncUnsyncedAdmissions(): Promise<void> {
    console.log('🔄 Syncing unsynced admissions...');
    
    // Get all unsynced admissions
    const unsyncedAdmissions = await db.admissions
      .filter(a => a.synced === false)
      .toArray();
    
    console.log(`📊 Found ${unsyncedAdmissions.length} unsynced admissions`);
    
    for (const admission of unsyncedAdmissions) {
      try {
        // Queue for sync via syncService
        await syncService.queueAction('create', 'admissions', admission.id!, admission);
        console.log(`✅ Queued admission ${admission.id} for sync`);
      } catch (error) {
        console.error(`❌ Failed to queue admission ${admission.id}:`, error);
      }
    }
    
    // Note: syncService will automatically process queue on next sync cycle
    console.log('✅ Admissions queued for background sync');
  }

  // ============= WHO DISCHARGE SCORING =============

  calculateWHODischargeScore(assessment: Omit<WHODischargeScore, 'id' | 'created_at' | 'total_score' | 'recommendation'>): WHODischargeScore {
    // Calculate base score
    let totalScore = 
      assessment.vital_signs_stable +
      assessment.pain_controlled +
      assessment.oral_intake_adequate +
      assessment.mobility_status +
      assessment.wound_healing_status +
      assessment.self_care_ability +
      assessment.medication_understanding +
      assessment.follow_up_arranged +
      assessment.caregiver_available +
      assessment.transport_arranged +
      assessment.home_environment_safe;

    // Subtract risk factors
    if (assessment.high_readmission_risk) totalScore -= 2;
    if (assessment.complex_medical_needs) totalScore -= 2;
    if (assessment.language_barrier) totalScore -= 1;

    // Determine recommendation
    let recommendation: WHODischargeScore['recommendation'];
    if (totalScore >= 27) {
      recommendation = 'fit_for_discharge';
    } else if (totalScore >= 20) {
      recommendation = 'discharge_on_request';
    } else if (totalScore >= 12) {
      recommendation = 'against_medical_advice';
    } else {
      recommendation = 'not_ready';
    }

    return {
      ...assessment,
      created_at: new Date(),
      total_score: totalScore,
      recommendation
    };
  }

  async saveWHODischargeScore(score: Omit<WHODischargeScore, 'id' | 'created_at'>): Promise<number> {
    const calculatedScore = this.calculateWHODischargeScore(score);
    const scoreWithDate = {
      ...calculatedScore,
      created_at: new Date()
    };
    
    // Store in a dedicated table or within admissions
    // For now, we'll add to a generic storage
    const id = await db.table('who_discharge_scores').add(scoreWithDate);
    return id as number;
  }

  async getWHODischargeScore(admissionId: number): Promise<WHODischargeScore | undefined> {
    const scores = await db.table('who_discharge_scores').toArray();
    return scores
      .filter((s: WHODischargeScore) => s.admission_id === admissionId)
      .sort((a: WHODischargeScore, b: WHODischargeScore) => 
        new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime()
      )[0];
  }

  getDischargeTypeFromScore(score: number): 'normal' | 'on_request' | 'against_medical_advice' | 'not_ready' {
    if (score >= 27) return 'normal';
    if (score >= 20) return 'on_request';
    if (score >= 12) return 'against_medical_advice';
    return 'not_ready';
  }

  // ============= MDT MEDICATION HARMONIZATION =============

  async createMDTMedicationReview(review: Omit<MDTMedicationReview, 'id' | 'created_at'>): Promise<number> {
    const reviewWithDate = {
      ...review,
      created_at: new Date()
    };
    const id = await db.table('mdt_medication_reviews').add(reviewWithDate);
    return id as number;
  }

  async getMDTMedicationReview(admissionId: number): Promise<MDTMedicationReview | undefined> {
    const reviews = await db.table('mdt_medication_reviews').toArray();
    return reviews
      .filter((r: MDTMedicationReview) => r.admission_id === admissionId)
      .sort((a: MDTMedicationReview, b: MDTMedicationReview) => 
        new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
      )[0];
  }

  harmonizeMDTMedications(medicationsBySpecialty: Record<string, DischargeMedication[]>): {
    harmonizedMedications: DischargeMedication[];
    duplicates: string[];
    interactions: string[];
    recommendations: string[];
  } {
    const allMedications: DischargeMedication[] = [];
    const duplicates: string[] = [];
    const interactions: string[] = [];
    const recommendations: string[] = [];
    const seenMedications = new Map<string, DischargeMedication>();

    // Common drug interactions to check
    const interactionPairs = [
      ['warfarin', 'aspirin'],
      ['ace inhibitor', 'potassium'],
      ['metformin', 'contrast dye'],
      ['nsaid', 'anticoagulant'],
      ['digoxin', 'amiodarone'],
      ['statin', 'fibrate'],
    ];

    // Collect all medications
    Object.entries(medicationsBySpecialty).forEach(([specialty, meds]) => {
      meds.forEach(med => {
        med.prescribing_specialty = specialty;
        allMedications.push(med);
      });
    });

    // Check for duplicates and harmonize
    allMedications.forEach(med => {
      const medNameLower = med.medication.toLowerCase();
      const existingMed = seenMedications.get(medNameLower);

      if (existingMed) {
        duplicates.push(`${med.medication} prescribed by ${med.prescribing_specialty} and ${existingMed.prescribing_specialty}`);
        // Keep the one with more specific instructions or higher dosage if appropriate
        if ((med.instructions?.length || 0) > (existingMed.instructions?.length || 0)) {
          seenMedications.set(medNameLower, { ...med, is_mdt_harmonized: true });
        }
      } else {
        seenMedications.set(medNameLower, { ...med, is_mdt_harmonized: true });
      }
    });

    // Check for drug interactions
    const medNames = Array.from(seenMedications.keys());
    interactionPairs.forEach(([drug1, drug2]) => {
      const hasDrug1 = medNames.some(m => m.includes(drug1));
      const hasDrug2 = medNames.some(m => m.includes(drug2));
      if (hasDrug1 && hasDrug2) {
        interactions.push(`Potential interaction: ${drug1} and ${drug2} - review required`);
      }
    });

    // Generate recommendations
    if (duplicates.length > 0) {
      recommendations.push('Duplicate medications detected - please review and consolidate');
    }
    if (interactions.length > 0) {
      recommendations.push('Drug interactions detected - consider dose adjustments or alternatives');
    }
    if (seenMedications.size > 5) {
      recommendations.push('Multiple medications prescribed - ensure patient understands medication schedule');
    }

    return {
      harmonizedMedications: Array.from(seenMedications.values()),
      duplicates,
      interactions,
      recommendations
    };
  }

  // ============= DISCHARGE METHODS =============

  async createDischarge(dischargeData: Omit<Discharge, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const now = new Date();
    const discharge: Omit<Discharge, 'id'> = {
      ...dischargeData,
      created_at: now,
      updated_at: now
    };

    try {
      // Try to save to API first
      const savedDischarge = await apiClient.createDischarge(discharge);
      
      if (savedDischarge && savedDischarge.id) {
        // Save to local DB with server ID
        await db.discharges.add({
          ...discharge,
          id: savedDischarge.id,
          synced: true
        } as any);

        // Update admission status
        if (dischargeData.admission_id) {
          await db.admissions.update(dischargeData.admission_id, {
            status: dischargeData.discharge_type === 'deceased' ? 'deceased' : 
                    dischargeData.discharge_type === 'transfer' ? 'transferred' : 'discharged',
            discharge_date: dischargeData.discharge_date,
            updated_at: now
          });
        }

        console.log('✅ Discharge synced to server:', savedDischarge.id);
        return savedDischarge.id;
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync discharge to server, saving locally:', error);
    }

    // Fallback: save locally only
    const localId = await db.discharges.add({ ...discharge, synced: false } as any);
    console.log('📱 Discharge saved locally, will sync when online:', localId);

    // Update admission status locally
    if (dischargeData.admission_id) {
      await db.admissions.update(dischargeData.admission_id, {
        status: dischargeData.discharge_type === 'deceased' ? 'deceased' : 
                dischargeData.discharge_type === 'transfer' ? 'transferred' : 'discharged',
        discharge_date: dischargeData.discharge_date,
        updated_at: now
      });
    }

    // Queue for sync
    await syncService.queueAction('create', 'discharges', localId as number, discharge);

    return localId as number;
  }

  async getDischarge(id: number): Promise<Discharge | undefined> {
    return await db.discharges.get(id);
  }

  async getAllDischarges(): Promise<Discharge[]> {
    // Fetch from server first
    if (navigator.onLine) {
      try {
        const serverDischarges = await apiClient.getDischarges();
        if (Array.isArray(serverDischarges)) {
          for (const discharge of serverDischarges) {
            await db.discharges.put({ ...discharge, synced: true });
          }
        }
      } catch (e) {
        console.warn('Could not fetch discharges from server:', e);
      }
    }
    const discharges = await db.discharges.toArray();
    return discharges.sort((a, b) => 
      new Date(b.discharge_date).getTime() - new Date(a.discharge_date).getTime()
    );
  }

  async getPatientDischarges(patientId: number): Promise<Discharge[]> {
    // Fetch from server first
    if (navigator.onLine) {
      try {
        const serverDischarges = await apiClient.getDischarges();
        if (Array.isArray(serverDischarges)) {
          for (const discharge of serverDischarges) {
            await db.discharges.put({ ...discharge, synced: true });
          }
        }
      } catch (e) {
        console.warn('Could not fetch discharges from server:', e);
      }
    }
    const discharges = await db.discharges.toArray();
    return discharges
      .filter(d => d.patient_id === patientId)
      .sort((a, b) => new Date(b.discharge_date).getTime() - new Date(a.discharge_date).getTime());
  }

  // ============= 7-DAY MEAL PLAN GENERATOR =============

  generate7DayMealPlan(comorbidities: string[], diagnosis: string): MealPlan {
    const conditions = comorbidities.map(c => c.toLowerCase());
    const diagnosisLower = diagnosis.toLowerCase();
    
    const specialConsiderations: string[] = [];
    const foodsToAvoid: string[] = [];
    let hydrationGoals = '8-10 glasses (2-2.5L) of water daily';

    // Condition-specific modifications
    if (conditions.includes('diabetes') || conditions.includes('diabetic')) {
      specialConsiderations.push('Low glycemic index foods preferred');
      specialConsiderations.push('Regular meal timing to maintain blood sugar');
      foodsToAvoid.push('Refined sugars', 'White bread', 'Sugary drinks', 'Processed snacks');
    }

    if (conditions.includes('hypertension') || conditions.includes('high blood pressure')) {
      specialConsiderations.push('Low sodium diet (< 2g sodium/day)');
      specialConsiderations.push('DASH diet principles recommended');
      foodsToAvoid.push('Processed foods', 'Canned foods', 'Salted snacks', 'Pickles');
    }

    if (conditions.includes('ckd') || conditions.includes('kidney disease') || conditions.includes('renal')) {
      specialConsiderations.push('Moderate protein intake');
      specialConsiderations.push('Low phosphorus and potassium');
      foodsToAvoid.push('High potassium fruits (bananas, oranges)', 'Nuts', 'Dairy products', 'Processed meats');
      hydrationGoals = 'As advised by doctor - may need fluid restriction';
    }

    if (conditions.includes('heart failure') || conditions.includes('cardiac')) {
      specialConsiderations.push('Low sodium, low fat diet');
      specialConsiderations.push('Small frequent meals');
      foodsToAvoid.push('Fried foods', 'Red meat', 'Full-fat dairy', 'Alcohol');
      hydrationGoals = '1.5-2L daily unless otherwise advised';
    }

    if (diagnosisLower.includes('burn') || diagnosisLower.includes('wound') || diagnosisLower.includes('surgery')) {
      specialConsiderations.push('High protein diet for wound healing');
      specialConsiderations.push('Vitamin C and Zinc rich foods');
      specialConsiderations.push('Adequate calorie intake');
    }

    // Base meal plan (modified based on conditions)
    const baseMeals: DayMeals = {
      breakfast: 'Whole grain porridge with fresh fruits, boiled egg, and green tea',
      mid_morning_snack: 'Fresh fruit (apple/pear) with a handful of unsalted nuts',
      lunch: 'Grilled fish/chicken with brown rice and steamed vegetables',
      afternoon_snack: 'Low-fat yogurt with cucumber slices',
      dinner: 'Vegetable soup with lean protein and whole grain bread',
      notes: 'Drink water 30 minutes before meals'
    };

    // Generate 7 days with variations
    const createDayMeals = (day: number): DayMeals => {
      const proteins = ['grilled fish', 'baked chicken', 'lean beef', 'beans/lentils', 'egg', 'tofu', 'turkey'];
      const grains = ['brown rice', 'whole wheat bread', 'oatmeal', 'millet', 'quinoa'];
      const vegetables = ['spinach', 'carrots', 'broccoli', 'green beans', 'cabbage', 'tomatoes', 'okra'];
      
      const protein = proteins[day % proteins.length];
      const grain = grains[day % grains.length];
      const veg1 = vegetables[day % vegetables.length];
      const veg2 = vegetables[(day + 2) % vegetables.length];

      return {
        breakfast: day % 2 === 0 
          ? `Whole grain ${grain} with boiled egg and fresh vegetables`
          : `Oatmeal porridge with fruits, nuts and honey`,
        mid_morning_snack: day % 2 === 0 
          ? 'Fresh seasonal fruit with herbal tea'
          : 'Vegetable sticks with hummus',
        lunch: `${protein.charAt(0).toUpperCase() + protein.slice(1)} with ${grain} and steamed ${veg1}`,
        afternoon_snack: day % 2 === 0 
          ? 'Low-fat yogurt with fruits'
          : 'Handful of mixed nuts and seeds',
        dinner: `Light ${veg2} soup with ${day % 2 === 0 ? 'grilled chicken strips' : 'fish fillet'} and salad`,
        notes: `Day ${day + 1}: Remember to take medications as prescribed`
      };
    };

    return {
      day1: createDayMeals(0),
      day2: createDayMeals(1),
      day3: createDayMeals(2),
      day4: createDayMeals(3),
      day5: createDayMeals(4),
      day6: createDayMeals(5),
      day7: createDayMeals(6),
      special_considerations: specialConsiderations,
      foods_to_avoid: foodsToAvoid,
      hydration_goals: hydrationGoals
    };
  }

  // ============= AUTO-GENERATED DOCUMENTS =============

  generateDischargeSummary(discharge: Discharge, admission: Admission): string {
    const lengthOfStay = discharge.length_of_stay_days;
    
    let summary = `DISCHARGE SUMMARY\n`;
    summary += `${'='.repeat(50)}\n\n`;
    
    summary += `PATIENT INFORMATION\n`;
    summary += `-`.repeat(30) + `\n`;
    summary += `Name: ${discharge.patient_name}\n`;
    summary += `Hospital Number: ${discharge.hospital_number}\n`;
    summary += `Age/Gender: ${discharge.age || 'N/A'} years / ${discharge.gender || 'N/A'}\n\n`;
    
    summary += `ADMISSION DETAILS\n`;
    summary += `-`.repeat(30) + `\n`;
    summary += `Date of Admission: ${format(new Date(discharge.admission_date), 'dd MMMM yyyy')}\n`;
    summary += `Date of Discharge: ${format(new Date(discharge.discharge_date), 'dd MMMM yyyy')}\n`;
    summary += `Length of Stay: ${lengthOfStay} day(s)\n`;
    summary += `Ward: ${admission.ward_location}\n`;
    summary += `Admitting Consultant: ${admission.admitting_consultant || 'N/A'}\n\n`;
    
    summary += `DIAGNOSES\n`;
    summary += `-`.repeat(30) + `\n`;
    summary += `Admitting Diagnosis: ${discharge.admitting_diagnosis}\n`;
    summary += `Final Diagnosis: ${discharge.final_diagnosis}\n`;
    if (discharge.secondary_diagnoses?.length) {
      summary += `Secondary Diagnoses:\n`;
      discharge.secondary_diagnoses.forEach(d => {
        summary += `  • ${d}\n`;
      });
    }
    summary += `\n`;

    if (discharge.procedures_performed?.length) {
      summary += `PROCEDURES PERFORMED\n`;
      summary += `-`.repeat(30) + `\n`;
      discharge.procedures_performed.forEach(p => {
        summary += `  • ${p}\n`;
      });
      summary += `\n`;
    }

    summary += `HOSPITAL COURSE\n`;
    summary += `-`.repeat(30) + `\n`;
    summary += `${discharge.hospital_course_summary}\n\n`;

    summary += `CONDITION AT DISCHARGE\n`;
    summary += `-`.repeat(30) + `\n`;
    summary += `${discharge.condition_at_discharge}\n`;
    summary += `Discharge Type: ${discharge.discharge_type.replace('_', ' ').toUpperCase()}\n`;
    summary += `WHO Discharge Readiness Score: ${discharge.discharge_readiness_score}/33\n\n`;

    if (discharge.medications_on_discharge?.length) {
      summary += `DISCHARGE MEDICATIONS\n`;
      summary += `-`.repeat(30) + `\n`;
      discharge.medications_on_discharge.forEach((med, idx) => {
        summary += `${idx + 1}. ${med.medication} ${med.dosage}\n`;
        summary += `   ${med.frequency} for ${med.duration}\n`;
        if (med.instructions) summary += `   Note: ${med.instructions}\n`;
      });
      summary += `\n`;
    }

    if (discharge.follow_up_appointments?.length) {
      summary += `FOLLOW-UP APPOINTMENTS\n`;
      summary += `-`.repeat(30) + `\n`;
      discharge.follow_up_appointments.forEach(apt => {
        summary += `  • ${format(new Date(apt.date), 'dd MMM yyyy')} - ${apt.clinic}\n`;
        summary += `    Purpose: ${apt.purpose}\n`;
      });
      summary += `\n`;
    }

    summary += `DISCHARGING TEAM\n`;
    summary += `-`.repeat(30) + `\n`;
    summary += `Doctor: ${discharge.discharging_doctor}\n`;
    summary += `Consultant: ${discharge.discharging_consultant || 'N/A'}\n`;

    return summary;
  }

  generateFitnessForDischargeReport(discharge: Discharge, whoScore: WHODischargeScore): string {
    let report = `MEDICAL REPORT: FITNESS FOR DISCHARGE\n`;
    report += `${'='.repeat(50)}\n\n`;

    report += `This is to certify that ${discharge.patient_name} (Hospital No: ${discharge.hospital_number}) `;
    report += `was admitted on ${format(new Date(discharge.admission_date), 'dd MMMM yyyy')} `;
    report += `with a diagnosis of ${discharge.final_diagnosis}.\n\n`;

    report += `DISCHARGE READINESS ASSESSMENT (WHO Guidelines)\n`;
    report += `-`.repeat(40) + `\n`;
    report += `Assessment Date: ${whoScore.assessment_date}\n`;
    report += `Assessed By: ${whoScore.assessed_by}\n\n`;

    report += `Clinical Stability:\n`;
    report += `  • Vital Signs: ${['Unstable', 'Borderline', 'Stable 24h', 'Stable 48h+'][whoScore.vital_signs_stable]}\n`;
    report += `  • Pain Control: ${['Severe', 'Moderate', 'Mild', 'Minimal/None'][whoScore.pain_controlled]}\n`;
    report += `  • Oral Intake: ${['NPO', 'Liquids only', 'Soft diet', 'Regular diet'][whoScore.oral_intake_adequate]}\n`;
    report += `  • Mobility: ${['Bedbound', 'Needs assistance', 'Walks with aid', 'Independent'][whoScore.mobility_status]}\n`;
    report += `  • Wound Status: ${['Infected', 'Concerning', 'Healing', 'Well-healed'][whoScore.wound_healing_status]}\n\n`;

    report += `Functional Readiness:\n`;
    report += `  • Self-Care: ${['Dependent', 'Needs help', 'Minimal help', 'Independent'][whoScore.self_care_ability]}\n`;
    report += `  • Medication Understanding: ${['None', 'Poor', 'Moderate', 'Good'][whoScore.medication_understanding]}\n`;
    report += `  • Follow-up Arranged: ${['No', 'Pending', 'Partially', 'Complete'][whoScore.follow_up_arranged]}\n\n`;

    report += `Social Support:\n`;
    report += `  • Caregiver Available: ${['None', 'Occasionally', 'Most times', 'Always'][whoScore.caregiver_available]}\n`;
    report += `  • Transport: ${['No', 'Uncertain', 'Planned', 'Confirmed'][whoScore.transport_arranged]}\n`;
    report += `  • Home Environment: ${['Unsafe', 'Concerns', 'Acceptable', 'Safe'][whoScore.home_environment_safe]}\n\n`;

    report += `TOTAL SCORE: ${whoScore.total_score}/33\n`;
    report += `RECOMMENDATION: ${whoScore.recommendation.replace(/_/g, ' ').toUpperCase()}\n\n`;

    const fitnessStatus = whoScore.total_score >= 27 
      ? 'FIT FOR DISCHARGE'
      : whoScore.total_score >= 20 
        ? 'CONDITIONALLY FIT - Discharge on Request'
        : 'NOT MEDICALLY FIT FOR DISCHARGE';

    report += `${'='.repeat(50)}\n`;
    report += `CONCLUSION: Patient is ${fitnessStatus}\n`;
    report += `${'='.repeat(50)}\n\n`;

    report += `Date: ${format(new Date(), 'dd MMMM yyyy')}\n`;
    report += `Discharging Doctor: ${discharge.discharging_doctor}\n`;
    report += `Consultant: ${discharge.discharging_consultant || 'N/A'}\n`;

    return report;
  }

  generateDischargeInstructions(discharge: Discharge, comorbidities: string[]): string {
    let instructions = `DISCHARGE INSTRUCTIONS\n`;
    instructions += `${'='.repeat(50)}\n\n`;
    instructions += `Patient: ${discharge.patient_name}\n`;
    instructions += `Date: ${format(new Date(discharge.discharge_date), 'dd MMMM yyyy')}\n\n`;

    // Medications
    if (discharge.medications_on_discharge?.length) {
      instructions += `MEDICATIONS\n`;
      instructions += `-`.repeat(30) + `\n`;
      instructions += `Please take the following medications as prescribed:\n\n`;
      discharge.medications_on_discharge.forEach((med, idx) => {
        instructions += `${idx + 1}. ${med.medication}\n`;
        instructions += `   Dose: ${med.dosage}\n`;
        instructions += `   How often: ${med.frequency}\n`;
        instructions += `   For how long: ${med.duration}\n`;
        if (med.instructions) instructions += `   Special instructions: ${med.instructions}\n`;
        instructions += `\n`;
      });
    }

    // Wound Care
    if (discharge.wound_care_instructions) {
      instructions += `WOUND CARE\n`;
      instructions += `-`.repeat(30) + `\n`;
      instructions += `${discharge.wound_care_instructions}\n\n`;
    }

    // Activity Restrictions
    if (discharge.activity_restrictions?.length) {
      instructions += `ACTIVITY RESTRICTIONS\n`;
      instructions += `-`.repeat(30) + `\n`;
      discharge.activity_restrictions.forEach(r => {
        instructions += `  • ${r}\n`;
      });
      instructions += `\n`;
    }

    // Diet & Lifestyle
    instructions += `DIET & LIFESTYLE\n`;
    instructions += `-`.repeat(30) + `\n`;
    if (discharge.dietary_recommendations) {
      instructions += `${discharge.dietary_recommendations}\n\n`;
    }
    if (discharge.lifestyle_modifications?.length) {
      instructions += `Lifestyle Changes:\n`;
      discharge.lifestyle_modifications.forEach(m => {
        instructions += `  • ${m}\n`;
      });
      instructions += `\n`;
    }

    // 7-Day Meal Plan Summary
    if (discharge.meal_plan_7_day) {
      instructions += `7-DAY MEAL PLAN SUMMARY\n`;
      instructions += `-`.repeat(30) + `\n`;
      instructions += `Special Considerations:\n`;
      discharge.meal_plan_7_day.special_considerations.forEach(c => {
        instructions += `  • ${c}\n`;
      });
      instructions += `\nFoods to Avoid:\n`;
      discharge.meal_plan_7_day.foods_to_avoid.forEach(f => {
        instructions += `  • ${f}\n`;
      });
      instructions += `\nHydration: ${discharge.meal_plan_7_day.hydration_goals}\n\n`;
    }

    // Warning Signs
    instructions += `WARNING SIGNS - SEEK MEDICAL ATTENTION IF:\n`;
    instructions += `-`.repeat(30) + `\n`;
    const warningSigns = discharge.warning_signs || [
      'Fever above 38°C (100.4°F)',
      'Increasing pain not controlled by medications',
      'Wound redness, swelling, or discharge',
      'Difficulty breathing',
      'Chest pain',
      'Persistent nausea or vomiting',
      'Confusion or altered consciousness'
    ];
    warningSigns.forEach(w => {
      instructions += `  ⚠️ ${w}\n`;
    });
    instructions += `\n`;

    // Follow-up
    if (discharge.follow_up_appointments?.length) {
      instructions += `FOLLOW-UP APPOINTMENTS\n`;
      instructions += `-`.repeat(30) + `\n`;
      discharge.follow_up_appointments.forEach(apt => {
        instructions += `📅 ${format(new Date(apt.date), 'EEEE, dd MMMM yyyy')}\n`;
        instructions += `   Clinic: ${apt.clinic}\n`;
        instructions += `   Purpose: ${apt.purpose}\n`;
        if (apt.special_instructions) instructions += `   Note: ${apt.special_instructions}\n`;
        instructions += `\n`;
      });
    }

    instructions += `EMERGENCY CONTACT\n`;
    instructions += `-`.repeat(30) + `\n`;
    instructions += `For emergencies, contact the hospital at +234-XXX-XXX-XXXX\n`;
    instructions += `or visit the nearest emergency department.\n`;

    return instructions;
  }

  // ============= PDF GENERATION =============

  async generateDischargePDF(discharge: Discharge, admission: Admission, whoScore?: WHODischargeScore): Promise<Blob> {
    const pdf = createPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = PDF_MARGINS.top;

    // Helper to sanitize all text for proper rendering
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    const addHeader = (): number => {
      let y = PDF_MARGINS.top;
      pdf.setFontSize(PDF_FONT_SIZES.sectionHeader);
      pdf.setFont('times', 'bold');
      pdf.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, y, { align: 'center' });
      y += 6;
      pdf.setFontSize(PDF_FONT_SIZES.body);
      pdf.setFont('times', 'normal');
      pdf.text('University of Nigeria Teaching Hospital, Enugu', pageWidth / 2, y, { align: 'center' });
      y += 10;
      return y;
    };

    const checkPageBreak = (neededSpace: number): boolean => {
      if (yPos + neededSpace > pageHeight - PDF_MARGINS.bottom) {
        pdf.addPage();
        yPos = PDF_MARGINS.top;
        return true;
      }
      return false;
    };

    const addSection = (title: string, content: string): void => {
      checkPageBreak(30);
      pdf.setFontSize(PDF_FONT_SIZES.subHeader);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
      pdf.text(clean(title), PDF_MARGINS.left, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 7;
      
      pdf.setFontSize(PDF_FONT_SIZES.body);
      pdf.setFont('times', 'normal');
      const cleanContent = clean(content);
      const lines = pdf.splitTextToSize(cleanContent, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
      lines.forEach((line: string) => {
        checkPageBreak(6);
        pdf.text(line, PDF_MARGINS.left, yPos);
        yPos += 5;
      });
      yPos += 5;
    };

    const addBulletSection = (title: string, items: string[]): void => {
      checkPageBreak(30);
      pdf.setFontSize(PDF_FONT_SIZES.subHeader);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
      pdf.text(clean(title), PDF_MARGINS.left, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 7;
      
      pdf.setFontSize(PDF_FONT_SIZES.body);
      pdf.setFont('times', 'normal');
      items.forEach((item) => {
        if (item && item.trim()) {
          checkPageBreak(8);
          const cleanItem = clean(item);
          const bulletText = '• ' + cleanItem;
          const lines = pdf.splitTextToSize(bulletText, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 5);
          lines.forEach((line: string, idx: number) => {
            pdf.text(idx === 0 ? line : '  ' + line, PDF_MARGINS.left + 3, yPos);
            yPos += 5;
          });
        }
      });
      yPos += 5;
    };

    // Page 1: Discharge Summary
    yPos = addHeader();
    pdf.setFontSize(PDF_FONT_SIZES.title);
    pdf.setFont('times', 'bold');
    pdf.text('DISCHARGE SUMMARY', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    // Patient Info Box
    pdf.setDrawColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    pdf.setLineWidth(0.5);
    pdf.rect(PDF_MARGINS.left, yPos - 2, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 28);
    yPos += 5;
    
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'bold');
    pdf.text('Patient: ', PDF_MARGINS.left + 5, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(clean(discharge.patient_name), PDF_MARGINS.left + 22, yPos);
    pdf.setFont('times', 'bold');
    pdf.text('Hospital No: ', pageWidth / 2, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(clean(discharge.hospital_number), pageWidth / 2 + 28, yPos);
    yPos += 6;
    
    pdf.setFont('times', 'bold');
    pdf.text('Age/Gender: ', PDF_MARGINS.left + 5, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(`${discharge.age || 'N/A'} / ${discharge.gender || 'N/A'}`, PDF_MARGINS.left + 32, yPos);
    pdf.setFont('times', 'bold');
    pdf.text('Ward: ', pageWidth / 2, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(clean(admission.ward_location), pageWidth / 2 + 15, yPos);
    yPos += 6;
    
    pdf.setFont('times', 'bold');
    pdf.text('Admission: ', PDF_MARGINS.left + 5, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(format(new Date(discharge.admission_date), 'dd/MM/yyyy'), PDF_MARGINS.left + 28, yPos);
    pdf.setFont('times', 'bold');
    pdf.text('Discharge: ', pageWidth / 2, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(format(new Date(discharge.discharge_date), 'dd/MM/yyyy'), pageWidth / 2 + 24, yPos);
    yPos += 6;
    
    pdf.setFont('times', 'bold');
    pdf.text('Length of Stay: ', PDF_MARGINS.left + 5, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(`${discharge.length_of_stay_days} days`, PDF_MARGINS.left + 35, yPos);
    yPos += 15;

    addSection('DIAGNOSIS', `Admitting: ${clean(discharge.admitting_diagnosis)}\nFinal: ${clean(discharge.final_diagnosis)}`);
    
    if (discharge.procedures_performed?.length) {
      addBulletSection('PROCEDURES PERFORMED', discharge.procedures_performed);
    }

    addSection('HOSPITAL COURSE', clean(discharge.hospital_course_summary));
    addSection('CONDITION AT DISCHARGE', `${clean(discharge.condition_at_discharge)}\nDischarge Type: ${discharge.discharge_type.replace('_', ' ').toUpperCase()}`);

    // Page 2: Medications
    if (discharge.medications_on_discharge?.length) {
      pdf.addPage();
      yPos = addHeader();
      
      pdf.setFontSize(PDF_FONT_SIZES.title);
      pdf.setFont('times', 'bold');
      pdf.text('DISCHARGE MEDICATIONS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 12;

      discharge.medications_on_discharge.forEach((med, idx) => {
        checkPageBreak(25);
        pdf.setFontSize(PDF_FONT_SIZES.body);
        pdf.setFont('times', 'bold');
        pdf.text(`${idx + 1}. ${clean(med.medication)}`, PDF_MARGINS.left, yPos);
        yPos += 6;
        pdf.setFont('times', 'normal');
        pdf.text(`   Dosage: ${clean(med.dosage)}`, PDF_MARGINS.left + 5, yPos);
        yPos += 5;
        pdf.text(`   Frequency: ${clean(med.frequency)}`, PDF_MARGINS.left + 5, yPos);
        yPos += 5;
        pdf.text(`   Duration: ${clean(med.duration)}`, PDF_MARGINS.left + 5, yPos);
        yPos += 5;
        if (med.instructions) {
          const instrLines = pdf.splitTextToSize(`   Instructions: ${clean(med.instructions)}`, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 10);
          instrLines.forEach((line: string) => {
            pdf.text(line, PDF_MARGINS.left + 5, yPos);
            yPos += 5;
          });
        }
        yPos += 5;
      });
    }

    // Page 3: Instructions
    pdf.addPage();
    yPos = addHeader();
    
    pdf.setFontSize(PDF_FONT_SIZES.title);
    pdf.setFont('times', 'bold');
    pdf.text('DISCHARGE INSTRUCTIONS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    if (discharge.wound_care_instructions) {
      addSection('WOUND CARE', clean(discharge.wound_care_instructions));
    }

    if (discharge.activity_restrictions?.length) {
      addBulletSection('ACTIVITY RESTRICTIONS', discharge.activity_restrictions);
    }

    if (discharge.lifestyle_modifications?.length) {
      addBulletSection('LIFESTYLE MODIFICATIONS', discharge.lifestyle_modifications);
    }

    // Warning Signs Box
    const warningSigns = discharge.warning_signs || [
      'Fever above 38°C (100.4°F)',
      'Increasing pain not relieved by medication',
      'Wound redness, swelling, or discharge',
      'Difficulty breathing',
      'Persistent nausea or vomiting'
    ];
    
    checkPageBreak(50);
    const warningBoxHeight = 15 + (warningSigns.length * 6);
    pdf.setDrawColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
    pdf.setLineWidth(1);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, warningBoxHeight);
    
    pdf.setFontSize(PDF_FONT_SIZES.subHeader);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b);
    pdf.text('WARNING SIGNS - RETURN IMMEDIATELY IF:', PDF_MARGINS.left + 5, yPos + 5);
    yPos += 12;
    
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    pdf.setTextColor(0, 0, 0);
    warningSigns.forEach((sign) => {
      if (sign && sign.trim()) {
        pdf.text('• ' + clean(sign), PDF_MARGINS.left + 8, yPos);
        yPos += 6;
      }
    });
    yPos += 10;

    // Follow-up
    if (discharge.follow_up_appointments?.length) {
      checkPageBreak(30);
      pdf.setFontSize(PDF_FONT_SIZES.subHeader);
      pdf.setFont('times', 'bold');
      pdf.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
      pdf.text('FOLLOW-UP APPOINTMENTS', PDF_MARGINS.left, yPos);
      pdf.setTextColor(0, 0, 0);
      yPos += 8;
      
      pdf.setFontSize(PDF_FONT_SIZES.body);
      pdf.setFont('times', 'normal');
      discharge.follow_up_appointments.forEach(apt => {
        checkPageBreak(8);
        const aptText = `• ${format(new Date(apt.date), 'dd MMM yyyy')} - ${clean(apt.clinic)}: ${clean(apt.purpose)}`;
        pdf.text(aptText, PDF_MARGINS.left + 3, yPos);
        yPos += 6;
      });
    }

    // Signature section at bottom
    yPos = pageHeight - 45;
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.3);
    pdf.line(PDF_MARGINS.left, yPos - 5, pageWidth - PDF_MARGINS.right, yPos - 5);
    
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'bold');
    pdf.text('Discharging Doctor: ', PDF_MARGINS.left, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(clean(discharge.discharging_doctor), PDF_MARGINS.left + 40, yPos);
    yPos += 6;
    
    pdf.setFont('times', 'bold');
    pdf.text('Consultant: ', PDF_MARGINS.left, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(clean(discharge.discharging_consultant) || 'N/A', PDF_MARGINS.left + 25, yPos);
    yPos += 6;
    
    pdf.setFont('times', 'bold');
    pdf.text('Date Generated: ', PDF_MARGINS.left, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(format(new Date(), 'dd/MM/yyyy HH:mm'), PDF_MARGINS.left + 35, yPos);

    // Add page numbers
    addFooter(pdf, 'Plastic & Reconstructive Surgery Unit - UNTH');

    return pdf.output('blob');
  }

  async downloadDischargePDF(discharge: Discharge, admission: Admission, whoScore?: WHODischargeScore): Promise<void> {
    const pdfBlob = await this.generateDischargePDF(discharge, admission, whoScore);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Discharge_${(discharge.patient_name || 'Unknown_Patient').replace(/\s+/g, '_')}_${format(new Date(discharge.discharge_date), 'yyyyMMdd')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async shareDischargePDF(discharge: Discharge, admission: Admission, method: 'email' | 'whatsapp'): Promise<void> {
    const pdfBlob = await this.generateDischargePDF(discharge, admission);
    const fileName = `Discharge_${(discharge.patient_name || 'Unknown_Patient').replace(/\s+/g, '_')}.pdf`;

    if (method === 'whatsapp') {
      // For WhatsApp, we need to share via Web Share API if available
      if (navigator.share) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        try {
          await navigator.share({
            files: [file],
            title: `Discharge Summary - ${discharge.patient_name || 'Unknown Patient'}`,
            text: `Discharge summary for ${discharge.patient_name || 'Unknown Patient'}`
          });
        } catch (error) {
          console.error('Share failed:', error);
          // Fallback to download
          await this.downloadDischargePDF(discharge, admission);
        }
      } else {
        // Fallback: Open WhatsApp with message (PDF needs to be shared separately)
        const message = encodeURIComponent(
          `Discharge Summary for ${discharge.patient_name}\n` +
          `Hospital No: ${discharge.hospital_number}\n` +
          `Discharge Date: ${format(new Date(discharge.discharge_date), 'dd/MM/yyyy')}\n` +
          `Diagnosis: ${discharge.final_diagnosis}`
        );
        window.open(`https://wa.me/?text=${message}`, '_blank');
        await this.downloadDischargePDF(discharge, admission);
      }
    } else if (method === 'email') {
      // Create mailto link with subject
      const subject = encodeURIComponent(`Discharge Summary - ${discharge.patient_name}`);
      const body = encodeURIComponent(
        `Please find attached the discharge summary for:\n\n` +
        `Patient: ${discharge.patient_name}\n` +
        `Hospital Number: ${discharge.hospital_number}\n` +
        `Discharge Date: ${format(new Date(discharge.discharge_date), 'dd MMMM yyyy')}\n` +
        `Diagnosis: ${discharge.final_diagnosis}\n\n` +
        `Note: Please download and attach the PDF file.`
      );
      window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
      await this.downloadDischargePDF(discharge, admission);
    }
  }

  // ============= STATISTICS =============

  async getStatistics(): Promise<AdmissionStatistics> {
    const allAdmissions = await db.admissions.toArray();
    const allDischarges = await db.discharges.toArray();
    const activeAdmissions = allAdmissions.filter(a => a.status === 'active');

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const admissionsThisMonth = allAdmissions.filter(a => 
      new Date(a.admission_date) >= firstDayOfMonth
    );

    const dischargesThisMonth = allDischarges.filter(d => 
      new Date(d.discharge_date) >= firstDayOfMonth
    );

    const byRoute = {
      clinic: allAdmissions.filter(a => a.route_of_admission === 'clinic').length,
      emergency: allAdmissions.filter(a => a.route_of_admission === 'emergency').length,
      consult_transfer: allAdmissions.filter(a => a.route_of_admission === 'consult_transfer').length
    };

    const byWard: Record<string, number> = {};
    activeAdmissions.forEach(admission => {
      byWard[admission.ward_location] = (byWard[admission.ward_location] || 0) + 1;
    });

    const byDischargeType = {
      normal: allDischarges.filter(d => d.discharge_type === 'normal').length,
      on_request: allDischarges.filter(d => d.discharge_type === 'on_request').length,
      against_medical_advice: allDischarges.filter(d => d.discharge_type === 'against_medical_advice').length,
      transfer: allDischarges.filter(d => d.discharge_type === 'transfer').length,
      deceased: allDischarges.filter(d => d.discharge_type === 'deceased').length
    };

    // Calculate average length of stay
    let averageLengthOfStay = 0;
    if (allDischarges.length > 0) {
      const totalDays = allDischarges.reduce((sum, d) => sum + (d.length_of_stay_days || 0), 0);
      averageLengthOfStay = Math.round(totalDays / allDischarges.length * 10) / 10;
    }

    return {
      total_admissions: allAdmissions.length,
      active_admissions: activeAdmissions.length,
      admissions_this_month: admissionsThisMonth.length,
      discharges_this_month: dischargesThisMonth.length,
      average_length_of_stay: averageLengthOfStay,
      by_route: byRoute,
      by_ward: byWard,
      by_discharge_type: byDischargeType
    };
  }
}

export const admissionDischargeService = new AdmissionDischargeService();
