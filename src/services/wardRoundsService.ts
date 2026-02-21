import { db } from '../db/database';
import { apiClient } from './apiClient';

// Round types as requested
export type RoundType = 'house_officers_round' | 'registrars_round' | 'senior_registrars_round' | 'consultants_round';

export const ROUND_TYPES: { value: RoundType; label: string; description: string }[] = [
  { value: 'house_officers_round', label: 'House Officers Round', description: 'Daily routine rounds by interns/house officers' },
  { value: 'registrars_round', label: 'Registrars Round', description: 'Intermediate review by registrars' },
  { value: 'senior_registrars_round', label: 'Senior Registrars Round', description: 'Senior resident review rounds' },
  { value: 'consultants_round', label: 'Consultants Round', description: 'Attending/consultant ward rounds' }
];

export interface WardRound {
  id?: string;
  patient_id: string;
  patient_name?: string;
  hospital_number?: string;
  round_date: Date;
  round_time: string;
  round_type: RoundType;
  reviewing_doctor: string;
  reviewed_by?: string;
  doctor_role: 'consultant' | 'senior_registrar' | 'registrar' | 'house_officer';
  accompanying_team?: string[];
  
  // Clinical Assessment
  chief_complaint: string;
  clinical_notes: string;
  examination_findings: string;
  assessment_notes?: string;
  
  // Vitals
  temperature?: number;
  pulse?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  respiratory_rate?: number;
  spo2?: number;
  
  // Lab Results Review
  recent_labs_reviewed: boolean;
  lab_notes?: string;
  
  // Treatment Updates
  treatment_plan_updated: boolean;
  medications_changed: boolean;
  medication_changes?: string;
  new_orders?: string;
  
  // Progress & Planning
  progress_status: 'improved' | 'stable' | 'deteriorating' | 'critical';
  complications?: string;
  follow_up_plan: string;
  next_review_date?: Date;
  discharge_planning?: string;
  plan_changes?: string[];
  
  // Wound Care
  wound_assessment_done: boolean;
  wound_notes?: string;
  
  // Consultation Requests
  consultation_requested: boolean;
  consultation_specialty?: string;
  consultation_reason?: string;
  
  // Clinical Images & Documents
  clinical_images?: ClinicalImage[];
  ocr_extracted_text?: string;
  
  // LMP for female patients
  lmp?: string;
  
  // Timestamps
  created_at?: Date;
  updated_at?: Date;
  synced?: boolean;
  server_id?: number | string;
}

export interface ClinicalImage {
  id: string;
  type: 'wound_photo' | 'lab_result' | 'imaging' | 'handwritten_note' | 'other';
  filename: string;
  data: string;
  caption?: string;
  extracted_text?: string;
  timestamp: string;
}

export interface WardRoundSummary {
  total_rounds: number;
  rounds_by_doctor: { [key: string]: number };
  patients_seen_today: number;
  patients_improved: number;
  patients_stable: number;
  patients_deteriorating: number;
  consultations_requested: number;
}

/**
 * Transform frontend WardRound → server API format
 */
