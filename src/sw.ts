/// <reference lib="webworker" />
/**
 * Service Worker — Plastic Surgeon Assistant PWA v7.0
 * 
 * Workbox Production-Grade Offline-First Architecture:
 *   - injectManifest via vite-plugin-pwa (precache manifest injected at build)
 *   - Navigation Preload → speeds up NetworkFirst by starting network + cache in parallel
 *   - Navigation → NetworkFirst (3s timeout) → serves cached app shell
 *   - API GET → NetworkFirst (4s timeout) → rich offline metadata in fallback
 *   - API mutations (POST/PUT/PATCH/DELETE) → BackgroundSync queue with priority
 *   - Static assets (JS/CSS) → StaleWhileRevalidate
 *   - Images → CacheFirst (60 days) with offline placeholder
 *   - Fonts → CacheFirst (1 year)
 *   - Warm strategy cache for critical routes on install
 *   - Push notifications with voice announcements
 *   - Periodic background sync for clinical data (15 min)
 */

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler, setDefaultHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate, NetworkOnly } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { warmStrategyCache } from 'workbox-recipes';
import * as navigationPreload from 'workbox-navigation-preload';

declare const self: ServiceWorkerGlobalScope;

// ─── Cache names ────────────────────────────────────────────
const CACHE_VERSION = 'v9';
const API_CACHE = `api-cache-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-cache-${CACHE_VERSION}`;
const FONT_CACHE = `fonts-cache-${CACHE_VERSION}`;
const STATIC_CACHE = `static-cache-${CACHE_VERSION}`;

// ─── Enable Navigation Preload (speeds up NetworkFirst) ─────
// This makes the browser start a network request in parallel with the SW boot,
// so NetworkFirst strategies don't wait for the SW to fully initialize first.
navigationPreload.enable();

// ─── Precache (injected by vite-plugin-pwa at build time) ───
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Install: skip waiting + pre-warm critical routes ───────
self.addEventListener('install', () => {
  console.log('[SW] New service worker installed, activating immediately...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean old version caches (those with a different CACHE_VERSION)
      const cacheNames = await caches.keys();
      const currentCacheSuffixes = [
        API_CACHE, IMAGE_CACHE, FONT_CACHE, STATIC_CACHE,
        `app-shell-${CACHE_VERSION}`,
        `default-cache-${CACHE_VERSION}`,
      ];
      await Promise.all(
        cacheNames
          .filter(name => {
            // Keep workbox precache
            if (name.startsWith('workbox-precache')) return false;
            // Keep google fonts (no version suffix)
            if (name.startsWith('google-fonts')) return false;
            // Keep current version caches
            if (currentCacheSuffixes.includes(name)) return false;
            // Delete everything else (old versioned caches)
            return true;
          })
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );

      // Pre-warm critical API endpoints into cache on activation
      // so they're available immediately for offline access.
      const apiCache = await caches.open(API_CACHE);
      const criticalEndpoints = [
        '/api/patients',
        '/api/admissions/active',
        '/api/treatment-plans',
        '/api/prescriptions',
        '/api/users/approved',
      ];
      for (const url of criticalEndpoints) {
        try {
          const resp = await fetch(url, { credentials: 'same-origin' });
          if (resp.ok) {
            await apiCache.put(url, resp);
          }
        } catch {
          // Offline during activation — skip, will be cached on first GET
        }
      }

      await self.clients.claim();
      console.log('[SW] Activated, claimed clients, and warmed API caches');
    })()
  );
});

