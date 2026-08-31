/**
 * Substance Use Disorder Assessment & Detoxification Service (CSUD-DSM)
 * 
 * DECISION SUPPORT ONLY — Final clinical responsibility rests with the licensed clinician.
 * No autonomous prescribing. All recommendations require clinician review.
 */

import type {
  SubstanceCategory,
  SubstanceIntake,
  PhysicalDependenceScore,
  PsychologicalDependenceScore,
  BehavioralDysfunctionScore,
  SocialImpairmentScore,
  MedicalComplicationsScore,
  AddictionSeverityScore,
  AddictionSeverity,
  WithdrawalRiskPrediction,
  WithdrawalSymptom,
  WithdrawalSeverity,
  CareSettingRecommendation,
  CareSettingDecision,
  PainManagementSupport,
  PainContextAssessment,
  AnalgesicRecommendation,
  ComorbidityModification,
  
  
  
  
} from '../db/substanceUseTypes';

// ==================== SUBSTANCE DEFINITIONS ====================

export interface SubstanceDefinition {
  category: SubstanceCategory;
  name: string;
  commonNames: string[];
  halfLifeHours: number;
  withdrawalOnsetHours: number;
  withdrawalPeakHours: number;
  withdrawalDurationDays: number;
  withdrawalSymptoms: { early: string[]; peak: string[]; late: string[] };
  redFlagComplications: string[];
  pharmacologicalSupport: string[];
  monitoringParameters: string[];
}

