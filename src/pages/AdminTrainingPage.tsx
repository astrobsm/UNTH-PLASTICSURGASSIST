import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, AlertTriangle, CheckCircle, Clock, XCircle,
  Send, Eye, BarChart3, Shield,
  User, Activity, BookOpen, ClipboardCheck, Calendar, 
  Bell, ArrowLeft, RefreshCw, Target, MessageCircle, Phone,
} from 'lucide-react';
import { apiClient } from '../services/apiClient';
import { useCrossTabRefresh } from '../utils/crossTabSync';

// ── Types ──
interface TraineeMetrics {
  cbtTestsCompleted: number;
  cbtAvgScore: number;
  patientEntries: number;
  patientScore: number;
  dutiesCompleted: number;
  dutyScore: number;
  loginDays: number;
  attendanceScore: number;
  cmeTopicsCompleted: number;
  overallScore: number;
}

interface Rotation {
  id: number;
  level: string;
  start_date: string;
  expected_end_date: string;
  status: string;
  extension_count: number;
}

interface Eligibility {
  eligible: boolean;
  met: string[];
  notMet: string[];
}

interface Requirements {
  cbtTests: number;
  patientEntries: number;
  duties: number;
  loginDays: number;
  cmeTopics: number;
  overallScore: number;
}

interface Trainee {
  id: number;
  username: string;
  full_name: string;
  role: string;
  email: string;
  registered_at: string;
  level: string;
  phone: string | null;
  metrics: TraineeMetrics;
  rotation: Rotation | null;
  requirements: Requirements;
  eligibility: Eligibility;
  unreadWarnings: number;
}

interface Warning {
  id: number;
  user_id: number;
  sent_by: number;
  warning_type: string;
  subject: string;
  message: string;
  severity: string;
  read: boolean;
  created_at: string;
  sent_by_name: string;
  recipient_name: string;
}

type ViewMode = 'overview' | 'detail';
type FilterLevel = 'all' | 'house_officer' | 'junior_resident' | 'senior_resident';

const LEVEL_LABELS: Record<string, string> = {
  house_officer: 'House Officer',
  junior_resident: 'Registrar',
  senior_resident: 'Senior Registrar',
};

const LEVEL_COLORS: Record<string, string> = {
  house_officer: 'blue',
  junior_resident: 'green',
  senior_resident: 'purple',
};

