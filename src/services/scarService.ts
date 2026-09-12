/**
 * The client half of scar and keloid monitoring.
 *
 * A scar is a wound, so nothing here captures or measures a photograph — that
 * goes through the existing wound pipeline and the shared tracer. This records
 * what only a clinician or the patient can supply, and reads back what the
 * longitudinal engine made of it all.
 */

import { apiClient } from './apiClient';

export type ScarType =
  | 'normal' | 'immature' | 'mature' | 'hypertrophic' | 'keloid'
  | 'contracture' | 'atrophic' | 'depressed' | 'mixed' | 'uncertain';

export const SCAR_TYPES: { value: ScarType; label: string }[] = [
  { value: 'keloid', label: 'Keloid' },
  { value: 'hypertrophic', label: 'Hypertrophic scar' },
  { value: 'contracture', label: 'Contracture scar' },
  { value: 'immature', label: 'Immature scar' },
  { value: 'mature', label: 'Mature scar' },
  { value: 'atrophic', label: 'Atrophic scar' },
  { value: 'depressed', label: 'Depressed scar' },
  { value: 'normal', label: 'Normal scar' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'uncertain', label: 'Uncertain' },
];

export interface ScarCase {
  id: number;
  patient_id: number;
  wound_id: number;
  keloid_plan_id?: number | null;
  label?: string | null;
  anatomical_site?: string | null;
  body_side?: string | null;
  scar_type?: ScarType | null;
  onset_date?: string | null;
  crosses_joint?: boolean;
  joint_involved?: string | null;
  status: string;
  wound_label?: string | null;
  assessment_count?: number;
  open_alerts?: number;
  last_assessed_at?: string | null;
}

export interface ScarVisit {
  id: number;
  day: number | null;
  assessed_at: string;
  is_baseline: boolean;
  finalized_at?: string | null;
  quality_flag?: string;
  measurement_method?: string | null;
  area_cm2?: number | null;
  perimeter_cm?: number | null;
  image_url?: string | null;
  overlay_url?: string | null;
  image_quality_score?: number | null;
  scale_reliable?: boolean | null;
  delta_e?: number | null;
  erythema_index?: number | null;
  pigmentation?: string | null;
  pliability?: string | null;
  contracture_present?: boolean | null;
  rom_deficit_degrees?: number | null;
  pain_0_10?: number | null;
  itch_0_10?: number | null;
  tightness_0_10?: number | null;
  three_d_status?: string | null;
  three_d_reason?: string | null;
  max_elevation_mm?: number | null;
  volume_cm3?: number | null;
}

export interface DomainChange {
  ok: boolean;
  absolute?: number;
  percent?: number | null;
  percentWithheld?: boolean;
  percentWithheldReason?: string | null;
  reason?: string;
}

export interface ScarDomain {
  domain: string;
  label: string;
  modality: 'image' | '3d' | 'exam' | 'patient' | 'score';
  unit: string;
  series: { day: number; value: number }[];
  current: number | null;
  fromBaseline: DomainChange | null;
  fromPrevious: DomainChange | null;
  rate: { ok: boolean; perMonth?: number; unit?: string; r2?: number | null; reason?: string };
  acceleration: { ok: boolean; accelerating?: boolean; meaningful?: boolean; deltaPerMonth?: number; reason?: string };
  trend: 'improving' | 'stable' | 'worsening' | 'fluctuating' | 'indeterminate';
  reason: string;
}

export interface ScaleTrend {
  scale: string;
  name: string;
  latest: number | null;
  max: number | null;
  fromBaseline: { direction: string; delta: number; proportionOfRange: number } | null;
  series: { total: number; at: string }[];
  incompleteCount: number;
}

export interface Multimodal {
  verdict: 'consistent_progression' | 'consistent_response' | 'discordant'
         | 'fluctuating' | 'stable' | 'insufficient';
  summary: string;
  agreeing: { label: string; modality: string }[];
  disagreeing: { label: string; modality: string }[];
  modalities?: string[];
}

