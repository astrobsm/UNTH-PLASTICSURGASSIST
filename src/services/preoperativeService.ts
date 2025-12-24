import { db } from '../db/database';
import { apiClient } from './apiClient';

// Helper for authenticated fetch requests
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = apiClient.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });
};

export interface Medication {
  drug_name: string;
  dosage: string;
  frequency: string;
  route: 'oral' | 'IV' | 'IM' | 'SC' | 'topical' | 'other';
  indication: string;
  start_date?: Date;
  stop_before_surgery?: boolean;
  stop_hours_before?: number;
}

export interface BleedingRiskAssessment {
  anticoagulant_use: boolean;
  anticoagulant_type?: string;
  antiplatelet_use: boolean;
  antiplatelet_type?: string;
  bleeding_disorder: boolean;
  bleeding_disorder_type?: string;
  liver_disease: boolean;
  renal_impairment: boolean;
  recent_bleeding: boolean;
  platelet_count?: number;
  inr?: number;
  pt?: number;
  aptt?: number;
  risk_level: 'low' | 'moderate' | 'high';
  risk_score: number;
  recommendations: string[];
}

export interface CapriniDVTRisk {
  // 1 point factors
  age_41_60: boolean;
  minor_surgery: boolean;
  history_major_surgery: boolean;
  varicose_veins: boolean;
  history_inflammatory_bowel: boolean;
  swollen_legs: boolean;
  obesity_bmi_over_25: boolean;
  acute_mi: boolean;
  chf_1_month: boolean;
  sepsis_1_month: boolean;
  serious_lung_disease: boolean;
  abnormal_pulmonary_function: boolean;
  medical_patient_bed_rest: boolean;
  
  // 2 points factors
  age_61_74: boolean;
  arthroscopic_surgery: boolean;
  malignancy: boolean;
  major_surgery_over_45min: boolean;
  laparoscopic_over_45min: boolean;
  patient_confined_to_bed: boolean;
  immobilizing_plaster_cast: boolean;
  central_venous_access: boolean;
  
  // 3 points factors
  age_over_75: boolean;
  history_dvt_pe: boolean;
  family_history_dvt: boolean;
  factor_v_leiden: boolean;
  prothrombin_20210a: boolean;
  lupus_anticoagulant: boolean;
  anticardiolipin_antibodies: boolean;
  heparin_induced_thrombocytopenia: boolean;
  other_thrombophilia: boolean;
  
  // 5 points factors
  elective_major_lower_extremity_arthroplasty: boolean;
  hip_pelvis_leg_fracture: boolean;
  stroke_1_month: boolean;
  multiple_trauma: boolean;
  acute_spinal_cord_injury: boolean;
  
  total_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'very-high';
  prophylaxis_recommendation: string;
}

export interface CardiovascularRiskAssessment {
  // Revised Cardiac Risk Index (RCRI) factors
  high_risk_surgery: boolean;
  ischemic_heart_disease: boolean;
  history_chf: boolean;
  history_cerebrovascular_disease: boolean;
  diabetes_on_insulin: boolean;
  preop_creatinine_over_2: boolean;
  
  // Additional factors
  hypertension: boolean;
  smoking: boolean;
  age_over_65: boolean;
  
  // Vitals
  systolic_bp?: number;
  diastolic_bp?: number;
  heart_rate?: number;
  
  // Labs
  creatinine?: number;
  hba1c?: number;
  
  rcri_score: number;
  risk_level: 'low' | 'intermediate' | 'high';
  cardiac_event_risk_percent: number;
  recommendations: string[];
}

export interface PressureSoreRiskAssessment {
  // Braden Scale
  sensory_perception: 1 | 2 | 3 | 4; // 1=completely limited, 4=no impairment
  moisture: 1 | 2 | 3 | 4; // 1=constantly moist, 4=rarely moist
  activity: 1 | 2 | 3 | 4; // 1=bedfast, 4=walks frequently
  mobility: 1 | 2 | 3 | 4; // 1=completely immobile, 4=no limitations
  nutrition: 1 | 2 | 3 | 4; // 1=very poor, 4=excellent
  friction_shear: 1 | 2 | 3; // 1=problem, 3=no apparent problem
  
  braden_total: number; // 6-23, lower = higher risk
  risk_category: 'severe' | 'high' | 'moderate' | 'low' | 'no-risk';
  preventive_measures: string[];
}

