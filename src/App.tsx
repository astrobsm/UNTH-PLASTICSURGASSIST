import { Routes, Route } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { syncService } from './db/syncService';
import { patientService } from './services/patientService';
import ForcePasswordChange from './components/ForcePasswordChange';
import { useAuthStore } from './store/authStore';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SWUpdateBanner } from './components/SWUpdateBanner';
import { notificationService } from './services/notificationBackgroundService';
import { pushNotificationService } from './services/pushNotificationService';
import { initializeCSRFToken } from './utils/csrf';
import { logger } from './utils/logger';

// Auto-retry dynamic imports: if a chunk fails (stale cache after deploy),
// clear caches and reload the page once to get fresh assets.
function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn().catch((error: any) => {
      const hasReloaded = sessionStorage.getItem('chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        // Clear service worker caches
        if ('caches' in window) {
          caches.keys().then(names => names.forEach(name => caches.delete(name)));
        }
        window.location.reload();
        return new Promise(() => {}); // never resolves, page is reloading
      }
      sessionStorage.removeItem('chunk_reload');
      throw error; // re-throw if reload already attempted
    })
  );
}

// Clear the reload flag on successful page load
if (sessionStorage.getItem('chunk_reload')) {
  sessionStorage.removeItem('chunk_reload');
}

