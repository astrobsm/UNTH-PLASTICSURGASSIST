import { useAuthStore } from '../store/authStore';

/**
 * Get the current logged-in user's full name.
 * Can be called from non-React contexts (event handlers, services).
 */
export function getCurrentUserName(): string {
  return useAuthStore.getState().user?.name || 'Unknown';
}

/**
 * Get the current logged-in user's role.
 */
export function getCurrentUserRole(): string {
  return useAuthStore.getState().user?.role || 'unknown';
}
