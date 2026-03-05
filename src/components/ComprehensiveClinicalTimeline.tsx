import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  FileText,
  Pill,
  LogOut,
  LogIn,
  TestTube,
  Scissors,
  Heart,
  Clock,
  User,
  Download,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Stethoscope,
  Shield,
  ClipboardList,
  Syringe,
  FlaskConical,
  RefreshCw,
  Flame,
  Footprints,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  LayoutList
} from 'lucide-react';

// Services
import { labService } from '../services/labService';
import { admissionDischargeService } from '../services/admissionDischargeService';
import { riskAssessmentService } from '../services/riskAssessmentService';
import { preoperativeService } from '../services/preoperativeService';
import { wardRoundsService } from '../services/wardRoundsService';
import { diabeticFootService } from '../services/diabeticFootService';
import { apiClient } from '../services/apiClient';
import { db } from '../db/database';

// ─── Types ─────────────────────────────────────────────────────

export type TimelineEventType =
  | 'progress_note'
  | 'prescription'
  | 'investigation'
  | 'lab_result'
  | 'admission'
  | 'discharge'
  | 'surgery'
  | 'procedure'
  | 'risk_assessment'
  | 'preop_assessment'
  | 'ward_round'
  | 'wound_care'
  | 'treatment_plan'
  | 'burn_care'
  | 'diabetic_foot'
  | 'vital_signs'
  | 'transfer';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: Date;
  title: string;
  subtitle?: string;
  description: string;
  details?: Record<string, any>;
  author?: string;
  authorRole?: string;
  status?: string;
  severity?: 'normal' | 'warning' | 'critical' | 'success';
  tags?: string[];
}

interface ComprehensiveClinicalTimelineProps {
  patientId: string;
  hospitalNumber: string;
}

// ─── Helpers ───────────────────────────────────────────────────

function safeDate(value: any): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return isValid(value) ? value : new Date(0);
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : new Date(0);
}

function fmtDate(d: Date): string {
  return isValid(d) && d.getTime() > 0 ? format(d, 'MMM d, yyyy HH:mm') : 'Date unknown';
}

function fmtDateShort(d: Date): string {
  return isValid(d) && d.getTime() > 0 ? format(d, 'MMM d, yyyy') : '—';
}

function truncate(s: string, len = 200): string {
  return s.length > len ? s.slice(0, len) + '…' : s;
}

// ─── Event styling maps ────────────────────────────────────────

const EVENT_META: Record<TimelineEventType, {
  icon: React.ElementType;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
}> = {
  progress_note: {
    icon: FileText,
    label: 'Progress Note',
    bgColor: 'bg-purple-50',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
  },
  prescription: {
    icon: Pill,
    label: 'Prescription',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
  },
  investigation: {
    icon: FlaskConical,
    label: 'Investigation',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-200',
    dotColor: 'bg-cyan-500',
  },
  lab_result: {
    icon: TestTube,
    label: 'Lab Result',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
    dotColor: 'bg-teal-500',
  },
  admission: {
    icon: LogIn,
    label: 'Admission',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    dotColor: 'bg-indigo-500',
  },
  discharge: {
    icon: LogOut,
    label: 'Discharge',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
  },
  surgery: {
    icon: Scissors,
    label: 'Surgery',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
    dotColor: 'bg-pink-500',
  },
  procedure: {
    icon: Syringe,
    label: 'Procedure',
    bgColor: 'bg-fuchsia-50',
    textColor: 'text-fuchsia-700',
    borderColor: 'border-fuchsia-200',
    dotColor: 'bg-fuchsia-500',
  },
  risk_assessment: {
    icon: AlertTriangle,
    label: 'Risk Assessment',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200',
    dotColor: 'bg-yellow-500',
  },
  preop_assessment: {
    icon: ClipboardList,
    label: 'Pre-op Assessment',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
  },
  ward_round: {
    icon: Stethoscope,
    label: 'Ward Round',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
  },
  wound_care: {
    icon: Shield,
    label: 'Wound Care',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
  },
  treatment_plan: {
    icon: ClipboardList,
    label: 'Treatment Plan',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  burn_care: {
    icon: Flame,
    label: 'Burn Care',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    dotColor: 'bg-rose-500',
  },
  diabetic_foot: {
    icon: Footprints,
    label: 'Diabetic Foot',
    bgColor: 'bg-lime-50',
    textColor: 'text-lime-700',
    borderColor: 'border-lime-200',
    dotColor: 'bg-lime-500',
  },
  vital_signs: {
    icon: Heart,
    label: 'Vital Signs',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    dotColor: 'bg-rose-400',
  },
  transfer: {
    icon: ArrowRightLeft,
    label: 'Transfer',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-200',
    dotColor: 'bg-sky-500',
  },
};

// ─── Data Fetchers ─────────────────────────────────────────────

async function fetchProgressNotes(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    // Try API first
    const notes = await apiClient.getProgressNotes(patientId);
    if (Array.isArray(notes)) {
      for (const n of notes) {
        const soap = n.soap || {};
        events.push({
          id: `pn_${n.id || n.created_at}`,
          type: 'progress_note',
          date: safeDate(n.date || n.created_at),
          title: 'Progress Note (SOAP)',
          subtitle: n.author ? `By ${n.author}` : undefined,
          description: soap.assessment
            ? `Assessment: ${truncate(soap.assessment)}`
            : truncate(n.notes || n.description || 'SOAP note recorded'),
          details: {
            subjective: soap.subjective,
            objective: soap.objective,
            assessment: soap.assessment,
            plan: soap.plan,
            vital_signs: n.vital_signs,
            lmp: n.lmp,
          },
          author: n.author || n.author_name,
          authorRole: n.author_role,
          tags: ['SOAP'],
        });
      }
    }
  } catch {
    // Fallback to IndexedDB
    try {
      if ((db as any).progress_notes) {
        const local = await (db as any).progress_notes
          .filter((n: any) => String(n.patient_id) === String(patientId))
          .toArray();
        for (const n of local) {
          const soap = n.soap || {};
          events.push({
            id: `pn_local_${n.id || n.created_at}`,
            type: 'progress_note',
            date: safeDate(n.date || n.created_at),
            title: 'Progress Note (SOAP)',
            subtitle: n.author ? `By ${n.author}` : undefined,
            description: soap.assessment
              ? `Assessment: ${truncate(soap.assessment)}`
              : 'SOAP note recorded',
            details: { ...soap, vital_signs: n.vital_signs, lmp: n.lmp },
            author: n.author,
            authorRole: n.author_role,
            tags: ['SOAP'],
          });
        }
      }
    } catch { /* ignore */ }
  }
  return events;
}

