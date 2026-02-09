/**
 * PWAInstallPrompt — A rich, animated install prompt for the PWA.
 * Shows after 30s if not already dismissed in this session.
 */

import React, { useState, useEffect } from 'react';
import { Download, Wifi, WifiOff, HardDrive, X, Smartphone } from 'lucide-react';

interface PWAInstallPromptProps {
  prompt: any;
  onInstall: () => void;
}

export function PWAInstallPrompt({ prompt, onInstall }: PWAInstallPromptProps) {
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  // Delay showing the prompt for 30s after page load
  useEffect(() => {
    const dismissed = sessionStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    const timer = setTimeout(() => setVisible(true), 30_000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    setInstalling(true);
    try {
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        onInstall();
      }
    } finally {
      setInstalling(false);
      setVisible(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa-install-dismissed', '1');
    setVisible(false);
    onInstall();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/20 transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
              <Smartphone className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Install PS Assistant</h3>
              <p className="text-sm text-green-100">Add to your home screen</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="p-5 space-y-3">
          <Feature
            icon={<WifiOff className="w-5 h-5 text-amber-500" />}
            title="Works Offline"
            description="Access patient data & clinical tools without internet"
          />
          <Feature
            icon={<Download className="w-5 h-5 text-blue-500" />}
            title="Instant Access"
            description="Open directly from home screen — no browser needed"
          />
          <Feature
            icon={<HardDrive className="w-5 h-5 text-green-500" />}
            title="Auto-Sync"
            description="Changes sync automatically when you're back online"
          />
        </div>

        {/* Actions */}
        <div className="p-5 pt-0 flex gap-3">
          <button
            onClick={handleInstall}
            disabled={installing}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl
                       font-semibold text-sm hover:bg-green-700 active:bg-green-800 transition-colors
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download className={`w-5 h-5 ${installing ? 'animate-bounce' : ''}`} />
            {installing ? 'Installing...' : 'Install App'}
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-3 text-gray-500 rounded-xl text-sm font-medium
                       hover:bg-gray-100 transition-colors"
          >
            Not now
          </button>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.4s ease-out; }
      `}</style>
    </div>
  );
}

function Feature({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}