import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { WHOSafetyChecklistForm } from '../components/procedures/WHOSafetyChecklist';
import { IntraoperativeFindingsForm } from '../components/procedures/IntraoperativeFindings';
import { PostoperativeCareForm } from '../components/procedures/PostoperativeCare';
import { WoundCareAssessmentForm } from '../components/procedures/WoundCareAssessment';
import { SurgicalFitnessScoreForm } from '../components/procedures/SurgicalFitnessScore';
import { MedicalTextInput } from '../components/MedicalTextInput';
import { patientService } from '../services/patientService';
import { schedulingService, SurgeryBooking } from '../services/schedulingService';
import { logDataExport } from '../services/auditLoggingService';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { PS_UNITS } from '../config/psUnits';

export const Procedures: React.FC = () => {
  const navigate = useNavigate();
  const [activeModule, setActiveModule] = useState('overview');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');
  const [patients, setPatients] = useState<any[]>([]);
  const [showNewProcedureModal, setShowNewProcedureModal] = useState(false);
  const [modalKey, setModalKey] = useState(0);
  const [showActionModal, setShowActionModal] = useState<{
    type: 'intraop' | 'reschedule' | 'cancel' | 'postop-plan' | 'postop-note' | null;
    procedure: any;
  }>({ type: null, procedure: null });
  const [sidebarStats, setSidebarStats] = useState({
    todaysProcedures: 0,
    pendingWHO: 0,
    highRisk: 0,
    woundCareDue: 0
  });

  useEffect(() => {
    loadPatients();
    loadSidebarStats();
  }, []);

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadSidebarStats = async () => {
    try {
      const today = new Date();
      const todaysProcedures = await schedulingService.getSurgeryBookings(today);
      const activeProcedures = todaysProcedures.filter(p => 
        p.status === 'scheduled' || p.status === 'confirmed' || p.status === 'in_progress'
      );
      
      setSidebarStats({
        todaysProcedures: activeProcedures.length,
        pendingWHO: activeProcedures.filter(p => !p.pre_op_checklist_completed).length,
        highRisk: 0, // Would need ASA grade tracking in surgery bookings
        woundCareDue: 0
      });
    } catch (error) {
      console.error('Error loading sidebar stats:', error);
    }
  };

  const modules = [
    { id: 'overview', name: 'Overview', icon: '📋', description: 'Procedure management dashboard' }
  ];

  const renderModuleContent = () => {
    return <ProcedureOverview />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="py-3 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">Surgical Procedures</h1>
                <p className="text-gray-600 text-sm sm:text-base mt-1">Comprehensive surgical management and documentation</p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 text-sm"
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} ({patient.hospital_number})
                    </option>
                  ))}
                </select>
                
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => navigate('/booking-register')}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer text-sm whitespace-nowrap"
                  >
                    📋 <span className="hidden sm:inline">Booking </span>Register
                  </button>
                  
                  <button 
                    type="button"
                    onClick={() => {
                      console.log('New Procedure button clicked');
                      setModalKey(prev => prev + 1);
                      setShowNewProcedureModal(true);
                    }}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer text-sm whitespace-nowrap"
                  >
                    + New Procedure
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 sm:gap-6">
          {/* Module Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Procedure Modules</h3>
              </div>
              
              <div className="p-2">
                {modules.map(module => (
                  <button
                    key={module.id}
                    onClick={() => setActiveModule(module.id)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                      activeModule === module.id
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-xl">{module.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{module.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{module.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Today's Procedures</span>
                  <span className="font-semibold text-green-600">{sidebarStats.todaysProcedures}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending WHO Checklists</span>
                  <span className="font-semibold text-orange-600">{sidebarStats.pendingWHO}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">High Risk Patients</span>
                  <span className="font-semibold text-red-600">{sidebarStats.highRisk}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Wound Care Due</span>
                  <span className="font-semibold text-blue-600">{sidebarStats.woundCareDue}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {renderModuleContent()}
          </div>
        </div>
      </div>

      {/* New Procedure Modal */}
      {showNewProcedureModal && <NewProcedureModal key={modalKey} onClose={() => setShowNewProcedureModal(false)} />}
      
      {/* Action Modals */}
      {showActionModal.type === 'intraop' && (
        <IntraoperativeFindingsModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'reschedule' && (
        <RescheduleProcedureModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'cancel' && (
        <CancelProcedureModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'postop-plan' && (
        <PostoperativeTreatmentModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'postop-note' && (
        <PostoperativeNoteModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
    </div>
  );
};

// New Procedure Modal Component
const NewProcedureModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Basic Info
    patient_id: '',
    procedure_type: '',
    procedure_name: '',
    scheduled_date: '',
    scheduled_time: '',
    operating_room: '',
    ps_unit: '' as string,
    surgeon: '',
    anesthesia_type: '',
    estimated_duration: '',
    urgency: 'elective' as 'elective' | 'urgent' | 'emergency',
    notes: '',
    
    // Surgical Fitness Scoring (use empty strings for number inputs to avoid NaN)
    age: '',
    asa_class: '1',
    functional_capacity: '10',
    cardiac_risk_factors: '0',
    respiratory_risk_factors: '0',
    renal_function: '100',
    diabetes: false,
    smoking: false,
    obesity: false,
    
    // Bleeding Risk (use empty strings for number inputs)
    anticoagulant_use: false,
    anticoagulant_type: '',
    antiplatelet_use: false,
    antiplatelet_type: '',
    bleeding_disorder: false,
    bleeding_disorder_type: '',
    liver_disease: false,
    renal_impairment: false,
    recent_bleeding: false,
    platelet_count: '',
    inr: '',
    
    // DVT Risk (Caprini)
    age_41_60: false,
    age_61_74: false,
    age_over_75: false,
    minor_surgery: false,
    major_surgery_over_45min: false,
    varicose_veins: false,
    obesity_bmi_over_25: false,
    malignancy: false,
    history_dvt_pe: false,
    family_history_dvt: false,
    patient_confined_to_bed: false,
    
    // Comorbidities
    comorbidities: [] as string[],
    comorbidity_details: {} as Record<string, { imaging: string; labs: string; medications: string }>,
    
    // Medications affecting surgery
    interfering_medications: [] as string[],
    
    // Preoperative Investigations
    preop_investigations: {
      fbc: false,
      u_e: false,
      lft: false,
      coagulation: false,
      blood_group: false,
      ecg: false,
      chest_xray: false,
      echo: false,
      other: ''
    },
    
    // Clinical Photos
    clinical_photos: [] as Array<{ file: File; preview: string; description: string }>
  });

  const comorbidityOptions = [
    'Hypertension',
    'Diabetes Mellitus',
    'Ischemic Heart Disease',
    'Congestive Heart Failure',
    'Chronic Kidney Disease',
    'Chronic Liver Disease',
    'COPD/Asthma',
    'Malignancy',
    'Cerebrovascular Disease',
    'Thyroid Disorder',
    'Bleeding Disorder',
    'Autoimmune Disease'
  ];

  const interferingMedicationsOptions = [
    'Warfarin',
    'Aspirin',
    'Clopidogrel',
    'Rivaroxaban',
    'Apixaban',
    'NSAIDs',
    'Metformin',
    'ACE Inhibitors',
    'Corticosteroids',
    'Immunosuppressants'
  ];

  const handleComorbidityToggle = (comorbidity: string) => {
    if (formData.comorbidities.includes(comorbidity)) {
      setFormData({
        ...formData,
        comorbidities: formData.comorbidities.filter(c => c !== comorbidity),
        comorbidity_details: Object.keys(formData.comorbidity_details)
          .filter(key => key !== comorbidity)
          .reduce((obj, key) => ({ ...obj, [key]: formData.comorbidity_details[key] }), {})
      });
    } else {
      setFormData({
        ...formData,
        comorbidities: [...formData.comorbidities, comorbidity],
        comorbidity_details: {
          ...formData.comorbidity_details,
          [comorbidity]: { imaging: '', labs: '', medications: '' }
        }
      });
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos = Array.from(files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        description: ''
      }));
      setFormData({
        ...formData,
        clinical_photos: [...formData.clinical_photos, ...newPhotos]
      });
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...formData.clinical_photos];
    URL.revokeObjectURL(newPhotos[index].preview);
    newPhotos.splice(index, 1);
    setFormData({ ...formData, clinical_photos: newPhotos });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only submit on final step
    if (currentStep !== 8) {
      console.log('Form submitted but not on step 8, ignoring');
      return;
    }
    
    try {
      const { user } = useAuthStore.getState();
      const procedureId = `proc-${Date.now()}`;

      // Build procedure record (exclude File objects which can't be stored in IndexedDB)
      const procedureRecord = {
        patient_id: formData.patient_id,
        procedure_name: formData.procedure_name,
        procedure_type: formData.procedure_type,
        scheduled_date: formData.scheduled_date,
        scheduled_time: formData.scheduled_time,
        operating_room: formData.operating_room,
        ps_unit: formData.ps_unit,
        surgeon: formData.surgeon,
        anesthesia_type: formData.anesthesia_type,
        estimated_duration: formData.estimated_duration,
        urgency: formData.urgency,
        notes: formData.notes,
        status: 'scheduled',
        // Surgical fitness scoring
        surgical_fitness: {
          age: formData.age,
          asa_class: formData.asa_class,
          functional_capacity: formData.functional_capacity,
          cardiac_risk_factors: formData.cardiac_risk_factors,
          respiratory_risk_factors: formData.respiratory_risk_factors,
          renal_function: formData.renal_function,
          diabetes: formData.diabetes,
          smoking: formData.smoking,
          obesity: formData.obesity,
        },
        // Bleeding risk
        bleeding_risk: {
          anticoagulant_use: formData.anticoagulant_use,
          anticoagulant_type: formData.anticoagulant_type,
          antiplatelet_use: formData.antiplatelet_use,
          antiplatelet_type: formData.antiplatelet_type,
          bleeding_disorder: formData.bleeding_disorder,
          bleeding_disorder_type: formData.bleeding_disorder_type,
          liver_disease: formData.liver_disease,
          renal_impairment: formData.renal_impairment,
          recent_bleeding: formData.recent_bleeding,
          platelet_count: formData.platelet_count,
          inr: formData.inr,
        },
        // DVT risk (Caprini)
        dvt_risk: {
          age_41_60: formData.age_41_60,
          age_61_74: formData.age_61_74,
          age_over_75: formData.age_over_75,
          minor_surgery: formData.minor_surgery,
          major_surgery_over_45min: formData.major_surgery_over_45min,
          varicose_veins: formData.varicose_veins,
          obesity_bmi_over_25: formData.obesity_bmi_over_25,
          malignancy: formData.malignancy,
          history_dvt_pe: formData.history_dvt_pe,
          family_history_dvt: formData.family_history_dvt,
          patient_confined_to_bed: formData.patient_confined_to_bed,
        },
        comorbidities: formData.comorbidities,
        comorbidity_details: formData.comorbidity_details,
        interfering_medications: formData.interfering_medications,
        preop_investigations: formData.preop_investigations,
        created_by: user?.name || 'Unknown',
        created_at: new Date(),
      };

      // Save to IndexedDB
      const localId = await db.procedures.add(procedureRecord as any);

      // Queue for cloud sync
      await syncService.queueAction('create', 'procedures', localId as number, procedureRecord);

      // Log audit for HIPAA compliance
      if (user && formData.patient_id) {
        await logDataExport(
          user.id,
          user.name,
          user.role,
          'PROCEDURE',
          procedureId,
          'CREATE'
        );
      }
      
      onClose();
    } catch (error) {
      console.error('Error creating procedure:', error);
      alert('Failed to save procedure. Please try again.');
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Basic Procedure Information</h4>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Type</label>
        <select
          required
          value={formData.procedure_type}
          onChange={(e) => setFormData({ ...formData, procedure_type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Select type...</option>
          <option value="reconstructive">Reconstructive Surgery</option>
          <option value="aesthetic">Aesthetic/Cosmetic Surgery</option>
          <option value="hand">Hand Surgery</option>
          <option value="craniofacial">Craniofacial Surgery</option>
          <option value="burn">Burn Surgery</option>
          <option value="microsurgery">Microsurgery</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
        <input
          type="text"
          required
          value={formData.procedure_name}
          onChange={(e) => setFormData({ ...formData, procedure_name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="e.g., Breast Reconstruction, Rhinoplasty"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
          <input
            type="date"
            required
            value={formData.scheduled_date}
            onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time</label>
          <input
            type="time"
            required
            value={formData.scheduled_time}
            onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Operating Room</label>
          <input
            type="text"
            required
            value={formData.operating_room}
            onChange={(e) => setFormData({ ...formData, operating_room: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., OR 1, OR 2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (hours)</label>
          <input
            type="number"
            step="0.5"
            required
            value={formData.estimated_duration}
            onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., 2.5"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">PS Unit</label>
        <select
          value={formData.ps_unit}
          onChange={(e) => {
            const unitId = e.target.value;
            const unit = PS_UNITS.find(u => u.id === unitId);
            setFormData({
              ...formData,
              ps_unit: unitId,
              surgeon: unit ? unit.consultants[0] : formData.surgeon,
            });
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">-- Select Unit --</option>
          {PS_UNITS.map((unit) => (
            <option key={unit.id} value={unit.id}>{unit.name} ({unit.consultants.join(' & ')})</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon</label>
        <select
          required
          value={formData.surgeon}
          onChange={(e) => setFormData({ ...formData, surgeon: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">-- Select Surgeon --</option>
          <option value="Dr Okwesili">Dr Okwesili</option>
          <option value="Dr Nnadi">Dr Nnadi</option>
          <option value="Dr Eze C. B">Dr Eze C. B</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type</label>
        <select
          required
          value={formData.anesthesia_type}
          onChange={(e) => setFormData({ ...formData, anesthesia_type: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Select anesthesia type...</option>
          <option value="general">General Anesthesia</option>
          <option value="regional">Regional Anesthesia</option>
          <option value="local">Local Anesthesia</option>
          <option value="sedation">Conscious Sedation</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
        <select
          value={formData.urgency}
          onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="elective">Elective</option>
          <option value="urgent">Urgent</option>
          <option value="emergency">Emergency</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Additional notes or special requirements..."
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Surgical Fitness Scoring & Risk Assessment</h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient Age</label>
          <input
            type="number"
            value={formData.age || ''}
            onChange={(e) => setFormData({ ...formData, age: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">ASA Class</label>
          <select
            value={String(formData.asa_class || 1)}
            onChange={(e) => setFormData({ ...formData, asa_class: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="1">ASA I - Healthy</option>
            <option value="2">ASA II - Mild systemic disease</option>
            <option value="3">ASA III - Severe systemic disease</option>
            <option value="4">ASA IV - Life-threatening</option>
            <option value="5">ASA V - Moribund</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.diabetes}
            onChange={(e) => setFormData({ ...formData, diabetes: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Diabetes</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.smoking}
            onChange={(e) => setFormData({ ...formData, smoking: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Smoking</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.obesity}
            onChange={(e) => setFormData({ ...formData, obesity: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Obesity (BMI &gt; 30)</span>
        </label>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Bleeding Risk Assessment</h4>
      
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.anticoagulant_use}
          onChange={(e) => setFormData({ ...formData, anticoagulant_use: e.target.checked })}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label className="text-sm font-medium text-gray-700">Patient on Anticoagulants</label>
      </div>

      {formData.anticoagulant_use && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anticoagulant Type</label>
          <input
            type="text"
            value={formData.anticoagulant_type}
            onChange={(e) => setFormData({ ...formData, anticoagulant_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Warfarin, Rivaroxaban"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.antiplatelet_use}
          onChange={(e) => setFormData({ ...formData, antiplatelet_use: e.target.checked })}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label className="text-sm font-medium text-gray-700">Patient on Antiplatelets</label>
      </div>

      {formData.antiplatelet_use && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Antiplatelet Type</label>
          <input
            type="text"
            value={formData.antiplatelet_type}
            onChange={(e) => setFormData({ ...formData, antiplatelet_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Aspirin, Clopidogrel"
          />
        </div>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.bleeding_disorder}
            onChange={(e) => setFormData({ ...formData, bleeding_disorder: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Bleeding Disorder</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.liver_disease}
            onChange={(e) => setFormData({ ...formData, liver_disease: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Liver Disease</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.renal_impairment}
            onChange={(e) => setFormData({ ...formData, renal_impairment: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Renal Impairment</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.recent_bleeding}
            onChange={(e) => setFormData({ ...formData, recent_bleeding: e.target.checked })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm text-gray-700">Recent Bleeding</span>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Platelet Count (×10⁹/L)</label>
          <input
            type="number"
            value={formData.platelet_count || ''}
            onChange={(e) => setFormData({ ...formData, platelet_count: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Normal: 150-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">INR</label>
          <input
            type="number"
            step="0.1"
            value={formData.inr || ''}
            onChange={(e) => setFormData({ ...formData, inr: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Normal: 0.8-1.2"
          />
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">DVT Risk Assessment (Caprini Score)</h4>
      
      <div className="space-y-3">
        <div className="bg-blue-50 p-3 rounded">
          <p className="text-sm font-medium text-blue-900 mb-2">Age Factors</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.age_41_60}
                onChange={(e) => setFormData({ ...formData, age_41_60: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Age 41-60 years (1 point)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.age_61_74}
                onChange={(e) => setFormData({ ...formData, age_61_74: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Age 61-74 years (2 points)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.age_over_75}
                onChange={(e) => setFormData({ ...formData, age_over_75: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Age ≥75 years (3 points)</span>
            </label>
          </div>
        </div>

        <div className="bg-green-50 p-3 rounded">
          <p className="text-sm font-medium text-green-900 mb-2">Surgery Factors</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.minor_surgery}
                onChange={(e) => setFormData({ ...formData, minor_surgery: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Minor surgery (&lt;45 min) (1 point)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.major_surgery_over_45min}
                onChange={(e) => setFormData({ ...formData, major_surgery_over_45min: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Major surgery (&gt;45 min) (2 points)</span>
            </label>
          </div>
        </div>

        <div className="bg-yellow-50 p-3 rounded">
          <p className="text-sm font-medium text-yellow-900 mb-2">Medical Factors</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.obesity_bmi_over_25}
                onChange={(e) => setFormData({ ...formData, obesity_bmi_over_25: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Obesity (BMI &gt;25) (1 point)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.varicose_veins}
                onChange={(e) => setFormData({ ...formData, varicose_veins: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Varicose veins (1 point)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.malignancy}
                onChange={(e) => setFormData({ ...formData, malignancy: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Malignancy (2 points)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.patient_confined_to_bed}
                onChange={(e) => setFormData({ ...formData, patient_confined_to_bed: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Patient confined to bed (&gt;72h) (2 points)</span>
            </label>
          </div>
        </div>

        <div className="bg-red-50 p-3 rounded">
          <p className="text-sm font-medium text-red-900 mb-2">History Factors (High Risk)</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.history_dvt_pe}
                onChange={(e) => setFormData({ ...formData, history_dvt_pe: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">History of DVT/PE (3 points)</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.family_history_dvt}
                onChange={(e) => setFormData({ ...formData, family_history_dvt: e.target.checked })}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Family history of DVT (3 points)</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Comorbidities & Required Investigations</h4>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Comorbidities</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {comorbidityOptions.map(comorbidity => (
            <label key={comorbidity} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData.comorbidities.includes(comorbidity)}
                onChange={() => handleComorbidityToggle(comorbidity)}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">{comorbidity}</span>
            </label>
          ))}
        </div>
      </div>

      {formData.comorbidities.length > 0 && (
        <div className="space-y-4 mt-4">
          <h5 className="font-medium text-gray-900">Required Investigations for Selected Comorbidities</h5>
          {formData.comorbidities.map(comorbidity => (
            <div key={comorbidity} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h6 className="font-medium text-gray-900 mb-3">{comorbidity}</h6>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required Imaging</label>
                  <textarea
                    value={formData.comorbidity_details[comorbidity]?.imaging || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      comorbidity_details: {
                        ...formData.comorbidity_details,
                        [comorbidity]: {
                          ...formData.comorbidity_details[comorbidity],
                          imaging: e.target.value
                        }
                      }
                    })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., ECG, Echocardiogram, Chest X-ray"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Required Laboratory Tests</label>
                  <textarea
                    value={formData.comorbidity_details[comorbidity]?.labs || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      comorbidity_details: {
                        ...formData.comorbidity_details,
                        [comorbidity]: {
                          ...formData.comorbidity_details[comorbidity],
                          labs: e.target.value
                        }
                      }
                    })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., HbA1c, Lipid profile, Renal function"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
                  <textarea
                    value={formData.comorbidity_details[comorbidity]?.medications || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      comorbidity_details: {
                        ...formData.comorbidity_details,
                        [comorbidity]: {
                          ...formData.comorbidity_details[comorbidity],
                          medications: e.target.value
                        }
                      }
                    })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="List medications for this condition"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep6 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Medications Interfering with Surgery</h4>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select medications patient is currently taking that may affect surgical outcome
        </label>
        <div className="space-y-2">
          {interferingMedicationsOptions.map(med => (
            <label key={med} className="flex items-center gap-2 p-2 border rounded hover:bg-gray-50">
              <input
                type="checkbox"
                checked={formData.interfering_medications.includes(med)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData({
                      ...formData,
                      interfering_medications: [...formData.interfering_medications, med]
                    });
                  } else {
                    setFormData({
                      ...formData,
                      interfering_medications: formData.interfering_medications.filter(m => m !== med)
                    });
                  }
                }}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">{med}</span>
            </label>
          ))}
        </div>
      </div>

      {formData.interfering_medications.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h6 className="font-medium text-yellow-900 mb-2">⚠️ Recommendations</h6>
          <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
            {formData.interfering_medications.includes('Warfarin') && (
              <li>Stop Warfarin 5 days before surgery. Check INR &lt;1.5 on day of surgery</li>
            )}
            {formData.interfering_medications.includes('Aspirin') && (
              <li>Stop Aspirin 7 days before surgery unless high cardiovascular risk</li>
            )}
            {formData.interfering_medications.includes('Clopidogrel') && (
              <li>Stop Clopidogrel 7-10 days before surgery</li>
            )}
            {formData.interfering_medications.includes('Metformin') && (
              <li>Stop Metformin 24-48h before surgery to prevent lactic acidosis</li>
            )}
            {formData.interfering_medications.includes('NSAIDs') && (
              <li>Stop NSAIDs 3-5 days before surgery due to bleeding risk</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );

  const renderStep7 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Preoperative Investigations</h4>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.fbc}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, fbc: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">Full Blood Count (FBC)</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.u_e}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, u_e: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">U&E (Electrolytes & Renal)</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.lft}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, lft: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">Liver Function Tests (LFT)</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.coagulation}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, coagulation: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">Coagulation Profile</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.blood_group}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, blood_group: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">Blood Group & Cross-match</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.ecg}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, ecg: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">ECG</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.chest_xray}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, chest_xray: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">Chest X-ray</span>
        </label>

        <label className="flex items-center gap-2 p-3 border rounded hover:bg-gray-50">
          <input
            type="checkbox"
            checked={formData.preop_investigations.echo}
            onChange={(e) => setFormData({
              ...formData,
              preop_investigations: { ...formData.preop_investigations, echo: e.target.checked }
            })}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
          <span className="text-sm font-medium text-gray-700">Echocardiogram</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Other Investigations</label>
        <textarea
          value={formData.preop_investigations.other}
          onChange={(e) => setFormData({
            ...formData,
            preop_investigations: { ...formData.preop_investigations, other: e.target.value }
          })}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Any other required investigations..."
        />
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900 border-b pb-2">Clinical Photographs</h4>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 mb-2">
          Upload preoperative photographs of the surgical site for documentation and surgical planning
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Upload Photos</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handlePhotoUpload}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {formData.clinical_photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {formData.clinical_photos.map((photo, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-3">
              <img
                src={photo.preview}
                alt={`Clinical photo ${index + 1}`}
                className="w-full h-40 object-cover rounded mb-2"
              />
              <input
                type="text"
                value={photo.description}
                onChange={(e) => {
                  const newPhotos = [...formData.clinical_photos];
                  newPhotos[index].description = e.target.value;
                  setFormData({ ...formData, clinical_photos: newPhotos });
                }}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded mb-2"
                placeholder="Photo description..."
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Schedule New Procedure</h3>
            <div className="text-sm text-gray-600">
              Step {currentStep} of 8
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === currentStep
                    ? 'bg-green-600 text-white'
                    : step < currentStep
                    ? 'bg-green-200 text-green-800'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {step}
                </div>
                {step < 8 && <div className={`w-12 h-1 ${step < currentStep ? 'bg-green-200' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} onKeyDown={(e) => {
            // Prevent form submission on Enter key for all inputs except submit button
            if (e.key === 'Enter') {
              const target = e.target as HTMLElement;
              if (target.tagName !== 'BUTTON' || (target as HTMLButtonElement).type !== 'submit') {
                e.preventDefault();
                e.stopPropagation();
              }
            }
          }}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
            {currentStep === 6 && renderStep6()}
            {currentStep === 7 && renderStep7()}
            {currentStep === 8 && renderStep8()}

            <div className="flex justify-between gap-3 pt-6 border-t mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>

              <div className="flex gap-3">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  >
                    Previous
                  </button>
                )}

                {currentStep < 8 ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentStep(currentStep + 1);
                    }}
                    className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                  >
                    Schedule Procedure
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Overview Dashboard Component
const ProcedureOverview: React.FC = () => {
  const [showActionsDropdown, setShowActionsDropdown] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState<{
    type: 'intraop' | 'reschedule' | 'cancel' | 'postop-plan' | 'postop-note' | null;
    procedure: any;
  }>({ type: null, procedure: null });
  const [procedures, setProcedures] = useState<SurgeryBooking[]>([]);
  const [stats, setStats] = useState({
    todaysProcedures: 0,
    pendingWHOChecklists: 0,
    highRiskPatients: 0,
    woundCareDue: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProceduresAndStats();
  }, []);

  const loadProceduresAndStats = async () => {
    try {
      setLoading(true);
      // Get today's procedures from surgery bookings
      const today = new Date();
      const allBookings = await schedulingService.getSurgeryBookings(today);
      
      // Also load procedures from IndexedDB procedures table
      const allDbProcedures = await db.procedures.toArray();
      
      // Filter for today's active/scheduled booking procedures
      const todaysBookings = allBookings.filter(p => 
        p.status === 'scheduled' || p.status === 'confirmed' || p.status === 'in_progress'
      );

      // Merge: convert DB procedures to display format if not already in bookings
      const bookingIds = new Set(todaysBookings.map(b => b.id));
      const additionalProcedures = allDbProcedures
        .filter(p => !bookingIds.has(p.id) && (p as any).status !== 'cancelled')
        .map(p => ({
          ...p,
          patient_name: (p as any).patient_name || '',
          primary_surgeon: (p as any).surgeon || '',
          procedure_name: (p as any).procedure_name || '',
          date: (p as any).scheduled_date || new Date().toISOString(),
          status: (p as any).status || 'scheduled',
        }));
      
      const combinedProcedures = [...todaysBookings, ...additionalProcedures] as any[];
      setProcedures(combinedProcedures);
      
      // Calculate stats from real data
      const pendingWHO = todaysBookings.filter(p => !p.pre_op_checklist_completed).length;
      const highRisk = 0; // Would need ASA grade tracking
      
      setStats({
        todaysProcedures: combinedProcedures.length,
        pendingWHOChecklists: pendingWHO,
        highRiskPatients: highRisk,
        woundCareDue: 0 // Would need separate wound care tracking
      });
    } catch (error) {
      console.error('Error loading procedures:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Procedures */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Today's Procedures</h3>
        </div>
        
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              <span className="ml-2 text-gray-600">Loading procedures...</span>
            </div>
          ) : procedures.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📋</div>
              <h4 className="text-lg font-medium text-gray-700 mb-2">No Procedures Scheduled Today</h4>
              <p className="text-gray-500 mb-4">Schedule a new surgical procedure using the button above.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Active Procedure Cards */}
              {procedures.map(procedure => (
                <div key={procedure.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{procedure.procedure_name} - {procedure.patient_name || 'Patient'}</h4>
                      <p className="text-sm text-gray-600">
                        {procedure.status === 'in_progress' ? 'Started' : 'Scheduled'}: {procedure.start_time} | 
                        Duration: {procedure.estimated_duration_minutes} min
                      </p>
                      <div className="flex items-center space-x-4 mt-2">
                        {procedure.pre_op_checklist_completed && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">✅ Pre-op Checklist Complete</span>
                        )}
                        {!procedure.pre_op_checklist_completed && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">⏳ WHO Checklist Pending</span>
                        )}
                        {procedure.consent_obtained && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">✅ Consent Obtained</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`text-lg font-semibold ${procedure.status === 'in_progress' ? 'text-green-600' : 'text-blue-600'}`}>
                          {procedure.status === 'in_progress' ? 'In Progress' : procedure.status === 'confirmed' ? 'Confirmed' : 'Scheduled'}
                        </span>
                        <p className="text-sm text-gray-500">Theatre {procedure.theatre_number}</p>
                      </div>
                      
                      {/* Actions Dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setShowActionsDropdown(showActionsDropdown === procedure.id ? null : procedure.id)}
                          className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
                        >
                          Actions
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      
                      {showActionsDropdown === procedure.id && (
                        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setShowActionModal({ type: 'intraop', procedure });
                                setShowActionsDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <span className="text-lg">🏥</span>
                              <div>
                                <div className="font-medium text-gray-900">Record Intraoperative Findings</div>
                                <div className="text-xs text-gray-500">Document surgical findings</div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => {
                                setShowActionModal({ type: 'reschedule', procedure });
                                setShowActionsDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <span className="text-lg">📅</span>
                              <div>
                                <div className="font-medium text-gray-900">Reschedule Procedure</div>
                                <div className="text-xs text-gray-500">Change date with reasons</div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => {
                                setShowActionModal({ type: 'cancel', procedure });
                                setShowActionsDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <span className="text-lg">❌</span>
                              <div>
                                <div className="font-medium text-gray-900">Cancel Procedure</div>
                                <div className="text-xs text-gray-500">Cancel with detailed reason</div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => {
                                setShowActionModal({ type: 'postop-plan', procedure });
                                setShowActionsDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <span className="text-lg">📋</span>
                              <div>
                                <div className="font-medium text-gray-900">Document Postop Treatment Plan</div>
                                <div className="text-xs text-gray-500">Care plan & medications</div>
                              </div>
                            </button>
                            
                            <button
                              onClick={() => {
                                setShowActionModal({ type: 'postop-note', procedure });
                                setShowActionsDropdown(null);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <span className="text-lg">📝</span>
                              <div>
                                <div className="font-medium text-gray-900">Generate Postoperative Note</div>
                                <div className="text-xs text-gray-500">Complete note with meal plan</div>
                              </div>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Modals */}
      {showActionModal.type === 'intraop' && (
        <IntraoperativeFindingsModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'reschedule' && (
        <RescheduleProcedureModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'cancel' && (
        <CancelProcedureModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'postop-plan' && (
        <PostoperativeTreatmentModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}
      {showActionModal.type === 'postop-note' && (
        <PostoperativeNoteModal 
          procedure={showActionModal.procedure}
          onClose={() => setShowActionModal({ type: null, procedure: null })}
        />
      )}

      {/* Module Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔍</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Preoperative</h4>
              <p className="text-sm text-gray-600">{stats.todaysProcedures} scheduled today</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">WHO Checklists</h4>
              <p className="text-sm text-gray-600">{stats.pendingWHOChecklists} pending</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔬</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Wound Care</h4>
              <p className="text-sm text-gray-600">{stats.woundCareDue} assessments due</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Fitness Scoring</h4>
              <p className="text-sm text-gray-600">{stats.highRiskPatients} high-risk patients</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🏥</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Intraoperative</h4>
              <p className="text-sm text-gray-600">{procedures.filter(p => p.status === 'in_progress').length} active</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🩺</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Postoperative</h4>
              <p className="text-sm text-gray-600">{procedures.filter(p => p.status === 'completed').length} completed today</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        
        <div className="p-6">
          {procedures.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-500">No recent activity. Schedule procedures to see activity updates here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {procedures.slice(0, 5).map((procedure, index) => (
                <div key={procedure.id} className="flex items-center space-x-3">
                  <span className={`w-2 h-2 rounded-full ${
                    procedure.status === 'completed' ? 'bg-green-500' :
                    procedure.status === 'in_progress' ? 'bg-blue-500' :
                    procedure.status === 'confirmed' ? 'bg-orange-500' : 'bg-gray-400'
                  }`}></span>
                  <span className="text-sm text-gray-700">
                    {procedure.procedure_name} - {procedure.patient_name || 'Patient'} ({procedure.status})
                  </span>
                  <span className="text-xs text-gray-500">{procedure.start_time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Intraoperative Findings Modal
const IntraoperativeFindingsModal: React.FC<{ procedure: any; onClose: () => void }> = ({ procedure, onClose }) => {
  const [formData, setFormData] = useState({
    surgical_approach: '',
    incision_details: '',
    anatomical_findings: '',
    pathological_findings: '',
    tissue_excised: '',
    reconstruction_method: '',
    implants_used: '',
    drains_placed: '',
    complications: '',
    estimated_blood_loss: '',
    blood_transfusion: false,
    units_transfused: 0,
    specimen_sent: false,
    specimen_details: '',
    additional_notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { user } = useAuthStore.getState();
      const findingsRecord = {
        procedure_id: procedure.id,
        ...formData,
        recorded_by: user?.name || 'Unknown',
        recorded_at: new Date(),
      };

      // Update procedure with intraop findings
      if (procedure.id) {
        await db.procedures.update(procedure.id, {
          intraoperative_findings: findingsRecord,
          status: 'completed',
        } as any);
        await syncService.queueAction('update', 'procedures', procedure.id, findingsRecord);
      }

      alert('Intraoperative findings recorded successfully!');
      onClose();
    } catch (error) {
      console.error('Error recording findings:', error);
      alert('Failed to save findings. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Record Intraoperative Findings</h3>
          <p className="text-sm text-gray-600 mb-6">
            {procedure.procedure_name} - {procedure.patient_name}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surgical Approach</label>
                <input
                  type="text"
                  value={formData.surgical_approach}
                  onChange={(e) => setFormData({ ...formData, surgical_approach: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Open, Laparoscopic, Endoscopic"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Blood Loss (mL)</label>
                <input
                  type="text"
                  value={formData.estimated_blood_loss}
                  onChange={(e) => setFormData({ ...formData, estimated_blood_loss: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., 150"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Incision Details</label>
              <textarea
                value={formData.incision_details}
                onChange={(e) => setFormData({ ...formData, incision_details: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Location, size, and type of incision..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anatomical Findings</label>
              <textarea
                value={formData.anatomical_findings}
                onChange={(e) => setFormData({ ...formData, anatomical_findings: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Normal and abnormal anatomical structures encountered..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pathological Findings</label>
              <textarea
                value={formData.pathological_findings}
                onChange={(e) => setFormData({ ...formData, pathological_findings: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Describe any pathological findings..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tissue Excised</label>
                <input
                  type="text"
                  value={formData.tissue_excised}
                  onChange={(e) => setFormData({ ...formData, tissue_excised: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Type and amount of tissue removed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reconstruction Method</label>
                <input
                  type="text"
                  value={formData.reconstruction_method}
                  onChange={(e) => setFormData({ ...formData, reconstruction_method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Flap type, graft, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Implants/Prosthetics Used</label>
                <input
                  type="text"
                  value={formData.implants_used}
                  onChange={(e) => setFormData({ ...formData, implants_used: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Type, size, serial numbers"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Drains Placed</label>
                <input
                  type="text"
                  value={formData.drains_placed}
                  onChange={(e) => setFormData({ ...formData, drains_placed: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Number and type of drains"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complications</label>
              <textarea
                value={formData.complications}
                onChange={(e) => setFormData({ ...formData, complications: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Any intraoperative complications..."
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.blood_transfusion}
                  onChange={(e) => setFormData({ ...formData, blood_transfusion: e.target.checked })}
                  className="rounded border-gray-300 text-green-600"
                />
                <span className="text-sm text-gray-700">Blood Transfusion Given</span>
              </label>

              {formData.blood_transfusion && (
                <div>
                  <input
                    type="number"
                    value={formData.units_transfused}
                    onChange={(e) => setFormData({ ...formData, units_transfused: parseInt(e.target.value) })}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Units"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.specimen_sent}
                onChange={(e) => setFormData({ ...formData, specimen_sent: e.target.checked })}
                className="rounded border-gray-300 text-green-600"
              />
              <label className="text-sm text-gray-700">Specimen Sent for Histopathology</label>
            </div>

            {formData.specimen_sent && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specimen Details</label>
                <textarea
                  value={formData.specimen_details}
                  onChange={(e) => setFormData({ ...formData, specimen_details: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Description of specimen sent..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
              <textarea
                value={formData.additional_notes}
                onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Any additional relevant information..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Save Findings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Reschedule Procedure Modal
const RescheduleProcedureModal: React.FC<{ procedure: any; onClose: () => void }> = ({ procedure, onClose }) => {
  const [formData, setFormData] = useState({
    new_date: '',
    new_time: '',
    reason_category: '',
    detailed_reason: '',
    patient_informed: false,
    new_plan: '',
    priority_level: 'routine' as 'routine' | 'urgent' | 'emergency'
  });

  const reasonCategories = [
    'Patient medical condition',
    'Patient request',
    'Surgeon unavailable',
    'Anesthesiologist unavailable',
    'Operating room unavailable',
    'Equipment/supplies unavailable',
    'Emergency case priority',
    'Laboratory results pending',
    'Consultant review required',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { user } = useAuthStore.getState();
      const rescheduleRecord = {
        procedure_id: procedure.id,
        ...formData,
        rescheduled_by: user?.name || 'Unknown',
        rescheduled_at: new Date(),
      };

      // Update procedure with new schedule
      if (procedure.id) {
        await db.procedures.update(procedure.id, {
          scheduled_date: formData.new_date,
          scheduled_time: formData.new_time,
          status: 'rescheduled',
          reschedule_history: rescheduleRecord,
        } as any);
        await syncService.queueAction('update', 'procedures', procedure.id, rescheduleRecord);
      }

      alert('Procedure rescheduled successfully!');
      onClose();
    } catch (error) {
      console.error('Error rescheduling:', error);
      alert('Failed to reschedule. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Reschedule Procedure</h3>
          <p className="text-sm text-gray-600 mb-6">
            {procedure.procedure_name} - {procedure.patient_name}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Original Schedule:</strong> {procedure.scheduled_date} at {procedure.scheduled_time}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Date *</label>
                <input
                  type="date"
                  required
                  value={formData.new_date}
                  onChange={(e) => setFormData({ ...formData, new_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Time *</label>
                <input
                  type="time"
                  required
                  value={formData.new_time}
                  onChange={(e) => setFormData({ ...formData, new_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason Category *</label>
              <select
                required
                value={formData.reason_category}
                onChange={(e) => setFormData({ ...formData, reason_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select reason...</option>
                {reasonCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Reason *</label>
              <textarea
                required
                value={formData.detailed_reason}
                onChange={(e) => setFormData({ ...formData, detailed_reason: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Provide detailed explanation for rescheduling..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Management Plan *</label>
              <textarea
                required
                value={formData.new_plan}
                onChange={(e) => setFormData({ ...formData, new_plan: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Describe interim care plan, preparations needed, etc..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority Level</label>
              <select
                value={formData.priority_level}
                onChange={(e) => setFormData({ ...formData, priority_level: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                required
                checked={formData.patient_informed}
                onChange={(e) => setFormData({ ...formData, patient_informed: e.target.checked })}
                className="rounded border-gray-300 text-green-600"
              />
              <label className="text-sm text-gray-700">Patient has been informed of the rescheduling *</label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Reschedule Procedure
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Cancel Procedure Modal
const CancelProcedureModal: React.FC<{ procedure: any; onClose: () => void }> = ({ procedure, onClose }) => {
  const [formData, setFormData] = useState({
    cancellation_category: '',
    detailed_reason: '',
    patient_informed: false,
    alternative_plan: '',
    follow_up_required: false,
    follow_up_plan: '',
    referral_needed: false,
    referral_details: ''
  });

  const cancellationCategories = [
    'Patient medical instability',
    'Patient refusal/withdrawal of consent',
    'Inadequate preoperative preparation',
    'Abnormal laboratory results',
    'Active infection',
    'Uncontrolled comorbidity',
    'Equipment failure',
    'Surgeon unavailable',
    'Anesthesia contraindication',
    'Emergency case superseded',
    'Other'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { user } = useAuthStore.getState();
      const cancellationRecord = {
        procedure_id: procedure.id,
        ...formData,
        cancelled_by: user?.name || 'Unknown',
        cancelled_at: new Date(),
      };

      // Update procedure status to cancelled
      if (procedure.id) {
        await db.procedures.update(procedure.id, {
          status: 'cancelled',
          cancellation_details: cancellationRecord,
        } as any);
        await syncService.queueAction('update', 'procedures', procedure.id, cancellationRecord);
      }

      alert('Procedure cancelled successfully!');
      onClose();
    } catch (error) {
      console.error('Error cancelling:', error);
      alert('Failed to cancel procedure. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 text-red-600">Cancel Procedure</h3>
          <p className="text-sm text-gray-600 mb-6">
            {procedure.procedure_name} - {procedure.patient_name}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                ⚠️ This action will permanently cancel the scheduled procedure. Please ensure all details are accurate.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cancellation Category *</label>
              <select
                required
                value={formData.cancellation_category}
                onChange={(e) => setFormData({ ...formData, cancellation_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">Select category...</option>
                {cancellationCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Detailed Reason for Cancellation *</label>
              <textarea
                required
                value={formData.detailed_reason}
                onChange={(e) => setFormData({ ...formData, detailed_reason: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Provide comprehensive explanation for cancellation..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alternative Management Plan *</label>
              <textarea
                required
                value={formData.alternative_plan}
                onChange={(e) => setFormData({ ...formData, alternative_plan: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Describe alternative treatment approach, conservative management, etc..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.follow_up_required}
                  onChange={(e) => setFormData({ ...formData, follow_up_required: e.target.checked })}
                  className="rounded border-gray-300 text-green-600"
                />
                <label className="text-sm text-gray-700">Follow-up Required</label>
              </div>

              {formData.follow_up_required && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Plan</label>
                  <textarea
                    value={formData.follow_up_plan}
                    onChange={(e) => setFormData({ ...formData, follow_up_plan: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="When and what should be done at follow-up..."
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.referral_needed}
                  onChange={(e) => setFormData({ ...formData, referral_needed: e.target.checked })}
                  className="rounded border-gray-300 text-green-600"
                />
                <label className="text-sm text-gray-700">Referral to Another Specialist Needed</label>
              </div>

              {formData.referral_needed && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referral Details</label>
                  <textarea
                    value={formData.referral_details}
                    onChange={(e) => setFormData({ ...formData, referral_details: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Specialty and reason for referral..."
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  required
                  checked={formData.patient_informed}
                  onChange={(e) => setFormData({ ...formData, patient_informed: e.target.checked })}
                  className="rounded border-gray-300 text-green-600"
                />
                <label className="text-sm text-gray-700">Patient has been informed of the cancellation *</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Go Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Confirm Cancellation
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Postoperative Treatment Plan Modal
const PostoperativeTreatmentModal: React.FC<{ procedure: any; onClose: () => void }> = ({ procedure, onClose }) => {
  const [formData, setFormData] = useState({
    pain_management: '',
    antibiotics: '',
    other_medications: '',
    wound_care: '',
    drain_management: '',
    activity_restrictions: '',
    diet_orders: '',
    dvt_prophylaxis: '',
    physiotherapy: '',
    monitoring_requirements: '',
    discharge_criteria: '',
    follow_up_plan: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { user } = useAuthStore.getState();
      const postopPlanRecord = {
        procedure_id: procedure.id,
        ...formData,
        documented_by: user?.name || 'Unknown',
        documented_at: new Date(),
      };

      // Update procedure with postop treatment plan
      if (procedure.id) {
        await db.procedures.update(procedure.id, {
          postoperative_plan: postopPlanRecord,
        } as any);
        await syncService.queueAction('update', 'procedures', procedure.id, postopPlanRecord);
      }

      alert('Postoperative treatment plan documented successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving plan:', error);
      alert('Failed to save treatment plan. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Document Postoperative Treatment Plan</h3>
          <p className="text-sm text-gray-600 mb-6">
            {procedure.procedure_name} - {procedure.patient_name}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pain Management *</label>
              <textarea
                required
                value={formData.pain_management}
                onChange={(e) => setFormData({ ...formData, pain_management: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Tramadol 50mg PO q6h PRN, Paracetamol 1g PO q8h"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Antibiotics *</label>
              <textarea
                required
                value={formData.antibiotics}
                onChange={(e) => setFormData({ ...formData, antibiotics: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Ceftriaxone 1g IV q12h for 3 days"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Other Medications</label>
              <textarea
                value={formData.other_medications}
                onChange={(e) => setFormData({ ...formData, other_medications: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Any other required medications..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Wound Care Instructions *</label>
              <textarea
                required
                value={formData.wound_care}
                onChange={(e) => setFormData({ ...formData, wound_care: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Dressing changes, wound inspection schedule, etc..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drain Management</label>
              <textarea
                value={formData.drain_management}
                onChange={(e) => setFormData({ ...formData, drain_management: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Drain output monitoring, removal criteria..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Activity Restrictions *</label>
              <textarea
                required
                value={formData.activity_restrictions}
                onChange={(e) => setFormData({ ...formData, activity_restrictions: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Bed rest, limited ambulation, no heavy lifting, etc..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diet Orders *</label>
              <textarea
                required
                value={formData.diet_orders}
                onChange={(e) => setFormData({ ...formData, diet_orders: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., NBM for 6h then clear fluids, progress to soft diet..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DVT Prophylaxis *</label>
              <textarea
                required
                value={formData.dvt_prophylaxis}
                onChange={(e) => setFormData({ ...formData, dvt_prophylaxis: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Enoxaparin 40mg SC daily, TED stockings, early mobilization"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Physiotherapy Requirements *</label>
              <textarea
                required
                value={formData.physiotherapy}
                onChange={(e) => setFormData({ ...formData, physiotherapy: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Chest physiotherapy, limb exercises, ambulation plan..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monitoring Requirements *</label>
              <textarea
                required
                value={formData.monitoring_requirements}
                onChange={(e) => setFormData({ ...formData, monitoring_requirements: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Vital signs frequency, fluid balance, drain output..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Criteria</label>
              <textarea
                value={formData.discharge_criteria}
                onChange={(e) => setFormData({ ...formData, discharge_criteria: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Conditions to be met before discharge..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Plan *</label>
              <textarea
                required
                value={formData.follow_up_plan}
                onChange={(e) => setFormData({ ...formData, follow_up_plan: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Schedule for follow-up visits, investigations..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Save Treatment Plan
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Postoperative Note Modal with Meal Plan
const PostoperativeNoteModal: React.FC<{ procedure: any; onClose: () => void }> = ({ procedure, onClose }) => {
  const [formData, setFormData] = useState({
    patient_details: {
      name: procedure.patient_name || '',
      age: '',
      sex: '',
      hospital_number: '',
      ward: ''
    },
    indication: '',
    anesthesia_type: '',
    anesthetist_name: '',
    intraop_findings: '',
    postop_plan: '',
    medications: '',
    meal_commencement: 'NBM for 6 hours then clear fluids',
    clinical_condition: '',
    treatment_goals: '',
    comorbidities: [] as string[],
    ambulation_plan: '',
    physiotherapy_needs: '',
    dvt_prophylaxis: ''
  });

  const [generatedMealPlan, setGeneratedMealPlan] = useState<any>(null);

  const comorbidityOptions = [
    'Diabetes Mellitus',
    'Hypertension',
    'Cardiovascular Disease',
    'Chronic Kidney Disease',
    'Liver Disease',
    'Obesity',
    'Malnutrition',
    'Anemia',
    'None'
  ];

  const africanFoodDatabase = {
    proteins: ['Beans', 'Groundnuts', 'Fish', 'Chicken', 'Eggs', 'Soya beans'],
    carbohydrates: ['Rice', 'Yam', 'Plantain', 'Sweet potato', 'Cassava', 'Millet', 'Sorghum'],
    vegetables: ['Spinach', 'Pumpkin leaves', 'Okra', 'Tomatoes', 'Onions', 'Garden egg'],
    fruits: ['Oranges', 'Bananas', 'Papaya', 'Mango', 'Watermelon', 'Pineapple'],
    fluids: ['Water', 'Coconut water', 'Zobo drink', 'Palm wine (limited)', 'Fruit juice']
  };

  const generateMealPlan = () => {
    const isDiabetic = formData.comorbidities.includes('Diabetes Mellitus');
    const isHypertensive = formData.comorbidities.includes('Hypertension');
    const hasKidneyDisease = formData.comorbidities.includes('Chronic Kidney Disease');
    const isMalnourished = formData.comorbidities.includes('Malnutrition');

    const mealPlan = [];
    
    for (let day = 1; day <= 7; day++) {
      const dayPlan = {
        day,
        breakfast: '',
        lunch: '',
        dinner: '',
        snacks: '',
        fluids: '2-3 liters of water daily',
        notes: []
      };

      // Breakfast
      if (day <= 2) {
        dayPlan.breakfast = 'Light porridge (pap/akamu) with milk';
      } else {
        dayPlan.breakfast = isDiabetic 
          ? 'Oat porridge with groundnuts, boiled egg'
          : 'Yam porridge or rice with beans, boiled egg';
      }

      // Lunch
      if (day === 1) {
        dayPlan.lunch = 'Clear soup (light pepper soup) with white rice';
      } else {
        dayPlan.lunch = `Rice with ${hasKidneyDisease ? 'steamed fish' : 'fish/chicken'} stew, vegetable salad`;
      }

      // Dinner
      if (day <= 2) {
        dayPlan.dinner = 'Light soup (vegetable soup) with fufu/eba (small portion)';
      } else {
        dayPlan.dinner = `${isDiabetic ? 'Brown rice' : 'Jollof rice'} with grilled fish/chicken, steamed vegetables`;
      }

      // Snacks
      dayPlan.snacks = 'Fruits (banana, orange, papaya), roasted groundnuts';

      // Special dietary notes
      if (isDiabetic) {
        dayPlan.notes.push('Low sugar, high fiber diet. Avoid refined carbs');
      }
      if (isHypertensive) {
        dayPlan.notes.push('Low sodium. Avoid excess salt, stock cubes');
      }
      if (hasKidneyDisease) {
        dayPlan.notes.push('Low protein, controlled fluid intake');
      }
      if (isMalnourished) {
        dayPlan.notes.push('High protein, high calorie diet. Frequent small meals');
      }

      mealPlan.push(dayPlan);
    }

    setGeneratedMealPlan(mealPlan);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!generatedMealPlan) {
      alert('Please generate the meal plan first');
      return;
    }

    try {
      const { user } = useAuthStore.getState();
      const postopNoteRecord = {
        procedure_id: procedure.id,
        ...formData,
        meal_plan: generatedMealPlan,
        documented_by: user?.name || 'Unknown',
        documented_at: new Date(),
      };

      // Update procedure with postop note
      if (procedure.id) {
        await db.procedures.update(procedure.id, {
          postoperative_note: postopNoteRecord,
        } as any);
        await syncService.queueAction('update', 'procedures', procedure.id, postopNoteRecord);
      }

      alert('Postoperative note generated successfully!');
      onClose();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save postoperative note. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Generate Postoperative Note</h3>
          <p className="text-sm text-gray-600 mb-6">
            Comprehensive postoperative documentation with African-tailored meal plan
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Patient Details */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3">Patient Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_details.name}
                    onChange={(e) => setFormData({
                      ...formData,
                      patient_details: { ...formData.patient_details, name: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_details.age}
                    onChange={(e) => setFormData({
                      ...formData,
                      patient_details: { ...formData.patient_details, age: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                  <select
                    required
                    value={formData.patient_details.sex}
                    onChange={(e) => setFormData({
                      ...formData,
                      patient_details: { ...formData.patient_details, sex: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">Select...</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Number</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_details.hospital_number}
                    onChange={(e) => setFormData({
                      ...formData,
                      patient_details: { ...formData.patient_details, hospital_number: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ward</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_details.ward}
                    onChange={(e) => setFormData({
                      ...formData,
                      patient_details: { ...formData.patient_details, ward: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            {/* Surgical Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indication for Surgery *</label>
                <textarea
                  required
                  value={formData.indication}
                  onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Primary diagnosis and reason for surgery..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type & Anesthetist *</label>
                <input
                  type="text"
                  required
                  value={formData.anesthesia_type}
                  onChange={(e) => setFormData({ ...formData, anesthesia_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2"
                  placeholder="e.g., General Anesthesia"
                />
                <input
                  type="text"
                  required
                  value={formData.anesthetist_name}
                  onChange={(e) => setFormData({ ...formData, anesthetist_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Anesthetist name"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intraoperative Findings *</label>
              <textarea
                required
                value={formData.intraop_findings}
                onChange={(e) => setFormData({ ...formData, intraop_findings: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Key surgical findings, procedures performed..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postoperative Treatment Plan *</label>
              <textarea
                required
                value={formData.postop_plan}
                onChange={(e) => setFormData({ ...formData, postop_plan: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Overall care plan, monitoring, wound care..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medications Plan *</label>
              <textarea
                required
                value={formData.medications}
                onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Pain meds, antibiotics, other medications..."
              />
            </div>

            {/* Meal Planning Section */}
            <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50">
              <h4 className="font-semibold text-gray-900 mb-3">Nutrition & Meal Planning (African Foods)</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meal Commencement *</label>
                  <input
                    type="text"
                    required
                    value={formData.meal_commencement}
                    onChange={(e) => setFormData({ ...formData, meal_commencement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Condition *</label>
                  <input
                    type="text"
                    required
                    value={formData.clinical_condition}
                    onChange={(e) => setFormData({ ...formData, clinical_condition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Post-op day 1, stable"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Goals *</label>
                <textarea
                  required
                  value={formData.treatment_goals}
                  onChange={(e) => setFormData({ ...formData, treatment_goals: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Wound healing, pain control, early mobilization..."
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Comorbidities (Select all that apply) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {comorbidityOptions.map(comorbidity => (
                    <label key={comorbidity} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.comorbidities.includes(comorbidity)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              comorbidities: [...formData.comorbidities, comorbidity]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              comorbidities: formData.comorbidities.filter(c => c !== comorbidity)
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-green-600"
                      />
                      <span className="text-sm text-gray-700">{comorbidity}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={generateMealPlan}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                🍽️ Generate 7-Day African Meal Plan
              </button>
            </div>

            {/* Generated Meal Plan Display */}
            {generatedMealPlan && (
              <div className="border border-gray-200 rounded-lg p-4 bg-white">
                <h4 className="font-semibold text-gray-900 mb-4">Generated 7-Day Meal Plan</h4>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {generatedMealPlan.map((day: any) => (
                    <div key={day.day} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <h5 className="font-medium text-gray-900 mb-2">Day {day.day}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <strong>Breakfast:</strong> {day.breakfast}
                        </div>
                        <div>
                          <strong>Lunch:</strong> {day.lunch}
                        </div>
                        <div>
                          <strong>Dinner:</strong> {day.dinner}
                        </div>
                        <div>
                          <strong>Snacks:</strong> {day.snacks}
                        </div>
                      </div>
                      <div className="text-sm mt-2">
                        <strong>Fluids:</strong> {day.fluids}
                      </div>
                      {day.notes.length > 0 && (
                        <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded p-2">
                          <p className="text-xs font-medium text-yellow-900">Dietary Notes:</p>
                          {day.notes.map((note: string, idx: number) => (
                            <p key={idx} className="text-xs text-yellow-800">• {note}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ambulation & DVT Prophylaxis */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ambulation Plan *</label>
                <textarea
                  required
                  value={formData.ambulation_plan}
                  onChange={(e) => setFormData({ ...formData, ambulation_plan: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Day 1: Bed rest with leg exercises, Day 2: Sit on edge of bed..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Physiotherapy Needs *</label>
                <textarea
                  required
                  value={formData.physiotherapy_needs}
                  onChange={(e) => setFormData({ ...formData, physiotherapy_needs: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Chest physio, active/passive limb exercises, breathing exercises..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DVT Prophylaxis *</label>
              <textarea
                required
                value={formData.dvt_prophylaxis}
                onChange={(e) => setFormData({ ...formData, dvt_prophylaxis: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., Enoxaparin 40mg SC daily, TED stockings, early mobilization, adequate hydration"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 font-medium"
              >
                Generate & Save Postoperative Note
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Procedures;