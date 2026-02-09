// Keloid Care Plan PDF Generation Service
import jsPDF from 'jspdf';
import { KeloidCarePlan, RADIOTHERAPY_SIDE_EFFECT_MANAGEMENT, KELOID_EDUCATION } from './keloidCareService';
import { format } from 'date-fns';

const PRIMARY_COLOR = '#0E9F6E';
const ALERT_COLOR = '#DC2626';
const TEXT_COLOR = '#374151';
const LIGHT_TEXT = '#6B7280';

class KeloidPdfService {
  private doc!: jsPDF;
  private yPos: number = 20;
  private pageHeight: number = 280;
  private leftMargin: number = 20;
  private rightMargin: number = 190;

  /**
   * Generate comprehensive Keloid Care Plan PDF
   */
  generateCarePlanPdf(plan: KeloidCarePlan): void {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.yPos = 20;

    // Add header
    this.addHeader(plan);

    // Add patient information
    this.addPatientInfo(plan);

    // Add clinical summary
    this.addSection('Clinical Summary', plan.clinical_summary || 'Not specified');

    // Add keloid details
    this.addListSection('Keloid Location(s)', plan.keloid_locations);
    this.addListSection('Identified Problems & Concerns', plan.problems_concerns, ALERT_COLOR);

    // Add comorbidities
    if (plan.has_no_comorbidities) {
      this.addSection('Comorbidities', 'None');
    } else {
      this.addListSection('Comorbidities', plan.comorbidities, '#D97706');
    }

    // Add risk factors
    this.addListSection('Risk Factors', plan.risk_factors, '#EA580C');

    // Add pre-treatment tests section
    this.addPreTreatmentTestsSection(plan);

    // Add treatment plan
    this.addTreatmentPlanSection(plan);

    // Add surgery details
    if (plan.surgery_planned) {
      this.addSurgerySection(plan);
    }

    // Add adjunct therapy
    this.addAdjunctTherapySection(plan);

    // Add radiotherapy if indicated
    if (plan.radiotherapy_indicated) {
      this.addRadiotherapySection(plan);
    }

    // Add compliance notes
    this.addComplianceSection(plan);

    // Add footer
    this.addFooter(plan);

    // Download PDF
    const patientName = `${plan.first_name || ''}_${plan.last_name || ''}`.trim().replace(/\s+/g, '_');
    const fileName = `Keloid_Care_Plan_${patientName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    this.doc.save(fileName);
  }

  /**
   * Generate Patient Education Handout PDF
   */
  generatePatientEducationPdf(): void {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.yPos = 20;

    // Title
    this.doc.setFontSize(22);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.text('KELOID PATIENT EDUCATION GUIDE', this.leftMargin, this.yPos);
    this.yPos += 15;

    // Subtitle
    this.doc.setFontSize(12);
    this.doc.setTextColor(LIGHT_TEXT);
    this.doc.text('Everything You Need to Know About Keloid Treatment', this.leftMargin, this.yPos);
    this.yPos += 15;

    // What is a Keloid
    this.addEducationSection('WHAT IS A KELOID?', KELOID_EDUCATION.whatIsKeloid);

    // Risk Factors
    this.addEducationSection('RISK FACTORS', KELOID_EDUCATION.riskFactors);

    // Treatment Options
    this.addEducationSection('TREATMENT OPTIONS', KELOID_EDUCATION.treatmentOptions);

    // Multi-Modality Approach
    this.addEducationSection('WHY MULTI-MODALITY TREATMENT?', KELOID_EDUCATION.multimodalityApproach);

    // Importance of Compliance
    this.addEducationSection('IMPORTANCE OF TREATMENT COMPLIANCE', KELOID_EDUCATION.compliance);

    // Pre-Treatment Tests
    this.checkPageBreak(80);
    this.doc.setFontSize(14);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.text('PRE-TREATMENT INVESTIGATIONS', this.leftMargin, this.yPos);
    this.yPos += 8;

    this.doc.setFontSize(10);
    this.doc.setTextColor(TEXT_COLOR);
    const testInfo = `
Before starting Triamcinolone (steroid) injections, the following tests are required:

1. FULL BLOOD COUNT (FBC)
   - Checks your overall blood health
   - Detects any underlying infections or abnormalities

2. MANTOUX TEST (Tuberculin Skin Test)
   - Screens for latent tuberculosis
   - Important as steroids can reactivate dormant TB

3. FASTING BLOOD SUGAR (FBS)
   - Screens for diabetes
   - Steroids can affect blood sugar levels

4. PREGNANCY TEST (For females of reproductive age 12-50 years)
   - Triamcinolone may be harmful to unborn babies
   - Must be negative before treatment can begin

These tests ensure your safety during treatment. All results must be reviewed before starting injections.
    `;
    this.addWrappedText(testInfo, 10);

    // Footer
    this.yPos += 10;
    this.doc.setFontSize(8);
    this.doc.setTextColor(LIGHT_TEXT);
    this.doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy')}`, this.leftMargin, this.yPos);
    this.doc.text('Plastic Surgery Assistant - For Medical Professional Use', this.rightMargin - 80, this.yPos);

