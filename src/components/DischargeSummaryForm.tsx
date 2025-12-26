import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  Admission, 
  Discharge,
  DischargeMedication,
  WHODischargeScore,
  MealPlan,
  FollowUpAppointment,
  admissionDischargeService 
} from '../services/admissionDischargeService';

interface DischargeSummaryFormProps {
  admission: Admission;
  whoScore: WHODischargeScore;
  medications: DischargeMedication[];
  onComplete: (discharge: Omit<Discharge, 'id' | 'created_at' | 'updated_at'>) => void;
  onBack: () => void;
}

const CLINICS = ['Outpatient Clinic', 'Hand Clinic', 'Burns Clinic', 'Wound Clinic', 'Reconstructive Clinic'];
const CONSULTANTS = ['Dr Okwesili', 'Dr Nnadi', 'Dr Eze C. B'];

export default function DischargeSummaryForm({ 
  admission, 
  whoScore, 
  medications, 
  onComplete, 
  onBack 
}: DischargeSummaryFormProps) {
  // Basic discharge info
  const [finalDiagnosis, setFinalDiagnosis] = useState(admission.provisional_diagnosis || '');
  const [secondaryDiagnoses, setSecondaryDiagnoses] = useState<string[]>([]);
  const [proceduresPerformed, setProceduresPerformed] = useState<string[]>([]);
  const [hospitalCourseSummary, setHospitalCourseSummary] = useState('');
  const [conditionAtDischarge, setConditionAtDischarge] = useState('');
  const [dischargingConsultant, setDischargingConsultant] = useState('');

  // Follow-up
  const [followUpAppointments, setFollowUpAppointments] = useState<FollowUpAppointment[]>([]);

  // Instructions
  const [woundCareInstructions, setWoundCareInstructions] = useState('');
  const [activityRestrictions, setActivityRestrictions] = useState<string[]>([]);
  const [lifestyleModifications, setLifestyleModifications] = useState<string[]>([]);
  const [dietaryRecommendations, setDietaryRecommendations] = useState('');
  const [warningSigns, setWarningSigns] = useState<string[]>([
    'Fever above 38°C (100.4°F)',
    'Increasing pain not relieved by medication',
    'Wound redness, swelling, or discharge',
    'Difficulty breathing',
    'Persistent nausea or vomiting'
  ]);

  // Meal Plan
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [showMealPlan, setShowMealPlan] = useState(false);

  // Auto-generated content
  const [aiSummary, setAiSummary] = useState('');
  const [aiInstructions, setAiInstructions] = useState('');

  // Acknowledgement
  const [patientAcknowledged, setPatientAcknowledged] = useState(false);
  const [relativeAcknowledged, setRelativeAcknowledged] = useState(false);

  // Calculate length of stay
  const lengthOfStay = Math.ceil(
    (new Date().getTime() - new Date(admission.admission_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Determine discharge type based on WHO score
  const getDischargeType = (): Discharge['discharge_type'] => {
    switch (whoScore.recommendation) {
      case 'fit_for_discharge': return 'normal';
      case 'discharge_on_request': return 'on_request';
      case 'against_medical_advice': return 'against_medical_advice';
      default: return 'normal';
    }
  };

  // Generate meal plan based on comorbidities
  const generateMealPlan = () => {
    const comorbidities = admission.comorbidities || [];
    const plan = admissionDischargeService.generate7DayMealPlan(comorbidities, finalDiagnosis);
    setMealPlan(plan);
    setShowMealPlan(true);
  };

  // Auto-generate hospital course summary
  const generateHospitalCourse = () => {
    let summary = `Patient ${admission.patient_name} was admitted on ${format(new Date(admission.admission_date), 'dd MMMM yyyy')} `;
    summary += `via ${admission.route_of_admission.replace('_', ' ')} with ${admission.provisional_diagnosis}. `;
    
    if (proceduresPerformed.length > 0) {
      summary += `During the hospital stay, the following procedures were performed: ${proceduresPerformed.join(', ')}. `;
    }
    
    summary += `The patient was managed conservatively with wound care, pain management, and appropriate antibiotics. `;
    summary += `Patient's condition improved progressively over the ${lengthOfStay}-day admission. `;
    
    if (admission.comorbidities && admission.comorbidities.length > 0) {
      summary += `Comorbidities (${admission.comorbidities.join(', ')}) were optimized during admission. `;
    }
    
    summary += `WHO discharge readiness assessment score: ${whoScore.total_score}/33 (${whoScore.recommendation.replace(/_/g, ' ')}). `;
    summary += `Patient is being discharged in ${conditionAtDischarge || 'satisfactory'} condition with medications and follow-up instructions.`;
    
    setHospitalCourseSummary(summary);
  };

  // Auto-generate wound care instructions based on diagnosis
  const generateWoundCareInstructions = () => {
    const diagnosis = finalDiagnosis.toLowerCase();
    let instructions = '';

    if (diagnosis.includes('burn')) {
      instructions = `BURN WOUND CARE:
1. Clean the burn area daily with mild soap and clean water
2. Apply prescribed burn cream (Silver Sulfadiazine/Fusidic acid) to the affected area
3. Cover with non-stick dressing and secure with bandage
4. Change dressing daily or when soiled
5. Keep the area moisturized with prescribed moisturizer
6. Protect from direct sunlight (use SPF 30+ sunscreen when healed)
7. Perform prescribed stretching exercises to prevent contractures
8. Use pressure garments as directed`;
    } else if (diagnosis.includes('graft') || diagnosis.includes('flap')) {
      instructions = `GRAFT/FLAP CARE:
1. Keep the graft/flap site protected from trauma
2. Do NOT remove any dressings until your follow-up appointment
3. Keep the area elevated when resting
4. Avoid direct pressure on the graft site
5. Watch for signs of graft failure: dark discoloration, coolness, loss of capillary refill
6. Donor site: Keep clean and dry, apply prescribed ointment
7. Avoid strenuous activity that may disrupt the graft`;
    } else if (diagnosis.includes('wound') || diagnosis.includes('ulcer')) {
      instructions = `WOUND CARE:
1. Clean wound daily with normal saline or clean water
2. Apply prescribed wound dressing/ointment
3. Change dressing when soiled or as directed
4. Keep the wound dry between dressing changes
5. Watch for signs of infection: increased redness, swelling, pus, fever
6. Elevate the affected limb when resting
7. Do not remove sutures/staples - will be removed at follow-up`;
    } else {
      instructions = `GENERAL WOUND CARE:
1. Keep surgical site clean and dry
2. Follow dressing change instructions as prescribed
3. Do not submerge wound in water until healed
4. Watch for signs of infection
5. Return for suture removal as scheduled`;
    }

    setWoundCareInstructions(instructions);
  };

  // Generate lifestyle modifications based on comorbidities
  const generateLifestyleModifications = () => {
    const modifications: string[] = [];
    const comorbidities = (admission.comorbidities || []).map(c => c.toLowerCase());

    // General modifications
    modifications.push('Get adequate rest (7-8 hours sleep daily)');
    modifications.push('Avoid smoking and alcohol');
    modifications.push('Stay well hydrated');

    if (comorbidities.some(c => c.includes('diabetes'))) {
      modifications.push('Monitor blood sugar regularly');
      modifications.push('Follow diabetic diet strictly');
      modifications.push('Check feet daily for wounds or infections');
      modifications.push('Take diabetes medications as prescribed');
    }

    if (comorbidities.some(c => c.includes('hypertension') || c.includes('high blood pressure'))) {
      modifications.push('Reduce salt intake (< 5g/day)');
      modifications.push('Monitor blood pressure regularly');
      modifications.push('Take antihypertensive medications as prescribed');
      modifications.push('Manage stress through relaxation techniques');
    }

    if (comorbidities.some(c => c.includes('heart') || c.includes('cardiac'))) {
      modifications.push('Avoid strenuous physical activity initially');
      modifications.push('Follow low-fat, low-cholesterol diet');
      modifications.push('Take cardiac medications as prescribed');
    }

    if (comorbidities.some(c => c.includes('kidney') || c.includes('renal'))) {
      modifications.push('Follow fluid restriction if advised');
      modifications.push('Limit protein intake as directed');
      modifications.push('Avoid nephrotoxic medications (NSAIDs)');
    }

    // Surgery-specific
    modifications.push('Avoid heavy lifting (> 5kg) for 2-4 weeks');
    modifications.push('Gradually increase activity as tolerated');
    modifications.push('Attend all scheduled follow-up appointments');

    setLifestyleModifications(modifications);
  };

  // Add follow-up appointment
  const addFollowUp = () => {
    setFollowUpAppointments([
      ...followUpAppointments,
      {
        date: '',
        time: '',
        clinic: 'Outpatient Clinic',
        doctor: '',
        purpose: 'Post-discharge review',
        special_instructions: ''
      }
    ]);
  };

  const updateFollowUp = (index: number, field: keyof FollowUpAppointment, value: string) => {
    const updated = [...followUpAppointments];
    updated[index] = { ...updated[index], [field]: value };
    setFollowUpAppointments(updated);
  };

  const removeFollowUp = (index: number) => {
    setFollowUpAppointments(followUpAppointments.filter((_, i) => i !== index));
  };

  // Add procedure
  const [newProcedure, setNewProcedure] = useState('');
  const addProcedure = () => {
    if (newProcedure.trim()) {
      setProceduresPerformed([...proceduresPerformed, newProcedure.trim()]);
      setNewProcedure('');
    }
  };

  // Handle submission
  const handleSubmit = () => {
    if (!finalDiagnosis || !dischargingConsultant || !hospitalCourseSummary) {
      alert('Please fill in all required fields');
      return;
    }

    const dischargeData: Omit<Discharge, 'id' | 'created_at' | 'updated_at'> = {
      admission_id: admission.id!,
      patient_id: admission.patient_id,
      patient_name: admission.patient_name,
      hospital_number: admission.hospital_number,
      age: admission.age,
      gender: admission.gender,
      admission_date: admission.admission_date,
      discharge_date: new Date().toISOString().split('T')[0],
      discharge_time: new Date().toTimeString().split(' ')[0],
      length_of_stay_days: lengthOfStay,
      admitting_diagnosis: admission.provisional_diagnosis || '',
      final_diagnosis: finalDiagnosis,
      secondary_diagnoses: secondaryDiagnoses,
      procedures_performed: proceduresPerformed,
      who_discharge_score_id: whoScore.id,
      discharge_readiness_score: whoScore.total_score,
      discharge_type: getDischargeType(),
      discharge_destination: 'home',
      hospital_course_summary: hospitalCourseSummary,
      condition_at_discharge: conditionAtDischarge,
      medications_on_discharge: medications,
      dietary_recommendations: dietaryRecommendations,
      meal_plan_7_day: mealPlan || undefined,
      lifestyle_modifications: lifestyleModifications,
      activity_restrictions: activityRestrictions,
      wound_care_instructions: woundCareInstructions,
      warning_signs: warningSigns,
      follow_up_appointments: followUpAppointments.filter(f => f.date),
      ai_generated_summary: aiSummary,
      ai_generated_instructions: aiInstructions,
      discharging_doctor: 'Current User',
      discharging_consultant: dischargingConsultant,
      patient_acknowledged: patientAcknowledged,
      relative_acknowledged: relativeAcknowledged,
      created_by: 'Current User'
    };

    onComplete(dischargeData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h3 className="text-lg font-bold text-green-800">📝 Discharge Summary & Instructions</h3>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Patient:</span> <strong>{admission.patient_name}</strong></div>
          <div><span className="text-gray-500">Hospital No:</span> <strong>{admission.hospital_number}</strong></div>
          <div><span className="text-gray-500">Length of Stay:</span> <strong>{lengthOfStay} days</strong></div>
          <div><span className="text-gray-500">WHO Score:</span> <strong>{whoScore.total_score}/33</strong></div>
        </div>
      </div>

      {/* Discharge Type Banner */}
      <div className={`p-3 rounded-lg border-2 ${
        getDischargeType() === 'normal' ? 'bg-green-50 border-green-400' :
        getDischargeType() === 'on_request' ? 'bg-yellow-50 border-yellow-400' :
        'bg-red-50 border-red-400'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-xl">
            {getDischargeType() === 'normal' ? '✅' : getDischargeType() === 'on_request' ? '⚠️' : '🚨'}
          </span>
          <span className="font-semibold">
            Discharge Type: {getDischargeType().replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      {/* Diagnosis Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-800 mb-4">🩺 Diagnosis</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Final Diagnosis *</label>
            <textarea
              value={finalDiagnosis}
              onChange={(e) => setFinalDiagnosis(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={2}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Diagnoses</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {secondaryDiagnoses.map((d, idx) => (
                <span key={idx} className="px-2 py-1 bg-gray-100 rounded flex items-center gap-1">
                  {d}
                  <button onClick={() => setSecondaryDiagnoses(secondaryDiagnoses.filter((_, i) => i !== idx))} className="text-red-500">×</button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Add secondary diagnosis and press Enter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  setSecondaryDiagnoses([...secondaryDiagnoses, e.currentTarget.value]);
                  e.currentTarget.value = '';
                  e.preventDefault();
                }
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Procedures Performed</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {proceduresPerformed.map((p, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-100 rounded flex items-center gap-1">
                  {p}
                  <button onClick={() => setProceduresPerformed(proceduresPerformed.filter((_, i) => i !== idx))} className="text-red-500">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newProcedure}
                onChange={(e) => setNewProcedure(e.target.value)}
                placeholder="Add procedure"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              />
              <button onClick={addProcedure} className="px-4 py-2 bg-blue-600 text-white rounded-md">Add</button>
            </div>
          </div>
        </div>
      </div>

      {/* Hospital Course Summary */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-800">📋 Hospital Course Summary *</h4>
          <button
            onClick={generateHospitalCourse}
            className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
          >
            ✨ Auto-Generate
          </button>
        </div>
        <textarea
          value={hospitalCourseSummary}
          onChange={(e) => setHospitalCourseSummary(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={6}
          placeholder="Summarize the patient's hospital stay..."
          required
        />
      </div>

      {/* Condition at Discharge */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold text-gray-800 mb-4">💚 Condition at Discharge</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
            <select
              value={conditionAtDischarge}
              onChange={(e) => setConditionAtDischarge(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select condition</option>
              <option value="Recovered">Recovered</option>
              <option value="Improved">Improved</option>
              <option value="Stable">Stable</option>
              <option value="Satisfactory">Satisfactory</option>
              <option value="Fair">Fair</option>
              <option value="Unchanged">Unchanged</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharging Consultant *</label>
            <select
              value={dischargingConsultant}
              onChange={(e) => setDischargingConsultant(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">Select consultant</option>
              {CONSULTANTS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Wound Care Instructions */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-800">🩹 Wound Care Instructions</h4>
          <button
            onClick={generateWoundCareInstructions}
            className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
          >
            ✨ Auto-Generate
          </button>
        </div>
        <textarea
          value={woundCareInstructions}
          onChange={(e) => setWoundCareInstructions(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          rows={6}
        />
      </div>

      {/* Lifestyle Modifications */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-800">🏃 Lifestyle Modifications</h4>
          <button
            onClick={generateLifestyleModifications}
            className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-sm hover:bg-purple-200"
          >
            ✨ Generate Based on Comorbidities
          </button>
        </div>
        <div className="space-y-2">
          {lifestyleModifications.map((mod, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-green-600">✓</span>
              <span className="flex-1">{mod}</span>
              <button onClick={() => setLifestyleModifications(lifestyleModifications.filter((_, i) => i !== idx))} className="text-red-500">×</button>
            </div>
          ))}
          <input
            type="text"
            placeholder="Add modification and press Enter"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                setLifestyleModifications([...lifestyleModifications, e.currentTarget.value]);
                e.currentTarget.value = '';
                e.preventDefault();
              }
            }}
          />
        </div>
      </div>

      {/* 7-Day Meal Plan */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-800">🍽️ 7-Day Meal Plan</h4>
          <button
            onClick={generateMealPlan}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            🍳 Generate Meal Plan
          </button>
        </div>

        {mealPlan && showMealPlan && (
          <div className="space-y-4">
            {/* Special Considerations */}
            {mealPlan.special_considerations.length > 0 && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <h5 className="font-medium text-blue-800 mb-2">Special Dietary Considerations:</h5>
                <ul className="text-sm text-blue-700">
                  {mealPlan.special_considerations.map((c, idx) => (
                    <li key={idx}>• {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Foods to Avoid */}
            {mealPlan.foods_to_avoid.length > 0 && (
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <h5 className="font-medium text-red-800 mb-2">Foods to Avoid:</h5>
                <div className="flex flex-wrap gap-2">
                  {mealPlan.foods_to_avoid.map((f, idx) => (
                    <span key={idx} className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">❌ {f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { day: 'Day 1', meals: mealPlan.day1 },
                { day: 'Day 2', meals: mealPlan.day2 },
                { day: 'Day 3', meals: mealPlan.day3 },
                { day: 'Day 4', meals: mealPlan.day4 },
                { day: 'Day 5', meals: mealPlan.day5 },
                { day: 'Day 6', meals: mealPlan.day6 },
                { day: 'Day 7', meals: mealPlan.day7 }
              ].map(({ day, meals }) => (
                <div key={day} className="bg-gray-50 p-3 rounded border">
                  <h6 className="font-semibold text-gray-800 mb-2">{day}</h6>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-500">🌅 Breakfast:</span> {meals.breakfast}</p>
                    <p><span className="text-gray-500">🍎 Snack:</span> {meals.mid_morning_snack}</p>
                    <p><span className="text-gray-500">🍲 Lunch:</span> {meals.lunch}</p>
                    <p><span className="text-gray-500">🥤 Snack:</span> {meals.afternoon_snack}</p>
                    <p><span className="text-gray-500">🌙 Dinner:</span> {meals.dinner}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Hydration */}
            <div className="bg-cyan-50 p-3 rounded border border-cyan-200">
              <h5 className="font-medium text-cyan-800">💧 Hydration Goals:</h5>
              <p className="text-cyan-700">{mealPlan.hydration_goals}</p>
            </div>
          </div>
        )}
      </div>

      {/* Follow-up Appointments */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-gray-800">📅 Follow-up Appointments</h4>
          <button onClick={addFollowUp} className="px-4 py-2 bg-blue-600 text-white rounded-md">+ Add Follow-up</button>
        </div>
        {followUpAppointments.length === 0 ? (
          <p className="text-gray-500 text-sm">No follow-up appointments added</p>
        ) : (
          <div className="space-y-4">
            {followUpAppointments.map((apt, idx) => (
              <div key={idx} className="bg-gray-50 p-3 rounded border flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500">Date</label>
                  <input
                    type="date"
                    value={apt.date}
                    onChange={(e) => updateFollowUp(idx, 'date', e.target.value)}
                    className="px-2 py-1 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500">Clinic</label>
                  <select
                    value={apt.clinic}
                    onChange={(e) => updateFollowUp(idx, 'clinic', e.target.value)}
                    className="px-2 py-1 border rounded"
                  >
                    {CLINICS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500">Purpose</label>
                  <input
                    type="text"
                    value={apt.purpose}
                    onChange={(e) => updateFollowUp(idx, 'purpose', e.target.value)}
                    className="w-full px-2 py-1 border rounded"
                    placeholder="e.g., Wound check, Suture removal"
                  />
                </div>
                <button onClick={() => removeFollowUp(idx)} className="text-red-500 hover:text-red-700">🗑️</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning Signs */}
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <h4 className="font-semibold text-red-800 mb-4">⚠️ Warning Signs to Watch For</h4>
        <div className="space-y-2">
          {warningSigns.map((sign, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-red-600">🚨</span>
              <span className="flex-1">{sign}</span>
              <button onClick={() => setWarningSigns(warningSigns.filter((_, i) => i !== idx))} className="text-gray-500">×</button>
            </div>
          ))}
          <input
            type="text"
            placeholder="Add warning sign"
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.currentTarget.value) {
                setWarningSigns([...warningSigns, e.currentTarget.value]);
                e.currentTarget.value = '';
                e.preventDefault();
              }
            }}
          />
        </div>
      </div>

      {/* Acknowledgement */}
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h4 className="font-semibold text-yellow-800 mb-4">✍️ Acknowledgement</h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={patientAcknowledged}
              onChange={(e) => setPatientAcknowledged(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded"
            />
            <span>Patient has been counseled about discharge instructions and medications</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={relativeAcknowledged}
              onChange={(e) => setRelativeAcknowledged(e.target.checked)}
              className="w-5 h-5 text-green-600 rounded"
            />
            <span>Relative/caregiver has been counseled</span>
          </label>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Generate Documents & Complete →
        </button>
      </div>
    </div>
  );
}
