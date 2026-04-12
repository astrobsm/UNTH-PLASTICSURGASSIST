/**
 * Review Notification Service
 * Monitors planned reviews and sends push notification reminders
 */

import { db } from '../db/database';
import { notificationService } from './notificationService';

export interface ReviewSchedule {
  id: string;
  planId: string;
  patientId: number;
  patientName: string;
  reviewType: 'daily' | 'twice_daily' | 'weekly' | 'biweekly' | 'as_needed';
  daysOfWeek: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
  startDate: Date;
  endDate?: Date;
  assignedTo: string;
  assignedPersonName: string;
  reminderTime: string; // HH:MM format
  status: 'active' | 'completed' | 'cancelled';
}

class ReviewNotificationService {
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckedDate: string = '';
  
  // Default review times for different types
  private readonly DEFAULT_REVIEW_TIMES: Record<string, string> = {
    daily: '08:00',
    twice_daily_am: '08:00',
    twice_daily_pm: '16:00',
    weekly: '09:00',
    biweekly: '09:00',
    as_needed: '08:00'
  };

  constructor() {
    // Initialize on construction
    this.init();
  }

  private async init(): Promise<void> {
    // Request notification permission on init
    if (notificationService.getStatus().permission !== 'granted') {
      try {
        await notificationService.requestPermission();
      } catch (error) {
        console.log('Notification permission not granted:', error);
      }
    }
  }

  /**
   * Start monitoring planned reviews
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      console.log('⏰ Review monitoring already running');
      return;
    }

    console.log('⏰ Starting review notification monitoring...');
    
    // Check immediately on start
    this.checkDueReviews();
    
    // Check every minute for due reviews
    this.checkInterval = setInterval(() => {
      this.checkDueReviews();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('⏰ Review monitoring stopped');
    }
  }

  /**
   * Check for due reviews and send notifications
   */
  async checkDueReviews(): Promise<void> {
    try {
      const now = new Date();
      const currentDay = this.getDayOfWeek(now);
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const currentDateStr = now.toISOString().split('T')[0];
      
      // Get all treatment plans
      const treatmentPlans = await db.treatment_plans.toArray();
      
      for (const plan of treatmentPlans) {
        const reviews = plan.reviews || [];
        
        for (const review of reviews) {
          if (review.status !== 'active') continue;
          
          // Check if review is applicable today
          const isToday = this.isReviewDueToday(review, currentDay, now);
          if (!isToday) continue;
          
          // Get the reminder time for this review type
          const reminderTime = this.getReviewReminderTime(review.review_type);
          
          // Check if it's time to notify (within a 5-minute window)
          if (this.isTimeToNotify(currentTime, reminderTime)) {
            // Check if we already notified today for this review
            const notificationKey = `review-notified-${plan.id}-${review.review_type}-${currentDateStr}`;
            if (localStorage.getItem(notificationKey)) continue;
            
            // Send notification
            await this.sendReviewNotification(plan, review);
            
            // Mark as notified for today
            localStorage.setItem(notificationKey, 'true');
          }
        }
      }
    } catch (error) {
      console.error('Error checking due reviews:', error);
    }
  }

  /**
   * Check if review is due today based on days_of_week settings
   */
  private isReviewDueToday(review: any, currentDay: string, now: Date): boolean {
    // Check date range
    const startDate = new Date(review.start_date);
    if (now < startDate) return false;
    
    if (review.end_date) {
      const endDate = new Date(review.end_date);
      if (now > endDate) return false;
    }
    
    // Check if today is a review day
    const daysOfWeek = review.days_of_week || {};
    
    // If no specific days are set, assume daily
    const hasSpecificDays = Object.values(daysOfWeek).some(v => v === true);
    
    if (!hasSpecificDays) {
      // Default to daily if no days specified
      return review.review_type === 'daily' || review.review_type === 'twice_daily';
    }
    
    return daysOfWeek[currentDay] === true;
  }

