// Comprehensive Investigation/Laboratory Test Database
// Organized by categories relevant to Plastic Surgery and General Surgical practice
// Based on standard laboratory and imaging references

export interface Investigation {
  name: string;
  abbreviation: string;
  category: InvestigationCategory;
  type: 'lab' | 'imaging' | 'special' | 'bedside';
  specimen?: string;
  normalRange?: string;
  unit?: string;
  turnaroundTime?: string;
  indications: string[];
  preAnalytical?: string[];  // special instructions before test
  cost?: 'low' | 'moderate' | 'high' | 'very-high';
  urgent?: boolean;
  panels?: string[];  // sub-tests if this is a panel
}

export type InvestigationCategory =
  | 'Haematology'
  | 'Biochemistry'
  | 'Coagulation'
  | 'Microbiology'
  | 'Serology'
  | 'Endocrine'
  | 'Immunology'
  | 'Tumour Markers'
  | 'Urinalysis'
  | 'Blood Bank'
  | 'Imaging - Plain'
  | 'Imaging - CT'
  | 'Imaging - MRI'
  | 'Imaging - Ultrasound'
  | 'Imaging - Nuclear'
  | 'Imaging - Angiography'
  | 'Cardiac'
  | 'Pulmonary'
  | 'Neurophysiology'
  | 'Histopathology'
  | 'Bedside Tests'
  | 'Special Tests';

export const INVESTIGATION_CATEGORIES: InvestigationCategory[] = [
  'Haematology',
  'Biochemistry',
  'Coagulation',
  'Microbiology',
  'Serology',
  'Endocrine',
  'Immunology',
  'Tumour Markers',
  'Urinalysis',
  'Blood Bank',
  'Imaging - Plain',
  'Imaging - CT',
  'Imaging - MRI',
  'Imaging - Ultrasound',
  'Imaging - Nuclear',
  'Imaging - Angiography',
  'Cardiac',
  'Pulmonary',
  'Neurophysiology',
  'Histopathology',
  'Bedside Tests',
  'Special Tests'
];

