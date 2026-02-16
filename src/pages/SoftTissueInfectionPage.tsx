import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowRight, Award, BookOpen, Calculator,
  Camera, CheckCircle, ChevronDown, ChevronUp, Clock, ClipboardList,
  Download, Eye, FileText, FlaskConical, Heart, Loader2, Minus,
  Plus, Printer, RefreshCw, Save, Search, Shield, Stethoscope,
  Thermometer, Trash2, TrendingUp, User, X, Activity, Scissors,
  Bug, Syringe, Zap, List
} from 'lucide-react';
import { patientService } from '../services/patientService';
import { useAuthStore } from '../store/authStore';
import {
  STI_CLASSIFICATIONS, LRINEC_SCORE, LRINEC_INTERPRETATION, QSOFA_CRITERIA,
  LAB_PANELS, TREATMENT_PROTOCOLS, LOCATION_CONSIDERATIONS, NURSING_PROTOCOLS,
  PATIENT_EDUCATION, STI_CME_ARTICLE
} from '../data/softTissueInfectionProtocol';

// ============================================
// TYPES
// ============================================
interface Patient {
  id: string | number;
  hospital_number: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  phone?: string;
  ward?: string;
  bed?: string;
}

interface Assessment {
  id?: string;
  patient_id: string;
  patient_name: string;
  hospital_number: string;
  classification: string;
  severity: string;
  location: string;
  onset_date: string;
  duration_hours: number;
  clinical_features: string[];
  systemic_signs: string[];
  vital_signs: any;
  pain_score: number;
  pain_disproportionate: boolean;
  crepitus: boolean;
  skin_necrosis: boolean;
  hemorrhagic_bullae: boolean;
  lrinec_score: number;
  lrinec_risk: string;
  lrinec_details: any;
  qsofa_score: number;
  qsofa_details: any;
  comorbidities: string[];
  diabetes: boolean;
  diabetes_hba1c: number;
  renal_impairment: boolean;
  creatinine: number;
  jaundice: boolean;
  bilirubin: number;
  immunosuppressed: boolean;
  notes: string;
  status: string;
  assessment_date?: string;
}

const API_BASE = '/api/sti-protocol';

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

