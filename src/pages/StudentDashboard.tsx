import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, Users, ClipboardList, Activity, Loader2, LogOut, 
  Plus, Save, Send, Eye, X, Calendar, MapPin, Star, Clock, FileText, AlertCircle, BookOpen
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useAuthStore } from '../store/authStore';
import { broadcastChange } from '../utils/crossTabSync';
import { medicalTrainingService, CMETopic, TrainingLevel } from '../services/medicalTrainingService';
import CMEArticleViewer from '../components/training/CMEArticleViewer';
import CBTPage from '../components/cbt/CBTPage';

// ─── Types ──────────────────────────────────────────────────────────────────
interface Patient {
  patient_id: string;
  hospital_number: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  ward_id: string;
  bed_number: string;
  sex: string;
  dob: string;
  assigned_at: string;
}

interface Clerking {
  id: number;
  patient_id: string;
  hospital_number?: string;
  chief_complaint: string;
  history_of_present_illness: string;
  past_medical_history: string;
  past_surgical_history: string;
  family_history: string;
  social_history: string;
  drug_history: string;
  allergies: string;
  review_of_systems: Record<string, any>;
  physical_examination: Record<string, any>;
  vital_signs: Record<string, any>;
  provisional_diagnosis: string;
  differential_diagnoses: string[];
  investigations_requested: string[];
  plan: string;
  status: string;
  evaluation_score: number | null;
  evaluation_feedback: string | null;
  evaluated_by: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

interface TreatmentPlan {
  id: number;
  patient_id: string;
  diagnosis: string;
  treatment_goals: string[];
  medications: any[];
  investigations: any[];
  procedures: any[];
  nursing_care: string;
  diet: string;
  follow_up_plan: string;
  discharge_criteria: string;
  status: string;
  evaluation_score: number | null;
  evaluation_feedback: string | null;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

interface DashboardStats {
  assignedPatients: number;
  totalClerkings: number;
  evaluatedClerkings: number;
  totalPlans: number;
  evaluatedPlans: number;
  daysLeft: number;
  averageScore: number | null;
}

interface StudentMetrics {
  posting: { start: string | null; end: string | null; totalDays: number | null; elapsedDays: number | null; remainingDays: number | null; percentComplete: number | null; status: string };
  clerkings: { total: number; draft: number; submitted: number; evaluated: number; avgScore: number | null };
  plans: { total: number; draft: number; submitted: number; evaluated: number; avgScore: number | null };
  patients: { assigned: number; distinctClerked: number };
  attendance: { activeDays: number; expectedDays: number; attendancePct: number | null };
  engagement: { totalActivities: number; lastActive: string | null };
  combinedAvg: number | null;
  overallScore: number;
  requirements: { clerkings: number; plans: number; avgScore: number; attendancePct: number };
  eligibility: { eligible: boolean; met: string[]; notMet: string[] };
  weekly: { week: number; clerkings: number; plans: number }[];
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [tab, setTab] = useState<'dashboard' | 'patients' | 'clerking' | 'plans' | 'learning'>('dashboard');
  // Learning tab: CME / self-assessment / CBT + sign-out summary
  const [learningLevel, setLearningLevel] = useState<TrainingLevel>('house_officer');
  const [learningTopic, setLearningTopic] = useState<CMETopic | null>(null);
  const [showStudentCBT, setShowStudentCBT] = useState(false);
  const [trainingSummary, setTrainingSummary] = useState<any>(null);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [metrics, setMetrics] = useState<StudentMetrics | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [clerkings, setClerkings] = useState<Clerking[]>([]);
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);

  // Clerking form state
  const [clerkingForm, setClerkingForm] = useState(false);
  const [clerkingPatient, setClerkingPatient] = useState<Patient | null>(null);
  const [cf, setCf] = useState({
    chief_complaint: '', history_of_present_illness: '', past_medical_history: '',
    past_surgical_history: '', family_history: '', social_history: '', drug_history: '',
    allergies: '', provisional_diagnosis: '', plan: '',
    review_of_systems: {} as Record<string, string>,
    physical_examination: {} as Record<string, string>,
    vital_signs: {} as Record<string, string>,
    differential_diagnoses: [''],
    investigations_requested: [''],
  });
  const [savingClerking, setSavingClerking] = useState(false);
  const [viewClerking, setViewClerking] = useState<Clerking | null>(null);

  // Treatment Plan form state
  const [planForm, setPlanForm] = useState(false);
  const [planPatient, setPlanPatient] = useState<Patient | null>(null);
  const [pf, setPf] = useState({
    diagnosis: '', nursing_care: '', diet: '', follow_up_plan: '', discharge_criteria: '',
    treatment_goals: [''],
    medications: [{ name: '', dose: '', route: '', frequency: '' }],
    investigations: [''],
    procedures: [''],
  });
  const [savingPlan, setSavingPlan] = useState(false);
  const [viewPlan, setViewPlan] = useState<TreatmentPlan | null>(null);

