import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  X,
  User,
  Footprints,
  Heart,
  Droplets,
  Activity,
  Stethoscope,
  Bone,
  FileText,
  CheckCircle,
  Search,
  UserPlus,
  Download,
  ClipboardList,
  MessageSquare,
  Upload,
  FileCheck,
  Printer,
  TestTube,
  Camera as CameraIcon,
  AlertTriangle,
  Info
} from 'lucide-react';
import { DiabeticFootAssessment } from '../../services/diabeticFootService';
import { patientService } from '../../services/patientService';
import { dopplerRequestService, DopplerRequestData } from '../../services/dopplerRequestService';

interface Patient {
  id: string;
  hospital_number: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  date_of_birth: string;
  gender: string;
  phone?: string;
}

interface Props {
  patientId?: string;
  existingAssessment?: DiabeticFootAssessment;
  onSave: (assessment: DiabeticFootAssessment) => void;
  onCancel: () => void;
}

// Step definitions
const STEPS = [
  { id: 1, name: 'Patient Info', icon: User, description: 'Demographics & history' },
  { id: 2, name: 'Wound Grade', icon: Footprints, description: 'Wagner, Texas, WIfI, SINBAD' },
  { id: 3, name: 'Comorbidities', icon: Heart, description: 'Medical conditions' },
  { id: 4, name: 'Renal Status', icon: Droplets, description: 'Kidney function' },
  { id: 5, name: 'Sepsis', icon: Activity, description: 'Infection assessment' },
  { id: 6, name: 'Vascular', icon: Stethoscope, description: 'Arterial & venous doppler' },
  { id: 7, name: 'Osteomyelitis', icon: Bone, description: 'Bone infection' },
  { id: 8, name: 'Results', icon: FileText, description: 'Score & recommendations' },
];

