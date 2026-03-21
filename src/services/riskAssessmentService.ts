import { aiService } from './aiService';
import { db } from '../db/database';
import { apiClient } from './apiClient';
import { syncService } from '../db/syncService';

// Base interfaces for risk assessments
export interface BaseRiskAssessment {
  id: string;
  patient_id: string;
  assessment_date: Date;
  assessed_by: string;
  score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'very_high';
  ai_recommendations: string[];
  action_plan: ActionPlanItem[];
  next_assessment_due?: Date;
  status: 'active' | 'completed' | 'superseded';
  created_at: Date;
  updated_at: Date;
}

export interface ActionPlanItem {
  id: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  assigned_to: string;
  due_date?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  completed_date?: Date;
  notes?: string;
}

// DVT Risk Assessment (Caprini Score for Adults / UK Guidelines for Pediatrics)
export interface DVTRiskAssessment extends BaseRiskAssessment {
  assessment_type: 'dvt';
  assessment_mode?: 'adult' | 'pediatric'; // auto-detected from patient DOB
  patient_dob?: string; // stored for reference
  risk_factors: {
    // 1 Point Risk Factors (Adult Caprini)
    age_41_60: boolean;
    minor_surgery: boolean;
    bmi_over_25: boolean;
    swollen_legs: boolean;
    varicose_veins: boolean;
    pregnancy_postpartum: boolean;
    oral_contraceptives: boolean;
    sepsis_1month: boolean;
    serious_lung_disease: boolean;
    abnormal_pulmonary: boolean;
    acute_mi: boolean;
    chf_1month: boolean;
    inflammatory_bowel: boolean;
    medical_patient_bedrest: boolean;
    
    // 2 Point Risk Factors
    age_61_74: boolean;
    arthroscopic_surgery: boolean;
    malignancy: boolean;
    major_surgery_45min: boolean;
    laparoscopic_45min: boolean;
    patient_confined_bed: boolean;
    immobilizing_cast: boolean;
    central_venous_access: boolean;
    
    // 3 Point Risk Factors
    age_over_75: boolean;
    personal_history_vte: boolean;
    family_history_vte: boolean;
    factor_v_leiden: boolean;
    prothrombin_mutation: boolean;
    elevated_homocysteine: boolean;
    lupus_anticoagulant: boolean;
    anticardiolipin_antibodies: boolean;
    heparin_thrombocytopenia: boolean;
    other_thrombophilia: boolean;
    
    // 5 Point Risk Factors
    stroke_1month: boolean;
    elective_arthroplasty: boolean;
    hip_pelvis_fracture: boolean;
    acute_spinal_injury: boolean;

    // Pediatric Risk Factors (UK NICE / RCPCH VTE Guidelines)
    ped_age_over_13?: boolean;
    ped_central_venous_catheter?: boolean;
    ped_immobility_reduced_mobility?: boolean;
    ped_previous_vte?: boolean;
    ped_family_history_vte?: boolean;
    ped_active_malignancy?: boolean;
    ped_chemotherapy?: boolean;
    ped_significant_surgery?: boolean;
    ped_lower_limb_surgery?: boolean;
    ped_obesity?: boolean;
    ped_dehydration?: boolean;
    ped_acute_infection_sepsis?: boolean;
    ped_inflammatory_condition?: boolean;
    ped_nephrotic_syndrome?: boolean;
    ped_sickle_cell_disease?: boolean;
    ped_congenital_heart_disease?: boolean;
    ped_inherited_thrombophilia?: boolean;
    ped_oral_contraceptives?: boolean;
    ped_prolonged_travel?: boolean;
    ped_burns?: boolean;
    ped_trauma?: boolean;
    ped_critical_care_admission?: boolean;
  };
  clinical_signs: {
    localized_tenderness: boolean;
    swelling: boolean;
    calf_difference: boolean;
    pitting_edema: boolean;
    collateral_veins: boolean;
    warmth: boolean;
    erythema: boolean;
  };
  prevention_measures: {
    mechanical_prophylaxis: boolean;
    pharmacological_prophylaxis: boolean;
    early_mobilization: boolean;
    hydration: boolean;
    compression_stockings: boolean;
    sequential_compression_device: boolean;
  };
  // Auto-generated prophylaxis recommendation
  prophylaxis_recommendation?: DVTProphylaxisRecommendation;
}

// Prophylaxis Recommendation (auto-generated and saved)
export interface DVTProphylaxisRecommendation {
  id: string;
  assessment_id: string;
  patient_id: string;
  mode: 'adult' | 'pediatric';
  score: number;
  risk_level: string;
  guideline_used: string; // 'Caprini Score (2005)' or 'NICE/RCPCH UK Pediatric VTE Guidelines'
  pharmacological: {
    recommended: boolean;
    drug: string;
    dose: string;
    frequency: string;
    duration: string;
    notes: string;
  };
  mechanical: {
    recommended: boolean;
    measures: string[];
  };
  monitoring: string[];
  contraindication_check: string[];
  special_considerations: string[];
  generated_at: Date;
  generated_by: string;
}

