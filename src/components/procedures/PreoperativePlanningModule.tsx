import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Activity,
  Heart,
  Stethoscope,
  AlertTriangle,
  CheckCircle,
  Printer,
  ShoppingCart,
  FileText,
  User,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Plus,
  Loader2,
  Download,
  AlertCircle,
  Thermometer,
  Droplet,
  Zap,
  X
} from 'lucide-react';
import { patientService } from '../../services/patientService';
import { sanitizeTextForPDF } from '../../utils/pdfUtils';

// Types
interface PatientData {
  id: string;
  hospital_number: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  phone?: string;
}

interface Comorbidity {
  id: string;
  name: string;
  category: string;
  selected: boolean;
  severity?: 'mild' | 'moderate' | 'severe';
}

interface Investigation {
  id: string;
  name: string;
  category: string;
  required: boolean;
  reason: string;
  priority: 'routine' | 'urgent' | 'stat';
}

interface RiskAssessment {
  asaScore: 1 | 2 | 3 | 4 | 5;
  cardiacRisk: 'low' | 'intermediate' | 'high';
  pulmonaryRisk: 'low' | 'intermediate' | 'high';
  renalRisk: 'low' | 'intermediate' | 'high';
  bleedingRisk: 'low' | 'intermediate' | 'high';
  thrombosisRisk: 'low' | 'intermediate' | 'high';
  overallRisk: 'low' | 'intermediate' | 'high';
}

interface PreopPlanningData {
  patientId: string;
  procedureType: string;
  procedureName: string;
  anesthesiaType: 'local' | 'regional' | 'general' | 'sedation' | 'combined';
  urgency: 'elective' | 'urgent' | 'emergency';
  expectedDuration: number; // minutes
  expectedBloodLoss: 'minimal' | 'moderate' | 'significant';
  comorbidities: Comorbidity[];
  clinicalAssessment: {
    weight: number;
    height: number;
    bmi: number;
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    oxygenSaturation: number;
    respiratoryRate: number;
    airwayAssessment: string;
    mallampatiScore: 1 | 2 | 3 | 4;
    npo_status: string;
    allergies: string[];
    currentMedications: string[];
    previousSurgeries: string[];
    previousAnesthesiaComplications: string;
    smokingStatus: 'never' | 'former' | 'current';
    alcoholUse: 'none' | 'social' | 'heavy';
    functionalCapacity: 'excellent' | 'good' | 'moderate' | 'poor';
  };
  riskAssessment: RiskAssessment;
  generatedInvestigations: Investigation[];
  additionalNotes: string;
  assessedBy: string;
  assessmentDate: Date;
}

// Comorbidity options organized by category
const COMORBIDITY_OPTIONS: Comorbidity[] = [
  // Cardiovascular
  { id: 'hypertension', name: 'Hypertension', category: 'Cardiovascular', selected: false },
  { id: 'cad', name: 'Coronary Artery Disease', category: 'Cardiovascular', selected: false },
  { id: 'chf', name: 'Congestive Heart Failure', category: 'Cardiovascular', selected: false },
  { id: 'arrhythmia', name: 'Arrhythmia/AF', category: 'Cardiovascular', selected: false },
  { id: 'valvular', name: 'Valvular Heart Disease', category: 'Cardiovascular', selected: false },
  { id: 'pacemaker', name: 'Pacemaker/ICD', category: 'Cardiovascular', selected: false },
  { id: 'pvd', name: 'Peripheral Vascular Disease', category: 'Cardiovascular', selected: false },
  
  // Respiratory
  { id: 'asthma', name: 'Asthma', category: 'Respiratory', selected: false },
  { id: 'copd', name: 'COPD', category: 'Respiratory', selected: false },
  { id: 'osa', name: 'Obstructive Sleep Apnea', category: 'Respiratory', selected: false },
  { id: 'pulmonary_fibrosis', name: 'Pulmonary Fibrosis', category: 'Respiratory', selected: false },
  
  // Metabolic/Endocrine
  { id: 'dm_type1', name: 'Diabetes Type 1', category: 'Metabolic', selected: false },
  { id: 'dm_type2', name: 'Diabetes Type 2', category: 'Metabolic', selected: false },
  { id: 'thyroid', name: 'Thyroid Disease', category: 'Metabolic', selected: false },
  { id: 'obesity', name: 'Obesity (BMI > 30)', category: 'Metabolic', selected: false },
  { id: 'malnutrition', name: 'Malnutrition', category: 'Metabolic', selected: false },
  
  // Renal
  { id: 'ckd', name: 'Chronic Kidney Disease', category: 'Renal', selected: false },
  { id: 'dialysis', name: 'Dialysis Dependent', category: 'Renal', selected: false },
  { id: 'transplant', name: 'Renal Transplant', category: 'Renal', selected: false },
  
  // Hepatic
  { id: 'cirrhosis', name: 'Liver Cirrhosis', category: 'Hepatic', selected: false },
  { id: 'hepatitis', name: 'Chronic Hepatitis', category: 'Hepatic', selected: false },
  
  // Hematologic
  { id: 'anemia', name: 'Anemia', category: 'Hematologic', selected: false },
  { id: 'bleeding_disorder', name: 'Bleeding Disorder', category: 'Hematologic', selected: false },
  { id: 'anticoagulation', name: 'On Anticoagulation', category: 'Hematologic', selected: false },
  { id: 'dvt_history', name: 'Previous DVT/PE', category: 'Hematologic', selected: false },
  { id: 'sickle_cell', name: 'Sickle Cell Disease', category: 'Hematologic', selected: false },
  
  // Neurological
  { id: 'stroke', name: 'Previous Stroke/TIA', category: 'Neurological', selected: false },
  { id: 'epilepsy', name: 'Epilepsy/Seizures', category: 'Neurological', selected: false },
  { id: 'parkinson', name: "Parkinson's Disease", category: 'Neurological', selected: false },
  
  // Other
  { id: 'hiv', name: 'HIV/AIDS', category: 'Immunological', selected: false },
  { id: 'cancer', name: 'Active Malignancy', category: 'Oncological', selected: false },
  { id: 'pregnancy', name: 'Pregnancy', category: 'Other', selected: false },
  { id: 'psychiatric', name: 'Psychiatric Disorder', category: 'Psychiatric', selected: false }
];

