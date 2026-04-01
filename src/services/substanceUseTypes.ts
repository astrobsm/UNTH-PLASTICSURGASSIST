/**
 * Types for Substance Use Disorder Assessment & Detoxification (CSUD-DSM)
 */

export type SubstanceCategory = 'opioids' | 'cannabinoids' | 'sedatives' | 'alcohol' | 'stimulants' | 'inhalants' | 'hallucinogens' | 'other';

export type AddictionSeverity = 'mild' | 'moderate' | 'severe' | 'complicated';

export type WithdrawalSeverity = 'minimal' | 'mild' | 'moderate' | 'severe' | 'life_threatening';

export type WithdrawalPhase = 'early' | 'peak' | 'late';

export type CareSettingRecommendation = 'outpatient_detox' | 'supervised_outpatient' | 'inpatient_admission' | 'icu_hdu_alert';

export type AssessmentStatus = 'initial_assessment' | 'detox_in_progress' | 'monitoring' | 'detox_completed' | 'discharged' | 'abandoned' | 'referred';

export interface SubstanceIntake {
  substanceName: string;
  substanceCategory: SubstanceCategory;
  routeOfAdministration: string;
  dailyAmount: string;
  frequency: string;
  durationOfUseMonths: number;
  lastUseDateTime: string;
  escalationPattern: 'stable' | 'increasing' | 'decreasing';
  isPrimaryConcern: boolean;
}

export interface PhysicalDependenceScore {
  tolerance: number;
  withdrawalSymptoms: number;
  compulsiveUse: number;
  physicalCravings: number;
  totalScore: number;
}

export interface PsychologicalDependenceScore {
  emotionalReliance: number;
  copingMechanism: number;
  preoccupation: number;
  anxietyWithoutSubstance: number;
  totalScore: number;
}

export interface BehavioralDysfunctionScore {
  prioritizingSubstance: number;
  failedAttemptsToCut: number;
  timeSpentObtaining: number;
  givingUpActivities: number;
  totalScore: number;
}

export interface SocialImpairmentScore {
  occupationalImpact: number;
  relationshipImpact: number;
  financialImpact: number;
  legalIssues: number;
  totalScore: number;
}

export interface MedicalComplicationsScore {
  liverDysfunction: number;
  renalDysfunction: number;
  cardiacComplications: number;
  neurologicalComplications: number;
  infectiousComplications: number;
  psychiatricComorbidity: number;
  totalScore: number;
}

export interface AddictionSeverityScore {
  physicalDependence: PhysicalDependenceScore;
  psychologicalDependence: PsychologicalDependenceScore;
  behavioralDysfunction: BehavioralDysfunctionScore;
  socialImpairment: SocialImpairmentScore;
  medicalComplications: MedicalComplicationsScore;
  totalCompositeScore: number;
  severityLevel: AddictionSeverity;
  interpretationNotes: string;
}

export interface WithdrawalSymptom {
  symptom: string;
  phase: WithdrawalPhase;
  expectedOnsetHours: number;
  expectedPeakHours: number;
  expectedDurationDays: number;
  severity: 'mild' | 'moderate' | 'severe';
  isRedFlag: boolean;
  managementNotes: string;
}

export interface WithdrawalRiskPrediction {
  overallRisk: WithdrawalSeverity;
  riskScore: number;
  expectedSymptoms: WithdrawalSymptom[];
  earlyPhaseSymptoms: string[];
  peakPhaseSymptoms: string[];
  latePhaseSymptoms: string[];
  redFlagComplications: string[];
  timelineDescription: string;
  monitoringRecommendations: string[];
  pharmacologicalSupport: string[];
}

export interface PainContextAssessment {
  painType: 'nociceptive' | 'neuropathic' | 'mixed' | 'unknown';
  painCause?: string;
  painScore: number;
  painDuration: string;
  currentAnalgesics: string[];
}

export interface AnalgesicRecommendation {
  category: 'primary' | 'adjuvant' | 'non_pharmacological';
  recommendation: string;
  rationale: string;
  cautions: string[];
  requiresClinicianConfirmation: boolean;
  contraindications?: string[];
}

export interface PainManagementSupport {
  painContext: PainContextAssessment;
  nonOpioidPrimaryOptions: AnalgesicRecommendation[];
  adjuvantTherapies: AnalgesicRecommendation[];
  nonPharmacologicalStrategies: AnalgesicRecommendation[];
  escalationCriteria: string[];
  highRiskCombinationsWarning: string[];
  monitoringRequirements: string[];
}

export interface CareSettingDecision {
  recommendation: CareSettingRecommendation;
  confidenceLevel: 'low' | 'medium' | 'high';
  triggerFactors: string[];
  supportingEvidence: string[];
  alternativeOptions: CareSettingRecommendation[];
  escalationCriteria: string[];
}

export interface ComorbidityModification {
  condition: string;
  affectsWithdrawal: boolean;
  withdrawalModifications: string[];
  affectsAnalgesics: boolean;
  analgesicModifications: string[];
  affectsInpatientThreshold: boolean;
  inpatientThresholdNotes: string;
  specialConsiderations: string[];
}

export interface SubstanceUseAssessment {
  id: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  hospitalId?: string;
  assessmentDate: string;
  assessedBy: string;
  status: AssessmentStatus;
  primarySubstance: string;
  polySubstanceUse: boolean;
  substances: SubstanceIntake[];
  addictionSeverityScore: AddictionSeverityScore;
  withdrawalRiskPrediction: WithdrawalRiskPrediction;
  careSettingDecision: CareSettingDecision;
  painManagementSupport?: PainManagementSupport;
  comorbidities: string[];
  comorbidityModifications: ComorbidityModification[];
  socialFactors: {
    familySupportLevel: 'strong' | 'moderate' | 'minimal' | 'none';
    employmentStatus: string;
    stableHousing: boolean;
  };
  previousDetoxAttempts: number;
  clinicianOverride?: {
    originalRecommendation: CareSettingRecommendation;
    overriddenTo: CareSettingRecommendation;
    reason: string;
    overriddenBy: string;
    overriddenAt: Date;
  };
  auditLog: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    details?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
  synced?: boolean;
}

export interface DetoxMonitoringRecord {
  id: string;
  assessmentId: string;
  patientId: string;
  recordedAt: Date;
  recordedBy: string;
  vitalSigns: {
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  withdrawalScaleScore?: number;
  withdrawalScaleType?: 'COWS' | 'CIWA-Ar' | 'CIWA-B';
  symptoms: string[];
  interventions: string[];
  notes: string;
}

export interface DetoxFollowUp {
  id: string;
  assessmentId: string;
  patientId: string;
  scheduledDate: string;
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  purpose: string;
  location: string;
  notes?: string;
  completedAt?: Date;
  completedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubstanceUseClinicalSummary {
  id: string;
  assessmentId: string;
  patientId: string;
  patientName: string;
  hospitalName: string;
  assessmentDate: string;
  addictionScoreSummary: {
    compositeScore: number;
    severityLevel: AddictionSeverity;
    interpretation: string;
  };
  riskClassification: WithdrawalSeverity;
  recommendedPathway: CareSettingRecommendation;
  keyFindings: string[];
  recommendedInterventions: string[];
  monitoringChecklist: string[];
  followUpSchedule: string[];
  disclaimers: string[];
  generatedAt: Date;
  generatedBy: string;
}