// Pressure Sore Risk Assessment (Braden Scale)
export interface PressureSoreRiskAssessment extends BaseRiskAssessment {
  assessment_type: 'pressure_sore';
  braden_subscores: {
    sensory_perception: number; // 1-4
    moisture: number; // 1-4
    activity: number; // 1-4
    mobility: number; // 1-4
    nutrition: number; // 1-4
    friction_shear: number; // 1-3
  };
  current_pressure_injuries: PressureInjury[];
  risk_areas: {
    sacrum: boolean;
    heels: boolean;
    elbows: boolean;
    back_of_head: boolean;
    shoulders: boolean;
    hips: boolean;
    ankles: boolean;
    knees: boolean;
  };
  prevention_interventions: {
    pressure_redistribution_surface: boolean;
    repositioning_schedule: string;
    skin_care_protocol: boolean;
    nutritional_support: boolean;
    moisture_management: boolean;
    education_provided: boolean;
  };
}

export interface PressureInjury {
  location: string;
  stage: 1 | 2 | 3 | 4 | 'unstageable' | 'deep_tissue';
  size_length: number;
  size_width: number;
  size_depth?: number;
  description: string;
  treatment_plan: string;
  healing_status: 'improving' | 'stable' | 'deteriorating';
}

// Nutritional Risk Assessment (MUST - Malnutrition Universal Screening Tool)
export interface NutritionalRiskAssessment extends BaseRiskAssessment {
  assessment_type: 'nutritional';
  must_components?: {
    bmi_score: number; // 0-2 points
    weight_loss_score: number; // 0-2 points
    acute_disease_score: number; // 0-2 points
  };
  // Anthropometric data
  height?: number; // cm
  weight?: number; // kg
  bmi?: number;
  weight_loss_percentage?: number;
  weight_loss_timeframe?: number; // weeks
  acute_disease_effect?: boolean;
  
  // Alternative property names for compatibility
  must_scores?: {
    bmi_score: number;
    weight_loss_score: number;
    acute_disease_score: number;
  };

  anthropometric_data?: {
    height: number; // cm
    weight: number; // kg
    bmi: number;
    weight_loss_percentage?: number;
    weight_loss_timeframe?: number; // weeks
    ideal_body_weight?: number;
  };
  dietary_assessment?: {
    appetite: 'good' | 'fair' | 'poor';
    dietary_intake: 'adequate' | 'reduced' | 'minimal';
    swallowing_difficulties: boolean;
    nausea_vomiting: boolean;
    dietary_restrictions: string[];
    supplements_taken: string[];
  };
  // Additional dietary fields for component compatibility
  dietary_intake?: {
    appetite_change?: string;
    eating_difficulties?: boolean;
    recent_diet_change?: boolean;
    dietary_restrictions?: string[];
  };
  nutritional_interventions?: {
    dietitian_referral?: boolean;
    nutritional_supplements?: boolean;
    modified_texture?: boolean;
    feeding_assistance?: boolean;
    enteral_nutrition?: boolean;
    parenteral_nutrition?: boolean;
  };
  clinical_indicators?: {
    albumin?: number;
    prealbumin?: number;
    transferrin?: number;
    total_lymphocyte_count?: number;
    hemoglobin?: number;
  };
  interventions?: {
    dietitian_referral: boolean;
    meal_plan_modified: boolean;
    nutritional_supplements: boolean;
    enteral_nutrition: boolean;
    parenteral_nutrition: boolean;
    monitoring_frequency: string;
  };
}

// Combined Risk Assessment Summary
export interface PatientRiskSummary {
  patient_id: string;
  assessment_date: Date;
  overall_risk_level: 'low' | 'moderate' | 'high' | 'critical';
  dvt_risk?: DVTRiskAssessment;
  pressure_sore_risk?: PressureSoreRiskAssessment;
  nutritional_risk?: NutritionalRiskAssessment;
  combined_recommendations: string[];
  high_priority_actions: ActionPlanItem[];
  next_review_date: Date;
}

// AI Analysis Results
export interface RiskAssessmentAIAnalysis {
  assessment_id: string;
  analysis_type: 'dvt' | 'pressure_sore' | 'nutritional' | 'combined';
  confidence_score: number; // 0-100
  risk_interpretation: string;
  evidence_based_recommendations: string[];
  intervention_priorities: {
    immediate: string[];
    short_term: string[];
    long_term: string[];
  };
  monitoring_parameters: string[];
  red_flag_alerts: string[];
  generated_at: Date;
}

// Service class for Risk Assessments
class RiskAssessmentService {
  
