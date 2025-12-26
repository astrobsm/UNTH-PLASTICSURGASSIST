/**
 * Burn Care Protocol Service
 * 
 * Comprehensive burn care management based on:
 * - WHO Standards & Recommendations for Burns Care (2024)
 * - ISBI Practice Guidelines for Burn Care
 * - American Burn Association Burn Shock/Resuscitation Guidance (2023)
 * - Parkland Formula / Modified Brooke
 */

import { v4 as uuidv4 } from 'uuid';

// ================== INTERFACES ==================

export interface BurnPatient {
  id: string;
  patientId: string;
  admissionDate: Date;
  timeOfBurn: Date;
  mechanism: BurnMechanism;
  
  // TBSA Assessment
  tbsaAssessment: TBSAAssessment;
  
  // Scores
  bauxScore: number;
  revisedBauxScore: number;
  absiScore: ABSIScore;
  
  // Inhalation Injury
  inhalationInjury: InhalationInjuryAssessment;
  
  // Patient Demographics
  age: number;
  weight: number; // kg
  gender: 'male' | 'female';
  
  // Resuscitation
  resuscitation: ResuscitationPlan;
  
  // Monitoring
  monitoring: BurnMonitoring;
  
  // Alerts
  activeAlerts: BurnAlert[];
  
  // Status
  status: 'active' | 'discharged' | 'deceased' | 'transferred';
  disposition: 'ward' | 'icu' | 'burn_center' | 'outpatient';
  
  // Metadata
  tetanusStatus: 'current' | 'needs_update' | 'unknown';
  createdAt: Date;
  updatedAt: Date;
}

export type BurnMechanism = 'flame' | 'scald' | 'chemical' | 'electrical' | 'contact' | 'radiation' | 'friction';

export type BurnDepth = 'superficial' | 'superficial_partial' | 'deep_partial' | 'full_thickness';

// ================== TBSA ASSESSMENT ==================

export interface TBSAAssessment {
  method: 'lund_browder' | 'rule_of_nines' | 'palm_method';
  totalTBSA: number;
  regions: TBSARegion[];
  assessmentDate: Date;
  assessedBy: string;
}

export interface TBSARegion {
  region: AnatomicalRegion;
  percentBurned: number;
  depth: BurnDepth;
  isCircumferential: boolean;
}

export type AnatomicalRegion = 
  | 'head_anterior' | 'head_posterior'
  | 'neck_anterior' | 'neck_posterior'
  | 'trunk_anterior' | 'trunk_posterior'
  | 'right_arm_anterior' | 'right_arm_posterior'
  | 'left_arm_anterior' | 'left_arm_posterior'
  | 'right_hand' | 'left_hand'
  | 'genitalia'
  | 'right_thigh_anterior' | 'right_thigh_posterior'
  | 'left_thigh_anterior' | 'left_thigh_posterior'
  | 'right_leg_anterior' | 'right_leg_posterior'
  | 'left_leg_anterior' | 'left_leg_posterior'
  | 'right_foot' | 'left_foot';

