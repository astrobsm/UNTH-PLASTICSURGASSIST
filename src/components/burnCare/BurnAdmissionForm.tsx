import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Save, 
  X, 
  Flame,
  User,
  Calculator,
  Stethoscope,
  Droplets,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
  Clock,
  Search,
  UserPlus
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { 
  BurnPatient, 
  BurnMechanism, 
  BurnDepth, 
  TBSARegion,
  AnatomicalRegion,
  InhalationInjuryAssessment,
  burnCareService,
  LUND_BROWDER_CHART
} from '../../services/burnCareService';
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

interface BurnAdmissionFormProps {
  onComplete: (patient: BurnPatient) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, title: 'Patient Info', icon: User },
  { id: 2, title: 'Burn Details', icon: Flame },
  { id: 3, title: 'TBSA Map', icon: Calculator },
  { id: 4, title: 'Inhalation', icon: Activity },
  { id: 5, title: 'Resuscitation', icon: Droplets },
  { id: 6, title: 'Summary', icon: CheckCircle },
];

const BURN_MECHANISMS: { value: BurnMechanism; label: string; description: string }[] = [
  { value: 'flame', label: 'Flame', description: 'Direct fire exposure' },
  { value: 'scald', label: 'Scald', description: 'Hot liquids or steam' },
  { value: 'contact', label: 'Contact', description: 'Hot objects/surfaces' },
  { value: 'electrical', label: 'Electrical', description: 'Electrical current' },
  { value: 'chemical', label: 'Chemical', description: 'Acids, alkalis, etc.' },
  { value: 'radiation', label: 'Radiation', description: 'UV, ionizing radiation' },
  { value: 'friction', label: 'Friction', description: 'Abrasion burns' },
];

const BURN_DEPTHS: { value: BurnDepth; label: string; color: string }[] = [
  { value: 'superficial', label: '1° Superficial', color: 'bg-pink-300' },
  { value: 'superficial_partial', label: '2° Superficial Partial', color: 'bg-red-400' },
  { value: 'deep_partial', label: '2° Deep Partial', color: 'bg-yellow-400' },
  { value: 'full_thickness', label: '3° Full Thickness', color: 'bg-amber-800' },
];

// Body regions for the interactive map
const BODY_REGIONS: { id: AnatomicalRegion; label: string; side: 'anterior' | 'posterior' | 'both' }[] = [
  { id: 'head_anterior', label: 'Head (Ant)', side: 'anterior' },
  { id: 'head_posterior', label: 'Head (Post)', side: 'posterior' },
  { id: 'neck_anterior', label: 'Neck (Ant)', side: 'anterior' },
  { id: 'neck_posterior', label: 'Neck (Post)', side: 'posterior' },
  { id: 'trunk_anterior', label: 'Trunk (Ant)', side: 'anterior' },
  { id: 'trunk_posterior', label: 'Trunk (Post)', side: 'posterior' },
  { id: 'right_arm_anterior', label: 'R Arm (Ant)', side: 'anterior' },
  { id: 'right_arm_posterior', label: 'R Arm (Post)', side: 'posterior' },
  { id: 'left_arm_anterior', label: 'L Arm (Ant)', side: 'anterior' },
  { id: 'left_arm_posterior', label: 'L Arm (Post)', side: 'posterior' },
  { id: 'right_hand', label: 'R Hand', side: 'both' },
  { id: 'left_hand', label: 'L Hand', side: 'both' },
  { id: 'genitalia', label: 'Genitalia', side: 'both' },
  { id: 'right_thigh_anterior', label: 'R Thigh (Ant)', side: 'anterior' },
  { id: 'right_thigh_posterior', label: 'R Thigh (Post)', side: 'posterior' },
  { id: 'left_thigh_anterior', label: 'L Thigh (Ant)', side: 'anterior' },
  { id: 'left_thigh_posterior', label: 'L Thigh (Post)', side: 'posterior' },
  { id: 'right_leg_anterior', label: 'R Leg (Ant)', side: 'anterior' },
  { id: 'right_leg_posterior', label: 'R Leg (Post)', side: 'posterior' },
  { id: 'left_leg_anterior', label: 'L Leg (Ant)', side: 'anterior' },
  { id: 'left_leg_posterior', label: 'L Leg (Post)', side: 'posterior' },
  { id: 'right_foot', label: 'R Foot', side: 'both' },
  { id: 'left_foot', label: 'L Foot', side: 'both' },
];

