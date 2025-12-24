/**
 * Authenticated Fetch Helper
 * Provides consistent authentication and error handling across all services
 */

import { apiClient } from './apiClient';

export interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

/**
 * Make an authenticated fetch request with proper headers and error handling
 */
export const authenticatedFetch = async (
  url: string,
  options: FetchOptions = {}
): Promise<Response> => {
  const token = apiClient.getToken();
  const { timeout = 30000, retries = 0, ...fetchOptions } = options;

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
      const errorData = await response.json().catch(() => ({}));
      if (
        errorData.error?.includes('expired') ||
        errorData.error?.includes('invalid')
      ) {
        apiClient.setToken(null);
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

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

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Check if the user is currently online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
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

export default authenticatedFetch;
