import React, { useState, useEffect } from 'react';
import { PressureSoreRiskAssessment, PressureInjury, riskAssessmentService, ActionPlanItem } from '../../services/riskAssessmentService';
import { Shield, CheckCircle, Clock, User, Calendar } from 'lucide-react';
import { getCurrentUserName } from '../../utils/getCurrentUser';

interface PressureSoreRiskAssessmentProps {
  patientId: string;
  existingAssessment?: PressureSoreRiskAssessment;
  onSave?: (assessment: PressureSoreRiskAssessment) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const PressureSoreRiskAssessmentForm: React.FC<PressureSoreRiskAssessmentProps> = ({
  patientId,
  existingAssessment,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const [assessment, setAssessment] = useState<Partial<PressureSoreRiskAssessment>>({
    patient_id: patientId,
    assessment_type: 'pressure_sore',
    assessment_date: new Date(),
    assessed_by: getCurrentUserName(),
    status: 'active',
    braden_subscores: {
      sensory_perception: 1,
      moisture: 1,
      activity: 1,
      mobility: 1,
      nutrition: 1,
      friction_shear: 1
    },
    current_pressure_injuries: [],
    risk_areas: {
      sacrum: false,
      heels: false,
      elbows: false,
      back_of_head: false,
      shoulders: false,
      hips: false,
      ankles: false,
      knees: false
    },
    prevention_interventions: {
      pressure_redistribution_surface: false,
      repositioning_schedule: '',
      skin_care_protocol: false,
      nutritional_support: false,
      moisture_management: false,
      education_provided: false
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
        interpretation: `${existingAssessment.risk_level} risk for pressure injury`
      });
      setAiRecommendations(existingAssessment.ai_recommendations || []);
      setActionPlan(existingAssessment.action_plan || []);
    }
  }, [existingAssessment]);

  useEffect(() => {
    if (assessment.braden_subscores) {
      calculateRisk();
    }
  }, [assessment.braden_subscores]);

