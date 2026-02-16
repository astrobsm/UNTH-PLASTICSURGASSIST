// Pressure Sore (Pressure Injury/Ulcer) Management Protocol
// Based on NPUAP/EPUAP/PPPIA International Guidelines, WHO Standards

// ============================================================
// INTERFACES
// ============================================================
export interface PressureInjuryStage {
  id: string;
  stage: string;
  name: string;
  severity: 'mild' | 'moderate' | 'severe' | 'critical';
  description: string;
  clinicalFeatures: string[];
  tissueInvolvement: string;
  typicalLocations: string[];
  differentialDiagnosis: string[];
  imagingConsiderations: string[];
  managementPrinciples: string[];
}

export interface BradenScore {
  parameter: string;
  description: string;
  levels: { score: number; label: string; criteria: string }[];
}

export interface NortonScore {
  parameter: string;
  description: string;
  levels: { score: number; label: string; criteria: string }[];
}

export interface NutritionScreening {
  tool: string;
  parameters: { name: string; criteria: string; points: number }[];
  interpretation: { range: string; meaning: string; action: string }[];
}

export interface WoundBedPreparation {
  component: string;
  acronym: string;
  description: string;
  assessment: string[];
  interventions: string[];
}

export interface PressureUlcerLabPanel {
  id: string;
  name: string;
  tests: { testName: string; rationale: string; expectedAbnormality?: string; urgency: 'stat' | 'urgent' | 'routine' }[];
  frequency: string;
  applicableStages: string[];
}

export interface PressureSoreTreatment {
  id: string;
  stage: string;
  severity: string;
  woundCare: WoundCareIntervention[];
  surgicalOptions: SurgicalOption[];
  supportiveCare: string[];
  nutritionPlan: NutritionPlan;
  pressureRelief: string[];
  antibiotics?: AntibioticOption[];
  monitoring: string[];
  comorbidityModifications: PSComorbidityMod[];
}

export interface WoundCareIntervention {
  name: string;
  indication: string;
  technique: string[];
  dressingType: string;
  frequency: string;
  precautions: string[];
}

export interface SurgicalOption {
  procedure: string;
  indication: string;
  timing: string;
  technique: string[];
  flapOptions?: string[];
  postoperativeCare: string[];
  expectedOutcome: string;
  complications: string[];
}

export interface NutritionPlan {
  calories: string;
  protein: string;
  supplements: string[];
  hydration: string;
  specialConsiderations: string[];
}

export interface AntibioticOption {
  drug: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  indication: string;
  alternatives: string[];
}

export interface PSComorbidityMod {
  comorbidity: string;
  modifications: string[];
  additionalMonitoring: string[];
  specialConsiderations: string[];
}

export interface PSNursingProtocol {
  id: string;
  topic: string;
  objectives: string[];
  keyPoints: string[];
  procedures: PSNursingProcedure[];
  documentation: string[];
  escalationTriggers: string[];
}

export interface PSNursingProcedure {
  name: string;
  steps: string[];
  equipment: string[];
  frequency: string;
  precautions: string[];
}

export interface PSPatientEducation {
  id: string;
  title: string;
  targetAudience: string;
  language: 'simple' | 'moderate' | 'advanced';
  content: { heading: string; body: string }[];
  warningSignsToReport: string[];
  selfCareInstructions: string[];
  followUpGuidance: string[];
}

export interface PSCMEArticle {
  id: string;
  title: string;
  authors: string;
  abstract: string;
  learningObjectives: string[];
  sections: { heading: string; content: string; references?: string[] }[];
  mcqQuestions: PSMCQQuestion[];
  references: string[];
  cmeCredits: number;
  targetAudience: string[];
  lastUpdated: string;
}

export interface PSMCQQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  reference: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
}

// ============================================================
// NPUAP/EPUAP STAGING SYSTEM
// ============================================================
export const PRESSURE_INJURY_STAGES: PressureInjuryStage[] = [
  {
    id: 'stage-1',
    stage: 'Stage 1',
    name: 'Non-Blanchable Erythema',
    severity: 'mild',
    description: 'Intact skin with non-blanchable redness of a localized area, usually over a bony prominence. The area may be painful, firm, soft, or warmer/cooler compared to adjacent tissue.',
    clinicalFeatures: [
      'Intact skin (no break in epidermis)',
      'Non-blanchable erythema (does not whiten when pressed)',
      'Area may be painful, firm, soft, warmer or cooler than adjacent tissue',
      'May be difficult to detect in darkly pigmented skin',
      'In dark skin: look for color changes (purple/blue), temperature differences, edema, induration',
    ],
    tissueInvolvement: 'Epidermis intact, superficial tissue changes',
    typicalLocations: ['Sacrum', 'Heels', 'Ischial tuberosities', 'Greater trochanters', 'Occiput (in supine patients)'],
    differentialDiagnosis: [
      'Moisture-associated skin damage (MASD)',
      'Incontinence-associated dermatitis (IAD)',
      'Skin tears',
      'Deep tissue pressure injury (DTPI)',
      'Medical device-related pressure injury',
    ],
    imagingConsiderations: ['Not typically required', 'Ultrasound may detect subclinical tissue damage'],
    managementPrinciples: [
      'Remove/redistrubute pressure immediately',
      'Reposition every 2 hours',
      'Use appropriate pressure redistribution surface',
      'Protect skin with barrier cream/film dressing',
      'Optimize nutrition',
      'Address underlying risk factors',
      'Monitor for progression',
    ],
  },
  {
    id: 'stage-2',
    stage: 'Stage 2',
    name: 'Partial-Thickness Skin Loss',
    severity: 'mild',
    description: 'Partial-thickness loss of dermis presenting as a shallow open ulcer with a red-pink wound bed, without slough. May also present as an intact or ruptured serum-filled blister.',
    clinicalFeatures: [
      'Shallow open ulcer with red-pink wound bed',
      'No slough present',
      'Intact or open/ruptured serum-filled blister',
      'Shiny or dry, shallow ulcer without slough or bruising',
      'Should NOT be used to describe skin tears, tape burns, perineal dermatitis, maceration, or excoriation',
    ],
    tissueInvolvement: 'Epidermis and partial dermis lost',
    typicalLocations: ['Sacrum', 'Heels', 'Elbows', 'Greater trochanters', 'Ischial tuberosities'],
    differentialDiagnosis: [
      'Skin tear',
      'Tape/adhesive injury',
      'Incontinence-associated dermatitis',
      'Moisture lesion',
    ],
    imagingConsiderations: ['Not typically required'],
    managementPrinciples: [
      'Maintain moist wound healing environment',
      'Protect wound bed from friction and shear',
      'Use transparent film, hydrocolloid, or foam dressing',
      'Pressure redistribution and repositioning',
      'Nutritional optimization',
      'Monitor for signs of infection',
      'Expected healing time: 1-4 weeks',
    ],
  },
  {
    id: 'stage-3',
    stage: 'Stage 3',
    name: 'Full-Thickness Skin Loss',
    severity: 'moderate',
    description: 'Full-thickness tissue loss. Subcutaneous fat may be visible but bone, tendon, or muscle is not exposed. Slough may be present but does not obscure the depth of tissue loss. May include undermining and tunneling.',
    clinicalFeatures: [
      'Full-thickness skin loss with visible subcutaneous fat',
      'Bone, tendon, or muscle NOT exposed',
      'Slough may be present',
      'Undermining and tunneling may be present',
      'Depth varies by anatomical location (deep in gluteal but shallow over nose/occiput)',
    ],
    tissueInvolvement: 'Full thickness: epidermis, dermis, and into subcutaneous tissue',
    typicalLocations: ['Sacrum (most common)', 'Ischial tuberosities', 'Greater trochanters', 'Heels'],
    differentialDiagnosis: [
      'Diabetic foot ulcer',
      'Venous leg ulcer',
      'Arterial ulcer',
      'Surgical wound dehiscence',
    ],
    imagingConsiderations: [
      'Consider plain X-ray to assess for underlying osteomyelitis',
      'MRI if osteomyelitis suspected',
      'Wound probe-to-bone test',
    ],
    managementPrinciples: [
      'Wound bed preparation (debridement of devitalized tissue)',
      'Sharp/surgical debridement if slough or eschar present',
      'Appropriate wound dressing (foam, alginate, hydrofiber)',
      'Negative pressure wound therapy (NPWT/VAC) consideration',
      'Aggressive nutritional support',
      'Consider surgical consultation for reconstruction',
      'Infection management if present',
      'Pressure redistribution on specialty surface',
    ],
  },
  {
    id: 'stage-4',
    stage: 'Stage 4',
    name: 'Full-Thickness Tissue Loss',
    severity: 'severe',
    description: 'Full-thickness tissue loss with exposed bone, tendon, or muscle. Slough or eschar may be present on some parts of the wound bed. Often includes undermining and tunneling. Osteomyelitis is a significant risk.',
    clinicalFeatures: [
      'Full-thickness tissue loss with exposed bone, tendon, or muscle',
      'Slough or eschar may be present',
      'Often includes undermining, sinus tracts, and tunneling',
      'Risk of osteomyelitis, sepsis, and hemorrhage',
      'Can extend into muscle and/or supporting structures (fascia, joint capsule)',
    ],
    tissueInvolvement: 'Full thickness through fascia, muscle, bone, or joint',
    typicalLocations: ['Sacrum', 'Ischial tuberosities', 'Greater trochanters'],
    differentialDiagnosis: [
      'Necrotizing fasciitis',
      'Osteomyelitis with skin breakdown',
      'Marjolin ulcer (malignant transformation)',
      'Radiation ulcer',
    ],
    imagingConsiderations: [
      'Plain X-ray: cortical irregularity, periosteal reaction',
      'MRI: gold standard for osteomyelitis diagnosis',
      'CT: bony involvement assessment',
      'Bone biopsy for definitive osteomyelitis diagnosis',
      'Wound biopsy if chronic non-healing (rule out Marjolin ulcer)',
    ],
    managementPrinciples: [
      'Surgical debridement of all necrotic tissue',
      'Bone biopsy if osteomyelitis suspected',
      'Prolonged antibiotic course if osteomyelitis confirmed (6-8 weeks)',
      'NPWT/VAC therapy for wound bed preparation',
      'Flap surgery for definitive coverage (planned reconstruction)',
      'Aggressive nutritional support (albumin >3.0, pre-albumin >15)',
      'Specialty pressure redistribution mattress',
      'Multidisciplinary team involvement',
      'Consider limb amputation if intractable or complicated by malignancy',
    ],
  },
  {
    id: 'unstageable',
    stage: 'Unstageable',
    name: 'Obscured Full-Thickness Skin and Tissue Loss',
    severity: 'severe',
    description: 'Full-thickness skin and tissue loss in which the extent of tissue damage within the ulcer cannot be confirmed because it is obscured by slough or eschar. If slough or eschar is removed, a Stage 3 or Stage 4 will be revealed.',
    clinicalFeatures: [
      'Wound bed covered by slough (yellow, tan, gray, green, or brown)',
      'Wound bed covered by eschar (tan, brown, or black)',
      'True depth cannot be determined until slough/eschar removed',
      'Stable, dry, adherent eschar on heels serves as natural (biological) cover and should NOT be removed',
    ],
    tissueInvolvement: 'Unknown until debrided - at minimum Stage 3',
    typicalLocations: ['Sacrum', 'Heels (stable eschar)', 'Ischial tuberosities'],
    differentialDiagnosis: [
      'Calciphylaxis',
      'Pyoderma gangrenosum',
      'Venous ulcer with eschar',
    ],
    imagingConsiderations: [
      'MRI after debridement to stage accurately',
      'X-ray for underlying bone changes',
    ],
    managementPrinciples: [
      'Debride to determine true stage (EXCEPTION: stable heel eschar)',
      'Sharp debridement for loose slough',
      'Autolytic debridement with moisture-retentive dressings',
      'Enzymatic debridement (collagenase) as adjunct',
      'Once debrided, re-stage and manage accordingly (Stage 3 or 4)',
      'Monitor heel eschar for signs of infection (erythema, fluctuance, drainage)',
    ],
  },
  {
    id: 'dtpi',
    stage: 'Deep Tissue Pressure Injury (DTPI)',
    name: 'Deep Tissue Pressure Injury',
    severity: 'severe',
    description: 'Intact or non-intact skin with localized area of persistent non-blanchable deep red, maroon, or purple discoloration or epidermal separation revealing a dark wound bed or blood-filled blister. Results from intense and/or prolonged pressure and shear forces at the bone-muscle interface.',
    clinicalFeatures: [
      'Persistent non-blanchable deep red, maroon, or purple discoloration',
      'Intact skin with discoloration',
      'Epidermal separation revealing dark wound bed',
      'Blood-filled blister',
      'Area may be preceded by tissue that is painful, firm, mushy, warmer or cooler than adjacent tissue',
      'May evolve rapidly exposing additional layers (can progress to Stage 3 or 4)',
      'May resolve without tissue loss or may evolve into full-thickness ulcer',
    ],
    tissueInvolvement: 'Damage originates at bone-muscle interface, progresses outward',
    typicalLocations: ['Heels', 'Sacrum', 'Ischial tuberosities'],
    differentialDiagnosis: [
      'Bruise/contusion',
      'Hematoma',
      'Dermatitis',
      'Venous insufficiency changes',
    ],
    imagingConsiderations: [
      'Ultrasound to assess tissue viability',
      'MRI for deep tissue assessment',
    ],
    managementPrinciples: [
      'Offload pressure IMMEDIATELY',
      'Monitor closely for evolution (may progress rapidly)',
      'DO NOT debride if skin intact',
      'Protect with foam or multi-layer dressing',
      'Optimize nutrition and hydration',
      'Document photographic progression',
      'May take weeks to fully evolve - track carefully',
    ],
  },
  {
    id: 'medical-device',
    stage: 'Medical Device-Related Pressure Injury',
    name: 'Medical Device-Related Pressure Injury',
    severity: 'moderate',
    description: 'A pressure injury resulting from use of devices designed and applied for diagnostic or therapeutic purposes. The resulting injury generally conforms to the pattern or shape of the device.',
    clinicalFeatures: [
      'Injury conforms to shape/pattern of medical device',
      'Common devices: O2 tubing, NG tubes, cervical collars, ETT tape, splints, casts',
      'Can occur at any body location',
      'May be mucosal (oral, nasal, urethral) or cutaneous',
    ],
    tissueInvolvement: 'Variable - from Stage 1 to Stage 4 depending on severity',
    typicalLocations: ['Ears (O2 tubing)', 'Nares (NG tube, O2 prongs)', 'Neck (cervical collar)', 'Face (NIV mask)', 'Meatus (catheter)'],
    differentialDiagnosis: [
      'Contact dermatitis from device material',
      'Adhesive injury',
      'Chemical irritation',
    ],
    imagingConsiderations: ['Rarely needed unless deep tissue involvement suspected'],
    managementPrinciples: [
      'Reposition device regularly',
      'Use padding/barrier between device and skin',
      'Ensure proper sizing of device',
      'Regular skin assessment under and around devices',
      'Stage and treat as for conventional pressure injuries',
      'Consider alternative devices if recurrent',
    ],
  },
];

