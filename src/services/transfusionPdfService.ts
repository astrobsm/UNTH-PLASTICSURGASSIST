/**
 * Transfusion PDF Service
 * Generates downloadable PDFs for transfusion orders and monitoring charts
 */

import { format } from 'date-fns';
import { BloodTransfusion, BloodBagDetails, TransfusionVitals } from './bloodTransfusionService';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  addFooter
} from '../utils/pdfUtils';

export interface PatientBloodDetails {
  blood_group: string;
  genotype?: string;
  rh_factor?: string;
  antibody_screen?: string;
  crossmatch_result?: string;
  previous_transfusion_history?: string;
}

export interface TransfusionMonitoringEntry {
  time: string;
  volume_infused_ml: number;
  temperature: number;
  pulse: number;
  bp_systolic: number;
  bp_diastolic: number;
  respiratory_rate: number;
  spo2: number;
  urine_output_ml?: number;
  observations: string;
  initials: string;
}

export interface TransfusionOrderData {
  transfusion: BloodTransfusion;
  patientDetails: {
    name: string;
    age?: number;
    gender?: string;
    ward?: string;
    bed_number?: string;
    diagnosis?: string;
  };
  patientBloodDetails: PatientBloodDetails;
  productDetails: {
    component_type: string;
    volume_ml: number;
    special_requirements?: string[];
  };
  transfusionRate: {
    initial_rate_ml_per_hour: number;
    maintenance_rate_ml_per_hour: number;
    max_duration_hours: number;
  };
  productSource: {
    source: string;
    source_name?: string;
    collection_date?: Date;
    processing_date?: Date;
  };
  screeningTests: {
    hiv: 'negative' | 'positive' | 'pending';
    hbsag: 'negative' | 'positive' | 'pending';
    hcv: 'negative' | 'positive' | 'pending';
    vdrl: 'negative' | 'positive' | 'pending';
    malaria?: 'negative' | 'positive' | 'pending';
  };
  reactionProtocol: string[];
  orderingPhysician: string;
  orderDate: Date;
}

class TransfusionPdfService {
  // Helper to sanitize text for proper rendering
  private clean(text: string | undefined | null): string {
    return sanitizeTextForPDF(text || '');
  }

