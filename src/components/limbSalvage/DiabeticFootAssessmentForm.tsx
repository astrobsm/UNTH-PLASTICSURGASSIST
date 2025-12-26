import React, { useState, useEffect } from 'react';
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
  UserPlus
} from 'lucide-react';
import { DiabeticFootAssessment } from '../../services/diabeticFootService';
import { patientService } from '../../services/patientService';

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
        return <Step8Results formData={formData} />;
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
        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
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
  // Calculate CKD Stage based on eGFR
  const getCKDStage = (egfr: number) => {
    if (egfr >= 90) return { stage: 1, label: 'Stage 1 - Normal', color: 'green' };
    if (egfr >= 60) return { stage: 2, label: 'Stage 2 - Mild decrease', color: 'yellow' };
    if (egfr >= 30) return { stage: 3, label: 'Stage 3 - Moderate decrease', color: 'orange' };
    if (egfr >= 15) return { stage: 4, label: 'Stage 4 - Severe decrease', color: 'red' };
    return { stage: 5, label: 'Stage 5 - Kidney failure', color: 'red' };
  };

  const ckd = getCKDStage(formData.egfr);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium text-gray-900">Renal Status Assessment</h3>
      
      {/* Laboratory Values */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-3">Laboratory Values</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Creatinine (mg/dL)</label>
            <input
              type="number"
              step="0.1"
              value={formData.creatinine}
              onChange={(e) => setFormData({ ...formData, creatinine: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BUN (mg/dL)</label>
            <input
              type="number"
              value={formData.bun}
              onChange={(e) => setFormData({ ...formData, bun: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">eGFR (mL/min/1.73m²)</label>
            <input
              type="number"
              value={formData.egfr}
              onChange={(e) => setFormData({ ...formData, egfr: parseInt(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
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
            <div className="ml-8 grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-3 gap-4">
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
        
        <div className="grid grid-cols-3 gap-4 mb-4">
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

        <div className="grid grid-cols-2 gap-4 mb-4">
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

        <div className="grid grid-cols-3 gap-4 mb-4">
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

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4 mt-3">
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
        <div className="grid grid-cols-3 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-2 gap-4">
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
        <div className="grid grid-cols-3 gap-4">
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
const Step8Results: React.FC<{ formData: any }> = ({ formData }) => {
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
        <div className="grid grid-cols-2 gap-4 text-sm">
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
    </div>
  );
};

export default DiabeticFootAssessmentForm;
