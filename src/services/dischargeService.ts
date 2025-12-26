import { db } from '../db/database';
import jsPDF from 'jspdf';
import { format } from 'date-fns';

export interface Discharge {
  id?: number;
  admission_id: number;
  patient_id: number;
  patient_name: string;
  hospital_number: string;
  admission_date: Date;
  discharge_date: Date;
  discharge_time: string;
  admitting_diagnosis: string;
  final_diagnosis: string;
  length_of_stay_days: number;
  discharge_status: 'improved' | 'recovered' | 'transferred' | 'against_medical_advice' | 'deceased';
  discharge_destination: 'home' | 'another_facility' | 'mortuary' | 'other';
  discharge_plans: string;
  follow_up_date?: Date;
  follow_up_clinic?: string;
  follow_up_instructions?: string;
  medications_on_discharge?: Array<{
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }>;
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
  admission_date: Date;
  discharge_date: Date;
  admitting_diagnosis: string;
  final_diagnosis: string;
  procedures_performed?: string[];
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

    const id = await db.discharges.add(discharge);
    
    // Update admission status
    if (dischargeData.admission_id) {
      await db.admissions.update(dischargeData.admission_id, {
        status: 'discharged',
        discharge_date: dischargeData.discharge_date,
        updated_at: now
      });
    }