  /**
   * Generate Transfusion Order PDF
   */
  generateTransfusionOrderPDF(data: TransfusionOrderData): void {
    const pdf = createPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = PDF_MARGINS.top;

    // Header
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    pdf.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL - PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.setFontSize(16);
    pdf.setFont('times', 'bold');
    pdf.text('BLOOD TRANSFUSION ORDER FORM', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    pdf.setFontSize(9);
    pdf.setFont('times', 'normal');
    pdf.text(`Date: ${format(data.orderDate, 'dd/MM/yyyy HH:mm')}`, pageWidth - 15, yPos, { align: 'right' });
    yPos += 10;

    // Draw header line
    pdf.setDrawColor(200, 0, 0);
    pdf.setLineWidth(1);
    pdf.line(15, yPos, pageWidth - 15, yPos);
    yPos += 8;

    // Section 1: Patient Information
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 1: PATIENT INFORMATION', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const col1X = 15;
    const col2X = pageWidth / 2;
    
    pdf.text(`Patient Name: ${data.patientDetails.name}`, col1X, yPos);
    pdf.text(`Hospital No: ${data.transfusion.hospital_number}`, col2X, yPos);
    yPos += 6;
    
    pdf.text(`Age: ${data.patientDetails.age || 'N/A'} years`, col1X, yPos);
    pdf.text(`Gender: ${data.patientDetails.gender || 'N/A'}`, col2X, yPos);
    yPos += 6;
    
    pdf.text(`Ward: ${data.patientDetails.ward || 'N/A'}`, col1X, yPos);
    pdf.text(`Bed No: ${data.patientDetails.bed_number || 'N/A'}`, col2X, yPos);
    yPos += 6;
    
    pdf.text(`Diagnosis: ${data.patientDetails.diagnosis || data.transfusion.clinical_status}`, col1X, yPos);
    yPos += 10;

    // Section 2: Patient Blood Details
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 2: PATIENT BLOOD DETAILS', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    pdf.text(`Blood Group: ${data.patientBloodDetails.blood_group}`, col1X, yPos);
    pdf.text(`Rh Factor: ${data.patientBloodDetails.rh_factor || 'N/A'}`, col2X, yPos);
    yPos += 6;
    
    pdf.text(`Genotype: ${data.patientBloodDetails.genotype || 'N/A'}`, col1X, yPos);
    pdf.text(`Antibody Screen: ${data.patientBloodDetails.antibody_screen || 'Not done'}`, col2X, yPos);
    yPos += 6;
    
    pdf.text(`Crossmatch Result: ${data.patientBloodDetails.crossmatch_result || 'Compatible'}`, col1X, yPos);
    yPos += 6;
    
    if (data.patientBloodDetails.previous_transfusion_history) {
      const histLines = pdf.splitTextToSize(`Previous Transfusion History: ${data.patientBloodDetails.previous_transfusion_history}`, pageWidth - 30);
      pdf.text(histLines, col1X, yPos);
      yPos += histLines.length * 5;
    }
    yPos += 5;

    // Section 3: Indication for Transfusion
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 3: INDICATION FOR TRANSFUSION', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const indicationLines = pdf.splitTextToSize(`Indication: ${data.transfusion.indication}`, pageWidth - 30);
    pdf.text(indicationLines, col1X, yPos);
    yPos += indicationLines.length * 5 + 3;
    
    pdf.text(`Baseline Hb: ${data.transfusion.baseline_hb} g/dL`, col1X, yPos);
    pdf.text(`Target Hb: ${data.transfusion.target_hb || 'N/A'} g/dL`, col2X, yPos);
    yPos += 6;
    
    pdf.text(`Urgent: ${data.transfusion.urgent ? 'YES' : 'No'}`, col1X, yPos);
    yPos += 10;

    // Section 4: Blood Product Details
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 4: BLOOD PRODUCT DETAILS', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const componentNames: Record<string, string> = {
      'whole_blood': 'Whole Blood',
      'packed_rbc': 'Packed Red Blood Cells',
      'platelets': 'Platelet Concentrate',
      'ffp': 'Fresh Frozen Plasma',
      'cryoprecipitate': 'Cryoprecipitate'
    };
    
    pdf.text(`Product Type: ${componentNames[data.productDetails.component_type] || data.productDetails.component_type}`, col1X, yPos);
    yPos += 6;
    
    pdf.text(`Volume: ${data.productDetails.volume_ml} mL`, col1X, yPos);
    pdf.text(`Units Ordered: ${data.transfusion.total_units}`, col2X, yPos);
    yPos += 6;

    if (data.productDetails.special_requirements && data.productDetails.special_requirements.length > 0) {
      pdf.text(`Special Requirements: ${data.productDetails.special_requirements.join(', ')}`, col1X, yPos);
      yPos += 6;
    }

    // Blood Bag Details Table
    if (data.transfusion.blood_bags && data.transfusion.blood_bags.length > 0) {
      yPos += 5;
      pdf.setFont('times', 'bold');
      pdf.text('Blood Bag Information:', col1X, yPos);
      yPos += 6;
      
      // Table header
      pdf.setFillColor(245, 245, 245);
      pdf.rect(15, yPos - 3, pageWidth - 30, 7, 'F');
      pdf.setFontSize(8);
      pdf.text('Bag Number', 17, yPos + 2);
      pdf.text('Blood Group', 55, yPos + 2);
      pdf.text('Volume', 85, yPos + 2);
      pdf.text('Expiry Date', 110, yPos + 2);
      pdf.text('Source', 145, yPos + 2);
      yPos += 8;

      pdf.setFont('times', 'normal');
      data.transfusion.blood_bags.forEach((bag: BloodBagDetails) => {
        pdf.text(bag.bag_number, 17, yPos);
        pdf.text(bag.blood_group, 55, yPos);
        pdf.text(`${bag.volume_ml} mL`, 85, yPos);
        pdf.text(format(new Date(bag.expiry_date), 'dd/MM/yyyy'), 110, yPos);
        pdf.text(bag.source.replace('_', ' '), 145, yPos);
        yPos += 5;
      });
    }
    yPos += 5;

    // Check for new page
    if (yPos > pageHeight - 80) {
      pdf.addPage();
      yPos = 20;
    }

    // Section 5: Product Source & Screening
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 5: PRODUCT SOURCE & SCREENING TESTS', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const sourceNames: Record<string, string> = {
      'blood_bank': 'Hospital Blood Bank',
      'nbtc': 'National Blood Transfusion Centre',
      'donor_directed': 'Directed Donor',
      'other': 'Other'
    };
    
