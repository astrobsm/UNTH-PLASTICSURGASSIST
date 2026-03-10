import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Plus, 
  User, 
  Activity,
  FileText,
  Pill,
  LogOut,
  ChevronDown,
  ChevronUp,
  TestTube,
  RefreshCw,
  Brain,
  Mic
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { 
  treatmentPlanningService, 
  EnhancedTreatmentPlan,
  TreatmentPlanReview,
  LabWork,
  PlannedProcedure,
  MedicationAdministration,
  DischargeTimeline
} from '../services/treatmentPlanningService';
import { useAuthStore } from '../store/authStore';
import { InvestigationOrderingModal } from '../components/InvestigationOrderingModal';
import { MedicationOrderingModal } from '../components/MedicationOrderingModal';
import { dataSyncService } from '../services/dataSyncService';
import { ScribeRecordingPanel } from '../components/ScribeRecordingPanel';
import { medicalScribeService, StructuredNote, ScribeSession } from '../services/medicalScribeService';
import toast from 'react-hot-toast';

export default function TreatmentPlanningEnhanced() {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [treatmentPlans, setTreatmentPlans] = useState<EnhancedTreatmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EnhancedTreatmentPlan | null>(null);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [expandedSections, setExpandedSections] = useState({
    reviews: true,
    labs: true,
    procedures: true,
    medications: true,
    discharge: true
  });

  // New Plan Form State
  const [newPlan, setNewPlan] = useState({
    patient_id: '',
    diagnosis: '',
    admission_date: format(new Date(), 'yyyy-MM-dd'),
    planned_discharge_date: '',
    primary_consultant: '',
    notes: ''
  });

  // Review Form State
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [newReview, setNewReview] = useState({
    review_date: '',
    house_officer: '',
    review_notes: ''
  });
  const [showReviewScribe, setShowReviewScribe] = useState(false);

  // Lab Work Form State
  const [showLabModal, setShowLabModal] = useState(false);
  const [newLab, setNewLab] = useState({
    test_name: '',
    frequency: 'once' as 'once' | 'daily' | 'weekly' | 'monthly',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    notes: ''
  });

  // Procedure Form State
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [newProcedure, setNewProcedure] = useState({
    procedure_name: '',
    planned_date: '',
    surgeon: '',
    notes: ''
  });

  // Medication Form State
  const [showMedicationModal, setShowMedicationModal] = useState(false);
  const [newMedication, setNewMedication] = useState({
    medication_name: '',
    dosage: '',
    route: '',
    frequency: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    prescribing_doctor: user?.name || ''
  });

  // Discharge Form State
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeTimeline, setDischargeTimeline] = useState({
    planned_date: '',
    criteria_met: [] as string[],
    pending_requirements: [] as string[]
  });

  // Investigation and Medication Ordering Modals
  const [showInvestigationOrderingModal, setShowInvestigationOrderingModal] = useState(false);
  const [showMedicationOrderingModal, setShowMedicationOrderingModal] = useState(false);
  const [orderedInvestigations, setOrderedInvestigations] = useState<any[]>([]);
  const [orderedMedications, setOrderedMedications] = useState<any[]>([]);
  // Server-side lab orders for the selected patient
  const [serverLabOrders, setServerLabOrders] = useState<any[]>([]);

  useEffect(() => {
    loadPatients();
    // Trigger initial sync on component mount
    handleSync();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadTreatmentPlans();
    }
  }, [selectedPatient]);

  // Real-time sync: Refresh every 30 seconds when online
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (navigator.onLine && !isSyncing && selectedPatient) {
        loadTreatmentPlans();
      }
    }, 30000); // 30 seconds

    // Also refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && selectedPatient) {
        handleSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(syncInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedPatient, isSyncing]);

  // Sync data with server
  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await dataSyncService.performFullSync();
      if (selectedPatient) {
        await loadTreatmentPlans();
      }
      setLastSyncTime(new Date());
      // Silent sync - don't show toast for automatic syncs
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual sync with toast notification
  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await dataSyncService.performFullSync();
      if (selectedPatient) {
        await loadTreatmentPlans();
      }
      setLastSyncTime(new Date());
      toast.success('Data synced successfully!', { duration: 2000 });
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Sync failed. Please try again.', { duration: 3000 });
    } finally {
      setIsSyncing(false);
    }
  };

  const loadPatients = async () => {
    const allPatients = await patientService.getAllPatients();
    setPatients(allPatients);
  };

  const loadTreatmentPlans = async () => {
    try {
      const plans = await treatmentPlanningService.getPatientTreatmentPlans(selectedPatient);
      setTreatmentPlans(plans);
      if (plans.length > 0) {
        setSelectedPlan(plans[0]);
      } else {
        setSelectedPlan(null);
      }
      // Also fetch lab orders from server for this patient
      await loadServerLabOrders(selectedPatient);
    } catch (error) {
      console.error('Error loading treatment plans:', error);
      setTreatmentPlans([]);
      setSelectedPlan(null);
    }
  };

  // Fetch lab orders from the server lab_orders table for the patient
  const loadServerLabOrders = async (patientId: string) => {
    if (!patientId || !navigator.onLine) {
      setServerLabOrders([]);
      return;
    }
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const response = await fetch(`/api/lab-orders?patientId=${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setServerLabOrders(data.labOrders || []);
      }
    } catch (error) {
      console.warn('Could not fetch lab orders from server:', error);
    }
  };

  // Reload the currently selected plan from local DB after mutations (add review, lab, etc.)
  // This avoids the server fetch which would overwrite locally-added data
  const reloadSelectedPlan = async () => {
    if (!selectedPlan) return;
    try {
      const updatedPlan = await treatmentPlanningService.getTreatmentPlan(selectedPlan.id);
      if (updatedPlan) {
        const planWithDefaults = {
          ...updatedPlan,
          id: updatedPlan.id?.toString() || selectedPlan.id,
          reviews: updatedPlan.reviews || [],
          lab_works: updatedPlan.lab_works || [],
          procedures: updatedPlan.procedures || [],
          medications: updatedPlan.medications || [],
          discharge_timeline: updatedPlan.discharge_timeline || null
        };
        setSelectedPlan(planWithDefaults as any);
        setTreatmentPlans(prev => prev.map(p => 
          String(p.id) === String(selectedPlan.id) ? (planWithDefaults as any) : p
        ));
      }
    } catch (error) {
      console.error('Error reloading plan:', error);
      // Fallback to full reload
      loadTreatmentPlans();
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.patient_id || !newPlan.diagnosis || !newPlan.planned_discharge_date) {
      alert('Please fill in all required fields');
      return;
    }

    // Look up patient info
    const patient = patients.find(p => String(p.id) === String(newPlan.patient_id));
    const patientName = patient ? `${patient.first_name} ${patient.last_name}` : '';
    const hospitalNumber = patient?.hospital_number || '';

    await treatmentPlanningService.createTreatmentPlan({
      patient_id: newPlan.patient_id,
      patient_name: patientName,
      hospital_number: hospitalNumber,
      diagnosis: newPlan.diagnosis,
      title: newPlan.diagnosis,
      admission_date: new Date(newPlan.admission_date),
      planned_discharge_date: new Date(newPlan.planned_discharge_date),
      primary_consultant: newPlan.primary_consultant,
      created_by: user?.id || 'unknown',
      notes: newPlan.notes
    });

    setShowNewPlanModal(false);
    // Switch to the patient we just created a plan for
    if (String(selectedPatient) !== String(newPlan.patient_id)) {
      setSelectedPatient(String(newPlan.patient_id));
    }
    setNewPlan({
      patient_id: '',
      diagnosis: '',
      admission_date: format(new Date(), 'yyyy-MM-dd'),
      planned_discharge_date: '',
      primary_consultant: '',
      notes: ''
    });
    // Small delay to let DB write complete
    setTimeout(() => loadTreatmentPlans(), 300);
  };

  const handleAddReview = async () => {
    if (!selectedPlan || !newReview.review_date || !newReview.house_officer) {
      alert('Please fill in all required fields');
      return;
    }

    await treatmentPlanningService.addReview(selectedPlan.id, {
      review_date: new Date(newReview.review_date),
      house_officer: newReview.house_officer,
      review_notes: newReview.review_notes
    });

    setShowReviewModal(false);
    setNewReview({ review_date: '', house_officer: '', review_notes: '' });
    // Reload the updated plan directly from local DB to reflect the new review immediately
    const updatedPlan = await treatmentPlanningService.getTreatmentPlan(selectedPlan.id);
    if (updatedPlan) {
      setSelectedPlan(updatedPlan as any);
      // Also update the plans list
      setTreatmentPlans(prev => prev.map(p => p.id === selectedPlan.id ? (updatedPlan as any) : p));
    } else {
      loadTreatmentPlans();
    }
  };

  const handleCompleteReview = async (reviewId: string, notes: string, delayReason?: string) => {
    if (!selectedPlan) return;

    await treatmentPlanningService.completeReview(
      selectedPlan.id,
      reviewId,
      user?.id || 'unknown',
      notes,
      delayReason
    );

    await reloadSelectedPlan();
  };

  const handleAddLab = async () => {
    if (!selectedPlan || !newLab.test_name || !newLab.start_date) {
      alert('Please fill in all required fields');
      return;
    }

    await treatmentPlanningService.addLabWork(selectedPlan.id, {
      test_name: newLab.test_name,
      frequency: newLab.frequency,
      start_date: new Date(newLab.start_date),
      end_date: newLab.end_date ? new Date(newLab.end_date) : undefined,
      notes: newLab.notes
    });

    setShowLabModal(false);
    setNewLab({
      test_name: '',
      frequency: 'once',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      notes: ''
    });
    await reloadSelectedPlan();
  };

  const handleAddProcedure = async () => {
    if (!selectedPlan || !newProcedure.procedure_name || !newProcedure.planned_date) {
      alert('Please fill in all required fields');
      return;
    }

    await treatmentPlanningService.addProcedure(selectedPlan.id, {
      procedure_name: newProcedure.procedure_name,
      planned_date: new Date(newProcedure.planned_date),
      surgeon: newProcedure.surgeon,
      notes: newProcedure.notes
    });

    setShowProcedureModal(false);
    setNewProcedure({ procedure_name: '', planned_date: '', surgeon: '', notes: '' });
    await reloadSelectedPlan();
  };

  const handleCompleteProcedure = async (procedureId: string, actualDate: string, delayReason?: string) => {
    if (!selectedPlan) return;

    await treatmentPlanningService.completeProcedure(
      selectedPlan.id,
      procedureId,
      new Date(actualDate),
      delayReason
    );

    await reloadSelectedPlan();
  };

  const handleAddMedication = async () => {
    if (!selectedPlan || !newMedication.medication_name || !newMedication.dosage) {
      alert('Please fill in all required fields');
      return;
    }

    await treatmentPlanningService.addMedication(selectedPlan.id, {
      medication_name: newMedication.medication_name,
      dosage: newMedication.dosage,
      route: newMedication.route,
      frequency: newMedication.frequency,
      start_date: new Date(newMedication.start_date),
      end_date: newMedication.end_date ? new Date(newMedication.end_date) : undefined,
      prescribing_doctor: newMedication.prescribing_doctor
    });

    setShowMedicationModal(false);
    setNewMedication({
      medication_name: '',
      dosage: '',
      route: '',
      frequency: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      prescribing_doctor: user?.name || ''
    });
    await reloadSelectedPlan();
  };

  const handleSetDischarge = async () => {
    if (!selectedPlan || !dischargeTimeline.planned_date) {
      alert('Please set a planned discharge date');
      return;
    }

    await treatmentPlanningService.setDischargeTimeline(selectedPlan.id, {
      planned_date: new Date(dischargeTimeline.planned_date),
      criteria_met: dischargeTimeline.criteria_met,
      pending_requirements: dischargeTimeline.pending_requirements
    });

    setShowDischargeModal(false);
    await reloadSelectedPlan();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const getOverdueItems = () => {
    if (!selectedPlan) return { reviews: [], procedures: [], medications: [] };
    return treatmentPlanningService.getOverdueItems(selectedPlan);
  };

  const overdueItems = getOverdueItems();

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Treatment Planning</h1>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">
              Last synced: {format(lastSyncTime, 'HH:mm:ss')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              isSyncing 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={() => setShowNewPlanModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Treatment Plan
          </button>
        </div>
      </div>

      {/* Patient Selection */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Patient
        </label>
        <select
          value={selectedPatient}
          onChange={(e) => setSelectedPatient(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">-- Select Patient --</option>
          {patients.map(patient => (
            <option key={patient.id} value={patient.id}>
              {patient.first_name} {patient.last_name} ({patient.hospital_number})
            </option>
          ))}
        </select>
      </div>

      {/* Overdue Alerts */}
      {(overdueItems.reviews.length > 0 || overdueItems.procedures.length > 0 || overdueItems.medications.length > 0) && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">Overdue Items</h3>
          </div>
          {overdueItems.reviews.length > 0 && (
            <p className="text-red-700 text-sm">• {overdueItems.reviews.length} overdue review(s)</p>
          )}
          {overdueItems.procedures.length > 0 && (
            <p className="text-red-700 text-sm">• {overdueItems.procedures.length} overdue procedure(s)</p>
          )}
          {overdueItems.medications.length > 0 && (
            <p className="text-red-700 text-sm">• {overdueItems.medications.length} overdue medication(s)</p>
          )}
        </div>
      )}

      {/* Treatment Plan Details */}
      {selectedPlan && (
        <div className="space-y-6">
          {/* Plan Overview */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedPlan.diagnosis || selectedPlan.title || 'Treatment Plan'}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Admission:</span>{' '}
                <span className="font-medium">
                  {selectedPlan.admission_date 
                    ? format(new Date(selectedPlan.admission_date), 'MMM d, yyyy') 
                    : 'Not set'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Planned Discharge:</span>{' '}
                <span className="font-medium">
                  {(selectedPlan as any).planned_discharge_date 
                    ? format(new Date((selectedPlan as any).planned_discharge_date), 'MMM d, yyyy') 
                    : 'Not set'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Consultant:</span>{' '}
                <span className="font-medium">{(selectedPlan as any).primary_consultant || 'Not assigned'}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>{' '}
                <span className={`font-medium ${selectedPlan.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                  {(selectedPlan.status || 'draft').charAt(0).toUpperCase() + (selectedPlan.status || 'draft').slice(1)}
                </span>
              </div>
              {selectedPlan.patient_name && (
                <div>
                  <span className="text-gray-600">Patient:</span>{' '}
                  <span className="font-medium">{selectedPlan.patient_name}</span>
                </div>
              )}
              {selectedPlan.hospital_number && (
                <div>
                  <span className="text-gray-600">Hospital No:</span>{' '}
                  <span className="font-medium">{selectedPlan.hospital_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Reviews Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex flex-wrap justify-between items-center cursor-pointer hover:bg-gray-50 gap-2"
              onClick={() => toggleSection('reviews')}
            >
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Reviews ({selectedPlan.reviews?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReviewModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap shadow-sm"
                >
                  Add Review
                </button>
                {expandedSections.reviews ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            {expandedSections.reviews && (
              <div className="p-4 border-t space-y-3">
                {selectedPlan.reviews?.map((review) => (
                  <div key={review.id} className={`p-3 rounded-lg ${review.status === 'overdue' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">
                          {review.review_date 
                            ? format(new Date(review.review_date), 'MMM d, yyyy')
                            : 'Date not set'}
                        </div>
                        <div className="text-sm text-gray-600">
                          House Officer: {(review as any).house_officer || review.assigned_house_officer || review.assigned_to || 'Unassigned'}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        review.status === 'completed' ? 'bg-green-100 text-green-800' :
                        review.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {review.status}
                      </span>
                    </div>
                    {((review as any).review_notes || review.notes) && (
                      <p className="text-sm text-gray-700 mb-2">{(review as any).review_notes || review.notes}</p>
                    )}
                    {review.status === 'pending' && (
                      <button
                        onClick={() => {
                          const notes = prompt('Enter review notes:');
                          if (notes !== null) {
                            let delayReason;
                            const reviewDate = review.scheduled_date || review.review_date;
                            const daysDiff = reviewDate ? differenceInDays(new Date(), new Date(reviewDate)) : 0;
                            if (daysDiff > 0) {
                              delayReason = prompt('This review is delayed. Please provide a reason:');
                            }
                            handleCompleteReview(review.id, notes, delayReason || undefined);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Complete Review
                      </button>
                    )}
                    {((review as any).delay_days && (review as any).delay_days > 0) && (
                      <div className="mt-2 text-sm text-red-600">
                        Delayed by {(review as any).delay_days} day(s)
                        {review.delay_reason && `: ${review.delay_reason}`}
                      </div>
                    )}
                  </div>
                ))}
                {(!selectedPlan.reviews || selectedPlan.reviews.length === 0) && (
                  <p className="text-gray-500 text-sm">No reviews scheduled</p>
                )}
              </div>
            )}
          </div>

          {/* Lab Works Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex flex-wrap justify-between items-center cursor-pointer hover:bg-gray-50 gap-2"
              onClick={() => toggleSection('labs')}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Lab Works ({(selectedPlan.lab_works?.length || 0) + serverLabOrders.length})</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Order & Track clicked');
                    setShowInvestigationOrderingModal(true);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1 whitespace-nowrap shadow-sm pointer-events-auto"
                >
                  <TestTube className="w-4 h-4" />
                  Order & Track
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Add Lab clicked');
                    setShowLabModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap shadow-sm pointer-events-auto"
                >
                  Add Lab
                </button>
                {expandedSections.labs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            {expandedSections.labs && (
              <div className="p-4 border-t space-y-3">
                {/* Local lab_works from the treatment plan */}
                {selectedPlan.lab_works?.map((lab) => (
                  <div key={lab.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{lab.test_type || 'Lab Test'}</div>
                        <div className="text-sm text-gray-600">
                          Frequency: {lab.frequency || 'once'}
                          {lab.timeline_start && 
                            ` | Start: ${format(new Date(lab.timeline_start), 'MMM d, yyyy')}`}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${lab.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800'}`}>
                        {lab.status || 'active'}
                      </span>
                    </div>
                    {lab.results && lab.results.length > 0 && <p className="text-sm text-gray-700">{lab.results[lab.results.length - 1].notes || lab.results[lab.results.length - 1].result}</p>}
                  </div>
                ))}

                {/* Server lab_orders for this patient */}
                {serverLabOrders.map((order) => (
                  <div key={`server-${order.id}`} className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{order.test_name || order.test_type || 'Lab Order'}</div>
                        <div className="text-sm text-gray-600">
                          Priority: {order.priority || 'routine'}
                          {order.ordered_at && ` | Ordered: ${format(new Date(order.ordered_at), 'MMM d, yyyy')}`}
                        </div>
                        {order.clinical_notes && <p className="text-sm text-gray-600 mt-1">{order.clinical_notes}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Lab Order</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' : 
                          order.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status || 'pending'}
                        </span>
                      </div>
                    </div>
                    {order.results && (
                      <div className="mt-2 p-2 bg-white rounded border text-sm">
                        <span className="font-medium text-gray-700">Results: </span>
                        <span className="text-gray-900">{typeof order.results === 'string' ? order.results : JSON.stringify(order.results)}</span>
                      </div>
                    )}
                  </div>
                ))}

                {(!selectedPlan.lab_works || selectedPlan.lab_works.length === 0) && serverLabOrders.length === 0 && (
                  <p className="text-gray-500 text-sm">No lab works ordered</p>
                )}
              </div>
            )}
          </div>

          {/* Procedures Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex flex-wrap justify-between items-center cursor-pointer hover:bg-gray-50 gap-2"
              onClick={() => toggleSection('procedures')}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Procedures ({selectedPlan.procedures?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Add Procedure clicked');
                    setShowProcedureModal(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap shadow-sm pointer-events-auto"
                >
                  Add Procedure
                </button>
                {expandedSections.procedures ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            {expandedSections.procedures && (
              <div className="p-4 border-t space-y-3">
                {selectedPlan.procedures?.map((procedure) => (
                  <div key={procedure.id} className={`p-3 rounded-lg ${procedure.status === 'overdue' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{procedure.procedure_name || 'Procedure'}</div>
                        <div className="text-sm text-gray-600">
                          Planned: {(procedure.planned_date || procedure.proposed_date)
                            ? format(new Date(procedure.planned_date || procedure.proposed_date), 'MMM d, yyyy')
                            : 'Not set'}
                          {procedure.surgeon && ` | Surgeon: ${procedure.surgeon}`}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        procedure.status === 'completed' ? 'bg-green-100 text-green-800' :
                        procedure.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {procedure.status || 'planned'}
                      </span>
                    </div>
                    {procedure.notes && <p className="text-sm text-gray-700 mb-2">{procedure.notes}</p>}
                    {(procedure.status === 'planned' || !procedure.status) && (
                      <button
                        onClick={() => {
                          const actualDate = prompt('Enter actual procedure date (YYYY-MM-DD):');
                          if (actualDate) {
                            const proposedDate = procedure.planned_date || procedure.proposed_date;
                            const daysDiff = proposedDate ? differenceInDays(new Date(actualDate), new Date(proposedDate)) : 0;
                            let delayReason;
                            if (daysDiff > 0) {
                              delayReason = prompt('This procedure is delayed. Please provide a reason:');
                            }
                            handleCompleteProcedure(procedure.id, actualDate, delayReason || undefined);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
                      >
                        Mark Completed
                      </button>
                    )}
                    {procedure.delay_days && procedure.delay_days > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        Delayed by {procedure.delay_days} day(s)
                        {procedure.delay_reason && `: ${procedure.delay_reason}`}
                      </div>
                    )}
                  </div>
                ))}
                {(!selectedPlan.procedures || selectedPlan.procedures.length === 0) && (
                  <p className="text-gray-500 text-sm">No procedures planned</p>
                )}
              </div>
            )}
          </div>

          {/* Medications Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex flex-wrap justify-between items-center cursor-pointer hover:bg-gray-50 gap-2"
              onClick={() => toggleSection('medications')}
            >
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-pink-600" />
                <h3 className="font-semibold text-gray-900">Medications ({selectedPlan.medications?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 relative z-10 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Order Medications clicked');
                    setShowMedicationOrderingModal(true);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center gap-1 whitespace-nowrap shadow-sm pointer-events-auto"
                >
                  <Pill className="w-4 h-4" />
                  Order Medications
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Add Medication clicked');
                    setShowMedicationModal(true);
                  }}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-3 py-1 rounded text-sm whitespace-nowrap shadow-sm pointer-events-auto"
                >
                  Add Medication
                </button>
                {expandedSections.medications ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            {expandedSections.medications && (
              <div className="p-4 border-t space-y-3">
                {selectedPlan.medications?.map((med) => (
                  <div key={med.id} className={`p-3 rounded-lg ${med.status === 'overdue' ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{med.medication_name || 'Medication'}</div>
                        <div className="text-sm text-gray-600">
                          {[med.dosage, med.route, med.frequency].filter(Boolean).join(' ') || 'No details'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {(med.start_date || med.timeline_start) 
                            ? `Start: ${format(new Date(med.start_date || med.timeline_start), 'MMM d, yyyy')}` 
                            : ''}
                          {(med.end_date || med.timeline_end) 
                            ? ` | End: ${format(new Date(med.end_date || med.timeline_end), 'MMM d, yyyy')}` 
                            : ''}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        med.status === 'completed' ? 'bg-green-100 text-green-800' :
                        med.status === 'discontinued' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {med.status || 'active'}
                      </span>
                    </div>
                    {med.prescribing_doctor && (
                      <div className="text-sm text-gray-600">Prescribed by: {med.prescribing_doctor}</div>
                    )}
                  </div>
                ))}
                {(!selectedPlan.medications || selectedPlan.medications.length === 0) && (
                  <p className="text-gray-500 text-sm">No medications prescribed</p>
                )}
              </div>
            )}
          </div>

          {/* Discharge Timeline Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('discharge')}
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-indigo-600" />
                <h3 className="font-semibold text-gray-900">Discharge Timeline</h3>
              </div>
              <div className="flex items-center gap-2">
                {!selectedPlan.discharge_timeline && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDischargeModal(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Set Discharge
                  </button>
                )}
                {expandedSections.discharge ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            {expandedSections.discharge && (
              <div className="p-4 border-t">
                {selectedPlan.discharge_timeline ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <span className="text-sm text-gray-600">Planned Date:</span>
                          <div className="font-medium">
                            {(selectedPlan.discharge_timeline.planned_date || (selectedPlan.discharge_timeline as any).proposed_discharge_date) 
                              ? format(new Date(selectedPlan.discharge_timeline.planned_date || (selectedPlan.discharge_timeline as any).proposed_discharge_date), 'MMM d, yyyy')
                              : 'Not set'}
                          </div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Status:</span>
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              selectedPlan.discharge_timeline.status === 'ready' ? 'bg-green-100 text-green-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {selectedPlan.discharge_timeline.status || 'planned'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {(selectedPlan.discharge_timeline.criteria_met || []).length > 0 && (
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">Criteria Met:</div>
                          <ul className="list-disc list-inside text-sm text-gray-600">
                            {(selectedPlan.discharge_timeline.criteria_met || []).map((criteria: string, idx: number) => (
                              <li key={idx}>{criteria}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(selectedPlan.discharge_timeline.pending_requirements || []).length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Pending Requirements:</div>
                          <ul className="list-disc list-inside text-sm text-red-600">
                            {(selectedPlan.discharge_timeline.pending_requirements || []).map((req: string, idx: number) => (
                              <li key={idx}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(selectedPlan.discharge_timeline as any).delay_days > 0 && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                          <div className="text-sm font-medium text-red-900">
                            Discharge Delayed by {(selectedPlan.discharge_timeline as any).delay_days} day(s)
                          </div>
                          {((selectedPlan.discharge_timeline as any).delay_reasons || []).map((reason: string, idx: number) => (
                            <div key={idx} className="text-sm text-red-700 mt-1">• {reason}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No discharge timeline set</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Plan Modal */}
      {showNewPlanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Create New Treatment Plan</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                <select
                  value={newPlan.patient_id}
                  onChange={(e) => setNewPlan({ ...newPlan, patient_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">-- Select Patient --</option>
                  {patients.map(patient => (
                    <option key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} ({patient.hospital_number})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                <input
                  type="text"
                  value={newPlan.diagnosis}
                  onChange={(e) => setNewPlan({ ...newPlan, diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date *</label>
                  <input
                    type="date"
                    value={newPlan.admission_date}
                    onChange={(e) => setNewPlan({ ...newPlan, admission_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Planned Discharge Date *</label>
                  <input
                    type="date"
                    value={newPlan.planned_discharge_date}
                    onChange={(e) => setNewPlan({ ...newPlan, planned_discharge_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Consultant</label>
                <input
                  type="text"
                  value={newPlan.primary_consultant}
                  onChange={(e) => setNewPlan({ ...newPlan, primary_consultant: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newPlan.notes}
                  onChange={(e) => setNewPlan({ ...newPlan, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowNewPlanModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePlan}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Create Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Review</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Date *</label>
                <input
                  type="date"
                  value={newReview.review_date}
                  onChange={(e) => setNewReview({ ...newReview, review_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">House Officer *</label>
                <input
                  type="text"
                  value={newReview.house_officer}
                  onChange={(e) => setNewReview({ ...newReview, house_officer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => setShowReviewScribe(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md hover:bg-indigo-100 text-xs font-medium"
                    title="Dictate review notes with AI Scribe"
                  >
                    <Brain className="w-3 h-3" />
                    <Mic className="w-3 h-3" />
                    Dictate with AI Scribe
                  </button>
                </div>
                <textarea
                  value={newReview.review_notes}
                  onChange={(e) => setNewReview({ ...newReview, review_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Type or dictate review notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddReview}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lab Modal */}
      {showLabModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Lab Work</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name *</label>
                <input
                  type="text"
                  value={newLab.test_name}
                  onChange={(e) => setNewLab({ ...newLab, test_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                <select
                  value={newLab.frequency}
                  onChange={(e) => setNewLab({ ...newLab, frequency: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newLab.start_date}
                    onChange={(e) => setNewLab({ ...newLab, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newLab.end_date}
                    onChange={(e) => setNewLab({ ...newLab, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newLab.notes}
                  onChange={(e) => setNewLab({ ...newLab, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowLabModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLab}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Add Lab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Procedure Modal */}
      {showProcedureModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Procedure</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name *</label>
                <input
                  type="text"
                  value={newProcedure.procedure_name}
                  onChange={(e) => setNewProcedure({ ...newProcedure, procedure_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planned Date *</label>
                <input
                  type="date"
                  value={newProcedure.planned_date}
                  onChange={(e) => setNewProcedure({ ...newProcedure, planned_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon</label>
                <input
                  type="text"
                  value={newProcedure.surgeon}
                  onChange={(e) => setNewProcedure({ ...newProcedure, surgeon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newProcedure.notes}
                  onChange={(e) => setNewProcedure({ ...newProcedure, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowProcedureModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProcedure}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                Add Procedure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Medication Modal */}
      {showMedicationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Add Medication</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name *</label>
                <input
                  type="text"
                  value={newMedication.medication_name}
                  onChange={(e) => setNewMedication({ ...newMedication, medication_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage *</label>
                  <input
                    type="text"
                    value={newMedication.dosage}
                    onChange={(e) => setNewMedication({ ...newMedication, dosage: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., 500mg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                  <input
                    type="text"
                    value={newMedication.route}
                    onChange={(e) => setNewMedication({ ...newMedication, route: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="e.g., PO, IV"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <input
                  type="text"
                  value={newMedication.frequency}
                  onChange={(e) => setNewMedication({ ...newMedication, frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., TID, BID, QD"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={newMedication.start_date}
                    onChange={(e) => setNewMedication({ ...newMedication, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={newMedication.end_date}
                    onChange={(e) => setNewMedication({ ...newMedication, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prescribing Doctor</label>
                <input
                  type="text"
                  value={newMedication.prescribing_doctor}
                  onChange={(e) => setNewMedication({ ...newMedication, prescribing_doctor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowMedicationModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMedication}
                className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700"
              >
                Add Medication
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discharge Modal */}
      {showDischargeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Set Discharge Timeline</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Planned Discharge Date *</label>
                <input
                  type="date"
                  value={dischargeTimeline.planned_date}
                  onChange={(e) => setDischargeTimeline({ ...dischargeTimeline, planned_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Criteria Met (one per line)</label>
                <textarea
                  value={dischargeTimeline.criteria_met.join('\n')}
                  onChange={(e) => setDischargeTimeline({ 
                    ...dischargeTimeline, 
                    criteria_met: e.target.value.split('\n').filter(s => s.trim()) 
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Pain controlled&#10;Vital signs stable&#10;Wound healing well"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pending Requirements (one per line)</label>
                <textarea
                  value={dischargeTimeline.pending_requirements.join('\n')}
                  onChange={(e) => setDischargeTimeline({ 
                    ...dischargeTimeline, 
                    pending_requirements: e.target.value.split('\n').filter(s => s.trim()) 
                  })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="e.g., Final lab results&#10;Discharge medications&#10;Follow-up appointment"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setShowDischargeModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSetDischarge}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Set Discharge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Investigation Ordering Modal */}
      {showInvestigationOrderingModal && selectedPlan && patients.find(p => p.id === selectedPatient) && (
        <InvestigationOrderingModal
          patientId={selectedPatient}
          patientName={(() => {
            const patient = patients.find(p => p.id === selectedPatient);
            return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
          })()}
          patientGender={(() => {
            const patient = patients.find(p => p.id === selectedPatient);
            return patient?.sex as 'male' | 'female' || 'male';
          })()}
          source="treatment_plan"
          existingInvestigations={orderedInvestigations}
          onSave={async (investigations) => {
            setOrderedInvestigations(investigations);
            // Save each investigation as a lab work entry on the treatment plan
            if (selectedPlan) {
              for (const inv of investigations) {
                await treatmentPlanningService.addLabWork(selectedPlan.id, {
                  test_type: inv.test_name || 'Investigation',
                  patient_id: selectedPatient,
                  frequency: 'once' as const,
                  timeline_start: new Date(),
                  scheduled_dates: [inv.ordered_date || new Date()],
                  completed_dates: [],
                  status: 'active'
                });
              }
              await reloadSelectedPlan();
              await loadServerLabOrders(selectedPatient);
              toast.success(`${investigations.length} investigation(s) added to treatment plan`);
            }
          }}
          onClose={() => setShowInvestigationOrderingModal(false)}
        />
      )}

      {/* Medication Ordering Modal */}
      {showMedicationOrderingModal && selectedPlan && patients.find(p => p.id === selectedPatient) && (
        <MedicationOrderingModal
          patientId={selectedPatient}
          patientName={(() => {
            const patient = patients.find(p => p.id === selectedPatient);
            return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
          })()}
          existingMedications={orderedMedications}
          onSave={async (medications) => {
            setOrderedMedications(medications);
            // Save each medication to the treatment plan
            if (selectedPlan) {
              for (const med of medications) {
                await treatmentPlanningService.addMedication(selectedPlan.id, {
                  medication_name: med.medication_name || 'Medication',
                  dosage: med.dosage || '',
                  route: med.route || 'oral',
                  frequency: med.frequency || '',
                  patient_id: selectedPatient,
                  timeline_start: med.start_date || new Date(),
                  scheduled_times: [],
                  administration_records: [],
                  status: 'active'
                });
              }
              await reloadSelectedPlan();
              toast.success(`${medications.length} medication(s) added to treatment plan`);
            }
          }}
          onClose={() => setShowMedicationOrderingModal(false)}
        />
      )}

      {/* AI Scribe for Review Dictation */}
      {showReviewScribe && selectedPatient && (
        <ScribeRecordingPanel
          patientId={selectedPatient}
          patientName={(() => {
            const patient = patients.find(p => (p.id || p.serverId) === selectedPatient);
            return patient ? `${patient.first_name} ${patient.last_name}` : 'Patient';
          })()}
          hospitalNumber={(() => {
            const patient = patients.find(p => (p.id || p.serverId) === selectedPatient);
            return patient?.hospital_number || '';
          })()}
          context="patient_review"
          recordedBy={user?.name || 'Unknown'}
          recordedByRole={user?.role || 'house_officer'}
          onNoteReady={(note, session) => {
            // Combine SOAP sections into review notes
            const reviewText = [
              note.subjective ? `S: ${note.subjective}` : '',
              note.objective ? `O: ${note.objective}` : '',
              note.assessment ? `A: ${note.assessment}` : '',
              note.plan ? `P: ${note.plan}` : ''
            ].filter(Boolean).join('\n\n');
            setNewReview(prev => ({
              ...prev,
              review_notes: prev.review_notes
                ? `${prev.review_notes}\n\n--- AI Scribe ---\n${reviewText}`
                : reviewText
            }));
            setShowReviewScribe(false);
          }}
          onClose={() => setShowReviewScribe(false)}
        />
      )}
    </div>
  );
}
