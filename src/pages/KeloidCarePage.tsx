import React, { useState, useEffect, useCallback } from 'react';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  
  Download,
  
  FileText,
  Heart,
  Info,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Share2,
  Syringe,
  
  
  X,
  Zap
} from 'lucide-react';
import { patientService } from '../services/patientService';
import {
  keloidCareService,
  KeloidCarePlan,
  KeloidInjection,
  PretreatmentTest,
  KELOID_LOCATIONS,
  PROBLEMS_CONCERNS,
  RISK_FACTORS,
  COMMON_COMORBIDITIES,
  REQUIRED_PRETREATMENT_TESTS,
  PREGNANCY_TEST,
  SURGERY_TECHNIQUES,
  RADIOTHERAPY_INDICATIONS,
  RADIOTHERAPY_SIDE_EFFECTS,
  RADIOTHERAPY_SIDE_EFFECT_MANAGEMENT,
  KELOID_EDUCATION
} from '../services/keloidCareService';
import { keloidPdfService } from '../services/keloidPdfService';
import { format, isBefore, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

// ============================================
// TYPES
// ============================================

interface Patient {
  id: number;
  hospital_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
}

type TabType = 'plans' | 'education' | 'create';
type PlanViewTab = 'overview' | 'tests' | 'injections' | 'surgery' | 'adjunct' | 'radiotherapy';

// ============================================
// MAIN COMPONENT
// ============================================

const KeloidCarePage: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('plans');
  const [plans, setPlans] = useState<KeloidCarePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<KeloidCarePlan | null>(null);
  const [planViewTab, setPlanViewTab] = useState<PlanViewTab>('overview');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [initialPatientId, setInitialPatientId] = useState<number | null>(null);
  useOnSelectedPatient((p) => {
    const idNum = Number(p.id);
    if (!Number.isNaN(idNum)) setInitialPatientId(idNum);
    setShowCreateModal(true);
  });
  const [showRecordInjectionModal, setShowRecordInjectionModal] = useState(false);
  const [selectedInjection, setSelectedInjection] = useState<KeloidInjection | null>(null);
  const [showEducationSection, setShowEducationSection] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansData, patientsData] = await Promise.all([
        keloidCareService.getAllPlans(),
        patientService.getAllPatients()
      ]);
      setPlans(plansData);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load plan details when selected
  const loadPlanDetails = async (planId: number) => {
    try {
      const plan = await keloidCareService.getPlan(planId);
      setSelectedPlan(plan);
    } catch (error) {
      console.error('Error loading plan details:', error);
      toast.error('Failed to load plan details');
    }
  };

  // Filter plans by search
  const filteredPlans = plans.filter(plan => {
    const searchLower = searchQuery.toLowerCase();
    const patientName = `${plan.first_name || ''} ${plan.last_name || ''}`.toLowerCase();
    const hospitalNumber = (plan.hospital_number || '').toLowerCase();
    return patientName.includes(searchLower) || hospitalNumber.includes(searchLower);
  });

  // Handle print/share
  const handlePrintPlan = () => {
    if (!selectedPlan) return;
    try {
      keloidPdfService.generateCarePlanPdf(selectedPlan);
      toast.success('Care plan PDF generated successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Generate specific PDF types
  const handleDownloadChecklist = () => {
    if (!selectedPlan) return;
    try {
      keloidPdfService.generatePreTreatmentChecklistPdf(selectedPlan);
      toast.success('Pre-treatment checklist PDF generated');
    } catch (error) {
      console.error('Error generating checklist PDF:', error);
      toast.error('Failed to generate checklist PDF');
    }
  };

  const handleDownloadSchedule = () => {
    if (!selectedPlan) return;
    try {
      keloidPdfService.generateTreatmentSchedulePdf(selectedPlan);
      toast.success('Treatment schedule PDF generated');
    } catch (error) {
      console.error('Error generating schedule PDF:', error);
      toast.error('Failed to generate schedule PDF');
    }
  };

  const handleDownloadEducation = () => {
    try {
      keloidPdfService.generatePatientEducationPdf();
      toast.success('Patient education PDF generated');
    } catch (error) {
      console.error('Error generating education PDF:', error);
      toast.error('Failed to generate education PDF');
    }
  };

  const handleSharePlan = async () => {
    if (!selectedPlan) return;
    
    const summary = keloidCareService.generatePlanSummary(selectedPlan);
    const patientName = `${selectedPlan.first_name || ''} ${selectedPlan.last_name || ''}`.trim();
    
    // Try Web Share API first
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Keloid Treatment Plan - ${patientName}`,
          text: summary
        });
        toast.success('Plan shared successfully');
        return;
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    }
    
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(summary);
      toast.success('Plan copied to clipboard');
    } catch (err) {
      toast.error('Failed to share plan');
    }
  };

  // Download as PDF (using jsPDF)
  const [showPdfMenu, setShowPdfMenu] = useState(false);

  const handleDownloadPDF = () => {
    if (!selectedPlan) return;
    try {
      keloidPdfService.generateCarePlanPdf(selectedPlan);
      toast.success('Care plan PDF downloaded successfully');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  const handleThermalPDF = async () => {
    if (!selectedPlan) return;
    try {
      await keloidPdfService.generateThermalCarePlanPdf(selectedPlan);
      toast.success('Thermal care plan PDF generated');
    } catch (error) {
      console.error('Error generating thermal PDF:', error);
      toast.error('Failed to generate thermal PDF');
    }
  };

  // Record injection
  const handleRecordInjection = async (data: Partial<KeloidInjection>) => {
    if (!selectedPlan || !selectedInjection) return;
    
    try {
      await keloidCareService.recordInjection(selectedPlan.id, selectedInjection.id, data);
      await loadPlanDetails(selectedPlan.id);
      setShowRecordInjectionModal(false);
      setSelectedInjection(null);
    } catch (error) {
      console.error('Error recording injection:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Keloid Care Planning</h1>
                <p className="text-sm text-gray-500">Comprehensive multi-modality treatment management</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              New Care Plan
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-4 mt-4 border-b">
            {[
              { id: 'plans', label: 'Treatment Plans', icon: FileText },
              { id: 'education', label: 'Patient Education', icon: BookOpen }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Plans List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-sm border">
                <div className="p-4 border-b">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search patients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {filteredPlans.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No keloid care plans found</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-green-600 hover:text-green-700 font-medium"
                      >
                        Create your first plan
                      </button>
                    </div>
                  ) : (
                    filteredPlans.map(plan => (
                      <button
                        key={plan.id}
                        onClick={() => loadPlanDetails(plan.id)}
                        className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                          selectedPlan?.id === plan.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900">
                              {plan.first_name} {plan.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{plan.hospital_number}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                plan.status === 'active' ? 'bg-green-100 text-green-700' :
                                plan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {plan.status}
                              </span>
                              <span className="text-xs text-gray-400">
                                {keloidCareService.getPhaseLabel(plan.phase)}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                        {plan.injection_stats && (
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Syringe className="h-3 w-3" />
                              Pre: {plan.injection_stats.preop_completed}/{plan.preop_triamcinolone_count || 0}
                            </span>
                            <span className="flex items-center gap-1">
                              Post: {plan.injection_stats.postop_completed}/{plan.postop_triamcinolone_count || 0}
                            </span>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Plan Details */}
            <div className="lg:col-span-2">
              {selectedPlan ? (
                <PlanDetails
                  plan={selectedPlan}
                  activeTab={planViewTab}
                  onTabChange={setPlanViewTab}
                  onRefresh={() => loadPlanDetails(selectedPlan.id)}
                  onPrint={handlePrintPlan}
                  onShare={handleSharePlan}
                  onDownloadPDF={handleDownloadPDF}
                  onThermalPDF={handleThermalPDF}
                  onDownloadChecklist={handleDownloadChecklist}
                  onDownloadSchedule={handleDownloadSchedule}
                  onDownloadEducation={handleDownloadEducation}
                  showPdfMenu={showPdfMenu}
                  onTogglePdfMenu={() => setShowPdfMenu(!showPdfMenu)}
                  onRecordInjection={(injection) => {
                    setSelectedInjection(injection);
                    setShowRecordInjectionModal(true);
                  }}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                  <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Care Plan</h3>
                  <p className="text-gray-500">Choose a plan from the list to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'education' && (
          <PatientEducationContent
            expandedSection={showEducationSection}
            onToggleSection={(section) => setShowEducationSection(
              showEducationSection === section ? null : section
            )}
          />
        )}
      </div>

      {/* Create Plan Modal */}
      {showCreateModal && (
        <CreatePlanModal
          patients={patients}
          initialPatientId={initialPatientId}
          onClose={() => { setShowCreateModal(false); setInitialPatientId(null); }}
          onSuccess={() => {
            setShowCreateModal(false);
            setInitialPatientId(null);
            loadData();
          }}
        />
      )}

      {/* Record Injection Modal */}
      {showRecordInjectionModal && selectedInjection && selectedPlan && (
        <RecordInjectionModal
          injection={selectedInjection}
          onClose={() => {
            setShowRecordInjectionModal(false);
            setSelectedInjection(null);
          }}
          onSubmit={handleRecordInjection}
        />
      )}
    </div>
  );
};

// ============================================
// PLAN DETAILS COMPONENT
// ============================================

interface PlanDetailsProps {
  plan: KeloidCarePlan;
  activeTab: PlanViewTab;
  onTabChange: (tab: PlanViewTab) => void;
  onRefresh: () => void;
  onPrint: () => void;
  onShare: () => void;
  onDownloadPDF: () => void;
  onThermalPDF: () => void;
  onDownloadChecklist: () => void;
  onDownloadSchedule: () => void;
  onDownloadEducation: () => void;
  showPdfMenu: boolean;
  onTogglePdfMenu: () => void;
  onRecordInjection: (injection: KeloidInjection) => void;
}

const PlanDetails: React.FC<PlanDetailsProps> = ({
  plan,
  activeTab,
  onTabChange,
  onRefresh,
  onPrint,
  onShare,
  onDownloadPDF,
  onThermalPDF,
  onDownloadChecklist,
  onDownloadSchedule,
  onDownloadEducation,
  showPdfMenu,
  onTogglePdfMenu,
  onRecordInjection
}) => {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'tests', label: 'Pre-Treatment Tests', icon: Activity },
    { id: 'injections', label: 'Injections', icon: Syringe },
    { id: 'surgery', label: 'Surgery', icon: Heart },
    { id: 'adjunct', label: 'Adjunct Therapy', icon: Zap },
    { id: 'radiotherapy', label: 'Radiotherapy', icon: AlertTriangle }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {plan.first_name} {plan.last_name}
            </h2>
            <p className="text-sm text-gray-500">
              Hospital #: {plan.hospital_number} | Created: {plan.created_at ? format(new Date(plan.created_at), 'dd MMM yyyy') : 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
            <button
              onClick={onPrint}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Print"
            >
              <Printer className="h-5 w-5" />
            </button>
            <button
              onClick={onShare}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Share"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <div className="relative">
              <button
                onClick={onTogglePdfMenu}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                PDF
                <ChevronDown className="h-3 w-3" />
              </button>
              {showPdfMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border z-50">
                  <div className="p-2">
                    <button
                      onClick={() => { onDownloadPDF(); onTogglePdfMenu(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-green-50 rounded-lg"
                    >
                      <FileText className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">Full Care Plan</p>
                        <p className="text-xs text-gray-500">Complete treatment plan PDF</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { onDownloadChecklist(); onTogglePdfMenu(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-blue-50 rounded-lg"
                    >
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Pre-Treatment Checklist</p>
                        <p className="text-xs text-gray-500">Tests checklist for injections</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { onDownloadSchedule(); onTogglePdfMenu(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-purple-50 rounded-lg"
                    >
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <div>
                        <p className="font-medium text-gray-900">Treatment Schedule</p>
                        <p className="text-xs text-gray-500">Injection & surgery timeline</p>
                      </div>
                    </button>
                    <button
                      onClick={() => { onDownloadEducation(); onTogglePdfMenu(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-yellow-50 rounded-lg"
                    >
                      <BookOpen className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="font-medium text-gray-900">Patient Education</p>
                        <p className="text-xs text-gray-500">Handout for patient</p>
                      </div>
                    </button>
                    <hr className="my-1 border-gray-200" />
                    <button
                      onClick={() => { onThermalPDF(); onTogglePdfMenu(); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-orange-50 rounded-lg"
                    >
                      <Printer className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="font-medium text-gray-900">Thermal Print (80mm)</p>
                        <p className="text-xs text-gray-500">Compact receipt-style PDF</p>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-3 flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            plan.status === 'active' ? 'bg-green-100 text-green-700' :
            plan.status === 'completed' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
          </span>
          <span className="text-sm text-gray-500">
            Phase: {keloidCareService.getPhaseLabel(plan.phase)}
          </span>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id as PlanViewTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && <OverviewTab plan={plan} />}
        {activeTab === 'tests' && <TestsTab plan={plan} onRefresh={onRefresh} />}
        {activeTab === 'injections' && (
          <InjectionsTab plan={plan} onRecordInjection={onRecordInjection} />
        )}
        {activeTab === 'surgery' && <SurgeryTab plan={plan} />}
        {activeTab === 'adjunct' && <AdjunctTherapyTab plan={plan} />}
        {activeTab === 'radiotherapy' && <RadiotherapyTab plan={plan} />}
      </div>
    </div>
  );
};

// ============================================
// TAB COMPONENTS
// ============================================

const OverviewTab: React.FC<{ plan: KeloidCarePlan }> = ({ plan }) => {
  // Calculate compliance metrics
  const injections = plan.injections || [];
  const totalInjections = injections.length;
  const completedInjections = injections.filter(i => i.status === 'completed').length;
  const missedInjections = injections.filter(i => i.status === 'missed').length;
  const overdueInjections = injections.filter(i => {
    if (i.status !== 'scheduled') return false;
    return isBefore(new Date(i.scheduled_date), new Date());
  }).length;
  const complianceRate = totalInjections > 0 
    ? Math.round((completedInjections / Math.max(completedInjections + missedInjections, 1)) * 100) 
    : 0;

  // Pre-treatment test status
  const tests = plan.pretreatment_tests || [];
  const testStatus = keloidCareService.arePretreatmentTestsComplete(tests);

  return (
    <div className="space-y-6">
      {/* Multi-Modality Treatment Importance Banner */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-lg flex-shrink-0">
            <Zap className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900 text-lg">Multi-Modality Treatment Approach</h3>
            <p className="text-sm text-green-800 mt-1">
              Keloid treatment requires a <strong>combined approach</strong> for best outcomes. 
              Surgery alone has a 45-100% recurrence rate, but combining pre-operative steroid injections, 
              surgical excision, post-operative injections, silicone therapy, compression therapy, and 
              radiotherapy (when indicated) significantly reduces recurrence to 10-30%.
            </p>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-white/70 rounded-lg px-2 py-1.5">
                <Syringe className="h-3.5 w-3.5" />
                <span>Pre-Op Injections</span>
                {(plan.preop_triamcinolone_count || 0) > 0 && <Check className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-white/70 rounded-lg px-2 py-1.5">
                <Heart className="h-3.5 w-3.5" />
                <span>Surgery</span>
                {plan.surgery_planned && <Check className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-white/70 rounded-lg px-2 py-1.5">
                <Syringe className="h-3.5 w-3.5" />
                <span>Post-Op Injections</span>
                {(plan.postop_triamcinolone_count || 0) > 0 && <Check className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-white/70 rounded-lg px-2 py-1.5">
                <Activity className="h-3.5 w-3.5" />
                <span>Silicone Therapy</span>
                {plan.silicone_sheet_start_date && <Check className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-white/70 rounded-lg px-2 py-1.5">
                <Activity className="h-3.5 w-3.5" />
                <span>Compression</span>
                {plan.compression_therapy_start_date && <Check className="h-3 w-3 text-green-600" />}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-white/70 rounded-lg px-2 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Radiotherapy</span>
                {plan.radiotherapy_indicated && <Check className="h-3 w-3 text-green-600" />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Tracking Dashboard */}
      <div className="bg-white border rounded-xl p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-600" />
          Compliance Tracker
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{complianceRate}%</p>
            <p className="text-xs text-green-700 mt-1">Injection Compliance</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">{completedInjections}/{totalInjections}</p>
            <p className="text-xs text-blue-700 mt-1">Injections Completed</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600">{overdueInjections + missedInjections}</p>
            <p className="text-xs text-red-700 mt-1">Overdue/Missed</p>
          </div>
          <div className={`text-center p-3 rounded-lg ${testStatus.complete ? 'bg-green-50' : 'bg-yellow-50'}`}>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${testStatus.complete ? 'text-green-600' : 'text-yellow-600'}`}>
              {testStatus.complete ? '✓' : '!'}
            </p>
            <p className={`text-xs mt-1 ${testStatus.complete ? 'text-green-700' : 'text-yellow-700'}`}>
              {testStatus.complete ? 'Tests Complete' : 'Tests Pending'}
            </p>
          </div>
        </div>
        {(overdueInjections > 0 || missedInjections > 0) && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-medium">Compliance Alert</p>
              <p>This patient has {overdueInjections > 0 ? `${overdueInjections} overdue` : ''}{overdueInjections > 0 && missedInjections > 0 ? ' and ' : ''}{missedInjections > 0 ? `${missedInjections} missed` : ''} injection(s). 
              Missing treatments significantly increases keloid recurrence risk. Please follow up with the patient.</p>
            </div>
          </div>
        )}
        {plan.compliance_notes && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <span className="font-medium">Compliance Notes:</span> {plan.compliance_notes}
          </div>
        )}
      </div>

      {/* Pre-Treatment Tests Status Alert */}
      {!testStatus.complete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-amber-900">Pre-Triamcinolone Tests Required</h4>
              <p className="text-sm text-amber-800 mt-1">
                Before commencing intralesional triamcinolone injections, the following mandatory investigations must be completed:
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                <li className="flex items-center gap-2"><span className="font-bold">•</span> Full Blood Count (FBC) — baseline hematological status</li>
                <li className="flex items-center gap-2"><span className="font-bold">•</span> Mantoux Test — screen for latent TB (steroids can reactivate)</li>
                <li className="flex items-center gap-2"><span className="font-bold">•</span> Fasting Blood Sugar — diabetes screening & steroid monitoring</li>
                {keloidCareService.isPregnancyTestRequired(plan.gender || '', plan.date_of_birth || '') && (
                  <li className="flex items-center gap-2 text-red-700 font-medium"><span className="font-bold">•</span> Pregnancy Test (β-hCG) — triamcinolone is teratogenic</li>
                )}
              </ul>
              <div className="mt-2 text-xs text-amber-700 bg-amber-100 rounded-lg px-3 py-2">
                <strong>Outstanding:</strong> {testStatus.issues.join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Summary */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Clinical Summary</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-gray-700 whitespace-pre-wrap">{plan.clinical_summary || 'No summary provided'}</p>
        </div>
      </div>

      {/* Keloid Locations */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Keloid Location(s)</h3>
        <div className="flex flex-wrap gap-2">
          {plan.keloid_locations?.length ? (
            plan.keloid_locations.map((loc, idx) => (
              <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                {loc}
              </span>
            ))
          ) : (
            <span className="text-gray-500">Not specified</span>
          )}
        </div>
      </div>

      {/* Problems & Concerns */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Identified Problems & Concerns</h3>
        <p className="text-xs text-gray-500 mb-2">e.g., Cosmesis, Pain, Ulceration, Itching</p>
        <div className="flex flex-wrap gap-2">
          {plan.problems_concerns?.length ? (
            plan.problems_concerns.map((concern, idx) => (
              <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                {concern}
              </span>
            ))
          ) : (
            <span className="text-gray-500">None specified</span>
          )}
        </div>
      </div>

      {/* Comorbidities */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Comorbidities</h3>
        {plan.has_no_comorbidities ? (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
            <CheckCircle className="inline h-4 w-4 mr-1" />
            None
          </span>
        ) : plan.comorbidities?.length ? (
          <div className="flex flex-wrap gap-2">
            {plan.comorbidities.map((condition, idx) => (
              <span key={idx} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                {condition}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-500">Not specified</span>
        )}
      </div>

      {/* Risk Factors */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Risk Factors</h3>
        <div className="flex flex-wrap gap-2">
          {plan.risk_factors?.length ? (
            plan.risk_factors.map((factor, idx) => (
              <span key={idx} className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                {factor}
              </span>
            ))
          ) : (
            <span className="text-gray-500">None identified</span>
          )}
        </div>
      </div>

      {/* Treatment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Pre-Op Injections</h4>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{plan.preop_triamcinolone_count || 0}</p>
          <p className="text-sm text-blue-700">Every {plan.preop_injection_interval_weeks || 3} weeks</p>
          {plan.injection_stats && (
            <p className="text-xs text-blue-600 mt-1">{plan.injection_stats.preop_completed} completed</p>
          )}
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <h4 className="font-medium text-purple-900 mb-2">Surgery</h4>
          <p className="text-lg font-semibold text-purple-600">
            {plan.surgery_planned ? (plan.surgery_date ? format(new Date(plan.surgery_date), 'dd MMM yyyy') : 'Planned') : 'Not Planned'}
          </p>
          <p className="text-sm text-purple-700">{plan.surgery_technique || '-'}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <h4 className="font-medium text-green-900 mb-2">Post-Op Injections</h4>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{plan.postop_triamcinolone_count || 0}</p>
          <p className="text-sm text-green-700">Every {plan.postop_injection_interval_weeks || 3} weeks</p>
          {plan.injection_stats && (
            <p className="text-xs text-green-600 mt-1">{plan.injection_stats.postop_completed} completed</p>
          )}
        </div>
      </div>

      {/* Adjunct Therapy Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-indigo-50 rounded-lg p-4">
          <h4 className="font-medium text-indigo-900 mb-2 flex items-center gap-2">
            <Zap className="h-4 w-4" /> Silicone Sheet Therapy
          </h4>
          {plan.silicone_sheet_start_date ? (
            <>
              <p className="text-sm text-indigo-700">Starts: {format(new Date(plan.silicone_sheet_start_date), 'dd MMM yyyy')}</p>
              <p className="text-sm text-indigo-700">Duration: {plan.silicone_sheet_duration_months || 6} months</p>
            </>
          ) : (
            <p className="text-sm text-indigo-600">Not yet scheduled</p>
          )}
        </div>
        <div className="bg-teal-50 rounded-lg p-4">
          <h4 className="font-medium text-teal-900 mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4" /> Compression Therapy
          </h4>
          {plan.compression_therapy_start_date ? (
            <>
              <p className="text-sm text-teal-700">Starts: {format(new Date(plan.compression_therapy_start_date), 'dd MMM yyyy')}</p>
              <p className="text-sm text-teal-700">Duration: {plan.compression_therapy_duration_months || 6} months</p>
            </>
          ) : (
            <p className="text-sm text-teal-600">Not yet scheduled</p>
          )}
        </div>
      </div>

      {/* Radiotherapy indicator if applicable */}
      {plan.radiotherapy_indicated && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-500 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-900">Post-Operative Low-Dose Radiotherapy Indicated</p>
            <p className="text-sm text-red-700">
              Timing: {plan.radiotherapy_timing || 'Within 24-72 hours post-surgery'} | 
              Dose: {plan.radiotherapy_dose || 'Per protocol'} | 
              Fractions: {plan.radiotherapy_fractions || 'TBD'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

const TestsTab: React.FC<{ plan: KeloidCarePlan; onRefresh: () => void }> = ({ plan, onRefresh }) => {
  const [showAddTest, setShowAddTest] = useState(false);
  const tests = plan.pretreatment_tests || [];
  
  const isPregnancyTestRequired = keloidCareService.isPregnancyTestRequired(
    plan.gender || '',
    plan.date_of_birth || ''
  );

  const requiredTests = [
    ...REQUIRED_PRETREATMENT_TESTS,
    ...(isPregnancyTestRequired ? [PREGNANCY_TEST] : [])
  ];

  const addTest = async (testType: string, testName: string) => {
    try {
      await keloidCareService.addPretreatmentTest(plan.id, {
        test_type: testType,
        test_name: testName,
        ordered_date: new Date().toISOString().split('T')[0],
        result_status: 'pending'
      });
      onRefresh();
      setShowAddTest(false);
    } catch (error) {
      console.error('Error adding test:', error);
    }
  };

  const testStatus = keloidCareService.arePretreatmentTestsComplete(tests);

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className={`p-4 rounded-lg flex items-start gap-3 ${
        testStatus.complete ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
      }`}>
        {testStatus.complete ? (
          <>
            <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-green-900">All Pre-Treatment Tests Complete</h4>
              <p className="text-sm text-green-700">Patient is cleared for triamcinolone injections</p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-900">Pre-Treatment Tests Required</h4>
              <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                {testStatus.issues.map((issue, idx) => (
                  <li key={idx}>{issue}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>

      {/* Required Tests Info */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Required Pre-Triamcinolone Tests
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {requiredTests.map((test, idx) => {
            const ordered = tests.find(t => t.test_name === test.name);
            return (
              <div key={idx} className="bg-white rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{test.name}</p>
                  <p className="text-xs text-gray-500">{test.reason}</p>
                </div>
                {ordered ? (
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ordered.result_status === 'completed' && ordered.is_within_normal
                      ? 'bg-green-100 text-green-700'
                      : ordered.result_status === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {ordered.result_status === 'completed' 
                      ? (ordered.is_within_normal ? 'Normal' : 'Abnormal')
                      : 'Pending'}
                  </span>
                ) : (
                  <button
                    onClick={() => addTest(test.type, test.name)}
                    className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Order
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tests List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Ordered Tests</h3>
          <button
            onClick={() => setShowAddTest(true)}
            className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700"
          >
            <Plus className="h-4 w-4" />
            Add Custom Test
          </button>
        </div>

        {tests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No tests ordered yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tests.map(test => (
              <TestRow key={test.id} test={test} planId={plan.id} onUpdate={onRefresh} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TestRow: React.FC<{
  test: PretreatmentTest;
  planId: number;
  onUpdate: () => void;
}> = ({ test, planId, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [resultValue, setResultValue] = useState(test.result_value || '');
  const [isNormal, setIsNormal] = useState(test.is_within_normal ?? true);

  const saveResult = async () => {
    try {
      await keloidCareService.updateTestResult(planId, test.id, {
        result_date: new Date().toISOString().split('T')[0],
        result_value: resultValue,
        result_status: 'completed',
        is_within_normal: isNormal
      });
      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving result:', error);
    }
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-gray-900">{test.test_name}</p>
          <p className="text-sm text-gray-500">
            Ordered: {format(new Date(test.ordered_date), 'dd MMM yyyy')}
          </p>
        </div>
        {test.result_status === 'pending' ? (
          editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={resultValue}
                onChange={(e) => setResultValue(e.target.value)}
                placeholder="Enter result"
                className="px-3 py-1 border rounded text-sm w-32"
              />
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={isNormal}
                  onChange={(e) => setIsNormal(e.target.checked)}
                  className="rounded"
                />
                Normal
              </label>
              <button
                onClick={saveResult}
                className="p-1 text-green-600 hover:bg-green-100 rounded"
                title="Save result"
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-1 text-gray-500 hover:bg-gray-200 rounded"
                title="Cancel editing"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Enter Result
            </button>
          )
        ) : (
          <div className="text-right">
            <p className="font-medium">{test.result_value || 'N/A'}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              test.is_within_normal ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {test.is_within_normal ? 'Normal' : 'Abnormal'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const InjectionsTab: React.FC<{
  plan: KeloidCarePlan;
  onRecordInjection: (injection: KeloidInjection) => void;
}> = ({ plan, onRecordInjection }) => {
  const injections = plan.injections || [];
  const preopInjections = injections.filter(i => i.injection_phase === 'preop');
  const postopInjections = injections.filter(i => i.injection_phase === 'postop');

  const getInjectionStatus = (injection: KeloidInjection) => {
    if (injection.status === 'completed') return { color: 'green', label: 'Completed' };
    if (injection.status === 'missed') return { color: 'red', label: 'Missed' };
    
    const scheduledDate = new Date(injection.scheduled_date);
    const today = new Date();
    
    if (isBefore(scheduledDate, today)) {
      return { color: 'red', label: 'Overdue' };
    }
    if (differenceInDays(scheduledDate, today) <= 7) {
      return { color: 'yellow', label: 'Upcoming' };
    }
    return { color: 'gray', label: 'Scheduled' };
  };

  const renderInjectionList = (injections: KeloidInjection[], phase: string) => (
    <div className="space-y-3">
      {injections.length === 0 ? (
        <p className="text-gray-500 text-center py-4">No {phase} injections scheduled</p>
      ) : (
        injections.map(injection => {
          const status = getInjectionStatus(injection);
          return (
            <div
              key={injection.id}
              className={`bg-gray-50 rounded-lg p-4 border-l-4 ${
                status.color === 'green' ? 'border-green-500' :
                status.color === 'red' ? 'border-red-500' :
                status.color === 'yellow' ? 'border-yellow-500' :
                'border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    Injection #{injection.injection_number}
                  </p>
                  <p className="text-sm text-gray-500">
                    Scheduled: {format(new Date(injection.scheduled_date), 'dd MMM yyyy')}
                  </p>
                  {injection.actual_date && (
                    <p className="text-sm text-green-600">
                      Given: {format(new Date(injection.actual_date), 'dd MMM yyyy')}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    status.color === 'green' ? 'bg-green-100 text-green-700' :
                    status.color === 'red' ? 'bg-red-100 text-red-700' :
                    status.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {status.label}
                  </span>
                  {injection.status !== 'completed' && (
                    <button
                      onClick={() => onRecordInjection(injection)}
                      className="mt-2 block text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      Record Injection
                    </button>
                  )}
                </div>
              </div>
              {injection.dose_mg && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Dose:</span> {injection.dose_mg}mg ({injection.concentration})
                </div>
              )}
              {injection.response_notes && (
                <div className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">Response:</span> {injection.response_notes}
                </div>
              )}
              {injection.adverse_effects && (
                <div className="mt-2 text-sm text-red-600">
                  <span className="font-medium">Adverse Effects:</span> {injection.adverse_effects}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Pre-op Injections */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Syringe className="h-5 w-5 text-blue-600" />
            Pre-Operative Injections
          </h3>
          <span className="text-sm text-gray-500">
            {preopInjections.filter(i => i.status === 'completed').length} / {plan.preop_triamcinolone_count || 0} completed
          </span>
        </div>
        {renderInjectionList(preopInjections, 'pre-operative')}
      </div>

      {/* Post-op Injections */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Syringe className="h-5 w-5 text-green-600" />
            Post-Operative Injections
          </h3>
          <span className="text-sm text-gray-500">
            {postopInjections.filter(i => i.status === 'completed').length} / {plan.postop_triamcinolone_count || 0} completed
          </span>
        </div>
        {plan.surgery_planned ? (
          renderInjectionList(postopInjections, 'post-operative')
        ) : (
          <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Surgery not planned - post-operative injections will be scheduled after surgery</p>
          </div>
        )}
      </div>
    </div>
  );
};

const SurgeryTab: React.FC<{ plan: KeloidCarePlan }> = ({ plan }) => (
  <div className="space-y-6">
    {plan.surgery_planned ? (
      <>
        <div className="bg-purple-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">Surgery Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-purple-700">Scheduled Date</p>
              <p className="font-semibold text-purple-900">
                {plan.surgery_date ? format(new Date(plan.surgery_date), 'dd MMMM yyyy') : 'To be scheduled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-purple-700">Technique</p>
              <p className="font-semibold text-purple-900">{plan.surgery_technique || 'Not specified'}</p>
            </div>
          </div>
          {plan.surgery_notes && (
            <div className="mt-4">
              <p className="text-sm text-purple-700">Notes</p>
              <p className="text-purple-900">{plan.surgery_notes}</p>
            </div>
          )}
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Pre-Surgery Checklist
          </h4>
          <ul className="mt-2 space-y-2 text-sm text-yellow-800">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Complete all pre-operative triamcinolone injections
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Verify all pre-treatment tests are complete and normal
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Document informed consent
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Arrange post-operative follow-up
            </li>
            {plan.radiotherapy_indicated && (
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Coordinate with radiotherapy department (within 24-72 hours post-op)
              </li>
            )}
          </ul>
        </div>
      </>
    ) : (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <Heart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Surgery Not Planned</h3>
        <p className="text-gray-500">
          This treatment plan does not include surgical excision.
          Conservative management with steroid injections only.
        </p>
      </div>
    )}
  </div>
);

const AdjunctTherapyTab: React.FC<{ plan: KeloidCarePlan }> = ({ plan }) => (
  <div className="space-y-6">
    {/* Silicone Therapy */}
    <div className="bg-blue-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5" />
        Silicone Sheet/Gel Therapy
      </h3>
      {plan.silicone_sheet_start_date ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-blue-700">Start Date</p>
            <p className="font-semibold text-blue-900">
              {format(new Date(plan.silicone_sheet_start_date), 'dd MMMM yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-blue-700">Duration</p>
            <p className="font-semibold text-blue-900">
              {plan.silicone_sheet_duration_months || '?'} months
            </p>
          </div>
        </div>
      ) : (
        <p className="text-blue-700">Not yet scheduled</p>
      )}
      <div className="mt-4 p-3 bg-white rounded-lg text-sm text-blue-800">
        <p className="font-medium">Instructions for Patient:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Apply silicone sheet/gel directly over the scar</li>
          <li>Wear for 12-24 hours daily</li>
          <li>Clean and dry the area before each application</li>
          <li>Continue for at least 3-6 months for best results</li>
        </ul>
      </div>
    </div>

    {/* Compression Therapy */}
    <div className="bg-green-50 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5" />
        Compression Therapy
      </h3>
      {plan.compression_therapy_start_date ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-green-700">Start Date</p>
            <p className="font-semibold text-green-900">
              {format(new Date(plan.compression_therapy_start_date), 'dd MMMM yyyy')}
            </p>
          </div>
          <div>
            <p className="text-sm text-green-700">Duration</p>
            <p className="font-semibold text-green-900">
              {plan.compression_therapy_duration_months || '?'} months
            </p>
          </div>
        </div>
      ) : (
        <p className="text-green-700">Not yet scheduled</p>
      )}
      <div className="mt-4 p-3 bg-white rounded-lg text-sm text-green-800">
        <p className="font-medium">Instructions for Patient:</p>
        <ul className="list-disc list-inside mt-1 space-y-1">
          <li>Wear pressure earrings/garments as prescribed</li>
          <li>Maintain consistent pressure for 12-24 hours daily</li>
          <li>Remove only for cleaning and hygiene</li>
          <li>Report any discomfort or skin changes</li>
        </ul>
      </div>
    </div>
  </div>
);

const RadiotherapyTab: React.FC<{ plan: KeloidCarePlan }> = ({ plan }) => (
  <div className="space-y-6">
    {plan.radiotherapy_indicated ? (
      <>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-red-900">Low-Dose Radiotherapy Indicated</h4>
            <p className="text-sm text-red-700">
              This patient has been identified as requiring post-operative radiotherapy due to high recurrence risk.
            </p>
          </div>
        </div>

        {/* Indications */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Indications</h3>
          <div className="flex flex-wrap gap-2">
            {plan.radiotherapy_indications?.map((ind, idx) => (
              <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                {ind}
              </span>
            ))}
          </div>
        </div>

        {/* Timing & Dose */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Timing</p>
            <p className="font-semibold">{plan.radiotherapy_timing || 'Within 24-72 hours post-surgery'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Dose</p>
            <p className="font-semibold">{plan.radiotherapy_dose || 'As per oncology protocol'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">Fractions</p>
            <p className="font-semibold">{plan.radiotherapy_fractions || 'TBD'}</p>
          </div>
        </div>

        {/* Side Effects */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Potential Side Effects</h3>
          <div className="flex flex-wrap gap-2">
            {(plan.radiotherapy_side_effects?.length ? plan.radiotherapy_side_effects : RADIOTHERAPY_SIDE_EFFECTS).map((effect, idx) => (
              <span key={idx} className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                {effect}
              </span>
            ))}
          </div>
        </div>

        {/* Management */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Side Effect Management</h3>
          <div className="bg-blue-50 rounded-lg p-4">
            <pre className="text-sm text-blue-900 whitespace-pre-wrap font-sans">
              {plan.radiotherapy_management || RADIOTHERAPY_SIDE_EFFECT_MANAGEMENT}
            </pre>
          </div>
        </div>
      </>
    ) : (
      <div className="bg-green-50 rounded-lg p-8 text-center">
        <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Radiotherapy Not Required</h3>
        <p className="text-gray-500">
          This treatment plan does not include post-operative radiotherapy.
          Standard keloid treatment protocol will be followed.
        </p>
      </div>
    )}
  </div>
);

// ============================================
// PATIENT EDUCATION COMPONENT
// ============================================

interface PatientEducationProps {
  expandedSection: string | null;
  onToggleSection: (section: string) => void;
}

const PatientEducationContent: React.FC<PatientEducationProps> = ({
  expandedSection,
  onToggleSection
}) => {
  const sections = [
    { id: 'what', title: 'What is a Keloid?', content: KELOID_EDUCATION.whatIsKeloid, icon: Info },
    { id: 'risk', title: 'Risk Factors', content: KELOID_EDUCATION.riskFactors, icon: AlertTriangle },
    { id: 'treatment', title: 'Treatment Options', content: KELOID_EDUCATION.treatmentOptions, icon: Syringe },
    { id: 'multimodal', title: 'Why Multi-Modality Treatment?', content: KELOID_EDUCATION.multimodalityApproach, icon: Zap },
    { id: 'compliance', title: 'Importance of Compliance', content: KELOID_EDUCATION.compliance, icon: CheckCircle }
  ];

  const handleDownloadEducationPdf = () => {
    try {
      keloidPdfService.generatePatientEducationPdf();
      toast.success('Patient education PDF downloaded');
    } catch (error) {
      console.error('Error generating education PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-green-50 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-green-900 mb-2 flex items-center gap-2">
              <BookOpen className="h-6 w-6" />
              Patient Education Materials
            </h2>
            <p className="text-green-700">
              Comprehensive information about keloid management to share with your patients.
              Click on any section to expand and read or print the content.
            </p>
          </div>
          <button
            onClick={handleDownloadEducationPdf}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex-shrink-0"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Pre-Treatment Investigations Info Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 mb-6">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5" />
          Required Pre-Triamcinolone Injection Investigations
        </h3>
        <p className="text-sm text-amber-800 mb-3">
          Before commencing intralesional triamcinolone injection therapy, the following tests 
          are <strong>mandatory</strong> to ensure patient safety:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="font-medium text-gray-900">1. Full Blood Count (FBC)</p>
            <p className="text-xs text-gray-600">Establishes baseline hematological parameters. Detects underlying infections, anaemia, or blood dyscrasias.</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="font-medium text-gray-900">2. Mantoux Test (Tuberculin Skin Test)</p>
            <p className="text-xs text-gray-600">Screens for latent tuberculosis. Critical because corticosteroids can reactivate dormant TB infection.</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-amber-100">
            <p className="font-medium text-gray-900">3. Fasting Blood Sugar (FBS)</p>
            <p className="text-xs text-gray-600">Screens for diabetes mellitus. Triamcinolone can cause hyperglycemia and worsen glycemic control.</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-red-100">
            <p className="font-medium text-red-800">4. Pregnancy Test (urine β-hCG)</p>
            <p className="text-xs text-red-700">
              <strong>For females of reproductive age (12-50 years).</strong> 
              Triamcinolone is a Category D drug — teratogenic risk. Must be negative before treatment.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {sections.map(section => (
          <div key={section.id} className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <button
              onClick={() => onToggleSection(section.id)}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <section.icon className="h-5 w-5 text-green-600" />
                </div>
                <span className="font-medium text-gray-900">{section.title}</span>
              </div>
              {expandedSection === section.id ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </button>
            {expandedSection === section.id && (
              <div className="px-6 pb-6 border-t">
                <pre className="mt-4 text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {section.content}
                </pre>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>${section.title}</title>
                              <style>
                                body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
                                h1 { color: #0E9F6E; }
                                pre { white-space: pre-wrap; font-family: Arial, sans-serif; }
                              </style>
                            </head>
                            <body>
                              <h1>${section.title}</h1>
                              <pre>${section.content}</pre>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`${section.title}\n${'='.repeat(section.title.length)}\n${section.content}`);
                        toast.success('Copied to clipboard');
                      } catch {
                        toast.error('Failed to copy');
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <Share2 className="h-4 w-4" />
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// CREATE PLAN MODAL
// ============================================

interface CreatePlanModalProps {
  patients: Patient[];
  initialPatientId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

const CreatePlanModal: React.FC<CreatePlanModalProps> = ({ patients, initialPatientId, onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  
  const [formData, setFormData] = useState({
    patient_id: initialPatientId ?? 0,
    clinical_summary: '',
    keloid_locations: [] as string[],
    problems_concerns: [] as string[],
    comorbidities: [] as string[],
    has_no_comorbidities: false,
    risk_factors: [] as string[],
    preop_triamcinolone_count: 4,
    preop_injection_interval_weeks: 3,
    surgery_planned: false,
    surgery_date: '',
    surgery_technique: '',
    surgery_notes: '',
    postop_triamcinolone_count: 4,
    postop_injection_interval_weeks: 3,
    silicone_sheet_start_date: '',
    silicone_sheet_duration_months: 6,
    compression_therapy_start_date: '',
    compression_therapy_duration_months: 6,
    radiotherapy_indicated: false,
    radiotherapy_indications: [] as string[],
    radiotherapy_timing: 'Within 24-72 hours post-surgery',
    radiotherapy_dose: '',
    radiotherapy_fractions: 3,
    radiotherapy_side_effects: RADIOTHERAPY_SIDE_EFFECTS,
    radiotherapy_management: RADIOTHERAPY_SIDE_EFFECT_MANAGEMENT
  });

  const selectedPatient = patients.find(p => p.id === formData.patient_id);
  
  const filteredPatients = patients.filter(p => {
    const search = patientSearch.toLowerCase();
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search) ||
      p.hospital_number.toLowerCase().includes(search)
    );
  });

  const handleSubmit = async () => {
    if (!formData.patient_id || !formData.clinical_summary) {
      toast.error('Please complete all required fields');
      return;
    }

    setLoading(true);
    try {
      await keloidCareService.createPlan(formData);
      onSuccess();
    } catch (error) {
      console.error('Error creating plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayItem = (array: string[], item: string): string[] => {
    return array.includes(item)
      ? array.filter(i => i !== item)
      : [...array, item];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-green-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create Keloid Care Plan</h2>
            <p className="text-sm text-gray-500">Step {step} of 5</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-gray-200">
          <div
            className="h-full bg-green-600 transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Patient Selection & Clinical Summary */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Patient *
                </label>
                <input
                  type="text"
                  placeholder="Search by name or hospital number..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 mb-2"
                />
                <div className="max-h-40 overflow-y-auto border rounded-lg">
                  {filteredPatients.slice(0, 10).map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => setFormData({ ...formData, patient_id: patient.id })}
                      className={`w-full p-3 text-left hover:bg-gray-50 flex items-center justify-between ${
                        formData.patient_id === patient.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                      }`}
                    >
                      <div>
                        <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                        <p className="text-sm text-gray-500">{patient.hospital_number}</p>
                      </div>
                      {formData.patient_id === patient.id && (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clinical Summary *
                </label>
                <textarea
                  value={formData.clinical_summary}
                  onChange={(e) => setFormData({ ...formData, clinical_summary: e.target.value })}
                  rows={4}
                  placeholder="Brief clinical history, examination findings, keloid characteristics..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Keloid Location(s)
                </label>
                <div className="flex flex-wrap gap-2">
                  {KELOID_LOCATIONS.map(loc => (
                    <button
                      key={loc}
                      onClick={() => setFormData({
                        ...formData,
                        keloid_locations: toggleArrayItem(formData.keloid_locations, loc)
                      })}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.keloid_locations.includes(loc)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Problems & Risk Factors */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Identified Problems & Concerns
                </label>
                <div className="flex flex-wrap gap-2">
                  {PROBLEMS_CONCERNS.map(concern => (
                    <button
                      key={concern}
                      onClick={() => setFormData({
                        ...formData,
                        problems_concerns: toggleArrayItem(formData.problems_concerns, concern)
                      })}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.problems_concerns.includes(concern)
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {concern}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Comorbidities</label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.has_no_comorbidities}
                      onChange={(e) => setFormData({
                        ...formData,
                        has_no_comorbidities: e.target.checked,
                        comorbidities: e.target.checked ? [] : formData.comorbidities
                      })}
                      className="rounded"
                    />
                    No comorbidities
                  </label>
                </div>
                {!formData.has_no_comorbidities && (
                  <div className="flex flex-wrap gap-2">
                    {COMMON_COMORBIDITIES.map(condition => (
                      <button
                        key={condition}
                        onClick={() => setFormData({
                          ...formData,
                          comorbidities: toggleArrayItem(formData.comorbidities, condition)
                        })}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          formData.comorbidities.includes(condition)
                            ? 'bg-yellow-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {condition}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Risk Factors
                </label>
                <div className="flex flex-wrap gap-2">
                  {RISK_FACTORS.map(factor => (
                    <button
                      key={factor}
                      onClick={() => setFormData({
                        ...formData,
                        risk_factors: toggleArrayItem(formData.risk_factors, factor)
                      })}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        formData.risk_factors.includes(factor)
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {factor}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Treatment Planning - Injections & Surgery */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Pre-op Injections */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <Syringe className="h-5 w-5" />
                  Pre-Operative Triamcinolone Injections
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-blue-700 mb-1">Number of Sessions</label>
                    <input
                      type="number"
                      min="0"
                      max="12"
                      value={formData.preop_triamcinolone_count}
                      onChange={(e) => setFormData({ ...formData, preop_triamcinolone_count: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg"
                      title="Number of sessions"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-blue-700 mb-1">Interval (weeks)</label>
                    <input
                      type="number"
                      min="2"
                      max="6"
                      value={formData.preop_injection_interval_weeks}
                      onChange={(e) => setFormData({ ...formData, preop_injection_interval_weeks: parseInt(e.target.value) || 3 })}
                      className="w-full px-3 py-2 border rounded-lg"
                      title="Injection interval in weeks"
                    />
                  </div>
                </div>
              </div>

              {/* Surgery */}
              <div className="bg-purple-50 rounded-lg p-4">
                <label className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={formData.surgery_planned}
                    onChange={(e) => setFormData({ ...formData, surgery_planned: e.target.checked })}
                    className="rounded h-5 w-5"
                  />
                  <span className="font-semibold text-purple-900">Surgery Planned</span>
                </label>

                {formData.surgery_planned && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm text-purple-700 mb-1">Surgery Date</label>
                        <input
                          type="date"
                          value={formData.surgery_date}
                          onChange={(e) => setFormData({ ...formData, surgery_date: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          title="Surgery date"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-purple-700 mb-1">Technique</label>
                        <select
                          value={formData.surgery_technique}
                          onChange={(e) => setFormData({ ...formData, surgery_technique: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          title="Surgery technique"
                        >
                          <option value="">Select technique...</option>
                          {SURGERY_TECHNIQUES.map(tech => (
                            <option key={tech} value={tech}>{tech}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm text-purple-700 mb-1">Surgery Notes</label>
                      <textarea
                        value={formData.surgery_notes}
                        onChange={(e) => setFormData({ ...formData, surgery_notes: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border rounded-lg"
                        placeholder="Additional surgical planning notes..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Post-op Injections */}
              {formData.surgery_planned && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                    <Syringe className="h-5 w-5" />
                    Post-Operative Triamcinolone Injections
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-green-700 mb-1">Number of Sessions</label>
                      <input
                        type="number"
                        min="0"
                        max="12"
                        value={formData.postop_triamcinolone_count}
                        onChange={(e) => setFormData({ ...formData, postop_triamcinolone_count: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border rounded-lg"
                        title="Number of post-op sessions"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-green-700 mb-1">Interval (weeks)</label>
                      <input
                        type="number"
                        min="2"
                        max="6"
                        value={formData.postop_injection_interval_weeks}
                        onChange={(e) => setFormData({ ...formData, postop_injection_interval_weeks: parseInt(e.target.value) || 3 })}
                        className="w-full px-3 py-2 border rounded-lg"
                        title="Post-op injection interval in weeks"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Adjunct Therapy */}
          {step === 4 && (
            <div className="space-y-6">
              {/* Silicone Therapy */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-4">Silicone Sheet/Gel Therapy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-blue-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.silicone_sheet_start_date}
                      onChange={(e) => setFormData({ ...formData, silicone_sheet_start_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      title="Silicone sheet start date"
                    />
                    <p className="text-xs text-blue-600 mt-1">Usually 2-3 weeks post-surgery</p>
                  </div>
                  <div>
                    <label className="block text-sm text-blue-700 mb-1">Duration (months)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.silicone_sheet_duration_months}
                      onChange={(e) => setFormData({ ...formData, silicone_sheet_duration_months: parseInt(e.target.value) || 6 })}
                      className="w-full px-3 py-2 border rounded-lg"
                      title="Silicone sheet duration in months"
                    />
                  </div>
                </div>
              </div>

              {/* Compression Therapy */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-4">Compression Therapy</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-green-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.compression_therapy_start_date}
                      onChange={(e) => setFormData({ ...formData, compression_therapy_start_date: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      title="Compression therapy start date"
                    />
                    <p className="text-xs text-green-600 mt-1">Usually after wound healing (~2 weeks)</p>
                  </div>
                  <div>
                    <label className="block text-sm text-green-700 mb-1">Duration (months)</label>
                    <input
                      type="number"
                      min="1"
                      max="24"
                      value={formData.compression_therapy_duration_months}
                      onChange={(e) => setFormData({ ...formData, compression_therapy_duration_months: parseInt(e.target.value) || 6 })}
                      className="w-full px-3 py-2 border rounded-lg"
                      title="Compression therapy duration in months"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Radiotherapy */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="bg-red-50 rounded-lg p-4">
                <label className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={formData.radiotherapy_indicated}
                    onChange={(e) => setFormData({ ...formData, radiotherapy_indicated: e.target.checked })}
                    className="rounded h-5 w-5"
                  />
                  <span className="font-semibold text-red-900">Post-Operative Radiotherapy Indicated</span>
                </label>

                {formData.radiotherapy_indicated && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-red-700 mb-2">Indications</label>
                      <div className="flex flex-wrap gap-2">
                        {RADIOTHERAPY_INDICATIONS.map(ind => (
                          <button
                            key={ind}
                            onClick={() => setFormData({
                              ...formData,
                              radiotherapy_indications: toggleArrayItem(formData.radiotherapy_indications, ind)
                            })}
                            className={`px-3 py-1 rounded-full text-sm transition-colors ${
                              formData.radiotherapy_indications.includes(ind)
                                ? 'bg-red-600 text-white'
                                : 'bg-white text-red-700 border border-red-300 hover:bg-red-100'
                            }`}
                          >
                            {ind}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm text-red-700 mb-1">Timing</label>
                        <input
                          type="text"
                          value={formData.radiotherapy_timing}
                          onChange={(e) => setFormData({ ...formData, radiotherapy_timing: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          title="Radiotherapy timing"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-red-700 mb-1">Dose</label>
                        <input
                          type="text"
                          value={formData.radiotherapy_dose}
                          onChange={(e) => setFormData({ ...formData, radiotherapy_dose: e.target.value })}
                          placeholder="e.g., 12 Gy"
                          className="w-full px-3 py-2 border rounded-lg"
                          title="Radiotherapy dose"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-red-700 mb-1">Fractions</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={formData.radiotherapy_fractions}
                          onChange={(e) => setFormData({ ...formData, radiotherapy_fractions: parseInt(e.target.value) || 3 })}
                          className="w-full px-3 py-2 border rounded-lg"
                          title="Radiotherapy fractions"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Plan Summary</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Patient:</p>
                    <p className="font-medium">{selectedPatient ? `${selectedPatient.first_name} ${selectedPatient.last_name}` : 'Not selected'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Pre-Op Injections:</p>
                    <p className="font-medium">{formData.preop_triamcinolone_count} sessions</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Surgery:</p>
                    <p className="font-medium">{formData.surgery_planned ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Post-Op Injections:</p>
                    <p className="font-medium">{formData.postop_triamcinolone_count} sessions</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Radiotherapy:</p>
                    <p className="font-medium">{formData.radiotherapy_indicated ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            {step === 1 ? 'Cancel' : 'Previous'}
          </button>
          <div className="flex gap-2">
            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && (!formData.patient_id || !formData.clinical_summary)}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Create Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// RECORD INJECTION MODAL
// ============================================

interface RecordInjectionModalProps {
  injection: KeloidInjection;
  onClose: () => void;
  onSubmit: (data: Partial<KeloidInjection>) => void;
}

const RecordInjectionModal: React.FC<RecordInjectionModalProps> = ({
  injection,
  onClose,
  onSubmit
}) => {
  const [formData, setFormData] = useState({
    actual_date: format(new Date(), 'yyyy-MM-dd'),
    dose_mg: 40,
    concentration: '40mg/ml',
    volume_ml: 1,
    injection_site: '',
    response_notes: '',
    adverse_effects: ''
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Record Injection</h2>
            <p className="text-sm text-gray-500">
              {injection.injection_phase === 'preop' ? 'Pre-Operative' : 'Post-Operative'} Injection #{injection.injection_number}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Given</label>
              <input
                type="date"
                value={formData.actual_date}
                onChange={(e) => setFormData({ ...formData, actual_date: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                title="Date injection was given"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dose (mg)</label>
              <input
                type="number"
                value={formData.dose_mg}
                onChange={(e) => setFormData({ ...formData, dose_mg: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                title="Injection dose in mg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Concentration</label>
              <select
                value={formData.concentration}
                onChange={(e) => setFormData({ ...formData, concentration: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                title="Drug concentration"
              >
                <option value="10mg/ml">10mg/ml</option>
                <option value="40mg/ml">40mg/ml</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Volume (ml)</label>
              <input
                type="number"
                step="0.1"
                value={formData.volume_ml}
                onChange={(e) => setFormData({ ...formData, volume_ml: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                title="Injection volume in ml"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Injection Site</label>
            <input
              type="text"
              value={formData.injection_site}
              onChange={(e) => setFormData({ ...formData, injection_site: e.target.value })}
              placeholder="e.g., Central portion of keloid"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Response Notes</label>
            <textarea
              value={formData.response_notes}
              onChange={(e) => setFormData({ ...formData, response_notes: e.target.value })}
              rows={2}
              placeholder="Patient tolerance, observed changes..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adverse Effects (if any)</label>
            <textarea
              value={formData.adverse_effects}
              onChange={(e) => setFormData({ ...formData, adverse_effects: e.target.value })}
              rows={2}
              placeholder="Pain, skin atrophy, hypopigmentation..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(formData)}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Record Injection
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeloidCarePage;
