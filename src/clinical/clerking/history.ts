/**
 * History sections beyond the presenting complaints: past medical and surgical
 * history (with the comorbidities and risk factors that matter for wound
 * healing, anaesthesia and VTE), family, social, gynaecological/obstetric
 * history and the review of systems.
 */
import type { Question } from './types';

const YNU = ['Yes', 'No', 'Unknown'];

/**
 * Comorbidity checklist. Each one is answered Yes / No / Unknown — "No" is a
 * documented negative, an unanswered row is "not asked". Details appear only
 * when the answer is Yes.
 */
export const COMORBIDITIES: Array<{ id: string; label: string; details?: Question[]; riskFactor?: string }> = [
  { id: 'diabetes', label: 'Diabetes mellitus', riskFactor: 'Impaired wound healing, infection, neuropathy, peripheral arterial disease', details: [
    { id: 'type', label: 'Type', type: 'select', options: ['Type 1', 'Type 2', 'Gestational', 'Unknown'] },
    { id: 'duration', label: 'Duration', type: 'select', options: ['< 1 year', '1–5 years', '5–10 years', '> 10 years', 'Newly diagnosed', 'Unknown'] },
    { id: 'treatment', label: 'Treatment', type: 'multiselect', options: ['Diet only', 'Metformin', 'Sulfonylurea', 'Insulin', 'Other oral agent', 'None / defaulted', 'Herbal'] },
    { id: 'control', label: 'Control', type: 'select', options: ['Good', 'Fair', 'Poor', 'Unknown'] },
    { id: 'complications', label: 'Complications', type: 'multiselect', options: ['Neuropathy', 'Retinopathy', 'Nephropathy', 'Foot ulcer before', 'Amputation before', 'Heart disease', 'None known'] },
  ] },
  { id: 'hypertension', label: 'Hypertension', riskFactor: 'Cardiovascular and anaesthetic risk', details: [
    { id: 'duration', label: 'Duration', type: 'select', options: ['< 1 year', '1–5 years', '> 5 years', 'Unknown'] },
    { id: 'control', label: 'Control', type: 'select', options: ['Good', 'Fair', 'Poor', 'Not on treatment', 'Unknown'] },
  ] },
  { id: 'sickle_cell', label: 'Sickle cell disease (HbSS / HbSC)', riskFactor: 'Leg ulcers, crises, transfusion needs, anaesthetic risk', details: [
    { id: 'genotype', label: 'Genotype', type: 'select', options: ['SS', 'SC', 'Other', 'Unknown'] },
    { id: 'crises', label: 'Crises per year', type: 'select', options: ['None', '1–2', '3 or more', 'Unknown'] },
    { id: 'transfusions', label: 'Previous transfusions', type: 'select', options: YNU },
  ] },
  { id: 'hiv', label: 'HIV infection', riskFactor: 'Infection risk, wound healing, Kaposi sarcoma', details: [
    { id: 'on_art', label: 'On antiretroviral therapy', type: 'select', options: YNU },
    { id: 'cd4', label: 'Last CD4 / viral load known', type: 'select', options: ['Suppressed', 'Not suppressed', 'Unknown'] },
  ] },
  { id: 'tb', label: 'Tuberculosis (current or past)', details: [
    { id: 'status', label: 'Status', type: 'select', options: ['Currently on treatment', 'Completed treatment', 'Defaulted', 'Unknown'] },
  ] },
  { id: 'heart_disease', label: 'Heart disease / heart failure', riskFactor: 'Anaesthetic and fluid-management risk' },
  { id: 'stroke', label: 'Previous stroke' },
  { id: 'asthma_copd', label: 'Asthma / COPD' },
  { id: 'ckd', label: 'Chronic kidney disease', riskFactor: 'Drug dosing; wound healing' },
  { id: 'liver_disease', label: 'Liver disease / hepatitis B or C' },
  { id: 'epilepsy', label: 'Epilepsy' },
  { id: 'cancer', label: 'Cancer (current or past)', details: [
    { id: 'type', label: 'Type', type: 'text' },
    { id: 'treatment', label: 'Treatment', type: 'multiselect', options: ['Surgery', 'Chemotherapy', 'Radiotherapy', 'Hormonal', 'None', 'Unknown'] },
  ] },
  { id: 'immunosuppression', label: 'Immunosuppression / long-term steroids', riskFactor: 'Infection and wound healing' },
  { id: 'thromboembolism', label: 'Previous DVT / pulmonary embolism', riskFactor: 'VTE risk' },
  { id: 'bleeding_disorder', label: 'Bleeding disorder', riskFactor: 'Surgical bleeding' },
  { id: 'peripheral_arterial', label: 'Peripheral arterial disease', riskFactor: 'Poor perfusion and healing' },
  { id: 'thyroid_disease', label: 'Thyroid disease' },
  { id: 'psychiatric', label: 'Mental health condition' },
  { id: 'obesity', label: 'Obesity (BMI ≥ 30)', riskFactor: 'Wound complications, VTE' },
  { id: 'malnutrition', label: 'Malnutrition / recent weight loss', riskFactor: 'Poor wound healing' },
  { id: 'keloid_tendency', label: 'Known keloid tendency', riskFactor: 'Scar outcome' },
];

