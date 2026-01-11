/**
 * CSRF Protection Utility
 * Generates and validates CSRF tokens for state-changing requests
 * Prevents Cross-Site Request Forgery attacks
 */

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Generate a random CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Store CSRF token in sessionStorage
 */
export function storeCSRFToken(token: string): void {
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
}

/**
 * Get current CSRF token from sessionStorage
 */
export function getCSRFToken(): string | null {
  return sessionStorage.getItem(CSRF_TOKEN_KEY);
}

/**
 * Initialize CSRF token (call on app load)
 */
export function initializeCSRFToken(): string {
  let token = getCSRFToken();
  
  if (!token) {
    token = generateCSRFToken();
    storeCSRFToken(token);
  }
  
  return token;
}

/**
 * Get CSRF token for request headers
 */
export function getCSRFHeaders(): Record<string, string> {
  const token = getCSRFToken();
  
  if (!token) {
    console.warn('CSRF token not initialized. Call initializeCSRFToken() on app load.');
    return {};
  }
  
  return {
    [CSRF_HEADER_NAME]: token
  };
}

/**
 * Validate CSRF token (server-side validation)
 */
export function validateCSRFToken(requestToken: string, sessionToken: string): boolean {
  if (!requestToken || !sessionToken) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (requestToken.length !== sessionToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < requestToken.length; i++) {
    result |= requestToken.charCodeAt(i) ^ sessionToken.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Regenerate CSRF token (call after login/logout)
 */
export function regenerateCSRFToken(): string {
  const token = generateCSRFToken();
  storeCSRFToken(token);
  return token;
}

/**
 * Clear CSRF token (call on logout)
 */
export function clearCSRFToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
}

/**
 * Axios interceptor to add CSRF token to requests
 */
export const csrfInterceptor = {
  request: (config: any) => {
    // Only add CSRF token to state-changing requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method?.toUpperCase() || '')) {
      const csrfHeaders = getCSRFHeaders();
      config.headers = {
        ...config.headers,
        ...csrfHeaders
      };
    }
    return config;
  },
  
  response: (response: any) => {
    // Check if server sent a new CSRF token
    const newToken = response.headers['x-csrf-token'];
    if (newToken) {
      storeCSRFToken(newToken);
    }
    return response;
  },
  
  error: (error: any) => {
    // Handle CSRF token errors
    if (error.response?.status === 403 && error.response?.data?.error === 'CSRF token invalid') {
      // Regenerate token and retry
      regenerateCSRFToken();
      console.warn('CSRF token invalid. Token regenerated.');
    }
    return Promise.reject(error);
  }
};

export default {
  generateCSRFToken,
  storeCSRFToken,
  getCSRFToken,
  initializeCSRFToken,
  getCSRFHeaders,
  validateCSRFToken,
  regenerateCSRFToken,
  clearCSRFToken,
  csrfInterceptor
};
