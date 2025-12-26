import React, { useState, useEffect } from 'react';
import { patientService } from '../services/patientService';
import { 
  admissionDischargeService, 
  Admission, 
  Discharge,
  WHODischargeScore,
  DischargeMedication,
  MDTMedicationReview,
  AdmissionStatistics
} from '../services/admissionDischargeService';
import WHODischargeAssessment from '../components/WHODischargeAssessment';
import MDTDischargeMedications from '../components/MDTDischargeMedications';
import DischargeSummaryForm from '../components/DischargeSummaryForm';
import DischargeDocumentsPreview from '../components/DischargeDocumentsPreview';

// ============= CONSTANTS =============

const WARDS = [
  { name: 'Ward 1', beds: Array.from({ length: 20 }, (_, i) => `W1-${i + 1}`) },
  { name: 'Ward 2', beds: Array.from({ length: 20 }, (_, i) => `W2-${i + 1}`) },
  { name: 'Ward 3', beds: Array.from({ length: 20 }, (_, i) => `W3-${i + 1}`) },
  { name: 'Ward 4', beds: Array.from({ length: 20 }, (_, i) => `W4-${i + 1}`) },
  { name: 'Ward 5', beds: Array.from({ length: 20 }, (_, i) => `W5-${i + 1}`) },
  { name: 'Ward 6', beds: Array.from({ length: 20 }, (_, i) => `W6-${i + 1}`) },
  { name: 'Private Suite', beds: Array.from({ length: 10 }, (_, i) => `PS-${i + 1}`) },
  { name: 'MMW', beds: Array.from({ length: 15 }, (_, i) => `MMW-${i + 1}`) },
  { name: 'FMW', beds: Array.from({ length: 15 }, (_, i) => `FMW-${i + 1}`) },
  { name: 'Burn Unit', beds: Array.from({ length: 12 }, (_, i) => `BURN-${i + 1}`) },
];

const SPECIALTIES = [
  'General Surgery', 'Internal Medicine', 'Orthopedics', 'Pediatrics',
  'Neurosurgery', 'Cardiothoracic Surgery', 'Burns Unit', 'Emergency Medicine',
  'Endocrinology', 'Nephrology', 'Cardiology', 'Oncology', 'Other'
];

const CONSULTANTS = ['Dr Okwesili', 'Dr Nnadi', 'Dr Eze C. B'];

const CLINICS = ['Outpatient Clinic', 'Hand Clinic', 'Burns Clinic', 'Wound Clinic', 'Reconstructive Clinic'];

// ============= MAIN COMPONENT =============

