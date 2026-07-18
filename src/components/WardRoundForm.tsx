import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, User, Calendar, FileText, Activity, AlertCircle, TrendingUp, Pill, Stethoscope, ClipboardList, Users, Edit3, Camera, Image, Upload, Trash2, FileSearch, Loader2, TestTube, Brain, Mic } from 'lucide-react';
import { wardRoundsService, WardRound, ROUND_TYPES, RoundType, ClinicalImage } from '../services/wardRoundsService';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { TreatmentPlanModificationPanel } from './TreatmentPlanModificationPanel';
import { InvestigationOrderingModal } from './InvestigationOrderingModal';
import { MedicationOrderingModal } from './MedicationOrderingModal';
import { MedicalTextInput } from './MedicalTextInput';
import { ScribeRecordingPanel } from './ScribeRecordingPanel';
import { ScribeNoteEditor } from './ScribeNoteEditor';
import { medicalScribeService, StructuredNote, ScribeSession } from '../services/medicalScribeService';
import { DocumentScannerModal } from './DocumentScannerModal';
import { searchDrugs, BNFDrug } from '../data/bnfDrugDatabase';
import { ocrService } from '../services/ocrService';

interface WardRoundFormProps {
  patientId?: string;
  wardRoundId?: string;
  onClose: () => void;
  onSave: () => void;
}

