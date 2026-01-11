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

// DVT Risk Assessment (Caprini Score for VTE Risk)
export interface DVTRiskAssessment extends BaseRiskAssessment {
  assessment_type: 'dvt';
  risk_factors: {
    // 1 Point Risk Factors
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
   * Calculate DVT risk score using Wells Score methodology
   */
  async calculateDVTRisk(assessment: Partial<DVTRiskAssessment>): Promise<{ score: number; riskLevel: string; interpretation: string }> {
    const factors = assessment.risk_factors!;
    let score = 0;
    
    // Wells Score for DVT
    if (factors.active_cancer) score += 1;
    if (factors.paralysis_paresis) score += 1;
    if (factors.recent_bedrest) score += 1;
    if (factors.major_surgery) score += 1;
    if (factors.localized_tenderness) score += 1;
    if (factors.swelling_entire_leg) score += 1;
    if (factors.calf_swelling) score += 1;
    if (factors.pitting_edema) score += 1;
    if (factors.collateral_veins) score += 1;
    if (factors.previous_dvt) score += 1;
    if (factors.alternative_diagnosis) score -= 2;
    
    let riskLevel: string;
    let interpretation: string;
    
    if (score >= 3) {
      riskLevel = 'high';
      interpretation = 'High probability of DVT. Consider immediate investigation with D-dimer and imaging.';
    } else if (score >= 1) {
      riskLevel = 'moderate';
      interpretation = 'Moderate probability of DVT. Consider D-dimer testing.';
    } else {
      riskLevel = 'low';
      interpretation = 'Low probability of DVT. DVT unlikely, consider alternative diagnosis.';
    }
    
    return { score, riskLevel, interpretation };
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
    const components = assessment.must_components!;
    const totalScore = components.bmi_score + components.weight_loss_score + components.acute_disease_score;
    
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