// ============================================
// MAIN COMPONENT
// ============================================
const SoftTissueInfectionPage: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'protocol' | 'lrinec' | 'assessment' | 'assessments' | 'treatment' | 'debridement' | 'orders' | 'education' | 'cme'>('protocol');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [assessments, setAssessments] = useState<any[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // LRINEC Calculator State
  const [lrinecInputs, setLrinecInputs] = useState({
    crp: 0, wbc: 0, hemoglobin: 0, sodium: 0, creatinine: 0, glucose: 0
  });
  const [lrinecResult, setLrinecResult] = useState<{ score: number; risk: string; interpretation: string } | null>(null);

  // qSOFA State
  const [qsofaInputs, setQsofaInputs] = useState({
    respiratoryRate: 0, systolicBP: 0, alteredMentation: false
  });
  const [qsofaResult, setQsofaResult] = useState<number>(0);

  // Assessment Form
  const [assessmentForm, setAssessmentForm] = useState<Partial<Assessment>>({
    classification: '', severity: '', location: '', onset_date: '', duration_hours: 0,
    clinical_features: [], systemic_signs: [], vital_signs: {},
    pain_score: 0, pain_disproportionate: false, crepitus: false,
    skin_necrosis: false, hemorrhagic_bullae: false,
    lrinec_score: 0, lrinec_risk: '', comorbidities: [],
    diabetes: false, renal_impairment: false, jaundice: false,
    immunosuppressed: false, notes: ''
  });

  // CME State
  const [cmeAnswers, setCmeAnswers] = useState<Record<number, number>>({});
  const [cmeSubmitted, setCmeSubmitted] = useState(false);
  const [cmeScore, setCmeScore] = useState(0);

  // Treatment Plan State
  const [treatmentPlans, setTreatmentPlans] = useState<any[]>([]);
  const [debridements, setDebridements] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length >= 2) {
      searchPatients(patientSearch);
    }
  }, [patientSearch]);

  const searchPatients = async (searchTerm: string) => {
    try {
      const results = await patientService.searchPatients(searchTerm);
      setPatients(results);
    } catch (err) {
      console.error('Error searching patients:', err);
    }
  };

  const fetchAssessments = useCallback(async (patientId?: string) => {
    setIsLoading(true);
    try {
      const params = patientId ? `?patientId=${patientId}` : '';
      const res = await fetch(`${API_BASE}/assessments${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAssessments(data.assessments || []);
      }
    } catch (err) {
      console.error('Error fetching assessments:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAssessmentDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/assessments/${id}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSelectedAssessment(data.assessment);
        setTreatmentPlans(data.treatmentPlans || []);
        setDebridements(data.debridements || []);
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error('Error fetching assessment details:', err);
    }
  };

  // ============================================
  // LRINEC CALCULATOR
  // ============================================
  const calculateLRINEC = () => {
    let score = 0;
    // CRP
    if (lrinecInputs.crp >= 150) score += 4;
    // WBC
    if (lrinecInputs.wbc < 5) score += 0;
    else if (lrinecInputs.wbc >= 5 && lrinecInputs.wbc <= 15) score += 0;
    else if (lrinecInputs.wbc > 15 && lrinecInputs.wbc <= 25) score += 1;
    else if (lrinecInputs.wbc > 25) score += 2;
    // Hemoglobin
    if (lrinecInputs.hemoglobin > 13.5) score += 0;
    else if (lrinecInputs.hemoglobin >= 11 && lrinecInputs.hemoglobin <= 13.5) score += 1;
    else if (lrinecInputs.hemoglobin < 11) score += 2;
    // Sodium
    if (lrinecInputs.sodium >= 135) score += 0;
    else if (lrinecInputs.sodium < 135) score += 2;
    // Creatinine (µmol/L)
    if (lrinecInputs.creatinine > 141) score += 2;
    // Glucose (mmol/L)
    if (lrinecInputs.glucose > 10) score += 1;

    let risk = 'low';
    let interpretation = '';
    if (score <= 5) { risk = 'low'; interpretation = 'Low risk - < 50% probability of NSTI. Continue workup.'; }
    else if (score >= 6 && score <= 7) { risk = 'intermediate'; interpretation = 'Intermediate risk - Consider further investigation. MRI or CT may be warranted.'; }
    else { risk = 'high'; interpretation = 'HIGH RISK - ≥ 75% probability of NSTI. Surgical consultation STAT.'; }

    setLrinecResult({ score, risk, interpretation });
  };

  const calculateQSOFA = () => {
    let score = 0;
    if (qsofaInputs.respiratoryRate >= 22) score += 1;
    if (qsofaInputs.systolicBP <= 100) score += 1;
    if (qsofaInputs.alteredMentation) score += 1;
    setQsofaResult(score);
  };

  // Generate LRINEC Lab Request Form PDF
  const generateLRINECLabRequest = async () => {
    // Warn if no patient selected but allow to continue
    if (!selectedPatient) {
      const proceed = window.confirm('No patient selected. The lab request form will have blank patient details.\n\nDo you want to continue?');
      if (!proceed) return;
    }

    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 15;

    // Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LABORATORY REQUEST FORM', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(11);
    doc.setTextColor(220, 38, 38);
    doc.text('LRINEC Score Panel - Soft Tissue Infection Workup', pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Patient Info Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');

    const patientName = selectedPatient ? (selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`) : '________________________________';
    const hospitalNo = selectedPatient ? selectedPatient.hospital_number : '________________';
    const patientDOB = selectedPatient?.date_of_birth ? new Date(selectedPatient.date_of_birth).toLocaleDateString('en-GB') : '________________';
    const patientGender = selectedPatient?.gender || '________';
    const patientBloodGroup = selectedPatient?.blood_group || '________';
    const patientPhone = selectedPatient?.phone || '________________';
    const patientWard = selectedPatient?.ward || '________________';
    const requestDate = new Date().toLocaleDateString('en-GB');
    const requestTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    // Patient Details - Row 1
    doc.text(`Patient Name: ${patientName}`, margin, y);
    doc.text(`Hospital No: ${hospitalNo}`, pageWidth - margin - 50, y);
    y += 6;
    // Patient Details - Row 2
    doc.text(`Date of Birth: ${patientDOB}`, margin, y);
    doc.text(`Gender: ${patientGender}`, margin + 55, y);
    doc.text(`Blood Group: ${patientBloodGroup}`, pageWidth - margin - 50, y);
    y += 6;
    // Patient Details - Row 3
    doc.text(`Phone: ${patientPhone}`, margin, y);
    doc.text(`Ward/Clinic: ${patientWard}`, margin + 70, y);
    y += 6;
    // Request Details
    doc.text(`Request Date: ${requestDate}`, margin, y);
    doc.text(`Time: ${requestTime}`, margin + 60, y);
    y += 10;

    // Clinical Indication
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICAL INDICATION:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Suspected Soft Tissue Infection / Necrotizing Fasciitis Workup', margin, y);
    y += 5;
    doc.text('LRINEC Score Calculation Required', margin, y);
    y += 10;

    // Tests Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(14, 159, 110);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text('TESTS REQUESTED', margin + 3, y + 5.5);
    doc.text('SAMPLE', margin + 80, y + 5.5);
    doc.text('URGENCY', margin + 115, y + 5.5);
    doc.text('TICK', margin + 155, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 10;

    // LRINEC Required Tests
    const lrinecTests = [
      { test: 'C-Reactive Protein (CRP)', sample: 'Serum (Gold)', urgency: 'STAT' },
      { test: 'Full Blood Count (WBC, Hb)', sample: 'EDTA (Purple)', urgency: 'STAT' },
      { test: 'Serum Sodium (Na+)', sample: 'Serum (Gold)', urgency: 'STAT' },
      { test: 'Serum Creatinine', sample: 'Serum (Gold)', urgency: 'STAT' },
      { test: 'Random Blood Glucose', sample: 'Fluoride (Grey)', urgency: 'STAT' },
    ];

    doc.setFont('helvetica', 'normal');
    lrinecTests.forEach((t, i) => {
      const rowY = y + i * 8;
      if (i % 2 === 0) {
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, rowY - 1, pageWidth - 2 * margin, 8, 'F');
      }
      doc.text(t.test, margin + 3, rowY + 4);
      doc.text(t.sample, margin + 80, rowY + 4);
      doc.setTextColor(220, 38, 38);
      doc.setFont('helvetica', 'bold');
      doc.text(t.urgency, margin + 115, rowY + 4);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      // Checkbox
      doc.rect(margin + 157, rowY, 5, 5);
      doc.text('X', margin + 158, rowY + 4); // Pre-ticked
    });
    y += lrinecTests.length * 8 + 5;

    // Additional Tests Section
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(234, 179, 8);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.text('ADDITIONAL TESTS (If Sepsis/NSTI Suspected)', margin + 3, y + 5.5);
    y += 10;

    const additionalTests = [
      { test: 'Blood Lactate', sample: 'Fluoride (Grey)', urgency: 'STAT' },
      { test: 'Blood Culture (2 sets)', sample: 'Culture bottles', urgency: 'STAT' },
      { test: 'Procalcitonin', sample: 'Serum (Gold)', urgency: 'Urgent' },
      { test: 'Arterial Blood Gas (ABG)', sample: 'Heparinized syringe', urgency: 'STAT' },
      { test: 'Creatine Kinase (CK)', sample: 'Serum (Gold)', urgency: 'Urgent' },
      { test: 'Liver Function Tests', sample: 'Serum (Gold)', urgency: 'Urgent' },
      { test: 'Coagulation Screen (PT/INR, aPTT)', sample: 'Citrate (Blue)', urgency: 'Urgent' },
      { test: 'D-Dimer', sample: 'Citrate (Blue)', urgency: 'Urgent' },
      { test: 'Group & Crossmatch (2 units)', sample: 'EDTA (Purple)', urgency: 'Urgent' },
    ];

    doc.setFont('helvetica', 'normal');
    additionalTests.forEach((t, i) => {
      const rowY = y + i * 7;
      doc.text(t.test, margin + 3, rowY + 4);
      doc.text(t.sample, margin + 80, rowY + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(t.urgency, margin + 115, rowY + 4);
      doc.setFont('helvetica', 'normal');
      // Empty checkbox
      doc.rect(margin + 157, rowY, 5, 5);
    });
    y += additionalTests.length * 7 + 10;

    // Specimen Collection Notes
    doc.setFont('helvetica', 'bold');
    doc.text('SPECIMEN COLLECTION NOTES:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('- Collect BEFORE starting antibiotics if possible', margin, y); y += 4;
    doc.text('- Label all specimens with patient details and collection time', margin, y); y += 4;
    doc.text('- Blood cultures: 2 separate sites, 10mL per bottle', margin, y); y += 4;
    doc.text('- ABG: Transport on ice immediately to lab', margin, y);
    y += 10;

    // Requesting Doctor Section
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUESTING DOCTOR:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const userName = user?.name || user?.full_name || '________________';
    doc.text(`Name: ${userName}`, margin, y);
    doc.text('Signature: ________________', margin + 70, y);
    y += 6;
    doc.text('Bleep/Phone: ________________', margin, y);
    doc.text('Designation: ________________', margin + 70, y);
    y += 15;

    // Footer - LRINEC Reference
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 35, 'F');
    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LRINEC SCORE INTERPRETATION (Laboratory Risk Indicator for Necrotizing Fasciitis)', margin + 3, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('CRP >= 150: +4 | WBC 15-25: +1, >25: +2 | Hb 11-13.5: +1, <11: +2 | Na < 135: +2 | Cr > 1.6: +2 | Glucose > 180: +1', margin + 3, y);
    y += 5;
    doc.setTextColor(34, 197, 94);
    doc.text('Score 0-5: Low Risk (<50% probability NSTI)', margin + 3, y);
    doc.setTextColor(234, 179, 8);
    doc.text('Score 6-7: Moderate Risk (50-75%)', margin + 70, y);
    doc.setTextColor(220, 38, 38);
    doc.text('Score >= 8: HIGH RISK (>75%) - Surgical Consult STAT', margin + 115, y);
    doc.setTextColor(0, 0, 0);

    // Download PDF
    doc.save(`LRINEC_Lab_Request_${selectedPatient?.hospital_number || 'Form'}_${new Date().toISOString().split('T')[0]}.pdf`);
    setMessage({ type: 'success', text: 'Lab request form generated successfully!' });
  };

  // ============================================
  // SAVE ASSESSMENT
  // ============================================
  const saveAssessment = async () => {
    if (!selectedPatient) {
      setMessage({ type: 'error', text: 'Please select a patient first' });
      return;
    }
    if (!assessmentForm.classification || !assessmentForm.severity) {
      setMessage({ type: 'error', text: 'Classification and severity are required' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        patientId: selectedPatient.id,
        hospitalNumber: selectedPatient.hospital_number,
        patientName: selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        ...assessmentForm,
        clinicalFeatures: assessmentForm.clinical_features,
        systemicSigns: assessmentForm.systemic_signs,
        vitalSigns: assessmentForm.vital_signs,
        painScore: assessmentForm.pain_score,
        painDisproportionate: assessmentForm.pain_disproportionate,
        lrinecScore: lrinecResult?.score || 0,
        lrinecRisk: lrinecResult?.risk || 'not_calculated',
        lrinecDetails: lrinecInputs,
        qsofaScore: qsofaResult,
        qsofaDetails: qsofaInputs,
        diabetesHba1c: assessmentForm.diabetes_hba1c,
        renalImpairment: assessmentForm.renal_impairment,
        hemorrhagicBullae: assessmentForm.hemorrhagic_bullae,
        skinNecrosis: assessmentForm.skin_necrosis,
        onsetDate: assessmentForm.onset_date,
        durationHours: assessmentForm.duration_hours
      };

      const res = await fetch(`${API_BASE}/assessments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({ type: 'success', text: 'Assessment saved successfully' });
        setSelectedAssessment(data.assessment);
        fetchAssessments(String(selectedPatient.id));
        setActiveTab('treatment');
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Failed to save assessment' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error saving assessment' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // CREATE TREATMENT PLAN
  // ============================================
  const createTreatmentPlan = async (protocolId: string) => {
    if (!selectedAssessment) return;

    const protocol = TREATMENT_PROTOCOLS.find(p => p.id === protocolId);
    if (!protocol) return;

    setIsSaving(true);
    try {
      const payload = {
        assessmentId: selectedAssessment.id,
        patientId: selectedAssessment.patient_id,
        hospitalNumber: selectedAssessment.hospital_number,
        patientName: selectedAssessment.patient_name,
        protocolId,
        stage: selectedAssessment.classification,
        severity: selectedAssessment.severity,
        antibiotics: protocol.antibiotics.map(abx => ({
          drug: abx.drug, dose: abx.dose, frequency: abx.frequency,
          route: abx.route, duration: abx.duration, indication: abx.indication
        })),
        surgicalInterventions: protocol.surgicalInterventions.map(si => ({
          procedure: si.procedure, timing: si.timing, indication: si.indication, technique: si.technique
        })),
        supportiveCare: protocol.supportiveCare || [],
        monitoringPlan: protocol.monitoring || [],
        comorbidityModifications: protocol.comorbidityModifications?.map(cm => ({
          comorbidity: cm.comorbidity, modifications: cm.modifications
        })) || [],
        escalationCriteria: protocol.escalationCriteria || []
      };

      const res = await fetch(`${API_BASE}/treatment-plans`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setTreatmentPlans(prev => [data.treatmentPlan, ...prev]);
        setMessage({ type: 'success', text: 'Treatment plan created. Review and approve to auto-generate orders.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to create treatment plan' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // APPROVE TREATMENT PLAN (TRIGGERS AUTO-ORDERS)
  // ============================================
  const approveTreatmentPlan = async (planId: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/treatment-plans/${planId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ autoOrdersApproved: true })
      });

      if (res.ok) {
        const data = await res.json();
        setTreatmentPlans(prev => prev.map(p => p.id === planId ? data.treatmentPlan : p));
        setMessage({ type: 'success', text: 'Treatment plan approved! Orders auto-generated for prescriptions, labs, and procedures.' });
        // Refresh orders
        if (selectedAssessment) fetchAssessmentDetails(selectedAssessment.id);
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to approve treatment plan' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // SAVE DEBRIDEMENT
  // ============================================
  const [debridementForm, setDebridementForm] = useState({
    surgeon: '', assistant: '', anesthesiaType: 'GA', findings: '',
    tissueDebrided: '', woundBedStatus: '', marginsViable: true,
    culturesSent: false, estimatedBloodLoss: '', dressingApplied: '',
    vacApplied: false, vacSettings: { pressure: -125, mode: 'continuous' },
    nextPlannedDebridement: '', complications: '', notes: ''
  });

  const saveDebridement = async () => {
    if (!selectedAssessment || !selectedPatient) return;
    setIsSaving(true);
    try {
      const payload = {
        assessmentId: selectedAssessment.id,
        patientId: selectedPatient.id,
        hospitalNumber: selectedPatient.hospital_number,
        patientName: selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        debridementNumber: debridements.length + 1,
        ...debridementForm,
        woundDimensions: assessmentForm.vital_signs // placeholder
      };

      const res = await fetch(`${API_BASE}/debridements`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        setDebridements(prev => [data.debridement, ...prev]);
        setMessage({ type: 'success', text: `Debridement #${debridements.length + 1} recorded successfully` });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save debridement' });
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================
  // CME QUIZ
  // ============================================
  const submitCME = async () => {
    const questions = STI_CME_ARTICLE.mcqQuestions || [];
    let correct = 0;
    questions.forEach((q, idx) => {
      if (cmeAnswers[idx] === q.correctAnswer) correct++;
    });
    const score = Math.round((correct / questions.length) * 100);
    setCmeScore(score);
    setCmeSubmitted(true);

    try {
      await fetch(`${API_BASE}/cme`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          articleId: STI_CME_ARTICLE.id,
          score,
          totalQuestions: questions.length,
          correctAnswers: correct,
          answers: cmeAnswers,
          passed: score >= 70,
          creditsEarned: score >= 70 ? STI_CME_ARTICLE.cmeCredits : 0
        })
      });
    } catch (err) {
      console.error('Error recording CME:', err);
    }
  };

  // ============================================  
  // EXPORT / PRINT
  // ============================================
  const exportAssessment = () => {
    if (!selectedAssessment) return;
    const data = JSON.stringify(selectedAssessment, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `STI_Assessment_${selectedAssessment.hospital_number}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printProtocol = () => {
    window.print();
  };

  // ============================================
  // TABS
  // ============================================
  const tabs = [
    { id: 'protocol', label: 'Protocol Guide', icon: BookOpen },
    { id: 'lrinec', label: 'LRINEC Calculator', icon: Calculator },
    { id: 'assessment', label: 'New Assessment', icon: ClipboardList },
    { id: 'assessments', label: 'Patient Records', icon: FileText },
    { id: 'treatment', label: 'Treatment Plans', icon: Stethoscope },
    { id: 'debridement', label: 'Debridement Log', icon: Scissors },
    { id: 'orders', label: 'Auto-Orders', icon: List },
    { id: 'education', label: 'Education', icon: BookOpen },
    { id: 'cme', label: 'CME Assessment', icon: Award },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 print:mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <Bug className="h-8 w-8 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Soft Tissue Infection / NEC Protocol</h1>
            <p className="text-sm text-gray-500">Cellulitis to Necrotizing Soft Tissue Infection & Gas Gangrene</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <button onClick={printProtocol} className="flex items-center gap-1 px-3 py-2 border rounded-lg hover:bg-gray-50 text-sm">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button onClick={exportAssessment} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm" disabled={!selectedAssessment}>
            <Download className="h-4 w-4" /> Export
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          <span className="text-sm">{message.text}</span>
          <button onClick={() => setMessage(null)} className="ml-auto" title="Dismiss message"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-1 mb-6 border-b print:hidden overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================ */}
      {/* PROTOCOL GUIDE TAB */}
      {/* ============================================ */}
      {activeTab === 'protocol' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Classification of Soft Tissue Infections</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {STI_CLASSIFICATIONS.map((cls) => (
              <div key={cls.id} className={`border-l-4 rounded-lg p-4 shadow-sm ${
                cls.severity === 'critical' ? 'border-red-600 bg-red-50' :
                cls.severity === 'severe' ? 'border-orange-500 bg-orange-50' :
                cls.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' :
                'border-green-500 bg-green-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900">{cls.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                    cls.severity === 'critical' ? 'bg-red-200 text-red-800' :
                    cls.severity === 'severe' ? 'bg-orange-200 text-orange-800' :
                    cls.severity === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                    'bg-green-200 text-green-800'
                  }`}>{cls.severity}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{cls.description}</p>
                
                <div className="mt-2">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Key Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {cls.clinicalFeatures.slice(0, 4).map((f, i) => (
                      <span key={i} className="text-xs bg-white/70 px-2 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                </div>

                {cls.redFlags && cls.redFlags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-red-700 mb-1">Red Flags:</p>
                    <div className="flex flex-wrap gap-1">
                      {cls.redFlags.map((rf, i) => (
                        <span key={i} className="text-xs bg-red-200/50 text-red-800 px-2 py-0.5 rounded">{rf}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-gray-600 flex items-center gap-2">
                  <span className="font-semibold">Disposition:</span>
                  <span className={`px-2 py-0.5 rounded ${
                    (cls.severity === 'critical' || cls.severity === 'severe') ? 'bg-red-200 text-red-800' :
                    cls.severity === 'moderate' ? 'bg-blue-200 text-blue-800' :
                    'bg-green-200 text-green-800'
                  }`}>{
                    cls.severity === 'critical' ? 'ICU' :
                    cls.severity === 'severe' ? 'ICU / HDU' :
                    cls.severity === 'moderate' ? 'WARD' :
                    'OUTPATIENT'
                  }</span>
                </div>
              </div>
            ))}
          </div>

          {/* Location Considerations */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Location-Specific Considerations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {LOCATION_CONSIDERATIONS.map((loc) => (
                <div key={loc.location} className="bg-white border rounded-lg p-4 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-2">{loc.location}</h3>
                  <div className="space-y-1">
                    {(loc.specialConsiderations || []).map((c, i) => (
                      <p key={i} className="text-xs text-gray-600 flex items-start gap-1">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-green-600 flex-shrink-0" />
                        {c}
                      </p>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded">
                    Risk Factors: {loc.riskFactors.slice(0, 3).join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* LRINEC CALCULATOR TAB */}
      {/* ============================================ */}
      {activeTab === 'lrinec' && (
        <div className="space-y-6">
          {/* Patient Selection for LRINEC */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" /> Select Patient for Evaluation
            </h3>
            <p className="text-sm text-gray-500 mb-3">Search and select a patient to associate with the LRINEC assessment and lab request form.</p>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-300"
                placeholder="Search by name or hospital number..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
              />
            </div>
            {patients.length > 0 && !selectedPatient && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {patients.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatients([]); }}
                    className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm border-b last:border-b-0">
                    <span className="font-medium">{p.full_name || `${p.first_name} ${p.last_name}`}</span>
                    <span className="text-gray-500 ml-2">({p.hospital_number})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-semibold text-green-800">
                    {selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}
                  </span>
                  <span className="text-sm text-green-700 ml-2">({selectedPatient.hospital_number})</span>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-green-600 hover:text-green-800" title="Clear patient selection">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {!selectedPatient && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">Select a patient to include their details in the lab request form</span>
              </div>
            )}
          </div>

          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="h-6 w-6 text-red-600" />
              <h2 className="text-xl font-bold">LRINEC Score Calculator</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">Laboratory Risk Indicator for Necrotizing Fasciitis. Helps distinguish necrotizing soft tissue infection from other soft tissue infections.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {LRINEC_SCORE.map((param) => (
                <div key={param.parameter} className="border rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{param.parameter}</label>
                  <p className="text-xs text-gray-500 mb-2">Unit: {param.unit}</p>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-green-300 focus:border-green-500"
                    value={lrinecInputs[param.parameter.toLowerCase().replace(/[^a-z]/g, '') as keyof typeof lrinecInputs] || ''}
                    onChange={(e) => {
                      const key = param.parameter === 'C-Reactive Protein' ? 'crp' :
                                  param.parameter === 'White Blood Cell Count' ? 'wbc' :
                                  param.parameter === 'Hemoglobin' ? 'hemoglobin' :
                                  param.parameter === 'Sodium' ? 'sodium' :
                                  param.parameter === 'Creatinine' ? 'creatinine' : 'glucose';
                      setLrinecInputs(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }));
                    }}
                    placeholder={`Enter ${param.parameter}`}
                  />
                  <div className="mt-2 text-xs text-gray-500">
                    {param.ranges.map((r, i) => (
                      <p key={i}>{r.range}: +{r.score} pts</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col md:flex-row gap-3">
              <button
                onClick={calculateLRINEC}
                className="w-full md:w-auto px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"
              >
                <Calculator className="h-5 w-5" />
                Calculate LRINEC Score
              </button>
              <button
                onClick={generateLRINECLabRequest}
                className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold flex items-center justify-center gap-2"
              >
                <FileText className="h-5 w-5" />
                Generate Lab Request Form
              </button>
            </div>

            {lrinecResult && (
              <div className={`mt-6 p-4 rounded-lg border-2 ${
                lrinecResult.risk === 'high' ? 'bg-red-50 border-red-500' :
                lrinecResult.risk === 'intermediate' ? 'bg-yellow-50 border-yellow-500' :
                'bg-green-50 border-green-500'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`text-4xl font-bold ${
                    lrinecResult.risk === 'high' ? 'text-red-600' :
                    lrinecResult.risk === 'intermediate' ? 'text-yellow-600' : 'text-green-600'
                  }`}>{lrinecResult.score}</div>
                  <div>
                    <p className="font-semibold text-gray-800">Risk Level: <span className="uppercase">{lrinecResult.risk}</span></p>
                    <p className="text-sm text-gray-600">{lrinecResult.interpretation}</p>
                  </div>
                </div>
                {lrinecResult.risk === 'high' && (
                  <div className="mt-3 p-3 bg-red-100 rounded border border-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-800">URGENT: Initiate surgical consultation and empiric antibiotics IMMEDIATELY</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* qSOFA Calculator */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Thermometer className="h-6 w-6 text-orange-600" />
              <h2 className="text-xl font-bold">qSOFA Score (Quick Sequential Organ Failure Assessment)</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="border rounded-lg p-4">
                <label className="block text-sm font-semibold mb-1">Respiratory Rate</label>
                <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="breaths/min"
                  value={qsofaInputs.respiratoryRate || ''}
                  onChange={e => setQsofaInputs(prev => ({ ...prev, respiratoryRate: parseInt(e.target.value) || 0 }))} />
                <p className="text-xs text-gray-500 mt-1">≥ 22 breaths/min = +1 point</p>
              </div>
              <div className="border rounded-lg p-4">
                <label className="block text-sm font-semibold mb-1">Systolic Blood Pressure</label>
                <input type="number" className="w-full border rounded px-3 py-2 text-sm" placeholder="mmHg"
                  value={qsofaInputs.systolicBP || ''}
                  onChange={e => setQsofaInputs(prev => ({ ...prev, systolicBP: parseInt(e.target.value) || 0 }))} />
                <p className="text-xs text-gray-500 mt-1">≤ 100 mmHg = +1 point</p>
              </div>
              <div className="border rounded-lg p-4">
                <label className="block text-sm font-semibold mb-1">Altered Mentation</label>
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" className="rounded"
                    checked={qsofaInputs.alteredMentation}
                    onChange={e => setQsofaInputs(prev => ({ ...prev, alteredMentation: e.target.checked }))} />
                  <span className="text-sm">GCS &lt; 15</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Altered mental status = +1 point</p>
              </div>
            </div>

            <button onClick={calculateQSOFA} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold text-sm">
              Calculate qSOFA
            </button>

            {qsofaResult > 0 && (
              <div className={`mt-4 p-4 rounded-lg ${qsofaResult >= 2 ? 'bg-red-50 border-2 border-red-500' : 'bg-yellow-50 border border-yellow-400'}`}>
                <p className="font-bold">qSOFA Score: {qsofaResult}/3</p>
                <p className="text-sm mt-1">{qsofaResult >= 2 ? 'Positive for sepsis risk. Initiate sepsis bundle.' : 'Monitor closely. Reassess if clinical deterioration.'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* NEW ASSESSMENT TAB */}
      {/* ============================================ */}
      {activeTab === 'assessment' && (
        <div className="space-y-6">
          {/* Patient Search */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" /> Select Patient
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-300"
                placeholder="Search by name or hospital number..."
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
              />
            </div>
            {patients.length > 0 && !selectedPatient && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {patients.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientSearch(''); setPatients([]); }}
                    className="w-full text-left px-4 py-2 hover:bg-green-50 text-sm border-b last:border-b-0">
                    <span className="font-medium">{p.full_name || `${p.first_name} ${p.last_name}`}</span>
                    <span className="text-gray-500 ml-2">({p.hospital_number})</span>
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">
                  {selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`} ({selectedPatient.hospital_number})
                </span>
                <button onClick={() => setSelectedPatient(null)} className="text-green-600 hover:text-green-800" title="Clear patient selection"><X className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          {/* Classification & Severity */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">Classification & Severity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Classification *</label>
                <select className="w-full border rounded px-3 py-2 text-sm" title="Select classification"
                  value={assessmentForm.classification}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, classification: e.target.value }))}>
                  <option value="">Select...</option>
                  {STI_CLASSIFICATIONS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Severity *</label>
                <select className="w-full border rounded px-3 py-2 text-sm" title="Select severity"
                  value={assessmentForm.severity}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, severity: e.target.value }))}>
                  <option value="">Select...</option>
                  <option value="mild">Mild</option>
                  <option value="moderate">Moderate</option>
                  <option value="severe">Severe</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Location</label>
                <select className="w-full border rounded px-3 py-2 text-sm" title="Select location"
                  value={assessmentForm.location}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, location: e.target.value }))}>
                  <option value="">Select...</option>
                  {LOCATION_CONSIDERATIONS.map(l => (
                    <option key={l.location} value={l.location}>{l.location}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Onset Date</label>
                <input type="date" className="w-full border rounded px-3 py-2 text-sm" title="Onset date"
                  value={assessmentForm.onset_date}
                  onChange={e => {
                    const onsetDate = e.target.value;
                    let durationHours = assessmentForm.duration_hours || 0;
                    if (onsetDate) {
                      const onset = new Date(onsetDate);
                      const now = new Date();
                      const diffMs = now.getTime() - onset.getTime();
                      durationHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));
                    }
                    setAssessmentForm(prev => ({ ...prev, onset_date: onsetDate, duration_hours: durationHours }));
                  }} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Duration (hours) <span className="text-xs text-gray-500 font-normal">Auto-calculated</span></label>
                <input type="number" className="w-full border rounded px-3 py-2 text-sm bg-gray-50" title="Duration in hours (auto-calculated from onset date)"
                  value={assessmentForm.duration_hours || ''}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, duration_hours: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Pain Score (0-10)</label>
                <input type="number" min="0" max="10" className="w-full border rounded px-3 py-2 text-sm" title="Pain score"
                  value={assessmentForm.pain_score || ''}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, pain_score: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
          </div>

          {/* Clinical Features & Red Flags */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">Clinical Features & Red Flags</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { key: 'pain_disproportionate', label: 'Pain out of proportion', icon: AlertTriangle, color: 'text-red-600' },
                { key: 'crepitus', label: 'Crepitus', icon: Zap, color: 'text-red-600' },
                { key: 'skin_necrosis', label: 'Skin necrosis', icon: AlertCircle, color: 'text-red-600' },
                { key: 'hemorrhagic_bullae', label: 'Hemorrhagic bullae', icon: AlertTriangle, color: 'text-red-600' },
              ].map(item => (
                <label key={item.key} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-red-50 ${
                  (assessmentForm as any)[item.key] ? 'bg-red-50 border-red-300' : ''
                }`}>
                  <input type="checkbox" className="rounded text-red-600"
                    checked={(assessmentForm as any)[item.key] || false}
                    onChange={e => setAssessmentForm(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>

            {/* Comorbidities */}
            <h4 className="font-semibold text-gray-700 mt-4 mb-2">Comorbidities</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'diabetes', label: 'Diabetes Mellitus' },
                { key: 'renal_impairment', label: 'Renal Impairment' },
                { key: 'jaundice', label: 'Jaundice / Hepatic' },
                { key: 'immunosuppressed', label: 'Immunosuppressed' },
              ].map(item => (
                <label key={item.key} className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-yellow-50 ${
                  (assessmentForm as any)[item.key] ? 'bg-yellow-50 border-yellow-300' : ''
                }`}>
                  <input type="checkbox" className="rounded text-yellow-600"
                    checked={(assessmentForm as any)[item.key] || false}
                    onChange={e => setAssessmentForm(prev => ({ ...prev, [item.key]: e.target.checked }))} />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>

            {assessmentForm.diabetes && (
              <div className="mt-3">
                <label className="text-sm font-semibold">HbA1c (%)</label>
                <input type="number" step="0.1" className="ml-2 border rounded px-3 py-1 text-sm w-24" title="HbA1c value"
                  value={assessmentForm.diabetes_hba1c || ''}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, diabetes_hba1c: parseFloat(e.target.value) }))} />
              </div>
            )}
            {assessmentForm.renal_impairment && (
              <div className="mt-3">
                <label className="text-sm font-semibold">Creatinine (µmol/L)</label>
                <input type="number" className="ml-2 border rounded px-3 py-1 text-sm w-24" title="Creatinine value"
                  value={assessmentForm.creatinine || ''}
                  onChange={e => setAssessmentForm(prev => ({ ...prev, creatinine: parseFloat(e.target.value) }))} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">Additional Notes</h3>
            <textarea className="w-full border rounded px-3 py-2 text-sm h-24"
              value={assessmentForm.notes || ''}
              onChange={e => setAssessmentForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Clinical notes, relevant history..." />
          </div>

          {/* Save Button */}
          <button onClick={saveAssessment} disabled={isSaving || !selectedPatient}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-semibold flex items-center justify-center gap-2 text-lg">
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {isSaving ? 'Saving Assessment...' : 'Save Assessment & Generate Treatment Plan'}
          </button>
        </div>
      )}

      {/* ============================================ */}
      {/* PATIENT RECORDS TAB */}
      {/* ============================================ */}
      {activeTab === 'assessments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">STI Assessments</h2>
            <button onClick={() => fetchAssessments()} className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No assessments found. Create one from the Assessment tab.</div>
          ) : (
            <div className="space-y-3">
              {assessments.map(a => (
                <div key={a.id} className={`border rounded-lg p-4 hover:shadow-md transition cursor-pointer ${
                  a.classification?.includes('nf') || a.classification?.includes('gangrene') || a.classification === 'fourniers'
                    ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'
                }`} onClick={() => { fetchAssessmentDetails(a.id); setActiveTab('treatment'); }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{a.patient_name || `${a.first_name} ${a.last_name}`}</p>
                      <p className="text-sm text-gray-500">
                        {a.hospital_number || a.p_hospital_number} | {new Date(a.assessment_date || a.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        a.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        a.severity === 'severe' ? 'bg-orange-100 text-orange-800' :
                        a.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>{a.severity}</span>
                      <p className="text-xs text-gray-500 mt-1">{STI_CLASSIFICATIONS.find(c => c.id === a.classification)?.name || a.classification}</p>
                    </div>
                  </div>
                  {a.lrinec_score > 0 && (
                    <p className="text-xs mt-2">LRINEC: <span className={`font-bold ${a.lrinec_score >= 8 ? 'text-red-600' : a.lrinec_score >= 6 ? 'text-yellow-600' : 'text-green-600'}`}>{a.lrinec_score}</span> | qSOFA: {a.qsofa_score}/3</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* TREATMENT PLANS TAB */}
      {/* ============================================ */}
      {activeTab === 'treatment' && (
        <div className="space-y-6">
          {selectedAssessment ? (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-bold text-blue-800">Patient: {selectedAssessment.patient_name}</p>
                <p className="text-sm text-blue-600">
                  Classification: {STI_CLASSIFICATIONS.find(c => c.id === selectedAssessment.classification)?.name} |
                  Severity: {selectedAssessment.severity} |
                  LRINEC: {selectedAssessment.lrinec_score}
                </p>
              </div>

              {/* Available Protocols */}
              <div>
                <h3 className="font-bold text-gray-800 mb-3">Available Treatment Protocols</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TREATMENT_PROTOCOLS.map(protocol => (
                    <div key={protocol.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <h4 className="font-bold text-gray-800">{protocol.stage}</h4>
                      <p className="text-sm text-gray-600 mb-2">Severity: {protocol.severity}</p>
                      <p className="text-xs text-gray-500 mb-3">Monitoring: {protocol.monitoring?.slice(0, 2).join(', ')}</p>
                      
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Antibiotics ({protocol.antibiotics.length}):</p>
                        {protocol.antibiotics.slice(0, 3).map((abx, i) => (
                          <p key={i} className="text-xs text-gray-600">
                            {abx.drug} {abx.dose} {abx.route} {abx.frequency}
                          </p>
                        ))}
                        {protocol.antibiotics.length > 3 && (
                          <p className="text-xs text-gray-400">+{protocol.antibiotics.length - 3} more...</p>
                        )}
                      </div>

                      <button onClick={() => createTreatmentPlan(protocol.id)} disabled={isSaving}
                        className="w-full py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-1">
                        <Plus className="h-4 w-4" /> Apply This Protocol
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Treatment Plans */}
              {treatmentPlans.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">Active Treatment Plans</h3>
                  {treatmentPlans.map(plan => (
                    <div key={plan.id} className="border rounded-lg p-4 mb-3 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold">{plan.protocol_id} - {plan.stage}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          plan.auto_orders_approved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>{plan.auto_orders_approved ? 'Approved & Ordered' : 'Pending Approval'}</span>
                      </div>
                      
                      {!plan.auto_orders_approved && (
                        <button onClick={() => approveTreatmentPlan(plan.id)} disabled={isSaving}
                          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />
                          Approve & Auto-Generate Orders
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Stethoscope className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>Select a patient assessment from the Records tab to view/create treatment plans</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* DEBRIDEMENT LOG TAB */}
      {/* ============================================ */}
      {activeTab === 'debridement' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Serial Debridement Tracking</h2>

          {/* New Debridement Form */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="font-bold mb-3">Log New Debridement</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Surgeon</label>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm" title="Surgeon name"
                  value={debridementForm.surgeon}
                  onChange={e => setDebridementForm(prev => ({ ...prev, surgeon: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Assistant</label>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm" title="Assistant name"
                  value={debridementForm.assistant}
                  onChange={e => setDebridementForm(prev => ({ ...prev, assistant: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Anesthesia</label>
                <select className="w-full border rounded px-3 py-2 text-sm" title="Anesthesia type"
                  value={debridementForm.anesthesiaType}
                  onChange={e => setDebridementForm(prev => ({ ...prev, anesthesiaType: e.target.value }))}>
                  <option value="GA">General Anesthesia</option>
                  <option value="Regional">Regional</option>
                  <option value="Local">Local Anesthesia</option>
                  <option value="Sedation">Sedation</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">EBL (mL)</label>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm" title="Estimated blood loss"
                  value={debridementForm.estimatedBloodLoss}
                  onChange={e => setDebridementForm(prev => ({ ...prev, estimatedBloodLoss: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-1">Findings</label>
              <textarea className="w-full border rounded px-3 py-2 text-sm h-20" title="Intraoperative findings"
                value={debridementForm.findings}
                onChange={e => setDebridementForm(prev => ({ ...prev, findings: e.target.value }))}
                placeholder="Describe intraoperative findings..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Wound Bed Status</label>
                <select className="w-full border rounded px-3 py-2 text-sm" title="Wound bed status"
                  value={debridementForm.woundBedStatus}
                  onChange={e => setDebridementForm(prev => ({ ...prev, woundBedStatus: e.target.value }))}>
                  <option value="">Select...</option>
                  <option value="necrotic">Necrotic</option>
                  <option value="slough">Sloughy</option>
                  <option value="granulating">Granulating</option>
                  <option value="mixed">Mixed</option>
                  <option value="clean">Clean viable tissue</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Dressing Applied</label>
                <input type="text" className="w-full border rounded px-3 py-2 text-sm" title="Dressing applied"
                  value={debridementForm.dressingApplied}
                  onChange={e => setDebridementForm(prev => ({ ...prev, dressingApplied: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-4 mt-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" checked={debridementForm.culturesSent}
                  onChange={e => setDebridementForm(prev => ({ ...prev, culturesSent: e.target.checked }))} />
                <span className="text-sm">Cultures Sent</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" checked={debridementForm.marginsViable}
                  onChange={e => setDebridementForm(prev => ({ ...prev, marginsViable: e.target.checked }))} />
                <span className="text-sm">Margins Viable</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded" checked={debridementForm.vacApplied}
                  onChange={e => setDebridementForm(prev => ({ ...prev, vacApplied: e.target.checked }))} />
                <span className="text-sm">VAC Applied</span>
              </label>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-semibold mb-1">Next Planned Debridement</label>
              <input type="date" className="border rounded px-3 py-2 text-sm" title="Next debridement date"
                value={debridementForm.nextPlannedDebridement}
                onChange={e => setDebridementForm(prev => ({ ...prev, nextPlannedDebridement: e.target.value }))} />
            </div>
            <button onClick={saveDebridement} disabled={isSaving || !selectedAssessment}
              className="mt-4 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Debridement Record
            </button>
          </div>

          {/* Debridement History */}
          {debridements.length > 0 && (
            <div>
              <h3 className="font-bold mb-3">Debridement History</h3>
              <div className="space-y-3">
                {debridements.map((d, idx) => (
                  <div key={d.id} className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-green-700">Debridement #{d.debridement_number || idx + 1}</span>
                      <span className="text-xs text-gray-500">{new Date(d.debridement_date || d.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-700">{d.findings}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      <span>Surgeon: {d.surgeon}</span>
                      <span>EBL: {d.estimated_blood_loss}mL</span>
                      <span>Bed: {d.wound_bed_status}</span>
                      {d.cultures_sent && <span className="text-blue-600">Cultures sent</span>}
                      {d.vac_applied && <span className="text-purple-600">VAC applied</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* AUTO-ORDERS TAB */}
      {/* ============================================ */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Protocol Auto-Orders</h2>
            <button onClick={() => { if (selectedAssessment) fetchAssessmentDetails(selectedAssessment.id); }}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <List className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No orders yet. Approve a treatment plan to auto-generate orders.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {['prescription', 'lab', 'procedure'].map(type => {
                const typeOrders = orders.filter(o => o.order_type === type);
                if (typeOrders.length === 0) return null;
                return (
                  <div key={type}>
                    <h3 className="font-bold text-gray-800 mb-2 capitalize flex items-center gap-2">
                      {type === 'prescription' ? <Syringe className="h-4 w-4 text-blue-600" /> :
                       type === 'lab' ? <FlaskConical className="h-4 w-4 text-purple-600" /> :
                       <Scissors className="h-4 w-4 text-red-600" />}
                      {type === 'prescription' ? 'Prescriptions' : type === 'lab' ? 'Lab Orders' : 'Procedures'}
                      <span className="text-xs font-normal text-gray-500">({typeOrders.length})</span>
                    </h3>
                    {typeOrders.map(order => {
                      const details = typeof order.order_details === 'string' ? JSON.parse(order.order_details) : order.order_details;
                      return (
                        <div key={order.id} className={`border rounded-lg p-3 mb-2 ${
                          order.status === 'approved' ? 'bg-green-50 border-green-200' :
                          order.status === 'completed' ? 'bg-blue-50 border-blue-200' :
                          'bg-yellow-50 border-yellow-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{details.drug || details.test || details.procedure || 'Order'}</p>
                              <p className="text-xs text-gray-500">
                                {details.dose && `${details.dose} `}
                                {details.frequency && `${details.frequency} `}
                                {details.route && `(${details.route})`}
                              </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              order.status === 'approved' ? 'bg-green-200 text-green-800' :
                              order.status === 'completed' ? 'bg-blue-200 text-blue-800' :
                              order.status === 'pending_approval' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-gray-200 text-gray-800'
                            }`}>{order.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* EDUCATION TAB */}
      {/* ============================================ */}
      {activeTab === 'education' && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Patient & Nursing Education</h2>

          {/* Patient Education */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <User className="h-5 w-5 text-green-600" /> Patient Education Materials
            </h3>
            {PATIENT_EDUCATION.map(edu => (
              <div key={edu.id} className="bg-white border rounded-lg p-6 mb-4 shadow-sm">
                <h4 className="font-bold text-lg text-gray-800 mb-2">{edu.title}</h4>
                <p className="text-sm text-gray-600 mb-4">{edu.targetAudience || ''}</p>
                <div className="space-y-2">
                  {(edu.content || []).map((section, i) => (
                    <div key={i} className="border-l-2 border-green-400 pl-4 py-2">
                      <h5 className="font-semibold text-sm">{section.heading}</h5>
                      <p className="text-sm text-gray-600 mt-1">{section.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Nursing Protocols */}
          <div>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" /> Nursing Protocols
            </h3>
            {NURSING_PROTOCOLS.map(np => (
              <div key={np.id} className="bg-white border rounded-lg p-6 mb-4 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-2">{np.topic}</h4>
                <p className="text-sm text-gray-600 mb-3">{np.objectives?.join('; ') || ''}</p>
                <div className="space-y-3">
                  {(np.procedures || []).map((step, i) => (
                    <div key={i} className="flex gap-3 items-start">
                      <span className="flex-shrink-0 w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold">{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{step.name}</p>
                        <p className="text-xs text-gray-500">{step.steps?.join(' → ') || ''}</p>
                        {step.frequency && <p className="text-xs text-blue-600">Frequency: {step.frequency}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* CME ASSESSMENT TAB */}
      {/* ============================================ */}
      {activeTab === 'cme' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <Award className="h-6 w-6 text-yellow-600" />
              <div>
                <h2 className="text-xl font-bold">{STI_CME_ARTICLE.title}</h2>
                <p className="text-sm text-gray-500">
                  {STI_CME_ARTICLE.cmeCredits} CME Credits | Passing Score: 70% | {STI_CME_ARTICLE.mcqQuestions.length} Questions
                </p>
              </div>
            </div>

            {/* Article Content */}
            <div className="prose prose-sm max-w-none mb-8">
              {(STI_CME_ARTICLE.sections || []).map((section, i) => (
                <div key={i} className="mb-4">
                  <h3 className="text-lg font-bold text-gray-800">{section.heading}</h3>
                  <p className="text-gray-700 whitespace-pre-line">{section.content}</p>
                </div>
              ))}
            </div>

            {/* MCQ Questions */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-bold mb-4">Assessment Questions</h3>
              {STI_CME_ARTICLE.mcqQuestions.map((q, qIdx) => (
                <div key={qIdx} className={`mb-6 p-4 rounded-lg ${
                  cmeSubmitted
                    ? cmeAnswers[qIdx] === q.correctAnswer ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    : 'bg-gray-50'
                }`}>
                  <p className="font-semibold text-sm mb-3">{qIdx + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-white ${
                        cmeSubmitted && oIdx === q.correctAnswer ? 'bg-green-100 font-semibold' : ''
                      }`}>
                        <input type="radio" name={`cme-q-${qIdx}`} disabled={cmeSubmitted}
                          checked={cmeAnswers[qIdx] === oIdx}
                          onChange={() => setCmeAnswers(prev => ({ ...prev, [qIdx]: oIdx }))} />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                  {cmeSubmitted && (
                    <p className="mt-2 text-xs text-gray-600 italic">
                      {q.explanation}
                    </p>
                  )}
                </div>
              ))}

              {!cmeSubmitted ? (
                <button onClick={submitCME} disabled={Object.keys(cmeAnswers).length < STI_CME_ARTICLE.mcqQuestions.length}
                  className="w-full py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 font-semibold">
                  Submit Assessment ({Object.keys(cmeAnswers).length}/{STI_CME_ARTICLE.mcqQuestions.length} answered)
                </button>
              ) : (
                <div className={`p-4 rounded-lg text-center ${cmeScore >= 70 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <p className="text-2xl font-bold">{cmeScore}%</p>
                  <p className="text-sm">{cmeScore >= 70 ? `Passed! You earned ${STI_CME_ARTICLE.cmeCredits} CME credits.` : `Score below passing grade (70%). Please review and retry.`}</p>
                  {cmeScore < 70 && (
                    <button onClick={() => { setCmeSubmitted(false); setCmeAnswers({}); setCmeScore(0); }}
                      className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry Assessment</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoftTissueInfectionPage;
