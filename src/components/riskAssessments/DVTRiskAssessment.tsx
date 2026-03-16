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
    assessed_by: user?.name || 'Current User',
    status: 'active',
    risk_factors: {
      // 1 Point Risk Factors
      age_41_60: false,
      minor_surgery: false,
      bmi_over_25: false,
      swollen_legs: false,
      varicose_veins: false,
      pregnancy_postpartum: false,
      oral_contraceptives: false,
      sepsis_1month: false,
      serious_lung_disease: false,
      abnormal_pulmonary: false,
      acute_mi: false,
      chf_1month: false,
      inflammatory_bowel: false,
      medical_patient_bedrest: false,
      
      // 2 Point Risk Factors
      age_61_74: false,
      arthroscopic_surgery: false,
      malignancy: false,
      major_surgery_45min: false,
      laparoscopic_45min: false,
      patient_confined_bed: false,
      immobilizing_cast: false,
      central_venous_access: false,
      
      // 3 Point Risk Factors
      age_over_75: false,
      personal_history_vte: false,
      family_history_vte: false,
      factor_v_leiden: false,
      prothrombin_mutation: false,
      elevated_homocysteine: false,
      lupus_anticoagulant: false,
      anticardiolipin_antibodies: false,
      heparin_thrombocytopenia: false,
      other_thrombophilia: false,
      
      // 5 Point Risk Factors
      stroke_1month: false,
      elective_arthroplasty: false,
      hip_pelvis_fracture: false,
      acute_spinal_injury: false
    },
    clinical_signs: {
      localized_tenderness: false,
      swelling: false,
      calf_difference: false,
      pitting_edema: false,
      collateral_veins: false,
      warmth: false,
      erythema: false
    },
    prevention_measures: {
      mechanical_prophylaxis: false,
      pharmacological_prophylaxis: false,
      early_mobilization: false,
      hydration: false,
      compression_stockings: false,
      sequential_compression_device: false
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
      case 'very_low': return 'text-green-600 bg-green-100';
      case 'low': return 'text-green-600 bg-green-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'very_high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Caprini Risk Factor Categories for proper scoring
  const capriniCategories = {
    onePoint: {
      title: '1 Point Each',
      factors: [
        { key: 'age_41_60', label: 'Age 41-60 years' },
        { key: 'minor_surgery', label: 'Minor surgery planned' },
        { key: 'bmi_over_25', label: 'BMI > 25 kg/m²' },
        { key: 'swollen_legs', label: 'Swollen legs (current)' },
        { key: 'varicose_veins', label: 'Varicose veins' },
        { key: 'pregnancy_postpartum', label: 'Pregnancy or postpartum (<1 month)' },
        { key: 'oral_contraceptives', label: 'Oral contraceptives or HRT' },
        { key: 'sepsis_1month', label: 'Sepsis (<1 month)' },
        { key: 'serious_lung_disease', label: 'Serious lung disease incl. pneumonia (<1 month)' },
        { key: 'abnormal_pulmonary', label: 'Abnormal pulmonary function' },
        { key: 'acute_mi', label: 'Acute MI (<1 month)' },
        { key: 'chf_1month', label: 'Congestive heart failure (<1 month)' },
        { key: 'inflammatory_bowel', label: 'Inflammatory bowel disease' },
        { key: 'medical_patient_bedrest', label: 'Medical patient currently at bed rest' }
      ]
    },
    twoPoints: {
      title: '2 Points Each',
      factors: [
        { key: 'age_61_74', label: 'Age 61-74 years' },
        { key: 'arthroscopic_surgery', label: 'Arthroscopic surgery' },
        { key: 'malignancy', label: 'Malignancy (present or previous)' },
        { key: 'major_surgery_45min', label: 'Major surgery (>45 min)' },
        { key: 'laparoscopic_45min', label: 'Laparoscopic surgery (>45 min)' },
        { key: 'patient_confined_bed', label: 'Confined to bed (>72 hours)' },
        { key: 'immobilizing_cast', label: 'Plaster cast immobilization' },
        { key: 'central_venous_access', label: 'Central venous access' }
      ]
    },
    threePoints: {
      title: '3 Points Each',
      factors: [
        { key: 'age_over_75', label: 'Age ≥75 years' },
        { key: 'personal_history_vte', label: 'History of DVT/PE' },
        { key: 'family_history_vte', label: 'Family history of VTE' },
        { key: 'factor_v_leiden', label: 'Factor V Leiden positive' },
        { key: 'prothrombin_mutation', label: 'Prothrombin 20210A positive' },
        { key: 'lupus_anticoagulant', label: 'Lupus anticoagulant positive' },
        { key: 'anticardiolipin_antibodies', label: 'Elevated anticardiolipin antibodies' },
        { key: 'elevated_homocysteine', label: 'Elevated serum homocysteine' },
        { key: 'heparin_thrombocytopenia', label: 'Heparin-induced thrombocytopenia (HIT)' },
        { key: 'other_thrombophilia', label: 'Other congenital/acquired thrombophilia' }
      ]
    },
    fivePoints: {
      title: '5 Points Each',
      factors: [
        { key: 'stroke_1month', label: 'Stroke (<1 month)' },
        { key: 'elective_arthroplasty', label: 'Elective major lower extremity arthroplasty' },
        { key: 'hip_pelvis_fracture', label: 'Hip, pelvis, or leg fracture (<1 month)' },
        { key: 'acute_spinal_injury', label: 'Acute spinal cord injury (<1 month)' }
      ]
    }
  };

  const clinicalSignLabels = {
    localized_tenderness: 'Localized tenderness along deep venous system',
    swelling: 'Leg swelling',
    calf_difference: 'Calf circumference >3cm difference',
    pitting_edema: 'Pitting edema (symptomatic leg)',
    collateral_veins: 'Collateral superficial veins',
    warmth: 'Warmth in affected leg',
    erythema: 'Skin erythema/redness'
  };

  const preventionMeasureLabels = {
    mechanical_prophylaxis: 'Mechanical prophylaxis device',
    pharmacological_prophylaxis: 'Pharmacological prophylaxis (anticoagulants)',
    early_mobilization: 'Early mobilization program',
    hydration: 'Adequate hydration',
    compression_stockings: 'Graduated compression stockings (GCS)',
    sequential_compression_device: 'Sequential compression device (SCD)'
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
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
        
        {/* Caprini Score Risk Factors */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Caprini DVT Risk Assessment (Surgical Patients)</h3>
          <p className="text-sm text-gray-600 mb-4">Select all risk factors that apply to calculate the Caprini score for VTE prophylaxis.</p>
          
          {/* 1 Point Factors */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-blue-700 mb-2 bg-blue-50 px-3 py-2 rounded">1 Point Each</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {capriniCategories.onePoint.factors.map((factor) => (
                <label key={factor.key} className="flex items-center space-x-3 p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assessment.risk_factors?.[factor.key as keyof DVTRiskAssessment['risk_factors']] || false}
                    onChange={(e) => handleRiskFactorChange(factor.key as keyof DVTRiskAssessment['risk_factors'], e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{factor.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* 2 Point Factors */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-yellow-700 mb-2 bg-yellow-50 px-3 py-2 rounded">2 Points Each</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {capriniCategories.twoPoints.factors.map((factor) => (
                <label key={factor.key} className="flex items-center space-x-3 p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assessment.risk_factors?.[factor.key as keyof DVTRiskAssessment['risk_factors']] || false}
                    onChange={(e) => handleRiskFactorChange(factor.key as keyof DVTRiskAssessment['risk_factors'], e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{factor.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* 3 Point Factors */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-orange-700 mb-2 bg-orange-50 px-3 py-2 rounded">3 Points Each</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {capriniCategories.threePoints.factors.map((factor) => (
                <label key={factor.key} className="flex items-center space-x-3 p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assessment.risk_factors?.[factor.key as keyof DVTRiskAssessment['risk_factors']] || false}
                    onChange={(e) => handleRiskFactorChange(factor.key as keyof DVTRiskAssessment['risk_factors'], e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{factor.label}</span>
                </label>
              ))}
            </div>
          </div>
          
          {/* 5 Point Factors */}
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-red-700 mb-2 bg-red-50 px-3 py-2 rounded">5 Points Each (High Risk)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {capriniCategories.fivePoints.factors.map((factor) => (
                <label key={factor.key} className="flex items-center space-x-3 p-2 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={assessment.risk_factors?.[factor.key as keyof DVTRiskAssessment['risk_factors']] || false}
                    onChange={(e) => handleRiskFactorChange(factor.key as keyof DVTRiskAssessment['risk_factors'], e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{factor.label}</span>
                </label>
              ))}
            </div>
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