  /**
   * Get reminder time based on review type
   */
  private getReviewReminderTime(reviewType: string): string {
    return this.DEFAULT_REVIEW_TIMES[reviewType] || this.DEFAULT_REVIEW_TIMES.daily;
  }

  /**
   * Check if current time is within notification window
   */
  private isTimeToNotify(currentTime: string, reminderTime: string): boolean {
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const [reminderHour, reminderMin] = reminderTime.split(':').map(Number);
    
    const currentMinutes = currentHour * 60 + currentMin;
    const reminderMinutes = reminderHour * 60 + reminderMin;
    
    // Notify within a 5-minute window
    return Math.abs(currentMinutes - reminderMinutes) <= 5;
  }

  /**
   * Send notification for a due review
   */
  private async sendReviewNotification(plan: any, review: any): Promise<void> {
    try {
      const patientName = plan.patient_name || `Patient ${plan.patient_id}`;
      const reviewerName = review.assigned_person_name || review.assigned_to || 'Assigned team member';
      
      let title = 'Patient Review Due';
      let message = '';
      
      switch (review.review_type) {
        case 'daily':
          title = '📋 Daily Review Due';
          message = `Daily review for ${patientName} is now due. Assigned to: ${reviewerName}`;
          break;
        case 'twice_daily':
          title = '📋 Review Due';
          message = `Twice-daily review for ${patientName} is now due. Assigned to: ${reviewerName}`;
          break;
        case 'weekly':
          title = '📋 Weekly Review Due';
          message = `Weekly review for ${patientName} is now due. Assigned to: ${reviewerName}`;
          break;
        case 'biweekly':
          title = '📋 Biweekly Review Due';
          message = `Biweekly review for ${patientName} is now due. Assigned to: ${reviewerName}`;
          break;
        default:
          message = `Review for ${patientName} is now due. Assigned to: ${reviewerName}`;
      }

      await notificationService.showLocalNotification({
        title,
        message,
        type: 'reminder',
        patientId: plan.patient_id,
        planId: plan.id,
        url: `/treatment-planning?patientId=${plan.patient_id}`
      });

      console.log(`✅ Sent review notification: ${title} - ${message}`);
    } catch (error) {
      console.error('Error sending review notification:', error);
    }
  }

  /**
   * Get current day of week as lowercase string
   */
  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Schedule a specific review reminder
   */
  async scheduleReviewReminder(
    planId: string,
    patientId: number,
    patientName: string,
    review: any,
    reminderDate: Date
  ): Promise<void> {
    try {
      const reviewerName = review.assigned_person_name || review.assigned_to || 'Assigned team member';
      
      await notificationService.scheduleLocalNotification({
        title: `📋 ${review.review_type.charAt(0).toUpperCase() + review.review_type.slice(1)} Review Reminder`,
        message: `Review for ${patientName} scheduled. Assigned to: ${reviewerName}`,
        type: 'reminder',
        patientId: Number(patientId),
        planId,
        scheduledFor: reminderDate,
        url: `/treatment-planning?patientId=${patientId}`
      });

      console.log(`✅ Scheduled review reminder for ${patientName} at ${reminderDate.toLocaleString()}`);
    } catch (error) {
      console.error('Error scheduling review reminder:', error);
    }
  }