export const substanceDefinitions: Record<string, SubstanceDefinition> = {
  pentazocine: {
    category: 'opioids', name: 'Pentazocine', commonNames: ['Fortwin', 'Talwin'],
    halfLifeHours: 3, withdrawalOnsetHours: 8, withdrawalPeakHours: 36, withdrawalDurationDays: 7,
    withdrawalSymptoms: {
      early: ['Anxiety', 'Restlessness', 'Lacrimation', 'Rhinorrhea', 'Yawning', 'Sweating'],
      peak: ['Muscle aches', 'Abdominal cramps', 'Nausea', 'Vomiting', 'Diarrhea', 'Dilated pupils', 'Piloerection', 'Insomnia', 'Tachycardia'],
      late: ['Persistent insomnia', 'Irritability', 'Dysphoria', 'Drug craving'],
    },
    redFlagComplications: ['Severe dehydration', 'Electrolyte imbalance', 'Aspiration', 'Suicide risk'],
    pharmacologicalSupport: ['Clonidine', 'Loperamide', 'NSAIDs', 'Antiemetics', 'Anxiolytics (short-term)'],
    monitoringParameters: ['Vital signs q4h', 'Hydration status', 'COWS score', 'Electrolytes'],
  },
  tramadol: {
    category: 'opioids', name: 'Tramadol', commonNames: ['Ultram', 'Tramal'],
    halfLifeHours: 6, withdrawalOnsetHours: 12, withdrawalPeakHours: 48, withdrawalDurationDays: 10,
    withdrawalSymptoms: {
      early: ['Anxiety', 'Sweating', 'Insomnia', 'Tremor', 'Flu-like symptoms'],
      peak: ['Severe anxiety', 'Depression', 'Confusion', 'Hallucinations', 'Seizures (risk)', 'Paraesthesias', 'Muscle spasms'],
      late: ['Depression', 'Fatigue', 'Drug craving', 'Cognitive difficulties'],
    },
    redFlagComplications: ['Seizures (higher risk than typical opioids)', 'Serotonin syndrome', 'Severe depression', 'Suicidal ideation'],
    pharmacologicalSupport: ['Anticonvulsant prophylaxis', 'Clonidine', 'Low-dose SSRI taper', 'Anxiolytics'],
    monitoringParameters: ['Seizure precautions', 'Mental status', 'Vital signs', 'Serotonin syndrome signs'],
  },
  codeine: {
    category: 'opioids', name: 'Codeine', commonNames: ['Codeine phosphate', 'Cocodamol component'],
    halfLifeHours: 3, withdrawalOnsetHours: 8, withdrawalPeakHours: 48, withdrawalDurationDays: 7,
    withdrawalSymptoms: {
      early: ['Restlessness', 'Lacrimation', 'Rhinorrhea', 'Yawning', 'Anxiety'],
      peak: ['Muscle aches', 'Nausea', 'Vomiting', 'Diarrhea', 'Gooseflesh', 'Dilated pupils', 'Insomnia'],
      late: ['Irritability', 'Fatigue', 'Mild depression', 'Drug craving'],
    },
    redFlagComplications: ['Dehydration', 'Electrolyte disturbance', 'Relapse risk'],
    pharmacologicalSupport: ['Clonidine', 'Loperamide', 'Paracetamol', 'Antiemetics'],
    monitoringParameters: ['Hydration', 'Vital signs', 'COWS score', 'GI symptoms'],
  },
  morphine: {
    category: 'opioids', name: 'Morphine', commonNames: ['MST', 'Oramorph'],
    halfLifeHours: 3, withdrawalOnsetHours: 8, withdrawalPeakHours: 36, withdrawalDurationDays: 10,
    withdrawalSymptoms: {
      early: ['Anxiety', 'Lacrimation', 'Rhinorrhea', 'Sweating', 'Yawning'],
      peak: ['Severe muscle aches', 'Abdominal cramps', 'Diarrhea', 'Nausea', 'Vomiting', 'Tachycardia', 'Hypertension', 'Fever'],
      late: ['Insomnia', 'Dysphoria', 'Anhedonia', 'Cravings'],
    },
    redFlagComplications: ['Severe dehydration', 'Cardiovascular stress', 'Suicide risk', 'Aspiration'],
    pharmacologicalSupport: ['Clonidine', 'Buprenorphine taper', 'Loperamide', 'NSAIDs', 'Anxiolytics'],
    monitoringParameters: ['COWS score q4h', 'Vital signs', 'Hydration', 'ECG if cardiac history'],
  },
  cannabis: {
    category: 'cannabinoids', name: 'Cannabis', commonNames: ['Indian hemp', 'Marijuana', 'Weed', 'Igbo'],
    halfLifeHours: 72, withdrawalOnsetHours: 24, withdrawalPeakHours: 72, withdrawalDurationDays: 14,
    withdrawalSymptoms: {
      early: ['Irritability', 'Anxiety', 'Decreased appetite', 'Sleep difficulties'],
      peak: ['Restlessness', 'Depressed mood', 'Headache', 'Sweating', 'Chills', 'Abdominal pain', 'Tremor'],
      late: ['Strange dreams', 'Persistent sleep disturbance', 'Mood swings'],
    },
    redFlagComplications: ['Severe anxiety/panic', 'Depression with suicidal ideation', 'Psychotic symptoms (rare)'],
    pharmacologicalSupport: ['Short-term sleep aids', 'Antiemetics if needed', 'Anxiolytics PRN'],
    monitoringParameters: ['Mental status', 'Sleep pattern', 'Appetite', 'Anxiety level'],
  },
  diazepam: {
    category: 'sedatives', name: 'Diazepam', commonNames: ['Valium'],
    halfLifeHours: 100, withdrawalOnsetHours: 48, withdrawalPeakHours: 120, withdrawalDurationDays: 21,
    withdrawalSymptoms: {
      early: ['Anxiety', 'Insomnia', 'Tremor', 'Sweating', 'Palpitations'],
      peak: ['Severe anxiety', 'Panic attacks', 'Perceptual disturbances', 'Muscle twitching', 'Hypersensitivity to stimuli', 'Seizures'],
      late: ['Protracted insomnia', 'Anxiety', 'Depression', 'Cognitive impairment'],
    },
    redFlagComplications: ['Seizures (can be fatal)', 'Delirium tremens', 'Psychosis', 'Status epilepticus'],
    pharmacologicalSupport: ['Gradual benzodiazepine taper (essential)', 'Anticonvulsants', 'Beta-blockers'],
    monitoringParameters: ['Seizure precautions (critical)', 'Vital signs', 'Mental status', 'CIWA-B score'],
  },
  clonazepam: {
    category: 'sedatives', name: 'Clonazepam', commonNames: ['Rivotril', 'Klonopin'],
    halfLifeHours: 40, withdrawalOnsetHours: 24, withdrawalPeakHours: 72, withdrawalDurationDays: 14,
    withdrawalSymptoms: {
      early: ['Anxiety', 'Insomnia', 'Irritability', 'Hand tremor'],
      peak: ['Severe anxiety', 'Panic', 'Seizures', 'Perceptual disturbances', 'Depersonalization'],
      late: ['Persistent anxiety', 'Depression', 'Cognitive fog'],
    },
    redFlagComplications: ['Seizures', 'Psychosis', 'Severe rebound anxiety'],
    pharmacologicalSupport: ['Convert to long-acting benzodiazepine and taper', 'Anticonvulsants'],
    monitoringParameters: ['Seizure precautions', 'Anxiety scale', 'Vital signs'],
  },
  alcohol: {
    category: 'alcohol', name: 'Alcohol', commonNames: ['Ethanol', 'Alcoholic beverages'],
    halfLifeHours: 4, withdrawalOnsetHours: 6, withdrawalPeakHours: 48, withdrawalDurationDays: 7,
    withdrawalSymptoms: {
      early: ['Tremor', 'Anxiety', 'Sweating', 'Nausea', 'Insomnia', 'Tachycardia'],
      peak: ['Severe tremor', 'Hallucinations', 'Seizures', 'Delirium tremens', 'Hyperthermia', 'Hypertension'],
      late: ['Mood disturbance', 'Sleep problems', 'Fatigue'],
    },
    redFlagComplications: ['Delirium tremens (DTs)', 'Seizures', 'Wernicke encephalopathy', 'Aspiration', 'Arrhythmias'],
    pharmacologicalSupport: ['Benzodiazepines (chlordiazepoxide/diazepam)', 'Thiamine (high-dose)', 'IV fluids', 'Multivitamins'],
    monitoringParameters: ['CIWA-Ar score q1-4h', 'Vital signs', 'Blood glucose', 'Electrolytes', 'LFTs'],
  },
  cocaine: {
    category: 'stimulants', name: 'Cocaine', commonNames: ['Crack', 'Coke'],
    halfLifeHours: 1, withdrawalOnsetHours: 12, withdrawalPeakHours: 48, withdrawalDurationDays: 10,
    withdrawalSymptoms: {
      early: ['Fatigue', 'Increased sleep', 'Increased appetite', 'Dysphoria'],
      peak: ['Depression', 'Anhedonia', 'Psychomotor retardation', 'Intense cravings', 'Irritability'],
      late: ['Intermittent cravings', 'Mood instability', 'Sleep disturbance'],
    },
    redFlagComplications: ['Severe depression', 'Suicidal ideation', 'Cardiac arrhythmias (from recent use)'],
    pharmacologicalSupport: ['Supportive care', 'Antidepressants if persistent depression', 'Sleep aids'],
    monitoringParameters: ['Mental status', 'Suicide risk assessment', 'Cardiac monitoring if recent use'],
  },
  methamphetamine: {
    category: 'stimulants', name: 'Methamphetamine', commonNames: ['Meth', 'Crystal', 'Ice'],
    halfLifeHours: 12, withdrawalOnsetHours: 24, withdrawalPeakHours: 72, withdrawalDurationDays: 14,
    withdrawalSymptoms: {
      early: ['Fatigue', 'Increased sleep', 'Increased appetite'],
      peak: ['Severe depression', 'Anxiety', 'Irritability', 'Intense cravings', 'Paranoia'],
      late: ['Anhedonia', 'Cognitive impairment', 'Mood swings'],
    },
    redFlagComplications: ['Severe depression', 'Psychosis', 'Suicidal behavior', 'Violence'],
    pharmacologicalSupport: ['Supportive care', 'Antipsychotics if psychotic', 'Antidepressants'],
    monitoringParameters: ['Mental status', 'Suicide/violence risk', 'Psychotic symptoms'],
  },
};

