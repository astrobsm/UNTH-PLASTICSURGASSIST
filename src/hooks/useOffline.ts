/**
 * useOffline Hook - React hook for offline-first functionality
 * Provides reactive offline status, sync management, and data fetching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineManager, OfflineStatus } from '../services/offlineManager';
import { offlineGet, offlinePost, offlinePut, offlineDelete, forceSync } from '../services/offlineFetch';
import toast from 'react-hot-toast';

export interface UseOfflineOptions {
  // Auto-sync when coming online
  autoSync?: boolean;
  // Show toast notifications
  showToasts?: boolean;
}

export interface UseOfflineReturn {
  // Status
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  
  // Actions
  sync: () => Promise<void>;
  clearCache: () => Promise<void>;
  
  // Data fetching helpers
  fetchData: <T>(endpoint: string) => Promise<T>;
  postData: <T>(endpoint: string, data: any) => Promise<T>;
  updateData: <T>(endpoint: string, data: any) => Promise<T>;
  deleteData: <T>(endpoint: string) => Promise<T>;
}

/**
 * Hook for offline-first functionality
 */
export function useOffline(options: UseOfflineOptions = {}): UseOfflineReturn {
  const { autoSync = true, showToasts = true } = options;
  
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    pendingCount: 0,
    lastSyncTime: null,
    syncInProgress: false,
  });

  const previousOnline = useRef(navigator.onLine);

  // Subscribe to offline status changes
  useEffect(() => {
    const unsubscribe = offlineManager.onStatusChange((newStatus) => {
      // Check if we just came back online
      if (!previousOnline.current && newStatus.isOnline && autoSync) {
        // Auto-sync is handled by offlineManager
      }
      
      previousOnline.current = newStatus.isOnline;
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, [autoSync]);

  // Manual sync
  const sync = useCallback(async () => {
    if (!status.isOnline) {
      if (showToasts) {
        toast.error('Cannot sync while offline');
      }
      return;
    }

    try {
      const result = await forceSync();
      if (showToasts && result.synced > 0) {
        toast.success(`Synced ${result.synced} changes`);
      }
      if (showToasts && result.failed > 0) {
        toast.error(`Failed to sync ${result.failed} changes`);
      }
    } catch (error) {
      if (showToasts) {
        toast.error('Sync failed');
      }
      console.error('Sync error:', error);
    }
  }, [status.isOnline, showToasts]);

  // Clear cache
  const clearCache = useCallback(async () => {
    try {
      await offlineManager.clearCache();
      if (showToasts) {
        toast.success('Cache cleared');
      }
    } catch (error) {
      if (showToasts) {
        toast.error('Failed to clear cache');
      }
      console.error('Clear cache error:', error);
    }
  }, [showToasts]);

  // Data fetching helpers
  const fetchData = useCallback(async <T>(endpoint: string): Promise<T> => {
    return offlineGet<T>(endpoint);
  }, []);

  const postData = useCallback(async <T>(endpoint: string, data: any): Promise<T> => {
    return offlinePost<T>(endpoint, data);
  }, []);

  const updateData = useCallback(async <T>(endpoint: string, data: any): Promise<T> => {
    return offlinePut<T>(endpoint, data);
  }, []);

  const deleteData = useCallback(async <T>(endpoint: string): Promise<T> => {
    return offlineDelete<T>(endpoint);
  }, []);

  return {
    isOnline: status.isOnline,
    isOffline: !status.isOnline,
    isSyncing: status.syncInProgress,
    pendingCount: status.pendingCount,
    lastSyncTime: status.lastSyncTime,
    sync,
    clearCache,
    fetchData,
    postData,
    updateData,
    deleteData,
  };
}

/**
 * Hook for fetching data with offline support
 */
export function useOfflineData<T>(
  endpoint: string,
  options: {
    enabled?: boolean;
    initialData?: T;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const { enabled = true, initialData, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      setIsFromCache(response.headers.get('X-From-Cache') === 'true');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled, onSuccess, onError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    isFromCache,
    refetch,
  };
}

/**
 * Hook for mutation with offline support
 */
export function useOfflineMutation<TData = any, TVariables = any>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: {
    onSuccess?: (data: TData) => void;
    onError?: (error: Error) => void;
    onOffline?: () => void;
  } = {}
) {
  const { onSuccess, onError, onOffline } = options;
  
  const [data, setData] = useState<TData | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isQueued, setIsQueued] = useState(false);

  const mutate = useCallback(async (variables: TVariables) => {
    setLoading(true);
    setError(null);
    setIsQueued(false);
    
    try {
      const result = await mutationFn(variables);
      
      // Check if the result indicates offline queueing
      if (result && typeof result === 'object' && '_offline' in result) {
        setIsQueued(true);
        onOffline?.();
      } else {
        setData(result);
        onSuccess?.(result);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [mutationFn, onSuccess, onError, onOffline]);

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsQueued(false);
  }, []);

  return {
    data,
    loading,
    error,
    isQueued,
    mutate,
    reset,
  };
}

export default useOffline;