// Lund-Browder chart percentages by age group
export const LUND_BROWDER_CHART: Record<AnatomicalRegion, Record<string, number>> = {
  'head_anterior': { '0-1': 9.5, '1-4': 8.5, '5-9': 6.5, '10-14': 5.5, '15+': 4.5 },
  'head_posterior': { '0-1': 9.5, '1-4': 8.5, '5-9': 6.5, '10-14': 5.5, '15+': 4.5 },
  'neck_anterior': { '0-1': 1, '1-4': 1, '5-9': 1, '10-14': 1, '15+': 1 },
  'neck_posterior': { '0-1': 1, '1-4': 1, '5-9': 1, '10-14': 1, '15+': 1 },
  'trunk_anterior': { '0-1': 13, '1-4': 13, '5-9': 13, '10-14': 13, '15+': 13 },
  'trunk_posterior': { '0-1': 13, '1-4': 13, '5-9': 13, '10-14': 13, '15+': 13 },
  'right_arm_anterior': { '0-1': 2, '1-4': 2, '5-9': 2, '10-14': 2, '15+': 2 },
  'right_arm_posterior': { '0-1': 2, '1-4': 2, '5-9': 2, '10-14': 2, '15+': 2 },
  'left_arm_anterior': { '0-1': 2, '1-4': 2, '5-9': 2, '10-14': 2, '15+': 2 },
  'left_arm_posterior': { '0-1': 2, '1-4': 2, '5-9': 2, '10-14': 2, '15+': 2 },
  'right_hand': { '0-1': 1.25, '1-4': 1.25, '5-9': 1.25, '10-14': 1.25, '15+': 1.25 },
  'left_hand': { '0-1': 1.25, '1-4': 1.25, '5-9': 1.25, '10-14': 1.25, '15+': 1.25 },
  'genitalia': { '0-1': 1, '1-4': 1, '5-9': 1, '10-14': 1, '15+': 1 },
  'right_thigh_anterior': { '0-1': 2.75, '1-4': 3.25, '5-9': 4, '10-14': 4.25, '15+': 4.75 },
  'right_thigh_posterior': { '0-1': 2.75, '1-4': 3.25, '5-9': 4, '10-14': 4.25, '15+': 4.75 },
  'left_thigh_anterior': { '0-1': 2.75, '1-4': 3.25, '5-9': 4, '10-14': 4.25, '15+': 4.75 },
  'left_thigh_posterior': { '0-1': 2.75, '1-4': 3.25, '5-9': 4, '10-14': 4.25, '15+': 4.75 },
  'right_leg_anterior': { '0-1': 2.5, '1-4': 2.5, '5-9': 2.75, '10-14': 3, '15+': 3.5 },
  'right_leg_posterior': { '0-1': 2.5, '1-4': 2.5, '5-9': 2.75, '10-14': 3, '15+': 3.5 },
  'left_leg_anterior': { '0-1': 2.5, '1-4': 2.5, '5-9': 2.75, '10-14': 3, '15+': 3.5 },
  'left_leg_posterior': { '0-1': 2.5, '1-4': 2.5, '5-9': 2.75, '10-14': 3, '15+': 3.5 },
  'right_foot': { '0-1': 1.75, '1-4': 1.75, '5-9': 1.75, '10-14': 1.75, '15+': 1.75 },
  'left_foot': { '0-1': 1.75, '1-4': 1.75, '5-9': 1.75, '10-14': 1.75, '15+': 1.75 },
};

// Rule of Nines (Adults)
export const RULE_OF_NINES_ADULT: Record<string, number> = {
  'head_neck': 9,
  'anterior_trunk': 18,
  'posterior_trunk': 18,
  'each_arm': 9,
  'each_leg': 18,
  'genitalia': 1,
};

// ================== INHALATION INJURY ==================

export interface InhalationInjuryAssessment {
  suspected: boolean;
  confirmed: boolean;
  signs: {
    facialBurn: boolean;
    singedNasalHairs: boolean;
    carbonaceousSputum: boolean;
    hoarseness: boolean;
    stridorOrWheezing: boolean;
    enclosedSpaceBurn: boolean;
    alteredConsciousness: boolean;
  };
  bronchoscopyPerformed: boolean;
  bronchoscopyGrade?: 0 | 1 | 2 | 3 | 4; // Abbreviated Injury Score
  intubated: boolean;
  intubationDate?: Date;
}

// ================== ABSI SCORE ==================

export interface ABSIScore {
  agePoints: number;
  sexPoints: number;
  tbsaPoints: number;
  fullThicknessPoints: number;
  inhalationInjuryPoints: number;
  totalScore: number;
  mortalityRisk: string;
}

// ================== RESUSCITATION ==================

export interface ResuscitationPlan {
  protocol: 'parkland' | 'modified_brooke' | 'custom';
  fluidType: 'lactated_ringers' | 'normal_saline' | 'plasmalyte';
  
  // Calculated volumes
  totalVolume24h: number; // mL
  firstHalfVolume: number; // mL (first 8 hours from burn time)
  secondHalfVolume: number; // mL (next 16 hours)
  
