import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { userManagementService } from '../services/userManagementService';
import { apiClient } from '../services/apiClient';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'consultant' | 'senior_registrar' | 'junior_registrar' | 'medical_officer' | 'house_officer' | 'nursing' | 'lab' | 'pharmacy';
  privileges: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initializeAuth: () => Promise<void>;
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

          if (backendAvailable) {
            // Use backend API
            const response = await apiClient.login(email, password);
            
            const user: User = {
              id: response.user.id,
              name: response.user.full_name,
              email: response.user.email,
              role: response.user.role as any,
              privileges: [] // Will be populated from role
            };

            set({ user, token: response.token });
          } else {
            // Fallback to IndexedDB
            const authenticatedUser = await userManagementService.authenticateUser(email, password);
            
            if (!authenticatedUser) {
              throw new Error('Invalid email or password');
            }

            if (!authenticatedUser.is_active) {
              throw new Error('Your account has been deactivated. Please contact the administrator.');
            }

            const user: User = {
              id: authenticatedUser.id!.toString(),
              name: authenticatedUser.name,
              email: authenticatedUser.email,
              role: authenticatedUser.role as any,
              privileges: authenticatedUser.privileges
            };

            const token = btoa(JSON.stringify({ userId: user.id, timestamp: Date.now() }));
            set({ user, token });
          }
          
          set({ loading: false });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: () => {
        set({ user: null, token: null, loading: false });
      },

      initializeAuth: async () => {
        try {
          // Initialize admin account if it doesn't exist
          await userManagementService.initializeAdminAccount();
          
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