    // Save
    this.doc.save(`Keloid_Patient_Education_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  }

  /**
   * Generate Pre-Treatment Checklist PDF
   */
  generatePreTreatmentChecklistPdf(plan: KeloidCarePlan): void {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.yPos = 20;

    // Header
    this.doc.setFontSize(18);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.text('PRE-TRIAMCINOLONE INJECTION CHECKLIST', this.leftMargin, this.yPos);
    this.yPos += 10;

    // Patient info
    this.doc.setFontSize(12);
    this.doc.setTextColor(TEXT_COLOR);
    const patientName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim();
    this.doc.text(`Patient: ${patientName}`, this.leftMargin, this.yPos);
    this.yPos += 6;
    this.doc.text(`Hospital Number: ${plan.hospital_number || 'N/A'}`, this.leftMargin, this.yPos);
    this.yPos += 6;
    this.doc.text(`Date: ${format(new Date(), 'dd MMMM yyyy')}`, this.leftMargin, this.yPos);
    this.yPos += 15;

    // Required tests
    this.doc.setFontSize(14);
    this.doc.setTextColor(ALERT_COLOR);
    this.doc.text('REQUIRED PRE-TREATMENT TESTS', this.leftMargin, this.yPos);
    this.yPos += 10;

    const isReproductiveAge = this.isReproductiveAge(plan.gender || '', plan.date_of_birth || '');

    const tests = [
      { name: 'Full Blood Count (FBC)', reason: 'Baseline hematological status', required: true },
      { name: 'Fasting Blood Sugar (FBS)', reason: 'Screen for diabetes/steroid effect monitoring', required: true },
      { name: 'Mantoux Test (Tuberculin Skin Test)', reason: 'Screen for latent TB before steroids', required: true },
      { name: 'Pregnancy Test (urine β-hCG)', reason: 'Rule out pregnancy (teratogenic risk)', required: isReproductiveAge },
    ];

    this.doc.setFontSize(11);
    tests.forEach((test) => {
      if (test.required) {
        // Checkbox
        this.doc.setDrawColor(PRIMARY_COLOR);
        this.doc.rect(this.leftMargin, this.yPos - 4, 5, 5);
        
        // Test name
        this.doc.setTextColor(TEXT_COLOR);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(test.name, this.leftMargin + 8, this.yPos);
        this.yPos += 5;
        
        // Reason
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(LIGHT_TEXT);
        this.doc.setFontSize(9);
        this.doc.text(`Reason: ${test.reason}`, this.leftMargin + 8, this.yPos);
        this.yPos += 4;
        
        // Result spaces
        this.doc.text('Result: ________________  Normal: ☐ Yes  ☐ No  Date: __________', this.leftMargin + 8, this.yPos);
        this.yPos += 12;
        this.doc.setFontSize(11);
      }
    });

    // Clearance
    this.yPos += 10;
    this.doc.setFontSize(12);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.text('CLEARANCE FOR TREATMENT', this.leftMargin, this.yPos);
    this.yPos += 10;

    this.doc.setTextColor(TEXT_COLOR);
    this.doc.setFontSize(10);
    this.doc.text('☐ All required tests completed and results reviewed', this.leftMargin, this.yPos);
    this.yPos += 7;
    this.doc.text('☐ All results within acceptable limits', this.leftMargin, this.yPos);
    this.yPos += 7;
    this.doc.text('☐ Patient counseled on treatment plan and potential side effects', this.leftMargin, this.yPos);
    this.yPos += 7;
    this.doc.text('☐ Informed consent obtained', this.leftMargin, this.yPos);
    this.yPos += 7;
    this.doc.text('☐ Patient understands importance of compliance with scheduled appointments', this.leftMargin, this.yPos);
    this.yPos += 15;

    // Signature
    this.doc.text('Cleared by: _________________________', this.leftMargin, this.yPos);
    this.yPos += 7;
    this.doc.text('Signature: _________________________  Date: ______________', this.leftMargin, this.yPos);

    // Save
    const fileName = `Keloid_Pre_Treatment_Checklist_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    this.doc.save(fileName);
  }