const BurnAdmissionForm: React.FC<BurnAdmissionFormProps> = ({ onComplete, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  
  // Patient selection state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientSelector, setShowPatientSelector] = useState(true);
  
  // Step 1: Patient Info
  const [patientId, setPatientId] = useState('');
  const [age, setAge] = useState<number>(30);
  const [weight, setWeight] = useState<number>(70);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 16));
  const [timeOfBurn, setTimeOfBurn] = useState(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 16));
  const [tetanusStatus, setTetanusStatus] = useState<'current' | 'needs_update' | 'unknown'>('unknown');

  // Load patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const fetchedPatients = await patientService.getAllPatients();
      setPatients(fetchedPatients);
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
    setPatientId(patient.hospital_number);
    setShowPatientSelector(false);
    
    // Pre-fill gender if patient has it
    if (patient.gender) {
      setGender(patient.gender.toLowerCase() === 'male' ? 'male' : 'female');
    }
    // Calculate and set age from date of birth
    if (patient.date_of_birth) {
      const birthDate = new Date(patient.date_of_birth);
      const today = new Date();
      let calculatedAge = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        calculatedAge--;
      }
      setAge(calculatedAge);
    }
  };

  // Step 2: Burn Details
  const [mechanism, setMechanism] = useState<BurnMechanism>('flame');
  const [circumstance, setCircumstance] = useState('');
  const [enclosedSpace, setEnclosedSpace] = useState(false);

  // Step 3: TBSA
  const [tbsaRegions, setTbsaRegions] = useState<TBSARegion[]>([]);
  const [selectedDepth, setSelectedDepth] = useState<BurnDepth>('superficial_partial');
  const [calculatedTBSA, setCalculatedTBSA] = useState(0);

  // Step 4: Inhalation Injury
  const [inhalationAssessment, setInhalationAssessment] = useState<InhalationInjuryAssessment>({
    suspected: false,
    confirmed: false,
    signs: {
      facialBurn: false,
      singedNasalHairs: false,
      carbonaceousSputum: false,
      hoarseness: false,
      stridorOrWheezing: false,
      enclosedSpaceBurn: false,
      alteredConsciousness: false,
    },
    bronchoscopyPerformed: false,
    intubated: false,
  });

  // Step 5: Resuscitation (auto-calculated)
  const [resuscitationPlan, setResuscitationPlan] = useState<any>(null);

  // Scores (auto-calculated)
  const [bauxScore, setBauxScore] = useState(0);
  const [revisedBauxScore, setRevisedBauxScore] = useState(0);
  const [absiScore, setAbsiScore] = useState<any>(null);
  const [disposition, setDisposition] = useState<any>(null);

  // Calculate TBSA whenever regions change
  useEffect(() => {
    const tbsa = burnCareService.calculateTBSALundBrowder(tbsaRegions, age);
    setCalculatedTBSA(tbsa);
  }, [tbsaRegions, age]);

  // Calculate scores when relevant data changes
  useEffect(() => {
    const hasInhalation = inhalationAssessment.confirmed || inhalationAssessment.suspected;
    const hasFullThickness = tbsaRegions.some(r => r.depth === 'full_thickness');
    const hasCircumferential = tbsaRegions.some(r => r.isCircumferential);

    setBauxScore(burnCareService.calculateBauxScore(age, calculatedTBSA));
    setRevisedBauxScore(burnCareService.calculateRevisedBauxScore(age, calculatedTBSA, hasInhalation));
    setAbsiScore(burnCareService.calculateABSI(age, gender, calculatedTBSA, hasFullThickness, hasInhalation));
    
    if (calculatedTBSA > 0) {
      const plan = burnCareService.calculateParklandFormula(weight, calculatedTBSA, new Date(timeOfBurn));
      setResuscitationPlan(plan);
    }

    setDisposition(burnCareService.determineDisposition(
      calculatedTBSA,
      hasInhalation,
      hasFullThickness,
      age,
      mechanism,
      hasCircumferential
    ));
  }, [age, calculatedTBSA, inhalationAssessment, tbsaRegions, gender, mechanism, weight, timeOfBurn]);

  // Check inhalation suspicion based on signs
  useEffect(() => {
    const signs = inhalationAssessment.signs;
    const signsCount = Object.values(signs).filter(Boolean).length;
    setInhalationAssessment(prev => ({
      ...prev,
      suspected: signsCount >= 2 || signs.carbonaceousSputum || signs.stridorOrWheezing,
    }));
  }, [inhalationAssessment.signs]);

  const handleRegionToggle = (regionId: AnatomicalRegion, percentBurned: number) => {
    setTbsaRegions(prev => {
      const existing = prev.find(r => r.region === regionId);
      if (existing) {
        if (percentBurned === 0) {
          return prev.filter(r => r.region !== regionId);
        }
        return prev.map(r => 
          r.region === regionId 
            ? { ...r, percentBurned, depth: selectedDepth }
            : r
        );
      }
      if (percentBurned > 0) {
        return [...prev, {
          region: regionId,
          percentBurned,
          depth: selectedDepth,
          isCircumferential: percentBurned === 100,
        }];
      }
      return prev;
    });
  };

  const getRegionBurn = (regionId: AnatomicalRegion): TBSARegion | undefined => {
    return tbsaRegions.find(r => r.region === regionId);
  };

  const handleSubmit = () => {
    const patient: BurnPatient = {
      id: uuidv4(),
      patientId,
      admissionDate: new Date(admissionDate),
      timeOfBurn: new Date(timeOfBurn),
      mechanism,
      tbsaAssessment: {
        method: 'lund_browder',
        totalTBSA: calculatedTBSA,
        regions: tbsaRegions,
        assessmentDate: new Date(),
        assessedBy: 'Current User', // Would come from auth
      },
      bauxScore,
      revisedBauxScore,
      absiScore,
      inhalationInjury: inhalationAssessment,
      age,
      weight,
      gender,
      resuscitation: resuscitationPlan,
      monitoring: {
        vitals: [],
        urineOutputs: [],
        fluidBalance: { inputs: [], outputs: [], cumulative24h: 0, cumulative48h: 0, cumulativeTotal: 0 },
        labs: [],
        woundAssessments: [],
        painScores: [],
      },
      activeAlerts: [],
      status: 'active',
      disposition: disposition?.disposition || 'ward',
      tetanusStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    onComplete(patient);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Patient Information</h3>
            
            {/* Selected Patient Display */}
            {selectedPatient && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                      <User className="w-5 h-5" />
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
                    type="button"
                    onClick={() => setShowPatientSelector(true)}
                    className="text-sm text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Change Patient
                  </button>
                </div>
              </div>
            )}
            
            {!selectedPatient && (
              <button
                type="button"
                onClick={() => setShowPatientSelector(true)}
                className="w-full p-4 border-2 border-dashed border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-2"
              >
                <Search className="w-5 h-5" />
                <span>Select Patient from Database</span>
              </button>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient ID / Hospital Number *
                </label>
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter patient ID"
                  readOnly={!!selectedPatient}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Age (years) *
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(Number(e.target.value))}
                  min={0}
                  max={120}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Age group for Lund-Browder: {burnCareService.getAgeGroup(age)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg) *
                </label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  min={1}
                  max={300}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender *
                </label>
                <div className="flex gap-4">
                  {(['male', 'female'] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                        gender === g
                          ? 'border-orange-500 bg-orange-50 text-orange-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock className="inline h-4 w-4 mr-1" />
                  Time of Burn Injury *
                </label>
                <input
                  type="datetime-local"
                  value={timeOfBurn}
                  onChange={(e) => setTimeOfBurn(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-red-600 mt-1">
                  Critical: Resuscitation timing starts from time of burn, not admission
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Date/Time
                </label>
                <input
                  type="datetime-local"
                  value={admissionDate}
                  onChange={(e) => setAdmissionDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tetanus Status
                </label>
                <div className="flex gap-4">
                  {([
                    { value: 'current', label: 'Up to date' },
                    { value: 'needs_update', label: 'Needs update' },
                    { value: 'unknown', label: 'Unknown' },
                  ] as const).map((status) => (
                    <button
                      key={status.value}
                      type="button"
                      onClick={() => setTetanusStatus(status.value)}
                      className={`py-2 px-4 rounded-lg border-2 transition-colors ${
                        tetanusStatus === status.value
                          ? status.value === 'current'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : status.value === 'needs_update'
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                            : 'border-gray-500 bg-gray-50 text-gray-700'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Burn Mechanism & Details</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Mechanism of Injury *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {BURN_MECHANISMS.map((mech) => (
                  <button
                    key={mech.value}
                    type="button"
                    onClick={() => setMechanism(mech.value)}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      mechanism === mech.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{mech.label}</div>
                    <div className="text-xs text-gray-500">{mech.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {(mechanism === 'electrical' || mechanism === 'chemical') && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-yellow-800">
                      {mechanism === 'electrical' ? 'Electrical Burn Alert' : 'Chemical Burn Alert'}
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      {mechanism === 'electrical' 
                        ? 'Consider: ECG monitoring, CK levels, hidden deep tissue injury, entry/exit wounds, cardiac monitoring for 24hrs'
                        : 'Consider: Copious irrigation (30+ min for alkali), identify agent, contact Poison Control, pH monitoring'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Circumstance / History
              </label>
              <textarea
                value={circumstance}
                onChange={(e) => setCircumstance(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Describe how the burn occurred..."
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="enclosedSpace"
                checked={enclosedSpace}
                onChange={(e) => {
                  setEnclosedSpace(e.target.checked);
                  setInhalationAssessment(prev => ({
                    ...prev,
                    signs: { ...prev.signs, enclosedSpaceBurn: e.target.checked }
                  }));
                }}
                className="h-5 w-5 text-orange-600 rounded focus:ring-orange-500"
              />
              <label htmlFor="enclosedSpace" className="text-sm text-gray-700">
                Burn occurred in an enclosed space (increases inhalation injury risk)
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">TBSA Assessment (Lund-Browder)</h3>
              <div className="text-2xl font-bold text-orange-600">
                {calculatedTBSA.toFixed(1)}% TBSA
              </div>
            </div>

            {/* Depth Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Burn Depth (then click body regions)
              </label>
              <div className="flex flex-wrap gap-2">
                {BURN_DEPTHS.map((depth) => (
                  <button
                    key={depth.value}
                    type="button"
                    onClick={() => setSelectedDepth(depth.value)}
                    className={`px-4 py-2 rounded-lg border-2 flex items-center gap-2 transition-colors ${
                      selectedDepth === depth.value
                        ? 'border-gray-900 ring-2 ring-gray-900'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded ${depth.color}`}></span>
                    {depth.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body Region Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Anterior */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 text-center">Anterior</h4>
                <div className="space-y-2">
                  {BODY_REGIONS.filter(r => r.side === 'anterior' || r.side === 'both').map((region) => {
                    const burn = getRegionBurn(region.id);
                    const maxPercent = LUND_BROWDER_CHART[region.id]?.[burnCareService.getAgeGroup(age)] || 0;
                    return (
                      <div key={region.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                        <div className="w-28 text-sm text-gray-700">{region.label}</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={burn?.percentBurned || 0}
                          onChange={(e) => handleRegionToggle(region.id, Number(e.target.value))}
                          className="flex-1"
                        />
                        <div className="w-16 text-right text-sm">
                          {burn?.percentBurned || 0}%
                          <span className="text-xs text-gray-400 block">of {maxPercent}%</span>
                        </div>
                        {burn && (
                          <span className={`w-3 h-3 rounded-full ${
                            BURN_DEPTHS.find(d => d.value === burn.depth)?.color || 'bg-gray-300'
                          }`}></span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Posterior */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3 text-center">Posterior</h4>
                <div className="space-y-2">
                  {BODY_REGIONS.filter(r => r.side === 'posterior').map((region) => {
                    const burn = getRegionBurn(region.id);
                    const maxPercent = LUND_BROWDER_CHART[region.id]?.[burnCareService.getAgeGroup(age)] || 0;
                    return (
                      <div key={region.id} className="flex items-center gap-3 p-2 bg-white rounded border">
                        <div className="w-28 text-sm text-gray-700">{region.label}</div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={burn?.percentBurned || 0}
                          onChange={(e) => handleRegionToggle(region.id, Number(e.target.value))}
                          className="flex-1"
                        />
                        <div className="w-16 text-right text-sm">
                          {burn?.percentBurned || 0}%
                          <span className="text-xs text-gray-400 block">of {maxPercent}%</span>
                        </div>
                        {burn && (
                          <span className={`w-3 h-3 rounded-full ${
                            BURN_DEPTHS.find(d => d.value === burn.depth)?.color || 'bg-gray-300'
                          }`}></span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary */}
            {tbsaRegions.length > 0 && (
              <div className="bg-orange-50 rounded-lg p-4">
                <h4 className="font-medium text-orange-900 mb-2">Burn Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-orange-700">Superficial:</span>
                    <span className="font-medium ml-2">
                      {tbsaRegions.filter(r => r.depth === 'superficial').length} regions
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-700">Superficial Partial:</span>
                    <span className="font-medium ml-2">
                      {tbsaRegions.filter(r => r.depth === 'superficial_partial').length} regions
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-700">Deep Partial:</span>
                    <span className="font-medium ml-2">
                      {tbsaRegions.filter(r => r.depth === 'deep_partial').length} regions
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-700">Full Thickness:</span>
                    <span className="font-medium ml-2">
                      {tbsaRegions.filter(r => r.depth === 'full_thickness').length} regions
                    </span>
                  </div>
                </div>
                {tbsaRegions.some(r => r.isCircumferential) && (
                  <div className="mt-3 p-2 bg-red-100 rounded text-red-700 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Circumferential burn detected - monitor for compartment syndrome
                  </div>
                )}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Inhalation Injury Assessment</h3>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-800">Clinical Signs Checklist</p>
                  <p className="text-sm text-blue-700">
                    Presence of 2+ signs suggests inhalation injury. Carbonaceous sputum or stridor alone is highly suspicious.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'facialBurn', label: 'Facial burns', desc: 'Burns to face, especially perioral' },
                { key: 'singedNasalHairs', label: 'Singed nasal hairs / eyebrows', desc: 'Thermal damage to facial hair' },
                { key: 'carbonaceousSputum', label: 'Carbonaceous sputum', desc: 'Black/sooty material in sputum' },
                { key: 'hoarseness', label: 'Hoarseness / voice changes', desc: 'Laryngeal edema signs' },
                { key: 'stridorOrWheezing', label: 'Stridor / wheezing', desc: 'Upper or lower airway obstruction' },
                { key: 'enclosedSpaceBurn', label: 'Enclosed space exposure', desc: 'Building fire, vehicle fire' },
                { key: 'alteredConsciousness', label: 'Altered consciousness', desc: 'CO poisoning, hypoxia' },
              ].map((sign) => (
                <div 
                  key={sign.key}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    (inhalationAssessment.signs as any)[sign.key]
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setInhalationAssessment(prev => ({
                    ...prev,
                    signs: { ...prev.signs, [sign.key]: !(prev.signs as any)[sign.key] }
                  }))}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={(inhalationAssessment.signs as any)[sign.key]}
                      onChange={() => {}}
                      className="h-5 w-5 text-purple-600 rounded"
                    />
                    <div>
                      <div className="font-medium text-gray-900">{sign.label}</div>
                      <div className="text-xs text-gray-500">{sign.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Inhalation Status */}
            {inhalationAssessment.suspected && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">Inhalation Injury Suspected</span>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="bronchoscopy"
                      checked={inhalationAssessment.bronchoscopyPerformed}
                      onChange={(e) => setInhalationAssessment(prev => ({
                        ...prev,
                        bronchoscopyPerformed: e.target.checked
                      }))}
                      className="h-5 w-5 text-yellow-600 rounded"
                    />
                    <label htmlFor="bronchoscopy" className="text-sm text-gray-700">
                      Bronchoscopy performed
                    </label>
                  </div>

                  {inhalationAssessment.bronchoscopyPerformed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bronchoscopy Grade (AIS)
                      </label>
                      <select
                        value={inhalationAssessment.bronchoscopyGrade || 0}
                        onChange={(e) => setInhalationAssessment(prev => ({
                          ...prev,
                          bronchoscopyGrade: Number(e.target.value) as 0 | 1 | 2 | 3 | 4,
                          confirmed: Number(e.target.value) > 0
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value={0}>Grade 0 - No injury</option>
                        <option value={1}>Grade 1 - Mild (edema, hyperemia)</option>
                        <option value={2}>Grade 2 - Moderate (friability, bronchorrhea)</option>
                        <option value={3}>Grade 3 - Severe (necrosis, obstruction)</option>
                        <option value={4}>Grade 4 - Massive (complete obstruction)</option>
                      </select>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="intubated"
                      checked={inhalationAssessment.intubated}
                      onChange={(e) => setInhalationAssessment(prev => ({
                        ...prev,
                        intubated: e.target.checked,
                        intubationDate: e.target.checked ? new Date() : undefined
                      }))}
                      className="h-5 w-5 text-red-600 rounded"
                    />
                    <label htmlFor="intubated" className="text-sm text-gray-700">
                      Patient intubated
                    </label>
                  </div>
                </div>
              </div>
            )}

            {!inhalationAssessment.suspected && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800">No clinical signs of inhalation injury</span>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Fluid Resuscitation Plan</h3>
            
            {calculatedTBSA < 15 ? (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-800">TBSA &lt;15%</p>
                    <p className="text-sm text-green-700">
                      Standard IV fluid resuscitation may not be required. Consider oral hydration and 
                      maintenance fluids. Monitor urine output.
                    </p>
                  </div>
                </div>
              </div>
            ) : resuscitationPlan && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-sm text-blue-600 mb-1">Total 24hr Volume</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {resuscitationPlan.totalVolume24h.toLocaleString()} mL
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Parkland: 4 × {weight}kg × {calculatedTBSA}%
                    </div>
                  </div>
                  
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-sm text-orange-600 mb-1">First 8 Hours</div>
                    <div className="text-2xl font-bold text-orange-900">
                      {resuscitationPlan.firstHalfVolume.toLocaleString()} mL
                    </div>
                    <div className="text-xs text-orange-600 mt-1">
                      Rate: ~{Math.round(resuscitationPlan.firstHalfVolume / 8)} mL/hr
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-sm text-green-600 mb-1">Next 16 Hours</div>
                    <div className="text-2xl font-bold text-green-900">
                      {resuscitationPlan.secondHalfVolume.toLocaleString()} mL
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      Rate: ~{Math.round(resuscitationPlan.secondHalfVolume / 16)} mL/hr
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Resuscitation Timeline</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time of Burn:</span>
                      <span className="font-medium">{new Date(timeOfBurn).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">First Half Ends:</span>
                      <span className="font-medium">{resuscitationPlan.firstHalfEndTime.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Resuscitation Ends:</span>
                      <span className="font-medium">{resuscitationPlan.resuscitationEndTime.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="font-medium text-yellow-800 mb-2">Urine Output Targets</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-yellow-700">Adults:</span>
                      <span className="font-medium text-yellow-900 ml-2">0.5–1.0 mL/kg/hr</span>
                    </div>
                    <div>
                      <span className="text-yellow-700">Children &lt;30kg:</span>
                      <span className="font-medium text-yellow-900 ml-2">1.0–1.5 mL/kg/hr</span>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    Titrate fluids to maintain urine output. Document hourly. Adjust rate by 20-30% if off target.
                  </p>
                </div>
              </>
            )}
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Assessment Summary</h3>
            
            {/* Prognostic Scores */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Baux Score</div>
                <div className="text-3xl font-bold text-gray-900">{bauxScore}</div>
                <div className="text-sm text-gray-500">
                  {burnCareService.interpretBauxScore(bauxScore).prognosis}
                </div>
              </div>
              
              <div className="bg-white border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">Revised Baux</div>
                <div className="text-3xl font-bold text-gray-900">{revisedBauxScore}</div>
                <div className="text-sm text-gray-500">
                  {inhalationAssessment.suspected ? '+17 for inhalation' : 'No inhalation modifier'}
                </div>
              </div>
              
              <div className="bg-white border rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">ABSI Score</div>
                <div className="text-3xl font-bold text-gray-900">{absiScore?.totalScore || 0}</div>
                <div className="text-sm text-gray-500">
                  Mortality: {absiScore?.mortalityRisk || 'N/A'}
                </div>
              </div>
            </div>

            {/* Disposition */}
            {disposition && (
              <div className={`p-4 rounded-lg border-2 ${
                disposition.disposition === 'icu' || disposition.disposition === 'burn_center'
                  ? 'bg-red-50 border-red-200'
                  : disposition.disposition === 'ward'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                <h4 className="font-medium mb-2">
                  Recommended Disposition: 
                  <span className="ml-2 uppercase">{disposition.disposition.replace('_', ' ')}</span>
                </h4>
                <ul className="text-sm space-y-1">
                  {disposition.reasons.map((reason: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary Table */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Patient Summary</h4>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Patient ID:</span>
                  <span className="font-medium">{patientId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Age/Gender:</span>
                  <span className="font-medium">{age}y / {gender}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Weight:</span>
                  <span className="font-medium">{weight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mechanism:</span>
                  <span className="font-medium capitalize">{mechanism}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total TBSA:</span>
                  <span className="font-medium text-orange-600">{calculatedTBSA}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Inhalation Injury:</span>
                  <span className="font-medium">
                    {inhalationAssessment.confirmed ? 'Confirmed' : 
                     inhalationAssessment.suspected ? 'Suspected' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Intubated:</span>
                  <span className="font-medium">{inhalationAssessment.intubated ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tetanus:</span>
                  <span className={`font-medium ${
                    tetanusStatus === 'needs_update' ? 'text-red-600' : ''
                  }`}>
                    {tetanusStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {tetanusStatus === 'needs_update' && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700">Remember to update tetanus prophylaxis</span>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const isStepValid = (): boolean => {
    switch (currentStep) {
      case 1:
        return patientId.trim() !== '' && age > 0 && weight > 0;
      case 2:
        return true;
      case 3:
        return calculatedTBSA > 0;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onCancel}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-xl font-bold">New Burn Admission</h1>
                <p className="text-orange-100 text-sm">WHO/ISBI Protocol</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{calculatedTBSA.toFixed(1)}%</div>
              <div className="text-orange-100 text-sm">TBSA</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isComplete = currentStep > step.id;
              
              return (
                <React.Fragment key={step.id}>
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex flex-col items-center gap-1 ${
                      isActive ? 'text-orange-600' : isComplete ? 'text-green-600' : 'text-gray-400'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      isActive ? 'bg-orange-100' : isComplete ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {isComplete ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>
                    <span className="text-xs font-medium hidden sm:block">{step.title}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="h-5 w-5" />
            Previous
          </button>

          {currentStep < STEPS.length ? (
            <button
              onClick={() => setCurrentStep(prev => prev + 1)}
              disabled={!isStepValid()}
              className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Save className="h-5 w-5" />
              Admit Patient
            </button>
          )}
        </div>
      </div>

      {/* Patient Selector Modal */}
      {showPatientSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-red-600 text-white p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold mb-1">Select Patient</h2>
                  <p className="text-orange-100 text-sm">
                    Choose a patient from the database for burn admission
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPatientSelector(false);
                    setPatientSearchTerm('');
                  }}
                  className="text-white hover:text-orange-100"
                >
                  <X className="w-5 h-5" />
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
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* Patient List */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingPatients ? (
                <div className="text-center py-8 text-gray-500">
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
                      className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
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
                            {patient.phone && <span>📞 {patient.phone}</span>}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
              <p className="text-xs text-gray-600">
                Or enter patient details manually
              </p>
              <button
                onClick={() => {
                  setShowPatientSelector(false);
                  setPatientSearchTerm('');
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Enter Manually
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BurnAdmissionForm;
