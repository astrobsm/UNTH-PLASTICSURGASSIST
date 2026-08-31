/**
 * Offline-First Fetch Helper
 * Provides offline-first data access with automatic sync
 * - Reads from cache when offline
 * - Queues mutations for sync when offline
 * - Updates cache on successful API calls
 */

import { apiClient } from './apiClient';
import { offlineManager } from './offlineManager';
import toast from 'react-hot-toast';

export interface OfflineFetchOptions extends Omit<RequestInit, 'priority'> {
  timeout?: number;
  retries?: number;
  // Offline-specific options
  cacheKey?: string; // Key for caching in IndexedDB
  entityType?: string; // Entity type for sync queue
  entityId?: string | number; // Entity ID for updates/deletes
  skipCache?: boolean; // Skip reading from cache
  skipQueue?: boolean; // Skip queueing for sync
  syncPriority?: 'high' | 'normal' | 'low'; // Sync priority (renamed to avoid conflict)
}

// API Base URL
const API_BASE_URL = (import.meta as any).env?.PROD ? '/api' : 'http://localhost:3005/api';

/**
 * Extract entity type and ID from URL
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
 * Make an authenticated fetch request with offline support
 */
export const offlineFetch = async (
  url: string,
  options: OfflineFetchOptions = {}
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

  // Check if we're online
  const isOnline = offlineManager.isNetworkOnline();

  // For GET requests when offline, try to serve from cache
  if (method === 'GET' && !isOnline && !skipCache) {
    console.log(`📴 Offline: Serving ${resolvedEntityType} from cache`);
    
    const cachedData = await offlineManager.getCachedData(
      resolvedEntityType,
      resolvedEntityId
    );

    if (cachedData !== null) {
      // Create a mock response with cached data
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        statusText: 'OK (Cached)',
        headers: { 'Content-Type': 'application/json', 'X-From-Cache': 'true' },
      });
    } else {
      // No cached data available
      return new Response(JSON.stringify({ error: 'No cached data available', offline: true }), {
        status: 503,
        statusText: 'Offline - No Cache',
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // For mutations when offline, queue them
  if (!isOnline && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !skipQueue) {
    console.log(`📴 Offline: Queueing ${method} request to ${url}`);
    
    let bodyData: any;
    try {
      bodyData = fetchOptions.body ? JSON.parse(fetchOptions.body as string) : undefined;
    } catch {
      bodyData = fetchOptions.body;
    }

    // Store in local database
    if (resolvedEntityType && bodyData) {
      const action = method === 'POST' ? 'create' : method === 'DELETE' ? 'delete' : 'update';
      const localId = await offlineManager.storeLocally(resolvedEntityType, bodyData, action);
      
      // Queue for sync
      await offlineManager.queueRequest({
        url,
        method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        body: bodyData,
        entityType: resolvedEntityType,
        entityId: localId,
        priority: syncPriority,
      });

      // Return success response with local ID
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

    // Queue the request without local storage
    await offlineManager.queueRequest({
      url,
      method: method as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      body: bodyData,
      entityType: resolvedEntityType,
      entityId: resolvedEntityId,
      priority: syncPriority,
    });

    toast('Changes saved locally. Will sync when online.', { icon: '📴' });

    return new Response(JSON.stringify({ _offline: true, _queued: true }), {
      status: 202,
      statusText: 'Accepted (Queued)',
      headers: { 'Content-Type': 'application/json', 'X-Queued': 'true' },
    });
  }

  // Online: make the actual request
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

    // Cache successful POST/PUT responses (update local cache)
    if (response.ok && ['POST', 'PUT', 'PATCH'].includes(method) && resolvedEntityType) {
      const data = await response.clone().json().catch(() => null);
      if (data) {
        await offlineManager.cacheItem(resolvedEntityType, data);
      }
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Network error - we might have gone offline
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      console.log('🔌 Network error detected, falling back to offline mode');
      
      // For GET requests, try cache
      if (method === 'GET' && !skipCache) {
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

      // For mutations, queue them
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
      console.log(`🔄 Retrying request to ${url}, ${retries} attempts remaining`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return offlineFetch(url, { ...options, retries: retries - 1 });
    }

    throw error;
  }
};

/**
 * Make an offline-first JSON request and parse the response
 */
export const offlineFetchJSON = async <T = any>(
  url: string,
  options: OfflineFetchOptions = {}
): Promise<T> => {
  const response = await offlineFetch(url, options);

  if (!response.ok && !response.headers.get('X-Offline')) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * GET request with offline support
 */
export const offlineGet = async <T = any>(
  endpoint: string,
  options: Omit<OfflineFetchOptions, 'method'> = {}
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return offlineFetchJSON<T>(url, { ...options, method: 'GET' });
};

/**
 * POST request with offline support
 */
export const offlinePost = async <T = any>(
  endpoint: string,
  body: any,
  options: Omit<OfflineFetchOptions, 'method' | 'body'> = {}
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return offlineFetchJSON<T>(url, {
    ...options,
    method: 'POST',
    body: JSON.stringify(body),
  });
};

/**
 * PUT request with offline support
 */
export const offlinePut = async <T = any>(
  endpoint: string,
  body: any,
  options: Omit<OfflineFetchOptions, 'method' | 'body'> = {}
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return offlineFetchJSON<T>(url, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(body),
  });
};

/**
 * PATCH request with offline support
 */
export const offlinePatch = async <T = any>(
  endpoint: string,
  body: any,
  options: Omit<OfflineFetchOptions, 'method' | 'body'> = {}
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return offlineFetchJSON<T>(url, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
};

/**
 * DELETE request with offline support
 */
export const offlineDelete = async <T = any>(
  endpoint: string,
  options: Omit<OfflineFetchOptions, 'method'> = {}
): Promise<T> => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  return offlineFetchJSON<T>(url, { ...options, method: 'DELETE' });
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

// Export for backward compatibility
export { offlineFetch as authenticatedFetch, offlineFetchJSON as fetchJSON };
export default offlineFetch;