interface PreoperativePlanningModuleProps {
  patientId?: string;
  procedureId?: string;
  onComplete?: (data: PreopPlanningData) => void;
  onCancel?: () => void;
}

export const PreoperativePlanningModule: React.FC<PreoperativePlanningModuleProps> = ({
  patientId,
  procedureId,
  onComplete,
  onCancel
}) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedSections, setExpandedSections] = useState<string[]>(['basic', 'clinical', 'comorbidities', 'risk', 'investigations']);
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  const [formData, setFormData] = useState<PreopPlanningData>({
    patientId: patientId || '',
    procedureType: '',
    procedureName: '',
    anesthesiaType: 'general',
    urgency: 'elective',
    expectedDuration: 60,
    expectedBloodLoss: 'minimal',
    comorbidities: [...COMORBIDITY_OPTIONS],
    clinicalAssessment: {
      weight: 0,
      height: 0,
      bmi: 0,
      bloodPressure: '',
      heartRate: 0,
      temperature: 36.5,
      oxygenSaturation: 98,
      respiratoryRate: 16,
      airwayAssessment: 'normal',
      mallampatiScore: 1,
      npo_status: '',
      allergies: [],
      currentMedications: [],
      previousSurgeries: [],
      previousAnesthesiaComplications: '',
      smokingStatus: 'never',
      alcoholUse: 'none',
      functionalCapacity: 'good'
    },
    riskAssessment: {
      asaScore: 1,
      cardiacRisk: 'low',
      pulmonaryRisk: 'low',
      renalRisk: 'low',
      bleedingRisk: 'low',
      thrombosisRisk: 'low',
      overallRisk: 'low'
    },
    generatedInvestigations: [],
    additionalNotes: '',
    assessedBy: localStorage.getItem('userName') || '',
    assessmentDate: new Date()
  });

  const [newAllergy, setNewAllergy] = useState('');
  const [newMedication, setNewMedication] = useState('');
  const [newSurgery, setNewSurgery] = useState('');

  // Load patient data
  useEffect(() => {
    if (patientId) {
      loadPatientData();
    } else {
      setIsLoading(false);
    }
  }, [patientId]);

  // Calculate BMI when weight/height changes
  useEffect(() => {
    if (formData.clinicalAssessment.weight > 0 && formData.clinicalAssessment.height > 0) {
      const heightInMeters = formData.clinicalAssessment.height / 100;
      const bmi = formData.clinicalAssessment.weight / (heightInMeters * heightInMeters);
      setFormData(prev => ({
        ...prev,
        clinicalAssessment: {
          ...prev.clinicalAssessment,
          bmi: Math.round(bmi * 10) / 10
        }
      }));
    }
  }, [formData.clinicalAssessment.weight, formData.clinicalAssessment.height]);

  // Auto-generate investigations when relevant fields change
  useEffect(() => {
    generateInvestigations();
  }, [
    formData.procedureType,
    formData.anesthesiaType,
    formData.urgency,
    formData.expectedBloodLoss,
    formData.comorbidities,
    formData.clinicalAssessment.functionalCapacity,
    formData.riskAssessment.asaScore
  ]);

  const loadPatientData = async () => {
    try {
      setIsLoading(true);
      const patientData = await patientService.getPatientById(patientId!);
      if (patientData) {
        setPatient(patientData);
        setFormData(prev => ({ ...prev, patientId: patientId! }));
      }
    } catch (error) {
      console.error('Error loading patient:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateInvestigations = () => {
    const investigations: Investigation[] = [];
    const selectedComorbidities = formData.comorbidities.filter(c => c.selected);
    
    // Base investigations for any surgery
    investigations.push({
      id: 'fbc',
      name: 'Full Blood Count (FBC)',
      category: 'Hematology',
      required: true,
      reason: 'Baseline hematology for all surgical procedures',
      priority: formData.urgency === 'emergency' ? 'stat' : 'routine'
    });

    // U&E - Required for most surgeries
    if (formData.anesthesiaType === 'general' || formData.anesthesiaType === 'regional' ||
        selectedComorbidities.some(c => ['ckd', 'dialysis', 'hypertension', 'chf', 'dm_type1', 'dm_type2'].includes(c.id))) {
      investigations.push({
        id: 'ue',
        name: 'Urea & Electrolytes (U&E)',
        category: 'Biochemistry',
        required: true,
        reason: selectedComorbidities.some(c => ['ckd', 'dialysis'].includes(c.id)) 
          ? 'Renal function monitoring' 
          : 'Baseline renal function for anesthesia',
        priority: formData.urgency === 'emergency' ? 'stat' : 'routine'
      });
    }

    // Blood glucose
    if (selectedComorbidities.some(c => ['dm_type1', 'dm_type2'].includes(c.id))) {
      investigations.push({
        id: 'glucose',
        name: 'Fasting Blood Glucose',
        category: 'Biochemistry',
        required: true,
        reason: 'Diabetic patient - glycemic control assessment',
        priority: 'urgent'
      });
      investigations.push({
        id: 'hba1c',
        name: 'HbA1c',
        category: 'Biochemistry',
        required: true,
        reason: 'Long-term glycemic control assessment',
        priority: 'routine'
      });
    }

    // LFT - Hepatic disease or major surgery
    if (selectedComorbidities.some(c => ['cirrhosis', 'hepatitis'].includes(c.id)) ||
        formData.expectedDuration > 120 || formData.expectedBloodLoss !== 'minimal') {
      investigations.push({
        id: 'lft',
        name: 'Liver Function Tests (LFT)',
        category: 'Biochemistry',
        required: true,
        reason: selectedComorbidities.some(c => ['cirrhosis', 'hepatitis'].includes(c.id))
          ? 'Hepatic disease monitoring'
          : 'Major surgery - hepatic function assessment',
        priority: 'routine'
      });
    }

    // Coagulation - Bleeding risk, liver disease, anticoagulation
    if (formData.expectedBloodLoss !== 'minimal' ||
        selectedComorbidities.some(c => ['bleeding_disorder', 'anticoagulation', 'cirrhosis'].includes(c.id))) {
      investigations.push({
        id: 'coag',
        name: 'Coagulation Profile (PT/INR, aPTT)',
        category: 'Hematology',
        required: true,
        reason: 'Bleeding risk assessment',
        priority: formData.urgency === 'emergency' ? 'stat' : 'urgent'
      });
    }

    // Blood Group & Cross-match - Significant blood loss expected
    if (formData.expectedBloodLoss === 'significant' || formData.urgency === 'emergency') {
      investigations.push({
        id: 'gxm',
        name: 'Blood Group & Cross-match',
        category: 'Blood Bank',
        required: true,
        reason: 'Anticipated blood transfusion requirement',
        priority: formData.urgency === 'emergency' ? 'stat' : 'urgent'
      });
    } else if (formData.expectedBloodLoss === 'moderate') {
      investigations.push({
        id: 'gs',
        name: 'Blood Group & Save',
        category: 'Blood Bank',
        required: true,
        reason: 'Moderate blood loss anticipated - group & save for potential transfusion',
        priority: 'urgent'
      });
    }

    // ECG - Age > 40, cardiac risk, or significant surgery
    if (formData.riskAssessment.cardiacRisk !== 'low' ||
        selectedComorbidities.some(c => ['hypertension', 'cad', 'chf', 'arrhythmia', 'valvular'].includes(c.id)) ||
        formData.anesthesiaType === 'general') {
      investigations.push({
        id: 'ecg',
        name: '12-Lead ECG',
        category: 'Cardiology',
        required: true,
        reason: selectedComorbidities.some(c => ['cad', 'arrhythmia'].includes(c.id))
          ? 'Cardiac disease - baseline ECG'
          : 'Cardiovascular assessment for anesthesia',
        priority: 'urgent'
      });
    }

    // Chest X-ray - Respiratory disease, cardiac disease, major surgery
    if (selectedComorbidities.some(c => ['copd', 'asthma', 'pulmonary_fibrosis', 'chf'].includes(c.id)) ||
        formData.riskAssessment.pulmonaryRisk !== 'low' ||
        formData.anesthesiaType === 'general') {
      investigations.push({
        id: 'cxr',
        name: 'Chest X-ray (PA)',
        category: 'Radiology',
        required: true,
        reason: selectedComorbidities.some(c => ['copd', 'asthma'].includes(c.id))
          ? 'Pulmonary disease assessment'
          : 'Cardiopulmonary assessment for general anesthesia',
        priority: 'routine'
      });
    }

    // Echocardiogram - Cardiac disease, significant cardiac history
    if (selectedComorbidities.some(c => ['chf', 'valvular', 'cad'].includes(c.id)) ||
        formData.riskAssessment.cardiacRisk === 'high') {
      investigations.push({
        id: 'echo',
        name: 'Echocardiogram',
        category: 'Cardiology',
        required: true,
        reason: 'Cardiac function assessment - ejection fraction & valvular function',
        priority: 'urgent'
      });
    }

    // Pulmonary Function Tests - Significant respiratory disease
    if (selectedComorbidities.some(c => ['copd', 'pulmonary_fibrosis'].includes(c.id)) &&
        formData.anesthesiaType === 'general') {
      investigations.push({
        id: 'pft',
        name: 'Pulmonary Function Tests (Spirometry)',
        category: 'Pulmonology',
        required: false,
        reason: 'Assess pulmonary reserve before general anesthesia',
        priority: 'routine'
      });
    }

    // Thyroid Function - Thyroid disease
    if (selectedComorbidities.some(c => c.id === 'thyroid')) {
      investigations.push({
        id: 'tft',
        name: 'Thyroid Function Tests (TFT)',
        category: 'Endocrinology',
        required: true,
        reason: 'Thyroid disease - ensure euthyroid state',
        priority: 'routine'
      });
    }

    // Urinalysis
    if (formData.urgency !== 'emergency' && 
        (selectedComorbidities.some(c => ['dm_type1', 'dm_type2', 'ckd'].includes(c.id)) ||
         formData.procedureType.includes('urolog'))) {
      investigations.push({
        id: 'ua',
        name: 'Urinalysis',
        category: 'Biochemistry',
        required: false,
        reason: 'Screen for urinary tract infection',
        priority: 'routine'
      });
    }

    // Sickling test
    if (selectedComorbidities.some(c => c.id === 'sickle_cell')) {
      investigations.push({
        id: 'sickling',
        name: 'Sickling Test / Hb Electrophoresis',
        category: 'Hematology',
        required: true,
        reason: 'Sickle cell disease - confirm status',
        priority: 'urgent'
      });
    }

    // HIV/Hepatitis screening - For major surgery if indicated
    if (formData.expectedBloodLoss === 'significant') {
      investigations.push({
        id: 'retroviral',
        name: 'Retroviral Screening (with consent)',
        category: 'Serology',
        required: false,
        reason: 'Blood product administration anticipated',
        priority: 'routine'
      });
    }

    // Pregnancy test - Women of childbearing age
    if (patient?.gender === 'female') {
      investigations.push({
        id: 'bhcg',
        name: 'Urine/Serum β-hCG (Pregnancy Test)',
        category: 'Biochemistry',
        required: true,
        reason: 'Rule out pregnancy before surgery',
        priority: 'urgent'
      });
    }

    setFormData(prev => ({
      ...prev,
      generatedInvestigations: investigations
    }));
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const toggleComorbidity = (id: string) => {
    setFormData(prev => ({
      ...prev,
      comorbidities: prev.comorbidities.map(c =>
        c.id === id ? { ...c, selected: !c.selected } : c
      )
    }));
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setFormData(prev => ({
        ...prev,
        clinicalAssessment: {
          ...prev.clinicalAssessment,
          allergies: [...prev.clinicalAssessment.allergies, newAllergy.trim()]
        }
      }));
      setNewAllergy('');
    }
  };

  const removeAllergy = (index: number) => {
    setFormData(prev => ({
      ...prev,
      clinicalAssessment: {
        ...prev.clinicalAssessment,
        allergies: prev.clinicalAssessment.allergies.filter((_, i) => i !== index)
      }
    }));
  };

  const addMedication = () => {
    if (newMedication.trim()) {
      setFormData(prev => ({
        ...prev,
        clinicalAssessment: {
          ...prev.clinicalAssessment,
          currentMedications: [...prev.clinicalAssessment.currentMedications, newMedication.trim()]
        }
      }));
      setNewMedication('');
    }
  };

  const removeMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      clinicalAssessment: {
        ...prev.clinicalAssessment,
        currentMedications: prev.clinicalAssessment.currentMedications.filter((_, i) => i !== index)
      }
    }));
  };

  const addPreviousSurgery = () => {
    if (newSurgery.trim()) {
      setFormData(prev => ({
        ...prev,
        clinicalAssessment: {
          ...prev.clinicalAssessment,
          previousSurgeries: [...prev.clinicalAssessment.previousSurgeries, newSurgery.trim()]
        }
      }));
      setNewSurgery('');
    }
  };

  const removePreviousSurgery = (index: number) => {
    setFormData(prev => ({
      ...prev,
      clinicalAssessment: {
        ...prev.clinicalAssessment,
        previousSurgeries: prev.clinicalAssessment.previousSurgeries.filter((_, i) => i !== index)
      }
    }));
  };

  const calculateOverallRisk = () => {
    const risks = [
      formData.riskAssessment.cardiacRisk,
      formData.riskAssessment.pulmonaryRisk,
      formData.riskAssessment.renalRisk,
      formData.riskAssessment.bleedingRisk,
      formData.riskAssessment.thrombosisRisk
    ];
    
    if (risks.includes('high') || formData.riskAssessment.asaScore >= 4) {
      return 'high';
    } else if (risks.includes('intermediate') || formData.riskAssessment.asaScore >= 3) {
      return 'intermediate';
    }
    return 'low';
  };

  useEffect(() => {
    const overall = calculateOverallRisk();
    if (overall !== formData.riskAssessment.overallRisk) {
      setFormData(prev => ({
        ...prev,
        riskAssessment: {
          ...prev.riskAssessment,
          overallRisk: overall
        }
      }));
    }
  }, [formData.riskAssessment.cardiacRisk, formData.riskAssessment.pulmonaryRisk, 
      formData.riskAssessment.renalRisk, formData.riskAssessment.bleedingRisk, 
      formData.riskAssessment.thrombosisRisk, formData.riskAssessment.asaScore]);

  const generateThermalLabRequestPDF = async () => {
    const { jsPDF } = await import('jspdf');
    
    // 80mm = ~226 points width
    const thermalWidth = 80;
    const investigations = formData.generatedInvestigations;
    
    // Group by category first
    const byCategory = investigations.reduce((acc, inv) => {
      if (!acc[inv.category]) acc[inv.category] = [];
      acc[inv.category].push(inv);
      return acc;
    }, {} as Record<string, Investigation[]>);

    const categories = Object.keys(byCategory);
    
    // Calculate page height for each category (enough for header + patient details + investigations)
    const getPageHeight = (numInvestigations: number) => {
      return Math.max(100, 80 + (numInvestigations * 6));
    };

    // Create first page
    const firstCategory = categories[0];
    const firstPageHeight = getPageHeight(byCategory[firstCategory]?.length || 0);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [thermalWidth, firstPageHeight]
    });

    const margin = 3;
    
    // Helper to sanitize text for PDF
    const clean = (text: string) => sanitizeTextForPDF(text || '');

    // Helper function to add patient header on each page
    const addPatientHeader = (category: string, pageHeight: number) => {
      let yPos = margin;
      
      // Set Georgia-like font (Times is closest available)
      doc.setFont('times', 'normal');
      
      // Header
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text('UNTH LABORATORY REQUEST', thermalWidth / 2, yPos, { align: 'center' });
      yPos += 5;
      
      doc.setFontSize(8);
      doc.setFont('times', 'normal');
      doc.text('Plastic & Reconstructive Surgery', thermalWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      // Divider
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 4;

      // Patient Info Section
      doc.setFontSize(9);
      doc.setFont('times', 'bold');
      doc.text('PATIENT DETAILS', margin, yPos);
      yPos += 4;
      
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      const patientName = patient?.full_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim() || 'N/A';
      doc.text(`Name: ${patientName}`, margin, yPos);
      yPos += 4;
      doc.text(`Hospital #: ${patient?.hospital_number || 'N/A'}`, margin, yPos);
      yPos += 4;
      
      const age = patient?.date_of_birth ? calculateAge(patient.date_of_birth) : 'N/A';
      const gender = patient?.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : 'N/A';
      doc.text(`Age/Sex: ${age} years / ${gender}`, margin, yPos);
      yPos += 4;
      
      doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos);
      yPos += 4;
      doc.text(`Time: ${new Date().toLocaleTimeString()}`, margin, yPos);
      yPos += 4;

      // Procedure Info
      doc.setFont('times', 'bold');
      const procName = formData.procedureName || formData.procedureType || 'N/A';
      const truncatedProc = procName.length > 30 ? procName.substring(0, 27) + '...' : procName;
      doc.text(`Procedure: ${truncatedProc}`, margin, yPos);
      yPos += 4;
      doc.setFont('times', 'normal');
      doc.text(`Priority: ${formData.urgency.toUpperCase()}`, margin, yPos);
      yPos += 4;

      // Divider
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 4;

      // Category Header
      doc.setFontSize(12);
      doc.setFont('times', 'bold');
      doc.text(`[ ${category.toUpperCase()} ]`, thermalWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      return yPos;
    };

    // Helper function to add footer on each page
    const addPageFooter = (yPos: number) => {
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, thermalWidth - margin, yPos);
      yPos += 4;
      
      doc.setFontSize(8);
      doc.setFont('times', 'normal');
      doc.text(`Requested by: ${formData.assessedBy}`, margin, yPos);
      yPos += 4;
      doc.text('!! = STAT  ! = Urgent', margin, yPos);
      yPos += 4;
      doc.setFont('times', 'bold');
      doc.text('PRE-OPERATIVE ASSESSMENT', thermalWidth / 2, yPos, { align: 'center' });
    };

    // Helper function to calculate age
    const calculateAge = (dob: string): number => {
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // Generate pages for each category
    categories.forEach((category, pageIndex) => {
      const invs = byCategory[category];
      const pageHeight = getPageHeight(invs.length);
      
      if (pageIndex > 0) {
        // Add new page for subsequent categories
        doc.addPage([thermalWidth, pageHeight]);
      }
      
      // Add patient header
      let yPos = addPatientHeader(category, pageHeight);

      // List investigations for this category
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      
      invs.forEach((inv, idx) => {
        const priority = inv.priority === 'stat' ? ' !!' : inv.priority === 'urgent' ? ' !' : '';
        doc.text(`${idx + 1}. ${inv.name}${priority}`, margin + 2, yPos);
        yPos += 5;
      });

      yPos += 3;

      // Add footer
      addPageFooter(yPos);
    });

    // Save
    const filename = `LabRequest_${patient?.hospital_number || 'patient'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    setShowPrintModal(false);
  };

  const navigateToShoppingList = () => {
    navigate('/shopping-list');
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete(formData);
    }
  };

  const getRiskBadge = (risk: 'low' | 'intermediate' | 'high') => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-300',
      intermediate: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      high: 'bg-red-100 text-red-800 border-red-300'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[risk]}`}>
        {risk.charAt(0).toUpperCase() + risk.slice(1)} Risk
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading patient data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <ClipboardCheck className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-operative Planning</h1>
              <p className="text-gray-500">Comprehensive clinical assessment and investigation planning</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowPrintModal(true)}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              disabled={formData.generatedInvestigations.length === 0}
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Lab Request
            </button>
            <button
              onClick={navigateToShoppingList}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              Generate Shopping List
            </button>
          </div>
        </div>

        {/* Patient Info */}
        {patient && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              <User className="w-10 h-10 text-gray-400" />
              <div>
                <h3 className="font-semibold text-gray-900">{patient.full_name}</h3>
                <p className="text-sm text-gray-500">
                  Hospital #: {patient.hospital_number} | 
                  Gender: {patient.gender} | 
                  DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Overall Risk Summary */}
      <div className={`mb-6 p-4 rounded-lg border-2 ${
        formData.riskAssessment.overallRisk === 'high' 
          ? 'bg-red-50 border-red-300' 
          : formData.riskAssessment.overallRisk === 'intermediate'
          ? 'bg-yellow-50 border-yellow-300'
          : 'bg-green-50 border-green-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <AlertTriangle className={`w-6 h-6 ${
              formData.riskAssessment.overallRisk === 'high' 
                ? 'text-red-600' 
                : formData.riskAssessment.overallRisk === 'intermediate'
                ? 'text-yellow-600'
                : 'text-green-600'
            }`} />
            <div>
              <h3 className="font-semibold text-gray-900">
                Overall Surgical Risk: {formData.riskAssessment.overallRisk.toUpperCase()}
              </h3>
              <p className="text-sm text-gray-600">
                ASA Score: {formData.riskAssessment.asaScore} | 
                {formData.generatedInvestigations.length} investigations recommended
              </p>
            </div>
          </div>
          <div className="flex space-x-2">
            {getRiskBadge(formData.riskAssessment.cardiacRisk)}
            {getRiskBadge(formData.riskAssessment.pulmonaryRisk)}
            {getRiskBadge(formData.riskAssessment.renalRisk)}
          </div>
        </div>
      </div>

      {/* Basic Procedure Information */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <button
          onClick={() => toggleSection('basic')}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <Stethoscope className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Procedure Information</h2>
          </div>
          {expandedSections.includes('basic') ? <ChevronUp /> : <ChevronDown />}
        </button>
        
        {expandedSections.includes('basic') && (
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Type *</label>
                <select
                  value={formData.procedureType}
                  onChange={(e) => setFormData({ ...formData, procedureType: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  title="Select procedure type"
                >
                  <option value="">Select type...</option>
                  <option value="reconstructive">Reconstructive Surgery</option>
                  <option value="aesthetic">Aesthetic/Cosmetic Surgery</option>
                  <option value="hand">Hand Surgery</option>
                  <option value="craniofacial">Craniofacial Surgery</option>
                  <option value="burn">Burn Surgery</option>
                  <option value="microsurgery">Microsurgery</option>
                  <option value="skin_graft">Skin Grafting</option>
                  <option value="flap">Flap Surgery</option>
                  <option value="debridement">Wound Debridement</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name *</label>
                <input
                  type="text"
                  value={formData.procedureName}
                  onChange={(e) => setFormData({ ...formData, procedureName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="E.g., Split-thickness skin graft to left leg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type *</label>
                <select
                  value={formData.anesthesiaType}
                  onChange={(e) => setFormData({ ...formData, anesthesiaType: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  title="Select anesthesia type"
                >
                  <option value="local">Local Anesthesia</option>
                  <option value="regional">Regional (Spinal/Epidural/Block)</option>
                  <option value="sedation">IV Sedation</option>
                  <option value="general">General Anesthesia</option>
                  <option value="combined">Combined (Regional + General)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Urgency *</label>
                <select
                  value={formData.urgency}
                  onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  title="Select urgency"
                >
                  <option value="elective">Elective (Planned)</option>
                  <option value="urgent">Urgent (Within 24-72hrs)</option>
                  <option value="emergency">Emergency (Immediate)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.expectedDuration}
                  onChange={(e) => setFormData({ ...formData, expectedDuration: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  min="15"
                  step="15"
                  title="Expected duration in minutes"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expected Blood Loss</label>
                <select
                  value={formData.expectedBloodLoss}
                  onChange={(e) => setFormData({ ...formData, expectedBloodLoss: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  title="Expected blood loss"
                >
                  <option value="minimal">Minimal (&lt;250ml)</option>
                  <option value="moderate">Moderate (250-500ml)</option>
                  <option value="significant">Significant (&gt;500ml)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clinical Assessment */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <button
          onClick={() => toggleSection('clinical')}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Clinical Assessment</h2>
          </div>
          {expandedSections.includes('clinical') ? <ChevronUp /> : <ChevronDown />}
        </button>
        
        {expandedSections.includes('clinical') && (
          <div className="px-6 pb-6 space-y-6">
            {/* Vital Signs */}
            <div>
              <h3 className="text-md font-medium text-gray-800 mb-3 flex items-center">
                <Thermometer className="w-4 h-4 mr-2 text-primary-600" />
                Vital Signs
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    value={formData.clinicalAssessment.weight || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, weight: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="70"
                    title="Weight in kg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={formData.clinicalAssessment.height || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, height: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="170"
                    title="Height in cm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">BMI</label>
                  <input
                    type="text"
                    value={formData.clinicalAssessment.bmi || '-'}
                    readOnly
                    className="w-full px-3 py-2 border rounded-lg bg-gray-50"
                    title="Calculated BMI"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Blood Pressure</label>
                  <input
                    type="text"
                    value={formData.clinicalAssessment.bloodPressure}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, bloodPressure: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="120/80"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Heart Rate (bpm)</label>
                  <input
                    type="number"
                    value={formData.clinicalAssessment.heartRate || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, heartRate: parseInt(e.target.value) || 0 }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="72"
                    title="Heart rate"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Temperature (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.clinicalAssessment.temperature}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, temperature: parseFloat(e.target.value) || 36.5 }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    title="Temperature"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">SpO2 (%)</label>
                  <input
                    type="number"
                    value={formData.clinicalAssessment.oxygenSaturation}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, oxygenSaturation: parseInt(e.target.value) || 98 }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    title="Oxygen saturation"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Resp Rate (/min)</label>
                  <input
                    type="number"
                    value={formData.clinicalAssessment.respiratoryRate}
                    onChange={(e) => setFormData({
                      ...formData,
                      clinicalAssessment: { ...formData.clinicalAssessment, respiratoryRate: parseInt(e.target.value) || 16 }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    title="Respiratory rate"
                  />
                </div>
              </div>
            </div>

            {/* Airway Assessment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Airway Assessment</label>
                <select
                  value={formData.clinicalAssessment.airwayAssessment}
                  onChange={(e) => setFormData({
                    ...formData,
                    clinicalAssessment: { ...formData.clinicalAssessment, airwayAssessment: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  title="Airway assessment"
                >
                  <option value="normal">Normal</option>
                  <option value="potentially_difficult">Potentially Difficult</option>
                  <option value="difficult">Known Difficult Airway</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mallampati Score</label>
                <select
                  value={formData.clinicalAssessment.mallampatiScore}
                  onChange={(e) => setFormData({
                    ...formData,
                    clinicalAssessment: { ...formData.clinicalAssessment, mallampatiScore: parseInt(e.target.value) as any }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  title="Mallampati score"
                >
                  <option value={1}>Class I - Soft palate, uvula, fauces visible</option>
                  <option value={2}>Class II - Soft palate, uvula visible</option>
                  <option value={3}>Class III - Soft palate, base of uvula visible</option>
                  <option value={4}>Class IV - Hard palate only</option>
                </select>
              </div>
            </div>

            {/* NPO Status & Functional Capacity */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">NPO Status</label>
                <input
                  type="text"
                  value={formData.clinicalAssessment.npo_status}
                  onChange={(e) => setFormData({
                    ...formData,
                    clinicalAssessment: { ...formData.clinicalAssessment, npo_status: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g., NPO since midnight"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Smoking Status</label>
                <select
                  value={formData.clinicalAssessment.smokingStatus}
                  onChange={(e) => setFormData({
                    ...formData,
                    clinicalAssessment: { ...formData.clinicalAssessment, smokingStatus: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  title="Smoking status"
                >
                  <option value="never">Never Smoked</option>
                  <option value="former">Former Smoker</option>
                  <option value="current">Current Smoker</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Functional Capacity</label>
                <select
                  value={formData.clinicalAssessment.functionalCapacity}
                  onChange={(e) => setFormData({
                    ...formData,
                    clinicalAssessment: { ...formData.clinicalAssessment, functionalCapacity: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border rounded-lg"
                  title="Functional capacity"
                >
                  <option value="excellent">&gt;10 METs - Excellent</option>
                  <option value="good">7-10 METs - Good</option>
                  <option value="moderate">4-7 METs - Moderate</option>
                  <option value="poor">&lt;4 METs - Poor</option>
                </select>
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.clinicalAssessment.allergies.map((allergy, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                    {allergy}
                    <button onClick={() => removeAllergy(idx)} className="ml-2 text-red-600 hover:text-red-800" title="Remove allergy">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formData.clinicalAssessment.allergies.length === 0 && (
                  <span className="text-sm text-gray-500">No known allergies</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAllergy())}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  placeholder="Add allergy..."
                />
                <button
                  type="button"
                  onClick={addAllergy}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  title="Add allergy"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Current Medications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.clinicalAssessment.currentMedications.map((med, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {med}
                    <button onClick={() => removeMedication(idx)} className="ml-2 text-blue-600 hover:text-blue-800" title="Remove medication">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formData.clinicalAssessment.currentMedications.length === 0 && (
                  <span className="text-sm text-gray-500">No current medications</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMedication}
                  onChange={(e) => setNewMedication(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addMedication())}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  placeholder="Add medication..."
                />
                <button
                  type="button"
                  onClick={addMedication}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  title="Add medication"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Previous Surgeries */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Previous Surgeries</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.clinicalAssessment.previousSurgeries.map((surgery, idx) => (
                  <span key={idx} className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                    {surgery}
                    <button onClick={() => removePreviousSurgery(idx)} className="ml-2 text-gray-600 hover:text-gray-800" title="Remove surgery">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {formData.clinicalAssessment.previousSurgeries.length === 0 && (
                  <span className="text-sm text-gray-500">No previous surgeries</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSurgery}
                  onChange={(e) => setNewSurgery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPreviousSurgery())}
                  className="flex-1 px-3 py-2 border rounded-lg"
                  placeholder="Add previous surgery..."
                />
                <button
                  type="button"
                  onClick={addPreviousSurgery}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  title="Add surgery"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Previous Anesthesia Complications */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Previous Anesthesia Complications</label>
              <textarea
                value={formData.clinicalAssessment.previousAnesthesiaComplications}
                onChange={(e) => setFormData({
                  ...formData,
                  clinicalAssessment: { ...formData.clinicalAssessment, previousAnesthesiaComplications: e.target.value }
                })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="e.g., Difficult intubation, PONV, malignant hyperthermia family history..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Comorbidities */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <button
          onClick={() => toggleSection('comorbidities')}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <Heart className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Comorbidities ({formData.comorbidities.filter(c => c.selected).length} selected)
            </h2>
          </div>
          {expandedSections.includes('comorbidities') ? <ChevronUp /> : <ChevronDown />}
        </button>
        
        {expandedSections.includes('comorbidities') && (
          <div className="px-6 pb-6">
            {/* Group by category */}
            {['Cardiovascular', 'Respiratory', 'Metabolic', 'Renal', 'Hepatic', 'Hematologic', 'Neurological', 'Other'].map(category => {
              const categoryComorbidities = formData.comorbidities.filter(
                c => c.category === category || (category === 'Other' && !['Cardiovascular', 'Respiratory', 'Metabolic', 'Renal', 'Hepatic', 'Hematologic', 'Neurological'].includes(c.category))
              );
              if (categoryComorbidities.length === 0) return null;

              return (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">{category}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {categoryComorbidities.map(comorbidity => (
                      <label
                        key={comorbidity.id}
                        className={`flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors ${
                          comorbidity.selected 
                            ? 'border-primary-500 bg-primary-50' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={comorbidity.selected}
                          onChange={() => toggleComorbidity(comorbidity.id)}
                          className="rounded border-gray-300 text-primary-600"
                        />
                        <span className="text-sm">{comorbidity.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Risk Assessment */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <button
          onClick={() => toggleSection('risk')}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Risk Assessment</h2>
          </div>
          {expandedSections.includes('risk') ? <ChevronUp /> : <ChevronDown />}
        </button>
        
        {expandedSections.includes('risk') && (
          <div className="px-6 pb-6 space-y-4">
            {/* ASA Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">ASA Physical Status</label>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map(score => (
                  <button
                    key={score}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      riskAssessment: { ...formData.riskAssessment, asaScore: score as any }
                    })}
                    className={`py-3 px-2 rounded-lg text-center border-2 transition-colors ${
                      formData.riskAssessment.asaScore === score
                        ? score <= 2 ? 'border-green-500 bg-green-50 text-green-700'
                          : score === 3 ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-bold">ASA {score}</div>
                    <div className="text-xs mt-1">
                      {score === 1 && 'Healthy'}
                      {score === 2 && 'Mild Disease'}
                      {score === 3 && 'Severe Disease'}
                      {score === 4 && 'Life Threat'}
                      {score === 5 && 'Moribund'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Individual Risk Categories */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { key: 'cardiacRisk', label: 'Cardiac Risk', icon: Heart },
                { key: 'pulmonaryRisk', label: 'Pulmonary Risk', icon: Activity },
                { key: 'renalRisk', label: 'Renal Risk', icon: Droplet },
                { key: 'bleedingRisk', label: 'Bleeding Risk', icon: Droplet },
                { key: 'thrombosisRisk', label: 'VTE Risk', icon: Zap }
              ].map(({ key, label, icon: Icon }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
                    <Icon className="w-4 h-4 mr-1 text-primary-600" />
                    {label}
                  </label>
                  <select
                    value={(formData.riskAssessment as any)[key]}
                    onChange={(e) => setFormData({
                      ...formData,
                      riskAssessment: { ...formData.riskAssessment, [key]: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-lg"
                    title={label}
                  >
                    <option value="low">Low</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Generated Investigations */}
      <div className="bg-white rounded-lg shadow-sm mb-4">
        <button
          onClick={() => toggleSection('investigations')}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Generated Investigations ({formData.generatedInvestigations.length})
            </h2>
          </div>
          {expandedSections.includes('investigations') ? <ChevronUp /> : <ChevronDown />}
        </button>
        
        {expandedSections.includes('investigations') && (
          <div className="px-6 pb-6">
            {formData.generatedInvestigations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Complete the procedure and patient information above</p>
                <p className="text-sm">to auto-generate required investigations</p>
              </div>
            ) : (
              <>
                {/* Group by category */}
                {Object.entries(
                  formData.generatedInvestigations.reduce((acc, inv) => {
                    if (!acc[inv.category]) acc[inv.category] = [];
                    acc[inv.category].push(inv);
                    return acc;
                  }, {} as Record<string, Investigation[]>)
                ).map(([category, investigations]) => (
                  <div key={category} className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs mr-2">{category}</span>
                    </h4>
                    <div className="space-y-2">
                      {investigations.map(inv => (
                        <div 
                          key={inv.id} 
                          className={`p-3 rounded-lg border ${
                            inv.priority === 'stat' 
                              ? 'border-red-200 bg-red-50' 
                              : inv.priority === 'urgent'
                              ? 'border-orange-200 bg-orange-50'
                              : 'border-gray-200 bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <CheckCircle className={`w-4 h-4 ${
                                inv.priority === 'stat' ? 'text-red-600' : 
                                inv.priority === 'urgent' ? 'text-orange-600' : 'text-green-600'
                              }`} />
                              <span className="font-medium">{inv.name}</span>
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                inv.priority === 'stat' 
                                  ? 'bg-red-200 text-red-800' 
                                  : inv.priority === 'urgent'
                                  ? 'bg-orange-200 text-orange-800'
                                  : 'bg-gray-200 text-gray-600'
                              }`}>
                                {inv.priority.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 ml-6">{inv.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Print Button */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="inline-flex items-center px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                  >
                    <Printer className="w-5 h-5 mr-2" />
                    Print Lab Request (Thermal 80mm)
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Additional Notes */}
      <div className="bg-white rounded-lg shadow-sm mb-6 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h2>
        <textarea
          value={formData.additionalNotes}
          onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg"
          placeholder="Any additional clinical notes or special considerations..."
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center bg-white rounded-lg shadow-sm p-6">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
        <div className="flex space-x-3">
          <button
            onClick={navigateToShoppingList}
            className="inline-flex items-center px-6 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            Go to Shopping List
          </button>
          <button
            onClick={handleComplete}
            className="inline-flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Complete Assessment
          </button>
        </div>
      </div>

      {/* Print Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Print Lab Request</h3>
            <p className="text-gray-600 mb-6">
              Generate a PDF optimized for 80mm thermal printers (Font: Georgia, Size: 12).
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={generateThermalLabRequestPDF}
                className="inline-flex items-center px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreoperativePlanningModule;
