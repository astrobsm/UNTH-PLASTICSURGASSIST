import React, { useState, useEffect } from 'react';
import { NutritionalRiskAssessment, riskAssessmentService, ActionPlanItem } from '../../services/riskAssessmentService';
import { Scale, CheckCircle, Clock, User, Calendar, TrendingDown } from 'lucide-react';
import { getCurrentUserName } from '../../utils/getCurrentUser';

interface NutritionalRiskAssessmentProps {
  patientId: string;
  existingAssessment?: NutritionalRiskAssessment;
  onSave?: (assessment: NutritionalRiskAssessment) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const NutritionalRiskAssessmentForm: React.FC<NutritionalRiskAssessmentProps> = ({
  patientId,
  existingAssessment,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const [assessment, setAssessment] = useState<Partial<NutritionalRiskAssessment>>({
    patient_id: patientId,
    assessment_type: 'nutritional',
    assessment_date: new Date(),
    assessed_by: getCurrentUserName(),
    status: 'active',
    must_scores: {
      bmi_score: 0,
      weight_loss_score: 0,
      acute_disease_score: 0
    },
    height: 0,
    weight: 0,
    weight_loss_percentage: 0,
    weight_loss_timeframe: '3-6_months',
    acute_disease_effect: false,
    dietary_intake: {
      appetite_change: 'no_change',
      eating_difficulties: false,
      dietary_restrictions: [],
      recent_diet_change: false
    },
    nutritional_interventions: {
      dietitian_referral: false,
      nutritional_supplements: false,
      modified_texture: false,
      feeding_assistance: false,
      enteral_nutrition: false,
      parenteral_nutrition: false
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
        interpretation: `${existingAssessment.risk_level} risk for malnutrition`
      });
      setAiRecommendations(existingAssessment.ai_recommendations || []);
      setActionPlan(existingAssessment.action_plan || []);
    }
  }, [existingAssessment]);

  useEffect(() => {
    if (assessment.height && assessment.weight) {
      calculateRisk();
    }
  }, [assessment.height, assessment.weight, assessment.weight_loss_percentage, assessment.acute_disease_effect]);

  const calculateBMI = (height: number, weight: number): number => {
    if (height === 0 || weight === 0) return 0;
    const heightInMeters = height / 100;
    return weight / (heightInMeters * heightInMeters);
  };

  const getBMIScore = (bmi: number): number => {
    if (bmi < 18.5) return 2;
    if (bmi >= 18.5 && bmi < 20) return 1;
    return 0;
  };

  const getWeightLossScore = (percentage: number): number => {
    if (percentage >= 10) return 2;
    if (percentage >= 5) return 1;
    return 0;
  };

  const calculateRisk = async () => {
    try {
      const bmi = calculateBMI(assessment.height!, assessment.weight!);
      const bmiScore = getBMIScore(bmi);
      const weightLossScore = getWeightLossScore(assessment.weight_loss_percentage!);
      const acuteDiseaseScore = assessment.acute_disease_effect ? 2 : 0;

      const updatedScores = {
        bmi_score: bmiScore,
        weight_loss_score: weightLossScore,
        acute_disease_score: acuteDiseaseScore
      };

      setAssessment(prev => ({
        ...prev,
        must_scores: updatedScores,
        bmi: bmi
      }));

      const riskData = await riskAssessmentService.calculateNutritionalRisk({
        ...assessment,
        must_scores: updatedScores,
        bmi: bmi
      });
      
      setCalculatedRisk(riskData);
      
      // Generate AI recommendations
      const aiAnalysis = await riskAssessmentService.generateAIRecommendations(
        'nutritional',
        { ...assessment, must_scores: updatedScores, bmi: bmi },
        { patientId }
      );
      
      setAiRecommendations(aiAnalysis.evidence_based_recommendations);
      
      // Create action plan from AI recommendations
      const newActionPlan: ActionPlanItem[] = [
        ...aiAnalysis.intervention_priorities.immediate.map((action, index) => ({
          id: `immediate_${index}`,
          description: action,
          priority: 'urgent' as const,
          assigned_to: 'Dietitian',
          status: 'pending' as const
        })),
        ...aiAnalysis.intervention_priorities.short_term.map((action, index) => ({
          id: `short_term_${index}`,
          description: action,
          priority: 'high' as const,
          assigned_to: 'Nursing Staff',
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'pending' as const
        }))
      ];
      
      setActionPlan(newActionPlan);
      
    } catch (error) {
      console.error('Error calculating nutritional risk:', error);
    }
  };

  const handleMustScoreChange = (field: string, value: number) => {
    setAssessment(prev => ({
      ...prev,
      must_scores: {
        ...prev.must_scores!,
        [field]: value
      }
    }));
  };

