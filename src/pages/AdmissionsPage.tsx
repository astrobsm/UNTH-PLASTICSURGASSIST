import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { admissionService, Admission, AdmissionStatistics } from '../services/admissionService';

interface Ward {
  name: string;
  beds: string[];
}

const WARDS: Ward[] = [
  { name: 'Ward 1', beds: Array.from({ length: 20 }, (_, i) => `W1-${i + 1}`) },
  { name: 'Ward 2', beds: Array.from({ length: 20 }, (_, i) => `W2-${i + 1}`) },
  { name: 'Ward 3', beds: Array.from({ length: 20 }, (_, i) => `W3-${i + 1}`) },
  { name: 'Ward 4', beds: Array.from({ length: 20 }, (_, i) => `W4-${i + 1}`) },
  { name: 'Ward 5', beds: Array.from({ length: 20 }, (_, i) => `W5-${i + 1}`) },
  { name: 'Ward 6', beds: Array.from({ length: 20 }, (_, i) => `W6-${i + 1}`) },
  { name: 'Ward 7', beds: Array.from({ length: 20 }, (_, i) => `W7-${i + 1}`) },
  { name: 'Ward 8', beds: Array.from({ length: 20 }, (_, i) => `W8-${i + 1}`) },
  { name: 'Ward 9', beds: Array.from({ length: 20 }, (_, i) => `W9-${i + 1}`) },
  { name: 'Ward 10', beds: Array.from({ length: 20 }, (_, i) => `W10-${i + 1}`) },
  { name: 'Private Suite', beds: Array.from({ length: 10 }, (_, i) => `PS-${i + 1}`) },
  { name: 'MMW', beds: Array.from({ length: 15 }, (_, i) => `MMW-${i + 1}`) },
  { name: 'FMW', beds: Array.from({ length: 15 }, (_, i) => `FMW-${i + 1}`) },
  { name: 'Eye Ward', beds: Array.from({ length: 12 }, (_, i) => `EYE-${i + 1}`) },
  { name: 'Neuroward', beds: Array.from({ length: 12 }, (_, i) => `NEURO-${i + 1}`) },
  { name: 'Oncology Ward', beds: Array.from({ length: 15 }, (_, i) => `ONCO-${i + 1}`) },
  { name: 'MMWE', beds: Array.from({ length: 12 }, (_, i) => `MMWE-${i + 1}`) }
];

const SPECIALTIES = [
  'General Surgery',
  'Internal Medicine',
  'Orthopedics',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Neurosurgery',
  'Cardiothoracic Surgery',
  'Burns Unit',
  'Emergency Medicine',
  'Other'
];

const CONSULTANTS = [
  'Dr Okwesili',
  'Dr Nnadi',
  'Dr Eze C. B'
];