// ==================== SCORING ALGORITHMS ====================

export function calculatePhysicalDependenceScore(
  tolerance: number, withdrawalSymptoms: number, compulsiveUse: number, physicalCravings: number
): PhysicalDependenceScore {
  return { tolerance, withdrawalSymptoms, compulsiveUse, physicalCravings, totalScore: tolerance + withdrawalSymptoms + compulsiveUse + physicalCravings };
}

export function calculatePsychologicalDependenceScore(
  emotionalReliance: number, copingMechanism: number, preoccupation: number, anxietyWithoutSubstance: number
): PsychologicalDependenceScore {
  return { emotionalReliance, copingMechanism, preoccupation, anxietyWithoutSubstance, totalScore: emotionalReliance + copingMechanism + preoccupation + anxietyWithoutSubstance };
}

export function calculateBehavioralDysfunctionScore(
  prioritizingSubstance: number, failedAttemptsToCut: number, timeSpentObtaining: number, givingUpActivities: number
): BehavioralDysfunctionScore {
  return { prioritizingSubstance, failedAttemptsToCut, timeSpentObtaining, givingUpActivities, totalScore: prioritizingSubstance + failedAttemptsToCut + timeSpentObtaining + givingUpActivities };
}

export function calculateSocialImpairmentScore(
  occupationalImpact: number, relationshipImpact: number, financialImpact: number, legalIssues: number
): SocialImpairmentScore {
  return { occupationalImpact, relationshipImpact, financialImpact, legalIssues, totalScore: occupationalImpact + relationshipImpact + financialImpact + legalIssues };
}

