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
import { notificationService } from './services/notificationBackgroundService';
import { pushNotificationService } from './services/pushNotificationService';
import { initializeCSRFToken } from './utils/csrf';
import { logger } from './utils/logger';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Patients = lazy(() => import('./pages/Patients'));
const PatientProfile = lazy(() => import('./pages/PatientProfile'));
const TreatmentPlans = lazy(() => import('./pages/TreatmentPlans'));
const Procedures = lazy(() => import('./pages/Procedures'));
const Labs = lazy(() => import('./pages/Labs'));
const Education = lazy(() => import('./pages/Education'));
const MCQEducation = lazy(() => import('./pages/MCQEducation'));
const TopicManagement = lazy(() => import('./pages/TopicManagement'));
const Admin = lazy(() => import('./pages/Admin'));
const NotificationManager = lazy(() => import('./pages/NotificationManager'));
const TreatmentPlanningPage = lazy(() => import('./pages/TreatmentPlanningPage'));
const PatientSummariesPage = lazy(() => import('./pages/PatientSummariesPage'));
const PaperworkPage = lazy(() => import('./pages/PaperworkPage'));
const MDTPage = lazy(() => import('./pages/MDTPage'));
const AdmissionsPage = lazy(() => import('./pages/AdmissionsPage'));
const DischargesPage = lazy(() => import('./pages/DischargesPage'));
const AdmissionDischargePage = lazy(() => import('./pages/AdmissionDischargePage'));
const BloodTransfusionPage = lazy(() => import('./pages/BloodTransfusion'));
const WardRoundsPage = lazy(() => import('./pages/WardRounds'));
const PatientEducation = lazy(() => import('./pages/PatientEducation'));
const ShoppingList = lazy(() => import('./pages/ShoppingList'));
const VideoConference = lazy(() => import('./pages/VideoConference'));
const ChatRooms = lazy(() => import('./pages/ChatRooms'));
const LimbSalvagePage = lazy(() => import('./pages/LimbSalvagePage'));
const BurnCarePage = lazy(() => import('./pages/BurnCarePage'));
const MedicalTrainingPage = lazy(() => import('./pages/MedicalTrainingPage'));
const TreatmentPlanBuilder = lazy(() => import('./components/TreatmentPlanBuilder'));
const PreoperativePlanningPage = lazy(() => import('./pages/PreoperativePlanningPage'));
const WoundCarePage = lazy(() => import('./pages/WoundCarePage'));

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
              <Route path="/preoperative-planning" element={<PreoperativePlanningPage />} />
              <Route path="/labs" element={<Labs />} />
              <Route path="/patient-education" element={<PatientEducation />} />
              <Route path="/shopping-list" element={<ShoppingList />} />
              <Route path="/limb-salvage" element={<LimbSalvagePage />} />
              <Route path="/burn-care" element={<BurnCarePage />} />
              <Route path="/wound-care" element={<WoundCarePage />} />
              <Route path="/medical-training" element={<MedicalTrainingPage />} />
              <Route path="/education" element={<Education />} />
              <Route path="/mcq-education" element={<MCQEducation />} />
              <Route path="/topic-management" element={<TopicManagement />} />
              <Route path="/notifications" element={<NotificationManager />} />
              <Route path="/chat" element={<ChatRooms />} />
              <Route path="/chat/:roomId" element={<ChatRooms />} />
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