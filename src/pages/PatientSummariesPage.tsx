import React, { useState, useEffect } from 'react';
import { FileText, Download, Loader, User, Calendar, Activity, AlertCircle, TrendingUp } from 'lucide-react';
import { db } from '../db/database';
import { patientSummaryService, PatientSummary } from '../services/patientSummaryService';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

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
      const patientsData = await db.patients.toArray();
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
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT SUMMARY', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('University of Nigeria Teaching Hospital', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('Plastic Surgery Unit', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Patient Information
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PATIENT INFORMATION', 15, yPos);
    yPos += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${summaryData.patient_name}`, 15, yPos);
    yPos += 5;
    doc.text(`Hospital Number: ${summaryData.hospital_number}`, 15, yPos);
    yPos += 5;
    doc.text(`Admission Date: ${format(summaryData.admission_date, 'MMMM d, yyyy')}`, 15, yPos);
    yPos += 5;
    doc.text(`Summary Generated: ${format(summaryData.current_date, 'MMMM d, yyyy')}`, 15, yPos);
    yPos += 5;
    doc.text(`Length of Stay: ${summaryData.length_of_stay} day(s)`, 15, yPos);
    yPos += 10;

    // Overview
    doc.setFont('helvetica', 'bold');
    doc.text('OVERVIEW', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const overviewLines = doc.splitTextToSize(summaryData.summary.overview, pageWidth - 30);
    doc.text(overviewLines, 15, yPos);
    yPos += overviewLines.length * 5 + 5;

    // Diagnosis
    doc.setFont('helvetica', 'bold');
    doc.text('DIAGNOSIS', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const diagnosisLines = doc.splitTextToSize(summaryData.summary.diagnosis, pageWidth - 30);
    doc.text(diagnosisLines, 15, yPos);
    yPos += diagnosisLines.length * 5 + 5;

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Treatment Progress
    doc.setFont('helvetica', 'bold');
    doc.text('TREATMENT PROGRESS', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const progressLines = doc.splitTextToSize(summaryData.summary.treatment_progress, pageWidth - 30);
    doc.text(progressLines, 15, yPos);
    yPos += progressLines.length * 5 + 5;

    // Procedures Performed
    if (summaryData.summary.procedures_performed.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('PROCEDURES PERFORMED', 15, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      summaryData.summary.procedures_performed.forEach((proc, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${idx + 1}. ${proc}`, 20, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Check if we need a new page
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    // Medications
    if (summaryData.summary.medications.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('CURRENT MEDICATIONS', 15, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      summaryData.summary.medications.forEach((med, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${idx + 1}. ${med}`, 20, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Lab Results Summary
    doc.setFont('helvetica', 'bold');
    doc.text('LABORATORY INVESTIGATIONS', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const labLines = doc.splitTextToSize(summaryData.summary.lab_results_summary, pageWidth - 30);
    doc.text(labLines, 15, yPos);
    yPos += labLines.length * 5 + 5;

    // Complications
    if (summaryData.summary.complications.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('COMPLICATIONS/DELAYS', 15, yPos);
      yPos += 7;
      doc.setFont('helvetica', 'normal');
      summaryData.summary.complications.forEach((comp, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${idx + 1}. ${comp}`, 20, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Current Status
    doc.setFont('helvetica', 'bold');
    doc.text('CURRENT STATUS', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(summaryData.summary.current_status, 15, yPos);
    yPos += 10;

    // Plan Forward
    doc.setFont('helvetica', 'bold');
    doc.text('PLAN FORWARD', 15, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    const planLines = doc.splitTextToSize(summaryData.summary.plan_forward, pageWidth - 30);
    doc.text(planLines, 15, yPos);
    yPos += planLines.length * 5 + 10;

    // Footer
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.text('This summary was generated by AI and should be reviewed by a qualified healthcare professional.', 15, yPos);

    // Save PDF
    doc.save(`Patient_Summary_${summaryData.hospital_number}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
              <button
                onClick={() => exportToPDF(summary)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
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
                  {format(summary.admission_date, 'MMM d, yyyy')}
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
                  {summary.summary.current_status}
                </p>
              </div>
            </div>

            {/* Overview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <User className="w-5 h-5" />
                Overview
              </h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary.summary.overview}</p>
            </div>

            {/* Diagnosis */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Diagnosis</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary.summary.diagnosis}</p>
            </div>

            {/* Treatment Progress */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Treatment Progress</h3>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary.summary.treatment_progress}</p>
            </div>

            {/* Procedures Performed */}
            {summary.summary.procedures_performed.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Procedures Performed</h3>
                <ul className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {summary.summary.procedures_performed.map((proc, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-green-600 font-bold">{idx + 1}.</span>
                      <span className="text-gray-700">{proc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Medications */}
            {summary.summary.medications.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Current Medications</h3>
                <ul className="bg-gray-50 p-4 rounded-lg space-y-2">
                  {summary.summary.medications.map((med, idx) => (
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
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{summary.summary.lab_results_summary}</p>
            </div>

            {/* Complications */}
            {summary.summary.complications.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  Complications/Delays
                </h3>
                <ul className="bg-red-50 p-4 rounded-lg space-y-2">
                  {summary.summary.complications.map((comp, idx) => (
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
                {summary.summary.plan_forward}
              </p>
            </div>

            {/* Generation Info */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 italic">
                Summary generated by AI on {format(summary.generated_at, 'MMMM d, yyyy h:mm a')}
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
                    {format(oldSummary.generated_at, 'MMMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-sm text-gray-600">
                    Length of stay: {oldSummary.length_of_stay} day(s)
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    exportToPDF(oldSummary);
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Download className="w-5 h-5" />
                </button>
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