  // Current status
  currentRate: number; // mL/hr
  volumeGiven: number; // mL
  remainingVolume: number; // mL
  
  // Timing
  resuscitationStartTime: Date;
  firstHalfEndTime: Date;
  resuscitationEndTime: Date;
  
  // Adjustments
  rateAdjustments: FluidRateAdjustment[];
  
  // Targets
  urineOutputTarget: { min: number; max: number }; // mL/kg/hr
}

export interface FluidRateAdjustment {
  timestamp: Date;
  previousRate: number;
  newRate: number;
  reason: string;
  adjustedBy: string;
  urineOutputTrigger?: number;
}

// ================== MONITORING ==================

export interface BurnMonitoring {
  vitals: VitalSign[];
  urineOutputs: UrineOutput[];
  fluidBalance: FluidBalance;
  labs: LabResult[];
  woundAssessments: WoundAssessment[];
  painScores: PainScore[];
}

export interface VitalSign {
  id: string;
  timestamp: Date;
  heartRate: number;
  systolicBP: number;
  diastolicBP: number;
  map: number;
  respiratoryRate: number;
  spo2: number;
  temperature: number;
  gcs?: number;
  recordedBy: string;
}

export interface UrineOutput {
  id: string;
  timestamp: Date;
  volumeML: number;
  mlPerKgPerHr: number;
  color: 'clear' | 'yellow' | 'dark_yellow' | 'amber' | 'cola' | 'bloody';
  recordedBy: string;
}

export interface FluidBalance {
  inputs: FluidInput[];
  outputs: FluidOutput[];
  cumulative24h: number;
  cumulative48h: number;
  cumulativeTotal: number;
}

export interface FluidInput {
  id: string;
  timestamp: Date;
  type: 'crystalloid' | 'colloid' | 'blood_product' | 'enteral' | 'oral' | 'medication';
  volumeML: number;
  fluidName: string;
  recordedBy: string;
}

export interface FluidOutput {
  id: string;
  timestamp: Date;
  type: 'urine' | 'ng_aspirate' | 'drain' | 'stool' | 'emesis' | 'insensible' | 'wound';
  volumeML: number;
  recordedBy: string;
}

export interface LabResult {
  id: string;
  timestamp: Date;
  type: string;
  value: number;
  unit: string;
  isAbnormal: boolean;
  criticalFlag: boolean;
}

export interface WoundAssessment {
  id: string;
  timestamp: Date;
  region: AnatomicalRegion;
  appearance: string;
  exudate: 'none' | 'minimal' | 'moderate' | 'heavy';
  odor: boolean;
  signOfInfection: boolean;
  graftTakePercent?: number;
  dressingChanged: boolean;
  assessedBy: string;
  notes: string;
}

export interface PainScore {
  id: string;
  timestamp: Date;
  score: number; // 0-10
  location: string;
  intervention?: string;
  recordedBy: string;
}

// ================== ALERTS ==================

export interface BurnAlert {
  id: string;
  type: BurnAlertType;
  severity: 'info' | 'warning' | 'critical' | 'emergency';
  message: string;
  criteria: string;
  suggestedAction: string;
  orderSetId?: string;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  status: 'open' | 'acknowledged' | 'resolved';
}

export type BurnAlertType = 
  | 'low_urine_output'
  | 'high_urine_output'
  | 'hypotension'
  | 'tachycardia'
  | 'fever'
  | 'hypothermia'
  | 'hypoxia'
  | 'aki_risk'
  | 'sepsis_suspected'
  | 'rhabdomyolysis'
  | 'compartment_syndrome'
  | 'anemia'
  | 'hyperkalemia'
  | 'fluid_overload'
  | 'missed_documentation';

// ================== THRESHOLDS ==================

export const BURN_ALERT_THRESHOLDS = {
  vitals: {
    hrHigh: 120,
    hrLow: 50,
    mapLow: 65,
    rrHigh: 25,
    rrLow: 8,
    spo2Low: 90,
    tempHigh: 38.0,
    tempLow: 36.0,
  },
  urineOutput: {
    adultLow: 0.5, // mL/kg/hr
    adultHigh: 1.0,
    childLow: 1.0,
    childHigh: 1.5,
    consecutiveHoursForAlert: 2,
  },
  labs: {
    hbLow: 7.0, // g/dL
    creatinineRiseAKI: 0.3, // mg/dL in 48h
    kHigh: 5.5, // mmol/L
    kLow: 3.5,
    lactatehigh: 2.0, // mmol/L
    ckHigh: 1000, // U/L for rhabdomyolysis suspicion
  },
};

