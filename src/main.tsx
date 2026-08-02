import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';
import { offlineManager } from './services/offlineManager';
import { installPdfTextSanitizer } from './utils/pdfSafeText';

// Guard every PDF in the app against characters jsPDF's built-in fonts cannot
// render. Installed here rather than in a PDF module because twenty modules
// construct jsPDF directly, so coverage must not depend on import order.
installPdfTextSanitizer();

// ─── App Version ─────────────────────────────────────────────
const APP_VERSION = '7.0.0';
console.log(`🚀 Plastic Surgeon Assistant v${APP_VERSION}`);
console.log(`📅 Build: ${new Date().toISOString()}`);

// ─── Service Worker Registration (vite-plugin-pwa injectManifest) ──
let swRegistration: ServiceWorkerRegistration | null = null;
let swUpdateAvailable = false;

// Broadcast channel for SW update events
const swUpdateListeners = new Set<(available: boolean) => void>();
export function onSWUpdate(listener: (available: boolean) => void) {
  swUpdateListeners.add(listener);
  // Immediately notify if already available
  if (swUpdateAvailable) listener(true);
  return () => swUpdateListeners.delete(listener);
}
export function getSWRegistration() { return swRegistration; }

if ('serviceWorker' in navigator) {
  // In dev mode, unregister any existing service workers so they don't
  // intercept Vite's module requests and cause stale-cache errors.
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(r => {
        r.unregister();
        console.log('🧹 Dev mode: unregistered service worker', r.scope);
      });
    });
  }

  // Reload page when a new SW takes control (after user clicks "Update Now")
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  if (!import.meta.env.DEV) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        '/sw.js',
        { type: 'classic', scope: '/', updateViaCache: 'none' }
      );
      swRegistration = registration;
      console.log('✅ Service Worker registered:', registration.scope);

      // ── Check if there's already a waiting SW (e.g. from a previous visit) ──
      if (registration.waiting) {
        swUpdateAvailable = true;
        swUpdateListeners.forEach(l => l(true));
        console.log('🔄 Update was already waiting — prompting user');
      }

      // ── Handle updates ──
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW is installed but waiting to activate
            swUpdateAvailable = true;
            swUpdateListeners.forEach(l => l(true));
            console.log('🔄 New version available — user will be prompted to update');
          }
        });
      });

      // ── Background Sync ──
      if ('sync' in registration) {
        console.log('📡 Background Sync available');
      }

      // ── Periodic Background Sync ──
      if ('periodicSync' in registration) {
        try {
          await (registration as any).periodicSync.register('clinical-data-sync', {
            minInterval: 15 * 60 * 1000, // 15 minutes — clinical data needs frequent updates
          });
          console.log('⏰ Periodic Background Sync registered (15 min interval)');
        } catch {
          console.log('Periodic Background Sync not available');
        }
      }

      // ── Check for update every 5 minutes ──
      setInterval(() => { registration.update().catch(() => {}); }, 5 * 60 * 1000);

      // ── Also check when tab becomes visible ──
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update().catch(() => {});
        }
      });

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });
  } // end if (!import.meta.env.DEV)

  // ── Listen for messages from SW ──
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, synced, failed } = event.data || {};

    switch (type) {
      case 'SYNC_COMPLETE':
      case 'BACKGROUND_SYNC_COMPLETE':
        console.log(`✅ Background sync: ${synced ?? '?'} synced, ${failed ?? 0} failed`);
        // Trigger offlineManager to update pending count
        offlineManager.forceSync().catch(() => {});
        break;
      case 'PERIODIC_SYNC_TRIGGER':
        console.log('⏰ Periodic sync trigger received');
        offlineManager.forceSync().catch(() => {});
        break;
    }
  });

  // ── On reconnection: flush the offline mutation queue ──────────────────
  // NOTE: we deliberately do NOT pre-warm authenticated /api/* endpoints from
  // the page into the SW Cache API. The service worker has no access to the JWT,
  // so a bare fetch of those URLs returns 401 and `cache.addAll` (all-or-nothing)
  // then throws an uncaught "Request failed". The SW's runtime NetworkFirst route
  // already caches real authenticated responses on the first request the app
  // makes, which is the correct place for this. Just drain the queue here.
  window.addEventListener('online', () => {
    offlineManager.forceSync().catch(() => {});
  });

  // ── iOS / Safari foreground sync poller ─────────────────────────────
  // Safari on iOS has NO Background Sync API and NO Periodic Sync API.
  // To keep the offline queue draining, poll every 60s while the tab is
  // visible AND we're online. This is cheap (only fires when queue isn't empty).
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const hasPeriodicSync = swRegistration && 'periodicSync' in swRegistration;
  if (isIOS || !hasPeriodicSync) {
    setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        offlineManager.forceSync().catch(() => {});
      }
    }, 60 * 1000); // every 60s
    console.log('🍎 iOS/no-periodic-sync detected — foreground sync poller enabled (60s)');
  }
}

