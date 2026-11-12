/**
 * Drop-down catalogues for the critical-care case builder (category → items).
 * Every category accepts "Other (specify)". Lab tests carry a unit picker;
 * the first unit is the SI default.
 */
export const OTHER = 'Other (specify)';

export const SYMPTOMS: Record<string, string[]> = {
  General: ['Fever', 'Rigors', 'Sweating', 'Fatigue', 'Weight loss', 'Anorexia', 'Malaise'],
  Neurological: ['Headache', 'Confusion', 'Agitation', 'Drowsiness', 'Seizures', 'Focal weakness', 'Numbness', 'Visual disturbance', 'Neck stiffness', 'Dizziness', 'Tremor'],
  Respiratory: ['Breathlessness', 'Cough', 'Sputum', 'Haemoptysis', 'Chest pain (pleuritic)', 'Wheeze', 'Stridor'],
  Cardiovascular: ['Chest pain', 'Palpitations', 'Syncope', 'Orthopnoea', 'PND', 'Leg swelling'],
  Gastrointestinal: ['Nausea', 'Vomiting', 'Haematemesis', 'Diarrhoea', 'Melaena', 'Abdominal pain', 'Distension', 'Constipation', 'Dysphagia', 'Jaundice'],
  'Renal / urinary': ['Reduced urine output', 'Dark or bloody urine', 'Dysuria', 'Frequency', 'Flank pain'],
  Haematological: ['Bleeding', 'Easy bruising', 'Bone pain (sickle crisis)', 'Pallor'],
  'Endocrine / metabolic': ['Polyuria', 'Polydipsia', 'Heat or cold intolerance', 'Muscle cramps'],
  'Musculoskeletal / skin': ['Muscle pain', 'Weakness', 'Rash', 'Skin peeling', 'Wound discharge', 'Burns'],
  Obstetric: ['Pregnancy', 'Vaginal bleeding', 'Postpartum', 'Headache with visual change'],
  'Exposure / toxicology': ['Snakebite', 'Insecticide or organophosphate', 'Kerosene', 'Overdose', 'Alcohol', 'Herbal or traditional remedy', 'Dog bite', 'Travel'],
};

export const SIGNS: Record<string, string[]> = {
  General: ['Pallor', 'Jaundice', 'Cyanosis', 'Dehydration', 'Oedema', 'Lymphadenopathy', 'Clubbing', 'Cold peripheries', 'Capillary refill > 3 s'],
  Neurological: ['GCS components', 'Pupils', 'Neck stiffness', 'Focal deficit', 'Reflexes', 'Tone', 'Asterixis', 'Trismus/spasms'],
  Respiratory: ['Accessory muscle use', 'Chest expansion', 'Crackles', 'Wheeze', 'Reduced air entry', 'Dullness', 'Pleural rub'],
  Cardiovascular: ['Raised JVP', 'Murmur', 'Gallop', 'Weak pulses', 'Arrhythmia', 'Pericardial rub'],
  Abdominal: ['Tenderness', 'Guarding', 'Distension', 'Hepatomegaly', 'Splenomegaly', 'Ascites', 'Bowel sounds'],
  Renal: ['Catheter output', 'Bladder distension', 'Fluid overload signs'],
  'Skin / wounds': ['Rash', 'Petechiae', 'Purpura', 'Bleeding sites', 'Burns (% TBSA, depth)', 'Pressure injury', 'Wound infection'],
};

