import { db } from '../db/database';
import html2canvas from 'html2canvas';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { apiClient } from './apiClient';
import { syncService } from '../db/syncService';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  addFooter
} from '../utils/pdfUtils';

// Scheduling Interfaces
export interface WardRound {
  id: string;
  date: Date;
  ward_name: string;
  start_time: string;
  end_time: string;
  consultant: string;
  registrar?: string;
  intern?: string;
  patients: WardRoundPatient[];
  notes: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export interface WardRoundPatient {
  patient_id: string;
  patient_name: string;
  bed_number: string;
  diagnosis: string;
  priority: 'routine' | 'urgent' | 'critical';
  post_op_day?: number;
  notes: string;
  tasks: string[];
  seen: boolean;
  seen_time?: Date;
}

export interface ClinicSession {
  id: string;
  date: Date;
  clinic_type: 'general_plastic' | 'reconstructive' | 'aesthetic' | 'hand_surgery' | 'burn_clinic' | 'follow_up';
  location: string;
  start_time: string;
  end_time: string;
  consultant: string;
  max_patients: number;
  appointments: ClinicAppointment[];
  // Task assignments for clinic staff
  task_assignments?: ClinicTaskAssignment[];
  notes: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_at: Date;
  updated_at: Date;
}

export type ClinicTaskType = 
  | 'surgery_scheduling'
  | 'clerking_new_patients'
  | 'follow_up_old_patients'
  | 'wound_dressing_supervision'
  | 'intralesional_injection'
  | 'prescription_writing'
  | 'surgical_shopping_list'
  | 'documentation';

export interface ClinicTaskAssignment {
  id: string;
  task_type: ClinicTaskType;
  task_description: string;
  assigned_to: string; // Doctor name
  assigned_role: 'consultant' | 'senior_registrar' | 'registrar' | 'house_officer';
  priority: 'low' | 'medium' | 'high';
  estimated_duration_minutes?: number;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at?: Date;
  notes?: string;
}

export interface ClinicAppointment {
  id: string;
  patient_id: string;
  patient_name: string;
  appointment_time: string;
  appointment_type: 'new_patient' | 'follow_up' | 'pre_op' | 'post_op' | 'consultation';
  chief_complaint: string;
  duration_minutes: number;
  priority: 'routine' | 'urgent' | 'emergency';
  // Assigned tasks for this appointment
  assigned_tasks?: ClinicTaskType[];
  assigned_doctor?: string;
  assigned_role?: 'consultant' | 'senior_registrar' | 'registrar' | 'house_officer';
  notes: string;
  status: 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'no_show' | 'cancelled';
  arrival_time?: Date;
  completion_time?: Date;
}

export interface SurgeryBooking {
  id: string;
  date: Date;
  theatre_number: string;
  start_time: string;
  estimated_end_time: string;
  actual_end_time?: string;
  primary_surgeon: string;
  assistant_surgeon?: string;
  anaesthetist: string;
  scrub_nurse: string;
  circulating_nurse: string;
  patient_id: string;
  patient_name: string;
  // Added patient demographic snapshot for booking form requirements
  hospital_number?: string; // PT-NUMBER
  patient_age?: number;
  patient_gender?: string;
  indication?: string; // surgical indication
  ward?: string; // current ward
  procedure_name: string;
  procedure_code: string;
  urgency: 'elective' | 'urgent' | 'emergency';
  anaesthesia_type: 'general' | 'regional' | 'local' | 'sedation';
  estimated_duration_minutes: number;
  // Remarks checklist selections (crossmatch blood, diathermy etc.)
  remarks?: string[];
  // Expanded team of surgeons (primary + assistants)
  surgeon_team?: string[];
  // Hierarchical surgical team structure
  consultants?: string[];
  senior_registrars?: string[];
  registrars?: string[];
  house_officers?: string[];
  // Operation site images (multiple, JSON stringified array of base64)
  operation_site_image?: string; // Kept for backward compatibility
  operation_site_images?: string; // JSON array of base64 images
  xray_images?: string; // JSON array of X-ray/CT images for surgical planning
  // Clinical condition change documentation
  clinical_condition_change?: string;
  clinical_condition_date?: string;
  special_requirements: string[];
  equipment_needed: string[];
  implants_needed: string[];
  blood_type?: string;
  allergies: string[];
  medical_conditions: string[];
  pre_op_checklist_completed: boolean;
  consent_obtained: boolean;
  notes: string;
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'postponed';
  created_at: Date;
  updated_at: Date;
}

export interface OperationList {
  id: string;
  date: Date;
  theatre_complex: string;
  generated_at: Date;
  generated_by: string;
  surgeries: SurgeryBooking[];
  total_cases: number;
  estimated_total_time: number;
  notes: string;
}

class SchedulingService {
  // Ward Rounds Management
  async createWardRound(wardRound: Omit<WardRound, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = `ward_round_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newWardRound: WardRound = {
      ...wardRound,
      id,
      created_at: now,
      updated_at: now
    };

    await db.ward_rounds.add(newWardRound);
    return id;
  }

  async getWardRounds(date?: Date): Promise<WardRound[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return await db.ward_rounds
        .where('date')
        .between(startOfDay, endOfDay)
        .toArray();
    }
    
    return await db.ward_rounds.orderBy('date').toArray();
  }

  async updateWardRoundStatus(id: string, status: WardRound['status']): Promise<void> {
    await db.ward_rounds.update(id, { status, updated_at: new Date() });
  }

  async markPatientSeen(wardRoundId: string, patientId: string): Promise<void> {
    const wardRound = await db.ward_rounds.get(wardRoundId);
    if (wardRound) {
      const updatedPatients = wardRound.patients.map(patient => 
        patient.patient_id === patientId 
          ? { ...patient, seen: true, seen_time: new Date() }
          : patient
      );
      await db.ward_rounds.update(wardRoundId, { 
        patients: updatedPatients, 
        updated_at: new Date() 
      });
    }
  }

  // Clinic Sessions Management
  async createClinicSession(session: Omit<ClinicSession, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = `clinic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newSession: ClinicSession = {
      ...session,
      id,
      created_at: now,
      updated_at: now
    };

    await db.clinic_sessions.add(newSession);
    return id;
  }

