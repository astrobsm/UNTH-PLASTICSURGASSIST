// API Base URL - handles all environments
const API_BASE_URL = import.meta.env.PROD 
  ? '/api'  // Production: use relative path (proxied by Nginx)
  : 'http://localhost:3001/api';  // Development: direct to backend

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
    return this.token;
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
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
        
        // Create a proper error message
        const errorMessage = typeof errorData.error === 'string' 
          ? errorData.error 
          : typeof errorData.message === 'string'
            ? errorData.message
            : `HTTP ${response.status}: ${response.statusText}`;
        
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
    return this.request('/users');
  }

  async approveUser(userId: string, isApproved: boolean = true) {
    return this.request(`/users/${userId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ is_approved: isApproved })
    });
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    return this.request(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive })
    });
  }

  // Patient management
  async getPatients(since?: string) {
    const query = since ? `?since=${since}` : '';
    const data = await this.request(`/sync/patients${query}`);
    return data.patients || [];
  }

  async getPatient(id: string) {
    // Use /patients endpoint for individual patient, not /sync/patients
    const data = await this.request(`/patients/${id}`);
    return data.patient;
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

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