// ================== SERVICE CLASS ==================

class BurnCareService {
  
  /**
   * Get age group for Lund-Browder chart
   */
  getAgeGroup(age: number): string {
    if (age < 1) return '0-1';
    if (age < 5) return '1-4';
    if (age < 10) return '5-9';
    if (age < 15) return '10-14';
    return '15+';
  }

  /**
   * Calculate TBSA using Lund-Browder method
   */
  calculateTBSALundBrowder(regions: TBSARegion[], age: number): number {
    const ageGroup = this.getAgeGroup(age);
    let totalTBSA = 0;
    
    regions.forEach(region => {
      const maxPercent = LUND_BROWDER_CHART[region.region]?.[ageGroup] || 0;
      // percentBurned is the fraction of that region affected (0-100%)
      totalTBSA += (region.percentBurned / 100) * maxPercent;
    });
    
    return Math.round(totalTBSA * 10) / 10;
  }

  /**
   * Calculate TBSA using Rule of Nines (adults only)
   */
  calculateTBSARuleOfNines(regions: { area: string; percent: number }[]): number {
    let totalTBSA = 0;
    regions.forEach(region => {
      totalTBSA += region.percent;
    });
    return Math.min(100, Math.round(totalTBSA * 10) / 10);
  }

  /**
   * Calculate Baux Score
   * Baux = Age + %TBSA
   */
  calculateBauxScore(age: number, tbsa: number): number {
    return age + tbsa;
  }

  /**
   * Calculate Revised Baux Score
   * Revised Baux = Age + %TBSA + 17 (if inhalation injury)
   */
  calculateRevisedBauxScore(age: number, tbsa: number, inhalationInjury: boolean): number {
    return age + tbsa + (inhalationInjury ? 17 : 0);
  }

  /**
   * Interpret Baux/Revised Baux Score
   */
  interpretBauxScore(score: number): { mortality: string; prognosis: string } {
    if (score < 50) return { mortality: '<10%', prognosis: 'Good prognosis' };
    if (score < 75) return { mortality: '10-30%', prognosis: 'Moderate prognosis' };
    if (score < 100) return { mortality: '30-60%', prognosis: 'Guarded prognosis' };
    if (score < 130) return { mortality: '60-90%', prognosis: 'Poor prognosis' };
    return { mortality: '>90%', prognosis: 'Very poor prognosis - consider palliative care discussion' };
  }

  /**
   * Calculate ABSI (Abbreviated Burn Severity Index)
   */
  calculateABSI(
    age: number,
    gender: 'male' | 'female',
    tbsa: number,
    hasFullThickness: boolean,
    hasInhalationInjury: boolean
  ): ABSIScore {
    // Age points
    let agePoints = 0;
    if (age < 20) agePoints = 1;
    else if (age < 40) agePoints = 2;
    else if (age < 60) agePoints = 3;
    else if (age < 80) agePoints = 4;
    else agePoints = 5;

    // Sex points
    const sexPoints = gender === 'female' ? 0 : 1;

    // TBSA points
    let tbsaPoints = 0;
    if (tbsa <= 10) tbsaPoints = 1;
    else if (tbsa <= 20) tbsaPoints = 2;
    else if (tbsa <= 30) tbsaPoints = 3;
    else if (tbsa <= 40) tbsaPoints = 4;
    else if (tbsa <= 50) tbsaPoints = 5;
    else if (tbsa <= 60) tbsaPoints = 6;
    else if (tbsa <= 70) tbsaPoints = 7;
    else if (tbsa <= 80) tbsaPoints = 8;
    else if (tbsa <= 90) tbsaPoints = 9;
    else tbsaPoints = 10;

    // Full thickness points
    const fullThicknessPoints = hasFullThickness ? 1 : 0;

    // Inhalation injury points
    const inhalationInjuryPoints = hasInhalationInjury ? 1 : 0;

    const totalScore = agePoints + sexPoints + tbsaPoints + fullThicknessPoints + inhalationInjuryPoints;

    // Mortality risk interpretation
    let mortalityRisk = '';
    if (totalScore <= 2) mortalityRisk = '<1%';
    else if (totalScore <= 3) mortalityRisk = '2%';
    else if (totalScore <= 4) mortalityRisk = '3%';
    else if (totalScore <= 5) mortalityRisk = '10-20%';
    else if (totalScore <= 6) mortalityRisk = '30-50%';
    else if (totalScore <= 7) mortalityRisk = '50-70%';
    else if (totalScore <= 8) mortalityRisk = '70-80%';
    else if (totalScore <= 9) mortalityRisk = '80-90%';
    else mortalityRisk = '>90%';

    return {
      agePoints,
      sexPoints,
      tbsaPoints,
      fullThicknessPoints,
      inhalationInjuryPoints,
      totalScore,
      mortalityRisk,
    };
  }

