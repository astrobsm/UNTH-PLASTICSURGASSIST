import { db } from '../db/database';
import { aiService } from './aiService';

// Lab Investigation Interfaces
export interface LabInvestigation {
  id: string;
  patient_id: string;
  patient_name: string;
  request_date: Date;
  requested_by: string;
  urgency: 'routine' | 'urgent' | 'stat';
  clinical_indication: string;
  tests: LabTest[];
  status: 'pending' | 'collected' | 'processing' | 'completed' | 'cancelled';
  collection_date?: Date;
  collection_notes?: string;
  special_instructions?: string;
  created_at: Date;
  updated_at: Date;
}

export interface LabTest {
  id: string;
  test_code: string;
  test_name: string;
  category: LabCategory;
  sample_type: 'blood' | 'urine' | 'stool' | 'swab' | 'tissue' | 'fluid' | 'other';
  container_type?: string;
  fasting_required: boolean;
  special_preparation?: string;
  normal_range?: string;
  status: 'pending' | 'collected' | 'processing' | 'completed' | 'failed';
  priority: number;
}

export interface LabResult {
  id: string;
  investigation_id: string;
  test_id: string;
  patient_id: string;
  result_value: string;
  unit: string;
  reference_range: string;
  abnormal_flag: 'normal' | 'high' | 'low' | 'critical_high' | 'critical_low' | 'abnormal';
  result_date: Date;
  lab_technician: string;
  verified_by?: string;
  verified_date?: Date;
  comments?: string;
  file_attachments?: LabAttachment[];
  ai_interpretation?: LabAIInterpretation;
  created_at: Date;
  updated_at: Date;
}

export interface LabAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_by: string;
  uploaded_at: Date;
}

export interface LabAIInterpretation {
  id: string;
  interpretation_text: string;
  clinical_significance: string;
  suggested_actions: string[];
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  differential_diagnosis?: string[];
  follow_up_recommendations?: string[];
  generated_at: Date;
  confidence_score: number;
}

export interface LabTrend {
  test_name: string;
  results: {
    date: Date;
    value: number;
    flag: string;
  }[];
  trend_direction: 'improving' | 'stable' | 'worsening' | 'fluctuating';
  trend_analysis: string;
}

export interface GFRCalculation {
  id: string;
  patient_id: string;
  calculation_date: Date;
  creatinine_value: number;
  creatinine_unit: string;
  age: number;
  gender: 'male' | 'female';
  race: 'african_american' | 'other';
  weight?: number;
  height?: number;
  gfr_value: number;
  gfr_formula: 'CKD-EPI' | 'MDRD' | 'Cockcroft-Gault';
  ckd_stage: 1 | 2 | 3 | 4 | 5;
  ckd_stage_description: string;
  risk_assessment: 'normal' | 'mild_decrease' | 'moderate_decrease' | 'severe_decrease' | 'kidney_failure';
  clinical_interpretation: string;
  recommendations: string[];
  created_at: Date;
}

export interface GFRTrend {
  patient_id: string;
  gfr_calculations: GFRCalculation[];
  trend_direction: 'improving' | 'stable' | 'declining' | 'fluctuating';
  trend_analysis: string;
  rate_of_decline?: number; // mL/min/1.73m²/year
  time_to_dialysis_estimate?: number; // months
  risk_progression: 'low' | 'moderate' | 'high' | 'very_high';
  follow_up_recommendations: string[];
}

export interface PatientDemographics {
  age: number;
  gender: 'male' | 'female';
  race: 'african_american' | 'other';
  weight?: number; // kg
  height?: number; // cm
}

export type LabCategory = 
  | 'hematology'
  | 'biochemistry'
  | 'immunology'
  | 'microbiology'
  | 'histopathology'
  | 'cytology'
  | 'endocrinology'
  | 'coagulation'
  | 'cardiac_markers'
  | 'liver_function'
  | 'kidney_function'
  | 'lipid_profile'
  | 'thyroid_function'
  | 'diabetes_markers'
  | 'tumor_markers'
  | 'drug_levels'
  | 'imaging'
  | 'other';

