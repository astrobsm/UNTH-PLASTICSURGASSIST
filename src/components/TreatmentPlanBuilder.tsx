import { useState, useEffect } from 'react';
import { Plus, Clock, CheckCircle, AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { offlineDataService } from '../services/offlineDataService';
import { Patient, TreatmentPlan, PlanStep } from '../db/database';
import toast from 'react-hot-toast';

interface TreatmentPlanBuilderProps {
  planId?: number;
}

export default function TreatmentPlanBuilder({ planId }: TreatmentPlanBuilderProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [plan, setPlan] = useState<TreatmentPlan | null>(null);
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pendingCount: 0, lastSync: null, isOnline: true });

  // Form states
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [showNewStepForm, setShowNewStepForm] = useState(false);
  const [newPlan, setNewPlan] = useState({
    title: '',
    diagnosis: '',
    description: '',
    plannedEndDate: ''
  });
  const [newStep, setNewStep] = useState({
    title: '',
    description: '',
    dueDate: '',
    duration: ''
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    loadData();
    loadSyncStatus();
  }, [planId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (planId) {
        const fullPlan = await offlineDataService.getFullTreatmentPlan(planId);
        if (fullPlan) {
          setPlan(fullPlan.plan);
          setSelectedPatient(fullPlan.patient || null);
          setSteps(fullPlan.steps);
        }
      } else {
        const allPatients = await offlineDataService.getPatients();
        setPatients(allPatients);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const status = await offlineDataService.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const createTreatmentPlan = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient first');
      return;
    }

    try {
      const planId = await offlineDataService.createTreatmentPlan({
        patient_id: selectedPatient.id!,
        title: newPlan.title,
        diagnosis: newPlan.diagnosis,
        description: newPlan.description,
        start_date: new Date(),
        planned_end_date: newPlan.plannedEndDate ? new Date(newPlan.plannedEndDate) : undefined
      });

      // Reload the created plan
      const fullPlan = await offlineDataService.getFullTreatmentPlan(planId);
      if (fullPlan) {
        setPlan(fullPlan.plan);
        setSteps(fullPlan.steps);
      }

      setShowNewPlanForm(false);
      setNewPlan({ title: '', diagnosis: '', description: '', plannedEndDate: '' });
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to create treatment plan:', error);
    }
  };

  const addPlanStep = async () => {
    if (!plan) return;

    try {
      await offlineDataService.createPlanStep({
        plan_id: plan.id!,
        title: newStep.title,
        description: newStep.description,
        due_date: newStep.dueDate ? new Date(newStep.dueDate) : undefined,
        duration: newStep.duration ? parseInt(newStep.duration) : undefined
      });

      const updatedSteps = await offlineDataService.getPlanSteps(plan.id!);
      setSteps(updatedSteps);
      
      setShowNewStepForm(false);
      setNewStep({ title: '', description: '', dueDate: '', duration: '' });
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to add step:', error);
    }
  };

  const completeStep = async (stepId: number) => {
    try {
      await offlineDataService.completePlanStep(stepId, 'Completed via web interface');
      const updatedSteps = await offlineDataService.getPlanSteps(plan!.id!);
      setSteps(updatedSteps);
      await loadSyncStatus();
    } catch (error) {
      console.error('Failed to complete step:', error);
    }
  };

  const forceSync = async () => {
    try {
      toast.loading('Syncing data...', { id: 'sync' });
      await offlineDataService.forceSync();
      await loadSyncStatus();
      toast.success('Sync completed', { id: 'sync' });
    } catch (error) {
      toast.error('Sync failed', { id: 'sync' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'clinical-status-completed';
      case 'in_progress': return 'clinical-status-in-progress';
      case 'overdue': return 'clinical-status-overdue';
      default: return 'clinical-status-pending';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with sync status */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-clinical-dark">
          {plan ? 'Treatment Plan Builder' : 'Create Treatment Plan'}
        </h1>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-primary-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-danger-500" />
            )}
            <span className="text-sm text-clinical">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Sync Status */}
          <div className="flex items-center space-x-2">
            <button
              onClick={forceSync}
              className="btn-secondary p-2"
              title="Force Sync"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            {syncStatus.pendingCount > 0 && (
              <span className="bg-danger-100 text-danger-800 px-2 py-1 rounded-full text-xs">
                {syncStatus.pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Empty State - Direct to Patients Page */}
      {patients.length === 0 && !plan && (
        <div className="card p-6 text-center">
          <h3 className="text-lg font-semibold mb-4">No Patients Found</h3>
          <p className="text-clinical mb-4">
            Register a patient first to create a treatment plan.
          </p>
          <a href="/patients" className="btn-primary inline-block">
            Go to Patients Page
          </a>
        </div>
      )}

      {/* Patient Selection */}
      {!plan && patients.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">Select Patient</h3>
          <div className="space-y-2">
            {patients.map((patient) => (
              <div
                key={patient.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedPatient?.id === patient.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPatient(patient)}
              >
                <div className="font-medium">
                  {patient.first_name} {patient.last_name}
                </div>
                <div className="text-sm text-clinical">
                  {patient.hospital_number} • {patient.sex} • {patient.dob}
                </div>
                {!patient.synced && (
                  <span className="inline-flex items-center mt-1 text-xs text-yellow-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Not synced
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Treatment Plan Form */}
      {selectedPatient && !plan && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              Create Treatment Plan for {selectedPatient.first_name} {selectedPatient.last_name}
            </h3>
            <button
              onClick={() => setShowNewPlanForm(!showNewPlanForm)}
              className="btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </button>
          </div>

          {showNewPlanForm && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={newPlan.title}
                  onChange={(e) => setNewPlan({ ...newPlan, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Left Leg Skin Graft Treatment"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Diagnosis</label>
                <input
                  type="text"
                  value={newPlan.diagnosis}
                  onChange={(e) => setNewPlan({ ...newPlan, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Chronic wound - left lower limb"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={newPlan.description}
                  onChange={(e) => setNewPlan({ ...newPlan, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                  placeholder="Treatment plan description..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Planned End Date</label>
                <input
                  type="date"
                  value={newPlan.plannedEndDate}
                  onChange={(e) => setNewPlan({ ...newPlan, plannedEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="flex space-x-3">
                <button onClick={createTreatmentPlan} className="btn-primary">
                  Create Plan
                </button>
                <button
                  onClick={() => setShowNewPlanForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Treatment Plan Display */}
      {plan && (
        <div className="space-y-6">
          {/* Plan Header */}
          <div className="card p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">{plan.title}</h2>
                <p className="text-clinical mb-2">{plan.diagnosis}</p>
                {plan.description && (
                  <p className="text-sm text-gray-600">{plan.description}</p>
                )}
                <div className="flex items-center mt-3 space-x-4 text-sm text-clinical">
                  <span>Status: <span className={getStatusColor(plan.status)}>{plan.status}</span></span>
                  <span>Started: {plan.start_date.toLocaleDateString()}</span>
                  {plan.planned_end_date && (
                    <span>Target: {plan.planned_end_date.toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              
              {!plan.synced && (
                <div className="flex items-center text-yellow-600">
                  <Clock className="h-4 w-4 mr-1" />
                  <span className="text-sm">Not synced</span>
                </div>
              )}
            </div>
          </div>

          {/* Plan Steps */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Treatment Steps</h3>
              <button
                onClick={() => setShowNewStepForm(!showNewStepForm)}
                className="btn-primary"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Step
              </button>
            </div>

            {/* Add Step Form */}
            {showNewStepForm && (
              <div className="space-y-4 border-b pb-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Step Title</label>
                  <input
                    type="text"
                    value={newStep.title}
                    onChange={(e) => setNewStep({ ...newStep, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., Pre-operative Assessment"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={newStep.description}
                    onChange={(e) => setNewStep({ ...newStep, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                    placeholder="Step description..."
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={newStep.dueDate}
                      onChange={(e) => setNewStep({ ...newStep, dueDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                    <input
                      type="number"
                      value={newStep.duration}
                      onChange={(e) => setNewStep({ ...newStep, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="60"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-3">
                  <button onClick={addPlanStep} className="btn-primary">
                    Add Step
                  </button>
                  <button
                    onClick={() => setShowNewStepForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Steps List */}
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-700">
                        {step.step_number}
                      </span>
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-medium">{step.title}</h4>
                      {step.description && (
                        <p className="text-sm text-clinical mt-1">{step.description}</p>
                      )}
                      <div className="flex items-center mt-2 space-x-4 text-xs text-clinical">
                        {step.due_date && (
                          <span>Due: {step.due_date.toLocaleDateString()}</span>
                        )}
                        {step.duration && (
                          <span>Duration: {step.duration}min</span>
                        )}
                        {step.completed_at && (
                          <span>Completed: {step.completed_at.toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={getStatusColor(step.status)}>
                      {step.status.replace('_', ' ')}
                    </span>
                    
                    {!step.synced && (
                      <Clock className="h-4 w-4 text-yellow-500" title="Not synced" />
                    )}
                    
                    {step.status !== 'completed' && (
                      <button
                        onClick={() => completeStep(step.id!)}
                        className="btn-primary text-xs px-2 py-1"
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {steps.length === 0 && (
                <div className="text-center py-8 text-clinical">
                  No steps added yet. Click "Add Step" to create the first step.
                </div>
              )}
            </div>
          </div>

          {/* Offline Demo Instructions */}
          <div className="card p-6 bg-blue-50 border-blue-200">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">Offline Demo</h4>
                <p className="text-sm text-blue-700 mt-1">
                  To test offline functionality: Open DevTools → Network tab → Set to "Offline" mode. 
                  Then add steps or complete existing ones. Changes will be queued and sync when you go back online.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}