  /**
   * Schedule reminders for a new review when it's added
   */
  async scheduleReviewRemindersForPlan(plan: any): Promise<void> {
    const reviews = plan.reviews || [];
    const patientName = plan.patient_name || `Patient ${plan.patient_id}`;
    
    for (const review of reviews) {
      if (review.status !== 'active') continue;
      
      const startDate = new Date(review.start_date);
      const endDate = review.end_date ? new Date(review.end_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      
      // Schedule reminders for the next 7 days
      const now = new Date();
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const scheduleEndDate = endDate < weekFromNow ? endDate : weekFromNow;
      
      let currentDate = startDate > now ? startDate : now;
      
      while (currentDate <= scheduleEndDate) {
        const dayName = this.getDayOfWeek(currentDate);
        
        // Check if this day is a review day
        const daysOfWeek = review.days_of_week || {};
        const hasSpecificDays = Object.values(daysOfWeek).some(v => v === true);
        const isReviewDay = !hasSpecificDays || daysOfWeek[dayName] === true;
        
        if (isReviewDay) {
          // Set reminder time
          const reminderTime = this.getReviewReminderTime(review.review_type);
          const [hours, minutes] = reminderTime.split(':').map(Number);
          
          const reminderDate = new Date(currentDate);
          reminderDate.setHours(hours, minutes, 0, 0);
          
          // Only schedule if in the future
          if (reminderDate > now) {
            await this.scheduleReviewReminder(
              plan.id,
              plan.patient_id,
              patientName,
              review,
              reminderDate
            );
          }
        }
        
        // Move to next day
        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
      }
    }
  }

  /**
   * Get upcoming reviews for today
   */
  async getTodaysReviews(): Promise<any[]> {
    const now = new Date();
    const currentDay = this.getDayOfWeek(now);
    const todaysReviews: any[] = [];
    
    try {
      const treatmentPlans = await db.treatment_plans.toArray();
      
      for (const plan of treatmentPlans) {
        const reviews = plan.reviews || [];
        
        for (const review of reviews) {
          if (review.status !== 'active') continue;
          
          if (this.isReviewDueToday(review, currentDay, now)) {
            todaysReviews.push({
              planId: plan.id,
              patientId: plan.patient_id,
              patientName: plan.patient_name || 'Unknown Patient',
              diagnosis: plan.diagnosis || 'Unknown diagnosis',
              review: review
            });
          }
        }
      }
    } catch (error) {
      console.error('Error getting today\'s reviews:', error);
    }
    
    return todaysReviews;
  }

  /**
   * Mark a review as completed for today
   */
  async markReviewCompleted(planId: string, reviewType: string, notes?: string): Promise<void> {
    try {
      const plan = await db.treatment_plans.get(planId);
      if (!plan) return;
      
      const reviews = plan.reviews || [];
      const reviewIndex = reviews.findIndex(r => r.review_type === reviewType);
      
      if (reviewIndex >= 0) {
        const review = reviews[reviewIndex];
        const completedReviews = review.completed_reviews || [];
        
        completedReviews.push({
          date: new Date(),
          completed_by: '', // Will be filled by caller
          notes: notes || ''
        });
        
        reviews[reviewIndex] = {
          ...review,
          completed_reviews: completedReviews
        };
        
        await db.treatment_plans.update(planId, { reviews });
        
        console.log(`✅ Marked ${reviewType} review as completed for plan ${planId}`);
      }
    } catch (error) {
      console.error('Error marking review as completed:', error);
    }
  }

  /**
   * Mark a review as missed
   */
  async markReviewMissed(planId: string, reviewType: string, reason?: string): Promise<void> {
    try {
      const plan = await db.treatment_plans.get(planId);
      if (!plan) return;
      
      const reviews = plan.reviews || [];
      const reviewIndex = reviews.findIndex(r => r.review_type === reviewType);
      
      if (reviewIndex >= 0) {
        const review = reviews[reviewIndex];
        const missedReviews = review.missed_reviews || [];
        
        missedReviews.push({
          date: new Date(),
          reason: reason || 'Not recorded'
        });
        
        reviews[reviewIndex] = {
          ...review,
          missed_reviews: missedReviews
        };
        
        await db.treatment_plans.update(planId, { reviews });
        
        console.log(`⚠️ Marked ${reviewType} review as missed for plan ${planId}`);
      }
    } catch (error) {
      console.error('Error marking review as missed:', error);
    }
  }

  /**
   * Clean up old notification markers (older than 7 days)
   */
  cleanupOldNotificationMarkers(): void {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
    
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('review-notified-')) {
        const datePart = key.split('-').slice(-1)[0];
        if (datePart < sevenDaysAgoStr) {
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${keysToRemove.length} old notification markers`);
    }
  }
}

// Export singleton instance
export const reviewNotificationService = new ReviewNotificationService();