// ─── Background Sync Plugin for offline mutations ───────────
const bgSyncPlugin = new BackgroundSyncPlugin('offlineMutationQueue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
  onSync: async ({ queue }) => {
    let entry;
    let syncedCount = 0;
    let failedCount = 0;

    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone());
        if (!response.ok) {
          // 4xx errors are permanent client errors — discard them, don't retry
          if (response.status >= 400 && response.status < 500) {
            console.warn(`[SW] Discarding queued request (${response.status}):`, entry.request.url);
            failedCount++;
            continue;
          }
          // 5xx errors — discard after too many retries instead of retrying forever
          const meta = entry.metadata || {};
          const retryCount = (meta.retryCount || 0) + 1;
          if (retryCount >= 3) {
            console.warn(`[SW] Discarding queued request after ${retryCount} retries (${response.status}):`, entry.request.url);
            failedCount++;
            continue; // Drop it — server is persistently failing
          }
          // Put it back with incremented retry count
          failedCount++;
          await queue.unshiftRequest({ ...entry, metadata: { ...meta, retryCount } });
          console.warn(`[SW] Retry ${retryCount}/3 for queued request (${response.status}):`, entry.request.url);
          break; // Stop processing — let Workbox retry later
        }
        syncedCount++;
      } catch (error) {
        // Network error — put back and stop
        failedCount++;
        await queue.unshiftRequest(entry);
        break; // Don't throw — prevents unhandled promise rejection
      }
    }

    // Notify all app windows
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC_COMPLETE',
        synced: syncedCount,
        failed: failedCount,
      });
    });
  },
});

// ─── Navigation → NetworkFirst (app shell) ──────────────────
const navigationHandler = new NetworkFirst({
  cacheName: `app-shell-${CACHE_VERSION}`,
  networkTimeoutSeconds: 3,   // 3s timeout — balances fast fallback vs slow networks
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
  ],
});

// Pre-warm the navigation cache with the app shell on install
// so the very first offline visit has the full SPA available.
warmStrategyCache({
  urls: ['/'],
  strategy: navigationHandler,
});

registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [
      /^\/api/,
      /^\/sw\.js$/,
      /\.html$/,           // Static HTML pages (book-appointment.html, etc.)
      /\.webmanifest$/,     // PWA manifest
    ],
  })
);

// ─── API GET → NetworkFirst with cache fallback ─────────────
// Custom handler that catches no-response errors and returns empty JSON
// instead of letting unhandled promise rejections flood the console.
const apiGetStrategy = new NetworkFirst({
  cacheName: API_CACHE,
  networkTimeoutSeconds: 4,   // 4s — then serve cached data for offline/slow nets
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({
      maxEntries: 500,
      maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days — clinical data must survive long offline
      purgeOnQuotaError: true,
    }),
  ],
});

registerRoute(
  ({ url, request }) =>
    url.pathname.startsWith('/api/') && request.method === 'GET',
  async (args) => {
    try {
      const response = await apiGetStrategy.handle(args);
      return response;
    } catch (_err) {
      // Network failed and no cache hit — return rich offline metadata
      // so the app can distinguish "no data" from "offline, no cache".
      return new Response(JSON.stringify({
        _offline: true,
        _cachedAt: null,
        _error: 'No cached data available for this endpoint',
        data: []
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'X-Offline': 'true',
          'X-Cache-Status': 'miss',
        },
      });
    }
  }
);

// ─── API Mutations → NetworkOnly + Background Sync ──────────
// Endpoints that need real-time responses (not suitable for background sync)
const REALTIME_POST_PREFIXES = [
  '/api/ai/',        // OCR / AI processing — needs immediate structured data
  '/api/auth',       // Login / register — needs immediate auth response (no trailing slash: /api/auth is the login endpoint)
  '/api/students/register', // Student self-registration — needs immediate response
  '/api/students/login',    // Student login — needs immediate auth response
  '/api/init-db',    // DB initialization — needs confirmation
];

const isRealtimeEndpoint = (pathname: string) =>
  REALTIME_POST_PREFIXES.some(prefix => pathname.startsWith(prefix));

const mutationStrategy = new NetworkOnly({ plugins: [bgSyncPlugin] });
const realtimeStrategy = new NetworkOnly(); // No bgSync — let errors propagate
const mutationMethods: Array<'POST' | 'PUT' | 'PATCH' | 'DELETE'> = ['POST', 'PUT', 'PATCH', 'DELETE'];