export function calculateMedicalComplicationsScore(
  liverDysfunction: number, renalDysfunction: number, cardiacComplications: number,
  neurologicalComplications: number, infectiousComplications: number, psychiatricComorbidity: number
): MedicalComplicationsScore {
  return { liverDysfunction, renalDysfunction, cardiacComplications, neurologicalComplications, infectiousComplications, psychiatricComorbidity,
    totalScore: liverDysfunction + renalDysfunction + cardiacComplications + neurologicalComplications + infectiousComplications + psychiatricComorbidity };
}

/**
 * Composite: Total possible 88 points — Mild 0-22, Moderate 23-44, Severe 45-66, Complicated 67-88
 */
export function calculateAddictionSeverityScore(
  physical: PhysicalDependenceScore, psychological: PsychologicalDependenceScore,
  behavioral: BehavioralDysfunctionScore, social: SocialImpairmentScore, medical: MedicalComplicationsScore
): AddictionSeverityScore {
  const totalCompositeScore = physical.totalScore + psychological.totalScore + behavioral.totalScore + social.totalScore + medical.totalScore;
  let severityLevel: AddictionSeverity;
  let interpretationNotes: string;
  if (totalCompositeScore <= 22) { severityLevel = 'mild'; interpretationNotes = 'Mild SUD. Outpatient management may be appropriate with close monitoring.'; }
  else if (totalCompositeScore <= 44) { severityLevel = 'moderate'; interpretationNotes = 'Moderate SUD. Structured outpatient program recommended.'; }
  else if (totalCompositeScore <= 66) { severityLevel = 'severe'; interpretationNotes = 'Severe SUD. Inpatient or intensive outpatient strongly recommended.'; }
  else { severityLevel = 'complicated'; interpretationNotes = 'Complicated SUD with significant comorbidity. Specialist inpatient care essential.'; }
  return { physicalDependence: physical, psychologicalDependence: psychological, behavioralDysfunction: behavioral, socialImpairment: social, medicalComplications: medical, totalCompositeScore, severityLevel, interpretationNotes };
}

// ==================== WITHDRAWAL RISK PREDICTION ====================