export interface TreatmentEvent {
  kind: string;
  day: number | null;
  event_date: string;
  injection_number?: number;
  injection_phase?: string;
  dose_mg?: number | null;
  status?: string;
}

export interface ScarCaseDetail {
  scar: ScarCase;
  visits: ScarVisit[];
  domains: ScarDomain[];
  scales: ScaleTrend[];
  multimodal: Multimodal;
  eligibility: { eligible: boolean; blockers: string[]; message: string | null };
  methodConsistency: { consistent: boolean; methods: string[]; warning: string | null };
  alerts: { id: number; severity: string; code: string; message: string; acknowledged_at?: string | null; created_at: string }[];
  treatments: TreatmentEvent[];
  threeD: { available: boolean; reason: string };
}

/** One item of a validated scale, as the server defines it. */
export interface ScaleItem {
  key: string;
  label: string;
  min: number;
  max: number;
  source: 'image' | 'exam' | 'patient';
  anchors: string[];
}

export interface ScaleDefinition {
  key: string;
  name: string;
  items: ScaleItem[];
  min: number;
  max: number;
  worseIsHigher: boolean;
  overall?: ScaleItem;
}

export const scarService = {
  /** This patient's scars, or the ones attached to a keloid care plan. */
  list(by: { patientId?: number | string; planId?: number | string }): Promise<{ scars: ScarCase[] }> {
    const q = by.planId
      ? `planId=${encodeURIComponent(String(by.planId))}`
      : `patientId=${encodeURIComponent(String(by.patientId))}`;
    return apiClient.get(`/scars?${q}`);
  },

  case(id: number | string): Promise<ScarCaseDetail> {
    return apiClient.get(`/scars/case/${encodeURIComponent(String(id))}`);
  },

  /**
   * The scale definitions, fetched rather than duplicated in the client.
   *
   * One source of truth for the items, their ranges and their anchors — a
   * second copy in the UI would eventually disagree with the scorer, and a
   * VSS scored against the wrong anchors is not a VSS.
   */
  scales(): Promise<{ scales: Record<string, ScaleDefinition> }> {
    return apiClient.get('/scars/scales');
  },

  create(body: {
    patientId: number | string; woundId: number; keloidPlanId?: number | null;
    label?: string; anatomicalSite?: string; bodySide?: string;
    scarType?: ScarType; onsetDate?: string; causativeEvent?: string;
    originalWoundAreaCm2?: number; originalWoundSource?: string;
    crossesJoint?: boolean; jointInvolved?: string;
  }): Promise<{ scar: ScarCase }> {
    return apiClient.post('/scars', body);
  },

  openAssessment(body: {
    scarId: number; woundAssessmentId?: number; assessedAt?: string;
    qualityFlag?: string; qualityReason?: string; measurementMethod?: string; notes?: string;
  }): Promise<{ assessment: { id: number; is_baseline: boolean } }> {
    return apiClient.post('/scars/assessment', body);
  },

  putScores(body: { assessmentId: number; scale: string; items: Record<string, number | ''> }): Promise<any> {
    return apiClient.put('/scars/scores', body);
  },

  putExam(body: Record<string, unknown> & { assessmentId: number }): Promise<any> {
    return apiClient.put('/scars/exam', body);
  },

  putPatientReported(body: Record<string, unknown> & { assessmentId: number }): Promise<any> {
    return apiClient.put('/scars/patient-reported', body);
  },

  putColour(body: Record<string, unknown> & { assessmentId: number }): Promise<any> {
    return apiClient.put('/scars/colour', body);
  },

  finalize(assessmentId: number): Promise<any> {
    return apiClient.post('/scars/finalize', { assessmentId });
  },

  acknowledgeAlert(alertId: number): Promise<any> {
    return apiClient.put('/scars/alert', { alertId });
  },
};

export default scarService;