  /**
   * Generate Treatment Schedule PDF
   */
  generateTreatmentSchedulePdf(plan: KeloidCarePlan): void {
    this.doc = new jsPDF('p', 'mm', 'a4');
    this.yPos = 20;

    const patientName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim();

    // Header
    this.doc.setFontSize(18);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.text('KELOID TREATMENT SCHEDULE', this.leftMargin, this.yPos);
    this.yPos += 10;

    // Patient info
    this.doc.setFontSize(12);
    this.doc.setTextColor(TEXT_COLOR);
    this.doc.text(`Patient: ${patientName}`, this.leftMargin, this.yPos);
    this.yPos += 6;
    this.doc.text(`Hospital Number: ${plan.hospital_number || 'N/A'}`, this.leftMargin, this.yPos);
    this.yPos += 15;

    // Pre-operative injections
    if (plan.preop_triamcinolone_count > 0) {
      this.doc.setFontSize(14);
      this.doc.setTextColor('#2563EB');
      this.doc.text('PRE-OPERATIVE INJECTIONS', this.leftMargin, this.yPos);
      this.yPos += 8;

      this.doc.setFontSize(10);
      this.doc.setTextColor(TEXT_COLOR);
      this.doc.text(`Number of sessions: ${plan.preop_triamcinolone_count}`, this.leftMargin, this.yPos);
      this.yPos += 5;
      this.doc.text(`Interval: Every ${plan.preop_injection_interval_weeks || 3} weeks`, this.leftMargin, this.yPos);
      this.yPos += 10;

      // Schedule table header
      this.doc.setFillColor(240, 240, 240);
      this.doc.rect(this.leftMargin, this.yPos - 4, 170, 8, 'F');
      this.doc.setFont('helvetica', 'bold');
      this.doc.text('Session', this.leftMargin + 2, this.yPos);
      this.doc.text('Scheduled Date', this.leftMargin + 30, this.yPos);
      this.doc.text('Status', this.leftMargin + 80, this.yPos);
      this.doc.text('Notes', this.leftMargin + 110, this.yPos);
      this.yPos += 8;

      this.doc.setFont('helvetica', 'normal');
      const startDate = new Date();
      for (let i = 0; i < plan.preop_triamcinolone_count; i++) {
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + (i * (plan.preop_injection_interval_weeks || 3) * 7));
        
        this.doc.text(`#${i + 1}`, this.leftMargin + 2, this.yPos);
        this.doc.text(format(scheduledDate, 'dd MMM yyyy'), this.leftMargin + 30, this.yPos);
        this.doc.text('☐ Completed', this.leftMargin + 80, this.yPos);
        this.doc.text('________________', this.leftMargin + 110, this.yPos);
        this.yPos += 7;
      }
      this.yPos += 10;
    }

