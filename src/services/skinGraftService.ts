/**
 * The client half of photographic graft monitoring.
 *
 * A graft site is a wound, so nothing here captures or measures a photograph —
 * that goes through the existing wound pipeline. This asks the server what a
 * measured photograph means for a graft, and reads back the series.
 */

import { apiClient } from './apiClient';

export type SiteRole = 'recipient' | 'donor';

export interface GraftEpisode {
  id: number;
  patient_id: number;
  surgery_id?: number | null;
  episode_label?: string | null;
  graft_type?: string | null;
  graft_thickness_mm?: number | null;
  mesh_ratio?: string | null;
  operation_date?: string | null;
  status: string;
  notes?: string | null;
  site_count?: number;
  open_alerts?: number;
  patient_name?: string;
  hospital_number?: string;
}

export interface SeriesPoint {
  assessmentId: number;
  analysisId?: number | null;
  capturedAt: string;
  day: number | null;
  openAreaCm2: number | null;
  closurePct: number | null;
  /** Traced surface composition, null when the clinician did not trace one. */
  composition: {
    granulation: number | null; slough: number | null;
    necrotic: number | null; epithelial: number | null;
  } | null;
  tissueSource?: 'none' | 'clinician' | 'model';
  exceededBaseline?: boolean;
  imageUrl?: string | null;
  overlayUrl?: string | null;
  imageQualityScore: number | null;
  scaleReliable: boolean;
  calibrationType?: string | null;
  confidence: number | null;
  modelName?: string | null;
  modelVersion?: string | null;
  tissueStatus: 'unavailable' | 'model' | 'clinician';
  tissueReason?: string | null;
  viabilityPct: number | null;
  epithelializedPct: number | null;
  comparable: boolean | null;
  comparabilityReason?: string | null;
}

export interface Trend {
  trend: 'improving' | 'stable' | 'deteriorating' | 'expected' | 'accelerated' | 'delayed' | 'uncertain';
  reason: string;
}

export interface Prediction {
  ok: boolean;
  method: string;
  isValidatedModel?: boolean;
  reason?: string;
  alreadyComplete?: boolean;
  currentDay?: number;
  currentPct?: number;
  predictedDay?: number;
  predictedRange?: [number, number] | null;
  intervalBasis?: string;
  ratePctPerDay?: number;
  r2?: number | null;
  basis?: string;
}

export interface Recommendation {
  priority: 'urgent' | 'high' | 'routine' | 'information';
  code: string;
  text: string;
  basis: string;
}

export interface GeneralMeasure { area: string; text: string }

export interface GraftSite {
  id: number;
  episode_id: number;
  wound_id: number;
  site_role: SiteRole;
  site_label?: string | null;
  anatomical_location?: string | null;
  defect_area_cm2?: number | null;
  baseline_area_cm2?: number | null;
  baseline_assessment_id?: number | null;
  baseline_captured_at?: string | null;
  baseline_locked: boolean;
  planned_coverage_cm2?: number | null;
  planned_harvest_cm2?: number | null;
  series: SeriesPoint[];
  rate: { ok: boolean; pctPerDay?: number; cm2PerDay?: number | null; r2?: number | null; basis?: string; reason?: string };
  trend: Trend;
  prediction: Prediction | null;
  overdue: { severity: string; message: string; days: number } | null;
  recommendations: Recommendation[];
}

export interface GraftAlert {
  id: number;
  episode_id: number;
  site_id?: number | null;
  severity: 'info' | 'warning' | 'urgent';
  code: string;
  message: string;
  acknowledged_at?: string | null;
  created_at: string;
}

export interface GraftPlan {
  ok: true;
  defectAreaCm2: number;
  coverageMarginPct: number;
  meshRatio: string;
  expansionFactor: number;
  plannedCoverageCm2: number;
  plannedHarvestCm2: number;
  isEstimate: true;
}

export const skinGraftService = {
  episodesFor(patientId: number | string): Promise<{ episodes: GraftEpisode[] }> {
    return apiClient.get(`/skin-grafts?patientId=${encodeURIComponent(String(patientId))}`);
  },

  episode(id: number | string): Promise<{
    episode: GraftEpisode; sites: GraftSite[]; alerts: GraftAlert[];
    generalMeasures?: GeneralMeasure[];
  }> {
    return apiClient.get(`/skin-grafts/episode/${encodeURIComponent(String(id))}`);
  },

  dashboard(): Promise<{ episodes: GraftEpisode[] }> {
    return apiClient.get('/skin-grafts/dashboard');
  },

  createEpisode(body: {
    patientId: number | string; surgeryId?: number | null; episodeLabel?: string;
    graftType?: string; graftThicknessMm?: number; meshRatio?: string;
    operationDate?: string; notes?: string;
  }): Promise<{ episode: GraftEpisode }> {
    return apiClient.post('/skin-grafts', body);
  },

  addSite(body: {
    episodeId: number; woundId: number; siteRole: SiteRole;
    siteLabel?: string; anatomicalLocation?: string; bodySide?: string; defectAreaCm2?: number;
  }): Promise<{ site: GraftSite }> {
    return apiClient.post('/skin-grafts/site', body);
  },

  /**
   * Fixes the denominator graft take is measured against.
   *
   * Rejects with 409 if a baseline is already locked; pass `force` only when
   * the original was genuinely wrong, because re-locking rewrites every
   * percentage in the series.
   */
  lockBaseline(body: { siteId: number; assessmentId: number; force?: boolean }): Promise<{ site: GraftSite }> {
    return apiClient.post('/skin-grafts/baseline', body);
  },

  /** Derives the graft numbers for a photograph the wound pipeline has saved. */
  analyse(body: {
    siteId: number; assessmentId: number;
    pixelsPerCm?: number; previousPixelsPerCm?: number;
    tissueStatus?: string; tissueReason?: string;
    /**
     * A clinician's tracing of the whole site and the raw area within it.
     * When present the server derives the proportion from these two areas
     * rather than from the locked baseline, because both come from the same
     * photograph.
     */
    tracedTotalAreaCm2?: number; tracedRawAreaCm2?: number; tracedHealedPct?: number;
  }): Promise<{
    analysis: any; closure: any; comparability: { comparable: boolean; reason: string };
    trend: Trend; prediction: Prediction | null; alerts: GraftAlert[]; day: number | null;
    baselineLocked: boolean;
  }> {
    return apiClient.post('/skin-grafts/analyse', body);
  },

  plan(body: {
    defectAreaCm2: number; coverageMarginPct?: number; meshRatio?: string; siteId?: number;
  }): Promise<{ plan: GraftPlan }> {
    return apiClient.post('/skin-grafts/plan', body);
  },

  acknowledgeAlert(alertId: number): Promise<{ alert: GraftAlert }> {
    return apiClient.put('/skin-grafts/alert', { alertId });
  },
};

export default skinGraftService;
