import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, Patient } from '../db/database';
import { apiClient } from '../services/apiClient';
import { preoperativeService } from '../services/preoperativeService';
import { patientActions } from '../components/Layout';
import {
  ArrowLeft,
  Plus,
  User,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// Map action href slugs to DB data categories (and fetch logic)
const ACTION_TO_CATEGORIES: Record<string, string[]> = {
  'admission-discharge': ['admissions', 'discharges'],
  'treatment-planning': ['treatment_plans'],
  'patient-summaries': ['patient_summaries'],
  'paperwork': ['paperwork'],
  'mdt': ['mdt'],
  'booking-register': ['surgeries'],
  'pre-surgical-conference': ['preop_assessments'],
  'blood-transfusion': ['blood_transfusion'],
  'ward-rounds': ['ward_rounds'],
  'ai-scribe': ['ai_scribe'],
  'limb-salvage': ['limb_salvage'],
  'burn-care': ['burn_care'],
  'wound-care': ['wound_care'],
  'keloid-care': ['keloid_care'],
  'soft-tissue-infection': ['soft_tissue_infection'],
  'pressure-sore': ['pressure_sore'],
  'labs': ['lab_investigations'],
  'prescriptions': ['prescriptions'],
  'patient-education': ['patient_education'],
};

async function fetchRecordsForCategory(patientId: string, category: string): Promise<any[]> {
  const pid = patientId;
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
      case 'burn_care': {
        try {
          return await db.burn_patients.where('patient_id').equals(pid).toArray();
        } catch { return []; }
      }
      case 'preop_assessments': {
        try {
          const assessment = await preoperativeService.getAssessmentByPatient(pid);
          if (assessment) return [assessment];
          let localData = await db.preoperative_assessments.where('patient_id').equals(pid).toArray();
          if (localData.length === 0 && !isNaN(numPid)) {
            localData = await db.preoperative_assessments.where('patient_id').equals(numPid as any).toArray();
          }
          return localData;
        } catch { return []; }
      }
      case 'patient_summaries': {
        try {
          return await db.patient_summaries.where('patient_id').equals(pid).toArray();
        } catch { return []; }
      }
      case 'paperwork': {
        try {
          return await db.paperwork_documents.where('patient_id').equals(pid).toArray();
        } catch { return []; }
      }
      case 'mdt': {
        try {
          return await db.mdt_patient_teams.where('patient_id').equals(pid).toArray();
        } catch { return []; }
      }
      case 'pressure_sore': {
        try {
          return await db.pressure_sore_assessments.where('patient_id').equals(pid).toArray();
        } catch { return []; }
      }
      default:
        return [];
    }
  } catch (error) {
    console.error(`Error fetching ${category} for patient ${pid}:`, error);
    return [];
  }
}

function getRecordDate(item: any): string {
  const dateField = item.admission_date || item.discharge_date || item.date || item.round_date ||
    item.prescribed_date || item.request_date || item.created_at || item.assessed_at ||
    item.assessment_date || item.scheduled_date || item.timestamp || item.updated_at;
  if (!dateField) return 'N/A';
  try { return new Date(dateField).toLocaleDateString(); } catch { return 'N/A'; }
}

function getRecordTitle(category: string, item: any, idx: number): string {
  switch (category) {
    case 'admissions': return `Admission #${idx + 1}`;
    case 'discharges': return `Discharge #${idx + 1}`;
    case 'prescriptions': return item.medication_name || item.drug_name || `Prescription #${idx + 1}`;
    case 'ward_rounds': return `Ward Round #${idx + 1}`;
    case 'surgeries': return item.procedure_name || item.surgery_type || `Surgery #${idx + 1}`;
    case 'lab_investigations': return item.test_name || item.investigation_type || `Lab Order #${idx + 1}`;
    case 'treatment_plans': return item.title || `Treatment Plan #${idx + 1}`;
    case 'wound_care': return item.wound_type || `Wound Assessment #${idx + 1}`;
    case 'burn_care': return `Burn Assessment #${idx + 1}`;
    case 'preop_assessments': return `Pre-op Assessment #${idx + 1}`;
    case 'patient_summaries': return item.title || `Patient Summary #${idx + 1}`;
    case 'paperwork': return item.document_name || item.title || `Document #${idx + 1}`;
    case 'mdt': return `MDT Record #${idx + 1}`;
    case 'pressure_sore': return `Pressure Sore Assessment #${idx + 1}`;
    default: return `Record #${idx + 1}`;
  }
}