async function fetchInvestigationsAndResults(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const investigations = await labService.getLabInvestigations(patientId);
    for (const inv of investigations) {
      if (String(inv.patient_id) !== String(patientId)) continue;
      const testNames = (inv.tests || []).map((t: any) => t.test_name).filter(Boolean).join(', ');
      events.push({
        id: `inv_${inv.id}`,
        type: 'investigation',
        date: safeDate(inv.request_date || inv.created_at),
        title: `Lab Investigation — ${inv.urgency?.toUpperCase() || 'Routine'}`,
        subtitle: testNames || undefined,
        description: `${(inv.tests || []).length} test(s) ordered: ${testNames || 'N/A'}. Indication: ${inv.clinical_indication || 'N/A'}`,
        details: {
          tests: inv.tests,
          urgency: inv.urgency,
          status: inv.status,
          clinical_indication: inv.clinical_indication,
          collection_date: inv.collection_date,
          special_instructions: inv.special_instructions,
        },
        author: inv.requested_by,
        status: inv.status,
        severity: inv.urgency === 'stat' ? 'critical' : inv.urgency === 'urgent' ? 'warning' : 'normal',
        tags: [inv.status || 'pending', inv.urgency || 'routine'],
      });
    }
  } catch { /* ignore */ }

  // Lab results
  try {
    const results = await labService.getLabResults(patientId);
    for (const r of results) {
      if (String(r.patient_id) !== String(patientId)) continue;
      const abnormal = r.abnormal_flag && r.abnormal_flag !== 'normal';
      events.push({
        id: `labr_${r.id}`,
        type: 'lab_result',
        date: safeDate(r.result_date || r.created_at),
        title: `Lab Result ${abnormal ? '⚠️' : '✓'}`,
        subtitle: r.test_id || undefined,
        description: `Result: ${r.result_value} ${r.unit || ''} (Ref: ${r.reference_range || 'N/A'}) — ${abnormal ? r.abnormal_flag?.replace('_', ' ').toUpperCase() : 'Normal'}`,
        details: {
          result_value: r.result_value,
          unit: r.unit,
          reference_range: r.reference_range,
          abnormal_flag: r.abnormal_flag,
          verified_by: r.verified_by,
          ai_interpretation: (r as any).ai_interpretation,
        },
        author: r.lab_technician,
        severity: r.abnormal_flag?.includes('critical') ? 'critical' : abnormal ? 'warning' : 'normal',
        tags: [r.abnormal_flag || 'normal'],
      });
    }
  } catch { /* ignore */ }

  return events;
}

// Helper: convert a prescription batch record (with nested prescriptions array)
// OR a flat single-prescription record into individual TimelineEvents.
function prescriptionRecordToEvents(record: any, idPrefix: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const recordDate = record.prescribed_date || record.date || record.created_at || record.createdAt;
  const recordAuthor = record.prescribed_by || record.prescriber || record.createdBy || record.prescriber_role;

  // Check if this is a batch record containing a prescriptions array
  const items = Array.isArray(record.prescriptions) ? record.prescriptions : null;

  if (items && items.length > 0) {
    // Batch format: explode each item into its own timeline event
    for (let i = 0; i < items.length; i++) {
      const rx = items[i];
      // PrescriptionModal items: { medication, genericName, dosage, route, frequency, duration, instructions, indication }
      // PrescriptionsPage items: { drugName, dose, route, frequency, duration, instructions, prescribedBy, prescribedAt }
      const medName = rx.medication || rx.drugName || rx.medication_name || rx.genericName || 'Medication';
      const dosage = rx.dosage || rx.dose || '';
      const route = rx.route || '';
      const frequency = rx.frequency || '';
      const duration = rx.duration || '';
      const instructions = rx.instructions || rx.special_instructions || '';
      const indication = rx.indication || '';
      const rxAuthor = rx.prescribedBy || recordAuthor;
      const rxDate = rx.prescribedAt || recordDate;

      events.push({
        id: `${idPrefix}_${record.id || record.created_at}_${i}`,
        type: 'prescription',
        date: safeDate(rxDate),
        title: `Prescription — ${medName}`,
        subtitle: dosage ? `${dosage} ${frequency}`.trim() : undefined,
        description: [medName, dosage, route, frequency, duration ? `for ${duration}` : ''].filter(Boolean).join(' ').trim(),
        details: {
          medication: medName,
          dosage,
          frequency,
          route,
          duration,
          instructions,
          indication,
          status: rx.status || record.status || 'active',
        },
        author: rxAuthor,
        status: rx.status || record.status || 'active',
        tags: [rx.status || record.status || 'active'],
      });
    }
  } else {
    // Flat single-prescription record (legacy or API format)
    const medName = record.medication_name || record.medication || 'Medication';
    const dosage = record.dosage || record.dose || '';
    events.push({
      id: `${idPrefix}_${record.id || record.created_at}`,
      type: 'prescription',
      date: safeDate(recordDate),
      title: `Prescription — ${medName}`,
      subtitle: dosage ? `${dosage} ${record.frequency || ''}`.trim() : undefined,
      description: [medName, dosage, record.route || '', record.frequency || '', record.duration ? `for ${record.duration}` : ''].filter(Boolean).join(' ').trim(),
      details: {
        medication: medName,
        dosage,
        frequency: record.frequency,
        route: record.route,
        duration: record.duration,
        instructions: record.instructions || record.special_instructions,
        status: record.status || 'active',
      },
      author: recordAuthor,
      status: record.status || 'active',
      tags: [record.status || 'active'],
    });
  }

  return events;
}

async function fetchPrescriptions(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // Try API first
  try {
    const prescriptions = await apiClient.getPrescriptions(patientId);
    if (Array.isArray(prescriptions)) {
      for (const p of prescriptions) {
        events.push(...prescriptionRecordToEvents(p, 'rx'));
      }
    }
  } catch { /* ignore — will use local fallback */ }

  // Fallback: local IndexedDB
  try {
    const local = await db.prescriptions
      .filter((p: any) => String(p.patient_id) === String(patientId))
      .toArray();
    const apiIds = new Set(events.map(e => e.id));
    for (const p of local) {
      const newEvents = prescriptionRecordToEvents(p, 'rx');
      for (const ev of newEvents) {
        if (!apiIds.has(ev.id)) {
          events.push(ev);
          apiIds.add(ev.id);
        }
      }
    }
  } catch { /* ignore */ }

  return events;
}