// ============================================================
// BRADEN SCALE FOR PREDICTING PRESSURE SORE RISK
// ============================================================
export const BRADEN_SCALE: BradenScore[] = [
  {
    parameter: 'Sensory Perception',
    description: 'Ability to respond meaningfully to pressure-related discomfort',
    levels: [
      { score: 1, label: 'Completely Limited', criteria: 'Unresponsive to painful stimuli OR limited ability to feel pain over most of body surface' },
      { score: 2, label: 'Very Limited', criteria: 'Responds only to painful stimuli. Cannot communicate discomfort except by moaning/restlessness' },
      { score: 3, label: 'Slightly Limited', criteria: 'Responds to verbal commands but cannot always communicate discomfort or need to be turned' },
      { score: 4, label: 'No Impairment', criteria: 'Responds to verbal commands. Has no sensory deficit limiting ability to feel/voice pain' },
    ],
  },
  {
    parameter: 'Moisture',
    description: 'Degree to which skin is exposed to moisture',
    levels: [
      { score: 1, label: 'Constantly Moist', criteria: 'Skin kept moist almost constantly by perspiration, urine, etc. Dampness detected every time patient is moved/turned' },
      { score: 2, label: 'Very Moist', criteria: 'Skin often but not always moist. Linen must be changed at least once a shift' },
      { score: 3, label: 'Occasionally Moist', criteria: 'Skin occasionally moist, requiring extra linen change approximately once a day' },
      { score: 4, label: 'Rarely Moist', criteria: 'Skin usually dry. Linen only requires changing at routine intervals' },
    ],
  },
  {
    parameter: 'Activity',
    description: 'Degree of physical activity',
    levels: [
      { score: 1, label: 'Bedfast', criteria: 'Confined to bed' },
      { score: 2, label: 'Chairfast', criteria: 'Ability to walk severely limited or non-existent. Cannot bear own weight, must be assisted into chair' },
      { score: 3, label: 'Walks Occasionally', criteria: 'Walks occasionally during day but very short distances with/without assistance' },
      { score: 4, label: 'Walks Frequently', criteria: 'Walks outside room at least twice daily and inside room at least once every 2 hours' },
    ],
  },
  {
    parameter: 'Mobility',
    description: 'Ability to change and control body position',
    levels: [
      { score: 1, label: 'Completely Immobile', criteria: 'Does not make even slight changes in body or extremity position without assistance' },
      { score: 2, label: 'Very Limited', criteria: 'Makes occasional slight changes in body or extremity position but unable to make frequent or significant changes independently' },
      { score: 3, label: 'Slightly Limited', criteria: 'Makes frequent though slight changes in body or extremity position independently' },
      { score: 4, label: 'No Limitations', criteria: 'Makes major and frequent changes in position without assistance' },
    ],
  },
  {
    parameter: 'Nutrition',
    description: 'Usual food intake pattern',
    levels: [
      { score: 1, label: 'Very Poor', criteria: 'Never eats a complete meal. Rarely eats more than 1/3 of any food offered. Protein intake: 2 servings or less per day. Takes fluids poorly.' },
      { score: 2, label: 'Probably Inadequate', criteria: 'Rarely eats a complete meal. Generally eats about half of food offered. Protein intake: 3 servings per day.' },
      { score: 3, label: 'Adequate', criteria: 'Eats over half of most meals. Eats 4 servings of protein per day. Occasionally refuses a meal.' },
      { score: 4, label: 'Excellent', criteria: 'Eats most of every meal. Never refuses a meal. Usually eats 4+ servings of meat/dairy per day.' },
    ],
  },
  {
    parameter: 'Friction & Shear',
    description: 'Friction and shear forces on skin',
    levels: [
      { score: 1, label: 'Problem', criteria: 'Requires moderate to maximum assistance in moving. Complete lifting without sliding against sheets impossible. Frequently slides down in bed/chair.' },
      { score: 2, label: 'Potential Problem', criteria: 'Moves feebly or requires minimum assistance. During a move skin probably slides to some extent against sheets, chair, restraints.' },
      { score: 3, label: 'No Apparent Problem', criteria: 'Moves in bed and chair independently. Has sufficient muscle strength to lift up completely during move.' },
    ],
  },
];

export const BRADEN_INTERPRETATION = [
  { range: '19-23', risk: 'No Risk', action: 'Standard care. Re-assess weekly for inpatients.' },
  { range: '15-18', risk: 'Mild Risk', action: 'Implement basic prevention: repositioning Q2H, nutrition assessment, skin inspection daily.' },
  { range: '13-14', risk: 'Moderate Risk', action: 'Enhanced prevention: specialty mattress, repositioning schedule, nutrition consult, moisture management.' },
  { range: '10-12', risk: 'High Risk', action: 'Aggressive prevention: low-air-loss/alternating pressure mattress, strict Q2H repositioning, heel elevation, nutritional optimization, skin protection.' },
  { range: '≤ 9', risk: 'Very High Risk', action: 'Maximum prevention: all above + consider air-fluidized bed, continuous lateral rotation therapy, intensive nutritional support. Close multi-disciplinary wound team involvement.' },
];

// ============================================================
// WOUND BED PREPARATION - TIME FRAMEWORK
// ============================================================
export const TIME_FRAMEWORK: WoundBedPreparation[] = [
  {
    component: 'Tissue',
    acronym: 'T',
    description: 'Non-viable or deficient tissue management',
    assessment: [
      'Identify type of tissue: necrotic, slough, granulation, epithelial',
      'Determine percentage of wound bed with each tissue type',
      'Assess viability of wound edges',
    ],
    interventions: [
      'Sharp/surgical debridement for necrotic tissue',
      'Autolytic debridement with moisture-retentive dressings',
      'Enzymatic debridement (collagenase)',
      'Mechanical debridement (wet-to-dry, irrigation)',
      'Biological debridement (maggot therapy) for selected cases',
    ],
  },
  {
    component: 'Infection/Inflammation',
    acronym: 'I',
    description: 'Infection or inflammation control',
    assessment: [
      'Clinical signs of infection: increased pain, warmth, erythema, purulent exudate, odor',
      'Biofilm suspected in chronic non-healing wounds',
      'Wound culture if infection suspected (tissue biopsy > swab)',
      'Systemic signs: fever, leukocytosis, sepsis',
    ],
    interventions: [
      'Topical antimicrobials: silver dressings, cadexomer iodine, PHMB',
      'Systemic antibiotics ONLY for spreading cellulitis or systemic infection',
      'Biofilm management: sharp debridement + topical antimicrobial',
      'Wound irrigation with antiseptic solutions',
    ],
  },
  {
    component: 'Moisture',
    acronym: 'M',
    description: 'Moisture balance optimization',
    assessment: [
      'Assess exudate: type (serous, sanguineous, purulent), amount (none, light, moderate, heavy)',
      'Assess periwound skin for maceration or desiccation',
      'Determine if wound is too wet or too dry',
    ],
    interventions: [
      'Too wet: absorptive dressings (alginate, hydrofiber, foam)',
      'Too dry: moisture-donating dressings (hydrogel, honey)',
      'Balanced: maintain with appropriate dressing',
      'Protect periwound skin with barrier product',
      'NPWT for high-exudate wounds',
    ],
  },
  {
    component: 'Edge',
    acronym: 'E',
    description: 'Edge advancement and epithelialization',
    assessment: [
      'Is the wound edge migrating (closing)?',
      'Signs of non-advancing edges: rolled/raised, undermined, callused',
      'Assess for wound contraction and epithelialization',
    ],
    interventions: [
      'Debride non-advancing wound edges',
      'Consider advanced therapies if stalled >4 weeks despite optimal care',
      'Skin grafting for large stable wounds',
      'Growth factors or cellular therapies for refractory wounds',
      'Re-assess etiology if wound not progressing',
    ],
  },
];

// ============================================================
// LABORATORY PANELS FOR PRESSURE SORES
// ============================================================
export const PS_LAB_PANELS: PressureUlcerLabPanel[] = [
  {
    id: 'ps-initial',
    name: 'Initial Pressure Sore Assessment Panel',
    applicableStages: ['all'],
    frequency: 'On identification of pressure injury',
    tests: [
      { testName: 'Complete Blood Count (CBC)', rationale: 'Anemia assessment, infection markers (WBC)', expectedAbnormality: 'Anemia common in chronic wounds; leukocytosis if infected', urgency: 'urgent' },
      { testName: 'Serum Albumin', rationale: 'Nutritional status - key predictor of wound healing', expectedAbnormality: '< 3.0 g/dL = malnutrition, < 2.5 = severe', urgency: 'urgent' },
      { testName: 'Pre-albumin (Transthyretin)', rationale: 'Short-term nutritional status (half-life 2-3 days)', expectedAbnormality: '< 15 mg/dL = nutritional depletion', urgency: 'urgent' },
      { testName: 'Total Protein', rationale: 'Overall protein status assessment', urgency: 'routine' },
      { testName: 'HbA1c', rationale: 'Glycemic control assessment (diabetic patients)', expectedAbnormality: '> 7% = poor control, impairs healing', urgency: 'routine' },
      { testName: 'Serum Zinc', rationale: 'Essential for wound healing and collagen synthesis', expectedAbnormality: 'Low zinc impairs wound healing', urgency: 'routine' },
      { testName: 'Vitamin C (Ascorbic Acid)', rationale: 'Essential for collagen synthesis and immune function', urgency: 'routine' },
      { testName: 'Vitamin D (25-OH)', rationale: 'Deficiency impairs wound healing and immune response', urgency: 'routine' },
    ],
  },
  {
    id: 'ps-infection',
    name: 'Infection Assessment Panel',
    applicableStages: ['stage-3', 'stage-4', 'unstageable'],
    frequency: 'When infection suspected',
    tests: [
      { testName: 'Wound Culture (tissue biopsy preferred)', rationale: 'Identify causing organism; tissue biopsy > 10^5 CFU/g = infection', expectedAbnormality: 'Mixed flora common; MRSA, Pseudomonas, anaerobes', urgency: 'urgent' },
      { testName: 'Blood Culture (x2)', rationale: 'If systemic sepsis signs present', urgency: 'stat' },
      { testName: 'CRP', rationale: 'Inflammatory marker for infection monitoring', urgency: 'urgent' },
      { testName: 'ESR', rationale: 'Elevated in osteomyelitis (nonspecific)', urgency: 'routine' },
      { testName: 'Procalcitonin', rationale: 'Differentiate bacterial vs. non-bacterial inflammation', urgency: 'urgent' },
      { testName: 'Blood Sugar (random)', rationale: 'Undiagnosed or poorly controlled diabetes', urgency: 'stat' },
    ],
  },
  {
    id: 'ps-osteomyelitis',
    name: 'Osteomyelitis Workup',
    applicableStages: ['stage-4'],
    frequency: 'When probe-to-bone test positive or clinical suspicion',
    tests: [
      { testName: 'ESR', rationale: 'Elevated > 70 mm/hr highly suggestive', expectedAbnormality: '> 70 mm/hr with positive probe-to-bone test = ~89% PPV', urgency: 'urgent' },
      { testName: 'CRP', rationale: 'Acute-phase reactant; elevated in active infection', urgency: 'urgent' },
      { testName: 'Plain X-ray (affected area)', rationale: 'Cortical irregularity, periosteal reaction, bone destruction', urgency: 'urgent' },
      { testName: 'MRI (affected area)', rationale: 'Gold standard: bone marrow edema, soft tissue extent', urgency: 'urgent' },
      { testName: 'Bone Biopsy + Culture', rationale: 'Definitive diagnosis - identify organism and sensitivity', urgency: 'urgent' },
      { testName: 'Bone Histopathology', rationale: 'Confirm diagnosis and exclude malignancy (Marjolin ulcer)', urgency: 'routine' },
    ],
  },
  {
    id: 'ps-monitoring',
    name: 'Ongoing Monitoring Panel',
    applicableStages: ['all-inpatient'],
    frequency: 'Weekly or as clinically indicated',
    tests: [
      { testName: 'Albumin', rationale: 'Track nutritional improvement', urgency: 'routine' },
      { testName: 'Pre-albumin', rationale: 'Short-term nutritional trend', urgency: 'routine' },
      { testName: 'CBC', rationale: 'Hemoglobin trend, WBC for infection', urgency: 'routine' },
      { testName: 'CRP', rationale: 'Infection/inflammation trend', urgency: 'routine' },
      { testName: 'Blood Sugar (diabetic patients)', rationale: 'Glycemic monitoring', urgency: 'routine' },
      { testName: 'Wound Photography + Measurements', rationale: 'Track healing progress', urgency: 'routine' },
    ],
  },
];

