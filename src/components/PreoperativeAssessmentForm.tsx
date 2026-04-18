import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Activity, 
  Heart, 
  Droplet, 
  AlertTriangle,
  CheckCircle,
  FileCheck,
  Pill,
  Download,
  Printer,
  Eye
} from 'lucide-react';
import { db } from '../db/database';
import { syncService } from '../db/syncService';
import { patientService } from '../services/patientService';
import { apiClient } from '../services/apiClient';
import { 
  preoperativeService,
  Medication,
  BleedingRiskAssessment,
  CapriniDVTRisk,
  CardiovascularRiskAssessment,
  PressureSoreRiskAssessment,
  PreoperativeAssessment,
  ComorbidityMedication
} from '../services/preoperativeService';
import { getCurrentUserName } from '../utils/getCurrentUser';

interface PreoperativeAssessmentFormProps {
  patientId: string;
  surgeryBookingId?: string;
  onClose: () => void;
  onSave?: () => void;
}

export default function PreoperativeAssessmentForm({
  patientId,
  surgeryBookingId,
  onClose,
  onSave
}: PreoperativeAssessmentFormProps) {
  const [patient, setPatient] = useState<any>(null);
  const [surgery, setSurgery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'medications' | 'bleeding' | 'dvt' | 'cardiac' | 'pressure' | 'comorbidities' | 'documents' | 'summary'>('medications');
  
  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedication, setNewMedication] = useState<Medication>({
    drug_name: '',
    dosage: '',
    frequency: '',
    route: 'oral',
    indication: '',
    stop_before_surgery: false
  });

  // Risk Assessments
  const [bleedingRisk, setBleedingRisk] = useState<Partial<BleedingRiskAssessment>>({});
  const [dvtRisk, setDvtRisk] = useState<Partial<CapriniDVTRisk>>({});
  const [cardiacRisk, setCardiacRisk] = useState<Partial<CardiovascularRiskAssessment>>({});
  const [pressureRisk, setPressureRisk] = useState<Partial<PressureSoreRiskAssessment>>({});

  // Comorbidities
  const [comorbidityMeds, setComorbidityMeds] = useState<ComorbidityMedication[]>([]);
  const [selectedComorbidity, setSelectedComorbidity] = useState('');

  // Documents
  const [consentDocument, setConsentDocument] = useState<string>('');
  const [paymentEvidence, setPaymentEvidence] = useState<string>('');
  const [insuranceCovered, setInsuranceCovered] = useState(false);

  // Generated outputs
  const [comprehensiveSummary, setComprehensiveSummary] = useState('');
  const [preopInstructions, setPreopInstructions] = useState('');
  const [showSummaryView, setShowSummaryView] = useState(false);
  const [showInstructionsView, setShowInstructionsView] = useState(false);

  useEffect(() => {
    loadPatientData();
  }, [patientId, surgeryBookingId]);

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientData = await patientService.getPatient(patientId);
      setPatient(patientData);

      if (surgeryBookingId) {
        const surgeryData = await db.surgery_bookings.get(parseInt(surgeryBookingId));
        setSurgery(surgeryData);
      }

      // Load existing assessment: try IndexedDB first, then API fallback
      let existing = await db.preoperative_assessments
        .where('patient_id').equals(patientId)
        .and(a => surgeryBookingId ? a.surgery_booking_id === surgeryBookingId : true)
        .last(); // Use .last() to get the most recent

      // If not found locally, try the server
      if (!existing) {
        try {
          const serverAssessments = await apiClient.getPreoperativeAssessments(patientId);
          if (serverAssessments && serverAssessments.length > 0) {
            // Find matching assessment (by surgery_booking_id if provided)
            existing = surgeryBookingId
              ? serverAssessments.find((a: any) => a.surgery_booking_id === surgeryBookingId) || serverAssessments[0]
              : serverAssessments[0];
            // Cache locally for future loads
            if (existing) {
              await db.preoperative_assessments.put({ ...existing, synced: true });
            }
          }
        } catch (apiErr) {
          console.warn('Could not fetch preoperative assessments from server:', apiErr);
        }
      }

      if (existing) {
        if (existing.current_medications) setMedications(existing.current_medications);
        if (existing.bleeding_risk) setBleedingRisk(existing.bleeding_risk);
        if (existing.dvt_risk) setDvtRisk(existing.dvt_risk);
        if (existing.cardiovascular_risk) setCardiacRisk(existing.cardiovascular_risk);
        if (existing.pressure_sore_risk) setPressureRisk(existing.pressure_sore_risk);
        if (existing.comorbidities_medications) setComorbidityMeds(existing.comorbidities_medications);
        if (existing.consent_document) setConsentDocument(existing.consent_document);
        if (existing.payment_evidence) setPaymentEvidence(existing.payment_evidence);
        if (existing.insurance_covered !== undefined) setInsuranceCovered(existing.insurance_covered);
        if (existing.comprehensive_summary) setComprehensiveSummary(existing.comprehensive_summary);
        if (existing.preop_instructions) setPreopInstructions(existing.preop_instructions);
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addMedication = () => {
    if (!newMedication.drug_name || !newMedication.dosage) {
      alert('Please enter drug name and dosage');
      return;
    }
    setMedications([...medications, { ...newMedication }]);
    setNewMedication({
      drug_name: '',
      dosage: '',
      frequency: '',
      route: 'oral',
      indication: '',
      stop_before_surgery: false
    });
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const addComorbidityMedication = () => {
    if (!selectedComorbidity) {
      alert('Please select a comorbidity');
      return;
    }
    const existing = comorbidityMeds.find(cm => cm.comorbidity === selectedComorbidity);
    if (existing) {
      alert('Comorbidity already added. Please edit existing entry.');
      return;
    }
    setComorbidityMeds([...comorbidityMeds, { comorbidity: selectedComorbidity, medications: [] }]);
    setSelectedComorbidity('');
  };

  const addMedicationToComorbidity = (comorbidityIndex: number, medication: Medication) => {
    const updated = [...comorbidityMeds];
    updated[comorbidityIndex].medications.push(medication);
    setComorbidityMeds(updated);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'consent' | 'payment') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === 'consent') {
        setConsentDocument(base64);
      } else {
        setPaymentEvidence(base64);
      }
    };
    reader.readAsDataURL(file);
  };

  const calculateBleedingRiskScore = () => {
    const assessment = preoperativeService.calculateBleedingRisk(bleedingRisk);
    setBleedingRisk(assessment);
  };

  const calculateDVTScore = () => {
    const assessment = preoperativeService.calculateCapriniScore(dvtRisk);
    setDvtRisk(assessment);
  };

  const calculateCardiacScore = () => {
    const assessment = preoperativeService.calculateCardiovascularRisk(cardiacRisk);
    setCardiacRisk(assessment);
  };

  const calculatePressureRiskScore = () => {
    const assessment = preoperativeService.calculatePressureSoreRisk(pressureRisk);
    setPressureRisk(assessment);
  };

  const generateComprehensiveSummary = async () => {
    try {
      setGenerating(true);
      
      const assessment: PreoperativeAssessment = {
        patient_id: patientId,
        surgery_booking_id: surgeryBookingId,
        current_medications: medications,
        bleeding_risk: bleedingRisk as BleedingRiskAssessment,
        dvt_risk: dvtRisk as CapriniDVTRisk,
        cardiovascular_risk: cardiacRisk as CardiovascularRiskAssessment,
        pressure_sore_risk: pressureRisk as PressureSoreRiskAssessment,
        comorbidities_medications: comorbidityMeds,
        consent_document: consentDocument,
        payment_evidence: paymentEvidence,
        insurance_covered: insuranceCovered,
        assessed_by: getCurrentUserName(),
        assessed_at: new Date(),
        updated_at: new Date()
      };

      // Get all patient data
      const labResults = await db.lab_results.where('patient_id').equals(patientId).toArray();
      const summaryData = {
        patient,
        assessment,
        surgery_details: surgery,
        lab_results: labResults,
        vital_signs: [], // TODO: Add vital signs if available
        allergies: patient?.allergies || [],
        emergency_contact: null // TODO: Add if available
      };

      const summary = await preoperativeService.generateComprehensiveSummary(summaryData);
      setComprehensiveSummary(summary);
      setShowSummaryView(true);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate comprehensive summary');
    } finally {
      setGenerating(false);
    }
  };

  const generatePreopInstructions = async () => {
    try {
      setGenerating(true);
      
      const instructions = await preoperativeService.generatePreOpInstructions({
        patient,
        surgery: surgery || {},
        anaesthesia_type: surgery?.anaesthesia_type || 'general',
        medications,
        comorbidities: patient?.comorbidities || [],
        bleeding_risk: bleedingRisk as BleedingRiskAssessment,
        dvt_risk: dvtRisk as CapriniDVTRisk,
        cardiovascular_risk: cardiacRisk as CardiovascularRiskAssessment
      } as any);

      setPreopInstructions(instructions);
      setShowInstructionsView(true);
    } catch (error) {
      console.error('Error generating instructions:', error);
      alert('Failed to generate preoperative instructions');
    } finally {
      setGenerating(false);
    }
  };

  const saveAssessment = async () => {
    try {
      const assessment: PreoperativeAssessment = {
        patient_id: patientId,
        surgery_booking_id: surgeryBookingId,
        current_medications: medications,
        bleeding_risk: bleedingRisk as BleedingRiskAssessment,
        dvt_risk: dvtRisk as CapriniDVTRisk,
        cardiovascular_risk: cardiacRisk as CardiovascularRiskAssessment,
        pressure_sore_risk: pressureRisk as PressureSoreRiskAssessment,
        comorbidities_medications: comorbidityMeds,
        consent_document: consentDocument,
        payment_evidence: paymentEvidence,
        insurance_covered: insuranceCovered,
        comprehensive_summary: comprehensiveSummary,
        preop_instructions: preopInstructions,
        assessed_by: getCurrentUserName(),
        assessed_at: new Date(),
        updated_at: new Date()
      };

      // Upsert in IndexedDB: find existing and update, or create new
      const existingLocal = await db.preoperative_assessments
        .where('patient_id').equals(patientId)
        .and(a => surgeryBookingId ? a.surgery_booking_id === surgeryBookingId : true)
        .last();

      let localId: number;
      if (existingLocal?.id) {
        await db.preoperative_assessments.update(existingLocal.id, { ...assessment, synced: false });
        localId = existingLocal.id as number;
      } else {
        localId = await db.preoperative_assessments.add({ ...assessment, synced: false }) as number;
      }

      // Save directly to server API (don't rely solely on background sync)
      try {
        const apiPayload = {
          ...assessment,
          patient_name: patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : undefined,
          hospital_number: patient?.hospital_number,
        };
        const serverResult = await apiClient.createPreoperativeAssessment(apiPayload);
        if (serverResult?.id) {
          // Mark as synced in IndexedDB
          await db.preoperative_assessments.update(localId, { synced: true, server_id: serverResult.id });
        }
        console.log('✅ Preoperative assessment saved to server');
      } catch (apiErr) {
        console.warn('Could not save to server, queued for background sync:', apiErr);
        // Queue for background sync as fallback
        await syncService.queueAction('create', 'preoperative_assessments', localId, assessment);
      }

      alert('Preoperative assessment saved successfully!');
      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving assessment:', error);
      alert('Failed to save assessment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'bleeding', label: 'Bleeding Risk', icon: Droplet },
    { id: 'dvt', label: 'DVT Risk (Caprini)', icon: Activity },
    { id: 'cardiac', label: 'Cardiac Risk', icon: Heart },
    { id: 'pressure', label: 'Pressure Sore Risk', icon: AlertTriangle },
    { id: 'comorbidities', label: 'Comorbidities', icon: FileText },
    { id: 'documents', label: 'Documents', icon: FileCheck },
    { id: 'summary', label: 'Summary & Instructions', icon: Eye }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-7xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900">Preoperative Assessment</h2>
              <p className="text-sm text-gray-600 mt-1">
                {patient?.first_name} {patient?.last_name} ({patient?.hospital_number})
              </p>
              {surgery && (
                <p className="text-sm text-gray-600">
                  Surgery: {surgery.procedure_name} - {surgery.anaesthesia_type}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-white px-6 overflow-x-auto">
          <div className="flex space-x-1 min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* MEDICATIONS TAB */}
          {activeTab === 'medications' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Current Medications</h3>
                <p className="text-sm text-blue-700">Document all current medications including dosage, frequency, and whether they should be stopped before surgery.</p>
              </div>

              {/* Medication List */}
              {medications.length > 0 && (
                <div className="space-y-2">
                  {medications.map((med, index) => (
                    <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start justify-between">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Drug</p>
                          <p className="text-sm text-gray-900">{med.drug_name}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Dosage & Frequency</p>
                          <p className="text-sm text-gray-900">{med.dosage} {med.frequency}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Route</p>
                          <p className="text-sm text-gray-900 capitalize">{med.route}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Stop Before Surgery?</p>
                          <p className={`text-sm font-semibold ${med.stop_before_surgery ? 'text-red-600' : 'text-green-600'}`}>
                            {med.stop_before_surgery ? `Yes (${med.stop_hours_before || 0}hrs before)` : 'No - Continue'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeMedication(index)}
                        className="ml-4 text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Medication */}
              <div className="bg-white border border-gray-300 rounded-lg p-4">
                <h4 className="font-semibold mb-4">Add Medication</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name*</label>
                    <input
                      type="text"
                      value={newMedication.drug_name}
                      onChange={(e) => setNewMedication({ ...newMedication, drug_name: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Metformin"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage*</label>
                    <input
                      type="text"
                      value={newMedication.dosage}
                      onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., 500mg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <input
                      type="text"
                      value={newMedication.frequency}
                      onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., BD (Twice daily)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                    <select
                      value={newMedication.route}
                      onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="oral">Oral</option>
                      <option value="IV">IV</option>
                      <option value="IM">IM</option>
                      <option value="SC">SC</option>
                      <option value="topical">Topical</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Indication</label>
                    <input
                      type="text"
                      value={newMedication.indication}
                      onChange={(e) => setNewMedication({ ...newMedication, indication: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Diabetes Type 2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <input
                        type="checkbox"
                        checked={newMedication.stop_before_surgery}
                        onChange={(e) => setNewMedication({ ...newMedication, stop_before_surgery: e.target.checked })}
                        className="mr-2"
                      />
                      Stop Before Surgery
                    </label>
                    {newMedication.stop_before_surgery && (
                      <input
                        type="number"
                        value={newMedication.stop_hours_before || ''}
                        onChange={(e) => setNewMedication({ ...newMedication, stop_hours_before: parseInt(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2"
                        placeholder="Hours before surgery"
                      />
                    )}
                  </div>
                </div>
                <button
                  onClick={addMedication}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Add Medication
                </button>
              </div>
            </div>
          )}

          {/* BLEEDING RISK TAB */}
          {activeTab === 'bleeding' && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-900 mb-2 flex items-center space-x-2">
                  <Droplet className="h-5 w-5" />
                  <span>Bleeding Risk Assessment</span>
                </h3>
                <p className="text-sm text-red-700">Assess patient's risk of perioperative bleeding based on medications, medical history, and laboratory values.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={bleedingRisk.anticoagulant_use || false}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, anticoagulant_use: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Anticoagulant Use</span>
                  </label>
                  {bleedingRisk.anticoagulant_use && (
                    <input
                      type="text"
                      value={bleedingRisk.anticoagulant_type || ''}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, anticoagulant_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Warfarin, Rivaroxaban"
                    />
                  )}
                </div>

                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={bleedingRisk.antiplatelet_use || false}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, antiplatelet_use: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Antiplatelet Use</span>
                  </label>
                  {bleedingRisk.antiplatelet_use && (
                    <input
                      type="text"
                      value={bleedingRisk.antiplatelet_type || ''}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, antiplatelet_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Aspirin, Clopidogrel"
                    />
                  )}
                </div>

                <div>
                  <label className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={bleedingRisk.bleeding_disorder || false}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, bleeding_disorder: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Bleeding Disorder</span>
                  </label>
                  {bleedingRisk.bleeding_disorder && (
                    <input
                      type="text"
                      value={bleedingRisk.bleeding_disorder_type || ''}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, bleeding_disorder_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Hemophilia A, von Willebrand disease"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={bleedingRisk.liver_disease || false}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, liver_disease: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Liver Disease</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={bleedingRisk.renal_impairment || false}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, renal_impairment: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Renal Impairment</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={bleedingRisk.recent_bleeding || false}
                      onChange={(e) => setBleedingRisk({ ...bleedingRisk, recent_bleeding: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">Recent Bleeding Episode</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Platelet Count (×10⁹/L)</label>
                  <input
                    type="number"
                    value={bleedingRisk.platelet_count || ''}
                    onChange={(e) => setBleedingRisk({ ...bleedingRisk, platelet_count: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="150-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">INR</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bleedingRisk.inr || ''}
                    onChange={(e) => setBleedingRisk({ ...bleedingRisk, inr: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="0.8-1.2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PT (seconds)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bleedingRisk.pt || ''}
                    onChange={(e) => setBleedingRisk({ ...bleedingRisk, pt: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="11-13.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">APTT (seconds)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={bleedingRisk.aptt || ''}
                    onChange={(e) => setBleedingRisk({ ...bleedingRisk, aptt: parseFloat(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="25-35"
                  />
                </div>
              </div>

              <button
                onClick={calculateBleedingRiskScore}
                className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <Activity className="h-5 w-5" />
                <span>Calculate Bleeding Risk Score</span>
              </button>

              {bleedingRisk.risk_level && (
                <div className={`p-4 rounded-lg border ${
                  bleedingRisk.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                  bleedingRisk.risk_level === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Bleeding Risk Result</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      bleedingRisk.risk_level === 'high' ? 'bg-red-200 text-red-800' :
                      bleedingRisk.risk_level === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {bleedingRisk.risk_level?.toUpperCase()} (Score: {bleedingRisk.risk_score})
                    </span>
                  </div>
                  {bleedingRisk.recommendations && bleedingRisk.recommendations.length > 0 && (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {bleedingRisk.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DVT RISK (CAPRINI) TAB */}
          {activeTab === 'dvt' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2 flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Caprini DVT Risk Assessment</span>
                </h3>
                <p className="text-sm text-purple-700">Score-based venous thromboembolism risk stratification for surgical patients.</p>
              </div>

              {/* 1 Point Factors */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">1 Point Each</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: 'age_41_60', label: 'Age 41-60' },
                    { key: 'minor_surgery', label: 'Minor surgery planned' },
                    { key: 'history_major_surgery', label: 'History of major surgery' },
                    { key: 'varicose_veins', label: 'Varicose veins' },
                    { key: 'history_inflammatory_bowel', label: 'Inflammatory bowel disease' },
                    { key: 'swollen_legs', label: 'Swollen legs (current)' },
                    { key: 'obesity_bmi_over_25', label: 'Obesity (BMI > 25)' },
                    { key: 'acute_mi', label: 'Acute MI' },
                    { key: 'chf_1_month', label: 'CHF (< 1 month)' },
                    { key: 'sepsis_1_month', label: 'Sepsis (< 1 month)' },
                    { key: 'serious_lung_disease', label: 'Serious lung disease (incl. pneumonia < 1 month)' },
                    { key: 'abnormal_pulmonary_function', label: 'Abnormal pulmonary function' },
                    { key: 'medical_patient_bed_rest', label: 'Medical patient on bed rest' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        checked={(dvtRisk as any)[item.key] || false}
                        onChange={(e) => setDvtRisk({ ...dvtRisk, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 2 Points Factors */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">2 Points Each</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: 'age_61_74', label: 'Age 61-74' },
                    { key: 'arthroscopic_surgery', label: 'Arthroscopic surgery' },
                    { key: 'malignancy', label: 'Malignancy (present or previous)' },
                    { key: 'major_surgery_over_45min', label: 'Major surgery (> 45 min)' },
                    { key: 'laparoscopic_over_45min', label: 'Laparoscopic surgery (> 45 min)' },
                    { key: 'patient_confined_to_bed', label: 'Patient confined to bed (> 72 hours)' },
                    { key: 'immobilizing_plaster_cast', label: 'Immobilizing plaster cast' },
                    { key: 'central_venous_access', label: 'Central venous access' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        checked={(dvtRisk as any)[item.key] || false}
                        onChange={(e) => setDvtRisk({ ...dvtRisk, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 3 Points Factors */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">3 Points Each</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: 'age_over_75', label: 'Age ≥ 75' },
                    { key: 'history_dvt_pe', label: 'History of DVT/PE' },
                    { key: 'family_history_dvt', label: 'Family history of thrombosis' },
                    { key: 'factor_v_leiden', label: 'Factor V Leiden' },
                    { key: 'prothrombin_20210a', label: 'Prothrombin 20210A' },
                    { key: 'lupus_anticoagulant', label: 'Lupus anticoagulant' },
                    { key: 'anticardiolipin_antibodies', label: 'Anticardiolipin antibodies' },
                    { key: 'heparin_induced_thrombocytopenia', label: 'Heparin-induced thrombocytopenia (HIT)' },
                    { key: 'other_thrombophilia', label: 'Other congenital/acquired thrombophilia' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        checked={(dvtRisk as any)[item.key] || false}
                        onChange={(e) => setDvtRisk({ ...dvtRisk, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 5 Points Factors */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">5 Points Each</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {[
                    { key: 'elective_major_lower_extremity_arthroplasty', label: 'Elective major lower extremity arthroplasty' },
                    { key: 'hip_pelvis_leg_fracture', label: 'Hip, pelvis, or leg fracture (< 1 month)' },
                    { key: 'stroke_1_month', label: 'Stroke (< 1 month)' },
                    { key: 'multiple_trauma', label: 'Multiple trauma (< 1 month)' },
                    { key: 'acute_spinal_cord_injury', label: 'Acute spinal cord injury (< 1 month)' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center space-x-2 p-1">
                      <input
                        type="checkbox"
                        checked={(dvtRisk as any)[item.key] || false}
                        onChange={(e) => setDvtRisk({ ...dvtRisk, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                onClick={calculateDVTScore}
                className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
              >
                <Activity className="h-5 w-5" />
                <span>Calculate Caprini Score</span>
              </button>

              {dvtRisk.risk_category && (
                <div className={`p-4 rounded-lg border ${
                  dvtRisk.risk_category === 'very-high' || dvtRisk.risk_category === 'high' ? 'bg-red-50 border-red-300' :
                  dvtRisk.risk_category === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">DVT Risk Result</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      dvtRisk.risk_category === 'very-high' || dvtRisk.risk_category === 'high' ? 'bg-red-200 text-red-800' :
                      dvtRisk.risk_category === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {dvtRisk.risk_category?.toUpperCase()} (Score: {dvtRisk.total_score})
                    </span>
                  </div>
                  {dvtRisk.prophylaxis_recommendation && (
                    <p className="text-sm mt-2"><strong>Prophylaxis:</strong> {dvtRisk.prophylaxis_recommendation}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* CARDIAC RISK TAB */}
          {activeTab === 'cardiac' && (
            <div className="space-y-6">
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <h3 className="font-semibold text-pink-900 mb-2 flex items-center space-x-2">
                  <Heart className="h-5 w-5" />
                  <span>Cardiovascular Risk Assessment (RCRI)</span>
                </h3>
                <p className="text-sm text-pink-700">Revised Cardiac Risk Index for predicting major cardiac complications in non-cardiac surgery.</p>
              </div>

              {/* RCRI Factors */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">RCRI Criteria (1 point each)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { key: 'high_risk_surgery', label: 'High-risk surgery (intraperitoneal, intrathoracic, suprainguinal vascular)' },
                    { key: 'ischemic_heart_disease', label: 'Ischemic heart disease' },
                    { key: 'history_chf', label: 'History of congestive heart failure' },
                    { key: 'history_cerebrovascular_disease', label: 'History of cerebrovascular disease' },
                    { key: 'diabetes_on_insulin', label: 'Diabetes mellitus on insulin' },
                    { key: 'preop_creatinine_over_2', label: 'Preoperative creatinine > 2 mg/dL' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center space-x-2 p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        checked={(cardiacRisk as any)[item.key] || false}
                        onChange={(e) => setCardiacRisk({ ...cardiacRisk, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Additional Factors */}
              <div className="bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-3">Additional Risk Factors</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { key: 'hypertension', label: 'Hypertension' },
                    { key: 'smoking', label: 'Current smoker' },
                    { key: 'age_over_65', label: 'Age > 65 years' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center space-x-2 p-2 bg-white rounded border">
                      <input
                        type="checkbox"
                        checked={(cardiacRisk as any)[item.key] || false}
                        onChange={(e) => setCardiacRisk({ ...cardiacRisk, [item.key]: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Vitals & Labs */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded-lg border">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Systolic BP</label>
                  <input type="number" value={cardiacRisk.systolic_bp || ''} onChange={(e) => setCardiacRisk({ ...cardiacRisk, systolic_bp: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="mmHg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diastolic BP</label>
                  <input type="number" value={cardiacRisk.diastolic_bp || ''} onChange={(e) => setCardiacRisk({ ...cardiacRisk, diastolic_bp: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="mmHg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate</label>
                  <input type="number" value={cardiacRisk.heart_rate || ''} onChange={(e) => setCardiacRisk({ ...cardiacRisk, heart_rate: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="bpm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Creatinine</label>
                  <input type="number" step="0.1" value={cardiacRisk.creatinine || ''} onChange={(e) => setCardiacRisk({ ...cardiacRisk, creatinine: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="mg/dL" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HbA1c</label>
                  <input type="number" step="0.1" value={cardiacRisk.hba1c || ''} onChange={(e) => setCardiacRisk({ ...cardiacRisk, hba1c: parseFloat(e.target.value) })} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="%" />
                </div>
              </div>

              <button
                onClick={calculateCardiacScore}
                className="bg-pink-600 text-white px-6 py-3 rounded-lg hover:bg-pink-700 transition-colors flex items-center space-x-2"
              >
                <Heart className="h-5 w-5" />
                <span>Calculate Cardiac Risk (RCRI)</span>
              </button>

              {cardiacRisk.risk_level && (
                <div className={`p-4 rounded-lg border ${
                  cardiacRisk.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                  cardiacRisk.risk_level === 'intermediate' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Cardiac Risk Result</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      cardiacRisk.risk_level === 'high' ? 'bg-red-200 text-red-800' :
                      cardiacRisk.risk_level === 'intermediate' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {cardiacRisk.risk_level?.toUpperCase()} (RCRI: {cardiacRisk.rcri_score})
                    </span>
                  </div>
                  <p className="text-sm mb-2">Estimated cardiac event risk: <strong>{cardiacRisk.cardiac_event_risk_percent}%</strong></p>
                  {cardiacRisk.recommendations && cardiacRisk.recommendations.length > 0 && (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {cardiacRisk.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PRESSURE SORE RISK TAB */}
          {activeTab === 'pressure' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h3 className="font-semibold text-orange-900 mb-2 flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Pressure Sore Risk Assessment (Braden Scale)</span>
                </h3>
                <p className="text-sm text-orange-700">Score range 6-23. Lower scores indicate higher risk. ≤9 = Severe, 10-12 = High, 13-14 = Moderate, 15-18 = Low, ≥19 = No risk.</p>
              </div>

              <div className="space-y-4">
                {/* Sensory Perception */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Sensory Perception</h4>
                  <p className="text-xs text-gray-500 mb-3">Ability to respond meaningfully to pressure-related discomfort</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { val: 1, label: '1 - Completely Limited' },
                      { val: 2, label: '2 - Very Limited' },
                      { val: 3, label: '3 - Slightly Limited' },
                      { val: 4, label: '4 - No Impairment' },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${pressureRisk.sensory_perception === opt.val ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                        <input type="radio" name="sensory" checked={pressureRisk.sensory_perception === opt.val} onChange={() => setPressureRisk({ ...pressureRisk, sensory_perception: opt.val as any })} className="text-green-600" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Moisture */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Moisture</h4>
                  <p className="text-xs text-gray-500 mb-3">Degree to which skin is exposed to moisture</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { val: 1, label: '1 - Constantly Moist' },
                      { val: 2, label: '2 - Very Moist' },
                      { val: 3, label: '3 - Occasionally Moist' },
                      { val: 4, label: '4 - Rarely Moist' },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${pressureRisk.moisture === opt.val ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                        <input type="radio" name="moisture" checked={pressureRisk.moisture === opt.val} onChange={() => setPressureRisk({ ...pressureRisk, moisture: opt.val as any })} className="text-green-600" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Activity */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Activity</h4>
                  <p className="text-xs text-gray-500 mb-3">Degree of physical activity</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { val: 1, label: '1 - Bedfast' },
                      { val: 2, label: '2 - Chairfast' },
                      { val: 3, label: '3 - Walks Occasionally' },
                      { val: 4, label: '4 - Walks Frequently' },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${pressureRisk.activity === opt.val ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                        <input type="radio" name="activity" checked={pressureRisk.activity === opt.val} onChange={() => setPressureRisk({ ...pressureRisk, activity: opt.val as any })} className="text-green-600" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Mobility */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Mobility</h4>
                  <p className="text-xs text-gray-500 mb-3">Ability to change and control body position</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { val: 1, label: '1 - Completely Immobile' },
                      { val: 2, label: '2 - Very Limited' },
                      { val: 3, label: '3 - Slightly Limited' },
                      { val: 4, label: '4 - No Limitations' },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${pressureRisk.mobility === opt.val ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                        <input type="radio" name="mobility" checked={pressureRisk.mobility === opt.val} onChange={() => setPressureRisk({ ...pressureRisk, mobility: opt.val as any })} className="text-green-600" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Nutrition */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Nutrition</h4>
                  <p className="text-xs text-gray-500 mb-3">Usual food intake pattern</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { val: 1, label: '1 - Very Poor' },
                      { val: 2, label: '2 - Probably Inadequate' },
                      { val: 3, label: '3 - Adequate' },
                      { val: 4, label: '4 - Excellent' },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${pressureRisk.nutrition === opt.val ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                        <input type="radio" name="nutrition" checked={pressureRisk.nutrition === opt.val} onChange={() => setPressureRisk({ ...pressureRisk, nutrition: opt.val as any })} className="text-green-600" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Friction & Shear */}
                <div className="bg-gray-50 border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Friction & Shear</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: 1, label: '1 - Problem' },
                      { val: 2, label: '2 - Potential Problem' },
                      { val: 3, label: '3 - No Apparent Problem' },
                    ].map(opt => (
                      <label key={opt.val} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${pressureRisk.friction_shear === opt.val ? 'bg-green-100 border-green-500' : 'bg-white'}`}>
                        <input type="radio" name="friction" checked={pressureRisk.friction_shear === opt.val} onChange={() => setPressureRisk({ ...pressureRisk, friction_shear: opt.val as any })} className="text-green-600" />
                        <span className="text-sm">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={calculatePressureRiskScore}
                className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors flex items-center space-x-2"
              >
                <AlertTriangle className="h-5 w-5" />
                <span>Calculate Braden Score</span>
              </button>

              {pressureRisk.risk_category && (
                <div className={`p-4 rounded-lg border ${
                  pressureRisk.risk_category === 'severe' || pressureRisk.risk_category === 'high' ? 'bg-red-50 border-red-300' :
                  pressureRisk.risk_category === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Braden Score Result</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      pressureRisk.risk_category === 'severe' || pressureRisk.risk_category === 'high' ? 'bg-red-200 text-red-800' :
                      pressureRisk.risk_category === 'moderate' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-green-200 text-green-800'
                    }`}>
                      {pressureRisk.risk_category?.toUpperCase()} (Score: {pressureRisk.braden_total})
                    </span>
                  </div>
                  {pressureRisk.preventive_measures && pressureRisk.preventive_measures.length > 0 && (
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {pressureRisk.preventive_measures.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* COMORBIDITIES TAB */}
          {activeTab === 'comorbidities' && (
            <div className="space-y-6">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <h3 className="font-semibold text-indigo-900 mb-2 flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Comorbidities & Associated Medications</span>
                </h3>
                <p className="text-sm text-indigo-700">Document patient's comorbid conditions and their associated medications for perioperative management.</p>
              </div>

              {/* Add Comorbidity */}
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Comorbidity</label>
                  <select
                    value={selectedComorbidity}
                    onChange={(e) => setSelectedComorbidity(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">-- Select --</option>
                    {[
                      'Hypertension', 'Diabetes Mellitus Type 1', 'Diabetes Mellitus Type 2',
                      'Coronary Artery Disease', 'Congestive Heart Failure', 'Atrial Fibrillation',
                      'Chronic Kidney Disease', 'Dialysis Dependent', 'COPD', 'Asthma',
                      'Liver Cirrhosis', 'Chronic Hepatitis', 'HIV/AIDS',
                      'Sickle Cell Disease', 'Epilepsy', 'Stroke/TIA', 'DVT/PE History',
                      'Obesity (BMI > 30)', 'Malignancy', 'Rheumatoid Arthritis',
                      'Systemic Lupus Erythematosus', 'Thyroid Disease', 'Bleeding Disorder',
                      'Psychiatric Disorder', 'Substance Use Disorder', 'Other'
                    ].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addComorbidityMedication}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Comorbidity List */}
              {comorbidityMeds.length > 0 ? (
                <div className="space-y-4">
                  {comorbidityMeds.map((cm, cIdx) => (
                    <div key={cIdx} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-900">{cm.comorbidity}</h4>
                        <button
                          onClick={() => setComorbidityMeds(comorbidityMeds.filter((_, i) => i !== cIdx))}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      {cm.medications.length > 0 && (
                        <div className="mb-3 space-y-1">
                          {cm.medications.map((med, mIdx) => (
                            <div key={mIdx} className="text-sm text-gray-700 flex items-center justify-between bg-gray-50 px-3 py-1 rounded">
                              <span>{med.drug_name} - {med.dosage} {med.frequency}</span>
                              <button
                                onClick={() => {
                                  const updated = [...comorbidityMeds];
                                  updated[cIdx].medications = updated[cIdx].medications.filter((_, i) => i !== mIdx);
                                  setComorbidityMeds(updated);
                                }}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Drug name"
                          id={`cm-drug-${cIdx}`}
                          className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Dosage"
                          id={`cm-dose-${cIdx}`}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <input
                          type="text"
                          placeholder="Frequency"
                          id={`cm-freq-${cIdx}`}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            const drug = (document.getElementById(`cm-drug-${cIdx}`) as HTMLInputElement)?.value;
                            const dose = (document.getElementById(`cm-dose-${cIdx}`) as HTMLInputElement)?.value;
                            const freq = (document.getElementById(`cm-freq-${cIdx}`) as HTMLInputElement)?.value;
                            if (drug) {
                              addMedicationToComorbidity(cIdx, {
                                drug_name: drug, dosage: dose || '', frequency: freq || '',
                                route: 'oral', indication: cm.comorbidity
                              });
                              (document.getElementById(`cm-drug-${cIdx}`) as HTMLInputElement).value = '';
                              (document.getElementById(`cm-dose-${cIdx}`) as HTMLInputElement).value = '';
                              (document.getElementById(`cm-freq-${cIdx}`) as HTMLInputElement).value = '';
                            }
                          }}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No comorbidities added yet. Select one above to begin.</p>
                </div>
              )}
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <h3 className="font-semibold text-teal-900 mb-2 flex items-center space-x-2">
                  <FileCheck className="h-5 w-5" />
                  <span>Documents & Consent</span>
                </h3>
                <p className="text-sm text-teal-700">Upload consent forms, payment evidence, and insurance documentation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Consent Document */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Informed Consent Form</h4>
                  {consentDocument ? (
                    <div className="space-y-2">
                      <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-green-800">Consent document uploaded</span>
                      </div>
                      <button onClick={() => setConsentDocument('')} className="text-sm text-red-600 hover:text-red-800">
                        Remove & Re-upload
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Click to upload consent form</span>
                        <span className="text-xs text-gray-400">PDF, JPG, PNG</span>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'consent')} />
                      </label>
                    </div>
                  )}
                </div>

                {/* Payment Evidence */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Payment Evidence / Deposit</h4>
                  {paymentEvidence ? (
                    <div className="space-y-2">
                      <div className="bg-green-50 border border-green-200 rounded p-3 flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span className="text-sm text-green-800">Payment evidence uploaded</span>
                      </div>
                      <button onClick={() => setPaymentEvidence('')} className="text-sm text-red-600 hover:text-red-800">
                        Remove & Re-upload
                      </button>
                    </div>
                  ) : (
                    <div>
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                        <Upload className="h-8 w-8 text-gray-400 mb-2" />
                        <span className="text-sm text-gray-500">Click to upload payment receipt</span>
                        <span className="text-xs text-gray-400">PDF, JPG, PNG</span>
                        <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => handleFileUpload(e, 'payment')} />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Insurance */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={insuranceCovered}
                    onChange={(e) => setInsuranceCovered(e.target.checked)}
                    className="rounded border-gray-300 h-5 w-5 text-green-600"
                  />
                  <div>
                    <span className="font-medium text-gray-800">Insurance Covered</span>
                    <p className="text-sm text-gray-500">Check if this procedure is covered by patient's insurance</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* SUMMARY TAB */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2 flex items-center space-x-2">
                  <Eye className="h-5 w-5" />
                  <span>Summary & Instructions</span>
                </h3>
                <p className="text-sm text-green-700">Review all risk scores and generate comprehensive pre-operative summary and patient instructions.</p>
              </div>

              {/* Risk Scores Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className={`p-4 rounded-lg border text-center ${
                  bleedingRisk.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                  bleedingRisk.risk_level === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  bleedingRisk.risk_level ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <Droplet className="h-6 w-6 mx-auto mb-1 text-red-500" />
                  <p className="text-xs text-gray-500">Bleeding Risk</p>
                  <p className="font-bold text-lg">{bleedingRisk.risk_score ?? '—'}</p>
                  <p className="text-sm font-semibold capitalize">{bleedingRisk.risk_level || 'Not assessed'}</p>
                </div>

                <div className={`p-4 rounded-lg border text-center ${
                  dvtRisk.risk_category === 'very-high' || dvtRisk.risk_category === 'high' ? 'bg-red-50 border-red-300' :
                  dvtRisk.risk_category === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  dvtRisk.risk_category ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <Activity className="h-6 w-6 mx-auto mb-1 text-purple-500" />
                  <p className="text-xs text-gray-500">DVT (Caprini)</p>
                  <p className="font-bold text-lg">{dvtRisk.total_score ?? '—'}</p>
                  <p className="text-sm font-semibold capitalize">{dvtRisk.risk_category || 'Not assessed'}</p>
                </div>

                <div className={`p-4 rounded-lg border text-center ${
                  cardiacRisk.risk_level === 'high' ? 'bg-red-50 border-red-300' :
                  cardiacRisk.risk_level === 'intermediate' ? 'bg-yellow-50 border-yellow-300' :
                  cardiacRisk.risk_level ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <Heart className="h-6 w-6 mx-auto mb-1 text-pink-500" />
                  <p className="text-xs text-gray-500">Cardiac (RCRI)</p>
                  <p className="font-bold text-lg">{cardiacRisk.rcri_score ?? '—'}</p>
                  <p className="text-sm font-semibold capitalize">{cardiacRisk.risk_level || 'Not assessed'}</p>
                </div>

                <div className={`p-4 rounded-lg border text-center ${
                  pressureRisk.risk_category === 'severe' || pressureRisk.risk_category === 'high' ? 'bg-red-50 border-red-300' :
                  pressureRisk.risk_category === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  pressureRisk.risk_category ? 'bg-green-50 border-green-300' : 'bg-gray-50 border-gray-200'
                }`}>
                  <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-orange-500" />
                  <p className="text-xs text-gray-500">Pressure (Braden)</p>
                  <p className="font-bold text-lg">{pressureRisk.braden_total ?? '—'}</p>
                  <p className="text-sm font-semibold capitalize">{pressureRisk.risk_category || 'Not assessed'}</p>
                </div>
              </div>

              {/* Generate Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={generateComprehensiveSummary}
                  disabled={generating}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <FileText className="h-5 w-5" />
                  <span>{generating ? 'Generating...' : 'Generate Comprehensive Summary'}</span>
                </button>
                <button
                  onClick={generatePreopInstructions}
                  disabled={generating}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <Download className="h-5 w-5" />
                  <span>{generating ? 'Generating...' : 'Generate Pre-op Instructions'}</span>
                </button>
              </div>

              {/* Summary View */}
              {comprehensiveSummary && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Comprehensive Summary</h4>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">{comprehensiveSummary}</div>
                </div>
              )}

              {/* Instructions View */}
              {preopInstructions && (
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Pre-operative Instructions</h4>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">{preopInstructions}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-900 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={saveAssessment}
            className="bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <CheckCircle className="h-5 w-5" />
            <span>Save Assessment</span>
          </button>
        </div>
      </div>
    </div>
  );
}

              {bleedingRisk.risk_level && (
                <div className={`p-4 rounded-lg border-2 ${
                  bleedingRisk.risk_level === 'low' ? 'bg-green-50 border-green-300' :
                  bleedingRisk.risk_level === 'moderate' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-red-50 border-red-300'
                }`}>
                  <h4 className="font-bold text-lg mb-2">
                    Risk Level: <span className="uppercase">{bleedingRisk.risk_level}</span> (Score: {bleedingRisk.risk_score})
                  </h4>
                  {bleedingRisk.recommendations && bleedingRisk.recommendations.length > 0 && (
                    <div className="mt-3">
                      <p className="font-semibold mb-2">Recommendations:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {bleedingRisk.recommendations.map((rec, index) => (
                          <li key={index} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DVT RISK TAB - I'll continue with the rest in the next message due to length */}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center space-x-3">
            <button
              onClick={saveAssessment}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
            >
              <CheckCircle className="h-5 w-5" />
              <span>Save Assessment</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
