// Comprehensive Laboratory & Imaging Investigations Catalog
// Reference values based on standard international ranges
// Organized by categories relevant to Plastic Surgery practice

export interface Investigation {
  name: string;
  code: string; // Common lab code/abbreviation
  category: InvestigationCategory;
  subcategory: string;
  type: 'laboratory' | 'imaging' | 'microbiology' | 'histopathology' | 'other';
  specimen?: string;
  container?: string;
  referenceValues: ReferenceValue[];
  criticalValues?: CriticalValue[];
  units: string;
  turnaroundTime: string;
  clinicalSignificance: string;
  preAnalyticRequirements?: string[];
  relatedTests?: string[];
}

export interface ReferenceValue {
  parameter: string;
  normalRange: string;
  units: string;
  gender?: 'male' | 'female' | 'all';
  ageGroup?: string;
}

export interface CriticalValue {
  parameter: string;
  criticalLow?: string;
  criticalHigh?: string;
  units: string;
  action: string;
}

export type InvestigationCategory =
  | 'Haematology'
  | 'Biochemistry'
  | 'Coagulation'
  | 'Liver Function'
  | 'Renal Function'
  | 'Thyroid Function'
  | 'Cardiac Markers'
  | 'Inflammatory Markers'
  | 'Microbiology'
  | 'Blood Bank'
  | 'Urinalysis'
  | 'Blood Gases'
  | 'Tumour Markers'
  | 'Endocrine'
  | 'Immunology'
  | 'Histopathology'
  | 'Radiology - Plain'
  | 'Radiology - CT'
  | 'Radiology - MRI'
  | 'Radiology - Ultrasound'
  | 'Radiology - Special'
  | 'Miscellaneous';

export const INVESTIGATION_CATEGORIES: InvestigationCategory[] = [
  'Haematology',
  'Biochemistry',
  'Coagulation',
  'Liver Function',
  'Renal Function',
  'Thyroid Function',
  'Cardiac Markers',
  'Inflammatory Markers',
  'Microbiology',
  'Blood Bank',
  'Urinalysis',
  'Blood Gases',
  'Tumour Markers',
  'Endocrine',
  'Immunology',
  'Histopathology',
  'Radiology - Plain',
  'Radiology - CT',
  'Radiology - MRI',
  'Radiology - Ultrasound',
  'Radiology - Special',
  'Miscellaneous'
];

