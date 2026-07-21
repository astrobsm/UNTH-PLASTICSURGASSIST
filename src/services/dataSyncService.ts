/**
 * DataSyncService - Comprehensive 2-Way Cross-Device Sync
 * 
 * Provides robust push-to-cloud and pull-from-cloud synchronization for ALL entity types.
 * Ensures data consistency across devices (laptop, phone, tablet).
 * 
 * Features:
 * - Automatic sync on app startup
 * - Periodic background sync (every 2 minutes)
 * - Event-driven sync (on create/update/delete)
 * - Conflict resolution with server-wins strategy
 * - Retry mechanism with exponential backoff
 * - Offline queue management
 * - Sync status tracking and notifications
 */

import { db } from '../db/database';
import { apiClient } from './apiClient';
import { syncService } from '../db/syncService';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';
import { mdtService } from './mdtService';
import { medicalTeamService } from './medicalTeamService';

// Entity types that need cross-device sync
// NOTE: Only include entities that have corresponding backend API endpoints
export type SyncableEntity = 
  | 'patients'
  | 'admissions'
  | 'discharges'
  | 'treatment_plans'
  | 'prescriptions'
  | 'lab_investigations'
  | 'surgeries'
  | 'ward_rounds'
  | 'wound_care'
  | 'mdt_patient_teams'
  | 'mdt_meetings'
  | 'mdt_contact_logs'
  | 'blood_transfusions'
  | 'burn_patients'
  | 'diabetic_foot_assessments'
  | 'preoperative_assessments'
  | 'dvt_assessments'
  | 'pressure_sore_assessments'
  | 'nutritional_assessments'
  | 'procedures'
  | 'who_safety_checklists'
  | 'progress_notes'
  | 'shopping_lists'
  | 'call_duty_roster'
  | 'clinic_duty_logs'
  | 'cbt_attempts'
  | 'substance_use_assessments'
  | 'detox_monitoring_records'
  | 'detox_follow_ups'
  | 'substance_use_clinical_summaries'
  | 'patient_assignments'
  | 'investigation_uploads';

// Sync status for each entity
interface EntitySyncStatus {
  entity: SyncableEntity;
  lastPullTime: Date | null;
  lastPushTime: Date | null;
  pendingPushCount: number;
  status: 'idle' | 'syncing' | 'error' | 'success';
  error?: string;
}

// Overall sync status
interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastFullSyncTime: Date | null;
  totalPendingChanges: number;
  entityStatuses: Record<SyncableEntity, EntitySyncStatus>;
}

// Conflict resolution result
interface ConflictResolution {
  resolved: boolean;
  winner: 'local' | 'server';
  mergedData?: any;
}

class DataSyncService {
  private isOnline = navigator.onLine;
  private isSyncing = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private lastFullSyncTime: Date | null = null;
  private entitySyncStatus: Map<SyncableEntity, EntitySyncStatus> = new Map();
  private consecutiveFailures = 0;
  private readonly MAX_SYNC_INTERVAL = 10 * 60 * 1000; // 10 min cap
  private readonly BASE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 min base

  // Entity to API endpoint mapping - ALL entities route through /sync/ endpoints
  // for consistent response format (raw arrays) and proper sync support
  private readonly entityEndpoints: Record<SyncableEntity, string> = {
    patients: '/sync/patients',
    admissions: '/sync/admissions',
    discharges: '/sync/discharge-summaries',
    treatment_plans: '/sync/treatment-plans',
    prescriptions: '/sync/prescriptions',
    lab_investigations: '/sync/lab-orders',
    surgeries: '/sync/surgeries',
    ward_rounds: '/sync/ward-rounds',
    wound_care: '/sync/wound-care',
    mdt_patient_teams: '/sync/mdt-patient-teams',
    mdt_meetings: '/sync/mdt-meetings',
    mdt_contact_logs: '/sync/mdt-contact-logs',
    blood_transfusions: '/sync/blood-transfusions',
    burn_patients: '/sync/burn-patients',
    diabetic_foot_assessments: '/sync/diabetic-foot-assessments',
    preoperative_assessments: '/sync/preoperative-assessments',
    dvt_assessments: '/sync/dvt-assessments',
    pressure_sore_assessments: '/sync/pressure-sore-assessments',
    nutritional_assessments: '/sync/nutritional-assessments',
    procedures: '/sync/procedures',
    who_safety_checklists: '/sync/who-safety-checklists',
    progress_notes: '/sync/progress-notes',
    shopping_lists: '/sync/shopping-lists',
    call_duty_roster: '/sync/call-duty-roster',
    clinic_duty_logs: '/sync/clinic-duty-logs',
    cbt_attempts: '/sync/cbt-attempts',
    substance_use_assessments: '/sync/substance-use-assessments',
    detox_monitoring_records: '/sync/detox-monitoring-records',
    detox_follow_ups: '/sync/detox-follow-ups',
    substance_use_clinical_summaries: '/sync/substance-use-clinical-summaries',
    patient_assignments: '/sync/patient-assignments',
    investigation_uploads: '/sync/investigation-uploads'
  };