function toServerFormat(round: Partial<WardRound>): any {
  const findingsObj = {
    chief_complaint: round.chief_complaint || '',
    clinical_notes: round.clinical_notes || '',
    examination_findings: round.examination_findings || '',
    assessment_notes: round.assessment_notes || '',
    doctor_role: round.doctor_role || '',
    accompanying_team: round.accompanying_team || [],
    recent_labs_reviewed: round.recent_labs_reviewed || false,
    lab_notes: round.lab_notes || '',
    treatment_plan_updated: round.treatment_plan_updated || false,
    medications_changed: round.medications_changed || false,
    medication_changes: round.medication_changes || '',
    progress_status: round.progress_status || 'stable',
    complications: round.complications || '',
    discharge_planning: round.discharge_planning || '',
    wound_assessment_done: round.wound_assessment_done || false,
    wound_notes: round.wound_notes || '',
    consultation_requested: round.consultation_requested || false,
    consultation_specialty: round.consultation_specialty || '',
    consultation_reason: round.consultation_reason || '',
    reviewing_doctor: round.reviewing_doctor || '',
    lmp: round.lmp || '',
    patient_name: round.patient_name || '',
    hospital_number: round.hospital_number || '',
    round_type: round.round_type || 'house_officers_round',
    round_time: round.round_time || ''
  };

  const vitalSigns: any = {};
  if (round.temperature) vitalSigns.temperature = round.temperature;
  if (round.pulse) vitalSigns.pulse = round.pulse;
  if (round.bp_systolic) vitalSigns.bp_systolic = round.bp_systolic;
  if (round.bp_diastolic) vitalSigns.bp_diastolic = round.bp_diastolic;
  if (round.respiratory_rate) vitalSigns.respiratory_rate = round.respiratory_rate;
  if (round.spo2) vitalSigns.spo2 = round.spo2;

  return {
    patientId: round.patient_id,
    roundDate: round.round_date instanceof Date
      ? round.round_date.toISOString().split('T')[0]
      : typeof round.round_date === 'string'
        ? new Date(round.round_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
    roundType: round.round_type || 'routine',
    findings: JSON.stringify(findingsObj),
    vitalSigns,
    newOrders: round.new_orders ? [round.new_orders] : [],
    plan: round.follow_up_plan || round.chief_complaint || '',
    issues: round.complications ? [round.complications] : [],
    nursingNotes: round.wound_notes || ''
  };
}

/**
 * Transform server API response → frontend WardRound format
 */
function fromServerFormat(row: any): WardRound {
  let findingsObj: any = {};
  try {
    if (typeof row.findings === 'string') {
      findingsObj = JSON.parse(row.findings);
    } else if (row.findings && typeof row.findings === 'object') {
      findingsObj = row.findings;
    }
  } catch {
    findingsObj = { chief_complaint: row.findings || '' };
  }

  let vitalSigns: any = {};
  try {
    if (typeof row.vital_signs === 'string') {
      vitalSigns = JSON.parse(row.vital_signs);
    } else if (row.vital_signs && typeof row.vital_signs === 'object') {
      vitalSigns = row.vital_signs;
    }
  } catch { /* ignore */ }

  let issues: string[] = [];
  try {
    if (typeof row.issues === 'string') {
      issues = JSON.parse(row.issues);
    } else if (Array.isArray(row.issues)) {
      issues = row.issues;
    }
  } catch { /* ignore */ }

  const reviewingDoctor = findingsObj.reviewing_doctor || row.documented_by_name || '';

  return {
    id: String(row.id),
    patient_id: String(row.patient_id),
    patient_name: row.patient_name || findingsObj.patient_name || '',
    hospital_number: row.hospital_number || findingsObj.hospital_number || '',
    round_date: new Date(row.round_date),
    round_time: findingsObj.round_time || '',
    round_type: findingsObj.round_type || row.round_type || 'house_officers_round',
    reviewing_doctor: reviewingDoctor,
    reviewed_by: reviewingDoctor,
    doctor_role: findingsObj.doctor_role || 'house_officer',
    accompanying_team: findingsObj.accompanying_team || [],
    chief_complaint: findingsObj.chief_complaint || row.findings || '',
    clinical_notes: findingsObj.clinical_notes || '',
    examination_findings: findingsObj.examination_findings || '',
    assessment_notes: findingsObj.assessment_notes || findingsObj.clinical_notes || '',
    temperature: vitalSigns.temperature,
    pulse: vitalSigns.pulse,
    bp_systolic: vitalSigns.bp_systolic,
    bp_diastolic: vitalSigns.bp_diastolic,
    respiratory_rate: vitalSigns.respiratory_rate,
    spo2: vitalSigns.spo2,
    recent_labs_reviewed: findingsObj.recent_labs_reviewed || false,
    lab_notes: findingsObj.lab_notes || '',
    treatment_plan_updated: findingsObj.treatment_plan_updated || false,
    medications_changed: findingsObj.medications_changed || false,
    medication_changes: findingsObj.medication_changes || '',
    new_orders: Array.isArray(row.new_orders) ? row.new_orders.join(', ') : (row.new_orders || ''),
    progress_status: findingsObj.progress_status || 'stable',
    complications: issues.join(', ') || findingsObj.complications || '',
    follow_up_plan: row.plan || '',
    discharge_planning: findingsObj.discharge_planning || '',
    wound_assessment_done: findingsObj.wound_assessment_done || false,
    wound_notes: row.nursing_notes || findingsObj.wound_notes || '',
    consultation_requested: findingsObj.consultation_requested || false,
    consultation_specialty: findingsObj.consultation_specialty || '',
    consultation_reason: findingsObj.consultation_reason || '',
    lmp: findingsObj.lmp || '',
    clinical_images: row.clinical_images || [],
    plan_changes: [],
    created_at: row.created_at ? new Date(row.created_at) : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at) : undefined,
    synced: true
  };
}

