import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/database';
import {
  PlannedMedication,
  PlannedInvestigation,
  PlannedProcedureEnhanced,
  PlannedReview,
  MedicalTeamAssignment,
  DischargePlanning
} from '../services/treatmentPlanningService';

interface ComprehensiveTreatmentPlanFormProps {
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  patients: any[];
}

export const ComprehensiveTreatmentPlanForm: React.FC<ComprehensiveTreatmentPlanFormProps> = ({
  onClose,
  onSubmit,
  patients
}) => {
  const { user } = useAuthStore();
  const [currentStep, setCurrentStep] = useState(1);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Fetch users on component mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const allUsers = await db.approved_users.toArray();
        setUsers(allUsers);
        
        // Auto-assign medical team based on available users
        const seniorRegistrars = allUsers.filter(u => u.role === 'senior_registrar');
        const registrars = allUsers.filter(u => u.role === 'registrar');
        const houseOfficers = allUsers.filter(u => u.role === 'house_officer');
        
        if (seniorRegistrars.length > 0 || registrars.length > 0 || houseOfficers.length > 0) {
          setMedicalTeam({
            senior_registrar: seniorRegistrars[0]?.email || '',
            registrar: registrars[0]?.email || '',
            house_officer: houseOfficers[0]?.email || '',
            assigned_date: new Date()
          });
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, []);
  
  // Basic Information
  const [basicInfo, setBasicInfo] = useState({
    patient_id: '',
    diagnosis: '',
    admission_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  // Medical Team
  const [medicalTeam, setMedicalTeam] = useState<MedicalTeamAssignment>({
    senior_registrar: '',
    registrar: '',
    house_officer: '',
    assigned_date: new Date()
  });

  // Medications
  const [medications, setMedications] = useState<Omit<PlannedMedication, 'id'>[]>([]);
  const [newMed, setNewMed] = useState({
    medication_name: '',
    dosage: '',
    route: 'oral' as const,
    frequency: '',
    duration: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  // Investigations
  const [investigations, setInvestigations] = useState<Omit<PlannedInvestigation, 'id' | 'scheduled_dates' | 'results'>[]>([]);
  const [newInv, setNewInv] = useState({
    investigation_name: '',
    investigation_type: 'lab' as const,
    frequency: 'once' as const,
    repeat_count: 1,
    target_value: '',
    target_range: '',
    ordered_date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  // Procedures
  const [procedures, setProcedures] = useState<Omit<PlannedProcedureEnhanced, 'id' | 'actual_dates'>[]>([]);
  const [newProc, setNewProc] = useState({
    procedure_name: '',
    procedure_type: 'minor' as const,
    proposed_date: format(new Date(), 'yyyy-MM-dd'),
    proposed_time: '',
    frequency: undefined as 'once' | 'daily' | 'alternate_days' | 'weekly' | 'as_needed' | undefined,
    repeat_count: undefined as number | undefined,
    surgeon: '',
    location: '',
    notes: ''
  });

  // Planned Reviews
  const [reviews, setReviews] = useState<Omit<PlannedReview, 'id' | 'completed_reviews' | 'missed_reviews'>[]>([]);
  const [newReview, setNewReview] = useState({
    review_type: 'daily' as const,
    days_of_week: {
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false
    },
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    assigned_to: 'house_officer' as const,
    assigned_person_name: ''
  });

  // Discharge Planning
  const [dischargePlan, setDischargePlan] = useState<Partial<DischargePlanning>>({
    initial_discharge_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    current_discharge_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    discharge_criteria: [],
    extensions: [],
    status: 'on_track'
  });
  const [newCriterion, setNewCriterion] = useState('');

  // Add Medication
  const addMedication = () => {
    if (!newMed.medication_name || !newMed.dosage || !newMed.frequency) return;
    
    setMedications([...medications, {
      ...newMed,
      start_date: new Date(newMed.start_date),
      status: 'active'
    }]);
    
    setNewMed({
      medication_name: '',
      dosage: '',
      route: 'oral',
      frequency: '',
      duration: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      notes: ''
    });
  };

  // Add Investigation
  const addInvestigation = () => {
    if (!newInv.investigation_name) return;
    
    setInvestigations([...investigations, {
      ...newInv,
      ordered_date: new Date(newInv.ordered_date),
      status: 'pending'
    }]);
    
    setNewInv({
      investigation_name: '',
      investigation_type: 'lab',
      frequency: 'once',
      repeat_count: 1,
      target_value: '',
      target_range: '',
      ordered_date: format(new Date(), 'yyyy-MM-dd'),
      notes: ''
    });
  };

  // Add Procedure
  const addProcedure = () => {
    if (!newProc.procedure_name) return;
    
    setProcedures([...procedures, {
      ...newProc,
      proposed_date: new Date(newProc.proposed_date),
      status: 'planned'
    }]);
    
    setNewProc({
      procedure_name: '',
      procedure_type: 'minor',
      proposed_date: format(new Date(), 'yyyy-MM-dd'),
      proposed_time: '',
      frequency: undefined,
      repeat_count: undefined,
      surgeon: '',
      location: '',
      notes: ''
    });
  };

  // Add Review
  const addReview = () => {
    if (!newReview.assigned_person_name) return;
    
    setReviews([...reviews, {
      ...newReview,
      start_date: new Date(newReview.start_date),
      end_date: newReview.end_date ? new Date(newReview.end_date) : undefined,
      status: 'active'
    }]);
    
    setNewReview({
      review_type: 'daily',
      days_of_week: {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false
      },
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      assigned_to: 'house_officer',
      assigned_person_name: ''
    });
  };

  // Add Discharge Criterion
  const addDischargeCriterion = () => {
    if (!newCriterion.trim()) return;
    
    setDischargePlan({
      ...dischargePlan,
      discharge_criteria: [...(dischargePlan.discharge_criteria || []), newCriterion],
      criteria_pending: [...(dischargePlan.criteria_pending || []), newCriterion]
    });
    
    setNewCriterion('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const patient = patients.find(p => p.id === parseInt(basicInfo.patient_id));
    if (!patient) return;

    const planData = {
      ...basicInfo,
      patient_id: parseInt(basicInfo.patient_id),
      patient_name: `${patient.first_name} ${patient.last_name}`,
      hospital_number: patient.hospital_number,
      admission_date: new Date(basicInfo.admission_date),
      title: `Treatment Plan - ${basicInfo.diagnosis.substring(0, 50)}`,
      status: 'active',
      medical_team: medicalTeam,
      planned_medications: medications.map((m, i) => ({ ...m, id: `med_${Date.now()}_${i}` })),
      planned_investigations: investigations.map((inv, i) => ({ 
        ...inv, 
        id: `inv_${Date.now()}_${i}`,
        scheduled_dates: [],
        results: []
      })),
      planned_procedures: procedures.map((p, i) => ({ ...p, id: `proc_${Date.now()}_${i}`, actual_dates: [] })),
      planned_reviews: reviews.map((r, i) => ({ 
        ...r, 
        id: `review_${Date.now()}_${i}`,
        completed_reviews: [],
        missed_reviews: []
      })),
      discharge_plan: {
        ...dischargePlan,
        id: `discharge_${Date.now()}`,
        criteria_met: [],
        criteria_pending: dischargePlan.discharge_criteria || []
      },
      // Legacy fields for compatibility
      reviews: [],
      lab_works: [],
      procedures: [],
      medications: [],
      created_by: user?.email || 'Unknown'
    };

    await onSubmit(planData);
  };

  const steps = [
    { number: 1, name: 'Basic Info & Team' },
    { number: 2, name: 'Medications' },
    { number: 3, name: 'Investigations' },
    { number: 4, name: 'Procedures' },
    { number: 5, name: 'Reviews' },
    { number: 6, name: 'Discharge Plan' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Create Comprehensive Treatment Plan</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          {/* Progress Steps */}
          <div className="flex items-center justify-between overflow-x-auto">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                  currentStep >= step.number ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {step.number}
                </div>
                <span className={`ml-2 text-sm font-medium whitespace-nowrap ${
                  currentStep >= step.number ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {step.name}
                </span>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-1 mx-2 flex-shrink-0 ${
                    currentStep > step.number ? 'bg-green-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* Step 1: Basic Info & Medical Team */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                  <select
                    required
                    value={basicInfo.patient_id}
                    onChange={(e) => setBasicInfo({ ...basicInfo, patient_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.hospital_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date *</label>
                  <input
                    type="date"
                    required
                    value={basicInfo.admission_date}
                    onChange={(e) => setBasicInfo({ ...basicInfo, admission_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                <textarea
                  required
                  value={basicInfo.diagnosis}
                  onChange={(e) => setBasicInfo({ ...basicInfo, diagnosis: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Enter diagnosis..."
                />
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mt-6">Medical Team Assignment</h3>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senior Registrar *</label>
                  <select
                    required
                    value={medicalTeam.senior_registrar}
                    onChange={(e) => setMedicalTeam({ ...medicalTeam, senior_registrar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  >
                    <option value="">Select Senior Registrar...</option>
                    {users.filter(u => u.role === 'senior_registrar').map(u => (
                      <option key={u.id} value={u.email}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registrar *</label>
                  <select
                    required
                    value={medicalTeam.registrar}
                    onChange={(e) => setMedicalTeam({ ...medicalTeam, registrar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  >
                    <option value="">Select Registrar...</option>
                    {users.filter(u => u.role === 'registrar').map(u => (
                      <option key={u.id} value={u.email}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">House Officer *</label>
                  <select
                    required
                    value={medicalTeam.house_officer}
                    onChange={(e) => setMedicalTeam({ ...medicalTeam, house_officer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={loading}
                  >
                    <option value="">Select House Officer...</option>
                    {users.filter(u => u.role === 'house_officer').map(u => (
                      <option key={u.id} value={u.email}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
                <textarea
                  value={basicInfo.notes}
                  onChange={(e) => setBasicInfo({ ...basicInfo, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Medications */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Medications</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Medication Name</label>
                    <input
                      type="text"
                      value={newMed.medication_name}
                      onChange={(e) => setNewMed({ ...newMed, medication_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Paracetamol"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                    <input
                      type="text"
                      value={newMed.dosage}
                      onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 1g, 500mg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                    <select
                      value={newMed.route}
                      onChange={(e) => setNewMed({ ...newMed, route: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="oral">Oral</option>
                      <option value="IV">IV</option>
                      <option value="IM">IM</option>
                      <option value="SC">SC</option>
                      <option value="topical">Topical</option>
                      <option value="rectal">Rectal</option>
                      <option value="sublingual">Sublingual</option>
                      <option value="inhalation">Inhalation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <input
                      type="text"
                      value={newMed.frequency}
                      onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., TDS, BD, OD, Q6H"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <input
                      type="text"
                      value={newMed.duration}
                      onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 7 days, 2 weeks"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newMed.start_date}
                      onChange={(e) => setNewMed({ ...newMed, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addMedication}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Medication
                </button>
              </div>

              {/* Medications List */}
              {medications.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Added Medications ({medications.length})</h4>
                  {medications.map((med, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{med.medication_name}</p>
                        <p className="text-sm text-gray-600">
                          {med.dosage} • {med.route} • {med.frequency} • {med.duration}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMedications(medications.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Investigations */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Investigations</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Investigation Name</label>
                    <input
                      type="text"
                      value={newInv.investigation_name}
                      onChange={(e) => setNewInv({ ...newInv, investigation_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., FBC, U&E, Chest X-ray"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newInv.investigation_type}
                      onChange={(e) => setNewInv({ ...newInv, investigation_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="lab">Laboratory</option>
                      <option value="imaging">Imaging</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                    <select
                      value={newInv.frequency}
                      onChange={(e) => setNewInv({ ...newInv, frequency: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="once">Once</option>
                      <option value="daily">Daily</option>
                      <option value="alternate_days">Alternate Days</option>
                      <option value="twice_weekly">Twice Weekly</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                    <input
                      type="number"
                      value={newInv.repeat_count}
                      onChange={(e) => setNewInv({ ...newInv, repeat_count: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      min="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Target Value</label>
                    <input
                      type="text"
                      value={newInv.target_value}
                      onChange={(e) => setNewInv({ ...newInv, target_value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Expected result"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Normal Range</label>
                    <input
                      type="text"
                      value={newInv.target_range}
                      onChange={(e) => setNewInv({ ...newInv, target_range: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., 4.0-5.5 mmol/L"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addInvestigation}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Investigation
                </button>
              </div>

              {investigations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Added Investigations ({investigations.length})</h4>
                  {investigations.map((inv, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{inv.investigation_name}</p>
                        <p className="text-sm text-gray-600">
                          {inv.investigation_type} • {inv.frequency} • Repeat: {inv.repeat_count}x
                          {inv.target_value && ` • Target: ${inv.target_value}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setInvestigations(investigations.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Procedures */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Procedures</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Procedure Name</label>
                    <input
                      type="text"
                      value={newProc.procedure_name}
                      onChange={(e) => setNewProc({ ...newProc, procedure_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., Wound debridement"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newProc.procedure_type}
                      onChange={(e) => setNewProc({ ...newProc, procedure_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="therapeutic">Therapeutic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Date</label>
                    <input
                      type="date"
                      value={newProc.proposed_date}
                      onChange={(e) => setNewProc({ ...newProc, proposed_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Time</label>
                    <input
                      type="time"
                      value={newProc.proposed_time}
                      onChange={(e) => setNewProc({ ...newProc, proposed_time: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency (if repeated)</label>
                    <select
                      value={newProc.frequency || ''}
                      onChange={(e) => setNewProc({ ...newProc, frequency: e.target.value as any || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">One-time procedure</option>
                      <option value="daily">Daily</option>
                      <option value="alternate_days">Alternate Days</option>
                      <option value="weekly">Weekly</option>
                      <option value="as_needed">As Needed</option>
                    </select>
                  </div>

                  {newProc.frequency && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                      <input
                        type="number"
                        value={newProc.repeat_count || 1}
                        onChange={(e) => setNewProc({ ...newProc, repeat_count: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                        min="1"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Surgeon</label>
                    <input
                      type="text"
                      value={newProc.surgeon}
                      onChange={(e) => setNewProc({ ...newProc, surgeon: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Dr. Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                    <input
                      type="text"
                      value={newProc.location}
                      onChange={(e) => setNewProc({ ...newProc, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="e.g., OT 1, Ward"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addProcedure}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Procedure
                </button>
              </div>

              {procedures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Added Procedures ({procedures.length})</h4>
                  {procedures.map((proc, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{proc.procedure_name}</p>
                        <p className="text-sm text-gray-600">
                          {proc.procedure_type} • {format(new Date(proc.proposed_date), 'MMM d, yyyy')}
                          {proc.frequency && ` • ${proc.frequency}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProcedures(procedures.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Reviews */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Planned Reviews</h3>
              
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
                    <select
                      value={newReview.review_type}
                      onChange={(e) => setNewReview({ ...newReview, review_type: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="alternate_days">Alternate Days</option>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="custom">Custom Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                    <select
                      value={newReview.assigned_to}
                      onChange={(e) => setNewReview({ ...newReview, assigned_to: e.target.value as any })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="house_officer">House Officer</option>
                      <option value="registrar">Registrar</option>
                      <option value="senior_registrar">Senior Registrar</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Person Name</label>
                    <input
                      type="text"
                      value={newReview.assigned_person_name}
                      onChange={(e) => setNewReview({ ...newReview, assigned_person_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Dr. Name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newReview.start_date}
                      onChange={(e) => setNewReview({ ...newReview, start_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Days of Week</label>
                    <div className="flex gap-2 flex-wrap">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                        <label key={day} className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={newReview.days_of_week[day as keyof typeof newReview.days_of_week]}
                            onChange={(e) => setNewReview({
                              ...newReview,
                              days_of_week: {
                                ...newReview.days_of_week,
                                [day]: e.target.checked
                              }
                            })}
                            className="rounded text-green-600 focus:ring-green-500"
                          />
                          <span className="text-sm capitalize">{day.substring(0, 3)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={addReview}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Review Schedule
                </button>
              </div>

              {reviews.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">Scheduled Reviews ({reviews.length})</h4>
                  {reviews.map((review, index) => (
                    <div key={index} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{review.review_type} - {review.assigned_person_name}</p>
                        <p className="text-sm text-gray-600">
                          {review.assigned_to} • 
                          {Object.entries(review.days_of_week)
                            .filter(([_, checked]) => checked)
                            .map(([day]) => day.substring(0, 3))
                            .join(', ')}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviews(reviews.filter((_, i) => i !== index))}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 6: Discharge Planning */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Discharge Planning</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proposed Discharge Date *</label>
                  <input
                    type="date"
                    required
                    value={dischargePlan.initial_discharge_date ? format(new Date(dischargePlan.initial_discharge_date), 'yyyy-MM-dd') : ''}
                    onChange={(e) => setDischargePlan({
                      ...dischargePlan,
                      initial_discharge_date: new Date(e.target.value),
                      current_discharge_date: new Date(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Criteria</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="e.g., Wound healing satisfactory"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDischargeCriterion())}
                  />
                  <button
                    type="button"
                    onClick={addDischargeCriterion}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {dischargePlan.discharge_criteria && dischargePlan.discharge_criteria.length > 0 && (
                  <div className="space-y-1">
                    {dischargePlan.discharge_criteria.map((criterion, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm text-gray-900">{criterion}</span>
                        <button
                          type="button"
                          onClick={() => setDischargePlan({
                            ...dischargePlan,
                            discharge_criteria: dischargePlan.discharge_criteria?.filter((_, i) => i !== index),
                            criteria_pending: dischargePlan.criteria_pending?.filter((_, i) => i !== index)
                          })}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  💡 Discharge extensions can be added later if targets are not met. The system will track all extensions and reasons.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                className="px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                Create Treatment Plan
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
