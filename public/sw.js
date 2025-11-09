// Enhanced Service Worker with Notification Support
// Use importScripts for service worker compatibility
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst } = workbox.strategies;

// Precache app shell and assets
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Cache API responses
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
  })
);

// Cache images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
  })
);

// Handle push events (Web Push notifications)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  if (event.data) {
    const data = event.data.json();
    const { notification } = data;
    
    const options = {
      body: notification.body,
      icon: notification.icon || '/logo.png',
      badge: '/logo.png',
      tag: `clinical-${notification.data?.type || 'info'}`,
      requireInteraction: notification.data?.type === 'urgent',
      data: notification.data,
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
    };
    
    event.waitUntil(
      self.registration.showNotification(notification.title, options)
    );
  }
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const { action, notification } = event;
  const data = notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  // Handle view action or notification click
  let url = '/';
  if (data?.url) {
    url = data.url;
  } else if (data?.patientId) {
    url = `/patients/${data.patientId}`;
  } else if (data?.planId) {
    url = `/treatment-plan-builder?planId=${data.planId}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window if app is not open
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync event:', event.tag);
  
  if (event.tag === 'clinical-data-sync') {
    event.waitUntil(
      // This would trigger the sync service
      fetch('/api/sync', { method: 'POST' })
        .then(response => console.log('Sync completed:', response))
        .catch(error => console.error('Sync failed:', error))
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('Service worker message:', event.data);
  
  const { type, payload } = event.data;
  
  if (type === 'SHOW_NOTIFICATION') {
    const { notification } = payload;
    
    const options = {
      body: notification.body,
      icon: notification.icon || '/medical-cross.svg',
      badge: '/medical-cross.svg',
      tag: `clinical-${notification.data?.type || 'info'}`,
      requireInteraction: notification.data?.type === 'urgent',
      data: notification.data,
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
    };
    
    self.registration.showNotification(notification.title, options);
  }
  
  if (type === 'SCHEDULE_NOTIFICATION') {
    // Store scheduled notification data
    const { notification, delay } = payload;
    
    setTimeout(() => {
      const options = {
        body: notification.body,
        icon: notification.icon || '/medical-cross.svg',
        badge: '/medical-cross.svg',
        tag: `scheduled-${Date.now()}`,
        data: notification.data
      };
      
      self.registration.showNotification(notification.title, options);
    }, delay);
  }
});

// Install event
self.addEventListener('install', (event) => {
  console.log('Service worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service worker activating...');
  event.waitUntil(self.clients.claim());
});