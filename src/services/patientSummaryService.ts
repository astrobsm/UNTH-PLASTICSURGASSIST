import { db } from '../db/database';
import { apiClient } from './apiClient';
import { format, differenceInDays, parseISO } from 'date-fns';

export interface PatientSummary {
  id: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  admission_date: Date;
  current_date: Date;
  length_of_stay: number;
  summary: {
    overview: string;
    diagnosis: string;
    treatment_progress: string;
    procedures_performed: string[];
    medications: string[];
    lab_results_summary: string;
    complications: string[];
    current_status: string;
    plan_forward: string;
  };
  generated_by: 'ai' | 'manual';
  generated_at: Date;
}

class PatientSummaryService {
  /**
   * Fetch patient data from server API, fallback to IndexedDB
   */
  private async fetchPatient(patientId: string): Promise<any> {
    if (navigator.onLine) {
      try {
        const patient = await apiClient.getPatient(patientId);
        if (patient) return patient;
      } catch (e) {
        console.warn('Could not fetch patient from server:', e);
      }
    }
    // Fallback to local
    let patient = await db.patients.where('id').equals(patientId).first();
    if (!patient) {
      const numericId = parseInt(patientId);
      if (!isNaN(numericId)) {
        patient = await db.patients.get(numericId);
      }
    }
    return patient;
  }

  private async fetchAdmissions(patientId: string): Promise<any[]> {
    if (navigator.onLine) {
      try {
        const admissions = await apiClient.getAdmissions(undefined, patientId);
        if (Array.isArray(admissions) && admissions.length > 0) return admissions;
      } catch (e) {
        console.warn('Could not fetch admissions from server:', e);
      }
    }
    try {
      let admissions = await db.admissions.where('patient_id').equals(patientId).toArray();
      if (admissions.length === 0) {
        admissions = await db.admissions.where('patient_id').equals(String(patientId)).toArray();
      }
      return admissions;
    } catch { return []; }
  }

  private async fetchTreatmentPlans(patientId: string): Promise<any[]> {
    if (navigator.onLine) {
      try {
        const plans = await apiClient.getTreatmentPlans(patientId);
        if (Array.isArray(plans) && plans.length > 0) return plans;
      } catch (e) {
        console.warn('Could not fetch treatment plans from server:', e);
      }
    }
    try {
      let plans = await db.treatment_plans.where('patient_id').equals(patientId).toArray();
      if (plans.length === 0) {
        plans = await db.treatment_plans.where('patient_id').equals(String(patientId)).toArray();
      }
      return plans;
    } catch { return []; }
  }

  private async fetchSurgeries(patientId: string): Promise<any[]> {
    if (navigator.onLine) {
      try {
        const surgeries = await apiClient.getSurgeries(patientId);
        if (Array.isArray(surgeries) && surgeries.length > 0) return surgeries;
      } catch (e) {
        console.warn('Could not fetch surgeries from server:', e);
      }
    }
    try {
      return await db.surgery_bookings.where('patient_id').equals(patientId).toArray();
    } catch { return []; }
  }

  private async fetchLabInvestigations(patientId: string): Promise<any[]> {
    if (navigator.onLine) {
      try {
        const labs = await apiClient.getLabInvestigations(patientId);
        if (Array.isArray(labs) && labs.length > 0) return labs;
      } catch (e) {
        console.warn('Could not fetch lab investigations from server:', e);
      }
    }
    try {
      return await db.lab_results.where('patient_id').equals(patientId).toArray();
    } catch { return []; }
  }

  private async fetchPrescriptions(patientId: string): Promise<any[]> {
    if (navigator.onLine) {
      try {
        const prescriptions = await apiClient.getPrescriptions(patientId);
        if (Array.isArray(prescriptions) && prescriptions.length > 0) return prescriptions;
      } catch (e) {
        console.warn('Could not fetch prescriptions from server:', e);
      }
    }
    try {
      return await db.prescriptions?.where('patient_id').equals(patientId).toArray() || [];
    } catch { return []; }
  }

