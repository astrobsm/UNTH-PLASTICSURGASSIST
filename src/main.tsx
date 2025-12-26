import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import App from './App.tsx';
import './index.css';
import { cmeArticleScheduler } from './services/cmeArticleScheduler';
import { mcqGenerationService } from './services/mcqGenerationService';

// Service Worker registration - TEMPORARILY DISABLED FOR CACHE CLEARING
if ('serviceWorker' in navigator) {
  // Unregister any existing service workers
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (let registration of registrations) {
      registration.unregister();
      console.log('Unregistered old service worker');
    }
  });
}

// Start services without service worker
window.addEventListener('load', () => {
  // Start CME Article Scheduler
  cmeArticleScheduler.start();
  console.log('CME Article Scheduler started');

  // Initialize WACS topics and start MCQ test notification scheduler
  mcqGenerationService.initializeWACSTopics().then(() => {
    console.log('WACS topics initialized');
    
    // Start weekly test notification scheduler (Tuesday 9:30 AM)
    mcqGenerationService.startWeeklyTestNotificationScheduler();
    console.log('MCQ Test Notification Scheduler started');
    
    // Auto-schedule next week's test if none exists
    mcqGenerationService.autoScheduleNextWeekTest();
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