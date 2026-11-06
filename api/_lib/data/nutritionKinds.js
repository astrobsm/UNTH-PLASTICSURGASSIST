// Nutrition measurement kinds — the single list used by the API's validation
// and by the client forms. SI units; plausibility ranges reject typos.
export const MEASUREMENT_KINDS = {
  weight: { unit: 'kg', min: 10, max: 400, label: 'Weight', group: 'body' },
  dressing_weight: { unit: 'kg', min: 0, max: 30, label: 'Dressing / cast weight', group: 'body' },
  height: { unit: 'cm', min: 90, max: 230, label: 'Height', group: 'body' },
  knee_height: { unit: 'cm', min: 30, max: 75, label: 'Knee height', group: 'body' },
  ulna: { unit: 'cm', min: 15, max: 40, label: 'Ulna length', group: 'body' },
  muac: { unit: 'cm', min: 10, max: 70, label: 'MUAC', group: 'body' },
  tsf: { unit: 'mm', min: 1, max: 80, label: 'Triceps skinfold', group: 'body' },
  calf: { unit: 'cm', min: 15, max: 70, label: 'Calf circumference', group: 'body' },
  grip: { unit: 'kg', min: 0, max: 100, label: 'Grip strength (best of 3)', group: 'body' },
  phase_angle: { unit: '°', min: 1, max: 15, label: 'BIA phase angle', group: 'body' },
  quadriceps: { unit: 'mm', min: 2, max: 80, label: 'Quadriceps thickness (US)', group: 'body' },
  indirect_calorimetry: { unit: 'kcal/day', min: 300, max: 6000, label: 'Indirect calorimetry', group: 'body' },
  albumin: { unit: 'g/L', min: 5, max: 70, label: 'Albumin', group: 'lab' },
  prealbumin: { unit: 'g/L', min: 0.01, max: 1, label: 'Prealbumin', group: 'lab' },
  crp: { unit: 'mg/L', min: 0, max: 600, label: 'CRP', group: 'lab' },
  hb: { unit: 'g/L', min: 20, max: 250, label: 'Haemoglobin', group: 'lab' },
  lymphocytes: { unit: '×10⁹/L', min: 0, max: 100, label: 'Total lymphocytes', group: 'lab' },
  glucose: { unit: 'mmol/L', min: 0.5, max: 60, label: 'Glucose', group: 'lab' },
  hba1c: { unit: '%', min: 3, max: 20, label: 'HbA1c', group: 'lab' },
  urea: { unit: 'mmol/L', min: 0.5, max: 100, label: 'Urea', group: 'lab' },
  creatinine: { unit: 'µmol/L', min: 10, max: 3000, label: 'Creatinine', group: 'lab' },
  na: { unit: 'mmol/L', min: 90, max: 200, label: 'Sodium', group: 'lab' },
  k: { unit: 'mmol/L', min: 1, max: 10, label: 'Potassium', group: 'lab' },
  po4: { unit: 'mmol/L', min: 0.05, max: 6, label: 'Phosphate', group: 'lab' },
  mg: { unit: 'mmol/L', min: 0.1, max: 5, label: 'Magnesium', group: 'lab' },
  uun: { unit: 'g/day', min: 0, max: 60, label: '24-h urinary urea nitrogen', group: 'lab' },
};

export const WEIGHT_METHODS = ['measured', 'bed_scale', 'hoist', 'reported'];