  async getClinicSessions(date?: Date): Promise<ClinicSession[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      return await db.clinic_sessions
        .where('date')
        .between(startOfDay, endOfDay)
        .toArray();
    }
    
    return await db.clinic_sessions.orderBy('date').toArray();
  }

  async addAppointmentToClinic(sessionId: string, appointment: Omit<ClinicAppointment, 'id'>): Promise<string> {
    const session = await db.clinic_sessions.get(sessionId);
    if (!session) throw new Error('Clinic session not found');
    
    if (session.appointments.length >= session.max_patients) {
      throw new Error('Clinic is fully booked');
    }
    
    const appointmentId = `appt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newAppointment: ClinicAppointment = {
      ...appointment,
      id: appointmentId
    };
    
    const updatedAppointments = [...session.appointments, newAppointment];
    await db.clinic_sessions.update(sessionId, {
      appointments: updatedAppointments,
      updated_at: new Date()
    });
    
    return appointmentId;
  }

  async updateAppointmentStatus(sessionId: string, appointmentId: string, status: ClinicAppointment['status']): Promise<void> {
    const session = await db.clinic_sessions.get(sessionId);
    if (session) {
      const updatedAppointments = session.appointments.map(apt =>
        apt.id === appointmentId 
          ? { ...apt, status, ...(status === 'arrived' ? { arrival_time: new Date() } : {}) }
          : apt
      );
      await db.clinic_sessions.update(sessionId, {
        appointments: updatedAppointments,
        updated_at: new Date()
      });
    }
  }

  // Surgery Booking Management
  async createSurgeryBooking(booking: Omit<SurgeryBooking, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    const id = `surgery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const newBooking: SurgeryBooking = {
      ...booking,
      id,
      created_at: now,
      updated_at: now
    };

    // Try to sync to server first
    try {
      const saved = await apiClient.createSurgery(newBooking);
      console.log('âœ… Surgery booking synced to server:', saved.id);
      await db.surgery_bookings.add({ ...newBooking, id: saved.id, synced: true });
      return saved.id;
    } catch (error) {
      console.warn('âš ï¸ Failed to sync surgery booking to server, saving locally', error);
      await db.surgery_bookings.add({ ...newBooking, synced: false });
      await syncService.queueAction('create', 'surgeries', id, newBooking);
      console.log('ðŸ“± Surgery booking saved locally, will sync when online:', id);
      return id;
    }
  }

