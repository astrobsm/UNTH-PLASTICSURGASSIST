/**
 * House Officer Tracking Service
 * Aggregates HO documentation logs, CME/CBT scores, patient care metrics,
 * and sign-out eligibility from local IndexedDB + server API.
 */
import { db } from '../db/database';
import { apiClient } from './apiClient';

export interface HOMetrics {
  cbtTestsCompleted: number;
  cbtAvgScore: number;
  cbtBestScore: number;
  cbtWorstScore: number;
  cmeTopicsCompleted: number;
  wardRoundsDocumented: number;
  prescriptionsWritten: number;
  labOrdersPlaced: number;
  patientEntries: number;
  dutiesTotal: number;
  dutiesCompleted: number;
  loginDays: number;
  assignedPatients: number;
  overallScore: number;
}

export interface HOEligibility {
  eligible: boolean;
  met: string[];
  notMet: string[];
}

export interface HORequirements {
  cbtTests: number;
  patientEntries: number;
  duties: number;
  loginDays: number;
  overallScore: number;
}

export interface HOProfile {
  id: number;
  full_name: string;
  username?: string;
  email: string;
  role: string;
  is_active: boolean;
  registered_at: string;
  metrics: HOMetrics;
  eligibility: HOEligibility;
  requirements: HORequirements;
}

export interface DocumentationLog {
  id: number | string;
  type: 'ward_round' | 'prescription' | 'lab_order' | 'progress_note' | 'other';
  patient_name?: string;
  hospital_number?: string;
  description: string;
  date: string;
  details?: any;
}

export interface HODetail {
  houseOfficer: HOProfile;
  wardRounds: any[];
  prescriptions: any[];
  labOrders: any[];
  activityLogs: any[];
  cbtAttempts: any[];
  cmeProgress: any[];
  assignedPatients: any[];
  rotation: any | null;
}

class HOTrackingService {
  /**
   * Fetch all house officers with metrics (admin view)
   */
  async getAllHouseOfficers(): Promise<HOProfile[]> {
    try {
      const data = await apiClient.get('/ho-tracking?action=all-house-officers');
      return data.houseOfficers || [];
    } catch {
      // Fallback: load from local DB
      return this.getLocalHouseOfficers();
    }
  }

  /**
   * Fetch detailed HO profile with all documentation
   */
  async getHODetail(userId: number | string): Promise<HODetail | null> {
    try {
      const data = await apiClient.get(`/ho-tracking?action=ho-detail&userId=${userId}`);
      return data as HODetail;
    } catch {
      return this.getLocalHODetail(Number(userId));
    }
  }

  /**
   * Fetch documentation summary for all HOs in a date range
   */
  async getDocumentationSummary(from?: string, to?: string): Promise<any[]> {
    try {
      let url = '/ho-tracking?action=documentation-summary';
      if (from) url += `&from=${from}`;
      if (to) url += `&to=${to}`;
      const data = await apiClient.get(url);
      return data.summary || [];
    } catch {
      return [];
    }
  }

  /**
   * HO requests sign-out
   */
  async requestSignOut(): Promise<{ message: string; rotationId?: number }> {
    const data = await apiClient.post('/ho-tracking?action=request-signout', {});
    return data;
  }

  /**
   * Admin approves/rejects sign-out
   */
  async approveSignOut(rotationId: number, approved: boolean, comments: string, finalScore?: number): Promise<any> {
    return apiClient.post('/ho-tracking?action=approve-signout', {
      rotationId, approved, comments, finalScore,
    });
  }

  /**
   * Log HO documentation activity
   */
  async logDocumentation(type: string, description: string, patientId?: number, metadata?: any): Promise<void> {
    try {
      await apiClient.post('/ho-tracking?action=log-documentation', {
        documentationType: type, description, patientId, metadata,
      });
    } catch {
      // Store locally for later sync
      try {
        await db.activity_logs.add({
          user_id: '', // will be filled by sync
          type,
          description,
          points: 0,
          timestamp: new Date(),
          created_at: new Date(),
        } as any);
      } catch { /* best effort */ }
    }
  }

