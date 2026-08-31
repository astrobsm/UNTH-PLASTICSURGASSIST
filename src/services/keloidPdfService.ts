import { sanitizePdfDocument } from '../utils/pdfSafeText';
// Keloid Care Plan PDF Generation Service - Standardized with pdfUtils
import { KeloidCarePlan, KELOID_EDUCATION } from './keloidCareService';
import { format } from 'date-fns';
import {
  createPDF,
  sanitizeTextForPDF,
  addFooter,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
} from '../utils/pdfUtils';

const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

class KeloidPdfService {

  /**
   * Generate comprehensive Keloid Care Plan PDF
   */
  generateCarePlanPdf(plan: KeloidCarePlan): void {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = PDF_MARGINS.left;
    const maxWidth = pageWidth - margin - PDF_MARGINS.right;
    let yPos = 15;

    // Header
    doc.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(PDF_FONT_SIZES.title);
    doc.setFont('times', 'bold');
    doc.text('KELOID CARE PLAN', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.small);
    doc.setFont('times', 'normal');
    doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy')}`, pageWidth / 2, 22, { align: 'center' });

    yPos = 40;
    doc.setTextColor(0, 0, 0);

    // Patient Information
    const patientName = clean(`${plan.first_name || ''} ${plan.last_name || ''}`).trim();
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(margin, yPos, maxWidth, 28, 'FD');

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'bold');
    doc.text('Patient Information', margin + 3, yPos + 5);
    doc.setFont('times', 'normal');
    doc.text(`Name: ${patientName}`, margin + 3, yPos + 11);
    doc.text(`Hospital Number: ${clean(plan.hospital_number) || 'N/A'}`, margin + 80, yPos + 11);
    doc.text(`Gender: ${clean(plan.gender) || 'N/A'}`, margin + 3, yPos + 17);
    doc.text(`DOB: ${plan.date_of_birth ? format(new Date(plan.date_of_birth), 'dd/MM/yyyy') : 'N/A'}`, margin + 80, yPos + 17);
    doc.text(`Phase: ${clean(this.getPhaseLabel(plan.phase))}`, margin + 3, yPos + 23);
    doc.text(`Status: ${clean(plan.status)}`, margin + 80, yPos + 23);
    yPos += 35;

    // Helper functions
    const checkBreak = (needed: number) => {
      if (yPos + needed > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
      }
    };

    const addSection = (title: string, content: string) => {
      checkBreak(25);
      doc.setFontSize(PDF_FONT_SIZES.body);
      doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
      doc.setFont('times', 'bold');
      doc.text(clean(title), margin, yPos);
      yPos += 6;
      doc.setFont('times', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      const lines = doc.splitTextToSize(clean(content), maxWidth);
      lines.forEach((line: string) => {
        checkBreak(5);
        doc.text(line, margin, yPos);
        yPos += 4.5;
      });
      yPos += 4;
    };

    const addList = (title: string, items: string[] | undefined) => {
      if (!items || items.length === 0) {
        addSection(title, 'Not specified');
        return;
      }
      checkBreak(15 + items.length * 5);
      doc.setFontSize(PDF_FONT_SIZES.body);
      doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
      doc.setFont('times', 'bold');
      doc.text(clean(title), margin, yPos);
      yPos += 6;
      doc.setFont('times', 'normal');
      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setTextColor(0, 0, 0);
      items.forEach(item => {
        checkBreak(5);
        doc.text(`- ${clean(item)}`, margin + 2, yPos);
        yPos += 4.5;
      });
      yPos += 3;
    };

    addSection('Clinical Summary', plan.clinical_summary || 'Not specified');
    addList('Keloid Location(s)', plan.keloid_locations);
    addList('Identified Problems & Concerns', plan.problems_concerns);

    if (plan.has_no_comorbidities) {
      addSection('Comorbidities', 'None');
    } else {
      addList('Comorbidities', plan.comorbidities);
    }

    addList('Risk Factors', plan.risk_factors);

    // Pre-treatment tests
    checkBreak(40);
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.setFont('times', 'bold');
    doc.text('PRE-TREATMENT INVESTIGATIONS', margin, yPos);
    yPos += 7;

    doc.setFontSize(PDF_FONT_SIZES.tableBody);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    const isReproductiveAge = this.isReproductiveAge(plan.gender || '', plan.date_of_birth || '');
    const tests = [
      'Full Blood Count (FBC) - Baseline hematological status',
      'Fasting Blood Sugar (FBS) - Screen for diabetes/steroid monitoring',
      'Mantoux Test - Screen for latent TB before steroids',
    ];
    if (isReproductiveAge) {
      tests.push('Pregnancy Test (Beta-hCG) - Rule out pregnancy (teratogenic risk)');
    }
    tests.forEach(test => {
      checkBreak(6);
      doc.text(`[ ] ${clean(test)}`, margin, yPos);
      yPos += 5.5;
    });
    yPos += 5;

    // Treatment Plan
    checkBreak(35);
    doc.setFontSize(12);
    doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setFont('times', 'bold');
    doc.text('TREATMENT PLAN', margin, yPos);
    yPos += 8;

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setTextColor(37, 99, 235);
    doc.text('Pre-Operative Triamcinolone Injections', margin, yPos);
    yPos += 6;
    doc.setFontSize(PDF_FONT_SIZES.tableBody);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`- Number of sessions: ${plan.preop_triamcinolone_count || 0}`, margin + 2, yPos);
    yPos += 5;
    doc.text(`- Interval: Every ${plan.preop_injection_interval_weeks || 3} weeks`, margin + 2, yPos);
    yPos += 7;