  /**
   * Calculate DVT risk score using Caprini Score methodology for surgical VTE prophylaxis
   * Reference: Caprini JA. Thrombosis risk assessment as a guide to quality patient care. Dis Mon. 2005
   */
  async calculateDVTRisk(assessment: Partial<DVTRiskAssessment>): Promise<{ score: number; riskLevel: string; interpretation: string }> {
    const factors = assessment.risk_factors!;
    let score = 0;
    
    // 1 Point Risk Factors
    if (factors.age_41_60) score += 1;
    if (factors.minor_surgery) score += 1;
    if (factors.bmi_over_25) score += 1;
    if (factors.swollen_legs) score += 1;
    if (factors.varicose_veins) score += 1;
    if (factors.pregnancy_postpartum) score += 1;
    if (factors.oral_contraceptives) score += 1;
    if (factors.sepsis_1month) score += 1;
    if (factors.serious_lung_disease) score += 1;
    if (factors.abnormal_pulmonary) score += 1;
    if (factors.acute_mi) score += 1;
    if (factors.chf_1month) score += 1;
    if (factors.inflammatory_bowel) score += 1;
    if (factors.medical_patient_bedrest) score += 1;
    
    // 2 Point Risk Factors
    if (factors.age_61_74) score += 2;
    if (factors.arthroscopic_surgery) score += 2;
    if (factors.malignancy) score += 2;
    if (factors.major_surgery_45min) score += 2;
    if (factors.laparoscopic_45min) score += 2;
    if (factors.patient_confined_bed) score += 2;
    if (factors.immobilizing_cast) score += 2;
    if (factors.central_venous_access) score += 2;
    
    // 3 Point Risk Factors
    if (factors.age_over_75) score += 3;
    if (factors.personal_history_vte) score += 3;
    if (factors.family_history_vte) score += 3;
    if (factors.factor_v_leiden) score += 3;
    if (factors.prothrombin_mutation) score += 3;
    if (factors.elevated_homocysteine) score += 3;
    if (factors.lupus_anticoagulant) score += 3;
    if (factors.anticardiolipin_antibodies) score += 3;
    if (factors.heparin_thrombocytopenia) score += 3;
    if (factors.other_thrombophilia) score += 3;
    
    // 5 Point Risk Factors
    if (factors.stroke_1month) score += 5;
    if (factors.elective_arthroplasty) score += 5;
    if (factors.hip_pelvis_fracture) score += 5;
    if (factors.acute_spinal_injury) score += 5;
    
    let riskLevel: string;
    let interpretation: string;
    let recommendation: string;
    
    // Caprini Score Risk Stratification for VTE Prophylaxis
    if (score >= 5) {
      riskLevel = 'high';
      interpretation = 'High VTE risk (Caprini >= 5). Strong recommendation for pharmacological prophylaxis.';
      recommendation = 'LMWH or UFH prophylaxis indicated. Consider extended prophylaxis post-discharge for high-risk surgery.';
    } else if (score >= 3) {
      riskLevel = 'moderate';
      interpretation = 'Moderate VTE risk (Caprini 3-4). Pharmacological prophylaxis recommended.';
      recommendation = 'LMWH or UFH prophylaxis recommended. Mechanical prophylaxis should also be used.';
    } else if (score >= 1) {
      riskLevel = 'low';
      interpretation = 'Low VTE risk (Caprini 1-2). Mechanical prophylaxis usually sufficient.';
      recommendation = 'Early ambulation and mechanical prophylaxis (SCDs or GCS). Pharmacological prophylaxis optional.';
    } else {
      riskLevel = 'very_low';
      interpretation = 'Very low VTE risk (Caprini 0). No specific VTE prophylaxis required.';
      recommendation = 'Early and frequent ambulation. No routine pharmacological or mechanical prophylaxis needed.';
    }
    
    return { score, riskLevel, interpretation };
  }

  /**
   * Calculate Pediatric DVT risk using UK NICE/RCPCH VTE Guidelines
   * Reference: NICE NG89 and RCPCH Clinical Practice Guidelines for VTE in children
   */
  async calculatePediatricDVTRisk(assessment: Partial<DVTRiskAssessment>): Promise<{ score: number; riskLevel: string; interpretation: string }> {
    const factors = assessment.risk_factors!;
    let score = 0;

    // High-risk factors (2 points each)
    if (factors.ped_central_venous_catheter) score += 2;
    if (factors.ped_previous_vte) score += 2;
    if (factors.ped_active_malignancy) score += 2;
    if (factors.ped_critical_care_admission) score += 2;
    if (factors.ped_inherited_thrombophilia) score += 2;
    if (factors.ped_nephrotic_syndrome) score += 2;

    // Moderate-risk factors (1 point each)
    if (factors.ped_age_over_13) score += 1;
    if (factors.ped_immobility_reduced_mobility) score += 1;
    if (factors.ped_family_history_vte) score += 1;
    if (factors.ped_chemotherapy) score += 1;
    if (factors.ped_significant_surgery) score += 1;
    if (factors.ped_lower_limb_surgery) score += 1;
    if (factors.ped_obesity) score += 1;
    if (factors.ped_dehydration) score += 1;
    if (factors.ped_acute_infection_sepsis) score += 1;
    if (factors.ped_inflammatory_condition) score += 1;
    if (factors.ped_sickle_cell_disease) score += 1;
    if (factors.ped_congenital_heart_disease) score += 1;
    if (factors.ped_oral_contraceptives) score += 1;
    if (factors.ped_prolonged_travel) score += 1;
    if (factors.ped_burns) score += 1;
    if (factors.ped_trauma) score += 1;

    let riskLevel: string;
    let interpretation: string;

    if (score >= 5) {
      riskLevel = 'high';
      interpretation = 'High pediatric VTE risk (Score ≥5). Pharmacological prophylaxis strongly recommended per NICE/RCPCH guidelines. Specialist hematology input advised.';
    } else if (score >= 3) {
      riskLevel = 'moderate';
      interpretation = 'Moderate pediatric VTE risk (Score 3-4). Consider pharmacological prophylaxis. Mechanical prophylaxis recommended. Daily reassessment required.';
    } else if (score >= 1) {
      riskLevel = 'low';
      interpretation = 'Low pediatric VTE risk (Score 1-2). Mechanical prophylaxis and early mobilization recommended. Pharmacological prophylaxis not routinely required.';
    } else {
      riskLevel = 'very_low';
      interpretation = 'Very low pediatric VTE risk (Score 0). Encourage early mobilization and hydration. No specific VTE prophylaxis required.';
    }

    return { score, riskLevel, interpretation };
  }

