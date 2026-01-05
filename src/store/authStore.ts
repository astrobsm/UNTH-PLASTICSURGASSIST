import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userManagementService } from '../services/userManagementService';
import { apiClient } from '../services/apiClient';

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
            throw new Error('Unable to connect to server. Please check your connection.');
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

          set({ user, token: response.token });
          set({ loading: false });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: () => {
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
            // Token exists, validate it's still valid
            // In production, this would validate with backend
            set({ loading: false });
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