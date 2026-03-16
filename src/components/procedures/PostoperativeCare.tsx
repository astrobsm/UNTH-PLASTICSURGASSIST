import React, { useState } from 'react';
import { procedureService, PostoperativeCare } from '../../services/procedureService';

interface PostoperativeCareFormProps {
  patientId: string;
  procedureId: string;
  onComplete: (careId: string) => void;
}

export const PostoperativeCareForm: React.FC<PostoperativeCareFormProps> = ({
  patientId,
  procedureId,
  onComplete
}) => {
  const [care, setCare] = useState<Partial<PostoperativeCare>>({
    patient_id: patientId,
    procedure_id: procedureId,
    care_date: new Date().toISOString().split('T')[0],
    pacu_assessment: {
      arrival_time: '',
      consciousness_level: 'alert',
      pain_score: 0,
      vital_signs: {
        blood_pressure: '',
        heart_rate: 0,
        respiratory_rate: 0,
        temperature: 0,
        oxygen_saturation: 0
      },
      surgical_site_status: '',
      drainage_output: 0,
      discharge_criteria_met: false,
      discharge_time: '',
      notes: ''
    },
    ward_care_plan: {
      activity_level: 'bed_rest',
      diet_orders: 'npo',
      pain_management: '',
      wound_care_instructions: '',
      medications: [],
      monitoring_requirements: [],
      drain_management: '',
      patient_education: '',
      discharge_planning: ''
    },
    daily_assessments: [],
    complications: [],
    discharge_summary: {
      discharge_date: '',
      condition_at_discharge: '',
      follow_up_instructions: '',
      medications_prescribed: [],
      activity_restrictions: '',
      warning_signs: '',
      next_appointment: ''
    }
  });

  const [currentSection, setCurrentSection] = useState('pacu');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dailyAssessmentDate, setDailyAssessmentDate] = useState('');

  const handleInputChange = (field: string, value: any) => {
    setCare(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (section: string, field: string, value: any) => {
    setCare(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof PostoperativeCare],
        [field]: value
      }
    }));
  };

  const handleVitalSignsChange = (section: string, field: string, value: number | string) => {
    setCare(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof PostoperativeCare],
        vital_signs: {
          ...((prev[section as keyof PostoperativeCare] as any)?.vital_signs || {}),
          [field]: value
        }
      }
    }));
  };

  const handleArrayFieldChange = (section: string, field: string, value: string) => {
    const items = value.split('\n').map(item => item.trim()).filter(Boolean);
    handleNestedInputChange(section, field, items);
  };

  const addDailyAssessment = () => {
    if (!dailyAssessmentDate) return;
    
    const newAssessment = {
      date: dailyAssessmentDate,
      pain_score: 0,
      vital_signs: {
        blood_pressure: '',
        heart_rate: 0,
        respiratory_rate: 0,
        temperature: 0,
        oxygen_saturation: 0
      },
      wound_status: '',
      drainage_output: 0,
      mobility: '',
      appetite: '',
      bowel_function: '',
      complications: '',
      plan: '',
      notes: ''
    };

    setCare(prev => ({
      ...prev,
      daily_assessments: [...(prev.daily_assessments || []), newAssessment]
    }));
    
    setDailyAssessmentDate('');
  };

  const updateDailyAssessment = (index: number, field: string, value: any) => {
    setCare(prev => ({
      ...prev,
      daily_assessments: prev.daily_assessments?.map((assessment, i) => 
        i === index ? { ...assessment, [field]: value } : assessment
      ) || []
    }));
  };

  const updateDailyAssessmentVitals = (index: number, field: string, value: number | string) => {
    setCare(prev => ({
      ...prev,
      daily_assessments: prev.daily_assessments?.map((assessment, i) => 
        i === index ? {
          ...assessment,
          vital_signs: {
            ...assessment.vital_signs,
            [field]: value
          }
        } : assessment
      ) || []
    }));
  };

  const submitCare = async () => {
    setIsSubmitting(true);
    try {
      const careId = await procedureService.createPostoperativeCare(care as PostoperativeCare);
      onComplete(careId);
    } catch (error) {
      console.error('Failed to save postoperative care:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPACU = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">PACU Assessment</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Arrival Time
          </label>
          <input
            type="time"
            value={care.pacu_assessment?.arrival_time || ''}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'arrival_time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discharge Time
          </label>
          <input
            type="time"
            value={care.pacu_assessment?.discharge_time || ''}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'discharge_time', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Consciousness Level
          </label>
          <select
            value={care.pacu_assessment?.consciousness_level || 'alert'}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'consciousness_level', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="alert">Alert and Oriented</option>
            <option value="drowsy">Drowsy but Responsive</option>
            <option value="sedated">Sedated</option>
            <option value="confused">Confused</option>
            <option value="unresponsive">Unresponsive</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pain Score (0-10)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={care.pacu_assessment?.pain_score || ''}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'pain_score', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Drainage Output (mL)
          </label>
          <input
            type="number"
            value={care.pacu_assessment?.drainage_output || ''}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'drainage_output', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="discharge_criteria"
            checked={care.pacu_assessment?.discharge_criteria_met || false}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'discharge_criteria_met', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="discharge_criteria" className="ml-3 text-sm font-medium text-gray-700">
            Discharge Criteria Met
          </label>
        </div>
      </div>

      <div>
        <h4 className="text-md font-semibold text-gray-800 mb-3">PACU Vital Signs</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Blood Pressure
            </label>
            <input
              type="text"
              value={care.pacu_assessment?.vital_signs?.blood_pressure || ''}
              onChange={(e) => handleVitalSignsChange('pacu_assessment', 'blood_pressure', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="120/80"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heart Rate
            </label>
            <input
              type="number"
              value={care.pacu_assessment?.vital_signs?.heart_rate || ''}
              onChange={(e) => handleVitalSignsChange('pacu_assessment', 'heart_rate', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Respiratory Rate
            </label>
            <input
              type="number"
              value={care.pacu_assessment?.vital_signs?.respiratory_rate || ''}
              onChange={(e) => handleVitalSignsChange('pacu_assessment', 'respiratory_rate', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Temperature (°C)
            </label>
            <input
              type="number"
              step="0.1"
              value={care.pacu_assessment?.vital_signs?.temperature || ''}
              onChange={(e) => handleVitalSignsChange('pacu_assessment', 'temperature', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              O2 Saturation (%)
            </label>
            <input
              type="number"
              value={care.pacu_assessment?.vital_signs?.oxygen_saturation || ''}
              onChange={(e) => handleVitalSignsChange('pacu_assessment', 'oxygen_saturation', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Surgical Site Status
          </label>
          <textarea
            value={care.pacu_assessment?.surgical_site_status || ''}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'surgical_site_status', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Describe wound appearance, dressings, drains..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PACU Notes
          </label>
          <textarea
            value={care.pacu_assessment?.notes || ''}
            onChange={(e) => handleNestedInputChange('pacu_assessment', 'notes', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Additional PACU observations and interventions..."
          />
        </div>
      </div>
    </div>
  );

  const renderWardCare = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Ward Care Plan</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Activity Level
          </label>
          <select
            value={care.ward_care_plan?.activity_level || 'bed_rest'}
            onChange={(e) => handleNestedInputChange('ward_care_plan', 'activity_level', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="bed_rest">Bed Rest</option>
            <option value="chair_transfer">Chair Transfer</option>
            <option value="ambulate_assist">Ambulate with Assistance</option>
            <option value="ambulate_independent">Ambulate Independently</option>
            <option value="full_activity">Full Activity</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Diet Orders
          </label>
          <select
            value={care.ward_care_plan?.diet_orders || 'npo'}
            onChange={(e) => handleNestedInputChange('ward_care_plan', 'diet_orders', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="npo">NPO (Nothing by Mouth)</option>
            <option value="clear_liquids">Clear Liquids</option>
            <option value="full_liquids">Full Liquids</option>
            <option value="soft_diet">Soft Diet</option>
            <option value="regular_diet">Regular Diet</option>
            <option value="diabetic_diet">Diabetic Diet</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Pain Management Plan
        </label>
        <textarea
          value={care.ward_care_plan?.pain_management || ''}
          onChange={(e) => handleNestedInputChange('ward_care_plan', 'pain_management', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Pain medications, dosing schedule, breakthrough pain management..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Wound Care Instructions
        </label>
        <textarea
          value={care.ward_care_plan?.wound_care_instructions || ''}
          onChange={(e) => handleNestedInputChange('ward_care_plan', 'wound_care_instructions', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Dressing changes, wound monitoring, care frequency..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Medications (One per line)
          </label>
          <textarea
            value={care.ward_care_plan?.medications?.join('\n') || ''}
            onChange={(e) => handleArrayFieldChange('ward_care_plan', 'medications', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder={`Paracetamol 1g QID
Ibuprofen 400mg TID
Antibiotics as prescribed...`}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Monitoring Requirements (One per line)
          </label>
          <textarea
            value={care.ward_care_plan?.monitoring_requirements?.join('\n') || ''}
            onChange={(e) => handleArrayFieldChange('ward_care_plan', 'monitoring_requirements', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder={`Vital signs Q4H
Pain assessment Q2H
Drain output monitoring...`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Drain Management
          </label>
          <textarea
            value={care.ward_care_plan?.drain_management || ''}
            onChange={(e) => handleNestedInputChange('ward_care_plan', 'drain_management', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Drain care, output monitoring, removal criteria..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Patient Education
          </label>
          <textarea
            value={care.ward_care_plan?.patient_education || ''}
            onChange={(e) => handleNestedInputChange('ward_care_plan', 'patient_education', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Education topics covered, understanding assessed..."
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Discharge Planning
        </label>
        <textarea
          value={care.ward_care_plan?.discharge_planning || ''}
          onChange={(e) => handleNestedInputChange('ward_care_plan', 'discharge_planning', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Discharge criteria, home care arrangements, follow-up appointments..."
        />
      </div>
    </div>
  );

  const renderDailyAssessments = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Daily Assessments</h3>
        
        <div className="flex items-center space-x-2">
          <input
            type="date"
            value={dailyAssessmentDate}
            onChange={(e) => setDailyAssessmentDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={addDailyAssessment}
            disabled={!dailyAssessmentDate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Add Assessment
          </button>
        </div>
      </div>

      {care.daily_assessments && care.daily_assessments.length > 0 ? (
        <div className="space-y-6">
          {care.daily_assessments.map((assessment, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Assessment - {assessment.date}</h4>
                <button
                  onClick={() => {
                    setCare(prev => ({
                      ...prev,
                      daily_assessments: prev.daily_assessments?.filter((_, i) => i !== index) || []
                    }));
                  }}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pain Score (0-10)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={assessment.pain_score}
                    onChange={(e) => updateDailyAssessment(index, 'pain_score', parseInt(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BP
                  </label>
                  <input
                    type="text"
                    value={assessment.vital_signs.blood_pressure}
                    onChange={(e) => updateDailyAssessmentVitals(index, 'blood_pressure', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                    placeholder="120/80"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HR
                  </label>
                  <input
                    type="number"
                    value={assessment.vital_signs.heart_rate}
                    onChange={(e) => updateDailyAssessmentVitals(index, 'heart_rate', parseInt(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temp (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={assessment.vital_signs.temperature}
                    onChange={(e) => updateDailyAssessmentVitals(index, 'temperature', parseFloat(e.target.value))}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wound Status
                  </label>
                  <textarea
                    value={assessment.wound_status}
                    onChange={(e) => updateDailyAssessment(index, 'wound_status', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                    placeholder="Wound appearance, healing progress..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Plan & Notes
                  </label>
                  <textarea
                    value={assessment.plan}
                    onChange={(e) => updateDailyAssessment(index, 'plan', e.target.value)}
                    rows={2}
                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                    placeholder="Plan for today, changes needed..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No daily assessments recorded yet.</p>
          <p className="text-sm text-gray-400 mt-1">Add an assessment using the date picker above.</p>
        </div>
      )}
    </div>
  );

  const sections = [
    { id: 'pacu', name: 'PACU Assessment', icon: '🏥' },
    { id: 'ward_care', name: 'Ward Care Plan', icon: '📋' },
    { id: 'daily_assessments', name: 'Daily Assessments', icon: '📊' }
  ];

  const renderCurrentSection = () => {
    switch (currentSection) {
      case 'pacu':
        return renderPACU();
      case 'ward_care':
        return renderWardCare();
      case 'daily_assessments':
        return renderDailyAssessments();
      default:
        return renderPACU();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Postoperative Care</h2>
            <p className="text-gray-600 mt-1">Recovery tracking and care plan management</p>
          </div>
          
          <div className="text-sm text-gray-500">
            Care Date: {care.care_date}
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
              onClick={submitCare}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving Care Plan...' : 'Save Care Plan'}
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