async function fetchAdmissionsDischarges(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  const numId = Number(patientId);

  try {
    const admissions = await admissionDischargeService.getPatientAdmissions(numId);
    for (const a of admissions) {
      events.push({
        id: `adm_${a.id || a.admission_date}`,
        type: 'admission',
        date: safeDate(a.admission_date || a.created_at),
        title: `Admitted — ${(a as any).ward_location || (a as any).ward || 'Ward'}`,
        subtitle: (a as any).route_of_admission || undefined,
        description: `Admitted to ${(a as any).ward_location || (a as any).ward || 'N/A'} via ${(a as any).route_of_admission || 'N/A'}. Diagnosis: ${(a as any).admitting_diagnosis || (a as any).diagnosis || 'N/A'}`,
        details: {
          ward: (a as any).ward_location || (a as any).ward,
          route: (a as any).route_of_admission,
          diagnosis: (a as any).admitting_diagnosis || (a as any).diagnosis,
          vital_signs: (a as any).vital_signs,
          status: a.status,
        },
        author: (a as any).admitted_by || (a as any).admitting_officer,
        status: a.status,
        severity: 'normal',
        tags: [a.status || 'active'],
      });
    }
  } catch { /* ignore */ }

  try {
    const discharges = await admissionDischargeService.getPatientDischarges(numId);
    for (const d of discharges) {
      events.push({
        id: `dc_${d.id || d.discharge_date}`,
        type: 'discharge',
        date: safeDate(d.discharge_date || d.created_at),
        title: `Discharged — ${(d as any).discharge_status || 'Discharged'}`,
        subtitle: (d as any).discharge_destination || undefined,
        description: `Discharge: ${(d as any).discharge_status || 'N/A'}. Destination: ${(d as any).discharge_destination || 'N/A'}`,
        details: {
          discharge_status: (d as any).discharge_status,
          destination: (d as any).discharge_destination,
          follow_up: (d as any).follow_up_plan || (d as any).follow_up_appointments,
          discharge_medications: (d as any).discharge_medications,
        },
        author: (d as any).discharged_by || (d as any).discharging_officer,
        status: (d as any).discharge_status,
        tags: [(d as any).discharge_status || 'discharged'],
      });
    }
  } catch { /* ignore */ }

  return events;
}

async function fetchRiskAssessments(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const assessments = await riskAssessmentService.getPatientRiskAssessments(patientId);

    for (const dvt of (assessments.dvt || [])) {
      events.push({
        id: `dvt_${dvt.id || dvt.created_at}`,
        type: 'risk_assessment',
        date: safeDate(dvt.assessment_date || dvt.created_at),
        title: `DVT Risk Assessment — ${(dvt as any).risk_level || 'Unknown'} Risk`,
        subtitle: `Score: ${(dvt as any).total_score ?? 'N/A'}`,
        description: `DVT Risk Level: ${(dvt as any).risk_level || 'Unknown'}. Total Score: ${(dvt as any).total_score ?? 'N/A'}. Prophylaxis: ${(dvt as any).prophylaxis_recommendation || 'N/A'}`,
        details: {
          risk_level: (dvt as any).risk_level,
          total_score: (dvt as any).total_score,
          risk_factors: (dvt as any).risk_factors,
          prophylaxis: (dvt as any).prophylaxis_recommendation,
        },
        author: (dvt as any).assessed_by,
        severity: (dvt as any).risk_level === 'high' ? 'critical' : (dvt as any).risk_level === 'moderate' ? 'warning' : 'normal',
        tags: ['DVT', (dvt as any).risk_level || 'unknown'],
      });
    }

    for (const ps of (assessments.pressureSore || [])) {
      events.push({
        id: `ps_${ps.id || ps.created_at}`,
        type: 'risk_assessment',
        date: safeDate(ps.assessment_date || ps.created_at),
        title: `Pressure Sore Risk — ${(ps as any).risk_level || 'Unknown'} Risk`,
        subtitle: `Braden Score: ${(ps as any).total_score ?? 'N/A'}`,
        description: `Pressure Sore Risk: ${(ps as any).risk_level || 'Unknown'}. Braden Score: ${(ps as any).total_score ?? 'N/A'}`,
        details: {
          risk_level: (ps as any).risk_level,
          total_score: (ps as any).total_score,
          subscores: (ps as any).subscores || (ps as any).scores,
          interventions: (ps as any).interventions,
        },
        author: (ps as any).assessed_by,
        severity: (ps as any).risk_level === 'high' ? 'critical' : (ps as any).risk_level === 'moderate' ? 'warning' : 'normal',
        tags: ['Pressure Sore', (ps as any).risk_level || 'unknown'],
      });
    }

    for (const n of (assessments.nutritional || [])) {
      events.push({
        id: `nutr_${n.id || n.created_at}`,
        type: 'risk_assessment',
        date: safeDate(n.assessment_date || n.created_at),
        title: `Nutritional Risk — ${(n as any).risk_level || 'Unknown'} Risk`,
        subtitle: `Score: ${(n as any).total_score ?? 'N/A'}`,
        description: `Nutritional Risk: ${(n as any).risk_level || 'Unknown'}. Score: ${(n as any).total_score ?? 'N/A'}`,
        details: {
          risk_level: (n as any).risk_level,
          total_score: (n as any).total_score,
          bmi: (n as any).bmi,
          weight_loss: (n as any).weight_loss,
          interventions: (n as any).interventions,
        },
        author: (n as any).assessed_by,
        severity: (n as any).risk_level === 'high' ? 'critical' : (n as any).risk_level === 'moderate' ? 'warning' : 'normal',
        tags: ['Nutrition', (n as any).risk_level || 'unknown'],
      });
    }
  } catch { /* ignore */ }
  return events;
}

