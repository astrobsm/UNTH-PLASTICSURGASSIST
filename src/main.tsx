import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';
import { cmeArticleScheduler } from './services/cmeArticleScheduler';
import { mcqGenerationService } from './services/mcqGenerationService';
import { offlineManager } from './services/offlineManager';
import { medicationDosingService } from './services/medicationDosingService';
import { reviewNotificationService } from './services/reviewNotificationService';

// Log app version for debugging
const APP_VERSION = '4.0.2';
console.log(`🚀 Plastic Surgeon Assistant v${APP_VERSION}`);
console.log(`📅 Build: ${new Date().toISOString()}`);

// Service Worker Registration for PWA Offline Support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      
      console.log('✅ Service Worker registered successfully:', registration.scope);
      
      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, show update notification
              console.log('🔄 New version available! Please refresh.');
              // Auto-reload after 2 seconds
              setTimeout(() => {
                console.log('♻️ Auto-reloading for update...');
                window.location.reload();
              }, 2000);
            }
          });
        }
      });

      // Request background sync permission if available
      if ('sync' in registration) {
        console.log('📡 Background Sync available');
      }

      // Request periodic background sync if available
      if ('periodicSync' in registration) {
        try {
          await (registration as any).periodicSync.register('clinical-data-sync', {
            minInterval: 60 * 60 * 1000, // 1 hour
          });
          console.log('⏰ Periodic Background Sync registered');
        } catch (error) {
          console.log('Periodic Background Sync not available');
        }
      }
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  });

  // Listen for service worker messages
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('📨 Message from Service Worker:', event.data);
    
    if (event.data.type === 'SYNC_COMPLETE') {
      console.log('✅ Background sync completed');
    }
  });
}

// Initialize offline manager
console.log('🔌 Offline Manager initialized');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Global error handler for uncaught promises
let indexedDBErrorCount = 0;
const MAX_INDEXEDDB_ERRORS = 5;

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // Detect IndexedDB corruption errors
  const errorMessage = event.reason?.message || String(event.reason);
  const isIndexedDBError = 
    errorMessage.includes('Internal error opening backing store') ||
    errorMessage.includes('DatabaseClosedError') ||
    errorMessage.includes('UnknownError') ||
    (event.reason?.name === 'DatabaseClosedError');
  
  if (isIndexedDBError) {
    indexedDBErrorCount++;
    console.error(`🚨 IndexedDB error detected (${indexedDBErrorCount}/${MAX_INDEXEDDB_ERRORS})`);
    
    // After several errors, show recovery prompt
    if (indexedDBErrorCount >= MAX_INDEXEDDB_ERRORS) {
      // Only show once
      indexedDBErrorCount = -9999;
      
      const shouldRecover = confirm(
        '⚠️ Database Corruption Detected\\n\\n' +
        'The local database appears to be corrupted. This can happen after browser updates or storage issues.\\n\\n' +
        'Click OK to automatically fix this issue.\\n' +
        'Click Cancel to try manually (Admin → Fix Corrupted Database).'
      );
      
      if (shouldRecover) {
        window.location.href = window.location.origin + '?recover=true';
      }
    }
  }
  
  event.preventDefault(); // Prevent React error #426
});

// Render React app first
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

// Start services AFTER React has mounted (prevents error #426)
setTimeout(() => {
  try {
    // Start CME Article Scheduler
    cmeArticleScheduler.start();
    console.log('CME Article Scheduler started');
  } catch (error) {
    console.error('Error starting CME Article Scheduler:', error);
  }
  
  try {
    // Start Medication End Date Monitoring
    medicationDosingService.startMedicationMonitoring();
    console.log('Medication end date monitoring started');
  } catch (error) {
    console.error('Error starting Medication monitoring:', error);
  }
  
  try {
    // Start Review Notification Monitoring
    reviewNotificationService.startMonitoring();
    reviewNotificationService.cleanupOldNotificationMarkers();
    console.log('Review notification monitoring started');
  } catch (error) {
    console.error('Error starting Review notification monitoring:', error);
  }

  // Initialize WACS topics and start MCQ test notification scheduler
  mcqGenerationService.initializeWACSTopics().then(() => {
    console.log('WACS topics initialized');
    
    try {
      // Start weekly test notification scheduler (Tuesday 9:30 AM)
      mcqGenerationService.startWeeklyTestNotificationScheduler();
      console.log('MCQ Test Notification Scheduler started');
      
      // Auto-schedule next week's test if none exists
      mcqGenerationService.autoScheduleNextWeekTest();
    } catch (error) {
      console.error('Error starting MCQ scheduler:', error);
    }
  }).catch(error => {
    console.error('Error initializing WACS topics:', error);
  });
}, 100); // Delay 100ms to ensure React is fully mounted