export default function AdmissionsPage() {
  const [activeTab, setActiveTab] = useState<'admit' | 'list' | 'stats'>('list');
  const [patients, setPatients] = useState<any[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [statistics, setStatistics] = useState<AdmissionStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [wardLocation, setWardLocation] = useState('');
  const [bedNumber, setBedNumber] = useState('');
  const [routeOfAdmission, setRouteOfAdmission] = useState<'clinic' | 'emergency' | 'consult_transfer'>('clinic');
  const [referringSpecialty, setReferringSpecialty] = useState('');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [reasonsForAdmission, setReasonsForAdmission] = useState('');
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [admittingConsultant, setAdmittingConsultant] = useState('');
  
  // Vital signs
  const [temperature, setTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  
  // Medical history
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [pastMedicalHistory, setPastMedicalHistory] = useState('');
  const [pastSurgicalHistory, setPastSurgicalHistory] = useState('');
  const [socialHistory, setSocialHistory] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  
  // Assessment
  const [examinationFindings, setExaminationFindings] = useState('');
  const [initialManagementPlan, setInitialManagementPlan] = useState('');

  useEffect(() => {
    loadPatients();
    loadAdmissions();
    loadStatistics();
  }, []);

  const loadPatients = async () => {
    const allPatients = await patientService.getAllPatients();
    setPatients(allPatients);
  };

  const loadAdmissions = async () => {
    const activeAdmissions = await admissionService.getActiveAdmissions();
    setAdmissions(activeAdmissions);
  };

  const loadStatistics = async () => {
    const stats = await admissionService.getStatistics();
    setStatistics(stats);
  };

  const handlePatientSelect = (patientId: number) => {
    const patient = patients.find(p => p.id === patientId);
    setSelectedPatient(patient);
  };

  const resetForm = () => {
    setSelectedPatient(null);
    setWardLocation('');
    setBedNumber('');
    setRouteOfAdmission('clinic');
    setReferringSpecialty('');
    setReferringDoctor('');
    setReasonsForAdmission('');
    setPresentingComplaint('');
    setProvisionalDiagnosis('');
    setAdmittingConsultant('');
    setTemperature('');
    setBloodPressure('');
    setPulse('');
    setRespiratoryRate('');
    setOxygenSaturation('');
    setAllergies('');
    setCurrentMedications('');
    setPastMedicalHistory('');
    setPastSurgicalHistory('');
    setSocialHistory('');
    setFamilyHistory('');
    setExaminationFindings('');
    setInitialManagementPlan('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPatient) {
      alert('Please select a patient');
      return;
    }

    if (!wardLocation || !reasonsForAdmission || !provisionalDiagnosis || !admittingConsultant) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const admissionData: Omit<Admission, 'id' | 'created_at' | 'updated_at'> = {
        patient_id: selectedPatient.id,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        hospital_number: selectedPatient.hospital_number,
        admission_date: new Date().toISOString().split('T')[0],
        admission_time: new Date().toTimeString().split(' ')[0],
        ward_location: wardLocation,
        bed_number: bedNumber,
        route_of_admission: routeOfAdmission,
        referring_specialty: routeOfAdmission === 'consult_transfer' ? referringSpecialty : undefined,
        referring_doctor: routeOfAdmission === 'consult_transfer' ? referringDoctor : undefined,
        reasons_for_admission: reasonsForAdmission,
        presenting_complaint: presentingComplaint,
        provisional_diagnosis: provisionalDiagnosis,
        admitting_doctor: 'Current User', // TODO: Get from auth context
        admitting_consultant: admittingConsultant,
        vital_signs: {
          temperature: temperature ? parseFloat(temperature) : undefined,
          blood_pressure: bloodPressure,
          pulse: pulse ? parseInt(pulse) : undefined,
          respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
          oxygen_saturation: oxygenSaturation ? parseInt(oxygenSaturation) : undefined
        },
        allergies,
        current_medications: currentMedications,
        past_medical_history: pastMedicalHistory,
        past_surgical_history: pastSurgicalHistory,
        social_history: socialHistory,
        family_history: familyHistory,
        examination_findings: examinationFindings,
        initial_management_plan: initialManagementPlan,
        status: 'active'
      };

      await admissionService.createAdmission(admissionData);
      
      alert('Patient admitted successfully!');
      resetForm();
      setActiveTab('list');
      loadAdmissions();
      loadStatistics();
    } catch (error) {
      console.error('Error admitting patient:', error);
      alert('Failed to admit patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmissions = admissions.filter(admission =>
    admission.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admission.hospital_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admission.ward_location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    admission.provisional_diagnosis.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
          <h1 className="text-3xl font-bold">PLASTIC AND RECONSTRUCTIVE SURGERY UNIT</h1>
          <h2 className="text-xl mt-2">Patient Admissions</h2>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'list'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Active Admissions
          </button>
          <button
            onClick={() => setActiveTab('admit')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'admit'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Admit New Patient
          </button>
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'stats'
                ? 'text-green-600 border-b-2 border-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Statistics
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Active Admissions Tab */}
          {activeTab === 'list' && (
            <div>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by patient name, hospital number, ward, or diagnosis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Patient
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Hospital Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ward / Bed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Admission Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Diagnosis
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredAdmissions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                          No active admissions found
                        </td>
                      </tr>
                    ) : (
                      filteredAdmissions.map((admission) => (
                        <tr key={admission.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{admission.patient_name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admission.hospital_number}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {admission.ward_location} / {admission.bed_number || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(admission.admission_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              admission.route_of_admission === 'clinic' ? 'bg-blue-100 text-blue-800' :
                              admission.route_of_admission === 'emergency' ? 'bg-red-100 text-red-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {admission.route_of_admission.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            <div className="max-w-xs truncate">{admission.provisional_diagnosis}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button className="text-green-600 hover:text-green-900 mr-3">View</button>
                            <button className="text-blue-600 hover:text-blue-900 mr-3">Transfer</button>
                            <button className="text-red-600 hover:text-red-900">Discharge</button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Admit New Patient Tab */}
          {activeTab === 'admit' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Selection */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Selection</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Patient <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedPatient?.id || ''}
                      onChange={(e) => handlePatientSelect(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    >
                      <option value="">-- Select Patient --</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.first_name} {patient.last_name} ({patient.hospital_number})
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedPatient && (
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-sm"><strong>Age:</strong> {selectedPatient.age || 'N/A'}</p>
                      <p className="text-sm"><strong>Gender:</strong> {selectedPatient.gender || 'N/A'}</p>
                      <p className="text-sm"><strong>Phone:</strong> {selectedPatient.phone || 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admission Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Admission Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ward Location <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={wardLocation}
                      onChange={(e) => {
                        setWardLocation(e.target.value);
                        setBedNumber('');
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    >
                      <option value="">-- Select Ward --</option>
                      {WARDS.map((ward) => (
                        <option key={ward.name} value={ward.name}>{ward.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bed Number
                    </label>
                    <select
                      value={bedNumber}
                      onChange={(e) => setBedNumber(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      disabled={!wardLocation}
                    >
                      <option value="">-- Select Bed --</option>
                      {wardLocation && WARDS.find(w => w.name === wardLocation)?.beds.map((bed) => (
                        <option key={bed} value={bed}>{bed}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Admitting Consultant <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={admittingConsultant}
                      onChange={(e) => setAdmittingConsultant(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    >
                      <option value="">-- Select Consultant --</option>
                      {CONSULTANTS.map((consultant) => (
                        <option key={consultant} value={consultant}>{consultant}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Route of Admission */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Route of Admission</h3>
                <div className="space-y-4">
                  <div className="flex gap-6">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="clinic"
                        checked={routeOfAdmission === 'clinic'}
                        onChange={(e) => setRouteOfAdmission(e.target.value as any)}
                        className="mr-2"
                      />
                      <span>Clinic</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="emergency"
                        checked={routeOfAdmission === 'emergency'}
                        onChange={(e) => setRouteOfAdmission(e.target.value as any)}
                        className="mr-2"
                      />
                      <span>Emergency</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="consult_transfer"
                        checked={routeOfAdmission === 'consult_transfer'}
                        onChange={(e) => setRouteOfAdmission(e.target.value as any)}
                        className="mr-2"
                      />
                      <span>Consult Transfer</span>
                    </label>
                  </div>

                  {routeOfAdmission === 'consult_transfer' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Referring Specialty <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={referringSpecialty}
                          onChange={(e) => setReferringSpecialty(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          required={routeOfAdmission === 'consult_transfer'}
                        >
                          <option value="">-- Select Specialty --</option>
                          {SPECIALTIES.map((specialty) => (
                            <option key={specialty} value={specialty}>{specialty}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Referring Doctor
                        </label>
                        <input
                          type="text"
                          value={referringDoctor}
                          onChange={(e) => setReferringDoctor(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                          placeholder="Dr. Name"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Clinical Assessment */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Assessment</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reasons for Admission <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={reasonsForAdmission}
                      onChange={(e) => setReasonsForAdmission(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Presenting Complaint
                    </label>
                    <textarea
                      value={presentingComplaint}
                      onChange={(e) => setPresentingComplaint(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provisional Diagnosis <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={provisionalDiagnosis}
                      onChange={(e) => setProvisionalDiagnosis(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Vital Signs */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Vital Signs</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      placeholder="37.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">BP (mmHg)</label>
                    <input
                      type="text"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      placeholder="120/80"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      placeholder="80"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">RR (/min)</label>
                    <input
                      type="number"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      placeholder="18"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">O2 Sat (%)</label>
                    <input
                      type="number"
                      value={oxygenSaturation}
                      onChange={(e) => setOxygenSaturation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      placeholder="98"
                    />
                  </div>
                </div>
              </div>

              {/* Medical History */}
              <details className="bg-gray-50 p-4 rounded-lg">
                <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
                  Medical History (Optional)
                </summary>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Allergies</label>
                      <textarea
                        value={allergies}
                        onChange={(e) => setAllergies(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Current Medications</label>
                      <textarea
                        value={currentMedications}
                        onChange={(e) => setCurrentMedications(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Past Medical History</label>
                      <textarea
                        value={pastMedicalHistory}
                        onChange={(e) => setPastMedicalHistory(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Past Surgical History</label>
                      <textarea
                        value={pastSurgicalHistory}
                        onChange={(e) => setPastSurgicalHistory(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Social History</label>
                      <textarea
                        value={socialHistory}
                        onChange={(e) => setSocialHistory(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Family History</label>
                      <textarea
                        value={familyHistory}
                        onChange={(e) => setFamilyHistory(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      />
                    </div>
                  </div>
                </div>
              </details>

              {/* Initial Assessment */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Initial Assessment</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Examination Findings</label>
                    <textarea
                      value={examinationFindings}
                      onChange={(e) => setExaminationFindings(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Initial Management Plan</label>
                    <textarea
                      value={initialManagementPlan}
                      onChange={(e) => setInitialManagementPlan(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
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
                  {loading ? 'Admitting...' : 'Admit Patient'}
                </button>
              </div>
            </form>
          )}

          {/* Statistics Tab */}
          {activeTab === 'stats' && statistics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Total Admissions</h4>
                <p className="text-3xl font-bold text-blue-700">{statistics.total_admissions}</p>
              </div>
              <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                <h4 className="text-sm font-medium text-green-900 mb-2">Active Admissions</h4>
                <p className="text-3xl font-bold text-green-700">{statistics.active_admissions}</p>
              </div>
              <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
                <h4 className="text-sm font-medium text-purple-900 mb-2">This Month</h4>
                <p className="text-3xl font-bold text-purple-700">{statistics.admissions_this_month}</p>
              </div>
              <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
                <h4 className="text-sm font-medium text-orange-900 mb-2">Avg. Length of Stay</h4>
                <p className="text-3xl font-bold text-orange-700">{statistics.average_length_of_stay.toFixed(1)} days</p>
              </div>

              <div className="md:col-span-2 lg:col-span-2 bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Admissions by Route</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Clinic</span>
                    <span className="font-semibold text-blue-600">{statistics.by_route.clinic}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Emergency</span>
                    <span className="font-semibold text-red-600">{statistics.by_route.emergency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Consult Transfer</span>
                    <span className="font-semibold text-purple-600">{statistics.by_route.consult_transfer}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 lg:col-span-2 bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Admissions by Ward</h4>
                <div className="space-y-2">
                  {Object.entries(statistics.by_ward).map(([ward, count]) => (
                    <div key={ward} className="flex justify-between items-center">
                      <span className="text-gray-700">{ward}</span>
                      <span className="font-semibold text-green-600">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