export const PSH_QUESTIONS: Question[] = [
  { id: 'previous_surgery', label: 'Previous operations', type: 'select', options: ['None', 'Yes', 'Unknown'] },
  { id: 'operations', label: 'Which operations (and when)', type: 'textarea', showIf: { q: 'previous_surgery', in: ['Yes'] } },
  { id: 'anaesthesia_problems', label: 'Problems with anaesthesia', type: 'select', options: ['None', 'Yes — patient', 'Yes — family member', 'Unknown'] },
  { id: 'transfusions', label: 'Previous blood transfusion', type: 'select', options: ['None', 'Yes — no reaction', 'Yes — with reaction', 'Unknown'] },
  { id: 'wound_complications', label: 'Previous wound complications', type: 'multiselect', options: ['None', 'Infection', 'Breakdown', 'Keloid / hypertrophic scar', 'Delayed healing', 'Unknown'] },
  { id: 'implants', label: 'Implants / prostheses', type: 'select', options: ['None', 'Yes', 'Unknown'] },
];

export const FAMILY_QUESTIONS: Question[] = [
  { id: 'family_conditions', label: 'Conditions in close relatives', type: 'multiselect', options: ['Diabetes', 'Hypertension', 'Sickle cell disease', 'Cancer', 'Keloids', 'Bleeding disorder', 'Blood clots', 'Congenital anomalies', 'Heart disease', 'Stroke', 'None known', 'Unknown'] },
  { id: 'family_details', label: 'Details (relationship, age)', type: 'text' },
];

export const SOCIAL_QUESTIONS: Question[] = [
  { id: 'occupation', label: 'Occupation', type: 'select', options: ['Student', 'Trader', 'Farmer', 'Artisan / technician', 'Driver / rider', 'Civil servant', 'Health worker', 'Teacher', 'Unemployed', 'Retired', 'Child', 'Homemaker', 'Other'] },
  { id: 'smoking', label: 'Smoking / tobacco', type: 'select', options: ['Never', 'Current smoker', 'Ex-smoker', 'Snuff / chewing tobacco', 'Unknown'] },
  { id: 'smoking_amount', label: 'Pack-years (approx.)', type: 'select', options: ['< 5', '5–20', '> 20', 'Unknown'], showIf: { q: 'smoking', in: ['Current smoker', 'Ex-smoker'] } },
  { id: 'alcohol', label: 'Alcohol', type: 'select', options: ['None', 'Occasional', 'Regular — within safe limits', 'Heavy', 'Unknown'] },
  { id: 'substances', label: 'Other substances', type: 'multiselect', options: ['None', 'Cannabis', 'Tramadol / codeine misuse', 'Other drugs', 'Unknown'] },
  { id: 'mobility', label: 'Mobility', type: 'select', options: ['Independent', 'Walks with aid', 'Wheelchair', 'Bed-bound', 'Unknown'] },
  { id: 'living', label: 'Living situation', type: 'select', options: ['With family', 'Alone', 'Institution', 'Homeless', 'Unknown'] },
  { id: 'support', label: 'Support / carer available', type: 'select', options: ['Yes', 'Limited', 'No', 'Unknown'] },
  { id: 'payment', label: 'Payment for care', type: 'select', options: ['Out of pocket', 'Health insurance (NHIS)', 'Employer', 'Charity / support', 'Unknown'] },
  { id: 'diet', label: 'Diet / nutrition', type: 'select', options: ['Adequate', 'Poor intake', 'Vegetarian', 'Special diet', 'Unknown'] },
];

