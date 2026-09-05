import { Routes, Route } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { patientService } from './services/patientService';
import ForcePasswordChange from './components/ForcePasswordChange';
import HOResponsibilitiesGuide from './components/HOResponsibilitiesGuide';
import { useAuthStore } from './store/authStore';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { OfflineIndicator } from './components/OfflineIndicator';
import { SWUpdateBanner } from './components/SWUpdateBanner';
import { SessionLockScreen } from './components/SessionLockScreen';
import { initializeCSRFToken } from './utils/csrf';
import { logger } from './utils/logger';
import { startBackgroundTracking, stopBackgroundTracking } from './services/geolocationService';
import { startWoundImageSync } from './services/woundImageSync';

// Auto-retry dynamic imports: if a chunk fails (stale cache after deploy),
// clear caches and reload the page once to get fresh assets.
function lazyWithRetry(importFn: () => Promise<any>) {
  return lazy(() =>
    importFn()
      .then((mod: any) => {
        // Clear the flag only once an import actually SUCCEEDS. It previously
        // got cleared at module-evaluation time (below), which runs on the
        // reloaded page BEFORE any chunk import is attempted — so the
        // "already retried" guard was always falsy and a permanently missing
        // chunk produced an infinite reload loop that made the app unreachable.
        sessionStorage.removeItem('chunk_reload');
        return mod;
      })
      .catch((error: any) => {
        // NEVER purge caches while offline. The recovery below assumes the
        // network can supply fresh assets; offline it deletes the precache that
        // IS the app — including every chunk that was working a moment ago —
        // and the reload then lands on a blank page with no way back until the
        // device finds a connection. Offline, surface the error so the boundary
        // can offer a retry with the caches intact.
        if (!navigator.onLine) {
          console.warn('Chunk load failed while offline — keeping caches:', error);
          throw error;
        }

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
        // Reload already attempted and the chunk still fails — surface the
        // error to the boundary instead of looping.
        throw error;
      })
  );
}