// ============================================================
// TREATMENT PROTOCOLS BY STAGE
// ============================================================
export const PS_TREATMENT_PROTOCOLS: PressureSoreTreatment[] = [
  {
    id: 'ps-stage-1-2',
    stage: 'Stage 1-2 (Superficial)',
    severity: 'mild',
    woundCare: [
      {
        name: 'Stage 1 Protection',
        indication: 'Non-blanchable erythema, intact skin',
        technique: [
          'Cleanse with normal saline or pH-balanced cleanser',
          'Apply transparent film dressing or thin hydrocolloid',
          'Apply barrier cream to surrounding skin',
          'DO NOT massage over reddened area (causes further tissue damage)',
        ],
        dressingType: 'Transparent film / thin hydrocolloid',
        frequency: 'Reassess every shift; change dressing every 3-5 days or PRN',
        precautions: ['Do not place adhesive directly over fragile/damaged skin', 'Monitor for clinical worsening'],
      },
      {
        name: 'Stage 2 Moist Wound Healing',
        indication: 'Partial-thickness loss, shallow ulcer, or blister',
        technique: [
          'Cleanse gently with saline',
          'If intact blister: leave intact, protect with foam dressing',
          'If ruptured blister: apply hydrocolloid or silicone foam dressing',
          'For shallow ulcer: thin hydrocolloid or silicone foam with gentle adhesive',
        ],
        dressingType: 'Hydrocolloid / silicone foam / transparent film',
        frequency: 'Every 3-5 days or when dressing saturated',
        precautions: ['Avoid over-packing', 'Do not use wet-to-dry dressings', 'Monitor for infection signs'],
      },
    ],
    surgicalOptions: [],
    supportiveCare: [
      'Pressure redistribution every 2 hours',
      'Specialty support surface (pressure-redistribution foam mattress minimum)',
      'Heel elevation with pillows or device',
      'Incontinence management',
      'Skin moisture management',
      'Friction/shear reduction (transfer aids, slide sheets)',
    ],
    nutritionPlan: {
      calories: '30-35 kcal/kg/day',
      protein: '1.25-1.5 g/kg/day',
      supplements: ['Vitamin C 250mg BD', 'Zinc sulfate 220mg daily (if deficient)', 'Multivitamin daily'],
      hydration: '30 mL/kg/day (1 mL/kcal consumed)',
      specialConsiderations: ['Dietitian referral for comprehensive assessment', 'Oral nutritional supplements if oral intake < 75% of meals'],
    },
    pressureRelief: [
      'Reposition every 2 hours (minimum) in bed',
      'Every 15 minutes if in wheelchair (weight shifts)',
      '30-degree lateral tilt positioning (avoid 90-degree side-lying)',
      'Float heels off bed surface (pillow under calves)',
      'Minimize head-of-bed elevation to < 30 degrees to reduce shear',
      'Use draw sheet for repositioning (reduce friction)',
    ],
    monitoring: [
      'Wound assessment at each dressing change',
      'Braden Scale reassessment weekly',
      'Nutritional intake monitoring daily',
      'Skin inspection of all bony prominences every shift',
      'Document wound size and percentage healing',
    ],
    comorbidityModifications: [
      {
        comorbidity: 'Diabetes Mellitus',
        modifications: [
          'Tight glycemic control (HbA1c < 7%)',
          'Careful foot examination (diabetic neuropathy)',
          'Lower threshold for infection investigation',
        ],
        additionalMonitoring: ['Blood glucose QID', 'HbA1c quarterly', 'Monofilament sensory testing'],
        specialConsiderations: ['Healing rate 40-60% slower', 'Higher infection risk', 'May have silent ischemia'],
      },
    ],
  },
  {
    id: 'ps-stage-3-4',
    stage: 'Stage 3-4 (Deep/Full Thickness)',
    severity: 'severe',
    woundCare: [
      {
        name: 'Wound Bed Preparation',
        indication: 'Full-thickness wound with necrotic tissue, slough, or eschar',
        technique: [
          'Surgical/sharp debridement of all necrotic tissue (operating room for extensive)',
          'Serial bedside debridement for maintenance',
          'Irrigate with normal saline under pressure (35mL syringe + 19-gauge angiocath = 8 PSI)',
          'Assess for undermining and tunneling (probe gently with sterile cotton-tipped applicator)',
          'Pack loosely to eliminate dead space (do not overfill)',
          'Protect wound edges and periwound skin',
        ],
        dressingType: 'Alginate / hydrofiber / foam cavity dressings',
        frequency: 'Daily to every 2-3 days depending on amount of exudate and necrotic tissue',
        precautions: [
          'Probe-to-bone test at each debridement (if positive consider osteomyelitis)',
          'Avoid disruption of fragile granulation tissue',
          'Monitor for hemorrhage during debridement',
          'Keep patient NPO if surgical debridement planned under anesthesia',
        ],
      },
      {
        name: 'Negative Pressure Wound Therapy (NPWT/VAC)',
        indication: 'Clean wound bed after debridement, high exudate management, wound bed preparation for surgery',
        technique: [
          'Apply dark (black) GranuFoam sponge cut to wound shape',
          'Do not place over exposed blood vessels, nerves, or organs',
          'Seal with adhesive drape ensuring airtight seal',
          'Set pressure at 125 mmHg continuous (standard)',
          'Change every 48-72 hours',
        ],
        dressingType: 'VAC/NPWT system with GranuFoam or WhiteFoam',
        frequency: 'Change every 48-72 hours',
        precautions: [
          'Ensure hemostasis before application',
          'Count all sponge pieces (document)',
          'Monitor for bleeding, pain, or air leak',
          'Do not use on malignant wounds or unexplored fistulas',
        ],
      },
    ],
    surgicalOptions: [
      {
        procedure: 'Surgical Debridement',
        indication: 'Stage 3-4 with significant necrotic tissue, eschar, or osteomyelitis',
        timing: 'Within 72 hours for infected wounds; planned for clean wounds',
        technique: [
          'Excise all necrotic tissue to healthy bleeding margins',
          'Remove infected bone (ostectomy) if osteomyelitis confirmed',
          'Shape the bony prominence to reduce focal pressure (ischiectomy, trochanteric prominence reduction)',
          'Obtain tissue and bone cultures',
          'Achieve hemostasis',
          'Pack wound open for VAC or secondary closure',
        ],
        postoperativeCare: [
          'NPWT until wound bed ready for closure',
          'Nutritional optimization (albumin > 3.0 pre-op)',
          'Antibiotics if osteomyelitis (6-8 weeks culture-guided)',
          'Air-fluidized bed or specialty mattress',
        ],
        expectedOutcome: 'Clean wound suitable for flap coverage in 2-4 weeks',
        complications: ['Hemorrhage', 'Wound infection', 'Recurrence (30-60%)', 'Fracture if excessive bone excision'],
      },
      {
        procedure: 'Flap Reconstruction - Sacral Pressure Sore',
        indication: 'Stage 3-4 sacral ulcer after wound bed preparation and infection control',
        timing: 'After minimum 2-4 weeks of wound preparation, albumin > 3.0, infection controlled',
        technique: [
          'Excise ulcer, bursa, and any calcified tissue',
          'Ostectomy of bony prominence as needed',
          'Flap options based on defect size and previous surgery',
        ],
        flapOptions: [
          'Gluteal rotation flap (most common)',
          'V-Y gluteal advancement flap',
          'Superior gluteal artery perforator (SGAP) flap',
          'Gluteal fasciocutaneous flap',
          'Bilateral gluteal V-Y advancement (for large defects)',
        ],
        postoperativeCare: [
          'Air-fluidized bed (Clinitron) for 4-6 weeks',
          'STRICT no sitting for 6-8 weeks',
          'Progressive mobilization protocol after 6 weeks',
          'Drain management until output < 30mL/24hr',
          'Suture/staple removal at 3 weeks',
          'Lifelong pressure redistribution education',
        ],
        expectedOutcome: '70-90% primary healing rate; 30-60% recurrence over 5 years',
        complications: ['Flap dehiscence (10-20%)', 'Hematoma/seroma', 'Infection', 'Recurrence (30-60%)', 'Flap necrosis'],
      },
      {
        procedure: 'Flap Reconstruction - Ischial Pressure Sore',
        indication: 'Stage 3-4 ischial ulcer (most common in wheelchair-bound patients)',
        timing: 'After wound preparation, nutritional optimization, bowel program established',
        technique: [
          'Excise ulcer, bursa, and scar tissue',
          'Partial ischiectomy (avoid removing >50% of weight-bearing surface)',
          'Flap selection based on defect and patient factors',
        ],
        flapOptions: [
          'Posterior thigh V-Y hamstring advancement flap (workhorse for ischial sores)',
          'Gluteal rotation flap',
          'Gracilis myocutaneous flap',
          'Inferior gluteal artery flap',
          'Biceps femoris V-Y advancement flap',
        ],
        postoperativeCare: [
          'Air-fluidized bed for 4-6 weeks',
          'No sitting for minimum 6-8 weeks',
          'Gradual sitting protocol after 6-8 weeks (15 min → increase by 15 min/week)',
          'Custom wheelchair cushion (fitted before discharge)',
          'Pressure mapping to optimize cushion',
          'Lifelong self-inspection education',
        ],
        expectedOutcome: 'Primary healing 70-90%; highest recurrence rate among all pressure sore sites',
        complications: ['Recurrence (up to 70% in wheelchair users)', 'Dehiscence', 'Ischial fracture (if excessive ischiectomy)', 'Contralateral sore development'],
      },
      {
        procedure: 'Flap Reconstruction - Trochanteric Pressure Sore',
        indication: 'Stage 3-4 trochanteric ulcer',
        timing: 'After wound preparation and infection control',
        technique: [
          'Excise ulcer and bursa',
          'Smooth trochanteric prominence',
          'Flap coverage',
        ],
        flapOptions: [
          'Tensor fascia lata (TFL) flap (workhorse for trochanteric sores)',
          'Vastus lateralis muscle flap',
          'Anterolateral thigh (ALT) flap',
          'Gluteal rotation flap',
        ],
        postoperativeCare: [
          'Avoid lateral positioning on operative side for 6 weeks',
          'Specialty mattress',
          'Progressive mobilization',
        ],
        expectedOutcome: 'Good primary healing rates with TFL flap',
        complications: ['Donor site morbidity', 'Recurrence', 'Hip contracture'],
      },
    ],
    supportiveCare: [
      'Air-fluidized bed (Clinitron) or low-air-loss mattress',
      'Strict Q2H repositioning protocol',
      'Physical therapy for mobility optimization',
      'Occupational therapy for ADL and seating assessment',
      'Pain management (multimodal approach)',
      'Spasm management (baclofen, diazepam if spinal cord injury)',
      'Bowel and bladder program (prevent incontinence)',
      'Psychological support (depression common in chronic wound patients)',
      'Social work involvement for discharge planning',
    ],
    nutritionPlan: {
      calories: '30-35 kcal/kg/day',
      protein: '1.5-2.0 g/kg/day (HIGH protein)',
      supplements: [
        'Vitamin C 500mg BD (collagen synthesis)',
        'Zinc sulfate 220mg daily (if deficient)',
        'Vitamin A 25,000 IU daily for 10 days (epithelialization, avoid in pregnancy)',
        'Iron supplementation if anemic',
        'Vitamin D if deficient',
        'Oral nutritional supplements (Ensure/Fortisip) if intake inadequate',
        'Arginine 9g/day (enhances collagen synthesis and immune function)',
      ],
      hydration: '30 mL/kg/day minimum',
      specialConsiderations: [
        'Pre-albumin target > 15 mg/dL before flap surgery',
        'Albumin target > 3.0 g/dL before surgery',
        'Calorie count for 3 days to assess actual intake',
        'Consider NG/PEG feeding if oral intake consistently < 50%',
      ],
    },
    pressureRelief: [
      'Air-fluidized bed (Clinitron) for Stage 4 and post-flap patients',
      'Low-air-loss mattress as minimum for Stage 3-4',
      'Alternating pressure mattress for those who cannot reposition',
      'Custom wheelchair cushion (ROHO/Jay) pressure-mapped',
      'Tilt-in-space wheelchair for high-risk patients',
      'Standing frame program if appropriate',
      'Pressure mapping to optimize support surface selection',
    ],
    antibiotics: [
      {
        drug: 'Flucloxacillin',
        dose: '500mg-1g',
        route: 'Oral/IV',
        frequency: '6 hourly',
        duration: '7-14 days for soft tissue infection',
        indication: 'Cellulitis surrounding pressure ulcer (staphylococcal coverage)',
        alternatives: ['Cephalexin 500mg QDS', 'Clindamycin 300mg TDS (penicillin allergy)'],
      },
      {
        drug: 'Amoxicillin-Clavulanate',
        dose: '625mg (oral) / 1.2g (IV)',
        route: 'Oral/IV',
        frequency: '8 hourly',
        duration: '7-14 days',
        indication: 'Mixed infection / polymicrobial wound infection',
        alternatives: ['Ciprofloxacin 500mg BD + Metronidazole 400mg TDS'],
      },
      {
        drug: 'Ciprofloxacin',
        dose: '500mg',
        route: 'Oral',
        frequency: '12 hourly',
        duration: '6-8 WEEKS for osteomyelitis',
        indication: 'Gram-negative osteomyelitis (based on bone culture)',
        alternatives: ['Levofloxacin 750mg daily'],
      },
    ],
    monitoring: [
      'Weekly wound measurements and photography',
      'Weekly Braden Scale reassessment',
      'Weekly albumin/pre-albumin',
      'Daily nutritional intake documentation',
      'Repositioning log compliance audit',
      'Weekly caloric intake assessment',
      'Monthly wound healing rate calculation (>10-15% reduction per week expected)',
      'Monitor for signs of osteomyelitis',
    ],
    comorbidityModifications: [
      {
        comorbidity: 'Spinal Cord Injury',
        modifications: [
          'Lifetime risk of pressure sore is 25-85%',
          'Seating clinic assessment and custom wheelchair cushion',
          'Regular skin inspection education (using mirror)',
          'Spasm management to reduce shear forces',
          'Autonomic dysreflexia awareness (T6 and above)',
          'Specialized rehabilitation program',
        ],
        additionalMonitoring: ['Annual comprehensive skin assessment', 'Seating system evaluation annually', 'Psychology review for adherence'],
        specialConsiderations: ['Highest recurrence rates', 'Multiple flap procedures may be needed over lifetime', 'Preserve flap options for future'],
      },
      {
        comorbidity: 'Diabetes Mellitus',
        modifications: [
          'Tight glycemic control essential',
          'HbA1c optimization (<7% before elective surgery)',
          'Peripheral vascular assessment',
          'Enhanced infection surveillance',
        ],
        additionalMonitoring: ['BSL QID', 'HbA1c 3-monthly', 'Peripheral pulses assessment'],
        specialConsiderations: ['Impaired healing', 'Higher infection rate', 'Neuropathy may mask pain', 'Consider vascular input for lower limb sores'],
      },
      {
        comorbidity: 'Malnutrition',
        modifications: [
          'Aggressive nutritional supplementation is critical',
          'DO NOT proceed with flap surgery until albumin > 3.0',
          'Consider enteral feeding if oral intake inadequate',
          'Dietitian to manage nutritional plan daily',
        ],
        additionalMonitoring: ['Twice-weekly albumin and pre-albumin', 'Daily calorie counts', 'Weekly weight'],
        specialConsiderations: ['Malnutrition is the #1 modifiable risk factor for non-healing', 'Wound healing will NOT occur with malnutrition'],
      },
      {
        comorbidity: 'Incontinence',
        modifications: [
          'Establish bowel and bladder management program',
          'Use barrier creams for perineal skin protection',
          'Consider fecal management system for persistent diarrhea',
          'Catheter care protocol',
          'Diverting colostomy for perineal wounds at high risk of fecal contamination',
        ],
        additionalMonitoring: ['Skin assessment with each incontinence episode', 'Daily perineal skin inspection'],
        specialConsiderations: ['Fecal contamination of sacral/ischial sores dramatically increases infection risk'],
      },
    ],
  },
];

