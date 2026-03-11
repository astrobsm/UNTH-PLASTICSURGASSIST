import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { admissionService, Admission, AdmissionStatistics } from '../services/admissionService';
import { patientAssignmentService } from '../services/patientAssignmentService';
import { calculateAge, calculateAndFormatAge } from '../utils/dateUtils';

interface Ward {
  name: string;
  beds: string[];
}

const WARDS: Ward[] = [
  { name: 'Ward 1', beds: Array.from({ length: 20 }, (_, i) => `W1-${i + 1}`) },
  { name: 'Ward 2', beds: Array.from({ length: 20 }, (_, i) => `W2-${i + 1}`) },
  { name: 'Ward 3', beds: Array.from({ length: 20 }, (_, i) => `W3-${i + 1}`) },
  { name: 'Ward 4', beds: Array.from({ length: 20 }, (_, i) => `W4-${i + 1}`) },
  { name: 'Ward 6A', beds: Array.from({ length: 20 }, (_, i) => `W6A-${i + 1}`) },
  { name: 'Ward 6B', beds: Array.from({ length: 20 }, (_, i) => `W6B-${i + 1}`) },
  { name: 'Ward 8', beds: Array.from({ length: 20 }, (_, i) => `W8-${i + 1}`) },
  { name: 'Ward 9', beds: Array.from({ length: 20 }, (_, i) => `W9-${i + 1}`) },
  { name: 'Ward 10', beds: Array.from({ length: 20 }, (_, i) => `W10-${i + 1}`) },
  { name: 'Oncology Ward', beds: Array.from({ length: 15 }, (_, i) => `ONCO-${i + 1}`) },
  { name: 'Male Medical Extension', beds: Array.from({ length: 15 }, (_, i) => `MMWE-${i + 1}`) },
  { name: 'Psychiatric Ward', beds: Array.from({ length: 15 }, (_, i) => `PSYCH-${i + 1}`) },
  { name: 'Male Medical Ward', beds: Array.from({ length: 20 }, (_, i) => `MMW-${i + 1}`) },
  { name: 'Female Medical Ward', beds: Array.from({ length: 20 }, (_, i) => `FMW-${i + 1}`) },
  { name: 'Private Suite - Pink Room', beds: Array.from({ length: 5 }, (_, i) => `PS-PK-${i + 1}`) },
  { name: 'Private Suite - White Room', beds: Array.from({ length: 5 }, (_, i) => `PS-WH-${i + 1}`) },
  { name: 'Private Suite - Purple Room', beds: Array.from({ length: 5 }, (_, i) => `PS-PR-${i + 1}`) },
  { name: 'Private Suite - Blue Room', beds: Array.from({ length: 5 }, (_, i) => `PS-BL-${i + 1}`) },
  { name: 'CHER', beds: Array.from({ length: 20 }, (_, i) => `CHER-${i + 1}`) },
  { name: 'New Born', beds: Array.from({ length: 15 }, (_, i) => `NB-${i + 1}`) },
  { name: 'Medical Emergency', beds: Array.from({ length: 15 }, (_, i) => `MED-EM-${i + 1}`) },
  { name: 'Surgical Emergency', beds: Array.from({ length: 15 }, (_, i) => `SURG-EM-${i + 1}`) },
  { name: 'Labour Ward', beds: Array.from({ length: 15 }, (_, i) => `LW-${i + 1}`) },
  { name: 'PICU', beds: Array.from({ length: 10 }, (_, i) => `PICU-${i + 1}`) },
  { name: 'ICU', beds: Array.from({ length: 12 }, (_, i) => `ICU-${i + 1}`) },
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

  // Consult/Referral documents state
  const [consultDocuments, setConsultDocuments] = useState<Array<{
    name: string;
    data: string;
    type: string;
    uploaded_at: string;
  }>>([]);  
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

  // Helper function to calculate patient age in real-time from date of birth
  const getPatientAge = (): number | null => {
    return calculateAge(selectedPatient?.date_of_birth || selectedPatient?.dob);
  };

  // Check if BP should be optional (children under 10)
  const isBpOptional = (): boolean => {
    const age = getPatientAge();
    return age !== null && age < 10;
  };

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

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find(p => String(p.id) === patientId);
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
    setConsultDocuments([]);
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
        consult_documents: routeOfAdmission === 'consult_transfer' && consultDocuments.length > 0 ? consultDocuments : undefined,
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
      
      // Automatically assign patient to team
      try {
        await patientAssignmentService.autoAssignPatient(
          selectedPatient.id!.toString(),
          `${selectedPatient.first_name} ${selectedPatient.last_name}`,
          selectedPatient.hospital_number,
          routeOfAdmission === 'emergency' ? 'emergency' : 'elective'
        );
        console.log('Patient automatically assigned to team');
      } catch (assignmentError) {
        console.error('Failed to auto-assign team:', assignmentError);
        // Don't fail admission if team assignment fails
      }
      
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
    (admission.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.hospital_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.ward_location || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.provisional_diagnosis || '').toLowerCase().includes(searchTerm.toLowerCase())
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
                      onChange={(e) => handlePatientSelect(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      required
                    >
                      <option value="">-- Select Patient --</option>
                      {patients.map((patient) => {
                        // Calculate age from date of birth
                        const displayAge = calculateAndFormatAge(patient.date_of_birth || patient.dob);
                        
                        // Get full name
                        const fullName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown';
                        const hospitalNum = patient.hospital_number || patient.id || 'N/A';
                        const phone = patient.phone || 'N/A';
                        
                        return (
                          <option key={patient.id} value={patient.id}>
                            {fullName} • {displayAge} • #{hospitalNum} • 📞 {phone}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  {selectedPatient && (
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <p className="text-sm">
                        <strong>Age:</strong> {(() => {
                          const age = calculateAge(selectedPatient.date_of_birth || selectedPatient.dob);
                          return age !== null && age >= 0 ? `${age} years` : 'N/A';
                        })()}
                      </p>
                      <p className="text-sm"><strong>Gender:</strong> {selectedPatient.sex || selectedPatient.gender || 'N/A'}</p>
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
                    <>
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

                    {/* Consult / Referral Document Upload */}
                    <div className="mt-4">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-md font-semibold text-amber-900 flex items-center gap-2">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Consult / Referral Documents
                          </h4>
                          <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-1 rounded-full">Recommended</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">Upload consult letters, referral forms, or inter-unit transfer documents (images or PDFs, max 5MB each)</p>

                        {/* Uploaded documents list */}
                        {consultDocuments.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {consultDocuments.map((doc, index) => (
                              <div key={index} className="flex items-center justify-between p-2 bg-white border border-amber-200 rounded-md">
                                <div className="flex items-center gap-2 min-w-0">
                                  {doc.type.startsWith('image/') ? (
                                    <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                  <span className="text-sm text-gray-700 truncate">{doc.name}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {doc.type.startsWith('image/') && (
                                    <button
                                      type="button"
                                      onClick={() => window.open(doc.data, '_blank')}
                                      className="text-blue-600 hover:text-blue-800 text-xs"
                                      title="Preview document"
                                    >
                                      View
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setConsultDocuments(prev => prev.filter((_, i) => i !== index))}
                                    className="text-red-600 hover:text-red-800 p-1"
                                    title="Remove document"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Upload button */}
                        {consultDocuments.length < 5 && (
                          <label className="cursor-pointer flex items-center justify-center gap-2 p-3 border-2 border-dashed border-amber-300 rounded-lg hover:border-amber-500 hover:bg-amber-100 transition-colors">
                            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span className="text-sm font-medium text-amber-700">
                              Upload Consult Document ({consultDocuments.length}/5)
                            </span>
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  if (file.size > 5 * 1024 * 1024) {
                                    alert('File size must be less than 5MB');
                                    return;
                                  }
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setConsultDocuments(prev => [...prev, {
                                      name: file.name,
                                      data: reader.result as string,
                                      type: file.type,
                                      uploaded_at: new Date().toISOString()
                                    }]);
                                  };
                                  reader.readAsDataURL(file);
                                }
                                e.target.value = '';
                              }}
                            />
                          </label>
                        )}

                        <div className="mt-3 p-2 bg-amber-100 rounded-md">
                          <p className="text-xs text-amber-800">
                            <strong>Tip:</strong> You can upload photos of handwritten consult letters, printed referral forms, or PDF documents. Up to 5 documents allowed.
                          </p>
                        </div>
                      </div>
                    </div>
                    </>
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      BP (mmHg)
                      {isBpOptional() && (
                        <span className="text-xs text-gray-500 ml-1">(Optional for children &lt;10 yrs)</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={bloodPressure}
                      onChange={(e) => setBloodPressure(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                      placeholder={isBpOptional() ? "Optional" : "120/80"}
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
