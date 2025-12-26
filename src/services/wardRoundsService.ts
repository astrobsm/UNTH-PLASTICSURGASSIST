import { db } from '../db/database';

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
  round_type: RoundType; // NEW: Type of ward round
  reviewing_doctor: string;
  doctor_role: 'consultant' | 'senior_registrar' | 'registrar' | 'house_officer';
  accompanying_team?: string[]; // NEW: Team members present
  
  // Clinical Assessment
  chief_complaint: string;
  clinical_notes: string;
  examination_findings: string;
  
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
  
  // Wound Care (if applicable)
  wound_assessment_done: boolean;
  wound_notes?: string;
  
  // Consultation Requests
  consultation_requested: boolean;
  consultation_specialty?: string;
  consultation_reason?: string;
  
  // Timestamps
  created_at?: Date;
  updated_at?: Date;
  synced?: boolean;
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

class WardRoundsService {
  async createWardRound(round: WardRound): Promise<string> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();
      
      const roundData = {
        ...round,
        id,
        created_at: now,
        updated_at: now,
        synced: false
      };

      await db.ward_rounds.add(roundData);
      
      // Log activity for analytics
      await this.logActivity({
        user_name: round.reviewing_doctor,
        action: 'ward_round_created',
        patient_id: round.patient_id,
        details: `Round completed for ${round.patient_name || 'patient'}`
      });

      return id;
    } catch (error) {
      console.error('Failed to create ward round:', error);
      throw error;
    }
  }

  async updateWardRound(id: string, updates: Partial<WardRound>): Promise<void> {
    try {
      await db.ward_rounds.update(id, {
        ...updates,
        updated_at: new Date(),
        synced: false
      });

      await this.logActivity({
        user_name: updates.reviewing_doctor || 'Unknown',
        action: 'ward_round_updated',
        patient_id: updates.patient_id,
        details: `Ward round updated`
      });
    } catch (error) {
      console.error('Failed to update ward round:', error);
      throw error;
    }
  }

  async getWardRound(id: string): Promise<WardRound | undefined> {
    return await db.ward_rounds.get(id);
  }

  async getPatientWardRounds(patientId: string): Promise<WardRound[]> {
    return await db.ward_rounds
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('round_date');
  }

  async getAllWardRounds(): Promise<WardRound[]> {
    return await db.ward_rounds.reverse().sortBy('round_date');
  }

  async getWardRoundsByDoctor(doctorName: string): Promise<WardRound[]> {
    return await db.ward_rounds
      .where('reviewing_doctor')
      .equals(doctorName)
      .reverse()
      .sortBy('round_date');
  }

  async getWardRoundsByDate(date: Date): Promise<WardRound[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await db.ward_rounds
      .where('round_date')
      .between(startOfDay, endOfDay)
      .sortBy('round_time');
  }

  async getTodaysWardRounds(): Promise<WardRound[]> {
    return await this.getWardRoundsByDate(new Date());
  }

  async deleteWardRound(id: string): Promise<void> {
    await db.ward_rounds.delete(id);
  }

  async getWardRoundSummary(startDate?: Date, endDate?: Date): Promise<WardRoundSummary> {
    let rounds: WardRound[];

    if (startDate && endDate) {
      rounds = await db.ward_rounds
        .where('round_date')
        .between(startDate, endDate)
        .toArray();
    } else {
      rounds = await this.getTodaysWardRounds();
    }

    const summary: WardRoundSummary = {
      total_rounds: rounds.length,
      rounds_by_doctor: {},
      patients_seen_today: new Set(rounds.map(r => r.patient_id)).size,
      patients_improved: rounds.filter(r => r.progress_status === 'improved').length,
      patients_stable: rounds.filter(r => r.progress_status === 'stable').length,
      patients_deteriorating: rounds.filter(r => r.progress_status === 'deteriorating').length,
      consultations_requested: rounds.filter(r => r.consultation_requested).length
    };

    rounds.forEach(round => {
      if (!summary.rounds_by_doctor[round.reviewing_doctor]) {
        summary.rounds_by_doctor[round.reviewing_doctor] = 0;
      }
      summary.rounds_by_doctor[round.reviewing_doctor]++;
    });

    return summary;
  }

  async getPatientsForRounds(): Promise<any[]> {
    // Get all admitted or in-treatment patients
    const patients = await db.patients
      .filter(p => 
        p.status === 'admitted' || 
        p.status === 'in-treatment' ||
        p.status === 'post-operative'
      )
      .toArray();

    // Check last ward round for each patient
    const patientsWithLastRound = await Promise.all(
      patients.map(async (patient) => {
        const rounds = await this.getPatientWardRounds(patient.id!);
        const lastRound = rounds[0]; // Most recent
        return {
          ...patient,
          last_round_date: lastRound?.round_date,
          last_round_by: lastRound?.reviewing_doctor,
          last_progress: lastRound?.progress_status,
          hours_since_round: lastRound 
            ? Math.floor((new Date().getTime() - new Date(lastRound.round_date).getTime()) / (1000 * 60 * 60))
            : null
        };
      })
    );

    return patientsWithLastRound;
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
