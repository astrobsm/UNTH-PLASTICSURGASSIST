/**
 * Rotation Configuration Service
 * 
 * Admin-managed rotation settings including:
 * - Global rotation commencement and end dates
 * - Per-user rotation assignments
 * - Activity/responsibility logging
 * - Comprehensive analytics for sign-out decisions
 */

import { TrainingLevel } from './medicalTrainingService';

// ============== TYPES ==============

export interface RotationConfig {
  id?: string;
  level: TrainingLevel;
  commencement_date: string; // ISO date
  end_date: string; // ISO date
  department: string;
  is_active: boolean;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  notes?: string;
}

export interface AssignedResponsibility {
  id?: string;
  user_id: string;
  user_name?: string;
  title: string;
  description: string;
  assigned_by: string;
  assigned_by_name?: string;
  assigned_at: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completion_notes?: string;
  completed_at?: string;
  score?: number; // 0-100
}

export interface TraineeAnalytics {
  userId: string;
  userName: string;
  level: TrainingLevel;
  role: string;
  rotationStatus: string;
  rotationStart: string | null;
  rotationEnd: string | null;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  progressPercent: number;
  // Performance metrics
  cbtScore: number;
  cbtTestsCompleted: number;
  cbtTestsRequired: number;
  patientCareScore: number;
  patientEntries: number;
  patientEntriesRequired: number;
  dutyPromptnessScore: number;
  dutiesCompleted: number;
  dutiesRequired: number;
  attendanceScore: number;
  loginDays: number;
  loginDaysRequired: number;
  overallScore: number;
  // Responsibilities
  assignedResponsibilities: number;
  completedResponsibilities: number;
  pendingResponsibilities: number;
  // CME
  topicsCompleted: number;
  totalTopics: number;
  cmeProgress: number;
  // Sign-out
  signOutEligible: boolean;
  requirementsMet: string[];
  requirementsNotMet: string[];
}

// ============== API HELPERS ==============

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// ============== LOCAL STORAGE KEYS ==============

const STORAGE_KEYS = {
  ROTATION_CONFIGS: 'rotation_configs',
  RESPONSIBILITIES: 'assigned_responsibilities',
};

// ============== ROTATION CONFIG MANAGEMENT ==============

const getRotationConfigs = (): RotationConfig[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.ROTATION_CONFIGS);
  return stored ? JSON.parse(stored) : [];
};

const saveRotationConfig = async (config: RotationConfig): Promise<RotationConfig> => {
  const configs = getRotationConfigs();
  
  if (config.id) {
    // Update existing
    const index = configs.findIndex(c => c.id === config.id);
    if (index >= 0) {
      configs[index] = { ...config, updated_at: new Date().toISOString() };
    }
  } else {
    // Create new
    config.id = `rc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    config.created_at = new Date().toISOString();
    config.updated_at = new Date().toISOString();
    configs.push(config);
  }
  
  localStorage.setItem(STORAGE_KEYS.ROTATION_CONFIGS, JSON.stringify(configs));
  
  // Sync to server
  try {
    const response = await fetch('/api/rotation-config', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'save', config })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.config?.id) {
        config.id = data.config.id;
      }
      console.log('✅ Rotation config synced to server');
    }
  } catch (error) {
    console.warn('⚠️ Failed to sync rotation config:', error);
  }
  
  return config;
};

const getActiveRotationConfig = (level?: TrainingLevel): RotationConfig | null => {
  const configs = getRotationConfigs();
  const active = configs.filter(c => c.is_active);
  if (level) {
    return active.find(c => c.level === level) || null;
  }
  return active[0] || null;
};

const getAllActiveRotationConfigs = (): RotationConfig[] => {
  return getRotationConfigs().filter(c => c.is_active);
};

const deactivateRotationConfig = async (configId: string): Promise<void> => {
  const configs = getRotationConfigs();
  const config = configs.find(c => c.id === configId);
  if (config) {
    config.is_active = false;
    config.updated_at = new Date().toISOString();
    localStorage.setItem(STORAGE_KEYS.ROTATION_CONFIGS, JSON.stringify(configs));
    
    try {
      await fetch('/api/rotation-config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: 'deactivate', configId })
      });
    } catch (error) {
      console.warn('⚠️ Failed to sync deactivation:', error);
    }
  }
};

// ============== RESPONSIBILITY MANAGEMENT ==============

const getResponsibilities = (userId?: string): AssignedResponsibility[] => {
  const stored = localStorage.getItem(STORAGE_KEYS.RESPONSIBILITIES);
  const responsibilities: AssignedResponsibility[] = stored ? JSON.parse(stored) : [];
  if (userId) {
    return responsibilities.filter(r => r.user_id === userId);
  }
  return responsibilities;
};

const assignResponsibility = async (responsibility: Omit<AssignedResponsibility, 'id' | 'assigned_at' | 'status'>): Promise<AssignedResponsibility> => {
  const newResp: AssignedResponsibility = {
    ...responsibility,
    id: `resp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    assigned_at: new Date().toISOString(),
    status: 'pending',
  };
  
  const responsibilities = getResponsibilities();
  responsibilities.push(newResp);
  localStorage.setItem(STORAGE_KEYS.RESPONSIBILITIES, JSON.stringify(responsibilities));
  
  // Sync to server
  try {
    const response = await fetch('/api/rotation-config', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'assign-responsibility', responsibility: newResp })
    });
    if (response.ok) {
      const data = await response.json();
      if (data.responsibility?.id) {
        newResp.id = data.responsibility.id;
      }
      console.log('✅ Responsibility assignment synced');
    }
  } catch (error) {
    console.warn('⚠️ Failed to sync responsibility:', error);
  }
  
  return newResp;
};