/** Shown for female patients aged 10–55 (adjustable by the clinician). */
export const GYN_QUESTIONS: Question[] = [
  { id: 'lmp', label: 'Last menstrual period (date)', type: 'text', placeholder: 'DD/MM/YYYY' },
  { id: 'pregnancy_possible', label: 'Could she be pregnant?', type: 'select', options: ['No', 'Yes', 'Pregnancy confirmed', 'Unknown'], redFlags: ['Yes', 'Pregnancy confirmed'] },
  { id: 'cycle', label: 'Menstrual cycle', type: 'select', options: ['Regular', 'Irregular', 'Amenorrhoea', 'Menopausal', 'Not yet started'] },
  { id: 'parity', label: 'Parity', type: 'select', options: ['P0', 'P1', 'P2', 'P3', 'P4', 'P5+', 'Unknown'] },
  { id: 'breastfeeding', label: 'Breastfeeding', type: 'select', options: YNU },
  { id: 'contraception', label: 'Contraception', type: 'select', options: ['None', 'Combined pill (oestrogen — VTE risk)', 'Progesterone only', 'Injectable', 'Implant', 'IUD', 'Condoms', 'Unknown'] },
  { id: 'gyn_problems', label: 'Gynaecological problems', type: 'multiselect', options: ['None', 'Heavy periods', 'Painful periods', 'Fibroids', 'Infertility', 'Abnormal discharge', 'Previous caesarean section', 'Unknown'] },
];

/** Review of systems: each symptom present / absent / not asked. */
export const ROS: Array<{ system: string; symptoms: string[] }> = [
  { system: 'General', symptoms: ['Fever', 'Weight loss', 'Night sweats', 'Fatigue', 'Loss of appetite'] },
  { system: 'Cardiovascular', symptoms: ['Chest pain', 'Palpitations', 'Leg swelling', 'Orthopnoea', 'Fainting'] },
  { system: 'Respiratory', symptoms: ['Cough', 'Breathlessness', 'Wheeze', 'Coughing blood'] },
  { system: 'Gastrointestinal', symptoms: ['Abdominal pain', 'Vomiting', 'Diarrhoea', 'Constipation', 'Blood in stool', 'Jaundice'] },
  { system: 'Genitourinary', symptoms: ['Painful urination', 'Frequency', 'Blood in urine', 'Reduced urine'] },
  { system: 'Neurological', symptoms: ['Headache', 'Weakness', 'Numbness', 'Fits', 'Visual disturbance'] },
  { system: 'Musculoskeletal', symptoms: ['Joint pain', 'Back pain', 'Stiffness'] },
  { system: 'Skin', symptoms: ['Rash', 'Itching', 'Other wounds', 'Easy bruising'] },
  { system: 'Psychological', symptoms: ['Low mood', 'Anxiety', 'Poor sleep'] },
];

export const DRUG_ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Topical', 'Inhaled', 'Rectal', 'Sublingual', 'Other'];
export const DRUG_FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'At night', 'Weekly', 'As needed', 'Stat', 'Other'];
export const DRUG_ADHERENCE = ['Taking as prescribed', 'Missing doses', 'Stopped by self', 'Not started', 'Unknown'];
/** Medicines that change surgical / wound management — prompted explicitly. */
export const HIGH_RISK_DRUG_CLASSES = ['Anticoagulant (warfarin, rivaroxaban, heparin)', 'Antiplatelet (aspirin, clopidogrel)', 'Corticosteroid', 'Immunosuppressant', 'Chemotherapy', 'Insulin', 'Herbal / traditional preparation', 'Oral contraceptive / HRT'];
export const COMMON_ALLERGENS = ['Penicillin', 'Amoxicillin / ampicillin', 'Cephalosporin', 'Sulfonamide (sulfa)', 'Chloroquine', 'Quinine', 'Artemether / lumefantrine', 'NSAID / aspirin', 'Diclofenac', 'Ibuprofen', 'Metronidazole', 'Ciprofloxacin', 'Tramadol', 'Codeine', 'Morphine', 'Pentazocine', 'Latex', 'Iodine / povidone-iodine', 'Chlorhexidine', 'Adhesive plaster', 'Contrast media', 'Local anaesthetic', 'Egg', 'Groundnut / peanut', 'Seafood', 'Other'];
export const ALLERGY_REACTIONS = ['Rash / itching', 'Hives (urticaria)', 'Swelling of face / lips (angioedema)', 'Difficulty breathing', 'Anaphylaxis', 'Stevens–Johnson / skin peeling', 'Vomiting / diarrhoea', 'Unknown', 'Other'];
export const ALLERGY_SEVERITY = ['Mild', 'Moderate', 'Severe / life-threatening', 'Unknown'];
export const ALLERGY_CERTAINTY = ['Confirmed', 'Likely', 'Uncertain / reported only'];
