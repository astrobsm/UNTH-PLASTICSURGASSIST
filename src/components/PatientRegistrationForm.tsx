import React, { useState } from 'react';
import { unthPatientService, PatientRegistration, Ward } from '../services/unthPatientService';
import { riskAssessmentService } from '../services/riskAssessmentService';
import jsPDF from 'jspdf';

interface PatientRegistrationFormProps {
  onSuccess?: (patientId: string) => void;
  onCancel?: () => void;
}

export const PatientRegistrationForm: React.FC<PatientRegistrationFormProps> = ({
  onSuccess,
  onCancel
}): JSX.Element => {
  const [formData, setFormData] = useState<Partial<PatientRegistration>>({
    sex: 'male',
    marital_status: 'single',
    nationality: 'Nigerian',
    admission_type: 'clinic',
    patient_type: 'outpatient',
    next_of_kin: {
      name: '',
      relationship: '',
      phone: '',
      address: ''
    },
    social_history: {
      smoking: false,
      alcohol: false,
      occupation: ''
    },
    allergies: [],
    medical_history: [],
    surgical_history: [],
    drug_history: [],
    family_history: [],
    registration_date: new Date()
  });

  // Risk Assessment Data
  const [riskAssessmentData, setRiskAssessmentData] = useState({
    dvt: {
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
    pressureSore: {
      sensory_perception: 4,
      moisture: 4,
      activity: 4,
      mobility: 4,
      nutrition: 4,
      friction_shear: 3
    },
    nutritional: {
      height: 0,
      weight: 0,
      bmi: 0,
      bmi_score: 0,
      weight_loss_percentage: 0,
      weight_loss_timeframe: 0,
      acute_disease_effect: false,
      appetite_change: '',
      eating_difficulties: false,
      recent_diet_change: false,
      dietary_restrictions: [] as string[]
    },
    // Clinical Information for AI Recommendations
    clinical: {
      primary_diagnosis: '',
      secondary_diagnoses: [] as string[],
      comorbidities: [] as string[],
      current_medications: [] as string[],
      allergies: [] as string[],
      dietary_preferences: '',
      cultural_preferences: 'nigerian',
      activity_level: 'moderate'
    }
  });

  // AI Recommendations state
  const [aiRecommendations, setAiRecommendations] = useState({
    dvt: {
      recommendations: [] as string[],
      riskLevel: 'low' as 'low' | 'moderate' | 'high' | 'very_high',
      score: 0,
      interventions: [] as string[]
    },
    pressureSore: {
      recommendations: [] as string[],
      riskLevel: 'low' as 'low' | 'moderate' | 'high' | 'very_high',
      score: 0,
      interventions: [] as string[]
    },
    nutritional: {
      recommendations: [] as string[],
      riskLevel: 'low' as 'low' | 'moderate' | 'high',
      score: 0,
      mealPlan: {
        generated: false,
        days: [] as Array<{
          day: number;
          breakfast: string;
          lunch: string;
          dinner: string;
          snacks: string[];
          nutritionalInfo: {
            calories: number;
            protein: number;
            carbs: number;
            fat: number;
            fiber: number;
            sodium?: string;
            potassium?: string;
            phosphorus?: string;
          };
          specialInstructions?: string[];
        }>,
        dailyRequirements: undefined as {
          calories: number;
          protein: number;
          carbs: number;
          fat: number;
          fiber: number;
        } | undefined,
        weeklyRequirements: undefined as any,
        comorbidityAdjustments: undefined as any
      },
      interventions: [] as string[]
    }
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableWards, setAvailableWards] = useState<Ward[]>([]);

  React.useEffect(() => {
    setAvailableWards(unthPatientService.getAvailableWards());
  }, []);

  // Utility Functions
  const calculateBMI = (height: number, weight: number): number => {
    if (height > 0 && weight > 0) {
      const heightInMeters = height / 100;
      return weight / (heightInMeters * heightInMeters);
    }
    return 0;
  };

  const getBMIScore = (bmi: number): number => {
    if (bmi < 18.5) return 2;
    if (bmi < 20) return 1;
    return 0;
  };

  const calculateDVTScore = (factors: any): { score: number; riskLevel: 'low' | 'moderate' | 'high' | 'very_high' } => {
    let score = 0;
    
    // 1 Point Risk Factors
    const onePointFactors = [
      'age_41_60', 'minor_surgery', 'bmi_over_25', 'swollen_legs', 'varicose_veins',
      'pregnancy_postpartum', 'oral_contraceptives', 'sepsis_1month', 'serious_lung_disease',
      'abnormal_pulmonary', 'acute_mi', 'chf_1month', 'inflammatory_bowel', 'medical_patient_bedrest'
    ];
    onePointFactors.forEach(factor => {
      if (factors[factor]) score += 1;
    });
    
    // 2 Point Risk Factors
    const twoPointFactors = [
      'age_61_74', 'arthroscopic_surgery', 'malignancy', 'major_surgery_45min',
      'laparoscopic_45min', 'patient_confined_bed', 'immobilizing_cast', 'central_venous_access'
    ];
    twoPointFactors.forEach(factor => {
      if (factors[factor]) score += 2;
    });
    
    // 3 Point Risk Factors
    const threePointFactors = [
      'age_over_75', 'personal_history_vte', 'family_history_vte', 'factor_v_leiden',
      'prothrombin_mutation', 'elevated_homocysteine', 'lupus_anticoagulant',
      'anticardiolipin_antibodies', 'heparin_thrombocytopenia', 'other_thrombophilia'
    ];
    threePointFactors.forEach(factor => {
      if (factors[factor]) score += 3;
    });
    
    // 5 Point Risk Factors
    const fivePointFactors = [
      'stroke_1month', 'elective_arthroplasty', 'hip_pelvis_fracture', 'acute_spinal_injury'
    ];
    fivePointFactors.forEach(factor => {
      if (factors[factor]) score += 5;
    });
    
    // Caprini Risk Stratification
    let riskLevel: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
    if (score >= 9) riskLevel = 'very_high'; // Highest risk (>40% VTE risk)
    else if (score >= 5) riskLevel = 'high'; // High risk (10-40% VTE risk)
    else if (score >= 3) riskLevel = 'moderate'; // Moderate risk (3-10% VTE risk)
    else riskLevel = 'low'; // Low risk (<1% VTE risk)
    
    return { score, riskLevel };
  };

  const calculateBradenScore = (subscores: any): { score: number; riskLevel: 'low' | 'moderate' | 'high' | 'very_high' } => {
    const score = Object.values(subscores).reduce((sum: number, val: any) => sum + val, 0);
    let riskLevel: 'low' | 'moderate' | 'high' | 'very_high' = 'low';
    if (score <= 9) riskLevel = 'very_high';
    else if (score <= 12) riskLevel = 'high';
    else if (score <= 14) riskLevel = 'moderate';
    
    return { score, riskLevel };
  };

  const calculateMUSTScore = (bmiScore: number, weightLoss: number, acuteDisease: boolean): { score: number; riskLevel: 'low' | 'moderate' | 'high' } => {
    const weightLossScore = weightLoss >= 10 ? 2 : weightLoss >= 5 ? 1 : 0;
    const acuteDiseaseScore = acuteDisease ? 2 : 0;
    const score = bmiScore + weightLossScore + acuteDiseaseScore;
    
    let riskLevel: 'low' | 'moderate' | 'high' = 'low';
    if (score >= 2) riskLevel = 'high';
    else if (score === 1) riskLevel = 'moderate';
    
    return { score, riskLevel };
  };

  // Generate AI Recommendations
  const generateAIRecommendations = async (assessmentType: 'dvt' | 'pressureSore' | 'nutritional', score: number, riskLevel: string) => {
    try {
      const recommendations = getEvidenceBasedRecommendations(assessmentType, score, riskLevel);
      
      setAiRecommendations(prev => ({
        ...prev,
        [assessmentType]: {
          ...prev[assessmentType],
          recommendations: recommendations.clinical,
          interventions: recommendations.interventions,
          score,
          riskLevel
        }
      }));

      // Generate meal plan for nutritional assessment if high risk
      if (assessmentType === 'nutritional' && riskLevel === 'high') {
        await generateNigerianMealPlan();
      }
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
    }
  };

  const getEvidenceBasedRecommendations = (type: 'dvt' | 'pressureSore' | 'nutritional', score: number, riskLevel: string) => {
    const recommendations = {
      dvt: {
        low: {
          clinical: [
            'Low VTE risk (Caprini Score 0-2): <1% risk',
            'Early mobilization encouraged',
            'Maintain adequate hydration',
            'No pharmacological prophylaxis required',
            'Monitor for signs and symptoms of VTE'
          ],
          interventions: ['Patient education on DVT prevention', 'Encourage ambulation']
        },
        moderate: {
          clinical: [
            'Moderate VTE risk (Caprini Score 3-4): 3-10% risk',
            'Mechanical prophylaxis recommended (compression stockings or IPC)',
            'Consider low-dose LMWH or UFH for surgical patients',
            'Early and frequent mobilization',
            'Enhanced monitoring for DVT/PE symptoms'
          ],
          interventions: ['Compression stockings 15-20mmHg or IPC', 'Daily risk reassessment', 'Mobility protocols']
        },
        high: {
          clinical: [
            'High VTE risk (Caprini Score 5-8): 10-40% risk',
            'PHARMACOLOGICAL prophylaxis strongly recommended',
            'LMWH (Enoxaparin 40mg SC daily) or UFH 5000 units SC q8-12h',
            'PLUS mechanical prophylaxis (IPC or compression stockings)',
            'Extended prophylaxis may be warranted (up to 35 days post-op)',
            'Monitor for bleeding complications'
          ],
          interventions: ['Anticoagulation + mechanical prophylaxis', 'Extended prophylaxis protocol', 'Daily clinical assessment']
        },
        very_high: {
          clinical: [
            'HIGHEST VTE RISK (Caprini Score ≥9): >40% risk',
            'URGENT: Aggressive combined prophylaxis mandatory',
            'Therapeutic anticoagulation if no contraindications',
            'LMWH (Enoxaparin 40mg SC daily) + IPC devices',
            'Consider IVC filter if anticoagulation contraindicated',
            'Extended prophylaxis for 4-5 weeks post-surgery',
            'ICU monitoring if critically ill',
            'Immediate duplex ultrasound if any VTE symptoms'
          ],
          interventions: ['Maximum prophylaxis protocol', 'IVC filter consideration', 'Extended anticoagulation', 'Specialist consultation']
        }
      },
      pressureSore: {
        low: {
          clinical: [
            '✅ LOW RISK (Braden Score 19-23): Routine Prevention Protocol',
            '',
            '📋 REPOSITIONING SCHEDULE:',
            '• Turn patient every 4 hours while in bed',
            '• 30-degree lateral position or supine (avoid 90-degree side-lying)',
            '• Use pillows to support positioning and prevent direct bone-to-bone contact',
            '• Encourage patient to shift weight every 15 minutes if able',
            '• Mobilize to chair 3 times daily if condition permits',
            '',
            '🛏️ SUPPORT SURFACES:',
            '• Standard hospital mattress is adequate',
            '• Use foam wedge pillows for positioning',
            '• Chair cushion if sitting >2 hours',
            '',
            '👀 SKIN ASSESSMENT:',
            '• Daily full skin inspection (especially sacrum, heels, elbows, occiput)',
            '• Document skin condition at each shift change',
            '• Check for non-blanchable erythema (Stage 1 pressure injury)',
            '',
            '🧴 SKIN CARE:',
            '• Keep skin clean and dry',
            '• Moisturize dry skin (avoid over-hydration)',
            '• Use pH-balanced cleansers',
            '• Protect skin from moisture (incontinence, perspiration)',
            '• Apply barrier cream to at-risk areas if incontinent',
            '',
            '🍽️ NUTRITION:',
            '• Maintain adequate hydration (30ml/kg/day)',
            '• Ensure balanced diet with adequate protein (1.0g/kg/day)',
            '• Monitor weekly weight',
            '',
            '📚 EDUCATION:',
            '• Teach patient/family about pressure injury prevention',
            '• Demonstrate self-repositioning techniques',
            '• Explain importance of mobilization'
          ],
          interventions: ['Daily skin inspection', '4-hourly repositioning', 'Patient/family education', 'Standard mattress', 'Hydration protocol']
        },
        moderate: {
          clinical: [
            '⚠️ MODERATE RISK (Braden Score 15-18): Enhanced Prevention Protocol',
            '',
            '📋 REPOSITIONING SCHEDULE:',
            '• STRICT 2-4 hourly turning schedule (document times on turning chart)',
            '• 30-degree lateral tilt using pillows/positioning devices',
            '• Alternate positions: Supine → Right lateral → Supine → Left lateral → Prone (if tolerated)',
            '• Avoid 90-degree side-lying (increases pressure on trochanter)',
            '• Float heels off bed surface using pillows under calves (NOT under knees)',
            '• Limit head-of-bed elevation to <30 degrees (unless contraindicated) to reduce shearing',
            '• Mobilize to chair 2-3 times daily with adequate cushioning',
            '',
            '🛏️ SUPPORT SURFACES:',
            '• Upgrade to pressure-redistributing foam mattress (medium-density)',
            '• Consider alternating pressure air mattress for bed-bound patients',
            '• Use gel or foam cushion for chair (if sitting >1 hour)',
            '• Heel protectors or foam boots (keep heels "floating")',
            '• Use slide sheets for transfers (reduce friction/shear)',
            '',
            '👀 SKIN ASSESSMENT:',
            '• Inspect skin at EVERY repositioning (minimum 3 times per shift)',
            '• Focus on high-risk areas: sacrum, heels, ischial tuberosities, greater trochanters, elbows, occiput',
            '• Use Braden Scale assessment weekly or if condition changes',
            '• Photograph any suspicious areas for comparison',
            '• Report ANY non-blanchable erythema immediately',
            '',
            '🧴 INTENSIVE SKIN CARE:',
            '• Cleanse skin immediately after incontinence episode',
            '• Use pH-balanced skin cleanser (avoid soap)',
            '• Apply moisture barrier cream to buttocks/perineum if incontinent',
            '• Moisturize dry skin twice daily (avoid massaging over bony prominences)',
            '• Use incontinence pads with moisture-wicking properties',
            '• Keep bed linens smooth and wrinkle-free',
            '',
            '🍽️ ENHANCED NUTRITION:',
            '• High-protein diet (1.2-1.5g/kg/day)',
            '• Ensure 30-35 kcal/kg/day caloric intake',
            '• Supplement with Vitamin C (500mg daily) and Zinc (15-20mg daily)',
            '• Maintain hydration 30-35ml/kg/day (unless fluid-restricted)',
            '• Consider oral nutritional supplements (ONS) if intake inadequate',
            '• Monitor weekly weight and albumin levels',
            '',
            '🔧 EQUIPMENT MANAGEMENT:',
            '• Remove restrictive devices (oxygen tubing, catheters) from under patient',
            '• Pad medical devices that contact skin (C-collar, splints, tubing)',
            '• Use soft silicone dressings prophylactically on high-risk areas',
            '',
            '📊 DOCUMENTATION:',
            '• Complete turning chart at every repositioning',
            '• Document skin condition with each assessment',
            '• Record nutritional intake daily'
          ],
          interventions: ['2-4 hourly repositioning with chart', 'Pressure-redistributing mattress', 'Heel protection', 'Enhanced nutrition protocol', 'Comprehensive skin inspection', 'Moisture management', 'Equipment padding']
        },
        high: {
          clinical: [
            '🚨 HIGH RISK (Braden Score 13-14): Intensive Prevention Protocol',
            '',
            '⏰ STRICT REPOSITIONING SCHEDULE:',
            '• MANDATORY 2-HOURLY REPOSITIONING around the clock',
            '• Document on turning chart with signature and time',
            '• Use 30-degree lateral tilt (NEVER 90-degree side-lying)',
            '• Position sequence: Supine → Right 30° → Supine → Left 30° → Prone (if tolerated)',
            '• FLOAT HEELS at all times using pillows under calves (heels must NOT touch bed)',
            '• Limit head-of-bed elevation to <30 degrees (reduce shearing forces)',
            '• Use slide sheets for ALL repositioning (NEVER drag patient)',
            '• Avoid positioning directly on medical devices (catheters, tubing)',
            '• Mobilize to chair 2x daily (limit sitting time to 1-2 hours) with pressure-relief cushion',
            '• Encourage micro-movements every 15 minutes if patient is able',
            '',
            '🛏️ ADVANCED SUPPORT SURFACES (MANDATORY):',
            '• Upgrade to DYNAMIC pressure-redistributing mattress (alternating air pressure or low air loss)',
            '• Active mattress systems with automatic pressure cycling',
            '• High-spec gel or foam chair cushion (must NOT "bottom out")',
            '• Heel protectors/boots with suspension design (heels must float)',
            '• Consider air-fluidized therapy bed if multiple existing wounds',
            '• Use slide sheets, transfer boards, and lifting devices for ALL moves',
            '',
            '👀 CONTINUOUS SKIN MONITORING:',
            '• Full skin inspection at EVERY 2-hour repositioning',
            '• Priority areas: sacrum, coccyx, heels, ischial tuberosities, trochanters, elbows, scapulae, occiput, ears',
            '• Assess for: Non-blanchable erythema, blistering, skin tears, moisture damage, deep tissue injury',
            '• Use structured assessment tool (e.g., PUSH tool, Bates-Jensen)',
            '• Photograph all suspicious areas with measurement scale',
            '• Immediate escalation if ANY Stage 1 pressure injury detected',
            '• Braden Scale reassessment every 48 hours or with condition change',
            '',
            '🧴 ADVANCED SKIN PROTECTION:',
            '• Gentle cleansing with pH-balanced cleanser (pH 4.5-5.5)',
            '• Pat skin dry (do NOT rub), pay attention to skin folds',
            '• Apply moisture barrier cream/film to at-risk areas (sacrum, buttocks, heels)',
            '• Use prophylactic silicone foam dressings on bony prominences (sacrum, heels)',
            '• Incontinence management: Moisture-wicking pads, immediate cleansing, barrier protection',
            '• Keep linens dry, smooth, and wrinkle-free',
            '• Avoid friction during care (use cornstarch or dry lubricant for transfers if needed)',
            '',
            '🍽️ AGGRESSIVE NUTRITIONAL SUPPORT:',
            '• URGENT dietitian consultation within 24 hours',
            '• High-protein diet: 1.5g/kg/day (or higher if wounds present)',
            '• High-calorie intake: 35-40 kcal/kg/day',
            '• SUPPLEMENTATION (unless contraindicated):',
            '  - Protein supplements (whey protein shakes)',
            '  - Vitamin C: 500-1000mg daily',
            '  - Zinc: 15-20mg daily',
            '  - Vitamin A: 10,000 IU daily',
            '  - Arginine: 9g daily (if wounds present)',
            '• Hydration: 30-35ml/kg/day (monitor I&O)',
            '• Monitor: Daily food intake, weekly weight, albumin/pre-albumin every 2 weeks',
            '• Consider enteral feeding if oral intake <50% of requirements',
            '',
            '🩹 EXISTING WOUND PROTECTION (if applicable):',
            '• Avoid positioning directly on existing wounds',
            '• Use advanced wound dressings (foam, hydrocolloid, or silicone)',
            '• Document wound size, depth, exudate, tissue type weekly',
            '• Cleanse wounds with normal saline (NOT antiseptics)',
            '• Consider negative pressure wound therapy (NPWT) for Stage 3-4 injuries',
            '',
            '💊 MEDICAL OPTIMIZATION:',
            '• Optimize hemoglobin (target >10g/dL)',
            '• Control blood glucose (target <180mg/dL)',
            '• Maintain adequate tissue perfusion (MAP >65mmHg)',
            '• Treat infections aggressively',
            '• Review medications that impair healing (steroids, NSAIDs)',
            '',
            '👥 INTERDISCIPLINARY CARE:',
            '• Daily wound care nurse consultation',
            '• Weekly review by plastic surgery/wound team',
            '• Physical therapy for mobility assessment',
            '• Occupational therapy for positioning equipment',
            '',
            '📊 DOCUMENTATION & MONITORING:',
            '• Complete turning chart every 2 hours (signed)',
            '• Document skin assessment findings at each turn',
            '• Daily photograph of high-risk areas',
            '• Weekly Braden Scale reassessment',
            '• Daily nutritional intake documentation',
            '• Maintain pressure injury prevention flowsheet'
          ],
          interventions: ['Mandatory 2-hourly repositioning', 'Dynamic pressure mattress', 'Prophylactic dressings on bony prominences', 'Intensive nutritional support', 'Heel suspension', 'Dietitian consultation', 'Wound team involvement', 'Comprehensive documentation']
        },
        very_high: {
          clinical: [
            '🔴 CRITICAL RISK (Braden Score ≤12): EMERGENCY Prevention Protocol',
            '⚠️ IMMEDIATE ACTION REQUIRED - ACTIVATE WOUND CARE TEAM',
            '',
            '⏰ MAXIMUM INTENSITY REPOSITIONING:',
            '• HOURLY to 2-HOURLY repositioning (more frequent if existing wounds)',
            '• Dedicated turning team or 1:1 nursing if needed',
            '• Continuous position documentation on electronic/paper chart',
            '• Use 30-degree lateral tilt ONLY (avoid all direct pressure on bony prominences)',
            '• Position rotation: Right 30° → Supine → Left 30° → Prone (if tolerated) → Repeat',
            '• COMPLETE heel suspension at ALL times (use calf pillows, NOT knee pillows)',
            '• Head-of-bed <30 degrees maximum (unless respiratory contraindication)',
            '• Use ceiling lift or 3+ staff for ALL transfers (zero manual lifting)',
            '• Slide sheets mandatory for every micro-adjustment',
            '• Chair time limited to 1 hour maximum with hourly weight shifts',
            '• If bedridden: Consider continuous lateral rotation therapy bed',
            '',
            '🛏️ SPECIALIZED SUPPORT SURFACES (IMMEDIATE UPGRADE):',
            '• HIGH-SPECIFICATION active mattress system:',
            '  - Low air loss mattress with alternating pressure',
            '  - Air-fluidized therapy bed (if multiple Stage 3-4 wounds)',
            '  - Lateral rotation therapy bed (if critically ill)',
            '• Check mattress inflation/function every shift',
            '• Ensure patient does NOT "bottom out" (hand check test)',
            '• High-spec pressure-redistributing chair cushion (gel/alternating air)',
            '• Full heel suspension boots/devices (heels must NEVER touch any surface)',
            '• Foam or gel padding for ALL bony prominences',
            '• Consider specialty bed rental (e.g., KCI Therapeutic bed)',
            '',
            '👀 INTENSIVE SKIN SURVEILLANCE:',
            '• Full head-to-toe skin inspection EVERY repositioning (hourly to 2-hourly)',
            '• Critical focus areas: Sacrum, coccyx, heels, ischial tuberosities, greater trochanters, elbows, scapulae, occiput, ears, nose (if intubated)',
            '• Inspect UNDER all medical devices (C-collar, splints, oxygen tubing, IV lines, catheters)',
            '• Use structured assessment: NPUAP/EPUAP staging, color, temperature, sensation',
            '• Immediate photography of ANY new erythema or discoloration',
            '• Measure and document ANY suspicious area (length x width x depth)',
            '• Check for deep tissue injury (purple/maroon discoloration)',
            '• Braden Scale reassessment every 24-48 hours',
            '• Consider skin perfusion assessment (transcutaneous oxygen if available)',
            '',
            '🧴 MAXIMUM SKIN PROTECTION PROTOCOL:',
            '• Gentle cleansing with pH-balanced cleanser after EVERY incontinence episode',
            '• Pat skin dry gently (NO friction/rubbing)',
            '• Apply moisture barrier film or cream to sacrum, buttocks, perineum',
            '• PROPHYLACTIC DRESSINGS (prevent pressure injuries before they form):',
            '  - Soft silicone foam dressings on: sacrum, heels (both), elbows (both), scapulae',
            '  - Change prophylactic dressings per manufacturer guidelines (usually 3-7 days)',
            '  - Monitor skin under dressings at each dressing change',
            '• Incontinence management: Indwelling catheter consideration, fecal management system',
            '• Use moisture-wicking bed pads (change immediately when wet)',
            '• Smoothen ALL wrinkles from linens after each turn',
            '• Avoid ANY friction during care (liberal use of slide sheets)',
            '',
            '🍽️ MAXIMUM NUTRITIONAL INTERVENTION:',
            '• EMERGENCY dietitian consultation within 12 hours',
            '• Implement HIGH-PROTEIN, HIGH-CALORIE nutrition plan:',
            '  - Protein: 1.5-2.0g/kg/day (even higher if wounds present)',
            '  - Calories: 35-40 kcal/kg/day (or higher)',
            '• AGGRESSIVE SUPPLEMENTATION:',
            '  - High-calorie protein shakes (Ensure Plus, Boost, or specialized wound formula)',
            '  - Arginine 9g daily (enhances collagen synthesis)',
            '  - Glutamine 15-30g daily (immune support)',
            '  - Vitamin C: 1000mg daily',
            '  - Zinc: 20mg daily (do NOT exceed without monitoring)',
            '  - Vitamin A: 10,000-25,000 IU daily',
            '  - Vitamin D: optimize levels (target >30ng/mL)',
            '  - Omega-3 fatty acids (anti-inflammatory)',
            '• Hydration: 30-35ml/kg/day (strict I&O monitoring)',
            '• Monitor labs: Albumin, pre-albumin, total protein, hemoglobin (weekly)',
            '• If oral intake <50% of needs: Start ENTERAL NUTRITION (NG/NJ tube)',
            '• Consider parenteral nutrition if enteral not feasible',
            '• Daily calorie count by dietitian',
            '',
            '🩹 EXISTING WOUND INTENSIVE MANAGEMENT:',
            'IF PRESSURE INJURIES ALREADY PRESENT:',
            '• NEVER position on existing wounds',
            '• Stage 1: Protect with prophylactic foam dressing, increase repositioning frequency',
            '• Stage 2: Hydrocolloid or foam dressing, protect from friction/shear',
            '• Stage 3-4: Urgent plastic surgery/wound team consultation',
            '  - Consider negative pressure wound therapy (NPWT)',
            '  - Sharp debridement of necrotic tissue',
            '  - Advanced wound care products (collagen, growth factors)',
            '  - Plan for surgical flap closure if indicated',
            '• Unstageable/DTI: Do NOT debride eschar on heels; monitor closely for infection',
            '• Cleanse with normal saline or wound cleanser (NOT hydrogen peroxide/Betadine)',
            '• Document wounds daily: Size (L×W×D), exudate amount/type, tissue type, odor, pain',
            '• Photograph wounds weekly (or with significant changes)',
            '• Use validated wound assessment tool (PUSH, Bates-Jensen)',
            '',
            '💊 MEDICAL OPTIMIZATION (URGENT):',
            '• Optimize tissue perfusion: Target MAP >65mmHg, adequate cardiac output',
            '• Optimize oxygenation: SpO2 >92%, consider supplemental oxygen',
            '• Correct anemia: Target hemoglobin >10g/dL (transfuse if needed)',
            '• Tight glycemic control: Keep blood glucose 140-180mg/dL',
            '• Treat infections aggressively (wounds, UTI, pneumonia)',
            '• Review ALL medications:',
            '  - Minimize steroids if possible (impair wound healing)',
            '  - Avoid NSAIDs (impair collagen synthesis)',
            '  - Ensure adequate pain control (enables repositioning)',
            '• Consider vasopressor review if patient on high-dose pressors (peripheral perfusion)',
            '',
            '👥 MANDATORY INTERDISCIPLINARY TEAM:',
            '• DAILY wound care nurse specialist rounds',
            '• Plastic surgery/wound team consultation within 24 hours',
            '• Weekly interdisciplinary team meeting (nursing, MD, PT, OT, dietitian, wound specialist)',
            '• Physical therapy: Mobility assessment, positioning equipment recommendations',
            '• Occupational therapy: Specialized positioning devices, adaptive equipment',
            '• Social work: Equipment acquisition, discharge planning',
            '• Consider palliative care consultation if goals of care discussions needed',
            '',
            '🏥 EQUIPMENT & RESOURCES:',
            '• Acquire high-spec pressure redistribution bed (hospital bed management)',
            '• Obtain ceiling lift or bariatric equipment if needed',
            '• Stock prophylactic dressings, advanced wound care supplies',
            '• Ensure adequate staffing for hourly turning (consider 1:1 nursing)',
            '',
            '📊 COMPREHENSIVE DOCUMENTATION:',
            '• Turning chart completed EVERY hour (time, position, signature)',
            '• Skin assessment documented at EVERY repositioning',
            '• Daily photograph of high-risk areas and existing wounds',
            '• Weekly wound measurements and PUSH/Bates-Jensen scores',
            '• Daily nutritional intake documentation with calorie count',
            '• Braden Scale every 24-48 hours',
            '• Maintain electronic/paper pressure injury prevention flowsheet',
            '• Document ALL interventions and patient response',
            '',
            '📞 ESCALATION CRITERIA:',
            '• ANY new non-blanchable erythema → Immediate notification to wound team',
            '• ANY new skin breakdown → Photograph, measure, escalate to MD/wound team',
            '• Worsening of existing wounds → Urgent surgical consultation',
            '• Patient declining repositioning → Pain management, goals of care discussion',
            '',
            '⚖️ ETHICAL CONSIDERATIONS:',
            '• Daily assessment of patient comfort during repositioning',
            '• Consider goals of care discussion if patient is end-of-life',
            '• Balance aggressive prevention with patient dignity and comfort',
            '• Family education on realistic expectations and prevention efforts'
          ],
          interventions: ['Hourly-to-2-hourly repositioning', 'High-spec active mattress system', 'Prophylactic dressings on ALL bony prominences', 'Emergency nutritional support', 'Complete heel suspension', 'Immediate wound team activation', 'Hourly skin monitoring', 'Dedicated turning staff', 'Advanced wound care', 'Interdisciplinary daily rounds', '1:1 nursing consideration']
        }
      },
      nutritional: {
        low: {
          clinical: [
            'Routine nutritional monitoring',
            'Maintain current dietary intake',
            'Weekly weight monitoring',
            'General nutritional education'
          ],
          interventions: ['Weekly monitoring', 'General dietary advice']
        },
        moderate: {
          clinical: [
            'Enhanced nutritional monitoring',
            'Consider dietary supplements',
            'Monitor food intake and appetite',
            'Nutritional counseling'
          ],
          interventions: ['Dietary assessment', 'Supplement consideration', 'Regular monitoring']
        },
        high: {
          clinical: [
            'URGENT: Immediate dietitian referral',
            'Comprehensive nutritional assessment',
            'Consider oral nutritional supplements',
            'Monitor for refeeding syndrome if severely malnourished',
            'Address underlying causes of malnutrition'
          ],
          interventions: ['Immediate dietitian referral', 'Nutritional supplements', 'Meal plan implementation']
        }
      }
    };

    return recommendations[type]?.[riskLevel as keyof typeof recommendations[typeof type]] || { clinical: [], interventions: [] };
  };

  const generateNigerianMealPlan = async () => {
    const { bmi, weight, height } = riskAssessmentData.nutritional;
    const comorbidities = riskAssessmentData.clinical.comorbidities;
    const diagnosis = riskAssessmentData.clinical.primary_diagnosis;
    
    // Calculate daily nutritional requirements
    const baseMetabolicRate = weight * 24; // Simple BMR calculation
    const activityLevel = riskAssessmentData.clinical.activity_level || 'moderate';
    const activityMultiplier = activityLevel === 'sedentary' ? 1.2 : activityLevel === 'moderate' ? 1.5 : 1.7;
    const dailyCalories = Math.round(baseMetabolicRate * activityMultiplier);
    
    // Adjust protein based on conditions (1.2-2.0 g/kg for wound healing, 0.8 g/kg for renal)
    const hasRenalImpairment = comorbidities.includes('renal_impairment') || comorbidities.includes('chronic_kidney_disease');
    const hasWoundHealing = diagnosis.toLowerCase().includes('wound') || diagnosis.toLowerCase().includes('surgery') || diagnosis.toLowerCase().includes('burn');
    const proteinPerKg = hasRenalImpairment ? 0.6 : hasWoundHealing ? 1.5 : 1.0;
    const dailyProtein = Math.round(weight * proteinPerKg);
    
    // Adjust carbs and fats based on diabetes
    const hasDiabetes = comorbidities.includes('diabetes') || comorbidities.includes('type_2_diabetes');
    const hasHypertension = comorbidities.includes('hypertension') || comorbidities.includes('high_blood_pressure');
    const hasLiverDisease = comorbidities.includes('liver_disease') || comorbidities.includes('hepatitis');
    
    // Calculate macronutrient distribution
    const carbsPercentage = hasDiabetes ? 0.40 : 0.50; // 40-50% calories from carbs
    const fatPercentage = 0.30; // 30% calories from fats
    const dailyCarbs = Math.round((dailyCalories * carbsPercentage) / 4); // 4 cal/g
    const dailyFat = Math.round((dailyCalories * fatPercentage) / 9); // 9 cal/g
    const dailyFiber = Math.round(weight * 0.4); // 25-40g fiber

    // Nigerian Food Composition Table - Based on African Food Composition
    const nigerianFoods = {
      // Breakfast options (High fiber, moderate protein)
      breakfast: {
        diabetes: [
          'Oats porridge (40g oats) with cucumber and boiled egg (provides 15g protein, low GI)',
          'Unripe plantain porridge (200g) with smoked fish (30g protein, complex carbs)',
          'Millet pap (akamu) with moi moi and fish (20g protein)',
          'Boiled sweet potato (150g) with vegetable omelet (2 eggs, 12g protein)'
        ],
        normal: [
          'Yam and scrambled eggs (2 eggs) with vegetables (45g carbs, 15g protein)',
          'Bread (2 slices) and akara (bean cakes, 4 pieces) with pap (25g protein)',
          'Pancakes with honey and fruits (garden egg, banana)',
          'Fried yam (150g) with fried egg and vegetables (40g carbs)'
        ]
      },
      
      // Lunch options (High protein, moderate carbs)
      lunch: {
        hypertension: [
          'Brown rice (150g) with grilled fish (80g) and steamed vegetables - NO ADDED SALT (30g protein)',
          'Yam porridge with vegetables (low sodium) - use herbs for flavor (8g protein)',
          'Beans (100g) and plantain - reduced salt (15g protein, high fiber)',
          'Tuwo shinkafa (150g) with miyan kuka - herbal seasoning only (20g protein)'
        ],
        normal: [
          'Jollof rice (200g) with grilled chicken (100g) and plantain (35g protein)',
          'Fried rice with chicken and vegetables (mixed peppers, carrots, green beans)',
          'Ofada rice (180g) with ayamase stew (pepper sauce with assorted meat)',
          'Coconut rice (200g) with chicken stew'
        ]
      },
      
      // Dinner options (Moderate protein, high vegetables)
      dinner: {
        renal: [
          'White rice (150g) with low-protein vegetable stew (tomatoes, peppers) - limit to 30g protein/day',
          'Rice with low-protein vegetable curry - avoid beans, limit meat',
          'White rice with low-protein tomato stew - control phosphorus',
          'Rice (150g) with vegetable soup - minimal protein sources'
        ],
        normal: [
          'Pounded yam (250g) with egusi soup (melon seed) and fish (100g) (40g protein)',
          'Fufu (200g) with bitter leaf soup and stockfish (35g protein)',
          'Eba (garri, 200g) with okra soup and fish (25g protein)',
          'Semo (150g) with ogbono soup (wild mango seed) and meat (30g protein)',
          'Amala (200g) with ewedu and fish stew (28g protein)',
          'Poundo yam with afang soup and periwinkle (32g protein)'
        ]
      },
      
      // Snacks (Nutrient-dense, portion-controlled)
      snacks: {
        liver_disease: [
          'Banana (medium)', 'Cucumber slices (100g)', 'Carrot sticks (50g)', 
          'Apple (small)', 'Orange (medium)', 'Watermelon (100g)', 'Carrot juice (200ml)'
        ],
        normal: [
          'Groundnuts (30g, 7g protein)', 'Garden egg with groundnut paste',
          'Tiger nuts (ayana, 40g)', 'Chin chin (30g)', 'Zobo drink (no sugar)',
          'Coconut pieces (40g)', 'Boli (roasted plantain) with groundnut',
          'Dates (5 pieces)', 'Yogurt (unsweetened, 150ml)', 'Meat pie (small)'
        ]
      }
    };

    // Generate 7-day meal plan with rotation
    const mealPlan: any[] = [];
    for (let day = 1; day <= 7; day++) {
      const breakfast = nigerianFoods.breakfast[hasDiabetes ? 'diabetes' : 'normal'][day % 4];
      const lunch = nigerianFoods.lunch[hasHypertension ? 'hypertension' : 'normal'][day % 4];
      const dinner = nigerianFoods.dinner[hasRenalImpairment ? 'renal' : 'normal'][day % 6];
      const snackOptions = nigerianFoods.snacks[hasLiverDisease ? 'liver_disease' : 'normal'];
      const snacks = [
        snackOptions[(day * 2) % snackOptions.length],
        snackOptions[(day * 2 + 1) % snackOptions.length]
      ];

      mealPlan.push({
        day,
        breakfast,
        lunch,
        dinner,
        snacks,
        nutritionalInfo: {
          calories: dailyCalories,
          protein: hasRenalImpairment ? Math.round(dailyProtein * 0.8) : dailyProtein,
          carbs: dailyCarbs,
          fat: dailyFat,
          fiber: dailyFiber,
          sodium: hasHypertension ? '< 2000mg' : '< 2300mg',
          potassium: hasRenalImpairment ? '< 2000mg' : 'normal',
          phosphorus: hasRenalImpairment ? '< 1000mg' : 'normal'
        },
        specialInstructions: [
          hasDiabetes ? 'Monitor blood glucose 2hrs after meals' : '',
          hasHypertension ? 'NO added salt - use herbs (basil, thyme, ginger) for flavor' : '',
          hasRenalImpairment ? 'Limit protein to prescribed amount, avoid potassium-rich foods' : '',
          hasLiverDisease ? 'Small frequent meals, avoid fried foods' : '',
          hasWoundHealing ? 'High protein for tissue repair, adequate vitamin C and zinc' : ''
        ].filter(x => x)
      });
    }

    // Calculate weekly nutritional summary
    const weeklyRequirements = {
      totalCalories: dailyCalories * 7,
      totalProtein: dailyProtein * 7,
      totalCarbs: dailyCarbs * 7,
      totalFat: dailyFat * 7,
      totalFiber: dailyFiber * 7
    };

    setAiRecommendations(prev => ({
      ...prev,
      nutritional: {
        ...prev.nutritional,
        mealPlan: {
          generated: true,
          days: mealPlan,
          dailyRequirements: {
            calories: dailyCalories,
            protein: dailyProtein,
            carbs: dailyCarbs,
            fat: dailyFat,
            fiber: dailyFiber
          },
          weeklyRequirements,
          comorbidityAdjustments: {
            diabetes: hasDiabetes ? 'Low GI foods, controlled carbohydrates' : null,
            hypertension: hasHypertension ? 'Low sodium (<2000mg/day), DASH diet principles' : null,
            renal: hasRenalImpairment ? 'Protein restriction, phosphorus & potassium control' : null,
            liver: hasLiverDisease ? 'Small frequent meals, adequate protein, low fat' : null
          }
        }
      }
    }));
  };

  // Export Meal Plan to PDF
  const exportMealPlanToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    
    // Header with UNTH branding
    doc.setFillColor(14, 159, 110); // Green color
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Department of Plastic Surgery', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(12);
    doc.text('7-DAY PERSONALIZED MEAL PLAN', pageWidth / 2, 35, { align: 'center' });
    
    yPosition = 50;
    doc.setTextColor(0, 0, 0);
    
    // Patient Details Section
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION', 15, yPosition + 5.5);
    yPosition += 12;
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${(formData as any).surname || ''} ${formData.first_name || ''} ${(formData as any).other_names || ''}`, 15, yPosition);
    yPosition += 5;
    doc.text(`Hospital Number: ${formData.hospital_number || 'Pending'}`, 15, yPosition);
    doc.text(`Date: ${new Date().toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - 60, yPosition);
    yPosition += 5;
    doc.text(`Age: ${formData.date_of_birth ? Math.floor((new Date().getTime() - new Date(formData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'N/A'} years`, 15, yPosition);
    doc.text(`Gender: ${formData.sex || 'N/A'}`, 60, yPosition);
    doc.text(`Ward: ${(formData as any).ward || 'Outpatient'}`, 100, yPosition);
    yPosition += 8;
    
    // Clinical Information Section
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('CLINICAL INFORMATION', 15, yPosition + 5.5);
    yPosition += 12;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Diagnosis: ${riskAssessmentData.clinical.primary_diagnosis || 'N/A'}`, 15, yPosition);
    yPosition += 5;
    const comorbidities = riskAssessmentData.clinical.comorbidities.join(', ') || 'None';
    const comorbiditiesLines = doc.splitTextToSize(`Comorbidities: ${comorbidities}`, pageWidth - 30);
    doc.text(comorbiditiesLines, 15, yPosition);
    yPosition += (comorbiditiesLines.length * 5) + 3;
    
    // Nutritional Status
    doc.setFillColor(240, 240, 240);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('NUTRITIONAL STATUS', 15, yPosition + 5.5);
    yPosition += 12;
    
    doc.setFont('helvetica', 'normal');
    doc.text(`BMI: ${riskAssessmentData.nutritional.bmi.toFixed(1)} kg/m²`, 15, yPosition);
    doc.text(`Weight: ${riskAssessmentData.nutritional.weight} kg`, 70, yPosition);
    doc.text(`Height: ${riskAssessmentData.nutritional.height} cm`, 120, yPosition);
    yPosition += 5;
    doc.text(`Risk Level: ${aiRecommendations.nutritional.riskLevel.toUpperCase()}`, 15, yPosition);
    doc.text(`MUST Score: ${aiRecommendations.nutritional.score}`, 70, yPosition);
    yPosition += 8;
    
    // Daily Nutritional Requirements
    if (aiRecommendations.nutritional.mealPlan.dailyRequirements) {
      doc.setFillColor(240, 240, 240);
      doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('DAILY NUTRITIONAL REQUIREMENTS', 15, yPosition + 5.5);
      yPosition += 12;
      
      const req = aiRecommendations.nutritional.mealPlan.dailyRequirements;
      doc.setFont('helvetica', 'normal');
      doc.text(`Calories: ${req.calories} kcal`, 15, yPosition);
      doc.text(`Protein: ${req.protein}g`, 70, yPosition);
      doc.text(`Carbs: ${req.carbs}g`, 120, yPosition);
      yPosition += 5;
      doc.text(`Fats: ${req.fat}g`, 15, yPosition);
      doc.text(`Fiber: ${req.fiber}g`, 70, yPosition);
      yPosition += 8;
    }
    
    // Special Dietary Considerations
    if (aiRecommendations.nutritional.mealPlan.comorbidityAdjustments) {
      const adjustments = Object.entries(aiRecommendations.nutritional.mealPlan.comorbidityAdjustments)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key.toUpperCase()}: ${value}`);
      
      if (adjustments.length > 0) {
        doc.setFillColor(255, 243, 205);
        doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(150, 100, 0);
        doc.text('⚠ SPECIAL DIETARY CONSIDERATIONS', 15, yPosition + 5.5);
        yPosition += 12;
        
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        adjustments.forEach(adj => {
          const lines = doc.splitTextToSize(`• ${adj}`, pageWidth - 30);
          doc.text(lines, 15, yPosition);
          yPosition += lines.length * 5;
        });
        yPosition += 3;
      }
    }
    
    // Meal Plan Days
    aiRecommendations.nutritional.mealPlan.days.forEach((day, index) => {
      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Day Header
      doc.setFillColor(14, 159, 110);
      doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text(`DAY ${day.day}`, 15, yPosition + 5.5);
      yPosition += 12;
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      // Breakfast
      doc.setFont('helvetica', 'bold');
      doc.text('🌅 BREAKFAST:', 15, yPosition);
      doc.setFont('helvetica', 'normal');
      const breakfastLines = doc.splitTextToSize(day.breakfast, pageWidth - 30);
      doc.text(breakfastLines, 15, yPosition + 4);
      yPosition += (breakfastLines.length * 4) + 6;
      
      // Lunch
      doc.setFont('helvetica', 'bold');
      doc.text('☀️ LUNCH:', 15, yPosition);
      doc.setFont('helvetica', 'normal');
      const lunchLines = doc.splitTextToSize(day.lunch, pageWidth - 30);
      doc.text(lunchLines, 15, yPosition + 4);
      yPosition += (lunchLines.length * 4) + 6;
      
      // Dinner
      doc.setFont('helvetica', 'bold');
      doc.text('🌙 DINNER:', 15, yPosition);
      doc.setFont('helvetica', 'normal');
      const dinnerLines = doc.splitTextToSize(day.dinner, pageWidth - 30);
      doc.text(dinnerLines, 15, yPosition + 4);
      yPosition += (dinnerLines.length * 4) + 6;
      
      // Snacks
      doc.setFont('helvetica', 'bold');
      doc.text('🍎 SNACKS:', 15, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(day.snacks.join(', '), 15, yPosition + 4);
      yPosition += 8;
      
      // Special Instructions
      if (day.specialInstructions && day.specialInstructions.length > 0) {
        doc.setFillColor(254, 242, 242);
        const instructionHeight = day.specialInstructions.length * 4 + 8;
        doc.rect(10, yPosition, pageWidth - 20, instructionHeight, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(185, 28, 28);
        doc.text('⚠️ IMPORTANT INSTRUCTIONS:', 15, yPosition + 4);
        doc.setFont('helvetica', 'normal');
        let instrY = yPosition + 8;
        day.specialInstructions.forEach(instruction => {
          doc.text(`• ${instruction}`, 15, instrY);
          instrY += 4;
        });
        yPosition += instructionHeight + 2;
        doc.setTextColor(0, 0, 0);
      }
      
      // Nutritional Info
      doc.setFillColor(249, 250, 251);
      doc.rect(10, yPosition, pageWidth - 20, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('NUTRITION:', 15, yPosition + 4);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `${day.nutritionalInfo.calories} cal | ${day.nutritionalInfo.protein}g protein | ${day.nutritionalInfo.carbs}g carbs | ${day.nutritionalInfo.fat}g fat | ${day.nutritionalInfo.fiber}g fiber`,
        15, yPosition + 8
      );
      yPosition += 15;
      
      doc.setFontSize(10);
    });
    
    // Footer on last page
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const footerY = pageHeight - 15;
    doc.text('Generated by PLASTIC AND RECONSTRUCTIVE SURGERY UNIT PWA', pageWidth / 2, footerY, { align: 'center' });
    doc.text(`Date Generated: ${new Date().toLocaleString('en-NG')}`, pageWidth / 2, footerY + 4, { align: 'center' });
    doc.text('For medical use only. Follow physician\'s instructions.', pageWidth / 2, footerY + 8, { align: 'center' });
    
    // Save the PDF
    const fileName = `UNTH_MealPlan_${(formData as any).surname || 'Patient'}_${formData.hospital_number || new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  // Generate Specialist Consultation Letter PDF
  const generateConsultationLetterPDF = (assessmentType: 'dvt' | 'pressureSore' | 'nutritional') => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Determine specialist and consultation details based on assessment type
    const consultationDetails = {
      dvt: {
        specialist: 'Vascular Surgery / Hematology',
        title: 'URGENT CONSULTATION REQUEST',
        subtitle: 'Venous Thromboembolism (VTE) Risk Assessment',
        urgency: aiRecommendations.dvt.riskLevel === 'very_high' ? 'EMERGENCY' : 
                 aiRecommendations.dvt.riskLevel === 'high' ? 'URGENT' : 'ROUTINE',
        score: `Caprini Score: ${aiRecommendations.dvt.score}`,
        riskLevel: aiRecommendations.dvt.riskLevel.toUpperCase().replace('_', ' ')
      },
      pressureSore: {
        specialist: 'Plastic Surgery / Wound Care Specialist',
        title: 'CONSULTATION REQUEST',
        subtitle: 'Pressure Injury Risk Assessment',
        urgency: aiRecommendations.pressureSore.riskLevel === 'very_high' ? 'EMERGENCY' : 
                 aiRecommendations.pressureSore.riskLevel === 'high' ? 'URGENT' : 'ROUTINE',
        score: `Braden Scale Score: ${aiRecommendations.pressureSore.score}`,
        riskLevel: aiRecommendations.pressureSore.riskLevel.toUpperCase().replace('_', ' ')
      },
      nutritional: {
        specialist: 'Dietitian / Nutrition Support Team',
        title: 'CONSULTATION REQUEST',
        subtitle: 'Malnutrition Risk Assessment',
        urgency: aiRecommendations.nutritional.riskLevel === 'high' ? 'URGENT' : 'ROUTINE',
        score: `MUST Score: ${aiRecommendations.nutritional.score}`,
        riskLevel: aiRecommendations.nutritional.riskLevel.toUpperCase()
      }
    };

    const details = consultationDetails[assessmentType];
    const recommendations = aiRecommendations[assessmentType];

    // Header - UNTH Branding
    doc.setFillColor(14, 159, 110); // Green
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('ITUKU-OZALLA, ENUGU', pageWidth / 2, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Department of Plastic & Reconstructive Surgery', pageWidth / 2, 29, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(details.title, pageWidth / 2, 38, { align: 'center' });

    yPosition = 55;
    doc.setTextColor(0, 0, 0);

    // Urgency Banner
    if (details.urgency === 'EMERGENCY' || details.urgency === 'URGENT') {
      doc.setFillColor(220, 38, 38); // Red
      doc.rect(10, yPosition, pageWidth - 20, 10, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`⚠️ ${details.urgency} CONSULTATION`, pageWidth / 2, yPosition + 7, { align: 'center' });
      yPosition += 15;
      doc.setTextColor(0, 0, 0);
    }

    // Date and Reference
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`, 15, yPosition);
    doc.text(`Ref: UNTH/PS/${formData.hospital_number || 'XXXX'}/${new Date().getFullYear()}`, 15, yPosition + 5);
    yPosition += 15;

    // Addressee
    doc.setFont('helvetica', 'bold');
    doc.text('TO:', 15, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    doc.text(`The Consultant ${details.specialist}`, 15, yPosition);
    doc.text('University of Nigeria Teaching Hospital', 15, yPosition + 5);
    doc.text('Ituku-Ozalla, Enugu', 15, yPosition + 10);
    yPosition += 20;

    // Subject Line
    doc.setFont('helvetica', 'bold');
    doc.text('RE: ', 15, yPosition);
    doc.setFont('helvetica', 'underline');
    doc.text(details.subtitle, 23, yPosition);
    yPosition += 10;

    // Salutation
    doc.setFont('helvetica', 'normal');
    doc.text('Dear Colleague,', 15, yPosition);
    yPosition += 10;

    // Introduction
    const introText = doc.splitTextToSize(
      `I am writing to refer the above-named patient for your expert opinion and management regarding ${details.subtitle.toLowerCase()}. ` +
      `The patient has been assessed using our standardized risk assessment protocol and has been identified as ${details.riskLevel} RISK, ` +
      `requiring specialist consultation and management.`,
      pageWidth - 30
    );
    introText.forEach((line: string) => {
      doc.text(line, 15, yPosition);
      yPosition += 5;
    });
    yPosition += 5;

    // Patient Demographics
    doc.setFillColor(249, 250, 251);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('PATIENT DEMOGRAPHICS', 15, yPosition + 5);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${(formData as any).surname || ''} ${(formData as any).other_names || ''}`, 15, yPosition);
    doc.text(`Hospital Number: ${formData.hospital_number || 'N/A'}`, 120, yPosition);
    yPosition += 6;
    
    const age = formData.date_of_birth ? 
      Math.floor((Date.now() - new Date(formData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 0;
    doc.text(`Age: ${age} years`, 15, yPosition);
    doc.text(`Sex: ${formData.sex === 'male' ? 'Male' : 'Female'}`, 70, yPosition);
    doc.text(`Ward: ${(formData as any).ward || 'N/A'}`, 120, yPosition);
    yPosition += 10;

    // Clinical Information
    if ((formData as any).diagnosis) {
      doc.setFillColor(249, 250, 251);
      doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('CLINICAL INFORMATION', 15, yPosition + 5);
      yPosition += 12;

      doc.setFont('helvetica', 'normal');
      doc.text(`Primary Diagnosis: ${(formData as any).diagnosis}`, 15, yPosition);
      yPosition += 10;
    }

    // Risk Assessment Findings
    doc.setFillColor(254, 243, 199);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('RISK ASSESSMENT FINDINGS', 15, yPosition + 5);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(details.score, 15, yPosition);
    doc.text(`Risk Level: ${details.riskLevel}`, 70, yPosition);
    yPosition += 10;

    // Assessment Details based on type
    doc.setFont('helvetica', 'normal');
    if (assessmentType === 'dvt') {
      const risk_factors = riskAssessmentData.dvt;
      const activeFactors = [];
      
      // List active risk factors
      if (risk_factors.age_41_60 || risk_factors.age_61_74 || risk_factors.age_over_75) {
        activeFactors.push('Advanced age');
      }
      if (risk_factors.malignancy) activeFactors.push('Active malignancy');
      if (risk_factors.personal_history_vte) activeFactors.push('Previous VTE');
      if (risk_factors.family_history_vte) activeFactors.push('Family history of VTE');
      if (risk_factors.major_surgery_45min) activeFactors.push('Major surgery');
      if (risk_factors.patient_confined_bed) activeFactors.push('Bed confinement');
      if (risk_factors.pregnancy_postpartum) activeFactors.push('Pregnancy/postpartum');
      
      if (activeFactors.length > 0) {
        doc.text('Identified Risk Factors:', 15, yPosition);
        yPosition += 6;
        activeFactors.forEach(factor => {
          doc.text(`• ${factor}`, 20, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      }
    }

    // Check for page break
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    // Clinical Recommendations
    doc.setFillColor(220, 252, 231);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('CLINICAL RECOMMENDATIONS & REASON FOR REFERRAL', 15, yPosition + 5);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (recommendations.recommendations && recommendations.recommendations.length > 0) {
      recommendations.recommendations.slice(0, 10).forEach((rec: string) => {
        if (yPosition > pageHeight - 40) {
          doc.addPage();
          yPosition = 20;
        }
        
        const recLines = doc.splitTextToSize(`• ${rec}`, pageWidth - 35);
        recLines.forEach((line: string) => {
          doc.text(line, 15, yPosition);
          yPosition += 5;
        });
        yPosition += 2;
      });
    }
    yPosition += 5;

    // Specific consultation request
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('SPECIFIC CONSULTATION REQUEST:', 15, yPosition);
    yPosition += 7;

    doc.setFont('helvetica', 'normal');
    const requestTexts = {
      dvt: [
        'Please assess the patient for appropriate VTE prophylaxis regimen',
        'Advise on pharmacological anticoagulation if indicated',
        'Consider risk-benefit of anticoagulation given patient\'s condition',
        'Provide guidance on duration of prophylaxis',
        'Recommend monitoring parameters for anticoagulation'
      ],
      pressureSore: [
        'Please assess patient\'s pressure injury risk and existing wounds (if any)',
        'Recommend specialized support surfaces and repositioning protocols',
        'Advise on advanced wound care strategies',
        'Consider need for surgical debridement or flap coverage',
        'Provide guidance on nutritional optimization for wound healing'
      ],
      nutritional: [
        'Please provide comprehensive nutritional assessment',
        'Recommend appropriate nutritional support regimen',
        'Advise on enteral/parenteral nutrition if indicated',
        'Provide specific meal plan and supplementation',
        'Monitor nutritional parameters and adjust accordingly'
      ]
    };

    requestTexts[assessmentType].forEach(req => {
      if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = 20;
      }
      const lines = doc.splitTextToSize(`• ${req}`, pageWidth - 30);
      lines.forEach((line: string) => {
        doc.text(line, 15, yPosition);
        yPosition += 5;
      });
    });
    yPosition += 10;

    // Closing
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    const closingText = doc.splitTextToSize(
      'Your expert opinion and management recommendations would be greatly appreciated. ' +
      'Please feel free to contact me should you require any additional information.',
      pageWidth - 30
    );
    closingText.forEach((line: string) => {
      doc.text(line, 15, yPosition);
      yPosition += 5;
    });
    yPosition += 10;

    doc.text('Yours sincerely,', 15, yPosition);
    yPosition += 15;

    doc.setFont('helvetica', 'bold');
    doc.text('_______________________________', 15, yPosition);
    yPosition += 6;
    doc.text('Dr. ___________________________', 15, yPosition);
    yPosition += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('Plastic Surgery Registrar', 15, yPosition);
    yPosition += 5;
    doc.text('Department of Plastic & Reconstructive Surgery', 15, yPosition);
    yPosition += 5;
    doc.text('University of Nigeria Teaching Hospital', 15, yPosition);

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const footerY = pageHeight - 10;
    doc.text(`Generated: ${new Date().toLocaleString('en-NG')} | PLASTIC AND RECONSTRUCTIVE SURGERY UNIT PWA`, pageWidth / 2, footerY, { align: 'center' });

    // Save PDF
    const fileName = `UNTH_Consultation_${assessmentType.toUpperCase()}_${(formData as any).surname || 'Patient'}_${formData.hospital_number || new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  // Generate Patient Education Material PDF
  const generatePatientEducationPDF = (assessmentType: 'dvt' | 'pressureSore' | 'nutritional') => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;

    // Education content based on assessment type
    const educationContent = {
      dvt: {
        title: 'Understanding Blood Clot Prevention',
        subtitle: 'Deep Vein Thrombosis (DVT) & Pulmonary Embolism (PE)',
        icon: '🩸',
        sections: [
          {
            heading: 'What is DVT?',
            content: [
              'Deep Vein Thrombosis (DVT) is a blood clot that forms in a deep vein, usually in the legs.',
              'Blood clots can be dangerous because they can break loose, travel through the bloodstream, and block blood flow to the lungs (Pulmonary Embolism or PE).',
              'DVT and PE together are called Venous Thromboembolism (VTE).'
            ]
          },
          {
            heading: 'Warning Signs - When to Seek Help IMMEDIATELY',
            content: [
              '⚠️ Leg Symptoms: Swelling, pain, tenderness, warmth, or redness in one leg',
              '🚨 Chest Symptoms: Sudden shortness of breath, chest pain (worse with breathing), rapid heartbeat',
              '🆘 If you experience ANY of these symptoms, inform your nurse or doctor IMMEDIATELY'
            ],
            urgent: true
          },
          {
            heading: 'How to Prevent Blood Clots',
            content: [
              '🚶 Movement: Move your legs and ankles frequently, even while in bed',
              '💧 Hydration: Drink plenty of water (unless your doctor restricts fluids)',
              '💊 Medications: Take any prescribed blood-thinning medications exactly as instructed',
              '🧦 Compression Stockings: Wear compression stockings if prescribed',
              '📋 Follow Instructions: Follow all positioning and activity instructions from your medical team'
            ]
          },
          {
            heading: 'Exercises You Can Do in Bed',
            content: [
              '1. Ankle Pumps: Move your foot up and down (like pressing a gas pedal) 10 times every hour',
              '2. Ankle Circles: Rotate your ankles in circles, 5 times in each direction',
              '3. Knee Bends: Bend and straighten your knee 10 times (if allowed)',
              '4. Leg Raises: Lift your leg a few inches off the bed, hold for 5 seconds (if allowed)',
              'Do these exercises EVERY HOUR while awake unless your doctor says otherwise'
            ]
          },
          {
            heading: 'Important Reminders',
            content: [
              '✓ Do not massage your legs if you have swelling or pain',
              '✓ Avoid crossing your legs when sitting',
              '✓ Get out of bed and walk as soon as your doctor allows',
              '✓ Report any unusual bleeding or bruising to your doctor',
              '✓ Keep all follow-up appointments'
            ]
          }
        ]
      },
      pressureSore: {
        title: 'Preventing Pressure Sores (Bed Sores)',
        subtitle: 'Keeping Your Skin Healthy',
        icon: '🛏️',
        sections: [
          {
            heading: 'What are Pressure Sores?',
            content: [
              'Pressure sores (also called bed sores or pressure ulcers) are injuries to the skin and tissue caused by prolonged pressure on the skin.',
              'They usually develop on bony areas of the body like the tailbone, hips, heels, and elbows.',
              'Prevention is much easier than treatment, so it\'s very important to follow these guidelines.'
            ]
          },
          {
            heading: 'Warning Signs - Check Your Skin Daily',
            content: [
              '⚠️ Red areas that don\'t fade when you press on them',
              '⚠️ Skin that feels warmer or cooler than surrounding areas',
              '⚠️ Swelling or firmness in an area',
              '⚠️ Painful or tender spots',
              '⚠️ Blisters or breaks in the skin',
              '🆘 Report ANY of these signs to your nurse IMMEDIATELY'
            ],
            urgent: true
          },
          {
            heading: 'How to Prevent Pressure Sores',
            content: [
              '🔄 Change Position: Turn or shift your weight every 2 hours (your nurses will help)',
              '🛏️ Use Pillows: Place pillows between bony areas (knees, ankles) when lying on your side',
              '👀 Check Skin: Inspect your skin (or ask family to help) twice daily',
              '💧 Keep Skin Clean & Dry: Clean gently after using the toilet and when sweating',
              '🧴 Moisturize: Apply lotion to dry skin (but not between toes or in skin folds)',
              '🍽️ Eat Well: Good nutrition helps keep skin healthy (eat the meals provided)',
              '💧 Drink Water: Stay hydrated (6-8 glasses per day unless restricted)'
            ]
          },
          {
            heading: 'Areas at Highest Risk',
            content: [
              '• Back of head (when lying on back)',
              '• Shoulder blades',
              '• Elbows',
              '• Lower back and tailbone (most common)',
              '• Hips (when lying on side)',
              '• Heels and ankles (very important - keep heels off the bed)',
              '• Buttocks (when sitting)'
            ]
          },
          {
            heading: 'Proper Positioning',
            content: [
              '🛏️ In Bed: Lie at a 30-degree angle when on your side (not flat on your side)',
              '🪑 In Chair: Shift your weight every 15 minutes by leaning or lifting yourself slightly',
              '⏰ Limit sitting time to 1-2 hours at a time',
              '🦶 Keep heels elevated off the bed using pillows under your calves',
              '📐 Keep head of bed at 30 degrees or less to reduce sliding'
            ]
          },
          {
            heading: 'Skin Care Tips',
            content: [
              '✓ Use mild, pH-balanced soap',
              '✓ Pat skin dry - don\'t rub',
              '✓ Apply barrier cream if you have incontinence',
              '✓ Keep bed sheets smooth and wrinkle-free',
              '✓ Avoid donut-shaped cushions (they reduce blood flow)',
              '✓ Wear soft, breathable clothing',
              '✓ Don\'t massage red or damaged areas'
            ]
          },
          {
            heading: 'Nutrition for Healthy Skin',
            content: [
              '🥩 Protein: Eat meat, fish, eggs, beans (helps heal skin)',
              '🥕 Vitamin C: Eat fruits and vegetables (oranges, tomatoes, peppers)',
              '🥛 Zinc: Found in meat, dairy, nuts',
              '💧 Water: Drink plenty of fluids',
              '🍽️ Don\'t skip meals - your body needs nutrition to keep skin healthy'
            ]
          }
        ]
      },
      nutritional: {
        title: 'Eating Well for Healing & Health',
        subtitle: 'Nutrition Guide for Recovery',
        icon: '🍽️',
        sections: [
          {
            heading: 'Why Good Nutrition Matters',
            content: [
              'Good nutrition is essential for healing, fighting infection, and maintaining strength.',
              'When you don\'t eat enough, your body can\'t heal properly, wounds take longer to close, and you feel weaker.',
              'Eating well is as important as taking your medications!'
            ]
          },
          {
            heading: 'Warning Signs of Poor Nutrition',
            content: [
              '⚠️ Unintentional weight loss',
              '⚠️ Feeling weak or tired all the time',
              '⚠️ Wounds that don\'t heal',
              '⚠️ Frequent infections',
              '⚠️ Loss of appetite',
              '🆘 Tell your nurse if you experience any of these'
            ],
            urgent: true
          },
          {
            heading: 'What to Eat for Healing',
            content: [
              '🥩 PROTEIN (Most Important): Meat, fish, chicken, eggs, beans, milk',
              '  → Helps heal wounds and build strength',
              '  → Try to include protein in every meal',
              '',
              '🍚 CARBOHYDRATES: Rice, yam, bread, garri, potatoes',
              '  → Gives you energy',
              '',
              '🥕 VEGETABLES & FRUITS: Dark leafy greens, oranges, carrots, tomatoes',
              '  → Provides vitamins for healing',
              '',
              '🥛 DAIRY: Milk, yogurt, cheese',
              '  → Provides protein and calcium',
              '',
              '💧 WATER: 6-8 glasses per day',
              '  → Keeps body hydrated for healing'
            ]
          },
          {
            heading: 'Sample Nigerian Meal Plan',
            content: [
              '🌅 BREAKFAST:',
              '• Akamu (pap) with milk and egg',
              '• Bread with egg and tea',
              '• Oatmeal with milk and banana',
              '',
              '🌞 LUNCH:',
              '• Rice and beans with fish and vegetable soup',
              '• Pounded yam with egusi soup and meat',
              '• Jollof rice with chicken and salad',
              '',
              '🌙 DINNER:',
              '• Eba with okra soup and fish',
              '• Boiled yam with vegetable sauce and eggs',
              '• Rice with stew and chicken',
              '',
              '🍎 SNACKS:',
              '• Fruits (banana, orange, apple)',
              '• Groundnuts, Yogurt, Milk'
            ]
          },
          {
            heading: 'Tips to Eat More When You Don\'t Feel Hungry',
            content: [
              '✓ Eat small amounts frequently (5-6 times per day)',
              '✓ Eat your favorite foods',
              '✓ Add extra protein powder to porridge or drinks if available',
              '✓ Drink high-protein beverages (milk, soya milk)',
              '✓ Eat when you feel best (usually in the morning)',
              '✓ Take small sips of water throughout the day',
              '✓ Ask family to bring small portions of home-cooked meals',
              '✓ Don\'t force yourself to eat large portions - small amounts are okay'
            ]
          },
          {
            heading: 'Special Dietary Instructions',
            content: [
              '⚠️ DIABETES: Choose whole grains, limit sugar, eat regular meals',
              '⚠️ HIGH BLOOD PRESSURE: Reduce salt, avoid processed foods',
              '⚠️ KIDNEY PROBLEMS: Your doctor may limit protein and certain foods',
              '⚠️ LIVER PROBLEMS: Eat small frequent meals, adequate protein',
              '',
              '❗ Always follow specific dietary instructions from your doctor or dietitian'
            ]
          },
          {
            heading: 'Food Safety',
            content: [
              '✓ Eat freshly cooked foods',
              '✓ Wash fruits and vegetables',
              '✓ Avoid street food during hospitalization',
              '✓ Ensure meat is well-cooked',
              '✓ Drink clean, safe water',
              '✓ Wash hands before eating'
            ]
          }
        ]
      }
    };

    const content = educationContent[assessmentType];

    // Header - UNTH Branding
    doc.setFillColor(14, 159, 110); // Green
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(10);
    doc.text('Department of Plastic & Reconstructive Surgery', pageWidth / 2, 19, { align: 'center' });
    doc.setFontSize(14);
    doc.text('PATIENT EDUCATION', pageWidth / 2, 28, { align: 'center' });
    doc.setFontSize(12);
    doc.text(`${content.icon} ${content.title}`, pageWidth / 2, 36, { align: 'center' });

    yPosition = 50;
    doc.setTextColor(0, 0, 0);

    // Patient Name
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`For: ${(formData as any).surname || ''} ${(formData as any).other_names || ''}`, 15, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`Hospital Number: ${formData.hospital_number || 'N/A'}`, 15, yPosition + 5);
    doc.text(`Date: ${new Date().toLocaleDateString('en-NG')}`, 15, yPosition + 10);
    yPosition += 20;

    // Introduction Box
    doc.setFillColor(254, 243, 199);
    doc.rect(10, yPosition, pageWidth - 20, 15, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    const intro = doc.splitTextToSize(
      'This guide has been prepared specifically for you by your medical team. Please read it carefully ' +
      'and ask your nurse or doctor if you have any questions. Your family members are encouraged to read this as well.',
      pageWidth - 30
    );
    let introY = yPosition + 5;
    intro.forEach((line: string) => {
      doc.text(line, 15, introY);
      introY += 5;
    });
    yPosition = introY + 5;

    // Content Sections
    content.sections.forEach((section, index) => {
      // Check for page break
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Section Heading
      if (section.urgent) {
        doc.setFillColor(220, 38, 38); // Red for urgent sections
        doc.rect(10, yPosition, pageWidth - 20, 10, 'F');
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setFillColor(14, 159, 110); // Green
        doc.rect(10, yPosition, pageWidth - 20, 10, 'F');
        doc.setTextColor(255, 255, 255);
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(section.heading, 15, yPosition + 7);
      yPosition += 14;
      doc.setTextColor(0, 0, 0);

      // Section Content
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      section.content.forEach(paragraph => {
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }

        if (paragraph === '') {
          yPosition += 3;
        } else {
          const lines = doc.splitTextToSize(paragraph, pageWidth - 30);
          lines.forEach((line: string) => {
            doc.text(line, 15, yPosition);
            yPosition += 5;
          });
          yPosition += 2;
        }
      });
      
      yPosition += 5;
    });

    // Final Important Message Box
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(254, 226, 226); // Light red
    doc.rect(10, yPosition, pageWidth - 20, 30, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📞 IMPORTANT CONTACT INFORMATION', 15, yPosition + 7);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('If you have ANY concerns or questions:', 15, yPosition + 14);
    doc.text('• Press your call button for the nurse', 15, yPosition + 19);
    doc.text('• Call the ward nurse station', 15, yPosition + 24);
    doc.text('• Ask to speak with your doctor', 15, yPosition + 29);
    yPosition += 35;

    // Footer
    doc.setFillColor(14, 159, 110);
    doc.rect(0, pageHeight - 25, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('This information is provided for educational purposes. Always follow your doctor\'s specific instructions.', pageWidth / 2, pageHeight - 17, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString('en-NG')} | PLASTIC AND RECONSTRUCTIVE SURGERY UNIT PWA`, pageWidth / 2, pageHeight - 11, { align: 'center' });
    doc.text('Please keep this document for your reference throughout your hospital stay.', pageWidth / 2, pageHeight - 6, { align: 'center' });

    // Save PDF
    const fileName = `UNTH_PatientEducation_${assessmentType.toUpperCase()}_${(formData as any).surname || 'Patient'}_${formData.hospital_number || new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  // Generate Comprehensive Care Plan PDF (for Pressure Sore Risk Assessment)
  const generateCarePlanPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 0;

    const recommendations = aiRecommendations.pressureSore;

    // Header - UNTH Branding
    doc.setFillColor(14, 159, 110); // Green
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('ITUKU-OZALLA, ENUGU', pageWidth / 2, 22, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Department of Plastic & Reconstructive Surgery', pageWidth / 2, 29, { align: 'center' });
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPREHENSIVE CARE PLAN', pageWidth / 2, 38, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Pressure Injury Prevention & Management', pageWidth / 2, 45, { align: 'center' });

    yPosition = 60;
    doc.setTextColor(0, 0, 0);

    // Risk Level Banner
    const riskColors = {
      low: [34, 197, 94],       // Green
      moderate: [234, 179, 8],  // Yellow
      high: [249, 115, 22],     // Orange
      very_high: [220, 38, 38]  // Red
    };
    const color = riskColors[recommendations.riskLevel as keyof typeof riskColors] || [107, 114, 128];
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(10, yPosition, pageWidth - 20, 12, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const riskText = recommendations.riskLevel === 'very_high' ? 'CRITICAL RISK' :
                     recommendations.riskLevel === 'high' ? 'HIGH RISK' :
                     recommendations.riskLevel === 'moderate' ? 'MODERATE RISK' : 'LOW RISK';
    doc.text(`${riskText} - Braden Scale Score: ${recommendations.score}/23`, pageWidth / 2, yPosition + 8, { align: 'center' });
    yPosition += 18;
    doc.setTextColor(0, 0, 0);

    // Patient Information Section
    doc.setFillColor(243, 244, 246); // Light gray
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION', 15, yPosition + 6);
    yPosition += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const patientInfo = [
      `Name: ${(formData as any).surname || ''} ${(formData as any).other_names || ''}`,
      `Hospital Number: ${formData.hospital_number || 'N/A'}`,
      `Age: ${formData.date_of_birth ? Math.floor((new Date().getTime() - new Date(formData.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : 'N/A'} years`,
      `Gender: ${formData.sex || 'N/A'}`,
      `Ward: ${(formData as any).ward || 'N/A'}`
    ];
    patientInfo.forEach(info => {
      doc.text(info, 15, yPosition);
      yPosition += 5;
    });
    yPosition += 5;

    // Clinical Information
    if ((formData as any).primary_diagnosis || (formData as any).comorbidities) {
      doc.setFillColor(243, 244, 246);
      doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CLINICAL INFORMATION', 15, yPosition + 6);
      yPosition += 12;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      if ((formData as any).primary_diagnosis) {
        doc.text(`Diagnosis: ${(formData as any).primary_diagnosis}`, 15, yPosition);
        yPosition += 5;
      }
      if ((formData as any).comorbidities && (formData as any).comorbidities.length > 0) {
        doc.text(`Comorbidities: ${(formData as any).comorbidities.join(', ')}`, 15, yPosition);
        yPosition += 5;
      }
      yPosition += 5;
    }

    // Care Plan Date and Validity
    doc.setFillColor(254, 249, 195); // Light yellow
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Care Plan Generated: ${new Date().toLocaleDateString('en-NG')} | Valid for: 7 Days | Review: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-NG')}`, pageWidth / 2, yPosition + 6, { align: 'center' });
    yPosition += 15;

    // Assessment Details
    doc.setFillColor(14, 159, 110);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESSURE INJURY RISK ASSESSMENT (BRADEN SCALE)', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const bradenSubscores = [
      `Sensory Perception: ${riskAssessmentData.pressureSore.sensory_perception}/4`,
      `Moisture: ${riskAssessmentData.pressureSore.moisture}/4`,
      `Activity: ${riskAssessmentData.pressureSore.activity}/4`,
      `Mobility: ${riskAssessmentData.pressureSore.mobility}/4`,
      `Nutrition: ${riskAssessmentData.pressureSore.nutrition}/4`,
      `Friction & Shear: ${riskAssessmentData.pressureSore.friction_shear}/3`
    ];
    
    bradenSubscores.forEach(subscore => {
      doc.text(`• ${subscore}`, 15, yPosition);
      yPosition += 5;
    });
    
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Score: ${recommendations.score}/23 (${riskText})`, 15, yPosition);
    yPosition += 8;

    // Clinical Recommendations Section
    doc.setFillColor(14, 159, 110);
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('🤖 CLINICAL RECOMMENDATIONS (AI-GENERATED)', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    // Clinical recommendations content
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    (recommendations as any).clinical.forEach((rec: string) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = 20;
      }

      if (rec === '') {
        yPosition += 3;
      } else {
        const lines = doc.splitTextToSize(rec, pageWidth - 30);
        lines.forEach((line: string) => {
          if (yPosition > pageHeight - 20) {
            doc.addPage();
            yPosition = 20;
          }
          doc.text(line, 15, yPosition);
          yPosition += 4.5;
        });
        yPosition += 1;
      }
    });
    yPosition += 5;

    // Interventions Section
    if (yPosition > pageHeight - 40) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(220, 38, 38); // Red for critical interventions
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('⚡ REQUIRED INTERVENTIONS', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    recommendations.interventions.forEach((intervention: string, index: number) => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }

      const lines = doc.splitTextToSize(`${index + 1}. ${intervention}`, pageWidth - 30);
      lines.forEach((line: string) => {
        doc.text(line, 15, yPosition);
        yPosition += 4.5;
      });
      yPosition += 2;
    });
    yPosition += 8;

    // Monitoring & Documentation Section
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(59, 130, 246); // Blue
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('📊 MONITORING & DOCUMENTATION REQUIREMENTS', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    const monitoringRequirements = {
      low: [
        '• Complete daily skin inspection checklist',
        '• Document skin condition at each shift change',
        '• Record repositioning on turning chart (4-hourly)',
        '• Weekly weight monitoring',
        '• Reassess Braden Scale weekly or if condition changes'
      ],
      moderate: [
        '• Inspect skin at EVERY repositioning (minimum 3x per shift)',
        '• Complete turning chart at every 2-4 hour repositioning',
        '• Document skin condition with each assessment',
        '• Photograph any suspicious areas for comparison',
        '• Record nutritional intake daily',
        '• Monitor weekly weight and albumin levels',
        '• Reassess Braden Scale every 3-5 days or if condition changes'
      ],
      high: [
        '• Full skin inspection at EVERY 2-hour repositioning',
        '• Mandatory turning chart completion (signed, timed)',
        '• Document skin assessment findings at each turn',
        '• Daily photograph of high-risk areas',
        '• Weekly Braden Scale reassessment',
        '• Daily nutritional intake documentation',
        '• Maintain pressure injury prevention flowsheet',
        '• Track all clinical interventions and patient response'
      ],
      very_high: [
        '• Full head-to-toe skin inspection EVERY hourly-to-2-hourly repositioning',
        '• Turning chart completed EVERY repositioning (time, position, signature)',
        '• Skin assessment documented at EVERY turn',
        '• Daily photograph of high-risk areas and existing wounds',
        '• Weekly wound measurements and PUSH/Bates-Jensen scores',
        '• Daily nutritional intake with calorie count',
        '• Braden Scale every 24-48 hours',
        '• Maintain electronic/paper pressure injury prevention flowsheet',
        '• Document ALL interventions, patient response, and escalations',
        '• Track interdisciplinary team consultations and recommendations'
      ]
    };

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const monitoring = monitoringRequirements[recommendations.riskLevel as keyof typeof monitoringRequirements] || monitoringRequirements.low;
    monitoring.forEach(item => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      const lines = doc.splitTextToSize(item, pageWidth - 30);
      lines.forEach((line: string) => {
        doc.text(line, 15, yPosition);
        yPosition += 4.5;
      });
      yPosition += 2;
    });
    yPosition += 8;

    // Interdisciplinary Team Involvement
    if (recommendations.riskLevel === 'high' || recommendations.riskLevel === 'very_high') {
      if (yPosition > pageHeight - 50) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFillColor(147, 51, 234); // Purple
      doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('👥 INTERDISCIPLINARY TEAM CONSULTATIONS', 15, yPosition + 6);
      yPosition += 12;
      doc.setTextColor(0, 0, 0);

      const teamRequirements = recommendations.riskLevel === 'very_high' ? [
        '✓ Daily wound care nurse specialist rounds',
        '✓ Plastic surgery/wound team consultation within 24 hours',
        '✓ Emergency dietitian consultation within 12 hours',
        '✓ Weekly interdisciplinary team meeting (nursing, MD, PT, OT, dietitian, wound specialist)',
        '✓ Physical therapy: Mobility assessment, positioning equipment recommendations',
        '✓ Occupational therapy: Specialized positioning devices, adaptive equipment',
        '✓ Social work: Equipment acquisition, discharge planning',
        '✓ Consider palliative care consultation if goals of care discussions needed'
      ] : [
        '✓ Daily wound care nurse consultation',
        '✓ Urgent dietitian consultation within 24 hours',
        '✓ Weekly review by plastic surgery/wound team',
        '✓ Physical therapy for mobility assessment',
        '✓ Occupational therapy for positioning equipment'
      ];

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      teamRequirements.forEach(item => {
        if (yPosition > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
        }
        const lines = doc.splitTextToSize(item, pageWidth - 30);
        lines.forEach((line: string) => {
          doc.text(line, 15, yPosition);
          yPosition += 4.5;
        });
        yPosition += 2;
      });
      yPosition += 8;
    }

    // Escalation Criteria
    if (yPosition > pageHeight - 50) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(220, 38, 38); // Red
    doc.rect(10, yPosition, pageWidth - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('⚠️ ESCALATION CRITERIA - NOTIFY IMMEDIATELY', 15, yPosition + 6);
    yPosition += 12;
    doc.setTextColor(0, 0, 0);

    const escalationCriteria = [
      '🔴 ANY new non-blanchable erythema → Immediate notification to wound team',
      '🔴 ANY new skin breakdown → Photograph, measure, escalate to MD/wound team',
      '🔴 Worsening of existing wounds → Urgent surgical consultation',
      '🔴 Patient declining repositioning → Pain management assessment, goals of care discussion',
      '🔴 Signs of infection → Fever, increased pain, purulent drainage, foul odor',
      '🔴 Deep tissue injury → Purple/maroon discoloration, painful area',
      '🔴 Medical device-related pressure injury → Remove/reposition device immediately'
    ];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    escalationCriteria.forEach(criterion => {
      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = 20;
      }
      const lines = doc.splitTextToSize(criterion, pageWidth - 30);
      lines.forEach((line: string) => {
        doc.text(line, 15, yPosition);
        yPosition += 4.5;
      });
      yPosition += 2;
    });
    yPosition += 8;

    // Signature Section
    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFillColor(243, 244, 246);
    doc.rect(10, yPosition, pageWidth - 20, 35, 'F');
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CARE PLAN ACKNOWLEDGEMENT', 15, yPosition + 7);
    yPosition += 12;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('This care plan has been reviewed and will be implemented by the clinical team.', 15, yPosition);
    yPosition += 8;

    doc.text('Primary Nurse Signature: _________________________  Date: __________', 15, yPosition);
    yPosition += 6;
    doc.text('Attending Physician Signature: ____________________  Date: __________', 15, yPosition);
    yPosition += 10;

    // Footer
    doc.setFillColor(14, 159, 110);
    doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString('en-NG')} | PLASTIC AND RECONSTRUCTIVE SURGERY UNIT PWA`, pageWidth / 2, pageHeight - 9, { align: 'center' });
    doc.text('This is a clinical document - Handle according to hospital confidentiality policies', pageWidth / 2, pageHeight - 4, { align: 'center' });

    // Save PDF
    const fileName = `UNTH_CarePlan_PressureSore_${(formData as any).surname || 'Patient'}_${formData.hospital_number || new Date().getTime()}.pdf`;
    doc.save(fileName);
  };

  // Auto-calculate BMI when height or weight changes
  React.useEffect(() => {
    const { height, weight } = riskAssessmentData.nutritional;
    if (height > 0 && weight > 0) {
      const bmi = calculateBMI(height, weight);
      const bmiScore = getBMIScore(bmi);
      
      setRiskAssessmentData(prev => ({
        ...prev,
        nutritional: {
          ...prev.nutritional,
          bmi,
          bmi_score: bmiScore
        }
      }));
      
      // Generate nutritional recommendations when BMI changes
      const { score, riskLevel } = calculateMUSTScore(
        bmiScore,
        riskAssessmentData.nutritional.weight_loss_percentage,
        riskAssessmentData.nutritional.acute_disease_effect
      );
      generateAIRecommendations('nutritional', score, riskLevel);
    }
  }, [riskAssessmentData.nutritional.height, riskAssessmentData.nutritional.weight, riskAssessmentData.nutritional.weight_loss_percentage, riskAssessmentData.nutritional.acute_disease_effect]);

  // Generate DVT recommendations when risk factors change
  React.useEffect(() => {
    const { score, riskLevel } = calculateDVTScore(riskAssessmentData.dvt);
    generateAIRecommendations('dvt', score, riskLevel);
  }, [riskAssessmentData.dvt]);

  // Generate pressure sore recommendations when Braden subscores change
  React.useEffect(() => {
    const { score, riskLevel } = calculateBradenScore(riskAssessmentData.pressureSore);
    generateAIRecommendations('pressureSore', score, riskLevel);
  }, [riskAssessmentData.pressureSore]);

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...((prev as any)[parent] || {}),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleArrayAdd = (field: string, value: string) => {
    if (value.trim()) {
      setFormData(prev => ({
        ...prev,
        [field]: [...((prev as any)[field] || []), value.trim()]
      }));
    }
  };

  const handleArrayRemove = (field: string, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: ((prev as any)[field] || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Add clinical information to the form data
      const updatedFormData = {
        ...formData,
        primary_diagnosis: riskAssessmentData.clinical.primary_diagnosis,
        secondary_diagnoses: riskAssessmentData.clinical.secondary_diagnoses,
        comorbidities: riskAssessmentData.clinical.comorbidities,
        current_medications: riskAssessmentData.clinical.current_medications,
        allergies: riskAssessmentData.clinical.allergies
      };

      // Register the patient first
      const patientId = await unthPatientService.registerPatient(updatedFormData as PatientRegistration);
      
      // Save risk assessments with AI recommendations
      if (patientId) {
        // Calculate and save DVT risk assessment
        const { score: dvtScore, riskLevel: dvtRiskLevel } = calculateDVTScore(riskAssessmentData.dvt);

        const dvtAssessment = {
          id: riskAssessmentService.generateAssessmentId(),
          patient_id: patientId,
          assessment_type: 'dvt' as const,
          assessment_date: new Date(),
          assessed_by: 'Registration System',
          score: dvtScore,
          risk_level: dvtRiskLevel,
          risk_factors: riskAssessmentData.dvt,
          clinical_signs: {
            localized_tenderness: false,
            swelling: riskAssessmentData.dvt.swollen_legs || false,
            calf_difference: false,
            pitting_edema: false,
            collateral_veins: false,
            warmth: false,
            erythema: false
          },
          prevention_measures: {
            mechanical_prophylaxis: dvtRiskLevel === 'moderate' || dvtRiskLevel === 'high' || dvtRiskLevel === 'very_high',
            pharmacological_prophylaxis: dvtRiskLevel === 'high' || dvtRiskLevel === 'very_high',
            early_mobilization: true,
            hydration: true,
            compression_stockings: dvtRiskLevel === 'moderate' || dvtRiskLevel === 'high' || dvtRiskLevel === 'very_high',
            sequential_compression_device: dvtRiskLevel === 'high' || dvtRiskLevel === 'very_high'
          },
          ai_recommendations: aiRecommendations.dvt.recommendations,
          action_plan: aiRecommendations.dvt.interventions.map(intervention => ({
            id: Math.random().toString(36).substr(2, 9),
            description: intervention,
            priority: 'medium' as const,
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            assigned_to: 'Registration System',
            status: 'pending' as const,
            created_at: new Date()
          })),
          status: 'active' as const,
          created_at: new Date(),
          updated_at: new Date()
        };

        await riskAssessmentService.saveDVTAssessment(dvtAssessment);

        // Calculate and save Pressure Sore risk assessment
        const { score: bradenScore, riskLevel: pressureRiskLevel } = calculateBradenScore(riskAssessmentData.pressureSore);

        const pressureAssessment = {
          id: riskAssessmentService.generateAssessmentId(),
          patient_id: patientId,
          assessment_type: 'pressure_sore' as const,
          assessment_date: new Date(),
          assessed_by: 'Registration System',
          score: bradenScore,
          risk_level: pressureRiskLevel,
          braden_subscores: riskAssessmentData.pressureSore,
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
          },
          ai_recommendations: aiRecommendations.pressureSore.recommendations,
          action_plan: aiRecommendations.pressureSore.interventions.map(intervention => ({
            id: Math.random().toString(36).substr(2, 9),
            description: intervention,
            priority: 'medium' as const,
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            assigned_to: 'Registration System',
            status: 'pending' as const,
            created_at: new Date()
          })),
          status: 'active' as const,
          created_at: new Date(),
          updated_at: new Date()
        };

        await riskAssessmentService.savePressureSoreAssessment(pressureAssessment);

        // Calculate and save Nutritional risk assessment
        const bmiScore = getBMIScore(riskAssessmentData.nutritional.bmi);
        const { score: mustScore, riskLevel: nutritionalRiskLevel } = calculateMUSTScore(
          bmiScore,
          riskAssessmentData.nutritional.weight_loss_percentage,
          riskAssessmentData.nutritional.acute_disease_effect
        );

        const nutritionalAssessment = {
          id: riskAssessmentService.generateAssessmentId(),
          patient_id: patientId,
          assessment_type: 'nutritional' as const,
          assessment_date: new Date(),
          assessed_by: 'Registration System',
          score: mustScore,
          risk_level: nutritionalRiskLevel,
          must_components: {
            bmi_score: bmiScore,
            weight_loss_score: riskAssessmentData.nutritional.weight_loss_percentage >= 10 ? 2 : 
                               riskAssessmentData.nutritional.weight_loss_percentage >= 5 ? 1 : 0,
            acute_disease_score: riskAssessmentData.nutritional.acute_disease_effect ? 2 : 0
          },
          height: riskAssessmentData.nutritional.height,
          weight: riskAssessmentData.nutritional.weight,
          bmi: riskAssessmentData.nutritional.bmi,
          weight_loss_percentage: riskAssessmentData.nutritional.weight_loss_percentage,
          acute_disease_effect: riskAssessmentData.nutritional.acute_disease_effect,
          dietary_intake: {
            appetite_change: riskAssessmentData.nutritional.appetite_change || '',
            eating_difficulties: false,
            recent_diet_change: false,
            dietary_restrictions: []
          },
          ai_recommendations: aiRecommendations.nutritional.recommendations,
          action_plan: aiRecommendations.nutritional.interventions.map(intervention => ({
            id: Math.random().toString(36).substr(2, 9),
            description: intervention,
            priority: 'medium' as const,
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
            assigned_to: 'Registration System',
            status: 'pending' as const,
            created_at: new Date()
          })),
          meal_plan: aiRecommendations.nutritional.mealPlan.generated ? aiRecommendations.nutritional.mealPlan.days : [],
          status: 'active' as const,
          created_at: new Date(),
          updated_at: new Date()
        };

        await riskAssessmentService.saveNutritionalAssessment(nutritionalAssessment);
      }

      onSuccess?.(patientId);
    } catch (error) {
      console.error('Registration failed:', error);
      alert('Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Hospital Number (auto-generated if empty)
          </label>
          <input
            type="text"
            value={formData.hospital_number || ''}
            onChange={(e) => handleInputChange('hospital_number', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="UNTH/2024/0001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            required
            value={formData.first_name || ''}
            onChange={(e) => handleInputChange('first_name', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            required
            value={formData.last_name || ''}
            onChange={(e) => handleInputChange('last_name', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Middle Name
          </label>
          <input
            type="text"
            value={formData.middle_name || ''}
            onChange={(e) => handleInputChange('middle_name', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Middle Name
          </label>
          <input
            type="text"
            value={formData.middle_name || ''}
            onChange={(e) => handleInputChange('middle_name', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth *
          </label>
          <input
            type="date"
            required
            value={formData.date_of_birth || ''}
            onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sex *
          </label>
          <select
            required
            value={formData.sex || 'male'}
            onChange={(e) => handleInputChange('sex', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Marital Status
          </label>
          <select
            value={formData.marital_status || 'single'}
            onChange={(e) => handleInputChange('marital_status', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <input
            type="tel"
            required
            value={formData.phone || ''}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="+234 80X XXX XXXX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => handleInputChange('email', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address *
          </label>
          <textarea
            required
            value={formData.address || ''}
            onChange={(e) => handleInputChange('address', e.target.value)}
            rows={2}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            State of Origin
          </label>
          <input
            type="text"
            value={formData.state_of_origin || ''}
            onChange={(e) => handleInputChange('state_of_origin', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            LGA
          </label>
          <input
            type="text"
            value={formData.lga || ''}
            onChange={(e) => handleInputChange('lga', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Emergency Contact & Medical Info</h3>
      
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Next of Kin</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.next_of_kin?.name || ''}
              onChange={(e) => handleInputChange('next_of_kin.name', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Relationship *
            </label>
            <input
              type="text"
              required
              value={formData.next_of_kin?.relationship || ''}
              onChange={(e) => handleInputChange('next_of_kin.relationship', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Spouse, Parent, Sibling, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone *
            </label>
            <input
              type="tel"
              required
              value={formData.next_of_kin?.phone || ''}
              onChange={(e) => handleInputChange('next_of_kin.phone', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <input
              type="text"
              required
              value={formData.next_of_kin?.address || ''}
              onChange={(e) => handleInputChange('next_of_kin.address', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Blood Group
          </label>
          <select
            value={formData.blood_group || ''}
            onChange={(e) => handleInputChange('blood_group', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">Select Blood Group</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Genotype
          </label>
          <select
            value={formData.genotype || ''}
            onChange={(e) => handleInputChange('genotype', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          >
            <option value="">Select Genotype</option>
            <option value="AA">AA</option>
            <option value="AS">AS</option>
            <option value="SS">SS</option>
            <option value="AC">AC</option>
            <option value="SC">SC</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Medical History & Admission Details</h3>
      
      {/* Medical History Section */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Medical History</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Allergies
            </label>
            <textarea
              value={formData.allergies?.join(', ') || ''}
              onChange={(e) => handleInputChange('allergies', e.target.value.split(',').map(item => item.trim()).filter(item => item))}
              placeholder="List any known allergies"
              rows={2}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Medical History
            </label>
            <textarea
              value={formData.medical_history?.join(', ') || ''}
              onChange={(e) => handleInputChange('medical_history', e.target.value.split(',').map(item => item.trim()).filter(item => item))}
              placeholder="Previous medical conditions"
              rows={2}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Surgical History
            </label>
            <textarea
              value={formData.surgical_history?.join(', ') || ''}
              onChange={(e) => handleInputChange('surgical_history', e.target.value.split(',').map(item => item.trim()).filter(item => item))}
              placeholder="Previous surgeries"
              rows={2}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Drug History
            </label>
            <textarea
              value={formData.drug_history?.join(', ') || ''}
              onChange={(e) => handleInputChange('drug_history', e.target.value.split(',').map(item => item.trim()).filter(item => item))}
              placeholder="Current medications"
              rows={2}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Family History
            </label>
            <textarea
              value={formData.family_history?.join(', ') || ''}
              onChange={(e) => handleInputChange('family_history', e.target.value.split(',').map(item => item.trim()).filter(item => item))}
              placeholder="Family medical history"
              rows={2}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Occupation
            </label>
            <input
              type="text"
              value={formData.social_history?.occupation || ''}
              onChange={(e) => handleInputChange('social_history.occupation', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
      </div>

      {/* Admission Details Section */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Admission Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Patient Type *
            </label>
            <select
              required
              value={formData.patient_type || 'outpatient'}
              onChange={(e) => handleInputChange('patient_type', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="outpatient">Outpatient</option>
              <option value="inpatient">Inpatient</option>
            </select>
          </div>

          {formData.patient_type === 'inpatient' && (
          <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admission Type *
            </label>
            <select
              required
              value={formData.admission_type || 'clinic'}
              onChange={(e) => handleInputChange('admission_type', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="emergency">Emergency</option>
              <option value="clinic">Clinic</option>
              <option value="referral">Referral</option>
              <option value="elective">Elective</option>
            </select>
          </div>

          {formData.admission_type === 'referral' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referring Hospital
              </label>
              <input
                type="text"
                value={formData.referring_hospital || ''}
                onChange={(e) => handleInputChange('referring_hospital', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Consultant in Charge
            </label>
            <select
              required={formData.patient_type === 'inpatient'}
              value={formData.consultant_in_charge || ''}
              onChange={(e) => handleInputChange('consultant_in_charge', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select Consultant</option>
              <option value="Dr Okwesili">Dr Okwesili</option>
              <option value="Dr Nnadi">Dr Nnadi</option>
              <option value="Dr Eze C. B">Dr Eze C. B</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward Assignment
            </label>
            <select
              required={formData.patient_type === 'inpatient'}
              value={formData.ward_id || ''}
              onChange={(e) => handleInputChange('ward_id', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select Ward</option>
              {availableWards.map(ward => (
                <option key={ward.id} value={ward.id}>
                  {ward.name} ({ward.currentOccupancy}/{ward.capacity})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bed Number
            </label>
            <input
              type="text"
              value={formData.bed_number || ''}
              onChange={(e) => handleInputChange('bed_number', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., A12, B05"
            />
          </div>
          </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insurance Type
            </label>
            <select
              value={formData.insurance_type || ''}
              onChange={(e) => handleInputChange('insurance_type', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select Insurance</option>
              <option value="nhis">NHIS</option>
              <option value="private">Private Insurance</option>
              <option value="company">Company Insurance</option>
              <option value="cash">Cash Payment</option>
            </select>
          </div>

          {formData.insurance_type && formData.insurance_type !== 'cash' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Insurance Number
              </label>
              <input
                type="text"
                value={formData.insurance_number || ''}
                onChange={(e) => handleInputChange('insurance_number', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-8">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-lg font-semibold text-gray-900">Risk Assessment & Clinical Information</h3>
        <p className="text-sm text-gray-600 mt-1">Complete all risk assessments and clinical information for comprehensive patient care</p>
      </div>

      {/* Clinical Information Section */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h4 className="text-md font-semibold text-blue-900 mb-4">Clinical Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Primary Diagnosis <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={riskAssessmentData.clinical.primary_diagnosis}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                clinical: { ...prev.clinical, primary_diagnosis: e.target.value }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              placeholder="Enter primary diagnosis"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secondary Diagnoses
            </label>
            <input
              type="text"
              value={riskAssessmentData.clinical.secondary_diagnoses.join(', ')}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                clinical: { 
                  ...prev.clinical, 
                  secondary_diagnoses: e.target.value.split(',').map(d => d.trim()).filter(d => d) 
                }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              placeholder="Enter secondary diagnoses (comma-separated)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Co-morbidities <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {['diabetes', 'hypertension', 'renal_impairment', 'liver_disease', 'heart_disease', 'respiratory_disease'].map(condition => (
                <label key={condition} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={riskAssessmentData.clinical.comorbidities.includes(condition)}
                    onChange={(e) => {
                      const newComorbidities = e.target.checked
                        ? [...riskAssessmentData.clinical.comorbidities, condition]
                        : riskAssessmentData.clinical.comorbidities.filter(c => c !== condition);
                      setRiskAssessmentData(prev => ({
                        ...prev,
                        clinical: { ...prev.clinical, comorbidities: newComorbidities }
                      }));
                    }}
                    className="mr-2 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-sm capitalize">{condition.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Medications
            </label>
            <textarea
              value={riskAssessmentData.clinical.current_medications?.join(', ') || ''}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                clinical: { 
                  ...prev.clinical, 
                  current_medications: e.target.value.split(',').map(m => m.trim()).filter(m => m) 
                }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Enter current medications (comma-separated)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Known Allergies
            </label>
            <input
              type="text"
              value={riskAssessmentData.clinical.allergies.join(', ')}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                clinical: { 
                  ...prev.clinical, 
                  allergies: e.target.value.split(',').map(a => a.trim()).filter(a => a) 
                }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              placeholder="Enter known allergies (comma-separated)"
            />
          </div>
        </div>
      </div>

      {/* DVT Risk Assessment */}
      <div className="bg-red-50 p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold text-red-900">VTE Risk Assessment (Caprini Score)</h4>
          {aiRecommendations.dvt.score !== null && (
            <div className="text-right">
              <span className="text-sm font-medium">Score: {aiRecommendations.dvt.score}</span>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                aiRecommendations.dvt.riskLevel === 'very_high' ? 'bg-red-100 text-red-800' :
                aiRecommendations.dvt.riskLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                aiRecommendations.dvt.riskLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {aiRecommendations.dvt.riskLevel.toUpperCase().replace('_', ' ')} RISK
              </span>
            </div>
          )}
        </div>
        
        {/* 1 Point Risk Factors */}
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-red-800 mb-2">1 Point Risk Factors</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'age_41_60', label: 'Age 41-60 years' },
              { key: 'minor_surgery', label: 'Minor surgery planned' },
              { key: 'bmi_over_25', label: 'BMI >25 kg/m²' },
              { key: 'swollen_legs', label: 'Swollen legs (current)' },
              { key: 'varicose_veins', label: 'Varicose veins' },
              { key: 'pregnancy_postpartum', label: 'Pregnancy or postpartum (<1 month)' },
              { key: 'oral_contraceptives', label: 'Oral contraceptives or HRT' },
              { key: 'sepsis_1month', label: 'Sepsis (<1 month)' },
              { key: 'serious_lung_disease', label: 'Serious lung disease (COPD)' },
              { key: 'abnormal_pulmonary', label: 'Abnormal pulmonary function' },
              { key: 'acute_mi', label: 'Acute MI' },
              { key: 'chf_1month', label: 'CHF (<1 month)' },
              { key: 'inflammatory_bowel', label: 'Inflammatory bowel disease' },
              { key: 'medical_patient_bedrest', label: 'Medical patient on bedrest' }
            ].map(factor => (
              <label key={factor.key} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={(riskAssessmentData.dvt as any)[factor.key] || false}
                  onChange={(e) => setRiskAssessmentData(prev => ({
                    ...prev,
                    dvt: { ...prev.dvt, [factor.key]: e.target.checked }
                  }))}
                  className="mr-2 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>{factor.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 2 Point Risk Factors */}
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-red-800 mb-2">2 Point Risk Factors</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'age_61_74', label: 'Age 61-74 years' },
              { key: 'arthroscopic_surgery', label: 'Arthroscopic surgery' },
              { key: 'malignancy', label: 'Malignancy (present or previous)' },
              { key: 'major_surgery_45min', label: 'Major surgery (>45 minutes)' },
              { key: 'laparoscopic_45min', label: 'Laparoscopic surgery (>45 minutes)' },
              { key: 'patient_confined_bed', label: 'Patient confined to bed (>72 hours)' },
              { key: 'immobilizing_cast', label: 'Immobilizing plaster cast' },
              { key: 'central_venous_access', label: 'Central venous access' }
            ].map(factor => (
              <label key={factor.key} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={(riskAssessmentData.dvt as any)[factor.key] || false}
                  onChange={(e) => setRiskAssessmentData(prev => ({
                    ...prev,
                    dvt: { ...prev.dvt, [factor.key]: e.target.checked }
                  }))}
                  className="mr-2 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>{factor.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 3 Point Risk Factors */}
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-red-800 mb-2">3 Point Risk Factors</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'age_over_75', label: 'Age ≥75 years' },
              { key: 'personal_history_vte', label: 'Personal history of VTE' },
              { key: 'family_history_vte', label: 'Family history of VTE' },
              { key: 'factor_v_leiden', label: 'Factor V Leiden' },
              { key: 'prothrombin_mutation', label: 'Prothrombin 20210A mutation' },
              { key: 'elevated_homocysteine', label: 'Elevated serum homocysteine' },
              { key: 'lupus_anticoagulant', label: 'Lupus anticoagulant' },
              { key: 'anticardiolipin_antibodies', label: 'Anticardiolipin antibodies' },
              { key: 'heparin_thrombocytopenia', label: 'Heparin-induced thrombocytopenia (HIT)' },
              { key: 'other_thrombophilia', label: 'Other congenital/acquired thrombophilia' }
            ].map(factor => (
              <label key={factor.key} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={(riskAssessmentData.dvt as any)[factor.key] || false}
                  onChange={(e) => setRiskAssessmentData(prev => ({
                    ...prev,
                    dvt: { ...prev.dvt, [factor.key]: e.target.checked }
                  }))}
                  className="mr-2 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>{factor.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 5 Point Risk Factors */}
        <div className="mb-4">
          <h5 className="text-sm font-semibold text-red-800 mb-2">5 Point Risk Factors (Highest Risk)</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {[
              { key: 'stroke_1month', label: 'Stroke (<1 month)' },
              { key: 'elective_arthroplasty', label: 'Elective major lower extremity arthroplasty' },
              { key: 'hip_pelvis_fracture', label: 'Hip, pelvis, or leg fracture (<1 month)' },
              { key: 'acute_spinal_injury', label: 'Acute spinal cord injury (paralysis)' }
            ].map(factor => (
              <label key={factor.key} className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={(riskAssessmentData.dvt as any)[factor.key] || false}
                  onChange={(e) => setRiskAssessmentData(prev => ({
                    ...prev,
                    dvt: { ...prev.dvt, [factor.key]: e.target.checked }
                  }))}
                  className="mr-2 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span>{factor.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* DVT AI Recommendations */}
        {aiRecommendations.dvt.recommendations.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-blue-500">
            <h5 className="font-medium text-blue-900 mb-2">🤖 AI Clinical Recommendations</h5>
            <ul className="space-y-1">
              {aiRecommendations.dvt.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-700">• {rec}</li>
              ))}
            </ul>
            {aiRecommendations.dvt.interventions.length > 0 && (
              <div className="mt-3">
                <h6 className="font-medium text-blue-800 mb-1">Interventions:</h6>
                <ul className="space-y-1">
                  {aiRecommendations.dvt.interventions.map((intervention, index) => (
                    <li key={index} className="text-sm text-blue-700">→ {intervention}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dynamic Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {/* Specialist Consultation Button - Shows for high/very high risk */}
              {(aiRecommendations.dvt.riskLevel === 'high' || aiRecommendations.dvt.riskLevel === 'very_high') && (
                <button
                  onClick={() => generateConsultationLetterPDF('dvt')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  📄 Generate Consultation Letter
                  <span className="text-xs bg-purple-800 px-2 py-0.5 rounded">Vascular/Hematology</span>
                </button>
              )}

              {/* Patient Education Button - Shows for all risk levels */}
              <button
                onClick={() => generatePatientEducationPDF('dvt')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                📚 Generate Patient Education Material
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pressure Sore Risk Assessment */}
      <div className="bg-yellow-50 p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold text-yellow-900">Pressure Sore Risk Assessment (Braden Scale)</h4>
          {aiRecommendations.pressureSore.score !== null && (
            <div className="text-right">
              <span className="text-sm font-medium">Score: {aiRecommendations.pressureSore.score}</span>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                aiRecommendations.pressureSore.riskLevel === 'very_high' ? 'bg-red-100 text-red-800' :
                aiRecommendations.pressureSore.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                aiRecommendations.pressureSore.riskLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {aiRecommendations.pressureSore.riskLevel.toUpperCase().replace('_', ' ')} RISK
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries({
            sensory_perception: {
              label: 'Sensory Perception',
              options: {
                1: 'Completely Limited',
                2: 'Very Limited', 
                3: 'Slightly Limited',
                4: 'No Impairment'
              }
            },
            moisture: {
              label: 'Moisture',
              options: {
                1: 'Constantly Moist',
                2: 'Very Moist',
                3: 'Occasionally Moist', 
                4: 'Rarely Moist'
              }
            },
            activity: {
              label: 'Activity',
              options: {
                1: 'Bedfast',
                2: 'Chairfast',
                3: 'Walks Occasionally',
                4: 'Walks Frequently'
              }
            },
            mobility: {
              label: 'Mobility',
              options: {
                1: 'Completely Immobile',
                2: 'Very Limited',
                3: 'Slightly Limited',
                4: 'No Limitations'
              }
            },
            nutrition: {
              label: 'Nutrition',
              options: {
                1: 'Very Poor',
                2: 'Probably Inadequate',
                3: 'Adequate',
                4: 'Excellent'
              }
            },
            friction_shear: {
              label: 'Friction & Shear',
              options: {
                1: 'Problem',
                2: 'Potential Problem',
                3: 'No Apparent Problem'
              }
            }
          }).map(([key, config]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{config.label}</label>
              <select
                value={(riskAssessmentData.pressureSore as any)[key] || ''}
                onChange={(e) => setRiskAssessmentData(prev => ({
                  ...prev,
                  pressureSore: { ...prev.pressureSore, [key]: parseInt(e.target.value) }
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                required
              >
                <option value="">Select...</option>
                {Object.entries(config.options).map(([score, label]) => (
                  <option key={score} value={score}>{score} - {label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {/* Pressure Sore AI Recommendations */}
        {aiRecommendations.pressureSore.recommendations.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-blue-500">
            <h5 className="font-medium text-blue-900 mb-2">🤖 AI Clinical Recommendations</h5>
            <ul className="space-y-1">
              {aiRecommendations.pressureSore.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-700">• {rec}</li>
              ))}
            </ul>
            {aiRecommendations.pressureSore.interventions.length > 0 && (
              <div className="mt-3">
                <h6 className="font-medium text-blue-800 mb-1">Interventions:</h6>
                <ul className="space-y-1">
                  {aiRecommendations.pressureSore.interventions.map((intervention, index) => (
                    <li key={index} className="text-sm text-blue-700">→ {intervention}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dynamic Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {/* Specialist Consultation Button - Shows for high/very high risk */}
              {(aiRecommendations.pressureSore.riskLevel === 'high' || aiRecommendations.pressureSore.riskLevel === 'very_high') && (
                <button
                  onClick={() => generateConsultationLetterPDF('pressureSore')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  📄 Generate Consultation Letter
                  <span className="text-xs bg-purple-800 px-2 py-0.5 rounded">Plastic Surgery/Wound Care</span>
                </button>
              )}

              {/* Patient Education Button - Shows for all risk levels */}
              <button
                onClick={() => generatePatientEducationPDF('pressureSore')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                📚 Generate Patient Education Material
              </button>

              {/* Comprehensive Care Plan Button - Shows for all risk levels */}
              <button
                onClick={generateCarePlanPDF}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                📋 Generate Comprehensive Care Plan
                <span className="text-xs bg-green-800 px-2 py-0.5 rounded">AI Clinical Recommendations</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Nutritional Risk Assessment */}
      <div className="bg-green-50 p-6 rounded-lg">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-md font-semibold text-green-900">Nutritional Risk Assessment (MUST Score)</h4>
          {aiRecommendations.nutritional.score !== null && (
            <div className="text-right">
              <span className="text-sm font-medium">Score: {aiRecommendations.nutritional.score}</span>
              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                aiRecommendations.nutritional.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                aiRecommendations.nutritional.riskLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {aiRecommendations.nutritional.riskLevel.toUpperCase()} RISK
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Height (cm)</label>
            <input
              type="number"
              value={riskAssessmentData.nutritional.height || ''}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                nutritional: { ...prev.nutritional, height: parseFloat(e.target.value) }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
              placeholder="Enter height in cm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weight (kg)</label>
            <input
              type="number"
              value={riskAssessmentData.nutritional.weight || ''}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                nutritional: { ...prev.nutritional, weight: parseFloat(e.target.value) }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
              placeholder="Enter weight in kg"
            />
          </div>

          {/* Auto-calculated BMI Display */}
          {riskAssessmentData.nutritional.bmi > 0 && (
            <div className="md:col-span-2">
              <div className="p-3 bg-blue-100 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-1">🧮 Auto-Calculated BMI</h5>
                <div className="text-lg font-semibold text-blue-800">
                  BMI: {riskAssessmentData.nutritional.bmi.toFixed(1)} kg/m²
                </div>
                <div className={`text-sm font-medium ${
                  riskAssessmentData.nutritional.bmi < 18.5 ? 'text-red-600' :
                  riskAssessmentData.nutritional.bmi < 20 ? 'text-yellow-600' :
                  'text-green-600'
                }`}>
                  Category: {
                    riskAssessmentData.nutritional.bmi < 18.5 ? 'Underweight (High Risk)' :
                    riskAssessmentData.nutritional.bmi < 20 ? 'Low Normal (Medium Risk)' :
                    'Normal/Overweight (Low Risk)'
                  }
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Weight Loss % (last 3-6 months)</label>
            <input
              type="number"
              value={riskAssessmentData.nutritional.weight_loss_percentage || ''}
              onChange={(e) => setRiskAssessmentData(prev => ({
                ...prev,
                nutritional: { ...prev.nutritional, weight_loss_percentage: parseFloat(e.target.value) }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
              placeholder="Enter percentage"
            />
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={riskAssessmentData.nutritional.acute_disease_effect || false}
                onChange={(e) => setRiskAssessmentData(prev => ({
                  ...prev,
                  nutritional: { ...prev.nutritional, acute_disease_effect: e.target.checked }
                }))}
                className="mr-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm">Acute disease effect or no nutritional intake for &gt;5 days</span>
            </label>
          </div>
        </div>

        {/* Nutritional AI Recommendations */}
        {aiRecommendations.nutritional.recommendations.length > 0 && (
          <div className="mt-4 p-4 bg-white rounded-lg border-l-4 border-blue-500">
            <h5 className="font-medium text-blue-900 mb-2">🤖 AI Clinical Recommendations</h5>
            <ul className="space-y-1">
              {aiRecommendations.nutritional.recommendations.map((rec, index) => (
                <li key={index} className="text-sm text-gray-700">• {rec}</li>
              ))}
            </ul>
            {aiRecommendations.nutritional.interventions.length > 0 && (
              <div className="mt-3">
                <h6 className="font-medium text-blue-800 mb-1">Interventions:</h6>
                <ul className="space-y-1">
                  {aiRecommendations.nutritional.interventions.map((intervention, index) => (
                    <li key={index} className="text-sm text-blue-700">→ {intervention}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dynamic Action Buttons */}
            <div className="mt-4 flex flex-wrap gap-2">
              {/* Specialist Consultation Button - Shows for high risk */}
              {aiRecommendations.nutritional.riskLevel === 'high' && (
                <button
                  onClick={() => generateConsultationLetterPDF('nutritional')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  📄 Generate Consultation Letter
                  <span className="text-xs bg-purple-800 px-2 py-0.5 rounded">Dietitian/Nutrition</span>
                </button>
              )}

              {/* Patient Education Button - Shows for all risk levels */}
              <button
                onClick={() => generatePatientEducationPDF('nutritional')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                📚 Generate Patient Education Material
              </button>
            </div>
          </div>
        )}

        {/* Generate Meal Plan Button */}
        {riskAssessmentData.nutritional.bmi > 0 && !aiRecommendations.nutritional.mealPlan.generated && (
          <div className="mt-4">
            <button
              type="button"
              onClick={generateNigerianMealPlan}
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-green-800 transition-all shadow-md flex items-center justify-center space-x-2"
            >
              <span className="text-lg">🍽️</span>
              <span className="font-medium">Generate Weekly Meal Plan</span>
              <span className="text-sm opacity-90">(Based on Nigerian Foods & Comorbidities)</span>
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Personalized meal plan based on BMI, nutritional status, diagnosis, and comorbidities
            </p>
          </div>
        )}

        {/* Nigerian 7-Day Meal Plan */}
        {aiRecommendations.nutritional.mealPlan.generated && (
          <div className="mt-6 p-4 bg-white rounded-lg border-l-4 border-green-500">
            <div className="flex justify-between items-center mb-3">
              <h5 className="font-medium text-green-900">🍽️ Personalized 7-Day Nigerian Meal Plan</h5>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={exportMealPlanToPDF}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                >
                  <span>📄</span>
                  <span className="font-medium">Export as PDF</span>
                </button>
                <button
                  type="button"
                  onClick={generateNigerianMealPlan}
                  className="text-sm text-green-600 hover:text-green-700 underline"
                >
                  🔄 Regenerate
                </button>
              </div>
            </div>
            
            {/* Daily Requirements Summary */}
            {aiRecommendations.nutritional.mealPlan.dailyRequirements && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <h6 className="font-medium text-blue-900 mb-2">📊 Daily Nutritional Requirements</h6>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <div className="text-gray-600">Calories</div>
                    <div className="font-semibold text-blue-800">{aiRecommendations.nutritional.mealPlan.dailyRequirements.calories} kcal</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Protein</div>
                    <div className="font-semibold text-blue-800">{aiRecommendations.nutritional.mealPlan.dailyRequirements.protein}g</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Carbs</div>
                    <div className="font-semibold text-blue-800">{aiRecommendations.nutritional.mealPlan.dailyRequirements.carbs}g</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Fats</div>
                    <div className="font-semibold text-blue-800">{aiRecommendations.nutritional.mealPlan.dailyRequirements.fat}g</div>
                  </div>
                  <div>
                    <div className="text-gray-600">Fiber</div>
                    <div className="font-semibold text-blue-800">{aiRecommendations.nutritional.mealPlan.dailyRequirements.fiber}g</div>
                  </div>
                </div>
              </div>
            )}

            {/* Comorbidity Adjustments */}
            {aiRecommendations.nutritional.mealPlan.comorbidityAdjustments && (
              <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                <h6 className="font-medium text-yellow-900 mb-2">⚕️ Special Dietary Considerations</h6>
                <div className="space-y-1 text-sm">
                  {Object.entries(aiRecommendations.nutritional.mealPlan.comorbidityAdjustments).map(([key, value]) => 
                    value ? (
                      <div key={key} className="flex items-start">
                        <span className="text-yellow-600 mr-2">•</span>
                        <span className="text-gray-700"><strong className="capitalize">{key}:</strong> {value as string}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}
            
            <p className="text-sm text-gray-600 mb-4">
              Based on: <strong>BMI {riskAssessmentData.nutritional.bmi.toFixed(1)}</strong> | 
              Comorbidities: <strong>{riskAssessmentData.clinical.comorbidities.join(', ') || 'None'}</strong> | 
              Diagnosis: <strong>{riskAssessmentData.clinical.primary_diagnosis || 'None'}</strong>
            </p>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {aiRecommendations.nutritional.mealPlan.days.map((day, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3">
                  <h6 className="font-medium text-green-800 mb-2 flex items-center">
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs mr-2">Day {day.day}</span>
                  </h6>
                  <div className="space-y-2 text-sm">
                    <div><strong className="text-orange-700">🌅 Breakfast:</strong> {day.breakfast}</div>
                    <div><strong className="text-blue-700">☀️ Lunch:</strong> {day.lunch}</div>
                    <div><strong className="text-purple-700">🌙 Dinner:</strong> {day.dinner}</div>
                    <div><strong className="text-pink-700">🍎 Snacks:</strong> {day.snacks.join(', ')}</div>
                    
                    {/* Special Instructions */}
                    {day.specialInstructions && day.specialInstructions.length > 0 && (
                      <div className="mt-2 p-2 bg-red-50 rounded border-l-2 border-red-400">
                        <div className="text-xs font-medium text-red-800 mb-1">⚠️ Important Instructions:</div>
                        {day.specialInstructions.map((instruction, idx) => (
                          <div key={idx} className="text-xs text-red-700">• {instruction}</div>
                        ))}
                      </div>
                    )}
                    
                    <div className="text-xs text-gray-600 mt-2 p-2 bg-gray-50 rounded">
                      <strong>📈 Nutrition:</strong> {day.nutritionalInfo.calories} cal, 
                      {day.nutritionalInfo.protein}g protein, 
                      {day.nutritionalInfo.carbs}g carbs, 
                      {day.nutritionalInfo.fat}g fat, 
                      {day.nutritionalInfo.fiber}g fiber
                      {day.nutritionalInfo.sodium && <div className="mt-1">Sodium: {day.nutritionalInfo.sodium}</div>}
                      {day.nutritionalInfo.potassium && <div>Potassium: {day.nutritionalInfo.potassium}</div>}
                      {day.nutritionalInfo.phosphorus && <div>Phosphorus: {day.nutritionalInfo.phosphorus}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Patient Registration - UNTH</h2>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex space-x-4">
              {[1, 2, 3, 4].map(step => (
                <div
                  key={step}
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    step === currentStep
                      ? 'bg-green-600 text-white'
                      : step < currentStep
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>
            <span className="text-sm text-gray-500">
              Step {currentStep} of 4
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    setCurrentStep(currentStep - 1);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              {currentStep < 4 ? (
                <button
                  type="button"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    setCurrentStep(currentStep + 1);
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Registering...' : 'Register Patient'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};