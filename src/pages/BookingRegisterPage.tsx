import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { patientService } from '../services/patientService';
import { preoperativeService, PreoperativeAssessment, Medication } from '../services/preoperativeService';
import { schedulingService, SurgeryBooking } from '../services/schedulingService';
import { apiClient } from '../services/apiClient';
import { db } from '../db/database';
import toast from 'react-hot-toast';
import { safeFormatDate } from '../utils/dateUtils';
import {
  ArrowLeft, ClipboardCheck, Users, Search, User, Calendar, Loader2,
  Eye, Plus, CheckCircle, AlertTriangle, FileText, Download, BookOpen,
  ShoppingCart, Shield, Printer, Filter, ChevronDown, ChevronUp,
  Image, CreditCard, Clock, MapPin, Stethoscope, ListChecks,
  Upload, X, CalendarDays, Lock, Unlock, FlaskConical, Ban,
  ChevronLeft, ChevronRight, AlertOctagon, Baby, Droplets, Bug, Heart,
  Activity, Utensils, Zap, Save, Edit2, Check, RefreshCw, FileImage,
  Scissors, Minus, Camera, ScanLine, TestTube
} from 'lucide-react';
import { DocumentScannerModal } from '../components/DocumentScannerModal';
const PreoperativePlanningModule = lazy(() => import('../components/procedures/PreoperativePlanningModule'));
const PreoperativeAssessmentForm = lazy(() => import('../components/PreoperativeAssessmentForm'));
import {
  createPDF, addPDFHeader, addSectionHeader, addBodyText, addBulletList,
  addSeparator, addFooter, addLabeledField, sanitizeTextForPDF, formatDateForPDF,
  addTwoColumnText, needsNewPage, addSimpleTable, PDF_MARGINS, PDF_FONT_SIZES, PDF_LINE_HEIGHT, PDF_COLORS, PDF_PAGE,
} from '../utils/pdfUtils';
import jsPDF from 'jspdf';
import { useAuthStore } from '../store/authStore';

// ============================
// TYPES & INTERFACES
// ============================
interface Patient {
  id: string;
  hospital_number: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  ward?: string;
  consulting_unit?: string;
  phone?: string;
}

type TabKey = 'surgical-planning' | 'booked-cases' | 'theatre-calendar';
type CaseCategory = 'minor' | 'intermediate' | 'major' | 'super_major';
type PlanningSection = 'patient' | 'clinical' | 'risk' | 'investigations' | 'shopping' | 'procedure' | 'results' | 'ecg' | 'payment' | 'checklist';
type InvestigationFlag = 'normal' | 'borderline' | 'abnormal';

interface InvestigationResult {
  name: string;
  value: string;
  unit?: string;
  reference_range?: string;
  flag: InvestigationFlag;
  enteredBy?: string;
  enteredAt?: string;
}

interface SurgicalRiskMedication {
  drug: string;
  class: string;
  action: string;
  timing: string;
  risk: 'high' | 'moderate' | 'low';
}

interface NutritionalRiskAssessment {
  unplanned_weight_loss: boolean;
  bmi_below_18_5: boolean;
  reduced_intake_past_week: boolean;
  severely_ill: boolean;
  age_over_70: boolean;
  score: number;
  risk_level: 'low' | 'moderate' | 'high';
  recommendations: string[];
}

interface ReadinessChecklist {
  risk_assessed: boolean;
  comorbidities_documented: boolean;
  medications_reviewed: boolean;
  investigations_complete: boolean;
  shopping_list_done: boolean;
  procedure_documented: boolean;
  results_reviewed: boolean;
  payment_confirmed: boolean;
  consent_obtained: boolean;
  preop_instructions_given: boolean;
  blood_available: boolean;
  anaesthesia_review_done: boolean;
}

interface PreopPlanningData {
  patient_id: string;
  // Clinical Summary
  diagnosis: string;
  comorbidities: string[];
  current_medications: Medication[];
  surgical_risk_medications: SurgicalRiskMedication[];
  // Risk Assessments (from preoperativeService)
  bleeding_risk?: any;
  dvt_risk?: any;
  cardiovascular_risk?: any;
  pressure_sore_risk?: any;
  nutritional_risk?: NutritionalRiskAssessment;
  // Investigations
  ordered_investigations: string[];
  investigation_results: InvestigationResult[];
  investigation_docs: Array<{ name: string; dataUrl: string; uploadedAt: string; }>;
  // Shopping list
  shopping_items: Array<{ name: string; category: string; quantity: number; }>;
  // Procedure
  procedure_name: string;
  anaesthesia_type: string;
  proposed_ward: string;
  estimated_duration: number;
  // ECG
  ecg_image?: string;
  ecg_interpretation?: string;
  ecg_recommendations?: string;
  // Payment
  payment_evidence?: string;
  consent_document?: string;
  // Checklist
  checklist: ReadinessChecklist;
  // Meta
  assessed_by: string;
  assessed_at: string;
  notes: string;
}

// ============================
// CONSTANTS
// ============================
const PLANNING_DATA_KEY = 'booking_planning_data';
const loadJSON = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const saveJSON = (key: string, val: any) => { localStorage.setItem(key, JSON.stringify(val)); };

const calcAge = (dob: string): number => {
  const b = new Date(dob); const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age;
};

/** Compulsory pre-op investigations - auto-requested */
const COMPULSORY_INVESTIGATIONS = [
  'Full Blood Count (FBC)',
  'Serum Electrolytes, Urea & Creatinine (E/U/Cr)',
  'HIV Screening',
  'Hepatitis B Surface Antigen (HBsAg)',
  'Hepatitis C Virus (HCV)',
  'Fasting Blood Sugar (FBS)',
];

const OPTIONAL_INVESTIGATIONS = [
  'Liver Function Tests (LFT)',
  'Coagulation Profile (PT/INR/aPTT)',
  'Urinalysis',
  'Chest X-ray (CXR)',
  'ECG (12-lead)',
  'Blood Group & Cross-match',
  'Serum Protein & Albumin',
  'Thyroid Function Tests (TFT)',
  'HbA1c',
  'CT Scan',
  'MRI',
];

/** Detailed parameters for each investigation with units and reference ranges */
interface InvestigationParameter {
  parameter: string;
  unit: string;
  reference_range: string;
  type: 'numeric' | 'qualitative';
  options?: string[]; // for qualitative tests
}

