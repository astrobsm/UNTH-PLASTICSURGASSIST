import { db } from '../db/database';
import { format } from 'date-fns';
import { apiClient } from './apiClient';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  addFooter,
  sharePDFViaWhatsApp
} from '../utils/pdfUtils';

export interface DischargeMedication {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface Discharge {
  id?: number;
  admission_id: number;
  patient_id: number;
  patient_name: string;
  hospital_number: string;
  age?: number;
  gender?: string;
  admission_date: Date | string;
  discharge_date: Date | string;
  discharge_time: string;
  admitting_diagnosis: string;
  final_diagnosis: string;
  length_of_stay_days: number;
  discharge_status: 'improved' | 'recovered' | 'transferred' | 'against_medical_advice' | 'deceased' | string;
  discharge_destination: 'home' | 'another_facility' | 'mortuary' | 'other' | string;
  discharge_plans?: string;
  follow_up_date?: Date | string;
  follow_up_clinic?: string;
  follow_up_instructions?: string;
  medications_on_discharge?: DischargeMedication[];
  medications?: DischargeMedication[];
  discharge_instructions?: string;
  dietary_recommendations?: string;
  lifestyle_modifications?: string;
  activity_restrictions?: string;
  wound_care_instructions?: string;
  warning_signs?: string;
  emergency_contact_info?: string;
  ai_generated_instructions?: string;
  discharging_doctor: string;
  discharging_consultant?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface DischargeInstructionsData {
  patient_name: string;
  age?: number;
  gender?: string;
  hospital_number: string;
  admission_date: Date | string;
  discharge_date: Date | string;
  admitting_diagnosis: string;
  final_diagnosis: string;
  procedures_performed?: string[] | string;
  medications_on_discharge?: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  medications?: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  complications?: string;
  treatment_summary?: string;
}

class DischargeService {
  // Create discharge record
  async createDischarge(dischargeData: Omit<Discharge, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
    const now = new Date();
    const discharge: Omit<Discharge, 'id'> = {
      ...dischargeData,
      created_at: now,
      updated_at: now
    };

    // Try server first
    try {
      const saved = await apiClient.createDischarge(discharge);
      console.log('Discharge synced to server:', saved.id);
      const id = await db.discharges.add({ ...discharge, id: saved.id, synced: true });
      // Update admission status
      if (dischargeData.admission_id) {
        try {
          await apiClient.updateAdmission(String(dischargeData.admission_id), {
            status: 'discharged',
            discharge_date: dischargeData.discharge_date
          });
        } catch { /* ignore server admission update failure */ }
        await db.admissions.update(dischargeData.admission_id, {
          status: 'discharged',
          discharge_date: dischargeData.discharge_date,
          updated_at: now
        });
      }
      return saved.id || id;
    } catch (error) {
      console.warn('Failed to sync discharge to server, saving locally', error);
      const id = await db.discharges.add({ ...discharge, synced: false });
      // Update admission status locally
      if (dischargeData.admission_id) {
        await db.admissions.update(dischargeData.admission_id, {
          status: 'discharged',
          discharge_date: dischargeData.discharge_date,
          updated_at: now
        });
      }
      return id as number;
    }
  }

