import React, { useState, useEffect } from 'react';
import { DVTRiskAssessment, riskAssessmentService, ActionPlanItem } from '../../services/riskAssessmentService';
import { patientActivityService } from '../../services/patientActivityService';
import { useAuthStore } from '../../store/authStore';
import { AlertTriangle, CheckCircle, Clock, User, Calendar, Activity } from 'lucide-react';

interface DVTRiskAssessmentProps {
  patientId: string;
  hospitalNumber: string;
  existingAssessment?: DVTRiskAssessment;
  onSave?: (assessment: DVTRiskAssessment) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const DVTRiskAssessmentForm: React.FC<DVTRiskAssessmentProps> = ({
  patientId,
  hospitalNumber,
  existingAssessment,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const { user } = useAuthStore();
  const [assessment, setAssessment] = useState<Partial<DVTRiskAssessment>>({
    patient_id: patientId,
    assessment_type: 'dvt',
    assessment_date: new Date(),
    assessed_by: 'Current User', // This would come from auth context
    status: 'active',
    risk_factors: {
      active_cancer: false,
      paralysis_paresis: false,
      recent_bedrest: false,
      major_surgery: false,
      localized_tenderness: false,
      swelling_entire_leg: false,
      calf_swelling: false,
      pitting_edema: false,
      collateral_veins: false,
      previous_dvt: false,
      alternative_diagnosis: false,
      age_over_70: false,
      heart_failure: false,
      trauma_surgery: false,
      immobilization: false,
      pregnancy: false,
      estrogen_therapy: false,
      obesity_bmi_30: false,
      inherited_thrombophilia: false
    },
    clinical_signs: {
      leg_pain: false,
      leg_swelling: false,
      skin_changes: false,
      temperature_difference: false,
      pulse_difference: false
    },
    prevention_measures: {
      mechanical_prophylaxis: false,
      pharmacological_prophylaxis: false,
      early_mobilization: false,
      compression_stockings: false,
      intermittent_pneumatic_compression: false
    }
  });

  const [calculatedRisk, setCalculatedRisk] = useState<{
    score: number;
    riskLevel: string;
    interpretation: string;
  } | null>(null);

  const [aiRecommendations, setAiRecommendations] = useState<string[]>([]);
  const [actionPlan, setActionPlan] = useState<ActionPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (existingAssessment) {
      setAssessment(existingAssessment);
      setCalculatedRisk({
        score: existingAssessment.score,
        riskLevel: existingAssessment.risk_level,
        interpretation: `${existingAssessment.risk_level} risk for DVT`
      });
      setAiRecommendations(existingAssessment.ai_recommendations || []);
      setActionPlan(existingAssessment.action_plan || []);
    }
  }, [existingAssessment]);

  useEffect(() => {
    if (assessment.risk_factors) {
      calculateRisk();
    }
  }, [assessment.risk_factors]);

  const calculateRisk = async () => {
    try {
      const riskData = await riskAssessmentService.calculateDVTRisk(assessment);
      setCalculatedRisk(riskData);
      
      // Generate AI recommendations
      const aiAnalysis = await riskAssessmentService.generateAIRecommendations(
        'dvt',
        assessment,
        { patientId }
      );
      
      setAiRecommendations(aiAnalysis.evidence_based_recommendations);
      
      // Create action plan from AI recommendations
      const newActionPlan: ActionPlanItem[] = [
        ...aiAnalysis.intervention_priorities.immediate.map((action, index) => ({
          id: `immediate_${index}`,
          description: action,
          priority: 'urgent' as const,
          assigned_to: 'Nursing Staff',
          status: 'pending' as const
        })),
        ...aiAnalysis.intervention_priorities.short_term.map((action, index) => ({
          id: `short_term_${index}`,
          description: action,
          priority: 'high' as const,
          assigned_to: 'Medical Team',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          status: 'pending' as const
        }))
      ];
      
      setActionPlan(newActionPlan);
      
    } catch (error) {
      console.error('Error calculating DVT risk:', error);
    }
  };

  const handleRiskFactorChange = (factor: keyof DVTRiskAssessment['risk_factors'], value: boolean) => {
    setAssessment(prev => ({
      ...prev,
      risk_factors: {
        ...prev.risk_factors!,
        [factor]: value
      }
    }));
  };

  const handleClinicalSignChange = (sign: keyof DVTRiskAssessment['clinical_signs'], value: boolean) => {
    setAssessment(prev => ({
      ...prev,
      clinical_signs: {
        ...prev.clinical_signs!,
        [sign]: value
      }
    }));
  };