  /**
   * Calculate Parkland Formula for fluid resuscitation
   * Total 24h fluid = 4 mL × weight (kg) × %TBSA
   * First half in first 8 hours from time of burn
   * Second half in next 16 hours
   */
  calculateParklandFormula(
    weightKg: number,
    tbsa: number,
    timeOfBurn: Date,
    currentTime: Date = new Date()
  ): ResuscitationPlan {
    const totalVolume24h = 4 * weightKg * tbsa;
    const firstHalfVolume = totalVolume24h / 2;
    const secondHalfVolume = totalVolume24h / 2;

    // Calculate timing
    const burnTime = new Date(timeOfBurn);
    const firstHalfEndTime = new Date(burnTime.getTime() + 8 * 60 * 60 * 1000);
    const resuscitationEndTime = new Date(burnTime.getTime() + 24 * 60 * 60 * 1000);

    // Calculate hours elapsed since burn
    const hoursElapsed = (currentTime.getTime() - burnTime.getTime()) / (1000 * 60 * 60);

    // Calculate current rate based on phase
    let currentRate = 0;
    let remainingVolume = totalVolume24h;

    if (hoursElapsed < 8) {
      // First 8 hours - give first half
      const hoursRemaining = 8 - hoursElapsed;
      currentRate = firstHalfVolume / hoursRemaining;
    } else if (hoursElapsed < 24) {
      // Next 16 hours - give second half
      const hoursRemaining = 24 - hoursElapsed;
      currentRate = secondHalfVolume / hoursRemaining;
    }

    return {
      protocol: 'parkland',
      fluidType: 'lactated_ringers',
      totalVolume24h: Math.round(totalVolume24h),
      firstHalfVolume: Math.round(firstHalfVolume),
      secondHalfVolume: Math.round(secondHalfVolume),
      currentRate: Math.round(currentRate),
      volumeGiven: 0,
      remainingVolume: Math.round(remainingVolume),
      resuscitationStartTime: burnTime,
      firstHalfEndTime,
      resuscitationEndTime,
      rateAdjustments: [],
      urineOutputTarget: { min: 0.5, max: 1.0 },
    };
  }

  /**
   * Calculate Modified Brooke Formula
   * Total 24h fluid = 2 mL × weight (kg) × %TBSA (less aggressive)
   */
  calculateModifiedBrookeFormula(
    weightKg: number,
    tbsa: number,
    timeOfBurn: Date
  ): ResuscitationPlan {
    const plan = this.calculateParklandFormula(weightKg, tbsa, timeOfBurn);
    
    // Modified Brooke uses 2 mL instead of 4 mL
    plan.protocol = 'modified_brooke';
    plan.totalVolume24h = Math.round(plan.totalVolume24h / 2);
    plan.firstHalfVolume = Math.round(plan.firstHalfVolume / 2);
    plan.secondHalfVolume = Math.round(plan.secondHalfVolume / 2);
    plan.currentRate = Math.round(plan.currentRate / 2);
    plan.remainingVolume = plan.totalVolume24h;

    return plan;
  }

  /**
   * Calculate urine output in mL/kg/hr
   */
  calculateUrineOutputRate(volumeML: number, weightKg: number, hoursElapsed: number = 1): number {
    return Math.round((volumeML / weightKg / hoursElapsed) * 100) / 100;
  }

  /**
   * Adjust fluid rate based on urine output
   */
  suggestFluidRateAdjustment(
    currentUrineOutput: number, // mL/kg/hr
    currentRate: number, // mL/hr
    isChild: boolean = false
  ): { newRate: number; adjustment: string; urgency: 'routine' | 'urgent' | 'emergent' } {
    const targetMin = isChild ? 1.0 : 0.5;
    const targetMax = isChild ? 1.5 : 1.0;

    if (currentUrineOutput < targetMin * 0.6) {
      // Severely low - increase by 30%
      return {
        newRate: Math.round(currentRate * 1.3),
        adjustment: 'Increase rate by 30% - severely low UO',
        urgency: 'emergent',
      };
    } else if (currentUrineOutput < targetMin) {
      // Low - increase by 20%
      return {
        newRate: Math.round(currentRate * 1.2),
        adjustment: 'Increase rate by 20% - low UO',
        urgency: 'urgent',
      };
    } else if (currentUrineOutput > targetMax * 1.5) {
      // Very high - decrease by 20%
      return {
        newRate: Math.round(currentRate * 0.8),
        adjustment: 'Decrease rate by 20% - risk of fluid overload',
        urgency: 'routine',
      };
    } else if (currentUrineOutput > targetMax) {
      // High - decrease by 10%
      return {
        newRate: Math.round(currentRate * 0.9),
        adjustment: 'Consider decreasing rate by 10% - high UO',
        urgency: 'routine',
      };
    }

    return {
      newRate: currentRate,
      adjustment: 'On target - maintain current rate',
      urgency: 'routine',
    };
  }

  /**
   * Calculate MAP from BP
   */
  calculateMAP(systolic: number, diastolic: number): number {
    return Math.round(diastolic + (systolic - diastolic) / 3);
  }

  /**
   * Calculate qSOFA score
   */
  calculateQSOFA(rr: number, systolicBP: number, alteredMentation: boolean): { score: number; interpretation: string } {
    let score = 0;
    if (rr >= 22) score++;
    if (systolicBP <= 100) score++;
    if (alteredMentation) score++;

    let interpretation = '';
    if (score >= 2) {
      interpretation = 'High risk of sepsis - consider ICU admission and sepsis workup';
    } else if (score === 1) {
      interpretation = 'Moderate risk - close monitoring advised';
    } else {
      interpretation = 'Low risk - continue routine monitoring';
    }

    return { score, interpretation };
  }

