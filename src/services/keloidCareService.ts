// Keloid Care Planning Service
import { apiClient } from './apiClient';
import toast from 'react-hot-toast';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface KeloidCarePlan {
  id: number;
  patient_id: number;
  clinical_summary: string;
  keloid_locations: string[];
  problems_concerns: string[];
  comorbidities: string[];
  has_no_comorbidities: boolean;
  risk_factors: string[];
  
  // Pre-op treatment
  preop_triamcinolone_count: number;
  preop_injection_interval_weeks: number;
  
  // Surgery details
  surgery_planned: boolean;
  surgery_date?: string;
  surgery_technique?: string;
  surgery_notes?: string;
  
  // Post-op treatment
  postop_triamcinolone_count: number;
  postop_injection_interval_weeks: number;
  
  // Adjunct therapy
  silicone_sheet_start_date?: string;
  silicone_sheet_duration_months?: number;
  compression_therapy_start_date?: string;
  compression_therapy_duration_months?: number;
  
  // Radiotherapy
  radiotherapy_indicated: boolean;
  radiotherapy_indications: string[];
  radiotherapy_timing?: string;
  radiotherapy_dose?: string;
  radiotherapy_fractions?: number;
  radiotherapy_side_effects: string[];
  radiotherapy_management?: string;
  
  // Status
  status: 'active' | 'completed' | 'discontinued';
  phase: 'pre_treatment' | 'preop_injections' | 'surgery' | 'postop_injections' | 'maintenance' | 'completed';
  compliance_notes?: string;
  
  // Patient info (from join)
  first_name?: string;
  last_name?: string;
  hospital_number?: string;
  date_of_birth?: string;
  gender?: string;
  
  // Audit
  created_by?: number;
  created_by_name?: string;
  created_at?: string;
  updated_at?: string;
  
  // Nested data
  injections?: KeloidInjection[];
  pretreatment_tests?: PretreatmentTest[];
  injection_stats?: {
    preop_completed: number;
    postop_completed: number;
    scheduled_count: number;
  };
}

