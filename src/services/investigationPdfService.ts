// Investigation Request Form PDF Service
// Generates thermal print PDF for requested investigations

import { createPDF, sanitizeTextForPDF, PDF_COLORS, PDF_FONT_SIZES, PDF_MARGINS } from '../utils/pdfUtils';
import { PlannedInvestigation } from './treatmentPlanningService';
import { format } from 'date-fns';

export interface InvestigationRequestData {
  patientName: string;
  hospitalNumber: string;
  patientAge?: string | number;
  patientGender?: string;
  ward?: string;
  bedNumber?: string;
  diagnosis: string;
  investigations: PlannedInvestigation[];
  requestedBy: string;
  requestDate: Date;
  clinicalIndication?: string;
  urgency?: 'routine' | 'urgent' | 'stat';
}

class InvestigationPdfService {
  /**
   * Generate thermal print PDF for investigation request (80mm width)
   */
  async generateThermalInvestigationRequestPDF(data: InvestigationRequestData): Promise<void> {
    const { jsPDF } = await import('jspdf');
    
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');
    
    // 80mm thermal paper width
    const thermalWidth = 80; // mm
    const estimatedHeight = 180 + (data.investigations.length * 12);
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [thermalWidth, estimatedHeight]
    });

    const margin = 3;
    let yPos = margin;

    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('UNTH LABORATORY', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    
    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    doc.text('Burns & Plastic Surgery Unit', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    doc.text('INVESTIGATION REQUEST FORM', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 5;

    // Divider
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Patient Info
    doc.setFontSize(9);
    doc.setFont('times', 'bold');
    doc.text('PATIENT DETAILS', margin, yPos);
    yPos += 4;

    doc.setFont('times', 'normal');
    doc.setFontSize(8);
    doc.text(`Name: ${clean(data.patientName)}`, margin, yPos);
    yPos += 4;
    doc.text(`Hosp #: ${clean(data.hospitalNumber)}`, margin, yPos);
    yPos += 4;
    
    if (data.patientAge || data.patientGender) {
      doc.text(`Age/Sex: ${data.patientAge || 'N/A'} / ${data.patientGender || 'N/A'}`, margin, yPos);
      yPos += 4;
    }
    
    if (data.ward) {
      doc.text(`Ward: ${clean(data.ward)}${data.bedNumber ? ' | Bed: ' + clean(data.bedNumber) : ''}`, margin, yPos);
      yPos += 4;
    }
    
    doc.text(`Diagnosis: ${clean(data.diagnosis).substring(0, 50)}`, margin, yPos);
    yPos += 5;

    // Divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Request Info
    doc.setFont('times', 'bold');
    doc.text('REQUEST DETAILS', margin, yPos);
    yPos += 4;

    doc.setFont('times', 'normal');
    doc.text(`Date: ${format(data.requestDate, 'dd/MM/yyyy HH:mm')}`, margin, yPos);
    yPos += 4;
    doc.text(`Requested By: ${clean(data.requestedBy)}`, margin, yPos);
    yPos += 4;
    
    if (data.urgency) {
      const urgencyText = data.urgency.toUpperCase();
      doc.setFont('times', 'bold');
      doc.text(`Urgency: ${urgencyText}`, margin, yPos);
      doc.setFont('times', 'normal');
      yPos += 4;
    }
    
    if (data.clinicalIndication) {
      doc.text(`Indication: ${clean(data.clinicalIndication).substring(0, 40)}`, margin, yPos);
      yPos += 4;
    }
    yPos += 2;

    // Divider
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Investigations Header
    doc.setFont('times', 'bold');
    doc.text('INVESTIGATIONS REQUESTED', margin, yPos);
    yPos += 4;

    // Lab Tests
    const labTests = data.investigations.filter(inv => inv.investigation_type === 'lab');
    const imagingTests = data.investigations.filter(inv => inv.investigation_type === 'imaging');
    const otherTests = data.investigations.filter(inv => inv.investigation_type === 'other' || !inv.investigation_type);

    if (labTests.length > 0) {
      doc.setFont('times', 'bold');
      doc.setFontSize(8);
      doc.text('Laboratory:', margin, yPos);
      yPos += 4;
      
      doc.setFont('times', 'normal');
      labTests.forEach((inv, index) => {
        const name = inv.investigation_name.length > 35 
          ? inv.investigation_name.substring(0, 32) + '...' 
          : inv.investigation_name;
        const freqText = inv.frequency !== 'once' ? ` (${inv.frequency})` : '';
        doc.text(`${index + 1}. ${clean(name)}${freqText}`, margin + 2, yPos);
        yPos += 4;
        
        if (inv.target_value || inv.target_range) {
          doc.setFontSize(7);
          doc.text(`   Target: ${inv.target_value || ''} ${inv.target_range ? `(${inv.target_range})` : ''}`, margin + 2, yPos);
          doc.setFontSize(8);
          yPos += 3;
        }
      });
      yPos += 2;
    }

    if (imagingTests.length > 0) {
      doc.setFont('times', 'bold');
      doc.text('Imaging:', margin, yPos);
      yPos += 4;
      
      doc.setFont('times', 'normal');
      imagingTests.forEach((inv, index) => {
        const name = inv.investigation_name.length > 35 
          ? inv.investigation_name.substring(0, 32) + '...' 
          : inv.investigation_name;
        doc.text(`${index + 1}. ${clean(name)}`, margin + 2, yPos);
        yPos += 4;
      });
      yPos += 2;
    }

    if (otherTests.length > 0) {
      doc.setFont('times', 'bold');
      doc.text('Other:', margin, yPos);
      yPos += 4;
      
      doc.setFont('times', 'normal');
      otherTests.forEach((inv, index) => {
        const name = inv.investigation_name.length > 35 
          ? inv.investigation_name.substring(0, 32) + '...' 
          : inv.investigation_name;
        doc.text(`${index + 1}. ${clean(name)}`, margin + 2, yPos);
        yPos += 4;
      });
    }

    yPos += 3;
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 4;

    // Summary
    doc.setFont('times', 'bold');
    doc.text(`Total Investigations: ${data.investigations.length}`, margin, yPos);
    yPos += 5;

    // Signature Line
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.text('Doctor\'s Signature: _______________________', margin, yPos);
    yPos += 5;
    doc.text('Date/Time: _______________________', margin, yPos);
    yPos += 6;

    // Footer
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, thermalWidth - margin, yPos);
    yPos += 3;
    doc.setFontSize(6);
    doc.text('Drs Okwesili/Nnadi/Eze', thermalWidth / 2, yPos, { align: 'center' });
    yPos += 3;
    doc.text('Department of Surgery, UNTH Enugu', thermalWidth / 2, yPos, { align: 'center' });

    // Save
    const sanitizedPatientName = (data.patientName || 'Unknown_Patient').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `Investigation_Request_${sanitizedPatientName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
  }

  /**
   * Generate standard A4 investigation request form
   */
  async generateInvestigationRequestPDF(data: InvestigationRequestData): Promise<void> {
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = PDF_MARGINS.left + 5;
    const maxWidth = pageWidth - 2 * margin;
    let yPos = margin;

    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    // Header
    doc.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(PDF_FONT_SIZES.title);
    doc.setFont('times', 'bold');
    doc.text('INVESTIGATION REQUEST FORM', pageWidth / 2, 12, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'normal');
    doc.text('Burns Plastic and Reconstructive Surgery Unit', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(PDF_FONT_SIZES.small);
    doc.text('University of Nigeria Teaching Hospital, Enugu', pageWidth / 2, 28, { align: 'center' });

    yPos = 45;
    doc.setTextColor(0, 0, 0);

    // Patient Information Box
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.rect(margin, yPos, maxWidth, 35, 'FD');
    
    doc.setFontSize(PDF_FONT_SIZES.sectionHeader);
    doc.setFont('times', 'bold');
    doc.text('PATIENT INFORMATION', margin + 3, yPos + 6);
    
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'normal');
    doc.text(`Name: ${clean(data.patientName)}`, margin + 3, yPos + 14);
    doc.text(`Hospital Number: ${clean(data.hospitalNumber)}`, margin + 100, yPos + 14);
    doc.text(`Age: ${data.patientAge || 'N/A'}`, margin + 3, yPos + 21);
    doc.text(`Gender: ${data.patientGender || 'N/A'}`, margin + 50, yPos + 21);
    doc.text(`Ward: ${data.ward || 'N/A'}`, margin + 100, yPos + 21);
    doc.text(`Diagnosis: ${clean(data.diagnosis).substring(0, 60)}`, margin + 3, yPos + 28);
    
    yPos += 45;

    // Request Information
    doc.setFillColor(254, 243, 199);
    doc.rect(margin, yPos, maxWidth, 25, 'FD');
    
    doc.setFontSize(PDF_FONT_SIZES.sectionHeader);
    doc.setFont('times', 'bold');
    doc.text('REQUEST DETAILS', margin + 3, yPos + 6);
    
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'normal');
    doc.text(`Date: ${format(data.requestDate, 'dd/MM/yyyy HH:mm')}`, margin + 3, yPos + 14);
    doc.text(`Requested By: ${clean(data.requestedBy)}`, margin + 70, yPos + 14);
    doc.text(`Urgency: ${(data.urgency || 'routine').toUpperCase()}`, margin + 140, yPos + 14);
    if (data.clinicalIndication) {
      doc.text(`Clinical Indication: ${clean(data.clinicalIndication).substring(0, 80)}`, margin + 3, yPos + 21);
    }

    yPos += 35;

    // Investigations Table
    doc.setFontSize(PDF_FONT_SIZES.sectionHeader);
    doc.setFont('times', 'bold');
    doc.text('INVESTIGATIONS REQUESTED', margin, yPos);
    yPos += 8;

    // Table Header
    doc.setFillColor(PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, yPos, maxWidth, 8, 'F');
    doc.setFontSize(9);
    doc.text('#', margin + 2, yPos + 6);
    doc.text('Investigation', margin + 10, yPos + 6);
    doc.text('Type', margin + 90, yPos + 6);
    doc.text('Frequency', margin + 120, yPos + 6);
    doc.text('Target Value', margin + 155, yPos + 6);
    yPos += 10;

    doc.setTextColor(0, 0, 0);
    doc.setFont('times', 'normal');
    doc.setFontSize(8);

    // Investigation Rows
    data.investigations.forEach((inv, index) => {
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 4, maxWidth, 8, 'F');
      }

      doc.text(`${index + 1}`, margin + 2, yPos);
      const invName = inv.investigation_name.length > 35 
        ? inv.investigation_name.substring(0, 32) + '...' 
        : inv.investigation_name;
      doc.text(clean(invName), margin + 10, yPos);
      doc.text(inv.investigation_type || 'lab', margin + 90, yPos);
      doc.text(inv.frequency || 'once', margin + 120, yPos);
      doc.text(inv.target_value || '-', margin + 155, yPos);
      yPos += 8;
    });

    yPos += 10;

    // Summary
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.setFont('times', 'bold');
    doc.text(`Total Investigations: ${data.investigations.length}`, margin, yPos);
    yPos += 15;

    // Signatures
    doc.setFont('times', 'normal');
    doc.setFontSize(PDF_FONT_SIZES.body);
    doc.text("Requesting Doctor's Signature: ________________________", margin, yPos);
    doc.text('Date: ____________', margin + 130, yPos);
    yPos += 10;
    doc.text("Lab Technician's Signature: ________________________", margin, yPos);
    doc.text('Date: ____________', margin + 130, yPos);

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text('Drs Okwesili / Nnadi / Eze | Department of Surgery, UNTH Enugu', pageWidth / 2, pageHeight - 10, { align: 'center' });

    // Save
    const sanitizedPatientName = (data.patientName || 'Unknown_Patient').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
    const filename = `Investigation_Request_${sanitizedPatientName}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
  }
}

export const investigationPdfService = new InvestigationPdfService();
