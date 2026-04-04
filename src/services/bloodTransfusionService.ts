import { db } from '../db/database';
import { apiClient } from './apiClient';

// Helper to sync blood transfusion to server via sync/push
async function pushTransfusionToServer(transfusion: any): Promise<void> {
  try {
    await apiClient.post('/sync/push', {
      changes: [{
        entityType: 'blood_transfusions',
        entityId: transfusion.id || `bt_${Date.now()}`,
        action: 'upsert',
        payload: transfusion
      }]
    });
  } catch (e) {
    console.warn('Failed to push blood transfusion to server:', e);
  }
}

// Helper to pull blood transfusions from server
async function pullTransfusionsFromServer(): Promise<any[]> {
  try {
    const data = await apiClient.get('/sync/blood-transfusions');
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Failed to pull blood transfusions from server:', e);
  }
  return [];
}

export interface BloodBagDetails {
  bag_number: string;
  blood_group: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  component_type: 'whole_blood' | 'packed_rbc' | 'platelets' | 'ffp' | 'cryoprecipitate';
  volume_ml: number;
  donation_date: Date;
  expiry_date: Date;
  source: 'blood_bank' | 'nbtc' | 'donor_directed' | 'other';
  source_details?: string;
  screening_done: boolean;
  crossmatch_compatible: boolean;
  transfused?: boolean;
}

export interface TransfusionVitals {
  id?: string;
  type?: string;
  transfusion_id: string;
  patient_id: string;
  measurement_type: 'pre' | 'during' | 'post';
  temperature: number; // Celsius
  pulse: number; // bpm
  bp_systolic: number;
  bp_diastolic: number;
  respiratory_rate: number;
  spo2: number; // %
  recorded_at: Date;
  recorded_by: string;
}

export interface TransfusionComplication {
  id?: string;
  transfusion_id: string;
  patient_id: string;
  complication_type: 
    | 'febrile_reaction'
    | 'allergic_reaction'
    | 'hemolytic_reaction'
    | 'transfusion_overload'
    | 'anaphylaxis'
    | 'septic_reaction'
    | 'other';
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
  symptoms: string[];
  management: string;
  detected_at: Date;
  resolved: boolean;
  resolved_at?: Date;
  notes?: string;
}

export interface PreviousTransfusion {
  date: Date;
  indication: string;
  blood_group: string;
  component: string;
  units: number;
  complications?: string;
}

export interface BloodTransfusion {
  id?: string;
  patient_id: string;
  patient_name?: string;
  hospital_number: string;
  
  // Indication and Clinical Details
  indication: string;
  baseline_hb: number; // g/dL
  target_hb?: number;
  clinical_status: string;
  urgent: boolean;
  
  // Blood Bag Details
  blood_bags: BloodBagDetails[];
  total_units: number;
  
  // Previous Transfusion History
  previous_transfusions: PreviousTransfusion[];
  history_of_reactions: boolean;
  reaction_details?: string;
  
  // Transfusion Details
  transfusion_date: Date;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  rate_ml_per_hour?: number;
  
  // Pre-transfusion Checks
  consent_obtained: boolean;
  patient_identification_verified: boolean;
  blood_group_verified: boolean;
  crossmatch_checked: boolean;
  
  // Vitals
  pre_transfusion_vitals?: TransfusionVitals;
  during_transfusion_vitals?: TransfusionVitals[];
  post_transfusion_vitals?: TransfusionVitals;
  
  // Post-transfusion
  post_transfusion_hb?: number;
  hb_increment?: number;
  
  // Complications
  complications?: TransfusionComplication[];
  adverse_events: boolean;
  
  // Status and Administration
  status: 'planned' | 'in-progress' | 'completed' | 'stopped' | 'cancelled';
  stop_reason?: string;
  administered_by: string;
  supervised_by?: string;
  
  // Metadata
  created_at: Date;
  updated_at: Date;
  notes?: string;
  vitals_monitoring?: TransfusionVitals[];
  post_hb?: number;
}

class BloodTransfusionService {
  /**
   * Create a new blood transfusion record
   */
  async createTransfusion(transfusion: BloodTransfusion): Promise<string> {
    try {
      transfusion.created_at = new Date();
      transfusion.updated_at = new Date();
      const id = await db.blood_transfusions.add(transfusion as any);
      // Push to server in background
      if (navigator.onLine) {
        pushTransfusionToServer({ ...transfusion, id: String(id) }).catch(() => {});
      }
      return String(id);
    } catch (error) {
      console.error('Error creating transfusion:', error);
      throw new Error('Failed to create transfusion record');
    }
  }