export interface KeloidInjection {
  id: number;
  keloid_plan_id: number;
  injection_number: number;
  injection_phase: 'preop' | 'postop';
  scheduled_date: string;
  actual_date?: string;
  dose_mg?: number;
  concentration?: string;
  volume_ml?: number;
  injection_site?: string;
  response_notes?: string;
  adverse_effects?: string;
  administered_by?: number;
  administered_by_name?: string;
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface PretreatmentTest {
  id: number;
  keloid_plan_id: number;
  test_type: string;
  test_name: string;
  ordered_date: string;
  result_date?: string;
  result_value?: string;
  result_status: 'pending' | 'completed' | 'abnormal';
  is_within_normal?: boolean;
  notes?: string;
  created_by?: number;
  created_at?: string;
}

// ============================================
// STATIC DATA
// ============================================

export const KELOID_LOCATIONS = [
  'Earlobe',
  'Upper ear (helix)',
  'Chest/Sternum',
  'Shoulder',
  'Upper back',
  'Upper arm',
  'Lower arm',
  'Abdomen',
  'Lower back',
  'Pubic area',
  'Thigh',
  'Knee',
  'Lower leg',
  'Face - Chin',
  'Face - Jawline',
  'Face - Cheek',
  'Neck - Anterior',
  'Neck - Posterior',
  'Other'
];

export const PROBLEMS_CONCERNS = [
  'Cosmetic disfigurement',
  'Pain',
  'Itching/Pruritus',
  'Burning sensation',
  'Tenderness',
  'Ulceration',
  'Bleeding',
  'Infection',
  'Psychological distress',
  'Functional impairment',
  'Progressive growth',
  'Multiple lesions',
  'Recurrence after previous treatment'
];

export const RISK_FACTORS = [
  'Family history of keloids',
  'Dark skin phenotype (Fitzpatrick IV-VI)',
  'Age 10-30 years',
  'History of keloid formation',
  'High-tension wound sites',
  'Wound infection/dehiscence',
  'Excessive wound tension',
  'Foreign body reaction',
  'Burns',
  'Ear piercing',
  'Surgery',
  'Vaccination site',
  'Acne',
  'Folliculitis',
  'Hormonal factors (pregnancy)'
];

export const COMMON_COMORBIDITIES = [
  'Hypertension',
  'Diabetes Mellitus',
  'HIV/AIDS',
  'Hepatitis B',
  'Hepatitis C',
  'Tuberculosis',
  'Chronic kidney disease',
  'Liver disease',
  'Immunosuppression',
  'Bleeding disorders',
  'Connective tissue disorders',
  'Autoimmune conditions',
  'Pregnancy',
  'Lactation'
];

export const REQUIRED_PRETREATMENT_TESTS = [
  { type: 'blood', name: 'Full Blood Count (FBC)', reason: 'Baseline hematological status' },
  { type: 'blood', name: 'Fasting Blood Sugar (FBS)', reason: 'Screen for diabetes/steroid effect monitoring' },
  { type: 'immunology', name: 'Mantoux Test (Tuberculin Skin Test)', reason: 'Screen for latent TB before steroids' },
];

export const PREGNANCY_TEST = {
  type: 'urine',
  name: 'Pregnancy Test (urine β-hCG)',
  reason: 'Rule out pregnancy before triamcinolone (teratogenic risk)'
};

export const SURGERY_TECHNIQUES = [
  'Complete excision with primary closure',
  'Complete excision with flap coverage',
  'Complete excision with skin grafting',
  'Shave excision',
  'Core excision (fillet technique)',
  'Staged excision',
  'Cryosurgery',
  'Laser excision (CO2 laser)',
  'Electrosurgery'
];

export const RADIOTHERAPY_INDICATIONS = [
  'High recurrence risk location (chest, shoulders, back)',
  'Previous keloid recurrence after surgery',
  'Large keloid (>2cm)',
  'Multiple failed treatments',
  'Strong family history of keloids',
  'Patient preference after informed consent'
];

export const RADIOTHERAPY_SIDE_EFFECTS = [
  'Erythema (skin redness)',
  'Hyperpigmentation',
  'Hypopigmentation',
  'Skin dryness',
  'Pruritus',
  'Telangiectasia',
  'Delayed wound healing',
  'Secondary malignancy (theoretical, extremely rare)',
  'Radiation dermatitis'
];

export const RADIOTHERAPY_SIDE_EFFECT_MANAGEMENT = `
MANAGEMENT OF RADIOTHERAPY SIDE EFFECTS:

1. Erythema/Radiation Dermatitis:
   - Apply aloe vera gel or hydrocortisone 1% cream
   - Avoid sun exposure, use SPF 30+ sunscreen
   - Keep area moisturized

2. Hyperpigmentation/Hypopigmentation:
   - Usually temporary, may take 6-12 months to resolve
   - Sun protection is essential
   - Consider topical vitamin C or hydroquinone if persistent

3. Skin Dryness/Pruritus:
   - Regular moisturization with fragrance-free emollients
   - Avoid hot water and harsh soaps
   - Antihistamines if itching is severe

4. Delayed Wound Healing:
   - Close monitoring of surgical wound
   - Maintain moist wound environment
   - Consider hyperbaric oxygen if non-healing

5. General Care:
   - No swimming pools for 2 weeks post-radiation
   - Wear loose, soft clothing over treated area
   - Report any unusual symptoms promptly
`;

// ============================================
// PATIENT EDUCATION CONTENT
// ============================================

export const KELOID_EDUCATION = {
  whatIsKeloid: `
WHAT IS A KELOID?

A keloid is a type of raised scar that grows beyond the boundaries of the original wound. Unlike normal scars that fade over time, keloids continue to grow and can become larger than the original injury.

Key characteristics:
• Raised, firm, rubbery texture
• Often pink, red, or darker than surrounding skin
• May continue to grow for weeks, months, or years
• Can occur months after the initial injury
• May cause itching, pain, or tenderness
• Can recur even after treatment
  `,

  riskFactors: `
RISK FACTORS FOR KELOID FORMATION

You may be at higher risk if you have:

1. Family History: Keloids often run in families
2. Skin Type: More common in people with darker skin (African, Asian, Hispanic descent)
3. Age: Most common between ages 10-30
4. Previous Keloids: If you've had one, you're more likely to develop more
5. Wound Location: Certain areas are more prone (ears, chest, shoulders, upper back)
6. Wound Characteristics: Infected wounds, burns, or wounds under tension
  `,

  treatmentOptions: `
TREATMENT OPTIONS

1. INTRALESIONAL TRIAMCINOLONE (STEROID INJECTIONS)
   - First-line treatment for most keloids
   - Injected directly into the keloid every 3-4 weeks
   - Flattens and softens the keloid
   - May require multiple sessions (4-6 or more)

2. SURGICAL EXCISION
   - Removes the keloid tissue
   - Often combined with other treatments to prevent recurrence
   - Recurrence rate 45-100% if surgery alone

3. SILICONE GEL SHEETS/GEL
   - Applied daily for 12-24 hours
   - Used for at least 3-6 months
   - Helps flatten and soften keloids
   - Can prevent keloid formation after surgery

4. COMPRESSION THERAPY
   - Pressure earrings for ear keloids
   - Compression garments for body keloids
   - Used 12-24 hours daily for months

5. RADIOTHERAPY (for select cases)
   - Low-dose radiation after surgical excision
   - Reserved for high-risk or recurrent keloids
   - Given within 24-72 hours of surgery
  `,

  multimodalityApproach: `
WHY MULTI-MODALITY TREATMENT?

Keloids are challenging to treat because of their high recurrence rate. Studies show:

• Surgery alone: 45-100% recurrence
• Surgery + Steroid injections: 25-50% recurrence
• Surgery + Radiotherapy: 10-30% recurrence
• Surgery + Steroids + Silicone + Compression: Best outcomes

The multi-modality approach combines:
1. Pre-operative steroid injections to soften the keloid
2. Surgical excision with meticulous technique
3. Post-operative steroid injections to prevent regrowth
4. Silicone therapy for scar maturation
5. Compression therapy where applicable
6. Radiotherapy for high-risk cases

This comprehensive approach gives you the best chance of long-term success.
  `,

  compliance: `
IMPORTANCE OF TREATMENT COMPLIANCE

Keloid treatment requires PATIENCE and CONSISTENCY:

✓ INJECTION SCHEDULE: Attend every scheduled injection appointment
  - Missing injections can allow the keloid to regrow
  - Full course is typically 4-6+ sessions pre-op and post-op

✓ SILICONE THERAPY: Use daily as directed
  - Must be worn 12-24 hours daily
  - Continue for 3-6 months minimum

✓ COMPRESSION: Consistent wear is essential
  - Pressure earrings: 12-24 hours daily
  - Compression garments: As prescribed

✓ FOLLOW-UP APPOINTMENTS: Never miss scheduled reviews
  - Early detection of recurrence
  - Adjustment of treatment plan

✓ SUN PROTECTION: Protect treated areas
  - Use SPF 30+ sunscreen
  - Avoid direct sun exposure

REMEMBER: Treatment success depends largely on your commitment to the full treatment plan. Incomplete treatment significantly increases recurrence risk.
  `
};

// ============================================
// SERVICE FUNCTIONS
// ============================================

class KeloidCareService {
  private baseUrl = '/api/keloid-care';

