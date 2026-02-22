import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Upload, X, CalendarDays
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

const getPreparationStatus = (a: PreoperativeAssessment | null, b?: SurgeryBooking | null): PreparationStatus => {
  const riskAssessed = !!(a?.bleeding_risk?.risk_level || a?.dvt_risk?.risk_category);
  const comorbidityChecked = !!(a?.comorbidities_medications && a.comorbidities_medications.length >= 0 && a.assessed_at);
  const investigationsOrdered = !!(a?.comprehensive_summary && a.comprehensive_summary.length > 30);
  const shoppingListDone = !!(b?.equipment_needed && b.equipment_needed.length > 0);
  const consentObtained = !!(a?.consent_document || b?.consent_obtained);
  const paymentConfirmed = !!(a?.payment_evidence);
  const preOpInstructionsGiven = !!(a?.preop_instructions && a.preop_instructions.length > 10);
  const fullyPrepared = riskAssessed && comorbidityChecked && consentObtained && preOpInstructionsGiven;
  return { riskAssessed, comorbidityChecked, investigationsOrdered, shoppingListDone, consentObtained, paymentConfirmed, preOpInstructionsGiven, fullyPrepared };
};

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
            const status = getPreparationStatus(a, b);
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
    else navigate('/procedures');
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
                        {/* Checklist progress bar */}
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
                          ].map(item => (
                            <div key={item.key} className={'text-center px-1 py-1 rounded text-[10px] font-medium ' +
                              ((sp.status as any)[item.key]
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-400')}>
                              {(sp.status as any)[item.key]
                                ? <CheckCircle className="w-3 h-3 inline mr-0.5" />
                                : <Clock className="w-3 h-3 inline mr-0.5" />}
                              {item.label}
                            </div>
                          ))}
                        </div>
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
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingRegisterPage;
