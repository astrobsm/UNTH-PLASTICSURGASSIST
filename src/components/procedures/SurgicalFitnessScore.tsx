import React, { useState, useEffect } from 'react';
import { procedureService, SurgicalFitnessScore } from '../../services/procedureService';

interface SurgicalFitnessScoreFormProps {
  patientId: string;
  onComplete: (scoreId: string) => void;
}

export const SurgicalFitnessScoreForm: React.FC<SurgicalFitnessScoreFormProps> = ({
  patientId,
  onComplete
}) => {
  const [score, setScore] = useState<any>({
    patient_id: patientId,
    assessment_date: new Date().toISOString().split('T')[0],
    cardiovascular_score: 0,
    respiratory_score: 0,
    renal_score: 0,
    hepatic_score: 0,
    neurological_score: 0,
    metabolic_score: 0,
    functional_status_score: 0,
    age_score: 0,
    total_score: 0,
    risk_category: 'low',
    recommendations: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate total score whenever individual scores change
  useEffect(() => {
    const total = (score.cardiovascular_score || 0) +
                  (score.respiratory_score || 0) +
                  (score.renal_score || 0) +
                  (score.hepatic_score || 0) +
                  (score.neurological_score || 0) +
                  (score.metabolic_score || 0) +
                  (score.functional_status_score || 0) +
                  (score.age_score || 0);
    
    let riskCategory: 'low' | 'moderate' | 'high' = 'low';
    if (total >= 60) riskCategory = 'high';
    else if (total >= 30) riskCategory = 'moderate';

    setScore(prev => ({
      ...prev,
      total_score: total,
      risk_category: riskCategory
    }));
  }, [
    score.cardiovascular_score,
    score.respiratory_score,
    score.renal_score,
    score.hepatic_score,
    score.neurological_score,
    score.metabolic_score,
    score.functional_status_score,
    score.age_score
  ]);

  const handleScoreChange = (field: string, value: number) => {
    setScore(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const submitScore = async () => {
    setIsSubmitting(true);
    try {
      const scoreId = await procedureService.createSurgicalFitnessScore(score as SurgicalFitnessScore);
      onComplete(scoreId);
    } catch (error) {
      console.error('Failed to save surgical fitness score:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const ScoreSection: React.FC<{
    title: string;
    field: string;
    criteria: Array<{ score: number; description: string; color?: string }>;
    currentScore: number;
  }> = ({ title, field, criteria, currentScore }) => (
    <div className="bg-gray-50 rounded-lg p-4">
      <h4 className="font-semibold text-gray-900 mb-3">{title}</h4>
      <div className="space-y-2">
        {criteria.map((criterion) => (
          <label key={criterion.score} className="flex items-center cursor-pointer">
            <input
              type="radio"
              name={field}
              value={criterion.score}
              checked={currentScore === criterion.score}
              onChange={(e) => handleScoreChange(field, parseInt(e.target.value))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
            />
            <span className={`ml-3 text-sm flex-1 ${criterion.color || 'text-gray-700'}`}>
              <span className="font-medium">{criterion.score} pts:</span> {criterion.description}
            </span>
          </label>
        ))}
      </div>
    </div>
  );

  const getRiskColor = (category: string) => {
    switch (category) {
      case 'low': return 'text-green-600';
      case 'moderate': return 'text-orange-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskBgColor = (category: string) => {
    switch (category) {
      case 'low': return 'bg-green-50 border-green-200';
      case 'moderate': return 'bg-orange-50 border-orange-200';
      case 'high': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Surgical Fitness Score</h2>
            <p className="text-gray-600 mt-1">Comprehensive 100-point risk assessment system</p>
          </div>
          
          <div className={`px-4 py-2 rounded-lg border ${getRiskBgColor(score.risk_category || 'low')}`}>
            <div className="text-center">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">{score.total_score || 0}</div>
              <div className={`text-sm font-medium ${getRiskColor(score.risk_category || 'low')}`}>
                {(score.risk_category || 'low').toUpperCase()} RISK
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Risk Level Explanation */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Risk Categories</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <span><strong>Low Risk (0-29):</strong> Minimal perioperative risk</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
              <span><strong>Moderate Risk (30-59):</strong> Increased monitoring required</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
              <span><strong>High Risk (60+):</strong> Consider optimization/alternatives</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cardiovascular Assessment */}
          <ScoreSection
            title="Cardiovascular System (0-20 points)"
            field="cardiovascular_score"
            currentScore={score.cardiovascular_score || 0}
            criteria={[
              { score: 0, description: "No known cardiac disease, normal ECG", color: "text-green-700" },
              { score: 5, description: "Controlled hypertension, stable CAD", color: "text-yellow-700" },
              { score: 10, description: "Previous MI >6 months, mild heart failure", color: "text-orange-700" },
              { score: 15, description: "Recent MI <6 months, moderate heart failure", color: "text-red-600" },
              { score: 20, description: "Severe heart failure, unstable angina, severe valve disease", color: "text-red-700" }
            ]}
          />

          {/* Respiratory Assessment */}
          <ScoreSection
            title="Respiratory System (0-15 points)"
            field="respiratory_score"
            currentScore={score.respiratory_score || 0}
            criteria={[
              { score: 0, description: "No respiratory disease, normal spirometry", color: "text-green-700" },
              { score: 3, description: "Mild COPD, well-controlled asthma", color: "text-yellow-700" },
              { score: 8, description: "Moderate COPD, recent respiratory infection", color: "text-orange-700" },
              { score: 12, description: "Severe COPD, oxygen dependent", color: "text-red-600" },
              { score: 15, description: "Severe respiratory failure, mechanical ventilation", color: "text-red-700" }
            ]}
          />

          {/* Renal Assessment */}
          <ScoreSection
            title="Renal Function (0-15 points)"
            field="renal_score"
            currentScore={score.renal_score || 0}
            criteria={[
              { score: 0, description: "Normal renal function (Cr <1.2 mg/dL)", color: "text-green-700" },
              { score: 3, description: "Mild impairment (Cr 1.2-1.9 mg/dL)", color: "text-yellow-700" },
              { score: 8, description: "Moderate impairment (Cr 2.0-3.0 mg/dL)", color: "text-orange-700" },
              { score: 12, description: "Severe impairment (Cr >3.0 mg/dL)", color: "text-red-600" },
              { score: 15, description: "Dialysis dependent", color: "text-red-700" }
            ]}
          />

          {/* Hepatic Assessment */}
          <ScoreSection
            title="Hepatic Function (0-10 points)"
            field="hepatic_score"
            currentScore={score.hepatic_score || 0}
            criteria={[
              { score: 0, description: "Normal liver function", color: "text-green-700" },
              { score: 2, description: "Mild elevation of liver enzymes", color: "text-yellow-700" },
              { score: 5, description: "Moderate hepatic impairment", color: "text-orange-700" },
              { score: 8, description: "Severe hepatic impairment, cirrhosis", color: "text-red-600" },
              { score: 10, description: "End-stage liver disease", color: "text-red-700" }
            ]}
          />

          {/* Neurological Assessment */}
          <ScoreSection
            title="Neurological Status (0-10 points)"
            field="neurological_score"
            currentScore={score.neurological_score || 0}
            criteria={[
              { score: 0, description: "No neurological deficits", color: "text-green-700" },
              { score: 2, description: "Mild cognitive impairment, controlled seizures", color: "text-yellow-700" },
              { score: 5, description: "Previous stroke with residual deficits", color: "text-orange-700" },
              { score: 8, description: "Recent stroke, moderate dementia", color: "text-red-600" },
              { score: 10, description: "Severe dementia, recent brain injury", color: "text-red-700" }
            ]}
          />

          {/* Metabolic Assessment */}
          <ScoreSection
            title="Metabolic Status (0-15 points)"
            field="metabolic_score"
            currentScore={score.metabolic_score || 0}
            criteria={[
              { score: 0, description: "No metabolic disorders", color: "text-green-700" },
              { score: 3, description: "Well-controlled diabetes, normal thyroid", color: "text-yellow-700" },
              { score: 8, description: "Poorly controlled diabetes, thyroid disease", color: "text-orange-700" },
              { score: 12, description: "Diabetes with complications, severe electrolyte imbalance", color: "text-red-600" },
              { score: 15, description: "Diabetic ketoacidosis, severe metabolic derangement", color: "text-red-700" }
            ]}
          />

          {/* Functional Status */}
          <ScoreSection
            title="Functional Status (0-10 points)"
            field="functional_status_score"
            currentScore={score.functional_status_score || 0}
            criteria={[
              { score: 0, description: "Independent, >4 METs activity tolerance", color: "text-green-700" },
              { score: 2, description: "Partially dependent, 2-4 METs", color: "text-yellow-700" },
              { score: 5, description: "Dependent for some ADLs, <2 METs", color: "text-orange-700" },
              { score: 8, description: "Dependent for most ADLs, bedbound", color: "text-red-600" },
              { score: 10, description: "Completely dependent, severely debilitated", color: "text-red-700" }
            ]}
          />

          {/* Age Assessment */}
          <ScoreSection
            title="Age Factor (0-10 points)"
            field="age_score"
            currentScore={score.age_score || 0}
            criteria={[
              { score: 0, description: "Age <50 years", color: "text-green-700" },
              { score: 2, description: "Age 50-60 years", color: "text-yellow-700" },
              { score: 4, description: "Age 61-70 years", color: "text-orange-700" },
              { score: 7, description: "Age 71-80 years", color: "text-red-600" },
              { score: 10, description: "Age >80 years", color: "text-red-700" }
            ]}
          />
        </div>

        {/* Recommendations */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Clinical Recommendations and Optimization Plan
          </label>
          <textarea
            value={score.recommendations || ''}
            onChange={(e) => setScore(prev => ({ ...prev, recommendations: e.target.value }))}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Based on the risk assessment, provide recommendations for perioperative optimization, monitoring requirements, and risk mitigation strategies..."
          />
        </div>

        {/* Risk-specific recommendations */}
        <div className={`border rounded-lg p-4 ${getRiskBgColor(score.risk_category || 'low')}`}>
          <h4 className={`font-semibold mb-2 ${getRiskColor(score.risk_category || 'low')}`}>
            Risk-Specific Recommendations
          </h4>
          <div className="text-sm">
            {score.risk_category === 'low' && (
              <ul className="list-disc list-inside space-y-1 text-green-700">
                <li>Standard perioperative care appropriate</li>
                <li>Routine monitoring and recovery protocols</li>
                <li>Consider day surgery if procedure appropriate</li>
              </ul>
            )}
            {score.risk_category === 'moderate' && (
              <ul className="list-disc list-inside space-y-1 text-orange-700">
                <li>Enhanced perioperative monitoring required</li>
                <li>Consider preoperative optimization</li>
                <li>Extended recovery monitoring may be needed</li>
                <li>Anesthesia consultation recommended</li>
              </ul>
            )}
            {score.risk_category === 'high' && (
              <ul className="list-disc list-inside space-y-1 text-red-700">
                <li>Mandatory preoperative optimization</li>
                <li>Intensive monitoring and care required</li>
                <li>Consider less invasive alternatives</li>
                <li>Multidisciplinary team consultation essential</li>
                <li>ICU bed availability may be required</li>
              </ul>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={submitScore}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving Score...' : 'Save Fitness Score'}
          </button>
        </div>
      </div>
    </div>
  );
};