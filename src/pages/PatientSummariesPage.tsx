import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Loader, User, Calendar, Activity, AlertCircle, 
  TrendingUp, Clock, Stethoscope, Pill, Scissors, 
  ClipboardList, Heart, Shield, Eye, ChevronDown, ChevronUp,
  MapPin, Droplet, Flame
} from 'lucide-react';
import { db } from '../db/database';
import { patientService } from '../services/patientService';
import { useOnSelectedPatient } from '../hooks/useSelectedPatient';
import { safeFormatDate, calculateAge } from '../utils/dateUtils';
import {
  createPDF,
  sanitizeTextForPDF,
  PDF_MARGINS,
  
  addFooter
} from '../utils/pdfUtils';

// Timeline entry type
interface TimelineEntry {
  id: string;
  date: Date;
  type: string;
  title: string;
  summary: string;
  details: Record<string, any>;
}

const TYPE_CONFIG: Record<string, { label: string; bgColor: string; textColor: string; borderColor: string }> = {
  registration: { label: 'Registration', bgColor: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-300' },
  admission: { label: 'Admission', bgColor: 'bg-green-50', textColor: 'text-green-700', borderColor: 'border-green-300' },
  ward_round: { label: 'Ward Round', bgColor: 'bg-indigo-50', textColor: 'text-indigo-700', borderColor: 'border-indigo-300' },
  treatment_plan: { label: 'Treatment Plan', bgColor: 'bg-purple-50', textColor: 'text-purple-700', borderColor: 'border-purple-300' },
  preop_assessment: { label: 'Pre-op Assessment', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-300' },
  surgery_booking: { label: 'Surgery Booking', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-300' },
  lab_investigation: { label: 'Lab Investigation', bgColor: 'bg-cyan-50', textColor: 'text-cyan-700', borderColor: 'border-cyan-300' },
  lab_result: { label: 'Lab Result', bgColor: 'bg-teal-50', textColor: 'text-teal-700', borderColor: 'border-teal-300' },
  dvt_assessment: { label: 'DVT Assessment', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', borderColor: 'border-yellow-300' },
  pressure_sore_assessment: { label: 'Pressure Sore', bgColor: 'bg-pink-50', textColor: 'text-pink-700', borderColor: 'border-pink-300' },
  nutritional_assessment: { label: 'Nutritional', bgColor: 'bg-lime-50', textColor: 'text-lime-700', borderColor: 'border-lime-300' },
  wound_care: { label: 'Wound Care', bgColor: 'bg-amber-50', textColor: 'text-amber-700', borderColor: 'border-amber-300' },
  prescription: { label: 'Prescription', bgColor: 'bg-sky-50', textColor: 'text-sky-700', borderColor: 'border-sky-300' },
  mdt_meeting: { label: 'MDT Meeting', bgColor: 'bg-violet-50', textColor: 'text-violet-700', borderColor: 'border-violet-300' },
  mdt_contact: { label: 'MDT Contact', bgColor: 'bg-fuchsia-50', textColor: 'text-fuchsia-700', borderColor: 'border-fuchsia-300' },
  discharge: { label: 'Discharge', bgColor: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-300' },
  burn_assessment: { label: 'Burn Assessment', bgColor: 'bg-orange-50', textColor: 'text-orange-700', borderColor: 'border-orange-300' },
  diabetic_foot: { label: 'Diabetic Foot', bgColor: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-300' },
  blood_transfusion: { label: 'Blood Transfusion', bgColor: 'bg-red-50', textColor: 'text-red-700', borderColor: 'border-red-300' },
  gfr_calculation: { label: 'GFR Calculation', bgColor: 'bg-teal-50', textColor: 'text-teal-700', borderColor: 'border-teal-300' },
};

function safeDate(val: any): Date {
  if (!val) return new Date(0);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function getTypeIcon(type: string): React.ReactNode {
  const s = "w-4 h-4";
  const icons: Record<string, React.ReactNode> = {
    registration: <User className={s} />,
    admission: <MapPin className={s} />,
    ward_round: <Stethoscope className={s} />,
    treatment_plan: <ClipboardList className={s} />,
    preop_assessment: <Shield className={s} />,
    surgery_booking: <Scissors className={s} />,
    lab_investigation: <Activity className={s} />,
    lab_result: <Activity className={s} />,
    dvt_assessment: <Heart className={s} />,
    pressure_sore_assessment: <Eye className={s} />,
    nutritional_assessment: <TrendingUp className={s} />,
    wound_care: <AlertCircle className={s} />,
    prescription: <Pill className={s} />,
    mdt_meeting: <Calendar className={s} />,
    mdt_contact: <Clock className={s} />,
    discharge: <FileText className={s} />,
    burn_assessment: <Flame className={s} />,
    diabetic_foot: <Heart className={s} />,
    blood_transfusion: <Droplet className={s} />,
    gfr_calculation: <Activity className={s} />,
  };
  return icons[type] || <FileText className={s} />;
}

const PatientSummariesPage: React.FC = () => {
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  useOnSelectedPatient((p) => setSelectedPatient(String(p.id)));
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [patientInfo, setPatientInfo] = useState<any>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      loadPatientTimeline();
    } else {
      setTimeline([]);
      setPatientInfo(null);
    }
  }, [selectedPatient]);

  const loadPatients = async () => {
    try {
      const patientsData = await patientService.getAllPatients();
      setPatients(patientsData);
    } catch (error) {
      console.error('Error loading patients:', error);
    }
  };

  const loadPatientTimeline = async () => {
    if (!selectedPatient) return;
    setLoading(true);
    try {
      const patient = patients.find(p => String(p.id) === String(selectedPatient));
      setPatientInfo(patient);
      const pid = String(selectedPatient);
      const pidNum = Number(selectedPatient);
      const entries: TimelineEntry[] = [];

      // Helper to match patient_id
      const matchPid = (val: any) => String(val) === pid || String(val) === String(pidNum);

      // 1. Registration
      if (patient) {
        const patientAge = calculateAge(patient.date_of_birth || patient.dob);
        entries.push({
          id: 'reg_' + patient.id, date: safeDate(patient.created_at || patient.registration_date),
          type: 'registration', title: 'Patient Registration',
          summary: patient.first_name + ' ' + patient.last_name + ' (MRN: ' + patient.hospital_number + '). ' + (patientAge != null ? patientAge + '-year-old' : 'Age not documented') + ' ' + (patient.gender || '') + (patient.diagnosis ? '. Presenting Dx: ' + patient.diagnosis : '') + (patient.blood_group ? '. Blood Group: ' + patient.blood_group : ''),
          details: { 'Medical Record Number': patient.hospital_number, 'Patient Name': patient.first_name + ' ' + patient.last_name, 'Sex': patient.gender, 'Age': patientAge != null ? patientAge + ' years' : 'Not documented', 'Date of Birth': safeFormatDate(patient.date_of_birth, 'MMM d, yyyy'), 'Contact': patient.phone, 'Address': patient.address, 'Presenting Diagnosis': patient.diagnosis, 'Blood Group': patient.blood_group, 'Next of Kin': patient.next_of_kin_name },
        });
      }

      // 2. Admissions
      try {
        const all = await db.admissions.toArray();
        for (const a of all.filter(a => matchPid(a.patient_id))) {
          entries.push({ id: 'adm_' + a.id, date: safeDate(a.admission_date), type: 'admission',
            title: 'Admitted to ' + (a.ward_location || 'Ward'),
            summary: 'Route of admission: ' + (a.route_of_admission || 'Not specified') + '. Status: ' + (a.status || 'active') + '. Provisional Dx: ' + ((a as any).provisional_diagnosis || a.diagnosis || (a as any).reasons_for_admission || 'Not specified'),
            details: { 'Ward/Location': a.ward_location, 'Route of Admission': a.route_of_admission, 'Admission Status': a.status, 'Provisional Diagnosis': (a as any).provisional_diagnosis || a.diagnosis || (a as any).reasons_for_admission, 'Admitting Consultant': (a as any).admitting_consultant || (a as any).consultant, 'Admitting Doctor': (a as any).admitting_doctor, 'Unit': (a as any).admitting_unit, 'Bed Number': (a as any).bed_number },
          });
        }
      } catch(e) { console.warn('admissions:', e); }

      // 3. Ward Rounds
      try {
        const all = await db.ward_rounds.toArray();
        for (const wr of all.filter((r: any) => matchPid(r.patient_id))) {
          const r = wr as any;
          const vitalsStr = r.temperature ? 'T: ' + r.temperature + '�C, PR: ' + r.pulse + '/min, BP: ' + r.bp_systolic + '/' + r.bp_diastolic + ' mmHg, RR: ' + r.respiratory_rate + '/min, SpO2: ' + r.spo2 + '%' : null;
          entries.push({ id: 'wr_' + r.id, date: safeDate(r.round_date), type: 'ward_round',
            title: (r.round_type || 'Ward Round').replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            summary: 'Reviewed by ' + (r.reviewing_doctor || 'Attending physician') + '. Clinical status: ' + (r.progress_status || 'Not documented') + (r.chief_complaint ? '. Presenting complaint: ' + r.chief_complaint : ''),
            details: { 'Round Type': r.round_type, 'Reviewing Clinician': r.reviewing_doctor, 'Clinical Progress': r.progress_status, 'Presenting Complaint': r.chief_complaint, 'Clinical Notes': r.clinical_notes, 'Examination Findings': r.examination_findings, 'Vital Signs': vitalsStr, 'Management Plan': r.follow_up_plan, 'Medication Changes': r.medication_changes, 'Wound Assessment': r.wound_notes, 'Complications': r.complications },
          });
        }
      } catch(e) { console.warn('ward_rounds:', e); }

      // 4. Treatment Plans
      try {
        const all = await db.treatment_plans.toArray();
        for (const p of all.filter(p => matchPid(p.patient_id))) {
          const revs = p.reviews || (p as any).follow_up_schedule || [];
          const meds = (p as any).medications || [];
          const procs = (p as any).procedures || [];
          entries.push({ id: 'tp_' + p.id, date: safeDate(p.created_at || (p as any).admission_date), type: 'treatment_plan',
            title: 'Treatment Plan: ' + ((p as any).diagnosis || p.title || 'Untitled'),
            summary: 'Plan status: ' + (p.status || 'active') + '. ' + revs.length + ' clinical reviews, ' + meds.length + ' medications prescribed, ' + procs.length + ' procedures planned.',
            details: { 'Working Diagnosis': (p as any).diagnosis, 'Treatment Modality': (p as any).treatment_type, 'Plan Description': (p as any).description, 'Current Status': p.status, 'Clinical Notes': (p as any).notes },
          });
        }
      } catch(e) { console.warn('treatment_plans:', e); }

      // 5. Pre-operative Assessments
      try {
        const all = await db.preoperative_assessments.toArray();
        for (const p of all.filter(p => matchPid(p.patient_id))) {
          entries.push({ id: 'preop_' + p.id, date: safeDate(p.assessed_at || (p as any).created_at), type: 'preop_assessment',
            title: 'Pre-operative Assessment',
            summary: 'Assessed by ' + (p.assessed_by || 'Anaesthesia team') + '. ASA Classification: ' + ((p as any).asa_class ? 'ASA ' + (p as any).asa_class : 'Not graded') + '. Fitness for surgery: ' + ((p as any).fitness_status || (p as any).fitness_for_surgery || 'Pending'),
            details: { 'Assessing Clinician': p.assessed_by || 'Not documented', 'ASA Classification': (p as any).asa_class ? 'ASA ' + (p as any).asa_class : 'Not graded', 'Fitness for Surgery': (p as any).fitness_status || (p as any).fitness_for_surgery, 'Drug Allergies': (p as any).allergies, 'Comorbidities': (p as any).comorbidities, 'Airway Assessment': (p as any).airway_assessment, 'Anaesthesia Plan': (p as any).anaesthesia_plan },
          });
        }
      } catch(e) { console.warn('preop_assessments:', e); }

      // 6. Surgery Bookings
      try {
        const all = await db.surgery_bookings.toArray();
        for (const b of all.filter(b => matchPid(b.patient_id))) {
          entries.push({ id: 'surg_' + b.id, date: safeDate(b.date), type: 'surgery_booking',
            title: 'Surgical Booking: ' + ((b as any).procedure_name || (b as any).procedure || 'Procedure'),
            summary: 'Operating Theatre ' + (b.theatre_number || 'TBD') + '. Lead Surgeon: ' + (b.primary_surgeon || 'Not assigned') + '. Booking Status: ' + (b.status || 'Pending'),
            details: { 'Planned Procedure': (b as any).procedure_name, 'Operating Theatre': b.theatre_number, 'Lead Surgeon': b.primary_surgeon, 'Booking Status': b.status, 'Anaesthetist': (b as any).anaesthetist, 'Priority': (b as any).priority },
          });
        }
      } catch(e) { console.warn('surgery_bookings:', e); }

      // 7. Lab Investigations
      try {
        const all = await db.lab_investigations.toArray();
        for (const l of all.filter(l => matchPid(l.patient_id))) {
          entries.push({ id: 'lab_' + l.id, date: safeDate(l.request_date), type: 'lab_investigation',
            title: 'Investigation: ' + ((l as any).test_name || (l as any).investigation_type || 'Laboratory Test'),
            summary: 'Ordered by ' + (l.requested_by || 'Requesting clinician') + '. Status: ' + (l.status || 'pending') + '. Priority: ' + (l.urgency || 'routine'),
            details: { 'Investigation': (l as any).test_name || (l as any).investigation_type, 'Ordering Clinician': l.requested_by, 'Status': l.status, 'Priority': l.urgency, 'Clinical Information': (l as any).clinical_details },
          });
        }
      } catch(e) { console.warn('lab_investigations:', e); }

      // 8. Lab Results
      try {
        const all = await db.lab_results.toArray();
        for (const r of all.filter(r => matchPid(r.patient_id))) {
          entries.push({ id: 'labres_' + r.id, date: safeDate(r.result_date), type: 'lab_result',
            title: 'Investigation Result: ' + ((r as any).test_name || 'Result'),
            summary: 'Result: ' + ((r as any).result_value || (r as any).value || 'Pending') + ' ' + ((r as any).unit || '') + '. ' + (r.abnormal_flag ? '? ABNORMAL' : 'Within normal limits') + '. Ref range: ' + ((r as any).reference_range || 'N/A'),
            details: { 'Investigation': (r as any).test_name, 'Result Value': (r as any).result_value || (r as any).value, 'Unit': (r as any).unit, 'Reference Range': (r as any).reference_range, 'Interpretation': r.abnormal_flag ? 'Abnormal' : 'Normal' },
          });
        }
      } catch(e) { console.warn('lab_results:', e); }

      // 9. DVT Assessments
      try {
        const all = await db.dvt_assessments.toArray();
        for (const d of all.filter(d => matchPid(d.patient_id))) {
          entries.push({ id: 'dvt_' + d.id, date: safeDate(d.assessment_date), type: 'dvt_assessment',
            title: 'DVT Risk: ' + (d.risk_level || 'Unknown'),
            summary: 'Score: ' + (d.score || 'N/A') + '. Assessed by ' + ((d as any).assessed_by || 'Unknown'),
            details: { 'Risk Level': d.risk_level, 'Score': d.score, 'Assessment Type': (d as any).assessment_type, 'Assessed By': (d as any).assessed_by, 'Prophylaxis': (d as any).prophylaxis_recommended },
          });
        }
      } catch(e) { console.warn('dvt:', e); }

      // 10. Pressure Sore Assessments
      try {
        const all = await db.pressure_sore_assessments.toArray();
        for (const p of all.filter(p => matchPid(p.patient_id))) {
          entries.push({ id: 'ps_' + p.id, date: safeDate(p.assessment_date), type: 'pressure_sore_assessment',
            title: 'Pressure Sore Risk: ' + (p.risk_level || 'Unknown'),
            summary: 'Score: ' + (p.score || 'N/A') + '. Assessed by ' + ((p as any).assessed_by || 'Unknown'),
            details: { 'Risk Level': p.risk_level, 'Score': p.score, 'Assessment Type': (p as any).assessment_type, 'Assessed By': (p as any).assessed_by },
          });
        }
      } catch(e) { console.warn('pressure_sore:', e); }

      // 11. Nutritional Assessments
      try {
        const all = await db.nutritional_assessments.toArray();
        for (const n of all.filter(n => matchPid(n.patient_id))) {
          entries.push({ id: 'nut_' + n.id, date: safeDate(n.assessment_date), type: 'nutritional_assessment',
            title: 'Nutritional Risk: ' + (n.risk_level || 'Unknown'),
            summary: 'Score: ' + (n.score || 'N/A') + '. Assessed by ' + ((n as any).assessed_by || 'Unknown'),
            details: { 'Risk Level': n.risk_level, 'Score': n.score, 'BMI': (n as any).bmi, 'Weight': (n as any).weight, 'Assessed By': (n as any).assessed_by },
          });
        }
      } catch(e) { console.warn('nutritional:', e); }

      // 12. Wound Care
      try {
        const all = await db.wound_care.toArray();
        for (const w of all.filter(w => matchPid(w.patient_id))) {
          entries.push({ id: 'wc_' + w.id, date: safeDate(w.assessment_date), type: 'wound_care',
            title: 'Wound: ' + (w.wound_type || 'Assessment') + ' - ' + (w.wound_location || 'N/A'),
            summary: 'Stage: ' + ((w as any).wound_stage || 'N/A') + '. By ' + ((w as any).assessed_by || 'Unknown'),
            details: { 'Wound Type': w.wound_type, 'Location': w.wound_location, 'Stage': (w as any).wound_stage, 'Treatment': (w as any).treatment || (w as any).dressing_type, 'Assessed By': (w as any).assessed_by },
          });
        }
      } catch(e) { console.warn('wound_care:', e); }

      // 13. Prescriptions
      try {
        const all = await db.prescriptions.toArray();
        for (const r of all.filter(r => matchPid(r.patient_id))) {
          entries.push({ id: 'rx_' + r.id, date: safeDate(r.prescribed_date), type: 'prescription',
            title: 'Prescription: ' + (r.medication_name || 'Medication'),
            summary: (r.medication_name || '') + ' ' + (r.dosage || '') + ' ' + (r.route || '') + ' ' + (r.frequency || '') + '. Prescribed by ' + ((r as any).prescribed_by || 'Attending clinician') + '. Status: ' + (r.status || 'active'),
            details: { 'Drug Name': r.medication_name, 'Dose': r.dosage, 'Route': r.route, 'Frequency': r.frequency, 'Duration': (r as any).duration, 'Prescription Status': r.status },
          });
        }
      } catch(e) { console.warn('prescriptions:', e); }

      // 14. MDT Meetings
      try {
        const all = await db.mdt_meetings.toArray();
        for (const m of all.filter(m => matchPid(m.patient_id))) {
          entries.push({ id: 'mdtm_' + m.id, date: safeDate(m.meeting_date), type: 'mdt_meeting',
            title: 'MDT Meeting: ' + (m.meeting_title || 'Meeting'),
            summary: 'Type: ' + (m.meeting_type || 'N/A') + '. Status: ' + (m.status || 'N/A') + '. Location: ' + (m.location || 'N/A'),
            details: { 'Title': m.meeting_title, 'Type': m.meeting_type, 'Status': m.status, 'Location': m.location, 'Time': m.meeting_time, 'Agenda': m.agenda, 'Decisions': m.decisions_made },
          });
        }
      } catch(e) { console.warn('mdt_meetings:', e); }

      // 15. MDT Contact Logs
      try {
        const all = await db.mdt_contact_logs.toArray();
        for (const c of all.filter(c => matchPid(c.patient_id))) {
          entries.push({ id: 'mdtc_' + c.id, date: safeDate(c.contact_date), type: 'mdt_contact',
            title: 'MDT Contact: ' + (c.specialty_name || 'Specialty'),
            summary: (c.contact_type || 'N/A') + ' with ' + (c.contacted_person || 'Unknown') + '. Reason: ' + (c.reason || 'N/A'),
            details: { 'Specialty': c.specialty_name, 'Contact Type': c.contact_type, 'Person': c.contacted_person, 'Reason': c.reason, 'Discussion': c.discussion_summary, 'Outcome': c.outcome, 'Follow-up': c.follow_up_required ? 'Yes - ' + safeFormatDate(c.follow_up_date, 'MMM d, yyyy') : 'No' },
          });
        }
      } catch(e) { console.warn('mdt_contacts:', e); }

      // 16. Discharges
      try {
        const all = await db.discharges.toArray();
        for (const d of all.filter(d => matchPid(d.patient_id))) {
          entries.push({ id: 'dc_' + d.id, date: safeDate(d.discharge_date), type: 'discharge',
            title: 'Discharge � ' + ((d as any).discharge_status || 'Status not documented'),
            summary: 'Discharge type: ' + ((d as any).discharge_type || 'Not specified') + '. Follow-up plan: ' + ((d as any).follow_up_plan || 'Not documented'),
            details: { 'Discharge Status': (d as any).discharge_status, 'Discharge Type': (d as any).discharge_type, 'Discharge Summary': (d as any).discharge_summary, 'Follow-up Plan': (d as any).follow_up_plan, 'Condition at Discharge': (d as any).condition_at_discharge },
          });
        }
      } catch(e) { console.warn('discharges:', e); }

      // 17. Burn Patients
      try {
        const all = await db.burn_patients.toArray();
        for (const b of all.filter(b => matchPid(b.patient_id))) {
          entries.push({ id: 'burn_' + b.id, date: safeDate(b.admission_date), type: 'burn_assessment',
            title: 'Burn Assessment - TBSA ' + (b.tbsa_percentage || 'N/A') + '%',
            summary: 'Mechanism: ' + ((b as any).mechanism || 'N/A') + '. Baux: ' + ((b as any).baux_score || 'N/A'),
            details: { 'TBSA': b.tbsa_percentage ? b.tbsa_percentage + '%' : 'N/A', 'Mechanism': (b as any).mechanism, 'Baux Score': (b as any).baux_score, 'Status': (b as any).status },
          });
        }
      } catch(e) { console.warn('burns:', e); }

      // 18. Diabetic Foot
      try {
        const all = await db.diabetic_foot_assessments.toArray();
        for (const d of all.filter(d => matchPid(d.patient_id))) {
          entries.push({ id: 'dfa_' + d.id, date: safeDate(d.assessment_date), type: 'diabetic_foot',
            title: 'Diabetic Foot: Wagner ' + (d.wagner_grade || 'N/A'),
            summary: 'Risk: ' + ((d as any).risk_category || 'N/A') + '. WIfI: ' + ((d as any).wifi_score || 'N/A'),
            details: { 'Wagner': d.wagner_grade, 'Texas Stage': (d as any).texas_stage, 'WIfI Score': (d as any).wifi_score, 'Risk': (d as any).risk_category, 'Status': (d as any).status },
          });
        }
      } catch(e) { console.warn('diabetic_foot:', e); }

      // 19. Blood Transfusions
      try {
        const all = await db.blood_transfusions.toArray();
        for (const t of all.filter(t => matchPid(t.patient_id))) {
          entries.push({ id: 'bt_' + t.id, date: safeDate((t as any).transfusion_date || (t as any).created_at), type: 'blood_transfusion',
            title: 'Blood Transfusion: ' + ((t as any).blood_product || 'N/A'),
            summary: 'Units: ' + ((t as any).units || 'N/A') + '. Blood group: ' + ((t as any).blood_group || 'N/A'),
            details: { 'Blood Product': (t as any).blood_product, 'Units': (t as any).units, 'Blood Group': (t as any).blood_group, 'Indication': (t as any).indication, 'Status': (t as any).status },
          });
        }
      } catch(e) { console.warn('blood_transfusions:', e); }

      // 20. GFR Calculations
      try {
        const all = await db.gfr_calculations.toArray();
        for (const g of all.filter(g => matchPid(g.patient_id))) {
          entries.push({ id: 'gfr_' + g.id, date: safeDate((g as any).calculation_date || (g as any).created_at), type: 'gfr_calculation',
            title: 'GFR: ' + ((g as any).gfr_value || 'N/A') + ' mL/min',
            summary: 'CKD Stage: ' + ((g as any).ckd_stage || 'N/A') + '. Creatinine: ' + ((g as any).creatinine || 'N/A'),
            details: { 'GFR': (g as any).gfr_value, 'CKD Stage': (g as any).ckd_stage, 'Creatinine': (g as any).creatinine, 'Method': (g as any).formula_used },
          });
        }
      } catch(e) { console.warn('gfr:', e); }

      // Sort chronologically (newest first)
      entries.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTimeline(entries);
    } catch (error) {
      console.error('Error loading patient timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = (id: string) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredTimeline = filterType === 'all' ? timeline : timeline.filter(e => e.type === filterType);

  const typeCounts = timeline.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});

  const exportTimelinePDF = () => {
    if (!patientInfo || timeline.length === 0) return;
    const doc = createPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = PDF_MARGINS.top;
    const clean = (text: string | undefined | null): string => sanitizeTextForPDF(text || '');

    doc.setFontSize(18);
    doc.setFont('times', 'bold');
    doc.text('COMPREHENSIVE PATIENT TIMELINE', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text('University of Nigeria Teaching Hospital - Plastic Surgery Unit', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    doc.setFontSize(12);
    doc.setFont('times', 'bold');
    doc.text('PATIENT INFORMATION', PDF_MARGINS.left, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.text('Name: ' + clean(patientInfo.first_name) + ' ' + clean(patientInfo.last_name), PDF_MARGINS.left, yPos); yPos += 5;
    doc.text('Hospital Number: ' + clean(patientInfo.hospital_number), PDF_MARGINS.left, yPos); yPos += 5;
    doc.text('Total Records: ' + timeline.length, PDF_MARGINS.left, yPos); yPos += 5;
    doc.text('Generated: ' + safeFormatDate(new Date(), 'MMMM d, yyyy h:mm a'), PDF_MARGINS.left, yPos); yPos += 10;
    doc.line(PDF_MARGINS.left, yPos, pageWidth - PDF_MARGINS.right, yPos); yPos += 8;

    for (const entry of filteredTimeline) {
      if (yPos > 260) { doc.addPage(); yPos = PDF_MARGINS.top; }
      const config = TYPE_CONFIG[entry.type] || { label: entry.type };
      doc.setFontSize(10);
      doc.setFont('times', 'bold');
      doc.text('[' + safeFormatDate(entry.date, 'MMM d, yyyy') + '] ' + clean(config.label), PDF_MARGINS.left, yPos); yPos += 5;
      doc.setFont('times', 'normal');
      doc.setFontSize(9);
      const titleLines = doc.splitTextToSize(clean(entry.title), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
      doc.text(titleLines, PDF_MARGINS.left + 5, yPos); yPos += titleLines.length * 4;
      const sumLines = doc.splitTextToSize(clean(entry.summary), pageWidth - PDF_MARGINS.left - PDF_MARGINS.right);
      doc.text(sumLines, PDF_MARGINS.left + 5, yPos); yPos += sumLines.length * 4 + 5;
    }
    addFooter(doc);
    doc.save('Patient_Timeline_' + clean(patientInfo.hospital_number) + '_' + safeFormatDate(new Date(), 'yyyy-MM-dd') + '.pdf');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">Patient Summaries</h1>
        <p className="text-gray-600">Comprehensive patient care timeline from registration to current date</p>
      </div>

      {/* Patient Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Select Patient</label>
        <div className="flex gap-3">
          <select
            value={selectedPatient}
            onChange={(e) => { setSelectedPatient(e.target.value); setExpandedEntries(new Set()); setFilterType('all'); }}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            title="Select patient"
          >
            <option value="">Choose a patient...</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.hospital_number})</option>
            ))}
          </select>
          {timeline.length > 0 && (
            <button onClick={exportTimelinePDF} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
              <Download className="w-5 h-5" /> Export PDF
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-green-600" />
        </div>
      )}

      {/* Patient Info & Stats */}
      {patientInfo && !loading && timeline.length > 0 && (
        <>
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{patientInfo.first_name} {patientInfo.last_name}</h2>
                <p className="text-gray-600">{patientInfo.hospital_number} | {patientInfo.gender || 'N/A'} | Age: {calculateAge(patientInfo.date_of_birth || patientInfo.dob) != null ? calculateAge(patientInfo.date_of_birth || patientInfo.dob) + ' years' : 'N/A'} | Blood Group: {patientInfo.blood_group || 'N/A'}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-blue-50 p-3 rounded-lg text-center">
                <p className="text-lg sm:text-2xl font-bold text-blue-700">{timeline.length}</p>
                <p className="text-xs text-blue-600 font-medium">Total Records</p>
              </div>
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([type, count]) => {
                const conf = TYPE_CONFIG[type];
                return (
                  <div key={type} className={((conf?.bgColor || 'bg-gray-50') + ' p-3 rounded-lg text-center cursor-pointer hover:opacity-80 ' + (filterType === type ? 'ring-2 ring-green-600' : ''))}
                    onClick={() => setFilterType(filterType === type ? 'all' : type)}>
                    <p className={'text-lg sm:text-2xl font-bold ' + (conf?.textColor || 'text-gray-700')}>{count}</p>
                    <p className={'text-xs font-medium ' + (conf?.textColor || 'text-gray-600')}>{conf?.label || type}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Filter:</span>
              <button onClick={() => setFilterType('all')}
                className={'px-3 py-1 text-xs rounded-full font-medium transition-colors ' + (filterType === 'all' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')}>
                All ({timeline.length})
              </button>
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
                const conf = TYPE_CONFIG[type];
                return (
                  <button key={type} onClick={() => setFilterType(filterType === type ? 'all' : type)}
                    className={'px-3 py-1 text-xs rounded-full font-medium transition-colors ' + (filterType === type ? 'bg-green-600 text-white' : (conf?.bgColor || 'bg-gray-100') + ' ' + (conf?.textColor || 'text-gray-700') + ' hover:opacity-80')}>
                    {conf?.label || type} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Timeline Cards */}
          <div className="space-y-3">
            {filteredTimeline.map((entry) => {
              const conf = TYPE_CONFIG[entry.type] || { label: entry.type, bgColor: 'bg-gray-50', textColor: 'text-gray-700', borderColor: 'border-gray-300' };
              const isExpanded = expandedEntries.has(entry.id);
              return (
                <div key={entry.id} className={'bg-white rounded-lg shadow border-l-4 ' + conf.borderColor + ' overflow-hidden'}>
                  <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => toggleEntry(entry.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={'mt-1 p-2 rounded-lg ' + conf.bgColor}>
                          {getTypeIcon(entry.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={'px-2 py-0.5 text-xs font-medium rounded ' + conf.bgColor + ' ' + conf.textColor}>
                              {conf.label}
                            </span>
                            <span className="text-xs text-gray-500">
                              {safeFormatDate(entry.date, 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 text-sm">{entry.title}</h3>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{entry.summary}</p>
                        </div>
                      </div>
                      <div className="ml-2 mt-1">
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={'px-4 pb-4 pt-2 border-t border-gray-100 ' + conf.bgColor}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(entry.details)
                          .filter(([, value]) => value !== null && value !== undefined && value !== '' && value !== 'N/A')
                          .map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-gray-700">{key}:</span>
                              <span className="text-gray-900 ml-1">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredTimeline.length === 0 && !loading && (
              <div className="bg-gray-50 rounded-lg p-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  {filterType !== 'all' ? 'No ' + (TYPE_CONFIG[filterType]?.label || filterType) + ' records found' : 'No records found for this patient'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {!loading && selectedPatient && timeline.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No records found for this patient</p>
        </div>
      )}
    </div>
  );
};

export default PatientSummariesPage;