export const INVESTIGATION_DATABASE: Investigation[] = [
  // ==================== HAEMATOLOGY ====================
  {
    name: 'Full Blood Count',
    abbreviation: 'FBC',
    category: 'Haematology',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '1-2 hours',
    indications: ['Pre-operative assessment', 'Anaemia workup', 'Infection screening', 'Bleeding evaluation', 'Routine monitoring'],
    panels: ['Haemoglobin (Hb)', 'White Cell Count (WCC)', 'Platelets', 'Haematocrit (HCT)', 'MCV', 'MCH', 'MCHC', 'RDW', 'Differential WCC'],
    cost: 'low',
    urgent: true,
    normalRange: 'Hb: 12-16 g/dL (F), 13-17 g/dL (M); WCC: 4-11 x10⁹/L; Plt: 150-400 x10⁹/L'
  },
  {
    name: 'Peripheral Blood Film',
    abbreviation: 'PBF',
    category: 'Haematology',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '2-4 hours',
    indications: ['Abnormal FBC', 'Suspected haemolysis', 'Leukaemia screening', 'Malaria'],
    cost: 'low'
  },
  {
    name: 'Erythrocyte Sedimentation Rate',
    abbreviation: 'ESR',
    category: 'Haematology',
    type: 'lab',
    specimen: 'EDTA or sodium citrate',
    normalRange: '<20 mm/hr (M), <30 mm/hr (F)',
    unit: 'mm/hr',
    turnaroundTime: '1 hour',
    indications: ['Inflammatory marker', 'Infection monitoring', 'Autoimmune disease'],
    cost: 'low'
  },
  {
    name: 'Reticulocyte Count',
    abbreviation: 'Retics',
    category: 'Haematology',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    normalRange: '0.5-2.5%',
    turnaroundTime: '2-4 hours',
    indications: ['Anaemia classification', 'Bone marrow response assessment', 'Haemolysis workup'],
    cost: 'low'
  },
  {
    name: 'Haemoglobin Genotype',
    abbreviation: 'Hb Genotype',
    category: 'Haematology',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '24-48 hours',
    indications: ['Pre-operative (especially in West Africa)', 'Sickle cell screening', 'Anaemia workup'],
    cost: 'moderate'
  },
  {
    name: 'G6PD Assay',
    abbreviation: 'G6PD',
    category: 'Haematology',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '24-48 hours',
    indications: ['Pre-operative screening', 'Drug-induced haemolysis risk', 'Neonatal jaundice'],
    cost: 'moderate'
  },
  {
    name: 'Iron Studies',
    abbreviation: 'Fe Studies',
    category: 'Haematology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '4-6 hours',
    indications: ['Iron deficiency anaemia', 'Chronic disease anaemia', 'Iron overload'],
    panels: ['Serum Iron', 'TIBC', 'Transferrin Saturation', 'Ferritin'],
    cost: 'moderate'
  },
  {
    name: 'Vitamin B12 & Folate',
    abbreviation: 'B12/Folate',
    category: 'Haematology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24 hours',
    indications: ['Macrocytic anaemia', 'Neurological symptoms', 'Nutritional assessment'],
    cost: 'moderate'
  },

  // ==================== BIOCHEMISTRY ====================
  {
    name: 'Electrolytes, Urea & Creatinine',
    abbreviation: 'E/U/Cr',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '1-2 hours',
    indications: ['Pre-operative assessment', 'Renal function', 'Fluid balance', 'Drug monitoring'],
    panels: ['Sodium (Na+)', 'Potassium (K+)', 'Chloride (Cl-)', 'Bicarbonate (HCO3-)', 'Urea', 'Creatinine', 'eGFR'],
    normalRange: 'Na: 135-145; K: 3.5-5.0; Urea: 2.5-6.7; Cr: 60-110 µmol/L',
    cost: 'low',
    urgent: true
  },
  {
    name: 'Liver Function Tests',
    abbreviation: 'LFT',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '1-2 hours',
    indications: ['Pre-operative assessment', 'Hepatic function', 'Drug monitoring', 'Jaundice workup'],
    panels: ['Total Bilirubin', 'Direct Bilirubin', 'ALT', 'AST', 'ALP', 'GGT', 'Total Protein', 'Albumin'],
    normalRange: 'ALT: 7-56 U/L; AST: 10-40 U/L; ALP: 44-147 U/L; Albumin: 35-50 g/L',
    cost: 'low',
    urgent: true
  },
  {
    name: 'Fasting Blood Glucose',
    abbreviation: 'FBG',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Fluoride oxalate (grey top)',
    normalRange: '3.9-5.5 mmol/L',
    unit: 'mmol/L',
    turnaroundTime: '1-2 hours',
    indications: ['Diabetes screening', 'Pre-operative assessment', 'Glycaemic control'],
    preAnalytical: ['Fasting for 8-12 hours required'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Random Blood Glucose',
    abbreviation: 'RBG',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Fluoride oxalate (grey top)',
    normalRange: '<11.1 mmol/L',
    unit: 'mmol/L',
    turnaroundTime: '1 hour',
    indications: ['Acute hyperglycaemia', 'Emergency assessment', 'Hypoglycaemia'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Glycated Haemoglobin',
    abbreviation: 'HbA1c',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    normalRange: '<42 mmol/mol (6.0%)',
    turnaroundTime: '2-4 hours',
    indications: ['Diabetes monitoring', 'Pre-operative glycaemic assessment', 'Diabetes diagnosis'],
    cost: 'moderate'
  },
  {
    name: 'Serum Protein & Albumin',
    abbreviation: 'Protein/Alb',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: 'Total Protein: 60-80 g/L; Albumin: 35-50 g/L',
    turnaroundTime: '1-2 hours',
    indications: ['Nutritional assessment', 'Pre-operative evaluation', 'Wound healing assessment', 'Nephrotic syndrome'],
    cost: 'low'
  },
  {
    name: 'Lipid Profile',
    abbreviation: 'Lipids',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '2-4 hours',
    indications: ['Cardiovascular risk assessment', 'Metabolic syndrome', 'Pre-operative cardiac evaluation'],
    panels: ['Total Cholesterol', 'LDL', 'HDL', 'Triglycerides'],
    preAnalytical: ['Fasting for 12 hours recommended'],
    cost: 'low'
  },
  {
    name: 'Calcium, Magnesium & Phosphate',
    abbreviation: 'Ca/Mg/PO4',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: 'Ca: 2.1-2.6 mmol/L; Mg: 0.7-1.0 mmol/L; PO4: 0.8-1.5 mmol/L',
    turnaroundTime: '1-2 hours',
    indications: ['Electrolyte imbalance', 'Parathyroid assessment', 'Nutritional assessment', 'Burns management'],
    cost: 'low'
  },
  {
    name: 'Uric Acid',
    abbreviation: 'Urate',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '0.15-0.45 mmol/L (M); 0.10-0.36 mmol/L (F)',
    turnaroundTime: '2-4 hours',
    indications: ['Gout', 'Renal disease', 'Tumour lysis syndrome'],
    cost: 'low'
  },
  {
    name: 'Amylase',
    abbreviation: 'Amylase',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '28-100 U/L',
    unit: 'U/L',
    turnaroundTime: '1-2 hours',
    indications: ['Acute abdominal pain', 'Pancreatitis', 'Parotid swelling'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Lactate Dehydrogenase',
    abbreviation: 'LDH',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '140-280 U/L',
    turnaroundTime: '2-4 hours',
    indications: ['Tissue damage marker', 'Haemolysis', 'Tumour marker', 'Necrotising fasciitis (LRINEC)'],
    cost: 'low'
  },
  {
    name: 'Arterial Blood Gas',
    abbreviation: 'ABG',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Heparinised syringe (arterial)',
    turnaroundTime: '15-30 minutes',
    indications: ['Respiratory failure', 'Acid-base disturbance', 'Sepsis', 'Burns assessment'],
    panels: ['pH', 'pCO2', 'pO2', 'HCO3-', 'Base Excess', 'Lactate', 'SpO2'],
    normalRange: 'pH: 7.35-7.45; pCO2: 4.7-6.0 kPa; pO2: 10-13 kPa; HCO3: 22-26',
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'Venous Blood Gas',
    abbreviation: 'VBG',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Heparinised syringe (venous)',
    turnaroundTime: '15-30 minutes',
    indications: ['Acid-base assessment', 'Quick electrolytes', 'DKA monitoring'],
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'Serum Lactate',
    abbreviation: 'Lactate',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Fluoride oxalate (grey top) or ABG',
    normalRange: '<2.0 mmol/L',
    unit: 'mmol/L',
    turnaroundTime: '30 minutes',
    indications: ['Sepsis', 'Tissue perfusion', 'Shock assessment', 'Necrotising fasciitis'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'C-Reactive Protein',
    abbreviation: 'CRP',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '<5 mg/L',
    unit: 'mg/L',
    turnaroundTime: '1-2 hours',
    indications: ['Infection/inflammation marker', 'Post-operative monitoring', 'Antibiotic response'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Procalcitonin',
    abbreviation: 'PCT',
    category: 'Biochemistry',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '<0.1 ng/mL',
    turnaroundTime: '2-4 hours',
    indications: ['Bacterial infection marker', 'Sepsis', 'Antibiotic stewardship'],
    cost: 'high'
  },

  // ==================== COAGULATION ====================
  {
    name: 'Coagulation Profile',
    abbreviation: 'PT/INR/aPTT',
    category: 'Coagulation',
    type: 'lab',
    specimen: 'Citrate (blue top)',
    turnaroundTime: '1-2 hours',
    indications: ['Pre-operative assessment', 'Anticoagulant monitoring', 'Bleeding workup', 'Liver disease'],
    panels: ['Prothrombin Time (PT)', 'INR', 'Activated Partial Thromboplastin Time (aPTT)'],
    normalRange: 'PT: 11-13.5s; INR: 0.9-1.1; aPTT: 25-35s',
    cost: 'low',
    urgent: true
  },
  {
    name: 'D-Dimer',
    abbreviation: 'D-Dimer',
    category: 'Coagulation',
    type: 'lab',
    specimen: 'Citrate (blue top)',
    normalRange: '<0.5 mg/L',
    turnaroundTime: '1-2 hours',
    indications: ['DVT/PE exclusion', 'DIC screening', 'Post-operative thrombosis'],
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'Fibrinogen',
    abbreviation: 'Fibrinogen',
    category: 'Coagulation',
    type: 'lab',
    specimen: 'Citrate (blue top)',
    normalRange: '1.5-4.0 g/L',
    turnaroundTime: '1-2 hours',
    indications: ['DIC', 'Bleeding workup', 'Pre-operative (massive blood loss expected)', 'Burns'],
    cost: 'moderate'
  },
  {
    name: 'Bleeding Time',
    abbreviation: 'BT',
    category: 'Coagulation',
    type: 'bedside',
    normalRange: '2-9 minutes',
    turnaroundTime: 'Immediate',
    indications: ['Platelet function assessment', 'Pre-operative screening'],
    cost: 'low'
  },
  {
    name: 'Thromboelastography',
    abbreviation: 'TEG',
    category: 'Coagulation',
    type: 'special',
    specimen: 'Citrate (blue top)',
    turnaroundTime: '30-60 minutes',
    indications: ['Massive transfusion protocol', 'Coagulopathy assessment', 'Liver transplant'],
    cost: 'high'
  },

  // ==================== MICROBIOLOGY ====================
  {
    name: 'Blood Culture',
    abbreviation: 'BC',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Blood culture bottles (aerobic + anaerobic)',
    turnaroundTime: '48-72 hours (prelim 24h)',
    indications: ['Sepsis', 'Fever of unknown origin', 'Bacteraemia', 'Endocarditis'],
    preAnalytical: ['Collect before antibiotics', 'Two sets from separate sites', 'Aseptic technique essential'],
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'Wound Swab (M/C/S)',
    abbreviation: 'Wound MCS',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Swab in transport medium',
    turnaroundTime: '48-72 hours',
    indications: ['Wound infection', 'Surgical site infection', 'Abscess', 'Chronic wounds'],
    preAnalytical: ['Collect from wound edge/base', 'Before wound cleaning', 'Include pus if possible'],
    cost: 'moderate'
  },
  {
    name: 'Urine Microscopy, Culture & Sensitivity',
    abbreviation: 'Urine MCS',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Mid-stream urine in sterile container',
    turnaroundTime: '48-72 hours',
    indications: ['UTI', 'Pre-operative screening', 'Catheter-associated UTI'],
    preAnalytical: ['Mid-stream clean catch', 'Or catheter specimen'],
    cost: 'low'
  },
  {
    name: 'Tissue Culture',
    abbreviation: 'Tissue C/S',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Tissue sample in sterile container',
    turnaroundTime: '48-72 hours',
    indications: ['Deep infection', 'Osteomyelitis', 'Prosthetic infection', 'Chronic wound'],
    preAnalytical: ['Sterile collection intra-operatively', 'Multiple samples preferred'],
    cost: 'moderate'
  },
  {
    name: 'Sputum Culture',
    abbreviation: 'Sputum MCS',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Sputum in sterile container',
    turnaroundTime: '48-72 hours',
    indications: ['Pneumonia', 'Chest infection', 'TB screening'],
    cost: 'moderate'
  },
  {
    name: 'Stool Culture',
    abbreviation: 'Stool MCS',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Stool sample',
    turnaroundTime: '48-72 hours',
    indications: ['Diarrhoea', 'C. difficile', 'Gastroenteritis'],
    cost: 'moderate'
  },
  {
    name: 'AFB (Acid-Fast Bacilli) Smear & Culture',
    abbreviation: 'AFB',
    category: 'Microbiology',
    type: 'lab',
    specimen: 'Sputum/tissue/pus',
    turnaroundTime: 'Smear: 24h; Culture: 6-8 weeks',
    indications: ['Tuberculosis', 'Atypical mycobacterial infection', 'Chronic wound non-healing'],
    cost: 'moderate'
  },

  // ==================== SEROLOGY ====================
  {
    name: 'HIV Screening',
    abbreviation: 'HIV',
    category: 'Serology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '1-4 hours (rapid), 24h (ELISA)',
    indications: ['Pre-operative screening', 'Occupational exposure', 'Clinical suspicion'],
    preAnalytical: ['Counselling required', 'Written consent in some jurisdictions'],
    cost: 'low'
  },
  {
    name: 'Hepatitis B Surface Antigen',
    abbreviation: 'HBsAg',
    category: 'Serology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '2-4 hours',
    indications: ['Pre-operative screening', 'Blood donor screening', 'Hepatitis workup'],
    cost: 'low'
  },
  {
    name: 'Hepatitis C Antibody',
    abbreviation: 'Anti-HCV',
    category: 'Serology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '2-4 hours',
    indications: ['Pre-operative screening', 'Blood donor screening', 'Hepatitis workup'],
    cost: 'low'
  },
  {
    name: 'HIV/HBsAg/HCV Screening Panel',
    abbreviation: 'Retroviral Screen',
    category: 'Serology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '2-4 hours',
    indications: ['Pre-operative screening', 'Universal pre-surgery panel'],
    panels: ['HIV 1/2', 'HBsAg', 'Anti-HCV'],
    cost: 'moderate'
  },
  {
    name: 'VDRL/RPR',
    abbreviation: 'VDRL',
    category: 'Serology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '2-4 hours',
    indications: ['Syphilis screening', 'Pre-operative', 'Chronic ulcer workup'],
    cost: 'low'
  },
  {
    name: 'Widal Test',
    abbreviation: 'Widal',
    category: 'Serology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '2-4 hours',
    indications: ['Typhoid fever', 'Pyrexia of unknown origin'],
    cost: 'low'
  },
  {
    name: 'Malaria Parasite (Rapid + Smear)',
    abbreviation: 'MP',
    category: 'Serology',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '30 min (rapid); 1-2h (smear)',
    indications: ['Fever', 'Pre-operative', 'Tropical setting screening'],
    cost: 'low',
    urgent: true
  },

  // ==================== ENDOCRINE ====================
  {
    name: 'Thyroid Function Tests',
    abbreviation: 'TFT',
    category: 'Endocrine',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '4-24 hours',
    indications: ['Pre-operative thyroid assessment', 'Thyroid disease screening', 'Goitre workup'],
    panels: ['TSH', 'Free T4', 'Free T3'],
    normalRange: 'TSH: 0.4-4.0 mIU/L; FT4: 12-22 pmol/L',
    cost: 'moderate'
  },
  {
    name: 'Cortisol (9am)',
    abbreviation: 'Cortisol',
    category: 'Endocrine',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '171-536 nmol/L (9am)',
    turnaroundTime: '4-24 hours',
    indications: ['Adrenal function', 'Steroid therapy management', 'Cushing syndrome'],
    preAnalytical: ['Collect at 9am', 'Patient should be awake for >30 min'],
    cost: 'moderate'
  },
  {
    name: 'Parathyroid Hormone',
    abbreviation: 'PTH',
    category: 'Endocrine',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '1.6-6.9 pmol/L',
    turnaroundTime: '24 hours',
    indications: ['Calcium disorders', 'Bone disease', 'Parathyroid surgery'],
    cost: 'moderate'
  },

  // ==================== URINALYSIS ====================
  {
    name: 'Urinalysis (Dipstick)',
    abbreviation: 'Urinalysis',
    category: 'Urinalysis',
    type: 'bedside',
    specimen: 'Midstream urine',
    turnaroundTime: 'Immediate',
    indications: ['Pre-operative screening', 'UTI screening', 'Diabetes monitoring', 'Renal disease'],
    panels: ['pH', 'Protein', 'Glucose', 'Blood', 'Leucocytes', 'Nitrites', 'Ketones', 'Bilirubin', 'Specific Gravity'],
    cost: 'low',
    urgent: true
  },
  {
    name: '24-Hour Urine Collection',
    abbreviation: '24h Urine',
    category: 'Urinalysis',
    type: 'lab',
    specimen: '24-hour urine collection',
    turnaroundTime: '24-48 hours (after collection)',
    indications: ['Proteinuria quantification', 'Creatinine clearance', 'Calcium excretion'],
    preAnalytical: ['Complete 24-hour collection required', 'Keep refrigerated'],
    cost: 'moderate'
  },
  {
    name: 'Urine Protein:Creatinine Ratio',
    abbreviation: 'uPCR',
    category: 'Urinalysis',
    type: 'lab',
    specimen: 'Random urine',
    turnaroundTime: '4-6 hours',
    indications: ['Proteinuria screening', 'Nephrotic syndrome', 'Pre-eclampsia'],
    cost: 'low'
  },

  // ==================== BLOOD BANK ====================
  {
    name: 'Blood Group & Rh Type',
    abbreviation: 'Blood Group',
    category: 'Blood Bank',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '30-60 minutes',
    indications: ['Pre-operative', 'Transfusion preparation', 'Emergency'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Blood Group & Cross-Match',
    abbreviation: 'G&XM',
    category: 'Blood Bank',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '1-2 hours',
    indications: ['Pre-operative (expected blood loss)', 'Transfusion', 'Emergency surgery'],
    preAnalytical: ['Must be within 72 hours of transfusion', 'Specify number of units needed'],
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'Antibody Screen (Indirect Coombs)',
    abbreviation: 'IAT',
    category: 'Blood Bank',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '2-4 hours',
    indications: ['Pre-transfusion testing', 'Pregnancy', 'Autoimmune haemolysis'],
    cost: 'moderate'
  },
  {
    name: 'Direct Coombs Test',
    abbreviation: 'DAT',
    category: 'Blood Bank',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    turnaroundTime: '1-2 hours',
    indications: ['Haemolytic anaemia', 'Transfusion reaction', 'Neonatal jaundice'],
    cost: 'moderate'
  },

  // ==================== IMAGING - PLAIN ====================
  {
    name: 'Chest X-Ray',
    abbreviation: 'CXR',
    category: 'Imaging - Plain',
    type: 'imaging',
    turnaroundTime: '30-60 minutes',
    indications: ['Pre-operative assessment (>40 years)', 'Respiratory symptoms', 'Cardiac assessment', 'Trauma'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Abdominal X-Ray',
    abbreviation: 'AXR',
    category: 'Imaging - Plain',
    type: 'imaging',
    turnaroundTime: '30-60 minutes',
    indications: ['Acute abdomen', 'Obstruction', 'Foreign body'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Hand/Wrist X-Ray',
    abbreviation: 'Hand XR',
    category: 'Imaging - Plain',
    type: 'imaging',
    turnaroundTime: '30-60 minutes',
    indications: ['Fracture', 'Hand injury', 'Post-operative assessment'],
    cost: 'low'
  },
  {
    name: 'Facial Bones X-Ray',
    abbreviation: 'Facial XR',
    category: 'Imaging - Plain',
    type: 'imaging',
    turnaroundTime: '30-60 minutes',
    indications: ['Facial trauma', 'Fracture assessment', 'Pre rhinoplasty'],
    cost: 'low'
  },
  {
    name: 'Pelvic X-Ray',
    abbreviation: 'Pelvis XR',
    category: 'Imaging - Plain',
    type: 'imaging',
    turnaroundTime: '30-60 minutes',
    indications: ['Pelvic fracture', 'Hip pain', 'Pre-operative'],
    cost: 'low'
  },
  {
    name: 'Limb X-Ray',
    abbreviation: 'Limb XR',
    category: 'Imaging - Plain',
    type: 'imaging',
    turnaroundTime: '30-60 minutes',
    indications: ['Fracture', 'Osteomyelitis', 'Foreign body', 'Soft tissue gas'],
    cost: 'low'
  },

  // ==================== IMAGING - CT ====================
  {
    name: 'CT Scan Head',
    abbreviation: 'CT Head',
    category: 'Imaging - CT',
    type: 'imaging',
    turnaroundTime: '1-2 hours (urgent: 30 min)',
    indications: ['Head injury', 'Stroke', 'Intracranial pathology', 'Craniofacial planning'],
    cost: 'high',
    urgent: true
  },
  {
    name: 'CT Scan Face/Maxillofacial',
    abbreviation: 'CT Face',
    category: 'Imaging - CT',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Facial fractures', 'Craniofacial reconstruction planning', 'Tumour assessment'],
    cost: 'high'
  },
  {
    name: 'CT Scan Chest',
    abbreviation: 'CT Chest',
    category: 'Imaging - CT',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Pulmonary embolism', 'Lung pathology', 'Chest wall reconstruction'],
    cost: 'high',
    urgent: true
  },
  {
    name: 'CT Scan Abdomen/Pelvis',
    abbreviation: 'CT Abdomen',
    category: 'Imaging - CT',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Acute abdomen', 'Tumour staging', 'Abscess', 'Flap planning'],
    cost: 'high',
    urgent: true
  },
  {
    name: 'CT Angiography',
    abbreviation: 'CTA',
    category: 'Imaging - CT',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Vascular mapping for free flap', 'Perforator flap planning', 'Vascular injury', 'PE'],
    preAnalytical: ['Check renal function (contrast)', 'Allergy history'],
    cost: 'very-high',
    urgent: true
  },
  {
    name: 'CT 3D Reconstruction',
    abbreviation: 'CT 3D',
    category: 'Imaging - CT',
    type: 'imaging',
    turnaroundTime: '2-4 hours',
    indications: ['Craniofacial surgery planning', 'Fracture assessment', 'Custom implant design'],
    cost: 'very-high'
  },

  // ==================== IMAGING - MRI ====================
  {
    name: 'MRI Brain',
    abbreviation: 'MRI Brain',
    category: 'Imaging - MRI',
    type: 'imaging',
    turnaroundTime: '24-48 hours',
    indications: ['Soft tissue tumour', 'Vascular malformation', 'Pre-operative planning'],
    preAnalytical: ['Check for metallic implants', 'Claustrophobia screening'],
    cost: 'very-high'
  },
  {
    name: 'MRI Face/Neck',
    abbreviation: 'MRI Face',
    category: 'Imaging - MRI',
    type: 'imaging',
    turnaroundTime: '24-48 hours',
    indications: ['Head and neck tumour', 'Vascular malformation', 'Nerve involvement assessment'],
    cost: 'very-high'
  },
  {
    name: 'MRI Extremity',
    abbreviation: 'MRI Limb',
    category: 'Imaging - MRI',
    type: 'imaging',
    turnaroundTime: '24-48 hours',
    indications: ['Soft tissue tumour', 'Osteomyelitis', 'Nerve injury', 'Tendon pathology'],
    cost: 'very-high'
  },
  {
    name: 'MR Angiography',
    abbreviation: 'MRA',
    category: 'Imaging - MRI',
    type: 'imaging',
    turnaroundTime: '24-48 hours',
    indications: ['Vascular mapping', 'Perforator flap planning', 'AV malformation'],
    cost: 'very-high'
  },

  // ==================== IMAGING - ULTRASOUND ====================
  {
    name: 'Ultrasound Abdomen',
    abbreviation: 'USS Abdomen',
    category: 'Imaging - Ultrasound',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Abdominal mass', 'Hepatobiliary assessment', 'Free fluid'],
    cost: 'moderate'
  },
  {
    name: 'Ultrasound Soft Tissue/Musculoskeletal',
    abbreviation: 'USS Soft Tissue',
    category: 'Imaging - Ultrasound',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Soft tissue mass', 'Abscess', 'Foreign body', 'Tendon/nerve assessment'],
    cost: 'moderate'
  },
  {
    name: 'Doppler Ultrasound',
    abbreviation: 'Doppler USS',
    category: 'Imaging - Ultrasound',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['DVT assessment', 'Vascular mapping', 'Perforator identification', 'Free flap monitoring'],
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'Ultrasound Neck/Thyroid',
    abbreviation: 'USS Neck',
    category: 'Imaging - Ultrasound',
    type: 'imaging',
    turnaroundTime: '1-2 hours',
    indications: ['Thyroid nodule', 'Neck mass', 'Lymph node assessment'],
    cost: 'moderate'
  },
  {
    name: 'Echocardiography',
    abbreviation: 'Echo',
    category: 'Imaging - Ultrasound',
    type: 'imaging',
    turnaroundTime: '2-4 hours',
    indications: ['Pre-operative cardiac assessment', 'Heart failure', 'Valvular disease', 'Cardiac murmur'],
    cost: 'high'
  },

  // ==================== CARDIAC ====================
  {
    name: 'Electrocardiogram (12-lead)',
    abbreviation: 'ECG',
    category: 'Cardiac',
    type: 'bedside',
    turnaroundTime: 'Immediate',
    indications: ['Pre-operative (>40 years or cardiac history)', 'Chest pain', 'Arrhythmia', 'Electrolyte abnormality'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Troponin',
    abbreviation: 'Troponin',
    category: 'Cardiac',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '<14 ng/L (hs-TnT)',
    turnaroundTime: '1-2 hours',
    indications: ['Chest pain', 'Acute coronary syndrome', 'Post-operative cardiac event'],
    cost: 'moderate',
    urgent: true
  },
  {
    name: 'BNP / NT-proBNP',
    abbreviation: 'BNP',
    category: 'Cardiac',
    type: 'lab',
    specimen: 'EDTA (purple top)',
    normalRange: 'BNP <100 pg/mL; NT-proBNP <300 pg/mL',
    turnaroundTime: '2-4 hours',
    indications: ['Heart failure assessment', 'Dyspnoea workup', 'Pre-operative cardiac risk'],
    cost: 'moderate'
  },

  // ==================== PULMONARY ====================
  {
    name: 'Pulmonary Function Tests',
    abbreviation: 'PFT',
    category: 'Pulmonary',
    type: 'special',
    turnaroundTime: '1-2 hours',
    indications: ['Pre-operative lung assessment', 'COPD', 'Asthma', 'Chest wall surgery'],
    cost: 'moderate'
  },
  {
    name: 'Peak Expiratory Flow Rate',
    abbreviation: 'PEFR',
    category: 'Pulmonary',
    type: 'bedside',
    turnaroundTime: 'Immediate',
    indications: ['Asthma monitoring', 'Pre-operative lung assessment'],
    cost: 'low'
  },

  // ==================== HISTOPATHOLOGY ====================
  {
    name: 'Histopathology (Biopsy)',
    abbreviation: 'Histopath',
    category: 'Histopathology',
    type: 'lab',
    specimen: 'Tissue in formalin',
    turnaroundTime: '5-10 working days',
    indications: ['Tissue diagnosis', 'Tumour classification', 'Margin assessment'],
    preAnalytical: ['Fix in 10% formalin', 'Orientation marking', 'Clinical details essential'],
    cost: 'high'
  },
  {
    name: 'Frozen Section',
    abbreviation: 'Frozen Section',
    category: 'Histopathology',
    type: 'lab',
    specimen: 'Fresh tissue (unfixed)',
    turnaroundTime: '20-30 minutes (intra-operative)',
    indications: ['Intra-operative margin assessment', 'Rapid tissue diagnosis'],
    preAnalytical: ['Fresh tissue - DO NOT fix in formalin', 'Communicate with lab before sending'],
    cost: 'high',
    urgent: true
  },
  {
    name: 'Fine Needle Aspiration Cytology',
    abbreviation: 'FNAC',
    category: 'Histopathology',
    type: 'lab',
    specimen: 'Aspirate on slides/in cytology fluid',
    turnaroundTime: '24-48 hours',
    indications: ['Superficial mass', 'Lymph node', 'Thyroid nodule', 'Breast lump'],
    cost: 'moderate'
  },
  {
    name: 'Immunohistochemistry',
    abbreviation: 'IHC',
    category: 'Histopathology',
    type: 'lab',
    specimen: 'Paraffin block',
    turnaroundTime: '5-14 days',
    indications: ['Tumour subtyping', 'Receptor status', 'Melanoma markers'],
    cost: 'very-high'
  },

  // ==================== TUMOUR MARKERS ====================
  {
    name: 'Prostate Specific Antigen',
    abbreviation: 'PSA',
    category: 'Tumour Markers',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '<4.0 ng/mL',
    turnaroundTime: '4-24 hours',
    indications: ['Prostate cancer screening', 'Monitoring'],
    cost: 'moderate'
  },
  {
    name: 'Alpha-Fetoprotein',
    abbreviation: 'AFP',
    category: 'Tumour Markers',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '<10 ng/mL',
    turnaroundTime: '24 hours',
    indications: ['Hepatocellular carcinoma', 'Germ cell tumours'],
    cost: 'moderate'
  },
  {
    name: 'Carcinoembryonic Antigen',
    abbreviation: 'CEA',
    category: 'Tumour Markers',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    normalRange: '<5.0 ng/mL',
    turnaroundTime: '24 hours',
    indications: ['Colorectal cancer monitoring', 'GI malignancy'],
    cost: 'moderate'
  },
  {
    name: 'CA 19-9',
    abbreviation: 'CA 19-9',
    category: 'Tumour Markers',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24 hours',
    indications: ['Pancreatic cancer', 'Cholangiocarcinoma'],
    cost: 'moderate'
  },
  {
    name: 'CA 125',
    abbreviation: 'CA 125',
    category: 'Tumour Markers',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24 hours',
    indications: ['Ovarian cancer', 'Peritoneal disease'],
    cost: 'moderate'
  },

  // ==================== BEDSIDE TESTS ====================
  {
    name: 'Capillary Blood Glucose',
    abbreviation: 'CBG',
    category: 'Bedside Tests',
    type: 'bedside',
    normalRange: '4.0-7.0 mmol/L (fasting)',
    turnaroundTime: 'Immediate',
    indications: ['Glucose monitoring', 'DKA', 'Hypoglycaemia', 'Pre/post-operative'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Pulse Oximetry',
    abbreviation: 'SpO2',
    category: 'Bedside Tests',
    type: 'bedside',
    normalRange: '95-100%',
    turnaroundTime: 'Immediate',
    indications: ['Respiratory assessment', 'Post-operative monitoring', 'Flap monitoring'],
    cost: 'low',
    urgent: true
  },
  {
    name: 'Point-of-Care Haemoglobin',
    abbreviation: 'POC Hb',
    category: 'Bedside Tests',
    type: 'bedside',
    turnaroundTime: 'Immediate',
    indications: ['Rapid anaemia assessment', 'Intra-operative', 'Emergency'],
    cost: 'low',
    urgent: true
  },

  // ==================== SPECIAL TESTS ====================
  {
    name: 'Nerve Conduction Studies',
    abbreviation: 'NCS',
    category: 'Special Tests',
    type: 'special',
    turnaroundTime: '1-2 weeks',
    indications: ['Nerve injury assessment', 'Carpal tunnel', 'Peripheral neuropathy', 'Brachial plexus injury'],
    cost: 'high'
  },
  {
    name: 'Electromyography',
    abbreviation: 'EMG',
    category: 'Special Tests',
    type: 'special',
    turnaroundTime: '1-2 weeks',
    indications: ['Muscle function assessment', 'Nerve injury', 'Denervation assessment'],
    cost: 'high'
  },
  {
    name: 'Bone Densitometry (DEXA)',
    abbreviation: 'DEXA',
    category: 'Special Tests',
    type: 'imaging',
    turnaroundTime: '24-48 hours',
    indications: ['Osteoporosis screening', 'Bone harvest planning'],
    cost: 'moderate'
  },
  {
    name: 'Angiography (Conventional)',
    abbreviation: 'Angiography',
    category: 'Imaging - Angiography',
    type: 'imaging',
    turnaroundTime: '2-4 hours',
    indications: ['Vascular mapping', 'Embolisation', 'AV malformation', 'Vascular injury'],
    preAnalytical: ['Check renal function', 'Allergy history', 'Consent required'],
    cost: 'very-high'
  },
  {
    name: 'Lymphoscintigraphy',
    abbreviation: 'Lymphoscint',
    category: 'Imaging - Nuclear',
    type: 'imaging',
    turnaroundTime: '4-6 hours',
    indications: ['Lymphoedema assessment', 'Sentinel node mapping', 'Melanoma staging'],
    cost: 'very-high'
  },
  {
    name: 'PET-CT Scan',
    abbreviation: 'PET-CT',
    category: 'Imaging - Nuclear',
    type: 'imaging',
    turnaroundTime: '24-48 hours',
    indications: ['Cancer staging', 'Recurrence assessment', 'Treatment response'],
    preAnalytical: ['Fasting 4-6 hours', 'Check blood glucose <11 mmol/L', 'No strenuous exercise 24h before'],
    cost: 'very-high'
  },
  {
    name: 'Bone Scan (Tc-99m)',
    abbreviation: 'Bone Scan',
    category: 'Imaging - Nuclear',
    type: 'imaging',
    turnaroundTime: '4-6 hours',
    indications: ['Bone metastases', 'Osteomyelitis', 'Stress fracture', 'Avascular necrosis'],
    cost: 'high'
  },

  // ==================== IMMUNOLOGY ====================
  {
    name: 'Rheumatoid Factor',
    abbreviation: 'RF',
    category: 'Immunology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24 hours',
    indications: ['Rheumatoid arthritis', 'Autoimmune workup', 'Joint disease'],
    cost: 'moderate'
  },
  {
    name: 'Antinuclear Antibody',
    abbreviation: 'ANA',
    category: 'Immunology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24-48 hours',
    indications: ['Autoimmune disease', 'SLE screening', 'Connective tissue disease'],
    cost: 'moderate'
  },
  {
    name: 'Complement Levels (C3, C4)',
    abbreviation: 'C3/C4',
    category: 'Immunology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24-48 hours',
    indications: ['Autoimmune disease', 'Vasculitis', 'SLE monitoring'],
    cost: 'moderate'
  },
  {
    name: 'Immunoglobulins (IgG, IgA, IgM)',
    abbreviation: 'Igs',
    category: 'Immunology',
    type: 'lab',
    specimen: 'Serum (red/yellow top)',
    turnaroundTime: '24-48 hours',
    indications: ['Immunodeficiency', 'Multiple myeloma', 'Chronic infection'],
    cost: 'moderate'
  }
];

// ==================== COMMON PREOP PANELS ====================

export const PREOP_PANELS: Record<string, string[]> = {
  'Standard Pre-op (Minor Surgery)': [
    'Full Blood Count',
    'Electrolytes, Urea & Creatinine',
    'Urinalysis (Dipstick)',
    'Blood Group & Rh Type',
    'HIV/HBsAg/HCV Screening Panel'
  ],
  'Standard Pre-op (Major Surgery)': [
    'Full Blood Count',
    'Electrolytes, Urea & Creatinine',
    'Liver Function Tests',
    'Coagulation Profile',
    'Fasting Blood Glucose',
    'Chest X-Ray',
    'Electrocardiogram (12-lead)',
    'Blood Group & Cross-Match',
    'HIV/HBsAg/HCV Screening Panel',
    'Urinalysis (Dipstick)',
    'Serum Protein & Albumin'
  ],
  'Pre-op (Age >40 or Cardiac Risk)': [
    'Full Blood Count',
    'Electrolytes, Urea & Creatinine',
    'Liver Function Tests',
    'Coagulation Profile',
    'Fasting Blood Glucose',
    'Glycated Haemoglobin',
    'Lipid Profile',
    'Chest X-Ray',
    'Electrocardiogram (12-lead)',
    'Echocardiography',
    'Blood Group & Cross-Match',
    'HIV/HBsAg/HCV Screening Panel',
    'Thyroid Function Tests'
  ],
  'Sepsis Workup': [
    'Full Blood Count',
    'C-Reactive Protein',
    'Procalcitonin',
    'Blood Culture',
    'Serum Lactate',
    'Electrolytes, Urea & Creatinine',
    'Liver Function Tests',
    'Coagulation Profile',
    'Arterial Blood Gas'
  ],
  'Wound Infection Workup': [
    'Full Blood Count',
    'C-Reactive Protein',
    'Wound Swab (M/C/S)',
    'Blood Culture',
    'Fasting Blood Glucose',
    'Glycated Haemoglobin',
    'Serum Protein & Albumin'
  ],
  'Free Flap Pre-op': [
    'Full Blood Count',
    'Electrolytes, Urea & Creatinine',
    'Liver Function Tests',
    'Coagulation Profile',
    'Blood Group & Cross-Match',
    'CT Angiography',
    'Doppler Ultrasound',
    'Chest X-Ray',
    'Electrocardiogram (12-lead)',
    'Serum Protein & Albumin'
  ],
  'Burns Workup': [
    'Full Blood Count',
    'Electrolytes, Urea & Creatinine',
    'Liver Function Tests',
    'Arterial Blood Gas',
    'Serum Lactate',
    'Coagulation Profile',
    'Blood Group & Cross-Match',
    'Serum Protein & Albumin',
    'Calcium, Magnesium & Phosphate',
    'C-Reactive Protein'
  ],
  'LRINEC Score (Necrotising Fasciitis)': [
    'C-Reactive Protein',
    'Full Blood Count',
    'Electrolytes, Urea & Creatinine',
    'Random Blood Glucose',
    'Serum Lactate',
    'Lactate Dehydrogenase'
  ]
};

// ==================== SEARCH & UTILITY FUNCTIONS ====================

/**
 * Search investigations by name, abbreviation, or indication
 */
export function searchInvestigations(query: string): Investigation[] {
  if (!query || query.trim().length === 0) return [];
  const lower = query.toLowerCase().trim();
  return INVESTIGATION_DATABASE.filter(inv =>
    inv.name.toLowerCase().includes(lower) ||
    inv.abbreviation.toLowerCase().includes(lower) ||
    inv.category.toLowerCase().includes(lower) ||
    inv.indications.some(ind => ind.toLowerCase().includes(lower)) ||
    (inv.panels && inv.panels.some(p => p.toLowerCase().includes(lower)))
  ).slice(0, 20);
}

/**
 * Get investigation by exact name
 */
export function getInvestigationByName(name: string): Investigation | undefined {
  return INVESTIGATION_DATABASE.find(inv =>
    inv.name.toLowerCase() === name.toLowerCase() ||
    inv.abbreviation.toLowerCase() === name.toLowerCase()
  );
}

/**
 * Get investigations by category
 */
export function getInvestigationsByCategory(category: InvestigationCategory): Investigation[] {
  return INVESTIGATION_DATABASE.filter(inv => inv.category === category);
}

/**
 * Get investigations by type
 */
export function getInvestigationsByType(type: Investigation['type']): Investigation[] {
  return INVESTIGATION_DATABASE.filter(inv => inv.type === type);
}

/**
 * Get all investigation names for autocomplete
 */
export function getAllInvestigationNames(): string[] {
  return INVESTIGATION_DATABASE.map(inv => inv.name);
}

/**
 * Get all investigation names with abbreviations for display
 */
export function getAllInvestigationDisplayNames(): string[] {
  return INVESTIGATION_DATABASE.map(inv =>
    inv.abbreviation !== inv.name ? `${inv.name} (${inv.abbreviation})` : inv.name
  );
}

/**
 * Auto-detect investigation type from name
 */
export function detectInvestigationType(name: string): 'lab' | 'imaging' | 'special' | 'bedside' {
  const inv = getInvestigationByName(name);
  return inv?.type || 'lab';
}
