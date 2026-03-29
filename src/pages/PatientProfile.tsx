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
  Eye, Trash2, Upload, Mic, MicOff, ScanLine
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
  const [admissionStatus, setAdmissionStatus] = useState<{ isAdmitted: boolean; ward?: string; bed?: string; admissionDate?: string } | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [medicalTeam, setMedicalTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (id) {
      loadPatientData();
      loadAdmissionStatus();
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
        setAdmissionStatus({
          isAdmitted: true,
          ward: latest.ward_location || latest.ward,
          bed: latest.bed_number,
          admissionDate: latest.admission_date,
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
                    <span className="px-2 sm:px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs sm:text-sm font-medium flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Admitted {admissionStatus.ward ? `• ${admissionStatus.ward}` : ''} {admissionStatus.bed ? `Bed ${admissionStatus.bed}` : ''}
                    </span>
                  ) : (
                    <span className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium">
                      Outpatient
                    </span>
                  )
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
  const [showNewEncounter, setShowNewEncounter] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [encounterType, setEncounterType] = useState('progress_note');
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showOCRScanner, setShowOCRScanner] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { loadEncounters(); }, [patientId]);

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

  const loadEncounters = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/progress-notes?patientId=${patientId}`);
      const notes = data?.notes || data?.progressNotes || [];
      // Also fetch admissions for encounter context
      const admData = await apiClient.get(`/admissions?patientId=${patientId}`);
      const admissions = (admData?.admissions || []).map((a: any) => ({
        ...a,
        _type: 'admission',
        created_at: a.admission_date || a.created_at,
      }));
      // Merge and sort chronologically
      const all = [
        ...notes.map((n: any) => ({ ...n, _type: n.type || 'progress_note' })),
        ...admissions,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEncounters(all);
    } catch {
      setEncounters([]);
    } finally {
      setLoading(false);
    }
  };

  const saveEncounter = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      await apiClient.post('/progress-notes', {
        patient_id: patientId,
        hospital_number: hospitalNumber,
        patient_name: patientName,
        type: encounterType,
        content: newNote,
        created_by: userName,
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
          <button onClick={() => setShowNewEncounter(true)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" /> New Encounter
          </button>
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
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{enc.content || enc.presenting_complaint || enc.reasons_for_admission || enc.notes || 'No content'}</p>
                  <div className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                    <span>By: {enc.created_by || enc.admitting_doctor || 'Unknown'}</span>
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Vital Signs Records</h3>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" /> Record Vitals
          </button>
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
    </div>
  );
};

// ─── INVESTIGATIONS TAB ──────────────────────────────────────────────────────
const InvestigationsTab: React.FC<{ patientId: string; hospitalNumber: string; patientName: string; userName: string }> = ({ patientId, hospitalNumber, patientName, userName }) => {
  const [requested, setRequested] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'requested' | 'results'>('requested');
  const [showScanForm, setShowScanForm] = useState(false);
  const [showScanResult, setShowScanResult] = useState(false);
  const [showOCRModal, setShowOCRModal] = useState<'form' | 'result' | null>(null);
  const [uploadingForm, setUploadingForm] = useState(false);
  const [uploadingResult, setUploadingResult] = useState(false);
  const formFileRef = useRef<HTMLInputElement>(null);
  const resultFileRef = useRef<HTMLInputElement>(null);
  const [scannedFormData, setScannedFormData] = useState<any>(null);
  const [scannedResultData, setScannedResultData] = useState<any>(null);

  useEffect(() => { loadInvestigations(); }, [patientId]);

  const loadInvestigations = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get(`/lab-orders?patientId=${patientId}`);
      const allOrders = data?.labOrders || [];
      setRequested(allOrders.filter((o: any) => o.status === 'pending' || o.status === 'ordered' || o.status === 'in_progress'));
      setResults(allOrders.filter((o: any) => o.status === 'completed' || o.status === 'resulted' || o.results));
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

      const record = {
        id: `inv-upload-${Date.now()}`,
        patient_id: patientId,
        hospital_number: hospitalNumber,
        type: uploadType,
        file_name: file.name,
        file_data: dataUrl,
        uploaded_by: userName,
        uploaded_at: new Date().toISOString(),
        test_name: uploadType === 'form' ? 'Scanned Investigation Form' : 'Scanned Result',
        status: uploadType === 'form' ? 'pending' : 'completed',
      };

      const stored = localStorage.getItem(`investigation_uploads_${patientId}`);
      const existing = stored ? JSON.parse(stored) : [];
      existing.unshift(record);
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
    const record = {
      id: `inv-ocr-${Date.now()}`,
      patient_id: patientId,
      hospital_number: hospitalNumber,
      test_name: testName,
      status: scanType === 'form' ? 'pending' : 'completed',
      results: scanType === 'result' ? fields : undefined,
      ocr_extracted: true,
      created_by: userName,
      created_at: new Date().toISOString(),
    };

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
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{inv.test_name || inv.investigation_type || 'Lab Test'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Ordered: {inv.created_at ? new Date(inv.created_at).toLocaleString() : 'N/A'}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded-full font-medium">{inv.status || 'Pending'}</span>
                    </div>
                    {inv.ordered_by && <p className="text-xs text-gray-400 mt-1">By: {inv.ordered_by}</p>}
                  </div>
                ))}
              </div>
            )
          ) : (
            results.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No available results</p>
            ) : (
              <div className="space-y-3">
                {results.map((inv, i) => (
                  <div key={inv.id || i} className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 text-sm">{inv.test_name || inv.investigation_type || 'Lab Test'}</p>
                      <span className="px-2 py-0.5 bg-green-200 text-green-800 text-xs rounded-full font-medium">Completed</span>
                    </div>
                    {inv.results && typeof inv.results === 'object' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(inv.results).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-500">{key}:</span> <span className="font-medium text-gray-900">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    ) : inv.results ? (
                      <p className="text-sm text-gray-800">{String(inv.results)}</p>
                    ) : null}
                    <p className="text-xs text-gray-400 mt-2">Resulted: {inv.result_date ? new Date(inv.result_date).toLocaleString() : inv.updated_at ? new Date(inv.updated_at).toLocaleString() : ''}</p>
                  </div>
                ))}
              </div>
            )
          )}
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
    </div>
  );
};

// ─── TREATMENT PLANS TAB ─────────────────────────────────────────────────────
const TreatmentPlansTab: React.FC<{ patientId: string; patientName: string; navigate: any }> = ({ patientId, patientName, navigate }) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Treatment Planning</h3>
          <button onClick={() => navigate(`/treatment-planning?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}`)} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-8"><Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500">No treatment plans yet</p></div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan, i) => {
                const steps = plan.steps || plan.plan_steps || [];
                const completedSteps = steps.filter((s: any) => s.status === 'completed').length;
                const totalSteps = steps.length;
                const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
                const isPastDue = plan.target_date && new Date(plan.target_date) < new Date() && plan.status !== 'completed';

                return (
                  <div key={plan.id || i} className={`border rounded-lg p-4 cursor-pointer hover:border-green-400 transition-colors ${isPastDue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    onClick={() => navigate(`/patients/${patientId}/plans/${plan.id}`)}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{plan.title || 'Untitled Plan'}</h4>
                      <div className="flex items-center gap-2">
                        {isPastDue && <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs rounded-full animate-pulse">Overdue</span>}
                        <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          plan.status === 'completed' ? 'bg-green-100 text-green-700' :
                          plan.status === 'active' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{plan.status || 'Active'}</span>
                      </div>
                    </div>
                    {totalSteps > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                          <span>{completedSteps}/{totalSteps} steps</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Created: {plan.created_at ? new Date(plan.created_at).toLocaleDateString() : 'N/A'}</span>
                      {plan.target_date && <span>Target: {new Date(plan.target_date).toLocaleDateString()}</span>}
                      <span>By: {plan.created_by || 'Unknown'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
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
const WOUND_TYPES = ['Surgical', 'Traumatic', 'Burn', 'Pressure ulcer', 'Diabetic ulcer', 'Venous ulcer', 'Arterial ulcer', 'Other'];
const EXUDATE_AMOUNTS = ['None', 'Light', 'Moderate', 'Heavy'] as const;
const TISSUE_TYPES = ['Epithelializing', 'Granulation', 'Slough', 'Necrotic', 'Eschar', 'Hypergranulation'];
const HEALING_PHASES = ['Inflammatory', 'Proliferative', 'Remodeling'] as const;

interface WoundRecord {
  id: string;
  wound_type: string;
  location: string;
  length: number;
  width: number;
  depth: number;
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
  const [form, setForm] = useState<Partial<WoundRecord>>({ tissue_types: [], pain_level: 0 });
  const { user } = useAuthStore();

  useEffect(() => { loadAssessments(); }, [patientId]);

  const loadAssessments = () => {
    const stored = localStorage.getItem(`wound_assessments_${patientId}`);
    setAssessments(stored ? JSON.parse(stored) : []);
  };

  const generateRecommendations = (data: Partial<WoundRecord>): string[] => {
    const recs: string[] = [];
    if (data.exudate_amount === 'Heavy') recs.push('Use highly absorbent dressing (e.g., alginate or foam)');
    if (data.exudate_amount === 'None' || data.exudate_amount === 'Light') recs.push('Maintain moist wound environment with hydrogel/film');
    if (data.tissue_types?.includes('Necrotic') || data.tissue_types?.includes('Eschar')) recs.push('Consider debridement of necrotic/eschar tissue');
    if (data.tissue_types?.includes('Slough')) recs.push('Autolytic debridement with hydrogel recommended');
    if (data.tissue_types?.includes('Granulation')) recs.push('Protect granulation tissue — use non-adherent dressing');
    if ((data.pain_level || 0) >= 7) recs.push('Adequate pain management before dressing changes');
    if (data.depth && data.depth > 2) recs.push('Consider wound VAC for deep wounds');
    if (data.healing_phase === 'Inflammatory') recs.push('Monitor for infection signs — consider culture if not improving');
    recs.push('Reassess wound in 48-72 hours');
    recs.push('Document wound measurements and photograph at each dressing change');
    return recs;
  };

  const generateProtocol = (data: Partial<WoundRecord>): string[] => {
    const steps: string[] = [];
    steps.push('1. Wash hands and don sterile gloves');
    steps.push('2. Remove old dressing gently — soak if adherent');
    steps.push('3. Cleanse wound with normal saline (0.9% NaCl)');
    if (data.tissue_types?.includes('Necrotic') || data.tissue_types?.includes('Slough')) {
      steps.push('4. Perform gentle mechanical debridement as needed');
    }
    steps.push(`${steps.length + 1}. Pat dry periwound skin`);
    if (data.exudate_amount === 'Heavy') {
      steps.push(`${steps.length + 1}. Apply alginate/hydrofiber primary dressing`);
      steps.push(`${steps.length + 1}. Cover with absorbent foam secondary dressing`);
    } else if (data.tissue_types?.includes('Granulation')) {
      steps.push(`${steps.length + 1}. Apply non-adherent dressing (e.g., Jelonet/Mepitel)`);
      steps.push(`${steps.length + 1}. Cover with gauze pad and secure`);
    } else {
      steps.push(`${steps.length + 1}. Apply appropriate primary dressing`);
      steps.push(`${steps.length + 1}. Secure with tape or bandage`);
    }
    steps.push(`${steps.length + 1}. Label dressing with date, time, and initials`);
    steps.push(`${steps.length + 1}. Document assessment and plan in patient record`);
    return steps;
  };

  const saveAssessment = () => {
    if (!form.wound_type || !form.location) { alert('Wound type and location are required'); return; }
    const recs = generateRecommendations(form);
    const protocol = generateProtocol(form);
    const record: WoundRecord = {
      id: `wa_${Date.now()}`,
      wound_type: form.wound_type || '',
      location: form.location || '',
      length: form.length || 0,
      width: form.width || 0,
      depth: form.depth || 0,
      tissue_types: form.tissue_types || [],
      exudate_amount: form.exudate_amount || 'None',
      pain_level: form.pain_level || 0,
      healing_phase: form.healing_phase || 'Inflammatory',
      notes: form.notes || '',
      recommendations: recs,
      protocol,
      assessed_by: user?.name || 'Unknown',
      assessed_at: new Date().toISOString(),
    };
    const updated = [record, ...assessments];
    localStorage.setItem(`wound_assessments_${patientId}`, JSON.stringify(updated));
    setAssessments(updated);
    setForm({ tissue_types: [], pain_level: 0 });
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Wound Type*</label>
                <select value={form.wound_type || ''} onChange={e => setForm({ ...form, wound_type: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  <option value="">Select...</option>
                  {WOUND_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Location*</label>
                <input value={form.location || ''} onChange={e => setForm({ ...form, location: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="e.g., Left anterior leg" /></div>
              <div><label className="block text-xs font-medium text-gray-700 mb-1">Healing Phase</label>
                <select value={form.healing_phase || ''} onChange={e => setForm({ ...form, healing_phase: e.target.value })} className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm">
                  {HEALING_PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                </select></div>
            </div>
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
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{wa.healing_phase}</span>
                  </div>
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
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <h5 className="text-sm font-semibold text-blue-800 mb-1">Auto-Generated Recommendations</h5>
                    <ul className="text-xs text-blue-700 space-y-1">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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