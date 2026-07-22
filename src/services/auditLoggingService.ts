/**
 * Audit Logging Service for PHI Access and Data Modifications
 * HIPAA compliance requires tracking who accessed what data and when
 */

import { db } from '../db/database';
import { apiClient } from './apiClient';
import { captureLocation, getCachedLocation } from './geolocationService';

export interface AuditLog {
  id?: number;
  user_id: string;
  user_name: string;
  user_role: string;
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'PRINT';
  resource_type: 'PATIENT' | 'ADMISSION' | 'PRESCRIPTION' | 'PROCEDURE' | 'LAB_ORDER' | 'LAB' | 'TREATMENT_PLAN' | 'DISCHARGE';
  resource_id: string;
  resource_identifier?: string; // Hospital number, patient name, etc.
  details?: string;
  ip_address?: string;
  timestamp: string;
  synced?: boolean;
  // Geo-stamp — the where of "who did what, when, where". Populated from the
  // background-tracked location (see geolocationService); `address` is the
  // reverse-geocoded street address when the fix was precise enough.
  latitude?: number | null;
  longitude?: number | null;
  accuracy_meters?: number | null;
  geofence_name?: string | null;
  is_inside_geofence?: boolean | null;
  address?: string | null;
}

/**
 * Best-available location for stamping a log, without ever blocking the caller.
 *
 * Prefers the background-tracked cached fix (already reverse-geocoded to a
 * street address, refreshed every ~2 min). If the cache is cold — first action
 * of a session, or tracking not yet warmed — it kicks off a non-blocking
 * capture so the NEXT log is stamped, and returns whatever exists now (possibly
 * nothing). A log is never delayed or dropped for want of a location.
 */
function currentGeoStamp(): Pick<AuditLog,
  'latitude' | 'longitude' | 'accuracy_meters' | 'geofence_name' | 'is_inside_geofence' | 'address'> {
  const loc = getCachedLocation();
  if (!loc) {
    // Warm the cache for subsequent events; do not await.
    captureLocation({ skipReverseGeocode: false })
      .then(() => { /* result is cached inside the service on the tracking path */ })
      .catch(() => {});
    return {};
  }
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy_meters: Math.round(loc.accuracy),
    geofence_name: loc.geofenceName ?? null,
    is_inside_geofence: loc.isInsideGeofence ?? null,
    address: loc.address ?? null,
  };
}

/**
 * Log an audit event
 */
export async function logAudit(audit: Omit<AuditLog, 'id' | 'timestamp' | 'synced'>): Promise<void> {
  try {
    const auditLog: AuditLog = {
      ...audit,
      // Precise, timezone-anchored timestamp with millisecond resolution.
      timestamp: new Date().toISOString(),
      synced: false,
      ip_address: await getClientIP(),
      // Geo-stamp every audit event centrally, so all call sites inherit it.
      ...currentGeoStamp(),
    };

    // Save locally first
    await db.audit_logs.add(auditLog);

    // Attempt to sync to server
    try {
      await apiClient.post('/audit-logs', auditLog);
      
      // Mark as synced
      if (auditLog.id) {
        await db.audit_logs.update(auditLog.id, { synced: true });
      }
    } catch (error) {
      // Failed to sync - will retry later
      // Don't throw error, audit logging should not block user actions
      if (process.env.NODE_ENV === 'development') {
        console.warn('Failed to sync audit log to server:', error);
      }
    }
  } catch (error) {
    // Log to console but don't throw - audit logging failures should not break app
    console.error('Error logging audit event:', error);
  }
}

/**
 * Log patient record access
 */
export async function logPatientAccess(
  userId: string,
  userName: string,
  userRole: string,
  hospitalNumber: string,
  patientName: string,
  action: AuditLog['action'] = 'VIEW'
): Promise<void> {
  await logAudit({
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    action,
    resource_type: 'PATIENT',
    resource_id: hospitalNumber,
    resource_identifier: `${patientName} (${hospitalNumber})`,
    details: `${action} patient record for ${patientName}`
  });
}

/**
 * Log prescription creation/modification
 */