  async getSurgeryBookings(date?: Date): Promise<SurgeryBooking[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      const surgeries = await db.surgery_bookings
        .where('date')
        .between(startOfDay, endOfDay)
        .toArray();
      
      // Sort manually since Dexie doesn't support orderBy after where clause
      return surgeries.sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
    
    return await db.surgery_bookings.orderBy('date').toArray();
  }

  async updateSurgeryStatus(id: string, status: SurgeryBooking['status']): Promise<void> {
    await db.surgery_bookings.update(id, { status, updated_at: new Date() });
  }

  // Operation List Generation
  async generateOperationList(date: Date, theatreComplex: string): Promise<OperationList> {
    const surgeries = await this.getSurgeryBookings(date);
    const filteredSurgeries = surgeries.filter(s => 
      s.status === 'scheduled' || s.status === 'confirmed'
    );
    
    const totalCases = filteredSurgeries.length;
    const estimatedTotalTime = filteredSurgeries.reduce((total, surgery) => 
      total + surgery.estimated_duration_minutes, 0
    );
    
    const operationList: OperationList = {
      id: `op_list_${Date.now()}`,
      date,
      theatre_complex: theatreComplex,
      generated_at: new Date(),
      generated_by: 'System', // Should be current user
      surgeries: filteredSurgeries,
      total_cases: totalCases,
      estimated_total_time: estimatedTotalTime,
      notes: ''
    };
    
    return operationList;
  }

