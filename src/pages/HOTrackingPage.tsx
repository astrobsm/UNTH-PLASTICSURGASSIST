import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, CheckCircle, XCircle, Clock, ArrowLeft, RefreshCw,
  Activity, BookOpen, ClipboardCheck, TrendingUp, Award, Target,
  FileText, FlaskConical, Pill, Eye, ChevronRight, AlertTriangle,
  Calendar, BarChart3, Shield, User, Stethoscope, LogOut,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { hoTrackingService, HOProfile, HODetail } from '../services/hoTrackingService';
import { apiClient } from '../services/apiClient';
import { useCrossTabRefresh } from '../utils/crossTabSync';
import { useNavigate } from 'react-router-dom';

type ViewMode = 'overview' | 'detail';
type Tab = 'summary' | 'documentation' | 'cbt' | 'cme' | 'patients' | 'eligibility';

const ADMIN_ROLES = ['admin', 'consultant', 'senior_registrar'];

const HOTrackingPage: React.FC = () => {
  const { user } = useAuthStore();
  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;
  const isHO = user?.role === 'house_officer';

  const [viewMode, setViewMode] = useState<ViewMode>(isAdmin ? 'overview' : 'detail');
  const [houseOfficers, setHouseOfficers] = useState<HOProfile[]>([]);
  const [selectedHO, setSelectedHO] = useState<HODetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [sortBy, setSortBy] = useState<'overall' | 'cbt' | 'patients' | 'name'>('overall');
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [signOutMsg, setSignOutMsg] = useState<string | null>(null);

  const loadAllHOs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const hos = await hoTrackingService.getAllHouseOfficers();
      setHouseOfficers(hos);
    } catch (err: any) {
      if (!opts?.silent) setError(err.message || 'Failed to load house officers');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const [distributing, setDistributing] = useState(false);
  const distributeAdmittedPatients = async () => {
    if (!confirm('Distribute all currently-admitted patients evenly across the active house officers? Existing assignments for those patients will be updated.')) return;
    setDistributing(true);
    try {
      const data = await apiClient.request('/users/distribute-patients', {
        method: 'POST',
        body: JSON.stringify({ scope: 'admitted' }),
      });
      alert(data.message || `Distributed ${data.assigned} patients.`);
      await loadAllHOs({ silent: true });
    } catch (err: any) {
      alert(err.message || 'Distribution failed');
    } finally {
      setDistributing(false);
    }
  };

  const loadHODetail = useCallback(async (hoId: number | string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await hoTrackingService.getHODetail(hoId);
      if (detail) {
        setSelectedHO(detail);
        setViewMode('detail');
        setActiveTab('summary');
      } else {
        setError('House officer not found');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAllHOs();
    } else if (isHO && user) {
      loadHODetail(user.id);
    }
  }, [isAdmin, isHO, user, loadAllHOs, loadHODetail]);

  // Real-time-lite monitoring: refresh on tab focus, a gentle poll, and cross-tab
  // training signals so metrics stay current without a manual refresh.
  useCrossTabRefresh('training', () => {
    if (isAdmin) loadAllHOs({ silent: true });
    else if (isHO && user) loadHODetail(user.id);
  });
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (isAdmin && viewMode === 'overview') loadAllHOs({ silent: true });
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const poll = setInterval(refresh, 45000);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(poll);
    };
  }, [isAdmin, viewMode, loadAllHOs]);

  const handleSelectHO = (ho: HOProfile) => {
    loadHODetail(ho.id);
  };

  const handleBack = () => {
    setViewMode('overview');
    setSelectedHO(null);
    setActiveTab('summary');
  };

  const handleRequestSignOut = async () => {
    if (!confirm('Request sign-out for your current rotation? This will be reviewed by your supervisor.')) return;
    setSignOutLoading(true);
    setSignOutMsg(null);
    try {
      const result = await hoTrackingService.requestSignOut();
      setSignOutMsg(result.message || 'Sign-out requested successfully');
    } catch (err: any) {
      setSignOutMsg(`Error: ${err.message || 'Failed to request sign-out'}`);
    } finally {
      setSignOutLoading(false);
    }
  };

  const handleApproveSignOut = async (rotationId: number, approved: boolean) => {
    const comments = prompt(approved ? 'Approval comments (optional):' : 'Reason for rejection:');
    if (!approved && !comments) return;
    try {
      const ho = selectedHO?.houseOfficer;
      await hoTrackingService.approveSignOut(
        rotationId, approved, comments || '',
        approved ? ho?.metrics.overallScore : undefined
      );
      setSignOutMsg(approved ? 'Sign-out approved' : 'Sign-out rejected');
      if (selectedHO) loadHODetail(selectedHO.houseOfficer.id);
    } catch (err: any) {
      setSignOutMsg(`Error: ${err.message}`);
    }
  };

  const filteredHOs = houseOfficers.filter(ho =>
    // Never show deactivated staff, even if a stale/cached list includes them
    (ho as any).is_active !== false &&
    (ho.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ho.email || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const sortedHOs = [...filteredHOs].sort((a, b) => {
    switch (sortBy) {
      case 'cbt': return b.metrics.cbtAvgScore - a.metrics.cbtAvgScore;
      case 'patients': return b.metrics.patientEntries - a.metrics.patientEntries;
      case 'name': return a.full_name.localeCompare(b.full_name);
      case 'overall':
      default: return b.metrics.overallScore - a.metrics.overallScore;
    }
  });

  // Cohort-level analytics across all (unfiltered) house officers
  const cohort = (() => {
    const n = houseOfficers.length;
    if (n === 0) return null;
    const sum = (sel: (h: HOProfile) => number) => houseOfficers.reduce((t, h) => t + sel(h), 0);
    const top = [...houseOfficers].sort((a, b) => b.metrics.overallScore - a.metrics.overallScore)[0];
    return {
      total: n,
      eligible: houseOfficers.filter(h => h.eligibility.eligible).length,
      avgOverall: Math.round(sum(h => h.metrics.overallScore) / n),
      avgCbt: Math.round(sum(h => h.metrics.cbtAvgScore) / n),
      totalPatients: sum(h => h.metrics.patientEntries),
      topPerformer: top,
    };
  })();

  const scoreColor = (score: number, max: number = 100) => {
    const pct = (score / max) * 100;
    if (pct >= 75) return 'text-green-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const progressBar = (value: number, max: number, color: string = 'bg-primary-500') => {
    const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
    return (
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 75 ? color : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
             style={{ width: `${pct}%` }} />
      </div>
    );
  };

  // ──────── OVERVIEW: All HOs ────────
  if (viewMode === 'overview' && isAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-clinical-dark flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary-600" />
            House Officer Tracking
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={distributeAdmittedPatients} disabled={distributing}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white hover:bg-primary-700 rounded-lg disabled:opacity-50">
              <Users className={`h-4 w-4 ${distributing ? 'animate-pulse' : ''}`} /> Distribute admitted patients
            </button>
            <button onClick={() => loadAllHOs()} disabled={loading} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Cohort analytics band */}
        {!loading && cohort && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'House Officers', value: String(cohort.total), icon: Users, color: 'text-primary-600' },
              { label: 'Eligible', value: `${cohort.eligible}/${cohort.total}`, icon: CheckCircle, color: 'text-green-600' },
              { label: 'Avg Overall', value: `${cohort.avgOverall}%`, icon: Target, color: scoreColor(cohort.avgOverall) },
              { label: 'Avg CBT', value: `${cohort.avgCbt}%`, icon: ClipboardCheck, color: scoreColor(cohort.avgCbt) },
              { label: 'Patients Served', value: String(cohort.totalPatients), icon: Activity, color: 'text-cyan-600' },
              { label: 'Top Performer', value: cohort.topPerformer.full_name.split(' ')[0], icon: Award, color: 'text-amber-600' },
            ].map(stat => (
              <div key={stat.label} className="card p-3 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                <p className={`text-base font-bold truncate ${stat.color}`} title={stat.value}>{stat.value}</p>
                <p className="text-[10px] text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search house officers..." value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="w-full sm:w-80 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500" />
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            <label className="text-xs text-gray-500">Rank by</label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-2 focus:ring-primary-500 focus:border-primary-500">
              <option value="overall">Overall Score</option>
              <option value="cbt">CBT Average</option>
              <option value="patients">Patients Served</option>
              <option value="name">Name (A–Z)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="animate-spin inline-block h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>
        ) : filteredHOs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>No house officers found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedHOs.map((ho, idx) => {
              const ranked = sortBy !== 'name';
              const medal = ranked && idx < 3;
              return (
              <div key={ho.id}
                   onClick={() => handleSelectHO(ho)}
                   className="card p-4 hover:shadow-md cursor-pointer transition-shadow border-l-4 relative"
                   style={{ borderLeftColor: ho.eligibility.eligible ? '#10b981' : ho.metrics.overallScore >= 50 ? '#f59e0b' : '#ef4444' }}>
                {medal && (
                  <span className={`absolute -top-2 -left-2 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${
                    idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : 'bg-orange-700'
                  }`} title={`Rank #${idx + 1}`}>
                    {idx + 1}
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-clinical-dark">{ho.full_name}</h3>
                    <p className="text-xs text-gray-500">{ho.email}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    ho.eligibility.eligible ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {ho.eligibility.eligible ? <><CheckCircle className="h-3 w-3" /> Eligible</> : <><Clock className="h-3 w-3" /> In Progress</>}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1 sm:gap-2 text-center mb-3">
                  <div><p className="text-lg font-bold text-primary-600">{ho.metrics.cbtAvgScore}%</p><p className="text-[10px] text-gray-500">CBT Avg</p></div>
                  <div><p className="text-lg font-bold text-blue-600">{ho.metrics.patientEntries}</p><p className="text-[10px] text-gray-500">Patients Served</p></div>
                  <div><p className={`text-lg font-bold ${scoreColor(ho.metrics.overallScore)}`}>{ho.metrics.overallScore}%</p><p className="text-[10px] text-gray-500">Overall</p></div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Ward Rounds</span>
                    <span className="font-medium">{ho.metrics.wardRoundsDocumented}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Prescriptions</span>
                    <span className="font-medium">{ho.metrics.prescriptionsWritten}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">Lab Orders</span>
                    <span className="font-medium">{ho.metrics.labOrdersPlaced}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">CBT Tests</span>
                    <span className="font-medium">{ho.metrics.cbtTestsCompleted}/{ho.requirements.cbtTests}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">CME Topics</span>
                    <span className="font-medium">{ho.metrics.cmeTopicsCompleted}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end text-xs text-primary-600 font-medium">
                  View Details <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ──────── DETAIL VIEW ────────
  const ho = selectedHO?.houseOfficer;
  const m = ho?.metrics;
  const elig = ho?.eligibility;
  const rot = selectedHO?.rotation;

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'documentation', label: 'Documentation', icon: FileText },
    { id: 'cbt', label: 'CBT Scores', icon: ClipboardCheck },
    { id: 'cme', label: 'CME Progress', icon: BookOpen },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'eligibility', label: 'Sign-Out', icon: LogOut },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {isAdmin && (
          <button onClick={handleBack} className="flex items-center gap-1 text-sm text-gray-600 hover:text-clinical-dark">
            <ArrowLeft className="h-4 w-4" /> All House Officers
          </button>
        )}
        <h1 className="text-xl sm:text-2xl font-bold text-clinical-dark flex items-center gap-2">
          <User className="h-6 w-6 text-primary-600" />
          {loading ? 'Loading...' : ho ? ho.full_name : 'HO Tracking'}
        </h1>
        {ho && (
          <button onClick={() => loadHODetail(ho.id)} disabled={loading}
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {signOutMsg && <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm">{signOutMsg}</div>}

      {loading && !ho ? (
        <div className="text-center py-12"><div className="animate-spin inline-block h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" /></div>
      ) : !ho ? (
        <div className="text-center py-12 text-gray-500">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p>{isHO ? 'Your tracking data is loading...' : 'Select a house officer to view details.'}</p>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Overall Score', value: `${m!.overallScore}%`, icon: Target, color: scoreColor(m!.overallScore) },
              { label: 'CBT Average', value: `${m!.cbtAvgScore}%`, icon: ClipboardCheck, color: scoreColor(m!.cbtAvgScore) },
              { label: 'Ward Rounds', value: String(m!.wardRoundsDocumented), icon: Stethoscope, color: 'text-blue-600' },
              { label: 'Prescriptions', value: String(m!.prescriptionsWritten), icon: Pill, color: 'text-purple-600' },
              { label: 'Lab Orders', value: String(m!.labOrdersPlaced), icon: FlaskConical, color: 'text-indigo-600' },
              { label: 'Patients Served', value: String(m!.patientEntries), icon: Users, color: 'text-cyan-600' },
            ].map(stat => (
              <div key={stat.label} className="card p-3 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-[10px] text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Eligibility Banner */}
          <div className={`rounded-lg p-4 flex items-center gap-3 ${elig!.eligible
            ? 'bg-green-50 border border-green-200'
            : 'bg-amber-50 border border-amber-200'
          }`}>
            {elig!.eligible
              ? <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
              : <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-sm ${elig!.eligible ? 'text-green-800' : 'text-amber-800'}`}>
                {elig!.eligible ? 'Eligible for Sign-Out' : 'Not Yet Eligible for Sign-Out'}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {elig!.met.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 text-xs text-green-700">
                    <CheckCircle className="h-3 w-3" /> {item}
                  </span>
                ))}
                {elig!.notMet.map((item, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 text-xs text-red-600">
                    <XCircle className="h-3 w-3" /> {item}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 overflow-x-auto">
            <nav className="flex -mb-px space-x-4 min-w-max">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                          activeTab === tab.id
                            ? 'border-primary-600 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}>
                  <tab.icon className="h-4 w-4" /> {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="card p-4 sm:p-6">
            {activeTab === 'summary' && <SummaryTab ho={ho} metrics={m!} requirements={ho.requirements} progressBar={progressBar} />}
            {activeTab === 'documentation' && <DocumentationTab detail={selectedHO!} />}
            {activeTab === 'cbt' && <CBTTab detail={selectedHO!} scoreColor={scoreColor} />}
            {activeTab === 'cme' && <CMETab detail={selectedHO!} />}
            {activeTab === 'patients' && <PatientsTab detail={selectedHO!} />}
            {activeTab === 'eligibility' && (
              <EligibilityTab
                detail={selectedHO!}
                isAdmin={isAdmin}
                isHO={isHO}
                onRequestSignOut={handleRequestSignOut}
                onApproveSignOut={handleApproveSignOut}
                signOutLoading={signOutLoading}
                progressBar={progressBar}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ── Summary Tab ──
function SummaryTab({ ho, metrics: m, requirements: r, progressBar }: {
  ho: HOProfile; metrics: HOProfile['metrics']; requirements: HOProfile['requirements'];
  progressBar: (v: number, max: number, c?: string) => React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-clinical-dark flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary-600" /> Performance Overview
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Requirements Progress */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-700">Sign-Out Requirements</h4>
          {[
            { label: 'CBT Tests Completed', current: m.cbtTestsCompleted, target: r.cbtTests },
            { label: 'Patient Entries', current: m.patientEntries, target: r.patientEntries },
            { label: 'Duties Completed', current: m.dutiesCompleted, target: r.duties },
            { label: 'Attendance (Login Days)', current: m.loginDays, target: r.loginDays },
            { label: 'Overall Score', current: m.overallScore, target: r.overallScore },
          ].map(req => (
            <div key={req.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">{req.label}</span>
                <span className={`font-medium ${req.current >= req.target ? 'text-green-600' : 'text-gray-800'}`}>
                  {req.current}/{req.target} {req.current >= req.target && <CheckCircle className="h-3 w-3 inline" />}
                </span>
              </div>
              {progressBar(req.current, req.target)}
            </div>
          ))}
        </div>

        {/* Documentation Metrics */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-gray-700">Documentation Activity</h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Ward Rounds', value: m.wardRoundsDocumented, icon: Stethoscope, color: 'bg-blue-50 text-blue-700' },
              { label: 'Prescriptions', value: m.prescriptionsWritten, icon: Pill, color: 'bg-purple-50 text-purple-700' },
              { label: 'Lab Orders', value: m.labOrdersPlaced, icon: FlaskConical, color: 'bg-indigo-50 text-indigo-700' },
              { label: 'Patient Entries', value: m.patientEntries, icon: FileText, color: 'bg-green-50 text-green-700' },
              { label: 'CME Topics', value: m.cmeTopicsCompleted, icon: BookOpen, color: 'bg-amber-50 text-amber-700' },
              { label: 'Assigned Patients', value: m.assignedPatients, icon: Users, color: 'bg-cyan-50 text-cyan-700' },
            ].map(d => (
              <div key={d.label} className={`rounded-lg p-3 ${d.color}`}>
                <d.icon className="h-4 w-4 mb-1" />
                <p className="text-xl font-bold">{d.value}</p>
                <p className="text-[10px] opacity-80">{d.label}</p>
              </div>
            ))}
          </div>

          {/* CBT Score Summary */}
          <div className="mt-2 bg-gray-50 rounded-lg p-3">
            <h4 className="font-medium text-xs text-gray-600 mb-2">CBT Performance</h4>
            <div className="flex justify-between text-sm">
              <span>Average: <strong className={m.cbtAvgScore >= 75 ? 'text-green-600' : 'text-amber-600'}>{m.cbtAvgScore}%</strong></span>
              <span>Best: <strong className="text-green-600">{m.cbtBestScore}%</strong></span>
              <span>Worst: <strong className="text-red-600">{m.cbtWorstScore}%</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      {m.scoreBreakdown && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-sm text-gray-700 mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary-600" /> Overall Score Breakdown
          </h4>
          <div className="space-y-2">
            {[
              { label: 'CBT (30%)', ...m.scoreBreakdown.cbt },
              { label: 'Patient Care (35%)', ...m.scoreBreakdown.patientCare },
              { label: 'Duties (25%)', ...m.scoreBreakdown.duties },
              { label: 'Attendance (10%)', ...m.scoreBreakdown.attendance },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className="w-36 text-gray-600">{item.label}</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div className={`h-2 rounded-full ${item.score >= 70 ? 'bg-green-500' : item.score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                       style={{ width: `${Math.min(100, item.score)}%` }} />
                </div>
                <span className="w-16 text-right text-xs font-medium text-gray-700">{item.score}% → {item.contribution}%</span>
              </div>
            ))}
            <div className="border-t pt-2 mt-2 flex justify-between text-sm font-semibold">
              <span className="text-gray-700">Overall Score</span>
              <span className={m.overallScore >= 70 ? 'text-green-600' : 'text-amber-600'}>{m.overallScore}%</span>
            </div>
          </div>
          {m.rotationStart && (
            <p className="text-[10px] text-gray-400 mt-2">
              Metrics scoped to current rotation starting {new Date(m.rotationStart).toLocaleDateString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Documentation Tab ──
function DocumentationTab({ detail }: { detail: HODetail }) {
  const { wardRounds, prescriptions, labOrders, activityLogs } = detail;

  // Merge into a unified timeline
  const timeline: { id: string; type: string; date: string; description: string; patient?: string; hn?: string }[] = [];

  wardRounds.forEach((wr: any) => timeline.push({
    id: `wr-${wr.id}`, type: 'Ward Round', date: wr.created_at || wr.round_date,
    description: wr.clinical_notes || wr.progress_status || 'Ward round documented',
    patient: [wr.first_name, wr.last_name].filter(Boolean).join(' '), hn: wr.hospital_number,
  }));

  prescriptions.forEach((rx: any) => timeline.push({
    id: `rx-${rx.id}`, type: 'Prescription', date: rx.created_at,
    description: `${rx.medication_name || 'Medication'} ${rx.dosage || ''}`.trim(),
    patient: [rx.first_name, rx.last_name].filter(Boolean).join(' '), hn: rx.hospital_number,
  }));

  labOrders.forEach((lab: any) => timeline.push({
    id: `lab-${lab.id}`, type: 'Lab Order', date: lab.created_at,
    description: `${lab.test_name || 'Lab test'} (${lab.urgency || 'routine'})`,
    patient: [lab.first_name, lab.last_name].filter(Boolean).join(' '), hn: lab.hospital_number,
  }));

  activityLogs.forEach((log: any) => timeline.push({
    id: `log-${log.id}`, type: log.activity_type?.replace(/_/g, ' ') || 'Activity',
    date: log.created_at, description: log.description || '',
  }));

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const typeColors: Record<string, string> = {
    'Ward Round': 'bg-blue-100 text-blue-700',
    'Prescription': 'bg-purple-100 text-purple-700',
    'Lab Order': 'bg-indigo-100 text-indigo-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-clinical-dark flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary-600" /> Documentation Log
        </h3>
        <span className="text-sm text-gray-500">{timeline.length} entries</span>
      </div>

      {timeline.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No documentation records found.</p>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {timeline.map(item => (
            <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex-shrink-0 mt-0.5">
                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${typeColors[item.type] || 'bg-gray-100 text-gray-600'}`}>
                  {item.type}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-clinical-dark truncate">{item.description || 'No description'}</p>
                {item.patient && <p className="text-xs text-gray-500">{item.patient} {item.hn && `(${item.hn})`}</p>}
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                {item.date ? new Date(item.date).toLocaleDateString() : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CBT Scores Tab ──
function CBTTab({ detail, scoreColor }: { detail: HODetail; scoreColor: (s: number, m?: number) => string }) {
  const attempts = detail.cbtAttempts || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-clinical-dark flex items-center gap-2">
        <ClipboardCheck className="h-5 w-5 text-primary-600" /> CBT Test Results
      </h3>

      {attempts.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No CBT attempts recorded yet.</p>
      ) : (
        <>
          {/* Score Summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <p className="text-xs text-green-600">Passed</p>
              <p className="text-2xl font-bold text-green-700">{attempts.filter((a: any) => a.passed).length}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-3 text-center">
              <p className="text-xs text-red-600">Failed</p>
              <p className="text-2xl font-bold text-red-700">{attempts.filter((a: any) => !a.passed).length}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <p className="text-xs text-blue-600">Average</p>
              <p className="text-2xl font-bold text-blue-700">
                {attempts.length > 0 ? Math.round(attempts.reduce((s: number, a: any) => s + (a.percentage || 0), 0) / attempts.length) : 0}%
              </p>
            </div>
          </div>

          {/* Score Chart (simple bar chart) */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-2">Score History (pass mark: 75%)</p>
            <div className="flex items-end gap-1.5 h-32 overflow-x-auto">
              {attempts.slice(0, 20).reverse().map((a: any, i: number) => {
                const pct = a.percentage || 0;
                return (
                  <div key={i} className="flex flex-col items-center flex-shrink-0" style={{ width: '28px' }}>
                    <span className="text-[9px] text-gray-500 mb-0.5">{Math.round(pct)}%</span>
                    <div className={`w-5 rounded-t ${pct >= 75 ? 'bg-green-500' : 'bg-red-400'}`}
                         style={{ height: `${Math.max(pct, 5)}%` }} />
                    <span className="text-[8px] text-gray-400 mt-0.5">#{a.test_number || (i + 1)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 border-t border-dashed border-amber-400 relative" style={{ top: '-75%', height: 0 }} />
          </div>

          {/* Attempts Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2 font-medium text-gray-600">Test #</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Score</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Percentage</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Result</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attempts.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{a.test_number || i + 1}</td>
                    <td className="px-3 py-2">{a.score}/{a.total_marks || 25}</td>
                    <td className={`px-3 py-2 font-medium ${scoreColor(a.percentage || 0)}`}>{Math.round(a.percentage || 0)}%</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        a.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {a.passed ? <><CheckCircle className="h-3 w-3" /> Pass</> : <><XCircle className="h-3 w-3" /> Fail</>}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : a.end_time ? new Date(a.end_time).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ── CME Progress Tab ──
function CMETab({ detail }: { detail: HODetail }) {
  const progress = detail.cmeProgress || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-clinical-dark flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary-600" /> CME / Training Progress
      </h3>

      <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-700">
        <Award className="h-5 w-5 flex-shrink-0" />
        <span>{progress.length} topic{progress.length !== 1 ? 's' : ''} completed</span>
      </div>

      {progress.length === 0 ? (
        <p className="text-center py-8 text-gray-500">No CME topics completed yet.</p>
      ) : (
        <div className="space-y-2">
          {progress.map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-clinical-dark truncate">{p.topic_title || p.topic_id || `Topic ${i + 1}`}</p>
                {p.module_title && <p className="text-xs text-gray-500">{p.module_title}</p>}
              </div>
              <div className="text-xs text-gray-400">
                {p.completed_at ? new Date(p.completed_at).toLocaleDateString() : '—'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Patients Tab ──
function PatientsTab({ detail }: { detail: HODetail }) {
  const navigate = useNavigate();
  const assigned = detail.assignedPatients || [];
  const documented = detail.documentedPatients || [];

  // Merge: documented patients + assigned-only patients not yet documented
  const documentedIds = new Set(documented.map((p: any) => String(p.id)));
  const assignedOnly = assigned.filter((p: any) => !documentedIds.has(String(p.patient_id)));

  const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
    'Ward Round': { icon: Stethoscope, color: 'bg-blue-100 text-blue-700' },
    'Prescription': { icon: Pill, color: 'bg-purple-100 text-purple-700' },
    'Lab Order': { icon: FlaskConical, color: 'bg-indigo-100 text-indigo-700' },
    'Vital Signs': { icon: Activity, color: 'bg-green-100 text-green-700' },
    'Progress Note': { icon: FileText, color: 'bg-amber-100 text-amber-700' },
    'Treatment Plan': { icon: Target, color: 'bg-teal-100 text-teal-700' },
    'Patient Created': { icon: User, color: 'bg-cyan-100 text-cyan-700' },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-clinical-dark flex items-center gap-2">
          <Users className="h-5 w-5 text-primary-600" /> Patients & Documentation
        </h3>
        <span className="text-sm text-gray-500">
          {documented.length + assignedOnly.length} total patient{documented.length + assignedOnly.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Documented Patients */}
      {documented.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Documented Patients ({documented.length})
          </h4>
          <div className="space-y-2">
            {documented.map((p: any, i: number) => {
              const docTypes = (p.documentation_types || '').split(', ').filter(Boolean);
              const isAdmitted = p.admission_status === 'active' || p.admission_status === 'admitted';
              return (
                <div key={p.id || i}
                     onClick={() => p.id && navigate(`/patients/${p.id}`)}
                     className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-clinical-dark">
                        {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.hospital_number || '—'}
                        {(p.ward || p.ward_location) ? ` · Ward: ${p.ward || p.ward_location}` : ''}
                        {p.bed_number ? ` · Bed ${p.bed_number}` : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        isAdmitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {isAdmitted ? 'Admitted' : p.admission_status || 'Outpatient'}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{p.total_docs} doc{p.total_docs !== 1 ? 's' : ''}</p>
                      {p.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/patients/${p.id}`); }}
                          className="mt-1 text-[11px] text-primary-600 hover:underline font-medium">
                          {isAdmitted ? 'Edit admission' : 'Admit / edit'}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Documentation Types */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {docTypes.map((dt: string) => {
                      const info = typeIcons[dt] || { icon: FileText, color: 'bg-gray-100 text-gray-600' };
                      const Icon = info.icon;
                      return (
                        <span key={dt} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${info.color}`}>
                          <Icon className="h-3 w-3" /> {dt}
                        </span>
                      );
                    })}
                  </div>
                  {/* Timeline */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      First: {p.first_documented ? new Date(p.first_documented).toLocaleDateString() : '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last: {p.last_documented ? new Date(p.last_documented).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assigned but not yet documented */}
      {assignedOnly.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-gray-700 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Assigned — Not Yet Documented ({assignedOnly.length})
          </h4>
          <div className="space-y-2">
            {assignedOnly.map((p: any, i: number) => {
              const isAdmitted = p.admission_status === 'active' || p.admission_status === 'admitted';
              return (
              <div key={i}
                   onClick={() => p.patient_id && navigate(`/patients/${p.patient_id}`)}
                   className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between cursor-pointer hover:shadow-sm transition-shadow">
                <div>
                  <p className="font-medium text-clinical-dark">
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.hospital_number || '—'}
                    {(p.ward || p.ward_location) ? ` · Ward: ${p.ward || p.ward_location}` : ''}
                    {p.bed_number ? ` · Bed ${p.bed_number}` : ''}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    isAdmitted ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isAdmitted ? 'Admitted' : 'Outpatient'}
                  </span>
                  {p.patient_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/patients/${p.patient_id}`); }}
                      className="block mt-1 text-[11px] text-primary-600 hover:underline font-medium">
                      {isAdmitted ? 'Edit admission' : 'Admit / edit'}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {documented.length === 0 && assignedOnly.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p>No patients documented or assigned yet.</p>
        </div>
      )}
    </div>
  );
}

// ── Sign-Out Eligibility Tab ──
function EligibilityTab({ detail, isAdmin, isHO, onRequestSignOut, onApproveSignOut, signOutLoading, progressBar }: {
  detail: HODetail; isAdmin: boolean; isHO: boolean;
  onRequestSignOut: () => void; onApproveSignOut: (id: number, approved: boolean) => void;
  signOutLoading: boolean;
  progressBar: (v: number, max: number, c?: string) => React.ReactNode;
}) {
  const ho = detail.houseOfficer;
  const m = ho.metrics;
  const r = ho.requirements;
  const elig = ho.eligibility;
  const rot = detail.rotation;

  const criteria = [
    { label: 'CBT Tests', current: m.cbtTestsCompleted, target: r.cbtTests, desc: `Complete ${r.cbtTests} CBT tests` },
    { label: 'Patient Entries', current: m.patientEntries, target: r.patientEntries, desc: `Document ${r.patientEntries} patient encounters` },
    { label: 'Duties Completed', current: m.dutiesCompleted, target: r.duties, desc: `Complete ${r.duties} assigned duties` },
    { label: 'Attendance', current: m.loginDays, target: r.loginDays, desc: `Log in on ${r.loginDays} days` },
    { label: 'Overall Score', current: m.overallScore, target: r.overallScore, desc: `Achieve ${r.overallScore}% overall score` },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-clinical-dark flex items-center gap-2">
        <LogOut className="h-5 w-5 text-primary-600" /> Sign-Out Eligibility
      </h3>

      {/* Rotation Status */}
      {rot && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-1">
            <Calendar className="h-4 w-4" /> Current Rotation
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><span className="text-gray-500">Status:</span> <span className={`font-medium ${
              rot.status === 'signed_out' ? 'text-green-600' : rot.status === 'pending_signout' ? 'text-amber-600' : 'text-blue-600'
            }`}>{rot.status?.replace(/_/g, ' ')}</span></div>
            <div><span className="text-gray-500">Started:</span> {rot.start_date ? new Date(rot.start_date).toLocaleDateString() : '—'}</div>
            <div><span className="text-gray-500">Expected End:</span> {rot.expected_end_date ? new Date(rot.expected_end_date).toLocaleDateString() : '—'}</div>
            <div><span className="text-gray-500">Extensions:</span> <span className="font-medium">{rot.extension_count || 0}</span></div>
          </div>
          {rot.sign_out_comments && (
            <p className="mt-2 text-xs text-gray-500">Comments: {rot.sign_out_comments}</p>
          )}
        </div>
      )}

      {/* Criteria Checklist */}
      <div className="space-y-4">
        {criteria.map(c => {
          const met = c.current >= c.target;
          return (
            <div key={c.label} className={`rounded-lg p-4 border ${met ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {met ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-gray-400" />}
                  <div>
                    <p className={`font-medium text-sm ${met ? 'text-green-800' : 'text-gray-800'}`}>{c.label}</p>
                    <p className="text-xs text-gray-500">{c.desc}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${met ? 'text-green-600' : 'text-gray-600'}`}>
                  {c.current}/{c.target}
                </span>
              </div>
              {progressBar(c.current, c.target)}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t">
        {isHO && elig.eligible && (!rot || rot.status === 'active' || rot.status === 'extended') && (
          <button onClick={onRequestSignOut} disabled={signOutLoading}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2">
            <LogOut className="h-4 w-4" /> {signOutLoading ? 'Requesting...' : 'Request Sign-Out'}
          </button>
        )}
        {isHO && !elig.eligible && (
          <p className="text-sm text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Complete all requirements before requesting sign-out.
          </p>
        )}
        {isAdmin && rot?.status === 'pending_signout' && (
          <>
            <button onClick={() => onApproveSignOut(rot.id, true)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> Approve Sign-Out
            </button>
            <button onClick={() => onApproveSignOut(rot.id, false)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4" /> Reject Sign-Out
            </button>
          </>
        )}
        {isAdmin && rot?.status === 'signed_out' && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 px-4 py-2 rounded-lg text-sm">
            <Award className="h-5 w-5" /> Signed out on {rot.sign_out_approved_at ? new Date(rot.sign_out_approved_at).toLocaleDateString() : '—'}
            {rot.final_score && <span className="ml-2">Final Score: {rot.final_score}%</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default HOTrackingPage;
