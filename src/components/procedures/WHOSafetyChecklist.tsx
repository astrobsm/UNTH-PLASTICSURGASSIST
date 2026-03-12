import React, { useState, useEffect } from 'react';
import { procedureService, WHOSafetyChecklist } from '../../services/procedureService';
import { getCurrentUserName } from '../../utils/getCurrentUser';

interface WHOSafetyChecklistFormProps {
  procedureId: string;
  onComplete: (checklistId: string) => void;
}

export const WHOSafetyChecklistForm: React.FC<WHOSafetyChecklistFormProps> = ({
  procedureId,
  onComplete
}) => {
  const [checklist, setChecklist] = useState<Partial<WHOSafetyChecklist>>({
    procedure_id: procedureId,
    sign_in: {
      patient_identity_confirmed: false,
      site_marked: false,
      anesthesia_safety_check_completed: false,
      pulse_oximeter_on_patient: false,
      patient_allergies: [],
      airway_difficulty_risk: false,
      blood_loss_risk: false,
      verified_by: '',
      timestamp: '',
      notes: ''
    },
    time_out: {
      team_introductions_completed: false,
      patient_identity_reconfirmed: false,
      procedure_site_confirmed: false,
      anticipated_critical_events: '',
      antibiotic_prophylaxis_given: false,
      essential_imaging_displayed: false,
      verified_by: '',
      timestamp: '',
      notes: ''
    },
    sign_out: {
      procedure_name_recorded: false,
      instrument_sponge_needle_counts_correct: false,
      specimen_labeled: false,
      equipment_problems_identified: false,
      key_concerns_for_recovery: '',
      verified_by: '',
      timestamp: '',
      notes: ''
    }
  });

  const [currentPhase, setCurrentPhase] = useState<'sign_in' | 'time_out' | 'sign_out'>('sign_in');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignInChange = (field: string, value: any) => {
    setChecklist(prev => ({
      ...prev,
      sign_in: {
        ...prev.sign_in!,
        [field]: value
      }
    }));
  };

  const handleTimeOutChange = (field: string, value: any) => {
    setChecklist(prev => ({
      ...prev,
      time_out: {
        ...prev.time_out!,
        [field]: value
      }
    }));
  };

  const handleSignOutChange = (field: string, value: any) => {
    setChecklist(prev => ({
      ...prev,
      sign_out: {
        ...prev.sign_out!,
        [field]: value
      }
    }));
  };

  const completePhase = async () => {
    const timestamp = new Date().toISOString();
    const verifiedBy = getCurrentUserName();

    if (currentPhase === 'sign_in') {
      handleSignInChange('timestamp', timestamp);
      handleSignInChange('verified_by', verifiedBy);
      setCurrentPhase('time_out');
    } else if (currentPhase === 'time_out') {
      handleTimeOutChange('timestamp', timestamp);
      handleTimeOutChange('verified_by', verifiedBy);
      setCurrentPhase('sign_out');
    } else {
      handleSignOutChange('timestamp', timestamp);
      handleSignOutChange('verified_by', verifiedBy);
      await submitChecklist();
    }
  };

  const submitChecklist = async () => {
    setIsSubmitting(true);
    try {
      const checklistId = await procedureService.createWHOSafetyChecklist(checklist as WHOSafetyChecklist);
      onComplete(checklistId);
    } catch (error) {
      console.error('Failed to save WHO checklist:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSignInPhase = () => (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Sign In - Before Induction of Anesthesia</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="patient_identity"
              checked={checklist.sign_in?.patient_identity_confirmed}
              onChange={(e) => handleSignInChange('patient_identity_confirmed', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="patient_identity" className="ml-3 text-sm font-medium text-gray-900">
              Patient has confirmed: identity, site, procedure, and consent
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="site_marked"
              checked={checklist.sign_in?.site_marked}
              onChange={(e) => handleSignInChange('site_marked', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="site_marked" className="ml-3 text-sm font-medium text-gray-900">
              Site marked (if applicable)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="anesthesia_check"
              checked={checklist.sign_in?.anesthesia_safety_check_completed}
              onChange={(e) => handleSignInChange('anesthesia_safety_check_completed', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="anesthesia_check" className="ml-3 text-sm font-medium text-gray-900">
              Anesthesia safety check completed
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="pulse_oximeter"
              checked={checklist.sign_in?.pulse_oximeter_on_patient}
              onChange={(e) => handleSignInChange('pulse_oximeter_on_patient', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="pulse_oximeter" className="ml-3 text-sm font-medium text-gray-900">
              Pulse oximeter on patient and functioning
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="airway_risk"
              checked={checklist.sign_in?.airway_difficulty_risk}
              onChange={(e) => handleSignInChange('airway_difficulty_risk', e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="airway_risk" className="ml-3 text-sm font-medium text-gray-900">
              Does patient have difficulty with airway or aspiration risk?
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="blood_loss_risk"
              checked={checklist.sign_in?.blood_loss_risk}
              onChange={(e) => handleSignInChange('blood_loss_risk', e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="blood_loss_risk" className="ml-3 text-sm font-medium text-gray-900">
              Risk of &gt;500ml blood loss (7ml/kg in children)?
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Patient Allergies
            </label>
            <textarea
              value={checklist.sign_in?.patient_allergies?.join(', ') || ''}
              onChange={(e) => handleSignInChange('patient_allergies', e.target.value.split(', ').filter(Boolean))}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Enter allergies separated by commas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={checklist.sign_in?.notes || ''}
              onChange={(e) => handleSignInChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderTimeOutPhase = () => (
    <div className="space-y-6">
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-orange-900 mb-4">Time Out - Before Skin Incision</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="team_introductions"
              checked={checklist.time_out?.team_introductions_completed}
              onChange={(e) => handleTimeOutChange('team_introductions_completed', e.target.checked)}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="team_introductions" className="ml-3 text-sm font-medium text-gray-900">
              Confirm all team members have introduced themselves by name and role
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="patient_reconfirmed"
              checked={checklist.time_out?.patient_identity_reconfirmed}
              onChange={(e) => handleTimeOutChange('patient_identity_reconfirmed', e.target.checked)}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="patient_reconfirmed" className="ml-3 text-sm font-medium text-gray-900">
              Confirm patient identity, site, and procedure
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="procedure_site_confirmed"
              checked={checklist.time_out?.procedure_site_confirmed}
              onChange={(e) => handleTimeOutChange('procedure_site_confirmed', e.target.checked)}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="procedure_site_confirmed" className="ml-3 text-sm font-medium text-gray-900">
              Procedure site confirmed
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="antibiotic_prophylaxis"
              checked={checklist.time_out?.antibiotic_prophylaxis_given}
              onChange={(e) => handleTimeOutChange('antibiotic_prophylaxis_given', e.target.checked)}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="antibiotic_prophylaxis" className="ml-3 text-sm font-medium text-gray-900">
              Antibiotic prophylaxis given within the last 60 minutes?
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="imaging_displayed"
              checked={checklist.time_out?.essential_imaging_displayed}
              onChange={(e) => handleTimeOutChange('essential_imaging_displayed', e.target.checked)}
              className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
            />
            <label htmlFor="imaging_displayed" className="ml-3 text-sm font-medium text-gray-900">
              Essential imaging displayed (if applicable)
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anticipated Critical Events (Surgeon, Anesthesiologist, Nursing)
            </label>
            <textarea
              value={checklist.time_out?.anticipated_critical_events || ''}
              onChange={(e) => handleTimeOutChange('anticipated_critical_events', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
              placeholder="Describe anticipated critical events, recovery concerns, equipment issues..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={checklist.time_out?.notes || ''}
              onChange={(e) => handleTimeOutChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500"
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSignOutPhase = () => (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-green-900 mb-4">Sign Out - Before Patient Leaves Operating Room</h3>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="procedure_recorded"
              checked={checklist.sign_out?.procedure_name_recorded}
              onChange={(e) => handleSignOutChange('procedure_name_recorded', e.target.checked)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="procedure_recorded" className="ml-3 text-sm font-medium text-gray-900">
              The name of the procedure recorded
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="counts_correct"
              checked={checklist.sign_out?.instrument_sponge_needle_counts_correct}
              onChange={(e) => handleSignOutChange('instrument_sponge_needle_counts_correct', e.target.checked)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="counts_correct" className="ml-3 text-sm font-medium text-gray-900">
              Instrument, sponge, and needle counts correct (or not applicable)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="specimen_labeled"
              checked={checklist.sign_out?.specimen_labeled}
              onChange={(e) => handleSignOutChange('specimen_labeled', e.target.checked)}
              className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
            />
            <label htmlFor="specimen_labeled" className="ml-3 text-sm font-medium text-gray-900">
              Specimen labeled (including patient name)
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="equipment_problems"
              checked={checklist.sign_out?.equipment_problems_identified}
              onChange={(e) => handleSignOutChange('equipment_problems_identified', e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <label htmlFor="equipment_problems" className="ml-3 text-sm font-medium text-gray-900">
              Are there any equipment problems to be addressed?
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Key Concerns for Recovery and Management of Patient
            </label>
            <textarea
              value={checklist.sign_out?.key_concerns_for_recovery || ''}
              onChange={(e) => handleSignOutChange('key_concerns_for_recovery', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Describe key concerns for recovery, pain management, monitoring requirements..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={checklist.sign_out?.notes || ''}
              onChange={(e) => handleSignOutChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500"
              placeholder="Additional notes..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  const getPhaseColor = (phase: string) => {
    if (phase === 'sign_in') return 'blue';
    if (phase === 'time_out') return 'orange';
    return 'green';
  };

  const isPhaseComplete = (phase: string) => {
    if (phase === 'sign_in' && currentPhase !== 'sign_in') return true;
    if (phase === 'time_out' && currentPhase === 'sign_out') return true;
    return false;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">WHO Surgical Safety Checklist</h2>
            <p className="text-gray-600 mt-1">World Health Organization safety protocols</p>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center space-x-2">
            {['sign_in', 'time_out', 'sign_out'].map((phase, index) => (
              <div key={phase} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  isPhaseComplete(phase)
                    ? 'bg-green-500 text-white'
                    : currentPhase === phase
                    ? `bg-${getPhaseColor(phase)}-500 text-white`
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {isPhaseComplete(phase) ? '✓' : index + 1}
                </div>
                {index < 2 && (
                  <div className={`w-8 h-0.5 ${
                    isPhaseComplete(phase) ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6">
        {currentPhase === 'sign_in' && renderSignInPhase()}
        {currentPhase === 'time_out' && renderTimeOutPhase()}
        {currentPhase === 'sign_out' && renderSignOutPhase()}

        <div className="mt-8 flex justify-between">
          <button
            onClick={() => {
              if (currentPhase === 'time_out') setCurrentPhase('sign_in');
              if (currentPhase === 'sign_out') setCurrentPhase('time_out');
            }}
            disabled={currentPhase === 'sign_in'}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Phase
          </button>
          
          <button
            onClick={completePhase}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded-md text-white font-semibold ${
              currentPhase === 'sign_out'
                ? 'bg-green-600 hover:bg-green-700'
                : `bg-${getPhaseColor(currentPhase)}-600 hover:bg-${getPhaseColor(currentPhase)}-700`
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isSubmitting ? 'Saving...' : currentPhase === 'sign_out' ? 'Complete Checklist' : 'Complete Phase'}
          </button>
        </div>
      </div>
    </div>
  );
};