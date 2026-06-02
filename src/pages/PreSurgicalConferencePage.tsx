import { useState, useEffect, useCallback } from 'react';
import { 
  Presentation, 
  Play, 
  Users, 
  Search, 
  ChevronRight,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { 
  preSurgicalConferenceService, 
  ConferenceData, 
  ConferencePatient 
} from '../services/preSurgicalConferenceService';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';

// Import slide components
import SlideWrapper from '../components/preSurgicalConference/SlideWrapper';
import ClinicalSummarySlide from '../components/preSurgicalConference/ClinicalSummarySlide';
import ComorbiditiesSlide from '../components/preSurgicalConference/ComorbiditiesSlide';
import ClinicalPhotographsSlide from '../components/preSurgicalConference/ClinicalPhotographsSlide';
import LabResultsSlide from '../components/preSurgicalConference/LabResultsSlide';
import MedicationsSlide from '../components/preSurgicalConference/MedicationsSlide';
import AnaesthetistCommentsSlide from '../components/preSurgicalConference/AnaesthetistCommentsSlide';
import PlannedProceduresSlide from '../components/preSurgicalConference/PlannedProceduresSlide';
import ShoppingListStatusSlide from '../components/preSurgicalConference/ShoppingListStatusSlide';
import PreparingTeamSlide from '../components/preSurgicalConference/PreparingTeamSlide';

const SLIDE_TITLES = [
  { title: 'Clinical Summary', subtitle: 'Patient demographics and medical history' },
  { title: 'Comorbidities', subtitle: 'Co-existing medical conditions' },
  { title: 'Clinical Photographs', subtitle: 'Visual documentation' },
  { title: 'Laboratory Results', subtitle: 'Investigations and tests' },
  { title: 'Current Medications', subtitle: 'Active prescriptions' },
  { title: 'Anaesthetist Comments', subtitle: 'Pre-anaesthetic assessment' },
  { title: 'Planned Procedures', subtitle: 'Surgical schedule' },
  { title: 'Shopping List Status', subtitle: 'Surgical consumables' },
  { title: 'Preparation Team', subtitle: 'Team members' },
];

export default function PreSurgicalConferencePage() {
  const [patients, setPatients] = useState<ConferencePatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<ConferencePatient | null>(null);
  const [conferenceData, setConferenceData] = useState<ConferenceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  useOnSelectedPatient((p) => {
    const match = patients.find((cp: any) => String(cp.patient_id || cp.id) === String(p.id));
    if (match) setSelectedPatient(match);
    else setSearchTerm(((p as any).hospital_number || '').toString());
  });
  
  // Presentation state
  const [isPresentationActive, setIsPresentationActive] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1);

  // Load scheduled patients on mount
  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setPatientsLoading(true);
      const data = await preSurgicalConferenceService.getScheduledPatients();
      setPatients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading patients:', err);
      setError('Failed to load patients');
      setPatients([]);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadConferenceData = async (patientId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await preSurgicalConferenceService.getConferenceData(patientId);
      setConferenceData(data);
    } catch (err) {
      console.error('Error loading conference data:', err);
      setError('Failed to load conference data');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = (patient: ConferencePatient) => {
    setSelectedPatient(patient);
    loadConferenceData(patient.id);
  };

  const startPresentation = () => {
    if (conferenceData) {
      setCurrentSlide(1);
      setIsPresentationActive(true);
    }
  };

  const exitPresentation = () => {
    setIsPresentationActive(false);
  };

  const nextSlide = () => {
    if (currentSlide < SLIDE_TITLES.length) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 1) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  // Keyboard navigation for presentation
  useEffect(() => {
    if (!isPresentationActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          nextSlide();
          break;
        case 'ArrowLeft':
          prevSlide();
          break;
        case 'Escape':
          exitPresentation();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationActive, currentSlide]);

  const filteredPatients = patients.filter(p => 
    (p.full_name || `${p.first_name} ${p.last_name}`).toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.hospital_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Render current slide content
  const renderSlide = () => {
    if (!conferenceData) return null;

    const categorizedLabs = preSurgicalConferenceService.categorizeLabResults(conferenceData.labResults);
    const categorizedMeds = preSurgicalConferenceService.categorizeMedications(conferenceData.medications);

    switch (currentSlide) {
      case 1:
        return <ClinicalSummarySlide patient={conferenceData.patient} />;
      case 2:
        return <ComorbiditiesSlide comorbidities={conferenceData.comorbidities} />;
      case 3:
        return <ClinicalPhotographsSlide photographs={conferenceData.clinicalPhotographs} />;
      case 4:
        return <LabResultsSlide labResults={conferenceData.labResults} categorizedResults={categorizedLabs} />;
      case 5:
        return <MedicationsSlide medications={conferenceData.medications} categorizedMedications={categorizedMeds} />;
      case 6:
        return <AnaesthetistCommentsSlide comments={conferenceData.anaesthetistComments} />;
      case 7:
        return <PlannedProceduresSlide procedures={conferenceData.plannedProcedures} />;
      case 8:
        return <ShoppingListStatusSlide shoppingList={conferenceData.shoppingListStatus} />;
      case 9:
        return <PreparingTeamSlide team={conferenceData.preparingTeam} />;
      default:
        return null;
    }
  };

  // Fullscreen presentation mode
  if (isPresentationActive && conferenceData) {
    return (
      <SlideWrapper
        title={SLIDE_TITLES[currentSlide - 1].title}
        subtitle={SLIDE_TITLES[currentSlide - 1].subtitle}
        onExit={exitPresentation}
        onNext={currentSlide < SLIDE_TITLES.length ? nextSlide : undefined}
        onPrev={currentSlide > 1 ? prevSlide : undefined}
        currentSlide={currentSlide}
        totalSlides={SLIDE_TITLES.length}
      >
        {renderSlide()}
      </SlideWrapper>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
            <Presentation className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Pre-Surgical Conference</h1>
            <p className="text-gray-600">Review and present patient cases before surgery</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient Selection Panel */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-600" />
              <span>Select Patient</span>
            </h2>
            <div className="mt-3 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
          
          <div className="max-h-[500px] overflow-y-auto">
            {patientsLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
                <p className="text-gray-500 mt-2">Loading patients...</p>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p>No patients found</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient)}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                      selectedPatient?.id === patient.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {patient.full_name || `${patient.first_name} ${patient.last_name}`}
                      </p>
                      <p className="text-sm text-gray-500">{patient.hospital_number}</p>
                      {patient.ward && (
                        <p className="text-xs text-gray-400">Ward: {patient.ward}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview & Controls Panel */}
        <div className="lg:col-span-2 space-y-6">
          {!selectedPatient ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Presentation className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600">Select a Patient</h3>
              <p className="text-gray-500 mt-2">
                Choose a patient from the list to view their conference presentation
              </p>
            </div>
          ) : loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Loader2 className="h-12 w-12 animate-spin text-green-600 mx-auto" />
              <p className="text-gray-600 mt-4">Loading conference data...</p>
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
              <p className="text-red-600 mt-4">{error}</p>
              <button 
                onClick={() => loadConferenceData(selectedPatient.id)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Retry
              </button>
            </div>
          ) : conferenceData ? (
            <>
              {/* Patient Summary Card */}
              <div className="bg-gradient-to-br from-green-600 to-green-800 rounded-xl shadow-sm p-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg sm:text-2xl font-bold">
                      {conferenceData.patient.full_name || 
                        `${conferenceData.patient.first_name} ${conferenceData.patient.last_name}`}
                    </h2>
                    <p className="text-green-100 mt-1">
                      Hospital No: {conferenceData.patient.hospital_number}
                    </p>
                    <div className="mt-4 space-y-1 text-sm text-green-100">
                      <p>Primary Diagnosis: {conferenceData.patient.primary_diagnosis || 'N/A'}</p>
                      <p>Ward: {conferenceData.patient.ward || 'N/A'} • Bed: {conferenceData.patient.bed_number || 'N/A'}</p>
                    </div>
                  </div>
                  <button
                    onClick={startPresentation}
                    className="flex items-center space-x-2 bg-white text-green-700 px-6 py-3 rounded-xl font-semibold hover:bg-green-50 transition-colors shadow-lg"
                  >
                    <Play className="h-5 w-5" />
                    <span>Start Presentation</span>
                  </button>
                </div>
              </div>

              {/* Slides Overview */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Presentation Slides</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {SLIDE_TITLES.map((slide, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setCurrentSlide(index + 1);
                        setIsPresentationActive(true);
                      }}
                      className="p-4 bg-gray-50 hover:bg-green-50 border border-gray-200 rounded-lg text-left transition-colors group"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold group-hover:bg-green-700">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{slide.title}</p>
                          <p className="text-xs text-gray-500">{slide.subtitle}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard 
                  label="Lab Results" 
                  value={conferenceData.labResults.length} 
                  color="purple" 
                />
                <StatCard 
                  label="Medications" 
                  value={conferenceData.medications.length} 
                  color="blue" 
                />
                <StatCard 
                  label="Procedures" 
                  value={conferenceData.plannedProcedures.length} 
                  color="rose" 
                />
                <StatCard 
                  label="Shopping List" 
                  value={conferenceData.shoppingListStatus.is_complete ? 'Complete' : 'Pending'} 
                  color={conferenceData.shoppingListStatus.is_complete ? 'green' : 'orange'} 
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: string | number; 
  color: string 
}) {
  const colorClasses: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color] || colorClasses.blue}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-lg sm:text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
