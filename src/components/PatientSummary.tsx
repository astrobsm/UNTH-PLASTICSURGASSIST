import React, { useState, useEffect } from 'react';
import { unthPatientService, PatientSummary } from '../services/unthPatientService';
import { patientService, normalizeArrayField } from '../services/patientService';
import { apiClient } from '../services/apiClient';
import { db } from '../db/database';
import { format, differenceInDays, parseISO } from 'date-fns';

// ─── Specialty analysis types ───────────────────────────────────────────────

interface SpecialtyFlag {
  specialty: string;
  category: string;
  finding: string;
  severity: 'info' | 'warning' | 'critical';
  recommendation: string;
}

interface VitalTrend {
  parameter: string;
  current: number | string;
  previous?: number | string;
  direction: 'rising' | 'falling' | 'stable' | 'unknown';
  alert?: string;
}

interface ComprehensiveData {
  patient: any;
  admissions: any[];
  encounters: any[];
  wardRounds: any[];
  prescriptions: any[];
  labInvestigations: any[];
  labResults: any[];
  vitals: any[];
  treatmentPlans: any[];
  surgeries: any[];
  transfers: any[];
  riskAssessments: any[];
  woundCareRecords: any[];
}

// ─── Multi-specialty clinical analysis engine ───────────────────────────────