const updateResponsibilityStatus = async (
  respId: string, 
  status: AssignedResponsibility['status'],
  notes?: string
): Promise<AssignedResponsibility | null> => {
  const responsibilities = getResponsibilities();
  const resp = responsibilities.find(r => r.id === respId);
  if (!resp) return null;
  
  resp.status = status;
  if (status === 'completed') {
    resp.completed_at = new Date().toISOString();
    resp.completion_notes = notes;
  }
  
  localStorage.setItem(STORAGE_KEYS.RESPONSIBILITIES, JSON.stringify(responsibilities));
  
  try {
    await fetch('/api/rotation-config', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'update-responsibility', respId, status, notes })
    });
  } catch (error) {
    console.warn('⚠️ Failed to sync responsibility update:', error);
  }
  
  return resp;
};

// ============== ANALYTICS ==============

const getAllTraineeAnalytics = async (): Promise<TraineeAnalytics[]> => {
  try {
    const response = await fetch('/api/rotation-config?action=all-analytics', {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      return data.analytics || [];
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch analytics from server:', error);
  }
  
  // Fallback to local computation
  return computeLocalAnalytics();
};

const getTraineeAnalytics = async (userId: string): Promise<TraineeAnalytics | null> => {
  try {
    const response = await fetch(`/api/rotation-config?action=trainee-analytics&userId=${userId}`, {
      headers: getAuthHeaders()
    });
    if (response.ok) {
      const data = await response.json();
      return data.analytics || null;
    }
  } catch (error) {
    console.warn('⚠️ Failed to fetch trainee analytics:', error);
  }
  return null;
};

const computeLocalAnalytics = (): TraineeAnalytics[] => {
  // Return empty for now - server provides real data
  return [];
};

// ============== ROTATION DATE HELPERS ==============

const getRotationDaysInfo = (level: TrainingLevel): {
  commencementDate: string | null;
  endDate: string | null;
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  progressPercent: number;
} => {
  const config = getActiveRotationConfig(level);
  
  if (!config) {
    return {
      commencementDate: null,
      endDate: null,
      daysRemaining: 0,
      daysElapsed: 0,
      totalDays: 0,
      progressPercent: 0
    };
  }
  
  const now = new Date();
  const start = new Date(config.commencement_date);
  const end = new Date(config.end_date);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const daysElapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
  const progressPercent = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;
  
  return {
    commencementDate: config.commencement_date,
    endDate: config.end_date,
    daysRemaining,
    daysElapsed,
    totalDays,
    progressPercent
  };
};

// ============== EXPORT ==============

class RotationConfigService {
  // Rotation Configs
  getRotationConfigs = getRotationConfigs;
  saveRotationConfig = saveRotationConfig;
  getActiveRotationConfig = getActiveRotationConfig;
  getAllActiveRotationConfigs = getAllActiveRotationConfigs;
  deactivateRotationConfig = deactivateRotationConfig;
  
  // Responsibilities
  getResponsibilities = getResponsibilities;
  assignResponsibility = assignResponsibility;
  updateResponsibilityStatus = updateResponsibilityStatus;
  
  // Analytics
  getAllTraineeAnalytics = getAllTraineeAnalytics;
  getTraineeAnalytics = getTraineeAnalytics;
  
  // Helpers
  getRotationDaysInfo = getRotationDaysInfo;
}

export const rotationConfigService = new RotationConfigService();
