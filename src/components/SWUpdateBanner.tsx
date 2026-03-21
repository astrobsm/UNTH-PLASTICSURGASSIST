/**
 * SWUpdateBanner — Shows a non-intrusive banner when a new version
 * of the service worker is waiting to activate.
 */

import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, X, RotateCcw } from 'lucide-react';
import { onSWUpdate, activateNewSW, checkForUpdates } from '../main';

export const SWUpdateBanner: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSWUpdate((available) => {
      if (available) {
        setUpdateAvailable(true);
        setCheckResult(null);
      }
    });
    return () => { unsubscribe(); };
  }, []);

  const handleUpdate = () => {
    setUpdating(true);
    activateNewSW();
    // If nothing happens after 5s, force reload
    setTimeout(() => window.location.reload(), 5000);
  };

  const handleCheckForUpdates = async () => {
    setChecking(true);
    setCheckResult(null);
    try {
      const found = await checkForUpdates();
      if (!found) {
        setCheckResult('You are on the latest version.');
        setTimeout(() => setCheckResult(null), 4000);
      }
    } catch {
      setCheckResult('Check failed. Try again.');
      setTimeout(() => setCheckResult(null), 4000);
    } finally {
      setChecking(false);
    }
  };

  return (
    <>
      {/* Update banner */}
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 flex-shrink-0 animate-bounce" />
              <div>
                <p className="text-sm font-semibold">New version available!</p>
                <p className="text-xs text-green-100">
                  Update now for the latest features and improvements.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpdate}
                disabled={updating}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-white text-green-700 rounded-lg text-sm font-medium
                           hover:bg-green-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${updating ? 'animate-spin' : ''}`} />
                {updating ? 'Updating...' : 'Update Now'}
              </button>
              <button
                onClick={() => setUpdateAvailable(false)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check for Updates button — always visible in bottom-left */}
      {!updateAvailable && (
        <div className="fixed bottom-20 left-4 z-[55]">
          <button
            onClick={handleCheckForUpdates}
            disabled={checking}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-xl shadow-lg text-xs font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-60"
            title="Check for app updates"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Check for Updates'}
          </button>
          {checkResult && (
            <div className="mt-2 px-3 py-1.5 bg-gray-800 text-white text-xs rounded-lg shadow-lg animate-in fade-in">
              {checkResult}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SWUpdateBanner;
