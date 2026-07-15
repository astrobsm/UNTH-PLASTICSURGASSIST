import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import {
  createPDF,
  PDF_COLORS,
  PDF_INSTITUTION,
  PDF_MARGINS,
  sanitizeTextForPDF,
} from '../utils/pdfUtils';

export interface AppointmentPdfRow {
  id: number;
  patient_number: string;
  patient_name?: string;
  phone_number?: string;
  appointment_date: string;
  time_slot: string;
  doctor_assigned: string;
  status: string;
  station_number?: number;
  category?: string;
  priority?: number;
}

interface PatientLike {
  hospital_number?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  date_of_birth?: string;
  dob?: string;
  gender?: string;
  sex?: string;
  primary_diagnosis?: string;
  diagnosis?: string;
  ward?: string;
}

export interface AppointmentSchedulePdfOptions {
  appointments: AppointmentPdfRow[];
  patients?: PatientLike[];
  selectedDate: string;
  generatedBy?: string;
  orientation?: 'portrait' | 'landscape';
  consultantFilter?: string;
  statusFilter?: string;
  clinicName?: string;
  clinicLocation?: string;
}

function formatTime(slot: string) {
  const [start, end] = String(slot || '').split('-');
  const fmt = (t: string) => {
    const [h, m] = String(t || '').split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return t || '';
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  };
  return end ? `${fmt(start)} - ${fmt(end)}` : fmt(start);
}

