/**
 * OfflineIndicator — Visual indicator for offline status, sync progress,
 * and storage usage. Full-bar version and compact navbar pill.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, WifiOff, RefreshCw, Cloud, CloudOff, CheckCircle, AlertCircle, HardDrive, Database } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showSyncButton?: boolean;
  showDetails?: boolean;
  className?: string;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'bottom',
  showSyncButton = true,
  showDetails = true,
  className = '',
}) => {
  const { isOnline, isOffline, isSyncing, pendingCount, lastSyncTime, sync, storageUsage } = useOffline();
  const [showBanner, setShowBanner] = useState(false);
  const [recentlyOnline, setRecentlyOnline] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isOffline || pendingCount > 0) {
      setShowBanner(true);
    } else if (isOnline && showBanner) {
      setRecentlyOnline(true);
      const timer = setTimeout(() => {
        setRecentlyOnline(false);
        setShowBanner(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, isOnline, pendingCount, showBanner]);

  const shouldShow = showBanner || isOffline || pendingCount > 0 || recentlyOnline;

  if (!shouldShow && isOnline) {
    return (
      <div className={`fixed ${position === 'top' ? 'top-4' : 'bottom-4'} right-4 z-50 ${className}`}>
        <div className="bg-green-50 border border-green-200 rounded-full p-2 shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
             onClick={() => setExpanded(!expanded)}>
          <Wifi className="w-4 h-4 text-green-600" />
        </div>
        {expanded && (
          <div className="absolute bottom-full right-0 mb-2 bg-white rounded-lg shadow-xl border p-3 min-w-[200px]">
            <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
              <Wifi className="w-4 h-4" /> Online
            </div>
            {storageUsage && (
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3 h-3" />
                  <span>Storage: {formatBytes(storageUsage.usage)} / {formatBytes(storageUsage.quota)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div className="bg-green-500 h-1.5 rounded-full" 
                       style={{ width: `${Math.min(100, storageUsage.percentage)}%` }} />
                </div>
              </div>
            )}
            {lastSyncTime && (
              <div className="text-xs text-gray-400 mt-1">
                Last sync: {formatTimeAgo(lastSyncTime)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`fixed ${position === 'top' ? 'top-0' : 'bottom-0'} left-0 right-0 z-50 ${className}`}>
      <div
        className={`
          px-4 py-2 flex items-center justify-between gap-4 transition-all duration-300
          ${isOffline 
            ? 'bg-amber-50 border-t border-amber-200' 
            : recentlyOnline 
              ? 'bg-green-50 border-t border-green-200'
              : pendingCount > 0 
                ? 'bg-blue-50 border-t border-blue-200' 
                : 'bg-gray-50 border-t border-gray-200'
          }
        `}
      >
        <div className="flex items-center gap-3">
          <div
            className={`p-1.5 rounded-full
              ${isOffline ? 'bg-amber-100' 
                : recentlyOnline ? 'bg-green-100'
                : pendingCount > 0 ? 'bg-blue-100' 
                : 'bg-gray-100'
              }
            `}
          >
            {isOffline ? (
              <WifiOff className="w-4 h-4 text-amber-600" />
            ) : recentlyOnline ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : pendingCount > 0 ? (
              <Cloud className="w-4 h-4 text-blue-600" />
            ) : (
              <Wifi className="w-4 h-4 text-gray-600" />
            )}
          </div>

          <div className="flex flex-col">
            <span
              className={`text-sm font-medium
                ${isOffline ? 'text-amber-800' 
                  : recentlyOnline ? 'text-green-800'
                  : pendingCount > 0 ? 'text-blue-800' 
                  : 'text-gray-800'
                }
              `}
            >
              {isOffline 
                ? 'You are offline' 
                : recentlyOnline 
                  ? 'Back online!'
                  : pendingCount > 0 
                    ? `${pendingCount} pending sync${pendingCount !== 1 ? 's' : ''}` 
                    : 'Connected'
              }
            </span>
            
            {showDetails && (
              <span className="text-xs text-gray-500">
                {isOffline 
                  ? 'All changes saved locally — will sync when connected'
                  : recentlyOnline
                    ? 'All changes synced'
                    : lastSyncTime 
                      ? `Last sync: ${formatTimeAgo(lastSyncTime)}`
                      : ''
                }
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Storage indicator */}
          {storageUsage && isOffline && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
              <Database className="w-3.5 h-3.5" />
              <span>{formatBytes(storageUsage.usage)}</span>
            </div>
          )}

          {/* Sync button */}
          {showSyncButton && pendingCount > 0 && isOnline && (
            <button
              onClick={sync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isSyncing 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }
              `}
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}

          {recentlyOnline && (
            <button
              onClick={() => { setRecentlyOnline(false); setShowBanner(false); }}
              className="text-gray-400 hover:text-gray-600 text-lg"
              aria-label="Dismiss"
            >
              ×
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact offline indicator for header/navbar
 */
export const OfflineIndicatorCompact: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isOnline, isOffline, isSyncing, pendingCount, sync } = useOffline();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isOffline ? (
        <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 rounded-full animate-pulse">
          <WifiOff className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-medium text-amber-700">Offline</span>
        </div>
      ) : pendingCount > 0 ? (
        <button
          onClick={sync}
          disabled={isSyncing}
          className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded-full hover:bg-blue-200 transition-colors"
        >
          <Cloud className="w-3.5 h-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-700">
            {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
          </span>
          {isSyncing && <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />}
        </button>
      ) : (
        <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
          <Wifi className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-medium text-green-700">Online</span>
        </div>
      )}
    </div>
  );
};

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format time ago helper
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default OfflineIndicator;
