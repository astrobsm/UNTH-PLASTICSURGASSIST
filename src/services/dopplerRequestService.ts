/**
 * Doppler Ultrasound Request Service
 * 
 * Generates PDF request forms for Doppler Ultrasound studies
 * specifically designed for vascular assessment in limb salvage decisions.
 */

import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { 
  createPDF, 
  
  addFooter, 
  PDF_MARGINS, 
  
  PDF_COLORS 
} from '../utils/pdfUtils';

export interface DopplerRequestData {
  // Patient Information
  patientName: string;
  hospitalNumber: string;
  dateOfBirth: string;
  gender: 'male' | 'female';
  ward: string;
  bedNumber?: string;
  
  // Requesting Physician
  requestingPhysician: string;
  designation: string;
  contactNumber?: string;
  
  // Clinical Information
  clinicalDiagnosis: string;
  reasonForRequest: string;
  relevantHistory: string;
  
  // Specific Examination Requested
  examinationType: 'arterial' | 'venous' | 'both';
  
  // Arterial Assessment Parameters
  arterialAssessment?: {
    abiRequired: boolean;
    toePressureRequired: boolean;
    waveformAnalysisRequired: boolean;
    segmentalPressures: boolean;
    pulseVolumeRecording: boolean;
    specificVessels: {
      commonFemoralArtery: boolean;
      superficialFemoralArtery: boolean;
      profundaFemoralArtery: boolean;
      poplitealArtery: boolean;
      anteriorTibialArtery: boolean;
      posteriorTibialArtery: boolean;
      peronealArtery: boolean;
      dorsalisPedisArtery: boolean;
    };
  };
  
  // Venous Assessment Parameters
  venousAssessment?: {
    dvtScreening: boolean;
    chronicVenousInsufficiency: boolean;
    varicoseVeinMapping: boolean;
    perforatorIncompetence: boolean;
    specificVeins: {
      commonFemoralVein: boolean;
      greatSaphenousVein: boolean;
      smallSaphenousVein: boolean;
      poplitealVein: boolean;
      tibialVeins: boolean;
      perforators: boolean;
    };
  };
  
  // Urgency
  urgency: 'routine' | 'urgent' | 'emergency';
  
  // Additional Notes
  additionalNotes?: string;
  
  // Request Date
  requestDate: Date;
}

