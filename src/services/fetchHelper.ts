/**
 * Authenticated Fetch Helper - Now with Offline-First Support
 * Provides consistent authentication and error handling across all services
 * Automatically handles offline scenarios with IndexedDB caching and sync queue
 */

import { apiClient } from './apiClient';
import { offlineManager } from './offlineManager';
import toast from 'react-hot-toast';

export interface FetchOptions extends Omit<RequestInit, 'priority'> {
  timeout?: number;
  retries?: number;
  // Offline options
  cacheKey?: string;
  entityType?: string;
  entityId?: string | number;
  skipCache?: boolean;
  skipQueue?: boolean;
  syncPriority?: 'high' | 'normal' | 'low';
}

// API Base URL
const API_BASE_URL = (import.meta as any).env?.PROD ? '/api' : 'http://localhost:3005/api';

/**
 * Extract entity type from URL
 */
function parseUrl(url: string): { entityType: string; entityId?: string } {
  const cleanUrl = url.replace(API_BASE_URL, '').replace('/api', '');
  const parts = cleanUrl.split('/').filter(Boolean);
  return {
    entityType: parts[0] || '',
    entityId: parts[1],
  };
}

/**
 * Make an authenticated fetch request with proper headers and error handling
 * Now with full offline support
 */
export const authenticatedFetch = async (
  url: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const token = apiClient.getToken();
  const { 
    timeout = 30000, 
    retries = 0, 
    
    entityType: providedEntityType,
    entityId: providedEntityId,
    skipCache = false,
    skipQueue = false,
    syncPriority = 'normal',
    ...fetchOptions 
  } = options;

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const { entityType, entityId } = parseUrl(url);
  const resolvedEntityType = providedEntityType || entityType;
  const resolvedEntityId = providedEntityId || entityId;
  const isOnline = offlineManager.isNetworkOnline();

  // Handle offline GET requests - serve from cache
  if (method === 'GET' && !isOnline && !skipCache && resolvedEntityType) {
    console.log(`📴 Offline: Serving ${resolvedEntityType} from cache`);
    
    const cachedData = await offlineManager.getCachedData(
      resolvedEntityType,
      resolvedEntityId
    );

    if (cachedData !== null) {
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        statusText: 'OK (Cached)',
        headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' },
      });
    }
  }

  // Handle offline mutations - queue for sync
  if (!isOnline && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !skipQueue) {
    console.log(`📴 Offline: Queueing ${method} request to ${url}`);
    
    let bodyData: any;
    try {
      bodyData = fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined;
    } catch {
      bodyData = fetchOptions.body;
    }

    if (resolvedEntityType && bodyData) {
      const action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
      const localId = await offlineManager.storeLocally(resolvedEntityType, bodyData, action);
      
      await offlineManager.queueRequest({
        url,
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        body: bodyData,
        entityType: resolvedEntityType,
        entityId: localId,
        priority: syncPriority,
      });

      toast('Saved offline. Will sync when connected.', { icon: '📴', duration: 2000 });

      return new Response(JSON.stringify({ 
        ...bodyData, 
        id: localId, 
        _offline: true,
        _synced: false,
      }), {
        status: method === 'POST' ? 201 : 200,
        statusText: 'OK (Offline)',
        headers: { 'Content-Type': 'application/json', 'X-Offline': 'true' },
      });
    }
  }

  // Online request
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle auth errors
    if (response.status === 401 || response.status === 403) {
      const errorData = await response.clone().json().catch(() => ({}));
      if (
        errorData.error?.includes('expired') ||
        errorData.error?.includes('invalid')
      ) {
        apiClient.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    // Cache successful GET responses
    if (response.ok && method === 'GET' && !skipCache && resolvedEntityType) {
      const data = await response.clone().json().catch(() => null);
      if (data) {
        await offlineManager.cacheData(resolvedEntityType, data, { 
          merge: !!resolvedEntityId,
          markSynced: true,
        });
      }
    }

    // Cache successful mutations
    if (response.ok && ['POST', 'PUT', 'PATCH'].includes(method) && resolvedEntityType) {
      const data = await response.clone().json().catch(() => null);
      if (data) {
        await offlineManager.cacheItem(resolvedEntityType, data);
      }
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Network error - try offline fallback
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.log('🔌 Network error - falling back to offline mode');
      
      if (method === 'GET' && !skipCache && resolvedEntityType) {
        const cachedData = await offlineManager.getCachedData(
          resolvedEntityType,
          resolvedEntityId
        );

        if (cachedData !== null) {
          toast('Showing cached data', { icon: '📴', duration: 2000 });
          return new Response(JSON.stringify(cachedData), {
            status: 200,
            statusText: 'OK (Cached)',
            headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' },
          });
        }
      }

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !skipQueue) {
        let bodyData: any;
        try {
          bodyData = fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined;
        } catch {
          bodyData = fetchOptions.body;
        }

        await offlineManager.queueRequest({
          url,
          method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
          body: bodyData,
          entityType: resolvedEntityType,
          entityId: resolvedEntityId,
          priority: syncPriority,
        });

        toast('Saved locally. Will sync when online.', { icon: '📴' });

        return new Response(JSON.stringify({ _offline: true, _queued: true }), {
          status: 202,
          statusText: 'Accepted (Queued)',
          headers: { 'Content-Type': 'application/json', 'X-Queued': 'true' },
        });
      }
    }

    // Retry logic for network errors
    if (retries > 0 && error instanceof Error && error.name !== 'AbortError') {
      console.log(`Retrying request to ${url}, ${retries} attempts remaining`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return authenticatedFetch(url, { ...options, retries: retries - 1 });
    }

    throw error;
  }
};

/**
 * Make an authenticated JSON request and parse the response
 */
export const fetchJSON = async <T = any>(
  url: string,
  options: FetchOptions = {}
): Promise<T> => {
  const response = await authenticatedFetch(url, options);

  if (!response.ok && !response.headers.get('X-Offline')) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Check if the user is currently online
 */
export const isOnline = (): boolean => {
  return offlineManager.isNetworkOnline();
};

/**
 * Wait for online status before making a request
 */
export const waitForOnline = (): Promise<void> => {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve();
      return;
    }

    const handler = () => {
      window.removeEventListener('online', handler);
      resolve();
    };

    window.addEventListener('online', handler);
  });
};

/**
 * Force sync all pending changes
 */
export const forceSync = async () => {
  return offlineManager.forceSync();
};

/**
 * Get pending sync count
 */
export const getPendingSyncCount = async (): Promise<number> => {
  return offlineManager.getPendingCount();
};

export default authenticatedFetch;