export interface ComorbidityMedication {
  comorbidity: string;
  medications: Medication[];
}

export interface PreoperativeAssessment {
  id?: string;
  patient_id: string;
  surgery_booking_id?: string;
  
  // Medications
  current_medications: Medication[];
  
  // Risk Assessments
  bleeding_risk?: BleedingRiskAssessment;
  dvt_risk?: CapriniDVTRisk;
  cardiovascular_risk?: CardiovascularRiskAssessment;
  pressure_sore_risk?: PressureSoreRiskAssessment;
  
  // Comorbidities with medications
  comorbidities_medications: ComorbidityMedication[];
  
  // File uploads (base64 or URLs)
  consent_document?: string;
  payment_evidence?: string;
  insurance_covered: boolean;
  
  // Generated summaries
  comprehensive_summary?: string;
  preop_instructions?: string;
  
  // Metadata
  assessed_by: string;
  assessed_at: Date;
  updated_at: Date;
}

export interface ComprehensiveSummaryData {
  patient: any;
  assessment: PreoperativeAssessment;
  surgery_details: any;
  lab_results: any[];
  vital_signs: any[];
  allergies: string[];
  emergency_contact?: any;
}

class PreoperativeService {
  /**
   * Calculate bleeding risk score and level
   */
  calculateBleedingRisk(assessment: Partial<BleedingRiskAssessment>): BleedingRiskAssessment {
    let score = 0;
    const recommendations: string[] = [];
    
    if (assessment.anticoagulant_use) {
      score += 3;
      recommendations.push(`Stop ${assessment.anticoagulant_type || 'anticoagulant'} as per protocol`);
    }
    if (assessment.antiplatelet_use) {
      score += 2;
      recommendations.push(`Consider stopping ${assessment.antiplatelet_type || 'antiplatelet'} 7-10 days pre-op`);
    }
    if (assessment.bleeding_disorder) {
      score += 4;
      recommendations.push('Consult hematology');
    }
    if (assessment.liver_disease) {
      score += 2;
      recommendations.push('Check coagulation profile');
    }
    if (assessment.renal_impairment) {
      score += 1;
      recommendations.push('Monitor renal function');
    }
    if (assessment.recent_bleeding) {
      score += 3;
      recommendations.push('Investigate cause of recent bleeding');
    }
    
    // Lab values
    if (assessment.platelet_count && assessment.platelet_count < 100000) {
      score += 2;
      recommendations.push('Consider platelet transfusion if <50,000');
    }
    if (assessment.inr && assessment.inr > 1.5) {
      score += 2;
      recommendations.push('Correct INR to <1.5 before surgery');
    }
    
    const risk_level = score >= 7 ? 'high' : score >= 4 ? 'moderate' : 'low';
    
    return {
      ...assessment as BleedingRiskAssessment,
      risk_score: score,
      risk_level,
      recommendations
    };
  }

