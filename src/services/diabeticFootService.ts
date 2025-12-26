/**
 * Diabetic Foot Limb Salvage Scoring Service
 * 
 * Comprehensive scoring system for diabetic foot assessment to support
 * clinical decision-making for limb salvage vs amputation procedures.
 * 
 * Scoring Systems Included:
 * - Wagner Classification (Grade 0-5)
 * - University of Texas Classification
 * - WIfI Classification (Wound, Ischemia, foot Infection)
 * - SINBAD Score
 * - Sepsis Assessment (qSOFA, SIRS)
 * - Renal Status (eGFR, Dialysis)
 * - Arterial Doppler Findings (ABI, Waveforms)
 * - Venous Doppler Findings
 * - Osteomyelitis Assessment
 * - Co-morbidity Index
 */

import { v4 as uuidv4 } from 'uuid';

// ================== INTERFACES ==================

export interface DiabeticFootAssessment {
  id: string;
  patientId: string;
  assessmentDate: Date;
  assessedBy: string;
  
  // Patient Demographics
  demographics: PatientDemographics;
  
  // Wound Classification
  wagnerGrade: WagnerGrade;
  texasClassification: TexasClassification;
  wifiClassification: WIfIClassification;
  sinbadScore: SINBADScore;
  
  // Clinical Assessments
  comorbidities: Comorbidities;
  renalStatus: RenalStatus;
  sepsisAssessment: SepsisAssessment;
  
  // Vascular Studies
  arterialDoppler: ArterialDopplerFindings;
  venousDoppler: VenousDopplerFindings;
  
  // Osteomyelitis
  osteomyelitis: OsteomyelitisAssessment;
  
  // Calculated Scores
  totalScore: number;
  riskCategory: RiskCategory;
  limbSalvageProbability: number;
  
  // Recommendations
  recommendedIntervention: RecommendedIntervention;
  detailedRecommendations: string[];
  monitoringPlan: MonitoringPlan;
  
  // Metadata
  status: 'draft' | 'completed' | 'reviewed';
  reviewedBy?: string;
  reviewDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PatientDemographics {
  age: number;
  gender: 'male' | 'female';
  diabetesType: 'type1' | 'type2';
  diabetesDuration: number; // years
  smokingStatus: 'current' | 'former' | 'never';
  ambulatoryStatus: 'ambulatory' | 'limited' | 'non-ambulatory';
}

// Wagner Classification
export interface WagnerGrade {
  grade: 0 | 1 | 2 | 3 | 4 | 5;
  description: string;
  score: number;
}

export const WAGNER_GRADES: Record<number, { description: string; score: number }> = {
  0: { description: 'Pre-ulcerative lesion, healed ulcer, or presence of bony deformity', score: 0 },
  1: { description: 'Superficial ulcer without subcutaneous tissue involvement', score: 5 },
  2: { description: 'Penetrating ulcer through subcutaneous tissue, may expose bone, tendon, ligament, or joint', score: 10 },
  3: { description: 'Osteitis, abscess, or osteomyelitis', score: 20 },
  4: { description: 'Gangrene of forefoot or heel', score: 30 },
  5: { description: 'Gangrene of entire foot', score: 50 }
};

// University of Texas Classification
export interface TexasClassification {
  stage: 'A' | 'B' | 'C' | 'D';
  grade: 0 | 1 | 2 | 3;
  description: string;
  score: number;
}

export const TEXAS_STAGES: Record<string, { description: string; multiplier: number }> = {
  'A': { description: 'No infection or ischemia', multiplier: 1.0 },
  'B': { description: 'Infection present', multiplier: 1.5 },
  'C': { description: 'Ischemia present', multiplier: 2.0 },
  'D': { description: 'Infection AND ischemia present', multiplier: 3.0 }
};

export const TEXAS_GRADES: Record<number, { description: string; baseScore: number }> = {
  0: { description: 'Pre or post-ulcerative site, completely epithelialized', baseScore: 0 },
  1: { description: 'Superficial ulcer not involving tendon, capsule, or bone', baseScore: 5 },
  2: { description: 'Ulcer penetrating to tendon or capsule', baseScore: 10 },
  3: { description: 'Ulcer penetrating to bone or joint', baseScore: 15 }
};

// WIfI Classification (Wound, Ischemia, foot Infection)
export interface WIfIClassification {
  wound: 0 | 1 | 2 | 3;
  ischemia: 0 | 1 | 2 | 3;
  footInfection: 0 | 1 | 2 | 3;
  clinicalStage: 1 | 2 | 3 | 4 | 5;
  amputationRisk: 'very_low' | 'low' | 'moderate' | 'high';
  revascularizationBenefit: 'low' | 'moderate' | 'high';
  score: number;
}

export const WIFI_WOUND_GRADES = {
  0: { description: 'No ulcer or gangrene', criteria: 'Minor tissue loss, Ischemic rest pain' },
  1: { description: 'Small, shallow ulcer(s) on distal leg or foot', criteria: 'No exposed bone unless limited to distal phalanx' },
  2: { description: 'Deeper ulcer with exposed bone, joint, or tendon', criteria: 'Gangrenous changes limited to toes, shallow heel ulcer' },
  3: { description: 'Extensive, deep ulcer involving forefoot/midfoot', criteria: 'Full thickness heel ulcer with calcaneal involvement' }
};

export const WIFI_ISCHEMIA_GRADES = {
  0: { description: 'ABI ≥0.80', toePressure: '≥60 mmHg', tcPO2: '≥60 mmHg' },
  1: { description: 'ABI 0.6-0.79', toePressure: '40-59 mmHg', tcPO2: '40-59 mmHg' },
  2: { description: 'ABI 0.4-0.59', toePressure: '30-39 mmHg', tcPO2: '30-39 mmHg' },
  3: { description: 'ABI <0.4', toePressure: '<30 mmHg', tcPO2: '<30 mmHg' }
};

export const WIFI_INFECTION_GRADES = {
  0: { description: 'No symptoms or signs of infection' },
  1: { description: 'Mild: Local infection involving skin and subcutaneous tissue only', criteria: 'Erythema >0.5 cm but ≤2 cm from ulcer margin' },
  2: { description: 'Moderate: Local infection with deeper tissue involvement', criteria: 'Erythema >2 cm, lymphangitis, fascia, muscle, tendon, joint or bone' },
  3: { description: 'Severe: Local infection with systemic inflammatory response', criteria: 'SIRS criteria met (temp, HR, RR, WBC)' }
};

// SINBAD Score
export interface SINBADScore {
  site: 0 | 1;
  ischemia: 0 | 1;
  neuropathy: 0 | 1;
  bacterialInfection: 0 | 1;
  area: 0 | 1;
  depth: 0 | 1;
  totalScore: number;
  riskCategory: 'low' | 'moderate' | 'high';
}

// Co-morbidities Assessment
export interface Comorbidities {
  hypertension: boolean;
  coronaryArteryDisease: boolean;
  congestiveHeartFailure: boolean;
  cerebrovascularDisease: boolean;
  peripheralVascularDisease: boolean;
  chronicKidneyDisease: boolean;
  dialysis: boolean;
  retinopathy: boolean;
  neuropathy: boolean;
  previousAmputation: boolean;
  immunosuppression: boolean;
  malnutrition: boolean;
  obesity: boolean;
  anemia: boolean;
  hivAids: boolean;
  malignancy: boolean;
  