  async generateOperationListPDF(operationList: OperationList): Promise<void> {
    // Create landscape PDF for comprehensive information display
    const pdf = createPDF('landscape');
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = PDF_MARGINS.left;
    
    // Helper to sanitize text
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');
    
    // Header Section
    pdf.setFontSize(18);
    pdf.setFont('times', 'bold');
    pdf.text('OPERATION LIST', pageWidth / 2, 15, { align: 'center' });
    
    // Date and Theatre Info
    pdf.setFontSize(PDF_FONT_SIZES.body);
    pdf.setFont('times', 'normal');
    pdf.text('Date: ' + format(operationList.date, 'EEEE, MMMM d, yyyy'), margin, 25);
    pdf.text('Theatre Complex: ' + clean(operationList.theatre_complex), margin, 30);
    pdf.text('Generated: ' + format(operationList.generated_at, 'HH:mm dd/MM/yyyy'), pageWidth - margin - 60, 25);
    pdf.text('Total Cases: ' + operationList.total_cases, pageWidth - margin - 60, 30);
    pdf.text('Est. Total Time: ' + Math.floor(operationList.estimated_total_time / 60) + 'h ' + (operationList.estimated_total_time % 60) + 'm', pageWidth - margin - 60, 35);
    
    // Horizontal line
    pdf.setDrawColor(0, 0, 0);
    pdf.line(margin, 38, pageWidth - margin, 38);
    
    let yPosition = 45;
    
    // Process each surgery
    operationList.surgeries.forEach((surgery, index) => {
      // Check if we need a new page (reserve space for surgery entry)
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = 15;
      }
      
      // Surgery number and urgency badge
      pdf.setFontSize(PDF_FONT_SIZES.subHeader);
      pdf.setFont('times', 'bold');
      pdf.text('Case ' + (index + 1), margin, yPosition);
      
      // Urgency badge with color
      const urgencyColor = 
        surgery.urgency === 'emergency' ? [PDF_COLORS.danger.r, PDF_COLORS.danger.g, PDF_COLORS.danger.b] :
        surgery.urgency === 'urgent' ? [PDF_COLORS.warning.r, PDF_COLORS.warning.g, PDF_COLORS.warning.b] :
        [PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b];
      pdf.setFillColor(urgencyColor[0], urgencyColor[1], urgencyColor[2]);
      pdf.setTextColor(255, 255, 255);
      pdf.rect(margin + 18, yPosition - 4, 20, 5, 'F');
      pdf.setFontSize(8);
      pdf.text(surgery.urgency.toUpperCase(), margin + 28, yPosition, { align: 'center' });
      pdf.setTextColor(0, 0, 0);
      
      yPosition += 6;
      
      // Patient Information Section
      pdf.setFontSize(9);
      pdf.setFont('times', 'bold');
      pdf.text('PATIENT:', margin, yPosition);
      pdf.setFont('times', 'normal');
      
      const patientInfo: string[] = [];
      patientInfo.push(surgery.patient_name || 'N/A');
      if (surgery.hospital_number) patientInfo.push(`#${surgery.hospital_number}`);
      if (surgery.patient_age) patientInfo.push(`${surgery.patient_age}y`);
      if (surgery.patient_gender) patientInfo.push(surgery.patient_gender);
      if (surgery.ward) patientInfo.push(`Ward: ${surgery.ward}`);
      
      pdf.text(patientInfo.join(' | '), margin + 20, yPosition);
      yPosition += 5;
      
      // Procedure Information
      pdf.setFont('times', 'bold');
      pdf.text('PROCEDURE:', margin, yPosition);
      pdf.setFont('times', 'normal');
      pdf.text(surgery.procedure_name || 'N/A', margin + 25, yPosition);
      
      if (surgery.indication) {
        yPosition += 5;
        pdf.setFont('times', 'bold');
        pdf.text('INDICATION:', margin, yPosition);
        pdf.setFont('times', 'normal');
        const indication = surgery.indication.length > 80 ? surgery.indication.substring(0, 77) + '...' : surgery.indication;
        pdf.text(indication, margin + 25, yPosition);
      }
      
      yPosition += 6;
      
      // Time and Duration
      pdf.setFont('times', 'bold');
      pdf.text('TIME:', margin, yPosition);
      pdf.setFont('times', 'normal');
      pdf.text(`${surgery.start_time} (Est. ${surgery.estimated_duration_minutes} min)`, margin + 15, yPosition);
      
      pdf.setFont('times', 'bold');
      pdf.text('THEATRE:', margin + 80, yPosition);
      pdf.setFont('times', 'normal');
      pdf.text(surgery.theatre_number || 'TBD', margin + 95, yPosition);
      
      pdf.setFont('times', 'bold');
      pdf.text('ANAESTHESIA:', margin + 130, yPosition);
      pdf.setFont('times', 'normal');
      pdf.text(surgery.anaesthesia_type || 'N/A', margin + 155, yPosition);
      
      yPosition += 6;
      
      // Hierarchical Surgical Team Section
      pdf.setFont('times', 'bold');
      pdf.text('SURGICAL TEAM:', margin, yPosition);
      pdf.setFont('times', 'normal');
      
      const hierarchicalTeam: string[] = [];
      
      // Add consultants
      if (surgery.consultants && surgery.consultants.length > 0) {
        hierarchicalTeam.push(`Consultants: ${surgery.consultants.join(', ')}`);
      }
      
      // Add senior registrars
      if (surgery.senior_registrars && surgery.senior_registrars.length > 0) {
        hierarchicalTeam.push(`Sr. Registrars: ${surgery.senior_registrars.join(', ')}`);
      }
      
      // Add registrars
      if (surgery.registrars && surgery.registrars.length > 0) {
        hierarchicalTeam.push(`Registrars: ${surgery.registrars.join(', ')}`);
      }
      
      // Add house officers
      if (surgery.house_officers && surgery.house_officers.length > 0) {
        hierarchicalTeam.push(`House Officers: ${surgery.house_officers.join(', ')}`);
      }
      
      // Fallback to legacy team structure if hierarchical not present
      if (hierarchicalTeam.length === 0) {
        if (surgery.primary_surgeon) hierarchicalTeam.push(`Primary: ${surgery.primary_surgeon}`);
        if (surgery.assistant_surgeon) hierarchicalTeam.push(`Asst: ${surgery.assistant_surgeon}`);
        if (surgery.surgeon_team && surgery.surgeon_team.length > 0) {
          const additionalSurgeons = surgery.surgeon_team.filter(s => s !== surgery.primary_surgeon && s !== surgery.assistant_surgeon);
          if (additionalSurgeons.length > 0) {
            hierarchicalTeam.push(`Team: ${additionalSurgeons.join(', ')}`);
          }
        }
      }
      
      if (surgery.anaesthetist) hierarchicalTeam.push(`Anaesthetist: ${surgery.anaesthetist}`);
      
      const teamText = hierarchicalTeam.join(' | ');
      const maxTeamWidth = pageWidth - margin * 2 - 35;
      const teamLines = pdf.splitTextToSize(teamText, maxTeamWidth);
      pdf.text(teamLines, margin + 35, yPosition);
      yPosition += (teamLines.length * 4) + 2;
      
      // Nursing Staff
      if (surgery.scrub_nurse || surgery.circulating_nurse) {
        pdf.setFont('times', 'bold');
        pdf.text('NURSES:', margin, yPosition);
        pdf.setFont('times', 'normal');
        const nurses: string[] = [];
        if (surgery.scrub_nurse) nurses.push(`Scrub: ${surgery.scrub_nurse}`);
        if (surgery.circulating_nurse) nurses.push(`Circulating: ${surgery.circulating_nurse}`);
        pdf.text(nurses.join(' | '), margin + 20, yPosition);
        yPosition += 5;
      }
      
      // Remarks/Special Requirements
      if (surgery.remarks && surgery.remarks.length > 0) {
        pdf.setFont('times', 'bold');
        pdf.text('REMARKS:', margin, yPosition);
        pdf.setFont('times', 'normal');
        pdf.text(surgery.remarks.join(', '), margin + 22, yPosition);
        yPosition += 5;
      }
      
      // Special Requirements, Equipment, Implants
      const specialItems: string[] = [];
      if (surgery.special_requirements && surgery.special_requirements.length > 0) {
        specialItems.push(`Special: ${surgery.special_requirements.join(', ')}`);
      }
      if (surgery.equipment_needed && surgery.equipment_needed.length > 0) {
        specialItems.push(`Equipment: ${surgery.equipment_needed.join(', ')}`);
      }
      if (surgery.implants_needed && surgery.implants_needed.length > 0) {
        specialItems.push(`Implants: ${surgery.implants_needed.join(', ')}`);
      }
      
      if (specialItems.length > 0) {
        pdf.setFont('times', 'bold');
        pdf.text('REQUIREMENTS:', margin, yPosition);
        pdf.setFont('times', 'normal');
        const reqText = specialItems.join(' | ');
        const reqLines = pdf.splitTextToSize(reqText, pageWidth - margin * 2 - 30);
        pdf.text(reqLines, margin + 32, yPosition);
        yPosition += (reqLines.length * 4) + 2;
      }
      
      // Medical Information
      const medicalInfo: string[] = [];
      if (surgery.blood_type) medicalInfo.push(`Blood: ${surgery.blood_type}`);
      if (surgery.allergies && surgery.allergies.length > 0) medicalInfo.push(`Allergies: ${surgery.allergies.join(', ')}`);
      if (surgery.medical_conditions && surgery.medical_conditions.length > 0) {
        medicalInfo.push(`Conditions: ${surgery.medical_conditions.join(', ')}`);
      }
      
      if (medicalInfo.length > 0) {
        pdf.setFontSize(8);
        pdf.setFont('times', 'bold');
        pdf.text('MEDICAL:', margin, yPosition);
        pdf.setFont('times', 'normal');
        const medText = medicalInfo.join(' | ');
        const medLines = pdf.splitTextToSize(medText, pageWidth - margin * 2 - 20);
        pdf.text(medLines, margin + 18, yPosition);
        yPosition += (medLines.length * 3.5) + 1;
        pdf.setFontSize(9);
      }
      
      // Checklist Status
      const checklistItems: string[] = [];
      if (surgery.pre_op_checklist_completed) checklistItems.push('âœ“ Pre-op');
      if (surgery.consent_obtained) checklistItems.push('âœ“ Consent');
      
      if (checklistItems.length > 0) {
        pdf.setFontSize(8);
        pdf.setTextColor(34, 197, 94);
        pdf.text(checklistItems.join('  '), margin, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 4;
        pdf.setFontSize(9);
      }
      
      // Notes
      if (surgery.notes) {
        pdf.setFont('times', 'italic');
        pdf.setFontSize(8);
        const notesText = surgery.notes.length > 120 ? surgery.notes.substring(0, 117) + '...' : surgery.notes;
        const notesLines = pdf.splitTextToSize(`Notes: ${notesText}`, pageWidth - margin * 2);
        pdf.text(notesLines, margin, yPosition);
        yPosition += (notesLines.length * 3.5) + 2;
        pdf.setFontSize(9);
        pdf.setFont('times', 'normal');
      }
      
      // Separator line between surgeries
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;
    });
    
    // Add professional footer with page numbers and timestamp
    addFooter(pdf);
    
    // Save the PDF
    pdf.save(`Operation_List_${format(operationList.date, 'yyyy-MM-dd')}.pdf`);
  }

