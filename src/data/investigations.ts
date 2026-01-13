// Comprehensive Investigations Database with Normal Values
// Categories: Laboratory, Imaging, Special Investigations

export interface Investigation {
  id: string;
  name: string;
  shortName?: string;
  category: string;
  subcategory?: string;
  specimen?: string;
  container?: string;
  unit: string;
  normalRanges: NormalRange[];
  criticalValues?: CriticalValue[];
  description?: string;
  turnaroundTime?: string;
  specialInstructions?: string;
}

export interface NormalRange {
  population?: 'adult' | 'pediatric' | 'neonate' | 'male' | 'female' | 'pregnant' | 'elderly';
  ageMin?: number;
  ageMax?: number;
  ageUnit?: 'days' | 'months' | 'years';
  min?: number;
  max?: number;
  value?: string; // For qualitative results
}

export interface CriticalValue {
  type: 'low' | 'high';
  value: number;
  action: string;
}

export interface InvestigationCategory {
  id: string;
  name: string;
  description: string;
  subcategories?: string[];
  icon?: string;
}

export const INVESTIGATION_CATEGORIES: InvestigationCategory[] = [
  { 
    id: 'hematology', 
    name: 'Hematology', 
    description: 'Blood cell counts and related tests',
    subcategories: ['Complete Blood Count', 'Coagulation', 'Blood Film'],
    icon: '🩸'
  },
  { 
    id: 'chemistry', 
    name: 'Clinical Chemistry', 
    description: 'Blood chemistry and metabolic tests',
    subcategories: ['Electrolytes', 'Renal Function', 'Liver Function', 'Cardiac Markers', 'Lipid Profile', 'Glucose'],
    icon: '🧪'
  },
  { 
    id: 'microbiology', 
    name: 'Microbiology', 
    description: 'Culture and sensitivity tests',
    subcategories: ['Blood Culture', 'Urine Culture', 'Wound Culture', 'Stool Culture'],
    icon: '🦠'
  },
  { 
    id: 'urinalysis', 
    name: 'Urinalysis', 
    description: 'Urine examination',
    icon: '💧'
  },
  { 
    id: 'serology', 
    name: 'Serology & Immunology', 
    description: 'Antibody and antigen tests',
    subcategories: ['Viral Markers', 'Autoimmune', 'Blood Grouping'],
    icon: '🔬'
  },
  { 
    id: 'imaging', 
    name: 'Imaging Studies', 
    description: 'Radiological investigations',
    subcategories: ['X-Ray', 'Ultrasound', 'CT Scan', 'MRI', 'Angiography'],
    icon: '📷'
  },
  { 
    id: 'ecg', 
    name: 'Cardiac Investigations', 
    description: 'Heart-related tests',
    subcategories: ['ECG', 'Echocardiography'],
    icon: '❤️'
  },
  { 
    id: 'special', 
    name: 'Special Investigations', 
    description: 'Specialized tests',
    subcategories: ['Endoscopy', 'Biopsy', 'Nerve Studies'],
    icon: '🔎'
  },
];

