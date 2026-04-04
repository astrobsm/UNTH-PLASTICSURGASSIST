import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Scale, Calendar, Clock, Plus, Eye, Edit, Trash2, History, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DVTRiskAssessment, PressureSoreRiskAssessment, NutritionalRiskAssessment, BaseRiskAssessment } from '../../services/riskAssessmentService';
import { db } from '../../db/database';

interface RiskAssessmentSummaryProps {
  patientId: string;
  onCreateAssessment?: (type: 'dvt' | 'pressure_sore' | 'nutritional') => void;
  onViewAssessment?: (assessment: BaseRiskAssessment) => void;
  onEditAssessment?: (assessment: BaseRiskAssessment) => void;
  onDeleteAssessment?: (assessment: BaseRiskAssessment) => void;
}

interface AssessmentSummary {
  id: string;
  type: 'dvt' | 'pressure_sore' | 'nutritional';
  riskLevel: 'low' | 'moderate' | 'medium' | 'high' | 'very_high';
  score: number;
  assessmentDate: Date;
  assessedBy: string;
  nextDue: Date;
  status: 'active' | 'archived';
  urgent: boolean;
}

export const RiskAssessmentSummary: React.FC<RiskAssessmentSummaryProps> = ({
  patientId,
  onCreateAssessment,
  onViewAssessment,
  onEditAssessment,
  onDeleteAssessment
}) => {
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [allHistory, setAllHistory] = useState<AssessmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistoryType, setShowHistoryType] = useState<string | null>(null);
  const [showNewAssessmentPreview, setShowNewAssessmentPreview] = useState<'dvt' | 'pressure_sore' | 'nutritional' | null>(null);

  useEffect(() => {
    loadAssessments();
  }, [patientId]);

  const loadAssessments = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load ALL assessment types for the patient (including archived for history)
      // Use toArray + filter to handle string/number patient_id mismatch
      const [allDvt, allPressure, allNutritional] = await Promise.all([
        db.dvt_assessments.toArray(),
        db.pressure_sore_assessments.toArray(),
        db.nutritional_assessments.toArray()
      ]);
      const dvtAssessments = allDvt.filter(a => String(a.patient_id) === String(patientId));
      const pressureSoreAssessments = allPressure.filter(a => String(a.patient_id) === String(patientId));
      const nutritionalAssessments = allNutritional.filter(a => String(a.patient_id) === String(patientId));

      // Convert to summary format — ALL assessments for chronological history
      const allAssessments: AssessmentSummary[] = [
        ...dvtAssessments.map(a => ({
          id: a.id!,
          type: 'dvt' as const,
          riskLevel: a.risk_level,
          score: a.score,
          assessmentDate: new Date(a.assessment_date),
          assessedBy: a.assessed_by,
          nextDue: new Date(a.next_assessment_due),
          status: a.status as 'active' | 'archived',
          urgent: a.risk_level === 'high' || isOverdue(new Date(a.next_assessment_due))
        })),
        ...pressureSoreAssessments.map(a => ({
          id: a.id!,
          type: 'pressure_sore' as const,
          riskLevel: a.risk_level,
          score: a.score,
          assessmentDate: new Date(a.assessment_date),
          assessedBy: a.assessed_by,
          nextDue: new Date(a.next_assessment_due),
          status: a.status as 'active' | 'archived',
          urgent: a.risk_level === 'high' || a.risk_level === 'very_high' || isOverdue(new Date(a.next_assessment_due))
        })),
        ...nutritionalAssessments.map(a => ({
          id: a.id!,
          type: 'nutritional' as const,
          riskLevel: a.risk_level,
          score: a.score,
          assessmentDate: new Date(a.assessment_date),
          assessedBy: a.assessed_by,
          nextDue: new Date(a.next_assessment_due),
          status: a.status as 'active' | 'archived',
          urgent: a.risk_level === 'high' || isOverdue(new Date(a.next_assessment_due))
        }))
      ];

      // Sort by urgency and date
      allAssessments.sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return b.assessmentDate.getTime() - a.assessmentDate.getTime();
      });

      // Store full chronological history
      setAllHistory(allAssessments);
      // Active assessments for the main display
      setAssessments(allAssessments.filter(a => a.status === 'active'));
    } catch (err) {
      console.error('Error loading risk assessments:', err);
      setError('Failed to load risk assessments');
    } finally {
      setLoading(false);
    }
  };

  const isOverdue = (date: Date): boolean => {
    return date < new Date();
  };

  const getRiskColor = (riskLevel: string, urgent: boolean = false) => {
    if (urgent) return 'text-red-700 bg-red-100 border-red-200';
    
    switch (riskLevel) {
      case 'low': return 'text-green-700 bg-green-100 border-green-200';
      case 'moderate':
      case 'medium': return 'text-yellow-700 bg-yellow-100 border-yellow-200';
      case 'high': return 'text-orange-700 bg-orange-100 border-orange-200';
      case 'very_high': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const getAssessmentIcon = (type: string) => {
    switch (type) {
      case 'dvt': return <AlertTriangle className="h-5 w-5" />;
      case 'pressure_sore': return <Shield className="h-5 w-5" />;
      case 'nutritional': return <Scale className="h-5 w-5" />;
      default: return <AlertTriangle className="h-5 w-5" />;
    }
  };

  const getAssessmentTitle = (type: string) => {
    switch (type) {
      case 'dvt': return 'DVT Risk Assessment';
      case 'pressure_sore': return 'Pressure Sore Risk Assessment';
      case 'nutritional': return 'Nutritional Risk Assessment';
      default: return 'Risk Assessment';
    }
  };

  const getAssessmentColor = (type: string) => {
    switch (type) {
      case 'dvt': return 'text-red-600';
      case 'pressure_sore': return 'text-blue-600';
      case 'nutritional': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  const handleCreateAssessment = (type: 'dvt' | 'pressure_sore' | 'nutritional') => {
    // Check if there are previous assessments of this type
    const previousOfType = allHistory.filter(a => a.type === type);
    if (previousOfType.length > 0) {
      setShowNewAssessmentPreview(type);
    } else {
      onCreateAssessment?.(type);
    }
  };

  const proceedWithNewAssessment = () => {
    if (showNewAssessmentPreview) {
      onCreateAssessment?.(showNewAssessmentPreview);
      setShowNewAssessmentPreview(null);
    }
  };

  const handleViewAssessment = async (assessment: AssessmentSummary) => {
    try {
      let fullAssessment;
      
      switch (assessment.type) {
        case 'dvt':
          fullAssessment = await db.dvt_assessments.get(assessment.id);
          break;
        case 'pressure_sore':
          fullAssessment = await db.pressure_sore_assessments.get(assessment.id);
          break;
        case 'nutritional':
          fullAssessment = await db.nutritional_assessments.get(assessment.id);
          break;
      }
      
      if (fullAssessment) {
        onViewAssessment?.(fullAssessment as BaseRiskAssessment);
      }
    } catch (err) {
      console.error('Error loading full assessment:', err);
    }
  };

  const handleEditAssessment = async (assessment: AssessmentSummary) => {
    try {
      let fullAssessment;
      
      switch (assessment.type) {
        case 'dvt':
          fullAssessment = await db.dvt_assessments.get(assessment.id);
          break;
        case 'pressure_sore':
          fullAssessment = await db.pressure_sore_assessments.get(assessment.id);
          break;
        case 'nutritional':
          fullAssessment = await db.nutritional_assessments.get(assessment.id);
          break;
      }
      
      if (fullAssessment) {
        onEditAssessment?.(fullAssessment as BaseRiskAssessment);
      }
    } catch (err) {
      console.error('Error loading assessment for editing:', err);
    }
  };

  const handleDeleteAssessment = async (assessment: AssessmentSummary) => {
    if (!confirm(`Are you sure you want to delete this ${getAssessmentTitle(assessment.type)}?`)) {
      return;
    }

    try {
      switch (assessment.type) {
        case 'dvt':
          await db.dvt_assessments.delete(assessment.id);
          break;
        case 'pressure_sore':
          await db.pressure_sore_assessments.delete(assessment.id);
          break;
        case 'nutritional':
          await db.nutritional_assessments.delete(assessment.id);
          break;
      }
      
      // Reload assessments
      await loadAssessments();
    } catch (err) {
      console.error('Error deleting assessment:', err);
      setError('Failed to delete assessment');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="text-red-600 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>{error}</p>
          <button
            onClick={loadAssessments}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Risk Assessments</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => handleCreateAssessment('dvt')}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>DVT</span>
            </button>
            <button
              onClick={() => handleCreateAssessment('pressure_sore')}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Pressure Sore</span>
            </button>
            <button
              onClick={() => handleCreateAssessment('nutritional')}
              className="px-3 py-1 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 flex items-center space-x-1"
            >
              <Plus className="h-4 w-4" />
              <span>Nutritional</span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {assessments.length === 0 ? (
          <div className="text-center py-8">
            <div className="flex justify-center space-x-4 mb-4">
              <AlertTriangle className="h-12 w-12 text-red-300" />
              <Shield className="h-12 w-12 text-blue-300" />
              <Scale className="h-12 w-12 text-orange-300" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Risk Assessments</h3>
            <p className="text-gray-500 mb-4">
              Start protecting your patient by conducting comprehensive risk assessments
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => handleCreateAssessment('dvt')}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Start DVT Assessment
              </button>
              <button
                onClick={() => handleCreateAssessment('pressure_sore')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Start Pressure Sore Assessment
              </button>
              <button
                onClick={() => handleCreateAssessment('nutritional')}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                Start Nutritional Assessment
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Urgent assessments banner */}
            {assessments.some(a => a.urgent) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <h4 className="font-medium text-red-800">Urgent Action Required</h4>
                </div>
                <p className="text-sm text-red-700">
                  {assessments.filter(a => a.urgent).length} assessment(s) require immediate attention
                </p>
              </div>
            )}

            {/* Assessment cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assessments.map((assessment) => (
                <div
                  key={`${assessment.type}-${assessment.id}`}
                  className={`border rounded-lg p-4 ${assessment.urgent ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'} hover:shadow-md transition-shadow`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={getAssessmentColor(assessment.type)}>
                        {getAssessmentIcon(assessment.type)}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">
                          {getAssessmentTitle(assessment.type)}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {assessment.assessmentDate.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getRiskColor(assessment.riskLevel, assessment.urgent)}`}>
                      {assessment.riskLevel.toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Score:</span>
                      <span className="font-medium">{assessment.score}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Assessed by:</span>
                      <span className="font-medium">{assessment.assessedBy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Next due:</span>
                      <span className={`font-medium ${isOverdue(assessment.nextDue) ? 'text-red-600' : 'text-gray-900'}`}>
                        {assessment.nextDue.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {assessment.urgent && (
                    <div className="mb-3 p-2 bg-red-100 border border-red-200 rounded text-xs text-red-800">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span className="font-medium">
                          {isOverdue(assessment.nextDue) ? 'Overdue' : 'High Risk - Action Required'}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleViewAssessment(assessment)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                      title="View assessment"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleEditAssessment(assessment)}
                      className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded"
                      title="Edit assessment"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteAssessment(assessment)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Delete assessment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick add buttons for missing assessments */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Add Missing Assessments</h4>
              <div className="flex space-x-3">
                {!assessments.some(a => a.type === 'dvt') && (
                  <button
                    onClick={() => handleCreateAssessment('dvt')}
                    className="px-3 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-sm"
                  >
                    Add DVT Assessment
                  </button>
                )}
                {!assessments.some(a => a.type === 'pressure_sore') && (
                  <button
                    onClick={() => handleCreateAssessment('pressure_sore')}
                    className="px-3 py-2 border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 text-sm"
                  >
                    Add Pressure Sore Assessment
                  </button>
                )}
                {!assessments.some(a => a.type === 'nutritional') && (
                  <button
                    onClick={() => handleCreateAssessment('nutritional')}
                    className="px-3 py-2 border border-orange-300 text-orange-700 rounded-md hover:bg-orange-50 text-sm"
                  >
                    Add Nutritional Assessment
                  </button>
                )}
              </div>
            </div>

            {/* ── Chronological Assessment History ── */}
            {allHistory.length > 0 && (
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <History className="h-5 w-5 text-gray-500" />
                    <h4 className="text-sm font-semibold text-gray-800">Assessment History ({allHistory.length} total)</h4>
                  </div>
                  <div className="flex space-x-2">
                    {['dvt', 'pressure_sore', 'nutritional'].map(type => {
                      const count = allHistory.filter(a => a.type === type).length;
                      if (count === 0) return null;
                      return (
                        <button
                          key={type}
                          onClick={() => setShowHistoryType(showHistoryType === type ? null : type)}
                          className={`px-2 py-1 text-xs rounded-full border transition ${
                            showHistoryType === type
                              ? `${getAssessmentColor(type)} bg-opacity-20 border-current font-medium`
                              : 'text-gray-500 border-gray-300 hover:border-gray-400'
                          }`}
                        >
                          {getAssessmentTitle(type).replace(' Risk Assessment', '')} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Chronological timeline of assessments */}
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {allHistory
                    .filter(a => !showHistoryType || a.type === showHistoryType)
                    .sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime())
                    .map((assessment, idx, arr) => {
                      const prevOfSameType = arr.find((prev, pIdx) => pIdx > idx && prev.type === assessment.type);
                      const scoreTrend = prevOfSameType
                        ? assessment.score > prevOfSameType.score ? 'up' : assessment.score < prevOfSameType.score ? 'down' : 'same'
                        : null;
                      return (
                        <div
                          key={`history-${assessment.type}-${assessment.id}`}
                          className={`flex items-center space-x-3 p-3 rounded-lg border transition hover:shadow-sm ${
                            assessment.status === 'active' ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-75'
                          }`}
                        >
                          <div className={`flex-shrink-0 ${getAssessmentColor(assessment.type)}`}>
                            {getAssessmentIcon(assessment.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">
                                {getAssessmentTitle(assessment.type)}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(assessment.riskLevel)}`}>
                                {assessment.riskLevel.toUpperCase()}
                              </span>
                              {assessment.status !== 'active' && (
                                <span className="px-1.5 py-0.5 rounded-full text-xs bg-gray-200 text-gray-600">Archived</span>
                              )}
                              {scoreTrend && (
                                <span className={`flex items-center text-xs ${
                                  scoreTrend === 'up' ? 'text-red-500' : scoreTrend === 'down' ? 'text-green-500' : 'text-gray-400'
                                }`}>
                                  {scoreTrend === 'up' ? <TrendingUp className="h-3 w-3" /> : scoreTrend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 mt-1 text-xs text-gray-500">
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{assessment.assessmentDate.toLocaleDateString()} {assessment.assessmentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </span>
                              <span>Score: <strong className="text-gray-700">{assessment.score}</strong></span>
                              <span>By: {assessment.assessedBy}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleViewAssessment(assessment)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── New Assessment Preview Modal ── */}
      {showNewAssessmentPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <div className={getAssessmentColor(showNewAssessmentPreview)}>
                  {getAssessmentIcon(showNewAssessmentPreview)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">New {getAssessmentTitle(showNewAssessmentPreview)}</h3>
                  <p className="text-sm text-gray-500">Review previous assessments before creating a new one</p>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-1">
                  <History className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-800">Previous Assessments</span>
                </div>
                <p className="text-xs text-amber-700">
                  {allHistory.filter(a => a.type === showNewAssessmentPreview).length} previous assessment(s) found for this patient
                </p>
              </div>
              <div className="space-y-3">
                {allHistory
                  .filter(a => a.type === showNewAssessmentPreview)
                  .sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime())
                  .map((assessment, idx) => (
                    <div
                      key={`preview-${assessment.id}`}
                      className={`p-4 rounded-lg border ${idx === 0 ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {idx === 0 && <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full font-medium">Latest</span>}
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getRiskColor(assessment.riskLevel)}`}>
                            {assessment.riskLevel.toUpperCase()} RISK
                          </span>
                        </div>
                        <span className={`text-xs ${assessment.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                          {assessment.status === 'active' ? '● Active' : '○ Archived'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Score:</span>
                          <span className="ml-1 font-semibold text-gray-900">{assessment.score}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Date:</span>
                          <span className="ml-1 font-medium text-gray-900">{assessment.assessmentDate.toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Assessed by:</span>
                          <span className="ml-1 text-gray-900">{assessment.assessedBy}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Next due:</span>
                          <span className={`ml-1 font-medium ${isOverdue(assessment.nextDue) ? 'text-red-600' : 'text-gray-900'}`}>
                            {assessment.nextDue.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-xl flex justify-between">
              <button
                onClick={() => setShowNewAssessmentPreview(null)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={proceedWithNewAssessment}
                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition"
              >
                <Plus className="h-4 w-4" />
                <span>Proceed with New Assessment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskAssessmentSummary;