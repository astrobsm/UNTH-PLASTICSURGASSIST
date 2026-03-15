import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Activity,
  Heart,
  Droplet,
  Stethoscope,
  Printer,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  AlertCircle,
  User,
  Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../../services/patientService';
import { sanitizeTextForPDF } from '../../utils/pdfUtils';

// Types
interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  hospital_number: string;
  date_of_birth: string;
  gender: string;
}

interface ClinicalAssessment {
  cardiovascular: CardiovascularAssessment;
  respiratory: RespiratoryAssessment;
  renal: RenalAssessment;
  hepatic: HepaticAssessment;
  endocrine: EndocrineAssessment;
  hematologic: HematologicAssessment;
  neurologic: NeurologicAssessment;
  nutritional: NutritionalAssessment;
}

interface CardiovascularAssessment {
  hypertension: boolean;
  ischemicHeartDisease: boolean;
  heartFailure: boolean;
  arrhythmia: boolean;
  valvularDisease: boolean;
  pacemaker: boolean;
  recentMI: boolean; // within 6 months
  functionalCapacityMETs: number;
  bloodPressure: string;
  heartRate: string;
  notes: string;
}

interface RespiratoryAssessment {
  copd: boolean;
  asthma: boolean;
  sleepApnea: boolean;
  recentRTI: boolean;
  smoker: boolean;
  packYears: number;
  oxygenDependent: boolean;
  notes: string;
}

interface RenalAssessment {
  ckd: boolean;
  ckdStage: number;
  dialysis: boolean;
  lastCreatinine: string;
  lastEGFR: string;
  notes: string;
}

interface HepaticAssessment {
  chronicLiverDisease: boolean;
  cirrhosis: boolean;
  hepatitis: boolean;
  childPughClass: 'A' | 'B' | 'C' | '';
  lastLFTs: string;
  notes: string;
}

interface EndocrineAssessment {
  diabetesType1: boolean;
  diabetesType2: boolean;
  lastHbA1c: string;
  insulinDependent: boolean;
  thyroidDisorder: boolean;
  adrenalInsufficiency: boolean;
  notes: string;
}

interface HematologicAssessment {
  anemia: boolean;
  lastHemoglobin: string;
  bleedingDisorder: boolean;
  bleedingDisorderType: string;
  onAnticoagulants: boolean;
  anticoagulantType: string;
  onAntiplatelets: boolean;
  antiplateletType: string;
  dvtHistory: boolean;
  notes: string;
}

interface NeurologicAssessment {
  stroke: boolean;
  tia: boolean;
  epilepsy: boolean;
  dementia: boolean;
  notes: string;
}

interface NutritionalAssessment {
  albumin: string;
  bmi: string;
  malnutrition: boolean;
  notes: string;
}

interface RiskAssessment {
  asaClass: 1 | 2 | 3 | 4 | 5;
  mallampatiClass: 1 | 2 | 3 | 4;
  cardiacRiskIndex: number;
  capriniDVTScore: number;
  bleedingRisk: 'low' | 'moderate' | 'high';
  anesthesiaRisk: 'low' | 'moderate' | 'high';
  overallRisk: 'low' | 'moderate' | 'high' | 'very_high';
}

interface Investigation {
  id: string;
  name: string;
  category: 'laboratory' | 'imaging' | 'cardiac' | 'other';
  priority: 'routine' | 'urgent' | 'stat';
  reason: string;
  required: boolean;
  ordered: boolean;
  result?: string;
}

interface PreoperativePlanningProps {
  patientId?: string;
  procedureType?: string;
  anesthesiaType?: string;
  urgency?: 'elective' | 'urgent' | 'emergency';
  onClose?: () => void;
}

