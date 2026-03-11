import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PreoperativePlanningModule } from '../components/procedures/PreoperativePlanningModule';
import { patientService } from '../services/patientService';
import { preoperativeService, PreoperativeAssessment } from '../services/preoperativeService';
import { schedulingService, SurgeryBooking } from '../services/schedulingService';
import toast from 'react-hot-toast';
import { safeFormatDate } from '../utils/dateUtils';
import {
  ArrowLeft, ClipboardCheck, Users, Search, User, Calendar, Loader2,
  Eye, Plus, CheckCircle, AlertTriangle, FileText, Download, BookOpen,
  ShoppingCart, Shield, Printer, Filter, ChevronDown, ChevronUp,
  Image, CreditCard, Clock, MapPin, Stethoscope, ListChecks,
  Upload, X, CalendarDays, Lock, Unlock, FlaskConical, Ban
} from 'lucide-react';
import {
  createPDF, addPDFHeader, addSectionHeader, addBodyText, addBulletList,
  addSeparator, addFooter, addLabeledField, sanitizeTextForPDF, formatDateForPDF,
  createThermalPDF, addThermalHeader, addThermalText, finalizeThermalPDF,
} from '../utils/pdfUtils';
import jsPDF from 'jspdf';

//  interfaces 
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
}

type TabKey = 'surgical-planning' | 'booked-cases';

interface PreparationStatus {
  riskAssessed: boolean;
  comorbidityChecked: boolean;
  investigationsOrdered: boolean;
  shoppingListDone: boolean;
  consentObtained: boolean;
  paymentConfirmed: boolean;
  preOpInstructionsGiven: boolean;
  fullyPrepared: boolean;
}

/** Manual stage overrides stored per-patient in localStorage */
interface ManualStageOverrides {
  [patientId: string]: {
    riskAssessed?: boolean;
    comorbidityChecked?: boolean;
    investigationsOrdered?: boolean;
    shoppingListDone?: boolean;
    consentObtained?: boolean;
    paymentConfirmed?: boolean;
    preOpInstructionsGiven?: boolean;
    fullyPrepared?: boolean;
  };
}

/** Investigation result for a single test */
type InvestigationFlag = 'normal' | 'borderline' | 'abnormal';

interface InvestigationResult {
  name: string;
  value: string;
  flag: InvestigationFlag;
  enteredBy?: string;
  enteredAt?: string;
}

/** Per-patient uploaded investigation documents (photos of lab reports, PDFs) */
interface InvestigationDocuments {
  [patientId: string]: Array<{
    name: string;
    dataUrl: string; // base64
    uploadedAt: string;
    uploadedBy: string;
  }>;
}

/** Per-patient investigation results stored in localStorage */
interface PatientInvestigationResults {
  [patientId: string]: InvestigationResult[];
}

/** Force readiness override */
interface ForceReadinessRecord {
  patientId: string;
  reason: string;
  forcedBy: string;
  forcedAt: string;
}

interface ForceReadinessOverrides {
  [patientId: string]: ForceReadinessRecord;
}

/** Booked case document uploads stored per booking */
interface BookedCaseDocuments {
  [bookingId: string]: {
    signedConsent?: string; // base64
    paymentEvidence?: string; // base64
  };
}

/** Per-patient stage approval status (Accept / Reject for each stage) */
interface StageApprovalStatus {
  [patientId: string]: {
    riskAssessed?: 'accepted' | 'rejected';
    comorbidityChecked?: 'accepted' | 'rejected';
    investigationsOrdered?: 'accepted' | 'rejected';
    shoppingListDone?: 'accepted' | 'rejected';
    consentObtained?: 'accepted' | 'rejected';
    paymentConfirmed?: 'accepted' | 'rejected';
    preOpInstructionsGiven?: 'accepted' | 'rejected';
    fullyPrepared?: 'accepted' | 'rejected';
  };
}

/** Per-patient uploaded documents during planning phase */
interface StageDocs {
  [patientId: string]: {
    consentDoc?: string; // base64
    paymentDoc?: string; // base64
    stageNotes?: { [stageKey: string]: string };
  };
}

// ─── localStorage helpers ───
const STAGE_OVERRIDES_KEY = 'booking_stage_overrides';
const INVESTIGATION_RESULTS_KEY = 'booking_investigation_results';
const FORCE_READINESS_KEY = 'booking_force_readiness';
const BOOKED_DOCS_KEY = 'booked_case_documents';
const STAGE_APPROVALS_KEY = 'booking_stage_approvals';
const STAGE_DOCS_KEY = 'booking_stage_docs';
const INVESTIGATION_DOCS_KEY = 'booking_investigation_docs';

const loadJSON = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const saveJSON = (key: string, val: any) => { localStorage.setItem(key, JSON.stringify(val)); };

//  helpers 
const calcAge = (dob: string): number => {
  const b = new Date(dob);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) age--;
  return age;
};

const riskBadge = (level?: string) => {
  if (!level) return 'bg-gray-100 text-gray-600';
  const l = level.toLowerCase();
  if (l.includes('high') || l.includes('severe') || l.includes('very'))
    return 'bg-red-100 text-red-700 border-red-300';
  if (l.includes('moderate') || l.includes('medium') || l.includes('intermediate'))
    return 'bg-yellow-100 text-yellow-700 border-yellow-300';
  return 'bg-green-100 text-green-700 border-green-300';
};

