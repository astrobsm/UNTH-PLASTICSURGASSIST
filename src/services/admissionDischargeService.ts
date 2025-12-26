import { db } from '../db/database';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

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
    const id = await db.admissions.add(admission);
    return id as number;
  }

  async getAdmission(id: number): Promise<Admission | undefined> {
    return await db.admissions.get(id);
  }

  async getActiveAdmissions(): Promise<Admission[]> {
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.status === 'active')
      .sort((a, b) => new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime());
  }

  async getPatientAdmissions(patientId: number): Promise<Admission[]> {
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
  }

  async markAsDischargedAdmission(admissionId: number): Promise<void> {
    await db.admissions.update(admissionId, {
      status: 'discharged',
      discharge_date: new Date().toISOString().split('T')[0],
      updated_at: new Date()
    });
  }

  async getAdmissionsByWard(ward: string): Promise<Admission[]> {
    const admissions = await db.admissions.toArray();
    return admissions
      .filter(a => a.ward_location === ward && a.status === 'active')
      .sort((a, b) => new Date(b.admission_date).getTime() - new Date(a.admission_date).getTime());
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

    const id = await db.discharges.add(discharge);

    // Update admission status
    if (dischargeData.admission_id) {
      await db.admissions.update(dischargeData.admission_id, {
        status: dischargeData.discharge_type === 'deceased' ? 'deceased' : 
                dischargeData.discharge_type === 'transfer' ? 'transferred' : 'discharged',
        discharge_date: dischargeData.discharge_date,
        updated_at: now
      });
    }

    return id as number;
  }

  async getDischarge(id: number): Promise<Discharge | undefined> {
    return await db.discharges.get(id);
  }

  async getAllDischarges(): Promise<Discharge[]> {
    const discharges = await db.discharges.toArray();
    return discharges.sort((a, b) => 
      new Date(b.discharge_date).getTime() - new Date(a.discharge_date).getTime()
    );
  }

  async getPatientDischarges(patientId: number): Promise<Discharge[]> {
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
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = 15;

    const addHeader = () => {
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text('University of Nigeria Teaching Hospital, Enugu', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;
    };

    const checkPageBreak = (neededSpace: number) => {
      if (yPos + neededSpace > pageHeight - 20) {
        pdf.addPage();
        yPos = 20;
        return true;
      }
      return false;
    };

    const addSection = (title: string, content: string) => {
      checkPageBreak(30);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(title, 15, yPos);
      yPos += 6;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const lines = pdf.splitTextToSize(content, pageWidth - 30);
      lines.forEach((line: string) => {
        checkPageBreak(6);
        pdf.text(line, 15, yPos);
        yPos += 5;
      });
      yPos += 5;
    };

    // Page 1: Discharge Summary
    addHeader();
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DISCHARGE SUMMARY', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Patient Info Box
    pdf.setDrawColor(0, 128, 0);
    pdf.rect(15, yPos, pageWidth - 30, 25);
    yPos += 6;
    pdf.setFontSize(10);
    pdf.text(`Patient: ${discharge.patient_name}`, 20, yPos);
    pdf.text(`Hospital No: ${discharge.hospital_number}`, pageWidth / 2, yPos);
    yPos += 6;
    pdf.text(`Age/Gender: ${discharge.age || 'N/A'} / ${discharge.gender || 'N/A'}`, 20, yPos);
    pdf.text(`Ward: ${admission.ward_location}`, pageWidth / 2, yPos);
    yPos += 6;
    pdf.text(`Admission: ${format(new Date(discharge.admission_date), 'dd/MM/yyyy')}`, 20, yPos);
    pdf.text(`Discharge: ${format(new Date(discharge.discharge_date), 'dd/MM/yyyy')}`, pageWidth / 2, yPos);
    yPos += 6;
    pdf.text(`Length of Stay: ${discharge.length_of_stay_days} days`, 20, yPos);
    yPos += 15;

    addSection('DIAGNOSIS', `Admitting: ${discharge.admitting_diagnosis}\nFinal: ${discharge.final_diagnosis}`);
    
    if (discharge.procedures_performed?.length) {
      addSection('PROCEDURES', discharge.procedures_performed.join('\n'));
    }

    addSection('HOSPITAL COURSE', discharge.hospital_course_summary);
    addSection('CONDITION AT DISCHARGE', `${discharge.condition_at_discharge}\nDischarge Type: ${discharge.discharge_type.replace('_', ' ').toUpperCase()}`);

    // Page 2: Medications
    if (discharge.medications_on_discharge?.length) {
      pdf.addPage();
      yPos = 20;
      addHeader();
      
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DISCHARGE MEDICATIONS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      discharge.medications_on_discharge.forEach((med, idx) => {
        checkPageBreak(25);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${idx + 1}. ${med.medication}`, 15, yPos);
        yPos += 5;
        pdf.setFont('helvetica', 'normal');
        pdf.text(`   Dosage: ${med.dosage} | Frequency: ${med.frequency} | Duration: ${med.duration}`, 15, yPos);
        yPos += 5;
        if (med.instructions) {
          pdf.text(`   Instructions: ${med.instructions}`, 15, yPos);
          yPos += 5;
        }
        yPos += 3;
      });
    }

    // Page 3: Instructions & Meal Plan
    pdf.addPage();
    yPos = 20;
    addHeader();
    
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DISCHARGE INSTRUCTIONS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    if (discharge.wound_care_instructions) {
      addSection('WOUND CARE', discharge.wound_care_instructions);
    }

    if (discharge.activity_restrictions?.length) {
      addSection('ACTIVITY RESTRICTIONS', discharge.activity_restrictions.join('\n'));
    }

    if (discharge.lifestyle_modifications?.length) {
      addSection('LIFESTYLE MODIFICATIONS', discharge.lifestyle_modifications.join('\n'));
    }

    // Warning Signs
    const warningSigns = discharge.warning_signs || [
      'Fever above 38°C', 'Increasing pain', 'Wound infection signs', 'Difficulty breathing'
    ];
    addSection('SEEK MEDICAL ATTENTION IF', warningSigns.join('\n'));

    // Follow-up
    if (discharge.follow_up_appointments?.length) {
      const followUpText = discharge.follow_up_appointments.map(apt => 
        `${format(new Date(apt.date), 'dd MMM yyyy')} - ${apt.clinic}: ${apt.purpose}`
      ).join('\n');
      addSection('FOLLOW-UP APPOINTMENTS', followUpText);
    }

    // Signature section
    yPos = pageHeight - 40;
    pdf.setFontSize(10);
    pdf.text(`Discharging Doctor: ${discharge.discharging_doctor}`, 15, yPos);
    yPos += 6;
    pdf.text(`Consultant: ${discharge.discharging_consultant || 'N/A'}`, 15, yPos);
    yPos += 6;
    pdf.text(`Date: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, yPos);

    return pdf.output('blob');
  }

  async downloadDischargePDF(discharge: Discharge, admission: Admission, whoScore?: WHODischargeScore): Promise<void> {
    const pdfBlob = await this.generateDischargePDF(discharge, admission, whoScore);
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Discharge_${discharge.patient_name.replace(/\s+/g, '_')}_${format(new Date(discharge.discharge_date), 'yyyyMMdd')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async shareDischargePDF(discharge: Discharge, admission: Admission, method: 'email' | 'whatsapp'): Promise<void> {
    const pdfBlob = await this.generateDischargePDF(discharge, admission);
    const fileName = `Discharge_${discharge.patient_name.replace(/\s+/g, '_')}.pdf`;

    if (method === 'whatsapp') {
      // For WhatsApp, we need to share via Web Share API if available
      if (navigator.share) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        try {
          await navigator.share({
            files: [file],
            title: `Discharge Summary - ${discharge.patient_name}`,
            text: `Discharge summary for ${discharge.patient_name}`
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
