// Comprehensive Laboratory Reference Values Database
// For clinical decision support in Plastic Surgery Assistant

export interface ReferenceRange {
  test_name: string;
  parameter: string;
  unit: string;
  normal_min: number | null;
  normal_max: number | null;
  critical_low: number | null;
  critical_high: number | null;
  gender?: 'male' | 'female' | 'both';
  age_group?: string;
  notes?: string;
}

export interface LabInterpretation {
  status: 'normal' | 'borderline' | 'abnormal' | 'critical';
  flag: 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';
  message: string;
  clinical_significance: string;
  suggested_actions: string[];
}

// Full Blood Count (FBC/CBC)
export const FBC_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'FBC',
    parameter: 'Hemoglobin',
    unit: 'g/dL',
    normal_min: 13.5,
    normal_max: 17.5,
    critical_low: 7.0,
    critical_high: 20.0,
    gender: 'male',
    notes: 'Adult male reference range'
  },
  {
    test_name: 'FBC',
    parameter: 'Hemoglobin',
    unit: 'g/dL',
    normal_min: 12.0,
    normal_max: 15.5,
    critical_low: 7.0,
    critical_high: 18.0,
    gender: 'female',
    notes: 'Adult female reference range'
  },
  {
    test_name: 'FBC',
    parameter: 'WBC',
    unit: '×10⁹/L',
    normal_min: 4.0,
    normal_max: 11.0,
    critical_low: 2.0,
    critical_high: 30.0,
    gender: 'both'
  },
  {
    test_name: 'FBC',
    parameter: 'Platelets',
    unit: '×10⁹/L',
    normal_min: 150,
    normal_max: 400,
    critical_low: 20,
    critical_high: 1000,
    gender: 'both'
  },
  {
    test_name: 'FBC',
    parameter: 'Neutrophils',
    unit: '×10⁹/L',
    normal_min: 2.0,
    normal_max: 7.5,
    critical_low: 0.5,
    critical_high: 20.0,
    gender: 'both'
  },
  {
    test_name: 'FBC',
    parameter: 'Lymphocytes',
    unit: '×10⁹/L',
    normal_min: 1.0,
    normal_max: 4.0,
    critical_low: 0.5,
    critical_high: 10.0,
    gender: 'both'
  },
  {
    test_name: 'FBC',
    parameter: 'Hematocrit',
    unit: '%',
    normal_min: 40,
    normal_max: 54,
    critical_low: 20,
    critical_high: 60,
    gender: 'male'
  },
  {
    test_name: 'FBC',
    parameter: 'Hematocrit',
    unit: '%',
    normal_min: 36,
    normal_max: 48,
    critical_low: 18,
    critical_high: 55,
    gender: 'female'
  },
  {
    test_name: 'FBC',
    parameter: 'MCV',
    unit: 'fL',
    normal_min: 80,
    normal_max: 100,
    critical_low: 60,
    critical_high: 120,
    gender: 'both'
  }
];

// Urea & Electrolytes (U&E)
export const UREA_ELECTROLYTES_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'U&E',
    parameter: 'Sodium',
    unit: 'mmol/L',
    normal_min: 135,
    normal_max: 145,
    critical_low: 120,
    critical_high: 160,
    gender: 'both'
  },
  {
    test_name: 'U&E',
    parameter: 'Potassium',
    unit: 'mmol/L',
    normal_min: 3.5,
    normal_max: 5.0,
    critical_low: 2.5,
    critical_high: 6.5,
    gender: 'both',
    notes: 'Critical for cardiac function'
  },
  {
    test_name: 'U&E',
    parameter: 'Chloride',
    unit: 'mmol/L',
    normal_min: 95,
    normal_max: 105,
    critical_low: 80,
    critical_high: 120,
    gender: 'both'
  },
  {
    test_name: 'U&E',
    parameter: 'Bicarbonate',
    unit: 'mmol/L',
    normal_min: 22,
    normal_max: 29,
    critical_low: 10,
    critical_high: 40,
    gender: 'both'
  },
  {
    test_name: 'U&E',
    parameter: 'Urea',
    unit: 'mmol/L',
    normal_min: 2.5,
    normal_max: 6.7,
    critical_low: null,
    critical_high: 30.0,
    gender: 'both'
  },
  {
    test_name: 'U&E',
    parameter: 'Creatinine',
    unit: 'μmol/L',
    normal_min: 60,
    normal_max: 110,
    critical_low: null,
    critical_high: 500,
    gender: 'male'
  },
  {
    test_name: 'U&E',
    parameter: 'Creatinine',
    unit: 'μmol/L',
    normal_min: 45,
    normal_max: 90,
    critical_low: null,
    critical_high: 500,
    gender: 'female'
  }
];