  /**
   * Generate auto prophylaxis recommendation based on score and age group
   */
  generateProphylaxisRecommendation(
    assessmentId: string,
    patientId: string,
    mode: 'adult' | 'pediatric',
    score: number,
    riskLevel: string,
    assessedBy: string
  ): DVTProphylaxisRecommendation {
    if (mode === 'pediatric') {
      return this.generatePediatricProphylaxis(assessmentId, patientId, score, riskLevel, assessedBy);
    }
    return this.generateAdultProphylaxis(assessmentId, patientId, score, riskLevel, assessedBy);
  }

  private generateAdultProphylaxis(
    assessmentId: string, patientId: string, score: number, riskLevel: string, assessedBy: string
  ): DVTProphylaxisRecommendation {
    const base: DVTProphylaxisRecommendation = {
      id: `proph_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      assessment_id: assessmentId,
      patient_id: patientId,
      mode: 'adult',
      score,
      risk_level: riskLevel,
      guideline_used: 'Caprini Score for VTE Risk Assessment (2005)',
      pharmacological: { recommended: false, drug: '', dose: '', frequency: '', duration: '', notes: '' },
      mechanical: { recommended: false, measures: [] },
      monitoring: [],
      contraindication_check: [
        'Active or recent major bleeding',
        'Severe thrombocytopenia (platelets < 50,000)',
        'Coagulopathy (INR > 1.5)',
        'Planned spinal/epidural procedure within 12h',
        'Allergy to heparin or LMWH',
        'History of HIT'
      ],
      special_considerations: [],
      generated_at: new Date(),
      generated_by: assessedBy
    };

    if (score >= 5) {
      // High risk — Caprini ≥5
      base.pharmacological = {
        recommended: true,
        drug: 'Enoxaparin (LMWH)',
        dose: '40 mg SC once daily',
        frequency: 'Once daily',
        duration: 'Until fully mobile or discharge (consider extended 4-5 weeks for major surgery/malignancy)',
        notes: 'Start 6-12 hours post-op if no contraindications. For Caprini ≥9: consider extended prophylaxis for 4-5 weeks post-discharge.'
      };
      base.mechanical = {
        recommended: true,
        measures: ['Intermittent Pneumatic Compression (IPC)', 'Graduated Compression Stockings (GCS 15-20 mmHg)']
      };
      base.monitoring = [
        'Anti-Xa levels if renal impairment or extremes of body weight',
        'Platelet count at baseline and day 5-7 (HIT screening)',
        'Daily assessment for signs of DVT/PE',
        'Hb/Hct if bleeding suspected'
      ];
      base.special_considerations = [
        'For Caprini ≥9: high VTE risk (>40%). Consider IVC filter if anticoagulation contraindicated.',
        'Start mechanical prophylaxis in OR and continue until fully mobile.',
        'Ensure adequate hydration and encourage early ambulation.'
      ];
    } else if (score >= 3) {
      // Moderate risk — Caprini 3-4
      base.pharmacological = {
        recommended: true,
        drug: 'Enoxaparin (LMWH)',
        dose: '40 mg SC once daily',
        frequency: 'Once daily',
        duration: 'Until fully mobile or discharge (typically 7-10 days)',
        notes: 'Start 6-12 hours post-op. Alternative: Unfractionated Heparin 5000 units SC q8-12h.'
      };
      base.mechanical = {
        recommended: true,
        measures: ['Graduated Compression Stockings (GCS 15-20 mmHg)', 'Intermittent Pneumatic Compression (IPC)']
      };
      base.monitoring = [
        'Daily clinical assessment for DVT symptoms',
        'Platelet count at baseline and day 5-7',
        'Monitor for bleeding complications'
      ];
    } else if (score >= 1) {
      // Low risk — Caprini 1-2
      base.pharmacological = {
        recommended: false,
        drug: 'Not routinely required',
        dose: '-',
        frequency: '-',
        duration: '-',
        notes: 'Pharmacological prophylaxis not routinely indicated for Caprini 1-2. Early mobilization is key.'
      };
      base.mechanical = {
        recommended: true,
        measures: ['Graduated Compression Stockings (GCS)', 'Sequential Compression Devices (SCD)']
      };
      base.monitoring = [
        'Observe for VTE symptoms during hospital stay',
        'Reassess if clinical status changes'
      ];
    } else {
      // Very low risk — Caprini 0
      base.pharmacological = {
        recommended: false,
        drug: 'No pharmacological prophylaxis needed',
        dose: '-',
        frequency: '-',
        duration: '-',
        notes: 'Very low VTE risk. No pharmacological or mechanical prophylaxis required routinely.'
      };
      base.mechanical = { recommended: false, measures: ['Early and frequent ambulation'] };
      base.monitoring = ['Routine clinical observation'];
    }

    return base;
  }

  private generatePediatricProphylaxis(
    assessmentId: string, patientId: string, score: number, riskLevel: string, assessedBy: string
  ): DVTProphylaxisRecommendation {
    const base: DVTProphylaxisRecommendation = {
      id: `proph_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      assessment_id: assessmentId,
      patient_id: patientId,
      mode: 'pediatric',
      score,
      risk_level: riskLevel,
      guideline_used: 'NICE NG89 / RCPCH UK Pediatric VTE Risk Assessment Guidelines',
      pharmacological: { recommended: false, drug: '', dose: '', frequency: '', duration: '', notes: '' },
      mechanical: { recommended: false, measures: [] },
      monitoring: [],
      contraindication_check: [
        'Active bleeding or high bleeding risk',
        'Severe thrombocytopenia (platelets < 50,000)',
        'Coagulopathy',
        'Recent CNS surgery or hemorrhagic stroke',
        'Neonates: consider risk-benefit ratio carefully',
        'Allergy to heparin or LMWH',
        'Body weight < 5 kg (relative contraindication for LMWH)'
      ],
      special_considerations: [
        'All pediatric VTE prophylaxis decisions should involve senior clinical review.',
        'Weight-based dosing is essential in children.'
      ],
      generated_at: new Date(),
      generated_by: assessedBy
    };

    if (score >= 5) {
      // High risk pediatric
      base.pharmacological = {
        recommended: true,
        drug: 'Enoxaparin (LMWH)',
        dose: 'Age >2 months: 0.5 mg/kg SC once daily. Neonates/infants <2 months: 0.75 mg/kg SC once daily.',
        frequency: 'Once daily',
        duration: 'Until risk factors resolved or senior review (typically 7-14 days or until mobile)',
        notes: 'NICE/RCPCH recommends pharmacological prophylaxis for high-risk pediatric patients. Consult pediatric hematology. Monitor anti-Xa levels. Adjust dose for renal impairment.'
      };
      base.mechanical = {
        recommended: true,
        measures: [
          'Anti-embolism stockings (if age-appropriate size available)',
          'Intermittent Pneumatic Compression (if appropriate for child size)',
          'Early mobilization and encourage movement'
        ]
      };
      base.monitoring = [
        'Anti-Xa levels 4 hours post 2nd or 3rd dose (target prophylactic: 0.2-0.4 IU/mL)',
        'Platelet count at baseline and day 5-7',
        'Daily assessment for VTE symptoms',
        'Renal function monitoring',
        'Weight-based dose recalculation if weight changes'
      ];
      base.special_considerations = [
        'Pediatric hematology consultation recommended for high-risk patients.',
        'Central venous catheter-related thrombosis: consider catheter removal vs anticoagulation.',
        'For post-pubertal females on OCP: consider temporary discontinuation.',
        'Ensure adequate hydration.'
      ];
    } else if (score >= 3) {
      // Moderate risk pediatric
      base.pharmacological = {
        recommended: true,
        drug: 'Enoxaparin (LMWH)',
        dose: 'Age >2 months: 0.5 mg/kg SC once daily. Neonates/infants < 2 months: 0.75 mg/kg SC once daily.',
        frequency: 'Once daily',
        duration: 'Until risk factors resolved or discharge (typically 5-7 days)',
        notes: 'Consider pharmacological prophylaxis per NICE NG89. Discuss with senior clinician. Weekly reassessment.'
      };
      base.mechanical = {
        recommended: true,
        measures: [
          'Anti-embolism stockings (age/size appropriate)',
          'Early mobilization',
          'Adequate oral/IV hydration'
        ]
      };
      base.monitoring = [
        'Daily clinical assessment for DVT/PE symptoms',
        'Anti-Xa levels if pharmacological prophylaxis started',
        'Platelet count monitoring'
      ];
      base.special_considerations = [
        'Reassess daily — step down prophylaxis if risk factors resolve.',
        'Weight-based dosing essential. Recalculate if weight changes.',
        'Consider underlying thrombophilia screening if strong family history.'
      ];
    } else if (score >= 1) {
      // Low risk pediatric
      base.pharmacological = {
        recommended: false,
        drug: 'Not routinely required',
        dose: '-',
        frequency: '-',
        duration: '-',
        notes: 'Pharmacological prophylaxis not routinely recommended for low-risk pediatric patients. Focus on non-pharmacological measures.'
      };
      base.mechanical = {
        recommended: true,
        measures: [
          'Early mobilization and encourage play/activity',
          'Adequate hydration (oral preferred)',
          'Anti-embolism stockings if immobility expected > 48 hours (size permitting)'
        ]
      };
      base.monitoring = ['Reassess VTE risk if clinical condition changes', 'Standard clinical observations'];
    } else {
      // Very low risk pediatric
      base.pharmacological = {
        recommended: false, drug: 'No prophylaxis needed', dose: '-', frequency: '-', duration: '-',
        notes: 'Very low VTE risk. Routine prophylaxis not indicated for pediatric patients at this risk level.'
      };
      base.mechanical = { recommended: false, measures: ['Encourage normal activity and adequate hydration'] };
      base.monitoring = ['Routine clinical care'];
    }

    return base;
  }

  
  /**
   * Calculate pressure sore risk using Braden Scale
   */
  async calculatePressureSoreRisk(assessment: Partial<PressureSoreRiskAssessment>): Promise<{ score: number; riskLevel: string; interpretation: string }> {
    const subscores = assessment.braden_subscores!;
    const totalScore = subscores.sensory_perception + subscores.moisture + 
                      subscores.activity + subscores.mobility + 
                      subscores.nutrition + subscores.friction_shear;
    
    let riskLevel: string;
    let interpretation: string;
    
    if (totalScore <= 9) {
      riskLevel = 'very_high';
      interpretation = 'Very high risk for pressure injury development. Implement comprehensive prevention protocol immediately.';
    } else if (totalScore <= 12) {
      riskLevel = 'high';
      interpretation = 'High risk for pressure injury. Implement intensive prevention measures.';
    } else if (totalScore <= 14) {
      riskLevel = 'moderate';
      interpretation = 'Moderate risk for pressure injury. Implement standard prevention measures.';
    } else {
      riskLevel = 'low';
      interpretation = 'Low risk for pressure injury. Continue routine skin assessment and basic prevention measures.';
    }
    
    return { score: totalScore, riskLevel, interpretation };
  }
  
