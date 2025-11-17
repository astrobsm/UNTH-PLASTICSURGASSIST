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
import { format, isPast } from 'date-fns';
import { ComprehensiveTreatmentPlanForm } from '../components/ComprehensiveTreatmentPlanForm';

const TreatmentPlanningPage: React.FC = () => {
  const [activePlans, setActivePlans] = useState<EnhancedTreatmentPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<EnhancedTreatmentPlan | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reviews' | 'labs' | 'procedures' | 'medications' | 'discharge'>('reviews');
  
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

  const loadData = async () => {
    setLoading(true);
    try {
      const [plansData, patientsData] = await Promise.all([
        treatmentPlanningService.getActiveTreatmentPlans(),
        patientService.getAllPatients()
      ]);
      setActivePlans(plansData);
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
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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
                <input
                  type="text"
                  required
                  value={formData.assigned_house_officer}
                  onChange={(e) => setFormData({ ...formData, assigned_house_officer: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Dr. Name"
                />
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
          <h1 className="text-2xl font-bold text-gray-900">Enhanced Treatment Planning</h1>
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
              onClick={() => setSelectedPlan(plan)}
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
                  {format(plan.admission_date, 'MMM d, yyyy')}
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
                            {format(review.review_date, 'MMM d, yyyy')}
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

            {/* Add similar sections for other tabs */}
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreatePlan && (
        <ComprehensiveTreatmentPlanForm
          onClose={() => setShowCreatePlan(false)}
          onSubmit={async (data) => {
            await treatmentPlanningService.createTreatmentPlan(data);
            setShowCreatePlan(false);
            loadData();
          }}
          patients={patients}
        />
      )}
      {showAddReview && <AddReviewModal />}
    </div>
  );
};

export default TreatmentPlanningPage;
