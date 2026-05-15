/**
 * Clinical Audit Service
 * ----------------------
 * Geo-stamped, time-stamped audit trail for clinically significant actions.
 * Every approval, admission, plan-change and supervisory sign-off goes through
 * here so the unit can prove WHO did WHAT, WHERE and WHEN.
 *
 * Falls back to local queue if the network is down — never blocks the UI.
 */

import { apiClient } from './apiClient';
import { captureLocation, type GeoLocationResult } from './geolocationService';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

export type ClinicalAction =
  | 'ADMISSION_CREATED'
  | 'ADMISSION_APPROVED'
  | 'TREATMENT_PLAN_CREATED'
  | 'TREATMENT_PLAN_APPROVED'
  | 'TASK_APPROVED'
  | 'PRESCRIPTION_APPROVED'
  | 'LAB_ORDER_APPROVED'
  | 'WOUND_CARE_APPROVED'
  | 'WARD_ROUND_APPROVED'
  | 'PROCEDURE_APPROVED'
  | 'DISCHARGE_AUTHORISED'
  | 'HO_ASSIGNED'
  | 'HO_REASSIGNED';

export interface ClinicalAuditPayload {
  action: ClinicalAction | string;
  resourceType: string;     // 'admission' | 'treatment_plan' | 'lab_order' | ...
  resourceId: string | number;
  resourceIdentifier?: string; // e.g. patient name + hosp number
  details?: Record<string, unknown> | string;
  /** Pre-captured geo (avoids re-prompting if the caller already has it). */
  geo?: GeoLocationResult | null;
  /** Skip geo capture entirely (use sparingly — only for low-risk reads). */
  skipGeo?: boolean;
}

const LS_QUEUE_KEY = 'clinical_audit_queue_v1';

function loadQueue(): any[] {
  try { return JSON.parse(localStorage.getItem(LS_QUEUE_KEY) || '[]'); } catch { return []; }
}
function saveQueue(items: any[]) {
  try { localStorage.setItem(LS_QUEUE_KEY, JSON.stringify(items.slice(-200))); } catch { /* ignore quota */ }
}

async function flushQueue() {
  const queue = loadQueue();
  if (queue.length === 0) return;
  const remaining: any[] = [];
  for (const item of queue) {
    try {
      await apiClient.request('/audit-logs', {
        method: 'POST',
        body: JSON.stringify(item),
      });
    } catch {
      remaining.push(item);
    }
  }
  saveQueue(remaining);
}

/**
 * Record a clinical action with automatic geo + identity capture.
 * Returns the geo result so callers can show it in the UI.
 */
export async function logClinicalAction(payload: ClinicalAuditPayload): Promise<GeoLocationResult | null> {
  const user = useAuthStore.getState().user;

  let geo: GeoLocationResult | null = payload.geo ?? null;
  if (!geo && !payload.skipGeo) {
    try {
      geo = await captureLocation({ skipReverseGeocode: false });
    } catch (e) {
      logger.warn('Audit: geo capture failed (continuing without coords)', e);
    }
  }

  const body = {
    user_id: user?.id?.toString() || null,
    user_name: user?.name || user?.full_name || 'Unknown',
    user_role: user?.role || 'unknown',
    action: payload.action,
    resource_type: payload.resourceType,
    resource_id: String(payload.resourceId),
    resource_identifier: payload.resourceIdentifier || null,
    details: payload.details ? (typeof payload.details === 'string' ? payload.details : JSON.stringify(payload.details)) : null,
    timestamp: new Date().toISOString(),
    latitude: geo?.latitude ?? null,
    longitude: geo?.longitude ?? null,
    accuracy_meters: geo?.accuracy != null ? Math.round(geo.accuracy) : null,
    geofence_name: geo?.geofenceName || null,
    is_inside_geofence: typeof geo?.isInsideGeofence === 'boolean' ? geo.isInsideGeofence : null,
    address: geo?.address || null,
  };

  // Flush any backlog opportunistically (non-blocking)
  flushQueue().catch(() => {});

  try {
    await apiClient.request('/audit-logs', { method: 'POST', body: JSON.stringify(body) });
  } catch (e) {
    // Network down or unauthenticated — queue locally for later
    const queue = loadQueue();
    queue.push(body);
    saveQueue(queue);
    logger.warn('Audit log queued (offline):', payload.action, e);
  }

  return geo;
}

/** Manually drain the queue (e.g. on app start once online). */
export async function drainAuditQueue() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  await flushQueue();
}
