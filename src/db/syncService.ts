import { db, SyncQueue } from './database';
import { apiClient } from '../services/apiClient';
import toast from 'react-hot-toast';
import { toWoundCarePayload } from './woundCarePayload';
import { toSurgeryPayload } from './surgeryPayload';
import { toWardRoundPayload } from './wardRoundPayload';

// Use the actual API client base URL
const getApiBaseUrl = () => {
  return import.meta.env.PROD 
    ? '/api'  // Production: use relative path
    : 'http://localhost:3005/api';  // Development
};

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

// Maximum retries before an item is permanently removed from the queue
const MAX_RETRIES = 5;
// Maximum age (in ms) for a sync queue item before it's considered stale (30 days)
const MAX_ITEM_AGE_MS = 30 * 24 * 60 * 60 * 1000;
// Per-request network timeout — critical on flaky hospital Wi-Fi where TCP
// connections can hang indefinitely on the half-open state. Without this, one
// stuck request can stall the entire sync queue forever.
const SYNC_FETCH_TIMEOUT_MS = 15000;

/** Generate a stable idempotency key for a queued mutation. Falls back to a
 *  Math.random-based UUID v4 if crypto.randomUUID is unavailable (older Safari). */
function generateIdempotencyKey(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch { /* fall through */ }
  // RFC 4122 v4 fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** A sync running longer than this is treated as stuck and may be reset. */
const STUCK_SYNC_THRESHOLD_MS = 2 * 60 * 1000;

class SyncService {
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  /** When the in-flight run started, so forceSync can tell "busy" from "stuck". */
  private syncStartedAt: number | null = null;
  private retryTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private syncListeners: Set<(status: { isOnline: boolean; pendingCount: number }) => void> = new Set();
  /** Idempotency key of the queue item currently being replayed. Read by apiCall
   *  / replayRawRequest so they can stamp X-Idempotency-Key on the outbound request. */
  private currentIdempotencyKey: string | null = null;

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
      retries: 0,
      idempotency_key: generateIdempotencyKey()
    };

    await db.sync_queue.add(queueItem);
    
    // Try immediate sync if online
    if (this.isOnline && !this.syncInProgress) {
      this.syncAll();
    }
  }

  // Sync all pending items
  async syncAll(): Promise<SyncResult> {
    // Skip if not authenticated
    const token = apiClient.getToken();
    if (!token) {
      console.log('⏳ Sync skipped - waiting for authentication');
      return { success: false, synced: 0, failed: 0, errors: ['Not authenticated'] };
    }
    
    if (this.syncInProgress || !this.isOnline) {
      return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress or offline'] };
    }

    this.syncInProgress = true;
    this.syncStartedAt = Date.now();
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    try {
      // First, purge stale items that are too old or have too many retries
      await this.purgeStaleItems();

      // Get all pending sync items, ordered by creation time
      const pendingItems = await db.sync_queue
        .orderBy('created_at')
        .toArray();

      for (const item of pendingItems) {
        // Backfill idempotency key for items queued before this field existed,
        // so the server can still dedupe them if we have to retry.
        if (!item.idempotency_key) {
          item.idempotency_key = generateIdempotencyKey();
          try { await db.sync_queue.update(item.id!, { idempotency_key: item.idempotency_key }); } catch { /* ignore */ }
        }
        this.currentIdempotencyKey = item.idempotency_key;
        try {
          await this.syncItem(item);
          await db.sync_queue.delete(item.id!);
          result.synced++;
        } catch (error) {
          console.error('Sync error for item:', item, error);
          result.failed++;
          result.errors.push(`${item.table} ${item.action}: ${error}`);
          
          // Increment retry count (use NEW value for checking)
          const newRetries = (item.retries || 0) + 1;
          
          if (newRetries >= MAX_RETRIES) {
            // Move to dead letter queue instead of permanently deleting
            try {
              await db.sync_dead_letter.add({
                table: item.table,
                action: item.action,
                local_id: item.local_id,
                data: item.data,
                created_at: item.created_at,
                failed_at: new Date(),
                retries: newRetries,
                last_error: String(error)
              });
            } catch (dlqError) {
              console.error('Failed to move item to dead letter queue:', dlqError);
            }
            await db.sync_queue.delete(item.id!);
            console.warn(`📦 Moved sync item ${item.table}/${item.local_id} to dead letter queue after ${MAX_RETRIES} failed attempts: ${error}`);
          } else {
            await db.sync_queue.update(item.id!, {
              retries: newRetries,
              last_error: String(error)
            });
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
      this.currentIdempotencyKey = null;
      this.syncInProgress = false;
      this.syncStartedAt = null;

      // Never let permanently-failed clinical entries sit silently. But do not
      // nag on every sync for items the user already knows about: only toast
      // when the count INCREASES (a genuinely NEW failure). The full list is
      // always available in Settings → Sync issues (SyncIssuesViewer), where it
      // can be inspected, retried or dismissed.
      try {
        const dead = await this.getDeadLetterCount();
        const lastSeen = Number(localStorage.getItem('sync_dead_letter_seen') || '0');
        if (dead > lastSeen) {
          const added = dead - lastSeen;
          console.warn(`⚠️ ${added} new change(s) failed to sync; ${dead} total held for review.`);
          toast.error(
            `${added} change${added === 1 ? '' : 's'} couldn't sync. Open Settings → Sync issues to review.`,
            { id: 'sync-dead-letter', duration: 7000 }
          );
        }
        localStorage.setItem('sync_dead_letter_seen', String(dead));
      } catch { /* never let reporting break the sync */ }
      this.notifyListeners();
    }

    return result;
  }

  // Purge items that are too old or have exceeded max retries
  private async purgeStaleItems(): Promise<number> {
    let purgedCount = 0;
    try {
      const allItems = await db.sync_queue.toArray();
      const now = Date.now();
      
      for (const item of allItems) {
        const itemAge = now - new Date(item.created_at).getTime();
        const isTooOld = itemAge > MAX_ITEM_AGE_MS;
        const isTooManyRetries = (item.retries || 0) >= MAX_RETRIES;
        const hasInvalidUrl = item.data?.url && (
          item.data.url.includes('localhost') && import.meta.env.PROD
        );
        
        if (isTooOld || isTooManyRetries || hasInvalidUrl) {
          // Move to dead letter queue before deleting (preserve data for recovery)
          if (!hasInvalidUrl) {
            try {
              await db.sync_dead_letter.add({
                table: item.table,
                action: item.action,
                local_id: item.local_id,
                data: item.data,
                created_at: item.created_at,
                failed_at: new Date(),
                retries: item.retries || 0,
                last_error: isTooOld ? 'Exceeded max age' : 'Exceeded max retries'
              });
            } catch { /* dead letter add failed — still remove from queue */ }
          }
          await db.sync_queue.delete(item.id!);
          purgedCount++;
        }
      }
      
      if (purgedCount > 0) {
        console.log(`🧹 Purged ${purgedCount} stale/invalid sync queue items`);
      }
    } catch (e) {
      console.warn('Failed to purge stale items:', e);
    }
    return purgedCount;
  }

  // Sync a single item
  private async syncItem(item: SyncQueue): Promise<void> {
    const { action, table, local_id, data } = item;

    // Handle raw request replay format (queued by apiClient when offline)
    if (data && data.url && data.method) {
      // Fix URLs: rewrite localhost URLs to production base URL when in production
      if (import.meta.env.PROD && data.url.includes('localhost')) {
        const urlPath = new URL(data.url).pathname;
        data.url = urlPath; // Convert to relative path
      }
      return this.replayRawRequest(data);
    }

    switch (table) {
      // ── Core Clinical Entities with specific sync methods ──
      case 'patients':
        await this.syncPatient(action, local_id, data);
        break;
      case 'admissions':
        await this.syncAdmission(action, local_id, data);
        break;
      case 'discharges':
        await this.syncDischarge(action, local_id, data);
        break;
      case 'treatment_plans':
        await this.syncTreatmentPlan(action, local_id, data);
        break;
      case 'plan_steps':
        await this.syncPlanStep(action, local_id, data);
        break;
      case 'progress_notes':
        await this.syncProgressNote(action, local_id, data);
        break;
      case 'prescriptions':
        await this.syncPrescription(action, local_id, data);
        break;
      case 'lab_investigations':
        await this.syncLabInvestigation(action, local_id, data);
        break;
      case 'lab_results':
        await this.syncLabResult(action, local_id, data);
        break;
      case 'risk_assessments':
      case 'dvt_assessments':
      case 'pressure_sore_assessments':
      case 'nutritional_assessments':
        await this.syncRiskAssessment(action, local_id, data);
        break;
      case 'preoperative_assessments':
        await this.syncPreoperativeAssessment(action, local_id, data);
        break;
      case 'surgeries':
      case 'surgery_bookings':
        await this.syncSurgery(action, local_id, data);
        break;
      case 'wound_care':
      case 'wound_care_records':
        await this.syncWoundCare(action, local_id, data);
        break;
      case 'ward_rounds':
        await this.syncWardRound(action, local_id, data);
        break;
      case 'patient_transfers':
        await this.syncPatientTransfer(action, local_id, data);
        break;

      // ── Entities synced via the generic /sync/push endpoint ──
      case 'shopping_lists':
      case 'call_duty_roster':
      case 'clinic_duty_logs':
      case 'cbt_attempts':
      case 'blood_transfusions':
      case 'burn_patients':
      case 'diabetic_foot_assessments':
      case 'procedures':
      case 'who_safety_checklists':
      case 'ward_rounds_clinical':
      case 'mdt_patient_teams':
      case 'mdt_meetings':
      case 'mdt_contact_logs':
      case 'sjs_assessments':
      case 'substance_use_assessments':
      case 'detox_monitoring_records':
      case 'detox_follow_ups':
      case 'substance_use_clinical_summaries':
      case 'investigation_uploads':
      case 'notice_board':
      case 'audit_logs':
        await this.syncGenericEntity(action, table, local_id, data);
        break;

      default:
        // For any table that exists in the database, attempt generic sync
        try {
          const tableRef = (db as any).table(table);
          if (tableRef) {
            console.log(`⚡ Attempting generic sync for unregistered table: ${table}`);
            await this.syncGenericEntity(action, table, local_id, data);
          } else {
            console.warn(`⚠️ Unknown table "${table}" — removing item from queue`);
          }
        } catch {
          console.warn(`⚠️ Table "${table}" not found in database — removing item from queue`);
        }
        // Item will be deleted by the caller since we don't throw
    }
  }

  private async syncAdmission(action: string, localId: number, _data: any): Promise<void> {
    const admission = await db.admissions.get(localId);
    if (!admission) return;

    switch (action) {
      case 'create':
        // Transform snake_case to camelCase for backend
        {
        const backendData = {
          patientId: admission.patient_id,
          admissionDate: admission.admission_date,
          ward: admission.ward_location,
          bedNumber: admission.bed_number,
          admittingDiagnosis: admission.provisional_diagnosis || admission.reasons_for_admission,
          notes: admission.presenting_complaint || '',
          status: admission.status || 'active'
        };
        console.log('🔄 Syncing admission to server:', backendData);
        const response = await this.apiCall('POST', '/admissions', backendData);
        await db.admissions.update(localId, {
          id: response.admission.id,
          synced: true
        });
        console.log('✅ Admission synced to server:', response.admission.id);
        break;
      }

      case 'update':
        if (admission.id) {
          const updateData = {
            ward: admission.ward_location,
            bedNumber: admission.bed_number,
            admittingDiagnosis: admission.provisional_diagnosis,
            notes: admission.presenting_complaint,
            status: admission.status
          };
          await this.apiCall('PUT', `/admissions/${admission.id}`, updateData);
          await db.admissions.update(localId, { synced: true });
          console.log('✅ Admission updated on server:', admission.id);
        }
        break;

      case 'delete':
        if (admission.id) {
          await this.apiCall('DELETE', `/admissions/${admission.id}`, {});
          await db.admissions.delete(localId);
        }
        break;
    }
  }

  private async syncDischarge(action: string, localId: number, _data: any): Promise<void> {
    const discharge = await db.discharges.get(localId);
    if (!discharge) return;

    switch (action) {
      case 'create':
        {
        const response = await this.apiCall('POST', '/discharge-summaries', discharge);
        await db.discharges.update(localId, {
          id: response.id,
          synced: true
        });
        console.log('✅ Discharge synced to server:', response.id);
        break;
      }

      case 'update':
        if (discharge.id) {
          await this.apiCall('PUT', `/discharge-summaries/${discharge.id}`, discharge);
          await db.discharges.update(localId, { synced: true });
          console.log('✅ Discharge updated on server:', discharge.id);
        }
        break;

      case 'delete':
        if (discharge.id) {
          await this.apiCall('DELETE', `/discharge-summaries/${discharge.id}`, {});
          await db.discharges.delete(localId);
        }
        break;
    }
  }

  private async syncPatient(action: string, localId: number, data: any): Promise<void> {
    const patient = await db.patients.get(localId);
    if (!patient) return;

    switch (action) {
      case 'create':
        try {
          const createResponse = await this.apiCall('POST', '/sync/patients', {
            hospital_number: patient.hospital_number,
            first_name: patient.first_name,
            last_name: patient.last_name,
            date_of_birth: patient.dob,
            gender: patient.sex,
            phone: patient.phone,
            address: patient.address,
            allergies: patient.allergies,
            chronic_conditions: patient.comorbidities,
            primary_diagnosis: (patient as any).primary_diagnosis || (patient as any).diagnosis || ''
          });
          
          // Update local record with server ID
          await db.patients.update(localId, {
            serverId: createResponse.patient?.id || createResponse.id,
            synced: true
          });
        } catch (error: any) {
          // Handle 409 conflict - patient already exists on server
          if (error.message?.includes('already exists') || error.message?.includes('409')) {
            console.log(`Patient ${patient.hospital_number} already exists on server, resolving conflict...`);
            try {
              // Fetch existing patient from server to get server ID
              const existingResponse = await this.apiCall('GET', `/sync/patients?hospital_number=${encodeURIComponent(patient.hospital_number)}`);
              const serverPatient = existingResponse.patients?.find(
                (p: any) => p.hospital_number === patient.hospital_number
              ) || existingResponse.patient;
              if (serverPatient) {
                await db.patients.update(localId, {
                  serverId: serverPatient.id,
                  synced: true
                });
                console.log(`✅ Conflict resolved for patient ${patient.hospital_number}`);
              } else {
                // Mark as synced anyway to prevent retry loops
                await db.patients.update(localId, { synced: true });
              }
            } catch (fetchError) {
              // Mark as synced to prevent infinite retry loop
              await db.patients.update(localId, { synced: true });
              console.warn('Could not fetch existing patient, marking as synced:', fetchError);
            }
          } else {
            throw error; // Re-throw non-conflict errors
          }
        }
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
        {
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
      }

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
        {
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
      }

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

  private async syncProgressNote(action: string, localId: number, _data: any): Promise<void> {
    const note = await db.progress_notes?.get(localId);
    if (!note) return;

    if (action === 'create') {
      const response = await this.apiCall('POST', '/progress-notes', note);
      await db.progress_notes.update(localId, { id: response.id, synced: true });
      console.log('✅ Progress note synced to server:', response.id);
    }
  }

  private async syncPrescription(action: string, localId: number, _data: any): Promise<void> {
    const prescription = await db.prescriptions?.get(localId);
    if (!prescription) return;

    if (action === 'create') {
      // Ensure the data is in the correct format for the API
      const syncData = {
        patient_id: prescription.patient_id,
        prescriptions: prescription.prescriptions || [{
          medication: prescription.medication_name || prescription.medicationName,
          dosage: prescription.dosage,
          frequency: prescription.frequency,
          duration: prescription.duration,
          route: prescription.route,
          indication: prescription.instructions || prescription.indication
        }],
        prescriber: prescription.prescriber,
        prescriber_role: prescription.prescriber_role
      };
      
      const response = await this.apiCall('POST', '/prescriptions', syncData);
      await db.prescriptions.update(localId, { id: response.id, synced: true });
      console.log('✅ Prescription synced to server:', response.id);
    }
  }

  private async syncLabInvestigation(action: string, localId: number, _data: any): Promise<void> {
    const investigation = await db.lab_investigations?.get(localId);
    if (!investigation) return;

    switch (action) {
      case 'create':
        {
        const response = await this.apiCall('POST', '/lab-orders', investigation);
        await db.lab_investigations.update(localId, { id: response.id, synced: true });
        console.log('✅ Lab investigation synced to server:', response.id);
        break;
      }
      case 'update':
        if (investigation.id) {
          await this.apiCall('PUT', `/lab-orders/${investigation.id}`, investigation);
          await db.lab_investigations.update(localId, { synced: true });
        }
        break;
    }
  }

  private async syncLabResult(action: string, localId: number, _data: any): Promise<void> {
    const result = await db.lab_results?.get(localId);
    if (!result) return;

    if (action === 'create' && result.investigation_id) {
      // Results are attached to their parent lab order via PUT /lab-orders/{id}
      const response = await this.apiCall('PUT', `/lab-orders/${result.investigation_id}`, {
        results: result,
        status: 'completed',
        completedAt: new Date().toISOString()
      });
      await db.lab_results.update(localId, { synced: true });
      console.log('✅ Lab result synced to server via lab order:', result.investigation_id);
    }
  }

  private async syncRiskAssessment(action: string, localId: number, data: any): Promise<void> {
    // Try each assessment table type based on qi data or the queued item
    const assessmentType = data?.assessment_type || data?.type;
    let assessment: any = null;
    let tableName = 'dvt_assessments';
    const apiEndpoint = '/risk-assessments';

    // Try to find the record in the appropriate table
    if (assessmentType === 'pressure_sore' || assessmentType === 'braden') {
      assessment = await db.pressure_sore_assessments?.get(localId);
      tableName = 'pressure_sore_assessments';
    } else if (assessmentType === 'nutritional' || assessmentType === 'must') {
      assessment = await db.nutritional_assessments?.get(localId);
      tableName = 'nutritional_assessments';
    } else {
      assessment = await db.dvt_assessments?.get(localId);
      tableName = 'dvt_assessments';
    }

    // Fallback: try all assessment tables if not found
    if (!assessment) {
      assessment = await db.dvt_assessments?.get(localId);
      if (assessment) { tableName = 'dvt_assessments'; }
      else {
        assessment = await db.pressure_sore_assessments?.get(localId);
        if (assessment) { tableName = 'pressure_sore_assessments'; }
        else {
          assessment = await db.nutritional_assessments?.get(localId);
          if (assessment) { tableName = 'nutritional_assessments'; }
        }
      }
    }

    if (!assessment) return;

    if (action === 'create') {
      const response = await this.apiCall('POST', apiEndpoint, assessment);
      await (db as any)[tableName].update(localId, { id: response.id, synced: true });
      console.log(`✅ Risk assessment (${tableName}) synced to server:`, response.id);
    }
  }

  private async syncPreoperativeAssessment(action: string, localId: number, _data: any): Promise<void> {
    const assessment = await db.preoperative_assessments?.get(localId);
    if (!assessment) return;

    if (action === 'create') {
      const response = await this.apiCall('POST', '/preoperative-assessments', assessment);
      await db.preoperative_assessments.update(localId, { id: response.id, synced: true });
      console.log('✅ Preoperative assessment synced to server:', response.id);
    }
  }

  private async syncSurgery(action: string, localId: number, _data: any): Promise<void> {
    // Note: IndexedDB table is 'surgery_bookings' but sync uses 'surgeries' API
    const surgery = await db.surgery_bookings?.get(localId);
    if (!surgery) return;

    // The handler reads patientId/procedureName/scheduledDate and 400s without
    // them; the local booking spells all three differently. Posting the raw row
    // meant a booking made offline could never sync, which is the one case this
    // retry exists for.
    const payload = toSurgeryPayload(surgery);

    switch (action) {
      case 'create': {
        const response = await this.apiCall('POST', '/surgeries', payload);
        await db.surgery_bookings.update(localId, { id: response.id, synced: true });
        console.log('✅ Surgery synced to server:', response.id);
        break;
      }
      case 'update':
        if (surgery.id) {
          await this.apiCall('PUT', `/surgeries/${surgery.id}`, payload);
          await db.surgery_bookings.update(localId, { synced: true });
        }
        break;
    }
  }

  private async syncWoundCare(action: string, localId: number, _data: any): Promise<void> {
    // Note: IndexedDB table is 'wound_care' but API uses 'wound_care_records'
    const woundCare = await db.wound_care?.get(localId);
    if (!woundCare) return;

    const payload = toWoundCarePayload(woundCare);

    switch (action) {
      case 'create': {
        const response = await this.apiCall('POST', '/wound-care', payload);
        await db.wound_care.update(localId, {
          id: response.id || response.woundCareRecord?.id,
          synced: true,
        });
        console.log('✅ Wound care synced to server:', response.id);
        break;
      }
      case 'update':
        if (woundCare.id) {
          await this.apiCall('PUT', `/wound-care/${woundCare.id}`, payload);
          await db.wound_care.update(localId, { synced: true });
        }
        break;
    }
  }

  private async syncWardRound(action: string, localId: number, _data: any): Promise<void> {
    const wardRound = await db.ward_rounds?.get(localId);
    if (!wardRound) return;

    // The handler dispatches on ?action and reads camelCase fields, returning
    // 400 without patientId. Posting the raw local round to the bare path hit
    // neither, so this retry could never have succeeded.
    const payload = toWardRoundPayload(wardRound);

    switch (action) {
      case 'create': {
        const response = await this.apiCall('POST', '/ward-rounds?action=create', payload);
        await db.ward_rounds.update(localId, { id: response.id || response.wardRound?.id, synced: true });
        console.log('✅ Ward round synced to server:', response.id);
        break;
      }
      case 'update':
        if (wardRound.id) {
          await this.apiCall('PUT', `/ward-rounds?action=update`, { roundId: wardRound.id, ...payload });
          await db.ward_rounds.update(localId, { synced: true });
        }
        break;
    }
  }

  private async syncPatientTransfer(action: string, localId: number, _data: any): Promise<void> {
    const transfer = await (db as any).patient_transfers?.get(localId);
    if (!transfer) return;

    if (action === 'create') {
      const response = await this.apiCall('POST', '/patient-transfers', transfer);
      await (db as any).patient_transfers.update(localId, { id: response.id, synced: true });
      console.log('✅ Patient transfer synced to server:', response.id);
    }
  }

  // Generic sync for entities that use the /sync/push endpoint
  private async syncGenericEntity(action: string, table: string, localId: number, data: any): Promise<void> {
    // For text-id tables (shopping_lists), read from IndexedDB by string key
    // For serial-id tables, read by number key
    let record: any = null;
    try {
      record = await (db as any).table(table).get(localId);
    } catch {
      // If localId is a string, try get by string
      record = data;
    }
    if (!record && data) record = data;
    if (!record) return;

    const entityId = record.id || localId;
    const payload = { ...record };
    delete payload.synced;

    const response = await this.apiCall('POST', '/sync/push', {
      changes: [{
        entityType: table,
        entityId: String(entityId),
        action: action === 'delete' ? 'delete' : 'upsert',
        payload
      }]
    });

    // Inspect the per-change result before declaring success.
    //
    // The server used to answer 200 { success: true } even when every change
    // failed, and this method marked the record synced unconditionally. A row
    // rejected by an FK violation, a NOT NULL, or the broken mdt_meetings
    // upsert was therefore dropped from the outbox and never retried — silently
    // and permanently lost, while the UI showed a green "synced" state.
    //
    // /sync/push now returns 207 (partial) or 502 (total failure), which
    // apiCall surfaces as a throw; this check additionally covers a 200 whose
    // body still reports a per-change error.
    const failed = Array.isArray(response?.results)
      ? response.results.find((r: any) => r?.status === 'error')
      : null;
    if (failed) {
      throw new Error(
        `Server rejected ${table} ${entityId}: ${failed.message || failed.error || 'unknown error'}`
      );
    }

    // Mark as synced locally
    try {
      await (db as any).table(table).update(localId, { synced: true });
    } catch {
      // Ignore if update fails (e.g. string key table)
    }
    console.log(`✅ ${table} synced to server:`, entityId);
  }

  /** fetch() wrapped with an AbortController so a stalled connection can't hang
   *  the entire sync queue. Throws a descriptive Error on timeout. */
  private async fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = SYNC_FETCH_TIMEOUT_MS): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(`Sync request timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // Replay a raw queued request from apiClient
  private async replayRawRequest(data: { url: string; method: string; body?: any; headers?: Record<string, string> }): Promise<void> {
    const token = apiClient.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    // Always use fresh token (don't use stale token from the stored headers)
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Forward idempotency key so server can dedupe replayed mutations
    if (this.currentIdempotencyKey) {
      headers['X-Idempotency-Key'] = this.currentIdempotencyKey;
    }

    // Fix URL: ensure we use the correct base URL for the current environment
    let url = data.url;
    try {
      const parsedUrl = new URL(url, window.location.origin);
      // If the stored URL is absolute and points to localhost while we're in production,
      // extract just the pathname and use relative URL
      if (import.meta.env.PROD && parsedUrl.hostname === 'localhost') {
        url = parsedUrl.pathname + parsedUrl.search;
      }
    } catch {
      // If URL is already relative, leave it as-is
    }

    const response = await this.fetchWithTimeout(url, {
      method: data.method,
      headers,
      body: data.body ? JSON.stringify(data.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
    }
    console.log(`✅ Replayed queued ${data.method} ${url}`);
  }

  private async apiCall(method: string, endpoint: string, data?: any): Promise<any> {
    const token = apiClient.getToken();
    const baseUrl = getApiBaseUrl();
    
    // Skip API calls if not authenticated
    if (!token) {
      console.warn('⚠️ Skipping sync - no auth token available');
      throw new Error('Not authenticated - will retry after login');
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    // Forward idempotency key so server can dedupe replayed mutations
    if (this.currentIdempotencyKey) {
      headers['X-Idempotency-Key'] = this.currentIdempotencyKey;
    }

    const response = await this.fetchWithTimeout(`${baseUrl}${endpoint}`, {
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

  // Get detailed breakdown of what's in the sync queue
  async getQueueBreakdown(): Promise<{
    total: number;
    byTable: Record<string, number>;
    byAction: Record<string, number>;
    staleCount: number;
    failedCount: number;
    rawRequestCount: number;
  }> {
    const allItems = await db.sync_queue.toArray();
    const now = Date.now();
    const byTable: Record<string, number> = {};
    const byAction: Record<string, number> = {};
    let staleCount = 0;
    let failedCount = 0;
    let rawRequestCount = 0;

    for (const item of allItems) {
      // Count by table
      byTable[item.table] = (byTable[item.table] || 0) + 1;
      // Count by action
      byAction[item.action] = (byAction[item.action] || 0) + 1;
      // Count stale items (> 7 days old)
      if (now - new Date(item.created_at).getTime() > MAX_ITEM_AGE_MS) {
        staleCount++;
      }
      // Count items that have failed at least once
      if ((item.retries || 0) > 0) {
        failedCount++;
      }
      // Count raw request items (from apiClient offline queue)
      if (item.data?.url && item.data?.method) {
        rawRequestCount++;
      }
    }

    return {
      total: allItems.length,
      byTable,
      byAction,
      staleCount,
      failedCount,
      rawRequestCount
    };
  }

  // Clear all items from the sync queue (nuclear option)
  async clearAllQueue(): Promise<number> {
    const count = await db.sync_queue.count();
    await db.sync_queue.clear();
    console.log(`🗑️ Cleared ${count} items from sync queue`);
    this.notifyListeners();
    return count;
  }

  // Clear items for a specific table from the sync queue
  async clearQueueForTable(tableName: string): Promise<number> {
    const items = await db.sync_queue.where('table').equals(tableName).toArray();
    const ids = items.map(i => i.id!);
    await db.sync_queue.bulkDelete(ids);
    console.log(`🗑️ Cleared ${ids.length} items for table "${tableName}" from sync queue`);
    this.notifyListeners();
    return ids.length;
  }

  // ── Dead-letter recovery ──────────────────────────────────────────────
  //
  // Items are moved to sync_dead_letter when they exhaust MAX_RETRIES or pass
  // MAX_ITEM_AGE_MS, with the stated intent of "preserving data for recovery".
  // Nothing read that table, so the data was preserved into a place no user or
  // service could reach: a clinical entry the ward believed saved, invisible
  // and unrecoverable. These make it reachable.

  /** How many permanently-failed items are held. Non-zero warrants a UI warning. */
  async getDeadLetterCount(): Promise<number> {
    try { return await db.sync_dead_letter.count(); } catch { return 0; }
  }

  /** The failed items themselves, newest first, for display or export. */
  async getDeadLetterItems(limit = 100): Promise<any[]> {
    try {
      const items = await db.sync_dead_letter.orderBy('failed_at').reverse().limit(limit).toArray();
      return items;
    } catch {
      return [];
    }
  }

  /** Put one dead-lettered item back on the queue with a fresh retry budget. */
  async retryDeadLetterItem(id: number): Promise<boolean> {
    try {
      const item = await db.sync_dead_letter.get(id);
      if (!item) return false;
      await db.sync_queue.add({
        table: item.table,
        action: item.action,
        local_id: item.local_id,
        data: item.data,
        created_at: new Date(),
        retries: 0,
        idempotency_key: generateIdempotencyKey(),
      } as any);
      await db.sync_dead_letter.delete(id);
      this.notifyListeners();
      return true;
    } catch (e) {
      console.error('Failed to requeue dead-letter item:', e);
      return false;
    }
  }

  /** Requeue everything. Returns how many were restored. */
  async retryAllDeadLetter(): Promise<number> {
    const items = await this.getDeadLetterItems(1000);
    let restored = 0;
    for (const item of items) {
      if (await this.retryDeadLetterItem(item.id)) restored++;
    }
    if (restored > 0) {
      console.log(`♻️ Restored ${restored} dead-lettered items to the sync queue`);
      this.syncAll();
    }
    return restored;
  }

  // Force sync (for manual trigger)
  async forceSync(): Promise<SyncResult> {
    // Only clear the flag if the current run is genuinely STUCK.
    //
    // This used to reset syncInProgress unconditionally, so tapping the sync
    // button while the 5-minute periodic sync was mid-flight started a second
    // concurrent loop over the same queue rows. Because currentIdempotencyKey
    // is a single shared instance field, loop B's key then got stamped on loop
    // A's outbound request — defeating the idempotency mechanism at exactly the
    // moment it was needed — and whichever loop finished first cleared the flag
    // while the other was still running.
    if (this.syncInProgress) {
      const runningFor = this.syncStartedAt ? Date.now() - this.syncStartedAt : Infinity;
      if (runningFor < STUCK_SYNC_THRESHOLD_MS) {
        console.log('⏳ Sync already in progress — ignoring duplicate force request');
        return { success: false, synced: 0, failed: 0, errors: ['Sync already in progress'] };
      }
      console.warn(`⚠️ Sync appears stuck (${Math.round(runningFor / 1000)}s) — resetting`);
      this.syncInProgress = false;
    }
    return this.syncAll();
  }
}

// Export singleton instance
export const syncService = new SyncService();