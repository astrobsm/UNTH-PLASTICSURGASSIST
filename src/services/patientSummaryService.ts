import { db } from '../db/database';
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
  // Generate AI-powered patient summary
  async generateAISummary(patientId: string): Promise<PatientSummary> {
    // Get patient data - try by serverId first, then by numeric id
    let patient = await db.patients.where('id').equals(patientId).first();
    
    if (!patient) {
      // Try as numeric ID if patientId is a number
      const numericId = parseInt(patientId);
      if (!isNaN(numericId)) {
        patient = await db.patients.get(numericId);
      }
    }
    
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Get treatment plans - use the actual patient id from the patient object
    const actualPatientId = patient.id || patientId;
    const treatmentPlans = await db.treatment_plans
      .where('patient_id')
      .equals(actualPatientId)
      .toArray();

    // Also try with string ID for server-synced records
    let allTreatmentPlans = treatmentPlans;
    if (treatmentPlans.length === 0) {
      const stringIdPlans = await db.treatment_plans
        .where('patient_id')
        .equals(String(actualPatientId))
        .toArray();
      allTreatmentPlans = stringIdPlans;
    }

    // Get admissions for diagnosis
    let admissions = await db.admissions
      .where('patient_id')
      .equals(actualPatientId)
      .toArray();
    
    if (admissions.length === 0) {
      admissions = await db.admissions
        .where('patient_id')
        .equals(String(actualPatientId))
        .toArray();
    }

    // Get procedures from scheduling
    const procedures = await db.surgery_bookings
      .where('patient_id')
      .equals(actualPatientId)
      .toArray();

    // Get lab results
    const labResults = await db.lab_results
      .where('patient_id')
      .equals(actualPatientId)
      .toArray();

    // Calculate length of stay (using first treatment plan admission date or admission record)
    const rawAdmissionDate = admissions[0]?.admission_date || allTreatmentPlans[0]?.created_at || patient.created_at;
    const admissionDate = typeof rawAdmissionDate === 'string' 
      ? parseISO(rawAdmissionDate) 
      : new Date(rawAdmissionDate);
    const currentDate = new Date();
    const lengthOfStay = differenceInDays(currentDate, admissionDate);

    // Extract diagnosis from multiple sources
    const diagnosisSources: string[] = [];
    
    // From patient record itself (primary_diagnosis field - PRIORITY)
    if ((patient as any).primary_diagnosis) {
      diagnosisSources.push((patient as any).primary_diagnosis);
    }
    if ((patient as any).diagnosis) {
      diagnosisSources.push((patient as any).diagnosis);
    }
    if ((patient as any).admitting_diagnosis) {
      diagnosisSources.push((patient as any).admitting_diagnosis);
    }
    
    // From treatment plans
    allTreatmentPlans.forEach(p => {
      if (p.diagnosis) diagnosisSources.push(p.diagnosis);
    });
    
    // From admissions
    admissions.forEach((a: any) => {
      if (a.admitting_diagnosis) diagnosisSources.push(a.admitting_diagnosis);
      if (a.diagnosis) diagnosisSources.push(a.diagnosis);
    });
    
    // Deduplicate and join
    const uniqueDiagnoses = [...new Set(diagnosisSources.filter(d => d && d.trim()))];
    const finalDiagnosis = uniqueDiagnoses.length > 0 
      ? uniqueDiagnoses.join('; ') 
      : 'No diagnosis recorded';

    // Build AI-powered summary using actual data
    const summary: PatientSummary = {
      id: `summary_${Date.now()}`,
      patient_id: patientId,
      patient_name: `${patient.first_name} ${patient.last_name}`,
      hospital_number: patient.hospital_number,
      admission_date: admissionDate,
      current_date: currentDate,
      length_of_stay: lengthOfStay,
      summary: {
        overview: this.generateOverview(patient, allTreatmentPlans, lengthOfStay),
        diagnosis: finalDiagnosis,
        treatment_progress: this.generateTreatmentProgress(allTreatmentPlans),
        procedures_performed: procedures.map(p => {
          const procDate = typeof p.date === 'string' ? parseISO(p.date) : new Date(p.date);
          return `${p.procedure_name} (${format(procDate, 'MMM d, yyyy')})`;
        }),
        medications: this.extractMedications(allTreatmentPlans),
        lab_results_summary: this.summarizeLabResults(labResults),
        complications: this.identifyComplications(allTreatmentPlans),
        current_status: this.determineCurrentStatus(allTreatmentPlans),
        plan_forward: this.generatePlanForward(allTreatmentPlans)
      },
      generated_by: 'ai',
      generated_at: currentDate
    };

    // Save summary
    await db.patient_summaries.add(summary as any);
    
    return summary;
  }

  private generateOverview(patient: any, treatmentPlans: any[], lengthOfStay: number): string {
    const age = patient.dob ? this.calculateAge(patient.dob) : 'Unknown';
    const gender = patient.sex || 'Unknown';
    const activePlans = treatmentPlans.filter(p => p.status === 'active').length;
    
    return `${age}-year-old ${gender} admitted ${lengthOfStay} day(s) ago with ${activePlans} active treatment plan(s). ` +
           `Known allergies: ${patient.allergies?.join(', ') || 'None documented'}. ` +
           `Comorbidities: ${patient.comorbidities?.join(', ') || 'None documented'}.`;
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

  private generateTreatmentProgress(treatmentPlans: any[]): string {
    if (treatmentPlans.length === 0) return 'No treatment plans documented';
    
    const completedSteps = treatmentPlans.reduce((sum, plan) => {
      const steps = plan.steps || [];
      return sum + steps.filter((s: any) => s.status === 'completed').length;
    }, 0);

    const totalSteps = treatmentPlans.reduce((sum, plan) => sum + (plan.steps?.length || 0), 0);
    
    return `${completedSteps} of ${totalSteps} treatment steps completed. ` +
           `${treatmentPlans.filter(p => p.status === 'completed').length} plan(s) completed, ` +
           `${treatmentPlans.filter(p => p.status === 'active').length} active.`;
  }

  private extractMedications(treatmentPlans: any[]): string[] {
    const medications: Set<string> = new Set();
    
    treatmentPlans.forEach(plan => {
      if (plan.medications) {
        plan.medications.forEach((med: any) => {
          medications.add(`${med.medication_name} ${med.dosage} ${med.route} ${med.frequency}`);
        });
      }
    });

    return Array.from(medications);
  }

  private summarizeLabResults(labResults: any[]): string {
    if (labResults.length === 0) return 'No lab results available';
    
    const recent = labResults.slice(-5);
    const abnormal = recent.filter(r => r.status === 'abnormal' || r.status === 'critical');
    
    return `${recent.length} recent test(s). ${abnormal.length} abnormal result(s) requiring attention.`;
  }

  private identifyComplications(treatmentPlans: any[]): string[] {
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

    return complications.length > 0 ? complications : ['No complications documented'];
  }

  private determineCurrentStatus(treatmentPlans: any[]): string {
    const activePlans = treatmentPlans.filter(p => p.status === 'active');
    
    if (activePlans.length === 0) return 'No active treatment plans';
    
    const hasDischarge = activePlans.some(p => p.discharge_timeline?.status === 'ready');
    if (hasDischarge) return 'Ready for discharge';
    
    return 'Ongoing treatment';
  }

  private generatePlanForward(treatmentPlans: any[]): string {
    const activePlans = treatmentPlans.filter(p => p.status === 'active');
    
    if (activePlans.length === 0) return 'Complete discharge process';
    
    const upcomingReviews = activePlans.reduce((sum, plan) => {
      const pending = (plan.reviews || []).filter((r: any) => r.status === 'pending').length;
      return sum + pending;
    }, 0);

    const upcomingProcedures = activePlans.reduce((sum, plan) => {
      const planned = (plan.procedures || []).filter((p: any) => p.status === 'planned').length;
      return sum + planned;
    }, 0);

    return `${upcomingReviews} review(s) scheduled. ${upcomingProcedures} procedure(s) planned. Continue monitoring progress.`;
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