// Liver Function Tests (LFT)
export const LFT_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'LFT',
    parameter: 'ALT',
    unit: 'U/L',
    normal_min: 7,
    normal_max: 56,
    critical_low: null,
    critical_high: 500,
    gender: 'both'
  },
  {
    test_name: 'LFT',
    parameter: 'AST',
    unit: 'U/L',
    normal_min: 10,
    normal_max: 40,
    critical_low: null,
    critical_high: 500,
    gender: 'both'
  },
  {
    test_name: 'LFT',
    parameter: 'ALP',
    unit: 'U/L',
    normal_min: 30,
    normal_max: 120,
    critical_low: null,
    critical_high: 500,
    gender: 'both'
  },
  {
    test_name: 'LFT',
    parameter: 'Bilirubin (Total)',
    unit: 'μmol/L',
    normal_min: 3,
    normal_max: 17,
    critical_low: null,
    critical_high: 300,
    gender: 'both'
  },
  {
    test_name: 'LFT',
    parameter: 'Albumin',
    unit: 'g/L',
    normal_min: 35,
    normal_max: 50,
    critical_low: 20,
    critical_high: null,
    gender: 'both'
  },
  {
    test_name: 'LFT',
    parameter: 'Total Protein',
    unit: 'g/L',
    normal_min: 60,
    normal_max: 80,
    critical_low: 40,
    critical_high: 100,
    gender: 'both'
  },
  {
    test_name: 'LFT',
    parameter: 'GGT',
    unit: 'U/L',
    normal_min: 8,
    normal_max: 61,
    critical_low: null,
    critical_high: 500,
    gender: 'both'
  }
];

// Coagulation Profile
export const COAGULATION_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'Coagulation',
    parameter: 'PT',
    unit: 'seconds',
    normal_min: 11,
    normal_max: 13.5,
    critical_low: null,
    critical_high: 30,
    gender: 'both'
  },
  {
    test_name: 'Coagulation',
    parameter: 'INR',
    unit: '',
    normal_min: 0.9,
    normal_max: 1.2,
    critical_low: null,
    critical_high: 5.0,
    gender: 'both',
    notes: 'Therapeutic range varies for anticoagulation'
  },
  {
    test_name: 'Coagulation',
    parameter: 'APTT',
    unit: 'seconds',
    normal_min: 25,
    normal_max: 35,
    critical_low: null,
    critical_high: 100,
    gender: 'both'
  },
  {
    test_name: 'Coagulation',
    parameter: 'Fibrinogen',
    unit: 'g/L',
    normal_min: 2.0,
    normal_max: 4.0,
    critical_low: 1.0,
    critical_high: 8.0,
    gender: 'both'
  }
];

// Glucose & Diabetes Markers
export const GLUCOSE_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'Glucose',
    parameter: 'Fasting Glucose',
    unit: 'mmol/L',
    normal_min: 3.9,
    normal_max: 5.6,
    critical_low: 2.2,
    critical_high: 25.0,
    gender: 'both'
  },
  {
    test_name: 'Glucose',
    parameter: 'Random Glucose',
    unit: 'mmol/L',
    normal_min: 3.9,
    normal_max: 11.0,
    critical_low: 2.2,
    critical_high: 25.0,
    gender: 'both'
  },
  {
    test_name: 'HbA1c',
    parameter: 'HbA1c',
    unit: '%',
    normal_min: 4.0,
    normal_max: 5.6,
    critical_low: null,
    critical_high: 15.0,
    gender: 'both',
    notes: '5.7-6.4% prediabetes, ≥6.5% diabetes'
  },
  {
    test_name: 'HbA1c',
    parameter: 'HbA1c',
    unit: 'mmol/mol',
    normal_min: 20,
    normal_max: 38,
    critical_low: null,
    critical_high: 140,
    gender: 'both'
  }
];

