// Comprehensive Surgical Procedure Management Service
export interface WHOSafetyChecklist {
  id: string;
  procedure_id: string;
  phase: 'sign_in' | 'time_out' | 'sign_out';
  
  // Sign In (Before induction of anaesthesia)
  sign_in?: {
    patient_identity_confirmed: boolean;
    site_marked: boolean;
    anaesthesia_safety_check_completed: boolean;
    pulse_oximeter_on_patient: boolean;
    known_allergies: string[];
    difficult_airway_aspiration_risk: boolean;
    blood_loss_risk_500ml: boolean;
    checked_by: string;
    checked_at: Date;
  };
  
  // Time Out (Before skin incision)
  time_out?: {
    team_members_introduced: boolean;
    surgeon_confirms: {
      patient_name: string;
      procedure: string;
      incision_site: string;
    };
    anaesthetist_confirms_concerns: boolean;
    nursing_confirms: {
      sterility_confirmed: boolean;
      equipment_issues: string[];
    };
    antibiotic_prophylaxis_given: boolean;
    essential_imaging_displayed: boolean;
    checked_by: string;
    checked_at: Date;
  };
  
  // Sign Out (Before patient leaves operating room)
  sign_out?: {
    procedure_recorded: string;
    instrument_sponge_needle_count_correct: boolean;
    specimen_labeled: boolean;
    equipment_problems: string[];
    surgeon_anesthetist_nurse_review: {
      key_concerns_for_recovery: string[];
    };
    checked_by: string;
    checked_at: Date;
  };
  
  completed_phases: ('sign_in' | 'time_out' | 'sign_out')[];
  overall_completion: boolean;
}

export interface PreoperativeAssessment {
  id: string;
  patient_id: string;
  procedure_id: string;
  
  // Patient Assessment
  medical_history: {
    cardiovascular: string[];
    respiratory: string[];
    endocrine: string[];
    renal: string[];
    hepatic: string[];
    neurological: string[];
    hematological: string[];
    other: string[];
  };
  
  current_medications: {
    name: string;
    dosage: string;
    frequency: string;
    last_taken: Date;
    continue_perioperatively: boolean;
  }[];
  
  allergies: {
    allergen: string;
    reaction: string;
    severity: 'mild' | 'moderate' | 'severe';
  }[];
  
  // Physical Examination
  vital_signs: {
    blood_pressure: string;
    heart_rate: number;
    respiratory_rate: number;
    temperature: number;
    oxygen_saturation: number;
    weight: number;
    height: number;
    bmi: number;
  };
  
  cardiovascular_exam: {
    heart_sounds: string;
    murmurs: boolean;
    peripheral_pulses: string;
    edema: boolean;
    findings: string;
  };
  
  respiratory_exam: {
    chest_expansion: string;
    breath_sounds: string;
    findings: string;
  };
  
  // Laboratory Results
  laboratory_results: {
    hemoglobin: number;
    hematocrit: number;
    white_cell_count: number;
    platelet_count: number;
    pt_inr: number;
    aptt: number;
    creatinine: number;
    urea: number;
    sodium: number;
    potassium: number;
    glucose: number;
    other_tests: { name: string; value: string; unit: string }[];
  };
  
  // Risk Assessment
  asa_classification: 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI';
  surgical_risk_score: number; // 0-100
  anesthetic_risk_factors: string[];
  
  // Clearances
  clearances: {
    cardiology: { required: boolean; obtained: boolean; date?: Date; notes?: string };
    pulmonology: { required: boolean; obtained: boolean; date?: Date; notes?: string };
    endocrinology: { required: boolean; obtained: boolean; date?: Date; notes?: string };
    other: { specialty: string; required: boolean; obtained: boolean; date?: Date; notes?: string }[];
  };
  
  // Assessment Summary
  fitness_for_surgery: 'fit' | 'fit_with_optimization' | 'high_risk' | 'unfit';
  recommendations: string[];
  assessed_by: string;
  assessment_date: Date;
}

export interface WoundCareAssessment {
  id: string;
  patient_id: string;
  procedure_id: string;
  