  /**
   * Generate alerts based on current vitals
   */
  generateVitalAlerts(vitals: VitalSign, patientWeight: number): BurnAlert[] {
    const alerts: BurnAlert[] = [];
    const thresholds = BURN_ALERT_THRESHOLDS.vitals;

    if (vitals.heartRate > thresholds.hrHigh) {
      alerts.push({
        id: uuidv4(),
        type: 'tachycardia',
        severity: 'warning',
        message: `Tachycardia: HR ${vitals.heartRate} bpm`,
        criteria: `HR > ${thresholds.hrHigh} bpm`,
        suggestedAction: 'Assess for pain, hypovolemia, fever, or anxiety. Consider ECG if persistent.',
        createdAt: new Date(),
        status: 'open',
      });
    }

    if (vitals.map < thresholds.mapLow) {
      alerts.push({
        id: uuidv4(),
        type: 'hypotension',
        severity: 'critical',
        message: `Hypotension: MAP ${vitals.map} mmHg`,
        criteria: `MAP < ${thresholds.mapLow} mmHg`,
        suggestedAction: 'Increase fluid rate. If not responding, consider vasopressors and ICU transfer.',
        createdAt: new Date(),
        status: 'open',
      });
    }

    if (vitals.spo2 < thresholds.spo2Low) {
      alerts.push({
        id: uuidv4(),
        type: 'hypoxia',
        severity: 'critical',
        message: `Hypoxia: SpO₂ ${vitals.spo2}%`,
        criteria: `SpO₂ < ${thresholds.spo2Low}%`,
        suggestedAction: 'Increase O₂, check airway, consider ABG, assess for inhalation injury or ARDS.',
        createdAt: new Date(),
        status: 'open',
      });
    }

    if (vitals.temperature > thresholds.tempHigh) {
      alerts.push({
        id: uuidv4(),
        type: 'fever',
        severity: 'warning',
        message: `Fever: Temp ${vitals.temperature}°C`,
        criteria: `Temp > ${thresholds.tempHigh}°C`,
        suggestedAction: 'Consider sepsis workup: blood cultures, wound inspection, CBC, consider antibiotics.',
        createdAt: new Date(),
        status: 'open',
      });
    }

    if (vitals.temperature < thresholds.tempLow) {
      alerts.push({
        id: uuidv4(),
        type: 'hypothermia',
        severity: 'warning',
        message: `Hypothermia: Temp ${vitals.temperature}°C`,
        criteria: `Temp < ${thresholds.tempLow}°C`,
        suggestedAction: 'Warm fluids, warming blankets, increase room temperature, limit wound exposure.',
        createdAt: new Date(),
        status: 'open',
      });
    }

    return alerts;
  }

  /**
   * Generate alert for low urine output
   */
  generateUrineOutputAlert(urineOutputs: UrineOutput[], targetMin: number): BurnAlert | null {
    // Check last 2 consecutive hours
    const recentOutputs = urineOutputs.slice(-2);
    
    if (recentOutputs.length < 2) return null;
    
    const allBelowTarget = recentOutputs.every(uo => uo.mlPerKgPerHr < targetMin);
    
    if (allBelowTarget) {
      const avgUO = recentOutputs.reduce((sum, uo) => sum + uo.mlPerKgPerHr, 0) / recentOutputs.length;
      return {
        id: uuidv4(),
        type: 'low_urine_output',
        severity: avgUO < targetMin * 0.6 ? 'critical' : 'warning',
        message: `Low urine output: ${avgUO.toFixed(2)} mL/kg/hr for 2 consecutive hours`,
        criteria: `UO < ${targetMin} mL/kg/hr for 2 consecutive hours`,
        suggestedAction: 'Increase crystalloid infusion by 20-30%. Reassess in 1 hour. If no improvement, consider vasopressors/ICU.',
        createdAt: new Date(),
        status: 'open',
      };
    }

    return null;
  }

  /**
   * Calculate nutritional requirements
   * Curreri Formula: 25 kcal/kg/day + 40 kcal/%TBSA/day
   * Protein: 1.5-2.0 g/kg/day
   */
  calculateNutritionTargets(weightKg: number, tbsa: number): {
    caloriesPerDay: number;
    proteinPerDay: number;
    formula: string;
  } {
    // Curreri formula for burns
    const caloriesPerDay = Math.round(25 * weightKg + 40 * tbsa);
    const proteinPerDay = Math.round(1.5 * weightKg * 10) / 10; // 1.5-2.0 g/kg/day

    return {
      caloriesPerDay,
      proteinPerDay,
      formula: `Curreri: 25×${weightKg}kg + 40×${tbsa}%TBSA`,
    };
  }