const SPECIALTY_RULES: {
  specialty: string;
  category: string;
  check: (data: ComprehensiveData) => SpecialtyFlag[];
}[] = [
  // ── Internal Medicine / General ──
  {
    specialty: 'Internal Medicine',
    category: 'General & Foundational',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const latestVitals = d.vitals[0];
      if (latestVitals) {
        if (latestVitals.temperature && latestVitals.temperature >= 38.5)
          flags.push({ specialty: 'Internal Medicine', category: 'General', finding: `Febrile: ${latestVitals.temperature}°C`, severity: 'warning', recommendation: 'Perform septic work-up: blood cultures x2, urinalysis, CRP/PCT. Consider empiric antibiotics if source identified.' });
        if (latestVitals.temperature && latestVitals.temperature >= 39.5)
          flags.push({ specialty: 'Infectious Disease', category: 'Internal Medicine Subspecialties', finding: `High fever: ${latestVitals.temperature}°C`, severity: 'critical', recommendation: 'Urgent sepsis workup. Consider ID consultation. Start broad-spectrum antibiotics after cultures obtained.' });
      }
      // Polypharmacy check
      if (d.prescriptions.length > 0) {
        const allMeds = extractAllMedications(d.prescriptions);
        if (allMeds.length >= 5)
          flags.push({ specialty: 'Internal Medicine', category: 'General', finding: `Polypharmacy: ${allMeds.length} active medications`, severity: 'warning', recommendation: 'Review medication list for interactions, duplications, and necessity. Consider pharmacy consultation.' });
      }
      return flags;
    }
  },

  // ── Cardiology ──
  {
    specialty: 'Cardiology',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const v = d.vitals[0];
      if (v) {
        if (v.pulse && v.pulse > 120)
          flags.push({ specialty: 'Cardiology', category: 'Cardiovascular', finding: `Tachycardia: ${v.pulse} bpm`, severity: 'warning', recommendation: 'Obtain 12-lead ECG. Check electrolytes, thyroid function. Assess for pain, hypovolemia, sepsis, PE. Consider telemetry monitoring.' });
        if (v.pulse && v.pulse < 50)
          flags.push({ specialty: 'Cardiology', category: 'Cardiovascular', finding: `Bradycardia: ${v.pulse} bpm`, severity: 'warning', recommendation: 'Check for beta-blocker or calcium channel blocker use. 12-lead ECG to rule out heart block. Check electrolytes (K+, Ca2+).' });
        if (v.bp_systolic && v.bp_systolic >= 180)
          flags.push({ specialty: 'Cardiology', category: 'Cardiovascular', finding: `Hypertensive crisis: ${v.bp_systolic}/${v.bp_diastolic} mmHg`, severity: 'critical', recommendation: 'Assess for end-organ damage (troponin, renal function, fundoscopy). Consider IV antihypertensives. Urgent cardiology review.' });
        if (v.bp_systolic && v.bp_systolic < 90)
          flags.push({ specialty: 'Cardiology', category: 'Cardiovascular', finding: `Hypotension: ${v.bp_systolic}/${v.bp_diastolic} mmHg`, severity: 'critical', recommendation: 'Fluid resuscitation (crystalloid bolus). Assess for hemorrhage, sepsis, cardiogenic shock. Consider vasopressors if unresponsive to fluids.' });
        if (v.bp_systolic && v.bp_systolic >= 140 && v.bp_systolic < 180)
          flags.push({ specialty: 'Cardiology', category: 'Cardiovascular', finding: `Hypertension: ${v.bp_systolic}/${v.bp_diastolic} mmHg`, severity: 'info', recommendation: 'Optimize antihypertensive therapy. Ensure adequate pain control. Monitor trend. Target BP < 140/90 perioperatively.' });
      }
      return flags;
    }
  },

  // ── Pulmonology / Respiratory ──
  {
    specialty: 'Pulmonology',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const v = d.vitals[0];
      if (v) {
        if (v.spo2 && v.spo2 < 94)
          flags.push({ specialty: 'Pulmonology', category: 'Respiratory', finding: `Hypoxemia: SpO2 ${v.spo2}%`, severity: 'critical', recommendation: 'Initiate supplemental O2 (target SpO2 >= 94%). Obtain ABG. CXR to evaluate for pneumonia, effusion, atelectasis, PE. Consider CTPA if PE suspected.' });
        if (v.spo2 && v.spo2 >= 94 && v.spo2 < 96)
          flags.push({ specialty: 'Pulmonology', category: 'Respiratory', finding: `Borderline SpO2: ${v.spo2}%`, severity: 'warning', recommendation: 'Monitor closely. Encourage deep breathing exercises and incentive spirometry. Consider CXR if post-operative.' });
        if (v.respiratory_rate && v.respiratory_rate > 24)
          flags.push({ specialty: 'Pulmonology', category: 'Respiratory', finding: `Tachypnea: RR ${v.respiratory_rate}/min`, severity: 'warning', recommendation: 'Assess for respiratory distress. Check SpO2, auscultate chest. Consider ABG, CXR. Rule out PE, pneumonia, pain-related splinting.' });
      }
      return flags;
    }
  },

  // ── Nephrology ──
  {
    specialty: 'Nephrology',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const labText = getAllLabText(d.labInvestigations, d.labResults);
      if (/creatinine/i.test(labText) && /high|abnormal|elevated/i.test(labText))
        flags.push({ specialty: 'Nephrology', category: 'Renal', finding: 'Elevated creatinine detected', severity: 'warning', recommendation: 'Assess fluid status. Avoid nephrotoxic drugs (NSAIDs, aminoglycosides). Renal dose-adjust medications. Consider nephrology consultation if acute kidney injury.' });
      if (/potassium|k\+/i.test(labText) && /high|abnormal|critical/i.test(labText))
        flags.push({ specialty: 'Nephrology', category: 'Renal', finding: 'Hyperkalemia detected', severity: 'critical', recommendation: 'Urgent ECG. If K+ > 6.0: IV calcium gluconate, insulin + dextrose, nebulized salbutamol. Hold ACEi/ARBs, potassium-sparing diuretics.' });
      return flags;
    }
  },

  // ── Endocrinology ──
  {
    specialty: 'Endocrinology',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      const labText = getAllLabText(d.labInvestigations, d.labResults);
      if (/diabet|DM|blood sugar|glucose|HbA1c/i.test(allText))
        flags.push({ specialty: 'Endocrinology', category: 'Metabolic', finding: 'Diabetes mellitus noted', severity: 'info', recommendation: 'Perioperative glucose monitoring (QDS). Target glucose 6-10 mmol/L. Adjust insulin/OHAs around surgery. Check HbA1c if not done in 3 months. Diabetic foot assessment.' });
      if (/thyroid|hypothyroid|hyperthyroid|TSH/i.test(allText))
        flags.push({ specialty: 'Endocrinology', category: 'Metabolic', finding: 'Thyroid disorder noted', severity: 'info', recommendation: 'Ensure thyroid function is optimized pre-operatively. Continue thyroid medications perioperatively. TSH/FT4 if not checked recently.' });
      if (/glucose/i.test(labText) && /high|abnormal|critical/i.test(labText))
        flags.push({ specialty: 'Endocrinology', category: 'Metabolic', finding: 'Elevated blood glucose', severity: 'warning', recommendation: 'Sliding scale insulin. Consider endocrine review for uncontrolled diabetes. Check ketones if glucose > 14 mmol/L.' });
      return flags;
    }
  },

  // ── Hematology ──
  {
    specialty: 'Hematology',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const labText = getAllLabText(d.labInvestigations, d.labResults);
      const allText = getAllClinicalText(d);
      if (/haemoglobin|hemoglobin|hb|PCV/i.test(labText) && /low|abnormal|critical/i.test(labText))
        flags.push({ specialty: 'Hematology', category: 'Blood', finding: 'Anemia detected', severity: 'warning', recommendation: 'Check Hb level. If Hb < 7 g/dL or symptomatic: consider transfusion. G&S/cross-match pre-surgery. Iron studies, reticulocyte count. For chronic leg ulcer: nutritional assessment.' });
      if (/sickle|SS|SC|genotype/i.test(allText))
        flags.push({ specialty: 'Hematology', category: 'Blood', finding: 'Sickle cell disease/trait noted', severity: 'warning', recommendation: 'Perioperative hydration. Avoid hypothermia, hypoxia, acidosis. Check Hb electrophoresis if not done. Pre-operative exchange transfusion if major surgery and HbSS. Hematology review.' });
      if (/platelet|thrombocytop/i.test(labText) && /low|abnormal|critical/i.test(labText))
        flags.push({ specialty: 'Hematology', category: 'Blood', finding: 'Thrombocytopenia detected', severity: 'warning', recommendation: 'Surgical bleeding risk if platelets < 50,000. Consider platelet transfusion pre-operatively. Check coagulation profile. Hematology consultation.' });
      if (/INR|PT|APTT|coagul/i.test(labText) && /high|abnormal|prolonged/i.test(labText))
        flags.push({ specialty: 'Hematology', category: 'Blood', finding: 'Coagulopathy detected', severity: 'warning', recommendation: 'Hold anticoagulants pre-operatively as per protocol. Vitamin K if warfarin. Fresh frozen plasma if urgent surgery needed. Check liver function.' });
      return flags;
    }
  },

  // ── Plastic & Reconstructive Surgery ──
  {
    specialty: 'Plastic & Reconstructive Surgery',
    category: 'Subspecialized Surgery',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/wound|ulcer|flap|graft|debridement|burn|contracture|keloid/i.test(allText))
        flags.push({ specialty: 'Plastic Surgery', category: 'Wound Management', finding: 'Wound/ulcer/reconstructive case', severity: 'info', recommendation: 'Serial wound assessment with measurements and photography. Optimize nutrition (albumin > 30, Hb > 10). Wound bed preparation. Consider VAC therapy for chronic wounds. Tissue culture before antibiotics.' });
      if (/chronic.*ulcer|chronic.*wound/i.test(allText))
        flags.push({ specialty: 'Plastic Surgery', category: 'Wound Management', finding: 'Chronic wound identified', severity: 'warning', recommendation: 'Biopsy wound edge to rule out Marjolin ulcer (squamous cell carcinoma). Optimize vascular status (ABPI for leg ulcers). Nutritional supplementation. Compression therapy if venous etiology. Address underlying cause.' });
      if (/RTA|trauma|accident|crush|avulsion|degloving/i.test(allText))
        flags.push({ specialty: 'Plastic Surgery', category: 'Trauma', finding: 'Traumatic injury', severity: 'info', recommendation: 'Thorough wound exploration. Assess neurovascular status distally. Tetanus prophylaxis. Serial debridement as needed. Plan definitive reconstruction after wound stabilization.' });
      if (/cleft|lip|palate|craniofacial/i.test(allText))
        flags.push({ specialty: 'Plastic Surgery', category: 'Craniofacial', finding: 'Craniofacial/cleft condition', severity: 'info', recommendation: 'Multidisciplinary team approach. Ensure adequate nutrition and weight. Timing per protocol (lip repair ~3mo, palate repair ~9-12mo). Pre-op Hb, G&S.' });
      if (/hand|tendon|nerve.*repair|replant|finger|thumb/i.test(allText))
        flags.push({ specialty: 'Plastic Surgery', category: 'Hand Surgery', finding: 'Hand/tendon/nerve injury', severity: 'info', recommendation: 'Detailed neurovascular examination. X-ray for bony injury. Early surgical exploration within 6 hours for sharp injuries. Tetanus prophylaxis. Hand therapy referral post-op.' });
      return flags;
    }
  },

  // ── General Surgery ──
  {
    specialty: 'General Surgery',
    category: 'Surgical Specialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/abdomen|abdominal|appendic|cholecyst|hernia|bowel|intestin/i.test(allText))
        flags.push({ specialty: 'General Surgery', category: 'Abdominal', finding: 'Abdominal/GI surgical condition', severity: 'info', recommendation: 'Abdominal examination. Erect CXR if perforation suspected. USS abdomen. LFTs, amylase, FBC. NPO if surgical abdomen. NG tube if obstructed.' });
      return flags;
    }
  },

  // ── Orthopedic Surgery ──
  {
    specialty: 'Orthopedic Surgery',
    category: 'Subspecialized Surgery',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/fracture|dislocation|orthopaedic|orthopedic|bone/i.test(allText))
        flags.push({ specialty: 'Orthopedics', category: 'Musculoskeletal', finding: 'Musculoskeletal injury noted', severity: 'info', recommendation: 'X-ray of affected area. Assess neurovascular status distal to injury. Immobilization. Orthopedic consultation if fracture confirmed.' });
      return flags;
    }
  },

  // ── Anesthesiology ──
  {
    specialty: 'Anesthesiology',
    category: 'Anaesthesia & Critical Care',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      const age = extractAge(d.patient);
      if (d.surgeries.length > 0 || /surgery|operation|procedure|theatre/i.test(allText)) {
        flags.push({ specialty: 'Anesthesiology', category: 'Perioperative', finding: 'Surgical case - anesthetic assessment needed', severity: 'info', recommendation: 'Pre-anesthetic assessment: ASA classification, airway assessment (Mallampati), NPO status, previous anesthetic history. Optimize comorbidities. ECG if > 50 yrs or cardiac history.' });
        if (age && age >= 70)
          flags.push({ specialty: 'Anesthesiology', category: 'Perioperative', finding: `Elderly patient (${age} yrs) for surgery`, severity: 'warning', recommendation: 'Geriatric anesthetic considerations: careful fluid management, reduced drug doses, regional anesthesia preferred, post-op delirium prevention, early mobilization plan.' });
      }
      if (/allerg/i.test(allText))
        flags.push({ specialty: 'Anesthesiology', category: 'Safety', finding: 'Allergies documented', severity: 'info', recommendation: 'Verify all drug allergies. Document in anesthetic chart. Alert theatre team. Have emergency drugs available.' });
      return flags;
    }
  },

  // ── DVT / Vascular ──
  {
    specialty: 'Vascular Surgery',
    category: 'Vascular & Specialized Fields',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/DVT|deep vein|thrombosis|embolism|PE|anticoagul|clexane|enoxaparin|heparin/i.test(allText))
        flags.push({ specialty: 'Vascular Surgery', category: 'Thromboprophylaxis', finding: 'DVT/PE risk or history', severity: 'warning', recommendation: 'VTE risk assessment. Mechanical prophylaxis (TED stockings, IPC). Pharmacological prophylaxis (LMWH) unless contraindicated. Early mobilization. Doppler USS if clinical suspicion of DVT.' });
      if (/peripheral.*vascular|PVD|claudication|ABPI|gangrene|ischaemi/i.test(allText))
        flags.push({ specialty: 'Vascular Surgery', category: 'Peripheral Vascular', finding: 'Peripheral vascular disease', severity: 'warning', recommendation: 'ABPI measurement. Vascular surgery consultation. Optimize cardiovascular risk factors. Consider angiography. Wound healing may be impaired.' });
      return flags;
    }
  },

  // ── Geriatrics ──
  {
    specialty: 'Geriatrics',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const age = extractAge(d.patient);
      if (age && age >= 65) {
        flags.push({ specialty: 'Geriatrics', category: 'Elderly Care', finding: `Elderly patient: ${age} years old`, severity: 'info', recommendation: 'Comprehensive geriatric assessment. Fall risk evaluation. Cognitive screening (MMSE/MoCA). Nutritional assessment (MNA). Medication review for potentially inappropriate medications (Beers criteria). Pressure injury prevention.' });
        if (age >= 80)
          flags.push({ specialty: 'Geriatrics', category: 'Elderly Care', finding: `Very elderly patient: ${age} years`, severity: 'warning', recommendation: 'Enhanced recovery protocols. Frailty screening (Clinical Frailty Scale). Early mobilization. Delirium prevention bundle. Goals of care discussion. DVT prophylaxis. Nutrition optimization.' });
      }
      return flags;
    }
  },

  // ── Pediatrics ──
  {
    specialty: 'Pediatrics',
    category: 'Pediatric Medicine',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const age = extractAge(d.patient);
      if (age !== null && age < 18) {
        flags.push({ specialty: 'Pediatrics', category: 'Pediatric', finding: `Pediatric patient: ${age} years old`, severity: 'info', recommendation: 'Age-appropriate assessments. Weight-based dosing for all medications. Pediatric vital sign reference ranges. Parental consent. Child-friendly environment. EMLA cream for procedures.' });
        if (age < 2)
          flags.push({ specialty: 'Pediatrics', category: 'Neonatal/Infant', finding: `Infant patient: ${age} years`, severity: 'warning', recommendation: 'Neonatal/infant considerations: thermoregulation, fluid balance, glucose monitoring, weight-based calculations, dedicated pediatric anesthesia.' });
      }
      return flags;
    }
  },

  // ── Infectious Disease ──
  {
    specialty: 'Infectious Disease',
    category: 'Internal Medicine Subspecialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/HIV|retroviral|ARV|hepatitis|HBV|HCV|TB|tuberculosis/i.test(allText))
        flags.push({ specialty: 'Infectious Disease', category: 'Infection Control', finding: 'Infectious disease noted', severity: 'warning', recommendation: 'Universal precautions. Check viral load and CD4 if HIV+. Screen for TB. Hepatitis serology. Infection control measures. Consider ID team review. Post-exposure prophylaxis protocol awareness.' });
      if (/sepsis|septic|bacteremia|SIRS/i.test(allText))
        flags.push({ specialty: 'Infectious Disease', category: 'Sepsis', finding: 'Sepsis or systemic infection', severity: 'critical', recommendation: 'Sepsis-6 bundle: blood cultures, lactate, IV antibiotics within 1hr, IV fluids, urine output monitoring, O2. Consider ICU referral if severe sepsis. Source control.' });
      if (/wound.*infection|infected.*wound|cellulitis|abscess|pus|purulent/i.test(allText))
        flags.push({ specialty: 'Infectious Disease', category: 'Wound Infection', finding: 'Wound infection noted', severity: 'warning', recommendation: 'Wound swab for M/C/S before starting antibiotics. Incision and drainage if fluctuant. Empiric antibiotics based on local antibiogram. Reassess after culture results.' });
      return flags;
    }
  },

  // ── Psychiatry / Mental Health ──
  {
    specialty: 'Psychiatry',
    category: 'Neurological & Mental Health',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/aggressi|agitat|combative|confused|delirium|psychos|psych|hallucin/i.test(allText))
        flags.push({ specialty: 'Psychiatry', category: 'Mental Health', finding: 'Behavioral/psychiatric concern noted', severity: 'warning', recommendation: 'Assess for delirium (CAM tool). Rule out organic causes (infection, metabolic, medication-related). Ensure patient and staff safety. Consider psychiatric liaison. Avoid physical restraints where possible.' });
      if (/suicid|self.harm|overdose/i.test(allText))
        flags.push({ specialty: 'Psychiatry', category: 'Mental Health', finding: 'Self-harm/suicidal ideation', severity: 'critical', recommendation: 'Urgent psychiatric assessment. 1:1 nursing observation. Remove access to means. Supportive communication. Inform consultant and next of kin.' });
      return flags;
    }
  },

  // ── Neurology ──
  {
    specialty: 'Neurology',
    category: 'Neurological & Mental Health',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/stroke|CVA|hemiplegia|hemiparesis|neurological deficit|seizure|epilepsy/i.test(allText))
        flags.push({ specialty: 'Neurology', category: 'Neurological', finding: 'Neurological condition noted', severity: 'warning', recommendation: 'Neurological examination including GCS. CT brain if acute. Assess swallowing (SALT referral). DVT prophylaxis. Neurology review. Anticonvulsant levels if on medication.' });
      if (/GCS|glasgow|conscious.*level|LOC|unrespons/i.test(allText))
        flags.push({ specialty: 'Neurology', category: 'Consciousness', finding: 'Altered consciousness/GCS concern', severity: 'warning', recommendation: 'Serial GCS monitoring. CT brain. Check glucose, electrolytes, blood gas. Assess for raised ICP. Neurosurgical consultation if GCS dropping.' });
      return flags;
    }
  },

  // ── Nutrition / Rehabilitation ──
  {
    specialty: 'Physical Medicine & Rehabilitation',
    category: 'Rehabilitation & Supportive Care',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      const labText = getAllLabText(d.labInvestigations, d.labResults);
      if (/malnutri|albumin|wasting|cachexia|weight loss|BMI/i.test(allText) || (/albumin/i.test(labText) && /low|abnormal/i.test(labText)))
        flags.push({ specialty: 'Nutrition/Rehabilitation', category: 'Supportive Care', finding: 'Nutritional concern', severity: 'warning', recommendation: 'Nutritional assessment (MUST score). Check albumin, pre-albumin. High protein diet. Consider nutritional supplements. Dietitian referral. Wound healing requires adequate nutrition.' });
      if (/immobil|bed.?bound|pressure.*sore|pressure.*ulcer|decubitus/i.test(allText))
        flags.push({ specialty: 'Physical Medicine', category: 'Rehabilitation', finding: 'Immobility/pressure injury risk', severity: 'warning', recommendation: 'Pressure area care: 2-hourly turns, pressure-relieving mattress. Waterlow/Braden score. Early mobilization with physiotherapy. Occupational therapy for functional assessment.' });
      return flags;
    }
  },

  // ── Pain Medicine ──
  {
    specialty: 'Pain Medicine',
    category: 'Anaesthesia & Critical Care',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/pain|analges|opioid|morphine|tramadol|codeine|paracetamol/i.test(allText))
        flags.push({ specialty: 'Pain Medicine', category: 'Pain Management', finding: 'Pain management consideration', severity: 'info', recommendation: 'WHO pain ladder approach. Regular paracetamol + NSAID (if no contraindication). Opioids for severe pain. Document pain scores. Multimodal analgesia perioperatively. Consider nerve blocks for surgical patients.' });
      return flags;
    }
  },

  // ── Dermatology ──
  {
    specialty: 'Dermatology',
    category: 'Dermatologic & Sensory',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/skin.*lesion|melanoma|BCC|SCC|skin.*cancer|nevus|mole|dermatitis|eczema|psoriasis/i.test(allText))
        flags.push({ specialty: 'Dermatology', category: 'Skin', finding: 'Dermatological condition noted', severity: 'info', recommendation: 'Dermatological assessment. Consider biopsy for suspicious lesions. Dermoscopy if available. Histopathology for excised specimens. Sun protection advice.' });
      return flags;
    }
  },

  // ── Oncology ──
  {
    specialty: 'Oncology',
    category: 'Oncological & Palliative',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/cancer|malignant|tumour|tumor|carcinoma|lymphoma|leukemia|metast|oncol|chemo|radiother/i.test(allText))
        flags.push({ specialty: 'Oncology', category: 'Cancer Care', finding: 'Oncological condition noted', severity: 'warning', recommendation: 'Multidisciplinary team (MDT) discussion. Staging investigations. Histopathology review. Consider oncology consultation. Nutritional support. Pain management. Psychosocial support.' });
      if (/palliati|end.of.life|terminal|comfort.care|hospice/i.test(allText))
        flags.push({ specialty: 'Palliative Care', category: 'End of Life', finding: 'Palliative/end-of-life care', severity: 'info', recommendation: 'Goals of care discussion with patient and family. Symptom management (pain, nausea, dyspnea). DNACPR discussion if appropriate. Palliative care team referral. Advance care planning.' });
      return flags;
    }
  },

  // ── Ophthalmology ──
  {
    specialty: 'Ophthalmology',
    category: 'Dermatologic & Sensory',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/eye|ocular|orbital|eyelid|blephar|periorbital|vision|visual/i.test(allText))
        flags.push({ specialty: 'Ophthalmology', category: 'Eye', finding: 'Ocular/periorbital condition', severity: 'info', recommendation: 'Ophthalmology assessment. Visual acuity check. Eye protection in periorbital procedures. Fundoscopy if hypertensive/diabetic.' });
      return flags;
    }
  },

  // ── ENT ──
  {
    specialty: 'Otolaryngology (ENT)',
    category: 'Head & Neck',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/airway|tracheostomy|neck.*mass|parotid|submandibular|facial.*nerve/i.test(allText))
        flags.push({ specialty: 'ENT', category: 'Head & Neck', finding: 'Head & neck/airway concern', severity: 'info', recommendation: 'Airway assessment. ENT consultation if airway compromise. CT neck if mass lesion. Fine needle aspiration if indicated. Facial nerve assessment for parotid lesions.' });
      return flags;
    }
  },

  // ── Obstetrics & Gynecology ──
  {
    specialty: 'Obstetrics & Gynecology',
    category: 'Women\'s Health',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      const gender = (d.patient.sex || d.patient.gender || '').toLowerCase();
      if (gender === 'female' || gender === 'f') {
        if (/pregnan|gravid|trimester|antenatal|obstetric/i.test(allText))
          flags.push({ specialty: 'Obstetrics', category: 'Pregnancy', finding: 'Pregnancy noted', severity: 'critical', recommendation: 'Obstetric team involvement essential. Avoid teratogenic medications. Positioning considerations (left lateral tilt). Fetal monitoring. Radiation avoidance. Thromboprophylaxis per obstetric protocol.' });
        const age = extractAge(d.patient);
        if (age && age >= 15 && age <= 50 && (d.surgeries.length > 0 || /surgery|operation/i.test(allText)))
          flags.push({ specialty: 'Obstetrics', category: 'Reproductive', finding: 'Woman of reproductive age for surgery', severity: 'info', recommendation: 'Pregnancy test (urine beta-hCG) before surgery/anesthesia/radiology. Document LMP. Contraception counseling if teratogenic drugs prescribed.' });
      }
      return flags;
    }
  },

  // ── Urology ──
  {
    specialty: 'Urology',
    category: 'Surgical Specialties',
    check: (d) => {
      const flags: SpecialtyFlag[] = [];
      const allText = getAllClinicalText(d);
      if (/catheter|urinary|urine output|oliguria|anuria|retention/i.test(allText))
        flags.push({ specialty: 'Urology', category: 'Urinary', finding: 'Urinary concern noted', severity: 'info', recommendation: 'Monitor urine output (target >= 0.5 ml/kg/hr). Fluid balance chart. Urinalysis. Consider catheterization if retention. Review nephrotoxic medications.' });
      return flags;
    }
  },
];