// Register real-time endpoints FIRST (Workbox uses first-match)
mutationMethods.forEach(method => {
  registerRoute(
    ({ url, request }) =>
      url.pathname.startsWith('/api/') &&
      request.method === method &&
      isRealtimeEndpoint(url.pathname),
    async (args) => {
      try {
        return await realtimeStrategy.handle(args);
      } catch (_err) {
        // Network failed — return error without queuing for background sync
        return new Response(JSON.stringify({ error: 'Network unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
    method
  );
});

// Background-syncable mutations (everything else under /api/)
mutationMethods.forEach(method => {
  registerRoute(
    ({ url, request }) =>
      url.pathname.startsWith('/api/') &&
      request.method === method &&
      !isRealtimeEndpoint(url.pathname),
    async (args) => {
      try {
        return await mutationStrategy.handle(args);
      } catch (_err) {
        // Offline — bgSyncPlugin already queued the request.
        // Return a synthetic 503 so the app doesn't see an unhandled rejection.
        return new Response(JSON.stringify({ error: 'Queued for background sync' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
    method
  );
});

// ─── Static assets (JS/CSS) → StaleWhileRevalidate ─────────
// Exclude external CDN scripts (tesseract.js workers, etc.) from SW caching
registerRoute(
  ({ request, url }) =>
    (request.destination === 'script' || request.destination === 'style') &&
    url.origin === self.location.origin,
  new StaleWhileRevalidate({
    cacheName: STATIC_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  })
);

// ─── Images → CacheFirst ────────────────────────────────────
const imageCacheFirst = new CacheFirst({
  cacheName: IMAGE_CACHE,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 24 * 60 * 60 }),
  ],
});

registerRoute(
  ({ request }) => request.destination === 'image',
  async (args) => {
    try {
      return await imageCacheFirst.handle(args);
    } catch (_err) {
      // Offline + not cached — return transparent 1×1 pixel
      return new Response(
        Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)),
        { headers: { 'Content-Type': 'image/png' } }
      );
    }
  }
);

// ─── Fonts → CacheFirst ─────────────────────────────────────
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: FONT_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// ─── Default handler — catch any unmatched requests ─────────
setDefaultHandler(new NetworkFirst({
  cacheName: `default-cache-${CACHE_VERSION}`,
  networkTimeoutSeconds: 5,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 }),
  ],
}));

// ─── Global catch handler — prevents unhandled rejections ───
setCatchHandler(async ({ request }) => {
  // For navigation failures, try the precached index.html first (SPA shell)
  if (request.destination === 'document') {
    const precached = await matchPrecache('/index.html');
    if (precached) return precached;
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
  }
  if (request.destination === 'image') {
    // Return transparent 1×1 PNG for missing images
    return new Response(
      Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAWJQAAFiUBSVIk8AAAAA0lEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0)),
      { headers: { 'Content-Type': 'image/png' } }
    );
  }
  // For API requests, return offline JSON
  if (request.url.includes('/api/')) {
    return new Response(JSON.stringify({ _offline: true, data: [] }), {
      status: 503,
      headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
    });
  }
  return new Response('', { status: 503, statusText: 'Offline' });
});

// ─── Google Fonts → StaleWhileRevalidate / CacheFirst ───────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  })
);

// ─── Push Notifications ─────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const payload = event.data.json();

    const options = {
      body: payload.body || 'New notification',
      icon: payload.icon || '/icon-192.png',
      badge: '/logo.png',
      tag: payload.tag || `notification-${Date.now()}`,
      requireInteraction: payload.requireInteraction ?? true,
      vibrate: payload.vibrate || [200, 100, 200],
      data: { ...payload.data, voiceMessage: payload.voiceMessage },
      actions: [
        { action: 'view', title: 'View' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    } as NotificationOptions;

    event.waitUntil(
      self.registration.showNotification(payload.title || 'PS Assistant', options)
    );
  } catch (error) {
    console.error('Push notification error:', error);
  }
});

