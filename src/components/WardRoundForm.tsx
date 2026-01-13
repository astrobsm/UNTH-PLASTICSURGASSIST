import React, { useState, useEffect, useRef } from 'react';
import { X, Save, User, Calendar, FileText, Activity, AlertCircle, TrendingUp, Pill, Stethoscope, ClipboardList, Users, Edit3, Camera, Image, Upload, Trash2, FileSearch, Loader2, TestTube } from 'lucide-react';
import { wardRoundsService, WardRound, ROUND_TYPES, RoundType, ClinicalImage } from '../services/wardRoundsService';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { apiClient } from '../services/apiClient';
import { TreatmentPlanModificationPanel } from './TreatmentPlanModificationPanel';
import { InvestigationOrderingModal } from './InvestigationOrderingModal';
import { MedicationOrderingModal } from './MedicationOrderingModal';
import Tesseract from 'tesseract.js';

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

  const [formData, setFormData] = useState({
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
    const patient = await db.patients.get(patientId);
    setSelectedPatient(patient);
    setFormData(prev => ({ ...prev, patient_id: patientId }));
    
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
    const round = await wardRoundsService.getWardRoundById(wardRoundId);
    if (round) {
      setFormData({
        ...round,
        round_date: format(new Date(round.round_date), 'yyyy-MM-dd'),
        round_time: round.round_time
      });
      loadPatientDetails(round.patient_id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
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
          : undefined
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
      const result = await Tesseract.recognize(
        image.data,
        'eng',
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      const extractedText = result.data.text;
      
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
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'treatment_plan', label: 'Treatment Plan', icon: Edit3, show: !!patientTreatmentPlan },
    { id: 'followup', label: 'Follow-up', icon: TrendingUp }
  ].filter(tab => tab.show !== false);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">
              {wardRoundId ? 'Edit Ward Round' : 'New Ward Round'}
            </h2>
            {selectedPatient && (
              <p className="text-green-100 text-sm mt-1">
                Patient: {selectedPatient.first_name} {selectedPatient.last_name} • {selectedPatient.hospital_number}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors ${
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
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-6">
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
                    <div className="grid grid-cols-2 gap-4 text-sm">
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

                <div className="grid grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Patient Complaints
                  </label>
                  <textarea
                    value={formData.subjective_complaints}
                    onChange={(e) => setFormData({ ...formData, subjective_complaints: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder="What is the patient complaining about?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        General Appearance
                      </label>
                      <textarea
                        value={formData.general_appearance}
                        onChange={(e) => setFormData({ ...formData, general_appearance: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        rows={2}
                        placeholder="Patient looks well, comfortable, no distress..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Wound Status
                      </label>
                      <textarea
                        value={formData.wound_status}
                        onChange={(e) => setFormData({ ...formData, wound_status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        rows={2}
                        placeholder="Wound clean, dry, no signs of infection..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Drain Output
                      </label>
                      <textarea
                        value={formData.drain_output}
                        onChange={(e) => setFormData({ ...formData, drain_output: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        rows={2}
                        placeholder="Drain 1: 50ml serosanguinous fluid..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobility Status
                      </label>
                      <textarea
                        value={formData.mobility_status}
                        onChange={(e) => setFormData({ ...formData, mobility_status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                        rows={2}
                        placeholder="Ambulating with assistance, ROM exercises..."
                      />
                    </div>
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
                    <textarea
                      value={formData.ocr_extracted_text}
                      onChange={(e) => setFormData({ ...formData, ocr_extracted_text: e.target.value })}
                      className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                      rows={6}
                      placeholder="Text extracted from handwritten notes will appear here..."
                    />
                    <p className="text-xs text-purple-600 mt-2">
                      You can edit the extracted text to correct any OCR errors.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Clinical Assessment Tab */}
            {activeTab === 'assessment' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Clinical Impression
                  </label>
                  <textarea
                    value={formData.clinical_impression}
                    onChange={(e) => setFormData({ ...formData, clinical_impression: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={4}
                    placeholder="Overall assessment of patient's condition..."
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complications (if any)
                  </label>
                  <textarea
                    value={formData.complications}
                    onChange={(e) => setFormData({ ...formData, complications: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder="Any complications or concerns..."
                  />
                </div>
              </div>
            )}

            {/* Management Plan Tab */}
            {activeTab === 'plan' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Treatment Plan Changes
                  </label>
                  <textarea
                    value={formData.treatment_plan_changes}
                    onChange={(e) => setFormData({ ...formData, treatment_plan_changes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder="Any changes to the treatment plan..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dietary Modifications
                  </label>
                  <textarea
                    value={formData.dietary_modifications}
                    onChange={(e) => setFormData({ ...formData, dietary_modifications: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={2}
                    placeholder="Dietary changes or restrictions..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Activity Orders
                  </label>
                  <textarea
                    value={formData.activity_orders}
                    onChange={(e) => setFormData({ ...formData, activity_orders: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={2}
                    placeholder="Bed rest, ambulation, physiotherapy..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nursing Instructions
                  </label>
                  <textarea
                    value={formData.nursing_instructions}
                    onChange={(e) => setFormData({ ...formData, nursing_instructions: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={3}
                    placeholder="Special instructions for nursing staff..."
                  />
                </div>

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

            {/* Medications Tab */}
            {activeTab === 'medications' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">New Medications</h3>
                  <div className="grid grid-cols-4 gap-2 mb-2">
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
                  <div className="grid grid-cols-2 gap-4 text-sm">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discharge Plan
                  </label>
                  <textarea
                    value={formData.discharge_plan}
                    onChange={(e) => setFormData({ ...formData, discharge_plan: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={4}
                    placeholder="Expected discharge date, discharge criteria, follow-up arrangements..."
                  />
                </div>

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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    rows={4}
                    placeholder="Any additional notes or observations..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
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
    </div>
  );
};


export default WardRoundForm;