// Lipid Profile
export const LIPID_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'Lipid Profile',
    parameter: 'Total Cholesterol',
    unit: 'mmol/L',
    normal_min: null,
    normal_max: 5.2,
    critical_low: null,
    critical_high: 10.0,
    gender: 'both'
  },
  {
    test_name: 'Lipid Profile',
    parameter: 'LDL Cholesterol',
    unit: 'mmol/L',
    normal_min: null,
    normal_max: 3.0,
    critical_low: null,
    critical_high: 8.0,
    gender: 'both'
  },
  {
    test_name: 'Lipid Profile',
    parameter: 'HDL Cholesterol',
    unit: 'mmol/L',
    normal_min: 1.0,
    normal_max: null,
    critical_low: 0.5,
    critical_high: null,
    gender: 'both',
    notes: 'Higher is better'
  },
  {
    test_name: 'Lipid Profile',
    parameter: 'Triglycerides',
    unit: 'mmol/L',
    normal_min: null,
    normal_max: 1.7,
    critical_low: null,
    critical_high: 10.0,
    gender: 'both'
  }
];

// Thyroid Function
export const THYROID_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'Thyroid',
    parameter: 'TSH',
    unit: 'mIU/L',
    normal_min: 0.4,
    normal_max: 4.0,
    critical_low: 0.1,
    critical_high: 20.0,
    gender: 'both'
  },
  {
    test_name: 'Thyroid',
    parameter: 'Free T4',
    unit: 'pmol/L',
    normal_min: 9,
    normal_max: 25,
    critical_low: 5,
    critical_high: 50,
    gender: 'both'
  },
  {
    test_name: 'Thyroid',
    parameter: 'Free T3',
    unit: 'pmol/L',
    normal_min: 3.5,
    normal_max: 7.8,
    critical_low: 2.0,
    critical_high: 15.0,
    gender: 'both'
  }
];

// Cardiac Markers
export const CARDIAC_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'Cardiac Markers',
    parameter: 'Troponin I',
    unit: 'ng/mL',
    normal_min: null,
    normal_max: 0.04,
    critical_low: null,
    critical_high: 10.0,
    gender: 'both',
    notes: 'Serial measurements essential for MI diagnosis'
  },
  {
    test_name: 'Cardiac Markers',
    parameter: 'CK-MB',
    unit: 'U/L',
    normal_min: null,
    normal_max: 25,
    critical_low: null,
    critical_high: 500,
    gender: 'both'
  },
  {
    test_name: 'Cardiac Markers',
    parameter: 'BNP',
    unit: 'pg/mL',
    normal_min: null,
    normal_max: 100,
    critical_low: null,
    critical_high: 2000,
    gender: 'both',
    notes: 'Heart failure marker'
  }
];

// Inflammatory Markers
export const INFLAMMATORY_REFERENCE: ReferenceRange[] = [
  {
    test_name: 'Inflammatory Markers',
    parameter: 'CRP',
    unit: 'mg/L',
    normal_min: null,
    normal_max: 10,
    critical_low: null,
    critical_high: 200,
    gender: 'both'
  },
  {
    test_name: 'Inflammatory Markers',
    parameter: 'ESR',
    unit: 'mm/hr',
    normal_min: null,
    normal_max: 20,
    critical_low: null,
    critical_high: 100,
    gender: 'male'
  },
  {
    test_name: 'Inflammatory Markers',
    parameter: 'ESR',
    unit: 'mm/hr',
    normal_min: null,
    normal_max: 30,
    critical_low: null,
    critical_high: 100,
    gender: 'female'
  }
];

