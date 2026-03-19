import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Plus, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  User,
  FileText,
  Activity,
  Pill,
  Home,
  ChevronRight
} from 'lucide-react';
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
import { medicalTeamService } from '../services/medicalTeamService';
import { format, isPast } from 'date-fns';
import { safeFormatDate } from '../utils/dateUtils';
import { ComprehensiveTreatmentPlanForm } from '../components/ComprehensiveTreatmentPlanForm';

const TreatmentPlanningPage: React.FC = () => {
  const [activePlans, setActivePlans] = useState<EnhancedTreatmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EnhancedTreatmentPlan | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reviews' | 'labs' | 'procedures' | 'medications' | 'discharge'>('reviews');
  const [serverLabOrders, setServerLabOrders] = useState<any[]>([]);
  
  // Modal states
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [showAddReview, setShowAddReview] = useState(false);
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddProcedure, setShowAddProcedure] = useState(false);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [showSetDischarge, setShowSetDischarge] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Fetch server lab orders when selected plan changes
  useEffect(() => {
    if (selectedPlan?.patient_id) {
      loadServerLabOrders(selectedPlan.patient_id);
    } else {
      setServerLabOrders([]);
    }
  }, [selectedPlan?.patient_id]);

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

  // Normalize a plan to merge planned_* (enhanced) fields into legacy display fields
  const normalizePlan = (plan: any): EnhancedTreatmentPlan => {
    // Merge planned_reviews into reviews (legacy)
    const rawLegacyReviews = plan.reviews || [];
    // Normalize legacy reviews to ensure consistent field names
    const legacyReviews = rawLegacyReviews.map((r: any) => ({
      ...r,
      id: r.id || `review_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      review_date: r.review_date || r.start_date || r.scheduled_date || new Date(),
      scheduled_date: r.scheduled_date || r.start_date || r.review_date || new Date(),
      assigned_house_officer: r.assigned_house_officer || r.assigned_person_name || r.assigned_to || r.house_officer || '',
      status: r.status === 'active' ? 'pending' : r.status || 'pending',
      notes: r.notes || (r.review_type ? `${r.review_type} review` : ''),
    }));
    const plannedReviews = (plan.planned_reviews || []).map((pr: any) => ({
      id: pr.id,
      plan_id: plan.id,
      review_date: pr.start_date || pr.review_date || new Date(),
      scheduled_date: pr.start_date || pr.review_date || new Date(),
      assigned_house_officer: pr.assigned_person_name || pr.assigned_to || '',
      assigned_to: pr.assigned_person_name || pr.assigned_to || '',
      assigned_role: pr.assigned_to || 'house_officer',
      status: pr.status === 'active' ? 'pending' : pr.status || 'pending',
      notes: `${pr.review_type || ''} review`,
      completed_reviews: pr.completed_reviews || [],
      missed_reviews: pr.missed_reviews || [],
      created_at: pr.created_at || new Date(),
      updated_at: pr.updated_at || new Date(),
    }));
    const mergedReviews = legacyReviews.length > 0 ? legacyReviews : plannedReviews;

    // Merge planned_investigations into lab_works
    const legacyLabs = plan.lab_works || [];
    const plannedInvestigations = (plan.planned_investigations || []).map((inv: any) => ({
      id: inv.id,
      plan_id: plan.id,
      patient_id: plan.patient_id,
      test_type: inv.investigation_name || inv.test_type || 'Investigation',
      frequency: inv.frequency || 'once',
      timeline_start: inv.ordered_date || inv.timeline_start || new Date(),
      scheduled_dates: inv.scheduled_dates || [],
      completed_dates: [],
      results: inv.results || [],
      status: inv.status || 'active',
      created_at: inv.created_at || new Date(),
      updated_at: inv.updated_at || new Date(),
    }));
    const mergedLabs = legacyLabs.length > 0 ? legacyLabs : plannedInvestigations;

    // Merge planned_procedures into procedures
    const legacyProcedures = plan.procedures || [];
    const plannedProcedures = (plan.planned_procedures || []).map((p: any) => ({
      id: p.id,
      plan_id: plan.id,
      patient_id: plan.patient_id,
      procedure_name: p.procedure_name || 'Procedure',
      procedure_type: p.procedure_type || 'minor',
      planned_date: p.proposed_date || p.planned_date || new Date(),
      proposed_date: p.proposed_date || new Date(),
      status: p.status || 'planned',
      surgeon: p.surgeon || '',
      location: p.location || '',
      notes: p.notes || '',
      created_at: p.created_at || new Date(),
      updated_at: p.updated_at || new Date(),
    }));
    const mergedProcedures = legacyProcedures.length > 0 ? legacyProcedures : plannedProcedures;

    // Merge planned_medications into medications
    const legacyMeds = plan.medications || [];
    const plannedMeds = (plan.planned_medications || []).map((m: any) => ({
      id: m.id,
      plan_id: plan.id,
      patient_id: plan.patient_id,
      medication_name: m.medication_name || 'Medication',
      dosage: m.dosage || '',
      route: m.route || 'oral',
      frequency: m.frequency || '',
      start_date: m.start_date || new Date(),
      end_date: m.end_date,
      timeline_start: m.start_date || new Date(),
      scheduled_times: [],
      administration_records: [],
      status: m.status || 'active',
      created_at: m.created_at || new Date(),
      updated_at: m.updated_at || new Date(),
    }));
    const mergedMeds = legacyMeds.length > 0 ? legacyMeds : plannedMeds;

    // Normalize discharge plan
    const dischargePlan = plan.discharge_plan || plan.discharge_timeline || null;
    const normalizedDischarge = dischargePlan ? {
      ...dischargePlan,
      planned_date: dischargePlan.initial_discharge_date || dischargePlan.current_discharge_date || dischargePlan.planned_date || dischargePlan.proposed_discharge_date,
      discharge_criteria: dischargePlan.discharge_criteria || [],
    } : null;

    return {
      ...plan,
      reviews: mergedReviews,
      lab_works: mergedLabs,
      procedures: mergedProcedures,
      medications: mergedMeds,
      discharge_plan: normalizedDischarge,
    };
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, patientsData] = await Promise.all([
        treatmentPlanningService.getActiveTreatmentPlans(),
        patientService.getAllPatients()
      ]);
      // Normalize plans to merge enhanced fields into legacy display fields
      const normalizedPlans = plansData.map(normalizePlan);
      setActivePlans(normalizedPlans);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading treatment planning data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOverdueCount = (plan: EnhancedTreatmentPlan) => {
    const overdue = treatmentPlanningService.getOverdueItems(plan);
    return overdue.reviews.length + overdue.procedures.length + overdue.medications.length;
  };


  const AddReviewModal = () => {
    const [formData, setFormData] = useState({
      review_date: format(new Date(), 'yyyy-MM-dd'),
      assigned_house_officer: '',
      notes: ''
    });
    const [houseOfficers, setHouseOfficers] = useState<any[]>([]);
    const [loadingHO, setLoadingHO] = useState(true);

    useEffect(() => {
      const loadHouseOfficer = async () => {
        setLoadingHO(true);
        try {
          // Get the assigned house officer for this patient
          if (selectedPlan?.patient_id) {
            const team = await medicalTeamService.getPatientMedicalTeam(Number(selectedPlan.patient_id));
            const assignedHO = team.find(m => m.role === 'house_officer');
            if (assignedHO) {
              setFormData(prev => ({
                ...prev,
                assigned_house_officer: assignedHO.full_name || assignedHO.name || ''
              }));
            }
          }
          // Also load all house officers for the dropdown
          const allHO = await medicalTeamService.getStaffByRole('house_officer');
          setHouseOfficers(allHO);
        } catch (err) {
          console.error('Error loading house officers:', err);
        } finally {
          setLoadingHO(false);
        }
      };
      loadHouseOfficer();
    }, [selectedPlan?.patient_id]);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedPlan) return;

      try {
        await treatmentPlanningService.addReview(selectedPlan.id, {
          review_date: new Date(formData.review_date),
          assigned_house_officer: formData.assigned_house_officer,
          notes: formData.notes
        });

        setShowAddReview(false);
        loadData();
      } catch (error) {
        console.error('Error adding review:', error);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Schedule Review</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Review Date</label>
                <input
                  type="date"
                  required
                  value={formData.review_date}
                  onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned House Officer</label>
                {loadingHO ? (
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-400">Loading staff...</div>
                ) : houseOfficers.length > 0 ? (
                  <select
                    required
                    value={formData.assigned_house_officer}
                    onChange={(e) => setFormData({ ...formData, assigned_house_officer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select House Officer</option>
                    {houseOfficers.map((ho) => (
                      <option key={ho.id} value={ho.full_name}>
                        Dr. {ho.full_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.assigned_house_officer}
                    onChange={(e) => setFormData({ ...formData, assigned_house_officer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Dr. Name"
                  />
                )}
                {formData.assigned_house_officer && (
                  <p className="text-xs text-green-600 mt-1">Auto-filled from patient assignment</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Review focus areas..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddReview(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
                >
                  Schedule Review
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Enhanced Treatment Planning</h1>
          <button
            onClick={() => setShowCreatePlan(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <Plus className="w-5 h-5" />
            New Treatment Plan
          </button>
        </div>
        <p className="text-gray-600">Timeline-based treatment management with delay tracking</p>
      </div>

      {/* Active Plans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {activePlans.map(plan => {
          const overdueCount = getOverdueCount(plan);
          return (
            <div
              key={plan.id}
              onClick={() => setSelectedPlan(normalizePlan(plan))}
              className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                selectedPlan?.id === plan.id ? 'ring-2 ring-green-600' : 'hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{plan.patient_name}</h3>
                  <p className="text-sm text-gray-600">{plan.hospital_number}</p>
                </div>
                {overdueCount > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                    <AlertCircle className="w-3 h-3" />
                    {overdueCount}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-700 mb-3 line-clamp-2">{plan.diagnosis}</p>

              <div className="flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {safeFormatDate(plan.admission_date, 'MMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {plan.reviews?.length || 0} reviews
                </span>
              </div>
            </div>
          );
        })}

        {activePlans.length === 0 && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No active treatment plans</p>
            <button
              onClick={() => setShowCreatePlan(true)}
              className="mt-3 text-green-600 hover:text-green-700 font-medium"
            >
              Create your first plan
            </button>
          </div>
        )}
      </div>

      {/* Selected Plan Details */}
      {selectedPlan && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedPlan.patient_name}</h2>
                <p className="text-gray-600">{selectedPlan.diagnosis}</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                Active
              </span>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              {[
                { id: 'reviews', label: 'Reviews', icon: User },
                { id: 'labs', label: 'Lab Work', icon: Activity },
                { id: 'procedures', label: 'Procedures', icon: FileText },
                { id: 'medications', label: 'Medications', icon: Pill },
                { id: 'discharge', label: 'Discharge', icon: Home }
              ].map(tab => (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'reviews' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Scheduled Reviews</h3>
                  <button
                    onClick={() => setShowAddReview(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Review
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedPlan.reviews?.map(review => (
                    <div
                      key={review.id}
                      className={`p-4 rounded-lg border ${
                        review.status === 'overdue'
                          ? 'border-red-200 bg-red-50'
                          : review.status === 'completed'
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">
                            {safeFormatDate(review.review_date, 'MMM d, yyyy')}
                          </span>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            review.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : review.status === 'overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {review.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">House Officer:</span> {review.assigned_house_officer}
                      </p>
                      {review.notes && (
                        <p className="text-sm text-gray-600 italic">{review.notes}</p>
                      )}
                      {review.status === 'overdue' && review.delay_reason && (
                        <div className="mt-2 p-2 bg-red-100 rounded text-sm text-red-700">
                          <span className="font-medium">Delay Reason:</span> {review.delay_reason}
                        </div>
                      )}
                    </div>
                  ))}

                  {(!selectedPlan.reviews || selectedPlan.reviews.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No reviews scheduled</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'labs' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Lab Work ({(selectedPlan.lab_works?.length || 0) + serverLabOrders.length})</h3>
                  <button
                    onClick={() => setShowAddLab(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Lab
                  </button>
                </div>
                <div className="space-y-3">
                  {/* Local lab_works from treatment plan */}
                  {selectedPlan.lab_works?.map(lab => (
                    <div key={lab.id} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="font-medium text-gray-900">{lab.test_type || 'Lab Test'}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Frequency: {lab.frequency || 'once'} | Start: {safeFormatDate(lab.timeline_start, 'MMM d, yyyy')}
                      </div>
                      {lab.results && lab.results.length > 0 && <p className="text-sm text-gray-600 mt-2">{lab.results[lab.results.length - 1].result}</p>}
                    </div>
                  ))}

                  {/* Server lab orders for this patient */}
                  {serverLabOrders.map(order => (
                    <div key={`server-${order.id}`} className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-gray-900">{order.test_name || order.test_type || 'Lab Order'}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Priority: {order.priority || 'routine'} | Ordered: {safeFormatDate(order.ordered_at, 'MMM d, yyyy')}
                          </div>
                          {order.clinical_notes && <p className="text-sm text-gray-600 mt-1">{order.clinical_notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Lab Order</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                    <p className="text-center text-gray-500 py-8">No lab work ordered</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'procedures' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Planned Procedures</h3>
                  <button
                    onClick={() => setShowAddProcedure(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Procedure
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedPlan.procedures?.map(procedure => (
                    <div
                      key={procedure.id}
                      className={`p-4 rounded-lg border ${
                        procedure.status === 'overdue'
                          ? 'border-red-200 bg-red-50'
                          : procedure.status === 'completed'
                          ? 'border-green-200 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900">{procedure.procedure_name}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            Planned: {safeFormatDate(procedure.planned_date, 'MMM d, yyyy')}
                            {procedure.surgeon && ` | Surgeon: ${procedure.surgeon}`}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            procedure.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : procedure.status === 'overdue'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {procedure.status}
                        </span>
                      </div>
                      {procedure.notes && <p className="text-sm text-gray-600">{procedure.notes}</p>}
                    </div>
                  ))}
                  {(!selectedPlan.procedures || selectedPlan.procedures.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No procedures planned</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'medications' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Medications</h3>
                  <button
                    onClick={() => setShowAddMedication(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Add Medication
                  </button>
                </div>
                <div className="space-y-3">
                  {selectedPlan.medications?.map(med => (
                    <div key={med.id} className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="font-medium text-gray-900">{med.medication_name}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        {med.dosage} {med.route} {med.frequency}
                      </div>
                      <div className="text-sm text-gray-600">
                        Start: {safeFormatDate(med.start_date, 'MMM d, yyyy')}
                        {med.end_date && ` | End: ${safeFormatDate(med.end_date, 'MMM d, yyyy')}`}
                      </div>
                      <span
                        className={`inline-block mt-2 px-2 py-1 text-xs font-medium rounded ${
                          med.status === 'active'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {med.status}
                      </span>
                    </div>
                  ))}
                  {(!selectedPlan.medications || selectedPlan.medications.length === 0) && (
                    <p className="text-center text-gray-500 py-8">No medications prescribed</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'discharge' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Discharge Planning</h3>
                  <button
                    onClick={() => setShowSetDischarge(true)}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                    Set Discharge
                  </button>
                </div>
                <div className="space-y-4">
                  {selectedPlan.discharge_plan && (
                    <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="font-medium text-gray-900 mb-2">Discharge Information</div>
                      {selectedPlan.discharge_plan.planned_date && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Planned Date:</span>{' '}
                          {safeFormatDate(selectedPlan.discharge_plan.planned_date, 'MMM d, yyyy')}
                        </p>
                      )}
                      {selectedPlan.discharge_plan.discharge_criteria && (
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-700 mb-1">Discharge Criteria:</p>
                          <ul className="list-disc list-inside text-sm text-gray-600">
                            {selectedPlan.discharge_plan.discharge_criteria.map((criteria: string, idx: number) => (
                              <li key={idx}>{criteria}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                  {!selectedPlan.discharge_plan && (
                    <p className="text-center text-gray-500 py-8">No discharge plan set</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreatePlan && (
        <ComprehensiveTreatmentPlanForm
          onClose={() => setShowCreatePlan(false)}
          onSubmit={async (data) => {
            if (data.existingPlanId) {
              await treatmentPlanningService.updateTreatmentPlan(data.existingPlanId, data);
            } else {
              await treatmentPlanningService.createTreatmentPlan(data);
            }
            setShowCreatePlan(false);
            loadData();
          }}
          patients={patients}
        />
      )}
      {showAddReview && <AddReviewModal />}
      {showAddLab && selectedPlan && (
        <AddLabModal
          planId={selectedPlan.id}
          onClose={() => setShowAddLab(false)}
          onSuccess={async () => {
            // Reload the plan to show new lab work
            const updatedPlan = await treatmentPlanningService.getTreatmentPlan(selectedPlan.id);
            if (updatedPlan) {
              setSelectedPlan(normalizePlan(updatedPlan));
            }
            setShowAddLab(false);
          }}
        />
      )}
    </div>
  );
};

// Add Lab Modal Component
const AddLabModal: React.FC<{ planId: string; onClose: () => void; onSuccess: () => void }> = ({ planId, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    test_name: '',
    frequency: 'once' as string,
    start_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.test_name) return;

    try {
      await treatmentPlanningService.addLabWork(planId, {
        test_type: formData.test_name,
        frequency: formData.frequency,
        timeline_start: new Date(formData.start_date),
        scheduled_dates: [new Date(formData.start_date)],
        completed_dates: [],
        status: 'active'
      });
      onSuccess();
    } catch (error) {
      console.error('Error adding lab work:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Lab Work</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Test Name *</label>
              <input
                type="text"
                value={formData.test_name}
                onChange={(e) => setFormData({ ...formData, test_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., FBC, U&E, LFT, Blood Culture"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                title="Lab work frequency"
              >
                <option value="once">Once</option>
                <option value="daily">Daily</option>
                <option value="twice_daily">Twice Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder="Clinical indications, special instructions..."
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                Add Lab Work
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TreatmentPlanningPage;