export const dopplerRequestService = {
  /**
   * Generate a comprehensive Doppler Ultrasound Request PDF
   */
  generateDopplerRequestPDF(data: DopplerRequestData): any {
    const pdf = createPDF('portrait');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    let yPos = PDF_MARGINS.top;
    
    // Header
    pdf.setFontSize(11);
    pdf.setFont('times', 'bold');
    pdf.text('UNIVERSITY OF NIGERIA TEACHING HOSPITAL', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.setFontSize(10);
    pdf.setFont('times', 'normal');
    pdf.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    pdf.text('Enugu, Nigeria', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    // Title
    pdf.setFontSize(14);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    pdf.text('DOPPLER ULTRASOUND REQUEST FORM', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    pdf.setFontSize(10);
    pdf.setFont('times', 'italic');
    pdf.setTextColor(100, 100, 100);
    pdf.text('(Vascular Assessment for Limb Salvage Evaluation)', pageWidth / 2, yPos, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPos += 8;
    
    // Urgency Badge
    const urgencyColors: Record<string, { bg: number[]; text: number[] }> = {
      routine: { bg: [200, 230, 200], text: [0, 100, 0] },
      urgent: { bg: [255, 220, 150], text: [150, 80, 0] },
      emergency: { bg: [255, 180, 180], text: [180, 0, 0] }
    };
    const urgency = urgencyColors[data.urgency];
    pdf.setFillColor(urgency.bg[0], urgency.bg[1], urgency.bg[2]);
    pdf.roundedRect(pageWidth - 55, yPos - 5, 40, 8, 2, 2, 'F');
    pdf.setFontSize(9);
    pdf.setFont('times', 'bold');
    pdf.setTextColor(urgency.text[0], urgency.text[1], urgency.text[2]);
    pdf.text(data.urgency.toUpperCase(), pageWidth - 35, yPos, { align: 'center' });
    pdf.setTextColor(0, 0, 0);
    yPos += 6;
    
    // Draw line
    pdf.setDrawColor(0, 150, 0);
    pdf.setLineWidth(0.5);
    pdf.line(PDF_MARGINS.left, yPos, pageWidth - PDF_MARGINS.right, yPos);
    yPos += 6;
    
    // Request Date
    pdf.setFontSize(9);
    pdf.setFont('times', 'normal');
    pdf.text(`Request Date: ${format(data.requestDate, 'dd/MM/yyyy HH:mm')}`, pageWidth - PDF_MARGINS.right, yPos, { align: 'right' });
    yPos += 6;
    
    // SECTION 1: Patient Information
    yPos = this.addSection(pdf, yPos, 'PATIENT INFORMATION', [
      { label: 'Patient Name', value: data.patientName },
      { label: 'Hospital Number', value: data.hospitalNumber },
      { label: 'Date of Birth', value: data.dateOfBirth },
      { label: 'Gender', value: data.gender.charAt(0).toUpperCase() + data.gender.slice(1) },
      { label: 'Ward', value: data.ward },
      { label: 'Bed Number', value: data.bedNumber || 'N/A' }
    ]);
    
    // SECTION 2: Requesting Physician
    yPos = this.addSection(pdf, yPos, 'REQUESTING PHYSICIAN', [
      { label: 'Name', value: data.requestingPhysician },
      { label: 'Designation', value: data.designation },
      { label: 'Contact', value: data.contactNumber || 'N/A' }
    ]);
    
    // SECTION 3: Clinical Information
    yPos = this.addTextSection(pdf, yPos, 'CLINICAL INFORMATION', [
      { label: 'Clinical Diagnosis', value: data.clinicalDiagnosis },
      { label: 'Reason for Request', value: data.reasonForRequest },
      { label: 'Relevant History', value: data.relevantHistory }
    ]);
    
    // Check if we need a new page
    if (yPos > pageHeight - 100) {
      pdf.addPage();
      yPos = PDF_MARGINS.top;
    }
    
    // SECTION 4: Examination Type
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.setFillColor(240, 240, 240);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
    pdf.text('EXAMINATION REQUESTED', PDF_MARGINS.left + 2, yPos + 2);
    yPos += 10;
    
    pdf.setFontSize(9);
    pdf.setFont('times', 'normal');
    const examTypes = [
      { label: 'Arterial Doppler Study', checked: data.examinationType === 'arterial' || data.examinationType === 'both' },
      { label: 'Venous Doppler Study', checked: data.examinationType === 'venous' || data.examinationType === 'both' },
      { label: 'Combined Arterial & Venous Study', checked: data.examinationType === 'both' }
    ];
    
    examTypes.forEach(exam => {
      pdf.rect(PDF_MARGINS.left + 5, yPos - 3, 4, 4);
      if (exam.checked) {
        pdf.setFillColor(0, 150, 0);
        pdf.rect(PDF_MARGINS.left + 5.5, yPos - 2.5, 3, 3, 'F');
      }
      pdf.text(exam.label, PDF_MARGINS.left + 12, yPos);
      yPos += 6;
    });
    yPos += 3;
    
    // SECTION 5: Arterial Assessment Parameters
    if (data.examinationType === 'arterial' || data.examinationType === 'both') {
      yPos = this.addArterialSection(pdf, yPos, data.arterialAssessment);
    }
    
    // Check page break
    if (yPos > pageHeight - 80) {
      pdf.addPage();
      yPos = PDF_MARGINS.top;
    }
    
    // SECTION 6: Venous Assessment Parameters
    if (data.examinationType === 'venous' || data.examinationType === 'both') {
      yPos = this.addVenousSection(pdf, yPos, data.venousAssessment);
    }
    
    // Additional Notes
    if (data.additionalNotes) {
      yPos += 5;
      pdf.setFontSize(10);
      pdf.setFont('times', 'bold');
      pdf.text('ADDITIONAL NOTES:', PDF_MARGINS.left, yPos);
      yPos += 5;
      pdf.setFontSize(9);
      pdf.setFont('times', 'normal');
      const splitNotes = pdf.splitTextToSize(data.additionalNotes, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
      pdf.text(splitNotes, PDF_MARGINS.left, yPos);
      yPos += splitNotes.length * 4 + 5;
    }
    
    // Check page break for signatures
    if (yPos > pageHeight - 60) {
      pdf.addPage();
      yPos = PDF_MARGINS.top;
    }
    
    // Signature Section
    yPos += 10;
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.3);
    
    // Requesting Doctor Signature
    pdf.line(PDF_MARGINS.left, yPos + 15, PDF_MARGINS.left + 60, yPos + 15);
    pdf.setFontSize(8);
    pdf.text('Requesting Doctor\'s Signature', PDF_MARGINS.left, yPos + 20);
    
    // Date
    pdf.line(PDF_MARGINS.left + 80, yPos + 15, PDF_MARGINS.left + 120, yPos + 15);
    pdf.text('Date', PDF_MARGINS.left + 80, yPos + 20);
    
    // For Radiology Use
    yPos += 30;
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.setFillColor(230, 230, 250);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
    pdf.text('FOR RADIOLOGY DEPARTMENT USE ONLY', PDF_MARGINS.left + 2, yPos + 2);
    yPos += 12;
    
    pdf.setFontSize(9);
    pdf.setFont('times', 'normal');
    pdf.text('Appointment Date: _________________  Time: _____________', PDF_MARGINS.left, yPos);
    yPos += 7;
    pdf.text('Performed By: ___________________________', PDF_MARGINS.left, yPos);
    yPos += 7;
    pdf.text('Report Attached: ☐ Yes  ☐ No', PDF_MARGINS.left, yPos);
    
    // Add footer
    addFooter(pdf, 'Doppler Ultrasound Request - UNTH Plastic Surgery');
    
    return pdf;
  },
  
  addSection(pdf: jsPDF, yPos: number, title: string, fields: { label: string; value: string }[]): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.setFillColor(240, 240, 240);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
    pdf.text(title, PDF_MARGINS.left + 2, yPos + 2);
    yPos += 10;
    
    pdf.setFontSize(9);
    const colWidth = (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right) / 2;
    
    for (let i = 0; i < fields.length; i += 2) {
      pdf.setFont('times', 'bold');
      pdf.text(`${fields[i].label}:`, PDF_MARGINS.left, yPos);
      pdf.setFont('times', 'normal');
      pdf.text(fields[i].value, PDF_MARGINS.left + 35, yPos);
      
      if (fields[i + 1]) {
        pdf.setFont('times', 'bold');
        pdf.text(`${fields[i + 1].label}:`, PDF_MARGINS.left + colWidth, yPos);
        pdf.setFont('times', 'normal');
        pdf.text(fields[i + 1].value, PDF_MARGINS.left + colWidth + 35, yPos);
      }
      yPos += 5;
    }
    
    return yPos + 3;
  },
  
  addTextSection(pdf: jsPDF, yPos: number, title: string, fields: { label: string; value: string }[]): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.setFillColor(240, 240, 240);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
    pdf.text(title, PDF_MARGINS.left + 2, yPos + 2);
    yPos += 10;
    
    pdf.setFontSize(9);
    fields.forEach(field => {
      pdf.setFont('times', 'bold');
      pdf.text(`${field.label}:`, PDF_MARGINS.left, yPos);
      yPos += 4;
      pdf.setFont('times', 'normal');
      const splitText = pdf.splitTextToSize(field.value, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 5);
      pdf.text(splitText, PDF_MARGINS.left + 5, yPos);
      yPos += splitText.length * 4 + 3;
    });
    
    return yPos;
  },
  
  addArterialSection(pdf: jsPDF, yPos: number, arterial?: DopplerRequestData['arterialAssessment']): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.setFillColor(255, 240, 240);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
    pdf.setTextColor(180, 0, 0);
    pdf.text('ARTERIAL DOPPLER PARAMETERS', PDF_MARGINS.left + 2, yPos + 2);
    pdf.setTextColor(0, 0, 0);
    yPos += 10;
    
    if (!arterial) {
      arterial = {
        abiRequired: true,
        toePressureRequired: true,
        waveformAnalysisRequired: true,
        segmentalPressures: true,
        pulseVolumeRecording: true,
        specificVessels: {
          commonFemoralArtery: true,
          superficialFemoralArtery: true,
          profundaFemoralArtery: true,
          poplitealArtery: true,
          anteriorTibialArtery: true,
          posteriorTibialArtery: true,
          peronealArtery: true,
          dorsalisPedisArtery: true
        }
      };
    }
    
    pdf.setFontSize(9);
    pdf.setFont('times', 'bold');
    pdf.text('Measurements Required:', PDF_MARGINS.left, yPos);
    yPos += 5;
    
    pdf.setFont('times', 'normal');
    const measurements = [
      { label: 'Ankle-Brachial Index (ABI)', checked: arterial.abiRequired },
      { label: 'Toe Pressure / Toe-Brachial Index', checked: arterial.toePressureRequired },
      { label: 'Waveform Analysis (Triphasic/Biphasic/Monophasic)', checked: arterial.waveformAnalysisRequired },
      { label: 'Segmental Pressures', checked: arterial.segmentalPressures },
      { label: 'Pulse Volume Recording (PVR)', checked: arterial.pulseVolumeRecording }
    ];
    
    const colWidth = (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right) / 2;
    for (let i = 0; i < measurements.length; i += 2) {
      // First column
      pdf.rect(PDF_MARGINS.left + 5, yPos - 3, 4, 4);
      if (measurements[i].checked) {
        pdf.setFillColor(180, 0, 0);
        pdf.rect(PDF_MARGINS.left + 5.5, yPos - 2.5, 3, 3, 'F');
      }
      pdf.text(measurements[i].label, PDF_MARGINS.left + 12, yPos);
      
      // Second column
      if (measurements[i + 1]) {
        pdf.rect(PDF_MARGINS.left + colWidth + 5, yPos - 3, 4, 4);
        if (measurements[i + 1].checked) {
          pdf.setFillColor(180, 0, 0);
          pdf.rect(PDF_MARGINS.left + colWidth + 5.5, yPos - 2.5, 3, 3, 'F');
        }
        pdf.text(measurements[i + 1].label, PDF_MARGINS.left + colWidth + 12, yPos);
      }
      yPos += 6;
    }
    
    yPos += 3;
    pdf.setFont('times', 'bold');
    pdf.text('Vessels to Assess:', PDF_MARGINS.left, yPos);
    yPos += 5;
    
    pdf.setFont('times', 'normal');
    const vessels = [
      { label: 'Common Femoral Artery', checked: arterial.specificVessels?.commonFemoralArtery },
      { label: 'Superficial Femoral Artery', checked: arterial.specificVessels?.superficialFemoralArtery },
      { label: 'Profunda Femoris Artery', checked: arterial.specificVessels?.profundaFemoralArtery },
      { label: 'Popliteal Artery', checked: arterial.specificVessels?.poplitealArtery },
      { label: 'Anterior Tibial Artery', checked: arterial.specificVessels?.anteriorTibialArtery },
      { label: 'Posterior Tibial Artery', checked: arterial.specificVessels?.posteriorTibialArtery },
      { label: 'Peroneal Artery', checked: arterial.specificVessels?.peronealArtery },
      { label: 'Dorsalis Pedis Artery', checked: arterial.specificVessels?.dorsalisPedisArtery }
    ];
    
    for (let i = 0; i < vessels.length; i += 2) {
      pdf.rect(PDF_MARGINS.left + 5, yPos - 3, 4, 4);
      if (vessels[i].checked) {
        pdf.setFillColor(180, 0, 0);
        pdf.rect(PDF_MARGINS.left + 5.5, yPos - 2.5, 3, 3, 'F');
      }
      pdf.text(vessels[i].label, PDF_MARGINS.left + 12, yPos);
      
      if (vessels[i + 1]) {
        pdf.rect(PDF_MARGINS.left + colWidth + 5, yPos - 3, 4, 4);
        if (vessels[i + 1].checked) {
          pdf.setFillColor(180, 0, 0);
          pdf.rect(PDF_MARGINS.left + colWidth + 5.5, yPos - 2.5, 3, 3, 'F');
        }
        pdf.text(vessels[i + 1].label, PDF_MARGINS.left + colWidth + 12, yPos);
      }
      yPos += 6;
    }
    
    return yPos + 3;
  },
  
  addVenousSection(pdf: jsPDF, yPos: number, venous?: DopplerRequestData['venousAssessment']): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFontSize(10);
    pdf.setFont('times', 'bold');
    pdf.setFillColor(240, 240, 255);
    pdf.rect(PDF_MARGINS.left, yPos - 3, pageWidth - PDF_MARGINS.left - PDF_MARGINS.right, 7, 'F');
    pdf.setTextColor(0, 0, 150);
    pdf.text('VENOUS DOPPLER PARAMETERS', PDF_MARGINS.left + 2, yPos + 2);
    pdf.setTextColor(0, 0, 0);
    yPos += 10;
    
    if (!venous) {
      venous = {
        dvtScreening: true,
        chronicVenousInsufficiency: true,
        varicoseVeinMapping: false,
        perforatorIncompetence: true,
        specificVeins: {
          commonFemoralVein: true,
          greatSaphenousVein: true,
          smallSaphenousVein: true,
          poplitealVein: true,
          tibialVeins: true,
          perforators: true
        }
      };
    }
    
    pdf.setFontSize(9);
    pdf.setFont('times', 'bold');
    pdf.text('Assessment Required:', PDF_MARGINS.left, yPos);
    yPos += 5;
    
    pdf.setFont('times', 'normal');
    const assessments = [
      { label: 'DVT Screening (Compressibility)', checked: venous.dvtScreening },
      { label: 'Chronic Venous Insufficiency', checked: venous.chronicVenousInsufficiency },
      { label: 'Varicose Vein Mapping', checked: venous.varicoseVeinMapping },
      { label: 'Perforator Incompetence', checked: venous.perforatorIncompetence }
    ];
    
    const colWidth = (pageWidth - PDF_MARGINS.left - PDF_MARGINS.right) / 2;
    for (let i = 0; i < assessments.length; i += 2) {
      pdf.rect(PDF_MARGINS.left + 5, yPos - 3, 4, 4);
      if (assessments[i].checked) {
        pdf.setFillColor(0, 0, 150);
        pdf.rect(PDF_MARGINS.left + 5.5, yPos - 2.5, 3, 3, 'F');
      }
      pdf.text(assessments[i].label, PDF_MARGINS.left + 12, yPos);
      
      if (assessments[i + 1]) {
        pdf.rect(PDF_MARGINS.left + colWidth + 5, yPos - 3, 4, 4);
        if (assessments[i + 1].checked) {
          pdf.setFillColor(0, 0, 150);
          pdf.rect(PDF_MARGINS.left + colWidth + 5.5, yPos - 2.5, 3, 3, 'F');
        }
        pdf.text(assessments[i + 1].label, PDF_MARGINS.left + colWidth + 12, yPos);
      }
      yPos += 6;
    }
    
    yPos += 3;
    pdf.setFont('times', 'bold');
    pdf.text('Veins to Assess:', PDF_MARGINS.left, yPos);
    yPos += 5;
    
    pdf.setFont('times', 'normal');
    const veins = [
      { label: 'Common Femoral Vein', checked: venous.specificVeins?.commonFemoralVein },
      { label: 'Great Saphenous Vein', checked: venous.specificVeins?.greatSaphenousVein },
      { label: 'Small Saphenous Vein', checked: venous.specificVeins?.smallSaphenousVein },
      { label: 'Popliteal Vein', checked: venous.specificVeins?.poplitealVein },
      { label: 'Tibial Veins', checked: venous.specificVeins?.tibialVeins },
      { label: 'Perforator Veins', checked: venous.specificVeins?.perforators }
    ];
    
    for (let i = 0; i < veins.length; i += 2) {
      pdf.rect(PDF_MARGINS.left + 5, yPos - 3, 4, 4);
      if (veins[i].checked) {
        pdf.setFillColor(0, 0, 150);
        pdf.rect(PDF_MARGINS.left + 5.5, yPos - 2.5, 3, 3, 'F');
      }
      pdf.text(veins[i].label, PDF_MARGINS.left + 12, yPos);
      
      if (veins[i + 1]) {
        pdf.rect(PDF_MARGINS.left + colWidth + 5, yPos - 3, 4, 4);
        if (veins[i + 1].checked) {
          pdf.setFillColor(0, 0, 150);
          pdf.rect(PDF_MARGINS.left + colWidth + 5.5, yPos - 2.5, 3, 3, 'F');
        }
        pdf.text(veins[i + 1].label, PDF_MARGINS.left + colWidth + 12, yPos);
      }
      yPos += 6;
    }
    
    return yPos + 3;
  },
  
  /**
   * Generate and download the Doppler Request PDF
   */
  downloadDopplerRequest(data: DopplerRequestData): void {
    const pdf = this.generateDopplerRequestPDF(data);
    const filename = `Doppler_Request_${data.hospitalNumber}_${format(data.requestDate, 'yyyyMMdd')}.pdf`;
    pdf.save(filename);
  },
  
  /**
   * Generate a blank Doppler Request Form for printing
   */
  generateBlankDopplerRequestPDF(): jsPDF {
    const blankData: DopplerRequestData = {
      patientName: '_________________________________',
      hospitalNumber: '_______________',
      dateOfBirth: '_______________',
      gender: 'male',
      ward: '_______________',
      bedNumber: '_______',
      requestingPhysician: '_________________________________',
      designation: '_______________',
      contactNumber: '_______________',
      clinicalDiagnosis: '____________________________________________________________________________',
      reasonForRequest: '____________________________________________________________________________',
      relevantHistory: '____________________________________________________________________________',
      examinationType: 'both',
      urgency: 'routine',
      requestDate: new Date()
    };
    
    return this.generateDopplerRequestPDF(blankData);
  },
  
  downloadBlankDopplerRequest(): void {
    const pdf = this.generateBlankDopplerRequestPDF();
    const filename = `Doppler_Request_Blank_${format(new Date(), 'yyyyMMdd')}.pdf`;
    pdf.save(filename);
  }
};

export default dopplerRequestService;
