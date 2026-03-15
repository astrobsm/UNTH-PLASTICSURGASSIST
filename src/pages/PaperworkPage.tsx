import React, { useState, useEffect } from 'react';
import { FileText, Download, Plus, Send, Edit, Trash2, Printer } from 'lucide-react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { admissionService } from '../services/admissionService';
import { calculateAge } from '../utils/dateUtils';
import { treatmentPlanningService } from '../services/treatmentPlanningService';
import { labService } from '../services/labService';
import {
  paperworkService,
  PaperworkDocument,
  ConsultRequestData,
  DischargeSummaryData,
  MedicalReportData,
  PaperworkType
} from '../services/paperworkService';
import { format } from 'date-fns';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  addFooter
} from '../utils/pdfUtils';
import { useAuthStore } from '../store/authStore';

const PaperworkPage: React.FC = () => {
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<PaperworkDocument[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDocument, setSelectedDocument] = useState<PaperworkDocument | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [documentType, setDocumentType] = useState<PaperworkType>('consult_request');
  const [filter, setFilter] = useState<PaperworkType | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [docsData, patientsData] = await Promise.all([
        paperworkService.getRecentDocuments(50),
        patientService.getAllPatients()
      ]);
      setDocuments(docsData);
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading paperwork data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = filter === 'all' 
    ? documents 
    : documents.filter(d => d.type === filter);

  const exportToPDF = (doc: PaperworkDocument) => {
    const pdf = createPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPos = PDF_MARGINS.top;
    
    // Helper to sanitize text
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    // Header
    pdf.setFontSize(PDF_FONT_SIZES.title);
    pdf.setFont('times', 'bold');
    pdf.text(clean(doc.title).toUpperCase(), pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Content
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    const lines = pdf.splitTextToSize(clean(doc.content), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
    
    lines.forEach((line: string) => {
      if (yPos > 270) {
        pdf.addPage();
        yPos = PDF_MARGINS.top;
      }
      pdf.text(line, PDF_MARGINS.left, yPos);
      yPos += 5;
    });

    // Add professional footer with page numbers and timestamp
    addFooter(pdf);

    // Save
    const filename = doc.type + '_' + doc.hospital_number + '_' + format(new Date(), 'yyyy-MM-dd') + '.pdf';
    pdf.save(filename);
  };

  // Thermal 80mm PDF export
  const exportToThermalPDF = async (doc: PaperworkDocument) => {
    const { jsPDF } = await import('jspdf');
    const thermalWidth = 80;
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    const contentLen = (doc.content || '').length;
    const estHeight = Math.max(100 + contentLen * 0.15, 200);

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
    const m = 3;
    let y = m;

    pdf.setFont('times', 'bold');
    pdf.setFontSize(12);
    const titleLines = pdf.splitTextToSize(clean(doc.title).toUpperCase(), thermalWidth - m * 2);
    titleLines.forEach((line: string) => { pdf.text(line, thermalWidth / 2, y, { align: 'center' }); y += 4.5; });
    y += 2;

    pdf.setFontSize(8);
    pdf.setFont('times', 'normal');
    pdf.text('UNTH Plastic Surgery Unit', thermalWidth / 2, y, { align: 'center' });
    y += 4;
    pdf.line(m, y, thermalWidth - m, y);
    y += 4;

    pdf.setFontSize(9);
    const lines = pdf.splitTextToSize(clean(doc.content), thermalWidth - m * 2);
    lines.forEach((line: string) => { pdf.text(line, m, y); y += 3.5; });

    const filename = doc.type + '_Thermal_' + doc.hospital_number + '_' + format(new Date(), 'yyyy-MM-dd') + '.pdf';
    pdf.save(filename);
  };

  const ConsultRequestForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [formData, setFormData] = useState<ConsultRequestData>({
      patient_id: '',
      patient_name: '',
      hospital_number: '',
      consulting_department: '',
      reason_for_consult: '',
      relevant_history: '',
      current_medications: '',
      examination_findings: '',
      investigations: '',
      specific_question: '',
      urgency: 'routine'
    });
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await paperworkService.generateConsultRequest(formData, user?.email || 'Unknown');
        loadData();
        onClose();
      } catch (error) {
        console.error('Error creating consult request:', error);
      }
    };

    const handlePatientSelect = async (patientId: string) => {
      const patient = patients.find(p => p.id === parseInt(patientId));
      if (patient) {
        setSelectedPatient(patient);
        setLoadingData(true);

        try {
          // Fetch current medications from active treatment plan
          const treatmentPlans = await treatmentPlanningService.getPatientTreatmentPlans(patientId);
          const activePlan = treatmentPlans.find(p => p.status === 'active');
          let medicationsText = '';
          if (activePlan && activePlan.medications && activePlan.medications.length > 0) {
            medicationsText = activePlan.medications
              .filter(med => med.status === 'active')
              .map(med => `${med.medication_name} ${med.dosage} ${med.route} ${med.frequency}`)
              .join('\n');
          }

          // Fetch examination findings from active admission
          const patientAdmissions = await admissionService.getPatientAdmissions(parseInt(patientId));
          const activeAdmission = patientAdmissions.find(a => a.status === 'active');
          let examinationText = '';
          if (activeAdmission && activeAdmission.examination_findings) {
            examinationText = activeAdmission.examination_findings;
          }

          // Fetch recent lab investigations
          const labInvestigations = await labService.getLabInvestigations(patientId);
          let investigationsText = '';
          if (labInvestigations && labInvestigations.length > 0) {
            // Get most recent completed investigations (last 5)
            const recentLabs = labInvestigations
              .filter(lab => lab.status === 'completed')
              .sort((a, b) => new Date(b.request_date).getTime() - new Date(a.request_date).getTime())
              .slice(0, 5);
            
            if (recentLabs.length > 0) {
              investigationsText = recentLabs
                .map(lab => {
                  const date = format(new Date(lab.request_date), 'dd/MM/yyyy');
                  const tests = lab.tests.map(t => t.test_name).join(', ');
                  return `${date}: ${tests}`;
                })
                .join('\n');
            }
          }

          setFormData({
            ...formData,
            patient_id: patientId,
            patient_name: `${patient.first_name} ${patient.last_name}`,
            hospital_number: patient.hospital_number,
            current_medications: medicationsText || 'No active medications recorded',
            examination_findings: examinationText || '',
            investigations: investigationsText || 'No recent investigations available'
          });
        } catch (error) {
          console.error('Error fetching patient data:', error);
          setFormData({
            ...formData,
            patient_id: patientId,
            patient_name: `${patient.first_name} ${patient.last_name}`,
            hospital_number: patient.hospital_number
          });
        } finally {
          setLoadingData(false);
        }
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select
            required
            onChange={(e) => handlePatientSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={loadingData}
            title="Select patient"
          >
            <option value="">Select patient...</option>
            {patients.map(p => {
              const patientName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
              return (
                <option key={p.id} value={p.id}>
                  {patientName} ({p.hospital_number})
                </option>
              );
            })}
          </select>
        </div>

        {selectedPatient && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-800 mb-1">Patient Information</div>
            <div className="text-sm text-blue-700">
              <div><strong>Name:</strong> {formData.patient_name}</div>
              <div><strong>Hospital Number:</strong> {formData.hospital_number}</div>
              {selectedPatient && (
                <div><strong>Age:</strong> {calculateAge(selectedPatient.date_of_birth || selectedPatient.dob) || 'N/A'} years</div>
              )}
            </div>
            {loadingData && <div className="text-sm text-blue-600 mt-2">Loading patient data...</div>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Consulting Department</label>
          <input
            type="text"
            required
            value={formData.consulting_department}
            onChange={(e) => setFormData({ ...formData, consulting_department: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Cardiology, Neurosurgery"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
          <select
            value={formData.urgency}
            onChange={(e) => setFormData({ ...formData, urgency: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Urgency level"
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Consult</label>
          <textarea
            required
            value={formData.reason_for_consult}
            onChange={(e) => setFormData({ ...formData, reason_for_consult: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Brief description of why consult is needed..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Relevant Clinical History</label>
          <textarea
            required
            value={formData.relevant_history}
            onChange={(e) => setFormData({ ...formData, relevant_history: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Relevant past medical/surgical history..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Medications</label>
          <textarea
            required
            value={formData.current_medications}
            onChange={(e) => setFormData({ ...formData, current_medications: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="List current medications..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Examination Findings</label>
          <textarea
            required
            value={formData.examination_findings}
            onChange={(e) => setFormData({ ...formData, examination_findings: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Relevant examination findings..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Investigations</label>
          <textarea
            required
            value={formData.investigations}
            onChange={(e) => setFormData({ ...formData, investigations: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Recent lab/imaging results..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Specific Question(s)</label>
          <textarea
            required
            value={formData.specific_question}
            onChange={(e) => setFormData({ ...formData, specific_question: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="What specific questions do you have for the consulting team?"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Generate Consult Request
          </button>
        </div>
      </form>
    );
  };

  const DischargeSummaryForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [formData, setFormData] = useState<DischargeSummaryData>({
      patient_id: '',
      patient_name: '',
      hospital_number: '',
      admission_date: new Date(),
      discharge_date: new Date(),
      admission_diagnosis: '',
      final_diagnosis: '',
      procedures_performed: [],
      hospital_course: '',
      discharge_medications: '',
      follow_up_plan: '',
      discharge_condition: ''
    });
    const [procedureInput, setProcedureInput] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [loadingAdmission, setLoadingAdmission] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await paperworkService.generateDischargeSummary(formData, user?.email || 'Unknown');
        loadData();
        onClose();
      } catch (error) {
        console.error('Error creating discharge summary:', error);
      }
    };

    const handlePatientSelect = async (patientId: string) => {
      const patient = patients.find(p => p.id === parseInt(patientId));
      if (patient) {
        setSelectedPatient(patient);
        setLoadingAdmission(true);
        
        // Fetch patient's active admission
        try {
          const patientAdmissions = await admissionService.getPatientAdmissions(parseInt(patientId));
          const activeAdmission = patientAdmissions.find(a => a.status === 'active');
          
          // Fetch treatment plans for medications and procedures
          let dischargeMeds = '';
          let proceduresList: string[] = [];
          let hospitalCourse = '';
          try {
            const treatmentPlans = await treatmentPlanningService.getPatientTreatmentPlans(patientId);
            const activePlan = treatmentPlans.find(p => p.status === 'active') || treatmentPlans[0];
            if (activePlan) {
              if (activePlan.medications && activePlan.medications.length > 0) {
                dischargeMeds = activePlan.medications
                  .filter(m => m.status === 'active')
                  .map(m => `${m.medication_name} ${m.dosage} ${m.route} ${m.frequency}`)
                  .join('\n');
              }
              if (activePlan.procedures && activePlan.procedures.length > 0) {
                proceduresList = activePlan.procedures
                  .filter((pr: any) => pr.status === 'completed' || pr.status === 'done')
                  .map((pr: any) => pr.procedure_name || pr.name || 'Procedure');
              }
            }
          } catch (e) { console.warn('Error fetching treatment plans for discharge:', e); }

          // Fetch ward rounds for hospital course summary
          try {
            const wardRounds = await db.ward_rounds.where('patient_id').equals(parseInt(patientId)).toArray();
            if (wardRounds.length > 0) {
              const sorted = wardRounds.sort((a: any, b: any) => new Date(a.round_date).getTime() - new Date(b.round_date).getTime());
              hospitalCourse = sorted.map((r: any) => {
                const date = r.round_date ? format(new Date(r.round_date), 'dd/MM/yyyy') : '';
                return `${date}: ${r.clinical_notes || r.findings || r.follow_up_plan || ''}`.trim();
              }).filter(Boolean).join('\n');
            }
          } catch (e) { console.warn('Error fetching ward rounds for discharge:', e); }

          if (activeAdmission) {
            const patientName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
            
            setFormData({
              ...formData,
              patient_id: patientId,
              patient_name: patientName,
              hospital_number: patient.hospital_number,
              admission_date: activeAdmission.admission_date,
              admission_diagnosis: activeAdmission.provisional_diagnosis || '',
              final_diagnosis: activeAdmission.provisional_diagnosis || '',
              hospital_course: hospitalCourse || activeAdmission.examination_findings || activeAdmission.initial_management_plan || '',
              discharge_medications: dischargeMeds || '',
              procedures_performed: proceduresList
            });
          } else {
            const patientName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
            setFormData({
              ...formData,
              patient_id: patientId,
              patient_name: patientName,
              hospital_number: patient.hospital_number,
              discharge_medications: dischargeMeds || '',
              procedures_performed: proceduresList
            });
          }
        } catch (error) {
          console.error('Error fetching admission data:', error);
          // Fallback to just patient info
          const patientName = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim();
          setFormData({
            ...formData,
            patient_id: patientId,
            patient_name: patientName,
            hospital_number: patient.hospital_number
          });
        } finally {
          setLoadingAdmission(false);
        }
      }
    };

    const addProcedure = () => {
      if (procedureInput.trim()) {
        setFormData({
          ...formData,
          procedures_performed: [...formData.procedures_performed, procedureInput.trim()]
        });
        setProcedureInput('');
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select
            required
            onChange={(e) => handlePatientSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={loadingAdmission}
            title="Select patient"
          >
            <option value="">Select patient...</option>
            {patients.map(p => {
              const patientName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
              return (
                <option key={p.id} value={p.id}>
                  {patientName} ({p.hospital_number})
                </option>
              );
            })}
          </select>
        </div>

        {selectedPatient && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-800 mb-1">Patient Information</div>
            <div className="text-sm text-blue-700">
              <div><strong>Name:</strong> {formData.patient_name}</div>
              <div><strong>Hospital Number:</strong> {formData.hospital_number}</div>
              {selectedPatient && (
                <div><strong>Age:</strong> {calculateAge(selectedPatient.date_of_birth || selectedPatient.dob) || 'N/A'} years</div>
              )}
            </div>
            {loadingAdmission && <div className="text-sm text-blue-600 mt-2">Loading admission data...</div>}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admission Date</label>
            <input
              type="date"
              required
              value={format(new Date(formData.admission_date), 'yyyy-MM-dd')}
              onChange={(e) => setFormData({ ...formData, admission_date: new Date(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              title="Admission date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Date</label>
            <input
              type="date"
              required
              value={format(new Date(formData.discharge_date), 'yyyy-MM-dd')}
              onChange={(e) => setFormData({ ...formData, discharge_date: new Date(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              title="Discharge date"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Admission Diagnosis</label>
          <textarea
            required
            value={formData.admission_diagnosis}
            onChange={(e) => setFormData({ ...formData, admission_diagnosis: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Admission diagnosis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Final Diagnosis</label>
          <textarea
            required
            value={formData.final_diagnosis}
            onChange={(e) => setFormData({ ...formData, final_diagnosis: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Final diagnosis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Procedures Performed</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={procedureInput}
              onChange={(e) => setProcedureInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addProcedure())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Add procedure..."
            />
            <button
              type="button"
              onClick={addProcedure}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Add
            </button>
          </div>
          {formData.procedures_performed.length > 0 && (
            <ul className="space-y-1">
              {formData.procedures_performed.map((proc, idx) => (
                <li key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm">{proc}</span>
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      procedures_performed: formData.procedures_performed.filter((_, i) => i !== idx)
                    })}
                    className="text-red-600 hover:text-red-700"
                    title="Remove procedure"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Course</label>
          <textarea
            required
            value={formData.hospital_course}
            onChange={(e) => setFormData({ ...formData, hospital_course: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Describe the patient's hospital course..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Medications</label>
          <textarea
            required
            value={formData.discharge_medications}
            onChange={(e) => setFormData({ ...formData, discharge_medications: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="List medications with dosages..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Follow-up Plan</label>
          <textarea
            required
            value={formData.follow_up_plan}
            onChange={(e) => setFormData({ ...formData, follow_up_plan: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Follow-up appointments and care..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discharge Condition</label>
          <input
            type="text"
            required
            value={formData.discharge_condition}
            onChange={(e) => setFormData({ ...formData, discharge_condition: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="e.g., Stable, Improved, Good"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Generate Discharge Summary
          </button>
        </div>
      </form>
    );
  };

  const MedicalReportForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [formData, setFormData] = useState<MedicalReportData>({
      patient_id: '',
      patient_name: '',
      hospital_number: '',
      report_type: 'insurance',
      recipient: '',
      recipient_address: '',
      diagnosis: '',
      treatment_given: '',
      current_status: '',
      prognosis: '',
      restrictions: '',
      additional_notes: ''
    });
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [loadingData, setLoadingData] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        await paperworkService.generateMedicalReport(formData, user?.email || 'Unknown');
        loadData();
        onClose();
      } catch (error) {
        console.error('Error creating medical report:', error);
      }
    };

    const handlePatientSelect = async (patientId: string) => {
      const patient = patients.find(p => p.id === parseInt(patientId));
      if (patient) {
        setSelectedPatient(patient);
        setLoadingData(true);

        try {
          // Fetch diagnosis from active admission
          const patientAdmissions = await admissionService.getPatientAdmissions(parseInt(patientId));
          const activeAdmission = patientAdmissions.find(a => a.status === 'active');
          let diagnosisText = '';
          if (activeAdmission) {
            diagnosisText = activeAdmission.provisional_diagnosis || activeAdmission.final_diagnosis || '';
          }

          // Fetch treatment given from active treatment plan
          const treatmentPlans = await treatmentPlanningService.getPatientTreatmentPlans(patientId);
          const activePlan = treatmentPlans.find(p => p.status === 'active');
          let treatmentText = '';
          if (activePlan) {
            // Combine medications and procedures
            const medications = activePlan.medications?.filter(m => m.status === 'active')
              .map(m => `${m.medication_name} ${m.dosage} ${m.route} ${m.frequency}`).join('\n') || '';
            const procedures = activePlan.procedures?.map(p => p.procedure_name).join(', ') || '';
            treatmentText = [medications, procedures].filter(t => t).join('\n\n');
          }

          // Fetch current status and prognosis from most recent ward round
          const allWardRounds = await db.ward_rounds.toArray();
          const wardRounds = allWardRounds.filter(wr => String(wr.patient_id) === String(patientId));
          
          let currentStatusText = '';
          let prognosisText = '';
          let restrictionsText = '';
          
          if (wardRounds && wardRounds.length > 0) {
            // Get most recent ward round
            const recentRound = wardRounds.sort((a, b) => 
              new Date(b.round_date).getTime() - new Date(a.round_date).getTime()
            )[0];
            
            if (recentRound) {
              // Current status from progress status and clinical notes
              const progressMap = {
                'improved': 'Patient is showing improvement',
                'stable': 'Patient condition is stable',
                'deteriorating': 'Patient condition is deteriorating',
                'critical': 'Patient is in critical condition'
              };
              currentStatusText = `${progressMap[recentRound.progress_status] || ''}. ${recentRound.clinical_notes || ''}`;
              
              // Prognosis from follow-up plan and discharge planning
              prognosisText = recentRound.discharge_planning || recentRound.follow_up_plan || '';
              
              // Restrictions from new orders or medication changes
              if (recentRound.new_orders) {
                restrictionsText = recentRound.new_orders;
              }
            }
          }

          // If no restrictions from ward rounds, check treatment plan for activity restrictions
          if (!restrictionsText && activePlan && activePlan.activity_restrictions) {
            restrictionsText = activePlan.activity_restrictions;
          }

          setFormData({
            ...formData,
            patient_id: patientId,
            patient_name: `${patient.first_name} ${patient.last_name}`,
            hospital_number: patient.hospital_number,
            diagnosis: diagnosisText || '',
            treatment_given: treatmentText || '',
            current_status: currentStatusText || '',
            prognosis: prognosisText || '',
            restrictions: restrictionsText || ''
          });
        } catch (error) {
          console.error('Error fetching patient data:', error);
          setFormData({
            ...formData,
            patient_id: patientId,
            patient_name: `${patient.first_name} ${patient.last_name}`,
            hospital_number: patient.hospital_number
          });
        } finally {
          setLoadingData(false);
        }
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select
            required
            onChange={(e) => handlePatientSelect(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={loadingData}
            title="Select patient"
          >
            <option value="">Select patient...</option>
            {patients.map(p => {
              const patientName = p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
              return (
                <option key={p.id} value={p.id}>
                  {patientName} ({p.hospital_number})
                </option>
              );
            })}
          </select>
        </div>

        {selectedPatient && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm font-semibold text-blue-800 mb-1">Patient Information</div>
            <div className="text-sm text-blue-700">
              <div><strong>Name:</strong> {formData.patient_name}</div>
              <div><strong>Hospital Number:</strong> {formData.hospital_number}</div>
              {selectedPatient && (
                <div><strong>Age:</strong> {calculateAge(selectedPatient.date_of_birth || selectedPatient.dob) || 'N/A'} years</div>
              )}
            </div>
            {loadingData && <div className="text-sm text-blue-600 mt-2">Loading patient data...</div>}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
          <select
            value={formData.report_type}
            onChange={(e) => setFormData({ ...formData, report_type: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Report type"
          >
            <option value="insurance">Insurance</option>
            <option value="legal">Legal</option>
            <option value="employment">Employment</option>
            <option value="school">School</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Name</label>
          <input
            type="text"
            required
            value={formData.recipient}
            onChange={(e) => setFormData({ ...formData, recipient: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="To whom the report is addressed..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Address</label>
          <textarea
            required
            value={formData.recipient_address}
            onChange={(e) => setFormData({ ...formData, recipient_address: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Full address..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
          <textarea
            required
            value={formData.diagnosis}
            onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Diagnosis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Given</label>
          <textarea
            required
            value={formData.treatment_given}
            onChange={(e) => setFormData({ ...formData, treatment_given: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Treatment given"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current Status</label>
          <textarea
            required
            value={formData.current_status}
            onChange={(e) => setFormData({ ...formData, current_status: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Current status"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prognosis</label>
          <textarea
            required
            value={formData.prognosis}
            onChange={(e) => setFormData({ ...formData, prognosis: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Prognosis"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Restrictions/Limitations</label>
          <textarea
            required
            value={formData.restrictions}
            onChange={(e) => setFormData({ ...formData, restrictions: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Any activity restrictions or work limitations..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
          <textarea
            value={formData.additional_notes}
            onChange={(e) => setFormData({ ...formData, additional_notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Optional additional information..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700"
          >
            Generate Medical Report
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-900">Paperwork & Documentation</h1>
          <div className="flex gap-2">
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as PaperworkType)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              title="Document type"
            >
              <option value="consult_request">Consult Request</option>
              <option value="discharge_summary">Discharge Summary</option>
              <option value="medical_report">Medical Report</option>
            </select>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Plus className="w-5 h-5" />
              New Document
            </button>
          </div>
        </div>
        <p className="text-gray-600">Automated document generation for clinical workflows</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-200">
        {[
          { id: 'all', label: 'All Documents' },
          { id: 'consult_request', label: 'Consult Requests' },
          { id: 'discharge_summary', label: 'Discharge Summaries' },
          { id: 'medical_report', label: 'Medical Reports' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              filter === tab.id
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocuments.map(doc => (
          <div
            key={doc.id}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
                <p className="text-sm text-gray-600">{doc.patient_name}</p>
                <p className="text-xs text-gray-500">{doc.hospital_number}</p>
              </div>
              <span
                className={`px-2 py-1 text-xs font-medium rounded ${
                  doc.status === 'final'
                    ? 'bg-green-100 text-green-700'
                    : doc.status === 'sent'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {doc.status}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              Created: {format(new Date(doc.created_at), 'MMM d, yyyy h:mm a')}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setSelectedDocument(doc)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
              >
                <FileText className="w-4 h-4" />
                View
              </button>
              <button
                onClick={() => exportToPDF(doc)}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                title="Export to PDF"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => exportToThermalPDF(doc)}
                className="flex items-center justify-center gap-1 px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 text-sm"
                title="Thermal Print (80mm)"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredDocuments.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No documents found</p>
            <button
              onClick={() => setShowModal(true)}
              className="mt-3 text-green-600 hover:text-green-700 font-medium"
            >
              Create your first document
            </button>
          </div>
        )}
      </div>

      {/* Document Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {documentType === 'consult_request' && 'New Consult Request'}
                {documentType === 'discharge_summary' && 'New Discharge Summary'}
                {documentType === 'medical_report' && 'New Medical Report'}
              </h3>

              {documentType === 'consult_request' && <ConsultRequestForm onClose={() => setShowModal(false)} />}
              {documentType === 'discharge_summary' && <DischargeSummaryForm onClose={() => setShowModal(false)} />}
              {documentType === 'medical_report' && <MedicalReportForm onClose={() => setShowModal(false)} />}
            </div>
          </div>
        </div>
      )}

      {/* Document View Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-lg shadow-xl sm:max-w-4xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{selectedDocument.title}</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportToPDF(selectedDocument)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </button>
                  <button
                    onClick={() => exportToThermalPDF(selectedDocument)}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                    title="Thermal Print (80mm)"
                  >
                    <Printer className="w-4 h-4" />
                    Thermal
                  </button>
                  <button
                    onClick={() => setSelectedDocument(null)}
                    className="px-3 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">
                  {selectedDocument.content}
                </pre>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">
                  Created by {selectedDocument.created_by} on {format(new Date(selectedDocument.created_at), 'MMMM d, yyyy h:mm a')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperworkPage;
