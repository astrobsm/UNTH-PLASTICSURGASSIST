/**
 * Offline Manager - Comprehensive offline-first data management
 * Handles IndexedDB storage, sync queue, and offline/online transitions
 */

import { db } from '../db/database';
import { apiClient } from './apiClient';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

// Tables that have NO dedicated REST endpoint and must sync through the generic
// /sync/push endpoint (mirrors syncService.syncGenericEntity). Without this,
// offlineManager builds e.g. /api/call-duty-roster which 404s.
const GENERIC_SYNC_TABLES = new Set<string>([
  'shopping_lists', 'call_duty_roster', 'clinic_duty_logs', 'cbt_attempts',
  'blood_transfusions', 'burn_patients', 'diabetic_foot_assessments', 'procedures',
  'who_safety_checklists', 'ward_rounds_clinical', 'mdt_patient_teams', 'mdt_meetings',
  'mdt_contact_logs', 'sjs_assessments', 'substance_use_assessments',
  'detox_monitoring_records', 'detox_follow_ups', 'substance_use_clinical_summaries',
  'investigation_uploads', 'notice_board', 'audit_logs', 'patient_assignments',
]);

// Sync queue item interface
export interface QueuedRequest {
  id?: number;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  timestamp: Date;
  retries: number;
  entityType: string;
  entityId?: string | number;
  priority: 'high' | 'normal' | 'low';
}

// Offline status interface
export interface OfflineStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncInProgress: boolean;
}

// Table name to entity mapping for caching
const ENTITY_TABLES: Record<string, string> = {
  patients: 'patients',
  'treatment-plans': 'treatment_plans',
  'plan-steps': 'plan_steps',
  admissions: 'admissions',
  discharges: 'discharge-summaries',
  prescriptions: 'prescriptions',
  'wound-care': 'wound_care',
  'lab-orders': 'lab_investigations',
  'lab-results': 'lab_results',
  surgeries: 'surgery_bookings',
  'ward-rounds': 'ward_rounds',
  users: 'users',
  activities: 'user_activities',
  performance: 'performance_metrics',
  duties: 'duty_assignments',
  rotations: 'rotation_records',
  'cbt-tests': 'cbt_tests',
  'cbt-attempts': 'cbt_attempts',
  chat: 'chat_messages',
  'chat-rooms': 'chat_rooms',
};

