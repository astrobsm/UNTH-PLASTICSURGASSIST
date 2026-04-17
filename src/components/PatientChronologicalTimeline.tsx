import React, { useState, useEffect } from 'react';
import { Clock, FileText, Activity, Pill, Stethoscope, Clipboard, Scissors, Droplet, AlertTriangle, UserCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../db/database';
import { displayArrayField } from '../services/patientService';
import { format } from 'date-fns';

interface PatientChronologicalTimelineProps {
  patientId: string;
  hospitalNumber: string;
}

interface TimelineDetail {
  label: string;
  value: string;
}

interface TimelineEvent {
  id: string;
  date: Date;
  type: string;
  title: string;
  description: string;
  author?: string;
  details?: TimelineDetail[];
}

// Safely convert any value to a renderable string (prevents React Error #31)
function safeTxt(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
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
          const ad = a as any;
          timelineEvents.push({
            id: `adm_${a.id}`, date: safeDate(a.admission_date), type: 'admission',
            title: 'Admitted to ' + (a.ward_location || 'Ward'),
            description: 'Route: ' + (a.route_of_admission || 'N/A') + '. Dx: ' + (a.diagnosis || ad.admitting_diagnosis || 'N/A'),
            author: ad.consultant || ad.admitting_consultant,
            details: [
              { label: 'Ward', value: a.ward_location || 'N/A' },
              { label: 'Bed', value: ad.bed_number || 'N/A' },
              { label: 'Route of Admission', value: a.route_of_admission || 'N/A' },
              { label: 'Diagnosis', value: a.diagnosis || ad.admitting_diagnosis || 'N/A' },
              { label: 'Consultant', value: ad.consultant || ad.admitting_consultant || 'N/A' },
              ...(ad.presenting_complaint ? [{ label: 'Presenting Complaint', value: ad.presenting_complaint }] : []),
              ...(ad.history_of_present_illness ? [{ label: 'HPI', value: ad.history_of_present_illness }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
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
            description: safeTxt(r.clinical_notes || r.assessment || r.plan || 'Ward round documented'),
            author: safeTxt(r.reviewing_doctor || r.doctor_name || r.consultant),
            details: [
              ...(r.chief_complaint ? [{ label: 'Chief Complaint', value: safeTxt(r.chief_complaint) }] : []),
              ...(r.clinical_notes ? [{ label: 'Clinical Notes', value: safeTxt(r.clinical_notes) }] : []),
              ...(r.examination_findings ? [{ label: 'Examination', value: safeTxt(r.examination_findings) }] : []),
              ...(r.assessment ? [{ label: 'Assessment', value: safeTxt(r.assessment) }] : []),
              ...(r.plan ? [{ label: 'Plan', value: safeTxt(r.plan) }] : []),
              ...(r.clinical_status ? [{ label: 'Clinical Status', value: safeTxt(r.clinical_status) }] : []),
              ...(r.temperature ? [{ label: 'Temp', value: r.temperature + '°C' }] : []),
              ...(r.blood_pressure ? [{ label: 'BP', value: safeTxt(r.blood_pressure) }] : []),
              ...(r.pulse ? [{ label: 'Pulse', value: r.pulse + ' bpm' }] : []),
              ...(r.spo2 ? [{ label: 'SpO₂', value: r.spo2 + '%' }] : []),
              ...(r.follow_up_plan ? [{ label: 'Follow-up', value: safeTxt(r.follow_up_plan) }] : []),
            ],
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
            description: safeTxt(r.clinical_notes || r.assessment || 'Clinical ward round documented') + (r.chief_complaint ? '. CC: ' + r.chief_complaint : ''),
            author: safeTxt(r.reviewed_by || r.reviewing_doctor),
            details: [
              ...(r.chief_complaint ? [{ label: 'Chief Complaint', value: safeTxt(r.chief_complaint) }] : []),
              ...(r.clinical_notes ? [{ label: 'Clinical Notes', value: safeTxt(r.clinical_notes) }] : []),
              ...(r.examination_findings ? [{ label: 'Examination', value: safeTxt(r.examination_findings) }] : []),
              ...(r.assessment ? [{ label: 'Assessment', value: safeTxt(r.assessment) }] : []),
              ...(r.plan ? [{ label: 'Plan', value: safeTxt(r.plan) }] : []),
              ...(r.clinical_status ? [{ label: 'Status', value: safeTxt(r.clinical_status) }] : []),
              ...(r.temperature ? [{ label: 'Temp', value: r.temperature + '°C' }] : []),
              ...(r.blood_pressure ? [{ label: 'BP', value: safeTxt(r.blood_pressure) }] : []),
              ...(r.pulse ? [{ label: 'Pulse', value: r.pulse + ' bpm' }] : []),
            ],
          });
        }
      } catch(e) { console.warn('Timeline ward_rounds_clinical:', e); }

      // 4. Treatment Plans
      try {
        const all = await db.treatment_plans.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id) && !p.deleted)) {
          const tp = p as any;
          timelineEvents.push({
            id: `tp_${p.id}`, date: safeDate(p.created_at), type: 'treatment_plan',
            title: 'Treatment Plan: ' + (tp.diagnosis || p.title || 'Untitled'),
            description: 'Status: ' + (p.status || 'active') + '. ' + (tp.description || ''),
            author: tp.created_by,
            details: [
              { label: 'Status', value: p.status || 'active' },
              ...(tp.diagnosis ? [{ label: 'Diagnosis', value: tp.diagnosis }] : []),
              ...(tp.description ? [{ label: 'Description', value: tp.description }] : []),
              ...(tp.procedures && tp.procedures.length ? [{ label: 'Procedures', value: tp.procedures.map((pr: any) => pr.name || pr.procedure_name || pr).join(', ') }] : []),
              ...(tp.medications && tp.medications.length ? [{ label: 'Medications', value: tp.medications.map((m: any) => `${m.name || m.medication_name || m} ${m.dose || ''} ${m.frequency || ''}`.trim()).join('; ') }] : []),
              ...(tp.goals ? [{ label: 'Goals', value: tp.goals }] : []),
              ...(tp.target_date ? [{ label: 'Target Date', value: format(safeDate(tp.target_date), 'dd MMM yyyy') }] : []),
            ],
          });
        }
      } catch(e) { console.warn('Timeline treatment_plans:', e); }

      // 5. Surgery Bookings
      try {
        const all = await db.surgery_bookings.toArray();
        for (const b of all.filter((b: any) => matchPid(b.patient_id))) {
          const sb = b as any;
          timelineEvents.push({
            id: `surg_${b.id}`, date: safeDate(b.date), type: 'procedure',
            title: 'Surgery: ' + (sb.procedure_name || sb.procedure || 'Procedure'),
            description: 'Theatre ' + (b.theatre_number || 'N/A') + '. Status: ' + (b.status || 'N/A'),
            author: b.primary_surgeon,
            details: [
              { label: 'Procedure', value: sb.procedure_name || sb.procedure || 'N/A' },
              { label: 'Status', value: b.status || 'N/A' },
              { label: 'Theatre', value: b.theatre_number || 'N/A' },
              { label: 'Surgeon', value: b.primary_surgeon || 'N/A' },
              ...(sb.assistant_surgeon ? [{ label: 'Assistant', value: sb.assistant_surgeon }] : []),
              ...(sb.anaesthetist ? [{ label: 'Anaesthetist', value: sb.anaesthetist }] : []),
              ...(sb.anaesthesia_type ? [{ label: 'Anaesthesia', value: sb.anaesthesia_type }] : []),
              ...(sb.estimated_duration ? [{ label: 'Est. Duration', value: sb.estimated_duration }] : []),
              ...(sb.pre_op_diagnosis ? [{ label: 'Pre-op Dx', value: sb.pre_op_diagnosis }] : []),
              ...(sb.special_requirements ? [{ label: 'Special Req.', value: sb.special_requirements }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline surgery_bookings:', e); }

      // 6. Procedures
      try {
        const all = await db.procedures.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id))) {
          const pr = p as any;
          timelineEvents.push({
            id: `proc_${p.id}`, date: safeDate(p.scheduled_date || p.created_at), type: 'procedure',
            title: (p.procedure_name || p.procedure_type || 'Procedure'),
            description: 'Status: ' + (p.status || 'N/A'),
            author: p.surgeon,
            details: [
              { label: 'Procedure', value: p.procedure_name || p.procedure_type || 'N/A' },
              { label: 'Status', value: p.status || 'N/A' },
              ...(p.surgeon ? [{ label: 'Surgeon', value: p.surgeon }] : []),
              ...(pr.findings ? [{ label: 'Findings', value: pr.findings }] : []),
              ...(pr.complications ? [{ label: 'Complications', value: pr.complications }] : []),
              ...(pr.notes ? [{ label: 'Notes', value: pr.notes }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline procedures:', e); }

      // 7. Lab Investigations
      try {
        const all = await db.lab_investigations.toArray();
        for (const l of all.filter((l: any) => matchPid(l.patient_id))) {
          const lb = l as any;
          timelineEvents.push({
            id: `lab_${l.id}`, date: safeDate(l.request_date), type: 'lab',
            title: 'Lab: ' + (lb.test_name || lb.investigation_type || 'Investigation'),
            description: 'Status: ' + (l.status || 'pending') + '. Urgency: ' + (l.urgency || 'routine'),
            author: l.requested_by,
            details: [
              { label: 'Test', value: lb.test_name || lb.investigation_type || 'N/A' },
              { label: 'Status', value: l.status || 'pending' },
              { label: 'Urgency', value: l.urgency || 'routine' },
              ...(lb.specimen_type ? [{ label: 'Specimen', value: lb.specimen_type }] : []),
              ...(lb.clinical_indication ? [{ label: 'Indication', value: lb.clinical_indication }] : []),
              ...(lb.notes ? [{ label: 'Notes', value: lb.notes }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline labs:', e); }

      // 8. Lab Results
      try {
        const all = await db.lab_results.toArray();
        for (const r of all.filter((r: any) => matchPid(r.patient_id))) {
          const lr = r as any;
          timelineEvents.push({
            id: `labres_${r.id}`, date: safeDate(r.result_date), type: 'lab',
            title: 'Lab Result: ' + (lr.test_name || 'Result'),
            description: 'Value: ' + (lr.result_value || lr.value || 'N/A') + '. ' + (r.abnormal_flag ? 'ABNORMAL' : 'Normal'),
            details: [
              { label: 'Test', value: lr.test_name || 'N/A' },
              { label: 'Result', value: lr.result_value || lr.value || 'N/A' },
              ...(lr.unit ? [{ label: 'Unit', value: lr.unit }] : []),
              ...(lr.reference_range ? [{ label: 'Reference Range', value: lr.reference_range }] : []),
              { label: 'Flag', value: r.abnormal_flag ? '⚠ ABNORMAL' : '✓ Normal' },
              ...(lr.comments ? [{ label: 'Comments', value: lr.comments }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline lab_results:', e); }

      // 9. Prescriptions
      try {
        const all = await db.prescriptions.toArray();
        for (const rx of all.filter((r: any) => matchPid(r.patient_id))) {
          const med = rx as any;
          timelineEvents.push({
            id: `rx_${rx.id}`, date: safeDate(rx.prescribed_date || rx.created_at), type: 'prescription',
            title: 'Rx: ' + (rx.medication_name || 'Medication'),
            description: [rx.dosage, rx.route, rx.frequency].filter(Boolean).join(' ') + '. Status: ' + (rx.status || 'active'),
            author: rx.prescribed_by,
            details: [
              { label: 'Medication', value: rx.medication_name || 'N/A' },
              { label: 'Dosage', value: rx.dosage || 'N/A' },
              { label: 'Route', value: rx.route || 'N/A' },
              { label: 'Frequency', value: rx.frequency || 'N/A' },
              { label: 'Status', value: rx.status || 'active' },
              ...(med.duration ? [{ label: 'Duration', value: med.duration }] : []),
              ...(med.start_date ? [{ label: 'Start Date', value: format(safeDate(med.start_date), 'dd MMM yyyy') }] : []),
              ...(med.end_date ? [{ label: 'End Date', value: format(safeDate(med.end_date), 'dd MMM yyyy') }] : []),
              ...(med.instructions ? [{ label: 'Instructions', value: med.instructions }] : []),
              ...(med.indication ? [{ label: 'Indication', value: med.indication }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline prescriptions:', e); }

      // 10. Wound Care
      try {
        const all = await db.wound_care.toArray();
        for (const w of all.filter((w: any) => matchPid(w.patient_id))) {
          const wc = w as any;
          timelineEvents.push({
            id: `wc_${w.id}`, date: safeDate(w.assessment_date || w.created_at), type: 'wound_care',
            title: 'Wound: ' + (w.wound_type || 'Assessment') + ' - ' + (w.wound_location || 'N/A'),
            description: 'Stage: ' + (wc.wound_stage || 'N/A'),
            author: wc.assessed_by,
            details: [
              { label: 'Type', value: w.wound_type || 'N/A' },
              { label: 'Location', value: w.wound_location || 'N/A' },
              ...(wc.wound_stage ? [{ label: 'Stage', value: wc.wound_stage }] : []),
              ...(wc.wound_size ? [{ label: 'Size', value: wc.wound_size }] : []),
              ...(wc.wound_bed ? [{ label: 'Wound Bed', value: wc.wound_bed }] : []),
              ...(wc.exudate ? [{ label: 'Exudate', value: wc.exudate }] : []),
              ...(wc.surrounding_skin ? [{ label: 'Surrounding Skin', value: wc.surrounding_skin }] : []),
              ...(wc.dressing_type ? [{ label: 'Dressing', value: wc.dressing_type }] : []),
              ...(wc.treatment_notes ? [{ label: 'Treatment Notes', value: wc.treatment_notes }] : []),
              ...(wc.pain_level !== undefined && wc.pain_level !== null ? [{ label: 'Pain Level', value: String(wc.pain_level) }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline wound_care:', e); }

      // 11. DVT Risk Assessments
      try {
        const all = await db.dvt_assessments.toArray();
        for (const d of all.filter((d: any) => matchPid(d.patient_id))) {
          const dv = d as any;
          timelineEvents.push({
            id: `dvt_${d.id}`, date: safeDate(d.assessment_date), type: 'risk_assessment',
            title: 'DVT Risk: ' + (d.risk_level || 'Unknown'),
            description: 'Score: ' + (d.score || 'N/A'),
            author: dv.assessed_by,
            details: [
              { label: 'Risk Level', value: d.risk_level || 'Unknown' },
              { label: 'Score', value: String(d.score ?? 'N/A') },
              ...(dv.prophylaxis ? [{ label: 'Prophylaxis', value: dv.prophylaxis }] : []),
              ...(dv.risk_factors ? [{ label: 'Risk Factors', value: (() => {
                if (typeof dv.risk_factors === 'string') return dv.risk_factors;
                if (Array.isArray(dv.risk_factors)) return dv.risk_factors.join(', ');
                if (typeof dv.risk_factors === 'object' && dv.risk_factors !== null) {
                  const labels: Record<string, string> = {
                    age_41_60: 'Age 41-60', age_61_74: 'Age 61-74', age_over_75: 'Age >75',
                    minor_surgery: 'Minor Surgery', bmi_over_25: 'BMI >25', swollen_legs: 'Swollen Legs',
                    varicose_veins: 'Varicose Veins', pregnancy_postpartum: 'Pregnancy/Postpartum',
                    oral_contraceptives: 'OCP/HRT', sepsis_1month: 'Sepsis <1 month',
                    serious_lung_disease: 'Serious Lung Disease', abnormal_pulmonary: 'Abnormal Pulmonary',
                    acute_mi: 'Acute MI', chf_1month: 'CHF <1 month',
                    inflammatory_bowel: 'IBD', medical_patient_bedrest: 'Medical Patient on Bed Rest',
                    arthroscopic_surgery: 'Arthroscopic Surgery', malignancy: 'Malignancy',
                    major_surgery_45min: 'Major Surgery >45min', laparoscopic_45min: 'Laparoscopic >45min',
                    patient_confined_bed: 'Confined to Bed', immobilizing_cast: 'Immobilizing Cast',
                    central_venous_access: 'Central Venous Access', personal_history_vte: 'Previous VTE',
                    family_history_vte: 'Family History VTE', factor_v_leiden: 'Factor V Leiden',
                    prothrombin_mutation: 'Prothrombin Mutation', elevated_homocysteine: 'Elevated Homocysteine',
                    lupus_anticoagulant: 'Lupus Anticoagulant', anticardiolipin_antibodies: 'Anticardiolipin Antibodies',
                    heparin_thrombocytopenia: 'HIT', other_thrombophilia: 'Other Thrombophilia',
                    stroke_1month: 'Stroke <1 month', elective_arthroplasty: 'Elective Arthroplasty',
                    hip_pelvis_fracture: 'Hip/Pelvis Fracture', acute_spinal_injury: 'Acute Spinal Cord Injury',
                  };
                  return Object.entries(dv.risk_factors)
                    .filter(([, v]) => v === true)
                    .map(([k]) => labels[k] || k.replace(/_/g, ' '))
                    .join(', ') || 'None identified';
                }
                return String(dv.risk_factors);
              })() }] : []),
              ...(dv.recommendations ? [{ label: 'Recommendations', value: dv.recommendations }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline dvt:', e); }

      // 12. Pressure Sore Assessments
      try {
        const all = await db.pressure_sore_assessments.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id))) {
          const ps = p as any;
          timelineEvents.push({
            id: `ps_${p.id}`, date: safeDate(p.assessment_date), type: 'risk_assessment',
            title: 'Pressure Sore Risk: ' + (p.risk_level || 'Unknown'),
            description: 'Score: ' + (p.score || 'N/A'),
            author: ps.assessed_by,
            details: [
              { label: 'Risk Level', value: p.risk_level || 'Unknown' },
              { label: 'Score', value: String(p.score ?? 'N/A') },
              ...(ps.skin_integrity ? [{ label: 'Skin Integrity', value: ps.skin_integrity }] : []),
              ...(ps.mobility_status ? [{ label: 'Mobility', value: ps.mobility_status }] : []),
              ...(ps.interventions ? [{ label: 'Interventions', value: ps.interventions }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline pressure_sore:', e); }

      // 13. Nutritional Assessments
      try {
        const all = await db.nutritional_assessments.toArray();
        for (const n of all.filter((n: any) => matchPid(n.patient_id))) {
          const na = n as any;
          timelineEvents.push({
            id: `nut_${n.id}`, date: safeDate(n.assessment_date), type: 'risk_assessment',
            title: 'Nutritional Risk: ' + (n.risk_level || 'Unknown'),
            description: 'Score: ' + (n.score || 'N/A') + (n.bmi ? '. BMI: ' + n.bmi : ''),
            author: na.assessed_by,
            details: [
              { label: 'Risk Level', value: n.risk_level || 'Unknown' },
              { label: 'Score', value: String(n.score ?? 'N/A') },
              ...(n.bmi ? [{ label: 'BMI', value: String(n.bmi) }] : []),
              ...(na.weight ? [{ label: 'Weight', value: na.weight + ' kg' }] : []),
              ...(na.height ? [{ label: 'Height', value: na.height + ' cm' }] : []),
              ...(na.diet_recommendation ? [{ label: 'Diet', value: na.diet_recommendation }] : []),
              ...(na.supplements ? [{ label: 'Supplements', value: na.supplements }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline nutritional:', e); }

      // 14. Pre-operative Assessments
      try {
        const all = await db.preoperative_assessments.toArray();
        for (const p of all.filter((p: any) => matchPid(p.patient_id))) {
          const po = p as any;
          timelineEvents.push({
            id: `preop_${p.id}`, date: safeDate(p.assessed_at || p.created_at), type: 'procedure',
            title: 'Pre-operative Assessment',
            description: 'ASA: ' + (po.asa_class || 'N/A') + '. Fitness: ' + (po.fitness_status || 'N/A'),
            author: p.assessed_by,
            details: [
              ...(po.asa_class ? [{ label: 'ASA Class', value: po.asa_class }] : []),
              ...(po.fitness_status ? [{ label: 'Fitness', value: po.fitness_status }] : []),
              ...(po.allergies ? [{ label: 'Allergies', value: displayArrayField(po.allergies) }] : []),
              ...(po.comorbidities ? [{ label: 'Comorbidities', value: displayArrayField(po.comorbidities) }] : []),
              ...(po.airway_assessment ? [{ label: 'Airway', value: po.airway_assessment }] : []),
              ...(po.cardiac_status ? [{ label: 'Cardiac', value: po.cardiac_status }] : []),
              ...(po.respiratory_status ? [{ label: 'Respiratory', value: po.respiratory_status }] : []),
              ...(po.fasting_status ? [{ label: 'Fasting', value: po.fasting_status }] : []),
              ...(po.consent_obtained !== undefined ? [{ label: 'Consent', value: po.consent_obtained ? 'Yes' : 'No' }] : []),
            ],
          });
        }
      } catch(e) { console.warn('Timeline preop:', e); }

      // 15. Discharges
      try {
        const all = await db.discharges.toArray();
        for (const d of all.filter((d: any) => matchPid(d.patient_id))) {
          const dc = d as any;
          timelineEvents.push({
            id: `dc_${d.id}`, date: safeDate(d.discharge_date), type: 'discharge',
            title: 'Discharged - ' + (dc.discharge_status || 'N/A'),
            description: 'Follow-up: ' + (dc.follow_up_plan || 'N/A'),
            details: [
              { label: 'Status', value: dc.discharge_status || 'N/A' },
              ...(dc.discharge_summary ? [{ label: 'Summary', value: dc.discharge_summary }] : []),
              ...(dc.discharge_diagnosis ? [{ label: 'Diagnosis at Discharge', value: dc.discharge_diagnosis }] : []),
              ...(dc.discharge_medications ? [{ label: 'Medications', value: Array.isArray(dc.discharge_medications) ? dc.discharge_medications.map((m: any) => typeof m === 'string' ? m : `${m.name} ${m.dose || ''} ${m.frequency || ''}`).join('; ') : dc.discharge_medications }] : []),
              ...(dc.follow_up_plan ? [{ label: 'Follow-up', value: dc.follow_up_plan }] : []),
              ...(dc.follow_up_date ? [{ label: 'Follow-up Date', value: format(safeDate(dc.follow_up_date), 'dd MMM yyyy') }] : []),
              ...(dc.instructions ? [{ label: 'Instructions', value: dc.instructions }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline discharges:', e); }

      // 16. Blood Transfusions
      try {
        const all = await db.blood_transfusions.toArray();
        for (const t of all.filter((t: any) => matchPid(t.patient_id))) {
          const bt = t as any;
          timelineEvents.push({
            id: `bt_${t.id}`, date: safeDate(bt.transfusion_date || bt.created_at), type: 'transfusion',
            title: 'Blood Transfusion: ' + (bt.blood_product || 'N/A'),
            description: 'Units: ' + (bt.units || 'N/A'),
            details: [
              { label: 'Blood Product', value: bt.blood_product || 'N/A' },
              { label: 'Units', value: String(bt.units ?? 'N/A') },
              ...(bt.blood_group ? [{ label: 'Blood Group', value: bt.blood_group }] : []),
              ...(bt.indication ? [{ label: 'Indication', value: bt.indication }] : []),
              ...(bt.pre_transfusion_hb ? [{ label: 'Pre-Hb', value: bt.pre_transfusion_hb }] : []),
              ...(bt.post_transfusion_hb ? [{ label: 'Post-Hb', value: bt.post_transfusion_hb }] : []),
              ...(bt.reaction ? [{ label: 'Reaction', value: bt.reaction }] : []),
              ...(bt.status ? [{ label: 'Status', value: bt.status }] : []),
            ].filter(d => d.value && d.value !== 'N/A'),
          });
        }
      } catch(e) { console.warn('Timeline transfusions:', e); }

      // 17. Progress Notes (from IndexedDB + API + localStorage)
      try {
        const seenNoteIds = new Set<string>();
        const addProgressNote = (pn: any, source: string) => {
          const noteKey = pn.id ? `pn_${pn.id}` : `pn_${source}_${pn.date || Math.random()}`;
          if (seenNoteIds.has(noteKey)) return;
          seenNoteIds.add(noteKey);
          const soap = pn.soap || {};
          timelineEvents.push({
            id: noteKey, date: safeDate(pn.date || pn.created_at), type: 'ward_round',
            title: 'Progress Note (SOAP)',
            description: soap.subjective ? soap.subjective.substring(0, 120) + (soap.subjective.length > 120 ? '...' : '') : 'Progress note documented',
            author: pn.author,
            details: [
              ...(soap.subjective ? [{ label: 'Subjective', value: soap.subjective }] : []),
              ...(soap.objective ? [{ label: 'Objective', value: soap.objective }] : []),
              ...(soap.assessment ? [{ label: 'Assessment', value: soap.assessment }] : []),
              ...(soap.plan ? [{ label: 'Plan', value: soap.plan }] : []),
              ...(pn.vital_signs?.temperature ? [{ label: 'Temp', value: pn.vital_signs.temperature + '°C' }] : []),
              ...(pn.vital_signs?.bloodPressure ? [{ label: 'BP', value: pn.vital_signs.bloodPressure }] : []),
              ...(pn.vital_signs?.pulse ? [{ label: 'Pulse', value: pn.vital_signs.pulse + ' bpm' }] : []),
              ...(pn.vital_signs?.respiratoryRate ? [{ label: 'Resp Rate', value: pn.vital_signs.respiratoryRate + ' rpm' }] : []),
              ...(pn.vital_signs?.oxygenSaturation ? [{ label: 'SpO₂', value: pn.vital_signs.oxygenSaturation + '%' }] : []),
              ...(pn.vital_signs?.painScore ? [{ label: 'Pain', value: pn.vital_signs.painScore + '/10' }] : []),
              ...(pn.clinical_images?.length ? [{ label: 'Images', value: `${pn.clinical_images.length} clinical image(s) attached` }] : []),
            ],
          });
        };

        // Source 1: IndexedDB (synced from server)
        try {
          if (db.progress_notes) {
            const dbNotes = await db.progress_notes.toArray();
            for (const pn of dbNotes.filter((n: any) => matchPid(n.patient_id))) {
              addProgressNote(pn, 'db');
            }
          }
        } catch(e) { console.warn('Timeline progress notes (IndexedDB):', e); }

        // Source 2: localStorage fallback (for notes saved before IndexedDB table existed)
        try {
          const localNotes: any[] = JSON.parse(localStorage.getItem('progressNotes') || '[]');
          for (const pn of localNotes.filter((n: any) => matchPid(n.patient_id))) {
            addProgressNote(pn, 'local');
          }
        } catch(e) { /* ignore localStorage errors */ }
      } catch(e) { console.warn('Timeline progress notes:', e); }

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
          <TimelineCard key={event.id} event={event} getEventIcon={getEventIcon} getEventColor={getEventColor} />
        ))}
      </div>
    </div>
  );
}

/** Expandable timeline card */
function TimelineCard({
  event,
  getEventIcon,
  getEventColor,
}: {
  event: TimelineEvent;
  getEventIcon: (type: string) => React.ReactNode;
  getEventColor: (type: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = event.details && event.details.length > 0;

  return (
    <div className="relative pl-10 pb-6">
      <div className={`absolute left-2.5 w-3 h-3 rounded-full ${getEventColor(event.type)} ring-2 ring-white`} />
      <div
        className={`bg-white border border-gray-200 rounded-lg shadow-sm transition-all ${hasDetails ? 'cursor-pointer hover:border-gray-300 hover:shadow-md' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
              {getEventIcon(event.type)}
              <span>{safeTxt(event.title)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {format(event.date, 'dd MMM yyyy, HH:mm')}
              </span>
              {hasDetails && (
                <span className="text-gray-400 ml-1">
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              )}
            </div>
          </div>
          <p className={`text-sm text-gray-600 ${expanded ? '' : 'line-clamp-2'}`}>{safeTxt(event.description)}</p>
          {event.author && (
            <p className="text-xs text-gray-400 mt-1">By: {safeTxt(event.author)}</p>
          )}
        </div>

        {/* Expanded Details */}
        {expanded && hasDetails && (
          <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 rounded-b-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
              {event.details!.map((detail, idx) => {
                const safeValue = typeof detail.value === 'object' && detail.value !== null
                  ? JSON.stringify(detail.value)
                  : String(detail.value ?? '');
                const isLongText = safeValue.length > 80;
                if (isLongText) {
                  return (
                    <div key={idx} className="col-span-1 sm:col-span-2 py-1">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{detail.label}</span>
                      <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{safeValue}</p>
                    </div>
                  );
                }
                return (
                  <div key={idx} className="flex items-baseline gap-1.5 py-0.5">
                    <span className="text-xs font-semibold text-gray-500 shrink-0">{detail.label}:</span>
                    <span className="text-sm text-gray-800">{safeValue}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientChronologicalTimeline;