async function fetchPreopAssessments(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const a = await preoperativeService.getAssessmentByPatient(patientId);
    if (a) {
      const d = a as any;
      
      // Date: assessed_at is the primary field, fall back to assessment_date or updated_at
      const assessDate = d.assessed_at || d.assessment_date || d.updated_at || d.created_at;
      
      // ASA class: check dedicated field first, then parse from comprehensive_summary
      let asaClass = d.asa_class;
      if (!asaClass && d.comprehensive_summary) {
        const asaMatch = d.comprehensive_summary.match(/ASA\s*(?:Score|Class)[:\s]*(\d)/i);
        if (asaMatch) asaClass = asaMatch[1];
      }
      
      // Fitness for surgery
      const fitness = d.fitness_for_surgery || d.fitness_status;
      
      // Airway assessment: it's an object, summarize it if present
      let airwaySummary = 'Not assessed';
      if (d.airway_assessment && typeof d.airway_assessment === 'object') {
        const parts = Object.entries(d.airway_assessment)
          .filter(([_, v]) => v !== null && v !== undefined && v !== '' && v !== false)
          .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
        airwaySummary = parts.length > 0 ? parts.join(', ') : 'Normal';
      } else if (d.airway_assessment && typeof d.airway_assessment === 'string') {
        airwaySummary = d.airway_assessment;
      }
      if (d.mallampati_score) {
        airwaySummary = `Mallampati ${d.mallampati_score}` + (airwaySummary !== 'Normal' && airwaySummary !== 'Not assessed' ? `, ${airwaySummary}` : '');
      }
      
      // Extract procedure and risk from comprehensive_summary
      let procedure = 'N/A';
      let anesthesia = 'N/A';
      let overallRisk = d.cardiovascular_risk?.risk_level || 'N/A';
      if (d.comprehensive_summary) {
        const procMatch = d.comprehensive_summary.match(/Procedure:\s*([^.]+)/i);
        if (procMatch) procedure = procMatch[1].trim();
        const anesMatch = d.comprehensive_summary.match(/Anesthesia:\s*([^.]+)/i);
        if (anesMatch) anesthesia = anesMatch[1].trim();
        const riskMatch = d.comprehensive_summary.match(/Overall Risk:\s*([^.]+)/i);
        if (riskMatch) overallRisk = riskMatch[1].trim();
      }
      
      // Build meaningful description
      const descParts = [
        `Procedure: ${procedure}`,
        asaClass ? `ASA ${asaClass}` : null,
        `Risk: ${overallRisk}`,
        d.dvt_risk?.risk_category ? `DVT: ${d.dvt_risk.risk_category}` : null,
        d.bleeding_risk?.risk_level ? `Bleeding: ${d.bleeding_risk.risk_level}` : null,
      ].filter(Boolean);
      
      // Determine severity from risk level
      const severity: 'normal' | 'warning' | 'critical' | 'success' = 
        overallRisk === 'high' ? 'critical' : 
        overallRisk === 'intermediate' ? 'warning' : 'normal';
      
      events.push({
        id: `preop_${d.id || d.created_at}`,
        type: 'preop_assessment',
        date: safeDate(assessDate),
        title: 'Pre-operative Assessment',
        subtitle: [
          asaClass ? `ASA ${asaClass}` : null,
          procedure !== 'N/A' ? procedure : null,
        ].filter(Boolean).join(' — ') || undefined,
        description: descParts.join('. '),
        details: {
          procedure,
          anesthesia,
          asa_class: asaClass,
          overall_risk: overallRisk,
          airway: airwaySummary,
          mallampati_score: d.mallampati_score,
          fitness_for_surgery: fitness,
          fasting_status: d.fasting_status,
          blood_available: d.blood_available,
          icu_bed_reserved: d.icu_bed_reserved,
          bleeding_risk: d.bleeding_risk?.risk_level,
          bleeding_score: d.bleeding_risk?.risk_score,
          dvt_risk: d.dvt_risk?.risk_category,
          dvt_score: d.dvt_risk?.total_score,
          dvt_prophylaxis: d.dvt_risk?.prophylaxis_recommendation,
          cardiovascular_risk: d.cardiovascular_risk?.risk_level,
          cardiac_event_risk: d.cardiovascular_risk?.cardiac_event_risk_percent ? `${d.cardiovascular_risk.cardiac_event_risk_percent}%` : undefined,
          pressure_sore_risk: d.pressure_sore_risk?.risk_category,
          braden_score: d.pressure_sore_risk?.braden_total,
          comorbidities: (d.comorbidities_medications || []).map((c: any) => c.comorbidity).filter(Boolean).join(', ') || 'None',
          medications: (d.current_medications || []).map((m: any) => m.drug_name).filter(Boolean).join(', ') || 'None',
          insurance_covered: d.insurance_covered ? 'Yes' : 'No',
          preop_instructions: d.preop_instructions,
          comprehensive_summary: d.comprehensive_summary,
        },
        author: d.assessed_by || d.assessor,
        severity,
        tags: ['Pre-op', overallRisk !== 'N/A' ? `${overallRisk} risk` : ''].filter(Boolean),
      });
    }
  } catch { /* ignore */ }
  return events;
}

async function fetchWardRounds(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const rounds = await wardRoundsService.getPatientWardRounds(patientId);
    for (const r of rounds) {
      events.push({
        id: `wr_${(r as any).id || (r as any).round_date}`,
        type: 'ward_round',
        date: safeDate((r as any).round_date || (r as any).created_at),
        title: `Ward Round — ${(r as any).clinical_status || 'Review'}`,
        subtitle: (r as any).reviewed_by ? `By ${(r as any).reviewed_by}` : undefined,
        description: `Clinical Status: ${(r as any).clinical_status || 'N/A'}. Plan: ${truncate((r as any).plan || (r as any).management_plan || 'N/A')}`,
        details: {
          clinical_status: (r as any).clinical_status,
          findings: (r as any).findings || (r as any).examination_findings,
          plan: (r as any).plan || (r as any).management_plan,
          issues: (r as any).issues || (r as any).active_issues,
          vital_signs: (r as any).vital_signs,
        },
        author: (r as any).reviewed_by || (r as any).lead_consultant,
        authorRole: (r as any).reviewer_role,
        tags: [(r as any).clinical_status || 'review'],
      });
    }
  } catch { /* ignore */ }
  return events;
}

async function fetchProcedures(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const procs = await db.procedures
      .filter((p: any) => String(p.patient_id) === String(patientId))
      .toArray();
    for (const p of procs) {
      events.push({
        id: `proc_${p.id || p.created_at}`,
        type: 'procedure',
        date: safeDate(p.scheduled_date || p.created_at),
        title: `Procedure — ${p.procedure_name || 'N/A'}`,
        subtitle: p.procedure_type || undefined,
        description: `${p.procedure_name || 'N/A'} (${p.procedure_type || 'N/A'}). Surgeon: ${p.surgeon || 'N/A'}. Status: ${p.status || 'N/A'}`,
        details: {
          procedure_name: p.procedure_name,
          procedure_type: p.procedure_type,
          surgeon: p.surgeon,
          status: p.status,
          notes: p.notes || p.progress_notes,
        },
        author: p.surgeon,
        status: p.status,
        severity: p.status === 'completed' ? 'success' : 'normal',
        tags: [p.status || 'scheduled', p.procedure_type || ''].filter(Boolean),
      });
    }
  } catch { /* ignore */ }

  // Also surgery bookings
  try {
    const bookings = await db.surgery_bookings
      .filter((s: any) => String(s.patient_id) === String(patientId))
      .toArray();
    for (const s of bookings) {
      events.push({
        id: `surg_${s.id || s.created_at}`,
        type: 'surgery',
        date: safeDate(s.date || s.created_at),
        title: `Surgery — ${s.procedure_name || 'N/A'}`,
        subtitle: s.primary_surgeon || undefined,
        description: `Surgery: ${s.procedure_name || 'N/A'}. Surgeon: ${s.primary_surgeon || 'N/A'}. Status: ${s.status || 'N/A'}`,
        details: {
          procedure: s.procedure_name,
          surgeon: s.primary_surgeon,
          anaesthesia: s.anaesthesia_type,
          urgency: s.urgency,
          status: s.status,
          notes: s.notes,
        },
        author: s.primary_surgeon,
        status: s.status,
        severity: s.status === 'completed' ? 'success' : 'normal',
        tags: [s.status || 'scheduled'],
      });
    }
  } catch { /* ignore */ }

  return events;
}

