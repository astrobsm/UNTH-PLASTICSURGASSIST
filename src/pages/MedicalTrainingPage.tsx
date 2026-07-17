import React, { useState, useMemo, useEffect } from 'react';
import { 
  GraduationCap, 
  Book, 
  ChevronRight, 
  ChevronDown, 
  Users, 
  Award,
  FileText,
  CheckCircle,
  Clock,
  Search,
  ArrowLeft,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  Activity,
  Target,
  BarChart3,
  AlertTriangle,
  Bell,
  X,
  BookOpen
} from 'lucide-react';
import { 
  medicalTrainingService, 
  CMEModule, 
  CMETopic, 
  TrainingLevel 
} from '../services/medicalTrainingService';
import { performanceService } from '../services/performanceService';
import { cbtService, CBTProgress } from '../services/cbtService';
import { rotationConfigService, RotationConfig, TraineeAnalytics } from '../services/rotationConfigService';
import { apiClient } from '../services/apiClient';
import CMEArticleViewer from '../components/training/CMEArticleViewer';
import { CBTPage } from '../components/cbt';
import { PerformanceDashboard } from '../components/performance';

type TabType = 'house_officer' | 'junior_resident' | 'senior_resident';

const MedicalTrainingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('house_officer');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['ho-module-1']));
  const [selectedTopic, setSelectedTopic] = useState<CMETopic | null>(null);
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem('completed_training_topics');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });
  const [showCBT, setShowCBT] = useState(false);
  const [showPerformance, setShowPerformance] = useState(false);
  const [cbtProgress, setCbtProgress] = useState<CBTProgress | null>(null);
  const [cbtWeeklyStatus, setCbtWeeklyStatus] = useState<{ attempted: boolean; lastAttemptDate: string | null }>({ attempted: false, lastAttemptDate: null });
  const [activeRotation, setActiveRotation] = useState<RotationConfig | null>(null);
  const [rotationDays, setRotationDays] = useState<{ daysRemaining: number; daysElapsed: number; totalDays: number; progressPercent: number; commencementDate: string | null; endDate: string | null }>({ daysRemaining: 0, daysElapsed: 0, totalDays: 0, progressPercent: 0, commencementDate: null, endDate: null });
  const [myParticipation, setMyParticipation] = useState<TraineeAnalytics | null>(null);
  const [warnings, setWarnings] = useState<any[]>([]);
  const [unreadWarningCount, setUnreadWarningCount] = useState(0);
  const [showWarnings, setShowWarnings] = useState(false);

  // Load CBT status for dashboard display
  useEffect(() => {
    const loadCbtStatus = () => {
      try {
        const progress = cbtService.getProgress(activeTab as any);
        setCbtProgress(progress);
        const userId = localStorage.getItem('userId') || `user-${Date.now()}`;
        const weeklyStatus = cbtService.hasAttemptedThisWeek(activeTab as any, userId);
        setCbtWeeklyStatus(weeklyStatus);
      } catch (e) {
        console.warn('Failed to load CBT status:', e);
      }
    };
    loadCbtStatus();
  }, [activeTab, showCBT]); // Refresh when returning from CBT page

  // Record login on component mount
  useEffect(() => {
    performanceService.recordLogin();
    
    // Load completed topics from server
    const loadFromServer = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        
        const data = await apiClient.get('/training-progress');
        if (data.completedTopics && data.completedTopics.length > 0) {
          setCompletedTopics(prev => {
            const merged = new Set([...prev, ...data.completedTopics]);
            localStorage.setItem('completed_training_topics', JSON.stringify([...merged]));
            return merged;
          });
        }
      } catch (error) {
        console.warn('Failed to load training progress from server:', error);
      }
    };
    
    loadFromServer();
  }, []);

  // Load rotation config and participation data
  useEffect(() => {
    const loadRotationData = async () => {
      try {
        // Load active rotation config for current level
        const config = rotationConfigService.getActiveRotationConfig(activeTab as TrainingLevel);
        setActiveRotation(config);

        if (config) {
          const days = rotationConfigService.getRotationDaysInfo(activeTab as TrainingLevel);
          setRotationDays(days);
        } else {
          setRotationDays({ daysRemaining: 0, daysElapsed: 0, totalDays: 0, progressPercent: 0, commencementDate: null, endDate: null });
        }

        // Load user's participation analytics
        const userId = localStorage.getItem('userId');
        if (userId) {
          const analytics = await rotationConfigService.getTraineeAnalytics(userId);
          setMyParticipation(analytics);
        }
      } catch (error) {
        console.warn('Failed to load rotation data:', error);
      }
    };

    loadRotationData();
  }, [activeTab]);

  // Load training warnings
  useEffect(() => {
    const loadWarnings = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const data = await apiClient.get('/training-warnings');
        setWarnings(data.warnings || []);
        setUnreadWarningCount(data.unreadCount || 0);
      } catch (error) {
        console.warn('Failed to load training warnings:', error);
      }
    };
    loadWarnings();
  }, []);

  const markWarningRead = async (warningId: number) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      await apiClient.put('/training-warnings', { warningId });
      setWarnings(prev => prev.map(w => w.id === warningId ? { ...w, read: true } : w));
      setUnreadWarningCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.warn('Failed to mark warning as read:', error);
    }
  };

  const modules = useMemo(() => {
    return medicalTrainingService.getModulesByLevel(activeTab);
  }, [activeTab]);

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    const query = searchQuery.toLowerCase();
    return modules.map(module => ({
      ...module,
      topics: module.topics.filter(topic => 
        topic.title.toLowerCase().includes(query) ||
        (topic.article?.overview || '').toLowerCase().includes(query)
      )
    })).filter(module => module.topics.length > 0);
  }, [modules, searchQuery]);

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleTopicSelect = (topic: CMETopic) => {
    setSelectedTopic(topic);
  };

  const handleTopicComplete = async (topicId: string) => {
    // Update state
    setCompletedTopics(prev => {
      const updated = new Set([...prev, topicId]);
      // Save to localStorage
      localStorage.setItem('completed_training_topics', JSON.stringify([...updated]));
      return updated;
    });
    
    // Sync to server
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await apiClient.post('/training-progress', { topicId, level: activeTab, completedAt: new Date().toISOString() });
        console.log('✅ Training progress synced to server');
        // Notify monitoring views that this trainee's CME progress changed
        try {
          const { broadcastChange } = await import('../utils/crossTabSync');
          broadcastChange('training');
        } catch { /* non-fatal */ }
      }
    } catch (error) {
      console.warn('⚠️ Failed to sync training progress (will retry later):', error);
    }
  };

  // Persist the trainee's self-assessment score (feeds the comprehensive
  // sign-out score shown here and in Training Admin / HO Tracking).
  const handleSelfAssessment = async (result: { topicId: string; correct: number; total: number }) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      await apiClient.post('/training-progress', {
        action: 'self-assessment',
        topicId: result.topicId,
        level: activeTab,
        correct: result.correct,
        total: result.total,
      });
      try {
        const { broadcastChange } = await import('../utils/crossTabSync');
        broadcastChange('training');
      } catch { /* non-fatal */ }
    } catch (error) {
      console.warn('⚠️ Failed to save self-assessment score (will retry later):', error);
    }
  };

  const totalTopics = modules.reduce((sum, m) => sum + m.topics.length, 0);
  const completedCount = Array.from(completedTopics).filter(id => 
    modules.some(m => m.topics.some(t => t.id === id))
  ).length;

  const tabs = [
    { 
      id: 'house_officer' as TabType, 
      label: 'House Officer', 
      icon: Users, 
      color: 'bg-blue-500',
      description: 'Intern training modules'
    },
    { 
      id: 'junior_resident' as TabType, 
      label: 'Junior Resident', 
      icon: Award, 
      color: 'bg-green-500',
      description: 'Registrar training'
    },
    { 
      id: 'senior_resident' as TabType, 
      label: 'Senior Resident', 
      icon: GraduationCap, 
      color: 'bg-purple-500',
      description: 'Advanced surgical training'
    }
  ];

  if (selectedTopic) {
    return (
      <CMEArticleViewer
        topic={selectedTopic}
        onBack={() => setSelectedTopic(null)}
        onComplete={() => handleTopicComplete(selectedTopic.id)}
        isCompleted={completedTopics.has(selectedTopic.id)}
        onSelfAssessment={handleSelfAssessment}
      />
    );
  }

  if (showCBT) {
    return (
      <CBTPage
        level={activeTab as TrainingLevel}
        onBack={() => setShowCBT(false)}
      />
    );
  }

  if (showPerformance) {
    return (
      <PerformanceDashboard
        level={activeTab as TrainingLevel}
        onBack={() => setShowPerformance(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="h-10 w-10" />
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Medical Training</h1>
              <p className="text-green-100">Comprehensive CME for Surgical Practice</p>
            </div>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Book className="h-8 w-8" />
                <div>
                  <p className="text-green-100 text-sm">Total Topics</p>
                  <p className="text-lg sm:text-2xl font-bold">{totalTopics}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="text-green-100 text-sm">Completed</p>
                  <p className="text-lg sm:text-2xl font-bold">{completedCount}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8" />
                <div>
                  <p className="text-green-100 text-sm">Progress</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Training Warnings Banner */}
          {warnings.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowWarnings(!showWarnings)}
                className={`w-full flex items-center justify-between px-5 py-3 rounded-xl border transition-all ${
                  unreadWarningCount > 0  
                    ? 'bg-red-500/30 border-red-300/40 hover:bg-red-500/40' 
                    : 'bg-white/15 border-white/20 hover:bg-white/25'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5" />
                  <span className="font-semibold">Training Warnings</span>
                  {unreadWarningCount > 0 && (
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      {unreadWarningCount} new
                    </span>
                  )}
                </div>
                {showWarnings ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
              {showWarnings && (
                <div className="mt-2 space-y-2">
                  {warnings.map(w => (
                    <div key={w.id} className={`rounded-lg px-4 py-3 border ${
                      !w.read 
                        ? w.severity === 'critical' ? 'bg-red-500/30 border-red-300/40' : 'bg-amber-500/30 border-amber-300/40'
                        : 'bg-white/10 border-white/15 opacity-75'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {w.severity === 'critical' ? (
                              <AlertTriangle className="h-4 w-4 text-red-300 flex-shrink-0" />
                            ) : w.severity === 'warning' ? (
                              <AlertTriangle className="h-4 w-4 text-amber-300 flex-shrink-0" />
                            ) : (
                              <Bell className="h-4 w-4 text-blue-300 flex-shrink-0" />
                            )}
                            <span className="font-semibold text-sm">{w.subject}</span>
                          </div>
                          <p className="text-sm text-green-100">{w.message}</p>
                          <p className="text-xs text-green-200/60 mt-1">
                            {new Date(w.created_at).toLocaleDateString()} &bull; from {w.sent_by_name || 'Admin'}
                          </p>
                        </div>
                        {!w.read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markWarningRead(w.id); }}
                            className="px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors flex-shrink-0"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Rotation Period Banner */}
          {activeRotation && (
            <div className="mt-6 bg-white/15 backdrop-blur rounded-xl p-5 border border-white/20">
              <div className="flex items-center gap-3 mb-3">
                <Calendar className="h-6 w-6" />
                <div>
                  <h3 className="font-bold text-lg">Current Rotation Period</h3>
                  <p className="text-sm text-green-100">
                    {new Date(activeRotation.commencement_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    {' '}&rarr;{' '}
                    {new Date(activeRotation.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span>Day {rotationDays.daysElapsed} of {rotationDays.totalDays}</span>
                  <span className={`font-bold ${rotationDays.daysRemaining <= 7 ? 'text-red-300' : rotationDays.daysRemaining <= 14 ? 'text-yellow-300' : 'text-white'}`}>
                    {rotationDays.daysRemaining} days remaining
                  </span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full transition-all ${rotationDays.progressPercent >= 90 ? 'bg-red-400' : rotationDays.progressPercent >= 70 ? 'bg-yellow-400' : 'bg-white/70'}`}
                    style={{ width: `${rotationDays.progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-green-100 mt-1">{rotationDays.progressPercent}% elapsed</p>
              </div>

              {activeRotation.notes && (
                <p className="text-xs text-green-100 italic mt-1">Note: {activeRotation.notes}</p>
              )}
            </div>
          )}

          {/* Participation Tracking Panel */}
          {myParticipation && (
            <div className="mt-4 bg-white/15 backdrop-blur rounded-xl p-5 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Activity className="h-6 w-6" />
                  <div>
                    <h3 className="font-bold text-lg">Your Participation Tracker</h3>
                    <p className="text-sm text-green-100">Activity within this rotation period</p>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                  myParticipation.signOutEligible 
                    ? 'bg-green-400 text-green-900' 
                    : myParticipation.overallScore >= 50 
                      ? 'bg-yellow-400 text-yellow-900' 
                      : 'bg-red-400 text-red-900'
                }`}>
                  {myParticipation.overallScore}% Overall
                </div>
              </div>

              {/* Performance Breakdown Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {/* CBT */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-green-100 text-xs font-medium">CBT Tests</p>
                    <span className="text-xs text-green-200">10%</span>
                  </div>
                  <p className={`text-xl font-bold ${myParticipation.cbtScore >= 70 ? 'text-yellow-300' : 'text-white'}`}>
                    {myParticipation.cbtScore}%
                  </p>
                  <p className="text-xs text-green-200 mt-0.5">{myParticipation.cbtTestsCompleted}/{myParticipation.cbtTestsRequired} completed</p>
                </div>

                {/* Patient Care */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-green-100 text-xs font-medium">Patient Care</p>
                    <span className="text-xs text-green-200">70%</span>
                  </div>
                  <p className={`text-xl font-bold ${myParticipation.patientCareScore >= 70 ? 'text-yellow-300' : 'text-white'}`}>
                    {myParticipation.patientCareScore}%
                  </p>
                  <p className="text-xs text-green-200 mt-0.5">{myParticipation.patientEntries}/{myParticipation.patientEntriesRequired} entries</p>
                </div>

                {/* Duties */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-green-100 text-xs font-medium">Duties</p>
                    <span className="text-xs text-green-200">10%</span>
                  </div>
                  <p className={`text-xl font-bold ${myParticipation.dutyPromptnessScore >= 70 ? 'text-yellow-300' : 'text-white'}`}>
                    {myParticipation.dutyPromptnessScore}%
                  </p>
                  <p className="text-xs text-green-200 mt-0.5">{myParticipation.dutiesCompleted}/{myParticipation.dutiesRequired} done</p>
                </div>

                {/* Attendance */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-green-100 text-xs font-medium">Attendance</p>
                    <span className="text-xs text-green-200">10%</span>
                  </div>
                  <p className={`text-xl font-bold ${myParticipation.attendanceScore >= 70 ? 'text-yellow-300' : 'text-white'}`}>
                    {myParticipation.attendanceScore}%
                  </p>
                  <p className="text-xs text-green-200 mt-0.5">{myParticipation.loginDays}/{myParticipation.loginDaysRequired} days</p>
                </div>
              </div>

              {/* Additional tracking: CME + Responsibilities + Sign-out */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* CME Progress */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Book className="h-4 w-4 text-green-200" />
                    <p className="text-green-100 text-xs font-medium">CME Topics</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/20 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-400" style={{ width: `${myParticipation.cmeProgress}%` }} />
                    </div>
                    <span className="text-sm font-bold">{myParticipation.cmeProgress}%</span>
                  </div>
                  <p className="text-xs text-green-200 mt-1">{myParticipation.topicsCompleted}/{myParticipation.totalTopics} topics</p>
                </div>

                {/* Responsibilities */}
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="h-4 w-4 text-green-200" />
                    <p className="text-green-100 text-xs font-medium">Responsibilities</p>
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="text-center">
                      <p className="text-lg font-bold">{myParticipation.assignedResponsibilities}</p>
                      <p className="text-xs text-green-200">Assigned</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-yellow-300">{myParticipation.completedResponsibilities}</p>
                      <p className="text-xs text-green-200">Done</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-red-300">{myParticipation.pendingResponsibilities}</p>
                      <p className="text-xs text-green-200">Pending</p>
                    </div>
                  </div>
                </div>

                {/* Sign-out Eligibility */}
                <div className={`rounded-lg p-3 ${myParticipation.signOutEligible ? 'bg-green-400/30 border border-green-300/30' : 'bg-red-500/20 border border-red-300/20'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {myParticipation.signOutEligible ? (
                      <CheckCircle className="h-4 w-4 text-green-300" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-300" />
                    )}
                    <p className="text-xs font-medium">Sign-out Status</p>
                  </div>
                  {myParticipation.signOutEligible ? (
                    <p className="text-sm font-bold text-green-300 mt-1">ELIGIBLE FOR SIGN-OUT</p>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-red-300 mt-1">NOT YET ELIGIBLE</p>
                      {myParticipation.requirementsNotMet.length > 0 && (
                        <div className="mt-1.5 space-y-0.5">
                          {myParticipation.requirementsNotMet.slice(0, 3).map((r, i) => (
                            <p key={i} className="text-xs text-red-200">• {r}</p>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* CBT Status Card - Dashboard Summary */}
          <div className="mt-6 bg-white/15 backdrop-blur rounded-xl p-5 border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-7 w-7" />
                <div>
                  <h3 className="font-bold text-lg">Weekly CBT Status</h3>
                  <p className="text-sm text-green-100">Computer-Based Test • 25 MCQs • 10 min</p>
                </div>
              </div>
              <button
                onClick={() => setShowCBT(true)}
                className="px-4 py-2 bg-white text-green-700 rounded-lg font-semibold hover:bg-green-50 transition-colors flex items-center gap-2"
              >
                {cbtWeeklyStatus.attempted ? 'View Tests' : 'Take CBT'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {cbtProgress && (
              <>
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{cbtProgress.completedTests} of {cbtProgress.totalTests} tests completed</span>
                    <span className="font-bold">{Math.round(cbtProgress.cumulativeAverage)}% avg</span>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${cbtProgress.cumulativeAverage >= 75 ? 'bg-yellow-400' : 'bg-white/70'}`}
                      style={{ width: `${Math.min(100, (cbtProgress.completedTests / cbtProgress.totalTests) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Status Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  {/* Cumulative Average */}
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-green-100 text-xs">Cumulative Avg</p>
                    <p className={`text-xl font-bold ${cbtProgress.cumulativeAverage >= 75 ? 'text-yellow-300' : 'text-white'}`}>
                      {Math.round(cbtProgress.cumulativeAverage)}%
                    </p>
                  </div>

                  {/* Pass Mark */}
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-green-100 text-xs">Pass Mark</p>
                    <p className="text-xl font-bold">75%</p>
                  </div>

                  {/* Posting Cycle */}
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-green-100 text-xs">Posting Cycle</p>
                    <p className="text-xl font-bold">{cbtProgress.currentPostingCycle}</p>
                  </div>

                  {/* Sign-out Status */}
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <p className="text-green-100 text-xs">Sign-out</p>
                    {cbtProgress.passMarkReached ? (
                      <p className="text-lg font-bold text-yellow-300">✓ Eligible</p>
                    ) : (
                      <p className="text-lg font-bold text-red-300">✗ Not yet</p>
                    )}
                  </div>
                </div>

                {/* Weekly Limit Banner */}
                {cbtWeeklyStatus.attempted ? (
                  <div className="mt-3 bg-red-500/30 border border-red-300/30 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
                    <span className="text-red-200">⏳</span>
                    <span>Weekly limit reached. Last attempt: {cbtWeeklyStatus.lastAttemptDate ? new Date(cbtWeeklyStatus.lastAttemptDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : 'N/A'}. Come back next week.</span>
                  </div>
                ) : (
                  <div className="mt-3 bg-yellow-500/30 border border-yellow-300/30 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
                    <span className="text-yellow-200">✦</span>
                    <span>You can take your weekly CBT now. Click <strong>"Take CBT"</strong> to begin.</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* CBT & Training Instructions Card */}
          <div className="mt-6 bg-white/15 backdrop-blur rounded-xl p-5 border border-white/20">
            <div className="flex items-center gap-3 mb-4">
              <BookOpen className="h-6 w-6 text-yellow-300" />
              <h3 className="font-bold text-lg">Training & Assessment Instructions</h3>
            </div>
            <div className="space-y-3 text-sm">
              {/* Sign-out Weights */}
              <div className="bg-white/10 rounded-lg p-3">
                <p className="font-semibold text-yellow-300 mb-2">Sign-Out Criteria Weights</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400 inline-block"></span>
                    <span>Patient Care: <strong>70%</strong> (Primary)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-400 inline-block"></span>
                    <span>CBT Tests: <strong>10%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span>
                    <span>Duty Promptness: <strong>10%</strong></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
                    <span>Attendance: <strong>10%</strong></span>
                  </div>
                </div>
                <p className="text-xs text-red-300 mt-2 font-semibold">
                  ⚠ Minimum 6.5% weighted contribution required from EACH section for sign-out eligibility.
                </p>
              </div>
              {/* CBT Instructions */}
              <div className="bg-white/10 rounded-lg p-3">
                <p className="font-semibold text-yellow-300 mb-2">CBT Test Instructions</p>
                <ul className="space-y-1.5 text-green-100 text-xs">
                  <li>• <strong>Frequency:</strong> You may take the CBT <strong>once per week</strong> (resets every Monday)</li>
                  <li>• <strong>Format:</strong> 25 MCQs from your CME training modules • 10-minute time limit</li>
                  <li>• <strong>Pass Mark:</strong> 75% required to pass • Cumulative average tracked</li>
                  <li>• <strong>Anti-Cheating:</strong> Tab switching, screenshots, and screen recording are monitored</li>
                  <li>• <strong>Best Practice:</strong> Study your CME articles thoroughly before attempting</li>
                  <li>• <strong>Tip:</strong> Focus on patient care (70% of sign-out). CBT tests only count for 10%</li>
                </ul>
              </div>
              {/* CME Reading Instructions */}
              <div className="bg-white/10 rounded-lg p-3">
                <p className="font-semibold text-yellow-300 mb-2">CME Article Reading</p>
                <ul className="space-y-1.5 text-green-100 text-xs">
                  <li>• <strong>Reading Tracker:</strong> Your reading is monitored — you must open and read each section</li>
                  <li>• <strong>Minimum Time:</strong> Spend at least 30 seconds on each section to prove reading</li>
                  <li>• <strong>MCQ Unlock:</strong> Self-assessment MCQs only unlock after reading all sections</li>
                  <li>• <strong>Fraud Detection:</strong> Rapid scrolling is detected and will reset your progress</li>
                  <li>• <strong>Completion:</strong> Answer all MCQs correctly after verified reading to mark a topic complete</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Performance Dashboard Button */}
          <button
            onClick={() => setShowPerformance(true)}
            className="mt-4 w-full md:w-auto flex items-center justify-center gap-3 px-6 py-4 bg-white/20 hover:bg-white/30 backdrop-blur rounded-xl font-semibold transition-all group"
          >
            <TrendingUp className="h-6 w-6" />
            <div className="text-left">
              <p className="font-bold">Performance Dashboard</p>
              <p className="text-sm text-white/80">Track progress • Sign-out eligibility</p>
            </div>
            <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Level Tabs */}
        <div className="flex flex-wrap gap-3 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all
                ${activeTab === tab.id 
                  ? `${tab.color} text-white shadow-lg` 
                  : 'bg-white text-gray-600 hover:bg-gray-100 shadow'}`}
            >
              <tab.icon className="h-5 w-5" />
              <div className="text-left">
                <p className="font-semibold">{tab.label}</p>
                <p className={`text-xs ${activeTab === tab.id ? 'text-white/80' : 'text-gray-400'}`}>
                  {tab.description}
                </p>
              </div>
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        {/* Modules List */}
        {filteredModules.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <GraduationCap className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {activeTab === 'house_officer' && searchQuery 
                ? 'No topics match your search'
                : 'Content Coming Soon'
              }
            </h3>
            <p className="text-gray-500">
              {activeTab === 'house_officer' && searchQuery
                ? 'Try a different search term'
                : `${tabs.find(t => t.id === activeTab)?.label} CME content is being developed.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredModules.map(module => (
              <div key={module.id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Module Header */}
                <button
                  onClick={() => toggleModule(module.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Book className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{module.title}</h3>
                      <p className="text-sm text-gray-500">
                        {module.topics.length} topics • 
                        {module.topics.filter(t => completedTopics.has(t.id)).length} completed
                      </p>
                    </div>
                  </div>
                  {expandedModules.has(module.id) ? (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {/* Module Topics */}
                {expandedModules.has(module.id) && (
                  <div className="border-t border-gray-100">
                    {module.topics.map((topic, index) => (
                      <button
                        key={topic.id}
                        onClick={() => handleTopicSelect(topic)}
                        className="w-full flex items-center justify-between p-4 hover:bg-green-50 transition-colors border-b border-gray-50 last:border-b-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                            ${completedTopics.has(topic.id) 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-100 text-gray-500'}`}
                          >
                            {completedTopics.has(topic.id) ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </span>
                          <div className="text-left">
                            <p className={`font-medium ${completedTopics.has(topic.id) ? 'text-green-700' : 'text-gray-700'}`}>
                              {topic.title}
                            </p>
                            {topic.article && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {topic.article.sections?.length || 0} sections • 
                                {topic.article.selfAssessment?.length || 0} MCQs
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalTrainingPage;