    if (plan.surgery_planned) {
      doc.setFontSize(PDF_FONT_SIZES.body);
      doc.setFont('times', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('Post-Operative Triamcinolone Injections', margin, yPos);
      yPos += 6;
      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setFont('times', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`- Number of sessions: ${plan.postop_triamcinolone_count || 0}`, margin + 2, yPos);
      yPos += 5;
      doc.text(`- Interval: Every ${plan.postop_injection_interval_weeks || 3} weeks`, margin + 2, yPos);
      yPos += 7;
    }

    // Surgery Details
    if (plan.surgery_planned) {
      checkBreak(30);
      doc.setFontSize(12);
      doc.setTextColor(124, 58, 237);
      doc.setFont('times', 'bold');
      doc.text('SURGERY DETAILS', margin, yPos);
      yPos += 7;
      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setFont('times', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Scheduled Date: ${plan.surgery_date ? format(new Date(plan.surgery_date), 'dd MMMM yyyy') : 'To be scheduled'}`, margin, yPos);
      yPos += 5;
      doc.text(`Technique: ${clean(plan.surgery_technique) || 'Not specified'}`, margin, yPos);
      yPos += 5;
      if (plan.surgery_notes) {
        doc.text(`Notes: ${clean(plan.surgery_notes)}`, margin, yPos);
        yPos += 5;
      }
      yPos += 5;
    }

    // Adjunct Therapy
    checkBreak(35);
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.setFont('times', 'bold');
    doc.text('ADJUNCT THERAPY', margin, yPos);
    yPos += 7;
    doc.setFontSize(PDF_FONT_SIZES.tableBody);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    doc.setFont('times', 'bold');
    doc.text('Silicone Sheet/Gel Therapy:', margin, yPos);
    yPos += 5;
    doc.setFont('times', 'normal');
    if (plan.silicone_sheet_start_date) {
      doc.text(`- Start Date: ${format(new Date(plan.silicone_sheet_start_date), 'dd MMMM yyyy')}`, margin + 2, yPos);
      yPos += 5;
      doc.text(`- Duration: ${plan.silicone_sheet_duration_months || 6} months`, margin + 2, yPos);
    } else {
      doc.text('- Not yet scheduled', margin + 2, yPos);
    }
    yPos += 7;

    doc.setFont('times', 'bold');
    doc.text('Compression Therapy:', margin, yPos);
    yPos += 5;
    doc.setFont('times', 'normal');
    if (plan.compression_therapy_start_date) {
      doc.text(`- Start Date: ${format(new Date(plan.compression_therapy_start_date), 'dd MMMM yyyy')}`, margin + 2, yPos);
      yPos += 5;
      doc.text(`- Duration: ${plan.compression_therapy_duration_months || 6} months`, margin + 2, yPos);
    } else {
      doc.text('- Not yet scheduled', margin + 2, yPos);
    }
    yPos += 7;

    // Radiotherapy
    if (plan.radiotherapy_indicated) {
      checkBreak(60);
      doc.setFontSize(12);
      doc.setTextColor(220, 38, 38);
      doc.setFont('times', 'bold');
      doc.text('POST-OPERATIVE RADIOTHERAPY', margin, yPos);
      yPos += 7;
      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setTextColor(0, 0, 0);

      doc.setFont('times', 'bold');
      doc.text('Indications:', margin, yPos);
      yPos += 5;
      doc.setFont('times', 'normal');
      if (plan.radiotherapy_indications?.length) {
        plan.radiotherapy_indications.forEach(ind => {
          doc.text(`- ${clean(ind)}`, margin + 2, yPos);
          yPos += 5;
        });
      }
      yPos += 2;

      doc.setFont('times', 'bold');
      doc.text('Protocol:', margin, yPos);
      yPos += 5;
      doc.setFont('times', 'normal');
      doc.text(`- Timing: ${clean(plan.radiotherapy_timing) || 'Within 24-72 hours post-surgery'}`, margin + 2, yPos);
      yPos += 5;
      doc.text(`- Dose: ${clean(plan.radiotherapy_dose) || 'As per oncology protocol'}`, margin + 2, yPos);
      yPos += 5;
      doc.text(`- Fractions: ${clean(String(plan.radiotherapy_fractions || '')) || 'TBD'}`, margin + 2, yPos);
      yPos += 7;

      doc.setFont('times', 'bold');
      doc.text('Potential Side Effects:', margin, yPos);
      yPos += 5;
      doc.setFont('times', 'normal');
      const sideEffects = plan.radiotherapy_side_effects?.slice(0, 6) || [
        'Erythema (skin redness)',
        'Hyperpigmentation',
        'Skin dryness',
        'Delayed wound healing'
      ];
      sideEffects.forEach(effect => {
        doc.text(`- ${clean(effect)}`, margin + 2, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Compliance
    checkBreak(50);
    doc.setFontSize(12);
    doc.setTextColor(217, 119, 6);
    doc.setFont('times', 'bold');
    doc.text('IMPORTANT: COMPLIANCE REQUIREMENTS', margin, yPos);
    yPos += 7;

    doc.setFontSize(PDF_FONT_SIZES.small);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    const compliancePoints = [
      'Attend ALL scheduled injection appointments - missing injections can cause keloid regrowth',
      'Use silicone sheets/gel as directed: 12-24 hours daily for minimum 3-6 months',
      'Wear compression garments consistently as prescribed',
      'Protect treated areas from sun exposure - use SPF 30+ sunscreen',
      'Never miss scheduled follow-up reviews',
      'Report any concerning symptoms immediately (pain, infection, unusual growth)'
    ];

    compliancePoints.forEach(point => {
      checkBreak(6);
      doc.text(`- ${clean(point)}`, margin, yPos);
      yPos += 5.5;
    });

    if (plan.compliance_notes) {
      yPos += 3;
      doc.setFont('times', 'italic');
      doc.text(`Notes: ${clean(plan.compliance_notes)}`, margin, yPos);
    }

    addFooter(doc);

    const fileName = `Keloid_Care_Plan_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  }

  /**
   * Generate Patient Education Handout PDF
   */
  generatePatientEducationPdf(): void {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = PDF_MARGINS.left;
    const maxWidth = pageWidth - margin - PDF_MARGINS.right;
    let yPos = 15;

    const checkBreak = (needed: number) => {
      if (yPos + needed > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
      }
    };

    doc.setFontSize(18);
    doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setFont('times', 'bold');
    doc.text('KELOID PATIENT EDUCATION GUIDE', margin, yPos);
    yPos += 10;

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setTextColor(100, 100, 100);
    doc.setFont('times', 'normal');
    doc.text('Everything You Need to Know About Keloid Treatment', margin, yPos);
    yPos += 12;

    const addEduSection = (title: string, content: string) => {
      checkBreak(50);
      doc.setFontSize(13);
      doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
      doc.setFont('times', 'bold');
      doc.text(clean(title), margin, yPos);
      yPos += 7;
      doc.setFont('times', 'normal');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(PDF_FONT_SIZES.small);
      const lines = doc.splitTextToSize(clean(content.trim()), maxWidth);
      lines.forEach((line: string) => {
        checkBreak(5);
        doc.text(line, margin, yPos);
        yPos += 4;
      });
      yPos += 7;
    };

    addEduSection('WHAT IS A KELOID?', KELOID_EDUCATION.whatIsKeloid);
    addEduSection('RISK FACTORS', KELOID_EDUCATION.riskFactors);
    addEduSection('TREATMENT OPTIONS', KELOID_EDUCATION.treatmentOptions);
    addEduSection('WHY MULTI-MODALITY TREATMENT?', KELOID_EDUCATION.multimodalityApproach);
    addEduSection('IMPORTANCE OF TREATMENT COMPLIANCE', KELOID_EDUCATION.compliance);

    checkBreak(70);
    doc.setFontSize(14);
    doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setFont('times', 'bold');
    doc.text('PRE-TREATMENT INVESTIGATIONS', margin, yPos);
    yPos += 7;

    doc.setFontSize(PDF_FONT_SIZES.tableBody);
    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'normal');
    const testInfo = 'Before starting Triamcinolone (steroid) injections, the following tests are required:\n\n1. FULL BLOOD COUNT (FBC) - Checks your overall blood health, detects any underlying infections or abnormalities.\n\n2. MANTOUX TEST (Tuberculin Skin Test) - Screens for latent tuberculosis. Important as steroids can reactivate dormant TB.\n\n3. FASTING BLOOD SUGAR (FBS) - Screens for diabetes. Steroids can affect blood sugar levels.\n\n4. PREGNANCY TEST (For females of reproductive age 12-50 years) - Triamcinolone may be harmful to unborn babies. Must be negative before treatment can begin.\n\nThese tests ensure your safety during treatment. All results must be reviewed before starting injections.';

    const testLines = doc.splitTextToSize(clean(testInfo), maxWidth);
    testLines.forEach((line: string) => {
      checkBreak(5);
      doc.text(line, margin, yPos);
      yPos += 4.2;
    });

    addFooter(doc);
    doc.save(`Keloid_Patient_Education_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }

  /**
   * Generate Pre-Treatment Checklist PDF
   */
  generatePreTreatmentChecklistPdf(plan: KeloidCarePlan): void {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = PDF_MARGINS.left;
    const maxWidth = pageWidth - margin - PDF_MARGINS.right;
    let yPos = 15;

    const patientName = clean(`${plan.first_name || ''} ${plan.last_name || ''}`).trim();

    doc.setFontSize(16);
    doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setFont('times', 'bold');
    doc.text('PRE-TRIAMCINOLONE INJECTION CHECKLIST', margin, yPos);
    yPos += 8;

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'normal');
    doc.text(`Patient: ${patientName}`, margin, yPos);
    yPos += 5;
    doc.text(`Hospital Number: ${clean(plan.hospital_number) || 'N/A'}`, margin, yPos);
    yPos += 5;
    doc.text(`Date: ${format(new Date(), 'dd MMMM yyyy')}`, margin, yPos);
    yPos += 12;

    doc.setFontSize(13);
    doc.setTextColor(220, 38, 38);
    doc.setFont('times', 'bold');
    doc.text('REQUIRED PRE-TREATMENT TESTS', margin, yPos);
    yPos += 8;

    const isReproductiveAge = this.isReproductiveAge(plan.gender || '', plan.date_of_birth || '');

    const tests = [
      { name: 'Full Blood Count (FBC)', reason: 'Baseline hematological status', required: true },
      { name: 'Fasting Blood Sugar (FBS)', reason: 'Screen for diabetes/steroid effect monitoring', required: true },
      { name: 'Mantoux Test (Tuberculin Skin Test)', reason: 'Screen for latent TB before steroids', required: true },
      { name: 'Pregnancy Test (urine Beta-hCG)', reason: 'Rule out pregnancy (teratogenic risk)', required: isReproductiveAge },
    ];

    doc.setFontSize(PDF_FONT_SIZES.body);
    tests.forEach((test) => {
      if (test.required) {
        doc.setDrawColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
        doc.rect(margin, yPos - 4, 5, 5);
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'bold');
        doc.text(clean(test.name), margin + 8, yPos);
        yPos += 5;
        doc.setFont('times', 'normal');
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(PDF_FONT_SIZES.small);
        doc.text(`Reason: ${clean(test.reason)}`, margin + 8, yPos);
        yPos += 4;
        doc.text('Result: ________________  Normal: [ ] Yes  [ ] No  Date: __________', margin + 8, yPos);
        yPos += 10;
        doc.setFontSize(PDF_FONT_SIZES.body);
      }
    });

    yPos += 8;
    doc.setFontSize(12);
    doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setFont('times', 'bold');
    doc.text('CLEARANCE FOR TREATMENT', margin, yPos);
    yPos += 8;

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(PDF_FONT_SIZES.tableBody);
    doc.setFont('times', 'normal');
    const clearanceItems = [
      '[ ] All required tests completed and results reviewed',
      '[ ] All results within acceptable limits',
      '[ ] Patient counseled on treatment plan and potential side effects',
      '[ ] Informed consent obtained',
      '[ ] Patient understands importance of compliance with scheduled appointments'
    ];
    clearanceItems.forEach(item => {
      doc.text(item, margin, yPos);
      yPos += 6;
    });
    yPos += 10;

    doc.text('Cleared by: _________________________', margin, yPos);
    yPos += 7;
    doc.text('Signature: _________________________  Date: ______________', margin, yPos);

    addFooter(doc);
    const fileName = `Keloid_Pre_Treatment_Checklist_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  }

  /**
   * Generate Treatment Schedule PDF
   */
  generateTreatmentSchedulePdf(plan: KeloidCarePlan): void {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = PDF_MARGINS.left;
    const maxWidth = pageWidth - margin - PDF_MARGINS.right;
    let yPos = 15;

    const patientName = clean(`${plan.first_name || ''} ${plan.last_name || ''}`).trim();

    const checkBreak = (needed: number) => {
      if (yPos + needed > pageHeight - 20) {
        doc.addPage();
        yPos = 15;
      }
    };

    doc.setFontSize(16);
    doc.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setFont('times', 'bold');
    doc.text('KELOID TREATMENT SCHEDULE', margin, yPos);
    yPos += 8;

    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'normal');
    doc.text(`Patient: ${patientName}`, margin, yPos);
    yPos += 5;
    doc.text(`Hospital Number: ${clean(plan.hospital_number) || 'N/A'}`, margin, yPos);
    yPos += 12;

    // Pre-operative injections
    if (plan.preop_triamcinolone_count > 0) {
      doc.setFontSize(13);
      doc.setTextColor(37, 99, 235);
      doc.setFont('times', 'bold');
      doc.text('PRE-OPERATIVE INJECTIONS', margin, yPos);
      yPos += 7;

      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setTextColor(0, 0, 0);
      doc.setFont('times', 'normal');
      doc.text(`Number of sessions: ${plan.preop_triamcinolone_count}`, margin, yPos);
      yPos += 5;
      doc.text(`Interval: Every ${plan.preop_injection_interval_weeks || 3} weeks`, margin, yPos);
      yPos += 8;

      doc.setFillColor(240, 240, 240);
      doc.rect(margin, yPos - 4, maxWidth, 8, 'F');
      doc.setFont('times', 'bold');
      doc.text('Session', margin + 2, yPos);
      doc.text('Scheduled Date', margin + 25, yPos);
      doc.text('Status', margin + 75, yPos);
      doc.text('Notes', margin + 110, yPos);
      yPos += 8;

      doc.setFont('times', 'normal');
      const startDate = new Date();
      for (let i = 0; i < plan.preop_triamcinolone_count; i++) {
        checkBreak(7);
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + (i * (plan.preop_injection_interval_weeks || 3) * 7));
        doc.text(`#${i + 1}`, margin + 2, yPos);
        doc.text(format(scheduledDate, 'dd MMM yyyy'), margin + 25, yPos);
        doc.text('[ ] Completed', margin + 75, yPos);
        doc.text('________________', margin + 110, yPos);
        yPos += 7;
      }
      yPos += 8;
    }

    // Surgery
    if (plan.surgery_planned) {
      checkBreak(25);
      doc.setFontSize(13);
      doc.setTextColor(124, 58, 237);
      doc.setFont('times', 'bold');
      doc.text('SURGERY', margin, yPos);
      yPos += 7;

      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setTextColor(0, 0, 0);
      doc.setFont('times', 'normal');
      doc.text(`Scheduled Date: ${plan.surgery_date ? format(new Date(plan.surgery_date), 'dd MMMM yyyy') : 'TBD'}`, margin, yPos);
      yPos += 5;
      doc.text(`Technique: ${clean(plan.surgery_technique) || 'TBD'}`, margin, yPos);
      yPos += 12;

      // Post-operative injections
      if (plan.postop_triamcinolone_count > 0) {
        checkBreak(30);
        doc.setFontSize(13);
        doc.setTextColor(5, 150, 105);
        doc.setFont('times', 'bold');
        doc.text('POST-OPERATIVE INJECTIONS', margin, yPos);
        yPos += 7;

        doc.setFontSize(PDF_FONT_SIZES.tableBody);
        doc.setTextColor(0, 0, 0);
        doc.setFont('times', 'normal');
        doc.text(`Number of sessions: ${plan.postop_triamcinolone_count}`, margin, yPos);
        yPos += 5;
        doc.text(`Interval: Every ${plan.postop_injection_interval_weeks || 3} weeks`, margin, yPos);
        yPos += 5;
        doc.text('(Starting from surgery date)', margin, yPos);
        yPos += 8;

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, yPos - 4, maxWidth, 8, 'F');
        doc.setFont('times', 'bold');
        doc.text('Session', margin + 2, yPos);
        doc.text('Scheduled Date', margin + 25, yPos);
        doc.text('Status', margin + 75, yPos);
        doc.text('Notes', margin + 110, yPos);
        yPos += 8;

        doc.setFont('times', 'normal');
        const surgeryDate = plan.surgery_date ? new Date(plan.surgery_date) : new Date();
        for (let i = 0; i < plan.postop_triamcinolone_count; i++) {
          checkBreak(7);
          const scheduledDate = new Date(surgeryDate);
          scheduledDate.setDate(scheduledDate.getDate() + ((i + 1) * (plan.postop_injection_interval_weeks || 3) * 7));
          doc.text(`#${i + 1}`, margin + 2, yPos);
          doc.text(format(scheduledDate, 'dd MMM yyyy'), margin + 25, yPos);
          doc.text('[ ] Completed', margin + 75, yPos);
          doc.text('________________', margin + 110, yPos);
          yPos += 7;
        }
      }
    }

