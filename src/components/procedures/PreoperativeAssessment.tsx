import React, { useState } from 'react';
import { procedureService, PreoperativeAssessment } from '../../services/procedureService';

interface PreoperativeAssessmentFormProps {
  patientId: string;
  procedureId: string;
  onComplete: (assessmentId: string) => void;
}

export const PreoperativeAssessmentForm: React.FC<PreoperativeAssessmentFormProps> = ({
  patientId,
  procedureId,
  onComplete
}) => {
  const [assessment, setAssessment] = useState<any>({
    patient_id: patientId,
    procedure_id: procedureId,
    assessment_date: new Date().toISOString().split('T')[0],
    medical_history: {
      past_surgeries: [],
      medications: [],
      allergies: [],
      chronic_conditions: [],
      family_history: []
    },
    physical_examination: {
      general_appearance: '',
      vital_signs: {
        blood_pressure: '',
        heart_rate: 0,
        respiratory_rate: 0,
        temperature: 0,
        oxygen_saturation: 0
      },
      cardiovascular: '',
      respiratory: '',
      airway_assessment: '',
      surgical_site_examination: ''
    },
    laboratory_results: {},
    risk_assessment: {
      asa_classification: 1,
      cardiac_risk: 'low',
      respiratory_risk: 'low',
      bleeding_risk: 'low',
      infection_risk: 'low',
      thrombosis_risk: 'low'
    },
    anesthesia_plan: {
      type: 'general',
      special_considerations: ''
    }
  });

  const [currentSection, setCurrentSection] = useState('medical_history');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (section: string, field: string, value: any) => {
    setAssessment(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof PreoperativeAssessment],
        [field]: value
      }
    }));
  };

  const handleVitalSignsChange = (field: string, value: number | string) => {
    setAssessment(prev => ({
      ...prev,
      physical_examination: {
        ...prev.physical_examination!,
        vital_signs: {
          ...prev.physical_examination!.vital_signs,
          [field]: value
        }
      }
    }));
  };

  const handleArrayFieldChange = (section: string, field: string, value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(Boolean);
    handleInputChange(section, field, items);
  };

  const submitAssessment = async () => {
    setIsSubmitting(true);
    try {
      const assessmentId = await procedureService.createPreoperativeAssessment(assessment as PreoperativeAssessment);
      onComplete(assessmentId);
    } catch (error) {
      console.error('Failed to save preoperative assessment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMedicalHistory = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Medical History</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Past Surgeries
          </label>
          <textarea
            value={assessment.medical_history?.past_surgeries?.join(', ') || ''}
            onChange={(e) => handleArrayFieldChange('medical_history', 'past_surgeries', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter past surgeries separated by commas"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Current Medications
          </label>
          <textarea
            value={assessment.medical_history?.medications?.join(', ') || ''}
            onChange={(e) => handleArrayFieldChange('medical_history', 'medications', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter medications separated by commas"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Allergies
          </label>
          <textarea
            value={assessment.medical_history?.allergies?.join(', ') || ''}
            onChange={(e) => handleArrayFieldChange('medical_history', 'allergies', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter allergies separated by commas"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chronic Conditions
          </label>
          <textarea
            value={assessment.medical_history?.chronic_conditions?.join(', ') || ''}
            onChange={(e) => handleArrayFieldChange('medical_history', 'chronic_conditions', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter chronic conditions separated by commas"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Family History
          </label>
          <textarea
            value={assessment.medical_history?.family_history?.join(', ') || ''}
            onChange={(e) => handleArrayFieldChange('medical_history', 'family_history', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Enter relevant family history separated by commas"
          />
        </div>
      </div>
    </div>
  );

  const renderPhysicalExamination = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Physical Examination</h3>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          General Appearance
        </label>
        <textarea
          value={assessment.physical_examination?.general_appearance || ''}
          onChange={(e) => handleInputChange('physical_examination', 'general_appearance', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Describe general appearance, nutritional status, distress level..."
        />
      </div>

      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">Vital Signs</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Blood Pressure
            </label>
            <input
              type="text"
              value={assessment.physical_examination?.vital_signs?.blood_pressure || ''}
              onChange={(e) => handleVitalSignsChange('blood_pressure', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="120/80"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heart Rate (bpm)
            </label>
            <input
              type="number"
              value={assessment.physical_examination?.vital_signs?.heart_rate || ''}
              onChange={(e) => handleVitalSignsChange('heart_rate', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="72"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Respiratory Rate
            </label>
            <input
              type="number"
              value={assessment.physical_examination?.vital_signs?.respiratory_rate || ''}
              onChange={(e) => handleVitalSignsChange('respiratory_rate', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="16"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={assessment.physical_examination?.vital_signs?.temperature || ''}
              onChange={(e) => handleVitalSignsChange('temperature', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="36.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              O2 Saturation (%)
            </label>
            <input
              type="number"
              value={assessment.physical_examination?.vital_signs?.oxygen_saturation || ''}
              onChange={(e) => handleVitalSignsChange('oxygen_saturation', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="98"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Cardiovascular Examination
          </label>
          <textarea
            value={assessment.physical_examination?.cardiovascular || ''}
            onChange={(e) => handleInputChange('physical_examination', 'cardiovascular', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Heart sounds, murmurs, peripheral pulses..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Respiratory Examination
          </label>
          <textarea
            value={assessment.physical_examination?.respiratory || ''}
            onChange={(e) => handleInputChange('physical_examination', 'respiratory', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Breath sounds, chest expansion, respiratory effort..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Airway Assessment
          </label>
          <textarea
            value={assessment.physical_examination?.airway_assessment || ''}
            onChange={(e) => handleInputChange('physical_examination', 'airway_assessment', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Mallampati score, neck mobility, dental issues..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Surgical Site Examination
          </label>
          <textarea
            value={assessment.physical_examination?.surgical_site_examination || ''}
            onChange={(e) => handleInputChange('physical_examination', 'surgical_site_examination', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Local anatomy, previous scars, skin condition..."
          />
        </div>
      </div>
    </div>
  );

  const [riskAssessmentStep, setRiskAssessmentStep] = useState(0);

  const riskAssessmentSteps = [
    'ASA Classification',
    'Cardiac Risk',
    'Respiratory Risk',
    'Bleeding Risk',
    'Infection Risk',
    'Thrombosis Risk'
  ];

  const renderRiskAssessmentStep = () => {
    switch (riskAssessmentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">ASA Physical Status Classification</h4>
                  <p className="mt-1 text-sm text-blue-700">
                    American Society of Anesthesiologists classification system for assessing patient physical status
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select ASA Classification
              </label>
              <div className="space-y-3">
                {[
                  { value: 1, label: 'ASA I', description: 'Normal healthy patient - No organic, physiologic, or psychiatric disturbance' },
                  { value: 2, label: 'ASA II', description: 'Mild systemic disease - Well-controlled conditions (e.g., controlled HTN, mild asthma)' },
                  { value: 3, label: 'ASA III', description: 'Severe systemic disease - Substantive functional limitations (e.g., poorly controlled DM, COPD)' },
                  { value: 4, label: 'ASA IV', description: 'Severe disease with constant threat to life - Recent MI, severe cardiac disease' },
                  { value: 5, label: 'ASA V', description: 'Moribund patient not expected to survive without operation' },
                  { value: 6, label: 'ASA VI', description: 'Brain-dead patient whose organs are being removed for donor purposes' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      assessment.risk_assessment?.asa_classification === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="asa_classification"
                      value={option.value}
                      checked={assessment.risk_assessment?.asa_classification === option.value}
                      onChange={(e) => handleInputChange('risk_assessment', 'asa_classification', parseInt(e.target.value))}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-red-800">Cardiac Risk Assessment</h4>
                  <p className="mt-1 text-sm text-red-700">
                    Evaluate cardiovascular risk factors for perioperative complications
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Cardiac Risk Level
              </label>
              <div className="space-y-3">
                {[
                  { value: 'low', label: 'Low Risk', description: 'No known cardiac disease, normal ECG, age <65, minor surgery', color: 'green' },
                  { value: 'intermediate', label: 'Intermediate Risk', description: 'Stable angina, prior MI >6 months, controlled CHF, DM, age >65', color: 'yellow' },
                  { value: 'high', label: 'High Risk', description: 'Unstable angina, recent MI <6 months, decompensated CHF, severe valvular disease', color: 'red' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      assessment.risk_assessment?.cardiac_risk === option.value
                        ? `border-${option.color}-500 bg-${option.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="cardiac_risk"
                      value={option.value}
                      checked={assessment.risk_assessment?.cardiac_risk === option.value}
                      onChange={(e) => handleInputChange('risk_assessment', 'cardiac_risk', e.target.value)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="bg-teal-50 border-l-4 border-teal-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-teal-800">Respiratory Risk Assessment</h4>
                  <p className="mt-1 text-sm text-teal-700">
                    Evaluate pulmonary risk factors and airway complications
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Respiratory Risk Level
              </label>
              <div className="space-y-3">
                {[
                  { value: 'low', label: 'Low Risk', description: 'No respiratory disease, non-smoker, normal SpO2, minor surgery' },
                  { value: 'intermediate', label: 'Intermediate Risk', description: 'Controlled asthma/COPD, ex-smoker, moderate surgery, age >60' },
                  { value: 'high', label: 'High Risk', description: 'Severe COPD/asthma, active smoker, major thoracic/abdominal surgery, obstructive sleep apnea' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      assessment.risk_assessment?.respiratory_risk === option.value
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="respiratory_risk"
                      value={option.value}
                      checked={assessment.risk_assessment?.respiratory_risk === option.value}
                      onChange={(e) => handleInputChange('risk_assessment', 'respiratory_risk', e.target.value)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-purple-800">Bleeding Risk Assessment</h4>
                  <p className="mt-1 text-sm text-purple-700">
                    Assess risk of perioperative hemorrhage and coagulation disorders
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Bleeding Risk Level
              </label>
              <div className="space-y-3">
                {[
                  { value: 'low', label: 'Low Risk', description: 'No bleeding history, normal coagulation, no anticoagulants, minor surgery' },
                  { value: 'intermediate', label: 'Intermediate Risk', description: 'Aspirin use, mild thrombocytopenia, liver disease, moderate surgery' },
                  { value: 'high', label: 'High Risk', description: 'Active anticoagulation, severe thrombocytopenia, hemophilia, major vascular surgery' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      assessment.risk_assessment?.bleeding_risk === option.value
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bleeding_risk"
                      value={option.value}
                      checked={assessment.risk_assessment?.bleeding_risk === option.value}
                      onChange={(e) => handleInputChange('risk_assessment', 'bleeding_risk', e.target.value)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-orange-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-orange-800">Infection Risk Assessment</h4>
                  <p className="mt-1 text-sm text-orange-700">
                    Evaluate risk of surgical site infections and septic complications
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Infection Risk Level
              </label>
              <div className="space-y-3">
                {[
                  { value: 'low', label: 'Low Risk', description: 'Clean surgery, good nutrition, no diabetes, short procedure, proper sterile technique' },
                  { value: 'intermediate', label: 'Intermediate Risk', description: 'Clean-contaminated surgery, controlled diabetes, obesity, longer procedure' },
                  { value: 'high', label: 'High Risk', description: 'Contaminated/dirty surgery, immunosuppression, malnutrition, emergency surgery, prolonged procedure' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      assessment.risk_assessment?.infection_risk === option.value
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="infection_risk"
                      value={option.value}
                      checked={assessment.risk_assessment?.infection_risk === option.value}
                      onChange={(e) => handleInputChange('risk_assessment', 'infection_risk', e.target.value)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-indigo-800">Thrombosis Risk Assessment</h4>
                  <p className="mt-1 text-sm text-indigo-700">
                    Evaluate risk of deep vein thrombosis (DVT) and pulmonary embolism (PE)
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Thrombosis Risk Level
              </label>
              <div className="space-y-3">
                {[
                  { value: 'low', label: 'Low Risk', description: 'Age <40, minor surgery <30min, no VTE history, mobile, no risk factors' },
                  { value: 'intermediate', label: 'Intermediate Risk', description: 'Age 40-60, major surgery, obesity, varicose veins, oral contraceptives' },
                  { value: 'high', label: 'High Risk', description: 'Age >60, cancer, previous VTE, prolonged immobility, hypercoagulable state, major pelvic/orthopedic surgery' }
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all ${
                      assessment.risk_assessment?.thrombosis_risk === option.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="thrombosis_risk"
                      value={option.value}
                      checked={assessment.risk_assessment?.thrombosis_risk === option.value}
                      onChange={(e) => handleInputChange('risk_assessment', 'thrombosis_risk', e.target.value)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <span className="font-semibold text-gray-900">{option.label}</span>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const renderRiskAssessment = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Risk Assessment</h3>

      {/* Progress Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {riskAssessmentStep + 1} of {riskAssessmentSteps.length}
          </span>
          <span className="text-sm text-gray-500">
            {riskAssessmentSteps[riskAssessmentStep]}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((riskAssessmentStep + 1) / riskAssessmentSteps.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-between mb-6">
        {riskAssessmentSteps.map((step, index) => (
          <div
            key={index}
            className={`flex flex-col items-center ${index === riskAssessmentStep ? 'opacity-100' : 'opacity-50'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                index < riskAssessmentStep
                  ? 'bg-green-500 text-white'
                  : index === riskAssessmentStep
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}
            >
              {index < riskAssessmentStep ? '✓' : index + 1}
            </div>
            <span className="text-xs mt-1 text-center hidden md:block">{step.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      {/* Current Step Content */}
      {renderRiskAssessmentStep()}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={() => setRiskAssessmentStep(prev => Math.max(0, prev - 1))}
          disabled={riskAssessmentStep === 0}
          className={`px-4 py-2 rounded-md font-medium ${
            riskAssessmentStep === 0
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-600 text-white hover:bg-gray-700'
          }`}
        >
          ← Previous
        </button>
        
        {riskAssessmentStep < riskAssessmentSteps.length - 1 ? (
          <button
            onClick={() => setRiskAssessmentStep(prev => Math.min(riskAssessmentSteps.length - 1, prev + 1))}
            className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={() => setCurrentSection('anesthesia')}
            className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700"
          >
            Complete Risk Assessment ✓
          </button>
        )}
      </div>

      {/* Old grid layout kept for reference but hidden */}
      <div className="hidden">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thrombosis Risk
          </label>
          <select
            value={assessment.risk_assessment?.thrombosis_risk || 'low'}
            onChange={(e) => handleInputChange('risk_assessment', 'thrombosis_risk', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low Risk</option>
            <option value="intermediate">Intermediate Risk</option>
            <option value="high">High Risk</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderAnesthesiaPlan = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Anesthesia Plan</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Anesthesia Type
          </label>
          <select
            value={assessment.anesthesia_plan?.type || 'general'}
            onChange={(e) => handleInputChange('anesthesia_plan', 'type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="general">General Anesthesia</option>
            <option value="regional">Regional Anesthesia</option>
            <option value="local">Local Anesthesia</option>
            <option value="sedation">Sedation</option>
            <option value="combined">Combined Technique</option>
          </select>
        </div>

        <div className="md:col-span-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Special Considerations
          </label>
          <textarea
            value={assessment.anesthesia_plan?.special_considerations || ''}
            onChange={(e) => handleInputChange('anesthesia_plan', 'special_considerations', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Difficult airway, positioning, monitoring requirements..."
          />
        </div>
      </div>
    </div>
  );

  const sections = [
    { id: 'medical_history', name: 'Medical History', icon: '📋' },
    { id: 'physical_examination', name: 'Physical Examination', icon: '🔍' },
    { id: 'risk_assessment', name: 'Risk Assessment', icon: '⚠️' },
    { id: 'anesthesia_plan', name: 'Anesthesia Plan', icon: '💉' }
  ];

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'medical_history':
        return renderMedicalHistory();
      case 'physical_examination':
        return renderPhysicalExamination();
      case 'risk_assessment':
        return renderRiskAssessment();
      case 'anesthesia_plan':
        return renderAnesthesiaPlan();
      default:
        return renderMedicalHistory();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Preoperative Assessment</h2>
            <p className="text-gray-600 mt-1">Comprehensive patient evaluation before surgery</p>
          </div>
          
          <div className="text-sm text-gray-500">
            Assessment Date: {assessment.assessment_date}
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                currentSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {renderCurrentSection()}

        <div className="mt-8 flex justify-between">
          <button
            onClick={() => {
              const currentIndex = sections.findIndex(s => s.id === currentSection);
              if (currentIndex > 0) {
                setCurrentSection(sections[currentIndex - 1].id);
              }
            }}
            disabled={sections.findIndex(s => s.id === currentSection) === 0}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Section
          </button>
          
          {sections.findIndex(s => s.id === currentSection) === sections.length - 1 ? (
            <button
              onClick={submitAssessment}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving Assessment...' : 'Complete Assessment'}
            </button>
          ) : (
            <button
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === currentSection);
                if (currentIndex < sections.length - 1) {
                  setCurrentSection(sections[currentIndex + 1].id);
                }
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Next Section
            </button>
          )}
        </div>
      </div>
    </div>
  );
};