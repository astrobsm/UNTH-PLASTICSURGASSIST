import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db/database';
import { Patient } from '../db/database';
import { PatientRegistrationForm } from '../components/PatientRegistrationForm';
import patientService from '../services/patientService';
import { apiClient } from '../services/apiClient';
import { preoperativeService } from '../services/preoperativeService';

// Data category definitions
interface DataCategory {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const DATA_CATEGORIES: DataCategory[] = [
  { key: 'admissions', label: 'Admissions', icon: '🏥', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { key: 'discharges', label: 'Discharges', icon: '🚪', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { key: 'prescriptions', label: 'Prescriptions', icon: '💊', color: 'bg-green-100 text-green-800 border-green-300' },
  { key: 'ward_rounds', label: 'Ward Rounds', icon: '🩺', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { key: 'surgeries', label: 'Surgeries', icon: '🔪', color: 'bg-red-100 text-red-800 border-red-300' },
  { key: 'procedures', label: 'Procedures', icon: '📋', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { key: 'lab_investigations', label: 'Lab Orders', icon: '🔬', color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
  { key: 'treatment_plans', label: 'Treatment Plans', icon: '📝', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { key: 'wound_care', label: 'Wound Care', icon: '🩹', color: 'bg-pink-100 text-pink-800 border-pink-300' },
  { key: 'preop_assessments', label: 'Pre-op Assessments', icon: '📊', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
];

export const Patients: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'discharged'>('all');
  
  // Records viewer state
  const [expandedPatientId, setExpandedPatientId] = useState<number | string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [loadingCategory, setLoadingCategory] = useState(false);

  // MDT patient tracking
  const [mdtPatientIds, setMdtPatientIds] = useState<Set<string | number>>(new Set());

  // Fetch category data for a patient
  const fetchCategoryData = useCallback(async (patientId: string | number, category: string) => {
    const pid = String(patientId);
    const numPid = Number(patientId);
    
    try {
      switch (category) {
        case 'admissions': {
          try {
            const serverData = await apiClient.getAdmissions(undefined, pid);
            if (Array.isArray(serverData) && serverData.length > 0) return serverData;
          } catch {}
          let data = await db.admissions.where('patient_id').equals(pid).toArray();
          if (data.length === 0 && !isNaN(numPid)) {
            data = await db.admissions.where('patient_id').equals(numPid as any).toArray();
          }
          return data;
        }
        case 'discharges': {
          let data: any[] = [];
          try {
            data = await db.discharges.where('patient_id').equals(pid).toArray();
            if (data.length === 0 && !isNaN(numPid)) {
              data = await db.discharges.where('patient_id').equals(numPid as any).toArray();
            }
          } catch {}
          return data;
        }
        case 'prescriptions': {
          try {
            const serverData = await apiClient.getPrescriptions(pid);
            if (Array.isArray(serverData) && serverData.length > 0) return serverData;
          } catch {}
          return await db.prescriptions?.where('patient_id').equals(pid).toArray() || [];
        }
        case 'ward_rounds': {
          try {
            const serverData = await apiClient.getWardRoundsByPatient(pid);
            if (Array.isArray(serverData) && serverData.length > 0) return serverData;
          } catch {}
          return await db.ward_rounds.filter(r => String(r.patient_id) === pid).toArray();
        }
        case 'surgeries': {
          try {
            const serverData = await apiClient.getSurgeries(pid);
            if (Array.isArray(serverData) && serverData.length > 0) return serverData;
          } catch {}
          return await db.surgery_bookings.where('patient_id').equals(pid).toArray();
        }
        case 'procedures': {
          try {
            return await db.procedures.where('patient_id').equals(pid).toArray();
          } catch { return []; }
        }
        case 'lab_investigations': {
          try {
            const serverData = await apiClient.getLabInvestigations(pid);
            if (Array.isArray(serverData) && serverData.length > 0) return serverData;
          } catch {}
          return await db.lab_investigations.where('patient_id').equals(pid).toArray();
        }
        case 'treatment_plans': {
          try {
            const serverData = await apiClient.getTreatmentPlans(pid);
            if (Array.isArray(serverData) && serverData.length > 0) return serverData;
          } catch {}
          let data = await db.treatment_plans.where('patient_id').equals(pid).toArray();
          if (data.length === 0 && !isNaN(numPid)) {
            data = await db.treatment_plans.where('patient_id').equals(String(numPid)).toArray();
          }
          return data;
        }
        case 'wound_care': {
          try {
            return await db.wound_care.where('patient_id').equals(pid).toArray();
          } catch { return []; }
        }
        case 'preop_assessments': {
          try {
            // Try the preoperativeService first (handles API + local fallback)
            const assessment = await preoperativeService.getAssessmentByPatient(pid);
            if (assessment) return [assessment];
            
            // Also try fetching all assessments for this patient from local DB with various ID formats
            let localData = await db.preoperative_assessments.where('patient_id').equals(pid).toArray();
            if (localData.length === 0 && !isNaN(numPid)) {
              localData = await db.preoperative_assessments.where('patient_id').equals(numPid as any).toArray();
            }
            if (localData.length === 0) {
              // Try string match on all assessments (handles ID format mismatches)
              localData = await db.preoperative_assessments.filter(
                (a: any) => String(a.patient_id) === pid || String(a.patient_id) === String(numPid)
              ).toArray();
            }
            return localData;
          } catch { return []; }
        }
        default:
          return [];
      }
    } catch (error) {
      console.error(`Error fetching ${category} for patient ${pid}:`, error);
      return [];
    }
  }, []);

  // Handle category selection
  const handleCategorySelect = useCallback(async (patientId: number | string, category: string) => {
    if (expandedPatientId === patientId && selectedCategory === category) {
      // Toggle off if same category clicked
      setSelectedCategory(null);
      setCategoryData([]);
      return;
    }
    
    setExpandedPatientId(patientId);
    setSelectedCategory(category);
    setLoadingCategory(true);
    setCategoryData([]);
    
    try {
      const data = await fetchCategoryData(patientId, category);
      setCategoryData(data);
    } catch (error) {
      console.error('Error loading category data:', error);
      setCategoryData([]);
    } finally {
      setLoadingCategory(false);
    }
  }, [expandedPatientId, selectedCategory, fetchCategoryData]);

  // Toggle expand/collapse for a patient
  const togglePatientExpand = useCallback((patientId: number | string) => {
    if (expandedPatientId === patientId) {
      setExpandedPatientId(null);
      setSelectedCategory(null);
      setCategoryData([]);
    } else {
      setExpandedPatientId(patientId);
      setSelectedCategory(null);
      setCategoryData([]);
    }
  }, [expandedPatientId]);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      
      // Fetch from server API first (includes ALL patients from all users)
      // This also updates local IndexedDB for offline access
      let patientData = await patientService.getAllPatients();
      
      // Filter out deleted patients
      const activePatients = patientData.filter((p: any) => !p.deleted);
      setPatients(activePatients);
    } catch (error) {
      console.error('Error loading patients:', error);
      
      // Fallback to local IndexedDB if API fails
      const localPatients = await db.patients
        .orderBy('created_at')
        .reverse()
        .toArray();
      setPatients(localPatients.filter(p => !p.deleted));
    } finally {
      setLoading(false);
    }

    // Load MDT patient IDs
    try {
      const mdtTeams = await db.mdt_patient_teams.toArray();
      const ids = new Set<string | number>(
        mdtTeams.filter((t: any) => t.is_active).map((t: any) => t.patient_id)
      );
      setMdtPatientIds(ids);
    } catch (e) {
      console.error('Error loading MDT patient IDs:', e);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = searchTerm === '' || 
      (patient.first_name && patient.first_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.last_name && patient.last_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.hospital_number && patient.hospital_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (patient.phone && patient.phone.includes(searchTerm));
    
    // For now, treating all patients as active since we don't have discharge status in the schema
    const matchesFilter = filterStatus === 'all' || filterStatus === 'active';
    
    return matchesSearch && matchesFilter;
  });

  const handleRegistrationSuccess = (patientId: string) => {
    setShowRegistrationForm(false);
    loadPatients(); // Refresh the patient list
    alert(`Patient registered successfully! Patient ID: ${patientId}`);
  };

  // Render category data records
  const renderCategoryRecords = (category: string, data: any[]) => {
    if (data.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500 text-sm">
          No {DATA_CATEGORIES.find(c => c.key === category)?.label?.toLowerCase() || 'records'} found for this patient.
        </div>
      );
    }

    switch (category) {
      case 'admissions':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-semibold text-blue-900">Admission #{idx + 1}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                    }`}>{item.status || 'Active'}</span>
                  </div>
                  <span className="text-xs text-gray-500">{item.admission_date ? new Date(item.admission_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.ward_location && <div><span className="font-medium">Ward:</span> {item.ward_location}</div>}
                  {item.route_of_admission && <div><span className="font-medium">Route:</span> {item.route_of_admission}</div>}
                  {item.admitting_diagnosis && <div className="col-span-2"><span className="font-medium">Diagnosis:</span> {item.admitting_diagnosis}</div>}
                  {item.admitting_doctor && <div><span className="font-medium">Doctor:</span> {item.admitting_doctor}</div>}
                  {item.consultant_name && <div><span className="font-medium">Consultant:</span> {item.consultant_name}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'discharges':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-indigo-900">Discharge #{idx + 1}</span>
                  <span className="text-xs text-gray-500">{item.discharge_date ? new Date(item.discharge_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.discharge_status && <div><span className="font-medium">Status:</span> {item.discharge_status}</div>}
                  {item.discharge_type && <div><span className="font-medium">Type:</span> {item.discharge_type}</div>}
                  {item.discharge_diagnosis && <div className="col-span-2"><span className="font-medium">Diagnosis:</span> {item.discharge_diagnosis}</div>}
                  {item.follow_up_plan && <div className="col-span-2"><span className="font-medium">Follow-up:</span> {item.follow_up_plan}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'prescriptions':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-green-900">{item.medication_name || item.drug_name || 'Medication'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>{item.status || 'Active'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.dosage && <div><span className="font-medium">Dosage:</span> {item.dosage}</div>}
                  {item.frequency && <div><span className="font-medium">Frequency:</span> {item.frequency}</div>}
                  {item.route && <div><span className="font-medium">Route:</span> {item.route}</div>}
                  {item.duration && <div><span className="font-medium">Duration:</span> {item.duration}</div>}
                  {item.prescribed_by && <div><span className="font-medium">Prescribed by:</span> {item.prescribed_by}</div>}
                  {item.prescribed_date && <div><span className="font-medium">Date:</span> {new Date(item.prescribed_date).toLocaleDateString()}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'ward_rounds':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-purple-900">Ward Round #{idx + 1}</span>
                  <span className="text-xs text-gray-500">{item.date || item.round_date ? new Date(item.date || item.round_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.ward_name && <div><span className="font-medium">Ward:</span> {item.ward_name}</div>}
                  {item.consultant && <div><span className="font-medium">Consultant:</span> {item.consultant}</div>}
                  {item.clinical_status && <div><span className="font-medium">Clinical Status:</span> {item.clinical_status}</div>}
                  {item.status && <div><span className="font-medium">Status:</span> {item.status}</div>}
                  {item.notes && <div className="col-span-2"><span className="font-medium">Notes:</span> {item.notes}</div>}
                  {item.plan && <div className="col-span-2"><span className="font-medium">Plan:</span> {item.plan}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'surgeries':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-red-900">{item.procedure_name || item.surgery_type || 'Surgery'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    item.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                  }`}>{item.status || 'Scheduled'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.date && <div><span className="font-medium">Date:</span> {new Date(item.date).toLocaleDateString()}</div>}
                  {item.theatre_number && <div><span className="font-medium">Theatre:</span> {item.theatre_number}</div>}
                  {item.primary_surgeon && <div><span className="font-medium">Surgeon:</span> {item.primary_surgeon}</div>}
                  {item.anesthesia_type && <div><span className="font-medium">Anesthesia:</span> {item.anesthesia_type}</div>}
                  {item.estimated_duration && <div><span className="font-medium">Duration:</span> {item.estimated_duration}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'procedures':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-orange-900">{item.procedure_name || 'Procedure'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{item.status || 'Pending'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.procedure_type && <div><span className="font-medium">Type:</span> {item.procedure_type}</div>}
                  {item.scheduled_date && <div><span className="font-medium">Date:</span> {new Date(item.scheduled_date).toLocaleDateString()}</div>}
                  {item.surgeon && <div><span className="font-medium">Surgeon:</span> {item.surgeon}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'lab_investigations':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-cyan-900">{item.test_name || item.investigation_type || 'Lab Investigation'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'completed' ? 'bg-green-100 text-green-700' : 
                    item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
                  }`}>{item.status || 'Pending'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.request_date && <div><span className="font-medium">Requested:</span> {new Date(item.request_date).toLocaleDateString()}</div>}
                  {item.requested_by && <div><span className="font-medium">By:</span> {item.requested_by}</div>}
                  {item.urgency && <div><span className="font-medium">Urgency:</span> {item.urgency}</div>}
                  {item.result && <div className="col-span-2"><span className="font-medium">Result:</span> {item.result}</div>}
                  {item.clinical_indication && <div className="col-span-2"><span className="font-medium">Indication:</span> {item.clinical_indication}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'treatment_plans':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-teal-50 border border-teal-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-teal-900">{item.title || 'Treatment Plan'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.status === 'active' ? 'bg-green-100 text-green-700' : 
                    item.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}>{item.status || 'Active'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.diagnosis && <div className="col-span-2"><span className="font-medium">Diagnosis:</span> {item.diagnosis}</div>}
                  {item.created_at && <div><span className="font-medium">Created:</span> {new Date(item.created_at).toLocaleDateString()}</div>}
                  {item.goals && <div className="col-span-2"><span className="font-medium">Goals:</span> {typeof item.goals === 'string' ? item.goals : JSON.stringify(item.goals)}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'wound_care':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-pink-900">{item.wound_type || 'Wound Assessment'}</span>
                  <span className="text-xs text-gray-500">{item.assessment_date ? new Date(item.assessment_date).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.wound_location && <div><span className="font-medium">Location:</span> {item.wound_location}</div>}
                  {item.wound_stage && <div><span className="font-medium">Stage:</span> {item.wound_stage}</div>}
                  {item.assessed_by && <div><span className="font-medium">Assessed by:</span> {item.assessed_by}</div>}
                  {item.treatment && <div className="col-span-2"><span className="font-medium">Treatment:</span> {item.treatment}</div>}
                </div>
              </div>
            ))}
          </div>
        );

      case 'preop_assessments':
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <span className="font-semibold text-yellow-900">Pre-op Assessment #{idx + 1}</span>
                  <span className="text-xs text-gray-500">{item.assessed_at ? new Date(item.assessed_at).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-700">
                  {item.assessed_by && <div><span className="font-medium">Assessed by:</span> {item.assessed_by}</div>}
                  {item.comprehensive_summary && <div className="col-span-2"><span className="font-medium">Summary:</span> {
                    typeof item.comprehensive_summary === 'string' 
                      ? item.comprehensive_summary.substring(0, 200) + (item.comprehensive_summary.length > 200 ? '...' : '')
                      : JSON.stringify(item.comprehensive_summary).substring(0, 200)
                  }</div>}
                  {item.preop_instructions && <div className="col-span-2"><span className="font-medium">Instructions:</span> {
                    typeof item.preop_instructions === 'string'
                      ? item.preop_instructions.substring(0, 200) + (item.preop_instructions.length > 200 ? '...' : '')
                      : JSON.stringify(item.preop_instructions).substring(0, 200)
                  }</div>}
                </div>
              </div>
            ))}
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            {data.map((item: any, idx: number) => (
              <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <pre className="text-xs text-gray-700 overflow-auto">{JSON.stringify(item, null, 2)}</pre>
              </div>
            ))}
          </div>
        );
    }
  };

  if (showRegistrationForm) {
    return (
      <div>
        <PatientRegistrationForm 
          onSuccess={handleRegistrationSuccess}
          onCancel={() => setShowRegistrationForm(false)}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title">Patients - UNTH</h1>
          <p className="page-subtitle">Manage patient records and registrations</p>
        </div>
        <button
          onClick={() => setShowRegistrationForm(true)}
          className="btn-primary w-full sm:w-auto"
        >
          + Register New Patient
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card p-3 sm:p-4 mb-4">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="form-select sm:w-48"
              title="Filter patients by status"
            >
              <option value="all">All Patients</option>
              <option value="active">Active</option>
              <option value="discharged">Discharged</option>
            </select>
            
            <span className="text-sm text-gray-500 text-center sm:text-right">
              {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {loading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No patients found' : 'No patients registered'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm 
                ? 'Try adjusting your search criteria.' 
                : 'Get started by registering your first patient.'
              }
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowRegistrationForm(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Register First Patient
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredPatients.map((patient) => (
              <div key={patient.id} className="transition-colors">
                <div className="p-3 sm:p-4">
                  <div className="flex items-start sm:items-center gap-3">
                    {/* Patient Avatar - links to profile */}
                    <Link to={`/patients/${patient.id}`} className="flex-shrink-0">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-semibold text-sm sm:text-base hover:bg-green-700 transition-colors">
                        {patient.first_name?.[0]}{patient.last_name?.[0]}
                      </div>
                    </Link>
                    
                    {/* Patient Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/patients/${patient.id}`} className="hover:underline">
                          <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                            {patient.first_name} {patient.last_name}
                          </h3>
                        </Link>
                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Active
                        </span>
                      </div>
                      
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-500">
                        <span className="flex items-center">
                          <svg className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                          </svg>
                          {patient.hospital_number}
                        </span>
                        
                        <span className="flex items-center">
                          <svg className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {patient.phone}
                        </span>
                        
                        <span className="hidden sm:flex items-center">
                          <svg className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4h6m-6 4h6m-6 4h6M3 7h18" />
                          </svg>
                          DOB: {patient.dob || patient.date_of_birth || 'N/A'}
                        </span>
                        
                        <span className="flex items-center capitalize">
                          <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {patient.sex}
                        </span>
                      </div>

                      {/* Allergies and Comorbidities */}
                      {(patient.allergies?.length || patient.comorbidities?.length) && (
                        <div className="mt-2 flex items-center space-x-4">
                          {patient.allergies && Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-red-600 font-medium">Allergies:</span>
                              <div className="flex space-x-1">
                                {patient.allergies.slice(0, 2).map((allergy: any, index: number) => (
                                  <span key={index} className="inline-block bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded-full">
                                    {typeof allergy === 'object' && allergy !== null ? (allergy.name || allergy.allergen || JSON.stringify(allergy)) : String(allergy)}
                                  </span>
                                ))}
                                {patient.allergies.length > 2 && (
                                  <span className="text-xs text-red-600">
                                    +{patient.allergies.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {patient.comorbidities && patient.comorbidities.length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-yellow-600 font-medium">Conditions:</span>
                              <div className="flex space-x-1">
                                {patient.comorbidities.slice(0, 2).map((condition: any, index: number) => (
                                  <span key={index} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5 rounded-full">
                                    {typeof condition === 'object' && condition !== null ? (condition.condition || condition.name || JSON.stringify(condition)) : String(condition)}
                                  </span>
                                ))}
                                {patient.comorbidities.length > 2 && (
                                  <span className="text-xs text-yellow-600">
                                    +{patient.comorbidities.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* View Records Button */}
                      <button
                        onClick={() => togglePatientExpand(patient.id!)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                          expandedPatientId === patient.id
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
                        }`}
                        title="View patient records"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="hidden sm:inline">Records</span>
                      </button>

                      {/* MDT Button */}
                      {mdtPatientIds.has(patient.id!) ? (
                        <Link
                          to="/mdt"
                          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                          title="View MDT reviews"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="hidden sm:inline">MDT</span>
                        </Link>
                      ) : (
                        <button
                          disabled
                          className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 bg-gray-200 text-gray-400 cursor-not-allowed"
                          title="Patient not in MDT"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="hidden sm:inline">MDT</span>
                        </button>
                      )}

                      {/* Profile Link */}
                      <Link
                        to={`/patients/${patient.id}`}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors"
                        title="View full profile"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                </div>
                
                {/* Expandable Records Panel */}
                {expandedPatientId === patient.id && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    {/* Category Tabs */}
                    <div className="p-3 overflow-x-auto">
                      <div className="flex gap-2 min-w-max">
                        {DATA_CATEGORIES.map((cat) => (
                          <button
                            key={cat.key}
                            onClick={() => handleCategorySelect(patient.id!, cat.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap flex items-center gap-1 ${
                              selectedCategory === cat.key
                                ? cat.color + ' shadow-sm ring-1 ring-offset-1'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span>{cat.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Category Data Display */}
                    {selectedCategory && (
                      <div className="px-3 pb-3">
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-3 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-700">
                              {DATA_CATEGORIES.find(c => c.key === selectedCategory)?.icon}{' '}
                              {DATA_CATEGORIES.find(c => c.key === selectedCategory)?.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {loadingCategory ? 'Loading...' : `${categoryData.length} record${categoryData.length !== 1 ? 's' : ''}`}
                            </span>
                          </div>
                          <div className="p-3 max-h-80 overflow-y-auto">
                            {loadingCategory ? (
                              <div className="flex items-center justify-center py-6">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                                <span className="ml-2 text-sm text-gray-500">Loading records...</span>
                              </div>
                            ) : (
                              renderCategoryRecords(selectedCategory, categoryData)
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Statistics Footer */}
      {!loading && filteredPatients.length > 0 && (
        <div className="mt-4 sm:mt-6 card p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            <div className="text-center">
              <div className="stat-value text-green-600">{filteredPatients.length}</div>
              <div className="stat-label">Total Patients</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-blue-600">
                {filteredPatients.filter(p => p.sex === 'male').length}
              </div>
              <div className="stat-label">Male</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-pink-600">
                {filteredPatients.filter(p => p.sex === 'female').length}
              </div>
              <div className="stat-label">Female</div>
            </div>
            <div className="text-center">
              <div className="stat-value text-purple-600">
                {filteredPatients.filter(p => p.allergies && p.allergies.length > 0).length}
              </div>
              <div className="stat-label">With Allergies</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;