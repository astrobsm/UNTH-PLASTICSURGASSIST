import { Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import TreatmentPlans from './pages/TreatmentPlans';
import Procedures from './pages/Procedures';
import Scheduling from './pages/Scheduling';
import Labs from './pages/Labs';
import Education from './pages/Education';
import MCQEducation from './pages/MCQEducation';
import TopicManagement from './pages/TopicManagement';
import Admin from './pages/Admin';
import Login from './pages/Login';
import NotificationManager from './pages/NotificationManager';
import TreatmentPlanningPage from './pages/TreatmentPlanningPage';
import PatientSummariesPage from './pages/PatientSummariesPage';
import PaperworkPage from './pages/PaperworkPage';
import MDTPage from './pages/MDTPage';
import AdmissionsPage from './pages/AdmissionsPage';
import DischargesPage from './pages/DischargesPage';
import BloodTransfusionPage from './pages/BloodTransfusion';
import WardRoundsPage from './pages/WardRounds';
import PatientEducation from './pages/PatientEducation';
import ShoppingList from './pages/ShoppingList';
import VideoConference from './pages/VideoConference';
import ChatRooms from './pages/ChatRooms';
import { useAuthStore } from './store/authStore';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import TreatmentPlanBuilder from './components/TreatmentPlanBuilder';
import { notificationService } from './services/notificationBackgroundService';

function App() {
  const { user, loading, initializeAuth } = useAuthStore();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    initializeAuth();

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Request notification permissions for MCQ reminders
    if (user) {
      notificationService.requestNotificationPermission();
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
    return <Login />;
  }

  return (
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
            <Route path="/mdt" element={<MDTPage />} />
            <Route path="/blood-transfusion" element={<BloodTransfusionPage />} />
            <Route path="/ward-rounds" element={<WardRoundsPage />} />
            <Route path="/procedures" element={<Procedures />} />
            <Route path="/scheduling" element={<Scheduling />} />
            <Route path="/labs" element={<Labs />} />
            <Route path="/patient-education" element={<PatientEducation />} />
            <Route path="/shopping-list" element={<ShoppingList />} />
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
        </Layout>
      } />
    </Routes>
  );
}

export default App;