class WardRoundsService {
  /**
   * Create a ward round — sends to server API, falls back to IndexedDB if offline
   */
  async createWardRound(round: Partial<WardRound>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();

    const roundDate = round.round_date instanceof Date
      ? round.round_date
      : new Date(round.round_date || Date.now());

    const localRound = {
      ...round,
      round_date: roundDate,
      id,
      created_at: now,
      updated_at: now,
      synced: false
    };

    // Always save to IndexedDB first (offline-first)
    try {
      await db.ward_rounds.add(localRound);
    } catch (e) {
      console.warn('Could not save ward round to IndexedDB:', e);
    }

    // Then try sending to server
    if (navigator.onLine) {
      try {
        const serverPayload = toServerFormat(round);
        const serverResult = await apiClient.createWardRound(serverPayload);
        console.log('✅ Ward round saved to server:', serverResult?.id);

        // Update local record with server ID and mark as synced
        if (serverResult?.id) {
          try {
            await db.ward_rounds.update(id, {
              synced: true,
              server_id: serverResult.id
            });
          } catch { /* ignore */ }
        }

        return serverResult?.id ? String(serverResult.id) : id;
      } catch (error) {
        console.warn('⚠️ Could not save ward round to server, kept locally:', error);
        return id;
      }
    }

    return id;
  }

  /**
   * Update a ward round
   */
  async updateWardRound(id: string, updates: Partial<WardRound>): Promise<void> {
    // Update local
    try {
      await db.ward_rounds.update(id, {
        ...updates,
        updated_at: new Date(),
        synced: false
      });
    } catch { /* ignore */ }

    // Update server
    if (navigator.onLine) {
      try {
        const serverPayload = toServerFormat(updates);
        await apiClient.updateWardRound(id, serverPayload);
      } catch (error) {
        console.warn('Could not update ward round on server:', error);
      }
    }
  }

