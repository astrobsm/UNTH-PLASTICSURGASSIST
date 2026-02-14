import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader, User, Calendar, Activity, AlertCircle, TrendingUp, Printer } from 'lucide-react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { patientSummaryService, PatientSummary } from '../services/patientSummaryService';
import { safeFormatDate } from '../utils/dateUtils';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  addFooter
} from '../utils/pdfUtils';

const PatientSummariesPage: React.FC = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [summaryHistory, setSummaryHistory] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientSummaries();
    }
  }, [selectedPatient]);

  const loadPatients = async () => {
    try {
      const patientsData = await patientService.getAllPatients();
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadPatientSummaries = async () => {
    setLoading(true);
    try {
      const [latestSummary, history] = await Promise.all([
        patientSummaryService.getPatientSummary(selectedPatient),
        patientSummaryService.getPatientSummaryHistory(selectedPatient)
      ]);
      setSummary(latestSummary || null);
      setSummaryHistory(history);
    } catch (error) {
      console.error('Error loading summaries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!selectedPatient) return;

    setGenerating(true);
    try {
      const newSummary = await patientSummaryService.generateAISummary(selectedPatient);
      setSummary(newSummary);
      setSummaryHistory([newSummary, ...summaryHistory]);
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const exportToPDF = (summaryData: PatientSummary) => {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = PDF_MARGINS.top;
    
    // Helper to sanitize text
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    // Header
    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text('PATIENT SUMMARY', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'normal');
    doc.text('University of Nigeria Teaching Hospital', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('Plastic Surgery Unit', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Patient Information
    doc.setFontSize(PDF_FONT_SIZES.sectionHeader);
    doc.setFont('times', 'bold');
    doc.text('PATIENT INFORMATION', PDF_MARGINS.left, yPos);
    yPos += 7;

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'normal');
    doc.text('Name: ' + clean(summaryData.patient_name), PDF_MARGINS.left, yPos);
    yPos += 5;
    doc.text('Hospital Number: ' + clean(summaryData.hospital_number), PDF_MARGINS.left, yPos);
    yPos += 5;
    doc.text('Admission Date: ' + safeFormatDate(summaryData.admission_date, 'MMMM d, yyyy'), PDF_MARGINS.left, yPos);
    yPos += 5;
    doc.text('Summary Generated: ' + safeFormatDate(summaryData.current_date, 'MMMM d, yyyy'), PDF_MARGINS.left, yPos);
    yPos += 5;
    doc.text('Length of Stay: ' + summaryData.length_of_stay + ' day(s)', PDF_MARGINS.left, yPos);
    yPos += 10;

    // Overview
    doc.setFont('times', 'bold');
    doc.text('OVERVIEW', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    const overviewLines = doc.splitTextToSize(clean(summaryData?.summary?.overview), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
    doc.text(overviewLines, PDF_MARGINS.left, yPos);
    yPos += overviewLines.length * 5 + 5;

    // Diagnosis
    doc.setFont('times', 'bold');
    doc.text('DIAGNOSIS', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    const diagnosisLines = doc.splitTextToSize(clean(summaryData?.summary?.diagnosis), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
    doc.text(diagnosisLines, PDF_MARGINS.left, yPos);
    yPos += diagnosisLines.length * 5 + 5;

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = PDF_MARGINS.top;
    }

    // Treatment Progress
    doc.setFont('times', 'bold');
    doc.text('TREATMENT PROGRESS', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    const progressLines = doc.splitTextToSize(clean(summaryData?.summary?.treatment_progress), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
    doc.text(progressLines, PDF_MARGINS.left, yPos);
    yPos += progressLines.length * 5 + 5;

    // Procedures Performed
    if ((summaryData?.summary?.procedures_performed?.length || 0) > 0) {
      doc.setFont('times', 'bold');
      doc.text('PROCEDURES PERFORMED', PDF_MARGINS.left, yPos);
      yPos += 7;
      doc.setFont('times', 'normal');
      summaryData.summary.procedures_performed.forEach((proc, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = PDF_MARGINS.top;
        }
        doc.text((idx + 1) + '. ' + clean(proc), PDF_MARGINS.left + 5, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = PDF_MARGINS.top;
    }

    // Medications
    if ((summaryData?.summary?.medications?.length || 0) > 0) {
      doc.setFont('times', 'bold');
      doc.text('CURRENT MEDICATIONS', PDF_MARGINS.left, yPos);
      yPos += 7;
      doc.setFont('times', 'normal');
      summaryData.summary.medications.forEach((med, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = PDF_MARGINS.top;
        }
        doc.text((idx + 1) + '. ' + clean(med), PDF_MARGINS.left + 5, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Lab Results Summary
    doc.setFont('times', 'bold');
    doc.text('LABORATORY INVESTIGATIONS', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    const labLines = doc.splitTextToSize(clean(summaryData?.summary?.lab_results_summary), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
    doc.text(labLines, PDF_MARGINS.left, yPos);
    yPos += labLines.length * 5 + 5;

    // Complications
    if ((summaryData?.summary?.complications?.length || 0) > 0) {
      doc.setFont('times', 'bold');
      doc.text('COMPLICATIONS/DELAYS', PDF_MARGINS.left, yPos);
      yPos += 7;
      doc.setFont('times', 'normal');
      summaryData.summary.complications.forEach((comp, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = PDF_MARGINS.top;
        }
        doc.text((idx + 1) + '. ' + clean(comp), PDF_MARGINS.left + 5, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Current Status
    doc.setFont('times', 'bold');
    doc.text('CURRENT STATUS', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    doc.text(clean(summaryData?.summary?.current_status), PDF_MARGINS.left, yPos);
    yPos += 10;

    // Plan Forward
    doc.setFont('times', 'bold');
    doc.text('PLAN FORWARD', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFont('times', 'normal');
    const planLines = doc.splitTextToSize(clean(summaryData?.summary?.plan_forward), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
    doc.text(planLines, PDF_MARGINS.left, yPos);
    yPos += planLines.length * 5 + 10;

    // Disclaimer
    if (yPos > 250) {
      doc.addPage();
      yPos = PDF_MARGINS.top;
    }
    doc.setFontSize(PDF_FONT_SIZES.small);
    doc.setFont('times', 'italic');
    doc.text('This summary was automatically generated and should be reviewed by a qualified healthcare professional.', PDF_MARGINS.left, yPos);

    // Add professional footer with page numbers and timestamp
    addFooter(doc);

    // Save PDF
    doc.save('Patient_Summary_' + clean(summaryData.hospital_number) + '_' + format(new Date(), 'yyyy-MM-dd') + '.pdf');
  };

  // Thermal 80mm PDF export
  const exportToThermalPDF = async (summaryData: PatientSummary) => {
    const { jsPDF } = await import('jspdf');
    const thermalWidth = 80;
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    let estHeight = 150;
    estHeight += (summaryData?.summary?.overview?.length || 0) * 0.12;
    estHeight += (summaryData?.summary?.diagnosis?.length || 0) * 0.12;
    estHeight += (summaryData?.summary?.treatment_progress?.length || 0) * 0.12;
    estHeight += (summaryData?.summary?.procedures_performed?.length || 0) * 5;
    estHeight += (summaryData?.summary?.medications?.length || 0) * 5;
    estHeight += (summaryData?.summary?.complications?.length || 0) * 5;
    estHeight = Math.max(estHeight, 200);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] });
    const m = 3;
    let y = m;

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.text('PATIENT SUMMARY', thermalWidth / 2, y, { align: 'center' });
    y += 5;
    doc.setFontSize(8);
    doc.setFont('times', 'normal');
    doc.text('UNTH Plastic Surgery Unit', thermalWidth / 2, y, { align: 'center' });
    y += 4;
    doc.line(m, y, thermalWidth - m, y);
    y += 3;

    doc.setFontSize(9);
    doc.text('Name: ' + clean(summaryData.patient_name), m, y); y += 3.5;
    doc.text('Hosp #: ' + clean(summaryData.hospital_number), m, y); y += 3.5;
    doc.text('Admitted: ' + safeFormatDate(summaryData.admission_date, 'dd/MM/yyyy'), m, y); y += 3.5;
    doc.text('LOS: ' + summaryData.length_of_stay + ' day(s)', m, y); y += 4;
    doc.line(m, y, thermalWidth - m, y);
    y += 3;

    const addSection = (title: string, content: string) => {
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text(title, m, y); y += 4;
      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      const lines = doc.splitTextToSize(clean(content), thermalWidth - m * 2);
      lines.forEach((line: string) => { doc.text(line, m, y); y += 3.5; });
      y += 2;
    };

    const addList = (title: string, items: string[]) => {
      if (items.length === 0) return;
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text(title, m, y); y += 4;
      doc.setFontSize(9);
      doc.setFont('times', 'normal');
      items.forEach((item, i) => {
        const lines = doc.splitTextToSize((i + 1) + '. ' + clean(item), thermalWidth - m * 2);
        lines.forEach((line: string) => { doc.text(line, m, y); y += 3.5; });
      });
      y += 2;
    };

    addSection('OVERVIEW', summaryData?.summary?.overview || '');
    addSection('DIAGNOSIS', summaryData?.summary?.diagnosis || '');
    addSection('TREATMENT', summaryData?.summary?.treatment_progress || '');
    addList('PROCEDURES', summaryData?.summary?.procedures_performed || []);
    addList('MEDICATIONS', summaryData?.summary?.medications || []);
    addSection('LAB RESULTS', summaryData?.summary?.lab_results_summary || '');
    addList('COMPLICATIONS', summaryData?.summary?.complications || []);
    addSection('STATUS', summaryData?.summary?.current_status || '');
    addSection('PLAN', summaryData?.summary?.plan_forward || '');

    doc.save('Patient_Summary_Thermal_' + clean(summaryData.hospital_number) + '_' + format(new Date(), 'yyyy-MM-dd') + '.pdf');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Patient Summaries</h1>
        <p className="text-gray-600">Comprehensive patient care summaries from admission to current date</p>
      </div>

      {/* Patient Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
        <div className="flex gap-3">
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Select patient"
          >
            <option value="">Choose a patient...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.first_name} {p.last_name} ({p.hospital_number})
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerateSummary}
            disabled={!selectedPatient || generating}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {generating ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Summary
              </>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-green-600" />
        </div>
      )}

      {/* Current Summary */}
      {summary && !loading && (
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{summary.patient_name}</h2>
                <p className="text-gray-600">Hospital Number: {summary.hospital_number}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => exportToPDF(summary)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={() => exportToThermalPDF(summary)}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600"
                  title="Thermal Print (80mm)"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Admission Date</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {safeFormatDate(summary.admission_date, 'MMM d, yyyy')}
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-900">Length of Stay</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {summary.length_of_stay} day{summary.length_of_stay !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-purple-900">Current Status</span>
                </div>
                <p className="text-lg font-semibold text-purple-700">
                  {summary?.summary?.current_status || 'N/A'}
                </p>
              </div>
            </div>

            {/* Overview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <User className="w-5 h-5" />
                Overview
              </h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary?.summary?.overview || 'No overview available'}</p>
            </div>

            {/* Diagnosis */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Diagnosis</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary?.summary?.diagnosis || 'No diagnosis available'}</p>
            </div>

            {/* Treatment Progress */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Treatment Progress</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary?.summary?.treatment_progress || 'No treatment progress recorded'}</p>
            </div>

            {/* Procedures Performed */}
            {(summary?.summary?.procedures_performed?.length || 0) > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Procedures Performed</h3>
                <ul className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {(summary?.summary?.procedures_performed || []).map((proc, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">{idx + 1}.</span>
                      <span className="text-gray-700">{proc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medications */}
            {(summary?.summary?.medications?.length || 0) > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Medications</h3>
                <ul className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {(summary?.summary?.medications || []).map((med, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-600 font-bold">{idx + 1}.</span>
                      <span className="text-gray-700">{med}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lab Results */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Laboratory Investigations</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary?.summary?.lab_results_summary || 'No lab results available'}</p>
            </div>

            {/* Complications */}
            {(summary?.summary?.complications?.length || 0) > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Complications/Delays
                </h3>
                <ul className="bg-red-50 p-4 rounded-lg space-y-2">
                  {(summary?.summary?.complications || []).map((comp, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-red-600 font-bold">{idx + 1}.</span>
                      <span className="text-red-900">{comp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Plan Forward */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Plan Forward</h3>
              <p className="text-gray-700 bg-green-50 p-4 rounded-lg border-l-4 border-green-600">
                {summary?.summary?.plan_forward || 'No plan forward documented'}
              </p>
            </div>

            {/* Generation Info */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 italic">
                Summary generated by AI on {safeFormatDate(summary.generated_at, 'MMMM d, yyyy h:mm a')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary History */}
      {summaryHistory.length > 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Summaries</h3>
          <div className="space-y-2">
            {summaryHistory.slice(1).map((oldSummary) => (
              <div
                key={oldSummary.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                onClick={() => setSummary(oldSummary)}
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {safeFormatDate(oldSummary.generated_at, 'MMMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-sm text-gray-600">
                    Length of stay: {oldSummary.length_of_stay} day(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToPDF(oldSummary);
                    }}
                    className="text-blue-600 hover:text-blue-700"
                    title="Export PDF"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      exportToThermalPDF(oldSummary);
                    }}
                    className="text-orange-500 hover:text-orange-600"
                    title="Thermal Print (80mm)"
                  >
                    <Printer className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!summary && !loading && selectedPatient && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">No summary generated yet for this patient</p>
          <button
            onClick={handleGenerateSummary}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Generate First Summary
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientSummariesPage;