  // Entity to IndexedDB table mapping
  private readonly entityTables: Record<SyncableEntity, string> = {
    patients: 'patients',
    admissions: 'admissions',
    discharges: 'discharges',
    treatment_plans: 'treatment_plans',
    prescriptions: 'prescriptions',
    lab_investigations: 'lab_investigations',
    surgeries: 'surgery_bookings',
    ward_rounds: 'ward_rounds',
    wound_care: 'wound_care',
    mdt_patient_teams: 'mdt_patient_teams',
    mdt_meetings: 'mdt_meetings',
    mdt_contact_logs: 'mdt_contact_logs',
    blood_transfusions: 'blood_transfusions',
    burn_patients: 'burn_patients',
    diabetic_foot_assessments: 'diabetic_foot_assessments',
    preoperative_assessments: 'preoperative_assessments',
    dvt_assessments: 'dvt_assessments',
    pressure_sore_assessments: 'pressure_sore_assessments',
    nutritional_assessments: 'nutritional_assessments',
    procedures: 'procedures',
    who_safety_checklists: 'who_safety_checklists',
    progress_notes: 'progress_notes',
    shopping_lists: 'shopping_lists',
    call_duty_roster: 'call_duty_roster',
    clinic_duty_logs: 'clinic_duty_logs',
    cbt_attempts: 'cbt_attempts',
    substance_use_assessments: 'substance_use_assessments',
    detox_monitoring_records: 'detox_monitoring_records',
    detox_follow_ups: 'detox_follow_ups',
    substance_use_clinical_summaries: 'substance_use_clinical_summaries',
    investigation_uploads: 'investigation_uploads',
    patient_assignments: 'patient_assignments'
  };

  constructor() {
    this.initializeEntityStatus();
    this.setupEventListeners();
    this.loadSyncState();
    this.startPeriodicSync();
    // Initial sync is triggered by main.tsx — no duplicate here
  }

  /**
   * Initialize sync status for all entities
   */
  private initializeEntityStatus(): void {
    const entities: SyncableEntity[] = [
      'patients', 'admissions', 'discharges', 'treatment_plans',
      'prescriptions', 'lab_investigations', 'surgeries', 'ward_rounds', 'wound_care',
      'mdt_patient_teams', 'mdt_meetings', 'mdt_contact_logs',
      'blood_transfusions', 'burn_patients', 'diabetic_foot_assessments',
      'preoperative_assessments', 'dvt_assessments', 'pressure_sore_assessments',
      'nutritional_assessments', 'procedures', 'who_safety_checklists',
      'progress_notes',
      'shopping_lists', 'call_duty_roster', 'clinic_duty_logs', 'cbt_attempts',
      'substance_use_assessments', 'detox_monitoring_records', 'detox_follow_ups',
      'substance_use_clinical_summaries'
    ];

    entities.forEach(entity => {
      this.entitySyncStatus.set(entity, {
        entity,
        lastPullTime: null,
        lastPushTime: null,
        pendingPushCount: 0,
        status: 'idle'
      });
    });
  }