// ─── Helper functions ───────────────────────────────────────────────────────

function extractAge(patient: any): number | null {
  const dob = patient?.date_of_birth || patient?.dob;
  if (!dob) return null;
  try {
    const birthDate = typeof dob === 'string' ? parseISO(dob) : new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  } catch { return null; }
}

function extractAllMedications(prescriptions: any[]): string[] {
  const meds: string[] = [];
  prescriptions.forEach(p => {
    if (p.prescriptions && Array.isArray(p.prescriptions)) {
      p.prescriptions.forEach((med: any) => {
        const name = med.medication || med.medication_name || med.name || '';
        if (name) meds.push(`${name} ${med.dosage || ''} ${med.route || ''} ${med.frequency || ''}`.trim());
      });
    } else if (p.medication_name || p.medication) {
      const name = p.medication_name || p.medication;
      meds.push(`${name} ${p.dosage || ''} ${p.route || ''} ${p.frequency || ''}`.trim());
    }
  });
  return [...new Set(meds)];
}

function getAllClinicalText(d: ComprehensiveData): string {
  const parts: string[] = [];
  // Patient info
  const p = d.patient;
  if (p) {
    parts.push(p.primary_diagnosis || '', p.diagnosis || '', p.medical_history || '', p.surgical_history || '',
      p.allergies || '', p.chronic_conditions || '', p.current_medications || '', p.presenting_complaint || '',
      p.comorbidities || '', p.blood_group || '', p.genotype || '');
  }
  // Admissions
  d.admissions.forEach(a => parts.push(a.admitting_diagnosis || '', a.provisional_diagnosis || '', a.presenting_complaint || '',
    a.reasons_for_admission || '', a.ward_location || '', a.clinical_notes || ''));
  // Encounters
  d.encounters.forEach(e => {
    let soap = e.soap;
    if (typeof soap === 'string') try { soap = JSON.parse(soap); } catch {}
    if (typeof soap === 'string') try { soap = JSON.parse(soap); } catch {}
    if (typeof soap === 'object' && soap) {
      parts.push(soap.subjective || '', soap.objective || '', soap.assessment || '', soap.plan || '', soap.note || '');
    }
    parts.push(e.content || '', e.notes || '', e.note || '', e.presenting_complaint || '');
  });
  // Ward rounds
  d.wardRounds.forEach(r => {
    const findings = parseFindingsObj(r);
    parts.push(findings.chief_complaint || r.chief_complaint || '', findings.clinical_notes || r.clinical_notes || '',
      findings.examination_findings || '', findings.assessment_notes || '', findings.wound_notes || '',
      findings.complications || '', r.plan || '', findings.follow_up_plan || '',
      findings.discharge_planning || '', findings.consultation_requests || '');
  });
  // Treatment plans
  d.treatmentPlans.forEach(tp => parts.push(tp.diagnosis || '', tp.plan || '', tp.goals || ''));
  // Surgeries
  d.surgeries.forEach(s => parts.push(s.procedure_name || '', s.surgery_type || '', s.anaesthesia_type || '',
    s.pre_op_notes || '', s.post_op_notes || '', s.intra_op_notes || ''));
  // Risk assessments
  d.riskAssessments.forEach(r => parts.push(r.risk_type || '', r.risk_level || '', r.notes || ''));
  return parts.filter(Boolean).join(' ');
}