  /**
   * Update existing transfusion record
   */
  async updateTransfusion(id: string, updates: Partial<BloodTransfusion>): Promise<void> {
    try {
      updates.updated_at = new Date();
      await db.blood_transfusions.update(parseInt(id), updates as any);
      // Push update to server
      if (navigator.onLine) {
        const full = await db.blood_transfusions.get(parseInt(id));
        if (full) pushTransfusionToServer({ ...full, id: String(id) }).catch(() => {});
      }
    } catch (error) {
      console.error('Error updating transfusion:', error);
      throw new Error('Failed to update transfusion record');
    }
  }

  /**
   * Get transfusion by ID
   */
  async getTransfusion(id: string): Promise<BloodTransfusion | null> {
    try {
      const transfusion = await db.blood_transfusions.get(parseInt(id));
      return transfusion || null;
    } catch (error) {
      console.error('Error getting transfusion:', error);
      return null;
    }
  }

  /**
   * Get all transfusions for a patient
   */
  async getPatientTransfusions(patientId: string): Promise<BloodTransfusion[]> {
    try {
      // Try server first
      if (navigator.onLine) {
        try {
          const serverData = await pullTransfusionsFromServer();
          if (serverData.length > 0) {
            for (const t of serverData) {
              try { await db.blood_transfusions.put({ ...t, synced: true }); } catch { /* ignore */ }
            }
            return serverData
              .filter((t: any) => String(t.patient_id) === String(patientId))
              .sort((a: any, b: any) => new Date(b.transfusion_date).getTime() - new Date(a.transfusion_date).getTime());
          }
        } catch { /* fallback to local */ }
      }
      return await db.blood_transfusions
        .where('patient_id')
        .equals(patientId)
        .reverse()
        .sortBy('transfusion_date');
    } catch (error) {
      console.error('Error getting patient transfusions:', error);
      return [];
    }
  }

  /**
   * Get all transfusions
   */
  async getAllTransfusions(): Promise<BloodTransfusion[]> {
    try {
      // Try server first
      if (navigator.onLine) {
        try {
          const serverData = await pullTransfusionsFromServer();
          if (serverData.length > 0) {
            for (const t of serverData) {
              try { await db.blood_transfusions.put({ ...t, synced: true }); } catch { /* ignore */ }
            }
            return serverData.sort((a: any, b: any) => 
              new Date(b.transfusion_date).getTime() - new Date(a.transfusion_date).getTime());
          }
        } catch { /* fallback to local */ }
      }
      return await db.blood_transfusions
        .orderBy('transfusion_date')
        .reverse()
        .toArray();
    } catch (error) {
      console.error('Error getting all transfusions:', error);
      return [];
    }
  }

  /**
   * Record vitals during transfusion
   */
  async recordVitals(vitals: TransfusionVitals): Promise<string> {
    try {
      vitals.recorded_at = new Date();
      const id = await db.transfusion_vitals.add(vitals as any);
      
      // Update the transfusion record with vitals
      const transfusion = await this.getTransfusion(vitals.transfusion_id);
      if (transfusion) {
        const updates: Partial<BloodTransfusion> = {};
        
        if (vitals.measurement_type === 'pre') {
          updates.pre_transfusion_vitals = vitals;
        } else if (vitals.measurement_type === 'post') {
          updates.post_transfusion_vitals = vitals;
        } else if (vitals.measurement_type === 'during') {
          const duringVitals = transfusion.during_transfusion_vitals || [];
          duringVitals.push(vitals);
          updates.during_transfusion_vitals = duringVitals;
        }
        
        await this.updateTransfusion(vitals.transfusion_id, updates);
      }
      
      return String(id);
    } catch (error) {
      console.error('Error recording vitals:', error);
      throw new Error('Failed to record vitals');
    }
  }

  /**
   * Get vitals for a transfusion
   */
  async getTransfusionVitals(transfusionId: string): Promise<TransfusionVitals[]> {
    try {
      return await db.transfusion_vitals
        .where('transfusion_id')
        .equals(transfusionId)
        .sortBy('recorded_at');
    } catch (error) {
      console.error('Error getting transfusion vitals:', error);
      return [];
    }
  }

  /**
   * Record a transfusion complication
   */
  async recordComplication(complication: TransfusionComplication): Promise<string> {
    try {
      complication.detected_at = new Date();
      const id = await db.transfusion_complications.add(complication as any);
      
      // Update transfusion record
      const transfusion = await this.getTransfusion(complication.transfusion_id);
      if (transfusion) {
        const complications = transfusion.complications || [];
        complications.push(complication);
        await this.updateTransfusion(complication.transfusion_id, {
          complications,
          adverse_events: true
        });
      }
      
      return String(id);
    } catch (error) {
      console.error('Error recording complication:', error);
      throw new Error('Failed to record complication');
    }
  }

  /**
   * Resolve a complication
   */
  async resolveComplication(complicationId: string, notes?: string): Promise<void> {
    try {
      await db.transfusion_complications.update(parseInt(complicationId), {
        resolved: true,
        resolved_at: new Date(),
        notes
      } as any);
    } catch (error) {
      console.error('Error resolving complication:', error);
      throw new Error('Failed to resolve complication');
    }
  }

