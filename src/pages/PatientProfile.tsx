import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { Patient } from '../db/database';
import { patientService } from '../services/patientService';
import { unthPatientService } from '../services/unthPatientService';
import { PatientSummaryView, QuickSummaryCard } from '../components/PatientSummary';
import { DischargePlanning } from '../components/DischargePlanning';
import { PrescriptionModal } from '../components/PrescriptionModal';
import { medicalTeamService, TeamMember } from '../services/medicalTeamService';
import { logPatientAccess } from '../services/auditLoggingService';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { speechToTextService } from '../services/speechToTextService';
import { DocumentScannerModal } from '../components/DocumentScannerModal';
import {
  Activity, Camera, Calendar, Clock, FileText, Plus, TrendingUp,
  Scissors, ClipboardCheck, Pill, Heart, Image, AlertCircle,
  ChevronRight, X, Save, Loader2, Thermometer, Droplet,
  Eye, Trash2, Upload, Mic, MicOff, ScanLine, Printer, RefreshCw
} from 'lucide-react';

export const PatientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Patient>>({});
  const [activeTab, setActiveTab] = useState('encounters');
  const [admissionStatus, setAdmissionStatus] = useState<{ isAdmitted: boolean; ward?: string; bed?: string; admissionDate?: string; daysAdmitted?: number; lastSurgery?: { procedure_name: string; date: string; daysPostOp: number }; surgeryCount?: number } | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [medicalTeam, setMedicalTeam] = useState<TeamMember[]>([]);
  const [mdtInfo, setMdtInfo] = useState<{ patient_type: string; consulting_unit?: string; referring_hospital?: string; mdt_team?: any } | null>(null);

  useEffect(() => {
    if (id) {
      loadPatientData();
      loadAdmissionStatus();
      loadMDTInfo();
    }
  }, [id]);

  useEffect(() => {
    if (patient) {
      loadMedicalTeam();
    }
  }, [patient]);

  // Log patient access for HIPAA compliance
  useEffect(() => {
    if (patient && user) {
      const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
      logPatientAccess(
        user.id,
        user.name,
        user.role,
        patient.hospital_number,
        patientName,
        'VIEW'
      );
    }
  }, [patient, user]);

  const loadPatientData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const patientData = await patientService.getPatient(id);
      setPatient(patientData || null);
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdmissionStatus = async () => {
    if (!id) return;
    try {
      const data = await apiClient.get(`/admissions?patientId=${id}&status=active`);
      const admissions = data?.admissions || [];
      if (admissions.length > 0) {
        const latest = admissions[0];
        const admDate = new Date(latest.admission_date);
        const now = new Date();
        const daysAdmitted = Math.max(1, Math.ceil((now.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)));

        // Fetch surgeries for this patient that happened during admission
        let lastSurgery: { procedure_name: string; date: string; daysPostOp: number } | undefined;
        let surgeryCount = 0;
        try {
          const surgData: any = await apiClient.get(`/sync/surgeries`);
          const allSurgeries = Array.isArray(surgData) ? surgData : (surgData?.surgeries || []);
          const patientSurgeries = allSurgeries
            .filter((s: any) => {
              const sId = String(s.patient_id);
              const matchesPatient = sId === String(id) || sId === String(latest.patient_id);
              if (!matchesPatient) return false;
              const surgDate = new Date(s.actual_end_time || s.scheduled_date);
              return surgDate >= admDate && (s.status === 'completed' || s.status === 'done');
            })
            .sort((a: any, b: any) => new Date(b.actual_end_time || b.scheduled_date).getTime() - new Date(a.actual_end_time || a.scheduled_date).getTime());
          surgeryCount = patientSurgeries.length;
          if (patientSurgeries.length > 0) {
            const most = patientSurgeries[0];
            const surgDate = new Date(most.actual_end_time || most.scheduled_date);
            const daysPostOp = Math.max(0, Math.ceil((now.getTime() - surgDate.getTime()) / (1000 * 60 * 60 * 24)));
            lastSurgery = { procedure_name: most.procedure_name, date: surgDate.toISOString(), daysPostOp };
          }
        } catch { /* surgeries fetch failed, not critical */ }

        setAdmissionStatus({
          isAdmitted: true,
          ward: latest.ward_location || latest.ward,
          bed: latest.bed_number,
          admissionDate: latest.admission_date,
          daysAdmitted,
          lastSurgery,
          surgeryCount,
        });
      } else {
        setAdmissionStatus({ isAdmitted: false });
      }
    } catch {
      setAdmissionStatus({ isAdmitted: false });
    }
  };

  const loadMedicalTeam = async () => {
    if (!id || !patient) return;
    
    try {
      // Get assigned medical team for this patient from API first
      let team = await medicalTeamService.getPatientMedicalTeamFromAPI(id);
      
      // If no team assigned from API, try local IndexedDB
      if (team.length === 0) {
        console.log('No team from API, trying local IndexedDB...');
        team = await medicalTeamService.getPatientMedicalTeam(Number(id));
      }
      
      // If still no team, try auto-assign
      if (team.length === 0) {
        try {
          console.log('No team assigned, auto-assigning medical team...');
          await medicalTeamService.assignTeamToPatient(Number(id), patient.hospital_number);
          team = await medicalTeamService.getPatientMedicalTeam(Number(id));
        } catch (autoAssignError) {
          console.warn('Auto-assign failed, falling back to patient/admission data:', autoAssignError);
        }
      }

      // Fallback: build team from patient registration fields if still empty
      if (team.length === 0) {
        const fallbackTeam: TeamMember[] = [];
        if (patient.consultant_in_charge) {
          fallbackTeam.push({
            id: 0,
            name: patient.consultant_in_charge,
            email: '',
            role: 'consultant',
            roleLabel: 'Consultant in Charge',
            color: 'bg-blue-600',
            priority: 1
          });
        }
        if (patient.resident_in_charge) {
          fallbackTeam.push({
            id: 0,
            name: patient.resident_in_charge,
            email: '',
            role: 'resident',
            roleLabel: 'Resident in Charge',
            color: 'bg-green-600',
            priority: 2
          });
        }
        // Also check latest admission for admitting doctor/consultant
        if (fallbackTeam.length === 0) {
          try {
            const admissions = await db.admissions?.toArray() || [];
            const patientAdmissions = admissions.filter(a => 
              (String(a.patient_id) === String(id) || 
               String((a as any).hospital_number) === String(patient?.hospital_number)) && 
              a.status === 'active'
            );
            const latestAdm = patientAdmissions.sort((a, b) => 
              new Date(b.admission_date || b.created_at).getTime() - new Date(a.admission_date || a.created_at).getTime()
            )[0];
            if (latestAdm?.admitting_consultant) {
              fallbackTeam.push({
                id: 0, name: latestAdm.admitting_consultant, email: '',
                role: 'consultant', roleLabel: 'Admitting Consultant', color: 'bg-blue-600', priority: 1
              });
            }
            if (latestAdm?.admitting_doctor) {
              fallbackTeam.push({
                id: 0, name: latestAdm.admitting_doctor, email: '',
                role: 'resident', roleLabel: 'Admitting Doctor', color: 'bg-green-600', priority: 2
              });
            }
          } catch { /* ignore */ }
        }
        team = fallbackTeam;
      }
      
      setMedicalTeam(team);
    } catch (error) {
      console.error('Error loading medical team:', error);
    }
  };

  const loadMDTInfo = async () => {
    if (!id) return;
    try {
      const data = await apiClient.get(`/mdt/patient-info/${id}`);
      setMdtInfo(data);
    } catch {
      // MDT info not available yet
      setMdtInfo({ patient_type: 'primary' });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <div className="text-gray-400 text-6xl mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Not Found</h2>
        <p className="text-gray-600">The patient you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  const patientName = `${patient.first_name} ${patient.last_name}`;
  const hospitalNumber = patient.hospital_number || id!;

  const tabs = [
    { id: 'encounters', name: 'Encounters', icon: '📋' },
    { id: 'summary', name: 'Summary', icon: '📄' },
    { id: 'vital-signs', name: 'Vital Signs', icon: '💓' },
    { id: 'investigations', name: 'Investigations', icon: '🔬' },
    { id: 'treatment-plans', name: 'Treatment Planning', icon: '📅' },
    { id: 'mdt-care', name: 'MDT Care', icon: '🤝' },
    { id: 'clinical-photos', name: 'Clinical Photos', icon: '📷' },
    { id: 'wound-assessment', name: 'Wound Assessment', icon: '🩹' },
    { id: 'discharge', name: 'Discharge', icon: '🏠' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'encounters':
        return <EncountersTab patientId={id!} hospitalNumber={hospitalNumber} patientName={patientName} userName={user?.name || 'Unknown'} />;
      case 'summary':
        return <PatientSummaryView patientId={id!} />;
      case 'vital-signs':
        return <VitalSignsTab patientId={id!} hospitalNumber={hospitalNumber} userName={user?.name || 'Unknown'} />;
      case 'investigations':
        return <InvestigationsTab patientId={id!} hospitalNumber={hospitalNumber} patientName={patientName} userName={user?.name || 'Unknown'} />;
      case 'treatment-plans':
        return <TreatmentPlansTab patientId={id!} patientName={patientName} navigate={navigate} />;
      case 'mdt-care':
        return <MDTCareTab patientId={id!} patientName={patientName} hospitalNumber={hospitalNumber} userName={user?.name || 'Unknown'} mdtInfo={mdtInfo} onMdtInfoChange={loadMDTInfo} />;
      case 'clinical-photos':
        return <ClinicalPhotosTab patientId={id!} hospitalNumber={hospitalNumber} patientName={patientName} userName={user?.name || 'Unknown'} />;
      case 'wound-assessment':
        return <WoundAssessmentTab patientId={id!} patientName={patientName} hospitalNumber={hospitalNumber} navigate={navigate} />;
      case 'discharge':
        return (
          <DischargePlanning
            patientId={id!}
            onDischargeComplete={(dischargeId) => {
              alert('Discharge plan completed successfully!');
            }}
          />
        );
      default:
        return <div>Tab content not found</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Patient Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold flex-shrink-0">
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">
                    {patient.first_name} {patient.last_name}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-gray-500">
                    <span>#{patient.hospital_number}</span>
                    <span className="hidden sm:inline"></span>
                    <span>{calculateAge(patient.dob || patient.date_of_birth) ?? 'N/A'}y, {patient.sex || patient.gender}</span>
                    <span className="hidden sm:inline"></span>
                    <span className="hidden sm:inline">{patient.phone}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
                {admissionStatus && (
                  admissionStatus.isAdmitted ? (
                    <div className="flex flex-col gap-1">
                      <span className="px-2 sm:px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        Admitted {admissionStatus.ward ? `• ${admissionStatus.ward}` : ''} {admissionStatus.bed ? `Bed ${admissionStatus.bed}` : ''}
                        <span className="font-bold ml-1">• Day {admissionStatus.daysAdmitted}</span>
                      </span>
                      {admissionStatus.lastSurgery && (
                        <span className="px-2 sm:px-3 py-0.5 bg-purple-100 text-purple-800 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1">
                          <Scissors className="w-3 h-3" />
                          POD {admissionStatus.lastSurgery.daysPostOp} – {admissionStatus.lastSurgery.procedure_name}
                          {(admissionStatus.surgeryCount || 0) > 1 && (
                            <span className="ml-1 text-purple-600">({admissionStatus.surgeryCount} surgeries)</span>
                          )}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium">
                      Outpatient
                    </span>
                  )
                )}
                {/* MDT/Primary Patient Badge */}
                {mdtInfo && mdtInfo.patient_type === 'consult' ? (
                  <span className="px-2 sm:px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1 cursor-pointer" onClick={() => setActiveTab('mdt-care')}>
                    <Activity className="w-3 h-3" /> Consult/MDT
                    {mdtInfo.consulting_unit && <span className="hidden sm:inline"> • {mdtInfo.consulting_unit}</span>}
                  </span>
                ) : (
                  <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium">
                    Primary
                  </span>
                )}
                <span className="px-2 sm:px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs sm:text-sm font-medium">
                  Active
                </span>
                <button 
                  onClick={() => {
                    setEditFormData({ ...patient });
                    setShowEditModal(true);
                  }}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar - Quick Info */}
          <div className="lg:col-span-1 space-y-4 sm:space-y-6">
            {/* Quick Summary Card */}
            <QuickSummaryCard patientId={id!} />
            
            {/* Patient Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Patient Details</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date of Birth:</span>
                  <span className="font-medium">{patient.dob || patient.date_of_birth || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Address:</span>
                  <span className="font-medium text-right">{patient.address}</span>
                </div>
                {patient.allergies && Array.isArray(patient.allergies) && patient.allergies.length > 0 && (
                  <div>
                    <span className="text-gray-500 text-sm">Allergies:</span>
                    <div className="mt-1 space-y-1">
                      {patient.allergies.map((allergy, index) => (
                        <span key={index} className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full mr-1">
                          {allergy}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {patient.comorbidities && patient.comorbidities.length > 0 && (
                  <div>
                    <span className="text-gray-500 text-sm">Comorbidities:</span>
                    <div className="mt-1 space-y-1">
                      {patient.comorbidities.map((condition, index) => (
                        <span key={index} className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mr-1 mb-1">
                          {condition}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Assigned Medical Team */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Medical Team</h3>
              </div>
              <div className="p-4 space-y-3">
                {medicalTeam.length === 0 ? (
                  <p className="text-sm text-gray-500">No assigned medical team</p>
                ) : (
                  medicalTeam.map((member, index) => {
                    const initials = (member.name || 'U')
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);
                    
                    return (
                      <div key={member.id || index} className="flex items-start space-x-3">
                        <div className={`w-10 h-10 ${member.color} rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0`}>
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.roleLabel}</p>
                          {member.phone && (
                            <p className={`text-xs mt-1 ${member.color.replace('bg-', 'text-')}`}>
                              {member.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-4 space-y-2">
                <button 
                  onClick={() => navigate(`/admission-discharge?patientId=${id}&patientName=${encodeURIComponent(patientName)}`)}
                  className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Admit Patient
                </button>
                <button 
                  onClick={() => setActiveTab('vital-signs')}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-2"
                >
                  <Heart className="w-4 h-4" /> Vital Signs
                </button>
                <button 
                  onClick={() => navigate(`/booking-register?patientId=${id}&patientName=${encodeURIComponent(patientName)}`)}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-2"
                >
                  <Scissors className="w-4 h-4" /> Preop Planning & Surgery Booking
                </button>
                <button 
                  onClick={() => setActiveTab('discharge')}
                  className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded transition-colors flex items-center gap-2"
                >
                  <ClipboardCheck className="w-4 h-4" /> Plan Discharge
                </button>
                <button 
                  onClick={() => setShowPrescriptionModal(true)}
                  className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded transition-colors flex items-center gap-2"
                >
                  <Pill className="w-4 h-4" /> Prescribe Medication
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 sm:mb-6">
              <div className="border-b border-gray-200 overflow-x-auto scrollbar-hide">
                <nav className="flex -mx-4 px-4 sm:mx-0 sm:px-6 min-w-max sm:min-w-0">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-3 sm:py-4 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="hidden sm:inline">{tab.name}</span>
                      <span className="sm:hidden">{tab.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </nav>
              </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-96">
              <ErrorBoundary>
                {renderTabContent()}
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PrescriptionModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        patientId={id!}
        patientName={patientName}
        onSuccess={() => {
          loadPatientData();
        }}
      />

      {/* Edit Patient Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Patient Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={editFormData.first_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editFormData.last_name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={editFormData.dob || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
                {(editFormData.dob || editFormData.date_of_birth) && (
                  <p className="text-sm text-gray-500 mt-1">Age: {calculateAge(editFormData.dob || editFormData.date_of_birth) ?? 'N/A'} years</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sex</label>
                  <select
                    value={editFormData.sex || 'Male'}
                    onChange={(e) => setEditFormData({ ...editFormData, sex: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={editFormData.address || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await patientService.updatePatient(id!, editFormData);
                    setShowEditModal(false);
                    loadPatientData();
                  } catch (error) {
                    console.error('Error updating patient:', error);
                    alert('Failed to update patient');
                  }
                }}
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ENCOUNTERS TAB ──────────────────────────────────────────────────────────
const EncountersTab: React.FC<{ patientId: string; hospitalNumber: string; patientName: string; userName: string }> = ({ patientId, hospitalNumber, patientName, userName }) => {
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [encounterType, setEncounterType] = useState('progress_note');
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showOCRScanner, setShowOCRScanner] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    loadEncounters();
    // Re-fetch when user returns to tab or comes back online
    const onVisible = () => { if (document.visibilityState === 'visible' && mountedRef.current) loadEncounters(true); };
    const onOnline = () => { if (mountedRef.current) loadEncounters(true); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => { mountedRef.current = false; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', onOnline); };
  }, [patientId]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        speechToTextService.stopListening();
      }
    };
  }, [isRecording]);

  const toggleSpeechToText = () => {
    if (isRecording) {
      speechToTextService.stopListening();
      setIsRecording(false);
    } else {
      if (!speechToTextService.isSupported()) {
        alert('Speech recognition is not supported in this browser. Use Chrome or Edge.');
        return;
      }
      const started = speechToTextService.startListening({
        language: 'en-US',
        continuous: true,
        interimResults: true,
        onResult: (result) => {
          if (result.isFinal) {
            setNewNote(prev => {
              const separator = prev.trim() ? ' ' : '';
              return prev.trim() + separator + result.transcript;
            });
          }
        },
        onError: (error) => {
          console.error('Speech recognition error:', error);
          setIsRecording(false);
        },
        onEnd: () => setIsRecording(false),
      });
      if (started) setIsRecording(true);
    }
  };

  const handleOCRExtracted = (fields: Record<string, any>) => {
    const extractedText = fields.rawText || fields.content || fields.text || 
      Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
    setNewNote(prev => prev ? prev + '\n\n--- OCR Extracted ---\n' + extractedText : extractedText);
    setShowOCRScanner(false);
  };

  const loadEncounters = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const pid = Number(patientId) || patientId;
      const data = await apiClient.get(`/progress-notes?patientId=${patientId}`);
      const notes = data?.notes || data?.progressNotes || [];
      // Also fetch admissions for encounter context
      const admData = await apiClient.get(`/admissions?patientId=${patientId}`);
      const admissions = (admData?.admissions || []).map((a: any) => ({
        ...a,
        _type: 'admission',
        created_at: a.admission_date || a.created_at,
      }));
      // Also upsert progress notes into IndexedDB for offline use
      for (const n of notes) {
        try { if (db.progress_notes) await db.progress_notes.put({ ...n, patient_id: typeof n.patient_id === 'string' ? parseInt(n.patient_id, 10) : n.patient_id, synced: true }); } catch { /* ok */ }
      }
      // Merge and sort chronologically
      const all = [
        ...notes.map((n: any) => ({ ...n, _type: n.type || 'progress_note' })),
        ...admissions,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (mountedRef.current) setEncounters(all);
    } catch {
      // Fallback to IndexedDB when offline / API error
      try {
        const pid = Number(patientId) || patientId;
        const localNotes = await db.progress_notes?.where('patient_id').equals(pid).toArray() || [];
        const localAdm = (await db.admissions?.toArray() || []).filter((a: any) =>
          String(a.patient_id) === String(patientId) || String(a.hospital_number) === String(patientId)
        );
        const all = [
          ...localNotes.map((n: any) => ({ ...n, _type: n.type || 'progress_note', created_at: n.created_at || n.date })),
          ...localAdm.map((a: any) => ({ ...a, _type: 'admission', created_at: a.admission_date || a.created_at })),
        ].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (mountedRef.current) setEncounters(all);
      } catch { if (mountedRef.current) setEncounters([]); }
    } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  };

  const saveEncounter = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      // Get geolocation for anti-fraud documentation verification
      let geoLocation: { latitude: number; longitude: number; accuracy: number; address?: string } | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
        });
        geoLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        // Reverse geocode for human-readable address
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'UNTH-PlasticSurg-Assistant/1.0' } });
          if (geoRes.ok) {
            const geoData = await geoRes.json();
            geoLocation.address = geoData.display_name || '';
          }
        } catch { /* geocode failed, coordinates still valid */ }
      } catch { /* geolocation unavailable */ }

      await apiClient.post('/progress-notes', {
        patient_id: patientId,
        patient_name: patientName,
        author: userName,
        type: encounterType,
        soap: { note: newNote, type: encounterType },
        geolocation: geoLocation,
      });
      setNewNote('');
      setShowNewEncounter(false);
      await loadEncounters();
    } catch (err) {
      alert('Failed to save encounter');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Patient Encounters</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => loadEncounters(true)} disabled={refreshing} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50" title="Refresh encounters">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => setShowNewEncounter(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> New Encounter
            </button>
          </div>
        </div>

        {showNewEncounter && (
          <div className="p-4 border-b border-gray-200 bg-green-50">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Encounter Type</label>
              <select value={encounterType} onChange={e => setEncounterType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option value="progress_note">Progress Note</option>
                <option value="ward_round">Ward Round Note</option>
                <option value="consultation">Consultation</option>
                <option value="procedure_note">Procedure Note</option>
                <option value="clinic_visit">Clinic Visit</option>
                <option value="emergency">Emergency Review</option>
              </select>
            </div>
            {/* Speech & OCR Toolbar */}
            <div className="flex items-center gap-2 mb-2 p-2 bg-white rounded-lg border border-gray-200">
              <button
                onClick={toggleSpeechToText}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  isRecording
                    ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse'
                    : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`}
                title={isRecording ? 'Stop dictation' : 'Start voice dictation'}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isRecording ? 'Stop Dictation' : 'Dictate'}
              </button>
              <button
                onClick={() => setShowOCRScanner(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all"
                title="Scan document with OCR"
              >
                <ScanLine className="w-4 h-4" /> Scan Document
              </button>
              {isRecording && (
                <span className="flex items-center gap-1 text-xs text-red-600 ml-auto">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Listening — speak clearly...
                </span>
              )}
            </div>

            <textarea
              ref={textareaRef}
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={6}
              placeholder={isRecording ? 'Speak now — your dictation will appear here...' : 'Document the encounter, or use Dictate / Scan Document above...'}
              className={`w-full px-3 py-2 border rounded-md text-sm mb-3 transition-colors ${
                isRecording ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-green-500'
              }`}
            />
            <div className="flex gap-2">
              <button onClick={saveEncounter} disabled={saving || !newNote.trim()} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
              <button onClick={() => { setShowNewEncounter(false); if (isRecording) { speechToTextService.stopListening(); setIsRecording(false); } }} className="px-4 py-2 text-gray-600 text-sm rounded-md hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        )}

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-green-600" /><p className="text-sm text-gray-500 mt-2">Loading encounters...</p></div>
          ) : encounters.length === 0 ? (
            <div className="text-center py-8"><FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No encounters documented yet</p></div>
          ) : (
            <div className="space-y-3">
              {encounters.map((enc, i) => (
                <div key={enc.id || i} className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        enc._type === 'admission' ? 'bg-red-100 text-red-700' :
                        enc._type === 'ward_round' ? 'bg-blue-100 text-blue-700' :
                        enc._type === 'consultation' ? 'bg-purple-100 text-purple-700' :
                        enc._type === 'procedure_note' ? 'bg-orange-100 text-orange-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {enc._type === 'admission' ? 'Admission' :
                         enc._type === 'ward_round' ? 'Ward Round' :
                         enc._type === 'consultation' ? 'Consultation' :
                         enc._type === 'procedure_note' ? 'Procedure' :
                         enc._type === 'clinic_visit' ? 'Clinic Visit' :
                         enc._type === 'emergency' ? 'Emergency' :
                         'Progress Note'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {enc.created_at ? new Date(enc.created_at).toLocaleString() : ''}
                    </div>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{(() => { const s = enc.soap; const txt = (typeof s === 'string' ? s : s?.note || s?.subjective || s?.assessment || ''); return txt || enc.content || enc.presenting_complaint || enc.reasons_for_admission || enc.notes || 'No content'; })()}</p>
                  <div className="mt-2 text-xs text-gray-400 flex flex-wrap items-center gap-1">
                    <span>By: {enc.author || enc.created_by || enc.admitting_doctor || 'Unknown'}</span>
                    {enc.geolocation && (() => { const g = typeof enc.geolocation === 'string' ? JSON.parse(enc.geolocation) : enc.geolocation; return g?.latitude ? (
                      <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] flex items-center gap-0.5" title={g.address || `${g.latitude.toFixed(5)}, ${g.longitude.toFixed(5)}`}>
                        📍 {g.address ? g.address.split(',').slice(0, 2).join(',') : `${g.latitude.toFixed(4)}, ${g.longitude.toFixed(4)}`}
                        {g.accuracy && <span className="text-blue-400">(±{Math.round(g.accuracy)}m)</span>}
                      </span>
                    ) : null; })()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* OCR Document Scanner Modal */}
      {showOCRScanner && (
        <DocumentScannerModal
          isOpen={showOCRScanner}
          onClose={() => setShowOCRScanner(false)}
          onFieldsExtracted={handleOCRExtracted}
          documentType="clinical_note"
          patientContext={{ name: patientName, hospitalNumber }}
          targetForm="progress_note"
        />
      )}
    </div>
  );
};

// ─── VITAL SIGNS TAB ─────────────────────────────────────────────────────────
interface VitalReading {
  id?: string;
  date: string;
  temperature?: number;
  pulse?: number;
  bp_systolic?: number;
  bp_diastolic?: number;
  respiratory_rate?: number;
  spo2?: number;
  weight?: number;
  recorded_by?: string;
}

const VitalSignsTab: React.FC<{ patientId: string; hospitalNumber: string; userName: string }> = ({ patientId, hospitalNumber, userName }) => {
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<VitalReading>>({});
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showVitalsOCR, setShowVitalsOCR] = useState(false);
  const [ocrVitalsEntries, setOcrVitalsEntries] = useState<VitalReading[]>([]);
  const [showOCRReview, setShowOCRReview] = useState(false);
  const [savingOCR, setSavingOCR] = useState(false);

  useEffect(() => { loadVitals(); }, [patientId]);
  useEffect(() => { if (vitals.length > 1) drawChart(); }, [vitals]);

  const loadVitals = async () => {
    setLoading(true);
    try {
      // Try API first, fall back to localStorage
      let data: VitalReading[] = [];
      try {
        const res = await apiClient.get(`/vital-signs?patientId=${patientId}`);
        data = res?.vitals || res?.vitalSigns || [];
      } catch {
        // fallback localStorage
        const stored = localStorage.getItem(`vitals_${patientId}`);
        data = stored ? JSON.parse(stored) : [];
      }
      setVitals(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
    } catch {
      setVitals([]);
    } finally {
      setLoading(false);
    }
  };

  const saveVital = async () => {
    if (!form.temperature && !form.pulse && !form.bp_systolic) return;
    setSaving(true);
    const reading: VitalReading = {
      id: `vs_${Date.now()}`,
      date: new Date().toISOString(),
      ...form,
      recorded_by: userName,
    };
    try {
      try {
        await apiClient.post('/vital-signs', { ...reading, patient_id: patientId, hospital_number: hospitalNumber });
      } catch {
        // Save locally as fallback
        const stored = localStorage.getItem(`vitals_${patientId}`);
        const arr = stored ? JSON.parse(stored) : [];
        arr.push(reading);
        localStorage.setItem(`vitals_${patientId}`, JSON.stringify(arr));
      }
      setForm({});
      setShowForm(false);
      await loadVitals();
    } finally {
      setSaving(false);
    }
  };

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas || vitals.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width = canvas.offsetWidth * 2;
    const H = canvas.height = 300;
    ctx.clearRect(0, 0, W, H);
    ctx.scale(1, 1);

    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    const datasets = [
      { key: 'pulse', label: 'Pulse', color: '#DC2626', min: 40, max: 160 },
      { key: 'bp_systolic', label: 'Systolic', color: '#2563EB', min: 60, max: 220 },
      { key: 'bp_diastolic', label: 'Diastolic', color: '#7C3AED', min: 30, max: 140 },
      { key: 'temperature', label: 'Temp', color: '#EA580C', min: 34, max: 42 },
      { key: 'spo2', label: 'SpO2', color: '#059669', min: 80, max: 100 },
    ];

    // Draw axes
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, H - padding.bottom);
    ctx.lineTo(W - padding.right, H - padding.bottom);
    ctx.stroke();

    // Date labels
    ctx.fillStyle = '#6B7280';
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    const maxLabels = Math.min(vitals.length, 8);
    const step = Math.max(1, Math.floor(vitals.length / maxLabels));
    for (let i = 0; i < vitals.length; i += step) {
      const x = padding.left + (i / (vitals.length - 1)) * chartW;
      const d = new Date(vitals[i].date);
      ctx.fillText(`${d.getDate()}/${d.getMonth() + 1}`, x, H - padding.bottom + 25);
    }

    // Draw each dataset
    datasets.forEach(ds => {
      const points = vitals.map((v, i) => ({
        x: padding.left + (i / (vitals.length - 1)) * chartW,
        y: padding.top + chartH - ((((v as any)[ds.key] || 0) - ds.min) / (ds.max - ds.min)) * chartH,
        val: (v as any)[ds.key],
      })).filter(p => p.val);

      if (points.length < 2) return;

      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Dots
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = ds.color;
        ctx.fill();
      });
    });

    // Legend
    ctx.font = '16px sans-serif';
    let legendX = padding.left;
    datasets.forEach(ds => {
      ctx.fillStyle = ds.color;
      ctx.fillRect(legendX, 8, 14, 14);
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'left';
      ctx.fillText(ds.label, legendX + 18, 20);
      legendX += ctx.measureText(ds.label).width + 40;
    });
  };

  const handleVitalsOCRExtracted = (fields: Record<string, any>) => {
    const entries: VitalReading[] = [];
    // Handle single set of vitals from OCR
    if (fields.vital_signs || fields.vitals) {
      const v = fields.vital_signs || fields.vitals;
      const reading: VitalReading = {
        id: `vs_ocr_${Date.now()}`,
        date: new Date().toISOString(),
        temperature: v.temperature || v.temp || undefined,
        pulse: v.pulse || v.heart_rate || undefined,
        bp_systolic: v.bp_systolic || (v.bloodPressure ? parseInt(v.bloodPressure.split('/')[0]) : undefined),
        bp_diastolic: v.bp_diastolic || (v.bloodPressure ? parseInt(v.bloodPressure.split('/')[1]) : undefined),
        respiratory_rate: v.respiratory_rate || v.respiratoryRate || v.resp_rate || undefined,
        spo2: v.spo2 || v.oxygenSaturation || v.oxygen_saturation || undefined,
        weight: v.weight || undefined,
        recorded_by: `${userName} (OCR)`,
      };
      if (reading.temperature || reading.pulse || reading.bp_systolic || reading.spo2) {
        entries.push(reading);
      }
    }
    // Handle array of vitals (series from chart)
    if (fields.vital_signs_series && Array.isArray(fields.vital_signs_series)) {
      fields.vital_signs_series.forEach((v: any, i: number) => {
        entries.push({
          id: `vs_ocr_${Date.now()}_${i}`,
          date: v.date || v.datetime || new Date(Date.now() - (fields.vital_signs_series.length - 1 - i) * 3600000).toISOString(),
          temperature: v.temperature || v.temp || undefined,
          pulse: v.pulse || v.heart_rate || undefined,
          bp_systolic: v.bp_systolic || undefined,
          bp_diastolic: v.bp_diastolic || undefined,
          respiratory_rate: v.respiratory_rate || v.resp_rate || undefined,
          spo2: v.spo2 || v.oxygen_saturation || undefined,
          weight: v.weight || undefined,
          recorded_by: `${userName} (OCR)`,
        });
      });
    }
    // Fallback: parse from raw fields if flat
    if (entries.length === 0 && (fields.temperature || fields.pulse || fields.bp_systolic)) {
      entries.push({
        id: `vs_ocr_${Date.now()}`,
        date: new Date().toISOString(),
        temperature: fields.temperature,
        pulse: fields.pulse,
        bp_systolic: fields.bp_systolic,
        bp_diastolic: fields.bp_diastolic,
        respiratory_rate: fields.respiratory_rate,
        spo2: fields.spo2,
        weight: fields.weight,
        recorded_by: `${userName} (OCR)`,
      });
    }
    if (entries.length > 0) {
      setOcrVitalsEntries(entries);
      setShowOCRReview(true);
    } else {
      alert('Could not extract vital signs from the scanned document. Please enter vitals manually.');
    }
    setShowVitalsOCR(false);
  };

  const saveOCRVitals = async () => {
    setSavingOCR(true);
    try {
      for (const reading of ocrVitalsEntries) {
        try {
          await apiClient.post('/vital-signs', { ...reading, patient_id: patientId, hospital_number: hospitalNumber });
        } catch {
          const stored = localStorage.getItem(`vitals_${patientId}`);
          const arr = stored ? JSON.parse(stored) : [];
          arr.push(reading);
          localStorage.setItem(`vitals_${patientId}`, JSON.stringify(arr));
        }
      }
      setOcrVitalsEntries([]);
      setShowOCRReview(false);
      await loadVitals();
    } finally {
      setSavingOCR(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Vital Signs Records</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowVitalsOCR(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
              <ScanLine className="w-4 h-4" /> Scan Vitals
            </button>
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" /> Record Vitals
          </button>
          </div>
        </div>

        {showForm && (
          <div className="p-4 border-b border-gray-200 bg-green-50">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Temp (°C)</label>
                <input type="number" step="0.1" value={form.temperature || ''} onChange={e => setForm({ ...form, temperature: parseFloat(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="36.5" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Pulse (bpm)</label>
                <input type="number" value={form.pulse || ''} onChange={e => setForm({ ...form, pulse: parseInt(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="72" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">BP Systolic</label>
                <input type="number" value={form.bp_systolic || ''} onChange={e => setForm({ ...form, bp_systolic: parseInt(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="120" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">BP Diastolic</label>
                <input type="number" value={form.bp_diastolic || ''} onChange={e => setForm({ ...form, bp_diastolic: parseInt(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="80" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Resp Rate</label>
                <input type="number" value={form.respiratory_rate || ''} onChange={e => setForm({ ...form, respiratory_rate: parseInt(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="18" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">SpO2 (%)</label>
                <input type="number" value={form.spo2 || ''} onChange={e => setForm({ ...form, spo2: parseInt(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="98" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input type="number" step="0.1" value={form.weight || ''} onChange={e => setForm({ ...form, weight: parseFloat(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="70" /></div>
            </div>
            <div className="flex gap-2">
              <button onClick={saveVital} disabled={saving} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-md">Cancel</button>
            </div>
          </div>
        )}

        {/* Trend Chart */}
        {vitals.length > 1 && (
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Trends</h4>
            <canvas ref={canvasRef} className="w-full" style={{ height: '150px' }} />
          </div>
        )}

        {/* Records Table */}
        <div className="p-4 overflow-x-auto">
          {loading ? (
            <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
          ) : vitals.length === 0 ? (
            <p className="text-center text-gray-500 py-6">No vital signs recorded yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 text-gray-500 text-xs">
                <th className="py-2 text-left">Date/Time</th><th>Temp</th><th>Pulse</th><th>BP</th><th>RR</th><th>SpO2</th><th>Wt</th><th>By</th>
              </tr></thead>
              <tbody>
                {[...vitals].reverse().map((v, i) => (
                  <tr key={v.id || i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 text-xs text-gray-600">{new Date(v.date).toLocaleString()}</td>
                    <td className="text-center">{v.temperature || '-'}</td>
                    <td className="text-center">{v.pulse || '-'}</td>
                    <td className="text-center">{v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : '-'}</td>
                    <td className="text-center">{v.respiratory_rate || '-'}</td>
                    <td className="text-center">{v.spo2 ? `${v.spo2}%` : '-'}</td>
                    <td className="text-center">{v.weight || '-'}</td>
                    <td className="text-xs text-gray-400">{v.recorded_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Vitals OCR Scanner Modal */}
      {showVitalsOCR && (
        <DocumentScannerModal
          isOpen={showVitalsOCR}
          onClose={() => setShowVitalsOCR(false)}
          onFieldsExtracted={handleVitalsOCRExtracted}
          documentType="general"
          patientContext={{ name: '', hospitalNumber }}
          targetForm="ward_round"
        />
      )}

      {/* OCR Vitals Review Modal */}
      {showOCRReview && ocrVitalsEntries.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowOCRReview(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Review Scanned Vital Signs ({ocrVitalsEntries.length} reading{ocrVitalsEntries.length !== 1 ? 's' : ''})</h3>
              <button onClick={() => setShowOCRReview(false)} className="p-1 hover:bg-gray-100 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              {ocrVitalsEntries.map((entry, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Reading #{idx + 1}</span>
                    <span className="text-xs text-gray-500">{new Date(entry.date).toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {entry.temperature && <div className="text-center p-1 bg-white rounded border"><div className="text-[10px] text-gray-500">Temp</div><div className="text-sm font-bold text-orange-600">{entry.temperature}°C</div></div>}
                    {entry.pulse && <div className="text-center p-1 bg-white rounded border"><div className="text-[10px] text-gray-500">Pulse</div><div className="text-sm font-bold text-red-600">{entry.pulse}</div></div>}
                    {entry.bp_systolic && <div className="text-center p-1 bg-white rounded border"><div className="text-[10px] text-gray-500">BP</div><div className="text-sm font-bold text-blue-600">{entry.bp_systolic}/{entry.bp_diastolic}</div></div>}
                    {entry.respiratory_rate && <div className="text-center p-1 bg-white rounded border"><div className="text-[10px] text-gray-500">RR</div><div className="text-sm font-bold text-purple-600">{entry.respiratory_rate}</div></div>}
                    {entry.spo2 && <div className="text-center p-1 bg-white rounded border"><div className="text-[10px] text-gray-500">SpO2</div><div className="text-sm font-bold text-green-600">{entry.spo2}%</div></div>}
                    {entry.weight && <div className="text-center p-1 bg-white rounded border"><div className="text-[10px] text-gray-500">Wt</div><div className="text-sm font-bold text-gray-700">{entry.weight}kg</div></div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-2 justify-end">
              <button onClick={() => setShowOCRReview(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-md">Cancel</button>
              <button onClick={saveOCRVitals} disabled={savingOCR} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
                {savingOCR ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save All Vitals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── INVESTIGATIONS TAB ──────────────────────────────────────────────────────
const InvestigationsTab: React.FC<{ patientId: string; hospitalNumber: string; patientName: string; userName: string }> = ({ patientId, hospitalNumber, patientName, userName }) => {
  const [requested, setRequested] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'requested' | 'results' | 'trends'>('requested');
  const [showScanForm, setShowScanForm] = useState(false);
  const [showScanResult, setShowScanResult] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState<'form' | 'result' | null>(null);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [uploadingResult, setUploadingResult] = useState(false);
  const formFileRef = useRef<HTMLInputElement>(null);
  const resultFileRef = useRef<HTMLInputElement>(null);
  const [scannedFormData, setScannedFormData] = useState<any>(null);
  const [scannedResultData, setScannedResultData] = useState<any>(null);
  const [viewingUpload, setViewingUpload] = useState<any>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);

  useEffect(() => { loadInvestigations(); }, [patientId]);

  const loadInvestigations = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/lab-orders?patientId=${patientId}`);
      const allOrders = data?.labOrders || [];

      // Also load investigation uploads from server
      let uploads: any[] = [];
      try {
        const uploadData = await apiClient.get<{ uploads: any[] }>(`/investigation-uploads?patientId=${patientId}`);
        uploads = (uploadData.uploads || []).map((u: any) => ({ ...u, _type: 'upload' }));
      } catch { /* fallback below */ }

      const allRequested = [
        ...uploads.filter((u: any) => u.upload_type === 'form' || u.status === 'pending'),
        ...allOrders.filter((o: any) => o.status === 'pending' || o.status === 'ordered' || o.status === 'in_progress'),
      ];
      const allResults = [
        ...uploads.filter((u: any) => u.upload_type === 'result' || u.status === 'completed').map((u: any) => ({ ...u, results: u.results || 'See scanned document' })),
        ...allOrders.filter((o: any) => o.status === 'completed' || o.status === 'resulted' || o.results),
      ];
      setRequested(allRequested);
      setResults(allResults);
    } catch {
      // Fallback localStorage
      const stored = localStorage.getItem(`investigations_${patientId}`);
      const arr = stored ? JSON.parse(stored) : [];
      setRequested(arr.filter((o: any) => !o.results));
      setResults(arr.filter((o: any) => o.results));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, uploadType: 'form' | 'result') => {
    const setter = uploadType === 'form' ? setUploadingForm : setUploadingResult;
    setter(true);
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const record: any = {
        patient_id: patientId,
        hospital_number: hospitalNumber,
        upload_type: uploadType,
        file_name: file.name,
        file_data: dataUrl,
        uploaded_by: userName,
        test_name: uploadType === 'form' ? 'Scanned Investigation Form' : 'Scanned Result',
        status: uploadType === 'form' ? 'pending' : 'completed',
      };

      // Save to IndexedDB
      try {
        const localId = await db.investigation_uploads.add({ ...record, created_at: new Date().toISOString() });
        record.id = localId;
      } catch { /* IndexedDB unavailable */ }

      // Try server save (without file_data in listing response)
      try {
        const resp = await apiClient.post<{ upload: any }>('/investigation-uploads', record);
        if (resp.upload) record.id = resp.upload.id;
      } catch { /* offline — saved locally */ }

      // Also keep localStorage as backup
      const stored = localStorage.getItem(`investigation_uploads_${patientId}`);
      const existing = stored ? JSON.parse(stored) : [];
      existing.unshift({ ...record, uploaded_at: new Date().toISOString() });
      localStorage.setItem(`investigation_uploads_${patientId}`, JSON.stringify(existing));

      if (uploadType === 'form') {
        setRequested(prev => [{ ...record, _type: 'upload' }, ...prev]);
      } else {
        setResults(prev => [{ ...record, results: 'See scanned document', _type: 'upload' }, ...prev]);
      }
    } catch (err) {
      alert('Failed to process uploaded file');
    } finally {
      setter(false);
    }
  };

  const handleOCRExtractedInv = (fields: Record<string, any>, scanType: 'form' | 'result') => {
    const testName = fields.test_name || fields.testName || fields.investigation || 'Scanned Investigation';
    
    // Extract structured lab results from OCR data
    let labResults: any[] | undefined;
    if (scanType === 'result') {
      // AI-extracted lab_report results come as fields.results (array of {test_name, result_value, unit, reference_range, abnormal, flag})
      if (Array.isArray(fields.results)) {
        labResults = fields.results;
      } else if (Array.isArray(fields.investigations)) {
        // From rule-based extraction: {name, result, unit, abnormal}
        labResults = fields.investigations.map((inv: any) => ({
          test_name: inv.name || inv.test_name || 'Unknown',
          result_value: inv.result || inv.result_value || inv.value || '',
          unit: inv.unit || '',
          reference_range: inv.reference_range || '',
          abnormal: inv.abnormal || false,
          flag: inv.flag || (inv.abnormal ? 'abnormal' : 'normal'),
        }));
      } else if (typeof fields === 'object') {
        // Try to extract key-value pairs that look like lab results
        labResults = Object.entries(fields)
          .filter(([key]) => !['confidence', 'patient_name', 'hospital_number', 'collection_date', 'specimen_type', 'lab_comments', 'document_type', 'content_summary', 'key_findings', 'recommendations', 'test_name', 'testName', 'investigation'].includes(key))
          .filter(([, val]) => val != null && val !== '' && typeof val !== 'object')
          .map(([key, val]) => ({
            test_name: key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
            result_value: String(val),
            unit: '',
            reference_range: '',
            abnormal: false,
            flag: 'normal',
          }));
        if (labResults.length === 0) labResults = undefined;
      }
    }

    const record: any = {
      patient_id: patientId,
      hospital_number: hospitalNumber,
      upload_type: scanType,
      test_name: testName,
      status: scanType === 'form' ? 'pending' : 'completed',
      results: labResults || (scanType === 'result' ? fields : undefined),
      ocr_extracted: true,
      ocr_text: JSON.stringify(fields),
      uploaded_by: userName,
      created_at: new Date().toISOString(),
    };

    // Save to IndexedDB
    try {
      db.investigation_uploads.add({ ...record }).then(id => { record.id = id; });
    } catch { /* IndexedDB unavailable */ }

    // Try server save
    apiClient.post('/investigation-uploads', record).catch(() => { /* offline */ });

    // Keep localStorage backup
    const stored = localStorage.getItem(`investigations_${patientId}`);
    const existing = stored ? JSON.parse(stored) : [];
    existing.unshift(record);
    localStorage.setItem(`investigations_${patientId}`, JSON.stringify(existing));

    if (scanType === 'form') {
      setRequested(prev => [record, ...prev]);
    } else {
      setResults(prev => [record, ...prev]);
    }
    setShowOCRModal(null);
  };

  const viewUploadDetail = async (inv: any) => {
    // If file_data is already present (freshly uploaded or from localStorage), show directly
    if (inv.file_data) {
      setViewingUpload(inv);
      return;
    }
    // If it has an ID and is an upload type, fetch the full record including file_data
    if (inv.id && inv._type === 'upload') {
      setLoadingUpload(true);
      try {
        const data = await apiClient.get(`/investigation-uploads/${inv.id}`);
        if (data?.upload) {
          setViewingUpload({ ...inv, ...data.upload });
        } else {
          // Also check localStorage fallback
          const stored = localStorage.getItem(`investigation_uploads_${patientId}`);
          const arr = stored ? JSON.parse(stored) : [];
          const local = arr.find((u: any) => u.id === inv.id || u.file_name === inv.file_name);
          if (local?.file_data) {
            setViewingUpload({ ...inv, ...local });
          } else {
            alert('Unable to load document. The image data may not be available.');
          }
        }
      } catch {
        // Try localStorage fallback
        const stored = localStorage.getItem(`investigation_uploads_${patientId}`);
        const arr = stored ? JSON.parse(stored) : [];
        const local = arr.find((u: any) => u.id === inv.id || u.file_name === inv.file_name);
        if (local?.file_data) {
          setViewingUpload({ ...inv, ...local });
        } else {
          alert('Unable to load document. You may be offline.');
        }
      } finally {
        setLoadingUpload(false);
      }
      return;
    }
    // For OCR-extracted items, show the OCR text
    if (inv.ocr_text || inv.ocr_extracted) {
      setViewingUpload(inv);
      return;
    }
    // For lab orders (non-upload), show results in detail
    if (inv.results) {
      setViewingUpload(inv);
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input type="file" ref={formFileRef} className="hidden" accept="image/*,.pdf" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'form'); e.target.value = ''; }} />
      <input type="file" ref={resultFileRef} className="hidden" accept="image/*,.pdf" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'result'); e.target.value = ''; }} />

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Investigation Results</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowOCRModal('result')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Camera className="w-3.5 h-3.5" /> Scan Results
            </button>
            <button onClick={() => setShowOCRModal('form')} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700">
              <ScanLine className="w-3.5 h-3.5" /> OCR Scan
            </button>
          </div>
        </div>

        {/* Upload Buttons */}
        <div className="p-3 border-b border-gray-100 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => formFileRef.current?.click()}
              disabled={uploadingForm}
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {uploadingForm ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <div className="text-left">
                <div className="text-sm font-medium">Upload Investigation Form</div>
                <div className="text-xs text-blue-500">Scan or photograph physical request form</div>
              </div>
            </button>
            <button
              onClick={() => resultFileRef.current?.click()}
              disabled={uploadingResult}
              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-green-300 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
            >
              {uploadingResult ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              <div className="text-left">
                <div className="text-sm font-medium">Upload Investigation Result</div>
                <div className="text-xs text-green-500">Scan or photograph result when available</div>
              </div>
            </button>
          </div>
        </div>

        {/* Section Toggle */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveSection('requested')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeSection === 'requested' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
            Requested Investigations ({requested.length})
          </button>
          <button onClick={() => setActiveSection('results')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeSection === 'results' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
            Available Results ({results.length})
          </button>
          <button onClick={() => setActiveSection('trends')} className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeSection === 'trends' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
            📈 Trends
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
          ) : activeSection === 'requested' ? (
            requested.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No pending investigations</p>
            ) : (
              <div className="space-y-3">
                {requested.map((inv, i) => (
                  <div key={inv.id || i} className="border border-yellow-200 bg-yellow-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {inv.clinical_notes || inv.clinical_indication || inv.test_name || 'Lab Investigation'}
                        </p>
                        {inv.test_name && inv.test_name !== (inv.clinical_notes || inv.clinical_indication) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {inv.test_name.split(',').map((t: string, idx: number) => (
                              <span key={idx} className="inline-flex px-1.5 py-0.5 bg-yellow-100 text-yellow-900 text-[10px] sm:text-xs rounded font-medium border border-yellow-300">
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                          <p className="text-xs text-gray-500">
                            Ordered: {inv.ordered_at ? new Date(inv.ordered_at).toLocaleString() : inv.created_at ? new Date(inv.created_at).toLocaleString() : 'N/A'}
                          </p>
                          {(inv.priority || inv.urgency) && (inv.priority || inv.urgency) !== 'routine' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                              (inv.priority || inv.urgency) === 'stat' ? 'bg-red-200 text-red-800' : 'bg-orange-200 text-orange-800'
                            }`}>{inv.priority || inv.urgency}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {(inv._type === 'upload' || inv.file_data || inv.ocr_text) && (
                          <button onClick={() => viewUploadDetail(inv)} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200">
                            <Eye className="w-3 h-3" /> View
                          </button>
                        )}
                        <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full font-medium">{inv.status || 'pending'}</span>
                      </div>
                    </div>
                    {(inv.ordered_by_name || inv.ordered_by_username || inv.ordered_by) && (
                      <p className="text-xs text-gray-400 mt-1">By: {inv.ordered_by_name || inv.ordered_by_username || `User #${inv.ordered_by}`}</p>
                    )}
                    {inv.test_type && <p className="text-[10px] text-gray-400 mt-0.5">Category: {inv.test_type}</p>}
                  </div>
                ))}
              </div>
            )
          ) : activeSection === 'results' ? (
            results.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No available results</p>
            ) : (
              <div className="space-y-3">
                {results.map((inv, i) => (
                  <div key={inv.id || i} className="border border-green-200 bg-green-50 rounded-lg p-3 cursor-pointer hover:border-green-300 transition-colors" onClick={() => viewUploadDetail(inv)}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">
                          {inv.clinical_notes || inv.clinical_indication || inv.test_name || 'Lab Test'}
                        </p>
                        {inv.test_name && inv.test_name !== (inv.clinical_notes || inv.clinical_indication) && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {inv.test_name.split(',').map((t: string, idx: number) => (
                              <span key={idx} className="inline-flex px-1.5 py-0.5 bg-green-100 text-green-900 text-[10px] sm:text-xs rounded font-medium border border-green-300">
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                        {(inv._type === 'upload' || inv.file_data || inv.ocr_text) && (
                          <button onClick={(e) => { e.stopPropagation(); viewUploadDetail(inv); }} className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full hover:bg-blue-200">
                            <Eye className="w-3 h-3" /> View
                          </button>
                        )}
                        <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full font-medium">Completed</span>
                      </div>
                    </div>
                    {Array.isArray(inv.results) && inv.results.length > 0 ? (
                      <div className="space-y-1">
                        {inv.results.slice(0, 5).map((r: any, idx: number) => {
                          const isAbn = r.abnormal || (r.flag && r.flag !== 'normal');
                          return (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{r.test_name || r.name || `Test ${idx+1}`}</span>
                              <span className={`font-bold ${isAbn ? 'text-red-600' : 'text-green-700'}`}>
                                {r.result_value || r.result || r.value || '-'}
                                {r.unit && <span className="text-gray-400 font-normal ml-0.5">{r.unit}</span>}
                                {isAbn && <span className="ml-1">{r.flag === 'high' || r.flag === 'critical_high' ? '↑' : r.flag === 'low' || r.flag === 'critical_low' ? '↓' : '⚠'}</span>}
                              </span>
                            </div>
                          );
                        })}
                        {inv.results.length > 5 && <p className="text-[10px] text-gray-400">+{inv.results.length - 5} more results</p>}
                        {inv.results.some((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')) && (
                          <div className="mt-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-medium">
                            ⚠️ {inv.results.filter((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')).length} abnormal value{inv.results.filter((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')).length !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    ) : inv.results && typeof inv.results === 'object' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(inv.results).filter(([key]) => !['confidence', 'document_type'].includes(key)).slice(0, 6).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-500">{key.replace(/_/g, ' ')}:</span> <span className="font-medium text-gray-900">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    ) : inv.results ? (
                      <p className="text-sm text-gray-800">{String(inv.results)}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-3 mt-2">
                      <p className="text-xs text-gray-400">Resulted: {inv.completed_at ? new Date(inv.completed_at).toLocaleString() : inv.result_date ? new Date(inv.result_date).toLocaleString() : inv.updated_at ? new Date(inv.updated_at).toLocaleString() : ''}</p>
                      {(inv.ordered_by_name || inv.ordered_by_username) && (
                        <p className="text-xs text-gray-400">By: {inv.ordered_by_name || inv.ordered_by_username}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeSection === 'trends' ? (
            /* Investigation Trends with SVG Charts */
            (() => {
              const trendData: Record<string, { date: string; value: number; unit?: string; refRange?: string; abnormal?: boolean; flag?: string }[]> = {};
              const refRanges: Record<string, string> = {};
              const units: Record<string, string> = {};

              results.forEach((inv: any) => {
                const dateStr = inv.completed_at || inv.result_date || inv.updated_at || inv.created_at;
                if (!dateStr) return;

                // Extract from array results (lab_report format: [{test_name, result_value, unit, ...}])
                const labResults = Array.isArray(inv.results) ? inv.results : null;
                if (labResults) {
                  labResults.forEach((r: any) => {
                    const name = r.test_name || r.name;
                    const val = parseFloat(String(r.result_value || r.result || r.value));
                    if (name && !isNaN(val)) {
                      if (!trendData[name]) trendData[name] = [];
                      trendData[name].push({ date: dateStr, value: val, unit: r.unit, refRange: r.reference_range, abnormal: r.abnormal, flag: r.flag });
                      if (r.unit) units[name] = r.unit;
                      if (r.reference_range) refRanges[name] = r.reference_range;
                    }
                  });
                }

                // Extract from object results (key-value pairs)
                if (inv.results && typeof inv.results === 'object' && !Array.isArray(inv.results)) {
                  Object.entries(inv.results).forEach(([key, val]) => {
                    const num = parseFloat(String(val));
                    if (!isNaN(num) && !['id', 'patient_id', 'confidence'].includes(key)) {
                      if (!trendData[key]) trendData[key] = [];
                      trendData[key].push({ date: dateStr, value: num });
                    }
                  });
                }

                // Also try to extract from ocr_text JSON
                if (inv.ocr_text && typeof inv.ocr_text === 'string') {
                  try {
                    const parsed = JSON.parse(inv.ocr_text);
                    const ocrResults = parsed.results || parsed.investigations;
                    if (Array.isArray(ocrResults)) {
                      ocrResults.forEach((r: any) => {
                        const name = r.test_name || r.name;
                        const val = parseFloat(String(r.result_value || r.result || r.value));
                        if (name && !isNaN(val) && !trendData[name]?.some(d => d.date === dateStr && d.value === val)) {
                          if (!trendData[name]) trendData[name] = [];
                          trendData[name].push({ date: dateStr, value: val, unit: r.unit, refRange: r.reference_range, abnormal: r.abnormal, flag: r.flag });
                          if (r.unit) units[name] = r.unit;
                          if (r.reference_range) refRanges[name] = r.reference_range;
                        }
                      });
                    }
                  } catch { /* not valid JSON */ }
                }

                // Single test_name + result_value
                if (inv.test_name && inv.result_value) {
                  const num = parseFloat(String(inv.result_value));
                  if (!isNaN(num)) {
                    if (!trendData[inv.test_name]) trendData[inv.test_name] = [];
                    trendData[inv.test_name].push({ date: dateStr, value: num });
                  }
                }
              });

              const paramNames = Object.keys(trendData).filter(k => trendData[k].length >= 1);
              if (paramNames.length === 0) return <p className="text-center text-gray-500 py-8">No numeric results for trend analysis. Scan or upload results to see trends.</p>;
              const COLORS = ['#0E9F6E','#DC2626','#2563EB','#7C3AED','#D97706','#059669','#BE185D','#6366F1','#0891B2','#EA580C'];

              // Helper to parse reference range string like "3.5-5.0" or "70-100"
              const parseRefRange = (ref: string): { low: number; high: number } | null => {
                if (!ref) return null;
                const m = ref.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                if (m) return { low: parseFloat(m[1]), high: parseFloat(m[2]) };
                return null;
              };

              return (
                <div className="space-y-6">
                  {paramNames.map((name, pi) => {
                    const pts = trendData[name].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const vals = pts.map(p => p.value);
                    const ref = parseRefRange(refRanges[name] || '');
                    const allVals = ref ? [...vals, ref.low, ref.high] : vals;
                    const mn = Math.min(...allVals)*0.9, mx = Math.max(...allVals)*1.1||1, rng = mx-mn||1;
                    const color = COLORS[pi%COLORS.length];
                    const W=600, H=200, P=50, cW=W-P*2, cH=H-P*2;
                    const sp = pts.map((d,i) => ({
                      x: P+(pts.length===1?cW/2:(i/(pts.length-1))*cW),
                      y: P+cH-((d.value-mn)/rng)*cH,
                      value: d.value, date: d.date,
                      abnormal: d.abnormal || (ref && (d.value < ref.low || d.value > ref.high)),
                    }));
                    const lp = sp.map((p,i) => `${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
                    
                    // Reference range band
                    let refBand = null;
                    if (ref) {
                      const refLowY = P+cH-((ref.low-mn)/rng)*cH;
                      const refHighY = P+cH-((ref.high-mn)/rng)*cH;
                      refBand = (
                        <g>
                          <rect x={P} y={refHighY} width={cW} height={refLowY-refHighY} fill="#0E9F6E" opacity="0.08" />
                          <line x1={P} y1={refHighY} x2={W-P} y2={refHighY} stroke="#0E9F6E" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                          <line x1={P} y1={refLowY} x2={W-P} y2={refLowY} stroke="#0E9F6E" strokeWidth="1" strokeDasharray="4,3" opacity="0.5" />
                          <text x={W-P+3} y={refHighY+4} fill="#0E9F6E" fontSize="8" opacity="0.7">{ref.high}</text>
                          <text x={W-P+3} y={refLowY+4} fill="#0E9F6E" fontSize="8" opacity="0.7">{ref.low}</text>
                        </g>
                      );
                    }

                    return (
                      <div key={name} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold" style={{color}}>
                            {name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                            {units[name] && <span className="text-xs text-gray-400 font-normal ml-1">({units[name]})</span>}
                          </h4>
                          {refRanges[name] && <span className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-200">Ref: {refRanges[name]}</span>}
                        </div>
                        <div className="overflow-x-auto">
                          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-2xl mx-auto" style={{minWidth:350}}>
                            {[0,0.25,0.5,0.75,1].map(f => {
                              const y=P+cH-f*cH, v=(mn+f*rng).toFixed(1);
                              return <g key={f}><line x1={P} y1={y} x2={W-P} y2={y} stroke="#E5E7EB" strokeWidth="1"/><text x={P-5} y={y+4} textAnchor="end" fill="#9CA3AF" fontSize="10">{v}</text></g>;
                            })}
                            {refBand}
                            <path d={lp} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            {sp.map((p,i) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r={p.abnormal ? 6 : 4} fill={p.abnormal ? '#DC2626' : color} stroke="white" strokeWidth="2"/>
                                <text x={p.x} y={p.y-12} textAnchor="middle" fill={p.abnormal ? '#DC2626' : color} fontSize="10" fontWeight="bold">{p.value}</text>
                                {p.abnormal && <text x={p.x} y={p.y+16} textAnchor="middle" fill="#DC2626" fontSize="8">⚠</text>}
                              </g>
                            ))}
                            {sp.map((p,i) => { const d=new Date(p.date); const lb=isNaN(d.getTime())?'':`${d.getDate()}/${d.getMonth()+1}`; return <text key={`xl${i}`} x={p.x} y={H-5} textAnchor="middle" fill="#9CA3AF" fontSize="9">{lb}</text>; })}
                          </svg>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>{pts.length} data point{pts.length!==1?'s':''}</span>
                          <span>Range: {Math.min(...vals).toFixed(1)} – {Math.max(...vals).toFixed(1)}</span>
                          {pts.length>=2 && <span className={vals[vals.length-1]>vals[0]?'text-red-500':vals[vals.length-1]<vals[0]?'text-green-500':'text-gray-500'}>{vals[vals.length-1]>vals[0]?'↑ Rising':vals[vals.length-1]<vals[0]?'↓ Falling':'→ Stable'}</span>}
                          {ref && <span className="text-green-600">■ Normal range</span>}
                          {sp.some(p => p.abnormal) && <span className="text-red-500">● Abnormal values: {sp.filter(p => p.abnormal).length}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : null}
        </div>
      </div>

      {/* OCR Scanner Modal for Investigations */}
      {showOCRModal && (
        <DocumentScannerModal
          isOpen={!!showOCRModal}
          onClose={() => setShowOCRModal(null)}
          onFieldsExtracted={(fields) => handleOCRExtractedInv(fields, showOCRModal)}
          documentType={showOCRModal === 'result' ? 'lab_report' : 'clinical_note'}
          patientContext={{ name: patientName, hospitalNumber }}
          targetForm="lab_entry"
        />
      )}

      {/* Investigation Upload Viewer / Lightbox */}
      {viewingUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4" onClick={() => setViewingUpload(null)}>
          <div className="relative max-w-4xl w-full max-h-[90vh] overflow-auto bg-white rounded-lg" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <div>
                <h3 className="font-semibold text-gray-900">{viewingUpload.test_name || viewingUpload.clinical_notes || 'Investigation Document'}</h3>
                <p className="text-xs text-gray-500">
                  {viewingUpload.upload_type === 'form' ? 'Investigation Form' : viewingUpload.upload_type === 'result' ? 'Investigation Result' : 'Investigation'}
                  {' • '}{viewingUpload.created_at ? new Date(viewingUpload.created_at).toLocaleString() : viewingUpload.ordered_at ? new Date(viewingUpload.ordered_at).toLocaleString() : ''}
                  {viewingUpload.uploaded_by && ` • By: ${viewingUpload.uploaded_by}`}
                </p>
              </div>
              <button onClick={() => setViewingUpload(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Scanned Image */}
              {viewingUpload.file_data && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Scanned Document</h4>
                  <img
                    src={viewingUpload.file_data}
                    alt={viewingUpload.test_name || 'Scanned investigation'}
                    className="w-full rounded-lg border border-gray-200"
                    style={{ maxHeight: '60vh', objectFit: 'contain' }}
                  />
                </div>
              )}
              {/* OCR Extracted Results - Readable Clinical Format */}
              {viewingUpload.ocr_text && (() => {
                let parsed: any = null;
                try { parsed = typeof viewingUpload.ocr_text === 'string' ? JSON.parse(viewingUpload.ocr_text) : viewingUpload.ocr_text; } catch { /* not JSON */ }
                
                // If we have structured OCR data, render it as readable clinical format
                if (parsed && typeof parsed === 'object') {
                  const sections: React.ReactNode[] = [];
                  
                  // Lab Results (from AI-extracted lab_report)
                  const labResults = parsed.results || parsed.investigations;
                  if (Array.isArray(labResults) && labResults.length > 0) {
                    sections.push(
                      <div key="lab-results">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">🔬 Laboratory Results</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="text-left px-3 py-2 text-gray-600 font-medium border-b">Test</th>
                                <th className="text-right px-3 py-2 text-gray-600 font-medium border-b">Result</th>
                                <th className="text-center px-3 py-2 text-gray-600 font-medium border-b">Unit</th>
                                <th className="text-center px-3 py-2 text-gray-600 font-medium border-b">Reference</th>
                                <th className="text-center px-3 py-2 text-gray-600 font-medium border-b">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {labResults.map((r: any, idx: number) => {
                                const isAbnormal = r.abnormal === true || (r.flag && r.flag !== 'normal');
                                const isCritical = r.flag?.includes('critical');
                                const isHigh = r.flag === 'high' || r.flag === 'critical_high';
                                const isLow = r.flag === 'low' || r.flag === 'critical_low';
                                const rowBg = isCritical ? 'bg-red-50' : isAbnormal ? 'bg-orange-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                                return (
                                  <tr key={idx} className={rowBg}>
                                    <td className="px-3 py-2 border-b border-gray-100 font-medium text-gray-900">
                                      {r.test_name || r.name || `Test ${idx+1}`}
                                    </td>
                                    <td className={`px-3 py-2 border-b border-gray-100 text-right font-bold ${isCritical ? 'text-red-700' : isAbnormal ? 'text-orange-700' : 'text-green-700'}`}>
                                      {r.result_value || r.result || r.value || '-'}
                                    </td>
                                    <td className="px-3 py-2 border-b border-gray-100 text-center text-gray-500">
                                      {r.unit || ''}
                                    </td>
                                    <td className="px-3 py-2 border-b border-gray-100 text-center text-gray-400 text-xs">
                                      {r.reference_range || ''}
                                    </td>
                                    <td className="px-3 py-2 border-b border-gray-100 text-center">
                                      {isCritical ? (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-200 text-red-800 text-[10px] rounded-full font-bold">⚠️ CRITICAL {isHigh ? '↑' : isLow ? '↓' : ''}</span>
                                      ) : isAbnormal ? (
                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${isHigh ? 'bg-orange-100 text-orange-700' : isLow ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                          {isHigh ? '↑ HIGH' : isLow ? '↓ LOW' : '⚠ ABN'}
                                        </span>
                                      ) : (
                                        <span className="text-green-600 text-xs">✓</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {labResults.some((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')) && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                            ⚠️ <strong>Abnormal values detected</strong> — {labResults.filter((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')).length} of {labResults.length} values flagged
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  // Vitals
                  if (parsed.vitals && typeof parsed.vitals === 'object' && Object.values(parsed.vitals).some((v: any) => v != null)) {
                    const v = parsed.vitals;
                    const vitalDisplays = [
                      v.temperature && { label: 'Temp', value: `${v.temperature}°C`, abnormal: v.temperature > 37.5 || v.temperature < 36 },
                      v.pulse && { label: 'Pulse', value: `${v.pulse} bpm`, abnormal: v.pulse > 100 || v.pulse < 60 },
                      (v.bp_systolic && v.bp_diastolic) && { label: 'BP', value: `${v.bp_systolic}/${v.bp_diastolic} mmHg`, abnormal: v.bp_systolic > 140 || v.bp_systolic < 90 },
                      v.respiratory_rate && { label: 'RR', value: `${v.respiratory_rate} /min`, abnormal: v.respiratory_rate > 20 || v.respiratory_rate < 12 },
                      v.spo2 && { label: 'SpO₂', value: `${v.spo2}%`, abnormal: v.spo2 < 95 },
                      v.pain_score != null && { label: 'Pain', value: `${v.pain_score}/10`, abnormal: v.pain_score > 5 },
                    ].filter(Boolean);
                    if (vitalDisplays.length > 0) {
                      sections.push(
                        <div key="vitals">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 Vital Signs</h4>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {vitalDisplays.map((vd: any) => (
                              <div key={vd.label} className={`text-center p-2 rounded-lg border ${vd.abnormal ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                                <p className="text-[10px] text-gray-500 uppercase">{vd.label}</p>
                                <p className={`text-sm font-bold ${vd.abnormal ? 'text-red-700' : 'text-green-700'}`}>{vd.value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // SOAP Notes
                  const soapFields = ['subjective', 'objective', 'assessment', 'plan'];
                  const hasSoap = soapFields.some(f => parsed[f]);
                  if (hasSoap) {
                    sections.push(
                      <div key="soap">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">📋 Clinical Notes</h4>
                        <div className="space-y-2">
                          {soapFields.map(f => parsed[f] && (
                            <div key={f} className="bg-gray-50 p-2 rounded border border-gray-200">
                              <span className="text-[10px] uppercase font-bold text-gray-500">{f.charAt(0).toUpperCase()}</span>
                              <p className="text-sm text-gray-800">{parsed[f]}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  // Medications
                  if (Array.isArray(parsed.medications) && parsed.medications.length > 0) {
                    sections.push(
                      <div key="meds">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">💊 Medications</h4>
                        <div className="space-y-1">
                          {parsed.medications.map((m: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded border border-gray-200 text-sm">
                              <span className="font-medium text-gray-900">{m.name || m.medication || String(m)}</span>
                              {m.dose && <span className="text-gray-500">{m.dose}</span>}
                              {m.route && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{m.route}</span>}
                              {m.frequency && <span className="text-gray-500">{m.frequency}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  // Diagnoses
                  if (Array.isArray(parsed.diagnoses) && parsed.diagnoses.length > 0) {
                    sections.push(
                      <div key="dx">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">🩺 Diagnoses</h4>
                        <div className="flex flex-wrap gap-1">
                          {parsed.diagnoses.map((d: any, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-200">{typeof d === 'string' ? d : d.name || String(d)}</span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  
                  // Specimen / Collection info
                  if (parsed.specimen_type || parsed.collection_date || parsed.lab_comments) {
                    sections.push(
                      <div key="specimen" className="flex flex-wrap gap-3 text-xs text-gray-500">
                        {parsed.specimen_type && <span>Specimen: <strong>{parsed.specimen_type}</strong></span>}
                        {parsed.collection_date && <span>Collected: <strong>{parsed.collection_date}</strong></span>}
                        {parsed.lab_comments && <span>Comments: <strong>{parsed.lab_comments}</strong></span>}
                      </div>
                    );
                  }

                  if (sections.length > 0) {
                    return <div className="space-y-4">{sections}</div>;
                  }
                }
                
                // Fallback: show as formatted text (non-JSON or unrecognized format)
                return (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Extracted Text</h4>
                    <pre className="text-sm text-gray-800 bg-gray-50 p-3 rounded-lg border border-gray-200 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">
                      {typeof viewingUpload.ocr_text === 'string' && !parsed ? viewingUpload.ocr_text : JSON.stringify(parsed, null, 2)}
                    </pre>
                  </div>
                );
              })()}
              {/* Results Data */}
              {viewingUpload.results && typeof viewingUpload.results === 'object' && viewingUpload.results !== 'See scanned document' && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">🔬 Results</h4>
                  {Array.isArray(viewingUpload.results) ? (
                    <div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left px-3 py-2 text-gray-600 font-medium border-b">Test</th>
                              <th className="text-right px-3 py-2 text-gray-600 font-medium border-b">Result</th>
                              <th className="text-center px-3 py-2 text-gray-600 font-medium border-b">Unit</th>
                              <th className="text-center px-3 py-2 text-gray-600 font-medium border-b">Reference</th>
                              <th className="text-center px-3 py-2 text-gray-600 font-medium border-b">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {viewingUpload.results.map((r: any, idx: number) => {
                              const isAbnormal = r.abnormal === true || (r.flag && r.flag !== 'normal');
                              const isCritical = r.flag?.includes('critical');
                              const isHigh = r.flag === 'high' || r.flag === 'critical_high';
                              const isLow = r.flag === 'low' || r.flag === 'critical_low';
                              const rowBg = isCritical ? 'bg-red-50' : isAbnormal ? 'bg-orange-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                              return (
                                <tr key={idx} className={rowBg}>
                                  <td className="px-3 py-2 border-b border-gray-100 font-medium text-gray-900">{r.test_name || r.name || `Test ${idx+1}`}</td>
                                  <td className={`px-3 py-2 border-b border-gray-100 text-right font-bold ${isCritical ? 'text-red-700' : isAbnormal ? 'text-orange-700' : 'text-green-700'}`}>
                                    {r.result_value || r.result || r.value || '-'}
                                  </td>
                                  <td className="px-3 py-2 border-b border-gray-100 text-center text-gray-500">{r.unit || ''}</td>
                                  <td className="px-3 py-2 border-b border-gray-100 text-center text-gray-400 text-xs">{r.reference_range || ''}</td>
                                  <td className="px-3 py-2 border-b border-gray-100 text-center">
                                    {isCritical ? (
                                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-red-200 text-red-800 text-[10px] rounded-full font-bold">⚠️ CRITICAL {isHigh ? '↑' : isLow ? '↓' : ''}</span>
                                    ) : isAbnormal ? (
                                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${isHigh ? 'bg-orange-100 text-orange-700' : isLow ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                        {isHigh ? '↑ HIGH' : isLow ? '↓ LOW' : '⚠ ABN'}
                                      </span>
                                    ) : (
                                      <span className="text-green-600 text-xs">✓</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {viewingUpload.results.some((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')) && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                          ⚠️ <strong>Abnormal values detected</strong> — {viewingUpload.results.filter((r: any) => r.abnormal || (r.flag && r.flag !== 'normal')).length} of {viewingUpload.results.length} values flagged
                        </div>
                      )}
                    </div>
                  ) : typeof viewingUpload.results === 'object' ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(viewingUpload.results)
                        .filter(([key]) => !['confidence', 'document_type'].includes(key))
                        .map(([key, val]) => (
                        <div key={key} className="bg-gray-50 p-2 rounded border border-gray-200">
                          <span className="text-xs text-gray-500">{key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</span>
                          <p className="text-sm font-medium text-gray-900">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800">{String(viewingUpload.results)}</p>
                  )}
                </div>
              )}
              {/* No image/data available message */}
              {!viewingUpload.file_data && !viewingUpload.ocr_text && (!viewingUpload.results || viewingUpload.results === 'See scanned document') && (
                <div className="text-center py-8">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">No scanned document available for this investigation.</p>
                  <p className="text-xs text-gray-400 mt-1">The document may not have been uploaded with an image.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay for upload fetch */}
      {loadingUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            <p className="text-sm text-gray-600">Loading document...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TREATMENT PLANS TAB ─────────────────────────────────────────────────────
const TreatmentPlansTab: React.FC<{ patientId: string; patientName: string; navigate: any }> = ({ patientId, patientName, navigate }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);
  const [showPlanOCR, setShowPlanOCR] = useState(false);
  const [savingOCRPlan, setSavingOCRPlan] = useState(false);

  useEffect(() => { loadPlans(); }, [patientId]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/treatment-plans?patientId=${patientId}`);
      const allPlans = data?.plans || data?.treatmentPlans || [];
      setPlans(allPlans.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  const parseJSON = (val: any) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
    return [];
  };

  const handlePlanOCRExtracted = async (fields: Record<string, any>) => {
    setSavingOCRPlan(true);
    try {
      const planData: any = {
        patientId,
        diagnosis: fields.assessment || fields.diagnoses?.[0] || fields.content_summary || fields.key_findings?.[0] || 'OCR Scanned Plan',
        treatmentType: fields.document_type || 'medical',
        description: fields.plan || fields.content_summary || fields.objective || '',
        objectives: fields.recommendations || fields.key_findings || [],
        procedures: fields.procedures_planned?.map((p: string) => ({ name: p })) || [],
        medications: fields.medications || [],
        investigations: fields.investigations || [],
        notes: [
          fields.subjective ? `Subjective: ${fields.subjective}` : '',
          fields.objective ? `Objective: ${fields.objective}` : '',
          fields.assessment ? `Assessment: ${fields.assessment}` : '',
          fields.notes || '',
          '(Created from OCR scan)',
        ].filter(Boolean).join('\n'),
        status: 'draft',
      };

      try {
        await apiClient.post('/treatment-plans', planData);
      } catch {
        // Save locally as fallback
        const stored = localStorage.getItem(`treatment_plans_${patientId}`);
        const arr = stored ? JSON.parse(stored) : [];
        arr.unshift({ ...planData, id: `tp_ocr_${Date.now()}`, created_at: new Date().toISOString(), created_by: 'OCR Scan' });
        localStorage.setItem(`treatment_plans_${patientId}`, JSON.stringify(arr));
      }
      await loadPlans();
    } catch {
      alert('Failed to save OCR treatment plan.');
    } finally {
      setSavingOCRPlan(false);
      setShowPlanOCR(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Treatment Planning</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowPlanOCR(true)} disabled={savingOCRPlan} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
              {savingOCRPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />} Scan Plan
            </button>
            <button onClick={() => navigate(`/treatment-plan-creator?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}`)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> New Plan
            </button>
          </div>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8"><Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No treatment plans yet</p></div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan, i) => {
                const isExpanded = expandedPlan === plan.id;
                const procedures = parseJSON(plan.procedures);
                const medications = parseJSON(plan.medications);
                const investigations = parseJSON(plan.investigations);
                const objectives = parseJSON(plan.objectives);
                const followUp = parseJSON(plan.follow_up_schedule);
                const medicalTeam = plan.medical_team ? (typeof plan.medical_team === 'string' ? (() => { try { return JSON.parse(plan.medical_team); } catch { return null; } })() : plan.medical_team) : null;
                const isPastDue = plan.target_date && new Date(plan.target_date) < new Date() && plan.status !== 'completed';

                return (
                  <div key={plan.id || i} className={`border rounded-lg overflow-hidden ${isPastDue ? 'border-red-300' : 'border-gray-200'}`}>
                    <div className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isPastDue ? 'bg-red-50' : ''}`}
                      onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}>
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-gray-900">{plan.diagnosis || plan.title || 'Untitled Plan'}</h4>
                        <div className="flex items-center gap-2">
                          {isPastDue && <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full animate-pulse">Overdue</span>}
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                            plan.status === 'completed' ? 'bg-green-100 text-green-700' :
                            plan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{plan.status || 'Active'}</span>
                          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>Created: {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'N/A'}</span>
                        {plan.treatment_type && <span>Type: {plan.treatment_type}</span>}
                        <span>By: {plan.created_by || 'Unknown'}</span>
                      </div>
                    </div>
                    {/* Expanded Plan Details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50 space-y-3">
                        {plan.description && (
                          <div className="mt-3">
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Description</h5>
                            <p className="text-sm text-gray-800">{plan.description}</p>
                          </div>
                        )}
                        {medicalTeam && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Medical Team</h5>
                            <div className="flex flex-wrap gap-2">
                              {medicalTeam.seniorRegistrar && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">SR: {medicalTeam.seniorRegistrar}</span>}
                              {medicalTeam.registrar && medicalTeam.registrar !== 'None available' && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Reg: {medicalTeam.registrar}</span>}
                              {medicalTeam.houseOfficer && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">HO: {medicalTeam.houseOfficer}</span>}
                            </div>
                          </div>
                        )}
                        {objectives.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Objectives</h5>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {objectives.map((obj: any, j: number) => <li key={j} className="flex items-start gap-1"><span className="text-green-500 mt-0.5">•</span> {typeof obj === 'string' ? obj : obj.description || obj.objective || JSON.stringify(obj)}</li>)}
                            </ul>
                          </div>
                        )}
                        {procedures.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Procedures ({procedures.length})</h5>
                            <div className="space-y-1">
                              {procedures.map((proc: any, j: number) => (
                                <div key={j} className="text-sm bg-white p-2 rounded border border-gray-200">
                                  <span className="font-medium text-gray-900">{proc.name || proc.procedure_name || proc.description || JSON.stringify(proc)}</span>
                                  {proc.notes && <p className="text-xs text-gray-500 mt-0.5">{proc.notes}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {medications.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Medications ({medications.length})</h5>
                            <div className="space-y-1">
                              {medications.map((med: any, j: number) => (
                                <div key={j} className="text-sm bg-white p-2 rounded border border-gray-200">
                                  <span className="font-medium text-gray-900">{med.name || med.medication_name || med.drug || JSON.stringify(med)}</span>
                                  {(med.dose || med.dosage) && <span className="text-xs text-gray-500 ml-2">{med.dose || med.dosage} {med.route && `(${med.route})`} {med.frequency && `- ${med.frequency}`}</span>}
                                  {med.duration && <span className="text-xs text-gray-400 ml-2">for {med.duration}</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {investigations.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Investigations ({investigations.length})</h5>
                            <div className="flex flex-wrap gap-1">
                              {investigations.map((inv: any, j: number) => (
                                <span key={j} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{inv.investigation_name || inv.name || inv.test || JSON.stringify(inv)}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {followUp.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Follow-up Schedule</h5>
                            <ul className="text-sm text-gray-700 space-y-1">
                              {followUp.map((f: any, j: number) => <li key={j}>• {typeof f === 'string' ? f : f.description || f.schedule || JSON.stringify(f)}</li>)}
                            </ul>
                          </div>
                        )}
                        {plan.notes && (
                          <div>
                            <h5 className="text-xs font-semibold text-gray-600 uppercase mb-1">Notes</h5>
                            <p className="text-sm text-gray-700">{plan.notes}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/treatment-plan-manager?planId=${plan.id}`); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700">
                            <FileText className="w-3.5 h-3.5" /> View Plan
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Treatment Plan OCR Scanner Modal */}
      {showPlanOCR && (
        <DocumentScannerModal
          isOpen={showPlanOCR}
          onClose={() => setShowPlanOCR(false)}
          onFieldsExtracted={handlePlanOCRExtracted}
          documentType="general"
          patientContext={{ name: patientName }}
          targetForm="ward_round"
        />
      )}
    </div>
  );
};

// ─── CLINICAL PHOTOGRAPHS TAB ────────────────────────────────────────────────
const ClinicalPhotosTab: React.FC<{ patientId: string; hospitalNumber: string; patientName: string; userName: string }> = ({ patientId, hospitalNumber, patientName, userName }) => {
  const [photos, setPhotos] = useState<Array<{ id: string; dataUrl: string; caption: string; date: string; taken_by: string }>>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadPhotos(); }, [patientId]);

  const loadPhotos = () => {
    const stored = localStorage.getItem(`clinical_photos_${patientId}`);
    setPhotos(stored ? JSON.parse(stored) : []);
  };

  const savePhotos = (newPhotos: typeof photos) => {
    localStorage.setItem(`clinical_photos_${patientId}`, JSON.stringify(newPhotos));
    setPhotos(newPhotos);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let w = img.width, h = img.height;
          if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } }
          else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const newPhotos = [...photos];
    for (const file of Array.from(files)) {
      const dataUrl = await compressImage(file);
      const caption = prompt('Enter a caption/description for this photo:') || '';
      newPhotos.push({
        id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        dataUrl,
        caption,
        date: new Date().toISOString(),
        taken_by: userName,
      });
    }
    savePhotos(newPhotos);
  };

  const deletePhoto = (photoId: string) => {
    if (!confirm('Delete this photo?')) return;
    savePhotos(photos.filter(p => p.id !== photoId));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Clinical Photographs</h3>
          <div className="flex gap-2">
            <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              <Camera className="w-4 h-4" /> Take Photo
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Upload className="w-4 h-4" /> Upload
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>

        <div className="p-4">
          {photos.length === 0 ? (
            <div className="text-center py-8"><Image className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No clinical photographs yet</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(photo => (
                <div key={photo.id} className="relative group border border-gray-200 rounded-lg overflow-hidden">
                  <img src={photo.dataUrl} alt={photo.caption} className="w-full h-32 object-cover cursor-pointer" onClick={() => setSelectedPhoto(photo.id)} />
                  <div className="p-2">
                    <p className="text-xs text-gray-800 font-medium truncate">{photo.caption || 'No caption'}</p>
                    <p className="text-xs text-gray-400">{new Date(photo.date).toLocaleDateString()}</p>
                    <p className="text-xs text-gray-400">By: {photo.taken_by}</p>
                  </div>
                  <button onClick={() => deletePhoto(photo.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedPhoto(null)} className="absolute -top-10 right-0 text-white"><X className="w-6 h-6" /></button>
            {(() => {
              const photo = photos.find(p => p.id === selectedPhoto);
              return photo ? (
                <div>
                  <img src={photo.dataUrl} alt={photo.caption} className="w-full rounded-lg" />
                  <div className="mt-2 text-white text-sm">
                    <p className="font-medium">{photo.caption}</p>
                    <p className="text-gray-300">{new Date(photo.date).toLocaleString()} • By: {photo.taken_by}</p>
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── WOUND ASSESSMENT TAB ────────────────────────────────────────────────────
const WOUND_TYPES = ['Surgical', 'Traumatic', 'Burn', 'Pressure ulcer', 'Diabetic ulcer', 'Venous ulcer', 'Arterial ulcer', 'Skin Graft Donor Site', 'Skin Graft Recipient Site', 'Dehisced Wound', 'Other'];
const EXUDATE_AMOUNTS = ['None', 'Light', 'Moderate', 'Heavy'] as const;
const TISSUE_TYPES = ['Epithelializing', 'Granulation', 'Slough', 'Necrotic', 'Eschar', 'Hypergranulation'];
const WOUND_NATURES = ['Acute', 'Chronic'] as const;
const ACUTE_PHASES = ['Inflammatory', 'Proliferative', 'Remodeling'] as const;
const CHRONIC_PHASES = ['Extension', 'Transition', 'Repair'] as const;
const CHRONIC_PHASE_INFO: Record<string, { description: string; granulation: string; frequency: string; color: string }> = {
  Extension: { description: 'Necrotic and edematous with no evidence of granulation or healthy tissue', granulation: '0%', frequency: 'Daily', color: 'bg-red-100 text-red-800' },
  Transition: { description: 'Granulation up to 40% of wound surface, edema reduced, discharges minimal', granulation: '1-40%', frequency: 'Alternate Day', color: 'bg-yellow-100 text-yellow-800' },
  Repair: { description: 'Active granulation and epithelialization, minimal to no exudate', granulation: '>40%', frequency: 'Alternate Day', color: 'bg-green-100 text-green-800' },
};

interface WoundRecord {
  id: string;
  wound_nature: 'Acute' | 'Chronic';
  wound_type: string;
  location: string;
  length: number;
  width: number;
  depth: number;
  granulation_percentage: number;
  tissue_types: string[];
  exudate_amount: string;
  pain_level: number;
  healing_phase: string;
  notes: string;
  recommendations: string[];
  protocol: string[];
  assessed_by: string;
  assessed_at: string;
}

const WoundAssessmentTab: React.FC<{ patientId: string; patientName: string; hospitalNumber: string; navigate: any }> = ({ patientId, patientName, hospitalNumber, navigate }) => {
  const [assessments, setAssessments] = useState<WoundRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<WoundRecord>>({ wound_nature: 'Acute', tissue_types: [], pain_level: 0, granulation_percentage: 0 });
  const { user } = useAuthStore();

  const healingPhases = form.wound_nature === 'Chronic' ? CHRONIC_PHASES : ACUTE_PHASES;

  useEffect(() => { loadAssessments(); }, [patientId]);

  const loadAssessments = () => {
    const stored = localStorage.getItem(`wound_assessments_${patientId}`);
    setAssessments(stored ? JSON.parse(stored) : []);
  };

  const generateRecommendations = (data: Partial<WoundRecord>): string[] => {
    const recs: string[] = [];
    const nature = data.wound_nature || 'Acute';
    const phase = data.healing_phase || '';

    if (nature === 'Chronic') {
      // Chronic wound recommendations based on Extension/Transition/Repair phases
      const phaseInfo = CHRONIC_PHASE_INFO[phase];
      if (phaseInfo) {
        recs.push(`Phase: ${phase} — ${phaseInfo.description}`);
        recs.push(`Expected granulation: ${phaseInfo.granulation}`);
        recs.push(`Dressing frequency: ${phaseInfo.frequency}`);
      }
      if (phase === 'Extension') {
        recs.push('Focus on debridement and infection control');
        recs.push('Monitor for infection signs — consider wound culture if not improving');
        recs.push('Optimize nutrition (protein, vitamin C, zinc)');
        recs.push('Address underlying aetiology (offload pressure, compression for venous, vascular assessment for arterial)');
      } else if (phase === 'Transition') {
        recs.push('Continue wound bed preparation');
        recs.push('Protect emerging granulation tissue');
        recs.push('Maintain moist wound environment');
        recs.push('Reassess for surgical closure options (graft/flap) if granulation > 40%');
      } else if (phase === 'Repair') {
        recs.push('Protect granulation and epithelialization');
        recs.push('Minimize wound disturbance during dressing changes');
        recs.push('Consider surgical closure (skin graft/flap) when wound bed is ready');
        recs.push('Monitor for hypergranulation');
      }
    } else {
      // Acute wound recommendations based on Inflammatory/Proliferative/Remodeling phases
      if (phase === 'Inflammatory') {
        recs.push('Monitor for infection signs (increased redness, warmth, swelling, discharge)');
        recs.push('Keep wound clean and covered');
        recs.push('Adequate pain management');
      } else if (phase === 'Proliferative') {
        recs.push('Maintain moist wound environment');
        recs.push('Protect granulation tissue — use non-adherent dressing');
        recs.push('Ensure adequate nutrition for tissue repair');
      } else if (phase === 'Remodeling') {
        recs.push('Protect scar from sun exposure');
        recs.push('Consider silicone gel/sheet for scar management');
        recs.push('Minimize tension on wound — advise on activity restriction');
      }
    }
    // General recommendations
    if (data.exudate_amount === 'Heavy') recs.push('Use highly absorbent dressing (alginate or foam)');
    if (data.tissue_types?.includes('Necrotic') || data.tissue_types?.includes('Eschar')) recs.push('Consider debridement of necrotic/eschar tissue');
    if (data.tissue_types?.includes('Slough')) recs.push('Autolytic debridement with hydrogel recommended');
    if ((data.pain_level || 0) >= 7) recs.push('Adequate pain management before dressing changes');
    if (data.depth && data.depth > 2) recs.push('Consider wound VAC for deep wounds');
    recs.push('Document wound measurements and photograph at each dressing change');
    return recs;
  };

  const generateProtocol = (data: Partial<WoundRecord>): string[] => {
    const nature = data.wound_nature || 'Acute';
    const steps: string[] = [];

    // Special graft protocols
    if (data.wound_type === 'Skin Graft Recipient Site') {
      return [
        '1. Irrigate using Wound Clex Spray solution',
        '2. Apply Sofratulle gauze embedded with Hera Gel',
        '3. Overlay with 3 layers of sterile dry gauze',
        '4. Secure with crepe bandage or plaster as appropriate for the site',
        '⚠ Handle graft site with extreme care — do not apply excessive pressure',
        '⚠ Monitor for graft failure signs (discoloration, separation)'
      ];
    }
    if (data.wound_type === 'Skin Graft Donor Site') {
      return [
        '1. After surgeon removes last Sofratulle layer of intraoperative dressing:',
        '2. Irrigate gently with Wound Clex Solution',
        '3. Apply Hera Gel embedded in Sofratulle gauze',
        '4. Overlay with 4 layers of sterile dry gauze',
        '5. Secure with crepe bandage or plaster as appropriate'
      ];
    }

    if (nature === 'Chronic') {
      // Full chronic wound dressing protocol (Extension/Transition/Repair)
      steps.push('1. Wash hands and don sterile gloves');
      steps.push('2. Remove old dressing gently — soak if adherent');
      steps.push('3. Clean with Wound Clex Solution');
      if (data.tissue_types?.includes('Necrotic') || data.tissue_types?.includes('Eschar') || data.tissue_types?.includes('Slough')) {
        steps.push('4. Pack with first layer: Hera Gel (for debridement)');
      } else if ((data.granulation_percentage || 0) > 40) {
        steps.push('4. Pack with first layer: Woundcare-Honey Gauze');
      } else {
        steps.push('4. Pack with first layer: Hera Gel');
      }
      steps.push('5. Second layer: Woundcare-Honey Gauze');
      steps.push('6. Capillary layer: Sterile Gauze');
      steps.push('7. Absorbent layer: Cotton Wool');
      steps.push('8. Secure with Crepe Bandage or Plaster');
      const phase = data.healing_phase || 'Extension';
      const info = CHRONIC_PHASE_INFO[phase];
      if (info) steps.push(`Next dressing: ${info.frequency}`);
    } else {
      // Acute wound protocol
      steps.push('1. Wash hands and don sterile gloves');
      steps.push('2. Remove old dressing gently — soak if adherent');
      steps.push('3. Cleanse wound with normal saline (0.9% NaCl) or Wound Clex Solution');
      if (data.tissue_types?.includes('Necrotic') || data.tissue_types?.includes('Slough')) {
        steps.push('4. Perform gentle mechanical debridement as needed');
      }
      const next = steps.length + 1;
      steps.push(`${next}. Pat dry periwound skin`);
      if (data.exudate_amount === 'Heavy') {
        steps.push(`${next + 1}. Apply alginate/hydrofiber primary dressing`);
        steps.push(`${next + 2}. Cover with absorbent foam secondary dressing`);
      } else if (data.tissue_types?.includes('Granulation')) {
        steps.push(`${next + 1}. Apply non-adherent dressing (e.g., Jelonet/Mepitel)`);
        steps.push(`${next + 2}. Cover with gauze pad and secure`);
      } else {
        steps.push(`${next + 1}. Apply appropriate primary dressing`);
        steps.push(`${next + 2}. Secure with tape or bandage`);
      }
      steps.push(`${steps.length + 1}. Label dressing with date, time, and initials`);
      steps.push(`${steps.length + 1}. Document assessment and plan in patient record`);
    }
    return steps;
  };

  const printWoundAssessment = async (wa: WoundRecord) => {
    const { jsPDF } = await import('jspdf');
    const thermalWidth = 80;
    const estimatedHeight = 220 + (wa.recommendations.length * 5) + (wa.protocol.length * 5);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estimatedHeight] });
    const m = 3;
    let y = m;
    const clean = (t: string) => t.replace(/[^\x20-\x7E]/g, '');
    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('UNTH PLASTIC SURGERY', thermalWidth / 2, y, { align: 'center' }); y += 5;
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text('WOUND ASSESSMENT REPORT', thermalWidth / 2, y, { align: 'center' }); y += 5;
    doc.setLineWidth(0.3);
    doc.line(m, y, thermalWidth - m, y); y += 4;
    doc.setFont('times', 'bold'); doc.setFontSize(12);
    doc.text('PATIENT', m, y); y += 4;
    doc.setFont('times', 'normal');
    doc.text(`Name: ${clean(patientName)}`, m, y); y += 4;
    doc.text(`Hosp #: ${clean(hospitalNumber)}`, m, y); y += 4;
    doc.text(`Date: ${new Date(wa.assessed_at).toLocaleString()}`, m, y); y += 4;
    doc.text(`Assessed by: ${clean(wa.assessed_by)}`, m, y); y += 5;
    doc.line(m, y, thermalWidth - m, y); y += 4;
    doc.setFont('times', 'bold');
    doc.text('WOUND DETAILS', m, y); y += 4;
    doc.setFont('times', 'normal');
    doc.text(`Type: ${wa.wound_type} (${wa.wound_nature || 'Acute'})`, m, y); y += 4;
    doc.text(`Location: ${clean(wa.location)}`, m, y); y += 4;
    doc.text(`Phase: ${wa.healing_phase}`, m, y); y += 4;
    if (wa.wound_nature === 'Chronic') {
      doc.text(`Granulation: ${wa.granulation_percentage ?? 0}%`, m, y); y += 4;
    }
    doc.text(`Size: ${wa.length} x ${wa.width} x ${wa.depth} cm`, m, y); y += 4;
    doc.text(`Area: ${(wa.length * wa.width).toFixed(1)} cm2`, m, y); y += 4;
    doc.text(`Exudate: ${wa.exudate_amount}`, m, y); y += 4;
    doc.text(`Pain: ${wa.pain_level}/10`, m, y); y += 4;
    if (wa.tissue_types.length > 0) {
      doc.text(`Tissue: ${wa.tissue_types.join(', ')}`, m, y); y += 4;
    }
    y += 2; doc.line(m, y, thermalWidth - m, y); y += 4;
    doc.setFont('times', 'bold');
    doc.text('RECOMMENDATIONS', m, y); y += 4;
    doc.setFont('times', 'normal'); doc.setFontSize(10);
    wa.recommendations.forEach(r => {
      const lines = doc.splitTextToSize(`- ${clean(r)}`, thermalWidth - 2 * m);
      doc.text(lines, m, y); y += lines.length * 4;
    });
    y += 2; doc.line(m, y, thermalWidth - m, y); y += 4;
    doc.setFont('times', 'bold'); doc.setFontSize(12);
    doc.text('DRESSING PROTOCOL', m, y); y += 4;
    doc.setFont('times', 'normal'); doc.setFontSize(10);
    wa.protocol.forEach(s => {
      const lines = doc.splitTextToSize(clean(s), thermalWidth - 2 * m);
      doc.text(lines, m, y); y += lines.length * 4;
    });
    if (wa.notes) {
      y += 2; doc.line(m, y, thermalWidth - m, y); y += 4;
      doc.setFont('times', 'bold'); doc.setFontSize(12);
      doc.text('NOTES', m, y); y += 4;
      doc.setFont('times', 'normal'); doc.setFontSize(10);
      const noteLines = doc.splitTextToSize(clean(wa.notes), thermalWidth - 2 * m);
      doc.text(noteLines, m, y);
    }
    doc.save(`wound_assessment_${wa.id}.pdf`);
  };

  const saveAssessment = () => {
    if (!form.wound_type || !form.location) { alert('Wound type and location are required'); return; }
    const recs = generateRecommendations(form);
    const protocol = generateProtocol(form);
    const record: WoundRecord = {
      id: `wa_${Date.now()}`,
      wound_nature: form.wound_nature || 'Acute',
      wound_type: form.wound_type || '',
      location: form.location || '',
      length: form.length || 0,
      width: form.width || 0,
      depth: form.depth || 0,
      granulation_percentage: form.granulation_percentage || 0,
      tissue_types: form.tissue_types || [],
      exudate_amount: form.exudate_amount || 'None',
      pain_level: form.pain_level || 0,
      healing_phase: form.healing_phase || (form.wound_nature === 'Chronic' ? 'Extension' : 'Inflammatory'),
      notes: form.notes || '',
      recommendations: recs,
      protocol,
      assessed_by: user?.name || 'Unknown',
      assessed_at: new Date().toISOString(),
    };
    const updated = [record, ...assessments];
    localStorage.setItem(`wound_assessments_${patientId}`, JSON.stringify(updated));
    setAssessments(updated);
    setForm({ wound_nature: 'Acute', tissue_types: [], pain_level: 0, granulation_percentage: 0 });
    setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Wound Assessment</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> New Assessment
            </button>
            <button onClick={() => navigate(`/wound-care?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}`)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <Eye className="w-4 h-4" /> Full Wound Care
            </button>
          </div>
        </div>

        {showForm && (
          <div className="p-4 border-b border-gray-200 bg-green-50 space-y-3">
            {/* Wound Nature Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Wound Nature*</label>
              <div className="flex gap-2">
                {WOUND_NATURES.map(n => (
                  <button key={n} onClick={() => setForm({ ...form, wound_nature: n as 'Acute' | 'Chronic', healing_phase: n === 'Chronic' ? 'Extension' : 'Inflammatory', granulation_percentage: 0 })}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${form.wound_nature === n ? (n === 'Acute' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-orange-500 bg-orange-50 text-orange-700') : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                    {n}
                    <span className="block text-[10px] font-normal mt-0.5">{n === 'Acute' ? 'Inflammatory → Proliferative → Remodeling' : 'Extension → Transition → Repair'}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Wound Type*</label>
                <select value={form.wound_type || ''} onChange={e => setForm({ ...form, wound_type: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Select...</option>
                  {WOUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Location*</label>
                <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="e.g., Left anterior leg" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Healing Phase</label>
                <select value={form.healing_phase || healingPhases[0]} onChange={e => setForm({ ...form, healing_phase: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  {healingPhases.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {form.wound_nature === 'Chronic' && form.healing_phase && CHRONIC_PHASE_INFO[form.healing_phase] && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{CHRONIC_PHASE_INFO[form.healing_phase].description}</p>
                )}
              </div>
            </div>
            {/* Granulation % for chronic wounds */}
            {form.wound_nature === 'Chronic' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Granulation Percentage: {form.granulation_percentage || 0}%</label>
                <input type="range" min="0" max="100" value={form.granulation_percentage || 0}
                  onChange={e => {
                    const pct = parseInt(e.target.value);
                    const autoPhase = pct === 0 ? 'Extension' : pct <= 40 ? 'Transition' : 'Repair';
                    setForm({ ...form, granulation_percentage: pct, healing_phase: autoPhase });
                  }}
                  className="w-full" />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0% (Extension)</span><span>40% (Transition→Repair)</span><span>100%</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Length (cm)</label>
                <input type="number" step="0.1" value={form.length || ''} onChange={e => setForm({ ...form, length: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Width (cm)</label>
                <input type="number" step="0.1" value={form.width || ''} onChange={e => setForm({ ...form, width: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Depth (cm)</label>
                <input type="number" step="0.1" value={form.depth || ''} onChange={e => setForm({ ...form, depth: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Exudate Amount</label>
                <select value={form.exudate_amount || 'None'} onChange={e => setForm({ ...form, exudate_amount: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  {EXUDATE_AMOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Pain Level (0-10): {form.pain_level || 0}</label>
                <input type="range" min="0" max="10" value={form.pain_level || 0} onChange={e => setForm({ ...form, pain_level: parseInt(e.target.value) })} className="w-full" /></div>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Tissue Types Present</label>
              <div className="flex flex-wrap gap-2">
                {TISSUE_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-1 text-xs">
                    <input type="checkbox" checked={form.tissue_types?.includes(t) || false} onChange={e => {
                      const types = form.tissue_types || [];
                      setForm({ ...form, tissue_types: e.target.checked ? [...types, t] : types.filter(x => x !== t) });
                    }} className="rounded border-gray-300" /> {t}
                  </label>
                ))}
              </div>
            </div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" /></div>
            <div className="flex gap-2">
              <button onClick={saveAssessment} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"><Save className="w-4 h-4" /> Save & Generate Protocol</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 text-sm hover:bg-gray-100 rounded-md">Cancel</button>
            </div>
          </div>
        )}

        <div className="p-4">
          {assessments.length === 0 ? (
            <div className="text-center py-8"><AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No wound assessments recorded</p></div>
          ) : (
            <div className="space-y-4">
              {assessments.map((wa) => (
                <div key={wa.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{wa.wound_type} — {wa.location}</h4>
                      <p className="text-xs text-gray-500">{new Date(wa.assessed_at).toLocaleString()} • By: {wa.assessed_by}</p>
                    </div>
                    <div className="flex gap-1.5 items-center">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${wa.wound_nature === 'Chronic' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{wa.wound_nature || 'Acute'}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${wa.wound_nature === 'Chronic' && CHRONIC_PHASE_INFO[wa.healing_phase] ? CHRONIC_PHASE_INFO[wa.healing_phase].color : 'bg-blue-100 text-blue-700'}`}>{wa.healing_phase}</span>
                    </div>
                  </div>
                  {/* Phase details for chronic wounds */}
                  {wa.wound_nature === 'Chronic' && CHRONIC_PHASE_INFO[wa.healing_phase] && (
                    <div className={`mb-3 p-2 rounded text-xs ${CHRONIC_PHASE_INFO[wa.healing_phase].color}`}>
                      <span className="font-medium">{wa.healing_phase} Phase:</span> {CHRONIC_PHASE_INFO[wa.healing_phase].description}
                      {' • '}Granulation: {wa.granulation_percentage ?? 0}% • Dressing: {CHRONIC_PHASE_INFO[wa.healing_phase].frequency}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                    <div><span className="text-gray-500">Size:</span> {wa.length}×{wa.width}×{wa.depth} cm</div>
                    <div><span className="text-gray-500">Area:</span> {(wa.length * wa.width).toFixed(1)} cm²</div>
                    <div><span className="text-gray-500">Exudate:</span> {wa.exudate_amount}</div>
                    <div><span className="text-gray-500">Pain:</span> {wa.pain_level}/10</div>
                  </div>
                  {wa.tissue_types.length > 0 && (
                    <div className="mb-3"><span className="text-xs text-gray-500">Tissue: </span>{wa.tissue_types.map(t => (
                      <span key={t} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full mr-1">{t}</span>
                    ))}</div>
                  )}
                  {/* Auto-generated Recommendations */}
                  <div className={`mt-3 p-3 rounded-lg ${wa.wound_nature === 'Chronic' ? 'bg-orange-50' : 'bg-blue-50'}`}>
                    <h5 className={`text-sm font-semibold mb-1 ${wa.wound_nature === 'Chronic' ? 'text-orange-800' : 'text-blue-800'}`}>
                      {wa.wound_nature === 'Chronic' ? `${wa.healing_phase} Phase Recommendations` : 'Auto-Generated Recommendations'}
                    </h5>
                    <ul className={`text-xs space-y-1 ${wa.wound_nature === 'Chronic' ? 'text-orange-700' : 'text-blue-700'}`}>
                      {wa.recommendations.map((r, i) => <li key={i}>• {r}</li>)}
                    </ul>
                  </div>
                  {/* Wound Care Protocol */}
                  <div className="mt-2 p-3 bg-green-50 rounded-lg">
                    <h5 className="text-sm font-semibold text-green-800 mb-1">Wound Care Protocol</h5>
                    <ol className="text-xs text-green-700 space-y-1">
                      {wa.protocol.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </div>
                  {/* Print Button */}
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => printWoundAssessment(wa)} className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 text-white text-xs rounded-md hover:bg-gray-800">
                      <Printer className="w-3.5 h-3.5" /> Print (Thermal 80mm)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── MDT CARE TAB ────────────────────────────────────────────────────────────
const MDTCareTab: React.FC<{
  patientId: string; patientName: string; hospitalNumber: string; userName: string;
  mdtInfo: { patient_type: string; consulting_unit?: string; referring_hospital?: string; mdt_team?: any } | null;
  onMdtInfoChange: () => void;
}> = ({ patientId, patientName, hospitalNumber, userName, mdtInfo, onMdtInfoChange }) => {
  const [patientType, setPatientType] = useState(mdtInfo?.patient_type || 'primary');
  const [consultingUnit, setConsultingUnit] = useState(mdtInfo?.consulting_unit || '');
  const [referringHospital, setReferringHospital] = useState(mdtInfo?.referring_hospital || '');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [saving, setSaving] = useState(false);

  // Documentation state
  const [docs, setDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [docTeam, setDocTeam] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docType, setDocType] = useState('clinical_note');
  const [docSaving, setDocSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showOCRScanner, setShowOCRScanner] = useState(false);

  const CONSULTING_UNITS = [
    'Cardiology', 'Endocrinology', 'Respiratory', 'Nephrology',
    'Dermatology and Rheumatology', 'Haematology', 'Neurology', 'Psychiatry',
    'Pediatrics', 'Ophthalmology', 'ENT', 'Maxillofacial', 'General Surgery',
    'Urology', 'Cardiothoracic', 'Gastroenterology', 'Radio-Oncology',
    'Obstetrics and Gynaecology', 'ICU', 'Orthopaedic',
    'Pain and Palliative Unit', 'Burns, Plastic and Reconstructive Surgery',
    'Anaesthesia', 'Neurosurgery', 'Emergency Medicine', 'Infectious Disease',
    'Internal Medicine', 'Oncology', 'Physiotherapy', 'Dietetics',
  ];

  useEffect(() => {
    if (mdtInfo) {
      setPatientType(mdtInfo.patient_type || 'primary');
      setConsultingUnit(mdtInfo.consulting_unit || '');
      setReferringHospital(mdtInfo.referring_hospital || '');
      if (mdtInfo.mdt_team?.specialties) {
        try {
          const sp = typeof mdtInfo.mdt_team.specialties === 'string'
            ? JSON.parse(mdtInfo.mdt_team.specialties)
            : mdtInfo.mdt_team.specialties;
          setSpecialties(Array.isArray(sp) ? sp : []);
        } catch { setSpecialties([]); }
      }
    }
  }, [mdtInfo]);

  useEffect(() => { loadDocumentation(); }, [patientId]);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => { if (isRecording) speechToTextService.stopListening(); };
  }, [isRecording]);

  const loadDocumentation = async () => {
    setDocsLoading(true);
    try {
      const data = await apiClient.get(`/mdt-documentation?patientId=${patientId}`);
      setDocs(data?.documentation || []);
    } catch { setDocs([]); }
    finally { setDocsLoading(false); }
  };

  const savePatientType = async () => {
    setSaving(true);
    try {
      await apiClient.post('/mdt/set-patient-type', {
        patient_id: patientId,
        patient_type: patientType,
        consulting_unit: consultingUnit,
        referring_hospital: referringHospital,
        specialties,
        patient_name: patientName,
        hospital_number: hospitalNumber,
      });
      onMdtInfoChange();
    } catch (err) {
      alert('Failed to save patient type');
    } finally { setSaving(false); }
  };

  const addSpecialty = () => {
    if (newSpecialty && !specialties.includes(newSpecialty)) {
      setSpecialties([...specialties, newSpecialty]);
      setNewSpecialty('');
    }
  };

  const removeSpecialty = (s: string) => setSpecialties(specialties.filter(x => x !== s));

  const toggleSpeechToText = () => {
    if (isRecording) {
      speechToTextService.stopListening();
      setIsRecording(false);
    } else {
      if (!speechToTextService.isSupported()) {
        alert('Speech recognition is not supported in this browser. Use Chrome or Edge.');
        return;
      }
      const started = speechToTextService.startListening({
        language: 'en-US',
        continuous: true,
        interimResults: true,
        onResult: (result) => {
          if (result.isFinal) {
            setDocContent(prev => {
              const separator = prev.trim() ? ' ' : '';
              return prev.trim() + separator + result.transcript;
            });
          }
        },
        onError: () => setIsRecording(false),
        onEnd: () => setIsRecording(false),
      });
      if (started) setIsRecording(true);
    }
  };

  const handleOCRExtracted = (fields: Record<string, any>) => {
    const extractedText = fields.rawText || fields.content || fields.text ||
      Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n');
    setDocContent(prev => prev ? prev + '\n\n--- OCR Extracted ---\n' + extractedText : extractedText);
    setShowOCRScanner(false);
  };

  const saveDocumentation = async () => {
    if (!docContent.trim() || !docTeam) return;
    setDocSaving(true);
    try {
      // Get geolocation
      let geoLocation: any = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
        });
        geoLocation = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=18&addressdetails=1`, { headers: { 'User-Agent': 'UNTH-PlasticSurg-Assistant/1.0' } });
          if (geoRes.ok) { const geoData = await geoRes.json(); geoLocation.address = geoData.display_name || ''; }
        } catch { /* geocode optional */ }
      } catch { /* geolocation optional */ }

      await apiClient.post('/mdt-documentation', {
        patient_id: patientId,
        hospital_number: hospitalNumber,
        patient_name: patientName,
        team_name: docTeam,
        documenter_name: userName,
        documentation_type: docType,
        content: docContent + (geoLocation ? `\n\n[Location: ${geoLocation.address || `${geoLocation.latitude.toFixed(5)}, ${geoLocation.longitude.toFixed(5)}`} (±${Math.round(geoLocation.accuracy || 0)}m)]` : ''),
        input_method: isRecording ? 'speech' : 'typed',
        created_by: userName,
      });
      setDocContent('');
      setShowNewDoc(false);
      if (isRecording) { speechToTextService.stopListening(); setIsRecording(false); }
      await loadDocumentation();
    } catch { alert('Failed to save documentation'); }
    finally { setDocSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Patient Type Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Patient Classification & MDT Setup</h3>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Patient Type</label>
              <select value={patientType} onChange={e => setPatientType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500">
                <option value="primary">Primary (Our Unit&apos;s Patient)</option>
                <option value="consult">Consult/MDT (Invited via Consult)</option>
              </select>
            </div>
            {patientType === 'consult' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Managing Unit</label>
                <select value={consultingUnit} onChange={e => setConsultingUnit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-green-500 focus:border-green-500">
                  <option value="">Select Unit...</option>
                  {CONSULTING_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
          </div>

          {patientType === 'consult' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Referring Hospital / Source</label>
                <input value={referringHospital} onChange={e => setReferringHospital(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder="e.g. UNTH Ward X, External hospital..." />
              </div>

              {/* Co-managing Specialties */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Co-managing Units/Teams</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {specialties.map(s => (
                    <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                      {s} <button onClick={() => removeSpecialty(s)} className="text-purple-500 hover:text-purple-700"><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                  {specialties.length === 0 && <span className="text-xs text-gray-400">No co-managing teams added yet</span>}
                </div>
                <div className="flex gap-2">
                  <select value={newSpecialty} onChange={e => setNewSpecialty(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option value="">Add a co-managing unit...</option>
                    {CONSULTING_UNITS.filter(u => !specialties.includes(u)).map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={addSpecialty} disabled={!newSpecialty}
                    className="px-3 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}

          <button onClick={savePatientType} disabled={saving}
            className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Classification
          </button>
        </div>
      </div>

      {/* MDT Status Banner */}
      {patientType === 'consult' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <h4 className="font-semibold text-purple-900">MDT Patient — Active Consult</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <div><span className="text-purple-600 font-medium">Primary Unit:</span> <span className="text-purple-900">{consultingUnit || 'Not set'}</span></div>
            <div><span className="text-purple-600 font-medium">Referring From:</span> <span className="text-purple-900">{referringHospital || 'Not set'}</span></div>
            <div><span className="text-purple-600 font-medium">Co-managing:</span> <span className="text-purple-900">{specialties.length > 0 ? specialties.join(', ') : 'None'}</span></div>
          </div>
        </div>
      )}

      {/* MDT Documentation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Co-managing Team Documentation</h3>
          <button onClick={() => setShowNewDoc(true)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
            <Plus className="w-4 h-4" /> New Entry
          </button>
        </div>

        {showNewDoc && (
          <div className="p-4 border-b border-gray-200 bg-purple-50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team/Unit</label>
                <select value={docTeam} onChange={e => setDocTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="">Select team...</option>
                  {[...specialties, consultingUnit, 'Burns, Plastic and Reconstructive Surgery'].filter(Boolean).map((s, i) =>
                    <option key={i} value={s}>{s}</option>
                  )}
                  {CONSULTING_UNITS.filter(u => ![...specialties, consultingUnit].includes(u)).map(u =>
                    <option key={u} value={u}>{u}</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Documentation Type</label>
                <select value={docType} onChange={e => setDocType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                  <option value="clinical_note">Clinical Note</option>
                  <option value="consult_review">Consult Review</option>
                  <option value="recommendation">Recommendation</option>
                  <option value="procedure_note">Procedure Note</option>
                  <option value="discharge_plan">Discharge Plan</option>
                  <option value="harmonization">Care Harmonization Note</option>
                </select>
              </div>
            </div>

            {/* Speech & OCR Toolbar */}
            <div className="flex items-center gap-2 mb-2 p-2 bg-white rounded-lg border border-gray-200">
              <button onClick={toggleSpeechToText}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  isRecording ? 'bg-red-100 text-red-700 border border-red-300 animate-pulse' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                }`} title={isRecording ? 'Stop dictation' : 'Start voice dictation'}>
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isRecording ? 'Stop Dictation' : 'Dictate'}
              </button>
              <button onClick={() => setShowOCRScanner(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all"
                title="Scan document with OCR">
                <ScanLine className="w-4 h-4" /> Scan Document
              </button>
              {isRecording && (
                <span className="flex items-center gap-1 text-xs text-red-600 ml-auto">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> Listening — speak clearly...
                </span>
              )}
            </div>

            <textarea value={docContent} onChange={e => setDocContent(e.target.value)} rows={5}
              placeholder={isRecording ? 'Speak now — your dictation will appear here...' : 'Enter co-managing team notes, recommendations, or care plan...'}
              className={`w-full px-3 py-2 border rounded-md text-sm mb-3 transition-colors ${
                isRecording ? 'border-red-300 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-purple-500'
              }`} />
            <div className="flex gap-2">
              <button onClick={saveDocumentation} disabled={docSaving || !docContent.trim() || !docTeam}
                className="flex items-center gap-1 px-4 py-2 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700 disabled:opacity-50">
                {docSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </button>
              <button onClick={() => { setShowNewDoc(false); if (isRecording) { speechToTextService.stopListening(); setIsRecording(false); } }}
                className="px-4 py-2 text-gray-600 text-sm rounded-md hover:bg-gray-100">Cancel</button>
            </div>
          </div>
        )}

        <div className="p-4">
          {docsLoading ? (
            <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" /><p className="text-sm text-gray-500 mt-2">Loading documentation...</p></div>
          ) : docs.length === 0 ? (
            <div className="text-center py-8"><FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No MDT documentation yet</p><p className="text-xs text-gray-400 mt-1">Add documentation from co-managing teams using the button above</p></div>
          ) : (
            <div className="space-y-3">
              {docs.map((doc, i) => (
                <div key={doc.id || i} className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">{doc.team_name}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                        {doc.documentation_type === 'clinical_note' ? 'Clinical Note' :
                         doc.documentation_type === 'consult_review' ? 'Consult Review' :
                         doc.documentation_type === 'recommendation' ? 'Recommendation' :
                         doc.documentation_type === 'procedure_note' ? 'Procedure Note' :
                         doc.documentation_type === 'discharge_plan' ? 'Discharge Plan' :
                         doc.documentation_type === 'harmonization' ? 'Harmonization' :
                         doc.documentation_type || 'Note'}
                      </span>
                      {doc.input_method && doc.input_method !== 'typed' && (
                        <span className="text-[10px] text-gray-400">{doc.input_method === 'speech' ? '🎤 Dictated' : '📷 Scanned'}</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">{doc.created_at ? new Date(doc.created_at).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{doc.content}</p>
                  <div className="mt-2 text-xs text-gray-400">
                    By: {doc.documenter_name || doc.created_by || 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* OCR Scanner Modal */}
      {showOCRScanner && (
        <DocumentScannerModal
          isOpen={showOCRScanner}
          onClose={() => setShowOCRScanner(false)}
          onExtracted={handleOCRExtracted}
          documentType="consultation"
          {...{} as any}
        />
      )}
    </div>
  );
};

// Utility function - handles null/undefined/empty dob gracefully
const calculateAge = (dob: string | null | undefined): number | null => {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export default PatientProfile;