// WHO-Compliant Lab Tests by Category
export const COMMON_LAB_TESTS: Record<LabCategory, LabTest[]> = {
  hematology: [
    { id: 'fbc', test_code: 'FBC', test_name: 'Full Blood Count', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: 'Age/gender specific', status: 'pending', priority: 1 },
    { id: 'hb', test_code: 'HB', test_name: 'Haemoglobin', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: 'M: 13.5-17.5 g/dL, F: 12.0-15.5 g/dL', status: 'pending', priority: 2 },
    { id: 'pcv', test_code: 'PCV', test_name: 'Packed Cell Volume', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: 'M: 40-54%, F: 36-46%', status: 'pending', priority: 3 },
    { id: 'wbc', test_code: 'WBC', test_name: 'White Cell Count with Differential', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: '4.0-11.0 x10⁹/L', status: 'pending', priority: 4 },
    { id: 'plt', test_code: 'PLT', test_name: 'Platelet Count', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: '150-400 x10⁹/L', status: 'pending', priority: 5 },
    { id: 'esr', test_code: 'ESR', test_name: 'ESR', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: 'M: <15mm/hr, F: <20mm/hr', status: 'pending', priority: 6 },
    { id: 'retic', test_code: 'RETIC', test_name: 'Reticulocyte Count', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: '0.5-2.5%', status: 'pending', priority: 7 },
    { id: 'film', test_code: 'FILM', test_name: 'Blood Film/Smear', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, status: 'pending', priority: 8 },
    { id: 'sickle', test_code: 'SICKLE', test_name: 'Sickling Test', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, status: 'pending', priority: 9 },
    { id: 'hbelec', test_code: 'HBELEC', test_name: 'Haemoglobin Electrophoresis', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, status: 'pending', priority: 10 },
    { id: 'g6pd', test_code: 'G6PD', test_name: 'G6PD Screening', category: 'hematology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, status: 'pending', priority: 11 }
  ],
  
  coagulation: [
    { id: 'pt', test_code: 'PT', test_name: 'Prothrombin Time', category: 'coagulation', sample_type: 'blood', container_type: 'Citrate', fasting_required: false, normal_range: '11-13.5 seconds', status: 'pending', priority: 1 },
    { id: 'aptt', test_code: 'APTT', test_name: 'APTT', category: 'coagulation', sample_type: 'blood', container_type: 'Citrate', fasting_required: false, normal_range: '26-35 seconds', status: 'pending', priority: 2 },
    { id: 'inr', test_code: 'INR', test_name: 'INR', category: 'coagulation', sample_type: 'blood', container_type: 'Citrate', fasting_required: false, normal_range: '0.8-1.2', status: 'pending', priority: 3 },
    { id: 'coag_profile', test_code: 'COAG', test_name: 'Coagulation Profile (PT, APTT, INR)', category: 'coagulation', sample_type: 'blood', container_type: 'Citrate', fasting_required: false, status: 'pending', priority: 4 }
  ],

  biochemistry: [
    { id: 'u_e', test_code: 'U&E', test_name: 'Urea & Electrolytes', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 1 },
    { id: 'creat', test_code: 'CREAT', test_name: 'Creatinine', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: 'M: 0.7-1.3 mg/dL, F: 0.6-1.1 mg/dL', status: 'pending', priority: 2 },
    { id: 'na', test_code: 'NA', test_name: 'Sodium', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '135-145 mmol/L', status: 'pending', priority: 3 },
    { id: 'k', test_code: 'K', test_name: 'Potassium', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '3.5-5.0 mmol/L', status: 'pending', priority: 4 },
    { id: 'cl', test_code: 'CL', test_name: 'Chloride', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '98-107 mmol/L', status: 'pending', priority: 5 },
    { id: 'hco3', test_code: 'HCO3', test_name: 'Bicarbonate', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '22-28 mmol/L', status: 'pending', priority: 6 },
    { id: 'fbs', test_code: 'FBS', test_name: 'Fasting Blood Sugar', category: 'biochemistry', sample_type: 'blood', container_type: 'Fluoride', fasting_required: true, special_preparation: '8-12 hours fasting required', normal_range: '70-100 mg/dL', status: 'pending', priority: 7 },
    { id: 'rbs', test_code: 'RBS', test_name: 'Random Blood Sugar', category: 'biochemistry', sample_type: 'blood', container_type: 'Fluoride', fasting_required: false, normal_range: '<140 mg/dL', status: 'pending', priority: 8 },
    { id: 'hba1c', test_code: 'HBA1C', test_name: 'HbA1c', category: 'biochemistry', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, normal_range: '<5.7%', status: 'pending', priority: 9 },
    { id: 'ca', test_code: 'CA', test_name: 'Calcium', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '8.5-10.5 mg/dL', status: 'pending', priority: 10 },
    { id: 'po4', test_code: 'PO4', test_name: 'Phosphate', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '2.5-4.5 mg/dL', status: 'pending', priority: 11 },
    { id: 'mg', test_code: 'MG', test_name: 'Magnesium', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '1.7-2.2 mg/dL', status: 'pending', priority: 12 },
    { id: 'uric', test_code: 'URIC', test_name: 'Uric Acid', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: 'M: 3.4-7.0 mg/dL, F: 2.4-6.0 mg/dL', status: 'pending', priority: 13 },
    { id: 'amy', test_code: 'AMY', test_name: 'Amylase', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '30-110 U/L', status: 'pending', priority: 14 },
    { id: 'lip', test_code: 'LIP', test_name: 'Lipase', category: 'biochemistry', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '0-160 U/L', status: 'pending', priority: 15 }
  ],

  liver_function: [
    { id: 'lft', test_code: 'LFT', test_name: 'Liver Function Tests', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, special_preparation: '12 hours fasting required', status: 'pending', priority: 1 },
    { id: 'tbil', test_code: 'TBIL', test_name: 'Total Bilirubin', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '0.2-1.2 mg/dL', status: 'pending', priority: 2 },
    { id: 'dbil', test_code: 'DBIL', test_name: 'Direct Bilirubin', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '0.0-0.3 mg/dL', status: 'pending', priority: 3 },
    { id: 'alt', test_code: 'ALT', test_name: 'ALT', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '7-56 U/L', status: 'pending', priority: 4 },
    { id: 'ast', test_code: 'AST', test_name: 'AST', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '10-40 U/L', status: 'pending', priority: 5 },
    { id: 'alp', test_code: 'ALP', test_name: 'ALP', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '44-147 U/L', status: 'pending', priority: 6 },
    { id: 'ggt', test_code: 'GGT', test_name: 'GGT', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: 'M: 10-71 U/L, F: 6-42 U/L', status: 'pending', priority: 7 },
    { id: 'tp', test_code: 'TP', test_name: 'Total Protein', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '6.0-8.3 g/dL', status: 'pending', priority: 8 },
    { id: 'alb', test_code: 'ALB', test_name: 'Albumin', category: 'liver_function', sample_type: 'blood', container_type: 'Serum', fasting_required: true, normal_range: '3.5-5.5 g/dL', status: 'pending', priority: 9 }
  ],

  lipid_profile: [
    { id: 'lipid', test_code: 'LIPID', test_name: 'Lipid Profile', category: 'lipid_profile', sample_type: 'blood', container_type: 'Serum', fasting_required: true, special_preparation: '12-14 hours fasting required', status: 'pending', priority: 1 },
    { id: 'chol', test_code: 'CHOL', test_name: 'Total Cholesterol', category: 'lipid_profile', sample_type: 'blood', container_type: 'Serum', fasting_required: true, special_preparation: '12-14 hours fasting', normal_range: '<200 mg/dL', status: 'pending', priority: 2 },
    { id: 'hdl', test_code: 'HDL', test_name: 'HDL', category: 'lipid_profile', sample_type: 'blood', container_type: 'Serum', fasting_required: true, special_preparation: '12-14 hours fasting', normal_range: 'M: >40 mg/dL, F: >50 mg/dL', status: 'pending', priority: 3 },
    { id: 'ldl', test_code: 'LDL', test_name: 'LDL', category: 'lipid_profile', sample_type: 'blood', container_type: 'Serum', fasting_required: true, special_preparation: '12-14 hours fasting', normal_range: '<100 mg/dL', status: 'pending', priority: 4 },
    { id: 'trig', test_code: 'TRIG', test_name: 'Triglycerides', category: 'lipid_profile', sample_type: 'blood', container_type: 'Serum', fasting_required: true, special_preparation: '12-14 hours fasting', normal_range: '<150 mg/dL', status: 'pending', priority: 5 }
  ],

  cardiac_markers: [
    { id: 'trop', test_code: 'TROP', test_name: 'Troponin', category: 'cardiac_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<0.04 ng/mL', status: 'pending', priority: 1 },
    { id: 'ckmb', test_code: 'CKMB', test_name: 'CK-MB', category: 'cardiac_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '0-3 ng/mL', status: 'pending', priority: 2 }
  ],

  microbiology: [
    { id: 'blood_cs', test_code: 'BLOODCS', test_name: 'Blood Culture & Sensitivity', category: 'microbiology', sample_type: 'blood', container_type: 'Blood culture bottle', fasting_required: false, special_preparation: 'Sterile collection technique', status: 'pending', priority: 1 },
    { id: 'urine_cs', test_code: 'URINECS', test_name: 'Urine Culture & Sensitivity', category: 'microbiology', sample_type: 'urine', container_type: 'Sterile container', fasting_required: false, special_preparation: 'Midstream clean catch', status: 'pending', priority: 2 },
    { id: 'stool_cs', test_code: 'STOOLCS', test_name: 'Stool Culture & Sensitivity', category: 'microbiology', sample_type: 'stool', container_type: 'Stool container', fasting_required: false, status: 'pending', priority: 3 },
    { id: 'wound_cs', test_code: 'WOUNDCS', test_name: 'Wound Swab Culture', category: 'microbiology', sample_type: 'swab', container_type: 'Swab stick', fasting_required: false, special_preparation: 'Sterile collection', status: 'pending', priority: 4 },
    { id: 'hvs', test_code: 'HVS', test_name: 'High Vaginal Swab', category: 'microbiology', sample_type: 'swab', container_type: 'Swab stick', fasting_required: false, status: 'pending', priority: 5 },
    { id: 'sputum_cs', test_code: 'SPUTUMCS', test_name: 'Sputum Culture', category: 'microbiology', sample_type: 'other', container_type: 'Sputum container', fasting_required: false, special_preparation: 'Early morning sample', status: 'pending', priority: 6 },
    { id: 'csf_cs', test_code: 'CSFCS', test_name: 'CSF Culture', category: 'microbiology', sample_type: 'fluid', container_type: 'Sterile container', fasting_required: false, special_preparation: 'Lumbar puncture sample', status: 'pending', priority: 7 },
    { id: 'gram', test_code: 'GRAM', test_name: 'Gram Stain', category: 'microbiology', sample_type: 'swab', container_type: 'Swab stick', fasting_required: false, status: 'pending', priority: 8 },
    { id: 'afb', test_code: 'AFB', test_name: 'AFB/ZN Stain', category: 'microbiology', sample_type: 'other', container_type: 'Sputum container', fasting_required: false, special_preparation: 'Early morning sputum', status: 'pending', priority: 9 },
    { id: 'mp', test_code: 'MP', test_name: 'Malaria Parasite', category: 'microbiology', sample_type: 'blood', container_type: 'EDTA', fasting_required: false, status: 'pending', priority: 10 },
    { id: 'widal', test_code: 'WIDAL', test_name: 'Typhoid Test (Widal)', category: 'microbiology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 11 },
    { id: 'hiv', test_code: 'HIV', test_name: 'HIV Screening', category: 'microbiology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 12 },
    { id: 'hbsag', test_code: 'HBSAG', test_name: 'Hepatitis B Surface Antigen', category: 'microbiology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 13 },
    { id: 'hcv', test_code: 'HCV', test_name: 'Hepatitis C Antibody', category: 'microbiology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 14 },
    { id: 'vdrl', test_code: 'VDRL', test_name: 'VDRL/RPR (Syphilis)', category: 'microbiology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 15 },
    { id: 'hpylori', test_code: 'HPYLORI', test_name: 'H. Pylori Test', category: 'microbiology', sample_type: 'stool', container_type: 'Stool container', fasting_required: false, status: 'pending', priority: 16 }
  ],

  immunology: [
    { id: 'ana', test_code: 'ANA', test_name: 'ANA (Antinuclear Antibody)', category: 'immunology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 1 },
    { id: 'rf', test_code: 'RF', test_name: 'Rheumatoid Factor', category: 'immunology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<20 IU/mL', status: 'pending', priority: 2 },
    { id: 'aso', test_code: 'ASO', test_name: 'ASO Titre', category: 'immunology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<200 IU/mL', status: 'pending', priority: 3 },
    { id: 'crp', test_code: 'CRP', test_name: 'CRP (C-Reactive Protein)', category: 'immunology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<10 mg/L', status: 'pending', priority: 4 },
    { id: 'bhcg', test_code: 'BHCG', test_name: 'Pregnancy Test (β-hCG)', category: 'immunology', sample_type: 'blood', container_type: 'Serum', fasting_required: false, status: 'pending', priority: 5 }
  ],

  tumor_markers: [
    { id: 'psa', test_code: 'PSA', test_name: 'PSA (Prostate Specific Antigen)', category: 'tumor_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<4.0 ng/mL', status: 'pending', priority: 1 },
    { id: 'cea', test_code: 'CEA', test_name: 'CEA (Carcinoembryonic Antigen)', category: 'tumor_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<5.0 ng/mL', status: 'pending', priority: 2 },
    { id: 'ca125', test_code: 'CA125', test_name: 'CA 125', category: 'tumor_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<35 U/mL', status: 'pending', priority: 3 },
    { id: 'ca199', test_code: 'CA199', test_name: 'CA 19-9', category: 'tumor_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<37 U/mL', status: 'pending', priority: 4 },
    { id: 'afp', test_code: 'AFP', test_name: 'AFP (Alpha-Fetoprotein)', category: 'tumor_markers', sample_type: 'blood', container_type: 'Serum', fasting_required: false, normal_range: '<10 ng/mL', status: 'pending', priority: 5 }
  ],

  histopathology: [
    { id: 'biopsy', test_code: 'BIOPSY', test_name: 'Tissue Biopsy', category: 'histopathology', sample_type: 'tissue', container_type: 'Formalin container', fasting_required: false, special_preparation: 'Fresh tissue in formalin', status: 'pending', priority: 1 },
    { id: 'fnac', test_code: 'FNAC', test_name: 'FNAC', category: 'histopathology', sample_type: 'tissue', container_type: 'Slide/container', fasting_required: false, status: 'pending', priority: 2 },
    { id: 'frozen', test_code: 'FROZEN', test_name: 'Frozen Section', category: 'histopathology', sample_type: 'tissue', container_type: 'Sterile container', fasting_required: false, special_preparation: 'Fresh tissue, no formalin', status: 'pending', priority: 3 },
    { id: 'ihc', test_code: 'IHC', test_name: 'Immunohistochemistry', category: 'histopathology', sample_type: 'tissue', container_type: 'Formalin container', fasting_required: false, status: 'pending', priority: 4 }
  ],

  cytology: [
    { id: 'pap', test_code: 'PAP', test_name: 'Pap Smear', category: 'cytology', sample_type: 'swab', container_type: 'Slide/preservative', fasting_required: false, status: 'pending', priority: 1 },
    { id: 'urine_cyto', test_code: 'URINECYTO', test_name: 'Urine Cytology', category: 'cytology', sample_type: 'urine', container_type: 'Sterile container', fasting_required: false, special_preparation: 'Fresh early morning urine', status: 'pending', priority: 2 }
  ],

  endocrinology: [],
  thyroid_function: [],
  diabetes_markers: [],
  kidney_function: [],
  drug_levels: [],

  imaging: [
    // Plain Radiographs
    { id: 'cxr', test_code: 'CXR', test_name: 'Chest X-Ray (PA)', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 1 },
    { id: 'cxr_ap', test_code: 'CXR-AP', test_name: 'Chest X-Ray (AP)', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 2 },
    { id: 'axr', test_code: 'AXR', test_name: 'Abdominal X-Ray', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 3 },
    { id: 'xray_hand', test_code: 'XHAND', test_name: 'X-Ray Hand', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 4 },
    { id: 'xray_foot', test_code: 'XFOOT', test_name: 'X-Ray Foot', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 5 },
    { id: 'xray_ankle', test_code: 'XANKLE', test_name: 'X-Ray Ankle', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 6 },
    { id: 'xray_knee', test_code: 'XKNEE', test_name: 'X-Ray Knee', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 7 },
    { id: 'xray_pelvis', test_code: 'XPELVIS', test_name: 'X-Ray Pelvis', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 8 },
    { id: 'xray_spine', test_code: 'XSPINE', test_name: 'X-Ray Spine (AP/Lat)', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 9 },
    { id: 'xray_skull', test_code: 'XSKULL', test_name: 'X-Ray Skull', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 10 },
    
    // Ultrasound
    { id: 'uss_abd', test_code: 'USS-ABD', test_name: 'Ultrasound Abdomen', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: '6-8 hours fasting, full bladder', status: 'pending', priority: 11 },
    { id: 'uss_pelvis', test_code: 'USS-PEL', test_name: 'Ultrasound Pelvis', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Full bladder required', status: 'pending', priority: 12 },
    { id: 'uss_renal', test_code: 'USS-REN', test_name: 'Ultrasound Renal/KUB', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Full bladder required', status: 'pending', priority: 13 },
    { id: 'uss_soft_tissue', test_code: 'USS-ST', test_name: 'Ultrasound Soft Tissue', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 14 },
    { id: 'doppler_arterial', test_code: 'DOP-ART', test_name: 'Doppler Arterial', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 15 },
    { id: 'doppler_venous', test_code: 'DOP-VEN', test_name: 'Doppler Venous', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 16 },
    
    // CT Scans
    { id: 'ct_head', test_code: 'CT-HEAD', test_name: 'CT Brain (Plain)', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 17 },
    { id: 'ct_head_contrast', test_code: 'CT-HEAD-C', test_name: 'CT Brain (With Contrast)', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: 'Check creatinine, allergy history', status: 'pending', priority: 18 },
    { id: 'ct_chest', test_code: 'CT-CHEST', test_name: 'CT Chest', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 19 },
    { id: 'ct_abd', test_code: 'CT-ABD', test_name: 'CT Abdomen/Pelvis', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: '4-6 hours fasting, oral contrast', status: 'pending', priority: 20 },
    { id: 'ct_angio', test_code: 'CTA', test_name: 'CT Angiography', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: 'Check creatinine, allergy history', status: 'pending', priority: 21 },
    
    // MRI
    { id: 'mri_brain', test_code: 'MRI-BRAIN', test_name: 'MRI Brain', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Remove all metal objects, screen for pacemaker', status: 'pending', priority: 22 },
    { id: 'mri_spine', test_code: 'MRI-SPINE', test_name: 'MRI Spine', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Remove all metal objects', status: 'pending', priority: 23 },
    { id: 'mri_joint', test_code: 'MRI-JOINT', test_name: 'MRI Joint (Specify)', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Remove all metal objects', status: 'pending', priority: 24 },
    { id: 'mri_soft_tissue', test_code: 'MRI-ST', test_name: 'MRI Soft Tissue', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Remove all metal objects', status: 'pending', priority: 25 },
    { id: 'mra', test_code: 'MRA', test_name: 'MR Angiography', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Check for contraindications', status: 'pending', priority: 26 },
    
    // Fluoroscopy & Special Procedures
    { id: 'ba_swallow', test_code: 'BA-SWAL', test_name: 'Barium Swallow', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: 'NPO 8 hours', status: 'pending', priority: 27 },
    { id: 'ba_meal', test_code: 'BA-MEAL', test_name: 'Barium Meal', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: 'NPO overnight', status: 'pending', priority: 28 },
    { id: 'ba_enema', test_code: 'BA-ENEM', test_name: 'Barium Enema', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: 'Bowel preparation required', status: 'pending', priority: 29 },
    { id: 'ivp', test_code: 'IVP', test_name: 'Intravenous Pyelogram', category: 'imaging', sample_type: 'other', fasting_required: true, special_preparation: 'NPO 6 hours, check creatinine', status: 'pending', priority: 30 },
    
    // Nuclear Medicine
    { id: 'bone_scan', test_code: 'BONE-SCAN', test_name: 'Bone Scan', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Radiotracer injection', status: 'pending', priority: 31 },
    { id: 'thyroid_scan', test_code: 'THYROID-SCAN', test_name: 'Thyroid Scan', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'Discontinue iodine supplements', status: 'pending', priority: 32 },
    
    // Special Imaging
    { id: 'echo', test_code: 'ECHO', test_name: 'Echocardiogram', category: 'imaging', sample_type: 'other', fasting_required: false, status: 'pending', priority: 33 },
    { id: 'mammogram', test_code: 'MAMMO', test_name: 'Mammogram', category: 'imaging', sample_type: 'other', fasting_required: false, special_preparation: 'No deodorant on day of exam', status: 'pending', priority: 34 }
  ],

  other: []
};

class LabService {
  // Lab Investigation Management
  async createLabInvestigation(investigation: Omit<LabInvestigation, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = `lab_inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newInvestigation: LabInvestigation = {
      ...investigation,
      id,
      created_at: now,
      updated_at: now
    };

    await db.lab_investigations.add(newInvestigation);
    return id;
  }

  async getLabInvestigations(patientId?: string): Promise<LabInvestigation[]> {
    if (patientId) {
      return await db.lab_investigations
        .where('patient_id')
        .equals(patientId)
        .reverse()
        .sortBy('request_date');
    }
    
    return await db.lab_investigations
      .orderBy('request_date')
      .reverse()
      .toArray();
  }

  async updateInvestigationStatus(id: string, status: LabInvestigation['status']): Promise<void> {
    await db.lab_investigations.update(id, { status, updated_at: new Date() });
  }

  // Lab Results Management
  async addLabResult(result: Omit<LabResult, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = `lab_result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newResult: LabResult = {
      ...result,
      id,
      created_at: now,
      updated_at: now
    };

    await db.lab_results.add(newResult);
    
    // Generate AI interpretation if not provided
    if (!result.ai_interpretation) {
      await this.generateAIInterpretation(id);
    }
    
    return id;
  }

  async getLabResults(patientId?: string, testName?: string): Promise<LabResult[]> {
    let query = db.lab_results.orderBy('result_date').reverse();
    
    if (patientId) {
      query = db.lab_results.where('patient_id').equals(patientId).reverse();
    }
    
    const results = await query.toArray();
    
    if (testName) {
      return results.filter(result => 
        result.test_id.toLowerCase().includes(testName.toLowerCase())
      );
    }
    
    return results;
  }

  async generateAIInterpretation(resultId: string): Promise<void> {
    try {
      const result = await db.lab_results.get(resultId);
      if (!result) return;

      const investigation = await db.lab_investigations.get(result.investigation_id);
      if (!investigation) return;

      const prompt = `
        Analyze this lab result and provide clinical interpretation:
        
        Patient: ${investigation.patient_name}
        Test: ${result.test_id}
        Result: ${result.result_value} ${result.unit}
        Reference Range: ${result.reference_range}
        Flag: ${result.abnormal_flag}
        Clinical Indication: ${investigation.clinical_indication}
        
        Please provide:
        1. Clinical interpretation
        2. Clinical significance
        3. Suggested actions
        4. Risk level assessment
        5. Differential diagnosis considerations
        6. Follow-up recommendations
        
        Format as JSON with fields: interpretation_text, clinical_significance, suggested_actions, risk_level, differential_diagnosis, follow_up_recommendations
      `;

      const aiResponse = await aiService.generateContent(prompt);
      
      let interpretation: LabAIInterpretation;
      try {
        const parsed = JSON.parse(aiResponse);
        interpretation = {
          id: `ai_interp_${Date.now()}`,
          interpretation_text: parsed.interpretation_text || 'AI interpretation generated',
          clinical_significance: parsed.clinical_significance || 'Clinical significance assessed',
          suggested_actions: parsed.suggested_actions || [],
          risk_level: parsed.risk_level || 'moderate',
          differential_diagnosis: parsed.differential_diagnosis || [],
          follow_up_recommendations: parsed.follow_up_recommendations || [],
          generated_at: new Date(),
          confidence_score: 0.85
        };
      } catch {
        // Fallback if JSON parsing fails
        interpretation = {
          id: `ai_interp_${Date.now()}`,
          interpretation_text: aiResponse,
          clinical_significance: 'AI analysis completed',
          suggested_actions: ['Review with clinician', 'Consider clinical correlation'],
          risk_level: 'moderate',
          differential_diagnosis: [],
          follow_up_recommendations: ['Clinical correlation recommended'],
          generated_at: new Date(),
          confidence_score: 0.75
        };
      }

      await db.lab_results.update(resultId, {
        ai_interpretation: interpretation,
        updated_at: new Date()
      });

    } catch (error) {
      console.error('Error generating AI interpretation:', error);
    }
  }

  // File Upload Management
  async uploadLabFile(file: File, resultId: string, uploadedBy: string): Promise<string> {
    const attachmentId = `lab_file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // In a real app, you would upload to a file storage service
    // For now, we'll simulate with a local URL
    const fileUrl = URL.createObjectURL(file);
    
    const attachment: LabAttachment = {
      id: attachmentId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_url: fileUrl,
      uploaded_by: uploadedBy,
      uploaded_at: new Date()
    };

    const result = await db.lab_results.get(resultId);
    if (result) {
      const updatedAttachments = [...(result.file_attachments || []), attachment];
      await db.lab_results.update(resultId, {
        file_attachments: updatedAttachments,
        updated_at: new Date()
      });
    }

    return attachmentId;
  }

  // Lab Trends and Serial Tracking
  async getLabTrends(patientId: string, testName: string, months: number = 6): Promise<LabTrend> {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    
    const results = await db.lab_results
      .where('patient_id')
      .equals(patientId)
      .filter(result => 
        result.test_id.toLowerCase().includes(testName.toLowerCase()) &&
        result.result_date >= fromDate
      )
      .sortBy('result_date');

    const trendData = results
      .map(result => ({
        date: result.result_date,
        value: parseFloat(result.result_value) || 0,
        flag: result.abnormal_flag
      }))
      .filter(data => !isNaN(data.value));

    let trendDirection: 'improving' | 'stable' | 'worsening' | 'fluctuating' = 'stable';
    let trendAnalysis = 'Insufficient data for trend analysis';

    if (trendData.length >= 3) {
      const recent = trendData.slice(-3);
      const values = recent.map(d => d.value);
      const isIncreasing = values[2] > values[1] && values[1] > values[0];
      const isDecreasing = values[2] < values[1] && values[1] < values[0];
      
      if (isIncreasing) {
        trendDirection = 'worsening'; // Assuming higher values are worse - adjust per test
      } else if (isDecreasing) {
        trendDirection = 'improving';
      } else {
        const variance = this.calculateVariance(values);
        trendDirection = variance > 0.1 ? 'fluctuating' : 'stable';
      }
      
      trendAnalysis = `Trend over ${months} months shows ${trendDirection} pattern with ${trendData.length} data points`;
    }

    return {
      test_name: testName,
      results: trendData,
      trend_direction: trendDirection,
      trend_analysis: trendAnalysis
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance / Math.pow(mean, 2); // Coefficient of variation
  }

  // Lab Statistics and Reports
  async getLabStatistics(patientId?: string, dateRange?: { start: Date; end: Date }): Promise<{
    totalInvestigations: number;
    completedResults: number;
    pendingResults: number;
    abnormalResults: number;
    criticalResults: number;
    averageCompletionTime: number;
  }> {
    let investigations = await db.lab_investigations.toArray();
    let results = await db.lab_results.toArray();

    if (patientId) {
      investigations = investigations.filter(inv => inv.patient_id === patientId);
      results = results.filter(res => res.patient_id === patientId);
    }

    if (dateRange) {
      investigations = investigations.filter(inv => 
        inv.request_date >= dateRange.start && inv.request_date <= dateRange.end
      );
      results = results.filter(res => 
        res.result_date >= dateRange.start && res.result_date <= dateRange.end
      );
    }

    const completedResults = results.length;
    const abnormalResults = results.filter(res => 
      res.abnormal_flag !== 'normal'
    ).length;
    const criticalResults = results.filter(res => 
      res.abnormal_flag === 'critical_high' || res.abnormal_flag === 'critical_low'
    ).length;

    // Calculate average completion time
    const completedInvestigations = investigations.filter(inv => inv.status === 'completed');
    const avgCompletionTime = completedInvestigations.length > 0
      ? completedInvestigations.reduce((sum, inv) => {
          if (inv.collection_date) {
            return sum + (inv.collection_date.getTime() - inv.request_date.getTime());
          }
          return sum;
        }, 0) / completedInvestigations.length / (1000 * 60 * 60 * 24) // Convert to days
      : 0;

    return {
      totalInvestigations: investigations.length,
      completedResults,
      pendingResults: investigations.filter(inv => inv.status !== 'completed').length,
      abnormalResults,
      criticalResults,
      averageCompletionTime: avgCompletionTime
    };
  }

  // Search and Filter
  async searchLabResults(query: string, patientId?: string): Promise<LabResult[]> {
    let results = await this.getLabResults(patientId);
    
    const searchTerm = query.toLowerCase();
    return results.filter(result => 
      result.test_id.toLowerCase().includes(searchTerm) ||
      result.result_value.toLowerCase().includes(searchTerm) ||
      result.comments?.toLowerCase().includes(searchTerm) ||
      result.ai_interpretation?.interpretation_text.toLowerCase().includes(searchTerm)
    );
  }

  // Get common lab tests by category
  getCommonTests(category: LabCategory): LabTest[] {
    return COMMON_LAB_TESTS[category] || [];
  }

  // Get all available lab categories
  getLabCategories(): { value: LabCategory; label: string }[] {
    return [
      { value: 'hematology', label: 'Hematology' },
      { value: 'biochemistry', label: 'Biochemistry' },
      { value: 'immunology', label: 'Immunology' },
      { value: 'microbiology', label: 'Microbiology' },
      { value: 'histopathology', label: 'Histopathology' },
      { value: 'cytology', label: 'Cytology' },
      { value: 'endocrinology', label: 'Endocrinology' },
      { value: 'coagulation', label: 'Coagulation' },
      { value: 'cardiac_markers', label: 'Cardiac Markers' },
      { value: 'liver_function', label: 'Liver Function' },
      { value: 'kidney_function', label: 'Kidney Function' },
      { value: 'lipid_profile', label: 'Lipid Profile' },
      { value: 'thyroid_function', label: 'Thyroid Function' },
      { value: 'diabetes_markers', label: 'Diabetes Markers' },
      { value: 'tumor_markers', label: 'Tumor Markers' },
      { value: 'drug_levels', label: 'Drug Levels' },
      { value: 'imaging', label: '📷 Imaging & Radiology' },
      { value: 'other', label: 'Other' }
    ];
  }

  // GFR Calculation and Management
  async calculateGFR(
    patientId: string, 
    creatinine: number, 
    creatinineUnit: string, 
    demographics: PatientDemographics,
    formula: 'CKD-EPI' | 'MDRD' | 'Cockcroft-Gault' = 'CKD-EPI'
  ): Promise<GFRCalculation> {
    // Convert creatinine to mg/dL if needed
    let creatinineMgDl = creatinine;
    if (creatinineUnit === 'µmol/L' || creatinineUnit === 'umol/L') {
      creatinineMgDl = creatinine / 88.4; // Convert µmol/L to mg/dL
    }

    let gfrValue: number;
    
    switch (formula) {
      case 'CKD-EPI':
        gfrValue = this.calculateCKDEPI(creatinineMgDl, demographics.age, demographics.gender, demographics.race);
        break;
      case 'MDRD':
        gfrValue = this.calculateMDRD(creatinineMgDl, demographics.age, demographics.gender, demographics.race);
        break;
      case 'Cockcroft-Gault':
        if (!demographics.weight) {
          throw new Error('Weight is required for Cockcroft-Gault formula');
        }
        gfrValue = this.calculateCockcroftGault(creatinineMgDl, demographics.age, demographics.gender, demographics.weight);
        break;
      default:
        throw new Error('Invalid GFR formula');
    }

    const ckdStage = this.determineCKDStage(gfrValue);
    const gfrCalculation: GFRCalculation = {
      id: `gfr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      patient_id: patientId,
      calculation_date: new Date(),
      creatinine_value: creatinine,
      creatinine_unit: creatinineUnit,
      age: demographics.age,
      gender: demographics.gender,
      race: demographics.race,
      weight: demographics.weight,
      height: demographics.height,
      gfr_value: Math.round(gfrValue * 10) / 10, // Round to 1 decimal place
      gfr_formula: formula,
      ckd_stage: ckdStage.stage,
      ckd_stage_description: ckdStage.description,
      risk_assessment: ckdStage.risk,
      clinical_interpretation: this.generateGFRInterpretation(gfrValue, ckdStage),
      recommendations: this.generateGFRRecommendations(gfrValue, ckdStage),
      created_at: new Date()
    };

    // Store the GFR calculation
    await db.gfr_calculations.add(gfrCalculation);
    
    return gfrCalculation;
  }

  private calculateCKDEPI(creatinine: number, age: number, gender: 'male' | 'female', race: 'african_american' | 'other'): number {
    const isFemale = gender === 'female';
    const isAfricanAmerican = race === 'african_american';
    
    const kappa = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.329 : -0.411;
    const genderFactor = isFemale ? 1.018 : 1;
    const raceFactor = isAfricanAmerican ? 1.159 : 1;
    
    const minCreatKappa = Math.min(creatinine / kappa, 1);
    const maxCreatKappa = Math.max(creatinine / kappa, 1);
    
    return 141 * Math.pow(minCreatKappa, alpha) * Math.pow(maxCreatKappa, -1.209) * 
           Math.pow(0.993, age) * genderFactor * raceFactor;
  }

  private calculateMDRD(creatinine: number, age: number, gender: 'male' | 'female', race: 'african_american' | 'other'): number {
    const isFemale = gender === 'female';
    const isAfricanAmerican = race === 'african_american';
    
    let gfr = 175 * Math.pow(creatinine, -1.154) * Math.pow(age, -0.203);
    
    if (isFemale) {
      gfr *= 0.742;
    }
    
    if (isAfricanAmerican) {
      gfr *= 1.212;
    }
    
    return gfr;
  }

  private calculateCockcroftGault(creatinine: number, age: number, gender: 'male' | 'female', weight: number): number {
    const isFemale = gender === 'female';
    const genderFactor = isFemale ? 0.85 : 1;
    
    return ((140 - age) * weight * genderFactor) / (72 * creatinine);
  }

  private determineCKDStage(gfr: number): { 
    stage: 1 | 2 | 3 | 4 | 5; 
    description: string; 
    risk: 'normal' | 'mild_decrease' | 'moderate_decrease' | 'severe_decrease' | 'kidney_failure' 
  } {
    if (gfr >= 90) {
      return { stage: 1, description: 'Normal or high', risk: 'normal' };
    } else if (gfr >= 60) {
      return { stage: 2, description: 'Mildly decreased', risk: 'mild_decrease' };
    } else if (gfr >= 30) {
      return { stage: 3, description: 'Moderately decreased', risk: 'moderate_decrease' };
    } else if (gfr >= 15) {
      return { stage: 4, description: 'Severely decreased', risk: 'severe_decrease' };
    } else {
      return { stage: 5, description: 'Kidney failure', risk: 'kidney_failure' };
    }
  }

  private generateGFRInterpretation(gfr: number, stage: any): string {
    const interpretations = {
      1: `GFR of ${gfr} mL/min/1.73m² indicates normal kidney function. Continue routine monitoring.`,
      2: `GFR of ${gfr} mL/min/1.73m² shows mildly decreased kidney function. Monitor for progression and cardiovascular risk factors.`,
      3: `GFR of ${gfr} mL/min/1.73m² indicates moderately decreased kidney function (CKD Stage 3). Evaluate and treat complications, slow progression.`,
      4: `GFR of ${gfr} mL/min/1.73m² shows severely decreased kidney function (CKD Stage 4). Prepare for renal replacement therapy.`,
      5: `GFR of ${gfr} mL/min/1.73m² indicates kidney failure (CKD Stage 5). Renal replacement therapy needed.`
    };
    
    return interpretations[stage.stage as keyof typeof interpretations];
  }

  private generateGFRRecommendations(gfr: number, stage: { stage: number; description: string; risk: string }): string[] {
    const recommendations = {
      1: [
        'Annual eGFR monitoring',
        'Blood pressure control (<130/80 mmHg)',
        'Lifestyle modifications (diet, exercise)',
        'Diabetes management if applicable'
      ],
      2: [
        'Annual eGFR monitoring',
        'Blood pressure control (<130/80 mmHg)',
        'ACE inhibitor or ARB if indicated',
        'Cardiovascular risk assessment',
        'Lifestyle modifications'
      ],
      3: [
        'Monitor eGFR every 6 months',
        'Nephrology referral',
        'Bone and mineral metabolism evaluation',
        'Anemia screening',
        'Blood pressure control (<130/80 mmHg)',
        'Protein restriction consideration',
        'Medication dose adjustments'
      ],
      4: [
        'Monitor eGFR every 3-6 months',
        'Nephrology management',
        'Renal replacement therapy education',
        'Vascular access planning',
        'Anemia management',
        'Bone disease management',
        'Dietary counseling',
        'Medication dose adjustments'
      ],
      5: [
        'Urgent nephrology consultation',
        'Renal replacement therapy initiation',
        'Dialysis or transplant evaluation',
        'Anemia management',
        'Bone disease management',
        'Cardiovascular protection',
        'Dietary restrictions'
      ]
    };
    
    return recommendations[stage.stage as keyof typeof recommendations] || [];
  }

  async getGFRHistory(patientId: string): Promise<GFRCalculation[]> {
    return await db.gfr_calculations
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('calculation_date');
  }

  async generateGFRTrend(patientId: string, months: number = 12): Promise<GFRTrend> {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);
    
    const gfrHistory = await db.gfr_calculations
      .where('patient_id')
      .equals(patientId)
      .filter((calc: GFRCalculation) => calc.calculation_date >= fromDate)
      .sortBy('calculation_date');

    if (gfrHistory.length < 2) {
      return {
        patient_id: patientId,
        gfr_calculations: gfrHistory,
        trend_direction: 'stable',
        trend_analysis: 'Insufficient data for trend analysis. At least 2 GFR measurements are needed.',
        risk_progression: 'low',
        follow_up_recommendations: ['Obtain follow-up creatinine in 6-12 months']
      };
    }

    // Calculate trend
    const gfrValues = gfrHistory.map((calc: GFRCalculation) => calc.gfr_value);
    const timePoints = gfrHistory.map((calc: GFRCalculation) => calc.calculation_date.getTime());
    
    // Linear regression to calculate rate of decline
    const n = gfrValues.length;
    const sumX = timePoints.reduce((a: number, b: number) => a + b, 0);
    const sumY = gfrValues.reduce((a: number, b: number) => a + b, 0);
    const sumXY = timePoints.reduce((sum: number, x: number, i: number) => sum + x * gfrValues[i], 0);
    const sumXX = timePoints.reduce((sum: number, x: number) => sum + x * x, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    // Convert slope to mL/min/1.73m²/year
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const rateOfDecline = slope * millisecondsPerYear;
    
    let trendDirection: 'improving' | 'stable' | 'declining' | 'fluctuating';
    let riskProgression: 'low' | 'moderate' | 'high' | 'very_high';
    
    if (rateOfDecline > 1) {
      trendDirection = 'improving';
      riskProgression = 'low';
    } else if (rateOfDecline > -1) {
      trendDirection = 'stable';
      riskProgression = 'low';
    } else if (rateOfDecline > -5) {
      trendDirection = 'declining';
      riskProgression = 'moderate';
    } else if (rateOfDecline > -10) {
      trendDirection = 'declining';
      riskProgression = 'high';
    } else {
      trendDirection = 'declining';
      riskProgression = 'very_high';
    }
    
    // Check for fluctuation
    const variance = this.calculateVariance(gfrValues);
    if (variance > 0.25) { // High coefficient of variation indicates fluctuation
      trendDirection = 'fluctuating';
    }
    
    // Estimate time to dialysis (GFR < 15)
    let timeToDialysis: number | undefined;
    if (rateOfDecline < -1 && gfrHistory[gfrHistory.length - 1].gfr_value > 15) {
      const currentGFR = gfrHistory[gfrHistory.length - 1].gfr_value;
      timeToDialysis = Math.round((currentGFR - 15) / Math.abs(rateOfDecline) * 12); // months
    }
    
    const trendAnalysis = this.generateTrendAnalysis(
      gfrHistory, 
      trendDirection, 
      rateOfDecline, 
      timeToDialysis
    );
    
    const followUpRecommendations = this.generateTrendRecommendations(
      trendDirection, 
      riskProgression, 
      gfrHistory[gfrHistory.length - 1].ckd_stage
    );

    return {
      patient_id: patientId,
      gfr_calculations: gfrHistory,
      trend_direction: trendDirection,
      trend_analysis: trendAnalysis,
      rate_of_decline: Math.round(rateOfDecline * 10) / 10,
      time_to_dialysis_estimate: timeToDialysis,
      risk_progression: riskProgression,
      follow_up_recommendations: followUpRecommendations
    };
  }

  private generateTrendAnalysis(
    history: GFRCalculation[], 
    direction: string, 
    rate: number, 
    timeToDialysis?: number
  ): string {
    const latestGFR = history[history.length - 1].gfr_value;
    const oldestGFR = history[0].gfr_value;
    const timeSpan = Math.round((history[history.length - 1].calculation_date.getTime() - 
                               history[0].calculation_date.getTime()) / (30.44 * 24 * 60 * 60 * 1000)); // months
    
    let analysis = `GFR trend over ${timeSpan} months shows ${direction} pattern. `;
    analysis += `Current GFR: ${latestGFR} mL/min/1.73m² (from ${oldestGFR} mL/min/1.73m²). `;
    
    if (direction === 'declining') {
      analysis += `Rate of decline: ${Math.abs(rate).toFixed(1)} mL/min/1.73m²/year. `;
      if (timeToDialysis && timeToDialysis > 0) {
        analysis += `Estimated time to dialysis requirement: ${timeToDialysis} months. `;
      }
    } else if (direction === 'improving') {
      analysis += `Rate of improvement: ${rate.toFixed(1)} mL/min/1.73m²/year. `;
    }
    
    return analysis + `Based on ${history.length} measurements.`;
  }

  private generateTrendRecommendations(
    direction: string, 
    risk: string, 
    ckdStage: number
  ): string[] {
    const baseRecommendations = [
      'Continue current management',
      'Monitor blood pressure closely',
      'Optimize diabetes control if applicable'
    ];
    
    if (direction === 'declining') {
      if (risk === 'high' || risk === 'very_high') {
        return [
          'Urgent nephrology referral',
          'Evaluate for reversible causes of kidney function decline',
          'Consider more frequent monitoring (every 3-6 months)',
          'Review and adjust medications affecting kidney function',
          'Initiate renal replacement therapy planning if Stage 4-5',
          'Cardiovascular risk assessment and management'
        ];
      } else {
        return [
          'Nephrology consultation recommended',
          'Increase monitoring frequency to every 6 months',
          'Review medications and doses',
          'Lifestyle modifications counseling',
          'Blood pressure optimization'
        ];
      }
    } else if (direction === 'improving') {
      return [
        'Continue current successful management',
        'Maintain current monitoring schedule',
        'Reinforce lifestyle modifications',
        'Monitor for sustainability of improvement'
      ];
    } else if (direction === 'fluctuating') {
      return [
        'Investigate causes of GFR fluctuation',
        'Review medication adherence',
        'Assess for acute kidney injury episodes',
        'Consider more frequent monitoring',
        'Evaluate fluid balance and dehydration'
      ];
    }
    
    return baseRecommendations;
  }

  async autoGenerateGFRFromResults(patientId: string, demographics: PatientDemographics): Promise<GFRCalculation[]> {
    // Get all creatinine results for the patient
    const results = await this.getLabResults(patientId);
    const creatinineResults = results.filter(result => 
      result.test_id.toLowerCase().includes('creatinine') ||
      result.test_id.toLowerCase().includes('crea') ||
      result.test_id === 'Cr'
    );

    const gfrCalculations: GFRCalculation[] = [];

    for (const result of creatinineResults) {
      try {
        // Parse creatinine value
        const creatinineValue = parseFloat(result.result_value);
        if (isNaN(creatinineValue)) continue;

        // Check if GFR already calculated for this result
        const existingGFR = await db.gfr_calculations
          .where('patient_id')
          .equals(patientId)
          .filter((calc: GFRCalculation) => 
            Math.abs(calc.calculation_date.getTime() - result.result_date.getTime()) < 24 * 60 * 60 * 1000 && // Within 24 hours
            calc.creatinine_value === creatinineValue
          )
          .first();

        if (existingGFR) continue; // Skip if already calculated

        const gfrCalc = await this.calculateGFR(
          patientId,
          creatinineValue,
          result.unit,
          demographics
        );

        gfrCalculations.push(gfrCalc);
      } catch (error) {
        console.error('Error calculating GFR for result:', result.id, error);
      }
    }

    return gfrCalculations;
  }

  // PDF Export for Lab Trends
  async generateTrendsPDF(
    patientId: string,
    patientName: string,
    testName: string,
    startDate: Date,
    endDate: Date
  ): Promise<Blob> {
    // Get trend data
    const monthsDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    const trend = await this.getLabTrends(patientId, testName, monthsDiff);
    
    // Build HTML content for PDF
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };

    const trendDirectionStyle = 
      trend.trend_direction === 'improving' ? 'color: #10B981;' :
      trend.trend_direction === 'worsening' ? 'color: #EF4444;' :
      trend.trend_direction === 'fluctuating' ? 'color: #F59E0B;' : 'color: #3B82F6;';

    const resultRows = trend.results.map(result => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatDate(result.date)}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">${result.value}</td>
        <td style="padding: 8px; border: 1px solid #e5e7eb;">
          <span style="${result.flag === 'normal' ? 'background: #D1FAE5; color: #065F46;' : 'background: #FEE2E2; color: #991B1B;'} padding: 2px 8px; border-radius: 4px;">
            ${result.flag.toUpperCase()}
          </span>
        </td>
      </tr>
    `).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Lab Trend Report - ${testName}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1F2937; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10B981; padding-bottom: 20px; }
          .header h1 { color: #10B981; margin: 0 0 10px 0; }
          .patient-info { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .patient-info p { margin: 5px 0; }
          .summary { background: #ECFDF5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10B981; }
          .summary h3 { margin-top: 0; color: #065F46; }
          .trend-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #10B981; color: white; padding: 10px; text-align: left; }
          tr:nth-child(even) { background: #F9FAFB; }
          .analysis { margin-top: 20px; padding: 15px; background: #FEF3C7; border-radius: 8px; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Laboratory Trend Report</h1>
          <p>Plastic Surgery Assistant PWA</p>
        </div>
        
        <div class="patient-info">
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Test:</strong> ${testName}</p>
          <p><strong>Period:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
          <p><strong>Generated:</strong> ${formatDate(new Date())}</p>
        </div>

        <div class="summary">
          <h3>Trend Summary</h3>
          <p><strong>Trend Direction:</strong> <span class="trend-badge" style="${trendDirectionStyle}">${trend.trend_direction.toUpperCase()}</span></p>
          <p><strong>Total Results:</strong> ${trend.results.length}</p>
        </div>

        <h3>📈 Result History</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${resultRows}
          </tbody>
        </table>

        <div class="analysis">
          <h4>📋 Clinical Analysis</h4>
          <p>${trend.trend_analysis || 'No detailed analysis available.'}</p>
        </div>

        <div class="footer">
          <p>This report is generated for clinical decision support purposes only.</p>
          <p>Please verify results with original laboratory reports.</p>
          <p>© ${new Date().getFullYear()} Plastic Surgery Assistant</p>
        </div>
      </body>
      </html>
    `;

    // Convert HTML to Blob for download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    return blob;
  }

  // Generate multiple test trends PDF
  async generateMultiTestTrendsPDF(
    patientId: string,
    patientName: string,
    testNames: string[],
    startDate: Date,
    endDate: Date
  ): Promise<Blob> {
    const monthsDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
    
    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    };

    // Collect all trends
    const allTrends = await Promise.all(
      testNames.map(async (testName) => {
        try {
          const trend = await this.getLabTrends(patientId, testName, monthsDiff);
          return { testName, trend };
        } catch {
          return { testName, trend: null };
        }
      })
    );

    const testSections = allTrends
      .filter(t => t.trend && t.trend.results.length > 0)
      .map(({ testName, trend }) => {
        if (!trend) return '';
        
        const trendDirectionStyle = 
          trend.trend_direction === 'improving' ? 'background: #D1FAE5; color: #065F46;' :
          trend.trend_direction === 'worsening' ? 'background: #FEE2E2; color: #991B1B;' :
          trend.trend_direction === 'fluctuating' ? 'background: #FEF3C7; color: #92400E;' : 'background: #DBEAFE; color: #1E40AF;';

        const resultRows = trend.results.map(result => `
          <tr>
            <td style="padding: 6px; border: 1px solid #e5e7eb;">${formatDate(result.date)}</td>
            <td style="padding: 6px; border: 1px solid #e5e7eb; font-weight: bold;">${result.value}</td>
            <td style="padding: 6px; border: 1px solid #e5e7eb;">
              <span style="${result.flag === 'normal' ? 'color: #10B981;' : 'color: #EF4444;'}">●</span>
              ${result.flag}
            </td>
          </tr>
        `).join('');

        return `
          <div class="test-section">
            <h3>${testName} <span class="trend-badge" style="${trendDirectionStyle}">${trend.trend_direction}</span></h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${resultRows}
              </tbody>
            </table>
            <p class="analysis-text"><em>${trend.trend_analysis}</em></p>
          </div>
        `;
      }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Comprehensive Lab Trend Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #1F2937; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #10B981; padding-bottom: 20px; }
          .header h1 { color: #10B981; margin: 0 0 10px 0; }
          .patient-info { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .patient-info p { margin: 5px 0; }
          .test-section { margin-bottom: 25px; padding: 15px; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; }
          .test-section h3 { margin-top: 0; color: #1F2937; display: flex; align-items: center; gap: 10px; }
          .trend-badge { font-size: 12px; padding: 2px 8px; border-radius: 4px; font-weight: normal; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
          th { background: #F3F4F6; color: #374151; padding: 8px; text-align: left; }
          tr:nth-child(even) { background: #F9FAFB; }
          .analysis-text { font-size: 12px; color: #6B7280; margin-top: 8px; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #6B7280; border-top: 1px solid #E5E7EB; padding-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 Comprehensive Lab Trend Report</h1>
          <p>Plastic Surgery Assistant PWA</p>
        </div>
        
        <div class="patient-info">
          <p><strong>Patient:</strong> ${patientName}</p>
          <p><strong>Tests Analyzed:</strong> ${testNames.join(', ')}</p>
          <p><strong>Period:</strong> ${formatDate(startDate)} - ${formatDate(endDate)}</p>
          <p><strong>Generated:</strong> ${formatDate(new Date())}</p>
        </div>

        ${testSections || '<p>No trend data available for the selected tests and period.</p>'}

        <div class="footer">
          <p>This report is generated for clinical decision support purposes only.</p>
          <p>Please verify results with original laboratory reports.</p>
          <p>© ${new Date().getFullYear()} Plastic Surgery Assistant</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    return blob;
  }
}
export const labService = new LabService();