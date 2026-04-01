/**
 * Type definitions for the Substance Use Disorder Assessment & Detoxification Module (CSUD-DSM)
 */

export type SubstanceCategory = 'opioids' | 'cannabinoids' | 'sedatives' | 'alcohol' | 'stimulants' | 'hallucinogens' | 'inhalants' | 'other';

export type AddictionSeverity = 'mild' | 'moderate' | 'severe' | 'complicated';

export type WithdrawalSeverity = 'minimal' | 'mild' | 'moderate' | 'severe' | 'life_threatening';

export type WithdrawalPhase = 'early' | 'peak' | 'late';

export type CareSettingRecommendation = 'outpatient_detox' | 'supervised_outpatient' | 'inpatient_admission' | 'icu_hdu_alert';

export type AssessmentStatus = 'initial_assessment' | 'in_detox' | 'monitoring' | 'detox_completed' | 'discharged' | 'relapsed' | 'abandoned';

// ==================== SCORING TYPES ====================

export interface PhysicalDependenceScore {
  tolerance: number;           // 0-4
  withdrawalSymptoms: number;  // 0-4
  compulsiveUse: number;       // 0-4
  physicalCravings: number;    // 0-4
  totalScore: number;          // 0-16
}

export interface PsychologicalDependenceScore {
  emotionalReliance: number;       // 0-4
  copingMechanism: number;         // 0-4
  preoccupation: number;           // 0-4
  anxietyWithoutSubstance: number; // 0-4
  totalScore: number;              // 0-16
}

export interface BehavioralDysfunctionScore {
  prioritizingSubstance: number; // 0-4
  failedAttemptsToCut: number;   // 0-4
  timeSpentObtaining: number;    // 0-4
  givingUpActivities: number;    // 0-4
  totalScore: number;            // 0-16
}

export interface SocialImpairmentScore {
  occupationalImpact: number;  // 0-4
  relationshipImpact: number;  // 0-4
  financialImpact: number;     // 0-4
  legalIssues: number;         // 0-4
  totalScore: number;          // 0-16
}

export interface MedicalComplicationsScore {
  liverDysfunction: number;          // 0-4
  renalDysfunction: number;          // 0-4
  cardiacComplications: number;      // 0-4
  neurologicalComplications: number; // 0-4
  infectiousComplications: number;   // 0-4
  psychiatricComorbidity: number;    // 0-4
  totalScore: number;                // 0-24
}

export interface AddictionSeverityScore {
  physicalDependence: PhysicalDependenceScore;
  psychologicalDependence: PsychologicalDependenceScore;
  behavioralDysfunction: BehavioralDysfunctionScore;
  socialImpairment: SocialImpairmentScore;
  medicalComplications: MedicalComplicationsScore;
  totalCompositeScore: number; // 0-88
  severityLevel: AddictionSeverity;
  interpretationNotes: string;
}

// ==================== SUBSTANCE INTAKE ====================

export interface SubstanceIntake {
  substanceName: string;
  substanceCategory: SubstanceCategory;
  routeOfAdministration: 'oral' | 'intravenous' | 'intramuscular' | 'inhalation' | 'sublingual' | 'topical' | 'rectal' | 'other';
  frequencyOfUse: 'daily' | 'multiple_daily' | 'weekly' | 'occasional' | 'binge';
  durationOfUseMonths: number;
  lastUseDateTime: string;
  quantityPerUse: string;
  escalationPattern: 'stable' | 'increasing' | 'decreasing';
  isPrimaryConcern: boolean;
}

// ==================== WITHDRAWAL ====================

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

// ==================== CARE SETTING ====================

export interface CareSettingDecision {
  recommendation: CareSettingRecommendation;
  confidenceLevel: 'low' | 'medium' | 'high';
  triggerFactors: string[];
  supportingEvidence: string[];
  alternativeOptions: CareSettingRecommendation[];
  escalationCriteria: string[];
}

// ==================== PAIN MANAGEMENT ====================

export interface PainContextAssessment {
  painType: 'nociceptive' | 'neuropathic' | 'mixed' | 'functional';
  painCause?: string;
  currentPainScore: number; // 0-10
  functionalImpact: 'minimal' | 'moderate' | 'severe';
  currentAnalgesics: string[];
  hasSickleCellDisease: boolean;
}

