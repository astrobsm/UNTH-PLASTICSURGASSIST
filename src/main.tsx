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

// Start services after load
window.addEventListener('load', () => {
  try {
    // Start CME Article Scheduler
    cmeArticleScheduler.start();
    console.log('CME Article Scheduler started');
  } catch (error) {
    console.error('Error starting CME Article Scheduler:', error);
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
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Global error handler for uncaught promises
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault(); // Prevent React error #426
});

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