  /**
   * Determine recommended disposition
   */
  determineDisposition(
    tbsa: number,
    hasInhalationInjury: boolean,
    hasFullThickness: boolean,
    age: number,
    mechanism: BurnMechanism,
    hasCircumferentialBurn: boolean
  ): { disposition: 'ward' | 'icu' | 'burn_center' | 'outpatient'; reasons: string[] } {
    const reasons: string[] = [];
    let disposition: 'ward' | 'icu' | 'burn_center' | 'outpatient' = 'outpatient';

    // ABA Burn Center Referral Criteria
    if (tbsa >= 10) {
      disposition = 'burn_center';
      reasons.push(`TBSA ≥10% (${tbsa}%)`);
    }
    
    if (hasFullThickness && tbsa >= 5) {
      disposition = 'burn_center';
      reasons.push('Full-thickness burns ≥5% TBSA');
    }

    if (hasInhalationInjury) {
      disposition = 'icu';
      reasons.push('Inhalation injury');
    }

    if (mechanism === 'electrical' || mechanism === 'chemical') {
      disposition = disposition === 'outpatient' ? 'burn_center' : disposition;
      reasons.push(`${mechanism.charAt(0).toUpperCase() + mechanism.slice(1)} burn mechanism`);
    }

    if (hasCircumferentialBurn) {
      disposition = disposition === 'outpatient' ? 'burn_center' : disposition;
      reasons.push('Circumferential burn - escharotomy may be needed');
    }

    if (age < 2 || age > 60) {
      if (disposition === 'outpatient' && tbsa >= 5) {
        disposition = 'ward';
        reasons.push(`Age extremes (${age} years) with significant burn`);
      }
    }

    // Default for small burns
    if (disposition === 'outpatient' && tbsa < 5 && !hasFullThickness) {
      reasons.push('Minor burn - suitable for outpatient management');
    } else if (disposition === 'outpatient' && tbsa >= 5) {
      disposition = 'ward';
      reasons.push(`TBSA ${tbsa}% requires inpatient monitoring`);
    }

    return { disposition, reasons };
  }

  /**
   * Get region display name
   */
  getRegionDisplayName(region: AnatomicalRegion): string {
    const names: Record<AnatomicalRegion, string> = {
      'head_anterior': 'Head (Anterior)',
      'head_posterior': 'Head (Posterior)',
      'neck_anterior': 'Neck (Anterior)',
      'neck_posterior': 'Neck (Posterior)',
      'trunk_anterior': 'Trunk (Anterior)',
      'trunk_posterior': 'Trunk (Posterior)',
      'right_arm_anterior': 'Right Arm (Anterior)',
      'right_arm_posterior': 'Right Arm (Posterior)',
      'left_arm_anterior': 'Left Arm (Anterior)',
      'left_arm_posterior': 'Left Arm (Posterior)',
      'right_hand': 'Right Hand',
      'left_hand': 'Left Hand',
      'genitalia': 'Genitalia/Perineum',
      'right_thigh_anterior': 'Right Thigh (Anterior)',
      'right_thigh_posterior': 'Right Thigh (Posterior)',
      'left_thigh_anterior': 'Left Thigh (Anterior)',
      'left_thigh_posterior': 'Left Thigh (Posterior)',
      'right_leg_anterior': 'Right Lower Leg (Anterior)',
      'right_leg_posterior': 'Right Lower Leg (Posterior)',
      'left_leg_anterior': 'Left Lower Leg (Anterior)',
      'left_leg_posterior': 'Left Lower Leg (Posterior)',
      'right_foot': 'Right Foot',
      'left_foot': 'Left Foot',
    };
    return names[region] || region;
  }

  /**
   * Get depth display name and color
   */
  getDepthInfo(depth: BurnDepth): { name: string; color: string; description: string } {
    const info: Record<BurnDepth, { name: string; color: string; description: string }> = {
      'superficial': { 
        name: 'Superficial (1st Degree)', 
        color: 'pink',
        description: 'Epidermis only. Red, dry, painful. Heals in 3-5 days without scarring.'
      },
      'superficial_partial': { 
        name: 'Superficial Partial (2nd Degree)', 
        color: 'red',
        description: 'Epidermis + superficial dermis. Blisters, moist, very painful. Heals in 1-2 weeks.'
      },
      'deep_partial': { 
        name: 'Deep Partial (2nd Degree)', 
        color: 'yellow',
        description: 'Into deep dermis. May have blisters, less painful. Heals in 2-4 weeks, may scar.'
      },
      'full_thickness': { 
        name: 'Full Thickness (3rd Degree)', 
        color: 'brown',
        description: 'Entire dermis destroyed. Waxy, leathery, painless. Requires grafting.'
      },
    };
    return info[depth];
  }
}

export const burnCareService = new BurnCareService();
