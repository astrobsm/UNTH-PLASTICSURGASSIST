import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userManagementService } from '../services/userManagementService';
import { apiClient } from '../services/apiClient';
import { encrypt, decrypt, initializeEncryption, clearEncryption } from '../utils/encryption';
import { storeOfflineCredential, verifyOfflineCredential } from '../services/offlineAuthService';
import { dataSyncService } from '../services/dataSyncService';
import { db } from '../db/database';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'consultant' | 'senior_registrar' | 'junior_registrar' | 'house_officer' | 'student';
  privileges: string[];
  mustChangePassword?: boolean;
  full_name?: string;
  username?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearMustChangePassword: () => void;
  useBackend: boolean;
}

// Build a User from an offline credential record and finalise the login state.
// Used by the offline fallback path inside login().
async function applyOfflineLogin(
  email: string,
  password: string,
  set: (s: Partial<AuthState>) => void
): Promise<boolean> {
  const offlineUser = await verifyOfflineCredential(email, password);
  if (!offlineUser) return false;
  const user: User = {
    id: offlineUser.id,
    name: offlineUser.name,
    email: offlineUser.email,
    role: offlineUser.role as any,
    privileges: [],
  };
  await initializeEncryption(password);
  // Keep any existing token from a previous online session so queued mutations
  // can still authenticate when connectivity returns. Do NOT clear it.
  set({ user, loading: false, useBackend: false });
  console.log('✅ Offline login succeeded for', email);
  return true;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: true,
      useBackend: true, // Will be determined on init

      login: async (email: string, password: string) => {
        // ── Step 1: try ONLINE login if the browser thinks we're online ──
        // We do NOT pre-flight with a /health check — that wastes precious
        // seconds on a poor network. Instead we attempt the real login with
        // a tight timeout (apiClient.request enforces 8s for /auth) and fall
        // through to the offline credential cache on ANY failure.
        let onlineError: any = null;

        if (navigator.onLine) {
          try {
            const response = await apiClient.login(email, password);

            if (!response || !response.user || !response.user.id) {
              console.error('Login response missing user data:', JSON.stringify(response));
              throw new Error('Login failed — server returned an unexpected response. Please try again.');
            }

            const user: User = {
              id: response.user.id,
              name: response.user.fullName,
              email: response.user.email,
              role: response.user.role as any,
              privileges: [],
              mustChangePassword: response.user.mustChangePassword || false,
            };

            localStorage.setItem('userId', String(response.user.id));
            await initializeEncryption(password);
            await encrypt(JSON.stringify(user)); // warm up encryption (result unused)

            // Store hashed credential so the user can log in next time without network
            try {
              await storeOfflineCredential(email, password, {
                id: user.id,
                name: user.name,
                role: user.role,
              });
              console.log('🔐 Offline credential stored for', email);
            } catch (credErr) {
              console.warn('Failed to store offline credential (non-fatal):', credErr);
            }

            set({ user, token: response.token, loading: false, useBackend: true });
            return;
          } catch (err: any) {
            onlineError = err;
            const code = err?.code;
            const msg = (err?.message || '').toLowerCase();
            // Auth-rejection messages from the server (401/403) — DO NOT fall back
            // to offline, the user really did type the wrong password / is locked out.
            const isHardAuthFail =
              msg.includes('invalid credentials') ||
              msg.includes('account is disabled') ||
              msg.includes('pending approval') ||
              msg.includes('password not set');
            if (isHardAuthFail) {
              set({ loading: false });
              throw err;
            }
            // Network/timeout/server-down — fall through to offline cache below
            console.log('⚠️ Online login failed, attempting offline fallback:', code || msg || err);
          }
        }

        // ── Step 2: offline fallback (works whether navigator.onLine is true or false) ──
        try {
          const ok = await applyOfflineLogin(email, password, set);
          if (ok) return;
        } catch (offlineErr) {
          console.error('Offline login attempt errored:', offlineErr);
        }

        set({ loading: false });
        if (onlineError) throw onlineError;
        throw new Error(
          navigator.onLine
            ? 'Login failed and no offline credential found for this account.'
            : 'You are offline and have not previously logged in on this device.'
        );
      },

      logout: async () => {
        clearEncryption();
        localStorage.removeItem('userId');
        // SECURITY: Clear all patient-specific data from localStorage to prevent cross-user data leakage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('vitals_')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        // PHI hygiene on a SHARED ward device.
        // Cached clinical data previously survived logout in IndexedDB and the
        // service-worker cache, and api_cache is keyed by endpoint with no user
        // scoping. The next user to sign in was served the previous user's
        // patient list from the stale-while-revalidate path — and exclusively
        // so while offline, where the cache is the only source.
        try {
          // Read caches are always safe to drop — they are server-derived.
          await db.api_cache.clear();
          if (typeof caches !== 'undefined') {
            const keys = await caches.keys();
            await Promise.all(
              keys.filter(k => k.startsWith('api-cache')).map(k => caches.delete(k))
            );
          }

          // Entity tables can hold records created offline that have not been
          // pushed yet. Cache hygiene must never destroy un-synced clinical
          // work, so only clear them when nothing is pending.
          if (await dataSyncService.hasPendingChanges()) {
            console.warn(
              'Logout: unsynced changes present — keeping local clinical records. ' +
              'They will sync when this device next reconnects.'
            );
          } else {
            await dataSyncService.clearAllData();
          }
        } catch (err) {
          console.error('Logout cache clear failed:', err);
        }

        set({ user: null, token: null, loading: false });
        apiClient.logout();
      },

      clearMustChangePassword: () => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, mustChangePassword: false } });
        }
      },

      initializeAuth: async () => {
        try {
          // Check if we have stored auth data
          const state = get();
          if (state.token && state.user) {
            // Ensure apiClient has the token in memory + localStorage. Staff
            // logins set this via apiClient.login(), but the student login path
            // only persists to the store, so hydrate it here for both on reload.
            apiClient.setToken(state.token);
            // If offline, trust the cached token/user — don't attempt validation
            if (!navigator.onLine) {
              console.log('📴 Offline: trusting cached auth session');
              set({ loading: false });
              return;
            }
            // Validate token with backend
            try {
              await apiClient.getCurrentUser();
              set({ loading: false });
            } catch (error) {
              // Only clear auth on CONFIRMED auth failures (401/403)
              // Do NOT logout on transient errors (503 cold start, 500 server error, network timeout)
              // — those would race with the sync service and wipe the token mid-sync
              const errorMsg = error instanceof Error ? error.message : String(error);
              const isAuthError = errorMsg.includes('expired') || errorMsg.includes('invalid') || errorMsg.includes('No token');
              if (navigator.onLine && isAuthError) {
                console.warn('Token confirmed invalid/expired, logging out');
                set({ user: null, token: null, loading: false });
                apiClient.logout();
              } else {
                // Transient error (503, 500, network) — trust cached session
                console.log('⚠️ Auth check failed (transient), keeping session:', errorMsg);
                set({ loading: false });
              }
            }
          } else {
            set({ loading: false });
          }
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          set({ loading: false });
        }
      },
    }),
    {
      name: 'psa-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, token: state.token }),
    }
  )
);

// A CONFIRMED expiry (401/403 saying expired/invalid) clears apiClient's token,
// but the route gate reads this store — without this the UI stays "logged in"
// and every protected call fails locally with "No token provided". It also
// stops apiClient.getToken() from healing itself back to a dead token.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:expired', () => {
    if (!useAuthStore.getState().token && !useAuthStore.getState().user) return;
    console.warn('Session expired — clearing auth state');
    clearEncryption();
    localStorage.removeItem('userId');
    useAuthStore.setState({ user: null, token: null, loading: false });
  });
}