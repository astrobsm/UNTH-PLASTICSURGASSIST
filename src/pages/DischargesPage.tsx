import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { admissionService, Admission } from '../services/admissionService';
import { dischargeService, Discharge, DischargeInstructionsData, DischargeMedication } from '../services/dischargeService';

const DISCHARGE_STATUSES = [
  { value: 'improved', label: 'Improved' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'against_medical_advice', label: 'Against Medical Advice' },
  { value: 'deceased', label: 'Deceased' }
];

const DISCHARGE_DESTINATIONS = [
  { value: 'home', label: 'Home' },
  { value: 'another_facility', label: 'Another Facility' },
  { value: 'mortuary', label: 'Mortuary' },
  { value: 'other', label: 'Other' }
];

const CLINICS = [
  'Outpatient Clinic',
  'Hand Clinic',
  'Burns Clinic',
  'Wound Clinic',
  'Reconstructive Clinic'
];

const CONSULTANTS = [
  'Dr Okwesili',
  'Dr Nnadi',
  'Dr Eze C. B'
];

export default function DischargesPage() {
  const [activeTab, setActiveTab] = useState<'discharge' | 'history'>('discharge');
  const [activeAdmissions, setActiveAdmissions] = useState<Admission[]>([]);
  const [discharges, setDischarges] = useState<Discharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingInstructions, setGeneratingInstructions] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Form state
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [dischargeStatus, setDischargeStatus] = useState<'improved' | 'recovered' | 'transferred' | 'against_medical_advice' | 'deceased'>('improved');
  const [dischargeDestination, setDischargeDestination] = useState<'home' | 'another_facility' | 'mortuary' | 'other'>('home');
  const [dischargePlans, setDischargePlans] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpClinic, setFollowUpClinic] = useState('');
  const [followUpInstructions, setFollowUpInstructions] = useState('');
  const [medications, setMedications] = useState<DischargeMedication[]>([]);
  const [dietaryRecommendations, setDietaryRecommendations] = useState('');
  const [lifestyleModifications, setLifestyleModifications] = useState('');
  const [activityRestrictions, setActivityRestrictions] = useState('');
  const [woundCareInstructions, setWoundCareInstructions] = useState('');
  const [warningSigns, setWarningSigns] = useState('');
  const [aiGeneratedInstructions, setAiGeneratedInstructions] = useState('');
  const [dischargingConsultant, setDischargingConsultant] = useState('');

  useEffect(() => {
    loadActiveAdmissions();
    loadDischarges();
  }, []);

  const loadActiveAdmissions = async () => {
    const admissions = await admissionService.getActiveAdmissions();
    setActiveAdmissions(admissions);
  };

  const loadDischarges = async () => {
    const allDischarges = await dischargeService.getAllDischarges();
    setDischarges(allDischarges);
  };

  const handleAdmissionSelect = async (admissionId: number) => {
    const admission = activeAdmissions.find(a => a.id === admissionId);
    if (admission) {
      setSelectedAdmission(admission);
      setFinalDiagnosis(admission.provisional_diagnosis || '');
    }
  };

  const addMedication = () => {
    setMedications([
      ...medications,
      { medication: '', dosage: '', frequency: '', duration: '', instructions: '' }
    ]);
  };

  const removeMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const updateMedication = (index: number, field: keyof DischargeMedication, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleGenerateInstructions = async () => {
    if (!selectedAdmission) return;

    setGeneratingInstructions(true);

    try {
      const patient = await db.patients.get(selectedAdmission.patient_id);
      if (!patient) throw new Error('Patient not found');

      const instructionsData: DischargeInstructionsData = {
        patient_name: selectedAdmission.patient_name,
        age: patient.age || 0,
        gender: patient.gender || 'Unknown',
        hospital_number: selectedAdmission.hospital_number,
        admission_date: selectedAdmission.admission_date,
        discharge_date: new Date().toISOString().split('T')[0],
        admitting_diagnosis: selectedAdmission.provisional_diagnosis || '',
        final_diagnosis: finalDiagnosis,
        procedures_performed: selectedAdmission.initial_management_plan || '',
        medications_on_discharge: medications,
        complications: '',
        treatment_summary: dischargePlans
      };

      const instructions = await dischargeService.generateDischargeInstructions(instructionsData);
      setAiGeneratedInstructions(instructions);

      // Auto-populate recommendation fields if they're empty
      if (!dietaryRecommendations) {
        setDietaryRecommendations('High-protein diet (eggs, fish, lean meat, beans), 8-10 glasses of water daily, fruits and vegetables, avoid alcohol and smoking');
      }
      if (!activityRestrictions) {
        setActivityRestrictions('Adequate rest, gradual increase in activity, avoid heavy lifting for 2-4 weeks');
      }
      if (!warningSigns) {
        setWarningSigns('Fever >38°C, increasing pain, redness/swelling/discharge from wound, bleeding, difficulty breathing, chest pain');
      }
    } catch (error) {
      console.error('Error generating instructions:', error);
      alert('Failed to generate discharge instructions');
    } finally {
      setGeneratingInstructions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdmission) {
      alert('Please select a patient for discharge');
      return;
    }

    if (!finalDiagnosis || !dischargePlans || !dischargingConsultant) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const patient = await db.patients.get(selectedAdmission.patient_id);
      if (!patient) throw new Error('Patient not found');

      const admissionDate = new Date(selectedAdmission.admission_date);
      const dischargeDate = new Date();
      const lengthOfStay = Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));

      const dischargeData: Omit<Discharge, 'id' | 'created_at' | 'updated_at'> = {
        admission_id: selectedAdmission.id!,
        patient_id: selectedAdmission.patient_id,
        patient_name: selectedAdmission.patient_name,
        hospital_number: selectedAdmission.hospital_number,
        age: patient.age || 0,
        gender: patient.gender || 'Unknown',
        admission_date: selectedAdmission.admission_date,
        discharge_date: dischargeDate.toISOString().split('T')[0],
        discharge_time: dischargeDate.toTimeString().split(' ')[0],
        length_of_stay_days: lengthOfStay,
        admitting_diagnosis: selectedAdmission.provisional_diagnosis || '',
        final_diagnosis: finalDiagnosis,
        discharge_status: dischargeStatus,
        discharge_destination: dischargeDestination,
        discharge_plans: dischargePlans,
        follow_up_date: followUpDate || undefined,
        follow_up_clinic: followUpClinic || undefined,
        follow_up_instructions: followUpInstructions || undefined,
        medications_on_discharge: medications.filter(m => m.medication.trim() !== ''),
        dietary_recommendations: dietaryRecommendations || undefined,
        lifestyle_modifications: lifestyleModifications || undefined,
        activity_restrictions: activityRestrictions || undefined,
        wound_care_instructions: woundCareInstructions || undefined,
        warning_signs: warningSigns || undefined,
        emergency_contact_info: 'Emergency: Call hospital at +234-XXX-XXX-XXXX',
        ai_generated_instructions: aiGeneratedInstructions || undefined,
        discharging_doctor: 'Current User', // TODO: Get from auth context
        discharging_consultant: dischargingConsultant
      };

      await dischargeService.createDischarge(dischargeData);

      alert('Patient discharged successfully!');
      resetForm();
      setActiveTab('history');
      loadActiveAdmissions();
      loadDischarges();
    } catch (error) {
      console.error('Error discharging patient:', error);
      alert('Failed to discharge patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndGeneratePDF = async () => {
    // First save the discharge
    const form = document.querySelector('form');
    if (form) {
      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
      form.dispatchEvent(submitEvent);
      
      // Wait for save to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!selectedAdmission) return;

      setGeneratingPDF(true);

      try {
        const patient = await db.patients.get(selectedAdmission.patient_id);
        if (!patient) throw new Error('Patient not found');

        const admissionDate = new Date(selectedAdmission.admission_date);
        const dischargeDate = new Date();
        const lengthOfStay = Math.ceil((dischargeDate.getTime() - admissionDate.getTime()) / (1000 * 60 * 60 * 24));

        const dischargeData: Omit<Discharge, 'id' | 'created_at' | 'updated_at'> = {
          admission_id: selectedAdmission.id!,
          patient_id: selectedAdmission.patient_id,
          patient_name: selectedAdmission.patient_name,
          hospital_number: selectedAdmission.hospital_number,
          age: patient.age || 0,
          gender: patient.gender || 'Unknown',
          admission_date: selectedAdmission.admission_date,
          discharge_date: dischargeDate.toISOString().split('T')[0],
          discharge_time: dischargeDate.toTimeString().split(' ')[0],
          length_of_stay_days: lengthOfStay,
          admitting_diagnosis: selectedAdmission.provisional_diagnosis || '',
          final_diagnosis: finalDiagnosis,
          discharge_status: dischargeStatus,
          discharge_destination: dischargeDestination,
          discharge_plans: dischargePlans,
          follow_up_date: followUpDate || undefined,
          follow_up_clinic: followUpClinic || undefined,
          follow_up_instructions: followUpInstructions || undefined,
          medications_on_discharge: medications.filter(m => m.medication.trim() !== ''),
          dietary_recommendations: dietaryRecommendations || undefined,
          lifestyle_modifications: lifestyleModifications || undefined,
          activity_restrictions: activityRestrictions || undefined,
          wound_care_instructions: woundCareInstructions || undefined,
          warning_signs: warningSigns || undefined,
          emergency_contact_info: 'Emergency: Call hospital at +234-XXX-XXX-XXXX',
          ai_generated_instructions: aiGeneratedInstructions || undefined,
          discharging_doctor: 'Current User',
          discharging_consultant: dischargingConsultant
        };

        await dischargeService.generateDischargePDF(dischargeData as Discharge);
        alert('Discharge PDF generated successfully!');
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again.');
      } finally {
        setGeneratingPDF(false);
      }
    }
  };

  const handleRegeneratePDF = async (discharge: Discharge) => {
    setGeneratingPDF(true);
    try {
      await dischargeService.generateDischargePDF(discharge);
      alert('PDF regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      alert('Failed to regenerate PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const resetForm = () => {
    setSelectedAdmission(null);
    setFinalDiagnosis('');
    setDischargeStatus('improved');
    setDischargeDestination('home');
    setDischargePlans('');
    setFollowUpDate('');
    setFollowUpClinic('');
    setFollowUpInstructions('');
    setMedications([]);
    setDietaryRecommendations('');
    setLifestyleModifications('');
    setActivityRestrictions('');
    setWoundCareInstructions('');
    setWarningSigns('');
    setAiGeneratedInstructions('');
    setDischargingConsultant('');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
          <h1 className="text-3xl font-bold">PLASTIC AND RECONSTRUCTIVE SURGERY UNIT</h1>
          <h2 className="text-xl mt-2">Patient Discharges</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('discharge')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'discharge'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Discharge Patient
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'history'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Discharge History
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Discharge Patient Tab */}
          {activeTab === 'discharge' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Selection */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Patient for Discharge</h3>
                <div>
                  <select
                    value={selectedAdmission?.id || ''}
                    onChange={(e) => handleAdmissionSelect(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    required
                  >
                    <option value="">-- Select Patient --</option>
                    {activeAdmissions.map((admission) => (
                      <option key={admission.id} value={admission.id}>
                        {admission.patient_name} ({admission.hospital_number}) - {admission.ward_location}, Bed {admission.bed_number} - Admitted {new Date(admission.admission_date).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedAdmission && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded border border-gray-200">
                    <div>
                      <p className="text-xs text-gray-500">Patient Name</p>
                      <p className="font-semibold">{selectedAdmission.patient_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Hospital Number</p>
                      <p className="font-semibold">{selectedAdmission.hospital_number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Admission Date</p>
                      <p className="font-semibold">{new Date(selectedAdmission.admission_date).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Admitting Diagnosis</p>
                      <p className="font-semibold">{selectedAdmission.provisional_diagnosis}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedAdmission && (
                <>
                  {/* Discharge Information */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Discharge Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Final Diagnosis <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={finalDiagnosis}
                          onChange={(e) => setFinalDiagnosis(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discharging Consultant <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={dischargingConsultant}
                          onChange={(e) => setDischargingConsultant(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          required
                        >
                          <option value="">-- Select Consultant --</option>
                          {CONSULTANTS.map((consultant) => (
                            <option key={consultant} value={consultant}>{consultant}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discharge Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={dischargeStatus}
                          onChange={(e) => setDischargeStatus(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          required
                        >
                          {DISCHARGE_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>{status.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discharge Destination <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={dischargeDestination}
                          onChange={(e) => setDischargeDestination(e.target.value as any)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          required
                        >
                          {DISCHARGE_DESTINATIONS.map((dest) => (
                            <option key={dest.value} value={dest.value}>{dest.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Discharge Plans <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={dischargePlans}
                          onChange={(e) => setDischargePlans(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          placeholder="Summarize overall outcome and plans..."
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Medications on Discharge */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Medications on Discharge</h3>
                      <button
                        type="button"
                        onClick={addMedication}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                      >
                        + Add Medication
                      </button>
                    </div>
                    {medications.length === 0 ? (
                      <p className="text-gray-500 text-sm">No medications added</p>
                    ) : (
                      <div className="space-y-3">
                        {medications.map((med, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-white p-3 rounded border border-gray-200">
                            <input
                              type="text"
                              placeholder="Medication"
                              value={med.medication}
                              onChange={(e) => updateMedication(index, 'medication', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Dosage"
                              value={med.dosage}
                              onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Frequency"
                              value={med.frequency}
                              onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Duration"
                              value={med.duration}
                              onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <input
                              type="text"
                              placeholder="Instructions"
                              value={med.instructions}
                              onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeMedication(index)}
                              className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Follow-up Appointment */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Follow-up Appointment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Date</label>
                        <input
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Clinic</label>
                        <select
                          value={followUpClinic}
                          onChange={(e) => setFollowUpClinic(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        >
                          <option value="">-- Select Clinic --</option>
                          {CLINICS.map((clinic) => (
                            <option key={clinic} value={clinic}>{clinic}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Follow-up Instructions</label>
                        <input
                          type="text"
                          value={followUpInstructions}
                          onChange={(e) => setFollowUpInstructions(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          placeholder="e.g., Bring X-rays"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AI-Generated Instructions */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">AI-Powered Discharge Instructions</h3>
                      <button
                        type="button"
                        onClick={handleGenerateInstructions}
                        disabled={generatingInstructions}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                      >
                        {generatingInstructions ? 'Generating...' : '✨ Generate Instructions'}
                      </button>
                    </div>
                    {aiGeneratedInstructions ? (
                      <textarea
                        value={aiGeneratedInstructions}
                        onChange={(e) => setAiGeneratedInstructions(e.target.value)}
                        rows={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white"
                      />
                    ) : (
                      <p className="text-gray-600 text-sm">Click "Generate Instructions" to create comprehensive AI-powered discharge instructions based on the patient's diagnosis and treatment.</p>
                    )}
                  </div>

                  {/* Additional Recommendations */}
                  <details className="bg-gray-50 p-4 rounded-lg">
                    <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
                      Additional Recommendations (Optional)
                    </summary>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Recommendations</label>
                        <textarea
                          value={dietaryRecommendations}
                          onChange={(e) => setDietaryRecommendations(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Lifestyle Modifications</label>
                        <textarea
                          value={lifestyleModifications}
                          onChange={(e) => setLifestyleModifications(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Activity Restrictions</label>
                        <textarea
                          value={activityRestrictions}
                          onChange={(e) => setActivityRestrictions(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Wound Care Instructions</label>
                        <textarea
                          value={woundCareInstructions}
                          onChange={(e) => setWoundCareInstructions(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Warning Signs</label>
                        <textarea
                          value={warningSigns}
                          onChange={(e) => setWarningSigns(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                        />
                      </div>
                    </div>
                  </details>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                      Clear Form
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                    >
                      {loading ? 'Saving...' : 'Save Discharge'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAndGeneratePDF}
                      disabled={generatingPDF}
                      className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {generatingPDF ? 'Generating PDF...' : '📄 Save & Generate PDF'}
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Discharge History Tab */}
          {activeTab === 'history' && (
            <div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Discharge Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Final Diagnosis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Destination
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        LOS
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {discharges.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          No discharge records found
                        </td>
                      </tr>
                    ) : (
                      discharges.map((discharge) => (
                        <tr key={discharge.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{discharge.patient_name}</div>
                            <div className="text-sm text-gray-500">{discharge.hospital_number}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(discharge.discharge_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs truncate">{discharge.final_diagnosis}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              discharge.discharge_status === 'recovered' || discharge.discharge_status === 'improved' 
                                ? 'bg-green-100 text-green-800'
                                : discharge.discharge_status === 'transferred'
                                ? 'bg-blue-100 text-blue-800'
                                : discharge.discharge_status === 'deceased'
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {discharge.discharge_status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {discharge.discharge_destination.replace('_', ' ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {discharge.length_of_stay_days} days
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-green-600 hover:text-green-900 mr-3">View</button>
                            <button
                              onClick={() => handleRegeneratePDF(discharge)}
                              disabled={generatingPDF}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Re-generate PDF
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
