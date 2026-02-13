import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../db/database';
import { Patient } from '../db/database';
import { patientService } from '../services/patientService';
import { unthPatientService } from '../services/unthPatientService';
import { PatientSummaryView, QuickSummaryCard } from '../components/PatientSummary';
import { PatientTransferForm, TransferHistory } from '../components/PatientTransfer';
import { DischargePlanning } from '../components/DischargePlanning';
import { RiskAssessmentSummary } from '../components/riskAssessments/RiskAssessmentSummary';
import { DVTRiskAssessmentForm } from '../components/riskAssessments/DVTRiskAssessment';
import { PressureSoreRiskAssessmentForm } from '../components/riskAssessments/PressureSoreRiskAssessment';
import { NutritionalRiskAssessmentForm } from '../components/riskAssessments/NutritionalRiskAssessment';
import { ProgressNoteModal } from '../components/ProgressNoteModal';
import { PrescriptionModal } from '../components/PrescriptionModal';
import { PatientActivityTimeline } from '../components/PatientActivityTimeline';
import { medicalTeamService, TeamMember } from '../services/medicalTeamService';
import { logPatientAccess } from '../services/auditLoggingService';
import { useAuthStore } from '../store/authStore';

export const PatientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Patient>>({});
  const [activeTab, setActiveTab] = useState('summary');
  const [upcomingPlans, setUpcomingPlans] = useState<any[]>([]);
  const [activeRiskAssessment, setActiveRiskAssessment] = useState<'summary' | 'dvt' | 'pressure' | 'nutrition'>('summary');
  const [showProgressNoteModal, setShowProgressNoteModal] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [medicalTeam, setMedicalTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (id) {
      loadPatientData();
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
      
      // Load patient basic info from API
      const patientData = await patientService.getPatient(id);
      setPatient(patientData || null);

      // Load upcoming plans
      const plans = await unthPatientService.getUpcomingPlans(id);
      setUpcomingPlans(plans);
      
    } catch (error) {
      console.error('Error loading patient data:', error);
    } finally {
      setLoading(false);
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
        console.log('No team assigned, auto-assigning medical team...');
        await medicalTeamService.assignTeamToPatient(Number(id), patient.hospital_number);
        team = await medicalTeamService.getPatientMedicalTeam(Number(id));
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

  const tabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'risk-assessment', name: 'Risk Assessment' },
    { id: 'transfer', name: 'Transfer' },
    { id: 'progress', name: 'Progress' },
    { id: 'plans', name: 'Upcoming Plans' },
    { id: 'activity', name: 'Activity Log' },
    { id: 'discharge', name: 'Discharge' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return <PatientSummaryView patientId={id!} />;
      
      case 'risk-assessment':
        return <RiskAssessmentView patientId={id!} hospitalNumber={patient?.hospital_number || id!} />;
      
      case 'transfer':
        return (
          <div className="space-y-6">
            <PatientTransferForm 
              patientId={id!}
              currentWard="sw1" // This would come from patient data
              onSuccess={(transfer) => {
                console.log('Transfer completed:', transfer);
                // Refresh patient data
                loadPatientData();
              }}
            />
            <TransferHistory patientId={id!} />
          </div>
        );
      
      case 'progress':
        return (
          <div className="space-y-6">
            <TreatmentProgressView patientId={id!} />
          </div>
        );
      
      case 'plans':
        return (
          <div className="space-y-6">
            <UpcomingPlansView plans={upcomingPlans} />
          </div>
        );
      
      case 'activity':
        return (
          <PatientActivityTimeline 
            patientId={Number(id!)}
            hospitalNumber={patient?.hospital_number || id!}
          />
        );
      
      case 'discharge':
        return (
          <DischargePlanning 
            patientId={id!}
            onDischargeComplete={(dischargeId) => {
              console.log('Discharge completed:', dischargeId);
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
                    <span>{calculateAge(patient.dob)}y, {patient.sex}</span>
                    <span className="hidden sm:inline"></span>
                    <span className="hidden sm:inline">{patient.phone}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-3">
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
          {/* Sidebar - Quick Info - Hidden on mobile, show in tabs */}
          <div className="hidden lg:block lg:col-span-1 space-y-6">
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
                  <span className="font-medium">{patient.dob}</span>
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
                    const initials = member.name
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
                  onClick={() => setActiveTab('risk-assessment')}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  Risk Assessment
                </button>
                <button 
                  onClick={() => setActiveTab('transfer')}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  Transfer Patient
                </button>
                <button 
                  onClick={() => setActiveTab('discharge')}
                  className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded transition-colors"
                >
                  Plan Discharge
                </button>
                <button 
                  onClick={() => setShowProgressNoteModal(true)}
                  className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors"
                >
                  Add Progress Note
                </button>
                <button 
                  onClick={() => setShowPrescriptionModal(true)}
                  className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded transition-colors"
                >
                  Prescribe Medication
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
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProgressNoteModal
        isOpen={showProgressNoteModal}
        onClose={() => setShowProgressNoteModal(false)}
        patientId={id!}
        patientName={`${patient.first_name} ${patient.last_name}`}
        patientSex={patient.sex || patient.gender}
        onSuccess={() => {
          console.log('Progress note saved');
          loadPatientData();
        }}
      />

      <PrescriptionModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        patientId={id!}
        patientName={`${patient.first_name} ${patient.last_name}`}
        onSuccess={() => {
          console.log('Prescription saved');
          loadPatientData();
        }}
      />

      {/* Edit Patient Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Edit Patient Details</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                {editFormData.dob && (
                  <p className="text-sm text-gray-500 mt-1">Age: {calculateAge(editFormData.dob)} years</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
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

// Helper Components
const RiskAssessmentView: React.FC<{ patientId: string; hospitalNumber: string }> = ({ patientId, hospitalNumber }) => {
  const [activeAssessment, setActiveAssessment] = useState<'summary' | 'dvt' | 'pressure' | 'nutrition'>('summary');

  const assessmentTabs = [
    { id: 'summary', name: 'Overview', color: 'gray' },
    { id: 'dvt', name: 'DVT Risk', color: 'red' },
    { id: 'pressure', name: 'Pressure Sore', color: 'orange' },
    { id: 'nutrition', name: 'Nutrition', color: 'green' }
  ];

  const renderAssessmentContent = () => {
    switch (activeAssessment) {
      case 'summary':
        return (
          <RiskAssessmentSummary 
            patientId={patientId} 
            onCreateAssessment={(type) => {
              if (type === 'dvt') setActiveAssessment('dvt');
              else if (type === 'pressure_sore') setActiveAssessment('pressure');
              else if (type === 'nutritional') setActiveAssessment('nutrition');
            }}
          />
        );
      case 'dvt':
        return (
          <DVTRiskAssessmentForm 
            patientId={patientId}
            hospitalNumber={hospitalNumber}
            onSave={(assessment) => {
              console.log('DVT assessment saved:', assessment);
              setActiveAssessment('summary');
            }}
          />
        );
      case 'pressure':
        return (
          <PressureSoreRiskAssessmentForm 
            patientId={patientId}
            onSave={(assessment) => {
              console.log('Pressure sore assessment saved:', assessment);
              setActiveAssessment('summary');
            }}
          />
        );
      case 'nutrition':
        return (
          <NutritionalRiskAssessmentForm 
            patientId={patientId}
            onSave={(assessment) => {
              console.log('Nutritional assessment saved:', assessment);
              setActiveAssessment('summary');
            }}
          />
        );
      default:
        return (
          <RiskAssessmentSummary 
            patientId={patientId} 
            onCreateAssessment={(type) => {
              if (type === 'dvt') setActiveAssessment('dvt');
              else if (type === 'pressure_sore') setActiveAssessment('pressure');
              else if (type === 'nutritional') setActiveAssessment('nutrition');
            }}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Assessment Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Risk Assessment Module</h3>
          <p className="text-sm text-gray-600 mt-1">
            Evidence-based clinical assessments for patient safety and care planning
          </p>
        </div>
        
        <div className="px-6 py-4">
          <nav className="flex space-x-1">
            {assessmentTabs.map(tab => {
              const isActive = activeAssessment === tab.id;
              const getActiveStyles = () => {
                switch (tab.color) {
                  case 'red':
                    return 'bg-red-100 text-red-700 border border-red-200';
                  case 'orange':
                    return 'bg-orange-100 text-orange-700 border border-orange-200';
                  case 'green':
                    return 'bg-green-100 text-green-700 border border-green-200';
                  default:
                    return 'bg-gray-100 text-gray-700 border border-gray-200';
                }
              };
              
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveAssessment(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? getActiveStyles()
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Assessment Content */}
      <div className="min-h-96">
        {renderAssessmentContent()}
      </div>
    </div>
  );
};

const TreatmentProgressView: React.FC<{ patientId: string }> = ({ patientId }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Treatment Progress</h3>
      <p className="text-gray-500">Treatment progress tracking will be implemented here.</p>
      {/* Implementation for treatment progress tracking */}
    </div>
  );
};

const UpcomingPlansView: React.FC<{ plans: any[] }> = ({ plans }) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Upcoming Treatment Plans</h3>
        </div>
        
        <div className="p-6">
          {plans.length === 0 ? (
            <div className="text-center py-8">
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Plans</h4>
              <p className="text-gray-500">No scheduled treatment plans for this patient.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {plans.map((planItem, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">{planItem.plan.title}</h4>
                  <div className="space-y-2">
                    {planItem.upcomingSteps.map((step: any, stepIndex: number) => (
                      <div key={stepIndex} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{step.title}</span>
                        <span className="text-gray-500">
                          Due: {new Date(step.due_date).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
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

// Utility function
const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

export default PatientProfile;