  // Wound Details
  wound_location: string;
  wound_type: 'surgical' | 'traumatic' | 'pressure' | 'diabetic' | 'venous' | 'arterial' | 'other';
  wound_nature?: 'acute' | 'chronic'; // New field for wound nature
  wound_classification?: 'clean' | 'clean_contaminated' | 'contaminated' | 'dirty'; // Only for acute wounds
  
  // Wound Measurements
  dimensions: {
    length: number;
    width: number;
    depth: number;
    area: number; // calculated
    volume?: number; // if applicable
    measurement_method?: 'manual' | 'ai_segmentation'; // Track how measurement was done
    ai_confidence_score?: number; // Confidence level for AI measurements
    wound_photo?: string; // Base64 encoded photo for AI analysis
  };
  
  // Wound dimension tracking over time
  dimension_history?: {
    date: string;
    length: number;
    width: number;
    depth: number;
    area: number;
    measurement_method: 'manual' | 'ai_segmentation';
    photo?: string;
    notes?: string;
  }[];
  
  // Wound Characteristics
  appearance: {
    tissue_type: ('granulation' | 'necrotic' | 'slough' | 'eschar' | 'epithelial')[];
    exudate_amount: 'none' | 'minimal' | 'moderate' | 'heavy';
    exudate_type: 'serous' | 'serosanguinous' | 'sanguinous' | 'purulent';
    odor: 'none' | 'mild' | 'moderate' | 'strong';
    surrounding_skin: 'normal' | 'erythema' | 'maceration' | 'induration' | 'other';
  };
  
  // Wound Healing Progress - Extended for chronic wounds
  healing_stage?: 'inflammatory' | 'proliferative' | 'maturation' | 'acute_wound' | 'extension_wound' | 'transition_wound' | 'repair_wound' | 'indolent_wound';
  signs_of_infection: {
    present: boolean;
    signs: ('erythema' | 'warmth' | 'swelling' | 'pain' | 'purulent_drainage' | 'fever')[];
    cultures_taken: boolean;
    culture_results?: string;
  };
  
  // Pain Assessment
  pain_score: number; // 0-10 scale
  pain_characteristics: string[];
  
  // Treatment Plan
  dressing_type: string;
  dressing_change_frequency: string;
  topical_treatments: string[];
  systemic_treatments: string[];
  
  // Progress Notes
  progress_notes: string;
  healing_rate: 'excellent' | 'good' | 'fair' | 'poor';
  expected_healing_time: string;
  
  assessed_by: string;
  assessment_date: Date;
  next_assessment_due: Date;
}

export interface IntraoperativeFindings {
  id: string;
  procedure_id: string;
  patient_id: string;
  
  // Procedure Details
  procedure_performed: string;
  surgeon_primary: string;
  surgeon_assistant?: string;
  anesthetist: string;
  scrub_nurse: string;
  circulating_nurse: string;
  
  // Timing
  start_time: Date;
  end_time: Date;
  duration_minutes: number;
  anesthesia_start: Date;
  anesthesia_end: Date;
  
  // Anesthesia Details
  anesthesia_type: 'general' | 'regional' | 'local' | 'sedation' | 'combined';
  anesthesia_agents: string[];
  intubation_details?: {
    intubation_attempted: boolean;
    successful: boolean;
    attempts: number;
    blade_used: string;
    tube_size: string;
    complications: string[];
  };
  
  // Surgical Findings
  incision_details: {
    approach: string;
    length: string;
    layers_involved: string[];
  };
  
  operative_findings: {
    normal_findings: string[];
    abnormal_findings: string[];
    pathology_description: string;
    anatomical_variants: string[];
  };
  
  // Procedure Steps
  procedure_steps: {
    step_number: number;
    description: string;
    duration_minutes?: number;
    complications?: string[];
    modifications?: string;
  }[];
  
  // Materials Used
  implants_used: {
    type: string;
    brand: string;
    size: string;
    serial_number?: string;
    lot_number?: string;
  }[];
  
  sutures_used: {
    type: string;
    size: string;
    location: string;
    technique: string;
  }[];
  