const AdminTrainingPage: React.FC = () => {
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<FilterLevel>('all');
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningTarget, setWarningTarget] = useState<Trainee | null>(null);
  const [warningForm, setWarningForm] = useState({ subject: '', message: '', severity: 'warning', warningType: 'performance' });
  const [sendingWarning, setSendingWarning] = useState(false);
  const [expandedTrainee, setExpandedTrainee] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppTarget, setWhatsAppTarget] = useState<Trainee | null>(null);
  const [whatsAppPhone, setWhatsAppPhone] = useState('');
  const [whatsAppMessage, setWhatsAppMessage] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const fetchTrainees = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const data = await apiClient.request<{ trainees: Trainee[] }>('/admin-training?action=all-trainees');
      setTrainees(data.trainees);
    } catch (err: any) {
      if (!opts?.silent) setError(err.message || 'Failed to load trainees');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrainees(); }, [fetchTrainees]);

  // Real-time-lite monitoring: refresh trainee metrics on tab focus, on a gentle
  // poll, and when another tab/device signals a training change. Silent refreshes
  // don't flash the page loader.
  useCrossTabRefresh('training', () => fetchTrainees({ silent: true }));
  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === 'visible') fetchTrainees({ silent: true }); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTrainees({ silent: true });
    }, 45000);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(poll);
    };
  }, [fetchTrainees]);

  const fetchTraineeDetail = async (trainee: Trainee) => {
    try {
      const data = await apiClient.request<any>(`/admin-training?action=trainee-detail&userId=${trainee.id}`);
      setDetailData(data);
      setSelectedTrainee(trainee);
      setViewMode('detail');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSendWarning = async () => {
    if (!warningTarget || !warningForm.subject || !warningForm.message) return;
    setSendingWarning(true);
    try {
      await apiClient.request('/admin-training?action=send-warning', {
        method: 'POST',
        body: JSON.stringify({
          userId: warningTarget.id,
          warningType: warningForm.warningType,
          subject: warningForm.subject,
          message: warningForm.message,
          severity: warningForm.severity,
        }),
      });
      setShowWarningModal(false);
      setWarningForm({ subject: '', message: '', severity: 'warning', warningType: 'performance' });
      fetchTrainees();
    } catch (err: any) {
      alert('Failed to send warning: ' + err.message);
    } finally {
      setSendingWarning(false);
    }
  };

  const handleStartRotation = async (trainee: Trainee) => {
    if (!confirm(`Start rotation for ${trainee.full_name} as ${LEVEL_LABELS[trainee.level]}?`)) return;
    try {
      await apiClient.request('/admin-training?action=start-rotation', {
        method: 'POST',
        body: JSON.stringify({ userId: trainee.id, level: trainee.level }),
      });
      fetchTrainees();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const handleExtendRotation = async (rotationId: number) => {
    const reason = prompt('Reason for extension:');
    if (!reason) return;
    try {
      await apiClient.request('/admin-training?action=extend-rotation', {
        method: 'POST',
        body: JSON.stringify({ rotationId, reason }),
      });
      fetchTrainees();
      if (selectedTrainee) fetchTraineeDetail(selectedTrainee);
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const handleApproveSignout = async (rotationId: number, approved: boolean) => {
    const comments = prompt(approved ? 'Approval comments:' : 'Rejection reason:');
    try {
      await apiClient.request('/admin-training?action=approve-signout', {
        method: 'POST',
        body: JSON.stringify({ rotationId, approved, comments: comments || '' }),
      });
      fetchTrainees();
      if (selectedTrainee) fetchTraineeDetail(selectedTrainee);
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const filteredTrainees = trainees.filter(t => {
    const matchesSearch = !searchQuery || t.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || t.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === 'all' || t.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  // Summary stats
  const totalTrainees = trainees.length;
  const eligibleCount = trainees.filter(t => t.eligibility.eligible).length;
  const atRiskCount = trainees.filter(t => t.metrics.overallScore < 50 && t.metrics.overallScore > 0).length;
  const noActivityCount = trainees.filter(t => t.metrics.overallScore === 0).length;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-100 border-green-300';
    if (score >= 50) return 'bg-yellow-100 border-yellow-300';
    return 'bg-red-100 border-red-300';
  };

  const getStatusBadge = (trainee: Trainee) => {
    if (trainee.eligibility.eligible) return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">Eligible</span>;
    if (trainee.metrics.overallScore >= 50) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">In Progress</span>;
    if (trainee.metrics.overallScore > 0) return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">At Risk</span>;
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">No Activity</span>;
  };

  // ── Detail View ──
  if (viewMode === 'detail' && selectedTrainee && detailData) {
    const t = detailData.trainee;
    const m = t.metrics;
    const r = t.requirements;

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Back button */}
          <button onClick={() => setViewMode('overview')} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4">
            <ArrowLeft className="w-5 h-5" /> Back to Overview
          </button>

          {/* Header */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full bg-${LEVEL_COLORS[t.level]}-100 flex items-center justify-center`}>
                  <User className={`w-7 h-7 text-${LEVEL_COLORS[t.level]}-600`} />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{t.full_name}</h1>
                  <p className="text-gray-500">{LEVEL_LABELS[t.level]} &bull; @{t.username}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {getStatusBadge(selectedTrainee)}
                <button
                  onClick={() => { setWarningTarget(selectedTrainee); setShowWarningModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium"
                >
                  <Bell className="w-4 h-4" /> Send Warning
                </button>
              </div>
            </div>
          </div>

          {/* Overall Score */}
          <div className={`rounded-xl border-2 p-6 mb-6 ${getScoreBg(m.overallScore)}`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Overall Performance Score</h2>
                <p className="text-sm text-gray-600">Weighted: CBT 30% + Patients 35% + Duties 25% + Attendance 10%</p>
              </div>
              <div className={`text-4xl font-bold ${getScoreColor(m.overallScore)}`}>{m.overallScore}%</div>
            </div>
            <div className="mt-4 h-3 bg-white/60 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${m.overallScore}%` }} />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <MetricCard icon={<ClipboardCheck className="w-5 h-5" />} label="CBT Tests" value={`${m.cbtTestsCompleted}/${r.cbtTests}`} score={m.cbtAvgScore} color="blue" />
            <MetricCard icon={<Activity className="w-5 h-5" />} label="Patients" value={`${m.patientEntries}/${r.patientEntries}`} score={m.patientScore} color="green" />
            <MetricCard icon={<Target className="w-5 h-5" />} label="Duties" value={`${m.dutiesCompleted}/${r.duties}`} score={m.dutyScore} color="purple" />
            <MetricCard icon={<Calendar className="w-5 h-5" />} label="Attendance" value={`${m.loginDays}/${r.loginDays} days`} score={m.attendanceScore} color="amber" />
            <MetricCard icon={<BookOpen className="w-5 h-5" />} label="CME Topics" value={`${m.cmeTopicsCompleted}/${r.cmeTopics}`} score={Math.min(100, (m.cmeTopicsCompleted / r.cmeTopics) * 100)} color="rose" />
          </div>

          {/* Sign-out Eligibility */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-600" /> Sign-out Eligibility
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Requirements Met
                </h4>
                {t.eligibility.met.length > 0 ? (
                  <ul className="space-y-1">
                    {t.eligibility.met.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded">{item}</li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400">None yet</p>}
              </div>
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                  <XCircle className="w-4 h-4" /> Requirements Not Met
                </h4>
                {t.eligibility.notMet.length > 0 ? (
                  <ul className="space-y-1">
                    {t.eligibility.notMet.map((item: string, i: number) => (
                      <li key={i} className="text-sm text-red-700 bg-red-50 px-3 py-1.5 rounded">{item}</li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-gray-400">All requirements met!</p>}
              </div>
            </div>

            {/* Rotation actions */}
            {t.rotation && (
              <div className="mt-4 pt-4 border-t flex flex-wrap gap-3">
                <div className="text-sm text-gray-600">
                  Rotation: {t.rotation.status} | Ends: {new Date(t.rotation.expected_end_date).toLocaleDateString()} | Extensions: {t.rotation.extension_count}
                </div>
                <button onClick={() => handleExtendRotation(t.rotation.id)} className="px-3 py-1.5 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded text-sm font-medium">Extend</button>
                {t.rotation.status === 'pending_signout' && (
                  <>
                    <button onClick={() => handleApproveSignout(t.rotation.id, true)} className="px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm font-medium">Approve Sign-out</button>
                    <button onClick={() => handleApproveSignout(t.rotation.id, false)} className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-sm font-medium">Reject</button>
                  </>
                )}
              </div>
            )}
            {!t.rotation && (
              <div className="mt-4 pt-4 border-t">
                <button onClick={() => handleStartRotation(selectedTrainee)} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600">Start Rotation</button>
              </div>
            )}
          </div>

          {/* CBT Attempts */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-600" /> CBT Attempts
            </h3>
            {detailData.cbtAttempts?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-2 pr-4">Test</th>
                      <th className="pb-2 pr-4">Score</th>
                      <th className="pb-2 pr-4">%</th>
                      <th className="pb-2 pr-4">Pass</th>
                      <th className="pb-2">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.cbtAttempts.map((a: any) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-medium">Test {a.test_number || a.testNumber}</td>
                        <td className="py-2 pr-4">{a.score}/{a.total_marks || a.totalMarks}</td>
                        <td className={`py-2 pr-4 font-semibold ${Number(a.percentage || 0) >= 75 ? 'text-green-600' : 'text-red-600'}`}>{Number(a.percentage || 0).toFixed(0)}%</td>
                        <td className="py-2 pr-4">{a.passed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}</td>
                        <td className="py-2 text-gray-500">{a.created_at ? new Date(a.created_at).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No CBT attempts yet</p>
            )}
          </div>

          {/* Warnings Sent */}
          <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Warning History
            </h3>
            {detailData.warnings?.length > 0 ? (
              <div className="space-y-3">
                {detailData.warnings.map((w: Warning) => (
                  <div key={w.id} className={`p-3 rounded-lg border ${w.severity === 'critical' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{w.subject}</p>
                        <p className="text-sm text-gray-600 mt-1">{w.message}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div>{new Date(w.created_at).toLocaleDateString()}</div>
                        <div>by {w.sent_by_name}</div>
                        {w.read && <span className="text-green-600">Read</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No warnings sent</p>
            )}
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-gray-600" /> Recent Activities
            </h3>
            {detailData.activities?.length > 0 ? (
              <div className="space-y-2">
                {detailData.activities.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 bg-gray-100 rounded font-mono">{a.activity_type}</span>
                      <span className="text-sm text-gray-700">{a.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{a.points > 0 ? `+${a.points}pts` : ''}</span>
                      <span className="text-xs text-gray-500">{new Date(a.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No recent activities</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Overview ──
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-green-600" /> Training Management
          </h1>
          <p className="text-gray-500 mt-1">Monitor trainee progress, send warnings, and manage sign-out eligibility</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalTrainees}</div>
                <div className="text-xs text-gray-500">Total Trainees</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{eligibleCount}</div>
                <div className="text-xs text-gray-500">Sign-out Eligible</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{atRiskCount}</div>
                <div className="text-xs text-gray-500">At Risk</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">{noActivityCount}</div>
                <div className="text-xs text-gray-500">No Activity</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border p-4 mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'house_officer', 'junior_resident', 'senior_resident'] as FilterLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  levelFilter === level ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {level === 'all' ? 'All' : LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
          {/* Wrapped: passing fetchTrainees directly hands React's MouseEvent
              in as `opts`, so a future `if (opts)` check would silently take
              the silent-refresh branch on a user click. */}
          <button onClick={() => fetchTrainees()} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-600">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-red-700">{error}</div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-green-500 mb-3" />
            <p className="text-gray-500">Loading trainees...</p>
          </div>
        )}

        {/* Trainees Table */}
        {!loading && filteredTrainees.length > 0 && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50 border-b">
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Trainee</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3 text-center">Overall</th>
                    <th className="px-4 py-3 text-center">CBT</th>
                    <th className="px-4 py-3 text-center">Patients</th>
                    <th className="px-4 py-3 text-center">Duties</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTrainees.map(t => (
                    <React.Fragment key={t.id}>
                      <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedTrainee(expandedTrainee === t.id ? null : t.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full bg-${LEVEL_COLORS[t.level]}-100 flex items-center justify-center flex-shrink-0`}>
                              <User className={`w-4 h-4 text-${LEVEL_COLORS[t.level]}-600`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate">{t.full_name}</p>
                            </div>
                            {t.unreadWarnings > 0 && (
                              <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full">{t.unreadWarnings}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium bg-${LEVEL_COLORS[t.level]}-100 text-${LEVEL_COLORS[t.level]}-700`}>
                            {LEVEL_LABELS[t.level]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-lg font-bold ${getScoreColor(t.metrics.overallScore)}`}>{t.metrics.overallScore}%</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-sm">{t.metrics.cbtTestsCompleted}/{t.requirements.cbtTests}</div>
                          <div className="text-xs text-gray-400">{Number(t.metrics.cbtAvgScore).toFixed(0)}% avg</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-sm">{t.metrics.patientEntries}/{t.requirements.patientEntries}</div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="text-sm">{t.metrics.dutiesCompleted}/{t.requirements.duties}</div>
                        </td>
                        <td className="px-4 py-3 text-center">{getStatusBadge(t)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); fetchTraineeDetail(t); }}
                              className="p-1.5 hover:bg-blue-100 rounded text-blue-600" title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setWarningTarget(t); setShowWarningModal(true); }}
                              className="p-1.5 hover:bg-amber-100 rounded text-amber-600" title="Send Warning"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setWhatsAppTarget(t);
                                setWhatsAppPhone(t.phone || '');
                                const statusMsg = t.metrics.overallScore === 0
                                  ? `Hi ${t.full_name}, this is a reminder from the Plastic Surgery Training Program. You have NO recorded activity yet. Please log in to the app and begin your clinical tasks, CBT tests, and duty assignments immediately.`
                                  : `Hi ${t.full_name}, this is an update from the Plastic Surgery Training Program.\n\nYour current performance:\n- Overall Score: ${t.metrics.overallScore}%\n- CBT Tests: ${t.metrics.cbtTestsCompleted}/${t.requirements.cbtTests}\n- Patient Entries: ${t.metrics.patientEntries}/${t.requirements.patientEntries}\n- Duties: ${t.metrics.dutiesCompleted}/${t.requirements.duties}\n\n${t.metrics.overallScore < 50 ? 'Your performance is below expectations. Please improve your engagement urgently.' : 'Keep up the good work! Continue to meet your targets.'}`;
                                setWhatsAppMessage(statusMsg);
                                setShowWhatsAppModal(true);
                              }}
                              className="p-1.5 hover:bg-green-100 rounded text-green-600" title="WhatsApp Status"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row */}
                      {expandedTrainee === t.id && (
                        <tr>
                          <td colSpan={8} className="px-4 py-4 bg-gray-50">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                              <MiniMetric label="CBT Score" value={`${Number(t.metrics.cbtAvgScore).toFixed(0)}%`} sub={`${t.metrics.cbtTestsCompleted}/${t.requirements.cbtTests} tests`} />
                              <MiniMetric label="Patient Care" value={`${Number(t.metrics.patientScore).toFixed(0)}%`} sub={`${t.metrics.patientEntries}/${t.requirements.patientEntries} entries`} />
                              <MiniMetric label="Duties" value={`${Number(t.metrics.dutyScore).toFixed(0)}%`} sub={`${t.metrics.dutiesCompleted}/${t.requirements.duties} done`} />
                              <MiniMetric label="Attendance" value={`${Number(t.metrics.attendanceScore).toFixed(0)}%`} sub={`${t.metrics.loginDays}/${t.requirements.loginDays} days`} />
                              <MiniMetric label="CME Topics" value={`${t.metrics.cmeTopicsCompleted}`} sub={`of ${t.requirements.cmeTopics} topics`} />
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {t.eligibility.notMet.map((item, i) => (
                                <span key={i} className="px-2 py-1 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{item}</span>
                              ))}
                              {t.eligibility.met.map((item, i) => (
                                <span key={i} className="px-2 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded">{item}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && filteredTrainees.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-lg">No trainees found</p>
            <p className="text-gray-400 text-sm mt-1">There are no registered trainees matching your filters</p>
          </div>
        )}
      </div>

      {/* Warning Modal */}
      {showWarningModal && warningTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" /> Send Warning to {warningTarget.full_name}
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Warning Type</label>
                <select
                  value={warningForm.warningType}
                  onChange={(e) => setWarningForm(f => ({ ...f, warningType: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                >
                  <option value="performance">Performance</option>
                  <option value="attendance">Attendance</option>
                  <option value="cbt">CBT Progress</option>
                  <option value="duties">Duty Completion</option>
                  <option value="patient_care">Patient Care</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <div className="flex gap-2">
                  {['info', 'warning', 'critical'].map(s => (
                    <button
                      key={s}
                      onClick={() => setWarningForm(f => ({ ...f, severity: s }))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        warningForm.severity === s
                          ? s === 'critical' ? 'bg-red-500 text-white' : s === 'warning' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={warningForm.subject}
                  onChange={(e) => setWarningForm(f => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g., Low CBT Performance"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={warningForm.message}
                  onChange={(e) => setWarningForm(f => ({ ...f, message: e.target.value }))}
                  rows={4}
                  placeholder="Describe the concern and any recommended actions..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
              {/* Quick templates */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Quick templates:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Low CBT Score', subject: 'Low CBT Performance Warning', message: 'Your CBT test scores are below the required threshold. Please review the CME materials and prepare better for upcoming tests. Continued low performance may affect your sign-out eligibility.' },
                    { label: 'Missing Duties', subject: 'Incomplete Duty Assignments', message: 'Several duty assignments remain incomplete. Please address pending duties promptly. Duty completion is a key requirement for rotation sign-out.' },
                    { label: 'Low Attendance', subject: 'Attendance Warning', message: 'Your attendance record is below expectations. Regular engagement with the platform is required for tracking clinical participation and sign-out eligibility.' },
                    { label: 'Patient Care Gap', subject: 'Patient Care Documentation Gap', message: 'Your patient care documentation entries are significantly below the required target. Please ensure all patient encounters are properly documented.' },
                  ].map(tmpl => (
                    <button
                      key={tmpl.label}
                      onClick={() => setWarningForm(f => ({ ...f, subject: tmpl.subject, message: tmpl.message }))}
                      className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs text-gray-600"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button onClick={() => { setShowWarningModal(false); setWarningForm({ subject: '', message: '', severity: 'warning', warningType: 'performance' }); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
                Cancel
              </button>
              <button
                onClick={handleSendWarning}
                disabled={!warningForm.subject || !warningForm.message || sendingWarning}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {sendingWarning ? 'Sending...' : 'Send Warning'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Status Modal */}
      {showWhatsAppModal && whatsAppTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-500" /> WhatsApp Status to {whatsAppTarget.full_name}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Send a WhatsApp message about their training status</p>
            </div>
            <div className="p-6 space-y-4">
              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-3.5 h-3.5 inline mr-1" />
                  Phone Number (with country code)
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={whatsAppPhone}
                    onChange={(e) => setWhatsAppPhone(e.target.value)}
                    placeholder="e.g. 2348012345678"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500"
                  />
                  <button
                    onClick={async () => {
                      if (!whatsAppPhone.trim()) return;
                      setSavingPhone(true);
                      try {
                        await apiClient.request('/admin-training?action=update-phone', {
                          method: 'POST',
                          body: JSON.stringify({ userId: whatsAppTarget.id, phone: whatsAppPhone.trim() }),
                        });
                        setTrainees(prev => prev.map(t =>
                          t.id === whatsAppTarget.id ? { ...t, phone: whatsAppPhone.trim() } : t
                        ));
                      } catch (err: any) {
                        console.error('Failed to save phone:', err);
                      } finally {
                        setSavingPhone(false);
                      }
                    }}
                    disabled={savingPhone || !whatsAppPhone.trim()}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
                    title="Save phone number"
                  >
                    {savingPhone ? '...' : 'Save'}
                  </button>
                </div>
                {!whatsAppPhone && (
                  <p className="text-xs text-amber-600 mt-1">No phone number on file. Enter the number to send a WhatsApp message.</p>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={whatsAppMessage}
                  onChange={(e) => setWhatsAppMessage(e.target.value)}
                  rows={6}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>

              {/* Quick templates */}
              <div>
                <p className="text-xs text-gray-400 mb-2">Quick templates:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'No Activity', msg: `Hi ${whatsAppTarget.full_name}, you have NO recorded activity on the Plastic Surgery Training App. Please log in immediately and begin your tasks. This is important for your rotation sign-out.` },
                    { label: 'Low Score', msg: `Hi ${whatsAppTarget.full_name}, your overall training score is ${whatsAppTarget.metrics.overallScore}%, which is below expectations. Please focus on: CBT tests (${whatsAppTarget.metrics.cbtTestsCompleted}/${whatsAppTarget.requirements.cbtTests}), Patient entries (${whatsAppTarget.metrics.patientEntries}/${whatsAppTarget.requirements.patientEntries}), and Duties (${whatsAppTarget.metrics.dutiesCompleted}/${whatsAppTarget.requirements.duties}).` },
                    { label: 'Encouragement', msg: `Hi ${whatsAppTarget.full_name}, great work on your training progress! Your current score is ${whatsAppTarget.metrics.overallScore}%. Keep it up and continue meeting your targets for a smooth sign-out.` },
                    { label: 'Deadline Reminder', msg: `Hi ${whatsAppTarget.full_name}, this is a reminder that your rotation requirements must be completed before your sign-out date. Current progress: Overall ${whatsAppTarget.metrics.overallScore}%. Please prioritize any outstanding tasks.` },
                  ].map(tmpl => (
                    <button
                      key={tmpl.label}
                      onClick={() => setWhatsAppMessage(tmpl.msg)}
                      className="px-2 py-1 bg-green-50 hover:bg-green-100 border border-green-200 rounded text-xs text-green-700"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 rounded-lg p-3 border">
                <p className="text-xs font-medium text-gray-500 mb-1">Preview:</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{whatsAppMessage}</p>
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => { setShowWhatsAppModal(false); setWhatsAppTarget(null); setWhatsAppMessage(''); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const phone = whatsAppPhone.replace(/[^0-9]/g, '');
                  if (!phone) {
                    alert('Please enter a phone number first.');
                    return;
                  }
                  const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsAppMessage)}`;
                  window.open(url, '_blank');
                }}
                disabled={!whatsAppPhone.trim() || !whatsAppMessage.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Open WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string; score: number; color: string }> = ({ icon, label, value, score, color }) => (
  <div className="bg-white rounded-xl border p-4">
    <div className="flex items-center gap-2 mb-2 text-gray-500">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full bg-${color}-500 transition-all duration-500`} style={{ width: `${Math.min(100, score)}%` }} />
    </div>
    <div className="text-xs text-gray-400 mt-1">{Number(score).toFixed(0)}%</div>
  </div>
);

const MiniMetric: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="bg-white rounded-lg border p-3 text-center">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
    <div className="text-xs text-gray-400">{sub}</div>
  </div>
);

export default AdminTrainingPage;
