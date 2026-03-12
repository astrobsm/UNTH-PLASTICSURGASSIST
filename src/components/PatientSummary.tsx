import React, { useState, useEffect } from 'react';
import { unthPatientService, PatientSummary } from '../services/unthPatientService';
import { patientService } from '../services/patientService';
import { db } from '../db/database';

interface PatientSummaryViewProps {
  patientId: string;
  summaryType?: PatientSummary['summary_type'];
}

export const PatientSummaryView: React.FC<PatientSummaryViewProps> = ({
  patientId,
  summaryType = 'progress'
}) => {
  const [summaries, setSummaries] = useState<PatientSummary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<PatientSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSummaries();
  }, [patientId, summaryType]);

  const loadSummaries = async () => {
    setIsLoading(true);
    try {
      // Fetch patient data
      const patient = await patientService.getPatient(patientId);
      
      // Try to fetch existing summaries from local DB
      const existingSummaries = await db.patient_summaries
        ?.where('patient_id')
        .equals(patientId)
        .toArray() || [];
      
      if (existingSummaries.length > 0) {
        // Convert stored dates back to Date objects
        const formattedSummaries = existingSummaries.map(s => ({
          ...s,
          generated_at: new Date(s.generated_at)
        }));
        setSummaries(formattedSummaries);
        setSelectedSummary(formattedSummaries[0]);
        
        // Also regenerate in background to update with latest data
        if (patient) {
          try {
            const freshSummary = await generateSummaryFromPatientData(patient, summaryType);
            setSummaries(prev => [freshSummary, ...prev.slice(1)]);
            setSelectedSummary(freshSummary);
          } catch { /* keep existing if regeneration fails */ }
        }
      } else if (patient) {
        // Generate initial summary from actual patient data
        const patientSummary = await generateSummaryFromPatientData(patient, summaryType);
        setSummaries([patientSummary]);
        setSelectedSummary(patientSummary);
      } else {
        setSummaries([]);
        setSelectedSummary(null);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
      setSummaries([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSummaryFromPatientData = async (patient: any, type: PatientSummary['summary_type']): Promise<PatientSummary> => {
    // Get related data for the patient (handle both number and string patient_id)
    const allAdmissions = await db.admissions?.toArray() || [];
    const admissions = allAdmissions.filter(a => String(a.patient_id) === String(patient.id));
    const allTreatmentPlans = await db.treatment_plans?.toArray() || [];
    const treatmentPlans = allTreatmentPlans.filter(tp => String(tp.patient_id) === String(patient.id));
    const latestAdmission = admissions.sort((a, b) => 
      new Date(b.admission_date || b.created_at).getTime() - new Date(a.admission_date || a.created_at).getTime()
    )[0];
    
    // Build content from actual patient data
    const patientName = `${patient.first_name} ${patient.last_name}`;
    const diagnosis = patient.primary_diagnosis || latestAdmission?.provisional_diagnosis || latestAdmission?.admitting_diagnosis || 'Not specified';
    const allergies = Array.isArray(patient.allergies) ? patient.allergies : (patient.allergies ? [patient.allergies] : []);
    const ward = latestAdmission?.ward_location || latestAdmission?.ward || patient.ward || 'Not assigned';
    
    let content = `Patient ${patientName}`;
    if (patient.hospital_number) content += ` (${patient.hospital_number})`;
    if (latestAdmission) {
      content += ` admitted to ${ward}`;
      if (latestAdmission.admission_date) {
        content += ` on ${new Date(latestAdmission.admission_date).toLocaleDateString()}`;
      }
    }
    content += `. Primary Diagnosis: ${diagnosis}.`;
    
    if (latestAdmission?.presenting_complaint) {
      content += ` Presenting complaint: ${latestAdmission.presenting_complaint}.`;
    }
    if (patient.medical_history) {
      content += ` Medical history: ${patient.medical_history}.`;
    }
    
    // Build key points from actual data
    const keyPoints: string[] = [];
    if (diagnosis && diagnosis !== 'Not specified') keyPoints.push(`Diagnosis: ${diagnosis}`);
    if (ward !== 'Not assigned') keyPoints.push(`Location: ${ward}`);
    if (patient.blood_group) keyPoints.push(`Blood Group: ${patient.blood_group}`);
    if (allergies.length > 0) keyPoints.push(`Allergies: ${allergies.join(', ')}`);
    
    // Current problems from treatment plans
    const currentProblems: string[] = [];
    if (diagnosis && diagnosis !== 'Not specified') currentProblems.push(diagnosis);
    treatmentPlans.forEach(tp => {
      if (tp.diagnosis && !currentProblems.includes(tp.diagnosis)) {
        currentProblems.push(tp.diagnosis);
      }
    });
    
    // Medications from treatment plans or prescriptions
    const medications: string[] = [];
    const allPrescriptions = await db.prescriptions?.toArray() || [];
    const prescriptions = allPrescriptions.filter(p => String(p.patient_id) === String(patient.id));
    prescriptions.forEach(p => {
      // Handle bundled prescription format: { prescriptions: [{medication, dosage, ...}] }
      if (p.prescriptions && Array.isArray(p.prescriptions)) {
        p.prescriptions.forEach((med: any) => {
          const name = med.medication || med.medication_name || med.name || '';
          if (name) {
            medications.push(`${name} ${med.dosage || ''} ${med.frequency || ''}`.trim());
          }
        });
      } else if (p.medication_name || p.medication) {
        // Handle individual prescription record format
        const name = p.medication_name || p.medication;
        if (!p.status || p.status === 'active') {
          medications.push(`${name} ${p.dosage || ''} ${p.frequency || ''}`.trim());
        }
      }
    });
    
    // Build plan from treatment plans
    const plan: string[] = [];
    treatmentPlans.forEach(tp => {
      if (tp.procedures && Array.isArray(tp.procedures)) {
        tp.procedures.forEach((proc: any) => {
          if (proc.procedure_name || proc.name) {
            plan.push(proc.procedure_name || proc.name);
          }
        });
      }
    });
    if (plan.length === 0) {
      plan.push('Continue monitoring', 'Review treatment response');
    }
    
    const summary: PatientSummary = {
      id: `summary-${Date.now()}`,
      patient_id: patientId,
      summary_type: type,
      generated_by: 'system',
      content,
      key_points: keyPoints.length > 0 ? keyPoints : ['Patient data loaded from database'],
      current_problems: currentProblems.length > 0 ? currentProblems : ['No active problems documented'],
      medications: medications.length > 0 ? medications : ['No active medications'],
      investigations_pending: [],
      plan: plan,
      generated_at: new Date(),
      generated_by_user: 'system',
      ai_confidence: undefined
    };
    
    // Save to local DB for future retrieval
    try {
      await db.patient_summaries?.add(summary as any);
    } catch (e) {
      console.warn('Could not save summary to local DB:', e);
    }
    
    return summary;
  };

  const generateNewSummary = async () => {
    setIsGenerating(true);
    try {
      const patient = await patientService.getPatient(patientId);
      if (patient) {
        const newSummary = await generateSummaryFromPatientData(patient, summaryType);
        setSummaries(prev => [newSummary, ...prev]);
        setSelectedSummary(newSummary);
      } else {
        alert('Patient not found.');
      }
    } catch (error) {
      console.error('Failed to generate summary:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const getSummaryTypeIcon = (type: string) => {
    switch (type) {
      case 'admission':
        return 'A';
      case 'progress':
        return 'P';
      case 'discharge':
        return 'D';
      case 'consultation':
        return 'C';
      default:
        return 'S';
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'text-gray-500';
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Summary List */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Patient Summaries</h3>
            <button
              onClick={generateNewSummary}
              disabled={isGenerating}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? 'Generating...' : '+ New Summary'}
            </button>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {summaries.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <p>No summaries available</p>
                <button
                  onClick={generateNewSummary}
                  className="mt-2 text-sm text-green-600 hover:text-green-700"
                >
                  Generate first summary
                </button>
              </div>
            ) : (
              summaries.map(summary => (
                <div
                  key={summary.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedSummary?.id === summary.id ? 'bg-green-50 border-r-2 border-green-500' : ''
                  }`}
                  onClick={() => setSelectedSummary(summary)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getSummaryTypeIcon(summary.summary_type)}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 capitalize truncate">
                        {summary.summary_type} Summary
                      </h4>
                      <p className="text-sm text-gray-500">
                        {summary.generated_at.toLocaleDateString()} at{' '}
                        {summary.generated_at.toLocaleTimeString()}
                      </p>
                      {summary.generated_by === 'ai' && (
                        <div className="flex items-center space-x-1 mt-1">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            Auto-Generated
                          </span>
                          {summary.ai_confidence && (
                            <span className={`text-xs ${getConfidenceColor(summary.ai_confidence)}`}>
                              {summary.ai_confidence}% confidence
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Summary Detail */}
      <div className="lg:col-span-2">
        {selectedSummary ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{getSummaryTypeIcon(selectedSummary.summary_type)}</span>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 capitalize">
                      {selectedSummary.summary_type} Summary
                    </h2>
                    <p className="text-sm text-gray-500">
                      Generated {selectedSummary.generated_at.toLocaleDateString()} at{' '}
                      {selectedSummary.generated_at.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                {selectedSummary.generated_by === 'ai' && selectedSummary.ai_confidence && (
                  <div className="text-right">
                    <span className="text-sm text-gray-500">Confidence</span>
                    <div className={`text-lg font-semibold ${getConfidenceColor(selectedSummary.ai_confidence)}`}>
                      {selectedSummary.ai_confidence}%
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Clinical Summary */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Clinical Summary</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 leading-relaxed">{selectedSummary.content}</p>
                </div>
              </div>

              {/* Key Points */}
              {selectedSummary.key_points.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Clinical Points</h3>
                  <ul className="space-y-2">
                    {selectedSummary.key_points.map((point, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></span>
                        <span className="text-gray-700">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Current Problems */}
              {selectedSummary.current_problems.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Problems</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedSummary.current_problems.map((problem, index) => (
                      <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <span className="text-red-800 font-medium">{problem}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Medications */}
              {selectedSummary.medications.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Current Medications</h3>
                  <div className="space-y-2">
                    {selectedSummary.medications.map((medication, index) => (
                      <div key={index} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <span className="text-blue-800 font-medium">{medication}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending Investigations */}
              {selectedSummary.investigations_pending.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Pending Investigations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedSummary.investigations_pending.map((investigation, index) => (
                      <div key={index} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <span className="text-yellow-800">{investigation}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Management Plan */}
              {selectedSummary.plan.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Management Plan</h3>
                  <ol className="space-y-2">
                    {selectedSummary.plan.map((planItem, index) => (
                      <li key={index} className="flex items-start space-x-3">
                        <span className="flex items-center justify-center w-6 h-6 bg-green-600 text-white text-sm font-semibold rounded-full flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="text-gray-700 pt-0.5">{planItem}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Generated by: {selectedSummary.generated_by === 'ai' ? 'Automated System' : selectedSummary.generated_by_user}
                </div>
                <div className="flex space-x-3">
                  <button className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                    Print Summary
                  </button>
                  <button className="px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                    Export PDF
                  </button>
                  <button 
                    onClick={generateNewSummary}
                    disabled={isGenerating}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Generate Updated Summary
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Summary Selected</h3>
            <p className="text-gray-500">Select a summary from the list or generate a new one</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Quick Summary Card Component
export const QuickSummaryCard: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [latestSummary, setLatestSummary] = useState<PatientSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLatestSummary();
  }, [patientId]);

  const loadLatestSummary = async () => {
    setIsLoading(true);
    try {
      // Load summaries from database
      const summaries = await db.patient_summaries
        ?.where('patient_id')
        .equals(patientId)
        .reverse()
        .sortBy('generated_at') || [];
      
      if (summaries.length > 0) {
        // Get the most recent summary
        const mostRecent = summaries[summaries.length - 1];
        setLatestSummary({
          ...mostRecent,
          generated_at: new Date(mostRecent.generated_at)
        });
      } else {
        // No summary exists - show empty state
        setLatestSummary(null);
      }
    } catch (error) {
      console.error('Error loading latest summary:', error);
      setLatestSummary(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!latestSummary) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
        <p className="text-gray-500 mb-2">No recent summary available</p>
        <button
          onClick={async () => {
            setIsLoading(true);
            try {
              const patient = await patientService.getPatient(patientId);
              if (patient) {
                const { PatientSummaryView } = await import('./PatientSummary');
                // Generate from real data
                const allAdmissions = await db.admissions?.toArray() || [];
                const admissions = allAdmissions.filter(a => String(a.patient_id) === String(patient.id));
                const allTreatmentPlans = await db.treatment_plans?.toArray() || [];
                const treatmentPlans = allTreatmentPlans.filter(tp => String(tp.patient_id) === String(patient.id));
                const latestAdmission = admissions.sort((a, b) =>
                  new Date(b.admission_date || b.created_at).getTime() - new Date(a.admission_date || a.created_at).getTime()
                )[0];
                const allPrescriptions = await db.prescriptions?.toArray() || [];
                const prescriptions = allPrescriptions.filter(p => String(p.patient_id) === String(patient.id));

                const patientName = `${patient.first_name} ${patient.last_name}`;
                const diagnosis = patient.primary_diagnosis || latestAdmission?.provisional_diagnosis || latestAdmission?.admitting_diagnosis || 'Not specified';
                const ward = latestAdmission?.ward_location || latestAdmission?.ward || patient.ward || 'Not assigned';
                const allergies = Array.isArray(patient.allergies) ? patient.allergies : (patient.allergies ? [patient.allergies] : []);

                let content = `Patient ${patientName}`;
                if (patient.hospital_number) content += ` (${patient.hospital_number})`;
                if (latestAdmission) {
                  content += ` admitted to ${ward}`;
                  if (latestAdmission.admission_date) content += ` on ${new Date(latestAdmission.admission_date).toLocaleDateString()}`;
                }
                content += `. Primary Diagnosis: ${diagnosis}.`;

                const keyPoints: string[] = [];
                if (diagnosis !== 'Not specified') keyPoints.push(`Diagnosis: ${diagnosis}`);
                if (ward !== 'Not assigned') keyPoints.push(`Location: ${ward}`);
                if (patient.blood_group) keyPoints.push(`Blood Group: ${patient.blood_group}`);
                if (allergies.length > 0) keyPoints.push(`Allergies: ${allergies.join(', ')}`);

                const medications: string[] = [];
                prescriptions.forEach((p: any) => {
                  if (p.prescriptions && Array.isArray(p.prescriptions)) {
                    p.prescriptions.forEach((med: any) => {
                      const name = med.medication || med.medication_name || '';
                      if (name) medications.push(`${name} ${med.dosage || ''} ${med.frequency || ''}`.trim());
                    });
                  } else if (p.medication_name) {
                    medications.push(`${p.medication_name} ${p.dosage || ''} ${p.frequency || ''}`.trim());
                  }
                });

                const summary = {
                  id: `summary-${Date.now()}`,
                  patient_id: patientId,
                  summary_type: 'progress' as const,
                  generated_by: 'system' as const,
                  content,
                  key_points: keyPoints.length > 0 ? keyPoints : ['Patient data loaded from database'],
                  current_problems: diagnosis !== 'Not specified' ? [diagnosis] : [],
                  medications: medications.length > 0 ? medications : ['No active medications'],
                  investigations_pending: [] as string[],
                  plan: ['Continue monitoring', 'Review treatment response'],
                  generated_at: new Date(),
                  generated_by_user: 'system',
                  ai_confidence: undefined
                };
                try { await db.patient_summaries?.add(summary as any); } catch {}
                setLatestSummary(summary as any);
              }
            } catch (e) { console.error(e); }
            setIsLoading(false);
          }}
          className="text-sm text-green-600 hover:text-green-700 font-medium"
        >
          Generate Summary
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Latest Summary</h3>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
            Auto-Generated
          </span>
        </div>
      </div>
      
      <div className="p-4">
        <p className="text-gray-700 text-sm mb-3">{latestSummary.content}</p>
        
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Key Points</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {latestSummary.key_points.slice(0, 3).map((point, index) => (
                <span key={index} className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  {point}
                </span>
              ))}
            </div>
          </div>
          
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {latestSummary.generated_at.toLocaleDateString()} at{' '}
              {latestSummary.generated_at.toLocaleTimeString()}
            </span>
            <span className="font-medium">
              {latestSummary.ai_confidence}% confidence
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};