  // Hemostasis and Blood Loss
  estimated_blood_loss: number; // in ml
  transfusion_required: boolean;
  transfusion_details?: {
    product_type: string;
    units: number;
    indications: string;
  };
  
  hemostasis_method: string[];
  drains_placed: {
    type: string;
    location: string;
    size: string;
    purpose: string;
  }[];
  
  // Complications
  intraoperative_complications: {
    occurred: boolean;
    complications: {
      type: string;
      severity: 'minor' | 'moderate' | 'major';
      management: string;
      outcome: string;
    }[];
  };
  
  // Specimens
  specimens_sent: {
    type: string;
    location: string;
    container: string;
    pathology_requested: string[];
  }[];
  
  // Intraoperative Photographs
  intraoperative_photos?: {
    filename: string;
    data: string; // base64 encoded image
    timestamp: string;
    size: number;
    type: string;
    description?: string;
  }[];
  
  // Final Status
  procedure_completion: 'completed_as_planned' | 'modified' | 'converted' | 'abandoned';
  patient_condition_at_end: 'stable' | 'unstable' | 'critical';
  
  surgeon_notes: string;
  recorded_by: string;
  recorded_at: Date;
}

export interface PostoperativeCare {
  id: string;
  patient_id: string;
  procedure_id: string;
  
  // Immediate Postoperative (PACU)
  pacu_assessment: {
    admission_time: Date;
    discharge_time?: Date;
    aldrete_score: number; // 0-10 recovery score
    
    vital_signs_on_admission: {
      blood_pressure: string;
      heart_rate: number;
      respiratory_rate: number;
      oxygen_saturation: number;
      temperature: number;
      consciousness_level: string;
    };
    
    pain_scores: {
      time: Date;
      score: number; // 0-10
      pain_location: string;
      intervention: string;
    }[];
    
    nausea_vomiting: {
      present: boolean;
      severity: 'mild' | 'moderate' | 'severe';
      intervention: string;
    };
    
    complications: string[];
    discharge_criteria_met: boolean;
  };
  
  // Ward Care Plan
  care_plan: {
    monitoring_frequency: {
      vital_signs: string; // e.g., "q4h x 24h"
      neurological: string;
      wound_checks: string;
      drain_output: string;
    };
    
    activity_restrictions: {
      bed_rest_duration: string;
      mobility_progression: string;
      weight_bearing_restrictions: string;
      lifting_restrictions: string;
    };
    
    diet_progression: {
      npo_duration: string;
      clear_liquids: string;
      regular_diet: string;
      special_diet_requirements: string[];
    };
    
    medications: {
      name: string;
      dosage: string;
      route: string;
      frequency: string;
      indication: string;
      duration: string;
      special_instructions: string;
    }[];
    
    iv_therapy: {
      fluid_type: string;
      rate: string;
      duration: string;
      monitoring_requirements: string[];
    };
    
    wound_care: {
      dressing_type: string;
      change_frequency: string;
      wound_monitoring: string[];
      drain_care: string[];
    };
  };
  
  // Daily Progress Tracking
  daily_assessments: {
    date: Date;
    post_op_day: number;
    
    vital_signs: {
      temperature_max: number;
      blood_pressure_range: string;
      heart_rate_range: string;
      respiratory_rate: number;
      oxygen_saturation: number;
    };
    
    pain_assessment: {
      pain_score_range: string;
      pain_location: string[];
      analgesic_effectiveness: 'excellent' | 'good' | 'fair' | 'poor';
    };
    
    wound_assessment: {
      appearance: string;
      drainage: string;
      signs_of_infection: boolean;
      healing_progress: 'excellent' | 'good' | 'fair' | 'poor';
    };
    
    functional_status: {
      mobility_level: string;
      self_care_ability: string;
      cognitive_status: string;
    };
    
    complications: {
      new_complications: string[];
      ongoing_complications: string[];
      interventions: string[];
    };
    
    plan_for_next_24h: string[];
    assessed_by: string;
  }[];
  