// Lazy load pages for better performance (with stale-chunk auto-reload)
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const Login = lazyWithRetry(() => import('./pages/Login'));
const Patients = lazyWithRetry(() => import('./pages/Patients'));
const PatientProfile = lazyWithRetry(() => import('./pages/PatientProfile'));
const TreatmentPlans = lazyWithRetry(() => import('./pages/TreatmentPlans'));
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
const TreatmentPlanCreator = lazyWithRetry(() => import('./pages/TreatmentPlanCreator'));
const TreatmentPlanManager = lazyWithRetry(() => import('./pages/TreatmentPlanManager'));
const BookingRegisterPage = lazyWithRetry(() => import('./pages/BookingRegisterPage'));
const PreOperativeWorkupPage = lazyWithRetry(() => import('./pages/PreOperativeWorkupPage'));
const Procedures = lazyWithRetry(() => import('./pages/Procedures'));
const PreSurgicalConferencePage = lazyWithRetry(() => import('./pages/PreSurgicalConferencePage'));
const WoundCarePage = lazyWithRetry(() => import('./pages/WoundCarePage'));
const WoundProgressMonitorPage = lazyWithRetry(() => import('./pages/WoundProgressMonitorPage'));
const TumorBoardPage = lazyWithRetry(() => import('./pages/TumorBoardPage'));
const ClinicianAssistantPage = lazyWithRetry(() => import('./pages/ClinicianAssistantPage'));
const KeloidCarePage = lazyWithRetry(() => import('./pages/KeloidCarePage'));
const SickleCellUlcerPage = lazyWithRetry(() => import('./pages/SickleCellUlcerPage'));
const SoftTissueInfectionPage = lazyWithRetry(() => import('./pages/SoftTissueInfectionPage'));
const LymphedemaPage = lazyWithRetry(() => import('./pages/LymphedemaPage'));
const PressureSorePage = lazyWithRetry(() => import('./pages/PressureSorePage'));
const Settings = lazyWithRetry(() => import('./pages/Settings'));
const DepartmentalMeetingsPage = lazyWithRetry(() => import('./pages/DepartmentalMeetingsPage'));
const PrescriptionsPage = lazyWithRetry(() => import('./pages/PrescriptionsPage'));
const CallDutyPage = lazyWithRetry(() => import('./pages/CallDutyPage'));
const ClinicDutiesPage = lazyWithRetry(() => import('./pages/ClinicDutiesPage'));
const ClinicDayLogPage = lazyWithRetry(() => import('./pages/ClinicDayLogPage'));
const NoticeBoardPage = lazyWithRetry(() => import('./pages/NoticeBoardPage'));
const ScribeDashboard = lazyWithRetry(() => import('./pages/ScribeDashboard'));
const PatientActionRecords = lazyWithRetry(() => import('./pages/PatientActionRecords'));
const ClinicAppointmentsPage = lazyWithRetry(() => import('./pages/ClinicAppointmentsPage'));
const ConsultsPage = lazyWithRetry(() => import('./pages/ConsultsPage'));
const ConsultsModulePage = lazyWithRetry(() => import('./pages/ConsultsModulePage'));
const PublicConsultSubmitPage = lazyWithRetry(() => import('./pages/PublicConsultSubmitPage'));
const ReferralAnalyticsPage = lazyWithRetry(() => import('./pages/ReferralAnalyticsPage'));
const AdminTrainingPage = lazyWithRetry(() => import('./pages/AdminTrainingPage'));
const BulkAdmitPage = lazyWithRetry(() => import('./pages/BulkAdmitPage'));
const SJSManagementPage = lazyWithRetry(() => import('./pages/SJSManagementPage'));
const SubstanceDetoxPage = lazyWithRetry(() => import('./pages/SubstanceDetoxPage'));
const HOTrackingPage = lazyWithRetry(() => import('./pages/HOTrackingPage'));
const AuditLogViewerPage = lazyWithRetry(() => import('./pages/AuditLogViewerPage'));
const StudentRegister = lazyWithRetry(() => import('./pages/StudentRegister'));
const StudentLogin = lazyWithRetry(() => import('./pages/StudentLogin'));
const StudentDashboard = lazyWithRetry(() => import('./pages/StudentDashboard'));

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
  const [hoAcknowledged, setHoAcknowledged] = useState<boolean | null>(null); // null = loading

  // Initialize auth ONCE on mount — NOT when user changes
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

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User-dependent setup (notifications, sync, geolocation) — runs when user changes
  useEffect(() => {
    if (user) {
      // Start background geolocation tracking for documentation stamping
      startBackgroundTracking();

      // Dynamically import notification services to reduce initial bundle
      import('./services/notificationBackgroundService').then(({ notificationService }) => {
        notificationService.requestNotificationPermission();
      });
      import('./services/pushNotificationService').then(({ pushNotificationService }) => {
        pushNotificationService.requestPermission().then((granted) => {
          if (granted) console.log('✅ Push notifications enabled for patient alerts');
        });
      });
      
      // Sync any unsynced local data when user logs in
      if (navigator.onLine) {
        patientService.syncLocalChanges().catch(err => {
          console.error('Failed to sync local changes:', err);
        });
      }

      // ── Warm the offline cache for EVERY module, not just visited pages ──
      // Without this, a module the clinician had never opened while online had
      // nothing cached, so it rendered empty on the ward. Runs in the
      // background, throttled to a few hours, and also on reconnect: leaving
      // the hospital and coming back is the moment a stale device needs
      // refreshing. Deferred so it never competes with the first paint.
      const reWarm = () => {
        import('./services/cacheWarmer').then(({ autoWarmCache }) => {
          autoWarmCache().catch(() => { /* opportunistic */ });
        });
      };
      const warmTimer = setTimeout(reWarm, 5000);
      window.addEventListener('online', reWarm);

      return () => {
        clearTimeout(warmTimer);
        window.removeEventListener('online', reWarm);
        stopBackgroundTracking();
      };
    }
    return () => {
      // Stop geolocation tracking when user logs out
      stopBackgroundTracking();
    };
  }, [user]);

  // ─── Send wound photographs still held only on this device ───
  // Capture writes to IndexedDB first so a ward with no signal never blocks a
  // clinician, which leaves an upload queue that something has to drain. Until
  // this ran, nothing did: photographs stayed on the phone that took them and
  // were invisible from every other device.
  useEffect(() => {
    if (!user) return;
    return startWoundImageSync();
  }, [user]);

  // ─── Check HO responsibilities acknowledgment status ───
  useEffect(() => {
    if (!user) {
      setHoAcknowledged(null);
      return;
    }
    // Only gate House Officers
    if (user.role !== 'house_officer') {
      setHoAcknowledged(true);
      return;
    }
    // Check server first, fall back to localStorage
    const checkAck = async () => {
      try {
        const res = await fetch(`/api/users/ho-acknowledgment?userId=${encodeURIComponent(user.id)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
        });
        if (res.ok) {
          const data = await res.json();
          setHoAcknowledged(!!data.acknowledged);
          if (data.acknowledged) {
            localStorage.setItem(`ho_ack_${user.id}`, 'true');
          }
          return;
        }
      } catch { /* offline fallback */ }
      // Offline fallback: check localStorage
      setHoAcknowledged(localStorage.getItem(`ho_ack_${user.id}`) === 'true');
    };
    checkAck();
  }, [user]);

  const handleHOAcknowledge = async () => {
    if (!user) return;
    // Save to server
    try {
      await fetch('/api/users/ho-acknowledgment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({ userId: user.id }),
      });
    } catch { /* will be synced later */ }
    // Always save locally
    localStorage.setItem(`ho_ack_${user.id}`, 'true');
    setHoAcknowledged(true);
  };

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
        <Routes>
          <Route path="/student-register" element={<StudentRegister />} />
          <Route path="/student-login" element={<StudentLogin />} />
          <Route path="/submit-consult/:token" element={<PublicConsultSubmitPage />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </Suspense>
    );
  }

  // Student users go directly to their dashboard.
  //
  // The learning modules are reachable from here too. Until now the catch-all
  // below swallowed every other path, so a student following a link to the MCQ
  // bank or the CME articles landed silently back on their dashboard — the
  // material was built and they could not get to it.
  //
  // Only the two content modules are opened up. Both keep their material in
  // IndexedDB and treat the server as a top-up, so they work on a student
  // token; the staff training pages read trainee analytics and rotations and
  // stay closed. The catch-all still ends at the dashboard, so an unknown path
  // cannot reach anything else.
  if ((user.role as string) === 'student') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/student-dashboard" element={<StudentDashboard />} />
          <Route path="/student-login" element={<StudentLogin />} />
          <Route path="/mcq-education" element={<MCQEducation />} />
          <Route path="/education" element={<Education />} />
          <Route path="*" element={<StudentDashboard />} />
        </Routes>
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

  // Gate: House Officers must acknowledge responsibilities before first use
  if (user.role === 'house_officer' && hoAcknowledged === false) {
    return (
      <HOResponsibilitiesGuide
        mode="acknowledgment"
        onAcknowledge={handleHOAcknowledge}
      />
    );
  }

  return (
    <SessionLockScreen>
    <Suspense fallback={<PageLoader />}>
      <ErrorBoundary>
        <Routes>
        {/* Video Conference - Full screen without Layout */}
        <Route path="/conference" element={<VideoConference />} />
        <Route path="/conference/:roomId" element={<VideoConference />} />

        {/* Public student pages — reachable even when a staff user is logged in
            (e.g. an admin previewing the shared /student-register link) */}
        <Route path="/student-register" element={<StudentRegister />} />
        <Route path="/student-login" element={<StudentLogin />} />
        
        {/* All other routes with Layout */}
        <Route path="/*" element={
          <Layout>
            <SWUpdateBanner />
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/patients/:id" element={<PatientProfile />} />
              <Route path="/patient-action" element={<PatientActionRecords />} />
              <Route path="/patients/:id/plans/:planId" element={<TreatmentPlans />} />
              <Route path="/treatment-plan-builder" element={<TreatmentPlanBuilder />} />
              <Route path="/treatment-plan-creator" element={<TreatmentPlanCreator />} />
              <Route path="/treatment-plan-manager" element={<TreatmentPlanManager />} />
              <Route path="/treatment-planning" element={<TreatmentPlanningPage />} />
              <Route path="/patient-summaries" element={<PatientSummariesPage />} />
              <Route path="/paperwork" element={<PaperworkPage />} />
              <Route path="/admissions" element={<AdmissionsPage />} />
              <Route path="/discharges" element={<DischargesPage />} />
              <Route path="/admission-discharge" element={<AdmissionDischargePage />} />
              <Route path="/mdt" element={<MDTPage />} />
              <Route path="/blood-transfusion" element={<BloodTransfusionPage />} />
              <Route path="/ward-rounds" element={<WardRoundsPage />} />
              <Route path="/booking-register" element={<BookingRegisterPage />} />
              <Route path="/preoperative-workup" element={<PreOperativeWorkupPage />} />
              <Route path="/procedures" element={<Procedures />} />
              <Route path="/preoperative-planning" element={<BookingRegisterPage />} />
              <Route path="/pre-surgical-conference" element={<PreSurgicalConferencePage />} />
              <Route path="/labs" element={<Labs />} />
              <Route path="/prescriptions" element={<PrescriptionsPage />} />
              <Route path="/patient-education" element={<PatientEducation />} />
              <Route path="/call-duty" element={<CallDutyPage />} />
              <Route path="/clinic-duties" element={<ClinicDutiesPage />} />
              <Route path="/clinic-day-log" element={<ClinicDayLogPage />} />
              <Route path="/shopping-list" element={<ShoppingList />} />
              <Route path="/limb-salvage" element={<LimbSalvagePage />} />
              <Route path="/burn-care" element={<BurnCarePage />} />
              <Route path="/sjs-management" element={<SJSManagementPage />} />
              <Route path="/substance-detox" element={<SubstanceDetoxPage />} />
              <Route path="/wound-care" element={<WoundCarePage />} />
              <Route path="/wound-monitor" element={<WoundProgressMonitorPage />} />
              <Route path="/tumor-board" element={<TumorBoardPage />} />
              <Route path="/clinician-assistant" element={<ClinicianAssistantPage />} />
              <Route path="/keloid-care" element={<KeloidCarePage />} />
              <Route path="/sickle-cell-ulcer" element={<SickleCellUlcerPage />} />
              <Route path="/soft-tissue-infection" element={<SoftTissueInfectionPage />} />
              <Route path="/pressure-sore" element={<PressureSorePage />} />
              <Route path="/lymphedema" element={<LymphedemaPage />} />
              <Route path="/medical-training" element={<MedicalTrainingPage />} />
              <Route path="/education" element={<Education />} />
              <Route path="/mcq-education" element={<MCQEducation />} />
              <Route path="/notifications" element={<NotificationManager />} />
              <Route path="/chat" element={<ChatRooms />} />
              <Route path="/chat/:roomId" element={<ChatRooms />} />
              <Route path="/departmental-meetings" element={<DepartmentalMeetingsPage />} />
              <Route path="/notice-board" element={<NoticeBoardPage />} />
              <Route path="/ai-scribe" element={<ScribeDashboard />} />
              <Route path="/clinic-appointments" element={<ClinicAppointmentsPage />} />
              <Route path="/consults" element={<ConsultsModulePage />} />
              <Route path="/consults-external" element={<ConsultsPage />} />
              <Route path="/reports/referrals" element={<ReferralAnalyticsPage />} />
              <Route path="/submit-consult/:token" element={<PublicConsultSubmitPage />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin-training" element={<ProtectedRoute allowedRoles={['admin', 'consultant']}><AdminTrainingPage /></ProtectedRoute>} />
              <Route path="/bulk-admit" element={<ProtectedRoute allowedRoles={['admin', 'consultant', 'senior_registrar', 'junior_registrar', 'registrar', 'house_officer']}><BulkAdmitPage /></ProtectedRoute>} />
              <Route path="/ho-tracking" element={<ProtectedRoute allowedRoles={['admin', 'consultant', 'senior_registrar']}><HOTrackingPage /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><Admin /></ProtectedRoute>} />
              <Route path="/topic-management" element={<ProtectedRoute allowedRoles={['admin', 'consultant']}><TopicManagement /></ProtectedRoute>} />
              <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['admin', 'consultant', 'senior_registrar']}><AuditLogViewerPage /></ProtectedRoute>} />
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
    </SessionLockScreen>
  );
}

export default App;