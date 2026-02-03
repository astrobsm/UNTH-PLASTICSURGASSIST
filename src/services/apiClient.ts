// API Base URL - handles all environments
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL 
  || (import.meta.env.PROD 
    ? '/api'  // Production fallback: use relative path (proxied by Nginx)
    : 'http://localhost:3001/api');  // Development: direct to backend

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
      credentials: 'include' as RequestCredentials, // Important for CORS with cookies
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
      // Use /patients endpoint for individual patient, not /sync/patients
      const data = await this.request(`/patients/${id}`);
      return data?.patient || data;
    } catch (error) {
      console.error('Error fetching patient:', error);
      throw error;
    }
  }

  async createPatient(patientData: any) {
    const data = await this.request('/patients', {
      method: 'POST',
      body: JSON.stringify(patientData)
    });
    return data.patient;
  }

  async updatePatient(id: string, patientData: any) {
    const data = await this.request(`/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patientData)
    });
    return data.patient;
  }

  async deletePatient(id: string) {
    return this.request(`/patients/${id}`, {
      method: 'DELETE'
    });
  }

  // Admission management
  async createAdmission(admissionData: any) {
    // Transform frontend format to backend format
    const backendData = {
      patientId: admissionData.patient_id,
      admissionDate: admissionData.admission_date,
      ward: admissionData.ward_location,
      bedNumber: admissionData.bed_number,
      admittingDiagnosis: admissionData.provisional_diagnosis || admissionData.reasons_for_admission,
      notes: admissionData.presenting_complaint || '',
      status: 'active' // Always use 'active' for new admissions
    };
    
    console.log('📤 Sending admission to server:', backendData);
    const data = await this.request('/admissions', {
      method: 'POST',
      body: JSON.stringify(backendData)
    });
    console.log('✅ Server created admission:', data.admission);
    return data.admission;
  }

  async getAdmissions(since?: string) {
    const query = since ? `?since=${since}` : '';
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
    return data.plans || [];
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
      followUpSchedule: planData.planned_reviews || planData.reviews || [],
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

  // Lab results
  async createLabResult(resultData: any) {
    const data = await this.request('/lab-results', {
      method: 'POST',
      body: JSON.stringify(resultData)
    });
    return data.result;
  }

  async getLabResults(investigationId?: string, since?: string) {
    let query = '';
    if (investigationId) query += `?investigationId=${investigationId}`;
    if (since) query += (query ? '&' : '?') + `since=${since}`;
    const data = await this.request(`/lab-results${query}`);
    return data.results || [];
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

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
