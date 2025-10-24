'use client';

import React, { useState, useEffect } from 'react';
import { useBaseAccount } from '@/providers/base-account-context';
import { debugLog } from "@/lib/utils/debugLog";

export default function BaseAccountStatus() {
  const { isConnected, error, promptSetup } = useBaseAccount();
  const [isDismissed, setIsDismissed] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Reset dismissed state only when error MESSAGE changes (not just when error exists)
  useEffect(() => {
    if (error && error !== lastError) {
      setIsDismissed(false);
      setLastError(error);
    }
  }, [error, lastError]);

  // Don't show anything if already connected
  if (isConnected) {
    return null;
  }

  // Don't show if no error
  if (!error) {
    return null;
  }

  // Don't show if user dismissed
  if (isDismissed) {
    return null;
  }

  // Show helpful message for Base Account setup
  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-xl border-2 border-purple-500/50 rounded-2xl p-6 shadow-2xl z-[9999] animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
            Set Up Base Account
          </h3>
          
          <p className="text-sm text-gray-300 mb-2">
            {error}
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                debugLog('🔑 Prompting Base Account setup via Privy...');
                promptSetup();
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white text-sm font-semibold rounded-lg transition-all shadow-lg hover:shadow-purple-500/50"
            >
              Set Up Base Account
            </button>
          </div>
        </div>

        <button
          onClick={() => {
            setIsDismissed(true);
            localStorage.setItem('baseAccountDeclined', 'true');
            debugLog('❌ User declined Base Account setup');
          }}
          className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
