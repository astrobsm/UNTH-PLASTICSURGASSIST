/**
 * RotationManagement Component
 * 
 * Admin interface for:
 * - Setting rotation commencement/end dates per training level
 * - Viewing all trainee analytics and participation
 * - Assessing sign-out eligibility
 * - Assigning and tracking responsibilities
 */

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Award,
  ClipboardList,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Save,
  Plus,
  RefreshCw,
  BarChart3,
  BookOpen,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rotationConfigService, RotationConfig, AssignedResponsibility, TraineeAnalytics } from '../../services/rotationConfigService';
import { TrainingLevel } from '../../services/medicalTrainingService';

const LEVELS: { id: TrainingLevel; label: string; color: string; duration: string }[] = [
  { id: 'house_officer', label: 'House Officer', color: 'blue', duration: '1 Month' },
  { id: 'junior_resident', label: 'Junior Resident', color: 'green', duration: '3 Months' },
  { id: 'senior_resident', label: 'Senior Resident', color: 'purple', duration: '6 Months' },
];

const RotationManagement: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'config' | 'analytics' | 'responsibilities'>('config');
  const [configs, setConfigs] = useState<RotationConfig[]>([]);
  const [analytics, setAnalytics] = useState<TraineeAnalytics[]>([]);
  const [responsibilities, setResponsibilities] = useState<AssignedResponsibility[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedTrainee, setExpandedTrainee] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<TrainingLevel | 'all'>('all');
  
  // Config form state
  const [configForm, setConfigForm] = useState<{
    level: TrainingLevel;
    commencement_date: string;
    end_date: string;
    department: string;
    notes: string;
  }>({
    level: 'house_officer',
    commencement_date: new Date().toISOString().split('T')[0],
    end_date: '',
    department: 'Plastic Surgery',
    notes: ''
  });
  
  // Responsibility form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [respForm, setRespForm] = useState({
    user_id: '',
    title: '',
    description: '',
    priority: 'medium' as AssignedResponsibility['priority'],
    due_date: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfgs, allAnalytics] = await Promise.all([
        Promise.resolve(rotationConfigService.getRotationConfigs()),
        rotationConfigService.getAllTraineeAnalytics()
      ]);
      setConfigs(cfgs);
      setAnalytics(allAnalytics);
      
      // Load responsibilities
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const resp = await fetch('/api/rotation-config?action=all-responsibilities', {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (resp.ok) {
            const data = await resp.json();
            setResponsibilities(data.responsibilities || []);
          }
        }
      } catch { /* Use local */ }
      
      // Fallback: load local responsibilities
      if (responsibilities.length === 0) {
        setResponsibilities(rotationConfigService.getResponsibilities());
      }
    } catch (error) {
      console.error('Failed to load rotation data:', error);
      toast.error('Failed to load rotation data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!configForm.commencement_date || !configForm.end_date) {
      toast.error('Please set both commencement and end dates');
      return;
    }
    
    if (new Date(configForm.end_date) <= new Date(configForm.commencement_date)) {
      toast.error('End date must be after commencement date');
      return;
    }

    try {
      await rotationConfigService.saveRotationConfig({
        level: configForm.level,
        commencement_date: configForm.commencement_date,
        end_date: configForm.end_date,
        department: configForm.department,
        is_active: true,
        notes: configForm.notes
      });
      toast.success(`Rotation config saved for ${LEVELS.find(l => l.id === configForm.level)?.label}`);
      await loadData();
    } catch (error) {
      toast.error('Failed to save rotation config');
    }
  };

  const handleAssignResponsibility = async () => {
    if (!respForm.user_id || !respForm.title) {
      toast.error('Please select a user and enter a title');
      return;
    }

    try {
      const assignerName = localStorage.getItem('userName') || 'Admin';
      await rotationConfigService.assignResponsibility({
        user_id: respForm.user_id,
        title: respForm.title,
        description: respForm.description,
        assigned_by: localStorage.getItem('userId') || '',
        assigned_by_name: assignerName,
        priority: respForm.priority,
        due_date: respForm.due_date || undefined,
      });
      toast.success('Responsibility assigned successfully');
      setShowAssignForm(false);
      setRespForm({ user_id: '', title: '', description: '', priority: 'medium', due_date: '' });
      await loadData();
    } catch (error) {
      toast.error('Failed to assign responsibility');
    }
  };

  const handleDeactivateConfig = async (configId: string) => {
    try {
      await rotationConfigService.deactivateRotationConfig(configId);
      toast.success('Rotation config deactivated');
      await loadData();
    } catch (error) {
      toast.error('Failed to deactivate config');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const filteredAnalytics = filterLevel === 'all' 
    ? analytics 
    : analytics.filter(a => a.level === filterLevel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-6 w-6 text-green-600" />
            Rotation & Training Management
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Set rotation dates, track participation, and assess sign-out eligibility
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          { id: 'config' as const, label: 'Rotation Config', icon: Calendar },
          { id: 'analytics' as const, label: 'Trainee Analytics', icon: BarChart3 },
          { id: 'responsibilities' as const, label: 'Responsibilities', icon: ClipboardList }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition text-sm ${
              activeSection === tab.id
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ======== ROTATION CONFIG SECTION ======== */}
      {activeSection === 'config' && (
        <div className="space-y-6">
          {/* Config Form */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Plus className="h-5 w-5 text-green-600" />
              Set Rotation Dates
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Training Level *</label>
                <select
                  value={configForm.level}
                  onChange={(e) => setConfigForm({ ...configForm, level: e.target.value as TrainingLevel })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  {LEVELS.map(l => (
                    <option key={l.id} value={l.id}>{l.label} ({l.duration})</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commencement Date *</label>
                <input
                  type="date"
                  value={configForm.commencement_date}
                  onChange={(e) => setConfigForm({ ...configForm, commencement_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                <input
                  type="date"
                  value={configForm.end_date}
                  onChange={(e) => setConfigForm({ ...configForm, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <input
                  type="text"
                  value={configForm.department}
                  onChange={(e) => setConfigForm({ ...configForm, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={configForm.notes}
                  onChange={(e) => setConfigForm({ ...configForm, notes: e.target.value })}
                  placeholder="Optional notes about this rotation period..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            
            <div className="mt-4 flex gap-3">
              <button
                onClick={handleSaveConfig}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition"
              >
                <Save className="h-4 w-4" />
                Save Rotation Config
              </button>
            </div>
          </div>

          {/* Active Configs */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-600" />
                Active Rotation Periods
              </h3>
            </div>
            
            {configs.filter(c => c.is_active).length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No active rotation configs. Set rotation dates above.</p>
              </div>
            ) : (
              <div className="divide-y">
                {configs.filter(c => c.is_active).map(config => {
                  const start = new Date(config.commencement_date);
                  const end = new Date(config.end_date);
                  const now = new Date();
                  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
                  const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
                  const remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
                  const progress = totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 0;
                  const levelInfo = LEVELS.find(l => l.id === config.level);
                  
                  return (
                    <div key={config.id} className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${levelInfo?.color || 'gray'}-100 text-${levelInfo?.color || 'gray'}-700`}>
                            {levelInfo?.label || config.level}
                          </span>
                          <span className="text-sm text-gray-500">{config.department}</span>
                        </div>
                        <button
                          onClick={() => handleDeactivateConfig(config.id!)}
                          className="text-sm text-red-600 hover:text-red-800 font-medium"
                        >
                          Deactivate
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Commencement</span>
                          <p className="font-semibold">{start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">End Date</span>
                          <p className="font-semibold">{end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Days Remaining</span>
                          <p className={`font-semibold ${remaining <= 7 ? 'text-red-600' : remaining <= 14 ? 'text-amber-600' : 'text-green-600'}`}>
                            {remaining} days
                          </p>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${progress >= 90 ? 'bg-red-500' : progress >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{progress}% elapsed ({elapsed}/{totalDays} days)</p>
                      
                      {config.notes && (
                        <p className="text-sm text-gray-600 mt-2 italic">Note: {config.notes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== TRAINEE ANALYTICS SECTION ======== */}
      {activeSection === 'analytics' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-600">Filter:</span>
            <button
              onClick={() => setFilterLevel('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                filterLevel === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All ({analytics.length})
            </button>
            {LEVELS.map(l => {
              const count = analytics.filter(a => a.level === l.id).length;
              return (
                <button
                  key={l.id}
                  onClick={() => setFilterLevel(l.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    filterLevel === l.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {l.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Users className="h-4 w-4" />
                Total Trainees
              </div>
              <p className="text-2xl font-bold text-gray-900">{filteredAnalytics.length}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Sign-out Eligible
              </div>
              <p className="text-2xl font-bold text-green-600">
                {filteredAnalytics.filter(a => a.signOutEligible).length}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Avg Score
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {filteredAnalytics.length > 0 
                  ? Math.round(filteredAnalytics.reduce((s, a) => s + a.overallScore, 0) / filteredAnalytics.length)
                  : 0}%
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Below Threshold
              </div>
              <p className="text-2xl font-bold text-red-600">
                {filteredAnalytics.filter(a => a.overallScore < 70).length}
              </p>
            </div>
          </div>

          {/* Trainee List */}
          {filteredAnalytics.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Trainee Data Available</h3>
              <p className="text-gray-500 text-sm">
                Trainee analytics will appear here as users participate in training activities.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAnalytics.map(trainee => {
                const isExpanded = expandedTrainee === trainee.userId;
                const levelInfo = LEVELS.find(l => l.id === trainee.level);
                
                return (
                  <div key={trainee.userId} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    {/* Trainee Header Row */}
                    <button
                      onClick={() => setExpandedTrainee(isExpanded ? null : trainee.userId)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          trainee.signOutEligible ? 'bg-green-500' : trainee.overallScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                        }`}>
                          {trainee.overallScore}%
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{trainee.userName}</p>
                          <div className="flex items-center gap-2 text-sm">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium bg-${levelInfo?.color || 'gray'}-100 text-${levelInfo?.color || 'gray'}-700`}>
                              {levelInfo?.label || trainee.level}
                            </span>
                            {trainee.daysRemaining > 0 && (
                              <span className="text-gray-500">{trainee.daysRemaining}d remaining</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {trainee.signOutEligible ? (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 flex items-center gap-1">
                            <CheckCircle className="h-3.5 w-3.5" /> ELIGIBLE
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 flex items-center gap-1">
                            <XCircle className="h-3.5 w-3.5" /> NOT ELIGIBLE
                          </span>
                        )}
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
                      </div>
                    </button>
                    
                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t bg-gray-50 p-5">
                        {/* Rotation Progress */}
                        {trainee.rotationStart && trainee.rotationEnd && (
                          <div className="mb-5">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                              <Calendar className="h-4 w-4" /> Rotation Period
                            </h4>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                              <span>Start: <strong>{new Date(trainee.rotationStart).toLocaleDateString()}</strong></span>
                              <span>End: <strong>{new Date(trainee.rotationEnd).toLocaleDateString()}</strong></span>
                              <span className={`font-bold ${trainee.daysRemaining <= 7 ? 'text-red-600' : 'text-green-600'}`}>
                                {trainee.daysRemaining}d left
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${trainee.progressPercent >= 90 ? 'bg-red-500' : trainee.progressPercent >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                                style={{ width: `${trainee.progressPercent}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trainee.progressPercent}% elapsed</p>
                          </div>
                        )}
                        
                        {/* Performance Metrics Grid */}
                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" /> Performance Breakdown
                        </h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                          {/* CBT */}
                          <div className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 font-medium">CBT Score</span>
                              <span className="text-xs text-gray-400">30%</span>
                            </div>
                            <p className={`text-xl font-bold ${getScoreColor(trainee.cbtScore)}`}>{trainee.cbtScore}%</p>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                              <div className={`h-1.5 rounded-full ${getScoreBg(trainee.cbtScore)}`} style={{ width: `${trainee.cbtScore}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trainee.cbtTestsCompleted}/{trainee.cbtTestsRequired} tests</p>
                          </div>
                          
                          {/* Patient Care */}
                          <div className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 font-medium">Patient Care</span>
                              <span className="text-xs text-gray-400">35%</span>
                            </div>
                            <p className={`text-xl font-bold ${getScoreColor(trainee.patientCareScore)}`}>{trainee.patientCareScore}%</p>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                              <div className={`h-1.5 rounded-full ${getScoreBg(trainee.patientCareScore)}`} style={{ width: `${trainee.patientCareScore}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trainee.patientEntries}/{trainee.patientEntriesRequired} entries</p>
                          </div>
                          
                          {/* Duty Promptness */}
                          <div className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 font-medium">Duty Resp.</span>
                              <span className="text-xs text-gray-400">25%</span>
                            </div>
                            <p className={`text-xl font-bold ${getScoreColor(trainee.dutyPromptnessScore)}`}>{trainee.dutyPromptnessScore}%</p>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                              <div className={`h-1.5 rounded-full ${getScoreBg(trainee.dutyPromptnessScore)}`} style={{ width: `${trainee.dutyPromptnessScore}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trainee.dutiesCompleted}/{trainee.dutiesRequired} duties</p>
                          </div>
                          
                          {/* Attendance */}
                          <div className="bg-white rounded-lg border p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-gray-500 font-medium">Attendance</span>
                              <span className="text-xs text-gray-400">10%</span>
                            </div>
                            <p className={`text-xl font-bold ${getScoreColor(trainee.attendanceScore)}`}>{trainee.attendanceScore}%</p>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                              <div className={`h-1.5 rounded-full ${getScoreBg(trainee.attendanceScore)}`} style={{ width: `${trainee.attendanceScore}%` }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trainee.loginDays}/{trainee.loginDaysRequired} days</p>
                          </div>
                        </div>
                        
                        {/* Additional Stats */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                          {/* CME Progress */}
                          <div className="bg-white rounded-lg border p-3">
                            <h5 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                              <BookOpen className="h-3.5 w-3.5" /> CME Topic Progress
                            </h5>
                            <div className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="w-full bg-gray-100 rounded-full h-2">
                                  <div className="h-2 rounded-full bg-blue-500" style={{ width: `${trainee.cmeProgress}%` }} />
                                </div>
                              </div>
                              <span className="text-sm font-bold text-gray-700">{trainee.cmeProgress}%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{trainee.topicsCompleted}/{trainee.totalTopics} topics completed</p>
                          </div>
                          
                          {/* Responsibilities */}
                          <div className="bg-white rounded-lg border p-3">
                            <h5 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
                              <Target className="h-3.5 w-3.5" /> Assigned Responsibilities
                            </h5>
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <p className="text-lg font-bold text-gray-800">{trainee.assignedResponsibilities}</p>
                                <p className="text-xs text-gray-500">Total</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-green-600">{trainee.completedResponsibilities}</p>
                                <p className="text-xs text-gray-500">Done</p>
                              </div>
                              <div className="text-center">
                                <p className="text-lg font-bold text-amber-600">{trainee.pendingResponsibilities}</p>
                                <p className="text-xs text-gray-500">Pending</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Requirements Status */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                          <div>
                            <h5 className="text-xs font-semibold text-green-700 mb-1">Requirements Met</h5>
                            {trainee.requirementsMet.length > 0 ? (
                              <ul className="space-y-1">
                                {trainee.requirementsMet.map((r, i) => (
                                  <li key={i} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" /> {r}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-gray-400">None yet</p>
                            )}
                          </div>
                          <div>
                            <h5 className="text-xs font-semibold text-red-700 mb-1">Requirements Not Met</h5>
                            {trainee.requirementsNotMet.length > 0 ? (
                              <ul className="space-y-1">
                                {trainee.requirementsNotMet.map((r, i) => (
                                  <li key={i} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded flex items-center gap-1">
                                    <XCircle className="h-3 w-3" /> {r}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-green-600 font-medium">All requirements met!</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======== RESPONSIBILITIES SECTION ======== */}
      {activeSection === 'responsibilities' && (
        <div className="space-y-4">
          {/* Assign Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-800">Assigned Responsibilities</h3>
            <button
              onClick={() => setShowAssignForm(!showAssignForm)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition"
            >
              <Plus className="h-4 w-4" />
              Assign New
            </button>
          </div>
          
          {/* Assign Form */}
          {showAssignForm && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h4 className="font-semibold text-gray-800 mb-4">Assign Responsibility</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trainee *</label>
                  <select
                    value={respForm.user_id}
                    onChange={(e) => setRespForm({ ...respForm, user_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select trainee...</option>
                    {analytics.map(a => (
                      <option key={a.userId} value={a.userId}>{a.userName} ({LEVELS.find(l => l.id === a.level)?.label})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    value={respForm.title}
                    onChange={(e) => setRespForm({ ...respForm, title: e.target.value })}
                    placeholder="e.g., Present ward round case summary"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={respForm.description}
                    onChange={(e) => setRespForm({ ...respForm, description: e.target.value })}
                    placeholder="Detailed description of the responsibility..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={respForm.priority}
                    onChange={(e) => setRespForm({ ...respForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={respForm.due_date}
                    onChange={(e) => setRespForm({ ...respForm, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleAssignResponsibility}
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm transition"
                >
                  Assign
                </button>
                <button
                  onClick={() => setShowAssignForm(false)}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          {/* Responsibilities List */}
          {responsibilities.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center">
              <ClipboardList className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No Responsibilities Assigned</h3>
              <p className="text-gray-500 text-sm">Assign responsibilities to trainees using the button above.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trainee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsibility</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {responsibilities.map(resp => (
                      <tr key={resp.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {resp.user_name || resp.user_id}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-900">{resp.title}</p>
                          {resp.description && (
                            <p className="text-xs text-gray-500 truncate max-w-xs">{resp.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            resp.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            resp.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                            resp.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {resp.priority.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            resp.status === 'completed' ? 'bg-green-100 text-green-700' :
                            resp.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                            resp.status === 'overdue' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {resp.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {resp.due_date ? new Date(resp.due_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {resp.assigned_at ? new Date(resp.assigned_at).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RotationManagement;
