// Enhanced Service Worker with Notification Support and Offline Sync
// Use importScripts for service worker compatibility
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst, StaleWhileRevalidate } = workbox.strategies;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { ExpirationPlugin } = workbox.expiration;

// Cache names
const CACHE_VERSION = 'v2';
const API_CACHE = `api-cache-${CACHE_VERSION}`;
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-cache-${CACHE_VERSION}`;

// Precache app shell and assets
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// Background sync plugin for offline mutations
const bgSyncPlugin = new BackgroundSyncPlugin('offlineQueue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  onSync: async ({ queue }) => {
    let entry;
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request.clone());
        console.log('Replay successful for request:', entry.request.url);
      } catch (error) {
        console.error('Replay failed for request:', entry.request.url, error);
        await queue.unshiftRequest(entry);
        throw error;
      }
    }
    console.log('Background sync complete');
  }
});

// Cache API GET responses with NetworkFirst strategy
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24 hours
      }),
    ],
  })
);

// Queue API POST/PUT/PATCH/DELETE for background sync when offline
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'PUT',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [bgSyncPlugin],
  }),
  'PUT'
);

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'PATCH',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [bgSyncPlugin],
  }),
  'PATCH'
);

registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'DELETE',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 10,
    plugins: [bgSyncPlugin],
  }),
  'DELETE'
);

// Cache images with CacheFirst strategy
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Cache static assets with StaleWhileRevalidate
registerRoute(
  ({ request }) => ['script', 'style', 'font'].includes(request.destination),
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
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