// VAPID keys for Web Push (in production, these should be environment variables)
export const VAPID_PUBLIC_KEY = 'BL7ELnbFPVkimqMT3g8xm9EkB8u6xKpZnWRe4J5-v3g1-RxSp1T5-HKFzKy2_QrIZ8Q4X1D2KmNkJ5T_aJ9wT3E';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'reminder' | 'alert' | 'urgent' | 'info';
  patientId?: number;
  planId?: number;
  stepId?: number;
  scheduledFor?: Date;
  url?: string; // Deep link to relevant page
}

export interface NotificationSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  constructor() {
    this.initializeService();
  }

  private async initializeService(): Promise<void> {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      try {
        this.registration = await navigator.serviceWorker.ready;
        await this.checkExistingSubscription();
      } catch (error) {
        console.error('Failed to initialize notification service:', error);
      }
    }
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('This browser does not support notifications');
    }

    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      await this.subscribeToPush();
    }
    
    return permission;
  }

  // Check if we have permission
  hasPermission(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // Subscribe to push notifications
  private async subscribeToPush(): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    try {
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      this.subscription = subscription;
      
      // In a real app, send this subscription to your server
      console.log('Push subscription:', JSON.stringify(subscription));
      
      // Store subscription locally for demo purposes
      localStorage.setItem('push-subscription', JSON.stringify(subscription));
      
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
    }
  }

  // Check for existing subscription
  private async checkExistingSubscription(): Promise<void> {
    if (!this.registration) return;

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      this.subscription = subscription;
    } catch (error) {
      console.error('Failed to check existing subscription:', error);
    }
  }

  // Show local notification (works offline)
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.hasPermission()) {
      throw new Error('Notification permission not granted');
    }

    const options: NotificationOptions = {
      body: payload.message,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `clinical-${payload.type}`,
      requireInteraction: payload.type === 'urgent',
      silent: false,
      vibrate: payload.type === 'urgent' ? [200, 100, 200] : [100],
      data: {
        patientId: payload.patientId,
        planId: payload.planId,
        stepId: payload.stepId,
        url: payload.url,
        timestamp: new Date().toISOString()
      },
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/logo.png'
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
          icon: '/logo.png'
        }
      ]
    };

    // Add priority styling based on type
    switch (payload.type) {
      case 'urgent':
        options.badge = '/urgent-icon.svg';
        break;
      case 'alert':
        options.badge = '/alert-icon.svg';
        break;
      case 'reminder':
        options.badge = '/reminder-icon.svg';
        break;
    }

    const notification = new Notification(payload.title, options);
    
    // Handle notification click
    notification.onclick = () => {
      window.focus();
      if (payload.url) {
        window.location.href = payload.url;
      }
      notification.close();
    };

    return Promise.resolve();
  }

  // Schedule a local notification (using service worker)
  async scheduleLocalNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration || !payload.scheduledFor) {
      throw new Error('Service Worker not available or no schedule time provided');
    }

    const delay = payload.scheduledFor.getTime() - Date.now();
    
    if (delay <= 0) {
      // Show immediately if time has passed
      return this.showLocalNotification(payload);
    }

    // Store in IndexedDB for persistence
    await this.storeScheduledNotification(payload);

    // Schedule using setTimeout (will be lost on page refresh, but service worker handles persistence)
    setTimeout(() => {
      this.showLocalNotification(payload);
    }, delay);
  }

  // Store scheduled notification in IndexedDB
  private async storeScheduledNotification(payload: NotificationPayload): Promise<void> {
    // This would integrate with our existing IndexedDB setup
    const notifications = JSON.parse(localStorage.getItem('scheduled-notifications') || '[]');
    notifications.push({
      id: Date.now(),
      ...payload,
      created: new Date().toISOString()
    });
    localStorage.setItem('scheduled-notifications', JSON.stringify(notifications));
  }

  // Simulate push notification (for demo purposes)
  async simulatePushNotification(payload: NotificationPayload): Promise<void> {
    if (!this.registration) {
      throw new Error('Service Worker not registered');
    }

    // In a real app, this would come from your server
    const message = {
      notification: {
        title: payload.title,
        body: payload.message,
        icon: '/logo.png',
        data: payload
      }
    };

    // Dispatch a message to the service worker
    if (this.registration.active) {
      this.registration.active.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: message
      });
    }
  }

  // Clinical notification helpers
  async notifyStepDue(stepTitle: string, patientName: string, stepId: number, planId: number): Promise<void> {
    return this.showLocalNotification({
      title: 'Treatment Step Due',
      message: `${stepTitle} for ${patientName} is due`,
      type: 'reminder',
      stepId,
      planId,
      url: `/treatment-plan-builder?planId=${planId}&stepId=${stepId}`
    });
  }

  async notifyLabResults(patientName: string, testType: string, patientId: number): Promise<void> {
    return this.showLocalNotification({
      title: 'Lab Results Available',
      message: `${testType} results ready for ${patientName}`,
      type: 'info',
      patientId,
      url: `/labs?patientId=${patientId}`
    });
  }

  async notifyUrgentAlert(message: string, patientName: string, patientId: number): Promise<void> {
    return this.showLocalNotification({
      title: 'URGENT: Patient Alert',
      message: `${patientName}: ${message}`,
      type: 'urgent',
      patientId,
      url: `/patients/${patientId}`
    });
  }

  async notifyMedicationDue(medicationName: string, patientName: string, patientId: number): Promise<void> {
    return this.showLocalNotification({
      title: 'Medication Due',
      message: `${medicationName} due for ${patientName}`,
      type: 'reminder',
      patientId,
      url: `/patients/${patientId}#medications`
    });
  }

  async notifySurgeryReminder(procedureName: string, patientName: string, timeUntil: string): Promise<void> {
    return this.showLocalNotification({
      title: 'Surgery Reminder',
      message: `${procedureName} for ${patientName} in ${timeUntil}`,
      type: 'alert',
      url: `/scheduling`
    });
  }

  // Schedule step reminder
  async scheduleStepReminder(stepTitle: string, patientName: string, dueDate: Date, stepId: number, planId: number): Promise<void> {
    // Schedule notification 1 hour before due time
    const reminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000);
    
    if (reminderTime > new Date()) {
      await this.scheduleLocalNotification({
        title: 'Treatment Step Reminder',
        message: `${stepTitle} for ${patientName} is due in 1 hour`,
        type: 'reminder',
        stepId,
        planId,
        scheduledFor: reminderTime,
        url: `/treatment-plan-builder?planId=${planId}&stepId=${stepId}`
      });
    }
  }

  // Get notification status
  getStatus(): {
    supported: boolean;
    permission: NotificationPermission;
    subscribed: boolean;
  } {
    return {
      supported: 'Notification' in window && 'serviceWorker' in navigator,
      permission: 'Notification' in window ? Notification.permission : 'denied',
      subscribed: !!this.subscription
    };
  }

  // Utility function to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