    return id;
  }

  // Get discharge by ID
  async getDischarge(id: number): Promise<Discharge | undefined> {
    return await db.discharges.get(id);
  }

  // Get patient discharges
  async getPatientDischarges(patientId: number): Promise<Discharge[]> {
    return await db.discharges
      .where('patient_id')
      .equals(patientId)
      .reverse()
      .sortBy('discharge_date');
  }

  // Get all discharges
  async getAllDischarges(): Promise<Discharge[]> {
    const discharges = await db.discharges.toArray();
    return discharges.sort((a, b) => b.discharge_date.getTime() - a.discharge_date.getTime());
  }

  // Search discharges
  async searchDischarges(query: string): Promise<Discharge[]> {
    const discharges = await db.discharges.toArray();
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
      procedures_performed = [],
      treatment_summary = ''
    } = data;

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
  async generateDischargePDF(discharge: Discharge, patientDetails?: any): Promise<void> {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    let yPos = 20;

    // Header
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PLASTIC AND RECONSTRUCTIVE SURGERY UNIT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
    
    pdf.setFontSize(14);
    pdf.text('DISCHARGE SUMMARY', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Patient details
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PATIENT INFORMATION', 15, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Name: ${discharge.patient_name}`, 15, yPos);
    yPos += 6;
    pdf.text(`Hospital Number: ${discharge.hospital_number}`, 15, yPos);
    yPos += 6;
    
    if (patientDetails?.age) {
      pdf.text(`Age: ${patientDetails.age} years`, 15, yPos);
      yPos += 6;
    }
    
    if (patientDetails?.gender) {
      pdf.text(`Gender: ${patientDetails.gender}`, 15, yPos);
      yPos += 6;
    }

    yPos += 5;

    // Admission/Discharge dates
    pdf.setFont('helvetica', 'bold');
    pdf.text('ADMISSION DETAILS', 15, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Admission Date: ${format(discharge.admission_date, 'dd/MM/yyyy')}`, 15, yPos);
    yPos += 6;
    pdf.text(`Discharge Date: ${format(discharge.discharge_date, 'dd/MM/yyyy')} at ${discharge.discharge_time}`, 15, yPos);
    yPos += 6;
    pdf.text(`Length of Stay: ${discharge.length_of_stay_days} days`, 15, yPos);
    yPos += 10;

    // Diagnosis
    pdf.setFont('helvetica', 'bold');
    pdf.text('DIAGNOSIS', 15, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Admitting Diagnosis: ${discharge.admitting_diagnosis}`, 15, yPos);
    yPos += 6;
    pdf.text(`Final Diagnosis: ${discharge.final_diagnosis}`, 15, yPos);
    yPos += 10;

    // Discharge status
    pdf.setFont('helvetica', 'bold');
    pdf.text('DISCHARGE STATUS', 15, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.text(`Status: ${discharge.discharge_status.replace('_', ' ').toUpperCase()}`, 15, yPos);
    yPos += 6;
    pdf.text(`Destination: ${discharge.discharge_destination.replace('_', ' ').toUpperCase()}`, 15, yPos);
    yPos += 10;

    // Discharge plans
    if (discharge.discharge_plans) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('DISCHARGE PLANS', 15, yPos);
      yPos += 7;

      pdf.setFont('helvetica', 'normal');
      const planLines = pdf.splitTextToSize(discharge.discharge_plans, pageWidth - 30);
      pdf.text(planLines, 15, yPos);
      yPos += (planLines.length * 6) + 5;
    }

    // Check if we need a new page
    if (yPos > pageHeight - 40) {
      pdf.addPage();
      yPos = 20;
    }

    // Medications
    if (discharge.medications_on_discharge && discharge.medications_on_discharge.length > 0) {
      pdf.setFont('helvetica', 'bold');
      pdf.text('MEDICATIONS ON DISCHARGE', 15, yPos);
      yPos += 7;

      pdf.setFont('helvetica', 'normal');
      discharge.medications_on_discharge.forEach((med, index) => {
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = 20;
        }
        
        pdf.text(`${index + 1}. ${med.medication}`, 15, yPos);
        yPos += 6;
        pdf.text(`   Dosage: ${med.dosage}, Frequency: ${med.frequency}, Duration: ${med.duration}`, 15, yPos);
        yPos += 6;
        if (med.instructions) {
          const instrLines = pdf.splitTextToSize(`   Instructions: ${med.instructions}`, pageWidth - 30);
          pdf.text(instrLines, 15, yPos);
          yPos += (instrLines.length * 6);
        }
        yPos += 2;
      });
      yPos += 5;
    }

    // Follow-up
    if (discharge.follow_up_date) {
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = 20;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.text('FOLLOW-UP APPOINTMENT', 15, yPos);
      yPos += 7;

      pdf.setFont('helvetica', 'normal');
      pdf.text(`Date: ${format(discharge.follow_up_date, 'dd/MM/yyyy')}`, 15, yPos);
      yPos += 6;
      if (discharge.follow_up_clinic) {
        pdf.text(`Clinic: ${discharge.follow_up_clinic}`, 15, yPos);
        yPos += 6;
      }
      if (discharge.follow_up_instructions) {
        const followUpLines = pdf.splitTextToSize(discharge.follow_up_instructions, pageWidth - 30);
        pdf.text(followUpLines, 15, yPos);
        yPos += (followUpLines.length * 6) + 5;
      }
    }

    // AI-generated instructions (new page for detailed instructions)
    if (discharge.ai_generated_instructions) {
      pdf.addPage();
      yPos = 20;

      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DETAILED DISCHARGE INSTRUCTIONS', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const instructionLines = discharge.ai_generated_instructions.split('\n');
      instructionLines.forEach(line => {
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = 20;
        }

        if (line.trim().endsWith(':') || line.trim().toUpperCase() === line.trim()) {
          pdf.setFont('helvetica', 'bold');
        } else {
          pdf.setFont('helvetica', 'normal');
        }

        const splitLines = pdf.splitTextToSize(line || ' ', pageWidth - 30);
        pdf.text(splitLines, 15, yPos);
        yPos += (splitLines.length * 5);
      });
    }

    // Footer on last page
    yPos = pageHeight - 30;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Discharging Doctor: ${discharge.discharging_doctor}`, 15, yPos);
    if (discharge.discharging_consultant) {
      yPos += 6;
      pdf.text(`Consultant: ${discharge.discharging_consultant}`, 15, yPos);
    }
    yPos += 6;
    pdf.text(`Date Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 15, yPos);

    // Save with patient name
    const fileName = `Discharge_Summary_${discharge.patient_name.replace(/\s+/g, '_')}_${format(discharge.discharge_date, 'yyyyMMdd')}.pdf`;
    pdf.save(fileName);
  }

  // Delete discharge
  async deleteDischarge(id: number): Promise<void> {
    await db.discharges.delete(id);
  }
}

export const dischargeService = new DischargeService();