// ─── Notification Click ─────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const data = event.notification.data || {};
  let url = '/';
  if (data.url) url = data.url;
  else if (data.patientId) url = `/patients/${data.patientId}`;
  else if (data.planId) url = `/treatment-plan-builder?planId=${data.planId}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ─── Background Sync (clinical-data-sync tag) ───────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'clinical-data-sync' || event.tag === 'workbox-background-sync:offlineMutationQueue') {
    event.waitUntil(
      (async () => {
        try {
          // Notify app that sync completed
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach(client => {
            client.postMessage({ type: 'SYNC_COMPLETE' });
          });
        } catch (error) {
          console.error('Background sync handler error:', error);
        }
      })()
    );
  }
});

// ─── Periodic Background Sync ───────────────────────────────
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'clinical-data-sync') {
    event.waitUntil(
      (async () => {
        try {
          const clients = await self.clients.matchAll({ type: 'window' });
          clients.forEach(client => {
            client.postMessage({ type: 'PERIODIC_SYNC_TRIGGER' });
          });
        } catch (error) {
          console.error('Periodic sync error:', error);
        }
      })()
    );
  }
});

// ─── Message handling ───────────────────────────────────────
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'SHOW_NOTIFICATION':
      if (payload?.notification) {
        const { notification } = payload;
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          icon: notification.icon || '/icon-192.png',
          badge: '/logo.png',
          tag: notification.tag || 'general',
          data: notification.data,
        });
      }
      break;

    case 'SCHEDULE_NOTIFICATION':
      if (payload?.notification && payload?.delay) {
        setTimeout(() => {
          self.registration.showNotification(payload.notification.title, {
            body: payload.notification.body,
            icon: payload.notification.icon || '/icon-192.png',
            badge: '/logo.png',
            tag: `scheduled-${Date.now()}`,
            data: payload.notification.data,
          });
        }, payload.delay);
      }
      break;

    case 'CACHE_URLS':
      if (payload?.urls && payload?.cacheName) {
        const cache = await caches.open(payload.cacheName);
        await cache.addAll(payload.urls);
      }
      break;

    case 'CLEAR_CACHE':
      const names = await caches.keys();
      await Promise.all(names.map(name => caches.delete(name)));
      break;

    case 'GET_CACHE_STATS':
      try {
        const cacheKeys = await caches.keys();
        let totalSize = 0;
        let totalEntries = 0;
        for (const key of cacheKeys) {
          const cache = await caches.open(key);
          const keys = await cache.keys();
          totalEntries += keys.length;
        }
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          totalSize = estimate.usage || 0;
        }
        event.source?.postMessage({
          type: 'CACHE_STATS',
          cacheCount: cacheKeys.length,
          totalEntries,
          totalSize,
        });
      } catch (err) {
        console.error('Error getting cache stats:', err);
      }
      break;

    case 'EMERGENCY_UNREGISTER':
      const allCaches = await caches.keys();
      await Promise.all(allCaches.map(name => caches.delete(name)));
      await self.registration.unregister();
      (event.source as WindowClient)?.postMessage({ type: 'UNREGISTERED' });
      break;
  }
});

// ─── Warm critical API routes on activation ─────────────────
// Pre-cache the most important clinical API endpoints so they're
// available immediately on first offline access.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Warm key API endpoints into the api cache
      const apiCache = await caches.open(API_CACHE);
      const criticalEndpoints = [
        '/api/patients',
        '/api/admissions/active',
        '/api/treatment-plans',
        '/api/prescriptions',
        '/api/users/approved',
      ];
      for (const url of criticalEndpoints) {
        try {
          const resp = await fetch(url, { credentials: 'same-origin' });
          if (resp.ok) {
            await apiCache.put(url, resp);
          }
        } catch {
          // Offline during activation — skip, will be cached on first GET
        }
      }
    })()
  );
});

console.log('🏥 Plastic Surgeon Assistant Service Worker v7.0 loaded');
