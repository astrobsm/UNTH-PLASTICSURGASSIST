// Enhanced Service Worker with Full Offline Support
// Plastic Surgeon Assistant PWA - Version 3.0
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;
const { registerRoute } = workbox.routing;
const { NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly } = workbox.strategies;
const { BackgroundSyncPlugin } = workbox.backgroundSync;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;

// Cache version - increment to force cache update
const CACHE_VERSION = 'v3';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const API_CACHE = `api-cache-${CACHE_VERSION}`;
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-cache-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-cache-${CACHE_VERSION}`;

// Precache app shell and critical assets
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ============================================
// BACKGROUND SYNC FOR OFFLINE MUTATIONS
// ============================================

const bgSyncPlugin = new BackgroundSyncPlugin('offlineQueue', {
  maxRetentionTime: 24 * 60, // Retry for up to 24 hours (in minutes)
  onSync: async ({ queue }) => {
    console.log('🔄 Background sync starting...');
    let entry;
    let syncedCount = 0;
    let failedCount = 0;

    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (response.ok) {
          syncedCount++;
          console.log('✅ Synced:', entry.request.url);
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Sync failed:', entry.request.url, error);
        failedCount++;
        await queue.unshiftRequest(entry);
        throw error;
      }
    }

    console.log(`📊 Background sync complete: ${syncedCount} synced, ${failedCount} failed`);

    // Notify the app
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          synced: syncedCount,
          failed: failedCount
        });
      });
    });
  }
});

// ============================================
// NAVIGATION - ALWAYS SERVE APP SHELL
// ============================================

// For navigation requests, serve the app shell (index.html)
const navigationHandler = new NetworkFirst({
  cacheName: APP_SHELL_CACHE,
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
});

registerRoute(
  ({ request }) => request.mode === 'navigate',
  navigationHandler
);

// ============================================
// API ROUTES - OFFLINE FIRST WITH CACHING
// ============================================

// API GET requests - Network first with cache fallback
registerRoute(
  ({ url, request }) => 
    (url.pathname.startsWith('/api/') || url.origin.includes('localhost:3001')) && 
    request.method === 'GET',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);

// API mutations - Queue for background sync when offline
registerRoute(
  ({ url, request }) => 
    (url.pathname.startsWith('/api/') || url.origin.includes('localhost:3001')) && 
    request.method === 'POST',
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
);

registerRoute(
  ({ url, request }) => 
    (url.pathname.startsWith('/api/') || url.origin.includes('localhost:3001')) && 
    request.method === 'PUT',
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'PUT'
);

registerRoute(
  ({ url, request }) => 
    (url.pathname.startsWith('/api/') || url.origin.includes('localhost:3001')) && 
    request.method === 'PATCH',
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'PATCH'
);

registerRoute(
  ({ url, request }) => 
    (url.pathname.startsWith('/api/') || url.origin.includes('localhost:3001')) && 
    request.method === 'DELETE',
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'DELETE'
);

// ============================================
// STATIC ASSETS - CACHE FIRST
// ============================================

// JavaScript and CSS files
registerRoute(
  ({ request }) => 
    request.destination === 'script' || 
    request.destination === 'style',
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Images
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: IMAGE_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 days
      }),
    ],
  })
);

// Fonts
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: FONT_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
);

// ============================================
// INSTALL - CACHE CRITICAL RESOURCES
// ============================================

self.addEventListener('install', (event) => {
  console.log('📦 Service Worker installing...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      
      const criticalResources = [
        '/',
        '/index.html',
        '/manifest.json',
        '/logo.png',
        '/icon-192.png',
        '/icon-512.png',
      ];
      
      await Promise.all(
        criticalResources.map(async (url) => {
          try {
            await cache.add(url);
          } catch (error) {
            console.log(`Failed to cache ${url}:`, error);
          }
        })
      );
      
      console.log('✅ Critical resources cached');
    })()
  );
  
  self.skipWaiting();
});

// ============================================
// ACTIVATE - CLEANUP OLD CACHES
// ============================================

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const validCaches = [APP_SHELL_CACHE, API_CACHE, STATIC_CACHE, IMAGE_CACHE, FONT_CACHE];
      
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          if (!validCaches.includes(cacheName) && 
              !cacheName.startsWith('workbox-precache')) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            await caches.delete(cacheName);
          }
        })
      );
      
      await self.clients.claim();
      console.log('✅ Service Worker activated');
    })()
  );
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================

self.addEventListener('push', (event) => {
  console.log('📬 Push notification received');
  
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const { notification } = data;
    
    const options = {
      body: notification.body || 'New notification',
      icon: notification.icon || '/logo.png',
      badge: '/logo.png',
      tag: `clinical-${notification.data?.type || 'info'}-${Date.now()}`,
      requireInteraction: notification.data?.type === 'urgent',
      vibrate: notification.data?.type === 'urgent' ? [200, 100, 200] : [100],
      data: notification.data,
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(notification.title || 'PS Assistant', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// ============================================
// NOTIFICATION CLICK
// ============================================

self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const data = event.notification.data || {};
  let url = '/';
  
  if (data.url) {
    url = data.url;
  } else if (data.patientId) {
    url = `/patients/${data.patientId}`;
  } else if (data.planId) {
    url = `/treatment-plan-builder?planId=${data.planId}`;
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// ============================================
// BACKGROUND SYNC EVENTS
// ============================================

self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync event:', event.tag);
  
  if (event.tag === 'clinical-data-sync') {
    event.waitUntil(
      fetch('/api/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(response => {
          console.log('✅ Sync completed:', response.status);
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'SYNC_COMPLETE' });
            });
          });
        })
        .catch(error => {
          console.error('❌ Sync failed:', error);
          throw error;
        })
    );
  }
});

// ============================================
// PERIODIC BACKGROUND SYNC
// ============================================

self.addEventListener('periodicsync', (event) => {
  console.log('⏰ Periodic sync event:', event.tag);
  
  if (event.tag === 'clinical-data-sync') {
    event.waitUntil(
      fetch('/api/sync', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
        .then(() => console.log('✅ Periodic sync completed'))
        .catch(error => console.error('❌ Periodic sync failed:', error))
    );
  }
});

// ============================================
// MESSAGE HANDLING
// ============================================

self.addEventListener('message', (event) => {
  console.log('📨 Message received:', event.data);
  
  const { type, payload } = event.data;
  
  switch (type) {
    case 'SHOW_NOTIFICATION':
      if (payload?.notification) {
        const { notification } = payload;
        self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/logo.png',
          badge: '/logo.png',
          tag: notification.tag || 'general',
          data: notification.data
        });
      }
      break;
      
    case 'SCHEDULE_NOTIFICATION':
      if (payload?.notification && payload?.delay) {
        const { notification, delay } = payload;
        setTimeout(() => {
          self.registration.showNotification(notification.title, {
            body: notification.body,
            icon: notification.icon || '/logo.png',
            badge: '/logo.png',
            tag: `scheduled-${Date.now()}`,
            data: notification.data
          });
        }, delay);
      }
      break;
      
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      if (payload?.urls && payload?.cacheName) {
        caches.open(payload.cacheName).then(cache => {
          cache.addAll(payload.urls);
        });
      }
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
      break;
  }
});

console.log('🏥 Plastic Surgeon Assistant Service Worker loaded - Version 3.0');