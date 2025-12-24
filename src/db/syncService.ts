import { db, SyncQueue, Patient, TreatmentPlan, PlanStep } from './database';
import { apiClient } from '../services/apiClient';
import toast from 'react-hot-toast';

// Use the actual API client base URL
const getApiBaseUrl = () => {
  return import.meta.env.PROD 
    ? '/api'  // Production: use relative path
    : 'http://localhost:3001/api';  // Development
};

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

class SyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private retryTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private syncListeners: Set<(status: { isOnline: boolean; pendingCount: number }) => void> = new Set();

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Start periodic sync when online
    this.startPeriodicSync();
    
    // Listen for auth expiration
    window.addEventListener('auth:expired', () => {
      toast.error('Session expired. Please log in again.');
    });
  }

  // Subscribe to sync status changes
  onSyncStatusChange(listener: (status: { isOnline: boolean; pendingCount: number }) => void) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  private async notifyListeners() {
    const pendingCount = await db.sync_queue.count();
    this.syncListeners.forEach(listener => listener({ isOnline: this.isOnline, pendingCount }));
  }

  private handleOnline() {
    this.isOnline = true;
    toast.success('Back online! Syncing data...', { id: 'connectivity' });
    this.syncAll();
    this.notifyListeners();
  }

  private handleOffline() {
    this.isOnline = false;
    toast.error('Offline mode - changes will sync when reconnected', { 
      id: 'connectivity',
      duration: 5000 
    });
    this.notifyListeners();
  }

  // Queue an action for sync when online
  async queueAction(
    action: 'create' | 'update' | 'delete',
    table: string,
    localId: number,
    data: any
  ): Promise<void> {
    const queueItem: SyncQueue = {
      action,
      table,
      local_id: localId,
      data,
      created_at: new Date(),
      retries: 0
    };

    await db.sync_queue.add(queueItem);
    
    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.syncAll();
    }
  }

  // Sync all pending items
  async syncAll(): Promise<SyncResult> {
    if (this.syncInProgress || !this.isOnline) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress or offline'] };
    }

    this.syncInProgress = true;
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      // Get all pending sync items, ordered by creation time
      const pendingItems = await db.sync_queue
        .orderBy('created_at')
        .toArray();

      for (const item of pendingItems) {
        try {
          await this.syncItem(item);
          await db.sync_queue.delete(item.id!);
          result.synced++;
        } catch (error) {
          console.error('Sync error for item:', item, error);
          result.failed++;
          result.errors.push(`${item.table} ${item.action}: ${error}`);
          
          // Update retry count
          await db.sync_queue.update(item.id!, {
            retries: item.retries + 1,
            last_error: String(error)
          });

          // Remove items that have failed too many times
          if (item.retries >= 3) {
            await db.sync_queue.delete(item.id!);
            toast.error(`Failed to sync ${item.table} after 3 attempts`);
          }
        }
      }

      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} changes successfully`);
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
      toast.error('Sync failed - will retry later');
    } finally {
      this.syncInProgress = false;
    }

    return result;
  }

  // Sync a single item
  private async syncItem(item: SyncQueue): Promise<void> {
    const { action, table, local_id, data } = item;

    switch (table) {
      case 'patients':
        await this.syncPatient(action, local_id, data);
        break;
      case 'treatment_plans':
        await this.syncTreatmentPlan(action, local_id, data);
        break;
      case 'plan_steps':
        await this.syncPlanStep(action, local_id, data);
        break;
      default:
        throw new Error(`Unknown table: ${table}`);
    }
  }

  private async syncPatient(action: string, localId: number, data: any): Promise<void> {
    const patient = await db.patients.get(localId);
    if (!patient) return;

    switch (action) {
      case 'create':
        const createResponse = await this.apiCall('POST', '/sync/patients', {
          hospital_number: patient.hospital_number,
          first_name: patient.first_name,
          last_name: patient.last_name,
          date_of_birth: patient.dob,
          gender: patient.sex,
          phone: patient.phone,
          address: patient.address,
          allergies: patient.allergies,
          chronic_conditions: patient.comorbidities
        });
        
        // Update local record with server ID
        await db.patients.update(localId, {
          serverId: createResponse.patient?.id || createResponse.id,
          synced: true
        });
        break;

      case 'update':
        if (patient.serverId) {
          await this.apiCall('PUT', `/sync/patients/${patient.serverId}`, {
            hospital_number: patient.hospital_number,
            first_name: patient.first_name,
            last_name: patient.last_name,
            date_of_birth: patient.dob,
            gender: patient.sex,
            phone: patient.phone,
            address: patient.address,
            allergies: patient.allergies,
            chronic_conditions: patient.comorbidities,
            ...data
          });
          await db.patients.update(localId, { synced: true });
        }
        break;

      case 'delete':
        if (patient.serverId) {
          await this.apiCall('DELETE', `/sync/patients/${patient.serverId}`);
        }
        await db.patients.delete(localId);
        break;
    }
  }

  private async syncTreatmentPlan(action: string, localId: number, data: any): Promise<void> {
    const plan = await db.treatment_plans.get(localId);
    if (!plan) return;

    const patient = await db.patients.get(plan.patient_id);
    const patientServerId = patient?.serverId;

    if (!patientServerId && action !== 'delete') {
      throw new Error('Cannot sync treatment plan: patient not synced yet');
    }

    switch (action) {
      case 'create':
        const response = await this.apiCall('POST', '/treatment-plans', {
          patient_id: patientServerId,
          title: plan.title,
          diagnosis: plan.diagnosis,
          status: plan.status,
          start_date: plan.start_date,
          planned_end_date: plan.planned_end_date,
          description: plan.description,
          created_by: plan.created_by
        });
        
        await db.treatment_plans.update(localId, {
          serverId: response.id,
          synced: true
        });
        break;

      case 'update':
        if (plan.serverId) {
          await this.apiCall('PUT', `/treatment-plans/${plan.serverId}`, data);
          await db.treatment_plans.update(localId, { synced: true });
        }
        break;

      case 'delete':
        if (plan.serverId) {
          await this.apiCall('DELETE', `/treatment-plans/${plan.serverId}`);
        }
        await db.treatment_plans.delete(localId);
        break;
    }
  }

  private async syncPlanStep(action: string, localId: number, data: any): Promise<void> {
    const step = await db.plan_steps.get(localId);
    if (!step) return;

    const plan = await db.treatment_plans.get(step.plan_id);
    const planServerId = plan?.serverId;

    if (!planServerId && action !== 'delete') {
      throw new Error('Cannot sync plan step: treatment plan not synced yet');
    }

    switch (action) {
      case 'create':
        const response = await this.apiCall('POST', '/plan-steps', {
          plan_id: planServerId,
          step_number: step.step_number,
          title: step.title,
          description: step.description,
          assigned_to: step.assigned_to,
          due_date: step.due_date,
          duration: step.duration,
          status: step.status
        });
        
        await db.plan_steps.update(localId, {
          serverId: response.id,
          synced: true
        });
        break;

      case 'update':
        if (step.serverId) {
          await this.apiCall('PUT', `/plan-steps/${step.serverId}`, data);
          await db.plan_steps.update(localId, { synced: true });
        }
        break;

      case 'delete':
        if (step.serverId) {
          await this.apiCall('DELETE', `/plan-steps/${step.serverId}`);
        }
        await db.plan_steps.delete(localId);
        break;
    }
  }

  // Real API call using the apiClient
  private async apiCall(method: string, endpoint: string, data?: any): Promise<any> {
    const token = apiClient.getToken();
    const baseUrl = getApiBaseUrl();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Start periodic sync every 5 minutes when online
  private startPeriodicSync(): void {
    setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        this.syncAll();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    pendingCount: number;
    lastSync: Date | null;
    isOnline: boolean;
  }> {
    const pendingCount = await db.sync_queue.count();
    const lastSyncedItem = await db.sync_queue
      .orderBy('created_at')
      .reverse()
      .first();

    return {
      pendingCount,
      lastSync: lastSyncedItem?.created_at || null,
      isOnline: this.isOnline
    };
  }

  // Force sync (for manual trigger)
  async forcSync(): Promise<SyncResult> {
    return this.syncAll();
  }
}

// Export singleton instance
export const syncService = new SyncService();