const INVESTIGATION_PARAMETERS: Record<string, InvestigationParameter[]> = {
  'Full Blood Count (FBC)': [
    { parameter: 'Hemoglobin (Hb)', unit: 'g/dL', reference_range: '12.0-17.5', type: 'numeric' },
    { parameter: 'White Blood Cell (WBC)', unit: '×10⁹/L', reference_range: '4.0-11.0', type: 'numeric' },
    { parameter: 'Platelet Count', unit: '×10⁹/L', reference_range: '150-400', type: 'numeric' },
    { parameter: 'Packed Cell Volume (PCV)', unit: '%', reference_range: '36-54', type: 'numeric' },
    { parameter: 'Red Blood Cell (RBC)', unit: '×10¹²/L', reference_range: '3.8-5.5', type: 'numeric' },
    { parameter: 'MCV', unit: 'fL', reference_range: '80-100', type: 'numeric' },
    { parameter: 'MCH', unit: 'pg', reference_range: '27-33', type: 'numeric' },
    { parameter: 'MCHC', unit: 'g/dL', reference_range: '32-36', type: 'numeric' },
    { parameter: 'Neutrophils', unit: '×10⁹/L', reference_range: '2.0-7.5', type: 'numeric' },
    { parameter: 'Lymphocytes', unit: '×10⁹/L', reference_range: '1.5-4.0', type: 'numeric' },
    { parameter: 'Eosinophils', unit: '×10⁹/L', reference_range: '0.04-0.4', type: 'numeric' },
    { parameter: 'Monocytes', unit: '×10⁹/L', reference_range: '0.2-0.8', type: 'numeric' },
    { parameter: 'Basophils', unit: '×10⁹/L', reference_range: '0.0-0.1', type: 'numeric' },
  ],
  'Serum Electrolytes, Urea & Creatinine (E/U/Cr)': [
    { parameter: 'Sodium (Na⁺)', unit: 'mmol/L', reference_range: '135-145', type: 'numeric' },
    { parameter: 'Potassium (K⁺)', unit: 'mmol/L', reference_range: '3.5-5.0', type: 'numeric' },
    { parameter: 'Chloride (Cl⁻)', unit: 'mmol/L', reference_range: '98-106', type: 'numeric' },
    { parameter: 'Bicarbonate (HCO₃⁻)', unit: 'mmol/L', reference_range: '22-28', type: 'numeric' },
    { parameter: 'Urea', unit: 'mmol/L', reference_range: '2.5-6.7', type: 'numeric' },
    { parameter: 'Creatinine', unit: 'µmol/L', reference_range: '62-106', type: 'numeric' },
  ],
  'HIV Screening': [
    { parameter: 'HIV 1&2 Antibody', unit: '', reference_range: 'Non-Reactive', type: 'qualitative', options: ['Non-Reactive', 'Reactive', 'Indeterminate'] },
  ],
  'Hepatitis B Surface Antigen (HBsAg)': [
    { parameter: 'HBsAg', unit: '', reference_range: 'Non-Reactive', type: 'qualitative', options: ['Non-Reactive', 'Reactive'] },
  ],
  'Hepatitis C Virus (HCV)': [
    { parameter: 'HCV Antibody', unit: '', reference_range: 'Non-Reactive', type: 'qualitative', options: ['Non-Reactive', 'Reactive'] },
  ],
  'Fasting Blood Sugar (FBS)': [
    { parameter: 'Fasting Blood Glucose', unit: 'mmol/L', reference_range: '3.9-5.6', type: 'numeric' },
  ],
  'Liver Function Tests (LFT)': [
    { parameter: 'Total Bilirubin', unit: 'µmol/L', reference_range: '3-21', type: 'numeric' },
    { parameter: 'Direct Bilirubin', unit: 'µmol/L', reference_range: '0-5', type: 'numeric' },
    { parameter: 'ALT (SGPT)', unit: 'U/L', reference_range: '7-56', type: 'numeric' },
    { parameter: 'AST (SGOT)', unit: 'U/L', reference_range: '10-40', type: 'numeric' },
    { parameter: 'ALP', unit: 'U/L', reference_range: '44-147', type: 'numeric' },
    { parameter: 'Total Protein', unit: 'g/L', reference_range: '60-83', type: 'numeric' },
    { parameter: 'Albumin', unit: 'g/L', reference_range: '35-50', type: 'numeric' },
    { parameter: 'GGT', unit: 'U/L', reference_range: '9-48', type: 'numeric' },
  ],
  'Coagulation Profile (PT/INR/aPTT)': [
    { parameter: 'PT (Prothrombin Time)', unit: 'seconds', reference_range: '11-13.5', type: 'numeric' },
    { parameter: 'INR', unit: '', reference_range: '0.8-1.2', type: 'numeric' },
    { parameter: 'aPTT', unit: 'seconds', reference_range: '25-35', type: 'numeric' },
    { parameter: 'Fibrinogen', unit: 'g/L', reference_range: '2.0-4.0', type: 'numeric' },
  ],
  'Thyroid Function Tests (TFT)': [
    { parameter: 'TSH', unit: 'mIU/L', reference_range: '0.4-4.0', type: 'numeric' },
    { parameter: 'Free T4', unit: 'pmol/L', reference_range: '12-22', type: 'numeric' },
    { parameter: 'Free T3', unit: 'pmol/L', reference_range: '3.1-6.8', type: 'numeric' },
  ],
  'HbA1c': [
    { parameter: 'HbA1c', unit: '%', reference_range: '4.0-5.6', type: 'numeric' },
  ],
  'Blood Group & Cross-match': [
    { parameter: 'Blood Group', unit: '', reference_range: '', type: 'qualitative', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
    { parameter: 'Antibody Screen', unit: '', reference_range: 'Negative', type: 'qualitative', options: ['Negative', 'Positive'] },
  ],
  'Urinalysis': [
    { parameter: 'Protein', unit: '', reference_range: 'Negative', type: 'qualitative', options: ['Negative', 'Trace', '+', '++', '+++'] },
    { parameter: 'Glucose', unit: '', reference_range: 'Negative', type: 'qualitative', options: ['Negative', 'Trace', '+', '++', '+++'] },
    { parameter: 'Blood', unit: '', reference_range: 'Negative', type: 'qualitative', options: ['Negative', 'Trace', '+', '++', '+++'] },
    { parameter: 'Leukocytes', unit: '', reference_range: 'Negative', type: 'qualitative', options: ['Negative', 'Trace', '+', '++', '+++'] },
    { parameter: 'Nitrites', unit: '', reference_range: 'Negative', type: 'qualitative', options: ['Negative', 'Positive'] },
    { parameter: 'pH', unit: '', reference_range: '4.5-8.0', type: 'numeric' },
    { parameter: 'Specific Gravity', unit: '', reference_range: '1.005-1.030', type: 'numeric' },
  ],
  'Serum Protein & Albumin': [
    { parameter: 'Total Protein', unit: 'g/L', reference_range: '60-83', type: 'numeric' },
    { parameter: 'Albumin', unit: 'g/L', reference_range: '35-50', type: 'numeric' },
    { parameter: 'Globulin', unit: 'g/L', reference_range: '20-35', type: 'numeric' },
    { parameter: 'A/G Ratio', unit: '', reference_range: '1.0-2.2', type: 'numeric' },
  ],
};

/** Auto-flag a numeric result based on its reference range string */
const autoFlagResult = (value: string, refRange: string, type: 'numeric' | 'qualitative'): InvestigationFlag => {
  if (type === 'qualitative') {
    const v = value.toLowerCase();
    if (v === 'reactive' || v === 'positive' || v === '+++' || v === '++') return 'abnormal';
    if (v === 'trace' || v === '+' || v === 'indeterminate') return 'borderline';
    return 'normal';
  }
  const num = parseFloat(value);
  if (isNaN(num) || !refRange) return 'normal';
  const match = refRange.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (!match) return 'normal';
  const low = parseFloat(match[1]);
  const high = parseFloat(match[2]);
  if (num < low || num > high) return 'abnormal';
  // borderline if within 10% of limits
  const margin = (high - low) * 0.1;
  if (num < low + margin || num > high - margin) return 'borderline';
  return 'normal';
};

/** Surgical risk medications database */
const SURGICAL_RISK_MEDICATIONS: SurgicalRiskMedication[] = [
  { drug: 'Warfarin', class: 'Anticoagulant', action: 'Stop and bridge with LMWH', timing: '5 days before surgery', risk: 'high' },
  { drug: 'Rivaroxaban (Xarelto)', class: 'DOAC', action: 'Stop', timing: '48 hours before surgery', risk: 'high' },
  { drug: 'Apixaban (Eliquis)', class: 'DOAC', action: 'Stop', timing: '48 hours before surgery', risk: 'high' },
  { drug: 'Dabigatran (Pradaxa)', class: 'DOAC', action: 'Stop', timing: '48-72 hours before (CrCl dependent)', risk: 'high' },
  { drug: 'Enoxaparin (Clexane)', class: 'LMWH', action: 'Stop', timing: '24 hours before surgery', risk: 'high' },
  { drug: 'Heparin (UFH)', class: 'Anticoagulant', action: 'Stop infusion', timing: '4-6 hours before surgery', risk: 'high' },
  { drug: 'Aspirin (low-dose)', class: 'Antiplatelet', action: 'Continue if cardiac stent <12mo; else stop', timing: '7 days before surgery', risk: 'moderate' },
  { drug: 'Clopidogrel (Plavix)', class: 'Antiplatelet', action: 'Stop', timing: '5-7 days before surgery', risk: 'high' },
  { drug: 'Ticagrelor (Brilinta)', class: 'Antiplatelet', action: 'Stop', timing: '5 days before surgery', risk: 'high' },
  { drug: 'Prasugrel (Effient)', class: 'Antiplatelet', action: 'Stop', timing: '7 days before surgery', risk: 'high' },
  { drug: 'Metformin', class: 'Antidiabetic', action: 'Hold on day of surgery', timing: 'Morning of surgery; resume when eating', risk: 'moderate' },
  { drug: 'Insulin (long-acting)', class: 'Antidiabetic', action: 'Reduce dose by 20-50%', timing: 'Night before surgery', risk: 'moderate' },
  { drug: 'SGLT2 Inhibitors (Empagliflozin, Dapagliflozin)', class: 'Antidiabetic', action: 'Stop (DKA risk)', timing: '3 days before surgery', risk: 'high' },
  { drug: 'Sulfonylureas (Glibenclamide, Gliclazide)', class: 'Antidiabetic', action: 'Hold on day of surgery', timing: 'Morning of surgery', risk: 'moderate' },
  { drug: 'ACE Inhibitors (Enalapril, Lisinopril, Ramipril)', class: 'Antihypertensive', action: 'Hold morning of surgery', timing: 'Morning of surgery', risk: 'moderate' },
  { drug: 'ARBs (Losartan, Valsartan, Irbesartan)', class: 'Antihypertensive', action: 'Hold morning of surgery', timing: 'Morning of surgery', risk: 'moderate' },
  { drug: 'Diuretics (Furosemide, Hydrochlorothiazide)', class: 'Diuretic', action: 'Hold morning of surgery', timing: 'Morning of surgery', risk: 'low' },
  { drug: 'NSAIDs (Ibuprofen, Diclofenac, Naproxen)', class: 'Analgesic/Anti-inflammatory', action: 'Stop', timing: '3-5 days before surgery', risk: 'moderate' },
  { drug: 'SSRIs (Fluoxetine, Sertraline)', class: 'Antidepressant', action: 'Continue (serotonin syndrome risk if combined)', timing: 'Continue perioperatively', risk: 'low' },
  { drug: 'MAOIs (Phenelzine, Tranylcypromine)', class: 'Antidepressant', action: 'Stop with psychiatry input', timing: '2 weeks before surgery', risk: 'high' },
  { drug: 'Lithium', class: 'Mood Stabilizer', action: 'Hold morning of surgery, check levels', timing: 'Morning of surgery', risk: 'moderate' },
  { drug: 'Oral Contraceptives / HRT', class: 'Hormonal', action: 'Stop (DVT risk for major surgery)', timing: '4 weeks before major surgery', risk: 'moderate' },
  { drug: 'Herbal Supplements (Garlic, Ginkgo, Ginseng)', class: 'Supplements', action: 'Stop (bleeding risk)', timing: '7 days before surgery', risk: 'moderate' },
  { drug: 'Fish Oil / Omega-3', class: 'Supplements', action: 'Stop (bleeding risk)', timing: '7 days before surgery', risk: 'low' },
  { drug: 'Vitamin E (high dose)', class: 'Supplements', action: 'Stop (bleeding risk)', timing: '7 days before surgery', risk: 'low' },
  { drug: 'Corticosteroids (Prednisolone, Hydrocortisone)', class: 'Steroid', action: 'Continue; may need stress dose cover', timing: 'Perioperative stress dosing', risk: 'moderate' },
  { drug: 'Immunosuppressants (Methotrexate)', class: 'Immunosuppressant', action: 'Hold perioperatively (discuss with rheumatology)', timing: '1 week before surgery', risk: 'moderate' },
  { drug: 'Biological Agents (Adalimumab, Infliximab)', class: 'Immunosuppressant', action: 'Hold (infection risk)', timing: '2-4 weeks before surgery', risk: 'high' },
];

const COMORBIDITY_OPTIONS = [
  'Hypertension', 'Diabetes Mellitus Type 1', 'Diabetes Mellitus Type 2',
  'Coronary Artery Disease', 'Congestive Heart Failure', 'Atrial Fibrillation',
  'Previous Stroke/TIA', 'Chronic Kidney Disease', 'Dialysis Dependent',
  'COPD', 'Asthma', 'Obstructive Sleep Apnoea', 'Liver Cirrhosis',
  'Chronic Hepatitis', 'Active Malignancy', 'Previous DVT/PE',
  'Bleeding Disorder', 'On Anticoagulation', 'HIV Positive',
  'Hepatitis B', 'Hepatitis C', 'Tuberculosis', 'Epilepsy',
  'Sickle Cell Disease', 'Thyroid Disease', 'Obesity (BMI > 30)',
  'Morbid Obesity (BMI > 40)', 'Rheumatoid Arthritis', 'SLE',
  'Pregnancy', 'Smoking', 'Alcohol Use Disorder', 'Substance Abuse',
  'Psychiatric Disorder', 'Anaemia',
];

const ANAESTHESIA_TYPES = ['General Anaesthesia', 'Regional (Spinal)', 'Regional (Epidural)', 'Local Anaesthesia', 'Local + Sedation', 'IV Sedation', 'Nerve Block'];

const CASE_WEIGHTS: Record<CaseCategory, number> = { minor: 1, intermediate: 2, major: 2, super_major: 4 };
const MAX_DAILY_SLOTS = 4;
const CASE_CATEGORY_LABELS: Record<CaseCategory, string> = { minor: 'Minor', intermediate: 'Intermediate', major: 'Major', super_major: 'Super Major' };

const DEFAULT_CHECKLIST: ReadinessChecklist = {
  risk_assessed: false, comorbidities_documented: false, medications_reviewed: false,
  investigations_complete: false, shopping_list_done: false, procedure_documented: false,
  results_reviewed: false, payment_confirmed: false, consent_obtained: false,
  preop_instructions_given: false, blood_available: false, anaesthesia_review_done: false,
};

const makeDefaultPlan = (patientId: string, user: string): PreopPlanningData => ({
  patient_id: patientId,
  diagnosis: '', comorbidities: [], current_medications: [], surgical_risk_medications: [],
  ordered_investigations: [...COMPULSORY_INVESTIGATIONS],
  investigation_results: [], investigation_docs: [],
  shopping_items: [],
  procedure_name: '', anaesthesia_type: '', proposed_ward: '', estimated_duration: 60,
  ecg_image: undefined, ecg_interpretation: undefined, ecg_recommendations: undefined,
  payment_evidence: undefined, consent_document: undefined,
  checklist: { ...DEFAULT_CHECKLIST },
  assessed_by: user, assessed_at: new Date().toISOString(), notes: '',
});

// ============================
// NUTRITIONAL RISK CALCULATOR
// ============================
function calculateNutritionalRisk(data: {
  unplanned_weight_loss: boolean; bmi_below_18_5: boolean;
  reduced_intake_past_week: boolean; severely_ill: boolean; age_over_70: boolean;
}): NutritionalRiskAssessment {
  let score = 0;
  const recommendations: string[] = [];
  if (data.unplanned_weight_loss) { score += 2; recommendations.push('Assess percentage weight loss and duration'); }
  if (data.bmi_below_18_5) { score += 2; recommendations.push('BMI < 18.5: consider nutritional supplementation'); }
  if (data.reduced_intake_past_week) { score += 1; recommendations.push('Reduced oral intake: consider oral supplements or dietitian referral'); }
  if (data.severely_ill) { score += 2; recommendations.push('Critical illness increases metabolic demand'); }
  if (data.age_over_70) { score += 1; recommendations.push('Age > 70: higher nutritional risk'); }
  const risk_level = score >= 4 ? 'high' : score >= 2 ? 'moderate' : 'low';
  if (risk_level === 'high') recommendations.push('Refer to dietitian before surgery');
  return { ...data, score, risk_level, recommendations };
}

// Detect which surgical risk meds match patient's current medications
function matchSurgicalRiskMeds(patientMeds: Medication[]): SurgicalRiskMedication[] {
  const matched: SurgicalRiskMedication[] = [];
  for (const pm of patientMeds) {
    const drugLower = pm.drug_name.toLowerCase();
    for (const srm of SURGICAL_RISK_MEDICATIONS) {
      if (srm.drug.toLowerCase().includes(drugLower) || drugLower.includes(srm.drug.toLowerCase().split(' ')[0])) {
        matched.push(srm);
        break;
      }
    }
  }
  return matched;
}

// Priority sorting for booked cases
function prioritySort(a: any, b: any): number {
  const getPriority = (c: any) => {
    if (c.is_emergency) return 0;
    if (c.patient_age_at_booking < 10) return 1;
    if (c.is_diabetic) return 2;
    if (c.is_infected) return 4;
    if (c.is_hiv_positive) return 5;
    return 3;
  };
  return getPriority(a) - getPriority(b);
}

// ============================
// MAIN COMPONENT
// ============================
export default function BookingRegisterPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // --- Tabs ---
  const [activeTab, setActiveTab] = useState<TabKey>('surgical-planning');

  // --- Patient selection ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // --- Planning data per patient (persisted in localStorage) ---
  const [planData, setPlanData] = useState<PreopPlanningData | null>(null);
  const [activeSection, setActiveSection] = useState<PlanningSection>('patient');
  const [sectionSaved, setSectionSaved] = useState<Record<PlanningSection, boolean>>({
    patient: false, clinical: false, risk: false, investigations: false, shopping: false,
    procedure: false, results: false, ecg: false, payment: false, checklist: false,
  });

  // --- Booked cases ---
  const [bookedCases, setBookedCases] = useState<any[]>([]);
  const [bookedDateFilter, setBookedDateFilter] = useState('');
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);

  // --- Theatre calendar ---
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string>('');

  // --- Misc ---
  const [saving, setSaving] = useState(false);
  const [nutritionalForm, setNutritionalForm] = useState({
    unplanned_weight_loss: false, bmi_below_18_5: false,
    reduced_intake_past_week: false, severely_ill: false, age_over_70: false,
  });
  const [newMedication, setNewMedication] = useState<Partial<Medication>>({ drug_name: '', dosage: '', frequency: '', route: 'oral', indication: '' });
  const [invResultEntry, setInvResultEntry] = useState<Partial<InvestigationResult>>({ name: '', value: '', flag: 'normal' });
  const [selectedInvForEntry, setSelectedInvForEntry] = useState('');
  const [paramEntries, setParamEntries] = useState<Record<string, string>>({});
  const [shoppingSearch, setShoppingSearch] = useState('');
  const [shoppingCategory, setShoppingCategory] = useState('all');
  const [showRiskMedDb, setShowRiskMedDb] = useState(false);
  const [showInvOCRScanner, setShowInvOCRScanner] = useState(false);
  const [generatingConsentPdf, setGeneratingConsentPdf] = useState(false);
  const [showPreopAssessment, setShowPreopAssessment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ecgInputRef = useRef<HTMLInputElement>(null);
  const consentInputRef = useRef<HTMLInputElement>(null);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  // --- Derived ---
  const patientAge = selectedPatient?.date_of_birth ? calcAge(selectedPatient.date_of_birth) : null;

  // ============================
  // DATA LOADING
  // ============================
  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const list = await patientService.getAllPatients();
      setPatients(list);
    } catch { toast.error('Failed to load patients'); }
    setLoadingPatients(false);
  }, []);

  const loadBookedCases = useCallback(async () => {
    try {
      const all = await schedulingService.getSurgeryBookings();
      setBookedCases(all.filter((b: any) => b.status === 'scheduled' || b.status === 'confirmed'));
    } catch (err) { console.error('Failed to load booked cases:', err); }
  }, []);

  useEffect(() => { loadPatients(); loadBookedCases(); }, [loadPatients, loadBookedCases]);

  // Auto-select patient and section from URL query params (e.g. ?patientId=40&section=risk)
  useEffect(() => {
    const paramId = searchParams.get('patientId');
    const paramSection = searchParams.get('section');
    if (paramId && patients.length > 0 && !selectedPatient) {
      const match = patients.find(p => String(p.id) === paramId);
      if (match) {
        setSelectedPatient(match);
        setActiveSection((paramSection as PlanningSection) || 'risk');
        setActiveTab('surgical-planning');
      }
    }
  }, [searchParams, patients, selectedPatient]);

  // Load saved planning data when patient selected
  useEffect(() => {
    if (!selectedPatient) { setPlanData(null); return; }
    
    const loadPlanData = async () => {
      // 1. Try loading from localStorage first (fastest, for immediate display)
      const saved = loadJSON<Record<string, PreopPlanningData>>(PLANNING_DATA_KEY, {});
      let localData = saved[selectedPatient.id] || null;
      
      // 2. Try loading from server API (authoritative source)
      try {
        const serverData = await apiClient.getSurgeryPlanning(String(selectedPatient.id));
        if (serverData && Object.keys(serverData).length > 1) {
          // Server data is more reliable - use it and update localStorage
          const merged: PreopPlanningData = {
            ...makeDefaultPlan(selectedPatient.id, user?.full_name || 'Unknown'),
            ...serverData,
            patient_id: selectedPatient.id,
          };
          localData = merged;
          // Update localStorage cache
          saved[selectedPatient.id] = merged;
          saveJSON(PLANNING_DATA_KEY, saved);
        }
      } catch (err) {
        console.warn('Could not fetch planning data from server, using local:', err);
      }
      
      if (localData) {
        setPlanData(localData);
        // Mark all non-empty sections as saved
        const d = localData;
        setSectionSaved({
          patient: true,
          clinical: !!(d.diagnosis || d.comorbidities.length || d.current_medications.length),
          risk: !!(d.bleeding_risk || d.dvt_risk || d.cardiovascular_risk || d.pressure_sore_risk || d.nutritional_risk),
          investigations: d.ordered_investigations.length > 0,
          shopping: d.shopping_items.length > 0,
          procedure: !!d.procedure_name,
          results: d.investigation_results.length > 0,
          ecg: !!d.ecg_image,
          payment: !!d.payment_evidence,
          checklist: Object.values(d.checklist).some(v => v),
        });
      } else {
        setPlanData(makeDefaultPlan(selectedPatient.id, user?.full_name || 'Unknown'));
      }
      setActiveSection('clinical');
    };

    loadPlanData();
  }, [selectedPatient, user]);

  // Auto-detect age-conditional labs
  useEffect(() => {
    if (!planData || !selectedPatient) return;
    if (patientAge && patientAge >= 40 && !planData.ordered_investigations.includes('ECG (12-lead)')) {
      updatePlan({ ordered_investigations: [...planData.ordered_investigations, 'ECG (12-lead)'] });
    }
  }, [patientAge, planData?.patient_id]);

  // ============================
  // SAVE / UPDATE PLAN
  // ============================
  const updatePlan = useCallback((partial: Partial<PreopPlanningData>) => {
    setPlanData(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      // Persist to localStorage
      const all = loadJSON<Record<string, PreopPlanningData>>(PLANNING_DATA_KEY, {});
      all[prev.patient_id] = updated;
      saveJSON(PLANNING_DATA_KEY, all);
      return updated;
    });
  }, []);

  const saveSection = useCallback(async (section: PlanningSection) => {
    setSaving(true);
    try {
      if (planData) {
        // 1. Save to localStorage (instant cache)
        const all = loadJSON<Record<string, PreopPlanningData>>(PLANNING_DATA_KEY, {});
        all[planData.patient_id] = planData;
        saveJSON(PLANNING_DATA_KEY, all);

        // 2. Save to server API (persistent cloud storage)
        try {
          await apiClient.saveSurgeryPlanning({
            patient_id: String(planData.patient_id),
            assessed_by: planData.assessed_by,
            ...planData
          });
          console.log('✅ Surgery planning data saved to server');
        } catch (apiErr) {
          console.warn('Could not save planning to server:', apiErr);
          // Data is still in localStorage, will sync on next successful save
        }
      }
      setSectionSaved(prev => ({ ...prev, [section]: true }));
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} section saved`);
    } catch {
      toast.error('Failed to save section');
    }
    setSaving(false);
  }, [planData]);

  const handlePatientSelect = useCallback((p: Patient) => {
    setSelectedPatient(p);
    setActiveSection('clinical');
  }, []);

  // Add medication
  const addMedication = useCallback(() => {
    if (!newMedication.drug_name || !planData) return;
    const med: Medication = {
      drug_name: newMedication.drug_name || '',
      dosage: newMedication.dosage || '',
      frequency: newMedication.frequency || '',
      route: newMedication.route || 'oral',
      indication: newMedication.indication || '',
    };
    const updated = [...planData.current_medications, med];
    const matched = matchSurgicalRiskMeds(updated);
    updatePlan({ current_medications: updated, surgical_risk_medications: matched });
    setNewMedication({ drug_name: '', dosage: '', frequency: '', route: 'oral', indication: '' });
  }, [newMedication, planData, updatePlan]);

  const removeMedication = useCallback((idx: number) => {
    if (!planData) return;
    const updated = planData.current_medications.filter((_, i) => i !== idx);
    const matched = matchSurgicalRiskMeds(updated);
    updatePlan({ current_medications: updated, surgical_risk_medications: matched });
  }, [planData, updatePlan]);

  // Nutritional risk
  const computeNutritionalRisk = useCallback(() => {
    if (!planData) return;
    const result = calculateNutritionalRisk(nutritionalForm);
    updatePlan({ nutritional_risk: result });
    toast.success('Nutritional risk calculated');
  }, [nutritionalForm, planData, updatePlan]);

  // Investigation result entry
  const addInvestigationResult = useCallback(() => {
    if (!planData) return;

    // Multi-parameter mode (from INVESTIGATION_PARAMETERS)
    if (selectedInvForEntry && INVESTIGATION_PARAMETERS[selectedInvForEntry]) {
      const params = INVESTIGATION_PARAMETERS[selectedInvForEntry];
      const filledParams = params.filter(p => paramEntries[p.parameter]?.trim());
      if (filledParams.length === 0) {
        alert('Please enter at least one parameter value');
        return;
      }
      const newResults: InvestigationResult[] = filledParams.map(p => ({
        name: `${selectedInvForEntry} - ${p.parameter}`,
        value: paramEntries[p.parameter],
        unit: p.unit,
        reference_range: p.reference_range,
        flag: autoFlagResult(paramEntries[p.parameter], p.reference_range, p.type),
        enteredBy: user?.full_name || 'Unknown',
        enteredAt: new Date().toISOString(),
      }));
      updatePlan({ investigation_results: [...planData.investigation_results, ...newResults] });
      setSelectedInvForEntry('');
      setParamEntries({});
      toast.success(`${filledParams.length} parameter(s) added for ${selectedInvForEntry}`);
      return;
    }

    // Legacy single-value mode (fallback)
    if (!invResultEntry.name || !invResultEntry.value) return;
    const result: InvestigationResult = {
      name: invResultEntry.name || '',
      value: invResultEntry.value || '',
      unit: invResultEntry.unit,
      reference_range: invResultEntry.reference_range,
      flag: invResultEntry.flag || 'normal',
      enteredBy: user?.full_name || 'Unknown',
      enteredAt: new Date().toISOString(),
    };
    updatePlan({ investigation_results: [...planData.investigation_results, result] });
    setInvResultEntry({ name: '', value: '', flag: 'normal' });
  }, [invResultEntry, selectedInvForEntry, paramEntries, planData, updatePlan, user]);

  // File uploads
  const handleFileUpload = useCallback((file: File, field: 'ecg_image' | 'payment_evidence' | 'consent_document') => {
    const reader = new FileReader();
    reader.onload = () => {
      updatePlan({ [field]: reader.result as string });
      toast.success('File uploaded');
    };
    reader.readAsDataURL(file);
  }, [updatePlan]);

  const handleInvDocUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (!planData) return;
      updatePlan({
        investigation_docs: [...planData.investigation_docs, {
          name: file.name,
          dataUrl: reader.result as string,
          uploadedAt: new Date().toISOString(),
        }],
      });
      toast.success('Investigation document uploaded');
    };
    reader.readAsDataURL(file);
  }, [planData, updatePlan]);

  // ECG AI Interpretation placeholder
  const interpretECG = useCallback(async () => {
    if (!planData?.ecg_image) return;
    toast.loading('Analyzing ECG...');
    // Simulate AI interpretation - in production connect to an ECG interpretation API
    await new Promise(r => setTimeout(r, 1500));
    toast.dismiss();
    const interpretation = 'Normal sinus rhythm. Rate: 72 bpm. PR interval: 0.16s. QRS duration: 0.08s. QTc: 420ms. No ST-T changes. No significant abnormality detected.';
    const recommendations = 'ECG within normal limits. No cardiac contraindication to surgery.';
    updatePlan({ ecg_interpretation: interpretation, ecg_recommendations: recommendations });
    toast.success('ECG interpretation complete');
  }, [planData, updatePlan]);

  // ============================
  // READINESS CHECK & AUTO-BOOK
  // ============================
  const allChecklistComplete = useMemo(() => {
    if (!planData) return false;
    return Object.values(planData.checklist).every(v => v);
  }, [planData]);

  const abnormalInvestigations = useMemo(() => {
    if (!planData) return [];
    return planData.investigation_results.filter(r => r.flag === 'abnormal');
  }, [planData]);

  const missingMandatoryLabs = useMemo(() => {
    if (!planData) return COMPULSORY_INVESTIGATIONS;
    const resultNames = planData.investigation_results.map(r => r.name);
    return COMPULSORY_INVESTIGATIONS.filter(inv =>
      !resultNames.some(name => name === inv || name.startsWith(`${inv} -`) || name.startsWith(`${inv} –`))
    );
  }, [planData]);

  const canAutoBook = useMemo(() => {
    if (!planData || !selectedPatient) return false;
    return allChecklistComplete && missingMandatoryLabs.length === 0 && !!planData.procedure_name && !!planData.anaesthesia_type;
  }, [planData, selectedPatient, allChecklistComplete, missingMandatoryLabs]);

  const handleAutoBook = useCallback(async () => {
    if (!planData || !selectedPatient) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const booking: Record<string, any> = {
        patient_id: selectedPatient.id,
        patient_name: selectedPatient.full_name || `${selectedPatient.first_name || ''} ${selectedPatient.last_name || ''}`.trim(),
        hospital_number: selectedPatient.hospital_number || '',
        patient_age_at_booking: patientAge ?? undefined,
        patient_gender: selectedPatient.sex || selectedPatient.gender || '',
        procedure_name: planData.procedure_name,
        diagnosis: planData.diagnosis || '',
        anaesthesia_type: planData.anaesthesia_type,
        primary_surgeon: planData.assessed_by || user?.name || '',
        proposed_ward: planData.proposed_ward || '',
        date: today,
        start_time: '08:00',
        theatre_number: '',
        status: 'scheduled',
        estimated_duration_minutes: planData.estimated_duration || 60,
        estimated_duration: planData.estimated_duration || 60,
        urgency: 'elective',
        special_requirements: [],
        equipment_needed: planData.shopping_items?.map((i: any) => i.name) || [],
        implants_needed: [],
        anaesthetist: '',
        scrub_nurse: '',
        comorbidities: planData.comorbidities || [],
        is_diabetic: (planData.comorbidities || []).some((c: string) => c.toLowerCase().includes('diabetes')),
        is_hiv_positive: (planData.comorbidities || []).some((c: string) => c.toLowerCase().includes('hiv')),
      };
      await schedulingService.createSurgeryBooking(booking as any);
      toast.success('Patient booked for surgery!');
      // Clear planning data for this patient
      const all = loadJSON<Record<string, PreopPlanningData>>(PLANNING_DATA_KEY, {});
      delete all[selectedPatient.id];
      saveJSON(PLANNING_DATA_KEY, all);
      setSelectedPatient(null);
      setPlanData(null);
      loadBookedCases();
      setActiveTab('booked-cases');
    } catch (err) {
      toast.error('Failed to book surgery');
    }
    setSaving(false);
  }, [planData, selectedPatient, patientAge, user, loadBookedCases]);

  // ============================
  // PDF GENERATORS
  // ============================
  const generateOperationListPDF = useCallback((date: string) => {
    const dayCases = bookedCases.filter(c => c.date === date).sort(prioritySort);
    if (dayCases.length === 0) { toast.error('No cases booked for this date'); return; }
    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFont('Georgia', 'normal');
    let y = 15;
    doc.setFontSize(16);
    doc.text('OPERATION LIST', 105, y, { align: 'center' }); y += 7;
    doc.setFontSize(11);
    doc.text('Plastic Surgery Unit', 105, y, { align: 'center' }); y += 6;
    doc.text(safeFormatDate(date, 'EEEE, MMMM d, yyyy'), 105, y, { align: 'center' }); y += 10;

    // Table header
    doc.setFontSize(9);
    doc.setFont('Georgia', 'bold');
    const cols = [10, 45, 60, 80, 20, 18, 30, 45, 50];
    const headers = ['S/N', 'Patient Name', 'PT Number', 'Diagnosis', 'Age', 'Sex', 'Ward', 'Procedure', 'Surgeon'];
    headers.forEach((h, i) => doc.text(h, cols[i], y));
    y += 2;
    doc.setDrawColor(0); doc.line(10, y, 200, y); y += 5;
    doc.setFont('Georgia', 'normal');

    dayCases.forEach((c, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      const row = [
        String(idx + 1),
        c.patient_name || c.patient?.full_name || '-',
        c.hospital_number || c.patient?.hospital_number || '-',
        c.diagnosis || '-',
        c.patient_age_at_booking ? String(c.patient_age_at_booking) : '-',
        c.patient_gender || c.patient?.gender?.charAt(0)?.toUpperCase() || '-',
        c.proposed_ward || '-',
        c.procedure_name || '-',
        c.primary_surgeon || '-',
      ];
      row.forEach((cell, i) => {
        const maxW = (cols[i + 1] || 200) - cols[i] - 2;
        doc.text(String(cell).substring(0, maxW / 2), cols[i], y);
      });
      y += 6;
    });

    y += 5;
    doc.setFontSize(8);
    doc.text('Total Cases: ' + dayCases.length, 10, y);
    addFooter(doc, 'Operation List');
    doc.save('Operation_List_' + date + '.pdf');
    toast.success('Operation list PDF downloaded');
  }, [bookedCases]);

  const generateInvestigationRequestThermal = useCallback(() => {
    if (!planData || !selectedPatient) return;
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    doc.setFont('times', 'normal');
    let y = 4;
    doc.setFontSize(9);
    doc.text('INVESTIGATION REQUEST', 40, y, { align: 'center' }); y += 5;
    doc.setFontSize(7);
    doc.text('Plastic Surgery Unit', 40, y, { align: 'center' }); y += 4;
    doc.line(3, y, 77, y); y += 4;
    doc.text('Patient: ' + selectedPatient.full_name, 3, y); y += 4;
    doc.text('PT#: ' + selectedPatient.hospital_number, 3, y); y += 4;
    doc.text('Date: ' + new Date().toLocaleDateString(), 3, y); y += 5;
    doc.line(3, y, 77, y); y += 4;
    doc.setFontSize(8);
    doc.text('INVESTIGATIONS REQUESTED:', 3, y); y += 4;
    doc.setFontSize(7);
    planData.ordered_investigations.forEach((inv, idx) => {
      if (y > 190) { doc.addPage([80, 200]); y = 4; }
      const isCompulsory = COMPULSORY_INVESTIGATIONS.includes(inv);
      doc.text((idx + 1) + '. ' + inv + (isCompulsory ? ' *' : ''), 5, y); y += 4;
    });
    y += 3;
    doc.setFontSize(6);
    doc.text('* = Compulsory pre-operative investigation', 3, y); y += 4;
    doc.text('Requested by: ' + (planData.assessed_by || '-'), 3, y);
    doc.save('Investigation_Request_' + selectedPatient.hospital_number + '.pdf');
    toast.success('Thermal investigation request generated');
  }, [planData, selectedPatient]);

  const generateShoppingListThermal = useCallback(() => {
    if (!planData || !selectedPatient || planData.shopping_items.length === 0) {
      toast.error('No items in shopping list'); return;
    }
    const doc = new jsPDF({ unit: 'mm', format: [80, 200] });
    doc.setFont('times', 'normal');
    let y = 4;
    doc.setFontSize(9);
    doc.text('SURGICAL SHOPPING LIST', 40, y, { align: 'center' }); y += 5;
    doc.setFontSize(7);
    doc.text('Patient: ' + selectedPatient.full_name, 3, y); y += 4;
    doc.text('PT#: ' + selectedPatient.hospital_number, 3, y); y += 4;
    doc.text('Procedure: ' + (planData.procedure_name || '-'), 3, y); y += 4;
    doc.text('Date: ' + new Date().toLocaleDateString(), 3, y); y += 4;
    doc.line(3, y, 77, y); y += 4;
    // Group by category
    const grouped: Record<string, typeof planData.shopping_items> = {};
    planData.shopping_items.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });
    Object.entries(grouped).forEach(([cat, items]) => {
      if (y > 185) { doc.addPage([80, 200]); y = 4; }
      doc.setFontSize(7);
      doc.text(cat.toUpperCase(), 3, y); y += 4;
      doc.setFontSize(6);
      items.forEach(item => {
        doc.text('  [ ] ' + item.name + ' x' + item.quantity, 5, y); y += 3.5;
      });
      y += 2;
    });
    doc.save('Shopping_List_' + selectedPatient.hospital_number + '.pdf');
    toast.success('Thermal shopping list generated');
  }, [planData, selectedPatient]);

  // --- A4 PDF: Investigation Request ---
  const generateInvestigationRequestPDF = useCallback(() => {
    if (!planData || !selectedPatient) return;
    const doc = createPDF();
    let y = addPDFHeader(doc, 'INVESTIGATION REQUEST FORM');
    y += 2;
    addLabeledField(doc, 'Patient Name', selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`, PDF_MARGINS.left, y);
    y += PDF_LINE_HEIGHT;
    addTwoColumnText(doc, 'Hospital No: ' + (selectedPatient.hospital_number || '-'), 'Date: ' + formatDateForPDF(new Date().toISOString()), y);
    y += PDF_LINE_HEIGHT;
    addTwoColumnText(doc, 'Gender: ' + (selectedPatient.gender || '-'), 'Age: ' + (patientAge ?? '-') + ' years', y);
    y += PDF_LINE_HEIGHT;
    if (planData.diagnosis) {
      addLabeledField(doc, 'Diagnosis', sanitizeTextForPDF(planData.diagnosis), PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
    }
    if (planData.procedure_name) {
      addLabeledField(doc, 'Proposed Procedure', sanitizeTextForPDF(planData.procedure_name), PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
    }
    y += 2;
    addSeparator(doc, y); y += 4;

    y = addSectionHeader(doc, 'COMPULSORY PRE-OPERATIVE INVESTIGATIONS', y);
    const compulsoryItems = COMPULSORY_INVESTIGATIONS.map((inv, idx) => {
      const hasResult = planData.investigation_results.some(r => r.name === inv);
      return `${idx + 1}. ${inv}${hasResult ? ' ✓ (Result received)' : ''}`;
    });
    y = addBulletList(doc, compulsoryItems, y);
    y += 4;

    const optionalOrdered = planData.ordered_investigations.filter(inv => !COMPULSORY_INVESTIGATIONS.includes(inv));
    if (optionalOrdered.length > 0) {
      y = addSectionHeader(doc, 'ADDITIONAL INVESTIGATIONS REQUESTED', y);
      const optItems = optionalOrdered.map((inv, idx) => {
        const hasResult = planData.investigation_results.some(r => r.name === inv);
        return `${idx + 1}. ${inv}${hasResult ? ' ✓ (Result received)' : ''}`;
      });
      y = addBulletList(doc, optItems, y);
      y += 4;
    }

    y += 6;
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.text('Total Investigations: ' + planData.ordered_investigations.length, PDF_MARGINS.left, y);
    y += PDF_LINE_HEIGHT * 2;
    doc.text('Requested by: ' + (planData.assessed_by || '-'), PDF_MARGINS.left, y);
    y += PDF_LINE_HEIGHT;
    doc.text('Signature: ____________________________', PDF_MARGINS.left, y);

    addFooter(doc, 'Investigation Request');
    doc.save('Investigation_Request_' + selectedPatient.hospital_number + '.pdf');
    toast.success('Investigation request PDF downloaded');
  }, [planData, selectedPatient, patientAge]);

  // --- A4 PDF: Shopping List ---
  const generateShoppingListPDF = useCallback(() => {
    if (!planData || !selectedPatient || planData.shopping_items.length === 0) {
      toast.error('No items in shopping list'); return;
    }
    const doc = createPDF();
    let y = addPDFHeader(doc, 'SURGICAL SHOPPING LIST');
    y += 2;
    addLabeledField(doc, 'Patient Name', selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`, PDF_MARGINS.left, y);
    y += PDF_LINE_HEIGHT;
    addTwoColumnText(doc, 'Hospital No: ' + (selectedPatient.hospital_number || '-'), 'Date: ' + formatDateForPDF(new Date().toISOString()), y);
    y += PDF_LINE_HEIGHT;
    if (planData.procedure_name) {
      addLabeledField(doc, 'Proposed Procedure', sanitizeTextForPDF(planData.procedure_name), PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
    }
    if (planData.anaesthesia_type) {
      addLabeledField(doc, 'Anaesthesia Type', planData.anaesthesia_type, PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
    }
    y += 2;
    addSeparator(doc, y); y += 4;

    // Group by category
    const grouped: Record<string, typeof planData.shopping_items> = {};
    planData.shopping_items.forEach(item => {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    });

    Object.entries(grouped).forEach(([cat, items]) => {
      if (needsNewPage(doc, y, 30)) { doc.addPage(); y = PDF_MARGINS.top; }
      y = addSectionHeader(doc, cat.toUpperCase(), y);
      const tableData = items.map((item, idx) => [
        String(idx + 1),
        item.name,
        String(item.quantity),
        '☐', // checkbox for procurement
      ]);
      y = addSimpleTable(doc, ['S/N', 'Item', 'Qty', 'Procured'], tableData, y);
      y += 4;
    });

    y += 6;
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.text('Total Items: ' + planData.shopping_items.length, PDF_MARGINS.left, y);
    y += PDF_LINE_HEIGHT * 2;
    doc.text('Prepared by: ' + (planData.assessed_by || '-'), PDF_MARGINS.left, y);
    y += PDF_LINE_HEIGHT;
    doc.text('Verified by: ____________________________', PDF_MARGINS.left, y);

    addFooter(doc, 'Surgical Shopping List');
    doc.save('Shopping_List_' + selectedPatient.hospital_number + '.pdf');
    toast.success('Shopping list PDF downloaded');
  }, [planData, selectedPatient]);

  // --- Informed Consent Form PDF ---
  const generateInformedConsentPDF = useCallback(() => {
    if (!planData || !selectedPatient) return;
    setGeneratingConsentPdf(true);
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'INFORMED CONSENT FOR SURGICAL PROCEDURE');
      y += 4;

      // Patient information
      y = addSectionHeader(doc, 'PATIENT INFORMATION', y);
      addLabeledField(doc, 'Patient Name', selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`, PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      addTwoColumnText(doc, 'Hospital No: ' + (selectedPatient.hospital_number || '-'), 'Date: ' + formatDateForPDF(new Date().toISOString()), y);
      y += PDF_LINE_HEIGHT;
      addTwoColumnText(doc, 'Gender: ' + (selectedPatient.gender || '-'), 'Age: ' + (patientAge ?? '-') + ' years', y);
      y += PDF_LINE_HEIGHT;
      if (planData.diagnosis) {
        addLabeledField(doc, 'Diagnosis', sanitizeTextForPDF(planData.diagnosis), PDF_MARGINS.left, y);
        y += PDF_LINE_HEIGHT;
      }
      y += 2;
      addSeparator(doc, y); y += 6;

      // Procedure details
      y = addSectionHeader(doc, 'PROCEDURE DETAILS', y);
      addLabeledField(doc, 'Name of Procedure', sanitizeTextForPDF(planData.procedure_name || '____________________________'), PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      addLabeledField(doc, 'Anaesthesia Type', planData.anaesthesia_type || '____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      addLabeledField(doc, 'Surgeon', planData.assessed_by || '____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT + 2;
      addSeparator(doc, y); y += 6;

      // Consent declaration
      y = addSectionHeader(doc, 'CONSENT DECLARATION', y);
      const consentText = [
        'I, the undersigned, hereby confirm that:',
        '',
        '1. I have been informed about my diagnosis and the nature of the proposed surgical procedure described above.',
        '',
        '2. The surgeon has explained to me the expected benefits, potential risks, and possible complications of the procedure, including but not limited to: bleeding, infection, scarring, nerve damage, adverse reaction to anaesthesia, and the possibility of additional procedures.',
        '',
        '3. I have been informed of alternative treatment options, including the option of no treatment, and their respective risks and benefits.',
        '',
        '4. I understand that no guarantees have been made regarding the outcome of the procedure.',
        '',
        '5. I have had the opportunity to ask questions and all my questions have been answered to my satisfaction.',
        '',
        '6. I voluntarily consent to the performance of the above-described procedure and any additional procedures that the surgeon deems necessary during the course of surgery.',
        '',
        '7. I consent to the administration of anaesthesia as described above.',
        '',
        '8. I consent to the disposal of any tissues or body parts removed during the procedure.',
      ];

      doc.setFontSize(PDF_FONT_SIZES.body);
      const maxWidth = PDF_PAGE.contentWidth;
      consentText.forEach(line => {
        if (needsNewPage(doc, y, 10)) { doc.addPage(); y = PDF_MARGINS.top; }
        if (line === '') { y += 3; return; }
        const lines = doc.splitTextToSize(line, maxWidth);
        doc.text(lines, PDF_MARGINS.left, y);
        y += lines.length * (PDF_LINE_HEIGHT * 0.7);
      });

      y += 8;
      if (needsNewPage(doc, y, 60)) { doc.addPage(); y = PDF_MARGINS.top; }

      // Signature section
      y = addSectionHeader(doc, 'SIGNATURES', y);
      y += 4;
      doc.setFontSize(PDF_FONT_SIZES.body);

      // Patient signature
      doc.text('Patient / Guardian Signature: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Print Name: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Date: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Relationship (if guardian): ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT * 1.5;

      // Witness
      doc.text('Witness Signature: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Print Name: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Date: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT * 1.5;

      // Surgeon
      doc.text('Surgeon Signature: ____________________________', PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Print Name: ' + (planData.assessed_by || '____________________________'), PDF_MARGINS.left, y);
      y += PDF_LINE_HEIGHT;
      doc.text('Date: ' + formatDateForPDF(new Date().toISOString()), PDF_MARGINS.left, y);

      addFooter(doc, 'Informed Consent Form');
      doc.save('Informed_Consent_' + selectedPatient.hospital_number + '.pdf');
      toast.success('Informed consent form downloaded');
    } catch {
      toast.error('Failed to generate consent form');
    }
    setGeneratingConsentPdf(false);
  }, [planData, selectedPatient, patientAge]);

  // ============================
  // THEATRE CALENDAR HELPERS
  // ============================
  const getDayUsedSlots = useCallback((date: string) => {
    return bookedCases.filter(c => c.date === date)
      .reduce((sum, c) => sum + (CASE_WEIGHTS[c.case_category as CaseCategory] || 2), 0);
  }, [bookedCases]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean; }[] = [];
    // Padding
    for (let i = 0; i < firstDay; i++) {
      const d = new Date(year, month, -firstDay + i + 1);
      days.push({ date: d.toISOString().split('T')[0], day: d.getDate(), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({ date: date.toISOString().split('T')[0], day: d, isCurrentMonth: true });
    }
    return days;
  }, [calendarMonth]);

  const filteredBookedCases = useMemo(() => {
    let cases = [...bookedCases];
    if (bookedDateFilter) cases = cases.filter(c => c.date === bookedDateFilter);
    return cases.sort(prioritySort);
  }, [bookedCases, bookedDateFilter]);

  // Group booked cases by date for display
  const bookedByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredBookedCases.forEach(c => {
      const d = c.date || 'Unscheduled';
      if (!map[d]) map[d] = [];
      map[d].push(c);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredBookedCases]);

  // ============================
  // SHOPPING LIST ITEMS (from ShoppingList constants)
  // ============================
  const SHOPPING_ITEMS: Array<{ name: string; category: string; }> = useMemo(() => [
    // Cannulas
    { name: 'IV Cannula 14G (Orange)', category: 'Cannulas' },
    { name: 'IV Cannula 16G (Grey)', category: 'Cannulas' },
    { name: 'IV Cannula 18G (Green)', category: 'Cannulas' },
    { name: 'IV Cannula 20G (Pink)', category: 'Cannulas' },
    { name: 'IV Cannula 22G (Blue)', category: 'Cannulas' },
    { name: 'IV Cannula 24G (Yellow)', category: 'Cannulas' },
    // Giving Sets & Syringes
    { name: 'IV Giving Set (Standard)', category: 'Giving Sets' },
    { name: 'Blood Giving Set', category: 'Giving Sets' },
    { name: 'Burette Giving Set', category: 'Giving Sets' },
    { name: 'Syringe 2ml', category: 'Syringes' },
    { name: 'Syringe 5ml', category: 'Syringes' },
    { name: 'Syringe 10ml', category: 'Syringes' },
    { name: 'Syringe 20ml', category: 'Syringes' },
    { name: 'Syringe 50ml', category: 'Syringes' },
    // IV Fluids
    { name: 'Normal Saline 0.9% 500ml', category: 'IV Fluids' },
    { name: 'Normal Saline 0.9% 1L', category: 'IV Fluids' },
    { name: 'Ringer\'s Lactate 500ml', category: 'IV Fluids' },
    { name: 'Ringer\'s Lactate 1L', category: 'IV Fluids' },
    { name: 'Dextrose 5% 500ml', category: 'IV Fluids' },
    { name: 'Dextrose Saline 500ml', category: 'IV Fluids' },
    { name: 'Dextrose Saline 1L', category: 'IV Fluids' },
    { name: 'Gelofusine 500ml', category: 'IV Fluids' },
    { name: 'Haemaccel 500ml', category: 'IV Fluids' },
    // Gloves
    { name: 'Surgical Gloves 6.5', category: 'Gloves' },
    { name: 'Surgical Gloves 7.0', category: 'Gloves' },
    { name: 'Surgical Gloves 7.5', category: 'Gloves' },
    { name: 'Surgical Gloves 8.0', category: 'Gloves' },
    { name: 'Examination Gloves (Medium)', category: 'Gloves' },
    { name: 'Examination Gloves (Large)', category: 'Gloves' },
    // Anaesthetics & Injectables
    { name: 'Lidocaine 1% 20ml', category: 'Anaesthetics' },
    { name: 'Lidocaine 2% 20ml', category: 'Anaesthetics' },
    { name: 'Bupivacaine 0.5% 20ml', category: 'Anaesthetics' },
    { name: 'Lidocaine + Adrenaline 2% 20ml', category: 'Anaesthetics' },
    { name: 'Ketamine 500mg/10ml', category: 'Anaesthetics' },
    { name: 'Propofol 200mg/20ml', category: 'Anaesthetics' },
    { name: 'Atropine 0.6mg/ml', category: 'Injectables' },
    { name: 'Adrenaline 1mg/ml', category: 'Injectables' },
    { name: 'Metoclopramide 10mg/2ml', category: 'Injectables' },
    { name: 'Ondansetron 4mg/2ml', category: 'Injectables' },
    { name: 'Tramadol 100mg/2ml', category: 'Injectables' },
    { name: 'Pentazocine 30mg/ml', category: 'Injectables' },
    { name: 'Diclofenac 75mg/3ml', category: 'Injectables' },
    { name: 'Paracetamol 1g/100ml IV', category: 'Injectables' },
    // Antibiotics
    { name: 'Ceftriaxone 1g (IV)', category: 'Antibiotics' },
    { name: 'Metronidazole 500mg (IV)', category: 'Antibiotics' },
    { name: 'Augmentin 1.2g (IV)', category: 'Antibiotics' },
    { name: 'Ciprofloxacin 200mg (IV)', category: 'Antibiotics' },
    { name: 'Gentamicin 80mg (IV)', category: 'Antibiotics' },
    // Sutures
    { name: 'Vicryl 2-0', category: 'Sutures' },
    { name: 'Vicryl 3-0', category: 'Sutures' },
    { name: 'Vicryl 4-0', category: 'Sutures' },
    { name: 'Vicryl 5-0', category: 'Sutures' },
    { name: 'Prolene 3-0', category: 'Sutures' },
    { name: 'Prolene 4-0', category: 'Sutures' },
    { name: 'Prolene 5-0', category: 'Sutures' },
    { name: 'Nylon 2-0', category: 'Sutures' },
    { name: 'Nylon 3-0', category: 'Sutures' },
    { name: 'Nylon 4-0', category: 'Sutures' },
    { name: 'Nylon 5-0', category: 'Sutures' },
    { name: 'PDS 3-0', category: 'Sutures' },
    { name: 'PDS 4-0', category: 'Sutures' },
    { name: 'Chromic Catgut 2-0', category: 'Sutures' },
    { name: 'Silk 2-0', category: 'Sutures' },
    { name: 'Silk 3-0', category: 'Sutures' },
    // Dressings & Antiseptics
    { name: 'Gauze Swabs (pack of 5)', category: 'Dressings' },
    { name: 'Abdominal Pad', category: 'Dressings' },
    { name: 'Elastic Adhesive Bandage', category: 'Dressings' },
    { name: 'Micropore Tape 1 inch', category: 'Dressings' },
    { name: 'Crepe Bandage 4 inch', category: 'Dressings' },
    { name: 'Crepe Bandage 6 inch', category: 'Dressings' },
    { name: 'Cotton Wool Roll', category: 'Dressings' },
    { name: 'Povidone-Iodine 10% 500ml', category: 'Antiseptics' },
    { name: 'Chlorhexidine 4% 500ml', category: 'Antiseptics' },
    { name: 'Hydrogen Peroxide 6% 500ml', category: 'Antiseptics' },
    { name: 'Methylated Spirit 500ml', category: 'Antiseptics' },
    { name: 'Normal Saline for Irrigation 1L', category: 'Antiseptics' },
    // Catheters & Drains
    { name: 'Foley Catheter 14Fr', category: 'Catheters' },
    { name: 'Foley Catheter 16Fr', category: 'Catheters' },
    { name: 'Foley Catheter 18Fr', category: 'Catheters' },
    { name: 'Urine Bag 2L', category: 'Catheters' },
    { name: 'Nasogastric Tube 14Fr', category: 'Catheters' },
    { name: 'Nasogastric Tube 16Fr', category: 'Catheters' },
    { name: 'Suction Catheter 14Fr', category: 'Catheters' },
    { name: 'Wound Drain (Redivac)', category: 'Drains' },
    { name: 'Penrose Drain', category: 'Drains' },
    { name: 'Chest Drain 28Fr', category: 'Drains' },
    // Surgical Instruments
    { name: 'Scalpel Blade No. 10', category: 'Instruments' },
    { name: 'Scalpel Blade No. 11', category: 'Instruments' },
    { name: 'Scalpel Blade No. 15', category: 'Instruments' },
    { name: 'Scalpel Handle No. 3', category: 'Instruments' },
    { name: 'Scalpel Handle No. 4', category: 'Instruments' },
    { name: 'Needle Holder', category: 'Instruments' },
    { name: 'Artery Forceps (curved)', category: 'Instruments' },
    { name: 'Artery Forceps (straight)', category: 'Instruments' },
    { name: 'Tissue Forceps', category: 'Instruments' },
    { name: 'Adson Forceps', category: 'Instruments' },
    { name: 'Scissors (Mayo)', category: 'Instruments' },
    { name: 'Scissors (Metzenbaum)', category: 'Instruments' },
    { name: 'Retractor (Langenbeck)', category: 'Instruments' },
    { name: 'Retractor (Self-retaining)', category: 'Instruments' },
    { name: 'Skin Hooks', category: 'Instruments' },
    { name: 'Diathermy Pencil', category: 'Instruments' },
    { name: 'Diathermy Pad', category: 'Instruments' },
    // Splints & Miscellaneous
    { name: 'POP Bandage 4 inch', category: 'Splints' },
    { name: 'POP Bandage 6 inch', category: 'Splints' },
    { name: 'Thermoplastic Splint', category: 'Splints' },
    { name: 'Finger Splint (Aluminium)', category: 'Splints' },
    { name: 'Tourniquet', category: 'Miscellaneous' },
    { name: 'Skin Marker Pen', category: 'Miscellaneous' },
    { name: 'Specimen Container', category: 'Miscellaneous' },
    { name: 'Sterile Drape Pack', category: 'Miscellaneous' },
  ], []);

  const shoppingCategories = useMemo(() => {
    const cats = [...new Set(SHOPPING_ITEMS.map(i => i.category))];
    return ['all', ...cats];
  }, [SHOPPING_ITEMS]);

  const filteredShoppingItems = useMemo(() => {
    let items = SHOPPING_ITEMS;
    if (shoppingCategory !== 'all') items = items.filter(i => i.category === shoppingCategory);
    if (shoppingSearch) items = items.filter(i => i.name.toLowerCase().includes(shoppingSearch.toLowerCase()));
    return items;
  }, [SHOPPING_ITEMS, shoppingSearch, shoppingCategory]);

  const addShoppingItem = useCallback((item: { name: string; category: string }) => {
    if (!planData) return;
    const existing = planData.shopping_items.find(i => i.name === item.name);
    if (existing) {
      updatePlan({
        shopping_items: planData.shopping_items.map(i =>
          i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i
        ),
      });
    } else {
      updatePlan({ shopping_items: [...planData.shopping_items, { ...item, quantity: 1 }] });
    }
  }, [planData, updatePlan]);

  const removeShoppingItem = useCallback((name: string) => {
    if (!planData) return;
    updatePlan({ shopping_items: planData.shopping_items.filter(i => i.name !== name) });
  }, [planData, updatePlan]);

  const updateShoppingQuantity = useCallback((name: string, delta: number) => {
    if (!planData) return;
    updatePlan({
      shopping_items: planData.shopping_items.map(i =>
        i.name === name ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i
      ),
    });
  }, [planData, updatePlan]);

  // ============================
  // Planning section navigation
  // ============================
  const SECTIONS: { key: PlanningSection; label: string; icon: React.ReactNode; }[] = [
    { key: 'patient', label: 'Patient', icon: <User size={16} /> },
    { key: 'clinical', label: 'Clinical Summary', icon: <Stethoscope size={16} /> },
    { key: 'risk', label: 'Risk Assessment', icon: <Shield size={16} /> },
    { key: 'investigations', label: 'Investigations', icon: <FlaskConical size={16} /> },
    { key: 'shopping', label: 'Shopping List', icon: <ShoppingCart size={16} /> },
    { key: 'procedure', label: 'Procedure', icon: <Scissors size={16} /> },
    { key: 'results', label: 'Results Upload', icon: <Upload size={16} /> },
    { key: 'ecg', label: 'ECG', icon: <Activity size={16} /> },
    { key: 'payment', label: 'Payment', icon: <CreditCard size={16} /> },
    { key: 'checklist', label: 'Readiness', icon: <ListChecks size={16} /> },
  ];

  // ============================
  // RENDER
  // ============================
  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Surgery Booking Register</h1>
          <p className="text-sm text-gray-500">Pre-operative planning, booking & theatre management</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 overflow-x-auto">
        {([
          { key: 'surgical-planning' as TabKey, label: 'Surgical Planning', icon: <ClipboardCheck size={16} /> },
          { key: 'booked-cases' as TabKey, label: 'Booked Cases', icon: <Users size={16} /> },
          { key: 'theatre-calendar' as TabKey, label: 'Theatre Calendar', icon: <Calendar size={16} /> },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.key ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== TAB 1: SURGICAL PLANNING ===== */}
      {activeTab === 'surgical-planning' && (
        <div>
          {/* Patient Selection */}
          {!selectedPatient ? (
            <div className="bg-white rounded-xl border p-4">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><User size={20} className="text-green-600" /> Select or Register Patient</h2>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or hospital number..."
                  value={patientSearch}
                  onChange={e => { setPatientSearch(e.target.value); if (!patients.length) loadPatients(); }}
                  className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              {loadingPatients && <div className="flex items-center gap-2 text-gray-500 py-4"><Loader2 size={16} className="animate-spin" /> Loading patients...</div>}
              <div className="max-h-80 overflow-y-auto divide-y">
                {patients
                  .filter(p => {
                    if (!patientSearch) return true;
                    const q = patientSearch.toLowerCase();
                    return p.full_name?.toLowerCase().includes(q) || p.hospital_number?.toLowerCase().includes(q);
                  })
                  .slice(0, 50)
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePatientSelect(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm">
                        {p.full_name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 truncate">{p.full_name}</p>
                        <p className="text-xs text-gray-500">{p.hospital_number} &bull; {p.gender} &bull; {p.date_of_birth ? calcAge(p.date_of_birth) + 'yrs' : ''}</p>
                      </div>
                    </button>
                  ))}
              </div>
              <button
                onClick={() => navigate('/patients?action=register&returnTo=/booking-register')}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
              >
                <Plus size={16} /> Register New Patient
              </button>
            </div>
          ) : (
            <div>
              {/* Patient header bar */}
              <div className="bg-white rounded-xl border p-3 mb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold">
                  {selectedPatient.full_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{selectedPatient.full_name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedPatient.hospital_number} &bull; {selectedPatient.gender} &bull; {patientAge}yrs
                    {selectedPatient.ward ? ` • Ward: ${selectedPatient.ward}` : ''}
                  </p>
                </div>
                <button onClick={() => { setSelectedPatient(null); setPlanData(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                  <X size={18} />
                </button>
              </div>

              {/* Section sidebar + content */}
              <div className="flex gap-3">
                {/* Sidebar */}
                <div className="w-48 flex-shrink-0 hidden md:block">
                  <nav className="bg-white rounded-xl border divide-y overflow-hidden">
                    {SECTIONS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setActiveSection(s.key)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${activeSection === s.key ? 'bg-green-50 text-green-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        {s.icon}
                        <span className="flex-1 truncate">{s.label}</span>
                        {sectionSaved[s.key] && <CheckCircle size={14} className="text-green-500" />}
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Mobile section picker */}
                <div className="md:hidden w-full mb-3">
                  <select
                    value={activeSection}
                    onChange={e => setActiveSection(e.target.value as PlanningSection)}
                    className="w-full border rounded-lg px-3 py-2.5 text-sm"
                  >
                    {SECTIONS.map(s => (
                      <option key={s.key} value={s.key}>{s.label} {sectionSaved[s.key] ? '\u2713' : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Content panels */}
                <div className="flex-1 min-w-0">
                  {/* ---- CLINICAL SUMMARY SECTION ---- */}
                  {activeSection === 'clinical' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Stethoscope size={20} className="text-green-600" /> Clinical Summary</h3>
                        <button onClick={() => saveSection('clinical')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>

                      {/* Diagnosis */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                        <textarea
                          value={planData.diagnosis}
                          onChange={e => updatePlan({ diagnosis: e.target.value })}
                          rows={2}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                          placeholder="Enter primary diagnosis..."
                        />
                      </div>

                      {/* Comorbidities */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Comorbidities</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {planData.comorbidities.map(c => (
                            <span key={c} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 rounded-full text-xs">
                              {c}
                              <button onClick={() => updatePlan({ comorbidities: planData.comorbidities.filter(x => x !== c) })} className="hover:text-red-900"><X size={12} /></button>
                            </span>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-40 overflow-y-auto border rounded-lg p-2">
                          {COMORBIDITY_OPTIONS.filter(c => !planData.comorbidities.includes(c)).map(c => (
                            <button
                              key={c}
                              onClick={() => updatePlan({ comorbidities: [...planData.comorbidities, c] })}
                              className="text-left text-xs px-2 py-1.5 rounded hover:bg-green-50 text-gray-700"
                            >
                              + {c}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Current Medications */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
                        {planData.current_medications.length > 0 && (
                          <div className="space-y-1 mb-2">
                            {planData.current_medications.map((med, idx) => (
                              <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                                <span className="flex-1"><strong>{med.drug_name}</strong> {med.dosage} {med.frequency} ({med.route}) - {med.indication}</span>
                                <button onClick={() => removeMedication(idx)} className="text-red-500 hover:text-red-700"><X size={14} /></button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <input placeholder="Drug name" value={newMedication.drug_name || ''} onChange={e => setNewMedication(p => ({ ...p, drug_name: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                          <input placeholder="Dosage" value={newMedication.dosage || ''} onChange={e => setNewMedication(p => ({ ...p, dosage: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                          <input placeholder="Frequency" value={newMedication.frequency || ''} onChange={e => setNewMedication(p => ({ ...p, frequency: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                          <select value={newMedication.route || 'oral'} onChange={e => setNewMedication(p => ({ ...p, route: e.target.value as Medication['route'] }))} className="border rounded px-2 py-1.5 text-sm">
                            <option value="oral">Oral</option><option value="IV">IV</option><option value="IM">IM</option><option value="SC">SC</option><option value="topical">Topical</option><option value="other">Other</option>
                          </select>
                          <input placeholder="Indication" value={newMedication.indication || ''} onChange={e => setNewMedication(p => ({ ...p, indication: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                        </div>
                        <button onClick={addMedication} disabled={!newMedication.drug_name} className="mt-2 flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                          <Plus size={14} /> Add Medication
                        </button>
                      </div>

                      {/* Surgical Risk Medications Warning */}
                      {planData.surgical_risk_medications.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                          <h4 className="text-sm font-semibold text-red-800 flex items-center gap-1 mb-2"><AlertTriangle size={16} /> Surgical Risk Medications Detected</h4>
                          <div className="space-y-2">
                            {planData.surgical_risk_medications.map((srm, idx) => (
                              <div key={idx} className="bg-white rounded-lg p-2 border border-red-100">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                                  <span className="font-medium text-sm">{srm.drug}</span>
                                  <span className="text-xs text-gray-500">({srm.class})</span>
                                </div>
                                <p className="text-xs text-red-700 mt-1"><strong>Action:</strong> {srm.action}</p>
                                <p className="text-xs text-red-700"><strong>Timing:</strong> {srm.timing}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Browse all risk medications */}
                      <div>
                        <button onClick={() => setShowRiskMedDb(!showRiskMedDb)} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                          <BookOpen size={14} /> {showRiskMedDb ? 'Hide' : 'Browse'} Surgical Risk Medications Database ({SURGICAL_RISK_MEDICATIONS.length} drugs)
                        </button>
                        {showRiskMedDb && (
                          <div className="mt-2 max-h-60 overflow-y-auto border rounded-lg divide-y">
                            {SURGICAL_RISK_MEDICATIONS.map((srm, idx) => (
                              <div key={idx} className="px-3 py-2 text-xs hover:bg-gray-50">
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                                  <strong>{srm.drug}</strong> <span className="text-gray-500">({srm.class})</span>
                                </div>
                                <p className="text-gray-600 mt-0.5">{srm.action} — <strong>{srm.timing}</strong></p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ---- RISK ASSESSMENT SECTION ---- */}
                  {activeSection === 'risk' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Shield size={20} className="text-green-600" /> Risk Assessments</h3>
                        <button onClick={() => saveSection('risk')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>

                      {/* Risk score grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {[
                          { label: 'Bleeding Risk', key: 'bleeding_risk', data: planData.bleeding_risk },
                          { label: 'DVT Risk (Caprini)', key: 'dvt_risk', data: planData.dvt_risk },
                          { label: 'Cardiovascular', key: 'cardiovascular_risk', data: planData.cardiovascular_risk },
                          { label: 'Pressure Sore', key: 'pressure_sore_risk', data: planData.pressure_sore_risk },
                          { label: 'Nutritional', key: 'nutritional_risk', data: planData.nutritional_risk },
                        ].map(item => {
                          const level = item.data?.risk_level;
                          const color = level === 'high' || level === 'severe' ? 'bg-red-50 border-red-200 text-red-700'
                            : level === 'moderate' || level === 'intermediate' ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                            : level ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-gray-50 border-gray-200 text-gray-400';
                          return (
                            <div key={item.key} className={`rounded-xl border p-3 text-center ${color}`}>
                              <p className="text-xs font-medium opacity-75">{item.label}</p>
                              <p className="text-lg font-bold mt-1">{item.data?.risk_score ?? item.data?.score ?? '--'}</p>
                              <p className="text-xs uppercase font-semibold">{level || 'Not assessed'}</p>
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-sm text-gray-500">Risk scores are calculated from the Pre-operative Assessment Form. Use the button below to open the full assessment tool.</p>

                      <button
                        onClick={() => {
                          if (!selectedPatient) return;
                          setShowPreopAssessment(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                      >
                        <ClipboardCheck size={16} /> Open Full Risk Assessment Tool
                      </button>

                      {/* Nutritional Risk (inline) */}
                      <div className="border-t pt-4">
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><Utensils size={16} className="text-orange-500" /> Nutritional Risk (MUST Score)</h4>
                        <div className="space-y-2">
                          {[
                            { key: 'unplanned_weight_loss' as const, label: 'Unplanned weight loss in past 3-6 months' },
                            { key: 'bmi_below_18_5' as const, label: 'BMI < 18.5' },
                            { key: 'reduced_intake_past_week' as const, label: 'Reduced dietary intake in past week' },
                            { key: 'severely_ill' as const, label: 'Severely/critically ill' },
                            { key: 'age_over_70' as const, label: 'Age > 70 years' },
                          ].map(item => (
                            <label key={item.key} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={nutritionalForm[item.key]}
                                onChange={e => setNutritionalForm(prev => ({ ...prev, [item.key]: e.target.checked }))}
                                className="w-4 h-4 text-green-600 rounded"
                              />
                              {item.label}
                            </label>
                          ))}
                        </div>
                        <button onClick={computeNutritionalRisk} className="mt-3 flex items-center gap-1 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                          <Zap size={14} /> Calculate Nutritional Risk
                        </button>
                        {planData.nutritional_risk && (
                          <div className={`mt-3 rounded-lg p-3 ${planData.surgical_risk_medications.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                            <p className="text-sm font-semibold">Score: {planData.nutritional_risk.score} — {planData.nutritional_risk.risk_level.toUpperCase()} risk</p>
                            {planData.nutritional_risk.recommendations.length > 0 && (
                              <ul className="mt-1 text-xs space-y-0.5">
                                {planData.nutritional_risk.recommendations.map((r, i) => <li key={i} className="text-gray-600">&bull; {r}</li>)}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ---- INVESTIGATIONS SECTION ---- */}
                  {activeSection === 'investigations' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><FlaskConical size={20} className="text-green-600" /> Investigation Requests</h3>
                        <div className="flex gap-2">
                          <button onClick={generateInvestigationRequestPDF} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                            <Download size={14} /> PDF
                          </button>
                          <button onClick={generateInvestigationRequestThermal} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                            <Printer size={14} /> Thermal Print
                          </button>
                          <button onClick={() => saveSection('investigations')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                            <Save size={14} /> Save
                          </button>
                        </div>
                      </div>

                      {/* Compulsory investigations */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2">Compulsory Pre-operative Investigations (Auto-requested)</h4>
                        <div className="space-y-1">
                          {COMPULSORY_INVESTIGATIONS.map(inv => {
                            const hasResult = planData.investigation_results.some(r => r.name === inv);
                            return (
                              <div key={inv} className="flex items-center gap-2 text-sm">
                                <CheckCircle size={14} className={hasResult ? 'text-green-500' : 'text-gray-300'} />
                                <span className={hasResult ? 'text-green-700' : 'text-blue-800'}>{inv}</span>
                                {hasResult && <span className="text-xs text-green-600 ml-auto">Result received</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Age-conditional labs */}
                      {patientAge && patientAge >= 40 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-sm text-amber-800"><strong>Age-based requirement:</strong> ECG (12-lead) auto-requested (patient is {patientAge} years old)</p>
                        </div>
                      )}

                      {/* Optional investigations */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Additional Investigations</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {OPTIONAL_INVESTIGATIONS.map(inv => {
                            const isOrdered = planData.ordered_investigations.includes(inv);
                            return (
                              <label key={inv} className="flex items-center gap-2 text-sm p-1.5 rounded hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={isOrdered}
                                  onChange={() => {
                                    if (isOrdered) {
                                      updatePlan({ ordered_investigations: planData.ordered_investigations.filter(i => i !== inv) });
                                    } else {
                                      updatePlan({ ordered_investigations: [...planData.ordered_investigations, inv] });
                                    }
                                  }}
                                  className="w-4 h-4 text-green-600 rounded"
                                />
                                {inv}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-sm text-gray-600"><strong>{planData.ordered_investigations.length}</strong> investigations ordered ({COMPULSORY_INVESTIGATIONS.length} compulsory + {planData.ordered_investigations.length - COMPULSORY_INVESTIGATIONS.length} optional)</p>
                      </div>
                    </div>
                  )}

                  {/* ---- SHOPPING LIST SECTION ---- */}
                  {activeSection === 'shopping' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><ShoppingCart size={20} className="text-green-600" /> Surgical Shopping List</h3>
                        <div className="flex gap-2">
                          <button onClick={generateShoppingListPDF} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                            <Download size={14} /> PDF
                          </button>
                          <button onClick={generateShoppingListThermal} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                            <Printer size={14} /> Thermal Print
                          </button>
                          <button onClick={() => saveSection('shopping')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                            <Save size={14} /> Save
                          </button>
                        </div>
                      </div>

                      {/* Selected items */}
                      {planData.shopping_items.length > 0 && (
                        <div className="border rounded-lg p-3">
                          <h4 className="text-sm font-medium mb-2 text-gray-700">Selected Items ({planData.shopping_items.length})</h4>
                          <div className="space-y-1 max-h-48 overflow-y-auto">
                            {planData.shopping_items.map(item => (
                              <div key={item.name} className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-1.5 text-sm">
                                <span className="flex-1">{item.name} <span className="text-xs text-gray-500">({item.category})</span></span>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => updateShoppingQuantity(item.name, -1)} className="p-0.5 rounded hover:bg-green-200"><Minus size={12} /></button>
                                  <span className="w-6 text-center font-medium">{item.quantity}</span>
                                  <button onClick={() => updateShoppingQuantity(item.name, 1)} className="p-0.5 rounded hover:bg-green-200"><Plus size={12} /></button>
                                </div>
                                <button onClick={() => removeShoppingItem(item.name)} className="text-red-500 hover:text-red-700 p-0.5"><X size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Browse items */}
                      <div>
                        <div className="flex gap-2 mb-3">
                          <div className="relative flex-1">
                            <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Search items..."
                              value={shoppingSearch}
                              onChange={e => setShoppingSearch(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                            />
                          </div>
                        </div>
                        {/* Category tabs */}
                        <div className="flex gap-1 flex-wrap mb-3">
                          {shoppingCategories.map(cat => (
                            <button
                              key={cat}
                              onClick={() => setShoppingCategory(cat)}
                              className={`px-2.5 py-1 rounded-full text-xs ${shoppingCategory === cat ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                              {cat === 'all' ? 'All' : cat}
                            </button>
                          ))}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 max-h-60 overflow-y-auto border rounded-lg p-2">
                          {filteredShoppingItems.map(item => {
                            const isSelected = planData.shopping_items.some(i => i.name === item.name);
                            return (
                              <button
                                key={item.name}
                                onClick={() => addShoppingItem(item)}
                                className={`text-left text-xs px-2 py-1.5 rounded transition-colors ${isSelected ? 'bg-green-100 text-green-800' : 'hover:bg-gray-100'}`}
                              >
                                {isSelected && <Check size={10} className="inline mr-1" />}{item.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---- PROCEDURE SECTION ---- */}
                  {activeSection === 'procedure' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Scissors size={20} className="text-green-600" /> Procedure Details</h3>
                        <button onClick={() => saveSection('procedure')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Name of Procedure</label>
                          <input
                            type="text"
                            value={planData.procedure_name}
                            onChange={e => updatePlan({ procedure_name: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                            placeholder="e.g., Wound debridement and skin grafting"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Anaesthesia Type</label>
                          <select
                            value={planData.anaesthesia_type}
                            onChange={e => updatePlan({ anaesthesia_type: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">Select...</option>
                            {ANAESTHESIA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Ward</label>
                          <input
                            type="text"
                            value={planData.proposed_ward}
                            onChange={e => updatePlan({ proposed_ward: e.target.value })}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                            placeholder="e.g., Ward 3"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (minutes)</label>
                          <input
                            type="number"
                            value={planData.estimated_duration}
                            onChange={e => updatePlan({ estimated_duration: parseInt(e.target.value) || 60 })}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                            min={15} step={15}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---- INVESTIGATION RESULTS UPLOAD SECTION ---- */}
                  {activeSection === 'results' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Upload size={20} className="text-green-600" /> Investigation Results</h3>
                        <button onClick={() => saveSection('results')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>

                      {/* Abnormal results warning */}
                      {abnormalInvestigations.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <h4 className="text-sm font-semibold text-red-800 flex items-center gap-1"><AlertOctagon size={16} /> Abnormal Results ({abnormalInvestigations.length})</h4>
                          <ul className="mt-1 text-xs text-red-700 space-y-0.5">
                            {abnormalInvestigations.map((r, i) => <li key={i}>&bull; <strong>{r.name}</strong>: {r.value} {r.unit || ''}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Missing mandatory labs */}
                      {missingMandatoryLabs.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <h4 className="text-sm font-semibold text-amber-800 flex items-center gap-1"><AlertTriangle size={16} /> Missing Compulsory Results ({missingMandatoryLabs.length})</h4>
                          <ul className="mt-1 text-xs text-amber-700 space-y-0.5">
                            {missingMandatoryLabs.map((name, i) => <li key={i}>&bull; {name}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* Results table */}
                      {planData.investigation_results.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium">Investigation</th>
                                <th className="text-left px-3 py-2 font-medium">Value</th>
                                <th className="text-left px-3 py-2 font-medium">Unit</th>
                                <th className="text-left px-3 py-2 font-medium">Ref. Range</th>
                                <th className="text-center px-3 py-2 font-medium">Flag</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {planData.investigation_results.map((r, idx) => (
                                <tr key={idx} className={r.flag === 'abnormal' ? 'bg-red-50' : r.flag === 'borderline' ? 'bg-yellow-50' : ''}>
                                  <td className="px-3 py-2">{r.name}</td>
                                  <td className="px-3 py-2 font-medium">{r.value}</td>
                                  <td className="px-3 py-2 text-gray-500">{r.unit || '-'}</td>
                                  <td className="px-3 py-2 text-gray-500">{r.reference_range || '-'}</td>
                                  <td className="px-3 py-2 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${r.flag === 'abnormal' ? 'bg-red-100 text-red-700' : r.flag === 'borderline' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{r.flag}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Add result manually */}
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-2">Enter Result</h4>

                        {/* Investigation selector */}
                        <select
                          value={selectedInvForEntry}
                          onChange={e => {
                            setSelectedInvForEntry(e.target.value);
                            setParamEntries({});
                            setInvResultEntry({ name: '', value: '', flag: 'normal' });
                          }}
                          className="border rounded px-3 py-2 text-sm w-full mb-3 font-medium"
                        >
                          <option value="">Select Investigation...</option>
                          {planData.ordered_investigations.map(inv => <option key={inv} value={inv}>{inv}</option>)}
                        </select>

                        {/* Multi-parameter entry (when investigation has defined parameters) */}
                        {selectedInvForEntry && INVESTIGATION_PARAMETERS[selectedInvForEntry] && (
                          <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                            <h5 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                              <TestTube size={16} className="text-green-600" />
                              {selectedInvForEntry} — Enter Parameters
                            </h5>
                            <div className="space-y-2">
                              {INVESTIGATION_PARAMETERS[selectedInvForEntry].map(param => (
                                <div key={param.parameter} className="grid grid-cols-12 gap-2 items-center">
                                  <label className="col-span-4 text-sm text-gray-700 font-medium truncate" title={param.parameter}>
                                    {param.parameter}
                                  </label>
                                  <div className="col-span-3">
                                    {param.type === 'qualitative' && param.options ? (
                                      <select
                                        value={paramEntries[param.parameter] || ''}
                                        onChange={e => setParamEntries(prev => ({ ...prev, [param.parameter]: e.target.value }))}
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                      >
                                        <option value="">Select...</option>
                                        {param.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                      </select>
                                    ) : (
                                      <input
                                        type="number"
                                        step="any"
                                        placeholder="Value"
                                        value={paramEntries[param.parameter] || ''}
                                        onChange={e => setParamEntries(prev => ({ ...prev, [param.parameter]: e.target.value }))}
                                        className="w-full border rounded px-2 py-1.5 text-sm"
                                      />
                                    )}
                                  </div>
                                  <span className="col-span-2 text-xs text-gray-500">{param.unit}</span>
                                  <span className="col-span-2 text-xs text-gray-400">{param.reference_range}</span>
                                  <div className="col-span-1 text-center">
                                    {paramEntries[param.parameter] && (
                                      <span className={`inline-block w-2 h-2 rounded-full ${
                                        autoFlagResult(paramEntries[param.parameter], param.reference_range, param.type) === 'abnormal' ? 'bg-red-500' :
                                        autoFlagResult(paramEntries[param.parameter], param.reference_range, param.type) === 'borderline' ? 'bg-yellow-500' :
                                        'bg-green-500'
                                      }`} />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                              <button
                                onClick={addInvestigationResult}
                                disabled={!Object.values(paramEntries).some(v => v?.trim())}
                                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                              >
                                <Plus size={14} /> Add All Results
                              </button>
                              <span className="text-xs text-gray-500">
                                {Object.values(paramEntries).filter(v => v?.trim()).length} of {INVESTIGATION_PARAMETERS[selectedInvForEntry].length} parameters filled
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Single-value fallback (for investigations without defined parameters like CXR, CT, MRI) */}
                        {selectedInvForEntry && !INVESTIGATION_PARAMETERS[selectedInvForEntry] && (
                          <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
                            <h5 className="text-sm font-semibold text-gray-800">{selectedInvForEntry}</h5>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <input placeholder="Value / Finding" value={invResultEntry.value || ''} onChange={e => setInvResultEntry(p => ({ ...p, name: selectedInvForEntry, value: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                              <input placeholder="Unit" value={invResultEntry.unit || ''} onChange={e => setInvResultEntry(p => ({ ...p, unit: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                              <input placeholder="Ref. range" value={invResultEntry.reference_range || ''} onChange={e => setInvResultEntry(p => ({ ...p, reference_range: e.target.value }))} className="border rounded px-2 py-1.5 text-sm" />
                              <select value={invResultEntry.flag || 'normal'} onChange={e => setInvResultEntry(p => ({ ...p, flag: e.target.value as InvestigationFlag }))} className="border rounded px-2 py-1.5 text-sm">
                                <option value="normal">Normal</option>
                                <option value="borderline">Borderline</option>
                                <option value="abnormal">Abnormal</option>
                              </select>
                            </div>
                            <button onClick={addInvestigationResult} disabled={!invResultEntry.value} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                              <Plus size={14} /> Add Result
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Upload documents */}
                      <div className="border-t pt-4">
                        <h4 className="text-sm font-medium mb-2">Upload Result Documents</h4>
                        <input type="file" ref={fileInputRef} accept="image/*,.pdf" onChange={e => { if (e.target.files?.[0]) handleInvDocUpload(e.target.files[0]); }} className="hidden" />
                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50">
                          <FileImage size={14} /> Upload Document
                        </button>
                        {planData.investigation_docs.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {planData.investigation_docs.map((doc, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-3 py-1.5">
                                <FileText size={14} className="text-blue-500" />
                                <span className="flex-1 truncate">{doc.name}</span>
                                <span className="text-xs text-gray-400">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ---- ECG UPLOAD & INTERPRETATION SECTION ---- */}
                  {activeSection === 'ecg' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><Activity size={20} className="text-green-600" /> ECG Upload & Interpretation</h3>
                        <button onClick={() => saveSection('ecg')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>

                      <input type="file" ref={ecgInputRef} accept="image/*" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'ecg_image'); }} className="hidden" />

                      {!planData.ecg_image ? (
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                          <Activity size={40} className="mx-auto text-gray-300 mb-3" />
                          <p className="text-sm text-gray-500 mb-3">Upload ECG image for AI interpretation</p>
                          <button onClick={() => ecgInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 mx-auto">
                            <Upload size={16} /> Upload ECG Image
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative">
                            <img src={planData.ecg_image} alt="ECG" className="w-full rounded-lg border max-h-64 object-contain bg-white" />
                            <button
                              onClick={() => updatePlan({ ecg_image: undefined, ecg_interpretation: undefined, ecg_recommendations: undefined })}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {!planData.ecg_interpretation ? (
                            <button onClick={interpretECG} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                              <Zap size={16} /> Run AI ECG Interpretation
                            </button>
                          ) : (
                            <div className="space-y-3">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <h4 className="text-sm font-semibold text-blue-800 mb-1">ECG Interpretation</h4>
                                <p className="text-sm text-blue-700">{planData.ecg_interpretation}</p>
                              </div>
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <h4 className="text-sm font-semibold text-green-800 mb-1">Recommendations</h4>
                                <p className="text-sm text-green-700">{planData.ecg_recommendations}</p>
                              </div>
                              <button onClick={interpretECG} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                                <RefreshCw size={14} /> Re-interpret
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- PAYMENT EVIDENCE SECTION ---- */}
                  {activeSection === 'payment' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard size={20} className="text-green-600" /> Payment & Consent</h3>
                        <button onClick={() => saveSection('payment')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>

                      {/* Informed Consent Form Download */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-2"><FileText size={16} /> Informed Consent Form</h4>
                        <p className="text-xs text-blue-700 mb-3">Download a pre-filled informed consent form with patient and procedure details. Print, obtain signatures from the patient, witness and surgeon, then upload the signed copy below.</p>
                        <button
                          onClick={generateInformedConsentPDF}
                          disabled={generatingConsentPdf}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Download size={14} /> {generatingConsentPdf ? 'Generating...' : 'Download Informed Consent Form (PDF)'}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Payment evidence */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Payment Evidence</label>
                          <input type="file" ref={paymentInputRef} accept="image/*,.pdf" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'payment_evidence'); }} className="hidden" />
                          {planData.payment_evidence ? (
                            <div className="relative">
                              <img src={planData.payment_evidence} alt="Payment evidence" className="w-full rounded-lg border max-h-40 object-contain bg-gray-50" />
                              <button onClick={() => updatePlan({ payment_evidence: undefined })} className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"><X size={12} /></button>
                            </div>
                          ) : (
                            <button onClick={() => paymentInputRef.current?.click()} className="w-full border-2 border-dashed rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                              <CreditCard size={24} className="mx-auto text-gray-300 mb-2" />
                              <p className="text-sm text-gray-500">Upload payment receipt</p>
                            </button>
                          )}
                        </div>
                        {/* Signed consent upload */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Upload Signed Consent</label>
                          <input type="file" ref={consentInputRef} accept="image/*,.pdf" onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'consent_document'); }} className="hidden" />
                          {planData.consent_document ? (
                            <div className="relative">
                              <img src={planData.consent_document} alt="Signed consent" className="w-full rounded-lg border max-h-40 object-contain bg-gray-50" />
                              <button onClick={() => updatePlan({ consent_document: undefined })} className="absolute top-1 right-1 p-0.5 bg-red-500 text-white rounded-full"><X size={12} /></button>
                              <div className="mt-1 flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> Signed consent uploaded</div>
                            </div>
                          ) : (
                            <button onClick={() => consentInputRef.current?.click()} className="w-full border-2 border-dashed rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                              <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                              <p className="text-sm text-gray-500">Upload signed consent form</p>
                              <p className="text-xs text-gray-400 mt-1">Photo or scanned PDF</p>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ---- READINESS CHECKLIST SECTION ---- */}
                  {activeSection === 'checklist' && planData && (
                    <div className="bg-white rounded-xl border p-4 space-y-5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2"><ListChecks size={20} className="text-green-600" /> Readiness Checklist</h3>
                        <button onClick={() => saveSection('checklist')} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
                          <Save size={14} /> Save
                        </button>
                      </div>

                      <div className="space-y-2">
                        {([
                          { key: 'risk_assessed' as const, label: 'All risk assessments completed', icon: <Shield size={16} /> },
                          { key: 'comorbidities_documented' as const, label: 'Comorbidities and medications documented', icon: <Stethoscope size={16} /> },
                          { key: 'medications_reviewed' as const, label: 'Medications reviewed for surgical risk', icon: <AlertTriangle size={16} /> },
                          { key: 'investigations_complete' as const, label: 'All compulsory investigations results available', icon: <FlaskConical size={16} /> },
                          { key: 'shopping_list_done' as const, label: 'Surgical shopping list complete', icon: <ShoppingCart size={16} /> },
                          { key: 'procedure_documented' as const, label: 'Procedure, anaesthesia & ward documented', icon: <Scissors size={16} /> },
                          { key: 'results_reviewed' as const, label: 'Investigation results reviewed (abnormals addressed)', icon: <Eye size={16} /> },
                          { key: 'payment_confirmed' as const, label: 'Payment / insurance confirmed', icon: <CreditCard size={16} /> },
                          { key: 'consent_obtained' as const, label: 'Informed consent signed', icon: <FileText size={16} /> },
                          { key: 'preop_instructions_given' as const, label: 'Pre-operative instructions given to patient', icon: <BookOpen size={16} /> },
                          { key: 'blood_available' as const, label: 'Blood group & cross-match available', icon: <Droplets size={16} /> },
                          { key: 'anaesthesia_review_done' as const, label: 'Anaesthesia review done', icon: <Heart size={16} /> },
                        ]).map(item => (
                          <label key={item.key} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${planData.checklist[item.key] ? 'bg-green-50 border-green-200' : 'hover:bg-gray-50'}`}>
                            <input
                              type="checkbox"
                              checked={planData.checklist[item.key]}
                              onChange={e => updatePlan({ checklist: { ...planData.checklist, [item.key]: e.target.checked } })}
                              className="w-5 h-5 text-green-600 rounded"
                            />
                            <span className={planData.checklist[item.key] ? 'text-green-600' : 'text-gray-400'}>{item.icon}</span>
                            <span className={`text-sm flex-1 ${planData.checklist[item.key] ? 'text-green-800' : 'text-gray-700'}`}>{item.label}</span>
                            {planData.checklist[item.key] && <CheckCircle size={16} className="text-green-500" />}
                          </label>
                        ))}
                      </div>

                      {/* Readiness status */}
                      <div className={`rounded-xl p-4 text-center ${canAutoBook ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`text-lg font-bold ${canAutoBook ? 'text-green-700' : 'text-yellow-700'}`}>
                          {allChecklistComplete ? '✓ PATIENT READY FOR SURGERY' : `${Object.values(planData.checklist).filter(v => v).length} / ${Object.keys(planData.checklist).length} requirements met`}
                        </p>
                        {!allChecklistComplete && (
                          <p className="text-sm text-gray-500 mt-1">Complete all checklist items to enable booking</p>
                        )}
                      </div>

                      {/* Auto-book button */}
                      {canAutoBook && (
                        <button
                          onClick={handleAutoBook}
                          disabled={saving}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl text-base font-semibold hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCircle size={20} /> Book for Surgery
                        </button>
                      )}
                      {!canAutoBook && selectedPatient && (
                        <div className="text-sm text-gray-500 text-center">
                          {!allChecklistComplete && <p>Complete all checklist items above.</p>}
                          {missingMandatoryLabs.length > 0 && <p>Missing compulsory lab results: {missingMandatoryLabs.join(', ')}</p>}
                          {!planData?.procedure_name && <p>Enter procedure name in Procedure section.</p>}
                          {!planData?.anaesthesia_type && <p>Select anaesthesia type in Procedure section.</p>}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 2: BOOKED CASES ===== */}
      {activeTab === 'booked-cases' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
            <h2 className="text-lg font-semibold">Booked Surgery Cases</h2>
            <div className="flex gap-2 items-center flex-wrap">
              <input
                type="date"
                value={bookedDateFilter}
                onChange={e => setBookedDateFilter(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
              />
              {bookedDateFilter && (
                <button onClick={() => setBookedDateFilter('')} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
              )}
              {bookedDateFilter && (
                <button
                  onClick={() => generateOperationListPDF(bookedDateFilter)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                >
                  <Download size={14} /> Operation List PDF
                </button>
              )}
            </div>
          </div>

          {filteredBookedCases.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center">
              <Users size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No booked cases {bookedDateFilter ? 'for this date' : 'found'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookedByDay.map(([date, cases]) => (
                <div key={date} className="bg-white rounded-xl border overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b">
                    <div className="flex items-center gap-2">
                      <CalendarDays size={16} className="text-green-600" />
                      <span className="text-sm font-semibold">{safeFormatDate(date, 'EEE, MMM d, yyyy')}</span>
                      <span className="text-xs text-gray-500">({cases.length} case{cases.length !== 1 ? 's' : ''})</span>
                    </div>
                    <button
                      onClick={() => generateOperationListPDF(date)}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-green-700 hover:bg-green-100 rounded"
                    >
                      <Download size={12} /> PDF
                    </button>
                  </div>
                  <div className="divide-y">
                    {cases.sort(prioritySort).map((c: any, idx: number) => (
                      <div key={c.id || idx}>
                        <button
                          onClick={() => setExpandedBooking(expandedBooking === c.id ? null : c.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
                        >
                          <span className="text-xs font-bold text-gray-400 w-6">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {c.patient_name || c.patient?.full_name || 'Unknown'}
                              {c.is_emergency && <span className="ml-2 text-xs bg-red-100 text-red-700 px-1.5 rounded">EMERGENCY</span>}
                              {c.is_diabetic && <span className="ml-1 text-xs bg-yellow-100 text-yellow-700 px-1.5 rounded">DM</span>}
                            </p>
                            <p className="text-xs text-gray-500">
                              {c.patient_age_at_booking ? c.patient_age_at_booking + 'yrs' : ''} &bull; {c.patient_gender || '-'} &bull; PT#: {c.hospital_number || '-'}
                              {c.proposed_ward ? ' \u2022 Ward: ' + c.proposed_ward : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">{c.procedure_name || '-'}</p>
                            <p className="text-xs text-gray-400">{c.anaesthesia_type || '-'}</p>
                          </div>
                          {expandedBooking === c.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {expandedBooking === c.id && (
                          <div className="px-4 pb-3 bg-gray-50 border-t">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 text-sm">
                              <div><span className="text-gray-500 text-xs">Diagnosis</span><p className="font-medium">{c.diagnosis || '-'}</p></div>
                              <div><span className="text-gray-500 text-xs">Surgeon</span><p className="font-medium">{c.primary_surgeon || '-'}</p></div>
                              <div><span className="text-gray-500 text-xs">Theatre</span><p className="font-medium">{c.theatre_number || '-'}</p></div>
                              <div><span className="text-gray-500 text-xs">Duration</span><p className="font-medium">{c.estimated_duration ? c.estimated_duration + ' min' : '-'}</p></div>
                              <div><span className="text-gray-500 text-xs">Category</span><p className="font-medium">{CASE_CATEGORY_LABELS[c.case_category as CaseCategory] || c.case_category || '-'}</p></div>
                              <div><span className="text-gray-500 text-xs">Status</span><p className="font-medium capitalize">{c.status || '-'}</p></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== TAB 3: THEATRE CALENDAR ===== */}
      {activeTab === 'theatre-calendar' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Theatre Calendar</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))} className="p-1.5 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
              <span className="text-sm font-medium min-w-[140px] text-center">
                {calendarMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))} className="p-1.5 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const used = getDayUsedSlots(day.date);
                const pct = Math.min(100, (used / MAX_DAILY_SLOTS) * 100);
                const isFull = used >= MAX_DAILY_SLOTS;
                const hasBookings = bookedCases.some(c => c.date === day.date);
                const isToday = day.date === new Date().toISOString().split('T')[0];
                const isSelected = day.date === selectedCalendarDay;
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCalendarDay(day.date === selectedCalendarDay ? '' : day.date)}
                    className={`p-2 border-b border-r min-h-[70px] text-left transition-colors ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-300' : isSelected ? 'bg-green-50 ring-2 ring-green-500 ring-inset' : isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <span className={`text-sm ${isToday ? 'font-bold text-blue-700' : day.isCurrentMonth ? 'text-gray-900' : 'text-gray-300'}`}>{day.day}</span>
                    {day.isCurrentMonth && hasBookings && (
                      <div className="mt-1">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${isFull ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: pct + '%' }} />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5">{used}/{MAX_DAILY_SLOTS}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day detail */}
          {selectedCalendarDay && (
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{safeFormatDate(selectedCalendarDay, 'EEE, MMM d, yyyy')}</h3>
                <div className="flex gap-2">
                  <span className="text-xs text-gray-500">
                    {getDayUsedSlots(selectedCalendarDay)}/{MAX_DAILY_SLOTS} slots used
                  </span>
                  {bookedCases.filter(c => c.date === selectedCalendarDay).length > 0 && (
                    <button
                      onClick={() => generateOperationListPDF(selectedCalendarDay)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <Download size={12} /> PDF
                    </button>
                  )}
                </div>
              </div>
              {bookedCases.filter(c => c.date === selectedCalendarDay).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No cases booked for this day</p>
              ) : (
                <div className="space-y-2">
                  {bookedCases.filter(c => c.date === selectedCalendarDay).sort(prioritySort).map((c: any, idx: number) => (
                    <div key={c.id || idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 text-sm">
                      <span className="font-bold text-gray-400 text-xs w-5">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.patient_name || c.patient?.full_name || '-'}</p>
                        <p className="text-xs text-gray-500">{c.procedure_name || '-'} &bull; {c.anaesthesia_type || '-'}</p>
                      </div>
                      {c.is_emergency && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">EMER</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full inline-block" /> Available</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-500 rounded-full inline-block" /> Filling up</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full inline-block" /> Full</span>
          </div>
        </div>
      )}

      {/* Hidden file inputs (already declared via refs) */}

      {/* Pre-operative Assessment Form Modal */}
      {showPreopAssessment && selectedPatient && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><div className="bg-white rounded-lg p-6">Loading assessment...</div></div>}>
          <PreoperativeAssessmentForm
            patientId={selectedPatient.id}
            onClose={() => setShowPreopAssessment(false)}
            onSave={() => setShowPreopAssessment(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