  // Get all keloid care plans
  async getAllPlans(filters?: { patientId?: number; status?: string }): Promise<KeloidCarePlan[]> {
    try {
      const params = new URLSearchParams();
      if (filters?.patientId) params.append('patientId', filters.patientId.toString());
      if (filters?.status) params.append('status', filters.status);

      const response = await apiClient.get(`${this.baseUrl}?${params.toString()}`);
      return response.keloidPlans || [];
    } catch (error) {
      console.error('Error fetching keloid care plans:', error);
      throw error;
    }
  }

  // Get a single plan with all details
  async getPlan(id: number): Promise<KeloidCarePlan | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${id}`);
      return response.keloidPlan || null;
    } catch (error) {
      console.error('Error fetching keloid care plan:', error);
      throw error;
    }
  }

  // Create a new keloid care plan
  async createPlan(data: Partial<KeloidCarePlan>): Promise<KeloidCarePlan> {
    try {
      const response = await apiClient.post(this.baseUrl, this.transformToApiFormat(data));
      toast.success('Keloid care plan created successfully');
      return response.keloidPlan;
    } catch (error) {
      console.error('Error creating keloid care plan:', error);
      toast.error('Failed to create keloid care plan');
      throw error;
    }
  }

  // Update an existing plan
  async updatePlan(id: number, data: Partial<KeloidCarePlan>): Promise<KeloidCarePlan> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/${id}`, this.transformToApiFormat(data));
      toast.success('Keloid care plan updated');
      return response.keloidPlan;
    } catch (error) {
      console.error('Error updating keloid care plan:', error);
      toast.error('Failed to update plan');
      throw error;
    }
  }

  // Delete a plan
  async deletePlan(id: number): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/${id}`);
      toast.success('Keloid care plan deleted');
    } catch (error) {
      console.error('Error deleting keloid care plan:', error);
      toast.error('Failed to delete plan');
      throw error;
    }
  }

  // Get injections for a plan
  async getInjections(planId: number): Promise<KeloidInjection[]> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/${planId}/injections`);
      return response.injections || [];
    } catch (error) {
      console.error('Error fetching injections:', error);
      throw error;
    }
  }

  // Record an injection
  async recordInjection(planId: number, injectionId: number, data: Partial<KeloidInjection>): Promise<KeloidInjection> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/${planId}/injections/${injectionId}`, {
        actualDate: data.actual_date,
        doseMg: data.dose_mg,
        concentration: data.concentration,
        volumeMl: data.volume_ml,
        injectionSite: data.injection_site,
        responseNotes: data.response_notes,
        adverseEffects: data.adverse_effects,
        status: 'completed'
      });
      toast.success('Injection recorded successfully');
      return response.injection;
    } catch (error) {
      console.error('Error recording injection:', error);
      toast.error('Failed to record injection');
      throw error;
    }
  }

  // Add a pre-treatment test
  async addPretreatmentTest(planId: number, data: Partial<PretreatmentTest>): Promise<PretreatmentTest> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/${planId}/tests`, {
        testType: data.test_type,
        testName: data.test_name,
        orderedDate: data.ordered_date,
        resultDate: data.result_date,
        resultValue: data.result_value,
        resultStatus: data.result_status,
        isWithinNormal: data.is_within_normal,
        notes: data.notes
      });
      toast.success('Test ordered successfully');
      return response.test;
    } catch (error) {
      console.error('Error adding test:', error);
      toast.error('Failed to order test');
      throw error;
    }
  }

  // Update test result
  async updateTestResult(planId: number, testId: number, data: Partial<PretreatmentTest>): Promise<PretreatmentTest> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/${planId}/tests/${testId}`, {
        resultDate: data.result_date,
        resultValue: data.result_value,
        resultStatus: data.result_status,
        isWithinNormal: data.is_within_normal,
        notes: data.notes
      });
      toast.success('Test result updated');
      return response.test;
    } catch (error) {
      console.error('Error updating test:', error);
      toast.error('Failed to update test result');
      throw error;
    }
  }

  // Transform frontend format to API format
  private transformToApiFormat(data: Partial<KeloidCarePlan>): Record<string, any> {
    return {
      patientId: data.patient_id,
      clinicalSummary: data.clinical_summary,
      keloidLocations: data.keloid_locations,
      problemsConcerns: data.problems_concerns,
      comorbidities: data.comorbidities,
      hasNoComorbidities: data.has_no_comorbidities,
      riskFactors: data.risk_factors,
      preopTriamcinoloneCount: data.preop_triamcinolone_count,
      preopInjectionIntervalWeeks: data.preop_injection_interval_weeks,
      surgeryPlanned: data.surgery_planned,
      surgeryDate: data.surgery_date,
      surgeryTechnique: data.surgery_technique,
      surgeryNotes: data.surgery_notes,
      postopTriamcinoloneCount: data.postop_triamcinolone_count,
      postopInjectionIntervalWeeks: data.postop_injection_interval_weeks,
      siliconeSheetStartDate: data.silicone_sheet_start_date,
      siliconeSheetDurationMonths: data.silicone_sheet_duration_months,
      compressionTherapyStartDate: data.compression_therapy_start_date,
      compressionTherapyDurationMonths: data.compression_therapy_duration_months,
      radiotherapyIndicated: data.radiotherapy_indicated,
      radiotherapyIndications: data.radiotherapy_indications,
      radiotherapyTiming: data.radiotherapy_timing,
      radiotherapyDose: data.radiotherapy_dose,
      radiotherapyFractions: data.radiotherapy_fractions,
      radiotherapySideEffects: data.radiotherapy_side_effects,
      radiotherapyManagement: data.radiotherapy_management,
      status: data.status,
      phase: data.phase,
      complianceNotes: data.compliance_notes
    };
  }

  // Check if patient needs pregnancy test
  isPregnancyTestRequired(patientGender: string, patientDob: string): boolean {
    if (patientGender?.toLowerCase() !== 'female') return false;
    
    const dob = new Date(patientDob);
    const today = new Date();
    const age = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    
    // Reproductive age: typically 12-50 years
    return age >= 12 && age <= 50;
  }

  // Get all required tests for a patient
  getRequiredTests(patientGender: string, patientDob: string): typeof REQUIRED_PRETREATMENT_TESTS {
    const tests = [...REQUIRED_PRETREATMENT_TESTS];
    
    if (this.isPregnancyTestRequired(patientGender, patientDob)) {
      tests.push(PREGNANCY_TEST);
    }
    
    return tests;
  }

  // Calculate next injection date
  calculateNextInjectionDate(lastDate: Date, intervalWeeks: number): Date {
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + (intervalWeeks * 7));
    return nextDate;
  }

  // Check if all required tests are complete and normal
  arePretreatmentTestsComplete(tests: PretreatmentTest[]): { complete: boolean; issues: string[] } {
    const issues: string[] = [];
    const requiredTestNames = REQUIRED_PRETREATMENT_TESTS.map(t => t.name);
    
    for (const testName of requiredTestNames) {
      const test = tests.find(t => t.test_name === testName);
      if (!test) {
        issues.push(`${testName} not ordered`);
      } else if (test.result_status === 'pending') {
        issues.push(`${testName} result pending`);
      } else if (!test.is_within_normal) {
        issues.push(`${testName} result abnormal - review required`);
      }
    }
    
    return { complete: issues.length === 0, issues };
  }

  // Get treatment phase label
  getPhaseLabel(phase: string): string {
    const labels: Record<string, string> = {
      'pre_treatment': 'Pre-Treatment Assessment',
      'preop_injections': 'Pre-Operative Injections',
      'surgery': 'Awaiting/Post Surgery',
      'postop_injections': 'Post-Operative Injections',
      'maintenance': 'Maintenance Therapy',
      'completed': 'Treatment Completed'
    };
    return labels[phase] || phase;
  }

  // Generate PDF content for sharing
  generatePlanSummary(plan: KeloidCarePlan): string {
    const patientName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim();
    
    let summary = `