    // Surgery
    if (plan.surgery_planned) {
      this.doc.setFontSize(14);
      this.doc.setTextColor('#7C3AED');
      this.doc.text('SURGERY', this.leftMargin, this.yPos);
      this.yPos += 8;

      this.doc.setFontSize(10);
      this.doc.setTextColor(TEXT_COLOR);
      this.doc.text(`Scheduled Date: ${plan.surgery_date ? format(new Date(plan.surgery_date), 'dd MMMM yyyy') : 'TBD'}`, this.leftMargin, this.yPos);
      this.yPos += 5;
      this.doc.text(`Technique: ${plan.surgery_technique || 'TBD'}`, this.leftMargin, this.yPos);
      this.yPos += 15;

      // Post-operative injections
      if (plan.postop_triamcinolone_count > 0) {
        this.doc.setFontSize(14);
        this.doc.setTextColor('#059669');
        this.doc.text('POST-OPERATIVE INJECTIONS', this.leftMargin, this.yPos);
        this.yPos += 8;

        this.doc.setFontSize(10);
        this.doc.setTextColor(TEXT_COLOR);
        this.doc.text(`Number of sessions: ${plan.postop_triamcinolone_count}`, this.leftMargin, this.yPos);
        this.yPos += 5;
        this.doc.text(`Interval: Every ${plan.postop_injection_interval_weeks || 3} weeks`, this.leftMargin, this.yPos);
        this.yPos += 5;
        this.doc.text('(Starting from surgery date)', this.leftMargin, this.yPos);
        this.yPos += 10;

        // Schedule table header
        this.doc.setFillColor(240, 240, 240);
        this.doc.rect(this.leftMargin, this.yPos - 4, 170, 8, 'F');
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Session', this.leftMargin + 2, this.yPos);
        this.doc.text('Scheduled Date', this.leftMargin + 30, this.yPos);
        this.doc.text('Status', this.leftMargin + 80, this.yPos);
        this.doc.text('Notes', this.leftMargin + 110, this.yPos);
        this.yPos += 8;

        this.doc.setFont('helvetica', 'normal');
        const surgeryDate = plan.surgery_date ? new Date(plan.surgery_date) : new Date();
        for (let i = 0; i < plan.postop_triamcinolone_count; i++) {
          const scheduledDate = new Date(surgeryDate);
          scheduledDate.setDate(scheduledDate.getDate() + ((i + 1) * (plan.postop_injection_interval_weeks || 3) * 7));
          
          this.doc.text(`#${i + 1}`, this.leftMargin + 2, this.yPos);
          this.doc.text(format(scheduledDate, 'dd MMM yyyy'), this.leftMargin + 30, this.yPos);
          this.doc.text('☐ Completed', this.leftMargin + 80, this.yPos);
          this.doc.text('________________', this.leftMargin + 110, this.yPos);
          this.yPos += 7;
        }
      }
    }

    // Adjunct therapy
    this.yPos += 10;
    this.doc.setFontSize(14);
    this.doc.setTextColor('#2563EB');
    this.doc.text('ADJUNCT THERAPY', this.leftMargin, this.yPos);
    this.yPos += 8;

    this.doc.setFontSize(10);
    this.doc.setTextColor(TEXT_COLOR);
    if (plan.silicone_sheet_start_date) {
      this.doc.text(`Silicone Sheet/Gel: Starting ${format(new Date(plan.silicone_sheet_start_date), 'dd MMM yyyy')} for ${plan.silicone_sheet_duration_months || 6} months`, this.leftMargin, this.yPos);
      this.yPos += 6;
    }
    if (plan.compression_therapy_start_date) {
      this.doc.text(`Compression Therapy: Starting ${format(new Date(plan.compression_therapy_start_date), 'dd MMM yyyy')} for ${plan.compression_therapy_duration_months || 6} months`, this.leftMargin, this.yPos);
      this.yPos += 6;
    }

    // Radiotherapy
    if (plan.radiotherapy_indicated) {
      this.yPos += 10;
      this.doc.setFontSize(14);
      this.doc.setTextColor(ALERT_COLOR);
      this.doc.text('POST-OPERATIVE RADIOTHERAPY', this.leftMargin, this.yPos);
      this.yPos += 8;

      this.doc.setFontSize(10);
      this.doc.setTextColor(TEXT_COLOR);
      this.doc.text(`Timing: ${plan.radiotherapy_timing || 'Within 24-72 hours post-surgery'}`, this.leftMargin, this.yPos);
      this.yPos += 5;
      this.doc.text(`Dose: ${plan.radiotherapy_dose || 'As per oncology protocol'}`, this.leftMargin, this.yPos);
      this.yPos += 5;
      this.doc.text(`Fractions: ${plan.radiotherapy_fractions || 'TBD'}`, this.leftMargin, this.yPos);
    }

