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

// GFR-based dosing adjustments for common medications
const GFR_DOSING_DATABASE: Record<string, {
  normal: { dose: string; frequency: string };
  mild: { dose: string; frequency: string };
  moderate: { dose: string; frequency: string };
  severe: { dose: string; frequency: string };
  kidney_failure: { dose: string; frequency: string; contraindicated?: boolean };
  notes?: string;
}> = {
  // Antibiotics
  'Amoxicillin': {
    normal: { dose: '500mg-1g', frequency: 'TDS' },
    mild: { dose: '500mg-1g', frequency: 'TDS' },
    moderate: { dose: '500mg', frequency: 'BD' },
    severe: { dose: '500mg', frequency: 'OD' },
    kidney_failure: { dose: '250-500mg', frequency: 'OD' },
    notes: 'Reduce dose and frequency with declining GFR'
  },
  'Ciprofloxacin': {
    normal: { dose: '500mg', frequency: 'BD' },
    mild: { dose: '500mg', frequency: 'BD' },
    moderate: { dose: '250-500mg', frequency: 'BD' },
    severe: { dose: '250mg', frequency: 'BD' },
    kidney_failure: { dose: '250mg', frequency: 'OD' },
    notes: 'Accumulates in renal impairment; consider alternative'
  },
  'Levofloxacin': {
    normal: { dose: '500mg', frequency: 'OD' },
    mild: { dose: '500mg', frequency: 'OD' },
    moderate: { dose: '250mg', frequency: 'OD' },
    severe: { dose: '250mg', frequency: 'Every 48 hours' },
    kidney_failure: { dose: '250mg', frequency: 'Every 48 hours' },
    notes: 'Significant renal elimination; adjust for GFR'
  },
  'Metronidazole': {
    normal: { dose: '500mg', frequency: 'TDS' },
    mild: { dose: '500mg', frequency: 'TDS' },
    moderate: { dose: '500mg', frequency: 'BD' },
    severe: { dose: '500mg', frequency: 'BD' },
    kidney_failure: { dose: '500mg', frequency: 'BD' },
    notes: 'Accumulation of metabolites in severe renal impairment'
  },
  'Gentamicin': {
    normal: { dose: '5-7mg/kg', frequency: 'OD' },
    mild: { dose: '5mg/kg', frequency: 'Every 36-48 hours' },
    moderate: { dose: '3-5mg/kg', frequency: 'Every 48-72 hours' },
    severe: { dose: '2-3mg/kg', frequency: 'Every 72 hours', },
    kidney_failure: { dose: 'Avoid', frequency: 'N/A', contraindicated: true },
    notes: 'Nephrotoxic; avoid in severe renal impairment. Monitor levels.'
  },
  'Ceftriaxone': {
    normal: { dose: '1-2g', frequency: 'OD' },
    mild: { dose: '1-2g', frequency: 'OD' },
    moderate: { dose: '1-2g', frequency: 'OD' },
    severe: { dose: '1g', frequency: 'OD' },
    kidney_failure: { dose: '1g', frequency: 'OD' },
    notes: 'Does not require significant dose adjustment; dual elimination'
  },
  // Analgesics
  'Paracetamol': {
    normal: { dose: '1g', frequency: 'QID' },
    mild: { dose: '1g', frequency: 'QID' },
    moderate: { dose: '1g', frequency: 'QID' },
    severe: { dose: '500mg-1g', frequency: 'TDS' },
    kidney_failure: { dose: '500mg', frequency: 'TDS' },
    notes: 'Generally safe; extend interval in severe impairment'
  },
  'Ibuprofen': {
    normal: { dose: '400-600mg', frequency: 'TDS' },
    mild: { dose: '400mg', frequency: 'TDS' },
    moderate: { dose: '200-400mg', frequency: 'BD' },
    severe: { dose: 'Avoid', frequency: 'N/A', },
    kidney_failure: { dose: 'Avoid', frequency: 'N/A', contraindicated: true },
    notes: 'NSAIDs can worsen renal function; avoid in CKD Stage 4-5'
  },
  'Diclofenac': {
    normal: { dose: '50mg', frequency: 'TDS' },
    mild: { dose: '50mg', frequency: 'BD' },
    moderate: { dose: '25-50mg', frequency: 'BD' },
    severe: { dose: 'Avoid', frequency: 'N/A' },
    kidney_failure: { dose: 'Avoid', frequency: 'N/A', contraindicated: true },
    notes: 'NSAIDs contraindicated in severe renal impairment'
  },
  'Tramadol': {
    normal: { dose: '50-100mg', frequency: 'Q6H' },
    mild: { dose: '50-100mg', frequency: 'Q6H' },
    moderate: { dose: '50mg', frequency: 'Q8H' },
    severe: { dose: '50mg', frequency: 'Q12H' },
    kidney_failure: { dose: '25-50mg', frequency: 'Q12H' },
    notes: 'Active metabolite accumulates; extend dosing interval'
  },
  'Morphine': {
    normal: { dose: '5-10mg', frequency: 'Q4H PRN' },
    mild: { dose: '5-10mg', frequency: 'Q4H PRN' },
    moderate: { dose: '2.5-5mg', frequency: 'Q6H PRN' },
    severe: { dose: '2.5mg', frequency: 'Q8H PRN' },
    kidney_failure: { dose: 'Use with caution', frequency: 'Q8-12H PRN' },
    notes: 'Active metabolites accumulate; prefer fentanyl in ESRD'
  },
  // Cardiovascular
  'Enoxaparin': {
    normal: { dose: '1mg/kg', frequency: 'BD' },
    mild: { dose: '1mg/kg', frequency: 'BD' },
    moderate: { dose: '0.75mg/kg', frequency: 'BD' },
    severe: { dose: '1mg/kg', frequency: 'OD' },
    kidney_failure: { dose: '0.5mg/kg', frequency: 'OD' },
    notes: 'Accumulates in renal impairment; monitor anti-Xa levels'
  },
  'Lisinopril': {
    normal: { dose: '10-20mg', frequency: 'OD' },
    mild: { dose: '10-20mg', frequency: 'OD' },
    moderate: { dose: '5-10mg', frequency: 'OD' },
    severe: { dose: '2.5-5mg', frequency: 'OD' },
    kidney_failure: { dose: '2.5mg', frequency: 'OD' },
    notes: 'Start low and titrate; monitor K+ and creatinine'
  },
  'Metformin': {
    normal: { dose: '500-1000mg', frequency: 'BD' },
    mild: { dose: '500-1000mg', frequency: 'BD' },
    moderate: { dose: '500mg', frequency: 'BD' },
    severe: { dose: 'Avoid', frequency: 'N/A' },
    kidney_failure: { dose: 'Contraindicated', frequency: 'N/A', contraindicated: true },
    notes: 'Contraindicated if GFR <30 due to lactic acidosis risk'
  },
  // Antifungals
  'Fluconazole': {
    normal: { dose: '200-400mg', frequency: 'OD' },
    mild: { dose: '200-400mg', frequency: 'OD' },
    moderate: { dose: '100-200mg', frequency: 'OD' },
    severe: { dose: '50-100mg', frequency: 'OD' },
    kidney_failure: { dose: '50mg', frequency: 'OD' },
    notes: 'Reduce dose by 50% in severe renal impairment'
  },
  // Anticonvulsants
  'Gabapentin': {
    normal: { dose: '300-600mg', frequency: 'TDS' },
    mild: { dose: '200-300mg', frequency: 'TDS' },
    moderate: { dose: '200-300mg', frequency: 'BD' },
    severe: { dose: '100-200mg', frequency: 'OD' },
    kidney_failure: { dose: '100mg', frequency: 'After dialysis' },
    notes: 'Significantly accumulates; dose reduction essential'
  },
  'Pregabalin': {
    normal: { dose: '150-300mg', frequency: 'BD' },
    mild: { dose: '75-150mg', frequency: 'BD' },
    moderate: { dose: '75mg', frequency: 'BD' },
    severe: { dose: '25-75mg', frequency: 'OD' },
    kidney_failure: { dose: '25mg', frequency: 'After dialysis' },
    notes: 'Renal elimination; significant dose reduction required'
  },
};

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
    const gfrCategory = this.getGFRCategory(gfr);
    
    // Try to find medication in database (case-insensitive)
    const medicationKey = Object.keys(GFR_DOSING_DATABASE).find(
      key => key.toLowerCase() === medicationName.toLowerCase() ||
             medicationName.toLowerCase().includes(key.toLowerCase())
    );
    
    const dosingData = medicationKey ? GFR_DOSING_DATABASE[medicationKey] : null;
    
    if (!dosingData) {
      // No specific data available - return standard dose with warning
      return {
        medication: medicationName,
        standardDose: standardDose || 'As prescribed',
        standardFrequency: standardFrequency || 'As prescribed',
        gfrCategory,
        adjustedDose: standardDose || 'Consult pharmacist/nephrologist',
        adjustedFrequency: standardFrequency || 'Consult pharmacist/nephrologist',
        notes: `No specific GFR-based dosing data available for ${medicationName}. Consult clinical pharmacist or nephrologist for dosing in renal impairment.`,
        requiresMonitoring: gfr < 60,
        contraindicated: false
      };
    }
    
    // Get category-specific dosing
    let categoryDosing;
    switch (gfrCategory) {
      case GFRCategory.NORMAL:
        categoryDosing = dosingData.normal;
        break;
      case GFRCategory.MILD_DECREASE:
        categoryDosing = dosingData.mild;
        break;
      case GFRCategory.MODERATE:
        categoryDosing = dosingData.moderate;
        break;
      case GFRCategory.SEVERE:
        categoryDosing = dosingData.severe;
        break;
      case GFRCategory.KIDNEY_FAILURE:
        categoryDosing = dosingData.kidney_failure;
        break;
    }
    
    const isContraindicated = categoryDosing.contraindicated || 
                              categoryDosing.dose.toLowerCase().includes('avoid') ||
                              categoryDosing.dose.toLowerCase().includes('contraindicated');
    
    return {
      medication: medicationName,
      standardDose: dosingData.normal.dose,
      standardFrequency: dosingData.normal.frequency,
      gfrCategory,
      adjustedDose: categoryDosing.dose,
      adjustedFrequency: categoryDosing.frequency,
      notes: dosingData.notes || '',
      requiresMonitoring: gfr < 60,
      contraindicated: isContraindicated
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
        
        const medications = plan.planned_medications || plan.medications || [];
        
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
            patient_id: plan.patient_id,
            patient_name: plan.patient_name || 'Unknown Patient',
            end_date: endDate,
            days_remaining: daysRemaining,
            alert_level: alertLevel
          });
          
          // Send push notification for urgent alerts
          if (alertLevel === 'urgent' || alertLevel === 'expired') {
            const message = alertLevel === 'expired' 
              ? `${med.medication_name} has ended for ${plan.patient_name}. Review and consider continuation or discontinuation.`
              : `${med.medication_name} for ${plan.patient_name} ends tomorrow. Review treatment plan.`;
            
            await notificationService.showLocalNotification({
              title: alertLevel === 'expired' ? '⚠️ Medication Ended' : '⏰ Medication Ending Soon',
              message,
              type: alertLevel === 'expired' ? 'urgent' : 'reminder',
              patientId: parseInt(plan.patient_id),
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