  /**
   * Calculate nutritional risk using MUST score
   */
  async calculateNutritionalRisk(assessment: Partial<NutritionalRiskAssessment>): Promise<{ score: number; riskLevel: string; interpretation: string }> {
    // Support both must_components and must_scores for backwards compatibility
    const components = assessment.must_components || assessment.must_scores || { bmi_score: 0, weight_loss_score: 0, acute_disease_score: 0 };
    const totalScore = (components.bmi_score || 0) + (components.weight_loss_score || 0) + (components.acute_disease_score || 0);
    
    let riskLevel: string;
    let interpretation: string;
    
    if (totalScore >= 2) {
      riskLevel = 'high';
      interpretation = 'High risk of malnutrition. Refer to dietitian and implement nutritional care plan.';
    } else if (totalScore === 1) {
      riskLevel = 'moderate';
      interpretation = 'Medium risk of malnutrition. Observe and reassess weekly.';
    } else {
      riskLevel = 'low';
      interpretation = 'Low risk of malnutrition. Routine clinical care and reassess weekly.';
    }
    
    return { score: totalScore, riskLevel, interpretation };
  }
  
  /**
   * Generate AI-powered recommendations for risk assessment
   */
  async generateAIRecommendations(
    assessmentType: 'dvt' | 'pressure_sore' | 'nutritional',
    assessment: any,
    patientData: any
  ): Promise<RiskAssessmentAIAnalysis> {
    try {
      if (!aiService.isReady()) {
        // Return evidence-based recommendations without AI
        return this.getEvidenceBasedRecommendations(assessmentType, assessment);
      }
      
      const prompt = this.buildAssessmentPrompt(assessmentType, assessment, patientData);
      
      // This would use OpenAI API for advanced analysis
      // For now, return structured evidence-based recommendations
      return this.getEvidenceBasedRecommendations(assessmentType, assessment);
      
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return this.getEvidenceBasedRecommendations(assessmentType, assessment);
    }
  }
  
