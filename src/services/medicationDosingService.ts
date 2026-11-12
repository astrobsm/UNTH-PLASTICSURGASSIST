// Medication Dosing Service with GFR-based adjustments
// Provides intelligent dosing recommendations based on renal function

import { notificationService } from './notificationService';
import { db } from '../db/database';

// GFR Categories based on CKD staging
export enum GFRCategory {
  NORMAL = 'normal', // GFR >= 90
  MILD_DECREASE = 'mild_decrease', // GFR 60-89
  MODERATE = 'moderate', // GFR 30-59 (CKD Stage 3)
  SEVERE = 'severe', // GFR 15-29 (CKD Stage 4)
  KIDNEY_FAILURE = 'kidney_failure', // GFR < 15 (CKD Stage 5)
}

export interface GFRDosingRecommendation {
  medication: string;
  standardDose: string;
  standardFrequency: string;
  gfrCategory: GFRCategory;
  adjustedDose: string;
  adjustedFrequency: string;
  notes: string;
  requiresMonitoring: boolean;
  contraindicated: boolean;
}

export interface MedicationEndDateAlert {
  medication_name: string;
  patient_id: string;
  patient_name: string;
  end_date: Date;
  days_remaining: number;
  alert_level: 'warning' | 'urgent' | 'expired';
}

import { GFR_DOSING_DATABASE } from '../data/gfrDosingTable';
import { renalDoseGuidance } from '../data/renalDosing';

class MedicationDosingService {
  /**
   * Calculate GFR category based on eGFR value
   */
  getGFRCategory(gfr: number): GFRCategory {
    if (gfr >= 90) return GFRCategory.NORMAL;
    if (gfr >= 60) return GFRCategory.MILD_DECREASE;
    if (gfr >= 30) return GFRCategory.MODERATE;
    if (gfr >= 15) return GFRCategory.SEVERE;
    return GFRCategory.KIDNEY_FAILURE;
  }

  /**
   * Get GFR-adjusted dosing recommendation for a medication
   */
  getDosingRecommendation(
    medicationName: string,
    gfr: number,
    standardDose?: string,
    standardFrequency?: string
  ): GFRDosingRecommendation {
    // One resolver for every renal-dosing question (src/data/renalDosing.ts):
    // BNF database reference first, secondary tables only where it has nothing.
    const gfrCategory = this.getGFRCategory(gfr);
    const g = renalDoseGuidance(medicationName, gfr);
    const fromSecondary = !!g.primary && !g.verified && !!g.primary.dose;
    return {
      medication: medicationName,
      standardDose: standardDose || 'As prescribed',
      standardFrequency: standardFrequency || 'As prescribed',
      gfrCategory,
      // A number is filled in only from a table that states one for this band;
      // with the BNF reference the standard dose stays and its renal note is shown.
      adjustedDose: fromSecondary ? g.primary!.dose! : g.primary ? (standardDose || 'See BNF renal note') : (standardDose || 'Consult pharmacist/nephrologist'),
      adjustedFrequency: fromSecondary ? (g.primary!.frequency || standardFrequency || 'As prescribed') : (standardFrequency || (g.primary ? 'As prescribed' : 'Consult pharmacist/nephrologist')),
      notes: g.summary,
      requiresMonitoring: gfr < 60,
      contraindicated: g.contraindicated,
    };
  }

  /**
   * Calculate medication end date from start date and duration string
   */
  calculateEndDate(startDate: Date, duration: string): Date | null {
    if (!duration) return null;
    
    const durationLower = duration.toLowerCase();
    let days = 0;
    
    // Parse duration string
    const numMatch = durationLower.match(/(\d+)/);
    const num = numMatch ? parseInt(numMatch[1], 10) : 0;
    
    if (durationLower.includes('day')) {
      days = num;
    } else if (durationLower.includes('week')) {
      days = num * 7;
    } else if (durationLower.includes('month')) {
      days = num * 30;
    } else if (durationLower.includes('year')) {
      days = num * 365;
    } else if (durationLower.includes('discharge') || durationLower.includes('indefinite')) {
      return null; // No specific end date
    } else if (num > 0) {
      // Assume days if just a number
      days = num;
    }
    
    if (days === 0) return null;
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days);
    return endDate;
  }

  /**
   * Check medications approaching end date and send notifications
   */
  async checkMedicationEndDates(): Promise<MedicationEndDateAlert[]> {
    const alerts: MedicationEndDateAlert[] = [];
    
    try {
      // Get all active treatment plans
      const plans = await db.treatment_plans.toArray();
      
      for (const plan of plans) {
        if (plan.status !== 'active') continue;
        
        const medications = (plan as any).planned_medications || plan.medications || [];
        
        for (const med of medications) {
          if (med.status !== 'active') continue;
          
          let endDate: Date | null = null;
          
          // Try to get end date
          if (med.end_date) {
            endDate = new Date(med.end_date);
          } else if (med.duration && med.start_date) {
            endDate = this.calculateEndDate(new Date(med.start_date), med.duration);
          }
          
          if (!endDate) continue;
          
          const now = new Date();
          const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          let alertLevel: 'warning' | 'urgent' | 'expired' = 'warning';
          if (daysRemaining <= 0) {
            alertLevel = 'expired';
          } else if (daysRemaining <= 1) {
            alertLevel = 'urgent';
          } else if (daysRemaining <= 3) {
            alertLevel = 'warning';
          } else {
            continue; // No alert needed
          }
          
          alerts.push({
            medication_name: med.medication_name,
            patient_id: String(plan.patient_id),
            patient_name: (plan as any).patient_name || 'Unknown Patient',
            end_date: endDate,
            days_remaining: daysRemaining,
            alert_level: alertLevel
          });
          
          // Send push notification for urgent alerts
          if (alertLevel === 'urgent' || alertLevel === 'expired') {
            const patientLabel = (plan as any).patient_name || 'Unknown Patient';
            const medLabel = med.medication_name || 'Unknown medication';
            const message = alertLevel === 'expired' 
              ? `${medLabel} has ended for ${patientLabel}. Review and consider continuation or discontinuation.`
              : `${medLabel} for ${patientLabel} ends tomorrow. Review treatment plan.`;
            
            await notificationService.showLocalNotification({
              title: alertLevel === 'expired' ? '⚠️ Medication Ended' : '⏰ Medication Ending Soon',
              message,
              type: alertLevel === 'expired' ? 'urgent' : 'reminder',
              patientId: parseInt(String(plan.patient_id)),
              url: `/treatment-planning`
            });
          }
        }
      }
    } catch (error) {
      console.error('Error checking medication end dates:', error);
    }
    
    return alerts;
  }

  /**
   * Get list of all medications with GFR dosing available
   */
  getAvailableMedicationsWithGFRDosing(): string[] {
    return Object.keys(GFR_DOSING_DATABASE);
  }

  /**
   * Start medication end date monitoring
   */
  startMedicationMonitoring() {
    // Check immediately
    this.checkMedicationEndDates();
    
    // Then check every 4 hours
    setInterval(() => {
      this.checkMedicationEndDates();
    }, 4 * 60 * 60 * 1000);
    
    console.log('✅ Medication end date monitoring started');
  }
}

export const medicationDosingService = new MedicationDosingService();