  /**
   * Setup event listeners for online/offline status
   */
  private onlineDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.log('🌐 Back online - initiating full sync...');
      toast.success('Back online! Syncing data...', { id: 'connectivity', duration: 3000 });
      // Debounce: the online event can fire multiple times rapidly
      if (this.onlineDebounceTimer) clearTimeout(this.onlineDebounceTimer);
      this.onlineDebounceTimer = setTimeout(() => this.performFullSync(), 2000);
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      logger.log('📴 Gone offline - changes will be queued');
      toast.error('You are offline. Changes will sync when reconnected.', { 
        id: 'connectivity', 
        duration: 5000 
      });
      this.notifyListeners();
    });

    // Listen for auth changes
    window.addEventListener('storage', (event) => {
      if (event.key === 'auth_token' && event.newValue) {
        // User logged in on another tab — debounce
        if (this.onlineDebounceTimer) clearTimeout(this.onlineDebounceTimer);
        this.onlineDebounceTimer = setTimeout(() => this.performFullSync(), 2000);
      }
    });

    // ─── BEST PRACTICE: visibilitychange — refresh when user returns to tab ───
    // Critical for cross-device UX: user closes phone, opens laptop, edits;
    // when phone wakes, we want fresh data. Pulls if last pull > 30s ago.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isOnline && apiClient.getToken()) {
        const stale = !this.lastPullTime || (Date.now() - this.lastPullTime.getTime()) > 30_000;
        if (stale && !this.isSyncing) {
          logger.log('👁️ Tab visible — pulling fresh data');
          this.pullAllFromCloud().catch(() => { /* swallow */ });
        }
      }
    });

    // ─── BEST PRACTICE: SW message bridge ───
    // SW posts BACKGROUND_SYNC_COMPLETE / SYNC_COMPLETE after replaying queued
    // mutations. We trigger a pull so the UI reflects the freshly-uploaded data
    // (and any concurrent changes from other devices).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'BACKGROUND_SYNC_COMPLETE' || msg.type === 'SYNC_COMPLETE') {
          logger.log('📨 SW reports sync complete — pulling latest from cloud');
          this.pullAllFromCloud().catch(() => { /* swallow */ });
          this.broadcastChange({ kind: 'sw-replay-complete' });
        }
      });
    }

    // ─── BEST PRACTICE: BroadcastChannel for cross-tab data invalidation ───
    // When one tab pushes a change, sibling tabs in the same browser hear it
    // and pull the new data. Eliminates stale UI when user has app open in
    // multiple tabs/windows.
    try {
      this.broadcastChannel = ('BroadcastChannel' in window) ? new BroadcastChannel('psa-data-sync') : null;
      if (this.broadcastChannel) {
        this.broadcastChannel.addEventListener('message', (event) => {
          const msg = event.data;
          if (!msg || msg.kind === undefined) return;
          // Other tab pushed data — pull on this tab to stay in sync
          if (msg.kind === 'push-complete' || msg.kind === 'sw-replay-complete') {
            if (this.isOnline && !this.isSyncing && apiClient.getToken()) {
              logger.log(`📡 Cross-tab signal (${msg.kind}) — pulling latest`);
              this.pullAllFromCloud().catch(() => { /* swallow */ });
            }
          }
        });
      }
    } catch (e) {
      logger.warn('BroadcastChannel unavailable', e);
    }
  }

  // BroadcastChannel for cross-tab data sync (best practice for PWAs)
  private broadcastChannel: BroadcastChannel | null = null;

  /** Notify other tabs/windows in the same browser that data changed */
  private broadcastChange(payload: { kind: string; entity?: string; count?: number }): void {
    try {
      this.broadcastChannel?.postMessage(payload);
    } catch { /* swallow */ }
  }

  /**
   * Load sync state from localStorage
   */
  private loadSyncState(): void {
    const lastSync = localStorage.getItem('dataSyncService_lastFullSync');
    if (lastSync) {
      this.lastFullSyncTime = new Date(lastSync);
    }

    // Load entity-specific sync times
    const entityStates = localStorage.getItem('dataSyncService_entityStates');
    if (entityStates) {
      try {
        const parsed = JSON.parse(entityStates);
        Object.entries(parsed).forEach(([entity, status]: [string, any]) => {
          const current = this.entitySyncStatus.get(entity as SyncableEntity);
          if (current) {
            current.lastPullTime = status.lastPullTime ? new Date(status.lastPullTime) : null;
            current.lastPushTime = status.lastPushTime ? new Date(status.lastPushTime) : null;
          }
        });
      } catch (e) {
        console.warn('Failed to parse entity sync states:', e);
      }
    }
  }

  /**
   * Save sync state to localStorage
   */
  private saveSyncState(): void {
    if (this.lastFullSyncTime) {
      localStorage.setItem('dataSyncService_lastFullSync', this.lastFullSyncTime.toISOString());
    }

    const entityStates: Record<string, any> = {};
    this.entitySyncStatus.forEach((status, entity) => {
      entityStates[entity] = {
        lastPullTime: status.lastPullTime?.toISOString() || null,
        lastPushTime: status.lastPushTime?.toISOString() || null
      };
    });
    localStorage.setItem('dataSyncService_entityStates', JSON.stringify(entityStates));
  }

  /**
   * Start periodic sync with exponential backoff on failures
   */
  private startPeriodicSync(): void {
    const scheduleNext = () => {
      // Exponential backoff: 2 min → 4 min → 8 min → 10 min cap
      const delay = Math.min(
        this.BASE_SYNC_INTERVAL * Math.pow(2, this.consecutiveFailures),
        this.MAX_SYNC_INTERVAL
      );
      this.syncInterval = setTimeout(async () => {
        if (this.isOnline && !this.isSyncing && apiClient.getToken()) {
          try {
            const pendingCount = await this.getTotalPendingChanges();
            if (pendingCount > 0) {
              console.log(`⏰ Periodic sync: ${pendingCount} items pending`);
              await this.performFullSync();
            } else {
              // Pull from server to get updates from other devices
              const pullResult = await this.pullAllFromCloud();

              // Only sync MDT if pull didn't error on every entity
              if (pullResult.errors.length === 0) {
                try {
                  await mdtService.pushToServer();
                  await mdtService.syncFromServer();
                } catch (mdtError) {
                  console.warn('MDT periodic sync failed:', mdtError);
                }
              }
            }
            // Success — reset backoff
            this.consecutiveFailures = 0;
          } catch {
            this.consecutiveFailures = Math.min(this.consecutiveFailures + 1, 4);
          }
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
  }

  /**
   * Subscribe to sync status changes
   */
  public onStatusChange(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    // Immediately send current status
    this.getStatus().then(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * Get current sync status
   */
  public async getStatus(): Promise<SyncStatus> {
    const totalPending = await this.getTotalPendingChanges();
    const entityStatuses: Record<SyncableEntity, EntitySyncStatus> = {} as any;
    
    this.entitySyncStatus.forEach((status, entity) => {
      entityStatuses[entity] = { ...status };
    });

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastFullSyncTime: this.lastFullSyncTime,
      totalPendingChanges: totalPending,
      entityStatuses
    };
  }

  /**
   * Get total pending changes count
   */
  private async getTotalPendingChanges(): Promise<number> {
    try {
      return await db.sync_queue.count();
    } catch (e) {
      return 0;
    }
  }

  /**
   * Perform a full 2-way sync: Push local changes, then pull remote changes
   */
  public async performFullSync(): Promise<{
    pushed: number;
    pulled: number;
    errors: string[];
  }> {
    if (this.isSyncing) {
      logger.log('⏳ Sync already in progress, skipping...');
      return { pushed: 0, pulled: 0, errors: ['Sync already in progress'] };
    }

    // Cooldown: don't re-sync within 2 minutes of last sync (page navigations trigger redundant syncs)
    if (this.lastFullSyncTime && (Date.now() - this.lastFullSyncTime.getTime()) < 120000) {
      logger.log('⏳ Sync completed recently, skipping...');
      return { pushed: 0, pulled: 0, errors: ['Sync cooldown'] };
    }

    if (!this.isOnline) {
      logger.log('📴 Offline, cannot sync');
      return { pushed: 0, pulled: 0, errors: ['Offline'] };
    }

    const token = apiClient.getToken();
    if (!token) {
      logger.log('🔒 Not authenticated, cannot sync');
      return { pushed: 0, pulled: 0, errors: ['Not authenticated'] };
    }

    this.isSyncing = true;
    this.notifyListeners();

    const result = { pushed: 0, pulled: 0, errors: [] as string[] };

    try {
      logger.log('🔄 Starting full 2-way sync...');

      // Step 1: Push local changes to cloud
      const pushResult = await this.pushAllToCloud();
      result.pushed = pushResult.synced;
      result.errors.push(...pushResult.errors);

      // Step 2: Pull remote changes from cloud
      const pullResult = await this.pullAllFromCloud();
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);

      // Step 3: Sync MDT data specifically
      try {
        // Push local MDT data first (for initial population of server)
        await mdtService.pushToServer();
        // Then pull any updates from server
        await mdtService.syncFromServer();
      } catch (mdtError) {
        logger.warn('MDT sync failed:', mdtError);
      }

      // Step 4: Push patient_assignments to server
      try {
        await medicalTeamService.pushAssignmentsToServer();
      } catch (assignErr) {
        logger.warn('Patient assignments sync failed:', assignErr);
      }

      this.lastFullSyncTime = new Date();
      this.saveSyncState();

      if (result.pushed > 0 || result.pulled > 0) {
        const message = [];
        if (result.pushed > 0) message.push(`↑ ${result.pushed} uploaded`);
        if (result.pulled > 0) message.push(`↓ ${result.pulled} downloaded`);
        toast.success(`Sync complete: ${message.join(', ')}`, { duration: 4000 });
      }

      logger.log(`✅ Full sync complete: ${result.pushed} pushed, ${result.pulled} pulled`);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Sync failed';
      result.errors.push(errorMsg);
      logger.error('❌ Full sync failed:', error);
      toast.error('Sync failed - will retry later');
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }

    return result;
  }

  /**
   * PUSH: Upload all pending local changes to cloud
   */
  public async pushAllToCloud(): Promise<{
    synced: number;
    failed: number;
    errors: string[];
  }> {
    const result = { synced: 0, failed: 0, errors: [] as string[] };

    try {
      // Use existing syncService for queue processing
      const syncResult = await syncService.syncAll();
      result.synced = syncResult.synced;
      result.failed = syncResult.failed;
      result.errors.push(...syncResult.errors);

      // Update entity sync status
      if (result.synced > 0) {
        const now = new Date();
        this.entitySyncStatus.forEach(status => {
          status.lastPushTime = now;
          status.status = 'success';
        });
        this.saveSyncState();
        // Notify sibling tabs so they pull our pushed changes
        this.broadcastChange({ kind: 'push-complete', count: result.synced });
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Push failed';
      result.errors.push(errorMsg);
    }

    return result;
  }

  /**
   * PULL: Download all remote changes from cloud to local
   */
  private isPulling = false;
  private lastPullTime: Date | null = null;

  public async pullAllFromCloud(): Promise<{
    pulled: number;
    errors: string[];
  }> {
    const result = { pulled: 0, errors: [] as string[] };

    // Re-entrancy guard — prevent concurrent pulls
    if (this.isPulling) {
      logger.log('⏳ Pull already in progress, skipping...');
      return result;
    }

    // Cooldown: don't re-pull within 60 seconds
    if (this.lastPullTime && (Date.now() - this.lastPullTime.getTime()) < 60000) {
      logger.log('⏳ Pull completed recently, skipping...');
      return result;
    }

    // Auth guard — skip pull if not authenticated
    const token = apiClient.getToken();
    if (!token) {
      logger.log('🔒 Not authenticated, skipping pull');
      return result;
    }

    this.isPulling = true;
    this.lastPullTime = new Date();

    // Define entities to pull in order (dependencies first)
    // Only non-patient-scoped entities are bulk-synced here.
    // Patient-scoped entities (admissions, treatment_plans, prescriptions,
    // lab_investigations, surgeries, ward_rounds, wound_care, etc.) require
    // a patientId and are synced per-patient when viewing PatientProfile.
    // MDT entities are synced by mdtService.syncFromServer().
    const entitiesToPull: SyncableEntity[] = [
      'patients',       // Must be first - other entities reference patients
      'patient_assignments',
      'shopping_lists',
      'call_duty_roster',
      'clinic_duty_logs',
      'cbt_attempts',
    ];

    let consecutive503s = 0;
    const MAX_CONSECUTIVE_503s = 3; // After 3 consecutive 503s, the server is cold/overloaded — stop hammering it

    try {
      for (const entity of entitiesToPull) {
        // Re-check token before each entity pull to avoid cascading failures
        if (!apiClient.getToken()) {
          console.warn('🔒 Token lost during sync — skipping remaining entity pulls');
          result.errors.push('Token lost during sync');
          break;
        }

        // If we've hit consecutive 503s, add a delay to let Vercel warm up
        if (consecutive503s > 0) {
          const backoffMs = Math.min(consecutive503s * 2000, 8000); // 2s, 4s, 6s, max 8s
          console.log(`⏳ Server overloaded — waiting ${backoffMs / 1000}s before next pull...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        try {
          const pullCount = await this.pullEntityFromCloud(entity);
          result.pulled += pullCount;
          consecutive503s = 0; // Reset on success
        } catch (error) {
          const errorMsg = `Failed to pull ${entity}: ${error instanceof Error ? error.message : error}`;
          result.errors.push(errorMsg);

          // Check if it's a 503 (server cold start / overloaded)
          const is503 = error instanceof Error && (
            error.message.includes('503') || error.message.includes('Service Unavailable')
          );
          if (is503) {
            consecutive503s++;
            if (consecutive503s >= MAX_CONSECUTIVE_503s) {
              console.warn(`⏹️ ${MAX_CONSECUTIVE_503s} consecutive 503s — server is overloaded, aborting remaining pulls (will retry next cycle)`);
              break;
            }
          } else {
            consecutive503s = 0;
            console.warn(`⚠️ ${errorMsg}`);
          }

          // If this is a network failure, abort remaining pulls — they'll all fail too
          if (error instanceof TypeError && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
            console.warn('⏹️ Network down — skipping remaining entity pulls');
            break;
          }

          // If this is an auth failure (401/403/token), abort remaining pulls
          if (error instanceof Error && (
            error.message.includes('401') || 
            error.message.includes('403') || 
            error.message.includes('Not authenticated') || 
            error.message.includes('No token')
          )) {
            console.warn('🔒 Auth failure — skipping remaining entity pulls');
            break;
          }
        }
      }
    } finally {
      this.isPulling = false;
    }

    return result;
  }

  /**
   * Pull a specific entity type from cloud
   */
  private async pullEntityFromCloud(entity: SyncableEntity): Promise<number> {
    const entityStatus = this.entitySyncStatus.get(entity);
    if (!entityStatus) return 0;

    entityStatus.status = 'syncing';

    try {
      const endpoint = this.entityEndpoints[entity];
      const tableName = this.entityTables[entity];
      const table = (db as any)[tableName];

      if (!table) {
        console.warn(`⚠️ Table ${tableName} not found in database`);
        return 0;
      }

      // Get data from server using since parameter for incremental sync
      const since = entityStatus.lastPullTime?.toISOString();
      const serverData = await this.fetchFromServer(endpoint, since);

      if (!serverData || !Array.isArray(serverData) || serverData.length === 0) {
        // Genuinely nothing new. fetchFromServer now THROWS on failure, so
        // reaching here means the server confirmed an empty delta and the
        // cursor can safely stay where it is.
        entityStatus.status = 'success';
        return 0;
      }

      console.log(`📥 Checking ${serverData.length} ${entity} from server...`);

      // Server data is already in snake_case which matches our IndexedDB schema.
      // Do NOT transform keys — Dexie indexes use snake_case (hospital_number, patient_id, etc.)

      // Merge server data with local data
      let mergedCount = 0;
      let failedItems = 0;
      // The cursor advances to the newest updated_at we actually STORED, not to
      // the local clock. Combined with the server's ascending order, a truncated
      // page simply resumes from here on the next pull instead of being skipped.
      let maxServerUpdatedAt = 0;

      for (const serverItem of serverData) {
        try {
          const localItem = await this.findLocalItem(table, serverItem);

          // Preserve the SERVER's timestamps. These were being overwritten with
          // `new Date()` (this device's pull time), which meant: creation dates
          // were wrong on every device that did not originate the record, lists
          // sorted by created_at ordered by sync time rather than admission
          // order, and the freshness comparison below ended up comparing a
          // server clock against a local one — so on a device with a fast clock
          // genuine server edits were discarded as "older" and the record froze.
          const merged = (base: any) => ({
            ...serverItem,
            // Write at the key we MATCHED on. findLocalItem can match by
            // serverId or hospital_number, but put() keys on serverItem.id — a
            // different primary key. That mismatch either created a duplicate
            // row alongside the original, or, because local autoincrement ids
            // and server serial ids both start at 1 and overlap, overwrote an
            // unrelated local patient with another patient's record.
            ...(base ? { id: base.id } : {}),
            ...(base && serverItem.id !== base.id ? { serverId: serverItem.id } : {}),
            synced: true,
          });

          if (localItem) {
            if (localItem.synced === false) {
              // Conflict: both sides changed.
              const resolution = this.resolveConflict(localItem, serverItem, entity);
              if (resolution.winner === 'server') {
                await table.put(merged(localItem));
                mergedCount++;
              }
              // If local wins, keep local data (will be pushed on next sync)
            } else {
              // No conflict: update only if the server copy is actually newer.
              const serverTime = serverItem.updatedAt || serverItem.updated_at;
              const localTime = localItem.updatedAt || localItem.updated_at;
              const serverMs = serverTime ? new Date(serverTime).getTime() : 0;
              const localMs = localTime ? new Date(localTime).getTime() : 0;
              if (!localMs || serverMs > localMs) {
                await table.put(merged(localItem));
                mergedCount++;
              }
            }
          } else {
            await table.put(merged(null));
            mergedCount++;
          }

          const ts = serverItem.updated_at || serverItem.updatedAt;
          const tsMs = ts ? new Date(ts).getTime() : 0;
          if (tsMs > maxServerUpdatedAt) maxServerUpdatedAt = tsMs;
        } catch (itemError) {
          // A row we could not store must NOT advance the cursor past itself.
          failedItems++;
          console.warn(`⚠️ Failed to merge ${entity} item:`, itemError);
        }
      }

      if (failedItems > 0) {
        // Leave the cursor untouched so the whole page is retried. Better to
        // re-merge a few rows (writes are idempotent puts) than to skip one.
        entityStatus.status = 'error';
        entityStatus.error = `${failedItems} of ${serverData.length} ${entity} rows failed to merge`;
        console.warn(`⚠️ ${entityStatus.error} — cursor held for retry`);
        return mergedCount;
      }

      if (maxServerUpdatedAt > 0) {
        entityStatus.lastPullTime = new Date(maxServerUpdatedAt);
      }
      entityStatus.status = 'success';
      // Best practice: persist incremental sync cursor immediately so a page
      // refresh in the middle of a multi-entity sync doesn't lose progress.
      this.saveSyncState();
      if (mergedCount > 0) {
        console.log(`📥 Synced ${mergedCount} ${entity} from server`);
        // Notify sibling tabs that this entity changed
        this.broadcastChange({ kind: 'entity-pulled', entity, count: mergedCount });
      }

      return mergedCount;

    } catch (error) {
      entityStatus.status = 'error';
      entityStatus.error = error instanceof Error ? error.message : 'Pull failed';
      throw error;
    }
  }

  /**
   * Fetch data from server endpoint
   */
  private async fetchFromServer(endpoint: string, since?: string): Promise<any[]> {
    try {
      const query = since ? `?since=${since}` : '';
      const response = await apiClient.request(`${endpoint}${query}`);
      
      // Handle different response structures
      if (Array.isArray(response)) {
        return response;
      }
      
      // Check for common response wrappers - exact keys from API responses
      const possibleKeys = [
        'patients', 'admissions', 'discharges', 'plans', 'prescriptions', 
        'notes', 'investigations', 'results', 'assessments', 'surgeries', 
        'rounds', 'records', 'data', 'items',
        // Exact API response keys
        'labOrders', 'labOrder', 'lab_orders', 'lab_investigations',
        'wardRounds', 'wardRound', 'ward_rounds',
        'woundCareRecords', 'woundCareRecord', 'wound_care', 'wound_care_records',
        'treatment_plans', 'treatmentPlans', 'treatmentPlan',
        'surgery_bookings', 'surgeryBookings', 'surgery'
      ];
      
      for (const key of possibleKeys) {
        if (response[key] && Array.isArray(response[key])) {
          return response[key];
        }
      }

      // If response is an object with data, wrap it
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        // Check if it's a single item
        if (response.id) {
          return [response];
        }
      }

      return [];
    } catch (error) {
      // ALL failures propagate.
      //
      // This used to swallow everything except 401/403/503 and return [], which
      // the caller could not distinguish from "nothing new since the cursor".
      // It therefore marked the entity synced and advanced lastPullTime past
      // records it had never received — and once a later pull persisted that
      // cursor, the gap was permanent. Patients and admissions created before a
      // transient 500 simply never appeared on the device, while the sync UI
      // reported success with zero errors.
      //
      // pullEntityFromCloud already has a per-entity try/catch that marks the
      // entity errored and leaves the cursor untouched, so raising here is what
      // makes a failed pull retryable.
      console.warn(`⚠️ Failed to fetch from ${endpoint}:`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Find a local item by server ID or matching unique fields
   * Uses filter() instead of where() to avoid index requirements
   */
  private async findLocalItem(table: any, serverItem: any): Promise<any | null> {
    try {
      // 1. Explicit server identity. Unambiguous, so it is tried FIRST.
      if (serverItem.id) {
        try {
          const byServerId = await table.filter((item: any) => item.serverId === serverItem.id).first();
          if (byServerId) return byServerId;
        } catch {
          // Ignore filter errors
        }
      }

      // 2. Primary key — but ONLY for rows that came from the server.
      //
      // Local tables use Dexie `++id` autoincrement while Postgres uses its own
      // serial, so the two id spaces overlap from 1. Matching purely on the
      // primary key meant a pull of server record #3 could return an unrelated
      // locally-created record #3 and overwrite one patient's chart with
      // another's. A row that was created on this device and never synced
      // (synced === false, no serverId) carries a local-only id that means
      // nothing to the server, so it is not a valid match.
      if (serverItem.id) {
        const byId = await table.get(serverItem.id);
        if (byId) {
          const isLocalOnly = byId.synced === false && !byId.serverId;
          if (!isLocalOnly) return byId;
        }
      }

      // 3. Natural key. hospital_number is genuinely unique per patient, so it
      //    safely reunites a record created offline with its server copy.
      if (serverItem.hospital_number) {
        try {
          const byHospitalNumber = await table
            .filter((item: any) => item.hospital_number === serverItem.hospital_number)
            .first();
          if (byHospitalNumber) return byHospitalNumber;
        } catch {
          // Ignore filter errors
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve conflict between local and server data
   * Current strategy: Server wins (for cross-device consistency)
   * Logs all conflicts to sync_conflicts table for audit/review
   */
  private resolveConflict(localItem: any, serverItem: any, entity?: string): ConflictResolution {
    // Compare timestamps if available
    const localUpdated = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
    const serverUpdated = serverItem.updated_at ? new Date(serverItem.updated_at).getTime() : 0;

    let winner: 'local' | 'server';

    // Server wins by default, but if local is significantly newer, keep local
    if (localUpdated > serverUpdated + 60000) { // Local is more than 1 minute newer
      console.log('🔀 Conflict resolution: Local data is newer, keeping local');
      winner = 'local';
    } else {
      console.log('🔀 Conflict resolution: Server data wins');
      winner = 'server';
    }

    // Log conflict for audit trail
    this.logConflict(entity || 'unknown', localItem, serverItem, winner).catch(() => {});

    return { resolved: true, winner };
  }

  /**
   * Log a sync conflict to the sync_conflicts IndexedDB table
   */
  private async logConflict(entity: string, localData: any, serverData: any, winner: 'local' | 'server'): Promise<void> {
    try {
      await db.table('sync_conflicts').add({
        entity,
        entityId: localData?.id || serverData?.id || 0,
        localData: JSON.stringify(localData),
        serverData: JSON.stringify(serverData),
        winner,
        resolvedAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to log sync conflict:', e);
    }
  }

  /**
   * Push a single entity to cloud (for immediate sync after create/update)
   */
  public async pushEntityToCloud(entity: SyncableEntity, localId: number | string, data: any): Promise<boolean> {
    if (!this.isOnline) {
      // Queue for later sync
      await syncService.queueAction('create', entity, typeof localId === 'number' ? localId : 0, data);
      return false;
    }

    try {
      const endpoint = this.entityEndpoints[entity];
      const response = await apiClient.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(data)
      });

      // Update local record with server ID
      const tableName = this.entityTables[entity];
      const table = (db as any)[tableName];
      if (table && response && response.id) {
        await table.update(localId, { serverId: response.id, synced: true });
      }

      return true;
    } catch (error) {
      console.warn(`⚠️ Failed to push ${entity} to cloud, queuing for retry:`, error);
      await syncService.queueAction('create', entity, typeof localId === 'number' ? localId : 0, data);
      return false;
    }
  }

  /**
   * Force an immediate full sync
   */
  public async forceSync(): Promise<void> {
    if (!this.isOnline) {
      toast.error('Cannot sync while offline');
      return;
    }
    await this.performFullSync();
  }

  /**
   * Get sync status for a specific entity
   */
  public getEntitySyncStatus(entity: SyncableEntity): EntitySyncStatus | undefined {
    return this.entitySyncStatus.get(entity);
  }

  /**
   * Check if there are pending changes
   */
  public async hasPendingChanges(): Promise<boolean> {
    const count = await this.getTotalPendingChanges();
    return count > 0;
  }

  /**
   * Clear all cached data (for logout)
   */
  public async clearAllData(): Promise<void> {
    try {
      const tables = Object.values(this.entityTables);
      for (const tableName of tables) {
        const table = (db as any)[tableName];
        if (table) {
          await table.clear();
        }
      }
      
      // Clear sync state
      localStorage.removeItem('dataSyncService_lastFullSync');
      localStorage.removeItem('dataSyncService_entityStates');
      
      this.lastFullSyncTime = null;
      this.initializeEntityStatus();
      
      console.log('🗑️ All cached data cleared');
    } catch (error) {
      console.error('Error clearing data:', error);
    }
  }

  /**
   * Cleanup on destroy
   */
  public destroy(): void {
    if (this.syncInterval) {
      clearTimeout(this.syncInterval);
    }
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.listeners.clear();
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService();
export default dataSyncService;
