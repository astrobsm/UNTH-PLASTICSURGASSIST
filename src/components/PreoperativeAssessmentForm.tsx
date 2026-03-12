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

      // Load existing assessment if available
      const existing = await db.preoperative_assessments
        .where('patient_id').equals(patientId)
        .and(a => surgeryBookingId ? a.surgery_booking_id === surgeryBookingId : true)
        .first();

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
        assessed_by: localStorage.getItem('user_id') || 'current_user',
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
      
      const instructions = await preoperativeService.generatePreoperativeInstructions({
        patient,
        surgery: surgery || {},
        anaesthesia_type: surgery?.anaesthesia_type || 'general',
        medications,
        comorbidities: patient?.comorbidities || [],
        bleeding_risk: bleedingRisk as BleedingRiskAssessment,
        dvt_risk: dvtRisk as CapriniDVTRisk,
        cardiovascular_risk: cardiacRisk as CardiovascularRiskAssessment
      });

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
        assessed_by: localStorage.getItem('user_id') || 'current_user',
        assessed_at: new Date(),
        updated_at: new Date()
      };

      const localId = await db.preoperative_assessments.add(assessment);
      // Queue for cloud sync
      await syncService.queueAction('create', 'preoperative_assessments', localId as number, assessment);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-green-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Preoperative Assessment</h2>
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
