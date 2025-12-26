import React, { useState, useEffect } from 'react';
import { Admission, WHODischargeScore, admissionDischargeService } from '../services/admissionDischargeService';

interface WHODischargeAssessmentProps {
  admission: Admission;
  onComplete: (score: WHODischargeScore) => void;
  onBack: () => void;
}

interface ScoreOption {
  value: number;
  label: string;
  description: string;
}

const VITAL_SIGNS_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Unstable', description: 'Vital signs fluctuating, requiring intervention' },
  { value: 1, label: 'Borderline', description: 'Marginally stable, needs monitoring' },
  { value: 2, label: 'Stable 24h', description: 'Stable for at least 24 hours' },
  { value: 3, label: 'Stable 48h+', description: 'Consistently stable for 48+ hours' }
];

const PAIN_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Severe (8-10)', description: 'Severe pain, poorly controlled' },
  { value: 1, label: 'Moderate (5-7)', description: 'Moderate pain, partially controlled' },
  { value: 2, label: 'Mild (2-4)', description: 'Mild pain, well controlled with medication' },
  { value: 3, label: 'Minimal (0-1)', description: 'Minimal to no pain' }
];

const ORAL_INTAKE_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'NPO', description: 'Nothing by mouth / IV fluids only' },
  { value: 1, label: 'Liquids Only', description: 'Tolerating clear or full liquids' },
  { value: 2, label: 'Soft Diet', description: 'Tolerating soft foods' },
  { value: 3, label: 'Regular Diet', description: 'Tolerating regular diet without issues' }
];

const MOBILITY_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Bedbound', description: 'Unable to leave bed' },
  { value: 1, label: 'Needs Assistance', description: 'Requires help to mobilize' },
  { value: 2, label: 'Walks with Aid', description: 'Can walk with walking aid' },
  { value: 3, label: 'Independent', description: 'Independently mobile' }
];

const WOUND_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Infected', description: 'Signs of wound infection present' },
  { value: 1, label: 'Concerning', description: 'Some concerns (swelling, delayed healing)' },
  { value: 2, label: 'Healing', description: 'Healing as expected' },
  { value: 3, label: 'Well-healed', description: 'Excellent wound healing / No wounds' }
];

const SELF_CARE_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Fully Dependent', description: 'Requires total care for all activities' },
  { value: 1, label: 'Needs Help', description: 'Needs significant assistance' },
  { value: 2, label: 'Minimal Help', description: 'Needs minimal assistance' },
  { value: 3, label: 'Independent', description: 'Can perform self-care independently' }
];

const MEDICATION_UNDERSTANDING_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'None', description: 'Does not understand medications' },
  { value: 1, label: 'Poor', description: 'Minimal understanding, high confusion risk' },
  { value: 2, label: 'Moderate', description: 'Understands basic medication schedule' },
  { value: 3, label: 'Good', description: 'Fully understands all medications and timing' }
];

const FOLLOW_UP_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Not Arranged', description: 'No follow-up appointments scheduled' },
  { value: 1, label: 'Pending', description: 'Appointments being scheduled' },
  { value: 2, label: 'Partially', description: 'Some appointments confirmed' },
  { value: 3, label: 'Complete', description: 'All necessary follow-ups confirmed' }
];

const CAREGIVER_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'None', description: 'No caregiver available' },
  { value: 1, label: 'Occasionally', description: 'Caregiver available sometimes' },
  { value: 2, label: 'Most Times', description: 'Caregiver available most of the time' },
  { value: 3, label: 'Always', description: 'Reliable 24/7 caregiver support' }
];

const TRANSPORT_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Not Arranged', description: 'No transport plan' },
  { value: 1, label: 'Uncertain', description: 'Transport arrangement unclear' },
  { value: 2, label: 'Planned', description: 'Transport planned but not confirmed' },
  { value: 3, label: 'Confirmed', description: 'Transport confirmed and ready' }
];

