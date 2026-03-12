import React, { useState, useEffect } from 'react';
import { Clock, FileText, Activity, Pill, Stethoscope, Clipboard, Scissors, Droplet, AlertTriangle, UserCheck } from 'lucide-react';
import { db } from '../db/database';
import { format } from 'date-fns';

interface PatientChronologicalTimelineProps {
  patientId: string;
  hospitalNumber: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: string;
  title: string;
  description: string;
  author?: string;
}

export function PatientChronologicalTimeline({ patientId, hospitalNumber }: PatientChronologicalTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTimeline();
  }, [patientId]);

  const safeDate = (d: any): Date => {
    if (!d) return new Date();
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const matchPid = (val: any) => String(val) === String(patientId) || String(val) === String(Number(patientId));

  const loadTimeline = async () => {
    try {
      setLoading(true);
      const timelineEvents: TimelineEvent[] = [];

      // 1. Admissions
      try {
        const all = await db.admissions.toArray();
        for (const a of all.filter((a: any) => matchPid(a.patient_id))) {
          timelineEvents.push({
            id: `adm_${a.id}`, date: safeDate(a.admission_date), type: 'admission',
            title: 'Admitted to ' + (a.ward_location || 'Ward'),
            description: 'Route: ' + (a.route_of_admission || 'N/A') + '. Dx: ' + (a.diagnosis || (a as any).admitting_diagnosis || 'N/A'),
            author: (a as any).consultant || (a as any).admitting_consultant
          });
        }
      } catch(e) { console.warn('Timeline admissions:', e); }

      // 2. Ward Rounds (ward_rounds table - scheduled rounds)
      try {
        const all = await db.ward_rounds.toArray();
        for (const wr of all.filter((r: any) => matchPid(r.patient_id))) {
          const r = wr as any;
          timelineEvents.push({
            id: `wr_${r.id}`, date: safeDate(r.round_date || r.date || r.created_at), type: 'ward_round',
            title: (r.round_type || 'Ward Round').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            description: (r.clinical_notes || r.assessment || r.plan || 'Ward round documented'),
            author: r.reviewing_doctor || r.doctor_name || r.consultant
          });
        }
      } catch(e) { console.warn('Timeline ward_rounds:', e); }

      // 3. Ward Rounds Clinical
      try {
        const all = await db.ward_rounds_clinical.toArray();
        for (const wr of all.filter((r: any) => matchPid(r.patient_id))) {
          const r = wr as any;
          timelineEvents.push({
            id: `wrc_${r.id}`, date: safeDate(r.round_date || r.created_at), type: 'ward_round',
            title: 'Clinical Ward Round',
            description: (r.clinical_notes || r.assessment || 'Clinical ward round documented') + (r.chief_complaint ? '. CC: ' + r.chief_complaint : ''),
            author: r.reviewed_by || r.reviewing_doctor
          });
        }
      } catch(e) { console.warn('Timeline ward_rounds_clinical:', e); }

      // 4. Treatment Plans
      try {
        const all = await db.treatment_plans.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id) && !p.deleted)) {
          timelineEvents.push({
            id: `tp_${p.id}`, date: safeDate(p.created_at), type: 'treatment_plan',
            title: 'Treatment Plan: ' + ((p as any).diagnosis || p.title || 'Untitled'),
            description: 'Status: ' + (p.status || 'active') + '. ' + ((p as any).description || ''),
            author: (p as any).created_by
          });
        }
      } catch(e) { console.warn('Timeline treatment_plans:', e); }

      // 5. Surgery Bookings
      try {
        const all = await db.surgery_bookings.toArray();
        for (const b of all.filter((b: any) => matchPid(b.patient_id))) {
          timelineEvents.push({
            id: `surg_${b.id}`, date: safeDate(b.date), type: 'procedure',
            title: 'Surgery: ' + ((b as any).procedure_name || (b as any).procedure || 'Procedure'),
            description: 'Theatre ' + (b.theatre_number || 'N/A') + '. Status: ' + (b.status || 'N/A'),
            author: b.primary_surgeon
          });
        }
      } catch(e) { console.warn('Timeline surgery_bookings:', e); }

      // 6. Procedures
      try {
        const all = await db.procedures.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id))) {
          timelineEvents.push({
            id: `proc_${p.id}`, date: safeDate(p.scheduled_date || p.created_at), type: 'procedure',
            title: (p.procedure_name || p.procedure_type || 'Procedure'),
            description: 'Status: ' + (p.status || 'N/A'),
            author: p.surgeon
          });
        }
      } catch(e) { console.warn('Timeline procedures:', e); }

      // 7. Lab Investigations
      try {
        const all = await db.lab_investigations.toArray();
        for (const l of all.filter((l: any) => matchPid(l.patient_id))) {
          timelineEvents.push({
            id: `lab_${l.id}`, date: safeDate(l.request_date), type: 'lab',
            title: 'Lab: ' + ((l as any).test_name || (l as any).investigation_type || 'Investigation'),
            description: 'Status: ' + (l.status || 'pending') + '. Urgency: ' + (l.urgency || 'routine'),
            author: l.requested_by
          });
        }
      } catch(e) { console.warn('Timeline labs:', e); }

      // 8. Lab Results
      try {
        const all = await db.lab_results.toArray();
        for (const r of all.filter((r: any) => matchPid(r.patient_id))) {
          timelineEvents.push({
            id: `labres_${r.id}`, date: safeDate(r.result_date), type: 'lab',
            title: 'Lab Result: ' + ((r as any).test_name || 'Result'),
            description: 'Value: ' + ((r as any).result_value || (r as any).value || 'N/A') + '. ' + (r.abnormal_flag ? 'ABNORMAL' : 'Normal'),
          });
        }
      } catch(e) { console.warn('Timeline lab_results:', e); }

      // 9. Prescriptions
      try {
        const all = await db.prescriptions.toArray();
        for (const rx of all.filter((r: any) => matchPid(r.patient_id))) {
          timelineEvents.push({
            id: `rx_${rx.id}`, date: safeDate(rx.prescribed_date || rx.created_at), type: 'prescription',
            title: 'Rx: ' + (rx.medication_name || 'Medication'),
            description: [rx.dosage, rx.route, rx.frequency].filter(Boolean).join(' ') + '. Status: ' + (rx.status || 'active'),
            author: rx.prescribed_by
          });
        }
      } catch(e) { console.warn('Timeline prescriptions:', e); }

      // 10. Wound Care
      try {
        const all = await db.wound_care.toArray();
        for (const w of all.filter((w: any) => matchPid(w.patient_id))) {
          timelineEvents.push({
            id: `wc_${w.id}`, date: safeDate(w.assessment_date || w.created_at), type: 'wound_care',
            title: 'Wound: ' + (w.wound_type || 'Assessment') + ' - ' + (w.wound_location || 'N/A'),
            description: 'Stage: ' + ((w as any).wound_stage || 'N/A'),
            author: (w as any).assessed_by
          });
        }
      } catch(e) { console.warn('Timeline wound_care:', e); }

      // 11. DVT Risk Assessments
      try {
        const all = await db.dvt_assessments.toArray();
        for (const d of all.filter((d: any) => matchPid(d.patient_id))) {
          timelineEvents.push({
            id: `dvt_${d.id}`, date: safeDate(d.assessment_date), type: 'risk_assessment',
            title: 'DVT Risk: ' + (d.risk_level || 'Unknown'),
            description: 'Score: ' + (d.score || 'N/A'),
            author: (d as any).assessed_by
          });
        }
      } catch(e) { console.warn('Timeline dvt:', e); }

      // 12. Pressure Sore Assessments
      try {
        const all = await db.pressure_sore_assessments.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id))) {
          timelineEvents.push({
            id: `ps_${p.id}`, date: safeDate(p.assessment_date), type: 'risk_assessment',
            title: 'Pressure Sore Risk: ' + (p.risk_level || 'Unknown'),
            description: 'Score: ' + (p.score || 'N/A'),
            author: (p as any).assessed_by
          });
        }
      } catch(e) { console.warn('Timeline pressure_sore:', e); }

      // 13. Nutritional Assessments
      try {
        const all = await db.nutritional_assessments.toArray();
        for (const n of all.filter((n: any) => matchPid(n.patient_id))) {
          timelineEvents.push({
            id: `nut_${n.id}`, date: safeDate(n.assessment_date), type: 'risk_assessment',
            title: 'Nutritional Risk: ' + (n.risk_level || 'Unknown'),
            description: 'Score: ' + (n.score || 'N/A') + (n.bmi ? '. BMI: ' + n.bmi : ''),
            author: (n as any).assessed_by
          });
        }
      } catch(e) { console.warn('Timeline nutritional:', e); }

      // 14. Pre-operative Assessments
      try {
        const all = await db.preoperative_assessments.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id))) {
          timelineEvents.push({
            id: `preop_${p.id}`, date: safeDate(p.assessed_at || p.created_at), type: 'procedure',
            title: 'Pre-operative Assessment',
            description: 'ASA: ' + ((p as any).asa_class || 'N/A') + '. Fitness: ' + ((p as any).fitness_status || 'N/A'),
            author: p.assessed_by
          });
        }
      } catch(e) { console.warn('Timeline preop:', e); }

      // 15. Discharges
      try {
        const all = await db.discharges.toArray();
        for (const d of all.filter((d: any) => matchPid(d.patient_id))) {
          timelineEvents.push({
            id: `dc_${d.id}`, date: safeDate(d.discharge_date), type: 'discharge',
            title: 'Discharged - ' + ((d as any).discharge_status || 'N/A'),
            description: 'Follow-up: ' + ((d as any).follow_up_plan || 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline discharges:', e); }

      // 16. Blood Transfusions
      try {
        const all = await db.blood_transfusions.toArray();
        for (const t of all.filter((t: any) => matchPid(t.patient_id))) {
          timelineEvents.push({
            id: `bt_${t.id}`, date: safeDate((t as any).transfusion_date || (t as any).created_at), type: 'transfusion',
            title: 'Blood Transfusion: ' + ((t as any).blood_product || 'N/A'),
            description: 'Units: ' + ((t as any).units || 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline transfusions:', e); }

      // Sort by date descending
      timelineEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
      setEvents(timelineEvents);
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'admission': return <UserCheck className="h-4 w-4" />;
      case 'ward_round': return <Stethoscope className="h-4 w-4" />;
      case 'treatment_plan': return <Clipboard className="h-4 w-4" />;
      case 'procedure': return <Scissors className="h-4 w-4" />;
      case 'lab': return <FileText className="h-4 w-4" />;
      case 'prescription': return <Pill className="h-4 w-4" />;
      case 'wound_care': return <Activity className="h-4 w-4" />;
      case 'risk_assessment': return <AlertTriangle className="h-4 w-4" />;
      case 'transfusion': return <Droplet className="h-4 w-4" />;
      case 'discharge': return <Clock className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'admission': return 'bg-blue-500';
      case 'ward_round': return 'bg-green-500';
      case 'treatment_plan': return 'bg-teal-500';
      case 'procedure': return 'bg-purple-500';
      case 'lab': return 'bg-yellow-500';
      case 'prescription': return 'bg-orange-500';
      case 'wound_care': return 'bg-pink-500';
      case 'risk_assessment': return 'bg-amber-500';
      case 'transfusion': return 'bg-red-400';
      case 'discharge': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">No timeline events yet</p>
        <p className="text-sm">Events will appear here as clinical activities are documented.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-green-600" />
        Patient Timeline
      </h3>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
        {events.map((event) => (
          <div key={event.id} className="relative pl-10 pb-6">
            <div className={`absolute left-2.5 w-3 h-3 rounded-full ${getEventColor(event.type)} ring-2 ring-white`} />
            <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {getEventIcon(event.type)}
                  {event.title}
                </div>
                <span className="text-xs text-gray-500">
                  {format(event.date, 'dd MMM yyyy, HH:mm')}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
              {event.author && (
                <p className="text-xs text-gray-400 mt-1">By: {event.author}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PatientChronologicalTimeline;
