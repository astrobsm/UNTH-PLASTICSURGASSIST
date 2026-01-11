import { db } from '../db/database';
import { logger } from '../utils/logger';

export interface PatientActivity {
  id?: number;
  patient_id: number;
  hospital_number: string;
  user_id: string;
  user_name: string;
  user_role: string;
  activity_type: 'risk_assessment' | 'transfer' | 'progress_note' | 'prescription' | 'discharge' | 'admission' | 'lab_order' | 'surgery' | 'vital_signs' | 'other';
  action: 'created' | 'updated' | 'deleted' | 'viewed' | 'completed';
  description: string;
  details?: any; // JSON object with activity-specific details
  before_state?: any; // For tracking changes
  after_state?: any; // For tracking changes
  timestamp: Date;
  ip_address?: string;
  metadata?: any; // Additional contextual information
}

class PatientActivityService {
  /**
   * Log a patient activity
   */
  async logActivity(activity: Omit<PatientActivity, 'id' | 'timestamp'>): Promise<void> {
    try {
      const activityRecord: PatientActivity = {
        ...activity,
        timestamp: new Date()
      };

      await db.activity_logs.add(activityRecord);
      logger.log(`✅ Logged activity: ${activity.activity_type} - ${activity.action} for patient ${activity.hospital_number}`);
    } catch (error) {
      console.error('Error logging patient activity:', error);
      // Don't throw - activity logging should not break the main flow
    }
  }