/** Lab panels → tests → unit choices (SI first). Names match the engine's analyte dictionary. */
export const LAB_PANELS: Record<string, { test: string; units: string[] }[]> = {
  Haematology: [
    { test: 'Haemoglobin', units: ['g/L', 'g/dL'] }, { test: 'PCV', units: ['%', 'L/L'] }, { test: 'WBC', units: ['×10⁹/L'] },
    { test: 'Neutrophils', units: ['×10⁹/L'] }, { test: 'Lymphocytes', units: ['×10⁹/L'] }, { test: 'Platelets', units: ['×10⁹/L'] },
    { test: 'MCV', units: ['fL'] }, { test: 'MCH', units: ['pg'] }, { test: 'Reticulocytes', units: ['%'] }, { test: 'ESR', units: ['mm/h'] },
    { test: 'Malaria parasites', units: ['text'] }, { test: 'Sickling / genotype', units: ['text'] },
  ],
  Coagulation: [
    { test: 'PT', units: ['s'] }, { test: 'INR', units: [''] }, { test: 'APTT', units: ['s'] }, { test: 'Fibrinogen', units: ['g/L'] },
    { test: 'D-dimer', units: ['mg/L FEU', 'ng/mL'] }, { test: '20-minute whole blood clotting test', units: ['text'] },
  ],
  'Electrolytes and renal': [
    { test: 'Sodium', units: ['mmol/L'] }, { test: 'Potassium', units: ['mmol/L'] }, { test: 'Chloride', units: ['mmol/L'] },
    { test: 'Bicarbonate', units: ['mmol/L'] }, { test: 'Urea', units: ['mmol/L', 'mg/dL'] }, { test: 'Creatinine', units: ['µmol/L', 'mg/dL'] },
    { test: 'Calcium', units: ['mmol/L', 'mg/dL'] }, { test: 'Ionised calcium', units: ['mmol/L'] }, { test: 'Magnesium', units: ['mmol/L', 'mg/dL'] },
    { test: 'Phosphate', units: ['mmol/L', 'mg/dL'] }, { test: 'Uric acid', units: ['µmol/L', 'mg/dL'] },
  ],
  Liver: [
    { test: 'Total bilirubin', units: ['µmol/L', 'mg/dL'] }, { test: 'Direct bilirubin', units: ['µmol/L', 'mg/dL'] },
    { test: 'ALT', units: ['U/L'] }, { test: 'AST', units: ['U/L'] }, { test: 'ALP', units: ['U/L'] }, { test: 'GGT', units: ['U/L'] },
    { test: 'Total protein', units: ['g/L'] }, { test: 'Albumin', units: ['g/L', 'g/dL'] },
  ],
  'Arterial / venous gas': [
    { test: 'pH', units: [''] }, { test: 'PaO2', units: ['kPa', 'mmHg'] }, { test: 'PaCO2', units: ['kPa', 'mmHg'] },
    { test: 'HCO3', units: ['mmol/L'] }, { test: 'Base excess', units: ['mmol/L'] }, { test: 'Lactate', units: ['mmol/L'] },
    { test: 'FiO2 at sampling', units: ['%', 'fraction'] },
  ],
  'Glucose and endocrine': [
    { test: 'Glucose', units: ['mmol/L', 'mg/dL'] }, { test: 'HbA1c', units: ['%', 'mmol/mol'] }, { test: 'Blood ketones', units: ['mmol/L'] },
    { test: 'Cortisol', units: ['nmol/L'] }, { test: 'TSH', units: ['mU/L'] }, { test: 'Free T4', units: ['pmol/L'] },
  ],
  Cardiac: [{ test: 'Troponin', units: ['ng/L'] }, { test: 'CK-MB', units: ['U/L', 'µg/L'] }, { test: 'NT-proBNP', units: ['ng/L', 'pg/mL'] }],
  'Inflammation and sepsis': [{ test: 'CRP', units: ['mg/L'] }, { test: 'Procalcitonin', units: ['µg/L', 'ng/mL'] }],
  'Pancreas and muscle': [{ test: 'Amylase', units: ['U/L'] }, { test: 'Lipase', units: ['U/L'] }, { test: 'CK', units: ['U/L'] }, { test: 'LDH', units: ['U/L'] }],
  Osmolality: [{ test: 'Serum osmolality', units: ['mOsm/kg'] }, { test: 'Urine osmolality', units: ['mOsm/kg'] }],
  Urine: [
    { test: 'Urine sodium', units: ['mmol/L'] }, { test: 'Urine potassium', units: ['mmol/L'] }, { test: 'Urine chloride', units: ['mmol/L'] },
    { test: 'Urine creatinine', units: ['µmol/L', 'mmol/L', 'mg/dL'] }, { test: 'Urine urea', units: ['mmol/L'] },
    { test: 'Urine protein:creatinine ratio', units: ['mg/mmol'] }, { test: 'Urine ketones', units: ['text'] }, { test: 'Urinalysis', units: ['text'] },
  ],
  'Microbiology and serology': [
    { test: 'Blood culture', units: ['text'] }, { test: 'Urine culture', units: ['text'] }, { test: 'Sputum culture', units: ['text'] },
    { test: 'Wound culture', units: ['text'] }, { test: 'CSF culture', units: ['text'] }, { test: 'Malaria RDT', units: ['text'] },
    { test: 'HIV', units: ['text'] }, { test: 'HBsAg', units: ['text'] }, { test: 'Anti-HCV', units: ['text'] }, { test: 'Lassa fever PCR', units: ['text'] },
    { test: 'TB GeneXpert', units: ['text'] }, { test: 'Widal (low reliability)', units: ['text'] },
  ],
  CSF: [{ test: 'CSF cell count', units: ['cells/µL'] }, { test: 'CSF protein', units: ['g/L'] }, { test: 'CSF glucose', units: ['mmol/L'] }, { test: 'CSF Gram stain', units: ['text'] }],
  'Drug levels': [
    { test: 'Vancomycin level', units: ['mg/L'] }, { test: 'Gentamicin level', units: ['mg/L'] }, { test: 'Digoxin level', units: ['µg/L', 'nmol/L'] },
    { test: 'Phenytoin level', units: ['mg/L'] }, { test: 'Valproate level', units: ['mg/L'] }, { test: 'Lithium level', units: ['mmol/L'] },
    { test: 'Paracetamol level', units: ['mg/L'] }, { test: 'Salicylate level', units: ['mg/L'] },
  ],
};