  // Discharge Planning
  discharge_planning: {
    expected_discharge_date: Date;
    discharge_criteria: {
      criterion: string;
      met: boolean;
      notes: string;
    }[];
    
    home_care_instructions: {
      wound_care: string[];
      activity_restrictions: string[];
      medication_management: string[];
      when_to_call_doctor: string[];
    };
    
    follow_up_appointments: {
      provider: string;
      timeframe: string;
      purpose: string;
      scheduled: boolean;
    }[];
  };
  
  created_by: string;
  created_at: Date;
  last_updated: Date;
}

export interface SurgicalFitnessScore {
  id: string;
  patient_id: string;
  assessment_date: Date;
  
  // Demographics (5 points)
  age_score: number; // 0-2 (≤60: 0, 61-70: 1, >70: 2)
  
  // Cardiovascular (25 points)
  cardiac_risk: {
    functional_capacity: number; // 0-5 (>7 METs: 0, 4-7: 2, <4: 5)
    cardiac_conditions: number; // 0-10 (None: 0, Stable CAD: 3, Recent MI: 10)
    heart_failure: number; // 0-5 (None: 0, Compensated: 2, Decompensated: 5)
    arrhythmias: number; // 0-5 (None: 0, Controlled: 2, Uncontrolled: 5)
  };
  
  // Respiratory (20 points)
  respiratory_risk: {
    smoking_status: number; // 0-3 (Never: 0, Former >8wks: 1, Current: 3)
    copd_severity: number; // 0-7 (None: 0, Mild: 2, Moderate: 4, Severe: 7)
    oxygen_dependence: number; // 0-5 (No: 0, Intermittent: 3, Continuous: 5)
    recent_respiratory_infection: number; // 0-5 (No: 0, >4wks ago: 2, <4wks: 5)
  };
  
  // Renal Function (15 points)
  renal_risk: {
    creatinine_level: number; // 0-5 (<1.5: 0, 1.5-3.0: 3, >3.0: 5)
    dialysis_dependence: number; // 0-10 (No: 0, Peritoneal: 5, Hemodialysis: 10)
  };
  
  // Hepatic Function (10 points)
  hepatic_risk: {
    liver_disease: number; // 0-10 (None: 0, Compensated: 3, Child B: 7, Child C: 10)
  };
  
  // Neurological (10 points)
  neurological_risk: {
    cognitive_impairment: number; // 0-5 (None: 0, Mild: 2, Moderate-Severe: 5)
    stroke_history: number; // 0-5 (No: 0, >6months: 2, <6months: 5)
  };
  
  // Metabolic (10 points)
  metabolic_risk: {
    diabetes_control: number; // 0-5 (No DM: 0, Controlled: 2, Uncontrolled: 5)
    nutritional_status: number; // 0-5 (Normal: 0, Mild malnutrition: 2, Severe: 5)
  };
  
  // Hematological (5 points)
  hematological_risk: {
    bleeding_disorders: number; // 0-5 (None: 0, Mild: 2, Severe: 5)
  };
  
  // Calculate total score (out of 100)
  total_score: number;
  risk_category: 'low' | 'moderate' | 'high' | 'very_high'; // <25, 25-49, 50-74, ≥75
  
  // Recommendations
  recommendations: {
    preoperative_optimization: string[];
    monitoring_requirements: string[];
    postoperative_considerations: string[];
  };
  
  assessed_by: string;
  notes: string;
}

class ProcedureManagementService {
  
  /**
   * Calculate Surgical Fitness Score
   */
  calculateSurgicalFitnessScore(assessment: Omit<SurgicalFitnessScore, 'total_score' | 'risk_category'>): SurgicalFitnessScore {
    const total = 
      assessment.age_score +
      assessment.cardiac_risk.functional_capacity +
      assessment.cardiac_risk.cardiac_conditions +
      assessment.cardiac_risk.heart_failure +
      assessment.cardiac_risk.arrhythmias +
      assessment.respiratory_risk.smoking_status +
      assessment.respiratory_risk.copd_severity +
      assessment.respiratory_risk.oxygen_dependence +
      assessment.respiratory_risk.recent_respiratory_infection +
      assessment.renal_risk.creatinine_level +
      assessment.renal_risk.dialysis_dependence +
      assessment.hepatic_risk.liver_disease +
      assessment.neurological_risk.cognitive_impairment +
      assessment.neurological_risk.stroke_history +
      assessment.metabolic_risk.diabetes_control +
      assessment.metabolic_risk.nutritional_status +
      assessment.hematological_risk.bleeding_disorders;

    let risk_category: 'low' | 'moderate' | 'high' | 'very_high';
    if (total < 25) risk_category = 'low';
    else if (total < 50) risk_category = 'moderate';
    else if (total < 75) risk_category = 'high';
    else risk_category = 'very_high';

    return {
      ...assessment,
      total_score: total,
      risk_category
    };
  }