function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    admissions: 'bg-blue-50 border-blue-200 text-blue-900',
    discharges: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    prescriptions: 'bg-green-50 border-green-200 text-green-900',
    ward_rounds: 'bg-purple-50 border-purple-200 text-purple-900',
    surgeries: 'bg-red-50 border-red-200 text-red-900',
    lab_investigations: 'bg-cyan-50 border-cyan-200 text-cyan-900',
    treatment_plans: 'bg-teal-50 border-teal-200 text-teal-900',
    wound_care: 'bg-pink-50 border-pink-200 text-pink-900',
    burn_care: 'bg-orange-50 border-orange-200 text-orange-900',
    preop_assessments: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    patient_summaries: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    paperwork: 'bg-slate-50 border-slate-200 text-slate-900',
    mdt: 'bg-violet-50 border-violet-200 text-violet-900',
    pressure_sore: 'bg-amber-50 border-amber-200 text-amber-900',
  };
  return colors[category] || 'bg-gray-50 border-gray-200 text-gray-900';
}

function renderRecordDetails(category: string, item: any): React.ReactNode {
  const fields: { label: string; value: any }[] = [];

  switch (category) {
    case 'admissions':
      if (item.ward_location) fields.push({ label: 'Ward', value: item.ward_location });
      if (item.route_of_admission) fields.push({ label: 'Route', value: item.route_of_admission });
      if (item.admitting_diagnosis) fields.push({ label: 'Diagnosis', value: item.admitting_diagnosis });
      if (item.admitting_doctor) fields.push({ label: 'Doctor', value: item.admitting_doctor });
      if (item.consultant_name) fields.push({ label: 'Consultant', value: item.consultant_name });
      if (item.status) fields.push({ label: 'Status', value: item.status });
      break;
    case 'discharges':
      if (item.discharge_status) fields.push({ label: 'Status', value: item.discharge_status });
      if (item.discharge_type) fields.push({ label: 'Type', value: item.discharge_type });
      if (item.discharge_diagnosis) fields.push({ label: 'Diagnosis', value: item.discharge_diagnosis });
      if (item.follow_up_plan) fields.push({ label: 'Follow-up', value: item.follow_up_plan });
      break;
    case 'prescriptions':
      if (item.dosage) fields.push({ label: 'Dosage', value: item.dosage });
      if (item.frequency) fields.push({ label: 'Frequency', value: item.frequency });
      if (item.route) fields.push({ label: 'Route', value: item.route });
      if (item.duration) fields.push({ label: 'Duration', value: item.duration });
      if (item.prescribed_by) fields.push({ label: 'Prescribed by', value: item.prescribed_by });
      if (item.status) fields.push({ label: 'Status', value: item.status });
      break;
    case 'ward_rounds':
      if (item.ward_name) fields.push({ label: 'Ward', value: item.ward_name });
      if (item.consultant) fields.push({ label: 'Consultant', value: item.consultant });
      if (item.clinical_status) fields.push({ label: 'Clinical Status', value: item.clinical_status });
      if (item.notes) fields.push({ label: 'Notes', value: item.notes });
      if (item.plan) fields.push({ label: 'Plan', value: item.plan });
      break;
    case 'surgeries':
      if (item.date) fields.push({ label: 'Date', value: new Date(item.date).toLocaleDateString() });
      if (item.theatre_number) fields.push({ label: 'Theatre', value: item.theatre_number });
      if (item.primary_surgeon) fields.push({ label: 'Surgeon', value: item.primary_surgeon });
      if (item.anesthesia_type) fields.push({ label: 'Anesthesia', value: item.anesthesia_type });
      if (item.estimated_duration) fields.push({ label: 'Duration', value: item.estimated_duration });
      if (item.status) fields.push({ label: 'Status', value: item.status });
      break;
    case 'lab_investigations':
      if (item.requested_by) fields.push({ label: 'Requested by', value: item.requested_by });
      if (item.urgency) fields.push({ label: 'Urgency', value: item.urgency });
      if (item.result) fields.push({ label: 'Result', value: item.result });
      if (item.clinical_indication) fields.push({ label: 'Indication', value: item.clinical_indication });
      if (item.status) fields.push({ label: 'Status', value: item.status });
      break;
    case 'treatment_plans':
      if (item.diagnosis) fields.push({ label: 'Diagnosis', value: item.diagnosis });
      if (item.goals) fields.push({ label: 'Goals', value: typeof item.goals === 'string' ? item.goals : JSON.stringify(item.goals) });
      if (item.status) fields.push({ label: 'Status', value: item.status });
      break;
    case 'wound_care':
      if (item.wound_location) fields.push({ label: 'Location', value: item.wound_location });
      if (item.wound_stage) fields.push({ label: 'Stage', value: item.wound_stage });
      if (item.assessed_by) fields.push({ label: 'Assessed by', value: item.assessed_by });
      if (item.treatment) fields.push({ label: 'Treatment', value: item.treatment });
      break;
    case 'burn_care':
      if (item.tbsa_percentage) fields.push({ label: 'TBSA %', value: item.tbsa_percentage });
      if (item.burn_type) fields.push({ label: 'Burn Type', value: item.burn_type });
      if (item.burn_depth) fields.push({ label: 'Depth', value: item.burn_depth });
      if (item.mechanism) fields.push({ label: 'Mechanism', value: item.mechanism });
      break;
    case 'preop_assessments':
      if (item.assessed_by) fields.push({ label: 'Assessed by', value: item.assessed_by });
      if (item.comprehensive_summary) {
        const summary = typeof item.comprehensive_summary === 'string' ? item.comprehensive_summary : JSON.stringify(item.comprehensive_summary);
        fields.push({ label: 'Summary', value: summary.substring(0, 300) + (summary.length > 300 ? '...' : '') });
      }
      break;
    case 'patient_summaries':
      if (item.summary_type) fields.push({ label: 'Type', value: item.summary_type });
      if (item.created_by) fields.push({ label: 'Created by', value: item.created_by });
      if (item.content) fields.push({ label: 'Content', value: typeof item.content === 'string' ? item.content.substring(0, 300) : '' });
      break;
    case 'paperwork':
      if (item.document_type) fields.push({ label: 'Type', value: item.document_type });
      if (item.created_by) fields.push({ label: 'Created by', value: item.created_by });
      if (item.status) fields.push({ label: 'Status', value: item.status });
      break;
    case 'mdt':
      if (item.team_role) fields.push({ label: 'Role', value: item.team_role });
      if (item.team_member) fields.push({ label: 'Member', value: item.team_member });
      if (item.notes) fields.push({ label: 'Notes', value: item.notes });
      break;
    case 'pressure_sore':
      if (item.location) fields.push({ label: 'Location', value: item.location });
      if (item.stage) fields.push({ label: 'Stage', value: item.stage });
      if (item.risk_score) fields.push({ label: 'Risk Score', value: item.risk_score });
      if (item.assessed_by) fields.push({ label: 'Assessed by', value: item.assessed_by });
      break;
    default:
      // Show raw JSON for unmapped categories
      return (
        <pre className="text-xs text-gray-600 overflow-auto max-h-40 mt-2">
          {JSON.stringify(item, null, 2)}
        </pre>
      );
  }

  if (fields.length === 0) return null;

  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-700">
      {fields.map((f, i) => (
        <div key={i} className={f.value && String(f.value).length > 60 ? 'col-span-2' : ''}>
          <span className="font-medium">{f.label}:</span> {f.value}
        </div>
      ))}
    </div>
  );
}

