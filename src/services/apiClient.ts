import { db } from '../db/database';

// API Base URL - handles all environments
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || (import.meta.env.PROD 
    ? '/api'  // Production fallback: use relative path (proxied by Nginx)
    : 'http://localhost:3005/api');  // Development: direct to backend

// Entity type mapping for IndexedDB caching (endpoint segment → db table name)
const ENDPOINT_TO_TABLE: Record<string, string> = {
  patients: 'patients',
  'treatment-plans': 'treatment_plans',
  'plan-steps': 'plan_steps',
  admissions: 'admissions',
  'discharge-summaries': 'discharges',
  discharges: 'discharges',
  prescriptions: 'prescriptions',
  'wound-care': 'wound_care',
  'lab-orders': 'lab_investigations',
  'lab-results': 'lab_results',
  'lab-investigations': 'lab_investigations',
  surgeries: 'surgery_bookings',
  'ward-rounds': 'ward_rounds',
  'ward-rounds-clinical': 'ward_rounds_clinical',
  users: 'users',
  activities: 'user_activities',
  'activity-logs': 'activity_logs',
  performance: 'performance_metrics',
  duties: 'duty_assignments',
  rotations: 'rotation_records',
  'cbt-tests': 'cbt_tests',
  'cbt-attempts': 'cbt_attempts',
  'cbt-progress': 'cbt_progress',
  chat: 'chat_messages',
  'chat-rooms': 'chat_rooms',
  'shopping-lists': 'shopping_lists',
  'progress-notes': 'progress_notes',
  'notice-board': 'notice_board',
  'clinic-appointments': 'clinic_sessions',
  'clinic-sessions': 'clinic_sessions',
  'surgery-bookings': 'surgery_bookings',
  'blood-transfusions': 'blood_transfusions',
  'preoperative-assessments': 'preoperative_assessments',
  'risk-assessments': 'dvt_assessments',
  'dvt-assessments': 'dvt_assessments',
  'pressure-sore-assessments': 'pressure_sore_assessments',
  'nutritional-assessments': 'nutritional_assessments',
  'diabetic-foot': 'diabetic_foot_assessments',
  'burn-patients': 'burn_patients',
  'who-safety-checklists': 'who_safety_checklists',
  procedures: 'procedures',
  'patient-assignments': 'patient_assignments',
  'audit-logs': 'audit_logs',
  'call-duty-roster': 'call_duty_roster',
  'clinic-duty-logs': 'clinic_duty_logs',
  'sjs-assessments': 'sjs_assessments',
  'investigation-uploads': 'investigation_uploads',
  'mdt-meetings': 'mdt_meetings',
  'mdt-contact-logs': 'mdt_contact_logs',
  'mdt-patient-teams': 'mdt_patient_teams',
};

// Sync state for cross-device sync
interface SyncState {
  lastSyncTimestamp: string | null;
  pendingChanges: number;
  isSyncing: boolean;
}

// API Client with enhanced cross-device sync support
class ApiClient {
  private baseURL: string;
  private token: string | null;
  private syncState: SyncState;
  private syncListeners: Set<(state: SyncState) => void>;
  private retryQueue: Map<string, { request: () => Promise<any>, retries: number }>;

  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
    this.syncState = {
      lastSyncTimestamp: localStorage.getItem('last_sync_timestamp'),
      pendingChanges: 0,
      isSyncing: false
    };
    this.syncListeners = new Set();
    this.retryQueue = new Map();