  /**
   * Generate WHO Safety Checklist Template
   */
  generateWHOChecklist(procedureId: string): WHOSafetyChecklist {
    return {
      id: this.generateId(),
      procedure_id: procedureId,
      phase: 'sign_in',
      completed_phases: [],
      overall_completion: false
    };
  }

  /**
   * Validate WHO Checklist Completion
   */
  validateWHOChecklistCompletion(checklist: WHOSafetyChecklist): boolean {
    return checklist.completed_phases.length === 3 &&
           checklist.completed_phases.includes('sign_in') &&
           checklist.completed_phases.includes('time_out') &&
           checklist.completed_phases.includes('sign_out');
  }

  /**
   * Calculate Wound Healing Score
   */
  calculateWoundHealingScore(assessment: WoundCareAssessment): number {
    let score = 0;
    
    // Size reduction (30 points)
    // This would compare with previous measurements
    
    // Tissue quality (25 points)
    if (assessment.appearance.tissue_type.includes('granulation')) score += 15;
    if (assessment.appearance.tissue_type.includes('epithelial')) score += 10;
    if (assessment.appearance.tissue_type.includes('necrotic')) score -= 10;
    
    // Exudate management (20 points)
    switch (assessment.appearance.exudate_amount) {
      case 'none': score += 20; break;
      case 'minimal': score += 15; break;
      case 'moderate': score += 10; break;
      case 'heavy': score += 5; break;
    }
    
    // Infection control (15 points)
    if (!assessment.signs_of_infection.present) score += 15;
    
    // Pain management (10 points)
    if (assessment.pain_score <= 3) score += 10;
    else if (assessment.pain_score <= 6) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate Aldrete Score for PACU
   */
  calculateAldreteScore(vitals: any, consciousness: string, movement: string, respiration: string, circulation: string): number {
    let score = 0;
    
    // Activity (0-2)
    if (movement === 'moves_all_extremities') score += 2;
    else if (movement === 'moves_some_extremities') score += 1;
    
    // Respiration (0-2)
    if (respiration === 'breathes_deeply_coughs') score += 2;
    else if (respiration === 'dyspnea_limited_breathing') score += 1;
    
    // Circulation (0-2)
    // BP ±20% of baseline
    score += 2; // This would be calculated based on actual BP values
    
    // Consciousness (0-2)
    if (consciousness === 'fully_awake') score += 2;
    else if (consciousness === 'arousable_on_calling') score += 1;
    
    // Oxygen Saturation (0-2)
    if (vitals.oxygen_saturation >= 92) score += 2;
    else if (vitals.oxygen_saturation >= 90) score += 1;
    
    return score;
  }

  async createIntraoperativeFindings(findings: IntraoperativeFindings): Promise<string> {
    const id = findings.id || this.generateId();
    return id;
  }

  async createPostoperativeCare(care: PostoperativeCare): Promise<string> {
    const id = care.id || this.generateId();
    return id;
  }

  async createPreoperativeAssessment(assessment: PreoperativeAssessment): Promise<string> {
    const id = assessment.id || this.generateId();
    return id;
  }

  async createSurgicalFitnessScore(score: SurgicalFitnessScore): Promise<string> {
    const id = score.id || this.generateId();
    return id;
  }

  async createWHOSafetyChecklist(checklist: WHOSafetyChecklist): Promise<string> {
    const id = checklist.id || this.generateId();
    return id;
  }

  async createWoundCareAssessment(assessment: WoundCareAssessment): Promise<string> {
    const id = assessment.id || this.generateId();
    return id;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const procedureService = new ProcedureManagementService();