// Consolidate all reference ranges
export const ALL_REFERENCE_RANGES: ReferenceRange[] = [
  ...FBC_REFERENCE,
  ...UREA_ELECTROLYTES_REFERENCE,
  ...LFT_REFERENCE,
  ...COAGULATION_REFERENCE,
  ...GLUCOSE_REFERENCE,
  ...LIPID_REFERENCE,
  ...THYROID_REFERENCE,
  ...CARDIAC_REFERENCE,
  ...INFLAMMATORY_REFERENCE
];

// Helper function to interpret a lab result
export function interpretLabResult(
  testName: string,
  parameter: string,
  value: number,
  gender?: 'male' | 'female'
): LabInterpretation {
  // Find matching reference range
  const reference = ALL_REFERENCE_RANGES.find(
    ref =>
      ref.test_name === testName &&
      ref.parameter === parameter &&
      (ref.gender === 'both' || ref.gender === gender || !ref.gender)
  );

  if (!reference) {
    return {
      status: 'normal',
      flag: 'normal',
      message: 'Reference range not found',
      clinical_significance: 'Unable to interpret without reference values',
      suggested_actions: ['Consult lab manual for reference ranges']
    };
  }

  // Check critical values first
  if (reference.critical_low !== null && value < reference.critical_low) {
    return {
      status: 'critical',
      flag: 'critical_low',
      message: `Critically low: ${value} ${reference.unit} (Critical: <${reference.critical_low})`,
      clinical_significance: getClinicalSignificance(testName, parameter, 'critical_low'),
      suggested_actions: getCriticalActions(testName, parameter, 'low')
    };
  }

  if (reference.critical_high !== null && value > reference.critical_high) {
    return {
      status: 'critical',
      flag: 'critical_high',
      message: `Critically high: ${value} ${reference.unit} (Critical: >${reference.critical_high})`,
      clinical_significance: getClinicalSignificance(testName, parameter, 'critical_high'),
      suggested_actions: getCriticalActions(testName, parameter, 'high')
    };
  }

  // Check normal range
  if (reference.normal_min !== null && value < reference.normal_min) {
    return {
      status: 'abnormal',
      flag: 'low',
      message: `Below normal: ${value} ${reference.unit} (Normal: ${reference.normal_min}-${reference.normal_max})`,
      clinical_significance: getClinicalSignificance(testName, parameter, 'low'),
      suggested_actions: getAbnormalActions(testName, parameter, 'low')
    };
  }

  if (reference.normal_max !== null && value > reference.normal_max) {
    return {
      status: 'abnormal',
      flag: 'high',
      message: `Above normal: ${value} ${reference.unit} (Normal: ${reference.normal_min}-${reference.normal_max})`,
      clinical_significance: getClinicalSignificance(testName, parameter, 'high'),
      suggested_actions: getAbnormalActions(testName, parameter, 'high')
    };
  }

  return {
    status: 'normal',
    flag: 'normal',
    message: `Normal: ${value} ${reference.unit} (${reference.normal_min}-${reference.normal_max})`,
    clinical_significance: 'Within normal limits',
    suggested_actions: ['Continue routine monitoring']
  };
}

