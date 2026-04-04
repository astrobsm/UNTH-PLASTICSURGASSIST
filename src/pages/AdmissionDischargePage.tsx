import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientService } from '../services/patientService';
import { MedicalTextInput } from '../components/MedicalTextInput';
import MedicalAutocompleteTextarea from '../components/MedicalAutocompleteTextarea';
import { 
  admissionDischargeService, 
  Admission, 
  Discharge,
  WHODischargeScore,
  DischargeMedication,
  MDTMedicationReview,
  AdmissionStatistics
} from '../services/admissionDischargeService';
import { medicalTeamService, StaffByRole, SuggestedTeam } from '../services/medicalTeamService';
import { preoperativeService, PreoperativeAssessment } from '../services/preoperativeService';
import WHODischargeAssessment from '../components/WHODischargeAssessment';
import MDTDischargeMedications from '../components/MDTDischargeMedications';
import DischargeSummaryForm from '../components/DischargeSummaryForm';
import DischargeDocumentsPreview from '../components/DischargeDocumentsPreview';
import {
  createPDF,
  addPDFHeader,
  addSectionHeader,
  addBodyText,
  addBulletList,
  addWarningBox,
  addSeparator,
  addFooter,
  addLabeledField,
  sanitizeTextForPDF,
  formatDateForPDF,
  PDF_MARGINS,
  PDF_COLORS,
  PDF_FONT_SIZES
} from '../utils/pdfUtils';
import { getCurrentUserName } from '../utils/getCurrentUser';

// ============= CONSTANTS =============

const WARDS = [
  { name: 'Ward 1', beds: Array.from({ length: 20 }, (_, i) => `W1-${i + 1}`) },
  { name: 'Ward 2', beds: Array.from({ length: 20 }, (_, i) => `W2-${i + 1}`) },
  { name: 'Ward 3', beds: Array.from({ length: 20 }, (_, i) => `W3-${i + 1}`) },
  { name: 'Ward 4', beds: Array.from({ length: 20 }, (_, i) => `W4-${i + 1}`) },
  { name: 'Ward 6A', beds: Array.from({ length: 20 }, (_, i) => `W6A-${i + 1}`) },
  { name: 'Ward 6B', beds: Array.from({ length: 20 }, (_, i) => `W6B-${i + 1}`) },
  { name: 'Ward 8', beds: Array.from({ length: 20 }, (_, i) => `W8-${i + 1}`) },
  { name: 'Ward 9', beds: Array.from({ length: 20 }, (_, i) => `W9-${i + 1}`) },
  { name: 'Ward 10', beds: Array.from({ length: 20 }, (_, i) => `W10-${i + 1}`) },
  { name: 'Oncology Ward', beds: Array.from({ length: 15 }, (_, i) => `ONCO-${i + 1}`) },
  { name: 'Male Medical Extension', beds: Array.from({ length: 15 }, (_, i) => `MMWE-${i + 1}`) },
  { name: 'Psychiatric Ward', beds: Array.from({ length: 15 }, (_, i) => `PSYCH-${i + 1}`) },
  { name: 'Male Medical Ward', beds: Array.from({ length: 20 }, (_, i) => `MMW-${i + 1}`) },
  { name: 'Female Medical Ward', beds: Array.from({ length: 20 }, (_, i) => `FMW-${i + 1}`) },
  { name: 'Private Suite - Pink Room', beds: Array.from({ length: 5 }, (_, i) => `PS-PK-${i + 1}`) },
  { name: 'Private Suite - White Room', beds: Array.from({ length: 5 }, (_, i) => `PS-WH-${i + 1}`) },
  { name: 'Private Suite - Purple Room', beds: Array.from({ length: 5 }, (_, i) => `PS-PR-${i + 1}`) },
  { name: 'Private Suite - Blue Room', beds: Array.from({ length: 5 }, (_, i) => `PS-BL-${i + 1}`) },
  { name: 'CHER', beds: Array.from({ length: 20 }, (_, i) => `CHER-${i + 1}`) },
  { name: 'New Born', beds: Array.from({ length: 15 }, (_, i) => `NB-${i + 1}`) },
  { name: 'Medical Emergency', beds: Array.from({ length: 15 }, (_, i) => `MED-EM-${i + 1}`) },
  { name: 'Surgical Emergency', beds: Array.from({ length: 15 }, (_, i) => `SURG-EM-${i + 1}`) },
  { name: 'Labour Ward', beds: Array.from({ length: 15 }, (_, i) => `LW-${i + 1}`) },
  { name: 'PICU', beds: Array.from({ length: 10 }, (_, i) => `PICU-${i + 1}`) },
  { name: 'ICU', beds: Array.from({ length: 12 }, (_, i) => `ICU-${i + 1}`) },
];

const SPECIALTIES = [
  'General Surgery', 'Internal Medicine', 'Orthopedics', 'Pediatrics',
  'Neurosurgery', 'Cardiothoracic Surgery', 'Burns Unit', 'Emergency Medicine',
  'Endocrinology', 'Nephrology', 'Cardiology', 'Oncology', 'Other'
];

const CONSULTANTS = ['Dr Okwesili', 'Dr Nnadi', 'Dr Eze C. B'];

const ADMITTING_UNITS = [
  { id: 'PS-UNIT-1', name: 'PS-UNIT 1 (Dr Okwesili / Dr Nnadi)', consultants: ['Dr Okwesili', 'Dr Nnadi'] },
  { id: 'PS-UNIT-2', name: 'PS-UNIT 2 (Dr Okwesili / Dr Eze C. B)', consultants: ['Dr Okwesili', 'Dr Eze C. B'] },
];

const CLINICS = ['Outpatient Clinic', 'Hand Clinic', 'Burns Clinic', 'Wound Clinic', 'Reconstructive Clinic'];

// ============= HELPERS =============

function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

// ============= MAIN COMPONENT =============