export function predictWithdrawalRisk(
  substances: SubstanceIntake[], patientAge: number,
  renalFunction: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment',
  hepaticFunction: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment',
  comorbidities: string[]
): WithdrawalRiskPrediction {
  const expectedSymptoms: WithdrawalSymptom[] = [];
  let earlyPhaseSymptoms: string[] = [];
  let peakPhaseSymptoms: string[] = [];
  let latePhaseSymptoms: string[] = [];
  let redFlagComplications: string[] = [];
  let monitoringRecommendations: string[] = [];
  let pharmacologicalSupport: string[] = [];
  let maxRiskScore = 0;

  for (const substance of substances) {
    const key = substance.substanceName.toLowerCase().replace(/\s+/g, '');
    const definition = substanceDefinitions[key] ||
      Object.values(substanceDefinitions).find(d => d.commonNames.some(n => n.toLowerCase() === substance.substanceName.toLowerCase()));
    if (!definition) continue;

    earlyPhaseSymptoms = [...new Set([...earlyPhaseSymptoms, ...definition.withdrawalSymptoms.early])];
    peakPhaseSymptoms = [...new Set([...peakPhaseSymptoms, ...definition.withdrawalSymptoms.peak])];
    latePhaseSymptoms = [...new Set([...latePhaseSymptoms, ...definition.withdrawalSymptoms.late])];
    redFlagComplications = [...new Set([...redFlagComplications, ...definition.redFlagComplications])];
    monitoringRecommendations = [...new Set([...monitoringRecommendations, ...definition.monitoringParameters])];
    pharmacologicalSupport = [...new Set([...pharmacologicalSupport, ...definition.pharmacologicalSupport])];

    for (const symptom of definition.withdrawalSymptoms.early) {
      expectedSymptoms.push({ symptom, phase: 'early', expectedOnsetHours: definition.withdrawalOnsetHours, expectedPeakHours: definition.withdrawalPeakHours, expectedDurationDays: 2, severity: 'mild', isRedFlag: false, managementNotes: 'Supportive care, hydration, rest' });
    }
    for (const symptom of definition.withdrawalSymptoms.peak) {
      const isRedFlag = definition.redFlagComplications.some(rf => rf.toLowerCase().includes(symptom.toLowerCase()));
      expectedSymptoms.push({ symptom, phase: 'peak', expectedOnsetHours: definition.withdrawalPeakHours - 12, expectedPeakHours: definition.withdrawalPeakHours, expectedDurationDays: 3, severity: isRedFlag ? 'severe' : 'moderate', isRedFlag, managementNotes: isRedFlag ? 'Close monitoring required, consider escalation' : 'Active management' });
    }

    let score = 30;
    if (substance.durationOfUseMonths > 12) score += 20;
    else if (substance.durationOfUseMonths > 6) score += 10;
    if (substance.substanceCategory === 'sedatives' || substance.substanceCategory === 'alcohol') score += 25;
    if (substance.substanceCategory === 'opioids') score += 15;
    if (substance.escalationPattern === 'increasing') score += 10;
    maxRiskScore = Math.max(maxRiskScore, score);
  }

  if (patientAge > 65) maxRiskScore += 10;
  if (renalFunction !== 'normal') maxRiskScore += 10;
  if (hepaticFunction !== 'normal') maxRiskScore += 15;
  if (substances.length > 1) maxRiskScore += 20;
  if (comorbidities.some(c => c.toLowerCase().includes('sickle'))) maxRiskScore += 10;
  if (comorbidities.some(c => c.toLowerCase().includes('cardiac'))) maxRiskScore += 10;
  if (comorbidities.some(c => c.toLowerCase().includes('seizure') || c.toLowerCase().includes('epilepsy'))) maxRiskScore += 15;

  let overallRisk: WithdrawalSeverity;
  if (maxRiskScore <= 30) overallRisk = 'minimal';
  else if (maxRiskScore <= 50) overallRisk = 'mild';
  else if (maxRiskScore <= 70) overallRisk = 'moderate';
  else if (maxRiskScore <= 85) overallRisk = 'severe';
  else overallRisk = 'life_threatening';

  const primarySubstance = substances.find(s => s.isPrimaryConcern) || substances[0];
  const primaryDef = primarySubstance ? substanceDefinitions[primarySubstance.substanceName.toLowerCase()] : null;
  const timelineDescription = primaryDef
    ? `Withdrawal expected to begin ${primaryDef.withdrawalOnsetHours}h after last use, peak at ${primaryDef.withdrawalPeakHours}h, and resolve over ${primaryDef.withdrawalDurationDays} days.`
    : 'Timeline depends on specific substances used. Close monitoring recommended.';

  return { overallRisk, riskScore: Math.min(maxRiskScore, 100), expectedSymptoms, earlyPhaseSymptoms, peakPhaseSymptoms, latePhaseSymptoms, redFlagComplications, timelineDescription, monitoringRecommendations, pharmacologicalSupport };
}

// ==================== PAIN MANAGEMENT DECISION SUPPORT ====================