const HOME_ENVIRONMENT_OPTIONS: ScoreOption[] = [
  { value: 0, label: 'Unsafe', description: 'Home environment not suitable' },
  { value: 1, label: 'Concerns', description: 'Some safety concerns exist' },
  { value: 2, label: 'Acceptable', description: 'Generally safe with minor issues' },
  { value: 3, label: 'Safe', description: 'Safe and suitable for recovery' }
];

export default function WHODischargeAssessment({ admission, onComplete, onBack }: WHODischargeAssessmentProps) {
  // Clinical Stability
  const [vitalSignsStable, setVitalSignsStable] = useState<number>(2);
  const [painControlled, setPainControlled] = useState<number>(2);
  const [oralIntakeAdequate, setOralIntakeAdequate] = useState<number>(2);
  const [mobilityStatus, setMobilityStatus] = useState<number>(2);
  const [woundHealingStatus, setWoundHealingStatus] = useState<number>(2);

  // Functional Readiness
  const [selfCareAbility, setSelfCareAbility] = useState<number>(2);
  const [medicationUnderstanding, setMedicationUnderstanding] = useState<number>(2);
  const [followUpArranged, setFollowUpArranged] = useState<number>(1);

  // Social Support
  const [caregiverAvailable, setCaregiverAvailable] = useState<number>(2);
  const [transportArranged, setTransportArranged] = useState<number>(1);
  const [homeEnvironmentSafe, setHomeEnvironmentSafe] = useState<number>(2);

  // Risk Factors
  const [highReadmissionRisk, setHighReadmissionRisk] = useState<boolean>(false);
  const [complexMedicalNeeds, setComplexMedicalNeeds] = useState<boolean>(false);
  const [languageBarrier, setLanguageBarrier] = useState<boolean>(false);

  // Notes
  const [notes, setNotes] = useState<string>('');

  // Calculate score
  const calculateScore = (): { totalScore: number; recommendation: WHODischargeScore['recommendation'] } => {
    let totalScore = 
      vitalSignsStable +
      painControlled +
      oralIntakeAdequate +
      mobilityStatus +
      woundHealingStatus +
      selfCareAbility +
      medicationUnderstanding +
      followUpArranged +
      caregiverAvailable +
      transportArranged +
      homeEnvironmentSafe;

    // Subtract risk factors
    if (highReadmissionRisk) totalScore -= 2;
    if (complexMedicalNeeds) totalScore -= 2;
    if (languageBarrier) totalScore -= 1;

    let recommendation: WHODischargeScore['recommendation'];
    if (totalScore >= 27) {
      recommendation = 'fit_for_discharge';
    } else if (totalScore >= 20) {
      recommendation = 'discharge_on_request';
    } else if (totalScore >= 12) {
      recommendation = 'against_medical_advice';
    } else {
      recommendation = 'not_ready';
    }

    return { totalScore, recommendation };
  };

  const { totalScore, recommendation } = calculateScore();

  const getRecommendationDetails = () => {
    switch (recommendation) {
      case 'fit_for_discharge':
        return {
          color: 'green',
          icon: '✅',
          title: 'Fit for Discharge',
          description: 'Patient meets all WHO criteria for safe discharge',
          dischargeType: 'Normal Discharge'
        };
      case 'discharge_on_request':
        return {
          color: 'yellow',
          icon: '⚠️',
          title: 'Discharge on Request',
          description: 'Patient may be discharged if they request, with documented counseling',
          dischargeType: 'Discharge on Request'
        };
      case 'against_medical_advice':
        return {
          color: 'red',
          icon: '🚨',
          title: 'Against Medical Advice',
          description: 'Patient does not meet discharge criteria. Discharge would be AMA.',
          dischargeType: 'Against Medical Advice'
        };
      case 'not_ready':
        return {
          color: 'gray',
          icon: '❌',
          title: 'Not Ready for Discharge',
          description: 'Patient is not ready for discharge. Continue inpatient care.',
          dischargeType: 'N/A - Continue Admission'
        };
    }
  };

  const recommendationDetails = getRecommendationDetails();

  const handleSubmit = async () => {
    const scoreData: Omit<WHODischargeScore, 'id' | 'created_at' | 'total_score' | 'recommendation'> = {
      admission_id: admission.id!,
      patient_id: admission.patient_id,
      assessment_date: new Date().toISOString().split('T')[0],
      assessed_by: 'Current User', // TODO: Get from auth
      vital_signs_stable: vitalSignsStable,
      pain_controlled: painControlled,
      oral_intake_adequate: oralIntakeAdequate,
      mobility_status: mobilityStatus,
      wound_healing_status: woundHealingStatus,
      self_care_ability: selfCareAbility,
      medication_understanding: medicationUnderstanding,
      follow_up_arranged: followUpArranged,
      caregiver_available: caregiverAvailable,
      transport_arranged: transportArranged,
      home_environment_safe: homeEnvironmentSafe,
      high_readmission_risk: highReadmissionRisk,
      complex_medical_needs: complexMedicalNeeds,
      language_barrier: languageBarrier,
      notes
    };

    const calculatedScore = admissionDischargeService.calculateWHODischargeScore(scoreData);
    onComplete(calculatedScore);
  };

  const ScoreSelector = ({ 
    label, 
    options, 
    value, 
    onChange,
    icon
  }: { 
    label: string; 
    options: ScoreOption[]; 
    value: number; 
    onChange: (v: number) => void;
    icon: string;
  }) => (
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <label className="font-medium text-gray-800">{icon} {label}</label>
        <span className={`px-2 py-1 rounded text-sm font-semibold ${
          value >= 3 ? 'bg-green-100 text-green-700' :
          value >= 2 ? 'bg-blue-100 text-blue-700' :
          value >= 1 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          {value}/3
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`p-2 rounded-lg border text-left transition-all ${
              value === option.value
                ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className={`font-medium text-sm ${value === option.value ? 'text-green-700' : 'text-gray-800'}`}>
              {option.label}
            </div>
            <div className="text-xs text-gray-500 mt-1">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-bold text-blue-800">📋 WHO Discharge Readiness Assessment</h3>
        <p className="text-sm text-blue-600 mt-1">
          Assess patient readiness for discharge based on WHO guidelines for safe hospital discharge.
        </p>
        <div className="mt-2 text-sm">
          <strong>Patient:</strong> {admission.patient_name} ({admission.hospital_number})
        </div>
      </div>

      {/* Score Summary (Sticky) */}
      <div className={`sticky top-4 z-10 p-4 rounded-lg border-2 ${
        recommendationDetails.color === 'green' ? 'bg-green-50 border-green-400' :
        recommendationDetails.color === 'yellow' ? 'bg-yellow-50 border-yellow-400' :
        recommendationDetails.color === 'red' ? 'bg-red-50 border-red-400' :
        'bg-gray-50 border-gray-400'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{recommendationDetails.icon}</span>
              <span className="text-xl font-bold">{recommendationDetails.title}</span>
            </div>
            <p className="text-sm mt-1">{recommendationDetails.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{totalScore}/33</div>
            <div className="text-sm text-gray-600">Total Score</div>
          </div>
        </div>
        <div className="mt-3 bg-white bg-opacity-50 p-2 rounded">
          <div className="flex gap-4 text-xs">
            <span className="text-green-700">≥27: Fit for Discharge</span>
            <span className="text-yellow-700">20-26: Discharge on Request</span>
            <span className="text-red-700">12-19: Against Medical Advice</span>
            <span className="text-gray-700">&lt;12: Not Ready</span>
          </div>
        </div>
      </div>

      {/* Section 1: Clinical Stability */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">
          🏥 Section 1: Clinical Stability (Max 15 points)
        </h4>
        <ScoreSelector 
          label="Vital Signs Stability" 
          options={VITAL_SIGNS_OPTIONS} 
          value={vitalSignsStable} 
          onChange={setVitalSignsStable}
          icon="💓"
        />
        <ScoreSelector 
          label="Pain Control" 
          options={PAIN_OPTIONS} 
          value={painControlled} 
          onChange={setPainControlled}
          icon="💊"
        />
        <ScoreSelector 
          label="Oral Intake" 
          options={ORAL_INTAKE_OPTIONS} 
          value={oralIntakeAdequate} 
          onChange={setOralIntakeAdequate}
          icon="🍽️"
        />
        <ScoreSelector 
          label="Mobility Status" 
          options={MOBILITY_OPTIONS} 
          value={mobilityStatus} 
          onChange={setMobilityStatus}
          icon="🚶"
        />
        <ScoreSelector 
          label="Wound Healing Status" 
          options={WOUND_OPTIONS} 
          value={woundHealingStatus} 
          onChange={setWoundHealingStatus}
          icon="🩹"
        />
      </div>

      {/* Section 2: Functional Readiness */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">
          🎯 Section 2: Functional Readiness (Max 9 points)
        </h4>
        <ScoreSelector 
          label="Self-Care Ability" 
          options={SELF_CARE_OPTIONS} 
          value={selfCareAbility} 
          onChange={setSelfCareAbility}
          icon="🧴"
        />
        <ScoreSelector 
          label="Medication Understanding" 
          options={MEDICATION_UNDERSTANDING_OPTIONS} 
          value={medicationUnderstanding} 
          onChange={setMedicationUnderstanding}
          icon="📝"
        />
        <ScoreSelector 
          label="Follow-up Arranged" 
          options={FOLLOW_UP_OPTIONS} 
          value={followUpArranged} 
          onChange={setFollowUpArranged}
          icon="📅"
        />
      </div>

      {/* Section 3: Social Support */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-800 border-b pb-2">
          👨‍👩‍👧 Section 3: Social Support (Max 9 points)
        </h4>
        <ScoreSelector 
          label="Caregiver Availability" 
          options={CAREGIVER_OPTIONS} 
          value={caregiverAvailable} 
          onChange={setCaregiverAvailable}
          icon="👥"
        />
        <ScoreSelector 
          label="Transport Arrangement" 
          options={TRANSPORT_OPTIONS} 
          value={transportArranged} 
          onChange={setTransportArranged}
          icon="🚗"
        />
        <ScoreSelector 
          label="Home Environment Safety" 
          options={HOME_ENVIRONMENT_OPTIONS} 
          value={homeEnvironmentSafe} 
          onChange={setHomeEnvironmentSafe}
          icon="🏠"
        />
      </div>

      {/* Section 4: Risk Factors */}
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <h4 className="text-lg font-semibold text-red-800 mb-4">
          ⚠️ Section 4: Risk Factors (Deductions)
        </h4>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={highReadmissionRisk}
              onChange={(e) => setHighReadmissionRisk(e.target.checked)}
              className="w-5 h-5 text-red-600 rounded"
            />
            <div>
              <span className="font-medium">High Readmission Risk</span>
              <span className="text-red-600 ml-2">(-2 points)</span>
              <p className="text-sm text-gray-600">History of frequent readmissions or high-risk condition</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={complexMedicalNeeds}
              onChange={(e) => setComplexMedicalNeeds(e.target.checked)}
              className="w-5 h-5 text-red-600 rounded"
            />
            <div>
              <span className="font-medium">Complex Medical Needs</span>
              <span className="text-red-600 ml-2">(-2 points)</span>
              <p className="text-sm text-gray-600">Requires specialized equipment or complex care at home</p>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={languageBarrier}
              onChange={(e) => setLanguageBarrier(e.target.checked)}
              className="w-5 h-5 text-red-600 rounded"
            />
            <div>
              <span className="font-medium">Language/Communication Barrier</span>
              <span className="text-red-600 ml-2">(-1 point)</span>
              <p className="text-sm text-gray-600">Difficulty understanding discharge instructions</p>
            </div>
          </label>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <label className="block font-medium text-gray-800 mb-2">📝 Assessment Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="Any additional observations or concerns..."
        />
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
          disabled={recommendation === 'not_ready'}
          className={`px-6 py-2 rounded-md text-white ${
            recommendation === 'not_ready'
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          Continue with {recommendationDetails.dischargeType} →
        </button>
      </div>
    </div>
  );
}
