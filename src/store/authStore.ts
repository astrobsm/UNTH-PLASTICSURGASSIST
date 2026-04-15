import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userManagementService } from '../services/userManagementService';
import { apiClient } from '../services/apiClient';
import { encrypt, decrypt, initializeEncryption, clearEncryption } from '../utils/encryption';
import { storeOfflineCredential, verifyOfflineCredential } from '../services/offlineAuthService';

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
  logout: () => void;
  initializeAuth: () => Promise<void>;
  clearMustChangePassword: () => void;
  useBackend: boolean;
}

// Check if backend is available
async function checkBackend(): Promise<boolean> {
  try {
    await apiClient.healthCheck();
    return true;
  } catch {
    return false;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      loading: true,
      useBackend: true, // Will be determined on init

      login: async (email: string, password: string) => {
        try {
          // Try backend first
          const backendAvailable = await checkBackend();
          set({ useBackend: backendAvailable });

          if (!backendAvailable) {
            // ─── Offline login: verify password against stored PBKDF2 hash ───
            console.log('📴 Offline login: verifying credentials for', email);
            const offlineUser = await verifyOfflineCredential(email, password);
            if (offlineUser) {
              const user: User = {
                id: offlineUser.id,
                name: offlineUser.name,
                email: offlineUser.email,
                role: offlineUser.role as any,
                privileges: [],
              };
              await initializeEncryption(password);
              set({ user, loading: false });
              console.log('✅ Offline login succeeded for', email);
              return;
            }
            throw new Error('Offline login failed. Either you have never logged in online on this device, or the password is incorrect.');
          }

          // Use backend API
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
            privileges: [], // Will be populated from role
            mustChangePassword: response.user.mustChangePassword || false
          };

          // Store userId in localStorage for services that need it
          localStorage.setItem('userId', String(response.user.id));

          // Initialize encryption with password and encrypt user data
          await initializeEncryption(password);
          const encryptedUser = await encrypt(JSON.stringify(user));
          
          // ─── Store hashed credential for future offline logins ───
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

          set({ user, token: response.token });
          set({ loading: false });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: () => {
        clearEncryption();
        localStorage.removeItem('userId');
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