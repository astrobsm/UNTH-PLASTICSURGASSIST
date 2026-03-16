import { useState, useEffect } from 'react';
import { Bell, Settings, AlertTriangle, Clock, CheckCircle, X, Play } from 'lucide-react';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';

interface NotificationDemo {
  id: string;
  title: string;
  description: string;
  type: 'reminder' | 'alert' | 'urgent' | 'info';
  action: () => Promise<void>;
}

export default function NotificationManager() {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Demo scenarios
  const notificationDemos: NotificationDemo[] = [
    {
      id: 'step-due',
      title: 'Treatment Step Due',
      description: 'Notify when a treatment step is due for a patient',
      type: 'reminder',
      action: () => notificationService.notifyStepDue(
        'Pre-operative Assessment',
        'Jane Doe',
        1,
        1
      )
    },
    {
      id: 'lab-results',
      title: 'Lab Results Available',
      description: 'Alert when lab results are ready for review',
      type: 'info',
      action: () => notificationService.notifyLabResults(
        'Jane Doe',
        'CBC and Electrolytes',
        1
      )
    },
    {
      id: 'urgent-alert',
      title: 'Urgent Patient Alert',
      description: 'Critical patient condition requiring immediate attention',
      type: 'urgent',
      action: () => notificationService.notifyUrgentAlert(
        'Blood pressure elevated (180/110)',
        'Jane Doe',
        1
      )
    },
    {
      id: 'medication-due',
      title: 'Medication Due',
      description: 'Reminder for scheduled medication administration',
      type: 'reminder',
      action: () => notificationService.notifyMedicationDue(
        'Antibiotics - Amoxicillin 500mg',
        'Jane Doe',
        1
      )
    },
    {
      id: 'surgery-reminder',
      title: 'Surgery Reminder',
      description: 'Pre-operative reminder for scheduled surgery',
      type: 'alert',
      action: () => notificationService.notifySurgeryReminder(
        'Skin Graft Procedure',
        'Jane Doe',
        '2 hours'
      )
    }
  ];

  useEffect(() => {
    updateStatus();
  }, []);

  const updateStatus = () => {
    const status = notificationService.getStatus();
    setIsSupported(status.supported);
    setPermissionStatus(status.permission);
    setIsSubscribed(status.subscribed);
  };

  const requestPermission = async () => {
    try {
      const permission = await notificationService.requestPermission();
      setPermissionStatus(permission);
      
      if (permission === 'granted') {
        toast.success('Notifications enabled! You will receive clinical alerts.');
        updateStatus();
      } else {
        toast.error('Notification permission denied. Clinical alerts will not work.');
      }
    } catch (error) {
      toast.error('Failed to enable notifications');
      console.error('Permission request failed:', error);
    }
  };

  const runDemo = async (demo: NotificationDemo) => {
    if (permissionStatus !== 'granted') {
      toast.error('Please enable notifications first');
      return;
    }

    try {
      await demo.action();
      toast.success(`${demo.title} notification sent!`);
    } catch (error) {
      toast.error(`Failed to send ${demo.title.toLowerCase()}`);
      console.error('Demo notification failed:', error);
    }
  };

  const scheduleStepReminder = async () => {
    if (permissionStatus !== 'granted') {
      toast.error('Please enable notifications first');
      return;
    }

    // Schedule a reminder for 10 seconds from now (for demo)
    const reminderTime = new Date(Date.now() + 10000);
    
    try {
      await notificationService.scheduleStepReminder(
        'Post-operative Wound Care',
        'Jane Doe',
        reminderTime,
        2,
        1
      );
      toast.success('Reminder scheduled for 10 seconds from now!');
    } catch (error) {
      toast.error('Failed to schedule reminder');
      console.error('Schedule failed:', error);
    }
  };

  const getStatusColor = (status: NotificationPermission) => {
    switch (status) {
      case 'granted': return 'text-primary-600 bg-primary-50';
      case 'denied': return 'text-danger-600 bg-danger-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-danger-500" />;
      case 'alert': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'reminder': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Bell className="h-4 w-4 text-primary-500" />;
    }
  };

  if (!isSupported) {
    return (
      <div className="card p-6">
        <div className="text-center">
          <X className="h-12 w-12 text-danger-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-clinical-dark mb-2">
            Notifications Not Supported
          </h3>
          <p className="text-clinical">
            Your browser doesn't support push notifications. Please use a modern browser 
            like Chrome, Firefox, or Safari to enable clinical alerts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold text-clinical-dark">Clinical Notifications</h1>
          <p className="text-clinical mt-1">
            Manage push notifications for clinical alerts and reminders
          </p>
        </div>
        
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="btn-secondary"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </button>
      </div>

      {/* Status Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-4">Notification Status</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-clinical-dark">Permission:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(permissionStatus)}`}>
                  {permissionStatus}
                </span>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-clinical-dark">Push Subscription:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isSubscribed ? 'text-primary-600 bg-primary-50' : 'text-gray-600 bg-gray-50'
                }`}>
                  {isSubscribed ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          
          {permissionStatus !== 'granted' && (
            <button
              onClick={requestPermission}
              className="btn-primary"
            >
              <Bell className="h-4 w-4 mr-2" />
              Enable Notifications
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="card p-6 border-blue-200 bg-blue-50">
          <h3 className="text-lg font-semibold mb-4">Notification Settings</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Treatment Reminders</h4>
                <p className="text-sm text-clinical">Get notified about upcoming treatment steps</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Lab Results</h4>
                <p className="text-sm text-clinical">Alerts when lab results are available</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Urgent Alerts</h4>
                <p className="text-sm text-clinical">Critical patient condition alerts</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Surgery Reminders</h4>
                <p className="text-sm text-clinical">Pre-operative and scheduling reminders</p>
              </div>
              <input type="checkbox" defaultChecked className="rounded" />
            </div>
          </div>
        </div>
      )}

      {/* Demo Notifications */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Demo Clinical Notifications</h3>
        <p className="text-sm text-clinical mb-6">
          Test different types of clinical notifications. These demonstrate how the system 
          would alert medical staff about important patient events.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {notificationDemos.map((demo) => (
            <div key={demo.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(demo.type)}
                  <h4 className="font-medium">{demo.title}</h4>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  demo.type === 'urgent' ? 'bg-danger-100 text-danger-800' :
                  demo.type === 'alert' ? 'bg-yellow-100 text-yellow-800' :
                  demo.type === 'reminder' ? 'bg-blue-100 text-blue-800' :
                  'bg-primary-100 text-primary-800'
                }`}>
                  {demo.type}
                </span>
              </div>
              
              <p className="text-sm text-clinical mb-3">{demo.description}</p>
              
              <button
                onClick={() => runDemo(demo)}
                disabled={permissionStatus !== 'granted'}
                className="btn-primary text-sm w-full"
              >
                <Play className="h-3 w-3 mr-1" />
                Test Notification
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Notifications Demo */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Scheduled Notifications</h3>
        <p className="text-sm text-clinical mb-4">
          Test scheduling notifications for future events. In practice, these would be 
          set based on treatment plan timelines and patient schedules.
        </p>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={scheduleStepReminder}
            disabled={permissionStatus !== 'granted'}
            className="btn-primary"
          >
            <Clock className="h-4 w-4 mr-2" />
            Schedule Reminder (10s)
          </button>
          
          <span className="text-sm text-clinical">
            This will show a notification in 10 seconds
          </span>
        </div>
      </div>

      {/* Implementation Notes */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold mb-4 text-blue-900">Implementation Notes</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>• <strong>Web Push:</strong> Uses VAPID keys for server-to-browser notifications</p>
          <p>• <strong>Local Notifications:</strong> Triggered by app events and scheduled reminders</p>
          <p>• <strong>Service Worker:</strong> Handles notifications when app is closed</p>
          <p>• <strong>Clinical Integration:</strong> Links to relevant patient/plan pages</p>
          <p>• <strong>Offline Support:</strong> Notifications work even when offline</p>
          <p>• <strong>Privacy:</strong> All notification data stays on device until sync</p>
        </div>
      </div>

      {/* Permission Required Notice */}
      {permissionStatus !== 'granted' && (
        <div className="card p-6 border-yellow-200 bg-yellow-50">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-900">Notification Permission Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                To receive clinical alerts and reminders, please enable notifications by clicking 
                the "Enable Notifications" button above. This ensures you don't miss critical 
                patient updates.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}