async function fetchWoundCare(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const wounds = await db.wound_care
      .filter((w: any) => String(w.patient_id) === String(patientId))
      .toArray();
    for (const w of wounds) {
      events.push({
        id: `wc_${w.id || w.created_at}`,
        type: 'wound_care',
        date: safeDate(w.assessment_date || w.created_at),
        title: `Wound Care — ${w.wound_type || 'Assessment'}`,
        subtitle: w.wound_location || undefined,
        description: `Wound: ${w.wound_type || 'N/A'} at ${w.wound_location || 'N/A'}. Stage: ${w.wound_stage || 'N/A'}`,
        details: {
          wound_type: w.wound_type,
          wound_location: w.wound_location,
          wound_stage: w.wound_stage,
          dressing: w.dressing || w.dressing_type,
          measurements: w.measurements,
          notes: w.notes,
        },
        author: w.assessed_by,
        tags: [w.wound_type || 'wound', w.wound_stage || ''].filter(Boolean),
      });
    }
  } catch { /* ignore */ }
  return events;
}

async function fetchTreatmentPlans(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const plans = await db.treatment_plans
      .where('patient_id')
      .equals(Number(patientId))
      .toArray();
    for (const p of plans) {
      const meds = (p.medications || []).map((m: any) => m.medication || m.name).filter(Boolean);
      const procs = (p.procedures || []).map((pr: any) => pr.procedure_name || pr.name).filter(Boolean);
      events.push({
        id: `tp_${p.id || p.created_at}`,
        type: 'treatment_plan',
        date: safeDate(p.created_at),
        title: `Treatment Plan — ${p.title || p.diagnosis || 'Plan'}`,
        subtitle: `Status: ${p.status || 'N/A'}`,
        description: `Diagnosis: ${p.diagnosis || 'N/A'}. ${meds.length ? `Medications: ${meds.join(', ')}. ` : ''}${procs.length ? `Procedures: ${procs.join(', ')}. ` : ''}${p.notes ? `Notes: ${truncate(p.notes)}` : ''}`,
        details: {
          diagnosis: p.diagnosis,
          status: p.status,
          medications: p.medications,
          procedures: p.procedures,
          reviews: p.reviews,
          lab_works: p.lab_works,
          discharge_timeline: p.discharge_timeline,
          notes: p.notes,
        },
        author: p.created_by,
        status: p.status,
        severity: p.status === 'completed' ? 'success' : 'normal',
        tags: [p.status || 'draft'],
      });

      // Also surface individual reviews within the treatment plan
      for (const review of (p.reviews || [])) {
        events.push({
          id: `tp_review_${p.id}_${review.date || review.review_date}`,
          type: 'ward_round',
          date: safeDate(review.date || review.review_date || review.created_at),
          title: `Treatment Plan Review — ${p.title || p.diagnosis}`,
          subtitle: review.reviewer || undefined,
          description: `Review: ${truncate(review.findings || review.notes || review.assessment || 'N/A')}. Plan: ${truncate(review.plan || 'N/A')}`,
          details: review,
          author: review.reviewer || review.reviewed_by,
          tags: ['review'],
        });
      }
    }
  } catch { /* ignore */ }
  return events;
}

async function fetchBurnCare(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const burns = await db.burn_patients
      .filter((b: any) => String(b.patient_id) === String(patientId))
      .toArray();
    for (const b of burns) {
      events.push({
        id: `burn_${b.id || b.created_at}`,
        type: 'burn_care',
        date: safeDate(b.admission_date || b.created_at),
        title: `Burn Injury — TBSA ${b.tbsa_percentage || '?'}%`,
        subtitle: b.mechanism || undefined,
        description: `Burn: ${b.mechanism || 'N/A'}. TBSA: ${b.tbsa_percentage || 'N/A'}%. Baux Score: ${b.baux_score || 'N/A'}. Disposition: ${b.disposition || 'N/A'}`,
        details: {
          mechanism: b.mechanism,
          tbsa_percentage: b.tbsa_percentage,
          baux_score: b.baux_score,
          disposition: b.disposition,
          status: b.status,
        },
        status: b.status,
        severity: (b.tbsa_percentage || 0) > 20 ? 'critical' : (b.tbsa_percentage || 0) > 10 ? 'warning' : 'normal',
        tags: ['burn', b.status || ''].filter(Boolean),
      });
    }
  } catch { /* ignore */ }
  return events;
}

async function fetchDiabeticFoot(patientId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];
  try {
    const assessments = await diabeticFootService.getPatientAssessments(patientId);
    for (const a of assessments) {
      events.push({
        id: `df_${(a as any).id || (a as any).created_at}`,
        type: 'diabetic_foot',
        date: safeDate((a as any).assessment_date || (a as any).created_at),
        title: `Diabetic Foot Assessment — Wagner Grade ${(a as any).wagner_grade ?? 'N/A'}`,
        subtitle: `WIfI Score: ${(a as any).wifi_score ?? 'N/A'}`,
        description: `Wagner Grade: ${(a as any).wagner_grade ?? 'N/A'}. Texas Stage: ${(a as any).texas_stage ?? 'N/A'}. WIfI: ${(a as any).wifi_score ?? 'N/A'}. Risk: ${(a as any).risk_category || 'N/A'}`,
        details: a as any,
        author: (a as any).assessed_by,
        severity: ((a as any).risk_category || '').toLowerCase().includes('high') ? 'critical' : 'normal',
        tags: ['diabetic foot', (a as any).risk_category || ''].filter(Boolean),
      });
    }
  } catch { /* ignore */ }
  return events;
}

// ─── Main Component ────────────────────────────────────────────