function getAllLabText(labInvestigations: any[], labResults: any[]): string {
  const parts: string[] = [];
  labInvestigations.forEach(l => parts.push(l.test_name || '', l.investigation_name || '', l.investigation_type || '',
    l.status || '', l.result || '', l.result_value || '', l.abnormal_flag || '', l.reference_range || ''));
  labResults.forEach(r => parts.push(r.test_name || '', r.result || '', r.result_value || '',
    r.status || '', r.abnormal_flag || '', r.reference_range || ''));
  return parts.filter(Boolean).join(' ');
}

function parseFindingsObj(round: any): any {
  let findings: any = {};
  try {
    if (typeof round.findings === 'string') findings = JSON.parse(round.findings);
    else if (round.findings && typeof round.findings === 'object') findings = round.findings;
  } catch {}
  return findings;
}

// ─── Comprehensive data fetcher ─────────────────────────────────────────────

async function fetchComprehensivePatientData(patientId: string): Promise<ComprehensiveData> {
  const patient = await patientService.getPatient(patientId);
  if (!patient) throw new Error('Patient not found');

  const pid = typeof patient.id === 'string' ? parseInt(patient.id, 10) : patient.id;
  const pidStr = String(patient.id);

  // Parallel fetch from server + local DB
  const [
    admissions, treatmentPlans, prescriptions, labInvestigations, labResults,
    surgeries, transfers, wardRoundsData, encounters, vitals, riskAssessments, woundCareRecords
  ] = await Promise.all([
    fetchWithFallback(() => apiClient.getAdmissions(undefined, pidStr), () => dbQuery(db.admissions, 'patient_id', pid, pidStr)),
    fetchWithFallback(() => apiClient.getTreatmentPlans(pidStr), () => dbQuery(db.treatment_plans, 'patient_id', pid, pidStr)),
    fetchWithFallback(() => apiClient.getPrescriptions(pidStr), () => dbQuery(db.prescriptions, 'patient_id', pid, pidStr)),
    fetchWithFallback(() => apiClient.getLabInvestigations(pidStr), () => dbQuery(db.lab_investigations, 'patient_id', pid, pidStr)),
    fetchWithFallback(async () => { const r = await apiClient.get(`/lab-results?patientId=${pidStr}`); return r?.labResults || r?.results || []; }, () => dbQuery(db.lab_results, 'patient_id', pid, pidStr)),
    fetchWithFallback(() => apiClient.getSurgeries(pidStr), () => dbQuery(db.surgery_bookings, 'patient_id', pid, pidStr)),
    fetchWithFallback(() => apiClient.getPatientTransfers(pidStr), async () => []),
    fetchWithFallback(() => apiClient.getWardRoundsByPatient(pidStr), () => db.ward_rounds.filter(r => r.patient_id === pidStr || r.patient_id === pid).toArray().catch(() => [])),
    fetchWithFallback(async () => { const r = await apiClient.get(`/progress-notes?patientId=${pidStr}`); return Array.isArray(r) ? r : (r?.notes || r?.progressNotes || r?.data || []); }, () => dbQuery(db.progress_notes, 'patient_id', pid, pidStr)),
    fetchWithFallback(async () => { const r = await apiClient.get(`/vital-signs?patientId=${pidStr}`); return r?.vitalSigns || r?.vitals || []; }, async () => []),
    fetchWithFallback(async () => { try { return await apiClient.getRiskAssessments(pidStr); } catch { return []; } }, async () => []),
    fetchWithFallback(async () => [], () => dbQuery(db.wound_care, 'patient_id', pid, pidStr)),
  ]);

  // Sort vitals by date descending
  const sortedVitals = (Array.isArray(vitals) ? vitals : []).sort(
    (a: any, b: any) => new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime()
  );

  return {
    patient,
    admissions: normalizeArr(admissions),
    encounters: normalizeArr(encounters),
    wardRounds: normalizeArr(wardRoundsData),
    prescriptions: normalizeArr(prescriptions),
    labInvestigations: normalizeArr(labInvestigations),
    labResults: normalizeArr(labResults),
    vitals: sortedVitals,
    treatmentPlans: normalizeArr(treatmentPlans),
    surgeries: normalizeArr(surgeries),
    transfers: normalizeArr(transfers),
    riskAssessments: normalizeArr(riskAssessments),
    woundCareRecords: normalizeArr(woundCareRecords),
  };
}