  const calculateRisk = async () => {
    try {
      const riskData = await riskAssessmentService.calculatePressureSoreRisk(assessment);
      setCalculatedRisk(riskData);
      
      // Generate AI recommendations
      const aiAnalysis = await riskAssessmentService.generateAIRecommendations(
        'pressure_sore',
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
          assigned_to: 'Care Team',
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending' as const
        }))
      ];
      
      setActionPlan(newActionPlan);
      
    } catch (error) {
      console.error('Error calculating pressure sore risk:', error);
    }
  };

  const handleBradenScoreChange = (subscale: keyof PressureSoreRiskAssessment['braden_subscores'], value: number) => {
    setAssessment(prev => ({
      ...prev,
      braden_subscores: {
        ...prev.braden_subscores!,
        [subscale]: value
      }
    }));
  };

  const handleRiskAreaChange = (area: keyof PressureSoreRiskAssessment['risk_areas'], value: boolean) => {
    setAssessment(prev => ({
      ...prev,
      risk_areas: {
        ...prev.risk_areas!,
        [area]: value
      }
    }));
  };

  const handlePreventionChange = (intervention: keyof PressureSoreRiskAssessment['prevention_interventions'], value: boolean | string) => {
    setAssessment(prev => ({
      ...prev,
      prevention_interventions: {
        ...prev.prevention_interventions!,
        [intervention]: value
      }
    }));
  };

  const addPressureInjury = () => {
    const newInjury: PressureInjury = {
      location: '',
      stage: 1,
      size_length: 0,
      size_width: 0,
      description: '',
      treatment_plan: '',
      healing_status: 'stable'
    };
    
    setAssessment(prev => ({
      ...prev,
      current_pressure_injuries: [...(prev.current_pressure_injuries || []), newInjury]
    }));
  };

  const updatePressureInjury = (index: number, field: keyof PressureInjury, value: any) => {
    setAssessment(prev => ({
      ...prev,
      current_pressure_injuries: prev.current_pressure_injuries?.map((injury, i) => 
        i === index ? { ...injury, [field]: value } : injury
      ) || []
    }));
  };

  const removePressureInjury = (index: number) => {
    setAssessment(prev => ({
      ...prev,
      current_pressure_injuries: prev.current_pressure_injuries?.filter((_, i) => i !== index) || []
    }));
  };

  const handleSave = async () => {
    if (!calculatedRisk) return;

    setIsLoading(true);
    try {
      const completeAssessment: PressureSoreRiskAssessment = {
        ...assessment,
        id: assessment.id || riskAssessmentService.generateAssessmentId(),
        score: calculatedRisk.score,
        risk_level: calculatedRisk.riskLevel as 'low' | 'moderate' | 'high' | 'very_high',
        ai_recommendations: aiRecommendations,
        action_plan: actionPlan,
        next_assessment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: assessment.created_at || new Date(),
        updated_at: new Date()
      } as PressureSoreRiskAssessment;

      onSave?.(completeAssessment);
    } catch (error) {
      console.error('Error saving pressure sore assessment:', error);
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

  const bradenScaleDefinitions = {
    sensory_perception: {
      name: 'Sensory Perception',
      options: [
        { value: 1, label: 'Completely Limited', description: 'Unresponsive to painful stimuli' },
        { value: 2, label: 'Very Limited', description: 'Responds only to painful stimuli' },
        { value: 3, label: 'Slightly Limited', description: 'Responds to verbal commands but cannot communicate discomfort' },
        { value: 4, label: 'No Impairment', description: 'Responds to verbal commands' }
      ]
    },
    moisture: {
      name: 'Moisture',
      options: [
        { value: 1, label: 'Constantly Moist', description: 'Skin is kept moist almost constantly' },
        { value: 2, label: 'Very Moist', description: 'Skin is often but not always moist' },
        { value: 3, label: 'Occasionally Moist', description: 'Skin is occasionally moist' },
        { value: 4, label: 'Rarely Moist', description: 'Skin is usually dry' }
      ]
    },
    activity: {
      name: 'Activity',
      options: [
        { value: 1, label: 'Bedfast', description: 'Confined to bed' },
        { value: 2, label: 'Chairfast', description: 'Ability to walk severely limited or nonexistent' },
        { value: 3, label: 'Walks Occasionally', description: 'Walks occasionally during day' },
        { value: 4, label: 'Walks Frequently', description: 'Walks outside room at least twice daily' }
      ]
    },
    mobility: {
      name: 'Mobility',
      options: [
        { value: 1, label: 'Completely Immobile', description: 'Does not make even slight changes in body position' },
        { value: 2, label: 'Very Limited', description: 'Makes occasional slight changes in body position' },
        { value: 3, label: 'Slightly Limited', description: 'Makes frequent though slight changes in body position' },
        { value: 4, label: 'No Limitation', description: 'Makes major and frequent changes in position' }
      ]
    },
    nutrition: {
      name: 'Nutrition',
      options: [
        { value: 1, label: 'Very Poor', description: 'Never eats a complete meal' },
        { value: 2, label: 'Probably Inadequate', description: 'Rarely eats a complete meal' },
        { value: 3, label: 'Adequate', description: 'Eats over half of most meals' },
        { value: 4, label: 'Excellent', description: 'Eats most of every meal' }
      ]
    },
    friction_shear: {
      name: 'Friction & Shear',
      options: [
        { value: 1, label: 'Problem', description: 'Requires moderate to maximum assistance in moving' },
        { value: 2, label: 'Potential Problem', description: 'Moves feebly or requires minimum assistance' },
        { value: 3, label: 'No Apparent Problem', description: 'Moves in bed and in chair independently' }
      ]
    }
  };

  const riskAreaLabels = {
    sacrum: 'Sacrum/Coccyx',
    heels: 'Heels',
    elbows: 'Elbows',
    back_of_head: 'Back of Head',
    shoulders: 'Shoulders',
    hips: 'Hips',
    ankles: 'Ankles',
    knees: 'Knees'
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Pressure Sore Risk Assessment (Braden Scale)</h2>
          </div>
          {calculatedRisk && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(calculatedRisk.riskLevel)}`}>
              {calculatedRisk.riskLevel.toUpperCase()} RISK (Score: {calculatedRisk.score}/23)
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
        
        {/* Braden Scale Assessment */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Braden Scale Assessment</h3>
          <div className="space-y-6">
            {Object.entries(bradenScaleDefinitions).map(([key, definition]) => (
              <div key={key} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{definition.name}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {definition.options.map((option) => (
                    <label key={option.value} className="relative">
                      <input
                        type="radio"
                        name={key}
                        value={option.value}
                        checked={assessment.braden_subscores?.[key as keyof PressureSoreRiskAssessment['braden_subscores']] === option.value}
                        onChange={(e) => handleBradenScoreChange(key as keyof PressureSoreRiskAssessment['braden_subscores'], parseInt(e.target.value))}
                        disabled={readOnly}
                        className="peer sr-only"
                      />
                      <div className="p-3 border border-gray-300 rounded-lg cursor-pointer peer-checked:border-blue-500 peer-checked:bg-blue-50 hover:bg-gray-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{option.label}</span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">{option.value}</span>
                        </div>
                        <p className="text-xs text-gray-600">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Current Pressure Injuries */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Current Pressure Injuries</h3>
            {!readOnly && (
              <button
                onClick={addPressureInjury}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
              >
                Add Injury
              </button>
            )}
          </div>
          
          {assessment.current_pressure_injuries?.length === 0 ? (
            <div className="text-center py-8 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-800 font-medium">No current pressure injuries documented</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assessment.current_pressure_injuries?.map((injury, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor={`injury-location-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input
                        id={`injury-location-${index}`}
                        type="text"
                        value={injury.location}
                        onChange={(e) => updatePressureInjury(index, 'location', e.target.value)}
                        disabled={readOnly}
                        placeholder="e.g., Sacrum, Left heel"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`injury-stage-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                      <select
                        id={`injury-stage-${index}`}
                        value={injury.stage}
                        onChange={(e) => updatePressureInjury(index, 'stage', e.target.value)}
                        disabled={readOnly}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value={1}>Stage 1</option>
                        <option value={2}>Stage 2</option>
                        <option value={3}>Stage 3</option>
                        <option value={4}>Stage 4</option>
                        <option value="unstageable">Unstageable</option>
                        <option value="deep_tissue">Deep Tissue Injury</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor={`injury-healing-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Healing Status</label>
                      <select
                        id={`injury-healing-${index}`}
                        value={injury.healing_status}
                        onChange={(e) => updatePressureInjury(index, 'healing_status', e.target.value)}
                        disabled={readOnly}
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="improving">Improving</option>
                        <option value="stable">Stable</option>
                        <option value="deteriorating">Deteriorating</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label htmlFor={`injury-length-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Length (cm)</label>
                      <input
                        id={`injury-length-${index}`}
                        type="number"
                        step="0.1"
                        value={injury.size_length}
                        onChange={(e) => updatePressureInjury(index, 'size_length', parseFloat(e.target.value))}
                        disabled={readOnly}
                        placeholder="0.0"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`injury-width-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Width (cm)</label>
                      <input
                        id={`injury-width-${index}`}
                        type="number"
                        step="0.1"
                        value={injury.size_width}
                        onChange={(e) => updatePressureInjury(index, 'size_width', parseFloat(e.target.value))}
                        disabled={readOnly}
                        placeholder="0.0"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor={`injury-depth-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Depth (cm)</label>
                      <input
                        id={`injury-depth-${index}`}
                        type="number"
                        step="0.1"
                        value={injury.size_depth || ''}
                        onChange={(e) => updatePressureInjury(index, 'size_depth', e.target.value ? parseFloat(e.target.value) : undefined)}
                        disabled={readOnly}
                        placeholder="0.0"
                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor={`injury-description-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      id={`injury-description-${index}`}
                      value={injury.description}
                      onChange={(e) => updatePressureInjury(index, 'description', e.target.value)}
                      disabled={readOnly}
                      rows={2}
                      placeholder="Describe the appearance, wound bed, drainage, etc."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor={`injury-treatment-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Treatment Plan</label>
                    <textarea
                      id={`injury-treatment-${index}`}
                      value={injury.treatment_plan}
                      onChange={(e) => updatePressureInjury(index, 'treatment_plan', e.target.value)}
                      disabled={readOnly}
                      rows={2}
                      placeholder="Wound care protocol, dressing type, frequency, etc."
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  {!readOnly && (
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => removePressureInjury(index)}
                        className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-Risk Areas */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">High-Risk Pressure Areas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(riskAreaLabels).map(([key, label]) => (
              <label key={key} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.risk_areas?.[key as keyof PressureSoreRiskAssessment['risk_areas']] || false}
                  onChange={(e) => handleRiskAreaChange(key as keyof PressureSoreRiskAssessment['risk_areas'], e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Prevention Interventions */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Prevention Interventions</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.prevention_interventions?.pressure_redistribution_surface || false}
                  onChange={(e) => handlePreventionChange('pressure_redistribution_surface', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Pressure redistribution surface</span>
              </label>
              
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.prevention_interventions?.skin_care_protocol || false}
                  onChange={(e) => handlePreventionChange('skin_care_protocol', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Skin care protocol</span>
              </label>
              
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.prevention_interventions?.nutritional_support || false}
                  onChange={(e) => handlePreventionChange('nutritional_support', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Nutritional support</span>
              </label>
              
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.prevention_interventions?.moisture_management || false}
                  onChange={(e) => handlePreventionChange('moisture_management', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Moisture management</span>
              </label>
              
              <label className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  checked={assessment.prevention_interventions?.education_provided || false}
                  onChange={(e) => handlePreventionChange('education_provided', e.target.checked)}
                  disabled={readOnly}
                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Patient/family education provided</span>
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Repositioning Schedule</label>
              <input
                type="text"
                value={assessment.prevention_interventions?.repositioning_schedule || ''}
                onChange={(e) => handlePreventionChange('repositioning_schedule', e.target.value)}
                disabled={readOnly}
                placeholder="e.g., Every 2 hours, alternating left side, back, right side"
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          </div>
        </div>

        {/* Risk Assessment Results */}
        {calculatedRisk && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Braden Scale Results</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-blue-800">Total Braden Score:</span>
                <span className="font-semibold text-blue-900">{calculatedRisk.score}/23</span>
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
              Evidence-Based Prevention Recommendations
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
              Prevention Action Plan
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
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PressureSoreRiskAssessmentForm;