export function generatePainManagementSupport(
  painContext: PainContextAssessment, substanceHistory: SubstanceIntake[], _comorbidities: string[]
): PainManagementSupport {
  const nonOpioidPrimaryOptions: AnalgesicRecommendation[] = [
    { category: 'primary', recommendation: 'Paracetamol (Acetaminophen)', rationale: 'First-line with favorable safety in SUD', cautions: ['Max 4g/day normal hepatic function', 'Reduce in liver impairment'], requiresClinicianConfirmation: false },
    { category: 'primary', recommendation: 'NSAIDs (Ibuprofen, Diclofenac, Naproxen)', rationale: 'Effective for inflammatory/musculoskeletal pain', cautions: ['GI risk', 'Renal impairment', 'CV risk'], requiresClinicianConfirmation: true, contraindications: ['Active GI bleeding', 'Severe renal impairment'] },
  ];
  if (painContext.painType === 'neuropathic' || painContext.painType === 'mixed') {
    nonOpioidPrimaryOptions.push({ category: 'primary', recommendation: 'Gabapentinoids (Pregabalin/Gabapentin)', rationale: 'Effective for neuropathic pain', cautions: ['Some abuse potential', 'Titrate slowly', 'Renal dose adjustment'], requiresClinicianConfirmation: true });
  }

  const adjuvantTherapies: AnalgesicRecommendation[] = [
    { category: 'adjuvant', recommendation: 'Tricyclic Antidepressants (Amitriptyline)', rationale: 'Useful for neuropathic/chronic pain', cautions: ['Start low, go slow', 'Anticholinergic effects'], requiresClinicianConfirmation: true },
    { category: 'adjuvant', recommendation: 'Duloxetine (SNRI)', rationale: 'Chronic pain, diabetic neuropathy, fibromyalgia', cautions: ['Serotonin syndrome risk with tramadol history'], requiresClinicianConfirmation: true },
  ];

  const nonPharmacologicalStrategies: AnalgesicRecommendation[] = [
    { category: 'non_pharmacological', recommendation: 'Heat/Cold Therapy', rationale: 'Low risk for musculoskeletal pain', cautions: [], requiresClinicianConfirmation: false },
    { category: 'non_pharmacological', recommendation: 'Physiotherapy', rationale: 'Addresses functional causes', cautions: [], requiresClinicianConfirmation: false },
    { category: 'non_pharmacological', recommendation: 'CBT for Pain', rationale: 'Evidence-based chronic pain management', cautions: [], requiresClinicianConfirmation: false },
    { category: 'non_pharmacological', recommendation: 'TENS', rationale: 'Non-invasive pain modulation', cautions: ['Avoid over pacemakers'], requiresClinicianConfirmation: false },
  ];

  const highRiskCombinationsWarning: string[] = [];
  if (substanceHistory.some(s => s.substanceCategory === 'opioids')) {
    highRiskCombinationsWarning.push('⚠️ Opioid history: Avoid opioid prescriptions unless absolutely necessary', '⚠️ If opioids essential: Lowest dose, shortest duration, strict monitoring');
  }
  if (substanceHistory.some(s => s.substanceCategory === 'sedatives')) {
    highRiskCombinationsWarning.push('⚠️ Benzodiazepine history: Avoid concurrent CNS depressants');
  }

  return {
    painContext, nonOpioidPrimaryOptions, adjuvantTherapies, nonPharmacologicalStrategies,
    escalationCriteria: ['Pain score ≥7/10 despite multimodal therapy', 'Functional impairment preventing ADLs', 'Red flag symptoms', 'Patient distress compromising recovery'],
    highRiskCombinationsWarning,
    monitoringRequirements: ['Regular pain assessments', 'Functional outcome assessment', 'Monitor for medication misuse', 'Document all prescribing rationale'],
  };
}

// ==================== CARE SETTING RECOMMENDATION ====================

