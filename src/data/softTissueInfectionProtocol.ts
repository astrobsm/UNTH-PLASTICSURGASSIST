// Soft Tissue Infection / Necrotizing Soft Tissue Infection Protocol
// Based on WHO World Best Standard Practice, IDSA Guidelines, WSES Guidelines

// ============================================================
// INTERFACES
// ============================================================
export interface STIClassification {
  id: string;
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  clinicalFeatures: string[];
  systemicSigns: string[];
  differentialDiagnosis: string[];
  imagingFindings?: string[];
  managementPrinciples: string[];
}

export interface LRINECScore {
  parameter: string;
  unit: string;
  ranges: { range: string; score: number; interpretation: string }[];
  description: string;
}

export interface SepsisScreening {
  tool: string;
  parameters: { name: string; criteria: string; points: number }[];
  interpretation: { range: string; meaning: string; action: string }[];
}

export interface LabPanel {
  id: string;
  name: string;
  tests: { testName: string; rationale: string; expectedAbnormality?: string; urgency: 'stat' | 'urgent' | 'routine' }[];
  frequency: string;
  applicableStages: string[];
}

export interface TreatmentProtocol {
  id: string;
  stage: string;
  severity: string;
  antibiotics: AntibioticRegimen[];
  surgicalInterventions: SurgicalIntervention[];
  supportiveCare: string[];
  monitoring: string[];
  escalationCriteria: string[];
  comorbidityModifications: ComorbidityModification[];
}

export interface AntibioticRegimen {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  indication: string;
  alternatives: string[];
  renalAdjustment?: string;
  hepaticAdjustment?: string;
  contraindications: string[];
}

export interface SurgicalIntervention {
  procedure: string;
  indication: string;
  timing: string;
  technique: string[];
  postoperativeCare: string[];
  expectedOutcome: string;
}

export interface ComorbidityModification {
  comorbidity: string;
  modifications: string[];
  additionalMonitoring: string[];
  specialConsiderations: string[];
}

export interface NursingProtocol {
  id: string;
  topic: string;
  objectives: string[];
  keyPoints: string[];
  procedures: NursingProcedure[];
  documentation: string[];
  escalationTriggers: string[];
}

export interface NursingProcedure {
  name: string;
  steps: string[];
  equipment: string[];
  frequency: string;
  precautions: string[];
}

export interface PatientEducationModule {
  id: string;
  title: string;
  targetAudience: string;
  language: 'simple' | 'moderate' | 'advanced';
  content: { heading: string; body: string }[];
  warningSignsToReport: string[];
  selfCareInstructions: string[];
  followUpGuidance: string[];
}