  /**
   * Get complications for a transfusion
   */
  async getTransfusionComplications(transfusionId: string): Promise<TransfusionComplication[]> {
    try {
      return await db.transfusion_complications
        .where('transfusion_id')
        .equals(transfusionId)
        .toArray();
    } catch (error) {
      console.error('Error getting complications:', error);
      return [];
    }
  }

  /**
   * Start transfusion (change status to in-progress)
   */
  async startTransfusion(transfusionId: string, startTime: string): Promise<void> {
    try {
      await this.updateTransfusion(transfusionId, {
        status: 'in-progress',
        start_time: startTime
      });
    } catch (error) {
      console.error('Error starting transfusion:', error);
      throw new Error('Failed to start transfusion');
    }
  }

  /**
   * Complete transfusion
   */
  async completeTransfusion(
    transfusionId: string, 
    endTime: string,
    postTransfusionHb?: number
  ): Promise<void> {
    try {
      const transfusion = await this.getTransfusion(transfusionId);
      if (!transfusion) throw new Error('Transfusion not found');

      const updates: Partial<BloodTransfusion> = {
        status: 'completed',
        end_time: endTime
      };

      // Calculate duration
      if (transfusion.start_time) {
        const start = new Date(`2000-01-01 ${transfusion.start_time}`);
        const end = new Date(`2000-01-01 ${endTime}`);
        const diffMs = end.getTime() - start.getTime();
        updates.duration_minutes = Math.round(diffMs / 60000);
      }

      // Calculate Hb increment
      if (postTransfusionHb) {
        updates.post_transfusion_hb = postTransfusionHb;
        updates.hb_increment = postTransfusionHb - transfusion.baseline_hb;
      }

      await this.updateTransfusion(transfusionId, updates);
    } catch (error) {
      console.error('Error completing transfusion:', error);
      throw new Error('Failed to complete transfusion');
    }
  }

  /**
   * Stop transfusion (for adverse events or other reasons)
   */
  async stopTransfusion(transfusionId: string, reason: string): Promise<void> {
    try {
      await this.updateTransfusion(transfusionId, {
        status: 'stopped',
        stop_reason: reason,
        end_time: new Date().toLocaleTimeString('en-US', { hour12: false })
      });
    } catch (error) {
      console.error('Error stopping transfusion:', error);
      throw new Error('Failed to stop transfusion');
    }
  }

  /**
   * Calculate transfusion statistics for a patient
   */
  async getPatientTransfusionStats(patientId: string) {
    try {
      const transfusions = await this.getPatientTransfusions(patientId);
      
      return {
        total_transfusions: transfusions.length,
        total_units: transfusions.reduce((sum, t) => sum + t.total_units, 0),
        completed: transfusions.filter(t => t.status === 'completed').length,
        with_complications: transfusions.filter(t => t.adverse_events).length,
        last_transfusion: transfusions[0]?.transfusion_date,
        most_common_indication: this.getMostCommonIndication(transfusions),
        average_hb_increment: this.calculateAverageHbIncrement(transfusions)
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      return null;
    }
  }

  private getMostCommonIndication(transfusions: BloodTransfusion[]): string {
    const indicationCounts: { [key: string]: number } = {};
    transfusions.forEach(t => {
      indicationCounts[t.indication] = (indicationCounts[t.indication] || 0) + 1;
    });
    
    let maxCount = 0;
    let mostCommon = '';
    Object.entries(indicationCounts).forEach(([indication, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = indication;
      }
    });
    
    return mostCommon;
  }

  private calculateAverageHbIncrement(transfusions: BloodTransfusion[]): number {
    const withIncrements = transfusions.filter(t => t.hb_increment !== undefined);
    if (withIncrements.length === 0) return 0;
    
    const sum = withIncrements.reduce((acc, t) => acc + (t.hb_increment || 0), 0);
    return Number((sum / withIncrements.length).toFixed(2));
  }

  /**
   * Validate blood bag compatibility
   */
  validateBloodBag(patientBloodGroup: string, bagBloodGroup: string): { compatible: boolean; message: string } {
    const compatibilityMatrix: { [key: string]: string[] } = {
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], // Universal recipient
      'AB-': ['A-', 'B-', 'AB-', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O-'] // Universal donor
    };

    const compatible = compatibilityMatrix[patientBloodGroup]?.includes(bagBloodGroup) || false;
    
    return {
      compatible,
      message: compatible 
        ? 'Blood bag is compatible' 
        : `⚠️ INCOMPATIBLE: ${bagBloodGroup} blood cannot be given to ${patientBloodGroup} patient`
    };
  }
}

export const bloodTransfusionService = new BloodTransfusionService();
