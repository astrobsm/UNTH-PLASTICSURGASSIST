import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { db } from '../db/database';
import {
  substanceDefinitions,
  calculatePhysicalDependenceScore,
  calculatePsychologicalDependenceScore,
  calculateBehavioralDysfunctionScore,
  calculateSocialImpairmentScore,
  calculateMedicalComplicationsScore,
  calculateAddictionSeverityScore,
  predictWithdrawalRisk,
  generatePainManagementSupport,
  determineCareSettingRecommendation,
  getComorbidityModifications,
} from '../services/substanceUseService';
import type {
  SubstanceUseAssessment,
  SubstanceIntake,
  SubstanceCategory,
  AddictionSeverityScore,
  WithdrawalRiskPrediction,
  CareSettingDecision,
  PainManagementSupport,
  ComorbidityModification,
  DetoxMonitoringRecord,
  DetoxFollowUp,
  PainContextAssessment,
  AssessmentStatus,
} from '../db/substanceUseTypes';
import {
  AlertTriangle,
  Plus,
  ChevronRight,
  ChevronLeft,
  Save,
  FileText,
  Activity,
  ClipboardCheck,
  Calendar,
  Trash2,
  Eye,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Heart,
  Brain,
  Shield,
  Pill,
} from 'lucide-react';

// ============ CONSTANTS ============

const SUBSTANCE_OPTIONS = Object.entries(substanceDefinitions).map(([key, def]) => ({
  value: key,
  label: `${def.name} (${def.commonNames.join(', ')})`,
  category: def.category,
}));

const ROUTE_OPTIONS = [
  'oral', 'intravenous', 'intramuscular', 'inhalation', 'sublingual', 'topical', 'rectal', 'other'
] as const;

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'multiple_daily', label: 'Multiple times daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'occasional', label: 'Occasional' },
  { value: 'binge', label: 'Binge pattern' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  initial_assessment: 'bg-blue-100 text-blue-800',
  in_detox: 'bg-yellow-100 text-yellow-800',
  monitoring: 'bg-purple-100 text-purple-800',
  detox_completed: 'bg-green-100 text-green-800',
  discharged: 'bg-gray-100 text-gray-800',
  relapsed: 'bg-red-100 text-red-800',
  abandoned: 'bg-red-200 text-red-900',
};

// ============ HELPERS ============

function generateId() {
  return `sua_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function ScoreBar({ label, score, max, color = 'green' }: { label: string; score: number; max: number; color?: string }) {
  const pct = Math.round((score / max) * 100);
  const clr = color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-yellow-500' : color === 'blue' ? 'bg-blue-500' : 'bg-green-600';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="font-medium">{score}/{max}</span></div>
      <div className="w-full bg-gray-200 rounded-full h-2"><div className={`${clr} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Badge({ text, className = '' }: { text: string; className?: string }) {
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>{text}</span>;
}

function SliderInput({ label, value, onChange, min = 0, max = 4 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}: <span className="font-bold text-green-700">{value}</span>/{max}</label>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-green-600" title={label} />
    </div>
  );
}

// ============ MAIN COMPONENT ============

export default function SubstanceDetoxPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'list' | 'new' | 'view'>('list');
  const [assessments, setAssessments] = useState<SubstanceUseAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<SubstanceUseAssessment | null>(null);
  const [loading, setLoading] = useState(false);

  // Load assessments
  const loadAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const items = await db.substance_use_assessments.toArray();
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssessments(items);
    } catch (err) {
      console.error('Error loading assessments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAssessments(); }, [loadAssessments]);

  const viewAssessment = (a: SubstanceUseAssessment) => {
    setSelectedAssessment(a);
    setActiveTab('view');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Substance Detoxification Module</h1>
        <p className="text-sm text-gray-500 mt-1">CSUD-DSM • Decision Support Only — Final responsibility rests with the licensed clinician</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
        {activeTab === 'view' && (
          <button onClick={() => { setActiveTab('list'); setSelectedAssessment(null); }} className="flex items-center px-3 py-2 text-sm rounded-md bg-white shadow text-gray-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </button>
        )}
        <button onClick={() => setActiveTab('list')} className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'list' ? 'bg-white shadow text-green-700' : 'text-gray-600 hover:bg-white/50'}`}>
          <ClipboardCheck className="w-4 h-4 inline mr-1" /> Assessments
        </button>
        <button onClick={() => setActiveTab('new')} className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition ${activeTab === 'new' ? 'bg-white shadow text-green-700' : 'text-gray-600 hover:bg-white/50'}`}>
          <Plus className="w-4 h-4 inline mr-1" /> New Assessment
        </button>
      </div>

      {/* Content */}
      {activeTab === 'list' && <AssessmentList assessments={assessments} loading={loading} onView={viewAssessment} onRefresh={loadAssessments} />}
      {activeTab === 'new' && <NewAssessmentWizard user={user} onComplete={() => { loadAssessments(); setActiveTab('list'); }} />}
      {activeTab === 'view' && selectedAssessment && <AssessmentDetail assessment={selectedAssessment} user={user} onUpdate={loadAssessments} />}
    </div>
  );
}

// ============ ASSESSMENT LIST ============