  // ─── Load data ────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    try {
      const data = await apiClient.get('/students/dashboard');
      setStats(data.stats);
      setMetrics(data.metrics || null);
      setPatients(data.patients);
      setClerkings(data.clerkings);
      setPlans(data.treatmentPlans);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPatients = useCallback(async () => {
    try {
      const data = await apiClient.get('/students/my-patients');
      setPatients(data);
    } catch (err) {
      console.error('Patients load error:', err);
    }
  }, []);

  const loadClerkings = useCallback(async () => {
    try {
      const data = await apiClient.get('/students/clerkings');
      setClerkings(data);
    } catch (err) {
      console.error('Clerkings load error:', err);
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const data = await apiClient.get('/students/treatment-plans');
      setPlans(data);
    } catch (err) {
      console.error('Plans load error:', err);
    }
  }, []);

  const loadTrainingSummary = useCallback(async () => {
    try {
      const data = await apiClient.get('/students/training-summary');
      setTrainingSummary(data);
    } catch (err) {
      console.error('Training summary load error:', err);
    }
  }, []);

  // Record CME read / self-assessment / CBT participation (counts toward sign-out).
  const recordTraining = useCallback(async (kind: 'cme' | 'cbt' | 'self_assessment', payload: { refId: string; title?: string; score?: number; total?: number }) => {
    try {
      await apiClient.post('/students/training', { kind, ...payload });
      await loadTrainingSummary();
      try { broadcastChange('training'); } catch { /* non-fatal */ }
    } catch (err) {
      console.warn('Failed to record training (will retry later):', err);
    }
  }, [loadTrainingSummary]);

  useEffect(() => {
    if (!user || (user.role as string) !== 'student') {
      navigate('/');
      return;
    }
    loadDashboard();
  }, [user, navigate, loadDashboard]);