  /**
   * Get evidence-based clinical recommendations
   */
  private getEvidenceBasedRecommendations(
    assessmentType: 'dvt' | 'pressure_sore' | 'nutritional',
    assessment: any
  ): RiskAssessmentAIAnalysis {
    const baseAnalysis: RiskAssessmentAIAnalysis = {
      assessment_id: assessment.id || 'temp',
      analysis_type: assessmentType,
      confidence_score: 90,
      risk_interpretation: '',
      evidence_based_recommendations: [],
      intervention_priorities: {
        immediate: [],
        short_term: [],
        long_term: []
      },
      monitoring_parameters: [],
      red_flag_alerts: [],
      generated_at: new Date()
    };
    
    switch (assessmentType) {
      case 'dvt':
        return this.getDVTRecommendations(assessment, baseAnalysis);
      case 'pressure_sore':
        return this.getPressureSoreRecommendations(assessment, baseAnalysis);
      case 'nutritional':
        return this.getNutritionalRecommendations(assessment, baseAnalysis);
      default:
        return baseAnalysis;
    }
  }
  
  private getDVTRecommendations(assessment: DVTRiskAssessment, baseAnalysis: RiskAssessmentAIAnalysis): RiskAssessmentAIAnalysis {
    const riskLevel = assessment.risk_level;
    
    if (riskLevel === 'high' || riskLevel === 'very_high') {
      baseAnalysis.intervention_priorities.immediate = [
        'Consider immediate anticoagulation if no contraindications',
        'Order urgent duplex ultrasound or CT venography',
        'Assess bleeding risk before anticoagulation',
        'Consider IVC filter if anticoagulation contraindicated'
      ];
      baseAnalysis.red_flag_alerts = [
        'High DVT probability - urgent evaluation required',
        'Monitor for signs of pulmonary embolism'
      ];
    }
    
    baseAnalysis.evidence_based_recommendations = [
      'Early mobilization as tolerated',
      'Graduated compression stockings (15-20 mmHg)',
      'Intermittent pneumatic compression devices',
      'Adequate hydration',
      'Pharmacological prophylaxis per institutional guidelines'
    ];
    
    baseAnalysis.monitoring_parameters = [
      'Daily assessment for leg swelling, pain, or warmth',
      'Monitor respiratory symptoms for PE',
      'Check platelet count if on heparin',
      'Assess bleeding signs if anticoagulated'
    ];
    
    return baseAnalysis;
  }
  