// ============================================================
// ANATOMICAL LOCATION GUIDE FOR PRESSURE SORES
// ============================================================
export const PS_LOCATION_GUIDE = [
  {
    location: 'Sacrum',
    prevalence: 'Most common site (36-39% of all pressure sores)',
    position: 'Supine lying',
    riskFactors: ['Immobility', 'Incontinence', 'Malnutrition', 'Spinal cord injury'],
    flapOptions: ['Gluteal rotation', 'V-Y gluteal advancement', 'SGAP perforator flap'],
    specialConsiderations: [
      'Often complicated by incontinence → fecal contamination',
      'Consider diverting colostomy for contaminated wounds',
      'Flap survival excellent if offloaded properly',
    ],
  },
  {
    location: 'Ischial Tuberosity',
    prevalence: 'Second most common (24% of all pressure sores)',
    position: 'Seated position (wheelchair)',
    riskFactors: ['Wheelchair-bound', 'Spinal cord injury', 'Amputation (weight redistribution)', 'Malnutrition'],
    flapOptions: ['Posterior thigh V-Y advancement', 'Gracilis myocutaneous', 'Gluteal rotation', 'Biceps femoris flap'],
    specialConsiderations: [
      'Highest recurrence rate (50-70%)',
      'Ischiectomy must be conservative (<50%)',
      'Custom wheelchair cushion essential for prevention',
      'Progressive sitting protocol crucial post-surgery',
    ],
  },
  {
    location: 'Greater Trochanter',
    prevalence: 'Third most common (12-19%)',
    position: 'Lateral lying',
    riskFactors: ['Lateral positioning', 'Wasting/cachexia', 'Hip contracture'],
    flapOptions: ['Tensor fascia lata (TFL)', 'Vastus lateralis', 'ALT flap'],
    specialConsiderations: [
      'TFL is workhorse flap',
      'Often associated with hip contracture',
      'May need hip surgery (release contracture) before flap',
    ],
  },
  {
    location: 'Heel',
    prevalence: '12% of all pressure sores',
    position: 'Supine lying',
    riskFactors: ['Peripheral vascular disease', 'Diabetes', 'Heel position in bed', 'Spinal cord injury'],
    flapOptions: ['Reverse sural artery flap', 'Free flap (rare)', 'Skin grafting'],
    specialConsiderations: [
      'MUST assess vascular status before any intervention',
      'Stable, dry, intact eschar on heels should NOT be debrided',
      'Offloading is primary treatment (heel suspension devices)',
      'ABI < 0.5 consider vascular surgery before wound management',
    ],
  },
  {
    location: 'Occiput',
    prevalence: 'Common in ICU patients (ventilated/sedated)',
    position: 'Supine lying in ICU',
    riskFactors: ['Ventilated patients', 'Sedation', 'Cervical spine immobilization'],
    flapOptions: ['Local rotation flaps', 'Scalp advancement'],
    specialConsiderations: [
      'Prevention key: gel pillow, regular repositioning',
      'Risk of skull exposure/osteomyelitis',
      'Hair loss at affected area',
    ],
  },
];

// ============================================================
// NURSING EDUCATION PROTOCOLS
// ============================================================
export const PS_NURSING_PROTOCOLS: PSNursingProtocol[] = [
  {
    id: 'ps-prevention',
    topic: 'Pressure Injury Prevention Protocol',
    objectives: [
      'Perform accurate Braden Scale assessment',
      'Implement individualized prevention plan based on risk score',
      'Execute proper repositioning techniques',
      'Identify and manage contributing factors',
    ],
    keyPoints: [
      'ALL patients must have Braden Scale assessment on admission and weekly thereafter',
      'Reposition every 2 hours minimum (more frequently for Braden ≤ 12)',
      '30-degree lateral tilt position (avoid 90-degree side-lying)',
      'NEVER massage over bony prominences or reddened areas',
      'Keep skin clean and dry; apply moisture barrier for incontinent patients',
      'Float heels off bed (pillow under calves)',
      'Minimize head-of-bed elevation to < 30 degrees when clinically possible',
      'Use slide sheets and transfer aids to reduce friction/shear',
    ],
    procedures: [
      {
        name: '2-Hourly Repositioning Protocol',
        steps: [
          'Check current position and plan next position using turning schedule',
          'Explain procedure to patient and gain cooperation',
          'Use draw sheet/slide sheet (minimum 2 staff for immobile patients)',
          'Position using 30-degree lateral tilt (NOT 90-degree side-lying)',
          'Place pillows: between knees, behind back, under calves (heels off bed)',
          'Ensure no skin-on-skin contact (use breathable padding)',
          'Align patient properly to reduce shear forces',
          'Document position, time, and skin assessment',
          'Set alarm for next repositioning time',
        ],
        equipment: ['Draw sheet/slide sheet', 'Positioning pillows/wedges', 'Heel suspension devices', 'Pressure redistribution mattress'],
        frequency: 'Every 2 hours (may be more frequent based on Braden score)',
        precautions: [
          'Avoid dragging patient (creates shear forces)',
          'Check device sites (O2 tubing, NG tube) at each reposition',
          'Document if patient refuses repositioning and notify charge nurse',
          'Never position directly on trochanter (30-degree tilt only)',
        ],
      },
      {
        name: 'Comprehensive Skin Assessment',
        steps: [
          'Perform head-to-toe skin inspection during bath/hygiene care',
          'Focus on bony prominences: sacrum, heels, ischium, trochanters, occiput, elbows',
          'Check under and around medical devices',
          'Assess for: color changes, temperature differences, edema, induration, moisture',
          'In dark skin: use good lighting, palpate for temperature/texture changes',
          'Document findings on skin assessment chart',
          'Stage any pressure injuries found per NPUAP/EPUAP criteria',
          'Photograph new findings (with consent, with ruler)',
          'Report new or worsening findings to doctor immediately',
        ],
        equipment: ['Penlight/flashlight', 'Moisture meter (if available)', 'Camera', 'Skin assessment chart', 'Wound care ruler'],
        frequency: 'Every shift, with thorough assessment at each bath/hygiene care',
        precautions: [
          'Early identification is KEY to prevention',
          'Dark skin: cannot rely on blanching test - use palpation and visual inspection for purple/darker areas',
          'Always check under devices at each shift',
        ],
      },
    ],
    documentation: [
      'Braden Scale score (on admission, weekly, and with condition change)',
      'Repositioning schedule and compliance log',
      'Skin inspection findings each shift',
      'Support surface in use',
      'Nutritional intake tracking',
      'Patient/family education provided',
      'Any refusal of repositioning (documented with reason)',
    ],
    escalationTriggers: [
      'New non-blanchable redness (potential Stage 1)',
      'Skin breakdown at any site',
      'Worsening of existing pressure injury',
      'Braden Score declining',
      'Patient unable or refusing to reposition',
      'Inadequate nutritional intake',
      'New incontinence',
    ],
  },
  {
    id: 'ps-wound-care-nursing',
    topic: 'Pressure Ulcer Wound Care Nursing Protocol',
    objectives: [
      'Perform accurate wound assessment using NPUAP/EPUAP staging',
      'Execute appropriate wound care for each stage',
      'Recognize signs of wound infection and osteomyelitis',
      'Manage NPWT/VAC devices safely',
    ],
    keyPoints: [
      'Use MEASURE framework: Measure, Exudate, Appearance, Suffering, Undermining, Re-evaluate, Edge',
      'Wound photographs with EVERY dressing change (ruler for scale)',
      'Track wound dimensions weekly (length x width x depth)',
      'Expected healing: 10-15% size reduction per week = adequate progress',
      'If no progress at 4 weeks despite optimal care: re-evaluate etiology and management plan',
    ],
    procedures: [
      {
        name: 'Wound Dressing Change Protocol',
        steps: [
          'Gather all equipment; explain procedure to patient',
          'Administer analgesia 30 min prior if needed',
          'Don PPE: gown, gloves, eye protection',
          'Remove old dressing carefully; note characteristics of exudate',
          'Cleanse wound with normal saline using gentle irrigation',
          'Assess wound bed: tissue type, size, depth, undermining, tunneling',
          'Apply appropriate dressing (per wound care plan)',
          'Secure dressing without excess tension/pressure',
          'Document assessment and treatment',
          'Photograph wound (with consent, ruler for scale)',
        ],
        equipment: ['PPE', 'Normal saline (warmed)', 'Irrigation syringe', 'Wound care pack', 'Appropriate dressing', 'Wound assessment chart', 'Camera'],
        frequency: 'Per wound care plan (daily to every 3 days depending on stage and exudate)',
        precautions: [
          'Aseptic non-touch technique for all Stage 3-4 and post-surgical wounds',
          'Never force-remove adherent dressings (moisten first)',
          'Monitor for increased pain, odor, or exudate (infection signs)',
        ],
      },
    ],
    documentation: [
      'Wound dimensions (L x W x D) in cm',
      'Wound bed tissue type and percentage',
      'Exudate type and amount',
      'Periwound skin condition',
      'Wound edges: advancing, epibole/rolled, macerated',
      'Pain score at dressing change',
      'Dressing type and technique used',
      'Wound photograph',
      'Patient tolerance and response',
    ],
    escalationTriggers: [
      'Wound enlarging despite appropriate care',
      'Signs of local infection: increased pain, warmth, purulent exudate, odor',
      'Suspected osteomyelitis: probe-to-bone test positive',
      'Systemic signs of infection: fever, tachycardia, elevated WBC',
      'No healing progress at 4 weeks',
      'Exposed bone or tendon',
      'Significant hemorrhage during debridement or dressing change',
    ],
  },
];

