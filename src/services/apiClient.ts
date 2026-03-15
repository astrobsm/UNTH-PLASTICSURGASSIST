// API Base URL - handles all environments
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || (import.meta.env.PROD 
    ? '/api'  // Production fallback: use relative path (proxied by Nginx)
    : 'http://localhost:3005/api');  // Development: direct to backend

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
      // Using Bearer token auth - no need for credentials:include
      // credentials: 'include' would conflict with Access-Control-Allow-Origin: *
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, fetchOptions);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
        
        // Handle token expiration
        if (response.status === 401 || response.status === 403) {
          // Token might be expired, clear it
          const errorMsg = typeof errorData.error === 'string' ? errorData.error : '';
          if (errorMsg.includes('expired') || errorMsg.includes('invalid')) {
            this.setToken(null);
            window.dispatchEvent(new CustomEvent('auth:expired'));
          }
        }
        
        // Create a proper error message with all available info
        let errorMessage = `HTTP ${response.status}`;
        if (typeof errorData.error === 'string') {
          errorMessage = errorData.error;
        } else if (typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        }
        
        // Include debug info if available
        if (errorData.userRole) {
          errorMessage += ` (Your role: ${errorData.userRole})`;
        }
        if (errorData.debug) {
          console.error('API Error Debug:', errorData.debug);
        }
        
        throw new Error(errorMessage);
      }

      // Update sync timestamp for successful requests
      if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
        this.updateSyncTimestamp();
      }

      return response.json();
    } catch (error) {
      // If offline, queue the request for retry
      if (!navigator.onLine && options.method && options.method !== 'GET') {
        const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.retryQueue.set(requestId, {
          request: () => this.request(endpoint, options),
          retries: 0
        });
        this.syncState.pendingChanges++;
        this.notifySyncListeners();
        throw new Error('Request queued for retry when online');
      }
      throw error;
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
      console.error('Error fetching patient:', error);
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