  // Utility Methods
  async getWeeklySchedule(date: Date): Promise<{
    wardRounds: WardRound[];
    clinics: ClinicSession[];
    surgeries: SurgeryBooking[];
  }> {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
    
    const wardRounds = await db.ward_rounds
      .where('date')
      .between(weekStart, weekEnd)
      .toArray();
      
    const clinics = await db.clinic_sessions
      .where('date')
      .between(weekStart, weekEnd)
      .toArray();
      
    const surgeries = await db.surgery_bookings
      .where('date')
      .between(weekStart, weekEnd)
      .toArray();
    
    return { wardRounds, clinics, surgeries };
  }

  async getSchedulingStats(startDate: Date, endDate: Date): Promise<{
    totalWardRounds: number;
    totalClinicSessions: number;
    totalSurgeries: number;
    completedWardRounds: number;
    completedClinics: number;
    completedSurgeries: number;
  }> {
    const wardRounds = await db.ward_rounds
      .where('date')
      .between(startDate, endDate)
      .toArray();
      
    const clinics = await db.clinic_sessions
      .where('date')
      .between(startDate, endDate)
      .toArray();
      
    const surgeries = await db.surgery_bookings
      .where('date')
      .between(startDate, endDate)
      .toArray();
    
    return {
      totalWardRounds: wardRounds.length,
      totalClinicSessions: clinics.length,
      totalSurgeries: surgeries.length,
      completedWardRounds: wardRounds.filter(wr => wr.status === 'completed').length,
      completedClinics: clinics.filter(c => c.status === 'completed').length,
      completedSurgeries: surgeries.filter(s => s.status === 'completed').length
    };
  }
}

export const schedulingService = new SchedulingService();
