/**
 * House-Officer Reassignment Service
 * ----------------------------------
 * Walks active admissions, checks whether each admission's assigned HO is
 * still within their tour (per the active PS-Unit roster), and re-assigns
 * via even round-robin if their tour has ended.
 *
 * "Tour" = `2 * houseOfficerRotationWeeks * 7 days` from the admission date
 * (i.e. both 2-week blocks: their first unit + the rotated unit).
 *
 * Writes an `HO_REASSIGNED` audit row for every change, with geo-stamp.
 *
 * Idempotent: safe to call multiple times per session. Designed to be invoked
 * once on Dashboard mount.
 */

import { db } from '../db/database';
import { apiClient } from './apiClient';
import {
  type UnitRosterConfig,
  pickHouseOfficerRoundRobin,
  houseOfficerStillCovering,
  getCurrentAssignments,
} from '../config/psUnits';
import { logClinicalAction } from './clinicalAuditService';
import { logger } from '../utils/logger';

export interface HoReassignmentResult {
  checked: number;
  reassigned: number;
  errors: number;
  details: Array<{
    admissionId: number | string;
    patientName: string;
    from?: string;
    to?: string;
    reason: 'tour_complete' | 'unassigned' | 'unknown_ho';
  }>;
}

let lastRunAt = 0;
const MIN_INTERVAL_MS = 60 * 60 * 1000; // run at most once per hour per tab

async function loadActiveRoster(): Promise<UnitRosterConfig | null> {
  // Try server first (cross-device truth)
  try {
    const serverRosters = await apiClient.request<any[]>('/sync/ps-unit-rosters');
    if (Array.isArray(serverRosters) && serverRosters.length > 0) {
      const active = serverRosters.find((r: any) => r.is_active);
      if (active) {
        return {
          startDate: active.start_date,
          rotationWeeks: active.rotation_weeks || 2,
          houseOfficerRotationWeeks:
            active.house_officer_rotation_weeks || active.rotation_weeks || 2,
          juniorRegistrarRotationWeeks: active.junior_registrar_rotation_weeks || 6,
          seniorRegistrars: active.senior_registrars || [],
          juniorRegistrars: active.junior_registrars || [],
          houseOfficers: active.house_officers || [],
          isActive: active.is_active,
          createdAt: active.created_at,
          updatedAt: active.updated_at,
        };
      }
    }
  } catch {
    /* fall through to local */
  }

  // Local fallback
  try {
    const configs = await db.ps_unit_rosters.toArray();
    return configs.find((c: UnitRosterConfig) => c.isActive) || null;
  } catch {
    return null;
  }
}

/**
 * Walk active admissions and reassign house officers whose tour has ended.
 * @param force ignore the once-per-hour throttle.
 */
export async function checkAndReassignHouseOfficers(
  force = false,
): Promise<HoReassignmentResult> {
  const result: HoReassignmentResult = {
    checked: 0,
    reassigned: 0,
    errors: 0,
    details: [],
  };

  if (!force && Date.now() - lastRunAt < MIN_INTERVAL_MS) {
    return result;
  }
  lastRunAt = Date.now();

  const roster = await loadActiveRoster();
  if (!roster || !roster.houseOfficers || roster.houseOfficers.length === 0) {
    logger.log('HO-reassignment: no active roster or no HOs configured');
    return result;
  }

  // Pull active admissions (online or offline)
  let admissions: any[] = [];
  try {
    admissions = await apiClient.request<any[]>('/admissions?status=active');
  } catch {
    try {
      admissions = await db.admissions
        .where('status')
        .equals('active')
        .toArray();
    } catch {
      admissions = [];
    }
  }

  const today = new Date();
  const assignments = getCurrentAssignments(roster, today);

  // Build a current count per HO for round-robin balancing
  const existingCounts: Record<string, number> = {};
  for (const a of admissions) {
    const ho = a.assigned_house_officer || a.assignedHouseOfficer;
    if (ho) existingCounts[ho] = (existingCounts[ho] || 0) + 1;
  }

  for (const adm of admissions) {
    result.checked++;
    const currentHo: string | undefined =
      adm.assigned_house_officer || adm.assignedHouseOfficer;
    const admittedAt: string | undefined =
      adm.admission_date || adm.admissionDate || adm.created_at;
    if (!admittedAt) continue;

    let needsReassign = false;
    let reason: 'tour_complete' | 'unassigned' | 'unknown_ho' = 'tour_complete';

    if (!currentHo) {
      needsReassign = true;
      reason = 'unassigned';
    } else if (!roster.houseOfficers.includes(currentHo)) {
      needsReassign = true;
      reason = 'unknown_ho';
    } else if (!houseOfficerStillCovering(currentHo, roster, admittedAt, today)) {
      needsReassign = true;
      reason = 'tour_complete';
    }

    if (!needsReassign) continue;

    // Pick the least-loaded HO currently on a unit (any unit)
    const activeHoNames = Array.from(
      new Set(
        [
          assignments['PS-UNIT-1']?.houseOfficer,
          assignments['PS-UNIT-2']?.houseOfficer,
          ...roster.houseOfficers,
        ].filter(Boolean) as string[],
      ),
    );

    const newHo = pickHouseOfficerRoundRobin(activeHoNames, existingCounts);

    if (!newHo || newHo === currentHo) continue;

    try {
      // Persist reassignment to server (preferred) and local
      try {
        await apiClient.request(`/admissions/${adm.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ assigned_house_officer: newHo }),
        });
      } catch {
        try {
          await db.admissions.update(adm.id, {
            assigned_house_officer: newHo,
            updated_at: new Date(),
          } as any);
        } catch {
          /* ignore local-write failure */
        }
      }

      // Update count maps
      if (currentHo) existingCounts[currentHo] = Math.max(0, (existingCounts[currentHo] || 0) - 1);
      existingCounts[newHo] = (existingCounts[newHo] || 0) + 1;

      // Geo-stamped audit
      try {
        await logClinicalAction({
          action: 'HO_REASSIGNED',
          resourceType: 'admission',
          resourceId: adm.id,
          resourceIdentifier:
            adm.patient_name && adm.hospital_number
              ? `${adm.patient_name} (${adm.hospital_number})`
              : String(adm.id),
          details: {
            from: currentHo || null,
            to: newHo,
            reason,
            admission_date: admittedAt,
          },
        });
      } catch {
        /* audit queues offline on its own */
      }

      result.reassigned++;
      result.details.push({
        admissionId: adm.id,
        patientName: adm.patient_name || '',
        from: currentHo,
        to: newHo,
        reason,
      });
    } catch (e) {
      result.errors++;
      logger.warn('HO reassign failed for admission', adm.id, e);
    }
  }

  if (result.reassigned > 0) {
    logger.log(`HO-reassignment: ${result.reassigned}/${result.checked} reassigned`);
  }
  return result;
}