export interface CMEArticle {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  learningObjectives: string[];
  sections: { heading: string; content: string; references?: string[] }[];
  mcqQuestions: MCQQuestion[];
  references: string[];
  cmeCredits: number;
  targetAudience: string[];
  lastUpdated: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  reference: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

// ============================================================
// DISEASE CLASSIFICATIONS
// ============================================================
export const STI_CLASSIFICATIONS: STIClassification[] = [
  {
    id: 'simple-cellulitis',
    name: 'Simple Cellulitis (Class I)',
    severity: 'mild',
    description: 'Non-purulent, non-fluctuant skin and soft tissue infection involving dermis and subcutaneous tissue without systemic toxicity.',
    clinicalFeatures: [
      'Erythema with poorly defined borders',
      'Warmth and tenderness of affected area',
      'Mild edema without fluctuance',
      'No crepitus or bullae',
      'Intact skin barrier (or minor breach)',
      'Unilateral involvement typical',
    ],
    systemicSigns: [
      'Temperature < 38°C or normal',
      'Heart rate < 90 bpm',
      'Normal mental status',
      'No hemodynamic instability',
    ],
    differentialDiagnosis: [
      'Deep vein thrombosis',
      'Contact dermatitis',
      'Insect bite reaction',
      'Stasis dermatitis',
      'Erysipelas',
      'Gout / crystal arthropathy',
    ],
    managementPrinciples: [
      'Outpatient oral antibiotics',
      'Elevation of affected limb',
      'Analgesia and anti-inflammatory agents',
      'Mark borders with skin marker for progress monitoring',
      'Re-evaluate in 48-72 hours',
      'Address portal of entry (tinea pedis, skin breaks)',
    ],
  },
  {
    id: 'complicated-cellulitis',
    name: 'Complicated Cellulitis (Class II)',
    severity: 'moderate',
    description: 'Cellulitis with systemic signs of infection, significant comorbidities, or failure of outpatient therapy.',
    clinicalFeatures: [
      'Rapidly spreading erythema (>5cm in 24hrs)',
      'Significant edema and induration',
      'Possible purulence or fluctuance',
      'Lymphangitis / lymphadenopathy',
      'Failure of 48-72hr oral antibiotic course',
    ],
    systemicSigns: [
      'Temperature ≥ 38°C',
      'Heart rate ≥ 90 bpm',
      'WBC > 12,000 or < 4,000/μL',
      'Mild organ dysfunction possible',
    ],
    differentialDiagnosis: [
      'Abscess requiring drainage',
      'Septic arthritis / bursitis',
      'Osteomyelitis',
      'Necrotizing fasciitis (early)',
      'Erysipelas',
    ],
    managementPrinciples: [
      'Admission for IV antibiotics',
      'Blood cultures before antibiotics',
      'Imaging if deep infection suspected',
      'Surgical consultation for fluctuance',
      'Monitor for progression to NF',
      'Comorbidity optimization (DM, renal)',
    ],
  },
  {
    id: 'abscess',
    name: 'Soft Tissue Abscess (Class II-III)',
    severity: 'moderate',
    description: 'Localized collection of pus within soft tissues requiring drainage. May occur with or without surrounding cellulitis.',
    clinicalFeatures: [
      'Fluctuant, tender, erythematous mass',
      'Point tenderness maximal over collection',
      'Possible spontaneous drainage',
      'Surrounding cellulitis variable',
      'Common locations: axilla, groin, perianal, trunk',
    ],
    systemicSigns: [
      'Variable systemic toxicity',
      'May have fever and leukocytosis',
      'Sepsis possible with large or deep abscesses',
    ],
    differentialDiagnosis: [
      'Infected sebaceous cyst',
      'Hidradenitis suppurativa',
      'Bartholin gland abscess',
      'Pilonidal abscess',
      'Infected hematoma',
    ],
    imagingFindings: [
      'Ultrasound: hypoechoic collection with posterior enhancement',
      'CT: rim-enhancing fluid collection with surrounding fat stranding',
    ],
    managementPrinciples: [
      'Incision and drainage is primary treatment',
      'Antibiotics if surrounding cellulitis, systemic signs, immunocompromised',
      'Culture and sensitivity of pus',
      'Packing/wick for cavity drainage',
      'Follow-up for wound reassessment',
    ],
  },
  {
    id: 'necrotizing-fasciitis-type1',
    name: 'Necrotizing Fasciitis Type I (Polymicrobial)',
    severity: 'severe',
    description: 'Life-threatening polymicrobial infection involving fascia and subcutaneous tissue. Mixed aerobic and anaerobic organisms. Often associated with diabetes, peripheral vascular disease, surgical sites.',
    clinicalFeatures: [
      'Pain out of proportion to examination findings',
      'Rapidly progressive erythema and edema',
      'Dusky or violaceous discoloration',
      'Hemorrhagic bullae',
      'Crepitus on palpation (subcutaneous gas)',
      'Wooden-hard induration of subcutaneous tissue',
      'Cutaneous anesthesia / hypoesthesia',
      'Skin necrosis progressing to eschar',
      'Dish-water gray exudate at surgical exploration',
    ],
    systemicSigns: [
      'Sepsis / septic shock',
      'Temperature >38.5°C or <36°C',
      'Heart rate > 110 bpm',
      'Hypotension requiring vasopressors',
      'Altered mental status',
      'Multi-organ dysfunction',
    ],
    differentialDiagnosis: [
      'Severe cellulitis',
      'Gas gangrene (Clostridial)',
      'Pyomyositis',
      'Toxic shock syndrome',
      'Calciphylaxis',
    ],
    imagingFindings: [
      'CT: fascial thickening, fluid tracking along fascial planes, subcutaneous gas',
      'MRI: T2 hyperintensity along fascial planes (do not delay surgery for imaging)',
      'Plain X-ray: subcutaneous gas in soft tissues',
    ],
    managementPrinciples: [
      'EMERGENCY surgical debridement within 12-24 hours (ideally <6hrs)',
      'Broad-spectrum IV antibiotics immediately',
      'ICU admission and resuscitation',
      'Serial re-exploration every 24-48hrs',
      'Nutritional support (high protein, high calorie)',
      'Wound VAC therapy after debridement',
      'Multidisciplinary team involvement',
    ],
  },
  {
    id: 'necrotizing-fasciitis-type2',
    name: 'Necrotizing Fasciitis Type II (Monomicrobial - GAS)',
    severity: 'critical',
    description: 'Rapidly progressive necrotizing infection caused by Group A Streptococcus (GAS). Can occur in otherwise healthy individuals. Highest mortality rate among NSTIs.',
    clinicalFeatures: [
      'Sudden onset severe pain in extremity or trunk',
      'Rapidly expanding erythema (centimeters per hour)',
      'Pain dramatically out of proportion to findings',
      'Early: skin may appear normal despite severe deep infection',
      'Late: hemorrhagic bullae, skin necrosis',
      'Associated streptococcal toxic shock syndrome (STSS)',
    ],
    systemicSigns: [
      'Fulminant septic shock',
      'Disseminated intravascular coagulation (DIC)',
      'Acute renal failure',
      'ARDS',
      'Multi-organ failure',
      'Mortality 20-40% even with treatment',
    ],
    differentialDiagnosis: [
      'Type I NF',
      'Gas gangrene',
      'Pyomyositis',
      'Compartment syndrome',
    ],
    managementPrinciples: [
      'IMMEDIATE radical surgical debridement',
      'Penicillin + Clindamycin (protein synthesis inhibitor to reduce toxin production)',
      'IVIG may be considered for STSS',
      'Aggressive ICU resuscitation',
      'Early amputation consideration if limb non-viable',
      'Serial debridements every 12-24 hours',
    ],
  },
  {
    id: 'gas-gangrene',
    name: 'Gas Gangrene (Clostridial Myonecrosis)',
    severity: 'critical',
    description: 'Rapidly fatal infection of muscle tissue caused primarily by Clostridium perfringens. Characterized by massive tissue destruction, gas production, and severe systemic toxicity.',
    clinicalFeatures: [
      'Acute onset excruciating pain at wound/surgical site',
      'Rapid swelling with bronze/dark discoloration',
      'Crepitus (palpable subcutaneous gas)',
      'Thin, watery, foul-smelling ("dishwater") discharge',
      'Muscle appears "cooked" or non-contractile at surgery',
      'Gas bubbles visible in wound',
      'Skin blistering with hemorrhagic fluid',
    ],
    systemicSigns: [
      'Profound toxemia within hours',
      'Tachycardia out of proportion to fever',
      'Hemolytic anemia (jaundice, hemoglobinuria)',
      'Acute renal failure (myoglobinuria)',
      'DIC',
      'Circulatory collapse',
      'Death within 12-48 hours if untreated',
    ],
    differentialDiagnosis: [
      'Necrotizing fasciitis (non-clostridial)',
      'Anaerobic cellulitis',
      'Emphysematous cholecystitis',
      'Clostridial cellulitis (less severe)',
    ],
    imagingFindings: [
      'X-ray: Extensive feathery gas pattern within muscle groups',
      'CT: Gas within muscle compartments, muscle edema',
    ],
    managementPrinciples: [
      'IMMEDIATE radical surgical debridement/amputation',
      'High-dose IV Penicillin G + Clindamycin',
      'Hyperbaric oxygen therapy if available (adjunct, do not delay surgery)',
      'Aggressive fluid resuscitation',
      'ICU monitoring with vasopressor support',
      'Polyvalent gas gangrene antitoxin (where available)',
      'Blood transfusion for hemolytic anemia',
      'Renal replacement therapy if indicated',
    ],
  },
  {
    id: 'fourniers-gangrene',
    name: "Fournier's Gangrene",
    severity: 'critical',
    description: 'Necrotizing fasciitis of the perineum, perianal, and genital regions. Polymicrobial etiology. High mortality (20-40%). Common in diabetics, immunocompromised, and chronic alcohol users.',
    clinicalFeatures: [
      'Perineal/scrotal/vulvar pain and swelling',
      'Erythema spreading to abdominal wall, thighs',
      'Scrotal/labial edema and discoloration',
      'Crepitus in perineal/scrotal tissues',
      'Purulent or foul-smelling discharge',
      'Skin necrosis of genitalia',
    ],
    systemicSigns: [
      'Severe sepsis / septic shock',
      'High fever with rigors',
      'Multi-organ dysfunction',
      'Diabetic ketoacidosis (in diabetic patients)',
    ],
    differentialDiagnosis: [
      'Perianal abscess',
      'Strangulated hernia',
      'Testicular torsion',
      'Epididymo-orchitis',
    ],
    managementPrinciples: [
      'Emergency radical debridement of all necrotic tissue',
      'Diversion colostomy if perianal involvement',
      'Suprapubic catheter if urethral involvement',
      'Triple antibiotic therapy',
      'Serial debridements',
      'Wound VAC for large defects',
      'Reconstructive surgery after wound control (flaps, grafts)',
    ],
  },
];

// ============================================================
// LRINEC SCORING SYSTEM (Laboratory Risk Indicator for NEC Fasciitis)
// ============================================================
export const LRINEC_SCORE: LRINECScore[] = [
  {
    parameter: 'C-Reactive Protein (CRP)',
    unit: 'mg/L',
    description: 'Acute phase reactant; elevated in severe infection',
    ranges: [
      { range: '< 150', score: 0, interpretation: 'Mild inflammatory response' },
      { range: '≥ 150', score: 4, interpretation: 'Significant inflammatory response' },
    ],
  },
  {
    parameter: 'White Blood Cell Count (WBC)',
    unit: '×10³/μL',
    description: 'Marker of infection severity',
    ranges: [
      { range: '< 15', score: 0, interpretation: 'Normal to mild elevation' },
      { range: '15 - 25', score: 1, interpretation: 'Moderate leukocytosis' },
      { range: '> 25', score: 2, interpretation: 'Severe leukocytosis' },
    ],
  },
  {
    parameter: 'Hemoglobin',
    unit: 'g/dL',
    description: 'Decreased due to hemolysis or chronic disease',
    ranges: [
      { range: '> 13.5', score: 0, interpretation: 'Normal' },
      { range: '11 - 13.5', score: 1, interpretation: 'Mild anemia' },
      { range: '< 11', score: 2, interpretation: 'Significant anemia' },
    ],
  },
  {
    parameter: 'Sodium',
    unit: 'mmol/L',
    description: 'Hyponatremia from fluid shifts and toxin effects',
    ranges: [
      { range: '≥ 135', score: 0, interpretation: 'Normal' },
      { range: '< 135', score: 2, interpretation: 'Hyponatremia' },
    ],
  },
  {
    parameter: 'Creatinine',
    unit: 'mg/dL',
    description: 'Marker of renal function and hemodynamic status',
    ranges: [
      { range: '≤ 1.6', score: 0, interpretation: 'Normal renal function' },
      { range: '> 1.6', score: 2, interpretation: 'Renal impairment' },
    ],
  },
  {
    parameter: 'Glucose',
    unit: 'mg/dL',
    description: 'Hyperglycemia from stress response or diabetes',
    ranges: [
      { range: '≤ 180', score: 0, interpretation: 'Normal / mild elevation' },
      { range: '> 180', score: 1, interpretation: 'Significant hyperglycemia' },
    ],
  },
];

export const LRINEC_INTERPRETATION = [
  { range: '0 - 5', risk: 'Low', probability: '< 50%', action: 'Unlikely NSTI. Treat as cellulitis/abscess. Close follow-up.' },
  { range: '6 - 7', risk: 'Moderate', probability: '50-75%', action: 'Intermediate risk. Consider surgical consultation and advanced imaging. Close monitoring.' },
  { range: '≥ 8', risk: 'High', probability: '> 75%', action: 'High probability of NSTI. Emergent surgical exploration indicated. Do not delay for imaging.' },
];

// ============================================================
// SEPSIS SCREENING (qSOFA & SOFA)
// ============================================================
export const QSOFA_CRITERIA: SepsisScreening = {
  tool: 'Quick SOFA (qSOFA)',
  parameters: [
    { name: 'Respiratory Rate', criteria: '≥ 22 breaths/min', points: 1 },
    { name: 'Altered Mentation', criteria: 'GCS < 15', points: 1 },
    { name: 'Systolic Blood Pressure', criteria: '≤ 100 mmHg', points: 1 },
  ],
  interpretation: [
    { range: '0-1', meaning: 'Low risk', action: 'Continue standard management. Monitor closely.' },
    { range: '≥ 2', meaning: 'High risk of poor outcome', action: 'Screen for organ dysfunction. Consider ICU admission. Initiate Sepsis-3 pathway.' },
  ],
};

// ============================================================
// LABORATORY PANELS
// ============================================================
export const LAB_PANELS: LabPanel[] = [
  {
    id: 'initial-assessment',
    name: 'Initial Assessment Panel',
    applicableStages: ['all'],
    frequency: 'On presentation',
    tests: [
      { testName: 'Complete Blood Count (CBC)', rationale: 'WBC, hemoglobin for LRINEC score', expectedAbnormality: 'Leukocytosis or leukopenia, anemia', urgency: 'stat' },
      { testName: 'Basic Metabolic Panel (BMP)', rationale: 'Sodium, glucose, creatinine for LRINEC', expectedAbnormality: 'Hyponatremia, hyperglycemia, elevated creatinine', urgency: 'stat' },
      { testName: 'C-Reactive Protein (CRP)', rationale: 'LRINEC score component', expectedAbnormality: '> 150 mg/L concerning for NSTI', urgency: 'stat' },
      { testName: 'Blood Lactate', rationale: 'Tissue hypoperfusion marker, sepsis indicator', expectedAbnormality: '> 2 mmol/L indicates tissue hypoperfusion', urgency: 'stat' },
      { testName: 'Blood Culture (x2 sets)', rationale: 'Identify causative organism before antibiotics', urgency: 'stat' },
      { testName: 'Coagulation Studies (PT, aPTT, INR)', rationale: 'Screen for DIC', expectedAbnormality: 'Prolonged PT/aPTT, elevated D-dimer', urgency: 'stat' },
      { testName: 'Liver Function Tests', rationale: 'Hepatic function, bilirubin for jaundice assessment', expectedAbnormality: 'Elevated bilirubin, transaminases', urgency: 'urgent' },
      { testName: 'Blood Group & Crossmatch', rationale: 'Prepare for transfusion (hemolysis, surgical blood loss)', urgency: 'stat' },
    ],
  },
  {
    id: 'nsti-specific',
    name: 'NSTI-Specific Panel',
    applicableStages: ['necrotizing-fasciitis', 'gas-gangrene', 'fourniers'],
    frequency: 'On presentation and every 6-12hrs during acute management',
    tests: [
      { testName: 'Arterial Blood Gas (ABG)', rationale: 'Acid-base status, lactate', expectedAbnormality: 'Metabolic acidosis, elevated lactate', urgency: 'stat' },
      { testName: 'Creatine Kinase (CK)', rationale: 'Muscle necrosis marker (especially gas gangrene)', expectedAbnormality: 'Markedly elevated in myonecrosis', urgency: 'stat' },
      { testName: 'Myoglobin (serum and urine)', rationale: 'Muscle breakdown, rhabdomyolysis risk', expectedAbnormality: 'Elevated; positive urine myoglobin', urgency: 'stat' },
      { testName: 'D-dimer / Fibrinogen', rationale: 'DIC screening', expectedAbnormality: 'Elevated D-dimer, low fibrinogen', urgency: 'stat' },
      { testName: 'Procalcitonin', rationale: 'Bacterial infection biomarker, guide antibiotic duration', expectedAbnormality: '> 2 ng/mL highly suggestive of bacterial sepsis', urgency: 'urgent' },
      { testName: 'HbA1c', rationale: 'Assess chronic glycemic control (diabetic patients)', urgency: 'routine' },
      { testName: 'HIV / Hepatitis B&C Screening', rationale: 'Immunosuppression assessment, surgical risk', urgency: 'urgent' },
      { testName: 'Wound Swab / Tissue Culture & Sensitivity', rationale: 'Identify organisms and guide targeted antibiotic therapy', urgency: 'stat' },
    ],
  },
  {
    id: 'monitoring-panel',
    name: 'Daily Monitoring Panel',
    applicableStages: ['all-inpatient'],
    frequency: 'Daily or as clinically indicated',
    tests: [
      { testName: 'CBC', rationale: 'Monitor WBC trend and hemoglobin', urgency: 'routine' },
      { testName: 'Electrolytes (Na, K, Cl, HCO3)', rationale: 'Fluid and electrolyte management', urgency: 'routine' },
      { testName: 'Urea & Creatinine', rationale: 'Renal function monitoring', urgency: 'routine' },
      { testName: 'CRP', rationale: 'Treatment response monitoring', urgency: 'routine' },
      { testName: 'Blood Sugar (4-hourly in DM)', rationale: 'Glycemic control in diabetics', urgency: 'urgent' },
      { testName: 'Wound Swab (repeat)', rationale: 'Monitor for change in flora or resistance', urgency: 'routine' },
    ],
  },
];

// ============================================================
// TREATMENT PROTOCOLS
// ============================================================
export const TREATMENT_PROTOCOLS: TreatmentProtocol[] = [
  {
    id: 'cellulitis-outpatient',
    stage: 'Stage I - Simple Cellulitis',
    severity: 'mild',
    antibiotics: [
      {
        drug: 'Flucloxacillin',
        dose: '500mg',
        route: 'Oral',
        frequency: '6 hourly',
        duration: '7-10 days',
        indication: 'First-line for non-purulent cellulitis (anti-staphylococcal)',
        alternatives: ['Cephalexin 500mg QDS', 'Clindamycin 300mg TDS (if penicillin allergy)'],
        contraindications: ['Penicillin allergy', 'Hepatic impairment'],
      },
      {
        drug: 'Amoxicillin-Clavulanate',
        dose: '625mg',
        route: 'Oral',
        frequency: '8 hourly',
        duration: '7-10 days',
        indication: 'If mixed infection suspected (bite wounds, diabetic foot)',
        alternatives: ['Ciprofloxacin 500mg BD + Metronidazole 400mg TDS'],
        contraindications: ['Penicillin allergy', 'Hepatic cholestasis history'],
      },
    ],
    surgicalInterventions: [],
    supportiveCare: [
      'Limb elevation above heart level',
      'Analgesia: Paracetamol 1g QDS ± Ibuprofen 400mg TDS',
      'Mark erythema borders with skin marker',
      'Adequate hydration (≥2L/day)',
      'Treat underlying cause (tinea pedis, skin breaks)',
      'Compression stockings after resolution (if lower limb)',
    ],
    monitoring: [
      'Re-evaluate at 48-72 hours',
      'Photograph for progression documentation',
      'Temperature monitoring BD',
      'Watch for signs of deep infection',
    ],
    escalationCriteria: [
      'Failure to improve in 48-72 hours',
      'Spreading erythema despite antibiotics',
      'Development of systemic signs',
      'New fluctuance suggesting abscess',
      'Increasing pain out of proportion',
    ],
    comorbidityModifications: [
      {
        comorbidity: 'Diabetes Mellitus',
        modifications: [
          'Lower threshold for admission',
          'Add Gram-negative coverage (e.g., Ciprofloxacin)',
          'Optimize glycemic control (target BSL 6-10 mmol/L)',
          'Check HbA1c',
        ],
        additionalMonitoring: ['4-hourly blood sugar', 'Daily renal function', 'Foot examination'],
        specialConsiderations: ['Higher risk of NSTI progression', 'Consider early imaging', 'Vascular assessment if lower limb'],
      },
      {
        comorbidity: 'Chronic Kidney Disease',
        modifications: [
          'Dose adjust antibiotics to eGFR',
          'Avoid nephrotoxic agents',
          'Monitor renal function daily',
        ],
        additionalMonitoring: ['Daily U&E', 'Drug levels if applicable', 'Fluid balance'],
        specialConsiderations: ['Impaired immune response', 'Fluid overload risk', 'Consider nephrology review'],
      },
      {
        comorbidity: 'Hepatic Impairment / Jaundice',
        modifications: [
          'Avoid hepatotoxic antibiotics (Flucloxacillin with caution)',
          'Use Cephalexin or Clindamycin alternatives',
          'Coagulation assessment before any procedure',
        ],
        additionalMonitoring: ['LFTs every 48hrs', 'Coagulation studies', 'Albumin levels'],
        specialConsiderations: ['Poor wound healing', 'Increased infection risk', 'Nutritional supplementation'],
      },
    ],
  },
  {
    id: 'cellulitis-inpatient',
    stage: 'Stage II - Complicated Cellulitis',
    severity: 'moderate',
    antibiotics: [
      {
        drug: 'Ceftriaxone',
        dose: '1-2g',
        route: 'IV',
        frequency: 'Daily',
        duration: '5-7 days IV then step-down to oral',
        indication: 'Broad-spectrum empiric therapy',
        alternatives: ['Cefuroxime 1.5g IV TDS'],
        renalAdjustment: 'No adjustment unless severe renal impairment',
        contraindications: ['Cephalosporin allergy', 'History of severe penicillin allergy'],
      },
      {
        drug: 'Flucloxacillin',
        dose: '1-2g',
        route: 'IV',
        frequency: '6 hourly',
        duration: '5-7 days then oral step-down',
        indication: 'Anti-staphylococcal coverage',
        alternatives: ['Vancomycin 15-20mg/kg IV BD (if MRSA suspected)'],
        hepaticAdjustment: 'Use with caution; consider alternatives',
        contraindications: ['Penicillin allergy'],
      },
    ],
    surgicalInterventions: [
      {
        procedure: 'Incision and Drainage',
        indication: 'Fluctuant collection / abscess identified',
        timing: 'Within 24 hours of identification',
        technique: [
          'Mark incision site over point of maximal fluctuance',
          'Elliptical or cruciate incision for adequate drainage',
          'Break up loculations with finger/forceps',
          'Irrigate with normal saline',
          'Pack cavity loosely with saline-soaked gauze',
          'Send pus for culture and sensitivity',
        ],
        postoperativeCare: [
          'Daily wound review and repacking',
          'Progressive reduction of packing depth',
          'Convert to secondary intention healing',
        ],
        expectedOutcome: 'Resolution within 1-2 weeks with adequate drainage',
      },
    ],
    supportiveCare: [
      'IV fluid resuscitation (target UO > 0.5 mL/kg/hr)',
      'IV Paracetamol 1g QDS',
      'DVT prophylaxis (Enoxaparin 40mg SC daily)',
      'Limb elevation',
      'Nutritional assessment and support',
      'Diabetic team review if applicable',
    ],
    monitoring: [
      'Vital signs 4-6 hourly',
      'Daily bloods (FBC, CRP, U&E)',
      'Wound marking and daily photography',
      'Fluid balance chart',
      'Pain score assessment',
    ],
    escalationCriteria: [
      'Hemodynamic instability',
      'LRINEC score ≥ 6',
      'Pain disproportionate to findings',
      'Skin necrosis or crepitus',
      'Failure of IV therapy at 48hrs',
      'qSOFA ≥ 2',
    ],
    comorbidityModifications: [
      {
        comorbidity: 'Sepsis / Acute Renal Impairment',
        modifications: [
          'Sepsis bundle: cultures, antibiotics within 1hr, 30mL/kg crystalloid',
          'Vasopressors if MAP < 65 despite fluids',
          'Consider ICU admission',
          'Renal dose adjustment for all medications',
          'Avoid NSAIDs',
        ],
        additionalMonitoring: ['Hourly urine output', 'CVP monitoring', 'Serial lactate levels', 'Vasopressor requirements'],
        specialConsiderations: ['May need renal replacement therapy', 'Higher antibiotic doses may be needed initially', 'Early surgical consultation'],
      },
    ],
  },
  {
    id: 'nsti-protocol',
    stage: 'Stage III-IV - Necrotizing Soft Tissue Infection',
    severity: 'severe',
    antibiotics: [
      {
        drug: 'Meropenem',
        dose: '1g',
        route: 'IV',
        frequency: '8 hourly',
        duration: 'Until culture-guided therapy possible (minimum 7-14 days)',
        indication: 'Broad-spectrum coverage of Gram-positives, Gram-negatives, and anaerobes',
        alternatives: ['Piperacillin-Tazobactam 4.5g IV Q6H'],
        renalAdjustment: 'CrCl 25-50: 1g Q12H; CrCl 10-25: 500mg Q12H',
        contraindications: ['Carbapenem allergy'],
      },
      {
        drug: 'Clindamycin',
        dose: '600-900mg',
        route: 'IV',
        frequency: '8 hourly',
        duration: '7-14 days',
        indication: 'Protein synthesis inhibitor - reduces toxin production (critical for GAS & Clostridial infections)',
        alternatives: ['Linezolid 600mg IV/PO BD'],
        contraindications: ['History of C. difficile colitis'],
      },
      {
        drug: 'Vancomycin',
        dose: '15-20mg/kg',
        route: 'IV',
        frequency: '12 hourly',
        duration: 'Until MRSA ruled out',
        indication: 'MRSA coverage (empiric in high-prevalence settings)',
        alternatives: ['Linezolid 600mg IV/PO BD', 'Daptomycin 6mg/kg IV daily'],
        renalAdjustment: 'Dose per trough levels (target 15-20 μg/mL)',
        contraindications: [],
      },
    ],
    surgicalInterventions: [
      {
        procedure: 'Emergency Radical Surgical Debridement',
        indication: 'Clinical diagnosis of NSTI (do NOT delay for confirmatory investigations)',
        timing: 'Within 6-12 hours of diagnosis (SURGICAL EMERGENCY)',
        technique: [
          'Generous incision through skin and subcutaneous tissue to fascia',
          'Assess fascia: gray, non-bleeding fascia = necrotic (positive "finger test")',
          'Excise all non-viable tissue until bleeding, viable margins reached',
          'Extend incision beyond apparent margins of infection',
          'Leave wound open - NO primary closure',
          'Copious irrigation with warm normal saline',
          'Send tissue for histopathology and culture',
          'Apply negative pressure wound therapy (VAC) if available',
          'Plan re-look surgery at 24-48 hours',
        ],
        postoperativeCare: [
          'ICU admission post-operatively',
          'Daily wound assessment for further necrosis',
          'Serial debridements until no further necrosis',
          'Wound VAC therapy between debridements',
          'Nutritional optimization (high protein diet, 25-35 kcal/kg/day)',
          'Consider skin grafting / flap coverage after clean wound bed achieved',
        ],
        expectedOutcome: 'Average 3-4 debridements needed. Reconstruction after infection control.',
      },
      {
        procedure: 'Amputation',
        indication: 'Non-salvageable limb, uncontrollable sepsis despite debridement',
        timing: 'When continued debridement fails or limb non-viable',
        technique: [
          'Level of amputation: viable tissue proximal to infection',
          'Leave stump open for delayed closure',
          'Send margin tissue for frozen section if available',
        ],
        postoperativeCare: [
          'Stump care and monitoring',
          'Rehabilitation planning',
          'Prosthetic assessment when healed',
          'Psychological support',
        ],
        expectedOutcome: 'Life-saving procedure. 10-30% of NSTI cases require amputation.',
      },
    ],
    supportiveCare: [
      'ICU admission with invasive monitoring (arterial line, CVP)',
      'Aggressive IV fluid resuscitation (Sepsis-3 guidelines)',
      'Vasopressor support (Noradrenaline first-line) if MAP < 65',
      'Mechanical ventilation if ARDS/respiratory failure',
      'Blood product transfusion as needed (target Hb > 7, PLT > 50)',
      'DVT prophylaxis when not coagulopathic',
      'Stress ulcer prophylaxis (PPI)',
      'Glycemic control (insulin infusion, target 6-10 mmol/L)',
      'Nutritional support: NG/NJ feeding if unable to eat, 25-35kcal/kg/day, 1.5-2g protein/kg/day',
      'Pain management: multimodal (opioids, regional blocks, ketamine)',
      'Renal replacement therapy if AKI stage 3',
      'Wound VAC therapy for open wounds',
      'Psychological support / counseling',
    ],
    monitoring: [
      'Continuous ECG and SpO2 monitoring',
      'Hourly vital signs and urine output',
      'ABG every 6-12 hours',
      'Daily bloods: FBC, U&E, CRP, LFTs, coagulation',
      'Serial lactate levels',
      'Wound assessment and photography with each dressing change',
      'SOFA score calculation daily',
      'Nutritional adequacy review',
    ],
    escalationCriteria: [
      'Worsening organ dysfunction despite maximal therapy',
      'Ongoing tissue necrosis despite serial debridement',
      'Rising lactate despite resuscitation',
      'Requirement for increasing vasopressor doses',
      'Consider transfer to specialized center',
    ],
    comorbidityModifications: [
      {
        comorbidity: 'Diabetes Mellitus',
        modifications: [
          'Insulin infusion protocol (sliding scale IV insulin)',
          'Target blood glucose 6-10 mmol/L',
          'Check and manage diabetic ketoacidosis',
          'Vascular assessment of affected limb',
          'Lower threshold for amputation in diabetic foot NF',
        ],
        additionalMonitoring: ['Hourly BSL during insulin infusion', 'HbA1c', 'Capillary blood sugar chart'],
        specialConsiderations: ['Higher mortality in diabetic NSTI', 'Impaired wound healing', 'Increased risk of fungal superinfection'],
      },
      {
        comorbidity: 'Jaundice / Hepatic Impairment',
        modifications: [
          'Correct coagulopathy with FFP/Vitamin K before surgery',
          'Avoid hepatotoxic drugs',
          'Adjust drug doses for hepatic clearance',
          'Albumin supplementation',
        ],
        additionalMonitoring: ['INR before each surgery', 'Daily LFTs and albumin', 'Ammonia levels if encephalopathy'],
        specialConsiderations: ['Very high surgical risk', 'Poor wound healing', 'Increased bleeding risk', 'Higher mortality'],
      },
      {
        comorbidity: 'Acute Renal Impairment',
        modifications: [
          'Dose-adjust all renally cleared drugs',
          'Avoid nephrotoxic agents (aminoglycosides, NSAIDs)',
          'Early nephrology consultation',
          'Consider CRRT/HD if indicated',
        ],
        additionalMonitoring: ['Hourly urine output', 'Daily U&E + creatinine', 'Drug levels (vancomycin)', 'Fluid balance'],
        specialConsiderations: ['Myoglobinuria may cause AKI', 'Aggressive hydration to prevent renal failure', 'Alkalization of urine for myoglobinuria'],
      },
    ],
  },
  {
    id: 'gas-gangrene-protocol',
    stage: 'Stage IV - Gas Gangrene (Clostridial Myonecrosis)',
    severity: 'critical',
    antibiotics: [
      {
        drug: 'Benzylpenicillin (Penicillin G)',
        dose: '4 million units (2.4g)',
        route: 'IV',
        frequency: '4 hourly',
        duration: 'Minimum 10-14 days',
        indication: 'First-line anti-clostridial therapy',
        alternatives: ['Meropenem 1g IV Q8H if penicillin allergy'],
        contraindications: ['Severe penicillin allergy (anaphylaxis)'],
      },
      {
        drug: 'Clindamycin',
        dose: '900mg',
        route: 'IV',
        frequency: '8 hourly',
        duration: '10-14 days',
        indication: 'Essential adjunct - inhibits toxin production (alpha-toxin)',
        alternatives: ['Chloramphenicol (if clindamycin unavailable)'],
        contraindications: [],
      },
      {
        drug: 'Metronidazole',
        dose: '500mg',
        route: 'IV',
        frequency: '8 hourly',
        duration: '10-14 days',
        indication: 'Additional anaerobic coverage',
        alternatives: [],
        contraindications: ['Disulfiram-like reaction with alcohol'],
      },
    ],
    surgicalInterventions: [
      {
        procedure: 'Radical Debridement / Amputation',
        indication: 'All cases of confirmed gas gangrene',
        timing: 'IMMEDIATE - within hours of diagnosis (life-saving emergency)',
        technique: [
          'Wide excision of ALL affected muscle (non-contractile, discolored)',
          'Muscle that does not bleed or contract = non-viable, must be excised',
          'Fasciotomy of all compartments',
          'Consider guillotine amputation if extensive limb involvement',
          'Leave all wounds open',
          'Aggressive saline irrigation',
        ],
        postoperativeCare: [
          'Return to OR every 12-24 hours for re-assessment',
          'Continue debridement until clean margins',
          'Wound VAC when appropriate',
          'Stump management if amputated',
        ],
        expectedOutcome: 'Mortality 20-30% with treatment, near 100% without. Amputation rate 20-50%.',
      },
    ],
    supportiveCare: [
      'ICU admission mandatory',
      'Aggressive resuscitation for shock',
      'Blood transfusion for hemolytic anemia (may need massive transfusion)',
      'Renal protection (aggressive hydration, monitor for myoglobinuria)',
      'Hyperbaric oxygen therapy if available (3 atm, 90 min, 2-3x/day)',
      'Correction of metabolic acidosis',
      'Tetanus prophylaxis',
      'Anti-gas gangrene serum (polyvalent antitoxin) where available',
    ],
    monitoring: [
      'Continuous monitoring in ICU',
      'Serial CK levels (muscle breakdown marker)',
      'Urine color and myoglobin levels',
      'Hemolysis markers (LDH, haptoglobin, bilirubin)',
      'Coagulation profile for DIC',
      'ABG for metabolic acidosis',
    ],
    escalationCriteria: [
      'Persistent hemodynamic instability',
      'Ongoing hemolysis',
      'Spreading gas on imaging',
      'Worsening acidosis',
      'Multi-organ failure',
    ],
    comorbidityModifications: [],
  },
];

// ============================================================
// ANATOMICAL LOCATION CONSIDERATIONS
// ============================================================
export const LOCATION_CONSIDERATIONS = [
  {
    location: 'Lower Extremity',
    prevalence: 'Most common site for cellulitis',
    riskFactors: ['Lymphedema', 'Venous insufficiency', 'Tinea pedis', 'Peripheral vascular disease', 'Diabetes'],
    specialConsiderations: [
      'Assess arterial supply (ABI) before compression',
      'Rule out DVT (Wells Score)',
      'Vascular surgery consultation for ischemia',
      'Higher risk of recurrence - address lymphedema',
    ],
  },
  {
    location: 'Upper Extremity',
    prevalence: 'Common in IV drug users, lymphedema post-mastectomy',
    riskFactors: ['IV drug use', 'Lymphedema (post-axillary clearance)', 'AV fistula', 'Trauma'],
    specialConsiderations: [
      'Assess hand function and compartments',
      'Low threshold for fasciotomy in forearm',
      'Preserve critical structures (nerves, tendons)',
    ],
  },
  {
    location: 'Perineum / Genitalia',
    prevalence: "Fournier's gangrene territory",
    riskFactors: ['Diabetes', 'Perianal abscess', 'Urethral stricture', 'Chronic alcohol use'],
    specialConsiderations: [
      'Diversion colostomy if perianal involvement',
      'Suprapubic catheter if urethral involvement',
      'Urology and colorectal surgery input',
      'Testicular salvage usually possible',
      'Scrotal reconstruction with thigh flaps',
    ],
  },
  {
    location: 'Head and Neck',
    prevalence: 'Less common but high risk for airway compromise',
    riskFactors: ['Dental infections', 'Post-surgical', 'Immunocompromised'],
    specialConsiderations: [
      'Immediate airway assessment and protection',
      'CT neck with contrast urgently',
      'Risk of descending mediastinitis',
      'ENT / Maxillofacial surgery involvement',
    ],
  },
  {
    location: 'Abdominal Wall',
    prevalence: 'Post-surgical, trauma, extension from intra-abdominal source',
    riskFactors: ['Recent surgery', 'Stoma sites', 'Obesity', 'Immunosuppression'],
    specialConsiderations: [
      'CT abdomen to rule out intra-abdominal source',
      'May require laparotomy if intra-abdominal extension',
      'Complex reconstruction with mesh or flaps',
      'Stoma re-siting may be needed',
    ],
  },
];

// ============================================================
// NURSING EDUCATION PROTOCOLS
// ============================================================
export const NURSING_PROTOCOLS: NursingProtocol[] = [
  {
    id: 'wound-assessment-nsti',
    topic: 'Wound Assessment in Soft Tissue Infections',
    objectives: [
      'Accurately assess and document wound characteristics',
      'Recognize early signs of NSTI requiring urgent escalation',
      'Perform standardized wound measurements and photography',
    ],
    keyPoints: [
      'Pain out of proportion is the most important early sign of NSTI',
      'Mark wound borders with skin marker at each assessment',
      'Document: size, color, exudate, odor, wound bed, periwound skin',
      'Crepitus finding = EMERGENCY - notify surgeon immediately',
      'Use TIME framework: Tissue, Infection, Moisture, Edge',
    ],
    procedures: [
      {
        name: 'Wound Border Marking Protocol',
        steps: [
          'Clean periwound skin with normal saline',
          'Use indelible skin marker to outline erythema border',
          'Date and time each marking',
          'Measure and document distance from previous border',
          'Photograph with ruler for scale',
        ],
        equipment: ['Skin marker (indelible)', 'Paper measuring tape', 'Camera/smartphone', 'Wound assessment chart'],
        frequency: 'Every 4-6 hours during acute phase, then 8-12 hourly',
        precautions: ['Wear gloves', 'Do not press firmly on tender tissues', 'Report any expansion > 2cm to doctor'],
      },
      {
        name: 'Wound Dressing for Open NSTI Wounds',
        steps: [
          'Don PPE (gown, gloves, eye protection)',
          'Remove old dressing carefully, note exudate amount and character',
          'Irrigate wound with warm normal saline using syringe irrigation',
          'Assess wound bed for residual necrosis',
          'Apply appropriate dressing (moist wound healing principles)',
          'If VAC in situ: check seal, pressure settings, canister volume',
          'Document wound size, appearance, and dressing used',
        ],
        equipment: ['PPE kit', 'Normal saline (warmed)', '50mL syringe', 'Wound dressing pack', 'VAC machine if applicable'],
        frequency: 'Daily or as surgeon directs (may be BD in acute phase)',
        precautions: [
          'Use aseptic non-touch technique',
          'Report malodorous or increasing exudate',
          'Never pack wound tightly',
          'Monitor for bleeding',
        ],
      },
    ],
    documentation: [
      'Wound assessment chart (size, depth, undermining)',
      'Wound photography (with consent, with ruler for scale)',
      'Pain assessment score',
      'Vital signs at time of assessment',
      'Exudate type and amount',
      'Treatment applied and patient response',
    ],
    escalationTriggers: [
      'Spreading erythema beyond marked borders',
      'New crepitus or gas on palpation',
      'Hemodynamic instability (HR > 110, SBP < 100)',
      'Altered mental status',
      'New onset disproportionate pain',
      'Rapidly increasing swelling',
      'Purplish discoloration or bullae formation',
    ],
  },
  {
    id: 'sepsis-recognition',
    topic: 'Early Sepsis Recognition in Soft Tissue Infections',
    objectives: [
      'Perform systematic sepsis screening using qSOFA',
      'Initiate sepsis pathway when criteria met',
      'Complete Sepsis Six bundle within 1 hour',
    ],
    keyPoints: [
      'qSOFA ≥ 2 = high risk for sepsis',
      'Sepsis Six: Oxygen, Blood cultures, IV antibiotics, IV fluids, Lactate, Urine output',
      'Golden hour - complete bundle within 1 hour of recognition',
      'Time zero = when sepsis first identified',
    ],
    procedures: [
      {
        name: 'Sepsis Screening Protocol',
        steps: [
          'Assess respiratory rate (count for full 60 seconds)',
          'Assess mental status (GCS)',
          'Record systolic blood pressure',
          'Calculate qSOFA score',
          'If score ≥ 2: ACTIVATE SEPSIS PATHWAY',
          'Notify senior nurse and doctor immediately',
          'Begin Sepsis Six bundle',
        ],
        equipment: ['Observation chart', 'qSOFA calculator/chart', 'Sepsis pathway proforma'],
        frequency: 'With every set of vital signs (minimum 4-hourly)',
        precautions: ['Any single abnormal parameter warrants closer monitoring', 'Immunocompromised patients may not mount fever'],
      },
    ],
    documentation: [
      'Sepsis screening timestamp',
      'qSOFA score at recognition',
      'Time Sepsis Six bundle initiated',
      'Time each element completed',
      'Doctor notification time',
    ],
    escalationTriggers: [
      'qSOFA ≥ 2',
      'NEWS2 score ≥ 7',
      'Lactate > 2 mmol/L',
      'New onset confusion',
      'Urine output < 0.5 mL/kg/hr for 2 hours',
    ],
  },
];

// ============================================================
// PATIENT EDUCATION MODULES
// ============================================================
export const PATIENT_EDUCATION: PatientEducationModule[] = [
  {
    id: 'cellulitis-patient-ed',
    title: 'Understanding Your Skin Infection (Cellulitis)',
    targetAudience: 'Patients with cellulitis',
    language: 'simple',
    content: [
      {
        heading: 'What is Cellulitis?',
        body: 'Cellulitis is an infection of the skin caused by bacteria. It makes your skin red, hot, swollen, and painful. It usually happens when bacteria enter through a break in the skin, such as a cut, insect bite, or cracked skin between your toes.',
      },
      {
        heading: 'How is it Treated?',
        body: 'Your doctor will prescribe antibiotics to fight the infection. Take ALL your antibiotics even if you start feeling better. Do not stop taking them early. Rest the affected area and keep it raised (elevated) above the level of your heart when possible.',
      },
      {
        heading: 'What You Can Do at Home',
        body: 'Keep the area clean and dry. Take your medications as prescribed. Drink plenty of water. Rest and elevate the affected area. Take pain relievers as directed by your doctor.',
      },
    ],
    warningSignsToReport: [
      'The redness is spreading (getting bigger)',
      'You develop a fever (feeling very hot or having chills)',
      'The pain is getting worse despite taking pain medications',
      'You notice blisters or dark/purple patches on the skin',
      'You feel crunching or crackling under the skin (like bubble wrap)',
      'You feel confused or very unwell',
      'You cannot keep food or your medications down (vomiting)',
    ],
    selfCareInstructions: [
      'Take all your antibiotics at the correct times',
      'Keep the affected area elevated above heart level',
      'Drink at least 8 glasses of water daily',
      'Keep the skin clean and moisturized',
      'Treat any athlete\'s foot (fungal infection between toes)',
      'Do not scratch or break the skin',
      'Wear comfortable, loose clothing over the area',
    ],
    followUpGuidance: [
      'Return to clinic in 2-3 days or sooner if worsening',
      'The redness should start to improve within 48-72 hours',
      'Complete the full course of antibiotics',
      'If you have diabetes, check your blood sugar regularly',
    ],
  },
  {
    id: 'nsti-patient-ed',
    title: 'Understanding Your Serious Skin Infection (Necrotizing Fasciitis)',
    targetAudience: 'Patients/families of NSTI patients',
    language: 'simple',
    content: [
      {
        heading: 'What is Happening?',
        body: 'You/your family member has a very serious skin infection called necrotizing fasciitis (sometimes called "flesh-eating disease"). This infection spreads very fast and destroys the tissue under the skin. It is a life-threatening emergency that needs immediate surgery.',
      },
      {
        heading: 'Why is Surgery Needed?',
        body: 'The infection destroys tissue faster than antibiotics alone can stop it. Surgery removes the dead and infected tissue to save your life. You may need several operations over several days until all the infected tissue is removed.',
      },
      {
        heading: 'What to Expect',
        body: 'You will be in the Intensive Care Unit (ICU) after surgery. You will receive strong antibiotics through a drip (IV). You may need help breathing with a machine (ventilator). The surgical wound will be left open to heal and may need special wound care devices. Recovery takes weeks to months, and you may need further surgery to close the wound.',
      },
      {
        heading: 'After Recovery',
        body: 'Physical rehabilitation may be needed. Plastic surgery may be required to cover large wounds. Emotional support and counseling are available. Follow-up appointments are very important.',
      },
    ],
    warningSignsToReport: [
      'New areas of skin turning dark or purple',
      'Increasing pain that is not controlled by medications',
      'New fever or chills',
      'Feeling confused or very drowsy',
      'Swelling or redness spreading to new areas',
      'Foul-smelling discharge from the wound',
    ],
    selfCareInstructions: [
      'Keep all follow-up appointments',
      'Take medications exactly as prescribed',
      'Report any new symptoms immediately',
      'Maintain good nutrition (high protein diet)',
      'Do wound care as instructed by nurses',
      'Attend physiotherapy sessions',
    ],
    followUpGuidance: [
      'Regular follow-up with your surgical team',
      'Wound care clinic appointments',
      'Rehabilitation and physiotherapy',
      'Psychological support services if needed',
      'Diabetes/comorbidity management follow-up',
    ],
  },
];

// ============================================================
// CME ARTICLE
// ============================================================
export const STI_CME_ARTICLE: CMEArticle = {
  id: 'sti-nec-cme-2025',
  title: 'Soft Tissue Infections: From Cellulitis to Necrotizing Fasciitis - A Comprehensive Review for the Plastic and Reconstructive Surgeon',
  authors: 'Department of Plastic & Reconstructive Surgery - Continuing Medical Education Series',
  abstract: 'Soft tissue infections represent a spectrum from simple cellulitis to life-threatening necrotizing soft tissue infections (NSTIs). This CME article provides a comprehensive evidence-based review of diagnosis, risk stratification using the LRINEC score, surgical decision-making, antibiotic protocols, and management of complications including sepsis and organ failure. Special emphasis is placed on early recognition, the role of comorbidities in outcomes, and reconstructive strategies after debridement.',
  learningObjectives: [
    'Classify soft tissue infections according to depth, microbiology, and severity',
    'Calculate and interpret the LRINEC score for risk stratification',
    'Apply evidence-based antibiotic protocols for each stage of STI',
    'Describe the indications, timing, and technique of surgical debridement in NSTI',
    'Identify and manage comorbidity-specific complications (DM, renal failure, jaundice)',
    'Implement post-debridement wound management and reconstructive algorithms',
    'Recognize and initiate treatment for sepsis using Sepsis-3 criteria',
  ],
  sections: [
    {
      heading: 'Introduction and Epidemiology',
      content: `Soft tissue infections (STIs) encompass a broad clinical spectrum from superficial cellulitis to deep necrotizing soft tissue infections (NSTIs). NSTIs carry a mortality rate of 20-40% even with optimal management, and delayed diagnosis or treatment significantly worsens outcomes.

The incidence of NSTI is estimated at 0.4-1.0 per 100,000 population, though this is likely underreported in low- and middle-income settings. Risk factors include diabetes mellitus (present in 40-60% of cases), immunosuppression, chronic alcohol use, peripheral vascular disease, obesity, chronic kidney disease, and liver cirrhosis.

Early recognition and differentiation of NSTI from simple cellulitis remains the greatest clinical challenge. The plastic surgeon plays a critical role in both the acute surgical management and the subsequent reconstruction of tissue defects.`,
      references: [
        'Stevens DL, et al. Practice Guidelines for the Diagnosis and Management of Skin and Soft Tissue Infections. Clin Infect Dis. 2014;59(2):e10-52.',
        'Sartelli M, et al. WSES/GAIS/SIS-E/WSIS/AAST guidelines on soft tissue infections. World J Emerg Surg. 2022;17(1):58.',
      ],
    },
    {
      heading: 'Classification of Soft Tissue Infections',
      content: `The classification of STIs considers depth of involvement, microbiology, and clinical severity:

**By Depth:**
- Impetigo/Ecthyma: Epidermal involvement only
- Erysipelas: Upper dermis and superficial lymphatics
- Cellulitis: Dermis and subcutaneous tissue
- Necrotizing Fasciitis: Fascial planes (Type I: polymicrobial; Type II: monomicrobial GAS)
- Myonecrosis/Gas Gangrene: Muscle tissue (Clostridial or non-clostridial)

**By Microbiology:**
- Type I (Polymicrobial): Mixed aerobes and anaerobes (70-80% of NSTIs)
- Type II (Monomicrobial): Group A Streptococcus, S. aureus (including MRSA)
- Type III: Marine organisms (Vibrio vulnificus, Aeromonas)
- Type IV: Fungal (immunocompromised)

**Clinical Severity (Eron Classification):**
- Class I: No systemic toxicity, no comorbidities
- Class II: Systemic illness OR comorbidities complicating treatment
- Class III: Significant systemic toxicity OR unstable comorbidities
- Class IV: Sepsis/life-threatening infection requiring ICU`,
      references: [
        'Eron LJ, et al. Managing skin and soft tissue infections. J Antimicrob Chemother. 2003;52 Suppl 1:i3-17.',
      ],
    },
    {
      heading: 'Clinical Assessment and the LRINEC Score',
      content: `The Laboratory Risk Indicator for Necrotizing Fasciitis (LRINEC) score was developed by Wong et al. (2004) as a clinical tool to distinguish NSTI from other soft tissue infections. It uses six commonly available laboratory parameters:

| Parameter | Criteria | Score |
|-----------|----------|-------|
| CRP (mg/L) | <150 / ≥150 | 0 / 4 |
| WBC (×10³/μL) | <15 / 15-25 / >25 | 0 / 1 / 2 |
| Hemoglobin (g/dL) | >13.5 / 11-13.5 / <11 | 0 / 1 / 2 |
| Sodium (mmol/L) | ≥135 / <135 | 0 / 2 |
| Creatinine (mg/dL) | ≤1.6 / >1.6 | 0 / 2 |
| Glucose (mg/dL) | ≤180 / >180 | 0 / 1 |

**Interpretation:**
- Score ≤ 5: Low risk (<50% probability of NSTI) - manage as cellulitis
- Score 6-7: Moderate risk (50-75%) - surgical consultation, close monitoring
- Score ≥ 8: High risk (>75%) - emergent surgical exploration warranted

**Limitations:** Sensitivity 68-90%, Specificity 72-95%. Clinical judgment remains paramount. A low LRINEC score does NOT rule out NSTI - if clinical suspicion is high, proceed to surgical exploration.

The "Hard Signs" of NSTI that mandate surgical exploration regardless of LRINEC:
1. Crepitus on palpation
2. Skin necrosis/ecchymosis
3. Gas on imaging
4. Hemorrhagic bullae
5. Dishwater-gray wound drainage
6. Rapidly progressive despite IV antibiotics`,
      references: [
        'Wong CH, et al. The LRINEC score: a tool for distinguishing necrotizing fasciitis from other soft tissue infections. Crit Care Med. 2004;32(7):1535-41.',
      ],
    },
    {
      heading: 'Surgical Management',
      content: `**Timing:** NSTI is a surgical emergency. Multiple studies demonstrate that delay in surgical debridement beyond 12 hours from diagnosis significantly increases mortality (from 19% to 32-76%).

**Principles of Debridement:**
1. Generous skin incisions to widely expose fascia
2. "Finger test": Probe along fascial planes - lack of resistance = fascial necrosis
3. Excise ALL non-viable tissue until bleeding, adherent fascia reached
4. Gray, non-contractile muscle = non-viable (gas gangrene)
5. Multiple incisions may be needed to define extent
6. Leave ALL wounds open
7. Copious irrigation (≥6L warm normal saline)
8. Plan re-exploration at 24-48 hours (mandatory)

**Serial Debridements:** Average of 3.4 debridements per patient. Continue until:
- No further necrotic tissue found
- Clean, healthy granulation tissue
- CRP trending downward
- Clinical improvement

**Reconstruction (after infection control):**
- Negative pressure wound therapy (VAC) as bridge to reconstruction
- Split-thickness skin grafts for large surface area coverage
- Local/regional flaps for complex defects
- Free tissue transfer for extensive reconstruction
- Tissue expansion for secondary reconstruction

**Special Situations:**
- Fournier's gangrene: Testicular salvage (blood supply from spermatic cord, not scrotal skin); scrotal reconstruction with bilateral medial thigh advancement flaps
- Perineal NF: Consider diverting colostomy and suprapubic catheter
- Head/neck NF: Airway protection paramount; risk of mediastinal spread`,
      references: [
        'Nawijn F, et al. Time is of the essence when treating necrotizing soft tissue infections. World J Emerg Surg. 2020;15(1):4.',
        'Sarani B, et al. Necrotizing fasciitis: current concepts and review of the literature. J Am Coll Surg. 2009;208(2):279-88.',
      ],
    },
    {
      heading: 'Antibiotic Therapy',
      content: `**Empiric Therapy for NSTI (commence IMMEDIATELY, do not delay for culture results):**

Triple therapy recommended:
1. **Carbapenem** (Meropenem 1g IV Q8H) OR Piperacillin-Tazobactam 4.5g IV Q6H
   - Broad-spectrum Gram-positive, Gram-negative, and anaerobic coverage
2. **Clindamycin** 600-900mg IV Q8H
   - ESSENTIAL: Protein synthesis inhibitor reduces toxin production
   - Particularly important for GAS (Type II) and Clostridial infections
3. **Vancomycin** 15-20mg/kg IV Q12H (target trough 15-20 μg/mL)
   - MRSA coverage (empiric in high-prevalence settings)

**Culture-Guided Therapy:** De-escalate based on wound and blood culture results.

**Duration:** Minimum 2-4 weeks (tailored to clinical response, CRP trend, wound status)

**Adjunctive Therapies:**
- IVIG (1-2g/kg) for streptococcal toxic shock syndrome
- Hyperbaric oxygen for gas gangrene (adjunct, do not delay surgery)`,
      references: [
        'Stevens DL, et al. IDSA Guidelines 2014.',
        'WHO Model List of Essential Medicines 2023.',
      ],
    },
    {
      heading: 'Management of Comorbidities',
      content: `**Diabetes Mellitus (present in 40-60% of NSTI cases):**
- Insulin infusion for tight glycemic control (target 6-10 mmol/L)
- HbA1c assessment for long-term control
- Diabetic foot assessment including vascular status
- Higher amputation rates and mortality in diabetic NSTI patients
- Screen for diabetic ketoacidosis

**Acute Kidney Injury:**
- Occurs in up to 50% of NSTI patients (sepsis, myoglobinuria, nephrotoxic drugs)
- Early aggressive hydration to prevent/treat AKI
- Alkalinize urine (sodium bicarbonate) for myoglobinuria
- Dose-adjust all renally cleared drugs
- Early nephrology consultation for KDIGO Stage 2-3

**Hepatic Dysfunction / Jaundice:**
- Increased surgical bleeding risk (coagulopathy)
- Correct INR with FFP/Vitamin K before surgery
- Higher mortality in NSTI patients with liver disease
- Monitor for hepatorenal syndrome
- Avoid hepatotoxic drugs
- Nutrition optimization crucial

**Sepsis Management (Surviving Sepsis Campaign 2021):**
- Hour-1 Bundle: Measure lactate, blood cultures, broad-spectrum antibiotics, 30mL/kg crystalloid if hypotensive/lactate >4
- MAP target ≥ 65 mmHg
- Vasopressors: Noradrenaline first-line; add Vasopressin if refractory
- Consider stress-dose hydrocortisone if vasopressor-refractory shock`,
      references: [
        'Evans L, et al. Surviving Sepsis Campaign: International Guidelines 2021. Intensive Care Med. 2021;47(11):1181-1247.',
      ],
    },
  ],
  mcqQuestions: [
    {
      id: 'sti-mcq-1',
      question: 'What is the MOST reliable early clinical sign that distinguishes necrotizing fasciitis from simple cellulitis?',
      options: [
        'High fever (>39°C)',
        'Pain out of proportion to physical findings',
        'Presence of an abscess',
        'Lymphadenopathy',
      ],
      correctAnswer: 1,
      explanation: 'Pain out of proportion to apparent physical findings is the hallmark early sign of NSTI. In early NF, the skin may appear relatively normal while extensive destruction occurs in deeper tissues, producing severe pain that seems disproportionate to the visible findings.',
      reference: 'Stevens DL, et al. Clin Infect Dis. 2014;59(2):e10-52.',
      difficulty: 'basic',
    },
    {
      id: 'sti-mcq-2',
      question: 'A patient presents with a LRINEC score of 9. What is the most appropriate next step?',
      options: [
        'Start oral antibiotics and review in 48 hours',
        'Obtain MRI to confirm the diagnosis before proceeding',
        'Arrange emergent surgical exploration and debridement',
        'Admit for IV antibiotics and daily reassessment',
      ],
      correctAnswer: 2,
      explanation: 'A LRINEC score ≥8 indicates >75% probability of NSTI and warrants emergent surgical exploration. Imaging should NOT delay surgical management when clinical suspicion is high. The "golden window" for mortality benefit is within 12 hours of diagnosis.',
      reference: 'Wong CH, et al. Crit Care Med. 2004;32(7):1535-41.',
      difficulty: 'intermediate',
    },
    {
      id: 'sti-mcq-3',
      question: 'In the empiric antibiotic regimen for NSTI, why is Clindamycin added to the carbapenem?',
      options: [
        'To provide additional Gram-negative coverage',
        'To inhibit bacterial protein synthesis and reduce toxin production',
        'To prevent Clostridium difficile infection',
        'To treat potential fungal co-infection',
      ],
      correctAnswer: 1,
      explanation: 'Clindamycin is a protein synthesis inhibitor that reduces production of exotoxins by both Group A Streptococcus (streptococcal pyrogenic exotoxins) and Clostridium species (alpha-toxin). Toxin production drives much of the tissue destruction and systemic toxicity in NSTI.',
      reference: 'Stevens DL, et al. IDSA Guidelines. Clin Infect Dis. 2014.',
      difficulty: 'intermediate',
    },
    {
      id: 'sti-mcq-4',
      question: 'Which of the following is the MOST critical factor affecting mortality in necrotizing fasciitis?',
      options: [
        'Choice of antibiotic agent',
        'Time from diagnosis to first surgical debridement',
        'Patient age',
        'Type of organism cultured',
      ],
      correctAnswer: 1,
      explanation: 'Multiple studies have demonstrated that time to first surgical debridement is the single most important modifiable factor affecting NSTI mortality. Delay beyond 12 hours increases mortality from approximately 19% to 32-76%. Source control through debridement is the cornerstone of NSTI management.',
      reference: 'Nawijn F, et al. World J Emerg Surg. 2020;15(1):4.',
      difficulty: 'basic',
    },
    {
      id: 'sti-mcq-5',
      question: 'A 55-year-old diabetic male presents with scrotal pain, swelling, and crepitus. His blood glucose is 25 mmol/L and he is tachycardic. What is the MOST likely diagnosis and initial management?',
      options: [
        'Epididymo-orchitis; IV antibiotics and observation',
        'Fournier\'s gangrene; emergency radical debridement',
        'Testicular torsion; emergency exploration and orchidopexy',
        'Strangulated inguinal hernia; urgent hernia repair',
      ],
      correctAnswer: 1,
      explanation: 'The combination of scrotal pain, swelling, crepitus in a diabetic patient with metabolic derangement is classic Fournier\'s gangrene. This is a surgical emergency requiring immediate radical debridement, broad-spectrum antibiotics, and ICU admission. The testes are usually salvageable as their blood supply comes from the spermatic cord, not the scrotal skin.',
      reference: 'Sartelli M, et al. World J Emerg Surg. 2022;17(1):58.',
      difficulty: 'advanced',
    },
    {
      id: 'sti-mcq-6',
      question: 'In gas gangrene (Clostridial myonecrosis), what is the characteristic finding on surgical exploration?',
      options: [
        'Purulent collection with intact surrounding muscle',
        'Red, swollen but contractile muscle with fascial edema',
        'Non-contractile, "cooked-appearing" muscle that does not bleed',
        'Normal appearing muscle with subcutaneous fluid collection',
      ],
      correctAnswer: 2,
      explanation: 'In gas gangrene, the affected muscle appears pale, non-contractile (does not twitch with diathermy), and has a "cooked" appearance. Healthy muscle is red, bleeds when cut, and contracts with stimulation. All non-contractile, non-bleeding muscle must be excised.',
      reference: 'Stevens DL, et al. IDSA Guidelines 2014.',
      difficulty: 'advanced',
    },
    {
      id: 'sti-mcq-7',
      question: 'Which scoring system is specifically designed to differentiate necrotizing fasciitis from other soft tissue infections?',
      options: [
        'APACHE II score',
        'SOFA score',
        'LRINEC score',
        'Braden score',
      ],
      correctAnswer: 2,
      explanation: 'The Laboratory Risk Indicator for Necrotizing Fasciitis (LRINEC) score was specifically developed to differentiate NSTI from other soft tissue infections using six laboratory parameters: CRP, WBC, hemoglobin, sodium, creatinine, and glucose. A score ≥8 has >75% probability of NSTI.',
      reference: 'Wong CH, et al. Crit Care Med. 2004.',
      difficulty: 'basic',
    },
    {
      id: 'sti-mcq-8',
      question: 'According to the Surviving Sepsis Campaign 2021, what is the target time to complete the 1-hour sepsis bundle?',
      options: [
        '30 minutes from presentation',
        '1 hour from recognition of sepsis',
        '3 hours from triage',
        '6 hours from admission',
      ],
      correctAnswer: 1,
      explanation: 'The Surviving Sepsis Campaign 2021 Hour-1 Bundle should be initiated within 1 hour of sepsis recognition (Time Zero). Elements include: measure lactate, obtain blood cultures before antibiotics, administer broad-spectrum antibiotics, begin 30 mL/kg crystalloid for hypotension or lactate ≥ 4 mmol/L, and apply vasopressors if hypotensive during/after fluid resuscitation.',
      reference: 'Evans L, et al. Surviving Sepsis Campaign 2021.',
      difficulty: 'intermediate',
    },
    {
      id: 'sti-mcq-9',
      question: 'What is the recommended frequency of re-exploration after initial debridement in NSTI?',
      options: [
        'Weekly until wound is clean',
        'Only if clinical deterioration occurs',
        'Every 24-48 hours until no further necrosis found',
        'Once at 72 hours post-initial debridement',
      ],
      correctAnswer: 2,
      explanation: 'Planned re-exploration every 24-48 hours is a fundamental principle of NSTI surgical management. The average patient requires 3-4 debridements. Serial re-exploration ensures complete removal of necrotic tissue, as NF often extends beyond what is initially visible. Waiting for clinical deterioration to re-explore is associated with higher mortality.',
      reference: 'Nawijn F, et al. World J Emerg Surg. 2020.',
      difficulty: 'intermediate',
    },
    {
      id: 'sti-mcq-10',
      question: 'A patient with NSTI has a serum creatinine of 3.2 mg/dL and dark-colored urine. Which investigation would BEST identify the cause of the renal impairment?',
      options: [
        'Renal ultrasound',
        'Urine myoglobin and serum creatine kinase',
        'CT abdomen with contrast',
        'Renal biopsy',
      ],
      correctAnswer: 1,
      explanation: 'Myoglobinuria from muscle necrosis (rhabdomyolysis) is a common cause of AKI in NSTI, especially gas gangrene. Dark urine + elevated CK + elevated serum myoglobin confirms the diagnosis. Management includes aggressive IV fluid resuscitation and urine alkalinization to prevent myoglobin-induced tubular necrosis.',
      reference: 'Bosch X, et al. Rhabdomyolysis and acute kidney injury. N Engl J Med. 2009;361:62-72.',
      difficulty: 'advanced',
    },
  ],
  references: [
    'Stevens DL, et al. Practice Guidelines for the Diagnosis and Management of Skin and Soft Tissue Infections: 2014 Update by the IDSA. Clin Infect Dis. 2014;59(2):e10-52.',
    'Sartelli M, et al. 2018 WSES/SIS-E consensus conference: recommendations for the management of skin and soft tissue infections. World J Emerg Surg. 2018;13:58.',
    'Wong CH, et al. The LRINEC (Laboratory Risk Indicator for Necrotizing Fasciitis) score: a tool for distinguishing necrotizing fasciitis from other soft tissue infections. Crit Care Med. 2004;32(7):1535-41.',
    'Evans L, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2021. Intensive Care Med. 2021;47(11):1181-1247.',
    'Nawijn F, et al. Time is of the essence when treating necrotizing soft tissue infections: a systematic review and meta-analysis. World J Emerg Surg. 2020;15(1):4.',
    'WHO Model List of Essential Medicines. 23rd List, 2023. Geneva: World Health Organization.',
    'Bosch X, et al. Rhabdomyolysis and Acute Kidney Injury. N Engl J Med. 2009;361:62-72.',
    'Sarani B, et al. Necrotizing fasciitis: current concepts and review of the literature. J Am Coll Surg. 2009;208(2):279-88.',
  ],
  cmeCredits: 5,
  targetAudience: ['Plastic Surgeons', 'General Surgeons', 'Emergency Medicine Physicians', 'Surgical Residents', 'Intensivists'],
  lastUpdated: '2025-12-01',
};
