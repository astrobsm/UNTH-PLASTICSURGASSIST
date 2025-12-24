/**
 * Sync Status Indicator Component
 * Shows the current sync status and pending changes across devices
 */

import { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { syncService } from '../db/syncService';
import { apiClient } from '../services/apiClient';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  lastSync: string | null;
  isSyncing: boolean;
}

export const SyncStatusIndicator = () => {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSync: localStorage.getItem('last_sync_timestamp'),
    isSyncing: false,
  });

  useEffect(() => {
    // Subscribe to sync status changes from syncService
    const unsubscribeSyncService = syncService.onSyncStatusChange((syncStatus) => {
      setStatus((prev) => ({
        ...prev,
        isOnline: syncStatus.isOnline,
        pendingCount: syncStatus.pendingCount,
      }));
    });

    // Subscribe to sync state changes from apiClient
    const unsubscribeApiClient = apiClient.onSyncStateChange((syncState) => {
      setStatus((prev) => ({
        ...prev,
        lastSync: syncState.lastSyncTimestamp,
        pendingCount: prev.pendingCount + syncState.pendingChanges,
        isSyncing: syncState.isSyncing,
      }));
    });

    // Listen for online/offline events
    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync status check
    syncService.getSyncStatus().then((syncStatus) => {
      setStatus((prev) => ({
        ...prev,
        isOnline: syncStatus.isOnline,
        pendingCount: syncStatus.pendingCount,
      }));
    });

    return () => {
      unsubscribeSyncService();
      unsubscribeApiClient();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!status.isOnline) return;

    setStatus((prev) => ({ ...prev, isSyncing: true }));
    try {
      await syncService.forcSync();
      setStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSync: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Manual sync failed:', error);
      setStatus((prev) => ({ ...prev, isSyncing: false }));
    }
  };

  const formatLastSync = (timestamp: string | null): string => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex items-center space-x-2 text-sm">
      {/* Connection Status */}
      <div
        className={`flex items-center space-x-1 px-2 py-1 rounded-full ${
          status.isOnline
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {status.isOnline ? (
          <Cloud className="w-4 h-4" />
        ) : (
          <CloudOff className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">
          {status.isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Pending Changes */}
      {status.pendingCount > 0 && (
        <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
          <AlertCircle className="w-4 h-4" />
          <span>{status.pendingCount} pending</span>
        </div>
      )}

      {/* Sync Button */}
      <button
        onClick={handleManualSync}
        disabled={!status.isOnline || status.isSyncing}
        className={`flex items-center space-x-1 px-2 py-1 rounded-full transition-colors ${
          status.isOnline && !status.isSyncing
            ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
        title={`Last synced: ${formatLastSync(status.lastSync)}`}
      >
        <RefreshCw
          className={`w-4 h-4 ${status.isSyncing ? 'animate-spin' : ''}`}
        />
        <span className="hidden sm:inline">
          {status.isSyncing ? 'Syncing...' : 'Sync'}
        </span>
      </button>

      {/* Sync Status */}
      {status.isOnline && status.pendingCount === 0 && !status.isSyncing && (
        <div className="flex items-center space-x-1 text-green-600">
          <Check className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">
            {formatLastSync(status.lastSync)}
          </span>
        </div>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
