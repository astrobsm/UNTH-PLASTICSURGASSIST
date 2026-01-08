import React, { useState, useEffect } from 'react';
import { WHOSafetyChecklistForm } from '../components/procedures/WHOSafetyChecklist';
import { IntraoperativeFindingsForm } from '../components/procedures/IntraoperativeFindings';
import { PostoperativeCareForm } from '../components/procedures/PostoperativeCare';
import { WoundCareAssessmentForm } from '../components/procedures/WoundCareAssessment';
import { SurgicalFitnessScoreForm } from '../components/procedures/SurgicalFitnessScore';
import { patientService } from '../services/patientService';

export const Procedures: React.FC = () => {
  const [activeModule, setActiveModule] = useState('overview');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');
  const [patients, setPatients] = useState<any[]>([]);
  const [showNewProcedureModal, setShowNewProcedureModal] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const modules = [
    { id: 'overview', name: 'Overview', icon: '📋', description: 'Procedure management dashboard' },
    { id: 'fitness', name: 'Surgical Fitness Scoring', icon: '📊', description: 'Comprehensive risk scoring system' },
    { id: 'who-checklist', name: 'WHO Safety Checklist', icon: '✅', description: 'World Health Organization safety protocols' },
    { id: 'intraop', name: 'Intraoperative Findings', icon: '🏥', description: 'Surgical procedure documentation' },
    { id: 'postop', name: 'Postoperative Care', icon: '🩺', description: 'Recovery tracking and care plans' },
    { id: 'wound-care', name: 'Wound Care', icon: '🔬', description: 'Wound assessment and management' }
  ];

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'overview':
        return <ProcedureOverview />;
      case 'fitness':
        return (
          <SurgicalFitnessScoreForm 
            patientId={selectedPatientId}
            onComplete={(scoreId) => {
              console.log('Fitness scoring completed:', scoreId);
            }}
          />
        );
      case 'who-checklist':
        return (
          <WHOSafetyChecklistForm 
            procedureId={selectedProcedureId}
            onComplete={(checklistId) => {
              console.log('WHO checklist completed:', checklistId);
            }}
          />
        );
      case 'intraop':
        return (
          <IntraoperativeFindingsForm 
            patientId={selectedPatientId}
            procedureId={selectedProcedureId}
            onComplete={(findingsId) => {
              console.log('Intraoperative findings recorded:', findingsId);
            }}
          />
        );
      case 'postop':
        return (
          <PostoperativeCareForm 
            patientId={selectedPatientId}
            procedureId={selectedProcedureId}
            onComplete={(careId) => {
              console.log('Postoperative care plan created:', careId);
            }}
          />
        );
      case 'wound-care':
        return (
          <WoundCareAssessmentForm 
            patientId={selectedPatientId}
            procedureId={selectedProcedureId}
            onComplete={(assessmentId) => {
              console.log('Wound care assessment completed:', assessmentId);
            }}
          />
        );
      default:
        return <ProcedureOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Surgical Procedures</h1>
                <p className="text-gray-600 mt-1">Comprehensive surgical management and documentation</p>
              </div>
              
              <div className="flex items-center space-x-4">
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select Patient</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} ({patient.hospital_number})
                    </option>
                  ))}
                </select>
                
                <button 
                  onClick={() => setShowNewProcedureModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  + New Procedure
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Module Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Procedure Modules</h3>
              </div>
              
              <div className="p-2">
                {modules.map(module => (
                  <button
                    key={module.id}
                    onClick={() => setActiveModule(module.id)}
                    className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                      activeModule === module.id
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="text-xl">{module.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{module.name}</h4>
                        <p className="text-xs text-gray-500 mt-1">{module.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Today's Procedures</span>
                  <span className="font-semibold text-green-600">5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending WHO Checklists</span>
                  <span className="font-semibold text-orange-600">3</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">High Risk Patients</span>
                  <span className="font-semibold text-red-600">2</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Wound Care Due</span>
                  <span className="font-semibold text-blue-600">7</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {renderModuleContent()}
          </div>
        </div>
      </div>

      {/* New Procedure Modal */}
      {showNewProcedureModal && <NewProcedureModal onClose={() => setShowNewProcedureModal(false)} />}
    </div>
  );
};

// New Procedure Modal Component
const NewProcedureModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    patient_id: '',
    procedure_type: '',
    procedure_name: '',
    scheduled_date: '',
    scheduled_time: '',
    operating_room: '',
    surgeon: '',
    anesthesia_type: '',
    estimated_duration: '',
    urgency: 'elective' as 'elective' | 'urgent' | 'emergency',
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Save procedure logic here
      console.log('New procedure created:', formData);
      onClose();
    } catch (error) {
      console.error('Error creating procedure:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule New Procedure</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Type</label>
              <select
                required
                value={formData.procedure_type}
                onChange={(e) => setFormData({ ...formData, procedure_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select type...</option>
                <option value="reconstructive">Reconstructive Surgery</option>
                <option value="aesthetic">Aesthetic/Cosmetic Surgery</option>
                <option value="hand">Hand Surgery</option>
                <option value="craniofacial">Craniofacial Surgery</option>
                <option value="burn">Burn Surgery</option>
                <option value="microsurgery">Microsurgery</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
              <input
                type="text"
                required
                value={formData.procedure_name}
                onChange={(e) => setFormData({ ...formData, procedure_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="e.g., Breast Reconstruction, Rhinoplasty"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date</label>
                <input
                  type="date"
                  required
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Time</label>
                <input
                  type="time"
                  required
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operating Room</label>
                <input
                  type="text"
                  required
                  value={formData.operating_room}
                  onChange={(e) => setFormData({ ...formData, operating_room: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., OR 1, OR 2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Duration (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  required
                  value={formData.estimated_duration}
                  onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g., 2.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon</label>
              <input
                type="text"
                required
                value={formData.surgeon}
                onChange={(e) => setFormData({ ...formData, surgeon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Primary surgeon name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anesthesia Type</label>
              <select
                required
                value={formData.anesthesia_type}
                onChange={(e) => setFormData({ ...formData, anesthesia_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="">Select anesthesia type...</option>
                <option value="general">General Anesthesia</option>
                <option value="regional">Regional Anesthesia</option>
                <option value="local">Local Anesthesia</option>
                <option value="sedation">Conscious Sedation</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
              <select
                value={formData.urgency}
                onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="elective">Elective</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Additional notes or special requirements..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Schedule Procedure
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Overview Dashboard Component
const ProcedureOverview: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Important Notice */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Preoperative Assessments</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Comprehensive preoperative assessments (including bleeding risk, DVT risk, cardiac risk, and pressure sore assessments) 
                are now managed through the <strong>Scheduling → Surgery Booking</strong> module. 
                Click "Complete Preop Assessment" when booking a surgery to access the full assessment form.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Current Procedures */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Procedures</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {/* Active Procedure Cards */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Abdominoplasty - Jane Smith</h4>
                  <p className="text-sm text-gray-600">Started: 08:30 AM | Estimated completion: 11:30 AM</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">✅ WHO Sign-in Complete</span>
                    <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">⏳ Time-out Pending</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-green-600">In Progress</span>
                  <p className="text-sm text-gray-500">OR 3</p>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">Breast Reconstruction - Mary Johnson</h4>
                  <p className="text-sm text-gray-600">Started: 10:00 AM | Estimated completion: 02:00 PM</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">🔍 Preop Complete</span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">📋 Documentation Pending</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-semibold text-blue-600">Scheduled</span>
                  <p className="text-sm text-gray-500">OR 1</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔍</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Preoperative</h4>
              <p className="text-sm text-gray-600">5 pending assessments</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">WHO Checklists</h4>
              <p className="text-sm text-gray-600">3 incomplete</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🔬</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Wound Care</h4>
              <p className="text-sm text-gray-600">12 active assessments</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Fitness Scoring</h4>
              <p className="text-sm text-gray-600">2 high-risk patients</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🏥</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Intraoperative</h4>
              <p className="text-sm text-gray-600">1 active procedure</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">🩺</span>
            </div>
            <div className="ml-4">
              <h4 className="font-semibold text-gray-900">Postoperative</h4>
              <p className="text-sm text-gray-600">8 patients in recovery</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-sm text-gray-700">WHO Safety Checklist completed for John Doe - Rhinoplasty</span>
              <span className="text-xs text-gray-500">2 minutes ago</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              <span className="text-sm text-gray-700">Preoperative assessment completed for Sarah Wilson</span>
              <span className="text-xs text-gray-500">15 minutes ago</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
              <span className="text-sm text-gray-700">Wound care assessment due for Michael Brown</span>
              <span className="text-xs text-gray-500">1 hour ago</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              <span className="text-sm text-gray-700">High surgical fitness score alert for Patient #0034</span>
              <span className="text-xs text-gray-500">2 hours ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Procedures;