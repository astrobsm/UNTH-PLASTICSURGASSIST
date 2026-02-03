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
  | 'who_safety_checklists';

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

  // Entity to API endpoint mapping - only entities with backend APIs
  private readonly entityEndpoints: Record<SyncableEntity, string> = {
    patients: '/sync/patients',
    admissions: '/admissions',
    discharges: '/discharge-summaries',
    treatment_plans: '/treatment-plans',
    prescriptions: '/prescriptions',
    lab_investigations: '/lab-orders',
    surgeries: '/surgeries',
    ward_rounds: '/ward-rounds',
    wound_care: '/wound-care',
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
    who_safety_checklists: '/sync/who-safety-checklists'
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
    who_safety_checklists: 'who_safety_checklists'
  };

  constructor() {
    this.initializeEntityStatus();
    this.setupEventListeners();
    this.loadSyncState();
    this.startPeriodicSync();
    
    // Perform initial sync on startup
    if (this.isOnline) {
      setTimeout(() => this.performFullSync(), 3000);
    }
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
      'nutritional_assessments', 'procedures', 'who_safety_checklists'
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
  private setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.isOnline = true;
      logger.log('🌐 Back online - initiating full sync...');
      toast.success('Back online! Syncing data...', { id: 'connectivity', duration: 3000 });
      this.performFullSync();
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
        // User logged in on another tab, sync
        this.performFullSync();
      }
    });
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
   * Start periodic sync (every 2 minutes)
   */
  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.isSyncing) {
        const pendingCount = await this.getTotalPendingChanges();
        if (pendingCount > 0) {
          console.log(`⏰ Periodic sync: ${pendingCount} items pending`);
          await this.performFullSync();
        } else {
          // Still pull from server to get updates from other devices
          await this.pullAllFromCloud();
        }
      }
    }, 2 * 60 * 1000); // Every 2 minutes
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
  public async pullAllFromCloud(): Promise<{
    pulled: number;
    errors: string[];
  }> {
    const result = { pulled: 0, errors: [] as string[] };

    // Define entities to pull in order (dependencies first)
    const entitiesToPull: SyncableEntity[] = [
      'patients',       // Must be first - other entities reference patients
      'admissions',
      'discharges',
      'treatment_plans',
      'prescriptions',
      'lab_investigations',
      'surgeries',
      'ward_rounds',
      'wound_care'
    ];

    for (const entity of entitiesToPull) {
      try {
        const pullCount = await this.pullEntityFromCloud(entity);
        result.pulled += pullCount;
      } catch (error) {
        const errorMsg = `Failed to pull ${entity}: ${error instanceof Error ? error.message : error}`;
        result.errors.push(errorMsg);
        console.warn(`⚠️ ${errorMsg}`);
      }
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
        entityStatus.lastPullTime = new Date();
        entityStatus.status = 'success';
        return 0;
      }

      console.log(`📥 Pulling ${serverData.length} ${entity} from server...`);

      // Merge server data with local data
      let mergedCount = 0;
      for (const serverItem of serverData) {
        try {
          const localItem = await this.findLocalItem(table, serverItem);
          
          if (localItem) {
            // Check if local has unsynced changes
            if (localItem.synced === false) {
              // Conflict: local has changes, server has changes
              const resolution = this.resolveConflict(localItem, serverItem);
              if (resolution.winner === 'server') {
                await table.put({ ...serverItem, synced: true, updated_at: new Date() });
                mergedCount++;
              }
              // If local wins, keep local data (will be pushed on next sync)
            } else {
              // No conflict: update local with server data
              await table.put({ ...serverItem, synced: true, updated_at: new Date() });
              mergedCount++;
            }
          } else {
            // New item from server - use put() to preserve server ID
            // (add() ignores the id with auto-increment tables)
            await table.put({ ...serverItem, synced: true, created_at: new Date(), updated_at: new Date() });
            mergedCount++;
          }
        } catch (itemError) {
          console.warn(`⚠️ Failed to merge ${entity} item:`, itemError);
        }
      }

      entityStatus.lastPullTime = new Date();
      entityStatus.status = 'success';
      console.log(`✅ Pulled ${mergedCount} ${entity} from server`);

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
      // Don't fail silently for auth errors
      if (error instanceof Error && 
          (error.message.includes('401') || error.message.includes('403') || error.message.includes('Not authenticated'))) {
        throw error;
      }
      console.warn(`⚠️ Failed to fetch from ${endpoint}:`, error);
      return [];
    }
  }

  /**
   * Find a local item by server ID or matching unique fields
   */
  private async findLocalItem(table: any, serverItem: any): Promise<any | null> {
    try {
      // Try by id first
      if (serverItem.id) {
        const byId = await table.get(serverItem.id);
        if (byId) return byId;
      }

      // Try by serverId
      if (serverItem.id) {
        const byServerId = await table.where('serverId').equals(serverItem.id).first();
        if (byServerId) return byServerId;
      }

      // Try by hospital_number for patients
      if (serverItem.hospital_number) {
        const byHospitalNumber = await table.where('hospital_number').equals(serverItem.hospital_number).first();
        if (byHospitalNumber) return byHospitalNumber;
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Resolve conflict between local and server data
   * Current strategy: Server wins (for cross-device consistency)
   */
  private resolveConflict(localItem: any, serverItem: any): ConflictResolution {
    // Compare timestamps if available
    const localUpdated = localItem.updated_at ? new Date(localItem.updated_at).getTime() : 0;
    const serverUpdated = serverItem.updated_at ? new Date(serverItem.updated_at).getTime() : 0;

    // Server wins by default, but if local is significantly newer, keep local
    if (localUpdated > serverUpdated + 60000) { // Local is more than 1 minute newer
      console.log('🔀 Conflict resolution: Local data is newer, keeping local');
      return { resolved: true, winner: 'local' };
    }

    console.log('🔀 Conflict resolution: Server data wins');
    return { resolved: true, winner: 'server' };
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
      clearInterval(this.syncInterval);
    }
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.listeners.clear();
  }
}

// Export singleton instance
export const dataSyncService = new DataSyncService();
export default dataSyncService;