export const INVESTIGATIONS: Investigation[] = [
  // ========== HEMATOLOGY - COMPLETE BLOOD COUNT ==========
  {
    id: 'hb',
    name: 'Hemoglobin',
    shortName: 'Hb',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'g/dL',
    normalRanges: [
      { population: 'male', min: 13.5, max: 17.5 },
      { population: 'female', min: 12.0, max: 15.5 },
      { population: 'pregnant', min: 11.0, max: 14.0 },
      { population: 'neonate', min: 14.0, max: 22.0 },
      { population: 'pediatric', ageMin: 1, ageMax: 12, ageUnit: 'years', min: 11.5, max: 14.5 },
    ],
    criticalValues: [
      { type: 'low', value: 7.0, action: 'Consider transfusion, notify physician immediately' },
      { type: 'high', value: 20.0, action: 'Rule out polycythemia, notify physician' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'pcv',
    name: 'Packed Cell Volume (Hematocrit)',
    shortName: 'PCV/HCT',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: '%',
    normalRanges: [
      { population: 'male', min: 40, max: 54 },
      { population: 'female', min: 36, max: 48 },
      { population: 'neonate', min: 45, max: 65 },
    ],
    criticalValues: [
      { type: 'low', value: 20, action: 'Immediate physician notification, consider transfusion' },
      { type: 'high', value: 65, action: 'Rule out dehydration/polycythemia' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'wbc',
    name: 'White Blood Cell Count',
    shortName: 'WBC',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'x10⁹/L',
    normalRanges: [
      { population: 'adult', min: 4.0, max: 11.0 },
      { population: 'neonate', min: 9.0, max: 30.0 },
      { population: 'pediatric', ageMin: 1, ageMax: 12, ageUnit: 'years', min: 5.0, max: 13.0 },
    ],
    criticalValues: [
      { type: 'low', value: 2.0, action: 'Neutropenic precautions, investigate cause' },
      { type: 'high', value: 30.0, action: 'Rule out leukemia/severe infection' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'neutrophils',
    name: 'Neutrophils',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: '%',
    normalRanges: [
      { population: 'adult', min: 40, max: 70 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'lymphocytes',
    name: 'Lymphocytes',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: '%',
    normalRanges: [
      { population: 'adult', min: 20, max: 40 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'platelets',
    name: 'Platelet Count',
    shortName: 'PLT',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'x10⁹/L',
    normalRanges: [
      { population: 'adult', min: 150, max: 400 },
      { population: 'neonate', min: 150, max: 450 },
    ],
    criticalValues: [
      { type: 'low', value: 50, action: 'Bleeding precautions, may need platelet transfusion' },
      { type: 'low', value: 20, action: 'URGENT: High bleeding risk, immediate intervention' },
      { type: 'high', value: 1000, action: 'Rule out myeloproliferative disorder' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'mcv',
    name: 'Mean Corpuscular Volume',
    shortName: 'MCV',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'fL',
    normalRanges: [
      { population: 'adult', min: 80, max: 100 },
    ],
    description: 'Helps classify anemia: <80 microcytic, 80-100 normocytic, >100 macrocytic',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'mch',
    name: 'Mean Corpuscular Hemoglobin',
    shortName: 'MCH',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'pg',
    normalRanges: [
      { population: 'adult', min: 27, max: 32 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'mchc',
    name: 'Mean Corpuscular Hemoglobin Concentration',
    shortName: 'MCHC',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'g/dL',
    normalRanges: [
      { population: 'adult', min: 32, max: 36 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'esr',
    name: 'Erythrocyte Sedimentation Rate',
    shortName: 'ESR',
    category: 'hematology',
    subcategory: 'Complete Blood Count',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'mm/hr',
    normalRanges: [
      { population: 'male', max: 15 },
      { population: 'female', max: 20 },
      { population: 'elderly', max: 30 },
    ],
    description: 'Non-specific marker of inflammation',
    turnaroundTime: '1 hour',
  },

  // ========== HEMATOLOGY - COAGULATION ==========
  {
    id: 'pt',
    name: 'Prothrombin Time',
    shortName: 'PT',
    category: 'hematology',
    subcategory: 'Coagulation',
    specimen: 'Citrated Blood',
    container: 'Blue top',
    unit: 'seconds',
    normalRanges: [
      { population: 'adult', min: 11, max: 13.5 },
    ],
    criticalValues: [
      { type: 'high', value: 30, action: 'High bleeding risk, check INR, notify physician' },
    ],
    specialInstructions: 'Fill tube to mark, mix gently',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'inr',
    name: 'International Normalized Ratio',
    shortName: 'INR',
    category: 'hematology',
    subcategory: 'Coagulation',
    specimen: 'Citrated Blood',
    container: 'Blue top',
    unit: 'ratio',
    normalRanges: [
      { population: 'adult', min: 0.9, max: 1.1 },
    ],
    description: 'Therapeutic range for warfarin: 2.0-3.0 (3.0-4.0 for mechanical valves)',
    criticalValues: [
      { type: 'high', value: 5.0, action: 'URGENT: High bleeding risk, may need Vitamin K' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'ptt',
    name: 'Partial Thromboplastin Time',
    shortName: 'PTT/aPTT',
    category: 'hematology',
    subcategory: 'Coagulation',
    specimen: 'Citrated Blood',
    container: 'Blue top',
    unit: 'seconds',
    normalRanges: [
      { population: 'adult', min: 25, max: 35 },
    ],
    criticalValues: [
      { type: 'high', value: 100, action: 'URGENT: High bleeding risk, check for heparin effect' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'bt',
    name: 'Bleeding Time',
    shortName: 'BT',
    category: 'hematology',
    subcategory: 'Coagulation',
    unit: 'minutes',
    normalRanges: [
      { population: 'adult', min: 2, max: 7 },
    ],
    turnaroundTime: '15 minutes',
  },
  {
    id: 'ct',
    name: 'Clotting Time',
    shortName: 'CT',
    category: 'hematology',
    subcategory: 'Coagulation',
    unit: 'minutes',
    normalRanges: [
      { population: 'adult', min: 5, max: 11 },
    ],
    turnaroundTime: '15 minutes',
  },

  // ========== CLINICAL CHEMISTRY - ELECTROLYTES ==========
  {
    id: 'sodium',
    name: 'Sodium',
    shortName: 'Na+',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum/Plasma',
    container: 'Red top/Yellow top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 135, max: 145 },
    ],
    criticalValues: [
      { type: 'low', value: 120, action: 'URGENT: Risk of cerebral edema, immediate correction' },
      { type: 'high', value: 160, action: 'URGENT: Risk of dehydration, careful correction' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'potassium',
    name: 'Potassium',
    shortName: 'K+',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum/Plasma',
    container: 'Red top/Yellow top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 3.5, max: 5.0 },
    ],
    criticalValues: [
      { type: 'low', value: 2.5, action: 'URGENT: Cardiac arrhythmia risk, IV replacement' },
      { type: 'high', value: 6.0, action: 'URGENT: Cardiac arrhythmia risk, calcium gluconate, insulin/dextrose' },
    ],
    specialInstructions: 'Avoid hemolysis, do not fist pump',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'chloride',
    name: 'Chloride',
    shortName: 'Cl-',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 98, max: 106 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'bicarbonate',
    name: 'Bicarbonate',
    shortName: 'HCO3-',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 22, max: 28 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'calcium',
    name: 'Calcium (Total)',
    shortName: 'Ca2+',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 2.2, max: 2.6 },
    ],
    criticalValues: [
      { type: 'low', value: 1.5, action: 'Tetany risk, IV calcium replacement' },
      { type: 'high', value: 3.5, action: 'Confusion, arrhythmia risk, hydration' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'magnesium',
    name: 'Magnesium',
    shortName: 'Mg2+',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 0.7, max: 1.0 },
    ],
    criticalValues: [
      { type: 'low', value: 0.5, action: 'Arrhythmia risk, IV replacement' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'phosphate',
    name: 'Phosphate',
    shortName: 'PO4',
    category: 'chemistry',
    subcategory: 'Electrolytes',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 0.8, max: 1.5 },
    ],
    turnaroundTime: '1-2 hours',
  },

  // ========== CLINICAL CHEMISTRY - RENAL FUNCTION ==========
  {
    id: 'urea',
    name: 'Blood Urea',
    shortName: 'Urea',
    category: 'chemistry',
    subcategory: 'Renal Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 2.5, max: 7.1 },
    ],
    criticalValues: [
      { type: 'high', value: 35, action: 'Consider dialysis, check for uremia symptoms' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'creatinine',
    name: 'Creatinine',
    shortName: 'Cr',
    category: 'chemistry',
    subcategory: 'Renal Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'μmol/L',
    normalRanges: [
      { population: 'male', min: 62, max: 106 },
      { population: 'female', min: 44, max: 80 },
    ],
    criticalValues: [
      { type: 'high', value: 500, action: 'Consider dialysis, nephrology consult' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'egfr',
    name: 'Estimated Glomerular Filtration Rate',
    shortName: 'eGFR',
    category: 'chemistry',
    subcategory: 'Renal Function',
    specimen: 'Calculated',
    unit: 'mL/min/1.73m²',
    normalRanges: [
      { population: 'adult', min: 90, max: 120 },
    ],
    description: 'CKD staging: G1>90, G2:60-89, G3a:45-59, G3b:30-44, G4:15-29, G5<15',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'uric_acid',
    name: 'Uric Acid',
    category: 'chemistry',
    subcategory: 'Renal Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'μmol/L',
    normalRanges: [
      { population: 'male', min: 200, max: 430 },
      { population: 'female', min: 140, max: 360 },
    ],
    turnaroundTime: '1-2 hours',
  },

  // ========== CLINICAL CHEMISTRY - LIVER FUNCTION ==========
  {
    id: 'total_bilirubin',
    name: 'Total Bilirubin',
    shortName: 'T.Bil',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'μmol/L',
    normalRanges: [
      { population: 'adult', min: 5, max: 21 },
      { population: 'neonate', min: 0, max: 205 }, // First week
    ],
    criticalValues: [
      { type: 'high', value: 300, action: 'Severe jaundice, investigate cause urgently' },
    ],
    specialInstructions: 'Protect from light',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'direct_bilirubin',
    name: 'Direct (Conjugated) Bilirubin',
    shortName: 'D.Bil',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'μmol/L',
    normalRanges: [
      { population: 'adult', min: 0, max: 5 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'alt',
    name: 'Alanine Aminotransferase',
    shortName: 'ALT/SGPT',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'U/L',
    normalRanges: [
      { population: 'adult', min: 7, max: 56 },
    ],
    description: 'More specific for liver damage than AST',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'ast',
    name: 'Aspartate Aminotransferase',
    shortName: 'AST/SGOT',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'U/L',
    normalRanges: [
      { population: 'adult', min: 10, max: 40 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'alp',
    name: 'Alkaline Phosphatase',
    shortName: 'ALP',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'U/L',
    normalRanges: [
      { population: 'adult', min: 44, max: 147 },
      { population: 'pediatric', min: 150, max: 420 }, // Higher in growing children
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'ggt',
    name: 'Gamma-Glutamyl Transferase',
    shortName: 'GGT',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'U/L',
    normalRanges: [
      { population: 'male', min: 8, max: 61 },
      { population: 'female', min: 5, max: 36 },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'albumin',
    name: 'Albumin',
    shortName: 'Alb',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'g/L',
    normalRanges: [
      { population: 'adult', min: 35, max: 50 },
    ],
    criticalValues: [
      { type: 'low', value: 20, action: 'Consider albumin replacement, investigate cause' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'total_protein',
    name: 'Total Protein',
    shortName: 'TP',
    category: 'chemistry',
    subcategory: 'Liver Function',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'g/L',
    normalRanges: [
      { population: 'adult', min: 60, max: 83 },
    ],
    turnaroundTime: '1-2 hours',
  },

  // ========== CLINICAL CHEMISTRY - CARDIAC MARKERS ==========
  {
    id: 'troponin_i',
    name: 'Troponin I',
    shortName: 'TnI',
    category: 'chemistry',
    subcategory: 'Cardiac Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'ng/mL',
    normalRanges: [
      { population: 'adult', max: 0.04 },
    ],
    criticalValues: [
      { type: 'high', value: 0.1, action: 'URGENT: Rule out MI, cardiology consult' },
    ],
    description: 'Rises 4-6 hours after MI, peaks 12-24 hours',
    turnaroundTime: '1 hour (STAT)',
  },
  {
    id: 'troponin_t',
    name: 'Troponin T',
    shortName: 'TnT',
    category: 'chemistry',
    subcategory: 'Cardiac Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'ng/mL',
    normalRanges: [
      { population: 'adult', max: 0.01 },
    ],
    criticalValues: [
      { type: 'high', value: 0.1, action: 'URGENT: Rule out MI, cardiology consult' },
    ],
    turnaroundTime: '1 hour (STAT)',
  },
  {
    id: 'ck_mb',
    name: 'Creatine Kinase-MB',
    shortName: 'CK-MB',
    category: 'chemistry',
    subcategory: 'Cardiac Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'U/L',
    normalRanges: [
      { population: 'adult', max: 25 },
    ],
    description: 'Rises 4-8 hours after MI, useful for reinfarction detection',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'bnp',
    name: 'Brain Natriuretic Peptide',
    shortName: 'BNP',
    category: 'chemistry',
    subcategory: 'Cardiac Markers',
    specimen: 'EDTA Plasma',
    container: 'Purple top',
    unit: 'pg/mL',
    normalRanges: [
      { population: 'adult', max: 100 },
    ],
    description: 'Heart failure marker: >400 suggests HF, <100 unlikely HF',
    turnaroundTime: '1-2 hours',
  },

  // ========== CLINICAL CHEMISTRY - LIPID PROFILE ==========
  {
    id: 'total_cholesterol',
    name: 'Total Cholesterol',
    shortName: 'TC',
    category: 'chemistry',
    subcategory: 'Lipid Profile',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', max: 5.2 },
    ],
    specialInstructions: 'Fasting 9-12 hours preferred',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'ldl',
    name: 'Low-Density Lipoprotein',
    shortName: 'LDL',
    category: 'chemistry',
    subcategory: 'Lipid Profile',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', max: 3.4 },
    ],
    description: 'Target <1.8 for high CV risk, <2.6 for moderate risk',
    specialInstructions: 'Fasting required',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'hdl',
    name: 'High-Density Lipoprotein',
    shortName: 'HDL',
    category: 'chemistry',
    subcategory: 'Lipid Profile',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'male', min: 1.0 },
      { population: 'female', min: 1.3 },
    ],
    specialInstructions: 'Fasting preferred',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'triglycerides',
    name: 'Triglycerides',
    shortName: 'TG',
    category: 'chemistry',
    subcategory: 'Lipid Profile',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', max: 1.7 },
    ],
    criticalValues: [
      { type: 'high', value: 11.3, action: 'Pancreatitis risk, urgent intervention' },
    ],
    specialInstructions: 'Fasting 12 hours required',
    turnaroundTime: '1-2 hours',
  },

  // ========== CLINICAL CHEMISTRY - GLUCOSE ==========
  {
    id: 'fbs',
    name: 'Fasting Blood Sugar',
    shortName: 'FBS/FPG',
    category: 'chemistry',
    subcategory: 'Glucose',
    specimen: 'Plasma',
    container: 'Grey top (fluoride)',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', min: 3.9, max: 5.5 },
    ],
    description: 'Prediabetes: 5.6-6.9, Diabetes: ≥7.0',
    criticalValues: [
      { type: 'low', value: 2.8, action: 'URGENT: IV dextrose, rule out hypoglycemia cause' },
      { type: 'high', value: 25, action: 'URGENT: Rule out DKA/HHS, insulin therapy' },
    ],
    specialInstructions: 'Fasting 8-12 hours',
    turnaroundTime: '1 hour',
  },
  {
    id: 'rbs',
    name: 'Random Blood Sugar',
    shortName: 'RBS',
    category: 'chemistry',
    subcategory: 'Glucose',
    specimen: 'Plasma',
    container: 'Grey top',
    unit: 'mmol/L',
    normalRanges: [
      { population: 'adult', max: 7.8 },
    ],
    description: 'Diabetes: ≥11.1 with symptoms',
    criticalValues: [
      { type: 'low', value: 2.8, action: 'URGENT: IV dextrose' },
      { type: 'high', value: 25, action: 'URGENT: Rule out DKA/HHS' },
    ],
    turnaroundTime: '30 minutes',
  },
  {
    id: 'hba1c',
    name: 'Glycated Hemoglobin',
    shortName: 'HbA1c',
    category: 'chemistry',
    subcategory: 'Glucose',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: '%',
    normalRanges: [
      { population: 'adult', max: 5.6 },
    ],
    description: 'Prediabetes: 5.7-6.4%, Diabetes: ≥6.5%, Target for diabetics: <7%',
    turnaroundTime: '1-2 hours',
  },

  // ========== URINALYSIS ==========
  {
    id: 'urinalysis',
    name: 'Urinalysis (Complete)',
    shortName: 'U/A',
    category: 'urinalysis',
    specimen: 'Midstream Urine',
    container: 'Sterile container',
    unit: 'Various',
    normalRanges: [
      { value: 'pH: 4.5-8.0' },
      { value: 'Specific Gravity: 1.005-1.030' },
      { value: 'Protein: Negative' },
      { value: 'Glucose: Negative' },
      { value: 'Blood: Negative' },
      { value: 'Leukocytes: Negative' },
      { value: 'Nitrites: Negative' },
      { value: 'Ketones: Negative' },
      { value: 'Bilirubin: Negative' },
      { value: 'Urobilinogen: Normal' },
    ],
    specialInstructions: 'Clean catch, midstream sample',
    turnaroundTime: '30 minutes',
  },
  {
    id: 'urine_protein',
    name: 'Urine Protein',
    category: 'urinalysis',
    specimen: 'Urine',
    unit: 'mg/L',
    normalRanges: [
      { population: 'adult', max: 150 },
    ],
    turnaroundTime: '1 hour',
  },
  {
    id: 'urine_microalbumin',
    name: 'Urine Microalbumin',
    shortName: 'Microalb',
    category: 'urinalysis',
    specimen: 'Urine',
    unit: 'mg/L',
    normalRanges: [
      { population: 'adult', max: 30 },
    ],
    description: 'Early diabetic nephropathy marker',
    turnaroundTime: '1-2 hours',
  },

  // ========== SEROLOGY ==========
  {
    id: 'hbsag',
    name: 'Hepatitis B Surface Antigen',
    shortName: 'HBsAg',
    category: 'serology',
    subcategory: 'Viral Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'Qualitative',
    normalRanges: [
      { value: 'Non-reactive/Negative' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'hcv_ab',
    name: 'Hepatitis C Antibody',
    shortName: 'Anti-HCV',
    category: 'serology',
    subcategory: 'Viral Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'Qualitative',
    normalRanges: [
      { value: 'Non-reactive/Negative' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'hiv',
    name: 'HIV 1&2 Antibody/Antigen',
    shortName: 'HIV Screen',
    category: 'serology',
    subcategory: 'Viral Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'Qualitative',
    normalRanges: [
      { value: 'Non-reactive/Negative' },
    ],
    specialInstructions: 'Requires consent',
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'vdrl',
    name: 'VDRL/RPR (Syphilis)',
    shortName: 'VDRL',
    category: 'serology',
    subcategory: 'Viral Markers',
    specimen: 'Serum',
    container: 'Red top',
    unit: 'Qualitative/Titer',
    normalRanges: [
      { value: 'Non-reactive/Negative' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'blood_group',
    name: 'Blood Group and Rhesus',
    shortName: 'G&M',
    category: 'serology',
    subcategory: 'Blood Grouping',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'Type',
    normalRanges: [
      { value: 'A, B, AB, or O with Rh+ or Rh-' },
    ],
    turnaroundTime: '30 minutes',
  },
  {
    id: 'crossmatch',
    name: 'Crossmatch',
    shortName: 'X-match',
    category: 'serology',
    subcategory: 'Blood Grouping',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'Compatibility',
    normalRanges: [
      { value: 'Compatible' },
    ],
    specialInstructions: 'State number of units needed',
    turnaroundTime: '1 hour',
  },

  // ========== MICROBIOLOGY ==========
  {
    id: 'blood_culture',
    name: 'Blood Culture',
    shortName: 'B/C',
    category: 'microbiology',
    subcategory: 'Blood Culture',
    specimen: 'Blood',
    container: 'Blood culture bottles',
    unit: 'Culture',
    normalRanges: [
      { value: 'No growth' },
    ],
    specialInstructions: 'Collect before antibiotics, 2 sets from different sites',
    turnaroundTime: '24-72 hours (preliminary), 5-7 days (final)',
  },
  {
    id: 'urine_culture',
    name: 'Urine Culture & Sensitivity',
    shortName: 'U/C&S',
    category: 'microbiology',
    subcategory: 'Urine Culture',
    specimen: 'Midstream Urine',
    container: 'Sterile container',
    unit: 'CFU/mL',
    normalRanges: [
      { value: '<10³ CFU/mL or No growth' },
    ],
    description: 'Significant: >10⁵ CFU/mL',
    specialInstructions: 'Clean catch, transport within 2 hours',
    turnaroundTime: '24-48 hours',
  },
  {
    id: 'wound_culture',
    name: 'Wound Culture & Sensitivity',
    shortName: 'W/C&S',
    category: 'microbiology',
    subcategory: 'Wound Culture',
    specimen: 'Wound Swab',
    container: 'Sterile swab/transport medium',
    unit: 'Culture',
    normalRanges: [
      { value: 'No pathogenic organisms' },
    ],
    specialInstructions: 'Collect from wound edge, avoid surface contamination',
    turnaroundTime: '24-48 hours',
  },
  {
    id: 'stool_culture',
    name: 'Stool Culture',
    shortName: 'S/C',
    category: 'microbiology',
    subcategory: 'Stool Culture',
    specimen: 'Stool',
    container: 'Sterile container',
    unit: 'Culture',
    normalRanges: [
      { value: 'Normal flora' },
    ],
    turnaroundTime: '24-72 hours',
  },
  {
    id: 'stool_mcs',
    name: 'Stool Microscopy',
    shortName: 'Stool M/C/S',
    category: 'microbiology',
    subcategory: 'Stool Culture',
    specimen: 'Stool',
    container: 'Sterile container',
    unit: 'Microscopy',
    normalRanges: [
      { value: 'No ova, cysts, or parasites' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'malaria_parasite',
    name: 'Malaria Parasite Test',
    shortName: 'MP',
    category: 'microbiology',
    specimen: 'EDTA Blood',
    container: 'Purple top',
    unit: 'Qualitative',
    normalRanges: [
      { value: 'Not seen/Negative' },
    ],
    turnaroundTime: '30 minutes - 1 hour',
  },

  // ========== IMAGING ==========
  {
    id: 'cxr',
    name: 'Chest X-Ray',
    shortName: 'CXR',
    category: 'imaging',
    subcategory: 'X-Ray',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal cardiac silhouette, clear lung fields, no focal consolidation' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'abdominal_xray',
    name: 'Abdominal X-Ray',
    shortName: 'AXR',
    category: 'imaging',
    subcategory: 'X-Ray',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal bowel gas pattern, no free air, no obstruction' },
    ],
    turnaroundTime: '1-2 hours',
  },
  {
    id: 'abdominal_us',
    name: 'Abdominal Ultrasound',
    shortName: 'Abd US',
    category: 'imaging',
    subcategory: 'Ultrasound',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal liver, gallbladder, pancreas, spleen, kidneys' },
    ],
    turnaroundTime: '24-48 hours',
  },
  {
    id: 'pelvic_us',
    name: 'Pelvic Ultrasound',
    shortName: 'Pelvic US',
    category: 'imaging',
    subcategory: 'Ultrasound',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal uterus and adnexa (female), normal bladder and prostate (male)' },
    ],
    turnaroundTime: '24-48 hours',
  },
  {
    id: 'doppler_leg',
    name: 'Doppler Ultrasound (Lower Limb)',
    shortName: 'Leg Doppler',
    category: 'imaging',
    subcategory: 'Ultrasound',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal venous and arterial flow, no DVT' },
    ],
    turnaroundTime: '24-48 hours',
  },
  {
    id: 'ct_head',
    name: 'CT Scan Head',
    shortName: 'CT Head',
    category: 'imaging',
    subcategory: 'CT Scan',
    unit: 'Report',
    normalRanges: [
      { value: 'No acute intracranial abnormality, normal ventricles' },
    ],
    turnaroundTime: '2-4 hours (urgent), 24-48 hours (routine)',
  },
  {
    id: 'ct_abdomen',
    name: 'CT Scan Abdomen/Pelvis',
    shortName: 'CT A/P',
    category: 'imaging',
    subcategory: 'CT Scan',
    unit: 'Report',
    normalRanges: [
      { value: 'No significant abnormality' },
    ],
    turnaroundTime: '24-48 hours',
  },
  {
    id: 'mri_brain',
    name: 'MRI Brain',
    category: 'imaging',
    subcategory: 'MRI',
    unit: 'Report',
    normalRanges: [
      { value: 'No acute intracranial abnormality' },
    ],
    turnaroundTime: '24-72 hours',
  },
  {
    id: 'mri_spine',
    name: 'MRI Spine',
    category: 'imaging',
    subcategory: 'MRI',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal spinal alignment, no disc herniation, no stenosis' },
    ],
    turnaroundTime: '24-72 hours',
  },

  // ========== CARDIAC ==========
  {
    id: 'ecg',
    name: 'Electrocardiogram',
    shortName: 'ECG/EKG',
    category: 'ecg',
    subcategory: 'ECG',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal sinus rhythm, rate 60-100 bpm' },
      { value: 'PR interval: 120-200 ms' },
      { value: 'QRS duration: <120 ms' },
      { value: 'QTc: <440 ms (male), <460 ms (female)' },
    ],
    turnaroundTime: '15-30 minutes',
  },
  {
    id: 'echo',
    name: 'Echocardiogram',
    shortName: 'Echo',
    category: 'ecg',
    subcategory: 'Echocardiography',
    unit: 'Report',
    normalRanges: [
      { value: 'Normal LV function, EF 55-70%' },
      { value: 'No regional wall motion abnormality' },
      { value: 'Normal valves, no significant regurgitation' },
    ],
    turnaroundTime: '24-48 hours',
  },
];

// Investigation request templates
export const INVESTIGATION_PANELS = [
  {
    id: 'fbc',
    name: 'Full Blood Count',
    investigations: ['hb', 'pcv', 'wbc', 'neutrophils', 'lymphocytes', 'platelets', 'mcv', 'mch', 'mchc'],
  },
  {
    id: 'e_u_cr',
    name: 'Electrolytes, Urea & Creatinine (E/U/Cr)',
    investigations: ['sodium', 'potassium', 'chloride', 'bicarbonate', 'urea', 'creatinine'],
  },
  {
    id: 'lft',
    name: 'Liver Function Tests (LFT)',
    investigations: ['total_bilirubin', 'direct_bilirubin', 'alt', 'ast', 'alp', 'ggt', 'albumin', 'total_protein'],
  },
  {
    id: 'coag_profile',
    name: 'Coagulation Profile',
    investigations: ['pt', 'inr', 'ptt', 'platelets'],
  },
  {
    id: 'lipid_profile',
    name: 'Lipid Profile',
    investigations: ['total_cholesterol', 'ldl', 'hdl', 'triglycerides'],
  },
  {
    id: 'cardiac_enzymes',
    name: 'Cardiac Enzymes',
    investigations: ['troponin_i', 'ck_mb'],
  },
  {
    id: 'preop_screen',
    name: 'Pre-operative Screening',
    investigations: ['hb', 'pcv', 'wbc', 'platelets', 'sodium', 'potassium', 'urea', 'creatinine', 'fbs', 'urinalysis', 'hbsag', 'hcv_ab', 'hiv', 'blood_group', 'pt', 'inr', 'ptt', 'ecg', 'cxr'],
  },
  {
    id: 'diabetic_profile',
    name: 'Diabetic Profile',
    investigations: ['fbs', 'hba1c', 'sodium', 'potassium', 'urea', 'creatinine', 'urine_microalbumin'],
  },
  {
    id: 'septic_workup',
    name: 'Septic Workup',
    investigations: ['hb', 'wbc', 'platelets', 'sodium', 'potassium', 'urea', 'creatinine', 'blood_culture', 'urine_culture', 'cxr'],
  },
];

// Helper functions
export function getInvestigationsByCategory(categoryId: string): Investigation[] {
  return INVESTIGATIONS.filter(i => i.category === categoryId);
}

export function getInvestigationsBySubcategory(subcategory: string): Investigation[] {
  return INVESTIGATIONS.filter(i => i.subcategory === subcategory);
}

export function searchInvestigations(query: string): Investigation[] {
  const lowerQuery = query.toLowerCase();
  return INVESTIGATIONS.filter(i => 
    i.name.toLowerCase().includes(lowerQuery) ||
    i.shortName?.toLowerCase().includes(lowerQuery) ||
    i.category.toLowerCase().includes(lowerQuery) ||
    i.subcategory?.toLowerCase().includes(lowerQuery)
  );
}

export function getInvestigationById(id: string): Investigation | undefined {
  return INVESTIGATIONS.find(i => i.id === id);
}

export function getNormalRangeForPatient(investigation: Investigation, patient: { age?: number; gender?: string; pregnant?: boolean }): string {
  const ranges = investigation.normalRanges;
  
  if (!ranges || ranges.length === 0) return 'Not specified';
  
  // If there's a qualitative value, return it
  const qualitative = ranges.find(r => r.value);
  if (qualitative) return qualitative.value || 'Not specified';
  
  // Find matching population-specific range
  let matchingRange = ranges.find(r => {
    if (patient.pregnant && r.population === 'pregnant') return true;
    if (patient.gender === 'male' && r.population === 'male') return true;
    if (patient.gender === 'female' && r.population === 'female') return true;
    return false;
  });
  
  // Fall back to adult range if no specific match
  if (!matchingRange) {
    matchingRange = ranges.find(r => r.population === 'adult' || !r.population);
  }
  
  if (!matchingRange) {
    matchingRange = ranges[0];
  }
  
  if (matchingRange.min !== undefined && matchingRange.max !== undefined) {
    return `${matchingRange.min} - ${matchingRange.max} ${investigation.unit}`;
  } else if (matchingRange.min !== undefined) {
    return `≥ ${matchingRange.min} ${investigation.unit}`;
  } else if (matchingRange.max !== undefined) {
    return `≤ ${matchingRange.max} ${investigation.unit}`;
  }
  
  return 'Not specified';
}

export function checkCriticalValue(investigation: Investigation, value: number): { isCritical: boolean; action?: string } {
  if (!investigation.criticalValues) return { isCritical: false };
  
  for (const critical of investigation.criticalValues) {
    if (critical.type === 'low' && value <= critical.value) {
      return { isCritical: true, action: critical.action };
    }
    if (critical.type === 'high' && value >= critical.value) {
      return { isCritical: true, action: critical.action };
    }
  }
  
  return { isCritical: false };
}

export function isValueAbnormal(investigation: Investigation, value: number, patient: { age?: number; gender?: string }): 'normal' | 'low' | 'high' {
  const ranges = investigation.normalRanges;
  
  if (!ranges || ranges.length === 0) return 'normal';
  
  // Find matching population-specific range
  let matchingRange = ranges.find(r => {
    if (patient.gender === 'male' && r.population === 'male') return true;
    if (patient.gender === 'female' && r.population === 'female') return true;
    return false;
  });
  
  if (!matchingRange) {
    matchingRange = ranges.find(r => r.population === 'adult' || !r.population);
  }
  
  if (!matchingRange) return 'normal';
  
  if (matchingRange.min !== undefined && value < matchingRange.min) return 'low';
  if (matchingRange.max !== undefined && value > matchingRange.max) return 'high';
  
  return 'normal';
}