  /**
   * Get a single ward round by ID
   */
  async getWardRound(id: string): Promise<WardRound | undefined> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverRound = await apiClient.getWardRound(id);
        if (serverRound) return fromServerFormat(serverRound);
      } catch { /* fallback */ }
    }

    // Fallback to local
    return await db.ward_rounds.get(id);
  }

  /**
   * Get ward rounds for a specific patient — server first, IndexedDB fallback
   */
  async getPatientWardRounds(patientId: string): Promise<WardRound[]> {
    if (navigator.onLine) {
      try {
        const serverRounds = await apiClient.getWardRoundsByPatient(patientId);
        if (Array.isArray(serverRounds) && serverRounds.length > 0) {
          return serverRounds.map(fromServerFormat);
        }
      } catch (error) {
        console.warn('Could not fetch ward rounds from server:', error);
      }
    }

    // Fallback to IndexedDB (use filter instead of .where on non-indexed field)
    try {
      return await db.ward_rounds
        .filter(r => r.patient_id === patientId)
        .reverse()
        .sortBy('round_date');
    } catch {
      return [];
    }
  }

  /**
   * Get ALL ward rounds — server first, IndexedDB fallback
   */
  async getAllWardRounds(): Promise<WardRound[]> {
    if (navigator.onLine) {
      try {
        const serverRounds = await apiClient.getWardRounds();
        if (Array.isArray(serverRounds)) {
          const mapped = serverRounds.map(fromServerFormat);

          // Also merge any unsynced local rounds
          try {
            const localRounds = await db.ward_rounds
              .filter(r => !r.synced)
              .toArray();
            if (localRounds.length > 0) {
              return [...localRounds as WardRound[], ...mapped];
            }
          } catch { /* ignore */ }

          return mapped;
        }
      } catch (error) {
        console.warn('Could not fetch ward rounds from server, using local:', error);
      }
    }

    // Fallback to IndexedDB
    try {
      const local = await db.ward_rounds.toArray();
      return (local as WardRound[]).sort(
        (a, b) => new Date(b.round_date).getTime() - new Date(a.round_date).getTime()
      );
    } catch {
      return [];
    }
  }

  /**
   * Delete a ward round
   */
  async deleteWardRound(id: string): Promise<void> {
    // Delete on server
    if (navigator.onLine) {
      try {
        await apiClient.deleteWardRound(id);
      } catch (error) {
        console.warn('Could not delete ward round on server:', error);
      }
    }

    // Delete locally
    try {
      await db.ward_rounds.delete(id);
    } catch { /* ignore */ }
  }

  /**
   * Alias for deleteWardRound (backward compat)
   */
  async deleteRound(id: string): Promise<void> {
    return this.deleteWardRound(id);
  }

  /**
   * Get ward rounds by doctor name
   */
  async getWardRoundsByDoctor(doctorName: string): Promise<WardRound[]> {
    const all = await this.getAllWardRounds();
    return all.filter(r =>
      r.reviewing_doctor?.toLowerCase().includes(doctorName.toLowerCase())
    );
  }

  /**
   * Get ward rounds for a specific date
   */
  async getWardRoundsByDate(date: Date): Promise<WardRound[]> {
    const dateStr = date.toISOString().split('T')[0];
    if (navigator.onLine) {
      try {
        const serverRounds = await apiClient.getWardRounds(dateStr, dateStr);
        if (Array.isArray(serverRounds)) {
          return serverRounds.map(fromServerFormat);
        }
      } catch { /* fallback */ }
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const local = await db.ward_rounds.toArray();
      return (local as WardRound[]).filter(r => {
        const rd = new Date(r.round_date);
        return rd >= startOfDay && rd <= endOfDay;
      });
    } catch {
      return [];
    }
  }

  async getTodaysWardRounds(): Promise<WardRound[]> {
    return await this.getWardRoundsByDate(new Date());
  }

  async getWardRoundSummary(): Promise<WardRoundSummary> {
    const rounds = await this.getTodaysWardRounds();
    const summary: WardRoundSummary = {
      total_rounds: rounds.length,
      rounds_by_doctor: {},
      patients_seen_today: new Set(rounds.map(r => r.patient_id)).size,
      patients_improved: rounds.filter(r => r.progress_status === 'improved').length,
      patients_stable: rounds.filter(r => r.progress_status === 'stable').length,
      patients_deteriorating: rounds.filter(r => r.progress_status === 'deteriorating').length,
      consultations_requested: rounds.filter(r => r.consultation_requested).length
    };
    return summary;
  }

  async getPatientsForRounds(): Promise<any[]> {
    try {
      const patients = await db.patients
        .filter(p =>
          p.status === 'admitted' ||
          p.status === 'in-treatment' ||
          p.status === 'post-operative'
        )
        .toArray();

      const patientsWithLastRound = await Promise.all(
        patients.map(async (patient) => {
          const rounds = await this.getPatientWardRounds(patient.id!);
          const lastRound = rounds[0];
          return {
            ...patient,
            last_round_date: lastRound?.round_date,
            last_round_by: lastRound?.reviewing_doctor,
            last_progress: lastRound?.progress_status,
            hours_since_round: lastRound
              ? Math.floor((Date.now() - new Date(lastRound.round_date).getTime()) / (1000 * 60 * 60))
              : null
          };
        })
      );

      return patientsWithLastRound;
    } catch {
      return [];
    }
  }

  // Activity logging for analytics
  private async logActivity(activity: {
    user_name: string;
    action: string;
    patient_id?: string;
    details?: string;
  }): Promise<void> {
    try {
      await db.user_activities.add({
        id: crypto.randomUUID(),
        user_name: activity.user_name,
        action: activity.action,
        patient_id: activity.patient_id,
        details: activity.details,
        timestamp: new Date(),
        synced: false
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }
  }
}

export const wardRoundsService = new WardRoundsService();