const PatientActionRecords: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const actionSlug = searchParams.get('action') || '';
  const patientId = searchParams.get('patient') || '';
  const actionName = searchParams.get('name') || '';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<{ category: string; data: any[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRecords, setExpandedRecords] = useState<Set<string>>(new Set());

  // Find the action configuration
  const actionConfig = patientActions.find(a => a.href === `/${actionSlug}`);
  const ActionIcon = actionConfig?.icon || FileText;
  const displayName = actionConfig?.name || actionName || actionSlug;

  // Get categories to query
  const categories = ACTION_TO_CATEGORIES[actionSlug] || [];

  const loadData = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);

    try {
      // Load patient
      let p: Patient | undefined;
      try {
        p = await db.patients.get(Number(patientId));
      } catch {}
      if (!p) {
        try {
          p = await db.patients.where('id').equals(patientId).first();
        } catch {}
      }
      if (!p) {
        // Try API
        try {
          const serverPatient = await apiClient.getPatient(patientId);
          if (serverPatient) p = serverPatient as any;
        } catch {}
      }
      setPatient(p || null);

      // Load records for each category
      const results: { category: string; data: any[] }[] = [];
      for (const cat of categories) {
        const data = await fetchRecordsForCategory(patientId, cat);
        results.push({ category: cat, data });
      }
      setRecords(results);
    } catch (error) {
      console.error('Error loading patient action records:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId, categories]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleRecordExpand = (key: string) => {
    setExpandedRecords(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalRecords = records.reduce((sum, r) => sum + r.data.length, 0);

  const handleStartNewRecord = () => {
    navigate(`/${actionSlug}?patient=${patientId}`);
  };

  if (!patientId || !actionSlug) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Invalid parameters. Please select a patient and action.</p>
        <button onClick={() => navigate('/patients')} className="mt-4 btn-primary">
          Back to Patients
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/patients')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Back to patients"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="p-2 bg-sky-100 rounded-lg">
            <ActionIcon className="h-6 w-6 text-navy-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
            <p className="text-sm text-gray-500">Patient action records</p>
          </div>
        </div>
      </div>

      {/* Patient Info Card */}
      {loading ? (
        <div className="card p-6 mb-6 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-100 rounded w-32"></div>
        </div>
      ) : patient ? (
        <div className="card p-4 mb-6 border-l-4 border-l-green-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-full">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">
                {patient.name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown Patient'}
              </h2>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                {patient.hospital_number && (
                  <span>Hospital #: <strong>{patient.hospital_number}</strong></span>
                )}
                {(patient.dob || patient.date_of_birth) && (
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    DOB: {new Date(patient.dob || patient.date_of_birth!).toLocaleDateString()}
                  </span>
                )}
                {patient.gender && <span>Gender: {patient.gender}</span>}
                {patient.ward && <span>Ward: {patient.ward}</span>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 mb-6 border-l-4 border-l-yellow-500">
          <p className="text-sm text-yellow-700">Patient information not available (ID: {patientId})</p>
        </div>
      )}

      {/* Start New Record Button */}
      <div className="mb-6">
        <button
          onClick={handleStartNewRecord}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all text-sm"
        >
          <Plus className="h-5 w-5" />
          Start New {displayName} Record
        </button>
      </div>

      {/* Previous Records */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" />
          Previous Records
          {!loading && (
            <span className="text-sm font-normal text-gray-500">
              ({totalRecords} {totalRecords === 1 ? 'record' : 'records'} found)
            </span>
          )}
        </h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-40 mb-2"></div>
              <div className="h-3 bg-gray-100 rounded w-64"></div>
            </div>
          ))}
        </div>
      ) : totalRecords === 0 ? (
        <div className="card p-8 text-center">
          <div className="p-3 bg-gray-100 rounded-full w-fit mx-auto mb-3">
            <FileText className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No previous {displayName.toLowerCase()} records</p>
          <p className="text-sm text-gray-400 mt-1">
            Click the button above to create the first record for this patient.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(({ category, data }) => (
            data.length > 0 && (
              <div key={category}>
                {/* Show category header if multiple categories */}
                {records.filter(r => r.data.length > 0).length > 1 && (
                  <h4 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    {category.replace(/_/g, ' ')} ({data.length})
                  </h4>
                )}
                <div className="space-y-2">
                  {data.map((item: any, idx: number) => {
                    const recordKey = `${category}-${idx}`;
                    const isExpanded = expandedRecords.has(recordKey);
                    const colorClass = getCategoryColor(category);

                    return (
                      <div
                        key={recordKey}
                        className={`border rounded-lg overflow-hidden transition-all ${colorClass}`}
                      >
                        {/* Record Header - Always visible */}
                        <button
                          onClick={() => toggleRecordExpand(recordKey)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-white/30 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-semibold text-sm truncate">
                              {getRecordTitle(category, item, idx)}
                            </span>
                            {item.status && (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                                item.status === 'active' || item.status === 'completed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : item.status === 'pending' || item.status === 'scheduled'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {item.status}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-500">{getRecordDate(item)}</span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                        </button>

                        {/* Record Details - Expandable */}
                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-current/10">
                            {renderRecordDetails(category, item)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Bottom action button for convenience */}
      {totalRecords > 3 && (
        <div className="mt-6 text-center">
          <button
            onClick={handleStartNewRecord}
            className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium shadow-lg hover:shadow-xl transition-all text-sm"
          >
            <Plus className="h-5 w-5" />
            Start New {displayName} Record
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientActionRecords;
