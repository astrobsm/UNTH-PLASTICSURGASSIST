import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userManagementService } from '../services/userManagementService';
import { apiClient } from '../services/apiClient';
import { encrypt, decrypt, initializeEncryption, clearEncryption } from '../utils/encryption';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'consultant' | 'senior_registrar' | 'junior_registrar' | 'house_officer';
  privileges: string[];
  mustChangePassword?: boolean;
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
            // ─── Offline login: allow access if user was previously authenticated ───
            const state = get();
            if (state.token && state.user && state.user.email === email) {
              // User was previously logged in with this email — allow offline access
              console.log('📴 Offline login: restoring previous session for', email);
              await initializeEncryption(password);
              set({ loading: false });
              return;
            }
            throw new Error('Unable to connect to server. Please check your connection and try again.');
          }

          // Use backend API
          const response = await apiClient.login(email, password);
          
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
              // Only clear auth if we're online and token is truly invalid
              if (navigator.onLine) {
                console.warn('Token validation failed, logging out');
                set({ user: null, token: null, loading: false });
                apiClient.logout();
              } else {
                // Network error while checking — trust cached session
                console.log('📴 Network error during auth check: trusting cached session');
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