    // Footer
    this.yPos = 270;
    this.doc.setFontSize(8);
    this.doc.setTextColor(LIGHT_TEXT);
    this.doc.text('Important: Bring this schedule to every appointment. Missing treatments may affect outcomes.', this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.text(`Generated on ${format(new Date(), 'dd MMMM yyyy')} | Plastic Surgery Assistant`, this.leftMargin, this.yPos);

    // Save
    const fileName = `Keloid_Treatment_Schedule_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    this.doc.save(fileName);
  }

  // Helper methods
  private addHeader(plan: KeloidCarePlan): void {
    // Logo/Title
    this.doc.setFontSize(20);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.text('KELOID CARE PLAN', this.leftMargin, this.yPos);
    
    // Date
    this.doc.setFontSize(10);
    this.doc.setTextColor(LIGHT_TEXT);
    this.doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy')}`, this.rightMargin - 40, this.yPos);
    
    this.yPos += 5;
    
    // Line
    this.doc.setDrawColor(PRIMARY_COLOR);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.leftMargin, this.yPos, this.rightMargin, this.yPos);
    this.yPos += 10;
  }

  private addPatientInfo(plan: KeloidCarePlan): void {
    const patientName = `${plan.first_name || ''} ${plan.last_name || ''}`.trim();
    
    this.doc.setFontSize(12);
    this.doc.setTextColor(TEXT_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Patient Information', this.leftMargin, this.yPos);
    this.yPos += 7;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.text(`Name: ${patientName}`, this.leftMargin, this.yPos);
    this.doc.text(`Hospital Number: ${plan.hospital_number || 'N/A'}`, 100, this.yPos);
    this.yPos += 5;
    this.doc.text(`Gender: ${plan.gender || 'N/A'}`, this.leftMargin, this.yPos);
    this.doc.text(`DOB: ${plan.date_of_birth ? format(new Date(plan.date_of_birth), 'dd/MM/yyyy') : 'N/A'}`, 100, this.yPos);
    this.yPos += 5;
    this.doc.text(`Phase: ${this.getPhaseLabel(plan.phase)}`, this.leftMargin, this.yPos);
    this.doc.text(`Status: ${plan.status}`, 100, this.yPos);
    this.yPos += 10;
  }

  private addSection(title: string, content: string): void {
    this.checkPageBreak(30);
    
    this.doc.setFontSize(11);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.leftMargin, this.yPos);
    this.yPos += 6;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    this.doc.setFontSize(10);
    
    this.addWrappedText(content, 10);
    this.yPos += 5;
  }

  private addListSection(title: string, items: string[] | undefined, color: string = '#2563EB'): void {
    if (!items || items.length === 0) {
      this.addSection(title, 'Not specified');
      return;
    }
    
    this.checkPageBreak(20 + items.length * 6);
    
    this.doc.setFontSize(11);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.leftMargin, this.yPos);
    this.yPos += 6;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(color);
    
    items.forEach(item => {
      this.doc.text(`• ${item}`, this.leftMargin + 2, this.yPos);
      this.yPos += 5;
    });
    
    this.yPos += 3;
  }

  private addPreTreatmentTestsSection(plan: KeloidCarePlan): void {
    this.checkPageBreak(50);
    
    this.doc.setFontSize(12);
    this.doc.setTextColor(ALERT_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PRE-TREATMENT INVESTIGATIONS', this.leftMargin, this.yPos);
    this.yPos += 8;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    
    const isReproductiveAge = this.isReproductiveAge(plan.gender || '', plan.date_of_birth || '');
    
    const tests = [
      'Full Blood Count (FBC) - Baseline hematological status',
      'Fasting Blood Sugar (FBS) - Screen for diabetes/steroid monitoring',
      'Mantoux Test - Screen for latent TB before steroids',
    ];
    
    if (isReproductiveAge) {
      tests.push('Pregnancy Test (β-hCG) - Rule out pregnancy (teratogenic risk)');
    }
    
    tests.forEach(test => {
      this.doc.text(`☐ ${test}`, this.leftMargin, this.yPos);
      this.yPos += 6;
    });
    
    this.yPos += 5;
  }

  private addTreatmentPlanSection(plan: KeloidCarePlan): void {
    this.checkPageBreak(40);
    
    this.doc.setFontSize(12);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('TREATMENT PLAN', this.leftMargin, this.yPos);
    this.yPos += 10;
    
    // Pre-op injections
    this.doc.setFontSize(11);
    this.doc.setTextColor('#2563EB');
    this.doc.text('Pre-Operative Triamcinolone Injections', this.leftMargin, this.yPos);
    this.yPos += 6;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    this.doc.text(`• Number of sessions: ${plan.preop_triamcinolone_count || 0}`, this.leftMargin + 2, this.yPos);
    this.yPos += 5;
    this.doc.text(`• Interval: Every ${plan.preop_injection_interval_weeks || 3} weeks`, this.leftMargin + 2, this.yPos);
    this.yPos += 8;
    
    // Post-op injections
    if (plan.surgery_planned) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor('#059669');
      this.doc.text('Post-Operative Triamcinolone Injections', this.leftMargin, this.yPos);
      this.yPos += 6;
      
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(TEXT_COLOR);
      this.doc.text(`• Number of sessions: ${plan.postop_triamcinolone_count || 0}`, this.leftMargin + 2, this.yPos);
      this.yPos += 5;
      this.doc.text(`• Interval: Every ${plan.postop_injection_interval_weeks || 3} weeks`, this.leftMargin + 2, this.yPos);
      this.yPos += 5;
    }
    
    this.yPos += 5;
  }

  private addSurgerySection(plan: KeloidCarePlan): void {
    this.checkPageBreak(40);
    
    this.doc.setFontSize(12);
    this.doc.setTextColor('#7C3AED');
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('SURGERY DETAILS', this.leftMargin, this.yPos);
    this.yPos += 8;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    
    this.doc.text(`Scheduled Date: ${plan.surgery_date ? format(new Date(plan.surgery_date), 'dd MMMM yyyy') : 'To be scheduled'}`, this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.text(`Technique: ${plan.surgery_technique || 'Not specified'}`, this.leftMargin, this.yPos);
    this.yPos += 5;
    
    if (plan.surgery_notes) {
      this.doc.text(`Notes: ${plan.surgery_notes}`, this.leftMargin, this.yPos);
      this.yPos += 5;
    }
    
    this.yPos += 5;
  }

  private addAdjunctTherapySection(plan: KeloidCarePlan): void {
    this.checkPageBreak(40);
    
    this.doc.setFontSize(12);
    this.doc.setTextColor('#2563EB');
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('ADJUNCT THERAPY', this.leftMargin, this.yPos);
    this.yPos += 8;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    
    // Silicone sheet
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Silicone Sheet/Gel Therapy:', this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    
    if (plan.silicone_sheet_start_date) {
      this.doc.text(`• Start Date: ${format(new Date(plan.silicone_sheet_start_date), 'dd MMMM yyyy')}`, this.leftMargin + 2, this.yPos);
      this.yPos += 5;
      this.doc.text(`• Duration: ${plan.silicone_sheet_duration_months || 6} months`, this.leftMargin + 2, this.yPos);
    } else {
      this.doc.text('• Not yet scheduled', this.leftMargin + 2, this.yPos);
    }
    this.yPos += 8;
    
    // Compression therapy
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Compression Therapy:', this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    
    if (plan.compression_therapy_start_date) {
      this.doc.text(`• Start Date: ${format(new Date(plan.compression_therapy_start_date), 'dd MMMM yyyy')}`, this.leftMargin + 2, this.yPos);
      this.yPos += 5;
      this.doc.text(`• Duration: ${plan.compression_therapy_duration_months || 6} months`, this.leftMargin + 2, this.yPos);
    } else {
      this.doc.text('• Not yet scheduled', this.leftMargin + 2, this.yPos);
    }
    this.yPos += 8;
  }

  private addRadiotherapySection(plan: KeloidCarePlan): void {
    this.checkPageBreak(80);
    
    this.doc.setFontSize(12);
    this.doc.setTextColor(ALERT_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('POST-OPERATIVE RADIOTHERAPY', this.leftMargin, this.yPos);
    this.yPos += 8;
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(TEXT_COLOR);
    
    // Indications
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Indications:', this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    
    if (plan.radiotherapy_indications?.length) {
      plan.radiotherapy_indications.forEach(ind => {
        this.doc.text(`• ${ind}`, this.leftMargin + 2, this.yPos);
        this.yPos += 5;
      });
    }
    this.yPos += 3;
    
    // Timing & Dose
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Protocol:', this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`• Timing: ${plan.radiotherapy_timing || 'Within 24-72 hours post-surgery'}`, this.leftMargin + 2, this.yPos);
    this.yPos += 5;
    this.doc.text(`• Dose: ${plan.radiotherapy_dose || 'As per oncology protocol'}`, this.leftMargin + 2, this.yPos);
    this.yPos += 5;
    this.doc.text(`• Fractions: ${plan.radiotherapy_fractions || 'TBD'}`, this.leftMargin + 2, this.yPos);
    this.yPos += 8;
    
    // Side effects
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Potential Side Effects:', this.leftMargin, this.yPos);
    this.yPos += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor('#D97706');
    
    const sideEffects = plan.radiotherapy_side_effects?.slice(0, 6) || [
      'Erythema (skin redness)',
      'Hyperpigmentation',
      'Skin dryness',
      'Delayed wound healing'
    ];
    
    sideEffects.forEach(effect => {
      this.doc.text(`• ${effect}`, this.leftMargin + 2, this.yPos);
      this.yPos += 5;
    });
    
    this.yPos += 5;
  }

  private addComplianceSection(plan: KeloidCarePlan): void {
    this.checkPageBreak(50);
    
    this.doc.setFontSize(12);
    this.doc.setTextColor('#D97706');
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('IMPORTANT: COMPLIANCE REQUIREMENTS', this.leftMargin, this.yPos);
    this.yPos += 8;
    
    this.doc.setFontSize(9);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    
    const compliancePoints = [
      'Attend ALL scheduled injection appointments - missing injections can cause keloid regrowth',
      'Use silicone sheets/gel as directed: 12-24 hours daily for minimum 3-6 months',
      'Wear compression garments consistently as prescribed',
      'Protect treated areas from sun exposure - use SPF 30+ sunscreen',
      'Never miss scheduled follow-up reviews',
      'Report any concerning symptoms immediately (pain, infection, unusual growth)'
    ];
    
    compliancePoints.forEach(point => {
      this.doc.text(`✓ ${point}`, this.leftMargin, this.yPos);
      this.yPos += 6;
    });
    
    if (plan.compliance_notes) {
      this.yPos += 3;
      this.doc.setFont('helvetica', 'italic');
      this.doc.text(`Notes: ${plan.compliance_notes}`, this.leftMargin, this.yPos);
    }
    
    this.yPos += 5;
  }

  private addFooter(plan: KeloidCarePlan): void {
    this.yPos = 280;
    this.doc.setDrawColor(PRIMARY_COLOR);
    this.doc.line(this.leftMargin, this.yPos - 5, this.rightMargin, this.yPos - 5);
    
    this.doc.setFontSize(8);
    this.doc.setTextColor(LIGHT_TEXT);
    this.doc.text(`Created by: ${plan.created_by_name || 'N/A'}`, this.leftMargin, this.yPos);
    this.doc.text(`Plan created: ${plan.created_at ? format(new Date(plan.created_at), 'dd/MM/yyyy') : 'N/A'}`, 80, this.yPos);
    this.doc.text('Plastic Surgery Assistant', this.rightMargin - 35, this.yPos);
  }

  private addEducationSection(title: string, content: string): void {
    this.checkPageBreak(60);
    
    this.doc.setFontSize(13);
    this.doc.setTextColor(PRIMARY_COLOR);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, this.leftMargin, this.yPos);
    this.yPos += 8;
    
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(TEXT_COLOR);
    this.doc.setFontSize(9);
    
    this.addWrappedText(content.trim(), 9);
    this.yPos += 8;
  }

  private addWrappedText(text: string, fontSize: number): void {
    this.doc.setFontSize(fontSize);
    const lines = this.doc.splitTextToSize(text.trim(), this.rightMargin - this.leftMargin);
    
    lines.forEach((line: string) => {
      this.checkPageBreak(6);
      this.doc.text(line, this.leftMargin, this.yPos);
      this.yPos += fontSize * 0.4;
    });
  }

  private checkPageBreak(neededSpace: number): void {
    if (this.yPos + neededSpace > this.pageHeight) {
      this.doc.addPage();
      this.yPos = 20;
    }
  }

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
}

export const keloidPdfService = new KeloidPdfService();