  // Real-time-lite: keep the performance record current on tab focus + a gentle poll
  useEffect(() => {
    if (!user || (user.role as string) !== 'student') return;
    const onFocus = () => { if (document.visibilityState === 'visible') loadDashboard(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const poll = setInterval(() => { if (document.visibilityState === 'visible') loadDashboard(); }, 60000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(poll);
    };
  }, [user, loadDashboard]);

  // ─── Clerking submission ──────────────────────────────────────────────────
  const submitClerking = async (status: 'draft' | 'submitted') => {
    if (!clerkingPatient) return;
    setSavingClerking(true);
    try {
      await apiClient.post('/students/clerkings', {
        patient_id: clerkingPatient.patient_id,
        hospital_number: clerkingPatient.hospital_number,
        ...cf,
        differential_diagnoses: cf.differential_diagnoses.filter(Boolean),
        investigations_requested: cf.investigations_requested.filter(Boolean),
        status,
      });
      setClerkingForm(false);
      resetClerkingForm();
      await loadClerkings();
      await loadDashboard();
      broadcastChange('training');
    } catch (err: any) {
      alert(err.message || 'Failed to save clerking');
    } finally {
      setSavingClerking(false);
    }
  };

  const resetClerkingForm = () => {
    setCf({
      chief_complaint: '', history_of_present_illness: '', past_medical_history: '',
      past_surgical_history: '', family_history: '', social_history: '', drug_history: '',
      allergies: '', provisional_diagnosis: '', plan: '',
      review_of_systems: {}, physical_examination: {}, vital_signs: {},
      differential_diagnoses: [''], investigations_requested: [''],
    });
    setClerkingPatient(null);
  };

  // ─── Treatment Plan submission ────────────────────────────────────────────
  const submitPlan = async (status: 'draft' | 'submitted') => {
    if (!planPatient) return;
    setSavingPlan(true);
    try {
      await apiClient.post('/students/treatment-plans', {
        patient_id: planPatient.patient_id,
        hospital_number: planPatient.hospital_number,
        ...pf,
        treatment_goals: pf.treatment_goals.filter(Boolean),
        medications: pf.medications.filter(m => m.name),
        investigations: pf.investigations.filter(Boolean),
        procedures: pf.procedures.filter(Boolean),
        status,
      });
      setPlanForm(false);
      resetPlanForm();
      await loadPlans();
      await loadDashboard();
      broadcastChange('training');
    } catch (err: any) {
      alert(err.message || 'Failed to save plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const resetPlanForm = () => {
    setPf({
      diagnosis: '', nursing_care: '', diet: '', follow_up_plan: '', discharge_criteria: '',
      treatment_goals: [''], medications: [{ name: '', dose: '', route: '', frequency: '' }],
      investigations: [''], procedures: [''],
    });
    setPlanPatient(null);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const patientName = (p: { first_name?: string; last_name?: string; full_name?: string }) =>
    p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown';

  const statusBadge = (status: string, score: number | null) => {
    if (score != null) return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-medium">Scored: {score}/100</span>;
    if (status === 'submitted') return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">Submitted</span>;
    if (status === 'evaluated') return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Evaluated</span>;
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">Draft</span>;
  };

  const handleLogout = () => {
    logout();
    navigate('/student-login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  // Full-screen CME article + self-assessment (records student participation).
  if (learningTopic) {
    return (
      <CMEArticleViewer
        topic={learningTopic}
        onBack={() => setLearningTopic(null)}
        isCompleted={completedTopics.has(String(learningTopic.id))}
        onComplete={() => {
          setCompletedTopics(prev => new Set([...prev, String(learningTopic.id)]));
          recordTraining('cme', { refId: String(learningTopic.id), title: learningTopic.title });
        }}
        onSelfAssessment={(r) => recordTraining('self_assessment', { refId: `sa-${r.topicId}`, title: learningTopic.title, score: r.correct, total: r.total })}
      />
    );
  }

  // Full-screen CBT for students (records participation on submit).
  if (showStudentCBT) {
    return (
      <CBTPage
        level={learningLevel}
        onBack={() => { setShowStudentCBT(false); loadTrainingSummary(); }}
        onResult={(res) => recordTraining('cbt', { refId: `cbt-${res.testNumber}`, title: `CBT ${res.testNumber}`, score: res.score, total: res.total })}
      />
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">{user?.name}</h1>
              <p className="text-xs text-gray-500">Student Clinical Posting {stats ? `· ${stats.daysLeft} days left` : ''}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600" aria-label="Logout">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-[65px] z-20">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {([
            { key: 'dashboard', label: 'Dashboard', icon: ClipboardList },
            { key: 'patients', label: 'My Patients', icon: Users },
            { key: 'clerking', label: 'Clerkings', icon: FileText },
            { key: 'plans', label: 'Treatment Plans', icon: Activity },
            { key: 'learning', label: 'Learning & Sign-out', icon: GraduationCap },
          ] as const).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); if (t.key === 'patients') loadPatients(); if (t.key === 'clerking') loadClerkings(); if (t.key === 'plans') loadPlans(); if (t.key === 'learning') loadTrainingSummary(); }}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ═══ DASHBOARD TAB ═══ */}
        {tab === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Assigned Patients', value: stats.assignedPatients, max: 5, color: 'green' },
                { label: 'Clerkings Done', value: stats.totalClerkings, sub: `${stats.evaluatedClerkings} evaluated`, color: 'blue' },
                { label: 'Treatment Plans', value: stats.totalPlans, sub: `${stats.evaluatedPlans} evaluated`, color: 'purple' },
                { label: 'Avg Score', value: stats.averageScore != null ? `${stats.averageScore}%` : 'N/A', color: 'yellow' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold text-${s.color}-600`}>{s.value}{s.max ? <span className="text-sm text-gray-400">/{s.max}</span> : ''}</p>
                  {s.sub && <p className="text-xs text-gray-400 mt-1">{s.sub}</p>}
                </div>
              ))}
            </div>

            {/* Performance Record */}
            {metrics && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Star className="w-4 h-4 text-yellow-500" /> Performance Record
                  </h3>
                  <span className={`text-sm font-bold px-2.5 py-1 rounded-full ${
                    metrics.overallScore >= 75 ? 'bg-green-100 text-green-700'
                      : metrics.overallScore >= 50 ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    Overall {metrics.overallScore}%
                  </span>
                </div>

                {/* Posting progress */}
                {metrics.posting.percentComplete != null && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Posting progress</span>
                      <span>{metrics.posting.elapsedDays ?? 0}/{metrics.posting.totalDays ?? '?'} days &middot; {metrics.posting.remainingDays ?? 0} left</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full bg-green-500" style={{ width: `${metrics.posting.percentComplete}%` }} />
                    </div>
                  </div>
                )}

                {/* Metric tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{metrics.clerkings.avgScore ?? '—'}{metrics.clerkings.avgScore != null ? '%' : ''}</p>
                    <p className="text-[10px] text-gray-500">Clerking avg ({metrics.clerkings.evaluated}/{metrics.clerkings.total})</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-purple-600">{metrics.plans.avgScore ?? '—'}{metrics.plans.avgScore != null ? '%' : ''}</p>
                    <p className="text-[10px] text-gray-500">Plan avg ({metrics.plans.evaluated}/{metrics.plans.total})</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-cyan-600">{metrics.attendance.attendancePct ?? '—'}{metrics.attendance.attendancePct != null ? '%' : ''}</p>
                    <p className="text-[10px] text-gray-500">Attendance ({metrics.attendance.activeDays}/{metrics.attendance.expectedDays} days)</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{metrics.patients.distinctClerked}</p>
                    <p className="text-[10px] text-gray-500">Patients clerked</p>
                  </div>
                </div>

                {/* Requirements checklist */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">
                    Posting requirements {metrics.eligibility.eligible
                      ? <span className="text-green-600">&middot; All met ✓</span>
                      : <span className="text-amber-600">&middot; {metrics.eligibility.notMet.length} outstanding</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {metrics.eligibility.met.map((m, i) => (
                      <span key={`m${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">✓ {m}</span>
                    ))}
                    {metrics.eligibility.notMet.map((m, i) => (
                      <span key={`n${i}`} className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600">✗ {m}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Days Left Banner */}
            <div className={`rounded-xl p-4 flex items-center gap-3 ${stats.daysLeft <= 7 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              <Clock className={`w-5 h-5 ${stats.daysLeft <= 7 ? 'text-red-500' : 'text-green-500'}`} />
              <div>
                <p className={`font-semibold ${stats.daysLeft <= 7 ? 'text-red-700' : 'text-green-700'}`}>
                  {stats.daysLeft} days remaining in posting
                </p>
                <p className="text-sm text-gray-500">Complete your clerkings and treatment plans before your posting ends</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setTab('patients')} className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-green-50 hover:border-green-300 text-left transition-colors">
                <Users className="w-6 h-6 text-green-600 mb-2" />
                <p className="font-semibold text-gray-900">View My Patients</p>
                <p className="text-sm text-gray-500">{stats.assignedPatients} assigned</p>
              </button>
              <button onClick={() => { setTab('clerking'); setClerkingForm(true); }} className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-blue-50 hover:border-blue-300 text-left transition-colors">
                <Plus className="w-6 h-6 text-blue-600 mb-2" />
                <p className="font-semibold text-gray-900">New Clerking</p>
                <p className="text-sm text-gray-500">Clerk a patient</p>
              </button>

              {/* The learning modules. Reachable on a student account now that
                  the router no longer swallows every path back to here. */}
              <button onClick={() => navigate('/mcq-education')} className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-purple-50 hover:border-purple-300 text-left transition-colors">
                <GraduationCap className="w-6 h-6 text-purple-600 mb-2" />
                <p className="font-semibold text-gray-900">MCQ &amp; Curriculum</p>
                <p className="text-sm text-gray-500">Practise questions, WACS topics</p>
              </button>
              <button onClick={() => navigate('/education')} className="bg-white border border-gray-200 rounded-xl p-4 hover:bg-amber-50 hover:border-amber-300 text-left transition-colors">
                <BookOpen className="w-6 h-6 text-amber-600 mb-2" />
                <p className="font-semibold text-gray-900">CME Articles</p>
                <p className="text-sm text-gray-500">Read and record progress</p>
              </button>
            </div>

            {/* Recent Evaluated Items */}
            {clerkings.filter(c => c.evaluation_score != null).length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Recent Evaluations</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {clerkings.filter(c => c.evaluation_score != null).slice(0, 5).map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{c.provisional_diagnosis || 'Clerking'}</p>
                        <p className="text-xs text-gray-500">{c.first_name} {c.last_name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${(c.evaluation_score || 0) >= 70 ? 'text-green-600' : (c.evaluation_score || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{c.evaluation_score}%</p>
                        {c.evaluation_feedback && <p className="text-xs text-gray-400 max-w-[200px] truncate">{c.evaluation_feedback}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ PATIENTS TAB ═══ */}
        {tab === 'patients' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Assigned Patients ({patients.length}/5)</h2>
            </div>
            {patients.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No patients assigned yet. Contact admin.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {patients.map(p => (
                  <div key={p.patient_id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{patientName(p)}</h3>
                        <p className="text-sm text-gray-500">{p.hospital_number}</p>
                      </div>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Active</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Ward: {p.ward_id || 'N/A'}</div>
                      <div className="flex items-center gap-1">Bed: {p.bed_number || 'N/A'}</div>
                      <div>Sex: {p.sex || 'N/A'}</div>
                      <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Assigned: {new Date(p.assigned_at).toLocaleDateString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setClerkingPatient(p); setClerkingForm(true); setTab('clerking'); }}
                        className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> Clerk
                      </button>
                      <button
                        onClick={() => { setPlanPatient(p); setPlanForm(true); setTab('plans'); }}
                        className="flex-1 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-1"
                      >
                        <Activity className="w-3.5 h-3.5" /> Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ CLERKINGS TAB ═══ */}
        {tab === 'clerking' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Clerkings</h2>
              <button onClick={() => setClerkingForm(true)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" /> New Clerking
              </button>
            </div>

            {/* New Clerking Form */}
            {clerkingForm && (
              <div className="bg-white rounded-xl border-2 border-blue-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" /> New Patient Clerking</h3>
                  <button onClick={() => { setClerkingForm(false); resetClerkingForm(); }} aria-label="Close form"><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                {/* Patient Select */}
                {!clerkingPatient ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {patients.map(p => (
                        <button key={p.patient_id} onClick={() => setClerkingPatient(p)}
                          className="p-3 border border-gray-200 rounded-lg text-left hover:bg-blue-50 hover:border-blue-300">
                          <p className="font-medium text-sm">{patientName(p)}</p>
                          <p className="text-xs text-gray-500">{p.hospital_number} · Ward {p.ward_id}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
                      <div><p className="font-medium text-sm text-blue-900">{patientName(clerkingPatient)}</p><p className="text-xs text-blue-600">{clerkingPatient.hospital_number}</p></div>
                      <button onClick={() => setClerkingPatient(null)} className="text-blue-400 hover:text-blue-600 text-xs" aria-label="Change patient">Change</button>
                    </div>

                    {/* History Fields */}
                    {([
                      ['chief_complaint', 'Chief Complaint *', true],
                      ['history_of_present_illness', 'History of Present Illness *', true],
                      ['past_medical_history', 'Past Medical History', true],
                      ['past_surgical_history', 'Past Surgical History', true],
                      ['family_history', 'Family History', false],
                      ['social_history', 'Social History', false],
                      ['drug_history', 'Drug History', false],
                      ['allergies', 'Allergies', false],
                    ] as const).map(([key, label, required]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <textarea
                          rows={key === 'history_of_present_illness' ? 4 : 2}
                          required={required as boolean}
                          value={cf[key]}
                          onChange={e => setCf({ ...cf, [key]: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder={`Enter ${label.toLowerCase().replace(' *', '')}`}
                        />
                      </div>
                    ))}

                    {/* Vital Signs */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Vital Signs</label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {['temperature', 'pulse', 'bp_systolic', 'bp_diastolic', 'respiratory_rate', 'spo2'].map(v => (
                          <input key={v} placeholder={v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            value={cf.vital_signs[v] || ''} onChange={e => setCf({ ...cf, vital_signs: { ...cf.vital_signs, [v]: e.target.value } })}
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm" title={v.replace(/_/g, ' ')} />
                        ))}
                      </div>
                    </div>

                    {/* Physical Examination */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Physical Examination</label>
                      <div className="grid gap-2">
                        {['general', 'head_neck', 'cardiovascular', 'respiratory', 'abdomen', 'musculoskeletal', 'neurological', 'local_examination'].map(sys => (
                          <div key={sys} className="flex gap-2 items-start">
                            <span className="text-xs font-medium text-gray-500 min-w-[100px] pt-2 capitalize">{sys.replace(/_/g, ' ')}</span>
                            <textarea rows={1} value={cf.physical_examination[sys] || ''}
                              onChange={e => setCf({ ...cf, physical_examination: { ...cf.physical_examination, [sys]: e.target.value } })}
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={`Findings...`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Diagnosis */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Provisional Diagnosis *</label>
                      <input required value={cf.provisional_diagnosis} onChange={e => setCf({ ...cf, provisional_diagnosis: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" placeholder="Primary diagnosis" />
                    </div>

                    {/* Differential Diagnoses */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Differential Diagnoses</label>
                      {cf.differential_diagnoses.map((d, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input value={d} onChange={e => { const arr = [...cf.differential_diagnoses]; arr[i] = e.target.value; setCf({ ...cf, differential_diagnoses: arr }); }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={`Differential ${i + 1}`} />
                          {i === cf.differential_diagnoses.length - 1 && (
                            <button type="button" onClick={() => setCf({ ...cf, differential_diagnoses: [...cf.differential_diagnoses, ''] })}
                              className="px-2 py-1 text-blue-600 text-sm hover:bg-blue-50 rounded" aria-label="Add differential">+</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Investigations */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Investigations Requested</label>
                      {cf.investigations_requested.map((inv, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input value={inv} onChange={e => { const arr = [...cf.investigations_requested]; arr[i] = e.target.value; setCf({ ...cf, investigations_requested: arr }); }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={`Investigation ${i + 1}`} />
                          {i === cf.investigations_requested.length - 1 && (
                            <button type="button" onClick={() => setCf({ ...cf, investigations_requested: [...cf.investigations_requested, ''] })}
                              className="px-2 py-1 text-blue-600 text-sm hover:bg-blue-50 rounded" aria-label="Add investigation">+</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Plan */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Management Plan</label>
                      <textarea rows={3} value={cf.plan} onChange={e => setCf({ ...cf, plan: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Outline your management plan..." />
                    </div>

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => submitClerking('draft')} disabled={savingClerking}
                        className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1">
                        <Save className="w-4 h-4" /> Save Draft
                      </button>
                      <button onClick={() => submitClerking('submitted')} disabled={savingClerking || !cf.chief_complaint || !cf.provisional_diagnosis}
                        className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1">
                        {savingClerking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit for Review
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Clerkings List */}
            {clerkings.length === 0 && !clerkingForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">You haven't clerked any patients yet</p>
                <button onClick={() => setClerkingForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Start Clerking</button>
              </div>
            ) : (
              <div className="space-y-3">
                {clerkings.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{c.provisional_diagnosis || 'Draft Clerking'}</p>
                        <p className="text-sm text-gray-500">{c.first_name} {c.last_name} · {c.hospital_number}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(c.status, c.evaluation_score)}
                        <button onClick={() => setViewClerking(c)} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="View clerking">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    {c.evaluation_feedback && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 mb-1">Evaluator Feedback ({c.evaluated_by}):</p>
                        <p className="text-sm text-blue-800">{c.evaluation_feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ TREATMENT PLANS TAB ═══ */}
        {tab === 'plans' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">My Treatment Plans</h2>
              <button onClick={() => setPlanForm(true)} className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
                <Plus className="w-4 h-4" /> New Plan
              </button>
            </div>

            {/* New Treatment Plan Form */}
            {planForm && (
              <div className="bg-white rounded-xl border-2 border-purple-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><Activity className="w-5 h-5 text-purple-600" /> New Treatment Plan</h3>
                  <button onClick={() => { setPlanForm(false); resetPlanForm(); }} aria-label="Close form"><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                {/* Patient Select */}
                {!planPatient ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
                    <div className="grid gap-2 md:grid-cols-2">
                      {patients.map(p => (
                        <button key={p.patient_id} onClick={() => setPlanPatient(p)}
                          className="p-3 border border-gray-200 rounded-lg text-left hover:bg-purple-50 hover:border-purple-300">
                          <p className="font-medium text-sm">{patientName(p)}</p>
                          <p className="text-xs text-gray-500">{p.hospital_number} · Ward {p.ward_id}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-purple-50 rounded-lg p-3 flex items-center justify-between">
                      <div><p className="font-medium text-sm text-purple-900">{patientName(planPatient)}</p><p className="text-xs text-purple-600">{planPatient.hospital_number}</p></div>
                      <button onClick={() => setPlanPatient(null)} className="text-purple-400 hover:text-purple-600 text-xs" aria-label="Change patient">Change</button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis *</label>
                      <input required value={pf.diagnosis} onChange={e => setPf({ ...pf, diagnosis: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Patient diagnosis" />
                    </div>

                    {/* Treatment Goals */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Goals</label>
                      {pf.treatment_goals.map((g, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input value={g} onChange={e => { const arr = [...pf.treatment_goals]; arr[i] = e.target.value; setPf({ ...pf, treatment_goals: arr }); }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={`Goal ${i + 1}`} />
                          {i === pf.treatment_goals.length - 1 && (
                            <button type="button" onClick={() => setPf({ ...pf, treatment_goals: [...pf.treatment_goals, ''] })}
                              className="px-2 py-1 text-purple-600 text-sm hover:bg-purple-50 rounded" aria-label="Add goal">+</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Medications */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Medications</label>
                      {pf.medications.map((m, i) => (
                        <div key={i} className="grid grid-cols-4 gap-1 mb-1">
                          <input value={m.name} onChange={e => { const arr = [...pf.medications]; arr[i] = { ...arr[i], name: e.target.value }; setPf({ ...pf, medications: arr }); }}
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Drug name" />
                          <input value={m.dose} onChange={e => { const arr = [...pf.medications]; arr[i] = { ...arr[i], dose: e.target.value }; setPf({ ...pf, medications: arr }); }}
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Dose" />
                          <input value={m.route} onChange={e => { const arr = [...pf.medications]; arr[i] = { ...arr[i], route: e.target.value }; setPf({ ...pf, medications: arr }); }}
                            className="px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Route" />
                          <div className="flex gap-1">
                            <input value={m.frequency} onChange={e => { const arr = [...pf.medications]; arr[i] = { ...arr[i], frequency: e.target.value }; setPf({ ...pf, medications: arr }); }}
                              className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder="Freq" />
                            {i === pf.medications.length - 1 && (
                              <button type="button" onClick={() => setPf({ ...pf, medications: [...pf.medications, { name: '', dose: '', route: '', frequency: '' }] })}
                                className="px-2 text-purple-600 text-sm" aria-label="Add medication">+</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Investigations */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Investigations</label>
                      {pf.investigations.map((inv, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input value={inv} onChange={e => { const arr = [...pf.investigations]; arr[i] = e.target.value; setPf({ ...pf, investigations: arr }); }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={`Investigation ${i + 1}`} />
                          {i === pf.investigations.length - 1 && (
                            <button type="button" onClick={() => setPf({ ...pf, investigations: [...pf.investigations, ''] })}
                              className="px-2 py-1 text-purple-600 text-sm hover:bg-purple-50 rounded" aria-label="Add investigation">+</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Procedures */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Procedures</label>
                      {pf.procedures.map((proc, i) => (
                        <div key={i} className="flex gap-2 mb-1">
                          <input value={proc} onChange={e => { const arr = [...pf.procedures]; arr[i] = e.target.value; setPf({ ...pf, procedures: arr }); }}
                            className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm" placeholder={`Procedure ${i + 1}`} />
                          {i === pf.procedures.length - 1 && (
                            <button type="button" onClick={() => setPf({ ...pf, procedures: [...pf.procedures, ''] })}
                              className="px-2 py-1 text-purple-600 text-sm hover:bg-purple-50 rounded" aria-label="Add procedure">+</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Nursing / Diet / Follow-up / Discharge */}
                    {([
                      ['nursing_care', 'Nursing Care Instructions'],
                      ['diet', 'Dietary Plan'],
                      ['follow_up_plan', 'Follow-up Plan'],
                      ['discharge_criteria', 'Discharge Criteria'],
                    ] as const).map(([key, label]) => (
                      <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                        <textarea rows={2} value={pf[key]}
                          onChange={e => setPf({ ...pf, [key]: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={`Enter ${label.toLowerCase()}`} />
                      </div>
                    ))}

                    {/* Submit Buttons */}
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => submitPlan('draft')} disabled={savingPlan}
                        className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center gap-1">
                        <Save className="w-4 h-4" /> Save Draft
                      </button>
                      <button onClick={() => submitPlan('submitted')} disabled={savingPlan || !pf.diagnosis}
                        className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1">
                        {savingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit for Review
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Plans List */}
            {plans.length === 0 && !planForm ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-3">No treatment plans yet</p>
                <button onClick={() => setPlanForm(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">Create Plan</button>
              </div>
            ) : (
              <div className="space-y-3">
                {plans.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{p.diagnosis || 'Draft Plan'}</p>
                        <p className="text-sm text-gray-500">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {statusBadge(p.status, p.evaluation_score)}
                        <button onClick={() => setViewPlan(p)} className="p-1.5 hover:bg-gray-100 rounded-lg" aria-label="View plan">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                    {p.evaluation_feedback && (
                      <div className="mt-3 p-3 bg-purple-50 rounded-lg">
                        <p className="text-xs font-medium text-purple-700 mb-1">Evaluator Feedback:</p>
                        <p className="text-sm text-purple-800">{p.evaluation_feedback}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ LEARNING & SIGN-OUT TAB ═══ */}
        {tab === 'learning' && (
          <div className="space-y-5">
            {/* Sign-out status */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Sign-out status</h3>
                {trainingSummary && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${trainingSummary.signOutEligible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {trainingSummary.signOutEligible ? 'Eligible to sign out' : 'Not yet eligible'}
                  </span>
                )}
              </div>
              {!trainingSummary ? (
                <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-green-600" /></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">CBT taken</p>
                    <p className="text-lg font-bold text-blue-700">{trainingSummary.training?.cbt ?? 0}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">CME articles read</p>
                    <p className="text-lg font-bold text-green-700">{trainingSummary.training?.cme ?? 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Self-assessments</p>
                    <p className="text-lg font-bold text-purple-700">{trainingSummary.training?.selfAssessment ?? 0}</p>
                  </div>
                </div>
              )}
              {trainingSummary && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Group activities (Group {trainingSummary.groupNumber ?? '—'})</p>
                    <ul className="space-y-0.5 text-xs">
                      {[...(trainingSummary.groupEligibility?.met || []).map((s: string) => ({ s, ok: true })),
                        ...(trainingSummary.groupEligibility?.notMet || []).map((s: string) => ({ s, ok: false }))].map((x, i) => (
                        <li key={i} className={`flex items-center gap-1 ${x.ok ? 'text-green-700' : 'text-gray-500'}`}>
                          {x.ok ? <Star className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} {x.s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-1">My learning</p>
                    <ul className="space-y-0.5 text-xs">
                      {[...(trainingSummary.individual?.met || []).map((s: string) => ({ s, ok: true })),
                        ...(trainingSummary.individual?.notMet || []).map((s: string) => ({ s, ok: false }))].map((x, i) => (
                        <li key={i} className={`flex items-center gap-1 ${x.ok ? 'text-green-700' : 'text-gray-500'}`}>
                          {x.ok ? <Star className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />} {x.s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* CBT + level */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-gray-900">Computer-Based Test (CBT)</h3>
                <p className="text-xs text-gray-500">Take the weekly CBT — your score counts toward sign-out.</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={learningLevel} onChange={e => setLearningLevel(e.target.value as TrainingLevel)}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white">
                  <option value="house_officer">House Officer</option>
                  <option value="junior_resident">Junior Resident</option>
                  <option value="senior_resident">Senior Resident</option>
                </select>
                <button onClick={() => setShowStudentCBT(true)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">Take CBT</button>
              </div>
            </div>

            {/* CME articles + self-assessment */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h3 className="font-semibold text-gray-900 mb-1">CME Articles & Self-Assessment</h3>
              <p className="text-xs text-gray-500 mb-3">Read each article, then take its self-assessment. Both count toward sign-out.</p>
              <div className="space-y-3">
                {medicalTrainingService.getModulesByLevel(learningLevel).map(mod => (
                  <div key={mod.id}>
                    <p className="text-sm font-semibold text-gray-700 mb-1">{mod.title}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {mod.topics.map(topic => (
                        <button key={topic.id} onClick={() => setLearningTopic(topic)}
                          className="text-left text-xs px-3 py-2 rounded-lg border border-gray-200 hover:bg-green-50 hover:border-green-300 flex items-center justify-between gap-2">
                          <span className="truncate">{topic.title}</span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">{topic.article?.selfAssessment?.length || 0} MCQs{completedTopics.has(String(topic.id)) ? ' ✓' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ═══ VIEW CLERKING MODAL ═══ */}
      {viewClerking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 mb-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Clerking Details</h3>
              <button onClick={() => setViewClerking(null)} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {viewClerking.evaluation_score != null && (
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">Score</span>
                  <span className={`text-2xl font-bold ${viewClerking.evaluation_score >= 70 ? 'text-green-600' : viewClerking.evaluation_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{viewClerking.evaluation_score}/100</span>
                </div>
                {viewClerking.evaluation_feedback && <p className="text-sm text-blue-800 mt-2">{viewClerking.evaluation_feedback}</p>}
                {viewClerking.evaluated_by && <p className="text-xs text-blue-600 mt-1">— {viewClerking.evaluated_by}</p>}
              </div>
            )}
            {([
              ['Chief Complaint', viewClerking.chief_complaint],
              ['History of Present Illness', viewClerking.history_of_present_illness],
              ['Past Medical History', viewClerking.past_medical_history],
              ['Past Surgical History', viewClerking.past_surgical_history],
              ['Family History', viewClerking.family_history],
              ['Social History', viewClerking.social_history],
              ['Drug History', viewClerking.drug_history],
              ['Allergies', viewClerking.allergies],
              ['Provisional Diagnosis', viewClerking.provisional_diagnosis],
              ['Plan', viewClerking.plan],
            ] as const).filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-500 uppercase">{label}</p>
                <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{value}</p>
              </div>
            ))}
            {viewClerking.vital_signs && Object.keys(viewClerking.vital_signs).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Vital Signs</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(viewClerking.vital_signs).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 rounded p-2"><span className="text-xs text-gray-400 capitalize">{k.replace(/_/g, ' ')}</span><p className="text-sm font-medium">{String(v)}</p></div>
                  ))}
                </div>
              </div>
            )}
            {viewClerking.physical_examination && Object.keys(viewClerking.physical_examination).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Physical Examination</p>
                {Object.entries(viewClerking.physical_examination).filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="mb-1"><span className="text-xs font-medium text-gray-500 capitalize">{k.replace(/_/g, ' ')}:</span> <span className="text-sm text-gray-700">{String(v)}</span></div>
                ))}
              </div>
            )}
            {viewClerking.differential_diagnoses?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Differential Diagnoses</p>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {(typeof viewClerking.differential_diagnoses === 'string' ? JSON.parse(viewClerking.differential_diagnoses) : viewClerking.differential_diagnoses).filter(Boolean).map((d: string, i: number) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            {viewClerking.investigations_requested?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Investigations Requested</p>
                <ul className="list-disc list-inside text-sm text-gray-700">
                  {(typeof viewClerking.investigations_requested === 'string' ? JSON.parse(viewClerking.investigations_requested) : viewClerking.investigations_requested).filter(Boolean).map((inv: string, i: number) => <li key={i}>{inv}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ VIEW PLAN MODAL ═══ */}
      {viewPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-10 overflow-y-auto p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 mb-10">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Treatment Plan Details</h3>
              <button onClick={() => setViewPlan(null)} aria-label="Close"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {viewPlan.evaluation_score != null && (
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-purple-700">Score</span>
                  <span className={`text-2xl font-bold ${viewPlan.evaluation_score >= 70 ? 'text-green-600' : viewPlan.evaluation_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{viewPlan.evaluation_score}/100</span>
                </div>
                {viewPlan.evaluation_feedback && <p className="text-sm text-purple-800 mt-2">{viewPlan.evaluation_feedback}</p>}
              </div>
            )}
            <div><p className="text-xs font-semibold text-gray-500 uppercase">Diagnosis</p><p className="text-sm text-gray-800 mt-0.5">{viewPlan.diagnosis}</p></div>
            {viewPlan.treatment_goals?.length > 0 && (
              <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Treatment Goals</p>
                <ul className="list-disc list-inside text-sm text-gray-700">{(typeof viewPlan.treatment_goals === 'string' ? JSON.parse(viewPlan.treatment_goals) : viewPlan.treatment_goals).filter(Boolean).map((g: string, i: number) => <li key={i}>{g}</li>)}</ul></div>
            )}
            {viewPlan.medications?.length > 0 && (
              <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Medications</p>
                <div className="space-y-1">{(typeof viewPlan.medications === 'string' ? JSON.parse(viewPlan.medications) : viewPlan.medications).filter((m: any) => m.name || m).map((m: any, i: number) => (
                  <p key={i} className="text-sm text-gray-700">{typeof m === 'string' ? m : `${m.name} ${m.dose} ${m.route} ${m.frequency}`}</p>
                ))}</div></div>
            )}
            {viewPlan.procedures?.length > 0 && (
              <div><p className="text-xs font-semibold text-gray-500 uppercase mb-1">Procedures</p>
                <ul className="list-disc list-inside text-sm text-gray-700">{(typeof viewPlan.procedures === 'string' ? JSON.parse(viewPlan.procedures) : viewPlan.procedures).filter(Boolean).map((p: string, i: number) => <li key={i}>{typeof p === 'string' ? p : (p as any).name || JSON.stringify(p)}</li>)}</ul></div>
            )}
            {([
              ['Nursing Care', viewPlan.nursing_care],
              ['Diet', viewPlan.diet],
              ['Follow-up Plan', viewPlan.follow_up_plan],
              ['Discharge Criteria', viewPlan.discharge_criteria],
            ] as const).filter(([, v]) => v).map(([label, value]) => (
              <div key={label}><p className="text-xs font-semibold text-gray-500 uppercase">{label}</p><p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{value}</p></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
