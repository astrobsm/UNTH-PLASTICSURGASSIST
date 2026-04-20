import React, { useState, useEffect } from 'react';
import { unthPatientService, DischargeDetails } from '../services/unthPatientService';
import { userManagementService, ApprovedUser } from '../services/userManagementService';

interface DischargePlanningProps {
  patientId: string;
  onDischargeComplete?: (dischargeId: string) => void;
}

export const DischargePlanning: React.FC<DischargePlanningProps> = ({
  patientId,
  onDischargeComplete
}) => {
  const [dischargeData, setDischargeData] = useState<Partial<DischargeDetails>>({
    patient_id: patientId,
    discharge_type: 'home',
    final_diagnosis: [],
    procedures_performed: [],
    medications_on_discharge: [],
    follow_up_instructions: [],
    activity_restrictions: [],
    warning_signs: [],
    certificates_issued: [],
    patient_counseled: false,
    relative_counseled: false
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [aiGeneratedContent, setAiGeneratedContent] = useState<any>(null);
  const [consultants, setConsultants] = useState<ApprovedUser[]>([]);

  useEffect(() => {
    const loadConsultants = async () => {
      try {
        const allUsers = await userManagementService.getAllApprovedUsers();
        setConsultants(allUsers.filter(u => u.role === 'consultant'));
      } catch (err) {
        console.error('Failed to load consultants:', err);
      }
    };
    loadConsultants();
  }, []);

  const generateAIContent = async () => {
    setIsGenerating(true);
    try {
      const dischargePlan = await unthPatientService.generateDischargePlan(
        patientId,
        dischargeData.discharge_type || 'home'
      );
      setAiGeneratedContent(dischargePlan);
      setDischargeData(prev => ({ ...prev, ...dischargePlan }));
    } catch (error) {
      console.error('Failed to generate discharge content:', error);
      alert('Failed to generate AI discharge content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleArrayAdd = (field: string, value: string) => {
    if (value.trim()) {
      setDischargeData(prev => ({
        ...prev,
        [field]: [...((prev as any)[field] || []), value.trim()]
      }));
    }
  };

  const handleArrayRemove = (field: string, index: number) => {
    setDischargeData(prev => ({
      ...prev,
      [field]: ((prev as any)[field] || []).filter((_: any, i: number) => i !== index)
    }));
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Discharge Type & Diagnosis</h3>
        <button
          onClick={generateAIContent}
          disabled={isGenerating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating Content...' : '🤖 Generate Discharge Plan'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Discharge Type *
          </label>
          <select
            value={dischargeData.discharge_type || 'home'}
            onChange={(e) => setDischargeData(prev => ({ ...prev, discharge_type: e.target.value as any }))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            aria-label="Discharge Type"
          >
            <option value="home">Discharge Home</option>
            <option value="transfer">Transfer to Another Facility</option>
            <option value="absconded">Patient Absconded</option>
            <option value="against_medical_advice">Against Medical Advice</option>
            <option value="death">Death</option>
          </select>
        </div>

        {dischargeData.discharge_type === 'transfer' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination Facility
            </label>
            <input
              type="text"
              value={dischargeData.discharge_destination || ''}
              onChange={(e) => setDischargeData(prev => ({ ...prev, discharge_destination: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Name of receiving facility"
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Final Diagnosis *
        </label>
        <DiagnosisList
          diagnoses={dischargeData.final_diagnosis || []}
          onAdd={(diagnosis) => handleArrayAdd('final_diagnosis', diagnosis)}
          onRemove={(index) => handleArrayRemove('final_diagnosis', index)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Procedures Performed
        </label>
        <ProceduresList
          procedures={dischargeData.procedures_performed || []}
          onAdd={(procedure) => handleArrayAdd('procedures_performed', procedure)}
          onRemove={(index) => handleArrayRemove('procedures_performed', index)}
        />
      </div>

      {aiGeneratedContent && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">🤖 Auto-Generated Discharge Summary</h4>
          <p className="text-blue-800 text-sm">{aiGeneratedContent.discharge_summary}</p>
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Medications & Instructions</h3>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Discharge Medications
        </label>
        <MedicationsList
          medications={dischargeData.medications_on_discharge || []}
          onChange={(medications) => setDischargeData(prev => ({ ...prev, medications_on_discharge: medications }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Follow-up Instructions
        </label>
        <FollowUpList
          followUps={dischargeData.follow_up_instructions || []}
          onChange={(followUps) => setDischargeData(prev => ({ ...prev, follow_up_instructions: followUps }))}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Activity Restrictions
        </label>
        <ActivityRestrictionsList
          restrictions={dischargeData.activity_restrictions || []}
          onAdd={(restriction) => handleArrayAdd('activity_restrictions', restriction)}
          onRemove={(index) => handleArrayRemove('activity_restrictions', index)}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Warning Signs to Watch For
        </label>
        <WarningSignsList
          warningSigns={dischargeData.warning_signs || []}
          onAdd={(sign) => handleArrayAdd('warning_signs', sign)}
          onRemove={(index) => handleArrayRemove('warning_signs', index)}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Finalization & Documentation</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Authorized By *
          </label>
          <select
            value={dischargeData.authorized_by || ''}
            onChange={(e) => setDischargeData(prev => ({ ...prev, authorized_by: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            aria-label="Authorized By"
            required
          >
            <option value="">Select Authorizing Doctor</option>
            {consultants.map(c => (
              <option key={c.id} value={c.full_name}>{c.full_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Prepared By
          </label>
          <input
            type="text"
            value={dischargeData.prepared_by || ''}
            onChange={(e) => setDischargeData(prev => ({ ...prev, prepared_by: e.target.value }))}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
            placeholder="Dr. Name"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="patient-counseled"
            checked={dischargeData.patient_counseled || false}
            onChange={(e) => setDischargeData(prev => ({ ...prev, patient_counseled: e.target.checked }))}
            className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="patient-counseled" className="text-sm font-medium text-gray-700">
            Patient has been counseled about discharge instructions
          </label>
        </div>

        <div className="flex items-center space-x-3">
          <input
            type="checkbox"
            id="relative-counseled"
            checked={dischargeData.relative_counseled || false}
            onChange={(e) => setDischargeData(prev => ({ ...prev, relative_counseled: e.target.checked }))}
            className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
          />
          <label htmlFor="relative-counseled" className="text-sm font-medium text-gray-700">
            Relative/caregiver has been counseled
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Certificates Issued
        </label>
        <CertificatesList
          certificates={dischargeData.certificates_issued || []}
          onAdd={(certificate) => handleArrayAdd('certificates_issued', certificate)}
          onRemove={(index) => handleArrayRemove('certificates_issued', index)}
        />
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-medium text-yellow-800 mb-2">Discharge Checklist</h4>
        <div className="space-y-2 text-sm">
          <label className="flex items-center text-yellow-700">
            <input type="checkbox" className="mr-2" />
            All medications reconciled and prescribed
          </label>
          <label className="flex items-center text-yellow-700">
            <input type="checkbox" className="mr-2" />
            Follow-up appointments scheduled
          </label>
          <label className="flex items-center text-yellow-700">
            <input type="checkbox" className="mr-2" />
            Patient education completed
          </label>
          <label className="flex items-center text-yellow-700">
            <input type="checkbox" className="mr-2" />
            Transportation arranged
          </label>
          <label className="flex items-center text-yellow-700">
            <input type="checkbox" className="mr-2" />
            Emergency contact information verified
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Discharge Planning - UNTH</h2>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex space-x-4">
              {[1, 2, 3].map(step => (
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
              Step {currentStep} of 3
            </span>
          </div>
        </div>

        <div className="p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Previous
                </button>
              )}
            </div>

            <div>
              {currentStep < 3 ? (
                <button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={() => {
                    // Handle discharge completion
                    onDischargeComplete?.(dischargeData.id || 'new-discharge');
                  }}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Complete Discharge
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper Components
const DiagnosisList: React.FC<{ diagnoses: string[]; onAdd: (diagnosis: string) => void; onRemove: (index: number) => void }> = ({
  diagnoses, onAdd, onRemove
}) => {
  const [newDiagnosis, setNewDiagnosis] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          value={newDiagnosis}
          onChange={(e) => setNewDiagnosis(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Enter diagnosis..."
        />
        <button
          onClick={() => {
            onAdd(newDiagnosis);
            setNewDiagnosis('');
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Add
        </button>
      </div>
      
      {diagnoses.map((diagnosis, index) => (
        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span>{diagnosis}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

const ProceduresList: React.FC<{ procedures: string[]; onAdd: (procedure: string) => void; onRemove: (index: number) => void }> = ({
  procedures, onAdd, onRemove
}) => {
  const [newProcedure, setNewProcedure] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          value={newProcedure}
          onChange={(e) => setNewProcedure(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Enter procedure..."
        />
        <button
          onClick={() => {
            onAdd(newProcedure);
            setNewProcedure('');
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Add
        </button>
      </div>
      
      {procedures.map((procedure, index) => (
        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span>{procedure}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

const MedicationsList: React.FC<{ medications: any[]; onChange: (medications: any[]) => void }> = ({
  medications, onChange
}) => {
  // Implementation for medications list management
  return (
    <div className="text-sm text-gray-500">
      Medications list component - to be implemented with detailed medication form
    </div>
  );
};

const FollowUpList: React.FC<{ followUps: any[]; onChange: (followUps: any[]) => void }> = ({
  followUps, onChange
}) => {
  // Implementation for follow-up instructions
  return (
    <div className="text-sm text-gray-500">
      Follow-up instructions component - to be implemented
    </div>
  );
};

const ActivityRestrictionsList: React.FC<{ restrictions: string[]; onAdd: (restriction: string) => void; onRemove: (index: number) => void }> = ({
  restrictions, onAdd, onRemove
}) => {
  const [newRestriction, setNewRestriction] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          value={newRestriction}
          onChange={(e) => setNewRestriction(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Enter activity restriction..."
        />
        <button
          onClick={() => {
            onAdd(newRestriction);
            setNewRestriction('');
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Add
        </button>
      </div>
      
      {restrictions.map((restriction, index) => (
        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span>{restriction}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

const WarningSignsList: React.FC<{ warningSigns: string[]; onAdd: (sign: string) => void; onRemove: (index: number) => void }> = ({
  warningSigns, onAdd, onRemove
}) => {
  const [newSign, setNewSign] = useState('');

  return (
    <div className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="text"
          value={newSign}
          onChange={(e) => setNewSign(e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
          placeholder="Enter warning sign..."
        />
        <button
          onClick={() => {
            onAdd(newSign);
            setNewSign('');
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
        >
          Add
        </button>
      </div>
      
      {warningSigns.map((sign, index) => (
        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
          <span>{sign}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};

const CertificatesList: React.FC<{ certificates: string[]; onAdd: (certificate: string) => void; onRemove: (index: number) => void }> = ({
  certificates, onAdd, onRemove
}) => {
  const commonCertificates = [
    'Medical Certificate of Fitness to Work',
    'Medical Certificate for School',
    'Medical Certificate for Travel',
    'Sick Leave Certificate',
    'Medical Report for Insurance',
    'Death Certificate'
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {commonCertificates.map(cert => (
          <button
            key={cert}
            onClick={() => onAdd(cert)}
            className="text-left p-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
          >
            {cert}
          </button>
        ))}
      </div>
      
      {certificates.map((certificate, index) => (
        <div key={index} className="flex items-center justify-between bg-green-50 border border-green-200 p-2 rounded">
          <span className="text-green-800">{certificate}</span>
          <button
            onClick={() => onRemove(index)}
            className="text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
};