// Lazy load pages for better performance (with stale-chunk auto-reload)
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Patients = lazyWithRetry(() => import('./pages/Patients'));
const PatientProfile = lazyWithRetry(() => import('./pages/PatientProfile'));
const TreatmentPlans = lazyWithRetry(() => import('./pages/TreatmentPlans'));
const Procedures = lazyWithRetry(() => import('./pages/Procedures'));
const Labs = lazyWithRetry(() => import('./pages/Labs'));
const Education = lazyWithRetry(() => import('./pages/Education'));
const MCQEducation = lazyWithRetry(() => import('./pages/MCQEducation'));
const TopicManagement = lazyWithRetry(() => import('./pages/TopicManagement'));
const Admin = lazyWithRetry(() => import('./pages/Admin'));
const NotificationManager = lazyWithRetry(() => import('./pages/NotificationManager'));
const TreatmentPlanningPage = lazyWithRetry(() => import('./pages/TreatmentPlanningPage'));
const PatientSummariesPage = lazyWithRetry(() => import('./pages/PatientSummariesPage'));
const PaperworkPage = lazyWithRetry(() => import('./pages/PaperworkPage'));
const MDTPage = lazyWithRetry(() => import('./pages/MDTPage'));
const AdmissionsPage = lazyWithRetry(() => import('./pages/AdmissionsPage'));
const DischargesPage = lazyWithRetry(() => import('./pages/DischargesPage'));
const AdmissionDischargePage = lazyWithRetry(() => import('./pages/AdmissionDischargePage'));
const BloodTransfusionPage = lazyWithRetry(() => import('./pages/BloodTransfusion'));
const WardRoundsPage = lazyWithRetry(() => import('./pages/WardRounds'));
const PatientEducation = lazyWithRetry(() => import('./pages/PatientEducation'));
const ShoppingList = lazyWithRetry(() => import('./pages/ShoppingList'));
const VideoConference = lazyWithRetry(() => import('./pages/VideoConference'));
const ChatRooms = lazyWithRetry(() => import('./pages/ChatRooms'));
const LimbSalvagePage = lazyWithRetry(() => import('./pages/LimbSalvagePage'));
const BurnCarePage = lazyWithRetry(() => import('./pages/BurnCarePage'));
const MedicalTrainingPage = lazyWithRetry(() => import('./pages/MedicalTrainingPage'));
const TreatmentPlanBuilder = lazyWithRetry(() => import('./components/TreatmentPlanBuilder'));
const BookingRegisterPage = lazyWithRetry(() => import('./pages/BookingRegisterPage'));
const PreSurgicalConferencePage = lazyWithRetry(() => import('./pages/PreSurgicalConferencePage'));
const WoundCarePage = lazyWithRetry(() => import('./pages/WoundCarePage'));
const KeloidCarePage = lazyWithRetry(() => import('./pages/KeloidCarePage'));
const SoftTissueInfectionPage = lazyWithRetry(() => import('./pages/SoftTissueInfectionPage'));
const PressureSorePage = lazyWithRetry(() => import('./pages/PressureSorePage'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const DepartmentalMeetingsPage = lazyWithRetry(() => import('./pages/DepartmentalMeetingsPage'));
const PrescriptionsPage = lazyWithRetry(() => import('./pages/PrescriptionsPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
  </div>
);

function App() {
  const location = useLocation();
  const { user, loading, initializeAuth, clearMustChangePassword, logout } = useAuthStore();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Initialize CSRF protection
    initializeCSRFToken();
    logger.log('CSRF token initialized');
    
    initializeAuth();

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Request notification permissions for MCQ reminders and patient notifications
    if (user) {
      notificationService.requestNotificationPermission();
      
      // Request push notification permission and subscribe
      pushNotificationService.requestPermission().then((granted) => {
        if (granted) {
          console.log('✅ Push notifications enabled for patient alerts');
        }
      });
      
      // Sync any unsynced local data when user logs in
      if (navigator.onLine) {
        patientService.syncLocalChanges().catch(err => {
          console.error('Failed to sync local changes:', err);
        });
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [initializeAuth, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-clinical-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-clinical">Loading Plastic Surgeon Assistant...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Login />
      </Suspense>
    );
  }

  // Check if user must change password (for bulk imported users on first login)
  if (user.mustChangePassword) {
    return (
      <ForcePasswordChange
        userId={user.id}
        userName={user.name}
        onPasswordChanged={() => {
          clearMustChangePassword();
        }}
        onLogout={logout}
      />
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <ErrorBoundary>
        <Routes>
        {/* Video Conference - Full screen without Layout */}
        <Route path="/conference" element={<VideoConference />} />
        <Route path="/conference/:roomId" element={<VideoConference />} />
        
        {/* All other routes with Layout */}
        <Route path="/*" element={
          <Layout>
            <SWUpdateBanner />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientProfile />} />
              <Route path="/patients/:id/plans/:planId" element={<TreatmentPlans />} />
              <Route path="/treatment-plan-builder" element={<TreatmentPlanBuilder />} />
              <Route path="/treatment-planning" element={<TreatmentPlanningPage />} />
              <Route path="/patient-summaries" element={<PatientSummariesPage />} />
              <Route path="/paperwork" element={<PaperworkPage />} />
              <Route path="/admissions" element={<AdmissionsPage />} />
              <Route path="/discharges" element={<DischargesPage />} />
              <Route path="/admission-discharge" element={<AdmissionDischargePage />} />
              <Route path="/mdt" element={<MDTPage />} />
              <Route path="/blood-transfusion" element={<BloodTransfusionPage />} />
              <Route path="/ward-rounds" element={<WardRoundsPage />} />
              <Route path="/procedures" element={<Procedures />} />
              <Route path="/booking-register" element={<BookingRegisterPage />} />
              <Route path="/preoperative-planning" element={<BookingRegisterPage />} />
              <Route path="/pre-surgical-conference" element={<PreSurgicalConferencePage />} />
              <Route path="/labs" element={<Labs />} />
              <Route path="/prescriptions" element={<PrescriptionsPage />} />
              <Route path="/patient-education" element={<PatientEducation />} />
              <Route path="/shopping-list" element={<ShoppingList />} />
              <Route path="/limb-salvage" element={<LimbSalvagePage />} />
              <Route path="/burn-care" element={<BurnCarePage />} />
              <Route path="/wound-care" element={<WoundCarePage />} />
              <Route path="/keloid-care" element={<KeloidCarePage />} />
              <Route path="/soft-tissue-infection" element={<SoftTissueInfectionPage />} />
              <Route path="/pressure-sore" element={<PressureSorePage />} />
              <Route path="/medical-training" element={<MedicalTrainingPage />} />
              <Route path="/education" element={<Education />} />
              <Route path="/mcq-education" element={<MCQEducation />} />
              <Route path="/topic-management" element={<TopicManagement />} />
              <Route path="/notifications" element={<NotificationManager />} />
              <Route path="/chat" element={<ChatRooms />} />
              <Route path="/chat/:roomId" element={<ChatRooms />} />
              <Route path="/departmental-meetings" element={<DepartmentalMeetingsPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
            
            {deferredPrompt && (
              <PWAInstallPrompt 
                prompt={deferredPrompt} 
                onInstall={() => setDeferredPrompt(null)} 
              />
            )}
            
            {/* Offline Status Indicator */}
            <OfflineIndicator position="bottom" showSyncButton showDetails />
          </Layout>
        } />
        </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}

export default App;