  private getPressureSoreRecommendations(assessment: PressureSoreRiskAssessment, baseAnalysis: RiskAssessmentAIAnalysis): RiskAssessmentAIAnalysis {
    const riskLevel = assessment.risk_level;
    
    if (riskLevel === 'high' || riskLevel === 'very_high') {
      baseAnalysis.intervention_priorities.immediate = [
        'Implement 2-hourly repositioning schedule',
        'Use pressure-redistributing support surface',
        'Optimize nutrition and hydration',
        'Implement comprehensive skin care protocol'
      ];
      baseAnalysis.red_flag_alerts = [
        'Very high pressure injury risk - intensive prevention required'
      ];
    }
    
    baseAnalysis.evidence_based_recommendations = [
      'Regular skin assessment every shift',
      'Maintain skin hygiene and moisture balance',
      'Minimize friction and shear forces',
      'Nutritional assessment and optimization',
      'Education for patient and family'
    ];
    
    baseAnalysis.monitoring_parameters = [
      'Skin integrity assessment every shift',
      'Nutritional intake monitoring',
      'Mobility and activity level assessment',
      'Pain assessment related to positioning'
    ];
    
    return baseAnalysis;
  }
  
  private getNutritionalRecommendations(assessment: NutritionalRiskAssessment, baseAnalysis: RiskAssessmentAIAnalysis): RiskAssessmentAIAnalysis {
    const riskLevel = assessment.risk_level;
    
    if (riskLevel === 'high' || riskLevel === 'very_high') {
      baseAnalysis.intervention_priorities.immediate = [
        'Urgent dietitian referral',
        'Implement nutritional care plan',
        'Consider nutritional supplements',
        'Address underlying causes of poor intake'
      ];
      baseAnalysis.red_flag_alerts = [
        'High malnutrition risk - urgent intervention required'
      ];
    }
    
    baseAnalysis.evidence_based_recommendations = [
      'Regular weight monitoring',
      'Food diary and intake assessment',
      'Oral nutritional supplements if indicated',
      'Address barriers to adequate nutrition',
      'Monitor for refeeding syndrome if severely malnourished'
    ];
    
    baseAnalysis.monitoring_parameters = [
      'Weekly weight monitoring',
      'Daily caloric and protein intake',
      'Laboratory markers (albumin, prealbumin)',
      'Functional status and strength assessment'
    ];
    
    return baseAnalysis;
  }
  
  private buildAssessmentPrompt(assessmentType: string, assessment: any, patientData: any): string {
    return `
    Generate clinical recommendations for ${assessmentType} risk assessment.
    
    Assessment Data: ${JSON.stringify(assessment, null, 2)}
    Patient Data: ${JSON.stringify(patientData, null, 2)}
    
    Provide evidence-based recommendations including:
    1. Risk interpretation
    2. Immediate interventions needed
    3. Short-term and long-term management
    4. Monitoring parameters
    5. Red flag alerts
    `;
  }

  // Database interaction methods
  
