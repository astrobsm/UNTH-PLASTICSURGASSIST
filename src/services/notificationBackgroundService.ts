import { mcqGenerationService } from './mcqGenerationService';

/**
 * Background notification service
 * Handles push notifications for scheduled MCQ tests
 */
class NotificationBackgroundService {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // Check every minute

  /**
   * Start the background service
   */
  start(): void {
    if (this.intervalId) {
      console.log('Notification service already running');
      return;
    }

    console.log('Starting MCQ notification service...');
    
    // Check immediately on start
    this.processNotifications();

    // Then check every minute
    this.intervalId = setInterval(() => {
      this.processNotifications();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the background service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Notification service stopped');
    }
  }

  /**
   * Process pending notifications
   */
  private async processNotifications(): Promise<void> {
    try {
      await mcqGenerationService.processNotifications();
    } catch (error) {
      console.error('Error processing notifications:', error);
    }
  }

  /**
   * Request notification permission (PWA)
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  /**
   * Send push notification
   */
  async sendNotification(title: string, options?: any): Promise<void> {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      const granted = await this.requestNotificationPermission();
      if (!granted) {
        console.log('Notification permission denied');
        return;
      }
    }

    try {
      const notification = new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      } as any);

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }

  /**
   * Schedule notification for specific time (used for test reminders)
   */
  scheduleNotification(
    scheduledFor: Date,
    title: string,
    body: string
  ): void {
    const now = new Date();
    const delay = scheduledFor.getTime() - now.getTime();

    if (delay > 0) {
      setTimeout(() => {
        this.sendNotification(title, {
          body,
          tag: 'mcq-test-reminder',
          requireInteraction: true
        });
      }, delay);
    }
  }

  /**
   * Send test reminder (Tuesday 9 AM reminder)
   */
  async sendTestReminder(topicTitle: string, scheduledFor: Date): Promise<void> {
    await this.sendNotification(
      '🎯 MCQ Assessment Reminder',
      {
        body: `New test on "${topicTitle}" starts ${scheduledFor.toLocaleString()}. Duration: 10 minutes. Good luck!`,
        tag: 'mcq-test-reminder',
        requireInteraction: true,
        actions: [
          {
            action: 'view',
            title: 'View Details'
          },
          {
            action: 'dismiss',
            title: 'Dismiss'
          }
        ]
      }
    );
  }

  /**
   * Send test available notification
   */
  async sendTestAvailableNotification(topicTitle: string): Promise<void> {
    await this.sendNotification(
      '✅ MCQ Test Now Available',
      {
        body: `"${topicTitle}" assessment is now open. 25 questions, 10 minutes. Start now!`,
        tag: 'mcq-test-available',
        requireInteraction: true,
        actions: [
          {
            action: 'start',
            title: 'Start Test'
          },
          {
            action: 'later',
            title: 'Remind Later'
          }
        ]
      }
    );
  }

  /**
   * Send results available notification
   */
  async sendResultsNotification(score: number, passed: boolean): Promise<void> {
    await this.sendNotification(
      passed ? '🎉 Test Completed - Passed!' : '📊 Test Completed',
      {
        body: `Your score: ${score}%. ${passed ? 'Congratulations!' : 'Review study materials to improve.'}`,
        tag: 'mcq-test-results',
        requireInteraction: false
      }
    );
  }
}

export const notificationService = new NotificationBackgroundService();

// Auto-start service when module loads (if in browser)
if (typeof window !== 'undefined') {
  // Request permission on load
  notificationService.requestNotificationPermission();
  
  // Start background service
  notificationService.start();

  // Stop service when page unloads
  window.addEventListener('beforeunload', () => {
    notificationService.stop();
  });
}