    // Listen for storage changes from other tabs/devices
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Listen for online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
  }

  private handleStorageChange(event: StorageEvent) {
    if (event.key === 'auth_token') {
      this.token = event.newValue;
    }
    if (event.key === 'last_sync_timestamp') {
      this.syncState.lastSyncTimestamp = event.newValue;
      this.notifySyncListeners();
    }
  }

  private handleOnline() {
    console.log('🌐 Back online - processing retry queue');
    this.processRetryQueue();
  }

  private handleOffline() {
    console.log('📴 Gone offline - requests will be queued');
  }

  private async processRetryQueue() {
    for (const [id, item] of this.retryQueue) {
      try {
        await item.request();
        this.retryQueue.delete(id);
      } catch (error) {
        if (item.retries < 3) {
          item.retries++;
        } else {
          this.retryQueue.delete(id);
          console.error(`Failed to process queued request after 3 retries:`, id);
        }
      }
    }
  }

  private notifySyncListeners() {
    this.syncListeners.forEach(listener => listener(this.syncState));
  }

  onSyncStateChange(listener: (state: SyncState) => void) {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  }

  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    // Always check localStorage as backup in case this.token wasn't set
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Ensure token is loaded from localStorage
    const token = this.getToken();
    const method = (options.method || 'GET').toUpperCase();
    const isGet = method === 'GET';
    
    // Check if this is a protected endpoint that requires authentication
    const isProtectedEndpoint = !endpoint.includes('/auth') && !endpoint.includes('/health') && !endpoint.includes('/diagnostics');
    
    // If it's a protected endpoint and we don't have a token, throw immediately
    if (isProtectedEndpoint && !token) {
      throw new Error('No token provided');
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    // Parse entity info from endpoint for caching
    const entityInfo = this.parseEndpoint(endpoint);

    // ─── Offline-first: if clearly offline, skip network for GETs ───
    if (!navigator.onLine && isGet) {
      const cached = await this.getCachedResponse<T>(endpoint, entityInfo);
      if (cached !== null) {
        console.log(`📦 Offline: serving cached data for ${endpoint}`);
        return cached;
      }
      // No cache — let SERVICE WORKER handle (it may have Cache API data)
      // Fall through to fetch which the SW will intercept
    }

    // ─── Offline: queue mutations immediately ───
    if (!navigator.onLine && !isGet) {
      return this.queueOfflineMutation<T>(endpoint, method, options, token, entityInfo);
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        
        // Handle token expiration
        if (response.status === 401 || response.status === 403) {
          const errorMsg = typeof errorData.error === 'string' ? errorData.error : '';
          if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
            this.setToken(null);
            window.dispatchEvent(new CustomEvent('auth:expired'));
          }
        }

        // Handle 503 from service worker (offline/queued)
        if (response.status === 503) {
          if (isGet) {
            const cached = await this.getCachedResponse<T>(endpoint, entityInfo);
            if (cached !== null) {
              console.log(`📦 SW 503: serving cached data for ${endpoint}`);
              return cached;
            }
          }
        }
        
        let errorMessage = `HTTP ${response.status}`;
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        }
        
        if (errorData.userRole) {
          errorMessage += ` (Your role: ${errorData.userRole})`;
        }
        if (errorData.debug) {
          console.error('API Error Debug:', errorData.debug);
        }
        
        throw new Error(errorMessage);
      }

      // Update sync timestamp for successful mutations
      if (!isGet) {
        this.updateSyncTimestamp();
      }

      const data = await response.json();

      // Cache successful GET responses in IndexedDB
      if (isGet && data) {
        this.cacheResponse(endpoint, entityInfo, data).catch(err =>
          console.warn('Cache write failed:', err)
        );
      }

      return data;
    } catch (error) {
      // Network error — try to serve from cache for GETs
      if (isGet) {
        const cached = await this.getCachedResponse<T>(endpoint, entityInfo);
        if (cached !== null) {
          console.log(`📦 Network error: serving cached data for ${endpoint}`);
          return cached;
        }
      }

      // Network error on mutation — queue for sync
      if (!isGet && error instanceof TypeError) {
        return this.queueOfflineMutation<T>(endpoint, method, options, token, entityInfo);
      }
      throw error;
    }
  }

  // Queue a mutation for offline sync and return optimistic data
  private async queueOfflineMutation<T>(
    endpoint: string,
    method: string,
    options: RequestInit,
    token: string | null,
    entityInfo: { entityType: string; entityId?: string | number; tableName?: string }
  ): Promise<T> {
    let bodyData: any;
    try {
      bodyData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch {
      bodyData = options.body;
    }

    try {
      await db.sync_queue.add({
        action: method === 'DELETE' ? 'delete' : method === 'PUT' || method === 'PATCH' ? 'update' : 'create',
        table: entityInfo.tableName || entityInfo.entityType,
        local_id: entityInfo.entityId ? (typeof entityInfo.entityId === 'string' ? parseInt(entityInfo.entityId, 10) || 0 : entityInfo.entityId) : 0,
        data: {
          url: `${this.baseURL}${endpoint}`,
          method,
          body: bodyData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          priority: 'normal',
        },
        created_at: new Date(),
        retries: 0,
      });
      console.log(`📥 Queued offline ${method} to ${endpoint}`);
    } catch (queueError) {
      console.error('Failed to queue request:', queueError);
    }
    this.syncState.pendingChanges++;
    this.notifySyncListeners();
    
    // Return optimistic data for mutations
    if (bodyData && typeof bodyData === 'object') {
      return { ...bodyData, _offline: true, _queued: true } as T;
    }
    // Return a minimal success indicator
    return { success: true, _offline: true, _queued: true } as T;
  }

  // Parse endpoint to extract entity type and ID
  private parseEndpoint(endpoint: string): { entityType: string; entityId?: string | number; tableName?: string } {
    // Remove query params and leading slash
    const path = endpoint.split('?')[0].replace(/^\//, '');
    const segments = path.split('/').filter(Boolean);
    
    // Try to match first segment to a known entity table
    const entityType = segments[0] || '';
    const tableName = ENDPOINT_TO_TABLE[entityType];
    const entityId = segments.length > 1 ? segments[1] : undefined;
    
    return { entityType, entityId, tableName };
  }

  // Tables managed by DataSyncService — cacheResponse must NOT clear() these
  // because DataSyncService does its own merge-and-put logic concurrently.
  // Doing clear() + bulkPut() here while sync is running causes IndexedDB corruption.
  private static readonly SYNC_MANAGED_TABLES = new Set([
    'patients', 'admissions', 'discharges', 'treatment_plans', 'prescriptions',
    'lab_investigations', 'surgery_bookings', 'ward_rounds', 'wound_care',
    'mdt_patient_teams', 'mdt_meetings', 'mdt_contact_logs',
    'blood_transfusions', 'burn_patients', 'diabetic_foot_assessments',
    'preoperative_assessments', 'dvt_assessments', 'pressure_sore_assessments',
    'nutritional_assessments', 'procedures', 'who_safety_checklists',
    'progress_notes', 'shopping_lists', 'call_duty_roster', 'clinic_duty_logs',
    'cbt_attempts', 'substance_use_assessments', 'detox_monitoring_records',
    'detox_follow_ups', 'substance_use_clinical_summaries',
  ]);

  // Cache API response in IndexedDB
  private async cacheResponse(endpoint: string, entityInfo: { entityType: string; entityId?: string | number; tableName?: string }, data: any): Promise<void> {
    try {
      // If we have a dedicated table, cache entities there
      // BUT skip destructive clear()+bulkPut() for tables managed by DataSyncService
      // — those tables are written to by the sync loop and clear() would corrupt mid-write
      if (entityInfo.tableName && !ApiClient.SYNC_MANAGED_TABLES.has(entityInfo.tableName)) {
        const table = (db as any)[entityInfo.tableName];
        if (table) {
          if (entityInfo.entityId) {
            // Single entity - put/update
            await table.put({ ...data, synced: true, updated_at: new Date() });
          } else if (Array.isArray(data)) {
            // Array response - replace all
            await table.clear();
            if (data.length > 0) {
              await table.bulkPut(data.map((item: any) => ({ ...item, synced: true, updated_at: new Date() })));
            }
          } else if (data && typeof data === 'object') {
            // Object with nested array (e.g. { patients: [...], total: N })
            const arrayKey = Object.keys(data).find(k => Array.isArray(data[k]));
            if (arrayKey && data[arrayKey].length > 0) {
              await table.clear();
              await table.bulkPut(data[arrayKey].map((item: any) => ({ ...item, synced: true, updated_at: new Date() })));
            }
          }
          // Don't return — also write to api_cache for full response structure
        }
      }

      // Always store in generic api_cache table (preserves full response including metadata)
      await db.api_cache.put({
        endpoint,
        data,
        updated_at: new Date(),
      });
    } catch (err) {
      // Silently fail - caching is best-effort
      console.warn('Cache write error:', err);
    }
  }

  // Retrieve cached response from IndexedDB
  private async getCachedResponse<T>(endpoint: string, entityInfo: { entityType: string; entityId?: string | number; tableName?: string }): Promise<T | null> {
    try {
      // Try dedicated entity table first
      if (entityInfo.tableName) {
        const table = (db as any)[entityInfo.tableName];
        if (table) {
          if (entityInfo.entityId) {
            const id = parseInt(entityInfo.entityId as string, 10);
            const item = await table.get(isNaN(id) ? entityInfo.entityId : id);
            if (item) return item as T;
          } else {
            const items = await table.toArray();
            if (items.length > 0) return items as T;
          }
        }
      }

      // Always check generic api_cache as fallback (covers endpoints not mapped to entity tables)
      const cached = await db.api_cache.get(endpoint);
      if (cached && cached.data) {
        // Check freshness — skip data older than 30 days
        if (cached.updated_at) {
          const age = Date.now() - new Date(cached.updated_at).getTime();
          if (age > 30 * 24 * 60 * 60 * 1000) {
            await db.api_cache.delete(endpoint);
            return null;
          }
        }
        return cached.data as T;
      }

      return null;
    } catch (err) {
      console.warn('Cache read error:', err);
      return null;
    }
  }

  // HTTP convenience methods
  async get<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  private updateSyncTimestamp() {
    const timestamp = new Date().toISOString();
    this.syncState.lastSyncTimestamp = timestamp;
    localStorage.setItem('last_sync_timestamp', timestamp);
    this.notifySyncListeners();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const data = await this.request('/auth', {
      method: 'POST',
      body: JSON.stringify({ username: email, password })
    });
    this.setToken(data.token);

    // Log login activity for training tracking (non-blocking)
    this.request('/activities?action=login', {
      method: 'POST',
      body: JSON.stringify({})
    }).catch(() => {});

    return data;
  }

  async register(userData: any) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async getCurrentUser() {
    return this.request('/auth/me');
  }

  async logout() {
    this.setToken(null);
  }

  // User management
  async getUsers() {
    const response = await this.request('/users');
    // Handle different possible response structures
    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.users)) {
      return response.users;
    }
    console.warn('Unexpected getUsers response structure:', response);
    return [];
  }

  async approveUser(userId: string, isApproved: boolean = true) {
    return this.request('/users/approve', {
      method: 'PATCH',
      body: JSON.stringify({ userId, is_approved: isApproved })
    });
  }

  // Create a new user with auto-generated credentials
  async createUser(userData: {
    fullName: string;
    email: string;
    role?: string;
  }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    return this.request('/users/update-status', {
      method: 'PATCH',
      body: JSON.stringify({ userId, is_active: isActive })
    });
  }

  async deleteUser(userId: string) {
    return this.request(`/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE'
    });
  }

  // Bulk import users with auto-generated credentials
  async bulkImportUsers(users: Array<{
    fullName: string;
    email: string;
    role?: string;
    department?: string;
  }>) {
    return this.request('/users/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ users })
    });
  }

  // Force password change (for first login after bulk import)
  async forcePasswordChange(userId: string, currentPassword: string, newPassword: string) {
    return this.request('/users/force-password-change', {
      method: 'PATCH',
      body: JSON.stringify({ userId, currentPassword, newPassword })
    });
  }

  // Change user password
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    return this.request('/users/change-password', {
      method: 'PATCH',
      body: JSON.stringify({ userId, currentPassword, newPassword })
    });
  }

  // Patient management
  async getPatients(since?: string) {
    try {
      const query = since ? `?since=${since}` : '';
      const data = await this.request(`/sync/patients${query}`);
      // Handle various response formats
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.patients)) {
        return data.patients;
      }
      console.warn('Unexpected patients response format:', data);
      return [];
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  }

  async getPatient(id: string) {
    try {
      // Use /sync/patients endpoint to match server routes
      const data = await this.request(`/sync/patients/${id}`);
      return data?.patient || data;
    } catch (error) {
      // 404 is expected for locally-cached patients not yet on server
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('404')) {
        console.warn(`Patient ${id} not found on server (may exist locally)`);
      } else {
        console.error('Error fetching patient:', error);
      }
      throw error;
    }
  }

  async createPatient(patientData: any) {
    const data = await this.request('/sync/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
    return data.patient;
  }

  async updatePatient(id: string, patientData: any) {
    const data = await this.request(`/sync/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patientData)
    });
    return data.patient;
  }

  async deletePatient(id: string) {
    return this.request(`/sync/patients/${id}`, {
      method: 'DELETE'
    });
  }

  // Admission management
  async createAdmission(admissionData: any) {
    // Send ALL fields to server using snake_case (server accepts both)
    const backendData = {
      patient_id: admissionData.patient_id,
      patient_name: admissionData.patient_name,
      hospital_number: admissionData.hospital_number,
      age: admissionData.age,
      gender: admissionData.gender,
      admission_date: admissionData.admission_date,
      admission_time: admissionData.admission_time,
      ward_location: admissionData.ward_location,
      bed_number: admissionData.bed_number,
      route_of_admission: admissionData.route_of_admission,
      referring_specialty: admissionData.referring_specialty,
      referring_doctor: admissionData.referring_doctor,
      reasons_for_admission: admissionData.reasons_for_admission,
      presenting_complaint: admissionData.presenting_complaint,
      provisional_diagnosis: admissionData.provisional_diagnosis || admissionData.reasons_for_admission,
      admitting_doctor: admissionData.admitting_doctor,
      admitting_consultant: admissionData.admitting_consultant,
      vital_signs: admissionData.vital_signs,
      allergies: admissionData.allergies,
      current_medications: admissionData.current_medications,
      past_medical_history: admissionData.past_medical_history,
      past_surgical_history: admissionData.past_surgical_history,
      social_history: admissionData.social_history,
      family_history: admissionData.family_history,
      comorbidities: admissionData.comorbidities,
      examination_findings: admissionData.examination_findings,
      initial_management_plan: admissionData.initial_management_plan,
      status: admissionData.status || 'active'
    };
    
    console.log('📤 Sending FULL admission to server:', Object.keys(backendData).length, 'fields');
    const data = await this.request('/admissions', {
      method: 'POST',
      body: JSON.stringify(backendData)
    });
    console.log('✅ Server created admission:', data.admission?.id);
    return data.admission;
  }

  async getAdmissions(since?: string, patientId?: string) {
    const params: string[] = [];
    if (since) params.push(`since=${since}`);
    if (patientId) params.push(`patientId=${patientId}`);
    const query = params.length > 0 ? `?${params.join('&')}` : '';
    const data = await this.request(`/admissions${query}`);
    return data.admissions || [];
  }

  async getAdmission(id: string) {
    const data = await this.request(`/admissions/${id}`);
    return data.admission;
  }

  async updateAdmission(id: string, admissionData: any) {
    const data = await this.request(`/admissions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(admissionData)
    });
    return data.admission;
  }

  // Discharge management
  async createDischarge(dischargeData: any) {
    const data = await this.request('/discharge-summaries', {
      method: 'POST',
      body: JSON.stringify(dischargeData)
    });
    return data.discharge;
  }

  async getDischarges(since?: string) {
    const query = since ? `?since=${since}` : '';
    const data = await this.request(`/discharge-summaries${query}`);
    return data.discharges || [];
  }

  // Treatment plans
  async getTreatmentPlans(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/treatment-plans${query}`);
    return data.treatmentPlans || data.plans || [];
  }

  async createTreatmentPlan(planData: any) {
    // Transform snake_case to camelCase for backend
    const transformedData = {
      patientId: planData.patient_id,
      diagnosis: planData.diagnosis,
      treatmentType: planData.treatment_type || 'comprehensive',
      description: planData.title || planData.description,
      objectives: planData.objectives || [],
      procedures: planData.planned_procedures || planData.procedures || [],
      medications: planData.planned_medications || planData.medications || [],
      investigations: planData.planned_investigations || planData.investigations || [],
      followUpSchedule: planData.planned_reviews || planData.reviews || [],
      medicalTeam: planData.medical_team || null,
      dischargePlan: planData.discharge_plan || null,
      notes: planData.notes || '',
      status: planData.status || 'active'
    };

    console.log('🔄 Sending treatment plan to API:', transformedData);
    
    const data = await this.request('/treatment-plans', {
      method: 'POST',
      body: JSON.stringify(transformedData)
    });
    return data.treatmentPlan;
  }

  async updateTreatmentPlan(id: string, planData: any) {
    const data = await this.request(`/treatment-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(planData)
    });
    return data.plan;
  }

  // Progress notes
  async createProgressNote(noteData: any) {
    const data = await this.request('/progress-notes', {
      method: 'POST',
      body: JSON.stringify(noteData)
    });
    return data.note;
  }

  async getProgressNotes(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/progress-notes${query}`);
    return data.notes || [];
  }

  // Prescriptions
  async createPrescription(prescriptionData: any) {
    const data = await this.request('/prescriptions', {
      method: 'POST',
      body: JSON.stringify(prescriptionData)
    });
    return data.prescription;
  }

  async getPrescriptions(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/prescriptions${query}`);
    return data.prescriptions || [];
  }

  // Lab investigations
  async createLabInvestigation(labData: any) {
    const data = await this.request('/lab-orders', {
      method: 'POST',
      body: JSON.stringify(labData)
    });
    return data.labOrder || data.investigation || data;
  }

  async getLabInvestigations(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/lab-orders${query}`);
    return data.labOrders || data.investigations || [];
  }

  async updateLabInvestigation(id: string, labData: any) {
    const data = await this.request(`/lab-orders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(labData)
    });
    return data.labOrder || data.investigation || data;
  }

  // Lab results - stored as part of lab orders (no standalone /lab-results endpoint)
  async createLabResult(resultData: any) {
    // Results are attached to their parent lab order via PUT /lab-orders/{id}
    const investigationId = resultData.investigation_id;
    if (!investigationId) {
      console.warn('createLabResult: no investigation_id, skipping server push');
      return resultData;
    }
    const data = await this.request(`/lab-orders/${investigationId}`, {
      method: 'PUT',
      body: JSON.stringify({
        results: resultData,
        status: 'completed',
        completedAt: new Date().toISOString()
      })
    });
    return data.labOrder || data;
  }

  async getLabResults(investigationId?: string, since?: string) {
    // Fetch completed lab orders and extract results
    let query = '?status=completed';
    if (investigationId) query = `?investigationId=${investigationId}`;
    if (since) query += `&since=${since}`;
    try {
      const data = await this.request(`/lab-orders${query}`);
      const orders = data.labOrders || data.investigations || [];
      // Extract results from completed orders that have them
      return orders
        .filter((o: any) => o.results)
        .map((o: any) => (typeof o.results === 'string' ? JSON.parse(o.results) : o.results));
    } catch {
      return [];
    }
  }

  // Blood Transfusions
  async createBloodTransfusion(data: any) {
    const res = await this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes: [{ entityType: 'blood_transfusions', entityId: data.id || `bt_${Date.now()}`, action: 'upsert', payload: data }] })
    });
    return res;
  }

  async getBloodTransfusions(patientId?: string) {
    const data = await this.request('/sync/blood-transfusions');
    const all = Array.isArray(data) ? data : [];
    return patientId ? all.filter((t: any) => String(t.patient_id) === String(patientId)) : all;
  }

  async updateBloodTransfusion(id: string, updates: any) {
    return this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes: [{ entityType: 'blood_transfusions', entityId: id, action: 'upsert', payload: { ...updates, id } }] })
    });
  }

  // Shopping Lists
  async createShoppingList(listData: any) {
    return this.request('/sync/push', {
      method: 'POST',
      body: JSON.stringify({ changes: [{ entityType: 'shopping_lists', entityId: listData.id || `sl_${Date.now()}`, action: 'upsert', payload: listData }] })
    });
  }

  async getShoppingLists(patientId?: string) {
    try {
      const data = await this.request('/sync/shopping-lists');
      const all = Array.isArray(data) ? data : [];
      return patientId ? all.filter((s: any) => String(s.patient_id) === String(patientId)) : all;
    } catch { return []; }
  }

  // Risk assessments
  async createRiskAssessment(assessmentData: any) {
    const data = await this.request('/risk-assessments', {
      method: 'POST',
      body: JSON.stringify(assessmentData)
    });
    return data.assessment;
  }

  async getRiskAssessments(patientId?: string, type?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (type) query += (query ? '&' : '?') + `type=${type}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/risk-assessments${query}`);
    return data.assessments || [];
  }

  // Preoperative assessments
  async createPreoperativeAssessment(assessmentData: any) {
    const data = await this.request('/preoperative-assessments', {
      method: 'POST',
      body: JSON.stringify(assessmentData)
    });
    return data.assessment;
  }

  async getPreoperativeAssessments(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/preoperative-assessments${query}`);
    return data.assessments || [];
  }

  // Surgeries
  async createSurgery(surgeryData: any) {
    const data = await this.request('/surgeries', {
      method: 'POST',
      body: JSON.stringify(surgeryData)
    });
    return data.surgery;
  }

  async getSurgeries(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/surgeries${query}`);
    return data.surgeries || [];
  }

  async updateSurgery(id: string, surgeryData: any) {
    const data = await this.request(`/surgeries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(surgeryData)
    });
    return data.surgery;
  }

  // Patient transfers
  async createPatientTransfer(transferData: any) {
    const data = await this.request('/patient-transfers', {
      method: 'POST',
      body: JSON.stringify(transferData)
    });
    return data.transfer;
  }

  async getPatientTransfers(patientId?: string, since?: string) {
    let query = '';
    if (patientId) query += `?patientId=${patientId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/patient-transfers${query}`);
    return data.transfers || [];
  }

  // Ward Rounds
  async getWardRounds(startDate?: string, endDate?: string) {
    let query = '';
    if (startDate) query += `?startDate=${startDate}`;
    if (endDate) query += (query ? '&' : '?') + `endDate=${endDate}`;
    const data = await this.request(`/ward-rounds${query}`);
    return data.wardRounds || [];
  }

  async getWardRoundsByPatient(patientId: string) {
    const data = await this.request(`/ward-rounds?action=by-patient&patientId=${patientId}`);
    return data.wardRounds || [];
  }

  async getWardRound(roundId: string) {
    const data = await this.request(`/ward-rounds?action=detail&roundId=${roundId}`);
    return data.wardRound;
  }

  async createWardRound(roundData: any) {
    const data = await this.request('/ward-rounds?action=create', {
      method: 'POST',
      body: JSON.stringify(roundData)
    });
    return data.wardRound;
  }

  async updateWardRound(roundId: string, updateData: any) {
    const data = await this.request('/ward-rounds?action=update', {
      method: 'PUT',
      body: JSON.stringify({ roundId, ...updateData })
    });
    return data.wardRound;
  }

  async deleteWardRound(roundId: string) {
    return this.request(`/ward-rounds?roundId=${roundId}`, {
      method: 'DELETE'
    });
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