export async function logPrescriptionAction(
  userId: string,
  userName: string,
  userRole: string,
  prescriptionId: string,
  hospitalNumber: string,
  action: AuditLog['action'],
  details?: string
): Promise<void> {
  await logAudit({
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    action,
    resource_type: 'PRESCRIPTION',
    resource_id: prescriptionId,
    resource_identifier: hospitalNumber,
    details: details || `${action} prescription for patient ${hospitalNumber}`
  });
}

/**
 * Log data export (PDF, CSV, etc.)
 */
export async function logDataExport(
  userId: string,
  userName: string,
  userRole: string,
  resourceType: AuditLog['resource_type'],
  resourceId: string,
  exportFormat: string
): Promise<void> {
  await logAudit({
    user_id: userId,
    user_name: userName,
    user_role: userRole,
    action: 'EXPORT',
    resource_type: resourceType,
    resource_id: resourceId,
    details: `Exported ${resourceType} data as ${exportFormat}`
  });
}

/**
 * Get audit logs for a specific patient
 */
export async function getPatientAuditLogs(hospitalNumber: string): Promise<AuditLog[]> {
  try {
    // Try to get from server first
    try {
      const response = await apiClient.get(`/audit-logs/patient/${hospitalNumber}`);
      return response.data;
    } catch (error) {
      // Fallback to local data
      return await db.audit_logs
        .where('resource_id')
        .equals(hospitalNumber)
        .reverse()
        .sortBy('timestamp');
    }
  } catch (error) {
    console.error('Error fetching patient audit logs:', error);
    return [];
  }
}

/**
 * Get audit logs for a specific user
 */
export async function getUserAuditLogs(
  userId: string,
  limit: number = 100
): Promise<AuditLog[]> {
  try {
    return await db.audit_logs
      .where('user_id')
      .equals(userId)
      .reverse()
      .limit(limit)
      .toArray();
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    return [];
  }
}

/**
 * Get recent audit logs (admin view)
 */
export async function getRecentAuditLogs(limit: number = 50): Promise<AuditLog[]> {
  try {
    // Try to get from server first (admin only)
    try {
      const response = await apiClient.get(`/audit-logs?limit=${limit}`);
      return response.data;
    } catch (error) {
      // Fallback to local data
      return await db.audit_logs
        .orderBy('timestamp')
        .reverse()
        .limit(limit)
        .toArray();
    }
  } catch (error) {
    console.error('Error fetching recent audit logs:', error);
    return [];
  }
}

/**
 * Sync unsynced audit logs to server
 */
export async function syncAuditLogs(): Promise<{ synced: number; failed: number }> {
  try {
    const unsyncedLogs = await db.audit_logs
      .where('synced')
      .equals(0)
      .toArray();

    if (unsyncedLogs.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;

    for (const log of unsyncedLogs) {
      try {
        await apiClient.post('/audit-logs', log);
        
        if (log.id) {
          await db.audit_logs.update(log.id, { synced: true });
        }
        synced++;
      } catch (error) {
        failed++;
      }
    }

    return { synced, failed };
  } catch (error) {
    console.error('Error syncing audit logs:', error);
    return { synced: 0, failed: 0 };
  }
}

/**
 * Get client IP address (best effort)
 */
async function getClientIP(): Promise<string | undefined> {
  try {
    // In production, this would be better handled server-side
    // For now, we'll leave it undefined and let the server log it
    return undefined;
  } catch (error) {
    return undefined;
  }
}

/**
 * Clean up old audit logs (retention policy)
 * Keep logs for 7 years (HIPAA requirement)
 */
export async function cleanupOldAuditLogs(): Promise<number> {
  try {
    const sevenYearsAgo = new Date();
    sevenYearsAgo.setFullYear(sevenYearsAgo.getFullYear() - 7);

    const oldLogs = await db.audit_logs
      .where('timestamp')
      .below(sevenYearsAgo.toISOString())
      .toArray();

    if (oldLogs.length > 0) {
      await db.audit_logs.bulkDelete(oldLogs.map(log => log.id!));
    }

    return oldLogs.length;
  } catch (error) {
    console.error('Error cleaning up old audit logs:', error);
    return 0;
  }
}
