import { db } from '../db/database';
import { logger } from '../utils/logger';
import { apiClient } from './apiClient';

interface PushSubscriptionData {
  id?: number;
  user_id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  created_at: Date;
}

class PushNotificationService {
  /**
   * The server's VAPID public key. It used to be a hard-coded demo key, which
   * only matched the server by accident; a subscription made with any other
   * key is rejected by the push service when the server sends.
   */
  private async serverKey(): Promise<string | null> {
    try {
      const r: any = await apiClient.get('/push-subscriptions?action=vapid-key', { freshRead: true });
      if (r?.publicKey && r?.configured) return r.publicKey;
    } catch { /* offline */ }
    const fromBuild = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY;
    return fromBuild || null;
  }

  private sameKey(sub: PushSubscription, keyB64: string): boolean {
    const current = sub.options?.applicationServerKey;
    if (!current) return false;
    const a = new Uint8Array(current as ArrayBuffer);
    const b = this.urlBase64ToUint8Array(keyB64);
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }

  // Request notification permission and subscribe to push notifications
  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (!('serviceWorker' in navigator)) {
      console.warn('This browser does not support service workers');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        console.log('✅ Notification permission granted');
        await this.subscribeToPushNotifications();
        return true;
      } else {
        console.log('❌ Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  // Subscribe to push notifications
  async subscribeToPushNotifications(): Promise<void> {
    try {
      const registration = await navigator.serviceWorker.ready;
      const key = await this.serverKey();
      if (!key) {
        logger.warn('Push is not configured on the server — skipping push subscription');
        return;
      }

      // Check if already subscribed — and with the server's key
      let subscription = await registration.pushManager.getSubscription();
      if (subscription && !this.sameKey(subscription, key)) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }

      if (!subscription) {
        // Create new subscription
        const applicationServerKey = this.urlBase64ToUint8Array(key);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey as BufferSource
        });
        console.log('✅ Push notification subscription created');
      }

      // Save subscription to local DB and server
      await this.saveSubscription(subscription);
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
    }
  }

  // Save subscription to database
  private async saveSubscription(subscription: PushSubscription): Promise<void> {
    const subscriptionData: PushSubscriptionData = {
      user_id: localStorage.getItem('userId') || 'anonymous',
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64(subscription.getKey('auth')!)
      },
      created_at: new Date()
    };

    // Save to local DB
    await db.pushSubscriptions.put(subscriptionData as any);

    // Send to server
    try {
      await apiClient.post('/push-subscriptions', subscriptionData);
      logger.log('✅ Push subscription saved to server');
    } catch (error) {
      console.warn('⚠️ Failed to save subscription to server:', error);
    }
  }

  /**
   * On sign-out: stop this device receiving the signed-out user's alerts. Must
   * run while the session token is still present.
   */
  async unsubscribe(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await apiClient.request('/push-subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: sub.endpoint }) } as any).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
    } catch { /* best effort */ }
  }

  // Show local notification with voice announcement
  async showNotification(title: string, options: NotificationOptions & { voiceMessage?: string }): Promise<void> {
    try {
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        
        await registration.showNotification(title, {
          body: options.body,
          icon: options.icon || '/icon-192.png',
          badge: options.badge || '/icon-192.png',
          tag: options.tag || 'default',
          data: options.data,
          requireInteraction: true
        } as NotificationOptions);

        // Play voice announcement
        if (options.voiceMessage) {
          await this.speakMessage(options.voiceMessage);
        }

        console.log('✅ Notification shown:', title);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  // Text-to-speech for voice announcements
  private async speakMessage(message: string): Promise<void> {
    if (!('speechSynthesis' in window)) {
      logger.warn('Speech synthesis not supported');
      return;
    }

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      utterance.onend = () => {
        console.log('✅ Voice message completed');
        resolve();
      };
      
      utterance.onerror = (error) => {
        console.error('Speech synthesis error:', error);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Send notification to all users (called from backend)
  async broadcastToAllUsers(title: string, body: string, voiceMessage: string, data?: any): Promise<void> {
    try {
      await apiClient.post('/notifications/broadcast', {
        title,
        body,
        voiceMessage,
        data
      });
      console.log('✅ Broadcast notification sent to all users');
    } catch (error) {
      console.error('Error broadcasting notification:', error);
    }
  }

  // Notify about new patient registration
  async notifyPatientRegistered(patientName: string, hospitalNumber: string): Promise<void> {
    const title = '👤 New Patient Registered';
    const body = `${patientName} (${hospitalNumber}) has been registered`;
    const voiceMessage = `You have a new patient registered. ${patientName}`;

    // Show local notification
    await this.showNotification(title, {
      body,
      voiceMessage,
      tag: 'patient-registered',
      data: { type: 'patient-registered', hospitalNumber }
    });

    // Broadcast to all users
    await this.broadcastToAllUsers(title, body, voiceMessage, {
      type: 'patient-registered',
      hospitalNumber
    });
  }

  // Notify about new patient admission
  async notifyPatientAdmitted(patientName: string, hospitalNumber: string, ward: string): Promise<void> {
    const title = '🏥 New Patient Admitted';
    const body = `${patientName} (${hospitalNumber}) admitted to ${ward}`;
    const voiceMessage = `You have a new patient admitted. ${patientName} to ${ward}`;

    // Show local notification
    await this.showNotification(title, {
      body,
      voiceMessage,
      tag: 'patient-admitted',
      data: { type: 'patient-admitted', hospitalNumber, ward }
    });

    // Broadcast to all users
    await this.broadcastToAllUsers(title, body, voiceMessage, {
      type: 'patient-admitted',
      hospitalNumber,
      ward
    });
  }

  // Utility functions
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

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }
}

export const pushNotificationService = new PushNotificationService();