  // ── Local Fallbacks ──

  private async getLocalHouseOfficers(): Promise<HOProfile[]> {
    try {
      const users = await db.users.toArray();
      const hos = users.filter(u => (u.role === 'house_officer' || u.role === 'intern') && u.is_active !== false);
      const assignments = await db.patient_assignments.toArray();
      const activeAssignments = assignments.filter(a => a.is_active);

      return hos.map(ho => {
        const assignedCount = activeAssignments.filter(a => a.house_officer_id === ho.id).length;
        return {
          id: ho.id,
          full_name: ho.full_name || ho.name || 'Unknown',
          username: ho.username,
          email: ho.email || '',
          role: ho.role,
          is_active: ho.is_active !== false,
          registered_at: '',
          metrics: {
            cbtTestsCompleted: 0,
            cbtAvgScore: 0,
            cbtBestScore: 0,
            cbtWorstScore: 0,
            cmeTopicsCompleted: 0,
            wardRoundsDocumented: 0,
            prescriptionsWritten: 0,
            labOrdersPlaced: 0,
            patientEntries: 0,
            dutiesTotal: 0,
            dutiesCompleted: 0,
            loginDays: 0,
            assignedPatients: assignedCount,
            overallScore: 0,
          },
          eligibility: { eligible: false, met: [], notMet: ['Offline — data unavailable'] },
          requirements: { cbtTests: 4, patientEntries: 30, duties: 20, loginDays: 25, overallScore: 70 },
        };
      });
    } catch {
      return [];
    }
  }

  private async getLocalHODetail(userId: number): Promise<HODetail | null> {
    try {
      const users = await db.users.toArray();
      const ho = users.find(u => u.id === userId);
      if (!ho) return null;

      const assignments = await db.patient_assignments.toArray();
      const hoAssignments = assignments.filter(a => a.house_officer_id === userId && a.is_active);
      const patients = await db.patients.toArray();
      const patientMap = new Map(patients.map(p => [p.id, p]));

      const assignedPatients = hoAssignments.map(a => {
        const p = patientMap.get(a.patient_id);
        return {
          ...a,
          first_name: p?.first_name || '',
          last_name: p?.last_name || '',
          hospital_number: p?.hospital_number || a.hospital_number || '',
        };
      });

      // Ward rounds
      let wardRounds: any[] = [];
      try {
        const allRounds = await db.ward_rounds_clinical.toArray();
        wardRounds = allRounds.filter(wr =>
          String(wr.created_by) === String(userId) ||
          (wr.reviewing_doctor || '').toLowerCase().includes((ho.full_name || '').toLowerCase())
        ).slice(0, 50);
      } catch { /* */ }

      return {
        houseOfficer: {
          id: ho.id,
          full_name: ho.full_name || ho.name || '',
          email: ho.email || '',
          role: ho.role,
          is_active: ho.is_active !== false,
          registered_at: '',
          metrics: {
            cbtTestsCompleted: 0, cbtAvgScore: 0, cbtBestScore: 0, cbtWorstScore: 0,
            cmeTopicsCompleted: 0, wardRoundsDocumented: wardRounds.length,
            prescriptionsWritten: 0, labOrdersPlaced: 0, patientEntries: 0,
            dutiesTotal: 0, dutiesCompleted: 0, loginDays: 0,
            assignedPatients: assignedPatients.length, overallScore: 0,
          },
          eligibility: { eligible: false, met: [], notMet: ['Offline — limited data'] },
          requirements: { cbtTests: 4, patientEntries: 30, duties: 20, loginDays: 25, overallScore: 70 },
        },
        wardRounds,
        prescriptions: [],
        labOrders: [],
        activityLogs: [],
        cbtAttempts: [],
        cmeProgress: [],
        assignedPatients,
        rotation: null,
      };
    } catch {
      return null;
    }
  }
}

export const hoTrackingService = new HOTrackingService();
