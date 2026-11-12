/**
 * Critical-care review client: prefill a case from the patient record, ask
 * for the consultant-level AI review, and save the review to the patient's
 * clinical encounters (type critical_care_review, signed like any encounter).
 *
 * Prefill reuses the existing readers — the Clinician Assistant patient
 * bridge (patient, investigation uploads), the nutrition record (lab-order
 * analytes), vital signs and prescriptions — so no new lab parser exists.
 */
import { apiClient } from './apiClient';
import { buildFromPatientRecord } from './clinicianAssistant/patientBridge';
import { nutritionService } from './nutritionService';
import { clinicalEncounterService } from './clinicalEncounterService';
import type { CcInput, CcLab, CcMedication, CcReport, CcVitals } from '../clinical/critical/types';

const KIND_TEST: Record<string, string> = {
  albumin: 'Albumin', prealbumin: 'Prealbumin', crp: 'CRP', hb: 'Haemoglobin', lymphocytes: 'Lymphocytes', glucose: 'Glucose', hba1c: 'HbA1c',
  urea: 'Urea', creatinine: 'Creatinine', na: 'Sodium', k: 'Potassium', po4: 'Phosphate', mg: 'Magnesium',
};
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) ? n : null; };

export async function prefillFromRecord(patientId: string): Promise<{ input: CcInput; sources: string[] }> {
  const sources: string[] = [];
  const [bridge, vit, rx, nut] = await Promise.all([
    buildFromPatientRecord(patientId).catch(() => null),
    apiClient.get<any>(`/vital-signs?patientId=${encodeURIComponent(patientId)}`).catch(() => null),
    apiClient.getPrescriptions(patientId).catch(() => null),
    nutritionService.patient(patientId).catch(() => null),
  ]);
  const p = bridge?.patient;
  const labs: CcLab[] = [];
  for (const a of bridge?.extraction.analytes || []) labs.push({ test: a.label, value: a.value, unit: a.unit, time: p?.collectedAt || '' });
  if (bridge?.extraction.analytes.length) sources.push(`${bridge.extraction.analytes.length} investigation results`);
  const fromOrders = (nut?.measurements || []).filter(m => m.source === 'lab_orders' && KIND_TEST[m.kind]);
  for (const m of fromOrders) labs.push({ test: KIND_TEST[m.kind], value: m.value, unit: m.unit, time: m.measured_at });
  if (fromOrders.length) sources.push(`${fromOrders.length} lab-order results`);

  const vRows: any[] = (vit as any)?.vitals || (Array.isArray(vit) ? vit : []);
  const vitals: CcVitals[] = vRows.slice(-6).map(r => ({
    time: r.date || r.created_at, hr: num(r.pulse), sbp: num(r.bp_systolic), dbp: num(r.bp_diastolic), rr: num(r.respiratory_rate), temp_c: num(r.temperature), spo2: num(r.spo2),
  }));
  if (vitals.length) sources.push(`${vitals.length} vital-sign sets (GCS and FiO2 are not charted — add them)`);
  const weight = p?.weightKg ?? num(vRows.filter(r => num(r.weight)).slice(-1)[0]?.weight);

  const rxRows: any[] = (rx as any)?.prescriptions || (Array.isArray(rx) ? rx : []);
  const medications: CcMedication[] = rxRows.filter(r => !['stopped', 'discontinued', 'completed', 'cancelled'].includes(String(r.status || '').toLowerCase())).map(r => {
    const m = /^([\d.]+)\s*([a-zA-Zµ/]+)?/.exec(String(r.dosage || '').trim());
    return { name: String(r.medication_name || '').trim(), dose: m ? Number(m[1]) : (r.dosage || null), unit: m?.[2] || '', route: r.route || '', frequency: r.frequency || '', start_date: r.prescribed_at || r.created_at, indication: r.indication || '' };
  }).filter(m => m.name);
  if (medications.length) sources.push(`${medications.length} active prescriptions`);

  return {
    input: {
      patient: { age_years: p?.age ?? null, sex: p?.sex === 'male' || p?.sex === 'female' ? p.sex : '', weight_kg: weight, height_cm: p?.heightCm ?? null, pregnant: !!p?.pregnant, location: p?.ward || '' },
      presenting_complaint: p?.diagnosis || '', comorbidities: [], allergies: (p?.allergies || []).map(a => ({ agent: a })),
      symptoms: [], signs: [], vitals, labs, medications, imaging_ecg: [], fluid_balance: {},
    },
    sources,
  };
}

export interface AiReview { review: CcReport; model: string; prompt_version: string; deidentified: boolean; discrepancies: string[] }

export const criticalCareService = {
  prefillFromRecord,
  async aiReview(input: CcInput, ruleReport: CcReport, patientId?: string | null): Promise<AiReview> {
    return apiClient.post<AiReview>('/critical-care?action=review', { input, rule_report: ruleReport, patient_id: patientId || null });
  },
  async save(patientId: string, input: CcInput, rule: CcReport, ai: AiReview | null, existing?: { id: number; version: number } | null) {
    const top = (ai?.review.critical_alerts.length ? ai.review.critical_alerts : rule.critical_alerts).map(a => a.finding);
    const narrative = [
      'CRITICAL CARE REVIEW (decision support)', rule.clinical_summary, ai ? `AI review (${ai.model}): ${ai.review.clinical_summary}` : '',
      top.length ? `Critical alerts: ${top.join('; ')}` : 'No critical alerts', `Plan (immediate): ${(ai?.review.plan.immediate.length ? ai.review.plan.immediate : rule.plan.immediate).join(' | ') || '—'}`,
      rule.disclaimer,
    ].filter(Boolean).join('\n');
    return clinicalEncounterService.save({
      ...(existing ? { id: existing.id, version: existing.version } : {}),
      patient_id: patientId, encounter_type: 'critical_care_review', data: { input, rule, ai }, suggestions: [],
      summary: { title: 'Critical care review', diagnosis: (ai?.review.differential_diagnosis[0] || rule.differential_diagnosis[0])?.diagnosis || '', red_flags: top, ai: !!ai },
      narrative,
    });
  },
};