  /**
   * Log risk assessment activity
   */
  async logRiskAssessment(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    assessmentType: string,
    riskLevel: string,
    score: number,
    action: 'created' | 'updated' = 'created'
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'risk_assessment',
      action,
      description: `${action === 'created' ? 'Completed' : 'Updated'} ${assessmentType} risk assessment - Risk Level: ${riskLevel}, Score: ${score}`,
      details: {
        assessment_type: assessmentType,
        risk_level: riskLevel,
        score
      }
    });
  }

  /**
   * Log patient transfer
   */
  async logTransfer(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    fromLocation: string,
    toLocation: string,
    reason: string
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'transfer',
      action: 'created',
      description: `Transferred patient from ${fromLocation} to ${toLocation}`,
      details: {
        from_location: fromLocation,
        to_location: toLocation,
        reason
      }
    });
  }

  /**
   * Log progress note
   */
  async logProgressNote(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    noteType: string,
    summary: string
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'progress_note',
      action: 'created',
      description: `Added ${noteType} progress note`,
      details: {
        note_type: noteType,
        summary: summary.substring(0, 200) // First 200 chars
      }
    });
  }

  /**
   * Log prescription
   */
  async logPrescription(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    medications: any[],
    action: 'created' | 'updated' | 'deleted' = 'created'
  ): Promise<void> {
    const medicationList = medications.map(m => `${m.medication} ${m.dosage}`).join(', ');
    
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'prescription',
      action,
      description: `${action === 'created' ? 'Prescribed' : action === 'updated' ? 'Updated prescription for' : 'Deleted prescription for'} ${medications.length} medication(s): ${medicationList}`,
      details: {
        medication_count: medications.length,
        medications: medications.map(m => ({
          name: m.medication,
          dosage: m.dosage,
          frequency: m.frequency
        }))
      }
    });
  }

  /**
   * Log discharge
   */
  async logDischarge(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    dischargeType: string,
    destination: string
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'discharge',
      action: 'completed',
      description: `Patient discharged - Type: ${dischargeType}, Destination: ${destination}`,
      details: {
        discharge_type: dischargeType,
        destination
      }
    });
  }

  /**
   * Log admission
   */
  async logAdmission(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    admissionType: string,
    ward: string,
    diagnosis: string
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'admission',
      action: 'created',
      description: `Patient admitted to ${ward} - ${admissionType} admission`,
      details: {
        admission_type: admissionType,
        ward,
        diagnosis
      }
    });
  }

  /**
   * Log lab order
   */
  async logLabOrder(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    tests: string[],
    urgency: string
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'lab_order',
      action: 'created',
      description: `Ordered ${tests.length} lab test(s) - Urgency: ${urgency}`,
      details: {
        tests,
        urgency,
        test_count: tests.length
      }
    });
  }

  /**
   * Log surgery booking
   */
  async logSurgery(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    procedureName: string,
    scheduledDate: Date,
    action: 'created' | 'updated' | 'completed' = 'created'
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'surgery',
      action,
      description: `${action === 'created' ? 'Scheduled' : action === 'updated' ? 'Updated' : 'Completed'} surgery: ${procedureName}`,
      details: {
        procedure_name: procedureName,
        scheduled_date: scheduledDate
      }
    });
  }

  /**
   * Log vital signs recording
   */
  async logVitalSigns(
    patientId: number,
    hospitalNumber: string,
    userId: string,
    userName: string,
    userRole: string,
    vitals: any
  ): Promise<void> {
    await this.logActivity({
      patient_id: patientId,
      hospital_number: hospitalNumber,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      activity_type: 'vital_signs',
      action: 'created',
      description: `Recorded vital signs - BP: ${vitals.blood_pressure}, HR: ${vitals.heart_rate}, Temp: ${vitals.temperature}`,
      details: vitals
    });
  }

  /**
   * Get all activities for a patient
   */
  async getPatientActivities(patientId: number, limit: number = 50): Promise<PatientActivity[]> {
    try {
      const activities = await db.activity_logs
        .where('patient_id')
        .equals(patientId)
        .reverse()
        .limit(limit)
        .toArray();

      return activities as PatientActivity[];
    } catch (error) {
      console.error('Error fetching patient activities:', error);
      return [];
    }
  }

  /**
   * Get activities by type for a patient
   */
  async getPatientActivitiesByType(
    patientId: number,
    activityType: PatientActivity['activity_type'],
    limit: number = 20
  ): Promise<PatientActivity[]> {
    try {
      const activities = await db.activity_logs
        .where('patient_id')
        .equals(patientId)
        .and(activity => activity.activity_type === activityType)
        .reverse()
        .limit(limit)
        .toArray();

      return activities as PatientActivity[];
    } catch (error) {
      console.error('Error fetching patient activities by type:', error);
      return [];
    }
  }

  /**
   * Get activities by user
   */
  async getActivitiesByUser(userId: string, limit: number = 50): Promise<PatientActivity[]> {
    try {
      const activities = await db.activity_logs
        .where('user_id')
        .equals(userId)
        .reverse()
        .limit(limit)
        .toArray();

      return activities as PatientActivity[];
    } catch (error) {
      console.error('Error fetching activities by user:', error);
      return [];
    }
  }

  /**
   * Get activity statistics for a patient
   */
  async getPatientActivityStats(patientId: number): Promise<{
    total: number;
    byType: Record<string, number>;
    byUser: Record<string, number>;
    lastActivity?: PatientActivity;
  }> {
    try {
      const activities = await db.activity_logs
        .where('patient_id')
        .equals(patientId)
        .toArray();

      const byType: Record<string, number> = {};
      const byUser: Record<string, number> = {};

      activities.forEach((activity: any) => {
        byType[activity.activity_type] = (byType[activity.activity_type] || 0) + 1;
        byUser[activity.user_name] = (byUser[activity.user_name] || 0) + 1;
      });

      const lastActivity = activities.length > 0 
        ? activities[activities.length - 1] as PatientActivity
        : undefined;

      return {
        total: activities.length,
        byType,
        byUser,
        lastActivity
      };
    } catch (error) {
      console.error('Error fetching patient activity stats:', error);
      return { total: 0, byType: {}, byUser: {} };
    }
  }

  /**
   * Delete old activities (data retention)
   */
  async cleanupOldActivities(daysToKeep: number = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const oldActivities = await db.activity_logs
        .where('timestamp')
        .below(cutoffDate)
        .toArray();

      if (oldActivities.length > 0) {
        await db.activity_logs.bulkDelete(oldActivities.map(a => a.id!));
        console.log(`🗑️ Cleaned up ${oldActivities.length} old activities`);
      }

      return oldActivities.length;
    } catch (error) {
      console.error('Error cleaning up old activities:', error);
      return 0;
    }
  }
}

export const patientActivityService = new PatientActivityService();