export interface AnalgesicRecommendation {
  category: 'primary' | 'adjuvant' | 'non_pharmacological';
  recommendation: string;
  rationale: string;
  cautions: string[];
  contraindications?: string[];
  requiresClinicianConfirmation: boolean;
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

// ==================== COMORBIDITY ====================

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

// ==================== DOCUMENTS ====================

export interface SubstanceUseConsent {
  id: string;
  assessmentId: string;
  diagnosisExplanation: string;
  detoxificationRisks: string[];
  possibleWithdrawalEffects: string[];
  painManagementPlan: string;
  monitoringRequirements: string[];
  patientAcknowledged: boolean;
  documentVersion: string;
}

export interface PatientInfoLeaflet {
  id: string;
  assessmentId: string;
  dayByDayExpectations: Array<{
    day: number;
    description: string;
    symptoms: string[];
    selfCareAdvice: string[];
  }>;
  warningSymptoms: string[];
  complianceExpectations: string[];
  familyInvolvement: string[];
  followUpSchedule: Array<{
    date: Date;
    purpose: string;
    location: string;
  }>;
  emergencyContacts: Array<{
    name: string;
    phone: string;
    role: string;
  }>;
  generatedAt: Date;
  generatedBy: string;
}

// ==================== MONITORING ====================

export interface DetoxMonitoringRecord {
  id: string;
  assessmentId: string;
  patientId: string;
  monitoredAt: Date;
  monitoredBy: string;
  vitalSigns: {
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };
  withdrawalScaleScore?: number; // COWS or CIWA-Ar score
  withdrawalScaleType?: 'COWS' | 'CIWA-Ar' | 'CIWA-B';
  symptomChecklist: Array<{
    symptom: string;
    present: boolean;
    severity: 'none' | 'mild' | 'moderate' | 'severe';
  }>;
  medicationsGiven: Array<{
    medication: string;
    dose: string;
    route: string;
    time: string;
  }>;
  clinicalNotes: string;
  escalationTriggered: boolean;
  escalationReason?: string;
}

export interface DetoxFollowUp {
  id: string;
  assessmentId: string;
  patientId: string;
  scheduledDate: string;
  actualDate?: string;
  status: 'scheduled' | 'completed' | 'missed' | 'rescheduled';
  followUpType: 'phone' | 'clinic' | 'home_visit';
  notes?: string;
  relapseSinceLastVisit: boolean;
  currentSubstanceUse?: string;
  mentalHealthStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ==================== CLINICAL SUMMARY ====================

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

// ==================== MAIN ASSESSMENT ====================

export interface SubstanceUseAssessment {
  id: string;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  hospitalId?: string;
  assessmentDate: string;
  assessedBy: string;
  status: AssessmentStatus;

  // Substance intake data
  primarySubstance: string;
  substances: SubstanceIntake[];
  polySubstanceUse: boolean;

  // Scoring
  addictionSeverityScore: AddictionSeverityScore;

  // Withdrawal prediction
  withdrawalRiskPrediction: WithdrawalRiskPrediction;

  // Care setting
  careSettingDecision: CareSettingDecision;

  // Pain management (optional)
  painManagementSupport?: PainManagementSupport;

  // Comorbidities
  comorbidities: string[];
  comorbidityModifications: ComorbidityModification[];

  // Social factors
  socialFactors: {
    familySupportLevel: 'strong' | 'moderate' | 'minimal' | 'none';
    employmentStatus: string;
    housingStability: 'stable' | 'unstable' | 'homeless';
    financialConcerns: boolean;
    legalIssues: boolean;
  };

  // History
  previousDetoxAttempts: number;
  previousTreatmentHistory: string;

  // Clinician override
  clinicianOverride?: {
    originalRecommendation: CareSettingRecommendation;
    overriddenTo: CareSettingRecommendation;
    reason: string;
    overriddenBy: string;
    overriddenAt: Date;
  };

  // Consent
  consentObtained: boolean;
  consentDocument?: SubstanceUseConsent;

  // Audit
  auditLog: Array<{
    action: string;
    performedBy: string;
    performedAt: Date;
    details?: string;
  }>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  synced?: boolean;
}
