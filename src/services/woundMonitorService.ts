/**
 * WoundProgress Monitor — service layer.
 *
 * Introduces a FIRST-CLASS longitudinal wound entity on top of the app's
 * existing wound suite. The pre-existing surface (aiWoundMeasurement, the
 * wound_care records, wound_measurements) is per-assessment and cannot follow a
 * single physical wound over time; this service gives each wound an identity
 * and a serial assessment timeline, then derives healing analytics from it.
 *
 * Deliberate reuse — NOT reimplemented here:
 *  - Image capture, calibration, segmentation, measurement and tissue
 *    classification come from ../services/aiWoundMeasurement (on-device CV +
 *    GPT-4o Vision). This service only PERSISTS and ANALYSES their output.
 *  - Charts/overlays come from WoundProgressChart and WoundHealingMap.
 *  - Offline-first persistence and cross-device sync ride the shared apiClient
 *    + dataSyncService entities (wounds, wound_assessments).
 *
 * The analytics functions are pure so they can be unit-tested without a DB.
 */

import { apiClient } from './apiClient';
import { db } from '../db/database';

// ── Types ──────────────────────────────────────────────────────────────────

export type WoundStatus = 'active' | 'healed' | 'archived';
export type HealingStatus =
  | 'improving'
  | 'stagnant'
  | 'worsening'
  | 'healed'
  | 'insufficient_data';

export interface Wound {
  id?: number | string;
  serverId?: number;
  patient_id: number | string;
  hospital_number?: string;
  label?: string;
  wound_type?: string;
  anatomical_location?: string;
  body_side?: string;
  etiology?: string;
  stage?: string;
  date_first_seen?: string;
  date_of_injury?: string;
  cause?: string;
  status?: WoundStatus;
  baseline_area_cm2?: number | null;
  latest_area_cm2?: number | null;
  latest_assessment_at?: string | null;
  assessment_count?: number;
  healing_status?: HealingStatus;
  healing_velocity_cm2_per_week?: number | null;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
}

export interface WoundAssessment {
  id?: number | string;
  serverId?: number;
  wound_id: number | string;
  patient_id: number | string;
  assessed_by?: number;
  assessed_at?: string;
  length_cm?: number | null;
  width_cm?: number | null;
  depth_cm?: number | null;
  area_cm2?: number | null;
  perimeter_cm?: number | null;
  granulation_pct?: number | null;
  slough_pct?: number | null;
  necrotic_pct?: number | null;
  epithelial_pct?: number | null;
  exudate_amount?: string;
  exudate_type?: string;
  edges?: string;
  periwound_skin?: string;
  signs_of_infection?: string[];
  pain_score?: number | null;
  healing_stage?: string;
  push_score?: number | null;
  bwat_score?: number | null;
  clinical_description?: string;
  ai_confidence?: number;
  ai_raw_response?: any;
  calibration_type?: string;
  scale_reliable?: boolean;
  contour_cm?: Array<{ x: number; y: number }>;
  image_url?: string;
  overlay_url?: string;
  approved_by?: number;
  approved_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  synced?: boolean;
}