function normalizeArr(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

async function fetchWithFallback(serverFn: () => Promise<any>, localFn: () => Promise<any>): Promise<any> {
  if (navigator.onLine) {
    try {
      const result = await serverFn();
      if (result && (Array.isArray(result) ? result.length > 0 : true)) return result;
    } catch {}
  }
  try { return await localFn(); } catch { return []; }
}

async function dbQuery(table: any, field: string, numericId: number, stringId: string): Promise<any[]> {
  if (!table) return [];
  try {
    let results = await table.where(field).equals(numericId).toArray();
    if (results.length === 0) results = await table.where(field).equals(stringId).toArray();
    return results;
  } catch { return []; }
}

// ─── Summary generation ─────────────────────────────────────────────────────

function generateComprehensiveSummary(data: ComprehensiveData, patientId: string): PatientSummary & { specialtyFlags: SpecialtyFlag[]; vitalTrends: VitalTrend[]; recommendations: string[] } {
  const { patient, admissions, encounters, wardRounds, prescriptions, labInvestigations, labResults, vitals, treatmentPlans, surgeries } = data;
  const age = extractAge(patient);
  const patientName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
  const gender = patient.sex || patient.gender || 'Unknown';
  const hospitalNumber = patient.hospital_number || '';

  // ── Admission info ──
  const sortedAdmissions = [...admissions].sort((a, b) => new Date(b.admission_date || b.created_at || 0).getTime() - new Date(a.admission_date || a.created_at || 0).getTime());
  const latestAdmission = sortedAdmissions[0];
  const admissionDate = latestAdmission?.admission_date || latestAdmission?.created_at || patient.created_at;
  const ward = latestAdmission?.ward_location || latestAdmission?.ward || patient.ward || 'Not assigned';
  const los = admissionDate ? differenceInDays(new Date(), new Date(admissionDate)) : 0;

  // ── Diagnoses ──
  const diagnosisSources: string[] = [];
  if (patient.primary_diagnosis) diagnosisSources.push(patient.primary_diagnosis);
  if (patient.diagnosis) diagnosisSources.push(patient.diagnosis);
  admissions.forEach(a => { if (a.admitting_diagnosis) diagnosisSources.push(a.admitting_diagnosis); if (a.provisional_diagnosis) diagnosisSources.push(a.provisional_diagnosis); });
  treatmentPlans.forEach(tp => { if (tp.diagnosis) diagnosisSources.push(tp.diagnosis); });
  const uniqueDiagnoses = [...new Set(diagnosisSources.filter(Boolean))];
  const primaryDiagnosis = uniqueDiagnoses[0] || 'Not specified';

  // ── Allergies ──
  const allergies = normalizeArrayField(patient.allergies);
  const comorbidities = patient.chronic_conditions || patient.comorbidities || patient.medical_history || '';

  // ── Build Medical Scribe Summary ──
  const line = '─'.repeat(60);
  let content = '';

  // ── Header ──
  content += `${line}\n`;
  content += `**MEDICAL SCRIBE SUMMARY**\n`;
  content += `**Date:** ${format(new Date(), 'dd MMMM yyyy, HH:mm')}  |  **Institution:** UNTH Plastic Surgery Unit\n`;
  content += `${line}\n\n`;

  // ── Patient Demographics ──
  content += `**PATIENT IDENTIFICATION**\n`;
  content += `  Name: ${patientName}\n`;
  content += `  Hospital No: ${hospitalNumber}\n`;
  content += `  Age/Sex: ${age ? `${age} years` : 'Unknown'} / ${gender}\n`;
  if (patient.blood_group) content += `  Blood Group: ${patient.blood_group}${patient.genotype ? ` | Genotype: ${patient.genotype}` : ''}\n`;
  content += `  Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'NKDA (No Known Drug Allergies)'}\n`;
  if (comorbidities) content += `  Comorbidities: ${comorbidities}\n`;
  content += '\n';

  // ── Admission Details ──
  if (latestAdmission) {
    content += `**ADMISSION DETAILS**\n`;
    content += `  Ward: ${ward}\n`;
    if (admissionDate) content += `  Date of Admission: ${format(new Date(admissionDate), 'dd MMM yyyy')}\n`;
    content += `  Length of Stay: Day ${los}\n`;
    if (latestAdmission.admitting_diagnosis) content += `  Admitting Diagnosis: ${latestAdmission.admitting_diagnosis}\n`;
    if (latestAdmission.admitting_doctor) content += `  Admitting Doctor: ${latestAdmission.admitting_doctor}\n`;
    content += '\n';
  }

  // ── Diagnoses ──
  content += `**DIAGNOSIS**\n`;
  if (uniqueDiagnoses.length > 0) {
    uniqueDiagnoses.forEach((dx, i) => {
      content += `  ${i === 0 ? 'Primary' : `Secondary (${i})`}: ${dx}\n`;
    });
  } else {
    content += '  Not yet specified\n';
  }
  content += '\n';

  // ── Presenting Complaint & History ──
  const presentingComplaint = latestAdmission?.presenting_complaint || latestAdmission?.reasons_for_admission || patient.presenting_complaint || '';
  if (presentingComplaint) {
    content += `**PRESENTING COMPLAINT / HISTORY OF PRESENTING ILLNESS**\n`;
    content += `${presentingComplaint}\n\n`;
  }

  // ── Clinical Encounters / Progress Notes (FULL TEXT — no truncation) ──
  const sortedEncounters = [...encounters].sort((a, b) => new Date(b.created_at || b.date || 0).getTime() - new Date(a.created_at || a.date || 0).getTime());
  if (sortedEncounters.length > 0) {
    content += `**CLINICAL ENCOUNTERS** (${sortedEncounters.length})\n`;
    content += `${'─'.repeat(40)}\n`;
    sortedEncounters.forEach((enc, idx) => {
      const dateStr = (enc.created_at || enc.date) ? format(new Date(enc.created_at || enc.date), 'dd/MM/yyyy HH:mm') : 'Unknown';
      let soap = enc.soap;
      if (typeof soap === 'string') try { soap = JSON.parse(soap); } catch {}
      if (typeof soap === 'string') try { soap = JSON.parse(soap); } catch {}
      const encType = enc.type || enc._type || (typeof soap === 'object' && soap?.type) || 'progress_note';
      const typeLabel: Record<string, string> = { ward_round: 'Ward Round', consultation: 'Consultation', procedure_note: 'Procedure Note', clinic_visit: 'Clinic Visit', emergency: 'Emergency Review' };
      const label = typeLabel[encType] || 'Progress Note';
      const author = enc.author || enc.created_by || enc.admitting_doctor || '';

      content += `\n  [${idx + 1}] ${label} — ${dateStr}${author ? ` — Dr. ${author}` : ''}\n`;

      // Full SOAP note rendering
      if (typeof soap === 'object' && soap) {
        if (soap.subjective) content += `      S: ${soap.subjective}\n`;
        if (soap.objective) content += `      O: ${soap.objective}\n`;
        if (soap.assessment) content += `      A: ${soap.assessment}\n`;
        if (soap.plan) content += `      P: ${soap.plan}\n`;
        if (soap.note) content += `      ${soap.note}\n`;
      }
      // Fallback to raw content
      const rawContent = (typeof soap === 'object' && soap ? '' : (typeof soap === 'string' ? soap : '')) || enc.content || enc.notes || enc.note || enc.presenting_complaint || '';
      if (rawContent) content += `      ${rawContent}\n`;
    });
    content += '\n';
  }

  // ── Ward Rounds ──
  const sortedRounds = [...wardRounds].sort((a, b) => new Date(b.round_date || b.created_at || 0).getTime() - new Date(a.round_date || a.created_at || 0).getTime());
  if (sortedRounds.length > 0) {
    content += `**WARD ROUND NOTES** (${sortedRounds.length})\n`;
    content += `${'─'.repeat(40)}\n`;
    sortedRounds.forEach((r, idx) => {
      const f = parseFindingsObj(r);
      const dateStr = r.round_date ? format(new Date(r.round_date), 'dd/MM/yyyy') : 'Unknown';
      const roundType = f.round_type || r.round_type || 'Routine';
      const status = f.progress_status || r.progress_status || '';
      const doctor = f.reviewing_doctor || r.reviewing_doctor || r.documented_by_name || '';

      content += `\n  [${idx + 1}] ${roundType} Round — ${dateStr}${doctor ? ` — ${doctor}` : ''}${status ? ` — Status: ${status}` : ''}\n`;
      if (f.chief_complaint || r.chief_complaint) content += `      Complaint: ${f.chief_complaint || r.chief_complaint}\n`;
      if (f.clinical_notes) content += `      Clinical Notes: ${f.clinical_notes}\n`;
      if (f.assessment_notes) content += `      Assessment: ${f.assessment_notes}\n`;
      if (r.plan || f.follow_up_plan) content += `      Plan: ${r.plan || f.follow_up_plan}\n`;
      if (f.discharge_planning) content += `      Discharge Planning: ${f.discharge_planning}\n`;
      if (f.complications) content += `      ⚠ Complications: ${f.complications}\n`;
    });
    content += '\n';
  }

  // ── Vital Signs ──
  const vitalTrends: VitalTrend[] = [];
  if (vitals.length > 0) {
    const latest = vitals[0];
    const prev = vitals.length > 1 ? vitals[1] : null;
    content += `**VITAL SIGNS** (Latest: ${latest.date || latest.created_at ? format(new Date(latest.date || latest.created_at), 'dd/MM/yyyy HH:mm') : 'Recent'})\n`;
    const vitalLines: string[] = [];
    if (latest.temperature) {
      const dir = prev?.temperature ? (latest.temperature > prev.temperature ? 'rising' : latest.temperature < prev.temperature ? 'falling' : 'stable') : 'unknown';
      const arrow = dir === 'rising' ? ' ↑' : dir === 'falling' ? ' ↓' : '';
      vitalLines.push(`Temp: ${latest.temperature}°C${arrow}`);
      vitalTrends.push({ parameter: 'Temperature', current: `${latest.temperature}°C`, previous: prev?.temperature ? `${prev.temperature}°C` : undefined, direction: dir as any, alert: latest.temperature >= 38 ? 'Febrile' : latest.temperature < 36 ? 'Hypothermia' : undefined });
    }
    if (latest.pulse) {
      const dir = prev?.pulse ? (latest.pulse > prev.pulse ? 'rising' : latest.pulse < prev.pulse ? 'falling' : 'stable') : 'unknown';
      const arrow = dir === 'rising' ? ' ↑' : dir === 'falling' ? ' ↓' : '';
      vitalLines.push(`PR: ${latest.pulse} bpm${arrow}`);
      vitalTrends.push({ parameter: 'Heart Rate', current: `${latest.pulse} bpm`, previous: prev?.pulse ? `${prev.pulse} bpm` : undefined, direction: dir as any, alert: latest.pulse > 100 ? 'Tachycardia' : latest.pulse < 60 ? 'Bradycardia' : undefined });
    }
    if (latest.bp_systolic && latest.bp_diastolic) {
      vitalLines.push(`BP: ${latest.bp_systolic}/${latest.bp_diastolic} mmHg`);
      vitalTrends.push({ parameter: 'Blood Pressure', current: `${latest.bp_systolic}/${latest.bp_diastolic}`, previous: prev?.bp_systolic ? `${prev.bp_systolic}/${prev.bp_diastolic}` : undefined, direction: !prev?.bp_systolic ? 'unknown' : latest.bp_systolic > prev.bp_systolic ? 'rising' : latest.bp_systolic < prev.bp_systolic ? 'falling' : 'stable', alert: latest.bp_systolic >= 140 ? 'Hypertension' : latest.bp_systolic < 90 ? 'Hypotension' : undefined });
    }
    if (latest.respiratory_rate) {
      vitalLines.push(`RR: ${latest.respiratory_rate}/min`);
      vitalTrends.push({ parameter: 'Respiratory Rate', current: `${latest.respiratory_rate}/min`, direction: 'unknown', alert: latest.respiratory_rate > 20 ? 'Tachypnea' : undefined });
    }
    if (latest.spo2) {
      vitalLines.push(`SpO2: ${latest.spo2}%`);
      vitalTrends.push({ parameter: 'SpO2', current: `${latest.spo2}%`, previous: prev?.spo2 ? `${prev.spo2}%` : undefined, direction: !prev?.spo2 ? 'unknown' : latest.spo2 > prev.spo2 ? 'rising' : latest.spo2 < prev.spo2 ? 'falling' : 'stable', alert: latest.spo2 < 94 ? 'Hypoxemia' : undefined });
    }
    content += `  ${vitalLines.join('  |  ')}\n`;
    // Flag abnormals
    const alerts = vitalTrends.filter(v => v.alert);
    if (alerts.length > 0) content += `  ⚠ Abnormal: ${alerts.map(a => `${a.alert} (${a.current})`).join(', ')}\n`;
    content += '\n';
  }

  // ── Investigations ──
  const allLabs = [...labInvestigations, ...labResults];
  if (allLabs.length > 0) {
    content += `**INVESTIGATIONS & RESULTS** (${allLabs.length})\n`;
    const recentLabs = [...allLabs].sort((a, b) => new Date(b.ordered_date || b.result_date || b.created_at || 0).getTime() - new Date(a.ordered_date || a.result_date || a.created_at || 0).getTime());
    const pendingLabs = recentLabs.filter(l => ['pending', 'ordered', 'in_progress'].includes((l.status || '').toLowerCase()));
    const completedLabs = recentLabs.filter(l => !['pending', 'ordered', 'in_progress'].includes((l.status || '').toLowerCase()));
    if (completedLabs.length > 0) {
      content += '  Results:\n';
      completedLabs.slice(0, 15).forEach(lab => {
        const dateStr = lab.ordered_date || lab.result_date || lab.created_at ? format(new Date(lab.ordered_date || lab.result_date || lab.created_at), 'dd/MM') : '';
        const testName = lab.test_name || lab.investigation_name || lab.investigation_type || 'Lab Test';
        const result = lab.result || lab.result_value || '';
        content += `    ${dateStr ? `[${dateStr}] ` : ''}${testName}${result ? `: ${result}` : ' — reported'}\n`;
      });
    }
    if (pendingLabs.length > 0) {
      content += `  Pending (${pendingLabs.length}): ${pendingLabs.map(l => l.test_name || l.investigation_name || 'Lab').join(', ')}\n`;
    }
    content += '\n';
  }

  // ── Current Medications ──
  const allMeds = extractAllMedications(prescriptions);
  if (allMeds.length > 0) {
    content += `**CURRENT MEDICATIONS** (${allMeds.length})\n`;
    allMeds.forEach((med, i) => content += `  ${i + 1}. ${med}\n`);
    content += '\n';
  }

  // ── Surgical History / Bookings ──
  if (surgeries.length > 0) {
    content += `**SURGICAL HISTORY / BOOKINGS** (${surgeries.length})\n`;
    surgeries.forEach((s, i) => {
      const dateStr = s.surgery_date || s.date || s.created_at ? format(new Date(s.surgery_date || s.date || s.created_at), 'dd/MM/yyyy') : 'TBD';
      const proc = s.procedure_name || s.surgery_type || 'Procedure';
      const anaes = s.anaesthesia_type ? ` under ${s.anaesthesia_type}` : '';
      const status = (s.status || 'planned').toUpperCase();
      content += `  ${i + 1}. [${dateStr}] ${proc}${anaes} — ${status}\n`;
    });
    content += '\n';
  }

  // ── Run multi-specialty analysis ──
  const specialtyFlags: SpecialtyFlag[] = [];
  SPECIALTY_RULES.forEach(rule => {
    try {
      const flags = rule.check(data);
      specialtyFlags.push(...flags);
    } catch {}
  });

  // ── Build recommendations from specialty flags ──
  const recommendations: string[] = [];
  // Critical first, then warnings, then info
  const sortedFlags = [...specialtyFlags].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });
  sortedFlags.forEach(f => {
    recommendations.push(`[${f.specialty}] ${f.recommendation}`);
  });

  // Add universal recommendations
  if (recommendations.length === 0) {
    recommendations.push('Continue current management plan.', 'Monitor vital signs regularly.', 'Review investigation results and adjust management accordingly.');
  }

  // ── Key Points ──
  const keyPoints: string[] = [];
  if (primaryDiagnosis !== 'Not specified') keyPoints.push(`Diagnosis: ${primaryDiagnosis}`);
  if (ward !== 'Not assigned') keyPoints.push(`Ward: ${ward}`);
  if (los > 0) keyPoints.push(`Length of Stay: ${los} day(s)`);
  if (patient.blood_group) keyPoints.push(`Blood Group: ${patient.blood_group}`);
  if (allergies.length > 0) keyPoints.push(`Allergies: ${allergies.join(', ')}`);
  if (sortedEncounters.length > 0) keyPoints.push(`Encounters: ${sortedEncounters.length}`);
  if (sortedRounds.length > 0) keyPoints.push(`Ward Rounds: ${sortedRounds.length}`);
  if (allMeds.length > 0) keyPoints.push(`Active Medications: ${allMeds.length}`);
  if (surgeries.length > 0) keyPoints.push(`Surgeries/Bookings: ${surgeries.length}`);
  // Vital sign alerts
  vitalTrends.forEach(vt => { if (vt.alert) keyPoints.push(`!! ${vt.alert}: ${vt.current}`); });
  // Critical flags
  specialtyFlags.filter(f => f.severity === 'critical').forEach(f => keyPoints.push(`CRITICAL: ${f.finding}`));

  // ── Current Problems ──
  const currentProblems = uniqueDiagnoses.length > 0 ? [...uniqueDiagnoses] : ['No active problems documented'];
  // Add complications from ward rounds
  wardRounds.forEach(r => {
    const f = parseFindingsObj(r);
    if (f.complications && !currentProblems.includes(f.complications)) currentProblems.push(f.complications);
  });

  // ── Pending Investigations ──
  const pendingInvestigations = allLabs
    .filter(l => ['pending', 'ordered', 'in_progress'].includes((l.status || '').toLowerCase()))
    .map(l => l.test_name || l.investigation_name || 'Lab Test');

  // ── Plan ──
  const plan: string[] = [];
  if (sortedRounds.length > 0) {
    const latestRound = sortedRounds[0];
    const f = parseFindingsObj(latestRound);
    if (latestRound.plan) plan.push(latestRound.plan);
    if (f.follow_up_plan && !plan.includes(f.follow_up_plan)) plan.push(f.follow_up_plan);
    if (f.discharge_planning) plan.push(`Discharge plan: ${f.discharge_planning}`);
  }
  treatmentPlans.forEach(tp => {
    if (tp.procedures && Array.isArray(tp.procedures)) {
      tp.procedures.forEach((proc: any) => {
        if ((proc.procedure_name || proc.name) && proc.status !== 'completed') plan.push(`Planned: ${proc.procedure_name || proc.name}`);
      });
    }
  });
  if (pendingInvestigations.length > 0) plan.push(`Awaiting results: ${pendingInvestigations.join(', ')}`);
  if (plan.length === 0) plan.push('Continue monitoring', 'Review treatment response');

  // ── Active Problem List ──
  content += `**ACTIVE PROBLEM LIST**\n`;
  currentProblems.forEach((p, i) => content += `  ${i + 1}. ${p}\n`);
  content += '\n';

  // ── Management Plan ──
  content += `**MANAGEMENT PLAN**\n`;
  plan.forEach((item, i) => content += `  ${i + 1}. ${item}\n`);
  content += '\n';

  // ── Multi-specialty recommendations ──
  if (specialtyFlags.length > 0) {
    content += `**CLINICAL RECOMMENDATIONS** (${specialtyFlags.length} findings)\n`;
    sortedFlags.forEach(f => {
      const severity = f.severity === 'critical' ? 'CRITICAL' : f.severity === 'warning' ? 'CAUTION' : 'NOTE';
      content += `  [${severity}] ${f.specialty}: ${f.finding}\n`;
      content += `    → ${f.recommendation}\n`;
    });
    content += '\n';
  }

  // ── Signature block ──
  content += `${line}\n`;
  content += `**Scribe Note** — Auto-generated ${format(new Date(), 'dd/MM/yyyy HH:mm')}\n`;
  content += `Reviewed by: ____________________  Signature: ____________________\n`;
  content += `${line}\n`;

  return {
    id: `summary-${Date.now()}`,
    patient_id: patientId,
    summary_type: 'progress',
    generated_by: 'system',
    content,
    key_points: keyPoints.length > 0 ? keyPoints : ['Patient data loaded'],
    current_problems: currentProblems,
    medications: allMeds.length > 0 ? allMeds : ['No active medications'],
    investigations_pending: pendingInvestigations,
    plan,
    generated_at: new Date(),
    generated_by_user: 'system',
    ai_confidence: undefined,
    specialtyFlags,
    vitalTrends,
    recommendations,
  };
}