export const MEDICATION_CATEGORIES: Record<string, string[]> = {
  Antibacterials: ['Amoxicillin', 'Amoxicillin–clavulanate', 'Ampicillin', 'Cloxacillin', 'Benzylpenicillin', 'Piperacillin–tazobactam', 'Ceftriaxone', 'Cefuroxime', 'Ceftazidime', 'Cefepime', 'Meropenem', 'Imipenem', 'Gentamicin', 'Amikacin', 'Ciprofloxacin', 'Levofloxacin', 'Azithromycin', 'Clarithromycin', 'Vancomycin', 'Metronidazole', 'Linezolid', 'Co-trimoxazole', 'Clindamycin', 'Doxycycline'],
  Antimalarials: ['Artesunate', 'Artemether', 'Artemether–lumefantrine', 'Quinine'],
  'Antifungals, antivirals, anti-TB, antiretrovirals': ['Fluconazole', 'Amphotericin B', 'Aciclovir', 'Ribavirin', 'Rifampicin', 'Isoniazid', 'Pyrazinamide', 'Ethambutol', 'Tenofovir/lamivudine/dolutegravir'],
  'Vasopressors and inotropes': ['Noradrenaline', 'Adrenaline', 'Dopamine', 'Dobutamine', 'Vasopressin'],
  'Sedatives, analgesics, NMBs': ['Midazolam', 'Propofol', 'Ketamine', 'Morphine', 'Fentanyl', 'Pethidine', 'Tramadol', 'Paracetamol', 'Ibuprofen', 'Diclofenac', 'Suxamethonium', 'Rocuronium', 'Atracurium'],
  'Anticoagulants and antiplatelets': ['Heparin', 'Enoxaparin', 'Warfarin', 'Rivaroxaban', 'Apixaban', 'Aspirin', 'Clopidogrel', 'Tranexamic acid'],
  Cardiovascular: ['Lisinopril', 'Ramipril', 'Losartan', 'Amlodipine', 'Nifedipine', 'Atenolol', 'Bisoprolol', 'Carvedilol', 'Glyceryl trinitrate', 'Hydralazine', 'Amiodarone', 'Digoxin', 'Atorvastatin'],
  Diuretics: ['Furosemide', 'Hydrochlorothiazide', 'Bendroflumethiazide', 'Spironolactone', 'Mannitol', 'Acetazolamide'],
  Endocrine: ['Soluble insulin', 'Insulin glargine', 'Mixed insulin', 'Metformin', 'Glibenclamide', 'Gliclazide', 'Hydrocortisone', 'Dexamethasone', 'Prednisolone', 'Levothyroxine'],
  CNS: ['Phenytoin', 'Levetiracetam', 'Valproate', 'Phenobarbital', 'Carbamazepine', 'Haloperidol', 'Fluoxetine', 'Sertraline', 'Amitriptyline', 'Diazepam', 'Lorazepam'],
  GI: ['Omeprazole', 'Pantoprazole', 'Ranitidine', 'Metoclopramide', 'Ondansetron', 'Lactulose'],
  Respiratory: ['Salbutamol', 'Ipratropium', 'Aminophylline', 'Magnesium sulfate'],
  'Electrolytes and IV fluids': ['Potassium chloride', 'Magnesium sulfate', 'Calcium gluconate', 'Potassium phosphate', 'Sodium bicarbonate', '3% sodium chloride', '0.9% sodium chloride', "Ringer's lactate", '5% dextrose', '10% dextrose'],
  'Blood products': ['Packed red cells', 'Whole blood', 'Fresh frozen plasma', 'Platelets', 'Cryoprecipitate'],
  'Antidotes and antivenoms': ['Atropine', 'Pralidoxime', 'Naloxone', 'Flumazenil', 'N-acetylcysteine', 'Vitamin K', 'Antivenom'],
  'Herbal / traditional / other': [],
};

export const ROUTES = ['oral', 'IV', 'IV infusion', 'IM', 'SC', 'nebulised', 'NG/OG', 'PR', 'topical', 'inhaled', 'sublingual'];
export const FREQUENCIES = ['once', 'once daily', 'twice daily', 'three times daily', 'four times daily', 'every 4 h', 'every 6 h', 'every 8 h', 'every 12 h', 'at night', 'as required', 'continuous infusion'];
