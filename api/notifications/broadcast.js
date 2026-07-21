// Notifications Broadcast API endpoint for Vercel serverless
import { query } from '../_lib/db.js';
import { cors, authenticateRequest } from '../_lib/auth.js';
import webpush from 'web-push';

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LhPVhJveYTGq-eAqD1Qj2HhVBNvRfGLr1JiOF0j-T_Hxxw';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
if (!vapidPrivateKey) {
  console.error('WARNING: VAPID_PRIVATE_KEY env var not set. Push notifications will fail.');
}

if (vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:admin@plasticsurgeryassistant.com',
    vapidPublicKey,
    vapidPrivateKey
  );
}

export default async function handler(req, res) {
  if (cors(req, res)) return;

  const auth = authenticateRequest(req);
  if (!auth.authenticated) {
    return res.status(auth.status || 401).json({ error: auth.error });
  }

  // Fans out to EVERY registered device with requireInteraction:true. Restrict
  // to senior clinical staff — previously any authenticated account could
  // broadcast an arbitrary notification department-wide.
  if (!['admin', 'super_admin', 'consultant', 'senior_registrar'].includes(auth.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions to broadcast notifications' });
  }

  const { method } = req;

  try {
    if (method === 'POST') {
      return await broadcastNotification(req.body, res);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Notifications Broadcast API error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}

async function broadcastNotification(data, res) {
  const { title, body, voiceMessage, data: notificationData } = data;

  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }

  try {
    // First, ensure the push_subscriptions table exists
    await query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        endpoint TEXT NOT NULL,
        keys JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get all active push subscriptions
    const result = await query(
      'SELECT * FROM push_subscriptions WHERE is_active = true'
    );

    const subscriptions = result.rows || [];
    
    // If no subscriptions, return success with 0 sent
    if (subscriptions.length === 0) {
      return res.status(200).json({
        message: 'Broadcast completed - no active subscriptions',
        totalSubscriptions: 0,
        successCount: 0,
        failureCount: 0,
        results: []
      });
    }

    const notificationPayload = JSON.stringify({
      title,
      body,
      voiceMessage,
      data: notificationData,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      vibrate: [200, 100, 200],
      tag: notificationData?.type || 'default',
      requireInteraction: true
    });

  // Send push notifications to all subscribers
  const sendPromises = subscriptions.map(async (subscription) => {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: typeof subscription.keys === 'string' 
          ? JSON.parse(subscription.keys) 
          : subscription.keys
      };

      await webpush.sendNotification(pushSubscription, notificationPayload);
      console.log('✅ Push notification sent to:', subscription.user_id);
      return { success: true, userId: subscription.user_id };
    } catch (error) {
      console.error('Failed to send push notification to:', subscription.user_id, error);
      
      // If subscription is no longer valid, mark it as inactive
      if (error.statusCode === 410) {
        await query(
          'UPDATE push_subscriptions SET is_active = false WHERE id = $1',
          [subscription.id]
        );
      }
      
      return { success: false, userId: subscription.user_id, error: error.message };
    }
  });

  const results = await Promise.all(sendPromises);
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  res.status(200).json({
    message: 'Broadcast completed',
    totalSubscriptions: subscriptions.length,
    successCount,
    failureCount,
    results
  });
  } catch (error) {
    console.error('Broadcast notification error:', error);
    return res.status(500).json({ 
      error: 'Failed to broadcast notification', 
      message: error.message 
    });
  }
}