function calculateAge(patient?: PatientLike) {
  const rawDate = patient?.date_of_birth || patient?.dob;
  if (!rawDate) return '';
  const birthDate = new Date(rawDate);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDelta = today.getMonth() - birthDate.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

function normalizeStatus(status: string) {
  const map: Record<string, string> = {
    booked: 'Waiting',
    'checked-in': 'Waiting',
    'in-progress': 'Seen',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'no-show': 'No Show',
    rescheduled: 'Rescheduled',
  };
  return map[status] || status.replace(/-/g, ' ');
}

function normalizeVisitType(category?: string) {
  const value = String(category || '').toLowerCase();
  if (value.includes('wound') || value.includes('dressing')) return 'Dressing';
  if (value.includes('procedure')) return 'Procedure';
  if (value.includes('mdt')) return 'MDT';
  if (value.includes('follow') || value.includes('review')) return 'Review';
  if (value.includes('new')) return 'New';
  if (value.includes('surgery')) return 'Procedure';
  return category || 'Review';
}

function findPatient(appointment: AppointmentPdfRow, patientIndex: Map<string, PatientLike>) {
  const key = String(appointment.patient_number || '').trim().toLowerCase();
  return key ? patientIndex.get(key) : undefined;
}

function countByVisitType(appointments: AppointmentPdfRow[], type: string) {
  return appointments.filter(a => normalizeVisitType(a.category).toLowerCase() === type.toLowerCase()).length;
}

export function exportAppointmentSchedulePdf(options: AppointmentSchedulePdfOptions) {
  const {
    appointments,
    patients = [],
    selectedDate,
    generatedBy = 'Unknown user',
    orientation = 'landscape',
    consultantFilter,
    statusFilter,
    clinicName = 'Plastic Surgery Clinic',
    clinicLocation = 'Plastic Surgery Outpatient Clinic',
  } = options;

  const doc = createPDF(orientation);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const generatedAt = new Date();
  const dateObj = new Date(`${selectedDate}T00:00:00`);
  const selectedDateText = Number.isNaN(dateObj.getTime())
    ? selectedDate
    : format(dateObj, 'dd MMMM yyyy');
  const selectedDayText = Number.isNaN(dateObj.getTime())
    ? ''
    : format(dateObj, 'EEEE');

  const patientIndex = new Map<string, PatientLike>();
  patients.forEach(patient => {
    const key = String(patient.hospital_number || '').trim().toLowerCase();
    if (key) patientIndex.set(key, patient);
  });

  doc.setFont('times', 'bold');
  doc.setFontSize(14);
  doc.text('LOGO', PDF_MARGINS.left, 14);
  doc.text(sanitizeTextForPDF(PDF_INSTITUTION.name), pageWidth / 2, 14, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('times', 'normal');
  doc.text(sanitizeTextForPDF(PDF_INSTITUTION.department), pageWidth / 2, 20, { align: 'center' });
  doc.text(sanitizeTextForPDF(clinicName), pageWidth / 2, 25, { align: 'center' });
  doc.setFont('times', 'bold');
  doc.setFontSize(15);
  doc.text('Appointment Schedule', pageWidth / 2, 33, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(9);
  const metaRows = [
    `Selected Date: ${selectedDateText}`,
    selectedDayText ? `Day: ${selectedDayText}` : '',
    `Time Generated: ${format(generatedAt, 'dd MMM yyyy, HH:mm')}`,
    `Generated By: ${generatedBy}`,
    consultantFilter ? `Consultant Filter: ${consultantFilter}` : 'Consultant Filter: All consultants',
    statusFilter ? `Status Filter: ${normalizeStatus(statusFilter)}` : 'Status Filter: All statuses',
  ].filter(Boolean);
  metaRows.forEach((row, index) => {
    doc.text(sanitizeTextForPDF(row), PDF_MARGINS.left, 42 + index * 5);
  });

  const body = appointments
    .slice()
    .sort((a, b) => String(a.time_slot || '').localeCompare(String(b.time_slot || '')))
    .map((appointment, index) => {
      const patient = findPatient(appointment, patientIndex);
      const patientName = appointment.patient_name || patient?.full_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim();
      return [
        String(index + 1),
        formatTime(appointment.time_slot),
        appointment.patient_number || '',
        patientName || 'Not recorded',
        calculateAge(patient),
        patient?.gender || patient?.sex || '',
        appointment.phone_number || '',
        patient?.primary_diagnosis || patient?.diagnosis || '',
        appointment.category || '',
        normalizeVisitType(appointment.category),
        appointment.doctor_assigned || '',
        '',
        '',
        '',
        clinicLocation,
        normalizeStatus(appointment.status),
        appointment.status === 'no-show' ? 'Patient did not attend' : '',
      ].map(value => sanitizeTextForPDF(String(value || '')));
    });

  autoTable(doc, {
    startY: 75,
    head: [[
      '#', 'Time', 'Hospital No.', 'Patient Name', 'Age', 'Sex', 'Phone', 'Diagnosis',
      'Reason', 'Visit Type', 'Consultant', 'SR', 'Registrar', 'HO', 'Location', 'Status', 'Notes'
    ]],
    body,
    styles: {
      font: 'times',
      fontSize: orientation === 'landscape' ? 7 : 6,
      cellPadding: 1.2,
      overflow: 'linebreak',
      textColor: [0, 0, 0],
      lineColor: [180, 180, 180],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: PDF_MARGINS.left, right: PDF_MARGINS.right, top: 75, bottom: 25 },
    didDrawPage: (data) => {
      doc.setFont('times', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(90);
      doc.text('Generated by Plastic Surgeon Assistant', PDF_MARGINS.left, pageHeight - 14);
      doc.text(format(generatedAt, 'dd MMM yyyy, HH:mm'), pageWidth / 2, pageHeight - 14, { align: 'center' });
      doc.text(`Page ${data.pageNumber}`, pageWidth - PDF_MARGINS.right, pageHeight - 14, { align: 'right' });
      doc.setFont('times', 'bold');
      doc.text('Confidential Clinical Document', pageWidth / 2, pageHeight - 8, { align: 'center' });
      doc.setTextColor(0);
    },
  });

  const finalY = ((doc as any).lastAutoTable?.finalY || 75) + 10;
  const summary = [
    ['Total Appointments', appointments.length],
    ['New Patients', countByVisitType(appointments, 'New')],
    ['Review Patients', countByVisitType(appointments, 'Review')],
    ['Procedures', countByVisitType(appointments, 'Procedure')],
    ['Dressings', countByVisitType(appointments, 'Dressing')],
    ['Cancelled', appointments.filter(a => a.status === 'cancelled').length],
    ['Rescheduled', appointments.filter(a => a.status === 'rescheduled').length],
    ['No Shows', appointments.filter(a => a.status === 'no-show').length],
    ['Completed', appointments.filter(a => a.status === 'completed').length],
  ];

  autoTable(doc, {
    startY: finalY > pageHeight - 65 ? undefined : finalY,
    head: [['Summary', 'Count']],
    body: summary.map(([label, count]) => [String(label), String(count)]),
    styles: { font: 'times', fontSize: 9, cellPadding: 1.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [PDF_COLORS.primary.r, PDF_COLORS.primary.g, PDF_COLORS.primary.b], textColor: [255, 255, 255] },
    margin: { left: PDF_MARGINS.left, right: pageWidth - PDF_MARGINS.left - 80, bottom: 25 },
  });

  doc.save(`appointment-schedule-${selectedDate}.pdf`);
}