class OfflineManager {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private syncListeners: Set<(status: OfflineStatus) => void> = new Set();
  private lastSyncTime: Date | null = null;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));

    // Load last sync time from localStorage
    const savedSyncTime = localStorage.getItem('lastSyncTime');
    if (savedSyncTime) {
      this.lastSyncTime = new Date(savedSyncTime);
    }

    // Start periodic sync check
    this.startPeriodicSync();
  }

  // Subscribe to offline status changes
  onStatusChange(listener: (status: OfflineStatus) => void): () => void {
    this.syncListeners.add(listener);
    // Immediately call with current status
    this.getStatus().then(listener);
    return () => this.syncListeners.delete(listener);
  }

  // Get current offline status
  async getStatus(): Promise<OfflineStatus> {
    const pendingCount = await db.sync_queue.count();
    return {
      isOnline: this.isOnline,
      pendingCount,
      lastSyncTime: this.lastSyncTime,
      syncInProgress: this.syncInProgress,
    };
  }

  // Notify all listeners of status change
  private async notifyListeners() {
    const status = await this.getStatus();
    this.syncListeners.forEach(listener => listener(status));
  }

  // Handle coming online
  private async handleOnline() {
    this.isOnline = true;
    logger.log('🌐 Back online - starting sync...');
    toast.success('Back online! Syncing data...', { id: 'network-status', duration: 3000 });
    
    // Trigger sync
    await this.syncAll();
    this.notifyListeners();
  }

  // Handle going offline
  private handleOffline() {
    this.isOnline = false;
    logger.log('📴 Gone offline - all changes will be saved locally');
    toast.error('You are offline. Changes will sync when reconnected.', { 
      id: 'network-status', 
      duration: 5000 
    });
    this.notifyListeners();
  }

  // Start periodic sync (every 5 minutes when online)
  private startPeriodicSync() {
    this.syncInterval = setInterval(async () => {
      if (this.isOnline && !this.syncInProgress) {
        const pendingCount = await db.sync_queue.count();
        if (pendingCount > 0) {
          console.log(`⏰ Periodic sync: ${pendingCount} items pending`);
          await this.syncAll();
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Queue a request for later sync
  async queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>): Promise<number> {
    const queueItem = {
      ...request,
      timestamp: new Date(),
      retries: 0,
    };

    // Store in sync queue
    const id = await db.sync_queue.add({
      action: request.method.toLowerCase() as 'create' | 'update' | 'delete',
      table: request.entityType,
      local_id: typeof request.entityId === 'number' ? request.entityId : 0,
      data: {
        url: request.url,
        method: request.method,
        body: request.body,
        headers: request.headers,
        priority: request.priority,
      },
      created_at: new Date(),
      retries: 0,
    });

    console.log(`📥 Queued ${request.method} request to ${request.url}`);
    this.notifyListeners();
    return id as number;
  }

  // Get data from cache (IndexedDB)
  async getCachedData<T>(entityType: string, id?: string | number): Promise<T | T[] | null> {
    const tableName = ENTITY_TABLES[entityType] || entityType;
    const table = (db as any)[tableName];

    if (!table) {
      console.warn(`Table ${tableName} not found in database`);
      return null;
    }

    try {
      if (id) {
        const item = await table.get(typeof id === 'string' ? parseInt(id, 10) || id : id);
        return item || null;
      }
      return await table.toArray();
    } catch (error) {
      console.error(`Error getting cached data for ${entityType}:`, error);
      return null;
    }
  }

  // Cache data to IndexedDB
  async cacheData<T extends { id?: number | string }>(
    entityType: string,
    data: T | T[],
    options: { merge?: boolean; markSynced?: boolean } = {}
  ): Promise<void> {
    const tableName = ENTITY_TABLES[entityType] || entityType;
    const table = (db as any)[tableName];

    if (!table) {
      console.warn(`Table ${tableName} not found in database`);
      return;
    }

    try {
      const items = Array.isArray(data) ? data : [data];
      const preparedItems = items.map(item => ({
        ...item,
        synced: options.markSynced !== false,
        updated_at: new Date(),
      }));

      if (options.merge) {
        await table.bulkPut(preparedItems);
      } else {
        // Clear and replace
        await table.clear();
        await table.bulkAdd(preparedItems);
      }

      console.log(`💾 Cached ${items.length} ${entityType} items`);
    } catch (error) {
      console.error(`Error caching data for ${entityType}:`, error);
    }
  }

  // Cache a single item
  async cacheItem<T extends { id?: number | string }>(
    entityType: string,
    data: T
  ): Promise<void> {
    const tableName = ENTITY_TABLES[entityType] || entityType;
    const table = (db as any)[tableName];

    if (!table) {
      console.warn(`Table ${tableName} not found in database`);
      return;
    }

    try {
      await table.put({
        ...data,
        synced: true,
        updated_at: new Date(),
      });
    } catch (error) {
      console.error(`Error caching item for ${entityType}:`, error);
    }
  }

  // Store data locally (for offline creates/updates)
  async storeLocally<T extends { id?: number | string }>(
    entityType: string,
    data: T,
    action: 'create' | 'update' | 'delete'
  ): Promise<number> {
    const tableName = ENTITY_TABLES[entityType] || entityType;
    const table = (db as any)[tableName];

    if (!table) {
      throw new Error(`Table ${tableName} not found in database`);
    }

    try {
      let localId: number;

      if (action === 'create') {
        localId = await table.add({
          ...data,
          synced: false,
          created_at: new Date(),
          updated_at: new Date(),
        });
      } else if (action === 'update') {
        const id = data.id;
        await table.update(typeof id === 'string' ? parseInt(id, 10) || id : id, {
          ...data,
          synced: false,
          updated_at: new Date(),
        });
        localId = typeof id === 'number' ? id : parseInt(id as string, 10);
      } else {
        // Delete - soft delete
        const id = data.id;
        await table.update(typeof id === 'string' ? parseInt(id, 10) || id : id, {
          deleted: true,
          synced: false,
          updated_at: new Date(),
        });
        localId = typeof id === 'number' ? id : parseInt(id as string, 10);
      }

      return localId;
    } catch (error) {
      console.error(`Error storing data locally for ${entityType}:`, error);
      throw error;
    }
  }

  // Sync all pending requests
  async syncAll(): Promise<{ synced: number; failed: number; errors: string[] }> {
    if (this.syncInProgress || !this.isOnline) {
      return { synced: 0, failed: 0, errors: ['Sync in progress or offline'] };
    }

    this.syncInProgress = true;
    this.notifyListeners();

    const result = { synced: 0, failed: 0, errors: [] as string[] };

    try {
      // Get all pending sync items, ordered by creation time
      const pendingItems = await db.sync_queue
        .orderBy('created_at')
        .toArray();

      console.log(`🔄 Syncing ${pendingItems.length} pending items...`);

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await db.sync_queue.delete(item.id!);
          result.synced++;
        } catch (error) {
          result.failed++;
          const errorMessage = error instanceof Error ? error.message : String(error);
          result.errors.push(`${item.table} ${item.action}: ${errorMessage}`);

          // Update retry count
          const newRetries = item.retries + 1;
          if (newRetries >= 3) {
            // Remove after 3 failures
            await db.sync_queue.delete(item.id!);
            toast.error(`Failed to sync ${item.table} after 3 attempts`);
          } else {
            await db.sync_queue.update(item.id!, {
              retries: newRetries,
              last_error: errorMessage,
            });
          }
        }
      }

      if (result.synced > 0) {
        this.lastSyncTime = new Date();
        localStorage.setItem('lastSyncTime', this.lastSyncTime.toISOString());
        toast.success(`Synced ${result.synced} changes`, { duration: 3000 });
      }

      console.log(`✅ Sync complete: ${result.synced} synced, ${result.failed} failed`);
    } catch (error) {
      result.errors.push(`Sync error: ${error}`);
      console.error('Sync error:', error);
    } finally {
      this.syncInProgress = false;
      this.notifyListeners();
    }

    return result;
  }

  // Sync a single item
  private async syncItem(item: any): Promise<void> {
    const { action, table, local_id, data } = item;
    const token = apiClient.getToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // If we have URL info stored, use it
    if (data.url) {
      const response = await fetch(data.url, {
        method: data.method || 'POST',
        headers: { ...headers, ...data.headers },
        body: data.body ? JSON.stringify(data.body) : undefined,
        credentials: 'include',
      });

      if (!response.ok) {
        // Handle 409 Conflict - record already exists on server
        if (response.status === 409) {
          if (local_id && table) {
            const tableRef = (db as any)[table];
            if (tableRef) {
              await tableRef.update(local_id, { synced: true });
            }
          }
          return; // Treat as success
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return;
    }

    // Otherwise, use the standard sync approach based on table and action
    const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL 
      || ((import.meta as any).env?.PROD ? '/api' : 'http://localhost:3005/api');
    const tableName = table.replace(/_/g, '-');

    // Entities without a dedicated REST endpoint sync via the generic /sync/push
    // endpoint. Building /api/<table> for these returns 404 (the original bug).
    if (GENERIC_SYNC_TABLES.has(table)) {
      const entityId = (data && (data.id ?? local_id)) ?? local_id;
      const payload = { ...(data || {}) };
      delete (payload as any).synced;
      const response = await fetch(`${baseUrl}/sync/push`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          changes: [{
            entityType: table,
            entityId: String(entityId),
            action: action === 'delete' ? 'delete' : 'upsert',
            payload,
          }],
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const tableRef = (db as any)[table];
      if (tableRef && local_id) {
        try { await tableRef.update(local_id, { synced: true }); } catch { /* string-key table */ }
      }
      return;
    }

    let endpoint: string;
    let method: string;
    let body: any;

    switch (action) {
      case 'create':
        endpoint = `${baseUrl}/${tableName}`;
        method = 'POST';
        body = data;
        break;
      case 'update':
        endpoint = `${baseUrl}/${tableName}/${local_id}`;
        method = 'PUT';
        body = data;
        break;
      case 'delete':
        endpoint = `${baseUrl}/${tableName}/${local_id}`;
        method = 'DELETE';
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (!response.ok) {
      // Handle 409 Conflict - record already exists on server, mark as synced
      if (response.status === 409 && action === 'create') {
        const tableRef = (db as any)[table];
        if (tableRef && local_id) {
          await tableRef.update(local_id, { synced: true });
          console.log(`✅ ${table} ${local_id} already on server, marked synced`);
        }
        return; // Treat as success
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    // If create, update local record with server ID
    if (action === 'create' && local_id) {
      const responseData = await response.json().catch(() => null);
      if (responseData?.id) {
        const tableRef = (db as any)[table];
        if (tableRef) {
          await tableRef.update(local_id, {
            serverId: responseData.id,
            synced: true,
          });
        }
      }
    }
  }

  // Force sync now
  async forceSync(): Promise<{ synced: number; failed: number; errors: string[] }> {
    if (!this.isOnline) {
      toast.error('Cannot sync while offline');
      return { synced: 0, failed: 0, errors: ['Offline'] };
    }
    return this.syncAll();
  }

  // Check if online
  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // Clear all cached data (for logout)
  async clearCache(): Promise<void> {
    try {
      // Clear all tables except sync queue (to preserve pending changes)
      const tables = Object.values(ENTITY_TABLES);
      for (const table of tables) {
        const tableRef = (db as any)[table];
        if (tableRef) {
          await tableRef.clear();
        }
      }
      console.log('🗑️ Cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Get pending sync count
  async getPendingCount(): Promise<number> {
    return db.sync_queue.count();
  }

  // Cleanup
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }
}

// Export singleton instance
export const offlineManager = new OfflineManager();