export const WardRoundForm: React.FC<WardRoundFormProps> = ({
  patientId: initialPatientId,
  wardRoundId,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState('patient');
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { user: authUser } = useAuthStore();
  const [patientTreatmentPlan, setPatientTreatmentPlan] = useState<any>(null);
  const [previousRound, setPreviousRound] = useState<any>(null);
  const [showTreatmentPlanModification, setShowTreatmentPlanModification] = useState(false);
  
  // Investigation and Medication Ordering Modals
  const [showInvestigationModal, setShowInvestigationModal] = useState(false);
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [orderedInvestigations, setOrderedInvestigations] = useState<any[]>([]);
  const [orderedMedications, setOrderedMedications] = useState<any[]>([]);
  
  // Clinical Images state
  const [clinicalImages, setClinicalImages] = useState<ClinicalImage[]>([]);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // AI Medical Scribe state
  const [showScribePanel, setShowScribePanel] = useState(false);
  const [showScribeEditor, setShowScribeEditor] = useState(false);
  const [scribeNote, setScribeNote] = useState<StructuredNote | null>(null);
  const [scribeSession, setScribeSession] = useState<ScribeSession | null>(null);

  // AI Document Scanner state
  const [showDocumentScanner, setShowDocumentScanner] = useState(false);
  const [scannerDocType, setScannerDocType] = useState<'general' | 'handwritten_note' | 'lab_report' | 'prescription' | 'imaging_report'>('general');

  // BNF Medication Search state
  const [bnfSearchQuery, setBnfSearchQuery] = useState('');
  const [bnfSearchResults, setBnfSearchResults] = useState<BNFDrug[]>([]);
  const [selectedBnfDrug, setSelectedBnfDrug] = useState<BNFDrug | null>(null);
  const [showBnfDropdown, setShowBnfDropdown] = useState(false);

  const [formData, setFormData] = useState<any>({
    patient_id: initialPatientId || '',
    reviewer_id: '',
    reviewing_doctor: authUser?.name || '',
    round_date: format(new Date(), 'yyyy-MM-dd'),
    round_time: format(new Date(), 'HH:mm'),
    
    // Round Type - NEW
    round_type: 'house_officers_round' as RoundType,
    doctor_role: 'house_officer' as 'consultant' | 'senior_registrar' | 'registrar' | 'house_officer',
    accompanying_team: [] as string[],
    
    // Required Clinical Assessment Fields
    chief_complaint: '',
    clinical_notes: '',
    examination_findings: '',
    
    // Subjective Assessment
    subjective_complaints: '',
    pain_score: 0,
    sleep_quality: 'good',
    appetite: 'good',
    bowel_movement: 'normal',
    
    // Objective Assessment
    temperature: '',
    pulse: '',
    blood_pressure: '',
    respiratory_rate: '',
    spo2: '',
    
    // Physical Examination
    general_appearance: '',
    wound_status: '',
    drain_output: '',
    mobility_status: '',
    
    // Clinical Assessment
    clinical_impression: '',
    progress_status: 'stable' as 'improved' | 'stable' | 'deteriorating' | 'critical',
    complications: '',
    
    // Required Boolean Fields
    recent_labs_reviewed: false,
    treatment_plan_updated: false,
    medications_changed: false,
    wound_assessment_done: false,
    consultation_requested: false,
    
    // Management Plan
    continue_medications: [] as string[],
    new_medications: [] as Array<{name: string, dose: string, frequency: string, route: string}>,
    stop_medications: [] as string[],
    investigations_ordered: [] as string[],
    procedures_planned: [] as string[],
    
    // Treatment Plan Update
    treatment_plan_changes: '',
    dietary_modifications: '',
    activity_orders: '',
    nursing_instructions: '',
    
    // Required Follow-up Field
    follow_up_plan: '',
    next_review_date: '',
    discharge_plan: '',
    consultant_notified: false,
    
    // Clinical images and OCR
    clinical_images: [] as ClinicalImage[],
    ocr_extracted_text: '',
    
    // LMP for female patients
    lmp: '',
    
    notes: ''
  });

  const [newMedication, setNewMedication] = useState({
    name: '', dose: '', frequency: '', route: 'oral'
  });
  const [newInvestigation, setNewInvestigation] = useState('');
  const [newProcedure, setNewProcedure] = useState('');

  useEffect(() => {
    loadPatients();
    loadCurrentUser();
    if (wardRoundId) {
      loadWardRound();
    }
  }, [wardRoundId]);

  useEffect(() => {
    if (initialPatientId) {
      loadPatientDetails(initialPatientId);
    }
  }, [initialPatientId]);

  const loadCurrentUser = async () => {
    const user = await db.users.where('id').equals(localStorage.getItem('userId') || '').first();
    setCurrentUser(user);
    if (user) {
      setFormData(prev => ({ 
        ...prev, 
        reviewer_id: user.id,
        reviewing_doctor: user.name || authUser?.name || ''
      }));
    } else if (authUser) {
      setFormData(prev => ({
        ...prev,
        reviewing_doctor: authUser.name || authUser.email || ''
      }));
    }
  };

  const loadPatients = async () => {
    const allPatients = await patientService.getAllPatients();
    setPatients(allPatients);
  };

  const loadPatientDetails = async (patientId: string) => {
    if (!patientId) {
      setSelectedPatient(null);
      setPreviousRound(null);
      return;
    }
    // Dexie schema is '++id' (numeric auto-increment) but <select> values are strings.
    // Try numeric first, then string, then fall back to a scan by serverId / hospital_number.
    const numeric = Number(patientId);
    let patient: any =
      (!Number.isNaN(numeric) ? await db.patients.get(numeric) : undefined) ||
      (await db.patients.get(patientId as any));
    if (!patient) {
      patient = await db.patients
        .filter((p: any) =>
          String(p.id) === String(patientId) ||
          String(p.serverId ?? '') === String(patientId) ||
          String(p.hospital_number ?? '') === String(patientId)
        )
        .first();
    }
    if (!patient) {
      // Last-resort fallback to the in-memory list already fetched by loadPatients()
      patient = patients.find((p: any) =>
        String(p.id) === String(patientId) ||
        String(p.serverId ?? '') === String(patientId) ||
        String(p.hospital_number ?? '') === String(patientId)
      );
    }
    setSelectedPatient(patient || null);
    setFormData(prev => ({ ...prev, patient_id: patientId }));

    // Pre-fill management-plan fields from the most recent ward round (editable carry-over)
    if (!wardRoundId) {
      try {
        const previousRounds = await wardRoundsService.getPatientWardRounds(patientId);
        if (previousRounds && previousRounds.length > 0) {
          const sorted = [...previousRounds].sort((a: any, b: any) => {
            const da = new Date(a.round_date || a.created_at || 0).getTime();
            const db_ = new Date(b.round_date || b.created_at || 0).getTime();
            return db_ - da;
          });
          const last = sorted[0] as any;
          setPreviousRound(last);
          setFormData(prev => ({
            ...prev,
            treatment_plan_changes: prev.treatment_plan_changes || last.treatment_plan_changes || '',
            dietary_modifications: prev.dietary_modifications || last.dietary_modifications || '',
            activity_orders: prev.activity_orders || last.activity_orders || '',
            nursing_instructions: prev.nursing_instructions || last.nursing_instructions || '',
            follow_up_plan: prev.follow_up_plan || last.follow_up_plan || ''
          }));
        } else {
          setPreviousRound(null);
        }
      } catch (err) {
        console.warn('Could not load previous ward round for prefill:', err);
        setPreviousRound(null);
      }
    }
    
    // Load patient's treatment plan - only if authenticated
    try {
      const token = apiClient.getToken();
      if (!token) {
        console.log('⚠️ No auth token available yet, skipping treatment plan fetch');
        setPatientTreatmentPlan(null);
        return;
      }

      const data = await apiClient.getTreatmentPlans(patientId);
      if (data && data.length > 0) {
        // Get the most recent active plan
        const activePlan = data.find((p: any) => p.status === 'active') || data[0];
        setPatientTreatmentPlan(activePlan);
        console.log('✅ Treatment plan loaded successfully');
      } else {
        setPatientTreatmentPlan(null);
      }
    } catch (error: any) {
      // Silently handle auth errors - treatment plan is optional for ward rounds
      if (error.message?.includes('No token') || error.message?.includes('401')) {
        console.log('ℹ️ Treatment plan unavailable (not authenticated yet)');
      } else {
        console.error('Error loading treatment plan:', error);
      }
      setPatientTreatmentPlan(null);
    }
  };

  const loadWardRound = async () => {
    if (!wardRoundId) return;
    const round = await wardRoundsService.getWardRound(wardRoundId);
    if (round) {
      setFormData(prev => ({
        ...prev,
        ...round,
        // Preserve default arrays that server data may not include
        clinical_images: round.clinical_images || prev.clinical_images || [],
        new_medications: (round as any).new_medications || prev.new_medications || [],
        stop_medications: (round as any).stop_medications || prev.stop_medications || [],
        continue_medications: (round as any).continue_medications || prev.continue_medications || [],
        investigations_ordered: (round as any).investigations_ordered || prev.investigations_ordered || [],
        procedures_planned: (round as any).procedures_planned || prev.procedures_planned || [],
        accompanying_team: round.accompanying_team || prev.accompanying_team || [],
        round_date: format(new Date(round.round_date), 'yyyy-MM-dd'),
        round_time: round.round_time || prev.round_time
      }));
      loadPatientDetails(round.patient_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate patient selection
      if (!formData.patient_id) {
        alert('Please select a patient before submitting the ward round');
        setActiveTab('patient');
        return;
      }

      // Validate LMP for female patients
      const patientSex = (selectedPatient?.sex || selectedPatient?.gender || '').toLowerCase();
      if ((patientSex === 'female' || patientSex === 'f') && !formData.lmp) {
        alert('LMP (Last Menstrual Period) is required for female patients');
        return;
      }

      // Ensure all required fields are present
      const wardRoundData: Partial<WardRound> = {
        patient_id: formData.patient_id,
        patient_name: selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : '',
        hospital_number: selectedPatient?.hospital_number || '',
        round_date: new Date(formData.round_date),
        round_time: formData.round_time,
        round_type: formData.round_type,
        reviewing_doctor: formData.reviewing_doctor || authUser?.name || currentUser?.name || 'Unknown',
        doctor_role: formData.doctor_role,
        accompanying_team: formData.accompanying_team,
        
        // Required clinical fields
        chief_complaint: formData.chief_complaint || formData.subjective_complaints || 'No complaints',
        clinical_notes: formData.clinical_notes || formData.clinical_impression || 'No additional notes',
        examination_findings: formData.examination_findings || formData.general_appearance || 'No specific findings',
        
        // Vitals
        temperature: formData.temperature ? parseFloat(formData.temperature) : undefined,
        pulse: formData.pulse ? parseFloat(formData.pulse) : undefined,
        bp_systolic: formData.blood_pressure ? parseInt(formData.blood_pressure.split('/')[0]) : undefined,
        bp_diastolic: formData.blood_pressure ? parseInt(formData.blood_pressure.split('/')[1]) : undefined,
        respiratory_rate: formData.respiratory_rate ? parseFloat(formData.respiratory_rate) : undefined,
        spo2: formData.spo2 ? parseFloat(formData.spo2) : undefined,
        
        // Required boolean fields
        recent_labs_reviewed: formData.recent_labs_reviewed || false,
        treatment_plan_updated: formData.treatment_plan_updated || false,
        medications_changed: formData.medications_changed || (formData.new_medications.length > 0 || formData.stop_medications.length > 0),
        wound_assessment_done: formData.wound_assessment_done || !!formData.wound_status,
        consultation_requested: formData.consultation_requested || false,
        
        // Progress and planning
        progress_status: formData.progress_status,
        complications: formData.complications,
        follow_up_plan: formData.follow_up_plan || formData.discharge_plan || 'Continue current management',
        next_review_date: formData.next_review_date ? new Date(formData.next_review_date) : undefined,
        discharge_planning: formData.discharge_plan,
        
        // Clinical images
        clinical_images: clinicalImages,
        ocr_extracted_text: formData.ocr_extracted_text,
        
        // Medication changes
        medication_changes: formData.new_medications.length > 0 
          ? `New: ${formData.new_medications.map(m => `${m.name} ${m.dose} ${m.route} ${m.frequency}`).join(', ')}`
          : undefined,
        
        // Lab notes
        lab_notes: formData.investigations_ordered.length > 0 
          ? `Investigations ordered: ${formData.investigations_ordered.join(', ')}`
          : undefined,
        
        // Wound notes
        wound_notes: formData.wound_status,
        
        // Additional fields
        new_orders: formData.procedures_planned.length > 0 
          ? formData.procedures_planned.join(', ')
          : undefined,
        
        // LMP for female patients
        lmp: formData.lmp || undefined
      };

      console.log('Submitting ward round data:', wardRoundData);

      if (wardRoundId) {
        await wardRoundsService.updateWardRound(wardRoundId, wardRoundData);
      } else {
        await wardRoundsService.createWardRound(wardRoundData as Omit<WardRound, 'id' | 'created_at' | 'updated_at'>);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving ward round:', error);
      alert(`Error saving ward round: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const addMedication = () => {
    if (newMedication.name && newMedication.dose && newMedication.frequency) {
      setFormData(prev => ({
        ...prev,
        new_medications: [...prev.new_medications, { ...newMedication }]
      }));
      setNewMedication({ name: '', dose: '', frequency: '', route: 'oral' });
    }
  };

  const removeMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      new_medications: prev.new_medications.filter((_, i) => i !== index)
    }));
  };

  const addInvestigation = () => {
    if (newInvestigation.trim()) {
      setFormData(prev => ({
        ...prev,
        investigations_ordered: [...prev.investigations_ordered, newInvestigation]
      }));
      setNewInvestigation('');
    }
  };

  const addProcedure = () => {
    if (newProcedure.trim()) {
      setFormData(prev => ({
        ...prev,
        procedures_planned: [...prev.procedures_planned, newProcedure]
      }));
      setNewProcedure('');
    }
  };

  // AI Scribe: apply structured note data to the ward round form
  const handleScribeApplyToForm = (scribeFormData: Record<string, any>) => {
    setFormData(prev => {
      const updates: any = { ...prev };
      
      // Map scribe output fields to form fields
      if (scribeFormData.chief_complaint) updates.chief_complaint = scribeFormData.chief_complaint;
      if (scribeFormData.subjective_complaints) updates.subjective_complaints = scribeFormData.subjective_complaints;
      if (scribeFormData.examination_findings) updates.examination_findings = scribeFormData.examination_findings;
      if (scribeFormData.clinical_notes) updates.clinical_notes = scribeFormData.clinical_notes;
      if (scribeFormData.clinical_impression) updates.clinical_impression = scribeFormData.clinical_impression;
      if (scribeFormData.follow_up_plan) updates.follow_up_plan = scribeFormData.follow_up_plan;
      if (scribeFormData.discharge_plan) updates.discharge_plan = scribeFormData.discharge_plan;
      if (scribeFormData.wound_status) updates.wound_status = scribeFormData.wound_status;
      if (scribeFormData.complications) updates.complications = scribeFormData.complications;
      if (scribeFormData.progress_status) updates.progress_status = scribeFormData.progress_status;
      
      // Vitals
      if (scribeFormData.temperature) updates.temperature = String(scribeFormData.temperature);
      if (scribeFormData.pulse) updates.pulse = String(scribeFormData.pulse);
      if (scribeFormData.blood_pressure) updates.blood_pressure = scribeFormData.blood_pressure;
      if (scribeFormData.respiratory_rate) updates.respiratory_rate = String(scribeFormData.respiratory_rate);
      if (scribeFormData.spo2) updates.spo2 = String(scribeFormData.spo2);
      if (scribeFormData.pain_score !== undefined) updates.pain_score = scribeFormData.pain_score;
      
      return updates;
    });
    setShowScribeEditor(false);
    setShowScribePanel(false);
  };

  const handleScribeNoteReady = (note: StructuredNote, session: ScribeSession) => {
    setScribeNote(note);
    setScribeSession(session);
    setShowScribeEditor(true);
  };

  // AI Document Scanner field handler
  const handleScannerFieldsExtracted = (fields: Record<string, any>) => {
    setFormData(prev => {
      const updates: any = { ...prev };
      
      // Map SOAP fields
      if (fields.subjective) updates.subjective = fields.subjective;
      if (fields.objective || fields.findings || fields.examination_findings) {
        updates.findings = fields.objective || fields.findings || fields.examination_findings;
      }
      if (fields.assessment) updates.assessment = fields.assessment;
      if (fields.plan || fields.management_plan) {
        updates.plan = fields.plan || fields.management_plan;
      }
      if (fields.clinical_status) updates.clinical_status = fields.clinical_status;
      
      // Map vitals
      if (fields.vital_signs) {
        const v = fields.vital_signs;
        if (v.temperature) updates.temperature = String(v.temperature);
        if (v.pulse) updates.pulse = String(v.pulse);
        if (v.bloodPressure) updates.blood_pressure = v.bloodPressure;
        else if (v.bp_systolic) updates.blood_pressure = `${v.bp_systolic}/${v.bp_diastolic || ''}`;
        if (v.respiratoryRate) updates.respiratory_rate = String(v.respiratoryRate);
        if (v.oxygenSaturation) updates.spo2 = String(v.oxygenSaturation);
        if (v.painScore != null) updates.pain_score = v.painScore;
        if (v.weight) updates.weight = String(v.weight);
      }
      
      // Map medications
      if (fields.medications && Array.isArray(fields.medications)) {
        const newMeds = fields.medications.map((m: any) => ({
          name: m.name || '',
          dose: m.dose || '',
          route: m.route || 'oral',
          frequency: m.frequency || '',
          duration: m.duration || '',
        }));
        updates.new_medications = [...prev.new_medications, ...newMeds];
      }
      
      // Map investigations
      if (fields.investigations && Array.isArray(fields.investigations)) {
        const newInvs = fields.investigations.map((inv: any) => inv.name || inv.test_name || '').filter(Boolean);
        updates.investigations_ordered = [...prev.investigations_ordered, ...newInvs];
      }
      
      // Map diagnoses
      if (fields.diagnoses && Array.isArray(fields.diagnoses) && fields.diagnoses.length > 0) {
        updates.assessment = (prev.assessment ? prev.assessment + '\n\nDiagnoses: ' : 'Diagnoses: ') + fields.diagnoses.join(', ');
      }
      
      // Map diet/activity/notes
      if (fields.diet) updates.diet = fields.diet;
      if (fields.activity) updates.activity = fields.activity;
      if (fields.notes) {
        updates.additional_notes = (prev.additional_notes || '') + '\n' + fields.notes;
      }
      
      return updates;
    });
  };

  // Clinical Image handling functions
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, imageType: ClinicalImage['type']) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        const newImage: ClinicalImage = {
          id: crypto.randomUUID(),
          type: imageType,
          filename: file.name,
          data: base64Data,
          caption: '',
          timestamp: new Date().toISOString()
        };
        
        setClinicalImages(prev => [...prev, newImage]);
        setFormData(prev => ({
          ...prev,
          clinical_images: [...prev.clinical_images, newImage]
        }));
      };
      
      reader.readAsDataURL(file);
    }
    
    // Reset input
    e.target.value = '';
  };

  const removeImage = (imageId: string) => {
    setClinicalImages(prev => prev.filter(img => img.id !== imageId));
    setFormData(prev => ({
      ...prev,
      clinical_images: prev.clinical_images.filter(img => img.id !== imageId)
    }));
  };

  const updateImageCaption = (imageId: string, caption: string) => {
    setClinicalImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, caption } : img
    ));
    setFormData(prev => ({
      ...prev,
      clinical_images: prev.clinical_images.map(img => 
        img.id === imageId ? { ...img, caption } : img
      )
    }));
  };

  const performOCR = async (imageId: string) => {
    const image = clinicalImages.find(img => img.id === imageId);
    if (!image) return;

    setIsProcessingOCR(true);
    setOcrProgress(0);

    try {
      const ocrResult = await ocrService.extractText(
        image.data,
        'general',
        (p) => setOcrProgress(Math.round(p.progress * 100))
      );

      const extractedText = ocrResult.text;
      
      if (!extractedText || extractedText.trim().length === 0) {
        alert('No text could be extracted from this image. Try a clearer image.');
        setIsProcessingOCR(false);
        setOcrProgress(0);
        return;
      }

      // Update the image with extracted text
      setClinicalImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, extracted_text: extractedText } : img
      ));
      setFormData(prev => ({
        ...prev,
        clinical_images: prev.clinical_images.map(img => 
          img.id === imageId ? { ...img, extracted_text: extractedText } : img
        ),
        ocr_extracted_text: prev.ocr_extracted_text + '\n\n' + extractedText
      }));

      alert('Text extracted successfully!');
    } catch (error) {
      console.error('OCR Error:', error);
      alert('Error extracting text. Please try again.');
    } finally {
      setIsProcessingOCR(false);
      setOcrProgress(0);
    }
  };

  const getImageTypeLabel = (type: ClinicalImage['type']) => {
    switch (type) {
      case 'wound_photo': return 'Wound Photo';
      case 'lab_result': return 'Lab Result';
      case 'imaging': return 'Imaging';
      case 'handwritten_note': return 'Handwritten Note';
      default: return 'Other';
    }
  };

  const tabs = [
    { id: 'patient', label: 'Patient Selection', icon: User },
    { id: 'subjective', label: 'Subjective', icon: FileText },
    { id: 'vitals', label: 'Vitals & Examination', icon: Activity },
    { id: 'clinical_images', label: 'Clinical Images', icon: Camera },
    { id: 'assessment', label: 'Clinical Assessment', icon: Stethoscope },
    { id: 'plan', label: 'Management Plan', icon: ClipboardList },
    { id: 'lab_work', label: 'Lab Work', icon: TestTube },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'treatment_plan', label: 'Treatment Plan', icon: Edit3, show: !!patientTreatmentPlan },
    { id: 'followup', label: 'Follow-up', icon: TrendingUp }
  ].filter(tab => tab.show !== false);

  return createPortal(
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl w-full sm:max-w-6xl h-full sm:h-[95vh] sm:max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-start sm:items-center flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-2xl font-bold truncate">
              {wardRoundId ? 'Edit Ward Round' : 'New Ward Round'}
            </h2>
            {selectedPatient && (
              <p className="text-green-100 text-xs sm:text-sm mt-1 truncate">
                {selectedPatient.first_name} {selectedPatient.last_name} • {selectedPatient.hospital_number}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 ml-2">
            {selectedPatient && (
              <button
                type="button"
                onClick={() => { setScannerDocType('general'); setShowDocumentScanner(true); }}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
                title="Scan a document and auto-fill ward round fields"
              >
                <Camera className="w-4 h-4" />
                <span className="hidden sm:inline">Scan &amp; Autofill</span>
                <span className="sm:hidden">Scan</span>
              </button>
            )}
            {selectedPatient && (
              <button
                type="button"
                onClick={() => setShowScribePanel(true)}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors text-xs sm:text-sm font-medium"
                title="AI Medical Scribe - Record and auto-fill"
              >
                <Mic className="w-4 h-4" />
                <span className="hidden sm:inline">AI Scribe</span>
                <span className="sm:hidden">Scribe</span>
              </button>
            )}
            <button onClick={onClose} className="text-white hover:text-gray-200">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <div className="tabs-touch-scroll">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-green-600 text-green-600 bg-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 scroll-touch">
          <div className="p-3 sm:p-6">
            {/* Patient Selection Tab */}
            {activeTab === 'patient' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Patient *
                  </label>
                  <select
                    value={formData.patient_id}
                    onChange={(e) => {
                      setFormData({ ...formData, patient_id: e.target.value });
                      loadPatientDetails(e.target.value);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.id}>
                        {patient.first_name} {patient.last_name} - {patient.hospital_number}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedPatient && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Patient Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Age:</span>
                        <span className="ml-2 font-medium">{selectedPatient.age} years</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Gender:</span>
                        <span className="ml-2 font-medium">{selectedPatient.gender}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Blood Group:</span>
                        <span className="ml-2 font-medium">{selectedPatient.blood_group || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Diagnosis:</span>
                        <span className="ml-2 font-medium">{selectedPatient.diagnosis || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Round Date *
                    </label>
                    <input
                      type="date"
                      value={formData.round_date}
                      onChange={(e) => setFormData({ ...formData, round_date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Round Time *
                    </label>
                    <input
                      type="time"
                      value={formData.round_time}
                      onChange={(e) => setFormData({ ...formData, round_time: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>
                </div>

                {/* Round Type Selection */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Round Type
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {ROUND_TYPES.map(rt => (
                      <label
                        key={rt.value}
                        className={`flex items-start p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          formData.round_type === rt.value
                            ? 'border-purple-500 bg-purple-100'
                            : 'border-gray-200 hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="round_type"
                          value={rt.value}
                          checked={formData.round_type === rt.value}
                          onChange={(e) => setFormData({ ...formData, round_type: e.target.value as RoundType })}
                          className="mt-1 mr-3"
                        />
                        <div>
                          <div className="font-medium text-gray-800">{rt.label}</div>
                          <div className="text-sm text-gray-600">{rt.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Doctor Role */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Role *
                    </label>
                    <select
                      value={formData.doctor_role}
                      onChange={(e) => setFormData({ ...formData, doctor_role: e.target.value as any })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    >
                      <option value="house_officer">House Officer / Intern</option>
                      <option value="registrar">Registrar</option>
                      <option value="senior_registrar">Senior Registrar</option>
                      <option value="consultant">Consultant</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Accompanying Team Members
                    </label>
                    <input
                      type="text"
                      placeholder="Separate names with commas"
                      value={formData.accompanying_team?.join(', ') || ''}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        accompanying_team: e.target.value.split(',').map(s => s.trim()).filter(s => s) 
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Subjective Tab */}
            {activeTab === 'subjective' && (
              <div className="space-y-4">
                {/* LMP Field for Female Patients */}
                {selectedPatient && (selectedPatient.sex?.toLowerCase() === 'female' || selectedPatient.sex?.toLowerCase() === 'f' || selectedPatient.gender?.toLowerCase() === 'female' || selectedPatient.gender?.toLowerCase() === 'f') && (
                  <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-pink-900 mb-2 flex items-center">
                      LMP (Last Menstrual Period)
                      <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Required</span>
                    </label>
                    <input
                      type="date"
                      value={formData.lmp}
                      onChange={(e) => setFormData({ ...formData, lmp: e.target.value })}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full sm:w-1/2 px-4 py-2 border border-pink-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                      required
                    />
                    {formData.lmp && (
                      <p className="text-xs text-pink-700 mt-1">
                        {Math.floor((new Date().getTime() - new Date(formData.lmp).getTime()) / (1000 * 60 * 60 * 24))} days ago
                      </p>
                    )}
                  </div>
                )}

                <MedicalTextInput
                  value={formData.subjective_complaints}
                  onChange={(value) => setFormData({ ...formData, subjective_complaints: value })}
                  label="Patient Complaints"
                  placeholder="What is the patient complaining about? (Use voice dictation or type)"
                  rows={3}
                  context="progress_notes"
                  showWordCount
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pain Score (0-10)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={formData.pain_score}
                      onChange={(e) => setFormData({ ...formData, pain_score: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      {formData.pain_score === 0 && "No pain"}
                      {formData.pain_score > 0 && formData.pain_score <= 3 && "Mild pain"}
                      {formData.pain_score > 3 && formData.pain_score <= 6 && "Moderate pain"}
                      {formData.pain_score > 6 && formData.pain_score <= 10 && "Severe pain"}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sleep Quality
                    </label>
                    <select
                      value={formData.sleep_quality}
                      onChange={(e) => setFormData({ ...formData, sleep_quality: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="disturbed">Disturbed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Appetite
                    </label>
                    <select
                      value={formData.appetite}
                      onChange={(e) => setFormData({ ...formData, appetite: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="none">None</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bowel Movement
                    </label>
                    <select
                      value={formData.bowel_movement}
                      onChange={(e) => setFormData({ ...formData, bowel_movement: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="constipated">Constipated</option>
                      <option value="diarrhea">Diarrhea</option>
                      <option value="not_opened">Not Opened</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Vitals & Examination Tab */}
            {activeTab === 'vitals' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Vital Signs</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Temperature (°C)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={formData.temperature}
                        onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="37.0"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pulse (bpm)
                      </label>
                      <input
                        type="number"
                        value={formData.pulse}
                        onChange={(e) => setFormData({ ...formData, pulse: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="80"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Blood Pressure (mmHg)
                      </label>
                      <input
                        type="text"
                        value={formData.blood_pressure}
                        onChange={(e) => setFormData({ ...formData, blood_pressure: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="120/80"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Respiratory Rate (per min)
                      </label>
                      <input
                        type="number"
                        value={formData.respiratory_rate}
                        onChange={(e) => setFormData({ ...formData, respiratory_rate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="18"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SpO2 (%)
                      </label>
                      <input
                        type="number"
                        value={formData.spo2}
                        onChange={(e) => setFormData({ ...formData, spo2: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        placeholder="98"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Physical Examination</h3>
                  <div className="space-y-4">
                    <MedicalTextInput
                      value={formData.general_appearance}
                      onChange={(value) => setFormData({ ...formData, general_appearance: value })}
                      label="General Appearance"
                      placeholder="Patient looks well, comfortable, no distress..."
                      rows={2}
                      context="clinical_notes"
                    />

                    <MedicalTextInput
                      value={formData.wound_status}
                      onChange={(value) => setFormData({ ...formData, wound_status: value })}
                      label="Wound Status"
                      placeholder="Wound clean, dry, no signs of infection..."
                      rows={2}
                      context="wound_assessment"
                    />

                    <MedicalTextInput
                      value={formData.drain_output}
                      onChange={(value) => setFormData({ ...formData, drain_output: value })}
                      label="Drain Output"
                      placeholder="Drain 1: 50ml serosanguinous fluid..."
                      rows={2}
                      context="clinical_notes"
                    />

                    <MedicalTextInput
                      value={formData.mobility_status}
                      onChange={(value) => setFormData({ ...formData, mobility_status: value })}
                      label="Mobility Status"
                      placeholder="Ambulating with assistance, ROM exercises..."
                      rows={2}
                      context="clinical_notes"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Clinical Images Tab */}
            {activeTab === 'clinical_images' && (
              <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">📷 Clinical Documentation</h3>
                  <p className="text-sm text-blue-700">
                    Upload wound photographs, laboratory results, imaging studies, or handwritten notes. 
                    Use the OCR feature to extract text from handwritten notes for faster documentation.
                  </p>
                </div>

                {/* AI Document Scanner - ABBYY FineReader style */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-300 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <Brain className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-800">🔬 AI Document Scanner</h3>
                        <p className="text-xs text-green-600">
                          Scan or photograph clinical documents — AI auto-identifies text and fills form fields
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDocumentScanner(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 shadow-sm transition font-medium"
                    >
                      <FileSearch className="h-4 w-4" />
                      <span>Scan Document</span>
                    </button>
                  </div>
                </div>

                {/* Upload Buttons */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'wound_photo')}
                  />
                  <input
                    type="file"
                    ref={cameraInputRef}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, 'wound_photo')}
                  />
                  
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-green-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
                  >
                    <Camera className="w-8 h-8 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Take Photo</span>
                    <span className="text-xs text-gray-500">Wound/Clinical</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e) => handleImageUpload(e as any, 'wound_photo');
                      input.click();
                    }}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-red-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Image className="w-8 h-8 text-red-600" />
                    <span className="text-sm font-medium text-red-700">Wound Photo</span>
                    <span className="text-xs text-gray-500">From Gallery</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e) => handleImageUpload(e as any, 'lab_result');
                      input.click();
                    }}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="w-8 h-8 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Lab Results</span>
                    <span className="text-xs text-gray-500">Upload Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.multiple = true;
                      input.onchange = (e) => handleImageUpload(e as any, 'handwritten_note');
                      input.click();
                    }}
                    className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors"
                  >
                    <FileSearch className="w-8 h-8 text-purple-600" />
                    <span className="text-sm font-medium text-purple-700">Handwritten Note</span>
                    <span className="text-xs text-gray-500">With OCR</span>
                  </button>
                </div>

                {/* Uploaded Images Grid */}
                {clinicalImages.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Uploaded Images ({clinicalImages.length})</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {clinicalImages.map((image) => (
                        <div key={image.id} className="border rounded-lg overflow-hidden bg-white shadow-sm">
                          <div className="relative">
                            <img
                              src={image.data}
                              alt={image.caption || image.filename}
                              className="w-full h-48 object-cover"
                            />
                            <span className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                              image.type === 'wound_photo' ? 'bg-red-100 text-red-800' :
                              image.type === 'lab_result' ? 'bg-blue-100 text-blue-800' :
                              image.type === 'handwritten_note' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getImageTypeLabel(image.type)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeImage(image.id)}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="p-3 space-y-2">
                            <input
                              type="text"
                              value={image.caption || ''}
                              onChange={(e) => updateImageCaption(image.id, e.target.value)}
                              placeholder="Add caption..."
                              className="w-full px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-xs text-gray-500">
                              {format(new Date(image.timestamp), 'dd/MM/yyyy HH:mm')}
                            </p>
                            
                            {/* OCR Button for handwritten notes */}
                            {(image.type === 'handwritten_note' || image.type === 'lab_result') && (
                              <button
                                type="button"
                                onClick={() => performOCR(image.id)}
                                disabled={isProcessingOCR}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                              >
                                {isProcessingOCR ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Extracting... {ocrProgress}%
                                  </>
                                ) : (
                                  <>
                                    <FileSearch className="w-4 h-4" />
                                    Extract Text (OCR)
                                  </>
                                )}
                              </button>
                            )}
                            
                            {/* Display extracted text */}
                            {image.extracted_text && (
                              <div className="mt-2 p-2 bg-gray-50 rounded border">
                                <p className="text-xs font-medium text-gray-700 mb-1">Extracted Text:</p>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{image.extracted_text}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Text Summary */}
                {formData.ocr_extracted_text && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 mb-2">📝 Combined Extracted Text</h4>
                    <MedicalTextInput
                      value={formData.ocr_extracted_text}
                      onChange={(value) => setFormData({ ...formData, ocr_extracted_text: value })}
                      placeholder="Text extracted from handwritten notes will appear here..."
                      rows={6}
                      context="lab_interpretation"
                      showOCR={false}
                      documentType="lab_report"
                      helperText="You can edit the extracted text or use AI to polish it"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Clinical Assessment Tab */}
            {activeTab === 'assessment' && (
              <div className="space-y-4">
                <MedicalTextInput
                  value={formData.clinical_impression}
                  onChange={(value) => setFormData({ ...formData, clinical_impression: value })}
                  label="Clinical Impression"
                  placeholder="Overall assessment of patient's condition..."
                  rows={4}
                  context="clinical_notes"
                  showWordCount
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Progress Status
                  </label>
                  <select
                    value={formData.progress_status}
                    onChange={(e) => setFormData({ ...formData, progress_status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="improving">Improving</option>
                    <option value="stable">Stable</option>
                    <option value="deteriorating">Deteriorating</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <MedicalTextInput
                  value={formData.complications}
                  onChange={(value) => setFormData({ ...formData, complications: value })}
                  label="Complications (if any)"
                  placeholder="Any complications or concerns..."
                  rows={3}
                  context="clinical_notes"
                />
              </div>
            )}

            {/* Management Plan Tab */}
            {activeTab === 'plan' && (
              <div className="space-y-4">
                {/* Reference card: always visible in create-mode so the user knows what was carried over (or that nothing was). */}
                {!wardRoundId && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <Edit3 className="w-4 h-4 mt-0.5 text-amber-700 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-amber-900">Previous Management Plan</p>
                          <p className="text-xs text-amber-700 break-words">
                            {!selectedPatient
                              ? 'Select a patient on the Patient Selection tab to load the last plan.'
                              : previousRound
                                ? `${previousRound.round_date ? new Date(previousRound.round_date).toLocaleString() : 'Last round'} \u00b7 ${previousRound.round_type || 'round'}${previousRound.reviewing_doctor ? ` \u00b7 ${previousRound.reviewing_doctor}` : ''}`
                                : 'No previous ward round on file for this patient \u2014 this will be the first.'}
                          </p>
                          {patientTreatmentPlan && (
                            <p className="text-[11px] text-amber-800 mt-1">
                              Active treatment plan: <span className="font-medium">{patientTreatmentPlan.current_phase || 'phase n/a'}</span>
                              {' \u00b7 '}<span className="capitalize">{patientTreatmentPlan.status || 'status n/a'}</span>
                              {patientTreatmentPlan.updated_at ? ` \u00b7 updated ${format(new Date(patientTreatmentPlan.updated_at), 'dd MMM yyyy')}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                      {previousRound && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            treatment_plan_changes: previousRound.treatment_plan_changes || prev.treatment_plan_changes,
                            dietary_modifications: previousRound.dietary_modifications || prev.dietary_modifications,
                            activity_orders: previousRound.activity_orders || prev.activity_orders,
                            nursing_instructions: previousRound.nursing_instructions || prev.nursing_instructions,
                            follow_up_plan: previousRound.follow_up_plan || prev.follow_up_plan,
                          }))}
                          className="text-xs px-3 py-1.5 bg-amber-600 text-white rounded hover:bg-amber-700 flex-shrink-0"
                        >
                          Continue All
                        </button>
                      )}
                    </div>
                    {previousRound ? (
                      (() => {
                        const labels: Record<string, string> = {
                          treatment_plan_changes: 'Treatment Plan',
                          dietary_modifications: 'Dietary',
                          activity_orders: 'Activity',
                          nursing_instructions: 'Nursing',
                          follow_up_plan: 'Follow-up'
                        };
                        const fields = ['treatment_plan_changes', 'dietary_modifications', 'activity_orders', 'nursing_instructions', 'follow_up_plan'] as const;
                        const hasAny = fields.some(f => ((previousRound as any)[f] || '').trim());
                        if (!hasAny) {
                          return <div className="text-xs text-amber-700 italic">Previous round had no management-plan entries.</div>;
                        }
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {fields.map(field => {
                              const val: string = (previousRound as any)[field] || '';
                              if (!val.trim()) return null;
                              return (
                                <div key={field} className="bg-white border border-amber-200 rounded p-2">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-medium text-gray-700">{labels[field]}</span>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        title="Replace current field with this"
                                        onClick={() => setFormData(prev => ({ ...prev, [field]: val }))}
                                        className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
                                      >Copy</button>
                                      <button
                                        type="button"
                                        title="Append to current field"
                                        onClick={() => setFormData(prev => ({
                                          ...prev,
                                          [field]: ((prev as any)[field] ? `${(prev as any)[field]}\n` : '') + val
                                        }))}
                                        className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                                      >Append</button>
                                    </div>
                                  </div>
                                  <p className="text-gray-700 whitespace-pre-wrap line-clamp-3">{val}</p>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-xs text-amber-700">
                        {selectedPatient
                          ? 'No previous round to reference. Your entries below will be saved as the first management plan for this patient.'
                          : 'Once a patient is selected, the most recent ward-round plan and active treatment plan summary will appear here.'}
                      </div>
                    )}
                  </div>
                )}
                <MedicalTextInput
                  value={formData.treatment_plan_changes}
                  onChange={(value) => setFormData({ ...formData, treatment_plan_changes: value })}
                  label="Treatment Plan Changes"
                  placeholder="Any changes to the treatment plan..."
                  rows={3}
                  context="clinical_notes"
                />

                <MedicalTextInput
                  value={formData.dietary_modifications}
                  onChange={(value) => setFormData({ ...formData, dietary_modifications: value })}
                  label="Dietary Modifications"
                  placeholder="Dietary changes or restrictions..."
                  rows={2}
                  context="general"
                  showAIEnhance={false}
                />

                <MedicalTextInput
                  value={formData.activity_orders}
                  onChange={(value) => setFormData({ ...formData, activity_orders: value })}
                  label="Activity Orders"
                  placeholder="Bed rest, ambulation, physiotherapy..."
                  rows={2}
                  context="general"
                  showAIEnhance={false}
                />

                <MedicalTextInput
                  value={formData.nursing_instructions}
                  onChange={(value) => setFormData({ ...formData, nursing_instructions: value })}
                  label="Nursing Instructions"
                  placeholder="Special instructions for nursing staff..."
                  rows={3}
                  context="clinical_notes"
                />

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <TestTube className="w-5 h-5 text-green-600" />
                    Investigations Ordered
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowInvestigationModal(true)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                  >
                    <TestTube className="w-5 h-5" />
                    Order & Track Investigations ({orderedInvestigations.length})
                  </button>
                  
                  {/* Investigation Summary */}
                  {orderedInvestigations.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {orderedInvestigations.map((inv: any, index: number) => (
                        <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-blue-900">{inv.test_name}</span>
                              <span className="ml-2 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                                {inv.priority?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {inv.status}
                            </span>
                          </div>
                          {inv.results && inv.results.length > 0 && (
                            <div className="mt-2 text-sm text-gray-700">
                              <span className="font-medium">Results: </span>
                              {inv.results.length} parameter(s) recorded
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-green-600" />
                    Medications Ordered
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowMedicationModal(true)}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center justify-center gap-2"
                  >
                    <Pill className="w-5 h-5" />
                    Order Medications ({orderedMedications.length})
                  </button>
                  
                  {/* Medication Summary */}
                  {orderedMedications.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {orderedMedications.map((med: any, index: number) => (
                        <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="font-medium text-green-900">{med.medication_name}</div>
                          <div className="text-sm text-gray-700 mt-1">
                            {med.dosage} {med.route?.toUpperCase()} {med.frequency}
                            {med.duration && <span className="ml-2">for {med.duration}</span>}
                          </div>
                          {med.indication && (
                            <div className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">Indication:</span> {med.indication}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Investigations Ordered (Legacy)</h3>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newInvestigation}
                      onChange={(e) => setNewInvestigation(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., FBC, RFT, Wound swab..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInvestigation())}
                    />
                    <button
                      type="button"
                      onClick={addInvestigation}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Add
                    </button>
                  </div>
                  {formData.investigations_ordered.length > 0 && (
                    <div className="space-y-1">
                      {formData.investigations_ordered.map((inv, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                          <span>{inv}</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              investigations_ordered: prev.investigations_ordered.filter((_, i) => i !== index)
                            }))}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Procedures Planned</h3>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newProcedure}
                      onChange={(e) => setNewProcedure(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Wound debridement, Drain removal..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProcedure())}
                    />
                    <button
                      type="button"
                      onClick={addProcedure}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Add
                    </button>
                  </div>
                  {formData.procedures_planned.length > 0 && (
                    <div className="space-y-1">
                      {formData.procedures_planned.map((proc, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded">
                          <span>{proc}</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              procedures_planned: prev.procedures_planned.filter((_, i) => i !== index)
                            }))}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lab Work / Investigations Tab */}
            {activeTab === 'lab_work' && (
              <div className="space-y-6">
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-teal-900 mb-2 flex items-center gap-2">
                    <TestTube className="w-5 h-5" />
                    Request Lab Work / Investigations
                  </h3>
                  <p className="text-sm text-teal-700">Order investigations, track results and review lab work for this patient.</p>
                </div>

                {/* Quick Investigation Orders */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Quick Order Common Investigations</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['FBC', 'E/U/Cr', 'LFT', 'RBS', 'Urinalysis', 'Blood Group & Cross-match', 'Wound Swab M/C/S', 'Clotting Profile', 'Serum Protein', 'HIV Screening', 'HBsAg', 'HCV'].map(test => {
                      const isOrdered = formData.investigations_ordered.includes(test) || orderedInvestigations.some((inv: any) => inv.test_name === test);
                      return (
                        <button
                          key={test}
                          type="button"
                          onClick={() => {
                            if (!isOrdered) {
                              setFormData(prev => ({
                                ...prev,
                                investigations_ordered: [...prev.investigations_ordered, test]
                              }));
                            }
                          }}
                          disabled={isOrdered}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isOrdered
                              ? 'bg-green-100 text-green-800 border border-green-300 cursor-default'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-teal-50 hover:border-teal-400'
                          }`}
                        >
                          {isOrdered ? '✓ ' : '+ '}{test}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Full Investigation Ordering Modal */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowInvestigationModal(true)}
                    className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium flex items-center justify-center gap-2"
                  >
                    <TestTube className="w-5 h-5" />
                    Advanced Investigation Ordering & Results ({orderedInvestigations.length})
                  </button>
                </div>

                {/* Ordered investigations summary */}
                {orderedInvestigations.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Tracked Investigations</h4>
                    <div className="space-y-2">
                      {orderedInvestigations.map((inv: any, index: number) => (
                        <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-blue-900">{inv.test_name}</span>
                              <span className="ml-2 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                                {inv.priority?.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {inv.status}
                            </span>
                          </div>
                          {inv.results && inv.results.length > 0 && (
                            <div className="mt-2 text-sm text-gray-700">
                              <span className="font-medium">Results: </span>
                              {inv.results.length} parameter(s) recorded
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Simple text-based investigation list */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Additional Investigations</h4>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newInvestigation}
                      onChange={(e) => setNewInvestigation(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                      placeholder="Type investigation name and press Enter..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addInvestigation())}
                    />
                    <button
                      type="button"
                      onClick={addInvestigation}
                      className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                    >
                      Add
                    </button>
                  </div>
                  {formData.investigations_ordered.length > 0 && (
                    <div className="space-y-1">
                      {formData.investigations_ordered.map((inv, index) => (
                        <div key={index} className="flex items-center justify-between bg-teal-50 px-3 py-2 rounded border border-teal-200">
                          <span className="text-teal-900">{inv}</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              investigations_ordered: prev.investigations_ordered.filter((_, i) => i !== index)
                            }))}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Lab notes */}
                <MedicalTextInput
                  value={formData.lab_notes || ''}
                  onChange={(value) => setFormData({ ...formData, lab_notes: value })}
                  label="Lab Notes / Special Instructions"
                  placeholder="Any special instructions for the lab, fasting requirements, timing, etc..."
                  rows={3}
                  context="general"
                  showAIEnhance={false}
                />
              </div>
            )}

            {/* Medications Tab */}
            {activeTab === 'medications' && (
              <div className="space-y-6">
                {/* BNF Drug Search */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                    <Pill className="w-5 h-5" />
                    BNF Medication Search
                  </h3>
                  <p className="text-sm text-indigo-700 mb-3">Search the BNF database to find medications with dosing information.</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={bnfSearchQuery}
                      onChange={(e) => {
                        const q = e.target.value;
                        setBnfSearchQuery(q);
                        if (q.length >= 2) {
                          setBnfSearchResults(searchDrugs(q).slice(0, 15));
                          setShowBnfDropdown(true);
                        } else {
                          setBnfSearchResults([]);
                          setShowBnfDropdown(false);
                        }
                        setSelectedBnfDrug(null);
                      }}
                      onFocus={() => {
                        if (bnfSearchResults.length > 0) setShowBnfDropdown(true);
                      }}
                      className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Search medication by name (e.g., Paracetamol, Amoxicillin, Metronidazole)..."
                    />
                    {showBnfDropdown && bnfSearchResults.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {bnfSearchResults.map((drug) => (
                          <button
                            key={drug.id}
                            type="button"
                            onClick={() => {
                              setSelectedBnfDrug(drug);
                              setBnfSearchQuery(drug.genericName);
                              setShowBnfDropdown(false);
                              // Pre-fill medication fields
                              const defaultFormulation = drug.formulations[0];
                              const defaultRoute = defaultFormulation?.route || 'oral';
                              setNewMedication({
                                name: drug.genericName,
                                dose: drug.dosage.adult?.standard || defaultFormulation?.strength || '',
                                frequency: String(drug.dosage.adult?.frequency || 'od'),
                                route: defaultRoute.toLowerCase()
                              });
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{drug.genericName}</div>
                            <div className="text-xs text-gray-500">
                              {drug.brandNames.slice(0, 3).join(', ')} • {drug.category}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Selected Drug Details */}
                  {selectedBnfDrug && (
                    <div className="mt-3 bg-white border border-indigo-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-indigo-900">{selectedBnfDrug.genericName}</h4>
                        <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded">{selectedBnfDrug.category}</span>
                      </div>
                      {selectedBnfDrug.brandNames.length > 0 && (
                        <p className="text-xs text-gray-600">Brands: {selectedBnfDrug.brandNames.join(', ')}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div><span className="text-gray-500">Adult dose:</span> <span className="font-medium">{selectedBnfDrug.dosage.adult?.standard || 'See BNF'}</span></div>
                        <div><span className="text-gray-500">Max daily:</span> <span className="font-medium">{selectedBnfDrug.maxDailyDose || 'N/A'}</span></div>
                        <div><span className="text-gray-500">Pregnancy:</span> <span className={`font-medium ${selectedBnfDrug.pregnancyCategory === 'X' || selectedBnfDrug.pregnancyCategory === 'D' ? 'text-red-600' : ''}`}>Category {selectedBnfDrug.pregnancyCategory}</span></div>
                        <div><span className="text-gray-500">Renal:</span> <span className={`font-medium ${selectedBnfDrug.renalRisk === 'avoid' ? 'text-red-600' : selectedBnfDrug.renalRisk === 'dose_adjust' ? 'text-yellow-600' : ''}`}>{selectedBnfDrug.renalRisk}</span></div>
                      </div>
                      {selectedBnfDrug.contraindications.length > 0 && (
                        <div className="text-xs">
                          <span className="text-red-600 font-medium">Contraindications:</span> {selectedBnfDrug.contraindications.slice(0, 3).join(', ')}
                        </div>
                      )}
                      {selectedBnfDrug.formulations.length > 0 && (
                        <div className="text-xs">
                          <span className="text-gray-500 font-medium">Formulations:</span> {selectedBnfDrug.formulations.map(f => f.form).slice(0, 4).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Add Medication</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                    <input
                      type="text"
                      value={newMedication.name}
                      onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Medication name"
                    />
                    <input
                      type="text"
                      value={newMedication.dose}
                      onChange={(e) => setNewMedication({ ...newMedication, dose: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Dose"
                    />
                    <input
                      type="text"
                      value={newMedication.frequency}
                      onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      placeholder="Frequency"
                    />
                    <select
                      value={newMedication.route}
                      onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option value="oral">Oral</option>
                      <option value="iv">IV</option>
                      <option value="im">IM</option>
                      <option value="sc">SC</option>
                      <option value="topical">Topical</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={addMedication}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Add Medication
                  </button>
                  
                  {formData.new_medications.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formData.new_medications.map((med, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 border border-green-200 px-4 py-3 rounded-lg">
                          <div>
                            <span className="font-medium">{med.name}</span>
                            <span className="text-gray-600 ml-2">{med.dose} - {med.frequency} ({med.route})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMedication(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Treatment Plan Modification Tab */}
            {activeTab === 'treatment_plan' && patientTreatmentPlan && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Current Treatment Plan</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Plan ID:</span>
                      <span className="ml-2 font-medium">{patientTreatmentPlan.id?.substring(0, 8)}...</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <span className={`ml-2 font-medium px-2 py-0.5 rounded ${
                        patientTreatmentPlan.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {patientTreatmentPlan.status}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Phase:</span>
                      <span className="ml-2 font-medium">{patientTreatmentPlan.current_phase || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Last Updated:</span>
                      <span className="ml-2 font-medium">
                        {patientTreatmentPlan.updated_at 
                          ? format(new Date(patientTreatmentPlan.updated_at), 'dd MMM yyyy')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role-based modification capability notice */}
                {authUser?.role === 'consultant' || authUser?.role === 'admin' ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-800 text-sm">
                      <strong>Consultant Access:</strong> Your modifications will be applied immediately to the treatment plan.
                    </p>
                  </div>
                ) : authUser?.role === 'senior_registrar' || authUser?.role === 'junior_registrar' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800 text-sm">
                      <strong>Registrar Access:</strong> Your modifications will be submitted for consultant approval before being applied.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-gray-600 text-sm">
                      Your role does not allow direct treatment plan modifications. Please discuss changes with your supervising registrar or consultant.
                    </p>
                  </div>
                )}

                {/* Treatment Plan Modification Panel */}
                {(authUser?.role === 'consultant' || authUser?.role === 'admin' || 
                  authUser?.role === 'senior_registrar' || authUser?.role === 'junior_registrar') && (
                  <TreatmentPlanModificationPanel
                    planId={patientTreatmentPlan.id}
                    patientId={selectedPatient?.id}
                    patientName={`${selectedPatient?.first_name || ''} ${selectedPatient?.last_name || ''}`}
                    source="ward_round"
                    onModificationSubmitted={() => {
                      // Refresh the treatment plan after modification
                      if (selectedPatient?.id) {
                        loadPatientDetails(selectedPatient.id);
                      }
                    }}
                  />
                )}
              </div>
            )}

            {/* Follow-up Tab */}
            {activeTab === 'followup' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Next Review Date
                  </label>
                  <input
                    type="date"
                    value={formData.next_review_date}
                    onChange={(e) => setFormData({ ...formData, next_review_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <MedicalTextInput
                  value={formData.discharge_plan}
                  onChange={(value) => setFormData({ ...formData, discharge_plan: value })}
                  label="Discharge Plan"
                  placeholder="Expected discharge date, discharge criteria, follow-up arrangements..."
                  rows={4}
                  context="discharge_summary"
                />

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.consultant_notified}
                    onChange={(e) => setFormData({ ...formData, consultant_notified: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    Consultant Notified
                  </label>
                </div>

                <MedicalTextInput
                  value={formData.notes}
                  onChange={(value) => setFormData({ ...formData, notes: value })}
                  label="Additional Notes"
                  placeholder="Any additional notes or observations..."
                  rows={4}
                  context="clinical_notes"
                  showWordCount
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 flex justify-between flex-shrink-0 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm sm:text-base min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 sm:px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm sm:text-base min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              Save Ward Round
            </button>
          </div>
        </form>
      </div>

      {/* Investigation Ordering Modal */}
      {showInvestigationModal && selectedPatient && (
        <InvestigationOrderingModal
          patientId={selectedPatient.id}
          patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
          patientGender={selectedPatient.sex as 'male' | 'female'}
          source="ward_round"
          existingInvestigations={orderedInvestigations}
          onSave={(investigations) => {
            setOrderedInvestigations(investigations);
            setFormData(prev => ({
              ...prev,
              investigations_ordered: [...prev.investigations_ordered, ...investigations.map(inv => inv.test_name)]
            }));
          }}
          onClose={() => setShowInvestigationModal(false)}
        />
      )}

      {/* Medication Ordering Modal */}
      {showMedicationModal && selectedPatient && (
        <MedicationOrderingModal
          patientId={selectedPatient.id}
          patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
          existingMedications={orderedMedications}
          onSave={(medications) => {
            setOrderedMedications(medications);
            setFormData(prev => ({
              ...prev,
              new_medications: [...prev.new_medications, ...medications.map(med => ({
                name: med.medication_name,
                dose: med.dosage,
                frequency: med.frequency,
                route: med.route
              }))]
            }));
          }}
          onClose={() => setShowMedicationModal(false)}
        />
      )}

      {/* AI Medical Scribe Recording Panel */}
      {showScribePanel && selectedPatient && (
        <ScribeRecordingPanel
          patientId={formData.patient_id}
          patientName={`${selectedPatient.first_name} ${selectedPatient.last_name}`}
          hospitalNumber={selectedPatient.hospital_number || ''}
          context="ward_round"
          roundType={formData.round_type}
          recordedBy={formData.reviewing_doctor || authUser?.name || 'Unknown'}
          recordedByRole={formData.doctor_role || 'house_officer'}
          wardRoundId={wardRoundId}
          onNoteReady={handleScribeNoteReady}
          onApplyToForm={handleScribeApplyToForm}
          onClose={() => setShowScribePanel(false)}
        />
      )}

      {/* AI Scribe Note Editor / Review */}
      {showScribeEditor && scribeNote && (
        <ScribeNoteEditor
          note={scribeNote}
          patientName={selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Patient'}
          patientId={selectedPatient?.id}
          onSave={async (editedNote) => {
            if (scribeSession) {
              await medicalScribeService.updateStructuredNote(scribeSession.id, editedNote);
            }
            setShowScribeEditor(false);
          }}
          onApplyToForm={(scribeFormData) => handleScribeApplyToForm(scribeFormData)}
          onClose={() => setShowScribeEditor(false)}
          showApplyButton={true}
        />
      )}

      {/* AI Document Scanner Modal */}
      <DocumentScannerModal
        isOpen={showDocumentScanner}
        onClose={() => setShowDocumentScanner(false)}
        onFieldsExtracted={handleScannerFieldsExtracted}
        documentType={scannerDocType}
        patientContext={selectedPatient ? {
          name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          hospitalNumber: selectedPatient.hospital_number,
          ward: selectedPatient.ward,
          diagnosis: selectedPatient.diagnosis,
        } : undefined}
        targetForm="ward_round"
      />
    </div>,
    document.body
  );
};


export default WardRoundForm;