const stageBadge = (status: PreparationStatus) => {
  const done = Object.values(status).filter(Boolean).length;
  const total = Object.keys(status).length;
  if (status.fullyPrepared) return { label: 'Fully Prepared', cls: 'bg-green-100 text-green-800 border-green-300' };
  if (done >= total - 2) return { label: 'Nearly Ready', cls: 'bg-blue-100 text-blue-800 border-blue-300' };
  if (done >= 3) return { label: 'In Progress', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  return { label: 'Early Stage', cls: 'bg-gray-100 text-gray-800 border-gray-300' };
};

const getPreparationStatus = (
  a: PreoperativeAssessment | null,
  b?: SurgeryBooking | null,
  overrides?: ManualStageOverrides[string]
): PreparationStatus => {
  const riskAssessed = overrides?.riskAssessed ?? !!(a?.bleeding_risk?.risk_level || a?.dvt_risk?.risk_category);
  const comorbidityChecked = overrides?.comorbidityChecked ?? !!(a?.comorbidities_medications && a.comorbidities_medications.length >= 0 && a.assessed_at);
  const investigationsOrdered = overrides?.investigationsOrdered ?? !!(a?.comprehensive_summary && a.comprehensive_summary.length > 30);
  const shoppingListDone = overrides?.shoppingListDone ?? !!(b?.equipment_needed && b.equipment_needed.length > 0);
  const consentObtained = overrides?.consentObtained ?? !!(a?.consent_document || b?.consent_obtained);
  const paymentConfirmed = overrides?.paymentConfirmed ?? !!(a?.payment_evidence);
  const preOpInstructionsGiven = overrides?.preOpInstructionsGiven ?? !!(a?.preop_instructions && a.preop_instructions.length > 10);
  const fullyPrepared = overrides?.fullyPrepared ?? (riskAssessed && comorbidityChecked && consentObtained && preOpInstructionsGiven);
  return { riskAssessed, comorbidityChecked, investigationsOrdered, shoppingListDone, consentObtained, paymentConfirmed, preOpInstructionsGiven, fullyPrepared };
};

/** Mandatory pre-op labs that MUST have results before surgery date assignment */
const MANDATORY_LABS = [
  'HIV/HBsAg/HCV Screening',
  'Full Blood Count (FBC)',
  'Electrolytes, Urea & Creatinine (E/U/Cr)',
];
/** Age-conditional mandatory lab */
const AGE_CONDITIONAL_LABS = [
  { name: 'ECG (12-lead)', minAge: 40 },
];

/** Check if mandatory labs are complete for a patient */
const areMandatoryLabsComplete = (
  patientId: string,
  patientDob: string,
  investigationResults: PatientInvestigationResults
): { complete: boolean; missing: string[] } => {
  const results = investigationResults[patientId] || [];
  const resultNames = results.filter(r => r.value.trim() !== '').map(r => r.name.toLowerCase());
  const required = [...MANDATORY_LABS];
  const age = patientDob ? calcAge(patientDob) : 0;
  AGE_CONDITIONAL_LABS.forEach(lab => {
    if (age >= lab.minAge) required.push(lab.name);
  });
  const missing = required.filter(lab => !resultNames.some(rn => rn.includes(lab.toLowerCase()) || lab.toLowerCase().includes(rn)));
  return { complete: missing.length === 0, missing };
};

/** Standard pre-op investigations list */
const STANDARD_INVESTIGATIONS = [
  'Full Blood Count (FBC)',
  'Electrolytes, Urea & Creatinine (E/U/Cr)',
  'Fasting Blood Glucose (FBG)',
  'Liver Function Tests (LFT)',
  'Coagulation Profile (PT/INR/aPTT)',
  'Urinalysis',
  'Chest X-ray (CXR)',
  'ECG (12-lead)',
  'Blood Group & Cross-match',
  'HIV/HBsAg/HCV Screening',
  'Serum Protein & Albumin',
  'Thyroid Function Tests (TFT)',
  'HbA1c',
  'CT Scan',
  'MRI',
];

// 
//  BOOKING REGISTER PAGE
// 
const BookingRegisterPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientIdFromUrl = searchParams.get('patientId');

  //  tab state 
  const [activeTab, setActiveTab] = useState<TabKey>('surgical-planning');

  //  surgical planning state 
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientIdFromUrl);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPatientSelector, setShowPatientSelector] = useState(!patientIdFromUrl);
  const [existingAssessment, setExistingAssessment] = useState<PreoperativeAssessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'view' | 'stages'>('stages');
  const [saving, setSaving] = useState(false);

  //  booked-cases state 
  const [allBookings, setAllBookings] = useState<SurgeryBooking[]>([]);
  const [allAssessments, setAllAssessments] = useState<PreoperativeAssessment[]>([]);
  const [bookedCasesLoading, setBookedCasesLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);

  //  stage list filter (all patients with assessments) 
  const [stagePatients, setStagePatients] = useState<Array<{ patient: Patient; assessment: PreoperativeAssessment; booking?: SurgeryBooking; status: PreparationStatus }>>([]);
  const [stageSearch, setStageSearch] = useState('');

  // Manual overrides & investigation state
  const [stageOverrides, setStageOverrides] = useState<ManualStageOverrides>(() => loadJSON(STAGE_OVERRIDES_KEY, {}));
  const [investigationResults, setInvestigationResults] = useState<PatientInvestigationResults>(() => loadJSON(INVESTIGATION_RESULTS_KEY, {}));
  const [forceReadiness, setForceReadiness] = useState<ForceReadinessOverrides>(() => loadJSON(FORCE_READINESS_KEY, {}));
  const [bookedCaseDocs, setBookedCaseDocs] = useState<BookedCaseDocuments>(() => loadJSON(BOOKED_DOCS_KEY, {}));

  // Modal state
  const [showInvestigationModal, setShowInvestigationModal] = useState<string | null>(null);
  const [showForceReadinessModal, setShowForceReadinessModal] = useState<string | null>(null);
  const [forceReason, setForceReason] = useState('');
  const [investigationEntries, setInvestigationEntries] = useState<InvestigationResult[]>([]);
  const [investigationDocs, setInvestigationDocs] = useState<InvestigationDocuments>(() => loadJSON(INVESTIGATION_DOCS_KEY, {}));

  // Stage review panel state
  const [stageReviewPanel, setStageReviewPanel] = useState<{ patientId: string; stage: string } | null>(null);
  const [stageApprovals, setStageApprovals] = useState<StageApprovalStatus>(() => loadJSON(STAGE_APPROVALS_KEY, {}));
  const [stageDocs, setStageDocs] = useState<StageDocs>(() => loadJSON(STAGE_DOCS_KEY, {}));
  const [stageReviewNote, setStageReviewNote] = useState('');

  // Upload refs
  const consentFileRef = useRef<HTMLInputElement>(null);
  const paymentFileRef = useRef<HTMLInputElement>(null);
  const planConsentFileRef = useRef<HTMLInputElement>(null);
  const planPaymentFileRef = useRef<HTMLInputElement>(null);
  const investigationFileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ bookingId: string; type: 'consent' | 'payment' } | null>(null);
  const [investigationUploadTarget, setInvestigationUploadTarget] = useState<string | null>(null);

  //  Effects 
  useEffect(() => { loadPatients(); }, []);

  useEffect(() => {
    if (selectedPatientId) loadExistingAssessment(selectedPatientId);
  }, [selectedPatientId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      setFilteredPatients(patients.filter(p => {
        const name = p.full_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim();
        return name.toLowerCase().includes(q) || (p.hospital_number || '').toLowerCase().includes(q);
      }));
    } else {
      setFilteredPatients(patients.slice(0, 20));
    }
  }, [searchQuery, patients]);

  useEffect(() => {
    if (activeTab === 'booked-cases') loadBookedCases();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'surgical-planning' && viewMode === 'stages') loadStageData();
  }, [activeTab, viewMode, patients]);

  //  Data loaders 
  const loadPatients = async () => {
    try {
      setIsLoading(true);
      const all = await patientService.getAllPatients();
      setPatients(all);
      setFilteredPatients(all.slice(0, 20));
    } catch (e) { console.error('Error loading patients:', e); }
    finally { setIsLoading(false); }
  };

  const loadExistingAssessment = async (pid: string) => {
    setLoadingAssessment(true);
    try {
      const a = await preoperativeService.getAssessmentByPatient(pid);
      setExistingAssessment(a);
    } catch (e) { console.error(e); setExistingAssessment(null); }
    finally { setLoadingAssessment(false); }
  };

  const loadBookedCases = async () => {
    setBookedCasesLoading(true);
    try {
      const bookings = await schedulingService.getSurgeryBookings();
      setAllBookings(bookings || []);
    } catch (e) { console.error(e); }
    finally { setBookedCasesLoading(false); }
  };

  const loadStageData = async () => {
    try {
      const results: typeof stagePatients = [];
      for (const p of patients) {
        try {
          const a = await preoperativeService.getAssessmentByPatient(p.id);
          if (a) {
            const bookings = await schedulingService.getSurgeryBookings();
            const b = (bookings || []).find((bk: SurgeryBooking) => bk.patient_id === p.id);
            const overrides = stageOverrides[p.id];
            const status = getPreparationStatus(a, b, overrides);
            results.push({ patient: p, assessment: a, booking: b, status });
          }
        } catch { /* no assessment */ }
      }
      setStagePatients(results);
    } catch (e) { console.error(e); }
  };

  //  Handlers 
  const handlePatientSelect = (pid: string) => {
    setSelectedPatientId(pid);
    setShowPatientSelector(false);
    setViewMode('form');
    navigate('/booking-register?patientId=' + pid, { replace: true });
  };

  const handleComplete = async (data: any) => {
    setSaving(true);
    try {
      const selectedComorbidities = (data.comorbidities || []).filter((c: any) => c.selected).map((c: any) => c.name);
      const assessment: PreoperativeAssessment = {
        patient_id: data.patientId || selectedPatientId || '',
        surgery_booking_id: data.procedureId,
        current_medications: (data.clinicalAssessment?.currentMedications || []).map((m: string) => ({
          drug_name: m, dosage: '', frequency: '', route: 'oral' as const, indication: '',
        })),
        bleeding_risk: {
          anticoagulant_use: selectedComorbidities.includes('On Anticoagulation'),
          antiplatelet_use: false,
          bleeding_disorder: selectedComorbidities.includes('Bleeding Disorder'),
          liver_disease: selectedComorbidities.includes('Liver Cirrhosis') || selectedComorbidities.includes('Chronic Hepatitis'),
          renal_impairment: selectedComorbidities.includes('Chronic Kidney Disease') || selectedComorbidities.includes('Dialysis Dependent'),
          recent_bleeding: false,
          risk_level: data.riskAssessment?.bleedingRisk || 'low',
          risk_score: data.riskAssessment?.bleedingRisk === 'high' ? 7 : data.riskAssessment?.bleedingRisk === 'intermediate' ? 4 : 1,
          recommendations: [],
        },
        dvt_risk: {
          age_41_60: false, minor_surgery: false, history_major_surgery: false,
          varicose_veins: false, history_inflammatory_bowel: false, swollen_legs: false,
          obesity_bmi_over_25: (data.clinicalAssessment?.bmi || 0) > 25,
          acute_mi: false, chf_1_month: false, sepsis_1_month: false,
          serious_lung_disease: false, abnormal_pulmonary_function: false, medical_patient_bed_rest: false,
          age_61_74: false, arthroscopic_surgery: false, malignancy: selectedComorbidities.includes('Active Malignancy'),
          major_surgery_over_45min: (data.expectedDuration || 0) > 45, laparoscopic_over_45min: false,
          patient_confined_to_bed: false, immobilizing_plaster_cast: false, central_venous_access: false,
          age_over_75: false, history_dvt_pe: selectedComorbidities.includes('Previous DVT/PE'),
          family_history_dvt: false, factor_v_leiden: false, prothrombin_20210a: false,
          lupus_anticoagulant: false, anticardiolipin_antibodies: false,
          heparin_induced_thrombocytopenia: false, other_thrombophilia: false,
          elective_major_lower_extremity_arthroplasty: false, hip_pelvis_leg_fracture: false,
          stroke_1_month: false, multiple_trauma: false, acute_spinal_cord_injury: false,
          total_score: data.riskAssessment?.thrombosisRisk === 'high' ? 5 : data.riskAssessment?.thrombosisRisk === 'intermediate' ? 3 : 1,
          risk_category: data.riskAssessment?.thrombosisRisk === 'high' ? 'high' : data.riskAssessment?.thrombosisRisk === 'intermediate' ? 'moderate' : 'low',
          prophylaxis_recommendation: data.riskAssessment?.thrombosisRisk === 'high' ? 'LMWH + compression stockings' : 'Early mobilization',
        },
        cardiovascular_risk: {
          high_risk_surgery: data.procedureType === 'major',
          ischemic_heart_disease: selectedComorbidities.includes('Coronary Artery Disease'),
          history_chf: selectedComorbidities.includes('Congestive Heart Failure'),
          history_cerebrovascular_disease: selectedComorbidities.includes('Previous Stroke/TIA'),
          diabetes_on_insulin: selectedComorbidities.includes('Diabetes Type 1'),
          preop_creatinine_over_2: false,
          hypertension: selectedComorbidities.includes('Hypertension'),
          smoking: data.clinicalAssessment?.smokingStatus === 'current',
          age_over_65: false,
          rcri_score: data.riskAssessment?.cardiacRisk === 'high' ? 3 : data.riskAssessment?.cardiacRisk === 'intermediate' ? 2 : 0,
          risk_level: data.riskAssessment?.cardiacRisk || 'low',
          cardiac_event_risk_percent: data.riskAssessment?.cardiacRisk === 'high' ? 9 : data.riskAssessment?.cardiacRisk === 'intermediate' ? 5 : 1,
          recommendations: [],
        },
        pressure_sore_risk: {
          sensory_perception: 4 as const, moisture: 4 as const, activity: 4 as const,
          mobility: 4 as const, nutrition: 4 as const, friction_shear: 3 as const,
          braden_total: 23, risk_category: 'no-risk', preventive_measures: [],
        },
        comorbidities_medications: selectedComorbidities.map((c: string) => ({ comorbidity: c, medications: [] })),
        consent_document: undefined,
        payment_evidence: undefined,
        insurance_covered: false,
        comprehensive_summary:
          'Pre-operative assessment. Procedure: ' + (data.procedureName || 'N/A') +
          '. Anesthesia: ' + (data.anesthesiaType || 'N/A') +
          '. Urgency: ' + (data.urgency || 'elective') +
          '. ASA Score: ' + (data.riskAssessment?.asaScore || 1) +
          '. Overall Risk: ' + (data.riskAssessment?.overallRisk || 'low') +
          '. Comorbidities: ' + (selectedComorbidities.length > 0 ? selectedComorbidities.join(', ') : 'None') +
          '. Allergies: ' + ((data.clinicalAssessment?.allergies || []).length > 0 ? data.clinicalAssessment.allergies.join(', ') : 'None') +
          '. Vitals: BP ' + (data.clinicalAssessment?.bloodPressure || 'N/A') +
          ', HR ' + (data.clinicalAssessment?.heartRate || 'N/A') +
          ', Temp ' + (data.clinicalAssessment?.temperature || 'N/A') +
          'C, SpO2 ' + (data.clinicalAssessment?.oxygenSaturation || 'N/A') +
          '%. BMI: ' + (data.clinicalAssessment?.bmi || 'N/A') +
          '. ' + (data.additionalNotes ? 'Notes: ' + data.additionalNotes : ''),
        preop_instructions:
          'Fasting: NPO status - ' + (data.clinicalAssessment?.npo_status || 'NPO since midnight') +
          '. Medications: ' + ((data.clinicalAssessment?.currentMedications || []).length > 0 ? data.clinicalAssessment.currentMedications.join(', ') : 'None') +
          '. Investigations ordered: ' + ((data.generatedInvestigations || []).map((i: any) => i.name).join(', ') || 'As per protocol') + '.',
        assessed_by: data.assessedBy || localStorage.getItem('userName') || 'Unknown',
        assessed_at: new Date(),
        updated_at: new Date(),
      };
      await preoperativeService.saveAssessment(assessment);
      setExistingAssessment(assessment);
      toast.success('Pre-operative assessment saved successfully!');
      setViewMode('view');
    } catch (e) { console.error(e); toast.error('Failed to save assessment.'); }
    finally { setSaving(false); }
  };

  const handleCancel = () => {
    if (selectedPatientId) { setShowPatientSelector(true); setSelectedPatientId(null); setViewMode('stages'); }
    else navigate('/booking-register');
  };

  // ─── Stage Toggle Handler ───
  const toggleStage = async (patientId: string, stageKey: string, currentValue: boolean, sp: typeof stagePatients[0]) => {
    // Special handling for "fullyPrepared" (Ready)
    if (stageKey === 'fullyPrepared' && !currentValue) {
      // Check for abnormal investigations
      const patientInvResults = investigationResults[patientId] || [];
      const hasAbnormal = patientInvResults.some(r => r.flag === 'abnormal');
      const alreadyForced = !!forceReadiness[patientId];

      if (hasAbnormal && !alreadyForced) {
        setShowForceReadinessModal(patientId);
        return; // Block - must force readiness with reason
      }

      // Auto-create booking when marking Ready
      try {
        const patientName = sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim();
        const existingBookings = await schedulingService.getSurgeryBookings();
        const alreadyBooked = (existingBookings || []).some((bk: SurgeryBooking) => bk.patient_id === patientId && (bk.status === 'scheduled' || bk.status === 'confirmed'));

        if (!alreadyBooked) {
          const procedureName = sp.assessment?.comprehensive_summary?.match(/Procedure:\s*([^.]+)/)?.[1]?.trim() || 'Planned Surgery';
          const anaesthesiaMatch = sp.assessment?.comprehensive_summary?.match(/Anesthesia:\s*([^.]+)/)?.[1]?.trim()?.toLowerCase() || 'general';
          const anaesthesiaType = (['general', 'regional', 'local', 'sedation'].includes(anaesthesiaMatch) ? anaesthesiaMatch : 'general') as 'general' | 'regional' | 'local' | 'sedation';

          await schedulingService.createSurgeryBooking({
            date: new Date(Date.now() + 7 * 86400000), // Default: 1 week from now
            theatre_number: 'TBD',
            start_time: '08:00',
            estimated_end_time: '10:00',
            primary_surgeon: sp.assessment?.assessed_by || 'TBD',
            anaesthetist: 'TBD',
            scrub_nurse: 'TBD',
            circulating_nurse: 'TBD',
            patient_id: patientId,
            patient_name: patientName,
            hospital_number: sp.patient.hospital_number,
            ward: sp.patient.ward,
            indication: sp.assessment?.comprehensive_summary?.match(/Procedure:\s*([^.]+)/)?.[1]?.trim() || '',
            procedure_name: procedureName,
            procedure_code: '',
            urgency: 'elective',
            anaesthesia_type: anaesthesiaType,
            estimated_duration_minutes: 120,
            special_requirements: [],
            equipment_needed: sp.booking?.equipment_needed || [],
            implants_needed: [],
            allergies: [],
            medical_conditions: [],
            pre_op_checklist_completed: true,
            consent_obtained: sp.status.consentObtained,
            notes: alreadyForced ? 'Force readiness: ' + (forceReadiness[patientId]?.reason || '') : '',
            status: 'scheduled',
          });
          toast.success(patientName + ' moved to Booked Cases!');
          loadBookedCases(); // Refresh booked cases
        }
      } catch (err) {
        console.error('Failed to auto-create booking:', err);
        toast.error('Failed to create booking. Stage still toggled.');
      }
    }

    // Toggle override
    const updated = { ...stageOverrides };
    if (!updated[patientId]) updated[patientId] = {};
    updated[patientId][stageKey as keyof PreparationStatus] = !currentValue;
    setStageOverrides(updated);
    saveJSON(STAGE_OVERRIDES_KEY, updated);

    // Refresh stage data
    loadStageData();
    toast.success((currentValue ? 'Unmarked' : 'Marked') + ' as done');
  };

  // ─── Investigation Modal Handlers ───
  const openInvestigationModal = (patientId: string) => {
    const existing = investigationResults[patientId] || [];
    if (existing.length === 0) {
      // Pre-populate with standard investigations
      setInvestigationEntries(STANDARD_INVESTIGATIONS.map(name => ({
        name, value: '', flag: 'normal' as InvestigationFlag,
      })));
    } else {
      setInvestigationEntries([...existing]);
    }
    setShowInvestigationModal(patientId);
  };

  const saveInvestigationResults = (patientId: string) => {
    const filled = investigationEntries.filter(e => e.value.trim() !== '');
    const updated = { ...investigationResults, [patientId]: filled.map(e => ({ ...e, enteredBy: localStorage.getItem('userName') || 'Unknown', enteredAt: new Date().toISOString() })) };
    setInvestigationResults(updated);
    saveJSON(INVESTIGATION_RESULTS_KEY, updated);
    setShowInvestigationModal(null);

    // If there were abnormal results and patient was Ready, uncheck Ready
    const hasAbnormal = filled.some(r => r.flag === 'abnormal');
    const currentOverrides = stageOverrides[patientId];
    if (hasAbnormal && currentOverrides?.fullyPrepared && !forceReadiness[patientId]) {
      const updatedOverrides = { ...stageOverrides };
      updatedOverrides[patientId] = { ...updatedOverrides[patientId], fullyPrepared: false };
      setStageOverrides(updatedOverrides);
      saveJSON(STAGE_OVERRIDES_KEY, updatedOverrides);
      toast.error('Patient has abnormal investigations - Ready status removed');
    } else {
      toast.success('Investigation results saved');
    }
    loadStageData();
  };

  const addCustomInvestigation = () => {
    setInvestigationEntries([...investigationEntries, { name: '', value: '', flag: 'normal' }]);
  };

  // ─── Force Readiness Handler ───
  const handleForceReadiness = (patientId: string) => {
    if (!forceReason.trim()) {
      toast.error('Please provide a clinical reason');
      return;
    }
    const record: ForceReadinessRecord = {
      patientId,
      reason: forceReason,
      forcedBy: localStorage.getItem('userName') || 'Unknown',
      forcedAt: new Date().toISOString(),
    };
    const updated = { ...forceReadiness, [patientId]: record };
    setForceReadiness(updated);
    saveJSON(FORCE_READINESS_KEY, updated);

    // Now toggle Ready on
    const updatedOverrides = { ...stageOverrides };
    if (!updatedOverrides[patientId]) updatedOverrides[patientId] = {};
    updatedOverrides[patientId].fullyPrepared = true;
    setStageOverrides(updatedOverrides);
    saveJSON(STAGE_OVERRIDES_KEY, updatedOverrides);

    setShowForceReadinessModal(null);
    setForceReason('');
    toast.success('Forced readiness applied with clinical justification');

    // Find the stage patient data to auto-create booking
    const sp = stagePatients.find(s => s.patient.id === patientId);
    if (sp) {
      const patientName = sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim();
      schedulingService.createSurgeryBooking({
        date: new Date(Date.now() + 7 * 86400000),
        theatre_number: 'TBD',
        start_time: '08:00',
        estimated_end_time: '10:00',
        primary_surgeon: sp.assessment?.assessed_by || 'TBD',
        anaesthetist: 'TBD',
        scrub_nurse: 'TBD',
        circulating_nurse: 'TBD',
        patient_id: patientId,
        patient_name: patientName,
        hospital_number: sp.patient.hospital_number,
        ward: sp.patient.ward,
        indication: '',
        procedure_name: sp.assessment?.comprehensive_summary?.match(/Procedure:\s*([^.]+)/)?.[1]?.trim() || 'Planned Surgery',
        procedure_code: '',
        urgency: 'elective',
        anaesthesia_type: 'general',
        estimated_duration_minutes: 120,
        special_requirements: [],
        equipment_needed: [],
        implants_needed: [],
        allergies: [],
        medical_conditions: [],
        pre_op_checklist_completed: true,
        consent_obtained: sp.status.consentObtained,
        notes: 'Force readiness: ' + forceReason,
        status: 'scheduled',
      }).then(() => {
        toast.success(patientName + ' moved to Booked Cases');
        loadBookedCases();
      }).catch(err => console.error('Booking creation failed:', err));
    }
    loadStageData();
  };

  // ─── Investigation Document Upload Handler ───
  const handleInvestigationDocUpload = (patientId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const updated = { ...investigationDocs };
      if (!updated[patientId]) updated[patientId] = [];
      updated[patientId] = [
        ...updated[patientId],
        {
          name: file.name,
          dataUrl,
          uploadedAt: new Date().toISOString(),
          uploadedBy: localStorage.getItem('userName') || 'Unknown',
        },
      ];
      setInvestigationDocs(updated);
      saveJSON(INVESTIGATION_DOCS_KEY, updated);
      toast.success('Investigation document uploaded: ' + file.name);
    };
    reader.readAsDataURL(file);
  };

  const removeInvestigationDoc = (patientId: string, idx: number) => {
    const updated = { ...investigationDocs };
    if (updated[patientId]) {
      updated[patientId] = updated[patientId].filter((_, i) => i !== idx);
      setInvestigationDocs(updated);
      saveJSON(INVESTIGATION_DOCS_KEY, updated);
      toast.success('Document removed');
    }
  };

  // ─── Stage Review Handlers ───
  const openStageReview = (patientId: string, stageKey: string) => {
    // All stages (including investigationsOrdered) now open the stage review modal
    // The investigation modal can be launched from within the review modal
    const existingNote = stageDocs[patientId]?.stageNotes?.[stageKey] || '';
    setStageReviewNote(existingNote);
    setStageReviewPanel({ patientId, stage: stageKey });
  };

  const acceptStage = (patientId: string, stageKey: string) => {
    // Update approval status
    const updatedApprovals = { ...stageApprovals };
    if (!updatedApprovals[patientId]) updatedApprovals[patientId] = {};
    (updatedApprovals[patientId] as any)[stageKey] = 'accepted';
    setStageApprovals(updatedApprovals);
    saveJSON(STAGE_APPROVALS_KEY, updatedApprovals);

    // Also mark the stage override as done
    const updatedOverrides = { ...stageOverrides };
    if (!updatedOverrides[patientId]) updatedOverrides[patientId] = {};
    updatedOverrides[patientId][stageKey as keyof PreparationStatus] = true;
    setStageOverrides(updatedOverrides);
    saveJSON(STAGE_OVERRIDES_KEY, updatedOverrides);

    // Save the review note
    const updatedDocs = { ...stageDocs };
    if (!updatedDocs[patientId]) updatedDocs[patientId] = {};
    if (!updatedDocs[patientId].stageNotes) updatedDocs[patientId].stageNotes = {};
    updatedDocs[patientId].stageNotes![stageKey] = stageReviewNote;
    setStageDocs(updatedDocs);
    saveJSON(STAGE_DOCS_KEY, updatedDocs);

    setStageReviewPanel(null);
    setStageReviewNote('');
    toast.success('Stage accepted');
    loadStageData();
  };

  const rejectStage = (patientId: string, stageKey: string) => {
    const updatedApprovals = { ...stageApprovals };
    if (!updatedApprovals[patientId]) updatedApprovals[patientId] = {};
    (updatedApprovals[patientId] as any)[stageKey] = 'rejected';
    setStageApprovals(updatedApprovals);
    saveJSON(STAGE_APPROVALS_KEY, updatedApprovals);

    // Mark stage override as NOT done
    const updatedOverrides = { ...stageOverrides };
    if (!updatedOverrides[patientId]) updatedOverrides[patientId] = {};
    updatedOverrides[patientId][stageKey as keyof PreparationStatus] = false;
    setStageOverrides(updatedOverrides);
    saveJSON(STAGE_OVERRIDES_KEY, updatedOverrides);

    // Save the review note
    const updatedDocs = { ...stageDocs };
    if (!updatedDocs[patientId]) updatedDocs[patientId] = {};
    if (!updatedDocs[patientId].stageNotes) updatedDocs[patientId].stageNotes = {};
    updatedDocs[patientId].stageNotes![stageKey] = stageReviewNote;
    setStageDocs(updatedDocs);
    saveJSON(STAGE_DOCS_KEY, updatedDocs);

    setStageReviewPanel(null);
    setStageReviewNote('');
    toast.error('Stage rejected');
    loadStageData();
  };

  const handlePlanDocUpload = (patientId: string, type: 'consent' | 'payment', file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = { ...stageDocs };
      if (!updated[patientId]) updated[patientId] = {};
      if (type === 'consent') updated[patientId].consentDoc = base64;
      else updated[patientId].paymentDoc = base64;
      setStageDocs(updated);
      saveJSON(STAGE_DOCS_KEY, updated);
      toast.success((type === 'consent' ? 'Consent document' : 'Payment evidence') + ' uploaded');
    };
    reader.readAsDataURL(file);
  };

  const approveBooking = async (patientId: string) => {
    const sp = stagePatients.find(s => s.patient.id === patientId);
    if (!sp) return;

    // Check mandatory labs
    const labCheck = areMandatoryLabsComplete(patientId, sp.patient.date_of_birth || '', investigationResults);
    if (!labCheck.complete) {
      toast.error('Missing mandatory labs: ' + labCheck.missing.join(', '));
      return;
    }

    // Check for abnormal investigations
    const patientInvResults = investigationResults[patientId] || [];
    const hasAbnormal = patientInvResults.some(r => r.flag === 'abnormal');
    const alreadyForced = !!forceReadiness[patientId];

    if (hasAbnormal && !alreadyForced) {
      setShowForceReadinessModal(patientId);
      return;
    }

    // Mark fullyPrepared
    const updatedOverrides = { ...stageOverrides };
    if (!updatedOverrides[patientId]) updatedOverrides[patientId] = {};
    updatedOverrides[patientId].fullyPrepared = true;
    setStageOverrides(updatedOverrides);
    saveJSON(STAGE_OVERRIDES_KEY, updatedOverrides);

    // Mark fullyPrepared approval
    const updatedApprovals = { ...stageApprovals };
    if (!updatedApprovals[patientId]) updatedApprovals[patientId] = {};
    updatedApprovals[patientId].fullyPrepared = 'accepted';
    setStageApprovals(updatedApprovals);
    saveJSON(STAGE_APPROVALS_KEY, updatedApprovals);

    // Create booking
    try {
      const patientName = sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim();
      const existingBookings = await schedulingService.getSurgeryBookings();
      const alreadyBooked = (existingBookings || []).some((bk: SurgeryBooking) => bk.patient_id === patientId && (bk.status === 'scheduled' || bk.status === 'confirmed'));

      if (!alreadyBooked) {
        const procedureName = sp.assessment?.comprehensive_summary?.match(/Procedure:\s*([^.]+)/)?.[1]?.trim() || 'Planned Surgery';
        const anaesthesiaMatch = sp.assessment?.comprehensive_summary?.match(/Anesthesia:\s*([^.]+)/)?.[1]?.trim()?.toLowerCase() || 'general';
        const anaesthesiaType = (['general', 'regional', 'local', 'sedation'].includes(anaesthesiaMatch) ? anaesthesiaMatch : 'general') as 'general' | 'regional' | 'local' | 'sedation';

        await schedulingService.createSurgeryBooking({
          date: new Date(Date.now() + 7 * 86400000),
          theatre_number: 'TBD',
          start_time: '08:00',
          estimated_end_time: '10:00',
          primary_surgeon: sp.assessment?.assessed_by || 'TBD',
          anaesthetist: 'TBD',
          scrub_nurse: 'TBD',
          circulating_nurse: 'TBD',
          patient_id: patientId,
          patient_name: patientName,
          hospital_number: sp.patient.hospital_number,
          ward: sp.patient.ward,
          indication: sp.assessment?.comprehensive_summary?.match(/Procedure:\s*([^.]+)/)?.[1]?.trim() || '',
          procedure_name: procedureName,
          procedure_code: '',
          urgency: 'elective',
          anaesthesia_type: anaesthesiaType,
          estimated_duration_minutes: 120,
          special_requirements: [],
          equipment_needed: sp.booking?.equipment_needed || [],
          implants_needed: [],
          allergies: [],
          medical_conditions: [],
          pre_op_checklist_completed: true,
          consent_obtained: sp.status.consentObtained,
          notes: alreadyForced ? 'Force readiness: ' + (forceReadiness[patientId]?.reason || '') : '',
          status: 'scheduled',
        });
        toast.success(patientName + ' booking approved — moved to Booked Cases!');
        loadBookedCases();
      } else {
        toast.success('Booking approved — patient already in Booked Cases');
      }
    } catch (err) {
      console.error('Failed to create booking on approval:', err);
      toast.error('Booking approval failed.');
    }
    loadStageData();
  };

  /** Get the stage review content label */
  const getStageLabel = (key: string) => {
    const labels: Record<string, string> = {
      riskAssessed: 'Risk Assessment',
      comorbidityChecked: 'Comorbidity Check',
      investigationsOrdered: 'Investigation Results',
      shoppingListDone: 'Shopping List / Equipment',
      consentObtained: 'Signed Consent',
      paymentConfirmed: 'Payment Evidence',
      preOpInstructionsGiven: 'Pre-Op Instructions',
      fullyPrepared: 'Overall Readiness',
    };
    return labels[key] || key;
  };

  // ─── Booked Case Document Upload Handlers ───
  const handleFileUpload = (bookingId: string, type: 'consent' | 'payment', file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const updated = { ...bookedCaseDocs };
      if (!updated[bookingId]) updated[bookingId] = {};
      if (type === 'consent') updated[bookingId].signedConsent = base64;
      else updated[bookingId].paymentEvidence = base64;
      setBookedCaseDocs(updated);
      saveJSON(BOOKED_DOCS_KEY, updated);
      toast.success(type === 'consent' ? 'Signed consent uploaded' : 'Payment evidence uploaded');
    };
    reader.readAsDataURL(file);
  };

  // ─── Investigation results for a booked case patient ───
  const openBookedCaseInvestigations = (patientId: string) => {
    openInvestigationModal(patientId);
  };

  //  PDF Generators 
  const generateAssessmentPDF = (assessment: PreoperativeAssessment) => {
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Pre-Operative Assessment Summary');
      y = addSectionHeader(doc, 'Patient Information', y);
      y = addLabeledField(doc, 'Patient ID', assessment.patient_id, y);
      y = addLabeledField(doc, 'Assessed By', assessment.assessed_by || 'N/A', y);
      y = addLabeledField(doc, 'Assessment Date', assessment.assessed_at ? formatDateForPDF(assessment.assessed_at) : 'N/A', y);
      y = addSeparator(doc, y);
      if (assessment.comprehensive_summary) {
        y = addSectionHeader(doc, 'Comprehensive Summary', y);
        y = addBodyText(doc, sanitizeTextForPDF(assessment.comprehensive_summary), y);
        y = addSeparator(doc, y);
      }
      y = addSectionHeader(doc, 'Risk Assessment', y);
      if (assessment.bleeding_risk) y = addLabeledField(doc, 'Bleeding Risk', assessment.bleeding_risk.risk_level + ' (Score: ' + assessment.bleeding_risk.risk_score + ')', y);
      if (assessment.dvt_risk) y = addLabeledField(doc, 'DVT Risk (Caprini)', assessment.dvt_risk.risk_category + ' (Score: ' + assessment.dvt_risk.total_score + ')', y);
      if (assessment.cardiovascular_risk) y = addLabeledField(doc, 'Cardiac Risk (RCRI)', assessment.cardiovascular_risk.risk_level + ' (Score: ' + assessment.cardiovascular_risk.rcri_score + ')', y);
      if (assessment.pressure_sore_risk) y = addLabeledField(doc, 'Pressure Sore (Braden)', assessment.pressure_sore_risk.risk_category + ' (Score: ' + assessment.pressure_sore_risk.braden_total + ')', y);
      y = addSeparator(doc, y);
      if (assessment.current_medications && assessment.current_medications.length > 0) {
        y = addSectionHeader(doc, 'Current Medications', y);
        y = addBulletList(doc, assessment.current_medications.map(m => m.drug_name + (m.dosage ? ' - ' + m.dosage : '') + (m.frequency ? ' (' + m.frequency + ')' : '')), y);
        y = addSeparator(doc, y);
      }
      if (assessment.comorbidities_medications && assessment.comorbidities_medications.length > 0) {
        y = addSectionHeader(doc, 'Comorbidities', y);
        y = addBulletList(doc, assessment.comorbidities_medications.map(c => c.comorbidity), y);
        y = addSeparator(doc, y);
      }
      if (assessment.preop_instructions) {
        y = addSectionHeader(doc, 'Pre-Operative Instructions', y);
        y = addBodyText(doc, sanitizeTextForPDF(assessment.preop_instructions), y);
      }
      addFooter(doc, 'Generated: ' + new Date().toLocaleString());
      doc.save('PreOp_Assessment_' + assessment.patient_id + '.pdf');
      toast.success('Assessment PDF downloaded');
    } catch (e) { console.error(e); toast.error('Failed to generate PDF'); }
  };

  const generateThermalAssessment = (assessment: PreoperativeAssessment) => {
    try {
      const thermalWidth = 80;
      const m = 4;
      const estHeight = 350;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
      doc.setFont('times', 'normal');
      let y = 6;
      doc.setFontSize(12); doc.setFont('times', 'bold');
      doc.text('PRE-OP ASSESSMENT', thermalWidth / 2, y, { align: 'center' }); y += 5;
      doc.setFontSize(8); doc.setFont('times', 'normal');
      doc.text('UNTH Plastic Surgery Unit', thermalWidth / 2, y, { align: 'center' }); y += 4;
      doc.line(m, y, thermalWidth - m, y); y += 3;
      doc.setFontSize(9);
      doc.text('Patient ID: ' + (assessment.patient_id || 'N/A'), m, y); y += 4;
      doc.text('Assessed by: ' + (assessment.assessed_by || 'N/A'), m, y); y += 4;
      doc.text('Date: ' + (assessment.assessed_at ? safeFormatDate(assessment.assessed_at, 'dd/MM/yyyy') : 'N/A'), m, y); y += 4;
      doc.line(m, y, thermalWidth - m, y); y += 3;
      if (assessment.bleeding_risk) { doc.text('Bleeding: ' + assessment.bleeding_risk.risk_level, m, y); y += 4; }
      if (assessment.dvt_risk) { doc.text('DVT: ' + assessment.dvt_risk.risk_category, m, y); y += 4; }
      if (assessment.cardiovascular_risk) { doc.text('Cardiac: ' + assessment.cardiovascular_risk.risk_level, m, y); y += 4; }
      doc.line(m, y, thermalWidth - m, y); y += 3;
      if (assessment.comprehensive_summary) {
        const lines = doc.splitTextToSize(assessment.comprehensive_summary, thermalWidth - m * 2);
        doc.setFontSize(7);
        lines.forEach((l: string) => { doc.text(l, m, y); y += 3; });
        y += 2;
      }
      doc.line(m, y, thermalWidth - m, y); y += 3;
      doc.setFontSize(7);
      doc.text('UNTH Burns, Plastic & Reconstructive Surgery', thermalWidth / 2, y, { align: 'center' });
      doc.save('PreOp_Thermal_' + assessment.patient_id + '.pdf');
      toast.success('Thermal PDF downloaded');
    } catch (e) { console.error(e); toast.error('Failed to generate thermal PDF'); }
  };

  const generateBookedCasesPDF = () => {
    try {
      const filtered = filteredBookedCases;
      if (filtered.length === 0) { toast.error('No booked cases to export'); return; }
      const doc = createPDF('landscape');
      let y = addPDFHeader(doc, 'Booked Cases Register');
      if (dateFrom || dateTo) {
        y = addLabeledField(doc, 'Date Range', (dateFrom || 'Start') + ' to ' + (dateTo || 'End'), y);
      }
      y = addLabeledField(doc, 'Total Cases', String(filtered.length), y);
      y = addSeparator(doc, y);
      filtered.forEach((bk, idx) => {
        if (y > 170) { doc.addPage(); y = 20; }
        y = addSectionHeader(doc, (idx + 1) + '. ' + (bk.patient_name || 'Unknown'), y);
        y = addLabeledField(doc, 'PT Number', bk.hospital_number || 'N/A', y);
        y = addLabeledField(doc, 'Ward', bk.ward || 'N/A', y);
        y = addLabeledField(doc, 'Indication', bk.indication || 'N/A', y);
        y = addLabeledField(doc, 'Procedure', bk.procedure_name || 'N/A', y);
        y = addLabeledField(doc, 'Date', bk.date ? safeFormatDate(bk.date, 'dd/MM/yyyy') : 'N/A', y);
        y = addLabeledField(doc, 'Status', bk.status || 'N/A', y);
        y = addLabeledField(doc, 'Consent', bk.consent_obtained ? 'Yes' : 'Pending', y);
        y = addSeparator(doc, y);
      });
      addFooter(doc, 'Generated: ' + new Date().toLocaleString());
      doc.save('Booked_Cases_' + (dateFrom || 'all') + '_to_' + (dateTo || 'all') + '.pdf');
      toast.success('Booked cases PDF downloaded');
    } catch (e) { console.error(e); toast.error('Failed to generate PDF'); }
  };

  /** Generate thermal (80mm) shopping list for a patient's surgical equipment */
  const generateShoppingListThermal = (patientName: string, hospitalNumber: string, items: string[]) => {
    try {
      if (!items || items.length === 0) { toast.error('No items in shopping list'); return; }
      const thermalWidth = 80;
      const m = 4;
      const estHeight = Math.max(120, 60 + items.length * 5);
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
      doc.setFont('times', 'normal');
      let y = 6;
      doc.setFontSize(11); doc.setFont('times', 'bold');
      doc.text('SHOPPING LIST', thermalWidth / 2, y, { align: 'center' }); y += 5;
      doc.setFontSize(8); doc.setFont('times', 'normal');
      doc.text('UNTH Plastic Surgery Unit', thermalWidth / 2, y, { align: 'center' }); y += 4;
      doc.line(m, y, thermalWidth - m, y); y += 3;
      doc.setFontSize(9);
      doc.text('Patient: ' + (patientName || 'N/A'), m, y); y += 4;
      doc.text('PT No: ' + (hospitalNumber || 'N/A'), m, y); y += 4;
      doc.text('Date: ' + new Date().toLocaleDateString(), m, y); y += 4;
      doc.line(m, y, thermalWidth - m, y); y += 3;
      doc.setFontSize(8);
      items.forEach((item, i) => {
        const lines = doc.splitTextToSize('[ ] ' + (i + 1) + '. ' + item, thermalWidth - m * 2);
        lines.forEach((l: string) => { doc.text(l, m, y); y += 3.5; });
      });
      y += 2;
      doc.line(m, y, thermalWidth - m, y); y += 3;
      doc.setFontSize(7);
      doc.text('Total items: ' + items.length, m, y); y += 4;
      doc.text('UNTH Burns, Plastic & Reconstructive Surgery', thermalWidth / 2, y, { align: 'center' });
      doc.save('Shopping_List_' + (hospitalNumber || 'patient') + '.pdf');
      toast.success('Shopping list thermal PDF downloaded');
    } catch (e) { console.error(e); toast.error('Failed to generate shopping list'); }
  };

  //  Filtered booked cases 
  const filteredBookedCases = useMemo(() => {
    let list = allBookings.filter(b => b.status === 'scheduled' || b.status === 'confirmed');
    if (dateFrom) {
      const from = new Date(dateFrom); from.setHours(0,0,0,0);
      list = list.filter(b => new Date(b.date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23,59,59,999);
      list = list.filter(b => new Date(b.date) <= to);
    }
    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allBookings, dateFrom, dateTo]);

  //  Filtered stage patients 
  const filteredStagePatients = useMemo(() => {
    if (!stageSearch.trim()) return stagePatients;
    const q = stageSearch.toLowerCase();
    return stagePatients.filter(sp => {
      const name = sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim();
      return name.toLowerCase().includes(q) || (sp.patient.hospital_number || '').toLowerCase().includes(q);
    });
  }, [stagePatients, stageSearch]);

  // 
  //  RENDER
  // 
  if (isLoading && !patientIdFromUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6">
      {/*  Page Header  */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-2">
          <div className="p-3 bg-primary-100 rounded-lg">
            <ClipboardCheck className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Booking Register</h1>
            <p className="text-gray-500">Surgical planning & booked cases management</p>
          </div>
        </div>
      </div>

      {/*  Tab Switcher  */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => { setActiveTab('surgical-planning'); if (!selectedPatientId) setViewMode('stages'); }}
          className={'px-6 py-3 text-sm font-medium border-b-2 transition-colors ' +
            (activeTab === 'surgical-planning'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')}
        >
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4" />
            Surgical Planning
          </div>
        </button>
        <button
          onClick={() => setActiveTab('booked-cases')}
          className={'px-6 py-3 text-sm font-medium border-b-2 transition-colors ' +
            (activeTab === 'booked-cases'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300')}
        >
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4" />
            Booked Cases
            {filteredBookedCases.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-bold">
                {filteredBookedCases.length}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* 
           TAB 1: SURGICAL PLANNING
          */}
      {activeTab === 'surgical-planning' && (
        <>
          {/*  Patient Selector  */}
          {showPatientSelector && viewMode !== 'stages' ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setViewMode('stages')}
                  className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to patient stages
                </button>
              </div>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by patient name or hospital number..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b bg-gray-50 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <span className="font-medium text-gray-700">
                    {searchQuery ? filteredPatients.length + ' results' : patients.length + ' patients'}
                  </span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                  {filteredPatients.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                      <p>No patients found</p>
                    </div>
                  ) : filteredPatients.map(p => {
                    const name = p.full_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim() || 'Unknown';
                    return (
                      <button key={p.id} onClick={() => handlePatientSelect(p.id)}
                        className="w-full p-4 hover:bg-gray-50 text-left transition-colors flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-primary-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{name}</h3>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span>#{p.hospital_number || 'N/A'}</span>
                              <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" />
                                {p.date_of_birth ? calcAge(p.date_of_birth) + ' yrs' : 'N/A'}</span>
                              <span className="capitalize">{p.gender || 'N/A'}</span>
                              {p.ward && <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" />{p.ward}</span>}
                            </div>
                          </div>
                        </div>
                        <ArrowLeft className="w-5 h-5 text-primary-600 transform rotate-180" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : showPatientSelector && viewMode === 'stages' ? (
            /*  Preparation Stages List (default view)  */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Patients at Various Preparation Stages</h2>
                <button
                  onClick={() => { setShowPatientSelector(true); setViewMode('form'); }}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Assessment
                </button>
              </div>

              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input type="text" value={stageSearch} onChange={e => setStageSearch(e.target.value)}
                  placeholder="Search patients in preparation..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
              </div>

              {filteredStagePatients.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                  <ClipboardCheck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No patients being prepared</h3>
                  <p className="text-gray-400 mb-4">Start by selecting a patient and completing a pre-operative assessment</p>
                  <button onClick={() => { setShowPatientSelector(true); setViewMode('form'); }}
                    className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                    <Plus className="w-4 h-4 mr-2" /> Begin New Assessment
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredStagePatients.map(sp => {
                    const name = sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim();
                    const badge = stageBadge(sp.status);
                    const done = Object.values(sp.status).filter(Boolean).length;
                    const total = Object.keys(sp.status).length;
                    return (
                      <div key={sp.patient.id}
                        className={'bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer ' +
                          (sp.status.fullyPrepared ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-yellow-400')}
                        onClick={() => handlePatientSelect(sp.patient.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-primary-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{name}</h3>
                              <div className="flex items-center gap-3 text-sm text-gray-500">
                                <span>#{sp.patient.hospital_number || 'N/A'}</span>
                                {sp.patient.ward && <span><MapPin className="inline w-3 h-3 mr-1" />{sp.patient.ward}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={'px-3 py-1 text-xs font-medium rounded-full border ' + badge.cls}>
                              {badge.label}
                            </span>
                            <span className="text-xs text-gray-400">{done}/{total}</span>
                          </div>
                        </div>
                        {/* Clickable preparation stage chips — click opens review panel */}
                        <div className="mt-3 grid grid-cols-4 md:grid-cols-8 gap-1">
                          {[
                            { key: 'riskAssessed', label: 'Risk' },
                            { key: 'comorbidityChecked', label: 'Comorbid' },
                            { key: 'investigationsOrdered', label: 'Invest' },
                            { key: 'shoppingListDone', label: 'Shopping' },
                            { key: 'consentObtained', label: 'Consent' },
                            { key: 'paymentConfirmed', label: 'Payment' },
                            { key: 'preOpInstructionsGiven', label: 'Instruct' },
                            { key: 'fullyPrepared', label: 'Ready' },
                          ].map(item => {
                            const isDone = (sp.status as any)[item.key];
                            const hasAbnormal = (investigationResults[sp.patient.id] || []).some(r => r.flag === 'abnormal');
                            const isReady = item.key === 'fullyPrepared';
                            const isBlocked = isReady && hasAbnormal && !forceReadiness[sp.patient.id] && !isDone;
                            const approval = (stageApprovals[sp.patient.id] as any)?.[item.key];
                            return (
                              <button
                                key={item.key}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isReady) {
                                    // Ready is handled by Approve Booking button
                                    return;
                                  }
                                  openStageReview(sp.patient.id, item.key);
                                }}
                                title={
                                  isReady ? 'Use Approve Booking button below' :
                                  isBlocked ? 'Blocked: abnormal investigation results' :
                                  approval === 'accepted' ? 'Accepted — click to review' :
                                  approval === 'rejected' ? 'Rejected — click to review' :
                                  'Click to review & accept/reject'
                                }
                                className={'text-center px-1 py-1.5 rounded text-[10px] font-medium transition-all cursor-pointer border relative ' +
                                  (approval === 'accepted'
                                    ? 'bg-green-100 text-green-700 border-green-300 hover:bg-green-200'
                                    : approval === 'rejected'
                                      ? 'bg-red-100 text-red-600 border-red-300 hover:bg-red-200'
                                      : isDone
                                        ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                        : isBlocked
                                          ? 'bg-red-50 text-red-400 border-red-200 cursor-not-allowed'
                                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-700')}
                              >
                                {approval === 'accepted'
                                  ? <CheckCircle className="w-3 h-3 inline mr-0.5" />
                                  : approval === 'rejected'
                                    ? <X className="w-3 h-3 inline mr-0.5" />
                                    : isDone
                                      ? <CheckCircle className="w-3 h-3 inline mr-0.5" />
                                      : isBlocked
                                        ? <Ban className="w-3 h-3 inline mr-0.5" />
                                        : <Clock className="w-3 h-3 inline mr-0.5" />}
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                        {/* Abnormal investigation warning */}
                        {(investigationResults[sp.patient.id] || []).some(r => r.flag === 'abnormal') && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>Abnormal investigation(s) detected{forceReadiness[sp.patient.id] ? ' — Force readiness applied by ' + forceReadiness[sp.patient.id].forcedBy : ' — cannot mark Ready without clinical override'}</span>
                          </div>
                        )}
                        {/* Mandatory labs missing warning */}
                        {(() => {
                          const labCheck = areMandatoryLabsComplete(sp.patient.id, sp.patient.date_of_birth || '', investigationResults);
                          if (labCheck.complete) return null;
                          return (
                            <div className="mt-2 flex items-center gap-2 text-xs text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                              <FlaskConical className="w-3.5 h-3.5 flex-shrink-0" />
                              <span>Mandatory labs missing: {labCheck.missing.join(', ')}</span>
                            </div>
                          );
                        })()}
                        {/* Quick action: Shopping List Thermal Print */}
                        {sp.booking?.equipment_needed && sp.booking.equipment_needed.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const name = sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim();
                                generateShoppingListThermal(name, sp.patient.hospital_number, sp.booking!.equipment_needed);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs hover:bg-purple-100"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print Shopping List (Thermal)
                            </button>
                          </div>
                        )}
                        {/* Approve Booking button */}
                        {(() => {
                          const pa = stageApprovals[sp.patient.id] || {};
                          const requiredStages = ['riskAssessed', 'comorbidityChecked', 'investigationsOrdered', 'consentObtained', 'paymentConfirmed', 'preOpInstructionsGiven'] as const;
                          const allAccepted = requiredStages.every(k => (pa as any)[k] === 'accepted');
                          const anyRejected = requiredStages.some(k => (pa as any)[k] === 'rejected');
                          const acceptedCount = requiredStages.filter(k => (pa as any)[k] === 'accepted').length;
                          const alreadyBooked = sp.status.fullyPrepared && (stageApprovals[sp.patient.id] as any)?.fullyPrepared === 'accepted';

                          return (
                            <div className="mt-3 flex items-center gap-3">
                              {alreadyBooked ? (
                                <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                                  <CheckCircle className="w-4 h-4" />
                                  <span className="font-medium">Booking Approved — Patient in Booked Cases</span>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      approveBooking(sp.patient.id);
                                    }}
                                    disabled={!allAccepted}
                                    title={allAccepted ? 'Approve booking and move to Booked Cases' : 'Accept all required stages first (' + acceptedCount + '/' + requiredStages.length + ')'}
                                    className={'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ' +
                                      (allAccepted
                                        ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed')}
                                  >
                                    <BookOpen className="w-4 h-4" />
                                    Approve Booking
                                  </button>
                                  <span className="text-[10px] text-gray-400">
                                    {acceptedCount}/{requiredStages.length} stages accepted
                                    {anyRejected && <span className="text-red-500 ml-1">(has rejections)</span>}
                                  </span>
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /*  Assessment Form / View (patient selected)  */
            <div>
              {/* Back / actions bar */}
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => { setShowPatientSelector(true); setSelectedPatientId(null); setViewMode('stages'); navigate('/booking-register', { replace: true }); }}
                  className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm">
                  <ArrowLeft className="w-4 h-4" /> Back to Booking Register
                </button>
              </div>

              {/* Loading spinner */}
              {loadingAssessment && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-blue-700">Loading previous assessment data...</span>
                </div>
              )}

              {/* Existing assessment banner */}
              {existingAssessment && !loadingAssessment && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-6 h-6 text-green-600" /></div>
                      <div>
                        <h3 className="font-semibold text-green-900 text-lg">Previous Assessment Found</h3>
                        <p className="text-sm text-green-700">
                          Assessed by {existingAssessment.assessed_by || 'Unknown'} on{' '}
                          {existingAssessment.assessed_at ? safeFormatDate(existingAssessment.assessed_at, 'dd MMM yyyy') : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {viewMode === 'form' ? (
                        <button onClick={() => setViewMode('view')}
                          className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                          <Eye className="w-4 h-4 mr-2" /> View Assessment
                        </button>
                      ) : (
                        <button onClick={() => setViewMode('form')}
                          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                          <Plus className="w-4 h-4 mr-2" /> New Assessment
                        </button>
                      )}
                      <button onClick={() => generateAssessmentPDF(existingAssessment)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium">
                        <Download className="w-4 h-4 mr-2" /> PDF
                      </button>
                      <button onClick={() => generateThermalAssessment(existingAssessment)}
                        className="inline-flex items-center px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium">
                        <Printer className="w-4 h-4 mr-2" /> 80mm Print
                      </button>
                      <button onClick={() => {
                        const equipment = existingAssessment.comprehensive_summary?.match(/Equipment:\s*([^.]+)/)?.[1]?.split(',').map((s: string) => s.trim()).filter(Boolean) || [];
                        const patientName = patients.find(p => p.id === selectedPatientId)?.full_name || 'Patient';
                        const hospNum = patients.find(p => p.id === selectedPatientId)?.hospital_number || '';
                        if (equipment.length === 0) {
                          toast.error('No equipment/shopping list items found. Add items via stage management first.');
                          return;
                        }
                        generateShoppingListThermal(patientName, hospNum, equipment);
                      }}
                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                        <ShoppingCart className="w-4 h-4 mr-2" /> Shopping List (Thermal)
                      </button>
                      <button onClick={() => generateAssessmentPDF(existingAssessment)}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                        <Download className="w-4 h-4 mr-2" /> Complete Assessment (A4)
                      </button>
                    </div>
                  </div>

                  {/* Assessment View when viewMode === 'view' */}
                  {viewMode === 'view' && (
                    <div className="space-y-4 pt-2">
                      {/* Risk Scores Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {existingAssessment.bleeding_risk && (
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-xs text-gray-500 mb-1">Bleeding Risk</div>
                            <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(existingAssessment.bleeding_risk.risk_level)}>
                              {existingAssessment.bleeding_risk.risk_level} (Score: {existingAssessment.bleeding_risk.risk_score})
                            </span>
                          </div>
                        )}
                        {existingAssessment.dvt_risk && (
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-xs text-gray-500 mb-1">DVT Risk (Caprini)</div>
                            <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(existingAssessment.dvt_risk.risk_category)}>
                              {existingAssessment.dvt_risk.risk_category} (Score: {existingAssessment.dvt_risk.total_score})
                            </span>
                          </div>
                        )}
                        {existingAssessment.cardiovascular_risk && (
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-xs text-gray-500 mb-1">Cardiac Risk (RCRI)</div>
                            <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(existingAssessment.cardiovascular_risk.risk_level)}>
                              {existingAssessment.cardiovascular_risk.risk_level} (Score: {existingAssessment.cardiovascular_risk.rcri_score})
                            </span>
                          </div>
                        )}
                        {existingAssessment.pressure_sore_risk && (
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="text-xs text-gray-500 mb-1">Pressure Sore (Braden)</div>
                            <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(existingAssessment.pressure_sore_risk.risk_category)}>
                              {existingAssessment.pressure_sore_risk.risk_category} (Score: {existingAssessment.pressure_sore_risk.braden_total})
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Consent / Payment / Insurance */}
                      <div className="flex flex-wrap gap-4 text-sm bg-white p-3 rounded-lg border">
                        <div className="flex items-center gap-2">
                          <span className={'w-3 h-3 rounded-full ' + (existingAssessment.consent_document ? 'bg-green-500' : 'bg-red-500')} />
                          <span className="text-gray-700">Consent: {existingAssessment.consent_document ? 'Obtained' : 'Pending'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={'w-3 h-3 rounded-full ' + (existingAssessment.insurance_covered ? 'bg-green-500' : 'bg-yellow-500')} />
                          <span className="text-gray-700">Insurance: {existingAssessment.insurance_covered ? 'Covered' : 'Not Covered'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={'w-3 h-3 rounded-full ' + (existingAssessment.payment_evidence ? 'bg-green-500' : 'bg-yellow-500')} />
                          <span className="text-gray-700">Payment: {existingAssessment.payment_evidence ? 'Confirmed' : 'Pending'}</span>
                        </div>
                      </div>

                      {existingAssessment.comprehensive_summary && (
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><FileText className="w-4 h-4" /> Comprehensive Summary</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingAssessment.comprehensive_summary}</p>
                        </div>
                      )}
                      {existingAssessment.preop_instructions && (
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Pre-Operative Instructions</h4>
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingAssessment.preop_instructions}</p>
                        </div>
                      )}
                      {existingAssessment.current_medications && existingAssessment.current_medications.length > 0 && (
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Medications</h4>
                          <div className="flex flex-wrap gap-2">
                            {existingAssessment.current_medications.map((m, i) => (
                              <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                                {m.drug_name}{m.dosage ? ' (' + m.dosage + ')' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {existingAssessment.comorbidities_medications && existingAssessment.comorbidities_medications.length > 0 && (
                        <div className="bg-white p-4 rounded-lg border">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Comorbidities</h4>
                          <div className="flex flex-wrap gap-2">
                            {existingAssessment.comorbidities_medications.map((c, i) => (
                              <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200">
                                {c.comorbidity}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Assessment Form */}
              {viewMode === 'form' && (
                <>
                  {saving && (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="text-blue-700 font-medium">Saving assessment...</span>
                    </div>
                  )}
                  <PreoperativePlanningModule
                    patientId={selectedPatientId || undefined}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                  />
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* 
           TAB 2: BOOKED CASES
          */}
      {activeTab === 'booked-cases' && (
        <div>
          {/* Filters & actions */}
          <div className="flex flex-wrap items-end gap-4 mb-6 bg-white p-4 rounded-lg shadow-sm border">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From date"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="To date"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline">
                Clear filters
              </button>
            )}
            <div className="ml-auto">
              <button onClick={generateBookedCasesPDF}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium">
                <Download className="w-4 h-4 mr-2" /> Download PDF
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-4 text-sm text-gray-600">
            Showing <strong>{filteredBookedCases.length}</strong> booked case{filteredBookedCases.length !== 1 ? 's' : ''}
            {(dateFrom || dateTo) && <span className="text-primary-600 ml-1">(date-filtered)</span>}
          </div>

          {bookedCasesLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : filteredBookedCases.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <ListChecks className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Booked Cases</h3>
              <p className="text-gray-400">Cases will appear here once patients are fully prepared and surgery is scheduled.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredBookedCases.map(bk => {
                const isExpanded = expandedBooking === bk.id;
                let opImages: string[] = [];
                try {
                  if (bk.operation_site_images) opImages = JSON.parse(bk.operation_site_images);
                } catch { /* */ }
                if (!opImages.length && bk.operation_site_image) opImages = [bk.operation_site_image];

                return (
                  <div key={bk.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    {/* Card header */}
                    <button onClick={() => setExpandedBooking(isExpanded ? null : bk.id)}
                      className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                          <User className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{bk.patient_name || 'Unknown'}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                            <span>#{bk.hospital_number || 'N/A'}</span>
                            {bk.ward && <span><MapPin className="inline w-3 h-3 mr-1" />{bk.ward}</span>}
                            <span><CalendarDays className="inline w-3 h-3 mr-1" />{bk.date ? safeFormatDate(bk.date, 'dd MMM yyyy') : 'TBD'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={'px-3 py-1 text-xs font-medium rounded-full border ' +
                          (bk.status === 'confirmed' ? 'bg-green-100 text-green-700 border-green-300' :
                           bk.status === 'scheduled' ? 'bg-blue-100 text-blue-700 border-blue-300' :
                           'bg-gray-100 text-gray-700 border-gray-300')}>
                          {bk.status}
                        </span>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t px-4 py-4 bg-gray-50 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Indication</div>
                            <div className="text-sm text-gray-800">{bk.indication || 'Not specified'}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Procedure</div>
                            <div className="text-sm text-gray-800 font-medium">{bk.procedure_name || 'Not specified'}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Surgery Date</div>
                            <div className="text-sm text-gray-800">{bk.date ? safeFormatDate(bk.date, 'EEEE, dd MMMM yyyy') : 'TBD'}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Surgeon</div>
                            <div className="text-sm text-gray-800">{bk.primary_surgeon || 'N/A'}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Anaesthesia</div>
                            <div className="text-sm text-gray-800 capitalize">{bk.anaesthesia_type || 'N/A'}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium">Theatre</div>
                            <div className="text-sm text-gray-800">{bk.theatre_number || 'N/A'}</div>
                          </div>
                        </div>

                        {/* Status indicators */}
                        <div className="flex flex-wrap gap-3 text-sm">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                            <Shield className={'w-4 h-4 ' + (bk.consent_obtained ? 'text-green-600' : 'text-red-500')} />
                            <span>Consent: {bk.consent_obtained ? 'Obtained' : 'Pending'}</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                            <ShoppingCart className={'w-4 h-4 ' + (bk.equipment_needed && bk.equipment_needed.length > 0 ? 'text-green-600' : 'text-yellow-500')} />
                            <span>Shopping List: {bk.equipment_needed && bk.equipment_needed.length > 0 ? 'Ready (' + bk.equipment_needed.length + ' items)' : 'Pending'}</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border">
                            <CheckCircle className={'w-4 h-4 ' + (bk.pre_op_checklist_completed ? 'text-green-600' : 'text-yellow-500')} />
                            <span>Pre-op Checklist: {bk.pre_op_checklist_completed ? 'Complete' : 'Incomplete'}</span>
                          </div>
                        </div>

                        {/* Clinical photographs */}
                        {opImages.length > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Clinical Photographs</div>
                            <div className="flex flex-wrap gap-2">
                              {opImages.map((img, i) => (
                                <img key={i} src={img} alt={'Lesion ' + (i + 1)}
                                  className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                                  onClick={() => window.open(img, '_blank')} />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Equipment / Shopping list */}
                        {bk.equipment_needed && bk.equipment_needed.length > 0 && (
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Surgical Equipment / Shopping List</div>
                            <div className="flex flex-wrap gap-2">
                              {bk.equipment_needed.map((eq, i) => (
                                <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">{eq}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Notes / Remarks */}
                        {bk.notes && (
                          <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Notes</div>
                            <p className="text-sm text-gray-700">{bk.notes}</p>
                          </div>
                        )}

                        {/* ─── DOCUMENT UPLOADS & INVESTIGATIONS ─── */}
                        <div className="border-t pt-4 mt-2 space-y-4">
                          <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary-600" />
                            Documents & Investigations
                          </h4>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Upload Signed Consent */}
                            <div className="bg-white p-3 rounded-lg border space-y-2">
                              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1">
                                <Shield className="w-3 h-3" /> Signed Consent
                              </div>
                              {bookedCaseDocs[bk.id]?.signedConsent ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                                    <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                                  </div>
                                  {bookedCaseDocs[bk.id].signedConsent!.startsWith('data:image') && (
                                    <img src={bookedCaseDocs[bk.id].signedConsent!} alt="Consent" className="w-full h-20 object-cover rounded border cursor-pointer"
                                      onClick={() => window.open(bookedCaseDocs[bk.id].signedConsent!, '_blank')} />
                                  )}
                                  <button onClick={() => {
                                    setUploadTarget({ bookingId: bk.id, type: 'consent' });
                                    setTimeout(() => consentFileRef.current?.click(), 50);
                                  }} className="text-xs text-primary-600 hover:underline">Replace</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setUploadTarget({ bookingId: bk.id, type: 'consent' });
                                    setTimeout(() => consentFileRef.current?.click(), 50);
                                  }}
                                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-1"
                                >
                                  <Upload className="w-3.5 h-3.5" /> Upload Consent
                                </button>
                              )}
                            </div>

                            {/* Upload Payment Evidence */}
                            <div className="bg-white p-3 rounded-lg border space-y-2">
                              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1">
                                <CreditCard className="w-3 h-3" /> Payment Evidence
                              </div>
                              {bookedCaseDocs[bk.id]?.paymentEvidence ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                                    <CheckCircle className="w-3.5 h-3.5" /> Uploaded
                                  </div>
                                  {bookedCaseDocs[bk.id].paymentEvidence!.startsWith('data:image') && (
                                    <img src={bookedCaseDocs[bk.id].paymentEvidence!} alt="Payment" className="w-full h-20 object-cover rounded border cursor-pointer"
                                      onClick={() => window.open(bookedCaseDocs[bk.id].paymentEvidence!, '_blank')} />
                                  )}
                                  <button onClick={() => {
                                    setUploadTarget({ bookingId: bk.id, type: 'payment' });
                                    setTimeout(() => paymentFileRef.current?.click(), 50);
                                  }} className="text-xs text-primary-600 hover:underline">Replace</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setUploadTarget({ bookingId: bk.id, type: 'payment' });
                                    setTimeout(() => paymentFileRef.current?.click(), 50);
                                  }}
                                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-1"
                                >
                                  <Upload className="w-3.5 h-3.5" /> Upload Receipt
                                </button>
                              )}
                            </div>

                            {/* Investigation Results */}
                            <div className="bg-white p-3 rounded-lg border space-y-2">
                              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium flex items-center gap-1">
                                <FlaskConical className="w-3 h-3" /> Investigation Results
                              </div>
                              {(() => {
                                const patientInvs = investigationResults[bk.patient_id] || [];
                                const abnormalCount = patientInvs.filter(r => r.flag === 'abnormal').length;
                                const borderlineCount = patientInvs.filter(r => r.flag === 'borderline').length;
                                const normalCount = patientInvs.filter(r => r.flag === 'normal').length;
                                return patientInvs.length > 0 ? (
                                  <div className="space-y-2">
                                    <div className="flex flex-wrap gap-1.5">
                                      {normalCount > 0 && <span className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded-full">{normalCount} Normal</span>}
                                      {borderlineCount > 0 && <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded-full">{borderlineCount} Borderline</span>}
                                      {abnormalCount > 0 && <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-700 rounded-full">{abnormalCount} Abnormal</span>}
                                    </div>
                                    <button
                                      onClick={() => openBookedCaseInvestigations(bk.patient_id)}
                                      className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" /> View / Edit Results
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openBookedCaseInvestigations(bk.patient_id)}
                                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-primary-400 hover:text-primary-600 flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Enter Results
                                  </button>
                                );
                              })()}
                            </div>
                          </div>

                          {/* Investigation detail table */}
                          {(investigationResults[bk.patient_id] || []).length > 0 && (
                            <div className="bg-white rounded-lg border overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Investigation</th>
                                    <th className="text-left px-3 py-2 text-gray-600 font-medium">Result</th>
                                    <th className="text-center px-3 py-2 text-gray-600 font-medium">Flag</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {(investigationResults[bk.patient_id] || []).map((inv, idx) => (
                                    <tr key={idx}>
                                      <td className="px-3 py-2 text-gray-800">{inv.name}</td>
                                      <td className="px-3 py-2 text-gray-700">{inv.value}</td>
                                      <td className="px-3 py-2 text-center">
                                        <span className={'px-2 py-0.5 rounded-full text-[10px] font-medium ' +
                                          (inv.flag === 'normal' ? 'bg-green-100 text-green-700' :
                                           inv.flag === 'borderline' ? 'bg-yellow-100 text-yellow-700' :
                                           'bg-red-100 text-red-700')}>
                                          {inv.flag.charAt(0).toUpperCase() + inv.flag.slice(1)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Force readiness info if applicable */}
                          {forceReadiness[bk.patient_id] && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <Unlock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="text-xs">
                                  <p className="font-medium text-amber-800">Force Readiness Override Applied</p>
                                  <p className="text-amber-700 mt-1">Reason: {forceReadiness[bk.patient_id].reason}</p>
                                  <p className="text-amber-600 mt-0.5">By: {forceReadiness[bk.patient_id].forcedBy} on {safeFormatDate(forceReadiness[bk.patient_id].forcedAt, 'dd MMM yyyy HH:mm')}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── STAGE REVIEW MODAL ─── */}
      {stageReviewPanel && (() => {
        const { patientId, stage } = stageReviewPanel;
        const sp = stagePatients.find(s => s.patient.id === patientId);
        const patientName = sp ? (sp.patient.full_name || ((sp.patient.first_name || '') + ' ' + (sp.patient.last_name || '')).trim()) : 'Patient';
        const approval = (stageApprovals[patientId] as any)?.[stage];
        const patientDocs = stageDocs[patientId] || {};

        const renderStageContent = () => {
          switch (stage) {
            case 'riskAssessed':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Review the risk assessment scores for this patient.</p>
                  {sp?.assessment ? (
                    <div className="grid grid-cols-2 gap-3">
                      {sp.assessment.bleeding_risk && (
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1">Bleeding Risk</div>
                          <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(sp.assessment.bleeding_risk.risk_level)}>
                            {sp.assessment.bleeding_risk.risk_level} (Score: {sp.assessment.bleeding_risk.risk_score})
                          </span>
                        </div>
                      )}
                      {sp.assessment.dvt_risk && (
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1">DVT Risk (Caprini)</div>
                          <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(sp.assessment.dvt_risk.risk_category)}>
                            {sp.assessment.dvt_risk.risk_category} (Score: {sp.assessment.dvt_risk.total_score})
                          </span>
                        </div>
                      )}
                      {sp.assessment.cardiovascular_risk && (
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1">Cardiac Risk (RCRI)</div>
                          <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(sp.assessment.cardiovascular_risk.risk_level)}>
                            {sp.assessment.cardiovascular_risk.risk_level} (Score: {sp.assessment.cardiovascular_risk.rcri_score})
                          </span>
                        </div>
                      )}
                      {sp.assessment.pressure_sore_risk && (
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="text-xs text-gray-500 mb-1">Pressure Sore (Braden)</div>
                          <span className={'px-2 py-1 text-xs rounded-full font-medium border ' + riskBadge(sp.assessment.pressure_sore_risk.risk_category)}>
                            {sp.assessment.pressure_sore_risk.risk_category} (Score: {sp.assessment.pressure_sore_risk.braden_total})
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">No risk assessment data available. Complete the pre-operative assessment first.</div>
                  )}
                </div>
              );

            case 'comorbidityChecked':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Review the patient's comorbidities and current medications.</p>
                  {sp?.assessment?.comorbidities_medications && sp.assessment.comorbidities_medications.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {sp.assessment.comorbidities_medications.map((c, i) => (
                          <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200">
                            {c.comorbidity}
                          </span>
                        ))}
                      </div>
                      {sp.assessment.current_medications && sp.assessment.current_medications.length > 0 && (
                        <div>
                          <div className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-2">Current Medications</div>
                          <div className="flex flex-wrap gap-2">
                            {sp.assessment.current_medications.map((m, i) => (
                              <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                                {m.drug_name}{m.dosage ? ' (' + m.dosage + ')' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">No comorbidities recorded.</div>
                  )}
                </div>
              );

            case 'shoppingListDone':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Review surgical equipment and shopping list.</p>
                  {sp?.booking?.equipment_needed && sp.booking.equipment_needed.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {sp.booking.equipment_needed.map((eq, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">{eq}</span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">No equipment / shopping list available yet.</div>
                  )}
                </div>
              );

            case 'investigationsOrdered':
              return (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Upload lab results and review investigation findings.</p>

                  {/* Upload investigation documents button */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Uploaded Lab Reports</h4>
                      <button
                        onClick={() => {
                          setInvestigationUploadTarget(patientId);
                          investigationFileRef.current?.click();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" /> Upload Lab Results
                      </button>
                    </div>

                    {/* Preview uploaded docs */}
                    {(investigationDocs[patientId] || []).length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(investigationDocs[patientId] || []).map((doc, idx) => (
                          <div key={idx} className="relative bg-white rounded-lg border overflow-hidden group">
                            {doc.dataUrl.startsWith('data:image') ? (
                              <img
                                src={doc.dataUrl}
                                alt={doc.name}
                                className="w-full h-32 object-cover cursor-pointer hover:opacity-90"
                                onClick={() => window.open(doc.dataUrl, '_blank')}
                              />
                            ) : (
                              <div
                                className="w-full h-32 flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:bg-gray-100"
                                onClick={() => window.open(doc.dataUrl, '_blank')}
                              >
                                <FileText className="w-8 h-8 text-gray-400 mb-1" />
                                <span className="text-xs text-gray-500">PDF Document</span>
                              </div>
                            )}
                            <div className="px-2 py-1.5 bg-white border-t">
                              <p className="text-[10px] text-gray-600 truncate" title={doc.name}>{doc.name}</p>
                              <p className="text-[9px] text-gray-400">{safeFormatDate(doc.uploadedAt, 'dd MMM yyyy HH:mm')}</p>
                            </div>
                            <button
                              onClick={() => removeInvestigationDoc(patientId, idx)}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Remove document"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setInvestigationUploadTarget(patientId);
                          investigationFileRef.current?.click();
                        }}
                        className="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex flex-col items-center gap-2 cursor-pointer"
                      >
                        <Upload className="w-6 h-6" />
                        Click to upload investigation results (photos, PDFs)
                      </div>
                    )}
                  </div>

                  {/* Entered investigation results summary */}
                  {(investigationResults[patientId] || []).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs text-gray-500 uppercase tracking-wider font-medium">Entered Results</h4>
                      <div className="space-y-1">
                        {(investigationResults[patientId] || []).map((r, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border text-sm">
                            <span className="text-gray-700 font-medium">{r.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-600">{r.value}</span>
                              <span className={'px-2 py-0.5 text-[10px] font-semibold rounded-full ' +
                                (r.flag === 'normal' ? 'bg-green-100 text-green-700' :
                                 r.flag === 'borderline' ? 'bg-yellow-100 text-yellow-700' :
                                 'bg-red-100 text-red-700')}>
                                {r.flag.charAt(0).toUpperCase() + r.flag.slice(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Button to open manual investigation entry modal */}
                  <button
                    onClick={() => openInvestigationModal(patientId)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors border border-gray-200"
                  >
                    <FlaskConical className="w-4 h-4" />
                    {(investigationResults[patientId] || []).length > 0 ? 'Edit Investigation Results' : 'Enter Investigation Results Manually'}
                  </button>
                </div>
              );

            case 'consentObtained':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Upload and review the signed consent document.</p>
                  {patientDocs.consentDoc ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                        <CheckCircle className="w-4 h-4" /> Consent document uploaded
                      </div>
                      {patientDocs.consentDoc.startsWith('data:image') ? (
                        <img src={patientDocs.consentDoc} alt="Consent Document" className="w-full max-h-64 object-contain rounded-lg border cursor-pointer"
                          onClick={() => window.open(patientDocs.consentDoc!, '_blank')} />
                      ) : patientDocs.consentDoc.startsWith('data:application/pdf') ? (
                        <div className="bg-gray-50 p-4 rounded-lg border text-center">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">PDF Document uploaded</p>
                          <button onClick={() => window.open(patientDocs.consentDoc!, '_blank')} className="text-xs text-primary-600 hover:underline mt-1">View PDF</button>
                        </div>
                      ) : null}
                      <button
                        onClick={() => planConsentFileRef.current?.click()}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> Replace document
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => planConsentFileRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 flex flex-col items-center gap-2"
                    >
                      <Upload className="w-6 h-6" />
                      Click to upload signed consent document
                    </button>
                  )}
                </div>
              );

            case 'paymentConfirmed':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Upload and review the payment evidence / receipt.</p>
                  {patientDocs.paymentDoc ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg border border-green-200">
                        <CheckCircle className="w-4 h-4" /> Payment evidence uploaded
                      </div>
                      {patientDocs.paymentDoc.startsWith('data:image') ? (
                        <img src={patientDocs.paymentDoc} alt="Payment Evidence" className="w-full max-h-64 object-contain rounded-lg border cursor-pointer"
                          onClick={() => window.open(patientDocs.paymentDoc!, '_blank')} />
                      ) : patientDocs.paymentDoc.startsWith('data:application/pdf') ? (
                        <div className="bg-gray-50 p-4 rounded-lg border text-center">
                          <CreditCard className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">PDF Receipt uploaded</p>
                          <button onClick={() => window.open(patientDocs.paymentDoc!, '_blank')} className="text-xs text-primary-600 hover:underline mt-1">View PDF</button>
                        </div>
                      ) : null}
                      <button
                        onClick={() => planPaymentFileRef.current?.click()}
                        className="text-xs text-primary-600 hover:underline flex items-center gap-1"
                      >
                        <Upload className="w-3 h-3" /> Replace document
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => planPaymentFileRef.current?.click()}
                      className="w-full py-6 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 flex flex-col items-center gap-2"
                    >
                      <Upload className="w-6 h-6" />
                      Click to upload payment evidence / receipt
                    </button>
                  )}
                </div>
              );

            case 'preOpInstructionsGiven':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Review the pre-operative instructions given to the patient.</p>
                  {sp?.assessment?.preop_instructions ? (
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{sp.assessment.preop_instructions}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">No pre-operative instructions recorded.</div>
                  )}
                </div>
              );

            case 'fullyPrepared':
              return (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">Overall readiness summary.</p>
                  {sp?.assessment?.comprehensive_summary ? (
                    <div className="bg-white p-4 rounded-lg border">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{sp.assessment.comprehensive_summary}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 italic">No comprehensive summary available.</div>
                  )}
                </div>
              );

            default:
              return <div className="text-sm text-gray-400 italic">No preview available for this stage.</div>;
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setStageReviewPanel(null); setStageReviewNote(''); }}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
                <div className="flex items-center gap-3">
                  <div className={'p-2 rounded-lg ' + (approval === 'accepted' ? 'bg-green-100' : approval === 'rejected' ? 'bg-red-100' : 'bg-blue-100')}>
                    {stage === 'riskAssessed' ? <Shield className="w-5 h-5 text-blue-600" /> :
                     stage === 'comorbidityChecked' ? <Stethoscope className="w-5 h-5 text-blue-600" /> :
                     stage === 'shoppingListDone' ? <ShoppingCart className="w-5 h-5 text-blue-600" /> :
                     stage === 'consentObtained' ? <Shield className="w-5 h-5 text-blue-600" /> :
                     stage === 'paymentConfirmed' ? <CreditCard className="w-5 h-5 text-blue-600" /> :
                     stage === 'preOpInstructionsGiven' ? <ClipboardCheck className="w-5 h-5 text-blue-600" /> :
                     <FileText className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{getStageLabel(stage)}</h3>
                    <p className="text-xs text-gray-500">{patientName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {approval && (
                    <span className={'px-2 py-1 text-xs font-medium rounded-full ' +
                      (approval === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                      {approval === 'accepted' ? 'Accepted' : 'Rejected'}
                    </span>
                  )}
                  <button onClick={() => { setStageReviewPanel(null); setStageReviewNote(''); }} className="p-2 hover:bg-gray-100 rounded-lg" title="Close">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-4 space-y-4">
                {renderStageContent()}

                {/* Review note */}
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">Review Note (optional)</label>
                  <textarea
                    value={stageReviewNote}
                    onChange={e => setStageReviewNote(e.target.value)}
                    rows={2}
                    placeholder="Add a note about this stage..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Footer with Accept / Reject */}
              <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between rounded-b-xl">
                <button onClick={() => { setStageReviewPanel(null); setStageReviewNote(''); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectStage(patientId, stage)}
                    className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => acceptStage(patientId, stage)}
                    className="px-5 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── INVESTIGATION RESULTS MODAL ─── */}
      {showInvestigationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowInvestigationModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg"><FlaskConical className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Investigation Results</h3>
                  <p className="text-xs text-gray-500">Enter results and flag each as Normal, Borderline, or Abnormal</p>
                </div>
              </div>
              <button onClick={() => setShowInvestigationModal(null)} className="p-2 hover:bg-gray-100 rounded-lg" title="Close">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {/* Upload investigation documents section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-blue-800 font-medium">
                    <Upload className="w-4 h-4" />
                    Upload Investigation Results
                  </div>
                  <button
                    onClick={() => {
                      setInvestigationUploadTarget(showInvestigationModal);
                      investigationFileRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Photos/PDF
                  </button>
                </div>
                {(investigationDocs[showInvestigationModal] || []).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(investigationDocs[showInvestigationModal] || []).map((doc, idx) => (
                      <div key={idx} className="relative group">
                        {doc.dataUrl.startsWith('data:image') ? (
                          <img src={doc.dataUrl} alt={doc.name}
                            className="w-16 h-16 object-cover rounded-lg border cursor-pointer hover:opacity-90"
                            onClick={() => window.open(doc.dataUrl, '_blank')} />
                        ) : (
                          <div className="w-16 h-16 flex flex-col items-center justify-center bg-white rounded-lg border cursor-pointer hover:bg-gray-50"
                            onClick={() => window.open(doc.dataUrl, '_blank')}>
                            <FileText className="w-5 h-5 text-gray-400" />
                            <span className="text-[8px] text-gray-400">PDF</span>
                          </div>
                        )}
                        <button onClick={() => removeInvestigationDoc(showInvestigationModal!, idx)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-blue-600">Upload photos or PDF scans of lab result sheets</p>
              </div>

              {/* Manual entry section header */}
              <div className="text-xs text-gray-500 uppercase tracking-wider font-medium pt-1">Manual Entry</div>
              {investigationEntries.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={entry.name}
                      onChange={e => {
                        const updated = [...investigationEntries];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setInvestigationEntries(updated);
                      }}
                      placeholder="Investigation name"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <input
                      type="text"
                      value={entry.value}
                      onChange={e => {
                        const updated = [...investigationEntries];
                        updated[idx] = { ...updated[idx], value: e.target.value };
                        setInvestigationEntries(updated);
                      }}
                      placeholder="Result value (e.g. 12.5 g/dL, Normal, Reactive)"
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div className="flex flex-col gap-1 min-w-[100px]">
                    {(['normal', 'borderline', 'abnormal'] as InvestigationFlag[]).map(flag => (
                      <button
                        key={flag}
                        onClick={() => {
                          const updated = [...investigationEntries];
                          updated[idx] = { ...updated[idx], flag };
                          setInvestigationEntries(updated);
                        }}
                        className={'px-3 py-1 text-xs font-medium rounded-lg border transition-colors ' +
                          (entry.flag === flag
                            ? flag === 'normal' ? 'bg-green-100 text-green-700 border-green-400'
                              : flag === 'borderline' ? 'bg-yellow-100 text-yellow-700 border-yellow-400'
                              : 'bg-red-100 text-red-700 border-red-400'
                            : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50')}
                      >
                        {flag.charAt(0).toUpperCase() + flag.slice(1)}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setInvestigationEntries(investigationEntries.filter((_, i) => i !== idx))}
                    className="p-1 text-gray-400 hover:text-red-500 mt-1"
                    title="Remove investigation"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={addCustomInvestigation}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors">
                <Plus className="w-4 h-4 inline mr-1" /> Add Custom Investigation
              </button>
            </div>
            <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between rounded-b-xl">
              <div className="text-xs text-gray-500">
                {investigationEntries.filter(e => e.flag === 'abnormal').length > 0 && (
                  <span className="text-red-600 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {investigationEntries.filter(e => e.flag === 'abnormal').length} abnormal result(s) — patient cannot be marked Ready without override
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowInvestigationModal(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={() => saveInvestigationResults(showInvestigationModal)}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">
                  Save Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── FORCE READINESS MODAL ─── */}
      {showForceReadinessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowForceReadinessModal(null); setForceReason(''); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-900">Force Readiness Override</h3>
                  <p className="text-xs text-red-600">Patient has abnormal investigation results</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-800 mb-2">Abnormal Results:</h4>
                <ul className="space-y-1">
                  {(investigationResults[showForceReadinessModal] || [])
                    .filter(r => r.flag === 'abnormal')
                    .map((r, i) => (
                      <li key={i} className="text-xs text-red-700 flex items-center gap-2">
                        <Ban className="w-3 h-3 flex-shrink-0" />
                        <span className="font-medium">{r.name}:</span> {r.value}
                      </li>
                    ))}
                </ul>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clinical Reason for Proceeding <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={forceReason}
                  onChange={e => setForceReason(e.target.value)}
                  rows={3}
                  placeholder="Provide clear clinical justification for marking this patient as ready despite abnormal results..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <p className="text-xs text-gray-500">
                This action will be logged with your name and timestamp for audit purposes.
              </p>
            </div>
            <div className="px-6 py-4 border-t flex items-center justify-end gap-2">
              <button onClick={() => { setShowForceReadinessModal(null); setForceReason(''); }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => handleForceReadiness(showForceReadinessModal)}
                disabled={!forceReason.trim()}
                className={'px-4 py-2 text-sm rounded-lg font-medium ' +
                  (forceReason.trim()
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed')}
              >
                <Unlock className="w-4 h-4 inline mr-1" /> Force Ready
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file inputs for booked case uploads */}
      <input type="file" ref={consentFileRef} className="hidden" accept="image/*,.pdf" title="Upload consent document"
        onChange={e => {
          if (e.target.files?.[0] && uploadTarget?.type === 'consent') {
            handleFileUpload(uploadTarget.bookingId, 'consent', e.target.files[0]);
          }
          e.target.value = '';
        }}
      />
      <input type="file" ref={paymentFileRef} className="hidden" accept="image/*,.pdf" title="Upload payment evidence"
        onChange={e => {
          if (e.target.files?.[0] && uploadTarget?.type === 'payment') {
            handleFileUpload(uploadTarget.bookingId, 'payment', e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      {/* Hidden file inputs for planning-phase stage review uploads */}
      <input type="file" ref={planConsentFileRef} className="hidden" accept="image/*,.pdf" title="Upload consent for stage review"
        onChange={e => {
          if (e.target.files?.[0] && stageReviewPanel) {
            handlePlanDocUpload(stageReviewPanel.patientId, 'consent', e.target.files[0]);
          }
          e.target.value = '';
        }}
      />
      <input type="file" ref={planPaymentFileRef} className="hidden" accept="image/*,.pdf" title="Upload payment for stage review"
        onChange={e => {
          if (e.target.files?.[0] && stageReviewPanel) {
            handlePlanDocUpload(stageReviewPanel.patientId, 'payment', e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      {/* Hidden file input for investigation document uploads */}
      <input type="file" ref={investigationFileRef} className="hidden" accept="image/*,.pdf" multiple title="Upload investigation results"
        onChange={e => {
          if (e.target.files && investigationUploadTarget) {
            Array.from(e.target.files).forEach(file => {
              handleInvestigationDocUpload(investigationUploadTarget, file);
            });
          }
          e.target.value = '';
          setInvestigationUploadTarget(null);
        }}
      />
    </div>
  );
};

export default BookingRegisterPage;