    // Adjunct therapy
    yPos += 8;
    checkBreak(25);
    doc.setFontSize(13);
    doc.setTextColor(37, 99, 235);
    doc.setFont('times', 'bold');
    doc.text('ADJUNCT THERAPY', margin, yPos);
    yPos += 7;

    doc.setFontSize(PDF_FONT_SIZES.tableBody);
    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'normal');
    if (plan.silicone_sheet_start_date) {
      doc.text(`Silicone Sheet/Gel: Starting ${format(new Date(plan.silicone_sheet_start_date), 'dd MMM yyyy')} for ${plan.silicone_sheet_duration_months || 6} months`, margin, yPos);
      yPos += 6;
    }
    if (plan.compression_therapy_start_date) {
      doc.text(`Compression Therapy: Starting ${format(new Date(plan.compression_therapy_start_date), 'dd MMM yyyy')} for ${plan.compression_therapy_duration_months || 6} months`, margin, yPos);
      yPos += 6;
    }

    // Radiotherapy
    if (plan.radiotherapy_indicated) {
      yPos += 8;
      checkBreak(25);
      doc.setFontSize(13);
      doc.setTextColor(220, 38, 38);
      doc.setFont('times', 'bold');
      doc.text('POST-OPERATIVE RADIOTHERAPY', margin, yPos);
      yPos += 7;

      doc.setFontSize(PDF_FONT_SIZES.tableBody);
      doc.setTextColor(0, 0, 0);
      doc.setFont('times', 'normal');
      doc.text(`Timing: ${clean(plan.radiotherapy_timing) || 'Within 24-72 hours post-surgery'}`, margin, yPos);
      yPos += 5;
      doc.text(`Dose: ${clean(plan.radiotherapy_dose) || 'As per oncology protocol'}`, margin, yPos);
      yPos += 5;
      doc.text(`Fractions: ${clean(String(plan.radiotherapy_fractions || '')) || 'TBD'}`, margin, yPos);
    }

    addFooter(doc);

    const fileName = `Keloid_Treatment_Schedule_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);
  }

  // Helper methods
  private getPhaseLabel(phase: string): string {
    const labels: Record<string, string> = {
      'pre_treatment': 'Pre-Treatment Assessment',
      'preop_injections': 'Pre-Operative Injections',
      'surgery': 'Awaiting/Post Surgery',
      'postop_injections': 'Post-Operative Injections',
      'maintenance': 'Maintenance Therapy',
      'completed': 'Treatment Completed'
    };
    return labels[phase] || phase;
  }

  private isReproductiveAge(gender: string, dob: string): boolean {
    if (gender?.toLowerCase() !== 'female') return false;
    if (!dob) return false;
    const birthDate = new Date(dob);
    const today = new Date();
    const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return age >= 12 && age <= 50;
  }

  /**
   * Generate Thermal 80mm Keloid Care Plan PDF
   */
  async generateThermalCarePlanPdf(plan: KeloidCarePlan): Promise<void> {
    const { jsPDF } = await import('jspdf');
    const thermalWidth = 80;
    const m = 3;

    let estHeight = 200;
    estHeight += (plan.injections?.length || 0) * 10;
    estHeight += (plan.surgery_notes ? 40 : 0);
    estHeight = Math.max(estHeight, 250);

    const doc = sanitizePdfDocument(new jsPDF({ orientation: 'portrait', unit: 'mm', format: [thermalWidth, estHeight] }));
    let y = m;

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text('KELOID CARE PLAN', thermalWidth / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(14);
    doc.setFont('times', 'normal');
    doc.text('UNTH Plastic Surgery Unit', thermalWidth / 2, y, { align: 'center' });
    y += 5;
    doc.line(m, y, thermalWidth - m, y);
    y += 5;

    const patientName = clean(`${plan.first_name || ''} ${plan.last_name || ''}`).trim();
    doc.setFontSize(14);
    doc.text('Patient: ' + patientName, m, y); y += 5;
    doc.text('Hosp #: ' + clean(plan.hospital_number), m, y); y += 5;
    doc.text('Summary: ' + clean(plan.clinical_summary), m, y); y += 5;
    if (plan.keloid_locations?.length) {
      doc.text('Location: ' + plan.keloid_locations.map(l => clean(l)).join(', '), m, y); y += 5;
    }
    doc.text('Phase: ' + this.getPhaseLabel(plan.phase), m, y); y += 5;
    doc.text('Date: ' + format(new Date(), 'dd/MM/yyyy'), m, y); y += 5;
    doc.line(m, y, thermalWidth - m, y);
    y += 5;

    // Classification
    doc.setFontSize(14);
    doc.setFont('times', 'bold');
    doc.text('DETAILS', m, y); y += 5;
    doc.setFontSize(14);
    doc.setFont('times', 'normal');
    doc.text('Surgery Planned: ' + (plan.surgery_planned ? 'Yes' : 'No'), m, y); y += 5;
    doc.text('Radiotherapy: ' + (plan.radiotherapy_indicated ? 'Yes' : 'No'), m, y); y += 5;
    doc.text('Status: ' + clean(plan.status), m, y); y += 5;

    // Injections summary
    if (plan.injections && plan.injections.length > 0) {
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('INJECTIONS', m, y); y += 5;
      doc.setFontSize(14);
      doc.setFont('times', 'normal');
      const completed = plan.injections.filter(inj => inj.status === 'completed').length;
      doc.text('Completed: ' + completed + '/' + plan.injections.length, m, y); y += 5;
    }

    // Treatment notes
    if (plan.surgery_notes) {
      y += 2;
      doc.setFont('times', 'bold');
      doc.setFontSize(14);
      doc.text('SURGICAL NOTES', m, y); y += 5;
      doc.setFontSize(14);
      doc.setFont('times', 'normal');
      const lines = doc.splitTextToSize(clean(plan.surgery_notes), thermalWidth - m * 2);
      lines.forEach((line: string) => { doc.text(line, m, y); y += 5; });
    }

    doc.save('Keloid_CarePlan_Thermal_' + clean(plan.hospital_number) + '_' + format(new Date(), 'yyyy-MM-dd') + '.pdf');
  }
}

export const keloidPdfService = new KeloidPdfService();