export const DiabeticFootAssessmentForm: React.FC<Props> = ({
  patientId,
  existingAssessment,
  onSave,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Patient selection state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientSelector, setShowPatientSelector] = useState(!patientId);

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const fetchedPatients = await patientService.getAllPatients();
      setPatients(fetchedPatients);
      
      // If patientId is provided, find and select the patient
      if (patientId) {
        const patient = fetchedPatients.find((p: Patient) => p.id === patientId);
        if (patient) {
          setSelectedPatient(patient);
          setShowPatientSelector(false);
        }
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoadingPatients(false);
    }
  };

  const filteredPatients = patients.filter(patient => {
    const fullName = patient.full_name || `${patient.first_name} ${patient.last_name}`;
    return fullName.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
           (patient.hospital_number || '').toLowerCase().includes(patientSearchTerm.toLowerCase());
  });

  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setShowPatientSelector(false);
    // Pre-fill gender if patient has it
    if (patient.gender) {
      setFormData(prev => ({ ...prev, gender: patient.gender.toLowerCase() === 'male' ? 'male' : 'female' }));
    }
    // Calculate and set age from date of birth
    if (patient.date_of_birth) {
      const birthDate = new Date(patient.date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, age }));
    }
  };

  // Form state - we'll add more as we build each section
  const [formData, setFormData] = useState({
    // Step 1: Demographics
    age: 0,
    gender: 'male' as 'male' | 'female',
    weight: 70, // Weight in kg for eGFR calculation
    diabetesType: 'type2' as 'type1' | 'type2',
    diabetesDuration: 0,
    smokingStatus: 'never' as 'current' | 'former' | 'never',
    ambulatoryStatus: 'ambulatory' as 'ambulatory' | 'limited' | 'non-ambulatory',
    
    // Step 2: Wound Classification
    wagnerGrade: 0 as 0 | 1 | 2 | 3 | 4 | 5,
    texasGrade: 0 as 0 | 1 | 2 | 3,
    texasStage: 'A' as 'A' | 'B' | 'C' | 'D',
    wifiWound: 0 as 0 | 1 | 2 | 3,
    wifiIschemia: 0 as 0 | 1 | 2 | 3,
    wifiInfection: 0 as 0 | 1 | 2 | 3,
    sinbadSite: 0 as 0 | 1,
    sinbadIschemia: 0 as 0 | 1,
    sinbadNeuropathy: 0 as 0 | 1,
    sinbadInfection: 0 as 0 | 1,
    sinbadArea: 0 as 0 | 1,
    sinbadDepth: 0 as 0 | 1,
    
    // Step 3: Comorbidities
    hypertension: false,
    coronaryArteryDisease: false,
    congestiveHeartFailure: false,
    cerebrovascularDisease: false,
    peripheralVascularDisease: false,
    chronicKidneyDisease: false,
    dialysis: false,
    retinopathy: false,
    neuropathy: false,
    previousAmputation: false,
    immunosuppression: false,
    malnutrition: false,
    obesity: false,
    anemia: false,
    malignancy: false,
    hba1c: 7.0,
    bloodSugarControl: 'moderate' as 'good' | 'moderate' | 'poor',
    
    // Step 4: Renal Status
    creatinine: 1.0,
    bun: 15,
    egfr: 90,
    dialysisDependent: false,
    dialysisType: 'hemodialysis' as 'hemodialysis' | 'peritoneal',
    dialysisVintage: 0,
    
    // Step 5: Sepsis
    temperature: 37.0,
    heartRate: 80,
    respiratoryRate: 16,
    wbc: 8.0,
    alteredMentation: false,
    systolicBP: 120,
    crp: 5,
    procalcitonin: 0.1,
    lactate: 1.0,
    fever: false,
    chills: false,
    localCellulitis: false,
    lymphangitis: false,
    purulentDischarge: false,
    crepitus: false,
    foulSmell: false,
    
    // Step 6: Vascular
    abiRight: 1.0,
    abiLeft: 1.0,
    affectedSide: 'right' as 'right' | 'left',
    toePressure: 60,
    waveformType: 'triphasic' as 'triphasic' | 'biphasic' | 'monophasic' | 'absent',
    dorsalisPedis: 'normal' as 'normal' | 'reduced' | 'absent',
    posteriorTibial: 'normal' as 'normal' | 'reduced' | 'absent',
    peroneal: 'normal' as 'normal' | 'reduced' | 'absent',
    stenosisPresent: false,
    stenosisLocation: '',
    stenosisSeverity: 'mild' as 'mild' | 'moderate' | 'severe' | 'occlusion',
    vesselCalcification: false,
    incompressibleVessels: false,
    dvtPresent: false,
    chronicVenousInsufficiency: false,
    venousReflux: false,
    edemaGrade: 0 as 0 | 1 | 2 | 3,
    
    // Step 7: Osteomyelitis
    probeToBone: false,
    visibleBone: false,
    sausageToe: false,
    xrayFindings: 'normal' as 'normal' | 'suspicious' | 'definite',
    mriPerformed: false,
    mriFinding: 'negative' as 'negative' | 'suspicious' | 'positive',
    boneBiopsyPerformed: false,
    boneBiopsyResult: 'negative' as 'negative' | 'positive',
    esr: 20,
    ulcerDuration: 2,
    previousAntibioticCourses: 0,
  });

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // TODO: Build full assessment and calculate scores
    console.log('Submitting:', formData);
    setIsSubmitting(false);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Demographics 
            formData={formData} 
            setFormData={setFormData}
            selectedPatient={selectedPatient}
            onChangePatient={() => setShowPatientSelector(true)}
          />
        );
      case 2:
        return <Step2WoundGrade formData={formData} setFormData={setFormData} />;
      case 3:
        return <Step3Comorbidities formData={formData} setFormData={setFormData} />;
      case 4:
        return <Step4RenalStatus formData={formData} setFormData={setFormData} />;
      case 5:
        return <Step5Sepsis formData={formData} setFormData={setFormData} />;
      case 6:
        return <Step6Vascular formData={formData} setFormData={setFormData} />;
      case 7:
        return <Step7Osteomyelitis formData={formData} setFormData={setFormData} />;
      case 8:
        return <Step8Results formData={formData} selectedPatient={selectedPatient} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Diabetic Foot Assessment
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Step Progress */}
      <div className="px-6 py-4 bg-gray-50 border-b overflow-x-auto">
        <div className="flex space-x-2 min-w-max">
          {STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                currentStep === step.id
                  ? 'bg-primary-100 text-primary-700 border border-primary-300'
                  : step.id < currentStep
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <step.icon className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium whitespace-nowrap">{step.name}</span>
              {step.id < currentStep && (
                <CheckCircle className="w-4 h-4 ml-2 text-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6 min-h-[400px]">
        {renderStepContent()}
      </div>

      {/* Footer Navigation */}
      <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`flex items-center px-4 py-2 rounded-lg ${
            currentStep === 1
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Previous
        </button>

        <div className="flex space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          
          {currentStep === STEPS.length ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-5 h-5 mr-2" />
              {isSubmitting ? 'Saving...' : 'Save Assessment'}
            </button>
          ) : (
            <button
              onClick={nextStep}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Next
              <ChevronRight className="w-5 h-5 ml-1" />
            </button>
          )}
        </div>
      </div>

      {/* Patient Selector Modal */}
      {showPatientSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-primary-600 text-white p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold mb-1">Select Patient</h2>
                  <p className="text-primary-100 text-sm">
                    Choose a patient for the diabetic foot assessment
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (selectedPatient) {
                      setShowPatientSelector(false);
                    } else {
                      onCancel();
                    }
                  }}
                  className="text-white hover:text-primary-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name or hospital number..."
                  value={patientSearchTerm}
                  onChange={(e) => setPatientSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingPatients ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
                  Loading patients...
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {patientSearchTerm ? 'No patients found matching your search' : 'No patients available'}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => handlePatientSelect(patient)}
                      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary-100 rounded-lg text-primary-600">
                          <User className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900">
                            {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            <span className="font-medium">Hospital #:</span> {patient.hospital_number}
                          </div>
                          <div className="flex gap-4 mt-1 text-xs text-gray-500">
                            <span>{patient.gender}</span>
                            {patient.date_of_birth && <span>DOB: {new Date(patient.date_of_birth).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-600 text-center">
                Select a patient to begin the diabetic foot assessment
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Step 1: Demographics
interface Step1Props {
  formData: any;
  setFormData: any;
  selectedPatient: Patient | null;
  onChangePatient: () => void;
}

const Step1Demographics: React.FC<Step1Props> = ({ formData, setFormData, selectedPatient, onChangePatient }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Patient Demographics & History</h3>
      
      {/* Selected Patient Display */}
      {selectedPatient && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <User className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <div className="font-semibold text-gray-900">
                  {selectedPatient.full_name || `${selectedPatient.first_name} ${selectedPatient.last_name}`}
                </div>
                <div className="text-sm text-gray-600">
                  Hospital #: {selectedPatient.hospital_number}
                </div>
              </div>
            </div>
            <button
              onClick={onChangePatient}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              Change Patient
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Age (years)</label>
          <input
            type="number"
            value={formData.age}
            onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select
            value={formData.gender}
            onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diabetes Type</label>
          <select
            value={formData.diabetesType}
            onChange={(e) => setFormData({ ...formData, diabetesType: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          >
            <option value="type1">Type 1</option>
            <option value="type2">Type 2</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diabetes Duration (years)</label>
          <input
            type="number"
            value={formData.diabetesDuration}
            onChange={(e) => setFormData({ ...formData, diabetesDuration: parseInt(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Smoking Status</label>
          <select
            value={formData.smokingStatus}
            onChange={(e) => setFormData({ ...formData, smokingStatus: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          >
            <option value="never">Never Smoked</option>
            <option value="former">Former Smoker</option>
            <option value="current">Current Smoker</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ambulatory Status</label>
          <select
            value={formData.ambulatoryStatus}
            onChange={(e) => setFormData({ ...formData, ambulatoryStatus: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500"
          >
            <option value="ambulatory">Fully Ambulatory</option>
            <option value="limited">Limited Mobility</option>
            <option value="non-ambulatory">Non-Ambulatory</option>
          </select>
        </div>
      </div>
    </div>
  );
};

// Step 2: Wound Grade
const Step2WoundGrade: React.FC<{ formData: any; setFormData: any }> = ({ formData, setFormData }) => {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Wound Classification</h3>
      
      {/* Wagner Classification */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Wagner Classification</h4>
        <select
          value={formData.wagnerGrade}
          onChange={(e) => setFormData({ ...formData, wagnerGrade: parseInt(e.target.value) })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value={0}>Grade 0 - Pre-ulcerative lesion, healed ulcer, or bony deformity</option>
          <option value={1}>Grade 1 - Superficial ulcer without subcutaneous tissue involvement</option>
          <option value={2}>Grade 2 - Deep ulcer exposing bone, tendon, or joint</option>
          <option value={3}>Grade 3 - Deep ulcer with abscess or osteomyelitis</option>
          <option value={4}>Grade 4 - Gangrene of forefoot or heel</option>
          <option value={5}>Grade 5 - Gangrene of entire foot</option>
        </select>
      </div>

      {/* University of Texas Classification */}
      <div className="bg-green-50 p-4 rounded-lg">
        <h4 className="font-medium text-green-900 mb-3">University of Texas Classification</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
            <select
              value={formData.texasGrade}
              onChange={(e) => setFormData({ ...formData, texasGrade: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={0}>Grade 0 - Pre/post-ulcerative, epithelialized</option>
              <option value={1}>Grade 1 - Superficial, not to tendon/capsule/bone</option>
              <option value={2}>Grade 2 - Penetrates to tendon or capsule</option>
              <option value={3}>Grade 3 - Penetrates to bone or joint</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
            <select
              value={formData.texasStage}
              onChange={(e) => setFormData({ ...formData, texasStage: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="A">Stage A - No infection or ischemia</option>
              <option value="B">Stage B - Infection present</option>
              <option value="C">Stage C - Ischemia present</option>
              <option value="D">Stage D - Infection AND ischemia</option>
            </select>
          </div>
        </div>
      </div>

      {/* WIfI Classification */}
      <div className="bg-orange-50 p-4 rounded-lg">
        <h4 className="font-medium text-orange-900 mb-3">WIfI Classification (Wound, Ischemia, foot Infection)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Wound (W)</label>
            <select
              value={formData.wifiWound}
              onChange={(e) => setFormData({ ...formData, wifiWound: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={0}>0 - No ulcer/gangrene</option>
              <option value={1}>1 - Small shallow ulcer</option>
              <option value={2}>2 - Deeper ulcer, exposed bone</option>
              <option value={3}>3 - Extensive deep ulcer</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ischemia (I)</label>
            <select
              value={formData.wifiIschemia}
              onChange={(e) => setFormData({ ...formData, wifiIschemia: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={0}>0 - ABI ≥0.80</option>
              <option value={1}>1 - ABI 0.6-0.79</option>
              <option value={2}>2 - ABI 0.4-0.59</option>
              <option value={3}>3 - ABI &lt;0.4</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">foot Infection (fI)</label>
            <select
              value={formData.wifiInfection}
              onChange={(e) => setFormData({ ...formData, wifiInfection: parseInt(e.target.value) })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value={0}>0 - No infection</option>
              <option value={1}>1 - Mild (local, skin only)</option>
              <option value={2}>2 - Moderate (deeper tissue)</option>
              <option value={3}>3 - Severe (SIRS present)</option>
            </select>
          </div>
        </div>
      </div>

      {/* SINBAD Score */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-3">SINBAD Score</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.sinbadSite === 1}
              onChange={(e) => setFormData({ ...formData, sinbadSite: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Site: Forefoot (1 pt)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.sinbadIschemia === 1}
              onChange={(e) => setFormData({ ...formData, sinbadIschemia: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Ischemia present (1 pt)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.sinbadNeuropathy === 1}
              onChange={(e) => setFormData({ ...formData, sinbadNeuropathy: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Neuropathy present (1 pt)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.sinbadInfection === 1}
              onChange={(e) => setFormData({ ...formData, sinbadInfection: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Bacterial infection (1 pt)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.sinbadArea === 1}
              onChange={(e) => setFormData({ ...formData, sinbadArea: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Area &gt;1 cm² (1 pt)</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.sinbadDepth === 1}
              onChange={(e) => setFormData({ ...formData, sinbadDepth: e.target.checked ? 1 : 0 })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Depth: To tendon/bone (1 pt)</span>
          </label>
        </div>
        <p className="mt-2 text-sm text-purple-700">
          SINBAD Score: {formData.sinbadSite + formData.sinbadIschemia + formData.sinbadNeuropathy + 
            formData.sinbadInfection + formData.sinbadArea + formData.sinbadDepth}/6
        </p>
      </div>
    </div>
  );
};

// Step 3: Comorbidities
const Step3Comorbidities: React.FC<{ formData: any; setFormData: any }> = ({ formData, setFormData }) => {
  const toggleComorbidity = (key: string) => {
    setFormData({ ...formData, [key]: !formData[key] });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Comorbidities Assessment</h3>
      
      {/* Cardiovascular */}
      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="font-medium text-red-900 mb-3">Cardiovascular</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: 'hypertension', label: 'Hypertension' },
            { key: 'coronaryArteryDisease', label: 'Coronary Artery Disease' },
            { key: 'congestiveHeartFailure', label: 'Congestive Heart Failure' },
            { key: 'cerebrovascularDisease', label: 'Cerebrovascular Disease' },
            { key: 'peripheralVascularDisease', label: 'Peripheral Vascular Disease' },
          ].map(item => (
            <label key={item.key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData[item.key]}
                onChange={() => toggleComorbidity(item.key)}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Diabetes-related */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Diabetes-Related Complications</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: 'retinopathy', label: 'Diabetic Retinopathy' },
            { key: 'neuropathy', label: 'Diabetic Neuropathy' },
            { key: 'chronicKidneyDisease', label: 'Chronic Kidney Disease' },
            { key: 'dialysis', label: 'On Dialysis' },
            { key: 'previousAmputation', label: 'Previous Amputation' },
          ].map(item => (
            <label key={item.key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData[item.key]}
                onChange={() => toggleComorbidity(item.key)}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Other Conditions */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Other Conditions</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { key: 'immunosuppression', label: 'Immunosuppression' },
            { key: 'malnutrition', label: 'Malnutrition' },
            { key: 'obesity', label: 'Obesity (BMI >30)' },
            { key: 'anemia', label: 'Anemia' },
            { key: 'malignancy', label: 'Active Malignancy' },
          ].map(item => (
            <label key={item.key} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData[item.key]}
                onChange={() => toggleComorbidity(item.key)}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm">{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Glycemic Control */}
      <div className="bg-yellow-50 p-4 rounded-lg">
        <h4 className="font-medium text-yellow-900 mb-3">Glycemic Control</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HbA1c (%)</label>
            <input
              type="number"
              step="0.1"
              value={formData.hba1c}
              onChange={(e) => setFormData({ ...formData, hba1c: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.hba1c > 9 && (
              <p className="text-xs text-red-600 mt-1">⚠️ Poorly controlled - higher risk</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Recent Blood Sugar Control</label>
            <select
              value={formData.bloodSugarControl}
              onChange={(e) => setFormData({ ...formData, bloodSugarControl: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="good">Good (FBS 80-130 mg/dL consistently)</option>
              <option value="moderate">Moderate (Variable control)</option>
              <option value="poor">Poor (Frequent hyperglycemia)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

// Step 4: Renal Status
const Step4RenalStatus: React.FC<{ formData: any; setFormData: any }> = ({ formData, setFormData }) => {
  // Calculate eGFR using CKD-EPI equation (2021 formula without race adjustment)
  const calculateEGFR = (creatinine: number, age: number, gender: 'male' | 'female', weight: number): number => {
    if (creatinine <= 0 || age <= 0) return 0;
    
    // CKD-EPI 2021 equation (without race coefficient)
    // eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^-1.200 × 0.9938^age × (1.012 if female)
    // κ = 0.7 for females, 0.9 for males
    // α = -0.241 for females, -0.302 for males
    
    const isFemale = gender === 'female';
    const kappa = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.241 : -0.302;
    const genderMultiplier = isFemale ? 1.012 : 1;
    
    const scrOverKappa = creatinine / kappa;
    const minTerm = Math.pow(Math.min(scrOverKappa, 1), alpha);
    const maxTerm = Math.pow(Math.max(scrOverKappa, 1), -1.200);
    const ageTerm = Math.pow(0.9938, age);
    
    const egfr = 142 * minTerm * maxTerm * ageTerm * genderMultiplier;
    
    return Math.round(egfr);
  };

  // Auto-calculate eGFR when creatinine, age, gender, or weight changes
  React.useEffect(() => {
    if (formData.creatinine > 0 && formData.age > 0) {
      const calculatedEGFR = calculateEGFR(formData.creatinine, formData.age, formData.gender, formData.weight);
      if (calculatedEGFR !== formData.egfr) {
        setFormData((prev: any) => ({ ...prev, egfr: calculatedEGFR }));
      }
    }
  }, [formData.creatinine, formData.age, formData.gender, formData.weight]);

  // Calculate CKD Stage based on eGFR
  const getCKDStage = (egfr: number) => {
    if (egfr >= 90) return { stage: 1, label: 'Stage 1 - Normal', color: 'green' };
    if (egfr >= 60) return { stage: 2, label: 'Stage 2 - Mild decrease', color: 'yellow' };
    if (egfr >= 45) return { stage: 3, label: 'Stage 3a - Mild to moderate decrease', color: 'orange' };
    if (egfr >= 30) return { stage: 3, label: 'Stage 3b - Moderate to severe decrease', color: 'orange' };
    if (egfr >= 15) return { stage: 4, label: 'Stage 4 - Severe decrease', color: 'red' };
    return { stage: 5, label: 'Stage 5 - Kidney failure', color: 'red' };
  };

  const ckd = getCKDStage(formData.egfr);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Renal Status Assessment</h3>
      
      {/* Patient Parameters for eGFR Calculation */}
      <div className="bg-indigo-50 p-4 rounded-lg">
        <h4 className="font-medium text-indigo-900 mb-3">Patient Parameters for eGFR Calculation</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age (years)</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">From Step 1</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <input
              type="text"
              value={formData.gender === 'male' ? 'Male' : 'Female'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">From Step 1</p>
          </div>
        </div>
      </div>

      {/* Laboratory Values */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Laboratory Values</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Serum Creatinine (mg/dL)</label>
            <input
              type="number"
              step="0.01"
              value={formData.creatinine}
              onChange={(e) => setFormData({ ...formData, creatinine: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Enter creatinine"
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 0.7-1.3 mg/dL</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BUN (mg/dL)</label>
            <input
              type="number"
              value={formData.bun}
              onChange={(e) => setFormData({ ...formData, bun: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Normal: 7-20 mg/dL</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">eGFR (mL/min/1.73m²)</label>
            <div className="relative">
              <input
                type="number"
                value={formData.egfr}
                className="w-full border border-green-400 rounded-lg px-3 py-2 bg-green-50 font-semibold"
                readOnly
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-green-600 text-white px-2 py-0.5 rounded">
                Auto
              </span>
            </div>
            <p className="text-xs text-green-600 mt-1">✓ Calculated using CKD-EPI 2021</p>
          </div>
        </div>
      </div>

      {/* eGFR Formula Info */}
      <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
        <p className="font-medium mb-1">eGFR Calculation (CKD-EPI 2021 Equation):</p>
        <p className="text-xs">
          eGFR = 142 × min(Scr/κ, 1)<sup>α</sup> × max(Scr/κ, 1)<sup>-1.200</sup> × 0.9938<sup>age</sup> × (1.012 if female)
        </p>
        <p className="text-xs mt-1 text-gray-500">
          Where: κ = 0.7 (female) or 0.9 (male), α = -0.241 (female) or -0.302 (male)
        </p>
      </div>

      {/* CKD Stage Display */}
      <div className={`p-4 rounded-lg ${
        ckd.color === 'green' ? 'bg-green-100 border border-green-300' :
        ckd.color === 'yellow' ? 'bg-yellow-100 border border-yellow-300' :
        ckd.color === 'orange' ? 'bg-orange-100 border border-orange-300' :
        'bg-red-100 border border-red-300'
      }`}>
        <div className="flex items-center justify-between">
          <span className="font-medium">Calculated CKD Stage:</span>
          <span className="text-lg font-bold">{ckd.label}</span>
        </div>
        <div className="mt-2 text-sm">
          <p className="font-medium">eGFR: {formData.egfr} mL/min/1.73m²</p>
        </div>
        {ckd.stage >= 4 && (
          <p className="text-sm mt-2 text-red-700">
            ⚠️ Advanced CKD significantly impacts wound healing and surgical outcomes
          </p>
        )}
      </div>

      {/* Dialysis Status */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-3">Dialysis Status</h4>
        <div className="space-y-4">
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={formData.dialysisDependent}
              onChange={(e) => setFormData({ ...formData, dialysisDependent: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 h-5 w-5"
            />
            <span className="font-medium">Patient is dialysis-dependent</span>
          </label>

          {formData.dialysisDependent && (
            <div className="ml-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dialysis Type</label>
                <select
                  value={formData.dialysisType}
                  onChange={(e) => setFormData({ ...formData, dialysisType: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="hemodialysis">Hemodialysis</option>
                  <option value="peritoneal">Peritoneal Dialysis</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dialysis Vintage (months)</label>
                <input
                  type="number"
                  value={formData.dialysisVintage}
                  onChange={(e) => setFormData({ ...formData, dialysisVintage: parseInt(e.target.value) || 0 })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {formData.dialysisDependent && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-red-800 font-medium">⚠️ Important Considerations for Dialysis Patients:</p>
          <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
            <li>Higher risk of wound healing complications</li>
            <li>Coordinate surgery timing with dialysis schedule</li>
            <li>Monitor for volume overload and electrolyte abnormalities</li>
            <li>Consider vascular access preservation when planning procedures</li>
          </ul>
        </div>
      )}
    </div>
  );
};

// Step 5: Sepsis Assessment
const Step5Sepsis: React.FC<{ formData: any; setFormData: any }> = ({ formData, setFormData }) => {
  // Calculate SIRS Score
  const sirsScore = [
    formData.temperature > 38 || formData.temperature < 36,
    formData.heartRate > 90,
    formData.respiratoryRate > 20,
    formData.wbc > 12 || formData.wbc < 4
  ].filter(Boolean).length;

  // Calculate qSOFA Score
  const qsofaScore = [
    formData.alteredMentation,
    formData.systolicBP < 100,
    formData.respiratoryRate >= 22
  ].filter(Boolean).length;

  const getSepsisLikelihood = () => {
    if (sirsScore >= 2 && qsofaScore >= 2) return { label: 'Definite Sepsis', color: 'red', urgent: true };
    if (sirsScore >= 2 || qsofaScore >= 2) return { label: 'Probable Sepsis', color: 'orange', urgent: true };
    if (sirsScore === 1 || qsofaScore === 1) return { label: 'Possible Sepsis', color: 'yellow', urgent: false };
    return { label: 'Sepsis Unlikely', color: 'green', urgent: false };
  };

  const sepsis = getSepsisLikelihood();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Sepsis Assessment</h3>
      
      {/* Vital Signs - SIRS Criteria */}
      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="font-medium text-red-900 mb-3">SIRS Criteria (Vital Signs)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temperature (°C)</label>
            <input
              type="number"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) || 37 })}
              className={`w-full border rounded-lg px-3 py-2 ${
                formData.temperature > 38 || formData.temperature < 36 
                  ? 'border-red-500 bg-red-50' 
                  : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">Abnormal: &gt;38°C or &lt;36°C</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Heart Rate (bpm)</label>
            <input
              type="number"
              value={formData.heartRate}
              onChange={(e) => setFormData({ ...formData, heartRate: parseInt(e.target.value) || 80 })}
              className={`w-full border rounded-lg px-3 py-2 ${
                formData.heartRate > 90 ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">Abnormal: &gt;90 bpm</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Respiratory Rate (/min)</label>
            <input
              type="number"
              value={formData.respiratoryRate}
              onChange={(e) => setFormData({ ...formData, respiratoryRate: parseInt(e.target.value) || 16 })}
              className={`w-full border rounded-lg px-3 py-2 ${
                formData.respiratoryRate > 20 ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">Abnormal: &gt;20/min</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WBC (×10⁹/L)</label>
            <input
              type="number"
              step="0.1"
              value={formData.wbc}
              onChange={(e) => setFormData({ ...formData, wbc: parseFloat(e.target.value) || 8 })}
              className={`w-full border rounded-lg px-3 py-2 ${
                formData.wbc > 12 || formData.wbc < 4 ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">Abnormal: &gt;12 or &lt;4</p>
          </div>
        </div>
        <p className="mt-3 font-medium">SIRS Score: {sirsScore}/4 {sirsScore >= 2 && '⚠️'}</p>
      </div>

      {/* qSOFA */}
      <div className="bg-orange-50 p-4 rounded-lg">
        <h4 className="font-medium text-orange-900 mb-3">qSOFA Criteria</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center space-x-2 p-2 rounded bg-white">
            <input
              type="checkbox"
              checked={formData.alteredMentation}
              onChange={(e) => setFormData({ ...formData, alteredMentation: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 h-5 w-5"
            />
            <span className="text-sm">Altered Mental Status (GCS &lt;15)</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Systolic BP (mmHg)</label>
            <input
              type="number"
              value={formData.systolicBP}
              onChange={(e) => setFormData({ ...formData, systolicBP: parseInt(e.target.value) || 120 })}
              className={`w-full border rounded-lg px-3 py-2 ${
                formData.systolicBP < 100 ? 'border-red-500 bg-red-50' : 'border-gray-300'
              }`}
            />
            <p className="text-xs text-gray-500 mt-1">Abnormal: &lt;100 mmHg</p>
          </div>
          <div className="text-sm text-gray-600 p-2">
            <p>RR ≥22 (from above): {formData.respiratoryRate >= 22 ? '✓ Yes' : '✗ No'}</p>
          </div>
        </div>
        <p className="mt-3 font-medium">qSOFA Score: {qsofaScore}/3 {qsofaScore >= 2 && '⚠️'}</p>
      </div>

      {/* Laboratory Markers */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Inflammatory Markers</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CRP (mg/L)</label>
            <input
              type="number"
              value={formData.crp}
              onChange={(e) => setFormData({ ...formData, crp: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.crp > 100 && <p className="text-xs text-red-600 mt-1">⚠️ Significantly elevated</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Procalcitonin (ng/mL)</label>
            <input
              type="number"
              step="0.01"
              value={formData.procalcitonin}
              onChange={(e) => setFormData({ ...formData, procalcitonin: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.procalcitonin > 2 && <p className="text-xs text-red-600 mt-1">⚠️ High - bacterial sepsis likely</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lactate (mmol/L)</label>
            <input
              type="number"
              step="0.1"
              value={formData.lactate}
              onChange={(e) => setFormData({ ...formData, lactate: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.lactate > 2 && <p className="text-xs text-red-600 mt-1">⚠️ Elevated - tissue hypoperfusion</p>}
          </div>
        </div>
      </div>

      {/* Local Signs of Infection */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-3">Local Signs of Infection</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'fever', label: 'Fever/Chills' },
            { key: 'localCellulitis', label: 'Local Cellulitis' },
            { key: 'lymphangitis', label: 'Lymphangitis' },
            { key: 'purulentDischarge', label: 'Purulent Discharge' },
            { key: 'crepitus', label: 'Crepitus (Gas Gangrene!)' },
            { key: 'foulSmell', label: 'Foul Smell' },
          ].map(item => (
            <label key={item.key} className={`flex items-center space-x-2 p-2 rounded ${
              item.key === 'crepitus' && formData[item.key] ? 'bg-red-200' : 'bg-white'
            }`}>
              <input
                type="checkbox"
                checked={formData[item.key]}
                onChange={(e) => setFormData({ ...formData, [item.key]: e.target.checked })}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className={`text-sm ${item.key === 'crepitus' ? 'font-medium text-red-800' : ''}`}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Sepsis Summary */}
      <div className={`p-4 rounded-lg border-2 ${
        sepsis.color === 'red' ? 'bg-red-100 border-red-500' :
        sepsis.color === 'orange' ? 'bg-orange-100 border-orange-500' :
        sepsis.color === 'yellow' ? 'bg-yellow-100 border-yellow-500' :
        'bg-green-100 border-green-500'
      }`}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-lg">Sepsis Assessment:</span>
          <span className={`text-lg font-bold ${
            sepsis.color === 'red' || sepsis.color === 'orange' ? 'text-red-700' : ''
          }`}>
            {sepsis.label}
          </span>
        </div>
        {sepsis.urgent && (
          <p className="mt-2 text-red-800 font-medium">
            🚨 URGENT: Consider immediate surgical intervention and IV antibiotics
          </p>
        )}
        {formData.crepitus && (
          <p className="mt-2 text-red-800 font-bold">
            ⚠️ CREPITUS DETECTED - Suspect necrotizing fasciitis/gas gangrene - EMERGENCY SURGICAL DEBRIDEMENT REQUIRED
          </p>
        )}
      </div>
    </div>
  );
};

// Step 6: Vascular Assessment
const Step6Vascular: React.FC<{ formData: any; setFormData: any }> = ({ formData, setFormData }) => {
  const affectedABI = formData.affectedSide === 'right' ? formData.abiRight : formData.abiLeft;
  
  const getABIInterpretation = (abi: number) => {
    if (abi > 1.3) return { label: 'Non-compressible (calcified vessels)', color: 'orange', note: 'Use toe pressures' };
    if (abi >= 0.9) return { label: 'Normal', color: 'green', note: '' };
    if (abi >= 0.7) return { label: 'Mild PAD', color: 'yellow', note: '' };
    if (abi >= 0.5) return { label: 'Moderate PAD', color: 'orange', note: 'Consider revascularization' };
    return { label: 'Severe PAD / Critical Limb Ischemia', color: 'red', note: 'Urgent vascular consult' };
  };

  const abiResult = getABIInterpretation(affectedABI);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Vascular Assessment</h3>
      
      {/* Arterial Doppler */}
      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="font-medium text-red-900 mb-3">Arterial Doppler Findings</h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ABI - Right</label>
            <input
              type="number"
              step="0.01"
              value={formData.abiRight}
              onChange={(e) => setFormData({ ...formData, abiRight: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ABI - Left</label>
            <input
              type="number"
              step="0.01"
              value={formData.abiLeft}
              onChange={(e) => setFormData({ ...formData, abiLeft: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Affected Side</label>
            <select
              value={formData.affectedSide}
              onChange={(e) => setFormData({ ...formData, affectedSide: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </div>
        </div>

        <div className={`p-3 rounded mb-4 ${
          abiResult.color === 'red' ? 'bg-red-200' :
          abiResult.color === 'orange' ? 'bg-orange-200' :
          abiResult.color === 'yellow' ? 'bg-yellow-200' :
          'bg-green-200'
        }`}>
          <p className="font-medium">Affected Side ABI: {affectedABI.toFixed(2)} - {abiResult.label}</p>
          {abiResult.note && <p className="text-sm mt-1">{abiResult.note}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Toe Pressure (mmHg)</label>
            <input
              type="number"
              value={formData.toePressure}
              onChange={(e) => setFormData({ ...formData, toePressure: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.toePressure < 30 && (
              <p className="text-xs text-red-600 mt-1">⚠️ Critical ischemia (&lt;30 mmHg)</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Waveform Type</label>
            <select
              value={formData.waveformType}
              onChange={(e) => setFormData({ ...formData, waveformType: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="triphasic">Triphasic (Normal)</option>
              <option value="biphasic">Biphasic (Mild disease)</option>
              <option value="monophasic">Monophasic (Moderate-severe)</option>
              <option value="absent">Absent (Severe/Occlusion)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dorsalis Pedis</label>
            <select
              value={formData.dorsalisPedis}
              onChange={(e) => setFormData({ ...formData, dorsalisPedis: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="normal">Normal</option>
              <option value="reduced">Reduced</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Posterior Tibial</label>
            <select
              value={formData.posteriorTibial}
              onChange={(e) => setFormData({ ...formData, posteriorTibial: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="normal">Normal</option>
              <option value="reduced">Reduced</option>
              <option value="absent">Absent</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Peroneal</label>
            <select
              value={formData.peroneal}
              onChange={(e) => setFormData({ ...formData, peroneal: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="normal">Normal</option>
              <option value="reduced">Reduced</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.stenosisPresent}
              onChange={(e) => setFormData({ ...formData, stenosisPresent: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Stenosis Present</span>
          </label>
          {formData.stenosisPresent && (
            <select
              value={formData.stenosisSeverity}
              onChange={(e) => setFormData({ ...formData, stenosisSeverity: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="mild">Mild (&lt;50%)</option>
              <option value="moderate">Moderate (50-70%)</option>
              <option value="severe">Severe (&gt;70%)</option>
              <option value="occlusion">Complete Occlusion</option>
            </select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.vesselCalcification}
              onChange={(e) => setFormData({ ...formData, vesselCalcification: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Vessel Calcification</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.incompressibleVessels}
              onChange={(e) => setFormData({ ...formData, incompressibleVessels: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Incompressible Vessels</span>
          </label>
        </div>
      </div>

      {/* Venous Assessment */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Venous Assessment</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.dvtPresent}
              onChange={(e) => setFormData({ ...formData, dvtPresent: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">DVT Present</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.chronicVenousInsufficiency}
              onChange={(e) => setFormData({ ...formData, chronicVenousInsufficiency: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Chronic Venous Insufficiency</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.venousReflux}
              onChange={(e) => setFormData({ ...formData, venousReflux: e.target.checked })}
              className="rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">Venous Reflux</span>
          </label>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Edema Grade</label>
          <select
            value={formData.edemaGrade}
            onChange={(e) => setFormData({ ...formData, edemaGrade: parseInt(e.target.value) })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value={0}>Grade 0 - No edema</option>
            <option value={1}>Grade 1 - Mild, pitting ≤2mm</option>
            <option value={2}>Grade 2 - Moderate, pitting 2-4mm</option>
            <option value={3}>Grade 3 - Severe, pitting &gt;4mm</option>
          </select>
        </div>
      </div>

      {/* Vascular Summary */}
      {(affectedABI < 0.5 || formData.waveformType === 'absent') && (
        <div className="bg-red-100 border-2 border-red-500 p-4 rounded-lg">
          <p className="text-red-800 font-bold">⚠️ Critical Limb Ischemia Detected</p>
          <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
            <li>Urgent vascular surgery consultation required</li>
            <li>Consider angiography for revascularization planning</li>
            <li>Wound healing will be severely compromised without revascularization</li>
          </ul>
        </div>
      )}
      
      {/* Doppler Request PDF Button */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">📋 Generate Doppler Ultrasound Request</h4>
        <p className="text-sm text-blue-700 mb-4">
          Generate a comprehensive Doppler Ultrasound request form for radiology with all required vascular assessment parameters.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              const requestData: DopplerRequestData = {
                patientName: formData.patientName || '_________________________________',
                hospitalNumber: formData.hospitalNumber || '_______________',
                dateOfBirth: formData.dateOfBirth || '_______________',
                gender: formData.gender || 'male',
                ward: formData.ward || 'Plastic Surgery',
                bedNumber: formData.bedNumber,
                requestingPhysician: formData.assessedBy || '_________________________________',
                designation: 'Plastic Surgery Unit',
                clinicalDiagnosis: `Diabetic Foot - Wagner Grade ${formData.wagnerGrade || 'N/A'}`,
                reasonForRequest: 'Vascular assessment for limb salvage evaluation. Please assess arterial and venous circulation to determine revascularization needs.',
                relevantHistory: `Diabetes Type: ${formData.diabetesType || 'Type 2'}, Duration: ${formData.diabetesDuration || 'N/A'} years. ${formData.peripheralVascularDisease ? 'Known PVD. ' : ''}${formData.smokingStatus === 'current' ? 'Current smoker.' : ''}`,
                examinationType: 'both',
                arterialAssessment: {
                  abiRequired: true,
                  toePressureRequired: true,
                  waveformAnalysisRequired: true,
                  segmentalPressures: true,
                  pulseVolumeRecording: true,
                  specificVessels: {
                    commonFemoralArtery: true,
                    superficialFemoralArtery: true,
                    profundaFemoralArtery: true,
                    poplitealArtery: true,
                    anteriorTibialArtery: true,
                    posteriorTibialArtery: true,
                    peronealArtery: true,
                    dorsalisPedisArtery: true
                  }
                },
                venousAssessment: {
                  dvtScreening: true,
                  chronicVenousInsufficiency: true,
                  varicoseVeinMapping: false,
                  perforatorIncompetence: true,
                  specificVeins: {
                    commonFemoralVein: true,
                    greatSaphenousVein: true,
                    smallSaphenousVein: true,
                    poplitealVein: true,
                    tibialVeins: true,
                    perforators: true
                  }
                },
                urgency: affectedABI < 0.5 ? 'urgent' : 'routine',
                additionalNotes: formData.waveformType === 'absent' ? 'Absent pedal pulses noted. Critical limb ischemia suspected.' : undefined,
                requestDate: new Date()
              };
              dopplerRequestService.downloadDopplerRequest(requestData);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Filled Request
          </button>
          <button
            type="button"
            onClick={() => dopplerRequestService.downloadBlankDopplerRequest()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Download Blank Form
          </button>
        </div>
      </div>
    </div>
  );
};

// Step 7: Osteomyelitis Assessment
const Step7Osteomyelitis: React.FC<{ formData: any; setFormData: any }> = ({ formData, setFormData }) => {
  // Calculate osteomyelitis likelihood
  const getOsteoLikelihood = () => {
    let score = 0;
    if (formData.probeToBone) score += 3;
    if (formData.visibleBone) score += 4;
    if (formData.sausageToe) score += 2;
    if (formData.xrayFindings === 'definite') score += 3;
    else if (formData.xrayFindings === 'suspicious') score += 1;
    if (formData.mriFinding === 'positive') score += 4;
    else if (formData.mriFinding === 'suspicious') score += 2;
    if (formData.boneBiopsyResult === 'positive') score += 5;
    if (formData.esr > 70) score += 2;
    else if (formData.esr > 40) score += 1;
    if (formData.ulcerDuration > 6) score += 2;
    
    if (formData.boneBiopsyResult === 'positive') return { label: 'Confirmed', color: 'red' };
    if (score >= 8) return { label: 'Probable', color: 'red' };
    if (score >= 4) return { label: 'Possible', color: 'orange' };
    return { label: 'Unlikely', color: 'green' };
  };

  const osteo = getOsteoLikelihood();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Osteomyelitis Assessment</h3>
      
      {/* Clinical Findings */}
      <div className="bg-red-50 p-4 rounded-lg">
        <h4 className="font-medium text-red-900 mb-3">Clinical Findings</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <label className="flex items-center space-x-2 p-3 bg-white rounded border">
            <input
              type="checkbox"
              checked={formData.probeToBone}
              onChange={(e) => setFormData({ ...formData, probeToBone: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 h-5 w-5"
            />
            <div>
              <span className="text-sm font-medium">Probe-to-Bone Positive</span>
              <p className="text-xs text-gray-500">Sterile probe touches bone</p>
            </div>
          </label>
          <label className="flex items-center space-x-2 p-3 bg-white rounded border">
            <input
              type="checkbox"
              checked={formData.visibleBone}
              onChange={(e) => setFormData({ ...formData, visibleBone: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 h-5 w-5"
            />
            <div>
              <span className="text-sm font-medium">Visible Bone</span>
              <p className="text-xs text-gray-500">Bone exposed in wound</p>
            </div>
          </label>
          <label className="flex items-center space-x-2 p-3 bg-white rounded border">
            <input
              type="checkbox"
              checked={formData.sausageToe}
              onChange={(e) => setFormData({ ...formData, sausageToe: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 h-5 w-5"
            />
            <div>
              <span className="text-sm font-medium">Sausage Toe</span>
              <p className="text-xs text-gray-500">Diffuse swelling of digit</p>
            </div>
          </label>
        </div>
      </div>

      {/* Imaging */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Imaging Studies</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">X-Ray Findings</label>
            <select
              value={formData.xrayFindings}
              onChange={(e) => setFormData({ ...formData, xrayFindings: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="normal">Normal - No bony changes</option>
              <option value="suspicious">Suspicious - Periosteal reaction, soft tissue swelling</option>
              <option value="definite">Definite - Cortical erosion, sequestrum</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Note: X-ray changes lag 2-3 weeks behind infection</p>
          </div>
          <div>
            <label className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                checked={formData.mriPerformed}
                onChange={(e) => setFormData({ ...formData, mriPerformed: e.target.checked })}
                className="rounded border-gray-300 text-primary-600"
              />
              <span className="text-sm font-medium">MRI Performed</span>
            </label>
            {formData.mriPerformed && (
              <select
                value={formData.mriFinding}
                onChange={(e) => setFormData({ ...formData, mriFinding: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="negative">Negative - No bone marrow edema</option>
                <option value="suspicious">Suspicious - Non-specific changes</option>
                <option value="positive">Positive - Bone marrow edema, cortical destruction</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Bone Biopsy */}
      <div className="bg-purple-50 p-4 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-3">Bone Biopsy (Gold Standard)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={formData.boneBiopsyPerformed}
              onChange={(e) => setFormData({ ...formData, boneBiopsyPerformed: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 h-5 w-5"
            />
            <span className="text-sm font-medium">Bone Biopsy Performed</span>
          </label>
          {formData.boneBiopsyPerformed && (
            <select
              value={formData.boneBiopsyResult}
              onChange={(e) => setFormData({ ...formData, boneBiopsyResult: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="negative">Negative - No organisms/inflammation</option>
              <option value="positive">Positive - Culture positive or histologic osteomyelitis</option>
            </select>
          )}
        </div>
      </div>

      {/* Laboratory & History */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Laboratory & History</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ESR (mm/hr)</label>
            <input
              type="number"
              value={formData.esr}
              onChange={(e) => setFormData({ ...formData, esr: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.esr > 70 && <p className="text-xs text-red-600 mt-1">⚠️ Highly suggestive of osteomyelitis</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ulcer Duration (weeks)</label>
            <input
              type="number"
              value={formData.ulcerDuration}
              onChange={(e) => setFormData({ ...formData, ulcerDuration: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
            {formData.ulcerDuration > 6 && <p className="text-xs text-orange-600 mt-1">Chronic ulcer - higher osteomyelitis risk</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Previous Antibiotic Courses</label>
            <input
              type="number"
              value={formData.previousAntibioticCourses}
              onChange={(e) => setFormData({ ...formData, previousAntibioticCourses: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Osteomyelitis Assessment Result */}
      <div className={`p-4 rounded-lg border-2 ${
        osteo.color === 'red' ? 'bg-red-100 border-red-500' :
        osteo.color === 'orange' ? 'bg-orange-100 border-orange-500' :
        'bg-green-100 border-green-500'
      }`}>
        <div className="flex items-center justify-between">
          <span className="font-medium text-lg">Osteomyelitis Assessment:</span>
          <span className={`text-lg font-bold ${
            osteo.color === 'red' ? 'text-red-700' :
            osteo.color === 'orange' ? 'text-orange-700' :
            'text-green-700'
          }`}>
            {osteo.label}
          </span>
        </div>
        {(osteo.label === 'Confirmed' || osteo.label === 'Probable') && (
          <div className="mt-3 text-sm">
            <p className="font-medium text-red-800">Management Recommendations:</p>
            <ul className="list-disc list-inside text-red-700 mt-1">
              <li>6-week course of targeted IV antibiotics</li>
              <li>Consider surgical debridement of infected bone</li>
              <li>ID consult for antibiotic selection</li>
              <li>Ray amputation may be required for digital osteomyelitis</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

// Step 8: Results & Recommendations
const Step8Results: React.FC<{ formData: any; selectedPatient: any }> = ({ formData, selectedPatient }) => {
  const [consentFile, setConsentFile] = useState<File | null>(null);
  const [consentPreview, setConsentPreview] = useState<string | null>(null);
  const [consentUploaded, setConsentUploaded] = useState(false);
  const [generatingLab, setGeneratingLab] = useState(false);
  const [generatingCounselling, setGeneratingCounselling] = useState(false);
  const consentInputRef = useRef<HTMLInputElement>(null);

  // Calculate all component scores
  const calculateScores = () => {
    let totalScore = 0;
    const breakdown: { category: string; score: number; maxScore: number }[] = [];

    // Demographics (max ~50)
    let demoScore = 0;
    if (formData.age > 80) demoScore += 20;
    else if (formData.age > 70) demoScore += 15;
    else if (formData.age > 60) demoScore += 10;
    if (formData.smokingStatus === 'current') demoScore += 20;
    else if (formData.smokingStatus === 'former') demoScore += 10;
    if (formData.diabetesDuration > 20) demoScore += 15;
    else if (formData.diabetesDuration > 10) demoScore += 10;
    breakdown.push({ category: 'Demographics & History', score: demoScore, maxScore: 55 });
    totalScore += demoScore;

    // Wagner Grade (max 50)
    const wagnerScores = [0, 5, 10, 20, 30, 50];
    const wagnerScore = wagnerScores[formData.wagnerGrade] || 0;
    breakdown.push({ category: 'Wagner Grade', score: wagnerScore, maxScore: 50 });
    totalScore += wagnerScore;

    // WIfI (max 45)
    const wifiScore = (formData.wifiWound + formData.wifiIschemia + formData.wifiInfection) * 5;
    breakdown.push({ category: 'WIfI Classification', score: wifiScore, maxScore: 45 });
    totalScore += wifiScore;

    // Comorbidities (max ~80)
    let comorbScore = 0;
    if (formData.dialysis) comorbScore += 15;
    if (formData.congestiveHeartFailure) comorbScore += 10;
    if (formData.coronaryArteryDisease) comorbScore += 8;
    if (formData.peripheralVascularDisease) comorbScore += 10;
    if (formData.previousAmputation) comorbScore += 15;
    if (formData.hba1c > 10) comorbScore += 15;
    else if (formData.hba1c > 8) comorbScore += 8;
    breakdown.push({ category: 'Comorbidities', score: comorbScore, maxScore: 80 });
    totalScore += comorbScore;

    // Renal (max 55)
    let renalScore = 0;
    if (formData.egfr < 15) renalScore += 35;
    else if (formData.egfr < 30) renalScore += 25;
    else if (formData.egfr < 60) renalScore += 15;
    if (formData.dialysisDependent) renalScore += 20;
    breakdown.push({ category: 'Renal Status', score: renalScore, maxScore: 55 });
    totalScore += renalScore;

    // Sepsis (max ~70)
    let sepsisScore = 0;
    const sirsCount = [
      formData.temperature > 38 || formData.temperature < 36,
      formData.heartRate > 90,
      formData.respiratoryRate > 20,
      formData.wbc > 12 || formData.wbc < 4
    ].filter(Boolean).length;
    sepsisScore += sirsCount * 5;
    if (formData.alteredMentation) sepsisScore += 10;
    if (formData.systolicBP < 100) sepsisScore += 10;
    if (formData.crepitus) sepsisScore += 20;
    if (formData.crp > 100) sepsisScore += 15;
    breakdown.push({ category: 'Sepsis Assessment', score: sepsisScore, maxScore: 70 });
    totalScore += sepsisScore;

    // Arterial (max ~60)
    let arterialScore = 0;
    const abi = formData.affectedSide === 'right' ? formData.abiRight : formData.abiLeft;
    if (abi < 0.4) arterialScore += 40;
    else if (abi < 0.6) arterialScore += 25;
    else if (abi < 0.8) arterialScore += 15;
    if (formData.waveformType === 'absent') arterialScore += 20;
    else if (formData.waveformType === 'monophasic') arterialScore += 10;
    breakdown.push({ category: 'Arterial Assessment', score: arterialScore, maxScore: 60 });
    totalScore += arterialScore;

    // Osteomyelitis (max ~50)
    let osteoScore = 0;
    if (formData.probeToBone) osteoScore += 15;
    if (formData.visibleBone) osteoScore += 20;
    if (formData.xrayFindings === 'definite') osteoScore += 15;
    if (formData.mriFinding === 'positive') osteoScore += 20;
    if (formData.boneBiopsyResult === 'positive') osteoScore += 25;
    breakdown.push({ category: 'Osteomyelitis', score: Math.min(osteoScore, 50), maxScore: 50 });
    totalScore += Math.min(osteoScore, 50);

    return { totalScore, breakdown };
  };

  const { totalScore, breakdown } = calculateScores();

  // Determine risk category and recommendation
  const getRiskCategory = () => {
    if (totalScore < 50) return {
      category: 'Low Risk - Limb Salvage Likely',
      color: 'green',
      probability: 90,
      intervention: 'Conservative Management'
    };
    if (totalScore < 100) return {
      category: 'Moderate Risk - Limb Salvage Possible',
      color: 'yellow',
      probability: 70,
      intervention: 'Wound Care & Debridement'
    };
    if (totalScore < 200) return {
      category: 'High Risk - Consider Amputation',
      color: 'orange',
      probability: 40,
      intervention: formData.wagnerGrade >= 4 ? 'Below-Knee Amputation' : 'Ray/Transmetatarsal Amputation'
    };
    return {
      category: 'Critical - Amputation Recommended',
      color: 'red',
      probability: 15,
      intervention: formData.wagnerGrade === 5 ? 'Above-Knee Amputation' : 'Below-Knee Amputation'
    };
  };

  const risk = getRiskCategory();

  // Generate specific recommendations
  const getRecommendations = () => {
    const recs: string[] = [];
    
    // Urgent issues
    if (formData.crepitus) {
      recs.push('🚨 EMERGENCY: Crepitus detected - immediate surgical debridement for suspected necrotizing fasciitis');
    }
    
    const sirsCount = [
      formData.temperature > 38 || formData.temperature < 36,
      formData.heartRate > 90,
      formData.respiratoryRate > 20,
      formData.wbc > 12 || formData.wbc < 4
    ].filter(Boolean).length;
    
    if (sirsCount >= 2) {
      recs.push('Systemic sepsis present - initiate broad-spectrum IV antibiotics immediately');
    }

    // Vascular
    const abi = formData.affectedSide === 'right' ? formData.abiRight : formData.abiLeft;
    if (abi < 0.5) {
      recs.push('Critical limb ischemia - urgent vascular surgery consultation for revascularization');
    } else if (abi < 0.7) {
      recs.push('Consider vascular assessment for potential revascularization');
    }

    // Osteomyelitis
    if (formData.probeToBone || formData.visibleBone || formData.boneBiopsyResult === 'positive') {
      recs.push('Osteomyelitis likely - 6-week course of IV antibiotics, consider surgical debridement');
    }

    // Renal
    if (formData.dialysisDependent) {
      recs.push('Coordinate surgical timing with dialysis schedule, monitor volume status');
    }

    // Glycemic control
    if (formData.hba1c > 9) {
      recs.push('Optimize glycemic control - endocrinology consultation recommended');
    }

    // Wagner-specific
    if (formData.wagnerGrade >= 3) {
      recs.push('Deep infection/gangrene - surgical debridement required');
    }

    // General
    recs.push('Implement total contact casting or offloading device');
    recs.push('Weekly wound assessment with standardized photography');
    recs.push('Nutritional optimization: protein 1.5g/kg/day, vitamin C, zinc');
    recs.push('Absolute smoking cessation if applicable');

    return recs;
  };

  const recommendations = getRecommendations();

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Assessment Results & Recommendations</h3>
      
      {/* Total Score */}
      <div className={`p-6 rounded-lg border-2 ${
        risk.color === 'red' ? 'bg-red-50 border-red-500' :
        risk.color === 'orange' ? 'bg-orange-50 border-orange-500' :
        risk.color === 'yellow' ? 'bg-yellow-50 border-yellow-500' :
        'bg-green-50 border-green-500'
      }`}>
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-1">Total Limb Salvage Score</p>
          <p className="text-5xl font-bold mb-2">{totalScore}</p>
          <p className={`text-xl font-semibold ${
            risk.color === 'red' ? 'text-red-700' :
            risk.color === 'orange' ? 'text-orange-700' :
            risk.color === 'yellow' ? 'text-yellow-700' :
            'text-green-700'
          }`}>
            {risk.category}
          </p>
          <p className="text-lg mt-2">
            Limb Salvage Probability: <span className="font-bold">{risk.probability}%</span>
          </p>
        </div>
      </div>

      {/* Recommended Intervention */}
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Recommended Intervention</h4>
        <p className="text-2xl font-bold text-blue-800">{risk.intervention}</p>
      </div>

      {/* Score Breakdown */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Score Breakdown</h4>
        <div className="space-y-2">
          {breakdown.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <span className="text-sm">{item.category}</span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      item.score / item.maxScore > 0.7 ? 'bg-red-500' :
                      item.score / item.maxScore > 0.4 ? 'bg-orange-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${(item.score / item.maxScore) * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">
                  {item.score}/{item.maxScore}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Recommendations */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-3">Detailed Recommendations</h4>
        <ul className="space-y-2">
          {recommendations.map((rec, idx) => (
            <li key={idx} className={`flex items-start ${
              rec.startsWith('🚨') ? 'text-red-800 font-bold' : 'text-gray-700'
            }`}>
              <span className="mr-2">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Monitoring Plan */}
      <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
        <h4 className="font-medium text-purple-900 mb-3">Monitoring Plan</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium">Follow-up Frequency:</p>
            <p>{totalScore >= 200 ? 'Daily until stable' : 
               totalScore >= 100 ? 'Every 2-3 days' : 
               totalScore >= 50 ? 'Weekly' : 'Bi-weekly'}</p>
          </div>
          <div>
            <p className="font-medium">Consults Required:</p>
            <ul className="list-disc list-inside">
              {(formData.affectedSide === 'right' ? formData.abiRight : formData.abiLeft) < 0.7 && <li>Vascular Surgery</li>}
              {(formData.probeToBone || formData.crepitus) && <li>Infectious Disease</li>}
              {formData.dialysisDependent && <li>Nephrology</li>}
              {formData.hba1c > 9 && <li>Endocrinology</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* ========== ACTION BUTTONS ========== */}
      <div className="border-t-2 border-gray-300 pt-6 mt-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          Clinical Actions
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Button 1: Generate Lab & Imaging Requests */}
          <button
            onClick={() => generateLabAndImagingPDF(formData, selectedPatient, risk, totalScore, setGeneratingLab)}
            disabled={generatingLab}
            className="flex items-center gap-3 p-4 bg-cyan-50 border-2 border-cyan-300 rounded-xl hover:bg-cyan-100 hover:border-cyan-500 transition-all disabled:opacity-50"
          >
            <div className="p-3 bg-cyan-100 rounded-lg">
              <TestTube className="w-6 h-6 text-cyan-700" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-cyan-900">{generatingLab ? 'Generating...' : 'Generate Lab & Imaging Requests'}</p>
              <p className="text-xs text-cyan-700 mt-0.5">Comprehensive lab panel + imaging for full assessment workup</p>
            </div>
            <Download className="w-5 h-5 text-cyan-600 ml-auto" />
          </button>

          {/* Button 2: Generate Patient Counselling & Consent */}
          <button
            onClick={() => generateCounsellingAndConsentPDF(formData, selectedPatient, risk, totalScore, recommendations, breakdown, setGeneratingCounselling)}
            disabled={generatingCounselling}
            className="flex items-center gap-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl hover:bg-amber-100 hover:border-amber-500 transition-all disabled:opacity-50"
          >
            <div className="p-3 bg-amber-100 rounded-lg">
              <MessageSquare className="w-6 h-6 text-amber-700" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-amber-900">{generatingCounselling ? 'Generating...' : 'Patient Counselling & Consent'}</p>
              <p className="text-xs text-amber-700 mt-0.5">Explanatory counselling + informed consent form for signature</p>
            </div>
            <Download className="w-5 h-5 text-amber-600 ml-auto" />
          </button>
        </div>
      </div>

      {/* ========== UPLOAD SIGNED CONSENT ========== */}
      <div className="border-t border-gray-200 pt-6 mt-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-green-600" />
          Signed Consent Upload
        </h4>
        <p className="text-sm text-gray-600 mb-4">
          Upload the patient's signed consent form (photo or scanned PDF). This will be attached to the assessment record.
        </p>

        <input
          ref={consentInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setConsentFile(file);
              setConsentUploaded(true);
              // Generate preview
              if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => setConsentPreview(ev.target?.result as string);
                reader.readAsDataURL(file);
              } else {
                setConsentPreview(null);
              }
            }
          }}
        />

        {!consentUploaded ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => consentInputRef.current?.click()}
              className="flex items-center gap-3 px-6 py-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl hover:bg-gray-100 hover:border-primary-400 transition-all w-full justify-center"
            >
              <Upload className="w-6 h-6 text-gray-500" />
              <div className="text-left">
                <p className="font-medium text-gray-700">Click to upload signed consent</p>
                <p className="text-xs text-gray-500">Accepts images (JPG, PNG) or PDF files</p>
              </div>
            </button>
            {/* Also allow camera capture on mobile */}
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.capture = 'environment';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    setConsentFile(file);
                    setConsentUploaded(true);
                    const reader = new FileReader();
                    reader.onload = (ev) => setConsentPreview(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-50 border border-primary-200 rounded-lg hover:bg-primary-100 transition-all"
            >
              <CameraIcon className="w-4 h-4 text-primary-600" />
              <span className="text-primary-700 font-medium">Take Photo of Signed Consent</span>
            </button>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Signed Consent Uploaded</p>
                <p className="text-sm text-green-700">{consentFile?.name} ({(consentFile?.size ? (consentFile.size / 1024).toFixed(1) : '?')} KB)</p>
              </div>
              <button
                onClick={() => {
                  setConsentFile(null);
                  setConsentPreview(null);
                  setConsentUploaded(false);
                  if (consentInputRef.current) consentInputRef.current.value = '';
                }}
                className="ml-auto text-red-500 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            </div>
            {consentPreview && (
              <div className="mt-2 border border-green-200 rounded-lg overflow-hidden">
                <img src={consentPreview} alt="Signed consent" className="max-h-64 w-full object-contain bg-white" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== PDF GENERATORS ====================

/**
 * Generates lab & imaging request PDF matching EXACTLY the assessment form sections.
 * Only includes the tests required to complete each assessment tab.
 */
async function generateLabAndImagingPDF(
  formData: any,
  patient: any,
  risk: { category: string; color: string; probability: number; intervention: string },
  totalScore: number,
  setLoading: (v: boolean) => void
) {
  setLoading(true);
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 12;

    // ---- Header ----
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pw / 2, y, { align: 'center' });
    y += 4;
    doc.text('Burns, Plastic & Reconstructive Surgery UNIT, Department of Surgery', pw / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('DIABETIC FOOT - LIMB SALVAGE ASSESSMENT', pw / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(11);
    doc.setTextColor(14, 159, 110);
    doc.text('LABORATORY & IMAGING REQUEST FORM', pw / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('(Tests required to complete the Limb Salvage Assessment)', pw / 2, y, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    y += 7;

    // ---- Patient Info ----
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 2, pw - 2 * margin, 20, 'F');
    doc.text('PATIENT INFORMATION', margin + 2, y + 2);
    y += 6;
    doc.setFont('helvetica', 'normal');
    const pName = patient ? (patient.full_name || `${patient.first_name} ${patient.last_name}`) : '________________________________';
    const pHosp = patient?.hospital_number || '________________';
    const pDOB = patient?.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('en-GB') : '__________';
    const pGender = patient?.gender || '________';
    const nowDate = new Date().toLocaleDateString('en-GB');
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    doc.text(`Patient: ${pName}`, margin + 2, y + 2);
    doc.text(`Hospital No: ${pHosp}`, pw - margin - 48, y + 2);
    y += 5;
    doc.text(`DOB: ${pDOB}    Gender: ${pGender}`, margin + 2, y + 2);
    doc.text(`Date: ${nowDate}   Time: ${nowTime}`, pw - margin - 50, y + 2);
    y += 10;

    // ---- Helper: Section table ----
    const drawSection = (
      sectionLabel: string, 
      assessmentStep: string,
      headerColor: [number, number, number], 
      tests: { test: string; sample: string; urgency: string; forField: string }[]
    ) => {
      const neededH = tests.length * 7 + 20;
      if (y + neededH > 280) { doc.addPage(); y = 15; }

      // Section header
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...headerColor);
      doc.rect(margin, y, pw - 2 * margin, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(sectionLabel, margin + 3, y + 5.5);
      doc.setFontSize(7);
      doc.text(`Assessment Step: ${assessmentStep}`, pw - margin - 55, y + 5.5);
      doc.setTextColor(0, 0, 0);
      y += 10;

      // Column headers
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(230, 230, 230);
      doc.rect(margin, y - 2, pw - 2 * margin, 6, 'F');
      doc.text('TEST', margin + 2, y + 2);
      doc.text('SAMPLE TYPE', margin + 75, y + 2);
      doc.text('URGENCY', margin + 113, y + 2);
      doc.text('FOR FIELD', margin + 140, y + 2);
      // Tick column
      doc.text('\u2713', pw - margin - 4, y + 2);
      y += 6;

      doc.setFont('helvetica', 'normal');
      tests.forEach((t, i) => {
        if (y > 275) { doc.addPage(); y = 15; }
        if (i % 2 === 0) {
          doc.setFillColor(248, 248, 248);
          doc.rect(margin, y - 1.5, pw - 2 * margin, 7, 'F');
        }
        doc.setFontSize(7.5);
        doc.text(t.test, margin + 2, y + 3);
        doc.setFontSize(7);
        doc.text(t.sample, margin + 75, y + 3);
        // Urgency coloring
        if (t.urgency === 'STAT') { 
          doc.setTextColor(220, 38, 38); 
          doc.setFont('helvetica', 'bold'); 
        } else if (t.urgency === 'Urgent') {
          doc.setTextColor(180, 100, 0);
        }
        doc.text(t.urgency, margin + 113, y + 3);
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'italic');
        doc.text(t.forField, margin + 140, y + 3, { maxWidth: pw - margin - 148 });
        doc.setFont('helvetica', 'normal');
        // Checkbox
        doc.rect(pw - margin - 6, y - 0.5, 5, 5);
        y += 7;
      });
      y += 4;
    };

    // ============================================================
    // SECTION A: COMORBIDITIES (Step 3)
    // Fields: hba1c, bloodSugarControl, anemia, malnutrition
    // ============================================================
    drawSection(
      'A. COMORBIDITIES PANEL', 'Step 3 — Comorbidities',
      [14, 159, 110],
      [
        { test: 'HbA1c (Glycated Haemoglobin)', sample: 'EDTA (Purple)', urgency: 'Urgent', forField: 'HbA1c field' },
        { test: 'Fasting Blood Glucose', sample: 'Fluoride (Grey)', urgency: 'Urgent', forField: 'Blood sugar control' },
        { test: 'Random Blood Glucose', sample: 'Fluoride (Grey)', urgency: 'STAT', forField: 'Blood sugar control' },
        { test: 'Full Blood Count (Hb, WBC)', sample: 'EDTA (Purple)', urgency: 'Urgent', forField: 'Anaemia assessment' },
        { test: 'Serum Albumin', sample: 'Serum (Gold)', urgency: 'Urgent', forField: 'Malnutrition status' },
      ]
    );

    // ============================================================
    // SECTION B: RENAL STATUS (Step 4)
    // Fields: creatinine, bun, egfr, dialysisDependent
    // ============================================================
    drawSection(
      'B. RENAL FUNCTION PANEL', 'Step 4 — Renal Status',
      [59, 130, 246],
      [
        { test: 'Serum Creatinine', sample: 'Serum (Gold)', urgency: 'STAT', forField: 'Creatinine field' },
        { test: 'Blood Urea Nitrogen (BUN)', sample: 'Serum (Gold)', urgency: 'STAT', forField: 'BUN field' },
        { test: 'Electrolytes (Na+, K+, Cl-, HCO3-)', sample: 'Serum (Gold)', urgency: 'Urgent', forField: 'eGFR calculation' },
      ]
    );

    // ============================================================
    // SECTION C: SEPSIS ASSESSMENT (Step 5)
    // Fields: wbc, crp, procalcitonin, lactate
    // (temperature, HR, RR, BP are clinical readings, not lab)
    // ============================================================
    drawSection(
      'C. SEPSIS & INFECTION MARKERS', 'Step 5 — Sepsis Assessment',
      [220, 38, 38],
      [
        { test: 'Full Blood Count + Differential (WBC)', sample: 'EDTA (Purple)', urgency: 'STAT', forField: 'WBC field' },
        { test: 'C-Reactive Protein (CRP)', sample: 'Serum (Gold)', urgency: 'STAT', forField: 'CRP field' },
        { test: 'Procalcitonin', sample: 'Serum (Gold)', urgency: 'STAT', forField: 'Procalcitonin field' },
        { test: 'Blood Lactate', sample: 'Fluoride (Grey)', urgency: 'STAT', forField: 'Lactate field' },
        { test: 'Wound Swab M/C/S', sample: 'Swab (Charcoal)', urgency: 'STAT', forField: 'Infection organism ID' },
        { test: 'Blood Culture x 2 sets', sample: 'Culture Bottles', urgency: 'STAT', forField: 'Sepsis organism ID' },
      ]
    );

    // ============================================================
    // SECTION D: VASCULAR ASSESSMENT (Step 6)
    // Fields: abiRight, abiLeft, toePressure, waveformType,
    //   dorsalisPedis, posteriorTibial, peroneal, stenosisPresent,
    //   stenosisLocation, stenosisSeverity, vesselCalcification,
    //   incompressibleVessels, dvtPresent, chronicVenousInsufficiency,
    //   venousReflux, edemaGrade
    // ============================================================
    drawSection(
      'D. VASCULAR STUDIES — ARTERIAL', 'Step 6 — Vascular (Arterial)',
      [139, 69, 19],
      [
        { test: 'Arterial Doppler Ultrasound (Bilateral LL)', sample: 'Patient', urgency: 'STAT', forField: 'ABI, waveform, vessel status, stenosis' },
        { test: 'Toe Pressures / Toe-Brachial Index', sample: 'Patient', urgency: 'Urgent', forField: 'Toe pressure field' },
        { test: 'CT Angiography (Lower Limb)', sample: 'Patient + IV Contrast', urgency: 'Urgent', forField: 'Stenosis location & severity' },
        { test: 'Transcutaneous Oxygen (TcPO2)', sample: 'Patient', urgency: 'Urgent', forField: 'Tissue perfusion assessment' },
      ]
    );

    drawSection(
      'E. VASCULAR STUDIES — VENOUS', 'Step 6 — Vascular (Venous)',
      [107, 33, 168],
      [
        { test: 'Venous Doppler Ultrasound (Affected Limb)', sample: 'Patient', urgency: 'Urgent', forField: 'DVT, CVI, venous reflux' },
      ]
    );

    // ============================================================
    // SECTION F: OSTEOMYELITIS ASSESSMENT (Step 7)
    // Fields: xrayFindings, mriFinding, boneBiopsyResult, esr
    // (probeToBone, visibleBone, sausageToe are clinical exam)
    // ============================================================
    drawSection(
      'F. OSTEOMYELITIS WORKUP', 'Step 7 — Osteomyelitis',
      [161, 98, 7],
      [
        { test: 'ESR (Erythrocyte Sedimentation Rate)', sample: 'EDTA (Purple)', urgency: 'Urgent', forField: 'ESR field' },
        { test: 'X-ray Foot AP / Lateral / Oblique', sample: 'Patient', urgency: 'STAT', forField: 'X-ray findings field' },
        { test: 'MRI Foot with Contrast (Gadolinium)', sample: 'Patient + IV Contrast', urgency: 'Urgent', forField: 'MRI finding field' },
        { test: 'Bone Biopsy + Culture (if indicated)', sample: 'Bone tissue (sterile)', urgency: 'Urgent', forField: 'Bone biopsy result field' },
      ]
    );

    // ============================================================
    // Specimen Notes + Doctor Signature
    // ============================================================
    if (y > 240) { doc.addPage(); y = 15; }
    y += 3;
    doc.setFillColor(255, 255, 230);
    doc.rect(margin, y - 2, pw - 2 * margin, 32, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('SPECIMEN COLLECTION NOTES:', margin + 2, y + 2);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('1. Collect blood cultures BEFORE starting/changing antibiotics', margin + 2, y + 1); y += 4;
    doc.text('2. Label ALL specimens with patient name, hospital number, date & time of collection', margin + 2, y + 1); y += 4;
    doc.text('3. CT Angiography: check eGFR > 30 before IV contrast; pre-hydrate if borderline', margin + 2, y + 1); y += 4;
    doc.text('4. MRI: screen for metallic implants; gadolinium contraindicated if eGFR < 30 (NSF risk)', margin + 2, y + 1); y += 4;
    doc.text('5. Deep tissue/bone biopsy preferred over surface swab for accurate organism identification', margin + 2, y + 1); y += 4;
    doc.text('6. Dialysis patients: coordinate contrast studies with dialysis schedule', margin + 2, y + 1);
    y += 10;

    // Requesting Doctor
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('REQUESTING DOCTOR', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text('Name: ______________________________________', margin, y);
    doc.text('Signature: ______________________________', pw / 2 + 5, y);
    y += 6;
    doc.text('Designation: ________________________________', margin, y);
    doc.text('Bleep/Phone: ____________________________', pw / 2 + 5, y);
    y += 6;
    doc.text(`Date: ${nowDate}`, margin, y);
    doc.text(`Time: ${nowTime}`, pw / 2 + 5, y);

    // Save
    const filename = `DiabeticFoot_LabRequest_${patient?.hospital_number || 'Form'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('Error generating lab/imaging PDF:', err);
    alert('Failed to generate PDF. Please try again.');
  }
  setLoading(false);
}

/**
 * Generates patient counselling document + informed consent form
 * with detailed explanations based on assessment results.
 */
async function generateCounsellingAndConsentPDF(
  formData: any,
  patient: any,
  risk: { category: string; color: string; probability: number; intervention: string },
  totalScore: number,
  recommendations: string[],
  breakdown: { category: string; score: number; maxScore: number }[],
  setLoading: (v: boolean) => void
) {
  setLoading(true);
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 12;

    const pName = patient ? (patient.full_name || `${patient.first_name} ${patient.last_name}`) : '____________________________';
    const pHosp = patient?.hospital_number || '________________';
    const nowDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    // Helper: wrapped text with auto page break
    const addWrapped = (text: string, x: number, maxW: number, fontSize: number = 9, fontStyle: string = 'normal') => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', fontStyle);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach((line: string) => {
        if (y > 275) { doc.addPage(); y = 15; }
        doc.text(line, x, y);
        y += fontSize * 0.45;
      });
    };

    // =================== PAGE 1: PATIENT COUNSELLING ===================
    doc.setFontSize(9);
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pw / 2, y, { align: 'center' });
    y += 4;
    doc.text('Burns, Plastic & Reconstructive Surgery UNIT', pw / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT COUNSELLING DOCUMENT', pw / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(14, 159, 110);
    doc.text('Diabetic Foot — Limb Salvage Assessment', pw / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 8;

    // Patient info box
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pw - 2 * margin, 14, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Patient: ${pName}`, margin + 3, y + 5);
    doc.text(`Hospital No: ${pHosp}`, pw - margin - 45, y + 5);
    doc.text(`Date: ${nowDate}`, margin + 3, y + 11);
    doc.text(`Assessment Score: ${totalScore}`, pw - margin - 45, y + 11);
    y += 18;

    // Greeting / Introduction
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Dear Patient,', margin, y);
    y += 6;

    addWrapped(
      'We have completed a comprehensive assessment of your diabetic foot condition. This document is intended to explain your results in clear language, describe the treatment options available, and help you make an informed decision about your care. Please read carefully and feel free to ask your medical team any questions.',
      margin, pw - 2 * margin, 9.5
    );
    y += 4;

    // Understanding Your Condition
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text('1. UNDERSTANDING YOUR CONDITION', margin, y);
    y += 6;

    addWrapped(
      'Diabetes can damage the blood vessels and nerves in your feet over time. When this happens, you may not feel injuries, and your feet may not get enough blood flow to heal properly. This is what we call "diabetic foot disease." If not managed correctly, it can lead to infections, tissue death (gangrene), and in severe cases, the need for amputation (surgical removal of part of the leg).',
      margin, pw - 2 * margin, 9
    );
    y += 3;

    // Wagner grade explanation
    const wagnerExplanations: Record<number, string> = {
      0: 'Your foot shows early warning signs (bony changes or a healed ulcer) but no open wound currently. This is the earliest stage, and with proper care, we can prevent progression.',
      1: 'You have a superficial (surface-level) ulcer on your foot. The wound does not go deep into the tissue. With proper wound care and offloading, this has an excellent chance of healing.',
      2: 'Your foot ulcer extends deeper, possibly reaching tendons or bone. This requires more aggressive wound care and close monitoring for infection.',
      3: 'Your foot has a deep infection (abscess) or signs that the infection has reached the bone (osteomyelitis). This is serious and usually requires surgery to clean the infection and prolonged antibiotics.',
      4: 'Part of your foot (toes or forefoot) has developed gangrene — the tissue has died due to poor blood supply. The dead tissue will need to be surgically removed. The goal is to save as much of your foot as possible.',
      5: 'The gangrene has spread extensively across your foot. This is the most severe stage and carries a significant risk. A more extensive amputation may be necessary to save your life and prevent the infection from spreading.',
    };

    addWrapped(
      `Your Wound Grade: Wagner Grade ${formData.wagnerGrade} — ${wagnerExplanations[formData.wagnerGrade] || 'Assessment recorded.'}`,
      margin, pw - 2 * margin, 9
    );
    y += 4;

    // Assessment Results
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text('2. YOUR ASSESSMENT RESULTS', margin, y);
    y += 6;

    addWrapped(
      `Your overall Limb Salvage Score is ${totalScore} out of a maximum possible score. Based on this score, your assessment falls into the category: "${risk.category}". This means there is approximately a ${risk.probability}% chance that your limb can be saved with appropriate treatment.`,
      margin, pw - 2 * margin, 9
    );
    y += 3;

    // Score breakdown in simple terms
    addWrapped('Here is a summary of what contributed to your score:', margin, pw - 2 * margin, 9, 'bold');
    y += 2;
    breakdown.forEach(b => {
      const pct = b.maxScore > 0 ? Math.round((b.score / b.maxScore) * 100) : 0;
      const severity = pct > 70 ? '(Significant concern)' : pct > 40 ? '(Moderate concern)' : '(Within acceptable range)';
      addWrapped(`• ${b.category}: ${b.score}/${b.maxScore} ${severity}`, margin + 3, pw - 2 * margin - 3, 8.5);
    });
    y += 4;

    // Recommended Approach
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text('3. RECOMMENDED TREATMENT APPROACH', margin, y);
    y += 6;

    const interventionExplanations: Record<string, string> = {
      'Conservative Management': 'Based on your assessment, we recommend conservative (non-surgical) management. This involves specialised wound dressings, offloading devices (special shoes or casts to take pressure off the wound), optimising your blood sugar control, nutritional support, and close monitoring. Most patients in your risk category respond well to this approach, and the wound heals with time and proper care.',
      'Wound Care & Debridement': 'We recommend wound care combined with surgical debridement. Debridement means removing dead, damaged, or infected tissue from the wound to help it heal. This is done under anaesthesia and helps create a clean wound bed. After the procedure, you will need ongoing wound dressings and may need antibiotics. The goal is to promote healing and prevent the need for amputation.',
      'Ray/Transmetatarsal Amputation': 'Based on your assessment, we recommend a limited amputation — either a "ray amputation" (removing one or more toes along with part of the connecting bone) or a "transmetatarsal amputation" (removing the front part of the foot while preserving the heel). These procedures save most of your foot and allow you to walk with special footwear. The decision on the exact level will be made during surgery based on the extent of viable tissue.',
      'Below-Knee Amputation': 'Due to the severity of your condition, we recommend a below-knee amputation (BKA). This means removing the leg below the knee joint. While this is a significant procedure, it is the safest option to control infection, relieve pain, and preserve your life. Modern prosthetics (artificial legs) allow many patients to walk and live independently after this surgery. Rehabilitation will be an important part of your recovery.',
      'Above-Knee Amputation': 'Due to the extensive involvement, we recommend an above-knee amputation (AKA). This is the most extensive option but is necessary when the disease or infection has spread beyond what a below-knee procedure can manage. Your safety and survival are our primary concern. We will provide comprehensive rehabilitation support and prosthetic fitting after recovery.',
    };

    addWrapped(
      `Our recommended intervention: ${risk.intervention}`,
      margin, pw - 2 * margin, 10, 'bold'
    );
    y += 3;
    addWrapped(
      interventionExplanations[risk.intervention] || `Based on your specific clinical picture, we recommend: ${risk.intervention}. Your medical team will discuss the details of this approach with you.`,
      margin, pw - 2 * margin, 9
    );
    y += 4;

    // Specific clinical recommendations
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text('4. ADDITIONAL CLINICAL RECOMMENDATIONS', margin, y);
    y += 6;

    recommendations.forEach(rec => {
      const cleanRec = rec.replace('🚨 ', '').replace('🚨', '');
      addWrapped(`• ${cleanRec}`, margin + 3, pw - 2 * margin - 3, 8.5);
    });
    y += 4;

    // Risks and Benefits
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text('5. RISKS & BENEFITS', margin, y);
    y += 6;

    addWrapped(
      'Benefits of the recommended treatment: Control of infection, pain relief, removal of dead tissue, improved wound healing, prevention of further tissue loss, and ultimately saving as much of your limb as possible — or protecting your life when amputation is necessary.',
      margin, pw - 2 * margin, 9
    );
    y += 2;

    addWrapped(
      'Potential risks and complications: Bleeding, infection, delayed wound healing, need for further surgery, phantom limb pain (after amputation), blood clots (DVT/PE), anaesthetic complications, and in rare cases, the need for a higher level of amputation. Your diabetes and other medical conditions may increase some of these risks.',
      margin, pw - 2 * margin, 9
    );
    y += 2;

    addWrapped(
      'Alternatives: You have the right to decline the recommended treatment. Alternative options (if applicable) include continued conservative management, seeking a second opinion, or choosing a different level of intervention. However, delayed treatment of a critical diabetic foot carries the risk of life-threatening infection (sepsis) and uncontrolled tissue death.',
      margin, pw - 2 * margin, 9
    );
    y += 6;

    // Treatment options for patient preference
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (y > 270) { doc.addPage(); y = 15; }
    doc.text('6. TREATMENT OPTIONS (Please discuss with your doctor)', margin, y);
    y += 6;

    const treatmentOptions = [
      { option: 'Option A: Recommended Intervention', desc: risk.intervention + ' — as described above.' },
      { option: 'Option B: Conservative Management', desc: 'Wound care, antibiotics, and close monitoring without surgery (if feasible based on your condition).' },
      { option: 'Option C: Alternative Surgical Approach', desc: 'A different surgical option (to be discussed with your surgeon based on intra-operative findings).' },
      { option: 'Option D: Decline Treatment', desc: 'You may choose not to proceed. Risks of non-treatment have been explained.' },
    ];

    treatmentOptions.forEach(t => {
      addWrapped(`${t.option}:`, margin, pw - 2 * margin, 9, 'bold');
      addWrapped(t.desc, margin + 5, pw - 2 * margin - 5, 8.5);
      y += 1;
    });

    // =================== CONSENT FORM (New Page) ===================
    doc.addPage();
    y = 15;

    doc.setFontSize(9);
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pw / 2, y, { align: 'center' });
    y += 4;
    doc.text('Burns, Plastic & Reconstructive Surgery UNIT', pw / 2, y, { align: 'center' });
    y += 7;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMED CONSENT FORM', pw / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(10);
    doc.text('Diabetic Foot — Limb Salvage / Amputation Procedure', pw / 2, y, { align: 'center' });
    y += 10;

    // Patient Details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Patient Name: ${pName}`, margin, y);
    doc.text(`Hospital No: ${pHosp}`, pw - margin - 45, y);
    y += 6;
    doc.text(`Date: ${nowDate}`, margin, y);
    y += 8;

    // Consent Statements
    const consentStatements = [
      'I confirm that I have been given a thorough explanation of my condition (diabetic foot disease) in a language I understand.',
      'I understand the nature and purpose of the recommended procedure: ' + risk.intervention + '.',
      'The potential benefits, risks, complications, and alternative treatment options have been explained to me in detail.',
      'I have had the opportunity to ask questions, and all my questions have been answered to my satisfaction.',
      'I understand that the exact extent of the procedure may need to be adjusted during surgery based on findings, and I give my consent for the surgical team to make necessary intra-operative decisions.',
      'I have been informed about the anaesthesia (general/regional/local) required for the procedure and its associated risks.',
      'I understand that no guarantee has been made regarding the outcome of the procedure.',
      'I understand my right to withdraw my consent at any time before the procedure.',
      'I consent to the procedure being photographed/documented for my medical records and for clinical education (identifiable photos will not be shared without separate consent).',
    ];

    consentStatements.forEach((stmt, idx) => {
      if (y > 270) { doc.addPage(); y = 15; }
      // Checkbox
      doc.rect(margin, y - 3, 4, 4);
      addWrapped(`${idx + 1}. ${stmt}`, margin + 7, pw - 2 * margin - 7, 9);
      y += 2;
    });

    y += 5;

    // Patient Preferred Treatment Choice
    if (y > 250) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Patient\'s Preferred Treatment Choice:', margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.rect(margin, y - 3, 4, 4); doc.text('Option A: ' + risk.intervention + ' (Recommended)', margin + 7, y);
    y += 6;
    doc.rect(margin, y - 3, 4, 4); doc.text('Option B: Conservative Management', margin + 7, y);
    y += 6;
    doc.rect(margin, y - 3, 4, 4); doc.text('Option C: Alternative Surgical Approach (specify): ______________________________', margin + 7, y);
    y += 6;
    doc.rect(margin, y - 3, 4, 4); doc.text('Option D: Decline Treatment (Against Medical Advice)', margin + 7, y);
    y += 10;

    // Signature Section
    if (y > 230) { doc.addPage(); y = 15; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('PATIENT / NEXT OF KIN SIGNATURE', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    doc.text('Patient Signature: ________________________________', margin, y);
    doc.text('Date: ________________', pw - margin - 40, y);
    y += 8;
    doc.text('Patient Name (Print): ________________________________', margin, y);
    y += 8;
    doc.text('Next of Kin Name: ________________________________', margin, y);
    doc.text('Relationship: ________________', pw - margin - 45, y);
    y += 8;
    doc.text('Next of Kin Signature: ________________________________', margin, y);
    doc.text('Date: ________________', pw - margin - 40, y);
    y += 8;
    doc.text('Next of Kin Phone: ________________________________', margin, y);
    y += 12;

    // Doctor Section
    doc.setFont('helvetica', 'bold');
    doc.text('ATTENDING DOCTOR / SURGEON', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('Doctor Name: ________________________________', margin, y);
    doc.text('Designation: ________________', pw - margin - 40, y);
    y += 8;
    doc.text('Doctor Signature: ________________________________', margin, y);
    doc.text('Date: ________________', pw - margin - 40, y);
    y += 8;
    doc.text('GMC/MDCN No: ________________________________', margin, y);
    y += 12;

    // Witness Section
    doc.setFont('helvetica', 'bold');
    doc.text('WITNESS', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.text('Witness Name: ________________________________', margin, y);
    doc.text('Designation: ________________', pw - margin - 40, y);
    y += 8;
    doc.text('Witness Signature: ________________________________', margin, y);
    doc.text('Date: ________________', pw - margin - 40, y);

    // Save
    const filename = `DiabeticFoot_Counselling_Consent_${patient?.hospital_number || 'Form'}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('Error generating counselling/consent PDF:', err);
    alert('Failed to generate PDF. Please try again.');
  }
  setLoading(false);
}

export default DiabeticFootAssessmentForm;