    pdf.text(`Source: ${sourceNames[data.productSource.source] || data.productSource.source}`, col1X, yPos);
    if (data.productSource.source_name) {
      pdf.text(`Name: ${data.productSource.source_name}`, col2X, yPos);
    }
    yPos += 8;

    // Screening Tests Table
    pdf.setFont('times', 'bold');
    pdf.text('Screening Test Results:', col1X, yPos);
    yPos += 6;

    pdf.setFontSize(9);
    pdf.setFont('times', 'normal');
    
    const getStatusColor = (status: string) => {
      if (status === 'negative') return [0, 128, 0];
      if (status === 'positive') return [255, 0, 0];
      return [128, 128, 128];
    };

    const tests = [
      { name: 'HIV 1&2', result: data.screeningTests.hiv },
      { name: 'HBsAg (Hepatitis B)', result: data.screeningTests.hbsag },
      { name: 'HCV (Hepatitis C)', result: data.screeningTests.hcv },
      { name: 'VDRL (Syphilis)', result: data.screeningTests.vdrl },
    ];
    
    if (data.screeningTests.malaria) {
      tests.push({ name: 'Malaria Parasite', result: data.screeningTests.malaria });
    }

    tests.forEach((test, idx) => {
      const xPos = idx % 2 === 0 ? col1X : col2X;
      if (idx % 2 === 0 && idx > 0) yPos += 6;
      
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${test.name}: `, xPos, yPos);
      
      const color = getStatusColor(test.result);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(test.result.toUpperCase(), xPos + 50, yPos);
    });
    
    pdf.setTextColor(0, 0, 0);
    yPos += 10;

    // Section 6: Transfusion Rate
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 6: TRANSFUSION RATE', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    pdf.text(`Initial Rate (first 15 min): ${data.transfusionRate.initial_rate_ml_per_hour} mL/hour`, col1X, yPos);
    yPos += 6;
    pdf.text(`Maintenance Rate: ${data.transfusionRate.maintenance_rate_ml_per_hour} mL/hour`, col1X, yPos);
    yPos += 6;
    pdf.text(`Maximum Duration: ${data.transfusionRate.max_duration_hours} hours`, col1X, yPos);
    yPos += 10;

    // Check for new page
    if (yPos > pageHeight - 100) {
      pdf.addPage();
      yPos = 20;
    }

    // Section 7: Transfusion Reaction Protocol
    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('SECTION 7: TRANSFUSION REACTION PROTOCOL', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setFont('times', 'normal');
    
    const defaultReactionProtocol = [
      '1. STOP the transfusion immediately',
      '2. Keep IV line open with normal saline',
      '3. Call the doctor immediately',
      '4. Check and record vital signs (BP, pulse, temperature, SpO2)',
      '5. Recheck patient identity and blood bag details',
      '6. Send blood bag, tubing, and fresh patient samples to blood bank',
      '7. Collect blood and urine samples for investigation',
      '8. Document all observations and actions taken',
      '9. Administer emergency medications as ordered',
      '10. Complete transfusion reaction report form'
    ];

    const protocol = data.reactionProtocol.length > 0 ? data.reactionProtocol : defaultReactionProtocol;
    
    protocol.forEach(step => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = 20;
      }
      pdf.text(step, col1X, yPos);
      yPos += 5;
    });
    yPos += 10;

    // Pre-transfusion checklist
    if (yPos > pageHeight - 60) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setFontSize(12);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(139, 0, 0);
    pdf.text('PRE-TRANSFUSION CHECKLIST', 15, yPos);
    pdf.setTextColor(0, 0, 0);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const checklist = [
      { item: 'Informed consent obtained', checked: data.transfusion.consent_obtained },
      { item: 'Patient identification verified (2 identifiers)', checked: data.transfusion.patient_identification_verified },
      { item: 'Blood group verified', checked: data.transfusion.blood_group_verified },
      { item: 'Crossmatch compatibility confirmed', checked: data.transfusion.crossmatch_checked },
    ];

    checklist.forEach(item => {
      const symbol = item.checked ? '[X]' : '[ ]';
      pdf.text(`${symbol} ${item.item}`, col1X, yPos);
      yPos += 6;
    });
    yPos += 10;

    // Signatures
    if (yPos > pageHeight - 40) {
      pdf.addPage();
      yPos = 20;
    }

    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);

    pdf.text('Ordered By:', col1X, yPos);
    pdf.line(col1X + 25, yPos, col1X + 80, yPos);
    pdf.text('Date/Time:', col2X, yPos);
    pdf.line(col2X + 22, yPos, col2X + 77, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.text(`Dr. ${data.orderingPhysician}`, col1X + 25, yPos);
    pdf.text(format(data.orderDate, 'dd/MM/yyyy HH:mm'), col2X + 22, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.text('Verified By (Blood Bank):', col1X, yPos);
    pdf.line(col1X + 50, yPos, col1X + 120, yPos);
    yPos += 8;

    pdf.text('Administered By:', col1X, yPos);
    pdf.line(col1X + 40, yPos, col1X + 100, yPos);
    pdf.text('Time Started:', col2X, yPos);
    pdf.line(col2X + 28, yPos, col2X + 70, yPos);

    // Add professional footer with page numbers and timestamp
    addFooter(pdf);

    // Save the PDF
    const fileName = `Transfusion_Order_${data.transfusion.hospital_number}_${format(data.orderDate, 'yyyyMMdd')}.pdf`;
    pdf.save(fileName);
  }

  /**
   * Generate Transfusion Monitoring Chart PDF
   */
  generateMonitoringChartPDF(
    transfusion: BloodTransfusion,
    patientName: string,
    monitoringEntries: TransfusionMonitoringEntry[] = [],
    generateBlank: boolean = false
  ): void {
    const pdf = createPDF('landscape');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = PDF_MARGINS.top;

    // Header
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    pdf.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL - PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;
    pdf.setFontSize(14);
    pdf.setFont('times', 'bold');
    pdf.text('BLOOD TRANSFUSION MONITORING CHART', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Patient Info Row
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const infoY = yPos;
    pdf.text(`Patient Name: ${patientName}`, 15, infoY);
    pdf.text(`Hospital No: ${transfusion.hospital_number}`, 100, infoY);
    pdf.text(`Date: ${format(new Date(transfusion.transfusion_date), 'dd/MM/yyyy')}`, 180, infoY);
    pdf.text(`Blood Group: ___________`, 240, infoY);
    yPos += 7;

    pdf.text(`Blood Bag No: ${transfusion.blood_bags?.[0]?.bag_number || '___________'}`, 15, yPos);
    pdf.text(`Component: ${transfusion.blood_bags?.[0]?.component_type?.replace('_', ' ') || '___________'}`, 100, yPos);
    pdf.text(`Volume: ${transfusion.blood_bags?.[0]?.volume_ml || '____'} mL`, 180, yPos);
    pdf.text(`Start Time: ${transfusion.start_time || '______'}`, 240, yPos);
    yPos += 12;

    // Monitoring Table
    const tableStartY = yPos;
    const colWidths = [25, 30, 22, 22, 35, 22, 22, 25, 50, 25];
    const headers = ['Time', 'Vol Infused', 'Temp', 'Pulse', 'Blood Pressure', 'RR', 'SpO2', 'Urine', 'Observations', 'Initials'];
    
    // Draw table header
    pdf.setFillColor(200, 0, 0);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(15, tableStartY, pageWidth - 30, 10, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont('times', 'bold');
    
    let xPos = 17;
    headers.forEach((header, idx) => {
      pdf.text(header, xPos, tableStartY + 7);
      xPos += colWidths[idx];
    });

    pdf.setTextColor(0, 0, 0);
    yPos = tableStartY + 12;

    // Default monitoring intervals
    const timeIntervals = generateBlank ? [
      'Pre-Transfusion',
      '0 min (Start)',
      '15 min',
      '30 min',
      '45 min',
      '1 hour',
      '1.5 hours',
      '2 hours',
      '2.5 hours',
      '3 hours',
      '3.5 hours',
      '4 hours',
      'Post-Transfusion',
    ] : monitoringEntries.map(e => e.time);

    pdf.setFont('times', 'normal');
    
    const drawRow = (time: string, entry?: TransfusionMonitoringEntry) => {
      if (yPos > pageHeight - 20) {
        pdf.addPage('landscape');
        yPos = 20;
      }

      // Alternate row colors
      const rowIndex = timeIntervals.indexOf(time);
      if (rowIndex % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(15, yPos - 3, pageWidth - 30, 8, 'F');
      }

      xPos = 17;
      
      pdf.text(time, xPos, yPos + 2);
      xPos += colWidths[0];
      
      if (entry) {
        pdf.text(entry.volume_infused_ml ? `${entry.volume_infused_ml} mL` : '', xPos, yPos + 2);
        xPos += colWidths[1];
        pdf.text(entry.temperature ? `${entry.temperature}°C` : '', xPos, yPos + 2);
        xPos += colWidths[2];
        pdf.text(entry.pulse ? `${entry.pulse}` : '', xPos, yPos + 2);
        xPos += colWidths[3];
        pdf.text(entry.bp_systolic ? `${entry.bp_systolic}/${entry.bp_diastolic}` : '', xPos, yPos + 2);
        xPos += colWidths[4];
        pdf.text(entry.respiratory_rate ? `${entry.respiratory_rate}` : '', xPos, yPos + 2);
        xPos += colWidths[5];
        pdf.text(entry.spo2 ? `${entry.spo2}%` : '', xPos, yPos + 2);
        xPos += colWidths[6];
        pdf.text(entry.urine_output_ml ? `${entry.urine_output_ml}` : '', xPos, yPos + 2);
        xPos += colWidths[7];
        const obsText = pdf.splitTextToSize(entry.observations || '', colWidths[8] - 2);
        pdf.text(obsText[0] || '', xPos, yPos + 2);
        xPos += colWidths[8];
        pdf.text(entry.initials || '', xPos, yPos + 2);
      }

      // Draw cell borders
      pdf.setDrawColor(200, 200, 200);
      let cellX = 15;
      colWidths.forEach(width => {
        pdf.rect(cellX, yPos - 3, width, 8);
        cellX += width;
      });

      yPos += 8;
    };

    if (generateBlank) {
      timeIntervals.forEach(time => drawRow(time));
    } else {
      monitoringEntries.forEach(entry => drawRow(entry.time, entry));
      // Add some blank rows for additional entries
      for (let i = 0; i < 5; i++) {
        drawRow('');
      }
    }

    yPos += 5;

    // Adverse Events Section
    if (yPos > pageHeight - 50) {
      pdf.addPage('landscape');
      yPos = 20;
    }

    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.text('ADVERSE EVENTS / TRANSFUSION REACTIONS:', 15, yPos);
    yPos += 7;

    pdf.setFont('times', 'normal');
    pdf.setFontSize(9);
    pdf.text('[ ] None observed', 15, yPos);
    pdf.text('[ ] Fever/Chills', 62, yPos);
    pdf.text('[ ] Rash/Urticaria', 110, yPos);
    pdf.text('[ ] Dyspnea', 160, yPos);
    pdf.text('[ ] Hypotension', 200, yPos);
    pdf.text('[ ] Other: _________________', 245, yPos);
    yPos += 10;

    // Action Taken
    pdf.text('Action Taken: ____________________________________________________________________________', 15, yPos);
    yPos += 10;

    // Completion Section
    pdf.setFont('times', 'bold');
    pdf.text('TRANSFUSION COMPLETION', 15, yPos);
    yPos += 7;

    pdf.setFont('times', 'normal');
    pdf.text('End Time: ____________', 15, yPos);
    pdf.text('Total Volume Infused: ____________ mL', 80, yPos);
    pdf.text('Total Duration: ____________ hours', 180, yPos);
    yPos += 8;

    pdf.text('Post-Transfusion Hb (if done): ____________ g/dL', 15, yPos);
    yPos += 8;
    pdf.text('Transfusion Outcome: [ ] Successful   [ ] Incomplete   [ ] Reaction occurred', 15, yPos);
    yPos += 12;

    // Signatures
    pdf.text('Administered By: _________________________', 15, yPos);
    pdf.text('Signature: _________________', 120, yPos);
    pdf.text('Date/Time: _________________', 200, yPos);
    yPos += 8;

    pdf.text('Supervised By: _________________________', 15, yPos);
    pdf.text('Signature: _________________', 120, yPos);
    pdf.text('Date/Time: _________________', 200, yPos);

    // Add professional footer with page numbers and timestamp
    addFooter(pdf);

    // Save
    const fileName = `Transfusion_Chart_${transfusion.hospital_number}_${format(new Date(transfusion.transfusion_date), 'yyyyMMdd')}.pdf`;
    pdf.save(fileName);
  }

  /**
   * Generate a blank monitoring chart template
   */
  generateBlankMonitoringChart(): void {
    const pdf = createPDF('landscape');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = PDF_MARGINS.top;

    // Header
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    pdf.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL - PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;
    pdf.setFontSize(14);
    pdf.setFont('times', 'bold');
    pdf.text('BLOOD TRANSFUSION MONITORING CHART', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Patient Info Fields (blank)
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    pdf.text('Patient Name: _________________________________', 15, yPos);
    pdf.text('Hospital No: _________________', 130, yPos);
    pdf.text('Date: ______________', 220, yPos);
    yPos += 7;

    pdf.text('Blood Group: __________', 15, yPos);
    pdf.text('Blood Bag No: _________________', 80, yPos);
    pdf.text('Component: ________________', 160, yPos);
    pdf.text('Volume: _______ mL', 240, yPos);
    yPos += 7;

    pdf.text('Indication: ___________________________________________________________________________', 15, yPos);
    yPos += 12;

    // Monitoring Table
    const tableStartY = yPos;
    const colWidths = [25, 28, 22, 22, 35, 22, 22, 25, 52, 25];
    const headers = ['Time', 'Vol Infused', 'Temp (°C)', 'Pulse', 'BP (mmHg)', 'RR', 'SpO2 %', 'Urine mL', 'Observations', 'Initials'];
    
    // Draw table header
    pdf.setFillColor(139, 0, 0);
    pdf.setTextColor(255, 255, 255);
    pdf.rect(15, tableStartY, pageWidth - 30, 10, 'F');
    
    pdf.setFontSize(8);
    pdf.setFont('times', 'bold');
    
    let xPos = 17;
    headers.forEach((header, idx) => {
      pdf.text(header, xPos, tableStartY + 7);
      xPos += colWidths[idx];
    });

    pdf.setTextColor(0, 0, 0);
    yPos = tableStartY + 10;

    // Time intervals
    const intervals = [
      'Pre-transfusion',
      'Start (0 min)',
      '15 min',
      '30 min',
      '45 min',
      '1 hour',
      '1.5 hours',
      '2 hours',
      '2.5 hours',
      '3 hours',
      '3.5 hours',
      '4 hours',
      'Post-transfusion',
    ];

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);

    intervals.forEach((time, idx) => {
      // Alternate row colors
      if (idx % 2 === 0) {
        pdf.setFillColor(252, 252, 252);
        pdf.rect(15, yPos, pageWidth - 30, 8, 'F');
      }

      // Draw cells
      pdf.setDrawColor(180, 180, 180);
      let cellX = 15;
      colWidths.forEach((width, colIdx) => {
        pdf.rect(cellX, yPos, width, 8);
        if (colIdx === 0) {
          pdf.text(time, cellX + 1, yPos + 5);
        }
        cellX += width;
      });

      yPos += 8;
    });

    yPos += 8;

    // Reactions section
    pdf.setFontSize(9);
    pdf.setFont('times', 'bold');
    pdf.text('TRANSFUSION REACTIONS (check if observed):', 15, yPos);
    yPos += 6;

    pdf.setFont('times', 'normal');
    const reactions = ['None', 'Fever', 'Chills', 'Rash', 'Urticaria', 'Dyspnea', 'Chest pain', 'Back pain', 'Hypotension', 'Tachycardia'];
    xPos = 15;
    reactions.forEach((reaction, idx) => {
      if (xPos > pageWidth - 40) {
        xPos = 15;
        yPos += 6;
      }
      pdf.text(`[ ] ${reaction}`, xPos, yPos);
      xPos += 38;
    });
    yPos += 10;

    pdf.text('If reaction occurred - Action taken: _________________________________________________________________', 15, yPos);
    yPos += 10;

    // Completion
    pdf.setFont('times', 'bold');
    pdf.text('COMPLETION:', 15, yPos);
    pdf.setFont('times', 'normal');
    pdf.text('End Time: ________', 55, yPos);
    pdf.text('Total Volume: ________ mL', 105, yPos);
    pdf.text('Duration: ________ hrs', 175, yPos);
    pdf.text('Outcome: [ ] Complete  [ ] Incomplete', 230, yPos);
    yPos += 10;

    // Signatures
    pdf.text('Nurse Signature: ___________________', 15, yPos);
    pdf.text('Doctor Signature: ___________________', 115, yPos);
    pdf.text('Date: ______________', 215, yPos);

    // Add professional footer with page numbers and timestamp
    addFooter(pdf);

    // Save
    pdf.save(`Blank_Transfusion_Monitoring_Chart_${format(new Date(), 'yyyyMMdd')}.pdf`);
  }

  /**
   * Generate Blood Transfusion Consent Form PDF
   */
  generateConsentFormPDF(patientData?: {
    name?: string;
    hospital_number?: string;
    age?: number;
    gender?: string;
    ward?: string;
    diagnosis?: string;
    blood_group?: string;
    units_requested?: number;
    component_type?: string;
    indication?: string;
    physician_name?: string;
  }): void {
    const pdf = createPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = PDF_MARGINS.top;

    // Header
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    pdf.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.text('ITUKU OZALLA, ENUGU', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    pdf.setFontSize(14);
    pdf.setFont('times', 'bold');
    pdf.text('CONSENT FOR BLOOD TRANSFUSION', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    // Draw header line
    pdf.setDrawColor(139, 0, 0);
    pdf.setLineWidth(1);
    pdf.line(15, yPos, pageWidth - 15, yPos);
    yPos += 10;

    // Patient Information Section
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('PATIENT INFORMATION', 15, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const col1X = 15;
    const col2X = pageWidth / 2 + 10;
    const lineLength = 60;
    
    pdf.text('Patient Name:', col1X, yPos);
    pdf.line(col1X + 28, yPos, col1X + 28 + lineLength, yPos);
    if (patientData?.name) pdf.text(patientData.name, col1X + 30, yPos - 1);
    
    pdf.text('Hospital No:', col2X, yPos);
    pdf.line(col2X + 25, yPos, col2X + 25 + 50, yPos);
    if (patientData?.hospital_number) pdf.text(patientData.hospital_number, col2X + 27, yPos - 1);
    yPos += 8;

    pdf.text('Age:', col1X, yPos);
    pdf.line(col1X + 12, yPos, col1X + 12 + 30, yPos);
    if (patientData?.age) pdf.text(String(patientData.age) + ' years', col1X + 14, yPos - 1);
    
    pdf.text('Gender:', col1X + 55, yPos);
    pdf.line(col1X + 72, yPos, col1X + 72 + 30, yPos);
    if (patientData?.gender) pdf.text(patientData.gender, col1X + 74, yPos - 1);
    
    pdf.text('Ward:', col2X, yPos);
    pdf.line(col2X + 14, yPos, col2X + 14 + 60, yPos);
    if (patientData?.ward) pdf.text(patientData.ward, col2X + 16, yPos - 1);
    yPos += 8;

    pdf.text('Diagnosis:', col1X, yPos);
    pdf.line(col1X + 22, yPos, pageWidth - 15, yPos);
    if (patientData?.diagnosis) pdf.text(patientData.diagnosis, col1X + 24, yPos - 1);
    yPos += 8;

    pdf.text('Blood Group:', col1X, yPos);
    pdf.line(col1X + 28, yPos, col1X + 28 + 40, yPos);
    if (patientData?.blood_group) pdf.text(patientData.blood_group, col1X + 30, yPos - 1);
    
    pdf.text('Units Requested:', col1X + 80, yPos);
    pdf.line(col1X + 115, yPos, col1X + 115 + 25, yPos);
    if (patientData?.units_requested) pdf.text(String(patientData.units_requested), col1X + 117, yPos - 1);
    yPos += 12;

    // Transfusion Details
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('TRANSFUSION DETAILS', 15, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    pdf.text('Blood Component Type:', col1X, yPos);
    pdf.line(col1X + 48, yPos, pageWidth - 15, yPos);
    if (patientData?.component_type) pdf.text(patientData.component_type, col1X + 50, yPos - 1);
    yPos += 8;

    pdf.text('Indication for Transfusion:', col1X, yPos);
    pdf.line(col1X + 53, yPos, pageWidth - 15, yPos);
    if (patientData?.indication) pdf.text(patientData.indication, col1X + 55, yPos - 1);
    yPos += 12;

    // Consent Statement
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('CONSENT STATEMENT', 15, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const consentText = [
      'I, the undersigned, hereby confirm that:',
      '',
      '1. I have been informed about the need for blood transfusion and the reasons for it.',
      '',
      '2. The nature, benefits, and risks of blood transfusion have been explained to me in a',
      '   language I understand.',
      '',
      '3. I understand that blood transfusion, while generally safe, carries certain risks including',
      '   but not limited to:',
      '   - Allergic reactions (rash, itching, fever)',
      '   - Transfusion reactions (fever, chills, difficulty breathing)',
      '   - Transmission of infections (rare due to screening)',
      '   - Fluid overload',
      '   - Other complications',
      '',
      '4. I have been given the opportunity to ask questions, and all my questions have been',
      '   answered satisfactorily.',
      '',
      '5. I understand that I have the right to refuse this transfusion, and the consequences of',
      '   refusal have been explained to me.',
      '',
      '6. I voluntarily consent to receive blood transfusion(s) as deemed necessary by my',
      '   treating physician(s).',
    ];

    consentText.forEach(line => {
      pdf.text(line, col1X, yPos);
      yPos += 5;
    });
    yPos += 5;

    // Signatures Section
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('SIGNATURES', 15, yPos);
    yPos += 10;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');

    // Patient/Guardian Signature
    pdf.text('Patient/Guardian Signature:', col1X, yPos);
    pdf.line(col1X + 55, yPos, col1X + 55 + 70, yPos);
    yPos += 8;

    pdf.text('Name (Print):', col1X, yPos);
    pdf.line(col1X + 28, yPos, col1X + 28 + 70, yPos);
    
    pdf.text('Date:', col2X, yPos);
    pdf.line(col2X + 14, yPos, col2X + 14 + 50, yPos);
    yPos += 8;

    pdf.text('Relationship to Patient (if not patient):', col1X, yPos);
    pdf.line(col1X + 77, yPos, pageWidth - 15, yPos);
    yPos += 12;

    // Witness Signature
    pdf.text('Witness Signature:', col1X, yPos);
    pdf.line(col1X + 40, yPos, col1X + 40 + 70, yPos);
    yPos += 8;

    pdf.text('Name (Print):', col1X, yPos);
    pdf.line(col1X + 28, yPos, col1X + 28 + 70, yPos);
    
    pdf.text('Date:', col2X, yPos);
    pdf.line(col2X + 14, yPos, col2X + 14 + 50, yPos);
    yPos += 12;

    // Physician Signature
    pdf.text('Explaining Physician:', col1X, yPos);
    pdf.line(col1X + 45, yPos, col1X + 45 + 70, yPos);
    if (patientData?.physician_name) pdf.text('Dr. ' + patientData.physician_name, col1X + 47, yPos - 1);
    yPos += 8;

    pdf.text('Signature:', col1X, yPos);
    pdf.line(col1X + 22, yPos, col1X + 22 + 70, yPos);
    
    pdf.text('Date/Time:', col2X, yPos);
    pdf.line(col2X + 24, yPos, col2X + 24 + 50, yPos);
    yPos += 15;

    // Refusal Section (if applicable)
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('REFUSAL OF CONSENT (Complete only if patient refuses)', 15, yPos);
    yPos += 8;

    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    
    const refusalText = 'I have been informed of the need for blood transfusion and the risks of refusing. ' +
      'I understand that refusing this transfusion may result in serious harm or death. ' +
      'Despite this, I choose to refuse blood transfusion.';
    
    const refusalLines = pdf.splitTextToSize(refusalText, pageWidth - 30);
    pdf.text(refusalLines, col1X, yPos);
    yPos += refusalLines.length * 5 + 5;

    pdf.text('Patient/Guardian Signature:', col1X, yPos);
    pdf.line(col1X + 55, yPos, col1X + 55 + 60, yPos);
    pdf.text('Date:', col2X, yPos);
    pdf.line(col2X + 14, yPos, col2X + 14 + 50, yPos);

    // Add professional footer with page numbers and timestamp
    addFooter(pdf);

    // Save
    const fileName = patientData?.hospital_number 
      ? `Blood_Transfusion_Consent_${patientData.hospital_number}_${format(new Date(), 'yyyyMMdd')}.pdf`
      : `Blood_Transfusion_Consent_Blank_${format(new Date(), 'yyyyMMdd')}.pdf`;
    pdf.save(fileName);
  }
}

export const transfusionPdfService = new TransfusionPdfService();
export default transfusionPdfService;