export function determineCareSettingRecommendation(
  addictionSeverity: AddictionSeverityScore, withdrawalRisk: WithdrawalRiskPrediction,
  substances: SubstanceIntake[], socialSupport: 'strong' | 'moderate' | 'minimal' | 'none',
  medicalStability: 'stable' | 'mildly_unstable' | 'unstable' | 'critical', psychiatricConcerns: boolean
): CareSettingDecision {
  let recommendation: CareSettingRecommendation = 'outpatient_detox';
  let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
  const triggerFactors: string[] = [];
  const supportingEvidence: string[] = [];
  const alternativeOptions: CareSettingRecommendation[] = [];
  const escalationCriteria: string[] = [];

  if (medicalStability === 'critical' || withdrawalRisk.overallRisk === 'life_threatening' ||
    (substances.some(s => s.substanceCategory === 'sedatives' || s.substanceCategory === 'alcohol') && addictionSeverity.severityLevel === 'complicated')) {
    recommendation = 'icu_hdu_alert'; confidenceLevel = 'high';
    triggerFactors.push('Critical instability', 'Life-threatening withdrawal', 'High seizure risk');
  } else if (medicalStability === 'unstable' || withdrawalRisk.overallRisk === 'severe' || addictionSeverity.severityLevel === 'severe' ||
    addictionSeverity.severityLevel === 'complicated' || socialSupport === 'none' || substances.length >= 3 || psychiatricConcerns) {
    recommendation = 'inpatient_admission'; confidenceLevel = 'high';
    if (medicalStability === 'unstable') triggerFactors.push('Medical instability');
    if (socialSupport === 'none') triggerFactors.push('No social support');
    if (psychiatricConcerns) triggerFactors.push('Psychiatric concerns');
    alternativeOptions.push('supervised_outpatient');
  } else if (medicalStability === 'mildly_unstable' || withdrawalRisk.overallRisk === 'moderate' || addictionSeverity.severityLevel === 'moderate' || socialSupport === 'minimal') {
    recommendation = 'supervised_outpatient'; confidenceLevel = 'medium';
    alternativeOptions.push('outpatient_detox', 'inpatient_admission');
  } else {
    recommendation = 'outpatient_detox'; confidenceLevel = 'medium';
    triggerFactors.push('Mild severity', 'Good social support', 'Medically stable');
    alternativeOptions.push('supervised_outpatient');
  }

  escalationCriteria.push('Worsening clinical status', 'Development of severe withdrawal symptoms', 'Non-compliance');
  return { recommendation, confidenceLevel, triggerFactors, supportingEvidence, alternativeOptions, escalationCriteria };
}

// ==================== COMORBIDITY MODIFICATIONS ====================

export function getComorbidityModifications(comorbidities: string[]): ComorbidityModification[] {
  const modifications: ComorbidityModification[] = [];
  const lower = comorbidities.map(c => c.toLowerCase());

  if (lower.some(c => c.includes('sickle cell') || c.includes('scd'))) {
    modifications.push({
      condition: 'Sickle Cell Disease', affectsWithdrawal: true,
      withdrawalModifications: ['Hydration critical', 'Pain may overlap with VOC', 'Avoid NSAIDs in crisis'],
      affectsAnalgesics: true, analgesicModifications: ['Non-opioid multimodal preferred', 'Structured opioid protocol if needed for crisis'],
      affectsInpatientThreshold: true, inpatientThresholdNotes: 'Lower admission threshold due to crisis risk',
      specialConsiderations: ['Hematology consult', 'Monitor for acute chest syndrome'],
    });
  }
  if (lower.some(c => c.includes('renal') || c.includes('kidney') || c.includes('ckd'))) {
    modifications.push({
      condition: 'Renal Impairment', affectsWithdrawal: true,
      withdrawalModifications: ['Prolonged half-lives', 'Electrolyte monitoring critical'],
      affectsAnalgesics: true, analgesicModifications: ['Avoid NSAIDs', 'Reduce renally-excreted doses', 'Gabapentin dose adjust'],
      affectsInpatientThreshold: true, inpatientThresholdNotes: 'Lower threshold for admission',
      specialConsiderations: ['Nephrology if CKD 4-5'],
    });
  }
  if (lower.some(c => c.includes('liver') || c.includes('hepatic') || c.includes('cirrhosis'))) {
    modifications.push({
      condition: 'Hepatic Impairment', affectsWithdrawal: true,
      withdrawalModifications: ['Prolonged benzodiazepine action', 'Risk hepatic encephalopathy'],
      affectsAnalgesics: true, analgesicModifications: ['Reduce paracetamol (max 2g/day)', 'Short-acting benzos only'],
      affectsInpatientThreshold: true, inpatientThresholdNotes: 'Strong indication for inpatient',
      specialConsiderations: ['Hepatology input', 'Nutritional support'],
    });
  }
  return modifications;
}

// ==================== EXPORT SERVICE ====================

export const substanceUseService = {
  substanceDefinitions,
  calculatePhysicalDependenceScore,
  calculatePsychologicalDependenceScore,
  calculateBehavioralDysfunctionScore,
  calculateSocialImpairmentScore,
  calculateMedicalComplicationsScore,
  calculateAddictionSeverityScore,
  predictWithdrawalRisk,
  generatePainManagementSupport,
  determineCareSettingRecommendation,
  getComorbidityModifications,
};