  private async fetchWardRounds(patientId: string): Promise<any[]> {
    if (navigator.onLine) {
      try {
        const rounds = await apiClient.getWardRoundsByPatient(patientId);
        if (Array.isArray(rounds) && rounds.length > 0) return rounds;
      } catch (e) {
        console.warn('Could not fetch ward rounds from server:', e);
      }
    }
    try {
      return await db.ward_rounds.filter(r => r.patient_id === patientId).toArray();
    } catch { return []; }
  }

  // Generate AI-powered patient summary
  async generateAISummary(patientId: string): Promise<PatientSummary> {
    // Fetch all data from server (with local fallback)
    const patient = await this.fetchPatient(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    const [admissions, allTreatmentPlans, procedures, labResults, prescriptions, wardRounds] = await Promise.all([
      this.fetchAdmissions(patientId),
      this.fetchTreatmentPlans(patientId),
      this.fetchSurgeries(patientId),
      this.fetchLabInvestigations(patientId),
      this.fetchPrescriptions(patientId),
      this.fetchWardRounds(patientId)
    ]);

    // Calculate length of stay
    const rawAdmissionDate = admissions[0]?.admission_date || allTreatmentPlans[0]?.created_at || patient.created_at;
    const admissionDate = typeof rawAdmissionDate === 'string' 
      ? parseISO(rawAdmissionDate) 
      : new Date(rawAdmissionDate);
    const currentDate = new Date();
    const lengthOfStay = differenceInDays(currentDate, admissionDate);

    // Extract diagnosis from multiple sources
    const diagnosisSources: string[] = [];
    
    if (patient.primary_diagnosis) diagnosisSources.push(patient.primary_diagnosis);
    if (patient.diagnosis) diagnosisSources.push(patient.diagnosis);
    if (patient.admitting_diagnosis) diagnosisSources.push(patient.admitting_diagnosis);
    
    allTreatmentPlans.forEach((p: any) => {
      if (p.diagnosis) diagnosisSources.push(p.diagnosis);
    });
    
    admissions.forEach((a: any) => {
      if (a.admitting_diagnosis) diagnosisSources.push(a.admitting_diagnosis);
      if (a.diagnosis) diagnosisSources.push(a.diagnosis);
    });
    
    const uniqueDiagnoses = [...new Set(diagnosisSources.filter(d => d && d.trim()))];
    const finalDiagnosis = uniqueDiagnoses.length > 0 
      ? uniqueDiagnoses.join('; ') 
      : 'No diagnosis recorded';

    // Extract medications from prescriptions AND treatment plans
    const allMedications = this.extractMedications(allTreatmentPlans, prescriptions);

    // Build summary
    const summary: PatientSummary = {
      id: `summary_${Date.now()}`,
      patient_id: patientId,
      patient_name: patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
      hospital_number: patient.hospital_number,
      admission_date: admissionDate,
      current_date: currentDate,
      length_of_stay: lengthOfStay,
      summary: {
        overview: this.generateOverview(patient, allTreatmentPlans, admissions, wardRounds, lengthOfStay),
        diagnosis: finalDiagnosis,
        treatment_progress: this.generateTreatmentProgress(allTreatmentPlans, wardRounds),
        procedures_performed: procedures.map((p: any) => {
          try {
            const procDate = typeof p.date === 'string' ? parseISO(p.date) : new Date(p.date || p.surgery_date);
            return `${p.procedure_name || p.surgery_type || 'Procedure'} (${format(procDate, 'MMM d, yyyy')})`;
          } catch {
            return p.procedure_name || p.surgery_type || 'Procedure';
          }
        }),
        medications: allMedications,
        lab_results_summary: this.summarizeLabResults(labResults),
        complications: this.identifyComplications(allTreatmentPlans, wardRounds),
        current_status: this.determineCurrentStatus(allTreatmentPlans, wardRounds, admissions),
        plan_forward: this.generatePlanForward(allTreatmentPlans, wardRounds)
      },
      generated_by: 'ai',
      generated_at: currentDate
    };

    // Save summary locally
    try {
      await db.patient_summaries.add(summary as any);
    } catch { /* ignore save error */ }
    
    return summary;
  }

  private generateOverview(patient: any, treatmentPlans: any[], admissions: any[], wardRounds: any[], lengthOfStay: number): string {
    const age = patient.dob || patient.date_of_birth ? this.calculateAge(patient.dob || patient.date_of_birth) : 'Unknown';
    const gender = patient.sex || patient.gender || 'Unknown';
    const activePlans = treatmentPlans.filter(p => p.status === 'active').length;
    const totalRounds = wardRounds.length;
    
    let overview = `${age}-year-old ${gender} admitted ${lengthOfStay} day(s) ago with ${activePlans} active treatment plan(s). `;
    
    if (totalRounds > 0) {
      overview += `${totalRounds} ward round(s) documented. `;
    }
    
    const allergies = patient.allergies || patient.known_allergies;
    overview += `Known allergies: ${Array.isArray(allergies) ? allergies.join(', ') : (allergies || 'None documented')}. `;
    
    const comorbidities = patient.comorbidities || patient.medical_history;
    overview += `Comorbidities: ${Array.isArray(comorbidities) ? comorbidities.join(', ') : (comorbidities || 'None documented')}.`;
    
    return overview;
  }

  private calculateAge(dob: string | Date): number {
    const birthDate = typeof dob === 'string' ? parseISO(dob) : new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  private generateTreatmentProgress(treatmentPlans: any[], wardRounds: any[]): string {
    if (treatmentPlans.length === 0 && wardRounds.length === 0) return 'No treatment plans or ward rounds documented';
    
    let progress = '';
    
    if (treatmentPlans.length > 0) {
      const completedSteps = treatmentPlans.reduce((sum, plan) => {
        const steps = plan.steps || [];
        return sum + steps.filter((s: any) => s.status === 'completed').length;
      }, 0);
      const totalSteps = treatmentPlans.reduce((sum, plan) => sum + (plan.steps?.length || 0), 0);
      
      progress += `${completedSteps} of ${totalSteps} treatment steps completed. `;
      progress += `${treatmentPlans.filter(p => p.status === 'completed').length} plan(s) completed, `;
      progress += `${treatmentPlans.filter(p => p.status === 'active').length} active. `;
    }
    
    if (wardRounds.length > 0) {
      // Parse most recent ward round for status
      const latestRound = wardRounds[0];
      let findingsObj: any = {};
      try {
        if (typeof latestRound.findings === 'string') findingsObj = JSON.parse(latestRound.findings);
        else if (latestRound.findings) findingsObj = latestRound.findings;
      } catch { /* ignore */ }
      
      const status = findingsObj.progress_status || latestRound.progress_status || 'stable';
      progress += `Latest ward round status: ${status}. `;
      if (latestRound.plan) progress += `Plan: ${latestRound.plan}. `;
    }
    
    return progress || 'Treatment in progress';
  }

  private extractMedications(treatmentPlans: any[], prescriptions: any[]): string[] {
    const medications: Set<string> = new Set();
    
    // From treatment plans
    treatmentPlans.forEach(plan => {
      if (plan.medications) {
        plan.medications.forEach((med: any) => {
          medications.add(`${med.medication_name || med.name} ${med.dosage || ''} ${med.route || ''} ${med.frequency || ''}`.trim());
        });
      }
    });

    // From prescriptions
    prescriptions.forEach((rx: any) => {
      const name = rx.medication_name || rx.drug_name || rx.name;
      if (name) {
        medications.add(`${name} ${rx.dosage || ''} ${rx.route || ''} ${rx.frequency || ''}`.trim());
      }
    });

    return Array.from(medications);
  }

  private summarizeLabResults(labResults: any[]): string {
    if (labResults.length === 0) return 'No lab results available';
    
    const recent = labResults.slice(-5);
    const abnormal = recent.filter(r => r.status === 'abnormal' || r.status === 'critical' || r.is_abnormal);
    
    return `${labResults.length} investigation(s) ordered. ${recent.length} recent result(s). ${abnormal.length} abnormal result(s) requiring attention.`;
  }

  private identifyComplications(treatmentPlans: any[], wardRounds: any[]): string[] {
    const complications: string[] = [];
    
    treatmentPlans.forEach(plan => {
      if (plan.procedures) {
        plan.procedures.forEach((proc: any) => {
          if (proc.delay_days && proc.delay_days > 0) {
            complications.push(`${proc.procedure_name} delayed by ${proc.delay_days} day(s)`);
          }
        });
      }
      if (plan.discharge_timeline?.delay_days && plan.discharge_timeline.delay_days > 0) {
        complications.push(`Discharge delayed by ${plan.discharge_timeline.delay_days} day(s)`);
      }
    });

    // Check ward rounds for complications
    wardRounds.forEach((round: any) => {
      let findingsObj: any = {};
      try {
        if (typeof round.findings === 'string') findingsObj = JSON.parse(round.findings);
        else if (round.findings) findingsObj = round.findings;
      } catch { /* ignore */ }
      
      if (findingsObj.complications) {
        complications.push(findingsObj.complications);
      }
      if (findingsObj.progress_status === 'deteriorating' || findingsObj.progress_status === 'critical') {
        const dateStr = round.round_date ? format(new Date(round.round_date), 'MMM d') : '';
        complications.push(`Patient was ${findingsObj.progress_status} on ${dateStr}`);
      }
    });

    return complications.length > 0 ? complications : ['No complications documented'];
  }

  private determineCurrentStatus(treatmentPlans: any[], wardRounds: any[], admissions: any[]): string {
    // Check latest ward round first
    if (wardRounds.length > 0) {
      const latestRound = wardRounds[0];
      let findingsObj: any = {};
      try {
        if (typeof latestRound.findings === 'string') findingsObj = JSON.parse(latestRound.findings);
        else if (latestRound.findings) findingsObj = latestRound.findings;
      } catch { /* ignore */ }
      
      const status = findingsObj.progress_status || 'stable';
      if (status === 'improved') return 'Improving - responding well to treatment';
      if (status === 'stable') return 'Stable - ongoing treatment';
      if (status === 'deteriorating') return 'Deteriorating - requires urgent review';
      if (status === 'critical') return 'Critical - immediate attention needed';
    }
    
    // Check admissions
    const activeAdmission = admissions.find(a => a.status === 'active' || !a.discharge_date);
    if (activeAdmission) return 'Currently admitted - ongoing care';
    
    const activePlans = treatmentPlans.filter(p => p.status === 'active');
    if (activePlans.length === 0) return 'No active treatment plans';
    
    const hasDischarge = activePlans.some(p => p.discharge_timeline?.status === 'ready');
    if (hasDischarge) return 'Ready for discharge';
    
    return 'Ongoing treatment';
  }

  private generatePlanForward(treatmentPlans: any[], wardRounds: any[]): string {
    const parts: string[] = [];
    
    const activePlans = treatmentPlans.filter(p => p.status === 'active');
    
    if (activePlans.length > 0) {
      const upcomingReviews = activePlans.reduce((sum, plan) => {
        const pending = (plan.reviews || []).filter((r: any) => r.status === 'pending').length;
        return sum + pending;
      }, 0);
      const upcomingProcedures = activePlans.reduce((sum, plan) => {
        const planned = (plan.procedures || []).filter((p: any) => p.status === 'planned').length;
        return sum + planned;
      }, 0);

      if (upcomingReviews > 0) parts.push(`${upcomingReviews} review(s) scheduled`);
      if (upcomingProcedures > 0) parts.push(`${upcomingProcedures} procedure(s) planned`);
    }
    
    // Get plan from latest ward round
    if (wardRounds.length > 0) {
      const latestRound = wardRounds[0];
      if (latestRound.plan) parts.push(`Ward round plan: ${latestRound.plan}`);
      
      let findingsObj: any = {};
      try {
        if (typeof latestRound.findings === 'string') findingsObj = JSON.parse(latestRound.findings);
        else if (latestRound.findings) findingsObj = latestRound.findings;
      } catch { /* ignore */ }
      
      if (findingsObj.discharge_planning) parts.push(`Discharge: ${findingsObj.discharge_planning}`);
    }
    
    if (parts.length === 0) return activePlans.length === 0 ? 'Complete discharge process' : 'Continue monitoring progress';
    
    return parts.join('. ') + '.';
  }

  // Get patient summary
  async getPatientSummary(patientId: string): Promise<PatientSummary | undefined> {
    const summaries = await db.patient_summaries
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('generated_at');
    
    return summaries[0];
  }

  // Get all summaries for a patient
  async getPatientSummaryHistory(patientId: string): Promise<PatientSummary[]> {
    return await db.patient_summaries
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('generated_at');
  }
}

export const patientSummaryService = new PatientSummaryService();