export const INVESTIGATIONS: Investigation[] = [
  // ==================== HAEMATOLOGY ====================
  {
    name: 'Full Blood Count (FBC)',
    code: 'FBC',
    category: 'Haematology',
    subcategory: 'Complete Blood Count',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (purple top)',
    referenceValues: [
      { parameter: 'Haemoglobin (Hb)', normalRange: '13.0-17.0', units: 'g/dL', gender: 'male' },
      { parameter: 'Haemoglobin (Hb)', normalRange: '12.0-15.0', units: 'g/dL', gender: 'female' },
      { parameter: 'White Cell Count (WCC)', normalRange: '4.0-11.0', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Neutrophils', normalRange: '2.0-7.5', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Lymphocytes', normalRange: '1.5-4.0', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Monocytes', normalRange: '0.2-0.8', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Eosinophils', normalRange: '0.04-0.4', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Basophils', normalRange: '0.01-0.1', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Platelets', normalRange: '150-400', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Haematocrit (PCV)', normalRange: '40-54', units: '%', gender: 'male' },
      { parameter: 'Haematocrit (PCV)', normalRange: '36-48', units: '%', gender: 'female' },
      { parameter: 'MCV', normalRange: '80-100', units: 'fL', gender: 'all' },
      { parameter: 'MCH', normalRange: '27-34', units: 'pg', gender: 'all' },
      { parameter: 'MCHC', normalRange: '320-360', units: 'g/L', gender: 'all' },
      { parameter: 'RDW', normalRange: '11.5-14.5', units: '%', gender: 'all' },
      { parameter: 'Red Cell Count', normalRange: '4.5-6.5', units: '×10¹²/L', gender: 'male' },
      { parameter: 'Red Cell Count', normalRange: '3.8-5.8', units: '×10¹²/L', gender: 'female' }
    ],
    criticalValues: [
      { parameter: 'Haemoglobin', criticalLow: '<7.0', criticalHigh: '>20.0', units: 'g/dL', action: 'Urgent clinical review. Consider transfusion if <7g/dL.' },
      { parameter: 'WCC', criticalLow: '<2.0', criticalHigh: '>30.0', units: '×10⁹/L', action: 'Neutropenic sepsis risk if <1.0. Urgent review for >30.' },
      { parameter: 'Platelets', criticalLow: '<50', criticalHigh: '>1000', units: '×10⁹/L', action: 'Bleeding risk <50. Thrombosis risk >1000. Hold surgery if <80.' },
      { parameter: 'Neutrophils', criticalLow: '<0.5', units: '×10⁹/L', action: 'Severe neutropenia - isolation, broad-spectrum antibiotics.' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Essential pre-operative screening. Monitors for anaemia, infection, bleeding risk. Essential in burns, sepsis, post-operative monitoring.',
    preAnalyticRequirements: ['No fasting required', 'Mix gently by inversion', 'Process within 4 hours'],
    relatedTests: ['Blood film', 'Reticulocyte count', 'Iron studies', 'B12/Folate']
  },
  {
    name: 'Erythrocyte Sedimentation Rate (ESR)',
    code: 'ESR',
    category: 'Haematology',
    subcategory: 'Inflammatory marker',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'ESR tube (citrate)',
    referenceValues: [
      { parameter: 'ESR', normalRange: '0-15', units: 'mm/hr', gender: 'male', ageGroup: '<50 years' },
      { parameter: 'ESR', normalRange: '0-20', units: 'mm/hr', gender: 'male', ageGroup: '>50 years' },
      { parameter: 'ESR', normalRange: '0-20', units: 'mm/hr', gender: 'female', ageGroup: '<50 years' },
      { parameter: 'ESR', normalRange: '0-30', units: 'mm/hr', gender: 'female', ageGroup: '>50 years' }
    ],
    units: 'mm/hr',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Non-specific inflammation marker. Elevated in infection, autoimmune disease, malignancy. Useful in monitoring temporal arteritis.',
    preAnalyticRequirements: ['Process within 2 hours', 'Keep at room temperature']
  },
  {
    name: 'Reticulocyte Count',
    code: 'RETIC',
    category: 'Haematology',
    subcategory: 'Red cell production',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (purple top)',
    referenceValues: [
      { parameter: 'Reticulocyte count', normalRange: '0.5-2.5', units: '%', gender: 'all' },
      { parameter: 'Reticulocyte absolute', normalRange: '25-125', units: '×10⁹/L', gender: 'all' }
    ],
    units: '%',
    turnaroundTime: '2-4 hours',
    clinicalSignificance: 'Measures bone marrow red cell production. Elevated in haemolysis/bleeding (appropriate response). Low in marrow failure.',
    relatedTests: ['FBC', 'Iron studies', 'B12/Folate']
  },
  {
    name: 'Blood Film (Peripheral Smear)',
    code: 'BF',
    category: 'Haematology',
    subcategory: 'Morphology',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (purple top)',
    referenceValues: [
      { parameter: 'RBC morphology', normalRange: 'Normocytic normochromic', units: '', gender: 'all' },
      { parameter: 'WBC differential', normalRange: 'Normal', units: '', gender: 'all' },
      { parameter: 'Platelet morphology', normalRange: 'Normal numbers and morphology', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '2-4 hours',
    clinicalSignificance: 'Evaluates cell morphology. Identifies abnormal cells, parasites (malaria), fragmentation (DIC/TTP).',
    relatedTests: ['FBC', 'Malaria parasites']
  },
  {
    name: 'Sickling Test / Haemoglobin Electrophoresis',
    code: 'HbElec',
    category: 'Haematology',
    subcategory: 'Haemoglobinopathy',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (purple top)',
    referenceValues: [
      { parameter: 'HbA', normalRange: '96-98', units: '%', gender: 'all' },
      { parameter: 'HbA2', normalRange: '2.0-3.5', units: '%', gender: 'all' },
      { parameter: 'HbF', normalRange: '<1.0', units: '%', gender: 'all', ageGroup: 'Adult' },
      { parameter: 'HbS', normalRange: '0', units: '%', gender: 'all' }
    ],
    units: '%',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Pre-operative screening in at-risk populations. Sickle cell disease/trait detection. Critical for anaesthesia planning.',
    preAnalyticRequirements: ['Must be done before transfusion (otherwise interpret with caution)']
  },

  // ==================== BIOCHEMISTRY ====================
  {
    name: 'Urea & Electrolytes (U&E)',
    code: 'UE',
    category: 'Biochemistry',
    subcategory: 'Renal/Electrolytes',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Sodium (Na+)', normalRange: '135-145', units: 'mmol/L', gender: 'all' },
      { parameter: 'Potassium (K+)', normalRange: '3.5-5.0', units: 'mmol/L', gender: 'all' },
      { parameter: 'Urea', normalRange: '2.5-6.7', units: 'mmol/L', gender: 'all' },
      { parameter: 'Creatinine', normalRange: '60-120', units: 'µmol/L', gender: 'male' },
      { parameter: 'Creatinine', normalRange: '45-90', units: 'µmol/L', gender: 'female' },
      { parameter: 'eGFR', normalRange: '>90', units: 'mL/min/1.73m²', gender: 'all' },
      { parameter: 'Chloride (Cl-)', normalRange: '95-105', units: 'mmol/L', gender: 'all' },
      { parameter: 'Bicarbonate (HCO3-)', normalRange: '22-28', units: 'mmol/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'Potassium', criticalLow: '<2.5', criticalHigh: '>6.5', units: 'mmol/L', action: 'URGENT: Cardiac arrhythmia risk. ECG immediately. <2.5: IV replacement. >6.5: Calcium gluconate, insulin/dextrose, salbutamol.' },
      { parameter: 'Sodium', criticalLow: '<120', criticalHigh: '>160', units: 'mmol/L', action: 'Urgent review. <120: seizure risk. >160: cerebral oedema risk with rapid correction. Correct slowly.' },
      { parameter: 'Creatinine', criticalHigh: '>500', units: 'µmol/L', action: 'Urgent renal review. Consider dialysis.' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Essential pre-operative screening. Monitors renal function, electrolyte balance. Critical in burns, sepsis, IV fluid management, drug dosing (GFR for medications).',
    preAnalyticRequirements: ['Avoid haemolysis (falsely elevates K+)', 'Do not use from drip arm']
  },
  {
    name: 'Random Blood Glucose',
    code: 'RBG',
    category: 'Biochemistry',
    subcategory: 'Glucose metabolism',
    type: 'laboratory',
    specimen: 'Plasma or capillary',
    container: 'Fluoride oxalate (grey top) or glucometer',
    referenceValues: [
      { parameter: 'Random glucose', normalRange: '3.5-7.8', units: 'mmol/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'Glucose', criticalLow: '<2.5', criticalHigh: '>25.0', units: 'mmol/L', action: '<2.5: Hypoglycaemia - give 50ml 50% dextrose IV. >25: Check for DKA/HHS.' }
    ],
    units: 'mmol/L',
    turnaroundTime: 'Minutes (glucometer) or 1 hour (lab)',
    clinicalSignificance: 'Screening for diabetes. Monitoring in diabetics. Pre-operative assessment. Check in sepsis, steroid use, wound healing problems.'
  },
  {
    name: 'Fasting Blood Glucose',
    code: 'FBG',
    category: 'Biochemistry',
    subcategory: 'Glucose metabolism',
    type: 'laboratory',
    specimen: 'Plasma',
    container: 'Fluoride oxalate (grey top)',
    referenceValues: [
      { parameter: 'Fasting glucose', normalRange: '3.5-5.5', units: 'mmol/L', gender: 'all' },
      { parameter: 'Impaired fasting glucose', normalRange: '5.6-6.9', units: 'mmol/L', gender: 'all' },
      { parameter: 'Diabetes mellitus', normalRange: '≥7.0', units: 'mmol/L', gender: 'all' }
    ],
    units: 'mmol/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Diagnosis of diabetes mellitus. Pre-operative assessment for surgical patients.',
    preAnalyticRequirements: ['8-12 hours fasting required', 'Early morning sample preferred']
  },
  {
    name: 'HbA1c (Glycated Haemoglobin)',
    code: 'HBA1C',
    category: 'Biochemistry',
    subcategory: 'Glucose metabolism',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (purple top)',
    referenceValues: [
      { parameter: 'HbA1c (normal)', normalRange: '<42', units: 'mmol/mol', gender: 'all' },
      { parameter: 'HbA1c (pre-diabetes)', normalRange: '42-47', units: 'mmol/mol', gender: 'all' },
      { parameter: 'HbA1c (diabetes)', normalRange: '≥48', units: 'mmol/mol', gender: 'all' },
      { parameter: 'HbA1c target (diabetes)', normalRange: '<53', units: 'mmol/mol', gender: 'all' }
    ],
    units: 'mmol/mol',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Reflects average blood glucose over 2-3 months. Optimal perioperative: <69 mmol/mol. Delayed wound healing associated with poor control.'
  },
  {
    name: 'Lipid Profile',
    code: 'LIPID',
    category: 'Biochemistry',
    subcategory: 'Lipid metabolism',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Total Cholesterol', normalRange: '<5.0', units: 'mmol/L', gender: 'all' },
      { parameter: 'LDL Cholesterol', normalRange: '<3.0', units: 'mmol/L', gender: 'all' },
      { parameter: 'HDL Cholesterol', normalRange: '>1.0', units: 'mmol/L', gender: 'male' },
      { parameter: 'HDL Cholesterol', normalRange: '>1.2', units: 'mmol/L', gender: 'female' },
      { parameter: 'Triglycerides', normalRange: '<1.7', units: 'mmol/L', gender: 'all' }
    ],
    units: 'mmol/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Cardiovascular risk assessment. Pre-operative cardiovascular evaluation.',
    preAnalyticRequirements: ['Fasting for 12 hours preferred for triglycerides']
  },
  {
    name: 'Serum Calcium',
    code: 'Ca',
    category: 'Biochemistry',
    subcategory: 'Minerals',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Total Calcium', normalRange: '2.20-2.60', units: 'mmol/L', gender: 'all' },
      { parameter: 'Corrected Calcium', normalRange: '2.20-2.60', units: 'mmol/L', gender: 'all' },
      { parameter: 'Ionised Calcium', normalRange: '1.15-1.30', units: 'mmol/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'Total Calcium', criticalLow: '<1.80', criticalHigh: '>3.50', units: 'mmol/L', action: '<1.80: Tetany, seizures. IV calcium gluconate. >3.50: Cardiac arrest risk. IV fluids + bisphosphonate.' }
    ],
    units: 'mmol/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Important in fluid resuscitation, transfusion (citrate binds calcium), bone healing.'
  },
  {
    name: 'Serum Magnesium',
    code: 'Mg',
    category: 'Biochemistry',
    subcategory: 'Minerals',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Magnesium', normalRange: '0.70-1.00', units: 'mmol/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'Magnesium', criticalLow: '<0.50', criticalHigh: '>2.00', units: 'mmol/L', action: '<0.50: Arrhythmia risk. IV replacement. >2.00: Respiratory depression risk.' }
    ],
    units: 'mmol/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Low in alcoholism, malnutrition, diuretic use. Required for cardiac stability.'
  },
  {
    name: 'Serum Phosphate',
    code: 'PO4',
    category: 'Biochemistry',
    subcategory: 'Minerals',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Phosphate', normalRange: '0.80-1.50', units: 'mmol/L', gender: 'all' }
    ],
    units: 'mmol/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Important in refeeding syndrome, renal disease, bone metabolism.'
  },
  {
    name: 'Serum Albumin',
    code: 'ALB',
    category: 'Biochemistry',
    subcategory: 'Protein',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Albumin', normalRange: '35-50', units: 'g/L', gender: 'all' }
    ],
    units: 'g/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Nutritional marker. Low in malnutrition, sepsis, liver disease, burns. Important for wound healing assessment and drug dosing. Correct calcium for albumin.'
  },
  {
    name: 'Total Protein',
    code: 'TP',
    category: 'Biochemistry',
    subcategory: 'Protein',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Total Protein', normalRange: '60-80', units: 'g/L', gender: 'all' }
    ],
    units: 'g/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Nutritional assessment. Low in malnutrition, liver disease, nephrotic syndrome.'
  },
  {
    name: 'Serum Uric Acid',
    code: 'UA',
    category: 'Biochemistry',
    subcategory: 'Purine metabolism',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Uric Acid', normalRange: '200-430', units: 'µmol/L', gender: 'male' },
      { parameter: 'Uric Acid', normalRange: '140-360', units: 'µmol/L', gender: 'female' }
    ],
    units: 'µmol/L',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Elevated in gout, renal impairment, tumour lysis. Pre-eclampsia screening.'
  },

  // ==================== LIVER FUNCTION ====================
  {
    name: 'Liver Function Tests (LFT)',
    code: 'LFT',
    category: 'Liver Function',
    subcategory: 'Hepatic panel',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Total Bilirubin', normalRange: '3-17', units: 'µmol/L', gender: 'all' },
      { parameter: 'Conjugated Bilirubin', normalRange: '0-5', units: 'µmol/L', gender: 'all' },
      { parameter: 'ALT (SGPT)', normalRange: '7-56', units: 'U/L', gender: 'all' },
      { parameter: 'AST (SGOT)', normalRange: '10-40', units: 'U/L', gender: 'all' },
      { parameter: 'ALP (Alkaline Phosphatase)', normalRange: '44-147', units: 'U/L', gender: 'all' },
      { parameter: 'GGT', normalRange: '9-48', units: 'U/L', gender: 'male' },
      { parameter: 'GGT', normalRange: '9-36', units: 'U/L', gender: 'female' },
      { parameter: 'Albumin', normalRange: '35-50', units: 'g/L', gender: 'all' },
      { parameter: 'Total Protein', normalRange: '60-80', units: 'g/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'Total Bilirubin', criticalHigh: '>200', units: 'µmol/L', action: 'Urgent hepatology/gastroenterology review' },
      { parameter: 'ALT', criticalHigh: '>1000', units: 'U/L', action: 'Acute hepatitis - urgent investigation' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Pre-operative liver assessment. Drug metabolism capacity. Coagulopathy risk if hepatic synthetic function impaired. Monitor in prolonged antibiotic use.',
    preAnalyticRequirements: ['Fasting preferred but not essential', 'Avoid haemolysis'],
    relatedTests: ['Coagulation screen', 'Albumin', 'Hepatitis serology']
  },

  // ==================== RENAL FUNCTION ====================
  {
    name: 'Estimated GFR (eGFR)',
    code: 'eGFR',
    category: 'Renal Function',
    subcategory: 'Glomerular filtration',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'eGFR Normal', normalRange: '>90', units: 'mL/min/1.73m²', gender: 'all' },
      { parameter: 'eGFR Mild decrease', normalRange: '60-89', units: 'mL/min/1.73m²', gender: 'all' },
      { parameter: 'eGFR Moderate (Stage 3)', normalRange: '30-59', units: 'mL/min/1.73m²', gender: 'all' },
      { parameter: 'eGFR Severe (Stage 4)', normalRange: '15-29', units: 'mL/min/1.73m²', gender: 'all' },
      { parameter: 'eGFR Kidney failure (Stage 5)', normalRange: '<15', units: 'mL/min/1.73m²', gender: 'all' }
    ],
    units: 'mL/min/1.73m²',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'CRITICAL for medication dosing adjustments. Determines GFR-guided drug dosing. Calculated from serum creatinine using CKD-EPI formula.',
    relatedTests: ['U&E', 'Urinalysis', '24h creatinine clearance']
  },

  // ==================== COAGULATION ====================
  {
    name: 'Coagulation Screen',
    code: 'COAG',
    category: 'Coagulation',
    subcategory: 'Clotting factors',
    type: 'laboratory',
    specimen: 'Citrated plasma',
    container: 'Citrate tube (light blue top)',
    referenceValues: [
      { parameter: 'PT (Prothrombin Time)', normalRange: '10-14', units: 'seconds', gender: 'all' },
      { parameter: 'INR', normalRange: '0.8-1.2', units: 'ratio', gender: 'all' },
      { parameter: 'APTT', normalRange: '25-35', units: 'seconds', gender: 'all' },
      { parameter: 'Thrombin Time', normalRange: '14-16', units: 'seconds', gender: 'all' },
      { parameter: 'Fibrinogen', normalRange: '1.5-4.0', units: 'g/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'INR', criticalHigh: '>5.0', units: 'ratio', action: 'Major bleeding risk. Withhold warfarin. Vitamin K 1-5mg IV/oral. Consider PCC if bleeding.' },
      { parameter: 'APTT', criticalHigh: '>100', units: 'seconds', action: 'Check heparin infusion rate. Stop heparin if not therapeutic indication.' },
      { parameter: 'Fibrinogen', criticalLow: '<1.0', units: 'g/L', action: 'DIC risk. Give cryoprecipitate. Urgent haematology review.' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'ESSENTIAL pre-operative. Monitors anticoagulant therapy. Detects bleeding disorders. Critical in massive transfusion, DIC, liver disease. Safe for surgery: INR <1.5, APTT <40, Platelets >80.',
    preAnalyticRequirements: ['Must fill tube to line (correct citrate:blood ratio)', 'Process within 4 hours', 'Keep at room temperature']
  },
  {
    name: 'D-Dimer',
    code: 'DDIM',
    category: 'Coagulation',
    subcategory: 'Fibrinolysis',
    type: 'laboratory',
    specimen: 'Citrated plasma',
    container: 'Citrate tube (light blue top)',
    referenceValues: [
      { parameter: 'D-Dimer', normalRange: '<500', units: 'ng/mL (FEU)', gender: 'all' }
    ],
    units: 'ng/mL',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Negative predictive value for VTE. Elevated in DVT/PE, DIC, surgery, trauma, pregnancy, infection, malignancy. NOT diagnostic alone - use with clinical probability (Wells score).',
    preAnalyticRequirements: ['Often elevated post-operatively - interpret with caution']
  },
  {
    name: 'Bleeding Time',
    code: 'BT',
    category: 'Coagulation',
    subcategory: 'Platelet function',
    type: 'laboratory',
    specimen: 'In vivo test',
    container: 'N/A',
    referenceValues: [
      { parameter: 'Ivy method', normalRange: '2-7', units: 'minutes', gender: 'all' }
    ],
    units: 'minutes',
    turnaroundTime: 'Immediate',
    clinicalSignificance: 'Assesses platelet function and vascular integrity. Prolonged in thrombocytopenia, platelet function disorders, von Willebrand disease.'
  },

  // ==================== INFLAMMATORY MARKERS ====================
  {
    name: 'C-Reactive Protein (CRP)',
    code: 'CRP',
    category: 'Inflammatory Markers',
    subcategory: 'Acute phase protein',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'CRP', normalRange: '<5', units: 'mg/L', gender: 'all' },
      { parameter: 'CRP mild inflammation', normalRange: '5-50', units: 'mg/L', gender: 'all' },
      { parameter: 'CRP significant infection', normalRange: '50-200', units: 'mg/L', gender: 'all' },
      { parameter: 'CRP severe infection/sepsis', normalRange: '>200', units: 'mg/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'CRP', criticalHigh: '>300', units: 'mg/L', action: 'Severe infection/sepsis likely. Blood cultures. Broad-spectrum antibiotics.' }
    ],
    units: 'mg/L',
    turnaroundTime: '1 hour',
    clinicalSignificance: 'Rises within 6-12h of inflammation/infection. More specific than ESR. Monitors post-operative infection, wound infection, response to antibiotics. Part of LRINEC score for necrotising fasciitis.'
  },
  {
    name: 'Procalcitonin (PCT)',
    code: 'PCT',
    category: 'Inflammatory Markers',
    subcategory: 'Bacterial infection marker',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Procalcitonin normal', normalRange: '<0.10', units: 'ng/mL', gender: 'all' },
      { parameter: 'Low risk bacterial infection', normalRange: '0.10-0.25', units: 'ng/mL', gender: 'all' },
      { parameter: 'Likely bacterial infection', normalRange: '0.25-0.50', units: 'ng/mL', gender: 'all' },
      { parameter: 'Severe bacterial infection/sepsis', normalRange: '>0.50', units: 'ng/mL', gender: 'all' }
    ],
    units: 'ng/mL',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'More specific for bacterial infection than CRP. Helps guide antibiotic therapy. Useful for distinguishing bacterial vs viral infection.',
    relatedTests: ['CRP', 'Blood cultures', 'FBC']
  },
  {
    name: 'Serum Lactate',
    code: 'LAC',
    category: 'Inflammatory Markers',
    subcategory: 'Tissue perfusion marker',
    type: 'laboratory',
    specimen: 'Arterial or venous blood',
    container: 'Fluoride oxalate or ABG syringe',
    referenceValues: [
      { parameter: 'Lactate (venous)', normalRange: '0.5-2.0', units: 'mmol/L', gender: 'all' },
      { parameter: 'Lactate (arterial)', normalRange: '0.5-1.6', units: 'mmol/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'Lactate', criticalHigh: '>4.0', units: 'mmol/L', action: 'Tissue hypoperfusion/sepsis. Urgent fluid resuscitation. Consider vasopressors. Repeat in 2-4h to assess trend.' }
    ],
    units: 'mmol/L',
    turnaroundTime: '30 min - 1 hour',
    clinicalSignificance: 'Marker of tissue hypoperfusion. Elevated in sepsis, shock, mesenteric ischaemia, post-cardiac arrest. Serial levels guide resuscitation adequacy.'
  },

  // ==================== BLOOD GASES ====================
  {
    name: 'Arterial Blood Gas (ABG)',
    code: 'ABG',
    category: 'Blood Gases',
    subcategory: 'Acid-base',
    type: 'laboratory',
    specimen: 'Arterial blood',
    container: 'Heparinised ABG syringe',
    referenceValues: [
      { parameter: 'pH', normalRange: '7.35-7.45', units: '', gender: 'all' },
      { parameter: 'pCO2', normalRange: '4.7-6.0', units: 'kPa', gender: 'all' },
      { parameter: 'pO2', normalRange: '10.0-13.3', units: 'kPa', gender: 'all' },
      { parameter: 'HCO3-', normalRange: '22-26', units: 'mmol/L', gender: 'all' },
      { parameter: 'Base Excess', normalRange: '-2 to +2', units: 'mmol/L', gender: 'all' },
      { parameter: 'O2 Saturation', normalRange: '95-100', units: '%', gender: 'all' },
      { parameter: 'Lactate', normalRange: '0.5-1.6', units: 'mmol/L', gender: 'all' }
    ],
    criticalValues: [
      { parameter: 'pH', criticalLow: '<7.20', criticalHigh: '>7.60', units: '', action: 'Life-threatening. Urgent intervention. <7.20: assess for DKA, sepsis, renal failure. >7.60: hyperventilation, severe vomiting.' },
      { parameter: 'pO2', criticalLow: '<8.0', units: 'kPa', action: 'Respiratory failure. Increase O2. Consider NIV/intubation.' },
      { parameter: 'pCO2', criticalHigh: '>8.0', units: 'kPa', action: 'Type 2 respiratory failure. Assess for NIV/intubation.' }
    ],
    units: 'Multiple',
    turnaroundTime: '5-15 minutes',
    clinicalSignificance: 'Essential in respiratory distress, sepsis, burns, DKA, post-operative monitoring, ventilated patients. Guides fluid and respiratory management.',
    preAnalyticRequirements: ['Analyse within 15 minutes', 'Remove air bubbles immediately', 'Note FiO2', 'Apply pressure to puncture site for 5 min']
  },
  {
    name: 'Venous Blood Gas (VBG)',
    code: 'VBG',
    category: 'Blood Gases',
    subcategory: 'Acid-base',
    type: 'laboratory',
    specimen: 'Venous blood',
    container: 'Heparinised ABG syringe or VBG tube',
    referenceValues: [
      { parameter: 'pH', normalRange: '7.31-7.41', units: '', gender: 'all' },
      { parameter: 'pCO2', normalRange: '5.5-6.8', units: 'kPa', gender: 'all' },
      { parameter: 'HCO3-', normalRange: '22-28', units: 'mmol/L', gender: 'all' },
      { parameter: 'Base Excess', normalRange: '-2 to +2', units: 'mmol/L', gender: 'all' },
      { parameter: 'Lactate', normalRange: '0.5-2.0', units: 'mmol/L', gender: 'all' }
    ],
    units: 'Multiple',
    turnaroundTime: '5-15 minutes',
    clinicalSignificance: 'Screening alternative to ABG. Reliable for pH and HCO3 (correlates well). Less painful than ABG. Cannot reliably assess oxygenation.'
  },

  // ==================== CARDIAC MARKERS ====================
  {
    name: 'Troponin (High-sensitivity)',
    code: 'TROP',
    category: 'Cardiac Markers',
    subcategory: 'Myocardial injury',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'hs-Troponin T', normalRange: '<14', units: 'ng/L', gender: 'all' },
      { parameter: 'hs-Troponin I', normalRange: '<26', units: 'ng/L', gender: 'male' },
      { parameter: 'hs-Troponin I', normalRange: '<16', units: 'ng/L', gender: 'female' }
    ],
    criticalValues: [
      { parameter: 'Troponin', criticalHigh: '>100 with rise/fall', units: 'ng/L', action: 'Myocardial infarction likely. Urgent cardiology. ECG. Standard ACS management.' }
    ],
    units: 'ng/L',
    turnaroundTime: '1 hour',
    clinicalSignificance: 'Detects myocardial injury. Part of peri-operative cardiac assessment. Also elevated in PE, renal failure, sepsis, myocarditis.',
    relatedTests: ['ECG', 'CK-MB', 'BNP']
  },

  // ==================== THYROID FUNCTION ====================
  {
    name: 'Thyroid Function Tests (TFT)',
    code: 'TFT',
    category: 'Thyroid Function',
    subcategory: 'Thyroid hormones',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'TSH', normalRange: '0.4-4.0', units: 'mIU/L', gender: 'all' },
      { parameter: 'Free T4', normalRange: '9-25', units: 'pmol/L', gender: 'all' },
      { parameter: 'Free T3', normalRange: '3.5-6.5', units: 'pmol/L', gender: 'all' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-3 hours',
    clinicalSignificance: 'Pre-operative assessment if clinical suspicion. Hypothyroidism delays wound healing. Thyrotoxicosis increases anaesthetic risk.',
    preAnalyticRequirements: ['Early morning sample preferred', 'Biotin supplements can interfere - stop 48h before']
  },

  // ==================== BLOOD BANK ====================
  {
    name: 'Group & Save (Blood Typing)',
    code: 'GS',
    category: 'Blood Bank',
    subcategory: 'Blood typing',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (pink/purple top)',
    referenceValues: [
      { parameter: 'ABO Group', normalRange: 'A, B, AB, or O', units: '', gender: 'all' },
      { parameter: 'Rhesus D', normalRange: 'Positive or Negative', units: '', gender: 'all' },
      { parameter: 'Antibody Screen', normalRange: 'Negative', units: '', gender: 'all' }
    ],
    units: 'Categorical',
    turnaroundTime: '30-60 minutes',
    clinicalSignificance: 'Pre-operative requirement for procedures with expected blood loss >500ml. Valid for 72h if no recent transfusion. Essential for blood transfusion.',
    preAnalyticRequirements: ['Patient ID must be verified at bedside', 'Sample labelled at bedside with patient details', 'Two samples required for first-time patients']
  },
  {
    name: 'Cross-Match',
    code: 'XM',
    category: 'Blood Bank',
    subcategory: 'Compatibility testing',
    type: 'laboratory',
    specimen: 'Whole blood',
    container: 'EDTA (pink/purple top)',
    referenceValues: [
      { parameter: 'Crossmatch', normalRange: 'Compatible', units: '', gender: 'all' }
    ],
    units: 'Compatible/Incompatible',
    turnaroundTime: '30-60 minutes',
    clinicalSignificance: 'Required before blood transfusion. Ensures donor blood compatible with recipient. Order based on expected blood loss: minor surgery 0 units, moderate 2 units, major 4 units.',
    preAnalyticRequirements: ['Fresh sample (valid 72h)', 'Must match Group & Save', 'Patient ID verification critical']
  },

  // ==================== MICROBIOLOGY ====================
  {
    name: 'Blood Culture',
    code: 'BC',
    category: 'Microbiology',
    subcategory: 'Culture & sensitivity',
    type: 'microbiology',
    specimen: 'Blood',
    container: 'Blood culture bottles (aerobic + anaerobic)',
    referenceValues: [
      { parameter: 'Blood Culture', normalRange: 'No growth', units: '', gender: 'all' }
    ],
    units: 'Qualitative',
    turnaroundTime: '2-5 days (longer for slow-growing organisms)',
    clinicalSignificance: 'Essential in suspected sepsis. Take BEFORE antibiotics if possible. Take 2-3 sets from different sites. Identifies causative organism and antibiotic sensitivities.',
    preAnalyticRequirements: ['Take BEFORE antibiotics', 'Clean venepuncture site with chlorhexidine', '2-3 sets from different sites/times', '8-10ml per bottle in adults']
  },
  {
    name: 'Wound Swab (MCS)',
    code: 'WS',
    category: 'Microbiology',
    subcategory: 'Culture & sensitivity',
    type: 'microbiology',
    specimen: 'Wound exudate/tissue',
    container: 'Charcoal swab / universal container (for tissue)',
    referenceValues: [
      { parameter: 'Wound Culture', normalRange: 'No pathogenic growth', units: '', gender: 'all' }
    ],
    units: 'Qualitative',
    turnaroundTime: '2-5 days',
    clinicalSignificance: 'Identifies wound pathogens and antibiotic sensitivities. Tissue samples more reliable than surface swabs. Important for surgical site infection management.',
    preAnalyticRequirements: ['Clean wound surface before swabbing', 'Sample from wound edge/base (not surface)', 'Tissue biopsy better than swab for deep infection', 'Send in charcoal transport medium']
  },
  {
    name: 'Urine MCS (Microscopy, Culture & Sensitivity)',
    code: 'UMCS',
    category: 'Microbiology',
    subcategory: 'Culture & sensitivity',
    type: 'microbiology',
    specimen: 'Midstream urine',
    container: 'Universal container (sterile)',
    referenceValues: [
      { parameter: 'WBC in urine', normalRange: '<10', units: 'per HPF', gender: 'all' },
      { parameter: 'Culture', normalRange: 'No significant growth', units: '', gender: 'all' },
      { parameter: 'Significant bacteriuria', normalRange: '>10⁵ CFU/ml', units: 'CFU/ml', gender: 'all' }
    ],
    units: 'Multiple',
    turnaroundTime: '2-3 days',
    clinicalSignificance: 'Diagnoses urinary tract infection. Important pre-operatively if symptomatic UTI or catheterised patient.',
    preAnalyticRequirements: ['Midstream clean-catch specimen', 'Process within 2 hours or refrigerate', 'If catheterised: fresh sample from port, NOT bag']
  },
  {
    name: 'Malaria Parasites (MPs)',
    code: 'MP',
    category: 'Microbiology',
    subcategory: 'Parasitology',
    type: 'microbiology',
    specimen: 'Whole blood',
    container: 'EDTA (purple top) + thick/thin films',
    referenceValues: [
      { parameter: 'Malaria Parasites', normalRange: 'Not seen', units: '', gender: 'all' }
    ],
    units: 'Qualitative/Quantitative',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'Essential in febrile patients in endemic areas. Must rule out before attributing fever to surgical infection. Species identification and parasite count important.',
    preAnalyticRequirements: ['Best sensitivity during fever spike', 'Thick film for detection, thin film for species', 'May need 3 samples over 48h to exclude']
  },
  {
    name: 'HIV Screening (RVS)',
    code: 'HIV',
    category: 'Microbiology',
    subcategory: 'Serology',
    type: 'microbiology',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'HIV 1/2 antibody/antigen', normalRange: 'Non-reactive', units: '', gender: 'all' }
    ],
    units: 'Reactive/Non-reactive',
    turnaroundTime: '30 min (rapid) to 1-3 days (confirmatory)',
    clinicalSignificance: 'Pre-operative screening. Important for immunological status assessment, wound healing, and infection risk. Consent required. Confirmatory testing if positive.',
    preAnalyticRequirements: ['Pre-test counselling required', 'Written consent may be needed (institutional policy)', 'Confirmatory testing for positive results']
  },
  {
    name: 'Hepatitis B Surface Antigen (HBsAg)',
    code: 'HBsAg',
    category: 'Microbiology',
    subcategory: 'Serology',
    type: 'microbiology',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'HBsAg', normalRange: 'Negative', units: '', gender: 'all' }
    ],
    units: 'Positive/Negative',
    turnaroundTime: '30 min (rapid) to 1-3 days',
    clinicalSignificance: 'Pre-operative screening. Universal precautions. Chronic infection risk. Important for blood-borne pathogen risk management.',
    relatedTests: ['HBsAb', 'HBeAg', 'HBV DNA', 'LFT']
  },
  {
    name: 'Hepatitis C Antibody',
    code: 'HCV',
    category: 'Microbiology',
    subcategory: 'Serology',
    type: 'microbiology',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'HCV Antibody', normalRange: 'Negative', units: '', gender: 'all' }
    ],
    units: 'Positive/Negative',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Pre-operative screening. Chronic infection risk. May affect wound healing and liver function.',
    relatedTests: ['HCV RNA', 'LFT']
  },

  // ==================== URINALYSIS ====================
  {
    name: 'Urinalysis (Dipstick)',
    code: 'UA',
    category: 'Urinalysis',
    subcategory: 'Screening',
    type: 'laboratory',
    specimen: 'Random or midstream urine',
    container: 'Universal container',
    referenceValues: [
      { parameter: 'pH', normalRange: '4.5-8.0', units: '', gender: 'all' },
      { parameter: 'Specific Gravity', normalRange: '1.005-1.030', units: '', gender: 'all' },
      { parameter: 'Protein', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Glucose', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Blood', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Ketones', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Nitrites', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Leucocytes', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Bilirubin', normalRange: 'Negative', units: '', gender: 'all' },
      { parameter: 'Urobilinogen', normalRange: 'Normal', units: '', gender: 'all' }
    ],
    units: 'Semiquantitative',
    turnaroundTime: 'Immediate (bedside)',
    clinicalSignificance: 'Quick screening. Pre-operative UTI detection. DKA (ketones+glucose). Renal disease (protein+blood). Pregnancy test can be done on urine.'
  },
  {
    name: 'Urine Pregnancy Test (hCG)',
    code: 'UPT',
    category: 'Urinalysis',
    subcategory: 'Pregnancy',
    type: 'laboratory',
    specimen: 'Urine (first morning preferred)',
    container: 'Universal container',
    referenceValues: [
      { parameter: 'hCG', normalRange: 'Negative', units: '', gender: 'female' }
    ],
    units: 'Positive/Negative',
    turnaroundTime: 'Minutes (bedside)',
    clinicalSignificance: 'MANDATORY pre-operative test for all women of childbearing age (12-55 years). Must be documented before anaesthesia/surgery. Positive result may alter surgical plan.'
  },

  // ==================== ENDOCRINE ====================
  {
    name: 'Serum Cortisol',
    code: 'CORT',
    category: 'Endocrine',
    subcategory: 'Adrenal',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Morning cortisol (9am)', normalRange: '185-624', units: 'nmol/L', gender: 'all' },
      { parameter: 'Midnight cortisol', normalRange: '<138', units: 'nmol/L', gender: 'all' }
    ],
    units: 'nmol/L',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Assess adrenal function in patients on chronic steroids. Wound healing affected by cortisol levels. Important for perioperative steroid cover planning.',
    preAnalyticRequirements: ['9am sample for morning cortisol', 'Patient should not have taken morning steroid dose']
  },

  // ==================== HISTOPATHOLOGY ====================
  {
    name: 'Histopathology (Tissue Biopsy)',
    code: 'HISTO',
    category: 'Histopathology',
    subcategory: 'Tissue diagnosis',
    type: 'histopathology',
    specimen: 'Tissue',
    container: '10% Formalin',
    referenceValues: [
      { parameter: 'Histological diagnosis', normalRange: 'Normal tissue architecture', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '3-14 days (urgent: 1-3 days)',
    clinicalSignificance: 'Definitive diagnosis for excised lesions. Essential for tumour margins, classification, staging. All excised tissue should be sent for histology.',
    preAnalyticRequirements: ['Fix in 10% formalin immediately', 'Label with site/orientation', 'Include clinical details', 'Mark excision margins if relevant']
  },
  {
    name: 'Frozen Section',
    code: 'FS',
    category: 'Histopathology',
    subcategory: 'Intraoperative diagnosis',
    type: 'histopathology',
    specimen: 'Fresh tissue',
    container: 'Fresh (DO NOT put in formalin)',
    referenceValues: [
      { parameter: 'Intraoperative diagnosis', normalRange: 'As reported', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '15-30 minutes',
    clinicalSignificance: 'Rapid intraoperative diagnosis. Used for tumour margin assessment, lymph node metastasis, identification of tissue type. Guides extent of surgical excision.',
    preAnalyticRequirements: ['Send FRESH (no formalin)', 'Pre-arrange with pathology', 'Provide clinical details and specific question']
  },

  // ==================== RADIOLOGY ====================
  {
    name: 'Chest X-ray (CXR)',
    code: 'CXR',
    category: 'Radiology - Plain',
    subcategory: 'Thoracic',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Clear lung fields, normal heart size, no effusion', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '30 min - 2 hours',
    clinicalSignificance: 'Pre-operative screening (>40yrs, cardiac/respiratory history, smokers). Post-operative: pneumonia, pneumothorax, pleural effusion. Burns: inhalation injury assessment.'
  },
  {
    name: 'X-ray (Extremity/Skeletal)',
    code: 'XR',
    category: 'Radiology - Plain',
    subcategory: 'Musculoskeletal',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal bony architecture, no fracture, normal joint spaces', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '30 min - 2 hours',
    clinicalSignificance: 'Pre-operative planning. Fracture assessment. Foreign body detection. Osteomyelitis evaluation (late changes). Arthritis assessment.'
  },
  {
    name: 'Abdominal X-ray (AXR)',
    code: 'AXR',
    category: 'Radiology - Plain',
    subcategory: 'Abdominal',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal bowel gas pattern, no obstruction, no free air', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '30 min - 2 hours',
    clinicalSignificance: 'Bowel obstruction, perforation (erect film for free air), renal stones. Limited role compared to CT.'
  },
  {
    name: 'CT Scan (Head)',
    code: 'CT-HEAD',
    category: 'Radiology - CT',
    subcategory: 'Neuroimaging',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'No intracranial haemorrhage, mass, or midline shift', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '1-4 hours',
    clinicalSignificance: 'Head trauma assessment. Rule out intracranial pathology. Pre-operative for craniofacial surgery.'
  },
  {
    name: 'CT Scan (Chest/Abdomen/Pelvis)',
    code: 'CT-CAP',
    category: 'Radiology - CT',
    subcategory: 'Body imaging',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '2-24 hours',
    clinicalSignificance: 'Staging for malignancies. Abscess detection. Free flap vascular planning. Metastatic workup for skin cancers.',
    preAnalyticRequirements: ['IV contrast: check eGFR (>30), allergy history', 'Metformin: hold 48h post-contrast if eGFR <45', 'Fasting 4h for contrast studies']
  },
  {
    name: 'CT Angiography',
    code: 'CTA',
    category: 'Radiology - CT',
    subcategory: 'Vascular imaging',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Patent vessels, no stenosis/occlusion', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '2-4 hours',
    clinicalSignificance: 'Free flap planning - identify perforators. Vascular assessment before microsurgery. PE diagnosis (CTPA).',
    preAnalyticRequirements: ['IV contrast required', 'Check renal function', 'Allergy history']
  },
  {
    name: 'MRI (Soft Tissue/Extremity)',
    code: 'MRI-ST',
    category: 'Radiology - MRI',
    subcategory: 'Soft tissue imaging',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal soft tissue architecture', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '1-7 days (routine), 1-2 days (urgent)',
    clinicalSignificance: 'Superior soft tissue contrast. Tumour staging and extent. Nerve assessment. Pre-operative planning for complex soft tissue reconstruction.',
    preAnalyticRequirements: ['MRI safety screening (metal implants, pacemaker)', 'May need contrast (check eGFR)', 'Claustrophobia management']
  },
  {
    name: 'MRI (Head/Face)',
    code: 'MRI-H',
    category: 'Radiology - MRI',
    subcategory: 'Neuroimaging/Craniofacial',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal intracranial and facial structures', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '1-7 days',
    clinicalSignificance: 'Craniofacial planning. Vascular malformation assessment. Tumour extent evaluation. Nerve pathology.'
  },
  {
    name: 'Ultrasound (Soft Tissue)',
    code: 'USS-ST',
    category: 'Radiology - Ultrasound',
    subcategory: 'Musculoskeletal/Soft tissue',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal soft tissue', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '30 min - 1 day',
    clinicalSignificance: 'Abscess vs cellulitis differentiation. Fluid collection assessment. Foreign body localisation. Vascular assessment (Doppler). Lymph node assessment.'
  },
  {
    name: 'Doppler Ultrasound (Vascular)',
    code: 'DOPP',
    category: 'Radiology - Ultrasound',
    subcategory: 'Vascular',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Arterial flow', normalRange: 'Triphasic waveform, no stenosis', units: '', gender: 'all' },
      { parameter: 'Venous flow', normalRange: 'Compressible veins, no thrombus', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '1-3 days (routine), same day (urgent DVT)',
    clinicalSignificance: 'DVT diagnosis. Arterial patency assessment. Perforator mapping for flap surgery. Venous insufficiency assessment. Post-operative flap monitoring.'
  },
  {
    name: 'Ultrasound (Abdomen)',
    code: 'USS-ABD',
    category: 'Radiology - Ultrasound',
    subcategory: 'Abdominal',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Normal liver, gallbladder, spleen, kidneys, bladder', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Non-invasive abdominal assessment. Gallstones, renal stones, hydronephrosis, ascites.',
    preAnalyticRequirements: ['Fasting 4-6 hours for upper abdominal scan', 'Full bladder for pelvic scan']
  },
  {
    name: 'Angiography (Digital Subtraction)',
    code: 'DSA',
    category: 'Radiology - Special',
    subcategory: 'Vascular interventional',
    type: 'imaging',
    referenceValues: [
      { parameter: 'Findings', normalRange: 'Patent vasculature, no malformation', units: '', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: 'Same day',
    clinicalSignificance: 'Gold standard for vascular anatomy. AVM assessment and embolisation. Limb revascularisation assessment.',
    preAnalyticRequirements: ['Invasive procedure', 'Consent required', 'Check coagulation', 'Check renal function (contrast)', 'Post-procedure: bed rest, check puncture site']
  },

  // ==================== MISCELLANEOUS ====================
  {
    name: 'Electrocardiogram (ECG)',
    code: 'ECG',
    category: 'Miscellaneous',
    subcategory: 'Cardiac electrical activity',
    type: 'other',
    referenceValues: [
      { parameter: 'Rate', normalRange: '60-100', units: 'bpm', gender: 'all' },
      { parameter: 'Rhythm', normalRange: 'Sinus rhythm', units: '', gender: 'all' },
      { parameter: 'PR interval', normalRange: '0.12-0.20', units: 'seconds', gender: 'all' },
      { parameter: 'QRS duration', normalRange: '<0.12', units: 'seconds', gender: 'all' },
      { parameter: 'QTc', normalRange: '<0.44 (M), <0.46 (F)', units: 'seconds', gender: 'all' }
    ],
    units: 'Descriptive',
    turnaroundTime: 'Immediate',
    clinicalSignificance: 'Pre-operative screening (>40yrs, cardiac history, hypertension, diabetics). Hyperkalaemia assessment. Chest pain evaluation. Drug monitoring (QT prolongation).'
  },
  {
    name: 'Iron Studies',
    code: 'IRON',
    category: 'Haematology',
    subcategory: 'Iron metabolism',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Serum Iron', normalRange: '10-30', units: 'µmol/L', gender: 'all' },
      { parameter: 'Ferritin', normalRange: '15-300', units: 'µg/L', gender: 'male' },
      { parameter: 'Ferritin', normalRange: '15-200', units: 'µg/L', gender: 'female' },
      { parameter: 'TIBC', normalRange: '45-72', units: 'µmol/L', gender: 'all' },
      { parameter: 'Transferrin Saturation', normalRange: '20-50', units: '%', gender: 'all' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Diagnoses iron deficiency anaemia. Monitors iron replacement therapy. Ferritin is acute phase reactant (elevated in infection/inflammation).',
    preAnalyticRequirements: ['Fasting preferred', 'Morning sample', 'Do not take iron supplements for 24h before']
  },
  {
    name: 'Vitamin B12 and Folate',
    code: 'B12FOL',
    category: 'Haematology',
    subcategory: 'Haematinics',
    type: 'laboratory',
    specimen: 'Serum',
    container: 'Gel separator (gold/yellow top)',
    referenceValues: [
      { parameter: 'Vitamin B12', normalRange: '180-900', units: 'pg/mL', gender: 'all' },
      { parameter: 'Folate (serum)', normalRange: '3.0-20.0', units: 'ng/mL', gender: 'all' }
    ],
    units: 'Multiple',
    turnaroundTime: '1-3 days',
    clinicalSignificance: 'Investigate macrocytic anaemia. B12 deficiency causes neurological symptoms. Folate important in wound healing and cell division.',
    relatedTests: ['FBC', 'Blood film']
  },
  {
    name: 'LRINEC Score Components',
    code: 'LRINEC',
    category: 'Inflammatory Markers',
    subcategory: 'Necrotising fasciitis score',
    type: 'laboratory',
    specimen: 'Serum + Blood',
    container: 'EDTA + Gel separator',
    referenceValues: [
      { parameter: 'CRP (≥150 = 4 points)', normalRange: '<5', units: 'mg/L', gender: 'all' },
      { parameter: 'WCC (15-25 = 1pt, >25 = 2pts)', normalRange: '4.0-11.0', units: '×10⁹/L', gender: 'all' },
      { parameter: 'Haemoglobin (11-13.5 = 1pt, <11 = 2pts)', normalRange: '12-17', units: 'g/dL', gender: 'all' },
      { parameter: 'Sodium (<135 = 2pts)', normalRange: '135-145', units: 'mmol/L', gender: 'all' },
      { parameter: 'Creatinine (>141 = 2pts)', normalRange: '60-120', units: 'µmol/L', gender: 'all' },
      { parameter: 'Glucose (>10 = 1pt)', normalRange: '3.5-5.5', units: 'mmol/L', gender: 'all' }
    ],
    units: 'Score 0-13',
    turnaroundTime: '1-2 hours',
    clinicalSignificance: 'LRINEC Score ≥6: Suspect necrotising fasciitis. ≥8: Strongly suggestive. Score components: CRP, WCC, Hb, Na, Creatinine, Glucose. Guides surgical decision-making.',
    relatedTests: ['CRP', 'FBC', 'U&E', 'Blood glucose']
  }
];

// ==================== SEARCH AND UTILITY FUNCTIONS ====================

/**
 * Search investigations by name (partial match)
 */
export function searchInvestigations(query: string): Investigation[] {
  if (!query || query.length < 2) return [];
  const lower = query.toLowerCase();
  return INVESTIGATIONS.filter(inv =>
    inv.name.toLowerCase().includes(lower) ||
    inv.code.toLowerCase().includes(lower) ||
    inv.subcategory.toLowerCase().includes(lower)
  ).slice(0, 20);
}

/**
 * Get investigation by code
 */
export function getInvestigationByCode(code: string): Investigation | undefined {
  return INVESTIGATIONS.find(inv => inv.code.toLowerCase() === code.toLowerCase());
}

/**
 * Get investigation by name
 */
export function getInvestigationByName(name: string): Investigation | undefined {
  return INVESTIGATIONS.find(inv =>
    inv.name.toLowerCase() === name.toLowerCase() ||
    inv.code.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get investigations by category
 */
export function getInvestigationsByCategory(category: InvestigationCategory): Investigation[] {
  return INVESTIGATIONS.filter(inv => inv.category === category);
}

/**
 * Get all investigation names for autocomplete
 */
export function getAllInvestigationNames(): { name: string; code: string }[] {
  return INVESTIGATIONS.map(inv => ({ name: inv.name, code: inv.code }));
}

/**
 * Get pre-operative investigation panel
 */
export function getPreOperativePanel(): Investigation[] {
  const preOpCodes = ['FBC', 'UE', 'COAG', 'GS', 'RBG', 'LFT', 'ECG', 'CXR', 'UA', 'UPT', 'HIV', 'HBsAg', 'HbElec'];
  return preOpCodes
    .map(code => getInvestigationByCode(code))
    .filter((inv): inv is Investigation => inv !== undefined);
}

/**
 * Get septic workup panel
 */
export function getSepticWorkupPanel(): Investigation[] {
  const septicCodes = ['FBC', 'UE', 'CRP', 'PCT', 'LAC', 'BC', 'UMCS', 'ABG', 'COAG', 'LFT', 'RBG', 'MP'];
  return septicCodes
    .map(code => getInvestigationByCode(code))
    .filter((inv): inv is Investigation => inv !== undefined);
}

/**
 * Get wound infection workup
 */
export function getWoundInfectionPanel(): Investigation[] {
  const codes = ['FBC', 'CRP', 'UE', 'RBG', 'WS', 'BC', 'LRINEC'];
  return codes
    .map(code => getInvestigationByCode(code))
    .filter((inv): inv is Investigation => inv !== undefined);
}

/**
 * Get burns assessment investigations
 */
export function getBurnsPanel(): Investigation[] {
  const codes = ['FBC', 'UE', 'LFT', 'COAG', 'GS', 'XM', 'ABG', 'RBG', 'ALB', 'CRP', 'UMCS'];
  return codes
    .map(code => getInvestigationByCode(code))
    .filter((inv): inv is Investigation => inv !== undefined);
}