// Allow SW to skip waiting (called from update banner)
export function activateNewSW() {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

// Manually trigger an update check
export async function checkForUpdates(): Promise<boolean> {
  if (swRegistration) {
    try {
      await swRegistration.update();
      // After update(), check if a new worker is waiting
      if (swRegistration.waiting) {
        swUpdateAvailable = true;
        swUpdateListeners.forEach(l => l(true));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update check failed:', error);
      return false;
    }
  }
  return false;
}

// ─── Initialize offline manager ──────────────────────────────
console.log('🔌 Offline Manager initialized');

// ─── Request persistent storage ──────────────────────────────
// On iOS Safari this may be denied unless called after a user gesture.
// We retry on the first pointerdown if the initial attempt is denied.
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return;
  try {
    const persistent = await navigator.storage.persist();
    console.log(persistent
      ? '💾 Storage: persistent (data will not be evicted)'
      : '⚠️ Storage: best-effort (retry on user gesture)');
    if (!persistent) {
      // Retry once on first user interaction (iOS/Firefox requirement)
      const retry = async () => {
        document.removeEventListener('pointerdown', retry);
        document.removeEventListener('keydown', retry);
        try {
          const p = await navigator.storage.persist();
          if (p) console.log('💾 Storage: persistent granted after user gesture');
        } catch { /* ignore */ }
      };
      document.addEventListener('pointerdown', retry, { once: true });
      document.addEventListener('keydown', retry, { once: true });
    }
  } catch { /* ignore */ }

  // Warn when storage is running low (>90% of quota used)
  try {
    if (navigator.storage.estimate) {
      const { usage = 0, quota = 0 } = await navigator.storage.estimate();
      if (quota > 0 && usage / quota > 0.9) {
        console.warn(`⚠️ Storage usage high: ${(usage / 1024 / 1024).toFixed(1)} MB / ${(quota / 1024 / 1024).toFixed(1)} MB (${((usage / quota) * 100).toFixed(0)}%)`);
      }
    }
  } catch { /* ignore */ }
}
requestPersistentStorage();

// ─── React Query Client ──────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Don't retry when offline — serve cached data immediately
        if (!navigator.onLine) return false;
        // Don't retry 4xx errors (client errors)
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 1 hour offline (increased from 30min)
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false, // Don't refetch when user switches back
      networkMode: 'offlineFirst', // Always return cached data first
      refetchOnReconnect: true,    // Refresh stale data when coming back online
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: (failureCount) => {
        if (!navigator.onLine) return false;
        return failureCount < 1;
      },
    },
  },
});

// ─── Global error handler ────────────────────────────────────
let indexedDBErrorCount = 0;
const MAX_INDEXEDDB_ERRORS = 10; // Raised from 5 — transient errors during sync should not trigger recovery

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  const errorMessage = event.reason?.message || String(event.reason);
  const isIndexedDBError = 
    errorMessage.includes('Internal error opening backing store') ||
    (event.reason?.name === 'DatabaseClosedError' && errorMessage.includes('DatabaseClosedError'));
  
  // Only count genuine corruption signals, not transient UnknownError from concurrent writes
  if (isIndexedDBError) {
    indexedDBErrorCount++;
    console.error(`🚨 IndexedDB error detected (${indexedDBErrorCount}/${MAX_INDEXEDDB_ERRORS})`);
    
    if (indexedDBErrorCount >= MAX_INDEXEDDB_ERRORS) {
      indexedDBErrorCount = -9999;
      
      const shouldRecover = confirm(
        '⚠️ Database Corruption Detected\n\n' +
        'The local database appears to be corrupted.\n\n' +
        'Click OK to automatically fix this issue.\n' +
        'Click Cancel to try manually (Admin → Fix Corrupted Database).'
      );
      
      if (shouldRecover) {
        window.location.href = window.location.origin + '?recover=true';
      }
    }
  }
  
  event.preventDefault();
});

// ─── Render React App ────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
            },
            success: {
              iconTheme: {
                primary: '#0E9F6E',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#DC2626',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

// ─── Start background services AFTER React mounts (dynamically imported) ─────
setTimeout(async () => {
  try {
    const { cmeArticleScheduler } = await import('./services/cmeArticleScheduler');
    cmeArticleScheduler.start();
    console.log('CME Article Scheduler started');
  } catch (error) {
    console.error('Error starting CME Article Scheduler:', error);
  }
  
  try {
    const { medicationDosingService } = await import('./services/medicationDosingService');
    medicationDosingService.startMedicationMonitoring();
    console.log('Medication end date monitoring started');
  } catch (error) {
    console.error('Error starting Medication monitoring:', error);
  }
  
  try {
    const { reviewNotificationService } = await import('./services/reviewNotificationService');
    reviewNotificationService.startMonitoring();
    reviewNotificationService.cleanupOldNotificationMarkers();
    console.log('Review notification monitoring started');
  } catch (error) {
    console.error('Error starting Review notification monitoring:', error);
  }

  try {
    const { mcqGenerationService } = await import('./services/mcqGenerationService');
    await mcqGenerationService.initializeWACSTopics();
    console.log('WACS topics initialized');
    mcqGenerationService.startWeeklyTestNotificationScheduler();
    console.log('MCQ Test Notification Scheduler started');
    mcqGenerationService.autoScheduleNextWeekTest();
  } catch (error) {
    console.error('Error initializing WACS/MCQ services:', error);
  }

  // ── Cross-device sync: Start background pull/push every 2 min ──
  try {
    const { dataSyncService } = await import('./services/dataSyncService');
    // dataSyncService constructor already starts periodic sync,
    // but force an immediate full sync when the app boots
    if (navigator.onLine) {
      dataSyncService.performFullSync().then((r) => {
        console.log(`🔄 Initial cross-device sync: ↑${r.pushed} ↓${r.pulled}`);
      }).catch(() => { /* will retry on next interval */ });
    }
    console.log('Cross-device DataSyncService started');
  } catch (error) {
    console.error('Error starting DataSyncService:', error);
  }
}, 2000);