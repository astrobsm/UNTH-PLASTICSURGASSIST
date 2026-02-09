/**
 * Settings Page
 * 
 * Provides device sync controls, data management, and app configuration.
 * The main sync button pushes all local data to the cloud so other devices can pull automatically.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Cloud,
  CloudOff,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Database,
  Smartphone,
  Monitor,
  Wifi,
  WifiOff,
  Shield,
  Trash2,
  Info,
  Clock,
  HardDrive,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { dataSyncService } from '../services/dataSyncService';
import { db } from '../db/database';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

interface LocalDataSummary {
  entity: string;
  tableName: string;
  count: number;
}

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastFullSyncTime: Date | null;
  totalPendingChanges: number;
}

// Table definitions for data summary
const ENTITY_TABLES = [
  { label: 'Patients', table: 'patients' },
  { label: 'Treatment Plans', table: 'treatment_plans' },
  { label: 'Plan Steps', table: 'plan_steps' },
  { label: 'Admissions', table: 'admissions' },
  { label: 'Discharges', table: 'discharges' },
  { label: 'Prescriptions', table: 'prescriptions' },
  { label: 'Surgeries', table: 'surgery_bookings' },
  { label: 'Ward Rounds', table: 'ward_rounds' },
  { label: 'Lab Orders', table: 'lab_investigations' },
  { label: 'Lab Results', table: 'lab_results' },
  { label: 'Wound Care', table: 'wound_care' },
  { label: 'Blood Transfusions', table: 'blood_transfusions' },
  { label: 'Burn Patients', table: 'burn_patients' },
  { label: 'Diabetic Foot Assessments', table: 'diabetic_foot_assessments' },
  { label: 'Pre-op Assessments', table: 'preoperative_assessments' },
  { label: 'DVT Assessments', table: 'dvt_assessments' },
  { label: 'Pressure Sore Assessments', table: 'pressure_sore_assessments' },
  { label: 'Nutritional Assessments', table: 'nutritional_assessments' },
  { label: 'Procedures', table: 'procedures' },
  { label: 'WHO Checklists', table: 'who_safety_checklists' },
  { label: 'MDT Teams', table: 'mdt_patient_teams' },
  { label: 'MDT Meetings', table: 'mdt_meetings' },
  { label: 'MDT Contact Logs', table: 'mdt_contact_logs' },
  { label: 'Chat Messages', table: 'chat_messages' },
  { label: 'Activity Logs', table: 'user_activities' },
];

export default function Settings() {
  const { user } = useAuthStore();
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastFullSyncTime: null,
    totalPendingChanges: 0,
  });
  const [syncPhase, setSyncPhase] = useState<'idle' | 'pushing' | 'pulling' | 'complete' | 'error'>('idle');
  const [syncResult, setSyncResult] = useState<{ pushed: number; pulled: number; errors: string[] } | null>(null);
  const [localData, setLocalData] = useState<LocalDataSummary[]>([]);
  const [showDataDetails, setShowDataDetails] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    return localStorage.getItem('auto_sync_enabled') !== 'false'; // Default on
  });

  // Subscribe to sync status changes
  useEffect(() => {
    const unsubscribe = dataSyncService.onStatusChange((status) => {
      setSyncState({
        isOnline: status.isOnline,
        isSyncing: status.isSyncing,
        lastFullSyncTime: status.lastFullSyncTime,
        totalPendingChanges: status.totalPendingChanges,
      });
    });

    // Online/offline listener
    const onOnline = () => setSyncState(s => ({ ...s, isOnline: true }));
    const onOffline = () => setSyncState(s => ({ ...s, isOnline: false }));
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Load local data summary
  const loadLocalDataSummary = useCallback(async () => {
    setLoadingData(true);
    const summary: LocalDataSummary[] = [];
    for (const entity of ENTITY_TABLES) {
      try {
        const table = (db as any)[entity.table];
        if (table) {
          const count = await table.count();
          summary.push({ entity: entity.label, tableName: entity.table, count });
        } else {
          summary.push({ entity: entity.label, tableName: entity.table, count: 0 });
        }
      } catch {
        summary.push({ entity: entity.label, tableName: entity.table, count: 0 });
      }
    }
    setLocalData(summary);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    loadLocalDataSummary();
  }, [loadLocalDataSummary]);

  // Handle full sync (push + pull)
  const handleFullSync = async () => {
    if (syncState.isSyncing) return;
    if (!syncState.isOnline) {
      toast.error('You are offline. Please connect to the internet first.');
      return;
    }

    setSyncPhase('pushing');
    setSyncResult(null);

    try {
      const result = await dataSyncService.performFullSync();
      setSyncResult(result);
      setSyncPhase(result.errors.length > 0 && result.pushed === 0 && result.pulled === 0 ? 'error' : 'complete');
      
      // Refresh local data summary after sync
      await loadLocalDataSummary();

      if (result.errors.length === 0) {
        toast.success(
          `✅ Sync complete! Uploaded ${result.pushed} records, downloaded ${result.pulled} records.`,
          { duration: 5000 }
        );
      } else {
        toast.success(
          `Sync finished with ${result.errors.length} warning(s). Uploaded ${result.pushed}, downloaded ${result.pulled}.`,
          { duration: 5000 }
        );
      }
    } catch (err: any) {
      setSyncPhase('error');
      setSyncResult({ pushed: 0, pulled: 0, errors: [err.message] });
      toast.error('Sync failed: ' + err.message);
    }
  };

  // Handle pull only (download from cloud)
  const handlePullOnly = async () => {
    if (syncState.isSyncing) return;
    if (!syncState.isOnline) {
      toast.error('You are offline.');
      return;
    }

    setSyncPhase('pulling');
    setSyncResult(null);

    try {
      const result = await dataSyncService.pullAllFromCloud();
      setSyncResult({ pushed: 0, pulled: result.pulled, errors: result.errors });
      setSyncPhase('complete');
      await loadLocalDataSummary();
      toast.success(`Downloaded ${result.pulled} records from cloud.`, { duration: 4000 });
    } catch (err: any) {
      setSyncPhase('error');
      toast.error('Pull failed: ' + err.message);
    }
  };

  // Toggle auto-sync
  const toggleAutoSync = () => {
    const newValue = !autoSyncEnabled;
    setAutoSyncEnabled(newValue);
    localStorage.setItem('auto_sync_enabled', String(newValue));
    toast.success(newValue ? 'Auto-sync enabled' : 'Auto-sync disabled');
  };

  // Clear local data
  const handleClearLocalData = async () => {
    if (!window.confirm(
      'Are you sure you want to clear all locally cached data?\n\n' +
      'This will NOT delete your data from the cloud. ' +
      'Data will be re-downloaded on next sync.'
    )) return;

    try {
      await dataSyncService.clearAllData();
      await loadLocalDataSummary();
      toast.success('Local cache cleared. Data will re-sync from cloud.');
    } catch (err: any) {
      toast.error('Failed to clear local data: ' + err.message);
    }
  };

  const totalLocalRecords = localData.reduce((sum, d) => sum + d.count, 0);
  const lastSyncFormatted = syncState.lastFullSyncTime
    ? new Date(syncState.lastFullSyncTime).toLocaleString()
    : localStorage.getItem('dataSyncService_lastFullSync')
      ? new Date(localStorage.getItem('dataSyncService_lastFullSync')!).toLocaleString()
      : 'Never';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage sync, data, and app preferences</p>
      </div>

      {/* Connection Status Banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        syncState.isOnline 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-red-50 border border-red-200'
      }`}>
        {syncState.isOnline ? (
          <>
            <Wifi className="h-6 w-6 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-green-800">Connected to Internet</p>
              <p className="text-sm text-green-600">Ready to sync with cloud</p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">Offline</p>
              <p className="text-sm text-red-600">Changes will be saved locally and synced when online</p>
            </div>
          </>
        )}
      </div>

      {/* ──────────────────────── SYNC SECTION ──────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Cloud Sync</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Push your local data to the cloud so other devices can access it
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Sync Status Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Clock className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Last Synced</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{lastSyncFormatted}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <HardDrive className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Local Records</p>
              <p className="text-sm font-medium text-gray-800 mt-1">{totalLocalRecords.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">Pending Upload</p>
              <p className={`text-sm font-medium mt-1 ${
                syncState.totalPendingChanges > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {syncState.totalPendingChanges}
              </p>
            </div>
          </div>

          {/* Main Sync Button */}
          <button
            onClick={handleFullSync}
            disabled={syncState.isSyncing || !syncState.isOnline}
            className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl text-lg font-semibold transition-all ${
              syncState.isSyncing
                ? 'bg-blue-100 text-blue-700 cursor-wait'
                : !syncState.isOnline
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-lg hover:shadow-xl active:scale-[0.98]'
            }`}
          >
            {syncState.isSyncing ? (
              <>
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Cloud className="h-6 w-6" />
                <span>Sync Now</span>
                <span className="text-sm font-normal opacity-80">Push &amp; Pull</span>
              </>
            )}
          </button>

          {/* Sync Progress */}
          {syncState.isSyncing && (
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                <p className="text-sm font-medium text-blue-800">
                  {syncPhase === 'pushing' ? 'Uploading local data to cloud...' : 'Downloading cloud data...'}
                </p>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-3/5"></div>
              </div>
            </div>
          )}

          {/* Sync Result */}
          {syncResult && !syncState.isSyncing && (
            <div className={`rounded-lg p-4 ${
              syncPhase === 'error' 
                ? 'bg-red-50 border border-red-200' 
                : 'bg-green-50 border border-green-200'
            }`}>
              {syncPhase === 'complete' ? (
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-green-800">Sync Complete!</p>
                    <div className="mt-1 text-sm text-green-700 space-y-1">
                      {syncResult.pushed > 0 && (
                        <p className="flex items-center gap-1">
                          <Upload className="h-3.5 w-3.5" />
                          {syncResult.pushed} records uploaded to cloud
                        </p>
                      )}
                      {syncResult.pulled > 0 && (
                        <p className="flex items-center gap-1">
                          <Download className="h-3.5 w-3.5" />
                          {syncResult.pulled} records downloaded from cloud
                        </p>
                      )}
                      {syncResult.pushed === 0 && syncResult.pulled === 0 && (
                        <p>Everything is up to date!</p>
                      )}
                    </div>
                    {syncResult.errors.length > 0 && (
                      <div className="mt-2 text-sm text-amber-700">
                        <p className="font-medium">{syncResult.errors.length} warning(s):</p>
                        {syncResult.errors.slice(0, 3).map((err, i) => (
                          <p key={i} className="text-xs mt-0.5">• {err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800">Sync Failed</p>
                    {syncResult.errors.map((err, i) => (
                      <p key={i} className="text-sm text-red-700 mt-1">• {err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Secondary Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handlePullOnly}
              disabled={syncState.isSyncing || !syncState.isOnline}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Download className="h-4 w-4" />
              <span className="text-sm font-medium">Pull from Cloud Only</span>
            </button>
          </div>

          {/* Auto-sync Toggle */}
          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-800">Auto-sync</p>
                <p className="text-xs text-gray-500">Sync automatically every 2 minutes when online</p>
              </div>
            </div>
            <button
              onClick={toggleAutoSync}
              title={autoSyncEnabled ? 'Disable auto-sync' : 'Enable auto-sync'}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                autoSyncEnabled ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  autoSyncEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────────── DEVICES SECTION ──────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Cross-Device Sync</h2>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How cross-device sync works:</p>
                <ol className="list-decimal ml-4 space-y-1 text-blue-700">
                  <li><strong>Push:</strong> Tap "Sync Now" on this device to upload all your data to the cloud.</li>
                  <li><strong>Auto-Pull:</strong> When you log in on another device (laptop, phone, or tablet), 
                      it automatically downloads the latest data from the cloud.</li>
                  <li><strong>Background sync:</strong> While online, data syncs automatically every 2 minutes.</li>
                  <li><strong>Offline mode:</strong> Changes made offline are saved locally and uploaded when back online.</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Smartphone className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Phone</p>
                <p className="text-xs text-gray-500">Works offline + syncs</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Monitor className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Laptop</p>
                <p className="text-xs text-gray-500">Full features + sync</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Database className="h-8 w-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">Cloud</p>
                <p className="text-xs text-gray-500">Central data store</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────── LOCAL DATA SECTION ──────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Local Data</h2>
              <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                {totalLocalRecords.toLocaleString()} records
              </span>
            </div>
            <button
              onClick={() => setShowDataDetails(!showDataDetails)}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              {showDataDetails ? 'Hide' : 'Show'} Details
              {showDataDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showDataDetails && (
          <div className="p-6">
            {loadingData ? (
              <div className="text-center py-4">
                <RefreshCw className="h-5 w-5 text-gray-400 animate-spin mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Loading data summary...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {localData.filter(d => d.count > 0).length === 0 ? (
                  <p className="text-sm text-gray-500 col-span-full text-center py-4">
                    No local data. Tap "Sync Now" to download from cloud.
                  </p>
                ) : (
                  localData
                    .filter(d => d.count > 0)
                    .sort((a, b) => b.count - a.count)
                    .map((item) => (
                      <div key={item.tableName} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-700">{item.entity}</span>
                        <span className="text-sm font-semibold text-gray-900">{item.count.toLocaleString()}</span>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* Clear Local Data */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={handleClearLocalData}
                className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Clear Local Cache
              </button>
              <p className="text-xs text-gray-500 mt-1 ml-7">
                Clears locally stored data. Cloud data is preserved and can be re-downloaded.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────── ACCOUNT SECTION ──────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Account</h2>
          </div>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Logged in as</span>
            <span className="text-sm font-medium text-gray-900">{user?.email || user?.name || 'Unknown'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Role</span>
            <span className="text-sm font-medium text-gray-900 capitalize">{user?.role?.replace('_', ' ') || 'Unknown'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">App Version</span>
            <span className="text-sm font-medium text-gray-900">PSA v2.0</span>
          </div>
        </div>
      </div>

      {/* Bottom Spacing */}
      <div className="h-4" />
    </div>
  );
}