KELOID TREATMENT PLAN
=====================

Patient: ${patientName}
Hospital Number: ${plan.hospital_number || 'N/A'}
Date: ${new Date().toLocaleDateString()}

CLINICAL SUMMARY
----------------
${plan.clinical_summary || 'Not specified'}

KELOID LOCATION(S)
------------------
${plan.keloid_locations?.join(', ') || 'Not specified'}

IDENTIFIED PROBLEMS & CONCERNS
------------------------------
${plan.problems_concerns?.join(', ') || 'Not specified'}

COMORBIDITIES
-------------
${plan.has_no_comorbidities ? 'None' : (plan.comorbidities?.join(', ') || 'Not specified')}

RISK FACTORS
------------
${plan.risk_factors?.join(', ') || 'Not specified'}

TREATMENT PLAN
==============

PRE-OPERATIVE PHASE
-------------------
• Intralesional Triamcinolone: ${plan.preop_triamcinolone_count || 0} sessions
• Injection Interval: Every ${plan.preop_injection_interval_weeks || 3} weeks

SURGERY
-------
• Surgery Planned: ${plan.surgery_planned ? 'Yes' : 'No'}
${plan.surgery_planned ? `• Scheduled Date: ${plan.surgery_date || 'TBD'}
• Technique: ${plan.surgery_technique || 'TBD'}
• Notes: ${plan.surgery_notes || 'None'}` : ''}