// ============================================================
// PATIENT EDUCATION
// ============================================================
export const PS_PATIENT_EDUCATION: PSPatientEducation[] = [
  {
    id: 'ps-patient-general',
    title: 'Understanding Pressure Sores (Pressure Injuries)',
    targetAudience: 'Patients and caregivers',
    language: 'simple',
    content: [
      {
        heading: 'What is a Pressure Sore?',
        body: 'A pressure sore (also called a pressure ulcer, bed sore, or pressure injury) is damage to the skin and the tissue underneath caused by staying in one position for too long. The weight of your body presses your skin against the bed or chair, which stops blood from flowing to that area. Without blood, the skin and tissue can be damaged or die.',
      },
      {
        heading: 'Who Gets Pressure Sores?',
        body: 'People who cannot move easily are at the highest risk. This includes people who are bedfast (stay in bed), wheelchair users, people after surgery or injury, elderly persons, and those with conditions that reduce feeling (like spinal cord injury or diabetes). Poor nutrition, being too thin or too heavy, and moist skin (from sweat or incontinence) also increase risk.',
      },
      {
        heading: 'Where Do Pressure Sores Happen?',
        body: 'They usually occur over bony areas: the tailbone (sacrum), heels, hips, sit bones (ischial tuberosities), elbows, shoulder blades, and back of the head. Any place where bone is close to the skin surface and under pressure can develop a sore.',
      },
      {
        heading: 'How Are They Treated?',
        body: 'Treatment depends on the severity. Mild sores are treated by relieving pressure, keeping the area clean, and using special dressings. Severe sores may need surgery to remove dead tissue and may require a skin and muscle flap operation to close the wound. Good nutrition (especially protein) is essential for healing.',
      },
      {
        heading: 'How Can You Help Prevent Them?',
        body: 'Change position at least every 2 hours in bed and every 15-30 minutes in a wheelchair. Keep skin clean and dry. Eat well, especially protein-rich foods. Check your skin daily (use a mirror for areas you cannot see). Use special mattresses and cushions recommended by your healthcare team. Tell your nurse or doctor immediately if you see any skin changes.',
      },
    ],
    warningSignsToReport: [
      'New red or dark areas on skin that do not go away when pressure is released',
      'Any open sore or blister on your skin',
      'An existing sore getting bigger or deeper',
      'Pus, bad smell, or increased drainage from a wound',
      'Fever or feeling unwell',
      'Increased pain at the wound site',
      'The skin around the wound becoming red, warm, or swollen',
    ],
    selfCareInstructions: [
      'Change position every 2 hours in bed, every 15-30 minutes in wheelchair',
      'Check your entire skin daily, especially bony areas (use a mirror for your back and bottom)',
      'Keep skin clean and dry; apply moisturizer to dry areas',
      'Use barrier cream if you have bladder or bowel leakage',
      'Eat a balanced diet rich in protein (meat, fish, eggs, beans, dairy)',
      'Drink plenty of fluids (aim for 8 glasses of water daily)',
      'Use your special mattress/cushion as recommended',
      'Do NOT sit or lie directly on your sore',
      'Do NOT massage red or dark skin areas',
      'Keep bedsheets smooth and wrinkle-free',
      'Attend all follow-up appointments',
    ],
    followUpGuidance: [
      'Weekly wound clinic appointments until healed (or as directed)',
      'Regular nutritional assessment (blood tests periodically)',
      'Seating clinic if wheelchair user (custom cushion fitting)',
      'If you had surgery: follow strict instructions about sitting/lying positions',
      'Lifelong skin care and pressure prevention measures',
    ],
  },
  {
    id: 'ps-caregiver-ed',
    title: 'Caregiver Guide: Preventing and Managing Pressure Sores',
    targetAudience: 'Family members and caregivers',
    language: 'moderate',
    content: [
      {
        heading: 'Your Role is Critical',
        body: 'As a caregiver, you play the most important role in preventing and managing pressure sores. Your daily attention to the patient\'s skin, positioning, and nutrition makes the difference between healing and complications. This guide provides you with the knowledge and skills to provide excellent care.',
      },
      {
        heading: 'Daily Skin Inspection',
        body: 'Check the patient\'s skin at least twice daily, especially over bony areas (sacrum/tailbone, heels, hips, sit bones, elbows, back of head). Use good lighting. For dark-skinned patients, feel for areas of warmth, hardness, or bogginess instead of relying on color changes. Report any new findings to the healthcare team immediately.',
      },
      {
        heading: 'Repositioning Technique',
        body: 'In bed: Reposition every 2 hours using a turning schedule. Alternate between back, right 30-degree tilt, and left 30-degree tilt. NEVER position at 90 degrees on the side. Use pillows between the knees, behind the back, and under the calves to float the heels. Never drag the patient - use a slide sheet with two people. In a wheelchair: Help the patient shift weight every 15-30 minutes. Ensure the wheelchair cushion is the one prescribed by the seating clinic.',
      },
      {
        heading: 'Nutrition Tips',
        body: 'Healing pressure sores requires extra nutrition. High-protein foods: meat, fish, eggs, milk, cheese, beans, nuts. Fruits and vegetables for vitamins. Ensure the patient drinks at least 8 cups of water daily. If prescribed, give nutritional supplements (like Ensure). If the patient eats less than half their meals, notify the healthcare team.',
      },
      {
        heading: 'Wound Care at Home',
        body: 'Follow the wound care instructions provided by the wound care nurse exactly. Keep the wound clean using saline as directed. Change dressings at the scheduled times. Wash your hands before and after wound care. Watch for signs of infection: increased redness, warmth, swelling, pus, bad smell, or fever. Contact the healthcare team if you notice any of these.',
      },
    ],
    warningSignsToReport: [
      'Any new areas of skin redness, purple color, or blistering',
      'The wound getting larger, deeper, or developing a bad smell',
      'New drainage from the wound, especially if thick, yellow, or green',
      'Fever (temperature above 38°C / 100.4°F)',
      'Patient complaining of increased pain at the wound',
      'Patient not eating or drinking well',
      'Wound care supplies running low',
    ],
    selfCareInstructions: [
      'Follow the repositioning schedule strictly - set alarms',
      'Keep a log of repositioning times and skin inspection findings',
      'Maintain the prescribed diet and supplements',
      'Keep the patient\'s skin clean and dry',
      'Apply barrier cream with each incontinence episode',
      'Ensure the mattress/cushion is functioning properly',
      'Attend wound care education sessions offered by the clinic',
      'Take care of your own health and seek respite care when needed',
    ],
    followUpGuidance: [
      'Attend all scheduled wound care appointments',
      'Bring the patient\'s food/intake diary to appointments',
      'Show any new skin concerns to the healthcare team',
      'Ask for help or re-training if wound care techniques are unclear',
    ],
  },
];