  /**
   * Save DVT risk assessment to database
   */
  async saveDVTAssessment(assessment: DVTRiskAssessment): Promise<string> {
    try {
      const assessmentWithTimestamps = {
        ...assessment,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Try to sync to server first
      try {
        const saved = await apiClient.createRiskAssessment(assessmentWithTimestamps);
        console.log('✅ DVT risk assessment synced to server:', saved.id);
        await db.dvt_assessments.add({ ...assessmentWithTimestamps, id: saved.id, synced: true });
        return saved.id;
      } catch (syncError) {
        console.warn('⚠️ Failed to sync DVT assessment to server, saving locally', syncError);
        const id = await db.dvt_assessments.add({ ...assessmentWithTimestamps, synced: false });
        await syncService.queueAction('create', 'risk_assessments', id as any, assessmentWithTimestamps);
        console.log('📱 DVT assessment saved locally, will sync when online:', id);
        return id.toString();
      }
    } catch (error) {
      console.error('Error saving DVT assessment:', error);
      throw new Error('Failed to save DVT assessment');
    }
  }

  /**
   * Save pressure sore risk assessment to database
   */
  async savePressureSoreAssessment(assessment: PressureSoreRiskAssessment): Promise<string> {
    try {
      const assessmentWithTimestamps = {
        ...assessment,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Try to sync to server first
      try {
        const saved = await apiClient.createRiskAssessment(assessmentWithTimestamps);
        console.log('✅ Pressure sore risk assessment synced to server:', saved.id);
        await db.pressure_sore_assessments.add({ ...assessmentWithTimestamps, id: saved.id, synced: true });
        return saved.id;
      } catch (syncError) {
        console.warn('⚠️ Failed to sync pressure sore assessment to server, saving locally', syncError);
        const id = await db.pressure_sore_assessments.add({ ...assessmentWithTimestamps, synced: false });
        await syncService.queueAction('create', 'risk_assessments', id as any, assessmentWithTimestamps);
        console.log('📱 Pressure sore assessment saved locally, will sync when online:', id);
        return id.toString();
      }
    } catch (error) {
      console.error('Error saving pressure sore assessment:', error);
      throw new Error('Failed to save pressure sore assessment');
    }
  }

  /**
   * Save nutritional risk assessment to database
   */
  async saveNutritionalAssessment(assessment: NutritionalRiskAssessment): Promise<string> {
    try {
      const assessmentWithTimestamps = {
        ...assessment,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Try to sync to server first
      try {
        const saved = await apiClient.createRiskAssessment(assessmentWithTimestamps);
        console.log('✅ Nutritional risk assessment synced to server:', saved.id);
        await db.nutritional_assessments.add({ ...assessmentWithTimestamps, id: saved.id, synced: true });
        return saved.id;
      } catch (syncError) {
        console.warn('⚠️ Failed to sync nutritional assessment to server, saving locally', syncError);
        const id = await db.nutritional_assessments.add({ ...assessmentWithTimestamps, synced: false });
        await syncService.queueAction('create', 'risk_assessments', id as any, assessmentWithTimestamps);
        console.log('📱 Nutritional assessment saved locally, will sync when online:', id);
        return id.toString();
      }
    } catch (error) {
      console.error('Error saving nutritional assessment:', error);
      throw new Error('Failed to save nutritional assessment');
    }
  }

  /**
   * Get all risk assessments for a patient
   */
  async getPatientRiskAssessments(patientId: string): Promise<{
    dvt: DVTRiskAssessment[];
    pressureSore: PressureSoreRiskAssessment[];
    nutritional: NutritionalRiskAssessment[];
  }> {
    try {
      // Try server first
      if (navigator.onLine) {
        try {
          const [dvtServer, pressureServer, nutritionalServer] = await Promise.all([
            apiClient.getRiskAssessments(patientId, 'dvt'),
            apiClient.getRiskAssessments(patientId, 'pressure_sore'),
            apiClient.getRiskAssessments(patientId, 'nutritional')
          ]);
          const dvt = Array.isArray(dvtServer) ? dvtServer : [];
          const pressureSore = Array.isArray(pressureServer) ? pressureServer : [];
          const nutritional = Array.isArray(nutritionalServer) ? nutritionalServer : [];
          // Sync to local
          for (const a of dvt) { try { await db.dvt_assessments.put({ ...a, synced: true }); } catch { /* ignore */ } }
          for (const a of pressureSore) { try { await db.pressure_sore_assessments.put({ ...a, synced: true }); } catch { /* ignore */ } }
          for (const a of nutritional) { try { await db.nutritional_assessments.put({ ...a, synced: true }); } catch { /* ignore */ } }
          if (dvt.length > 0 || pressureSore.length > 0 || nutritional.length > 0) {
            return { dvt, pressureSore, nutritional };
          }
        } catch (e) {
          console.warn('Could not fetch risk assessments from server:', e);
        }
      }
      // Fallback to local
      const [dvtAssessments, pressureSoreAssessments, nutritionalAssessments] = await Promise.all([
        db.dvt_assessments.where('patient_id').equals(patientId).toArray(),
        db.pressure_sore_assessments.where('patient_id').equals(patientId).toArray(),
        db.nutritional_assessments.where('patient_id').equals(patientId).toArray()
      ]);

      return {
        dvt: dvtAssessments,
        pressureSore: pressureSoreAssessments,
        nutritional: nutritionalAssessments
      };
    } catch (error) {
      console.error('Error getting patient risk assessments:', error);
      return {
        dvt: [],
        pressureSore: [],
        nutritional: []
      };
    }
  }

  /**
   * Get latest risk assessments for a patient
   */
  async getLatestRiskAssessments(patientId: string): Promise<{
    dvt?: DVTRiskAssessment;
    pressureSore?: PressureSoreRiskAssessment;
    nutritional?: NutritionalRiskAssessment;
  }> {
    try {
      // Try server first
      if (navigator.onLine) {
        try {
          const [dvtServer, pressureServer, nutritionalServer] = await Promise.all([
            apiClient.getRiskAssessments(patientId, 'dvt'),
            apiClient.getRiskAssessments(patientId, 'pressure_sore'),
            apiClient.getRiskAssessments(patientId, 'nutritional')
          ]);
          const dvtArr = Array.isArray(dvtServer) ? dvtServer : [];
          const psArr = Array.isArray(pressureServer) ? pressureServer : [];
          const nutArr = Array.isArray(nutritionalServer) ? nutritionalServer : [];
          if (dvtArr.length > 0 || psArr.length > 0 || nutArr.length > 0) {
            return {
              dvt: dvtArr.length > 0 ? dvtArr[dvtArr.length - 1] : undefined,
              pressureSore: psArr.length > 0 ? psArr[psArr.length - 1] : undefined,
              nutritional: nutArr.length > 0 ? nutArr[nutArr.length - 1] : undefined
            };
          }
        } catch (e) {
          console.warn('Could not fetch latest risk assessments from server:', e);
        }
      }
      // Fallback to local
      const [latestDVT, latestPressureSore, latestNutritional] = await Promise.all([
        db.dvt_assessments
          .where('patient_id')
          .equals(patientId)
          .reverse()
          .first(),
        db.pressure_sore_assessments
          .where('patient_id')
          .equals(patientId)
          .reverse()
          .first(),
        db.nutritional_assessments
          .where('patient_id')
          .equals(patientId)
          .reverse()
          .first()
      ]);

      return {
        dvt: latestDVT,
        pressureSore: latestPressureSore,
        nutritional: latestNutritional
      };
    } catch (error) {
      console.error('Error getting latest risk assessments:', error);
      return {};
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Generate unique assessment ID
   */
  generateAssessmentId(): string {
    return `assess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Export singleton instance
export const riskAssessmentService = new RiskAssessmentService();