// Clinical significance helper
function getClinicalSignificance(testName: string, parameter: string, flag: string): string {
  const significanceMap: Record<string, Record<string, string>> = {
    'Hemoglobin': {
      low: 'Anemia - may indicate blood loss, nutritional deficiency, or chronic disease',
      high: 'Polycythemia - check hydration status and chronic hypoxia',
      critical_low: 'Severe anemia - transfusion may be required',
      critical_high: 'Severe polycythemia - increased thrombosis risk'
    },
    'Potassium': {
      low: 'Hypokalemia - cardiac arrhythmia risk, muscle weakness',
      high: 'Hyperkalemia - life-threatening cardiac arrhythmia risk',
      critical_low: 'Severe hypokalemia - immediate correction needed',
      critical_high: 'Severe hyperkalemia - cardiac arrest risk, urgent treatment'
    },
    'Creatinine': {
      high: 'Impaired renal function - assess fluid status and nephrotoxic medications',
      critical_high: 'Acute kidney injury or severe CKD - consider dialysis'
    },
    'Platelets': {
      low: 'Thrombocytopenia - bleeding risk increased',
      high: 'Thrombocytosis - thrombosis risk',
      critical_low: 'Severe thrombocytopenia - spontaneous bleeding risk',
      critical_high: 'Severe thrombocytosis - high thrombosis risk'
    },
    'INR': {
      high: 'Increased bleeding risk - adjust anticoagulation',
      critical_high: 'Severe bleeding risk - urgent intervention needed'
    },
    'Glucose': {
      low: 'Hypoglycemia - risk of seizures and coma',
      high: 'Hyperglycemia - diabetic control issues',
      critical_low: 'Severe hypoglycemia - urgent glucose administration',
      critical_high: 'Severe hyperglycemia - DKA/HHS risk'
    }
  };

  return significanceMap[parameter]?.[flag] || 'Clinical correlation required';
}

// Suggested actions helper
function getCriticalActions(testName: string, parameter: string, direction: 'low' | 'high'): string[] {
  const actionsMap: Record<string, Record<string, string[]>> = {
    'Hemoglobin': {
      low: ['Urgent review by senior clinician', 'Type and cross-match blood', 'Consider transfusion', 'Identify source of blood loss'],
      high: ['Check hydration status', 'Review for chronic hypoxia', 'Hematology consultation']
    },
    'Potassium': {
      low: ['Urgent ECG', 'IV potassium replacement', 'Continuous cardiac monitoring', 'Check magnesium levels'],
      high: ['Urgent ECG', 'Calcium gluconate if ECG changes', 'Insulin-dextrose or salbutamol', 'Consider dialysis', 'Continuous cardiac monitoring']
    },
    'Creatinine': {
      high: ['Senior review urgently', 'Stop nephrotoxic drugs', 'Assess fluid status', 'Consider renal replacement therapy', 'Nephrology consultation']
    },
    'Platelets': {
      low: ['Bleeding precautions', 'Avoid invasive procedures', 'Platelet transfusion if <20 or active bleeding', 'Hematology review'],
      high: ['Antiplatelet therapy consideration', 'Exclude reactive vs clonal thrombocytosis', 'Hematology review']
    },
    'Glucose': {
      low: ['Immediate glucose administration', 'Check for causes', 'Frequent monitoring', 'Adjust diabetic medications'],
      high: ['Check ketones', 'IV fluids', 'Insulin therapy', 'Monitor electrolytes', 'Assess for DKA/HHS']
    },
    'INR': {
      high: ['Vitamin K administration', 'Hold warfarin', 'Consider prothrombin complex concentrate if active bleeding', 'Senior review']
    }
  };

  return actionsMap[parameter]?.[direction] || ['Urgent senior review', 'Repeat test', 'Clinical correlation'];
}

// Normal abnormal actions helper
function getAbnormalActions(_testName: string, _parameter: string, _direction: 'low' | 'high'): string[] {
  return [
    'Review by treating physician',
    'Repeat test to confirm',
    'Clinical correlation with patient symptoms',
    'Consider underlying causes',
    'Document and monitor trend'
  ];
}

// Get reference range for display
export function getReferenceRange(
  testName: string,
  parameter: string,
  gender?: 'male' | 'female'
): string {
  const reference = ALL_REFERENCE_RANGES.find(
    ref =>
      ref.test_name === testName &&
      ref.parameter === parameter &&
      (ref.gender === 'both' || ref.gender === gender || !ref.gender)
  );

  if (!reference) return 'Not available';

  const min = reference.normal_min !== null ? reference.normal_min.toString() : '';
  const max = reference.normal_max !== null ? reference.normal_max.toString() : '';

  if (min && max) {
    return `${min}-${max} ${reference.unit}`;
  } else if (max) {
    return `<${max} ${reference.unit}`;
  } else if (min) {
    return `>${min} ${reference.unit}`;
  }

  return 'Not available';
}