  // Get discharge by ID
  async getDischarge(id: number): Promise<Discharge | undefined> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverDischarges = await apiClient.getDischarges();
        if (Array.isArray(serverDischarges)) {
          const match = serverDischarges.find((d: any) => Number(d.id) === id);
          if (match) return match as Discharge;
        }
      } catch (e) {
        console.warn('Could not fetch discharge from server:', e);
      }
    }
    return await db.discharges.get(id);
  }

  // Get patient discharges
  async getPatientDischarges(patientId: number): Promise<Discharge[]> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverDischarges = await apiClient.getDischarges();
        if (Array.isArray(serverDischarges) && serverDischarges.length > 0) {
          // Sync to local
          for (const d of serverDischarges) {
            try { await db.discharges.put({ ...d, synced: true }); } catch { /* ignore */ }
          }
          return serverDischarges
            .filter((d: any) => Number(d.patient_id) === patientId)
            .sort((a: any, b: any) => new Date(b.discharge_date).getTime() - new Date(a.discharge_date).getTime());
        }
      } catch (e) {
        console.warn('Could not fetch discharges from server:', e);
      }
    }
    return await db.discharges
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('discharge_date');
  }

  // Get all discharges
  async getAllDischarges(): Promise<Discharge[]> {
    // Try server first
    if (navigator.onLine) {
      try {
        const serverDischarges = await apiClient.getDischarges();
        if (Array.isArray(serverDischarges) && serverDischarges.length > 0) {
          // Sync to local
          for (const d of serverDischarges) {
            try { await db.discharges.put({ ...d, synced: true }); } catch { /* ignore */ }
          }
          return serverDischarges.sort((a: any, b: any) => 
            new Date(b.discharge_date).getTime() - new Date(a.discharge_date).getTime());
        }
      } catch (e) {
        console.warn('Could not fetch discharges from server:', e);
      }
    }
    const discharges = await db.discharges.toArray();
    return discharges.sort((a, b) => b.discharge_date.getTime() - a.discharge_date.getTime());
  }

  // Search discharges
  async searchDischarges(query: string): Promise<Discharge[]> {
    // Use server-first getAllDischarges then filter
    const discharges = await this.getAllDischarges();
    const searchLower = query.toLowerCase();
    
    return discharges.filter(discharge => 
      (discharge.patient_name || '').toLowerCase().includes(searchLower) ||
      (discharge.hospital_number || '').toLowerCase().includes(searchLower) ||
      (discharge.final_diagnosis || '').toLowerCase().includes(searchLower)
    );
  }

  // Update discharge
  async updateDischarge(id: number, updates: Partial<Discharge>): Promise<void> {
    await db.discharges.update(id, {
      ...updates,
      updated_at: new Date()
    });
  }

  // Generate AI-powered discharge instructions
  async generateDischargeInstructions(data: DischargeInstructionsData): Promise<string> {
    // This generates comprehensive discharge instructions based on patient data
    const { 
      patient_name, 
      final_diagnosis, 
      medications = [],
      procedures_performed: rawProcedures = [],
      treatment_summary = ''
    } = data;
    const procedures_performed = Array.isArray(rawProcedures) ? rawProcedures : [rawProcedures];

    let instructions = `DISCHARGE INSTRUCTIONS FOR ${patient_name.toUpperCase()}\n\n`;
    
    instructions += `DIAGNOSIS: ${final_diagnosis}\n\n`;
    
    if (treatment_summary) {
      instructions += `TREATMENT SUMMARY:\n${treatment_summary}\n\n`;
    }

    if (procedures_performed.length > 0) {
      instructions += `PROCEDURES PERFORMED:\n`;
      procedures_performed.forEach(proc => {
        instructions += `• ${proc}\n`;
      });
      instructions += `\n`;
    }

    // Medications section
    if (medications.length > 0) {
      instructions += `MEDICATIONS:\n`;
      instructions += `Please take the following medications as prescribed:\n\n`;
      medications.forEach((med, index) => {
        instructions += `${index + 1}. ${med.medication}\n`;
        instructions += `   - Dosage: ${med.dosage}\n`;
        instructions += `   - Frequency: ${med.frequency}\n`;
        instructions += `   - Duration: ${med.duration}\n\n`;
      });
    }

    // Diagnosis-specific recommendations
    instructions += this.getDiagnosisSpecificInstructions(final_diagnosis);

    // General wound care for surgical patients
    if (final_diagnosis.toLowerCase().includes('burn') || 
        final_diagnosis.toLowerCase().includes('wound') ||
        final_diagnosis.toLowerCase().includes('graft') ||
        procedures_performed.some(p => p.toLowerCase().includes('surgery'))) {
      instructions += `WOUND CARE:\n`;
      instructions += `• Keep the wound clean and dry\n`;
      instructions += `• Change dressings as instructed by your healthcare team\n`;
      instructions += `• Watch for signs of infection (increased redness, swelling, pus, fever)\n`;
      instructions += `• Do not remove stitches or staples yourself\n`;
      instructions += `• Avoid soaking the wound in water until healed\n\n`;
    }

    // Activity restrictions
    instructions += `ACTIVITY:\n`;
    instructions += `• Rest adequately and avoid strenuous activities for 2 weeks\n`;
    instructions += `• Gradually increase activity as tolerated\n`;
    instructions += `• Avoid heavy lifting (>5kg) for 2-4 weeks\n`;
    instructions += `• Follow specific activity restrictions given by your doctor\n\n`;

    // Diet
    instructions += `DIET:\n`;
    instructions += `• Maintain a balanced, nutritious diet\n`;
    instructions += `• Increase protein intake to promote healing (eggs, fish, lean meat, beans)\n`;
    instructions += `• Stay well hydrated (8-10 glasses of water daily)\n`;
    instructions += `• Include fresh fruits and vegetables\n`;
    instructions += `• Avoid alcohol and smoking\n`;
    if (final_diagnosis.toLowerCase().includes('burn')) {
      instructions += `• Consider high-calorie diet to support burn healing\n`;
      instructions += `• Vitamin C and zinc supplements may aid healing\n`;
    }
    instructions += `\n`;

    // Warning signs
    instructions += `SEEK IMMEDIATE MEDICAL ATTENTION IF YOU EXPERIENCE:\n`;
    instructions += `• Fever above 38°C (100.4°F)\n`;
    instructions += `• Increasing pain not relieved by medication\n`;
    instructions += `• Signs of wound infection (redness, swelling, pus, foul odor)\n`;
    instructions += `• Excessive bleeding from wound site\n`;
    instructions += `• Shortness of breath or chest pain\n`;
    instructions += `• Severe nausea or vomiting\n`;
    instructions += `• Any other concerning symptoms\n\n`;

    // Follow-up
    instructions += `FOLLOW-UP:\n`;
    instructions += `• Attend all scheduled follow-up appointments\n`;
    instructions += `• Bring this discharge summary and all medications to your follow-up visit\n`;
    instructions += `• Contact the clinic if you need to reschedule\n\n`;

    instructions += `EMERGENCY CONTACT:\n`;
    instructions += `For urgent concerns, contact the Plastic Surgery Unit or visit the nearest emergency department.\n\n`;

    instructions += `Remember: This information is for guidance only. Always follow the specific instructions given by your healthcare team.\n`;

    return instructions;
  }

  // Get diagnosis-specific instructions
  private getDiagnosisSpecificInstructions(diagnosis: string): string {
    const diagnosisLower = diagnosis.toLowerCase();
    let instructions = '';

    if (diagnosisLower.includes('burn')) {
      instructions += `SPECIFIC INSTRUCTIONS FOR BURN CARE:\n`;
      instructions += `• Keep burn areas moisturized with prescribed creams\n`;
      instructions += `• Protect healing skin from sun exposure (use SPF 30+ sunscreen)\n`;
      instructions += `• Perform range of motion exercises to prevent contractures\n`;
      instructions += `• Use pressure garments as prescribed\n`;
      instructions += `• Massage healed areas with moisturizer to reduce scarring\n`;
      instructions += `• Avoid tight clothing over burn areas\n\n`;
    }

    if (diagnosisLower.includes('graft') || diagnosisLower.includes('flap')) {
      instructions += `SPECIFIC INSTRUCTIONS FOR GRAFT/FLAP CARE:\n`;
      instructions += `• Protect the graft site from trauma\n`;
      instructions += `• Elevate the grafted area when resting\n`;
      instructions += `• Avoid direct pressure on the graft\n`;
      instructions += `• Monitor for signs of graft failure (dark color, coolness, loss of sensation)\n`;
      instructions += `• Keep donor site clean and covered as instructed\n\n`;
    }

    if (diagnosisLower.includes('hand') || diagnosisLower.includes('finger')) {
      instructions += `HAND THERAPY:\n`;
      instructions += `• Elevate hand above heart level when resting\n`;
      instructions += `• Perform prescribed hand exercises regularly\n`;
      instructions += `• Use hand splint as directed\n`;
      instructions += `• Attend hand therapy sessions as scheduled\n\n`;
    }

    if (diagnosisLower.includes('pressure sore') || diagnosisLower.includes('ulcer')) {
      instructions += `PRESSURE ULCER PREVENTION:\n`;
      instructions += `• Change position every 2 hours if bedridden\n`;
      instructions += `• Use pressure-relieving cushions and mattresses\n`;
      instructions += `• Keep skin clean and dry\n`;
      instructions += `• Maintain good nutrition and hydration\n`;
      instructions += `• Inspect skin daily for new pressure areas\n\n`;
    }

    return instructions;
  }

  // Generate PDF discharge summary
  async generateDischargePDF(discharge: Discharge, patientDetails?: any, shareViaWhatsApp: boolean = false): Promise<void> {
    const pdf = createPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = PDF_MARGINS.top;

    // Helper to sanitize text for proper rendering
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    const checkPageBreak = (neededSpace: number): boolean => {
      if (yPos + neededSpace > pageHeight - PDF_MARGINS.bottom) {
        pdf.addPage();
        yPos = PDF_MARGINS.top;
        return true;
      }
      return false;
    };

    // Header
    pdf.setFontSize(PDF_FONT_SIZES.title);
    pdf.setFont('times', 'bold');
    pdf.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    pdf.setFontSize(PDF_FONT_SIZES.sectionHeader + 2);
    pdf.text('DISCHARGE SUMMARY', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Patient details
    pdf.setFontSize(PDF_FONT_SIZES.subHeader);
    pdf.setFont('times', 'bold');
    pdf.text('PATIENT INFORMATION', PDF_MARGINS.left, yPos);
    yPos += 7;

    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    pdf.text('Name: ' + clean(discharge.patient_name), PDF_MARGINS.left, yPos);
    yPos += 6;
    pdf.text('Hospital Number: ' + clean(discharge.hospital_number), PDF_MARGINS.left, yPos);
    yPos += 6;
    
    if (patientDetails?.age) {
      pdf.text('Age: ' + patientDetails.age + ' years', PDF_MARGINS.left, yPos);
      yPos += 6;
    }
    
    if (patientDetails?.gender) {
      pdf.text('Gender: ' + clean(patientDetails.gender), PDF_MARGINS.left, yPos);
      yPos += 6;
    }

    yPos += 5;

    // Admission/Discharge dates
    pdf.setFont('times', 'bold');
    pdf.text('ADMISSION DETAILS', PDF_MARGINS.left, yPos);
    yPos += 7;

    pdf.setFont('times', 'normal');
    pdf.text('Admission Date: ' + format(new Date(discharge.admission_date), 'dd/MM/yyyy'), PDF_MARGINS.left, yPos);
    yPos += 6;
    pdf.text('Discharge Date: ' + format(new Date(discharge.discharge_date), 'dd/MM/yyyy') + ' at ' + clean(discharge.discharge_time), PDF_MARGINS.left, yPos);
    yPos += 6;
    pdf.text('Length of Stay: ' + discharge.length_of_stay_days + ' days', PDF_MARGINS.left, yPos);
    yPos += 10;

    // Diagnosis
    pdf.setFont('times', 'bold');
    pdf.text('DIAGNOSIS', PDF_MARGINS.left, yPos);
    yPos += 7;

    pdf.setFont('times', 'normal');
    pdf.text('Admitting Diagnosis: ' + clean(discharge.admitting_diagnosis), PDF_MARGINS.left, yPos);
    yPos += 6;
    pdf.text('Final Diagnosis: ' + clean(discharge.final_diagnosis), PDF_MARGINS.left, yPos);
    yPos += 10;

    // Discharge status
    pdf.setFont('times', 'bold');
    pdf.text('DISCHARGE STATUS', PDF_MARGINS.left, yPos);
    yPos += 7;

    pdf.setFont('times', 'normal');
    pdf.text('Status: ' + discharge.discharge_status.replace('_', ' ').toUpperCase(), PDF_MARGINS.left, yPos);
    yPos += 6;
    pdf.text('Destination: ' + discharge.discharge_destination.replace('_', ' ').toUpperCase(), PDF_MARGINS.left, yPos);
    yPos += 10;

    // Discharge plans
    if (discharge.discharge_plans) {
      pdf.setFont('times', 'bold');
      pdf.text('DISCHARGE PLANS', PDF_MARGINS.left, yPos);
      yPos += 7;

      pdf.setFont('times', 'normal');
      const planLines = pdf.splitTextToSize(clean(discharge.discharge_plans), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
      planLines.forEach((line: string) => {
        checkPageBreak(6);
        pdf.text(line, PDF_MARGINS.left, yPos);
        yPos += 6;
      });
      yPos += 5;
    }

    checkPageBreak(40);

    // Medications
    if (discharge.medications_on_discharge && discharge.medications_on_discharge.length > 0) {
      pdf.setFont('times', 'bold');
      pdf.text('MEDICATIONS ON DISCHARGE', PDF_MARGINS.left, yPos);
      yPos += 7;

      pdf.setFont('times', 'normal');
      discharge.medications_on_discharge.forEach((med, index) => {
        checkPageBreak(25);
        
        pdf.setFont('times', 'bold');
        pdf.text((index + 1) + '. ' + clean(med.medication), PDF_MARGINS.left, yPos);
        yPos += 6;
        
        pdf.setFont('times', 'normal');
        pdf.text('   Dosage: ' + clean(med.dosage), PDF_MARGINS.left + 5, yPos);
        yPos += 5;
        pdf.text('   Frequency: ' + clean(med.frequency), PDF_MARGINS.left + 5, yPos);
        yPos += 5;
        pdf.text('   Duration: ' + clean(med.duration), PDF_MARGINS.left + 5, yPos);
        yPos += 5;
        
        if (med.instructions) {
          const instrLines = pdf.splitTextToSize('   Instructions: ' + clean(med.instructions), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right - 10);
          instrLines.forEach((line: string) => {
            pdf.text(line, PDF_MARGINS.left + 5, yPos);
            yPos += 5;
          });
        }
        yPos += 3;
      });
      yPos += 5;
    }

    // Follow-up
    if (discharge.follow_up_date) {
      checkPageBreak(40);

      pdf.setFont('times', 'bold');
      pdf.text('FOLLOW-UP APPOINTMENT', PDF_MARGINS.left, yPos);
      yPos += 7;

      pdf.setFont('times', 'normal');
      pdf.text('Date: ' + format(new Date(discharge.follow_up_date as any), 'dd/MM/yyyy'), PDF_MARGINS.left, yPos);
      yPos += 6;
      if (discharge.follow_up_clinic) {
        pdf.text('Clinic: ' + clean(discharge.follow_up_clinic), PDF_MARGINS.left, yPos);
        yPos += 6;
      }
      if (discharge.follow_up_instructions) {
        const followUpLines = pdf.splitTextToSize(clean(discharge.follow_up_instructions), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
        followUpLines.forEach((line: string) => {
          checkPageBreak(6);
          pdf.text(line, PDF_MARGINS.left, yPos);
          yPos += 6;
        });
        yPos += 5;
      }
    }

    // AI-generated instructions (new page for detailed instructions)
    if (discharge.ai_generated_instructions) {
      pdf.addPage();
      yPos = PDF_MARGINS.top;

      pdf.setFontSize(PDF_FONT_SIZES.sectionHeader + 2);
      pdf.setFont('times', 'bold');
      pdf.text('DETAILED DISCHARGE INSTRUCTIONS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      pdf.setFontSize(PDF_FONT_SIZES.body);
      
      const instructionLines = clean(discharge.ai_generated_instructions).split('\n');
      instructionLines.forEach(line => {
        checkPageBreak(10);

        // Check if line is a header (ends with : or is all uppercase)
        if (line.trim().endsWith(':') || (line.trim().toUpperCase() === line.trim() && line.trim().length > 0)) {
          pdf.setFont('times', 'bold');
        } else {
          pdf.setFont('times', 'normal');
        }

        const splitLines = pdf.splitTextToSize(line || ' ', pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
        splitLines.forEach((splitLine: string) => {
          checkPageBreak(6);
          pdf.text(splitLine, PDF_MARGINS.left, yPos);
          yPos += 5;
        });
      });
    }

    // Footer on last page
    yPos = pageHeight - 35;
    pdf.setDrawColor(150, 150, 150);
    pdf.setLineWidth(0.3);
    pdf.line(PDF_MARGINS.left, yPos - 5, pageWidth - PDF_MARGINS.right, yPos - 5);
    
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'bold');
    pdf.text('Discharging Doctor: ', PDF_MARGINS.left, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(clean(discharge.discharging_doctor), PDF_MARGINS.left + 40, yPos);
    
    if (discharge.discharging_consultant) {
      yPos += 6;
      pdf.setFont('times', 'bold');
      pdf.text('Consultant: ', PDF_MARGINS.left, yPos);
      pdf.setFont('times', 'normal');
      pdf.text(clean(discharge.discharging_consultant), PDF_MARGINS.left + 25, yPos);
    }
    yPos += 6;
    pdf.setFont('times', 'bold');
    pdf.text('Date Generated: ', PDF_MARGINS.left, yPos);
    pdf.setFont('times', 'normal');
    pdf.text(format(new Date(), 'dd/MM/yyyy HH:mm'), PDF_MARGINS.left + 35, yPos);

    // Add professional footer with page numbers and timestamp
    addFooter(pdf);

    // Save with patient name
    const fileName = 'Discharge_Summary_' + (discharge.patient_name || 'Unknown_Patient').replace(/\s+/g, '_') + '_' + format(new Date(discharge.discharge_date), 'yyyyMMdd') + '.pdf';
    
    if (shareViaWhatsApp) {
      const message = `Discharge Summary for ${discharge.patient_name} (${discharge.hospital_number}) - ${format(new Date(discharge.discharge_date), 'dd/MM/yyyy')}`;
      await sharePDFViaWhatsApp(pdf, fileName, message);
    } else {
      pdf.save(fileName);
    }
  }

  // Delete discharge
  async deleteDischarge(id: number): Promise<void> {
    await db.discharges.delete(id);
  }
}

export const dischargeService = new DischargeService();
