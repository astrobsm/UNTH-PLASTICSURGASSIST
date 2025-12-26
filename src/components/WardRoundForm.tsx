import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar, FileText, Activity, AlertCircle, TrendingUp, Pill, Stethoscope, ClipboardList, Users } from 'lucide-react';
import { wardRoundsService, WardRound, ROUND_TYPES, RoundType } from '../services/wardRoundsService';
import { db } from '../db/database';
import { format } from 'date-fns';

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

  const [formData, setFormData] = useState({
    patient_id: initialPatientId || '',
    reviewer_id: '',
    round_date: format(new Date(), 'yyyy-MM-dd'),
    round_time: format(new Date(), 'HH:mm'),
    
    // Round Type - NEW
    round_type: 'house_officers_round' as RoundType,
    doctor_role: 'house_officer' as 'consultant' | 'senior_registrar' | 'registrar' | 'house_officer',
    accompanying_team: [] as string[],
    
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
    progress_status: 'stable',
    complications: '',
    
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
    
    // Follow-up
    next_review_date: '',
    discharge_plan: '',
    consultant_notified: false,
    
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
      setFormData(prev => ({ ...prev, reviewer_id: user.id }));
    }
  };

  const loadPatients = async () => {
    const allPatients = await db.patients.toArray();
    setPatients(allPatients);
  };

  const loadPatientDetails = async (patientId: string) => {
    const patient = await db.patients.get(patientId);
    setSelectedPatient(patient);
    setFormData(prev => ({ ...prev, patient_id: patientId }));
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
      const wardRoundData: Partial<WardRound> = {
        ...formData,
        round_date: new Date(formData.round_date).toISOString()
      };

      if (wardRoundId) {
        await wardRoundsService.updateWardRound(wardRoundId, wardRoundData);
      } else {
        await wardRoundsService.createWardRound(wardRoundData as Omit<WardRound, 'id' | 'created_at' | 'updated_at'>);
      }
      
      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving ward round:', error);
      alert('Error saving ward round. Please try again.');
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

  const tabs = [
    { id: 'patient', label: 'Patient Selection', icon: User },
    { id: 'subjective', label: 'Subjective', icon: FileText },
    { id: 'vitals', label: 'Vitals & Examination', icon: Activity },
    { id: 'assessment', label: 'Clinical Assessment', icon: Stethoscope },
    { id: 'plan', label: 'Management Plan', icon: ClipboardList },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'followup', label: 'Follow-up', icon: TrendingUp }
  ];

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
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Investigations Ordered</h3>
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
    </div>
  );
};


export default WardRoundForm;
