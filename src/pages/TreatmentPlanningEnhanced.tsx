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
  ChevronUp
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

export default function TreatmentPlanningEnhanced() {
  const { user } = useAuthStore();
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [treatmentPlans, setTreatmentPlans] = useState<EnhancedTreatmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EnhancedTreatmentPlan | null>(null);
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
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

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadTreatmentPlans();
    }
  }, [selectedPatient]);

  const loadPatients = async () => {
    const allPatients = await patientService.getAllPatients();
    setPatients(allPatients);
  };

  const loadTreatmentPlans = async () => {
    const plans = await treatmentPlanningService.getPatientTreatmentPlans(selectedPatient);
    setTreatmentPlans(plans);
    if (plans.length > 0) {
      setSelectedPlan(plans[0]);
    }
  };

  const handleCreatePlan = async () => {
    if (!newPlan.patient_id || !newPlan.diagnosis || !newPlan.planned_discharge_date) {
      alert('Please fill in all required fields');
      return;
    }

    await treatmentPlanningService.createTreatmentPlan({
      patient_id: newPlan.patient_id,
      diagnosis: newPlan.diagnosis,
      admission_date: new Date(newPlan.admission_date),
      planned_discharge_date: new Date(newPlan.planned_discharge_date),
      primary_consultant: newPlan.primary_consultant,
      created_by: user?.id || 'unknown',
      notes: newPlan.notes
    });

    setShowNewPlanModal(false);
    setNewPlan({
      patient_id: '',
      diagnosis: '',
      admission_date: format(new Date(), 'yyyy-MM-dd'),
      planned_discharge_date: '',
      primary_consultant: '',
      notes: ''
    });
    loadTreatmentPlans();
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
    loadTreatmentPlans();
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

    loadTreatmentPlans();
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
    loadTreatmentPlans();
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
    loadTreatmentPlans();
  };

  const handleCompleteProcedure = async (procedureId: string, actualDate: string, delayReason?: string) => {
    if (!selectedPlan) return;

    await treatmentPlanningService.completeProcedure(
      selectedPlan.id,
      procedureId,
      new Date(actualDate),
      delayReason
    );

    loadTreatmentPlans();
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
    loadTreatmentPlans();
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
    loadTreatmentPlans();
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
        <h1 className="text-2xl font-bold text-gray-900">Enhanced Treatment Planning</h1>
        <button
          onClick={() => setShowNewPlanModal(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Treatment Plan
        </button>
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
            <h2 className="text-xl font-bold text-gray-900 mb-4">{selectedPlan.diagnosis}</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Admission:</span>{' '}
                <span className="font-medium">{format(selectedPlan.admission_date, 'MMM d, yyyy')}</span>
              </div>
              <div>
                <span className="text-gray-600">Planned Discharge:</span>{' '}
                <span className="font-medium">{format(selectedPlan.planned_discharge_date, 'MMM d, yyyy')}</span>
              </div>
              <div>
                <span className="text-gray-600">Consultant:</span>{' '}
                <span className="font-medium">{selectedPlan.primary_consultant}</span>
              </div>
              <div>
                <span className="text-gray-600">Status:</span>{' '}
                <span className={`font-medium ${selectedPlan.status === 'active' ? 'text-green-600' : 'text-gray-600'}`}>
                  {selectedPlan.status.charAt(0).toUpperCase() + selectedPlan.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('reviews')}
            >
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Reviews ({selectedPlan.reviews?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReviewModal(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
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
                          {format(review.review_date, 'MMM d, yyyy')}
                        </div>
                        <div className="text-sm text-gray-600">House Officer: {review.house_officer}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        review.status === 'completed' ? 'bg-green-100 text-green-800' :
                        review.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {review.status}
                      </span>
                    </div>
                    {review.review_notes && (
                      <p className="text-sm text-gray-700 mb-2">{review.review_notes}</p>
                    )}
                    {review.status === 'pending' && (
                      <button
                        onClick={() => {
                          const notes = prompt('Enter review notes:');
                          if (notes !== null) {
                            let delayReason;
                            if (review.delay_days && review.delay_days > 0) {
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
                    {review.delay_days && review.delay_days > 0 && (
                      <div className="mt-2 text-sm text-red-600">
                        Delayed by {review.delay_days} day(s)
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
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('labs')}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-gray-900">Lab Works ({selectedPlan.lab_works?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLabModal(true);
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm"
                >
                  Add Lab
                </button>
                {expandedSections.labs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
            {expandedSections.labs && (
              <div className="p-4 border-t space-y-3">
                {selectedPlan.lab_works?.map((lab) => (
                  <div key={lab.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-gray-900">{lab.test_name}</div>
                        <div className="text-sm text-gray-600">
                          Frequency: {lab.frequency} | Start: {format(lab.start_date, 'MMM d, yyyy')}
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {lab.frequency}
                      </span>
                    </div>
                    {lab.notes && <p className="text-sm text-gray-700">{lab.notes}</p>}
                  </div>
                ))}
                {(!selectedPlan.lab_works || selectedPlan.lab_works.length === 0) && (
                  <p className="text-gray-500 text-sm">No lab works ordered</p>
                )}
              </div>
            )}
          </div>

          {/* Procedures Section */}
          <div className="bg-white rounded-lg shadow">
            <div
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('procedures')}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-gray-900">Procedures ({selectedPlan.procedures?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProcedureModal(true);
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm"
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
                        <div className="font-medium text-gray-900">{procedure.procedure_name}</div>
                        <div className="text-sm text-gray-600">
                          Planned: {format(procedure.planned_date, 'MMM d, yyyy')}
                          {procedure.surgeon && ` | Surgeon: ${procedure.surgeon}`}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        procedure.status === 'completed' ? 'bg-green-100 text-green-800' :
                        procedure.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {procedure.status}
                      </span>
                    </div>
                    {procedure.notes && <p className="text-sm text-gray-700 mb-2">{procedure.notes}</p>}
                    {procedure.status === 'planned' && (
                      <button
                        onClick={() => {
                          const actualDate = prompt('Enter actual procedure date (YYYY-MM-DD):');
                          if (actualDate) {
                            let delayReason;
                            if (procedure.delay_days && procedure.delay_days > 0) {
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
              className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50"
              onClick={() => toggleSection('medications')}
            >
              <div className="flex items-center gap-2">
                <Pill className="w-5 h-5 text-pink-600" />
                <h3 className="font-semibold text-gray-900">Medications ({selectedPlan.medications?.length || 0})</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMedicationModal(true);
                  }}
                  className="bg-pink-600 hover:bg-pink-700 text-white px-3 py-1 rounded text-sm"
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
                        <div className="font-medium text-gray-900">{med.medication_name}</div>
                        <div className="text-sm text-gray-600">
                          {med.dosage} {med.route} {med.frequency}
                        </div>
                        <div className="text-sm text-gray-600">
                          Start: {format(med.start_date, 'MMM d, yyyy')}
                          {med.end_date && ` | End: ${format(med.end_date, 'MMM d, yyyy')}`}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        med.status === 'completed' ? 'bg-green-100 text-green-800' :
                        med.status === 'overdue' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {med.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">Prescribed by: {med.prescribing_doctor}</div>
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
                          <div className="font-medium">{format(selectedPlan.discharge_timeline.planned_date, 'MMM d, yyyy')}</div>
                        </div>
                        <div>
                          <span className="text-sm text-gray-600">Status:</span>
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              selectedPlan.discharge_timeline.status === 'ready' ? 'bg-green-100 text-green-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {selectedPlan.discharge_timeline.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      {selectedPlan.discharge_timeline.criteria_met.length > 0 && (
                        <div className="mb-2">
                          <div className="text-sm font-medium text-gray-700 mb-1">Criteria Met:</div>
                          <ul className="list-disc list-inside text-sm text-gray-600">
                            {selectedPlan.discharge_timeline.criteria_met.map((criteria, idx) => (
                              <li key={idx}>{criteria}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedPlan.discharge_timeline.pending_requirements.length > 0 && (
                        <div>
                          <div className="text-sm font-medium text-gray-700 mb-1">Pending Requirements:</div>
                          <ul className="list-disc list-inside text-sm text-red-600">
                            {selectedPlan.discharge_timeline.pending_requirements.map((req, idx) => (
                              <li key={idx}>{req}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {selectedPlan.discharge_timeline.delay_days && selectedPlan.discharge_timeline.delay_days > 0 && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                          <div className="text-sm font-medium text-red-900">
                            Discharge Delayed by {selectedPlan.discharge_timeline.delay_days} day(s)
                          </div>
                          {selectedPlan.discharge_timeline.delay_reasons.map((reason, idx) => (
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
                <textarea
                  value={newReview.review_notes}
                  onChange={(e) => setNewReview({ ...newReview, review_notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
    </div>
  );
}
