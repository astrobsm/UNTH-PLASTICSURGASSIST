import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';
import { offlineManager } from './services/offlineManager';

// ─── App Version ─────────────────────────────────────────────
const APP_VERSION = '5.0.0';
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
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js',
        { type: import.meta.env.DEV ? 'module' : 'classic', scope: '/' }
      );
      swRegistration = registration;
      console.log('✅ Service Worker registered:', registration.scope);

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
            minInterval: 60 * 60 * 1000, // 1 hour
          });
          console.log('⏰ Periodic Background Sync registered');
        } catch {
          console.log('Periodic Background Sync not available');
        }
      }

      // ── Check for update every 30 minutes ──
      setInterval(() => { registration.update(); }, 30 * 60 * 1000);

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });

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
}

// Allow SW to skip waiting (called from update banner)
export function activateNewSW() {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Reload once new SW takes over
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

// ─── Initialize offline manager ──────────────────────────────
console.log('🔌 Offline Manager initialized');

// ─── Request persistent storage ──────────────────────────────
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(persistent => {
    console.log(persistent ? '💾 Storage: persistent (data will not be evicted)' : '⚠️ Storage: best-effort');
  });
}

// ─── React Query Client ──────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000,
      // Keep data in cache when offline
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false, // Don't refetch when user switches back
      networkMode: 'offlineFirst', // Always return cached data first
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});

// ─── Global error handler ────────────────────────────────────
let indexedDBErrorCount = 0;
const MAX_INDEXEDDB_ERRORS = 5;

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  const errorMessage = event.reason?.message || String(event.reason);
  const isIndexedDBError = 
    errorMessage.includes('Internal error opening backing store') ||
    errorMessage.includes('DatabaseClosedError') ||
    errorMessage.includes('UnknownError') ||
    (event.reason?.name === 'DatabaseClosedError');
  
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
}, 2000);