export default function AdmissionDischargePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'admit' | 'discharge' | 'history' | 'stats'>('active');
  const [patients, setPatients] = useState<any[]>([]);
  const [activeAdmissions, setActiveAdmissions] = useState<Admission[]>([]);
  const [discharges, setDischarges] = useState<Discharge[]>([]);
  const [statistics, setStatistics] = useState<AdmissionStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // First, sync any unsynced admissions
      console.log('Checking for unsynced admissions...');
      await admissionDischargeService.syncUnsyncedAdmissions();
      
      // Then load all data
      const [patientsData, admissionsData, dischargesData, statsData] = await Promise.all([
        patientService.getAllPatients(),
        admissionDischargeService.getActiveAdmissions(),
        admissionDischargeService.getAllDischarges(),
        admissionDischargeService.getStatistics()
      ]);
      setPatients(patientsData);
      setActiveAdmissions(admissionsData);
      setDischarges(dischargesData);
      setStatistics(statsData);
      console.log('Data loaded successfully');
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAdmissions = activeAdmissions.filter(admission =>
    (admission.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.hospital_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (admission.ward_location || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="border-b border-gray-200 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-lg">
          <h1 className="text-lg sm:text-2xl font-bold">Admission & Discharge Management</h1>
          <p className="text-green-100 mt-1">Plastic and Reconstructive Surgery Unit</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-gray-200 bg-gray-50">
          {[
            { id: 'active', label: 'Active Patients', count: activeAdmissions.length },
            { id: 'admit', label: 'New Admission' },
            { id: 'discharge', label: 'Discharge Patient' },
            { id: 'history', label: 'Discharge History' },
            { id: 'stats', label: 'Statistics' }
          ].map(tab => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'text-green-600 border-b-2 border-green-600 bg-white'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading...</p>
            </div>
          ) : (
            <>
              {activeTab === 'active' && (
                <ActivePatientsTab 
                  admissions={filteredAdmissions} 
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  onDischarge={(admission) => {
                    setActiveTab('discharge');
                    // Pass selected admission to discharge tab
                  }}
                  onRefresh={loadData}
                  navigate={navigate}
                />
              )}
              
              {activeTab === 'admit' && (
                <NewAdmissionTab 
                  patients={patients} 
                  onSuccess={() => {
                    loadData();
                    setActiveTab('active');
                  }}
                />
              )}
              
              {activeTab === 'discharge' && (
                <DischargeTab 
                  activeAdmissions={activeAdmissions}
                  onSuccess={() => {
                    loadData();
                    setActiveTab('history');
                  }}
                />
              )}
              
              {activeTab === 'history' && (
                <DischargeHistoryTab 
                  discharges={discharges}
                  onRefresh={loadData}
                />
              )}
              
              {activeTab === 'stats' && statistics && (
                <StatisticsTab statistics={statistics} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= ACTIVE PATIENTS TAB =============

interface ActivePatientsTabProps {
  admissions: Admission[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onDischarge: (admission: Admission) => void;
  onRefresh: () => void;
  navigate: (path: string) => void;
}

function ActivePatientsTab({ admissions, searchTerm, setSearchTerm, onDischarge, onRefresh, navigate }: ActivePatientsTabProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [preopData, setPreopData] = useState<Record<number, PreoperativeAssessment | null>>({});
  const [loadingPreop, setLoadingPreop] = useState<number | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const handleExpand = async (admission: Admission) => {
    const id = admission.id!;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    
    // Load preoperative assessment if not cached
    if (preopData[id] === undefined) {
      setLoadingPreop(id);
      try {
        const assessment = await preoperativeService.getAssessmentByPatient(String(admission.patient_id));
        setPreopData(prev => ({ ...prev, [id]: assessment }));
      } catch (error) {
        console.error('Error loading preoperative assessment:', error);
        setPreopData(prev => ({ ...prev, [id]: null }));
      } finally {
        setLoadingPreop(null);
      }
    }
  };

  // -- PDF Document Generation Helpers --
  const generatePreopEducationPDF = async (admission: Admission, assessment: PreoperativeAssessment | null) => {
    setGeneratingPdf('preop-education');
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Pre-Operative Patient Education & Information');
      
      y = addSectionHeader(doc, 'Patient Information', y);
      y = addLabeledField(doc, 'Patient Name', admission.patient_name || 'N/A', y);
      y = addLabeledField(doc, 'Hospital Number', admission.hospital_number || 'N/A', y);
      y = addLabeledField(doc, 'Admission Date', formatDateForPDF(admission.admission_date), y);
      y = addLabeledField(doc, 'Diagnosis', admission.provisional_diagnosis || 'N/A', y);
      y = addSeparator(doc, y);

      y = addSectionHeader(doc, 'Before Your Surgery', y);
      y = addBulletList(doc, [
        'You must not eat solid food for at least 6 hours before your surgery.',
        'You may drink clear fluids (water, clear juice) up to 2 hours before surgery.',
        'Please take a bath or shower on the morning of your operation.',
        'Remove all jewelry, nail polish, and makeup before coming to the operating theatre.',
        'Wear loose, comfortable clothing. Hospital gowns will be provided.',
        'Bring a list of all your medications and any allergies.',
      ], y);
      y = addSeparator(doc, y);

      if (assessment) {
        y = addSectionHeader(doc, 'Your Risk Assessment Summary', y);
        if (assessment.bleeding_risk) {
          y = addLabeledField(doc, 'Bleeding Risk', `${assessment.bleeding_risk.risk_level} (Score: ${assessment.bleeding_risk.total_score})`, y);
        }
        if (assessment.dvt_risk) {
          y = addLabeledField(doc, 'DVT Risk (Caprini)', `${assessment.dvt_risk.risk_level} (Score: ${assessment.dvt_risk.total_score})`, y);
        }
        if (assessment.cardiovascular_risk) {
          y = addLabeledField(doc, 'Cardiovascular Risk (RCRI)', `${assessment.cardiovascular_risk.risk_level} (Score: ${assessment.cardiovascular_risk.total_score})`, y);
        }
        if (assessment.pressure_sore_risk) {
          y = addLabeledField(doc, 'Pressure Sore Risk (Braden)', `${assessment.pressure_sore_risk.risk_level} (Score: ${assessment.pressure_sore_risk.total_score})`, y);
        }
        y = addSeparator(doc, y);

        if (assessment.preop_instructions) {
          y = addSectionHeader(doc, 'Personalized Pre-Operative Instructions', y);
          y = addBodyText(doc, sanitizeTextForPDF(assessment.preop_instructions), y);
          y = addSeparator(doc, y);
        }
      }

      y = addSectionHeader(doc, 'What to Expect on Surgery Day', y);
      y = addBulletList(doc, [
        'You will be checked in and asked to change into a hospital gown.',
        'An IV (intravenous line) will be placed for fluids and medications.',
        'The anaesthetist will visit you to explain the anaesthesia plan.',
        'Your surgeon will mark the surgical site and confirm the procedure with you.',
        'You may feel drowsy after the anaesthesia - this is normal.',
      ], y);

      y = addSectionHeader(doc, 'Important Contact Numbers', y);
      y = addBodyText(doc, 'If you have any questions or concerns before your surgery, please contact the Plastic Surgery Unit during office hours.', y);
      
      addFooter(doc, `Generated: ${new Date().toLocaleString()} | ${admission.patient_name}`);
      doc.save(`PreOp_Education_${(admission.patient_name || 'patient').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating preop education PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const generatePostopEducationPDF = async (admission: Admission) => {
    setGeneratingPdf('postop-education');
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Post-Operative Patient Education & Information');
      
      y = addSectionHeader(doc, 'Patient Information', y);
      y = addLabeledField(doc, 'Patient Name', admission.patient_name || 'N/A', y);
      y = addLabeledField(doc, 'Hospital Number', admission.hospital_number || 'N/A', y);
      y = addLabeledField(doc, 'Procedure/Diagnosis', admission.provisional_diagnosis || 'N/A', y);
      y = addSeparator(doc, y);

      y = addSectionHeader(doc, 'After Your Surgery', y);
      y = addBulletList(doc, [
        'Rest as much as possible in the first 24-48 hours after surgery.',
        'Take your pain medications as prescribed. Do not wait until pain becomes severe.',
        'Keep the surgical site clean and dry unless otherwise instructed.',
        'Do NOT remove dressings unless instructed by your doctor.',
        'Elevate the operated area to reduce swelling where applicable.',
      ], y);
      y = addSeparator(doc, y);

      y = addSectionHeader(doc, 'Wound Care Instructions', y);
      y = addBulletList(doc, [
        'Keep your wound dressing intact until your next clinic appointment.',
        'If the dressing becomes soaked with blood, apply gentle pressure and contact us.',
        'Do not immerse the wound in water (no swimming/bathing) until cleared by your doctor.',
        'Watch for signs of infection: increasing redness, swelling, warmth, pus, or fever.',
        'Follow-up appointments are crucial for wound assessment and suture removal.',
      ], y);
      y = addSeparator(doc, y);

      y = addSectionHeader(doc, 'Activity Restrictions', y);
      y = addBulletList(doc, [
        'Avoid heavy lifting (more than 5 kg) for the specified recovery period.',
        'Avoid strenuous exercise until cleared by your surgeon.',
        'You may walk and do light activities unless told otherwise.',
        'Do not drive for at least 24 hours after general anaesthesia.',
      ], y);
      y = addSeparator(doc, y);

      y = addWarningBox(doc, 'WARNING', ['SEEK IMMEDIATE MEDICAL ATTENTION if you experience: severe/increasing pain not relieved by medication, heavy bleeding from the wound, fever above 38.5\u00B0C, difficulty breathing, severe nausea/vomiting, or any sudden change in your condition.'], y);

      y = addSectionHeader(doc, 'Follow-Up', y);
      y = addBodyText(doc, 'Please attend your follow-up appointment as scheduled. If you need to reschedule, contact the Plastic Surgery Unit during office hours.', y);
      
      addFooter(doc, `Generated: ${new Date().toLocaleString()} | ${admission.patient_name}`);
      doc.save(`PostOp_Education_${(admission.patient_name || 'patient').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating postop education PDF:', error);
      alert('Failed to generate PDF.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const generateCounsellingPDF = async (admission: Admission, assessment: PreoperativeAssessment | null) => {
    setGeneratingPdf('counselling');
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Patient Counselling Record');
      
      y = addSectionHeader(doc, 'Patient Information', y);
      y = addLabeledField(doc, 'Patient Name', admission.patient_name || 'N/A', y);
      y = addLabeledField(doc, 'Hospital Number', admission.hospital_number || 'N/A', y);
      y = addLabeledField(doc, 'Age/Gender', `${admission.age || 'N/A'} years / ${admission.gender || 'N/A'}`, y);
      y = addLabeledField(doc, 'Diagnosis', admission.provisional_diagnosis || 'N/A', y);
      y = addLabeledField(doc, 'Admission Date', formatDateForPDF(admission.admission_date), y);
      y = addSeparator(doc, y);

      y = addSectionHeader(doc, 'Pre-Operative Counselling', y);
      y = addBodyText(doc, 'The following points were discussed with the patient and/or their guardian/next of kin:', y);
      y += 4;
      y = addBulletList(doc, [
        'Nature of the condition/diagnosis and its implications.',
        'Proposed surgical procedure and its goals/expected outcomes.',
        'Alternative treatment options (including non-surgical management).',
        'Potential risks and complications of the proposed procedure.',
        'Expected recovery timeline and rehabilitation requirements.',
        'Post-operative care requirements and follow-up schedule.',
        'Activity restrictions and lifestyle modifications during recovery.',
        'Medications that will be prescribed and their side effects.',
      ], y);
      y = addSeparator(doc, y);

      if (assessment?.comprehensive_summary) {
        y = addSectionHeader(doc, 'Clinical Assessment Summary', y);
        y = addBodyText(doc, sanitizeTextForPDF(assessment.comprehensive_summary), y);
        y = addSeparator(doc, y);
      }

      y = addSectionHeader(doc, 'Patient Understanding', y);
      y = addBodyText(doc, 'The patient has been given the opportunity to ask questions and has expressed understanding of the above information.', y);
      y += 10;

      y = addLabeledField(doc, 'Patient/Guardian Signature', '______________________________', y);
      y = addLabeledField(doc, 'Date', '______________________________', y);
      y += 6;
      y = addLabeledField(doc, 'Counselled By (Doctor)', '______________________________', y);
      y = addLabeledField(doc, 'Signature', '______________________________', y);
      y = addLabeledField(doc, 'Date', '______________________________', y);

      addFooter(doc, `Generated: ${new Date().toLocaleString()} | ${admission.patient_name}`);
      doc.save(`Counselling_${(admission.patient_name || 'patient').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating counselling PDF:', error);
      alert('Failed to generate PDF.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const generateConsentFormPDF = async (admission: Admission) => {
    setGeneratingPdf('consent');
    try {
      const doc = createPDF();
      let y = addPDFHeader(doc, 'Informed Consent for Surgery');
      
      y = addSectionHeader(doc, 'Patient Details', y);
      y = addLabeledField(doc, 'Patient Name', admission.patient_name || 'N/A', y);
      y = addLabeledField(doc, 'Hospital Number', admission.hospital_number || 'N/A', y);
      y = addLabeledField(doc, 'Age/Gender', `${admission.age || 'N/A'} years / ${admission.gender || 'N/A'}`, y);
      y = addLabeledField(doc, 'Ward/Bed', `${admission.ward_location || 'N/A'} / ${admission.bed_number || 'N/A'}`, y);
      y = addSeparator(doc, y);

      y = addSectionHeader(doc, 'Diagnosis', y);
      y = addBodyText(doc, admission.provisional_diagnosis || 'To be specified by the surgeon', y);
      y += 4;

      y = addSectionHeader(doc, 'Proposed Operation/Procedure', y);
      y = addBodyText(doc, '________________________________________________________________', y);
      y = addBodyText(doc, '________________________________________________________________', y);
      y += 4;

      y = addSectionHeader(doc, 'Statement of Patient/Guardian', y);
      y = addBodyText(doc, 'I, the undersigned, hereby confirm that:', y);
      y += 3;
      y = addBulletList(doc, [
        'I have been informed about my condition and the proposed surgical procedure.',
        'The nature, purpose, expected benefits, and possible risks/complications have been explained to me.',
        'I have been informed of alternative treatment options.',
        'I have had the opportunity to ask questions and all my questions have been answered satisfactorily.',
        'I understand that the surgical outcome cannot be guaranteed.',
        'I consent to the administration of anaesthesia as deemed necessary by the anaesthetist.',
        'I consent to any additional procedure that may be found necessary during surgery.',
        'I understand I can withdraw my consent at any time before the procedure.',
      ], y);
      y += 6;

      y = addSectionHeader(doc, 'Allergies', y);
      y = addLabeledField(doc, 'Known Allergies', admission.allergies || 'None reported', y);
      y += 4;

      y = addSectionHeader(doc, 'Signatures', y);
      y += 4;
      y = addLabeledField(doc, 'Patient Name (Print)', '______________________________', y);
      y = addLabeledField(doc, 'Patient/Guardian Signature', '______________________________', y);
      y = addLabeledField(doc, 'Date & Time', '______________________________', y);
      y += 6;
      y = addLabeledField(doc, 'Witness Name', '______________________________', y);
      y = addLabeledField(doc, 'Witness Signature', '______________________________', y);
      y += 6;
      y = addLabeledField(doc, 'Surgeon Name', admission.admitting_consultant || '______________________________', y);
      y = addLabeledField(doc, 'Surgeon Signature', '______________________________', y);
      y = addLabeledField(doc, 'Date & Time', '______________________________', y);

      addFooter(doc, `Generated: ${new Date().toLocaleString()} | ${admission.patient_name}`);
      doc.save(`Consent_Form_${(admission.patient_name || 'patient').replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating consent form PDF:', error);
      alert('Failed to generate PDF.');
    } finally {
      setGeneratingPdf(null);
    }
  };

  // Risk level badge color helper
  const riskBadge = (level?: string) => {
    if (!level) return 'bg-gray-100 text-gray-600';
    const l = level.toLowerCase();
    if (l.includes('high') || l.includes('severe')) return 'bg-red-100 text-red-700';
    if (l.includes('moderate') || l.includes('medium')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  return (
    <div>
      {/* Search Bar */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by patient name, hospital number, or ward..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Refresh
        </button>
      </div>

      {/* Patients Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Hospital No.</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ward/Bed</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Admission Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Days</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Diagnosis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Route</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {admissions.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                  No active admissions found
                </td>
              </tr>
            ) : (
              admissions.map((admission) => {
                const daysAdmitted = Math.ceil(
                  (new Date().getTime() - new Date(admission.admission_date).getTime()) / (1000 * 60 * 60 * 24)
                );
                const isExpanded = expandedId === admission.id;
                const assessment = preopData[admission.id!];
                return (
                  <React.Fragment key={admission.id}>
                    <tr className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-green-50' : ''}`}
                        onClick={() => handleExpand(admission)}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{admission.patient_name}</div>
                        <div className="text-xs text-gray-500">{admission.age}y / {admission.gender}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{admission.hospital_number}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="font-medium">{admission.ward_location}</span>
                        {admission.bed_number && <span className="text-gray-500"> / {admission.bed_number}</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(admission.admission_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          daysAdmitted > 14 ? 'bg-red-100 text-red-700' :
                          daysAdmitted > 7 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {daysAdmitted}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="max-w-xs truncate">{admission.provisional_diagnosis}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          admission.route_of_admission === 'emergency' ? 'bg-red-100 text-red-700' :
                          admission.route_of_admission === 'consult_transfer' ? 'bg-purple-100 text-purple-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {String(admission.route_of_admission || 'clinic').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => admission.patient_id && navigate(`/patients/${admission.patient_id}`)}
                            className="text-blue-600 hover:text-blue-800"
                            disabled={!admission.patient_id}
                          >
                            View
                          </button>
                          <button 
                            onClick={() => onDischarge(admission)}
                            className="text-green-600 hover:text-green-800"
                          >
                            Discharge
                          </button>
                          <button
                            onClick={() => handleExpand(admission)}
                            className="text-purple-600 hover:text-purple-800"
                          >
                            {isExpanded ? 'Close' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* -- EXPANDED DETAIL ROW: Preop Planning + Document Downloads -- */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="px-4 py-4 bg-gray-50 border-t border-b border-green-200">
                          <div className="space-y-4">
                            {/* Preoperative Assessment */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <span className="text-lg">??</span> Preoperative Planning
                              </h4>
                              {loadingPreop === admission.id ? (
                                <div className="flex items-center gap-2 text-gray-500">
                                  <div className="animate-spin h-4 w-4 border-2 border-green-600 border-t-transparent rounded-full"></div>
                                  Loading assessment...
                                </div>
                              ) : assessment ? (
                                <div className="space-y-3">
                                  {/* Risk Scores Grid */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {assessment.bleeding_risk && (
                                      <div className="bg-gray-50 p-3 rounded border">
                                        <div className="text-xs text-gray-500 mb-1">Bleeding Risk</div>
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${riskBadge(assessment.bleeding_risk.risk_level)}`}>
                                          {assessment.bleeding_risk.risk_level} ({assessment.bleeding_risk.total_score})
                                        </span>
                                      </div>
                                    )}
                                    {assessment.dvt_risk && (
                                      <div className="bg-gray-50 p-3 rounded border">
                                        <div className="text-xs text-gray-500 mb-1">DVT Risk (Caprini)</div>
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${riskBadge(assessment.dvt_risk.risk_level)}`}>
                                          {assessment.dvt_risk.risk_level} ({assessment.dvt_risk.total_score})
                                        </span>
                                      </div>
                                    )}
                                    {assessment.cardiovascular_risk && (
                                      <div className="bg-gray-50 p-3 rounded border">
                                        <div className="text-xs text-gray-500 mb-1">Cardiac Risk (RCRI)</div>
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${riskBadge(assessment.cardiovascular_risk.risk_level)}`}>
                                          {assessment.cardiovascular_risk.risk_level} ({assessment.cardiovascular_risk.total_score})
                                        </span>
                                      </div>
                                    )}
                                    {assessment.pressure_sore_risk && (
                                      <div className="bg-gray-50 p-3 rounded border">
                                        <div className="text-xs text-gray-500 mb-1">Pressure Sore (Braden)</div>
                                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${riskBadge(assessment.pressure_sore_risk.risk_level)}`}>
                                          {assessment.pressure_sore_risk.risk_level} ({assessment.pressure_sore_risk.total_score})
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Consent & Insurance Status */}
                                  <div className="flex gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                      <span className={`w-3 h-3 rounded-full ${assessment.consent_document ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                      Consent: {assessment.consent_document ? 'Obtained' : 'Pending'}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={`w-3 h-3 rounded-full ${assessment.insurance_covered ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                      Insurance: {assessment.insurance_covered ? 'Covered' : 'Not Covered/Pending'}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className={`w-3 h-3 rounded-full ${assessment.payment_evidence ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                      Payment: {assessment.payment_evidence ? 'Confirmed' : 'Pending'}
                                    </div>
                                  </div>

                                  {/* Comprehensive Summary */}
                                  {assessment.comprehensive_summary && (
                                    <details className="border rounded p-3 bg-gray-50">
                                      <summary className="cursor-pointer text-sm font-medium text-gray-700">
                                        View Comprehensive Summary
                                      </summary>
                                      <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">
                                        {assessment.comprehensive_summary}
                                      </p>
                                    </details>
                                  )}

                                  {/* Current Medications */}
                                  {assessment.current_medications && assessment.current_medications.length > 0 && (
                                    <div className="text-sm">
                                      <span className="font-medium text-gray-700">Current Medications: </span>
                                      {assessment.current_medications.map((m: any) => 
                                        typeof m === 'string' ? m : `${m.name} ${m.dose || ''}`
                                      ).join(', ')}
                                    </div>
                                  )}

                                  <div className="text-xs text-gray-400">
                                    Assessed by: {assessment.assessed_by || 'N/A'} | 
                                    Date: {assessment.assessed_at ? new Date(assessment.assessed_at).toLocaleDateString() : 'N/A'}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-500 italic">
                                  No preoperative assessment found for this patient. 
                                  <button 
                                    onClick={() => navigate(`/booking-register?patientId=${admission.patient_id}`)}
                                    className="ml-2 text-green-600 hover:text-green-800 underline"
                                  >
                                    Create Assessment
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Clinical Details */}
                            {(admission.vital_signs || admission.allergies || admission.comorbidities) && (
                              <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <span className="text-lg">??</span> Clinical Details
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                  {admission.vital_signs && (
                                    <div>
                                      <span className="font-medium text-gray-700">Vital Signs:</span>
                                      <div className="text-gray-600">
                                        {admission.vital_signs.temperature && <span>Temp: {admission.vital_signs.temperature}�C | </span>}
                                        {admission.vital_signs.blood_pressure && <span>BP: {admission.vital_signs.blood_pressure} | </span>}
                                        {admission.vital_signs.pulse && <span>HR: {admission.vital_signs.pulse} | </span>}
                                        {admission.vital_signs.respiratory_rate && <span>RR: {admission.vital_signs.respiratory_rate} | </span>}
                                        {admission.vital_signs.oxygen_saturation && <span>SpO2: {admission.vital_signs.oxygen_saturation}%</span>}
                                      </div>
                                    </div>
                                  )}
                                  {admission.allergies && (
                                    <div>
                                      <span className="font-medium text-gray-700">Allergies: </span>
                                      <span className="text-red-600">{admission.allergies}</span>
                                    </div>
                                  )}
                                  {admission.comorbidities && admission.comorbidities.length > 0 && (
                                    <div>
                                      <span className="font-medium text-gray-700">Comorbidities: </span>
                                      <span className="text-gray-600">{Array.isArray(admission.comorbidities) ? admission.comorbidities.join(', ') : admission.comorbidities}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Document Downloads */}
                            <div className="bg-white p-4 rounded-lg border border-gray-200">
                              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                <span className="text-lg">??</span> Download Documents
                              </h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <button
                                  onClick={() => generatePreopEducationPDF(admission, assessment)}
                                  disabled={generatingPdf !== null}
                                  className="flex flex-col items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                                >
                                  <span className="text-2xl">??</span>
                                  <span className="text-xs font-medium text-blue-800 text-center">
                                    {generatingPdf === 'preop-education' ? 'Generating...' : 'Pre-Op Education'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => generatePostopEducationPDF(admission)}
                                  disabled={generatingPdf !== null}
                                  className="flex flex-col items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
                                >
                                  <span className="text-2xl">??</span>
                                  <span className="text-xs font-medium text-green-800 text-center">
                                    {generatingPdf === 'postop-education' ? 'Generating...' : 'Post-Op Education'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => generateCounsellingPDF(admission, assessment)}
                                  disabled={generatingPdf !== null}
                                  className="flex flex-col items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                >
                                  <span className="text-2xl">??</span>
                                  <span className="text-xs font-medium text-purple-800 text-center">
                                    {generatingPdf === 'counselling' ? 'Generating...' : 'Counselling Record'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => generateConsentFormPDF(admission)}
                                  disabled={generatingPdf !== null}
                                  className="flex flex-col items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                                >
                                  <span className="text-2xl">??</span>
                                  <span className="text-xs font-medium text-red-800 text-center">
                                    {generatingPdf === 'consent' ? 'Generating...' : 'Consent Form'}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= NEW ADMISSION TAB =============

interface NewAdmissionTabProps {
  patients: any[];
  onSuccess: () => void;
}

function NewAdmissionTab({ patients, onSuccess }: NewAdmissionTabProps) {
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  // Form state
  const [wardLocation, setWardLocation] = useState('');
  const [bedNumber, setBedNumber] = useState('');
  const [routeOfAdmission, setRouteOfAdmission] = useState<'clinic' | 'emergency' | 'consult_transfer'>('clinic');
  const [referringSpecialty, setReferringSpecialty] = useState('');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [reasonsForAdmission, setReasonsForAdmission] = useState('');
  const [presentingComplaint, setPresentingComplaint] = useState('');
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('');
  const [admittingConsultant, setAdmittingConsultant] = useState('');
  const [admittingUnit, setAdmittingUnit] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  
  // Medical Team Assignment
  const [seniorRegistrars, setSeniorRegistrars] = useState<StaffByRole[]>([]);
  const [registrars, setRegistrars] = useState<StaffByRole[]>([]);
  const [houseOfficers, setHouseOfficers] = useState<StaffByRole[]>([]);
  const [selectedSeniorRegistrar, setSelectedSeniorRegistrar] = useState<number | null>(null);
  const [selectedRegistrar, setSelectedRegistrar] = useState<number | null>(null);
  const [selectedHouseOfficer, setSelectedHouseOfficer] = useState<number | null>(null);
  const [loadingTeam, setLoadingTeam] = useState(false);
  
  // Vitals
  const [temperature, setTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');

  // History
  const [allergies, setAllergies] = useState('');
  const [comorbidities, setComorbidities] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [pastMedicalHistory, setPastMedicalHistory] = useState('');
  const [examinationFindings, setExaminationFindings] = useState('');
  const [initialManagementPlan, setInitialManagementPlan] = useState('');

  // Load medical team on mount
  useEffect(() => {
    loadMedicalTeam();
  }, []);

  const loadMedicalTeam = async () => {
    setLoadingTeam(true);
    try {
      // Fetch all staff by role
      const [srData, regData, hoData] = await Promise.all([
        medicalTeamService.getStaffByRole('senior_registrar'),
        medicalTeamService.getStaffByRole('registrar'),
        medicalTeamService.getStaffByRole('house_officer')
      ]);

      setSeniorRegistrars(srData);
      setRegistrars(regData);
      setHouseOfficers(hoData);

      // Get suggested assignments (least loaded staff)
      const suggestions = await medicalTeamService.getSuggestedTeamAssignment();
      
      // Auto-select the suggested staff
      if (suggestions.senior_registrar) {
        setSelectedSeniorRegistrar(suggestions.senior_registrar.id);
      }
      if (suggestions.registrar) {
        setSelectedRegistrar(suggestions.registrar.id);
      }
      if (suggestions.house_officer) {
        setSelectedHouseOfficer(suggestions.house_officer.id);
      }

      console.log('Medical team loaded and auto-assigned');
    } catch (error) {
      console.error('Error loading medical team:', error);
    } finally {
      setLoadingTeam(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !wardLocation || !reasonsForAdmission || !provisionalDiagnosis || !admittingConsultant || !admittingUnit) {
      alert('Please fill in all required fields');
      return;
    }

    if (!selectedHouseOfficer) {
      alert('House Officer assignment is mandatory. Please assign a House Officer.');
      return;
    }

    if (!selectedSeniorRegistrar) {
      alert('Senior Registrar assignment is mandatory. Please assign a Senior Registrar.');
      return;
    }

    setLoading(true);
    try {
      // Create admission
      await admissionDischargeService.createAdmission({
        patient_id: selectedPatient.id,
        patient_name: `${selectedPatient.first_name} ${selectedPatient.last_name}`,
        hospital_number: selectedPatient.hospital_number,
        age: calculateAge(selectedPatient.date_of_birth || selectedPatient.dob) ?? undefined,
        gender: selectedPatient.gender,
        admission_date: new Date().toISOString().split('T')[0],
        admission_time: new Date().toTimeString().split(' ')[0],
        ward_location: wardLocation,
        bed_number: bedNumber,
        route_of_admission: routeOfAdmission,
        referring_specialty: routeOfAdmission === 'consult_transfer' ? referringSpecialty : undefined,
        referring_doctor: routeOfAdmission === 'consult_transfer' ? referringDoctor : undefined,
        reasons_for_admission: reasonsForAdmission,
        presenting_complaint: presentingComplaint,
        provisional_diagnosis: provisionalDiagnosis,
        admitting_doctor: getCurrentUserName(),
        admitting_consultant: admittingConsultant,
        admitting_unit: admittingUnit,
        vital_signs: {
          temperature: temperature ? parseFloat(temperature) : undefined,
          blood_pressure: bloodPressure,
          pulse: pulse ? parseInt(pulse) : undefined,
          respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
          oxygen_saturation: oxygenSaturation ? parseInt(oxygenSaturation) : undefined
        },
        allergies,
        comorbidities: comorbidities ? comorbidities.split(',').map(c => c.trim()) : [],
        current_medications: currentMedications,
        past_medical_history: pastMedicalHistory,
        examination_findings: examinationFindings,
        initial_management_plan: initialManagementPlan,
        status: 'active',
        created_by: getCurrentUserName()
      });

      // Create medical team assignment
      await medicalTeamService.createAssignmentWithTeam(
        selectedPatient.id,
        selectedPatient.hospital_number,
        {
          senior_registrar_id: selectedSeniorRegistrar,
          registrar_id: selectedRegistrar,
          house_officer_id: selectedHouseOfficer
        }
      );

      alert('Patient admitted successfully with medical team assigned!');
      onSuccess();
    } catch (error) {
      console.error('Error admitting patient:', error);
      alert('Failed to admit patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Patient Selection */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">Patient Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Patient <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedPatient?.id || ''}
              onChange={(e) => {
                const patient = patients.find(p => String(p.id) === e.target.value);
                setSelectedPatient(patient);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Select Patient --</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.first_name} {patient.last_name} ({patient.hospital_number})
                </option>
              ))}
            </select>
          </div>
          {selectedPatient && (
            <div className="bg-white p-3 rounded border border-blue-300">
              <p className="text-sm"><strong>Age:</strong> {calculateAge(selectedPatient.date_of_birth || selectedPatient.dob) ?? 'N/A'} years</p>
              <p className="text-sm"><strong>Gender:</strong> {selectedPatient.gender || 'N/A'}</p>
              <p className="text-sm"><strong>Phone:</strong> {selectedPatient.phone || 'N/A'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Admission Details */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Admission Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ward Location <span className="text-red-500">*</span>
            </label>
            <select
              value={wardLocation}
              onChange={(e) => { setWardLocation(e.target.value); setBedNumber(''); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Select Ward --</option>
              {WARDS.map((ward) => (
                <option key={ward.name} value={ward.name}>{ward.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bed Number</label>
            <select
              value={bedNumber}
              onChange={(e) => setBedNumber(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              disabled={!wardLocation}
            >
              <option value="">-- Select Bed --</option>
              {wardLocation && WARDS.find(w => w.name === wardLocation)?.beds.map((bed) => (
                <option key={bed} value={bed}>{bed}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admitting Unit <span className="text-red-500">*</span>
            </label>
            <select
              value={admittingUnit}
              onChange={(e) => {
                setAdmittingUnit(e.target.value);
                // Auto-clear consultant when unit changes
                setAdmittingConsultant('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Select Unit --</option>
              {ADMITTING_UNITS.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admitting Consultant <span className="text-red-500">*</span>
            </label>
            <select
              value={admittingConsultant}
              onChange={(e) => setAdmittingConsultant(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="">-- Select Consultant --</option>
              {(admittingUnit
                ? (ADMITTING_UNITS.find(u => u.id === admittingUnit)?.consultants || CONSULTANTS)
                : CONSULTANTS
              ).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Medical Team Assignment */}
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-purple-900">Medical Team Assignment</h3>
          <button
            type="button"
            onClick={loadMedicalTeam}
            className="text-sm px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
            disabled={loadingTeam}
          >
            {loadingTeam ? 'Loading...' : 'Refresh & Auto-Assign'}
          </button>
        </div>
        <p className="text-sm text-purple-700 mb-4">
          Team members are auto-assigned based on workload balance. You can change the selection if needed.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Senior Registrar (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senior Registrar <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSeniorRegistrar || ''}
              onChange={(e) => setSelectedSeniorRegistrar(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">-- Select Senior Registrar --</option>
              {seniorRegistrars.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.current_patients} patients)
                </option>
              ))}
            </select>
            {seniorRegistrars.length === 0 && !loadingTeam && (
              <p className="text-xs text-orange-600 mt-1">No senior registrars available</p>
            )}
          </div>

          {/* Registrar (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registrar <span className="text-gray-400 text-xs">(optional)</span>
            </label>
            <select
              value={selectedRegistrar || ''}
              onChange={(e) => setSelectedRegistrar(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">-- Select Registrar --</option>
              {registrars.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.current_patients} patients)
                </option>
              ))}
            </select>
            {registrars.length === 0 && !loadingTeam && (
              <p className="text-xs text-orange-600 mt-1">No registrars available</p>
            )}
          </div>

          {/* House Officer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              House Officer <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedHouseOfficer || ''}
              onChange={(e) => setSelectedHouseOfficer(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
              required
            >
              <option value="">-- Select House Officer --</option>
              {houseOfficers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.full_name} ({staff.current_patients} patients)
                </option>
              ))}
            </select>
            {houseOfficers.length === 0 && !loadingTeam && (
              <p className="text-xs text-orange-600 mt-1">No house officers available</p>
            )}
          </div>
        </div>

        {/* Additional Notes */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
          <textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
            rows={2}
            placeholder="Any additional notes about team assignment..."
          />
        </div>
      </div>

      {/* Route of Admission */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Route of Admission</h3>
        <div className="flex gap-6 mb-4">
          {[
            { value: 'clinic', label: 'Clinic' },
            { value: 'emergency', label: 'Emergency' },
            { value: 'consult_transfer', label: 'Consult Transfer' }
          ].map(route => (
            <label key={route.value} className="flex items-center cursor-pointer">
              <input
                type="radio"
                value={route.value}
                checked={routeOfAdmission === route.value}
                onChange={(e) => setRouteOfAdmission(e.target.value as any)}
                className="mr-2 text-green-600"
              />
              <span>{route.label}</span>
            </label>
          ))}
        </div>

        {routeOfAdmission === 'consult_transfer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-3 bg-purple-50 rounded border border-purple-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Referring Specialty <span className="text-red-500">*</span>
              </label>
              <select
                value={referringSpecialty}
                onChange={(e) => setReferringSpecialty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required={routeOfAdmission === 'consult_transfer'}
              >
                <option value="">-- Select Specialty --</option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Referring Doctor</label>
              <input
                type="text"
                value={referringDoctor}
                onChange={(e) => setReferringDoctor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Dr. Name"
              />
            </div>
          </div>
        )}
      </div>

      {/* Clinical Assessment */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Clinical Assessment</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reasons for Admission <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reasonsForAdmission}
              onChange={(e) => setReasonsForAdmission(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Presenting Complaint</label>
              <textarea
                value={presentingComplaint}
                onChange={(e) => setPresentingComplaint(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provisional Diagnosis <span className="text-red-500">*</span>
              </label>
              <textarea
                value={provisionalDiagnosis}
                onChange={(e) => setProvisionalDiagnosis(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          </div>
        </div>
      </div>

      {/* Vital Signs */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vital Signs</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temp (�C)</label>
            <input type="number" step="0.1" value={temperature} onChange={(e) => setTemperature(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="37.0" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BP (mmHg)</label>
            <input type="text" value={bloodPressure} onChange={(e) => setBloodPressure(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="120/80" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pulse (bpm)</label>
            <input type="number" value={pulse} onChange={(e) => setPulse(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="80" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RR (/min)</label>
            <input type="number" value={respiratoryRate} onChange={(e) => setRespiratoryRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="18" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SpO2 (%)</label>
            <input type="number" value={oxygenSaturation} onChange={(e) => setOxygenSaturation(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="98" />
          </div>
        </div>
      </div>

      {/* Medical History (Collapsible) */}
      <details className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <summary className="text-lg font-semibold text-gray-900 cursor-pointer">
          Medical History (Optional)
        </summary>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allergies</label>
            <input type="text" value={allergies} onChange={(e) => setAllergies(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., Penicillin, NSAIDs" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comorbidities</label>
            <input type="text" value={comorbidities} onChange={(e) => setComorbidities(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md" placeholder="e.g., Diabetes, Hypertension (comma-separated)" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
            <MedicalAutocompleteTextarea value={currentMedications} onChange={setCurrentMedications}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Past Medical History</label>
            <MedicalAutocompleteTextarea value={pastMedicalHistory} onChange={setPastMedicalHistory}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Examination Findings</label>
            <MedicalAutocompleteTextarea value={examinationFindings} onChange={setExaminationFindings}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Management Plan</label>
            <MedicalAutocompleteTextarea value={initialManagementPlan} onChange={setInitialManagementPlan}
              rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md" />
          </div>
        </div>
      </details>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <button type="submit" disabled={loading}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400">
          {loading ? 'Admitting...' : 'Admit Patient'}
        </button>
      </div>
    </form>
  );
}

// ============= DISCHARGE TAB - INTEGRATED WITH COMPONENTS =============

interface DischargeTabProps {
  activeAdmissions: Admission[];
  onSuccess: () => void;
}

function DischargeTab({ activeAdmissions, onSuccess }: DischargeTabProps) {
  const [selectedAdmission, setSelectedAdmission] = useState<Admission | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  
  // State to pass between steps
  const [whoScore, setWhoScore] = useState<WHODischargeScore | null>(null);
  const [medications, setMedications] = useState<DischargeMedication[]>([]);
  const [dischargeData, setDischargeData] = useState<Omit<Discharge, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const [completedDischarge, setCompletedDischarge] = useState<Discharge | null>(null);

  const steps = [
    { num: 1, title: 'Select Patient' },
    { num: 2, title: 'WHO Assessment' },
    { num: 3, title: 'MDT Medications' },
    { num: 4, title: 'Discharge Summary' },
    { num: 5, title: 'Documents' }
  ];

  // Reset workflow
  const resetWorkflow = () => {
    setSelectedAdmission(null);
    setCurrentStep(1);
    setWhoScore(null);
    setMedications([]);
    setDischargeData(null);
    setCompletedDischarge(null);
  };

  // Handle WHO score completion
  const handleWHOComplete = (score: WHODischargeScore) => {
    setWhoScore(score);
    setCurrentStep(3);
  };

  // Handle medications completion
  const handleMedicationsComplete = (meds: DischargeMedication[]) => {
    setMedications(meds);
    setCurrentStep(4);
  };

  // Handle summary completion
  const handleSummaryComplete = async (data: Omit<Discharge, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const id = await admissionDischargeService.createDischarge(data);
      const discharge = { ...data, id, created_at: new Date(), updated_at: new Date() } as Discharge;
      setCompletedDischarge(discharge);
      setCurrentStep(5);
    } catch (error) {
      console.error('Error creating discharge:', error);
      alert('Failed to create discharge. Please try again.');
    }
  };

  // Handle final completion
  const handleFinalComplete = async () => {
    if (selectedAdmission?.id) {
      try {
        await admissionDischargeService.markAsDischargedAdmission(selectedAdmission.id);
        alert('Patient discharged successfully!');
        resetWorkflow();
        onSuccess();
      } catch (error) {
        console.error('Error completing discharge:', error);
        alert('Discharge completed but there was an error updating admission status.');
        onSuccess();
      }
    } else {
      onSuccess();
    }
  };

  return (
    <div>
      {/* Step Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                  currentStep >= step.num ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {currentStep > step.num ? '?' : step.num}
                </div>
                <span className={`mt-1 text-xs ${currentStep >= step.num ? 'text-green-600' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${currentStep > step.num ? 'bg-green-600' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <DischargeStep1SelectPatient 
          admissions={activeAdmissions}
          selectedAdmission={selectedAdmission}
          onSelect={(admission) => setSelectedAdmission(admission)}
          onNext={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 2 && selectedAdmission && (
        <WHODischargeAssessment
          admission={selectedAdmission}
          onComplete={handleWHOComplete}
          onBack={() => setCurrentStep(1)}
        />
      )}

      {currentStep === 3 && selectedAdmission && whoScore && (
        <MDTDischargeMedications
          admission={selectedAdmission}
          onComplete={handleMedicationsComplete}
          onBack={() => setCurrentStep(2)}
        />
      )}

      {currentStep === 4 && selectedAdmission && whoScore && (
        <DischargeSummaryForm
          admission={selectedAdmission}
          whoScore={whoScore}
          medications={medications}
          onComplete={handleSummaryComplete}
          onBack={() => setCurrentStep(3)}
        />
      )}

      {currentStep === 5 && completedDischarge && (
        <DischargeDocumentsPreview
          discharge={completedDischarge}
          onComplete={handleFinalComplete}
          onBack={() => setCurrentStep(4)}
        />
      )}
    </div>
  );
}

// Step 1: Select Patient
interface DischargeStep1Props {
  admissions: Admission[];
  selectedAdmission: Admission | null;
  onSelect: (admission: Admission) => void;
  onNext: () => void;
}

function DischargeStep1SelectPatient({ admissions, selectedAdmission, onSelect, onNext }: DischargeStep1Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select Patient for Discharge</h3>
      
      <select
        value={selectedAdmission?.id || ''}
        onChange={(e) => {
          const admission = admissions.find(a => String(a.id) === e.target.value);
          if (admission) onSelect(admission);
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-md"
      >
        <option value="">-- Select Patient --</option>
        {admissions.map((admission) => (
          <option key={admission.id} value={admission.id}>
            {admission.patient_name} ({admission.hospital_number}) - {admission.ward_location}
          </option>
        ))}
      </select>

      {selectedAdmission && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-2">Selected Patient</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500">Name:</span> <strong>{selectedAdmission.patient_name}</strong></div>
            <div><span className="text-gray-500">Hospital No:</span> <strong>{selectedAdmission.hospital_number}</strong></div>
            <div><span className="text-gray-500">Ward:</span> <strong>{selectedAdmission.ward_location}</strong></div>
            <div><span className="text-gray-500">Admission Date:</span> <strong>{new Date(selectedAdmission.admission_date).toLocaleDateString()}</strong></div>
            <div className="col-span-2"><span className="text-gray-500">Diagnosis:</span> <strong>{selectedAdmission.provisional_diagnosis}</strong></div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!selectedAdmission}
          className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
        >
          Next: WHO Assessment 
        </button>
      </div>
    </div>
  );
}

// Step 2-5 are now using imported components: WHODischargeAssessment, MDTDischargeMedications, DischargeSummaryForm, DischargeDocumentsPreview

// ============= DISCHARGE HISTORY TAB =============

interface DischargeHistoryTabProps {
  discharges: Discharge[];
  onRefresh: () => void;
}

function DischargeHistoryTab({ discharges, onRefresh }: DischargeHistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDischarges = discharges.filter(d =>
    (d.patient_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.hospital_number || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-4 flex gap-4">
        <input
          type="text"
          placeholder="Search discharges..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
        />
        <button onClick={onRefresh} className="px-4 py-2 bg-gray-100 rounded-lg">Refresh</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Discharge Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Diagnosis</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">LOS</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDischarges.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">No discharge records found</td>
              </tr>
            ) : (
              filteredDischarges.map((discharge) => (
                <tr key={discharge.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium">{discharge.patient_name}</div>
                    <div className="text-xs text-gray-500">{discharge.hospital_number}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{new Date(discharge.discharge_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm"><div className="max-w-xs truncate">{discharge.final_diagnosis}</div></td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      discharge.discharge_type === 'normal' ? 'bg-green-100 text-green-700' :
                      discharge.discharge_type === 'on_request' ? 'bg-yellow-100 text-yellow-700' :
                      discharge.discharge_type === 'against_medical_advice' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {String(discharge.discharge_type || 'normal').replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{discharge.length_of_stay_days}d</td>
                  <td className="px-4 py-3 text-sm">
                    <button className="text-blue-600 hover:text-blue-800 mr-2">View</button>
                    <button className="text-green-600 hover:text-green-800">PDF</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============= STATISTICS TAB =============

interface StatisticsTabProps {
  statistics: AdmissionStatistics;
}

function StatisticsTab({ statistics }: StatisticsTabProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Key Metrics */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h4 className="text-sm font-medium text-blue-800">Total Admissions</h4>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600">{statistics.total_admissions}</p>
      </div>
      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
        <h4 className="text-sm font-medium text-green-800">Active Patients</h4>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600">{statistics.active_admissions}</p>
      </div>
      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <h4 className="text-sm font-medium text-purple-800">This Month</h4>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-purple-600">{statistics.admissions_this_month}</p>
        <p className="text-xs text-purple-600">{statistics.discharges_this_month} discharged</p>
      </div>
      <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
        <h4 className="text-sm font-medium text-orange-800">Avg. Length of Stay</h4>
        <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600">{statistics.average_length_of_stay.toFixed(1)}</p>
        <p className="text-xs text-orange-600">days</p>
      </div>

      {/* By Route */}
      <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Admissions by Route</h4>
        <div className="space-y-2">
          <div className="flex justify-between"><span>Clinic</span><span className="font-semibold text-blue-600">{statistics.by_route.clinic}</span></div>
          <div className="flex justify-between"><span>Emergency</span><span className="font-semibold text-red-600">{statistics.by_route.emergency}</span></div>
          <div className="flex justify-between"><span>Consult Transfer</span><span className="font-semibold text-purple-600">{statistics.by_route.consult_transfer}</span></div>
        </div>
      </div>

      {/* By Discharge Type */}
      <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Discharge Types</h4>
        <div className="space-y-2">
          <div className="flex justify-between"><span>Normal</span><span className="font-semibold text-green-600">{statistics.by_discharge_type.normal}</span></div>
          <div className="flex justify-between"><span>On Request</span><span className="font-semibold text-yellow-600">{statistics.by_discharge_type.on_request}</span></div>
          <div className="flex justify-between"><span>Against Medical Advice</span><span className="font-semibold text-red-600">{statistics.by_discharge_type.against_medical_advice}</span></div>
          <div className="flex justify-between"><span>Transfer</span><span className="font-semibold text-blue-600">{statistics.by_discharge_type.transfer}</span></div>
          <div className="flex justify-between"><span>Deceased</span><span className="font-semibold text-gray-600">{statistics.by_discharge_type.deceased}</span></div>
        </div>
      </div>

      {/* By Ward */}
      <div className="md:col-span-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 className="font-semibold mb-3">Current Patients by Ward</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(statistics.by_ward).map(([ward, count]) => (
            <div key={ward} className="flex justify-between bg-white p-2 rounded border">
              <span>{ward}</span>
              <span className="font-semibold text-green-600">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