  const handlePreventionMeasureChange = (measure: keyof DVTRiskAssessment['prevention_measures'], value: boolean) => {
    setAssessment(prev => ({
      ...prev,
      prevention_measures: {
        ...prev.prevention_measures!,
        [measure]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!calculatedRisk) return;

    setIsLoading(true);
    try {
      const completeAssessment: DVTRiskAssessment = {
        ...assessment,
        id: assessment.id || riskAssessmentService.generateAssessmentId(),
        score: calculatedRisk.score,
        risk_level: calculatedRisk.riskLevel as 'low' | 'moderate' | 'high' | 'very_high',
        ai_recommendations: aiRecommendations,
        action_plan: actionPlan,
        next_assessment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        created_at: assessment.created_at || new Date(),
        updated_at: new Date()
      } as DVTRiskAssessment;

      // Log activity
      await patientActivityService.logRiskAssessment(
        Number(patientId),
        hospitalNumber,
        user?.id?.toString() || 'unknown',
        user?.name || 'Unknown',
        user?.role || 'unknown',
        'DVT',
        calculatedRisk.riskLevel,
        calculatedRisk.score,
        existingAssessment ? 'updated' : 'created'
      );

      onSave?.(completeAssessment);
    } catch (error) {
      console.error('Error saving DVT assessment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'very_high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const riskFactorLabels = {
    active_cancer: 'Active cancer (treatment within 6 months or palliative)',
    paralysis_paresis: 'Paralysis, paresis, or recent plaster immobilization',
    recent_bedrest: 'Recently bedridden for more than 3 days',
    major_surgery: 'Major surgery in the past 4 weeks',
    localized_tenderness: 'Localized tenderness along deep venous system',
    swelling_entire_leg: 'Entire leg swollen',
    calf_swelling: 'Calf swelling >3 cm compared to asymptomatic leg',
    pitting_edema: 'Pitting edema (greater in symptomatic leg)',
    collateral_veins: 'Collateral superficial veins (non-varicose)',
    previous_dvt: 'Previous documented DVT',
    alternative_diagnosis: 'Alternative diagnosis likely (subtract 2 points)',
    age_over_70: 'Age over 70 years',
    heart_failure: 'Heart failure',
    trauma_surgery: 'Trauma or surgery',
    immobilization: 'Immobilization ≥4 days',
    pregnancy: 'Pregnancy or postpartum',
    estrogen_therapy: 'Estrogen therapy',
    obesity_bmi_30: 'Obesity (BMI ≥30)',
    inherited_thrombophilia: 'Inherited thrombophilia'
  };

  const clinicalSignLabels = {
    leg_pain: 'Leg pain or cramping',
    leg_swelling: 'Leg swelling',
    skin_changes: 'Skin color changes or warmth',
    temperature_difference: 'Temperature difference between legs',
    pulse_difference: 'Pulse difference between legs'
  };

  const preventionMeasureLabels = {
    mechanical_prophylaxis: 'Mechanical prophylaxis (compression stockings)',
    pharmacological_prophylaxis: 'Pharmacological prophylaxis (anticoagulants)',
    early_mobilization: 'Early mobilization program',
    compression_stockings: 'Graduated compression stockings',
    intermittent_pneumatic_compression: 'Intermittent pneumatic compression'
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">DVT Risk Assessment</h2>
          </div>
          {calculatedRisk && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(calculatedRisk.riskLevel)}`}>
              {calculatedRisk.riskLevel.toUpperCase()} RISK (Score: {calculatedRisk.score})
            </div>
          )}
        </div>
        
        <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
          <span className="flex items-center">
            <User className="h-4 w-4 mr-1" />
            Patient ID: {patientId}
          </span>
          <span className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {new Date(assessment.assessment_date!).toLocaleDateString()}
          </span>
          <span className="flex items-center">
            <User className="h-4 w-4 mr-1" />
            Assessed by: {assessment.assessed_by}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-8">
        
        {/* Wells Score Risk Factors */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Wells Score Risk Factors</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(riskFactorLabels).map(([key, label]) => (
              <label key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.risk_factors?.[key as keyof DVTRiskAssessment['risk_factors']] || false}
                  onChange={(e) => handleRiskFactorChange(key as keyof DVTRiskAssessment['risk_factors'], e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Clinical Signs */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Signs and Symptoms</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(clinicalSignLabels).map(([key, label]) => (
              <label key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.clinical_signs?.[key as keyof DVTRiskAssessment['clinical_signs']] || false}
                  onChange={(e) => handleClinicalSignChange(key as keyof DVTRiskAssessment['clinical_signs'], e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Prevention Measures */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Prevention Measures</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(preventionMeasureLabels).map(([key, label]) => (
              <label key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.prevention_measures?.[key as keyof DVTRiskAssessment['prevention_measures']] || false}
                  onChange={(e) => handlePreventionMeasureChange(key as keyof DVTRiskAssessment['prevention_measures'], e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Risk Assessment Results */}
        {calculatedRisk && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Risk Assessment Results</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-blue-800">Wells Score:</span>
                <span className="font-semibold text-blue-900">{calculatedRisk.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-800">Risk Level:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getRiskColor(calculatedRisk.riskLevel)}`}>
                  {calculatedRisk.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-sm text-gray-700">{calculatedRisk.interpretation}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Recommendations */}
        {aiRecommendations.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Evidence-Based Recommendations
            </h3>
            <ul className="space-y-2">
              {aiRecommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <div className="w-2 h-2 bg-green-600 rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm text-green-800">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Plan */}
        {actionPlan.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-3 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Action Plan
            </h3>
            <div className="space-y-3">
              {actionPlan.map((action, index) => (
                <div key={index} className="bg-white border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      action.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                      action.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {action.priority.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">{action.assigned_to}</span>
                  </div>
                  <p className="text-sm text-gray-700">{action.description}</p>
                  {action.due_date && (
                    <p className="text-xs text-gray-500 mt-1">
                      Due: {new Date(action.due_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!readOnly && (
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            {onCancel && (
              <button
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={isLoading || !calculatedRisk}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DVTRiskAssessmentForm;