  // Metabolic Control
  hba1c: number; // percentage
  recentBloodSugarControl: 'good' | 'moderate' | 'poor';
  
  score: number;
}

// Renal Status
export interface RenalStatus {
  creatinine: number; // mg/dL
  bun: number; // mg/dL
  egfr: number; // mL/min/1.73m²
  ckdStage: 1 | 2 | 3 | 4 | 5;
  dialysisDependent: boolean;
  dialysisType?: 'hemodialysis' | 'peritoneal';
  dialysisVintage?: number; // months on dialysis
  score: number;
}

// Sepsis Assessment
export interface SepsisAssessment {
  // SIRS Criteria
  temperature: number; // Celsius
  heartRate: number; // bpm
  respiratoryRate: number; // per minute
  wbc: number; // x10^9/L
  
  // qSOFA
  alteredMentation: boolean;
  systolicBP: number; // mmHg
  
  // Laboratory Markers
  crp: number; // mg/L
  procalcitonin?: number; // ng/mL
  lactate?: number; // mmol/L
  
  // Clinical Signs
  fever: boolean;
  chills: boolean;
  localCellulitis: boolean;
  lymphangitis: boolean;
  purulentDischarge: boolean;
  crepitus: boolean;
  foulSmell: boolean;
  
  sirsScore: number;
  qsofaScore: number;
  sepsisLikelihood: 'unlikely' | 'possible' | 'probable' | 'definite';
  score: number;
}

// Arterial Doppler Findings
export interface ArterialDopplerFindings {
  // Ankle-Brachial Index
  abiRight: number;
  abiLeft: number;
  affectedSideABI: number;
  
  // Toe Pressure
  toePressure?: number; // mmHg
  toeBrachialIndex?: number;
  
  // Waveform Analysis
  waveformType: 'triphasic' | 'biphasic' | 'monophasic' | 'absent';
  
  // Specific Vessel Assessment
  dorsalisPedis: 'normal' | 'reduced' | 'absent';
  posteriorTibial: 'normal' | 'reduced' | 'absent';
  peroneal: 'normal' | 'reduced' | 'absent';
  
  // Stenosis
  stenosisPresent: boolean;
  stenosisLocation?: string;
  stenosisSeverity?: 'mild' | 'moderate' | 'severe' | 'occlusion';
  
  // Calcification
  vesselCalcification: boolean;
  incompressibleVessels: boolean;
  
  score: number;
  interpretation: string;
}

// Venous Doppler Findings
export interface VenousDopplerFindings {
  dvtPresent: boolean;
  chronicVenousInsufficiency: boolean;
  venousReflux: boolean;
  varicoseVeins: boolean;
  previousDvt: boolean;
  postPhlebiticSyndrome: boolean;
  edemaPresent: boolean;
  edemaGrade: 0 | 1 | 2 | 3;
  
  score: number;
}

// Osteomyelitis Assessment
export interface OsteomyelitisAssessment {
  // Clinical Findings
  probeTosBone: boolean;
  visibleBone: boolean;
  sausageToe: boolean;
  
  // Imaging
  xrayFindings: 'normal' | 'suspicious' | 'definite';
  mriPerformed: boolean;
  mriFinding?: 'negative' | 'suspicious' | 'positive';
  boneScintgraphyPerformed: boolean;
  boneScintgraphyResult?: 'negative' | 'positive';
  
  // Laboratory
  esr?: number; // mm/hr
  crp?: number; // mg/L
  
  // Biopsy
  boneBiopsyPerformed: boolean;
  boneBiopsyResult?: 'negative' | 'positive';
  
  // Duration
  ulcerDuration: number; // weeks
  previousAntibioticCourses: number;
  
  osteomyelitisLikelihood: 'unlikely' | 'possible' | 'probable' | 'confirmed';
  score: number;
}

// Risk Categories
export type RiskCategory = 
  | 'low_risk_limb_salvage_likely'
  | 'moderate_risk_limb_salvage_possible'
  | 'high_risk_consider_amputation'
  | 'critical_amputation_recommended';

// Recommended Interventions
export type RecommendedIntervention = 
  | 'conservative_management'
  | 'wound_care_debridement'
  | 'revascularization_first'
  | 'ray_amputation'
  | 'transmetatarsal_amputation'
  | 'below_knee_amputation'
  | 'above_knee_amputation'
  | 'palliative_care';

// Monitoring Plan
export interface MonitoringPlan {
  followUpFrequency: string;
  requiredTests: string[];
  woundCareProtocol: string[];
  offloadingRecommendations: string[];
  antibioticTherapy?: string;
  nutritionalSupport: string[];
  glycemicControl: string[];
  vasculaConsult: boolean;
  infectedDiseaseConsult: boolean;
  nephologyConsult: boolean;
  rehabilitationPlan: string[];
}

// ================== SCORING SERVICE ==================

class DiabeticFootService {
  
  /**
   * Create a new assessment
   */
  createNewAssessment(patientId: string, assessedBy: string): Partial<DiabeticFootAssessment> {
    return {
      id: uuidv4(),
      patientId,
      assessmentDate: new Date(),
      assessedBy,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Calculate Wagner Grade Score
   */
  calculateWagnerScore(grade: 0 | 1 | 2 | 3 | 4 | 5): WagnerGrade {
    const gradeInfo = WAGNER_GRADES[grade];
    return {
      grade,
      description: gradeInfo.description,
      score: gradeInfo.score
    };
  }

  /**
   * Calculate Texas Classification Score
   */
  calculateTexasScore(grade: 0 | 1 | 2 | 3, stage: 'A' | 'B' | 'C' | 'D'): TexasClassification {
    const gradeInfo = TEXAS_GRADES[grade];
    const stageInfo = TEXAS_STAGES[stage];
    const score = Math.round(gradeInfo.baseScore * stageInfo.multiplier);
    
    return {
      grade,
      stage,
      description: `Grade ${grade}${stage}: ${gradeInfo.description} with ${stageInfo.description.toLowerCase()}`,
      score
    };
  }

  /**
   * Calculate WIfI Score and Clinical Stage
   */
  calculateWIfIScore(wound: 0 | 1 | 2 | 3, ischemia: 0 | 1 | 2 | 3, infection: 0 | 1 | 2 | 3): WIfIClassification {
    const combinedScore = wound + ischemia + infection;
    
    let clinicalStage: 1 | 2 | 3 | 4 | 5;
    let amputationRisk: 'very_low' | 'low' | 'moderate' | 'high';
    let revascularizationBenefit: 'low' | 'moderate' | 'high';
    
    // Clinical stage based on WIfI matrix
    if (combinedScore <= 2) {
      clinicalStage = 1;
      amputationRisk = 'very_low';
      revascularizationBenefit = 'low';
    } else if (combinedScore <= 4) {
      clinicalStage = 2;
      amputationRisk = 'low';
      revascularizationBenefit = ischemia >= 2 ? 'moderate' : 'low';
    } else if (combinedScore <= 6) {
      clinicalStage = 3;
      amputationRisk = 'moderate';
      revascularizationBenefit = ischemia >= 2 ? 'high' : 'moderate';
    } else if (combinedScore <= 8) {
      clinicalStage = 4;
      amputationRisk = 'high';
      revascularizationBenefit = 'high';
    } else {
      clinicalStage = 5;
      amputationRisk = 'high';
      revascularizationBenefit = 'high';
    }
    
    return {
      wound,
      ischemia,
      footInfection: infection,
      clinicalStage,
      amputationRisk,
      revascularizationBenefit,
      score: combinedScore * 5
    };
  }

  /**
   * Calculate SINBAD Score
   */
  calculateSINBADScore(
    site: 0 | 1,
    ischemia: 0 | 1,
    neuropathy: 0 | 1,
    bacterialInfection: 0 | 1,
    area: 0 | 1,
    depth: 0 | 1
  ): SINBADScore {
    const totalScore = site + ischemia + neuropathy + bacterialInfection + area + depth;
    
    let riskCategory: 'low' | 'moderate' | 'high';
    if (totalScore <= 2) {
      riskCategory = 'low';
    } else if (totalScore <= 4) {
      riskCategory = 'moderate';
    } else {
      riskCategory = 'high';
    }
    
    return {
      site,
      ischemia,
      neuropathy,
      bacterialInfection,
      area,
      depth,
      totalScore,
      riskCategory
    };
  }

  /**
   * Calculate Comorbidity Score
   */
  calculateComorbidityScore(comorbidities: Omit<Comorbidities, 'score'>): Comorbidities {
    let score = 0;
    
    // Major comorbidities (5 points each)
    if (comorbidities.dialysis) score += 15;
    if (comorbidities.congestiveHeartFailure) score += 10;
    if (comorbidities.coronaryArteryDisease) score += 8;
    if (comorbidities.cerebrovascularDisease) score += 8;
    if (comorbidities.peripheralVascularDisease) score += 10;
    if (comorbidities.previousAmputation) score += 15;
    if (comorbidities.malignancy) score += 10;
    if (comorbidities.hivAids) score += 8;
    
    // Moderate comorbidities (3 points each)
    if (comorbidities.chronicKidneyDisease && !comorbidities.dialysis) score += 5;
    if (comorbidities.hypertension) score += 3;
    if (comorbidities.immunosuppression) score += 8;
    if (comorbidities.malnutrition) score += 8;
    if (comorbidities.anemia) score += 5;
    
    // Minor comorbidities (2 points each)
    if (comorbidities.retinopathy) score += 3;
    if (comorbidities.neuropathy) score += 5;
    if (comorbidities.obesity) score += 3;
    
    // HbA1c scoring
    if (comorbidities.hba1c > 10) score += 15;
    else if (comorbidities.hba1c > 8) score += 8;
    else if (comorbidities.hba1c > 7) score += 3;
    
    // Blood sugar control
    if (comorbidities.recentBloodSugarControl === 'poor') score += 10;
    else if (comorbidities.recentBloodSugarControl === 'moderate') score += 5;
    
    return { ...comorbidities, score };
  }

  /**
   * Calculate Renal Status Score
   */
  calculateRenalScore(renal: Omit<RenalStatus, 'score' | 'ckdStage'>): RenalStatus {
    let score = 0;
    let ckdStage: 1 | 2 | 3 | 4 | 5;
    
    // CKD Stage based on eGFR
    if (renal.egfr >= 90) {
      ckdStage = 1;
      score = 0;
    } else if (renal.egfr >= 60) {
      ckdStage = 2;
      score = 5;
    } else if (renal.egfr >= 30) {
      ckdStage = 3;
      score = 15;
    } else if (renal.egfr >= 15) {
      ckdStage = 4;
      score = 25;
    } else {
      ckdStage = 5;
      score = 35;
    }
    
    // Additional points for dialysis
    if (renal.dialysisDependent) {
      score += 20;
      // More points for longer dialysis vintage
      if (renal.dialysisVintage && renal.dialysisVintage > 36) {
        score += 10;
      } else if (renal.dialysisVintage && renal.dialysisVintage > 12) {
        score += 5;
      }
    }
    
    return { ...renal, score, ckdStage };
  }

  /**
   * Calculate Sepsis Score
   */
  calculateSepsisScore(sepsis: Omit<SepsisAssessment, 'score' | 'sirsScore' | 'qsofaScore' | 'sepsisLikelihood'>): SepsisAssessment {
    // Calculate SIRS score
    let sirsScore = 0;
    if (sepsis.temperature > 38 || sepsis.temperature < 36) sirsScore++;
    if (sepsis.heartRate > 90) sirsScore++;
    if (sepsis.respiratoryRate > 20) sirsScore++;
    if (sepsis.wbc > 12 || sepsis.wbc < 4) sirsScore++;
    
    // Calculate qSOFA score
    let qsofaScore = 0;
    if (sepsis.alteredMentation) qsofaScore++;
    if (sepsis.systolicBP < 100) qsofaScore++;
    if (sepsis.respiratoryRate >= 22) qsofaScore++;
    
    // Determine sepsis likelihood
    let sepsisLikelihood: 'unlikely' | 'possible' | 'probable' | 'definite';
    if (sirsScore >= 2 && qsofaScore >= 2) {
      sepsisLikelihood = 'definite';
    } else if (sirsScore >= 2 || qsofaScore >= 2) {
      sepsisLikelihood = 'probable';
    } else if (sirsScore === 1 || qsofaScore === 1) {
      sepsisLikelihood = 'possible';
    } else {
      sepsisLikelihood = 'unlikely';
    }
    
    // Calculate total score
    let score = 0;
    score += sirsScore * 5;
    score += qsofaScore * 10;
    
    // Clinical signs
    if (sepsis.crepitus) score += 20; // Gas gangrene sign
    if (sepsis.foulSmell) score += 10;
    if (sepsis.purulentDischarge) score += 5;
    if (sepsis.lymphangitis) score += 8;
    if (sepsis.localCellulitis) score += 5;
    
    // Laboratory markers
    if (sepsis.crp > 100) score += 15;
    else if (sepsis.crp > 50) score += 10;
    else if (sepsis.crp > 20) score += 5;
    
    if (sepsis.procalcitonin && sepsis.procalcitonin > 2) score += 20;
    else if (sepsis.procalcitonin && sepsis.procalcitonin > 0.5) score += 10;
    
    if (sepsis.lactate && sepsis.lactate > 4) score += 25;
    else if (sepsis.lactate && sepsis.lactate > 2) score += 15;
    
    return { ...sepsis, score, sirsScore, qsofaScore, sepsisLikelihood };
  }

  /**
   * Calculate Arterial Doppler Score
   */
  calculateArterialScore(arterial: Omit<ArterialDopplerFindings, 'score' | 'interpretation'>): ArterialDopplerFindings {
    let score = 0;
    let interpretation = '';
    
    // ABI scoring
    const abi = arterial.affectedSideABI;
    if (abi < 0.4) {
      score += 40;
      interpretation = 'Severe arterial insufficiency - critical limb ischemia';
    } else if (abi < 0.6) {
      score += 25;
      interpretation = 'Moderate-severe arterial insufficiency';
    } else if (abi < 0.8) {
      score += 15;
      interpretation = 'Moderate arterial insufficiency';
    } else if (abi < 0.9) {
      score += 5;
      interpretation = 'Mild arterial insufficiency';
    } else if (abi > 1.3) {
      score += 20; // Non-compressible vessels (calcification)
      interpretation = 'Incompressible vessels - unreliable ABI, consider toe pressures';
    } else {
      interpretation = 'Normal arterial circulation';
    }
    
    // Waveform scoring
    switch (arterial.waveformType) {
      case 'absent': score += 30; break;
      case 'monophasic': score += 20; break;
      case 'biphasic': score += 10; break;
      case 'triphasic': break;
    }
    
    // Vessel status
    if (arterial.dorsalisPedis === 'absent') score += 10;
    else if (arterial.dorsalisPedis === 'reduced') score += 5;
    
    if (arterial.posteriorTibial === 'absent') score += 10;
    else if (arterial.posteriorTibial === 'reduced') score += 5;
    
    // Stenosis
    if (arterial.stenosisPresent) {
      switch (arterial.stenosisSeverity) {
        case 'occlusion': score += 25; break;
        case 'severe': score += 15; break;
        case 'moderate': score += 10; break;
        case 'mild': score += 5; break;
      }
    }
    
    // Calcification
    if (arterial.vesselCalcification) score += 10;
    if (arterial.incompressibleVessels) score += 15;
    
    // Toe pressure
    if (arterial.toePressure !== undefined) {
      if (arterial.toePressure < 30) score += 30;
      else if (arterial.toePressure < 50) score += 15;
      else if (arterial.toePressure < 70) score += 5;
    }
    
    return { ...arterial, score, interpretation };
  }

  /**
   * Calculate Venous Doppler Score
   */
  calculateVenousScore(venous: Omit<VenousDopplerFindings, 'score'>): VenousDopplerFindings {
    let score = 0;
    
    if (venous.dvtPresent) score += 20;
    if (venous.chronicVenousInsufficiency) score += 10;
    if (venous.venousReflux) score += 5;
    if (venous.varicoseVeins) score += 3;
    if (venous.postPhlebiticSyndrome) score += 15;
    
    // Edema scoring
    score += venous.edemaGrade * 3;
    
    return { ...venous, score };
  }

  /**
   * Calculate Osteomyelitis Score
   */
  calculateOsteomyelitisScore(osteo: Omit<OsteomyelitisAssessment, 'score' | 'osteomyelitisLikelihood'>): OsteomyelitisAssessment {
    let score = 0;
    let likelihood: 'unlikely' | 'possible' | 'probable' | 'confirmed' = 'unlikely';
    
    // Clinical findings
    if (osteo.probeTosBone) {
      score += 25;
      likelihood = 'probable';
    }
    if (osteo.visibleBone) {
      score += 30;
      likelihood = 'probable';
    }
    if (osteo.sausageToe) score += 15;
    
    // Imaging
    if (osteo.xrayFindings === 'definite') {
      score += 30;
      likelihood = 'probable';
    } else if (osteo.xrayFindings === 'suspicious') {
      score += 15;
    }
    
    if (osteo.mriFinding === 'positive') {
      score += 40;
      likelihood = 'probable';
    } else if (osteo.mriFinding === 'suspicious') {
      score += 20;
    }
    
    if (osteo.boneScintgraphyResult === 'positive') score += 15;
    
    // Biopsy (gold standard)
    if (osteo.boneBiopsyResult === 'positive') {
      score += 50;
      likelihood = 'confirmed';
    } else if (osteo.boneBiopsyResult === 'negative') {
      likelihood = 'unlikely';
    }
    
    // Laboratory
    if (osteo.esr && osteo.esr > 70) score += 15;
    else if (osteo.esr && osteo.esr > 40) score += 10;
    
    if (osteo.crp && osteo.crp > 50) score += 10;
    
    // Duration and treatment history
    if (osteo.ulcerDuration > 12) score += 15;
    else if (osteo.ulcerDuration > 6) score += 10;
    else if (osteo.ulcerDuration > 4) score += 5;
    
    if (osteo.previousAntibioticCourses > 2) score += 10;
    
    return { ...osteo, score, osteomyelitisLikelihood: likelihood };
  }

  /**
   * Calculate Demographics Score
   */
  calculateDemographicsScore(demographics: PatientDemographics): number {
    let score = 0;
    
    // Age scoring
    if (demographics.age > 80) score += 20;
    else if (demographics.age > 70) score += 15;
    else if (demographics.age > 60) score += 10;
    else if (demographics.age > 50) score += 5;
    
    // Gender (males slightly higher risk)
    if (demographics.gender === 'male') score += 3;
    
    // Diabetes duration
    if (demographics.diabetesDuration > 20) score += 15;
    else if (demographics.diabetesDuration > 10) score += 10;
    else if (demographics.diabetesDuration > 5) score += 5;
    
    // Smoking
    if (demographics.smokingStatus === 'current') score += 20;
    else if (demographics.smokingStatus === 'former') score += 10;
    
    // Ambulatory status
    if (demographics.ambulatoryStatus === 'non-ambulatory') score += 20;
    else if (demographics.ambulatoryStatus === 'limited') score += 10;
    
    return score;
  }

  /**
   * Calculate Total Score and Risk Category
   */
  calculateTotalScore(assessment: Partial<DiabeticFootAssessment>): {
    totalScore: number;
    riskCategory: RiskCategory;
    limbSalvageProbability: number;
  } {
    let totalScore = 0;
    
    // Sum all component scores
    if (assessment.wagnerGrade) totalScore += assessment.wagnerGrade.score;
    if (assessment.texasClassification) totalScore += assessment.texasClassification.score;
    if (assessment.wifiClassification) totalScore += assessment.wifiClassification.score;
    if (assessment.comorbidities) totalScore += assessment.comorbidities.score;
    if (assessment.renalStatus) totalScore += assessment.renalStatus.score;
    if (assessment.sepsisAssessment) totalScore += assessment.sepsisAssessment.score;
    if (assessment.arterialDoppler) totalScore += assessment.arterialDoppler.score;
    if (assessment.venousDoppler) totalScore += assessment.venousDoppler.score;
    if (assessment.osteomyelitis) totalScore += assessment.osteomyelitis.score;
    if (assessment.demographics) totalScore += this.calculateDemographicsScore(assessment.demographics);
    
    // Determine risk category
    let riskCategory: RiskCategory;
    let limbSalvageProbability: number;
    
    if (totalScore < 50) {
      riskCategory = 'low_risk_limb_salvage_likely';
      limbSalvageProbability = 90;
    } else if (totalScore < 100) {
      riskCategory = 'moderate_risk_limb_salvage_possible';
      limbSalvageProbability = 70;
    } else if (totalScore < 200) {
      riskCategory = 'high_risk_consider_amputation';
      limbSalvageProbability = 40;
    } else {
      riskCategory = 'critical_amputation_recommended';
      limbSalvageProbability = 15;
    }
    
    return { totalScore, riskCategory, limbSalvageProbability };
  }

  /**
   * Generate Recommendations based on assessment
   */
  generateRecommendations(assessment: DiabeticFootAssessment): {
    recommendedIntervention: RecommendedIntervention;
    detailedRecommendations: string[];
    monitoringPlan: MonitoringPlan;
  } {
    const recommendations: string[] = [];
    let recommendedIntervention: RecommendedIntervention = 'conservative_management';
    
    // Determine intervention based on score and specific findings
    const { totalScore, riskCategory } = this.calculateTotalScore(assessment);
    
    // Critical sepsis - urgent intervention needed
    if (assessment.sepsisAssessment?.sepsisLikelihood === 'definite' || 
        assessment.sepsisAssessment?.crepitus) {
      recommendations.push('🚨 URGENT: Systemic sepsis detected - requires immediate surgical intervention');
      recommendations.push('Initiate broad-spectrum IV antibiotics immediately (cover gram-positive, gram-negative, and anaerobes)');
      recommendations.push('Consider emergent debridement or amputation based on extent of necrosis');
      
      if (assessment.wagnerGrade?.grade === 5) {
        recommendedIntervention = 'above_knee_amputation';
        recommendations.push('Wagner Grade 5 with sepsis: Consider above-knee amputation for life-saving intervention');
      } else if (assessment.wagnerGrade?.grade === 4) {
        recommendedIntervention = 'below_knee_amputation';
        recommendations.push('Wagner Grade 4 with sepsis: Below-knee amputation recommended');
      }
    }
    
    // Extensive gangrene
    if (assessment.wagnerGrade?.grade === 5) {
      recommendedIntervention = 'above_knee_amputation';
      recommendations.push('Wagner Grade 5 (extensive gangrene): Above-knee amputation is typically required');
      recommendations.push('Evaluate for vascular disease to determine amputation level healing potential');
    } else if (assessment.wagnerGrade?.grade === 4) {
      // Check if revascularization could help
      if (assessment.arterialDoppler?.affectedSideABI && assessment.arterialDoppler.affectedSideABI > 0.5 &&
          assessment.arterialDoppler.waveformType !== 'absent') {
        recommendedIntervention = 'transmetatarsal_amputation';
        recommendations.push('Wagner Grade 4 with preserved arterial flow: Consider transmetatarsal amputation');
        recommendations.push('Aggressive wound care and possible revascularization may preserve more limb length');
      } else {
        recommendedIntervention = 'below_knee_amputation';
        recommendations.push('Wagner Grade 4 with poor arterial flow: Below-knee amputation recommended');
      }
    }
    
    // Osteomyelitis management
    if (assessment.osteomyelitis?.osteomyelitisLikelihood === 'confirmed' ||
        assessment.osteomyelitis?.osteomyelitisLikelihood === 'probable') {
      recommendations.push('Osteomyelitis confirmed/probable: 6-week course of targeted IV antibiotics required');
      recommendations.push('Consider bone biopsy for culture and sensitivity if not already done');
      
      if (assessment.osteomyelitis.probeTosBone && assessment.wagnerGrade?.grade && assessment.wagnerGrade.grade <= 3) {
        if (recommendedIntervention === 'conservative_management') {
          recommendedIntervention = 'ray_amputation';
        }
        recommendations.push('Probe-to-bone positive: Ray amputation of affected digit(s) may be required');
      }
    }
    
    // Ischemia management
    if (assessment.arterialDoppler?.affectedSideABI && assessment.arterialDoppler.affectedSideABI < 0.5) {
      recommendations.push('Critical limb ischemia detected (ABI < 0.5)');
      recommendations.push('Urgent vascular surgery consultation for revascularization assessment');
      recommendations.push('Consider angiography to evaluate revascularization options');
      
      if (assessment.wifiClassification?.revascularizationBenefit === 'high') {
        recommendedIntervention = 'revascularization_first';
        recommendations.push('WIfI assessment suggests high benefit from revascularization - prioritize arterial reconstruction');
      }
    }
    
    // Renal considerations
    if (assessment.renalStatus?.dialysisDependent) {
      recommendations.push('⚠️ Dialysis-dependent patient: Higher surgical risk, delayed healing expected');
      recommendations.push('Consider aggressive revascularization if feasible - dialysis patients have poor outcomes with major amputation');
      recommendations.push('Coordinate timing with dialysis schedule');
      recommendations.push('Monitor for volume overload and electrolyte abnormalities');
    }
    
    // Conservative management criteria
    if (riskCategory === 'low_risk_limb_salvage_likely' && recommendedIntervention === 'conservative_management') {
      recommendations.push('Low-risk assessment: Conservative management with close monitoring appropriate');
      recommendations.push('Implement total contact casting or offloading device');
      recommendations.push('Weekly wound assessment with standardized photography');
      recommendations.push('Optimize glycemic control (target HbA1c < 7%)');
    }
    
    // Wound care recommendations
    if (assessment.wagnerGrade?.grade && assessment.wagnerGrade.grade >= 2) {
      recommendedIntervention = recommendedIntervention === 'conservative_management' ? 'wound_care_debridement' : recommendedIntervention;
      recommendations.push('Serial debridement of necrotic tissue recommended');
      recommendations.push('Consider negative pressure wound therapy (NPWT) for complex wounds');
      recommendations.push('Advanced wound dressings: Consider collagen matrix, growth factors, or bioengineered skin');
    }
    
    // Lifestyle modifications
    recommendations.push('Absolute smoking cessation required - counsel on nicotine replacement therapy');
    recommendations.push('Nutritional optimization: Ensure adequate protein intake (1.5g/kg/day) and micronutrients');
    recommendations.push('Blood glucose optimization: Aim for fasting glucose 80-130 mg/dL');
    
    // Generate monitoring plan
    const monitoringPlan = this.generateMonitoringPlan(assessment, riskCategory);
    
    return {
      recommendedIntervention,
      detailedRecommendations: recommendations,
      monitoringPlan
    };
  }

  /**
   * Generate Monitoring Plan
   */
  generateMonitoringPlan(assessment: DiabeticFootAssessment, riskCategory: RiskCategory): MonitoringPlan {
    const plan: MonitoringPlan = {
      followUpFrequency: '',
      requiredTests: [],
      woundCareProtocol: [],
      offloadingRecommendations: [],
      nutritionalSupport: [],
      glycemicControl: [],
      vasculaConsult: false,
      infectedDiseaseConsult: false,
      nephologyConsult: false,
      rehabilitationPlan: []
    };
    
    // Set follow-up frequency based on risk
    switch (riskCategory) {
      case 'critical_amputation_recommended':
        plan.followUpFrequency = 'Daily until stable, then every 2-3 days';
        break;
      case 'high_risk_consider_amputation':
        plan.followUpFrequency = 'Every 2-3 days for first 2 weeks, then weekly';
        break;
      case 'moderate_risk_limb_salvage_possible':
        plan.followUpFrequency = 'Weekly for first month, then bi-weekly';
        break;
      case 'low_risk_limb_salvage_likely':
        plan.followUpFrequency = 'Bi-weekly for first month, then monthly';
        break;
    }
    
    // Required tests
    plan.requiredTests = [
      'Weekly: CBC, CMP, Glucose',
      'Weekly: CRP/ESR (if infection suspected)',
      'Monthly: HbA1c',
      'As needed: Procalcitonin, Lactate, Blood cultures'
    ];
    
    if (assessment.renalStatus?.ckdStage && assessment.renalStatus.ckdStage >= 3) {
      plan.requiredTests.push('Weekly: Renal function panel');
      plan.nephologyConsult = true;
    }
    
    // Wound care protocol
    plan.woundCareProtocol = [
      'Daily wound assessment and dressing changes',
      'Standardized wound photography weekly',
      'Debridement of necrotic tissue as needed',
      'Moist wound healing environment'
    ];
    
    if (assessment.wagnerGrade?.grade && assessment.wagnerGrade.grade >= 3) {
      plan.woundCareProtocol.push('Consider NPWT for deep wounds');
      plan.woundCareProtocol.push('Surgical debridement in OR if extensive');
    }
    
    // Offloading
    plan.offloadingRecommendations = [
      'Total contact cast or removable cast walker',
      'Custom therapeutic footwear after healing',
      'Avoid weight bearing on affected foot',
      'Wheelchair or crutches for mobility'
    ];
    
    // Nutritional support
    plan.nutritionalSupport = [
      'High protein diet: 1.5g/kg/day minimum',
      'Vitamin C: 500mg twice daily',
      'Zinc: 220mg daily',
      'Consider protein supplements if intake inadequate'
    ];
    
    if (assessment.comorbidities?.malnutrition) {
      plan.nutritionalSupport.push('Nutrition consult for enteral/parenteral support evaluation');
    }
    
    // Glycemic control
    plan.glycemicControl = [
      'Blood glucose monitoring 4 times daily',
      'Target fasting glucose: 80-130 mg/dL',
      'Target HbA1c: < 7%',
      'Avoid hypoglycemia (< 70 mg/dL)'
    ];
    
    if (assessment.comorbidities?.hba1c && assessment.comorbidities.hba1c > 9) {
      plan.glycemicControl.push('Endocrinology consult for intensive insulin management');
    }
    
    // Consults
    if (assessment.arterialDoppler?.affectedSideABI && assessment.arterialDoppler.affectedSideABI < 0.7) {
      plan.vasculaConsult = true;
    }
    
    if (assessment.sepsisAssessment?.sepsisLikelihood === 'probable' ||
        assessment.sepsisAssessment?.sepsisLikelihood === 'definite' ||
        assessment.osteomyelitis?.osteomyelitisLikelihood === 'confirmed') {
      plan.infectedDiseaseConsult = true;
      plan.antibioticTherapy = 'IV antibiotics per ID recommendations - typical duration 4-6 weeks for osteomyelitis';
    }
    
    // Rehabilitation
    plan.rehabilitationPlan = [
      'Physical therapy for mobility and strength',
      'Occupational therapy for ADL modifications',
      'Prosthetic evaluation if amputation performed',
      'Fall prevention education'
    ];
    
    return plan;
  }

  /**
   * Get Risk Category Display
   */
  getRiskCategoryDisplay(category: RiskCategory): { label: string; color: string; icon: string } {
    switch (category) {
      case 'low_risk_limb_salvage_likely':
        return { label: 'Low Risk - Limb Salvage Likely', color: 'green', icon: '✅' };
      case 'moderate_risk_limb_salvage_possible':
        return { label: 'Moderate Risk - Limb Salvage Possible', color: 'yellow', icon: '⚠️' };
      case 'high_risk_consider_amputation':
        return { label: 'High Risk - Consider Amputation', color: 'orange', icon: '🔶' };
      case 'critical_amputation_recommended':
        return { label: 'Critical - Amputation Recommended', color: 'red', icon: '🚨' };
    }
  }

  /**
   * Get Intervention Display
   */
  getInterventionDisplay(intervention: RecommendedIntervention): { label: string; description: string } {
    const interventions: Record<RecommendedIntervention, { label: string; description: string }> = {
      'conservative_management': {
        label: 'Conservative Management',
        description: 'Wound care, offloading, antibiotics, and close monitoring'
      },
      'wound_care_debridement': {
        label: 'Wound Care & Debridement',
        description: 'Aggressive wound care with serial debridement'
      },
      'revascularization_first': {
        label: 'Revascularization First',
        description: 'Prioritize arterial revascularization before definitive wound management'
      },
      'ray_amputation': {
        label: 'Ray Amputation',
        description: 'Amputation of individual toe(s) with metatarsal head'
      },
      'transmetatarsal_amputation': {
        label: 'Transmetatarsal Amputation (TMA)',
        description: 'Amputation through the metatarsal bones, preserving the heel'
      },
      'below_knee_amputation': {
        label: 'Below-Knee Amputation (BKA)',
        description: 'Amputation below the knee joint, preserving knee function'
      },
      'above_knee_amputation': {
        label: 'Above-Knee Amputation (AKA)',
        description: 'Amputation above the knee joint'
      },
      'palliative_care': {
        label: 'Palliative Care',
        description: 'Comfort-focused care for patients not candidates for intervention'
      }
    };
    
    return interventions[intervention];
  }

  // ================== DATABASE OPERATIONS ==================

  /**
   * Save a diabetic foot assessment to the database
   */
  async saveAssessment(assessment: DiabeticFootAssessment): Promise<DiabeticFootAssessment> {
    try {
      const { db } = await import('../db/database');
      
      const dataToSave = {
        ...assessment,
        // Flatten for database storage
        patient_id: assessment.patientId,
        assessment_date: assessment.assessmentDate,
        assessed_by: assessment.assessedBy,
        wagner_grade: assessment.wagnerGrade?.grade,
        texas_grade: assessment.texasClassification?.grade,
        texas_stage: assessment.texasClassification?.stage,
        wifi_wound: assessment.wifiClassification?.wound,
        wifi_ischemia: assessment.wifiClassification?.ischemia,
        wifi_infection: assessment.wifiClassification?.footInfection,
        wifi_score: assessment.wifiClassification?.score,
        total_score: assessment.totalScore,
        risk_category: assessment.riskCategory,
        limb_salvage_probability: assessment.limbSalvageProbability,
        recommended_intervention: assessment.recommendedIntervention,
        detailed_recommendations: JSON.stringify(assessment.detailedRecommendations),
        monitoring_plan: JSON.stringify(assessment.monitoringPlan),
        demographics: JSON.stringify(assessment.demographics),
        comorbidities: JSON.stringify(assessment.comorbidities),
        renal_status: JSON.stringify(assessment.renalStatus),
        sepsis_assessment: JSON.stringify(assessment.sepsisAssessment),
        arterial_doppler: JSON.stringify(assessment.arterialDoppler),
        venous_doppler: JSON.stringify(assessment.venousDoppler),
        osteomyelitis: JSON.stringify(assessment.osteomyelitis),
        sinbad_score: JSON.stringify(assessment.sinbadScore),
        notes: assessment.notes,
        status: assessment.status,
        reviewed_by: assessment.reviewedBy,
        review_date: assessment.reviewDate,
        created_at: assessment.createdAt || new Date(),
        updated_at: new Date()
      };

      if (assessment.id) {
        await db.diabetic_foot_assessments.update(assessment.id, dataToSave);
      } else {
        const id = await db.diabetic_foot_assessments.add(dataToSave);
        assessment.id = String(id);
      }
      
      return assessment;
    } catch (error) {
      console.error('Error saving diabetic foot assessment:', error);
      throw error;
    }
  }

  /**
   * Get all diabetic foot assessments
   */
  async getAllAssessments(): Promise<DiabeticFootAssessment[]> {
    try {
      const { db } = await import('../db/database');
      const records = await db.diabetic_foot_assessments.toArray();
      
      return records.map(this.mapRecordToAssessment);
    } catch (error) {
      console.error('Error fetching diabetic foot assessments:', error);
      throw error;
    }
  }

  /**
   * Get assessments for a specific patient
   */
  async getPatientAssessments(patientId: string): Promise<DiabeticFootAssessment[]> {
    try {
      const { db } = await import('../db/database');
      const records = await db.diabetic_foot_assessments
        .where('patient_id')
        .equals(patientId)
        .toArray();
      
      return records.map(this.mapRecordToAssessment);
    } catch (error) {
      console.error('Error fetching patient diabetic foot assessments:', error);
      throw error;
    }
  }

  /**
   * Get a single assessment by ID
   */
  async getAssessment(id: string): Promise<DiabeticFootAssessment | null> {
    try {
      const { db } = await import('../db/database');
      const record = await db.diabetic_foot_assessments.get(Number(id));
      
      if (!record) return null;
      
      return this.mapRecordToAssessment(record);
    } catch (error) {
      console.error('Error fetching diabetic foot assessment:', error);
      throw error;
    }
  }

  /**
   * Delete an assessment
   */
  async deleteAssessment(id: string): Promise<void> {
    try {
      const { db } = await import('../db/database');
      await db.diabetic_foot_assessments.delete(Number(id));
    } catch (error) {
      console.error('Error deleting diabetic foot assessment:', error);
      throw error;
    }
  }

  /**
   * Map database record to DiabeticFootAssessment
   */
  private mapRecordToAssessment(record: any): DiabeticFootAssessment {
    return {
      id: String(record.id),
      patientId: record.patient_id,
      assessmentDate: new Date(record.assessment_date),
      assessedBy: record.assessed_by,
      demographics: record.demographics ? JSON.parse(record.demographics) : {},
      wagnerGrade: record.wagner_grade !== undefined ? this.calculateWagnerScore(record.wagner_grade) : undefined,
      texasClassification: record.texas_grade !== undefined && record.texas_stage 
        ? this.calculateTexasScore(record.texas_grade, record.texas_stage) 
        : undefined,
      wifiClassification: record.wifi_wound !== undefined 
        ? this.calculateWIfIScore(record.wifi_wound, record.wifi_ischemia, record.wifi_infection)
        : undefined,
      sinbadScore: record.sinbad_score ? JSON.parse(record.sinbad_score) : undefined,
      comorbidities: record.comorbidities ? JSON.parse(record.comorbidities) : {},
      renalStatus: record.renal_status ? JSON.parse(record.renal_status) : {},
      sepsisAssessment: record.sepsis_assessment ? JSON.parse(record.sepsis_assessment) : {},
      arterialDoppler: record.arterial_doppler ? JSON.parse(record.arterial_doppler) : {},
      venousDoppler: record.venous_doppler ? JSON.parse(record.venous_doppler) : {},
      osteomyelitis: record.osteomyelitis ? JSON.parse(record.osteomyelitis) : {},
      totalScore: record.total_score,
      riskCategory: record.risk_category,
      limbSalvageProbability: record.limb_salvage_probability,
      recommendedIntervention: record.recommended_intervention,
      detailedRecommendations: record.detailed_recommendations ? JSON.parse(record.detailed_recommendations) : [],
      monitoringPlan: record.monitoring_plan ? JSON.parse(record.monitoring_plan) : {},
      status: record.status,
      reviewedBy: record.reviewed_by,
      reviewDate: record.review_date ? new Date(record.review_date) : undefined,
      notes: record.notes,
      createdAt: new Date(record.created_at),
      updatedAt: new Date(record.updated_at)
    } as DiabeticFootAssessment;
  }
}

export const diabeticFootService = new DiabeticFootService();