  /**
   * Calculate Caprini DVT risk score
   */
  calculateCapriniScore(assessment: Partial<CapriniDVTRisk>): CapriniDVTRisk {
    let score = 0;
    
    // 1 point factors
    if (assessment.age_41_60) score += 1;
    if (assessment.minor_surgery) score += 1;
    if (assessment.history_major_surgery) score += 1;
    if (assessment.varicose_veins) score += 1;
    if (assessment.history_inflammatory_bowel) score += 1;
    if (assessment.swollen_legs) score += 1;
    if (assessment.obesity_bmi_over_25) score += 1;
    if (assessment.acute_mi) score += 1;
    if (assessment.chf_1_month) score += 1;
    if (assessment.sepsis_1_month) score += 1;
    if (assessment.serious_lung_disease) score += 1;
    if (assessment.abnormal_pulmonary_function) score += 1;
    if (assessment.medical_patient_bed_rest) score += 1;
    
    // 2 points factors
    if (assessment.age_61_74) score += 2;
    if (assessment.arthroscopic_surgery) score += 2;
    if (assessment.malignancy) score += 2;
    if (assessment.major_surgery_over_45min) score += 2;
    if (assessment.laparoscopic_over_45min) score += 2;
    if (assessment.patient_confined_to_bed) score += 2;
    if (assessment.immobilizing_plaster_cast) score += 2;
    if (assessment.central_venous_access) score += 2;
    
    // 3 points factors
    if (assessment.age_over_75) score += 3;
    if (assessment.history_dvt_pe) score += 3;
    if (assessment.family_history_dvt) score += 3;
    if (assessment.factor_v_leiden) score += 3;
    if (assessment.prothrombin_20210a) score += 3;
    if (assessment.lupus_anticoagulant) score += 3;
    if (assessment.anticardiolipin_antibodies) score += 3;
    if (assessment.heparin_induced_thrombocytopenia) score += 3;
    if (assessment.other_thrombophilia) score += 3;
    
    // 5 points factors
    if (assessment.elective_major_lower_extremity_arthroplasty) score += 5;
    if (assessment.hip_pelvis_leg_fracture) score += 5;
    if (assessment.stroke_1_month) score += 5;
    if (assessment.multiple_trauma) score += 5;
    if (assessment.acute_spinal_cord_injury) score += 5;
    
    let risk_category: 'low' | 'moderate' | 'high' | 'very-high';
    let prophylaxis_recommendation: string;
    
    if (score === 0) {
      risk_category = 'low';
      prophylaxis_recommendation = 'Early ambulation';
    } else if (score <= 2) {
      risk_category = 'moderate';
      prophylaxis_recommendation = 'Mechanical prophylaxis (IPC or GCS)';
    } else if (score <= 4) {
      risk_category = 'high';
      prophylaxis_recommendation = 'LMWH or Mechanical prophylaxis';
    } else {
      risk_category = 'very-high';
      prophylaxis_recommendation = 'LMWH + Mechanical prophylaxis';
    }
    
    return {
      ...assessment as CapriniDVTRisk,
      total_score: score,
      risk_category,
      prophylaxis_recommendation
    };
  }

  /**
   * Calculate cardiovascular risk (RCRI)
   */
  calculateCardiovascularRisk(assessment: Partial<CardiovascularRiskAssessment>): CardiovascularRiskAssessment {
    let rcri_score = 0;
    const recommendations: string[] = [];
    
    if (assessment.high_risk_surgery) rcri_score += 1;
    if (assessment.ischemic_heart_disease) {
      rcri_score += 1;
      recommendations.push('Continue cardiac medications perioperatively');
    }
    if (assessment.history_chf) {
      rcri_score += 1;
      recommendations.push('Optimize fluid status');
    }
    if (assessment.history_cerebrovascular_disease) rcri_score += 1;
    if (assessment.diabetes_on_insulin) {
      rcri_score += 1;
      recommendations.push('Perioperative glucose monitoring');
    }
    if (assessment.preop_creatinine_over_2) rcri_score += 1;
    
    // Additional recommendations
    if (assessment.hypertension) {
      recommendations.push('Continue antihypertensives except ACE-I/ARBs on day of surgery');
    }
    if (assessment.smoking) {
      recommendations.push('Smoking cessation advised');
    }
    
    let risk_level: 'low' | 'intermediate' | 'high';
    let cardiac_event_risk_percent: number;
    
    if (rcri_score === 0) {
      risk_level = 'low';
      cardiac_event_risk_percent = 0.4;
    } else if (rcri_score === 1) {
      risk_level = 'low';
      cardiac_event_risk_percent = 0.9;
    } else if (rcri_score === 2) {
      risk_level = 'intermediate';
      cardiac_event_risk_percent = 6.6;
      recommendations.push('Consider cardiology consultation');
    } else {
      risk_level = 'high';
      cardiac_event_risk_percent = 11;
      recommendations.push('Cardiology consultation required');
      recommendations.push('Consider non-invasive cardiac testing');
    }
    
    return {
      ...assessment as CardiovascularRiskAssessment,
      rcri_score,
      risk_level,
      cardiac_event_risk_percent,
      recommendations
    };
  }

