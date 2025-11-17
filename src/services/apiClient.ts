// API Base URL
const API_BASE_URL = import.meta.env.PROD 
  ? '/api'  // Production: use relative path (proxied by Nginx)
  : 'http://localhost:3001/api';  // Development: direct to backend

// API Client
class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
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
    return this.request(`/sync/patients/${id}`);
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

  // Health check
  async healthCheck() {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient();
export default apiClient;
