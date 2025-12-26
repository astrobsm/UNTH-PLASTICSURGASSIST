import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { Discharge, admissionDischargeService } from '../services/admissionDischargeService';

interface DischargeDocumentsPreviewProps {
  discharge: Discharge;
  onComplete: () => void;
  onBack: () => void;
}

type DocumentType = 'summary' | 'fitness' | 'instructions' | 'meal_plan' | 'all';

export default function DischargeDocumentsPreview({
  discharge,
  onComplete,
  onBack
}: DischargeDocumentsPreviewProps) {
  const [activeDocument, setActiveDocument] = useState<DocumentType>('summary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadedDocs, setDownloadedDocs] = useState<Set<DocumentType>>(new Set());
  const previewRef = useRef<HTMLDivElement>(null);

  const documents: { type: DocumentType; name: string; icon: string }[] = [
    { type: 'summary', name: 'Discharge Summary', icon: '📋' },
    { type: 'fitness', name: 'Fitness Report', icon: '✅' },
    { type: 'instructions', name: 'Discharge Instructions', icon: '📝' },
    { type: 'meal_plan', name: '7-Day Meal Plan', icon: '🍽️' },
    { type: 'all', name: 'Complete Package', icon: '📦' }
  ];

  // Hospital header for documents
  const HospitalHeader = () => (
    <div className="text-center border-b-2 border-green-600 pb-4 mb-4">
      <h1 className="text-xl font-bold text-green-700">UNIVERSITY OF NIGERIA TEACHING HOSPITAL</h1>
      <h2 className="text-lg font-semibold text-gray-800">DEPARTMENT OF PLASTIC SURGERY</h2>
      <p className="text-sm text-gray-600">Ituku-Ozalla, Enugu State, Nigeria</p>
      <p className="text-sm text-gray-600">Tel: +234-XXX-XXXX-XXX | Email: plasticsurgery@unth.edu.ng</p>
    </div>
  );

  // Discharge Summary Preview
  const DischargeSummaryPreview = () => (
    <div className="bg-white p-6 border rounded-lg">
      <HospitalHeader />
      <h3 className="text-lg font-bold text-center mb-4 bg-green-100 py-2">DISCHARGE SUMMARY</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div><strong>Patient Name:</strong> {discharge.patient_name}</div>
        <div><strong>Hospital No:</strong> {discharge.hospital_number}</div>
        <div><strong>Age/Gender:</strong> {discharge.age} years / {discharge.gender}</div>
        <div><strong>Admission Date:</strong> {format(new Date(discharge.admission_date), 'dd MMM yyyy')}</div>
        <div><strong>Discharge Date:</strong> {format(new Date(discharge.discharge_date), 'dd MMM yyyy')}</div>
        <div><strong>Length of Stay:</strong> {discharge.length_of_stay_days} days</div>
      </div>

      <div className="space-y-4 text-sm">
        <div>
          <h4 className="font-semibold text-green-700 border-b pb-1">FINAL DIAGNOSIS</h4>
          <p className="mt-1">{discharge.final_diagnosis}</p>
          {discharge.secondary_diagnoses && discharge.secondary_diagnoses.length > 0 && (
            <p className="text-gray-600">Secondary: {discharge.secondary_diagnoses.join(', ')}</p>
          )}
        </div>

        {discharge.procedures_performed && discharge.procedures_performed.length > 0 && (
          <div>
            <h4 className="font-semibold text-green-700 border-b pb-1">PROCEDURES PERFORMED</h4>
            <ul className="mt-1 list-disc pl-5">
              {discharge.procedures_performed.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        <div>
          <h4 className="font-semibold text-green-700 border-b pb-1">HOSPITAL COURSE</h4>
          <p className="mt-1 whitespace-pre-line">{discharge.hospital_course_summary}</p>
        </div>

        <div>
          <h4 className="font-semibold text-green-700 border-b pb-1">CONDITION AT DISCHARGE</h4>
          <p className="mt-1">{discharge.condition_at_discharge}</p>
        </div>

        <div>
          <h4 className="font-semibold text-green-700 border-b pb-1">MEDICATIONS ON DISCHARGE</h4>
          <table className="w-full mt-1 border-collapse text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">Medication</th>
                <th className="border p-1 text-left">Dose</th>
                <th className="border p-1 text-left">Frequency</th>
                <th className="border p-1 text-left">Duration</th>
              </tr>
            </thead>
            <tbody>
              {discharge.medications_on_discharge?.map((med, i) => (
                <tr key={i}>
                  <td className="border p-1">{med.medication}</td>
                  <td className="border p-1">{med.dosage}</td>
                  <td className="border p-1">{med.frequency}</td>
                  <td className="border p-1">{med.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="font-semibold text-green-700 border-b pb-1">FOLLOW-UP</h4>
          <ul className="mt-1">
            {discharge.follow_up_appointments?.map((apt, i) => (
              <li key={i}>
                📅 {format(new Date(apt.date), 'dd MMM yyyy')} - {apt.clinic}: {apt.purpose}
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t pt-4 mt-6 text-xs">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="border-t border-gray-400 pt-2">Discharging Doctor</p>
              <p>{discharge.discharging_doctor}</p>
            </div>
            <div>
              <p className="border-t border-gray-400 pt-2">Consultant</p>
              <p>{discharge.discharging_consultant}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Fitness Report Preview
  const FitnessReportPreview = () => (
    <div className="bg-white p-6 border rounded-lg">
      <HospitalHeader />
      <h3 className="text-lg font-bold text-center mb-4 bg-blue-100 py-2">MEDICAL REPORT OF FITNESS FOR DISCHARGE</h3>
      
      <div className="space-y-4 text-sm">
        <p>This is to certify that:</p>
        
        <div className="bg-gray-50 p-4 rounded border">
          <p><strong>Patient Name:</strong> {discharge.patient_name}</p>
          <p><strong>Hospital Number:</strong> {discharge.hospital_number}</p>
          <p><strong>Age/Gender:</strong> {discharge.age} years / {discharge.gender}</p>
        </div>

        <p>
          Was admitted to the Plastic Surgery Unit of this Hospital on <strong>{format(new Date(discharge.admission_date), 'dd MMMM yyyy')}</strong> with 
          a diagnosis of <strong>{discharge.final_diagnosis}</strong> and has been treated successfully.
        </p>

        <div className={`p-4 rounded border-2 ${
          discharge.discharge_type === 'normal' ? 'border-green-500 bg-green-50' :
          discharge.discharge_type === 'on_request' ? 'border-yellow-500 bg-yellow-50' :
          'border-red-500 bg-red-50'
        }`}>
          <h4 className="font-semibold">Discharge Assessment</h4>
          <p><strong>WHO Discharge Readiness Score:</strong> {discharge.discharge_readiness_score}/33</p>
          <p><strong>Discharge Type:</strong> {discharge.discharge_type.replace('_', ' ').toUpperCase()}</p>
          <p><strong>Condition at Discharge:</strong> {discharge.condition_at_discharge}</p>
        </div>

        {discharge.discharge_type === 'normal' && (
          <p className="text-green-700 font-medium">
            Based on the WHO discharge readiness assessment, the patient is <strong>FIT FOR DISCHARGE</strong> and 
            can resume normal activities with the precautions outlined in the discharge instructions.
          </p>
        )}

        {discharge.discharge_type === 'on_request' && (
          <p className="text-yellow-700 font-medium">
            The patient has requested discharge before completing the recommended course of treatment. 
            The patient and/or relatives have been counseled about the potential risks. They have agreed 
            to follow-up as scheduled and return immediately if any warning signs occur.
          </p>
        )}

        {discharge.discharge_type === 'against_medical_advice' && (
          <p className="text-red-700 font-medium">
            This patient is leaving <strong>AGAINST MEDICAL ADVICE</strong>. The patient has been fully 
            informed of the risks of leaving before completing treatment, including risk of complications, 
            worsening condition, and potential life-threatening outcomes. The patient has chosen to leave 
            despite these warnings.
          </p>
        )}

        <div className="border-t pt-4 mt-6">
          <p className="mb-8">Issued on: {format(new Date(), 'dd MMMM yyyy')}</p>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="border-t border-gray-400 pt-2">Discharging Doctor</p>
              <p>{discharge.discharging_doctor}</p>
            </div>
            <div>
              <p className="border-t border-gray-400 pt-2">Consultant</p>
              <p>{discharge.discharging_consultant}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Discharge Instructions Preview
  const DischargeInstructionsPreview = () => (
    <div className="bg-white p-6 border rounded-lg">
      <HospitalHeader />
      <h3 className="text-lg font-bold text-center mb-4 bg-purple-100 py-2">DISCHARGE INSTRUCTIONS</h3>
      
      <div className="bg-green-50 p-3 rounded mb-4">
        <p><strong>Patient:</strong> {discharge.patient_name}</p>
        <p><strong>Discharge Date:</strong> {format(new Date(discharge.discharge_date), 'dd MMMM yyyy')}</p>
      </div>

      <div className="space-y-4 text-sm">
        {/* Wound Care */}
        {discharge.wound_care_instructions && (
          <div>
            <h4 className="font-semibold text-purple-700 border-b pb-1 flex items-center gap-2">
              🩹 WOUND CARE
            </h4>
            <div className="mt-2 whitespace-pre-line bg-gray-50 p-3 rounded">
              {discharge.wound_care_instructions}
            </div>
          </div>
        )}

        {/* Medications */}
        <div>
          <h4 className="font-semibold text-purple-700 border-b pb-1 flex items-center gap-2">
            💊 MEDICATIONS
          </h4>
          <p className="text-xs text-gray-600 mt-1">Take the following medications exactly as prescribed:</p>
          <div className="mt-2 space-y-2">
            {discharge.medications_on_discharge?.map((med, i) => (
              <div key={i} className="bg-gray-50 p-2 rounded border-l-4 border-green-500">
                <p className="font-medium">{med.medication} {med.dosage}</p>
                <p className="text-xs text-gray-600">
                  Take {med.frequency} for {med.duration}
                  {med.instructions && ` - ${med.instructions}`}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Lifestyle Modifications */}
        {discharge.lifestyle_modifications && discharge.lifestyle_modifications.length > 0 && (
          <div>
            <h4 className="font-semibold text-purple-700 border-b pb-1 flex items-center gap-2">
              🏃 LIFESTYLE MODIFICATIONS
            </h4>
            <ul className="mt-2 space-y-1">
              {discharge.lifestyle_modifications.map((mod, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{mod}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Activity Restrictions */}
        {discharge.activity_restrictions && discharge.activity_restrictions.length > 0 && (
          <div>
            <h4 className="font-semibold text-purple-700 border-b pb-1 flex items-center gap-2">
              🚫 ACTIVITY RESTRICTIONS
            </h4>
            <ul className="mt-2 space-y-1">
              {discharge.activity_restrictions.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-red-600">⛔</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Warning Signs */}
        <div className="bg-red-50 p-3 rounded border border-red-200">
          <h4 className="font-semibold text-red-700 flex items-center gap-2">
            ⚠️ RETURN TO HOSPITAL IMMEDIATELY IF YOU EXPERIENCE:
          </h4>
          <ul className="mt-2 space-y-1">
            {discharge.warning_signs?.map((sign, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-red-600">🚨</span>
                <span>{sign}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Follow-up */}
        <div className="bg-blue-50 p-3 rounded border border-blue-200">
          <h4 className="font-semibold text-blue-700 flex items-center gap-2">
            📅 FOLLOW-UP APPOINTMENTS
          </h4>
          <div className="mt-2 space-y-2">
            {discharge.follow_up_appointments?.map((apt, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-blue-600">📌</span>
                <span><strong>{format(new Date(apt.date), 'EEE, dd MMM yyyy')}</strong> at {apt.clinic}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="border-t pt-4 text-center text-xs">
          <p className="font-semibold">For emergencies, contact:</p>
          <p>Plastic Surgery Unit: +234-XXX-XXXX-XXX</p>
          <p>Hospital Emergency: 112 / +234-XXX-XXXX-XXX</p>
        </div>
      </div>
    </div>
  );

  // Meal Plan Preview
  const MealPlanPreview = () => (
    <div className="bg-white p-6 border rounded-lg">
      <HospitalHeader />
      <h3 className="text-lg font-bold text-center mb-4 bg-orange-100 py-2">7-DAY MEAL PLAN</h3>
      
      <div className="bg-green-50 p-3 rounded mb-4">
        <p><strong>Patient:</strong> {discharge.patient_name}</p>
        <p><strong>Based on:</strong> {discharge.final_diagnosis}</p>
      </div>

      {discharge.meal_plan_7_day ? (
        <div className="space-y-4 text-sm">
          {/* Special Considerations */}
          {discharge.meal_plan_7_day.special_considerations.length > 0 && (
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <h4 className="font-semibold text-blue-700">📌 Special Dietary Considerations:</h4>
              <ul className="mt-1">
                {discharge.meal_plan_7_day.special_considerations.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Foods to Avoid */}
          {discharge.meal_plan_7_day.foods_to_avoid.length > 0 && (
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <h4 className="font-semibold text-red-700">🚫 Foods to Avoid:</h4>
              <p className="mt-1">{discharge.meal_plan_7_day.foods_to_avoid.join(', ')}</p>
            </div>
          )}

          {/* Daily Plans */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-green-600 text-white">
                  <th className="border p-2">Day</th>
                  <th className="border p-2">Breakfast</th>
                  <th className="border p-2">Mid-Morning</th>
                  <th className="border p-2">Lunch</th>
                  <th className="border p-2">Afternoon</th>
                  <th className="border p-2">Dinner</th>
                </tr>
              </thead>
              <tbody>
                {['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'].map((dayKey, idx) => {
                  const day = discharge.meal_plan_7_day![dayKey as keyof typeof discharge.meal_plan_7_day] as any;
                  return (
                    <tr key={dayKey} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="border p-2 font-semibold">Day {idx + 1}</td>
                      <td className="border p-2">{day.breakfast}</td>
                      <td className="border p-2">{day.mid_morning_snack}</td>
                      <td className="border p-2">{day.lunch}</td>
                      <td className="border p-2">{day.afternoon_snack}</td>
                      <td className="border p-2">{day.dinner}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Hydration */}
          <div className="bg-cyan-50 p-3 rounded border border-cyan-200">
            <h4 className="font-semibold text-cyan-700">💧 Hydration Goals:</h4>
            <p>{discharge.meal_plan_7_day.hydration_goals}</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">No meal plan generated</p>
      )}
    </div>
  );

  // Generate PDF
  const generatePDF = async (docType: DocumentType) => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let y = 20;

      const addHeader = () => {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 128, 0);
        doc.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, y, { align: 'center' });
        y += 6;
        doc.setFontSize(12);
        doc.text('DEPARTMENT OF PLASTIC SURGERY', pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text('Ituku-Ozalla, Enugu State, Nigeria', pageWidth / 2, y, { align: 'center' });
        y += 10;
        doc.setDrawColor(0, 128, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
      };

      const addText = (text: string, options: { fontSize?: number; bold?: boolean; color?: number[] } = {}) => {
        const { fontSize = 10, bold = false, color = [0, 0, 0] } = options;
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(color[0], color[1], color[2]);
        
        const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
        lines.forEach((line: string) => {
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin, y);
          y += fontSize * 0.5;
        });
        y += 2;
      };

      const addSectionTitle = (title: string) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        y += 3;
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y - 4, pageWidth - 2 * margin, 7, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 100, 0);
        doc.text(title, margin + 2, y);
        y += 8;
      };

      // Generate based on document type
      if (docType === 'summary' || docType === 'all') {
        addHeader();
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('DISCHARGE SUMMARY', pageWidth / 2, y, { align: 'center' });
        y += 10;

        addText(`Patient: ${discharge.patient_name}  |  Hospital No: ${discharge.hospital_number}  |  Age/Gender: ${discharge.age}/${discharge.gender}`);
        addText(`Admission: ${format(new Date(discharge.admission_date), 'dd MMM yyyy')}  |  Discharge: ${format(new Date(discharge.discharge_date), 'dd MMM yyyy')}  |  LOS: ${discharge.length_of_stay_days} days`);
        y += 3;

        addSectionTitle('FINAL DIAGNOSIS');
        addText(discharge.final_diagnosis);
        if (discharge.secondary_diagnoses?.length) {
          addText(`Secondary: ${discharge.secondary_diagnoses.join(', ')}`);
        }

        if (discharge.procedures_performed?.length) {
          addSectionTitle('PROCEDURES PERFORMED');
          discharge.procedures_performed.forEach(p => addText(`• ${p}`));
        }

        addSectionTitle('HOSPITAL COURSE');
        addText(discharge.hospital_course_summary || '');

        addSectionTitle('CONDITION AT DISCHARGE');
        addText(discharge.condition_at_discharge || '');

        addSectionTitle('MEDICATIONS ON DISCHARGE');
        discharge.medications_on_discharge?.forEach(med => {
          addText(`• ${med.medication} ${med.dosage} - ${med.frequency} for ${med.duration}`);
        });

        if (discharge.follow_up_appointments?.length) {
          addSectionTitle('FOLLOW-UP');
          discharge.follow_up_appointments.forEach(apt => {
            addText(`• ${format(new Date(apt.date), 'dd MMM yyyy')} - ${apt.clinic}: ${apt.purpose}`);
          });
        }

        // Signature area
        y += 15;
        doc.setFontSize(9);
        doc.text('_____________________', margin, y);
        doc.text('_____________________', pageWidth / 2 + 10, y);
        y += 5;
        doc.text('Discharging Doctor', margin, y);
        doc.text('Consultant', pageWidth / 2 + 10, y);
        y += 4;
        doc.setFontSize(8);
        doc.text(discharge.discharging_doctor || '', margin, y);
        doc.text(discharge.discharging_consultant || '', pageWidth / 2 + 10, y);

        if (docType === 'all') {
          doc.addPage();
          y = 20;
        }
      }

      if (docType === 'fitness' || docType === 'all') {
        addHeader();
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('MEDICAL REPORT OF FITNESS FOR DISCHARGE', pageWidth / 2, y, { align: 'center' });
        y += 10;

        addText('This is to certify that:');
        y += 3;
        addText(`Patient Name: ${discharge.patient_name}`, { bold: true });
        addText(`Hospital Number: ${discharge.hospital_number}`);
        addText(`Age/Gender: ${discharge.age} years / ${discharge.gender}`);
        y += 5;

        addText(`Was admitted on ${format(new Date(discharge.admission_date), 'dd MMMM yyyy')} with a diagnosis of ${discharge.final_diagnosis} and has been treated.`);
        y += 5;

        addSectionTitle('DISCHARGE ASSESSMENT');
        addText(`WHO Discharge Readiness Score: ${discharge.discharge_readiness_score}/33`);
        addText(`Discharge Type: ${discharge.discharge_type.replace('_', ' ').toUpperCase()}`);
        addText(`Condition at Discharge: ${discharge.condition_at_discharge}`);
        y += 5;

        if (discharge.discharge_type === 'normal') {
          addText('Based on the WHO discharge readiness assessment, the patient is FIT FOR DISCHARGE.', { color: [0, 128, 0] });
        } else if (discharge.discharge_type === 'on_request') {
          addText('Patient has requested discharge. Counseled about risks. Agreed to follow-up.', { color: [200, 150, 0] });
        } else {
          addText('Patient leaving AGAINST MEDICAL ADVICE. Risks fully explained.', { color: [200, 0, 0] });
        }

        y += 15;
        addText(`Issued on: ${format(new Date(), 'dd MMMM yyyy')}`);
        y += 10;
        doc.text('_____________________', margin, y);
        doc.text('_____________________', pageWidth / 2 + 10, y);
        y += 5;
        doc.setFontSize(9);
        doc.text('Discharging Doctor', margin, y);
        doc.text('Consultant', pageWidth / 2 + 10, y);

        if (docType === 'all') {
          doc.addPage();
          y = 20;
        }
      }

      if (docType === 'instructions' || docType === 'all') {
        addHeader();
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DISCHARGE INSTRUCTIONS', pageWidth / 2, y, { align: 'center' });
        y += 10;

        addText(`Patient: ${discharge.patient_name}  |  Discharge Date: ${format(new Date(discharge.discharge_date), 'dd MMM yyyy')}`);
        y += 5;

        if (discharge.wound_care_instructions) {
          addSectionTitle('WOUND CARE');
          addText(discharge.wound_care_instructions);
        }

        addSectionTitle('MEDICATIONS');
        discharge.medications_on_discharge?.forEach(med => {
          addText(`• ${med.medication} ${med.dosage}`);
          addText(`  Take ${med.frequency} for ${med.duration}`, { fontSize: 9 });
        });

        if (discharge.lifestyle_modifications?.length) {
          addSectionTitle('LIFESTYLE MODIFICATIONS');
          discharge.lifestyle_modifications.forEach(mod => addText(`✓ ${mod}`));
        }

        if (discharge.warning_signs?.length) {
          addSectionTitle('⚠️ WARNING SIGNS - RETURN IMMEDIATELY IF:');
          discharge.warning_signs.forEach(sign => addText(`🚨 ${sign}`));
        }

        if (discharge.follow_up_appointments?.length) {
          addSectionTitle('FOLLOW-UP APPOINTMENTS');
          discharge.follow_up_appointments.forEach(apt => {
            addText(`📅 ${format(new Date(apt.date), 'EEE, dd MMM yyyy')} at ${apt.clinic}`);
          });
        }

        y += 10;
        addText('Emergency Contact: Hospital Emergency: 112', { fontSize: 9 });

        if (docType === 'all') {
          doc.addPage();
          y = 20;
        }
      }

      if ((docType === 'meal_plan' || docType === 'all') && discharge.meal_plan_7_day) {
        addHeader();
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('7-DAY MEAL PLAN', pageWidth / 2, y, { align: 'center' });
        y += 10;

        addText(`Patient: ${discharge.patient_name}`);
        addText(`Based on: ${discharge.final_diagnosis}`);
        y += 5;

        if (discharge.meal_plan_7_day.special_considerations.length) {
          addSectionTitle('DIETARY CONSIDERATIONS');
          discharge.meal_plan_7_day.special_considerations.forEach(c => addText(`• ${c}`));
        }

        if (discharge.meal_plan_7_day.foods_to_avoid.length) {
          addSectionTitle('FOODS TO AVOID');
          addText(discharge.meal_plan_7_day.foods_to_avoid.join(', '));
        }

        // Daily meal plan
        ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'].forEach((dayKey, idx) => {
          const day = discharge.meal_plan_7_day![dayKey as keyof typeof discharge.meal_plan_7_day] as any;
          addSectionTitle(`DAY ${idx + 1}`);
          addText(`Breakfast: ${day.breakfast}`);
          addText(`Mid-Morning: ${day.mid_morning_snack}`);
          addText(`Lunch: ${day.lunch}`);
          addText(`Afternoon: ${day.afternoon_snack}`);
          addText(`Dinner: ${day.dinner}`);
        });

        addSectionTitle('HYDRATION');
        addText(discharge.meal_plan_7_day.hydration_goals);
      }

      // Save PDF
      const filename = `${discharge.patient_name.replace(/\s+/g, '_')}_${docType}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(filename);
      
      setDownloadedDocs(prev => new Set([...prev, docType]));
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Share via WhatsApp/Email
  const shareDocument = (method: 'whatsapp' | 'email') => {
    const summary = `
Discharge Summary for ${discharge.patient_name}
Hospital No: ${discharge.hospital_number}
Discharge Date: ${format(new Date(discharge.discharge_date), 'dd MMM yyyy')}
Diagnosis: ${discharge.final_diagnosis}
Condition: ${discharge.condition_at_discharge}

Follow-up: ${discharge.follow_up_appointments?.map(a => `${format(new Date(a.date), 'dd MMM')} - ${a.clinic}`).join(', ')}
    `.trim();

    if (method === 'whatsapp') {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(summary)}`;
      window.open(whatsappUrl, '_blank');
    } else {
      const subject = `Discharge Summary - ${discharge.patient_name}`;
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summary)}`;
      window.location.href = mailtoUrl;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg">
        <h3 className="text-xl font-bold">📄 Discharge Documents</h3>
        <p className="text-green-100 mt-1">Preview and download discharge documents for {discharge.patient_name}</p>
      </div>

      {/* Document Tabs */}
      <div className="flex flex-wrap gap-2 bg-gray-100 p-2 rounded-lg">
        {documents.map(doc => (
          <button
            key={doc.type}
            onClick={() => setActiveDocument(doc.type)}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              activeDocument === doc.type
                ? 'bg-green-600 text-white shadow'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span>{doc.icon}</span>
            <span className="hidden sm:inline">{doc.name}</span>
            {downloadedDocs.has(doc.type) && <span className="text-xs">✓</span>}
          </button>
        ))}
      </div>

      {/* Document Preview */}
      <div ref={previewRef} className="max-h-[600px] overflow-y-auto">
        {activeDocument === 'summary' && <DischargeSummaryPreview />}
        {activeDocument === 'fitness' && <FitnessReportPreview />}
        {activeDocument === 'instructions' && <DischargeInstructionsPreview />}
        {activeDocument === 'meal_plan' && <MealPlanPreview />}
        {activeDocument === 'all' && (
          <div className="space-y-6">
            <DischargeSummaryPreview />
            <FitnessReportPreview />
            <DischargeInstructionsPreview />
            <MealPlanPreview />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-50 p-4 rounded-lg border">
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => generatePDF(activeDocument)}
            disabled={isGenerating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? '⏳ Generating...' : '📥 Download PDF'}
          </button>
          <button
            onClick={() => shareDocument('whatsapp')}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            📱 Share via WhatsApp
          </button>
          <button
            onClick={() => shareDocument('email')}
            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            ✉️ Share via Email
          </button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          ← Back
        </button>
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          ✅ Complete Discharge
        </button>
      </div>
    </div>
  );
}
