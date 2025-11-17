import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { format } from 'date-fns';
import { 
  Plus, 
  Eye, 
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Image as ImageIcon,
  X
} from 'lucide-react';
import { schedulingService, SurgeryBooking } from '../services/schedulingService';

interface PreOpEvaluation {
  lab_tests_done: boolean;
  ecg_done: boolean;
  chest_xray_done: boolean;
  anesthesia_clearance: boolean;
  consent_signed: boolean;
  site_marking_done: boolean;
  blood_crossmatched: boolean;
}

interface PatientSurgeryDetails extends SurgeryBooking {
  preop_evaluation?: PreOpEvaluation;
  preop_evaluations_complete?: boolean;
  missing_evaluations?: string[];
}

interface SurgeryBookingEnhancedProps {
  selectedDate: Date;
  onRefresh: () => void;
}

export default function SurgeryBookingEnhanced({ selectedDate, onRefresh }: SurgeryBookingEnhancedProps) {
  const [surgeries, setSurgeries] = useState<PatientSurgeryDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedSurgery, setSelectedSurgery] = useState<PatientSurgeryDetails | null>(null);
  const [showPatientSummary, setShowPatientSummary] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [filterDate, setFilterDate] = useState(selectedDate);
  const [patients, setPatients] = useState<any[]>([]);

  // Booking form state
  const [formData, setFormData] = useState({
    patient_id: '',
    patient_name: '',
    hospital_number: '',
    patient_age: undefined as number | undefined,
    patient_gender: '',
    indication: '',
    ward: '',
    procedure_name: '',
    anaesthesia_type: 'general' as 'general' | 'regional' | 'local' | 'sedation',
    remarks: [] as string[],
    date: format(selectedDate, 'yyyy-MM-dd'),
    start_time: '08:00',
    estimated_duration_minutes: 120,
    theatre_number: '',
    primary_surgeon: '',
    consultants: [] as string[],
    senior_registrars: [] as string[],
    registrars: [] as string[],
    house_officers: [] as string[],
    operation_site_images: [] as string[], // Multiple images
    xray_images: [] as string[], // X-ray/CT images
    clinical_condition_change: '',
    clinical_condition_date: '',
    treatment_plan_updated: false,
    // Pre-op requirements
    lab_tests_done: false,
    ecg_done: false,
    chest_xray_done: false,
    anesthesia_clearance: false,
    consent_signed: false,
    site_marking_done: false,
    blood_crossmatched: false,
  });

  const [viewingImages, setViewingImages] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    loadSurgeries();
    loadPatients();
  }, [filterDate]);

  const loadSurgeries = async () => {
    setLoading(true);
    try {
      const surgeriesData = await schedulingService.getSurgeryBookings(filterDate);
      
      // Enhance with pre-op evaluation status
      const enhancedSurgeries = await Promise.all(
        surgeriesData.map(async (surgery) => {
          const preop_evaluation = await getPreOpEvaluation(surgery.patient_id);
          const missing = getMissingEvaluations(preop_evaluation);
          
          return {
            ...surgery,
            preop_evaluation,
            preop_evaluations_complete: missing.length === 0,
            missing_evaluations: missing
          };
        })
      );
      
      setSurgeries(enhancedSurgeries);
    } catch (error) {
      console.error('Error loading surgeries:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const list = await patientService.getAllPatients();
      setPatients(list);
    } catch (err) {
      console.error('Failed to load patients', err);
    }
  };

  const getPreOpEvaluation = async (patientId: string): Promise<PreOpEvaluation> => {
    // Check if patient has completed pre-operative assessments
    // This would ideally query the PreoperativeAssessment records
    try {
      const patient = await patientService.getPatient(patientId);
      if (!patient) {
        return {
          lab_tests_done: false,
          ecg_done: false,
          chest_xray_done: false,
          anesthesia_clearance: false,
          consent_signed: false,
          site_marking_done: false,
          blood_crossmatched: false
        };
      }
      
      // TODO: Query actual pre-op assessment records
      // For now, return mock data - in production, check actual assessment records
      return {
        lab_tests_done: true,
        ecg_done: true,
        chest_xray_done: true,
        anesthesia_clearance: false,
        consent_signed: true,
        site_marking_done: false,
        blood_crossmatched: true
      };
    } catch (error) {
      console.error('Error getting pre-op evaluation:', error);
      return {
        lab_tests_done: false,
        ecg_done: false,
        chest_xray_done: false,
        anesthesia_clearance: false,
        consent_signed: false,
        site_marking_done: false,
        blood_crossmatched: false
      };
    }
  };

  const getMissingEvaluations = (preop: PreOpEvaluation): string[] => {
    const missing: string[] = [];
    if (!preop.lab_tests_done) missing.push('Lab Tests');
    if (!preop.ecg_done) missing.push('ECG');
    if (!preop.chest_xray_done) missing.push('Chest X-ray');
    if (!preop.anesthesia_clearance) missing.push('Anesthesia Clearance');
    if (!preop.consent_signed) missing.push('Informed Consent');
    if (!preop.site_marking_done) missing.push('Surgical Site Marking');
    if (!preop.blood_crossmatched) missing.push('Blood Crossmatch');
    return missing;
  };

  const handlePatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pid = e.target.value;
    if (!pid) return;
    const patient = patients.find((p) => String(p.id) === pid);
    if (patient) {
      let age: number | undefined = undefined;
      try {
        const dob = new Date(patient.dob);
        if (!isNaN(dob.getTime())) {
          const diff = Date.now() - dob.getTime();
          age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }
      } catch {}
      setFormData(prev => ({
        ...prev,
        patient_id: String(patient.id),
        patient_name: `${patient.first_name} ${patient.last_name}`,
        hospital_number: patient.hospital_number,
        patient_age: age,
        patient_gender: patient.sex,
        ward: patient.ward_id || '',
      }));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'operation' | 'xray') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imagePromises = Array.from(files).map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then((images) => {
      if (type === 'operation') {
        setFormData(prev => ({ 
          ...prev, 
          operation_site_images: [...prev.operation_site_images, ...images] 
        }));
      } else {
        setFormData(prev => ({ 
          ...prev, 
          xray_images: [...prev.xray_images, ...images] 
        }));
      }
    });
  };

  const removeImage = (index: number, type: 'operation' | 'xray') => {
    if (type === 'operation') {
      setFormData(prev => ({
        ...prev,
        operation_site_images: prev.operation_site_images.filter((_, i) => i !== index)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        xray_images: prev.xray_images.filter((_, i) => i !== index)
      }));
    }
  };

  const updateTreatmentPlan = async () => {
    if (!formData.patient_id || !formData.clinical_condition_change) {
      alert('Please select a patient and document the clinical condition change.');
      return;
    }

    try {
      // Get current treatment plan for patient
      const treatmentPlans = await db.treatment_plans
        .where('patient_id')
        .equals(Number(formData.patient_id))
        .toArray();

      if (treatmentPlans.length === 0) {
        alert('No treatment plan found for this patient. Please create a treatment plan first.');
        return;
      }

      // Get the most recent active treatment plan
      const activePlan = treatmentPlans
        .filter(plan => plan.status === 'active')
        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

      if (!activePlan) {
        alert('No active treatment plan found for this patient.');
        return;
      }

      // Update the treatment plan with clinical change documentation
      const updatedNotes = `${activePlan.notes || ''}\n\n--- CLINICAL CONDITION CHANGE (${format(new Date(), 'yyyy-MM-dd HH:mm')}) ---\n${formData.clinical_condition_change}\n\nTreatment plan updated accordingly. New surgical plan: ${formData.procedure_name}`;

      await db.treatment_plans.update(activePlan.id!, {
        notes: updatedNotes,
        updated_at: new Date()
      });

      setFormData(prev => ({ ...prev, treatment_plan_updated: true }));
      alert('Treatment plan updated successfully with clinical condition change documentation.');
    } catch (error) {
      console.error('Error updating treatment plan:', error);
      alert('Failed to update treatment plan. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate pre-op requirements
    const preOpComplete = formData.lab_tests_done && 
                          formData.ecg_done && 
                          formData.chest_xray_done && 
                          formData.anesthesia_clearance && 
                          formData.consent_signed && 
                          formData.site_marking_done && 
                          formData.blood_crossmatched;

    if (!preOpComplete) {
      const missing: string[] = [];
      if (!formData.lab_tests_done) missing.push('Lab Tests');
      if (!formData.ecg_done) missing.push('ECG');
      if (!formData.chest_xray_done) missing.push('Chest X-ray');
      if (!formData.anesthesia_clearance) missing.push('Anesthesia Clearance');
      if (!formData.consent_signed) missing.push('Informed Consent');
      if (!formData.site_marking_done) missing.push('Surgical Site Marking');
      if (!formData.blood_crossmatched) missing.push('Blood Crossmatch');
      
      alert(`Cannot book surgery. Missing pre-operative evaluations:\n- ${missing.join('\n- ')}`);
      return;
    }

    try {
      const bookingPayload: any = {
        date: new Date(formData.date),
        theatre_number: formData.theatre_number || 'TBD',
        start_time: formData.start_time,
        estimated_end_time: '',
        primary_surgeon: formData.primary_surgeon,
        anaesthetist: '',
        scrub_nurse: '',
        circulating_nurse: '',
        patient_id: formData.patient_id,
        patient_name: formData.patient_name,
        hospital_number: formData.hospital_number,
        patient_age: formData.patient_age,
        patient_gender: formData.patient_gender,
        indication: formData.indication,
        ward: formData.ward,
        procedure_name: formData.procedure_name,
        procedure_code: '',
        urgency: 'elective' as 'elective',
        anaesthesia_type: formData.anaesthesia_type,
        estimated_duration_minutes: formData.estimated_duration_minutes,
        status: 'scheduled',
        remarks: formData.remarks,
        consultants: formData.consultants,
        senior_registrars: formData.senior_registrars,
        registrars: formData.registrars,
        house_officers: formData.house_officers,
        operation_site_image: formData.operation_site_images[0], // First image for backward compatibility
        operation_site_images: JSON.stringify(formData.operation_site_images),
        xray_images: JSON.stringify(formData.xray_images),
        clinical_condition_change: formData.clinical_condition_change,
        clinical_condition_date: formData.clinical_condition_date,
        special_requirements: [],
        equipment_needed: [],
        implants_needed: [],
        allergies: [],
        medical_conditions: [],
        pre_op_checklist_completed: true,
        consent_obtained: formData.consent_signed,
        notes: formData.clinical_condition_change ? `Clinical Condition Change: ${formData.clinical_condition_change}` : ''
      };

      await schedulingService.createSurgeryBooking(bookingPayload);
      setShowBookingForm(false);
      loadSurgeries();
      onRefresh();
      
      // Reset form
      setFormData({
        patient_id: '',
        patient_name: '',
        hospital_number: '',
        patient_age: undefined,
        patient_gender: '',
        indication: '',
        ward: '',
        procedure_name: '',
        anaesthesia_type: 'general',
        remarks: [],
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: '08:00',
        estimated_duration_minutes: 120,
        theatre_number: '',
        primary_surgeon: '',
        consultants: [],
        senior_registrars: [],
        registrars: [],
        house_officers: [],
        operation_site_images: [],
        xray_images: [],
        clinical_condition_change: '',
        clinical_condition_date: '',
        treatment_plan_updated: false,
        lab_tests_done: false,
        ecg_done: false,
        chest_xray_done: false,
        anesthesia_clearance: false,
        consent_signed: false,
        site_marking_done: false,
        blood_crossmatched: false,
      });
    } catch (error) {
      console.error('Error creating surgery booking:', error);
      alert('Failed to book surgery. Please try again.');
    }
  };

  const viewPatientSummary = (surgery: PatientSurgeryDetails) => {
    setSelectedSurgery(surgery);
    setShowPatientSummary(true);
  };

  const viewOperationSiteImage = (surgery: PatientSurgeryDetails) => {
    setSelectedSurgery(surgery);
    // Try to parse multiple images if stored as JSON
    try {
      const images = surgery.operation_site_images ? JSON.parse(surgery.operation_site_images as any) : 
                     surgery.operation_site_image ? [surgery.operation_site_image] : [];
      setViewingImages(images);
      setCurrentImageIndex(0);
      setShowImageViewer(true);
    } catch {
      // Fallback to single image
      setViewingImages(surgery.operation_site_image ? [surgery.operation_site_image] : []);
      setCurrentImageIndex(0);
      setShowImageViewer(true);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header with Date Filter */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <h2 className="text-xl font-semibold text-gray-900">Surgery Schedule</h2>
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-500" />
            <input
              type="date"
              value={format(filterDate, 'yyyy-MM-dd')}
              onChange={(e) => setFilterDate(new Date(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <button
          onClick={() => setShowBookingForm(true)}
          className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Book Surgery</span>
        </button>
      </div>

      {/* Surgery List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading surgeries...</p>
        </div>
      ) : surgeries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p>No surgeries scheduled for {format(filterDate, 'MMMM d, yyyy')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {surgeries.map((surgery) => (
            <div 
              key={surgery.id} 
              className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                surgery.preop_evaluations_complete ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {surgery.preop_evaluations_complete ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-red-600" />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{surgery.procedure_name}</h3>
                    <p className="text-sm text-gray-600">
                      Theatre {surgery.theatre_number} • {surgery.start_time} • {surgery.estimated_duration_minutes} min
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => viewPatientSummary(surgery)}
                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                    title="View Patient Summary"
                  >
                    <FileText className="h-5 w-5" />
                  </button>
                  {surgery.operation_site_image && (
                    <button
                      onClick={() => viewOperationSiteImage(surgery)}
                      className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                      title="View Operation Site Image"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <span className="text-sm font-medium text-gray-500">Patient:</span>
                  <p className="text-sm text-gray-900">{surgery.patient_name}</p>
                  <p className="text-xs text-gray-600">{surgery.hospital_number}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Surgeon:</span>
                  <p className="text-sm text-gray-900">{surgery.primary_surgeon}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Indication:</span>
                  <p className="text-sm text-gray-900">{surgery.indication}</p>
                </div>
              </div>

              {/* Pre-op Status */}
              <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">Pre-operative Evaluation Status:</span>
                  {surgery.preop_evaluations_complete ? (
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">All Complete</span>
                  ) : (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
                      {surgery.missing_evaluations?.length} Missing
                    </span>
                  )}
                </div>
                
                {!surgery.preop_evaluations_complete && surgery.missing_evaluations && (
                  <div className="mt-2">
                    <span className="text-xs font-medium text-red-700">Missing:</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {surgery.missing_evaluations.map((item, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {surgery.preop_evaluation && (
                  <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(surgery.preop_evaluation).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-1">
                        {value ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <XCircle className="h-3 w-3 text-red-600" />
                        )}
                        <span className="text-xs text-gray-600">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Patient Summary Modal */}
      {showPatientSummary && selectedSurgery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Patient Surgery Summary</h3>
              <button
                onClick={() => setShowPatientSummary(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Patient Demographics */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Patient Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-sm text-gray-500">Name:</span>
                    <p className="font-medium">{selectedSurgery.patient_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Hospital Number:</span>
                    <p className="font-medium">{selectedSurgery.hospital_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Age:</span>
                    <p className="font-medium">{selectedSurgery.patient_age} years</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Gender:</span>
                    <p className="font-medium">{selectedSurgery.patient_gender}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Ward:</span>
                    <p className="font-medium">{selectedSurgery.ward}</p>
                  </div>
                </div>
              </div>

              {/* Surgery Details */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-3">Surgery Details</h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">Procedure:</span>
                    <p className="font-medium">{selectedSurgery.procedure_name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Indication:</span>
                    <p className="font-medium">{selectedSurgery.indication}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Date & Time:</span>
                    <p className="font-medium">
                      {format(new Date(selectedSurgery.date), 'MMMM d, yyyy')} at {selectedSurgery.start_time}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Theatre:</span>
                    <p className="font-medium">{selectedSurgery.theatre_number}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Anaesthesia Type:</span>
                    <p className="font-medium capitalize">{selectedSurgery.anaesthesia_type}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Estimated Duration:</span>
                    <p className="font-medium">{selectedSurgery.estimated_duration_minutes} minutes</p>
                  </div>
                </div>
              </div>

              {/* Surgical Team */}
              {(selectedSurgery.consultants?.length || selectedSurgery.senior_registrars?.length || 
                selectedSurgery.registrars?.length || selectedSurgery.house_officers?.length) && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Surgical Team</h4>
                  {selectedSurgery.consultants && selectedSurgery.consultants.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-500">Consultants:</span>
                      <p className="text-sm">{selectedSurgery.consultants.join(', ')}</p>
                    </div>
                  )}
                  {selectedSurgery.senior_registrars && selectedSurgery.senior_registrars.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-500">Senior Registrars:</span>
                      <p className="text-sm">{selectedSurgery.senior_registrars.join(', ')}</p>
                    </div>
                  )}
                  {selectedSurgery.registrars && selectedSurgery.registrars.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm font-medium text-gray-500">Registrars:</span>
                      <p className="text-sm">{selectedSurgery.registrars.join(', ')}</p>
                    </div>
                  )}
                  {selectedSurgery.house_officers && selectedSurgery.house_officers.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">House Officers:</span>
                      <p className="text-sm">{selectedSurgery.house_officers.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Pre-operative Evaluation Checklist */}
              <div className={`p-4 rounded-lg ${
                selectedSurgery.preop_evaluations_complete ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <h4 className="font-semibold text-gray-900 mb-3">Pre-operative Evaluation Checklist</h4>
                {selectedSurgery.preop_evaluation && (
                  <div className="space-y-2">
                    {Object.entries(selectedSurgery.preop_evaluation).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        {value ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {!selectedSurgery.preop_evaluations_complete && (
                  <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-800">Missing Evaluations:</p>
                        <ul className="text-sm text-red-700 mt-1 list-disc list-inside">
                          {selectedSurgery.missing_evaluations?.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks */}
              {selectedSurgery.remarks && selectedSurgery.remarks.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-3">Special Requirements</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedSurgery.remarks.map((remark, idx) => (
                      <span key={idx} className="text-xs px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                        {remark}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Operation Site Image Viewer - Multiple Images Support */}
      {showImageViewer && viewingImages.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-5xl w-full mx-4 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Operation Site Images {viewingImages.length > 1 && `(${currentImageIndex + 1} of ${viewingImages.length})`}
              </h3>
              <button
                onClick={() => {
                  setShowImageViewer(false);
                  setViewingImages([]);
                  setCurrentImageIndex(0);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="relative">
              <div className="flex justify-center items-center min-h-[60vh]">
                <img
                  src={viewingImages[currentImageIndex]}
                  alt={`Operation Site ${currentImageIndex + 1}`}
                  className="max-w-full max-h-[65vh] rounded-lg object-contain"
                />
              </div>
              
              {/* Navigation arrows for multiple images */}
              {viewingImages.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : viewingImages.length - 1))}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-3 shadow-lg"
                  >
                    <svg className="h-6 w-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentImageIndex(prev => (prev < viewingImages.length - 1 ? prev + 1 : 0))}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-3 shadow-lg"
                  >
                    <svg className="h-6 w-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>
            
            {/* Thumbnail navigation */}
            {viewingImages.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {viewingImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 ${currentImageIndex === idx ? 'ring-2 ring-green-500' : ''}`}
                  >
                    <img
                      src={img}
                      alt={`Thumbnail ${idx + 1}`}
                      className="h-16 w-20 object-cover rounded"
                    />
                  </button>
                ))}
              </div>
            )}
            
            <div className="mt-4 text-center text-sm text-gray-600">
              <p className="font-medium">{selectedSurgery?.patient_name}</p>
              <p>{selectedSurgery?.procedure_name}</p>
            </div>
          </div>
        </div>
      )}

      {/* Booking Form Modal - Continue with existing form but add pre-op checkboxes */}
      {showBookingForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Book Surgery - Pre-op Requirements Mandatory</h3>
              <button
                onClick={() => setShowBookingForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Patient Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient *</label>
                <select
                  value={formData.patient_id}
                  onChange={handlePatientSelect}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">-- Select Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name} ({p.hospital_number})
                    </option>
                  ))}
                </select>
              </div>

              {/* Surgery Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Procedure Name *</label>
                  <input
                    type="text"
                    value={formData.procedure_name}
                    onChange={(e) => setFormData({ ...formData, procedure_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Indication *</label>
                  <input
                    type="text"
                    value={formData.indication}
                    onChange={(e) => setFormData({ ...formData, indication: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Theatre Number *</label>
                  <input
                    type="text"
                    value={formData.theatre_number}
                    onChange={(e) => setFormData({ ...formData, theatre_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Surgeon *</label>
                  <input
                    type="text"
                    value={formData.primary_surgeon}
                    onChange={(e) => setFormData({ ...formData, primary_surgeon: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time *</label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
                  <input
                    type="number"
                    value={formData.estimated_duration_minutes}
                    onChange={(e) => setFormData({ ...formData, estimated_duration_minutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>

              {/* Clinical Condition Change Documentation */}
              {formData.patient_id && (
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    Clinical Condition Change (if applicable)
                  </h4>
                  <p className="text-sm text-blue-700 mb-3">
                    If there has been a change in the patient's clinical condition that affects the treatment plan, document it here.
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date of Clinical Change
                      </label>
                      <input
                        type="date"
                        value={formData.clinical_condition_date}
                        onChange={(e) => setFormData({ ...formData, clinical_condition_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Describe Clinical Condition Change *
                      </label>
                      <textarea
                        value={formData.clinical_condition_change}
                        onChange={(e) => setFormData({ ...formData, clinical_condition_change: e.target.value })}
                        rows={4}
                        placeholder="Document any changes in patient condition, new findings, complications, or modifications to surgical plan..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {formData.clinical_condition_change && !formData.treatment_plan_updated && (
                      <button
                        type="button"
                        onClick={updateTreatmentPlan}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Update Treatment Plan with Clinical Change
                      </button>
                    )}
                    {formData.treatment_plan_updated && (
                      <div className="p-3 bg-green-100 border border-green-300 rounded flex items-center">
                        <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                        <span className="text-sm text-green-800">Treatment plan updated successfully</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Operation Site Images Upload - Multiple */}
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Operation Site Images (Multiple allowed)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e, 'operation')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {formData.operation_site_images.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">{formData.operation_site_images.length} image(s) uploaded</p>
                    <div className="grid grid-cols-3 gap-2">
                      {formData.operation_site_images.map((img, idx) => (
                        <div key={idx} className="relative">
                          <img src={img} alt={`Operation site ${idx + 1}`} className="h-24 w-full object-cover rounded" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx, 'operation')}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* X-ray/CT Images Upload - Optional */}
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  X-ray/CT Images for Surgical Planning (Optional)
                </label>
                <p className="text-xs text-gray-500 mb-2">Upload relevant imaging studies to aid surgical planning</p>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e, 'xray')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                {formData.xray_images.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 mb-2">{formData.xray_images.length} imaging file(s) uploaded</p>
                    <div className="grid grid-cols-3 gap-2">
                      {formData.xray_images.map((img, idx) => (
                        <div key={idx} className="relative">
                          <img src={img} alt={`X-ray/CT ${idx + 1}`} className="h-24 w-full object-cover rounded" />
                          <button
                            type="button"
                            onClick={() => removeImage(idx, 'xray')}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-operative Evaluation Checklist - MANDATORY */}
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-3 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  Pre-operative Evaluation Requirements (All Must Be Completed)
                </h4>
                <div className="space-y-2">
                  {[
                    { key: 'lab_tests_done', label: 'Lab Tests Completed' },
                    { key: 'ecg_done', label: 'ECG Done' },
                    { key: 'chest_xray_done', label: 'Chest X-ray Done' },
                    { key: 'anesthesia_clearance', label: 'Anesthesia Clearance Obtained' },
                    { key: 'consent_signed', label: 'Informed Consent Signed' },
                    { key: 'site_marking_done', label: 'Surgical Site Marked' },
                    { key: 'blood_crossmatched', label: 'Blood Crossmatched' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[key as keyof typeof formData] as boolean}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                        className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-xs text-red-700 font-medium">
                  ⚠️ Surgery cannot be booked unless all pre-operative evaluations are completed
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Book Surgery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
