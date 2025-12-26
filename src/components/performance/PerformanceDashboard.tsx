/**
 * Performance Dashboard Component
 * Displays trainee performance metrics, progress, and sign-out eligibility
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  performanceService, 
  PerformanceMetrics, 
  TraineeProfile,
  ActivityLog,
  DutyAssignment,
  SIGN_OUT_THRESHOLD,
  ROTATION_DURATIONS,
  MINIMUM_REQUIREMENTS
} from '../../services/performanceService';
import { TrainingLevel } from '../../services/medicalTrainingService';

interface PerformanceDashboardProps {
  level: TrainingLevel;
  onBack: () => void;
}

const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ level, onBack }) => {
  const [profile, setProfile] = useState<TraineeProfile | null>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'activities' | 'duties' | 'improvement'>('overview');
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  
  useEffect(() => {
    loadProfile();
  }, [level]);
  
  const loadProfile = () => {
    const p = performanceService.getTraineeProfile();
    setProfile(p);
  };
  
  const eligibility = useMemo(() => {
    if (!profile) return null;
    return performanceService.checkSignOutEligibility(profile.userId, level);
  }, [profile, level]);
  
  const improvementPlan = useMemo(() => {
    if (!profile || !eligibility || eligibility.eligible) return null;
    return performanceService.generateImprovementPlan(profile.userId, level);
  }, [profile, eligibility, level]);
  
  const getLevelDisplayName = (lvl: TrainingLevel): string => {
    switch (lvl) {
      case 'house_officer': return 'House Officer';
      case 'junior_resident': return 'Junior Resident';
      case 'senior_resident': return 'Senior Resident';
      default: return '';
    }
  };
  
  const getRotationDuration = (lvl: TrainingLevel): string => {
    switch (lvl) {
      case 'house_officer': return '1 Month';
      case 'junior_resident': return '3 Months';
      case 'senior_resident': return '6 Months';
      default: return '';
    }
  };
  
  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 70) return 'text-blue-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };
  
  const getScoreBgColor = (score: number): string => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 70) return 'bg-blue-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };
  
  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };
  
  const formatTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (!profile || !eligibility) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full" />
      </div>
    );
  }
  
  const { metrics } = profile.performance ? { metrics: profile.performance } : { metrics: eligibility.metrics };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`${metrics.overallScore >= SIGN_OUT_THRESHOLD ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-amber-600 to-amber-700'} text-white`}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Training
          </button>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Performance Dashboard</h1>
              <p className="text-white/90 mt-1">
                {getLevelDisplayName(level)} • {getRotationDuration(level)} Rotation
              </p>
            </div>
            
            {/* Overall Score Circle */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    fill="none"
                    stroke="white"
                    strokeWidth="8"
                    strokeDasharray={`${(metrics.overallScore / 100) * 251.2} 251.2`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{metrics.overallScore.toFixed(0)}%</span>
                  <span className="text-xs text-white/80">Overall</span>
                </div>
              </div>
              
              <div className="text-right">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  eligibility.eligible 
                    ? 'bg-green-400 text-green-900' 
                    : 'bg-amber-400 text-amber-900'
                }`}>
                  {eligibility.eligible ? '✓ Ready for Sign-Out' : 'In Progress'}
                </div>
                <p className="text-sm text-white/80 mt-2">
                  {eligibility.daysRemaining > 0 
                    ? `${eligibility.daysRemaining} days remaining`
                    : profile.requiresExtension 
                      ? 'Extension required'
                      : 'Review period'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Navigation Tabs */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'activities', label: 'Activities', icon: '📋' },
              { id: 'duties', label: 'Duties', icon: '✅' },
              { id: 'improvement', label: 'Improvement Plan', icon: '📈' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeSection === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Overview Section */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Performance Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* CBT Score */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 text-sm font-medium">CBT Score</span>
                  <span className="text-2xl">📝</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold ${getScoreColor(metrics.cbtScore)}`}>
                    {metrics.cbtScore.toFixed(0)}%
                  </span>
                  <span className="text-gray-400 text-sm mb-1">/ 100%</span>
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getScoreBgColor(metrics.cbtScore)} transition-all duration-500`}
                    style={{ width: `${metrics.cbtScore}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Weight: 30%</p>
              </div>
              
              {/* Patient Care Score */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 text-sm font-medium">Patient Care</span>
                  <span className="text-2xl">🏥</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold ${getScoreColor(metrics.patientCareScore)}`}>
                    {metrics.patientCareScore.toFixed(0)}%
                  </span>
                  <span className="text-gray-400 text-sm mb-1">/ 100%</span>
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getScoreBgColor(metrics.patientCareScore)} transition-all duration-500`}
                    style={{ width: `${metrics.patientCareScore}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Weight: 35%</p>
              </div>
              
              {/* Duty Promptness */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 text-sm font-medium">Duty Promptness</span>
                  <span className="text-2xl">⏱️</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold ${getScoreColor(metrics.dutyPromptnessScore)}`}>
                    {metrics.dutyPromptnessScore.toFixed(0)}%
                  </span>
                  <span className="text-gray-400 text-sm mb-1">/ 100%</span>
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getScoreBgColor(metrics.dutyPromptnessScore)} transition-all duration-500`}
                    style={{ width: `${metrics.dutyPromptnessScore}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Weight: 25%</p>
              </div>
              
              {/* Attendance */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 text-sm font-medium">Attendance</span>
                  <span className="text-2xl">📅</span>
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold ${getScoreColor(metrics.attendanceScore)}`}>
                    {metrics.attendanceScore.toFixed(0)}%
                  </span>
                  <span className="text-gray-400 text-sm mb-1">/ 100%</span>
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${getScoreBgColor(metrics.attendanceScore)} transition-all duration-500`}
                    style={{ width: `${metrics.attendanceScore}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Weight: 10%</p>
              </div>
            </div>
            
            {/* Requirements Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Requirements Met */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    ✓
                  </span>
                  Requirements Met
                </h3>
                {eligibility.requirements.met.length > 0 ? (
                  <ul className="space-y-2">
                    {eligibility.requirements.met.map((req, index) => (
                      <li key={index} className="flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                        <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm">{req}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 text-sm">No requirements met yet. Keep working!</p>
                )}
              </div>
              
              {/* Requirements Pending */}
              <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                    ⏳
                  </span>
                  Requirements Pending
                </h3>
                {eligibility.requirements.notMet.length > 0 ? (
                  <ul className="space-y-2">
                    {eligibility.requirements.notMet.map((req, index) => (
                      <li key={index} className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                        <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm">{req}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-green-600 font-medium">All requirements met! 🎉</p>
                )}
              </div>
            </div>
            
            {/* Recommendation Card */}
            <div className={`rounded-xl p-6 ${
              eligibility.eligible 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-blue-50 border border-blue-200'
            }`}>
              <h3 className={`font-semibold mb-2 ${eligibility.eligible ? 'text-green-800' : 'text-blue-800'}`}>
                {eligibility.eligible ? '🎉 Congratulations!' : '💡 Recommendation'}
              </h3>
              <p className={eligibility.eligible ? 'text-green-700' : 'text-blue-700'}>
                {eligibility.recommendation}
              </p>
              
              {eligibility.eligible && (
                <button
                  onClick={() => setShowSignOutModal(true)}
                  className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  Request Sign-Out Approval
                </button>
              )}
            </div>
            
            {/* Rotation Timeline */}
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Rotation Timeline</h3>
              <div className="relative">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, ((ROTATION_DURATIONS[level] - eligibility.daysRemaining) / ROTATION_DURATIONS[level]) * 100)}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-gray-500">
                    Start: {formatDate(profile.currentRotation.startDate)}
                  </span>
                  <span className="text-gray-500">
                    End: {formatDate(profile.currentRotation.expectedEndDate)}
                  </span>
                </div>
                {profile.currentRotation.extensionCount > 0 && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-amber-800 text-sm">
                      <strong>Extensions:</strong> {profile.currentRotation.extensionCount}
                    </p>
                    <ul className="mt-1 text-xs text-amber-600">
                      {profile.currentRotation.extensionReasons.map((reason, i) => (
                        <li key={i}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Activities Section */}
        {activeSection === 'activities' && (
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-800">Activity Log</h3>
              <p className="text-gray-500 text-sm mt-1">
                All your logged activities during this rotation
              </p>
            </div>
            
            {profile.activities.length > 0 ? (
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {profile.activities
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .map(activity => (
                    <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                            activity.type === 'login' ? 'bg-blue-100' :
                            activity.type.includes('patient') ? 'bg-green-100' :
                            activity.type.includes('duty') ? 'bg-purple-100' :
                            'bg-gray-100'
                          }`}>
                            {activity.type === 'login' ? '🔑' :
                             activity.type === 'patient_entry' ? '📝' :
                             activity.type === 'patient_update' ? '✏️' :
                             activity.type === 'treatment_plan' ? '📋' :
                             activity.type === 'prescription' ? '💊' :
                             activity.type === 'wound_care' ? '🩹' :
                             activity.type === 'surgery_booking' ? '🏥' :
                             activity.type === 'lab_order' ? '🧪' :
                             activity.type === 'discharge_summary' ? '📤' :
                             activity.type === 'ward_round' ? '👥' :
                             activity.type === 'duty_response' ? '⚡' :
                             activity.type === 'cbt_completed' ? '📊' :
                             activity.type === 'cme_completed' ? '📚' : '📌'}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{activity.description}</p>
                            <p className="text-sm text-gray-500">
                              {activity.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            +{activity.points} pts
                          </span>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDate(activity.timestamp)} {formatTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center text-3xl mb-4">
                  📋
                </div>
                <h4 className="font-medium text-gray-700 mb-2">No Activities Yet</h4>
                <p className="text-gray-500 text-sm">
                  Your activities will appear here as you work on patient care.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Duties Section */}
        {activeSection === 'duties' && (
          <div className="space-y-6">
            {/* Pending Duties */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-800">Pending Duties</h3>
              </div>
              {profile.duties.filter(d => d.status === 'pending' || d.status === 'in_progress').length > 0 ? (
                <div className="divide-y">
                  {profile.duties
                    .filter(d => d.status === 'pending' || d.status === 'in_progress')
                    .map(duty => (
                      <div key={duty.id} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                duty.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                                duty.priority === 'high' ? 'bg-amber-100 text-amber-700' :
                                duty.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {duty.priority.toUpperCase()}
                              </span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                duty.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {duty.status.replace('_', ' ').toUpperCase()}
                              </span>
                            </div>
                            <h4 className="font-medium text-gray-800">{duty.title}</h4>
                            <p className="text-sm text-gray-500">{duty.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm text-gray-500">Due</p>
                            <p className="font-medium text-gray-800">{formatTime(duty.dueAt)}</p>
                            <p className="text-xs text-gray-400">{formatDate(duty.dueAt)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {duty.status === 'pending' && (
                            <button
                              onClick={() => {
                                performanceService.respondToDuty(duty.id);
                                loadProfile();
                              }}
                              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Respond
                            </button>
                          )}
                          {duty.status === 'in_progress' && (
                            <button
                              onClick={() => {
                                performanceService.completeDuty(duty.id);
                                loadProfile();
                              }}
                              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                              Mark Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No pending duties. Great job staying on top of things!</p>
                </div>
              )}
            </div>
            
            {/* Completed Duties */}
            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-6 border-b">
                <h3 className="text-lg font-semibold text-gray-800">Completed Duties</h3>
              </div>
              {profile.duties.filter(d => d.status === 'completed').length > 0 ? (
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {profile.duties
                    .filter(d => d.status === 'completed')
                    .map(duty => (
                      <div key={duty.id} className="p-4 bg-green-50/50">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-medium text-gray-800 flex items-center gap-2">
                              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {duty.title}
                            </h4>
                            <p className="text-sm text-gray-500">{duty.description}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {duty.promptnessScore !== undefined && (
                              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                duty.promptnessScore >= 90 ? 'bg-green-100 text-green-700' :
                                duty.promptnessScore >= 70 ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                {duty.promptnessScore}% prompt
                              </span>
                            )}
                            <p className="text-xs text-gray-400 mt-1">
                              Completed {formatDate(duty.completedAt!)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="p-8 text-center">
                  <p className="text-gray-500">No completed duties yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Improvement Plan Section */}
        {activeSection === 'improvement' && (
          <div className="space-y-6">
            {eligibility.eligible ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
                <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center text-3xl mb-4">
                  🎉
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">No Improvement Needed!</h3>
                <p className="text-green-700">
                  You have met all requirements for sign-out. Congratulations on your excellent performance!
                </p>
              </div>
            ) : improvementPlan ? (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">Performance Improvement Plan</h3>
                  <p className="text-blue-700">
                    Based on your current performance, here's a personalized plan to help you reach the 70% threshold.
                  </p>
                  <p className="text-sm text-blue-600 mt-2">
                    Estimated completion: {formatDate(improvementPlan.estimatedCompletionDate)}
                  </p>
                </div>
                
                {/* Focus Areas */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {improvementPlan.focusAreas.map((area, index) => (
                      <span 
                        key={index}
                        className="px-4 py-2 bg-amber-100 text-amber-800 rounded-full font-medium"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Weekly Targets */}
                <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="p-6 border-b">
                    <h3 className="text-lg font-semibold text-gray-800">Weekly Targets</h3>
                  </div>
                  <div className="divide-y">
                    {improvementPlan.weeklyTargets.map(target => (
                      <div key={target.week} className="p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold">
                            {target.week}
                          </span>
                          <span className="font-medium text-gray-800">Week {target.week}</span>
                        </div>
                        <div className="pl-11 space-y-2">
                          <div className="flex items-start gap-2">
                            <span className="text-lg">📝</span>
                            <p className="text-sm text-gray-600">{target.cbtTarget}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-lg">🏥</span>
                            <p className="text-sm text-gray-600">{target.activityTarget}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-lg">⏱️</span>
                            <p className="text-sm text-gray-600">{target.dutyTarget}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center">
                <p className="text-gray-500">Unable to generate improvement plan. Please check your performance data.</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Sign-Out Request Modal */}
      {showSignOutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-green-500 p-6 text-white">
              <h2 className="text-xl font-bold">Request Sign-Out</h2>
              <p className="text-green-100 mt-1">Submit your rotation completion request</p>
            </div>
            <div className="p-6">
              <div className="bg-green-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Overall Score</span>
                    <p className="font-bold text-green-600">{metrics.overallScore.toFixed(0)}%</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Level</span>
                    <p className="font-bold text-gray-800">{getLevelDisplayName(level)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Rotation Duration</span>
                    <p className="font-bold text-gray-800">{getRotationDuration(level)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status</span>
                    <p className="font-bold text-green-600">Eligible ✓</p>
                  </div>
                </div>
              </div>
              
              <p className="text-gray-600 text-sm mb-4">
                Your sign-out request will be sent to your supervisor for approval. 
                Please ensure all your documentation is complete.
              </p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSignOutModal(false)}
                  className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // In production, this would send to API
                    alert('Sign-out request submitted successfully! Your supervisor will review and approve.');
                    setShowSignOutModal(false);
                  }}
                  className="flex-1 py-2 px-4 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceDashboard;