export interface HealingAnalytics {
  status: HealingStatus;
  /** Area change from first to latest assessment, cm². Negative = shrinking (good). */
  absoluteAreaChangeCm2: number;
  /** Percentage reduction from baseline. Positive = healing. */
  percentAreaReduction: number;
  /** Least-squares slope of area over time, cm²/week. Negative = healing. */
  velocityCm2PerWeek: number;
  /** Projected days to closure at the current velocity, or null if not closing. */
  projectedDaysToClosure: number | null;
  /** Consecutive assessments with no meaningful improvement. */
  stagnantStreak: number;
  /** Assessments the analysis is based on. */
  assessmentCount: number;
  /** True when at least one measurement lacked a reliable calibration scale. */
  hasUnreliableScale: boolean;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Below this fraction of change between two visits, a wound is "not moving".
const STAGNATION_THRESHOLD = 0.03; // 3%

// ── Pure healing analytics ──────────────────────────────────────────────────

/** Chronologically sort assessments that carry a usable area + timestamp. */
function usableSeries(assessments: WoundAssessment[]): Array<{ t: number; area: number; reliable: boolean }> {
  return assessments
    .map(a => ({
      t: a.assessed_at ? new Date(a.assessed_at).getTime() : NaN,
      area: typeof a.area_cm2 === 'number' ? a.area_cm2 : NaN,
      reliable: a.scale_reliable !== false,
    }))
    .filter(p => Number.isFinite(p.t) && Number.isFinite(p.area) && p.area >= 0)
    .sort((a, b) => a.t - b.t);
}

/**
 * Least-squares slope of area (cm²) against time (weeks).
 * Returns 0 when there is no time spread to regress over.
 */
export function areaVelocityCm2PerWeek(assessments: WoundAssessment[]): number {
  const series = usableSeries(assessments);
  if (series.length < 2) return 0;
  const t0 = series[0].t;
  const xs = series.map(p => (p.t - t0) / MS_PER_WEEK);
  const ys = series.map(p => p.area);
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return 0;
  return num / den;
}

/** Count trailing assessments whose area barely changed vs the prior one. */
function trailingStagnantStreak(series: Array<{ area: number }>): number {
  let streak = 0;
  for (let i = series.length - 1; i > 0; i--) {
    const prev = series[i - 1].area;
    const cur = series[i].area;
    const denom = Math.max(prev, 1e-6);
    const change = Math.abs(cur - prev) / denom;
    if (change < STAGNATION_THRESHOLD) streak++;
    else break;
  }
  return streak;
}

/**
 * Derive the full healing picture for one wound from its assessment timeline.
 * This is the analytical heart of the Monitor and is intentionally pure.
 */
export function computeHealingAnalytics(assessments: WoundAssessment[]): HealingAnalytics {
  const series = usableSeries(assessments);
  const assessmentCount = series.length;
  const hasUnreliableScale = usableSeries(assessments).some(p => !p.reliable);

  if (assessmentCount === 0) {
    return {
      status: 'insufficient_data',
      absoluteAreaChangeCm2: 0,
      percentAreaReduction: 0,
      velocityCm2PerWeek: 0,
      projectedDaysToClosure: null,
      stagnantStreak: 0,
      assessmentCount: 0,
      hasUnreliableScale,
    };
  }

  const baseline = series[0].area;
  const latest = series[series.length - 1].area;
  const absoluteAreaChangeCm2 = latest - baseline;
  const percentAreaReduction = baseline > 0 ? ((baseline - latest) / baseline) * 100 : 0;
  const velocityCm2PerWeek = areaVelocityCm2PerWeek(assessments);
  const stagnantStreak = trailingStagnantStreak(series);

  // Closure projection: only meaningful when actively shrinking.
  let projectedDaysToClosure: number | null = null;
  if (velocityCm2PerWeek < 0 && latest > 0) {
    const weeks = latest / -velocityCm2PerWeek;
    projectedDaysToClosure = Math.round((weeks * MS_PER_WEEK) / MS_PER_DAY);
  }

  let status: HealingStatus;
  if (latest === 0) {
    status = 'healed';
  } else if (assessmentCount < 2) {
    status = 'insufficient_data';
  } else if (velocityCm2PerWeek > baseline * 0.01) {
    // Area growing by >1% of baseline per week.
    status = 'worsening';
  } else if (stagnantStreak >= 2 || Math.abs(percentAreaReduction) < STAGNATION_THRESHOLD * 100) {
    status = 'stagnant';
  } else if (velocityCm2PerWeek < 0) {
    status = 'improving';
  } else {
    status = 'stagnant';
  }

  return {
    status,
    absoluteAreaChangeCm2,
    percentAreaReduction,
    velocityCm2PerWeek,
    projectedDaysToClosure,
    stagnantStreak,
    assessmentCount,
    hasUnreliableScale,
  };
}

/** Human-readable, non-prescriptive flags for the notifications surface. */
export function healingAlerts(analytics: HealingAnalytics): string[] {
  const alerts: string[] = [];
  if (analytics.status === 'worsening') {
    alerts.push('Wound area is increasing — clinical review recommended.');
  }
  if (analytics.status === 'stagnant' && analytics.assessmentCount >= 2) {
    alerts.push(`Healing has stalled across ${analytics.stagnantStreak + 1} recent assessments.`);
  }
  if (analytics.hasUnreliableScale) {
    alerts.push('Some measurements lacked a reliable calibration marker — absolute sizes are approximate.');
  }
  return alerts;
}

// ── Persistence (offline-first, cross-device via the shared sync layer) ──────

/** All wounds for a patient. Server is source of truth; falls back to cache. */
export async function listWounds(patientId: number | string): Promise<Wound[]> {
  try {
    const res: any = await apiClient.request(
      `/wounds?patientId=${encodeURIComponent(String(patientId))}`,
      { freshRead: true } as any
    );
    const wounds: Wound[] = Array.isArray(res) ? res : res?.wounds || [];
    // Warm the offline mirror.
    try { if (wounds.length) await db.table('wounds').bulkPut(wounds as any); } catch { /* non-fatal */ }
    return wounds;
  } catch {
    // Offline / server error — serve whatever we have locally rather than
    // asserting the patient has no wounds.
    try {
      return await db.table('wounds')
        .filter((w: any) => String(w.patient_id) === String(patientId))
        .toArray();
    } catch {
      return [];
    }
  }
}

/** The monitor dashboard aggregate across all wounds the user can see. */
export async function getMonitorDashboard(): Promise<{
  totalActive: number;
  improving: number;
  stagnant: number;
  worsening: number;
  healedThisWeek: number;
  avgVelocityCm2PerWeek: number | null;
  wounds: Wound[];
}> {
  const res: any = await apiClient.request('/wounds?action=monitor', { freshRead: true } as any);
  return {
    totalActive: res?.totalActive ?? 0,
    improving: res?.improving ?? 0,
    stagnant: res?.stagnant ?? 0,
    worsening: res?.worsening ?? 0,
    healedThisWeek: res?.healedThisWeek ?? 0,
    avgVelocityCm2PerWeek: res?.avgVelocityCm2PerWeek ?? null,
    wounds: Array.isArray(res?.wounds) ? res.wounds : [],
  };
}

/** Full assessment timeline for one wound, newest first from the server. */
export async function getWoundTimeline(woundId: number | string): Promise<WoundAssessment[]> {
  try {
    const res: any = await apiClient.request(
      `/wounds?action=timeline&woundId=${encodeURIComponent(String(woundId))}`,
      { freshRead: true } as any
    );
    const rows: WoundAssessment[] = Array.isArray(res) ? res : res?.assessments || [];
    try { if (rows.length) await db.table('wound_assessments').bulkPut(rows as any); } catch { /* non-fatal */ }
    return rows;
  } catch {
    try {
      return await db.table('wound_assessments')
        .filter((a: any) => String(a.wound_id) === String(woundId))
        .toArray();
    } catch {
      return [];
    }
  }
}

export async function createWound(wound: Wound): Promise<Wound> {
  return apiClient.request('/wounds', {
    method: 'POST',
    body: JSON.stringify(wound),
  });
}

export async function addAssessment(assessment: WoundAssessment): Promise<WoundAssessment> {
  return apiClient.request('/wounds?action=assess', {
    method: 'POST',
    body: JSON.stringify(assessment),
  });
}

/** Label for a healing status, for badges. */
export const HEALING_STATUS_META: Record<HealingStatus, { label: string; color: string; dot: string }> = {
  improving: { label: 'Improving', color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' },
  stagnant: { label: 'Stalled', color: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  worsening: { label: 'Worsening', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' },
  healed: { label: 'Healed', color: 'text-blue-700 bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  insufficient_data: { label: 'New', color: 'text-gray-600 bg-gray-50 border-gray-200', dot: 'bg-gray-400' },
};