// ─── Component Props ────────────────────────────────────────────────────────

interface PatientSummaryViewProps {
  patientId: string;
  summaryType?: PatientSummary['summary_type'];
}

type ExtendedSummary = PatientSummary & {
  specialtyFlags?: SpecialtyFlag[];
  vitalTrends?: VitalTrend[];
  recommendations?: string[];
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const PatientSummaryView: React.FC<PatientSummaryViewProps> = ({
  patientId,
  summaryType = 'progress'
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<ExtendedSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['content', 'keyPoints', 'recommendations']));

  useEffect(() => {
    loadSummary();
  }, [patientId, summaryType]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const data = await fetchComprehensivePatientData(patientId);
      const summary = generateComprehensiveSummary(data, patientId);
      setSelectedSummary(summary);
      // Save for future retrieval
      try { await db.patient_summaries?.add(summary as any); } catch {}
    } catch (error) {
      console.error('Error loading summary:', error);
      setSelectedSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  const generateNewSummary = async () => {
    setIsGenerating(true);
    try {
      const data = await fetchComprehensivePatientData(patientId);
      const summary = generateComprehensiveSummary(data, patientId);
      setSelectedSummary(summary);
      try { await db.patient_summaries?.add(summary as any); } catch {}
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!selectedSummary) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Clinical Summary</title>
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; font-size: 12px; line-height: 1.6; color: #1a1a1a; }
        h1 { font-size: 16px; border-bottom: 2px solid #0E9F6E; padding-bottom: 8px; }
        h2 { font-size: 14px; margin-top: 16px; color: #0E9F6E; }
        .section { margin: 12px 0; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; margin: 2px; }
        .critical { background: #FEE2E2; color: #DC2626; }
        .warning { background: #FEF3C7; color: #D97706; }
        .info { background: #DBEAFE; color: #2563EB; }
        pre { white-space: pre-wrap; font-family: inherit; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <h1>Medical Scribe Summary</h1>
      <pre>${selectedSummary.content}</pre>
      <h2>Key Clinical Points</h2>
      <ul>${selectedSummary.key_points.map(p => `<li>${p}</li>`).join('')}</ul>
      <h2>Active Problems</h2>
      <ul>${selectedSummary.current_problems.map(p => `<li>${p}</li>`).join('')}</ul>
      <h2>Current Medications</h2>
      <ul>${selectedSummary.medications.map(m => `<li>${m}</li>`).join('')}</ul>
      <h2>Management Plan</h2>
      <ol>${selectedSummary.plan.map(p => `<li>${p}</li>`).join('')}</ol>
      ${selectedSummary.recommendations && selectedSummary.recommendations.length > 0 ? `
        <h2>Multi-Specialty Recommendations</h2>
        <ol>${selectedSummary.recommendations.map(r => `<li>${r}</li>`).join('')}</ol>
      ` : ''}
      <p style="margin-top:20px;font-size:10px;color:#666;">Generated: ${selectedSummary.generated_at.toLocaleString()} | UNTH Plastic Surgery</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportPDF = async () => {
    if (!selectedSummary) return;
    try {
      const { createPDF, addPDFHeader, addSectionHeader, PDF_MARGINS, PDF_LINE_HEIGHT, PDF_FONT_SIZES, PDF_COLORS, PDF_PAGE, addFooter, needsNewPage } = await import('../utils/pdfUtils');
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Medical Scribe Summary', format(selectedSummary.generated_at, 'dd MMM yyyy'));

      // Parse the content into sections
      const sections = selectedSummary.content.split('\n\n').filter(Boolean);
      
      doc.setFontSize(PDF_FONT_SIZES.body);
      doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
      
      for (const section of sections) {
        const lines = doc.splitTextToSize(section.replace(/\*\*/g, ''), PDF_PAGE.width - PDF_MARGINS.left - PDF_MARGINS.right);
        for (const line of lines) {
          if (needsNewPage(doc, y)) {
            doc.addPage();
            y = PDF_MARGINS.top;
          }
          // Bold lines that start with known headers
          if (/^(MEDICAL SCRIBE|PATIENT|ADMISSION|DIAGNOSIS|ALLERGIES|COMORBIDITIES|BLOOD GROUP|PRESENTING COMPLAINT|CLINICAL ENCOUNTERS|WARD ROUND|VITAL SIGNS|INVESTIGATIONS|CURRENT MEDICATIONS|SURGICAL HISTORY|MULTI-SPECIALTY|Date:|Institution:)/i.test(line.trim())) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(PDF_COLORS.text.r, PDF_COLORS.text.g, PDF_COLORS.text.b);
          }
          doc.text(line, PDF_MARGINS.left, y);
          y += PDF_LINE_HEIGHT;
        }
        y += PDF_LINE_HEIGHT * 0.5;
      }

      // Recommendations
      if (selectedSummary.recommendations && selectedSummary.recommendations.length > 0) {
        if (needsNewPage(doc, y + 30)) { doc.addPage(); y = PDF_MARGINS.top; }
        y = addSectionHeader(doc, 'Multi-Specialty Recommendations', y);
        doc.setFontSize(PDF_FONT_SIZES.body - 1);
        selectedSummary.recommendations.forEach((rec, i) => {
          const lines = doc.splitTextToSize(`${i + 1}. ${rec}`, PDF_PAGE.width - PDF_MARGINS.left - PDF_MARGINS.right - 5);
          lines.forEach((line: string) => {
            if (needsNewPage(doc, y)) { doc.addPage(); y = PDF_MARGINS.top; }
            doc.text(line, PDF_MARGINS.left + 5, y);
            y += PDF_LINE_HEIGHT;
          });
          y += 2;
        });
      }

      addFooter(doc);
      doc.save(`Clinical_Summary_${selectedSummary.generated_at.toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to export PDF');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border p-8">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Generating medical scribe summary...</p>
          <p className="text-gray-400 text-xs">Fetching encounters, ward rounds, prescriptions, investigations, vitals, bookings...</p>
        </div>
      </div>
    );
  }

  if (!selectedSummary) {
    return (
      <div className="bg-white rounded-xl border p-8 text-center">
        <p className="text-gray-500 mb-3">Unable to generate summary</p>
        <button onClick={generateNewSummary} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
          Retry
        </button>
      </div>
    );
  }

  const criticalFlags = selectedSummary.specialtyFlags?.filter(f => f.severity === 'critical') || [];
  const warningFlags = selectedSummary.specialtyFlags?.filter(f => f.severity === 'warning') || [];
  const infoFlags = selectedSummary.specialtyFlags?.filter(f => f.severity === 'info') || [];

  return (
    <div className="space-y-4">
      {/* Critical alerts banner */}
      {criticalFlags.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <h3 className="text-red-800 font-semibold text-sm flex items-center gap-2 mb-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            CRITICAL ALERTS ({criticalFlags.length})
          </h3>
          <div className="space-y-2">
            {criticalFlags.map((f, i) => (
              <div key={i} className="bg-red-100 rounded-lg p-3">
                <p className="text-red-900 font-medium text-sm">[{f.specialty}] {f.finding}</p>
                <p className="text-red-700 text-xs mt-1">&rarr; {f.recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main summary card */}
      <div className="bg-white rounded-xl border shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 border-b bg-gradient-to-r from-green-50 to-white flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">&#9998;</span>
              Medical Scribe Summary
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Generated {selectedSummary.generated_at.toLocaleDateString()} at {selectedSummary.generated_at.toLocaleTimeString()} |
              Data sources: Encounters, Ward Rounds, Prescriptions, Investigations, Vitals, Bookings
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedSummary.specialtyFlags && selectedSummary.specialtyFlags.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                {selectedSummary.specialtyFlags.length} specialty findings
              </span>
            )}
          </div>
        </div>

        {/* Key Points */}
        <div className="px-4 py-3 border-b">
          <button onClick={() => toggleSection('keyPoints')} className="w-full flex items-center justify-between text-left">
            <h3 className="text-sm font-semibold text-gray-900">Key Clinical Points ({selectedSummary.key_points.length})</h3>
            <span className="text-gray-400 text-xs">{expandedSections.has('keyPoints') ? '▼' : '▶'}</span>
          </button>
          {expandedSections.has('keyPoints') && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedSummary.key_points.map((point, i) => (
                <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  point.startsWith('!!') ? 'bg-yellow-100 text-yellow-800' :
                  point.startsWith('CRITICAL') ? 'bg-red-100 text-red-800' :
                  'bg-green-50 text-green-800'
                }`}>
                  {point}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Vital Signs Trends */}
        {selectedSummary.vitalTrends && selectedSummary.vitalTrends.length > 0 && (
          <div className="px-4 py-3 border-b">
            <button onClick={() => toggleSection('vitals')} className="w-full flex items-center justify-between text-left">
              <h3 className="text-sm font-semibold text-gray-900">Vital Signs</h3>
              <span className="text-gray-400 text-xs">{expandedSections.has('vitals') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('vitals') && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mt-2">
                {selectedSummary.vitalTrends.map((vt, i) => (
                  <div key={i} className={`rounded-lg p-2.5 text-center ${
                    vt.alert ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'
                  }`}>
                    <p className="text-[10px] text-gray-500 font-medium uppercase">{vt.parameter}</p>
                    <p className={`text-base font-bold ${vt.alert ? 'text-red-700' : 'text-gray-900'}`}>{vt.current}</p>
                    {vt.previous && (
                      <p className="text-[10px] text-gray-400">
                        {vt.direction === 'rising' ? '↑' : vt.direction === 'falling' ? '↓' : '→'} from {vt.previous}
                      </p>
                    )}
                    {vt.alert && <p className="text-[10px] text-red-600 font-semibold mt-0.5">{vt.alert}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Full Clinical Summary */}
        <div className="px-4 py-3 border-b">
          <button onClick={() => toggleSection('content')} className="w-full flex items-center justify-between text-left">
            <h3 className="text-sm font-semibold text-gray-900">Full Scribe Note</h3>
            <span className="text-gray-400 text-xs">{expandedSections.has('content') ? '▼' : '▶'}</span>
          </button>
          {expandedSections.has('content') && (
            <div className="mt-2 bg-gray-50 rounded-lg p-4 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-[600px] overflow-y-auto font-mono">
              {selectedSummary.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={i} className="text-green-700 font-semibold">{part.replace(/\*\*/g, '')}</strong>;
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
          )}
        </div>

        {/* Active Problems */}
        <div className="px-4 py-3 border-b">
          <button onClick={() => toggleSection('problems')} className="w-full flex items-center justify-between text-left">
            <h3 className="text-sm font-semibold text-gray-900">Active Problems ({selectedSummary.current_problems.length})</h3>
            <span className="text-gray-400 text-xs">{expandedSections.has('problems') ? '▼' : '▶'}</span>
          </button>
          {expandedSections.has('problems') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {selectedSummary.current_problems.map((problem, i) => (
                <div key={i} className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <span className="text-red-800 text-sm font-medium">{problem}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Medications */}
        <div className="px-4 py-3 border-b">
          <button onClick={() => toggleSection('meds')} className="w-full flex items-center justify-between text-left">
            <h3 className="text-sm font-semibold text-gray-900">Current Medications ({selectedSummary.medications.length})</h3>
            <span className="text-gray-400 text-xs">{expandedSections.has('meds') ? '▼' : '▶'}</span>
          </button>
          {expandedSections.has('meds') && (
            <div className="space-y-1.5 mt-2">
              {selectedSummary.medications.map((med, i) => (
                <div key={i} className="bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                  <span className="text-blue-800 text-sm">{med}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Investigations */}
        {selectedSummary.investigations_pending.length > 0 && (
          <div className="px-4 py-3 border-b">
            <button onClick={() => toggleSection('pending')} className="w-full flex items-center justify-between text-left">
              <h3 className="text-sm font-semibold text-gray-900">Pending Investigations ({selectedSummary.investigations_pending.length})</h3>
              <span className="text-gray-400 text-xs">{expandedSections.has('pending') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('pending') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {selectedSummary.investigations_pending.map((inv, i) => (
                  <div key={i} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5">
                    <span className="text-yellow-800 text-sm">{inv}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Management Plan */}
        <div className="px-4 py-3 border-b">
          <button onClick={() => toggleSection('plan')} className="w-full flex items-center justify-between text-left">
            <h3 className="text-sm font-semibold text-gray-900">Management Plan ({selectedSummary.plan.length})</h3>
            <span className="text-gray-400 text-xs">{expandedSections.has('plan') ? '▼' : '▶'}</span>
          </button>
          {expandedSections.has('plan') && (
            <ol className="space-y-1.5 mt-2">
              {selectedSummary.plan.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 bg-green-600 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-gray-700 text-sm">{item}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Multi-Specialty Recommendations */}
        {selectedSummary.recommendations && selectedSummary.recommendations.length > 0 && (
          <div className="px-4 py-3 border-b">
            <button onClick={() => toggleSection('recommendations')} className="w-full flex items-center justify-between text-left">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                Multi-Specialty Recommendations
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{selectedSummary.specialtyFlags?.length || 0} findings</span>
              </h3>
              <span className="text-gray-400 text-xs">{expandedSections.has('recommendations') ? '▼' : '▶'}</span>
            </button>
            {expandedSections.has('recommendations') && (
              <div className="space-y-2 mt-2">
                {/* Group by severity */}
                {criticalFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-700 mb-1 uppercase">Critical ({criticalFlags.length})</p>
                    {criticalFlags.map((f, i) => (
                      <div key={i} className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-3 mb-1.5">
                        <p className="text-sm font-medium text-red-900">[{f.specialty}] {f.finding}</p>
                        <p className="text-xs text-red-700 mt-1">&rarr; {f.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
                {warningFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-700 mb-1 uppercase">Warnings ({warningFlags.length})</p>
                    {warningFlags.map((f, i) => (
                      <div key={i} className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-3 mb-1.5">
                        <p className="text-sm font-medium text-yellow-900">[{f.specialty}] {f.finding}</p>
                        <p className="text-xs text-yellow-700 mt-1">&rarr; {f.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
                {infoFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 mb-1 uppercase">Informational ({infoFlags.length})</p>
                    {infoFlags.map((f, i) => (
                      <div key={i} className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-3 mb-1.5">
                        <p className="text-sm font-medium text-blue-900">[{f.specialty}] {f.finding}</p>
                        <p className="text-xs text-blue-700 mt-1">&rarr; {f.recommendation}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 bg-gray-50 rounded-b-xl flex items-center justify-between flex-wrap gap-2">
          <div className="text-xs text-gray-500">
            Generated by: {selectedSummary.generated_by === 'ai' ? 'Automated System' : selectedSummary.generated_by_user || 'system'}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
              Print Summary
            </button>
            <button onClick={handleExportPDF} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100">
              Export PDF
            </button>
            <button
              onClick={generateNewSummary}
              disabled={isGenerating}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isGenerating ? 'Generating...' : 'Generate Updated Summary'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Quick Summary Card (for use in other views) ────────────────────────────

export const QuickSummaryCard: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [summary, setSummary] = useState<ExtendedSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [patientId]);

  const loadSummary = async () => {
    setIsLoading(true);
    try {
      const data = await fetchComprehensivePatientData(patientId);
      const s = generateComprehensiveSummary(data, patientId);
      setSummary(s);
    } catch {
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-3 bg-gray-200 rounded" />
          <div className="h-3 bg-gray-200 rounded w-5/6" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <p className="text-gray-500 mb-2 text-sm">No summary available</p>
        <button onClick={loadSummary} className="text-sm text-green-600 hover:text-green-700 font-medium">Generate Summary</button>
      </div>
    );
  }

  const criticalCount = summary.specialtyFlags?.filter(f => f.severity === 'critical').length || 0;
  const warningCount = summary.specialtyFlags?.filter(f => f.severity === 'warning').length || 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Clinical Summary</h3>
        <div className="flex items-center gap-1">
          {criticalCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{criticalCount} critical</span>}
          {warningCount > 0 && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{warningCount} warning</span>}
        </div>
      </div>
      <div className="p-4">
        <p className="text-gray-700 text-xs line-clamp-4">{summary.content.substring(0, 400)}...</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {summary.key_points.slice(0, 4).map((point, i) => (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full ${
              point.startsWith('!!') || point.startsWith('CRITICAL') ? 'bg-red-100 text-red-700' : 'bg-green-50 text-green-700'
            }`}>{point}</span>
          ))}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2">
          <span>{summary.generated_at.toLocaleDateString()} {summary.generated_at.toLocaleTimeString()}</span>
          <span>{summary.specialtyFlags?.length || 0} specialty findings</span>
        </div>
      </div>
    </div>
  );
};