export default function AdmissionDischargePage() {
  const [activeTab, setActiveTab] = useState<'active' | 'admit' | 'discharge' | 'history' | 'stats'>('active');
  const [patients, setPatients] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<Admission[]>([]);
  const [discharges, setDischarges] = useState<Discharge[]>([]);
  const [statistics, setStatistics] = useState<AdmissionStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [patientsData, admissionsData, dischargesData, statsData] = await Promise.all([
        patientService.getAllPatients(),
        admissionDischargeService.getActiveAdmissions(),
        admissionDischargeService.getAllDischarges(),
        admissionDischargeService.getStatistics()
      ]);
      setPatients(patientsData);
      setActiveAdmissions(admissionsData);
      setDischarges(dischargesData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmissions = activeAdmissions.filter(admission =>
    (admission.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.hospital_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.ward_location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
          <h1 className="text-2xl font-bold">Admission & Discharge Management</h1>
          <p className="text-green-100 mt-1">Plastic and Reconstructive Surgery Unit</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 bg-gray-50">
          {[
            { id: 'active', label: '🏥 Active Patients', count: activeAdmissions.length },
            { id: 'admit', label: '➕ New Admission' },
            { id: 'discharge', label: '🚪 Discharge Patient' },
            { id: 'history', label: '📋 Discharge History' },
            { id: 'stats', label: '📊 Statistics' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-green-600 border-b-2 border-green-600 bg-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'active' && (
                <ActivePatientsTab 
                  admissions={filteredAdmissions} 
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onDischarge={(admission) => {
                    setActiveTab('discharge');
                    // Pass selected admission to discharge tab
                  }}
                  onRefresh={loadData}
                />
              )}
              
              {activeTab === 'admit' && (
                <NewAdmissionTab 
                  patients={patients} 
                  onSuccess={() => {
                    loadData();
                    setActiveTab('active');
                  }}
                />
              )}
              
              {activeTab === 'discharge' && (
                <DischargeTab 
                  activeAdmissions={activeAdmissions}
                  onSuccess={() => {
                    loadData();
                    setActiveTab('history');
                  }}
                />
              )}
              
              {activeTab === 'history' && (
                <DischargeHistoryTab 
                  discharges={discharges}
                  onRefresh={loadData}
                />
              )}
              
              {activeTab === 'stats' && statistics && (
                <StatisticsTab statistics={statistics} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= ACTIVE PATIENTS TAB =============

interface ActivePatientsTabProps {
  admissions: Admission[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onDischarge: (admission: Admission) => void;
  onRefresh: () => void;
}

function ActivePatientsTab({ admissions, searchTerm, setSearchTerm, onDischarge, onRefresh }: ActivePatientsTabProps) {
  return (
    <div>
      {/* Search Bar */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by patient name, hospital number, or ward..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Patients Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Hospital No.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ward/Bed</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Admission Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Days</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Diagnosis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Route</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {admissions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No active admissions found
                </td>
              </tr>
            ) : (
              admissions.map((admission) => {
                const daysAdmitted = Math.ceil(
                  (new Date().getTime() - new Date(admission.admission_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                return (
                  <tr key={admission.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{admission.patient_name}</div>
                      <div className="text-xs text-gray-500">{admission.age}y / {admission.gender}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{admission.hospital_number}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{admission.ward_location}</span>
                      {admission.bed_number && <span className="text-gray-500"> / {admission.bed_number}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(admission.admission_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        daysAdmitted > 14 ? 'bg-red-100 text-red-700' :
                        daysAdmitted > 7 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {daysAdmitted}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="max-w-xs truncate">{admission.provisional_diagnosis}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        admission.route_of_admission === 'emergency' ? 'bg-red-100 text-red-700' :
                        admission.route_of_admission === 'consult_transfer' ? 'bg-purple-100 text-purple-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {admission.route_of_admission.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2">
                        <button className="text-blue-600 hover:text-blue-800">View</button>
                        <button 
                          onClick={() => onDischarge(admission)}
                          className="text-green-600 hover:text-green-800"
                        >
                          Discharge
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= NEW ADMISSION TAB =============

interface NewAdmissionTabProps {
  patients: any[];
  onSuccess: () => void;
}

function NewAdmissionTab({ patients, onSuccess }: NewAdmissionTabProps) {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [wardLocation, setWardLocation] = useState('');
  const [bedNumber, setBedNumber] = useState('');
  const [routeOfAdmission, setRouteOfAdmission] = useState<'clinic' | 'emergency' | 'consult_transfer'>('clinic');
  const [referringSpecialty, setReferringSpecialty] = useState('');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [reasonsForAdmission, setReasonsForAdmission] = useState('');
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [admittingConsultant, setAdmittingConsultant] = useState('');
  
  // Vitals
  const [temperature, setTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');

  // History
  const [allergies, setAllergies] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [pastMedicalHistory, setPastMedicalHistory] = useState('');
  const [examinationFindings, setExaminationFindings] = useState('');
  const [initialManagementPlan, setInitialManagementPlan] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !wardLocation || !reasonsForAdmission || !provisionalDiagnosis || !admittingConsultant) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await admissionDischargeService.createAdmission({
        patient_id: selectedPatient.id,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        hospital_number: selectedPatient.hospital_number,
        age: selectedPatient.age,
        gender: selectedPatient.gender,
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
        admitting_doctor: 'Current User',
        admitting_consultant: admittingConsultant,
        vital_signs: {
          temperature: temperature ? parseFloat(temperature) : undefined,
          blood_pressure: bloodPressure,
          pulse: pulse ? parseInt(pulse) : undefined,
          respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
          oxygen_saturation: oxygenSaturation ? parseInt(oxygenSaturation) : undefined
        },
        allergies,
        comorbidities: comorbidities ? comorbidities.split(',').map(c => c.trim()) : [],
        current_medications: currentMedications,
        past_medical_history: pastMedicalHistory,
        examination_findings: examinationFindings,
        initial_management_plan: initialManagementPlan,
        status: 'active',
        created_by: 'Current User'
      });

      alert('Patient admitted successfully!');
      onSuccess();
    } catch (error) {
      console.error('Error admitting patient:', error);
      alert('Failed to admit patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient Selection */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">👤 Patient Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Patient <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPatient?.id || ''}
              onChange={(e) => {
                const patient = patients.find(p => String(p.id) === e.target.value);
                setSelectedPatient(patient);
              }}
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
            <div className="bg-white p-3 rounded border border-blue-300">
              <p className="text-sm"><strong>Age:</strong> {selectedPatient.age || 'N/A'} years</p>
              <p className="text-sm"><strong>Gender:</strong> {selectedPatient.gender || 'N/A'}</p>
              <p className="text-sm"><strong>Phone:</strong> {selectedPatient.phone || 'N/A'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Admission Details */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏥 Admission Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward Location <span className="text-red-500">*</span>
            </label>
            <select
              value={wardLocation}
              onChange={(e) => { setWardLocation(e.target.value); setBedNumber(''); }}
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admitting Consultant <span className="text-red-500">*</span>
            </label>
            <select
              value={admittingConsultant}
              onChange={(e) => setAdmittingConsultant(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Select Consultant --</option>
              {CONSULTANTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Route of Admission */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🚑 Route of Admission</h3>
        <div className="flex gap-6 mb-4">
          {[
            { value: 'clinic', label: 'Clinic', icon: '🏪' },
            { value: 'emergency', label: 'Emergency', icon: '🚨' },
            { value: 'consult_transfer', label: 'Consult Transfer', icon: '🔄' }
          ].map(route => (
            <label key={route.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                value={route.value}
                checked={routeOfAdmission === route.value}
                onChange={(e) => setRouteOfAdmission(e.target.value as any)}
                className="mr-2 text-green-600"
              />
              <span>{route.icon} {route.label}</span>
            </label>
          ))}
        </div>

        {routeOfAdmission === 'consult_transfer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-3 bg-purple-50 rounded border border-purple-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referring Specialty <span className="text-red-500">*</span>
              </label>
              <select
                value={referringSpecialty}
                onChange={(e) => setReferringSpecialty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required={routeOfAdmission === 'consult_transfer'}
              >
                <option value="">-- Select Specialty --</option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referring Doctor</label>
              <input
                type="text"
                value={referringDoctor}
                onChange={(e) => setReferringDoctor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Dr. Name"
              />
            </div>
          </div>
        )}
      </div>

      {/* Clinical Assessment */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Clinical Assessment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reasons for Admission <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reasonsForAdmission}
              onChange={(e) => setReasonsForAdmission(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Presenting Complaint</label>
              <textarea
                value={presentingComplaint}
                onChange={(e) => setPresentingComplaint(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provisional Diagnosis <span className="text-red-500">*</span>
              </label>
              <textarea
                value={provisionalDiagnosis}
                onChange={(e) => setProvisionalDiagnosis(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vital Signs */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">💓 Vital Signs</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temp (°C)</label>
            <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="37.0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BP (mmHg)</label>
            <input type="text" value={bloodPressure} onChange={(e) => setBloodPressure(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="120/80" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pulse (bpm)</label>
            <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="80" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RR (/min)</label>
            <input type="number" value={respiratoryRate} onChange={(e) => setRespiratoryRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="18" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
            <input type="number" value={oxygenSaturation} onChange={(e) => setOxygenSaturation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="98" />
          </div>
        </div>
      </div>

      {/* Medical History (Collapsible) */}
      <details className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
          📁 Medical History (Optional)
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
            <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., Penicillin, NSAIDs" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comorbidities</label>
            <input type="text" value={comorbidities} onChange={(e) => setComorbidities(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., Diabetes, Hypertension (comma-separated)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
            <textarea value={currentMedications} onChange={(e) => setCurrentMedications(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Past Medical History</label>
            <textarea value={pastMedicalHistory} onChange={(e) => setPastMedicalHistory(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Examination Findings</label>
            <textarea value={examinationFindings} onChange={(e) => setExaminationFindings(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Management Plan</label>
            <textarea value={initialManagementPlan} onChange={(e) => setInitialManagementPlan(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
      </details>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <button type="submit" disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400">
          {loading ? 'Admitting...' : '✅ Admit Patient'}
        </button>
      </div>
    </form>
  );
}

// ============= DISCHARGE TAB - INTEGRATED WITH COMPONENTS =============

interface DischargeTabProps {
  activeAdmissions: Admission[];
  onSuccess: () => void;
}

function DischargeTab({ activeAdmissions, onSuccess }: DischargeTabProps) {
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  
  // State to pass between steps
  const [whoScore, setWhoScore] = useState<WHODischargeScore | null>(null);
  const [medications, setMedications] = useState<DischargeMedication[]>([]);
  const [dischargeData, setDischargeData] = useState<Omit<Discharge, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const [completedDischarge, setCompletedDischarge] = useState<Discharge | null>(null);

  const steps = [
    { num: 1, title: 'Select Patient' },
    { num: 2, title: 'WHO Assessment' },
    { num: 3, title: 'MDT Medications' },
    { num: 4, title: 'Discharge Summary' },
    { num: 5, title: 'Documents' }
  ];

  // Reset workflow
  const resetWorkflow = () => {
    setSelectedAdmission(null);
    setCurrentStep(1);
    setWhoScore(null);
    setMedications([]);
    setDischargeData(null);
    setCompletedDischarge(null);
  };

  // Handle WHO score completion
  const handleWHOComplete = (score: WHODischargeScore) => {
    setWhoScore(score);
    setCurrentStep(3);
  };

  // Handle medications completion
  const handleMedicationsComplete = (meds: DischargeMedication[]) => {
    setMedications(meds);
    setCurrentStep(4);
  };

  // Handle summary completion
  const handleSummaryComplete = async (data: Omit<Discharge, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = await admissionDischargeService.createDischarge(data);
      const discharge = { ...data, id, created_at: new Date(), updated_at: new Date() } as Discharge;
      setCompletedDischarge(discharge);
      setCurrentStep(5);
    } catch (error) {
      console.error('Error creating discharge:', error);
      alert('Failed to create discharge. Please try again.');
    }
  };

  // Handle final completion
  const handleFinalComplete = async () => {
    if (selectedAdmission?.id) {
      try {
        await admissionDischargeService.markAsDischargedAdmission(selectedAdmission.id);
        alert('Patient discharged successfully!');
        resetWorkflow();
        onSuccess();
      } catch (error) {
        console.error('Error completing discharge:', error);
        alert('Discharge completed but there was an error updating admission status.');
        onSuccess();
      }
    } else {
      onSuccess();
    }
  };

  return (
    <div>
      {/* Step Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= step.num ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step.num ? '✓' : step.num}
                </div>
                <span className={`mt-1 text-xs ${currentStep >= step.num ? 'text-green-600' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${currentStep > step.num ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <DischargeStep1SelectPatient 
          admissions={activeAdmissions}
          selectedAdmission={selectedAdmission}
          onSelect={(admission) => setSelectedAdmission(admission)}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && selectedAdmission && (
        <WHODischargeAssessment
          admission={selectedAdmission}
          onComplete={handleWHOComplete}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && selectedAdmission && whoScore && (
        <MDTDischargeMedications
          admission={selectedAdmission}
          onComplete={handleMedicationsComplete}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && selectedAdmission && whoScore && (
        <DischargeSummaryForm
          admission={selectedAdmission}
          whoScore={whoScore}
          medications={medications}
          onComplete={handleSummaryComplete}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 5 && completedDischarge && (
        <DischargeDocumentsPreview
          discharge={completedDischarge}
          onComplete={handleFinalComplete}
          onBack={() => setCurrentStep(4)}
        />
      )}
    </div>
  );
}

// Step 1: Select Patient
interface DischargeStep1Props {
  admissions: Admission[];
  selectedAdmission: Admission | null;
  onSelect: (admission: Admission) => void;
  onNext: () => void;
}

function DischargeStep1SelectPatient({ admissions, selectedAdmission, onSelect, onNext }: DischargeStep1Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select Patient for Discharge</h3>
      
      <select
        value={selectedAdmission?.id || ''}
        onChange={(e) => {
          const admission = admissions.find(a => String(a.id) === e.target.value);
          if (admission) onSelect(admission);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
      >
        <option value="">-- Select Patient --</option>
        {admissions.map((admission) => (
          <option key={admission.id} value={admission.id}>
            {admission.patient_name} ({admission.hospital_number}) - {admission.ward_location}
          </option>
        ))}
      </select>

      {selectedAdmission && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-2">Selected Patient</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Name:</span> <strong>{selectedAdmission.patient_name}</strong></div>
            <div><span className="text-gray-500">Hospital No:</span> <strong>{selectedAdmission.hospital_number}</strong></div>
            <div><span className="text-gray-500">Ward:</span> <strong>{selectedAdmission.ward_location}</strong></div>
            <div><span className="text-gray-500">Admission Date:</span> <strong>{new Date(selectedAdmission.admission_date).toLocaleDateString()}</strong></div>
            <div className="col-span-2"><span className="text-gray-500">Diagnosis:</span> <strong>{selectedAdmission.provisional_diagnosis}</strong></div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!selectedAdmission}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          Next: WHO Assessment →
        </button>
      </div>
    </div>
  );
}

// Step 2-5 are now using imported components: WHODischargeAssessment, MDTDischargeMedications, DischargeSummaryForm, DischargeDocumentsPreview

// ============= DISCHARGE HISTORY TAB =============

interface DischargeHistoryTabProps {
  discharges: Discharge[];
  onRefresh: () => void;
}

function DischargeHistoryTab({ discharges, onRefresh }: DischargeHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDischarges = discharges.filter(d =>
    (d.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.hospital_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search discharges..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />
        <button onClick={onRefresh} className="px-4 py-2 bg-gray-100 rounded-lg">🔄 Refresh</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Discharge Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Diagnosis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">LOS</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDischarges.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No discharge records found</td>
              </tr>
            ) : (
              filteredDischarges.map((discharge) => (
                <tr key={discharge.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{discharge.patient_name}</div>
                    <div className="text-xs text-gray-500">{discharge.hospital_number}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(discharge.discharge_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm"><div className="max-w-xs truncate">{discharge.final_diagnosis}</div></td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      discharge.discharge_type === 'normal' ? 'bg-green-100 text-green-700' :
                      discharge.discharge_type === 'on_request' ? 'bg-yellow-100 text-yellow-700' :
                      discharge.discharge_type === 'against_medical_advice' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {discharge.discharge_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{discharge.length_of_stay_days}d</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-blue-600 hover:text-blue-800 mr-2">View</button>
                    <button className="text-green-600 hover:text-green-800">📄 PDF</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= STATISTICS TAB =============

interface StatisticsTabProps {
  statistics: AdmissionStatistics;
}

function StatisticsTab({ statistics }: StatisticsTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Key Metrics */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800">Total Admissions</h4>
        <p className="text-3xl font-bold text-blue-600">{statistics.total_admissions}</p>
      </div>
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h4 className="text-sm font-medium text-green-800">Active Patients</h4>
        <p className="text-3xl font-bold text-green-600">{statistics.active_admissions}</p>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h4 className="text-sm font-medium text-purple-800">This Month</h4>
        <p className="text-3xl font-bold text-purple-600">{statistics.admissions_this_month}</p>
        <p className="text-xs text-purple-600">{statistics.discharges_this_month} discharged</p>
      </div>
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <h4 className="text-sm font-medium text-orange-800">Avg. Length of Stay</h4>
        <p className="text-3xl font-bold text-orange-600">{statistics.average_length_of_stay.toFixed(1)}</p>
        <p className="text-xs text-orange-600">days</p>
      </div>

      {/* By Route */}
      <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Admissions by Route</h4>
        <div className="space-y-2">
          <div className="flex justify-between"><span>Clinic</span><span className="font-semibold text-blue-600">{statistics.by_route.clinic}</span></div>
          <div className="flex justify-between"><span>Emergency</span><span className="font-semibold text-red-600">{statistics.by_route.emergency}</span></div>
          <div className="flex justify-between"><span>Consult Transfer</span><span className="font-semibold text-purple-600">{statistics.by_route.consult_transfer}</span></div>
        </div>
      </div>

      {/* By Discharge Type */}
      <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Discharge Types</h4>
        <div className="space-y-2">
          <div className="flex justify-between"><span>Normal</span><span className="font-semibold text-green-600">{statistics.by_discharge_type.normal}</span></div>
          <div className="flex justify-between"><span>On Request</span><span className="font-semibold text-yellow-600">{statistics.by_discharge_type.on_request}</span></div>
          <div className="flex justify-between"><span>Against Medical Advice</span><span className="font-semibold text-red-600">{statistics.by_discharge_type.against_medical_advice}</span></div>
          <div className="flex justify-between"><span>Transfer</span><span className="font-semibold text-blue-600">{statistics.by_discharge_type.transfer}</span></div>
          <div className="flex justify-between"><span>Deceased</span><span className="font-semibold text-gray-600">{statistics.by_discharge_type.deceased}</span></div>
        </div>
      </div>

      {/* By Ward */}
      <div className="md:col-span-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Current Patients by Ward</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(statistics.by_ward).map(([ward, count]) => (
            <div key={ward} className="flex justify-between bg-white p-2 rounded border">
              <span>{ward}</span>
              <span className="font-semibold text-green-600">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
