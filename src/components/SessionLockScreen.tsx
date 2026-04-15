/**
 * SessionLockScreen
 * 
 * Automatically locks the app after a period of inactivity (default 15 min).
 * The lock screen requires the user's password to resume — this is separate
 * from a full logout so cached data and state are preserved.
 * 
 * HIPAA §164.312(a)(2)(iii): "Automatic logoff" — terminate an electronic
 * session after a predetermined time of inactivity.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { verifyOfflineCredential } from '../services/offlineAuthService';
import { initializeEncryption } from '../utils/encryption';

// ── Configuration ────────────────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const USER_ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove',
];

interface SessionLockScreenProps {
  children: React.ReactNode;
}

export function SessionLockScreen({ children }: SessionLockScreenProps) {
  const { user, logout } = useAuthStore();
  const [locked, setLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    if (!user) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setLocked(true);
      setPassword('');
      setError('');
    }, INACTIVITY_TIMEOUT_MS);
  }, [user]);

  // Attach / detach user-activity listeners
  useEffect(() => {
    if (!user) return;

    // Start the timer on mount
    resetTimer();

    const handleActivity = () => {
      if (!locked) resetTimer();
    };

    USER_ACTIVITY_EVENTS.forEach(evt =>
      document.addEventListener(evt, handleActivity, { passive: true })
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      USER_ACTIVITY_EVENTS.forEach(evt =>
        document.removeEventListener(evt, handleActivity)
      );
    };
  }, [user, locked, resetTimer]);

  // Unlock handler – verify password via offline credential store
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUnlocking(true);
    setError('');

    try {
      // First try offline credential verification (PBKDF2-based, works offline)
      const verified = await verifyOfflineCredential(user.email, password);
      if (verified) {
        await initializeEncryption(password);
        setLocked(false);
        setPassword('');
        resetTimer();
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again or log out.');
    } finally {
      setUnlocking(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    setLocked(false);
    logout();
  };

  if (!user || !locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-green-600 px-6 py-5 text-center">
          <div className="mx-auto w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Session Locked</h2>
          <p className="text-green-100 text-sm mt-1">
            Locked due to inactivity
          </p>
        </div>

        {/* User info */}
        <div className="px-6 pt-5 pb-2 text-center">
          <p className="font-semibold text-gray-800">{user.name || user.email}</p>
          <p className="text-xs text-gray-500 capitalize">{user.role?.replace(/_/g, ' ')}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
            {error}
          </div>
        )}

        {/* Unlock form */}
        <form onSubmit={handleUnlock} className="px-6 pt-3 pb-6 space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password to unlock"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              autoFocus
              required
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <button
            type="submit"
            disabled={unlocking || !password}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-lg disabled:opacity-50 transition-colors"
          >
            <ShieldCheck className="w-5 h-5" />
            {unlocking ? 'Verifying…' : 'Unlock'}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-red-600 text-sm py-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out instead
          </button>
        </form>

        {/* HIPAA footer */}
        <div className="bg-gray-50 px-6 py-3 text-center">
          <p className="text-[11px] text-gray-400">
            This session was locked to protect patient information (HIPAA §164.312)
          </p>
        </div>
      </div>
    </div>
  );
}