export const PreoperativePlanning: React.FC<PreoperativePlanningProps> = ({
  patientId: initialPatientId,
  procedureType: initialProcedureType,
  anesthesiaType: initialAnesthesiaType,
  urgency: initialUrgency = 'elective',
  onClose
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'assessment' | 'investigations' | 'summary'>('assessment');
  const [isLoading, setIsLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('cardiovascular');
  
  // Form state
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [procedureType, setProcedureType] = useState(initialProcedureType || '');
  const [procedureName, setProcedureName] = useState('');
  const [anesthesiaType, setAnesthesiaType] = useState(initialAnesthesiaType || '');
  const [urgency, setUrgency] = useState<'elective' | 'urgent' | 'emergency'>(initialUrgency);
  
  // Clinical Assessment
  const [clinicalAssessment, setClinicalAssessment] = useState<ClinicalAssessment>({
    cardiovascular: {
      hypertension: false,
      ischemicHeartDisease: false,
      heartFailure: false,
      arrhythmia: false,
      valvularDisease: false,
      pacemaker: false,
      recentMI: false,
      functionalCapacityMETs: 4,
      bloodPressure: '',
      heartRate: '',
      notes: ''
    },
    respiratory: {
      copd: false,
      asthma: false,
      sleepApnea: false,
      recentRTI: false,
      smoker: false,
      packYears: 0,
      oxygenDependent: false,
      notes: ''
    },
    renal: {
      ckd: false,
      ckdStage: 0,
      dialysis: false,
      lastCreatinine: '',
      lastEGFR: '',
      notes: ''
    },
    hepatic: {
      chronicLiverDisease: false,
      cirrhosis: false,
      hepatitis: false,
      childPughClass: '',
      lastLFTs: '',
      notes: ''
    },
    endocrine: {
      diabetesType1: false,
      diabetesType2: false,
      lastHbA1c: '',
      insulinDependent: false,
      thyroidDisorder: false,
      adrenalInsufficiency: false,
      notes: ''
    },
    hematologic: {
      anemia: false,
      lastHemoglobin: '',
      bleedingDisorder: false,
      bleedingDisorderType: '',
      onAnticoagulants: false,
      anticoagulantType: '',
      onAntiplatelets: false,
      antiplateletType: '',
      dvtHistory: false,
      notes: ''
    },
    neurologic: {
      stroke: false,
      tia: false,
      epilepsy: false,
      dementia: false,
      notes: ''
    },
    nutritional: {
      albumin: '',
      bmi: '',
      malnutrition: false,
      notes: ''
    }
  });

  // Risk Assessment
  const [riskAssessment, setRiskAssessment] = useState<RiskAssessment>({
    asaClass: 1,
    mallampatiClass: 1,
    cardiacRiskIndex: 0,
    capriniDVTScore: 0,
    bleedingRisk: 'low',
    anesthesiaRisk: 'low',
    overallRisk: 'low'
  });

  // Investigations
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Procedure types
  const procedureTypes = [
    { value: 'minor_skin', label: 'Minor Skin Surgery (< 30 min)' },
    { value: 'intermediate', label: 'Intermediate Surgery (30-60 min)' },
    { value: 'major_soft_tissue', label: 'Major Soft Tissue Surgery' },
    { value: 'flap_surgery', label: 'Flap Surgery / Reconstruction' },
    { value: 'microsurgery', label: 'Microsurgery' },
    { value: 'burn_surgery', label: 'Burns Surgery / Debridement' },
    { value: 'hand_surgery', label: 'Hand Surgery' },
    { value: 'craniofacial', label: 'Craniofacial Surgery' },
    { value: 'breast_surgery', label: 'Breast Surgery' },
    { value: 'body_contouring', label: 'Body Contouring' },
    { value: 'amputation', label: 'Amputation' }
  ];

  const anesthesiaTypes = [
    { value: 'local', label: 'Local Anesthesia Only' },
    { value: 'local_sedation', label: 'Local + Sedation' },
    { value: 'regional', label: 'Regional (Nerve Block)' },
    { value: 'spinal', label: 'Spinal Anesthesia' },
    { value: 'epidural', label: 'Epidural Anesthesia' },
    { value: 'general', label: 'General Anesthesia' },
    { value: 'combined', label: 'Combined Regional + General' }
  ];

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (patientId) {
      const patient = patients.find(p => p.id === patientId);
      setSelectedPatient(patient || null);
    }
  }, [patientId, patients]);

  // Auto-generate investigations when key factors change
  useEffect(() => {
    if (procedureType && anesthesiaType) {
      generateInvestigations();
    }
  }, [procedureType, anesthesiaType, urgency, clinicalAssessment, riskAssessment.asaClass]);

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  // Calculate risk scores based on clinical assessment
  const calculateRiskScores = () => {
    const cardio = clinicalAssessment.cardiovascular;
    const resp = clinicalAssessment.respiratory;
    const hema = clinicalAssessment.hematologic;
    const renal = clinicalAssessment.renal;
    const endo = clinicalAssessment.endocrine;

    // Calculate Revised Cardiac Risk Index (Lee's criteria)
    let cardiacRisk = 0;
    if (cardio.ischemicHeartDisease) cardiacRisk++;
    if (cardio.heartFailure) cardiacRisk++;
    if (renal.ckd && renal.ckdStage >= 3) cardiacRisk++;
    if (endo.diabetesType1 || (endo.diabetesType2 && endo.insulinDependent)) cardiacRisk++;
    if (procedureType === 'major_soft_tissue' || procedureType === 'flap_surgery' || 
        procedureType === 'microsurgery' || procedureType === 'amputation') cardiacRisk++;

    // Calculate Caprini DVT Score
    let capriniScore = 0;
    // Age factors
    const age = selectedPatient ? calculateAge(selectedPatient.date_of_birth) : 0;
    if (age >= 41 && age <= 60) capriniScore += 1;
    if (age >= 61 && age <= 74) capriniScore += 2;
    if (age >= 75) capriniScore += 3;
    // Surgery factors
    if (procedureType === 'minor_skin') capriniScore += 1;
    if (procedureType !== 'minor_skin') capriniScore += 2;
    // Medical factors
    if (hema.dvtHistory) capriniScore += 3;
    if (clinicalAssessment.nutritional.bmi && parseFloat(clinicalAssessment.nutritional.bmi) > 25) capriniScore += 1;

    // Calculate Bleeding Risk
    let bleedingRisk: 'low' | 'moderate' | 'high' = 'low';
    if (hema.onAnticoagulants || hema.bleedingDisorder) {
      bleedingRisk = 'high';
    } else if (hema.onAntiplatelets || renal.ckd) {
      bleedingRisk = 'moderate';
    }

    // Calculate Anesthesia Risk
    let anesthesiaRisk: 'low' | 'moderate' | 'high' = 'low';
    if (anesthesiaType === 'general' || anesthesiaType === 'combined') {
      if (resp.copd || resp.sleepApnea || cardio.heartFailure) {
        anesthesiaRisk = 'high';
      } else if (cardio.ischemicHeartDisease || resp.asthma) {
        anesthesiaRisk = 'moderate';
      }
    }

    // Calculate Overall Risk
    let overallRisk: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
    if (riskAssessment.asaClass >= 4 || cardiacRisk >= 3 || 
        (bleedingRisk === 'high' && urgency === 'emergency')) {
      overallRisk = 'very_high';
    } else if (riskAssessment.asaClass === 3 || cardiacRisk >= 2 || 
               anesthesiaRisk === 'high' || bleedingRisk === 'high') {
      overallRisk = 'high';
    } else if (riskAssessment.asaClass === 2 || cardiacRisk >= 1 || 
               anesthesiaRisk === 'moderate' || bleedingRisk === 'moderate') {
      overallRisk = 'moderate';
    }

    setRiskAssessment(prev => ({
      ...prev,
      cardiacRiskIndex: cardiacRisk,
      capriniDVTScore: capriniScore,
      bleedingRisk,
      anesthesiaRisk,
      overallRisk
    }));
  };

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Generate investigations based on all factors
  const generateInvestigations = () => {
    const newInvestigations: Investigation[] = [];
    const cardio = clinicalAssessment.cardiovascular;
    const resp = clinicalAssessment.respiratory;
    const hema = clinicalAssessment.hematologic;
    const renal = clinicalAssessment.renal;
    const hepatic = clinicalAssessment.hepatic;
    const endo = clinicalAssessment.endocrine;

    const age = selectedPatient ? calculateAge(selectedPatient.date_of_birth) : 0;
    const isMajorSurgery = ['major_soft_tissue', 'flap_surgery', 'microsurgery', 'craniofacial', 'amputation'].includes(procedureType);
    const isGeneralAnesthesia = ['general', 'combined'].includes(anesthesiaType);
    const isEmergency = urgency === 'emergency';
    const isUrgent = urgency === 'urgent';

    // BASIC INVESTIGATIONS - Almost always required
    newInvestigations.push({
      id: 'fbc',
      name: 'Full Blood Count (FBC)',
      category: 'laboratory',
      priority: isEmergency ? 'stat' : 'routine',
      reason: 'Baseline hematology for surgical planning',
      required: true,
      ordered: false
    });

    // U&E - Required for most surgeries
    if (isMajorSurgery || isGeneralAnesthesia || renal.ckd || cardio.heartFailure || 
        hema.onAnticoagulants || age > 50 || endo.diabetesType1 || endo.diabetesType2) {
      newInvestigations.push({
        id: 'ue',
        name: 'Urea & Electrolytes (U&E)',
        category: 'laboratory',
        priority: isEmergency ? 'stat' : 'routine',
        reason: renal.ckd ? 'Chronic kidney disease' : 'Assess renal function pre-operatively',
        required: true,
        ordered: false
      });
    }

    // LFT
    if (hepatic.chronicLiverDisease || hepatic.cirrhosis || hema.onAnticoagulants || 
        isMajorSurgery || procedureType === 'amputation') {
      newInvestigations.push({
        id: 'lft',
        name: 'Liver Function Tests (LFT)',
        category: 'laboratory',
        priority: isEmergency ? 'stat' : 'routine',
        reason: hepatic.chronicLiverDisease ? 'Known liver disease' : 'Assess hepatic function',
        required: true,
        ordered: false
      });
    }

    // Coagulation
    if (hema.onAnticoagulants || hema.bleedingDisorder || hepatic.cirrhosis || 
        isMajorSurgery || procedureType === 'microsurgery') {
      newInvestigations.push({
        id: 'coag',
        name: 'Coagulation Profile (PT/INR, APTT)',
        category: 'laboratory',
        priority: isEmergency ? 'stat' : 'routine',
        reason: hema.onAnticoagulants 
          ? `On ${hema.anticoagulantType || 'anticoagulants'}` 
          : 'Assess bleeding risk',
        required: true,
        ordered: false
      });
    }

    // Blood Group & Crossmatch
    if (isMajorSurgery || procedureType === 'amputation' || procedureType === 'burn_surgery' ||
        hema.anemia || isEmergency) {
      newInvestigations.push({
        id: 'gxm',
        name: 'Blood Group & Cross-match',
        category: 'laboratory',
        priority: isEmergency ? 'stat' : 'urgent',
        reason: 'Blood may be required for surgery',
        required: true,
        ordered: false
      });
    }

    // HbA1c for diabetics
    if (endo.diabetesType1 || endo.diabetesType2) {
      newInvestigations.push({
        id: 'hba1c',
        name: 'HbA1c',
        category: 'laboratory',
        priority: 'routine',
        reason: 'Assess glycemic control for surgical planning',
        required: true,
        ordered: false
      });

      newInvestigations.push({
        id: 'rbg',
        name: 'Random Blood Glucose',
        category: 'laboratory',
        priority: isEmergency ? 'stat' : 'routine',
        reason: 'Current glycemic status',
        required: true,
        ordered: false
      });
    }

    // ECG
    if (isGeneralAnesthesia || isMajorSurgery || age > 50 || 
        cardio.hypertension || cardio.ischemicHeartDisease || cardio.heartFailure ||
        cardio.arrhythmia || endo.diabetesType1 || endo.diabetesType2) {
      newInvestigations.push({
        id: 'ecg',
        name: '12-Lead ECG',
        category: 'cardiac',
        priority: isEmergency ? 'urgent' : 'routine',
        reason: cardio.arrhythmia 
          ? 'Known arrhythmia' 
          : age > 50 ? 'Age > 50 years' : 'Cardiac risk assessment',
        required: true,
        ordered: false
      });
    }

    // Echocardiogram
    if (cardio.heartFailure || cardio.valvularDisease || 
        (cardio.ischemicHeartDisease && isMajorSurgery)) {
      newInvestigations.push({
        id: 'echo',
        name: 'Echocardiogram',
        category: 'cardiac',
        priority: isEmergency ? 'urgent' : 'routine',
        reason: cardio.heartFailure 
          ? 'Heart failure - assess ejection fraction' 
          : 'Cardiac function assessment',
        required: true,
        ordered: false
      });
    }

    // Chest X-ray
    if (isGeneralAnesthesia || resp.copd || resp.oxygenDependent || 
        cardio.heartFailure || isMajorSurgery || age > 60 || resp.recentRTI) {
      newInvestigations.push({
        id: 'cxr',
        name: 'Chest X-ray',
        category: 'imaging',
        priority: isEmergency ? 'urgent' : 'routine',
        reason: resp.copd 
          ? 'COPD - baseline chest x-ray' 
          : isGeneralAnesthesia ? 'Pre-general anesthesia' : 'Pre-operative assessment',
        required: true,
        ordered: false
      });
    }

    // Pulmonary Function Tests
    if (resp.copd || resp.asthma || resp.oxygenDependent) {
      newInvestigations.push({
        id: 'pft',
        name: 'Pulmonary Function Tests (Spirometry)',
        category: 'other',
        priority: 'routine',
        reason: resp.copd ? 'COPD - assess severity' : 'Respiratory assessment',
        required: resp.copd,
        ordered: false
      });
    }

    // Thyroid Function
    if (endo.thyroidDisorder) {
      newInvestigations.push({
        id: 'tft',
        name: 'Thyroid Function Tests',
        category: 'laboratory',
        priority: 'routine',
        reason: 'Known thyroid disorder',
        required: true,
        ordered: false
      });
    }

    // Doppler studies for vascular assessment
    if (procedureType === 'amputation' || procedureType === 'flap_surgery') {
      newInvestigations.push({
        id: 'doppler',
        name: 'Arterial Doppler Study',
        category: 'imaging',
        priority: 'routine',
        reason: procedureType === 'amputation' 
          ? 'Assess amputation level viability' 
          : 'Flap planning - vascular assessment',
        required: true,
        ordered: false
      });
    }

    // Wound swab for infection
    if (procedureType === 'burn_surgery' || procedureType === 'amputation') {
      newInvestigations.push({
        id: 'woundswab',
        name: 'Wound Swab M/C/S',
        category: 'laboratory',
        priority: isEmergency ? 'stat' : 'urgent',
        reason: 'Identify organisms for targeted antibiotic therapy',
        required: true,
        ordered: false
      });
    }

    // Serum Albumin for nutritional status
    if (isMajorSurgery || procedureType === 'burn_surgery' || 
        clinicalAssessment.nutritional.malnutrition) {
      newInvestigations.push({
        id: 'albumin',
        name: 'Serum Albumin',
        category: 'laboratory',
        priority: 'routine',
        reason: 'Nutritional status assessment',
        required: true,
        ordered: false
      });
    }

    // Urinalysis
    if (renal.ckd || endo.diabetesType1 || endo.diabetesType2) {
      newInvestigations.push({
        id: 'urinalysis',
        name: 'Urinalysis',
        category: 'laboratory',
        priority: 'routine',
        reason: renal.ckd ? 'CKD monitoring' : 'Diabetic nephropathy screening',
        required: false,
        ordered: false
      });
    }

    // HIV/HBsAg screening (recommended for all surgeries)
    newInvestigations.push({
      id: 'hiv',
      name: 'HIV Screening',
      category: 'laboratory',
      priority: 'routine',
      reason: 'Pre-operative screening (with consent)',
      required: false,
      ordered: false
    });

    newInvestigations.push({
      id: 'hbsag',
      name: 'Hepatitis B Surface Antigen (HBsAg)',
      category: 'laboratory',
      priority: 'routine',
      reason: 'Pre-operative screening',
      required: false,
      ordered: false
    });

    setInvestigations(newInvestigations);
  };

  // Toggle investigation ordered status
  const toggleInvestigationOrdered = (id: string) => {
    setInvestigations(prev => 
      prev.map(inv => 
        inv.id === id ? { ...inv, ordered: !inv.ordered } : inv
      )
    );
  };

  // Generate thermal print PDF for lab requests
  const generateLabRequestPDF = async () => {
    const orderedInvestigations = investigations.filter(inv => inv.ordered);
    if (orderedInvestigations.length === 0) {
      alert('Please select investigations to print');
      return;
    }

    const { jsPDF } = await import('jspdf');
    
    // 80mm = ~226 points width
    const thermalWidth = 80;
    const estimatedHeight = 120 + (orderedInvestigations.length * 7);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [thermalWidth, estimatedHeight]
    });

    const margin = 3;
    let yPos = margin;
    
    // Helper to sanitize text for PDF
    const clean = (text: string) => sanitizeTextForPDF(text || '');

    // Set Georgia-like font (Times is similar)
    doc.setFont('times', 'normal');
    
    // Header
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text('UNTH LABORATORY', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    
    doc.setFontSize(8);
    doc.setFont('times', 'normal');
    doc.text('Plastic Surgery Unit', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    // Divider
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Title
    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text('INVESTIGATION REQUEST', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    // Priority badge
    const hasStatInvestigations = orderedInvestigations.some(inv => inv.priority === 'stat');
    if (hasStatInvestigations || urgency === 'emergency') {
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text('*** URGENT/STAT ***', thermalWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }

    // Patient Info
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    if (selectedPatient) {
      doc.text(`Name: ${selectedPatient.first_name} ${selectedPatient.last_name}`, margin, yPos);
      yPos += 4;
      doc.text(`Hosp #: ${selectedPatient.hospital_number}`, margin, yPos);
      yPos += 4;
    }
    doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
    yPos += 4;
    doc.text(`Time: ${new Date().toLocaleTimeString()}`, margin, yPos);
    yPos += 5;

    // Divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Surgery Info
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    doc.text('PRE-OPERATIVE FOR:', margin, yPos);
    yPos += 4;
    doc.setFont('times', 'normal');
    const procLabel = procedureTypes.find(p => p.value === procedureType)?.label || procedureType;
    doc.text(procLabel.substring(0, 35), margin, yPos);
    yPos += 5;

    // Divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Investigations Header
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.text('INVESTIGATIONS:', margin, yPos);
    yPos += 4;

    // List investigations
    doc.setFontSize(9);
    doc.setFont('times', 'normal');

    orderedInvestigations.forEach((inv, index) => {
      const priority = inv.priority === 'stat' ? ' [STAT]' : inv.priority === 'urgent' ? ' [URG]' : '';
      doc.text(`${index + 1}. ${inv.name}${priority}`, margin, yPos);
      yPos += 4;
    });

    yPos += 2;

    // Footer divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Footer
    doc.setFontSize(8);
    doc.text('Requested by: _______________', margin, yPos);
    yPos += 4;
    doc.text('Signature: _______________', margin, yPos);
    yPos += 5;
    
    doc.text('Burns Plastic & Recon Unit', thermalWidth / 2, yPos, { align: 'center' });

    // Save
    const patientName = selectedPatient 
      ? `${selectedPatient.first_name}_${selectedPatient.last_name}` 
      : 'Unknown';
    const filename = `LabRequest_${patientName}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  // Navigate to shopping list
  const goToShoppingList = () => {
    navigate('/shopping-list');
  };

  // Render section with expand/collapse
  const renderCollapsibleSection = (
    id: string, 
    title: string, 
    icon: React.ReactNode, 
    content: React.ReactNode,
    hasIssues: boolean = false
  ) => (
    <div className="border border-gray-200 rounded-lg mb-3">
      <button
        type="button"
        onClick={() => setExpandedSection(expandedSection === id ? null : id)}
        className={`w-full flex items-center justify-between p-4 text-left ${
          hasIssues ? 'bg-orange-50' : 'bg-gray-50'
        } hover:bg-gray-100 rounded-t-lg`}
      >
        <div className="flex items-center space-x-3">
          {icon}
          <span className="font-medium text-gray-900">{title}</span>
          {hasIssues && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
              Attention needed
            </span>
          )}
        </div>
        {expandedSection === id ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      {expandedSection === id && (
        <div className="p-4 border-t border-gray-200">
          {content}
        </div>
      )}
    </div>
  );

  const renderRiskBadge = (risk: 'low' | 'moderate' | 'high' | 'very_high') => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      moderate: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      very_high: 'bg-red-100 text-red-800'
    };
    const labels = {
      low: 'Low Risk',
      moderate: 'Moderate Risk',
      high: 'High Risk',
      very_high: 'Very High Risk'
    };
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors[risk]}`}>
        {labels[risk]}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ClipboardList className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Pre-operative Planning Module</h2>
              <p className="text-green-100">Comprehensive assessment and investigation planning</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-white hover:text-green-200"
            >
              </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          {[
            { id: 'assessment', label: 'Clinical Assessment', icon: <Stethoscope className="w-4 h-4" /> },
            { id: 'investigations', label: 'Investigations', icon: <FileText className="w-4 h-4" /> },
            { id: 'summary', label: 'Summary & Actions', icon: <CheckCircle className="w-4 h-4" /> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-4 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {/* Patient & Procedure Selection - Always visible */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              title="Select patient"
            >
              <option value="">Select Patient</option>
              {patients.map(patient => (
                <option key={patient.id} value={patient.id}>
                  {patient.first_name} {patient.last_name} ({patient.hospital_number})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Type</label>
            <select
              value={procedureType}
              onChange={(e) => setProcedureType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              title="Select procedure type"
            >
              <option value="">Select Procedure</option>
              {procedureTypes.map(proc => (
                <option key={proc.value} value={proc.value}>{proc.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type</label>
            <select
              value={anesthesiaType}
              onChange={(e) => setAnesthesiaType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              title="Select anesthesia type"
            >
              <option value="">Select Anesthesia</option>
              {anesthesiaTypes.map(anes => (
                <option key={anes.value} value={anes.value}>{anes.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              title="Select urgency level"
            >
              <option value="elective">Elective</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
        </div>

        {/* Assessment Tab */}
        {activeTab === 'assessment' && (
          <div className="space-y-4">
            {/* ASA Classification */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-blue-800">ASA Physical Status Classification</h4>
                  <p className="text-sm text-blue-600">Select the appropriate ASA class</p>
                </div>
                <select
                  value={riskAssessment.asaClass}
                  onChange={(e) => {
                    setRiskAssessment(prev => ({ ...prev, asaClass: parseInt(e.target.value) as any }));
                    calculateRiskScores();
                  }}
                  className="px-4 py-2 border border-blue-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500"
                  title="Select ASA physical status classification"
                >
                  <option value={1}>ASA I - Healthy patient</option>
                  <option value={2}>ASA II - Mild systemic disease</option>
                  <option value={3}>ASA III - Severe systemic disease</option>
                  <option value={4}>ASA IV - Severe systemic disease, constant threat to life</option>
                  <option value={5}>ASA V - Moribund patient</option>
                </select>
              </div>
            </div>

            {/* Cardiovascular */}
            {renderCollapsibleSection(
              'cardiovascular',
              'Cardiovascular System',
              <Heart className="w-5 h-5 text-red-500" />,
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'hypertension', label: 'Hypertension' },
                  { key: 'ischemicHeartDisease', label: 'Ischemic Heart Disease' },
                  { key: 'heartFailure', label: 'Heart Failure' },
                  { key: 'arrhythmia', label: 'Arrhythmia' },
                  { key: 'valvularDisease', label: 'Valvular Disease' },
                  { key: 'pacemaker', label: 'Pacemaker/ICD' },
                  { key: 'recentMI', label: 'Recent MI (< 6 months)' }
                ].map(item => (
                  <label key={item.key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={(clinicalAssessment.cardiovascular as any)[item.key]}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          cardiovascular: { ...prev.cardiovascular, [item.key]: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">{item.label}</span>
                  </label>
                ))}
                <div className="col-span-2 md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                  <div>
                    <label className="block text-sm text-gray-600">Blood Pressure</label>
                    <input
                      type="text"
                      value={clinicalAssessment.cardiovascular.bloodPressure}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        cardiovascular: { ...prev.cardiovascular, bloodPressure: e.target.value }
                      }))}
                      placeholder="e.g., 120/80"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600">Heart Rate</label>
                    <input
                      type="text"
                      value={clinicalAssessment.cardiovascular.heartRate}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        cardiovascular: { ...prev.cardiovascular, heartRate: e.target.value }
                      }))}
                      placeholder="e.g., 72 bpm"
                      className="w-full px-3 py-2 border rounded"
                    />
                  </div>
                </div>
              </div>,
              clinicalAssessment.cardiovascular.ischemicHeartDisease || 
              clinicalAssessment.cardiovascular.heartFailure ||
              clinicalAssessment.cardiovascular.recentMI
            )}

            {/* Respiratory */}
            {renderCollapsibleSection(
              'respiratory',
              'Respiratory System',
              <Activity className="w-5 h-5 text-blue-500" />,
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { key: 'copd', label: 'COPD' },
                  { key: 'asthma', label: 'Asthma' },
                  { key: 'sleepApnea', label: 'Sleep Apnea' },
                  { key: 'recentRTI', label: 'Recent Respiratory Infection' },
                  { key: 'smoker', label: 'Current Smoker' },
                  { key: 'oxygenDependent', label: 'Oxygen Dependent' }
                ].map(item => (
                  <label key={item.key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={(clinicalAssessment.respiratory as any)[item.key]}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          respiratory: { ...prev.respiratory, [item.key]: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">{item.label}</span>
                  </label>
                ))}
              </div>,
              clinicalAssessment.respiratory.copd || clinicalAssessment.respiratory.oxygenDependent
            )}

            {/* Renal */}
            {renderCollapsibleSection(
              'renal',
              'Renal Function',
              <Droplet className="w-5 h-5 text-purple-500" />,
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.renal.ckd}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          renal: { ...prev.renal, ckd: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Chronic Kidney Disease</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.renal.dialysis}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        renal: { ...prev.renal, dialysis: e.target.checked }
                      }))}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">On Dialysis</span>
                  </label>
                </div>
                {clinicalAssessment.renal.ckd && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600">CKD Stage</label>
                      <select
                        value={clinicalAssessment.renal.ckdStage}
                        onChange={(e) => setClinicalAssessment(prev => ({
                          ...prev,
                          renal: { ...prev.renal, ckdStage: parseInt(e.target.value) }
                        }))}
                        className="w-full px-3 py-2 border rounded"
                        title="Select CKD stage"
                      >
                        <option value={1}>Stage 1</option>
                        <option value={2}>Stage 2</option>
                        <option value={3}>Stage 3</option>
                        <option value={4}>Stage 4</option>
                        <option value={5}>Stage 5</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">Last Creatinine</label>
                      <input
                        type="text"
                        value={clinicalAssessment.renal.lastCreatinine}
                        onChange={(e) => setClinicalAssessment(prev => ({
                          ...prev,
                          renal: { ...prev.renal, lastCreatinine: e.target.value }
                        }))}
                        placeholder="Î¼mol/L"
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600">Last eGFR</label>
                      <input
                        type="text"
                        value={clinicalAssessment.renal.lastEGFR}
                        onChange={(e) => setClinicalAssessment(prev => ({
                          ...prev,
                          renal: { ...prev.renal, lastEGFR: e.target.value }
                        }))}
                        placeholder="mL/min/1.73m²"
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                  </div>
                )}
              </div>,
              clinicalAssessment.renal.ckd && clinicalAssessment.renal.ckdStage >= 3
            )}

            {/* Endocrine */}
            {renderCollapsibleSection(
              'endocrine',
              'Endocrine System',
              <Activity className="w-5 h-5 text-orange-500" />,
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.endocrine.diabetesType1}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          endocrine: { ...prev.endocrine, diabetesType1: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Type 1 Diabetes</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.endocrine.diabetesType2}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          endocrine: { ...prev.endocrine, diabetesType2: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Type 2 Diabetes</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.endocrine.insulinDependent}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        endocrine: { ...prev.endocrine, insulinDependent: e.target.checked }
                      }))}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Insulin Dependent</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.endocrine.thyroidDisorder}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        endocrine: { ...prev.endocrine, thyroidDisorder: e.target.checked }
                      }))}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Thyroid Disorder</span>
                  </label>
                </div>
                {(clinicalAssessment.endocrine.diabetesType1 || clinicalAssessment.endocrine.diabetesType2) && (
                  <div>
                    <label className="block text-sm text-gray-600">Last HbA1c</label>
                    <input
                      type="text"
                      value={clinicalAssessment.endocrine.lastHbA1c}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        endocrine: { ...prev.endocrine, lastHbA1c: e.target.value }
                      }))}
                      placeholder="e.g., 7.5%"
                      className="w-48 px-3 py-2 border rounded"
                    />
                  </div>
                )}
              </div>,
              clinicalAssessment.endocrine.diabetesType1 || 
              (clinicalAssessment.endocrine.diabetesType2 && clinicalAssessment.endocrine.insulinDependent)
            )}

            {/* Hematologic */}
            {renderCollapsibleSection(
              'hematologic',
              'Hematologic / Bleeding Risk',
              <Droplet className="w-5 h-5 text-red-600" />,
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.hematologic.anemia}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        hematologic: { ...prev.hematologic, anemia: e.target.checked }
                      }))}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Anemia</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.hematologic.bleedingDisorder}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          hematologic: { ...prev.hematologic, bleedingDisorder: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">Bleeding Disorder</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.hematologic.onAnticoagulants}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          hematologic: { ...prev.hematologic, onAnticoagulants: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">On Anticoagulants</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.hematologic.onAntiplatelets}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          hematologic: { ...prev.hematologic, onAntiplatelets: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">On Antiplatelets</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={clinicalAssessment.hematologic.dvtHistory}
                      onChange={(e) => {
                        setClinicalAssessment(prev => ({
                          ...prev,
                          hematologic: { ...prev.hematologic, dvtHistory: e.target.checked }
                        }));
                        setTimeout(calculateRiskScores, 100);
                      }}
                      className="rounded border-gray-300 text-green-600"
                    />
                    <span className="text-sm">History of DVT/PE</span>
                  </label>
                </div>
                {clinicalAssessment.hematologic.onAnticoagulants && (
                  <div>
                    <label className="block text-sm text-gray-600">Anticoagulant Type</label>
                    <select
                      value={clinicalAssessment.hematologic.anticoagulantType}
                      onChange={(e) => setClinicalAssessment(prev => ({
                        ...prev,
                        hematologic: { ...prev.hematologic, anticoagulantType: e.target.value }
                      }))}
                      className="w-48 px-3 py-2 border rounded"
                      title="Select anticoagulant type"
                    >
                      <option value="">Select...</option>
                      <option value="Warfarin">Warfarin</option>
                      <option value="Rivaroxaban">Rivaroxaban (Xarelto)</option>
                      <option value="Apixaban">Apixaban (Eliquis)</option>
                      <option value="Dabigatran">Dabigatran (Pradaxa)</option>
                      <option value="Enoxaparin">Enoxaparin (Clexane)</option>
                      <option value="Heparin">Unfractionated Heparin</option>
                    </select>
                  </div>
                )}
              </div>,
              clinicalAssessment.hematologic.onAnticoagulants || 
              clinicalAssessment.hematologic.bleedingDisorder
            )}

            {/* Calculate Risk Button */}
            <div className="flex justify-center pt-4">
              <button
                type="button"
                onClick={calculateRiskScores}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                Calculate Risk Scores
              </button>
            </div>
          </div>
        )}

        {/* Investigations Tab */}
        {activeTab === 'investigations' && (
          <div className="space-y-6">
            {/* Risk Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">Overall Risk</p>
                <div className="mt-2">{renderRiskBadge(riskAssessment.overallRisk)}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">Cardiac Risk (RCRI)</p>
                <p className="text-2xl font-bold text-gray-900">{riskAssessment.cardiacRiskIndex}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">DVT Risk (Caprini)</p>
                <p className="text-2xl font-bold text-gray-900">{riskAssessment.capriniDVTScore}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-sm text-gray-600">Bleeding Risk</p>
                <p className={`text-lg font-bold ${
                  riskAssessment.bleedingRisk === 'high' ? 'text-red-600' :
                  riskAssessment.bleedingRisk === 'moderate' ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {riskAssessment.bleedingRisk.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Auto-generated Investigations */}
            <div className="bg-white border rounded-lg">
              <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Recommended Investigations</h3>
                  <p className="text-sm text-gray-600">
                    Auto-generated based on patient profile, procedure, and risk factors
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    // Select all required investigations
                    setInvestigations(prev => 
                      prev.map(inv => ({ ...inv, ordered: inv.required }))
                    );
                  }}
                  className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  Select All Required
                </button>
              </div>

              <div className="divide-y">
                {/* Group by category */}
                {['laboratory', 'cardiac', 'imaging', 'other'].map(category => {
                  const categoryInvestigations = investigations.filter(inv => inv.category === category);
                  if (categoryInvestigations.length === 0) return null;

                  return (
                    <div key={category} className="p-4">
                      <h4 className="font-medium text-gray-700 mb-3 capitalize">
                        {category === 'laboratory' ? 'Laboratory' :
                         category === 'cardiac' ? 'Cardiac' :
                         category === 'imaging' ? 'Imaging' : 'Other'}
                      </h4>
                      <div className="space-y-2">
                        {categoryInvestigations.map(inv => (
                          <div 
                            key={inv.id}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              inv.ordered ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={inv.ordered}
                                onChange={() => toggleInvestigationOrdered(inv.id)}
                                className="rounded border-gray-300 text-green-600 w-5 h-5"
                                title="Toggle investigation ordered"
                              />
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium text-gray-900">{inv.name}</span>
                                  {inv.required && (
                                    <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                                      Required
                                    </span>
                                  )}
                                  {inv.priority === 'stat' && (
                                    <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                                      STAT
                                    </span>
                                  )}
                                  {inv.priority === 'urgent' && (
                                    <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
                                      Urgent
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">{inv.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Print Actions */}
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <button
                type="button"
                onClick={generateLabRequestPDF}
                className="inline-flex items-center px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
              >
                <Printer className="w-5 h-5 mr-2" />
                Print Lab Requests (Thermal 80mm)
              </button>
              <button
                type="button"
                onClick={goToShoppingList}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Go to Shopping List
              </button>
            </div>
          </div>
        )}

        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Patient Summary */}
            {selectedPatient && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <User className="w-6 h-6 text-blue-600" />
                  <div>
                    <h4 className="font-semibold text-blue-800">
                      {selectedPatient.first_name} {selectedPatient.last_name}
                    </h4>
                    <p className="text-sm text-blue-600">
                      Hospital #: {selectedPatient.hospital_number} | 
                      DOB: {new Date(selectedPatient.date_of_birth).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Procedure Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Procedure</p>
                <p className="font-medium text-gray-900">
                  {procedureTypes.find(p => p.value === procedureType)?.label || 'Not selected'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Anesthesia</p>
                <p className="font-medium text-gray-900">
                  {anesthesiaTypes.find(a => a.value === anesthesiaType)?.label || 'Not selected'}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Urgency</p>
                <p className={`font-medium ${
                  urgency === 'emergency' ? 'text-red-600' :
                  urgency === 'urgent' ? 'text-orange-600' : 'text-green-600'
                }`}>
                  {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">ASA Class</p>
                <p className="font-medium text-gray-900">ASA {riskAssessment.asaClass}</p>
              </div>
            </div>

            {/* Risk Summary */}
            <div className="p-4 bg-white border rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-4">Risk Assessment Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Overall Risk</p>
                  {renderRiskBadge(riskAssessment.overallRisk)}
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Cardiac (RCRI)</p>
                  <p className="text-xl font-bold">{riskAssessment.cardiacRiskIndex}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">DVT (Caprini)</p>
                  <p className="text-xl font-bold">{riskAssessment.capriniDVTScore}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-500 mb-2">Bleeding</p>
                  <p className={`font-medium ${
                    riskAssessment.bleedingRisk === 'high' ? 'text-red-600' : 
                    riskAssessment.bleedingRisk === 'moderate' ? 'text-orange-600' : 'text-green-600'
                  }`}>
                    {riskAssessment.bleedingRisk.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            {/* Ordered Investigations */}
            <div className="p-4 bg-white border rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-4">
                Ordered Investigations ({investigations.filter(i => i.ordered).length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {investigations.filter(i => i.ordered).map(inv => (
                  <span 
                    key={inv.id}
                    className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm"
                  >
                    {inv.name}
                  </span>
                ))}
                {investigations.filter(i => i.ordered).length === 0 && (
                  <p className="text-gray-500 text-sm">No investigations ordered yet</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <button
                type="button"
                onClick={generateLabRequestPDF}
                className="inline-flex items-center px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
              >
                <Printer className="w-5 h-5 mr-2" />
                Print Lab Requests (Thermal)
              </button>
              <button
                type="button"
                onClick={goToShoppingList}
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                Generate Shopping List
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreoperativePlanning;