POST-OPERATIVE PHASE
--------------------
• Intralesional Triamcinolone: ${plan.postop_triamcinolone_count || 0} sessions
• Injection Interval: Every ${plan.postop_injection_interval_weeks || 3} weeks

ADJUNCT THERAPY
---------------
• Silicone Sheet: ${plan.silicone_sheet_start_date ? `Starting ${plan.silicone_sheet_start_date}, Duration: ${plan.silicone_sheet_duration_months || '?'} months` : 'Not planned'}
• Compression Therapy: ${plan.compression_therapy_start_date ? `Starting ${plan.compression_therapy_start_date}, Duration: ${plan.compression_therapy_duration_months || '?'} months` : 'Not planned'}
`;

    if (plan.radiotherapy_indicated) {
      summary += `
RADIOTHERAPY
------------
• Indications: ${plan.radiotherapy_indications?.join(', ') || 'See notes'}
• Timing: ${plan.radiotherapy_timing || 'Within 24-72 hours post-surgery'}
• Dose: ${plan.radiotherapy_dose || 'As per oncology protocol'}
• Fractions: ${plan.radiotherapy_fractions || 'TBD'}

Potential Side Effects:
${plan.radiotherapy_side_effects?.map(se => `• ${se}`).join('\n') || 'See patient education materials'}

Management:
${plan.radiotherapy_management || RADIOTHERAPY_SIDE_EFFECT_MANAGEMENT}
`;
    }

    summary += `

IMPORTANT NOTES
===============
• Treatment success depends on STRICT compliance with all appointments
• Do not miss any scheduled injection appointments
• Use silicone sheets as directed (12-24 hours daily)
• Protect treated areas from sun exposure
• Report any concerning symptoms immediately

Current Phase: ${this.getPhaseLabel(plan.phase)}
Plan Status: ${plan.status}
Created: ${plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'N/A'}
Created By: ${plan.created_by_name || 'N/A'}
`;

    return summary;
  }
}

export const keloidCareService = new KeloidCareService();
