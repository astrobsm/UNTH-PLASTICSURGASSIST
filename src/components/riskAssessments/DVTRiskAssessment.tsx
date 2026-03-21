import React, { useState, useEffect, useMemo } from 'react';
import { DVTRiskAssessment, DVTProphylaxisRecommendation, riskAssessmentService, ActionPlanItem } from '../../services/riskAssessmentService';
import { patientActivityService } from '../../services/patientActivityService';
import { useAuthStore } from '../../store/authStore';
import { isPediatric, calculateAge } from '../../utils/dateUtils';
import { AlertTriangle, CheckCircle, Clock, User, Calendar, Activity, Baby, Shield, Eye, ChevronDown, ChevronUp } from 'lucide-react';

interface DVTRiskAssessmentProps {
  patientId: string;
  hospitalNumber: string;
  patientDob?: string;
  existingAssessment?: DVTRiskAssessment;
  onSave?: (assessment: DVTRiskAssessment) => void;
  onCancel?: () => void;
  readOnly?: boolean;
}

export const DVTRiskAssessmentForm: React.FC<DVTRiskAssessmentProps> = ({
  patientId,
  hospitalNumber,
  patientDob,
  existingAssessment,
  onSave,
  onCancel,
  readOnly = false
}) => {
  const { user } = useAuthStore();
  
  // Auto-detect assessment mode based on patient DOB
  const assessmentMode = useMemo<'adult' | 'pediatric'>(() => {
    if (existingAssessment?.assessment_mode) return existingAssessment.assessment_mode;
    return isPediatric(patientDob) ? 'pediatric' : 'adult';
  }, [patientDob, existingAssessment]);

  const patientAge = useMemo(() => calculateAge(patientDob), [patientDob]);

  const [assessment, setAssessment] = useState<Partial<DVTRiskAssessment>>({
    patient_id: patientId,
    assessment_type: 'dvt',
    assessment_mode: assessmentMode,
    patient_dob: patientDob,
    assessment_date: new Date(),
    assessed_by: user?.name || 'Current User',
    status: 'active',
    risk_factors: {
      // 1 Point Risk Factors (Adult - Caprini)
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
      
      // 2 Point Risk Factors (Adult)
      age_61_74: false,
      arthroscopic_surgery: false,
      malignancy: false,
      major_surgery_45min: false,
      laparoscopic_45min: false,
      patient_confined_bed: false,
      immobilizing_cast: false,
      central_venous_access: false,
      
      // 3 Point Risk Factors (Adult)
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
      
      // 5 Point Risk Factors (Adult)
      stroke_1month: false,
      elective_arthroplasty: false,
      hip_pelvis_fracture: false,
      acute_spinal_injury: false,

      // Pediatric Risk Factors (UK NICE/RCPCH)
      ped_age_over_13: false,
      ped_central_venous_catheter: false,
      ped_immobility_reduced_mobility: false,
      ped_previous_vte: false,
      ped_family_history_vte: false,
      ped_active_malignancy: false,
      ped_chemotherapy: false,
      ped_significant_surgery: false,
      ped_lower_limb_surgery: false,
      ped_obesity: false,
      ped_dehydration: false,
      ped_acute_infection_sepsis: false,
      ped_inflammatory_condition: false,
      ped_nephrotic_syndrome: false,
      ped_sickle_cell_disease: false,
      ped_congenital_heart_disease: false,
      ped_inherited_thrombophilia: false,
      ped_oral_contraceptives: false,
      ped_prolonged_travel: false,
      ped_burns: false,
      ped_trauma: false,
      ped_critical_care_admission: false
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
  const [prophylaxisRecommendation, setProphylaxisRecommendation] = useState<DVTProphylaxisRecommendation | null>(null);
  const [showProphylaxisDetails, setShowProphylaxisDetails] = useState(false);
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
      if (existingAssessment.prophylaxis_recommendation) {
        setProphylaxisRecommendation(existingAssessment.prophylaxis_recommendation);
      }
    }
  }, [existingAssessment]);

  useEffect(() => {
    if (assessment.risk_factors) {
      calculateRisk();
    }
  }, [assessment.risk_factors, assessmentMode]);

  const calculateRisk = async () => {
    try {
      let riskData: { score: number; riskLevel: string; interpretation: string };
      
      if (assessmentMode === 'pediatric') {
        riskData = await riskAssessmentService.calculatePediatricDVTRisk(assessment);
      } else {
        riskData = await riskAssessmentService.calculateDVTRisk(assessment);
      }
      
      setCalculatedRisk(riskData);

      // Auto-generate prophylaxis recommendation
      const assessmentId = assessment.id || riskAssessmentService.generateAssessmentId();
      const prophylaxis = riskAssessmentService.generateProphylaxisRecommendation(
        assessmentId,
        patientId,
        assessmentMode,
        riskData.score,
        riskData.riskLevel,
        user?.name || 'Current User'
      );
      setProphylaxisRecommendation(prophylaxis);
      
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
          due_date: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
        assessment_mode: assessmentMode,
        patient_dob: patientDob,
        score: calculatedRisk.score,
        risk_level: calculatedRisk.riskLevel as 'low' | 'moderate' | 'high' | 'very_high',
        ai_recommendations: aiRecommendations,
        action_plan: actionPlan,
        prophylaxis_recommendation: prophylaxisRecommendation || undefined,
        next_assessment_due: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
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

  // Pediatric Risk Factor Categories (UK NICE/RCPCH Guidelines)
  const pediatricCategories = {
    highRisk: {
      title: 'High-Risk Factors (2 Points Each)',
      color: 'red',
      factors: [
        { key: 'ped_central_venous_catheter', label: 'Central venous catheter in situ' },
        { key: 'ped_previous_vte', label: 'Previous VTE' },
        { key: 'ped_active_malignancy', label: 'Active malignancy' },
        { key: 'ped_critical_care_admission', label: 'Critical care / ICU / HDU admission' },
        { key: 'ped_inherited_thrombophilia', label: 'Known inherited thrombophilia' },
        { key: 'ped_nephrotic_syndrome', label: 'Nephrotic syndrome' }
      ]
    },
    moderateRisk: {
      title: 'Moderate-Risk Factors (1 Point Each)',
      color: 'yellow',
      factors: [
        { key: 'ped_age_over_13', label: 'Age > 13 years (pubertal/post-pubertal)' },
        { key: 'ped_immobility_reduced_mobility', label: 'Immobility / significantly reduced mobility' },
        { key: 'ped_family_history_vte', label: 'First-degree family history of VTE' },
        { key: 'ped_chemotherapy', label: 'Receiving chemotherapy' },
        { key: 'ped_significant_surgery', label: 'Significant surgery (>45 min or complex)' },
        { key: 'ped_lower_limb_surgery', label: 'Lower limb surgery / orthopaedic procedure' },
        { key: 'ped_obesity', label: 'Obesity (BMI > 95th centile for age)' },
        { key: 'ped_dehydration', label: 'Dehydration' },
        { key: 'ped_acute_infection_sepsis', label: 'Acute infection / sepsis' },
        { key: 'ped_inflammatory_condition', label: 'Active inflammatory condition (e.g., IBD, SLE)' },
        { key: 'ped_sickle_cell_disease', label: 'Sickle cell disease' },
        { key: 'ped_congenital_heart_disease', label: 'Congenital heart disease' },
        { key: 'ped_oral_contraceptives', label: 'Oral contraceptive pill / estrogen therapy' },
        { key: 'ped_prolonged_travel', label: 'Prolonged travel (>4 hours)' },
        { key: 'ped_burns', label: 'Burns' },
        { key: 'ped_trauma', label: 'Significant trauma' }
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
            {assessmentMode === 'pediatric' ? (
              <Baby className="h-6 w-6 text-purple-600" />
            ) : (
              <Activity className="h-6 w-6 text-red-600" />
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">DVT Risk Assessment</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                assessmentMode === 'pediatric' 
                  ? 'bg-purple-100 text-purple-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {assessmentMode === 'pediatric' ? (
                  <><Baby className="h-3 w-3 mr-1" /> Pediatric — UK NICE/RCPCH Guidelines</>
                ) : (
                  <><Shield className="h-3 w-3 mr-1" /> Adult — Caprini Score (2005)</>
                )}
              </span>
            </div>
          </div>
          {calculatedRisk && (
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskColor(calculatedRisk.riskLevel)}`}>
              {calculatedRisk.riskLevel.toUpperCase()} RISK (Score: {calculatedRisk.score})
            </div>
          )}
        </div>
        
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500">
          <span className="flex items-center">
            <User className="h-4 w-4 mr-1" />
            Patient ID: {patientId}
          </span>
          {patientAge !== null && (
            <span className="flex items-center">
              <User className="h-4 w-4 mr-1" />
              Age: {patientAge} years {assessmentMode === 'pediatric' ? '(Pediatric)' : '(Adult)'}
            </span>
          )}
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

        {/* === PEDIATRIC FORM (UK NICE/RCPCH Guidelines) === */}
        {assessmentMode === 'pediatric' && (
          <div>
            <h3 className="text-lg font-semibold text-purple-900 mb-2">Pediatric VTE Risk Assessment</h3>
            <p className="text-sm text-gray-600 mb-4">
              Based on UK NICE NG89 and RCPCH guidelines for VTE risk assessment in children and young people (&lt;18 years).
            </p>

            {/* High-Risk Factors (2 points each) */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-red-700 mb-2 bg-red-50 px-3 py-2 rounded">
                {pediatricCategories.highRisk.title}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {pediatricCategories.highRisk.factors.map((factor) => (
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

            {/* Moderate-Risk Factors (1 point each) */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-yellow-700 mb-2 bg-yellow-50 px-3 py-2 rounded">
                {pediatricCategories.moderateRisk.title}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {pediatricCategories.moderateRisk.factors.map((factor) => (
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
          </div>
        )}

        {/* === ADULT FORM (Caprini Score) === */}
        {assessmentMode === 'adult' && (
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
        )}

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
                <span className="text-blue-800">
                  {assessmentMode === 'pediatric' ? 'Pediatric VTE Score:' : 'Caprini Score:'}
                </span>
                <span className="font-semibold text-blue-900">{calculatedRisk.score}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-800">Risk Level:</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getRiskColor(calculatedRisk.riskLevel)}`}>
                  {calculatedRisk.riskLevel.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-blue-800">Guidelines:</span>
                <span className="text-sm text-blue-700">
                  {assessmentMode === 'pediatric' ? 'NICE NG89 / RCPCH' : 'Caprini Score (2005)'}
                </span>
              </div>
              <div className="mt-3 p-3 bg-white rounded border">
                <p className="text-sm text-gray-700">{calculatedRisk.interpretation}</p>
              </div>
            </div>
          </div>
        )}

        {/* DVT Prophylaxis Recommendation (Auto-Generated) */}
        {prophylaxisRecommendation && (
          <div className={`border rounded-lg p-6 ${
            prophylaxisRecommendation.pharmacological.recommended 
              ? 'bg-red-50 border-red-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={`text-lg font-semibold flex items-center ${
                prophylaxisRecommendation.pharmacological.recommended ? 'text-red-900' : 'text-green-900'
              }`}>
                <Shield className="h-5 w-5 mr-2" />
                DVT Prophylaxis Recommendation
              </h3>
              <button
                type="button"
                onClick={() => setShowProphylaxisDetails(!showProphylaxisDetails)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <Eye className="h-4 w-4 mr-1" />
                {showProphylaxisDetails ? 'Hide Details' : 'Preview Details'}
                {showProphylaxisDetails ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
              </button>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-white rounded p-2 text-center border">
                <div className="text-xs text-gray-500">Mode</div>
                <div className="text-sm font-medium capitalize">{prophylaxisRecommendation.mode}</div>
              </div>
              <div className="bg-white rounded p-2 text-center border">
                <div className="text-xs text-gray-500">Score</div>
                <div className="text-sm font-medium">{prophylaxisRecommendation.score}</div>
              </div>
              <div className="bg-white rounded p-2 text-center border">
                <div className="text-xs text-gray-500">Risk Level</div>
                <div className={`text-sm font-medium ${getRiskColor(prophylaxisRecommendation.risk_level).split(' ')[0]}`}>
                  {prophylaxisRecommendation.risk_level.toUpperCase()}
                </div>
              </div>
              <div className="bg-white rounded p-2 text-center border">
                <div className="text-xs text-gray-500">Guideline</div>
                <div className="text-xs font-medium">{prophylaxisRecommendation.mode === 'pediatric' ? 'NICE/RCPCH' : 'Caprini'}</div>
              </div>
            </div>

            {/* Pharmacological Prophylaxis */}
            <div className="bg-white rounded-lg border p-4 mb-3">
              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                💊 Pharmacological Prophylaxis
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  prophylaxisRecommendation.pharmacological.recommended 
                    ? 'bg-red-100 text-red-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {prophylaxisRecommendation.pharmacological.recommended ? 'RECOMMENDED' : 'Not Required'}
                </span>
              </h4>
              {prophylaxisRecommendation.pharmacological.recommended && (
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium text-gray-700">Drug:</span> {prophylaxisRecommendation.pharmacological.drug}</div>
                  <div><span className="font-medium text-gray-700">Dose:</span> {prophylaxisRecommendation.pharmacological.dose}</div>
                  <div><span className="font-medium text-gray-700">Frequency:</span> {prophylaxisRecommendation.pharmacological.frequency}</div>
                  <div><span className="font-medium text-gray-700">Duration:</span> {prophylaxisRecommendation.pharmacological.duration}</div>
                  {prophylaxisRecommendation.pharmacological.notes && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      <strong>Note:</strong> {prophylaxisRecommendation.pharmacological.notes}
                    </div>
                  )}
                </div>
              )}
              {!prophylaxisRecommendation.pharmacological.recommended && (
                <p className="text-sm text-gray-600">{prophylaxisRecommendation.pharmacological.notes}</p>
              )}
            </div>

            {/* Mechanical Prophylaxis */}
            <div className="bg-white rounded-lg border p-4 mb-3">
              <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                🦵 Mechanical Prophylaxis
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  prophylaxisRecommendation.mechanical.recommended 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {prophylaxisRecommendation.mechanical.recommended ? 'RECOMMENDED' : 'Not Required'}
                </span>
              </h4>
              <ul className="space-y-1">
                {prophylaxisRecommendation.mechanical.measures.map((measure, i) => (
                  <li key={i} className="flex items-start text-sm">
                    <span className="text-blue-500 mr-2 mt-0.5">•</span>
                    <span className="text-gray-700">{measure}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Expanded Details */}
            {showProphylaxisDetails && (
              <div className="space-y-3 mt-3">
                {/* Monitoring */}
                {prophylaxisRecommendation.monitoring.length > 0 && (
                  <div className="bg-white rounded-lg border p-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2">📋 Monitoring Requirements</h4>
                    <ul className="space-y-1">
                      {prophylaxisRecommendation.monitoring.map((item, i) => (
                        <li key={i} className="flex items-start text-sm">
                          <span className="text-green-500 mr-2 mt-0.5">✓</span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contraindication Check */}
                {prophylaxisRecommendation.contraindication_check.length > 0 && (
                  <div className="bg-white rounded-lg border border-red-200 p-4">
                    <h4 className="text-sm font-semibold text-red-800 mb-2">⚠️ Contraindication Checklist</h4>
                    <p className="text-xs text-red-600 mb-2">Review and exclude the following before commencing prophylaxis:</p>
                    <ul className="space-y-1">
                      {prophylaxisRecommendation.contraindication_check.map((item, i) => (
                        <li key={i} className="flex items-start text-sm">
                          <span className="text-red-500 mr-2 mt-0.5">✗</span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Special Considerations */}
                {prophylaxisRecommendation.special_considerations.length > 0 && (
                  <div className="bg-white rounded-lg border border-purple-200 p-4">
                    <h4 className="text-sm font-semibold text-purple-800 mb-2">🔍 Special Considerations</h4>
                    <ul className="space-y-1">
                      {prophylaxisRecommendation.special_considerations.map((item, i) => (
                        <li key={i} className="flex items-start text-sm">
                          <span className="text-purple-500 mr-2 mt-0.5">•</span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Meta info */}
                <div className="text-xs text-gray-400 text-right">
                  Generated by: {prophylaxisRecommendation.generated_by} | 
                  Guideline: {prophylaxisRecommendation.guideline_used} | 
                  {new Date(prophylaxisRecommendation.generated_at).toLocaleString()}
                </div>
              </div>
            )}
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