// ============================================================
// CME ARTICLE
// ============================================================
export const PS_CME_ARTICLE: PSCMEArticle = {
  id: 'ps-cme-2025',
  title: 'Pressure Injuries: Comprehensive Evidence-Based Management from Prevention to Reconstruction - A Guide for the Plastic Surgeon',
  authors: 'Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery - Continuing Medical Education Series',
  abstract: 'Pressure injuries remain a significant healthcare burden affecting up to 3 million adults annually. This CME article provides a comprehensive review of pressure injury prevention, staging, wound management, and surgical reconstruction based on the NPUAP/EPUAP/PPPIA International Guidelines. Special emphasis is placed on the Braden Scale for risk assessment, nutritional optimization, wound bed preparation using the TIME framework, and evidence-based flap selection for Stage 3-4 pressure injuries. Management of complications including osteomyelitis and strategies to reduce recurrence are discussed.',
  learningObjectives: [
    'Accurately stage pressure injuries using the NPUAP/EPUAP classification system',
    'Calculate and interpret the Braden Scale score for risk stratification',
    'Implement evidence-based prevention strategies based on risk level',
    'Apply the TIME framework for wound bed preparation',
    'Select appropriate flap reconstruction options based on anatomical location',
    'Manage osteomyelitis in the context of pressure injuries',
    'Address nutritional optimization and comorbidity management for wound healing',
    'Implement strategies to reduce pressure injury recurrence after surgical treatment',
  ],
  sections: [
    {
      heading: 'Introduction and Epidemiology',
      content: `Pressure injuries (formerly pressure ulcers or bed sores) are localized damage to the skin and underlying soft tissue, usually over a bony prominence, as a result of sustained pressure or pressure in combination with shear. They affect approximately 2.5 million patients annually in the United States alone, with healthcare costs exceeding $26 billion per year.

In the developing world, prevalence estimates range from 2-12% in hospitals and up to 30% in spinal cord injury units. The most common locations are sacrum (36%), heels (30%), ischial tuberosities (24%), and greater trochanters (12%).

Risk factors include immobility, malnutrition (albumin < 3.0 g/dL), incontinence, sensory impairment, diabetes mellitus, extremes of age, and spinal cord injury. The Braden Scale remains the most widely validated risk assessment tool.

For the plastic surgeon, pressure injuries represent both a challenge and an opportunity: meticulous wound bed preparation, nutritional optimization, and evidence-based flap reconstruction can achieve primary healing in 70-90% of cases, though recurrence rates of 30-60% underscore the importance of comprehensive post-operative care and patient education.`,
      references: [
        'European Pressure Ulcer Advisory Panel (EPUAP), National Pressure Injury Advisory Panel (NPIAP), Pan Pacific Pressure Injury Alliance (PPPIA). Prevention and Treatment of Pressure Ulcers/Injuries: Clinical Practice Guideline. 3rd Ed. 2019.',
        'Bauer K, et al. Pressure ulcers in the United States. Wound Repair Regen. 2016;24(5):903-10.',
      ],
    },
    {
      heading: 'Staging and Classification',
      content: `The NPUAP/EPUAP/PPPIA staging system classifies pressure injuries by tissue depth:

**Stage 1:** Non-blanchable erythema of intact skin. In dark skin, look for color change, temperature difference, or edema. This stage is reversible with intervention.

**Stage 2:** Partial-thickness skin loss with exposed dermis. Red-pink wound bed. May present as blister. Do NOT use this stage for skin tears, adhesive injuries, or IAD.

**Stage 3:** Full-thickness skin loss. Subcutaneous fat visible but bone/tendon/muscle not exposed. Undermining and tunneling may occur. Depth varies by anatomical location.

**Stage 4:** Full-thickness tissue loss with exposed bone, tendon, or muscle. Often includes undermining and tunneling. High risk of osteomyelitis and sepsis.

**Unstageable:** Full-thickness loss obscured by slough or eschar. Cannot determine depth until debrided. Exception: stable, dry eschar on heels should be left intact.

**Deep Tissue Pressure Injury (DTPI):** Persistent non-blanchable deep red/maroon/purple discoloration or blood-filled blister. Originates at bone-muscle interface. May evolve rapidly.

**Medical Device-Related:** Injury conforms to shape of device (tubing, mask, collar). Stage using standard system.

Key differences from other chronic wounds:
- Pressure injuries result from mechanical forces (pressure + shear), not vascular insufficiency (venous ulcers) or neuropathy (diabetic ulcers)
- Prevention is the most effective and cost-effective strategy
- Removing the causative factor (pressure) is the foundation of all management`,
      references: [
        'NPIAP. Pressure Injury Stages. Updated 2016.',
        'EPUAP/NPIAP/PPPIA. Clinical Practice Guideline. 2019.',
      ],
    },
    {
      heading: 'Risk Assessment: The Braden Scale',
      content: `The Braden Scale is the most widely used and validated risk assessment tool for pressure injuries. It assesses 6 subscales:

1. **Sensory Perception** (1-4): Ability to respond to pressure-related discomfort
2. **Moisture** (1-4): Degree of skin moisture exposure
3. **Activity** (1-4): Degree of physical activity
4. **Mobility** (1-4): Ability to change and control body position
5. **Nutrition** (1-4): Usual food intake pattern
6. **Friction & Shear** (1-3): Resistance to friction and shear forces

**Total Score Range:** 6-23 (lower = higher risk)

| Score | Risk Level | Action |
|-------|-----------|--------|
| 19-23 | No risk | Standard care |
| 15-18 | Mild risk | Basic prevention protocol |
| 13-14 | Moderate risk | Enhanced prevention |
| 10-12 | High risk | Aggressive prevention |
| ≤ 9 | Very high risk | Maximum prevention measures |

**When to assess:**
- On admission (all patients)
- Weekly for all inpatients
- With any change in clinical condition
- After surgery, ICU admission, or mobility change

**Limitations:**
- Interrater reliability varies (training essential)
- Does not account for perfusion, medical devices, or skin condition
- Should supplement, not replace, clinical judgment`,
      references: [
        'Bergstrom N, et al. The Braden Scale for predicting pressure sore risk. Nurs Res. 1987;36(4):205-10.',
        'Serpa LF, et al. Predictive validity of the Braden Scale. Acta Paul Enferm. 2011;24(2):194-8.',
      ],
    },
    {
      heading: 'Surgical Reconstruction',
      content: `**Pre-operative Requirements:**
- Wound bed clean and granulating (no active infection)
- Albumin > 3.0 g/dL, pre-albumin > 15 mg/dL
- Osteomyelitis treated (minimum 2-4 weeks antibiotics OR bony resection planned)
- Nutritional optimization (dietitian involvement)
- Spasm control (spinal cord injury patients)
- Patient education about post-operative restrictions

**Surgical Principles:**
1. Wide excision of ulcer, bursa, scar tissue, and heterotopic bone
2. Ostectomy of bony prominence (conservative - avoid over-resection)
3. Bone cultures at time of surgery
4. Closed suction drains
5. Tension-free closure
6. Preserve flap options for future reconstructions (recurrence is common)

**Flap Selection by Location:**

*Sacral:*
- Gluteal rotation flap (workhorse)
- V-Y gluteal advancement
- SGAP perforator flap (preserves muscle)

*Ischial:*
- Posterior thigh V-Y hamstring advancement (workhorse)
- Gracilis myocutaneous flap
- Inferior gluteal rotation flap
- Biceps femoris V-Y advancement

*Trochanteric:*
- TFL flap (workhorse)
- Vastus lateralis muscle flap
- ALT flap

*Heel:*
- Reverse sural artery flap
- Free flap for large defects
- Skin graft on granulating wound

**Post-operative Protocol:**
- Air-fluidized bed (Clinitron) or low-air-loss mattress for 4-6 weeks
- Strict no sitting/weight-bearing on flap for 6-8 weeks
- Drains until output < 30 mL/24hr
- Suture removal at 3 weeks
- Progressive mobilization protocol:
  - Week 6-7: 15 min sitting
  - Increase by 15 min per week
  - Monitor flap with each sitting session
- Lifelong pressure redistribution education

**Recurrence Prevention:**
- Custom pressure-mapped wheelchair cushion
- Regular seating clinic review
- Patient and caregiver education
- Lifelong skin inspection
- Nutritional maintenance
- Spasticity management (if applicable)`,
      references: [
        'Ahluwalia R, et al. Surgical management of pressure ulcers. Clin Plast Surg. 2019;46(4):573-86.',
        'Keys KA, et al. Multivariate predictors of failure after flap coverage of pressure ulcers. Plast Reconstr Surg. 2010;125(6):1725-34.',
      ],
    },
    {
      heading: 'Osteomyelitis in Pressure Injuries',
      content: `Osteomyelitis complicates up to 38% of Stage 4 pressure injuries and is a critical factor in surgical planning.

**Diagnosis:**
- Probe-to-bone test: If a sterile metal probe inserted through the ulcer contacts bone, the PPV for osteomyelitis is 89%  
- ESR > 70 mm/hr has ~NPV 89% when combined with probe-to-bone
- MRI: Gold standard imaging - T1 low signal, T2/STIR high signal in marrow
- Bone biopsy with culture: Definitive diagnosis and guides antibiotic therapy
- Plain X-ray: Cortical irregularity, periosteal reaction (late finding)

**Management:**
1. **Non-surgical (for non-reconstructive candidates):**
   - Culture-guided IV antibiotics for 6-8 weeks
   - Wound care optimization
   - Monitor with serial CRP/ESR

2. **Surgical (for candidates for flap reconstruction):**
   - Ostectomy of infected bone at time of debridement
   - Bone margins sent for culture and histopathology
   - Postoperative culture-guided antibiotics for 4-6 weeks
   - Flap coverage after osteomyelitis deemed controlled

**Key Points:**
- Superficial wound swabs do NOT diagnose osteomyelitis (they only reflect surface colonization)
- Bone biopsy is the gold standard for organism identification
- Do NOT proceed with flap coverage if osteomyelitis is not controlled
- Infectious disease consultation recommended for complex cases`,
      references: [
        'Grayson ML, et al. Probing to bone in infected pedal ulcers: a clinical sign of underlying osteomyelitis. JAMA. 1995;273(9):721-3.',
        'Sugarman B. Pressure sores and underlying bone infection. Arch Intern Med. 1987;147(3):553-5.',
      ],
    },
    {
      heading: 'Nutritional Optimization',
      content: `Nutrition is the single most important modifiable factor in pressure injury prevention and healing.

**Assessment:**
- Serum albumin: < 3.0 g/dL = malnutrition (half-life ~21 days - reflects chronic status)
- Pre-albumin (transthyretin): < 15 mg/dL = nutritional depletion (half-life 2-3 days - reflects acute changes)
- Body weight and BMI
- Dietary intake assessment (calorie count)
- Nitrogen balance studies in severe cases

**Nutritional Requirements for Healing:**
| Nutrient | Daily Requirement | Rationale |
|----------|------------------|-----------|
| Calories | 30-35 kcal/kg/day | Energy for healing |
| Protein | 1.5-2.0 g/kg/day | Collagen synthesis, immune function |
| Vitamin C | 250-500mg BD | Collagen synthesis, antioxidant |
| Zinc | 220mg daily (if deficient) | Cell division, immune function |
| Vitamin A | 25,000 IU daily x 10 days | Epithelialization (caution in pregnancy) |
| Arginine | 9g/day | Collagen synthesis, immune enhancement |
| Fluids | 30 mL/kg/day | Tissue perfusion, waste removal |

**Key Principles:**
- Albumin < 3.0 g/dL: wounds will NOT heal adequately; surgery should be deferred
- Pre-albumin is the best marker for tracking nutritional interventions (responds in 2-3 days)
- Dietary intake < 75% of requirements: initiate oral supplements
- Dietary intake < 50%: consider enteral feeding (NG/PEG tube)
- Involve dietitian from day 1 of pressure injury management`,
      references: [
        'Cereda E, et al. A nutritional formula enriched with arginine, zinc, and antioxidants for the healing of pressure ulcers: a randomized trial. Ann Intern Med. 2015;162(3):167-74.',
        'EPUAP/NPIAP/PPPIA. Nutrition in Pressure Injury Prevention and Treatment. Clinical Practice Guideline. 2019.',
      ],
    },
  ],
  mcqQuestions: [
    {
      id: 'ps-mcq-1',
      question: 'Which Braden Scale score range indicates "High Risk" for pressure injury development?',
      options: ['15-18', '13-14', '10-12', '≤ 9'],
      correctAnswer: 2,
      explanation: 'A Braden Scale score of 10-12 indicates High Risk. Scores 15-18 = Mild Risk, 13-14 = Moderate Risk, and ≤ 9 = Very High Risk. High-risk patients require aggressive prevention measures including specialty mattresses, strict repositioning, and nutritional optimization.',
      reference: 'Bergstrom N, et al. The Braden Scale. Nurs Res. 1987;36(4):205-10.',
      difficulty: 'basic',
    },
    {
      id: 'ps-mcq-2',
      question: 'A patient has a pressure ulcer with exposed bone at the ischial tuberosity. The wound bed is covered with slough, making depth assessment difficult. How should this be staged?',
      options: ['Stage 3', 'Stage 4', 'Unstageable', 'Deep Tissue Pressure Injury'],
      correctAnswer: 1,
      explanation: 'Since bone is visible/exposed, this is Stage 4 regardless of slough. A pressure injury is classified as Unstageable only when the wound bed is COMPLETELY obscured by slough or eschar, preventing determination of depth. When bone is clearly exposed, Stage 4 is assigned.',
      reference: 'NPIAP Staging Guidelines 2016.',
      difficulty: 'intermediate',
    },
    {
      id: 'ps-mcq-3',
      question: 'What is the workhorse flap for coverage of an ischial pressure sore?',
      options: [
        'Tensor fascia lata (TFL) flap',
        'Gluteal rotation flap',
        'Posterior thigh V-Y hamstring advancement flap',
        'Gracilis myocutaneous flap',
      ],
      correctAnswer: 2,
      explanation: 'The posterior thigh V-Y hamstring advancement flap (also called the hamstring V-Y advancement or biceps femoris + semimembranosus V-Y) is the workhorse flap for ischial pressure sore reconstruction. The TFL is the workhorse for trochanteric sores, and the gluteal rotation flap is primarily used for sacral sores.',
      reference: 'Ahluwalia R, et al. Clin Plast Surg. 2019;46(4):573-86.',
      difficulty: 'advanced',
    },
    {
      id: 'ps-mcq-4',
      question: 'A probe-to-bone test is positive in a Stage 4 sacral pressure ulcer. The ESR is 82 mm/hr. What is the next best investigation?',
      options: [
        'CT scan of the pelvis',
        'Wound swab for culture and sensitivity',
        'MRI of the sacrum',
        'Bone scan (Tc-99m)',
      ],
      correctAnswer: 2,
      explanation: 'MRI is the gold standard imaging for suspected osteomyelitis, showing bone marrow edema (T2/STIR hyperintensity) with high sensitivity and specificity. A positive probe-to-bone test combined with ESR > 70 has a PPV of ~89% for osteomyelitis. Wound swabs reflect surface colonization, not bone infection. The definitive test is bone biopsy with culture.',
      reference: 'Grayson ML, et al. JAMA. 1995;273(9):721-3.',
      difficulty: 'intermediate',
    },
    {
      id: 'ps-mcq-5',
      question: 'What is the minimum serum albumin level recommended before proceeding with flap reconstruction of a pressure sore?',
      options: ['1.5 g/dL', '2.0 g/dL', '2.5 g/dL', '3.0 g/dL'],
      correctAnswer: 3,
      explanation: 'A serum albumin of > 3.0 g/dL is recommended before elective flap reconstruction for pressure sores. Albumin < 3.0 is associated with significantly increased flap complications including dehiscence, infection, and failure. Pre-albumin should also be > 15 mg/dL. Nutritional optimization is essential before surgery.',
      reference: 'Keys KA, et al. Plast Reconstr Surg. 2010;125(6):1725-34.',
      difficulty: 'basic',
    },
    {
      id: 'ps-mcq-6',
      question: 'Stable, dry, intact eschar over a heel pressure injury should be managed by:',
      options: [
        'Immediate sharp debridement and wound culture',
        'Autolytic debridement with hydrogel and moisture-retentive dressing',
        'Leaving it intact, monitoring for signs of infection',
        'Enzymatic debridement with collagenase',
      ],
      correctAnswer: 2,
      explanation: 'Stable, dry, adherent eschar on heel pressure injuries acts as a natural biological cover and should NOT be removed. It should be monitored for signs of infection (erythema, fluctuance, drainage, pain). This is a specific exception to the general principle of debridement. If infection develops, debridement becomes necessary.',
      reference: 'EPUAP/NPIAP/PPPIA Guidelines 2019.',
      difficulty: 'intermediate',
    },
    {
      id: 'ps-mcq-7',
      question: 'Which short-term nutritional marker best reflects the response to nutritional intervention in a patient with a pressure sore?',
      options: ['Serum albumin', 'Pre-albumin (transthyretin)', 'Total protein', 'BMI'],
      correctAnswer: 1,
      explanation: 'Pre-albumin (transthyretin) has a half-life of 2-3 days, making it the best marker for monitoring short-term nutritional changes and response to intervention. Albumin has a half-life of ~21 days, reflecting chronic nutritional status but is too slow to track acute improvements. Pre-albumin target is > 15 mg/dL.',
      reference: 'EPUAP/NPIAP/PPPIA Nutrition Guidelines 2019.',
      difficulty: 'basic',
    },
    {
      id: 'ps-mcq-8',
      question: 'A patient is 8 weeks post-gluteal rotation flap for sacral pressure sore reconstruction. The flap is well-healed. What is the appropriate next step in the progressive mobilization protocol?',
      options: [
        'Begin sitting on regular chair for 2 hours, three times daily',
        'Begin sitting for 15 minutes and increase by 15 minutes per week while monitoring flap',
        'Full unrestricted sitting and mobilization immediately',
        'Continue strict bed rest for another 4 weeks',
      ],
      correctAnswer: 1,
      explanation: 'After 6-8 weeks of strict offloading post-flap surgery, progressive sitting is initiated cautiously: begin with 15 minutes, then increase by 15 minutes per week. The flap should be inspected after each sitting session for signs of stress (pallor, redness, breakdown). Sudden full weight-bearing can cause flap failure. The patient must use a pressure-mapped wheelchair cushion.',
      reference: 'Ahluwalia R, et al. Clin Plast Surg. 2019.',
      difficulty: 'advanced',
    },
    {
      id: 'ps-mcq-9',
      question: 'In the context of pressure injury prevention, what is the recommended maximum angle for lateral positioning?',
      options: ['15 degrees', '30 degrees', '60 degrees', '90 degrees'],
      correctAnswer: 1,
      explanation: '30-degree lateral tilt is the maximum recommended angle for lateral repositioning. Positioning at 90 degrees places excessive pressure directly on the greater trochanter. The 30-degree tilt distributes pressure over the greater surface area of the buttock/thigh, significantly reducing interface pressure on the trochanter.',
      reference: 'EPUAP/NPIAP/PPPIA Prevention Guidelines 2019.',
      difficulty: 'basic',
    },
    {
      id: 'ps-mcq-10',
      question: 'A Stage 3 sacral pressure ulcer has shown no healing progress after 4 weeks of optimal wound care, nutrition, and pressure management. The wound biopsy shows squamous cell carcinoma. What is this condition called?',
      options: [
        'Pyoderma gangrenosum',
        'Marjolin ulcer',
        'Verrucous carcinoma',
        'Dermatofibrosarcoma protuberans',
      ],
      correctAnswer: 1,
      explanation: 'Marjolin ulcer is a malignant transformation (typically squamous cell carcinoma) that can occur in chronic, non-healing wounds including pressure sores, burn scars, and chronic venous ulcers. It typically develops after many years. Any chronic wound that fails to heal despite adequate treatment should raise suspicion for malignancy, and biopsy is indicated.',
      reference: 'Kerr-Valentic MA, et al. Marjolin ulcer: modern analysis of an ancient problem. Plast Reconstr Surg. 2009;123(1):184-91.',
      difficulty: 'advanced',
    },
  ],
  references: [
    'European Pressure Ulcer Advisory Panel (EPUAP), National Pressure Injury Advisory Panel (NPIAP), Pan Pacific Pressure Injury Alliance (PPPIA). Prevention and Treatment of Pressure Ulcers/Injuries: Clinical Practice Guideline. 3rd Edition. 2019.',
    'Bergstrom N, et al. The Braden Scale for predicting pressure sore risk. Nurs Res. 1987;36(4):205-10.',
    'Grayson ML, et al. Probing to bone in infected pedal ulcers: a clinical sign of underlying osteomyelitis. JAMA. 1995;273(9):721-3.',
    'Ahluwalia R, et al. Surgical management of pressure ulcers. Clin Plast Surg. 2019;46(4):573-86.',
    'Keys KA, et al. Multivariate predictors of failure after flap coverage of pressure ulcers. Plast Reconstr Surg. 2010;125(6):1725-34.',
    'Cereda E, et al. A nutritional formula enriched with arginine, zinc, and antioxidants for the healing of pressure ulcers: a randomized trial. Ann Intern Med. 2015;162(3):167-74.',
    'Kerr-Valentic MA, et al. Marjolin ulcer: modern analysis of an ancient problem. Plast Reconstr Surg. 2009;123(1):184-91.',
    'WHO Guidelines on basic newborn resuscitation. Geneva: World Health Organization; 2012 (adapted principles for wound care).',
    'Bauer K, et al. Pressure ulcers in the United States. Wound Repair Regen. 2016;24(5):903-10.',
  ],
  cmeCredits: 5,
  targetAudience: ['Plastic Surgeons', 'General Surgeons', 'Wound Care Specialists', 'Rehabilitation Medicine', 'Nursing Leadership'],
  lastUpdated: '2025-12-01',
};
