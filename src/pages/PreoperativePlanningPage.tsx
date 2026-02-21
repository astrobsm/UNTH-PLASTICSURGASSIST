import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { PreoperativePlanningModule } from '../components/procedures/PreoperativePlanningModule';
import { patientService } from '../services/patientService';
import { preoperativeService, PreoperativeAssessment } from '../services/preoperativeService';
import toast from 'react-hot-toast';
import { ArrowLeft, ClipboardCheck, Users, Search, User, Calendar, Loader2, Eye, Plus, CheckCircle, AlertTriangle, FileText, Download } from 'lucide-react';
import {
  createPDF,
  addPDFHeader,
  addSectionHeader,
  addBodyText,
  addBulletList,
  addSeparator,
  addFooter,
  addLabeledField,
  sanitizeTextForPDF,
  formatDateForPDF,
} from '../utils/pdfUtils';

interface Patient {
  id: string;
  hospital_number: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
}

const PreoperativePlanningPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const patientIdFromUrl = searchParams.get('patientId');
  
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(patientIdFromUrl);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPatientSelector, setShowPatientSelector] = useState(!patientIdFromUrl);
  const [existingAssessment, setExistingAssessment] = useState<PreoperativeAssessment | null>(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [viewMode, setViewMode] = useState<'form' | 'view'>('form');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  // Load existing assessment when patient is selected
  useEffect(() => {
    if (selectedPatientId) {
      loadExistingAssessment(selectedPatientId);
    }
  }, [selectedPatientId]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredPatients(
        patients.filter(p => {
          const fullName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
          const hospitalNumber = p.hospital_number || '';
          return (
            fullName.toLowerCase().includes(query) ||
            hospitalNumber.toLowerCase().includes(query)
          );
        })
      );
    } else {
      setFilteredPatients(patients.slice(0, 20)); // Show first 20 by default
    }
  }, [searchQuery, patients]);

  const loadPatients = async () => {
    try {
      setIsLoading(true);
      const allPatients = await patientService.getAllPatients();
      setPatients(allPatients);
      setFilteredPatients(allPatients.slice(0, 20));
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatientId(patientId);
    setShowPatientSelector(false);
    setViewMode('form');
    navigate(`/preoperative-planning?patientId=${patientId}`, { replace: true });
  };

  const loadExistingAssessment = async (patientId: string) => {
    setLoadingAssessment(true);
    try {
      const assessment = await preoperativeService.getAssessmentByPatient(patientId);
      setExistingAssessment(assessment);
    } catch (error) {
      console.error('Error loading existing assessment:', error);
      setExistingAssessment(null);
    } finally {
      setLoadingAssessment(false);
    }
  };

  const handleComplete = async (data: any) => {
    setSaving(true);
    try {
      // Map PreopPlanningData → PreoperativeAssessment
      const selectedComorbidities = (data.comorbidities || [])
        .filter((c: any) => c.selected)
        .map((c: any) => c.name);

      const assessment: PreoperativeAssessment = {
        patient_id: data.patientId || selectedPatientId || '',
        surgery_booking_id: data.procedureId,
        current_medications: (data.clinicalAssessment?.currentMedications || []).map((m: string) => ({
          drug_name: m,
          dosage: '',
          frequency: '',
          route: 'oral' as const,
          indication: '',
        })),
        bleeding_risk: {
          anticoagulant_use: selectedComorbidities.includes('On Anticoagulation'),
          antiplatelet_use: false,
          bleeding_disorder: selectedComorbidities.includes('Bleeding Disorder'),
          liver_disease: selectedComorbidities.includes('Liver Cirrhosis') || selectedComorbidities.includes('Chronic Hepatitis'),
          renal_impairment: selectedComorbidities.includes('Chronic Kidney Disease') || selectedComorbidities.includes('Dialysis Dependent'),
          recent_bleeding: false,
          risk_level: data.riskAssessment?.bleedingRisk || 'low',
          risk_score: data.riskAssessment?.bleedingRisk === 'high' ? 7 : data.riskAssessment?.bleedingRisk === 'intermediate' ? 4 : 1,
          recommendations: [],
        },
        dvt_risk: {
          age_41_60: false, minor_surgery: false, history_major_surgery: false,
          varicose_veins: false, history_inflammatory_bowel: false, swollen_legs: false,
          obesity_bmi_over_25: (data.clinicalAssessment?.bmi || 0) > 25,
          acute_mi: false, chf_1_month: false, sepsis_1_month: false,
          serious_lung_disease: false, abnormal_pulmonary_function: false, medical_patient_bed_rest: false,
          age_61_74: false, arthroscopic_surgery: false, malignancy: selectedComorbidities.includes('Active Malignancy'),
          major_surgery_over_45min: (data.expectedDuration || 0) > 45, laparoscopic_over_45min: false,
          patient_confined_to_bed: false, immobilizing_plaster_cast: false, central_venous_access: false,
          age_over_75: false, history_dvt_pe: selectedComorbidities.includes('Previous DVT/PE'),
          family_history_dvt: false, factor_v_leiden: false, prothrombin_20210a: false,
          lupus_anticoagulant: false, anticardiolipin_antibodies: false,
          heparin_induced_thrombocytopenia: false, other_thrombophilia: false,
          elective_major_lower_extremity_arthroplasty: false, hip_pelvis_leg_fracture: false,
          stroke_1_month: false, multiple_trauma: false, acute_spinal_cord_injury: false,
          total_score: data.riskAssessment?.thrombosisRisk === 'high' ? 5 : data.riskAssessment?.thrombosisRisk === 'intermediate' ? 3 : 1,
          risk_category: data.riskAssessment?.thrombosisRisk === 'high' ? 'high' : data.riskAssessment?.thrombosisRisk === 'intermediate' ? 'moderate' : 'low',
          prophylaxis_recommendation: data.riskAssessment?.thrombosisRisk === 'high' ? 'LMWH + compression stockings' : 'Early mobilization',
        },
        cardiovascular_risk: {
          high_risk_surgery: data.procedureType === 'major',
          ischemic_heart_disease: selectedComorbidities.includes('Coronary Artery Disease'),
          history_chf: selectedComorbidities.includes('Congestive Heart Failure'),
          history_cerebrovascular_disease: selectedComorbidities.includes('Previous Stroke/TIA'),
          diabetes_on_insulin: selectedComorbidities.includes('Diabetes Type 1'),
          preop_creatinine_over_2: false,
          hypertension: selectedComorbidities.includes('Hypertension'),
          smoking: data.clinicalAssessment?.smokingStatus === 'current',
          age_over_65: false,
          rcri_score: data.riskAssessment?.cardiacRisk === 'high' ? 3 : data.riskAssessment?.cardiacRisk === 'intermediate' ? 2 : 0,
          risk_level: data.riskAssessment?.cardiacRisk || 'low',
          cardiac_event_risk_percent: data.riskAssessment?.cardiacRisk === 'high' ? 9 : data.riskAssessment?.cardiacRisk === 'intermediate' ? 5 : 1,
          recommendations: [],
        },
        pressure_sore_risk: {
          sensory_perception: 4 as const,
          moisture: 4 as const,
          activity: 4 as const,
          mobility: 4 as const,
          nutrition: 4 as const,
          friction_shear: 3 as const,
          braden_total: 23,
          risk_category: 'no-risk',
          preventive_measures: [],
        },
        comorbidities_medications: selectedComorbidities.map((c: string) => ({
          comorbidity: c,
          medications: [],
        })),
        consent_document: undefined,
        payment_evidence: undefined,
        insurance_covered: false,
        comprehensive_summary: `Pre-operative assessment for patient. Procedure: ${data.procedureName || 'N/A'}. ` +
          `Anesthesia: ${data.anesthesiaType || 'N/A'}. Urgency: ${data.urgency || 'elective'}. ` +
          `ASA Score: ${data.riskAssessment?.asaScore || 1}. ` +
          `Overall Risk: ${data.riskAssessment?.overallRisk || 'low'}. ` +
          `Comorbidities: ${selectedComorbidities.length > 0 ? selectedComorbidities.join(', ') : 'None'}. ` +
          `Allergies: ${(data.clinicalAssessment?.allergies || []).length > 0 ? data.clinicalAssessment.allergies.join(', ') : 'None'}. ` +
          `Vitals: BP ${data.clinicalAssessment?.bloodPressure || 'N/A'}, HR ${data.clinicalAssessment?.heartRate || 'N/A'}, ` +
          `Temp ${data.clinicalAssessment?.temperature || 'N/A'}°C, SpO2 ${data.clinicalAssessment?.oxygenSaturation || 'N/A'}%. ` +
          `BMI: ${data.clinicalAssessment?.bmi || 'N/A'}. ` +
          `${data.additionalNotes ? 'Notes: ' + data.additionalNotes : ''}`,
        preop_instructions: `Fasting: NPO status - ${data.clinicalAssessment?.npo_status || 'NPO since midnight'}. ` +
          `Medications: ${(data.clinicalAssessment?.currentMedications || []).length > 0 ? data.clinicalAssessment.currentMedications.join(', ') : 'None on current medications'}. ` +
          `Investigations ordered: ${(data.generatedInvestigations || []).map((i: any) => i.name).join(', ') || 'As per protocol'}.`,
        assessed_by: data.assessedBy || localStorage.getItem('userName') || 'Unknown',
        assessed_at: new Date(),
        updated_at: new Date(),
      };

      await preoperativeService.saveAssessment(assessment);
      setExistingAssessment(assessment);
      toast.success('Pre-operative assessment saved successfully!');
      setViewMode('view');
    } catch (error) {
      console.error('Error saving assessment:', error);
      toast.error('Failed to save assessment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (selectedPatientId) {
      setShowPatientSelector(true);
      setSelectedPatientId(null);
    } else {
      navigate('/procedures');
    }
  };

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading && !patientIdFromUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // Patient selector view
  if (showPatientSelector) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/procedures')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-5 h-5 mr-1" />
            Back to Procedures
          </button>
          
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <ClipboardCheck className="w-8 h-8 text-primary-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-operative Planning</h1>
              <p className="text-gray-500">Select a patient to begin pre-operative assessment</p>
            </div>
          </div>
        </div>

        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by patient name or hospital number..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {/* Patient List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-gray-700">
                  {searchQuery ? `${filteredPatients.length} results` : `${patients.length} patients`}
                </span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {filteredPatients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No patients found</p>
              </div>
            ) : (
              filteredPatients.map((patient) => {
                const displayName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Unknown';
                return (
                  <button
                    key={patient.id}
                    onClick={() => handlePatientSelect(patient.id)}
                    className="w-full p-4 hover:bg-gray-50 text-left transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{displayName}</h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span>#{patient.hospital_number || 'N/A'}</span>
                          <span className="flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {patient.date_of_birth ? `${calculateAge(patient.date_of_birth)} years` : 'N/A'}
                          </span>
                          <span className="capitalize">{patient.gender || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-primary-600">
                      <ArrowLeft className="w-5 h-5 transform rotate-180" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Risk badge helper
  const riskBadge = (level?: string) => {
    if (!level) return 'bg-gray-100 text-gray-600';
    const l = level.toLowerCase();
    if (l.includes('high') || l.includes('severe') || l.includes('very')) return 'bg-red-100 text-red-700 border-red-300';
    if (l.includes('moderate') || l.includes('medium') || l.includes('intermediate')) return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    return 'bg-green-100 text-green-700 border-green-300';
  };

  // Generate a summary PDF for the existing assessment
  const generateAssessmentPDF = (assessment: PreoperativeAssessment) => {
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Pre-Operative Assessment Summary');
      
      y = addSectionHeader(doc, 'Patient Information', y);
      y = addLabeledField(doc, 'Patient ID', assessment.patient_id, y);
      y = addLabeledField(doc, 'Assessed By', assessment.assessed_by || 'N/A', y);
      y = addLabeledField(doc, 'Assessment Date', assessment.assessed_at ? formatDateForPDF(assessment.assessed_at) : 'N/A', y);
      y = addSeparator(doc, y);

      if (assessment.comprehensive_summary) {
        y = addSectionHeader(doc, 'Comprehensive Summary', y);
        y = addBodyText(doc, sanitizeTextForPDF(assessment.comprehensive_summary), y);
        y = addSeparator(doc, y);
      }

      y = addSectionHeader(doc, 'Risk Assessment', y);
      if (assessment.bleeding_risk) {
        y = addLabeledField(doc, 'Bleeding Risk', `${assessment.bleeding_risk.risk_level} (Score: ${assessment.bleeding_risk.risk_score})`, y);
      }
      if (assessment.dvt_risk) {
        y = addLabeledField(doc, 'DVT Risk (Caprini)', `${assessment.dvt_risk.risk_category} (Score: ${assessment.dvt_risk.total_score})`, y);
      }
      if (assessment.cardiovascular_risk) {
        y = addLabeledField(doc, 'Cardiac Risk (RCRI)', `${assessment.cardiovascular_risk.risk_level} (Score: ${assessment.cardiovascular_risk.rcri_score})`, y);
      }
      if (assessment.pressure_sore_risk) {
        y = addLabeledField(doc, 'Pressure Sore (Braden)', `${assessment.pressure_sore_risk.risk_category} (Score: ${assessment.pressure_sore_risk.braden_total})`, y);
      }
      y = addSeparator(doc, y);

      if (assessment.current_medications && assessment.current_medications.length > 0) {
        y = addSectionHeader(doc, 'Current Medications', y);
        y = addBulletList(doc, assessment.current_medications.map(m => `${m.drug_name} ${m.dosage ? '- ' + m.dosage : ''} ${m.frequency ? '(' + m.frequency + ')' : ''}`), y);
        y = addSeparator(doc, y);
      }

      if (assessment.comorbidities_medications && assessment.comorbidities_medications.length > 0) {
        y = addSectionHeader(doc, 'Comorbidities', y);
        y = addBulletList(doc, assessment.comorbidities_medications.map(c => c.comorbidity), y);
        y = addSeparator(doc, y);
      }

      if (assessment.preop_instructions) {
        y = addSectionHeader(doc, 'Pre-Operative Instructions', y);
        y = addBodyText(doc, sanitizeTextForPDF(assessment.preop_instructions), y);
      }

      addFooter(doc, `Generated: ${new Date().toLocaleString()}`);
      doc.save(`PreOp_Assessment_${assessment.patient_id}.pdf`);
      toast.success('Assessment PDF downloaded');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF');
    }
  };

  // Pre-operative Planning view
  return (
    <div className="p-6">
      {/* Existing Assessment Banner */}
      {loadingAssessment && (
        <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-blue-700">Loading previous assessment data...</span>
        </div>
      )}

      {existingAssessment && !loadingAssessment && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-green-900 text-lg">Previous Assessment Found</h3>
                <p className="text-sm text-green-700">
                  Assessed by {existingAssessment.assessed_by || 'Unknown'} on{' '}
                  {existingAssessment.assessed_at ? new Date(existingAssessment.assessed_at).toLocaleDateString() : 'Unknown date'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {viewMode === 'form' ? (
                <button
                  onClick={() => setViewMode('view')}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Assessment
                </button>
              ) : (
                <button
                  onClick={() => setViewMode('form')}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Assessment
                </button>
              )}
              <button
                onClick={() => generateAssessmentPDF(existingAssessment)}
                className="inline-flex items-center px-4 py-2 bg-white border border-green-300 text-green-700 rounded-lg hover:bg-green-50 text-sm font-medium"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </button>
            </div>
          </div>

          {/* Assessment Summary Display (visible when viewMode is 'view') */}
          {viewMode === 'view' && (
            <div className="space-y-4 pt-2">
              {/* Risk Scores Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {existingAssessment.bleeding_risk && (
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Bleeding Risk</div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium border ${riskBadge(existingAssessment.bleeding_risk.risk_level)}`}>
                      {existingAssessment.bleeding_risk.risk_level} (Score: {existingAssessment.bleeding_risk.risk_score})
                    </span>
                  </div>
                )}
                {existingAssessment.dvt_risk && (
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">DVT Risk (Caprini)</div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium border ${riskBadge(existingAssessment.dvt_risk.risk_category)}`}>
                      {existingAssessment.dvt_risk.risk_category} (Score: {existingAssessment.dvt_risk.total_score})
                    </span>
                  </div>
                )}
                {existingAssessment.cardiovascular_risk && (
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Cardiac Risk (RCRI)</div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium border ${riskBadge(existingAssessment.cardiovascular_risk.risk_level)}`}>
                      {existingAssessment.cardiovascular_risk.risk_level} (Score: {existingAssessment.cardiovascular_risk.rcri_score})
                    </span>
                  </div>
                )}
                {existingAssessment.pressure_sore_risk && (
                  <div className="bg-white p-3 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Pressure Sore (Braden)</div>
                    <span className={`px-2 py-1 text-xs rounded-full font-medium border ${riskBadge(existingAssessment.pressure_sore_risk.risk_category)}`}>
                      {existingAssessment.pressure_sore_risk.risk_category} (Score: {existingAssessment.pressure_sore_risk.braden_total})
                    </span>
                  </div>
                )}
              </div>

              {/* Consent/Insurance/Payment Status */}
              <div className="flex flex-wrap gap-4 text-sm bg-white p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${existingAssessment.consent_document ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  <span className="text-gray-700">Consent: {existingAssessment.consent_document ? 'Obtained' : 'Pending'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${existingAssessment.insurance_covered ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-gray-700">Insurance: {existingAssessment.insurance_covered ? 'Covered' : 'Not Covered/Pending'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${existingAssessment.payment_evidence ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                  <span className="text-gray-700">Payment: {existingAssessment.payment_evidence ? 'Confirmed' : 'Pending'}</span>
                </div>
              </div>

              {/* Comprehensive Summary */}
              {existingAssessment.comprehensive_summary && (
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Comprehensive Summary
                  </h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingAssessment.comprehensive_summary}</p>
                </div>
              )}

              {/* Pre-op Instructions */}
              {existingAssessment.preop_instructions && (
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Pre-Operative Instructions
                  </h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingAssessment.preop_instructions}</p>
                </div>
              )}

              {/* Current Medications */}
              {existingAssessment.current_medications && existingAssessment.current_medications.length > 0 && (
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Current Medications</h4>
                  <div className="flex flex-wrap gap-2">
                    {existingAssessment.current_medications.map((m, i) => (
                      <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                        {m.drug_name} {m.dosage ? `(${m.dosage})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Comorbidities */}
              {existingAssessment.comorbidities_medications && existingAssessment.comorbidities_medications.length > 0 && (
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Comorbidities</h4>
                  <div className="flex flex-wrap gap-2">
                    {existingAssessment.comorbidities_medications.map((c, i) => (
                      <span key={i} className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-xs border border-orange-200">
                        {c.comorbidity}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Form or Prompt */}
      {viewMode === 'form' && (
        <>
          {saving && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-blue-700 font-medium">Saving assessment...</span>
            </div>
          )}
          <PreoperativePlanningModule
            patientId={selectedPatientId || undefined}
            onComplete={handleComplete}
            onCancel={handleCancel}
          />
        </>
      )}
    </div>
  );
};

export default PreoperativePlanningPage;