function AssessmentList({ assessments, loading, onView, onRefresh }: {
  assessments: SubstanceUseAssessment[];
  loading: boolean;
  onView: (a: SubstanceUseAssessment) => void;
  onRefresh: () => void;
}) {
  const deleteAssessment = async (id: string) => {
    if (!confirm('Delete this assessment?')) return;
    try {
      const rec = await db.substance_use_assessments.where('id').equals(id).first();
      if (rec) {
        await db.substance_use_assessments.delete((rec as any).local_id ?? rec.id);
      }
      onRefresh();
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="text-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto" /></div>;

  if (assessments.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border">
        <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No substance assessments yet</p>
        <p className="text-sm text-gray-400 mt-1">Click "New Assessment" to begin</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {assessments.map(a => (
        <div key={a.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition cursor-pointer" onClick={() => onView(a)}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{a.patientName || 'Unknown Patient'}</h3>
                <Badge text={a.status.replace(/_/g, ' ')} className={STATUS_COLORS[a.status] || 'bg-gray-100 text-gray-800'} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {a.hospitalNumber && `#${a.hospitalNumber} • `}
                Primary: <span className="font-medium">{a.primarySubstance}</span>
                {a.polySubstanceUse && ' • Poly-substance'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Assessed {new Date(a.assessmentDate || a.createdAt).toLocaleDateString()} by {a.assessedBy}
                {a.addictionSeverityScore && ` • Severity: ${a.addictionSeverityScore.severityLevel} (${a.addictionSeverityScore.totalCompositeScore}/88)`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); deleteAssessment(a.id); }} title="Delete assessment" className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
              <Eye className="w-5 h-5 text-gray-400" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============ NEW ASSESSMENT WIZARD ============

interface WizardState {
  step: number;
  patientId: string;
  patientName: string;
  hospitalNumber: string;
  substances: SubstanceIntake[];
  // Scoring inputs
  physTolerance: number; physWithdrawal: number; physCompulsive: number; physCraving: number;
  psychEmotional: number; psychCoping: number; psychPreoccupation: number; psychAnxiety: number;
  behPrioritizing: number; behFailed: number; behTime: number; behGivingUp: number;
  socOccupation: number; socRelationship: number; socFinancial: number; socLegal: number;
  medLiver: number; medRenal: number; medCardiac: number; medNeuro: number; medInfection: number; medPsych: number;
  // Risk factors
  patientAge: number;
  renalFunction: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  hepaticFunction: 'normal' | 'mild_impairment' | 'moderate_impairment' | 'severe_impairment';
  comorbidities: string[];
  comorbidityInput: string;
  // Social
  familySupportLevel: 'strong' | 'moderate' | 'minimal' | 'none';
  employmentStatus: string;
  housingStability: 'stable' | 'unstable' | 'homeless';
  financialConcerns: boolean;
  legalIssues: boolean;
  medicalStability: 'stable' | 'mildly_unstable' | 'unstable' | 'critical';
  psychiatricConcerns: boolean;
  previousDetoxAttempts: number;
  previousTreatmentHistory: string;
  // Pain
  includePainAssessment: boolean;
  painType: 'nociceptive' | 'neuropathic' | 'mixed' | 'functional';
  painScore: number;
  painCause: string;
  functionalImpact: 'minimal' | 'moderate' | 'severe';
  currentAnalgesics: string;
  hasSickleCellDisease: boolean;
  consentObtained: boolean;
}

const initialWizard: WizardState = {
  step: 0, patientId: '', patientName: '', hospitalNumber: '',
  substances: [],
  physTolerance: 0, physWithdrawal: 0, physCompulsive: 0, physCraving: 0,
  psychEmotional: 0, psychCoping: 0, psychPreoccupation: 0, psychAnxiety: 0,
  behPrioritizing: 0, behFailed: 0, behTime: 0, behGivingUp: 0,
  socOccupation: 0, socRelationship: 0, socFinancial: 0, socLegal: 0,
  medLiver: 0, medRenal: 0, medCardiac: 0, medNeuro: 0, medInfection: 0, medPsych: 0,
  patientAge: 30, renalFunction: 'normal', hepaticFunction: 'normal',
  comorbidities: [], comorbidityInput: '',
  familySupportLevel: 'moderate', employmentStatus: '', housingStability: 'stable',
  financialConcerns: false, legalIssues: false,
  medicalStability: 'stable', psychiatricConcerns: false,
  previousDetoxAttempts: 0, previousTreatmentHistory: '',
  includePainAssessment: false, painType: 'nociceptive', painScore: 0, painCause: '',
  functionalImpact: 'minimal', currentAnalgesics: '', hasSickleCellDisease: false,
  consentObtained: false,
};

const WIZARD_STEPS = ['Patient Info', 'Substances', 'Scoring', 'Risk Factors', 'Social & History', 'Review & Save'];

function NewAssessmentWizard({ user, onComplete }: { user: any; onComplete: () => void }) {
  const [w, setW] = useState<WizardState>({ ...initialWizard });
  const [saving, setSaving] = useState(false);
  const [computed, setComputed] = useState<{
    severity: AddictionSeverityScore | null;
    withdrawal: WithdrawalRiskPrediction | null;
    careSetting: CareSettingDecision | null;
    pain: PainManagementSupport | null;
    comorbMods: ComorbidityModification[];
  }>({ severity: null, withdrawal: null, careSetting: null, pain: null, comorbMods: [] });

  const up = (partial: Partial<WizardState>) => setW(prev => ({ ...prev, ...partial }));

  // Patient search helpers
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const all = await db.patients.toArray();
        setPatients(all);
      } catch { /* offline-safe */ }
    })();
  }, []);

  const filteredPatients = patientSearch.trim().length >= 2
    ? patients.filter(p => {
        const s = patientSearch.toLowerCase();
        return (p.first_name?.toLowerCase().includes(s) || p.last_name?.toLowerCase().includes(s) || p.hospital_number?.toLowerCase().includes(s));
      }).slice(0, 10)
    : [];

  // Compute all scores when moving to review step
  useEffect(() => {
    if (w.step === WIZARD_STEPS.length - 1) {
      const physical = calculatePhysicalDependenceScore(w.physTolerance, w.physWithdrawal, w.physCompulsive, w.physCraving);
      const psychological = calculatePsychologicalDependenceScore(w.psychEmotional, w.psychCoping, w.psychPreoccupation, w.psychAnxiety);
      const behavioral = calculateBehavioralDysfunctionScore(w.behPrioritizing, w.behFailed, w.behTime, w.behGivingUp);
      const social = calculateSocialImpairmentScore(w.socOccupation, w.socRelationship, w.socFinancial, w.socLegal);
      const medical = calculateMedicalComplicationsScore(w.medLiver, w.medRenal, w.medCardiac, w.medNeuro, w.medInfection, w.medPsych);
      const severity = calculateAddictionSeverityScore(physical, psychological, behavioral, social, medical);

      const withdrawal = w.substances.length > 0
        ? predictWithdrawalRisk(w.substances, w.patientAge, w.renalFunction, w.hepaticFunction, w.comorbidities)
        : null;

      const careSetting = withdrawal
        ? determineCareSettingRecommendation(severity, withdrawal, w.substances, w.familySupportLevel, w.medicalStability, w.psychiatricConcerns)
        : null;

      const comorbMods = getComorbidityModifications(w.comorbidities);

      let pain: PainManagementSupport | null = null;
      if (w.includePainAssessment) {
        const ctx: PainContextAssessment = {
          painType: w.painType, painCause: w.painCause, currentPainScore: w.painScore,
          functionalImpact: w.functionalImpact,
          currentAnalgesics: w.currentAnalgesics.split(',').map(s => s.trim()).filter(Boolean),
          hasSickleCellDisease: w.hasSickleCellDisease,
        };
        pain = generatePainManagementSupport(ctx, w.substances, w.comorbidities);
      }

      setComputed({ severity, withdrawal, careSetting, pain, comorbMods });
    }
  }, [w.step]);

  // Add substance
  const addSubstance = () => {
    up({
      substances: [...w.substances, {
        substanceName: '', substanceCategory: 'opioids' as SubstanceCategory,
        routeOfAdministration: 'oral', frequencyOfUse: 'daily', durationOfUseMonths: 1,
        lastUseDateTime: new Date().toISOString().slice(0, 16), quantityPerUse: '',
        escalationPattern: 'stable', isPrimaryConcern: w.substances.length === 0,
      }]
    });
  };

  const updateSubstance = (idx: number, partial: Partial<SubstanceIntake>) => {
    const updated = [...w.substances];
    updated[idx] = { ...updated[idx], ...partial };
    // Auto-fill category from definitions
    if (partial.substanceName) {
      const def = substanceDefinitions[partial.substanceName];
      if (def) updated[idx].substanceCategory = def.category;
    }
    up({ substances: updated });
  };

  const removeSubstance = (idx: number) => {
    up({ substances: w.substances.filter((_, i) => i !== idx) });
  };

  // Save
  const saveAssessment = async () => {
    if (!computed.severity || !w.consentObtained) return;
    setSaving(true);
    try {
      const now = new Date();
      const primarySub = w.substances.find(s => s.isPrimaryConcern) || w.substances[0];
      const assessment: SubstanceUseAssessment = {
        id: generateId(),
        patientId: w.patientId,
        patientName: w.patientName,
        hospitalNumber: w.hospitalNumber,
        assessmentDate: now.toISOString(),
        assessedBy: user?.username || user?.name || 'Unknown',
        status: 'initial_assessment',
        primarySubstance: primarySub?.substanceName || 'Unknown',
        substances: w.substances,
        polySubstanceUse: w.substances.length > 1,
        addictionSeverityScore: computed.severity!,
        withdrawalRiskPrediction: computed.withdrawal!,
        careSettingDecision: computed.careSetting!,
        painManagementSupport: computed.pain || undefined,
        comorbidities: w.comorbidities,
        comorbidityModifications: computed.comorbMods,
        socialFactors: {
          familySupportLevel: w.familySupportLevel,
          employmentStatus: w.employmentStatus,
          housingStability: w.housingStability,
          financialConcerns: w.financialConcerns,
          legalIssues: w.legalIssues,
        },
        previousDetoxAttempts: w.previousDetoxAttempts,
        previousTreatmentHistory: w.previousTreatmentHistory,
        consentObtained: w.consentObtained,
        auditLog: [{ action: 'assessment_created', performedBy: user?.username || 'Unknown', performedAt: now, details: 'Initial assessment created' }],
        createdAt: now,
        updatedAt: now,
        synced: false,
      };

      await db.substance_use_assessments.add(assessment as any);

      // Queue for sync
      try {
        await (db as any).sync_queue.add({ table: 'substance_use_assessments', action: 'create', data: assessment, local_id: assessment.id, created_at: now });
      } catch { /* offline-safe */ }

      onComplete();
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving assessment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    switch (w.step) {
      case 0: return w.patientName.trim().length > 0;
      case 1: return w.substances.length > 0 && w.substances.every(s => s.substanceName);
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return w.consentObtained;
      default: return true;
    }
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      {/* Step indicator */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between mb-6">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${i < w.step ? 'bg-green-600 text-white' : i === w.step ? 'bg-green-100 text-green-700 ring-2 ring-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {i < w.step ? <CheckCircle className="w-5 h-5" /> : i + 1}
              </div>
              {i < WIZARD_STEPS.length - 1 && <div className={`w-8 h-0.5 mx-1 ${i < w.step ? 'bg-green-600' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Step {w.step + 1}: {WIZARD_STEPS[w.step]}</h2>
      </div>

      <div className="p-6 pt-4">
        {/* Step 0: Patient Info */}
        {w.step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Patient</label>
              <input type="text" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Search by name or hospital number..." className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              {filteredPatients.length > 0 && (
                <div className="mt-1 border rounded-lg max-h-40 overflow-y-auto bg-white shadow">
                  {filteredPatients.map(p => (
                    <button key={p.id || p.local_id} onClick={() => { up({ patientId: p.id || String(p.local_id), patientName: `${p.first_name} ${p.last_name}`, hospitalNumber: p.hospital_number || '' }); setPatientSearch(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b last:border-b-0">
                      {p.first_name} {p.last_name} {p.hospital_number && `(#${p.hospital_number})`}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
                <input value={w.patientName} onChange={e => up({ patientName: e.target.value })} title="Patient Name" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Number</label>
                <input value={w.hospitalNumber} onChange={e => up({ hospitalNumber: e.target.value })} title="Hospital Number" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500" />
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Substances */}
        {w.step === 1 && (
          <div className="space-y-4">
            {w.substances.map((sub, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Substance #{idx + 1}</h4>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={sub.isPrimaryConcern} onChange={e => updateSubstance(idx, { isPrimaryConcern: e.target.checked })} className="rounded border-gray-300 text-green-600" />
                      Primary
                    </label>
                    <button onClick={() => removeSubstance(idx)} title="Remove substance" className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Substance *</label>
                    <select value={sub.substanceName} onChange={e => updateSubstance(idx, { substanceName: e.target.value })} title="Substance" className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="">Select...</option>
                      {SUBSTANCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Route</label>
                    <select value={sub.routeOfAdministration} onChange={e => updateSubstance(idx, { routeOfAdministration: e.target.value as any })} title="Route of Administration" className="w-full border rounded px-2 py-1.5 text-sm">
                      {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                    <select value={sub.frequencyOfUse} onChange={e => updateSubstance(idx, { frequencyOfUse: e.target.value as any })} title="Frequency of Use" className="w-full border rounded px-2 py-1.5 text-sm">
                      {FREQUENCY_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duration (months)</label>
                    <input type="number" min={0} value={sub.durationOfUseMonths} onChange={e => updateSubstance(idx, { durationOfUseMonths: Number(e.target.value) })} title="Duration in months" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Last Use</label>
                    <input type="datetime-local" value={sub.lastUseDateTime} onChange={e => updateSubstance(idx, { lastUseDateTime: e.target.value })} title="Last Use Date/Time" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Quantity/Use</label>
                    <input value={sub.quantityPerUse} onChange={e => updateSubstance(idx, { quantityPerUse: e.target.value })} placeholder="e.g. 2 tablets" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Escalation</label>
                    <select value={sub.escalationPattern} onChange={e => updateSubstance(idx, { escalationPattern: e.target.value as any })} title="Escalation Pattern" className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="stable">Stable</option>
                      <option value="increasing">Increasing</option>
                      <option value="decreasing">Decreasing</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addSubstance} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-green-400 hover:text-green-600 transition flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Add Substance
            </button>
          </div>
        )}

        {/* Step 2: Scoring */}
        {w.step === 2 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-green-700 mb-3 flex items-center gap-1"><Heart className="w-4 h-4" /> Physical Dependence (0-16)</h3>
                <SliderInput label="Tolerance" value={w.physTolerance} onChange={v => up({ physTolerance: v })} />
                <SliderInput label="Withdrawal Symptoms" value={w.physWithdrawal} onChange={v => up({ physWithdrawal: v })} />
                <SliderInput label="Compulsive Use" value={w.physCompulsive} onChange={v => up({ physCompulsive: v })} />
                <SliderInput label="Physical Cravings" value={w.physCraving} onChange={v => up({ physCraving: v })} />
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-blue-700 mb-3 flex items-center gap-1"><Brain className="w-4 h-4" /> Psychological Dependence (0-16)</h3>
                <SliderInput label="Emotional Reliance" value={w.psychEmotional} onChange={v => up({ psychEmotional: v })} />
                <SliderInput label="Coping Mechanism" value={w.psychCoping} onChange={v => up({ psychCoping: v })} />
                <SliderInput label="Preoccupation" value={w.psychPreoccupation} onChange={v => up({ psychPreoccupation: v })} />
                <SliderInput label="Anxiety Without Substance" value={w.psychAnxiety} onChange={v => up({ psychAnxiety: v })} />
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-yellow-700 mb-3 flex items-center gap-1"><Activity className="w-4 h-4" /> Behavioral Dysfunction (0-16)</h3>
                <SliderInput label="Prioritizing Substance" value={w.behPrioritizing} onChange={v => up({ behPrioritizing: v })} />
                <SliderInput label="Failed Attempts to Cut" value={w.behFailed} onChange={v => up({ behFailed: v })} />
                <SliderInput label="Time Spent Obtaining" value={w.behTime} onChange={v => up({ behTime: v })} />
                <SliderInput label="Giving Up Activities" value={w.behGivingUp} onChange={v => up({ behGivingUp: v })} />
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-purple-700 mb-3 flex items-center gap-1"><Shield className="w-4 h-4" /> Social Impairment (0-16)</h3>
                <SliderInput label="Occupational Impact" value={w.socOccupation} onChange={v => up({ socOccupation: v })} />
                <SliderInput label="Relationship Impact" value={w.socRelationship} onChange={v => up({ socRelationship: v })} />
                <SliderInput label="Financial Impact" value={w.socFinancial} onChange={v => up({ socFinancial: v })} />
                <SliderInput label="Legal Issues" value={w.socLegal} onChange={v => up({ socLegal: v })} />
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-medium text-sm text-red-700 mb-3 flex items-center gap-1"><Pill className="w-4 h-4" /> Medical Complications (0-24)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                <SliderInput label="Liver Dysfunction" value={w.medLiver} onChange={v => up({ medLiver: v })} />
                <SliderInput label="Renal Dysfunction" value={w.medRenal} onChange={v => up({ medRenal: v })} />
                <SliderInput label="Cardiac Complications" value={w.medCardiac} onChange={v => up({ medCardiac: v })} />
                <SliderInput label="Neurological" value={w.medNeuro} onChange={v => up({ medNeuro: v })} />
                <SliderInput label="Infectious Complications" value={w.medInfection} onChange={v => up({ medInfection: v })} />
                <SliderInput label="Psychiatric Comorbidity" value={w.medPsych} onChange={v => up({ medPsych: v })} />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Risk Factors */}
        {w.step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Age</label>
                <input type="number" min={0} max={120} value={w.patientAge} onChange={e => up({ patientAge: Number(e.target.value) })} title="Patient Age" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Renal Function</label>
                <select value={w.renalFunction} onChange={e => up({ renalFunction: e.target.value as any })} title="Renal Function" className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="normal">Normal</option>
                  <option value="mild_impairment">Mild Impairment</option>
                  <option value="moderate_impairment">Moderate Impairment</option>
                  <option value="severe_impairment">Severe Impairment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hepatic Function</label>
                <select value={w.hepaticFunction} onChange={e => up({ hepaticFunction: e.target.value as any })} title="Hepatic Function" className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="normal">Normal</option>
                  <option value="mild_impairment">Mild Impairment</option>
                  <option value="moderate_impairment">Moderate Impairment</option>
                  <option value="severe_impairment">Severe Impairment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medical Stability</label>
                <select value={w.medicalStability} onChange={e => up({ medicalStability: e.target.value as any })} title="Medical Stability" className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="stable">Stable</option>
                  <option value="mildly_unstable">Mildly Unstable</option>
                  <option value="unstable">Unstable</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Comorbidities</label>
              <div className="flex gap-2 mb-2">
                <input value={w.comorbidityInput} onChange={e => up({ comorbidityInput: e.target.value })} placeholder="e.g. Sickle Cell Disease, Hypertension..." className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && w.comorbidityInput.trim()) { up({ comorbidities: [...w.comorbidities, w.comorbidityInput.trim()], comorbidityInput: '' }); } }} />
                <button onClick={() => { if (w.comorbidityInput.trim()) { up({ comorbidities: [...w.comorbidities, w.comorbidityInput.trim()], comorbidityInput: '' }); } }} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm">Add</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {w.comorbidities.map((c, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs">
                    {c}
                    <button onClick={() => up({ comorbidities: w.comorbidities.filter((_, j) => j !== i) })} className="text-gray-400 hover:text-red-500" title="Remove"><XCircle className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={w.psychiatricConcerns} onChange={e => up({ psychiatricConcerns: e.target.checked })} className="rounded border-gray-300 text-green-600" />
              Active psychiatric concerns (suicidal ideation, psychosis, etc.)
            </label>
            <div className="border-t pt-4 mt-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                <input type="checkbox" checked={w.includePainAssessment} onChange={e => up({ includePainAssessment: e.target.checked })} className="rounded border-gray-300 text-green-600" />
                Include Pain Management Assessment
              </label>
              {w.includePainAssessment && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pain Type</label>
                    <select value={w.painType} onChange={e => up({ painType: e.target.value as any })} title="Pain Type" className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="nociceptive">Nociceptive</option>
                      <option value="neuropathic">Neuropathic</option>
                      <option value="mixed">Mixed</option>
                      <option value="functional">Functional</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pain Score (0-10)</label>
                    <input type="number" min={0} max={10} value={w.painScore} onChange={e => up({ painScore: Number(e.target.value) })} title="Pain Score" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Functional Impact</label>
                    <select value={w.functionalImpact} onChange={e => up({ functionalImpact: e.target.value as any })} title="Functional Impact" className="w-full border rounded px-2 py-1.5 text-sm">
                      <option value="minimal">Minimal</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Pain Cause</label>
                    <input value={w.painCause} onChange={e => up({ painCause: e.target.value })} title="Pain Cause" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Current Analgesics (comma-separated)</label>
                    <input value={w.currentAnalgesics} onChange={e => up({ currentAnalgesics: e.target.value })} title="Current Analgesics" className="w-full border rounded px-2 py-1.5 text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={w.hasSickleCellDisease} onChange={e => up({ hasSickleCellDisease: e.target.checked })} className="rounded border-gray-300 text-green-600" />
                    Sickle Cell Disease
                  </label>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Social & History */}
        {w.step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Family Support Level</label>
                <select value={w.familySupportLevel} onChange={e => up({ familySupportLevel: e.target.value as any })} title="Family Support Level" className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="strong">Strong</option>
                  <option value="moderate">Moderate</option>
                  <option value="minimal">Minimal</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employment Status</label>
                <input value={w.employmentStatus} onChange={e => up({ employmentStatus: e.target.value })} placeholder="e.g. Employed, Unemployed, Student..." className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Housing Stability</label>
                <select value={w.housingStability} onChange={e => up({ housingStability: e.target.value as any })} title="Housing Stability" className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="stable">Stable</option>
                  <option value="unstable">Unstable</option>
                  <option value="homeless">Homeless</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Previous Detox Attempts</label>
                <input type="number" min={0} value={w.previousDetoxAttempts} onChange={e => up({ previousDetoxAttempts: Number(e.target.value) })} title="Previous Detox Attempts" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={w.financialConcerns} onChange={e => up({ financialConcerns: e.target.checked })} className="rounded border-gray-300 text-green-600" />
                Financial concerns
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={w.legalIssues} onChange={e => up({ legalIssues: e.target.checked })} className="rounded border-gray-300 text-green-600" />
                Legal issues
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Previous Treatment History</label>
              <textarea value={w.previousTreatmentHistory} onChange={e => up({ previousTreatmentHistory: e.target.value })} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Describe any prior treatment history..." />
            </div>
          </div>
        )}

        {/* Step 5: Review & Save */}
        {w.step === 5 && computed.severity && (
          <div className="space-y-6">
            {/* Severity Summary */}
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Addiction Severity Assessment</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className={`text-3xl font-bold ${computed.severity.totalCompositeScore > 66 ? 'text-red-600' : computed.severity.totalCompositeScore > 44 ? 'text-orange-600' : computed.severity.totalCompositeScore > 22 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {computed.severity.totalCompositeScore}/88
                </div>
                <Badge text={computed.severity.severityLevel.toUpperCase()} className={
                  computed.severity.severityLevel === 'complicated' ? 'bg-red-100 text-red-800' :
                  computed.severity.severityLevel === 'severe' ? 'bg-orange-100 text-orange-800' :
                  computed.severity.severityLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                } />
              </div>
              <p className="text-sm text-gray-600 mb-4">{computed.severity.interpretationNotes}</p>
              <ScoreBar label="Physical Dependence" score={computed.severity.physicalDependence.totalScore} max={16} color="red" />
              <ScoreBar label="Psychological Dependence" score={computed.severity.psychologicalDependence.totalScore} max={16} color="blue" />
              <ScoreBar label="Behavioral Dysfunction" score={computed.severity.behavioralDysfunction.totalScore} max={16} color="yellow" />
              <ScoreBar label="Social Impairment" score={computed.severity.socialImpairment.totalScore} max={16} />
              <ScoreBar label="Medical Complications" score={computed.severity.medicalComplications.totalScore} max={24} color="red" />
            </div>

            {/* Withdrawal Risk */}
            {computed.withdrawal && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Withdrawal Risk Prediction</h3>
                <div className="flex items-center gap-4 mb-3">
                  <Badge text={computed.withdrawal.overallRisk.replace(/_/g, ' ').toUpperCase()} className={
                    computed.withdrawal.overallRisk === 'life_threatening' ? 'bg-red-200 text-red-900' :
                    computed.withdrawal.overallRisk === 'severe' ? 'bg-red-100 text-red-800' :
                    computed.withdrawal.overallRisk === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  } />
                  <span className="text-sm text-gray-600">Risk Score: {computed.withdrawal.riskScore}/100</span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{computed.withdrawal.timelineDescription}</p>
                {computed.withdrawal.redFlagComplications.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Red Flag Complications:</p>
                    <ul className="text-xs text-red-600 list-disc list-inside">
                      {computed.withdrawal.redFlagComplications.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Care Setting */}
            {computed.careSetting && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Care Setting Recommendation</h3>
                <Badge text={computed.careSetting.recommendation.replace(/_/g, ' ').toUpperCase()} className={
                  computed.careSetting.recommendation === 'icu_hdu_alert' ? 'bg-red-200 text-red-900' :
                  computed.careSetting.recommendation === 'inpatient_admission' ? 'bg-orange-100 text-orange-800' :
                  'bg-green-100 text-green-800'
                } />
                <p className="text-sm text-gray-500 mt-1">Confidence: {computed.careSetting.confidenceLevel}</p>
                {computed.careSetting.triggerFactors.length > 0 && (
                  <ul className="text-sm text-gray-600 mt-2 list-disc list-inside">
                    {computed.careSetting.triggerFactors.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Pain Management */}
            {computed.pain && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Pain Management Support</h3>
                <p className="text-sm text-gray-600 mb-2">Pain Score: {computed.pain.painContext.currentPainScore}/10 ({computed.pain.painContext.painType})</p>
                {computed.pain.highRiskCombinationsWarning.length > 0 && (
                  <div className="p-2 bg-yellow-50 border border-yellow-200 rounded mb-2">
                    {computed.pain.highRiskCombinationsWarning.map((w, i) => <p key={i} className="text-xs text-yellow-800">{w}</p>)}
                  </div>
                )}
                <h4 className="text-xs font-medium text-gray-700 mt-2">Primary Options:</h4>
                <ul className="text-xs text-gray-600 list-disc list-inside">
                  {computed.pain.nonOpioidPrimaryOptions.map((o, i) => <li key={i}>{o.recommendation} — {o.rationale}</li>)}
                </ul>
              </div>
            )}

            {/* Comorbidity Modifications */}
            {computed.comorbMods.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Comorbidity Modifications</h3>
                {computed.comorbMods.map((m, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <p className="text-sm font-medium text-gray-800">{m.condition}</p>
                    <ul className="text-xs text-gray-600 list-disc list-inside ml-2">
                      {m.specialConsiderations.map((s, j) => <li key={j}>{s}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Consent */}
            <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={w.consentObtained} onChange={e => up({ consentObtained: e.target.checked })} className="mt-1 rounded border-gray-300 text-green-600" />
                <div>
                  <p className="font-medium text-gray-900">Clinical Consent & Acknowledgment</p>
                  <p className="text-sm text-gray-600 mt-1">
                    I confirm that this assessment is for decision support only. All clinical recommendations require licensed clinician review
                    and approval. No autonomous prescribing is implied. The patient has been informed of the detoxification process, risks,
                    and monitoring requirements.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-between">
        <button onClick={() => up({ step: Math.max(0, w.step - 1) })} disabled={w.step === 0} className="flex items-center gap-1 px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-white">
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>
        {w.step < WIZARD_STEPS.length - 1 ? (
          <button onClick={() => up({ step: w.step + 1 })} disabled={!canNext()} className="flex items-center gap-1 px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-40 hover:bg-green-700">
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={saveAssessment} disabled={saving || !w.consentObtained} className="flex items-center gap-1 px-6 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-40 hover:bg-green-700">
            {saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Assessment</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ============ ASSESSMENT DETAIL VIEW ============

function AssessmentDetail({ assessment, user, onUpdate }: {
  assessment: SubstanceUseAssessment;
  user: any;
  onUpdate: () => void;
}) {
  const [activeSection, setActiveSection] = useState<'overview' | 'monitoring' | 'followups' | 'summary'>('overview');
  const [monitoringRecords, setMonitoringRecords] = useState<DetoxMonitoringRecord[]>([]);
  const [followUps, setFollowUps] = useState<DetoxFollowUp[]>([]);
  const [showMonitoringForm, setShowMonitoringForm] = useState(false);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState(assessment.status);

  useEffect(() => {
    loadRelatedData();
  }, [assessment.id]);

  const loadRelatedData = async () => {
    try {
      const mr = await db.detox_monitoring_records.where('assessmentId').equals(assessment.id).toArray();
      mr.sort((a, b) => new Date(b.monitoredAt).getTime() - new Date(a.monitoredAt).getTime());
      setMonitoringRecords(mr);

      const fu = await db.detox_follow_ups.where('assessmentId').equals(assessment.id).toArray();
      fu.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
      setFollowUps(fu);
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (newStatus: AssessmentStatus) => {
    try {
      const rec = await db.substance_use_assessments.where('id').equals(assessment.id).first();
      if (!rec) return;
      const key = (rec as any).local_id ?? rec.id;
      await db.substance_use_assessments.update(key, {
        status: newStatus,
        updatedAt: new Date(),
        auditLog: [...(assessment.auditLog || []), { action: `status_changed_to_${newStatus}`, performedBy: user?.username || 'Unknown', performedAt: new Date() }],
      });
      try {
        await (db as any).sync_queue.add({ table: 'substance_use_assessments', action: 'update', data: { id: assessment.id, status: newStatus }, local_id: assessment.id, created_at: new Date() });
      } catch { /* offline-safe */ }
      onUpdate();
    } catch (e) { console.error(e); }
  };

  const sev = assessment.addictionSeverityScore;
  const wr = assessment.withdrawalRiskPrediction;
  const cs = assessment.careSettingDecision;

  const sections = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'followups', label: 'Follow-Ups', icon: Calendar },
    { id: 'summary', label: 'Summary', icon: FileText },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{assessment.patientName}</h2>
            <p className="text-sm text-gray-500">
              {assessment.hospitalNumber && `#${assessment.hospitalNumber} • `}
              Primary: {assessment.primarySubstance}
              {assessment.polySubstanceUse && ` • ${assessment.substances?.length || 0} substances`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select value={statusUpdate} onChange={e => { setStatusUpdate(e.target.value as AssessmentStatus); updateStatus(e.target.value as AssessmentStatus); }}
              title="Assessment Status" className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="initial_assessment">Initial Assessment</option>
              <option value="in_detox">In Detox</option>
              <option value="monitoring">Monitoring</option>
              <option value="detox_completed">Detox Completed</option>
              <option value="discharged">Discharged</option>
              <option value="relapsed">Relapsed</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <Badge text={assessment.status.replace(/_/g, ' ')} className={STATUS_COLORS[assessment.status] || 'bg-gray-100 text-gray-800'} />
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)} className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-md transition ${activeSection === s.id ? 'bg-white shadow text-green-700 font-medium' : 'text-gray-600'}`}>
            <s.icon className="w-4 h-4" /> {s.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeSection === 'overview' && (
        <div className="space-y-4">
          {/* Severity */}
          {sev && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Addiction Severity: {sev.totalCompositeScore}/88 — {sev.severityLevel.toUpperCase()}</h3>
              <ScoreBar label="Physical Dependence" score={sev.physicalDependence.totalScore} max={16} color="red" />
              <ScoreBar label="Psychological Dependence" score={sev.psychologicalDependence.totalScore} max={16} color="blue" />
              <ScoreBar label="Behavioral Dysfunction" score={sev.behavioralDysfunction.totalScore} max={16} color="yellow" />
              <ScoreBar label="Social Impairment" score={sev.socialImpairment.totalScore} max={16} />
              <ScoreBar label="Medical Complications" score={sev.medicalComplications.totalScore} max={24} color="red" />
              <p className="text-sm text-gray-600 mt-3">{sev.interpretationNotes}</p>
            </div>
          )}
          {/* Withdrawal */}
          {wr && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Withdrawal Risk: {wr.overallRisk.replace(/_/g, ' ').toUpperCase()} ({wr.riskScore}/100)</h3>
              <p className="text-sm text-gray-600">{wr.timelineDescription}</p>
              {wr.pharmacologicalSupport.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-gray-700">Pharmacological Support:</p>
                  <div className="flex flex-wrap gap-1 mt-1">{wr.pharmacologicalSupport.map((p, i) => <Badge key={i} text={p} className="bg-blue-50 text-blue-700" />)}</div>
                </div>
              )}
            </div>
          )}
          {/* Care Setting */}
          {cs && (
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Care Setting: {cs.recommendation.replace(/_/g, ' ').toUpperCase()}</h3>
              <p className="text-sm text-gray-500">Confidence: {cs.confidenceLevel}</p>
              {cs.escalationCriteria.length > 0 && (
                <ul className="text-sm text-gray-600 mt-2 list-disc list-inside">{cs.escalationCriteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
              )}
            </div>
          )}
          {/* Substances list */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Substances</h3>
            {assessment.substances?.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="font-medium text-sm">{substanceDefinitions[s.substanceName]?.name || s.substanceName}</span>
                {s.isPrimaryConcern && <Badge text="Primary" className="bg-green-100 text-green-800" />}
                <span className="text-xs text-gray-500">{s.routeOfAdministration} • {s.frequencyOfUse} • {s.durationOfUseMonths}mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monitoring */}
      {activeSection === 'monitoring' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Detox Monitoring Records</h3>
            <button onClick={() => setShowMonitoringForm(!showMonitoringForm)} className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> Add Record
            </button>
          </div>

          {showMonitoringForm && (
            <MonitoringForm assessmentId={assessment.id} patientId={assessment.patientId} user={user}
              onSaved={() => { setShowMonitoringForm(false); loadRelatedData(); }} onCancel={() => setShowMonitoringForm(false)} />
          )}

          {monitoringRecords.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No monitoring records yet</p>
          ) : (
            monitoringRecords.map((r, i) => (
              <div key={r.id || i} className="bg-white border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{new Date(r.monitoredAt).toLocaleString()}</span>
                  {r.escalationTriggered && <Badge text="ESCALATION" className="bg-red-100 text-red-800" />}
                </div>
                {r.vitalSigns && (
                  <div className="flex gap-4 text-xs text-gray-600 mb-2">
                    {r.vitalSigns.heartRate && <span>HR: {r.vitalSigns.heartRate}</span>}
                    {r.vitalSigns.bloodPressure && <span>BP: {r.vitalSigns.bloodPressure}</span>}
                    {r.vitalSigns.temperature && <span>Temp: {r.vitalSigns.temperature}°C</span>}
                    {r.vitalSigns.respiratoryRate && <span>RR: {r.vitalSigns.respiratoryRate}</span>}
                    {r.vitalSigns.oxygenSaturation && <span>SpO2: {r.vitalSigns.oxygenSaturation}%</span>}
                  </div>
                )}
                {r.withdrawalScaleScore !== undefined && (
                  <p className="text-sm text-gray-600">{r.withdrawalScaleType || 'Scale'} Score: <span className="font-medium">{r.withdrawalScaleScore}</span></p>
                )}
                {r.clinicalNotes && <p className="text-sm text-gray-600 mt-1">{r.clinicalNotes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Follow-Ups */}
      {activeSection === 'followups' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Follow-Up Schedule</h3>
            <button onClick={() => setShowFollowUpForm(!showFollowUpForm)} className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Plus className="w-4 h-4" /> Schedule Follow-Up
            </button>
          </div>

          {showFollowUpForm && (
            <FollowUpForm assessmentId={assessment.id} patientId={assessment.patientId} user={user}
              onSaved={() => { setShowFollowUpForm(false); loadRelatedData(); }} onCancel={() => setShowFollowUpForm(false)} />
          )}

          {followUps.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No follow-ups scheduled</p>
          ) : (
            followUps.map((fu, i) => (
              <div key={fu.id || i} className="bg-white border rounded-lg p-4 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium">{new Date(fu.scheduledDate).toLocaleDateString()}</span>
                    <Badge text={fu.status} className={fu.status === 'completed' ? 'bg-green-100 text-green-800' : fu.status === 'missed' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'} />
                    <Badge text={fu.followUpType} className="bg-gray-100 text-gray-700" />
                  </div>
                  {fu.notes && <p className="text-xs text-gray-500 mt-1">{fu.notes}</p>}
                </div>
                {fu.status === 'scheduled' && (
                  <button onClick={async () => {
                    const key = (fu as any).local_id ?? fu.id;
                    await db.detox_follow_ups.update(key, { status: 'completed', actualDate: new Date().toISOString(), updatedAt: new Date() });
                    loadRelatedData();
                  }} className="text-xs text-green-600 hover:underline">Mark Complete</button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Summary */}
      {activeSection === 'summary' && (
        <div className="bg-white border rounded-lg p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Clinical Summary</h3>
          <div className="prose prose-sm max-w-none">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700 w-48">Patient</td><td>{assessment.patientName} {assessment.hospitalNumber && `(#${assessment.hospitalNumber})`}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Assessment Date</td><td>{new Date(assessment.assessmentDate || assessment.createdAt).toLocaleDateString()}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Assessed By</td><td>{assessment.assessedBy}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Status</td><td>{assessment.status.replace(/_/g, ' ')}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Primary Substance</td><td>{assessment.primarySubstance}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Addiction Severity</td><td>{sev?.severityLevel} ({sev?.totalCompositeScore}/88)</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Withdrawal Risk</td><td>{wr?.overallRisk?.replace(/_/g, ' ')} ({wr?.riskScore}/100)</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Care Setting</td><td>{cs?.recommendation?.replace(/_/g, ' ')}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Comorbidities</td><td>{assessment.comorbidities?.join(', ') || 'None'}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Previous Detox Attempts</td><td>{assessment.previousDetoxAttempts}</td></tr>
                <tr className="border-b"><td className="py-2 font-medium text-gray-700">Monitoring Records</td><td>{monitoringRecords.length}</td></tr>
                <tr><td className="py-2 font-medium text-gray-700">Follow-Ups</td><td>{followUps.length}</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            <strong>Disclaimer:</strong> This is a clinical decision support tool. All management decisions must be reviewed and approved by a licensed clinician. This does not constitute autonomous prescribing.
          </div>
        </div>
      )}

      {/* Audit Log */}
      {assessment.auditLog && assessment.auditLog.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2 text-sm">Audit Log</h3>
          <div className="space-y-1">
            {assessment.auditLog.map((entry, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                <span>{new Date(entry.performedAt).toLocaleString()}</span>
                <span className="font-medium text-gray-700">{entry.performedBy}</span>
                <span>{entry.action.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============ MONITORING FORM ============

function MonitoringForm({ assessmentId, patientId, user, onSaved, onCancel }: {
  assessmentId: string; patientId: string; user: any; onSaved: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({
    heartRate: '', bloodPressure: '', temperature: '', respiratoryRate: '', oxygenSaturation: '',
    withdrawalScaleScore: '', withdrawalScaleType: 'COWS' as 'COWS' | 'CIWA-Ar' | 'CIWA-B',
    clinicalNotes: '', escalationTriggered: false, escalationReason: '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const now = new Date();
      const record: any = {
        id: `dmr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        assessmentId,
        patientId,
        monitoredAt: now,
        recordedAt: now,
        monitoredBy: user?.username || 'Unknown',
        vitalSigns: {
          heartRate: form.heartRate ? Number(form.heartRate) : undefined,
          bloodPressure: form.bloodPressure || undefined,
          temperature: form.temperature ? Number(form.temperature) : undefined,
          respiratoryRate: form.respiratoryRate ? Number(form.respiratoryRate) : undefined,
          oxygenSaturation: form.oxygenSaturation ? Number(form.oxygenSaturation) : undefined,
        },
        withdrawalScaleScore: form.withdrawalScaleScore ? Number(form.withdrawalScaleScore) : undefined,
        withdrawalScaleType: form.withdrawalScaleType,
        symptomChecklist: [],
        medicationsGiven: [],
        clinicalNotes: form.clinicalNotes,
        escalationTriggered: form.escalationTriggered,
        escalationReason: form.escalationReason || undefined,
        synced: false,
      };
      await db.detox_monitoring_records.add(record);
      try {
        await (db as any).sync_queue.add({ table: 'detox_monitoring_records', action: 'create', data: record, local_id: record.id, created_at: now });
      } catch { /* offline-safe */ }
      onSaved();
    } catch (e) { console.error(e); alert('Error saving record'); } finally { setSaving(false); }
  };

  const u = (partial: Partial<typeof form>) => setForm(prev => ({ ...prev, ...partial }));

  return (
    <div className="border rounded-lg p-4 bg-green-50">
      <h4 className="font-medium text-sm mb-3">New Monitoring Record</h4>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
        <div><label className="block text-xs text-gray-600 mb-1">HR (bpm)</label><input value={form.heartRate} onChange={e => u({ heartRate: e.target.value })} type="number" title="Heart Rate" className="w-full border rounded px-2 py-1.5 text-sm" /></div>
        <div><label className="block text-xs text-gray-600 mb-1">BP</label><input value={form.bloodPressure} onChange={e => u({ bloodPressure: e.target.value })} placeholder="120/80" className="w-full border rounded px-2 py-1.5 text-sm" /></div>
        <div><label className="block text-xs text-gray-600 mb-1">Temp (°C)</label><input value={form.temperature} onChange={e => u({ temperature: e.target.value })} type="number" step="0.1" title="Temperature" className="w-full border rounded px-2 py-1.5 text-sm" /></div>
        <div><label className="block text-xs text-gray-600 mb-1">RR (/min)</label><input value={form.respiratoryRate} onChange={e => u({ respiratoryRate: e.target.value })} type="number" title="Respiratory Rate" className="w-full border rounded px-2 py-1.5 text-sm" /></div>
        <div><label className="block text-xs text-gray-600 mb-1">SpO2 (%)</label><input value={form.oxygenSaturation} onChange={e => u({ oxygenSaturation: e.target.value })} type="number" title="Oxygen Saturation" className="w-full border rounded px-2 py-1.5 text-sm" /></div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Scale Type</label>
          <select value={form.withdrawalScaleType} onChange={e => u({ withdrawalScaleType: e.target.value as any })} title="Withdrawal Scale Type" className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="COWS">COWS (Opioid)</option>
            <option value="CIWA-Ar">CIWA-Ar (Alcohol)</option>
            <option value="CIWA-B">CIWA-B (Benzo)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Withdrawal Score</label>
          <input value={form.withdrawalScaleScore} onChange={e => u({ withdrawalScaleScore: e.target.value })} type="number" title="Withdrawal Score" className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-xs text-gray-600 mb-1">Clinical Notes</label>
        <textarea value={form.clinicalNotes} onChange={e => u({ clinicalNotes: e.target.value })} rows={2} title="Clinical Notes" className="w-full border rounded px-2 py-1.5 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={form.escalationTriggered} onChange={e => u({ escalationTriggered: e.target.checked })} className="rounded border-gray-300 text-red-600" />
        <span className="text-red-700 font-medium">Escalation Required</span>
      </label>
      {form.escalationTriggered && (
        <div className="mb-3"><input value={form.escalationReason} onChange={e => u({ escalationReason: e.target.value })} placeholder="Escalation reason..." className="w-full border border-red-300 rounded px-2 py-1.5 text-sm" /></div>
      )}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Record'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border text-sm rounded-lg hover:bg-white">Cancel</button>
      </div>
    </div>
  );
}

// ============ FOLLOW-UP FORM ============

function FollowUpForm({ assessmentId, patientId, user, onSaved, onCancel }: {
  assessmentId: string; patientId: string; user: any; onSaved: () => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ scheduledDate: '', followUpType: 'clinic' as 'phone' | 'clinic' | 'home_visit', notes: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.scheduledDate) return;
    setSaving(true);
    try {
      const now = new Date();
      const followUp: any = {
        id: `dfu_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        assessmentId,
        patientId,
        scheduledDate: form.scheduledDate,
        status: 'scheduled',
        followUpType: form.followUpType,
        notes: form.notes,
        relapseSinceLastVisit: false,
        createdAt: now,
        updatedAt: now,
        synced: false,
      };
      await db.detox_follow_ups.add(followUp);
      try {
        await (db as any).sync_queue.add({ table: 'detox_follow_ups', action: 'create', data: followUp, local_id: followUp.id, created_at: now });
      } catch { /* offline-safe */ }
      onSaved();
    } catch (e) { console.error(e); alert('Error saving follow-up'); } finally { setSaving(false); }
  };

  return (
    <div className="border rounded-lg p-4 bg-green-50">
      <h4 className="font-medium text-sm mb-3">Schedule Follow-Up</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Date *</label>
          <input type="date" value={form.scheduledDate} onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))} title="Scheduled Date" className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Type</label>
          <select value={form.followUpType} onChange={e => setForm(p => ({ ...p, followUpType: e.target.value as any }))} title="Follow-Up Type" className="w-full border rounded px-2 py-1.5 text-sm">
            <option value="clinic">Clinic Visit</option>
            <option value="phone">Phone Call</option>
            <option value="home_visit">Home Visit</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Notes</label>
          <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} title="Notes" className="w-full border rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !form.scheduledDate} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Schedule'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 border text-sm rounded-lg hover:bg-white">Cancel</button>
      </div>
    </div>
  );
}
