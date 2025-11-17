import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

export const PatientProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
  const [upcomingPlans, setUpcomingPlans] = useState<any[]>([]);
  const [activeRiskAssessment, setActiveRiskAssessment] = useState<'summary' | 'dvt' | 'pressure' | 'nutrition'>('summary');

  useEffect(() => {
    if (id) {
      loadPatientData();
    }
  }, [id]);

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
        <div className="text-gray-400 text-6xl mb-4">👤</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Patient Not Found</h2>
        <p className="text-gray-600">The patient you're looking for doesn't exist or has been removed.</p>
      </div>
    );
  }

  const tabs = [
    { id: 'summary', name: 'Summary', icon: '📊' },
    { id: 'risk-assessment', name: 'Risk Assessment', icon: '⚕️' },
    { id: 'transfer', name: 'Transfer', icon: '🔄' },
    { id: 'progress', name: 'Progress', icon: '📈' },
    { id: 'plans', name: 'Upcoming Plans', icon: '📅' },
    { id: 'discharge', name: 'Discharge', icon: '🚪' }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'summary':
        return <PatientSummaryView patientId={id!} />;
      
      case 'risk-assessment':
        return <RiskAssessmentView patientId={id!} />;
      
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
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {patient.first_name} {patient.last_name}
                  </h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Hospital #: {patient.hospital_number}</span>
                    <span>•</span>
                    <span>Age: {calculateAge(patient.dob)} years</span>
                    <span>•</span>
                    <span>Sex: {patient.sex}</span>
                    <span>•</span>
                    <span>📞 {patient.phone}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  Active Patient
                </span>
                <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Quick Info */}
          <div className="lg:col-span-1 space-y-6">
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
                {patient.allergies && patient.allergies.length > 0 && (
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

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-4 space-y-2">
                <button 
                  onClick={() => setActiveTab('risk-assessment')}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  ⚕️ Risk Assessment
                </button>
                <button 
                  onClick={() => setActiveTab('transfer')}
                  className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  🔄 Transfer Patient
                </button>
                <button 
                  onClick={() => setActiveTab('discharge')}
                  className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded"
                >
                  🚪 Plan Discharge
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded">
                  📋 Add Progress Note
                </button>
                <button className="w-full text-left px-3 py-2 text-sm text-orange-600 hover:bg-orange-50 rounded">
                  💊 Prescribe Medication
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {tabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <span className="mr-2">{tab.icon}</span>
                      {tab.name}
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
    </div>
  );
};

// Helper Components
const RiskAssessmentView: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [activeAssessment, setActiveAssessment] = useState<'summary' | 'dvt' | 'pressure' | 'nutrition'>('summary');

  const assessmentTabs = [
    { id: 'summary', name: 'Overview', icon: '📊', color: 'gray' },
    { id: 'dvt', name: 'DVT Risk', icon: '🩸', color: 'red' },
    { id: 'pressure', name: 'Pressure Sore', icon: '🛏️', color: 'orange' },
    { id: 'nutrition', name: 'Nutrition', icon: '🍎', color: 'green' }
  ];

  const renderAssessmentContent = () => {
    switch (activeAssessment) {
      case 'summary':
        return <RiskAssessmentSummary patientId={patientId} />;
      case 'dvt':
        return (
          <DVTRiskAssessmentForm 
            patientId={patientId}
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
        return <RiskAssessmentSummary patientId={patientId} />;
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
                  <span className="mr-2">{tab.icon}</span>
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
              <div className="text-gray-400 text-4xl mb-4">📅</div>
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