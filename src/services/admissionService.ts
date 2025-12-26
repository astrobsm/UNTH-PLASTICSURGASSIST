import { db } from '../db/database';

export interface Admission {
  id?: number;
  patient_id: number;
  patient_name: string;
  hospital_number: string;
  admission_date: Date;
  admission_time: string;
  ward_location: string;
  bed_number?: string;
  route_of_admission: 'clinic' | 'emergency' | 'consult_transfer';
  referring_specialty?: string; // For consult transfers
  referring_doctor?: string;
  reasons_for_admission: string;
  presenting_complaint: string;
  provisional_diagnosis: string;
  admitting_doctor: string;
  admitting_consultant?: string;
  vital_signs?: {
    temperature?: string;
    blood_pressure?: string;
    pulse?: string;
    respiratory_rate?: string;
    oxygen_saturation?: string;
  };
  allergies?: string;
  current_medications?: string;
  past_medical_history?: string;
  past_surgical_history?: string;
  social_history?: string;
  family_history?: string;
  examination_findings?: string;
  initial_management_plan?: string;
  status: 'active' | 'discharged' | 'transferred';
  discharge_date?: Date;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface AdmissionStatistics {
  total_admissions: number;
  active_admissions: number;
  admissions_this_month: number;
  by_route: {
    clinic: number;
    emergency: number;
    consult_transfer: number;
  };
  by_ward: Record<string, number>;
  average_length_of_stay?: number;
}

class AdmissionService {
  // Create new admission
  async createAdmission(admissionData: Omit<Admission, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const now = new Date();
    const admission: Omit<Admission, 'id'> = {
      ...admissionData,
      created_at: now,
      updated_at: now
    };

    const id = await db.admissions.add(admission);
    return id;
  }

  // Get admission by ID
  async getAdmission(id: number): Promise<Admission | undefined> {
    return await db.admissions.get(id);
  }

  // Get all admissions for a patient
  async getPatientAdmissions(patientId: number): Promise<Admission[]> {
    return await db.admissions
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('admission_date');
  }

  // Get active admissions
  async getActiveAdmissions(): Promise<Admission[]> {
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.status === 'active')
      .sort((a, b) => b.admission_date.getTime() - a.admission_date.getTime());
  }

  // Get admissions by ward
  async getAdmissionsByWard(ward: string): Promise<Admission[]> {
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.ward_location === ward && a.status === 'active')
      .sort((a, b) => b.admission_date.getTime() - a.admission_date.getTime());
  }

  // Get admissions by route
  async getAdmissionsByRoute(route: 'clinic' | 'emergency' | 'consult_transfer'): Promise<Admission[]> {
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.route_of_admission === route)
      .sort((a, b) => b.admission_date.getTime() - a.admission_date.getTime());
  }

  // Search admissions
  async searchAdmissions(query: string): Promise<Admission[]> {
    const admissions = await db.admissions.toArray();
    const searchLower = query.toLowerCase();
    
    return admissions.filter(admission => 
      (admission.patient_name || '').toLowerCase().includes(searchLower) ||
      (admission.hospital_number || '').toLowerCase().includes(searchLower) ||
      (admission.provisional_diagnosis || '').toLowerCase().includes(searchLower) ||
      (admission.ward_location || '').toLowerCase().includes(searchLower)
    );
  }

  // Update admission
  async updateAdmission(id: number, updates: Partial<Admission>): Promise<void> {
    await db.admissions.update(id, {
      ...updates,
      updated_at: new Date()
    });
  }

  // Discharge patient (mark admission as discharged)
  async dischargePatient(id: number, dischargeDate: Date): Promise<void> {
    await db.admissions.update(id, {
      status: 'discharged',
      discharge_date: dischargeDate,
      updated_at: new Date()
    });
  }

  // Transfer patient (mark admission as transferred)
  async transferPatient(id: number, newWard: string): Promise<void> {
    await db.admissions.update(id, {
      ward_location: newWard,
      updated_at: new Date()
    });
  }

  // Get admission statistics
  async getStatistics(): Promise<AdmissionStatistics> {
    const allAdmissions = await db.admissions.toArray();
    const activeAdmissions = allAdmissions.filter(a => a.status === 'active');
    
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const admissionsThisMonth = allAdmissions.filter(a => 
      a.admission_date >= firstDayOfMonth
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

    // Calculate average length of stay for discharged patients
    const dischargedAdmissions = allAdmissions.filter(a => a.status === 'discharged' && a.discharge_date);
    let averageLengthOfStay = 0;
    if (dischargedAdmissions.length > 0) {
      const totalDays = dischargedAdmissions.reduce((sum, admission) => {
        if (admission.discharge_date) {
          const days = Math.ceil(
            (admission.discharge_date.getTime() - admission.admission_date.getTime()) / (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      averageLengthOfStay = Math.round(totalDays / dischargedAdmissions.length);
    }

    return {
      total_admissions: allAdmissions.length,
      active_admissions: activeAdmissions.length,
      admissions_this_month: admissionsThisMonth.length,
      by_route: byRoute,
      by_ward: byWard,
      average_length_of_stay: averageLengthOfStay
    };
  }

  // Delete admission (use with caution)
  async deleteAdmission(id: number): Promise<void> {
    await db.admissions.delete(id);
  }

  // Get recent admissions (last 30 days)
  async getRecentAdmissions(days: number = 30): Promise<Admission[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.admission_date >= cutoffDate)
      .sort((a, b) => b.admission_date.getTime() - a.admission_date.getTime());
  }
}

export const admissionService = new AdmissionService();