export const ComprehensiveClinicalTimeline: React.FC<ComprehensiveClinicalTimelineProps> = ({
  patientId,
  hospitalNumber,
}) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<TimelineEventType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sortAsc, setSortAsc] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  const loadAllEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        fetchProgressNotes(patientId),
        fetchInvestigationsAndResults(patientId),
        fetchPrescriptions(patientId),
        fetchAdmissionsDischarges(patientId),
        fetchRiskAssessments(patientId),
        fetchPreopAssessments(patientId),
        fetchWardRounds(patientId),
        fetchProcedures(patientId),
        fetchWoundCare(patientId),
        fetchTreatmentPlans(patientId),
        fetchBurnCare(patientId),
        fetchDiabeticFoot(patientId),
      ]);

      const allEvents: TimelineEvent[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          allEvents.push(...r.value);
        }
      }

      // Deduplicate by id
      const seen = new Set<string>();
      const unique = allEvents.filter(e => {
        if (seen.has(e.id)) return false;
        seen.add(e.id);
        return true;
      });

      setEvents(unique);
    } catch (err) {
      console.error('Error loading clinical timeline:', err);
      setError('Failed to load some clinical data. Showing available records.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadAllEvents();
  }, [loadAllEvents]);

  // ── Filtered + Sorted Events ──
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (filterType !== 'all') {
      filtered = filtered.filter(e => e.type === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        (e.subtitle || '').toLowerCase().includes(q) ||
        (e.author || '').toLowerCase().includes(q) ||
        (e.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }

    if (dateRange.start) {
      const start = new Date(dateRange.start);
      if (isValid(start)) filtered = filtered.filter(e => e.date >= start);
    }
    if (dateRange.end) {
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      if (isValid(end)) filtered = filtered.filter(e => e.date <= end);
    }

    filtered.sort((a, b) => sortAsc
      ? a.date.getTime() - b.date.getTime()
      : b.date.getTime() - a.date.getTime()
    );

    return filtered;
  }, [events, filterType, searchQuery, sortAsc, dateRange]);

  // ── Stats ──
  const stats = useMemo(() => {
    const typeCount: Record<string, number> = {};
    for (const e of events) {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    }
    return { total: events.length, byType: typeCount };
  }, [events]);

  // ── Helpers ──
  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportTimeline = () => {
    const csv = [
      ['Date', 'Type', 'Title', 'Description', 'Author', 'Status', 'Tags'].join(','),
      ...filteredEvents.map(e => [
        fmtDate(e.date),
        EVENT_META[e.type]?.label || e.type,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${e.description.replace(/"/g, '""')}"`,
        e.author || '',
        e.status || '',
        (e.tags || []).join('; '),
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-${hospitalNumber}-clinical-timeline-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Active filter types ──
  const activeTypes = useMemo(() => {
    const types = new Set(events.map(e => e.type));
    return Array.from(types).sort();
  }, [events]);

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'critical': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <MinusCircle className="h-4 w-4 text-yellow-500" />;
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return null;
    }
  };

  // ── Render ──

  if (loading && events.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Activity className="h-6 w-6 text-green-600 animate-pulse" />
            <h2 className="text-xl font-semibold text-gray-900">Loading Clinical Timeline…</h2>
          </div>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header + Stats ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center space-x-2">
              <LayoutList className="h-5 w-5 text-green-600" />
              <span>Comprehensive Clinical Timeline</span>
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              All clinical events in chronological order
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadAllEvents}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportTimeline}
              className="flex items-center space-x-1 px-3 py-1.5 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 text-sm bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg">
            {error}
          </div>
        )}

        {/* Stats Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
            <span className="font-bold text-gray-900">{stats.total}</span>
            <span className="text-gray-600 ml-1">Total Events</span>
          </div>
          {activeTypes.map(type => {
            const meta = EVENT_META[type as TimelineEventType];
            const count = stats.byType[type] || 0;
            return (
              <button
                key={type}
                onClick={() => setFilterType(filterType === type ? 'all' : type as TimelineEventType)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center space-x-1.5 ${
                  filterType === type
                    ? 'bg-green-600 text-white'
                    : `${meta?.bgColor || 'bg-gray-100'} ${meta?.textColor || 'text-gray-700'} hover:opacity-80`
                }`}
              >
                {meta && <meta.icon className="h-3.5 w-3.5" />}
                <span>{meta?.label || type}</span>
                <span className={`ml-1 text-xs ${filterType === type ? 'text-green-100' : 'opacity-70'}`}>({count})</span>
              </button>
            );
          })}
        </div>

        {/* Search + Date + Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search events (title, description, author, tags)…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
              className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              title="From date"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
              className="px-2 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              title="To date"
            />
            <button
              onClick={() => setSortAsc(!sortAsc)}
              title={sortAsc ? 'Oldest first' : 'Newest first'}
              className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{sortAsc ? 'Oldest First' : 'Newest First'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Timeline ── */}
      <div className="bg-white rounded-lg border border-gray-200">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 px-6">
            <Activity className="h-14 w-14 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {events.length === 0 ? 'No Clinical Events Found' : 'No Matching Events'}
            </h3>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              {events.length === 0
                ? 'No documentations, investigations, assessments, or procedures have been recorded for this patient yet.'
                : 'Try adjusting your search query or filters to find specific events.'}
            </p>
            {filterType !== 'all' && (
              <button
                onClick={() => { setFilterType('all'); setSearchQuery(''); }}
                className="mt-4 px-4 py-2 text-sm text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Date group headers */}
            {(() => {
              let lastDateLabel = '';
              return filteredEvents.map((event, index) => {
                const dateLabel = isValid(event.date) && event.date.getTime() > 0
                  ? format(event.date, 'EEEE, MMMM d, yyyy')
                  : 'Date Unknown';
                const showDateHeader = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;
                const meta = EVENT_META[event.type] || EVENT_META.progress_note;
                const Icon = meta.icon;
                const isExpanded = expandedIds.has(event.id);

                return (
                  <React.Fragment key={event.id}>
                    {showDateHeader && (
                      <div className="sticky top-0 z-10 bg-gray-50 px-5 py-2 border-b border-gray-200">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-semibold text-gray-700">{dateLabel}</span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                        event.severity === 'critical' ? 'border-l-4 border-l-red-500' :
                        event.severity === 'warning' ? 'border-l-4 border-l-yellow-400' :
                        event.severity === 'success' ? 'border-l-4 border-l-green-400' :
                        'border-l-4 border-l-transparent'
                      }`}
                      onClick={() => toggleExpand(event.id)}
                    >
                      <div className="flex items-start space-x-3">
                        {/* Icon dot */}
                        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${meta.bgColor} border ${meta.borderColor}`}>
                          <Icon className={`h-5 w-5 ${meta.textColor}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                            <div className="flex items-center space-x-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                                {event.title}
                              </h4>
                              {getSeverityIcon(event.severity)}
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${meta.bgColor} ${meta.textColor}`}>
                                {meta.label}
                              </span>
                              {event.status && (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  {event.status}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-gray-500 whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              <span>{fmtDate(event.date)}</span>
                            </div>
                          </div>

                          {event.subtitle && (
                            <p className="text-xs text-gray-500 mt-0.5">{event.subtitle}</p>
                          )}

                          <p className="text-sm text-gray-700 mt-1 leading-relaxed">
                            {event.description}
                          </p>

                          <div className="flex items-center flex-wrap gap-2 mt-2">
                            {event.author && (
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                <User className="h-3 w-3" />
                                <span>{event.author}</span>
                                {event.authorRole && (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                    {event.authorRole}
                                  </span>
                                )}
                              </div>
                            )}
                            {(event.tags || []).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                                {tag}
                              </span>
                            ))}
                            {event.details && (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleExpand(event.id); }}
                                className="flex items-center space-x-1 text-xs text-green-600 hover:text-green-800"
                              >
                                {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                <span>{isExpanded ? 'Less' : 'Details'}</span>
                              </button>
                            )}
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && event.details && (
                            <div className={`mt-3 p-4 rounded-lg ${meta.bgColor} border ${meta.borderColor}`}>
                              <h5 className={`text-xs font-semibold ${meta.textColor} uppercase tracking-wider mb-2`}>
                                Full Details
                              </h5>
                              <div className="space-y-2">
                                {renderEventDetails(event)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Footer info */}
      {filteredEvents.length > 0 && (
        <div className="text-center text-xs text-gray-400 py-2">
          Showing {filteredEvents.length} of {events.length} event(s)
          {filterType !== 'all' && ` • Filtered: ${EVENT_META[filterType]?.label || filterType}`}
        </div>
      )}
    </div>
  );
};

// ─── Detail Renderers ──────────────────────────────────────────

function renderEventDetails(event: TimelineEvent): React.ReactNode {
  const d = event.details;
  if (!d) return null;

  switch (event.type) {
    case 'progress_note':
      return (
        <div className="space-y-3 text-sm">
          {d.vital_signs && (
            <div>
              <span className="font-medium text-gray-700">Vital Signs:</span>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {d.vital_signs.temperature && <span className="text-gray-600">Temp: {d.vital_signs.temperature}</span>}
                {d.vital_signs.bloodPressure && <span className="text-gray-600">BP: {d.vital_signs.bloodPressure}</span>}
                {d.vital_signs.pulse && <span className="text-gray-600">PR: {d.vital_signs.pulse}</span>}
                {d.vital_signs.respiratoryRate && <span className="text-gray-600">RR: {d.vital_signs.respiratoryRate}</span>}
                {d.vital_signs.oxygenSaturation && <span className="text-gray-600">SpO2: {d.vital_signs.oxygenSaturation}</span>}
                {d.vital_signs.painScore && <span className="text-gray-600">Pain: {d.vital_signs.painScore}/10</span>}
              </div>
            </div>
          )}
          {d.lmp && <div><span className="font-medium text-gray-700">LMP:</span> <span className="text-gray-600">{d.lmp}</span></div>}
          {d.subjective && (
            <div>
              <span className="font-semibold text-purple-700">S — Subjective:</span>
              <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{d.subjective}</p>
            </div>
          )}
          {d.objective && (
            <div>
              <span className="font-semibold text-purple-700">O — Objective:</span>
              <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{d.objective}</p>
            </div>
          )}
          {d.assessment && (
            <div>
              <span className="font-semibold text-purple-700">A — Assessment:</span>
              <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{d.assessment}</p>
            </div>
          )}
          {d.plan && (
            <div>
              <span className="font-semibold text-purple-700">P — Plan:</span>
              <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{d.plan}</p>
            </div>
          )}
        </div>
      );

    case 'preop_assessment':
      return (
        <div className="space-y-3 text-sm">
          {/* Procedure & Anesthesia */}
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Procedure" value={d.procedure} />
            <DetailRow label="Anesthesia" value={d.anesthesia} />
            <DetailRow label="ASA Class" value={d.asa_class} />
            <DetailRow label="Overall Risk" value={d.overall_risk} />
            <DetailRow label="Fitness" value={d.fitness_for_surgery} />
            <DetailRow label="Fasting Status" value={d.fasting_status} />
          </div>
          
          {/* Airway */}
          {d.airway && (
            <div>
              <span className="font-semibold text-gray-700">Airway Assessment:</span>
              <span className="ml-1 text-gray-600">{d.airway}</span>
              {d.mallampati_score && <span className="ml-2 text-gray-500">(Mallampati {d.mallampati_score})</span>}
            </div>
          )}
          
          {/* Risk Scores */}
          <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded p-2">
            <div className="col-span-2 font-semibold text-gray-700 text-xs uppercase tracking-wide">Risk Scores</div>
            <DetailRow label="Bleeding Risk" value={d.bleeding_risk ? `${d.bleeding_risk} (score: ${d.bleeding_score || 'N/A'})` : undefined} />
            <DetailRow label="DVT Risk" value={d.dvt_risk ? `${d.dvt_risk} (score: ${d.dvt_score || 'N/A'})` : undefined} />
            <DetailRow label="DVT Prophylaxis" value={d.dvt_prophylaxis} />
            <DetailRow label="Cardiovascular Risk" value={d.cardiovascular_risk ? `${d.cardiovascular_risk} (event risk: ${d.cardiac_event_risk || 'N/A'})` : undefined} />
            <DetailRow label="Pressure Sore Risk" value={d.pressure_sore_risk ? `${d.pressure_sore_risk} (Braden: ${d.braden_score || 'N/A'})` : undefined} />
          </div>
          
          {/* Readiness */}
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Blood Available" value={d.blood_available ? 'Yes' : d.blood_available === false ? 'No' : undefined} />
            <DetailRow label="ICU Bed Reserved" value={d.icu_bed_reserved ? 'Yes' : d.icu_bed_reserved === false ? 'No' : undefined} />
            <DetailRow label="Insurance Covered" value={d.insurance_covered} />
          </div>
          
          {/* Comorbidities & Medications */}
          <DetailRow label="Comorbidities" value={d.comorbidities} />
          <DetailRow label="Current Medications" value={d.medications} />
          
          {/* Instructions */}
          {d.preop_instructions && (
            <div className="bg-blue-50 rounded p-2">
              <span className="font-semibold text-blue-700">Pre-op Instructions:</span>
              <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{d.preop_instructions}</p>
            </div>
          )}
          
          {/* Summary */}
          {d.comprehensive_summary && (
            <div className="bg-green-50 rounded p-2">
              <span className="font-semibold text-green-700">Summary:</span>
              <p className="text-gray-700 mt-0.5 whitespace-pre-wrap">{d.comprehensive_summary}</p>
            </div>
          )}
        </div>
      );

    case 'prescription':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <DetailRow label="Medication" value={d.medication} />
          <DetailRow label="Dosage" value={d.dosage} />
          <DetailRow label="Frequency" value={d.frequency} />
          <DetailRow label="Route" value={d.route} />
          <DetailRow label="Duration" value={d.duration} />
          {d.indication && <DetailRow label="Indication" value={d.indication} />}
          <DetailRow label="Status" value={d.status} />
          {d.instructions && (
            <div className="col-span-2">
              <DetailRow label="Instructions" value={d.instructions} />
            </div>
          )}
        </div>
      );

    case 'investigation':
      return (
        <div className="space-y-2 text-sm">
          <DetailRow label="Status" value={d.status} />
          <DetailRow label="Urgency" value={d.urgency} />
          <DetailRow label="Clinical Indication" value={d.clinical_indication} />
          {d.collection_date && <DetailRow label="Collected" value={fmtDateShort(safeDate(d.collection_date))} />}
          {d.special_instructions && <DetailRow label="Special Instructions" value={d.special_instructions} />}
          {Array.isArray(d.tests) && d.tests.length > 0 && (
            <div>
              <span className="font-medium text-gray-700">Tests Ordered:</span>
              <ul className="mt-1 space-y-1">
                {d.tests.map((t: any, i: number) => (
                  <li key={i} className="flex items-center justify-between bg-white/60 rounded px-2 py-1">
                    <span className="text-gray-800">{t.test_name || t.name}</span>
                    <span className="text-xs text-gray-500">{t.category || ''} • {t.sample_type || ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'lab_result':
      return (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-3 gap-2">
            <DetailRow label="Result" value={`${d.result_value} ${d.unit || ''}`} />
            <DetailRow label="Ref Range" value={d.reference_range} />
            <DetailRow label="Flag" value={d.abnormal_flag?.replace('_', ' ')} />
          </div>
          {d.verified_by && <DetailRow label="Verified By" value={d.verified_by} />}
          {d.ai_interpretation && (
            <div>
              <span className="font-medium text-gray-700">AI Interpretation:</span>
              <p className="text-gray-600 mt-0.5 bg-white/60 rounded p-2">{d.ai_interpretation}</p>
            </div>
          )}
        </div>
      );

    case 'admission':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <DetailRow label="Ward" value={d.ward} />
          <DetailRow label="Route" value={d.route} />
          <DetailRow label="Diagnosis" value={d.diagnosis} />
          <DetailRow label="Status" value={d.status} />
          {d.vital_signs && (
            <div className="col-span-2">
              <span className="font-medium text-gray-700">Admission Vitals:</span>
              <pre className="text-xs text-gray-600 mt-1 bg-white/50 rounded p-2 overflow-x-auto">
                {JSON.stringify(d.vital_signs, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );

    case 'discharge':
      return (
        <div className="space-y-2 text-sm">
          <DetailRow label="Status" value={d.discharge_status} />
          <DetailRow label="Destination" value={d.destination} />
          {d.follow_up && (
            <div>
              <span className="font-medium text-gray-700">Follow-up Plan:</span>
              <pre className="text-xs text-gray-600 mt-1 bg-white/50 rounded p-2 overflow-x-auto">
                {typeof d.follow_up === 'string' ? d.follow_up : JSON.stringify(d.follow_up, null, 2)}
              </pre>
            </div>
          )}
          {d.discharge_medications && Array.isArray(d.discharge_medications) && (
            <div>
              <span className="font-medium text-gray-700">Discharge Medications:</span>
              <ul className="mt-1 space-y-1">
                {d.discharge_medications.map((m: any, i: number) => (
                  <li key={i} className="text-gray-600 bg-white/50 rounded px-2 py-1">
                    {m.medication || m.name} — {m.dosage || ''} {m.frequency || ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );

    case 'risk_assessment':
      return (
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <DetailRow label="Risk Level" value={d.risk_level} />
            <DetailRow label="Total Score" value={d.total_score?.toString()} />
            {d.bmi && <DetailRow label="BMI" value={d.bmi?.toString()} />}
          </div>
          {d.risk_factors && (
            <div>
              <span className="font-medium text-gray-700">Risk Factors:</span>
              <pre className="text-xs text-gray-600 mt-1 bg-white/50 rounded p-2 overflow-x-auto">
                {typeof d.risk_factors === 'string' ? d.risk_factors : JSON.stringify(d.risk_factors, null, 2)}
              </pre>
            </div>
          )}
          {d.prophylaxis && <DetailRow label="Prophylaxis" value={d.prophylaxis} />}
          {d.interventions && (
            <div>
              <span className="font-medium text-gray-700">Interventions:</span>
              <pre className="text-xs text-gray-600 mt-1 bg-white/50 rounded p-2 overflow-x-auto">
                {typeof d.interventions === 'string' ? d.interventions : JSON.stringify(d.interventions, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );

    case 'ward_round':
      return (
        <div className="space-y-2 text-sm">
          <DetailRow label="Clinical Status" value={d.clinical_status} />
          {d.findings && (
            <div>
              <span className="font-medium text-gray-700">Findings:</span>
              <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{typeof d.findings === 'string' ? d.findings : JSON.stringify(d.findings, null, 2)}</p>
            </div>
          )}
          {d.plan && (
            <div>
              <span className="font-medium text-gray-700">Plan:</span>
              <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{typeof d.plan === 'string' ? d.plan : JSON.stringify(d.plan, null, 2)}</p>
            </div>
          )}
          {d.issues && (
            <div>
              <span className="font-medium text-gray-700">Active Issues:</span>
              <pre className="text-xs text-gray-600 mt-1 bg-white/50 rounded p-2 overflow-x-auto">
                {typeof d.issues === 'string' ? d.issues : JSON.stringify(d.issues, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );

    case 'wound_care':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <DetailRow label="Type" value={d.wound_type} />
          <DetailRow label="Location" value={d.wound_location} />
          <DetailRow label="Stage" value={d.wound_stage} />
          <DetailRow label="Dressing" value={d.dressing} />
          {d.measurements && (
            <div className="col-span-2">
              <span className="font-medium text-gray-700">Measurements:</span>
              <pre className="text-xs text-gray-600 mt-1 bg-white/50 rounded p-2">
                {typeof d.measurements === 'string' ? d.measurements : JSON.stringify(d.measurements, null, 2)}
              </pre>
            </div>
          )}
          {d.notes && <div className="col-span-2"><DetailRow label="Notes" value={d.notes} /></div>}
        </div>
      );

    case 'treatment_plan':
      return (
        <div className="space-y-2 text-sm">
          <DetailRow label="Diagnosis" value={d.diagnosis} />
          <DetailRow label="Status" value={d.status} />
          {Array.isArray(d.medications) && d.medications.length > 0 && (
            <div>
              <span className="font-medium text-gray-700">Medications ({d.medications.length}):</span>
              <ul className="mt-1 space-y-1">
                {d.medications.map((m: any, i: number) => (
                  <li key={i} className="text-gray-600 bg-white/50 rounded px-2 py-1">
                    {m.medication || m.name} — {m.dose || m.dosage || ''} {m.route || ''} {m.frequency || ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(d.procedures) && d.procedures.length > 0 && (
            <div>
              <span className="font-medium text-gray-700">Procedures ({d.procedures.length}):</span>
              <ul className="mt-1 space-y-1">
                {d.procedures.map((p: any, i: number) => (
                  <li key={i} className="text-gray-600 bg-white/50 rounded px-2 py-1">
                    {p.procedure_name || p.name} — {p.status || 'planned'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {d.notes && <DetailRow label="Notes" value={d.notes} />}
        </div>
      );

    case 'burn_care':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <DetailRow label="Mechanism" value={d.mechanism} />
          <DetailRow label="TBSA %" value={d.tbsa_percentage?.toString()} />
          <DetailRow label="Baux Score" value={d.baux_score?.toString()} />
          <DetailRow label="Disposition" value={d.disposition} />
          <DetailRow label="Status" value={d.status} />
        </div>
      );

    case 'diabetic_foot':
      return (
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(d).filter(([k, v]) => v !== undefined && v !== null && k !== 'id').map(([key, val]) => (
            <DetailRow key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={String(val)} />
          ))}
        </div>
      );

    default:
      return (
        <pre className="text-xs text-gray-600 overflow-x-auto bg-white/50 rounded p-2">
          {JSON.stringify(d, null, 2)}
        </pre>
      );
  }
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span className="font-medium text-gray-700">{label}:</span>{' '}
      <span className="text-gray-600">{value}</span>
    </div>
  );
}

export default ComprehensiveClinicalTimeline;