  const handleDietaryIntakeChange = (field: keyof NutritionalRiskAssessment['dietary_intake'], value: any) => {
    setAssessment(prev => ({
      ...prev,
      dietary_intake: {
        ...prev.dietary_intake!,
        [field]: value
      }
    }));
  };

  const handleInterventionChange = (intervention: keyof NutritionalRiskAssessment['nutritional_interventions'], value: boolean) => {
    setAssessment(prev => ({
      ...prev,
      nutritional_interventions: {
        ...prev.nutritional_interventions!,
        [intervention]: value
      }
    }));
  };

  const handleSave = async () => {
    if (!calculatedRisk) return;

    setIsLoading(true);
    try {
      const completeAssessment: NutritionalRiskAssessment = {
        ...assessment,
        id: assessment.id || riskAssessmentService.generateAssessmentId(),
        score: calculatedRisk.score,
        risk_level: calculatedRisk.riskLevel as 'low' | 'medium' | 'high',
        ai_recommendations: aiRecommendations,
        action_plan: actionPlan,
        next_assessment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: assessment.created_at || new Date(),
        updated_at: new Date()
      } as NutritionalRiskAssessment;

      onSave?.(completeAssessment);
    } catch (error) {
      console.error('Error saving nutritional assessment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const addDietaryRestriction = () => {
    const restriction = prompt('Enter dietary restriction:');
    if (restriction) {
      setAssessment(prev => ({
        ...prev,
        dietary_intake: {
          ...prev.dietary_intake!,
          dietary_restrictions: [...(prev.dietary_intake?.dietary_restrictions || []), restriction]
        }
      }));
    }
  };

  const removeDietaryRestriction = (index: number) => {
    setAssessment(prev => ({
      ...prev,
      dietary_intake: {
        ...prev.dietary_intake!,
        dietary_restrictions: prev.dietary_intake?.dietary_restrictions?.filter((_, i) => i !== index) || []
      }
    }));
  };

  return (
    <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Scale className="h-6 w-6 text-orange-600" />
            <h2 className="text-xl font-semibold text-gray-900">Nutritional Risk Assessment (MUST Score)</h2>
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
        
        {/* BMI Assessment */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Body Mass Index (BMI) Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
              <input
                id="height"
                type="number"
                value={assessment.height || ''}
                onChange={(e) => setAssessment(prev => ({ ...prev, height: parseFloat(e.target.value) || 0 }))}
                disabled={readOnly}
                placeholder="170"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">Current Weight (kg)</label>
              <input
                id="weight"
                type="number"
                step="0.1"
                value={assessment.weight || ''}
                onChange={(e) => setAssessment(prev => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))}
                disabled={readOnly}
                placeholder="70.0"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calculated BMI</label>
              <div className="p-2 bg-gray-50 border border-gray-300 rounded-md">
                <span className="text-lg font-medium">
                  {assessment.height && assessment.weight ? calculateBMI(assessment.height, assessment.weight).toFixed(1) : '0.0'} kg/m²
                </span>
              </div>
            </div>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">BMI Score (Step 1)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>BMI &gt; 20 (≥18.5 if age &gt; 65)</span>
                <span className="font-medium">0 points</span>
              </div>
              <div className="flex justify-between">
                <span>BMI 18.5-20</span>
                <span className="font-medium">1 point</span>
              </div>
              <div className="flex justify-between">
                <span>BMI &lt; 18.5</span>
                <span className="font-medium">2 points</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Current BMI Score:</span>
                  <span className="text-orange-600">{assessment.must_scores?.bmi_score || 0} points</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weight Loss Assessment */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Unplanned Weight Loss Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="weight-loss" className="block text-sm font-medium text-gray-700 mb-1">Weight Loss Percentage (%)</label>
              <input
                id="weight-loss"
                type="number"
                step="0.1"
                value={assessment.weight_loss_percentage || ''}
                onChange={(e) => setAssessment(prev => ({ ...prev, weight_loss_percentage: parseFloat(e.target.value) || 0 }))}
                disabled={readOnly}
                placeholder="0.0"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <div>
              <label htmlFor="timeframe" className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
              <select
                id="timeframe"
                value={assessment.weight_loss_timeframe}
                onChange={(e) => setAssessment(prev => ({ ...prev, weight_loss_timeframe: e.target.value as any }))}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="3-6_months">3-6 months</option>
                <option value="less_than_3_months">Less than 3 months</option>
                <option value="more_than_6_months">More than 6 months</option>
              </select>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-900 mb-2">Weight Loss Score (Step 2)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>&lt; 5% weight loss</span>
                <span className="font-medium">0 points</span>
              </div>
              <div className="flex justify-between">
                <span>5-10% weight loss</span>
                <span className="font-medium">1 point</span>
              </div>
              <div className="flex justify-between">
                <span>&gt; 10% weight loss</span>
                <span className="font-medium">2 points</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Current Weight Loss Score:</span>
                  <span className="text-orange-600">{assessment.must_scores?.weight_loss_score || 0} points</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Acute Disease Effect */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acute Disease Effect</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={assessment.acute_disease_effect || false}
                onChange={(e) => setAssessment(prev => ({ ...prev, acute_disease_effect: e.target.checked }))}
                disabled={readOnly}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">
                  Patient has acute disease with no nutritional intake for &gt; 5 days
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  Check if patient is acutely ill and has had or is likely to have no nutritional intake for more than 5 days
                </p>
              </div>
            </label>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-red-900 mb-2">Acute Disease Score (Step 3)</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>No acute disease effect</span>
                <span className="font-medium">0 points</span>
              </div>
              <div className="flex justify-between">
                <span>Acute disease with no intake &gt; 5 days</span>
                <span className="font-medium">2 points</span>
              </div>
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Current Acute Disease Score:</span>
                  <span className="text-orange-600">{assessment.must_scores?.acute_disease_score || 0} points</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dietary Intake Assessment */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Dietary Intake Assessment</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="appetite" className="block text-sm font-medium text-gray-700 mb-1">Appetite Change</label>
              <select
                id="appetite"
                value={assessment.dietary_intake?.appetite_change}
                onChange={(e) => handleDietaryIntakeChange('appetite_change', e.target.value)}
                disabled={readOnly}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="no_change">No change</option>
                <option value="improved">Improved</option>
                <option value="decreased">Decreased</option>
                <option value="poor">Poor appetite</option>
              </select>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.dietary_intake?.eating_difficulties || false}
                  onChange={(e) => handleDietaryIntakeChange('eating_difficulties', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Eating difficulties (swallowing, chewing, nausea)</span>
              </label>
              
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.dietary_intake?.recent_diet_change || false}
                  onChange={(e) => handleDietaryIntakeChange('recent_diet_change', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Recent significant diet change</span>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Restrictions</label>
              <div className="space-y-2">
                {assessment.dietary_intake?.dietary_restrictions?.map((restriction, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md">
                    <span className="text-sm">{restriction}</span>
                    {!readOnly && (
                      <button
                        onClick={() => removeDietaryRestriction(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {!readOnly && (
                  <button
                    onClick={addDietaryRestriction}
                    className="px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:border-gray-400 w-full"
                  >
                    Add Dietary Restriction
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Current Nutritional Interventions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Nutritional Interventions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={assessment.nutritional_interventions?.dietitian_referral || false}
                onChange={(e) => handleInterventionChange('dietitian_referral', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Dietitian referral/consultation</span>
            </label>
            
            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={assessment.nutritional_interventions?.nutritional_supplements || false}
                onChange={(e) => handleInterventionChange('nutritional_supplements', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Nutritional supplements</span>
            </label>
            
            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={assessment.nutritional_interventions?.modified_texture || false}
                onChange={(e) => handleInterventionChange('modified_texture', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Modified texture diet</span>
            </label>
            
            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={assessment.nutritional_interventions?.feeding_assistance || false}
                onChange={(e) => handleInterventionChange('feeding_assistance', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Feeding assistance</span>
            </label>
            
            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={assessment.nutritional_interventions?.enteral_nutrition || false}
                onChange={(e) => handleInterventionChange('enteral_nutrition', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Enteral nutrition (tube feeding)</span>
            </label>
            
            <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                checked={assessment.nutritional_interventions?.parenteral_nutrition || false}
                onChange={(e) => handleInterventionChange('parenteral_nutrition', e.target.checked)}
                disabled={readOnly}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700">Parenteral nutrition (TPN)</span>
            </label>
          </div>
        </div>

        {/* MUST Score Results */}
        {calculatedRisk && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-orange-900 mb-3 flex items-center">
              <TrendingDown className="h-5 w-5 mr-2" />
              MUST Score Results
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-orange-600">{assessment.must_scores?.bmi_score || 0}</div>
                <div className="text-sm text-gray-600">BMI Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-orange-600">{assessment.must_scores?.weight_loss_score || 0}</div>
                <div className="text-sm text-gray-600">Weight Loss Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg sm:text-2xl font-bold text-orange-600">{assessment.must_scores?.acute_disease_score || 0}</div>
                <div className="text-sm text-gray-600">Acute Disease Score</div>
              </div>
              <div className="text-center bg-white rounded border-2 border-orange-300 p-2">
                <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-700">{calculatedRisk.score}</div>
                <div className="text-sm text-gray-600">Total MUST Score</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-orange-800">Risk Level:</span>
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
              Evidence-Based Nutritional Recommendations
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
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center">
              <Clock className="h-5 w-5 mr-2" />
              Nutritional Intervention Action Plan
            </h3>
            <div className="space-y-3">
              {actionPlan.map((action, index) => (
                <div key={index} className="bg-white border border-yellow-200 rounded-lg p-4">
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
              className="px-6 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NutritionalRiskAssessmentForm;