  /**
   * Calculate pressure sore risk (Braden Scale)
   */
  calculatePressureSoreRisk(assessment: Partial<PressureSoreRiskAssessment>): PressureSoreRiskAssessment {
    const total = 
      (assessment.sensory_perception || 4) +
      (assessment.moisture || 4) +
      (assessment.activity || 4) +
      (assessment.mobility || 4) +
      (assessment.nutrition || 4) +
      (assessment.friction_shear || 3);
    
    let risk_category: 'severe' | 'high' | 'moderate' | 'low' | 'no-risk';
    const preventive_measures: string[] = [];
    
    if (total <= 9) {
      risk_category = 'severe';
      preventive_measures.push('Pressure-relieving mattress required');
      preventive_measures.push('Turn every 2 hours');
      preventive_measures.push('Nutritional support');
      preventive_measures.push('Skin care protocol');
    } else if (total <= 12) {
      risk_category = 'high';
      preventive_measures.push('Pressure-relieving mattress');
      preventive_measures.push('Repositioning schedule');
      preventive_measures.push('Nutritional assessment');
    } else if (total <= 14) {
      risk_category = 'moderate';
      preventive_measures.push('Foam mattress overlay');
      preventive_measures.push('Regular repositioning');
    } else if (total <= 18) {
      risk_category = 'low';
      preventive_measures.push('Standard precautions');
    } else {
      risk_category = 'no-risk';
      preventive_measures.push('Routine care');
    }
    
    return {
      ...assessment as PressureSoreRiskAssessment,
      braden_total: total,
      risk_category,
      preventive_measures
    };
  }

  /**
   * Generate AI-powered comprehensive pre-operative summary
   */
  async generateComprehensiveSummary(data: ComprehensiveSummaryData): Promise<string> {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey || apiKey === '••••••••••••••••') {
      // Return a structured summary without AI
      return this.generateStructuredSummary(data);
    }

    try {
      const prompt = this.buildComprehensiveSummaryPrompt(data);
      
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert plastic surgeon preparing comprehensive pre-operative summaries. Generate professional, detailed summaries suitable for the operating theatre and medical records.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'gpt-4',
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const aiData = await response.json();
      return aiData.response || aiData.choices?.[0]?.message?.content || this.generateStructuredSummary(data);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return this.generateStructuredSummary(data);
    }
  }

  /**
   * Build prompt for comprehensive summary
   */
  private buildComprehensiveSummaryPrompt(data: ComprehensiveSummaryData): string {
    const { patient, assessment, surgery_details, lab_results, allergies } = data;
    
    return `Generate a comprehensive pre-operative summary for the following patient:

PATIENT INFORMATION:
- Name: ${patient.first_name} ${patient.last_name}
- Hospital Number: ${patient.hospital_number}
- Age: ${this.calculateAge(patient.dob)} years
- Gender: ${patient.sex}
- Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'None documented'}

SURGERY DETAILS:
- Procedure: ${surgery_details.procedure_name}
- Indication: ${surgery_details.indication}
- Anaesthesia: ${surgery_details.anaesthesia_type}
- Date: ${surgery_details.date}

CURRENT MEDICATIONS:
${assessment.current_medications.map(m => `- ${m.drug_name} ${m.dosage} ${m.frequency} (${m.route}) - ${m.indication}`).join('\n')}

RISK ASSESSMENTS:
Bleeding Risk: ${assessment.bleeding_risk?.risk_level || 'Not assessed'} (Score: ${assessment.bleeding_risk?.risk_score || 'N/A'})
DVT Risk: ${assessment.dvt_risk?.risk_category || 'Not assessed'} (Caprini Score: ${assessment.dvt_risk?.total_score || 'N/A'})
Cardiovascular Risk: ${assessment.cardiovascular_risk?.risk_level || 'Not assessed'} (RCRI: ${assessment.cardiovascular_risk?.rcri_score || 'N/A'})
Pressure Sore Risk: ${assessment.pressure_sore_risk?.risk_category || 'Not assessed'} (Braden: ${assessment.pressure_sore_risk?.braden_total || 'N/A'})

COMORBIDITIES:
${assessment.comorbidities_medications.map(cm => `- ${cm.comorbidity}: ${cm.medications.map(m => m.drug_name).join(', ')}`).join('\n')}

LABORATORY RESULTS:
${lab_results.map(lr => `- ${lr.test_name}: ${lr.value} ${lr.unit}`).join('\n')}

Generate a professional pre-operative summary that includes:
1. Patient overview and surgical indication
2. Relevant medical history and comorbidities
3. Risk stratification and implications
4. Critical medications and perioperative management
5. Special precautions and recommendations
6. Anticipated challenges and mitigation strategies

Format as a formal medical summary suitable for the theatre team and medical records.`;
  }

  /**
   * Generate structured summary without AI
   */
  private generateStructuredSummary(data: ComprehensiveSummaryData): string {
    const { patient, assessment, surgery_details, allergies } = data;
    
    return `
PRE-OPERATIVE SUMMARY

PATIENT DETAILS:
Name: ${patient.first_name} ${patient.last_name}
Hospital Number: ${patient.hospital_number}
Age/Sex: ${this.calculateAge(patient.dob)} years / ${patient.sex}
Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'NKDA'}

PLANNED SURGERY:
Procedure: ${surgery_details.procedure_name}
Indication: ${surgery_details.indication}
Anaesthesia: ${surgery_details.anaesthesia_type}
Scheduled Date: ${surgery_details.date}

CURRENT MEDICATIONS:
${assessment.current_medications.map(m => `• ${m.drug_name} ${m.dosage} ${m.frequency} (${m.route}) - ${m.indication}${m.stop_before_surgery ? ` [STOP ${m.stop_hours_before}h pre-op]` : ''}`).join('\n')}

RISK ASSESSMENT SUMMARY:
• Bleeding Risk: ${assessment.bleeding_risk?.risk_level?.toUpperCase() || 'NOT ASSESSED'} (Score: ${assessment.bleeding_risk?.risk_score || 'N/A'})
  ${assessment.bleeding_risk?.recommendations.map(r => `  - ${r}`).join('\n  ') || ''}
  
• DVT Risk: ${assessment.dvt_risk?.risk_category?.toUpperCase() || 'NOT ASSESSED'} (Caprini: ${assessment.dvt_risk?.total_score || 'N/A'})
  Prophylaxis: ${assessment.dvt_risk?.prophylaxis_recommendation || 'Not specified'}
  
• Cardiovascular Risk: ${assessment.cardiovascular_risk?.risk_level?.toUpperCase() || 'NOT ASSESSED'} (RCRI: ${assessment.cardiovascular_risk?.rcri_score || 'N/A'}, ${assessment.cardiovascular_risk?.cardiac_event_risk_percent}% event risk)
  ${assessment.cardiovascular_risk?.recommendations.map(r => `  - ${r}`).join('\n  ') || ''}
  
• Pressure Sore Risk: ${assessment.pressure_sore_risk?.risk_category?.toUpperCase() || 'NOT ASSESSED'} (Braden: ${assessment.pressure_sore_risk?.braden_total || 'N/A'})
  ${assessment.pressure_sore_risk?.preventive_measures.map(m => `  - ${m}`).join('\n  ') || ''}

COMORBIDITIES AND MANAGEMENT:
${assessment.comorbidities_medications.map(cm => `• ${cm.comorbidity}\n  Medications: ${cm.medications.map(m => m.drug_name).join(', ')}`).join('\n')}

DOCUMENTATION:
• Consent: ${assessment.consent_document ? 'Signed and uploaded' : 'PENDING'}
• Payment: ${assessment.insurance_covered ? 'Insurance covered' : assessment.payment_evidence ? 'Evidence uploaded' : 'PENDING'}

---
Summary prepared by: ${assessment.assessed_by}
Date: ${new Date().toLocaleDateString()}
    `.trim();
  }

  /**
   * Generate personalized pre-operative instructions
   */
  async generatePreOpInstructions(data: ComprehensiveSummaryData): Promise<string> {
    const apiKey = localStorage.getItem('openai_api_key');
    if (!apiKey || apiKey === '••••••••••••••••') {
      return this.generateStructuredInstructions(data);
    }

    try {
      const prompt = this.buildInstructionsPrompt(data);
      
      const response = await authenticatedFetch('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert plastic surgeon providing patient-friendly pre-operative instructions. Instructions must be clear, specific, and include all safety information including fasting times.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          model: 'gpt-4',
          max_tokens: 1500
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const aiData = await response.json();
      return aiData.response || aiData.choices?.[0]?.message?.content || this.generateStructuredInstructions(data);
    } catch (error) {
      console.error('Error generating AI instructions:', error);
      return this.generateStructuredInstructions(data);
    }
  }

  /**
   * Build prompt for pre-operative instructions
   */
  private buildInstructionsPrompt(data: ComprehensiveSummaryData): string {
    const { patient, assessment, surgery_details } = data;
    const anaesthesiaType = surgery_details.anaesthesia_type;
    
    return `Generate patient-friendly pre-operative instructions for:

PATIENT: ${patient.first_name} ${patient.last_name}
PROCEDURE: ${surgery_details.procedure_name}
ANAESTHESIA: ${anaesthesiaType}
DATE: ${surgery_details.date}

MEDICATIONS TO STOP:
${assessment.current_medications.filter(m => m.stop_before_surgery).map(m => `- ${m.drug_name}: Stop ${m.stop_hours_before} hours before surgery`).join('\n')}

SPECIAL CONSIDERATIONS:
${assessment.comorbidities_medications.map(cm => `- ${cm.comorbidity}`).join('\n')}

Generate clear, specific instructions including:
1. **FASTING REQUIREMENTS** (based on anaesthesia type: ${anaesthesiaType})
   - Clear fluids: ${anaesthesiaType === 'general' ? '2 hours before' : '2 hours before'}
   - Solid food: ${anaesthesiaType === 'general' ? '6 hours before' : '6 hours before'}
   - Emphasize NO eating or drinking after specified times
   
2. **MEDICATION MANAGEMENT**
   - Which medications to continue
   - Which to stop and when
   - Morning-of-surgery instructions
   
3. **PERSONAL PREPARATION**
   - Shower/bathing instructions
   - Removal of jewelry, makeup, nail polish
   - What to bring to hospital
   
4. **SPECIAL INSTRUCTIONS** based on comorbidities
   
5. **WHAT TO EXPECT** on day of surgery

Format as clear, numbered instructions that patients can easily follow.`;
  }

  /**
   * Generate structured instructions without AI
   */
  private generateStructuredInstructions(data: ComprehensiveSummaryData): string {
    const { patient, assessment, surgery_details } = data;
    const anaesthesiaType = surgery_details.anaesthesia_type;
    
    // Determine fasting times based on anaesthesia type
    let fastingHoursSolid = 6;
    let fastingHoursClear = 2;
    
    if (anaesthesiaType === 'general' || anaesthesiaType === 'sedation') {
      fastingHoursSolid = 8;
      fastingHoursClear = 2;
    } else if (anaesthesiaType === 'regional') {
      fastingHoursSolid = 6;
      fastingHoursClear = 2;
    } else if (anaesthesiaType === 'local') {
      fastingHoursSolid = 4;
      fastingHoursClear = 2;
    }
    
    return `
PRE-OPERATIVE INSTRUCTIONS

Dear ${patient.first_name} ${patient.last_name},

You are scheduled for ${surgery_details.procedure_name} on ${surgery_details.date} under ${anaesthesiaType} anaesthesia.

Please follow these instructions carefully:

═══════════════════════════════════════════════════
⚠️  CRITICAL FASTING REQUIREMENTS (${anaesthesiaType.toUpperCase()} ANAESTHESIA)
═══════════════════════════════════════════════════

🚫 SOLID FOOD: Nothing to eat for ${fastingHoursSolid} hours before surgery
💧 CLEAR FLUIDS: Nothing to drink for ${fastingHoursClear} hours before surgery

This means:
• NO food after [calculate ${fastingHoursSolid} hours before surgery time]
• NO drinks (including water) after [calculate ${fastingHoursClear} hours before surgery time]
• NO chewing gum or sweets

⚠️  FAILURE TO FAST MAY RESULT IN SURGERY CANCELLATION FOR YOUR SAFETY

═══════════════════════════════════════════════════
💊 MEDICATION INSTRUCTIONS
═══════════════════════════════════════════════════

MEDICATIONS TO STOP:
${assessment.current_medications.filter(m => m.stop_before_surgery).map(m => 
  `❌ ${m.drug_name}: STOP ${m.stop_hours_before} hours before surgery`
).join('\n')}

MEDICATIONS TO CONTINUE:
${assessment.current_medications.filter(m => !m.stop_before_surgery).map(m => 
  `✅ ${m.drug_name}: Continue as prescribed (take with small sip of water if needed)`
).join('\n')}

${assessment.comorbidities_medications.length > 0 ? `
SPECIAL INSTRUCTIONS FOR YOUR CONDITIONS:
${assessment.comorbidities_medications.map(cm => `• ${cm.comorbidity}: Continue prescribed medications unless instructed otherwise`).join('\n')}
` : ''}

═══════════════════════════════════════════════════
🛁 PREPARATION THE NIGHT BEFORE
═══════════════════════════════════════════════════

1. Take a shower or bath using antibacterial soap
2. Wash your hair
3. Clean and trim your nails (no nail polish or artificial nails)
4. Remove all makeup, contact lenses, and jewelry
5. Get a good night's sleep

═══════════════════════════════════════════════════
🏥 ON THE DAY OF SURGERY
═══════════════════════════════════════════════════

MORNING OF SURGERY:
□ Shower again with antibacterial soap (do not apply lotions, creams, or deodorant)
□ Brush your teeth (do not swallow water)
□ Do NOT eat or drink anything (unless cleared medications with sip of water)
□ Wear comfortable, loose-fitting clothing
□ Remove all jewelry, piercings, contact lenses

WHAT TO BRING:
□ Valid ID and hospital card
□ Insurance card (if applicable)
${!assessment.insurance_covered ? '□ Payment receipt/evidence' : ''}
□ List of current medications
□ Copy of signed consent form
□ Comfortable clothes for discharge
□ Someone to drive you home

═══════════════════════════════════════════════════
⏰ ARRIVAL TIME
═══════════════════════════════════════════════════

Please arrive at the hospital at: [INSERT TIME - typically 2 hours before surgery]

Report to: Admissions/Pre-operative Area

═══════════════════════════════════════════════════
🚨 IMPORTANT SAFETY INFORMATION
═══════════════════════════════════════════════════

CALL THE HOSPITAL IMMEDIATELY IF:
• You develop a cold, fever, or infection
• You have any changes in your health
• You cannot follow the fasting instructions
• You have questions or concerns

Emergency Contact: [INSERT HOSPITAL NUMBER]

═══════════════════════════════════════════════════
📋 WHAT TO EXPECT
═══════════════════════════════════════════════════

1. Check-in and registration
2. Change into hospital gown
3. Pre-operative assessment by nursing staff
4. IV line placement
5. Meeting with surgeon and anaesthetist
6. Transfer to operating theatre
7. Surgery under ${anaesthesiaType} anaesthesia
8. Recovery in post-anaesthesia care unit
9. Transfer to ward or discharge (depending on procedure)

═══════════════════════════════════════════════════

${assessment.cardiovascular_risk?.risk_level === 'high' || assessment.cardiovascular_risk?.risk_level === 'intermediate' ? 
`⚠️  SPECIAL CARDIAC PRECAUTIONS:
Due to your cardiovascular risk, extra monitoring will be provided during surgery.
${assessment.cardiovascular_risk.recommendations.map(r => `• ${r}`).join('\n')}
` : ''}

${assessment.dvt_risk?.risk_category === 'high' || assessment.dvt_risk?.risk_category === 'very-high' ?
`⚠️  DVT PREVENTION:
You are at ${assessment.dvt_risk.risk_category} risk for blood clots.
• ${assessment.dvt_risk.prophylaxis_recommendation}
• Early mobilization after surgery is important
` : ''}

We look forward to providing you with excellent care.

Prepared by: ${assessment.assessed_by}
Date: ${new Date().toLocaleDateString()}

═══════════════════════════════════════════════════
    `.trim();
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dob: string | Date): number {
    const birthDate = typeof dob === 'string' ? new Date(dob) : dob;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Save preoperative assessment to database
   */
  async saveAssessment(assessment: PreoperativeAssessment): Promise<string> {
    try {
      const id = await db.preoperative_assessments.add(assessment as any);
      return String(id);
    } catch (error) {
      console.error('Error saving assessment:', error);
      throw new Error('Failed to save pre-operative assessment');
    }
  }

  /**
   * Get assessment by patient ID
   */
  async getAssessmentByPatient(patientId: string): Promise<PreoperativeAssessment | null> {
    try {
      const assessment = await db.preoperative_assessments
        .where('patient_id')
        .equals(patientId)
        .first();
      return assessment || null;
    } catch (error) {
      console.error('Error getting assessment:', error);
      return null;
    }
  }

  /**
   * Get assessment by surgery booking ID
   */
  async getAssessmentBySurgery(surgeryId: string): Promise<PreoperativeAssessment | null> {
    try {
      const assessment = await db.preoperative_assessments
        .where('surgery_booking_id')
        .equals(surgeryId)
        .first();
      return assessment || null;
    } catch (error) {
      console.error('Error getting assessment:', error);
      return null;
    }
  }
}

export const preoperativeService = new PreoperativeService();
